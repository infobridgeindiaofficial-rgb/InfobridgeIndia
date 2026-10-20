# Shipping label duplicate detection — local verification

Run the focused suite with:

```
node --test tests/shipping-label-4in1.test.js tests/shipping-label-duplicates.test.js tests/shipping-label-couriers.test.js tests/shipping-label-review.test.js
```

All 55 tests pass. No network service, deployment or Git index change is required.

| Marketplace | Duplicate test | Result |
| --- | --- | --- |
| Amazon | Four generated labels, two shipments; within-file and cross-file copies with different formatting | Exactly 2 duplicate copies; selecting unique labels exports 2 labels |
| Supplied Amazon 001_invoice.pdf | Original and renamed copy of the supplied tax invoice | Amazon/order recognized; no AWB or shipment ID present; zero shipment duplicates inferred, both copies retained for manual review and export |
| Flipkart | Four generated labels, two shipments; within-file and cross-file copies with different formatting | Exactly 2 duplicate copies; selecting unique labels exports 2 labels |
| Supplied Flipkart originals | Five supplied cropped/full-page PDFs in tests/fixtures/shipping-labels/flipkart-real/ | Five unique orders and AWBs; zero duplicates; all formats recognized without parser changes |
| Supplied Flipkart repeat tests | Five originals plus five renamed, rewritten PDF copies; also combined into one ten-page PDF | Exactly 5 duplicates in each case; selected export contains 5 labels on 2 A4 sheets |
| Mixed real fixtures | Five real Flipkart, eleven real Meesho, one generated Amazon shipment, and one repeat from each marketplace | 20 labels; exactly 3 duplicate copies, one per marketplace |
| Meesho | Four generated labels, two shipments | Exactly 2 duplicate copies |
| Meesho requested distribution | Generated 10-label scenario with 7 unique orders/shipments across two files | Exactly 3 duplicate copies; selecting unique labels exports 7 labels onto 2 A4 sheets |
| Meesho supplied fixture | Two renamed uploads of reference-files/sample-shipping-label.pdf | Exactly 1 duplicate; unbranded Valmo label, table sub-order and tracking number recognized |
| Newly supplied Meesho PDFs | All 11 files in tests/fixtures/shipping-labels/meesho-real/ | 11 unique orders and AWBs, zero duplicates; all 11 labels retained on 3 A4 sheets |
| Copies of newly supplied PDFs | All 11 originals plus renamed copies | Exactly 11 duplicate copies |
| Real-file 10-label scenario | Seven of the supplied originals plus three deliberately repeated copies, across files and inside one combined PDF | Exactly 3 duplicates; selected export contains 7 labels on 2 A4 sheets |
| Mixed | Amazon, Flipkart and Meesho in each of two PDFs, identical filenames and tracking values across marketplaces | Exactly 3 duplicates, one per marketplace; no cross-marketplace matches |

The user subsequently supplied 11 single-page Meesho PDFs. They are saved unchanged in tests/fixtures/shipping-labels/meesho-real/; copies were SHA-256 verified against the explicitly supplied source paths. All 11 have distinct orders, sub-orders and tracking numbers. This batch is therefore not a ten-label/seven-unique/three-duplicate batch. That distribution is now tested both synthetically and by deliberately repeating three of seven real supplied labels, including a combined ten-page PDF. No supplied label is discarded to force the earlier expected count.

These real fixtures exposed two tracking extraction gaps: Shadowfax identifiers such as SF followed by digits and an FPL/MEL suffix, and courier branding spelled Xpress Bees with a space. Both formats are now supported. All 11 tracking numbers are extracted: six Shadowfax, two Valmo and three numeric tracking numbers (two XpressBees and one Delhivery, verified from printed names). The source desktop PDFs are untouched, and no fixture is staged or deployed.

## Courier identification and grouping

Each input page gets independent courier metadata alongside its existing duplicate identity. Printed Valmo, XpressBees/Xpress Bees, Shadowfax, Delhivery, Ecom Express and Ekart/E-Kart Logistics names normalize to consistent badges. Product/invoice text is excluded from courier-name matching. Multiple conflicting printed names produce Unknown Courier, not a guess. Only the precise VL + 13 digits and FMPC/FMPP + 10 digits patterns, corroborated by the stored Valmo/Ekart shipping fixtures, are used when the printed name is missing. Unqualified numeric tracking and SF/TBA prefixes do not imply a courier. Printed names take precedence.

