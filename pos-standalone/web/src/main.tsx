import React, { useCallback, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

import type { PosSession } from 'src/front-components/pos-ui.helpers';
import { PosApp } from 'src/pos-ui/PosApp';
import { createStandalonePosApi } from 'src/pos-ui/StandalonePosApi';

const gatewayBase = (import.meta.env.VITE_POS_GATEWAY_URL as string | undefined)?.replace(/\/+$/, '') ?? '';

function StandaloneRoot() {
  const [session, setSession] = useState<PosSession | null>(() => {
    try {
      const raw = sessionStorage.getItem('mahabbat:pos:session');
      if (!raw) return null;
      const v = JSON.parse(raw) as PosSession;
      if (typeof v.sessionToken === 'string' && v.staff?.id) return v;
      return null;
    } catch {
      return null;
    }
  });

  const getSession = useCallback(() => session, [session]);

  const setSessionAndPersist = useCallback((next: PosSession | null) => {
    setSession(next);
    try {
      if (next) sessionStorage.setItem('mahabbat:pos:session', JSON.stringify(next));
      else sessionStorage.removeItem('mahabbat:pos:session');
    } catch {
      // storage may be blocked
    }
  }, []);

  const api = useMemo(
    () =>
      createStandalonePosApi({
        baseUrl: gatewayBase,
        getSession,
        setSession: setSessionAndPersist,
      }),
    [getSession, setSessionAndPersist],
  );

  return (
    <PosApp
      api={api}
      mode="standalone"
      initialSession={session}
      onSessionChange={setSessionAndPersist}
    />
  );
}

const el = document.getElementById('root');
if (!el) throw new Error('root missing');
createRoot(el).render(<StandaloneRoot />);
