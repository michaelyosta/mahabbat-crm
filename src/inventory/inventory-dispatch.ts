import type { CoreApiClientLike } from 'src/logic-functions/apply-loyalty-adjustment-request.logic-function';
import { divideRoundHalfUp, scaledQuantityMicros } from 'src/inventory/inventory-units';
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

type Connection<T> = { edges?: Array<{ node?: T | null } | null>; pageInfo?: { hasNextPage?: boolean; endCursor?: string | null } | null };

const queryConnection = async <T extends Existing>(
  client: CoreApiClientLike, root: string, args: Record<string, unknown>, fields: Record<string, boolean | Record<string, boolean>>,
): Promise<T[]> => {
  const result = (await client.query({ [root]: { __args: { first: 200, ...args }, edges: { node: fields }, pageInfo: { hasNextPage: true, endCursor: true } } })) as Record<string, Connection<T>>;
  return (result[root]?.edges ?? []).map(e => e?.node).filter((n): n is T => Boolean(n));
};

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

const updateBalance = async (c: CoreApiClientLike, bal: BalanceRecord, deltaMicros: number, unitCostMicros?: number | null, sourceType?: string) => {
  const itemId = bal.stockItemId;
  const locationId = bal.locationId;
  if (!itemId || !locationId) throw new Error('BALANCE_CONTEXT_MISSING');

  // Ledger inserts are append-only and commute, but the materialised projection
  // still needs a guarded update. A retry re-reads the latest version, so two
  // different commands cannot overwrite each other's quantity/cost calculation.
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const current = (await findBalance(c, itemId, locationId)) ?? bal;
    const oldQty = current.quantityMicros ?? 0;
    const oldAvg = current.averageCostMicros ?? 0;
    const newQty = oldQty + deltaMicros;
    let newAvg = oldAvg;
    if (sourceType === 'RECEIPT' && deltaMicros > 0 && unitCostMicros != null) {
      newAvg = oldQty > 0 && newQty !== 0
        ? computeNewWeightedAverage(oldQty, oldAvg, deltaMicros, unitCostMicros)
        : unitCostMicros;
    } else if (sourceType === 'PRODUCTION' && deltaMicros > 0 && unitCostMicros != null) {
      newAvg = oldQty <= 0 || newQty <= 0
        ? unitCostMicros
        : divideRoundHalfUp(oldQty * oldAvg + deltaMicros * unitCostMicros, newQty);
    } else if (sourceType === 'RECONCILIATION' && unitCostMicros != null) {
      newAvg = unitCostMicros;
    }
    const newTotal = newQty === 0 ? 0 : quantityCostTotal(newQty, newAvg);
    const expectedVersion = current.version ?? 0;
    try {
      const result = await c.mutation({
        updateInventoryStockBalances: {
          __args: {
            filter: { id: { eq: current.id }, version: { eq: expectedVersion } },
            data: {
              quantityMicros: newQty,
              averageCostMicros: newAvg,
              totalValueMicros: newTotal,
              version: expectedVersion + 1,
            },
          },
          id: true,
        },
      });
      if (mutationUpdatedRows(result, 'updateInventoryStockBalances') > 0) return;
    } catch {
      // A concurrent write can surface as a unique/optimistic conflict. Re-read
      // and retry; the bounded failure is reported to the command caller.
    }
    if (attempt < 7) await waitForBalanceRetry(attempt);
  }
  throw new Error('BALANCE_CONFLICT');
};

// === ledger append ===
type AppendedMovement = MovementRecord & { created: boolean };

const appendMovement = async (
  c: CoreApiClientLike,
  input: Omit<MovementRecord, 'id'> & { idempotencyKey: string },
): Promise<AppendedMovement | null> => {
  const existing = await findMovementByIdempotency(c, input.idempotencyKey);
  if (existing) return { ...existing, created: false };
  try {
    const res = (await c.mutation({ createInventoryStockMovement: { __args: { data: input }, ...MOV_FIELDS } })) as { createInventoryStockMovement?: MovementRecord };
    if (res.createInventoryStockMovement?.id) return { ...res.createInventoryStockMovement, created: true };
  } catch {}
  const raced = await findMovementByIdempotency(c, input.idempotencyKey);
  return raced ? { ...raced, created: false } : null;
};