Real fixture counts across the 11 Meesho, five Flipkart and one newly supplied Amazon invoice: Delhivery 1, Ekart 5, Shadowfax 6, Valmo 2, XpressBees 2, Unknown Courier 1. Ecom Express is covered by synthetic PDF tests; no real Ecom Express fixture was supplied. The Amazon invoice has no printed courier or reliable tracking prefix and remains selected as Unknown Courier.

Group by Delivery Partner is the default. The shared courier comparator orders all selected pages as XpressBees, Valmo, Shadowfax, Delhivery, Ekart, Ecom Express, Unknown Courier, retaining upload/page order within each group. The uploaded list shows a heading and selected-label count for every populated group, then one card per selected page. A mixed-courier multi-page PDF can appear under several headings, with each original page represented exactly once. Original Upload Order restores the ungrouped file list and original output sequence. Grouping does not change or rasterize source streams. Preview and export apply the same comparator and page selection, continue packing four labels per A4 sheet, and do not add group separator pages. Selected-only counts and file badges update when duplicate pages are removed. Unknown courier or failed extraction never excludes a label. Clear / Start Over restores grouped mode.

The real-sample controller regression deliberately uploads couriers in mixed order and verifies group headings/counts (XpressBees 2, Valmo 2, Shadowfax 6, Delhivery 1, Ekart 5, Unknown Courier 1), original order within each group, and matching AWB sequence in both preview and export. All 17 labels occupy five A4 sheets. Ecom Express is absent from the real samples and its position is verified with synthetic pages. Another regression combines the real samples into two mixed-courier 17-page PDFs: 34 page cards are grouped independently, 16 shipment duplicate copies are identified (the order-only Amazon invoice stays selected), and Remove/Keep actions update only their corresponding page cards and counts.

Courier tests cover spelling normalization, printed-name priority, conservative prefix fallback, ambiguity, real fixture counts, an eight-page mixed-marketplace PDF with all six courier names plus an unknown, stable grouping and filtered page selections. Controller coverage verifies grouped preview/export order and immediately updated courier counts after a duplicate removal. The existing compact Remove/Keep behavior and matching rules are unchanged.

The five subsequently supplied Flipkart PDFs are preserved under tests/fixtures/shipping-labels/flipkart-real/ with their original filenames and SHA-256-verified bytes. The set includes cropped invoice labels, a cropped shipping label and an uncropped order label. Each has a distinct OD-prefixed order and FMPC/FMPP tracking number. Duplicate identification already handles all five formats without matching-rule changes. Export testing exposed compressed PDF object streams in the cropped files, which the existing PDF reader did not support. The reader now decodes those object dictionaries while preserving the source content streams and vector embedding. The selected export is read back to verify that all five AWBs are present across its two A4 pages, and is byte-for-byte identical to exporting only the five originals. A source label may itself print the same AWB more than once. Their originals in Downloads and the desktop folder are untouched.

Additional checks cover separate shipments on one order, different orders with the same customer/address/SKU, conflicting identifiers, partial-identifier matching without unsafe transitive merging, shipment IDs without AWBs, Meesho sub-order suffixes, shared Ekart carriers, isolated courier tracking numbers, case/hyphen/spacing normalization, page selection and unchanged source bytes.

Review-controller tests verify that all labels stay selected until the user chooses, generation waits for Keep Both or Remove Duplicate, removal is reversible, counts and preview pagination recalculate, exports use the same selection, stale downloads are invalidated, and removing an original file keeps the surviving label. Filename markup is escaped. These tests exercise the actual controller with a DOM test double; they do not claim interactive testing in an attached browser.

Duplicate review uses a compact right-side orange Duplicate badge with Remove / Keep directly beneath it. The original file/page is available in the badge tooltip; marketplace and order ID remain below the filename. Keep retains the label and clears the pending controls. Remove hides the duplicate entry immediately; an entirely excluded PDF disappears from the visible list and file count, while a multi-page PDF keeps its unrelated selected pages and updates its selected-label count. A compact live summary precedes the file list. Responsive styles wrap filenames and keep controls on the right with mobile touch targets. UI tests cover hidden removed cards, dismissed kept warnings, three independent duplicate-page decisions inside a mixed multi-page upload, exported unique identifiers, and an original/duplicate pair inside the same PDF. Detection and PDF embedding are unchanged.

