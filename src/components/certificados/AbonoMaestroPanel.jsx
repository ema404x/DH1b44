import React, { useState, useMemo, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Plus, Loader2, DollarSign, ArrowLeft, Upload, Sparkles, FolderOpen, Zap, CheckCircle2, FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { parseMonto, fmt, calcularFechas, EMPTY_FORM, getRubroConfig } from './abonoUtils';
import AbonoMaestroCard from './AbonoMaestroCard';
import AbonoMaestroForm from './AbonoMaestroForm';
import AbonoRubrosGrid from './AbonoRubrosGrid';
import GeneracionMensualConfig from './GeneracionMensualConfig';

export default function AbonoMaestroPanel() {
  const [view, setView] = useState('folders'); // 'folders' | 'rubro'
  const [selectedRubro, setSelectedRubro] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState('');
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [generatingMensual, setGeneratingMensual] = useState(false);
  const [mensualResult, setMensualResult] = useState(null);
  const [showMensualConfig, setShowMensualConfig] = useState(false);
  const fileRef = useRef(null);
  const qc = useQueryClient();

  const { data: abonos = [], isLoading } = useQuery({
    queryKey: ['abonos-maestro'],
    queryFn: () => base44.entities.AbonoMaestro.list('-created_date'),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Abonos del rubro seleccionado
  const rubroAbonos = useMemo(() => {
    if (!selectedRubro) return [];
    return abonos.filter(a => (a.rubro || 'OTROS') === selectedRubro);
  }, [abonos, selectedRubro]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rubroAbonos;
    const q = search.toLowerCase();
    return rubroAbonos.filter(a =>
      a.contratista?.toLowerCase().includes(q) ||
      a.ada_numero?.toLowerCase().includes(q) ||
      a.oc_numero?.toLowerCase().includes(q) ||
      a.obra_servicio?.toLowerCase().includes(q)
    );
  }, [rubroAbonos, search]);

  const rubroStats = useMemo(() => {
    const activos = rubroAbonos.filter(a => a.estado === 'activo').length;
    const lotesPendientes = rubroAbonos.filter(a => !a.lote_generado && a.estado === 'activo').length;
    const totalMensual = rubroAbonos.filter(a => a.estado === 'activo').reduce((acc, a) => acc + parseMonto(a.monto_mensual), 0);
    return { activos, lotesPendientes, totalMensual, total: rubroAbonos.length };
  }, [rubroAbonos]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const monto = parseMonto(data.monto_total_contrato);
      const meses = parseInt(data.duracion_meses) || 1;
      const { fechaInicio, fechaFin } = calcularFechas(data.fecha_oc_emision, meses);
      const itemsConTotal = (data.items || []).map(it => ({
        ...it,
        importe_unitario: parseMonto(it.importe_unitario),
        importe_total: parseMonto(it.importe_total) || (parseMonto(it.cantidad) * parseMonto(it.importe_unitario)),
      }));
      const payload = {
        ...data,
        rubro: data.rubro || selectedRubro || 'OTROS',
        monto_total_contrato: monto,
        duracion_meses: meses,
        monto_mensual: meses > 0 ? monto / meses : 0,
        fecha_inicio_validez: fechaInicio,
        fecha_fin_validez: fechaFin,
        items: itemsConTotal,
        ...(editingId ? {} : { certificados_emitidos: 0, lote_generado: false }),
      };
      if (editingId) return base44.entities.AbonoMaestro.update(editingId, payload);
      return base44.entities.AbonoMaestro.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['abonos-maestro'] });
      toast.success(editingId ? 'Abono actualizado' : 'Abono creado correctamente');
      setShowForm(false); setEditingId(null); setForm(EMPTY_FORM);
    },
    onError: (e) => toast.error('Error: ' + e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.AbonoMaestro.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['abonos-maestro'] }); toast.success('Abono eliminado'); },
  });

  const handleEdit = (abono) => {
    setEditingId(abono.id);
    setForm({
      rubro: abono.rubro || 'OTROS',
      comuna: abono.comuna || '8A',
      contratista: abono.contratista || '',
      oc_numero: abono.oc_numero || '',
      ada_numero: abono.ada_numero || '',
      obra_servicio: abono.obra_servicio || '',
      emprendimiento: abono.emprendimiento || '',
      monto_total_contrato: abono.monto_total_contrato ? String(abono.monto_total_contrato) : '',
      fecha_oc_emision: abono.fecha_oc_emision || '',
      duracion_meses: abono.duracion_meses || '',
      plazo_obra: abono.plazo_obra || '',
      condiciones_pago: abono.condiciones_pago || '',
      anticipo_pct: abono.anticipo_pct ?? 0,
      fondo_reparo_pct: abono.fondo_reparo_pct ?? 0,
      items: abono.items?.length
        ? abono.items.map(it => ({ ...it, importe_unitario: parseMonto(it.importe_unitario), importe_total: parseMonto(it.importe_total) }))
        : [{ descripcion: '', um: 'MES', cantidad: 1, importe_unitario: '', importe_total: 0 }],
      estado: abono.estado || 'activo',
      notas: abono.notas || '',
    });
    setShowForm(true);
  };

  // Subir ADA/OC desde dentro de la carpeta del rubro → extrae datos y abre form pre-llenado
  const handleUploadADA = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset para permitir re-subir el mismo archivo
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('Solo se aceptan archivos PDF');
      return;
    }
    setUploadingPdf(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const res = await base44.functions.invoke('extractADA', { file_url, tipo_override: 'abono_mensual' });
      const data = res.data?.data;
      if (!data) throw new Error('No se pudo extraer datos del PDF');

      setForm({
        ...EMPTY_FORM,
        rubro: selectedRubro || 'OTROS',
        contratista: data.contratista || '',
        oc_numero: data.oc_numero || '',
        ada_numero: data.ada_numero || '',
        obra_servicio: data.obra_servicio || '',
        emprendimiento: data.emprendimiento || '',
        monto_total_contrato: data.subtotal ? String(Math.round(data.subtotal)) : '',
        fecha_oc_emision: data.fecha_inicio || '',
        plazo_obra: data.plazo_obra || '',
        condiciones_pago: data.condiciones_pago || '',
        items: data.items?.length ? data.items.map(it => ({
          descripcion: it.descripcion || '',
          um: it.um || 'MES',
          cantidad: parseFloat(it.cantidad) || 1,
          importe_unitario: parseMonto(it.importe_unitario),
          importe_total: parseMonto(it.importe_total) || (parseMonto(it.cantidad) * parseMonto(it.importe_unitario)),
        })) : EMPTY_FORM.items,
      });
      setEditingId(null);
      setShowForm(true);
      toast.success('Datos extraídos del PDF — revisá y guardá');
    } catch (e) {
      toast.error('Error al extraer: ' + (e.response?.data?.error || e.message));
    } finally {
      setUploadingPdf(false);
    }
  };

  const handleNuevoEnRubro = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, rubro: selectedRubro || 'OTROS' });
    setShowForm(true);
  };

  // Generar certificados del mes con configuración personalizable
  const handleGenerarMensual = async (params) => {
    setGeneratingMensual(true);
    setMensualResult(null);
    setShowMensualConfig(false);
    try {
      const res = await base44.functions.invoke('generarLoteAbonos', params);
      const data = res.data;
      if (data.success) {
        setMensualResult(data);
        toast.success(`${data.generated} certificado(s) generado(s)`);
        qc.invalidateQueries({ queryKey: ['abonos-maestro'] });
        qc.invalidateQueries({ queryKey: ['certificados'] });
      } else {
        toast.error(data.error || 'Error en la generación');
      }
    } catch (e) {
      toast.error('Error: ' + (e.response?.data?.error || e.message));
    } finally {
      setGeneratingMensual(false);
    }
  };

  const rubroCfg = selectedRubro ? getRubroConfig(selectedRubro) : null;
  const RubroIcon = rubroCfg?.Icon;

  // ── VISTA: CARPETAS POR RUBRO ──────────────────────────────────────────────
  if (view === 'folders') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-primary" />
              Rubros
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">Seleccioná un rubro para gestionar sus abonos o cargar un ADA/OC</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={() => setShowMensualConfig(true)}
              disabled={isLoading || abonos.filter(a => a.estado === 'activo').length === 0}
              className="gap-2 h-8 text-xs bg-gradient-to-r from-emerald-500 to-teal-600 hover:shadow-lg"
            >
              {generatingMensual ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
              {generatingMensual ? 'Generando...' : 'Generar Certificados del Mes'}
            </Button>
            <Button onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setShowForm(true); }} variant="outline" className="gap-2 h-8 text-xs">
              <Plus className="h-3.5 w-3.5" /> Nuevo Abono
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <AbonoRubrosGrid abonos={abonos} onSelect={(rubro) => { setSelectedRubro(rubro); setView('rubro'); setSearch(''); }} />
        )}

        <Dialog open={showForm} onOpenChange={(o) => { if (!o) { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); } }}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                {editingId ? 'Editar Abono Maestro' : 'Nuevo Abono Maestro'}
              </DialogTitle>
            </DialogHeader>
            <AbonoMaestroForm
              form={form}
              setForm={setForm}
              editingId={editingId}
              onSave={() => saveMutation.mutate(form)}
              onCancel={() => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); }}
              isSaving={saveMutation.isPending}
            />
          </DialogContent>
        </Dialog>

        {/* Dialog de resultado de generación mensual */}
        <Dialog open={!!mensualResult} onOpenChange={(o) => { if (!o) setMensualResult(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                Certificados del Mes Generados
              </DialogTitle>
            </DialogHeader>
            {mensualResult && (
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="flex-1 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-emerald-400">{mensualResult.generated}</p>
                    <p className="text-xs text-muted-foreground">Generados</p>
                  </div>
                  <div className="flex-1 bg-muted/40 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-muted-foreground">{mensualResult.skipped}</p>
                    <p className="text-xs text-muted-foreground">Omitidos</p>
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto space-y-3">
                  {(() => {
                    const groups = {};
                    (mensualResult.results || []).forEach(r => {
                      const c = r.comuna || '—';
                      if (!groups[c]) groups[c] = [];
                      groups[c].push(r);
                    });
                    const comunaOrder = ['8A', '8B', '10A', '—'];
                    return comunaOrder.filter(c => groups[c]).map(comuna => {
                      const items = groups[comuna];
                      const subTotal = items.filter(r => r.generated).reduce((acc, r) => acc + parseMonto(r.monto), 0);
                      return (
                        <div key={comuna}>
                          <div className="flex items-center justify-between px-1 mb-1.5">
                            <span className="text-[11px] font-bold text-indigo-300 flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                              Comuna {comuna}
                            </span>
                            <span className="text-[11px] font-semibold text-muted-foreground">{fmt(subTotal)}</span>
                          </div>
                          <div className="space-y-1.5">
                            {items.map((r, i) => (
                              <div key={i} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold truncate">{r.contratista}</p>
                                  <p className="text-[11px] text-muted-foreground">
                                    {r.generated ? `N° ${r.numero} · ${r.mes}` : (r.reason || r.error || 'Omitido')}
                                  </p>
                                </div>
                                {r.generated ? (
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-xs font-bold text-emerald-400">{fmt(r.monto)}</span>
                                    {r.pdf_url && (
                                      <a href={r.pdf_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                                        <FileText className="h-3.5 w-3.5" />
                                      </a>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground shrink-0">—</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
                <Button onClick={() => setMensualResult(null)} className="w-full">Cerrar</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog de configuración de generación mensual */}
        <GeneracionMensualConfig
          open={showMensualConfig}
          onClose={() => setShowMensualConfig(false)}
          abonos={abonos}
          onGenerate={handleGenerarMensual}
          generating={generatingMensual}
        />
      </div>
    );
  }

  // ── VISTA: DETALLE DEL RUBRO ───────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handleUploadADA} />

      {/* Breadcrumb + header del rubro */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => setView('folders')}>
            <ArrowLeft className="h-4 w-4" /> Rubros
          </Button>
          <div className={`h-10 w-10 rounded-xl ${rubroCfg.bg} ${rubroCfg.border} border flex items-center justify-center`}>
            {RubroIcon && <RubroIcon className={`h-5 w-5 ${rubroCfg.color}`} />}
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">{rubroCfg.label}</h2>
            <p className="text-xs text-muted-foreground">{rubroStats.total} abono{rubroStats.total !== 1 ? 's' : ''} · {rubroStats.activos} activo{rubroStats.activos !== 1 ? 's' : ''}</p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          <div className="text-center bg-muted/40 rounded-lg px-3 py-1.5">
            <p className="text-[10px] text-muted-foreground">Total mensual</p>
            <p className="text-sm font-bold text-primary">{fmt(rubroStats.totalMensual)}</p>
          </div>
          {rubroStats.lotesPendientes > 0 && (
            <div className="text-center bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-1.5">
              <p className="text-[10px] text-amber-400">Sin lote</p>
              <p className="text-sm font-bold text-amber-400">{rubroStats.lotesPendientes}</p>
            </div>
          )}
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 w-40 text-sm"
          />
          <Button onClick={handleNuevoEnRubro} variant="outline" className="gap-2 h-8 text-xs">
            <Plus className="h-3.5 w-3.5" /> Nuevo
          </Button>
          <Button
            onClick={() => fileRef.current?.click()}
            disabled={uploadingPdf}
            className="gap-2 h-8 text-xs bg-gradient-to-r from-primary to-blue-600"
          >
            {uploadingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {uploadingPdf ? 'Extrayendo...' : 'Subir ADA / OC'}
          </Button>
        </div>
      </div>

      {/* CTA destacado cuando el rubro está vacío */}
      {rubroStats.total === 0 && (
        <Card className="p-10 text-center border-2 border-dashed border-border">
          <div className={`h-14 w-14 rounded-2xl ${rubroCfg.bg} ${rubroCfg.border} border flex items-center justify-center mx-auto mb-3`}>
            {RubroIcon && <RubroIcon className={`h-7 w-7 ${rubroCfg.color}`} />}
          </div>
          <p className="text-sm font-semibold text-foreground">No hay abonos en {rubroCfg.label}</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">Subí el ADA u OC en PDF y la IA completa los datos del contrato automáticamente</p>
          <Button onClick={() => fileRef.current?.click()} disabled={uploadingPdf} className="gap-2 bg-gradient-to-r from-primary to-blue-600">
            {uploadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {uploadingPdf ? 'Extrayendo datos...' : 'Subir ADA / OC'}
          </Button>
        </Card>
      )}

      {/* Lista de abonos del rubro */}
      {rubroStats.total > 0 && (
        isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground text-sm">Sin resultados para tu búsqueda</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(abono => (
              <AbonoMaestroCard
                key={abono.id}
                abono={abono}
                onEdit={handleEdit}
                onDelete={(id) => deleteMutation.mutate(id)}
              />
            ))}
          </div>
        )
      )}

      {/* Modal formulario */}
      <Dialog open={showForm} onOpenChange={(o) => { if (!o) { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); } }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              {editingId ? 'Editar Abono Maestro' : 'Nuevo Abono Maestro'}
            </DialogTitle>
          </DialogHeader>
          <AbonoMaestroForm
            form={form}
            setForm={setForm}
            editingId={editingId}
            onSave={() => saveMutation.mutate(form)}
            onCancel={() => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); }}
            isSaving={saveMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}