import axios from 'axios';
import fs from 'fs';
import path from 'path';

export interface VKNode { id: number; name: string; photo: string }
export interface VKLink { source: number; target: number }
export interface VKGraph { nodes: VKNode[]; links: VKLink[] }

const VK_API = 'https://api.vk.com/method';
const API_VERSION = '5.199';
const CACHE_DIR = path.resolve(process.cwd(), '.cache');
const FRIENDS_CACHE_DIR = path.join(CACHE_DIR, 'friends');

function ensureCacheDirs() {
  try {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR);
    if (!fs.existsSync(FRIENDS_CACHE_DIR)) fs.mkdirSync(FRIENDS_CACHE_DIR);
  } catch (e) {
    // ignore cache dir errors
  }
}

function readFriendsCache(userId: number, ttlMs = 1000 * 60 * 60 * 6 /* 6h */): number[] | null {
  try {
    ensureCacheDirs();
    const file = path.join(FRIENDS_CACHE_DIR, `${userId}.json`);
    if (!fs.existsSync(file)) return null;
    const stat = fs.statSync(file);
    if (Date.now() - stat.mtimeMs > ttlMs) return null;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (Array.isArray(data)) return data as number[];
    return null;
  } catch {
    return null;
  }
}

function writeFriendsCache(userId: number, ids: number[]) {
  try {
    ensureCacheDirs();
    const file = path.join(FRIENDS_CACHE_DIR, `${userId}.json`);
    fs.writeFileSync(file, JSON.stringify(ids), 'utf-8');
  } catch {
    // ignore
  }
}

async function vk(method: string, params: Record<string, any>, accessToken: string) {
  try {
    const { data } = await axios.get(`${VK_API}/${method}`, {
      params: { ...params, access_token: accessToken, v: API_VERSION },
    });
    
    if (data.error) {
      console.error(`VK API Error [${method}]:`, data.error);
      const err: any = new Error(data.error.error_msg || `VK API error (code: ${data.error.error_code})`);
      err.code = data.error.error_code;
      err.details = data.error;
      throw err;
    }
    
    return data.response;
  } catch (error: any) {
    console.error(`VK API request failed [${method}]:`, error.message);
    throw error;
  }
}

// --- Global throttling and retry/backoff for VK API calls ---
let lastVkCallAt = 0;
let minIntervalMs = Number(process.env.VK_MIN_INTERVAL_MS || 1200); // ~0.83 req/s базово, безопаснее
let maxRetries = Number(process.env.VK_MAX_RETRIES || 7);
let floodCooldownMs = Number(process.env.VK_FLOOD_COOLDOWN_MS || 30000);

export function setVkThrottle(ms: number) {
  if (Number.isFinite(ms)) minIntervalMs = Math.max(200, Math.floor(ms));
}
export function getVkThrottle() { return minIntervalMs; }
export function setVkRetryOptions(opts: { maxRetries?: number; floodCooldownMs?: number }) {
  if (opts.maxRetries != null && Number.isFinite(opts.maxRetries)) maxRetries = Math.max(0, Math.floor(opts.maxRetries));
  if (opts.floodCooldownMs != null && Number.isFinite(opts.floodCooldownMs)) floodCooldownMs = Math.max(0, Math.floor(opts.floodCooldownMs));
}

