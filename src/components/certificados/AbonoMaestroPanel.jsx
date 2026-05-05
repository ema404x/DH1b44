import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, Calendar, DollarSign, Clock, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function calcularFechas(fechaOC, duracionMeses) {
  if (!fechaOC || !duracionMeses) return {};
  const [y, m] = fechaOC.split('-').map(Number);
  // Mes siguiente al de la OC
  let inicioMes = m + 1;
  let inicioYear = y;
  if (inicioMes > 12) { inicioMes = 1; inicioYear++; }
  const fechaInicio = `${inicioYear}-${String(inicioMes).padStart(2, '0')}-01`;

  // Fecha fin: duracion_meses después del inicio
  let finMes = inicioMes + duracionMeses - 1;
  let finYear = inicioYear;
  while (finMes > 12) { finMes -= 12; finYear++; }
  const ultimoDia = new Date(finYear, finMes, 0).getDate();
  const fechaFin = `${finYear}-${String(finMes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

  return { fechaInicio, fechaFin };
}

function formatFecha(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d || '01'}/${m}/${y}`;
}

function getMesPeriodoLabel(dateStr) {
  if (!dateStr) return '';
  const [, m] = dateStr.split('-').map(Number);
  const [y] = dateStr.split('-');
  return `${MESES_ES[m - 1]} ${y}`;
}

// Calcula qué certificado (N° dentro del contrato) corresponde al mes actual
function getCertActualInfo(abono) {
  if (!abono.fecha_inicio_validez) return null;
  const now = new Date();
  const inicioDate = new Date(abono.fecha_inicio_validez + 'T00:00:00');
  const diffMs = now - inicioDate;
  const diffMeses = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.44));
  const certNum = diffMeses + 1;
  if (certNum < 1 || certNum > abono.duracion_meses) return null;
  return certNum;
}

const EMPTY_FORM = {
  contratista: '',
  oc_numero: '',
  ada_numero: '',
  obra_servicio: '',
  emprendimiento: '',
  monto_total_contrato: '',
  fecha_oc_emision: '',
  duracion_meses: '',
  estado: 'activo',
  notas: '',
};

