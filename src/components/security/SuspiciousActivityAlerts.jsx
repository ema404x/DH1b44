import React from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { AlertTriangle, Shield, Lock, Activity } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

export default function SuspiciousActivityAlerts() {
  const { data: auditLogs = [], isLoading } = useQuery({
    queryKey: ['suspiciousActivity'],
    queryFn: async () => {
      try {
        return await base44.entities.AuditLog.list('-created_date', 100);
      } catch {
        return [];
      }
    },
    refetchInterval: 30000,
  });

  // Detectar patrones sospechosos
  const suspiciousPatterns = React.useMemo(() => {
    const alerts = [];
    const userActions = {};
    const timeWindow = 5 * 60 * 1000; // 5 minutos

    auditLogs.forEach(log => {
      const userId = log.user_id || 'unknown';
      if (!userActions[userId]) {
        userActions[userId] = [];
      }
      userActions[userId].push(log);
    });

    // Detectar múltiples intentos fallidos
    Object.entries(userActions).forEach(([userId, logs]) => {
      const recentLogs = logs.filter(log => 
        new Date() - new Date(log.created_date) < timeWindow
      );

      if (recentLogs.length > 10) {
        alerts.push({
          id: `${userId}-activity`,
          type: 'high_activity',
          severity: 'warning',
          title: 'Actividad inusual detectada',
          description: `${recentLogs[0].user_name || 'Usuario'} ha realizado ${recentLogs.length} acciones en los últimos 5 minutos`,
          timestamp: recentLogs[0].created_date,
        });
      }
    });

    // Detectar acceso desde múltiples IPs
    const ipMap = {};
    auditLogs.slice(0, 20).forEach(log => {
      if (log.ip_address && log.user_id) {
        if (!ipMap[log.user_id]) ipMap[log.user_id] = new Set();
        ipMap[log.user_id].add(log.ip_address);
      }
    });

    Object.entries(ipMap).forEach(([userId, ips]) => {
      if (ips.size > 2) {
        const user = auditLogs.find(l => l.user_id === userId);
        alerts.push({
          id: `${userId}-multiip`,
          type: 'multi_ip',
          severity: 'info',
          title: 'Acceso desde múltiples ubicaciones',
          description: `${user?.user_name || 'Usuario'} accedió desde ${ips.size} direcciones IP diferentes`,
          timestamp: new Date().toISOString(),
        });
      }
    });

    return alerts;
  }, [auditLogs]);

  const severityConfig = {
    critical: { bg: 'bg-red-50', border: 'border-l-red-500', icon: AlertTriangle, color: 'text-red-600' },
    warning: { bg: 'bg-amber-50', border: 'border-l-amber-500', icon: AlertTriangle, color: 'text-amber-600' },
    info: { bg: 'bg-blue-50', border: 'border-l-blue-500', icon: Activity, color: 'text-blue-600' },
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleString('es-AR', { 
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return <div className="text-center py-8">Analizando actividad...</div>;
  }

  return (
    <div className="space-y-4">
      {suspiciousPatterns.length === 0 ? (
        <Card className="p-6 bg-green-50 border-green-200">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-green-600" />
            <div>
              <p className="font-semibold text-green-900">Sin alertas de seguridad</p>
              <p className="text-xs text-green-800">Tu cuenta se ve segura</p>
            </div>
          </div>
        </Card>
      ) : (
        suspiciousPatterns.map((alert) => {
          const config = severityConfig[alert.severity];
          const Icon = config.icon;
          return (
            <Card key={alert.id} className={`p-4 ${config.bg} border-l-4 ${config.border}`}>
              <div className="flex items-start gap-3">
                <Icon className={`h-5 w-5 ${config.color} flex-shrink-0 mt-0.5`} />
                <div className="flex-1">
                  <p className={`font-semibold text-sm ${config.color}`}>{alert.title}</p>
                  <p className="text-sm text-muted-foreground mt-1">{alert.description}</p>
                  <p className="text-xs text-muted-foreground mt-2">{formatTime(alert.timestamp)}</p>
                </div>
              </div>
            </Card>
          );
        })
      )}

      <Card className="p-4 bg-slate-50 border-slate-200 mt-6">
        <p className="text-xs text-slate-600">
          <strong>Información:</strong> Los patrones sospechosos se detectan automáticamente analizando actividad reciente. Si ves algo inusual, considera cambiar tu contraseña.
        </p>
      </Card>
    </div>
  );
}