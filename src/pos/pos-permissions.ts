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
  'reconcileDamagedOrderTotals',
  'transferOrderToTable',
  'transferOrderToWaiter',
  'transferOrderLinesToGuest',
  'upsertPrinterDevice',
  'upsertProductionStation',
  'setMenuItemProductionStation',
  'retryPrintJob',
  'testPrinterDevice',
  'createPosStaff',
  'setPosStaffPin',
  'setPosStaffActive',
] as const;

export type PosCommand = (typeof POS_COMMANDS)[number];

// These commands are exposed by the authenticated CRM printing settings page.
// The page already has a Twenty workspace session, so it must not ask the
// operator to authenticate a second time with a POS PIN. The server route
// still restricts this bypass to this allowlist and derives an ADMIN actor on
// the server; POS/standalone clients continue to use PosSession authentication.
// Every bypassed call is audited as CRM_PRINTING_BYPASS with the real
// workspace caller (crmCallerWorkspaceId) in the event details.
export const POS_PRINTING_COMMANDS: ReadonlySet<PosCommand> = new Set([
  'upsertPrinterDevice',
  'upsertProductionStation',
  'setMenuItemProductionStation',
  'retryPrintJob',
  'testPrinterDevice',
]);
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
      command !== 'reconcileDamagedOrderTotals' &&
      command !== 'addStopListEntry' &&
      command !== 'clearStopListEntry' &&
      command !== 'transferOrderToTable' &&
      command !== 'transferOrderToWaiter' &&
      command !== 'transferOrderLinesToGuest' &&
      command !== 'upsertPrinterDevice' &&
      command !== 'upsertProductionStation' &&
      command !== 'setMenuItemProductionStation' &&
      command !== 'retryPrintJob' &&
      command !== 'testPrinterDevice' &&
      command !== 'createPosStaff' &&
      command !== 'setPosStaffPin' &&
      command !== 'setPosStaffActive',
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
