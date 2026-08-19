import { defineObject, FieldType } from 'twenty-sdk/define';

export const POS_SESSION_UNIVERSAL_IDENTIFIER =
  '6d976c92-2445-438d-a615-01570bb5ec73';
export const POS_SESSION_SESSION_ID_FIELD_UNIVERSAL_IDENTIFIER =
  'ce025701-c721-4591-9f24-e30b27342ca4';
export const POS_SESSION_STAFF_ID_FIELD_UNIVERSAL_IDENTIFIER =
  '5af43039-2108-40b7-baa9-a7519183dd2b';
export const POS_SESSION_ROLE_FIELD_UNIVERSAL_IDENTIFIER =
  'bd0c16e3-d17d-4983-b683-ca76d01916ba';
export const POS_SESSION_TOKEN_HASH_FIELD_UNIVERSAL_IDENTIFIER =
  '9e4861b2-4ca6-4758-b45a-db4b3914eacc';
export const POS_SESSION_ISSUED_AT_FIELD_UNIVERSAL_IDENTIFIER =
  '75e51883-121a-453c-a3b9-22196abb3005';
export const POS_SESSION_EXPIRES_AT_FIELD_UNIVERSAL_IDENTIFIER =
  'ab9f1f69-8c0c-4e2d-87f0-f929daac9917';
export const POS_SESSION_REVOKED_AT_FIELD_UNIVERSAL_IDENTIFIER =
  '236a294c-e4df-4268-930e-6b66adf24631';
export const POS_SESSION_TERMINAL_ID_FIELD_UNIVERSAL_IDENTIFIER =
  '5441e007-c79b-430a-aa8f-adb241f2d19a';
export const POS_SESSION_UNIQUE_SESSION_ID_INDEX_UNIVERSAL_IDENTIFIER =
  'a8c0a5b3-330c-43c5-944a-cbedc1938743';
export const POS_SESSION_UNIQUE_TOKEN_HASH_INDEX_UNIVERSAL_IDENTIFIER =
  '7990c27a-1bee-43d9-8f04-0f38eab06472';

export default defineObject({
  universalIdentifier: POS_SESSION_UNIVERSAL_IDENTIFIER,
  nameSingular: 'posSession',
  namePlural: 'posSessions',
  labelSingular: 'Сессия POS',
  labelPlural: 'Сессии POS',
  description:
    'Короткоживущая серверная POS-сессия; raw token не хранится и не отображается в UI',
  icon: 'IconKey',
  isSearchable: false,
  isUIEditable: false,
  isUICreatable: false,
  labelIdentifierFieldMetadataUniversalIdentifier:
    POS_SESSION_SESSION_ID_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: POS_SESSION_SESSION_ID_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'sessionId',
      label: 'Идентификатор сессии',
      description: 'Публичный идентификатор для аудита без секретного токена',
      icon: 'IconFingerprint',
      isNullable: false,
      isUIEditable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: POS_SESSION_STAFF_ID_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'staffId',
      label: 'Сотрудник',
      description: 'PosStaff, которому выдана сессия',
      icon: 'IconUserCheck',
      isNullable: false,
      isUIEditable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: POS_SESSION_ROLE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'staffRole',
      label: 'Роль',
      description: 'Роль фиксируется на момент входа и читается сервером',
      icon: 'IconShieldCheck',
      isNullable: false,
      isUIEditable: false,
      defaultValue: "'WAITER'",
      options: [
        {
          id: 'f250123f-3a3b-4af4-ad8d-e24f4221c727',
          value: 'WAITER',
          label: 'Официант',
          position: 0,
          color: 'blue',
        },
        {
          id: '9fa29998-be5a-454e-9f57-83284b0eac50',
          value: 'ADMIN',
          label: 'Администратор',
          position: 1,
          color: 'orange',
        },
      ],
    },
    {
      universalIdentifier: POS_SESSION_TOKEN_HASH_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'tokenHash',
      label: 'Hash токена',
      description: 'Односторонний SHA-256 hash raw session token',
      icon: 'IconLock',
      isNullable: false,
      isUIEditable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: POS_SESSION_ISSUED_AT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.DATE_TIME,
      name: 'issuedAt',
      label: 'Выдана',
      description: 'Время выдачи сессии',
      icon: 'IconClock',
      isNullable: false,
      isUIEditable: false,
      defaultValue: 'now',
    },
    {
      universalIdentifier: POS_SESSION_EXPIRES_AT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.DATE_TIME,
      name: 'expiresAt',
      label: 'Истекает',
      description: 'Короткий срок жизни POS-сессии',
      icon: 'IconClockX',
      isNullable: false,
      isUIEditable: false,
      defaultValue: 'now',
    },
    {
      universalIdentifier: POS_SESSION_REVOKED_AT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.DATE_TIME,
      name: 'revokedAt',
      label: 'Отозвана',
      description: 'Время logout/revocation; null для активной сессии',
      icon: 'IconLogout',
      isNullable: true,
      isUIEditable: false,
      defaultValue: null,
    },
    {
      universalIdentifier: POS_SESSION_TERMINAL_ID_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'terminalId',
      label: 'Терминал',
      description: 'Опциональный идентификатор POS-терминала',
      icon: 'IconDeviceDesktop',
      isNullable: true,
      isUIEditable: false,
      defaultValue: null,
    },
  ],
});
