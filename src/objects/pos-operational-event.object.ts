import { defineObject, FieldType } from 'twenty-sdk/define';

export const POS_OPERATIONAL_EVENT_UNIVERSAL_IDENTIFIER =
  '6b4d7f10-2b3c-4d5e-8f60-1234567890a1';
export const POS_OPERATIONAL_EVENT_LABEL_FIELD_UNIVERSAL_IDENTIFIER =
  '6b4d7f10-2b3c-4d5e-8f60-1234567890a2';
export const POS_OPERATIONAL_EVENT_TYPE_FIELD_UNIVERSAL_IDENTIFIER =
  '6b4d7f10-2b3c-4d5e-8f60-1234567890a3';
export const POS_OPERATIONAL_EVENT_ACTOR_FIELD_UNIVERSAL_IDENTIFIER =
  '6b4d7f10-2b3c-4d5e-8f60-1234567890a4';
export const POS_OPERATIONAL_EVENT_OCCURRED_AT_FIELD_UNIVERSAL_IDENTIFIER =
  '6b4d7f10-2b3c-4d5e-8f60-1234567890a5';
export const POS_OPERATIONAL_EVENT_ORDER_ID_FIELD_UNIVERSAL_IDENTIFIER =
  '6b4d7f10-2b3c-4d5e-8f60-1234567890a6';
export const POS_OPERATIONAL_EVENT_DETAILS_FIELD_UNIVERSAL_IDENTIFIER =
  '6b4d7f10-2b3c-4d5e-8f60-1234567890a7';
export const POS_OPERATIONAL_EVENT_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER =
  '6b4d7f10-2b3c-4d5e-8f60-1234567890a8';
export const POS_OPERATIONAL_EVENT_UNIQUE_IDEMPOTENCY_INDEX_UNIVERSAL_IDENTIFIER =
  '6b4d7f10-2b3c-4d5e-8f60-1234567890a9';

export default defineObject({
  universalIdentifier: POS_OPERATIONAL_EVENT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'posOperationalEvent',
  namePlural: 'posOperationalEvents',
  labelSingular: 'Событие POS',
  labelPlural: 'Журнал POS',
  description: 'Append-only audit events for controlled POS operations',
  icon: 'IconHistory',
  labelIdentifierFieldMetadataUniversalIdentifier:
    POS_OPERATIONAL_EVENT_LABEL_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: POS_OPERATIONAL_EVENT_LABEL_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'label',
      label: 'Событие',
      description: 'Человекочитаемая метка',
      icon: 'IconTag',
      isNullable: false,
      defaultValue: "''",
      isUIEditable: false,
    },
    {
      universalIdentifier: POS_OPERATIONAL_EVENT_TYPE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'eventType',
      label: 'Тип',
      description: 'Машинный тип операции',
      icon: 'IconCategory',
      isNullable: false,
      defaultValue: "''",
      isUIEditable: false,
    },
    {
      universalIdentifier: POS_OPERATIONAL_EVENT_ACTOR_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'actorStaffId',
      label: 'Сотрудник',
      description: 'Actor из PosSession',
      icon: 'IconUser',
      isNullable: false,
      defaultValue: "''",
      isUIEditable: false,
    },
    {
      universalIdentifier: POS_OPERATIONAL_EVENT_OCCURRED_AT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.DATE_TIME,
      name: 'occurredAt',
      label: 'Время',
      description: 'Время операции',
      icon: 'IconClock',
      isNullable: false,
      defaultValue: 'now',
      isUIEditable: false,
    },
    {
      universalIdentifier: POS_OPERATIONAL_EVENT_ORDER_ID_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'orderId',
      label: 'Заказ',
      description: 'Связанный POS order ID',
      icon: 'IconShoppingCart',
      isNullable: true,
      defaultValue: null,
      isUIEditable: false,
    },
    {
      universalIdentifier: POS_OPERATIONAL_EVENT_DETAILS_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'details',
      label: 'Детали',
      description: 'Безопасный JSON без секретов',
      icon: 'IconNotes',
      isNullable: true,
      defaultValue: null,
      isUIEditable: false,
    },
    {
      universalIdentifier: POS_OPERATIONAL_EVENT_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'idempotencyKey',
      label: 'Ключ операции',
      description: 'Retry-safe operation key',
      icon: 'IconRepeat',
      isNullable: false,
      defaultValue: "''",
      isUIEditable: false,
    },
  ],
});
