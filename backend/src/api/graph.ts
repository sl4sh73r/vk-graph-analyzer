import { Router, Request, Response } from 'express';
import { computeCentralities } from '../utils/centrality';

const router = Router();

// POST /api/graph/centrality { nodes, links, metric, rootUserId? }
router.post('/centrality', async (req: Request, res: Response) => {
  try {
    const { nodes, links, metric, rootUserId } = (req.body || {}) as {
      nodes: Array<{ id: number | string }>;
      links: Array<{ source: number | string; target: number | string }>;
      metric?: 'closeness' | 'betweenness' | 'eigenvector' | 'rooted' | 'all';
      rootUserId?: number | string;
    };
    if (!nodes || !links)
      return res.status(400).json({ error: 'nodes and links are required' });
    const result = computeCentralities({ nodes, links }, metric, { rootId: rootUserId });
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Centrality error' });
  }
});

export default router;
