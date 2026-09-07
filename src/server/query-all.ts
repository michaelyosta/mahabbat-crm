import type { CoreApiClientLike } from 'src/logic-functions/apply-loyalty-adjustment-request.logic-function';

type Page<T> = { edges?: Array<{ node?: T | null } | null>; pageInfo?: { hasNextPage?: boolean; endCursor?: string | null } | null };

// `first` is a page size, never a business-data limit. A broken cursor must
// fail the operation instead of returning a plausible but incomplete total.
export const queryAll = async <T>(
  client: CoreApiClientLike, root: string, args: Record<string, unknown>, fields: Record<string, unknown>,
): Promise<T[]> => {
  const rows: T[] = [];
  const seen = new Set<string>();
  let after = args.after;
  if (typeof after === 'string') seen.add(after);
  for (;;) {
    const result = await client.query({ [root]: {
      __args: { first: 100, ...args, ...(after ? { after } : {}) },
      edges: { node: fields }, pageInfo: { hasNextPage: true, endCursor: true },
    } }) as Record<string, Page<T> | undefined>;
    const page = result[root];
    if (!page) throw new Error(`MISSING_CONNECTION:${root}`);
    for (const edge of page.edges ?? []) if (edge?.node) rows.push(edge.node);
    if (!page.pageInfo?.hasNextPage) return rows;
    const next = page.pageInfo.endCursor;
    if (!next || seen.has(next)) throw new Error(`INVALID_PAGINATION_CURSOR:${root}`);
    seen.add(next);
    after = next;
  }
};
