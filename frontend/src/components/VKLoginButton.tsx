import React, { useEffect, useRef } from 'react';

interface VKLoginButtonProps {
  appId: string;
  redirectUri: string;
}

// Генерация случайной строки для PKCE
function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

declare global {
  interface Window {
    VKIDSDK?: {
      Config: {
        init: (config: {
          app: number;
          redirectUrl: string;
          mode?: number;
          scope?: string;
          state?: string;
          codeVerifier?: string;
        }) => void;
      };
      FloatingOneTap?: any;
      OneTap?: any;
    };
  }
}

export default function VKLoginButton({ appId, redirectUri }: VKLoginButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const [sdkFailed, setSdkFailed] = React.useState(false);

  useEffect(() => {
    if (!appId || !containerRef.current || initializedRef.current) return;

    // Ждём загрузки SDK (таймаут 3 секунды)
    let attempts = 0;
    const maxAttempts = 30;

    const initSDK = () => {
      attempts++;

      if (!window.VKIDSDK) {
        if (attempts < maxAttempts) {
          setTimeout(initSDK, 100);
        } else {
          console.warn('VK ID SDK not loaded, using fallback button');
          setSdkFailed(true);
        }
        return;
      }

      try {
        // Генерируем PKCE параметры согласно документации
        const codeVerifier = generateRandomString(64); // 43-128 символов
        const state = generateRandomString(32); // минимум 32 символа

        // Сохраняем в sessionStorage для последующей передачи на бэкенд
        sessionStorage.setItem('vk_code_verifier', codeVerifier);
        sessionStorage.setItem('vk_state', state);

        // Инициализация VK ID SDK с PKCE
        window.VKIDSDK.Config.init({
          app: Number(appId),
          redirectUrl: redirectUri,
          scope: 'friends email phone',
          state: state,
          codeVerifier: codeVerifier,
        });

        // Создаём кнопку One Tap если SDK поддерживает
        if (window.VKIDSDK.OneTap) {
          const oneTap = new window.VKIDSDK.OneTap();
          oneTap.render({
            container: containerRef.current,
            showAlternativeLogin: true,
          });
          initializedRef.current = true;
        } else {
          setSdkFailed(true);
        }
      } catch (error) {
        console.error('VK ID SDK initialization error:', error);
        setSdkFailed(true);
      }
    };

    initSDK();
  }, [appId, redirectUri]);

  // Fallback: простая кнопка с редиректом
  const handleManualLogin = async () => {
    const codeVerifier = generateRandomString(64);
    const state = generateRandomString(32);

    sessionStorage.setItem('vk_code_verifier', codeVerifier);
    sessionStorage.setItem('vk_state', state);

    // Генерируем code_challenge из code_verifier
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const codeChallenge = btoa(String.fromCharCode(...hashArray))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    const authUrl = `https://id.vk.com/authorize?response_type=code&client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=friends&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`;
    window.location.href = authUrl;
  };

  return (
    <div className="vk-login-container space-y-2">
      {/* Контейнер для SDK кнопки */}
      {!sdkFailed && <div ref={containerRef} className="w-full min-h-[44px]" />}

      {/* Fallback кнопка с улучшенным дизайном */}
      {sdkFailed && (
        <button
          onClick={handleManualLogin}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 transition-all rounded-lg p-3 flex items-center justify-center gap-3 text-white font-medium shadow-lg hover:shadow-xl relative overflow-hidden group"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-blue-500 opacity-0 group-hover:opacity-20 transition-opacity"></div>
          <svg className="w-6 h-6 relative z-10" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12c0 5.52 4.48 10 10 10s10-4.48 10-10S17.52 2 12 2zm3.17 13.7c-.17.18-.44.29-.72.29h-1.1c-.65 0-.86-.41-1.88-1.43-.88-.88-1.28-.98-1.5-.98-.31 0-.39.08-.39.47v1.3c0 .35-.11.56-1.04.56-1.54 0-3.25-.93-4.45-2.66C2.78 11.03 2.4 8.56 2.4 8.17c0-.22.08-.43.47-.43h1.1c.44 0 .6.2.77.66.88 2.45 2.35 4.6 2.96 4.6.23 0 .33-.11.33-.68V9.58c-.08-1.29-.75-1.4-.75-1.85 0-.18.15-.35.39-.35h1.73c.37 0 .5.19.5.61v3.32c0 .37.17.5.27.5.23 0 .42-.13.83-.54 1.26-1.42 2.16-3.61 2.16-3.61.12-.26.31-.51.78-.51h1.1c.66 0 .8.34.66.8-.22.82-2.48 4.33-2.48 4.33-.19.31-.24.45 0 .79.18.25.78.76 1.18 1.22.74.84 1.31 1.54 1.46 2.03.15.48-.08.72-.74.72z"/>
          </svg>
          <span className="relative z-10">Войти через VK ID</span>
        </button>
      )}

      {!appId && (
        <div className="text-red-400 text-xs p-2 bg-red-900/20 rounded border border-red-500/30">
          ⚠️ VK_APP_ID не настроен
        </div>
      )}
    </div>
  );
}

