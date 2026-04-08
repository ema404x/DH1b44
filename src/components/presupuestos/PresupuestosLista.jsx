import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Pencil, Trash2, FileSpreadsheet, Download, Loader2, Plus, Building2, Calendar, TrendingUp, FilePlus2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { generatePresupuestoPDF } from '@/components/presupuestos/presupuestoPDF';
import { exportPresupuestoExcel } from '@/utils/exportExcel';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

const estadoConfig = {
  borrador:  { label: 'Borrador',  className: 'bg-slate-100 text-slate-600 border-slate-200' },
  enviado:   { label: 'Enviado',   className: 'bg-blue-100 text-blue-700 border-blue-200' },
  aprobado:  { label: 'Aprobado',  className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  rechazado: { label: 'Rechazado', className: 'bg-red-100 text-red-700 border-red-200' },
  facturado: { label: 'Facturado', className: 'bg-purple-100 text-purple-700 border-purple-200' },
};

const comunaConfig = {
  '8A':  'bg-blue-50 text-blue-700 border-blue-200',
  '8B':  'bg-emerald-50 text-emerald-700 border-emerald-200',
  '10A': 'bg-violet-50 text-violet-700 border-violet-200',
};

export default function PresupuestosLista({ presupuestos, isLoading, onEdit, onDelete, onNew }) {
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('todos');
  const [exporting, setExporting] = useState(null);

  const handleExportPCP = async (e, p) => {
    e.stopPropagation();
    setExporting(`pcp-${p.id}`);
    try {
      const res = await base44.functions.invoke('exportPresupuestoPCP', { presupuestoId: p.id });
      if (res.data?.file_url) {
        const a = document.createElement('a');
        a.href = res.data.file_url;
        a.download = `PCP_${p.codigo || p.titulo}_MEJORES.xlsx`;
        a.click();
        toast.success('Excel PCP generado');
      } else {
        toast.error(res.data?.error || 'Error al generar Excel PCP');
      }
    } catch (err) {
      toast.error('Error: ' + err.message);
    } finally {
      setExporting(null);
    }
  };

  const handleExportPDF = (e, p) => {
    e.stopPropagation();
    generatePresupuestoPDF(p);
  };

  const handleExportExcel = (e, p) => {
    e.stopPropagation();
    exportPresupuestoExcel(p);
  };

  // Stats
  const total = presupuestos.reduce((a, p) => a + (p.total || 0), 0);
  const aprobados = presupuestos.filter(p => p.estado === 'aprobado');
  const totalAprobado = aprobados.reduce((a, p) => a + (p.total || 0), 0);
  const borradores = presupuestos.filter(p => p.estado === 'borrador').length;

  const filtered = presupuestos.filter(p => {
    const matchSearch = !search ||
      p.titulo?.toLowerCase().includes(search.toLowerCase()) ||
      p.cliente_nombre?.toLowerCase().includes(search.toLowerCase()) ||
      p.codigo?.toLowerCase().includes(search.toLowerCase()) ||
      p.licitacion?.toLowerCase().includes(search.toLowerCase());
    const matchEstado = estadoFilter === 'todos' || p.estado === estadoFilter;
    return matchSearch && matchEstado;
  });

  return (
    <div className="space-y-5">
      {/* Stats bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-slate-50 to-white border-slate-200">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total presupuestos</p>
                <p className="text-2xl font-bold mt-1">{presupuestos.length}</p>
              </div>
              <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center">
                <FileSpreadsheet className="h-4 w-4 text-slate-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-100">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Aprobados</p>
                <p className="text-2xl font-bold mt-1 text-emerald-700">{aprobados.length}</p>
                <p className="text-xs text-emerald-600 mt-0.5">{fmt(totalAprobado)}</p>
              </div>
              <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Monto total</p>
                <p className="text-lg font-bold mt-1 text-blue-700 leading-tight">{fmt(total)}</p>
              </div>
              <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center">
                <Building2 className="h-4 w-4 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-100">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">En borrador</p>
                <p className="text-2xl font-bold mt-1 text-amber-700">{borradores}</p>
              </div>
              <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center">
                <FilePlus2 className="h-4 w-4 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, cliente, código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {['todos', 'borrador', 'enviado', 'aprobado', 'rechazado'].map(e => (
            <button
              key={e}
              onClick={() => setEstadoFilter(e)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize ${
                estadoFilter === e
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {e === 'todos' ? 'Todos' : estadoConfig[e]?.label}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={onNew} className="gap-1.5 ml-auto">
          <Plus className="h-3.5 w-3.5" /> Nuevo Presupuesto
        </Button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <FileSpreadsheet className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-base mb-1">
              {presupuestos.length === 0 ? 'Sin presupuestos aún' : 'Sin resultados'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {presupuestos.length === 0
                ? 'Creá tu primer presupuesto basado en el preciario ministerial.'
                : 'Probá con otros filtros o términos de búsqueda.'}
            </p>
            {presupuestos.length === 0 && (
              <Button onClick={onNew} className="gap-2"><Plus className="h-4 w-4" />Nuevo Presupuesto</Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="text-xs font-semibold">Código</TableHead>
                  <TableHead className="text-xs font-semibold">Título / Proyecto</TableHead>
                  <TableHead className="hidden md:table-cell text-xs font-semibold">Cliente</TableHead>
                  <TableHead className="hidden lg:table-cell text-xs font-semibold">Licitación</TableHead>
                  <TableHead className="hidden md:table-cell text-xs font-semibold">Comuna</TableHead>
                  <TableHead className="text-xs font-semibold">Estado</TableHead>
                  <TableHead className="hidden lg:table-cell text-xs font-semibold">Fecha</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Total</TableHead>
                  <TableHead className="w-28 text-xs font-semibold text-center">Exportar</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(p => {
                  const estado = estadoConfig[p.estado] || estadoConfig.borrador;
                  return (
                    <TableRow key={p.id} className="group cursor-pointer hover:bg-primary/[0.02]" onClick={() => onEdit(p)}>
                      <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">{p.codigo || '—'}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-semibold text-sm leading-snug">{p.titulo}</p>
                          {p.proyecto_nombre && <p className="text-xs text-muted-foreground mt-0.5">{p.proyecto_nombre}</p>}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{p.cliente_nombre || '—'}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {p.licitacion
                          ? <span className="text-xs text-muted-foreground font-mono truncate max-w-[150px] block">{p.licitacion}</span>
                          : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {p.comuna && p.comuna !== 'otro'
                          ? <Badge variant="outline" className={`text-xs ${comunaConfig[p.comuna] || ''}`}>{p.comuna}</Badge>
                          : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${estado.className}`}>{estado.label}</Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3 w-3" />
                          {p.fecha_emision ? format(new Date(p.fecha_emision + 'T00:00:00'), 'dd MMM yy', { locale: es }) : '—'}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold text-base">{fmt(p.total)}</TableCell>

                      {/* Botones exportar */}
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-slate-800"
                            onClick={(e) => handleExportPDF(e, p)} title="Exportar PDF"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 text-blue-600 hover:text-blue-800"
                            onClick={(e) => handleExportExcel(e, p)} title="Exportar Excel Ministerio"
                          >
                            <FileSpreadsheet className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 text-emerald-600 hover:text-emerald-800"
                            onClick={(e) => handleExportPCP(e, p)}
                            disabled={exporting === `pcp-${p.id}`}
                            title="Exportar formato PCP Ministerio"
                          >
                            {exporting === `pcp-${p.id}`
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <span className="text-[10px] font-bold">PCP</span>}
                          </Button>
                        </div>
                      </TableCell>

                      {/* Acciones */}
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(p)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar presupuesto?</AlertDialogTitle>
                                <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => onDelete(p.id)}>Eliminar</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="px-4 py-2.5 border-t text-xs text-muted-foreground">
            {filtered.length} presupuesto{filtered.length !== 1 ? 's' : ''}
            {filtered.length !== presupuestos.length && ` de ${presupuestos.length}`}
          </div>
        </Card>
      )}
    </div>
  );
}