import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ShieldAlert, Package, Clock, X, ChevronDown, ChevronUp, CheckCheck, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const TIPO_CONFIG = {
  garantia_activo:   { icon: ShieldAlert, color: 'text-purple-400', glow: 'shadow-purple-500/20', bg: 'bg-purple-500/10', border: 'border-purple-500/30', label: 'Garantía', href: '/activos' },
  stock_material:    { icon: Package,     color: 'text-red-400',    glow: 'shadow-red-500/20',    bg: 'bg-red-500/10',    border: 'border-red-500/30',    label: 'Stock',    href: '/inventario' },
  pendiente_vencido: { icon: Clock,       color: 'text-amber-400',  glow: 'shadow-amber-500/20',  bg: 'bg-amber-500/10',  border: 'border-amber-500/30',  label: 'Pendiente', href: '/activos' },
};

const NIVEL_CONFIG = {
  critical: { dot: 'bg-red-500',   label: 'Crítico',  rowBg: 'bg-red-500/5',    badge: 'bg-red-500/15 text-red-400 border-red-500/30' },
  warning:  { dot: 'bg-amber-500', label: 'Aviso',    rowBg: 'bg-amber-500/5',  badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  info:     { dot: 'bg-blue-500',  label: 'Info',     rowBg: 'bg-blue-500/5',   badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
};

export default function AlertasBanner() {
  const [expanded, setExpanded] = useState(false);
  const qc = useQueryClient();

  const { data: alertas = [] } = useQuery({
    queryKey: ['alertas-activas'],
    queryFn: () => base44.entities.AlertaLog.filter({ leida: false }, '-fecha_alerta', 50),
    refetchInterval: 5 * 60 * 1000,
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
  const shown     = expanded ? alertas : alertas.slice(0, 4);

  return (
    <div
      className="rounded-2xl border border-white/10 overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: criticals.length > 0
          ? '0 0 0 1px rgba(239,68,68,0.15), 0 8px 32px rgba(0,0,0,0.4)'
          : '0 0 0 1px rgba(245,158,11,0.1), 0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
        <div className="flex items-center gap-3">
          <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${criticals.length > 0 ? 'bg-red-500/15' : 'bg-amber-500/15'}`}>
            <AlertTriangle className={`h-4 w-4 ${criticals.length > 0 ? 'text-red-400' : 'text-amber-400'}`} />
          </div>
          <div>
            <span className="text-sm font-semibold text-foreground">
              {alertas.length} alerta{alertas.length !== 1 ? 's' : ''} activa{alertas.length !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              {criticals.length > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/25 font-semibold">
                  {criticals.length} crítica{criticals.length !== 1 ? 's' : ''}
                </span>
              )}
              {warnings.length > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25 font-semibold">
                  {warnings.length} aviso{warnings.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-[11px] h-7 gap-1 text-muted-foreground hover:text-foreground hover:bg-white/8"
            onClick={() => marcarTodasLeidas.mutate()}
          >
            <CheckCheck className="h-3 w-3" /> Marcar leídas
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-white/8"
            onClick={() => setExpanded(e => !e)}
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* Lista */}
      <div className="divide-y divide-white/5">
        {shown.map(alerta => {
          const tipo  = TIPO_CONFIG[alerta.tipo]  || TIPO_CONFIG.pendiente_vencido;
          const nivel = NIVEL_CONFIG[alerta.nivel] || NIVEL_CONFIG.warning;
          const TipoIcon = tipo.icon;

          return (
            <div
              key={alerta.id}
              className={`flex items-center gap-3 px-4 py-2.5 group transition-colors hover:bg-white/5 ${nivel.rowBg}`}
            >
              {/* Icono */}
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 border ${tipo.bg} ${tipo.border}`}>
                <TipoIcon className={`h-3.5 w-3.5 ${tipo.color}`} />
              </div>

              {/* Contenido */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-foreground truncate">{alerta.titulo}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-semibold flex items-center gap-1 flex-shrink-0 ${nivel.badge}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${nivel.dot}`} />
                    {nivel.label}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{alerta.mensaje}</p>
              </div>

              {/* Tiempo + acciones */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {alerta.fecha_alerta && (
                  <span className="text-[10px] text-muted-foreground/60 hidden sm:block">
                    {formatDistanceToNow(parseISO(alerta.fecha_alerta), { addSuffix: true, locale: es })}
                  </span>
                )}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Link to={tipo.href}>
                    <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-white/10">
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 hover:bg-white/10"
                    onClick={() => marcarLeida.mutate(alerta.id)}
                  >
                    <X className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Ver más */}
      {alertas.length > 4 && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full py-2 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors border-t border-white/8"
        >
          {expanded ? 'Ver menos' : `Ver ${alertas.length - 4} alerta${alertas.length - 4 !== 1 ? 's' : ''} más`}
        </button>
      )}
    </div>
  );
}