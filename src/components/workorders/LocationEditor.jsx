import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MapPin, Search, X, CheckCircle2, User } from 'lucide-react';
import { useUbicaciones } from '@/hooks/useUbicaciones';

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

  // Hook unificado — trae LocationData + Direccion + LocationQR via service role (sin RLS)
  const { locations: unifiedLocations, isLoading } = useUbicaciones();

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

  // La lista unificada ya viene pre-joinada desde el backend
  const mappedLocations = useMemo(() =>
    unifiedLocations.map(ld => ({
      id: ld.location_qr_id || ld.id,
      name: ld.establecimiento || ld.ubic_tecnica || '',
      address: ld.direccion || '',
      jefe_sitio: ld.jefe_sitio || '',
      _hasQR: ld._hasQR,
    }))
  , [unifiedLocations]);

  // Filtro de sugerencias
  const suggestions = query.trim().length >= 2
    ? mappedLocations.filter(loc => {
        const q = query.toLowerCase();
        return (
          loc.name?.toLowerCase().includes(q) ||
          loc.address?.toLowerCase().includes(q) ||
          loc.jefe_sitio?.toLowerCase().includes(q)
        );
      }).slice(0, 10)
    : [];

  const handleSelect = (loc) => {
    const address  = loc.address?.trim() || '';
    const name     = loc.name?.trim()    || '';
    const location = address || name;

    setSelected({ loc, location, jefe: loc.jefe_sitio || '' });
    setQuery(address || name);
    setShowList(false);
  };

  const handleConfirm = () => {
    if (!selected) return;
    onSave({
      location:         selected.location,
      location_qr_id:   selected.loc._hasQR ? selected.loc.id : '',
      location_qr_name: selected.loc.name || selected.loc.address || '',
      assigned_name:    selected.jefe || currentAssigned || '',
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