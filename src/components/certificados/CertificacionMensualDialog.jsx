import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar, Loader2, Zap, MapPin, AlertCircle, Clock } from 'lucide-react';
import { parseMonto, fmt, MESES_ES, COMUNAS } from './abonoUtils';

// Últimos 12 meses incluyendo el actual (NO futuros)
function getMesesPasados() {
  const now = new Date();
  const meses = [];
  for (let i = 0; i < 12; i++) {
    let m = now.getMonth() + 1 - i;
    let y = now.getFullYear();
    while (m < 1) { m += 12; y--; }
    meses.push({ value: `${y}-${String(m).padStart(2, '0')}`, label: `${MESES_ES[m - 1]} ${y}` });
  }
  return meses;
}

function mesToInt(mes) {
  return parseInt(String(mes).replace('-', ''), 10);
}

export default function CertificacionMensualDialog({ open, onClose, abonos, onGenerate, generating }) {
  const [mesTarget, setMesTarget] = useState('');
  const [comunasSel, setComunasSel] = useState([]);
  const [regenerar, setRegenerar] = useState(false);

  const mesesOptions = useMemo(() => getMesesPasados(), []);

  useEffect(() => {
    if (open) {
      setMesTarget(mesesOptions[0]?.value || '');
      setComunasSel([]);
      setRegenerar(false);
    }
  }, [open, mesesOptions]);

  // Preview: qué abonos califican para este mes
  const preview = useMemo(() => {
    if (!mesTarget) return { qualifying: [], skipped: [] };
    const targetInt = mesToInt(mesTarget);
    const activos = abonos.filter(a => a.estado === 'activo');
    const filtered = comunasSel.length > 0
      ? activos.filter(a => comunasSel.includes(a.comuna))
      : activos;
    const qualifying = [];
    const skipped = [];

    for (const a of filtered) {
      const inicio = a.fecha_inicio_validez?.slice(0, 7);
      const fin = a.fecha_fin_validez?.slice(0, 7);
      if (!inicio || !fin) {
        skipped.push({ abono: a, reason: 'Sin fechas de validez' });
      } else if (targetInt < mesToInt(inicio) || targetInt > mesToInt(fin)) {
        skipped.push({ abono: a, reason: 'Fuera del contrato' });
      } else {
        qualifying.push(a);
      }
    }
    return { qualifying, skipped };
  }, [abonos, mesTarget, comunasSel]);

  const totalMonto = preview.qualifying.reduce((acc, a) => acc + parseMonto(a.monto_mensual), 0);
  const mesLabel = mesesOptions.find(m => m.value === mesTarget)?.label || '';

  const toggleComuna = (val) => {
    setComunasSel(prev => prev.includes(val) ? prev.filter(c => c !== val) : [...prev, val]);
  };

  const handleGenerate = () => {
    const params = { mes_target: mesTarget, regenerar };
    if (comunasSel.length > 0) params.comunas = comunasSel;
    onGenerate(params);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !generating) onClose(); }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Calendar className="h-4 w-4 text-white" />
            </div>
            Certificar Mes
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Selección de mes */}
          <div>
            <label className="text-xs font-bold text-foreground uppercase tracking-wide mb-2 block">
              Mes a certificar
            </label>
            <select
              value={mesTarget}
              onChange={e => setMesTarget(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm font-medium"
            >
              {mesesOptions.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Solo se certifican meses ya iniciados — no se pueden certificar meses futuros
            </p>
          </div>

          {/* Filtro por comuna */}
          <div>
            <label className="text-xs font-bold text-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> Comunas (opcional)
            </label>
            <div className="flex gap-2 flex-wrap">
              {COMUNAS.map(c => {
                const selected = comunasSel.includes(c);
                const noneSelected = comunasSel.length === 0;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleComuna(c)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      selected || noneSelected
                        ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-300'
                        : 'border-border text-muted-foreground hover:border-indigo-500/40'
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
            {comunasSel.length === 0 && <p className="text-[11px] text-muted-foreground mt-1">Todas las comunas</p>}
          </div>

          {/* Preview de resultados */}
          <div className="bg-muted/30 rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] text-muted-foreground">Se certificarán</p>
                <p className="text-2xl font-bold text-emerald-400">{preview.qualifying.length}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-muted-foreground">Monto total del mes</p>
                <p className="text-lg font-bold text-foreground">{fmt(totalMonto)}</p>
              </div>
            </div>

            {preview.qualifying.length > 0 && (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {preview.qualifying.map(a => (
                  <div key={a.id} className="flex items-center justify-between bg-background/60 rounded px-2.5 py-1.5 text-[11px]">
                    <span className="font-medium truncate flex-1">{a.contratista}</span>
                    <span className="text-emerald-400 font-semibold shrink-0 ml-2">{fmt(a.monto_mensual)}</span>
                  </div>
                ))}
              </div>
            )}

            {preview.skipped.length > 0 && (
              <div className="space-y-1 max-h-28 overflow-y-auto border-t border-border/50 pt-2">
                {preview.skipped.map((s, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="truncate flex-1">{s.abono.contratista}</span>
                    <span className="text-amber-400 shrink-0 ml-2">{s.reason}</span>
                  </div>
                ))}
              </div>
            )}

            {preview.qualifying.length === 0 && (
              <div className="flex items-center gap-1.5 text-[11px] text-amber-400">
                <AlertCircle className="h-3 w-3" />
                No hay abonos para certificar en {mesLabel}
              </div>
            )}
          </div>

          {/* Opción regenerar */}
          <button
            type="button"
            onClick={() => setRegenerar(!regenerar)}
            className={`w-full flex items-start gap-2.5 p-2.5 rounded-lg border text-left transition-all ${
              regenerar ? 'border-amber-500/40 bg-amber-500/5' : 'border-border hover:border-primary/40'
            }`}
          >
            <Checkbox checked={regenerar} className="pointer-events-none mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-foreground">Regenerar si ya existe</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Elimina y vuelve a crear certificados que ya existan para {mesLabel}
              </p>
            </div>
          </button>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={generating} className="text-xs">
            Cancelar
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={preview.qualifying.length === 0 || generating}
            className="gap-2 text-xs bg-gradient-to-r from-emerald-500 to-teal-600"
          >
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            {generating ? 'Certificando...' : `Certificar ${mesLabel}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}