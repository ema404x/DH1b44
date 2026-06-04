import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, AlertCircle } from 'lucide-react';
import StatsCard from '@/components/shared/StatsCard';

export default function DashboardFinanciero() {
  const { data: invoices = [] } = useQuery({ queryKey: ['invoices'], queryFn: () => base44.entities.Invoice.list() });
  const { data: certificates = [] } = useQuery({ queryKey: ['certificados'], queryFn: () => base44.entities.Certificado.list() });
  const { data: obrasData = [] } = useQuery({ queryKey: ['obrasCertificacion'], queryFn: () => base44.entities.ObraCertificacion.list() });

  // Cálculos financieros
  const totalIngresos = obrasData.reduce((sum, obra) => sum + (obra.monto_contrato || 0), 0);
  const totalGastos = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const flujoNeto = totalIngresos - totalGastos;
  
  const invoicesByStatus = {
    pendiente: invoices.filter(i => i.status === 'pendiente').reduce((s, i) => s + (i.total || 0), 0),
    pagada: invoices.filter(i => i.status === 'pagada').reduce((s, i) => s + (i.total || 0), 0),
    vencida: invoices.filter(i => i.status === 'vencida').reduce((s, i) => s + (i.total || 0), 0),
  };

  // Datos por mes para gráfico de línea
  const monthlyData = {};
  invoices.forEach(inv => {
    const month = inv.issue_date ? new Date(inv.issue_date).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }) : 'N/A';
    monthlyData[month] = (monthlyData[month] || 0) + (inv.total || 0);
  });
  const monthlyChartData = Object.entries(monthlyData).map(([month, total]) => ({ month, gastos: total }));

  // Datos por proyecto
  const projectData = {};
  invoices.forEach(inv => {
    const project = inv.project_name || 'Sin proyecto';
    projectData[project] = (projectData[project] || 0) + (inv.total || 0);
  });
  const projectChartData = Object.entries(projectData).slice(0, 8).map(([name, value]) => ({ name, value }));

  // Estado de facturas (pie chart)
  const pieData = [
    { name: 'Pendiente', value: invoicesByStatus.pendiente },
    { name: 'Pagada', value: invoicesByStatus.pagada },
    { name: 'Vencida', value: invoicesByStatus.vencida }
  ];
  const colors = ['#F59E0B', '#10B981', '#EF4444'];

  return (
    <div className="space-y-6">
      {/* KPIs principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard 
          title="Ingresos Totales" 
          value={`$${totalIngresos.toLocaleString()}`} 
          icon={TrendingUp} 
          color="green"
          subtitle={`${obrasData.length} obras`}
        />
        <StatsCard 
          title="Gastos Totales" 
          value={`$${totalGastos.toLocaleString()}`} 
          icon={TrendingDown} 
          color="red"
          subtitle={`${invoices.length} facturas`}
        />
        <StatsCard 
          title="Flujo Neto" 
          value={`$${flujoNeto.toLocaleString()}`} 
          icon={DollarSign} 
          color={flujoNeto >= 0 ? "green" : "red"}
          subtitle={flujoNeto >= 0 ? "Ganancia neta" : "Pérdida neta"}
        />
        <StatsCard 
          title="Pendiente Cobro" 
          value={`$${invoicesByStatus.pendiente.toLocaleString()}`} 
          icon={AlertCircle} 
          color="amber"
          subtitle={`${invoices.filter(i => i.status === 'pendiente').length} facturas`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico de línea - Gastos por mes */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Gastos por Mes</CardTitle>
            <CardDescription>Tendencia de gastos en los últimos meses</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                <Legend />
                <Line type="monotone" dataKey="gastos" stroke="#EF4444" name="Gastos ($)" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Pie chart - Estado de facturas */}
        <Card>
          <CardHeader>
            <CardTitle>Estado de Facturas</CardTitle>
            <CardDescription>Distribución por estado</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value">
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de barras - Gastos por proyecto */}
      <Card>
        <CardHeader>
          <CardTitle>Gastos por Proyecto/Cliente</CardTitle>
          <CardDescription>Top {Math.min(8, projectChartData.length)} proyectos con mayor gasto</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={projectChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
              <Bar dataKey="value" fill="#3B82F6" name="Gastos ($)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}