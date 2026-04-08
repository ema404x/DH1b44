import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Pencil, Trash2, FileSpreadsheet, Download, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

const estadoColors = {
  borrador: 'bg-gray-100 text-gray-700',
  enviado: 'bg-blue-100 text-blue-700',
  aprobado: 'bg-emerald-100 text-emerald-700',
  rechazado: 'bg-red-100 text-red-700',
  facturado: 'bg-purple-100 text-purple-700',
};

export default function PresupuestosLista({ presupuestos, isLoading, onEdit, onDelete }) {
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(null);

  const handleExportPCP = async (e, presupuesto) => {
    e.stopPropagation();
    setExporting(presupuesto.id);
    try {
      const res = await base44.functions.invoke('exportPresupuestoPCP', { presupuestoId: presupuesto.id });
      if (res.data?.file_url) {
        const a = document.createElement('a');
        a.href = res.data.file_url;
        a.download = `PCP_${presupuesto.codigo || presupuesto.titulo}_MEJORES.xlsx`;
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

  const filtered = presupuestos.filter(p =>
    !search ||
    p.titulo?.toLowerCase().includes(search.toLowerCase()) ||
    p.cliente_nombre?.toLowerCase().includes(search.toLowerCase()) ||
    p.codigo?.toLowerCase().includes(search.toLowerCase())
  );

  if (!isLoading && filtered.length === 0) {
    return (
      <div className="space-y-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar presupuestos..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <EmptyState icon={FileSpreadsheet} title="Sin presupuestos" description="Creá tu primer presupuesto de obra basado en el precario ministerial." />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar presupuestos..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Título</TableHead>
                <TableHead className="hidden md:table-cell">Cliente</TableHead>
                <TableHead className="hidden md:table-cell">Proyecto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="hidden lg:table-cell">Fecha</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(p => (
                <TableRow key={p.id} className="group cursor-pointer" onClick={() => onEdit(p)}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{p.codigo || '-'}</TableCell>
                  <TableCell className="font-medium">{p.titulo}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm">{p.cliente_nombre}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{p.proyecto_nombre || '-'}</TableCell>
                  <TableCell>
                    <Badge className={`text-xs ${estadoColors[p.estado]}`}>{p.estado}</Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                    {p.fecha_emision ? format(new Date(p.fecha_emision), 'dd/MM/yy') : '-'}
                  </TableCell>
                  <TableCell className="text-right font-semibold">{fmt(p.total)}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                   <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                     <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(p)}>
                       <Pencil className="h-3.5 w-3.5" />
                     </Button>
                     <Button
                       variant="ghost" size="icon" className="h-7 w-7 text-green-700"
                       onClick={(e) => handleExportPCP(e, p)}
                       disabled={exporting === p.id}
                       title="Exportar Excel formato PCP Ministerio"
                     >
                       {exporting === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
                     </Button>
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>¿Eliminar presupuesto?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => onDelete(p.id)}>Eliminar</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}