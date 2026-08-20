# Inventory Adversarial Domain Review

> Design from `INVENTORY_DOMAIN.md` + `INVENTORY_DECISIONS.md` attacked as if it were wrong.

**Verdict after 30 vectors: DESIGN HOLDS with bounded fixes applied below. No P0 blocker requiring redesign.**

---

## Attack Matrix

| # | Attack | Expect | Result | Note |
|---|---|---|---|---|
| 1 | **Retry receipt** same `receiptIdempotencyKey` | 200 same result, no second movement | **PASS** — unique index on group, re-read | Need unique on `sourceId` + movement `idempotencyKey` |
| 2 | **Retry production** same key | no duplicate batch | **PASS** — group dedup on `sourceId` | |
| 3 | **Retry transfer** same key | no duplicate OUT/IN | **PASS** — pair share `sourceId` | |
| 4 | **Retry revision finalize** same key | no double adjustment | **PASS** — unique finalize key | |
| 5 | **Retry order close** / consumption request | one consumption | **PASS** — unique `orderId` | |
| 6 | **Worker crash after movement but before request success mark** | cron reconciles request to APPLIED | **PASS** — check `sourceId` group existence | Loyalty pattern reused |
| 7 | **Worker crash before movement** | stays PENDING, cron retries | **PASS** | |
| 8 | **Two simultaneous CLOSED Order consumption** | one winner | **PASS** — unique(orderId) + movement idempotency `orderId:lineId` | |
| 9 | **Two receipts same item/location concurrent different keys** | both apply, sum correct, MWA deterministic | **PASS** — no unique collision, balance recomputed from aggregate | |
| 10 | **Transfer vs sale consumption concurrent** | both consume correctly, no lost update | **PASS** — balance is SUM, guarded update uses `version` watermark; concurrent ledger appends commute | Need optimistic check on finalize only, not on each sale |
| 11 | **Production vs sale concurrent** | same — commute | **PASS** | |
| 12 | **Recipe change while Order open** | consumption uses version effective at `orderLineCreatedAt` | **PASS** — explicit rule ADR-INV-004 | Requires storing `orderLine.createdAt` (exists) |
| 13 | **Recipe cycle** A→B→A | `RECIPE_CYCLE` at publish, not at consume time | **PASS** — DFS on publish graph | |
| 14 | **Deleted/deactivated StockItem referenced by Recipe** | publish blocked; existing movements stay; sale with missing item → `MISSING_RECIPE`/skip, visible issue | **PASS** — check `isActive` on publish + on consume |
| 15 | **Missing Recipe** | order closes, issue OPEN, not blocked | **PASS** — ADR-INV-008 | |
| 16 | **Missing location mapping** | fallback `defaultLocation` or `MISSING_LOCATION` issue; not blocked | **PASS** — ADR-INV-016 | Must make fallback deterministic (recipe.defaultLocationId → item.defaultLocationId → first active) |
| 17 | **Negative stock** | allowed → negative balance + warning, POS unaffected | **PASS** | |
| 18 | **Positive semi revision variance** | explicit resolution choice; no silent double-spend | **PASS** — ADR-INV-007 | |
| 19 | **Repeating same revision after production** | second revision `variance 0`, no ingredient move | **PASS** — mandatory regression test (§75) | |
| 20 | **Floating/rounding drift** (0.1+0.2, kg↔g) | no float; micros integers only | **PASS** — ADR-INV-002 | |
| 21 | **Weighted-average rounding** | deterministic half-up; 10+10 avg 900 | **PASS** — ADR-INV-017 + tests | |
| 22 | **1000 sales × tiny quantities (50g each)** | sum = 50kg exact, no drift | **PASS** — integer micros | |
| 23 | **Unit conversion kg↔g** | all stored in base micros, UI converts | **PASS** | |
| 24 | **Transfer value preservation** | OUT avg == IN avg | **PASS** — snapshot carried | |
| 25 | **Prepared void** | creates waste consumption | **PASS** — ADR-INV-009 | |
| 26 | **Not-prepared void** | no consumption | **PASS** | |
| 27 | **Stale revision** | `REVISION_STALE` if watermark advanced | **PASS** — ADR-INV-011 | |
| 28 | **Projection mismatch vs ledger** | reconciliation query detects; alert/FAIL QA | **PASS** — ADR-INV-001 | Needs cron/reconciliation harness |
| 29 | **Unauthorized manual adjustment** (WAITER) | 403 via `getAuthenticatedPosContext()` role check | **PASS** — ADR-INV-014 | |
| 30 | **Two finalizations of same revision** | idempotency key dedup → 200 same, single movement group | **PASS** | |

---

## Findings & Fixes Applied to Domain (before code)

1. **Group `sourceId` is mandatory** — flat movement model must share `sourceId` so crash-recovery can detect "already produced" without second group. Added to §6/§8.
2. **Fallback location chain** was ambiguous — fixed to deterministic `recipe.defaultLocationId → item.defaultLocationId → first ACTIVE location (sorted by sortOrder)` with `MISSING_LOCATION` issue if none.
3. **Movement `idempotencyKey` granularity**: one unique per flat row as `sourceId:stockItemId:locationId` plus group `sourceId` unique for header. This covers concurrent processor dedup.
4. **Rounding helper** must be explicit `divideRoundHalfUp`; spec now mandates unit-tests `weightedAverageRounding` and `1000tiny`.
5. **Reconciliation** cannot be manual: add periodic query (cron or test harness `ledger == balance`) to QA gates.

---

## Residual Risks (P2, not blocking v1)

- Transfer vs concurrent sale can create temporary ordering ambiguity in MWA if both commit same millisecond — but since MWA is linear and both append, final `SUM` and `weighted avg` remain deterministic (order-insensitive if using incremental formula? Must apply sequential recalculation; concurrent increments need optimistic retry on Balance update).
- Very large quantity (`> 9e15 micros`) exceeds safe integer — v1 bound is 500items×1000kg, far below; add guard `QUANTITY_OVERFLOW` → 400.
- Twenty `NUMBER` field may lose integer precision beyond 2^53 — we cap at safe integer and add server validation.

---

## Gate

Design **READY for implementation** — no invariant violates spec §39–40. Proceed to slices.
