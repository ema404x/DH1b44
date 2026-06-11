import React, { useState, useRef, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Search, X, CheckCircle2, User } from 'lucide-react';

/**
 * LocationEditor — muestra un buscador inline para asignar dirección + jefe de sitio.
 * Props:
 *   currentLocation  : string (valor actual)
 *   currentAssigned  : string (jefe/asignado actual)
 *   onSave           : ({ location, location_qr_id, location_qr_name, assigned_name }) => void
 */
export default function LocationEditor({ currentLocation, currentAssigned, onSave }) {
  const [query, setQuery] = useState(currentLocation || '');
  const [showList, setShowList] = useState(false);
  const [selected, setSelected] = useState(null);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // Catálogos
  const { data: locationQRs = [] } = useQuery({
    queryKey: ['location-qrs-editor'],
    queryFn: () => base44.entities.LocationQR.list('name', 2000),
    staleTime: 300_000,
  });
  const { data: direcciones = [] } = useQuery({
    queryKey: ['direcciones-editor'],
    queryFn: () => base44.entities.Direccion.list('direccion', 2000),
    staleTime: 300_000,
  });
  const { data: locationData = [] } = useQuery({
    queryKey: ['location-data-editor'],
    queryFn: () => base44.entities.LocationData.list('establecimiento', 2000),
    staleTime: 300_000,
  });

  // Cerrar al click externo
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowList(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const findJefeSitio = useCallback((address, name) => {
    const addr = (address || '').toLowerCase().trim();
    const nm   = (name   || '').toLowerCase().trim();

    const dirMatch = direcciones.find(d =>
      (addr && d.direccion?.toLowerCase().trim() === addr) ||
      (nm   && d.direccion?.toLowerCase().trim() === nm)
    );
    if (dirMatch?.jefe_sitio) return dirMatch.jefe_sitio;

    const ldMatch = locationData.find(ld =>
      (nm   && ld.establecimiento?.toLowerCase().trim() === nm)   ||
      (addr && ld.establecimiento?.toLowerCase().trim() === addr) ||
      (addr && ld.direccion?.toLowerCase().trim() === addr)
    );
    return ldMatch?.jefe_sitio || '';
  }, [direcciones, locationData]);

  // Filtro de sugerencias
  const suggestions = query.trim().length >= 2
    ? locationQRs.filter(loc => {
        const q = query.toLowerCase();
        return (
          loc.name?.toLowerCase().includes(q) ||
          loc.address?.toLowerCase().includes(q)
        );
      }).slice(0, 10)
    : [];

  const handleSelect = (loc) => {
    const address  = loc.address?.trim() || '';
    const name     = loc.name?.trim()    || '';
    const location = address ? `${address}, CABA` : name;
    const jefe     = findJefeSitio(address, name);

    setSelected({ loc, location, jefe });
    setQuery(address || name);
    setShowList(false);
  };

  const handleConfirm = () => {
    if (!selected) return;
    onSave({
      location:        selected.location,
      location_qr_id:  selected.loc.id,
      location_qr_name: selected.loc.name || selected.loc.address || '',
      assigned_name:   selected.jefe || currentAssigned || '',
    });
  };

  const handleClear = () => {
    setQuery('');
    setSelected(null);
    setShowList(false);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="space-y-2">
      {/* Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setSelected(null); setShowList(true); }}
          onFocus={() => query.trim().length >= 2 && setShowList(true)}
          placeholder="Buscar por dirección o establecimiento…"
          className="w-full pl-8 pr-8 py-2 text-sm bg-slate-800/80 border border-slate-600/60 focus:border-indigo-500/70 focus:ring-1 focus:ring-indigo-500/30 rounded-lg text-white placeholder:text-slate-500 outline-none transition-all"
        />
        {query && (
          <button onClick={handleClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown sugerencias */}
      {showList && suggestions.length > 0 && (
        <div className="rounded-xl border border-slate-700/60 bg-slate-900 shadow-2xl overflow-hidden max-h-56 overflow-y-auto">
          {suggestions.map(loc => (
            <button
              key={loc.id}
              onMouseDown={e => { e.preventDefault(); handleSelect(loc); }}
              className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-indigo-600/15 text-left transition-colors border-b border-slate-800/60 last:border-0"
            >
              <MapPin className="h-3.5 w-3.5 text-indigo-400 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-white truncate">{loc.address || loc.name}</p>
                {loc.address && loc.name && (
                  <p className="text-[10px] text-slate-500 truncate">{loc.name}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {showList && query.trim().length >= 2 && suggestions.length === 0 && (
        <p className="text-xs text-slate-500 px-1">Sin resultados para "{query}"</p>
      )}

      {/* Vista previa selección */}
      {selected && (
        <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/30 px-3 py-2.5 space-y-1.5">
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-indigo-400 flex-shrink-0" />
            <p className="text-xs text-white font-medium truncate">{selected.location}</p>
          </div>
          {selected.jefe && (
            <div className="flex items-center gap-2">
              <User className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
              <p className="text-xs text-emerald-300 truncate">Jefe de sitio: <span className="font-semibold">{selected.jefe}</span></p>
            </div>
          )}
          <button
            onClick={handleConfirm}
            className="w-full mt-1 flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-semibold rounded-lg px-3 py-2 transition-all shadow-md shadow-indigo-950/50"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Confirmar ubicación
          </button>
        </div>
      )}
    </div>
  );
}