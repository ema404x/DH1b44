import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Search, Plus, Download, Upload, FileText, Pencil, Trash2, Cpu, Zap, Wind, Droplets, Car, Hammer, Building, Shield, Monitor, Sofa, CheckCircle2, Clock } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import AssetFormDialog from '@/components/assets/AssetFormDialog';
import ImportarActivosModal from '@/components/assets/ImportarActivosModal';
import { exportActivosToExcel, exportActivosToPDF } from '@/utils/exportActivosExcel';
import { fmtCurrency } from '@/lib/format';

const typeLabels = {
  equipo_electrico: 'Eléctrico', equipo_mecanico: 'Mecánico', instalacion_hvac: 'HVAC',
  instalacion_sanitaria: 'Sanitario', estructura: 'Estructura', vehiculo: 'Vehículo',
  herramienta: 'Herramienta', sistemas_informaticos: 'Informático', mobiliario: 'Mobiliario',
  seguridad: 'Seguridad', otro: 'Otro',
};
const typeIcons = {
  equipo_electrico: Zap, equipo_mecanico: Hammer, instalacion_hvac: Wind, instalacion_sanitaria: Droplets,
  estructura: Building, vehiculo: Car, herramienta: Hammer, sistemas_informaticos: Monitor,
  mobiliario: Sofa, seguridad: Shield, otro: Cpu,
};
const statusColors = {
  operativo: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  en_mantenimiento: 'bg-amber-100 text-amber-700 border-amber-200',
  fuera_de_servicio: 'bg-red-100 text-red-700 border-red-200',
  baja: 'bg-gray-100 text-gray-500 border-gray-200',
};
const critColors = {
  baja: 'bg-slate-100 text-slate-600', media: 'bg-blue-100 text-blue-700',
  alta: 'bg-orange-100 text-orange-700', critica: 'bg-red-100 text-red-700',
};

