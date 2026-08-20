import { useCallback, useEffect, useMemo, useState } from 'react';
import { RestApiClient } from 'twenty-client-sdk/rest';
import { defineFrontComponent } from 'twenty-sdk/define';

import { MAHABBAT_INVENTORY_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

const rest = new RestApiClient();

type Tab = 'balances' | 'receipt' | 'production' | 'transfer' | 'writeoff' | 'counts' | 'recipes' | 'history';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'balances', label: 'Остатки' },
  { id: 'receipt', label: 'Приход' },
  { id: 'production', label: 'Производство' },
  { id: 'transfer', label: 'Перемещение' },
  { id: 'writeoff', label: 'Списание' },
  { id: 'counts', label: 'Ревизии' },
  { id: 'recipes', label: 'Калькуляции' },
  { id: 'history', label: 'История' },
];

const InventoryFrontComponent = () => {
  const [tab, setTab] = useState<Tab>('balances');
  const [balances, setBalances] = useState<Record<string, unknown>[]>([]);
  const [movements, setMovements] = useState<Record<string, unknown>[]>([]);
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [locations, setLocations] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [b, m, it, loc] = await Promise.all([
        rest.get('/rest/inventoryStockBalances', { query: { limit: 100 } }).catch(() => ({ data: [] })),
        rest.get('/rest/inventoryStockMovements', { query: { limit: 100 } }).catch(() => ({ data: [] })),
        rest.get('/rest/inventoryStockItems', { query: { limit: 100 } }).catch(() => ({ data: [] })),
        rest.get('/rest/inventoryStockLocations', { query: { limit: 100 } }).catch(() => ({ data: [] })),
      ]);
      const asArray = (v: unknown): Record<string, unknown>[] => {
        if (Array.isArray(v)) return v as Record<string, unknown>[];
        if (typeof v === 'object' && v !== null && 'data' in (v as Record<string, unknown>)) {
          const d = (v as { data?: unknown }).data;
          if (Array.isArray(d)) return d as Record<string, unknown>[];
          if (d && typeof d === 'object' && 'data' in (d as Record<string, unknown>)) {
            const inner = (d as { data?: unknown }).data;
            if (Array.isArray(inner)) return inner as Record<string, unknown>[];
          }
        }
        // RestApiClient returns { data: [...] } or { inventoryStockBalances: { edges: [...] } } depending on endpoint?
        // fallback: try to extract edges
        if (typeof v === 'object' && v !== null) {
          const keys = Object.keys(v as Record<string, unknown>);
          for (const k of keys) {
            const val = (v as Record<string, unknown>)[k] as unknown;
            if (val && typeof val === 'object' && 'edges' in (val as Record<string, unknown>)) {
              const edges = (val as { edges?: Array<{ node?: Record<string, unknown> }> }).edges ?? [];
              return edges.map(e => e.node).filter(Boolean) as Record<string, unknown>[];
            }
          }
        }
        return [];
      };
      setBalances(asArray(b));
      setMovements(asArray(m));
      setItems(asArray(it));
      setLocations(asArray(loc));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const itemName = useCallback((id: string) => {
    const it = items.find(r => String(r['id']) === id);
    return String(it?.['name'] ?? id.slice(0, 8));
  }, [items]);

  const locName = useCallback((id: string) => {
    const l = locations.find(r => String(r['id']) === id);
    return String(l?.['name'] ?? id.slice(0, 8));
  }, [locations]);

  const aggregated = useMemo(() => {
    const map = new Map<string, { itemId: string; total: number }>();
    for (const b of balances) {
      const itemId = String(b['stockItemId'] ?? '');
      const qty = Number(b['quantityMicros'] ?? 0);
      const entry = map.get(itemId) ?? { itemId, total: 0 };
      entry.total += qty;
      map.set(itemId, entry);
    }
    return Array.from(map.values());
  }, [balances]);

  return (
    <div style={{ padding: 16, fontFamily: 'Inter, system-ui, sans-serif', color: '#111827' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Склад</h1>
      <p style={{ color: '#6b7280', marginBottom: 12 }}>Операционный inventory: остатки по точкам, приход, производство, перемещения, ревизии и калькуляции. Ledger — источник истины.</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: tab === t.id ? '2px solid #111827' : '1px solid #e5e7eb',
              background: tab === t.id ? '#111827' : '#fff',
              color: tab === t.id ? '#fff' : '#111827',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {t.label}
          </button>
        ))}
        <button type="button" onClick={() => void load()} style={{ marginLeft: 'auto', padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer' }}>
          {loading ? 'Загрузка…' : 'Обновить'}
        </button>
      </div>
      {error && <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', marginBottom: 12 }}>{error}</div>}

      {tab === 'balances' && (
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Остатки по точкам</h2>
          <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ background: '#f9fafb' }}>
                <tr>
                  <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>№</th>
                  <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Позиция</th>
                  <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Точка</th>
                  <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Кол-во</th>
                  <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Цена</th>
                  <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Стоимость</th>
                </tr>
              </thead>
              <tbody>
                {balances.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>Нет данных — создайте приход</td></tr>
                ) : balances.map((b, i) => (
                  <tr key={String(b['id'] ?? i)} style={{ background: Number(b['quantityMicros'] ?? 0) < 0 ? '#fef2f2' : undefined }}>
                    <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{i + 1}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{itemName(String(b['stockItemId'] ?? ''))}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{locName(String(b['locationId'] ?? ''))}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6', textAlign: 'right' }}>{(Number(b['quantityMicros'] ?? 0) / 1000).toFixed(1)} {String(b['stockItemId'] ?? '') ? 'г' : ''}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6', textAlign: 'right' }}>{Number(b['averageCostMicros'] ?? 0).toLocaleString()} ₸/кг</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6', textAlign: 'right' }}>{(Number(b['totalValueMicros'] ?? 0) / 1000).toFixed(0)} ₸</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {aggregated.length > 0 && (
            <div style={{ marginTop: 12, padding: 12, background: '#f9fafb', borderRadius: 8, fontSize: 13 }}>
              <strong>Всего по всем точкам:</strong>{' '}
              {aggregated.map(a => `${itemName(a.itemId)} ${(a.total / 1000).toFixed(1)}г`).join(' · ')}
            </div>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>История движений</h2>
          <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead style={{ background: '#f9fafb' }}>
                <tr>
                  <th style={{ padding: 8, borderBottom: '1px solid #e5e7eb' }}>Дата</th>
                  <th style={{ padding: 8, borderBottom: '1px solid #e5e7eb' }}>Тип</th>
                  <th style={{ padding: 8, borderBottom: '1px solid #e5e7eb' }}>Позиция</th>
                  <th style={{ padding: 8, borderBottom: '1px solid #e5e7eb' }}>Точка</th>
                  <th style={{ padding: 8, borderBottom: '1px solid #e5e7eb' }}>Кол-во</th>
                  <th style={{ padding: 8, borderBottom: '1px solid #e5e7eb' }}>Стоимость</th>
                  <th style={{ padding: 8, borderBottom: '1px solid #e5e7eb' }}>Источник</th>
                </tr>
              </thead>
              <tbody>
                {movements.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>История пуста</td></tr>
                ) : movements.slice(0, 100).map((m, i) => (
                  <tr key={String(m['id'] ?? i)}>
                    <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{String(m['occurredAt'] ?? '').slice(0, 16).replace('T',' ')}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{String(m['movementType'] ?? '')}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{itemName(String(m['stockItemId'] ?? ''))}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{locName(String(m['locationId'] ?? ''))}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6', textAlign: 'right', color: Number(m['quantityDeltaMicros'] ?? 0) < 0 ? '#b91c1c' : '#065f46' }}>{Number(m['quantityDeltaMicros'] ?? 0) >0?'+':''}{(Number(m['quantityDeltaMicros'] ?? 0)/1000).toFixed(1)}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6', textAlign: 'right' }}>{Number(m['totalCostMicros'] ?? 0)/1000}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{String(m['sourceType'] ?? '')}:{String(m['sourceId'] ?? '').slice(0,8)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(tab === 'receipt' || tab === 'production' || tab === 'transfer' || tab === 'writeoff' || tab === 'counts' || tab === 'recipes') && (
        <div style={{ padding: 16, border: '1px dashed #e5e7eb', borderRadius: 8, background: '#fafafa', fontSize: 13, color: '#374151' }}>
          Раздел <strong>{TABS.find(t=>t.id===tab)?.label}</strong> — операции через <code>/inventory/command</code> (ADMIN). В этой версии доступны через API; формы редактирования калькуляций и массовых операций появятся в следующем слое (см. INVENTORY_DOMAIN.md §56–63).
          <div style={{ marginTop: 8, color: '#6b7280' }}>Текущий слой доказывает ledger, балансы и партитуру движений; UI-слой сбора форм — следующий шаг после прохождения acceptance.</div>
        </div>
      )}
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: MAHABBAT_INVENTORY_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'mahabbat-inventory',
  component: InventoryFrontComponent,
});
