import type { PosRow, PosSession } from 'src/front-components/pos-ui.helpers';
import type { PosApi } from 'src/pos-ui/PosApi';

type ApiEnvelope = Record<string, unknown> & {
  code?: string;
  message?: string;
};

type FetchLike = typeof fetch;

const parseJson = async (response: Response): Promise<ApiEnvelope> => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as ApiEnvelope;
  } catch {
    return { message: text };
  }
};

const toError = (envelope: ApiEnvelope, fallback: string): Error => {
  const error = new Error(
    String(envelope.message ?? envelope.code ?? fallback),
  ) as Error & { body?: ApiEnvelope; status?: number };
  (error as unknown as { body: ApiEnvelope }).body = envelope;
  return error;
};

export const createStandalonePosApi = (options: {
  baseUrl?: string;
  fetchImpl?: FetchLike;
  getSession: () => PosSession | null;
  setSession: (session: PosSession | null) => void;
}): PosApi => {
  const fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
  const rawBase = options.baseUrl ?? '';
  const baseUrl = rawBase.replace(/\/+$/, '');

  const headersFor = (session: PosSession | null): Record<string, string> => {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };
    if (session?.sessionToken) {
      headers.authorization = `Bearer ${session.sessionToken}`;
    }
    return headers;
  };

  return {
    loginWithPin: async (pin: string, terminalId?: string) => {
      const response = await fetchImpl(`${baseUrl}/api/pos/auth`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pin, terminalId: terminalId ?? 'touch-pos' }),
      });
      const envelope = await parseJson(response);
      if (!response.ok) {
        throw toError(envelope, 'Вход отклонён');
      }
      if (!envelope.sessionToken || !(envelope.staff as { id?: string } | undefined)?.id) {
        throw new Error(
          String(envelope.message ?? envelope.code ?? 'Вход отклонён'),
        );
      }
      const rawStaff = envelope.staff as { id: string; displayName?: string; role?: string };
      const session: PosSession = {
        sessionToken: String(envelope.sessionToken),
        staff: {
          id: String(rawStaff.id),
          displayName: String(rawStaff.displayName ?? 'Сотрудник'),
          role: (rawStaff.role === 'ADMIN' ? 'ADMIN' : 'WAITER') as PosSession['staff']['role'],
        },
      };
      options.setSession(session);
      return session;
    },
    logout: async () => {
      const session = options.getSession();
      if (session?.sessionToken) {
        try {
          await fetchImpl(`${baseUrl}/api/pos/command`, {
            method: 'POST',
            headers: headersFor(session),
            body: JSON.stringify({ command: 'logoutPosStaff', payload: {} }),
          });
        } catch {
          // Clear local session even when remote expired.
        }
      }
      options.setSession(null);
    },
    list: async (collection) => {
      const session = options.getSession();
      const response = await fetchImpl(
        `${baseUrl}/api/pos/rest/${encodeURIComponent(collection)}?limit=200`,
        { headers: headersFor(session) },
      );
      const envelope = await parseJson(response);
      if (!response.ok) {
        // Normalize gateway Russian error for UI (already Russian, but map technical)
        if (response.status === 401) {
          (envelope as Record<string, unknown>).code = (envelope.code ?? 'POS_SESSION_EXPIRED') as string;
        }
        throw toError(envelope, 'Ошибка загрузки данных');
      }
      // Gateway proxies Twenty REST shape: { data: { [collection]: [...] } }
      const data = (envelope as unknown as { data?: Record<string, unknown> }).data;
      const rows = (data?.[collection] as PosRow[] | undefined) ?? ((envelope as unknown as Record<string, unknown>)[collection] as PosRow[] | undefined);
      return Array.isArray(rows) ? (rows as PosRow[]) : [];
    },
    command: async (name, payload) => {
      const session = options.getSession();
      const response = await fetchImpl(`${baseUrl}/api/pos/command`, {
        method: 'POST',
        headers: headersFor(session),
        body: JSON.stringify({ command: name, payload }),
      });
      const envelope = await parseJson(response);
      if (!response.ok) {
        throw toError(envelope, 'Ошибка выполнения команды');
      }
      return envelope as Record<string, unknown>;
    },
    about: async () => {
      const session = options.getSession();
      const response = await fetchImpl(`${baseUrl}/api/about`, {
        headers: headersFor(session),
      });
      const envelope = await parseJson(response);
      if (!response.ok) {
        throw toError(envelope, 'Данные о версии недоступны');
      }
      return envelope as Record<string, unknown>;
    },
  };
};
