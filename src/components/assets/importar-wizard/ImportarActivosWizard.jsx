import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
  const [autoCreateLocations, setAutoCreateLocations] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState('');
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const hasPdf = files.some(f => f.kind === 'pdf');

  const reset = () => {
    setStep('subir'); setFiles([]); setFileUrls([]); setPreview(null); setResult(null); setError(null); setProgress('');
  };

  // Subir archivo(s) y devolver file_url(s). Reutilizable para dry-run y commit.
  const uploadFiles = async () => {
    const urls = [];
    if (hasPdf) {
      const pdfFiles = files.filter(f => f.kind === 'pdf').map(f => f.file);
      for (let i = 0; i < pdfFiles.length; i++) {
        setProgress(`Subiendo PDF ${i + 1} de ${pdfFiles.length}...`);
        const { file_url } = await base44.integrations.Core.UploadFile({ file: pdfFiles[i] });
        urls.push(file_url);
      }
    } else {
      setProgress('Subiendo archivo...');
      const { file_url } = await base44.integrations.Core.UploadFile({ file: files[0].file });
      urls.push(file_url);
    }
    setProgress('');
    return urls;
  };

  const handleAnalizar = async () => {
    if (files.length === 0) return;
    setAnalyzing(true); setError(null); setPreview(null);
    try {
      const urls = await uploadFiles();
      setFileUrls(urls);
      setProgress('Analizando y validando...');
      const fnName = hasPdf ? 'importarActivosPDF' : 'importarActivosBapro';
      const payload = hasPdf
        ? { file_urls: urls, auto_create_locations: autoCreateLocations, dry_run: true }
        : { file_url: urls[0], auto_create_locations: autoCreateLocations, dry_run: true };
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
      const payload = hasPdf
        ? { file_urls: fileUrls, auto_create_locations: autoCreateLocations, dry_run: false }
        : { file_url: fileUrls[0], auto_create_locations: autoCreateLocations, dry_run: false };
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
            onAnalizar={handleAnalizar} error={error}
          />
        ) : step === 'preview' ? (
          <PasoPreview
            preview={preview}
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