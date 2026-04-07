import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Loader2, Sparkles } from 'lucide-react';

const TIPO_LABELS = {
  abono_mensual: 'Abono Mensual',
  obra: 'Obra / Presupuesto',
  informe: 'Informe / Certificado de Medición',
};

export default function UploadADA({ onExtracted }) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('idle');
  const [tipoDetectado, setTipoDetectado] = useState(null);

  const processFile = async (file) => {
    if (!file || file.type !== 'application/pdf') return alert('Solo se aceptan archivos PDF');
    setLoading(true);
    setTipoDetectado(null);

    // Paso 1: subir PDF
    setStep('uploading');
    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    // Paso 2: detectar tipo (llamada rápida separada)
    setStep('detecting');
    const tipoRes = await base44.functions.invoke('detectADAType', { file_url });
    const tipo = tipoRes.data?.tipo || 'obra';
    setTipoDetectado(tipo);

    // Paso 3: extraer datos (pasando tipo_override para evitar segunda llamada de detección)
    setStep('reading');
    const res = await base44.functions.invoke('extractADA', { file_url, tipo_override: tipo });

    setStep('done');
    setLoading(false);
    onExtracted({ ...res.data.data, ada_pdf_url: file_url });
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    processFile(e.dataTransfer.files[0]);
  };

  const stepLabel = {
    uploading: 'Subiendo PDF...',
    detecting: 'Detectando tipo de documento...',
    reading: tipoDetectado
      ? `Extrayendo datos (${TIPO_LABELS[tipoDetectado] || tipoDetectado})...`
      : 'La IA está leyendo el ADA...',
    done: '¡Datos extraídos!',
  };

  return (
    <div className="max-w-xl mx-auto mt-12">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary/10 mb-4">
          <Sparkles className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-xl font-bold">Subí el ADA / Orden de Compra</h2>
        <p className="text-muted-foreground text-sm mt-1">La IA detecta el tipo de documento y extrae todos los datos automáticamente</p>
        <div className="flex justify-center gap-2 mt-3 flex-wrap">
          {Object.entries(TIPO_LABELS).map(([key, label]) => (
            <span key={key} className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground border">{label}</span>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="border-2 border-dashed border-primary/30 rounded-2xl p-12 text-center bg-primary/5">
          <Loader2 className="h-10 w-10 text-primary animate-spin mx-auto mb-4" />
          <p className="font-medium text-primary">{stepLabel[step]}</p>
          {tipoDetectado && step === 'reading' && (
            <span className="inline-block mt-2 text-xs px-3 py-1 rounded-full bg-primary/10 text-primary font-medium">
              {TIPO_LABELS[tipoDetectado]}
            </span>
          )}
          <p className="text-xs text-muted-foreground mt-3">Esto puede tomar hasta 30 segundos...</p>
        </div>
      ) : (
        <label
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`block border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
            dragging ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50 hover:bg-muted/40'
          }`}
        >
          <input type="file" accept="application/pdf" className="hidden" onChange={(e) => processFile(e.target.files[0])} />
          <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold">Arrastrá el PDF aquí o hacé clic para seleccionar</p>
          <p className="text-xs text-muted-foreground mt-1">Solo archivos PDF · ADA, Orden de Compra, Informe</p>
          <Button className="mt-4 gap-2" variant="outline">
            <Upload className="h-4 w-4" /> Seleccionar PDF
          </Button>
        </label>
      )}
    </div>
  );
}