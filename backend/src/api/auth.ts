import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

// In-memory cache для уже использованных OAuth кодов (защита от повторного использования)
const usedOAuthCodes = new Set<string>();

declare module 'express-session' {
  interface SessionData {
    vkAccessToken?: string;
    vkUserId?: number;
    vkRefreshToken?: string;
  }
}

// POST /api/auth/vk/callback
// VK ID OAuth для авторизации
router.post('/vk/callback', async (req: Request, res: Response) => {
  try {
    const { code, code_verifier, device_id, state } = req.body;
    
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Missing code parameter' });
    }

    // 🔒 Защита от повторного использования кода (React StrictMode вызывает useEffect дважды)
    if (usedOAuthCodes.has(code)) {
      console.log('⚠️ OAuth code already used, ignoring duplicate request');
      return res.status(200).json({ success: true, message: 'Code already processed' });
    }
    usedOAuthCodes.add(code);
    // Очищаем старые коды через 5 минут (коды валидны только 60 секунд, но подстрахуемся)
    setTimeout(() => usedOAuthCodes.delete(code), 5 * 60 * 1000);

    if (!code_verifier || typeof code_verifier !== 'string') {
      return res.status(400).json({ error: 'Missing code_verifier parameter' });
    }

    const appId = process.env.VK_APP_ID;
    const clientSecret = process.env.VK_CLIENT_SECRET;
    const redirectUri = process.env.VK_REDIRECT_URI;

    if (!appId || !clientSecret || !redirectUri) {
      return res.status(500).json({ error: 'VK OAuth not configured' });
    }

    // Exchange code for access_token через VK ID OAuth
    const tokenUrl = 'https://id.vk.com/oauth2/auth';
    
    const tokenParams = {
      grant_type: 'authorization_code',
      code: code,
      code_verifier: code_verifier, // PKCE verifier обязателен!
      client_id: appId,
      redirect_uri: redirectUri,
      device_id: device_id || '',
      state: state || '',
    };

    console.log('Requesting token from VK ID OAuth...');

    const { data } = await axios.post(tokenUrl, tokenParams, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    console.log('VK OAuth response:', data);

    const { access_token, user_id, refresh_token, scope } = data;
    if (!access_token) {
      return res.status(500).json({ error: 'Failed to obtain access token', details: data });
    }

    if (!user_id) {
      return res.status(500).json({ error: 'User ID not returned from VK ID' });
    }

    console.log('✅ Access token received');
    console.log('✅ User ID:', user_id);
    console.log('✅ Scope:', scope);

    // Save token in session
    req.session.vkAccessToken = access_token;
    req.session.vkUserId = user_id;
    if (refresh_token) req.session.vkRefreshToken = refresh_token;

    console.log('Session saved successfully');

    res.json({ success: true, userId: user_id });
  } catch (e: any) {
    console.error('OAuth error:', e.response?.data || e.message);
    res.status(500).json({ error: e?.response?.data || e?.message || 'OAuth error' });
  }
});

// POST /api/auth/vk/implicit
// Сохранение токена из Implicit Flow
router.post('/vk/implicit', async (req: Request, res: Response) => {
  try {
    const { access_token, user_id, expires_in } = req.body;
    
    if (!access_token || !user_id) {
      return res.status(400).json({ error: 'access_token and user_id are required' });
    }

    console.log('✅ VK OAuth Implicit Flow token received');
    console.log('✅ User ID:', user_id);

    // Save token in session
    req.session.vkAccessToken = access_token;
    req.session.vkUserId = user_id;

    console.log('✅ Token saved to session');

    res.json({ success: true, userId: user_id });
  } catch (e: any) {
    console.error('Implicit Flow error:', e.message);
    res.status(500).json({ error: e?.message || 'Token save error' });
  }
});

// GET /api/auth/me
router.get('/me', (req: Request, res: Response) => {
  if (!req.session.vkAccessToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({ userId: req.session.vkUserId, authenticated: true });
});

// POST /api/auth/logout
router.post('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.json({ success: true });
  });
});

export default router;
