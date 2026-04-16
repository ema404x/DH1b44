import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Search, Download, FileText, TrendingUp, Users, Database, Zap, X } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

const actionColors = {
  create: 'bg-green-50 text-green-700 border-green-200',
  update: 'bg-blue-50 text-blue-700 border-blue-200',
  delete: 'bg-red-50 text-red-700 border-red-200',
  view: 'bg-gray-50 text-gray-700 border-gray-200',
  sign: 'bg-purple-50 text-purple-700 border-purple-200'
};

const actionIcons = {
  create: '➕',
  update: '✏️',
  delete: '🗑️',
  view: '👁️',
  sign: '✍️'
};

export default function Auditoria() {
  const [filters, setFilters] = useState({ entity_type: '', action: '', user_email: '' });
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');

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

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (dateFrom && new Date(log.timestamp) < new Date(dateFrom)) return false;
      if (dateTo && new Date(log.timestamp) > new Date(dateTo)) return false;
      if (search && !log.entity_id.includes(search) && !log.entity_type.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [logs, dateFrom, dateTo, search]);

  const stats = useMemo(() => {
    return {
      total: filteredLogs.length,
      byAction: filteredLogs.reduce((acc, log) => {
        acc[log.action] = (acc[log.action] || 0) + 1;
        return acc;
      }, {}),
      byUser: filteredLogs.reduce((acc, log) => {
        acc[log.user_email] = (acc[log.user_email] || 0) + 1;
        return acc;
      }, {}),
      byEntity: filteredLogs.reduce((acc, log) => {
        acc[log.entity_type] = (acc[log.entity_type] || 0) + 1;
        return acc;
      }, {})
    };
  }, [filteredLogs]);

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
    <div className="space-y-6">
      {/* Header */}
      <div className="px-6 pt-6">
        <h1 className="text-3xl font-bold">Auditoría</h1>
        <p className="text-muted-foreground mt-1">Registro de todas las acciones realizadas en el sistema</p>
      </div>

      {/* Estadísticas */}
      <div className="px-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 border border-border">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total de Acciones</p>
              <p className="text-2xl font-bold mt-1">{stats.total}</p>
            </div>
            <TrendingUp className="h-5 w-5 text-primary/40" />
          </div>
        </Card>
        <Card className="p-4 border border-border">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Usuarios Activos</p>
              <p className="text-2xl font-bold mt-1">{Object.keys(stats.byUser).length}</p>
            </div>
            <Users className="h-5 w-5 text-blue-500/40" />
          </div>
        </Card>
        <Card className="p-4 border border-border">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Entidades Modificadas</p>
              <p className="text-2xl font-bold mt-1">{Object.keys(stats.byEntity).length}</p>
            </div>
            <Database className="h-5 w-5 text-purple-500/40" />
          </div>
        </Card>
        <Card className="p-4 border border-border">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Borrados</p>
              <p className="text-2xl font-bold mt-1 text-red-600">{stats.byAction.delete || 0}</p>
            </div>
            <Zap className="h-5 w-5 text-red-500/40" />
          </div>
        </Card>
      </div>

      {/* Filtros */}
      <div className="px-6">
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Filtros</h3>
            {(filters.entity_type || filters.action || filters.user_email || dateFrom || dateTo || search) && (
              <button 
                onClick={() => { 
                  setFilters({ entity_type: '', action: '', user_email: '' }); 
                  setDateFrom(''); 
                  setDateTo(''); 
                  setSearch('');
                }}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <X className="h-3 w-3" /> Limpiar filtros
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Búsqueda</label>
              <Input 
                placeholder="ID o entidad..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tipo de Entidad</label>
              <Input 
                placeholder="WorkOrder, Certificado..." 
                value={filters.entity_type} 
                onChange={(e) => setFilters({...filters, entity_type: e.target.value})}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Acción</label>
              <Select value={filters.action} onValueChange={(v) => setFilters({...filters, action: v})}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Todas</SelectItem>
                  <SelectItem value="create">Crear</SelectItem>
                  <SelectItem value="update">Actualizar</SelectItem>
                  <SelectItem value="delete">Eliminar</SelectItem>
                  <SelectItem value="sign">Firmar</SelectItem>
                  <SelectItem value="view">Ver</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Usuario</label>
              <Input 
                placeholder="Email..." 
                value={filters.user_email} 
                onChange={(e) => setFilters({...filters, user_email: e.target.value})}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Desde</label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Hasta</label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 text-sm" />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button onClick={exportCSV} variant="outline" size="sm" className="gap-2">
              <Download className="h-3.5 w-3.5" />
              Descargar CSV
            </Button>
          </div>
        </Card>
      </div>

      {/* Listado */}
      <div className="px-6 pb-6">
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Cargando registros...</div>
        ) : filteredLogs.length === 0 ? (
          <Card className="p-12 text-center">
            <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No hay registros que coincidan con los filtros</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredLogs.map((log) => (
              <Card key={log.id} className="p-4 hover:shadow-sm hover:border-primary/20 transition-all group">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-base mt-0.5">
                    {actionIcons[log.action] || '⚙️'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <Badge className={`text-xs border ${actionColors[log.action] || actionColors.view}`}>
                        {log.action.toUpperCase()}
                      </Badge>
                      <span className="font-semibold text-sm">{log.entity_type}</span>
                      <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">{log.entity_id.slice(0, 12)}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs text-muted-foreground mb-2">
                      <div><strong className="text-foreground">Usuario:</strong> {log.user_email}</div>
                      <div><strong className="text-foreground">Rol:</strong> {log.user_role}</div>
                      <div><strong className="text-foreground">IP:</strong> {log.ip_address || '—'}</div>
                      <div className="text-right md:text-left"><strong className="text-foreground">Hace:</strong> {formatDistanceToNow(new Date(log.timestamp), { locale: es })} atrás</div>
                    </div>
                    {log.changed_fields && log.changed_fields.length > 0 && (
                      <div className="text-xs">
                        <strong className="text-foreground">Campos:</strong>
                        <div className="flex gap-1 flex-wrap mt-1">
                          {log.changed_fields.map((field, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">{field}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {log.notes && <div className="text-xs text-muted-foreground mt-2 italic">{log.notes}</div>}
                  </div>
                  <div className="text-xs text-muted-foreground text-right whitespace-nowrap">
                    {format(new Date(log.timestamp), 'dd/MM HH:mm', { locale: es })}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}