The existing 18 engine regression tests continue to pass, including exact Amazon ICC/font resource preservation, unchanged source stream bytes, 4-up placement, A4 dimensions, aspect ratios, rotation, upload/page order, partial sheets and the established Flipkart label-only crop. The duplicate feature changes only which source pages enter that engine; it does not rasterize or re-encode their barcode/QR content.

The local preview's deployed duplicate module was also exercised using the bundled PDF.js module and worker against the real Meesho fixture. The page, app, engine, duplicate module, stylesheet and worker return HTTP 200 from localhost:4173.

## Deliberate limits

### Restored individual A4 downloads

Git commit cc27487 contains the prior A4 page picker and selectedSheets export option in root shipping-label-4in1/app.js and core.js, while its src copies lack them. Current development uses src and synchronizes it into root/dist, so that root-only functionality was lost during synchronization. The picker and selectedSheets capability are restored in canonical source rather than changing detection or grouping.

Download PDF still downloads all A4 sheets together. The restored individual-page selector offers Page 1 through Page N with a separate Download Page button and the historical Shipping-Labels-4-in-1-Page-N.pdf filename. Each page is generated from the same saved selected-file and courier-order snapshot as the combined result. Changing selection/order invalidates both download modes and revokes individual blob URLs. Individual pages reuse the existing vector embedding and exact 4-up slot coordinates; they are not screenshots or rearranged input labels.

The 18-label regression starts with 19 input labels, explicitly removes one duplicate, and verifies five combined A4 pages plus five separate single-page PDFs. Every individual PDF matches its combined counterpart's page size, extracted label text and text transforms, with four labels on the first four pages and two labels on the last. Courier ordering remains identical and stale downloads are disabled after an order change. Browser download handlers are exercised through the DOM test double, including href and download filenames. No attached browser was available (empty browser inventory), so an interactive browser download is not claimed.

### Exact cropped Flipkart upload regression

The supplied shipping-label-cropped (1).pdf is SHA-256 identical to the stored fixture (D12D22A76A4D4B2CD267CCC5C29C14F1022AC1DCE99D3F1483EBB03BD1C0A22C). The previous reader from HEAD reproduces NO_PAGES on these exact bytes because the page dictionaries are in compressed object streams. The working reader's object-stream support finds one page. This failure occurs in getPageCount before duplicate analysis or page selection, not because a duplicate rule hides a unique label.

The localhost reader already contains the object-stream repair. App and reader module URLs now carry a tool-specific revision to request the corrected module graph on reload. This does not prove which module version was loaded in the user's existing tab; the screenshot is consistent with the reproduced older-reader error.

Two additional controller regressions load the exact fixture: one verifies its order/AWB, preview PDF, export/download target and compact duplicate Remove/Keep controls; the other deliberately fails identifier extraction and verifies that the unique page remains selected, receives a manual-review notice and still previews/exports. The actual preview/export PDF blobs are decoded and raster-rendered in memory with PDF.js/canvas to check the tracking text and visible first-slot content. This is automated PDF rendering and controller testing, not a claim of inspecting an attached personal browser tab. No label is rasterized in the production output pipeline.

The supplied Amazon invoice is saved unchanged in tests/fixtures/shipping-labels/amazon-real/001_invoice.pdf, with its SHA-256 verified against the explicitly supplied desktop path. It contains an Order Number and Invoice Number, but no AWB/tracking or shipment identifier. It is an invoice reference, not a verified shipping-label duplicate fixture. No matching rules are changed to treat the order or invoice as a shipment. The desktop original is untouched.

- Scanned/image-only labels or text with no usable mapping require OCR/barcode decoding, which this feature does not perform. They stay selected and receive a manual-review notice.
- Amazon packing slips/invoices containing only an order ID, including the two supplied Amazon reference PDFs, are recognized as Amazon but are not treated as shipment duplicates. An order can contain separate shipments.
- Flipkart order-only labels also stay selected. Matching requires an AWB/tracking number or shipment ID.
- A Meesho sub-order can be used when both copies lack stronger shipment identifiers. Different known AWB/shipment values always keep labels separate.
- Conflicting/multiple shipment identifiers on one page are not guessed. Already imposed multi-label pages are not split into individual labels; as before, one input page is one tool label.
- Missing or failed text extraction never removes a page or blocks the existing PDF export; it produces a manual-review notice.

Only the shipping-label source, its two local generated copies and these focused tests/documentation are updated. The pre-existing staged .gitignore and serve.js changes remain untouched. No full-site rebuild is performed.
