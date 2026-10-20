import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Archive, CheckCircle2, Download, FileJson, Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const TARGET_ENTITIES = [
  {
    key: 'TutorialProgress',
    label: 'TutorialProgress',
    description: 'Progreso histórico de módulos y cuestionarios del tutorial'
  },
  {
    key: 'DigitalSignature',
    label: 'DigitalSignature',
    description: 'Registros de firmas digitales SHA-256 y certificados asociados'
  }
];

async function fetchAllEntityRecordsPaginated(entityName, onProgress) {
  const allRecords = [];
  let cursor = undefined;
  let pageCount = 0;

  while (true) {
    pageCount += 1;
    const options = { sort: '-created_date', limit: 500 };
    if (cursor) options.cursor = cursor;

    const response = await base44.entities[entityName].filter({}, options);

    if (Array.isArray(response)) {
      allRecords.push(...response);
      onProgress?.(allRecords.length, pageCount);
      break;
    }

    const items = Array.isArray(response?.items) ? response.items : [];
    allRecords.push(...items);
    onProgress?.(allRecords.length, pageCount);

    if (!response?.has_more || !response?.next_cursor) {
      break;
    }
    cursor = response.next_cursor;
  }

  return allRecords;
}

function triggerJsonDownload(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function EntityArchiveBackupPanel() {
  const [isExporting, setIsExporting] = useState(false);
  const [entityState, setEntityState] = useState(() =>
    TARGET_ENTITIES.reduce((acc, ent) => {
      acc[ent.key] = {
        status: 'idle', // idle | loading | completed | error
        count: null,
        pages: 0,
        exportedAt: null,
        filename: null,
        payload: null,
        error: null
      };
      return acc;
    }, {})
  );

  const exportSingleEntity = async (entityKey) => {
    setEntityState((prev) => ({
      ...prev,
      [entityKey]: {
        ...prev[entityKey],
        status: 'loading',
        count: 0,
        pages: 0,
        error: null
      }
    }));

    const records = await fetchAllEntityRecordsPaginated(entityKey, (loadedCount, pages) => {
      setEntityState((prev) => ({
        ...prev,
        [entityKey]: {
          ...prev[entityKey],
          count: loadedCount,
          pages
        }
      }));
    });

    const exportedAt = new Date().toISOString();
    const dateStamp = exportedAt.slice(0, 19).replace(/[:T]/g, '-');
    const filename = `respaldo_${entityKey}_${dateStamp}.json`;

    const payload = {
      backup_metadata: {
        entity_name: entityKey,
        exported_at: exportedAt,
        total_records: records.length,
        mode: 'read_only_archive_backup',
        source_preserved: true
      },
      records
    };

    triggerJsonDownload(payload, filename);

    setEntityState((prev) => ({
      ...prev,
      [entityKey]: {
        status: 'completed',
        count: records.length,
        pages: Math.max(1, prev[entityKey].pages),
        exportedAt,
        filename,
        payload,
        error: null
      }
    }));

    return { entityKey, count: records.length, filename };
  };

  const handleExportBoth = async () => {
    setIsExporting(true);
    try {
      const results = [];
      for (const ent of TARGET_ENTITIES) {
        try {
          const res = await exportSingleEntity(ent.key);
          results.push(res);
        } catch (err) {
          setEntityState((prev) => ({
            ...prev,
            [ent.key]: {
              ...prev[ent.key],
              status: 'error',
              error: err?.message || 'Error al exportar la entidad'
            }
          }));
          toast.error(`Error al exportar ${ent.label}: ${err?.message || 'Error inesperado'}`);
        }
      }

      if (results.length === TARGET_ENTITIES.length) {
        const summary = results.map((r) => `${r.entityKey} (${r.count})`).join(' y ');
        toast.success(`Respaldo exportado correctamente: ${summary}`);
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleRedownload = (entityKey) => {
    const st = entityState[entityKey];
    if (!st?.payload || !st?.filename) return;
    triggerJsonDownload(st.payload, st.filename);
    toast.success(`Archivo ${st.filename} descargado`);
  };

  return (
    <Card className="p-6 border-border bg-card">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Archive className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-base text-foreground">
              Respaldo Previo de Entidades (TutorialProgress y DigitalSignature)
            </h3>
            <Badge variant="outline" className="text-xs border-emerald-500/40 text-emerald-400">
              Solo lectura · Sin borrado
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Exporta todos los registros en archivos descargables separados mediante paginación segura, manteniendo intactas las tablas y sus datos originales.
          </p>
        </div>

        <Button
          onClick={handleExportBoth}
          disabled={isExporting}
          className="gap-2 shrink-0"
        >
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Exportando respaldos...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Exportar Respaldo de Ambas Entidades
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {TARGET_ENTITIES.map((ent) => {
          const st = entityState[ent.key];
          return (
            <div
              key={ent.key}
              className="rounded-lg border border-border bg-background/50 p-4 flex flex-col justify-between gap-3"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileJson className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm text-foreground">{ent.label}</span>
                  </div>

                  {st.status === 'idle' && (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      Pendiente de exportar
                    </Badge>
                  )}
                  {st.status === 'loading' && (
                    <Badge className="bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Exportando...
                    </Badge>
                  )}
                  {st.status === 'completed' && (
                    <Badge className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Respaldo generado
                    </Badge>
                  )}
                  {st.status === 'error' && (
                    <Badge className="bg-red-500/15 text-red-300 border border-red-500/30 text-xs gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Error
                    </Badge>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">{ent.description}</p>
              </div>

              <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-2 text-xs">
                <div className="space-y-0.5">
                  {st.status === 'idle' && (
                    <span className="text-muted-foreground">
                      Sin exportación en esta sesión
                    </span>
                  )}
                  {st.status === 'loading' && (
                    <span className="text-amber-300">
                      Obteniendo registros ({st.count ?? 0} leídos, pág. {st.pages || 1})...
                    </span>
                  )}
                  {st.status === 'completed' && (
                    <div className="space-y-0.5">
                      <div className="font-medium text-foreground">
                        Total exportado: <span className="text-emerald-400">{st.count}</span> registro{st.count === 1 ? '' : 's'}
                      </div>
                      <div className="text-muted-foreground truncate max-w-[240px]" title={st.filename}>
                        Archivo: {st.filename}
                      </div>
                    </div>
                  )}
                  {st.status === 'error' && (
                    <span className="text-red-400">{st.error}</span>
                  )}
                </div>

                {st.status === 'completed' && st.payload && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRedownload(ent.key)}
                    className="h-8 gap-1.5 text-xs shrink-0"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Descargar JSON
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-md px-3 py-2 border border-border/50">
        <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
        <span>
          Las entidades <strong>TutorialProgress</strong> y <strong>DigitalSignature</strong> permanecen intactas en la base de datos; esta operación únicamente lee y descarga sus colecciones completas.
        </span>
      </div>
    </Card>
  );
}