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
import { Archive, RotateCcw, ChevronDown, Clock, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * CicloSelector
 * Props:
 *  - cicloActivo: string (ej: "Mayo 2026") — el ciclo que se está viendo
 *  - ciclosDisponibles: string[] — lista de todos los ciclos con registros
 *  - onCambiarCiclo: (ciclo: string | 'activo') => void
 *  - obrasActivas: ObraCertificacion[] — solo las activas (sin archivar)
 */
export default function CicloSelector({ cicloActivo, ciclosDisponibles, onCambiarCiclo, obrasActivas }) {
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [nuevoCicloNombre, setNuevoCicloNombre] = useState(() => {
    // Sugiere el mes siguiente al actual
    const now = new Date();
    return format(now, 'MMMM yyyy', { locale: es })
      .replace(/^\w/, c => c.toUpperCase());
  });

  // Cierra el ciclo activo: marca todos los registros activos como archivados con el nombre del ciclo
  const cerrarCicloMutation = useMutation({
    mutationFn: async () => {
      const updates = obrasActivas.map(obra =>
        base44.entities.ObraCertificacion.update(obra.id, {
          ciclo: nuevoCicloNombre,
          ciclo_archivado: true,
        })
      );
      await Promise.all(updates);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['obras-certificacion'] });
      setConfirmOpen(false);
      onCambiarCiclo('activo');
    },
  });

  const esVistaCicloArchivado = cicloActivo !== 'activo';

  return (
    <div className="flex items-center gap-2">
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

      {/* Botón cerrar ciclo — solo en ciclo activo */}
      {!esVistaCicloArchivado && obrasActivas.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2 text-xs shrink-0"
          onClick={() => setConfirmOpen(true)}
        >
          <Archive className="h-3.5 w-3.5" />
          Cerrar ciclo
        </Button>
      )}

      {/* Badge lectura solo */}
      {esVistaCicloArchivado && (
        <Badge variant="outline" className="text-xs gap-1 text-muted-foreground shrink-0">
          <Lock className="h-3 w-3" /> Solo lectura
        </Badge>
      )}

      {/* Diálogo de confirmación */}
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
    </div>
  );
}