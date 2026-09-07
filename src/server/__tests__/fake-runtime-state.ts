import type { RuntimeState } from 'src/server/runtime-state';

// Shared by clients to model separate resolver processes using one database.
export class FakeRuntimeState {
  rows: RuntimeState[] = [];
  query(operation: Record<string, any>) {
    const args = operation.__args;
    return { mahabbatRuntimeStates: { edges: this.rows.filter(r => r.stateKey === args.filter.stateKey.eq).map(r => ({ node: { ...r } })) } };
  }
  mutation(root: string, operation: Record<string, any>) {
    const args = operation.__args;
    if (root === 'createMahabbatRuntimeState') {
      if (this.rows.some(r => r.stateKey === args.data.stateKey)) throw new Error('unique state key');
      const row = { id: `state-${this.rows.length}`, ...args.data } as RuntimeState;
      this.rows.push(row);
      return { [root]: { ...row } };
    }
    const row = this.rows.find(r => r.id === args.filter.id.eq && r.version === args.filter.version.eq);
    if (!row) return { [root]: [] };
    Object.assign(row, args.data);
    return { [root]: [{ id: row.id }] };
  }
}
