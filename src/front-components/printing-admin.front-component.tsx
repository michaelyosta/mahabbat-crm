import { defineFrontComponent } from 'twenty-sdk/define';

import { MAHABBAT_PRINTING_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { PrintingAdmin } from 'src/front-components/printing-admin-ui';

export default defineFrontComponent({
  universalIdentifier: MAHABBAT_PRINTING_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'mahabbat-printing-admin',
  description: 'Administrative UI for Windows printer discovery and server-side print routing',
  component: PrintingAdmin,
});
