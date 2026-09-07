import { defineObject, FieldType, NumberDataType } from 'twenty-sdk/define';

export const RUNTIME_STATE_ID = '466df2e8-2805-47a4-a094-0239b4885bd9';
export const RUNTIME_STATE_KEY_ID = '0ad5cf87-5cae-4d10-93a2-f84929dfd26c';

export default defineObject({
  universalIdentifier: RUNTIME_STATE_ID,
  nameSingular: 'mahabbatRuntimeState', namePlural: 'mahabbatRuntimeStates',
  labelSingular: 'Служебное состояние', labelPlural: 'Служебные состояния',
  description: 'Server-only durable login budget, receipt manifests and recovery cursors',
  icon: 'IconLock', isSearchable: false, isUIEditable: false, isUICreatable: false,
  labelIdentifierFieldMetadataUniversalIdentifier: RUNTIME_STATE_KEY_ID,
  fields: [
    { universalIdentifier: RUNTIME_STATE_KEY_ID, type: FieldType.TEXT, name: 'stateKey', label: 'Ключ', icon: 'IconKey', isNullable: false, isUIEditable: false, defaultValue: "''" },
    { universalIdentifier: '706551db-7073-40a4-86a5-ea819d7e8282', type: FieldType.TEXT, name: 'value', label: 'Значение', icon: 'IconCode', isNullable: false, isUIEditable: false, defaultValue: "'{}'" },
    { universalIdentifier: '8aea9b00-8f50-47c1-be3b-d504bdcc6121', type: FieldType.NUMBER, name: 'version', label: 'Версия', icon: 'IconVersions', isNullable: false, isUIEditable: false, defaultValue: 0, universalSettings: { dataType: NumberDataType.INT } },
  ],
});
