const ESC = 0x1b;
const GS = 0x1d;

const CP866_OVERRIDES = new Map([
  ['Ё', 0xf0], ['ё', 0xf1],
  ['Є', 0xf2], ['є', 0xf3], ['Ї', 0xf4], ['ї', 0xf5],
  ['Ў', 0xf6], ['ў', 0xf7], ['°', 0xf8], ['∙', 0xf9],
  ['·', 0xfa], ['√', 0xfb], ['№', 0xfc], ['¤', 0xfd],
  ['■', 0xfe],
]);

const WINDOWS_1251_OVERRIDES = new Map([
  ['Ё', 0xa8], ['ё', 0xb8], ['Ђ', 0x80], ['ђ', 0x90],
  ['Ѓ', 0x81], ['ѓ', 0x83], ['Є', 0x8a], ['є', 0x9a],
  ['Ѕ', 0x8c], ['ѕ', 0x9c], ['І', 0x8d], ['і', 0x9d],
  ['Ї', 0x8f], ['ї', 0x9f], ['Ј', 0x8e], ['ј', 0x9e],
  ['Љ', 0x8b], ['љ', 0x9b], ['Њ', 0x92], ['њ', 0xa2],
  ['Ќ', 0x93], ['ќ', 0xb3], ['Ў', 0x9e], ['ў', 0xbe],
  ['№', 0xb9], ['€', 0x88],
]);

// The Russian alphabet is contiguous in both commonly used profiles. Unknown
// glyphs become '?' so the paper stays readable instead of emitting mojibake.
export const encodeCyrillic = (text, profile = 'CP866') => {
  if (profile === 'UTF8') return Buffer.from(text, 'utf8');
  const bytes = [];
  const overrides = profile === 'WINDOWS1251' ? WINDOWS_1251_OVERRIDES : CP866_OVERRIDES;
  for (const character of String(text)) {
    if (character === '₸') {
      bytes.push(...encodeCyrillic('тг', profile));
      continue;
    }
    const code = character.codePointAt(0);
    if (code < 0x80) {
      bytes.push(code);
      continue;
    }
    if (overrides.has(character)) {
      const value = overrides.get(character);
      if (Number.isInteger(value)) bytes.push(value);
      continue;
    }
    if (profile === 'WINDOWS1251' && code >= 0x410 && code <= 0x44f) {
      bytes.push(code - 0x350);
      continue;
    }
    if (profile !== 'WINDOWS1251' && code >= 0x410 && code <= 0x42f) {
      bytes.push(code - 0x390);
      continue;
    }
    if (profile !== 'WINDOWS1251' && code >= 0x430 && code <= 0x43f) {
      bytes.push(code - 0x390);
      continue;
    }
    if (profile !== 'WINDOWS1251' && code >= 0x440 && code <= 0x44f) {
      bytes.push(code - 0x360);
      continue;
    }
    if (character === '\n' || character === '\r' || character === '\t') {
      bytes.push(code);
      continue;
    }
    bytes.push(0x3f);
  }
  return Buffer.from(bytes);
};

const clampWidth = (value) => Number(value) >= 58 ? (Number(value) >= 80 ? 48 : 32) : 48;
const fit = (value, width) => String(value ?? '').slice(0, width);
const wrap = (value, width) => {
  const words = String(value ?? '').split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lines = [];
  let current = '';
  for (const word of words) {
    if (!current) current = word;
    else if (current.length + 1 + word.length <= width) current += ` ${word}`;
    else { lines.push(current); current = word; }
  }
  if (current) lines.push(current);
  return lines.flatMap((line) => {
    if (line.length <= width) return [line];
    const parts = [];
    for (let offset = 0; offset < line.length; offset += width) parts.push(line.slice(offset, offset + width));
    return parts;
  });
};
const center = (value, width) => {
  const text = fit(value, width);
  const left = Math.max(0, Math.floor((width - text.length) / 2));
  return `${' '.repeat(left)}${text}`;
};
const amount = (micros) => `${new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 }).format(Math.round(Number(micros ?? 0) / 1_000_000))} ₸`;

class ByteWriter {
  constructor(profile) {
    this.profile = profile ?? {};
    this.width = clampWidth(this.profile.paperWidth ?? 80);
    this.bytes = [];
  }
  raw(...values) { this.bytes.push(...values.flatMap((value) => [...Buffer.from(value)])); return this; }
  text(value = '') { this.bytes.push(...encodeCyrillic(String(value), this.profile.encodingProfile ?? 'CP866')); return this; }
  line(value = '') { this.text(value).raw('\n'); return this; }
  command(...values) { this.bytes.push(...values); return this; }
  bold(on) { return this.command(ESC, 0x45, on ? 1 : 0); }
  double(on) { return this.command(ESC, 0x21, on ? 0x10 : 0); }
  align(value) { return this.command(ESC, 0x61, value === 'center' ? 1 : value === 'right' ? 2 : 0); }
  finish() {
    this.align('left').bold(false).double(false);
    if (this.profile.cutSupport !== false) this.command(GS, 0x56, 0x00);
    return Buffer.from(this.bytes);
  }
}

const initWriter = (profile) => {
  const writer = new ByteWriter(profile);
  writer.command(ESC, 0x40);
  if (Number.isInteger(profile?.escPosCodePage)) writer.command(ESC, 0x74, profile.escPosCodePage & 0xff);
  return writer;
};

const lineWithAmount = (label, value, width) => {
  const right = String(value);
  const left = fit(label, Math.max(1, width - right.length - 1));
  return `${left}${' '.repeat(Math.max(1, width - left.length - right.length))}${right}`;
};

