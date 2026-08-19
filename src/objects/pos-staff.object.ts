import { defineObject, FieldType, NumberDataType } from 'twenty-sdk/define';

export const POS_STAFF_UNIVERSAL_IDENTIFIER =
  '908ea71c-c6f0-447c-8245-46758c143bc5';
export const POS_STAFF_DISPLAY_NAME_FIELD_UNIVERSAL_IDENTIFIER =
  'd614372b-1463-4b68-bcd7-133bc415e306';
export const POS_STAFF_ROLE_FIELD_UNIVERSAL_IDENTIFIER =
  'c4d1205b-2f98-4f55-a914-46025c2fe21c';
export const POS_STAFF_PIN_HASH_FIELD_UNIVERSAL_IDENTIFIER =
  '3ff5c1ed-0bfb-4b94-85e7-c1a2830b2857';
export const POS_STAFF_CARD_IDENTIFIER_FIELD_UNIVERSAL_IDENTIFIER =
  '4b296b65-c20e-4c64-944a-dc3ef92cf8e4';
export const POS_STAFF_IS_ACTIVE_FIELD_UNIVERSAL_IDENTIFIER =
  'af8ebead-bbd8-4257-a9c6-65e296c81026';
export const POS_STAFF_FAILED_LOGIN_COUNT_FIELD_UNIVERSAL_IDENTIFIER =
  '995b3dac-56da-4ac4-9b78-b8841a5d1096';
export const POS_STAFF_LOCKED_UNTIL_FIELD_UNIVERSAL_IDENTIFIER =
  '387d7053-02c7-4d9b-96bf-4ef1eb939d23';
export const POS_STAFF_UNIQUE_CARD_IDENTIFIER_INDEX_UNIVERSAL_IDENTIFIER =
  '4d491f69-df12-4068-8873-a7f1eb61e3df';

export default defineObject({
  universalIdentifier: POS_STAFF_UNIVERSAL_IDENTIFIER,
  nameSingular: 'posStaff',
  namePlural: 'posStaffs',
  labelSingular: 'Сотрудник POS',
  labelPlural: 'Сотрудники POS',
  description:
    'Операционная identity сотрудника ресторана; не является Twenty WorkspaceMember',
  icon: 'IconUserCheck',
  isSearchable: false,
  isUIEditable: false,
  isUICreatable: false,
  labelIdentifierFieldMetadataUniversalIdentifier:
    POS_STAFF_DISPLAY_NAME_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: POS_STAFF_DISPLAY_NAME_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'displayName',
      label: 'Имя сотрудника',
      description: 'Безопасное отображаемое имя сотрудника POS',
      icon: 'IconUser',
      isNullable: false,
      isUIEditable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: POS_STAFF_ROLE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'role',
      label: 'Роль POS',
      description: 'Серверная роль операционного сотрудника',
      icon: 'IconShieldCheck',
      isNullable: false,
      isUIEditable: false,
      defaultValue: "'WAITER'",
      options: [
        {
          id: '55241b32-4bd7-4ea9-9703-6977dee1be8e',
          value: 'WAITER',
          label: 'Официант',
          position: 0,
          color: 'blue',
        },
        {
          id: '42c406fe-c1b5-4e71-a0bb-a5ebd47a4a6e',
          value: 'ADMIN',
          label: 'Администратор',
          position: 1,
          color: 'orange',
        },
      ],
    },
    {
      universalIdentifier: POS_STAFF_PIN_HASH_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'pinHash',
      label: 'PIN hash',
      description: 'Проверяемый scrypt hash; plaintext PIN никогда не хранится',
      icon: 'IconLock',
      isNullable: false,
      isUIEditable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier:
        POS_STAFF_CARD_IDENTIFIER_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'cardIdentifier',
      label: 'Идентификатор карты',
      description: 'Нормализованный идентификатор карты; не является секретом',
      icon: 'IconCreditCard',
      isNullable: true,
      isUIEditable: false,
      defaultValue: null,
    },
    {
      universalIdentifier: POS_STAFF_IS_ACTIVE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.BOOLEAN,
      name: 'isActive',
      label: 'Активен',
      description: 'Неактивный сотрудник не может войти в POS',
      icon: 'IconUserOff',
      isNullable: false,
      isUIEditable: false,
      defaultValue: true,
    },
    {
      universalIdentifier:
        POS_STAFF_FAILED_LOGIN_COUNT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'failedLoginCount',
      label: 'Неудачные попытки',
      description: 'Служебный счётчик защиты от перебора PIN',
      icon: 'IconAlertTriangle',
      isNullable: false,
      isUIEditable: false,
      defaultValue: 0,
      universalSettings: { dataType: NumberDataType.INT },
    },
    {
      universalIdentifier: POS_STAFF_LOCKED_UNTIL_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.DATE_TIME,
      name: 'lockedUntil',
      label: 'Заблокирован до',
      description: 'Временная блокировка после неудачных попыток',
      icon: 'IconLockAccess',
      isNullable: true,
      isUIEditable: false,
      defaultValue: null,
    },
  ],
});
