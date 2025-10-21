# React StrictMode и двойной вызов OAuth

## 🔴 Проблема

После успешной авторизации через VK ID (через ngrok HTTPS) в логах backend видно:

```
Requesting token from VK ID OAuth...
Requesting token from VK ID OAuth...  ← ДВА РАЗА!
```

Это приводит к **двум одновременным запросам к VK API** с одним и тем же OAuth кодом, что вызывает Flood control (error_code: 9).

## ⚙️ Причина

### React 18 StrictMode

В `frontend/src/main.tsx` приложение обёрнуто в `<React.StrictMode>`:

```tsx
<React.StrictMode>
  <BrowserRouter>
    <Routes>
      <Route path="/auth/callback" element={<AuthCallback />} />
    </Routes>
  </BrowserRouter>
</React.StrictMode>
```

**React 18 в development режиме специально вызывает `useEffect` дважды** внутри StrictMode, чтобы помочь разработчикам выявить побочные эффекты и утечки памяти.

### Последствия

1. Компонент `AuthCallback` монтируется
2. `useEffect` вызывается **первый раз** → отправляет код на backend → backend запрашивает токен у VK
3. React StrictMode **размонтирует** и **снова монтирует** компонент
4. `useEffect` вызывается **второй раз** → отправляет тот же код на backend → backend снова запрашивает токен у VK
5. VK видит два запроса за ~1-2 секунды → **Flood control** (error_code: 9)

## ✅ Решение

### 1. Frontend: защита от повторных вызовов (через useRef)

**Файл:** `frontend/src/components/AuthCallback.tsx`

```tsx
import { useRef } from 'react';

export default function AuthCallback() {
  const isProcessing = useRef(false); // 🔒 Флаг для защиты

  useEffect(() => {
    // Проверяем, не выполняется ли уже обработка
    if (isProcessing.current) {
      console.log('⚠️ AuthCallback already processing, skipping duplicate call');
      return;
    }
    isProcessing.current = true; // Устанавливаем флаг

    // ... остальная логика OAuth (отправка кода на backend)
  }, []);
}
```

**Почему работает:**
- `useRef` сохраняет значение между ре-рендерами
- При первом вызове `isProcessing.current = false` → выполняется запрос → флаг становится `true`
- При втором вызове (StrictMode) `isProcessing.current = true` → запрос пропускается

### 2. Backend: игнорирование повторных кодов (dedupe)

**Файл:** `backend/src/api/auth.ts`

```typescript
// In-memory cache для уже использованных OAuth кодов
const usedOAuthCodes = new Set<string>();

router.post('/vk/callback', async (req, res) => {
  const { code } = req.body;
  
  // Проверяем, не использовали ли мы уже этот код
  if (usedOAuthCodes.has(code)) {
    console.log('⚠️ OAuth code already used, ignoring duplicate request');
    return res.status(200).json({ success: true, message: 'Code already processed' });
  }
  
  usedOAuthCodes.add(code);
  // Очищаем через 5 минут (коды валидны только 60 секунд)
  setTimeout(() => usedOAuthCodes.delete(code), 5 * 60 * 1000);
  
  // ... остальная логика обмена кода на токен через VK ID OAuth
});
```

**Почему работает:**
- Первый запрос с кодом `ABC123` → код добавляется в Set → запрос выполняется
- Второй запрос с тем же кодом `ABC123` → код уже в Set → запрос игнорируется, возвращается `200 OK`
- Фронтенд получает успешный ответ в обоих случаях, но **VK API вызывается только один раз**

**Важно:** Эта защита работает независимо от того, используется ли ngrok или production HTTPS домен.

## 🔧 Дополнительные меры

### Понижение начальной задержки

После исправления двойного запроса можно уменьшить `VK_INITIAL_COOLDOWN_SEC`:

```properties
# backend/.env
VK_INITIAL_COOLDOWN_SEC=10  # вместо 60
```

Теперь основная причина Flood control устранена, и задержка 10 секунд достаточна для стабильной работы.

## Проверка

### Логи backend до исправления:

```
Requesting token from VK ID OAuth...
Requesting token from VK ID OAuth...  ← ДВА РАЗА
VK OAuth response: { ... }
VK OAuth response: { ... }  ← ДВА ОТВЕТА
VK API Error [friends.get]: { error_code: 9 }  ← FLOOD CONTROL
```

### Логи backend после исправления:

```
Requesting token from VK ID OAuth...  ← ОДИН РАЗ
VK OAuth response: { ... }
✅ Access token received
🔍 Building graph for user 403298662...
👥 Depth=1: friends ids total = 123  ← БЕЗ ОШИБОК
```

## Альтернатива: отключить StrictMode (не рекомендуется)

Можно убрать `<React.StrictMode>` из `main.tsx`:

```tsx
// НЕ РЕКОМЕНДУЕТСЯ для разработки
createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
    </Routes>
  </BrowserRouter>
);
```

**Почему не рекомендуется:**
- StrictMode помогает выявить проблемы в коде (утечки памяти, неправильные побочные эффекты)
- В production сборке StrictMode не влияет на поведение
- Лучше исправить код, чем отключать инструмент проверки

## 📊 Итого

✅ **Правильное решение:** защита через `useRef` на фронтенде + dedupe на бэкенде  
❌ **Неправильное решение:** отключение StrictMode или увеличение задержек

Теперь OAuth работает стабильно даже в development режиме с StrictMode, независимо от того, используется ли localhost или ngrok HTTPS.

---

**См. также:**
- [README.md](./README.md) — полная документация проекта с ngrok setup
- [VK_ID_SETUP.md](./VK_ID_SETUP.md) — настройка VK ID через ngrok
- [VK_FLOOD_CONTROL.md](./VK_FLOOD_CONTROL.md) — дополнительные меры защиты от rate limits

**Дата обновления:** 21 января 2025
