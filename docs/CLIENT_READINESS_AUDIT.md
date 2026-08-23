# Mahabbat Client Readiness — first product audit

Date: 2026-08-22  
Baseline: `9e1b5e700c9d12b86d1984e65b28efdb1d5affc5`  
Branch: `polish/client-review-v1`

This is the pre-implementation audit. It records what a restaurant owner or
employee sees before any presentation cleanup in this cycle.

## Evidence reviewed

- Public standalone POS login at 1920×1080 and 1366×768.
- Existing live ADMIN POS screen supplied during external review.
- Current production workspace master data read without mutation.
- Public CRM/Twenty welcome screen at 1920×1080.
- POS, CRM-facing and Inventory presentation source.

The authenticated CRM and Inventory browser screens still require the owner's
Twenty login. Their current source was inspected, but final visual acceptance
must be repeated in the authenticated public browser before this cycle can pass.

## Findings

| Priority | Screen | Problem | Evidence | Product impact | Bounded change |
| --- | --- | --- | --- | --- | --- |
| P0 | POS zones, tables, menu | Automated acceptance data is shown in the normal restaurant UI. | The live workspace contains 20+ `INV-* POS zone` records, `POS Acceptance`, `INV-*` tables, dozens of `Missing Recipe` / `Inventory Acceptance` dishes and technical 1 ₸ items. The supplied ADMIN screenshot shows them as the first operational content. | The first screen looks corrupted and untrustworthy; real zones and menu are hard to find. | Hide only records with proven synthetic markers in presentation. Keep records and automated API acceptance intact. |
| P1 | POS review data | Seeded operational data is plausible but inconsistent: `T1…T12`, four competing hall concepts and only 17 menu items. | Current deterministic POS seed and live workspace records. | A reviewer has to translate developer-shaped identifiers instead of recognizing the restaurant. | Reconcile only deterministic seed IDs to three clear zones, human table names and a compact 20–40 item menu. Preserve the separate acceptance zone and its records. |
| P1 | POS first screen | Synthetic zones dominate the narrow left rail and make long wrapped navigation cards with a scrollbar. | Live ADMIN screenshot. | Zone selection becomes a developer feed rather than a three-choice restaurant action. | Once synthetic records are hidden, keep the rail compact and strengthen selected-state hierarchy. |
| P1 | POS 1366×768 | The three-column shell is structurally sound, but the middle workspace is compressed by a 390 px order panel while long fixture labels force wrapping and competing scrollbars. | Responsive CSS plus live ADMIN screenshot. | Menu scan speed and table selection suffer at the required pilot viewport. | Preserve three panels; tune widths, density and overflow after clean data is visible. Keep totals/actions fixed. |
| P1 | POS menu | Technical items and categories destroy otherwise stable card typography and price placement. | Live screenshot and `_posMenuItem` records. | Staff cannot scan by familiar food category. | Filter proven fixture markers and seed realistic Russian categories/items. |
| P2 | POS header | `restaurant POS` is accidental English in an otherwise Russian operational interface. | Current header source. | Small but visible prototype signal. | Replace with concise Russian copy. |
| P2 | POS login | Login is visually clean and touch targets pass, but “PIN хранится только на сервере” is implementation reassurance rather than operational guidance. | Public login screenshots at both required viewports. | Adds technical language without helping a staff member enter the system. | Replace with a short employee-facing hint; keep security semantics unchanged. |
| P2 | POS table labels | UI always prefixes `Стол`, so a named VIP table would render as “Стол VIP 1”. | Current `TableBoard` source. | Awkward real-world naming. | Prefer the optional human table `name`; fall back to `Стол {number}`. |
| P2 | POS empty/order panels | Right panel is stable and primary actions remain anchored, but supporting text can be shortened at 768 px height. | Current source/CSS. | Minor cognitive load and vertical pressure. | Tighten helper copy only; no workflow or domain change. |
| P2 | CRM welcome | The standard Twenty login is a very small card in a large empty 1920 px canvas. | Public CRM welcome screenshot. | Visually generic, but it is outside Mahabbat App presentation ownership. | Do not patch Twenty core. Accept as shell limitation and review Mahabbat pages after owner login. |
| P3 | Inventory | Current source already filters technical fixture prefixes, translates enums, uses unit-aware labels and presents revision as physical count. | Inventory presentation source. | No new Inventory redesign is justified. | Regression-only review after POS seed/presentation changes. |

## What is already working

