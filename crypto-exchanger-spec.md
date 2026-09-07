# Криптообменник — техническое задание «под ключ»

Документ для передачи в Claude Code (Opus). Я — управляющий проектом, Opus — исполнитель.
Правило: Opus работает строго по спринтам (раздел 9). Ничего не делает вне текущего спринта без подтверждения.

---

## 0. Что мы строим (одним абзацем)

Криптообменник брокерского типа: пользователь выбирает пару (например USDT → EUR, BTC → USDT, EUR → USDT), видит зафиксированный курс, создаёт заявку, оплачивает, получает средства. Мы **не держим стакан** и **на старте не держим кастодию** — исполнение идёт через лицензированного партнёра по API. Мы зарабатываем на спреде (курс партнёра + наша наценка). Кабинет пользователя, KYC, история, реферальная система, админка — наши.

Два этапа:
- **Этап 1 (запуск):** мы — интерфейс + кабинет + комплаенс-слой поверх партнёра. Деньги пользователей у нас не лежат.
- **Этап 2 (после лицензии CASP / MiCA):** собственные кошельки, собственная кастодия, свои фиат-рельсы.

Вся архитектура строится так, чтобы переход на этап 2 не требовал переписывания — только замену «провайдера исполнения».

---

## 1. Решения, которые нужны ДО старта разработки (зона управляющего, не Opus)

| # | Решение | Варианты | Статус |
|---|---------|----------|--------|
| 1 | Юрисдикция и правовая модель | (а) агент/white-label лицензированного CASP-провайдера; (б) своя CASP-лицензия в ЕС (Литва, Эстония, Польша, Чехия); (в) вне ЕС на старте | **нужно решить** |
| 2 | Партнёр по исполнению (курсы + расчёты) | API агрегатора (тип Changelly/ChangeNOW/SimpleSwap для crypto↔crypto; для fiat — лицензированный on/off-ramp вроде Transak/MoonPay/Mercuryo либо EMI-банк) | **нужно решить** |
| 3 | KYC-провайдер | Sumsub (рекомендую), Veriff, Onfido | Sumsub по умолчанию |
| 4 | AML-скрининг адресов | Scorechain, Chainalysis, Elliptic, Crystal | нужно решить (для этапа 1 может дать партнёр) |
| 5 | Стартовые пары | Предлагаю: USDT (TRC20/ERC20), USDC, BTC, ETH ↔ EUR, PLN, UAH + crypto↔crypto | подтвердить |
| 6 | Фиат-рельсы | SEPA (EUR), Blik/Przelewy24 (PLN), карты — через EMI-партнёра | нужно решить |
| 7 | Домен, бренд, юрлицо | — | нужно |

**Без пункта 1 и 2 запуск невозможен.** Разработку кабинета можно начинать параллельно — API партнёра подключается через абстракцию (раздел 4.4).

---

## 2. Роли

| Роль | Что может |
|------|-----------|
| **Guest** | Смотреть курсы, калькулятор, создать заявку без регистрации до лимита L0 (например до €150) |
| **User** | Кабинет, заявки, KYC, история, рефералы, тикеты |
| **Support** | Видеть заявки и пользователей, отвечать в тикетах, НЕ менять статусы платежей |
| **Compliance** | Ревью KYC, ставить заявки на hold, AML-алерты, блокировать пользователей |
| **Admin** | Всё выше + курсы, спреды, пары, лимиты, выплаты, настройки |
| **Superadmin** | Всё + управление ролями, ключи API, audit log |

---

## 3. Стек

- **Frontend + Backend:** Next.js 15 (App Router), TypeScript, Tailwind, shadcn/ui
- **БД:** PostgreSQL + Prisma
- **Кэш / очереди / курсы:** Redis + BullMQ (воркеры для мониторинга платежей, обновления курсов, уведомлений)
- **Авторизация:** Auth.js (email+пароль, magic link, Google), обязательный TOTP 2FA для вывода и для всех ролей кроме User
- **KYC:** Sumsub WebSDK + webhooks
- **Email:** Resend; **Telegram-уведомления:** через бота (можно через n8n — у нас он уже есть)
- **Мониторинг блокчейна (этап 2):** Tatum / Alchemy / BlockCypher webhooks
- **Инфра:** Docker Compose → VPS (Hetzner), Nginx, Let's Encrypt, Cloudflare перед ним
- **Логи/ошибки:** Sentry; **Метрики:** простой Grafana/Prometheus или Better Stack
- **Тесты:** Vitest (unit) + Playwright (e2e критических флоу)

