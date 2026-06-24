import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileBottomNav from './MobileBottomNav';
import GlobalSearch from './GlobalSearch';
import NotificationBell from './NotificationBell';
import UserMenu from './UserMenu';
import OfflineBar from '@/components/pwa/OfflineBar';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { toast } from 'sonner';
import ChatbotSoporte from '@/components/soporte/ChatbotSoporte';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useEmergencyNotifications } from '@/hooks/useEmergencyNotifications';
import EmergencyAlert from '@/components/emergencias/EmergencyAlert';
import { useState } from 'react';
import { useSmartCache } from '@/hooks/useSmartCache';

export default function AppLayout() {
  // Activa el sistema de caché persistente — hydration instantánea + auto-persist
  useSmartCache();

  const { isOnline, pendingCount, isSyncing, syncPending } = useOfflineQueue((count) => {
    toast.success(`${count} orden${count !== 1 ? 'es' : ''} de trabajo sincronizada${count !== 1 ? 's' : ''} correctamente`);
  });
  const { currentUser } = useCurrentUser();
  const [activeEmergency, setActiveEmergency] = useState(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const navigate = useNavigate();

  // Notificaciones de emergencia para gerencia (admin)
  useEmergencyNotifications(currentUser, setActiveEmergency);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0f1e34 55%, #091422 100%)' }}>
      <OfflineBar isOnline={isOnline} pendingCount={pendingCount} isSyncing={isSyncing} onSync={syncPending} />
      <Sidebar open={mobileNavOpen} onOpenChange={setMobileNavOpen} />
      <div className={`flex-1 flex flex-col min-w-0 overflow-hidden ${!isOnline || isSyncing || pendingCount > 0 ? 'pt-8' : ''}`}>
        {/* Top bar */}
        <header className="h-14 border-b border-white/8 flex items-center gap-3 pl-14 pr-4 lg:pl-5 lg:pr-5 flex-shrink-0 z-30"
          style={{ background: 'rgba(10,22,40,0.85)', backdropFilter: 'blur(12px)' }}>
          <div className="flex-1 max-w-md">
            <GlobalSearch />
          </div>
          <div className="flex items-center gap-1 ml-auto">
            <NotificationBell />
            <UserMenu />
          </div>
        </header>
        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6 pb-24 lg:pb-6" style={{ background: 'transparent' }}>
          <div className="page-enter">
            <Outlet />
          </div>
        </main>
      </div>
      <MobileBottomNav onMore={() => setMobileNavOpen(true)} />
      <ChatbotSoporte />
      <EmergencyAlert
        emergencia={activeEmergency}
        onClose={() => setActiveEmergency(null)}
        onView={() => { navigate('/emergencias'); setActiveEmergency(null); }}
      />
    </div>
  );
}