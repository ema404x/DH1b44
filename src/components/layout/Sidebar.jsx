import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FolderKanban, ClipboardList, Users, UserCog,
  Package, FileText, Receipt, ChevronLeft, ChevronRight, Menu, X,
  Wrench, TrendingUp, ClipboardCheck, Calculator, CalendarDays, Cpu, Zap, BarChart2, Award, Shield
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
      { label: 'Inventario', icon: Package, path: '/inventario' },
    ]
  },
  {
    label: 'Administración',
    items: [
      { label: 'Control de Acceso', icon: Cpu, path: '/permisos' },
      { label: 'Auditoría', icon: FileText, path: '/auditoria' },
      { label: 'Centro de Seguridad', icon: Shield, path: '/seguridad' },
    ]
  },
];

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
        "flex items-center gap-3 px-4 py-5 border-b border-white/10",
        collapsed && "justify-center px-2"
      )}>
        {collapsed ? (
          <div className="flex-shrink-0 flex items-center justify-center h-9 w-9">
            <img
              src="https://media.base44.com/images/public/69bc7d2a6f0e7ed160c90003/7a2959dd1_image.png"
              alt="DH1 Software"
              className="h-9 w-9 object-contain mix-blend-screen"
            />
          </div>
        ) : (
          <img
            src="https://media.base44.com/images/public/69bc7d2a6f0e7ed160c90003/7a2959dd1_image.png"
            alt="DH1 Software"
            className="h-11 object-contain mix-blend-screen"
          />
        )}
      </div>

      <nav className="flex-1 py-3 px-2 overflow-y-auto space-y-4">
        {navGroups.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <div className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
                {group.label}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                    collapsed && "justify-center px-2",
                    isActive(item.path)
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon className="h-[17px] w-[17px] flex-shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="hidden lg:flex p-3 border-t border-sidebar-border">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center py-2 rounded-lg text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 h-10 w-10 rounded-lg bg-card shadow-md border border-border flex items-center justify-center"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-64" style={{ background: 'linear-gradient(180deg, #0f1c2e 0%, #132038 60%, #0d1a2b 100%)' }}>
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 text-sidebar-foreground/60 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className={cn(
        "hidden lg:flex flex-col border-r border-white/10 transition-all duration-300 flex-shrink-0",
        collapsed ? "w-[68px]" : "w-60"
      )} style={{ background: 'linear-gradient(180deg, #0f1c2e 0%, #132038 60%, #0d1a2b 100%)' }}>
        {sidebarContent}
      </aside>
    </>
  );
}