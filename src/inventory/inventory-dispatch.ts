import { queryAll } from 'src/server/query-all';
import { readRuntimeState } from 'src/server/runtime-state';
import { createHash } from 'node:crypto';

import type { CoreApiClientLike } from 'src/logic-functions/apply-loyalty-adjustment-request.logic-function';
import { scaledQuantityMicros } from 'src/inventory/inventory-units';
import { computeNewWeightedAverage, computeProductionUnitCost, quantityCostTotal } from 'src/inventory/inventory-costing';
import type { InventoryCommand } from 'src/inventory/inventory-command-input';

// simplified error
export type InventoryResult = { status: number; body: unknown };
const error = (code: string, message: string): InventoryResult => ({ status: 400, body: { code, message } });
const ok = (status: number, body: unknown): InventoryResult => ({ status, body });

type Existing = { id: string };

type LocationRecord = Existing & { name?: string | null; isActive?: boolean | null; sortOrder?: number | null };
type ItemRecord = Existing & { name?: string | null; itemType?: string | null; unitKind?: string | null; baseUnit?: string | null; isActive?: boolean | null; defaultLocationId?: string | null };
type BalanceRecord = Existing & { stockItemId?: string | null; locationId?: string | null; quantityMicros?: number | null; averageCostMicros?: number | null; totalValueMicros?: number | null; version?: number | null };
type MovementRecord = Existing & {
  movementType?: string | null; stockItemId?: string | null; locationId?: string | null; quantityDeltaMicros?: number | null; unitCostMicros?: number | null; totalCostMicros?: number | null;
  sourceType?: string | null; sourceId?: string | null; recipeVersionId?: string | null; orderId?: string | null; orderLineId?: string | null; reason?: string | null; actorStaffId?: string | null; occurredAt?: string | null; idempotencyKey?: string | null;
};
type RecipeRecord = Existing & { label?: string | null; targetKind?: string | null; targetId?: string | null; defaultLocationId?: string | null; isActive?: boolean | null };
type RecipeVersionRecord = Existing & { recipeId?: string | null; versionNumber?: number | null; yieldQuantityMicros?: number | null; effectiveFrom?: string | null; status?: string | null; createdByStaffId?: string | null; idempotencyKey?: string | null };
type RecipeLineRecord = Existing & { recipeVersionId?: string | null; stockItemId?: string | null; quantityMicros?: number | null; sortOrder?: number | null };
type ConsumptionRequestRecord = Existing & { orderId?: string | null; status?: string | null; idempotencyKey?: string | null; attemptCount?: number | null; lastError?: string | null; processedAt?: string | null };
type ConsumptionIssueRecord = Existing & { orderId?: string | null; orderLineId?: string | null; menuItemId?: string | null; issueType?: string | null; status?: string | null };
type CountRecord = Existing & { label?: string | null; locationId?: string | null; status?: string | null; ledgerWatermark?: string | null; createdByStaffId?: string | null; idempotencyKey?: string | null; startedAt?: string | null };
type CountLineRecord = Existing & { countId?: string | null; stockItemId?: string | null; expectedQuantityMicros?: number | null; actualQuantityMicros?: number | null; varianceMicros?: number | null; unitCostMicrosSnapshot?: number | null; resolution?: string | null; producedRecipeVersionId?: string | null };

type RevisionActualInput = {
  stockItemId: string;
  actualQuantityMicros: number | null;
  resolution?: string;
};

type PlannedMovement = Omit<MovementRecord, 'id'> & { id: string };

type RevisionPostingPlan = {
  countId: string;
  locationId: string;
  idempotencyKey: string;
  watermark: string;
  claimToken: string;
  lineUpdates: Array<{ id: string; data: Record<string, unknown> }>;
  lineCreates: Array<Record<string, unknown>>;
  movements: PlannedMovement[];
  affectedItemIds: string[];
};

const queryConnection = async <T extends Existing>(
  client: CoreApiClientLike, root: string, args: Record<string, unknown>, fields: Record<string, boolean | Record<string, boolean>>,
): Promise<T[]> => queryAll<T>(client, root, args, fields);

// === field selections (mirror object definitions; use minimal) ===
const LOC_FIELDS = { id: true, name: true, isActive: true, sortOrder: true };
const ITEM_FIELDS = { id: true, name: true, itemType: true, unitKind: true, baseUnit: true, isActive: true, defaultLocationId: true };
const BAL_FIELDS = { id: true, stockItemId: true, locationId: true, quantityMicros: true, averageCostMicros: true, totalValueMicros: true, version: true };
const MOV_FIELDS = { id: true, movementType: true, stockItemId: true, locationId: true, quantityDeltaMicros: true, unitCostMicros: true, totalCostMicros: true, sourceType: true, sourceId: true, recipeVersionId: true, orderId: true, orderLineId: true, reason: true, actorStaffId: true, occurredAt: true, idempotencyKey: true };
const RECIPE_FIELDS = { id: true, label: true, targetKind: true, targetId: true, defaultLocationId: true, isActive: true };
const RECIPE_VER_FIELDS = { id: true, recipeId: true, versionNumber: true, yieldQuantityMicros: true, effectiveFrom: true, status: true, createdByStaffId: true, idempotencyKey: true };
const RECIPE_LINE_FIELDS = { id: true, recipeVersionId: true, stockItemId: true, quantityMicros: true, sortOrder: true };
const CONSUMPTION_REQ_FIELDS = { id: true, orderId: true, status: true, idempotencyKey: true, attemptCount: true, lastError: true, processedAt: true };
const CONSUMPTION_ISSUE_FIELDS = { id: true, orderId: true, orderLineId: true, menuItemId: true, issueType: true, status: true };
const COUNT_FIELDS = { id: true, label: true, locationId: true, status: true, ledgerWatermark: true, createdByStaffId: true, idempotencyKey: true, startedAt: true };
const COUNT_LINE_FIELDS = { id: true, countId: true, stockItemId: true, expectedQuantityMicros: true, actualQuantityMicros: true, varianceMicros: true, unitCostMicrosSnapshot: true, resolution: true, producedRecipeVersionId: true };

// === find helpers ===
const findLocationById = async (c: CoreApiClientLike, id: string) => (await queryConnection<LocationRecord>(c, 'inventoryStockLocations', { filter: { id: { eq: id } }, first: 1 }, LOC_FIELDS))[0] ?? null;
const findItemById = async (c: CoreApiClientLike, id: string) => (await queryConnection<ItemRecord>(c, 'inventoryStockItems', { filter: { id: { eq: id } }, first: 1 }, ITEM_FIELDS))[0] ?? null;
const findBalance = async (c: CoreApiClientLike, itemId: string, locId: string) => (await queryConnection<BalanceRecord>(c, 'inventoryStockBalances', { filter: { stockItemId: { eq: itemId }, locationId: { eq: locId } }, first: 1 }, BAL_FIELDS))[0] ?? null;
const findBalancesByLocation = async (c: CoreApiClientLike, locId: string) => queryConnection<BalanceRecord>(c, 'inventoryStockBalances', { filter: { locationId: { eq: locId } }, first: 200 }, BAL_FIELDS);
const findMovementsBySource = async (c: CoreApiClientLike, sourceId: string) => queryConnection<MovementRecord>(c, 'inventoryStockMovements', { filter: { sourceId: { eq: sourceId } }, first: 200 }, MOV_FIELDS);
const findMovementByIdempotency = async (c: CoreApiClientLike, key: string) => (await queryConnection<MovementRecord>(c, 'inventoryStockMovements', { filter: { idempotencyKey: { eq: key } }, first: 1 }, MOV_FIELDS))[0] ?? null;
const findRecipeByTarget = async (c: CoreApiClientLike, kind: string, targetId: string) => (await queryConnection<RecipeRecord>(c, 'inventoryRecipes', { filter: { targetKind: { eq: kind }, targetId: { eq: targetId } }, first: 1 }, RECIPE_FIELDS))[0] ?? null;
const findRecipeVersions = async (c: CoreApiClientLike, recipeId: string) => queryConnection<RecipeVersionRecord>(c, 'inventoryRecipeVersions', { filter: { recipeId: { eq: recipeId } }, first: 100 }, RECIPE_VER_FIELDS);
const findRecipeVersionById = async (c: CoreApiClientLike, id: string) => (await queryConnection<RecipeVersionRecord>(c, 'inventoryRecipeVersions', { filter: { id: { eq: id } }, first: 1 }, RECIPE_VER_FIELDS))[0] ?? null;
const findRecipeLines = async (c: CoreApiClientLike, versionId: string) => queryConnection<RecipeLineRecord>(c, 'inventoryRecipeLines', { filter: { recipeVersionId: { eq: versionId } }, first: 100 }, RECIPE_LINE_FIELDS);
const findConsumptionByOrder = async (c: CoreApiClientLike, orderId: string) => (await queryConnection<ConsumptionRequestRecord>(c, 'inventoryConsumptionRequests', { filter: { orderId: { eq: orderId } }, first: 1 }, CONSUMPTION_REQ_FIELDS))[0] ?? null;
const findConsumptionIssue = async (c: CoreApiClientLike, orderId: string, orderLineId: string, issueType: string) => (await queryConnection<ConsumptionIssueRecord>(c, 'inventoryConsumptionIssues', { filter: { orderId: { eq: orderId }, orderLineId: { eq: orderLineId }, issueType: { eq: issueType } }, first: 1 }, CONSUMPTION_ISSUE_FIELDS))[0] ?? null;
const findCountById = async (c: CoreApiClientLike, id: string) => (await queryConnection<CountRecord>(c, 'inventoryCounts', { filter: { id: { eq: id } }, first: 1 }, COUNT_FIELDS))[0] ?? null;
const findCountLines = async (c: CoreApiClientLike, countId: string) => queryConnection<CountLineRecord>(c, 'inventoryCountLines', { filter: { countId: { eq: countId } }, first: 200 }, COUNT_LINE_FIELDS);

