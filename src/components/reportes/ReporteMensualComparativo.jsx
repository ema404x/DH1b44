import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { DollarSign, TrendingUp, CheckCircle2, AlertCircle } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

export default function ReporteMensualComparativo() {
  const [mesSeleccionado, setMesSeleccionado] = useState(format(new Date(), 'yyyy-MM'));

  const { data: certificados = [] } = useQuery({
    queryKey: ['certificados-list'],
    queryFn: () => base44.entities.Certificado.list('-fecha_certificado', 500),
  });

  const { data: facturas = [] } = useQuery({
    queryKey: ['invoices-list'],
    queryFn: () => base44.entities.Invoice.list('-issue_date', 500),
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras-certificacion-reportes'],
    queryFn: () => base44.entities.ObraCertificacion.list('-created_date', 500),
  });

  // Obtener certificados aprobados del mes
  const certificadosMes = useMemo(() => {
    return certificados.filter(c => {
      if (!c.fecha_certificado || c.estado !== 'aprobado') return false;
      const mes = format(new Date(c.fecha_certificado), 'yyyy-MM');
      return mes === mesSeleccionado;
    });
  }, [certificados, mesSeleccionado]);

  // Obtener facturas del mes
  const facturasMes = useMemo(() => {
    return facturas.filter(f => {
      if (!f.issue_date) return false;
      const mes = format(new Date(f.issue_date), 'yyyy-MM');
      return mes === mesSeleccionado;
    });
  }, [facturas, mesSeleccionado]);

  // Agrupar por proyecto/obra
  const reportePorObra = useMemo(() => {
    const map = new Map();

    // Agregar certificados
    certificadosMes.forEach(cert => {
      const key = cert.obra_servicio || cert.ada_numero || 'Sin especificar';
      if (!map.has(key)) {
        map.set(key, {
          obra: key,
          monto_certificado: 0,
          monto_facturado: 0,
          certificados_qty: 0,
          facturas_qty: 0,
          estado_cobro: 'pendiente',
          avance: 0,
        });
      }
      const item = map.get(key);
      item.monto_certificado += cert.subtotal || 0;
      item.certificados_qty += 1;
    });

    // Agregar facturas
    facturasMes.forEach(fac => {
      const key = fac.project_name || 'Sin especificar';
      if (!map.has(key)) {
        map.set(key, {
          obra: key,
          monto_certificado: 0,
          monto_facturado: 0,
          certificados_qty: 0,
          facturas_qty: 0,
          estado_cobro: 'pendiente',
          avance: 0,
        });
      }
      const item = map.get(key);
      item.monto_facturado += fac.total || 0;
      item.facturas_qty += 1;
    });

    // Enriquecer con datos de obras
    obras.forEach(obra => {
      const key = obra.titulo;
      if (map.has(key)) {
        const item = map.get(key);
        item.estado_cobro = obra.estado_cobro;
        item.avance = obra.porcentaje_avance || 0;
      }
    });

    return Array.from(map.values());
  }, [certificadosMes, facturasMes, obras]);

  // Resumen general del mes
  const resumen = useMemo(() => {
    const totalCertificado = reportePorObra.reduce((s, r) => s + r.monto_certificado, 0);
    const totalFacturado = reportePorObra.reduce((s, r) => s + r.monto_facturado, 0);
    const diferencia = totalCertificado - totalFacturado;
    
    return {
      totalCertificado,
      totalFacturado,
      diferencia,
      obrasConDiferencia: reportePorObra.filter(r => r.monto_certificado !== r.monto_facturado).length,
    };
  }, [reportePorObra]);

  // Generar meses disponibles (últimos 12 meses)
  const mesesDisponibles = useMemo(() => {
    const meses = [];
    for (let i = 11; i >= 0; i--) {
      const fecha = subMonths(new Date(), i);
      const valor = format(fecha, 'yyyy-MM');
      const label = format(fecha, 'MMMM yyyy', { locale: es });
      meses.push({ valor, label: label.charAt(0).toUpperCase() + label.slice(1) });
    }
    return meses;
  }, []);

  const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);
  const fmtAxis = (n) => { if (!n) return '$0'; if (Math.abs(n) >= 1_000_000) return `$${(n/1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })}M`; if (Math.abs(n) >= 1_000) return `$${(n/1_000).toLocaleString('es-AR', { maximumFractionDigits: 0 })}K`; return `$${n}`; };

  const estadoConfig = {
    listo_certificar: { label: 'Listo', color: 'bg-emerald-500/15 text-emerald-400' },
    pendiente: { label: 'Pendiente', color: 'bg-red-500/15 text-red-400' },
    observado: { label: 'Observado', color: 'bg-slate-500/15 text-slate-400' },
    faltan_actas: { label: 'Faltan actas', color: 'bg-yellow-500/15 text-yellow-400' },
  };

  return (
    <div className="space-y-6">
      {/* Selector de mes */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-foreground">Período:</span>
        <Select value={mesSeleccionado} onValueChange={setMesSeleccionado}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {mesesDisponibles.map(m => (
              <SelectItem key={m.valor} value={m.valor}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span className="text-xs text-muted-foreground">Total Certificado</span>
            </div>
            <p className="text-xl font-bold text-emerald-400">{fmt(resumen.totalCertificado)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{certificadosMes.length} certificados</p>
          </CardContent>
        </Card>

        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-blue-400" />
              <span className="text-xs text-muted-foreground">Total Facturado</span>
            </div>
            <p className="text-xl font-bold text-blue-400">{fmt(resumen.totalFacturado)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{facturasMes.length} facturas</p>
          </CardContent>
        </Card>

        <Card className={`border-amber-500/20 ${resumen.diferencia >= 0 ? 'bg-emerald-500/5' : 'bg-red-500/5'}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4" style={{ color: resumen.diferencia >= 0 ? '#4ade80' : '#ef4444' }} />
              <span className="text-xs text-muted-foreground">Diferencia</span>
            </div>
            <p className={`text-xl font-bold ${resumen.diferencia >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {fmt(Math.abs(resumen.diferencia))}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {resumen.diferencia > 0 ? 'Certificación adelantada' : resumen.diferencia < 0 ? 'Facturación adelantada' : 'Balanceado'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-purple-500/20 bg-purple-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-purple-400" />
              <span className="text-xs text-muted-foreground">Obras con Diferencia</span>
            </div>
            <p className="text-xl font-bold text-purple-400">{resumen.obrasConDiferencia}</p>
            <p className="text-[10px] text-muted-foreground mt-1">de {reportePorObra.length} obras</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla detallada */}
      {reportePorObra.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Detalle por Obra/Proyecto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[640px]">
                <thead className="bg-muted/30 border-b border-border/50">
                  <tr>
                    <th className="text-left py-2.5 px-3 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">Obra / Proyecto</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground w-36">Certificado</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground w-36">Facturado</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground w-36">Diferencia</th>
                    <th className="text-center py-2.5 px-3 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground w-20">Comp.</th>
                    <th className="text-center py-2.5 px-3 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground w-28">Estado</th>
                    <th className="text-center py-2.5 px-3 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground w-20">Avance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {reportePorObra.map((row, idx) => {
                    const diff = row.monto_certificado - row.monto_facturado;
                    const compliance = row.monto_certificado > 0 ? Math.round((row.monto_facturado / row.monto_certificado) * 100) : 0;
                    const config = estadoConfig[row.estado_cobro] || estadoConfig.pendiente;
                    
                    return (
                      <tr key={idx} className={`hover:bg-accent/20 transition-colors ${idx % 2 !== 0 ? 'bg-muted/10' : ''}`}>
                        <td className="py-3 px-3 font-medium max-w-xs">
                          <span className="truncate block" title={row.obra}>{row.obra}</span>
                        </td>
                        <td className="text-right py-3 px-3 font-semibold text-emerald-400 tabular-nums whitespace-nowrap">{fmt(row.monto_certificado)}</td>
                        <td className="text-right py-3 px-3 font-semibold text-blue-400 tabular-nums whitespace-nowrap">{fmt(row.monto_facturado)}</td>
                        <td className={`text-right py-3 px-3 font-semibold tabular-nums whitespace-nowrap ${diff >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {diff < 0 && <span className="mr-0.5">-</span>}{fmt(Math.abs(diff))}
                        </td>
                        <td className="text-center py-3 px-3 tabular-nums">
                          <span className={`text-xs font-bold ${compliance >= 100 ? 'text-emerald-400' : compliance >= 75 ? 'text-blue-400' : 'text-amber-400'}`}>
                            {compliance}%
                          </span>
                        </td>
                        <td className="text-center py-3 px-3">
                          <Badge className={`text-[9px] whitespace-nowrap ${config.color}`}>{config.label}</Badge>
                        </td>
                        <td className="text-center py-3 px-3 tabular-nums">
                          <span className="text-xs font-medium text-muted-foreground">{row.avance}%</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gráfico comparativo */}
      {reportePorObra.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Comparativa: Certificación vs Facturación</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={reportePorObra.slice(0, 10)} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="obra" 
                  angle={-45} 
                  textAnchor="end" 
                  height={80}
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  width={72}
                  tickFormatter={fmtAxis}
                />
                <Tooltip 
                  formatter={(v) => fmt(v)}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                  cursor={{ fill: 'hsl(var(--muted) / 0.1)' }}
                />
                <Legend />
                <Bar dataKey="monto_certificado" fill="#4ade80" name="Certificado" radius={[4, 4, 0, 0]} />
                <Bar dataKey="monto_facturado" fill="#60a5fa" name="Facturado" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {reportePorObra.length === 0 && (
        <Card className="text-center py-8">
          <div className="text-muted-foreground">
            <p>No hay datos para el período seleccionado</p>
          </div>
        </Card>
      )}
    </div>
  );
}