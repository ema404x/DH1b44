import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Globe, LogOut, Clock, MapPin } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

export default function SessionAudit() {
  const { data: auditLogs = [], isLoading } = useQuery({
    queryKey: ['auditLogs'],
    queryFn: async () => {
      try {
        return await base44.entities.AuditLog.list('-created_date', 100);
      } catch {
        return [];
      }
    },
    refetchInterval: 30000,
  });

  // Extraer sesiones únicas
  const sessions = React.useMemo(() => {
    const sessionMap = {};
    auditLogs.forEach(log => {
      const sessionId = log.session_id || 'unknown';
      if (!sessionMap[sessionId]) {
        sessionMap[sessionId] = {
          id: sessionId,
          user: log.user_name || 'Unknown',
          lastActivity: log.created_date,
          action: log.action,
          ipAddress: log.ip_address || 'N/A',
          userAgent: log.user_agent || 'N/A',
        };
      }
    });
    return Object.values(sessionMap).sort((a, b) => 
      new Date(b.lastActivity) - new Date(a.lastActivity)
    );
  }, [auditLogs]);

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
    return <div className="text-center py-8">Cargando sesiones...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4">
        {sessions.length === 0 ? (
          <Card className="p-6 text-center text-muted-foreground">
            No hay sesiones registradas
          </Card>
        ) : (
          sessions.map(session => (
            <Card key={session.id} className="p-4 border-l-4 border-l-blue-500">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="font-semibold text-sm text-muted-foreground">Usuario</p>
                  <p className="text-base font-medium">{session.user}</p>
                </div>
                <div>
                  <p className="font-semibold text-sm text-muted-foreground">Última actividad</p>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4" />
                    {formatTime(session.lastActivity)}
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-sm text-muted-foreground">IP Address</p>
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="h-4 w-4" />
                    {session.ipAddress}
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-sm text-muted-foreground">Acción</p>
                  <p className="text-sm text-blue-600">{session.action}</p>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}