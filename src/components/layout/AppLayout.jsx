import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import GlobalSearch from './GlobalSearch';
import NotificationBell from './NotificationBell';
import UserMenu from './UserMenu';
import OfflineBar from '@/components/pwa/OfflineBar';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { toast } from 'sonner';

export default function AppLayout() {
  const { isOnline, pendingCount, isSyncing, syncPending } = useOfflineQueue((count) => {
    toast.success(`${count} orden${count !== 1 ? 'es' : ''} de trabajo sincronizada${count !== 1 ? 's' : ''} correctamente`);
  });

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <OfflineBar isOnline={isOnline} pendingCount={pendingCount} isSyncing={isSyncing} onSync={syncPending} />
      <Sidebar />
      <div className={`flex-1 flex flex-col min-w-0 overflow-hidden ${!isOnline || isSyncing || pendingCount > 0 ? 'pt-8' : ''}`}>
        {/* Top bar */}
        <header className="h-13 border-b border-border/70 bg-white/90 backdrop-blur-sm flex items-center gap-3 pl-14 pr-4 lg:px-5 flex-shrink-0 z-30 shadow-sm">
          <div className="flex-1 max-w-lg">
            <GlobalSearch />
          </div>
          <div className="flex items-center gap-0.5 ml-auto">
            <NotificationBell />
            <UserMenu />
          </div>
        </header>
        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-5 bg-background">
          <Outlet />
        </main>
      </div>
    </div>
  );
}