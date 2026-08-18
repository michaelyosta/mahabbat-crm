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
): Promise<LoyaltyLedgerEntry[]> => {
  const entries: LoyaltyLedgerEntry[] = [];
  let after: string | null = null;

  for (let page = 0; page < MAX_LOYALTY_BALANCE_PAGES; page += 1) {
    const result = await fetchPage(after);
    entries.push(...result.nodes);

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