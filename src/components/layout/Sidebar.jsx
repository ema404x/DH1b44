import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FolderKanban, ClipboardList, Users, UserCog,
  Package, FileText, Receipt, ChevronLeft, ChevronRight, Menu, X,
  Wrench, TrendingUp, ClipboardCheck, Calculator, CalendarDays, Cpu, Zap, BarChart2, Award, Shield, Lock, MapPin, BookOpen, Upload
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navGroups = [
  {
    label: 'General',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
      { label: 'Calendario', icon: CalendarDays, path: '/calendario' },
    ]
  },
  {
    label: 'Operaciones',
    items: [
      { label: 'Proyectos', icon: FolderKanban, path: '/proyectos' },
      { label: 'Órdenes de Trabajo', icon: ClipboardList, path: '/ordenes' },
      { label: 'Activos & Equipos', icon: Cpu, path: '/activos' },
      { label: 'Informes', icon: ClipboardCheck, path: '/informes' },
      { label: 'Reportes & KPIs', icon: BarChart2, path: '/reportes' },
      { label: 'Automatizaciones', icon: Zap, path: '/automatizaciones' },
    ]
  },
  {
    label: 'Comercial',
    items: [
      { label: 'Clientes', icon: Users, path: '/clientes' },
      { label: 'Presupuestos', icon: FileText, path: '/presupuestos' },
      { label: 'Presupuestos Obra', icon: Calculator, path: '/presupuestos-obra' },
      { label: 'Certificados', icon: Award, path: '/certificados' },
      { label: 'Facturación', icon: Receipt, path: '/facturacion' },
      { label: 'Finanzas', icon: TrendingUp, path: '/finanzas' },
    ]
  },
  {
    label: 'Recursos',
    items: [
      { label: 'Empleados', icon: UserCog, path: '/empleados' },
      { label: 'Asistencia', icon: ClipboardList, path: '/asistencia' },
      { label: 'Mapa de Ubicaciones', icon: MapPin, path: '/mapa' },
      { label: 'Inventario', icon: Package, path: '/inventario' },
    ]
  },
  {
    label: 'Administración',
    items: [
      { label: 'Control de Acceso', icon: Lock, path: '/permisos' },
      { label: 'Auditoría', icon: FileText, path: '/auditoria' },
      { label: 'Centro de Seguridad', icon: Shield, path: '/seguridad' },
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

function NavItem({ item, collapsed, active, onClick }) {
  return (
    <div className="relative group">
      <Link
        to={item.path}
        onClick={onClick}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 relative",
          collapsed && "justify-center px-0 mx-1",
          active
            ? "bg-primary/15 text-white"
            : "text-sidebar-foreground/65 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
        )}
      >
        {/* Active indicator bar */}
        {active && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
        )}
        <item.icon className={cn(
          "flex-shrink-0 transition-transform duration-150",
          collapsed ? "h-[18px] w-[18px]" : "h-[16px] w-[16px]",
          active ? "text-primary" : ""
        )} />
        {!collapsed && (
          <span className="truncate">{item.label}</span>
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
}

export default function Sidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn(
        "flex items-center gap-3 px-4 py-4 border-b border-white/8",
        collapsed && "justify-center px-2 py-4"
      )}>
        <img
          src="https://media.base44.com/images/public/69bc7d2a6f0e7ed160c90003/7a2959dd1_image.png"
          alt="DH1 Software"
          className={cn(
            "object-contain mix-blend-screen transition-all duration-300",
            collapsed ? "h-8 w-8" : "h-10"
          )}
        />
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm leading-tight tracking-wide">DH1 Software</p>
            <p className="text-sidebar-foreground/40 text-[10px] tracking-widest uppercase">Platform</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 overflow-y-auto space-y-4 scrollbar-thin">
        {navGroups.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <div className="px-3 mb-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-sidebar-foreground/30 flex items-center gap-2">
                <span>{group.label}</span>
                <div className="flex-1 h-px bg-white/5" />
              </div>
            )}
            {collapsed && <div className="h-px bg-white/5 my-2 mx-2" />}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavItem
                  key={item.path}
                  item={item}
                  collapsed={collapsed}
                  active={isActive(item.path)}
                  onClick={() => setMobileOpen(false)}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="hidden lg:flex p-3 border-t border-sidebar-border/50">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sidebar-foreground/40 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-all duration-150 text-xs"
        >
          {collapsed
            ? <ChevronRight className="h-4 w-4" />
            : <><ChevronLeft className="h-4 w-4" /><span>Colapsar</span></>
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