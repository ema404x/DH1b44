import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import StatsCard from '@/components/shared/StatsCard';
import { TrendingUp } from 'lucide-react';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);
const fmtAxis = (n) => { if (!n) return '$0'; if (Math.abs(n) >= 1_000_000) return `$${(n/1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })}M`; if (Math.abs(n) >= 1_000) return `$${(n/1_000).toLocaleString('es-AR', { maximumFractionDigits: 0 })}K`; return `$${n}`; };

export default function GastoMensualAbonosMensuales() {
  const { data: certificados = [] } = useQuery({ 
    queryKey: ['certificados-abonos'], 
    queryFn: () => base44.entities.Certificado.list() 
  });

  // Filtrar solo certificados de tipo "abono_mensual" que están emitidos o aprobados
  const abonosMensuales = useMemo(() => {
    return certificados.filter(c => c.tipo === 'abono_mensual' && ['emitido', 'aprobado'].includes(c.estado));
  }, [certificados]);

  // Agrupar por mes y calcular gastos
  const gastosPorMes = useMemo(() => {
    const datos = {};
    
    abonosMensuales.forEach(cert => {
      const fecha = cert.fecha_certificado || cert.mes_periodo || new Date().toISOString();
      const mes = new Date(fecha).toLocaleDateString('es-AR', { month: 'short', year: 'numeric' });
      
      const monto = cert.subtotal || 0;
      datos[mes] = (datos[mes] || 0) + monto;
    });

    return Object.entries(datos)
      .sort(([a], [b]) => new Date(a) - new Date(b))
      .map(([mes, total]) => ({ mes, gasto: total }));
  }, [abonosMensuales]);

  // Por contratista
  const gastosPorContratista = useMemo(() => {
    const datos = {};
    
    abonosMensuales.forEach(cert => {
      const contratista = cert.contratista || 'Sin contratista';
      const monto = cert.subtotal || 0;
      datos[contratista] = (datos[contratista] || 0) + monto;
    });

    return Object.entries(datos)
      .map(([nombre, total]) => ({ nombre, total }))
      .sort((a, b) => b.total - a.total);
  }, [abonosMensuales]);

  const totalGastos = gastosPorMes.reduce((sum, item) => sum + item.gasto, 0);
  const promedioMensual = gastosPorMes.length > 0 ? totalGastos / gastosPorMes.length : 0;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard 
          title="Gasto Total de Abonos" 
          value={fmt(totalGastos)} 
          icon={TrendingUp} 
          color="blue"
          subtitle={`${abonosMensuales.length} certificados`}
        />
        <StatsCard 
          title="Promedio Mensual" 
          value={fmt(promedioMensual)} 
          icon={TrendingUp} 
          color="blue"
          subtitle={`${gastosPorMes.length} meses`}
        />
        <StatsCard 
          title="Contratistas" 
          value={gastosPorContratista.length} 
          icon={TrendingUp} 
          color="blue"
          subtitle={`${abonosMensuales.filter(c => c.estado === 'aprobado').length} aprobados`}
        />
      </div>

      {gastosPorMes.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground text-center py-8">No hay certificados de abonos mensuales</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Gráfico de línea - Gastos por mes */}
          <Card>
            <CardHeader>
              <CardTitle>Gasto Mensual</CardTitle>
              <CardDescription>Tendencia de gastos en abonos mensuales</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={gastosPorMes}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={68} />
                  <Tooltip formatter={(v) => [fmt(v), 'Gasto']} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }} />
                  <Legend />
                  <Line type="monotone" dataKey="gasto" stroke="#3B82F6" name="Gasto ($)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Gráfico de barras - Por contratista */}
          <Card>
            <CardHeader>
              <CardTitle>Gasto por Contratista</CardTitle>
              <CardDescription>Top contratistas en abonos mensuales</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={gastosPorContratista}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="nombre" angle={-45} textAnchor="end" height={100} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={68} />
                  <Tooltip formatter={(v) => [fmt(v), 'Gasto']} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }} />
                  <Bar dataKey="total" fill="#06B6D4" name="Gasto ($)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Tabla detallada */}
          <Card>
            <CardHeader>
              <CardTitle>Detalle de Certificados</CardTitle>
              <CardDescription>Lista completa de abonos mensuales emitidos y aprobados</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº Certificado</TableHead>
                      <TableHead>Contratista</TableHead>
                      <TableHead>Obra/Servicio</TableHead>
                      <TableHead>Mes</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {abonosMensuales.map(cert => (
                      <TableRow key={cert.id}>
                        <TableCell className="font-mono text-xs">{cert.numero || '-'}</TableCell>
                        <TableCell className="text-sm">{cert.contratista || '-'}</TableCell>
                        <TableCell className="text-sm max-w-xs truncate">{cert.obra_servicio || '-'}</TableCell>
                        <TableCell className="text-sm">{cert.mes_periodo || '-'}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${cert.estado === 'aprobado' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-blue-500/15 text-blue-400'}`}>
                            {cert.estado === 'aprobado' ? 'Aprobado' : 'Emitido'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{fmt(cert.subtotal)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}