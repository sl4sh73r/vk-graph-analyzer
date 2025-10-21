import React, { useMemo, useState } from 'react';
import { useStore } from '../store';

export default function RightSidebar() {
  const rightOpen = useStore((s) => s.rightOpen);
  const toggleRight = useStore((s) => s.toggleRight);
  const graph = useStore((s) => s.graph);

  const [query, setQuery] = useState('');

  const items = useMemo(() => {
    const list = (graph.nodes || []).map((n: any) => ({
      id: n.id as number,
      name: n.name as string,
      score: (n.score ?? 0) as number,
      photo: n.photo as string | undefined,
    }));
    const filtered = query
      ? list.filter((x) => x.name?.toLowerCase().includes(query.toLowerCase()))
      : list;
    return filtered.sort((a, b) => (b.score - a.score) || a.name.localeCompare(b.name)).slice(0, 5000);
  }, [graph.nodes, query]);

  return (
    <div
      className={`fixed right-0 top-0 h-screen w-[320px] bg-gray-950/95 backdrop-blur-md border-l border-purple-500/20 shadow-2xl z-30 transform transition-transform duration-300 ${rightOpen ? 'translate-x-0' : 'translate-x-full'}`}
    >
      <div className="p-4 border-b border-gray-800 flex items-center gap-3">
        <button
          onClick={toggleRight}
          className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200"
          title="Закрыть"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div>
          <div className="text-sm text-gray-400">Участники графа</div>
          <div className="text-xs text-gray-500">{graph.nodes?.length || 0} узлов</div>
        </div>
      </div>

      <div className="p-3 border-b border-gray-800">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по имени..."
          className="w-full bg-gray-800 border border-gray-700 focus:border-purple-500 rounded-lg p-2 text-sm"
        />
      </div>

      <div className="h-[calc(100vh-112px)] overflow-y-auto p-2 space-y-2">
        {items.map((n) => (
          <a
            key={n.id}
            href={`https://vk.com/id${n.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-2 rounded-lg bg-gray-900/60 hover:bg-gray-800 border border-gray-800 hover:border-purple-700/30 transition-colors"
          >
            {n.photo ? (
              <img src={n.photo} alt={n.name} className="w-8 h-8 rounded-full" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-700" />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm text-gray-200 truncate">{n.name}</div>
              <div className="text-xs text-purple-300">{(n.score * 100).toFixed(1)}%</div>
            </div>
          </a>
        ))}
        {items.length === 0 && (
          <div className="text-xs text-gray-500 p-3">Ничего не найдено</div>
        )}
      </div>
    </div>
  );
}
