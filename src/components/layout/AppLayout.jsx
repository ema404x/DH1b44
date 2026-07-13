import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Outlet, useNavigate, useLocation, useNavigationType } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import PullToRefresh from '@/components/shared/PullToRefresh';
import Sidebar from './Sidebar';
import MobileHeader from './MobileHeader';
import MobileBottomNav from './MobileBottomNav';
import GlobalSearch from './GlobalSearch';
import NotificationBell from './NotificationBell';
import UserMenu from './UserMenu';
import SectorSwitcher from './SectorSwitcher';
import OfflineBar from '@/components/pwa/OfflineBar';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { toast } from 'sonner';
import ChatbotSoporte from '@/components/soporte/ChatbotSoporte';
import BugReportBubble from '@/components/shared/BugReportBubble';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useEmergencyNotifications } from '@/hooks/useEmergencyNotifications';
import EmergencyAlert from '@/components/emergencias/EmergencyAlert';
import { useSmartCache } from '@/hooks/useSmartCache';

// Estable entre renders — no se recrea nunca
const onSyncCallback = (count) =>
  toast.success(`${count} orden${count !== 1 ? 'es' : ''} de trabajo sincronizada${count !== 1 ? 's' : ''} correctamente`);

// Variantes de slide: push = slide-left, back = slide-right
const slideVariants = {
  initial: (dir) => ({ x: dir > 0 ? '100%' : '-100%' }),
  animate: { x: 0 },
  exit: (dir) => ({ x: dir > 0 ? '-100%' : '100%' }),
};

export default function AppLayout() {
  useSmartCache();

  const queryClient = useQueryClient();
  const { isOnline, pendingCount, isSyncing, syncPending } = useOfflineQueue(onSyncCallback);
  const { currentUser } = useCurrentUser();
  const location = useLocation();
  const navigationType = useNavigationType();
  const [activeEmergency, setActiveEmergency] = useState(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const navigate = useNavigate();

  // PUSH → adelante (1), POP → atrás (-1)
  const direction = navigationType === 'PUSH' ? 1 : -1;

  // Scroll position cache per route — preserva scroll al cambiar de tab
  const mainRef = useRef(null);
  const scrollPositions = useRef({});
  const isTransitioning = useRef(false);

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries();
  }, [queryClient]);

  const handleScroll = useCallback(() => {
    if (isTransitioning.current) return;
    if (mainRef.current) {
      scrollPositions.current[location.pathname] = mainRef.current.scrollTop;
    }
  }, [location.pathname]);

  // Restaurar scroll al cambiar de ruta (después del slide)
  useEffect(() => {
    isTransitioning.current = true;
    const saved = scrollPositions.current[location.pathname] ?? 0;
    const timer = setTimeout(() => {
      if (mainRef.current) mainRef.current.scrollTop = saved;
      isTransitioning.current = false;
    }, 250);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  useEmergencyNotifications(currentUser, setActiveEmergency);

  const handleCloseEmergency = useCallback(() => setActiveEmergency(null), []);
  const handleViewEmergency  = useCallback(() => { navigate('/emergencias'); setActiveEmergency(null); }, [navigate]);
  const handleMoreMobile     = useCallback(() => setMobileNavOpen(true), []);

  // Clase del contenido principal — memoizada para evitar string recalc en cada render
  const mainPaddingClass = useMemo(
    () => !isOnline || isSyncing || pendingCount > 0 ? 'pt-8' : '',
    [isOnline, isSyncing, pendingCount]
  );

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0f1e34 55%, #091422 100%)' }}>
      <OfflineBar isOnline={isOnline} pendingCount={pendingCount} isSyncing={isSyncing} onSync={syncPending} />
      <Sidebar open={mobileNavOpen} onOpenChange={setMobileNavOpen} />
      <div className={`flex-1 flex flex-col min-w-0 overflow-hidden ${mainPaddingClass}`}>
        <MobileHeader />
        {/* Top bar */}
        <header className="h-14 border-b border-white/8 flex items-center gap-3 pl-14 pr-4 lg:pl-5 lg:pr-5 flex-shrink-0 z-30"
          style={{ background: 'rgba(10,22,40,0.85)', backdropFilter: 'blur(12px)' }}>
          <div className="flex-1 max-w-md">
            <GlobalSearch />
          </div>
          <div className="flex items-center gap-1 ml-auto">
            <SectorSwitcher />
            <NotificationBell />
            <UserMenu />
          </div>
        </header>
        {/* Page content — slide transitions + pull-to-refresh */}
        <main ref={mainRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6 pb-24 lg:pb-6" style={{ background: 'transparent' }}>
          <PullToRefresh onRefresh={handleRefresh}>
            <AnimatePresence mode="wait" custom={direction} initial={false}>
              <motion.div
                key={location.pathname}
                custom={direction}
                variants={slideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.2, ease: [0.4, 0.0, 0.2, 1] }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </PullToRefresh>
        </main>
      </div>
      <MobileBottomNav onMore={handleMoreMobile} />
      <ChatbotSoporte />
      <BugReportBubble />
      <EmergencyAlert
        emergencia={activeEmergency}
        onClose={handleCloseEmergency}
        onView={handleViewEmergency}
      />
    </div>
  );
}