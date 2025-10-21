import React, { useState } from 'react';
import { useStore } from '../store';
import VKLoginButton from './VKLoginButton';

export default function Sidebar() {
  const metric = useStore((s) => s.metric);
  const setMetric = useStore((s) => s.setMetric);
  const selectedMetrics = useStore((s) => s.selectedMetrics);
  const setSelectedMetrics = useStore((s) => s.setSelectedMetrics);
  const fetchGraph = useStore((s) => s.fetchGraph);
  const loading = useStore((s) => s.loading);
  const authenticated = useStore((s) => s.authenticated);
  const userId = useStore((s) => s.userId);
  const logout = useStore((s) => s.logout);
  const depth = useStore((s) => s.depth);
  const setDepth = useStore((s) => s.setDepth);
  const maxFriends = useStore((s) => s.maxFriends);
  const setMaxFriends = useStore((s) => s.setMaxFriends);
  const depth1Limit = useStore((s) => s.depth1Limit);
  const setDepth1Limit = useStore((s) => s.setDepth1Limit);
  const minIntervalMs = useStore((s) => s.minIntervalMs);
  const setMinIntervalMs = useStore((s) => s.setMinIntervalMs);
  const toggleRight = useStore((s) => s.toggleRight);
  const [useCustomId, setUseCustomId] = useState(false);
  const [customUserId, setCustomUserId] = useState<number>(0);

  const appId = import.meta.env.VITE_VK_APP_ID || '';
  const redirectUri = import.meta.env.VITE_VK_REDIRECT_URI || 'http://localhost:5173/auth/callback';

  // Расчет примерного количества узлов
  const estimatedNodes = depth === 1 
    ? (depth1Limit && depth1Limit > 0 ? Math.min(depth1Limit, 5000) + 1 : 100) 
    : depth === 2
    ? 100 + (maxFriends * 250) // ~250 друзей на каждого друга
    : 100 + (maxFriends * 250) + (maxFriends * maxFriends * 50); // depth=3: экспоненциальный рост!

  const handleLoadGraph = () => {
    const targetId = useCustomId && customUserId ? customUserId : userId;
    if (targetId) {
      fetchGraph(targetId, depth, maxFriends);
    }
  };

  return (
    <aside className="h-screen bg-gradient-to-b from-gray-900 to-gray-950 border-r border-purple-500/20 p-6 space-y-6 overflow-y-auto shadow-2xl">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              VK Graph
            </h1>
            <p className="text-xs text-gray-500">Analyzer</p>
          </div>
        </div>
      </div>
      
      {authenticated ? (
        <>
          <div className="p-4 bg-gradient-to-br from-green-900/20 to-emerald-900/20 rounded-xl border border-green-500/30 backdrop-blur-sm animate-slideIn">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <div className="text-sm font-medium text-green-400">Авторизован</div>
            </div>
            <div className="text-xs text-gray-400">VK ID: {userId}</div>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <button
              className="w-full bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 transition-all rounded-lg p-3 text-sm font-medium shadow-lg hover:shadow-xl"
              onClick={logout}
            >
              Выйти
            </button>
            <button
              className="w-full bg-gradient-to-r from-purple-700/60 to-blue-700/60 hover:from-purple-700 hover:to-blue-700 transition-all rounded-lg p-3 text-sm font-medium shadow-lg hover:shadow-xl"
              onClick={toggleRight}
              title="Показать список участников"
            >
              Участники
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="p-4 bg-gradient-to-br from-yellow-900/20 to-orange-900/20 rounded-xl border border-yellow-500/30 backdrop-blur-sm animate-slideIn">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="text-sm font-medium text-yellow-400">
                Требуется авторизация
              </div>
            </div>
            <div className="text-xs text-gray-400">
              Войдите через VK ID для анализа графа друзей
            </div>
          </div>
          <VKLoginButton appId={appId} redirectUri={redirectUri} />
        </>
      )}

      {authenticated && (
        <>
          {/* Info block */}
          <div className="p-4 bg-gradient-to-br from-blue-900/20 to-purple-900/20 rounded-xl border border-blue-500/30 backdrop-blur-sm">
            <div className="flex items-start gap-2 mb-2">
              <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <div className="text-xs font-medium text-blue-400 mb-1">
                  Важная информация
                </div>
                <div className="text-xs text-gray-400 leading-relaxed">
                  Список друзей должен быть публичным. Настройки → Приватность → "Кто видит список моих друзей"
                </div>
              </div>
            </div>
          </div>
          
          {/* User selection */}
          <div className="space-y-3">
            <label className="flex items-center gap-3 text-sm text-gray-300 cursor-pointer group">
              <input
                type="checkbox"
                checked={useCustomId}
                onChange={(e) => setUseCustomId(e.target.checked)}
                className="w-4 h-4 rounded bg-gray-800 border-gray-700 text-purple-600 focus:ring-2 focus:ring-purple-500/50 transition-all"
              />
              <span className="group-hover:text-white transition-colors">Анализировать другого пользователя</span>
            </label>
            
            {useCustomId ? (
              <input
                type="number"
                className="w-full bg-gray-800 border border-gray-700 focus:border-purple-500 rounded-lg p-3 text-sm placeholder-gray-500 transition-all"
                value={customUserId || ''}
                onChange={(e) => setCustomUserId(Number(e.target.value))}
                placeholder="Введите VK ID"
              />
            ) : (
              <div className="text-xs text-gray-500 p-3 bg-gray-800/50 rounded-lg border border-gray-800">
                Граф друзей для ID: {userId}
              </div>
            )}
          </div>

          {/* Depth selection */}
          <div className="space-y-3 p-4 bg-gray-800/30 rounded-xl border border-gray-700">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-300">
                Глубина анализа
              </label>
              <span className="text-lg font-bold text-purple-400">
                {depth === 1 ? '1 уровень' : depth === 2 ? '2 уровня' : '3 уровня'}
              </span>
            </div>
            
            <input
              type="range"
              min="1"
              max="3"
              step="1"
              value={depth}
              onChange={(e) => setDepth(Number(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
            />
            
            <div className="flex justify-between text-xs text-gray-500">
              <span>🔹 1</span>
              <span>🔹🔹 2</span>
              <span>🔹🔹🔹 3</span>
            </div>

            {/* Лимит друзей на depth=1 */}
            {depth === 1 && (
              <div className="mt-3 p-3 bg-gray-800/30 rounded-lg border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-300">
                    Лимит друзей (0 = все)
                  </label>
                  <span className="text-sm text-purple-300">{depth1Limit === 0 ? 'все' : depth1Limit}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={2000}
                  step={10}
                  value={depth1Limit}
                  onChange={(e) => setDepth1Limit(Number(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>0</span>
                  <span>1000</span>
                  <span>2000</span>
                </div>
              </div>
            )}

            {/* Предупреждение для depth=3 */}
            {depth === 3 && (
              <div className="text-xs p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-300">
                <div className="flex items-center gap-2 mb-1 font-bold">
                  <span>⚠️</span>
                  <span>ОСТОРОЖНО: 3 уровень</span>
                </div>
                <span>Может создать граф с десятками тысяч узлов! Используйте минимальное количество друзей (5-10).</span>
              </div>
            )}
          </div>

          {/* Max friends для depth>=2 */}
          {depth >= 2 && (
            <div className={`space-y-3 p-4 rounded-xl border ${
              depth === 3 
                ? 'bg-gradient-to-br from-red-900/20 to-orange-900/20 border-red-700/30' 
                : 'bg-gradient-to-br from-purple-900/20 to-blue-900/20 border-purple-700/30'
            }`}>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-300">
                  Количество друзей для анализа
                </label>
                <span className="text-lg font-bold text-purple-400">{maxFriends}</span>
              </div>
              
              <input
                type="range"
                min="5"
                max="50"
                step="5"
                value={maxFriends}
                onChange={(e) => setMaxFriends(Number(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
              
              <div className="flex justify-between text-xs text-gray-500">
                <span>5 (быстро)</span>
                <span>25</span>
                <span>50 (медленно)</span>
              </div>

              {/* Предупреждение о размере */}
              <div className={`text-xs p-2 rounded-lg border ${
                estimatedNodes < 2000 
                  ? 'bg-green-900/20 border-green-700/30 text-green-400' 
                  : estimatedNodes < 5000
                  ? 'bg-yellow-900/20 border-yellow-700/30 text-yellow-400'
                  : estimatedNodes < 15000
                  ? 'bg-orange-900/20 border-orange-700/30 text-orange-400'
                  : 'bg-red-900/20 border-red-700/30 text-red-400'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <span>{estimatedNodes < 2000 ? '✓' : estimatedNodes < 5000 ? '⚠️' : estimatedNodes < 15000 ? '🔥' : '💀'}</span>
                  <span className="font-medium">Примерно ~{estimatedNodes.toLocaleString()} узлов</span>
                </div>
                {estimatedNodes < 2000 && <span>Отличная производительность</span>}
                {estimatedNodes >= 2000 && estimatedNodes < 5000 && <span>Может подтормаживать</span>}
                {estimatedNodes >= 5000 && estimatedNodes < 15000 && <span>Сильные лаги! Уменьшите количество</span>}
                {estimatedNodes >= 15000 && <span>КРИТИЧНО! Браузер может зависнуть!</span>}
              </div>
            </div>
          )}

          {/* Flood control */}
          <div className="space-y-3 p-4 bg-gray-800/30 rounded-xl border border-gray-700">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-300">
                Скорость запросов к VK (мс между вызовами)
              </label>
              <span className="text-lg font-bold text-purple-400">{minIntervalMs} мс</span>
            </div>
            <input
              type="range"
              min={300}
              max={3000}
              step={100}
              value={minIntervalMs}
              onChange={(e) => setMinIntervalMs(Number(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>300 ( риск FC )</span>
              <span>1200 ( рекомендуемо )</span>
              <span>3000 ( безопасно )</span>
            </div>
          </div>

          {depth === 1 && (
            <div className="text-xs text-gray-500 p-2 bg-gray-800/30 rounded-lg border border-gray-800">
              💡 Уровень 1: граф ваших друзей и связей между ними (~100-200 узлов)
            </div>
          )}

          {depth === 2 && (
            <div className="text-xs text-blue-400 p-2 bg-blue-900/20 rounded-lg border border-blue-700/30">
              📊 Уровень 2: ваши друзья + их друзья (расширенный граф)
            </div>
          )}

          {depth === 3 && (
            <div className="text-xs text-orange-400 p-2 bg-orange-900/20 rounded-lg border border-orange-700/30">
              🌐 Уровень 3: друзья + их друзья + друзья друзей друзей (огромная сеть!)
            </div>
          )}

          {/* Metrics compute multi-select */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">
              Какие метрики считать
            </label>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[
                { key: 'rooted', label: '🎯 Личная важность' },
                { key: 'closeness', label: '📊 Closeness' },
                { key: 'betweenness', label: '🔀 Betweenness' },
                { key: 'eigenvector', label: '⭐ Eigenvector' },
              ].map((m) => {
                const checked = selectedMetrics.includes(m.key as any);
                return (
                  <label key={m.key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...selectedMetrics, m.key as any]
                          : selectedMetrics.filter((x) => x !== (m.key as any));
                        setSelectedMetrics(next as any);
                      }}
                      className="w-4 h-4 rounded bg-gray-800 border-gray-700 text-purple-600 focus:ring-2 focus:ring-purple-500/50"
                    />
                    <span className="text-gray-300">{m.label}</span>
                  </label>
                );
              })}
            </div>
            <div className="text-xs text-gray-500">Подсказка: если выбран режим “All”, будет усреднение по отмеченным метрикам.</div>
          </div>

          {/* Metric selection for display */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">
              Визуализировать по метрике
            </label>
            <select
              className="w-full bg-gray-800 border border-gray-700 focus:border-purple-500 rounded-lg p-3 text-sm transition-all"
              value={metric}
              onChange={(e) => setMetric(e.target.value as any)}
            >
              <option value="rooted">🎯 Личная важность (относительно меня)</option>
              <option value="closeness">📊 Closeness (близость)</option>
              <option value="betweenness">🔀 Betweenness (посредничество)</option>
              <option value="eigenvector">⭐ Eigenvector (влиятельность)</option>
              <option value="all">📈 All (среднее)</option>
            </select>
          </div>

          {/* Build button */}
          <button
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 transition-all rounded-lg p-4 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg hover:shadow-xl relative overflow-hidden group"
            disabled={loading || (useCustomId && !customUserId)}
            onClick={handleLoadGraph}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-blue-400 opacity-0 group-hover:opacity-20 transition-opacity"></div>
            {loading ? (
              <span className="flex items-center justify-center gap-2 relative z-10">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Построение графа...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2 relative z-10">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Построить граф
              </span>
            )}
          </button>
        </>
      )}
    </aside>
  );
}
