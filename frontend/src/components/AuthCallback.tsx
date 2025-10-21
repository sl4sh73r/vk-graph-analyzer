import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useStore } from '../store';

export default function AuthCallback() {
  const navigate = useNavigate();
  const checkAuth = useStore((s) => s.checkAuth);
  const isProcessing = useRef(false); // 🔒 Защита от двойного вызова в StrictMode

  useEffect(() => {
    // React 18 StrictMode вызывает useEffect дважды в dev режиме
    // Используем ref для защиты от повторного выполнения
    if (isProcessing.current) {
      console.log('⚠️ AuthCallback already processing, skipping duplicate call');
      return;
    }
    isProcessing.current = true;

    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state');
      const device_id = params.get('device_id'); // VK ID возвращает device_id
      const error = params.get('error');

      if (error) {
        alert(`Ошибка авторизации: ${error}`);
        navigate('/');
        return;
      }

      if (!code) {
        navigate('/');
        return;
      }

      // Получаем сохраненные параметры
      const savedCodeVerifier = sessionStorage.getItem('vk_code_verifier');
      const savedState = sessionStorage.getItem('vk_state');

      // Проверяем state для защиты от CSRF атак
      if (state && savedState && state !== savedState) {
        alert('Ошибка: несовпадение state параметра. Возможная CSRF атака.');
        navigate('/');
        return;
      }

      if (!savedCodeVerifier) {
        alert('Ошибка: отсутствует code_verifier. Попробуйте авторизоваться заново.');
        navigate('/');
        return;
      }

      try {
        console.log('🔐 Exchanging code for token...');
        // Отправляем code, code_verifier, device_id на бэкенд
        // Для VK ID OAuth все параметры обязательны
        await axios.post(
          '/api/auth/vk/callback',
          {
            code,
            code_verifier: savedCodeVerifier,
            device_id: device_id || '',
            state,
          },
          { withCredentials: true }
        );

        // Очищаем временные данные
        sessionStorage.removeItem('vk_code_verifier');
        sessionStorage.removeItem('vk_state');

        await checkAuth();
        navigate('/');
      } catch (e: any) {
        console.error(e);
        alert('Ошибка при обмене кода на токен');
        navigate('/');
      }
    };

    handleCallback();
  }, [navigate, checkAuth]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-gray-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
        <p>Авторизация через VK ID...</p>
      </div>
    </div>
  );
}
