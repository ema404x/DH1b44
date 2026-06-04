import React from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { AlertTriangle, Check, Edit2, Trash2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

export default function SensitiveChangesLog() {
  const { data: auditLogs = [], isLoading } = useQuery({
    queryKey: ['sensitiveAuditLogs'],
    queryFn: async () => {
      try {
        const logs = await base44.entities.AuditLog.list('-created_date', 50);
        return logs.filter(log => 
          ['Certificado', 'Invoice', 'AbonoMaestro', 'Employee', 'RolePermission'].includes(log.entity_type)
        );
      } catch {
        return [];
      }
    },
    refetchInterval: 30000,
  });

  const actionIcons = {
    create: <Check className="h-4 w-4 text-green-600" />,
    update: <Edit2 className="h-4 w-4 text-blue-600" />,
    delete: <Trash2 className="h-4 w-4 text-red-600" />,
  };

  const actionLabels = {
    create: 'Creado',
    update: 'Modificado',
    delete: 'Eliminado',
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
    return <div className="text-center py-8">Cargando historial...</div>;
  }

  return (
    <div className="space-y-3">
      {auditLogs.length === 0 ? (
        <Card className="p-6 text-center text-muted-foreground">
          No hay cambios sensibles registrados
        </Card>
      ) : (
        auditLogs.map((log) => (
          <Card key={log.id} className="p-4 border-l-4 border-l-amber-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-start gap-3">
                {actionIcons[log.action] || null}
                <div>
                  <p className="font-semibold text-sm">{log.entity_type}</p>
                  <p className="text-xs text-amber-600">{actionLabels[log.action]}</p>
                </div>
              </div>
              <div>
                <p className="font-semibold text-sm text-muted-foreground">Realizado por</p>
                <p className="text-sm">{log.user_name || 'Sistema'}</p>
              </div>
              <div>
                <p className="font-semibold text-sm text-muted-foreground">Fecha</p>
                <p className="text-xs text-muted-foreground">{formatTime(log.created_date)}</p>
              </div>
            </div>
            {log.details && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  <strong>Detalles:</strong> {log.details}
                </p>
              </div>
            )}
          </Card>
        ))
      )}
    </div>
  );
}