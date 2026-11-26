import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Link2, Copy, Check, Send, ExternalLink } from 'lucide-react';
import useEsBapro from '@/hooks/useEsBapro';
import SedeBuscador from '@/components/assets/bapro/SedeBuscador';
import { ordenarSedes } from '@/components/assets/bapro/sedesBapro';
import LinksBaproLista from '@/components/assets/LinksBaproLista';
import { toast } from 'sonner';

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function RevisionBaproPanel({ sedes }) {
  const esBapro = useEsBapro();
  const [sedeScope, setSedeScope] = useState(esBapro ? '' : 'TODAS');
  const [progreso, setProgreso] = useState('');
  useEffect(() => { if (esBapro) setSedeScope(s => (s === 'TODAS' ? '' : s)); }, [esBapro]);
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

  const generarPorSede = async () => {
    setGeneratedLink(null);
    setProgreso('Contando activos…');
    try {
      const conteos = await Promise.all(sedes.map(s => base44.entities.Asset.count({ location_id: s.id })));
      const validas = ordenarSedes(sedes).filter(s => conteos[sedes.indexOf(s)] > 0);
      const saltadas = sedes.length - validas.length;
      if (validas.length === 0) { toast.error('Ninguna sede tiene activos'); return; }
      const aviso = saltadas > 0 ? ` (${saltadas} sin activos se saltean)` : '';
      if (!window.confirm(`Se van a generar ${validas.length} links, uno por sede${aviso}. ¿Continuar?`)) return;
      let ok = 0, fallidas = 0;
      for (let i = 0; i < validas.length; i++) {
        setProgreso(`Generando ${i + 1} de ${validas.length}…`);
        try {
          await base44.functions.invoke('generarLinkBapro', {
            sede_scope: validas[i].id, sede_nombre: validas[i].nombre, mes_periodo: mes,
            dias_expiracion: parseInt(dias, 10) || 30, notas,
          });
          ok++;
        } catch { fallidas++; }
      }
      qc.invalidateQueries({ queryKey: ['bapro_tokens'] });
      toast.success(`${ok} links generados${saltadas ? `, ${saltadas} sedes salteadas (0 activos)` : ''}${fallidas ? `, ${fallidas} con error` : ''}`);
    } catch (err) {
      toast.error(err.message || 'Error al generar links');
    } finally {
      setProgreso('');
    }
  };

  const generate = async () => {
    if (esBapro && !sedeScope) return;
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
      const body = res?.data ?? res;
      setGeneratedLink(body.link);
      qc.invalidateQueries({ queryKey: ['bapro_tokens'] });
      toast.success(`Link generado para ${body.total_activos} activos`);
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

  const eliminar = async (id) => {
    if (!window.confirm('¿Eliminar este link definitivamente? Esta acción no se puede deshacer.')) return;
    try {
      await base44.entities.RevisionBaproToken.delete(id);
      qc.invalidateQueries({ queryKey: ['bapro_tokens'] });
      toast.success('Link eliminado');
    } catch (err) {
      toast.error('Error al eliminar');
    }
  };

  return (
    <div className="space-y-5">
      <Card className="border-l-4 border-l-blue-500">
        <CardContent className="pt-4 pb-4 space-y-4">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Generar link de revisión</h3>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            El banco recibe un link sin login. Ve los activos en solo lectura y marca un "visto" por activo o por sede.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Sede (scope)</Label>
              {esBapro ? (
                <SedeBuscador options={ordenarSedes(sedes).map(s => ({ value: s.id, label: s.nombre }))} value={sedeScope} onChange={setSedeScope} placeholder="Elegir sede" />
              ) : (
                <Select value={sedeScope} onValueChange={setSedeScope}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODAS">Todas las sedes</SelectItem>
                    {sedes.map(s => <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
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

          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={generate} disabled={generating || !!progreso || (esBapro && !sedeScope)} className="gap-1.5">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Generar link
            </Button>
            {esBapro && (
              <Button variant="outline" onClick={generarPorSede} disabled={generating || !!progreso || sedes.length === 0} className="gap-1.5">
                {progreso && <Loader2 className="h-4 w-4 animate-spin" />}
                {progreso || 'Generar un link por cada sede'}
              </Button>
            )}
          </div>

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

      <LinksBaproLista tokens={tokens} isLoading={isLoading} esBapro={esBapro} onCopy={copyLink} onRevoke={revoke} onDelete={eliminar} />
    </div>
  );
}