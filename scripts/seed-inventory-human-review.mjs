/**
 * Create a bounded, human-readable Inventory review namespace.
 *
 * This script is intentionally additive and idempotent: it never deletes,
 * updates, or resets data outside the deterministic review command keys.
 * Keep the admin PIN and API key process-local; neither belongs in Git.
 *
 * Example (PowerShell):
 *   $env:MAHABBAT_REVIEW_NAMESPACE='INV-HR-20260821'
 *   $env:MAHABBAT_REVIEW_ADMIN_PIN='<private-admin-pin>'
 *   yarn seed:inventory:review
 */
import { createHash } from 'node:crypto';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MICROS_PER_KG = 1_000_000;
const MICROS_PER_GRAM = 1_000;

const accepted = (status) => status === 200 || status === 201;
const kg = (value) => Math.round(value * MICROS_PER_KG);
const grams = (value) => Math.round(value * MICROS_PER_GRAM);
const stableUuid = (value) => {
  const hex = createHash('sha256').update(value).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${((Number.parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0')}${hex.slice(18, 20)}-${hex.slice(20, 32)}`;
};

const parseBody = async (response) => {
  const text = await response.text();
  try { return JSON.parse(text); } catch { return { raw: text }; }
};

const config = () => {
  const apiUrl = process.env.MAHABBAT_API_URL?.trim();
  const apiKey = process.env.MAHABBAT_API_KEY?.trim();
  const pin = process.env.MAHABBAT_REVIEW_ADMIN_PIN?.trim();
  if (!apiUrl || !apiKey || !pin || !/^\d{4,8}$/.test(pin)) throw new Error('MAHABBAT_API_URL, MAHABBAT_API_KEY and a private 4–8 digit MAHABBAT_REVIEW_ADMIN_PIN are required');
  return { apiUrl: apiUrl.replace(/\/+$/, ''), apiKey, pin, namespace: process.env.MAHABBAT_REVIEW_NAMESPACE?.trim() || 'INV-HR-DEFAULT' };
};

const request = async (apiUrl, apiKey, path, options = {}) => {
  const response = await fetch(`${apiUrl}${path}`, { ...options, headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json', ...(options.headers ?? {}) } });
  const body = await parseBody(response);
  if (!response.ok) throw new Error(`${options.method ?? 'GET'} ${path} -> ${response.status} (${body?.code ?? 'request failed'})`);
  return body;
};

const restGet = async (apiUrl, apiKey, plural) => (await request(apiUrl, apiKey, `/rest/${plural}?limit=200`)).data?.[plural] ?? [];
const restBatch = async (apiUrl, apiKey, plural, rows) => request(apiUrl, apiKey, `/rest/batch/${plural}`, { method: 'POST', body: JSON.stringify(rows) });
const posCommand = async (apiUrl, apiKey, command, payload) => request(apiUrl, apiKey, '/s/pos/command', { method: 'POST', body: JSON.stringify({ command, payload }) });
const inventoryCommand = async (apiUrl, apiKey, command, sessionToken, payload) => request(apiUrl, apiKey, '/s/inventory/command', { method: 'POST', body: JSON.stringify({ command, sessionToken, payload }) });

const main = async () => {
  const { apiUrl, apiKey, pin, namespace } = config();
  const admin = await posCommand(apiUrl, apiKey, 'authenticatePosStaff', { pin, terminalId: `inventory-human-review-${namespace}` });
  if (admin.staff?.role !== 'ADMIN' || typeof admin.sessionToken !== 'string') throw new Error('The supplied review PIN is not an ADMIN PIN');

  const command = async (name, payload) => {
    const { key = name, ...commandPayload } = payload;
    return inventoryCommand(apiUrl, apiKey, name, admin.sessionToken, { ...commandPayload, idempotencyKey: `${namespace}:${name}:${key}` });
  };
  const createLocation = async (key, name, sortOrder) => {
    const result = await command('createStockLocation', { key, name, sortOrder });
    if (!UUID_RE.test(result.locationId ?? '')) throw new Error(`Location ${name} did not return an id`);
    return result.locationId;
  };
  const createItem = async (key, name, itemType, defaultLocationId, unitKind = 'MASS', baseUnit = 'GRAM') => {
    const result = await command('createStockItem', { key, name, itemType, unitKind, baseUnit, defaultLocationId });
    if (!UUID_RE.test(result.stockItemId ?? '')) throw new Error(`Stock item ${name} did not return an id`);
    return result.stockItemId;
  };

  const locations = {
    kitchen: await createLocation('kitchen', 'Кухня', 0),
    bar: await createLocation('bar', 'Бар', 1),
    shashlyk: await createLocation('shashlyk', 'Шашлыки', 2),
  };
  const items = {
    tomato: await createItem('tomato', 'Помидоры', 'RAW_MATERIAL', locations.kitchen),
    cucumber: await createItem('cucumber', 'Огурцы', 'RAW_MATERIAL', locations.kitchen),
    onion: await createItem('onion', 'Лук', 'RAW_MATERIAL', locations.kitchen),
    pepper: await createItem('pepper', 'Перец', 'RAW_MATERIAL', locations.kitchen),
    oil: await createItem('oil', 'Масло', 'RAW_MATERIAL', locations.kitchen),
    milk: await createItem('milk', 'Молоко', 'RAW_MATERIAL', locations.kitchen, 'VOLUME', 'MILLILITER'),
    bottles: await createItem('bottles', 'Бутылки', 'RAW_MATERIAL', locations.kitchen, 'COUNT', 'PIECE'),
    ogonek: await createItem('ogonek', 'Огонёк', 'SEMI_FINISHED', locations.kitchen),
  };

  const menuId = stableUuid(`${namespace}:salad`);
  const menuItems = await restGet(apiUrl, apiKey, 'posMenuItems');
  if (!menuItems.some((item) => String(item.id) === menuId)) {
    await restBatch(apiUrl, apiKey, 'posMenuItems', [{ id: menuId, name: 'Салат', category: 'Ревью склада', price: { amountMicros: 1_000_000, currencyCode: 'KZT' }, isActive: true }]);
  }

  await command('receiveStock', {
    key: 'opening-receipt', locationId: locations.kitchen,
    lines: [
      { stockItemId: items.tomato, quantityMicros: kg(10), unitCostMicros: 900 },
      { stockItemId: items.cucumber, quantityMicros: kg(5), unitCostMicros: 600 },
      { stockItemId: items.onion, quantityMicros: kg(10), unitCostMicros: 500 },
      { stockItemId: items.pepper, quantityMicros: kg(3), unitCostMicros: 800 },
      { stockItemId: items.oil, quantityMicros: kg(2), unitCostMicros: 1_200 },
    ], comment: 'Начальные остатки для проверки сотрудником',
  }).then((result) => { if (!accepted(result.status ?? 200)) throw new Error('Opening review receipt failed'); });
  const recipe = await command('upsertRecipe', {
    key: 'ogonek-recipe', label: 'Огонёк', targetKind: 'SEMI_FINISHED', targetId: items.ogonek,
    defaultLocationId: locations.kitchen, yieldQuantityMicros: kg(1),
    lines: [{ stockItemId: items.tomato, quantityMicros: grams(500) }, { stockItemId: items.onion, quantityMicros: grams(500) }],
  });
  if (!UUID_RE.test(recipe.recipeVersionId ?? '')) throw new Error('Review recipe did not return a version');

  console.log(`PASS human review demo prepared: ${namespace} (additive and idempotent; no deletes)`);
  console.log('Natural labels: Кухня, Бар, Шашлыки, Помидоры, Огурцы, Лук, Перец, Масло, Молоко, Бутылки, Огонёк, Салат');
};

main().catch((error) => { console.error(`Human review demo seed failed: ${error.message}`); process.exitCode = 1; });
