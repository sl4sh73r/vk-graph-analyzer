import { create } from 'zustand';
import axios from 'axios';
import type { CentralityMetric, CentralityResult, VKGraph } from '@shared';

type GraphWithScores = VKGraph & { nodes: (VKGraph['nodes'][number] & { score?: number })[] };

interface State {
  metric: CentralityMetric;
  selectedMetrics: CentralityMetric[]; // какие метрики считать/сравнивать
  graph: GraphWithScores;
  loading: boolean;
  authenticated: boolean;
  userId: number | null;
  depth: number;
  maxFriends: number;
  depth1Limit: number; // 0 = без лимита
  // VK Flood control настройки
  minIntervalMs: number;
  setMinIntervalMs: (ms: number) => void;
  // Прогресс построения графа
  progress: { percent: number; message?: string } | null;
  // Правый сайдбар со списком узлов
  rightOpen: boolean;
  toggleRight: () => void;
  setMetric: (m: CentralityMetric) => void;
  setSelectedMetrics: (m: CentralityMetric[]) => void;
  setDepth: (d: number) => void;
  setMaxFriends: (m: number) => void;
  setDepth1Limit: (n: number) => void;
  fetchGraph: (userId: number, depth?: number, maxFriends?: number) => Promise<void>;
  appendGraph: (userId: number, depth?: number, maxFriends?: number, anchorId?: number) => Promise<void>;
  loadDemo: () => Promise<void>;
  checkAuth: () => Promise<void>;
  logout: () => Promise<void>;
}

function computeScore(metric: CentralityMetric, centrality: CentralityResult, id: number, selected: CentralityMetric[]) {
  if (metric !== 'all') {
    if (metric === 'rooted') return (centrality.rooted || {})[id] || 0;
    return (centrality[metric] || {})[id] || 0;
  }
  // metric === 'all' -> среднее по выбранным метрикам
  const picks = selected.length > 0 ? selected : (['closeness','betweenness','eigenvector'] as CentralityMetric[]);
  const values = picks.map((m) => {
    if (m === 'rooted') return (centrality.rooted || {})[id] || 0;
    return (centrality as any)[m]?.[id] || 0;
  });
  const sum = values.reduce((a, b) => a + b, 0);
  return values.length ? sum / values.length : 0;
}