Запрет: никакого localStorage для данных заявок и балансов. Только сервер.

---

## 4. Модули

### 4.1 Auth & Security
- Регистрация, логин, восстановление пароля, подтверждение email
- TOTP 2FA (Google Authenticator), backup-коды
- Сессии с device fingerprint, список активных сессий, «выйти везде»
- Rate limiting на логин/регистрацию/создание заявок
- Anti-phishing код в письмах
- Whitelist адресов вывода (изменение — 24ч задержка + 2FA)

### 4.2 KYC / AML (уровни)
| Уровень | Что нужно | Лимит |
|---------|-----------|-------|
| L0 | email | до €150/заявка, €500/мес (пороговые значения — согласовать с юристом; MiCA/AMLR ужесточают) |
| L1 | документ + селфи (Sumsub) | до €5 000/мес |
| L2 | L1 + подтверждение адреса + источник средств | до €50 000/мес |
| L3 | ручной ревью compliance | индивидуально |

- Статусы KYC: `none / pending / approved / rejected / resubmission_required`
- Webhook от Sumsub меняет статус автоматически; compliance может переопределить вручную
- Скрининг каждого крипто-адреса (вход и выход) через AML-провайдера; риск-скор > порога → заявка на `on_hold_compliance`
- Санкционные списки, PEP — приходят из Sumsub
- Travel Rule (переводы > €1 000 между CASP) — заложить поле, реализация на этапе 2

### 4.3 Курсы (Rates Engine)
- Воркер каждые 10–30 сек тянет курсы от партнёра/агрегатора → Redis
- Наша цена = курс партнёра ± спред (настраивается по паре и по направлению в админке)
- **Фиксация курса** при создании заявки на N минут (по умолчанию 15 для крипты, 30 для фиата). После — заявка `expired`, пересчёт
- Защита: если курс партнёра недоступен > 60 сек — пара автоматически ставится на паузу, публично «временно недоступно»
- Минимум/максимум суммы по паре

### 4.4 Абстракция провайдера исполнения (ключевой архитектурный элемент)
Интерфейс `ExecutionProvider`:
```
getQuote(from, to, amount) → { rate, partnerRate, fee, expiresAt, quoteId }
createOrder(quoteId, payoutDetails) → { partnerOrderId, depositAddress | paymentLink }
getOrderStatus(partnerOrderId) → status
webhook handler → обновление статуса у нас
```
Реализации: `PartnerXProvider` (этап 1), `SelfCustodyProvider` (этап 2), `MockProvider` (тесты и разработка).
Смена провайдера — конфиг, не код.

### 4.5 Заявки (Orders) — машина состояний
```
created
 → awaiting_payment        (пользователю показан адрес/реквизиты, таймер)
 → payment_detected        (входящая транзакция видна, ждём подтверждений)
 → paid                    (подтверждено)
 → processing              (исполнение через провайдера / ручная выплата)
 → completed
Побочные:
 → expired                 (не оплатили вовремя)
 → cancelled               (пользователь или админ до оплаты)
 → on_hold_compliance      (AML/лимиты; выход только compliance)
 → refund_pending → refunded  (пришла неверная сумма / отказ)
 → failed                  (ошибка провайдера; обязателен ручной разбор)
```
Каждый переход пишется в `order_events` с актором (system / user / admin id) и причиной. Без этого не мержить.

Сценарии, которые обязаны быть обработаны:
- Пришло меньше суммы → частичное исполнение или возврат (правило в админке)
- Пришло больше → исполнить на фактическую сумму по курсу заявки, разницу по текущему курсу (или возврат)
- Оплата после истечения → `refund_pending` с уведомлением
- Одна транзакция — на две заявки одного пользователя (защита: уникальный адрес/уникальная сумма-метка)

