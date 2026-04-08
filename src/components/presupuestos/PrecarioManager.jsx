import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Upload, Pencil, Trash2, Loader2, Search, RefreshCw, AlertTriangle } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

const COMUNAS = ['8A', '8B', '10A'];
const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

const emptyItem = {
  codigo: '', descripcion: '', unidad: 'UN', categoria: '', subcategoria: '',
  comuna: '8A', pu_mat: 0, pu_mo: 0, coef_pase: 1.6504, coef_oferta: 1.38,
  total_coef_pase: 0, total_coef_oferta: 0, activo: true
};

export default function PrecarioManager() {
  const [comunaTab, setComunaTab] = useState('8A');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyItem);
  const [search, setSearch] = useState('');
  const [importing, setImporting] = useState(false);
  const [importComuna, setImportComuna] = useState('8A');
  const fileRef = useRef();
  const qc = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['precario', comunaTab],
    queryFn: () => base44.entities.PrecarioMinisterio.filter({ comuna: comunaTab }, 'codigo', 2000),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editing
      ? base44.entities.PrecarioMinisterio.update(editing.id, data)
      : base44.entities.PrecarioMinisterio.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['precario'] });
      setDialogOpen(false);
      toast.success('Ítem guardado');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PrecarioMinisterio.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['precario'] }); toast.success('Ítem eliminado'); },
  });

  const openNew = () => { setEditing(null); setForm({ ...emptyItem, comuna: comunaTab }); setDialogOpen(true); };
  const openEdit = (item) => { setEditing(item); setForm({ ...item }); setDialogOpen(true); };
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    toast.info(`Importando preciario ${importComuna}... esto puede tardar 1-2 minutos`);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const res = await base44.functions.invoke('importPrecario', { file_url, comuna: importComuna });
      if (res.data?.success) {
        qc.invalidateQueries({ queryKey: ['precario'] });
        setComunaTab(importComuna);
        toast.success(res.data.message);
      } else {
        toast.error(res.data?.error || 'Error al importar');
      }
    } catch (err) {
      toast.error('Error al importar: ' + err.message);
    } finally {
      setImporting(false);
      fileRef.current.value = '';
    }
  };

  const filtered = items.filter(i =>
    !search ||
    i.descripcion?.toLowerCase().includes(search.toLowerCase()) ||
    i.codigo?.toLowerCase().includes(search.toLowerCase()) ||
    i.categoria?.toLowerCase().includes(search.toLowerCase()) ||
    i.subcategoria?.toLowerCase().includes(search.toLowerCase())
  );

  const comunaColor = { '8A': 'bg-blue-100 text-blue-800', '8B': 'bg-green-100 text-green-800', '10A': 'bg-purple-100 text-purple-800' };

  return (
    <div className="space-y-4">
      {/* Import panel */}
      <Card className="border-dashed border-amber-300 bg-amber-50/50">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2 text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="text-sm font-medium">Importar preciario desde Excel del Ministerio (.xlsx)</span>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <Select value={importComuna} onValueChange={setImportComuna}>
                <SelectTrigger className="w-24 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COMUNAS.map(c => <SelectItem key={c} value={c}>Comuna {c}</SelectItem>)}
                </SelectContent>
              </Select>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
              <Button variant="outline" size="sm" onClick={() => fileRef.current.click()} disabled={importing}
                className="border-amber-400 bg-amber-100 hover:bg-amber-200 text-amber-900">
                {importing
                  ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Importando...</>
                  : <><Upload className="h-3.5 w-3.5 mr-1.5" />Subir Excel</>}
              </Button>
            </div>
          </div>
          <p className="text-xs text-amber-700 mt-2">
            Seleccioná la comuna, luego subí el archivo Excel del ministerio (hoja PREMOD). Reemplazará el preciario de esa comuna.
          </p>
        </CardContent>
      </Card>

      {/* Tabs por comuna */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        {COMUNAS.map(c => (
          <button key={c} onClick={() => setComunaTab(c)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${comunaTab === c ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            Comuna {c}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Preciario Ministerio — Comuna {comunaTab}</CardTitle>
              <Badge className={comunaColor[comunaTab]}>{items.length} ítems</Badge>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ['precario'] })}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" onClick={openNew}><Plus className="h-3.5 w-3.5 mr-1" />Agregar ítem</Button>
            </div>
          </div>
          <div className="relative max-w-sm mt-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Buscar código, descripción, categoría..." value={search}
              onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">Código</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="w-24">Categoría</TableHead>
                    <TableHead className="w-16">UM</TableHead>
                    <TableHead className="text-right w-32">PU MAT ($)</TableHead>
                    <TableHead className="text-right w-32">PU MO ($)</TableHead>
                    <TableHead className="text-right w-36">Total c/pase</TableHead>
                    <TableHead className="text-right w-36">Total oferta</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 200).map(item => (
                    <TableRow key={item.id} className="group text-xs">
                      <TableCell className="font-mono text-muted-foreground">{item.codigo || '-'}</TableCell>
                      <TableCell className="font-medium max-w-xs truncate" title={item.descripcion}>{item.descripcion}</TableCell>
                      <TableCell>
                        {item.categoria && <Badge variant="outline" className="text-xs">{item.categoria}</Badge>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{item.unidad}</TableCell>
                      <TableCell className="text-right">{fmt(item.pu_mat)}</TableCell>
                      <TableCell className="text-right">{fmt(item.pu_mo)}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(item.total_coef_pase)}</TableCell>
                      <TableCell className="text-right font-bold text-primary">{fmt(item.total_coef_oferta)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(item)}><Pencil className="h-3 w-3" /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive"><Trash2 className="h-3 w-3" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>¿Eliminar ítem?</AlertDialogTitle><AlertDialogDescription>Se eliminará del preciario.</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate(item.id)}>Eliminar</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length > 200 && (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground text-xs py-2">Mostrando 200 de {filtered.length} resultados. Filtrá para ver más.</TableCell></TableRow>
                  )}
                  {filtered.length === 0 && !isLoading && (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-16 text-sm">
                      {items.length === 0 ? 'Importá el preciario del ministerio usando el botón de arriba.' : 'No hay resultados para tu búsqueda.'}
                    </TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Editar ítem del preciario' : 'Nuevo ítem del preciario'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Código</Label><Input value={form.codigo} onChange={e => set('codigo', e.target.value)} placeholder="GNPR001" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Unidad</Label><Input value={form.unidad} onChange={e => set('unidad', e.target.value)} placeholder="M2" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Comuna</Label>
                <Select value={form.comuna} onValueChange={v => set('comuna', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{COMUNAS.map(c => <SelectItem key={c} value={c}>Comuna {c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Descripción *</Label><Input value={form.descripcion} onChange={e => set('descripcion', e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Categoría</Label><Input value={form.categoria} onChange={e => set('categoria', e.target.value)} placeholder="DEMOLICIONES" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Sub-categoría</Label><Input value={form.subcategoria} onChange={e => set('subcategoria', e.target.value)} placeholder="PRELIMINARES" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">PU Materiales ($)</Label><Input type="number" value={form.pu_mat} onChange={e => set('pu_mat', parseFloat(e.target.value) || 0)} /></div>
              <div className="space-y-1.5"><Label className="text-xs">PU Mano de Obra ($)</Label><Input type="number" value={form.pu_mo} onChange={e => set('pu_mo', parseFloat(e.target.value) || 0)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Coef. Pase</Label><Input type="number" step="0.0001" value={form.coef_pase} onChange={e => set('coef_pase', parseFloat(e.target.value) || 1.6504)} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Coef. Oferta</Label><Input type="number" step="0.01" value={form.coef_oferta} onChange={e => set('coef_oferta', parseFloat(e.target.value) || 1.38)} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending || !form.descripcion}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}