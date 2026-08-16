import {
  defineObject,
  FieldType,
  NumberDataType,
  OnDeleteAction,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

export const RESERVATION_UNIVERSAL_IDENTIFIER =
  'd58597b1-4fe3-47cf-be63-bad9f58b4f7c';
export const RESERVATION_CUSTOMER_FIELD_UNIVERSAL_IDENTIFIER =
  '3198e86d-8cac-41bb-bff6-faed0a62bb3e';
export const RESERVATION_RESERVATIONS_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER =
  'faf2efb1-38b5-4fe4-a128-123cb7342113';
export const RESERVATION_EXTERNAL_ID_FIELD_UNIVERSAL_IDENTIFIER =
  '4b8e2d6f-1a93-4c57-9e20-7d35f8b1a604';
export const RESERVATION_PROVIDER_FIELD_UNIVERSAL_IDENTIFIER =
  '6c1f9a3e-5b27-4d80-8e42-7f16c3a9b205';
export const RESERVATION_GUEST_NAME_FIELD_UNIVERSAL_IDENTIFIER =
  '36a44353-5c9d-4653-af81-6d2af401b2e8';
export const RESERVATION_TIME_FIELD_UNIVERSAL_IDENTIFIER =
  'ba38901a-6df0-43a8-a7c9-4b34dce3c805';
export const RESERVATION_GUEST_COUNT_FIELD_UNIVERSAL_IDENTIFIER =
  '5d19d55b-c4e3-4987-958e-eeb12a409008';
export const RESERVATION_STATUS_FIELD_UNIVERSAL_IDENTIFIER =
  '7220d3da-089c-4917-bdae-6181b819069e';
export const RESERVATION_ZONE_FIELD_UNIVERSAL_IDENTIFIER =
  '2685b288-7b15-40bb-86a3-996f715dba25';
export const RESERVATION_TABLE_FIELD_UNIVERSAL_IDENTIFIER =
  '90dd3f68-34fe-403e-9fae-6ae528fe805f';
export const RESERVATION_SOURCE_FIELD_UNIVERSAL_IDENTIFIER =
  'cff8e6b6-da77-42a4-ad3f-40e65778b0c9';
export const RESERVATION_NOTES_FIELD_UNIVERSAL_IDENTIFIER =
  'fcb40f5d-8645-4777-8854-2d3b243ac4b7';

export default defineObject({
  universalIdentifier: RESERVATION_UNIVERSAL_IDENTIFIER,
  nameSingular: 'reservation',
  namePlural: 'reservations',
  labelSingular: 'Бронирование',
  labelPlural: 'Бронирования',
  description: 'Бронирование столика гостя ресторана',
  icon: 'IconCalendarEvent',
  isSearchable: true,
  labelIdentifierFieldMetadataUniversalIdentifier:
    RESERVATION_GUEST_NAME_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: RESERVATION_CUSTOMER_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'customer',
      label: 'Клиент',
      description: 'Клиент, на которого оформлена бронь',
      icon: 'IconUser',
      relationTargetObjectMetadataUniversalIdentifier:
        STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
      relationTargetFieldMetadataUniversalIdentifier:
        RESERVATION_RESERVATIONS_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.RESTRICT,
        joinColumnName: 'customerId',
      },
    },
    {
      universalIdentifier: RESERVATION_EXTERNAL_ID_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'externalId',
      label: 'Номер бронирования',
      description: 'Номер бронирования в исходной системе.',
      icon: 'IconId',
      isNullable: true,
      isUIEditable: false,
      defaultValue: null,
    },
    {
      universalIdentifier: RESERVATION_PROVIDER_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'provider',
      label: 'Канал загрузки',
      description: 'Канал, из которого получено бронирование.',
      icon: 'IconWorld',
      isNullable: true,
      isUIEditable: false,
      defaultValue: null,
    },
    {
      universalIdentifier: RESERVATION_TIME_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.DATE_TIME,
      name: 'reservationTime',
      label: 'Время бронирования',
      description: 'Дата и время бронирования',
      icon: 'IconClock',
      isNullable: false,
      defaultValue: 'now',
    },
    {
      universalIdentifier: RESERVATION_GUEST_COUNT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'guestCount',
      label: 'Количество гостей',
      icon: 'IconUsers',
      isNullable: false,
      defaultValue: 1,
      universalSettings: {
        dataType: NumberDataType.INT,
      },
    },
    {
      universalIdentifier: RESERVATION_STATUS_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'status',
      label: 'Статус',
      description: 'Статус бронирования',
      icon: 'IconStatusChange',
      isNullable: false,
      defaultValue: "'PLANNED'",
      options: [
        {
          id: '3775803d-2062-444a-8e7f-b6f6740fc351',
          value: 'PLANNED',
          label: 'Запланирована',
          position: 0,
          color: 'blue',
        },
        {
          id: '64b3adf2-4346-44a8-a7ac-d275eb539043',
          value: 'CONFIRMED',
          label: 'Подтверждена',
          position: 1,
          color: 'green',
        },
        {
          id: '27ee7283-586d-4eb2-9818-1d341d25dc20',
          value: 'COMPLETED',
          label: 'Завершена',
          position: 2,
          color: 'violet',
        },
        {
          id: 'd276e93e-98ee-4c49-9275-935bb9ddacea',
          value: 'CANCELLED',
          label: 'Отменена',
          position: 3,
          color: 'red',
        },
        {
          id: '28c078fb-e34a-462e-a837-6fd9cf120b25',
          value: 'NO_SHOW',
          label: 'Не пришёл',
          position: 4,
          color: 'orange',
        },
      ],
    },
    {
      universalIdentifier: RESERVATION_ZONE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'zone',
      label: 'Зона',
      description: 'Зона ресторана для бронирования',
      icon: 'IconMap',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier: RESERVATION_TABLE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'table',
      label: 'Столик',
      description: 'Номер или имя столика',
      icon: 'IconArmchair',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier: RESERVATION_SOURCE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'source',
      label: 'Источник',
      description: 'Канал создания бронирования',
      icon: 'IconSourceCode',
      isNullable: true,
      defaultValue: null,
      options: [
        {
          id: '5e74d1f3-ffac-40a9-880e-c19dabeffcd8',
          value: 'MANUAL',
          label: 'Вручную',
          position: 0,
          color: 'gray',
        },
        {
          id: 'ea13b922-39e9-4a91-8735-c20441e66cc3',
          value: 'POS',
          label: 'POS',
          position: 1,
          color: 'blue',
        },
        {
          id: '04588a99-5e57-4d54-9614-ee4a303d89b0',
          value: 'IMPORT',
          label: 'Импорт',
          position: 2,
          color: 'green',
        },
        {
          id: 'c4f8994d-12a3-4c3c-92d4-eb3cec441e26',
          value: 'API',
          label: 'API',
          position: 3,
          color: 'cyan',
        },
        {
          id: 'b5d607c6-c2f8-40e7-ac4f-33731372f2bc',
          value: 'OTHER',
          label: 'Другое',
          position: 4,
          color: 'orange',
        },
      ],
    },
    {
      universalIdentifier: RESERVATION_NOTES_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'notes',
      label: 'Заметки',
      description: 'Комментарий к бронированию',
      icon: 'IconNotes',
      isNullable: true,
      defaultValue: null,
      universalSettings: {
        displayedMaxRows: 4,
      },
    },
    {
      universalIdentifier: RESERVATION_GUEST_NAME_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'guestName',
      label: 'Имя гостя',
      description: 'Имя для бронирования, если гость ещё не связан с клиентом',
      icon: 'IconUser',
      isNullable: true,
      defaultValue: null,
    },
  ],
});
