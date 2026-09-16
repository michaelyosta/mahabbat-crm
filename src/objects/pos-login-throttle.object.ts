import {
  defineObject,
  FieldType,
  NumberDataType,
} from 'twenty-sdk/define';

export const POS_LOGIN_THROTTLE_UNIVERSAL_IDENTIFIER =
  '5d4c3b2a-1f0e-4d9c-8b7a-6e5d4c3b2a19';
export const POS_LOGIN_THROTTLE_KEY_FIELD_UNIVERSAL_IDENTIFIER =
  '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
export const POS_LOGIN_THROTTLE_FAILED_COUNT_FIELD_UNIVERSAL_IDENTIFIER =
  '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e';
export const POS_LOGIN_THROTTLE_LOCKED_UNTIL_FIELD_UNIVERSAL_IDENTIFIER =
  '3c4d5e6f-7a8b-4c9d-8e1f-2a3b4c5d6e7f';
export const POS_LOGIN_THROTTLE_WINDOW_STARTED_AT_FIELD_UNIVERSAL_IDENTIFIER =
  '4d5e6f7a-8b9c-4d0e-9f1a-2b3c4d5e6f70';
export const POS_LOGIN_THROTTLE_UNIQUE_KEY_INDEX_UNIVERSAL_IDENTIFIER =
  '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7081';
export const POS_LOGIN_THROTTLE_UNIQUE_KEY_INDEX_FIELD_UNIVERSAL_IDENTIFIER =
  '6f7a8b9c-0d1e-4f2a-8b3c-4d5e6f708192';

export default defineObject({
  universalIdentifier: POS_LOGIN_THROTTLE_UNIVERSAL_IDENTIFIER,
  nameSingular: 'posLoginThrottle',
  namePlural: 'posLoginThrottles',
  labelSingular: 'Счётчик входов POS',
  labelPlural: 'Счётчики входов POS',
  description:
    'Durable server-owned throttle for POS PIN/card login; keeps brute-force protection across stateless requests',
  icon: 'IconShieldLock',
  isSearchable: false,
  isUIEditable: false,
  isUICreatable: false,
  labelIdentifierFieldMetadataUniversalIdentifier:
    POS_LOGIN_THROTTLE_KEY_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: POS_LOGIN_THROTTLE_KEY_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'key',
      label: 'Ключ',
      description: 'Серверный ключ троттлинга (credential/global/staff)',
      icon: 'IconKey',
      isNullable: false,
      isUIEditable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier:
        POS_LOGIN_THROTTLE_FAILED_COUNT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'failedCount',
      label: 'Неудачные попытки',
      description: 'Число неудачных попыток в текущем окне',
      icon: 'IconAlertTriangle',
      isNullable: false,
      isUIEditable: false,
      defaultValue: 0,
      universalSettings: { dataType: NumberDataType.INT },
    },
    {
      universalIdentifier:
        POS_LOGIN_THROTTLE_LOCKED_UNTIL_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.DATE_TIME,
      name: 'lockedUntil',
      label: 'Заблокировано до',
      description: 'Действующая временная блокировка',
      icon: 'IconLockAccess',
      isNullable: true,
      isUIEditable: false,
      defaultValue: null,
    },
    {
      universalIdentifier:
        POS_LOGIN_THROTTLE_WINDOW_STARTED_AT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.DATE_TIME,
      name: 'windowStartedAt',
      label: 'Начало окна',
      description: 'Начало текущего окна подсчёта попыток',
      icon: 'IconClock',
      isNullable: true,
      isUIEditable: false,
      defaultValue: null,
    },
  ],
});
