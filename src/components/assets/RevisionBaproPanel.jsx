import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Link2, Copy, Check, Clock, Ban, Send, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function RevisionBaproPanel({ sedes }) {
  const [sedeScope, setSedeScope] = useState('TODAS');
  const [mes, setMes] = useState(currentMonth());
  const [dias, setDias] = useState(30);
  const [notas, setNotas] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState(null);
  const [copied, setCopied] = useState(false);
  const qc = useQueryClient();

  const { data: tokens = [], isLoading } = useQuery({
    queryKey: ['bapro_tokens'],
    queryFn: () => base44.entities.RevisionBaproToken.list('-created_date', 50),
  });

  const generate = async () => {
    setGenerating(true);
    setGeneratedLink(null);
    try {
      const sedeObj = sedeScope !== 'TODAS' ? sedes.find(s => s.id === sedeScope) : null;
      const res = await base44.functions.invoke('generarLinkBapro', {
        sede_scope: sedeScope,
        sede_nombre: sedeObj?.nombre || 'Todas las sedes',
        mes_periodo: mes,
        dias_expiracion: parseInt(dias, 10) || 30,
        notas,
      });
      setGeneratedLink(res.link);
      qc.invalidateQueries({ queryKey: ['bapro_tokens'] });
      toast.success(`Link generado para ${res.total_activos} activos`);
    } catch (err) {
      toast.error(err.message || 'Error al generar link');
    } finally {
      setGenerating(false);
    }
  };

  const copyLink = (link) => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('Link copiado');
    setTimeout(() => setCopied(false), 2000);
  };

  const revoke = async (id) => {
    if (!window.confirm('¿Revocar este link? El banco ya no podrá abrirlo.')) return;
    try {
      await base44.entities.RevisionBaproToken.update(id, { estado: 'revocado' });
      qc.invalidateQueries({ queryKey: ['bapro_tokens'] });
      toast.success('Link revocado');
    } catch (err) {
      toast.error('Error al revocar');
    }
  };

  const estadoColor = {
    activo: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    usado: 'bg-blue-100 text-blue-700 border-blue-200',
    expirado: 'bg-gray-100 text-gray-500 border-gray-200',
    revocado: 'bg-red-100 text-red-600 border-red-200',
  };

  return (
    <div className="space-y-5">
      <Card className="border-l-4 border-l-blue-500">
        <CardContent className="pt-4 pb-4 space-y-4">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Generar link de revisión para BAPRO</h3>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            El banco recibe un link sin login. Ve los activos en solo lectura y marca un "visto" por activo o por sede.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Sede (scope)</Label>
              <Select value={sedeScope} onValueChange={setSedeScope}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODAS">Todas las sedes</SelectItem>
                  {sedes.map(s => <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Mes del lote</Label>
              <Input type="month" value={mes} onChange={e => setMes(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Días de validez</Label>
              <Input type="number" min={1} max={365} value={dias} onChange={e => setDias(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notas</Label>
              <Input value={notas} onChange={e => setNotas(e.target.value)} placeholder="Referencia interna" />
            </div>
          </div>

          <Button onClick={generate} disabled={generating} className="gap-1.5">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Generar link
          </Button>

          {generatedLink && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5">
              <Input readOnly value={generatedLink} className="text-xs font-mono bg-transparent border-0 flex-1" />
              <Button size="sm" variant="default" className="h-8 gap-1.5" onClick={() => window.open(generatedLink, '_blank')}>
                <ExternalLink className="h-3.5 w-3.5" /> Abrir
              </Button>
              <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => copyLink(generatedLink)}>
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copiado' : 'Copiar'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div>
        <h3 className="text-sm font-semibold mb-3">Links generados</h3>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground text-sm"><Loader2 className="h-5 w-5 mx-auto animate-spin" /></div>
        ) : tokens.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">No hay links generados aún.</div>
        ) : (
          <div className="space-y-2">
            {tokens.map(t => {
              const expirado = new Date(t.expiracion).getTime() < Date.now();
              const estadoFinal = expirado && t.estado === 'activo' ? 'expirado' : t.estado;
              const pct = t.total_activos > 0 ? Math.round((t.vistos_count / t.total_activos) * 100) : 0;
              return (
                <Card key={t.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="pt-3 pb-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{t.sede_nombre}</span>
                          <Badge variant="outline" className={`text-[10px] ${estadoColor[estadoFinal]}`}>{estadoFinal}</Badge>
                          <span className="text-[11px] text-muted-foreground font-mono">{t.mes_periodo}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1"><Check className="h-3 w-3" />{t.vistos_count}/{t.total_activos} vistos ({pct}%)</span>
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Vence {new Date(t.expiracion).toLocaleDateString('es-AR')}</span>
                          {t.ultima_actividad && <span>Últ. {new Date(t.ultima_actividad).toLocaleDateString('es-AR')}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <Button size="sm" variant="default" className="h-8 gap-1.5" onClick={() => window.open(`${window.location.origin}/revision-bapro/${t.token}`, '_blank')}>
                          <ExternalLink className="h-3.5 w-3.5" /> Abrir
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => copyLink(`${window.location.origin}/revision-bapro/${t.token}`)}>
                          <Copy className="h-3.5 w-3.5" /> Copiar
                        </Button>
                        {(t.estado === 'activo' || t.estado === 'usado') && (
                          <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-destructive" onClick={() => revoke(t.id)}>
                            <Ban className="h-3.5 w-3.5" /> Revocar
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}