// === balance helpers ===
const mutationUpdatedRows = (result: unknown, root: string): number => {
  const value = (result as Record<string, unknown> | null)?.[root];
  if (Array.isArray(value)) return value.length;
  return value && typeof value === 'object' && 'id' in value ? 1 : 0;
};

const waitForBalanceRetry = async (attempt: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, Math.min(25, 2 ** attempt)));
};

const ensureBalance = async (c: CoreApiClientLike, itemId: string, locId: string): Promise<BalanceRecord> => {
  const existing = await findBalance(c, itemId, locId);
  if (existing) return existing;
  try {
    const res = (await c.mutation({ createInventoryStockBalance: { __args: { data: { stockItemId: itemId, locationId: locId, quantityMicros: 0, averageCostMicros: 0, totalValueMicros: 0, version: 0 } }, ...BAL_FIELDS } })) as { createInventoryStockBalance?: BalanceRecord };
    if (res.createInventoryStockBalance?.id) return res.createInventoryStockBalance;
  } catch {}
  return (await findBalance(c, itemId, locId)) as BalanceRecord;
};

// === ledger append ===
type AppendedMovement = MovementRecord & { created: boolean };

const deterministicMovementId = (input: { movementType?: string | null; stockItemId?: string | null; locationId?: string | null; idempotencyKey: string }): string => {
  const hex = createHash('sha256')
    .update(`${input.movementType ?? ''}|${input.stockItemId ?? ''}|${input.locationId ?? ''}|${input.idempotencyKey}`)
    .digest('hex')
    .slice(0, 32);
  const normalized = `${hex.slice(0, 12)}5${hex.slice(13, 16)}8${hex.slice(17)}`;
  return `${normalized.slice(0, 8)}-${normalized.slice(8, 12)}-${normalized.slice(12, 16)}-${normalized.slice(16, 20)}-${normalized.slice(20)}`;
};

const appendMovement = async (
  c: CoreApiClientLike,
  input: Omit<MovementRecord, 'id'> & { idempotencyKey: string },
): Promise<AppendedMovement | null> => {
  const existing = await findMovementByIdempotency(c, input.idempotencyKey);
  if (existing) return { ...existing, created: false };
  try {
    const res = (await c.mutation({
      createInventoryStockMovement: {
        __args: {
          data: { ...input, id: deterministicMovementId(input) },
        },
        ...MOV_FIELDS,
      },
    })) as { createInventoryStockMovement?: MovementRecord };
    if (res.createInventoryStockMovement?.id) return { ...res.createInventoryStockMovement, created: true };
  } catch {}
  const raced = await findMovementByIdempotency(c, input.idempotencyKey);
  return raced ? { ...raced, created: false } : null;
};

const reconcileBalanceProjection = async (c: CoreApiClientLike, itemId: string, locationId: string): Promise<void> => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    // Read the version BEFORE the ledger snapshot. If another reconciler writes
    // while we read, retry the whole snapshot instead of adding a stale delta.
    const balance = await ensureBalance(c, itemId, locationId);
    const movements = await queryConnection<MovementRecord>(c, 'inventoryStockMovements', { filter: { stockItemId: { eq: itemId }, locationId: { eq: locationId } }, first: 500 }, MOV_FIELDS);
    movements.sort((a, b) => `${a.occurredAt ?? ''}:${a.id}`.localeCompare(`${b.occurredAt ?? ''}:${b.id}`));
    let quantityMicros = 0;
    let averageCostMicros = 0;
    for (const movement of movements) {
      const delta = movement.quantityDeltaMicros ?? 0;
      if (delta > 0 && movement.unitCostMicros != null) {
        averageCostMicros = quantityMicros > 0
          ? computeNewWeightedAverage(quantityMicros, averageCostMicros, delta, movement.unitCostMicros)
          : movement.unitCostMicros;
      }
      quantityMicros += delta;
      if (quantityMicros === 0) averageCostMicros = 0;
    }
    const result = await c.mutation({ updateInventoryStockBalances: {
      __args: { filter: { id: { eq: balance.id }, version: { eq: balance.version ?? 0 } },
        data: { quantityMicros, averageCostMicros, totalValueMicros: quantityCostTotal(quantityMicros, averageCostMicros), version: (balance.version ?? 0) + 1 } }, id: true,
    } });
    if (mutationUpdatedRows(result, 'updateInventoryStockBalances') > 0) return;
    await waitForBalanceRetry(attempt);
  }
  throw new Error('BALANCE_CONFLICT');
};

const applyMovementToProjection = async (
  c: CoreApiClientLike,
  _movement: AppendedMovement,
  itemId: string,
  locationId: string,
  _fallbackBalance: BalanceRecord,
  _deltaMicros: number,
  _unitCostMicros: number,
  _sourceType: string,
): Promise<void> => {
  // Rebuild the materialised projection from the append-only ledger after
  // every movement. This also closes the race where an idempotent concurrent
  // retry reconciles before the original writer applies its increment.
  await reconcileBalanceProjection(c, itemId, locationId);
};

const ensureConsumptionIssue = async (
  c: CoreApiClientLike,
  data: { orderId: string; orderLineId: string; menuItemId: string; issueType: string },
): Promise<void> => {
  if (await findConsumptionIssue(c, data.orderId, data.orderLineId, data.issueType)) return;
  await c.mutation({ createInventoryConsumptionIssue: { __args: { data: { ...data, status: 'OPEN' } }, id: true } }).catch(() => null);
};

// === helpers : actor check ===
const requireAdmin = (role: string): InventoryResult | null => {
  if (role !== 'ADMIN') return { status: 403, body: { code: 'COMMAND_FORBIDDEN', message: 'Требуются права администратора.' } };
  return null;
};

// === commands ===

export const executeCreateStockLocation = async (
  c: CoreApiClientLike,
  payload: { name: string; sortOrder?: number; idempotencyKey: string },
  actor: { staffId: string; role: string },
): Promise<InventoryResult> => {
  const admin = requireAdmin(actor.role); if (admin) return admin;
  if (!payload.name?.trim()) return error('INVALID_INPUT', 'Название точки обязательно.');
  // idempotency via name uniqueness? Use name as natural key for retry
  const existing = await queryConnection<LocationRecord>(c, 'inventoryStockLocations', { filter: { name: { eq: payload.name.trim() } }, first: 1 }, LOC_FIELDS);
  if (existing[0]) return ok(200, { locationId: existing[0].id });
  try {
    const res = (await c.mutation({ createInventoryStockLocation: { __args: { data: { name: payload.name.trim(), isActive: true, sortOrder: payload.sortOrder ?? 0 } }, id: true } })) as { createInventoryStockLocation?: LocationRecord };
    if (res.createInventoryStockLocation?.id) return ok(201, { locationId: res.createInventoryStockLocation.id });
  } catch {}
  const raced = await queryConnection<LocationRecord>(c, 'inventoryStockLocations', { filter: { name: { eq: payload.name.trim() } }, first: 1 }, LOC_FIELDS);
  if (raced[0]) return ok(200, { locationId: raced[0].id });
  return error('CONFLICT', 'Точка не создана.');
};

export const executeCreateStockItem = async (
  c: CoreApiClientLike,
  payload: { name: string; itemType: string; unitKind: string; baseUnit: string; defaultLocationId?: string; idempotencyKey: string },
  actor: { staffId: string; role: string },
): Promise<InventoryResult> => {
  const admin = requireAdmin(actor.role); if (admin) return admin;
  if (!payload.name?.trim()) return error('INVALID_INPUT', 'Название позиции обязательно.');
  if (!['RAW_MATERIAL','SEMI_FINISHED'].includes(payload.itemType)) return error('INVALID_UNIT', 'Тип позиции неверен.');
  if (!['MASS','VOLUME','COUNT'].includes(payload.unitKind)) return error('INVALID_UNIT', 'Семейство единиц неверно.');
  const existing = await queryConnection<ItemRecord>(c, 'inventoryStockItems', { filter: { name: { eq: payload.name.trim() } }, first: 1 }, ITEM_FIELDS);
  if (existing[0]) return ok(200, { stockItemId: existing[0].id });
  try {
    const res = (await c.mutation({ createInventoryStockItem: { __args: { data: { name: payload.name.trim(), itemType: payload.itemType, unitKind: payload.unitKind, baseUnit: payload.baseUnit, isActive: true, defaultLocationId: payload.defaultLocationId ?? null } }, id: true } })) as { createInventoryStockItem?: ItemRecord };
    if (res.createInventoryStockItem?.id) return ok(201, { stockItemId: res.createInventoryStockItem.id });
  } catch {}
  const raced = await queryConnection<ItemRecord>(c, 'inventoryStockItems', { filter: { name: { eq: payload.name.trim() } }, first: 1 }, ITEM_FIELDS);
  if (raced[0]) return ok(200, { stockItemId: raced[0].id });
  return error('CONFLICT', 'Позиция не создана.');
};

