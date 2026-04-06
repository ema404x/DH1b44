import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Search, Download, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const actionColors = {
  create: 'bg-green-50 text-green-700 border-green-200',
  update: 'bg-blue-50 text-blue-700 border-blue-200',
  delete: 'bg-red-50 text-red-700 border-red-200',
  view: 'bg-gray-50 text-gray-700 border-gray-200',
  sign: 'bg-purple-50 text-purple-700 border-purple-200'
};

export default function Auditoria() {
  const [filters, setFilters] = useState({ entity_type: '', action: '', user_email: '' });
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['auditLogs', filters],
    queryFn: async () => {
      const query = {};
      if (filters.entity_type) query.entity_type = filters.entity_type;
      if (filters.action) query.action = filters.action;
      if (filters.user_email) query.user_email = filters.user_email;
      return await base44.entities.AuditLog.filter(query, '-created_date', 500);
    }
  });

  const filteredLogs = logs.filter(log => {
    if (dateFrom && new Date(log.timestamp) < new Date(dateFrom)) return false;
    if (dateTo && new Date(log.timestamp) > new Date(dateTo)) return false;
    return true;
  });

  const exportCSV = () => {
    const csv = [
      ['Fecha', 'Usuario', 'Rol', 'Entidad', 'ID', 'Acción', 'Campos Modificados'].join(','),
      ...filteredLogs.map(log => [
        format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm:ss', { locale: es }),
        log.user_email,
        log.user_role,
        log.entity_type,
        log.entity_id,
        log.action,
        (log.changed_fields || []).join(';')
      ].map(f => `"${f}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Auditoría</h1>
        <p className="text-muted-foreground mt-1">Registro de todas las acciones realizadas en el sistema</p>
      </div>

      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Tipo de Entidad</label>
            <Input placeholder="Ej: WorkOrder, Certificado..." value={filters.entity_type} 
              onChange={(e) => setFilters({...filters, entity_type: e.target.value})} />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Acción</label>
            <Select value={filters.action} onValueChange={(v) => setFilters({...filters, action: v})}>
              <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>Todas</SelectItem>
                <SelectItem value="create">Crear</SelectItem>
                <SelectItem value="update">Actualizar</SelectItem>
                <SelectItem value="delete">Eliminar</SelectItem>
                <SelectItem value="sign">Firmar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Usuario</label>
            <Input placeholder="Email..." value={filters.user_email} 
              onChange={(e) => setFilters({...filters, user_email: e.target.value})} />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Desde</label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Hasta</label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>
        <Button onClick={exportCSV} className="gap-2"><Download className="h-4 w-4" />Descargar CSV</Button>
      </Card>

      <div className="space-y-2">
        {isLoading ? <div className="text-center py-8 text-muted-foreground">Cargando...</div> : (
          filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No hay registros de auditoría</div>
          ) : (
            filteredLogs.map((log) => (
              <Card key={log.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge className={`text-xs border ${actionColors[log.action] || actionColors.view}`}>
                        {log.action.toUpperCase()}
                      </Badge>
                      <span className="font-semibold">{log.entity_type}</span>
                      <span className="text-sm text-muted-foreground">#{log.entity_id.slice(0, 8)}</span>
                    </div>
                    <div className="text-sm text-muted-foreground grid grid-cols-3 gap-4">
                      <div><strong>Usuario:</strong> {log.user_email}</div>
                      <div><strong>Rol:</strong> {log.user_role}</div>
                      <div><strong>Fecha:</strong> {format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm:ss', { locale: es })}</div>
                    </div>
                    {log.changed_fields && log.changed_fields.length > 0 && (
                      <div className="text-sm mt-2">
                        <strong>Campos:</strong> {log.changed_fields.join(', ')}
                      </div>
                    )}
                    {log.notes && <div className="text-sm text-muted-foreground mt-2">{log.notes}</div>}
                  </div>
                </div>
              </Card>
            ))
          )
        )}
      </div>
    </div>
  );
}