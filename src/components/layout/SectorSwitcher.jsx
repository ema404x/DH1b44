import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAuth } from '@/lib/AuthContext';
import { ChevronDown, Building2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'react-hot-toast';

export default function SectorSwitcher() {
  const { isAdmin, currentUser, employeeSector } = useCurrentUser();
  const { switchSector } = useAuth();
  const [sectores, setSectores] = useState([]);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(null);
  const ref = useRef(null);

  const currentSectorId = currentUser?.sector_id || currentUser?.data?.sector_id || employeeSector || 'escuela';

  useEffect(() => {
    if (!isAdmin) return;
    base44.entities.Sector.list('orden', 100)
      .then(setSectores)
      .catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!isAdmin) return null;

  const currentSector = sectores.find(s => s.clave === currentSectorId);

  const handleSwitch = async (sectorClave, sectorNombre) => {
    if (sectorClave === currentSectorId) { setOpen(false); return; }
    setSwitching(sectorClave);
    try {
      await switchSector(sectorClave);
      toast.success(`Cambiaste al sector: ${sectorNombre}`, { duration: 3000 });
      setOpen(false);
    } catch (e) {
      toast.error('Error al cambiar de sector: ' + (e.message || ''));
    } finally {
      setSwitching(null);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 h-9 px-3 rounded-lg border border-border bg-card/50 hover:bg-accent transition-colors text-sm"
      >
        <span className="text-base leading-none">{currentSector?.icono || '🏢'}</span>
        <span className="font-medium max-w-[100px] truncate hidden sm:inline">
          {currentSector?.nombre || currentSectorId}
        </span>
        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-64 rounded-lg border border-border bg-popover shadow-xl z-50 overflow-hidden">
          <div className="p-2 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Building2 className="w-3 h-3" /> Cambiar de sector
            </p>
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {sectores.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">Sin sectores</div>
            ) : (
              sectores.map(s => {
                const isCurrent = s.clave === currentSectorId;
                return (
                  <button
                    key={s.id}
                    onClick={() => handleSwitch(s.clave, s.nombre)}
                    disabled={isCurrent || switching === s.clave || !s.activo}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors text-left",
                      isCurrent ? "bg-primary/10" : "hover:bg-accent",
                      !s.activo && !isCurrent && "opacity-40"
                    )}
                  >
                    <span className="text-lg leading-none flex-shrink-0">{s.icono || '🏢'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{s.nombre}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate">{s.clave}</p>
                    </div>
                    {switching === s.clave && (
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin flex-shrink-0" />
                    )}
                    {isCurrent && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}