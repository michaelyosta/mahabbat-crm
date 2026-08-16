import { defineField, FieldType } from 'twenty-sdk/define';

import {
  LOYALTY_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER,
  LOYALTY_LEDGER_ENTRY_UNIVERSAL_IDENTIFIER,
} from 'src/objects/loyalty-ledger-entry.object';

export default defineField({
  universalIdentifier: LOYALTY_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: LOYALTY_LEDGER_ENTRY_UNIVERSAL_IDENTIFIER,
  type: FieldType.TEXT,
  name: 'idempotencyKey',
  label: 'Ключ идемпотентности',
  description:
    'Клиентский ключ, гарантирующий, что одна операция корректировки создаётся только один раз',
  icon: 'IconKey',
  isNullable: true,
  isUIEditable: false,
  defaultValue: null,
});
