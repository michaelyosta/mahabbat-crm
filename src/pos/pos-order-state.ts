export const POS_ORDER_STATUSES = [
  'OPEN',
  'IN_PROGRESS',
  'PRECHECK_PRINTED',
  'CLOSED',
  'CANCELLED',
] as const;

export type PosOrderStatus = (typeof POS_ORDER_STATUSES)[number];

export const isPosOrderEditable = (status: PosOrderStatus): boolean =>
  status === 'OPEN' || status === 'IN_PROGRESS';

export const isPosOrderActive = (status: PosOrderStatus): boolean =>
  isPosOrderEditable(status) || status === 'PRECHECK_PRINTED';

export const nextPosOrderStatusAfterLineChange = (
  currentStatus: PosOrderStatus,
  activeLineCount: number,
): PosOrderStatus => {
  if (currentStatus === 'OPEN' && activeLineCount > 0) {
    return 'IN_PROGRESS';
  }

  return currentStatus;
};

export const POS_ORDER_LINE_STATUSES = ['ACTIVE', 'VOIDED'] as const;

export type PosOrderLineStatus = (typeof POS_ORDER_LINE_STATUSES)[number];

export const isPosOrderLineActive = (status: PosOrderLineStatus): boolean =>
  status === 'ACTIVE';
