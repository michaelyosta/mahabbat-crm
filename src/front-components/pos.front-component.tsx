import { useCallback, useState } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';

import { MAHABBAT_POS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import type { PosSession } from 'src/front-components/pos-ui.helpers';
import { PosApp } from 'src/pos-ui/PosApp';
import { createTwentyPosApi } from 'src/pos-ui/TwentyPosApi';

const PosFrontComponent = () => {
  const [session, setSession] = useState<PosSession | null>(null);
  const getSession = useCallback(() => session, [session]);
  const api = createTwentyPosApi(getSession, setSession);

  return <PosApp api={api} mode="embedded" initialSession={session} onSessionChange={setSession} />;
};

export default defineFrontComponent({
  universalIdentifier: MAHABBAT_POS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'mahabbat-pos',
  description: 'Touch-oriented operational POS for Mahabbat restaurant workflows',
  component: PosFrontComponent,
});