// --- simple in-memory progress tracking ---
type Progress = { percent: number; message?: string; phase?: string; updatedAt: number };
const progressMap = new Map<string, Progress>();
export function setProgress(taskId: string | undefined, data: Partial<Progress>) {
  if (!taskId) return;
  const prev = progressMap.get(taskId) || { percent: 0, updatedAt: Date.now() };
  const next: Progress = { ...prev, ...data, updatedAt: Date.now() } as Progress;
  progressMap.set(taskId, next);
}
export function getProgress(taskId: string | undefined): Progress | null {
  if (!taskId) return null;
  return progressMap.get(taskId) || null;
}
export function clearProgress(taskId: string | undefined) {
  if (!taskId) return;
  progressMap.delete(taskId);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function withJitter(ms: number) {
  const jitter = Math.floor(Math.random() * 200) - 100; // ±100ms
  return Math.max(0, ms + jitter);
}

async function vkSafe(
  method: string,
  params: Record<string, any>,
  accessToken: string,
  opts?: { retries?: number; cooldownOnFloodMs?: number }
) {
  const retries = opts?.retries ?? maxRetries;
  const cooldownOnFloodMs = opts?.cooldownOnFloodMs ?? floodCooldownMs;
  let attempt = 0;

  while (true) {
    // Глобальная дроссель: гарантируем минимальный интервал между вызовами
    const now = Date.now();
    const delta = now - lastVkCallAt;
    if (delta < minIntervalMs) {
      await sleep(minIntervalMs - delta);
    }

    try {
      const res = await vk(method, params, accessToken);
      lastVkCallAt = Date.now();
      return res;
    } catch (e: any) {
      const code = e?.code;
      const msg = String(e?.message || '').toLowerCase();
      const isRate = code === 6 || code === 9 || msg.includes('too many requests') || msg.includes('flood control');

      if (!isRate || attempt >= retries) {
        // Последняя попытка при жёстком flood: подождать длинный cooldown и попробовать 1 раз
        if (isRate && attempt === retries) {
          console.warn(`🧊 Flood control persists. Cooldown ${cooldownOnFloodMs}ms then final retry...`);
          await sleep(cooldownOnFloodMs);
          attempt++;
          continue;
        }
        throw e;
      }

      // Экспоненциальный backoff с джиттером
      const base = [2000, 4000, 7000, 11000, 16000, 22000, 30000][Math.min(attempt, 6)];
      const wait = withJitter(base);
      console.warn(`⏳ VK rate limit (code ${code}). Backoff ${wait}ms (attempt ${attempt + 1}/${retries})`);
      await sleep(wait);
      attempt++;
    }
  }
}

export async function buildUserFriendsGraph(
  userId: number, 
  depth = 1,
  vkIdToken?: string,
  maxFriendsForDepth2 = 10,
  maxFriendsForDepth1 = 0,
  options?: { taskId?: string }
): Promise<VKGraph> {
  // Используем VK ID токен если передан, иначе service token
  const serviceKey = process.env.VK_SERVICE_KEY;
  if (!serviceKey) {
    throw new Error('VK_SERVICE_KEY not configured');
  }

  const accessToken = vkIdToken || serviceKey;
  console.log(`🔍 Building graph for user ${userId} with depth ${depth}...`);
  console.log(`🔑 Using token: ${vkIdToken ? 'VK ID TOKEN' : 'SERVICE KEY'}`);
  setProgress(options?.taskId, { percent: 1, phase: 'start', message: 'Начало построения' });

  // Fetch base user and friends
  const [userInfo] = await vk('users.get', {
    user_ids: userId,
    fields: 'photo_100',
  }, accessToken);

  // 1) Попробуем достать список друзей из кеша
  let friendsItems: number[] | null = readFriendsCache(userId);

  // 2) Если кеша нет — идём в VK API с усиленным backoff
  if (!friendsItems) {
    // 🔥 ЗАЩИТА: VK может блокировать первый запрос после авторизации из-за предыдущих запросов
    // Если переменная окружения VK_INITIAL_COOLDOWN_SEC установлена, ждём перед первым запросом
    const initialCooldownSec = parseInt(process.env.VK_INITIAL_COOLDOWN_SEC || '0', 10);
    if (initialCooldownSec > 0) {
      console.log(`⏳ Initial VK cooldown: waiting ${initialCooldownSec}s before first friends.get...`);
      setProgress(options?.taskId, { percent: 3, phase: 'cooldown', message: `Ожидание перед запросом: ${initialCooldownSec}с` });
      await sleep(initialCooldownSec * 1000);
    }

    const friends = await vkSafe('friends.get', {
    user_id: userId,
    order: 'hints',
    count: 5000, // явно просим максимум
    }, accessToken, { retries: 8 });
    friendsItems = (friends.items || []) as number[];
    // Сохраним кеш
    writeFriendsCache(userId, friendsItems);
  }

  let friendIds: number[] = friendsItems || [];
  setProgress(options?.taskId, { percent: 10, phase: 'friends', message: `Друзья загружены: ${friendIds.length}` });
  // Ограничение по depth=1: если задано ( > 0 ), используем первые N друзей
  if (depth === 1 && maxFriendsForDepth1 > 0) {
    const original = friendIds.length;
    friendIds = friendIds.slice(0, maxFriendsForDepth1);
    console.log(`🔎 Depth=1 limit: using ${friendIds.length}/${original} friends`);
  }

  console.log(`👥 Depth=1: friends ids total = ${friendIds.length}`);

  // Загружаем информацию о друзьях батчами (безопасно по 100)
  let users: any[] = [];
  if (friendIds.length > 0) {
    const batchSizeUsers = 100; // консервативно: по 100 id за запрос
    for (let i = 0; i < friendIds.length; i += batchSizeUsers) {
      const batch = friendIds.slice(i, i + batchSizeUsers);
      const batchUsers = await vkSafe('users.get', {
        user_ids: batch.join(','),
        fields: 'photo_100',
      }, accessToken);
      users = users.concat(batchUsers);
      if (i > 0) await sleep(300); // пауза между батчами
    }
  }

  // Фолбэк: если получили меньше, чем friendIds, догружаем недостающих ещё меньшими батчами
  if (users.length < friendIds.length) {
    const receivedSet = new Set(users.map((u: any) => u.id));
    const missing = friendIds.filter((id) => !receivedSet.has(id));
    if (missing.length) {
      console.log(`↩️ Depth=1 fallback: missing ${missing.length} users, retry in tiny batches`);
      const tinySize = 20;
      for (let i = 0; i < missing.length; i += tinySize) {
        const batch = missing.slice(i, i + tinySize);
        try {
          const tinyUsers = await vkSafe('users.get', {
            user_ids: batch.join(','),
            fields: 'photo_100',
          }, accessToken);
          users = users.concat(tinyUsers);
        } catch (e: any) {
          console.warn(`   ⚠️ tiny batch failed: ${e.message}`);
        }
        await sleep(300);
      }
    }
  }

  console.log(`✅ Depth=1: users fetched = ${users.length}`);
  setProgress(options?.taskId, { percent: 25, phase: 'profiles', message: `Профили загружены: ${users.length}` });

  // Создаём Set валидных ID (пользователи, которые не удалены и не deactivated)
  const validUserIds = new Set<number>();
  validUserIds.add(userInfo.id);
  
  const validUsers = users.filter((u: any) => {
    // Проверяем, что пользователь не удалён
    if (u.deactivated) {
      console.log(`⚠️ Skipping deactivated user: ${u.id}`);
      return false;
    }
    validUserIds.add(u.id);
    return true;
  });

  const nodes: VKNode[] = [
    { id: userInfo.id, name: `${userInfo.first_name} ${userInfo.last_name}`,
      photo: userInfo.photo_100 },
    ...validUsers.map((u: any) => ({
      id: u.id,
      name: `${u.first_name} ${u.last_name}`,
      photo: u.photo_100,
    })),
  ];

  const links: VKLink[] = [];
  // Connect user to each friend (только если друг существует в nodes)
  let skippedLinks = 0;
  for (const fid of friendIds) {
    if (validUserIds.has(fid)) {
      links.push({ source: userId, target: fid });
    } else {
      skippedLinks++;
    }
  }
  
  if (skippedLinks > 0) {
    console.log(`⚠️ Skipped ${skippedLinks} links to unavailable users (deleted/banned/private)`);
  }

  // DEPTH=1: Получаем связи МЕЖДУ друзьями (не только звезду!)
  console.log(`🔗 Depth=1: building edges between friends...`);
  const validFriendIds = Array.from(validUserIds).filter((id) => id !== userId);
  
  // Используем friends.getMutual для получения общих друзей между пользователем и каждым его другом
  // Это даст нам связи между друзьями
  let mutualEdgesCount = 0;
  const edgeSet = new Set<string>(); // для дедупликации
  const edgeKey = (a: number, b: number) => {
    const s = Math.min(a, b);
    const t = Math.max(a, b);
    return `${s}-${t}`;
  };
  
  // Добавляем существующие рёбра в Set
  for (const link of links) {
    edgeSet.add(edgeKey(link.source, link.target));
  }
  
  // Простое кеширование списков друзей, чтобы не дёргать VK повторно в рамках одной сессии
  const friendListCache = new Map<number, number[]>();

  // Для каждого друга запрашиваем его список друзей и смотрим пересечения
  for (let i = 0; i < validFriendIds.length; i++) {
    const friendId = validFriendIds[i];
    
    try {
      // Базовая задержка и глобальная дроссель уже в vkSafe; дополнительно — небольшая пауза
      if (i > 0) await sleep(150);
      
      // Получаем друзей этого друга (с кешем)
      let friendOfFriendIds: number[] | undefined = friendListCache.get(friendId);
      if (!friendOfFriendIds) {
        const friendOfFriendData = await vkSafe('friends.get', {
          user_id: friendId,
          order: 'hints',
          count: 5000,
        }, accessToken);
        friendOfFriendIds = (friendOfFriendData.items || []) as number[];
        friendListCache.set(friendId, friendOfFriendIds);
      }
      
      // Находим пересечение с нашим списком друзей (validFriendIds)
      for (const fofId of friendOfFriendIds) {
        if (validUserIds.has(fofId) && fofId !== friendId && fofId !== userId) {
          const key = edgeKey(friendId, fofId);
          if (!edgeSet.has(key)) {
            edgeSet.add(key);
            links.push({ source: friendId, target: fofId });
            mutualEdgesCount++;
          }
        }
      }
      
      if ((i + 1) % 10 === 0) {
        console.log(`   ✓ Processed ${i + 1}/${validFriendIds.length} friends, found ${mutualEdgesCount} mutual edges`);
      }
      if ((i + 1) % 5 === 0) {
        const base = 25; // после профилей
        const span = 65; // до 90%
        const pct = Math.min(90, base + Math.floor((i + 1) / Math.max(1, validFriendIds.length) * span));
        setProgress(options?.taskId, { percent: pct, phase: 'edges', message: `Связи: ${i + 1}/${validFriendIds.length}` });
      }
    } catch (e: any) {
      console.warn(`   ⚠️ Failed to get friends for ${friendId}: ${e.message}`);
    }
  }
  
  console.log(`✅ Depth=1: added ${mutualEdgesCount} edges between friends`);

  // Depth 2+: получаем друзей друзей и строим полный граф
  if (depth >= 2) {
    if (depth >= 3) {
      console.log('🔥🔥🔥 WARNING: Depth 3+ can create HUGE graphs with tens of thousands of nodes! 🔥🔥🔥');
    }
    console.log(`🔗 Building depth ${depth}: fetching friends of friends...`);
    
    try {
      // Собираем всех уникальных друзей друзей
      const friendsOfFriendsSet = new Set<number>();
      const allFriendsData: Map<number, number[]> = new Map();
      
      let processedCount = 0;
      const totalFriends = Math.min(friendIds.length, maxFriendsForDepth2); // Используем параметр от пользователя
      const batchDelay = depth >= 3 ? 400 : 350; // Больше задержка для depth=3
      
      console.log(`📊 Processing ${totalFriends} friends (max: ${maxFriendsForDepth2}) to find their friends...`);
      if (depth >= 3 && totalFriends > 10) {
        console.log('⚠️ WARNING: Depth 3 with >10 friends can take a very long time and create massive graphs!');
      }
      
      for (let i = 0; i < totalFriends; i++) {
        const friendId = friendIds[i];
        
        try {
          // Задержка между запросами для соблюдения rate limits
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, batchDelay));
          }
          
          const friendOfFriendData = await vk('friends.get', {
            user_id: friendId,
            order: 'hints',
          }, accessToken);
          
          const friendOfFriendIds: number[] = friendOfFriendData.items || [];
          allFriendsData.set(friendId, friendOfFriendIds);
          
          // Собираем уникальных друзей друзей
          for (const fofId of friendOfFriendIds) {
            if (fofId !== userId && !validUserIds.has(fofId)) {
              friendsOfFriendsSet.add(fofId);
            }
          }
          
          processedCount++;
          if (processedCount % 10 === 0) {
            console.log(`   ✓ Processed ${processedCount}/${totalFriends} friends... Found ${friendsOfFriendsSet.size} unique friends-of-friends`);
          }
        } catch (friendError: any) {
          console.log(`   ⚠️ Skipping friend ${friendId}: ${friendError.message}`);
        }
      }
      
      console.log(`✅ Found ${friendsOfFriendsSet.size} unique friends of friends`);
      
      // Получаем информацию о друзьях друзей (батчами по 100)
      if (friendsOfFriendsSet.size > 0) {
        let fofArray = Array.from(friendsOfFriendsSet);
        
        // Ограничиваем максимальное количество друзей друзей для производительности
        const maxFriendsOfFriends = maxFriendsForDepth2 * 300; // ~300 на каждого друга
        if (fofArray.length > maxFriendsOfFriends) {
          console.log(`⚠️ Limiting friends-of-friends from ${fofArray.length} to ${maxFriendsOfFriends} for performance`);
          fofArray = fofArray.slice(0, maxFriendsOfFriends);
        }
        
        const batchSize = 100;
        const newNodes: VKNode[] = [];
        
        console.log(`📥 Fetching info for ${fofArray.length} friends-of-friends in batches...`);
        
        for (let i = 0; i < fofArray.length; i += batchSize) {
          const batch = fofArray.slice(i, Math.min(i + batchSize, fofArray.length));
          
          // Задержка между батчами для соблюдения rate limits
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 400)); // 400ms между батчами
          }
          
          try {
            const fofUsers = await vk('users.get', {
              user_ids: batch.join(','),
              fields: 'photo_100',
            }, accessToken);
            
            for (const u of fofUsers) {
              if (!u.deactivated) {
                newNodes.push({
                  id: u.id,
                  name: `${u.first_name} ${u.last_name}`,
                  photo: u.photo_100,
                });
                validUserIds.add(u.id);
              }
            }
            
            if ((Math.floor(i / batchSize) + 1) % 20 === 0) {
              console.log(`   ✓ Loaded batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(fofArray.length / batchSize)}`);
            }
          } catch (error: any) {
            console.warn(`   ⚠️ Failed to load batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
          }
        }
        
        nodes.push(...newNodes);
        console.log(`✅ Added ${newNodes.length} friends-of-friends to graph`);
      }
      
      // Теперь строим все связи
      console.log(`🔗 Building links between all users...`);
      for (const [friendId, fofIds] of allFriendsData) {
        for (const fofId of fofIds) {
          if (validUserIds.has(friendId) && validUserIds.has(fofId) && friendId !== fofId) {
            links.push({ source: friendId, target: fofId });
          }
        }
      }
      
      console.log(`✅ Depth 2 completed: ${nodes.length} total nodes, ${links.length} total links`);
    } catch (e: any) {
      console.warn('⚠️ Depth 2 failed:', e.message || e);
      console.warn('   Falling back to depth 1 only (direct friends)');
    }
  }

  console.log(`✅ Graph built: ${nodes.length} nodes, ${links.length} links`);
  setProgress(options?.taskId, { percent: 100, phase: 'done', message: `Граф: ${nodes.length} узлов, ${links.length} рёбер` });
  setTimeout(() => clearProgress(options?.taskId), 60_000);
  return { nodes, links };
}
