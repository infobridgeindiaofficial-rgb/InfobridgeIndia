"""Build the browser HSN/SAC directory with meaningful hierarchical labels."""
import gzip
import json
import re
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "reference-files" / "HSN_SAC.xlsx"
OUTPUT = ROOT / "src" / "hsn-sac-finder" / "directory.json.gz"


def clean(value):
    return re.sub(r"\s+", " ", str(value or "")).strip(" :")


def is_generic(value):
    text = clean(value).upper()
    return text in {"-", "OTHER", "OTHERS", "OTHER ARTICLES", "OTHER GOODS", "N.E.S.", "NES"}


def hierarchy_description(code, description, descriptions):
    description = clean(description)
    if len(code) <= 4 or (len(description) >= 45 and not is_generic(description)):
        return description

    parts = []
    for length in (2, 4, 6):
        if length >= len(code):
            continue
        parent = clean(descriptions.get(code[:length], ""))
        if parent and not is_generic(parent) and parent not in parts:
            parts.append(parent)
    if description and not is_generic(description) and description not in parts:
        parts.append(description)
    elif is_generic(description):
        parts.append("OTHER GOODS UNDER THIS HEADING")
    return " — ".join(parts) or description


def build():
    rows = []
    for sheet, kind, code_column, description_column in (
        ("HSN_MSTR", "HSN", "HSN_CD", "HSN_Description"),
        ("SAC_MSTR", "SAC", "SAC_CD", "SAC_Description"),
    ):
        frame = pd.read_excel(SOURCE, sheet_name=sheet, dtype=str).fillna("")
        descriptions = {clean(row[code_column]): clean(row[description_column]) for _, row in frame.iterrows()}
        for _, row in frame.iterrows():
            code = clean(row[code_column])
            description = clean(row[description_column])
            if not code or not description:
                continue
            rows.append([kind, code, hierarchy_description(code, description, descriptions)])

    payload = json.dumps(rows, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with gzip.GzipFile(OUTPUT, "wb", mtime=0) as archive:
        archive.write(payload)
    print(f"Built {len(rows)} HSN/SAC rows at {OUTPUT}")


if __name__ == "__main__":
    build()
