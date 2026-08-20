import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RefreshCw, MapPin, Building2, Link2, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

// Panel de Sincronización LocationData ↔ Edificio (Executive Suite).
// Muestra KPIs del estado del sector y permite disparar la reconciliación masiva.
export default function SincronizacionPanel() {
  const qc = useQueryClient();
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState(false);
  const [reconcileResult, setReconcileResult] = useState(null);
  const [error, setError] = useState(null);

  const fetchEstado = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('sincronizarUbicaciones', { accion: 'estado' });
      setKpis(res.data?.kpis || res.kpis);
    } catch (err) {
      setError(err.message || 'Error al obtener estado');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEstado(); }, []);

  const handleReconcile = async () => {
    setReconciling(true);
    setError(null);
    setReconcileResult(null);
    try {
      const res = await base44.functions.invoke('sincronizarUbicaciones', { accion: 'reconciliar_sector' });
      setReconcileResult(res.data || res);
      qc.invalidateQueries({ queryKey: ['edificios'] });
      qc.invalidateQueries({ queryKey: ['assets'] });
      fetchEstado();
    } catch (err) {
      setError(err.message || 'Error al reconciliar');
    } finally {
      setReconciling(false);
    }
  };

  const k = kpis || {};
  const huérfanos = (k.locationdata_huerfanos || 0) + (k.edificios_huerfanos || 0);

  return (
    <div className="space-y-5">
      {/* KPI cards — Executive Suite */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={<MapPin className="h-4 w-4" />}
          label="Ubicaciones (Mapa)"
          value={k.locationdata_total}
          borderColor="border-t-blue-500"
          loading={loading}
        />
        <KpiCard
          icon={<Building2 className="h-4 w-4" />}
          label="Edificios (Activos)"
          value={k.edificios_total}
          borderColor="border-t-emerald-500"
          loading={loading}
        />
        <KpiCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Sincronizados"
          value={k.sincronizados}
          borderColor="border-t-amber-400"
          loading={loading}
        />
        <KpiCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Huérfanos"
          value={huérfanos}
          borderColor="border-t-red-500"
          loading={loading}
          highlight={huérfanos > 0}
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Acciones */}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleReconcile} disabled={reconciling || loading}>
          {reconciling ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Reconciliar sector
        </Button>
        <Button variant="outline" onClick={fetchEstado} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Actualizar estado
        </Button>
        <span className="text-xs text-muted-foreground">
          La sincronización automática se dispara al crear/editar ubicaciones o edificios.
        </span>
      </div>

      {/* Log de última reconciliación */}
      {reconcileResult && (
        <Card className="p-4 space-y-3 border-l-4 border-l-primary">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Link2 className="h-4 w-4 text-primary" />
            Resultado de reconciliación
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            <ResumenRow label="Edificios creados" value={reconcileResult.resumen?.edificios_creados} color="text-emerald-600" />
            <ResumenRow label="Vinculados" value={reconcileResult.resumen?.edificios_vinculados} color="text-blue-600" />
            <ResumenRow label="Actualizados" value={reconcileResult.resumen?.edificios_actualizados} color="text-amber-600" />
            <ResumenRow label="Ya sincronizados" value={reconcileResult.resumen?.ya_sincronizados} />
            <ResumenRow label="No resolvibles" value={reconcileResult.resumen?.no_resolvibles} color={reconcileResult.resumen?.no_resolvibles > 0 ? 'text-destructive' : ''} />
          </div>
          {reconcileResult.no_resolvibles?.length > 0 && (
            <div className="text-xs">
              <div className="font-medium text-destructive mb-1">Edificios sin LocationData matching ({reconcileResult.no_resolvibles.length}):</div>
              <div className="max-h-40 overflow-y-auto space-y-0.5 text-muted-foreground">
                {reconcileResult.no_resolvibles.map((nr, i) => (
                  <div key={i}>• {nr.nombre} <span className="text-destructive/70">— {nr.motivo}</span></div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, borderColor, loading, highlight }) {
  return (
    <Card className={`p-4 border-t-[3px] ${borderColor} ${highlight ? 'ring-1 ring-red-500/30' : ''}`}>
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold tabular-nums">
        {loading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : (value ?? 0)}
      </div>
    </Card>
  );
}

function ResumenRow({ label, value, color }) {
  return (
    <div className="rounded bg-muted/40 p-2">
      <div className={`text-lg font-bold tabular-nums ${color || ''}`}>{value ?? 0}</div>
      <div className="text-muted-foreground">{label}</div>
    </div>
  );
}