// Receipt: multi-line
export const executeReceiveStock = async (
  c: CoreApiClientLike,
  payload: { locationId: string; lines: Array<{ stockItemId: string; quantityMicros: number; unitCostMicros: number }>; idempotencyKey: string; comment?: string },
  actor: { staffId: string; role: string },
): Promise<InventoryResult> => {
  const admin = requireAdmin(actor.role); if (admin) return admin;
  const loc = await findLocationById(c, payload.locationId);
  if (!loc) return error('LOCATION_NOT_FOUND', 'Точка не найдена.');
  if (loc.isActive === false) return error('LOCATION_INACTIVE', 'Точка неактивна.');
  const revisionLock = await rejectMovementDuringRevision(c, [payload.locationId]);
  if (revisionLock) return revisionLock;
  if (payload.lines.length === 0) return error('INVALID_QTY', 'Приход должен содержать позиции.');
  const items = new Set<string>();
  // Validate the entire document before creating any movement.
  for (const line of payload.lines) {
    if (!Number.isSafeInteger(line.quantityMicros) || line.quantityMicros <= 0) return error('INVALID_QTY', 'Количество должно быть положительным.');
    if (!Number.isSafeInteger(line.unitCostMicros) || line.unitCostMicros < 0) return error('INVALID_COST', 'Цена неверна.');
    if (items.has(line.stockItemId)) return error('DUPLICATE_ITEM', 'Позиция повторяется в приходе.');
    items.add(line.stockItemId);
    const item = await findItemById(c, line.stockItemId);
    if (!item) return error('ITEM_NOT_FOUND', 'Позиция не найдена.');
    if (item.isActive === false) return error('ITEM_INACTIVE', 'Позиция неактивна.');
    quantityCostTotal(line.quantityMicros, line.unitCostMicros);
  }
  const canonical = {
    locationId: payload.locationId, actorStaffId: actor.staffId, comment: payload.comment ?? null,
    lines: payload.lines.map(({ stockItemId, quantityMicros, unitCostMicros }) => ({ stockItemId, quantityMicros, unitCostMicros }))
      .sort((a, b) => a.stockItemId.localeCompare(b.stockItemId)),
  };
  const fingerprint = createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
  const manifest = await readRuntimeState(c, `inventory-receipt:${payload.idempotencyKey}`, { fingerprint });
  if (JSON.parse(manifest.value).fingerprint !== fingerprint) return error('IDEMPOTENCY_CONFLICT', 'Ключ прихода уже используется другим документом.');
  const existingGroup = await findMovementsBySource(c, payload.idempotencyKey);
  for (const movement of existingGroup) {
    const line = payload.lines.find(row => row.stockItemId === movement.stockItemId);
    if (!line || movement.movementType !== 'RECEIPT' || movement.locationId !== payload.locationId ||
        movement.quantityDeltaMicros !== line.quantityMicros || movement.unitCostMicros !== line.unitCostMicros ||
        movement.actorStaffId !== actor.staffId || (movement.reason ?? null) !== (payload.comment ?? null)) {
      return error('IDEMPOTENCY_CONFLICT', 'Сохранённые строки не соответствуют приходу.');
    }
  }
  const now = new Date().toISOString();
  let created = 0;
  for (const line of payload.lines) {
    const bal = await ensureBalance(c, line.stockItemId, payload.locationId);
    const mov = await appendMovement(c, {
      movementType: 'RECEIPT', stockItemId: line.stockItemId, locationId: payload.locationId,
      quantityDeltaMicros: line.quantityMicros, unitCostMicros: line.unitCostMicros, totalCostMicros: quantityCostTotal(line.quantityMicros, line.unitCostMicros),
      sourceType: 'RECEIPT', sourceId: payload.idempotencyKey, actorStaffId: actor.staffId, occurredAt: now,
      idempotencyKey: `${payload.idempotencyKey}:${line.stockItemId}:${payload.locationId}`, reason: payload.comment ?? null,
    });
    if (!mov) return error('CONFLICT', 'Приход не завершён. Повторите тот же документ.');
    // Even an existing movement may need projection repair after a lost response.
    await applyMovementToProjection(c, mov, line.stockItemId, payload.locationId, bal, line.quantityMicros, line.unitCostMicros, 'RECEIPT');
    if (mov.created) created += 1;
  }
  return ok(created > 0 ? 201 : 200, { receiptId: payload.idempotencyKey, lineCount: payload.lines.length, replay: created === 0 });
};

// WriteOff
export const executeWriteOffStock = async (
  c: CoreApiClientLike,
  payload: { stockItemId: string; locationId: string; quantityMicros: number; reason?: string; comment?: string; idempotencyKey: string },
  actor: { staffId: string; role: string },
): Promise<InventoryResult> => {
  const admin = requireAdmin(actor.role); if (admin) return admin;
  if (!Number.isSafeInteger(payload.quantityMicros) || payload.quantityMicros <= 0) return error('INVALID_QTY', 'Количество неверно.');
  const item = await findItemById(c, payload.stockItemId);
  if (!item) return error('ITEM_NOT_FOUND', 'Позиция не найдена.');
  const loc = await findLocationById(c, payload.locationId);
  if (!loc) return error('LOCATION_NOT_FOUND', 'Точка не найдена.');
  const revisionLock = await rejectMovementDuringRevision(c, [payload.locationId]);
  if (revisionLock) return revisionLock;
  const existing = await findMovementByIdempotency(c, payload.idempotencyKey);
  if (existing) return ok(200, { movementId: existing.id, replay: true });
  const bal = await ensureBalance(c, payload.stockItemId, payload.locationId);
  const snapCost = bal.averageCostMicros ?? 0;
  const total = quantityCostTotal(payload.quantityMicros, snapCost);
  const now = new Date().toISOString();
  const mov = await appendMovement(c, {
    movementType: 'WRITE_OFF', stockItemId: payload.stockItemId, locationId: payload.locationId,
    quantityDeltaMicros: -payload.quantityMicros, unitCostMicros: snapCost, totalCostMicros: -total,
    sourceType: 'MANUAL', sourceId: payload.idempotencyKey, actorStaffId: actor.staffId, occurredAt: now, idempotencyKey: payload.idempotencyKey, reason: payload.reason ?? payload.comment ?? null,
  });
  if (!mov) return error('CONFLICT', 'Списание не проведено.');
  await applyMovementToProjection(c, mov, payload.stockItemId, payload.locationId, bal, -payload.quantityMicros, snapCost, 'WRITE_OFF');
  return ok(201, { movementId: mov.id });
};

// Transfer
export const executeTransferStock = async (
  c: CoreApiClientLike,
  payload: { stockItemId: string; quantityMicros: number; sourceLocationId: string; destLocationId: string; idempotencyKey: string },
  actor: { staffId: string; role: string },
): Promise<InventoryResult> => {
  const admin = requireAdmin(actor.role); if (admin) return admin;
  if (payload.sourceLocationId === payload.destLocationId) return error('INVALID_TRANSFER', 'Точки должны отличаться.');
  if (!Number.isSafeInteger(payload.quantityMicros) || payload.quantityMicros <= 0) return error('INVALID_QTY', 'Количество неверно.');
  const existing = await findMovementsBySource(c, payload.idempotencyKey);
  if (existing.length === 2) return ok(200, { transferId: payload.idempotencyKey, replay: true });
  if (existing.length > 0) return error('CONFLICT', 'Перемещение уже частично проведено.');
  const srcLoc = await findLocationById(c, payload.sourceLocationId);
  const dstLoc = await findLocationById(c, payload.destLocationId);
  if (!srcLoc || !dstLoc) return error('LOCATION_NOT_FOUND', 'Точка не найдена.');
  const revisionLock = await rejectMovementDuringRevision(c, [payload.sourceLocationId, payload.destLocationId]);
  if (revisionLock) return revisionLock;
  const item = await findItemById(c, payload.stockItemId);
  if (!item) return error('ITEM_NOT_FOUND', 'Позиция не найдена.');
  const srcBal = await ensureBalance(c, payload.stockItemId, payload.sourceLocationId);
  const snapCost = srcBal.averageCostMicros ?? 0;
  const now = new Date().toISOString();
  const outKey = `${payload.idempotencyKey}:OUT`;
  const inKey = `${payload.idempotencyKey}:IN`;
  const outMov = await appendMovement(c, {
    movementType: 'TRANSFER_OUT', stockItemId: payload.stockItemId, locationId: payload.sourceLocationId,
    quantityDeltaMicros: -payload.quantityMicros, unitCostMicros: snapCost, totalCostMicros: -quantityCostTotal(payload.quantityMicros, snapCost),
    sourceType: 'TRANSFER', sourceId: payload.idempotencyKey, actorStaffId: actor.staffId, occurredAt: now, idempotencyKey: outKey,
  });
  if (!outMov) return error('CONFLICT', 'Перемещение OUT не проведено.');
  const dstMov = await appendMovement(c, {
    movementType: 'TRANSFER_IN', stockItemId: payload.stockItemId, locationId: payload.destLocationId,
    quantityDeltaMicros: payload.quantityMicros, unitCostMicros: snapCost, totalCostMicros: quantityCostTotal(payload.quantityMicros, snapCost),
    sourceType: 'TRANSFER', sourceId: payload.idempotencyKey, actorStaffId: actor.staffId, occurredAt: now, idempotencyKey: inKey,
  });
  if (!dstMov) return error('CONFLICT', 'Перемещение IN не проведено.');
  const dstBal = await ensureBalance(c, payload.stockItemId, payload.destLocationId);
  await applyMovementToProjection(c, outMov, payload.stockItemId, payload.sourceLocationId, srcBal, -payload.quantityMicros, snapCost, 'TRANSFER_OUT');
  await applyMovementToProjection(c, dstMov, payload.stockItemId, payload.destLocationId, dstBal, payload.quantityMicros, snapCost, 'RECEIPT');
  return ok(201, { transferId: payload.idempotencyKey });
};