### 4.6 Личный кабинет пользователя
Страницы:
1. **Dashboard** — быстрый обмен, активные заявки, уровень KYC и лимиты, последние 5 операций
2. **Новый обмен** — калькулятор → реквизиты → подтверждение → страница заявки с таймером и статусом live (SSE/polling)
3. **Заявки** — таблица с фильтрами, детальная страница каждой (все события, tx hash, чек/квитанция PDF)
4. **Верификация** — текущий уровень, кнопка «повысить», встроенный Sumsub SDK
5. **Реквизиты** — сохранённые крипто-адреса и IBAN (с whitelist-задержкой)
6. **Рефералы** — ссылка, статистика, начисления (% от нашего спреда), выплата
7. **Безопасность** — пароль, 2FA, сессии, anti-phishing код, история входов
8. **Поддержка** — тикеты с вложениями
9. **Уведомления** — email / Telegram привязка (deep-link к боту)

Языки: RU, EN, PL, UK (i18n с первого дня, `next-intl`).

### 4.7 Админ-панель (`/admin`, отдельный логин, 2FA обязателен, IP allowlist)
1. **Очередь заявок** — фильтр по статусу; заявки, требующие действия, вверху; кнопки перехода статусов с обязательным комментарием
2. **Пользователи** — карточка: KYC, лимиты, заявки, сессии, флаги, блокировка
3. **KYC-ревью** — очередь compliance, просмотр отчёта Sumsub, approve/reject/ resubmit
4. **AML-алерты** — список сработавших скринингов
5. **Пары и курсы** — включить/выключить пару, спред, мин/макс, ручной override курса с TTL
6. **Провайдеры** — статус подключений, балансы у партнёра, лог запросов
7. **Финансы** — сводка: оборот, наш спред, выплачено рефералам, по дням/парам; экспорт CSV
8. **Настройки** — лимиты по уровням, TTL фиксации, шаблоны писем, тексты юр. страниц
9. **Audit log** — каждое действие админа неизменяемо
10. **Тикеты** — поддержка

### 4.8 Публичный сайт
- Главная с калькулятором (курс live), «как это работает», доверие (лицензия/партнёр, резервы)
- Страница курсов, FAQ, контакты
- Юридические: Terms, Privacy, AML/KYC Policy, Risk Disclosure, Cookie — тексты от юриста, Opus делает только вёрстку
- SEO: страницы под каждую пару (`/exchange/usdt-to-eur`)

### 4.9 Уведомления
События: заявка создана / оплата получена / исполнена / истекла / hold / KYC-статус / вход с нового устройства / изменение реквизитов.
Каналы: email (обязательно), Telegram (опционально), в кабинете (лента).

### 4.10 Этап 2 — собственная кастодия (не делать до лицензии)
- Горячий кошелёк (лимит, например ≤ 5% оборота) + холодный (мультисиг, аппаратный)
- Генерация уникального депозитного адреса на заявку (HD-кошелёк)
- Мониторинг входящих через webhook-провайдера, свой счёт подтверждений по сети
- Автоматические выплаты до порога, выше — ручное одобрение 2 человек (four-eyes)
- Сверка балансов (reconciliation) каждый час: блокчейн vs БД; расхождение → стоп выплат + алерт

---

## 5. Схема данных (основные таблицы)

```
users            id, email, password_hash, role, kyc_level, kyc_status, status(active/blocked), 2fa_secret, antiphishing_code, referrer_id, locale, created_at
sessions         id, user_id, device_fp, ip, user_agent, last_seen, revoked_at
kyc_applications id, user_id, provider, provider_applicant_id, level_requested, status, review_result_json, reviewed_by, created_at
currencies       code, type(fiat/crypto), network, decimals, enabled, min_confirmations
pairs            id, from_code, to_code, enabled, spread_bps, min_amount, max_amount, quote_ttl_sec
rates            id, pair_id, partner_rate, our_rate, source, fetched_at        (Redis для live, БД для истории)
orders           id, public_id, user_id(nullable для L0), pair_id, from_amount, to_amount, rate, partner_rate, spread_amount,
                 status, provider, provider_order_id, deposit_address/payment_details_json, payout_details_json,
                 quote_expires_at, paid_at, completed_at, tx_in_hash, tx_out_hash, risk_score, created_at
order_events     id, order_id, from_status, to_status, actor_type, actor_id, reason, meta_json, created_at
payout_details   id, user_id, type(crypto/iban), value, label, whitelisted_at, created_at
referrals        id, referrer_id, referred_id, order_id, amount, status(accrued/paid), created_at
tickets, ticket_messages
aml_checks       id, order_id, address, provider, risk_score, raw_json, created_at
admin_audit_log  id, admin_id, action, entity, entity_id, before_json, after_json, ip, created_at
settings         key, value_json, updated_by, updated_at
```

