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
import { Plus, Upload, Pencil, Trash2, Loader2, Search } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

const categorias = ['albañileria','electricidad','plomeria','pintura','carpinteria','herreria','climatizacion','movimiento_suelos','estructuras','varios'];
const unidades = ['m2','m3','ml','kg','unidad','gl','hs','bolsa','litro','juego'];
const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n || 0);

const emptyItem = { codigo: '', descripcion: '', unidad: 'unidad', categoria: 'varios', precio_unitario: 0, activo: true };

export default function PrecarioManager() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyItem);
  const [search, setSearch] = useState('');
  const [importing, setImporting] = useState(false);
  const fileRef = useRef();
  const qc = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['precario'],
    queryFn: () => base44.entities.PrecarioMinisterio.list(),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editing
      ? base44.entities.PrecarioMinisterio.update(editing.id, data)
      : base44.entities.PrecarioMinisterio.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['precario'] }); setDialogOpen(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PrecarioMinisterio.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['precario'] }),
  });

  const openNew = () => { setEditing(null); setForm(emptyItem); setDialogOpen(true); };
  const openEdit = (item) => { setEditing(item); setForm({ ...item }); setDialogOpen(true); };
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  codigo: { type: 'string' },
                  descripcion: { type: 'string' },
                  unidad: { type: 'string' },
                  categoria: { type: 'string' },
                  precio_unitario: { type: 'number' },
                }
              }
            }
          }
        }
      });
      if (result.status === 'success' && result.output?.items?.length > 0) {
        const records = result.output.items.map(i => ({ ...emptyItem, ...i, activo: true }));
        await base44.entities.PrecarioMinisterio.bulkCreate(records);
        qc.invalidateQueries({ queryKey: ['precario'] });
        toast.success(`${records.length} ítems importados correctamente`);
      } else {
        toast.error('No se pudieron extraer ítems del archivo');
      }
    } catch (err) {
      toast.error('Error al importar archivo');
    } finally {
      setImporting(false);
      fileRef.current.value = '';
    }
  };

  const filtered = items.filter(i =>
    !search ||
    i.descripcion?.toLowerCase().includes(search.toLowerCase()) ||
    i.codigo?.toLowerCase().includes(search.toLowerCase()) ||
    i.categoria?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-base">Ítems del Precario Ministerial</CardTitle>
            <div className="flex gap-2">
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleImport} />
              <Button variant="outline" size="sm" onClick={() => fileRef.current.click()} disabled={importing}>
                {importing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
                Importar Excel/CSV
              </Button>
              <Button size="sm" onClick={openNew}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Agregar ítem
              </Button>
            </div>
          </div>
          <div className="relative max-w-sm mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Buscar en precario..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Unidad</TableHead>
                  <TableHead className="text-right">Precio Unit.</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(item => (
                  <TableRow key={item.id} className="group">
                    <TableCell className="font-mono text-xs text-muted-foreground">{item.codigo || '-'}</TableCell>
                    <TableCell className="text-sm font-medium">{item.descripcion}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs capitalize">{item.categoria}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{item.unidad}</TableCell>
                    <TableCell className="text-right font-semibold text-sm">{fmt(item.precio_unitario)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}><Pencil className="h-3 w-3" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3 w-3" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>¿Eliminar ítem?</AlertDialogTitle><AlertDialogDescription>Se eliminará del precario.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate(item.id)}>Eliminar</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10 text-sm">No hay ítems. Importá un archivo o agregá manualmente.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Editar ítem' : 'Nuevo ítem del precario'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Código</Label><Input value={form.codigo} onChange={e => set('codigo', e.target.value)} placeholder="01.02.03" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Unidad</Label>
                <Select value={form.unidad} onValueChange={v => set('unidad', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{unidades.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Descripción *</Label><Input value={form.descripcion} onChange={e => set('descripcion', e.target.value)} required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Categoría</Label>
                <Select value={form.categoria} onValueChange={v => set('categoria', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{categorias.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Precio Unitario ($)</Label><Input type="number" value={form.precio_unitario} onChange={e => set('precio_unitario', parseFloat(e.target.value) || 0)} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}