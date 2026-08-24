import React, { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, FileText, Trash2, X, Paperclip } from 'lucide-react';
import { toast } from 'sonner';

/**
 * AssetDocumentos — permite adjuntar varios PDFs (u otros archivos) al activo
 * de forma masiva. Persiste en Asset.documents (array de URLs). RLS aísla por sector.
 */
export default function AssetDocumentos({ asset }) {
  const qc = useQueryClient();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [removing, setRemoving] = useState(null);

  const docs = Array.isArray(asset?.documents) ? asset.documents : [];

  const persist = async (newUrls) => {
    await base44.entities.Asset.update(asset.id, { documents: newUrls });
    qc.invalidateQueries({ queryKey: ['asset', asset.id] });
    qc.invalidateQueries({ queryKey: ['assets'] });
  };

  const handleFiles = async (e) => {
    const picked = Array.from(e.target.files || []);
    if (e.target.value) e.target.value = '';
    if (!picked.length) return;

    const pdfOnly = picked.filter(f => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
    if (pdfOnly.length === 0) {
      toast.error('Seleccioná archivos PDF');
      return;
    }

    setUploading(true);
    setProgress(`Subiendo 1 de ${pdfOnly.length}...`);
    try {
      const newUrls = [];
      for (let i = 0; i < pdfOnly.length; i++) {
        setProgress(`Subiendo ${i + 1} de ${pdfOnly.length}...`);
        const { file_url } = await base44.integrations.Core.UploadFile({ file: pdfOnly[i] });
        newUrls.push(file_url);
      }
      await persist([...docs, ...newUrls]);
      toast.success(`${newUrls.length} PDF(s) adjuntado(s)`);
    } catch (err) {
      toast.error('No se pudieron subir los archivos');
    } finally {
      setUploading(false);
      setProgress('');
    }
  };

  const handleRemove = async (url) => {
    setRemoving(url);
    try {
      await persist(docs.filter(d => d !== url));
      toast.success('Documento eliminado');
    } catch (err) {
      toast.error('No se pudo eliminar el documento');
    } finally {
      setRemoving(null);
    }
  };

  const fileName = (url) => {
    try {
      const u = new URL(url);
      return decodeURIComponent(u.pathname.split('/').pop() || 'documento.pdf');
    } catch {
      return url.split('/').pop() || 'documento.pdf';
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-primary" /> Documentos ({docs.length})
        </CardTitle>
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" multiple className="hidden" onChange={handleFiles} />
        <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          Adjuntar PDFs
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {uploading && progress && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {progress}
          </div>
        )}
        {docs.length === 0 && !uploading && (
          <p className="text-xs text-muted-foreground py-2">
            Sin documentos adjuntos. Subí manuales, garantías, fichas técnicas, etc. (uno o varios a la vez).
          </p>
        )}
        {docs.length > 0 && (
          <div className="space-y-1.5">
            {docs.map((url, idx) => (
              <div key={idx} className="flex items-center gap-2 rounded-lg border border-border bg-background/60 px-2.5 py-2">
                <FileText className="h-4 w-4 text-red-500 shrink-0" />
                <a href={url} target="_blank" rel="noreferrer" className="text-xs truncate flex-1 hover:text-primary hover:underline" title={fileName(url)}>
                  {fileName(url)}
                </a>
                <button
                  onClick={() => handleRemove(url)}
                  disabled={removing === url}
                  className="text-muted-foreground hover:text-destructive shrink-0 disabled:opacity-50"
                  title="Eliminar"
                >
                  {removing === url ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}