Деньги — только `DECIMAL(36,18)`, никаких float. Все суммы и курсы неизменяемы после создания заявки.

---

## 6. Безопасность — чеклист обязательный

- Все секреты в env / vault; в репо — только `.env.example`
- Пароли: argon2id
- CSRF, CSP, HSTS, rate limiting, защита от enumeration email
- Вебхуки партнёра и Sumsub — проверка подписи, идемпотентность по event id
- Админка: 2FA + IP allowlist + отдельный поддомен
- Изменение реквизитов вывода → 24 ч задержка + email-подтверждение
- Никаких прямых SQL — только Prisma; параметризованные запросы
- Бэкапы БД каждые 6 ч, тест восстановления раз в месяц
- Pen-test перед публичным запуском (внешний)
- Резервный «kill switch»: одна кнопка в админке — все пары на паузу, выплаты стоп

---

## 7. Метрики, которые должна показывать админка с первого дня

Оборот/день, количество заявок по статусам, конверсия «калькулятор → заявка → оплата → completed», средний спред, средний чек, время исполнения, доля hold/refund, стоимость привлечения по UTM.

---

## 8. Что НЕ делаем на этапе 1 (осознанно)

- Свой стакан и маржинальная торговля
- Хранение средств пользователей
- Мобильные приложения (PWA хватит)
- Больше 4 языков
- Свои фиат-рельсы

---

## 9. План спринтов для Claude Code (Opus)

Каждый спринт: Opus начинает с плана → согласование → реализация → тесты → короткий отчёт «что сделано / что не сделано / риски». Следующий спринт не начинать без одобрения.

| Спринт | Содержание | Критерий приёмки |
|--------|------------|------------------|
| **0** | Репо, Docker Compose (postgres, redis, app, worker), Prisma-схема из раздела 5, CI (lint, typecheck, tests), `.env.example`, README | `docker compose up` поднимает всё; миграции применяются; тесты зелёные |
| **1** | Auth: регистрация/логин/сброс/подтверждение email, 2FA, сессии, роли, rate limit | e2e: полный цикл регистрации + 2FA; brute-force блокируется |
| **2** | Currencies/Pairs/Rates: воркер курсов на `MockProvider`, спреды, пауза пары, публичный калькулятор | курс обновляется, калькулятор считает верно, пауза работает |
| **3** | Orders: машина состояний, `order_events`, создание заявки, страница заявки с таймером и live-статусом, expiry-воркер | все переходы покрыты unit-тестами; невалидный переход невозможен |
| **4** | `ExecutionProvider` абстракция + реальный партнёрский провайдер (по решению п.1.2) + webhooks с проверкой подписи | заявка проходит end-to-end в sandbox партнёра |
| **5** | KYC: Sumsub SDK, webhooks, уровни, лимиты, блокировка при превышении | тестовый апликант проходит L1; лимит L0 срабатывает |
| **6** | Кабинет пользователя полностью (разделы 4.6), i18n RU/EN/PL/UK | Playwright проходит по всем страницам кабинета |
| **7** | Админка: очередь заявок, пользователи, KYC-ревью, пары/курсы, audit log | каждое действие админа видно в audit log |
| **8** | AML-скрининг адресов, hold-флоу, compliance-роль, refund-флоу | адрес с высоким риском → hold; refund проходит по машине состояний |
| **9** | Уведомления (email + Telegram), рефералы, тикеты | письма уходят на каждое событие; реферал начисляется |
| **10** | Публичный сайт, SEO-страницы пар, юр. страницы, PWA | Lighthouse ≥ 90; страницы пар индексируются |
| **11** | Hardening: security-чеклист раздела 6, бэкапы, Sentry, мониторинг, kill switch, нагрузочный тест | внешний pen-test без critical/high |
| **12** | Деплой на прод, runbook для операторов, инструкция для compliance | прод доступен; runbook проверен на «холодной» голове |

Оценка: 12 спринтов ≈ 8–12 недель при полной загрузке одного оператора Claude Code + ревью управляющего.

---

## 10. Мастер-промпт для Claude Code (Opus)

### English (использовать этот)