export default function AbonoMaestroPanel() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const queryClient = useQueryClient();

  const { data: abonos = [], isLoading } = useQuery({
    queryKey: ['abonos-maestro'],
    queryFn: () => base44.entities.AbonoMaestro.list('-created_date'),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const parseMonto = (v) => {
    // Quitar todo excepto dígitos y coma, luego reemplazar coma por punto
    const clean = String(v).replace(/\./g, '').replace(',', '.');
    const n = parseFloat(clean);
    return isNaN(n) ? 0 : n;
  };
  const parseEntero = (v) => {
    const n = parseInt(String(v).replace(/\D/g, ''), 10);
    return isNaN(n) ? 0 : n;
  };

  const montoPreview = parseMonto(form.monto_total_contrato);
  const mesesPreview = parseEntero(form.duracion_meses);
  const { fechaInicio, fechaFin } = calcularFechas(form.fecha_oc_emision, mesesPreview);
  const montoMensual = montoPreview && mesesPreview ? montoPreview / mesesPreview : 0;

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const monto = parseMonto(data.monto_total_contrato);
      const meses = parseEntero(data.duracion_meses);
      const { fechaInicio, fechaFin } = calcularFechas(data.fecha_oc_emision, meses);
      const payload = {
        ...data,
        monto_total_contrato: monto,
        duracion_meses: meses,
        monto_mensual: meses > 0 ? monto / meses : 0,
        fecha_inicio_validez: fechaInicio,
        fecha_fin_validez: fechaFin,
        certificados_emitidos: editingId ? undefined : 0,
      };
      if (editingId) {
        return base44.entities.AbonoMaestro.update(editingId, payload);
      }
      return base44.entities.AbonoMaestro.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['abonos-maestro'] });
      toast.success(editingId ? 'Abono actualizado' : 'Abono creado correctamente');
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.AbonoMaestro.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['abonos-maestro'] });
      toast.success('Abono eliminado');
    },
  });

  const handleEdit = (abono) => {
    setEditingId(abono.id);
    setForm({
      contratista: abono.contratista || '',
      oc_numero: abono.oc_numero || '',
      ada_numero: abono.ada_numero || '',
      obra_servicio: abono.obra_servicio || '',
      emprendimiento: abono.emprendimiento || '',
      monto_total_contrato: abono.monto_total_contrato ? String(abono.monto_total_contrato) : '',
      fecha_oc_emision: abono.fecha_oc_emision || '',
      duracion_meses: abono.duracion_meses || '',
      estado: abono.estado || 'activo',
      notas: abono.notas || '',
    });
    setShowForm(true);
  };

  const handleNew = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const estadoColor = {
    activo: 'bg-green-100 text-green-700 border-green-200',
    completado: 'bg-blue-100 text-blue-700 border-blue-200',
    pausado: 'bg-amber-100 text-amber-700 border-amber-200',
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Configurá los contratos de abono mensual. El sistema certificará automáticamente cada mes.
          </p>
        </div>
        <Button onClick={handleNew} className="gap-2">
          <Plus className="h-4 w-4" />
          Nuevo Abono
        </Button>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : abonos.length === 0 ? (
        <Card className="p-12 text-center">
          <AlertCircle className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No hay contratos de abono configurados</p>
          <p className="text-xs text-muted-foreground mt-1">Creá uno para que el sistema genere los certificados automáticamente</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {abonos.map((abono) => {
            const certActual = getCertActualInfo(abono);
            const progreso = abono.duracion_meses > 0
              ? Math.min(100, ((abono.certificados_emitidos || 0) / abono.duracion_meses) * 100)
              : 0;

            return (
              <Card key={abono.id} className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm truncate">{abono.contratista}</h3>
                    {abono.oc_numero && (
                      <p className="text-xs text-muted-foreground mt-0.5">OC N° {abono.oc_numero}</p>
                    )}
                    {abono.emprendimiento && (
                      <p className="text-xs text-muted-foreground">{abono.emprendimiento}</p>
                    )}
                  </div>
                  <Badge className={`text-xs border shrink-0 ${estadoColor[abono.estado] || ''}`}>
                    {abono.estado}
                  </Badge>
                </div>

                {/* Monto y plazo */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/40 rounded-lg p-2.5 text-center">
                    <p className="text-[10px] text-muted-foreground mb-0.5">Monto total</p>
                    <p className="text-xs font-bold text-primary">{fmt(abono.monto_total_contrato)}</p>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-2.5 text-center">
                    <p className="text-[10px] text-muted-foreground mb-0.5">Por mes</p>
                    <p className="text-xs font-bold text-green-600">{fmt(abono.monto_mensual)}</p>
                  </div>
                </div>

                {/* Fechas */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Inicio</span>
                    <span className="font-medium text-foreground">{getMesPeriodoLabel(abono.fecha_inicio_validez)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Fin</span>
                    <span className="font-medium text-foreground">{getMesPeriodoLabel(abono.fecha_fin_validez)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Certificados</span>
                    <span className="font-medium text-foreground">{abono.certificados_emitidos || 0} / {abono.duracion_meses}</span>
                  </div>
                </div>

                {/* Barra de progreso */}
                <div>
                  <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-1.5 rounded-full bg-primary transition-all"
                      style={{ width: `${progreso}%` }}
                    />
                  </div>
                  {certActual && (
                    <p className="text-[10px] text-primary mt-1 font-medium">
                      → Este mes corresponde el certificado N° {certActual}
                    </p>
                  )}
                </div>

                {/* Acciones */}
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-xs h-7" onClick={() => handleEdit(abono)}>
                    <Pencil className="h-3 w-3" />Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => { if (window.confirm('¿Eliminar este abono?')) deleteMutation.mutate(abono.id); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal de formulario */}
      <Dialog open={showForm} onOpenChange={(o) => { if (!o) { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Abono Maestro' : 'Nuevo Abono Maestro'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Contratista *</label>
                <Input placeholder="Nombre del contratista" value={form.contratista} onChange={e => set('contratista', e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">N° Orden de Compra</label>
                <Input placeholder="Ej: OC-1234" value={form.oc_numero} onChange={e => set('oc_numero', e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">N° ADA</label>
                <Input placeholder="Ej: ADA-5678" value={form.ada_numero} onChange={e => set('ada_numero', e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Obra / Servicio</label>
                <Input placeholder="Descripción del servicio" value={form.obra_servicio} onChange={e => set('obra_servicio', e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Emprendimiento</label>
                <Input placeholder="Ej: EDUCACION" value={form.emprendimiento} onChange={e => set('emprendimiento', e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Estado</label>
                <Select value={form.estado} onValueChange={v => set('estado', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="activo">Activo</SelectItem>
                    <SelectItem value="pausado">Pausado</SelectItem>
                    <SelectItem value="completado">Completado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Monto Total Contrato *</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="Ej: 3.060.000"
                  value={form.monto_total_contrato}
                  onChange={e => set('monto_total_contrato', e.target.value)}
                />
                {parseMonto(form.monto_total_contrato) > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">{fmt(parseMonto(form.monto_total_contrato))}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Duración (meses) *</label>
                <Input type="number" min="1" placeholder="Ej: 6" value={form.duracion_meses} onChange={e => set('duracion_meses', e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Fecha de emisión OC *</label>
                <Input type="date" value={form.fecha_oc_emision} onChange={e => set('fecha_oc_emision', e.target.value)} />
              </div>
            </div>

            {/* Preview calculado */}
            {fechaInicio && montoMensual > 0 && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-1.5 text-xs">
                <p className="font-semibold text-primary text-sm">Resumen calculado</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-muted-foreground">Inicio validez:</span>
                    <span className="font-medium ml-1">{getMesPeriodoLabel(fechaInicio)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Fin validez:</span>
                    <span className="font-medium ml-1">{getMesPeriodoLabel(fechaFin)}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Monto mensual a certificar:</span>
                    <span className="font-bold text-green-600 ml-1">{fmt(montoMensual)}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); }}>
                Cancelar
              </Button>
              <Button
                onClick={() => saveMutation.mutate(form)}
                disabled={saveMutation.isPending || !form.contratista || !form.monto_total_contrato || !form.fecha_oc_emision || !form.duracion_meses}
              >
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}