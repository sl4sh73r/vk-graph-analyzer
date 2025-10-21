# 🔧 Настройка VK ID приложения для локальной разработки

## ⚠️ Важно: VK ID требует HTTPS!

VK ID OAuth 2.0 **не работает** с `http://localhost` — требуется **HTTPS**. Для локальной разработки используйте **ngrok**.

## 📋 Что понадобится

1. **VK ID приложение** (создайте на [id.vk.com](https://id.vk.com))
2. **ngrok** (для HTTPS туннелинга)
3. **Node.js 18+** и npm/pnpm

## 🚀 Быстрая настройка

### Шаг 1: Установка и запуск ngrok

#### macOS (Homebrew):
```sh
brew install ngrok/ngrok/ngrok
```

#### Linux/Windows:
Скачайте с [ngrok.com/download](https://ngrok.com/download)

#### Настройка authtoken:
```sh
# Зарегистрируйтесь на ngrok.com и получите токен
ngrok config add-authtoken ваш_токен_здесь
```

#### Запуск туннеля:
```sh
ngrok http 5173
```

Вы увидите:
```
Forwarding  https://abc123xyz.ngrok-free.app -> http://localhost:5173
```

**Сохраните этот домен** — он понадобится для настройки VK ID!

### Шаг 2: Создание VK ID приложения

1. Откройте [id.vk.com](https://id.vk.com)
2. Нажмите **"Создать приложение"**
3. Выберите тип: **"Web-сайт"**
4. Укажите название (например, "VK Graph Analyzer")

### Шаг 3: Настройка VK ID приложения

#### 3.1 Redirect URI

В разделе **"OAuth настройки"** → **"Redirect URI"**:

```
https://ваш-домен.ngrok-free.app/auth/callback
```

**Замените** `ваш-домен.ngrok-free.app` на домен из ngrok!

Примеры:
- ✅ `https://abc123xyz.ngrok-free.app/auth/callback`
- ❌ `http://localhost:5173/auth/callback` (не работает с VK ID!)

#### 3.2 Права доступа (Scopes)

Включите:
- ✅ **vkid.personal_info** (базовая информация о пользователе)
- ✅ **friends** (доступ к списку друзей) — **обязательно для графа!**

Опционально:
- email (если нужен email)
- phone (если нужен телефон)

#### 3.3 Получите креденшиалы

Сохраните:
1. **App ID** (числовой идентификатор, например: `51976342`)
2. **Client Secret** (секретный ключ приложения)

#### 3.4 Получите Service Key (опционально)

Для запасного доступа к VK API:
1. Настройки → **Доступ к API** → **Сервисный ключ доступа**
2. Скопируйте ключ

### Шаг 4: Настройка переменных окружения

#### Backend (backend/.env):

```properties
# VK OAuth App credentials
VK_APP_ID=ваш_app_id_здесь
VK_CLIENT_SECRET=ваш_client_secret_здесь
VK_REDIRECT_URI=https://ваш-домен.ngrok-free.app/auth/callback

# Backend server
PORT=4000

# CORS (должен совпадать с ngrok доменом!)
CORS_ORIGIN=https://ваш-домен.ngrok-free.app

# Session secret (минимум 32 символа)
SESSION_SECRET=случайная_строка_для_сессий_минимум_32_символа

# VK Service Key (опционально)
VK_SERVICE_KEY=ваш_service_key_если_есть

# Flood control protection
VK_INITIAL_COOLDOWN_SEC=10
```

#### Frontend (frontend/.env):

```properties
VITE_VK_APP_ID=ваш_app_id_здесь
VITE_VK_REDIRECT_URI=https://ваш-домен.ngrok-free.app/auth/callback
```

**⚠️ Важно:** Во всех файлах используйте **одинаковый ngrok домен**!

### Шаг 5: Запуск приложения

Откройте **3 терминала**:

**Терминал 1 — ngrok:**
```sh
ngrok http 5173
# Не закрывайте этот терминал!
```

**Терминал 2 — Backend:**
```sh
cd backend
npm install  # если еще не устанавливали
npm run dev
```

Backend запустится на `http://localhost:4000`

**Терминал 3 — Frontend:**
```sh
cd frontend
npm install  # если еще не устанавливали
npm run dev
```

Frontend запустится на `http://localhost:5173`

### Шаг 6: Проверка

1. Откройте в браузере: `https://ваш-домен.ngrok-free.app`
2. Нажмите **"Войти через VK ID"**
3. Авторизуйтесь через VK
4. После успешной авторизации вас вернёт на главную страницу
5. Теперь можно строить граф!

## 🔧 Важные настройки приватности ВКонтакте

### Список друзей должен быть публичным!

Если API возвращает пустой список друзей:

1. Откройте [vk.com/settings](https://vk.com/settings?act=privacy)
2. Раздел **"Приватность"**
3. Найдите **"Кто видит список моих друзей и подписок"**
4. Установите: **"Все пользователи"**

Без этого API не сможет получить список друзей!

## 🐛 Troubleshooting

### Проблема: CORS ошибка после авторизации

**Симптомы:**
```
Access-Control-Allow-Origin header is missing
```

**Решение:**
1. Убедитесь, что `CORS_ORIGIN` в `backend/.env` совпадает с ngrok доменом
2. Перезапустите backend: `npm run dev`
3. Очистите кэш браузера (Cmd+Shift+R на Mac / Ctrl+Shift+R на Windows/Linux)

### Проблема: OAuth redirect_uri mismatch

**Симптомы:**
```
error=redirect_uri_mismatch
```

**Решение:**
1. Проверьте, что Redirect URI в настройках VK ID **точно** совпадает с `VK_REDIRECT_URI` в `.env`
2. Должен быть формат: `https://домен.ngrok-free.app/auth/callback`
3. Подождите 5-10 минут после изменения настроек VK ID
4. Попробуйте снова

### Проблема: ngrok домен меняется при рестарте

**Почему:** ngrok free план выдаёт случайный домен при каждом запуске

**Решения:**

**Вариант 1 (платная подписка ngrok):**
```sh
ngrok http 5173 --domain=your-permanent-domain.ngrok-free.app
```

**Вариант 2 (обновляйте настройки):**
1. Запустите ngrok → получите новый домен
2. Обновите `backend/.env` и `frontend/.env`
3. Обновите Redirect URI в настройках VK ID
4. Перезапустите backend и frontend

### Проблема: 401 Unauthorized при /api/auth/me

**Решение:** Это нормально **до авторизации**. После успешного входа через VK ошибка исчезнет.

### Проблема: Flood control (error_code: 9)

**Причины:**
1. React StrictMode вызывает useEffect дважды → два запроса OAuth
2. Слишком частые запросы к VK API

**Решения:**
1. ✅ **Уже исправлено:** защита от двойного OAuth (useRef + backend deduplication)
2. Увеличьте `VK_INITIAL_COOLDOWN_SEC=30` в `backend/.env`
3. В UI увеличьте слайдер "Скорость запросов к VK" до 2000-3000 мс

**Читайте:** [VK_FLOOD_CONTROL.md](./VK_FLOOD_CONTROL.md) и [REACT_STRICTMODE_OAUTH.md](./REACT_STRICTMODE_OAUTH.md)

### Проблема: Не загружается список друзей

**Причины:**
1. Список друзей приватный (см. выше "Настройки приватности")
2. VK API лимиты исчерпаны (подождите 10-15 минут)

**Решение:**
1. Сделайте список друзей публичным
2. Подождите ~15 минут для снятия лимитов
3. Увеличьте задержки между запросами в настройках приложения

## 📚 Полезные ссылки

- [VK ID документация](https://id.vk.com/about/business/go/docs/ru/vkid/latest/vk-id/connection/api-integration/web-integration/vk-id-sdk)
- [VK API Methods](https://dev.vk.com/ru/method)
- [OAuth 2.0 PKCE](https://id.vk.com/about/business/go/docs/ru/vkid/latest/vk-id/connection/pkce)
- [ngrok Documentation](https://ngrok.com/docs)

## ⚡ Быстрый чеклист

- [ ] ngrok запущен и выдал HTTPS домен
- [ ] VK ID приложение создано
- [ ] Redirect URI в VK ID = `https://домен.ngrok/auth/callback`
- [ ] Scope `friends` включен в VK ID
- [ ] `backend/.env` заполнен (VK_APP_ID, VK_CLIENT_SECRET, VK_REDIRECT_URI, CORS_ORIGIN)
- [ ] `frontend/.env` заполнен (VITE_VK_APP_ID, VITE_VK_REDIRECT_URI)
- [ ] Все URL используют **одинаковый** ngrok домен
- [ ] Список друзей публичный в настройках ВКонтакте
- [ ] Backend запущен на :4000
- [ ] Frontend запущен на :5173
- [ ] Открываете приложение через **https://домен.ngrok** (не localhost!)

Готово! Теперь приложение должно работать 🎉