```
You are the lead engineer building a broker-type crypto exchanger. I am the project manager. The full specification is in ./SPEC.md — read it entirely before doing anything.

Operating rules:
1. Work strictly sprint by sprint as defined in section 9. Never start the next sprint without my explicit approval.
2. At the start of each sprint: output a concrete plan (files, modules, data changes, tests) and wait for my "go".
3. At the end of each sprint: output a report in the format — Done / Not done / Risks & open questions / How to verify. Keep it short.
4. Before implementing anything that touches money, order status transitions, KYC levels, or payouts, write the tests first, then the code.
5. Every order status transition must go through a single `transitionOrder()` function that validates the state machine and writes to `order_events`. No direct status updates anywhere else.
6. All monetary values are DECIMAL(36,18) — never float, never JavaScript Number for money. Use a decimal library.
7. The execution partner is accessed only through the `ExecutionProvider` interface. Implement `MockProvider` first; the real provider is a separate adapter added in sprint 4.
8. No localStorage/sessionStorage for any business data. Server is the single source of truth.
9. All secrets via environment variables. Commit only `.env.example`.
10. Every webhook handler must verify the signature and be idempotent.
11. If the spec is ambiguous or you must make an architectural choice not covered by it, stop and ask me — do not guess. Ask at most 3 questions at a time.
12. If something in the spec is a bad idea technically or a security risk, say so directly before implementing it.
13. Use: Next.js 15 App Router, TypeScript strict, Tailwind + shadcn/ui, PostgreSQL + Prisma, Redis + BullMQ, Auth.js, next-intl, Vitest, Playwright, Docker Compose.
14. Language of code, comments, commit messages: English. Language of UI: i18n with RU as default, plus EN/PL/UK.

Start now with Sprint 0. Output the plan and wait.
```

### Русский перевод (для понимания, в Claude Code вставлять английский)

```
Ты — ведущий инженер, строящий криптообменник брокерского типа. Я — управляющий проектом. Полное ТЗ в ./SPEC.md — прочитай целиком, прежде чем что-либо делать.

Правила работы:
1. Работай строго по спринтам из раздела 9. Никогда не начинай следующий спринт без моего явного одобрения.
2. В начале каждого спринта: выдай конкретный план (файлы, модули, изменения данных, тесты) и жди моего «go».
3. В конце каждого спринта: отчёт в формате — Сделано / Не сделано / Риски и открытые вопросы / Как проверить. Коротко.
4. Перед реализацией всего, что касается денег, переходов статусов заявок, уровней KYC или выплат — сначала тесты, потом код.
5. Каждый переход статуса заявки идёт через одну функцию `transitionOrder()`, которая проверяет машину состояний и пишет в `order_events`. Никаких прямых обновлений статуса в других местах.
6. Все денежные значения — DECIMAL(36,18), никогда float, никогда JavaScript Number для денег. Используй decimal-библиотеку.
7. К партнёру по исполнению обращаемся только через интерфейс `ExecutionProvider`. Сначала `MockProvider`; реальный провайдер — отдельный адаптер в спринте 4.
8. Никакого localStorage/sessionStorage для бизнес-данных. Сервер — единственный источник истины.
9. Все секреты через переменные окружения. В репо только `.env.example`.
10. Каждый обработчик вебхуков проверяет подпись и идемпотентен.
11. Если ТЗ неоднозначно или нужно архитектурное решение, которого в нём нет — остановись и спроси. Не угадывай. Максимум 3 вопроса за раз.
12. Если что-то в ТЗ технически плохая идея или риск безопасности — скажи прямо до реализации.
13. Стек: Next.js 15 App Router, TypeScript strict, Tailwind + shadcn/ui, PostgreSQL + Prisma, Redis + BullMQ, Auth.js, next-intl, Vitest, Playwright, Docker Compose.
14. Язык кода, комментариев, коммитов — английский. UI — i18n, RU по умолчанию, плюс EN/PL/UK.

Начинай со спринта 0. Выдай план и жди.
```

---

## 11. Как мы работаем (управляющий ↔ Opus)

1. Ты копируешь этот файл как `SPEC.md` в корень нового репо.
2. Запускаешь Claude Code, вставляешь мастер-промпт.
3. Каждый план спринта и каждый отчёт присылаешь мне сюда — я проверяю, ловлю дыры, говорю «go» или «переделать».
4. Решения из раздела 1 (партнёр, юрисдикция, KYC) закрываем параллельно со спринтами 0–3 — к спринту 4 партнёр должен быть выбран и sandbox-доступ получен.