// === Recipe publishing ===
export const detectCycle = (
  newRecipeTargetId: string,
  newLines: Array<{ stockItemId: string }>,
  existingGraph: Map<string, string[]>, // stockItemId -> componentIds (for SEMI)
): boolean => {
  // Build graph including new recipe
  const graph = new Map(existingGraph);
  graph.set(newRecipeTargetId, newLines.map(l => l.stockItemId));
  // DFS for cycle containing target
  const visited = new Set<string>();
  const stack = new Set<string>();
  const dfs = (node: string): boolean => {
    if (stack.has(node)) return true;
    if (visited.has(node)) return false;
    visited.add(node); stack.add(node);
    const neighbors = graph.get(node) ?? [];
    for (const nb of neighbors) {
      // only follow if nb is itself a SEMI recipe target (exists in graph)
      if (graph.has(nb) && dfs(nb)) return true;
    }
    stack.delete(node);
    return false;
  };
  for (const node of graph.keys()) {
    visited.clear(); stack.clear();
    if (dfs(node)) return true;
  }
  return false;
};

export const executeUpsertRecipe = async (
  c: CoreApiClientLike,
  payload: { label: string; targetKind: string; targetId: string; defaultLocationId?: string; lines: Array<{ stockItemId: string; quantityMicros: number }>; yieldQuantityMicros: number; idempotencyKey: string },
  actor: { staffId: string; role: string },
): Promise<InventoryResult> => {
  const admin = requireAdmin(actor.role); if (admin) return admin;
  if (!['MENU_ITEM','SEMI_FINISHED'].includes(payload.targetKind)) return error('INVALID_RECIPE', 'Тип цели неверен.');
  if (!Number.isSafeInteger(payload.yieldQuantityMicros) || payload.yieldQuantityMicros <= 0) return error('INVALID_YIELD', 'Выход неверен.');
  if (payload.lines.length === 0) return error('INVALID_RECIPE', 'Нужен хотя бы один ингредиент.');
  for (const line of payload.lines) {
    if (!Number.isSafeInteger(line.quantityMicros) || line.quantityMicros <= 0) return error('INVALID_QTY', 'Количество ингредиента неверно.');
    const item = await findItemById(c, line.stockItemId);
    if (!item) return error('ITEM_NOT_FOUND', `Ингредиент ${line.stockItemId} не найден.`);
  }
  // self-cycle check
  if (payload.targetKind === 'SEMI_FINISHED' && payload.lines.some(l => l.stockItemId === payload.targetId)) return error('RECIPE_CYCLE', 'Калькуляция создаёт циклическую зависимость');
  // Build existing graph for cycle check
  const allRecipes = await queryConnection<RecipeRecord>(c, 'inventoryRecipes', {}, RECIPE_FIELDS);
  const graph = new Map<string, string[]>();
  for (const rec of allRecipes) {
    if (rec.targetKind !== 'SEMI_FINISHED') continue;
    const vers = await findRecipeVersions(c, rec.id);
    const active = vers.find(v => v.status === 'ACTIVE');
    if (!active) continue;
    const lines = await findRecipeLines(c, active.id);
    graph.set(rec.targetId as string, lines.map(l => l.stockItemId as string));
  }
  // check indirect cycle
  const tempGraph = new Map(graph);
  tempGraph.set(payload.targetId, payload.lines.map(l => l.stockItemId));
  // simple DFS cycle detection
  const hasCycle = (() => {
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const dfs = (node: string): boolean => {
      if (recStack.has(node)) return true;
      if (visited.has(node)) return false;
      visited.add(node); recStack.add(node);
      const neigh = tempGraph.get(node) ?? [];
      for (const nb of neigh) if (tempGraph.has(nb) && dfs(nb)) return true;
      recStack.delete(node); return false;
    };
    for (const n of tempGraph.keys()) { visited.clear(); recStack.clear(); if (dfs(n)) return true; }
    return false;
  })();
  if (hasCycle) return error('RECIPE_CYCLE', 'Калькуляция создаёт циклическую зависимость');

  // idempotency check
  const existingVer = (await queryConnection<RecipeVersionRecord>(c, 'inventoryRecipeVersions', { filter: { idempotencyKey: { eq: payload.idempotencyKey } }, first: 1 }, RECIPE_VER_FIELDS))[0];
  if (existingVer) return ok(200, { recipeVersionId: existingVer.id, replay: true });

  // upsert recipe header
  let recipe: RecipeRecord | null = await findRecipeByTarget(c, payload.targetKind, payload.targetId);
  if (!recipe) {
    const res = (await c.mutation({ createInventoryRecipe: { __args: { data: { label: payload.label, targetKind: payload.targetKind, targetId: payload.targetId, defaultLocationId: payload.defaultLocationId ?? null, isActive: true } }, id: true } })) as { createInventoryRecipe?: RecipeRecord };
    recipe = res.createInventoryRecipe ?? null;
    if (!recipe?.id) {
      const raced = await findRecipeByTarget(c, payload.targetKind, payload.targetId);
      if (!raced) return error('CONFLICT', 'Калькуляция не создана.');
      recipe = raced;
    }
  }
  // supersede previous ACTIVE
  const versions = await findRecipeVersions(c, recipe.id);
  const active = versions.find(v => v.status === 'ACTIVE');
  const nextNum = active ? (active.versionNumber ?? 0) + 1 : 1;
  try {
    const res = (await c.mutation({ createInventoryRecipeVersion: { __args: { data: { recipeId: recipe.id, versionNumber: nextNum, yieldQuantityMicros: payload.yieldQuantityMicros, effectiveFrom: new Date().toISOString(), status: 'ACTIVE', createdByStaffId: actor.staffId, idempotencyKey: payload.idempotencyKey } }, id: true } })) as { createInventoryRecipeVersion?: RecipeVersionRecord };
    const ver = res.createInventoryRecipeVersion;
    if (!ver?.id) throw new Error('no ver');
    for (let i = 0; i < payload.lines.length; i++) {
      const line = payload.lines[i];
      await c.mutation({ createInventoryRecipeLine: { __args: { data: { recipeVersionId: ver.id, stockItemId: line.stockItemId, quantityMicros: line.quantityMicros, sortOrder: i } }, id: true } });
    }
    if (active) await c.mutation({ updateInventoryRecipeVersion: { __args: { id: active.id, data: { status: 'SUPERSEDED' } }, id: true } });
    return ok(201, { recipeId: recipe.id, recipeVersionId: ver.id });
  } catch {
    const raced = (await queryConnection<RecipeVersionRecord>(c, 'inventoryRecipeVersions', { filter: { idempotencyKey: { eq: payload.idempotencyKey } }, first: 1 }, RECIPE_VER_FIELDS))[0];
    if (raced) return ok(200, { recipeVersionId: raced.id, replay: true });
    return error('CONFLICT', 'Версия не создана.');
  }
};

