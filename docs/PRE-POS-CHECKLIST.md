# PRE-POS HARDENING CHECKLIST

Итоговый чеклист фазы PRE-POS HARDENING. Каждый пункт подтверждён
исполняемыми проверками; ссылки на коммиты в `git log` (base `93671a1`).

## Автоматические гейты (итог)

| Критерий | Статус | Подтверждение |
| --- | --- | --- |
| A. `yarn lint` | PASS | 0 warnings / 0 errors (82 файла) |
| B. `yarn typecheck` (tsgo) | PASS | без ошибок |
| C. `yarn test:unit` | PASS | 13 файлов, 178/178 тестов |
| D. SDK plan/apply на `:2020` | PASS | план чист после apply: `No changes. Twenty metadata matches your manifest` |

## Слайсы H1–H10

| Слайс | Критерий | Статус | Коммит |
| --- | --- | --- | --- |
| H1 | Баланс считается из полной ленты (курсорный обход), не из `first:100` | PASS | `8ac49ad` |
| H7 | Исполняемые регрессионные тесты процессора лояльности (retry/idempotency/concurrency/recovery) | PASS | `1684f2f` |
| H2 | Staff без destroy/soft-delete на операционных объектах | PASS | `b221223` |
| H4 | CI запинен на `TWENTY_VERSION: v2.29.0` и действие на коммит `80fb91c0` | PASS | `bd590be` |
| H5 | CD за гейтом Environments `production` + запиненные действия | PASS | `24ff805` |
| H6 | Publish с версионным гейтом; решение `docs/DISTRIBUTION_DECISION.md` | PASS | `24ff805` |
| H8 | Fail-closed allowlist таргетов перед деструктивным uninstall | PASS | `ca0b1a5` |
| H3 | Серверное монотонное обновление `lastActivityAt` из активности заказов | PASS | `c45d756` |
| H9 | Fail-closed assertions в брендинг-overlay | PASS | `f86c456` |
| H10 | `docs/POS_BOUNDARY.md` | PASS | `e4e8ad0` |

## Оценка A–M (обобщённо)

A–D: гейты выше — PASS.
E. Воспроизводимость CI (образ, действие, версии) — PASS.
F. CD-гейт Environments — PASS.
G. Гейт публикации + статус дистрибуции — PASS.
H. Корректность баланса — PASS (H1, `computeLoyaltyBalance` + 14 тестов).
I. Инварианты процессора — PASS (H7, 11 тестов).
J. Отсутствие разрушающих прав Staff — PASS (H2, 7 тестов).
K. Безопасность тестов (fail-closed) — PASS (H8, 11 тестов).
L. Монотонность `lastActivityAt` — PASS (H3, 18 тестов).
M. Брендинг-overlay fail-closed — PASS (H9, 7 тестов).

## BLOCKED / невозможные проверки

- Живой CD-деплой — **невозможен by design**: нет внешнего таргета и API-ключа
  (зафиксировано в `docs/DISTRIBUTION_DECISION.md`).
- Браузерный smoke на `:2020` после рестарта контейнера — не повторён в этой
  сессии; здоровье контейнера подтверждено (`/healthz`), SDK plan/apply/replan
  — чистые. Не блокирует.
- GitHub-действия `deploy-twenty-app`/`install-twenty-app` доступны на базовом
  коммите `80fb91c0` (проверено), но требуют настройки Environments в репо —
  ручное действие, не блокирует код.

## Не трогали (по требованиям)

Twenty core `../packages/**`, `scripts/seed-demo.mjs`, контракт identity,
контракт ledger writer, `.env`/ключи/HMAC, рабочий self-hosted `:3000`
(деструктивные операции — только `:2020`).

*Дата: 2026-08-18. Итог: см. PRE-POS HARDENING REVIEW.*