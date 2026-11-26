import React, { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

/** Buscador con debounce de 250 ms y botón para limpiar. */
export default function BuscadorActivos({ value, onChange }) {
  const [texto, setTexto] = useState(value);

  useEffect(() => {
    if (texto === value) return undefined;
    const t = setTimeout(() => onChange(texto), 250);
    return () => clearTimeout(t);
  }, [texto]); // eslint-disable-line react-hooks/exhaustive-deps

  const limpiar = () => { setTexto(''); onChange(''); };

  return (
    <div className="relative min-w-[200px] max-w-md flex-1">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input placeholder="Buscar nombre, código, marca, serie, área…" value={texto} onChange={e => setTexto(e.target.value)} className="pl-9 pr-9" />
      {texto && (
        <button type="button" onClick={limpiar} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground" title="Limpiar búsqueda">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}