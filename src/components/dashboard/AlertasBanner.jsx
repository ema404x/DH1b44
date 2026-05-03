import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ShieldAlert, Package, Clock, X, ChevronDown, ChevronUp, CheckCheck, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const TIPO_CONFIG = {
  garantia_activo:   { icon: ShieldAlert, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', label: 'Garantía', href: '/activos' },
  stock_material:    { icon: Package,     color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200',    label: 'Stock',    href: '/inventario' },
  pendiente_vencido: { icon: Clock,       color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200',  label: 'Pendiente', href: '/activos' },
};

const NIVEL_CONFIG = {
  critical: { dot: 'bg-red-500',    text: 'text-red-700',    label: 'Crítico' },
  warning:  { dot: 'bg-amber-500',  text: 'text-amber-700',  label: 'Aviso' },
  info:     { dot: 'bg-blue-500',   text: 'text-blue-700',   label: 'Info' },
};

export default function AlertasBanner() {
  const [expanded, setExpanded] = useState(false);
  const qc = useQueryClient();

  const { data: alertas = [] } = useQuery({
    queryKey: ['alertas-activas'],
    queryFn: () => base44.entities.AlertaLog.filter({ leida: false }, '-fecha_alerta', 50),
    refetchInterval: 5 * 60 * 1000, // refrescar cada 5 min
  });

  const marcarLeida = useMutation({
    mutationFn: (id) => base44.entities.AlertaLog.update(id, { leida: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alertas-activas'] }),
  });

  const marcarTodasLeidas = useMutation({
    mutationFn: async () => {
      await Promise.all(alertas.map(a => base44.entities.AlertaLog.update(a.id, { leida: true })));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alertas-activas'] }),
  });

  if (alertas.length === 0) return null;

  const criticals = alertas.filter(a => a.nivel === 'critical');
  const warnings  = alertas.filter(a => a.nivel === 'warning');
  const shown     = expanded ? alertas : alertas.slice(0, 3);

  // Color del banner principal según severidad dominante
  const dominantBg    = criticals.length > 0 ? 'bg-red-50 border-red-200'    : 'bg-amber-50 border-amber-200';
  const dominantText  = criticals.length > 0 ? 'text-red-700'                : 'text-amber-700';
  const dominantIcon  = criticals.length > 0 ? 'text-red-500'                : 'text-amber-500';

  return (
    <div className={`rounded-xl border ${dominantBg} overflow-hidden`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className={`h-4 w-4 flex-shrink-0 ${dominantIcon}`} />
          <span className={`text-sm font-semibold ${dominantText}`}>
            {alertas.length} alerta{alertas.length !== 1 ? 's' : ''} activa{alertas.length !== 1 ? 's' : ''}
          </span>
          {criticals.length > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500 text-white font-bold">{criticals.length} crítica{criticals.length !== 1 ? 's' : ''}</span>
          )}
          {warnings.length > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400 text-white font-bold">{warnings.length} aviso{warnings.length !== 1 ? 's' : ''}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className={`text-[11px] h-7 gap-1 ${dominantText} hover:bg-white/60`}
            onClick={() => marcarTodasLeidas.mutate()}>
            <CheckCheck className="h-3 w-3" /> Marcar todas leídas
          </Button>
          <Button variant="ghost" size="icon" className={`h-7 w-7 ${dominantText} hover:bg-white/60`}
            onClick={() => setExpanded(e => !e)}>
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* Lista de alertas */}
      <div className="border-t border-inherit divide-y divide-inherit">
        {shown.map(alerta => {
          const tipo  = TIPO_CONFIG[alerta.tipo]  || TIPO_CONFIG.pendiente_vencido;
          const nivel = NIVEL_CONFIG[alerta.nivel] || NIVEL_CONFIG.warning;
          const TipoIcon = tipo.icon;

          return (
            <div key={alerta.id} className="flex items-start gap-3 px-4 py-2.5 bg-white/90 hover:bg-white transition-colors group">
              <div className={`h-7 w-7 rounded-lg ${tipo.bg} ${tipo.border} border flex items-center justify-center flex-shrink-0 mt-0.5`}>
                <TipoIcon className={`h-3.5 w-3.5 ${tipo.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-semibold text-foreground">{alerta.titulo}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-1`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${nivel.dot}`} />
                    <span className={nivel.text}>{nivel.label}</span>
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{alerta.mensaje}</p>
                {alerta.fecha_alerta && (
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                    {formatDistanceToNow(parseISO(alerta.fecha_alerta), { addSuffix: true, locale: es })}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <Link to={tipo.href}>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </Link>
                <Button variant="ghost" size="icon" className="h-6 w-6"
                  onClick={() => marcarLeida.mutate(alerta.id)}>
                  <X className="h-3 w-3 text-muted-foreground" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Ver más / menos */}
      {alertas.length > 3 && (
        <button
          onClick={() => setExpanded(e => !e)}
          className={`w-full py-2 text-[11px] font-semibold ${dominantText} hover:bg-white/40 transition-colors border-t border-inherit`}
        >
          {expanded ? 'Ver menos' : `Ver ${alertas.length - 3} alerta${alertas.length - 3 !== 1 ? 's' : ''} más`}
        </button>
      )}
    </div>
  );
}