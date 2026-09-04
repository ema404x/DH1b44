import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity, Trash2, RefreshCw } from 'lucide-react';

const MODULE_LABELS = {
  '/': 'Dashboard',
  '/ordenes': 'Órdenes de Trabajo',
  '/proyectos': 'Proyectos',
  '/activos': 'Activos',
  '/empleados': 'Empleados',
  '/inventario': 'Inventario',
  '/facturacion': 'Facturación',
  '/finanzas': 'Finanzas',
  '/certificados': 'Certificados',
  '/reportes': 'Reportes',
  '/rutinas': 'Rutinas',
  '/calefaccion': 'Calefacción',
  '/foro': 'Foro',
  '/informacion-general': 'Información General',
};

const percentile = (arr, p) => {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
};

const readModule = (key) => {
  try {
    return JSON.parse(window.localStorage.getItem(key) || '[]');
  } catch (_) {
    return [];
  }
};

/**
 * Panel de observabilidad de tiempos de carga por módulo.
 * Lee del ring buffer local (últimas 50 mediciones por módulo) que escribe useLoadTelemetry.
 * Muestra P50/P95/máximo y distribución. Read-only — no escribe datos.
 */
export default function TelemetriaCargaPanel() {
  const [data, setData] = useState({});
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const collect = () => {
      const out = {};
      Object.keys(window.localStorage).forEach((k) => {
        if (k.startsWith('base44_loadtm_')) {
          const mod = k.replace('base44_loadtm_', '');
          out[mod] = readModule(k);
        }
      });
      setData(out);
    };
    collect();
    const interval = setInterval(collect, 5000);
    return () => clearInterval(interval);
  }, [tick]);

  const refresh = () => setTick((t) => t + 1);

  const clearAll = () => {
    Object.keys(window.localStorage).forEach((k) => {
      if (k.startsWith('base44_loadtm_')) window.localStorage.removeItem(k);
    });
    refresh();
  };

  const entries = Object.entries(data).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-green-600" />
          <h3 className="font-bold">Telemetría de Carga por Módulo</h3>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
          <Button variant="outline" size="sm" onClick={clearAll} className="gap-2 text-destructive">
            <Trash2 className="h-4 w-4" />
            Limpiar
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Mediciones de tiempo de carga (ms) desde el mount hasta estabilización del contenido.
        Datos locales de este navegador — últimas 50 mediciones por módulo. Para agregación
        cross-usuario, consultá el dashboard de Analytics de la plataforma.
      </p>

      {entries.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Sin mediciones aún. Navegá los módulos para empezar a registrar tiempos de carga.
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map(([mod, samples]) => {
            const times = samples.map((s) => s.ms);
            const p50 = percentile(times, 50);
            const p95 = percentile(times, 95);
            const max = Math.max(...times);
            const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
            const label = MODULE_LABELS[mod] || mod;
            const tone = p95 > 5000 ? 'text-red-600' : p95 > 2500 ? 'text-amber-600' : 'text-green-600';
            return (
              <div key={mod} className="p-3 border border-border rounded-md">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{label}</span>
                  <span className="text-xs text-muted-foreground">{samples.length} mediciones</span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-2 bg-muted/40 rounded">
                    <p className="text-xs text-muted-foreground">P50</p>
                    <p className="font-mono font-semibold text-sm">{p50} ms</p>
                  </div>
                  <div className="p-2 bg-muted/40 rounded">
                    <p className="text-xs text-muted-foreground">P95</p>
                    <p className={`font-mono font-semibold text-sm ${tone}`}>{p95} ms</p>
                  </div>
                  <div className="p-2 bg-muted/40 rounded">
                    <p className="text-xs text-muted-foreground">Prom</p>
                    <p className="font-mono font-semibold text-sm">{avg} ms</p>
                  </div>
                  <div className="p-2 bg-muted/40 rounded">
                    <p className="text-xs text-muted-foreground">Máx</p>
                    <p className="font-mono font-semibold text-sm">{max} ms</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}