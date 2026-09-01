"""Build the browser GST-rate schedule for the HSN/SAC finder.

Source of truth: reference-files/gst-rate-schedule.json, a plain-JSON transcription of the
CBIC-published GST rate schedule (one row per notified line item: kind, HSN/SAC code cell as
published, description, CGST, SGST/UTGST, IGST, cess, condition). That file is the "raw" input
here in exactly the same sense HSN_SAC.xlsx is the raw input to build-hsn-directory.py -- this
script never invents a rate; it only parses and (very conservatively) disambiguates the codes
already present in that source.

What this script fixes, at the data layer rather than at UI/runtime:

1. Code-cell parsing. A single published line item can cover several codes at once, written as
   a comma list ("0202, 0203, ..."), an "or" list ("1701 or 1702"), an inclusive range
   ("3901 to 3913"), and/or a bracketed exclusion ("0910 [other than 0910 11 10, 0910 30 10]").
   Multi-digit codes are themselves often written with a space between each 2-digit group
   ("7323 93 90"), which a naive `\\d{2,8}` regex splits into unrelated fragments (e.g. treating
   "7323 9410" as the two unrelated headings 7323 and 9410 -- 9410 is furniture, not part of
   heading 7323 at all). This script parses each cell into a clean list of included codes and a
   separate list of excluded codes, so no code is ever silently mis-split.

2. Heading-level ambiguity. Some 4-digit (or 6-digit) headings have more than one published rate
   line because the heading itself groups together goods that are genuinely different at a more
   specific level the directory already has a code for (example: heading 7323 covers both
   "table, kitchen ... articles of iron or steel" AND "iron or steel wool; pot scourers", and the
   directory already carries a distinct 6-digit code, 732310, for the second group). When a rate
   line's own description matches one specific child code's own description clearly and
   uniquely, this script narrows that line to the child code instead of leaving it stuck at the
   ambiguous parent -- this is the direct fix for HSN 73239390 showing "multiple rates" (it was
   colliding with the iron/steel-wool line purely because of the bare "7323" prefix, not because
   there is genuinely more than one rate for stainless-steel table/kitchen articles).

   This is deliberately conservative: it only narrows when exactly one child is a strong,
   unambiguous match. Genuine condition-based rate splits within one heading (packaged vs. loose,
   fresh vs. frozen, and similar) have no corresponding child code in the directory, so they are
   left exactly as published -- multiple rates, needing verification. That is correct, not a bug:
   this tool must never guess which condition applies.

Output: src/hsn-sac-finder/rates.json.gz, rows of
  [kind, code, description, cgst, sgst, igst, cess, condition, excludedCodesCsv]
one row per resolved (included code, source line) pair. `excludedCodesCsv` is a comma-separated
list of the codes this specific line explicitly does not cover (may be empty).
"""
import gzip
import json
import re
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW_RATES = ROOT / "reference-files" / "gst-rate-schedule.json"
HSN_SOURCE = ROOT / "reference-files" / "HSN_SAC.xlsx"
OUTPUT = ROOT / "src" / "hsn-sac-finder" / "rates.json.gz"

STOPWORDS = frozenset("""
    of the and or other others than goods all articles for in not a an with parts thereof kind
    used use uses specified elsewhere included like likes similar being any such made from as
    is are their its per etc under this that those these to on by
""".split())

BRACKET_RE = re.compile(r"[\[\(]([^\[\]\(\)]*)[\]\)]?")
DIGIT_RUN_RE = re.compile(r"\d[\d ]{0,9}\d|\d{2,8}")


def clean(value):
    return re.sub(r"\s+", " ", str(value or "")).strip(" :")


EXCLUSION_SPAN_RE = re.compile(r"[\[\(]\s*(?:except|other than|excluding)\b[^\[\]\(\)]*[\]\)]?", re.IGNORECASE)


def without_exclusion_text(text):
    """Drop "(except ...)"/"(other than ...)" spans before matching, so a default/catch-all
    line that merely *names* the thing it excludes (e.g. "Tractors (except road tractors for
    semi-trailers ...)") is never mistaken for a line *about* that excluded thing."""
    return EXCLUSION_SPAN_RE.sub(" ", text)


def tokens(text):
    words = re.findall(r"[a-z]+", clean(text).lower())
    return {w for w in words if w not in STOPWORDS and len(w) > 2}


def normalize_code(raw):
    return re.sub(r"\s+", "", raw)


def codes_in(text):
    return [normalize_code(m) for m in DIGIT_RUN_RE.findall(text)]


def expand_range(low, high):
    if len(low) != len(high) or not low.isdigit() or not high.isdigit():
        return [low, high]
    width = len(low)
    lo, hi = int(low), int(high)
    if hi < lo or hi - lo > 200:
        return [low, high]
    return [str(n).zfill(width) for n in range(lo, hi + 1)]


def parse_cell(cell):
    """Return (included_codes, excluded_codes) for one published code cell."""
    excluded = []

    def take_bracket(match):
        content = match.group(1)
        if re.match(r"\s*(except|other than)\b", content, re.IGNORECASE):
            excluded.extend(codes_in(content))
        return " "

    remaining = BRACKET_RE.sub(take_bracket, cell)

    included = []
    for segment in re.split(r",|\bor\b", remaining, flags=re.IGNORECASE):
        segment = segment.strip()
        if not segment:
            continue
        range_match = re.match(r"^(\d[\d ]*\d|\d)\s+to\s+(\d[\d ]*\d|\d)$", segment, re.IGNORECASE)
        if range_match:
            included.extend(expand_range(normalize_code(range_match.group(1)), normalize_code(range_match.group(2))))
            continue
        included.extend(codes_in(segment))

    included = [c for c in included if c]
    excluded = [c for c in excluded if c]
    return included, excluded


