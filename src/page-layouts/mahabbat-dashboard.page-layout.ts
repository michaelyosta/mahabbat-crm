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
  ORDER_ITEM_QUANTITY_FIELD_UNIVERSAL_IDENTIFIER,
  ORDER_ITEM_UNIVERSAL_IDENTIFIER,
} from 'src/objects/order-item.object';
import {
  RESERVATION_GUEST_NAME_FIELD_UNIVERSAL_IDENTIFIER,
  RESERVATION_UNIVERSAL_IDENTIFIER,
} from 'src/objects/reservation.object';
import {
  SALES_SNAPSHOT_LINE_PERIOD_START_FIELD_UNIVERSAL_IDENTIFIER,
  SALES_SNAPSHOT_LINE_RAW_ITEM_NAME_FIELD_UNIVERSAL_IDENTIFIER,
  SALES_SNAPSHOT_LINE_REVENUE_FIELD_UNIVERSAL_IDENTIFIER,
  SALES_SNAPSHOT_LINE_UNIVERSAL_IDENTIFIER,
} from 'src/objects/sales-snapshot-line.object';
import { ORDERS_VIEW_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { UPCOMING_RESERVATIONS_VIEW_UNIVERSAL_IDENTIFIER } from 'src/views/upcoming-reservations.view';

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

const DASHBOARD_HERO_BLOCKNOTE = JSON.stringify([
  {
    type: 'heading',
    props: {
      level: 1,
      textColor: 'default',
      backgroundColor: 'default',
      textAlignment: 'left',
    },
    content: [
      {
        type: 'text',
        text: 'Добро пожаловать в Mahabbat',
        styles: {},
      },
    ],
    children: [],
  },
  {
    type: 'paragraph',
    props: {
      textColor: 'default',
      backgroundColor: 'default',
      textAlignment: 'left',
    },
    content: [
      {
        type: 'text',
        text: 'Рабочий обзор ресторана: заказы, выручка, бронирования и статусы на одном экране.',
        styles: {},
      },
    ],
    children: [],
  },
  {
    type: 'paragraph',
    props: {
      textColor: 'default',
      backgroundColor: 'default',
      textAlignment: 'left',
    },
    content: [
      {
        type: 'text',
        text: 'Начните с последних заказов или проверьте ближайшие бронирования.',
        styles: { bold: true },
      },
    ],
    children: [],
  },
]);

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
          universalIdentifier: 'd548aa2d-d53c-498a-8250-5a6fe9b6c592',
          title: 'Операционный обзор',
          type: 'STANDALONE_RICH_TEXT',
          gridPosition: { row: 0, column: 0, rowSpan: 2, columnSpan: 12 },
          configuration: {
            configurationType: 'STANDALONE_RICH_TEXT',
            body: {
              blocknote: DASHBOARD_HERO_BLOCKNOTE,
              markdown: null,
            },
          },
        },
        {
          universalIdentifier: 'f8a7d6c5-b4e3-42f1-9087-6a5b4c3d2e12',
          title: 'Операционные заказы',
          type: 'GRAPH',
          objectUniversalIdentifier: ORDER_UNIVERSAL_IDENTIFIER,
          gridPosition: { row: 2, column: 0, rowSpan: 2, columnSpan: 3 },
          configuration: {
            configurationType: 'AGGREGATE_CHART',
            aggregateFieldMetadataUniversalIdentifier:
              ORDER_TOTAL_FIELD_UNIVERSAL_IDENTIFIER,
            aggregateOperation: AggregateOperations.COUNT,
            displayDataLabel: true,
            timezone: 'UTC',
            firstDayOfTheWeek: 1,
          },
        },
        {
          universalIdentifier: 'f8a7d6c5-b4e3-42f1-9087-6a5b4c3d2e13',
          title: 'Проданные позиции',
          type: 'GRAPH',
          objectUniversalIdentifier: ORDER_ITEM_UNIVERSAL_IDENTIFIER,
          gridPosition: { row: 2, column: 3, rowSpan: 2, columnSpan: 3 },
          configuration: {
            configurationType: 'AGGREGATE_CHART',
            aggregateFieldMetadataUniversalIdentifier:
              ORDER_ITEM_QUANTITY_FIELD_UNIVERSAL_IDENTIFIER,
            aggregateOperation: AggregateOperations.SUM,
            displayDataLabel: true,
            timezone: 'UTC',
            firstDayOfTheWeek: 1,
          },
        },
        {
          universalIdentifier: 'f8a7d6c5-b4e3-42f1-9087-6a5b4c3d2e14',
          title: 'Выручка по заказам',
          type: 'GRAPH',
          objectUniversalIdentifier: ORDER_UNIVERSAL_IDENTIFIER,
          gridPosition: { row: 2, column: 6, rowSpan: 2, columnSpan: 3 },
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
          universalIdentifier: '212bd711-bc41-4927-9e9a-b09e654236ce',
          title: 'Брони впереди',
          type: 'GRAPH',
          objectUniversalIdentifier: RESERVATION_UNIVERSAL_IDENTIFIER,
          gridPosition: { row: 2, column: 9, rowSpan: 2, columnSpan: 3 },
          configuration: {
            configurationType: 'AGGREGATE_CHART',
            aggregateFieldMetadataUniversalIdentifier:
              RESERVATION_GUEST_NAME_FIELD_UNIVERSAL_IDENTIFIER,
            aggregateOperation: AggregateOperations.COUNT,
            displayDataLabel: true,
            timezone: 'UTC',
            firstDayOfTheWeek: 1,
          },
        },
        {
          universalIdentifier: '92e9ff41-cd67-43db-bd1e-e7dfa7d8d1b0',
          title: 'Последние заказы',
          type: 'RECORD_TABLE',
          objectUniversalIdentifier: ORDER_UNIVERSAL_IDENTIFIER,
          gridPosition: { row: 4, column: 0, rowSpan: 5, columnSpan: 6 },
          configuration: {
            configurationType: 'RECORD_TABLE',
            viewUniversalIdentifier: ORDERS_VIEW_UNIVERSAL_IDENTIFIER,
            recordLimit: 5,
          },
        },
        {
          universalIdentifier: '013be874-7038-4509-b701-4f9778229817',
          title: 'Ближайшие бронирования',
          type: 'RECORD_TABLE',
          objectUniversalIdentifier: RESERVATION_UNIVERSAL_IDENTIFIER,
          gridPosition: { row: 4, column: 6, rowSpan: 5, columnSpan: 6 },
          configuration: {
            configurationType: 'RECORD_TABLE',
            viewUniversalIdentifier:
              UPCOMING_RESERVATIONS_VIEW_UNIVERSAL_IDENTIFIER,
            recordLimit: 5,
          },
        },
        {
          universalIdentifier: 'f8a7d6c5-b4e3-42f1-9087-6a5b4c3d2e15',
          title: 'Топ позиций по выручке',
          type: 'GRAPH',
          objectUniversalIdentifier: SALES_SNAPSHOT_LINE_UNIVERSAL_IDENTIFIER,
          gridPosition: { row: 14, column: 0, rowSpan: 5, columnSpan: 6 },
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
          gridPosition: { row: 14, column: 6, rowSpan: 5, columnSpan: 6 },
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
          gridPosition: { row: 9, column: 0, rowSpan: 5, columnSpan: 6 },
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
