export type LoyaltyLedgerEntry = {
  id: string;
  entryType?: string | null;
  amount?: number | null;
  occurredAt?: string | null;
  reason?: string | null;
};

export type LoyaltyLedgerConnectionPage = {
  edges?: Array<{ node?: LoyaltyLedgerEntry | null } | null> | null;
  pageInfo?: { hasNextPage?: boolean; endCursor?: string | null } | null;
};

export type LoyaltyLedgerPageFetcher = (
  after: string | null,
) => Promise<{
  nodes: LoyaltyLedgerEntry[];
  hasNextPage: boolean;
  endCursor: string | null;
}>;

// Deterministic ledger order: occurredAt, then id. Both the balance export
// and the UI sort on this key so a re-read never reshuffles equal timestamps.
export const LOYALTY_LEDGER_ORDER_BY = [
  { occurredAt: 'AscNullsLast' },
  { id: 'AscNullsLast' },
] as const;

export type LoyaltyLedgerProgress = {
  pages: number;
  entries: number;
  done: boolean;
};

export const LOYALTY_BALANCE_PAGE_SIZE = 100;
export const MAX_LOYALTY_BALANCE_PAGES = 10_000;
export const loyaltyLedgerNodes = (
  connection?: LoyaltyLedgerConnectionPage | null,
): LoyaltyLedgerEntry[] =>
  (connection?.edges ?? []).flatMap((edge) => (edge?.node ? [edge.node] : []));

// The balance is derived from the append-only ledger, never stored as a field.
// Summing a truncated first page would silently report the wrong balance.
export const computeLoyaltyBalance = (entries: LoyaltyLedgerEntry[]): number =>
  entries.reduce(
    (sum, entry) =>
      sum + (Number.isInteger(entry.amount) ? (entry.amount ?? 0) : 0),
    0,
  );

// Fetches every ledger page so the derived balance is never truncated to the
// first 100 entries.
export const fetchAllLoyaltyLedgerEntries = async (
  fetchPage: LoyaltyLedgerPageFetcher,
  onProgress?: (progress: LoyaltyLedgerProgress) => void,
): Promise<LoyaltyLedgerEntry[]> => {
  const entries: LoyaltyLedgerEntry[] = [];
  let after: string | null = null;

  for (let page = 0; page < MAX_LOYALTY_BALANCE_PAGES; page += 1) {
    const result = await fetchPage(after);
    entries.push(...result.nodes);
    onProgress?.({ pages: page + 1, entries: entries.length, done: !result.hasNextPage });

    if (!result.hasNextPage) return entries;
    if (!result.endCursor) {
      throw new Error('Ledger pagination cursor is missing.');
    }
    after = result.endCursor;
  }

  throw new Error(
    `Ledger pagination exceeded ${MAX_LOYALTY_BALANCE_PAGES} pages.`,
  );
};

// UI-scale export: same deterministic order, but capped so a 10k-row ledger
// never hangs the card. The caller shows the cap text when truncated.
export const LOYALTY_BALANCE_UI_LIMIT = 200;

export const takeLoyaltyLedgerUiSlice = (
  entries: LoyaltyLedgerEntry[],
  limit = LOYALTY_BALANCE_UI_LIMIT,
): { visible: LoyaltyLedgerEntry[]; truncated: boolean; total: number } => ({
  visible: entries.slice(0, limit),
  truncated: entries.length > limit,
  total: entries.length,
});