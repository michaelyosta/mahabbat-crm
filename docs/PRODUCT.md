# Mahabbat CRM / Backoffice Foundation

Restaurant CRM for one Kazakhstan business. The current phase is the **Mahabbat
CRM Backoffice + POS Foundation**: customers, CRM orders and order items,
reservations and an append-only loyalty ledger, plus aggregate sales history, a
native Dashboard, bounded operational roles and the first server-side POS slice
(shifts, zones/tables, POS orders, guests, order lines and a separate
`PosStaff`/`PosSession` authentication context).

Not yet implemented: POS UI, kitchen printing, prechecks, payments,
fiscalisation, reservations/prepayments in the POS flow, voids/transfers,
operational audit, inventory, accounting, bulk messaging and production
deployment. These are **future slices, not permanent exclusions**; the current
POS boundary and sequence are in `docs/POS_DOMAIN.md` and `docs/ROADMAP.md`.

The controlled UI is Russian, desktop-first, ru-KZ and ₸. The foundation favours
working Twenty capabilities over branding or a bespoke framework. Distribution
is frozen at `NOT DISTRIBUTED` until an explicit product decision
(`docs/DISTRIBUTION_DECISION.md`).