// === Production ===
export const executeProduceSemi = async (
  c: CoreApiClientLike,
  payload: { stockItemId: string; quantityMicros: number; locationId: string; recipeVersionId?: string; idempotencyKey: string },
  actor: { staffId: string; role: string },
): Promise<InventoryResult> => {
  const admin = requireAdmin(actor.role); if (admin) return admin;
  if (!Number.isSafeInteger(payload.quantityMicros) || payload.quantityMicros <= 0) return error('INVALID_QTY', 'Количество неверно.');
  const item = await findItemById(c, payload.stockItemId);
  if (!item) return error('ITEM_NOT_FOUND', 'Позиция не найдена.');
  if (item.itemType !== 'SEMI_FINISHED') return error('INVALID_ITEM_TYPE', 'Только полуфабрикат можно производить.');
  const loc = await findLocationById(c, payload.locationId);
  if (!loc) return error('LOCATION_NOT_FOUND', 'Точка не найдена.');
  const revisionLock = await rejectMovementDuringRevision(c, [payload.locationId]);
  if (revisionLock) return revisionLock;
  const existing = await findMovementsBySource(c, payload.idempotencyKey);
  if (existing.length > 0) return ok(200, { productionId: payload.idempotencyKey, replay: true });

  // resolve recipe version
  let ver: RecipeVersionRecord | null = null;
  if (payload.recipeVersionId) ver = await findRecipeVersionById(c, payload.recipeVersionId);
  else {
    const rec = await findRecipeByTarget(c, 'SEMI_FINISHED', payload.stockItemId);
    if (!rec) return error('RECIPE_NOT_FOUND', 'Калькуляция не найдена.');
    const vers = await findRecipeVersions(c, rec.id);
    ver = vers.find(v => v.status === 'ACTIVE') ?? null;
  }
  if (!ver) return error('RECIPE_NOT_FOUND', 'Версия калькуляции не найдена.');
  const lines = await findRecipeLines(c, ver.id);
  if (lines.length === 0) return error('RECIPE_EMPTY', 'Калькуляция пуста.');
  const recipeYield = ver.yieldQuantityMicros as number;
  const now = new Date().toISOString();
  // compute inputs
  const inputs: Array<{ stockItemId: string; requiredMicros: number; avgCost: number }> = [];
  for (const line of lines) {
    const required = scaledQuantityMicros(line.quantityMicros as number, payload.quantityMicros, recipeYield);
    const bal = await ensureBalance(c, line.stockItemId as string, payload.locationId);
    inputs.push({ stockItemId: line.stockItemId as string, requiredMicros: required, avgCost: bal.averageCostMicros ?? 0 });
  }
  // compute production unit cost
  const unitCost = computeProductionUnitCost(inputs.map(i => ({ qtyMicros: i.requiredMicros, avgCostMicros: i.avgCost })), payload.quantityMicros);
  // create INPUT movements
  for (const inp of inputs) {
    const total = quantityCostTotal(inp.requiredMicros, inp.avgCost);
    const key = `${payload.idempotencyKey}:IN:${inp.stockItemId}`;
    const inputMovement = await appendMovement(c, {
      movementType: 'PRODUCTION_INPUT', stockItemId: inp.stockItemId, locationId: payload.locationId,
      quantityDeltaMicros: -inp.requiredMicros, unitCostMicros: inp.avgCost, totalCostMicros: -total,
      sourceType: 'PRODUCTION', sourceId: payload.idempotencyKey, recipeVersionId: ver.id, actorStaffId: actor.staffId, occurredAt: now, idempotencyKey: key,
    });
    if (!inputMovement) return error('CONFLICT', 'Производство не проведено.');
    const bal = await ensureBalance(c, inp.stockItemId, payload.locationId);
    await applyMovementToProjection(c, inputMovement, inp.stockItemId, payload.locationId, bal, -inp.requiredMicros, inp.avgCost, 'PRODUCTION_INPUT');
  }
  // OUTPUT
  const outTotal = quantityCostTotal(payload.quantityMicros, unitCost);
  const outputMovement = await appendMovement(c, {
    movementType: 'PRODUCTION_OUTPUT', stockItemId: payload.stockItemId, locationId: payload.locationId,
    quantityDeltaMicros: payload.quantityMicros, unitCostMicros: unitCost, totalCostMicros: outTotal,
    sourceType: 'PRODUCTION', sourceId: payload.idempotencyKey, recipeVersionId: ver.id, actorStaffId: actor.staffId, occurredAt: now, idempotencyKey: `${payload.idempotencyKey}:OUT:${payload.stockItemId}`,
  });
  if (!outputMovement) return error('CONFLICT', 'Производство не проведено.');
  const outBal = await ensureBalance(c, payload.stockItemId, payload.locationId);
  await applyMovementToProjection(c, outputMovement, payload.stockItemId, payload.locationId, outBal, payload.quantityMicros, unitCost, 'PRODUCTION');
  return ok(201, { productionId: payload.idempotencyKey, unitCostMicros: unitCost });
};

// === helpers for consumption: effective version ===
const findEffectiveRecipeVersion = async (c: CoreApiClientLike, menuItemId: string, effectiveAt: string): Promise<RecipeVersionRecord | null> => {
  const rec = await findRecipeByTarget(c, 'MENU_ITEM', menuItemId);
  if (!rec) return null;
  const vers = await findRecipeVersions(c, rec.id);
  const effective = vers
    .filter(v => v.status === 'ACTIVE' || v.status === 'SUPERSEDED')
    .filter(v => (v.effectiveFrom as string) <= effectiveAt)
    .sort((a, b) => new Date(b.effectiveFrom as string).getTime() - new Date(a.effectiveFrom as string).getTime());
  if (effective[0]) return effective[0];
  // fallback: last active before now
  return vers.find(v => v.status === 'ACTIVE') ?? null;
};

// === Consumption processor (like loyalty) ===
export const processConsumptionRequest = async (c: CoreApiClientLike, orderId: string, posOrderLines: Array<{ id: string; menuItemId: string; quantity: number; status: string; voidPreparedState?: string | null; createdAt?: string }>): Promise<InventoryResult> => {
  const req = await findConsumptionByOrder(c, orderId);
  if (req?.status === 'APPLIED') return ok(200, { orderId, alreadyApplied: true });
  if (!req) {
    // create PENDING request if not exists (as POS would)
    try {
      await c.mutation({ createInventoryConsumptionRequest: { __args: { data: { orderId, status: 'PENDING', idempotencyKey: orderId, attemptCount: 0 } }, id: true } });
    } catch {}
  }
  // if no lines, mark applied
  const now = new Date().toISOString();
  let appliedLines = 0;
  let issues = 0;
  for (const line of posOrderLines) {
    if (line.status === 'VOIDED') {
      if (line.voidPreparedState === 'NOT_PREPARED') continue; // no consumption
      // PREPARED void -> treat as waste consumption (same recipe, different movement type)
      const ver = await findEffectiveRecipeVersion(c, line.menuItemId, line.createdAt ?? now);
      if (!ver) { issues += 1; await ensureConsumptionIssue(c, { orderId, orderLineId: line.id, menuItemId: line.menuItemId, issueType: 'MISSING_RECIPE' }); continue; }
      const recipeLines = await findRecipeLines(c, ver.id);
      const recHeader = await queryConnection<RecipeRecord>(c, 'inventoryRecipes', { filter: { targetId: { eq: line.menuItemId } }, first: 1 }, RECIPE_FIELDS);
      const locId = recHeader[0]?.defaultLocationId ?? null;
      if (!locId) { issues += 1; await ensureConsumptionIssue(c, { orderId, orderLineId: line.id, menuItemId: line.menuItemId, issueType: 'MISSING_LOCATION' }); continue; }
      const revisionLock = await rejectMovementDuringRevision(c, [locId]);
      if (revisionLock) return revisionLock;
      for (const rl of recipeLines) {
        const required = scaledQuantityMicros(rl.quantityMicros as number, (line.quantity * 1000), ver.yieldQuantityMicros as number);
        const bal = await ensureBalance(c, rl.stockItemId as string, locId);
        const snap = bal.averageCostMicros ?? 0;
        const key = `${orderId}:${line.id}:${rl.stockItemId}`;
        if ((bal.quantityMicros ?? 0) < required) {
          issues += 1;
          await ensureConsumptionIssue(c, { orderId, orderLineId: line.id, menuItemId: line.menuItemId, issueType: 'INSUFFICIENT_STOCK' });
        }
        const movement = await appendMovement(c, {
          movementType: 'PREPARED_VOID_CONSUMPTION', stockItemId: rl.stockItemId as string, locationId: locId,
          quantityDeltaMicros: -required, unitCostMicros: snap, totalCostMicros: -quantityCostTotal(required, snap),
          sourceType: 'VOID', sourceId: orderId, recipeVersionId: ver.id, orderId, orderLineId: line.id, actorStaffId: 'system', occurredAt: now, idempotencyKey: key,
        });
        if (!movement) return error('CONFLICT', 'Списание продажи не проведено.');
        await applyMovementToProjection(c, movement, rl.stockItemId as string, locId, bal, -required, snap, 'WRITE_OFF');
        appliedLines += 1;
      }
      continue;
    }
    if (line.status !== 'ACTIVE') continue;
    const ver = await findEffectiveRecipeVersion(c, line.menuItemId, line.createdAt ?? now);
    if (!ver) { issues += 1; await ensureConsumptionIssue(c, { orderId, orderLineId: line.id, menuItemId: line.menuItemId, issueType: 'MISSING_RECIPE' }); continue; }
    const recipeLines = await findRecipeLines(c, ver.id);
    const recHeader = (await queryConnection<RecipeRecord>(c, 'inventoryRecipes', { filter: { targetKind: { eq: 'MENU_ITEM' }, targetId: { eq: line.menuItemId } }, first: 1 }, RECIPE_FIELDS))[0];
    const locId = recHeader?.defaultLocationId ?? null;
    if (!locId) { issues += 1; await ensureConsumptionIssue(c, { orderId, orderLineId: line.id, menuItemId: line.menuItemId, issueType: 'MISSING_LOCATION' }); continue; }
    const revisionLock = await rejectMovementDuringRevision(c, [locId]);
    if (revisionLock) return revisionLock;
    for (const rl of recipeLines) {
      const required = scaledQuantityMicros(rl.quantityMicros as number, (line.quantity * 1000), ver.yieldQuantityMicros as number);
      const bal = await ensureBalance(c, rl.stockItemId as string, locId);
      const snap = bal.averageCostMicros ?? 0;
      const key = `${orderId}:${line.id}:${rl.stockItemId}`;
      if ((bal.quantityMicros ?? 0) < required) {
        issues += 1;
        await ensureConsumptionIssue(c, { orderId, orderLineId: line.id, menuItemId: line.menuItemId, issueType: 'INSUFFICIENT_STOCK' });
      }
      const movement = await appendMovement(c, {
        movementType: 'SALE_CONSUMPTION', stockItemId: rl.stockItemId as string, locationId: locId,
        quantityDeltaMicros: -required, unitCostMicros: snap, totalCostMicros: -quantityCostTotal(required, snap),
        sourceType: 'SALE', sourceId: orderId, recipeVersionId: ver.id, orderId, orderLineId: line.id, actorStaffId: 'system', occurredAt: now, idempotencyKey: key,
      });
      if (!movement) return error('CONFLICT', 'Списание продажи не проведено.');
      await applyMovementToProjection(c, movement, rl.stockItemId as string, locId, bal, -required, snap, 'WRITE_OFF');
      appliedLines += 1;
    }
  }
  // update request status
  const reqFresh = await findConsumptionByOrder(c, orderId);
  if (reqFresh) {
    const status = issues > 0 && appliedLines === 0 ? 'FAILED_MISSING_RECIPE' : 'APPLIED';
    await c.mutation({ updateInventoryConsumptionRequest: { __args: { id: reqFresh.id, data: { status, processedAt: now, attemptCount: (reqFresh.attemptCount ?? 0) + 1 } }, id: true } }).catch(()=>null);
  }
  return ok(200, { orderId, appliedLines, issues });
};

