import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FolderKanban, ClipboardList, ClipboardCheck, Users, UserCog,
  Package, FileText, Receipt, ChevronLeft, ChevronRight, ChevronDown, Menu, X,
  Wrench, TrendingUp, Calculator, CalendarDays, Zap, BarChart2, Award, Shield, Lock, MapPin, BookOpen, Upload, Bell, Truck, Info, AlertTriangle, FileCheck2, ShieldAlert, MessageSquare, Flame, RefreshCw, Wallet
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import { useForoNotificaciones } from '@/hooks/useForoNotificaciones';
import { useAprobacionPendientes } from '@/hooks/useAprobacionPendientes';

const navGroups = [
  {
    label: 'General',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
      { label: 'Calendario', icon: CalendarDays, path: '/calendario' },
    ]
  },
  {
    label: 'Emergencias',
    items: [
      { label: '🚨 Emergencias', icon: AlertTriangle, path: '/emergencias' },
    ]
  },
  {
    label: 'Operaciones',
    items: [
      { label: 'Proyectos', icon: FolderKanban, path: '/proyectos' },
      { label: 'Órdenes de Trabajo', icon: ClipboardList, path: '/ordenes' },
      { label: 'Pendientes', icon: ClipboardCheck, path: '/activos' },
      { label: 'Informes', icon: ClipboardCheck, path: '/informes' },
      { label: 'Plan de Infraestructura', icon: Wrench, path: '/calefaccion' },
      { label: 'Rutinas de Mantenimiento', icon: RefreshCw, path: '/rutinas' },
      { label: 'Inspección de Colegios', icon: ClipboardCheck, path: '/inspeccion-colegio' },
      { label: 'Reportes & KPIs', icon: BarChart2, path: '/reportes' },
      { label: 'Automatizaciones', icon: Zap, path: '/automatizaciones' },
    ]
  },
  {
    label: 'Comercial',
    items: [
      { label: 'Proveedores', icon: Truck, path: '/clientes' },
      { label: 'Presupuestos Obra', icon: Calculator, path: '/presupuestos-obra' },
      { label: 'Control de Riesgos', icon: ShieldAlert, path: '/control-riesgo' },
      { label: 'Certificados', icon: Award, path: '/certificados' },
      { label: 'Aprobación Certificados', icon: FileCheck2, path: '/aprobacion-certificados' },
      { label: 'Certificación de Obras', icon: FileCheck2, path: '/certificacion-obras' },
      { label: 'Centro Financiero', icon: Wallet, path: '/facturacion' },
    ]
  },
  {
    label: 'Recursos',
    items: [
      { label: 'Información General', icon: Info, path: '/informacion-general' },
      { label: 'Empleados', icon: UserCog, path: '/empleados' },
      { label: 'Mapa de Ubicaciones', icon: MapPin, path: '/mapa' },
      { label: 'Mapa Jefes de Sitio', icon: MapPin, path: '/mapa-jefes' },
      { label: 'Inventario', icon: Package, path: '/inventario' },
    ]
  },
  {
    label: 'Administración',
    items: [
      { label: 'Alertas Proactivas', icon: Bell, path: '/alertas' },
      { label: 'Control de Acceso', icon: Lock, path: '/permisos' },
      { label: 'Auditoría', icon: FileText, path: '/auditoria' },
      { label: 'Centro de Seguridad', icon: Shield, path: '/seguridad' },
    ]
  },
  {
    label: 'Comunicación',
    items: [
      { label: 'Foro de Comunicaciones', icon: MessageSquare, path: '/foro' },
    ]
  },
  {
    label: 'Ayuda y Aprendizaje',
    items: [
      { label: 'Centro de Aprendizaje', icon: BookOpen, path: '/tutorial' },
      { label: 'Importar Datos', icon: Upload, path: '/importar' },
    ]
  },
];

