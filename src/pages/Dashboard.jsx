import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { FolderKanban, ClipboardList, Users, DollarSign, AlertTriangle, TrendingUp } from 'lucide-react';
import StatsCard from '@/components/shared/StatsCard';
import RecentProjects from '@/components/dashboard/RecentProjects';
import RecentWorkOrders from '@/components/dashboard/RecentWorkOrders';
import RevenueChart from '@/components/dashboard/RevenueChart';
import LowStockAlert from '@/components/dashboard/LowStockAlert';

export default function Dashboard() {
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => base44.entities.Project.list() });
  const { data: orders = [] } = useQuery({ queryKey: ['workorders'], queryFn: () => base44.entities.WorkOrder.list() });
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list() });
  const { data: invoices = [] } = useQuery({ queryKey: ['invoices'], queryFn: () => base44.entities.Invoice.list() });
  const { data: materials = [] } = useQuery({ queryKey: ['materials'], queryFn: () => base44.entities.Material.list() });

  const activeProjects = projects.filter(p => p.status === 'en_progreso').length;
  const pendingOrders = orders.filter(o => ['pendiente', 'asignada'].includes(o.status)).length;
  const activeClients = clients.filter(c => c.status === 'activo').length;
  const totalRevenue = invoices.filter(i => i.status === 'pagada').reduce((sum, i) => sum + (i.total || 0), 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Resumen general de operaciones</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Proyectos Activos" value={activeProjects} icon={FolderKanban} color="primary" subtitle={`${projects.length} total`} />
        <StatsCard title="OT Pendientes" value={pendingOrders} icon={ClipboardList} color="amber" subtitle={`${orders.length} total`} />
        <StatsCard title="Clientes Activos" value={activeClients} icon={Users} color="blue" />
        <StatsCard title="Facturado (cobrado)" value={`$${totalRevenue.toLocaleString()}`} icon={DollarSign} color="green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RevenueChart invoices={invoices} />
        </div>
        <div className="space-y-6">
          <LowStockAlert materials={materials} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentProjects projects={projects.filter(p => ['en_progreso', 'pendiente'].includes(p.status))} />
        <RecentWorkOrders orders={orders} />
      </div>
    </div>
  );
}