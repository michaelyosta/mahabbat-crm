import { describe, expect, it } from 'vitest';
import { queryAll } from 'src/server/query-all';

describe('complete connection reads', () => {
  it('follows server cursors even when a server returns smaller pages', async () => {
    const rows = Array.from({ length: 503 }, (_, id) => ({ id }));
    let calls = 0;
    const client = { mutation: async () => ({}), query: async (doc: any) => {
      calls += 1; const start = Number(doc.rows.__args.after ?? 0); const end = Math.min(start + 37, rows.length);
      return { rows: { edges: rows.slice(start, end).map(node => ({ node })), pageInfo: { hasNextPage: end < rows.length, endCursor: String(end) } } };
    } };
    expect(await queryAll(client, 'rows', { first: 500 }, { id: true })).toEqual(rows);
    expect(calls).toBe(14);
  });
  it('rejects a missing or repeating cursor instead of returning partial results', async () => {
    for (const cursor of [null, 'same']) {
      const client = { mutation: async () => ({}), query: async () => ({ rows: { edges: [], pageInfo: { hasNextPage: true, endCursor: cursor } } }) };
      await expect(queryAll(client, 'rows', {}, { id: true })).rejects.toThrow('INVALID_PAGINATION_CURSOR');
    }
  });
});
