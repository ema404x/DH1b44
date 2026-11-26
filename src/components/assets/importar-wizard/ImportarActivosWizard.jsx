import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SEDE_AUTO } from './SedeArchivoSelector';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Building2, Loader2 } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { base44 } from '@/api/base44Client';
import PasoSubir from './PasoSubir';
import PasoPreview from './PasoPreview';
import PasoResultado from './PasoResultado';
import HistorialImportaciones from './HistorialImportaciones';

// Wizard robusto (estilo MaintainX) para importar activos en BAPRO.
// Solo se monta cuando user.data.sector_id === 'bapro' (decisión en ActivosTab).
// Flujo: Subir → Vista previa (dry-run) → Confirmar → Resultado, + pestaña Historial.

export default function ImportarActivosWizard({ open, onOpenChange }) {
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const [tab, setTab] = useState('nueva'); // 'nueva' | 'historial'
  const [step, setStep] = useState('subir'); // 'subir' | 'preview' | 'resultado'
  const [files, setFiles] = useState([]);
  const [fileUrls, setFileUrls] = useState([]);
  // BAPRO tiene sus sedes fijas: por defecto NO se crean sedes automáticamente.
  const [autoCreateLocations, setAutoCreateLocations] = useState(false);
  const [sedeId, setSedeId] = useState(SEDE_AUTO);
  const { data: sedes = [] } = useQuery({
    queryKey: ['edificios-import-wizard'],
    queryFn: () => base44.entities.Edificio.list('nombre', 500),
    enabled: open,
    staleTime: 60000,
  });
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState('');
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const hasPdf = files.some(f => f.kind === 'pdf');

  const reset = () => {
    setStep('subir'); setFiles([]); setFileUrls([]); setPreview(null); setResult(null); setError(null); setProgress('');
    setSedeId(SEDE_AUTO); setAutoCreateLocations(false);
  };

  // Subir archivo(s) y devolver file_url(s). Reutilizable para dry-run y commit.
  const uploadFiles = async () => {
    const urls = [];
    const aSubir = files.map(f => f.file);
    for (let i = 0; i < aSubir.length; i++) {
      setProgress(`Subiendo archivo ${i + 1} de ${aSubir.length}...`);
      const { file_url } = await base44.integrations.Core.UploadFile({ file: aSubir[i] });
      urls.push(file_url);
    }
    setProgress('');
    return urls;
  };

  const baseOpts = () => ({
    auto_create_locations: autoCreateLocations,
    ...(sedeId && sedeId !== SEDE_AUTO ? { sede_id: sedeId } : {}),
  });

  const handleAnalizar = async () => {
    if (files.length === 0) return;
    setAnalyzing(true); setError(null); setPreview(null);
    try {
      const urls = await uploadFiles();
      setFileUrls(urls);
      setProgress('Analizando y validando...');
      const fnName = hasPdf ? 'importarActivosPDF' : 'importarActivosBapro';
      const payload = { file_urls: urls, ...baseOpts(), dry_run: true };
      const res = await base44.functions.invoke(fnName, payload);
      setPreview(res.data || res);
      setStep('preview');
    } catch (err) {
      setError(err.message || 'Error al analizar');
    } finally {
      setAnalyzing(false); setProgress('');
    }
  };

  const handleConfirmar = async () => {
    setImporting(true); setError(null);
    try {
      setProgress('Importando...');
      const fnName = hasPdf ? 'importarActivosPDF' : 'importarActivosBapro';
      // PDF: se importan exactamente las filas de la vista previa (sin volver a extraer).
      if (hasPdf && !preview?.inputs?.length) throw new Error('Faltan las filas de la vista previa. Volvé y analizá de nuevo.');
      const payload = hasPdf
        ? { file_urls: fileUrls, inputs: preview.inputs, ...baseOpts(), dry_run: false }
        : { file_urls: fileUrls, ...baseOpts(), dry_run: false };
      const res = await base44.functions.invoke(fnName, payload);
      setResult(res.data || res);
      setStep('resultado');
      qc.invalidateQueries({ queryKey: ['assets'] });
      qc.invalidateQueries({ queryKey: ['edificios'] });
      qc.invalidateQueries({ queryKey: ['importaciones-activos'] });
    } catch (err) {
      setError(err.message || 'Error al importar');
    } finally {
      setImporting(false); setProgress('');
    }
  };

  const onRollbackDone = () => {
    qc.invalidateQueries({ queryKey: ['assets'] });
    qc.invalidateQueries({ queryKey: ['edificios'] });
    qc.invalidateQueries({ queryKey: ['importaciones-activos'] });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { reset(); setTab('nueva'); } }}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Importar Activos · BAPRO
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border pb-2">
          <button
            onClick={() => { setTab('nueva'); }}
            className={`px-3 py-1.5 text-sm font-medium rounded-t-md transition-colors ${tab === 'nueva' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Nueva importación
          </button>
          <button
            onClick={() => setTab('historial')}
            className={`px-3 py-1.5 text-sm font-medium rounded-t-md transition-colors ${tab === 'historial' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Historial
          </button>
        </div>

        {analyzing || importing ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{progress || 'Procesando...'}</p>
          </div>
        ) : tab === 'historial' ? (
          <HistorialImportaciones onRollbackDone={onRollbackDone} />
        ) : step === 'subir' ? (
          <PasoSubir
            files={files} setFiles={setFiles}
            autoCreateLocations={autoCreateLocations} setAutoCreateLocations={setAutoCreateLocations}
            sedes={sedes} sedeId={sedeId} setSedeId={setSedeId}
            onAnalizar={handleAnalizar} error={error}
          />
        ) : step === 'preview' ? (
          <PasoPreview
            preview={preview}
            esPdf={hasPdf}
            autoCreateLocations={autoCreateLocations}
            onVolver={() => { setStep('subir'); setPreview(null); }}
            onConfirmar={handleConfirmar}
            error={error}
          />
        ) : (
          <PasoResultado
            result={result}
            onVerHistorial={() => setTab('historial')}
            onNueva={() => reset()}
            onCerrar={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}