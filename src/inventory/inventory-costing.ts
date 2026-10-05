import { assertSafeMicros, divideRoundHalfUp } from 'src/inventory/inventory-units';

// Fixed-point micros scale: costs and quantities below are integer micros.
// 1 base unit (gram/milliliter/piece-batch) = 1000 micros; money uses
// 1 KZT = 1_000_000 micros (see seed-pos.mjs MICROS_PER_TENGE). All helpers
// below throw QUANTITY_OVERFLOW-style Errors on unsafe integers so command
// handlers can map them to 400s instead of silently wrapping.

// Moving Weighted Average: newAvg = (oldQty*oldAvg + receiptQty*receiptPrice)/ (oldQty+receiptQty)
// All values in micros (quantityMicros, costMicros per base unit *1000? Actually cost is per micros unit? We store cost per 1 base micros? Let's define cost per 1 micros unit scaled?
// Simplified: costMicros is price per 1 baseUnitMicros? For mass, price per gram micros? Easier: treat unitCostMicros as KZT micros per 1 micros quantity? No that would be tiny.
// Instead we store unitCostMicros as KZT micros per 1 base unit (gram). But quantityMicros = grams*1000. So total cost: quantityMicros * unitCost / MICROS_PER_UNIT
// But for MWA we average price per base unit, so using micros both side weighted by quantityMicros is equivalent.

export const computeNewWeightedAverage = (
  oldQtyMicros: number,
  oldAvgMicros: number,
  receiptQtyMicros: number,
  receiptUnitCostMicros: number, // price per base unit (e.g. per gram) in KZT micros
): number => {
  assertSafeMicros(oldQtyMicros, 'oldQtyMicros');
  assertSafeMicros(oldAvgMicros, 'oldAvgMicros');
  assertSafeMicros(receiptQtyMicros, 'receiptQtyMicros');
  assertSafeMicros(receiptUnitCostMicros, 'receiptUnitCostMicros');
  if (oldQtyMicros < 0 || receiptQtyMicros <= 0) throw new Error('Invalid qty for MWA');
  const totalQty = oldQtyMicros + receiptQtyMicros;
  assertSafeMicros(totalQty, 'totalQty');
  if (totalQty === 0) return 0;
  // weighted sum: oldQty*oldAvg + receiptQty*receiptUnitCost
  const first = oldQtyMicros * oldAvgMicros;
  const second = receiptQtyMicros * receiptUnitCostMicros;
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(second)) throw new Error('MWA overflow: weighted sum exceeds safe integer range.');
  const numerator = first + second;
  assertSafeMicros(numerator, 'numerator');
  return divideRoundHalfUp(numerator, totalQty);
};

// production cost: Σ(inputQty * inputAvg) / outputQty
export const computeProductionUnitCost = (
  inputs: Array<{ qtyMicros: number; avgCostMicros: number }>,
  outputQtyMicros: number,
): number => {
  assertSafeMicros(outputQtyMicros, 'outputQtyMicros');
  if (outputQtyMicros <= 0) throw new Error('Invalid output qty');
  let totalCost = 0;
  for (const inp of inputs) {
    assertSafeMicros(inp.qtyMicros, 'qtyMicros');
    assertSafeMicros(inp.avgCostMicros, 'avgCostMicros');
    const product = inp.qtyMicros * inp.avgCostMicros;
    if (!Number.isSafeInteger(product)) throw new Error('Production cost overflow: input product exceeds safe integer range.');
    totalCost += product;
    assertSafeMicros(totalCost, 'totalCost');
  }
  // totalCost is sum(qty * cost) ; divide by outputQty gives avg cost per base unit
  // Need to scale: because qtyMicros already *1000, product is cost * micros; division yields cost per micros? Keep consistent with MWA helper.
  return divideRoundHalfUp(totalCost, outputQtyMicros);
};

export const computeTotalValueMicros = (qtyMicros: number, avgCostMicros: number): number => {
  assertSafeMicros(qtyMicros, 'qtyMicros');
  assertSafeMicros(avgCostMicros, 'avgCostMicros');
  const product = qtyMicros * avgCostMicros;
  if (!Number.isSafeInteger(product)) throw new Error('Total value overflow: product exceeds safe integer range.');
  return divideRoundHalfUp(product, 1000); // if avg is per gram, total = qty(grams*1000)*costPerGram /1000 = cost * grams
};

// For ledger, we can store totalCostMicros as qtyDelta * unitCost / 1000 ??? Or just qtyMicros * unitCostMicros / 1000 ?
// Simpler: total = quantityMicros * unitCostMicros / 1000  (since quantityMicros = units*1000)
// But for determinism we use divideRoundHalfUp.
export const quantityCostTotal = (qtyMicros: number, unitCostMicros: number): number => {
  assertSafeMicros(qtyMicros, 'qtyMicros');
  assertSafeMicros(unitCostMicros, 'unitCostMicros');
  const product = qtyMicros * unitCostMicros;
  if (!Number.isSafeInteger(product)) throw new Error('Cost total overflow: product exceeds safe integer range.');
  return divideRoundHalfUp(product, 1000);
};
