import { defineObject, FieldType, NumberDataType, OnDeleteAction, RelationType } from 'twenty-sdk/define';

export const POS_KITCHEN_TICKET_LINE_UNIVERSAL_IDENTIFIER =
  '8d2b3f45-6c78-4e90-9f12-3456789abcde';
export const POS_KITCHEN_TICKET_LINE_TICKET_FIELD_UNIVERSAL_IDENTIFIER =
  '8d2b3f45-6c78-4e90-9f12-3456789abcdf';
export const POS_KITCHEN_TICKET_LINE_ORDER_LINE_FIELD_UNIVERSAL_IDENTIFIER =
  '8d2b3f45-6c78-4e90-9f12-3456789abce0';
export const POS_KITCHEN_TICKET_LINE_GUEST_FIELD_UNIVERSAL_IDENTIFIER =
  '8d2b3f45-6c78-4e90-9f12-3456789abce1';
export const POS_KITCHEN_TICKET_LINE_GUEST_DISPLAY_NUMBER_FIELD_UNIVERSAL_IDENTIFIER =
  '8d2b3f45-6c78-4e90-9f12-3456789abce2';
export const POS_KITCHEN_TICKET_LINE_ITEM_NAME_SNAPSHOT_FIELD_UNIVERSAL_IDENTIFIER =
  '8d2b3f45-6c78-4e90-9f12-3456789abce3';
export const POS_KITCHEN_TICKET_LINE_QUANTITY_FIELD_UNIVERSAL_IDENTIFIER =
  '8d2b3f45-6c78-4e90-9f12-3456789abce4';
export const POS_KITCHEN_TICKET_LINE_ACTION_FIELD_UNIVERSAL_IDENTIFIER =
  '8d2b3f45-6c78-4e90-9f12-3456789abce5';
export const POS_KITCHEN_TICKET_LINE_PRODUCTION_STATION_FIELD_UNIVERSAL_IDENTIFIER =
  '8d2b3f45-6c78-4e90-9f12-3456789abce9';
export const POS_KITCHEN_TICKET_LINE_STATION_NAME_SNAPSHOT_FIELD_UNIVERSAL_IDENTIFIER =
  '8d2b3f45-6c78-4e90-9f12-3456789abcea';
export const POS_KITCHEN_TICKET_LINE_UNIQUE_TICKET_ORDER_LINE_INDEX_UNIVERSAL_IDENTIFIER =
  '8d2b3f45-6c78-4e90-9f12-3456789abce6';

export default defineObject({
  universalIdentifier: POS_KITCHEN_TICKET_LINE_UNIVERSAL_IDENTIFIER,
  nameSingular: 'posKitchenTicketLine',
  namePlural: 'posKitchenTicketLines',
  labelSingular: 'Позиция кухонной фиши',
  labelPlural: 'Позиции кухонных фиш',
  description: 'Immutable snapshot позиции, отправленной на кухню',
  icon: 'IconList',
  labelIdentifierFieldMetadataUniversalIdentifier:
    POS_KITCHEN_TICKET_LINE_ITEM_NAME_SNAPSHOT_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: POS_KITCHEN_TICKET_LINE_TICKET_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'ticket',
      label: 'Кухонная фиша',
      description: 'Родительская кухонная фиша',
      icon: 'IconChefHat',
      relationTargetObjectMetadataUniversalIdentifier:
        '7c1a2f34-5b67-4d89-8e01-23456789abcd',
      relationTargetFieldMetadataUniversalIdentifier:
        '7c1a2f34-5b67-4d89-8e01-23456789abd6',
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.RESTRICT,
        joinColumnName: 'ticketId',
      },
    },
    {
      universalIdentifier:
        POS_KITCHEN_TICKET_LINE_ORDER_LINE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'orderLine',
      label: 'Позиция заказа',
      description: 'Исходная позиция заказа',
      icon: 'IconList',
      relationTargetObjectMetadataUniversalIdentifier:
        'e526ebd1-bc93-42eb-91c7-59430a781d7f',
      relationTargetFieldMetadataUniversalIdentifier:
        'f4a8c6d2-9b10-4e73-8c21-5d6f7a8b9c01',
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.RESTRICT,
        joinColumnName: 'orderLineId',
      },
    },
    {
      universalIdentifier: POS_KITCHEN_TICKET_LINE_GUEST_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'guest',
      label: 'Гость',
      description: 'Гость из исходного заказа',
      icon: 'IconUser',
      relationTargetObjectMetadataUniversalIdentifier:
        '18c37988-f756-4ef0-bf40-75183a7584a9',
      relationTargetFieldMetadataUniversalIdentifier:
        'd8f6b2a4-7c1e-4d90-8f23-6a5b7c8d9e02',
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.RESTRICT,
        joinColumnName: 'guestId',
      },
    },
    {
      universalIdentifier:
        POS_KITCHEN_TICKET_LINE_GUEST_DISPLAY_NUMBER_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'guestDisplayNumber',
      label: 'Номер гостя',
      description: 'Снапшот отображаемого номера гостя',
      icon: 'IconUser',
      isNullable: true,
      defaultValue: null,
      isUIEditable: false,
    },
    {
      universalIdentifier:
        POS_KITCHEN_TICKET_LINE_ITEM_NAME_SNAPSHOT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'itemNameSnapshot',
      label: 'Название позиции',
      description: 'Снапшот названия меню для печати',
      icon: 'IconTag',
      isNullable: false,
      defaultValue: "''",
      isUIEditable: false,
    },
    {
      universalIdentifier: POS_KITCHEN_TICKET_LINE_QUANTITY_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'quantity',
      label: 'Количество',
      description: 'Количество, отправленное этой фишей',
      icon: 'IconNumber',
      isNullable: false,
      defaultValue: 1,
      isUIEditable: false,
      universalSettings: { dataType: NumberDataType.INT },
    },
    {
      universalIdentifier: POS_KITCHEN_TICKET_LINE_ACTION_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'action',
      label: 'Действие',
      description: 'Действие кухни для строки',
      icon: 'IconArrowsExchange',
      isNullable: false,
      defaultValue: "'ADD'",
      isUIEditable: false,
      options: [
        {
          id: '8d2b3f45-6c78-4e90-9f12-3456789abce7',
          value: 'ADD',
          label: 'Приготовить',
          position: 0,
          color: 'green',
        },
        {
          id: '8d2b3f45-6c78-4e90-9f12-3456789abce8',
          value: 'CANCEL',
          label: 'Не готовить',
          position: 1,
          color: 'red',
        },
      ],
    },
    {
      universalIdentifier: POS_KITCHEN_TICKET_LINE_PRODUCTION_STATION_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'productionStation',
      label: 'Станция',
      description: 'Снапшот логической станции для повторной печати',
      icon: 'IconToolsKitchen2',
      relationTargetObjectMetadataUniversalIdentifier:
        'b2f1d5e9-6a83-4c04-ab72-3e8f9d1c5b22',
      relationTargetFieldMetadataUniversalIdentifier:
        'b2f1d5e9-6a83-4c04-ab72-3e8f9d1c5b2a',
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.SET_NULL,
        joinColumnName: 'productionStationId',
      },
    },
    {
      universalIdentifier: POS_KITCHEN_TICKET_LINE_STATION_NAME_SNAPSHOT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'stationNameSnapshot',
      label: 'Станция snapshot',
      description: 'Название станции на момент создания документа',
      icon: 'IconTag',
      isNullable: true,
      defaultValue: null,
      isUIEditable: false,
    },
  ],
});