- POS login card has a clear first action and practical 60 px number targets.
- The three-panel operational model is appropriate for the pilot.
- Table state colors are functional rather than decorative.
- Menu price placement and order footer are stable.
- Right-panel totals and primary actions do not depend on document scrolling.
- Inventory copy already follows the physical-count mental model and hides its
  internal ledger terminology.

## Implementation boundary

This cycle may change only presentation filtering, deterministic review seed
data, Russian copy, responsive density and related tests/docs. It must not alter
shift, ownership, kitchen, precheck, payment, void, Inventory ledger or revision
semantics.

One bounded auth-policy exception was added after direct owner feedback and a
live reproduction. The previous fixed 15-minute POS session expired during an
active kitchen workflow. The replacement is a server-authoritative sliding idle
lock: authenticated commands and throttled real pointer/keyboard activity
restart the configured inactivity window; background polling does not. Logout,
revocation, inactive staff and role boundaries are unchanged.

## Second visual critique

The first cleanup pass removed the dominant prototype signals but exposed two
additional presentation issues at 1366×768:

- REST response order produced `Стол 5, 3, 4, 1, 2, 6` and an arbitrary menu
  category sequence. Navigation is now deterministically ordered for restaurant
  use: `Основной зал, VIP, Летняя терраса`, natural table numbers and the menu
  sequence `Шашлыки, Горячее, Салаты, Супы, Закуски, Напитки, Десерты,
  Выпечка`.
- The category strip showed a heavy native horizontal scrollbar beside an
  empty red stop-list action. The strip remains independently touch-scrollable,
  but the native scrollbar is hidden and the stop-list uses warning color only
  when it actually contains unavailable dishes.

The resulting human POS contains three short zones, eleven named review tables,
30 realistic Russian menu items with plausible tenge prices, stable order
totals/actions and no acceptance labels in normal presentation. Acceptance
fixtures remain intact and addressable by the automated harness.

## Verification completed in this cycle

- Public/self-hosted POS domain acceptance: 78/78 after the idle-lock change.
- Runtime API parity: `inventoryStockLocations=present`.
- Sliding idle smoke: background REST read changed expiry = false; explicit
  activity extended expiry; logout revoked the same session.
- Review identity login stability: 10/10 sequential ADMIN/WAITER logins.
- Static: typecheck PASS, lint PASS, unit 273/273 PASS, gateway 7/7 PASS.

Authenticated browser screenshots and the owner-facing CRM page remain the
final human visual gate; no Twenty core patch is permitted for the generic
welcome shell.

## Follow-up P1: table card amount overlap

On 2026-08-23 the public POS showed the order amount positioned over the
assigned waiter line in a narrow table card, for example `Администратор 2`
and `9 200 ₸`. The cause was `.mah-pos-table-total` using absolute bottom
positioning while the card also rendered a variable-height owner/reservation
meta line.

The bounded fix keeps the card as a vertical flex layout and renders the
amount as its own bottom row. The card name, state, waiter/reservation meta and
amount now occupy non-overlapping flow positions at the public 1366×768
viewport. No order, ownership or pricing behavior changed.

Live browser evidence after the fresh bundle deployment:

- `Стол 3` shows `Другой официант`, `Администратор 2`, and `9 200 ₸` on
  separate lines.
- DOM geometry confirms the meta line ends exactly where the amount row
  begins; no rectangles overlap.
- The rest of the review dataset remains human-readable: `Основной зал`,
  `VIP`, `Летняя терраса`, natural table names and Russian menu items.

## Terminal hardening pass: 1024×768

The restaurant's actual monitors use 1024×768, so this is now the primary POS
presentation viewport. The same three-panel workflow is preserved; no POS
domain or permission rule changed.

The bounded hardening pass adds:

- a 1024×768 layout with a compact zone rail, a 320 px stable order panel and
  a three-column, two-row table grid;
- fully visible totals and primary order actions without document scrolling;
- 48 px operational controls and quantity buttons;
- a dedicated stop-list action beside search, leaving the category strip its
  own touch-scrollable row without overlap;
- a searchable, category-filtered stop-list with confirmation before removing
  an available dish from the menu;
- a booking form with no arbitrary preselected table, explicit occupied-table
  labels and a clear requirement for time plus guest contact;
- an explicit closed-shift explanation while preserving access to previously
  open orders;
- readable 11–12 px secondary operational text and reduced decorative borders;
- guest tabs that fit three guests plus `+ Гость` at 1024 px.

Browser geometry at 1024×768 confirms `scrollWidth === clientWidth` and
`scrollHeight === clientHeight`; the table grid has no internal overflow, all
three guest tabs plus the add action fit, and the order footer remains pinned.
The 1366×768 and 1920×1080 layouts also retain zero document overflow.