const NavItem = React.memo(function NavItem({ item, collapsed, active, onClick, hasNewMessages, pendientesAprobacion }) {
  const isForo = item.path === '/foro';
  const isAprobacion = item.path === '/aprobacion-certificados';
  const showAprobacionBadge = isAprobacion && pendientesAprobacion > 0 && !active;

  return (
    <div className="relative group">
      <Link
        to={item.path}
        onClick={onClick}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 relative",
          collapsed && "justify-center px-0 mx-1",
          active
            ? "bg-primary/20 text-white shadow-sm shadow-primary/10"
            : "text-white/70 hover:bg-white/6 hover:text-white",
        )}
      >
        {/* Active indicator bar */}
        {active && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-primary rounded-r-full shadow-[0_0_8px_2px_rgba(59,130,246,0.4)]" />
        )}
        <div className="relative flex-shrink-0">
          <item.icon className={cn(
            "transition-transform duration-150",
            collapsed ? "h-[18px] w-[18px]" : "h-[16px] w-[16px]",
            active ? "text-primary" : ""
          )} />
          {isForo && hasNewMessages && !active && (
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary animate-pulse" />
          )}
          {showAprobacionBadge && (
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center">
              <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 animate-ping" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_3px_rgba(251,191,36,0.7)]" />
            </span>
          )}
        </div>
        {!collapsed && (
          <span className="truncate flex-1">{item.label}</span>
        )}
        {!collapsed && isForo && hasNewMessages && !active && (
          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary animate-pulse flex-shrink-0" />
        )}
        {!collapsed && showAprobacionBadge && (
          <span className="ml-auto flex items-center gap-1 flex-shrink-0">
            <span className="text-[10px] font-bold bg-amber-400/20 text-amber-400 border border-amber-400/40 px-1.5 py-0.5 rounded-full leading-none shadow-[0_0_6px_2px_rgba(251,191,36,0.3)] animate-pulse">
              {pendientesAprobacion}
            </span>
          </span>
        )}
      </Link>
      {/* Tooltip when collapsed */}
      {collapsed && (
        <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 pointer-events-none
          bg-[#1a2d48] text-white text-xs font-medium px-2.5 py-1.5 rounded-md whitespace-nowrap
          opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-xl border border-white/10">
          {item.label}
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#1a2d48]" />
        </div>
      )}
    </div>
  );
});

