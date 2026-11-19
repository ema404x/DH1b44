import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Límites de CABA para aceptar coordenadas escritas a mano.
const LIM = { lat: [-34.72, -34.52], lng: [-58.54, -58.33] };
const fmt = (v) => (Number.isFinite(v) ? v.toFixed(6) : '');
const dentro = (k, v) => Number.isFinite(v) && v >= LIM[k][0] && v <= LIM[k][1];
const leer = (s) => (String(s).trim() === '' ? NaN : Number(String(s).replace(',', '.')));

export default function CoordenadasManual({ manual, onCambio }) {
  const [txt, setTxt] = useState({ lat: fmt(manual.lat), lng: fmt(manual.lng) });

  // Si el pin se movió en el mapa, reflejarlo en los campos.
  useEffect(() => {
    setTxt((t) => (leer(t.lat) === manual.lat && leer(t.lng) === manual.lng ? t : { lat: fmt(manual.lat), lng: fmt(manual.lng) }));
  }, [manual.lat, manual.lng]);

  const cambiar = (k, valor) => {
    const next = { ...txt, [k]: valor };
    setTxt(next);
    const lat = leer(next.lat); const lng = leer(next.lng);
    if (dentro('lat', lat) && dentro('lng', lng)) onCambio({ lat, lng });
  };
  const invalido = (k) => txt[k].trim() !== '' && !dentro(k, leer(txt[k]));

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-2 gap-2">
        {['lat', 'lng'].map((k) => (
          <div key={k} className="space-y-1">
            <Label className="text-xs text-muted-foreground">{k === 'lat' ? 'Latitud' : 'Longitud'} (opcional)</Label>
            <Input inputMode="decimal" value={txt[k]} onChange={(e) => cambiar(k, e.target.value)}
              className={`h-9 tabular-nums ${invalido(k) ? 'border-destructive' : ''}`} />
          </div>
        ))}
      </div>
      {(invalido('lat') || invalido('lng')) && (
        <p className="text-[11px] text-destructive">Fuera de CABA: latitud entre -34.72 y -34.52, longitud entre -58.54 y -58.33.</p>
      )}
    </div>
  );
}