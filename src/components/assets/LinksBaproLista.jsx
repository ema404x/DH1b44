import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Copy, Check, Clock, Ban, ExternalLink, Trash2, Search } from 'lucide-react';
import { normalizarTexto } from '@/components/assets/bapro/sedesBapro';

const estadoColor = {
  activo: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  usado: 'bg-blue-100 text-blue-700 border-blue-200',
  expirado: 'bg-gray-100 text-gray-500 border-gray-200',
  revocado: 'bg-red-100 text-red-600 border-red-200',
};

/** Lista de links generados. En BAPRO: sede destacada + filtro por sede + "Copiar link". */
export default function LinksBaproLista({ tokens, isLoading, esBapro, onCopy, onRevoke, onDelete }) {
  const [filtro, setFiltro] = useState('');
  const t0 = normalizarTexto(filtro);
  const lista = esBapro && t0 ? tokens.filter(t => normalizarTexto(t.sede_nombre).includes(t0)) : tokens;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <h3 className="text-sm font-semibold">Links generados</h3>
        {esBapro && (
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="Filtrar por sede…" className="h-9 pl-8" />
          </div>
        )}
      </div>
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground text-sm"><Loader2 className="h-5 w-5 mx-auto animate-spin" /></div>
      ) : lista.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">{tokens.length === 0 ? 'No hay links generados aún.' : 'Ningún link coincide con esa sede.'}</div>
      ) : (
        <div className="space-y-2">
          {lista.map(t => {
            const url = `https://dh1m.com/revision-bapro/${t.token}`;
            const expirado = new Date(t.expiracion).getTime() < Date.now();
            const estadoFinal = expirado && t.estado === 'activo' ? 'expirado' : t.estado;
            const pct = t.total_activos > 0 ? Math.round((t.vistos_count / t.total_activos) * 100) : 0;
            return (
              <Card key={t.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={esBapro ? 'text-base font-bold' : 'text-sm font-medium'}>{t.sede_nombre}</span>
                        <Badge variant="outline" className={`text-[10px] ${estadoColor[estadoFinal]}`}>{estadoFinal}</Badge>
                        <span className="text-[11px] text-muted-foreground font-mono">{t.mes_periodo}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1"><Check className="h-3 w-3" />{t.vistos_count}/{t.total_activos} vistos ({pct}%)</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Vence {new Date(t.expiracion).toLocaleDateString('es-AR')}</span>
                        {t.ultima_actividad && <span>Últ. {new Date(t.ultima_actividad).toLocaleDateString('es-AR')}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0 flex-wrap">
                      <Button size="sm" variant="default" className="h-8 gap-1.5" onClick={() => window.open(url, '_blank')}>
                        <ExternalLink className="h-3.5 w-3.5" /> Abrir
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => onCopy(url)}>
                        <Copy className="h-3.5 w-3.5" /> {esBapro ? 'Copiar link' : 'Copiar'}
                      </Button>
                      {(t.estado === 'activo' || t.estado === 'usado') && (
                        <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-destructive" onClick={() => onRevoke(t.id)}>
                          <Ban className="h-3.5 w-3.5" /> Revocar
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-destructive" onClick={() => onDelete(t.id)}>
                        <Trash2 className="h-3.5 w-3.5" /> Eliminar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}