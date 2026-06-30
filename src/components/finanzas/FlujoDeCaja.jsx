import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { fmt, fmtM, ChartTip } from '@/components/reportes/shared';
import { FileCheck, Clock, RefreshCw } from 'lucide-react';

export default function FlujoDeCaja({ certificados, obras, abonos }) {
  const [periodo, setPeriodo] = useState('12');

  // ── Flujo mensual de certificaciones ────────────────────────────────────
  // Agrupar por mes_periodo (formato "2026-06")
  const monthlyData = useMemo(() => {
    const months = [];
    const now = new Date();
    const count = parseInt(periodo);
    for (let i = count - 1; i >= 0; i--) {
      const d = subMonths(now, i);
      const key = format(d, 'yyyy-MM');
      months.push({ key, label: format(d, 'MMM yy', { locale: es }) });
    }

    return months.map(m => {
      const delMes = certificados.filter(c => c.mes_periodo === m.key);
      const emitido = delMes
        .filter(c => c.estado === 'emitido' || c.estado === 'aprobado')
        .reduce((s, c) => s + (c.subtotal || 0), 0);
      const borrador = delMes
        .filter(c => c.estado === 'borrador')
        .reduce((s, c) => s + (c.subtotal || 0), 0);
      return { mes: m.label, emitido, borrador, total: emitido + borrador };
    });
  }, [certificados, periodo]);

  // Acumulado
  let acumulado = 0;
  const acumuladoData = monthlyData.map(d => {
    acumulado += d.emitido;
    return { ...d, acumulado };
  });

  // ── Pipeline de obras listas para certificar ────────────────────────────
  const pipelineObras = useMemo(() =>
    obras
      .filter(o => o.estado_cobro === 'listo_certificar')
      .sort((a, b) => (b.monto_a_cobrar || 0) - (a.monto_a_cobrar || 0))
      .slice(0, 10)
  , [obras]);

  const totalPipeline = pipelineObras.reduce((s, o) => s + (o.monto_a_cobrar || 0), 0);

  // ── Abonos: próximo mes ──────────────────────────────────────────────────
  const abonosActivos = abonos.filter(a => a.estado === 'activo');
  const ingresoRecurrente = abonosActivos.reduce((s, a) => s + (a.monto_mensual || 0), 0);

  return (
    <div className="space-y-6">

      {/* ── Gráfico de certificaciones mensuales ─────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Flujo de Certificaciones</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Emitido vs. en borrador por mes</p>
            </div>
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="6">Últimos 6 meses</SelectItem>
                <SelectItem value="12">Últimos 12 meses</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={acumuladoData}>
                <defs>
                  <linearGradient id="gradEmit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradAcum" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtM} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={50} />
                <Tooltip content={<ChartTip />} />
                <Area type="monotone" dataKey="emitido" name="Certificado Emitido" stroke="hsl(var(--chart-2))" fill="url(#gradEmit)" strokeWidth={2} />
                <Area type="monotone" dataKey="acumulado" name="Acumulado" stroke="hsl(var(--chart-1))" fill="url(#gradAcum)" strokeWidth={2} strokeDasharray="5 5" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-6 mt-3 text-xs text-muted-foreground justify-end">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" /> Emitido mensual</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary inline-block" /> Acumulado</span>
          </div>
        </CardContent>
      </Card>

      {/* ── Resumen de ingresos recurrentes ─────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
              <RefreshCw className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ingreso Recurrente Mensual</p>
              <p className="text-lg font-bold tabular-nums">{fmt(ingresoRecurrente)}</p>
              <p className="text-[10px] text-muted-foreground">{abonosActivos.length} contratos de abono activos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
              <FileCheck className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pipeline Inmediato</p>
              <p className="text-lg font-bold tabular-nums">{fmt(totalPipeline)}</p>
              <p className="text-[10px] text-muted-foreground">{pipelineObras.length} obras listas para certificar</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Tabla: obras listas para certificar ─────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-400" />
              Obras Listas para Certificar
            </CardTitle>
            <span className="text-sm font-semibold text-emerald-400">{fmt(totalPipeline)}</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Obra</TableHead>
                  <TableHead className="hidden md:table-cell">Establecimiento</TableHead>
                  <TableHead className="hidden md:table-cell">Comuna</TableHead>
                  <TableHead className="text-right">Monto a Cobrar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pipelineObras.map(o => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium text-sm max-w-[250px] truncate" title={o.titulo}>{o.titulo}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{o.establecimiento || '—'}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{o.comuna || '—'}</TableCell>
                    <TableCell className="text-right font-bold tabular-nums">{fmt(o.monto_a_cobrar)}</TableCell>
                  </TableRow>
                ))}
                {pipelineObras.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No hay obras listas para certificar</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}