import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Zap, Loader2, Calendar, Layers, Settings, AlertCircle } from 'lucide-react';
import { RUBRO_PRESETS, getRubroConfig, parseMonto, fmt, MESES_ES } from './abonoUtils';

const MODO_SELECCION = { TODOS: 'todos', POR_RUBRO: 'rubro', MANUAL: 'manual' };
const MODO_MES = { AUTO: 'auto', ESPECIFICO: 'especifico' };

function getProximosMeses() {
  const now = new Date();
  const meses = [];
  for (let i = 0; i < 12; i++) {
    let m = now.getMonth() + 1 + i;
    let y = now.getFullYear();
    while (m > 12) { m -= 12; y++; }
    meses.push({ value: `${y}-${String(m).padStart(2, '0')}`, label: `${MESES_ES[m - 1]} ${y}` });
  }
  return meses;
}

function SectionTitle({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
        <Icon className="h-3.5 w-3.5 text-primary" />
      </div>
      <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">{children}</h3>
    </div>
  );
}

function RadioOption({ value, currentValue, onChange, label, description }) {
  const isSelected = currentValue === value;
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-left transition-all w-full ${
        isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
      }`}
    >
      <div className={`h-4 w-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center ${
        isSelected ? 'border-primary' : 'border-muted-foreground'
      }`}>
        {isSelected && <div className="h-2 w-2 rounded-full bg-primary" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground">{label}</p>
        {description && <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>}
      </div>
    </button>
  );
}

export default function GeneracionMensualConfig({ open, onClose, abonos, onGenerate, generating }) {
  const [modoSeleccion, setModoSeleccion] = useState(MODO_SELECCION.TODOS);
  const [rubrosSel, setRubrosSel] = useState([]);
  const [abonosSel, setAbonosSel] = useState([]);
  const [modoMes, setModoMes] = useState(MODO_MES.AUTO);
  const [mesTarget, setMesTarget] = useState('');
  const [regenerar, setRegenerar] = useState(false);
  const [skipCompleted, setSkipCompleted] = useState(true);

  const mesesOptions = useMemo(() => getProximosMeses(), []);

  useEffect(() => {
    if (open) {
      setModoSeleccion(MODO_SELECCION.TODOS);
      setRubrosSel([]);
      setAbonosSel([]);
      setModoMes(MODO_MES.AUTO);
      setMesTarget(mesesOptions[0]?.value || '');
      setRegenerar(false);
      setSkipCompleted(true);
    }
  }, [open, mesesOptions]);

  const abonosActivos = useMemo(() => abonos.filter(a => a.estado === 'activo'), [abonos]);

  const abonosFiltrados = useMemo(() => {
    let list = [...abonosActivos];
    if (modoSeleccion === MODO_SELECCION.POR_RUBRO) {
      if (rubrosSel.length === 0) return [];
      list = list.filter(a => rubrosSel.includes(a.rubro || 'OTROS'));
    }
    if (modoSeleccion === MODO_SELECCION.MANUAL) {
      if (abonosSel.length === 0) return [];
      list = list.filter(a => abonosSel.includes(a.id));
    }
    return list;
  }, [abonosActivos, modoSeleccion, rubrosSel, abonosSel]);

  const totalMonto = useMemo(() => {
    return abonosFiltrados.reduce((acc, a) => acc + parseMonto(a.monto_mensual), 0);
  }, [abonosFiltrados]);

  const toggleRubro = (val) => {
    setRubrosSel(prev => prev.includes(val) ? prev.filter(r => r !== val) : [...prev, val]);
  };

  const toggleAbono = (id) => {
    setAbonosSel(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]);
  };

  const handleGenerate = () => {
    const params = {
      modo: 'mensual_todos',
      regenerar,
      skip_completed: skipCompleted,
    };
    if (modoSeleccion === MODO_SELECCION.POR_RUBRO) params.rubros = rubrosSel;
    if (modoSeleccion === MODO_SELECCION.MANUAL) params.abono_ids = abonosSel;
    if (modoMes === MODO_MES.ESPECIFICO && mesTarget) params.mes_target = mesTarget;
    onGenerate(params);
  };

  const canGenerate = abonosFiltrados.length > 0 && !generating;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !generating) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Zap className="h-4 w-4 text-white" />
            </div>
            Generar Certificados del Mes
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* SECCIÓN 1: Selección de abonos */}
          <div>
            <SectionTitle icon={Layers}>Selección de Abonos</SectionTitle>
            <div className="space-y-2">
              <RadioOption
                value={MODO_SELECCION.TODOS}
                currentValue={modoSeleccion}
                onChange={setModoSeleccion}
                label="Todos los abonos activos"
                description={`${abonosActivos.length} abono(s) activo(s) en total`}
              />

              <RadioOption
                value={MODO_SELECCION.POR_RUBRO}
                currentValue={modoSeleccion}
                onChange={setModoSeleccion}
                label="Por rubro"
                description="Seleccioná uno o más rubros a certificar"
              />
              {modoSeleccion === MODO_SELECCION.POR_RUBRO && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pl-6 pt-1">
                  {RUBRO_PRESETS.map(r => {
                    const Icon = r.Icon;
                    const checked = rubrosSel.includes(r.value);
                    const count = abonosActivos.filter(a => (a.rubro || 'OTROS') === r.value).length;
                    return (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => toggleRubro(r.value)}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all ${
                          checked ? `${r.bg} ${r.border}` : 'border-border hover:border-primary/40'
                        }`}
                      >
                        <Checkbox checked={checked} className="pointer-events-none" />
                        <Icon className={`h-3.5 w-3.5 ${r.color}`} />
                        <span className="text-[11px] font-medium flex-1">{r.label}</span>
                        <span className="text-[10px] text-muted-foreground">{count}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              <RadioOption
                value={MODO_SELECCION.MANUAL}
                currentValue={modoSeleccion}
                onChange={setModoSeleccion}
                label="Selección manual"
                description="Elegir abonos específicos uno por uno"
              />
              {modoSeleccion === MODO_SELECCION.MANUAL && (
                <div className="space-y-1.5 pl-6 pt-1 max-h-48 overflow-y-auto">
                  {abonosActivos.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">No hay abonos activos</p>
                  ) : (
                    abonosActivos.map(a => {
                      const cfg = getRubroConfig(a.rubro);
                      const checked = abonosSel.includes(a.id);
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => toggleAbono(a.id)}
                          className={`w-full flex items-center gap-2 p-2 rounded-lg border text-left transition-all ${
                            checked ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                          }`}
                        >
                          <Checkbox checked={checked} className="pointer-events-none" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate">{a.contratista}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {cfg.label} · {fmt(a.monto_mensual)}/mes
                            </p>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          {/* SECCIÓN 2: Mes objetivo */}
          <div>
            <SectionTitle icon={Calendar}>Mes Objetivo</SectionTitle>
            <div className="space-y-2">
              <RadioOption
                value={MODO_MES.AUTO}
                currentValue={modoMes}
                onChange={setModoMes}
                label="Próximo mes pendiente (automático)"
                description="Genera el siguiente certificado en secuencia de cada abono"
              />
              <RadioOption
                value={MODO_MES.ESPECIFICO}
                currentValue={modoMes}
                onChange={setModoMes}
                label="Mes específico"
                description="Elegir manualmente el mes a certificar"
              />
              {modoMes === MODO_MES.ESPECIFICO && (
                <div className="pl-6 pt-1">
                  <select
                    value={mesTarget}
                    onChange={e => setMesTarget(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {mesesOptions.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    Solo se generarán certificados para abonos cuyo contrato incluya este mes
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* SECCIÓN 3: Opciones */}
          <div>
            <SectionTitle icon={Settings}>Opciones</SectionTitle>
            <div className="space-y-2">
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
                    Elimina y vuelve a crear certificados que ya existan para el mes seleccionado
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSkipCompleted(!skipCompleted)}
                className={`w-full flex items-start gap-2.5 p-2.5 rounded-lg border text-left transition-all ${
                  skipCompleted ? 'border-primary/40 bg-primary/5' : 'border-border hover:border-primary/40'
                }`}
              >
                <Checkbox checked={skipCompleted} className="pointer-events-none mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-foreground">Omitir contratos completados</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    No procesar abonos que ya generaron todos sus certificados
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Resumen */}
          <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] text-muted-foreground">Se generarán</p>
                <p className="text-2xl font-bold text-emerald-400">
                  {abonosFiltrados.length} certificado{abonosFiltrados.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-muted-foreground">Monto total mensual</p>
                <p className="text-lg font-bold text-foreground">{fmt(totalMonto)}</p>
              </div>
            </div>
            {abonosFiltrados.length === 0 && (
              <div className="flex items-center gap-1.5 mt-2 text-[11px] text-amber-400">
                <AlertCircle className="h-3 w-3" />
                No hay abonos que coincidan con los filtros seleccionados
              </div>
            )}
            {modoMes === MODO_MES.ESPECIFICO && mesTarget && (
              <div className="flex items-center gap-1.5 mt-2 text-[11px] text-muted-foreground">
                <Calendar className="h-3 w-3" />
                Mes objetivo: {mesesOptions.find(m => m.value === mesTarget)?.label}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={generating} className="text-xs">
            Cancelar
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="gap-2 text-xs bg-gradient-to-r from-emerald-500 to-teal-600"
          >
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            {generating ? 'Generando...' : 'Generar Certificados'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}