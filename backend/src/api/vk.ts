import { Router, Request, Response } from 'express';
import { buildUserFriendsGraph, getProgress, setVkThrottle, setVkRetryOptions } from '../services/vk';

const router = Router();

// GET /api/vk/graph?userId=123
router.get('/graph', async (req: Request, res: Response) => {
  try {
    // Получаем токен от VK ID из сессии
    const vkToken = req.session.vkAccessToken;
    const vkUserId = req.session.vkUserId;
    
    if (!vkToken || !vkUserId) {
      return res.status(401).json({ error: 'Not authenticated. Please login with VK ID first.' });
    }

    const userId = Number(req.query.userId);
    if (!userId) return res.status(400).json({ error: 'userId is required' });
  const depth = Number(req.query.depth || 1);
  const maxFriends = Number(req.query.maxFriends || 10); // Лимит друзей для depth>=2
  const maxFriendsDepth1 = Number(req.query.maxFriendsDepth1 || 0); // 0 = без лимита
  const taskId = typeof req.query.taskId === 'string' ? req.query.taskId : undefined;
  const minIntervalMs = req.query.minIntervalMs ? Number(req.query.minIntervalMs) : undefined;
  const floodCooldownMs = req.query.floodCooldownMs ? Number(req.query.floodCooldownMs) : undefined;
  const maxRetries = req.query.maxRetries ? Number(req.query.maxRetries) : undefined;
  if (Number.isFinite(minIntervalMs)) setVkThrottle(minIntervalMs!);
  if (Number.isFinite(floodCooldownMs) || Number.isFinite(maxRetries)) setVkRetryOptions({ floodCooldownMs, maxRetries });
    
    console.log('🔑 Using VK ID access token for user:', vkUserId);
    console.log(`📊 Parameters: depth=${depth}, maxFriends=${maxFriends}`);
    
  // ИСПОЛЬЗУЕМ ТОКЕН ОТ VK ID для API вызовов
  const graph = await buildUserFriendsGraph(userId, depth, vkToken, maxFriends, maxFriendsDepth1, { taskId });
    res.json(graph);
  } catch (e: any) {
    console.error('Graph build error:', e.message);
    // Специальная обработка для закрытых профилей
    if (e?.message && e.message.includes('This profile is private')) {
      return res.status(403).json({ 
        error: 'Профиль закрыт',
        message: 'Список друзей скрыт настройками приватности.',
        code: 'PRIVATE_PROFILE',
        details: e.message
      });
    }
    res.status(500).json({ error: e?.message || 'VK graph error' });
  }
});

// GET /api/vk/progress?taskId=...
router.get('/progress', (req: Request, res: Response) => {
  const taskId = typeof req.query.taskId === 'string' ? req.query.taskId : undefined;
  if (!taskId) return res.status(400).json({ error: 'taskId is required' });
  const prog = getProgress(taskId);
  if (!prog) return res.status(204).end();
  res.json(prog);
});

export default router;