export const useStore = create<State>((set, get) => ({
  metric: 'rooted',
  selectedMetrics: ['closeness','betweenness','eigenvector','rooted'],
  graph: { nodes: [], links: [] },
  loading: false,
  authenticated: false,
  userId: null,
  depth: 1,
  maxFriends: 10,
  depth1Limit: 0,
  minIntervalMs: 1200,
  setMinIntervalMs: (ms) => set({ minIntervalMs: Math.max(200, Math.floor(ms)) }),
  progress: null,
  rightOpen: false,
  toggleRight: () => set((s) => ({ rightOpen: !s.rightOpen })),
  setMetric: (metric) => set({ metric }),
  setSelectedMetrics: (selectedMetrics) => set({ selectedMetrics }),
  setDepth: (depth) => set({ depth }),
  setMaxFriends: (maxFriends) => set({ maxFriends }),
  setDepth1Limit: (depth1Limit) => set({ depth1Limit }),
  async fetchGraph(userId, depth = 1, maxFriends = 10) {
    set({ loading: true, progress: { percent: 0, message: 'Запуск...' } });
    try {
      const { metric, selectedMetrics, depth1Limit, userId: rootUserId, minIntervalMs } = get();
      const taskId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const poll = async () => {
        if (!get().loading) return;
        try {
          const r = await axios.get('/api/vk/progress', { params: { taskId }, validateStatus: () => true });
          if (r.status === 200 && r.data) {
            const p = r.data as { percent: number; message?: string };
            set({ progress: { percent: p.percent ?? 0, message: p.message } });
          }
        } catch {}
        setTimeout(poll, 700);
      };
      setTimeout(poll, 400);
      
      const { data: graph } = await axios.get('/api/vk/graph', { 
        params: { userId, depth, maxFriends, maxFriendsDepth1: depth === 1 ? depth1Limit : undefined, taskId, minIntervalMs },
        withCredentials: true,
      });
      const { data: centrality } = await axios.post<CentralityResult>('/api/graph/centrality', {
        nodes: graph.nodes,
        links: graph.links,
        metric: 'all',
        rootUserId: rootUserId ?? undefined,
      }, { withCredentials: true });
      const nodes = graph.nodes.map((n: any) => ({
        ...n,
        score: computeScore(metric, centrality, n.id, selectedMetrics),
      }));
      set({ graph: { nodes, links: graph.links }, loading: false, progress: null });
    } catch (e: any) {
      console.error(e);
      const errorData = e.response?.data;
      
      // Специальная обработка для закрытого профиля
      if (errorData?.code === 'PRIVATE_PROFILE') {
        const details = errorData?.details || 'This profile is private';
        const log1 = `VK API request failed [friends.get]: ${details}`;
        const log2 = `Graph build error: ${details}`;
        alert(
          `❌ Профиль закрыт\n\n${errorData.message}\n\n${log1}\n${log2}`
        );
      } else {
        alert(errorData?.error || errorData?.message || 'Ошибка загрузки графа');
      }
      
      set({ loading: false, progress: null });
    }
  },
  async appendGraph(userId, depth = 1, maxFriends = 10, anchorId?: number) {
    // Не очищаем текущий граф: подгружаем новый и мержим
    set({ loading: true, progress: { percent: 0, message: 'Запуск...' } });
    try {
  const { metric, selectedMetrics, graph: current, depth1Limit, userId: rootUserId, minIntervalMs } = get();
  const taskId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const poll = async () => {
    if (!get().loading) return;
    try {
      const r = await axios.get('/api/vk/progress', { params: { taskId }, validateStatus: () => true });
      if (r.status === 200 && r.data) {
        const p = r.data as { percent: number; message?: string };
        set({ progress: { percent: p.percent ?? 0, message: p.message } });
      }
    } catch {}
    setTimeout(poll, 700);
  };
  setTimeout(poll, 400);

      // 1) Получаем новый подграф
      const { data: newGraph } = await axios.get('/api/vk/graph', {
        params: { userId, depth, maxFriends, maxFriendsDepth1: depth === 1 ? depth1Limit : undefined, taskId, minIntervalMs },
        withCredentials: true,
      });

      // 2) Мержим ноды (по id)
      const nodeMap = new Map<number, any>();
      // Сохраняем существующие объекты нод (чтобы сохранить x/y из симуляции)
      for (const n of current.nodes as any[]) nodeMap.set(n.id, n);

      // Поищем якорную ноду для расстановки новых рядом
      const anchor = anchorId ? (current.nodes as any[]).find((n) => n.id === anchorId) : undefined;
      const ax = anchor?.x ?? 0;
      const ay = anchor?.y ?? 0;

      for (const n of newGraph.nodes as any[]) {
        if (!nodeMap.has(n.id)) {
          // Новая нода: добавим, сохраняя совместимость полей
          const nn: any = { ...n };
          // Инициализируем стартовую позицию рядом с якорем, если он известен
          if (anchor) {
            const angle = Math.random() * Math.PI * 2;
            const radius = 20 + Math.random() * 60;
            nn.x = ax + Math.cos(angle) * radius;
            nn.y = ay + Math.sin(angle) * radius;
          }
          nodeMap.set(n.id, nn);
        }
      }

      const mergedNodes = Array.from(nodeMap.values());

      // 3) Мержим рёбра, устраняя дубликаты (рассматриваем ребро как неориентированное)
      const linkKey = (a: number, b: number) => {
        const s = Math.min(a, b);
        const t = Math.max(a, b);
        return `${s}-${t}`;
      };
      const linkSet = new Set<string>();
      const mergedLinks: any[] = [];
      const toId = (v: any) => {
        if (v == null) return NaN;
        if (typeof v === 'object') return Number(v.id);
        return Number(v);
      };
      const pushLink = (l: any) => {
        const s = toId(l.source);
        const t = toId(l.target);
        if (!Number.isFinite(s) || !Number.isFinite(t)) return; // пропускаем битые рёбра
        if (!nodeMap.has(s) || !nodeMap.has(t)) return; // пропускаем рёбра к отсутствующим нодам
        const key = linkKey(s, t);
        if (!linkSet.has(key)) {
          linkSet.add(key);
          mergedLinks.push({ source: s, target: t });
        }
      };

      for (const l of current.links as any[]) pushLink(l);
      for (const l of newGraph.links as any[]) pushLink(l);

        // 4) Определяем новые узлы (которых не было в current.nodes)
        const existingIds = new Set((current.nodes as any[]).map((n) => n.id));
        const newNodes = mergedNodes.filter((n) => !existingIds.has(n.id));

        // 5) Считаем центральность по ВСЕМУ объединённому графу,
        // но обновляем score только у новых узлов — старые оставляем как были
        let updatedNodes = mergedNodes.map((n: any) => ({ ...n }));
        if (newNodes.length > 0) {
          const { data: centrality } = await axios.post<CentralityResult>('/api/graph/centrality', {
            nodes: mergedNodes.map((n) => ({ id: n.id, name: n.name, photo: n.photo })),
            links: mergedLinks,
            metric: 'all',
            rootUserId: rootUserId ?? undefined,
          }, { withCredentials: true });

          const newIdSet = new Set(newNodes.map((n) => n.id));
          updatedNodes = mergedNodes.map((n: any) => {
            if (newIdSet.has(n.id)) {
              return { ...n, score: computeScore(metric as CentralityMetric, centrality, n.id, selectedMetrics) };
            }
            return n; // старые узлы — не трогаем их score
          });
        }

      set({ graph: { nodes: updatedNodes, links: mergedLinks }, loading: false, progress: null });
    } catch (e: any) {
      console.error(e);
      const errorData = e.response?.data;
      if (errorData?.code === 'PRIVATE_PROFILE') {
        const details = errorData?.details || 'This profile is private';
        const log1 = `VK API request failed [friends.get]: ${details}`;
        const log2 = `Graph build error: ${details}`;
        alert(
          `❌ Профиль закрыт\n\n${errorData.message}\n\n${log1}\n${log2}`
        );
      } else {
        alert(errorData?.error || errorData?.message || 'Ошибка загрузки графа');
      }
      set({ loading: false, progress: null });
    }
  },
  async loadDemo() {
    set({ loading: true });
    try {
      const { metric } = get();
      const demo: VKGraph = {
        nodes: [
          { id: 1, name: 'A', photo: '' },
          { id: 2, name: 'B', photo: '' },
          { id: 3, name: 'C', photo: '' },
          { id: 4, name: 'D', photo: '' },
        ],
        links: [
          { source: 1, target: 2 },
          { source: 2, target: 3 },
          { source: 3, target: 4 },
          { source: 4, target: 1 },
          { source: 1, target: 3 },
        ],
      };
      const { data: centrality } = await axios.post<CentralityResult>('/api/graph/centrality', {
        nodes: demo.nodes,
        links: demo.links,
        metric,
      }, { withCredentials: true });
  const selected = get().selectedMetrics;
  const nodes = demo.nodes.map((n) => ({ ...n, score: computeScore(metric, centrality, n.id, selected) }));
      set({ graph: { nodes, links: demo.links }, loading: false });
    } catch (e) {
      console.error(e);
      set({ loading: false });
    }
  },
  async checkAuth() {
    try {
      const { data } = await axios.get('/api/auth/me', { withCredentials: true });
      set({ authenticated: true, userId: data.userId });
    } catch {
      set({ authenticated: false, userId: null });
    }
  },
  async logout() {
    try {
      await axios.post('/api/auth/logout', {}, { withCredentials: true });
      set({ authenticated: false, userId: null, graph: { nodes: [], links: [] } });
    } catch (e) {
      console.error(e);
    }
  },
}));
