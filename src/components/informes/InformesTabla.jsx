import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Pencil, Trash2, FileText, CheckCircle2 } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const tipoLabels = {
  avance_obra: 'Avance Obra', inspeccion: 'Inspección', mantenimiento: 'Mantenimiento',
  financiero: 'Financiero', seguridad: 'Seguridad', final: 'Informe Final', otro: 'Otro',
};

export default function InformesTabla({ informes, onEdit, onDelete, isLoading, highlight }) {
  const [search, setSearch] = useState('');

  const filtered = informes.filter(i =>
    !search ||
    i.titulo?.toLowerCase().includes(search.toLowerCase()) ||
    i.proyecto_nombre?.toLowerCase().includes(search.toLowerCase()) ||
    i.cliente_nombre?.toLowerCase().includes(search.toLowerCase())
  );

  const today = new Date();

  const getDaysChip = (informe) => {
    if (!informe.fecha_limite || ['enviado', 'aprobado'].includes(informe.estado)) return null;
    const days = differenceInDays(new Date(informe.fecha_limite), today);
    if (days < 0) return <span className="text-xs font-semibold text-red-600">Vencido</span>;
    if (days === 0) return <span className="text-xs font-semibold text-red-500">Hoy</span>;
    if (days <= 3) return <span className="text-xs font-semibold text-orange-500">{days}d</span>;
    if (days <= 7) return <span className="text-xs font-semibold text-amber-500">{days}d</span>;
    return <span className="text-xs text-muted-foreground">{format(new Date(informe.fecha_limite), 'dd/MM/yy')}</span>;
  };

  if (filtered.length === 0 && !isLoading) {
    return (
      <div className="space-y-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar informes..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <EmptyState icon={FileText} title="No hay informes" description="Creá un nuevo informe para empezar" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar informes..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead className="hidden md:table-cell">Tipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Prioridad</TableHead>
                <TableHead className="hidden md:table-cell">Proyecto / Cliente</TableHead>
                <TableHead className="hidden lg:table-cell">Responsable</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead className="hidden lg:table-cell">Entregado</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(informe => (
                <TableRow key={informe.id} className={`group ${highlight === 'vencido' ? 'bg-red-50/40' : ''}`}>
                  <TableCell>
                    <div className="flex items-start gap-2">
                      <div>
                        <p className="font-medium text-sm">{informe.titulo}</p>
                        {informe.codigo && <p className="text-xs text-muted-foreground font-mono">{informe.codigo}</p>}
                        {informe.requiere_firma && (
                          <span className={`text-xs flex items-center gap-1 mt-0.5 ${informe.firma_obtenida ? 'text-emerald-600' : 'text-amber-600'}`}>
                            <CheckCircle2 className="h-3 w-3" />
                            {informe.firma_obtenida ? 'Firmado' : 'Requiere firma'}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant="outline" className="text-xs">{tipoLabels[informe.tipo] || informe.tipo}</Badge>
                  </TableCell>
                  <TableCell><StatusBadge value={informe.estado} /></TableCell>
                  <TableCell><StatusBadge value={informe.prioridad} type="priority" /></TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="text-sm">
                      {informe.proyecto_nombre && <p className="font-medium">{informe.proyecto_nombre}</p>}
                      {informe.cliente_nombre && <p className="text-xs text-muted-foreground">{informe.cliente_nombre}</p>}
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm">{informe.responsable || '-'}</TableCell>
                  <TableCell>{getDaysChip(informe)}</TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                    {informe.fecha_envio ? format(new Date(informe.fecha_envio), 'dd/MM/yy') : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(informe)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>¿Eliminar informe?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => onDelete(informe.id)}>Eliminar</AlertDialogAction></AlertDialogFooter>
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