export default function ActivosTab() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSede, setFilterSede] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [exportMenu, setExportMenu] = useState(false);
  const qc = useQueryClient();

  const { data: assets = [], isLoading } = useQuery({ queryKey: ['assets'], queryFn: () => base44.entities.Asset.list('-updated_date', 500) });
  const { data: sedes = [] } = useQuery({ queryKey: ['edificios'], queryFn: () => base44.entities.Edificio.list('-updated_date', 500) });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Asset.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assets'] }),
  });

  const sedeName = (id) => sedes.find(s => s.id === id)?.nombre || '';

  const openEdit = (a) => { setEditing(a); setDialogOpen(true); };
  const openNew = () => { setEditing(null); setDialogOpen(true); };

  const getMaintenanceStatus = (asset) => {
    if (!asset.next_maintenance) return null;
    const days = differenceInDays(new Date(asset.next_maintenance), new Date());
    if (days < 0) return { label: `Vencido ${Math.abs(days)}d`, color: 'text-red-600' };
    if (days <= 14) return { label: `En ${days}d`, color: 'text-amber-600' };
    return { label: `En ${days}d`, color: 'text-emerald-600' };
  };

  const filtered = useMemo(() => assets.filter(a => {
    const matchSearch = !search ||
      a.name?.toLowerCase().includes(search.toLowerCase()) ||
      a.code?.toLowerCase().includes(search.toLowerCase()) ||
      a.sede?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || a.status === filterStatus;
    const matchSede = filterSede === 'all' || a.location_id === filterSede;
    const matchType = filterType === 'all' || a.type === filterType;
    return matchSearch && matchStatus && matchSede && matchType;
  }), [assets, search, filterStatus, filterSede, filterType]);

  const stats = {
    total: assets.length,
    operativo: assets.filter(a => a.status === 'operativo').length,
    mantenimiento: assets.filter(a => a.status === 'en_mantenimiento').length,
    vistos: assets.filter(a => a.visto_bapro).length,
  };

  const totalValor = assets.reduce((s, a) => s + (a.purchase_cost || 0), 0);

  return (
    <div className="space-y-5">
      {/* Stats — Executive Suite */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Activos', value: stats.total, color: 'border-l-slate-400' },
          { label: 'Operativos', value: stats.operativo, color: 'border-l-emerald-500' },
          { label: 'En Mantenimiento', value: stats.mantenimiento, color: 'border-l-amber-500' },
          { label: 'Vistos BAPRO', value: stats.vistos, color: 'border-l-blue-500' },
        ].map(s => (
          <Card key={s.label} className={`border-l-4 ${s.color}`}>
            <CardContent className="pt-4 pb-3">
              <div className="text-2xl font-bold tabular-nums">{s.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nombre, código, sede..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterSede} onValueChange={setFilterSede}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Sede" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las sedes</SelectItem>
            {sedes.map(s => <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {Object.entries(typeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="operativo">Operativo</SelectItem>
            <SelectItem value="en_mantenimiento">En Mantenimiento</SelectItem>
            <SelectItem value="fuera_de_servicio">Fuera de Servicio</SelectItem>
            <SelectItem value="baja">Baja</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" className="gap-1.5" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4" /> <span className="hidden sm:inline">Importar</span>
          </Button>
          <div className="relative">
            <Button variant="outline" className="gap-1.5" onClick={() => setExportMenu(v => !v)}>
              <Download className="h-4 w-4" /> <span className="hidden sm:inline">Exportar</span>
            </Button>
            {exportMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setExportMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-md border bg-popover shadow-lg">
                  <button className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2" onClick={() => { exportActivosToExcel(filtered, sedes); setExportMenu(false); }}>
                    <FileText className="h-4 w-4" /> Excel
                  </button>
                  <button className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2" onClick={() => { exportActivosToPDF(filtered, sedes); setExportMenu(false); }}>
                    <FileText className="h-4 w-4" /> PDF
                  </button>
                </div>
              </>
            )}
          </div>
          <Button onClick={openNew} className="gap-1.5"><Plus className="h-4 w-4" /> <span className="hidden sm:inline">Nuevo</span></Button>
        </div>
      </div>

      {/* Tabla densa */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2.5 font-medium">Activo</th>
                  <th className="px-3 py-2.5 font-medium hidden md:table-cell">Sede</th>
                  <th className="px-3 py-2.5 font-medium hidden lg:table-cell">Tipo</th>
                  <th className="px-3 py-2.5 font-medium">Estado</th>
                  <th className="px-3 py-2.5 font-medium hidden lg:table-cell">Criticidad</th>
                  <th className="px-3 py-2.5 font-medium hidden xl:table-cell">Mant.</th>
                  <th className="px-3 py-2.5 font-medium">BAPRO</th>
                  <th className="px-3 py-2.5 font-medium hidden lg:table-cell text-right">Valor</th>
                  <th className="px-3 py-2.5 font-medium w-20"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(asset => {
                  const Icon = typeIcons[asset.type] || Cpu;
                  const maint = getMaintenanceStatus(asset);
                  return (
                    <tr key={asset.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => openEdit(asset)}>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Icon className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-sm leading-tight truncate max-w-[200px]">{asset.name}</div>
                            <div className="text-[11px] text-muted-foreground font-mono">{asset.code || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 hidden md:table-cell text-xs text-muted-foreground truncate max-w-[160px]">{sedeName(asset.location_id) || asset.sede || '—'}</td>
                      <td className="px-3 py-2.5 hidden lg:table-cell text-xs">{typeLabels[asset.type] || 'Otro'}</td>
                      <td className="px-3 py-2.5">
                        <Badge variant="outline" className={`text-[10px] ${statusColors[asset.status]}`}>{(asset.status || '').replace('_', ' ')}</Badge>
                      </td>
                      <td className="px-3 py-2.5 hidden lg:table-cell">
                        <Badge className={`text-[10px] ${critColors[asset.criticality]}`}>{asset.criticality}</Badge>
                      </td>
                      <td className="px-3 py-2.5 hidden xl:table-cell text-[11px]">
                        {maint ? (
                          <span className={`flex items-center gap-1 ${maint.color}`}><Clock className="h-3 w-3" />{maint.label}</span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        {asset.visto_bapro ? (
                          <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Visto
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">Pendiente</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 hidden lg:table-cell text-right text-xs tabular-nums">{asset.purchase_cost ? fmtCurrency(asset.purchase_cost) : '—'}</td>
                      <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-0.5">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(asset)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>¿Eliminar activo?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMutation.mutate(asset.id)}>Eliminar</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {filtered.length === 0 && !isLoading && (
                <tfoot><tr><td colSpan={9} className="text-center py-12 text-muted-foreground">
                  <Cpu className="h-10 w-10 mx-auto mb-2 opacity-20" />
                  <p className="text-sm font-medium">No se encontraron activos</p>
                </td></tr></tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      {totalValor > 0 && (
        <div className="text-xs text-muted-foreground">
          Valor total del inventario: <span className="font-semibold text-foreground tabular-nums">{fmtCurrency(totalValor)}</span> · {filtered.length} de {assets.length} activos mostrados
        </div>
      )}

      <AssetFormDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} sedes={sedes} />
      <ImportarActivosModal open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}