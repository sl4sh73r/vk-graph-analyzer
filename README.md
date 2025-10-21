# VK Graph Analyzer

Современное веб-приложение для анализа социального графа ВКонтакте с расчётом метрик центральности (closeness, betweenness, eigenvector, rooted). Включает интерактивную визуализацию с градиентной раскраской узлов, расширение графа от любого узла, настройку глубины анализа и защиту от VK Flood control.

**Технологии:**
- Backend: Node.js, Express, TypeScript, axios, graphology
- Frontend: React 18, Vite, TypeScript, react-force-graph-2d, Zustand, Tailwind CSS
- Авторизация: VK ID OAuth 2.0 с PKCE

## Требования

- **Node.js 18+** и npm/pnpm
- **ngrok** (для доступа к VK API через HTTPS, т.к. VK ID требует HTTPS redirect URI)
- **VK ID приложение** (создайте на [id.vk.com](https://id.vk.com))

## Установка ngrok

### macOS (через Homebrew):
```sh
brew install ngrok/ngrok/ngrok
```

### Linux/Windows:
Скачайте с [ngrok.com/download](https://ngrok.com/download) и добавьте в PATH.

### Настройка ngrok:
1. Зарегистрируйтесь на [ngrok.com](https://ngrok.com)
2. Получите authtoken в дашборде
3. Настройте токен:
   ```sh
   ngrok config add-authtoken ваш_токен
   ```

## Настройка VK ID приложения

**Важно:** VK ID OAuth требует **HTTPS** redirect URI, поэтому нужен ngrok для локальной разработки.

1. Зайдите на [id.vk.com](https://id.vk.com) и создайте новое приложение (тип: **Web**)
2. В настройках приложения:
   - **Redirect URI**: `https://ваш-домен.ngrok-free.app/auth/callback` (получите после запуска ngrok)
   - Тип авторизации: **OAuth 2.0 PKCE**
   - Включите scope: **friends** (доступ к списку друзей), **vkid.personal_info** (базовая информация)
3. Сохраните:
   - **App ID** (числовой идентификатор)
   - **Client Secret** (секретный ключ)
4. Получите **Service Key** (Настройки → Доступ к API → Сервисный ключ доступа) — опционально, для запасного доступа

**Важно:** Список друзей пользователя должен быть публичным! Проверьте в настройках приватности ВКонтакте: Настройки → Приватность → "Кто видит список моих друзей" → Все пользователи.

Подробнее: [VK_ID_SETUP.md](./VK_ID_SETUP.md)

## Быстрый старт

### 1. Клонирование и установка зависимостей

```sh
git clone <your-repo>
cd vk-graph-analyzer
npm install          # установка root зависимостей
cd backend && npm install
cd ../frontend && npm install
cd ../shared && npm install
```

Или используйте скрипты:
```sh
npm run install:backend
npm run install:frontend
```

### 2. Настройка переменных окружения

**Backend** (`backend/.env`):

```sh
cp backend/.env.example backend/.env
```

Заполните:
```properties
# VK OAuth App credentials
VK_APP_ID=54255869
VK_CLIENT_SECRET=ваш_client_secret
VK_REDIRECT_URI=https://ваш-домен.ngrok-free.app/auth/callback
PORT=4000
CORS_ORIGIN=https://ваш-домен.ngrok-free.app
SESSION_SECRET=случайная_строка_для_сессий_минимум_32_символа

# VK Service Key (опционально, для запасного доступа)
VK_SERVICE_KEY=ваш_service_key

# Задержка перед первым запросом к VK API (секунды)
# Устанавливайте 10-30 если получаете Flood control
VK_INITIAL_COOLDOWN_SEC=10
```

**Frontend** (`frontend/.env`):

```sh
cp frontend/.env.example frontend/.env
```

Заполните:
```properties
VITE_VK_APP_ID=54255869
VITE_VK_REDIRECT_URI=https://ваш-домен.ngrok-free.app/auth/callback
```

### 3. Запуск ngrok

**Важно:** Запустите ngrok **перед** запуском приложения, чтобы получить HTTPS домен.

```sh
ngrok http 5173
```

Вы увидите:
```
Forwarding  https://abc123.ngrok-free.app -> http://localhost:5173
```

**Скопируйте этот домен** и замените `ваш-домен.ngrok-free.app` в `.env` файлах обоих проектов (backend и frontend).

**Не забудьте:** обновить **Redirect URI** в настройках VK ID приложения на `https://abc123.ngrok-free.app/auth/callback`

### 4. Запуск приложения

Откройте **три терминала**:

**Терминал 1 — ngrok (уже запущен):**
```sh
ngrok http 5173
```

**Терминал 2 — Backend:**
```sh
cd backend
npm run dev
```

Backend запустится на `http://localhost:4000`

**Терминал 3 — Frontend:**
```sh
cd frontend
npm run dev
```

Frontend запустится на `http://localhost:5173` (проксирует `/api` → `http://localhost:4000`)

### 5. Открытие приложения

Откройте в браузере:
```
https://ваш-домен.ngrok-free.app
```

**Не используйте** `http://localhost:5173` — VK ID OAuth не будет работать без HTTPS!

## Использование

1. Откройте `https://ваш-домен.ngrok-free.app`
2. Нажмите **«Войти через VK ID»** в боковой панели
3. Авторизуйтесь через VK (откроется окно VK ID)
4. После редиректа обратно:
   - Выберите пользователя для анализа (себя или введите другой VK ID)
   - Выберите **глубину анализа** (1-3 уровня)
   - Выберите **метрики** для расчёта (можно несколько сразу)
   - Выберите **метрику для визуализации**
   - Настройте **скорость запросов к VK** (если получаете Flood control)
5. Нажмите **«Построить граф»**

### Возможности

- 📊 **Множественный выбор метрик**: считайте closeness, betweenness, eigenvector, rooted одновременно
- 🎯 **Личная важность (rooted)**: метрика, где вы всегда 100%, остальные по убыванию близости к вам
- 🔍 **Расширение графа**: кликните по узлу → «Построить граф от этого пользователя» → граф мёржится
- 🎨 **Градиентная визуализация**: цвет и размер узла зависят от центральности
- 🚀 **Прогресс построения**: видите процент выполнения и текущую фазу
- 🎚️ **Контроль Flood control**: регулируйте скорость запросов к VK (300-3000 мс)
- 📋 **Список участников**: правая панель со всеми узлами графа, поиском и ссылками на профили
- 💾 **Кеширование**: список друзей кешируется на 6 часов (в памяти и на диске)

### Метрики центральности

- **Closeness** (близость): насколько узел близок ко всем остальным
- **Betweenness** (посредничество): как часто узел находится на кратчайших путях между другими
- **Eigenvector** (влиятельность): насколько важны соседи узла
- **Rooted** (личная важность): расстояние от выбранного пользователя (вы = 100%, друзья = меньше)
- **All** (среднее): среднее по выбранным метрикам

## API Endpoints

### Авторизация
- `POST /api/auth/vk/callback` — обмен OAuth кода на access_token (внутренний)
- `POST /api/auth/vk/implicit` — сохранение токена из Implicit Flow (устаревший)
- `GET /api/auth/me` — проверка текущей сессии
- `POST /api/auth/logout` — выход из системы

### Граф
- `GET /api/vk/graph?userId=ID&depth=1-3&maxFriends=N&taskId=...&minIntervalMs=...` — построение графа друзей
  - Требует авторизации (access token в сессии)
  - Поддерживает кеширование и прогресс-трекинг
- `GET /api/vk/progress?taskId=...` — получение прогресса построения графа

### Центральность
- `POST /api/graph/centrality` — расчёт метрик центральности
  - Body: `{ nodes, links, metric, rootUserId? }`
  - Возвращает: `{ closeness, betweenness, eigenvector, rooted? }`

## Архитектура

```
vk-graph-analyzer/
├── backend/               # Express API + VK OAuth
│   ├── src/
│   │   ├── index.ts      # Entry point + Express setup
│   │   ├── api/
│   │   │   ├── auth.ts   # VK ID OAuth endpoints
│   │   │   ├── vk.ts     # VK API proxy (graph build)
│   │   │   └── graph.ts  # Centrality computation
│   │   ├── services/
│   │   │   └── vk.ts     # VK API wrapper + caching + throttling
│   │   ├── utils/
│   │   │   └── centrality.ts  # Graphology centrality metrics
│   │   └── types/
│   │       └── ambient.d.ts   # Type declarations
│   ├── .cache/           # On-disk cache for friends.get (TTL 6h)
│   ├── .env              # Environment variables
│   └── package.json
├── frontend/              # React + Vite SPA
│   ├── src/
│   │   ├── App.tsx       # Main layout
│   │   ├── main.tsx      # Entry point + router
│   │   ├── store.ts      # Zustand state management
│   │   ├── components/
│   │   │   ├── AuthCallback.tsx      # VK OAuth callback handler
│   │   │   ├── GraphView.tsx         # Force graph visualization
│   │   │   ├── Sidebar.tsx           # Left panel (controls)
│   │   │   ├── RightSidebar.tsx      # Right panel (node list)
│   │   │   └── VKLoginButton.tsx     # VK ID login button
│   │   └── styles.css    # Tailwind CSS
│   ├── .env              # Vite environment variables
│   └── package.json
├── shared/                # Shared TypeScript types
│   ├── src/
│   │   └── index.ts      # Common types (VKGraph, CentralityMetric, etc.)
│   └── package.json
├── README.md             # Эта документация
├── VK_ID_SETUP.md        # Подробная настройка VK ID
├── VK_FLOOD_CONTROL.md   # Решение проблем с Flood control
└── REACT_STRICTMODE_OAUTH.md  # Исправление двойного вызова OAuth
```

## Безопасность

- ✅ VK access token хранится **только на сервере** в сессии (express-session + secure cookies)
- ✅ Client secret **никогда не передаётся на фронтенд**
- ✅ PKCE (Proof Key for Code Exchange) для OAuth 2.0
- ✅ CSRF защита через state параметр
- ✅ Rate limiting на backend (express-rate-limit)
- ✅ CORS настроен на конкретный origin
- ✅ Helmet.js для security headers
- ✅ Деduplication OAuth кодов (защита от двойного использования)

## Производительность и оптимизации

### Кеширование
- **In-memory cache**: список друзей кешируется на время работы сервера
- **On-disk cache**: `.cache/friends/{userId}.json` с TTL 6 часов, переживает рестарты
- **Deduplication**: проверка на повторные запросы к одному и тому же userId

### Throttling и Backoff
- **Global throttling**: минимальный интервал между VK API запросами (по умолчанию 1200 мс)
- **Exponential backoff**: при ошибке Flood control (код 9) задержки увеличиваются: 2s → 4s → 8s → ... → 30s
- **Jitter**: случайная задержка ±20% для распределения нагрузки
- **Cooldown**: финальная пауза 30 секунд перед последней попыткой
- **Настраиваемый throttling**: пользователь может изменить интервал через UI (300-3000 мс)

### Построение графа
- **Batching**: запросы `users.get` по 100 ID за раз
- **Depth control**: глубина 1-3 уровня (depth=3 может создать десятки тысяч узлов!)
- **Limit control**: ограничение количества друзей на depth=1 (0 = без ограничений)
- **Progress tracking**: серверный прогресс с polling endpoint для UI

## Проблемы и решения

### Flood Control (error_code: 9)

**Проблема:** VK API блокирует запросы с сообщением "Flood control"

**Причины:**
1. **React StrictMode вызывает useEffect дважды** → два одновременных запроса к VK
2. Слишком частые запросы (< 1 секунды между вызовами)
3. История запросов за последние 10-15 минут

**Решения:**
1. ✅ **Исправлен двойной OAuth callback** (useRef защита + backend deduplication)
2. ✅ **Initial cooldown**: задержка 10 секунд перед первым запросом (если нет кеша)
3. ✅ **Throttling**: минимум 1200 мс между запросами (настраивается в UI)
4. ✅ **Exponential backoff**: автоматические повторы с увеличивающейся задержкой

**Читайте:**
- [REACT_STRICTMODE_OAUTH.md](./REACT_STRICTMODE_OAUTH.md) — исправление двойного OAuth
- [VK_FLOOD_CONTROL.md](./VK_FLOOD_CONTROL.md) — полное руководство по Flood control

### Приватность списка друзей

**Проблема:** API возвращает пустой список друзей или ошибку доступа

**Решение:** В настройках ВКонтакте: Настройки → Приватность → "Кто видит список моих друзей" → **Все пользователи**

### ngrok домен меняется при рестарте

**Проблема:** При перезапуске ngrok выдаёт новый домен, приходится обновлять настройки VK ID

**Решение (платная подписка ngrok):**
```sh
ngrok http 5173 --domain=your-permanent-domain.ngrok-free.app
```

Или используйте локальный туннель с статическим доменом (локальный nginx + SSL сертификат).

### React StrictMode вызывает useEffect дважды

**Проблема:** Два запроса OAuth токена → Flood control

**Решение:** Защита через `useRef` + backend deduplication (уже реализовано)

Подробнее: [REACT_STRICTMODE_OAUTH.md](./REACT_STRICTMODE_OAUTH.md)

## Разработка

### Структура пакетов (монорепозиторий)

Используется pnpm workspace (или npm workspaces):

```json
{
  "workspaces": ["backend", "frontend", "shared"]
}
```

### Скрипты

```sh
# Установка зависимостей
npm run install:backend
npm run install:frontend

# Запуск разработки
npm run dev:backend    # backend на :4000
npm run dev:frontend   # frontend на :5173

# Сборка production
npm run build:backend
npm run build:frontend

# Typecheck
cd backend && npm run typecheck
cd frontend && npm run typecheck
```

### Добавление новых метрик

1. Добавьте метрику в `shared/src/index.ts`:
   ```ts
   export type CentralityMetric = 'closeness' | 'betweenness' | 'eigenvector' | 'rooted' | 'your-metric';
   ```

2. Реализуйте расчёт в `backend/src/utils/centrality.ts`:
   ```ts
   if (metric === 'your-metric' || metric === 'all') {
     result.yourMetric = computeYourMetric(graph);
   }
   ```

3. Обновите UI в `frontend/src/components/Sidebar.tsx`

### Отладка

**Backend:**
```sh
cd backend
npm run dev  # nodemon автоматически перезапускает при изменениях
```

**Frontend:**
```sh
cd frontend
npm run dev  # Vite HMR
```

**Логи VK API:** все запросы логируются в консоль backend с параметрами и ответами

## Production Deployment

### Backend

```sh
cd backend
npm run build      # компиляция TypeScript
npm start          # запуск production сервера
```

Установите переменные окружения:
```properties
NODE_ENV=production
VK_APP_ID=...
VK_CLIENT_SECRET=...
VK_REDIRECT_URI=https://your-domain.com/auth/callback
PORT=4000
CORS_ORIGIN=https://your-domain.com
SESSION_SECRET=secure-random-string-min-32-chars
VK_SERVICE_KEY=...
VK_INITIAL_COOLDOWN_SEC=10
```

### Frontend

```sh
cd frontend
npm run build      # Vite создаст dist/
```

Деплой `dist/` на:
- Vercel
- Netlify
- Nginx + static hosting
- CDN (CloudFlare, AWS CloudFront)

Установите env:
```properties
VITE_VK_APP_ID=...
VITE_VK_REDIRECT_URI=https://your-domain.com/auth/callback
```

### Reverse Proxy (Nginx)

```nginx
# Frontend (static)
location / {
    root /var/www/vk-graph-analyzer/frontend/dist;
    try_files $uri /index.html;
}

# Backend API
location /api {
    proxy_pass http://localhost:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

## Лицензия

MIT

## Автор

[Ваше имя / GitHub username]

## Благодарности

- [VK API](https://dev.vk.com) за доступ к социальному графу
- [graphology](https://graphology.github.io) за алгоритмы графов
- [react-force-graph](https://github.com/vasturiano/react-force-graph) за визуализацию
- [ngrok](https://ngrok.com) за HTTPS туннелинг

## Известные ограничения

- VK API лимит: ~3 запроса/сек с VK ID token, ~300 запросов/5 мин с Service Key
- Depth=3 может создать граф с >10,000 узлами (медленно в браузере)
- Список друзей должен быть публичным у пользователя
- ngrok free план выдаёт новый домен при каждом рестарте

## Roadmap

- [ ] Поддержка больше метрик (PageRank, Katz, HITS)
- [ ] Фильтрация графа по метрикам
- [ ] Экспорт графа (PNG, JSON, GraphML)
- [ ] Кластеризация и community detection
- [ ] Temporal анализ (изменения графа во времени)
- [ ] Поддержка других социальных сетей

## Дополнительная документация

- [VK_ID_SETUP.md](./VK_ID_SETUP.md) — Подробная настройка VK ID OAuth
- [VK_FLOOD_CONTROL.md](./VK_FLOOD_CONTROL.md) — Решение проблем с Flood control
- [REACT_STRICTMODE_OAUTH.md](./REACT_STRICTMODE_OAUTH.md) — Исправление двойного вызова OAuth
- [VK_API_TOKEN_INFO.md](./VK_API_TOKEN_INFO.md) — Информация о токенах VK API
