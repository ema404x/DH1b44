import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  FileSpreadsheet, Upload, Trash2, Download, Search,
  Plus, Loader2, FileText, Calendar, Building2
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const ESTADO_COLORS = {
  borrador: 'bg-slate-100 text-slate-700',
  enviado: 'bg-blue-100 text-blue-700',
  aprobado: 'bg-emerald-100 text-emerald-700',
  rechazado: 'bg-red-100 text-red-700',
};

const ESTADO_LABELS = {
  borrador: 'Borrador',
  enviado: 'Enviado',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
};

function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Presupuestos() {
  const queryClient = useQueryClient();
  const fileRef = useRef();
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nombre: '', obra: '', descripcion: '', estado: 'borrador' });
  const [pendingFile, setPendingFile] = useState(null);

  const { data: presupuestos = [], isLoading } = useQuery({
    queryKey: ['presupuestos-excel'],
    queryFn: () => base44.entities.PresupuestoExcel.list('-created_date', 100),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PresupuestoExcel.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presupuestos-excel'] });
      toast.success('Presupuesto eliminado');
    },
  });

  const updateEstadoMutation = useMutation({
    mutationFn: ({ id, estado }) => base44.entities.PresupuestoExcel.update(id, { estado }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presupuestos-excel'] });
      toast.success('Estado actualizado');
    },
  });

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast.error('Solo se aceptan archivos Excel (.xlsx, .xls)');
      return;
    }
    setPendingFile(file);
    setForm(f => ({ ...f, nombre: f.nombre || file.name.replace(/\.(xlsx|xls)$/i, '') }));
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!pendingFile) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: pendingFile });
      await base44.entities.PresupuestoExcel.create({
        ...form,
        archivo_url: file_url,
        archivo_nombre: pendingFile.name,
        archivo_size: pendingFile.size,
      });
      queryClient.invalidateQueries({ queryKey: ['presupuestos-excel'] });
      toast.success('Presupuesto guardado correctamente');
      setShowForm(false);
      setPendingFile(null);
      setForm({ nombre: '', obra: '', descripcion: '', estado: 'borrador' });
      fileRef.current.value = '';
    } catch (err) {
      toast.error('Error al subir el archivo: ' + err.message);
    }
    setUploading(false);
  };

  const handleCancel = () => {
    setShowForm(false);
    setPendingFile(null);
    setForm({ nombre: '', obra: '', descripcion: '', estado: 'borrador' });
    if (fileRef.current) fileRef.current.value = '';
  };

  const filtered = presupuestos.filter(p =>
    p.nombre?.toLowerCase().includes(search.toLowerCase()) ||
    p.obra?.toLowerCase().includes(search.toLowerCase()) ||
    p.archivo_nombre?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Presupuestos de Obra</h1>
          <p className="text-sm text-muted-foreground mt-1">Almacenamiento de presupuestos en formato Excel</p>
        </div>
        <Button onClick={() => fileRef.current?.click()} className="gap-2 self-start sm:self-auto">
          <Plus className="h-4 w-4" /> Subir Presupuesto
        </Button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFileSelect} className="hidden" />
      </div>

      {/* Upload Form */}
      {showForm && pendingFile && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-4 p-3 bg-white rounded-lg border border-border">
              <FileSpreadsheet className="h-8 w-8 text-emerald-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{pendingFile.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(pendingFile.size)}</p>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-700 mb-1 block">Nombre del presupuesto *</label>
                  <Input
                    placeholder="Ej: Presupuesto Escuela Norte"
                    value={form.nombre}
                    onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 mb-1 block">Obra / Proyecto</label>
                  <Input
                    placeholder="Nombre de la obra"
                    value={form.obra}
                    onChange={e => setForm(f => ({ ...f, obra: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 block">Descripción / Notas</label>
                <Input
                  placeholder="Notas adicionales (opcional)"
                  value={form.descripcion}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 block">Estado</label>
                <select
                  value={form.estado}
                  onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
                  className="flex h-9 w-full sm:w-48 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {Object.entries(ESTADO_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={uploading} className="gap-2">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploading ? 'Subiendo...' : 'Guardar'}
                </Button>
                <Button type="button" variant="outline" onClick={handleCancel} disabled={uploading}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar presupuesto..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FileSpreadsheet className="h-16 w-16 text-muted-foreground/20 mb-4" />
          <p className="font-semibold text-slate-600">
            {search ? 'Sin resultados' : 'Sin presupuestos aún'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {search ? 'Ajustá la búsqueda' : 'Subí tu primer presupuesto Excel'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(p => (
            <Card key={p.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-5 space-y-4">
                {/* File icon + name */}
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center flex-shrink-0">
                    <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900 leading-tight truncate">{p.nombre}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{p.archivo_nombre}</p>
                  </div>
                </div>

                {/* Meta */}
                <div className="space-y-1.5">
                  {p.obra && (
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <Building2 className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                      <span className="truncate">{p.obra}</span>
                    </div>
                  )}
                  {p.descripcion && (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <FileText className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                      <span className="truncate">{p.descripcion}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Calendar className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                    <span>{format(new Date(p.created_date), "d 'de' MMMM yyyy", { locale: es })}</span>
                    {p.archivo_size && <span className="text-muted-foreground">· {formatBytes(p.archivo_size)}</span>}
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-1 border-t border-border">
                  <select
                    value={p.estado || 'borrador'}
                    onChange={e => updateEstadoMutation.mutate({ id: p.id, estado: e.target.value })}
                    className={`text-xs font-medium px-2 py-1 rounded-md border-0 cursor-pointer ${ESTADO_COLORS[p.estado || 'borrador']}`}
                  >
                    {Object.entries(ESTADO_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1">
                    <a href={p.archivo_url} target="_blank" rel="noopener noreferrer" download>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-primary">
                        <Download className="h-4 w-4" />
                      </Button>
                    </a>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-500 hover:text-destructive"
                      onClick={() => {
                        if (confirm('¿Eliminar este presupuesto?')) deleteMutation.mutate(p.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}