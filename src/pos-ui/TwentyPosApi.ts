import { RestApiClient } from 'twenty-client-sdk/rest';

import type { PosRow, PosSession } from 'src/front-components/pos-ui.helpers';
import { listRows } from 'src/front-components/pos-ui.helpers';
import type { PosApi } from 'src/pos-ui/PosApi';

type ApiEnvelope = Record<string, unknown> & {
  status?: string;
  message?: string;
  code?: string;
  sessionToken?: unknown;
  staff?: { id?: unknown; displayName?: unknown; role?: unknown } | null;
};

export const createTwentyPosApi = (
  getSession: () => PosSession | null,
  setSession: (session: PosSession | null) => void,
): PosApi => {
  const rest = new RestApiClient();

  return {
    loginWithPin: async (pin: string, terminalId?: string) => {
      const result = await rest.post<ApiEnvelope>('/s/pos/command', {
        command: 'authenticatePosStaff',
        payload: { pin, terminalId: terminalId ?? 'touch-pos' },
      });
      if (!result.sessionToken || !result.staff?.id) {
        throw new Error(
          String(result.message ?? result.code ?? 'Вход отклонён'),
        );
      }
      const session: PosSession = {
        sessionToken: String(result.sessionToken),
        staff: {
          id: String(result.staff.id),
          displayName: String(result.staff.displayName ?? 'Сотрудник'),
          role: (result.staff.role === 'ADMIN' ? 'ADMIN' : 'WAITER') as PosSession['staff']['role'],
        },
      };
      setSession(session);
      return session;
    },
    logout: async () => {
      const session = getSession();
      if (session?.sessionToken) {
        try {
          await rest.post<ApiEnvelope>('/s/pos/command', {
            command: 'logoutPosStaff',
            payload: {},
            sessionToken: session.sessionToken,
          });
        } catch {
          // Clear local session even when remote session already expired.
        }
      }
      setSession(null);
    },
    list: async (collection) => {
      const PAGE_LIMIT = 200;
      const MAX_PAGES = 25;
      const rows: PosRow[] = [];
      let offset: number | undefined;
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const payload = await rest.get(`/rest/${collection}`, {
          query: { limit: PAGE_LIMIT, ...(offset !== undefined ? { offset } : {}) },
        });
        const chunk = listRows<PosRow>(payload as unknown as Record<string, unknown>, collection);
        rows.push(...chunk);
        if (chunk.length < PAGE_LIMIT) return rows;
        offset = (offset ?? 0) + PAGE_LIMIT;
      }
      throw new Error(`Слишком много записей в ${collection}: показаны первые ${rows.length}.`);
    },
    command: async (name, payload) => {
      const session = getSession();
      const body: Record<string, unknown> = { command: name, payload };
      if (session?.sessionToken) body.sessionToken = session.sessionToken;
      const result = await rest.post<ApiEnvelope>('/s/pos/command', body);
      return result as Record<string, unknown>;
    },
  };
};
