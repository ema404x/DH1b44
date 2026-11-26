import React from 'react';
import { Columns3, FileSpreadsheet, MapPin, FileText, AlertTriangle } from 'lucide-react';

const CAMPOS = {
  sede: 'Sede', code: 'Código', name: 'Nombre', type: 'Tipo', brand: 'Marca', model: 'Modelo',
  serial_number: 'N° serie', area: 'Área', jefe_sitio: 'Jefe de sitio', comuna: 'Comuna',
  status: 'Estado', criticality: 'Criticidad', location: 'Ubicación detallada',
  purchase_cost: 'Costo', purchase_date: 'Fecha compra', warranty_expiry: 'Garantía',
  last_maintenance: 'Últ. mantenimiento', next_maintenance: 'Próx. mantenimiento',
  maintenance_frequency_days: 'Frecuencia', notes: 'Notas',
};

function Bloque({ icon: Icon, titulo, children }) {
  return (
    <div className="rounded-lg border border-border p-3 text-xs">
      <div className="flex items-center gap-2 font-medium mb-2"><Icon className="h-3.5 w-3.5 text-muted-foreground" />{titulo}</div>
      {children}
    </div>
  );
}

// Detalle de la vista previa: columnas detectadas, hojas leídas, activos por sede,
// y (PDF) cuántos activos salieron de cada archivo.
export default function PreviewDetalle({ preview, esPdf }) {
  const columnas = Object.entries(preview.columnas_detectadas || {});
  const hojas = preview.hojas || [];
  const omitidas = preview.hojas_omitidas || [];
  const porSede = preview.resumen_por_sede || [];
  const fileStats = preview.fileStats || [];
  const fileErrors = preview.fileErrors || [];
  const sinSede = !esPdf && !preview.sede_elegida && columnas.length > 0 && !preview.columnas_detectadas?.sede;

  return (
    <div className="space-y-3">
      {esPdf && (
        <Bloque icon={FileText} titulo="Activos extraídos por archivo">
          <ul className="space-y-1">
            {fileStats.map((f, i) => (
              <li key={i} className="flex justify-between gap-2"><span className="truncate">{f.fileName}</span><span className="tabular-nums font-semibold">{f.extraidos}</span></li>
            ))}
            {fileErrors.map((f, i) => (
              <li key={`e${i}`} className="text-destructive">{f.fileName}: {f.error}</li>
            ))}
          </ul>
          <p className="mt-2 text-amber-500 font-medium">Revisá que la cantidad coincida con tu PDF.</p>
        </Bloque>
      )}

      {!esPdf && columnas.length > 0 && (
        <Bloque icon={Columns3} titulo="Columnas detectadas (campo → encabezado del archivo)">
          <div className="flex flex-wrap gap-1.5">
            {columnas.map(([k, h]) => (
              <span key={k} className="px-2 py-0.5 rounded-md border border-border bg-muted/30">
                <span className="text-muted-foreground">{CAMPOS[k] || k}</span> → <strong>{h}</strong>
              </span>
            ))}
          </div>
          {sinSede && (
            <p className="mt-2 flex items-center gap-1.5 text-amber-500"><AlertTriangle className="h-3.5 w-3.5" />No se detectó columna de sede: se usa el nombre de la hoja o Sede Central.</p>
          )}
        </Bloque>
      )}

      {!esPdf && hojas.length > 0 && (
        <Bloque icon={FileSpreadsheet} titulo={`Hojas leídas (${hojas.length})`}>
          <ul className="space-y-1">
            {hojas.map((h, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="truncate">{h.archivo} · {h.hoja}</span>
                <span className="shrink-0 text-muted-foreground"><strong className="tabular-nums text-foreground">{h.filas}</strong> filas · sede: {h.sede_por_defecto}</span>
              </li>
            ))}
          </ul>
          {omitidas.length > 0 && (
            <p className="mt-2 text-muted-foreground">Omitidas: {omitidas.map(o => `${o.hoja} (${o.motivo})`).join(', ')}</p>
          )}
        </Bloque>
      )}

      {porSede.length > 0 && (
        <Bloque icon={MapPin} titulo={`Activos por sede (${porSede.length})`}>
          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
            {porSede.map(s => (
              <span key={s.sede} className="px-2 py-0.5 rounded-md border border-border bg-muted/30">
                {s.sede} <strong className="tabular-nums">{s.cantidad}</strong>
              </span>
            ))}
          </div>
        </Bloque>
      )}
    </div>
  );
}