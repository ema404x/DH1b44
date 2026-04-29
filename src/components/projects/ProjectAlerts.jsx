import React, { useState, useMemo } from 'react';
import { AlertTriangle, AlertCircle, Info, X, Clock } from 'lucide-react';
import { differenceInDays, parseISO, isValid } from 'date-fns';

/**
 * Calcula el nivel de alerta para un proyecto según días restantes y % de avance.
 * 
 * VERDE (info):    Faltan entre 30 y 60 días y el avance es menor al esperado.
 * AMARILLO (warn): Faltan entre 15 y 30 días y el avance está 20+ % por debajo del esperado.
 * ROJO (danger):   Faltan menos de 15 días y el avance está 30+ % por debajo del esperado,
 *                  O la fecha ya pasó y no está completado.
 */
function getProjectAlert(project) {
  const { end_date, progress = 0, status } = project;

  // No alertar proyectos terminados o cancelados
  if (['completado', 'cancelado'].includes(status)) return null;
  if (!end_date) return null;

  const endDate = parseISO(end_date);
  if (!isValid(endDate)) return null;

  const today = new Date();
  const daysLeft = differenceInDays(endDate, today);

  // Calcular progreso esperado en base al tiempo transcurrido
  let expectedProgress = 100;
  if (project.start_date) {
    const startDate = parseISO(project.start_date);
    if (isValid(startDate)) {
      const totalDays = differenceInDays(endDate, startDate);
      if (totalDays > 0) {
        const elapsed = differenceInDays(today, startDate);
        expectedProgress = Math.min(100, Math.round((elapsed / totalDays) * 100));
      }
    }
  }

  const deficit = expectedProgress - progress;

  // ROJO: fecha vencida o menos de 15 días con avance muy bajo
  if (daysLeft < 0) {
    return {
      level: 'danger',
      daysLeft,
      deficit,
      message: `La fecha límite ya venció hace ${Math.abs(daysLeft)} día${Math.abs(daysLeft) !== 1 ? 's' : ''} y el avance es solo del ${progress}%.`,
    };
  }
  if (daysLeft <= 15 && deficit >= 30) {
    return {
      level: 'danger',
      daysLeft,
      deficit,
      message: `Quedan solo ${daysLeft} día${daysLeft !== 1 ? 's' : ''} y el avance es del ${progress}% (esperado: ~${expectedProgress}%). Riesgo crítico de incumplimiento.`,
    };
  }

  // AMARILLO: entre 15 y 30 días con avance moderadamente bajo
  if (daysLeft <= 30 && deficit >= 20) {
    return {
      level: 'warning',
      daysLeft,
      deficit,
      message: `Quedan ${daysLeft} días y el avance es del ${progress}% (esperado: ~${expectedProgress}%). Se recomienda acelerar el ritmo.`,
    };
  }

  // VERDE: entre 30 y 60 días con avance por debajo del esperado
  if (daysLeft <= 60 && deficit >= 15) {
    return {
      level: 'info',
      daysLeft,
      deficit,
      message: `Quedan ${daysLeft} días y el avance es del ${progress}% (esperado: ~${expectedProgress}%). Revisar cronograma.`,
    };
  }

  return null;
}

const ALERT_CONFIG = {
  danger: {
    bg: 'bg-red-950/60 border-red-500/50',
    icon: AlertCircle,
    iconColor: 'text-red-400',
    textColor: 'text-red-200',
    label: 'Crítico',
    labelBg: 'bg-red-500/20 text-red-300',
  },
  warning: {
    bg: 'bg-yellow-950/60 border-yellow-500/50',
    icon: AlertTriangle,
    iconColor: 'text-yellow-400',
    textColor: 'text-yellow-200',
    label: 'Precaución',
    labelBg: 'bg-yellow-500/20 text-yellow-300',
  },
  info: {
    bg: 'bg-emerald-950/60 border-emerald-500/50',
    icon: Info,
    iconColor: 'text-emerald-400',
    textColor: 'text-emerald-200',
    label: 'Aviso',
    labelBg: 'bg-emerald-500/20 text-emerald-300',
  },
};

export default function ProjectAlerts({ projects }) {
  const [dismissed, setDismissed] = React.useState([]);

  const alerts = useMemo(() => {
    return projects
      .map(p => {
        const alert = getProjectAlert(p);
        if (!alert) return null;
        return { ...alert, project: p };
      })
      .filter(Boolean)
      .filter(a => !dismissed.includes(a.project.id))
      .sort((a, b) => {
        const order = { danger: 0, warning: 1, info: 2 };
        return order[a.level] - order[b.level];
      });
  }, [projects, dismissed]);

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map(alert => {
        const cfg = ALERT_CONFIG[alert.level];
        const Icon = cfg.icon;
        return (
          <div
            key={alert.project.id}
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 backdrop-blur ${cfg.bg}`}
          >
            <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${cfg.iconColor}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.labelBg}`}>
                  {cfg.label}
                </span>
                <span className={`text-xs font-semibold truncate ${cfg.textColor}`}>
                  {alert.project.name}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-slate-500">
                  <Clock className="h-3 w-3" />
                  {alert.daysLeft < 0 ? `${Math.abs(alert.daysLeft)}d vencido` : `${alert.daysLeft}d restantes`}
                </span>
              </div>
              <p className={`text-[11px] leading-snug ${cfg.textColor} opacity-80`}>
                {alert.message}
              </p>
            </div>
            <button
              onClick={() => setDismissed(prev => [...prev, alert.project.id])}
              className="text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}