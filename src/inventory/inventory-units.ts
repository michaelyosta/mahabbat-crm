export type UnitKind = 'MASS' | 'VOLUME' | 'COUNT';
export type BaseUnit = 'GRAM' | 'MILLILITER' | 'PIECE';

// fixed-point: 1 base unit = 1000 micros
export const MICROS_PER_UNIT = 1000;

export const baseUnitForKind = (kind: UnitKind): BaseUnit => {
  if (kind === 'MASS') return 'GRAM';
  if (kind === 'VOLUME') return 'MILLILITER';
  return 'PIECE';
};

export const isValidQuantityMicros = (value: unknown): boolean =>
  typeof value === 'number' && Number.isSafeInteger(value);

export const gramsToMicros = (grams: number): number => Math.round(grams * MICROS_PER_UNIT);
export const kgToMicros = (kg: number): number => Math.round(kg * 1000 * MICROS_PER_UNIT);
export const mlToMicros = (ml: number): number => Math.round(ml * MICROS_PER_UNIT);
export const lToMicros = (l: number): number => Math.round(l * 1000 * MICROS_PER_UNIT);
export const piecesToMicros = (pcs: number): number => Math.round(pcs * MICROS_PER_UNIT);

// presentation helpers
export const microsToGrams = (micros: number): number => micros / MICROS_PER_UNIT;
export const microsToKg = (micros: number): number => micros / MICROS_PER_UNIT / 1000;
export const microsToDisplay = (micros: number, unitKind: UnitKind): string => {
  if (unitKind === 'MASS') {
    const g = microsToGrams(micros);
    if (Math.abs(g) >= 1000) return `${(g / 1000).toFixed(3)} кг`;
    return `${g.toFixed(1)} г`;
  }
  if (unitKind === 'VOLUME') {
    const ml = micros / MICROS_PER_UNIT;
    if (Math.abs(ml) >= 1000) return `${(ml / 1000).toFixed(3)} л`;
    return `${ml.toFixed(1)} мл`;
  }
  const pcs = micros / MICROS_PER_UNIT;
  return `${pcs.toFixed(3)} шт`;
};

// deterministic divide round half up for MWA (both positive)
export const divideRoundHalfUp = (numerator: number, denominator: number): number => {
  if (denominator === 0) throw new Error('Division by zero');
  // both expected non-negative for costing; handle negative by sign
  const sign = numerator * denominator < 0 ? -1 : 1;
  const absNum = Math.abs(numerator);
  const absDen = Math.abs(denominator);
  const result = Math.floor((absNum + absDen / 2) / absDen);
  return sign * result;
};

// scaled quantity: lineQty * requestedYield / recipeYield
export const scaledQuantityMicros = (
  lineQtyMicros: number,
  requestedYieldMicros: number,
  recipeYieldMicros: number,
): number => {
  if (recipeYieldMicros <= 0) throw new Error('Invalid recipe yield');
  // deterministic integer: (line * requested) / yield
  // use divideRoundHalfUp
  return divideRoundHalfUp(lineQtyMicros * requestedYieldMicros, recipeYieldMicros);
};