export default function Sidebar({ open, onOpenChange }) {
  const location = useLocation();
  const { user, userPermissions } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [internalMobileOpen, setInternalMobileOpen] = useState(false);
  const mobileOpen = open !== undefined ? open : internalMobileOpen;
  const setMobileOpen = (v) => {
    if (onOpenChange) onOpenChange(v);
    if (open === undefined) setInternalMobileOpen(v);
  };
  const [collapsedGroups, setCollapsedGroups] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('dh1-collapsed-nav'));
      if (Array.isArray(saved)) return new Set(saved);
    } catch {}
    // Por defecto colapsa todos; el efecto expande el grupo de la ruta activa
    return new Set(navGroups.map(g => g.label));
  });
  const { hasNewMessages, resetNotification } = useForoNotificaciones();
  const { pendientesAprobacion } = useAprobacionPendientes();
  
  // Resetear notificación cuando se abre el foro
  useEffect(() => {
    if (location.pathname === '/foro') {
      resetNotification();
    }
  }, [location.pathname, resetNotification]);

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  // Persistir grupos colapsados
  useEffect(() => {
    localStorage.setItem('dh1-collapsed-nav', JSON.stringify([...collapsedGroups]));
  }, [collapsedGroups]);

  // Auto-expandir el grupo que contiene la ruta activa (solo en sidebar expandida)
  useEffect(() => {
    if (collapsed) return;
    setCollapsedGroups(prev => {
      const activeGroup = navGroups.find(g => g.items.some(it => isActive(it.path)));
      if (!activeGroup || !prev.has(activeGroup.label)) return prev;
      const next = new Set(prev);
      next.delete(activeGroup.label);
      return next;
    });
  }, [location.pathname, collapsed]);

  const toggleGroup = (label) =>
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });

  // Mapeo de rutas → clave de módulo en RolePermission
  const routeToModule = {
    '/': 'Dashboard',
    '/calendario': 'Calendario',
    '/emergencias': 'Emergencias',
    '/proyectos': 'Project',
    '/ordenes': 'WorkOrder',
    '/activos': 'Asset',
    '/informes': 'Informes',
    '/inspeccion-colegio': 'InspeccionColegio',
    '/reportes': 'Reportes',
    '/automatizaciones': 'Automatizaciones',
    '/clientes': 'Client',
    '/presupuestos-obra': 'PresupuestosObra',
    '/control-riesgo': 'ControlRiesgo',
    '/certificados': 'Certificado',
    '/aprobacion-certificados': 'AprobacionCertificados',
    '/certificacion-obras': 'CertificacionObras',
    '/facturacion': 'Invoice',
    '/informacion-general': 'InformacionGeneral',
    '/empleados': 'Employee',
    '/mapa': 'Mapa',
    '/mapa-jefes': 'MapaJefes',
    '/inventario': 'Inventory',
    '/alertas': 'Alertas',
    '/permisos': 'Permisos',
    '/auditoria': 'AuditLog',
    '/seguridad': 'Seguridad',
    '/calefaccion': 'Calefaccion',
    '/rutinas': 'Rutinas',
    '/foro': null,
    '/tutorial': null,
    '/importar': 'ImportarDatos',
  };

  // Filtrar grupos según permisos del rol
  // Solo los admins de Base44 (user.role === 'admin') ven todo sin restricciones
  // Si hay permisos configurados → filtrar según read
  // Si NO hay permisos configurados y NO es admin → mostrar solo Dashboard y Tutorial (acceso mínimo)
  const visibleGroups = navGroups.map(group => ({
    ...group,
    items: group.items.filter(item => {
      if (user?.role === 'admin') return true;
      if (!userPermissions) {
        // Sin permisos configurados: solo acceso mínimo
        return item.path === '/' || item.path === '/tutorial' || item.path === '/calendario';
      }
      const moduleKey = routeToModule[item.path];
      if (!moduleKey) return true; // rutas sin restricción (tutorial, etc.)
      return userPermissions[moduleKey]?.read === true;
    })
  })).filter(group => group.items.length > 0);

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn(
        "flex items-center gap-3 px-4 py-4 border-b border-white/8",
        collapsed && "justify-center px-2 py-4"
      )}>
        <div className={cn("relative flex-shrink-0", collapsed ? "h-8 w-8" : "h-10")}>
          <img
            src="https://media.base44.com/images/public/69bc7d2a6f0e7ed160c90003/7a2959dd1_image.png"
            alt="DH1 Software"
            className={cn(
              "object-contain mix-blend-screen transition-all duration-300 relative z-10",
              collapsed ? "h-8 w-8" : "h-10"
            )}
            style={{ filter: 'drop-shadow(0 0 6px rgba(0,180,255,0.7)) drop-shadow(0 0 14px rgba(0,220,130,0.45))' }}
          />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p
              className="font-semibold text-sm leading-tight tracking-wide"
              style={{
                color: '#e8f4ff',
                animation: 'glowPulse 2.8s ease-in-out infinite',
              }}
            >DH1 Software</p>
            <p className="text-sidebar-foreground/40 text-[10px] tracking-widest uppercase">Platform</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 overflow-y-auto space-y-4 scrollbar-thin">
        {visibleGroups.map((group) => {
          const isGroupCollapsed = collapsedGroups.has(group.label);
          const groupPending = pendientesAprobacion > 0 && group.items.some(it => it.path === '/aprobacion-certificados') ? pendientesAprobacion : 0;
          const wrapperCls = collapsed
            ? "space-y-0.5"
            : cn("space-y-0.5 overflow-hidden transition-all duration-200", isGroupCollapsed ? "max-h-0 opacity-0" : "max-h-[600px] opacity-100");
          return (
            <div key={group.label}>
              {!collapsed ? (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  aria-expanded={!isGroupCollapsed}
                  className={cn(
                    "w-full px-3 mb-1 mt-1 text-[9px] font-bold uppercase tracking-[0.14em] flex items-center gap-2 transition-colors",
                    groupPending > 0 && isGroupCollapsed ? "text-amber-400 hover:text-amber-300" : "text-sidebar-foreground/60 hover:text-sidebar-foreground/90"
                  )}
                >
                  <ChevronDown className={cn("h-3 w-3 flex-shrink-0 transition-transform duration-200", isGroupCollapsed && "-rotate-90")} />
                  <span className="flex-shrink-0">{group.label}</span>
                  <div className="flex-1 h-px bg-white/12" />
                  {groupPending > 0 && isGroupCollapsed ? (
                    <span className="shrink-0 flex items-center">
                      <span className="relative flex h-2.5 w-2.5 items-center justify-center">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 animate-ping" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_6px_2px_rgba(251,191,36,0.6)]" />
                      </span>
                    </span>
                  ) : (
                    <span className="text-[8px] text-sidebar-foreground/40 tabular-nums shrink-0">{group.items.length}</span>
                  )}
                </button>
              ) : (
                <div className="h-px bg-white/5 my-2 mx-2" />
              )}
              <div className={wrapperCls}>
                {group.items.map((item) => (
                  <NavItem
                    key={item.path}
                    item={item}
                    collapsed={collapsed}
                    active={isActive(item.path)}
                    onClick={() => setMobileOpen(false)}
                    hasNewMessages={item.path === '/foro' ? hasNewMessages : false}
                    pendientesAprobacion={pendientesAprobacion}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="hidden lg:flex p-3 border-t border-sidebar-border/30">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sidebar-foreground/30 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground/70 transition-all duration-150 text-xs group"
        >
          {collapsed
            ? <ChevronRight className="h-4 w-4 group-hover:scale-110 transition-transform" />
            : <>
                <ChevronLeft className="h-4 w-4 group-hover:scale-110 transition-transform" />
                <span className="tracking-wide">Colapsar</span>
              </>
          }
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3.5 left-4 z-50 h-9 w-9 rounded-lg bg-card shadow-md border border-border flex items-center justify-center"
      >
        <Menu className="h-4 w-4" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-64 shadow-2xl" style={{ background: 'linear-gradient(180deg, #0a1628 0%, #0f1e34 55%, #091422 100%)' }}>
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-3 text-sidebar-foreground/50 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className={cn(
        "hidden lg:flex flex-col border-r border-white/8 transition-all duration-300 flex-shrink-0",
        collapsed ? "w-[58px]" : "w-[228px]"
      )} style={{ background: 'linear-gradient(180deg, #0a1628 0%, #0f1e34 55%, #091422 100%)' }}>
        {sidebarContent}
      </aside>
    </>
  );
}