// === Inventory Counts ===
export const executeCreateCount = async (c: CoreApiClientLike, payload: { label: string; locationId: string; idempotencyKey: string }, actor: { staffId: string; role: string }): Promise<InventoryResult> => {
  const admin = requireAdmin(actor.role); if (admin) return admin;
  const loc = await findLocationById(c, payload.locationId);
  if (!loc) return error('LOCATION_NOT_FOUND', 'Точка не найдена.');
  const existing = (await queryConnection<CountRecord>(c, 'inventoryCounts', { filter: { idempotencyKey: { eq: payload.idempotencyKey } }, first: 1 }, COUNT_FIELDS))[0];
  if (existing) return ok(200, { countId: existing.id, replay: true });
  const res = (await c.mutation({ createInventoryCount: { __args: { data: { label: payload.label, locationId: payload.locationId, status: 'DRAFT', createdByStaffId: actor.staffId, idempotencyKey: payload.idempotencyKey } }, id: true } })) as { createInventoryCount?: CountRecord };
  if (!res.createInventoryCount?.id) return error('CONFLICT', 'Ревизия не создана.');
  return ok(201, { countId: res.createInventoryCount.id });
};

export const executeStartCount = async (c: CoreApiClientLike, payload: { countId: string }, actor: { staffId: string; role: string }): Promise<InventoryResult> => {
  const admin = requireAdmin(actor.role); if (admin) return admin;
  const count = await findCountById(c, payload.countId);
  if (!count) return error('COUNT_NOT_FOUND', 'Ревизия не найдена.');
  if (count.status === 'ACTIVE') return ok(200, { countId: count.id, replay: true });
  if (count.status !== 'DRAFT') return error('COUNT_STATUS', 'Ревизия уже проведена.');
  const now = new Date().toISOString();
  const balances = await findBalancesByLocation(c, count.locationId as string);
  // capture ledger count for stale detection
  const movCount = (await queryConnection<MovementRecord>(c, 'inventoryStockMovements', { filter: { locationId: { eq: count.locationId as string } }, first: 500 }, { id: true })).length;
  const watermark = `${now}|${movCount}`;
  for (const bal of balances) {
    await c.mutation({ createInventoryCountLine: { __args: { data: { countId: count.id, stockItemId: bal.stockItemId, expectedQuantityMicros: bal.quantityMicros ?? 0, unitCostMicrosSnapshot: bal.averageCostMicros ?? 0, resolution: 'PENDING' } }, id: true } }).catch(()=>null);
  }
  await c.mutation({ updateInventoryCount: { __args: { id: count.id, data: { status: 'ACTIVE', ledgerWatermark: watermark, startedAt: now } }, id: true } });
  return ok(200, { countId: count.id, expectedLines: balances.length, watermark });
};

const revisionClaimHash = (idempotencyKey: string): string =>
  createHash('sha256').update(idempotencyKey).digest('hex').slice(0, 24);

const revisionClaimToken = (idempotencyKey: string, watermark: string): string =>
  `POSTING:${revisionClaimHash(idempotencyKey)}:${encodeURIComponent(watermark)}`;

const parseRevisionClaim = (value: unknown): { hash: string; watermark: string } | null => {
  if (typeof value !== 'string' || !value.startsWith('POSTING:')) return null;
  const [, hash, encodedWatermark] = value.split(':');
  if (!hash || !encodedWatermark) return null;
  try {
    return { hash, watermark: decodeURIComponent(encodedWatermark) };
  } catch {
    return null;
  }
};

const rejectMovementDuringRevision = async (c: CoreApiClientLike, locationIds: string[]): Promise<InventoryResult | null> => {
  const uniqueLocationIds = [...new Set(locationIds)];
  for (const locationId of uniqueLocationIds) {
    const activeCounts = await queryConnection<CountRecord>(
      c,
      'inventoryCounts',
      { filter: { locationId: { eq: locationId }, status: { eq: 'ACTIVE' } }, first: 100 },
      COUNT_FIELDS,
    );
    if (activeCounts.some((count) => parseRevisionClaim(count.ledgerWatermark))) {
      return error('REVISION_IN_PROGRESS', 'На этой точке сейчас обновляются остатки. Повторите операцию после завершения ревизии.');
    }
  }
  return null;
};

const revisionError = (code: string, message: string): Error & { code: string } => {
  const result = new Error(message) as Error & { code: string };
  result.code = code;
  return result;
};

const revisionWatermarkParts = (watermark: unknown): { time: string; count: number } | null => {
  if (typeof watermark !== 'string') return null;
  const separator = watermark.lastIndexOf('|');
  if (separator <= 0) return null;
  const time = watermark.slice(0, separator);
  const count = Number(watermark.slice(separator + 1));
  if (!time || !Number.isSafeInteger(count) || count < 0) return null;
  return { time, count };
};

const revisionMovementData = (
  input: Omit<MovementRecord, 'id'> & { idempotencyKey: string },
): PlannedMovement => ({
  ...input,
  id: deterministicMovementId(input),
});

const updateVirtualBalance = (
  balance: BalanceRecord,
  deltaMicros: number,
  unitCostMicros: number | null,
  sourceType: string,
): void => {
  const oldQty = balance.quantityMicros ?? 0;
  const oldAvg = balance.averageCostMicros ?? 0;
  const newQty = oldQty + deltaMicros;
  let newAvg = oldAvg;
  if (deltaMicros > 0 && unitCostMicros != null && (sourceType === 'RECEIPT' || sourceType === 'PRODUCTION')) {
    newAvg = oldQty > 0 && newQty !== 0
      ? computeNewWeightedAverage(oldQty, oldAvg, deltaMicros, unitCostMicros)
      : unitCostMicros;
  }
  balance.quantityMicros = newQty;
  balance.averageCostMicros = newQty === 0 ? 0 : newAvg;
  balance.totalValueMicros = newQty === 0 ? 0 : quantityCostTotal(newQty, balance.averageCostMicros ?? 0);
};

