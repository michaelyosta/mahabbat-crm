import {
  AggregateOperations,
  definePageLayout,
  PageLayoutTabLayoutMode,
} from 'twenty-sdk/define';

import {
  ORDER_STATUS_FIELD_UNIVERSAL_IDENTIFIER,
  ORDER_TOTAL_FIELD_UNIVERSAL_IDENTIFIER,
  ORDER_UNIVERSAL_IDENTIFIER,
} from 'src/objects/order.object';
import {
  SALES_SNAPSHOT_LINE_PERIOD_START_FIELD_UNIVERSAL_IDENTIFIER,
  SALES_SNAPSHOT_LINE_QUANTITY_FIELD_UNIVERSAL_IDENTIFIER,
  SALES_SNAPSHOT_LINE_RAW_ITEM_NAME_FIELD_UNIVERSAL_IDENTIFIER,
  SALES_SNAPSHOT_LINE_REVENUE_FIELD_UNIVERSAL_IDENTIFIER,
  SALES_SNAPSHOT_LINE_UNIVERSAL_IDENTIFIER,
} from 'src/objects/sales-snapshot-line.object';

export const MAHABBAT_DASHBOARD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER =
  'f8a7d6c5-b4e3-42f1-9087-6a5b4c3d2e10';

const BAR_CHART_DEFAULTS = {
  layout: 'VERTICAL',
  primaryAxisOrderBy: 'VALUE_DESC',
  axisNameDisplay: 'NONE',
  color: 'auto',
  timezone: 'UTC',
  firstDayOfTheWeek: 1,
} as const;

export default definePageLayout({
  universalIdentifier: MAHABBAT_DASHBOARD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  name: 'Главная Mahabbat CRM',
  type: 'STANDALONE_PAGE',
  tabs: [
    {
      universalIdentifier: 'f8a7d6c5-b4e3-42f1-9087-6a5b4c3d2e11',
      title: 'Обзор',
      position: 0,
      icon: 'IconChartBar',
      layoutMode: PageLayoutTabLayoutMode.GRID,
      widgets: [
        {
          universalIdentifier: 'f8a7d6c5-b4e3-42f1-9087-6a5b4c3d2e12',
          title: 'Выручка по историческим продажам',
          type: 'GRAPH',
          objectUniversalIdentifier: SALES_SNAPSHOT_LINE_UNIVERSAL_IDENTIFIER,
          gridPosition: { row: 0, column: 0, rowSpan: 2, columnSpan: 3 },
          configuration: {
            configurationType: 'AGGREGATE_CHART',
            aggregateFieldMetadataUniversalIdentifier:
              SALES_SNAPSHOT_LINE_REVENUE_FIELD_UNIVERSAL_IDENTIFIER,
            aggregateOperation: AggregateOperations.SUM,
            displayDataLabel: true,
            timezone: 'UTC',
            firstDayOfTheWeek: 1,
          },
        },
        {
          universalIdentifier: 'f8a7d6c5-b4e3-42f1-9087-6a5b4c3d2e13',
          title: 'Количество проданных позиций',
          type: 'GRAPH',
          objectUniversalIdentifier: SALES_SNAPSHOT_LINE_UNIVERSAL_IDENTIFIER,
          gridPosition: { row: 0, column: 3, rowSpan: 2, columnSpan: 3 },
          configuration: {
            configurationType: 'AGGREGATE_CHART',
            aggregateFieldMetadataUniversalIdentifier:
              SALES_SNAPSHOT_LINE_QUANTITY_FIELD_UNIVERSAL_IDENTIFIER,
            aggregateOperation: AggregateOperations.SUM,
            displayDataLabel: true,
            timezone: 'UTC',
            firstDayOfTheWeek: 1,
          },
        },
        {
          universalIdentifier: 'f8a7d6c5-b4e3-42f1-9087-6a5b4c3d2e14',
          title: 'Выручка по операционным заказам',
          type: 'GRAPH',
          objectUniversalIdentifier: ORDER_UNIVERSAL_IDENTIFIER,
          gridPosition: { row: 0, column: 6, rowSpan: 2, columnSpan: 3 },
          configuration: {
            configurationType: 'AGGREGATE_CHART',
            aggregateFieldMetadataUniversalIdentifier:
              ORDER_TOTAL_FIELD_UNIVERSAL_IDENTIFIER,
            aggregateOperation: AggregateOperations.SUM,
            displayDataLabel: true,
            timezone: 'UTC',
            firstDayOfTheWeek: 1,
          },
        },
        {
          universalIdentifier: 'f8a7d6c5-b4e3-42f1-9087-6a5b4c3d2e15',
          title: 'Топ позиций по выручке',
          type: 'GRAPH',
          objectUniversalIdentifier: SALES_SNAPSHOT_LINE_UNIVERSAL_IDENTIFIER,
          gridPosition: { row: 2, column: 0, rowSpan: 5, columnSpan: 6 },
          configuration: {
            configurationType: 'BAR_CHART',
            aggregateFieldMetadataUniversalIdentifier:
              SALES_SNAPSHOT_LINE_REVENUE_FIELD_UNIVERSAL_IDENTIFIER,
            aggregateOperation: AggregateOperations.SUM,
            primaryAxisGroupByFieldMetadataUniversalIdentifier:
              SALES_SNAPSHOT_LINE_RAW_ITEM_NAME_FIELD_UNIVERSAL_IDENTIFIER,
            ...BAR_CHART_DEFAULTS,
          },
        },
        {
          universalIdentifier: 'f8a7d6c5-b4e3-42f1-9087-6a5b4c3d2e16',
          title: 'Историческая выручка по месяцам',
          type: 'GRAPH',
          objectUniversalIdentifier: SALES_SNAPSHOT_LINE_UNIVERSAL_IDENTIFIER,
          gridPosition: { row: 2, column: 6, rowSpan: 5, columnSpan: 6 },
          configuration: {
            configurationType: 'BAR_CHART',
            aggregateFieldMetadataUniversalIdentifier:
              SALES_SNAPSHOT_LINE_REVENUE_FIELD_UNIVERSAL_IDENTIFIER,
            aggregateOperation: AggregateOperations.SUM,
            primaryAxisGroupByFieldMetadataUniversalIdentifier:
              SALES_SNAPSHOT_LINE_PERIOD_START_FIELD_UNIVERSAL_IDENTIFIER,
            ...BAR_CHART_DEFAULTS,
          },
        },
        {
          universalIdentifier: 'f8a7d6c5-b4e3-42f1-9087-6a5b4c3d2e17',
          title: 'Заказы по статусу',
          type: 'GRAPH',
          objectUniversalIdentifier: ORDER_UNIVERSAL_IDENTIFIER,
          gridPosition: { row: 7, column: 0, rowSpan: 5, columnSpan: 6 },
          configuration: {
            configurationType: 'PIE_CHART',
            aggregateFieldMetadataUniversalIdentifier:
              ORDER_TOTAL_FIELD_UNIVERSAL_IDENTIFIER,
            aggregateOperation: AggregateOperations.COUNT,
            groupByFieldMetadataUniversalIdentifier:
              ORDER_STATUS_FIELD_UNIVERSAL_IDENTIFIER,
            displayLegend: true,
            timezone: 'UTC',
            firstDayOfTheWeek: 1,
          },
        },
      ],
    },
  ],
});
