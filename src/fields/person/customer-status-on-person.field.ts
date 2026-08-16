import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

export const CUSTOMER_STATUS_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER =
  '025de8b5-44c4-4591-b714-18d10e7d93d4';

export default defineField({
  universalIdentifier: CUSTOMER_STATUS_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.SELECT,
  name: 'customerStatus',
  label: 'Статус клиента',
  description: 'Текущий статус гостя как клиента ресторана',
  icon: 'IconUserStar',
  isNullable: false,
  defaultValue: "'NEW'",
  options: [
    {
      id: 'd04db9d7-d346-4e1d-809a-4cad9dde5bd5',
      value: 'NEW',
      label: 'Новый',
      position: 0,
      color: 'blue',
    },
    {
      id: '44448e85-5ebd-4ff8-a9d0-9e6eb104798f',
      value: 'ACTIVE',
      label: 'Активный',
      position: 1,
      color: 'green',
    },
    {
      id: '578dd4fb-1829-4331-9140-b7ffd5ca35b2',
      value: 'VIP',
      label: 'VIP',
      position: 2,
      color: 'violet',
    },
    {
      id: '47f3d8b0-502f-4532-8f65-7b0c8417d067',
      value: 'INACTIVE',
      label: 'Неактивный',
      position: 3,
      color: 'gray',
    },
    {
      id: 'b850aef1-abfa-4bb9-9d28-a12f5e03fd2b',
      value: 'BLOCKED',
      label: 'Заблокирован',
      position: 4,
      color: 'red',
    },
  ],
});