const createRevisionPostingPlan = async (
  c: CoreApiClientLike,
  count: CountRecord,
  lines: CountLineRecord[],
  payload: { countId: string; actuals: RevisionActualInput[]; idempotencyKey: string },
  actor: { staffId: string; role: string },
  watermark: string,
  claimToken: string,
): Promise<RevisionPostingPlan> => {
  const locationId = count.locationId as string;
  const location = await findLocationById(c, locationId);
  if (!location || location.isActive === false) throw revisionError('LOCATION_NOT_FOUND', 'Точка не найдена или отключена.');

  const actualByItem = new Map<string, RevisionActualInput>();
  for (const actual of payload.actuals) {
    if (actualByItem.has(actual.stockItemId)) throw revisionError('DUPLICATE_ACTUAL', 'Одна позиция указана в ревизии несколько раз.');
    actualByItem.set(actual.stockItemId, actual);
  }

  const allItemIds = new Set<string>([
    ...lines.map((line) => String(line.stockItemId)),
    ...payload.actuals.map((actual) => actual.stockItemId),
  ]);
  const items = new Map<string, ItemRecord>();
  for (const itemId of allItemIds) {
    const item = await findItemById(c, itemId);
    if (!item || item.isActive === false) throw revisionError('ITEM_NOT_FOUND', 'Позиция ревизии не найдена или отключена.');
    if (!['MASS', 'VOLUME', 'COUNT'].includes(String(item.unitKind)) || !['GRAM', 'MILLILITER', 'PIECE'].includes(String(item.baseUnit))) {
      throw revisionError('UNIT_INVALID', 'У позиции указана неподдерживаемая единица измерения.');
    }
    items.set(itemId, item);
  }

  const balances = await findBalancesByLocation(c, locationId);
  const virtualBalances = new Map<string, BalanceRecord>();
  for (const balance of balances) {
    if (balance.stockItemId) virtualBalances.set(balance.stockItemId, { ...balance });
  }
  for (const itemId of allItemIds) {
    if (virtualBalances.has(itemId)) continue;
    const extra = payload.actuals.find((actual) => actual.stockItemId === itemId && !lines.some((line) => String(line.stockItemId) === itemId));
    const zeroExpectedLine = lines.find((line) => String(line.stockItemId) === itemId && line.expectedQuantityMicros === 0);
    const actualQuantity = extra?.actualQuantityMicros ?? payload.actuals.find((actual) => actual.stockItemId === itemId)?.actualQuantityMicros;
    if (actualQuantity != null && actualQuantity >= 0 && (extra || zeroExpectedLine)) {
      virtualBalances.set(itemId, {
        id: deterministicMovementId({ movementType: 'REVISION_BALANCE', stockItemId: itemId, locationId, idempotencyKey: payload.idempotencyKey }),
        stockItemId: itemId,
        locationId,
        quantityMicros: 0,
        averageCostMicros: 0,
        totalValueMicros: 0,
        version: 0,
      });
      continue;
    }
    throw revisionError('BALANCE_NOT_FOUND', 'Для позиции ревизии не создан остаток на этой точке.');
  }

  const lineByItem = new Map<string, CountLineRecord>();
  for (const line of lines) {
    const itemId = String(line.stockItemId);
    if (lineByItem.has(itemId)) throw revisionError('DUPLICATE_COUNT_LINE', 'В ревизии есть повторяющаяся позиция.');
    lineByItem.set(itemId, line);
    if (!Number.isSafeInteger(line.expectedQuantityMicros) || (line.expectedQuantityMicros as number) < 0) {
      throw revisionError('EXPECTED_QTY_INVALID', 'Ожидаемый остаток содержит неверное количество.');
    }
  }

  const lineUpdates: RevisionPostingPlan['lineUpdates'] = [];
  const lineCreates: RevisionPostingPlan['lineCreates'] = [];
  const movements: PlannedMovement[] = [];
  const movementKeys = new Set<string>();
  const affectedItemIds = new Set<string>();
  const now = new Date().toISOString();

  const addMovement = (input: Omit<MovementRecord, 'id'> & { idempotencyKey: string }) => {
    if (movementKeys.has(input.idempotencyKey)) throw revisionError('MOVEMENT_KEY_CONFLICT', 'В плане ревизии есть конфликт ключей операций.');
    movementKeys.add(input.idempotencyKey);
    movements.push(revisionMovementData(input));
    affectedItemIds.add(String(input.stockItemId));
    const balance = virtualBalances.get(String(input.stockItemId));
    if (!balance) throw revisionError('BALANCE_NOT_FOUND', 'Для движения не найден остаток.');
    updateVirtualBalance(balance, input.quantityDeltaMicros as number, input.unitCostMicros as number | null, input.sourceType as string);
  };

  const addDirectAdjustment = (itemId: string, variance: number, unitCostMicros: number, key: string) => {
    if (!Number.isSafeInteger(variance) || !Number.isSafeInteger(unitCostMicros)) throw revisionError('QUANTITY_OVERFLOW', 'Количество или стоимость операции слишком велики.');
    const totalCostMicros = quantityCostTotal(variance, unitCostMicros);
    if (!Number.isSafeInteger(totalCostMicros)) throw revisionError('QUANTITY_OVERFLOW', 'Стоимость операции слишком велика.');
    addMovement({
      movementType: 'INVENTORY_ADJUSTMENT', stockItemId: itemId, locationId,
      quantityDeltaMicros: variance, unitCostMicros, totalCostMicros,
      sourceType: 'REVISION', sourceId: payload.idempotencyKey, actorStaffId: actor.staffId,
      occurredAt: now, idempotencyKey: key,
    });
  };

  const addUnrecordedProduction = async (itemId: string, quantityMicros: number, keyPrefix: string) => {
    const recipe = await findRecipeByTarget(c, 'SEMI_FINISHED', itemId);
    if (!recipe) throw revisionError('RECIPE_NOT_FOUND', 'Для полуфабриката не найдена калькуляция.');
    const versions = await findRecipeVersions(c, recipe.id);
    const version = versions.find((candidate) => candidate.status === 'ACTIVE') ?? null;
    if (!version || !Number.isSafeInteger(version.yieldQuantityMicros) || (version.yieldQuantityMicros as number) <= 0) {
      throw revisionError('RECIPE_NOT_FOUND', 'Для полуфабриката не найдена активная версия калькуляции.');
    }
    const recipeLines = await findRecipeLines(c, version.id);
    if (recipeLines.length === 0) throw revisionError('RECIPE_EMPTY', 'Калькуляция полуфабриката пуста.');
    const inputs: Array<{ stockItemId: string; requiredMicros: number; avgCostMicros: number }> = [];
    for (const recipeLine of recipeLines) {
      const inputId = String(recipeLine.stockItemId);
      const inputItem = items.get(inputId) ?? await findItemById(c, inputId);
      if (!inputItem || inputItem.isActive === false) throw revisionError('ITEM_NOT_FOUND', 'Ингредиент калькуляции не найден или отключён.');
      items.set(inputId, inputItem);
      const inputBalance = virtualBalances.get(inputId);
      if (!inputBalance) throw revisionError('BALANCE_NOT_FOUND', 'Для ингредиента калькуляции не найден остаток.');
      const requiredMicros = scaledQuantityMicros(recipeLine.quantityMicros as number, quantityMicros, version.yieldQuantityMicros as number);
      if (!Number.isSafeInteger(requiredMicros) || requiredMicros < 0) throw revisionError('QUANTITY_OVERFLOW', 'Количество ингредиента слишком велико.');
      inputs.push({ stockItemId: inputId, requiredMicros, avgCostMicros: inputBalance.averageCostMicros ?? 0 });
    }
    const unitCostMicros = computeProductionUnitCost(inputs.map((input) => ({ qtyMicros: input.requiredMicros, avgCostMicros: input.avgCostMicros })), quantityMicros);
    for (const input of inputs) {
      const totalCostMicros = quantityCostTotal(input.requiredMicros, input.avgCostMicros);
      addMovement({
        movementType: 'PRODUCTION_INPUT', stockItemId: input.stockItemId, locationId,
        quantityDeltaMicros: -input.requiredMicros, unitCostMicros: input.avgCostMicros,
        totalCostMicros: -totalCostMicros, sourceType: 'PRODUCTION', sourceId: payload.idempotencyKey,
        recipeVersionId: version.id, actorStaffId: actor.staffId, occurredAt: now,
        idempotencyKey: `${keyPrefix}:IN:${input.stockItemId}`,
      });
    }
    const outputTotalCostMicros = quantityCostTotal(quantityMicros, unitCostMicros);
    addMovement({
      movementType: 'PRODUCTION_OUTPUT', stockItemId: itemId, locationId,
      quantityDeltaMicros: quantityMicros, unitCostMicros: unitCostMicros,
      totalCostMicros: outputTotalCostMicros, sourceType: 'PRODUCTION', sourceId: payload.idempotencyKey,
      recipeVersionId: version.id, actorStaffId: actor.staffId, occurredAt: now,
      idempotencyKey: `${keyPrefix}:OUT:${itemId}`,
    });
  };

  const processLine = async (line: CountLineRecord, actualInput: RevisionActualInput | undefined) => {
    const itemId = String(line.stockItemId);
    const expected = line.expectedQuantityMicros as number;
    const actual = actualInput?.actualQuantityMicros ?? null;
    if (actual !== null && (!Number.isSafeInteger(actual) || actual < 0)) throw revisionError('INVALID_QTY', 'Фактическое количество указано неверно.');
    const variance = actual === null ? null : actual - expected;
    if (variance !== null && !Number.isSafeInteger(variance)) throw revisionError('QUANTITY_OVERFLOW', 'Разница ревизии слишком велика.');
    const resolution = actual === null ? 'PENDING' : (actualInput?.resolution ?? 'DIRECT_ADJUSTMENT');
    if (!['PENDING', 'DIRECT_ADJUSTMENT', 'UNRECORDED_PRODUCTION'].includes(resolution)) throw revisionError('RESOLUTION_INVALID', 'Вариант обработки расхождения не поддерживается.');
    if (variance !== null && variance !== 0 && resolution === 'UNRECORDED_PRODUCTION' && items.get(itemId)?.itemType !== 'SEMI_FINISHED') {
      throw revisionError('RESOLUTION_INVALID', 'Производство можно выбрать только для полуфабриката.');
    }
    if (variance !== null && variance < 0 && resolution === 'UNRECORDED_PRODUCTION') throw revisionError('RESOLUTION_INVALID', 'Производство нельзя выбрать для недостачи.');
    lineUpdates.push({ id: line.id, data: { actualQuantityMicros: actual, varianceMicros: variance, resolution } });
    if (variance === null || variance === 0) return;
    if (variance > 0 && resolution === 'UNRECORDED_PRODUCTION') {
      await addUnrecordedProduction(itemId, variance, `${payload.idempotencyKey}:prod:${itemId}`);
      return;
    }
    addDirectAdjustment(itemId, variance, line.unitCostMicrosSnapshot ?? 0, `${payload.idempotencyKey}:${itemId}`);
  };

  for (const line of lines) await processLine(line, actualByItem.get(String(line.stockItemId)));

  for (const actual of payload.actuals.filter((candidate) => !lineByItem.has(candidate.stockItemId))) {
    if (actual.actualQuantityMicros === null) continue;
    if (!Number.isSafeInteger(actual.actualQuantityMicros) || actual.actualQuantityMicros < 0) throw revisionError('INVALID_QTY', 'Фактическое количество указано неверно.');
    const item = items.get(actual.stockItemId);
    const resolution = actual.resolution ?? 'DIRECT_ADJUSTMENT';
    if (resolution === 'UNRECORDED_PRODUCTION' && item?.itemType !== 'SEMI_FINISHED') throw revisionError('RESOLUTION_INVALID', 'Производство можно выбрать только для полуфабриката.');
    const lineId = deterministicMovementId({ movementType: 'REVISION_LINE', stockItemId: actual.stockItemId, locationId: count.id, idempotencyKey: payload.idempotencyKey });
    lineCreates.push({ id: lineId, countId: count.id, stockItemId: actual.stockItemId, expectedQuantityMicros: 0, actualQuantityMicros: actual.actualQuantityMicros, varianceMicros: actual.actualQuantityMicros, unitCostMicrosSnapshot: virtualBalances.get(actual.stockItemId)?.averageCostMicros ?? 0, resolution });
    if (actual.actualQuantityMicros === 0) continue;
    if (resolution === 'UNRECORDED_PRODUCTION') await addUnrecordedProduction(actual.stockItemId, actual.actualQuantityMicros, `${payload.idempotencyKey}:prod:${actual.stockItemId}`);
    else addDirectAdjustment(actual.stockItemId, actual.actualQuantityMicros, virtualBalances.get(actual.stockItemId)?.averageCostMicros ?? 0, `${payload.idempotencyKey}:${actual.stockItemId}`);
  }

  return { countId: count.id, locationId, idempotencyKey: payload.idempotencyKey, watermark, claimToken, lineUpdates, lineCreates, movements, affectedItemIds: [...affectedItemIds] };
};

