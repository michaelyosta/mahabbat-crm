import type { CoreApiClientLike } from 'src/logic-functions/apply-loyalty-adjustment-request.logic-function';

export type RuntimeState = { id: string; stateKey: string; value: string; version: number };
const fields = { id: true, stateKey: true, value: true, version: true };

export const readRuntimeState = async (
  client: CoreApiClientLike, stateKey: string, initial: unknown = {},
): Promise<RuntimeState> => {
  const read = async () => {
    const result = await client.query({ mahabbatRuntimeStates: {
      __args: { filter: { stateKey: { eq: stateKey } }, first: 1 }, edges: { node: fields },
    } }) as { mahabbatRuntimeStates?: { edges?: Array<{ node?: RuntimeState }> } };
    return result.mahabbatRuntimeStates?.edges?.[0]?.node;
  };
  const existing = await read();
  if (existing) return existing;
  try {
    const result = await client.mutation({ createMahabbatRuntimeState: {
      __args: { data: { stateKey, value: JSON.stringify(initial), version: 0 } }, ...fields,
    } }) as { createMahabbatRuntimeState?: RuntimeState };
    if (result.createMahabbatRuntimeState?.id) return result.createMahabbatRuntimeState;
  } catch {
    // A competing worker may have created the unique key.
  }
  const raced = await read();
  if (!raced) throw new Error('RUNTIME_STATE_UNAVAILABLE');
  return raced;
};

export const compareAndSetRuntimeState = async (
  client: CoreApiClientLike, state: RuntimeState, value: unknown,
): Promise<boolean> => {
  const result = await client.mutation({ updateMahabbatRuntimeStates: {
    __args: { filter: { id: { eq: state.id }, version: { eq: state.version } },
      data: { value: JSON.stringify(value), version: state.version + 1 } }, id: true,
  } }) as { updateMahabbatRuntimeStates?: Array<{ id?: string }> };
  return (result.updateMahabbatRuntimeStates?.length ?? 0) === 1;
};
