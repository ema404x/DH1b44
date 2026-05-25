import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Plus, Search, FileCheck, DollarSign, Clock, TrendingUp, CheckCircle2,
  AlertCircle, Building2, Download, FileSpreadsheet, RefreshCw, History, RotateCcw
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ObraCertificacionDialog from '@/components/certificacion/ObraCertificacionDialog';
import ObraCertificacionCard from '@/components/certificacion/ObraCertificacionCard';
import ImportarObrasExcel from '@/components/certificacion/ImportarObrasExcel';
import HistorialCiclos from '@/components/certificacion/HistorialCiclos';
import { exportarComunaPDF, exportarFiltradoPDF } from '@/components/certificacion/ExportarComunaPDF';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const ESTADO_CONFIG = {
  listo_certificar:    { label: 'Listo para Certificar',   color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  faltan_actas:        { label: 'Faltan Cargar Actas',     color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  pendiente:           { label: 'Pendiente',               color: 'bg-red-500/15 text-red-400 border-red-500/30' },
  observado:           { label: 'Observado',               color: 'bg-slate-500/15 text-slate-400 border-slate-500/30' },
  falta_aprobar_mein:  { label: 'Falta Aprobar Orden MEIN', color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
};

const PRIORIDAD_CONFIG = {
  normal:  { label: 'Normal',  color: 'bg-slate-500/15 text-slate-400' },
  alta:    { label: 'Alta',    color: 'bg-orange-500/15 text-orange-400' },
  urgente: { label: 'Urgente', color: 'bg-red-500/15 text-red-400' },
};

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

const periodoActual = () => {
  const now = new Date();
  return format(now, 'MMMM yyyy', { locale: es }).replace(/^\w/, c => c.toUpperCase());
};

export default function CertificacionObras() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroComuna, setFiltroComuna] = useState('todas');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [nuevoPeriodo, setNuevoPeriodo] = useState(periodoActual());

  // ── Ciclo activo ──
  const { data: ciclos = [], isLoading: loadingCiclos } = useQuery({
    queryKey: ['ciclos-certificacion'],
    queryFn: () => base44.entities.CicloCertificacion.list('-created_date', 10),
  });

  const cicloActivo = ciclos.find(c => c.activo) || null;

  // ── Obras del ciclo activo ──
  const { data: obras = [], isLoading } = useQuery({
    queryKey: ['obras-certificacion', cicloActivo?.id],
    queryFn: () => cicloActivo
      ? base44.entities.ObraCertificacion.filter({ ciclo_id: cicloActivo.id }, '-created_date', 500)
      : base44.entities.ObraCertificacion.filter({ ciclo_id: null }, '-created_date', 500),
    enabled: !loadingCiclos,
  });

  // ── Mutations ──
  const saveMutation = useMutation({
    mutationFn: (data) => data.id
      ? base44.entities.ObraCertificacion.update(data.id, data)
      : base44.entities.ObraCertificacion.create({ ...data, ciclo_id: cicloActivo?.id || null, ciclo_periodo: cicloActivo?.periodo || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['obras-certificacion'] });
      setDialogOpen(false);
      setSelected(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ObraCertificacion.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['obras-certificacion'] }),
  });

  // ── Iniciar nuevo ciclo ──
  const nuevoCicloMutation = useMutation({
    mutationFn: async (periodo) => {
      const hoy = format(new Date(), 'yyyy-MM-dd');

      // 1. Cerrar ciclo activo
      if (cicloActivo) {
        const listoCert = obras.filter(o => o.estado_cobro === 'listo_certificar').length;
        const montoTotal = obras.reduce((s, o) => s + (o.monto_a_cobrar || 0), 0);
        await base44.entities.CicloCertificacion.update(cicloActivo.id, {
          activo: false,
          fecha_cierre: hoy,
          total_obras: obras.length,
          monto_total: montoTotal,
          listo_certificar: listoCert,
        });
      }

      // 2. Crear nuevo ciclo
      const nuevoCiclo = await base44.entities.CicloCertificacion.create({
        periodo,
        activo: true,
        fecha_inicio: hoy,
        total_obras: 0,
        monto_total: 0,
        listo_certificar: 0,
      });

      return nuevoCiclo;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ciclos-certificacion'] });
      qc.invalidateQueries({ queryKey: ['obras-certificacion'] });
      qc.invalidateQueries({ queryKey: ['ciclos-certificacion-historico'] });
      toast.success('Nuevo ciclo iniciado correctamente');
    },
  });

  const handleNew = () => { setSelected(null); setDialogOpen(true); };
  const handleEdit = (obra) => { setSelected(obra); setDialogOpen(true); };

  const enriquecerObra = (data) => {
    const pct = parseFloat(data.porcentaje_avance) || 0;
    let tramo_certificacion = data.tramo_certificacion || undefined;
    let color_avance = data.color_avance || 'auto';
    if (color_avance === 'auto') {
      if (pct >= 100) { tramo_certificacion = undefined; color_avance = 'verde'; }
      else if (pct > 50) { tramo_certificacion = 'segundo_50'; color_avance = 'naranja'; }
      else if (pct > 0) { tramo_certificacion = 'primer_50'; color_avance = 'amarillo'; }
    }
    return { ...data, tramo_certificacion, color_avance };
  };

  const filtered = obras.filter(o => {
    const matchSearch = !search ||
      o.titulo?.toLowerCase().includes(search.toLowerCase()) ||
      o.establecimiento?.toLowerCase().includes(search.toLowerCase()) ||
      o.direccion?.toLowerCase().includes(search.toLowerCase()) ||
      o.jefe_sitio?.toLowerCase().includes(search.toLowerCase()) ||
      o.inspector?.toLowerCase().includes(search.toLowerCase()) ||
      o.oc_numero?.includes(search) ||
      o.ada_numero?.includes(search);
    const matchEstado = filtroEstado === 'todos'
      ? true
      : filtroEstado === 'no_listo'
        ? o.estado_cobro !== 'listo_certificar'
        : o.estado_cobro === filtroEstado;
    const matchComuna = filtroComuna === 'todas' || o.comuna === filtroComuna;
    return matchSearch && matchEstado && matchComuna;
  });

  // KPIs
  const totalMonto       = obras.reduce((s, o) => s + (o.monto_a_cobrar || 0), 0);
  const listoCertificar  = obras.filter(o => o.estado_cobro === 'listo_certificar').length;
  const faltanActas      = obras.filter(o => o.estado_cobro === 'faltan_actas').length;
  const pendientes       = obras.filter(o => o.estado_cobro === 'pendiente').length;
  const observados       = obras.filter(o => o.estado_cobro === 'observado').length;
  const faltaAprobarMein = obras.filter(o => o.estado_cobro === 'falta_aprobar_mein').length;
  const urgentes         = obras.filter(o => o.prioridad === 'urgente').length;

  const comunas = ['8A', '8B', '10A'];
  const resumenPorComuna = comunas.map(c => {
    const obrasComuna = obras.filter(o => o.comuna === c);
    const montoTotal  = obrasComuna.reduce((s, o) => s + (o.monto_a_cobrar || 0), 0);
    const montoParcial = obrasComuna.filter(o => o.estado_cobro === 'listo_certificar').reduce((s, o) => s + (o.monto_a_cobrar || 0), 0);
    const cantListo   = obrasComuna.filter(o => o.estado_cobro === 'listo_certificar').length;
    return { comuna: c, montoTotal, montoParcial, cantListo, total: obrasComuna.length };
  }).filter(r => r.total > 0);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileCheck className="h-6 w-6 text-primary" />
            Certificación de Obras
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-muted-foreground">Ciclo activo:</p>
            {cicloActivo
              ? <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">{cicloActivo.periodo}</Badge>
              : <Badge variant="outline" className="text-muted-foreground">Sin ciclo activo</Badge>
            }
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button variant="outline" onClick={() => setImportOpen(true)} className="gap-2">
            <FileSpreadsheet className="h-4 w-4" /> Importar Excel
          </Button>
          <Button onClick={handleNew} className="gap-2" disabled={!cicloActivo}>
            <Plus className="h-4 w-4" /> Nueva Obra
          </Button>

          {/* Botón Nuevo Ciclo */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="gap-2 border-amber-500/40 text-amber-400 hover:bg-amber-500/10">
                <RefreshCw className="h-4 w-4" /> Nuevo Ciclo
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Iniciar nuevo ciclo de certificación</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-3">
                    <p>
                      {cicloActivo
                        ? `El ciclo actual "${cicloActivo.periodo}" (${obras.length} obras) pasará al historial y comenzará uno nuevo vacío.`
                        : 'Se creará el primer ciclo de certificación.'}
                    </p>
                    <div>
                      <label className="text-xs font-medium text-foreground block mb-1">Nombre del nuevo período</label>
                      <Input
                        value={nuevoPeriodo}
                        onChange={e => setNuevoPeriodo(e.target.value)}
                        placeholder="Ej: Junio 2026"
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => nuevoCicloMutation.mutate(nuevoPeriodo)}
                  disabled={!nuevoPeriodo.trim() || nuevoCicloMutation.isPending}
                >
                  {nuevoCicloMutation.isPending ? 'Iniciando...' : 'Iniciar nuevo ciclo'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Tabs defaultValue="activo">
        <TabsList>
          <TabsTrigger value="activo" className="gap-2">
            <FileCheck className="h-4 w-4" /> Ciclo Activo
          </TabsTrigger>
          <TabsTrigger value="historial" className="gap-2">
            <History className="h-4 w-4" /> Historial
          </TabsTrigger>
        </TabsList>

        {/* ── TAB CICLO ACTIVO ── */}
        <TabsContent value="activo" className="space-y-5 mt-5">

          {!cicloActivo && !loadingCiclos && (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="p-5 flex items-center gap-4">
                <RotateCcw className="h-6 w-6 text-amber-400 shrink-0" />
                <div>
                  <p className="font-semibold text-amber-300">No hay un ciclo activo</p>
                  <p className="text-sm text-muted-foreground">Usá el botón "Nuevo Ciclo" para crear el primer ciclo de certificación.</p>
                </div>
              </CardContent>
            </Card>
          )}

          {cicloActivo && (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Card className="border-emerald-500/20 bg-emerald-500/5">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <span className="text-xs text-muted-foreground">Listo para Certificar</span>
                    </div>
                    <p className="text-2xl font-bold text-emerald-400">{listoCertificar}</p>
                  </CardContent>
                </Card>
                <Card className="border-yellow-500/20 bg-yellow-500/5">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="h-4 w-4 text-yellow-400" />
                      <span className="text-xs text-muted-foreground">Faltan Actas</span>
                    </div>
                    <p className="text-2xl font-bold text-yellow-400">{faltanActas}</p>
                  </CardContent>
                </Card>
                <Card className="border-red-500/20 bg-red-500/5">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertCircle className="h-4 w-4 text-red-400" />
                      <span className="text-xs text-muted-foreground">Pendiente</span>
                    </div>
                    <p className="text-2xl font-bold text-red-400">{pendientes}</p>
                  </CardContent>
                </Card>
                <Card className="border-slate-500/20 bg-slate-500/5">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="h-4 w-4 text-slate-400" />
                      <span className="text-xs text-muted-foreground">Observados</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-400">{observados}</p>
                  </CardContent>
                </Card>
                <Card className="border-purple-500/20 bg-purple-500/5">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <FileCheck className="h-4 w-4 text-purple-400" />
                      <span className="text-xs text-muted-foreground">Falta Aprobar MEIN</span>
                    </div>
                    <p className="text-2xl font-bold text-purple-400">{faltaAprobarMein}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Filtros */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por obra, establecimiento..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={filtroComuna} onValueChange={setFiltroComuna}>
                  <SelectTrigger className="w-full sm:w-36">
                    <SelectValue placeholder="Comuna" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas las comunas</SelectItem>
                    <SelectItem value="8A">Comuna 8A</SelectItem>
                    <SelectItem value="8B">Comuna 8B</SelectItem>
                    <SelectItem value="10A">Comuna 10A</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                  <SelectTrigger className="w-full sm:w-44">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los estados</SelectItem>
                    <SelectItem value="no_listo">⚠️ No listo para Certificar</SelectItem>
                    <SelectItem value="listo_certificar">Listo para Certificar</SelectItem>
                    <SelectItem value="faltan_actas">Faltan Cargar Actas</SelectItem>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                    <SelectItem value="observado">Observado</SelectItem>
                    <SelectItem value="falta_aprobar_mein">Falta Aprobar Orden MEIN</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  className="gap-2 shrink-0"
                  disabled={filtered.length === 0}
                  onClick={() => exportarFiltradoPDF(
                    filtered.sort((a, b) => {
                      const order = { listo_certificar: 0, faltan_actas: 1, pendiente: 2, observado: 3, falta_aprobar_mein: 4 };
                      return (order[a.estado_cobro] ?? 9) - (order[b.estado_cobro] ?? 9);
                    }),
                    { comuna: filtroComuna, estado: filtroEstado, search }
                  )}
                >
                  <Download className="h-4 w-4" />PDF ({filtered.length})
                </Button>
              </div>

              {/* Resumen por Comuna */}
              {resumenPorComuna.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {resumenPorComuna.map(({ comuna, montoTotal, montoParcial, cantListo, total }) => (
                    <Card key={comuna} className="border-border">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-foreground">Comuna {comuna}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{total} obra{total !== 1 ? 's' : ''}</span>
                            <Button
                              variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary"
                              title={`Descargar PDF Comuna ${comuna}`}
                              onClick={() => exportarComunaPDF(comuna, obras.filter(o => o.comuna === comuna).sort((a, b) => {
                                const order = { listo_certificar: 0, faltan_actas: 1, pendiente: 2, observado: 3 };
                                return (order[a.estado_cobro] ?? 9) - (order[b.estado_cobro] ?? 9);
                              }))}
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Monto total</span>
                            <span className="text-sm font-bold text-foreground">{fmt(montoTotal)}</span>
                          </div>
                          <div className="w-full h-px bg-border" />
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Listo certificar ({cantListo})
                            </span>
                            <span className="text-sm font-bold text-emerald-400">{fmt(montoParcial)}</span>
                          </div>
                          {montoTotal > 0 && (
                            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full transition-all"
                                style={{ width: `${Math.min(100, (montoParcial / montoTotal) * 100)}%` }} />
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {urgentes > 0 && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/5">
                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                  <p className="text-sm text-red-300">
                    Hay <strong>{urgentes}</strong> obra{urgentes > 1 ? 's' : ''} con prioridad urgente.
                  </p>
                </div>
              )}

              {/* Lista */}
              {isLoading ? (
                <div className="flex justify-center py-16">
                  <div className="h-8 w-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <FileCheck className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">No hay obras registradas{search || filtroEstado !== 'todos' ? ' con esos filtros' : ''}.</p>
                  {!search && filtroEstado === 'todos' && (
                    <Button variant="outline" size="sm" className="mt-4" onClick={handleNew}>
                      <Plus className="h-4 w-4 mr-2" /> Agregar primera obra
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid gap-3">
                  {filtered.map(obra => (
                    <ObraCertificacionCard
                      key={obra.id}
                      obra={obra}
                      estadoConfig={ESTADO_CONFIG}
                      prioridadConfig={PRIORIDAD_CONFIG}
                      onEdit={handleEdit}
                      onDelete={() => deleteMutation.mutate(obra.id)}
                      onEstadoChange={(id, estado) => saveMutation.mutate({ id, estado_cobro: estado })}
                      onTramoChange={(id, tramo) => saveMutation.mutate({
                        id,
                        tramo_certificacion: tramo || undefined,
                        color_avance: tramo === 'primer_50' ? 'amarillo' : tramo === 'segundo_50' ? 'naranja' : 'auto',
                      })}
                      onNotasChange={(id, notas) => saveMutation.mutate({ id, notas })}
                      fmt={fmt}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ── TAB HISTORIAL ── */}
        <TabsContent value="historial" className="mt-5">
          <HistorialCiclos />
        </TabsContent>
      </Tabs>

      <ImportarObrasExcel
        open={importOpen}
        onClose={() => setImportOpen(false)}
        cicloId={cicloActivo?.id}
        cicloPeriodo={cicloActivo?.periodo}
        onImported={() => {
          qc.invalidateQueries({ queryKey: ['obras-certificacion'] });
          setImportOpen(false);
        }}
      />

      <ObraCertificacionDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setSelected(null); }}
        obra={selected}
        onSave={(data) => saveMutation.mutate(enriquecerObra(data))}
        saving={saveMutation.isPending}
        estadoConfig={ESTADO_CONFIG}
        prioridadConfig={PRIORIDAD_CONFIG}
      />
    </div>
  );
}