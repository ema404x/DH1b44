import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { LogOut, ChevronDown, UserCircle, Trash2, Bell, WifiOff, Gauge, Zap, Rocket, Smartphone } from 'lucide-react';
import { isModoOperario } from '@/lib/modoOperario';
import VerificacionesResumen from '@/components/layout/VerificacionesResumen';
import VerificacionesDialog from '@/components/layout/VerificacionesDialog';
import { useArranqueVerificacion } from '@/hooks/useArranqueVerificacion';
import ArranqueRapidoEstado from '@/components/layout/ArranqueRapidoEstado';
import ArranqueRapidoDiferencias from '@/components/layout/ArranqueRapidoDiferencias';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { isOfflineEnabled, clearOfflineSession } from '@/lib/offlineSession';
import { useOfflineEnabled, useOfflineOps } from '@/hooks/useOfflineOps';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction
} from '@/components/ui/alert-dialog';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';

// variant="nav": se usa como "Perfil" en la barra inferior del Modo operario.
export default function UserMenu({ variant } = {}) {
  const enBarra = variant === 'nav';
  const [open, setOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const navigate = useNavigate();
  const { user, offlineMode, setOfflineHabilitado, setPanelRapido, setOrdenesRapidas, setArranqueRapido, setModoOperario } = useAuth();
  const [savingOperario, setSavingOperario] = useState(false);
  const handleModoOperarioToggle = async (value) => {
    setSavingOperario(true);
    try {
      await setModoOperario(value);
      setOpen(false);
      navigate(value ? '/operario' : '/');
    } catch {
      toast.error('No se pudo cambiar el Modo operario');
    } finally {
      setSavingOperario(false);
    }
  };
  const verificacionArranque = useArranqueVerificacion();
  const [showArranqueDifs, setShowArranqueDifs] = useState(false);
  const [showVerificaciones, setShowVerificaciones] = useState(false);
  const [savingArranque, setSavingArranque] = useState(false);
  const handleArranqueRapidoToggle = async (value) => {
    setSavingArranque(true);
    try {
      await setArranqueRapido(value);
    } catch {
      toast.error('No se pudo cambiar el Arranque rápido');
    } finally {
      setSavingArranque(false);
    }
  };
  const [savingOrdenes, setSavingOrdenes] = useState(false);
  const handleOrdenesRapidasToggle = async (value) => {
    setSavingOrdenes(true);
    try {
      await setOrdenesRapidas(value);
    } catch {
      toast.error('No se pudo cambiar Órdenes rápidas');
    } finally {
      setSavingOrdenes(false);
    }
  };
  const [savingPanel, setSavingPanel] = useState(false);
  const handlePanelRapidoToggle = async (value) => {
    setSavingPanel(true);
    try {
      await setPanelRapido(value);
    } catch {
      toast.error('No se pudo cambiar el Panel rápido');
    } finally {
      setSavingPanel(false);
    }
  };
  const { displayName } = useCurrentUser();
  const [savingOffline, setSavingOffline] = useState(false);
  // Con offline_habilitado: avisar antes de cerrar sesión si hay cambios sin enviar.
  const offlineEnabled = useOfflineEnabled();
  const { ops: pendingOps } = useOfflineOps(offlineEnabled);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const doLogout = () => { clearOfflineSession(); base44.auth.logout(); };

  const handleOfflineToggle = async (value) => {
    setSavingOffline(true);
    try {
      await setOfflineHabilitado(value);
    } catch {
      toast.error('No se pudo cambiar el modo sin conexión');
    } finally {
      setSavingOffline(false);
    }
  };

  // Bug fix: guard para string vacío — n[0] de '' es undefined, causando '?' inesperado
  const initials = displayName?.trim()
    ? displayName.trim().split(/\s+/).map(n => n[0] || '').join('').toUpperCase().slice(0, 2) || '?'
    : '?';

  return (
    <div className={enBarra ? 'relative flex flex-1' : 'relative'}>
      {enBarra ? (
        <button
          onClick={() => setOpen(!open)}
          className="flex flex-1 flex-col items-center justify-center gap-1.5 py-2.5 min-h-[56px] select-none active:bg-muted/40 transition-colors"
        >
          <span className="flex h-8 w-16 items-center justify-center rounded-full">
            <UserCircle className="h-5 w-5 text-muted-foreground" />
          </span>
          <span className="text-[11px] leading-none tracking-wide text-muted-foreground">Perfil</span>
        </button>
      ) : (
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-center gap-2 h-11 w-11 lg:h-9 lg:w-auto lg:px-2 rounded-lg hover:bg-white/10 transition-colors"
      >
        <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold flex-shrink-0">
          {initials}
        </div>
        <span className="hidden lg:block text-sm font-medium max-w-[120px] truncate text-slate-300">{displayName}</span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-500 hidden lg:block" />
      </button>
      )}

      {open && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} style={{ touchAction: 'none' }} />
          <div
            className={enBarra
              ? 'fixed right-2 z-[70] w-64 max-h-[70vh] overflow-y-auto bg-popover border border-border rounded-xl shadow-2xl py-1.5'
              : 'fixed right-2 top-14 z-[70] w-56 bg-popover border border-border rounded-xl shadow-2xl py-1.5 overflow-hidden'}
            style={enBarra ? { bottom: 'calc(68px + env(safe-area-inset-bottom))' } : undefined}
          >
            <div className="px-3 py-2.5 border-b border-border mb-1">
              <div className="text-sm font-semibold truncate text-popover-foreground">{displayName}</div>
              <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
              <span className="inline-block mt-1 text-[10px] bg-primary/10 text-primary font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide">{user?.role || 'user'}</span>
            </div>
            <button
              onClick={() => { navigate('/empleados'); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent transition-colors text-left text-popover-foreground"
            >
              <UserCircle className="h-4 w-4 text-muted-foreground" />
              Mi perfil
            </button>
            <button
              onClick={() => { window.dispatchEvent(new CustomEvent('dh1:open-push-config')); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent transition-colors text-left text-popover-foreground"
            >
              <Bell className="h-4 w-4 text-muted-foreground" />
              Notificaciones Push
            </button>
            {user?.role === 'admin' && (
              <div
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-popover-foreground"
                title={offlineMode ? 'Necesita conexión' : undefined}
              >
                <WifiOff className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1">Modo sin conexión (beta)</span>
                <Switch
                  checked={isOfflineEnabled(user)}
                  disabled={savingOffline || offlineMode}
                  onCheckedChange={handleOfflineToggle}
                />
              </div>
            )}
            {user?.role === 'admin' && (
              <div
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-popover-foreground"
                title={offlineMode ? 'Necesita conexión' : undefined}
              >
                <Gauge className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1">Panel rápido (beta)</span>
                <Switch
                  checked={user?.panel_rapido === true || user?.data?.panel_rapido === true}
                  disabled={savingPanel || offlineMode}
                  onCheckedChange={handlePanelRapidoToggle}
                />
              </div>
            )}
            {user?.role === 'admin' && (
              <div
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-popover-foreground"
                title={offlineMode ? 'Necesita conexión' : undefined}
              >
                <Zap className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1">Órdenes rápidas (beta)</span>
                <Switch
                  checked={user?.ordenes_rapidas === true || user?.data?.ordenes_rapidas === true}
                  disabled={savingOrdenes || offlineMode}
                  onCheckedChange={handleOrdenesRapidasToggle}
                />
              </div>
            )}
            {user?.role === 'admin' && (
              <div
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-popover-foreground"
                title={offlineMode ? 'Necesita conexión' : undefined}
              >
                <Rocket className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1">Arranque rápido (beta)</span>
                <Switch
                  checked={user?.arranque_rapido === true || user?.data?.arranque_rapido === true}
                  disabled={savingArranque || offlineMode}
                  onCheckedChange={handleArranqueRapidoToggle}
                />
              </div>
            )}
            {user?.role === 'admin' && (
              <div
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-popover-foreground"
                title={offlineMode ? 'Necesita conexión' : undefined}
              >
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1">Modo operario (beta)</span>
                <Switch
                  checked={isModoOperario(user)}
                  disabled={savingOperario || offlineMode}
                  onCheckedChange={handleModoOperarioToggle}
                />
              </div>
            )}
            <ArranqueRapidoEstado
              verificacion={verificacionArranque}
              onVer={() => { setShowArranqueDifs(true); setOpen(false); }}
            />
            {user?.role === 'admin' && !offlineMode && (
              <VerificacionesResumen onVer={() => { setShowVerificaciones(true); setOpen(false); }} />
            )}
            <button
              onClick={() => { setShowDeleteDialog(true); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-destructive/10 hover:text-destructive transition-colors text-left text-popover-foreground"
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
              Eliminar cuenta
            </button>
            <div className="mx-2 my-1 border-t border-border" />
            <button
              onClick={() => {
                setOpen(false);
                if (offlineEnabled && pendingOps.length > 0) setShowLogoutConfirm(true);
                else doLogout();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-destructive/10 hover:text-destructive transition-colors text-left text-popover-foreground"
            >
              <LogOut className="h-4 w-4 text-muted-foreground" />
              Cerrar sesión
            </button>
          </div>
        </>
      )}

      <ArranqueRapidoDiferencias
        open={showArranqueDifs}
        onOpenChange={setShowArranqueDifs}
        diferencias={verificacionArranque?.diferencias}
      />

      <VerificacionesDialog open={showVerificaciones} onOpenChange={setShowVerificaciones} />

      <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar sesión?</AlertDialogTitle>
            <AlertDialogDescription>
              Tenés {pendingOps.length} cambio{pendingOps.length !== 1 ? 's' : ''} sin enviar. Si cerrás sesión se pierden. ¿Cerrar igual?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setShowLogoutConfirm(false); doLogout(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cerrar igual
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cuenta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se cerrará tu sesión y deberás contactar a un administrador para completar la eliminación de tu cuenta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { clearOfflineSession(); base44.auth.logout(); setShowDeleteDialog(false); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar cuenta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}