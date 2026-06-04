import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, CheckCircle2, AlertTriangle, Loader2, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';

export default function ImportarCalefaccionModal({ open, onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [periodo, setPeriodo] = useState('Mayo 2026');
  const [limpiar, setLimpiar] = useState(true);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);

  const handleImport = async () => {
    if (!file) { toast.error('Seleccioná un archivo Excel'); return; }
    setLoading(true);
    setResultado(null);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const res = await base44.functions.invoke('importarCalefaccion', {
        file_url,
        periodo,
        limpiar_anteriores: limpiar,
      });
      setResultado(res.data);
      toast.success(`Importación exitosa: ${res.data.total_importados} registros`);
    } catch (err) {
      toast.error('Error en la importación: ' + err.message);
    }
    setLoading(false);
  };

  const handleClose = () => {
    if (resultado) onSuccess();
    else onClose();
    setFile(null);
    setResultado(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <FileSpreadsheet className="h-5 w-5 text-orange-400" /> Importar Excel de Calefacción
          </DialogTitle>
        </DialogHeader>

        {resultado ? (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <CheckCircle2 className="h-8 w-8 text-emerald-400 shrink-0" />
              <div>
                <p className="font-semibold text-white">{resultado.total_importados} registros importados</p>
                <p className="text-xs text-slate-400 mt-0.5">Período: {periodo}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Críticos', value: resultado.por_estado?.critico || 0, color: 'text-red-400' },
                { label: 'En alerta', value: resultado.por_estado?.alerta || 0, color: 'text-orange-400' },
                { label: 'Normales', value: resultado.por_estado?.normal || 0, color: 'text-blue-400' },
                { label: 'Óptimos', value: resultado.por_estado?.optimo || 0, color: 'text-emerald-400' },
              ].map(s => (
                <div key={s.label} className="bg-slate-800/50 rounded-xl p-3 text-center">
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-slate-400">{s.label}</p>
                </div>
              ))}
            </div>
            {resultado.criticos > 0 && (
              <div className="flex items-center gap-2 text-xs text-orange-300 bg-orange-500/10 rounded-lg px-3 py-2 border border-orange-500/20">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {resultado.criticos} equipos requieren atención inmediata
              </div>
            )}
            <Button className="w-full bg-orange-600 hover:bg-orange-700" onClick={handleClose}>
              Ver Dashboard
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Dropzone */}
            <label className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl p-8 cursor-pointer transition-colors ${file ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-slate-700 hover:border-orange-500/50 bg-slate-800/30'}`}>
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={e => setFile(e.target.files[0])} />
              {file ? (
                <>
                  <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                  <p className="text-sm font-medium text-white">{file.name}</p>
                  <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(0)} KB</p>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-slate-500" />
                  <p className="text-sm text-slate-300 font-medium">Arrastrá o hacé clic para subir</p>
                  <p className="text-xs text-slate-500">Excel de relevamiento de calefacción (.xlsx)</p>
                </>
              )}
            </label>

            {/* Período */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Período del relevamiento</label>
              <Input
                value={periodo}
                onChange={e => setPeriodo(e.target.value)}
                placeholder="Ej: Mayo 2026"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>

            {/* Limpiar */}
            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-slate-700 bg-slate-800/30 hover:border-slate-600 transition-colors">
              <input type="checkbox" checked={limpiar} onChange={e => setLimpiar(e.target.checked)} className="h-4 w-4 rounded accent-orange-500" />
              <div>
                <p className="text-sm text-white font-medium">Reemplazar datos del período</p>
                <p className="text-xs text-slate-400">Elimina registros anteriores del mismo período antes de importar</p>
              </div>
            </label>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1 border-slate-700 text-slate-300" onClick={onClose}>Cancelar</Button>
              <Button
                className="flex-1 bg-orange-600 hover:bg-orange-700 gap-2"
                onClick={handleImport}
                disabled={loading || !file}
              >
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Importando...</> : <><Upload className="h-4 w-4" /> Importar</>}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}