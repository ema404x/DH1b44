import React, { useMemo, useState } from 'react';
import { Search, ScanLine, MapPin, Wrench, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import QRScannerModal from '@/components/operario/QRScannerModal';
import { useLugaresPropuesta } from '@/hooks/useLugaresPropuesta';

const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// Paso 1: activo o ubicación (buscador, QR o texto libre).
export default function PasoDonde({ lugar, onChange }) {
  const { lugares, isLoading } = useLugaresPropuesta();
  const [q, setQ] = useState('');
  const [scan, setScan] = useState(false);

  const resultados = useMemo(() => {
    const t = norm(q.trim());
    const list = t ? lugares.filter((l) => norm(`${l.nombre} ${l.detalle}`).includes(t)) : lugares;
    return list.slice(0, 30);
  }, [lugares, q]);

  const handleScan = (r) => {
    const tipo = r.type === 'asset' ? 'asset' : (r.type === 'loc' || r.type === 'fichaje') ? 'loc' : null;
    if (!tipo || !r.value) { toast.error('Ese código no es de un activo ni de una ubicación'); return; }
    const found = lugares.find((l) => l.tipo === tipo && l.id === r.value);
    onChange(found || { tipo, id: r.value, nombre: tipo === 'asset' ? 'Activo escaneado' : 'Ubicación escaneada', detalle: '' });
    toast.success('Lugar elegido');
  };

  return (
    <div className="space-y-3">
      <button onClick={() => setScan(true)} className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-bold text-primary-foreground active:scale-[0.98]">
        <ScanLine className="h-5 w-5" /> Escanear el QR del lugar
      </button>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar activo o ubicación" className="h-12 pl-10 text-base" />
      </div>
      <div className="max-h-[42vh] space-y-2 overflow-y-auto">
        {isLoading && <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
        {resultados.map((l) => {
          const sel = lugar?.tipo === l.tipo && lugar?.id === l.id;
          const Icon = l.tipo === 'asset' ? Wrench : MapPin;
          return (
            <button key={`${l.tipo}-${l.id}`} onClick={() => onChange(l)} className={cn('flex min-h-[56px] w-full items-center gap-3 rounded-xl border px-3 text-left transition-colors', sel ? 'border-primary bg-primary/10' : 'border-border bg-card active:bg-accent')}>
              <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-card-foreground">{l.nombre}</p>
                {l.detalle && <p className="truncate text-xs text-muted-foreground">{l.detalle}</p>}
              </div>
              {sel && <Check className="h-5 w-5 text-primary" />}
            </button>
          );
        })}
        {!isLoading && resultados.length === 0 && <p className="py-3 text-center text-sm text-muted-foreground">No encontramos ese lugar</p>}
      </div>
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">¿No está en la lista? Escribilo:</p>
        <Input
          value={lugar?.tipo === 'texto' ? lugar.nombre : ''}
          onChange={(e) => onChange(e.target.value ? { tipo: 'texto', id: null, nombre: e.target.value, detalle: '' } : null)}
          placeholder="Ej: Escuela 12, baño planta baja"
          className="h-12 text-base"
        />
      </div>
      <QRScannerModal open={scan} onClose={() => setScan(false)} onResult={handleScan} />
    </div>
  );
}