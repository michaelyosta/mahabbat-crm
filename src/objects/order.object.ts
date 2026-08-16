import {
  defineObject,
  FieldType,
  OnDeleteAction,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

export const ORDER_UNIVERSAL_IDENTIFIER =
  '1640fcc5-d992-40a5-acd2-37e98161e6db';
export const ORDER_CUSTOMER_RELATION_FIELD_UNIVERSAL_IDENTIFIER =
  'fa31c021-1602-4a53-865a-deff3164f828';
export const ORDER_ORDERS_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER =
  'b77ddfff-673e-462a-ba6e-4b9072e9e7c7';
export const ORDER_EXTERNAL_ID_FIELD_UNIVERSAL_IDENTIFIER =
  'fdf45876-f01c-4f4d-8129-46a19c9242ae';
export const ORDER_PROVIDER_FIELD_UNIVERSAL_IDENTIFIER =
  '2947b4e7-16dd-41f5-a545-e5478f0c62ee';
export const ORDER_SOURCE_FIELD_UNIVERSAL_IDENTIFIER =
  '14188a81-47ea-4f50-8072-fe2324659a94';
export const ORDER_CHANNEL_FIELD_UNIVERSAL_IDENTIFIER =
  'd06144a3-7cc5-4f17-91a2-a357448aa9cd';
export const ORDER_STATUS_FIELD_UNIVERSAL_IDENTIFIER =
  'f5eab990-ca50-48b6-b2de-b5ea3dffbb08';
export const ORDER_ORDERED_AT_FIELD_UNIVERSAL_IDENTIFIER =
  '107750de-74be-42c3-bef0-71228612aade';
export const ORDER_SUBTOTAL_FIELD_UNIVERSAL_IDENTIFIER =
  '16ab46db-bb4d-44a4-ab84-bd7ae21d1195';
export const ORDER_DISCOUNT_FIELD_UNIVERSAL_IDENTIFIER =
  'b09751c5-73f1-4e7a-a7f6-7c74391c588e';
export const ORDER_TOTAL_FIELD_UNIVERSAL_IDENTIFIER =
  '3051786b-15c0-4e1c-9012-81459169c37b';
export const ORDER_NOTES_FIELD_UNIVERSAL_IDENTIFIER =
  '18270591-3d0b-44ab-9cc3-38d3e4c12c4d';
export const ORDER_ITEMS_ON_ORDER_FIELD_UNIVERSAL_IDENTIFIER =
  '9ebf16fb-ddfe-4f38-8a3c-6186221d4b6b';
export const ORDER_LOYALTY_ENTRIES_ON_ORDER_FIELD_UNIVERSAL_IDENTIFIER =
  'e65549f4-84db-4c25-a98a-0f1aafd6688f';
export const ORDER_UNIQUE_PROVIDER_EXTERNAL_ID_INDEX_UNIVERSAL_IDENTIFIER =
  'd6f86fb9-22a2-46fe-a50d-b0867239f7a4';

export default defineObject({
  universalIdentifier: ORDER_UNIVERSAL_IDENTIFIER,
  nameSingular: 'order',
  namePlural: 'orders',
  labelSingular: 'Заказ',
  labelPlural: 'Заказы',
  description: 'Заказ гостя ресторана',
  icon: 'IconShoppingCart',
  isSearchable: true,
  labelIdentifierFieldMetadataUniversalIdentifier:
    ORDER_EXTERNAL_ID_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: ORDER_CUSTOMER_RELATION_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'customer',
      label: 'Клиент',
      description: 'Клиент, оформивший заказ',
      icon: 'IconUser',
      relationTargetObjectMetadataUniversalIdentifier:
        STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
      relationTargetFieldMetadataUniversalIdentifier:
        ORDER_ORDERS_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.RESTRICT,
        joinColumnName: 'customerId',
      },
    },
    {
      universalIdentifier: ORDER_EXTERNAL_ID_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'externalId',
      label: 'Номер заказа',
      description: 'Номер заказа в исходной системе',
      icon: 'IconId',
      isNullable: true,
      isUIEditable: false,
      defaultValue: null,
    },
    {
      universalIdentifier: ORDER_PROVIDER_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'provider',
      label: 'Канал загрузки',
      description: 'Канал, из которого получен заказ',
      icon: 'IconWorld',
      isNullable: true,
      isUIEditable: false,
      defaultValue: null,
      options: [
        {
          id: '05890d5f-e08a-44ae-b480-8c094fa3668f',
          value: 'MANUAL',
          label: 'Вручную',
          position: 0,
          color: 'gray',
        },
        {
          id: '0fbba80f-bcc0-42ef-9f34-b9d24370517e',
          value: 'POS',
          label: 'POS',
          position: 1,
          color: 'blue',
        },
        {
          id: 'f2608f4d-0dc4-4bd2-b2b1-c6e2bcb00dc0',
          value: 'IMPORT',
          label: 'Импорт',
          position: 2,
          color: 'green',
        },
        {
          id: 'd7b6a438-695f-4c3f-949d-7896a98dafde',
          value: 'API',
          label: 'API',
          position: 3,
          color: 'cyan',
        },
        {
          id: 'b423bc2e-a984-4c22-936f-13eef55df970',
          value: 'OTHER',
          label: 'Другое',
          position: 4,
          color: 'orange',
        },
      ],
    },
    {
      universalIdentifier: ORDER_SOURCE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'source',
      label: 'Примечание источника',
      description: 'Дополнительная отметка о происхождении заказа',
      icon: 'IconSourceCode',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier: ORDER_CHANNEL_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'channel',
      label: 'Канал',
      description: 'Способ получения заказа',
      icon: 'IconMapPin',
      isNullable: false,
      defaultValue: "'DINE_IN'",
      options: [
        {
          id: '2e8656a4-3dbc-4e52-a080-f091d20330fc',
          value: 'DINE_IN',
          label: 'В зале',
          position: 0,
          color: 'blue',
        },
        {
          id: '63c1084f-b920-4818-af7c-883c779aec4f',
          value: 'DELIVERY',
          label: 'Доставка',
          position: 1,
          color: 'green',
        },
        {
          id: '1713d2c5-ae03-450d-8497-7da83f650770',
          value: 'PICKUP',
          label: 'Самовывоз',
          position: 2,
          color: 'cyan',
        },
      ],
    },
    {
      universalIdentifier: ORDER_STATUS_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'status',
      label: 'Статус',
      description: 'Текущий статус заказа',
      icon: 'IconStatusChange',
      isNullable: false,
      defaultValue: "'PENDING'",
      options: [
        {
          id: 'e4552016-3449-4f40-bd9a-fa466a0672d1',
          value: 'PENDING',
          label: 'Ожидает',
          position: 0,
          color: 'gray',
        },
        {
          id: '82ab4362-f52e-4e63-b62b-a599dde8a4ea',
          value: 'CONFIRMED',
          label: 'Подтверждён',
          position: 1,
          color: 'blue',
        },
        {
          id: '0f25fb09-ccc6-4789-8dec-38a806a02624',
          value: 'PREPARING',
          label: 'Готовится',
          position: 2,
          color: 'yellow',
        },
        {
          id: '82f0360d-f130-42fa-84cb-57bfefe7318f',
          value: 'READY',
          label: 'Готов',
          position: 3,
          color: 'green',
        },
        {
          id: 'fb975003-71a6-430f-92da-71ebe94f9de1',
          value: 'COMPLETED',
          label: 'Завершён',
          position: 4,
          color: 'violet',
        },
        {
          id: 'a66efac9-f293-4964-bb76-a32166878b82',
          value: 'CANCELLED',
          label: 'Отменён',
          position: 5,
          color: 'red',
        },
        {
          id: '46731840-6a14-480c-85f0-eccd079d5917',
          value: 'REJECTED',
          label: 'Отклонён',
          position: 6,
          color: 'orange',
        },
      ],
    },
    {
      universalIdentifier: ORDER_ORDERED_AT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.DATE_TIME,
      name: 'orderedAt',
      label: 'Время заказа',
      description: 'Время создания заказа',
      icon: 'IconClock',
      isNullable: false,
      defaultValue: 'now',
    },
    {
      universalIdentifier: ORDER_SUBTOTAL_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.CURRENCY,
      name: 'subtotal',
      label: 'Подытог',
      description: 'Сумма позиций до скидок и доставки',
      icon: 'IconCalculator',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier: ORDER_DISCOUNT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.CURRENCY,
      name: 'discount',
      label: 'Скидка',
      description: 'Сумма скидки на заказ',
      icon: 'IconDiscount',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier: ORDER_TOTAL_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.CURRENCY,
      name: 'total',
      label: 'Итог',
      description: 'Итоговая сумма заказа',
      icon: 'IconCash',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier: ORDER_NOTES_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'notes',
      label: 'Заметки',
      description: 'Комментарий к заказу',
      icon: 'IconNotes',
      isNullable: true,
      defaultValue: null,
      universalSettings: {
        displayedMaxRows: 4,
      },
    },
    {
      universalIdentifier: ORDER_ITEMS_ON_ORDER_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'items',
      label: 'Позиции',
      description: 'Позиции заказа',
      icon: 'IconList',
      relationTargetObjectMetadataUniversalIdentifier:
        'be60c91b-3de6-4630-b6a7-0861caedb554',
      relationTargetFieldMetadataUniversalIdentifier:
        '3d92993a-f3d1-4661-97a7-4343576638b4',
      universalSettings: {
        relationType: RelationType.ONE_TO_MANY,
      },
    },
    {
      universalIdentifier: ORDER_LOYALTY_ENTRIES_ON_ORDER_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'loyaltyEntries',
      label: 'История бонусов',
      description: 'Операции бонусной программы, связанные с заказом',
      icon: 'IconCards',
      relationTargetObjectMetadataUniversalIdentifier:
        'ce455a03-74bd-460f-863b-4da2f2138979',
      relationTargetFieldMetadataUniversalIdentifier:
        '0f419655-5bf8-48be-a170-6075f3625414',
      universalSettings: {
        relationType: RelationType.ONE_TO_MANY,
      },
    },
  ],
});
