export interface VKNode { id: number; name: string; photo: string }
export interface VKLink { source: number; target: number }
export interface VKGraph { nodes: VKNode[]; links: VKLink[] }

export type CentralityMetric = 'closeness' | 'betweenness' | 'eigenvector' | 'rooted' | 'all';

export interface CentralityResult {
  closeness?: Record<string | number, number>;
  betweenness?: Record<string | number, number>;
  eigenvector?: Record<string | number, number>;
  rooted?: Record<string | number, number>;
}
