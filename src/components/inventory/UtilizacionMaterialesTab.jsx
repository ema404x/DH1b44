import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Package, AlertTriangle, ChevronDown, ChevronRight, Settings, CheckCircle2
} from 'lucide-react';
import EmptyState from '@/components/shared/EmptyState';
import UsageThresholdConfig from '@/components/inventory/UsageThresholdConfig';

const norm = (s) => (s || '').toLowerCase().trim();

const statusLabels = {
  pendiente: 'Pendiente',
  asignada: 'Asignada',
  en_progreso: 'En progreso',
  obra: 'Obra',
  pendiente_validacion: 'Pendiente validación',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

export default function UtilizacionMaterialesTab() {
  const { employeeSector } = useCurrentUser();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(null);
  const [configOpen, setConfigOpen] = useState(false);

  const { data: workorders = [], isLoading } = useQuery({
    queryKey: ['workorders-usage'],
    queryFn: () => base44.entities.WorkOrder.list('-created_date', 500),
    staleTime: 60000,
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ['material-usage-alerts'],
    queryFn: () => base44.entities.MaterialUsageAlert.list('-created_date'),
    staleTime: 60000,
  });

  // Agregación de materials_used por nombre normalizado.
  const agg = useMemo(() => {
    const map = {};
    for (const ot of workorders) {
      if (!ot.materials_used || !Array.isArray(ot.materials_used)) continue;
      if (ot.status === 'cancelada') continue;
      for (const m of ot.materials_used) {
        const name = (m.material_name || '').trim();
        if (!name) continue;
        const key = norm(name);
        if (!map[key]) map[key] = { key, display: name, total: 0, ots: [] };
        map[key].total += Number(m.quantity) || 0;
        if (map[key].ots.length < 50) {
          map[key].ots.push({
            id: ot.id,
            title: ot.title || 'Sin título',
            quantity: Number(m.quantity) || 0,
            status: ot.status,
            date: ot.created_date,
          });
        }
      }
    }
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [workorders]);

  const alertMap = useMemo(() => {
    const m = {};
    for (const a of alerts) m[norm(a.material_name)] = a;
    return m;
  }, [alerts]);

  const rows = useMemo(
    () => agg.map((a) => {
      const cfg = alertMap[a.key];
      const threshold = cfg?.threshold ?? 0;
      const alerta = !!cfg?.activo && threshold > 0 && a.total >= threshold;
      return { ...a, threshold, alerta, cfg };
    }),
    [agg, alertMap]
  );

  const alertsCount = rows.filter((r) => r.alerta).length;
  const otsConMateriales = workorders.filter(
    (o) => Array.isArray(o.materials_used) && o.materials_used.some((m) => (m.material_name || '').trim()) && o.status !== 'cancelada'
  ).length;

  return (
    <div className="space-y-4">
      {/* Banner de alertas */}
      {alertsCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 p-4 rounded-lg bg-red-500/20 border border-red-500/30 backdrop-blur"
        >
          <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-300">
            <span className="font-semibold">{alertsCount} material{alertsCount > 1 ? 'es' : ''} superó el umbral configurado:</span>{' '}
            {rows.filter((r) => r.alerta).map((r) => r.display).join(', ')}
          </div>
        </motion.div>
      )}

      {/* Stats + config */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="grid grid-cols-3 gap-3 flex-1">
          <MiniStat label="Materiales distintos" value={agg.length} icon={Package} />
          <MiniStat label="OTs con materiales" value={otsConMateriales} icon={CheckCircle2} />
          <MiniStat label="Alertas activas" value={alertsCount} icon={AlertTriangle} highlight={alertsCount > 0} />
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 border-slate-700/50 text-slate-200" onClick={() => setConfigOpen(true)}>
          <Settings className="h-4 w-4" /> Configurar alertas
        </Button>
      </div>

      {agg.length === 0 && !isLoading ? (
        <EmptyState
          icon={Package}
          title="Sin utilización registrada"
          description="Cuando crees OTs con materiales (ej: 4 cerraduras), el conteo aparecerá acá."
        />
      ) : (
        <Card className="border-0 bg-slate-800/50 backdrop-blur overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700/50">
                  <TableHead className="w-8"></TableHead>
                  <TableHead className="text-slate-300">Material</TableHead>
                  <TableHead className="text-right text-slate-300">Total usado</TableHead>
                  <TableHead className="text-right text-slate-300">Umbral</TableHead>
                  <TableHead className="text-slate-300">Estado</TableHead>
                  <TableHead className="text-right text-slate-300">OTs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <React.Fragment key={r.key}>
                    <TableRow
                      className={`border-slate-700/50 hover:bg-slate-700/20 transition-colors cursor-pointer ${r.alerta ? 'bg-red-500/5' : ''}`}
                      onClick={() => setExpanded(expanded === r.key ? null : r.key)}
                    >
                      <TableCell className="text-slate-400">
                        {expanded === r.key ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </TableCell>
                      <TableCell className="font-medium text-white">{r.display}</TableCell>
                      <TableCell className="text-right text-white font-semibold tabular-nums">{r.total}</TableCell>
                      <TableCell className="text-right text-slate-400 tabular-nums">
                        {r.threshold > 0 ? r.threshold : '—'}
                      </TableCell>
                      <TableCell>
                        {r.alerta ? (
                          <Badge className="bg-red-500/20 text-red-300 border-red-500/40 gap-1">
                            <AlertTriangle className="h-3 w-3" /> Superó umbral
                          </Badge>
                        ) : r.threshold > 0 ? (
                          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 gap-1">
                            <CheckCircle2 className="h-3 w-3" /> OK
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-slate-700 text-slate-300">Sin umbral</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-slate-400 tabular-nums">{r.ots.length}</TableCell>
                    </TableRow>
                    {expanded === r.key && (
                      <TableRow className="border-slate-700/50 bg-slate-900/40">
                        <TableCell colSpan={6} className="p-4">
                          <div className="space-y-1.5">
                            <p className="text-xs text-slate-400 uppercase font-medium mb-2">
                              OTs que usan «{r.display}» ({r.ots.length})
                            </p>
                            {r.ots.map((o) => (
                              <div key={o.id} className="flex items-center justify-between gap-3 py-1.5 px-2 rounded-md hover:bg-slate-800/50">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm text-white truncate">{o.title}</p>
                                  <p className="text-[11px] text-slate-500">
                                    {statusLabels[o.status] || o.status} · {o.date ? new Date(o.date).toLocaleDateString('es-AR') : ''}
                                  </p>
                                </div>
                                <span className="text-sm font-semibold text-emerald-400 tabular-nums shrink-0">
                                  {o.quantity} ud.
                                </span>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {configOpen && (
        <UsageThresholdConfig
          sectorId={employeeSector}
          usedNames={agg.map((a) => a.display)}
          onClose={() => setConfigOpen(false)}
        />
      )}
    </div>
  );
}

function MiniStat({ label, value, icon: Icon, highlight }) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        highlight ? 'border-red-500/40 bg-red-500/10' : 'border-slate-700/50 bg-slate-800/40'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] text-slate-400 uppercase">{label}</p>
        <Icon className={`h-3.5 w-3.5 ${highlight ? 'text-red-400' : 'text-slate-400'}`} />
      </div>
      <p className="text-xl font-bold text-white tabular-nums">{value}</p>
    </div>
  );
}