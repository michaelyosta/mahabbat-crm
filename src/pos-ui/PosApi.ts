import type { PosRow, PosSession } from 'src/front-components/pos-ui.helpers';

export type PosListCollection =
  | 'posZones'
  | 'posTables'
  | 'posOrders'
  | 'posOrderGuests'
  | 'posOrderLines'
  | 'posMenuItems'
  | 'posShifts'
  | 'posReservations'
  | 'posStopListEntries'
  | 'posKitchenTickets'
  | 'posKitchenTicketLines'
  | 'posPrechecks'
  | 'posPayments'
  | 'posPaymentMethods'
  | 'posPrepayments'
  | 'posStaffs'
  | 'posPrinterDevices'
  | 'posProductionStations'
  | 'posPrintJobs';

export type PosApi = {
  loginWithPin(pin: string, terminalId?: string): Promise<PosSession>;
  logout(): Promise<void>;
  list(collection: PosListCollection): Promise<PosRow[]>;
  command(
    name: string,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
};

export const POS_SESSION_STORAGE_KEY = 'mahabbat:pos:session';

export const persistPosSession = (session: PosSession): void => {
  try {
    globalThis.sessionStorage?.setItem(
      POS_SESSION_STORAGE_KEY,
      JSON.stringify(session),
    );
  } catch {
    // Storage may be unavailable in some test/sandbox contexts.
  }
};

export const restorePosSession = (): PosSession | null => {
  try {
    const raw = globalThis.sessionStorage?.getItem(POS_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'sessionToken' in parsed &&
      'staff' in parsed
    ) {
      const value = parsed as PosSession;
      if (
        typeof value.sessionToken === 'string' &&
        value.sessionToken.length >= 32 &&
        value.staff &&
        typeof value.staff.id === 'string' &&
        typeof value.staff.displayName === 'string'
      ) {
        return value;
      }
    }
    return null;
  } catch {
    return null;
  }
};

export const clearPosSession = (): void => {
  try {
    globalThis.sessionStorage?.removeItem(POS_SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage errors.
  }
};
