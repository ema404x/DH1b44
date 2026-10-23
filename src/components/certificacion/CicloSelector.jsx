import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Archive, Clock, Lock, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

/**
 * CicloSelector
 * Props:
 *  - cicloActivo: string (ej: "Mayo 2026") — el ciclo que se está viendo
 *  - ciclosDisponibles: string[] — lista de todos los ciclos con registros
 *  - onCambiarCiclo: (ciclo: string | 'activo') => void
 *  - obrasActivas: ObraCertificacion[] — solo las activas (sin archivar)
 */
export default function CicloSelector({ cicloActivo, ciclosDisponibles, onCambiarCiclo, obrasActivas, canClose = false }) {
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [nuevoCicloNombre, setNuevoCicloNombre] = useState(() => {
    const now = new Date();
    return format(now, 'MMMM yyyy', { locale: es })
      .replace(/^\w/, c => c.toUpperCase());
  });

  // Cierra el ciclo activo: marca todos los registros activos como archivados con el nombre del ciclo
  const cerrarCicloMutation = useMutation({
    mutationFn: async () => {
      for (const obra of obrasActivas) {
        await base44.functions.invoke('gestionarObrasCertificacion', {
          action: 'update',
          id: obra.id,
          data: { ciclo: nuevoCicloNombre, ciclo_archivado: true },
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['obras-certificacion'] });
      setConfirmOpen(false);
      onCambiarCiclo('activo');
      toast.success(`Ciclo "${nuevoCicloNombre}" archivado correctamente`);
    },
    onError: (err) => {
      toast.error(err?.response?.data?.error || err?.message || 'No se pudo archivar el ciclo');
    },
  });

  // Limpia el ciclo activo: elimina permanentemente las obras actuales (no archivadas) del sector
  const limpiarCicloMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('gestionarObrasCertificacion', {
        action: 'clearActiveCycle',
      });
      if (!res?.data?.success) {
        throw new Error(res?.data?.error || 'No se pudo limpiar el ciclo actual');
      }
      return res.data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['obras-certificacion'] });
      setClearConfirmOpen(false);
      onCambiarCiclo('activo');
      toast.success(`Se eliminaron ${data.deleted} obra(s) del ciclo actual`);
    },
    onError: (err) => {
      qc.invalidateQueries({ queryKey: ['obras-certificacion'] });
      toast.error(err?.response?.data?.error || err?.message || 'Error al limpiar el ciclo actual');
    },
  });

  const esVistaCicloArchivado = cicloActivo !== 'activo';

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Selector de ciclo */}
      <Select value={cicloActivo} onValueChange={onCambiarCiclo}>
        <SelectTrigger className="h-9 w-44 text-sm gap-2">
          {esVistaCicloArchivado
            ? <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            : <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
          }
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="activo">
            <span className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-primary" />
              Ciclo activo
            </span>
          </SelectItem>
          {ciclosDisponibles.length > 0 && (
            <>
              <div className="px-2 py-1 text-xs text-muted-foreground border-t border-border mt-1 pt-2">
                Ciclos archivados
              </div>
              {ciclosDisponibles.map(c => (
                <SelectItem key={c} value={c}>
                  <span className="flex items-center gap-2">
                    <Archive className="h-3.5 w-3.5 text-muted-foreground" />
                    {c}
                  </span>
                </SelectItem>
              ))}
            </>
          )}
        </SelectContent>
      </Select>

      {/* Acciones de ciclo — solo admin y en ciclo activo */}
      {canClose && !esVistaCicloArchivado && obrasActivas.length > 0 && (
        <>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2 text-xs shrink-0"
            onClick={() => setConfirmOpen(true)}
          >
            <Archive className="h-3.5 w-3.5" />
            Cerrar ciclo
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2 text-xs shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setClearConfirmOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Limpiar ciclo actual ({obrasActivas.length})
          </Button>
        </>
      )}

      {/* Badge lectura solo */}
      {esVistaCicloArchivado && (
        <Badge variant="outline" className="text-xs gap-1 text-muted-foreground shrink-0">
          <Lock className="h-3 w-3" /> Solo lectura
        </Badge>
      )}

      {/* Diálogo de confirmación de archivar ciclo */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5 text-primary" />
              Cerrar ciclo activo
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Se van a archivar <strong className="text-foreground">{obrasActivas.length} obras</strong> en el ciclo
              que indiques. Podrás consultarlas en cualquier momento, pero no modificarlas.
              El ciclo activo quedará vacío para empezar el nuevo período.
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Nombre del ciclo (ej: Mayo 2026)</label>
              <Input
                value={nuevoCicloNombre}
                onChange={e => setNuevoCicloNombre(e.target.value)}
                placeholder="Mayo 2026"
                className="h-9"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => cerrarCicloMutation.mutate()}
              disabled={!nuevoCicloNombre.trim() || cerrarCicloMutation.isPending}
              className="gap-2"
            >
              <Archive className="h-4 w-4" />
              {cerrarCicloMutation.isPending ? 'Archivando...' : 'Archivar y cerrar ciclo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmación de limpiar (eliminar) obras del ciclo actual */}
      <Dialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Eliminar obras del ciclo actual
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive space-y-1">
              <p className="font-semibold">Acción permanente e irreversible</p>
              <p>
                Se eliminarán <strong className="font-bold">{obrasActivas.length} obra{obrasActivas.length !== 1 ? 's' : ''}</strong> actuales
                del ciclo activo en este sector.
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Los ciclos anteriores ya archivados ({ciclosDisponibles.length}) y los registros de otros sectores se mantendrán intactos.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setClearConfirmOpen(false)}
              disabled={limpiarCicloMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => limpiarCicloMutation.mutate()}
              disabled={limpiarCicloMutation.isPending || obrasActivas.length === 0}
              className="gap-2"
            >
              {limpiarCicloMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {limpiarCicloMutation.isPending
                ? 'Eliminando obras...'
                : `Sí, eliminar ${obrasActivas.length} obra${obrasActivas.length !== 1 ? 's' : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}