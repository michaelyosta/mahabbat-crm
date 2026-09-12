export const POS_COMMANDS = [
  'authenticatePosStaff',
  'logoutPosStaff',
  'refreshPosSession',
  'openShift',
  'closeShift',
  'openOrder',
  'addGuest',
  'addLine',
  'changeLineQuantity',
  'removeUnsentLine',
  'addStopListEntry',
  'clearStopListEntry',
  'printKitchenTicket',
  'createPrecheck',
  'cancelPrecheck',
  'recordPayment',
  'closeOrder',
  'createReservation',
  'updateReservationStatus',
  'createPrepayment',
  'applyPrepayment',
  'attachReservationToOrder',
  'voidOrderLines',
  'transferOrderToTable',
  'transferOrderToWaiter',
  'transferOrderLinesToGuest',
  'upsertPrinterDevice',
  'upsertProductionStation',
  'setMenuItemProductionStation',
  'retryPrintJob',
  'testPrinterDevice',
] as const;

export type PosCommand = (typeof POS_COMMANDS)[number];

export const POS_ACTOR_ROLES = ['ADMIN', 'WAITER'] as const;

export type PosActorRole = (typeof POS_ACTOR_ROLES)[number];

export type PosActor = {
  staffId: string;
  role: PosActorRole;
};

export const POS_AUTH_COMMANDS = new Set<PosCommand>([
  'authenticatePosStaff',
  'logoutPosStaff',
  'refreshPosSession',
]);

const WAITER_ALLOWED_COMMANDS: ReadonlySet<PosCommand> = new Set(
  POS_COMMANDS.filter(
    (command) =>
      command !== 'authenticatePosStaff' &&
      command !== 'cancelPrecheck' &&
      command !== 'voidOrderLines' &&
      command !== 'transferOrderToTable' &&
      command !== 'transferOrderToWaiter' &&
      command !== 'transferOrderLinesToGuest' &&
      command !== 'upsertPrinterDevice' &&
      command !== 'upsertProductionStation' &&
      command !== 'setMenuItemProductionStation' &&
      command !== 'retryPrintJob' &&
      command !== 'testPrinterDevice',
  ),
);

const ADMIN_ALLOWED_COMMANDS: ReadonlySet<PosCommand> = new Set(POS_COMMANDS);

export const commandAllowedForRole = (
  command: PosCommand,
  role: PosActorRole,
): boolean => {
  const allowed =
    role === 'ADMIN' ? ADMIN_ALLOWED_COMMANDS : WAITER_ALLOWED_COMMANDS;

  return allowed.has(command);
};

export const orderCanBeEditedBy = (
  orderOwnerStaffId: string | null | undefined,
  actor: PosActor,
): boolean =>
  actor.role === 'ADMIN' || orderOwnerStaffId === actor.staffId;

export const shiftCanBeClosedBy = (
  shiftStaffId: string | null | undefined,
  actor: PosActor,
): boolean => actor.role === 'ADMIN' || shiftStaffId === actor.staffId;