const reconcileBalanceProjection = async (c: CoreApiClientLike, itemId: string, locationId: string): Promise<void> => {
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
  const balance = await ensureBalance(c, itemId, locationId);
  await updateBalance(c, balance, quantityMicros - (balance.quantityMicros ?? 0), averageCostMicros, 'RECONCILIATION');
};

const applyMovementToProjection = async (
  c: CoreApiClientLike,
  movement: AppendedMovement,
  itemId: string,
  locationId: string,
  fallbackBalance: BalanceRecord,
  deltaMicros: number,
  unitCostMicros: number,
  sourceType: string,
): Promise<void> => {
  if (movement.created) {
    await updateBalance(c, await findBalance(c, itemId, locationId) ?? fallbackBalance, deltaMicros, unitCostMicros, sourceType);
  } else {
    await reconcileBalanceProjection(c, itemId, locationId);
  }
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
  // idempotency: check movements with sourceId == idempotencyKey already exists
  const existingGroup = await findMovementsBySource(c, payload.idempotencyKey);
  if (existingGroup.length > 0) return ok(200, { receiptId: payload.idempotencyKey, lineCount: existingGroup.length, replay: true });
  const now = new Date().toISOString();
  let created = 0;
  for (const line of payload.lines) {
    if (!Number.isSafeInteger(line.quantityMicros) || line.quantityMicros <= 0) return error('INVALID_QTY', 'Количество должно быть положительным.');
    if (!Number.isSafeInteger(line.unitCostMicros) || line.unitCostMicros < 0) return error('INVALID_COST', 'Цена неверна.');
    const item = await findItemById(c, line.stockItemId);
    if (!item) return error('ITEM_NOT_FOUND', 'Позиция не найдена.');
    const bal = await ensureBalance(c, line.stockItemId, payload.locationId);
    const totalCost = quantityCostTotal(line.quantityMicros, line.unitCostMicros);
    const movKey = `${payload.idempotencyKey}:${line.stockItemId}:${payload.locationId}`;
    const mov = await appendMovement(c, {
      movementType: 'RECEIPT', stockItemId: line.stockItemId, locationId: payload.locationId,
      quantityDeltaMicros: line.quantityMicros, unitCostMicros: line.unitCostMicros, totalCostMicros: totalCost,
      sourceType: 'RECEIPT', sourceId: payload.idempotencyKey, actorStaffId: actor.staffId, occurredAt: now, idempotencyKey: movKey, reason: payload.comment ?? null,
    });
    if (!mov) return error('CONFLICT', 'Приход не проведён.');
    await applyMovementToProjection(c, mov, line.stockItemId, payload.locationId, bal, line.quantityMicros, line.unitCostMicros, 'RECEIPT');
    created += 1;
  }
  return ok(201, { receiptId: payload.idempotencyKey, lineCount: created });
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
  // check existing movements for this order
  const existingMovs = await findMovementsBySource(c, orderId);
  if (existingMovs.length > 0) return ok(200, { orderId, alreadyApplied: true });
  const req = await findConsumptionByOrder(c, orderId);
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

export const executeFinalizeCount = async (
  c: CoreApiClientLike,
  payload: { countId: string; actuals: Array<{ stockItemId: string; actualQuantityMicros: number; resolution?: string }>; idempotencyKey: string },
  actor: { staffId: string; role: string },
): Promise<InventoryResult> => {
  const admin = requireAdmin(actor.role); if (admin) return admin;
  // idempotency
  const existingMovs = await findMovementsBySource(c, payload.idempotencyKey);
  if (existingMovs.length > 0) {
    const cnt = await findCountById(c, payload.countId);
    if (cnt?.status === 'POSTED') return ok(200, { countId: cnt.id, replay: true });
  }
  const count = await findCountById(c, payload.countId);
  if (!count) return error('COUNT_NOT_FOUND', 'Ревизия не найдена.');
  if (count.status === 'POSTED') return ok(200, { countId: count.id, replay: true });
  if (count.status !== 'ACTIVE') return error('COUNT_STATUS', 'Ревизия не активна.');
  // stale check: compare movement count at watermark
  const watermark = count.ledgerWatermark as string;
  const watermarkParts = watermark.split('|');
  const watermarkCount = watermarkParts.length === 2 ? parseInt(watermarkParts[1], 10) : 0;
  const allMovsForLoc = await queryConnection<MovementRecord>(c, 'inventoryStockMovements', { filter: { locationId: { eq: count.locationId as string } }, first: 500 }, { id: true, occurredAt: true, sourceId: true });
  if (allMovsForLoc.length > watermarkCount) {
    // also allow timestamp fallback if count-based not enough (e.g., external movements counted)
    return error('REVISION_STALE', 'Во время ревизии остатки изменились. Обновите ревизию перед проведением.');
  }
  // fallback timestamp > watermark (for cases where count equals but timestamp advanced due to same count but different source?)
  const watermarkTime = watermarkParts[0];
  const hasNewTime = allMovsForLoc.some(m => (m.occurredAt as string) > watermarkTime);
  if (hasNewTime && allMovsForLoc.length === watermarkCount) {
    // if timestamps advanced but count same shouldn't happen; ignore
  } else if (hasNewTime) {
    return error('REVISION_STALE', 'Во время ревизии остатки изменились. Обновите ревизию перед проведением.');
  }
  const lines = await findCountLines(c, count.id);
  const now = new Date().toISOString();
  // Handle actuals for items not in expected lines (expected 0)
  const linesByItem = new Map(lines.map(l => [l.stockItemId as string, l]));
  const extraActuals = payload.actuals.filter(a => !linesByItem.has(a.stockItemId));
  for (const extra of extraActuals) {
    // expected 0, create virtual line handling
    const variance = extra.actualQuantityMicros;
    if (variance !== 0) {
      const item = await findItemById(c, extra.stockItemId);
      if (item?.itemType === 'SEMI_FINISHED' && extra.resolution === 'UNRECORDED_PRODUCTION') {
        const res = await executeProduceSemi(c, { stockItemId: extra.stockItemId, quantityMicros: variance, locationId: count.locationId as string, idempotencyKey: `${payload.idempotencyKey}:prod:${extra.stockItemId}` }, actor);
        if (res.status >= 400) {
          const bal = await ensureBalance(c, extra.stockItemId, count.locationId as string);
          const snap = bal.averageCostMicros ?? 0;
          const key = `${payload.idempotencyKey}:${extra.stockItemId}`;
          const adjustment = await appendMovement(c, {
            movementType: 'INVENTORY_ADJUSTMENT', stockItemId: extra.stockItemId, locationId: count.locationId as string,
            quantityDeltaMicros: variance, unitCostMicros: snap, totalCostMicros: quantityCostTotal(variance, snap),
            sourceType: 'REVISION', sourceId: payload.idempotencyKey, actorStaffId: actor.staffId, occurredAt: now, idempotencyKey: key,
          });
          if (!adjustment) return error('CONFLICT', 'Корректировка ревизии не проведена.');
          await applyMovementToProjection(c, adjustment, extra.stockItemId, count.locationId as string, bal, variance, snap, 'WRITE_OFF');
        }
      } else {
        const bal = await ensureBalance(c, extra.stockItemId, count.locationId as string);
        const snap = bal.averageCostMicros ?? 0;
        const key = `${payload.idempotencyKey}:${extra.stockItemId}`;
        const adjustment = await appendMovement(c, {
          movementType: 'INVENTORY_ADJUSTMENT', stockItemId: extra.stockItemId, locationId: count.locationId as string,
          quantityDeltaMicros: variance, unitCostMicros: snap, totalCostMicros: quantityCostTotal(variance, snap),
          sourceType: 'REVISION', sourceId: payload.idempotencyKey, actorStaffId: actor.staffId, occurredAt: now, idempotencyKey: key,
        });
        if (!adjustment) return error('CONFLICT', 'Корректировка ревизии не проведена.');
        await applyMovementToProjection(c, adjustment, extra.stockItemId, count.locationId as string, bal, variance, snap, 'WRITE_OFF');
      }
    }
    // also create a count line for audit
    await c.mutation({ createInventoryCountLine: { __args: { data: { countId: count.id, stockItemId: extra.stockItemId, expectedQuantityMicros: 0, actualQuantityMicros: extra.actualQuantityMicros, varianceMicros: variance, unitCostMicrosSnapshot: 0, resolution: extra.resolution ?? 'PENDING' } }, id: true } }).catch(()=>null);
  }
  for (const line of lines) {
    const actualInput = payload.actuals.find(a => a.stockItemId === line.stockItemId);
    const actual = actualInput ? actualInput.actualQuantityMicros : line.expectedQuantityMicros;
    const expected = line.expectedQuantityMicros ?? 0;
    const variance = (actual as number) - expected;
    await c.mutation({ updateInventoryCountLine: { __args: { id: line.id, data: { actualQuantityMicros: actual, varianceMicros: variance, resolution: actualInput?.resolution ?? 'PENDING' } }, id: true } }).catch(()=>null);
    if (variance === 0) continue;
    const item = await findItemById(c, line.stockItemId as string);
    if (variance < 0) {
      // shortage adjustment
      const snap = line.unitCostMicrosSnapshot ?? 0;
      const key = `${payload.idempotencyKey}:${line.stockItemId}`;
      const adjustment = await appendMovement(c, {
        movementType: 'INVENTORY_ADJUSTMENT', stockItemId: line.stockItemId as string, locationId: count.locationId as string,
        quantityDeltaMicros: variance, unitCostMicros: snap, totalCostMicros: quantityCostTotal(variance, snap),
        sourceType: 'REVISION', sourceId: payload.idempotencyKey, actorStaffId: actor.staffId, occurredAt: now, idempotencyKey: key,
      });
      const bal = await ensureBalance(c, line.stockItemId as string, count.locationId as string);
      if (!adjustment) return error('CONFLICT', 'Корректировка ревизии не проведена.');
      await applyMovementToProjection(c, adjustment, line.stockItemId as string, count.locationId as string, bal, variance, snap, 'WRITE_OFF');
    } else {
      // positive variance
      if (item?.itemType === 'SEMI_FINISHED' && actualInput?.resolution === 'UNRECORDED_PRODUCTION') {
        // do production for variance qty
        const res = await executeProduceSemi(c, { stockItemId: line.stockItemId as string, quantityMicros: variance, locationId: count.locationId as string, idempotencyKey: `${payload.idempotencyKey}:prod:${line.stockItemId}` }, actor);
        if (res.status >= 400) {
          // fallback to direct adjustment
          const snap = line.unitCostMicrosSnapshot ?? 0;
          const key = `${payload.idempotencyKey}:${line.stockItemId}`;
          const adjustment = await appendMovement(c, {
            movementType: 'INVENTORY_ADJUSTMENT', stockItemId: line.stockItemId as string, locationId: count.locationId as string,
            quantityDeltaMicros: variance, unitCostMicros: snap, totalCostMicros: quantityCostTotal(variance, snap),
            sourceType: 'REVISION', sourceId: payload.idempotencyKey, actorStaffId: actor.staffId, occurredAt: now, idempotencyKey: key,
          });
          const bal = await ensureBalance(c, line.stockItemId as string, count.locationId as string);
          if (!adjustment) return error('CONFLICT', 'Корректировка ревизии не проведена.');
          await applyMovementToProjection(c, adjustment, line.stockItemId as string, count.locationId as string, bal, variance, snap, 'WRITE_OFF');
        }
      } else {
        const snap = line.unitCostMicrosSnapshot ?? 0;
        const key = `${payload.idempotencyKey}:${line.stockItemId}`;
        const adjustment = await appendMovement(c, {
          movementType: 'INVENTORY_ADJUSTMENT', stockItemId: line.stockItemId as string, locationId: count.locationId as string,
          quantityDeltaMicros: variance, unitCostMicros: snap, totalCostMicros: quantityCostTotal(variance, snap),
          sourceType: 'REVISION', sourceId: payload.idempotencyKey, actorStaffId: actor.staffId, occurredAt: now, idempotencyKey: key,
        });
        const bal = await ensureBalance(c, line.stockItemId as string, count.locationId as string);
        if (!adjustment) return error('CONFLICT', 'Корректировка ревизии не проведена.');
        await applyMovementToProjection(c, adjustment, line.stockItemId as string, count.locationId as string, bal, variance, snap, 'WRITE_OFF');
      }
    }
  }
  await c.mutation({ updateInventoryCount: { __args: { id: count.id, data: { status: 'POSTED' } }, id: true } });
  return ok(201, { countId: count.id });
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
