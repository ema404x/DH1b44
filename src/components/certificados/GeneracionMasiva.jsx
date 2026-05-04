import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Zap, CheckCircle2, AlertCircle, Users } from 'lucide-react';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

export default function GeneracionMasiva({ open, onClose, onSuccess }) {
  const queryClient = useQueryClient();
  const [seleccionados, setSeleccionados] = useState([]);
  const [mesPeriodo, setMesPeriodo] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [running, setRunning] = useState(false);
  const [resultado, setResultado] = useState(null);

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ['clientes-activos'],
    queryFn: () => base44.entities.Client.filter({ status: 'activo' }),
    enabled: open,
  });

  const { data: certExistentes = [] } = useQuery({
    queryKey: ['certs-mes', mesPeriodo],
    queryFn: () => base44.entities.Certificado.filter({ mes_periodo: mesPeriodo, tipo: 'abono_mensual' }),
    enabled: open && !!mesPeriodo,
  });

  const yaGenerados = new Set(certExistentes.map(c => c.contratista_id).filter(Boolean));

  const toggleSeleccion = (id) => {
    setSeleccionados(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleTodos = () => {
    const disponibles = clientes.filter(c => !yaGenerados.has(c.id)).map(c => c.id);
    if (seleccionados.length === disponibles.length) {
      setSeleccionados([]);
    } else {
      setSeleccionados(disponibles);
    }
  };

  const handleGenerar = async () => {
    if (!seleccionados.length || !mesPeriodo) return;
    setRunning(true);
    setResultado(null);

    try {
      const clientesSeleccionados = clientes.filter(c => seleccionados.includes(c.id));
      const generados = [];
      const errores = [];

      // Obtener el último número de certificado
      const allCerts = await base44.entities.Certificado.list('-numero', 1);
      let lastNum = allCerts.length > 0 ? (allCerts[0].numero || 0) : 0;

      const fechaCert = new Date().toISOString().split('T')[0];

      for (const cliente of clientesSeleccionados) {
        try {
          lastNum += 1;
          const newCert = {
            numero: lastNum,
            tipo: 'abono_mensual',
            estado: 'emitido',
            generado_automaticamente: true,
            contratista: cliente.name,
            contratista_id: cliente.id,
            emprendimiento: cliente.notes || '',
            mes_periodo: mesPeriodo,
            fecha_certificado: fechaCert,
            items: [],
            subtotal: 0,
            monto_contratado: 0,
            anticipo_pct: 0,
            fondo_reparo_pct: 5,
          };
          await base44.entities.Certificado.create(newCert);
          generados.push(cliente.name);
        } catch (e) {
          errores.push(cliente.name);
        }
      }

      setResultado({ generados, errores });
      queryClient.invalidateQueries({ queryKey: ['certificados'] });
      queryClient.invalidateQueries({ queryKey: ['certs-mes', mesPeriodo] });
      if (onSuccess) onSuccess();
    } finally {
      setRunning(false);
    }
  };

  const disponibles = clientes.filter(c => !yaGenerados.has(c.id));
  const todosSeleccionados = disponibles.length > 0 && seleccionados.length === disponibles.length;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-violet-500" />
            Generación Masiva — Abono Mensual
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Selector de mes */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Mes / Período</label>
            <input
              type="month"
              value={mesPeriodo}
              onChange={e => { setMesPeriodo(e.target.value); setSeleccionados([]); setResultado(null); }}
              className="px-3 py-2 border border-input rounded-lg text-sm bg-background w-full"
            />
          </div>

          {/* Resultado */}
          {resultado && (
            <div className={`rounded-lg p-4 border text-sm space-y-1 ${resultado.errores.length === 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
              {resultado.generados.length > 0 && (
                <div className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{resultado.generados.length} certificados generados correctamente</span>
                </div>
              )}
              {resultado.errores.length > 0 && (
                <div className="flex items-center gap-2 text-amber-700">
                  <AlertCircle className="h-4 w-4" />
                  <span>Errores en: {resultado.errores.join(', ')}</span>
                </div>
              )}
            </div>
          )}

          {/* Lista de contratistas */}
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Cargando contratistas...</div>
          ) : clientes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
              No hay proveedores/contratistas activos
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{disponibles.length} disponibles para {mesPeriodo}</span>
                {disponibles.length > 0 && (
                  <button onClick={toggleTodos} className="text-xs text-primary hover:underline">
                    {todosSeleccionados ? 'Deseleccionar todos' : 'Seleccionar todos'}
                  </button>
                )}
              </div>

              <div className="max-h-64 overflow-y-auto space-y-1 border rounded-lg p-2">
                {clientes.map(cliente => {
                  const yaExiste = yaGenerados.has(cliente.id);
                  const checked = seleccionados.includes(cliente.id);
                  return (
                    <div
                      key={cliente.id}
                      onClick={() => !yaExiste && toggleSeleccion(cliente.id)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        yaExiste ? 'opacity-50 cursor-not-allowed bg-muted/30' :
                        checked ? 'bg-violet-50 border border-violet-200 cursor-pointer' :
                        'hover:bg-muted/40 cursor-pointer'
                      }`}
                    >
                      <Checkbox checked={checked} disabled={yaExiste} onCheckedChange={() => !yaExiste && toggleSeleccion(cliente.id)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{cliente.name}</p>
                        {cliente.rubro && <p className="text-xs text-muted-foreground">{cliente.rubro}</p>}
                      </div>
                      {yaExiste && <Badge variant="secondary" className="text-xs shrink-0">Ya generado</Badge>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Acciones */}
          <div className="flex gap-2 pt-2 border-t">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button
              onClick={handleGenerar}
              disabled={seleccionados.length === 0 || running}
              className="flex-1 gap-2 bg-violet-600 hover:bg-violet-700"
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {running ? 'Generando...' : `Generar ${seleccionados.length > 0 ? `(${seleccionados.length})` : ''}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}