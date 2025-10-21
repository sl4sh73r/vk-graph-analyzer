import React, { useMemo, useRef, useState, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useStore } from '../store';

interface NodeInfo {
  id: number;
  name: string;
  photo?: string;
  score?: number;
  x: number;
  y: number;
}

export default function GraphView() {
  const metric = useStore((s) => s.metric);
  const graph = useStore((s) => s.graph);
  const loading = useStore((s) => s.loading);
  const progress = useStore((s) => s.progress);
  const appendGraph = useStore((s) => s.appendGraph);
  const depth = useStore((s) => s.depth);
  const maxFriends = useStore((s) => s.maxFriends);
  const fgRef = useRef<any>();
  const [selectedNode, setSelectedNode] = useState<NodeInfo | null>(null);
  const [hoveredNode, setHoveredNode] = useState<any>(null);

  const nodeVal = useMemo(() => {
    return (node: any) => {
      const score = node.score || 0;
      // Масштабируем размер узла в зависимости от метрики
      return Math.max(4, Math.min(20, score * 100));
    };
  }, [metric]);

  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode({
      id: node.id,
      name: node.name,
      photo: node.photo,
      score: node.score,
      x: node.x,
      y: node.y,
    });
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const handleBuildGraphFromNode = useCallback(() => {
    if (selectedNode) {
      // Закрываем модалку
      setSelectedNode(null);
      // Расширяем текущий граф: добавляем подграф от выбранного пользователя
      appendGraph(selectedNode.id, depth, maxFriends, selectedNode.id);
    }
  }, [selectedNode, appendGraph, depth, maxFriends]);

  return (
    <div className="relative w-full h-screen">
      {/* Прогресс построения */}
      {loading && progress && (
        <div className="absolute z-20 left-1/2 -translate-x-1/2 top-4 w-[70%] max-w-2xl bg-gray-800/80 border border-purple-500/30 rounded-lg shadow-xl overflow-hidden">
          <div className="px-3 py-2 flex items-center justify-between text-xs">
            <span className="text-gray-300">{progress.message || 'Выполнение...'}</span>
            <span className="text-purple-300 font-semibold">{Math.round(progress.percent)}%</span>
          </div>
          <div className="w-full h-2 bg-gray-700">
            <div
              className="h-2 bg-gradient-to-r from-purple-500 to-blue-500 transition-[width] duration-300"
              style={{ width: `${Math.max(0, Math.min(100, progress.percent))}%` }}
            />
          </div>
        </div>
      )}
      {/* Граф */}
      <ForceGraph2D
        ref={fgRef}
        graphData={graph as any}
        nodeVal={nodeVal as any}
        nodeLabel={() => ''}
        onNodeClick={handleNodeClick}
        onNodeHover={(node) => setHoveredNode(node)}
        nodeCanvasObject={(node: any, ctx, globalScale) => {
          const size = Math.sqrt(nodeVal(node)) * 1.5;
          
          // Градиентный фон для узла
          const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, size);
          
          // Цвет в зависимости от метрики
          const score = node.score || 0;
          if (score > 0.7) {
            gradient.addColorStop(0, 'rgba(168, 85, 247, 1)'); // purple-500
            gradient.addColorStop(1, 'rgba(126, 34, 206, 0.4)'); // purple-700
          } else if (score > 0.4) {
            gradient.addColorStop(0, 'rgba(59, 130, 246, 1)'); // blue-500
            gradient.addColorStop(1, 'rgba(37, 99, 235, 0.4)'); // blue-600
          } else {
            gradient.addColorStop(0, 'rgba(34, 197, 94, 1)'); // green-500
            gradient.addColorStop(1, 'rgba(22, 163, 74, 0.4)'); // green-600
          }
          
          // Рисуем круг
          ctx.beginPath();
          ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
          ctx.fillStyle = gradient;
          ctx.fill();
          
          // Обводка
          if (hoveredNode?.id === node.id) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.lineWidth = 2 / globalScale;
            ctx.stroke();
          } else {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 1 / globalScale;
            ctx.stroke();
          }
          
          // Внутренний блик
          ctx.beginPath();
          ctx.arc(node.x - size/3, node.y - size/3, size/3, 0, 2 * Math.PI);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.fill();
        }}
        linkColor={() => 'rgba(100, 116, 139, 0.15)'} // slate-500 with opacity
        linkWidth={1.5}
        linkDirectionalParticles={1}
        linkDirectionalParticleWidth={3}
        linkDirectionalParticleSpeed={0.003}
        linkDirectionalParticleColor={() => 'rgba(168, 85, 247, 0.6)'} // purple-500
        d3VelocityDecay={0.3}
        width={window.innerWidth - 260}
        height={window.innerHeight}
        backgroundColor="#0a0a0a"
      />

      {/* Hover tooltip */}
      {hoveredNode && (
        <div 
          className="absolute pointer-events-none z-10 bg-gray-900/95 backdrop-blur-sm border border-purple-500/30 rounded-lg px-3 py-2 shadow-2xl"
          style={{
            left: '50%',
            top: '20px',
            transform: 'translateX(-50%)',
          }}
        >
          <div className="text-sm font-medium text-white">{hoveredNode.name}</div>
          {hoveredNode.score && (
            <div className="text-xs text-purple-300 mt-1">
              Score: {(hoveredNode.score * 100).toFixed(1)}%
            </div>
          )}
        </div>
      )}

      {/* Modal с информацией о узле */}
      {selectedNode && (
        <div 
          className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-20 animate-fadeIn"
          onClick={handleCloseModal}
        >
          <div 
            className="bg-gradient-to-br from-gray-900 to-gray-950 border border-purple-500/30 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative h-32 bg-gradient-to-br from-purple-600 to-blue-600">
              <button
                onClick={handleCloseModal}
                className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              
              {/* Avatar */}
              {selectedNode.photo && (
                <div className="absolute -bottom-12 left-6">
                  <img
                    src={selectedNode.photo}
                    alt={selectedNode.name}
                    className="w-24 h-24 rounded-full border-4 border-gray-900 shadow-xl"
                  />
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-6 pt-16">
              <h2 className="text-2xl font-bold text-white mb-1">{selectedNode.name}</h2>
              <a 
                href={`https://vk.com/id${selectedNode.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
              >
                vk.com/id{selectedNode.id}
              </a>

              {/* Metrics */}
              {selectedNode.score !== undefined && (
                <div className="mt-6 space-y-3">
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-400">Centrality Score</span>
                      <span className="text-lg font-bold text-purple-400">
                        {(selectedNode.score * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-purple-500 to-blue-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${selectedNode.score * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-800/50 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-1">Node ID</div>
                      <div className="text-sm font-medium text-white">{selectedNode.id}</div>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-1">Metric</div>
                      <div className="text-sm font-medium text-white capitalize">{metric}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="mt-6 flex flex-col gap-3">
                <button
                  onClick={handleBuildGraphFromNode}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-purple-500/50 flex items-center justify-center gap-2 group"
                >
                  <svg className="w-5 h-5 transform group-hover:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>Построить граф от этого пользователя</span>
                  <span className="text-xs opacity-75">({depth} ур., {maxFriends} др.)</span>
                </button>
                
                <div className="flex gap-3">
                  <a
                    href={`https://vk.com/id${selectedNode.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-center"
                  >
                    Open Profile
                  </a>
                  <button
                    onClick={handleCloseModal}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
