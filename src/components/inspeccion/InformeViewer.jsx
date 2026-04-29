import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Download, Copy, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function InformeViewer({ informe, establecimiento, fecha }) {
  const handleCopy = () => {
    navigator.clipboard.writeText(informe);
    toast.success('Informe copiado al portapapeles');
  };

  const handleDownload = () => {
    const blob = new Blob([informe], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `informe_${establecimiento?.replace(/\s+/g, '_')}_${fecha || 'hoy'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          <h3 className="font-semibold text-sm">Informe generado</h3>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleCopy} className="gap-1.5">
            <Copy className="h-3.5 w-3.5" /> Copiar
          </Button>
          <Button size="sm" variant="outline" onClick={handleDownload} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> Descargar
          </Button>
        </div>
      </div>
      <div className="rounded-xl border bg-white p-6 prose prose-sm prose-slate max-w-none overflow-y-auto max-h-[600px]">
        <ReactMarkdown>{informe}</ReactMarkdown>
      </div>
    </div>
  );
}