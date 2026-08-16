import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

export const CUSTOMER_SOURCE_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER =
  '0d459ceb-c21d-4a3d-9144-a3a01fc763ee';

export default defineField({
  universalIdentifier: CUSTOMER_SOURCE_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.SELECT,
  name: 'customerSource',
  label: 'Источник клиента',
  description: 'Канал, из которого клиент пришёл в ресторан',
  icon: 'IconUserPlus',
  isNullable: true,
  defaultValue: null,
  options: [
    {
      id: 'c51a5c9c-5342-4330-8932-6dc3c93361be',
      value: 'WEBSITE',
      label: 'Сайт',
      position: 0,
      color: 'blue',
    },
    {
      id: '91f77140-2cc5-4f25-9218-23db3b5c852c',
      value: 'INSTAGRAM',
      label: 'Instagram',
      position: 1,
      color: 'pink',
    },
    {
      id: '37189398-7880-47d8-95b5-c7984cc33a02',
      value: 'WHATSAPP',
      label: 'WhatsApp',
      position: 2,
      color: 'green',
    },
    {
      id: '8308c879-3215-47b7-9796-dc2d14806f81',
      value: 'PHONE',
      label: 'Звонок',
      position: 3,
      color: 'cyan',
    },
    {
      id: '54c3eae1-0b87-4a08-995e-3975daecf841',
      value: 'RECOMMENDATION',
      label: 'Рекомендация',
      position: 4,
      color: 'violet',
    },
    {
      id: '4c70b711-3dfe-482e-b431-c28c572d7df3',
      value: 'WALK_IN',
      label: 'Пришёл в ресторан',
      position: 5,
      color: 'orange',
    },
    {
      id: '394f55b9-ce9a-46fb-96d3-93a007212775',
      value: 'PARTNER',
      label: 'Партнёр',
      position: 6,
      color: 'yellow',
    },
    {
      id: '0aee2e85-9d86-4402-a1da-56373aaddcde',
      value: 'OTHER',
      label: 'Другое',
      position: 7,
      color: 'gray',
    },
  ],
});
