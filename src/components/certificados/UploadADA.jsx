import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const TIPOS = [
  { value: 'abono_mensual', label: 'Abono Mensual', desc: 'Contrato de servicio recurrente mensual', color: 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100' },
  { value: 'obra',         label: 'Obra / Presupuesto', desc: 'Contrato o presupuesto de obra civil', color: 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100' },
  { value: 'informe',      label: 'Informe / Certificado', desc: 'Informe de avance o certificado de medición', color: 'border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100' },
];

const TIPO_LABELS = { abono_mensual: 'Abono Mensual', obra: 'Obra / Presupuesto', informe: 'Informe / Certificado' };

export default function UploadADA({ onExtracted }) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('idle');
  const [tipoSeleccionado, setTipoSeleccionado] = useState(null); // null = auto-detectar

  const processFile = async (file) => {
    if (!file || file.type !== 'application/pdf') { toast.error('Solo se aceptan archivos PDF'); return; }
    setLoading(true);
    try {
      // Paso 1: subir PDF
      setStep('uploading');
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      // Paso 2: extraer datos (detección de tipo integrada en extractADA si no hay tipo_override)
      setStep('reading');
      const res = await base44.functions.invoke('extractADA', { file_url, tipo_override: tipoSeleccionado || null });
      let data = res.data.data;

      // Paso 4: si hay discrepancia, llamar función de corrección por separado
      if (data._validation?.needs_correction) {
        setStep('correcting');
        const corrRes = await base44.functions.invoke('correctADAItems', {
          file_url,
          calculated: data._validation.subtotal_calculado,
          docTotal: data._validation.subtotal_documento,
          direction: data._validation.correction_direction,
        });
        if (corrRes.data?.items?.length) {
          const newCalc = corrRes.data.calculated;
          const docTotal = data._validation.subtotal_documento;
          data.items = corrRes.data.items;
          data.subtotal = newCalc;
          data._validation = {
            ...data._validation,
            subtotal_calculado: newCalc,
            diferencia: Math.abs(newCalc - docTotal),
            coincide: Math.abs(newCalc - docTotal) / docTotal <= 0.005,
            needs_correction: false,
          };
        }
      }

      setStep('done');
      onExtracted({ ...data, ada_pdf_url: file_url });
    } catch (err) {
      toast.error('Error al procesar el PDF: ' + (err?.message || 'Error desconocido'));
      setStep('idle');
    } finally {
      setLoading(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    processFile(e.dataTransfer.files[0]);
  };

  const stepLabel = {
    uploading: 'Subiendo PDF...',
    reading: tipoSeleccionado ? `Extrayendo datos (${TIPO_LABELS[tipoSeleccionado]})...` : 'Analizando y extrayendo datos...',
    correcting: 'Corrigiendo discrepancias en los ítems...',
    done: '¡Datos extraídos!',
  };

  return (
    <div className="max-w-xl mx-auto mt-12 space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary/10 mb-4">
          <Sparkles className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-xl font-bold">Subí el ADA / Orden de Compra</h2>
        <p className="text-muted-foreground text-sm mt-1">La IA extrae todos los datos automáticamente</p>
      </div>

      {/* Selector de tipo */}
      <div>
        <p className="text-sm font-semibold text-center mb-3">¿Qué tipo de documento es?</p>
        <div className="grid grid-cols-1 gap-2">
          {/* Opción auto-detectar */}
          <button
            onClick={() => setTipoSeleccionado(null)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${
              tipoSeleccionado === null
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border bg-background text-muted-foreground hover:bg-muted/40'
            }`}
          >
            <div className="h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 border-current">
              {tipoSeleccionado === null && <div className="h-2.5 w-2.5 rounded-full bg-primary" />}
            </div>
            <div>
              <span className="font-medium text-sm">Auto-detectar</span>
              <p className="text-xs opacity-70">La IA analiza el documento y decide</p>
            </div>
          </button>

          {TIPOS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTipoSeleccionado(t.value)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${
                tipoSeleccionado === t.value
                  ? `border-current ${t.color}`
                  : 'border-border bg-background text-muted-foreground hover:bg-muted/40'
              }`}
            >
              <div className="h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 border-current">
                {tipoSeleccionado === t.value && <div className="h-2.5 w-2.5 rounded-full bg-current" />}
              </div>
              <div>
                <span className="font-medium text-sm">{t.label}</span>
                <p className="text-xs opacity-70">{t.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Drop zone */}
      {loading ? (
        <div className="border-2 border-dashed border-primary/30 rounded-2xl p-12 text-center bg-primary/5">
          <Loader2 className="h-10 w-10 text-primary animate-spin mx-auto mb-4" />
          <p className="font-medium text-primary">{stepLabel[step] || stepLabel['reading']}</p>
          {tipoSeleccionado && (
            <span className="inline-block mt-2 text-xs px-3 py-1 rounded-full bg-primary/10 text-primary font-medium">
              {TIPO_LABELS[tipoSeleccionado]}
            </span>
          )}
          <p className="text-xs text-muted-foreground mt-3">Esto puede tomar hasta 30 segundos...</p>
        </div>
      ) : (
        <label
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`block border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
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