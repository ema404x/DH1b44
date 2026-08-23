import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertTriangle, FilePlus, RefreshCw, Building2, Download, ArrowLeft, ArrowRight } from 'lucide-react';

const STATUS_BADGE = {
  crear: { label: 'Crear', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  actualizar: { label: 'Actualizar', cls: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30' },
  sede_nueva: { label: 'Sede nueva', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  error: { label: 'Error', cls: 'bg-red-500/15 text-red-400 border-red-500/30' },
  duplicado_archivo: { label: 'Dup. archivo', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
};

const TYPE_LABEL = {
  equipo_electrico: 'Eléctrico', equipo_mecanico: 'Mecánico', instalacion_hvac: 'HVAC',
  instalacion_sanitaria: 'Sanitario', estructura: 'Estructura', vehiculo: 'Vehículo',
  herramienta: 'Herramienta', sistemas_informaticos: 'Informático', mobiliario: 'Mobiliario',
  seguridad: 'Seguridad', otro: 'Otro',
};

// Paso 2: vista previa validada (dry-run). Tabla de filas + resumen + descarga de errores.
export default function PasoPreview({ preview, autoCreateLocations, onVolver, onConfirmar, error }) {
  if (!preview) return null;
  const rows = preview.preview_rows || [];
  const counts = preview.counts || {};
  const errores = preview.errores || [];
  const sedesCrear = preview.sedes_a_crear || [];
  const total = preview.total_filas || 0;
  const puedeConfirmar = (counts.error || 0) < total; // si todo es error, no tiene sentido

  const descargarErrores = () => {
    const header = 'Fila,Nombre,Codigo,Sede,Motivo\n';
    const body = errores.map(e => {
      const r = rows.find(x => x.fila === e.fila);
      const esc = (s) => `"${String(s || '').replace(/"/g, '""')}"`;
      return [e.fila, r?.name || '', r?.code || '', r?.sede || '', e.motivo].map(esc).join(',');
    }).join('\n');
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'filas_con_error.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 overflow-y-auto pr-1">
      {/* Resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <StatCard icon={FilePlus} label="Total" value={total} color="text-slate-300" />
        <StatCard icon={CheckCircle2} label="A crear" value={counts.crear || 0} color="text-blue-400" />
        <StatCard icon={RefreshCw} label="A actualizar" value={counts.actualizar || 0} color="text-indigo-400" />
        <StatCard icon={Building2} label="Sedes nuevas" value={(counts.sede_nueva || 0)} color="text-emerald-400" />
        <StatCard icon={AlertTriangle} label="Con error" value={counts.error || 0} color="text-red-400" />
      </div>

      {/* Sedes a crear */}
      {sedesCrear.length > 0 && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 mb-2">
            <Building2 className="h-4 w-4" /> Sedes que se crearán ({sedesCrear.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sedesCrear.slice(0, 12).map((s, i) => (
              <span key={i} className="text-xs px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                {s.nombre}{s.comuna ? ` · ${s.comuna}` : ''}
              </span>
            ))}
            {sedesCrear.length > 12 && <span className="text-xs text-muted-foreground self-center">+{sedesCrear.length - 12} más</span>}
          </div>
        </div>
      )}

      {/* Tabla preview */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="max-h-72 overflow-y-auto main-scroll">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/50 text-muted-foreground">
              <tr className="text-left">
                <th className="px-2 py-2 font-medium">#</th>
                <th className="px-2 py-2 font-medium">Activo</th>
                <th className="px-2 py-2 font-medium hidden sm:table-cell">Código</th>
                <th className="px-2 py-2 font-medium hidden md:table-cell">Sede</th>
                <th className="px-2 py-2 font-medium">Estado</th>
                <th className="px-2 py-2 font-medium hidden lg:table-cell">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const badge = STATUS_BADGE[r.status] || STATUS_BADGE.crear;
                return (
                  <tr key={r.fila} className="border-t border-border/50">
                    <td className="px-2 py-1.5 text-muted-foreground tabular-nums">{r.fila}</td>
                    <td className="px-2 py-1.5 max-w-[160px] truncate">{r.name}</td>
                    <td className="px-2 py-1.5 hidden sm:table-cell tabular-nums">{r.code || '—'}</td>
                    <td className="px-2 py-1.5 hidden md:table-cell max-w-[120px] truncate">{r.sede || '—'}</td>
                    <td className="px-2 py-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${badge.cls}`}>{badge.label}</span>
                    </td>
                    <td className="px-2 py-1.5 hidden lg:table-cell text-muted-foreground max-w-[180px] truncate">{r.motivo || ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {total > rows.length && (
          <div className="px-3 py-1.5 text-[11px] text-muted-foreground bg-muted/20 border-t border-border">
            Mostrando {rows.length} de {total} filas
          </div>
        )}
      </div>

      {errores.length > 0 && (
        <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-500/10 p-2.5 rounded-md">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p>{errores.length} fila(s) con error. Podés confirmar igual (se omiten) o corregir el archivo y volver a analizar.</p>
            <button onClick={descargarErrores} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:underline">
              <Download className="h-3 w-3" /> Descargar filas con error (CSV)
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 p-2.5 rounded-md">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex justify-between pt-1">
        <Button variant="outline" onClick={onVolver}>
          <ArrowLeft className="h-4 w-4" /> Volver
        </Button>
        <Button onClick={onConfirmar} disabled={!puedeConfirmar}>
          Confirmar importación <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="rounded-lg border border-border bg-background/60 p-2.5 text-center">
      <Icon className={`h-4 w-4 mx-auto mb-1 ${color}`} />
      <div className="text-lg font-bold tabular-nums">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}