const claimRevision = async (c: CoreApiClientLike, count: CountRecord, idempotencyKey: string): Promise<{ watermark: string; claimToken: string; owned: boolean } | InventoryResult> => {
  const currentWatermark = count.ledgerWatermark;
  const existingClaim = parseRevisionClaim(currentWatermark);
  if (existingClaim) {
    if (existingClaim.hash !== revisionClaimHash(idempotencyKey)) return error('REVISION_IN_PROGRESS', 'Эта ревизия уже проводится другим действием.');
    return { watermark: existingClaim.watermark, claimToken: currentWatermark as string, owned: false };
  }
  const parsed = revisionWatermarkParts(currentWatermark);
  if (!parsed) return error('REVISION_WATERMARK_INVALID', 'Невозможно безопасно определить момент начала ревизии.');
  const movements = await queryConnection<MovementRecord>(c, 'inventoryStockMovements', { filter: { locationId: { eq: count.locationId as string } }, first: 500 }, { id: true, occurredAt: true });
  if (movements.length > parsed.count) return error('REVISION_STALE', 'Во время ревизии остатки на этой точке изменились. Обновите данные и начните ревизию заново.');
  const hasNewTime = movements.some((movement) => String(movement.occurredAt ?? '') > parsed.time);
  if (hasNewTime && movements.length !== parsed.count) return error('REVISION_STALE', 'Во время ревизии остатки на этой точке изменились. Обновите данные и начните ревизию заново.');
  const claimToken = revisionClaimToken(idempotencyKey, currentWatermark as string);
  const result = await c.mutation({
    updateInventoryCounts: {
      __args: {
        filter: { id: { eq: count.id }, status: { eq: 'ACTIVE' }, ledgerWatermark: { eq: currentWatermark } },
        data: { ledgerWatermark: claimToken },
      },
      id: true,
    },
  });
  if (mutationUpdatedRows(result, 'updateInventoryCounts') === 0) {
    const fresh = await findCountById(c, count.id);
    const freshClaim = parseRevisionClaim(fresh?.ledgerWatermark);
    if (freshClaim?.hash === revisionClaimHash(idempotencyKey)) return { watermark: freshClaim.watermark, claimToken: fresh?.ledgerWatermark as string, owned: false };
    if (fresh?.status === 'POSTED') return ok(200, { countId: count.id, replay: true });
    return error('REVISION_STALE', 'Во время ревизии остатки на этой точке изменились. Обновите данные и начните ревизию заново.');
  }
  return { watermark: currentWatermark as string, claimToken, owned: true };
};

const restoreRevisionClaim = async (c: CoreApiClientLike, plan: RevisionPostingPlan): Promise<void> => {
  await c.mutation({
    updateInventoryCounts: {
      __args: { filter: { id: { eq: plan.countId }, ledgerWatermark: { eq: plan.claimToken } }, data: { ledgerWatermark: plan.watermark } },
      id: true,
    },
  }).catch(() => null);
};

const stageRevisionLines = async (c: CoreApiClientLike, plan: RevisionPostingPlan): Promise<void> => {
  for (const line of plan.lineCreates) {
    await c.mutation({ createInventoryCountLine: { __args: { data: line }, id: true } });
  }
  for (const line of plan.lineUpdates) {
    const result = await c.mutation({ updateInventoryCountLine: { __args: { id: line.id, data: line.data }, id: true } });
    if (mutationUpdatedRows(result, 'updateInventoryCountLine') === 0) throw revisionError('COUNT_LINE_WRITE_FAILED', 'Строка ревизии не сохранена.');
  }
};

const postRevisionMovements = async (c: CoreApiClientLike, movements: PlannedMovement[]): Promise<void> => {
  if (movements.length === 0) return;
  const result = await c.mutation({
    createInventoryStockMovements: {
      __args: { data: movements, upsert: true },
      id: true,
    },
  });
  const created = (result as Record<string, unknown>)?.createInventoryStockMovements;
  if (!Array.isArray(created) || created.length !== movements.length || created.some((movement) => !(movement as Record<string, unknown>)?.id)) {
    throw revisionError('REVISION_MOVEMENT_BATCH_FAILED', 'Ревизия не проведена: пакет движений не сохранён целиком.');
  }
};

const retryRevisionProjection = async (c: CoreApiClientLike, plan: RevisionPostingPlan): Promise<void> => {
  for (const itemId of plan.affectedItemIds) await reconcileBalanceProjection(c, itemId, plan.locationId);
};

export const executeFinalizeCount = async (
  c: CoreApiClientLike,
  payload: { countId: string; actuals: RevisionActualInput[]; idempotencyKey: string },
  actor: { staffId: string; role: string },
): Promise<InventoryResult> => {
  const admin = requireAdmin(actor.role); if (admin) return admin;
  const existingMovs = await findMovementsBySource(c, payload.idempotencyKey);
  const count = await findCountById(c, payload.countId);
  if (!count) return error('COUNT_NOT_FOUND', 'Ревизия не найдена.');
  if (count.status === 'POSTED') return ok(200, { countId: count.id, replay: true });
  if (count.status !== 'ACTIVE') return error('COUNT_STATUS', 'Ревизия не активна.');
  if (existingMovs.length > 0 && !parseRevisionClaim(count.ledgerWatermark)) {
    return error('REVISION_RETRY_REQUIRED', 'Предыдущая попытка ревизии не завершилась. Начните новую ревизию для безопасного повторения.');
  }

  const lines = await findCountLines(c, count.id);
  const claim = await claimRevision(c, count, payload.idempotencyKey);
  if ('status' in claim) return claim;
  let plan: RevisionPostingPlan | null = null;
  let movementBatchCommitted = false;
  try {
    plan = await createRevisionPostingPlan(c, count, lines, payload, actor, claim.watermark, claim.claimToken);
    await stageRevisionLines(c, plan);
    await postRevisionMovements(c, plan.movements);
    movementBatchCommitted = plan.movements.length > 0;
    await retryRevisionProjection(c, plan);
    const posted = await c.mutation({ updateInventoryCount: { __args: { id: count.id, data: { status: 'POSTED', ledgerWatermark: claim.watermark } }, id: true } });
    if (mutationUpdatedRows(posted, 'updateInventoryCount') === 0) throw revisionError('COUNT_POST_FAILED', 'Ревизия не переведена в завершённое состояние.');
    return ok(201, { countId: count.id, movements: plan.movements.length });
  } catch (caught) {
    if (plan && !movementBatchCommitted) await restoreRevisionClaim(c, plan);
    if (caught && typeof caught === 'object' && 'code' in caught && ['REVISION_STALE', 'REVISION_IN_PROGRESS', 'INVALID_QTY', 'RESOLUTION_INVALID', 'RECIPE_NOT_FOUND', 'RECIPE_EMPTY', 'BALANCE_NOT_FOUND', 'ITEM_NOT_FOUND', 'LOCATION_NOT_FOUND', 'UNIT_INVALID', 'DUPLICATE_ACTUAL', 'DUPLICATE_COUNT_LINE', 'EXPECTED_QTY_INVALID', 'QUANTITY_OVERFLOW', 'MOVEMENT_KEY_CONFLICT', 'COUNT_LINE_WRITE_FAILED'].includes(String((caught as { code?: unknown }).code))) {
      return error(String((caught as { code: string }).code), (caught as unknown as Error).message);
    }
    throw caught;
  }
};

export const dispatchInventoryCommand = async (
  c: CoreApiClientLike,
  command: InventoryCommand,
  payload: Record<string, unknown>,
  actor: { staffId: string; role: string },
): Promise<InventoryResult> => {
  switch (command) {
    case 'createStockLocation':
      return executeCreateStockLocation(c, payload as never, actor);
    case 'createStockItem':
      return executeCreateStockItem(c, payload as never, actor);
    case 'receiveStock':
      return executeReceiveStock(c, payload as never, actor);
    case 'writeOffStock':
      return executeWriteOffStock(c, payload as never, actor);
    case 'transferStock':
      return executeTransferStock(c, payload as never, actor);
    case 'upsertRecipe':
      return executeUpsertRecipe(c, payload as never, actor);
    case 'produceSemiFinished':
      return executeProduceSemi(c, payload as never, actor);
    case 'createInventoryCount':
      return executeCreateCount(c, payload as never, actor);
    case 'startInventoryCount':
      return executeStartCount(c, payload as never, actor);
    case 'finalizeInventoryCount':
      return executeFinalizeCount(c, payload as never, actor);
  }
};
