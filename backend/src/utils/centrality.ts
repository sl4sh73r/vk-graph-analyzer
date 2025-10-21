import Graph from 'graphology';
import betweenness from 'graphology-metrics/centrality/betweenness';
import closeness from 'graphology-metrics/centrality/closeness';
import eigenvector from 'graphology-metrics/centrality/eigenvector';

type Node = { id: number | string } & Record<string, any>;
type Link = { source: number | string; target: number | string };

export type Metric = 'closeness' | 'betweenness' | 'eigenvector' | 'rooted' | 'all';

export function computeCentralities(
  graphData: { nodes: Node[]; links: Link[] },
  metric: Metric = 'all',
  opts?: { rootId?: string | number },
) {
  const g = new Graph();
  for (const n of graphData.nodes) if (!g.hasNode(n.id)) g.addNode(n.id, n);
  for (const e of graphData.links)
    if (!g.hasEdge(e.source, e.target)) g.addUndirectedEdge(e.source, e.target);

  const result: Record<string, Record<string, number>> = {};
  const need = metric === 'all'
    ? (opts?.rootId != null
        ? ['closeness', 'betweenness', 'eigenvector', 'rooted']
        : ['closeness', 'betweenness', 'eigenvector'])
    : [metric];

  // Вспомогательная функция для нормализации (min-max scaling to 0-1)
  const normalize = (values: Record<string, number>) => {
    const vals = Object.values(values);
    if (vals.length === 0) return values;
    
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min;
    
    // Если все значения одинаковые, возвращаем 0.5 для всех
    if (range === 0) {
      const normalized: Record<string, number> = {};
      for (const key in values) normalized[key] = 0.5;
      return normalized;
    }
    
    const normalized: Record<string, number> = {};
    for (const key in values) {
      normalized[key] = (values[key] - min) / range;
    }
    return normalized;
  };

  if (need.includes('closeness')) result.closeness = normalize(closeness(g));
  if (need.includes('betweenness')) result.betweenness = normalize(betweenness(g));
  if (need.includes('eigenvector')) result.eigenvector = normalize(eigenvector(g));
  if (need.includes('rooted')) {
    const rootId = opts?.rootId;
    if (rootId == null || !g.hasNode(rootId)) {
      result.rooted = {};
    } else {
      // BFS от корня для вычисления расстояний
      const queue: Array<string | number> = [rootId];
      const visited = new Set<string | number>([rootId]);
      const dist = new Map<string | number, number>();
      dist.set(rootId, 0);

      while (queue.length > 0) {
        const v = queue.shift()!;
        const dv = dist.get(v) || 0;
  g.forEachNeighbor(v, (nbr: string | number) => {
          if (!visited.has(nbr)) {
            visited.add(nbr);
            dist.set(nbr, dv + 1);
            queue.push(nbr);
          }
        });
      }

      // Нормируем: score = 1 - d/maxD; недостижимые = 0; корень = 1
      let maxD = 0;
      dist.forEach((d) => { if (d > maxD) maxD = d; });
      const scores: Record<string, number> = {};
      const nodes = g.nodes();
      if (maxD === 0) {
        // Только корень в компоненте
        for (const id of nodes) scores[String(id)] = String(id) === String(rootId) ? 1 : 0;
      } else {
        for (const id of nodes) {
          if (String(id) === String(rootId)) scores[String(id)] = 1;
          else if (dist.has(id)) scores[String(id)] = 1 - (dist.get(id)! / maxD);
          else scores[String(id)] = 0;
        }
      }
      result.rooted = scores;
    }
  }

  return result;
}
