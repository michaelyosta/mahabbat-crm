import { describe, expect, it } from 'vitest';

import {
  LOYALTY_BALANCE_PAGE_SIZE,
  computeLoyaltyBalance,
  fetchAllLoyaltyLedgerEntries,
  loyaltyLedgerNodes,
  type LoyaltyLedgerConnectionPage,
  type LoyaltyLedgerEntry,
  type LoyaltyLedgerPageFetcher,
} from 'src/utils/loyalty-balance.util';

const entry = (id: string, amount: number | null): LoyaltyLedgerEntry => ({
  id,
  amount,
});

describe('computeLoyaltyBalance', () => {
  it('returns 0 for an empty ledger', () => {
    expect(computeLoyaltyBalance([])).toBe(0);
  });

  it('sums a single positive adjustment', () => {
    expect(computeLoyaltyBalance([entry('a', 17)])).toBe(17);
  });

  it('sums a single negative redemption', () => {
    expect(computeLoyaltyBalance([entry('a', -500)])).toBe(-500);
  });

  it('keeps the signed total for mixed adjustments', () => {
    expect(
      computeLoyaltyBalance([entry('a', 100), entry('b', -40), entry('c', 7)]),
    ).toBe(67);
  });

  it('ignores null and non-integer amounts', () => {
    expect(
      computeLoyaltyBalance([
        entry('a', null),
        entry('b', 3.5),
        entry('c', 2),
      ]),
    ).toBe(2);
  });

  it('never truncates: sums more than one page worth of entries', () => {
    const entries = Array.from({ length: 250 }, (_, index) =>
      entry(`e${index}`, 1),
    );
    expect(computeLoyaltyBalance(entries)).toBe(250);
  });
});

const paginated = (
  pages: Array<{ nodes: LoyaltyLedgerEntry[]; hasNextPage: boolean }>,
): LoyaltyLedgerPageFetcher => {
  const fetchPage: LoyaltyLedgerPageFetcher = async (after) => {
    const pageIndex = after === null ? 0 : Number(after);
    const page = pages[pageIndex];
    return {
      nodes: page.nodes,
      hasNextPage: page.hasNextPage,
      endCursor: page.hasNextPage ? String(pageIndex + 1) : null,
    };
  };
  return fetchPage;
};

describe('fetchAllLoyaltyLedgerEntries', () => {
  it('returns an empty list for a single empty page', async () => {
    const entries = await fetchAllLoyaltyLedgerEntries(
      paginated([{ nodes: [], hasNextPage: false }]),
    );
    expect(entries).toEqual([]);
  });

  it('returns a single-entry ledger from one page', async () => {
    const entries = await fetchAllLoyaltyLedgerEntries(
      paginated([{ nodes: [entry('a', 10)], hasNextPage: false }]),
    );
    expect(entries).toHaveLength(1);
  });

  it('walks past a full 100-entry page using the cursor', async () => {
    const firstPage = Array.from({ length: LOYALTY_BALANCE_PAGE_SIZE }, (_, i) =>
      entry(`p0-${i}`, 1),
    );
    const entries = await fetchAllLoyaltyLedgerEntries(
      paginated([
        { nodes: firstPage, hasNextPage: true },
        { nodes: [entry('p1-0', 5)], hasNextPage: false },
      ]),
    );
    expect(entries).toHaveLength(LOYALTY_BALANCE_PAGE_SIZE + 1);
    expect(entries[LOYALTY_BALANCE_PAGE_SIZE]).toEqual({
      id: 'p1-0',
      amount: 5,
    });
  });

  it('traverses many pages, not just the first 100 records', async () => {
    const pageCount = 5;
    const pages = Array.from({ length: pageCount }, (_, index) => ({
      nodes: Array.from({ length: LOYALTY_BALANCE_PAGE_SIZE }, (_, j) =>
        entry(`p${index}-${j}`, index + j),
      ),
      hasNextPage: index < pageCount - 1,
    }));
    const entries = await fetchAllLoyaltyLedgerEntries(paginated(pages));
    expect(entries).toHaveLength(pageCount * LOYALTY_BALANCE_PAGE_SIZE);
    expect(computeLoyaltyBalance(entries)).toBeGreaterThan(0);
  });

  it('throws when the cursor never advances', async () => {
    const fetchPage: LoyaltyLedgerPageFetcher = async () => ({
      nodes: [entry('a', 1)],
      hasNextPage: true,
      endCursor: 'fixed-cursor',
    });
    await expect(fetchAllLoyaltyLedgerEntries(fetchPage)).rejects.toThrow(
      /exceeded/i,
    );
  });

  it('throws when hasNextPage is true without a cursor', async () => {
    const fetchPage: LoyaltyLedgerPageFetcher = async () => ({
      nodes: [],
      hasNextPage: true,
      endCursor: null,
    });
    await expect(fetchAllLoyaltyLedgerEntries(fetchPage)).rejects.toThrow(
      /cursor is missing/i,
    );
  });
});

describe('loyaltyLedgerNodes', () => {
  it('extracts nodes and skips null edges and nodes', () => {
    const connection: LoyaltyLedgerConnectionPage = {
      edges: [
        { node: entry('a', 1) },
        null,
        { node: null },
        { node: entry('b', -2) },
      ],
    };
    expect(loyaltyLedgerNodes(connection)).toEqual([
      { id: 'a', amount: 1 },
      { id: 'b', amount: -2 },
    ]);
  });

  it('returns an empty list for null or empty connections', () => {
    expect(loyaltyLedgerNodes(null)).toEqual([]);
    expect(loyaltyLedgerNodes(undefined)).toEqual([]);
    expect(loyaltyLedgerNodes({})).toEqual([]);
  });
});