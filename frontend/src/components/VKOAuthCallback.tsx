import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useStore } from '../store';

export default function VKOAuthCallback() {
  const navigate = useNavigate();
  const checkAuth = useStore((s) => s.checkAuth);
  const isProcessing = useRef(false); // 🔒 Защита от двойного вызова в StrictMode

  useEffect(() => {
    // React 18 StrictMode вызывает useEffect дважды в dev режиме
    if (isProcessing.current) {
      console.log('⚠️ VKOAuthCallback already processing, skipping duplicate call');
      return;
    }
    isProcessing.current = true;

    // Implicit Flow возвращает токен в hash (после #)
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    
    const accessToken = params.get('access_token');
    const userId = params.get('user_id');
    const expiresIn = params.get('expires_in');

    if (accessToken && userId) {
      console.log('✅ VK OAuth token received:', { userId, expiresIn });
      
      // Сохраняем токен на backend
      axios.post('/api/auth/vk/implicit', {
        access_token: accessToken,
        user_id: parseInt(userId),
        expires_in: parseInt(expiresIn || '0'),
      }, { withCredentials: true })
        .then(() => {
          console.log('✅ Token saved to session');
          checkAuth();
          navigate('/');
        })
        .catch((err) => {
          console.error('❌ Failed to save token:', err);
          alert('Ошибка сохранения токена');
          navigate('/');
        });
    } else {
      console.error('❌ No token in URL hash');
      navigate('/');
    }
  }, [navigate, checkAuth]);

  return (
    <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
      <div className="text-center">
        <div className="animate-spin text-4xl mb-4">⏳</div>
        <div>Обработка авторизации...</div>
      </div>
    </div>
  );
}