def load_descriptions():
    """{kind: {code: raw official description}} straight from the source workbook, no hierarchy joining."""
    out = {"HSN": {}, "SAC": {}}
    for sheet, kind, code_column, description_column in (
        ("HSN_MSTR", "HSN", "HSN_CD", "HSN_Description"),
        ("SAC_MSTR", "SAC", "SAC_CD", "SAC_Description"),
    ):
        frame = pd.read_excel(HSN_SOURCE, sheet_name=sheet, dtype=str).fillna("")
        for _, row in frame.iterrows():
            code = clean(row[code_column])
            if code:
                out[kind][code] = clean(row[description_column])
    return out


def children_of(code, descriptions):
    """Direct hierarchy children one level below `code` (4->6 digit, 6->8 digit)."""
    if len(code) == 4:
        child_len = 6
    elif len(code) == 6:
        child_len = 8
    else:
        return []
    return [c for c in descriptions if len(c) == child_len and c.startswith(code)]


def best_child_match(row_text, code, descriptions):
    """Find the one child code (one hierarchy level below `code`) whose own official
    description is clearly the same thing this rate line's description is naming.

    The primary measure is recall -- what fraction of the row's own distinguishing words are
    accounted for by this one child's own description -- not similarity to the parent heading.
    A compound heading like 7323 often spells out both of its sub-groups verbatim in its own
    4-digit title, so a row that fully restates one sub-group (recall close to 1 against that
    one child) is confidently that child, even though the same words also appear in the parent's
    title. Two guards keep this from ever guessing:
      - the row must have at least 3 real content words -- a two-word residual phrase like
        "other articles of iron or steel" is the heading's own generic catch-all, not a specific
        child, even though both of its words trivially recall-match almost every child;
      - the winning child's recall must be far ahead of the runner-up's, so a row that equally
        restates the *whole* heading (matching several/all children about as well as each other)
        is correctly left unresolved rather than narrowed to whichever child happens to sort
        first.
    """
    row_tokens = tokens(without_exclusion_text(row_text))
    if len(row_tokens) < 3:
        return None
    best_code, best_recall, best_overlap, runner_up = None, 0.0, 0, 0.0
    for child in children_of(code, descriptions):
        child_tokens = tokens(descriptions[child])
        if not child_tokens:
            continue
        overlap = row_tokens & child_tokens
        recall = len(overlap) / len(row_tokens)
        if recall > best_recall:
            runner_up = best_recall
            best_recall, best_code, best_overlap = recall, child, len(overlap)
        elif recall > runner_up:
            runner_up = recall
    if best_code and best_recall >= 0.75 and best_recall >= runner_up * 1.5 and best_overlap >= 3:
        return best_code
    return None


def build():
    raw_rows = json.loads(RAW_RATES.read_text(encoding="utf-8"))
    descriptions = load_descriptions()

    # Pass 1: parse every line into (kind, code, excluded, row) tuples.
    parsed = []
    for row in raw_rows:
        kind, cell, description = row[0], clean(row[1]), clean(row[2])
        if not cell or not description or description.upper().startswith("[OMITTED"):
            continue
        included, excluded = parse_cell(cell)
        for code in included:
            parsed.append({"kind": kind, "code": code, "excluded": excluded, "row": row})

    # Pass 2: for headings where more than one line shares the same bare code with a different
    # rate, try to narrow each line to the one child code its own description clearly belongs to.
    by_code = {}
    for item in parsed:
        by_code.setdefault((item["kind"], item["code"]), []).append(item)

    for (kind, code), items in by_code.items():
        rates = {f"{i['row'][3]}|{i['row'][4]}|{i['row'][5]}" for i in items}
        if len(rates) <= 1:
            continue
        narrowed_children = []
        for item in items:
            child = best_child_match(item["row"][2], code, descriptions.get(kind, {}))
            if child:
                item["code"] = child
                narrowed_children.append(child)

        # Pass 3: a line that stays at the bare heading and whose own text names an exclusion
        # ("tractors *except* road tractors for semi-trailers ...") is explicitly not describing
        # everything under the heading. When a sibling line was just narrowed to a specific
        # child code, that is almost always the very thing being excluded (the schedule rarely
        # gives the excluded item its own numeric code inline) -- record it as excluded here so
        # a query for that child never sees this default line as a competing "multiple" result.
        if narrowed_children:
            for item in items:
                if item["code"] == code and re.search(r"\b(except|other than|excluding)\b", item["row"][2], re.IGNORECASE):
                    item["excluded"] = list({*item["excluded"], *narrowed_children})

    output_rows = []
    seen = set()
    for item in parsed:
        key = (item["kind"], item["code"], item["row"][3], item["row"][4], item["row"][5], item["row"][6], item["row"][7])
        if key in seen:
            continue
        seen.add(key)
        row = item["row"]
        output_rows.append([item["kind"], item["code"], row[2], row[3], row[4], row[5], row[6], row[7], ",".join(item["excluded"])])

    payload = json.dumps(output_rows, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with gzip.GzipFile(OUTPUT, "wb", mtime=0) as archive:
        archive.write(payload)
    print(f"Built {len(output_rows)} GST-rate rows at {OUTPUT}")


if __name__ == "__main__":
    build()