export const renderKitchen = (snapshot, profile = {}) => {
  const writer = initWriter(profile);
  const width = writer.width;
  writer.align('center').bold(true).double(true).line('МАХАББАТ').double(false).bold(false);
  writer.bold(true).line(`*** ${String(snapshot.stationSections?.length === 1 ? snapshot.stationSections[0].stationName : 'КУХНЯ').toUpperCase()} ***`).bold(false);
  if (snapshot.isReprint) writer.bold(true).line('!!! ПОВТОРНАЯ ПЕЧАТЬ !!!').bold(false);
  if (snapshot.isAdditional) writer.bold(true).line('*** ДОПОЛНЕНИЕ ***').bold(false);
  if (snapshot.ticketType === 'CANCELLATION' || snapshot.documentType === 'KITCHEN_CANCEL') {
    writer.bold(true).double(true).line('!!!!!!!!!!!!!!!!!!!!!!!!').line('НЕ ГОТОВИТЬ').line('ОТМЕНА').line('!!!!!!!!!!!!!!!!!!!!!!!!').double(false).bold(false);
  }
  writer.align('left').line('='.repeat(width));
  writer.line(`СТОЛ ${fit(snapshot.tableNumber ?? '—', width - 5)}  ${new Date(snapshot.createdAt ?? Date.now()).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`);
  writer.line(`Официант: ${fit(snapshot.waiterName ?? 'Сотрудник', width - 10)}`);
  writer.line(`Заказ #${fit(snapshot.orderId ?? '—', width - 8)}`);
  writer.line('-'.repeat(width));
  for (const section of snapshot.stationSections ?? []) {
    if ((snapshot.stationSections ?? []).length > 1) writer.bold(true).line(`*** ${String(section.stationName ?? 'СТАНЦИЯ').toUpperCase()} ***`).bold(false);
    let previousGuest = null;
    for (const item of section.lines ?? []) {
      if (item.guestDisplayNumber && item.guestDisplayNumber !== previousGuest) {
        writer.bold(true).line(item.guestDisplayNumber).bold(false);
        previousGuest = item.guestDisplayNumber;
      }
      const prefix = item.action === 'CANCEL' ? 'ОТМЕНА ' : '';
      for (const part of wrap(`${item.quantity} x ${prefix}${String(item.itemNameSnapshot ?? '').toUpperCase()}`, width)) writer.line(part);
    }
    writer.line('-'.repeat(width));
  }
  writer.align('center').line('Махаббат · operational kitchen');
  return writer.finish();
};

export const renderPrecheck = (snapshot, profile = {}) => {
  const writer = initWriter(profile);
  const width = writer.width;
  writer.align('center').bold(true).double(true).line('МАХАББАТ').double(false).bold(false);
  if (snapshot.isReprint) writer.bold(true).line('!!! ПОВТОРНАЯ ПЕЧАТЬ !!!').bold(false);
  writer.align('left').line('='.repeat(width));
  writer.line(`СТОЛ ${fit(snapshot.tableNumber ?? '—', width - 5)}`);
  writer.line(`Официант: ${fit(snapshot.waiterName ?? 'Сотрудник', width - 10)}`);
  writer.line(`Заказ #${fit(snapshot.orderId ?? '—', width - 8)}`);
  writer.line('-'.repeat(width));
  for (const guest of snapshot.guests ?? []) {
    writer.bold(true).line(guest.displayNumber ?? 'Гость').bold(false);
    for (const item of guest.lines ?? []) {
      writer.line(lineWithAmount(`${item.itemNameSnapshot} x${item.quantity}`, amount(item.lineTotalMicros), width));
    }
  }
  writer.line('-'.repeat(width)).bold(true).line(lineWithAmount('ИТОГО', amount(snapshot.totalMicros), width)).bold(false);
  writer.align('center').line('НЕ ЯВЛЯЕТСЯ ФИСКАЛЬНЫМ ЧЕКОМ');
  writer.line('Пречек · не фискальный документ');
  return writer.finish();
};

export const renderTestPrint = (snapshot, profile = {}) => {
  const writer = initWriter(profile);
  const width = writer.width;
  writer.align('center').bold(true).double(true).line('МАХАББАТ').double(false).bold(false);
  writer.line('ТЕСТ ПРИНТЕРА').line('='.repeat(width));
  writer.align('left').line('Русский текст').line('КУХНЯ').line('БАР').line('МАНГАЛ').line('ПРЕЧЕК');
  writer.line('1234567890').line('12 500 ₸');
  writer.line(`Принтер: ${fit(snapshot.printerLabel ?? '—', width - 9)}`);
  writer.line(`Время: ${new Date(snapshot.createdAt ?? Date.now()).toLocaleString('ru-RU')}`);
  writer.align('center').line('='.repeat(width));
  return writer.finish();
};

export class EscPosRenderer {
  render(job) {
    const snapshot = typeof job.payloadSnapshot === 'string' ? JSON.parse(job.payloadSnapshot) : job.payloadSnapshot;
    if (job.documentType === 'TEST_PRINT') return renderTestPrint(snapshot, job.profile);
    return job.documentType === 'PRECHECK' ? renderPrecheck(snapshot, job.profile) : renderKitchen(snapshot, job.profile);
  }
}

export const classifyTransportError = ({ phase, bytesSent = 0 } = {}) => {
  if (phase === 'connect' || phase === 'before-write' || bytesSent === 0) return { outcome: 'FAILED', code: 'CONNECTION_FAILED_BEFORE_SEND', retryable: true };
  return { outcome: 'OUTCOME_UNKNOWN', code: 'CONNECTION_DROPPED_AFTER_WRITE', retryable: false };
};

export const _internal = { ByteWriter, wrap, center, clampWidth };
