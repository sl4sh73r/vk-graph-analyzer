import React, { useEffect } from 'react';
import GraphView from './components/GraphView';
import Sidebar from './components/Sidebar';
import RightSidebar from './components/RightSidebar';
import { useStore } from './store';

export default function App() {
  const checkAuth = useStore((s) => s.checkAuth);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <div className="min-h-screen grid grid-cols-[260px_1fr] bg-gray-950 text-gray-100">
      <Sidebar />
      <GraphView />
      <RightSidebar />
    </div>
  );
}
