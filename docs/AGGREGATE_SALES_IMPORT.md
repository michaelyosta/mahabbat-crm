# Aggregate sales import contract

Status: contract agreed; bounded synthetic API slice, the private workbook
adapter and a native Dashboard over the separate aggregate and operational
sources are implemented and verified on both pinned proof environments. The
next product slice is minimal navigation polish.

## Source

The private April-June 2026 workbook is a monthly aggregate report for
`Склад(ы): Бар`. It contains three monthly sheets, report metadata in rows 1-3,
headers in row 4, and aggregate product lines from row 5 onward. It is not a
receipt or order export.

The importer must exclude report total rows whose item label starts with
`Итого:`. It must not create operational `Order` or `OrderItem` records from
this workbook.

## Raw line fields

Each imported line preserves the source item name and stores:

- period start/end;
- source and warehouse/subdivision;
- raw item name and optional raw category/concept;
- average price before discount and average price;
- quantity as a decimal value;
- revenue before discount and revenue;
- gross profit, markup percent and gross profit before VAT;
- revenue-share percent;
- source line identity and import status.

Money is stored as integer minor/micro-units in KZT. Percentages and quantities
use a decimal representation with an explicit scale; quantity is not integer-only.
Rows with positive quantity and zero revenue are valid and retained.

## Identity and retry policy

The report identity is `source + periodStart + periodEnd + warehouse`. A line
identity is that report identity plus a canonical raw-name identity and a
deterministic occurrence ordinal for repeated identical names. Canonical name
identity trims outer whitespace, collapses repeated whitespace and lowercases
for comparison only; the source field retains spelling and internal whitespace
after Unicode NFKC normalization.

The import upserts the same snapshot/line identity. Re-running the same file
must update the existing aggregate line, never add its quantity or revenue a
second time. A changed report for the same period follows the same line
identity and updates only source-owned aggregate values.

If two names are merely similar, they remain separate lines. A possible
`MenuItem` match is an explicit candidate/unmatched status, never an automatic
fuzzy merge. A stable source-file fingerprint may be stored as audit metadata,
but it is not the only identity key.

## Privacy and fixture policy

The original workbook is private client data and stays outside Git. Tests use a
small synthetic fixture with the same headers and edge cases: decimal quantity,
positive quantity with zero revenue, whitespace/name variants, and an `Итого:`
row.

## Bounded first implementation

The first App object is a flat, API-only `SalesSnapshotLine`. It is deliberately
not an `Order` or `OrderItem`, and it does not introduce a generic import
framework. The server-controlled `externalIdentityKey` field is unique; the
key contains provider, report identity, period, warehouse, item identity and
source row so repeated deliveries converge without summing values twice.

`quantity` is kept as a decimal string in the pure import contract and sent as
a JSON number only at the Twenty v2.29 REST transport boundary because the
`NUMBER/FLOAT` field rejects numeric strings. Financial values are converted to
KZT Currency micro-units before transport. The object and all imported fields
are read-only in the generic UI; matching remains `UNMATCHED` until an explicit
future MenuItem review.

The synthetic smoke covers three lines, including a fractional zero-revenue
line and near-duplicate raw names. It repeats the import and runs concurrent
retries on both `:2020` and `:3000`; each target converges to three unique lines
and leaves operational Order counts unchanged. The private April-June workbook
adapter then loaded 382 source lines from three monthly sheets, skipped all
`Итого:` rows, preserved nine zero-revenue lines and five fractional quantities,
and reran with `created=0`, `updated=0`, `conflicts=0` on both targets.
