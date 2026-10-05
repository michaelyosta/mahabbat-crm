import { useState } from 'react';

import type { PosRow } from 'src/front-components/pos-ui.helpers';

type Props = {
  staff: PosRow[];
  currentStaffId: string;
  busy: boolean;
  onCreate: (input: { displayName: string; staffRole: 'WAITER' | 'ADMIN'; pin: string }) => Promise<boolean>;
  onSetPin: (staffId: string, pin: string) => Promise<boolean>;
  onSetActive: (staffId: string, isActive: boolean) => Promise<boolean>;
};

type StaffConfirm = {
  kind: 'pin' | 'active';
  target: PosRow;
  nextActive?: boolean;
  title: string;
  description: string;
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px',
  fontSize: 16,
  borderRadius: 10,
  border: '1px solid #d0d5dd',
};

const btnStyle: React.CSSProperties = {
  padding: '12px',
  fontSize: 15,
  fontWeight: 700,
  borderRadius: 10,
  border: '1px solid #d0d5dd',
  background: '#fff',
  cursor: 'pointer',
};

const cardStyle: React.CSSProperties = {
  border: '1px solid #e5e0d5',
  borderRadius: 12,
  padding: 12,
  marginBottom: 10,
  background: '#fff',
};

// Confirm-шит переиспользует PendingAction-паттерн PosApp: сначала проверка,
// затем явное подтверждение. PIN меняется мгновенно — старый перестаёт работать
// сразу; отключение последнего активного ADMIN запрещено на клиенте (сервер тоже
// отклоняет), чтобы не запереть кассу без администратора.
export const StaffSheet = ({ staff, currentStaffId, busy, onCreate, onSetPin, onSetActive }: Props) => {
  const [name, setName] = useState('');
  const [role, setRole] = useState<'WAITER' | 'ADMIN'>('WAITER');
  const [pin, setPin] = useState('');
  const [pinFor, setPinFor] = useState<string | null>(null);
  const [newPin, setNewPin] = useState('');
  const [confirm, setConfirm] = useState<StaffConfirm | null>(null);
  const [error, setError] = useState('');
  const visible = [...staff].sort((a, b) => String(a.displayName ?? '').localeCompare(String(b.displayName ?? ''), 'ru'));
  const activeAdmins = staff.filter((person) => person.staffRole === 'ADMIN' && person.isActive !== false);
  const lastActiveAdminId = activeAdmins.length === 1 ? String(activeAdmins[0].id) : null;

  const submitCreate = async () => {
    setError('');
    if (name.trim().length < 2) { setError('Введите имя сотрудника.'); return; }
    if (!/^\d{4,8}$/.test(pin.trim())) { setError('PIN — 4–8 цифр.'); return; }
    const ok = await onCreate({ displayName: name.trim(), staffRole: role, pin: pin.trim() });
    if (ok) { setName(''); setPin(''); } else { setError('Не удалось добавить: такое имя уже занято или PIN отклонён сервером.'); }
  };

  const requestPinConfirm = (person: PosRow) => {
    setError('');
    if (!/^\d{4,8}$/.test(newPin.trim())) { setError('Новый PIN — 4–8 цифр.'); return; }
    setConfirm({
      kind: 'pin',
      target: person,
      title: `Сменить PIN сотруднику «${String(person.displayName ?? 'Сотрудник')}»?`,
      description: 'Старый PIN перестанет работать сразу. Новый PIN нужно передать сотруднику лично.',
    });
  };

  const requestActiveConfirm = (person: PosRow, nextActive: boolean) => {
    setError('');
    const display = String(person.displayName ?? 'Сотрудник');
    if (!nextActive && String(person.id) === lastActiveAdminId) {
      setError('Нельзя отключить последнего активного администратора: касса останется без управления.');
      return;
    }
    setConfirm({
      kind: 'active',
      target: person,
      nextActive,
      title: nextActive ? `Включить сотрудника «${display}»?` : `Отключить сотрудника «${display}»?`,
      description: nextActive
        ? 'Сотрудник снова сможет входить по PIN и принимать заказы.'
        : 'Сотрудник сразу потеряет доступ: открытые сессии завершатся, вход по старому PIN будет отклонён.',
    });
  };

  const submitConfirm = async () => {
    if (!confirm) return;
    const action = confirm;
    setConfirm(null);
    if (action.kind === 'pin') {
      const ok = await onSetPin(String(action.target.id), newPin.trim());
      if (ok) { setPinFor(null); setNewPin(''); } else { setError('PIN не обновлён: сервер отклонил смену PIN.'); }
      return;
    }
    const ok = await onSetActive(String(action.target.id), Boolean(action.nextActive));
    if (!ok) setError('Не удалось изменить статус: сервер отклонил операцию.');
  };

  return (
    <div>
      <section style={cardStyle}>
        <strong>Новый сотрудник</strong>
        <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
          <input aria-label="Имя сотрудника" style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя, например Айжан" maxLength={60} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <select aria-label="Роль" style={inputStyle} value={role} onChange={(e) => setRole(e.target.value as 'WAITER' | 'ADMIN')}>
              <option value="WAITER">Официант</option>
              <option value="ADMIN">Администратор</option>
            </select>
            <input aria-label="PIN" style={inputStyle} value={pin} onChange={(e) => setPin(e.target.value)} placeholder="PIN 4–8 цифр" inputMode="numeric" maxLength={8} />
          </div>
          <button type="button" style={{ ...btnStyle, background: '#b3261e', borderColor: '#b3261e', color: '#fff' }} disabled={busy} onClick={() => void submitCreate()}>
            Добавить сотрудника
          </button>
        </div>
      </section>

      {error && <div role="alert" style={{ color: '#b42318', fontWeight: 600, marginBottom: 10 }}>{error}</div>}

      {visible.map((person) => {
        const inactive = person.isActive === false;
        const self = person.id === currentStaffId;
        const isLastAdmin = !inactive && String(person.id) === lastActiveAdminId;
        return (
          <section key={String(person.id)} style={{ ...cardStyle, opacity: inactive ? 0.65 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div>
                <strong>{String(person.displayName ?? 'Сотрудник')}</strong>
                <div style={{ fontSize: 13, color: '#667085' }}>
                  {person.staffRole === 'ADMIN' ? 'Администратор' : 'Официант'}
                  {inactive ? ' · отключён' : ''}
                  {self ? ' · это вы' : ''}
                  {isLastAdmin ? ' · последний активный ADMIN' : ''}
                </div>
              </div>
              {!self && (
                <button
                  type="button"
                  style={btnStyle}
                  disabled={busy || (!inactive && isLastAdmin)}
                  title={!inactive && isLastAdmin ? 'Нельзя отключить последнего активного администратора' : undefined}
                  onClick={() => requestActiveConfirm(person, inactive)}
                >
                  {inactive ? 'Включить' : 'Отключить'}
                </button>
              )}
            </div>
            {pinFor === person.id ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginTop: 8 }}>
                <input aria-label="Новый PIN" style={inputStyle} value={newPin} onChange={(e) => setNewPin(e.target.value)} placeholder="Новый PIN 4–8 цифр" inputMode="numeric" maxLength={8} />
                <button type="button" style={btnStyle} disabled={busy} onClick={() => requestPinConfirm(person)}>OK</button>
              </div>
            ) : (
              <button type="button" style={{ ...btnStyle, marginTop: 8, width: '100%' }} disabled={busy} onClick={() => { setPinFor(String(person.id)); setNewPin(''); }}>
                Сменить PIN
              </button>
            )}
          </section>
        );
      })}

      {confirm && (
        <section role="dialog" aria-modal="true" aria-label={confirm.title} style={{ ...cardStyle, borderColor: '#b3261e', background: '#fff8f7' }}>
          <strong>{confirm.title}</strong>
          <div style={{ marginTop: 6, fontSize: 14, color: '#444' }}>{confirm.description}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
            <button type="button" style={btnStyle} disabled={busy} onClick={() => setConfirm(null)}>
              Назад
            </button>
            <button type="button" style={{ ...btnStyle, background: '#b3261e', borderColor: '#b3261e', color: '#fff' }} disabled={busy} onClick={() => void submitConfirm()}>
              Подтвердить
            </button>
          </div>
        </section>
      )}

      {visible.length === 0 && <div style={{ color: '#667085' }}>Пока нет сотрудников.</div>}
    </div>
  );
};
