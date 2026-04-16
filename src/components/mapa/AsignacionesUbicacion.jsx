import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Building2, Users, UserPlus, X, MapPin, Activity, Check } from 'lucide-react';
import { format, subDays, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

const COLOR_HEX = {
  blue: '#3b82f6', green: '#10b981', purple: '#a855f7',
  orange: '#f97316', red: '#ef4444', yellow: '#eab308', pink: '#ec4899',
};

export default function AsignacionesUbicacion({ locations, employees, logs, onUpdate }) {
  const [selectedLoc, setSelectedLoc] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tempAssigned, setTempAssigned] = useState([]);

  // Last 7 days stats per location
  const locStats = useMemo(() => {
    const cutoff = subDays(new Date(), 7);
    const stats = {};
    logs.forEach(log => {
      if (new Date(log.timestamp) < cutoff) return;
      const locName = log.location_name;
      if (!locName) return;
      if (!stats[locName]) stats[locName] = { total: 0, employees: new Set() };
      stats[locName].total += 1;
      stats[locName].employees.add(log.employee_name);
    });
    return stats;
  }, [logs]);

  // Employees who visited each location in last 7 days
  const getRecentEmployees = (locName) => {
    return locStats[locName] ? [...locStats[locName].employees] : [];
  };

  const openAssign = (loc) => {
    setSelectedLoc(loc);
    setTempAssigned(loc.assigned_employees || []);
    setDialogOpen(true);
  };

  const toggleEmployee = (empName) => {
    setTempAssigned(prev =>
      prev.includes(empName) ? prev.filter(e => e !== empName) : [...prev, empName]
    );
  };

  const saveAssignments = async () => {
    setSaving(true);
    await onUpdate(selectedLoc.id, { assigned_employees: tempAssigned });
    setSaving(false);
    setDialogOpen(false);
    toast.success('Asignaciones guardadas');
  };

  const allEmployeeNames = useMemo(() =>
    [...new Set([
      ...employees.map(e => e.full_name),
      ...logs.map(l => l.employee_name).filter(Boolean),
    ])].sort(),
    [employees, logs]
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Asignación de cuadrillas por ubicación</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Asigná empleados y cuadrillas a cada ubicación. También se muestra actividad reciente de los últimos 7 días.</p>
      </div>

      {locations.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-xl py-16 text-center">
          <Building2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Sin ubicaciones. Creá una en la pestaña "Gestión de Ubicaciones".</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {locations.map(loc => {
            const hex = COLOR_HEX[loc.color] || COLOR_HEX.blue;
            const assigned = loc.assigned_employees || [];
            const recentEmps = getRecentEmployees(loc.name);
            const stat = locStats[loc.name];

            return (
              <Card key={loc.id} className="overflow-hidden hover:shadow-md transition-all">
                <div className="h-1.5 w-full" style={{ background: hex }} />
                <CardContent className="pt-4 pb-4 px-4">
                  {/* Header */}
                  <div className="flex items-start gap-2.5 mb-3">
                    <div className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: hex + '22' }}>
                      <Building2 className="h-4 w-4" style={{ color: hex }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{loc.name}</p>
                      {loc.address && <p className="text-xs text-muted-foreground truncate">{loc.address}</p>}
                    </div>
                    <Badge variant={loc.is_active ? 'default' : 'secondary'} className="text-[10px] px-1.5 flex-shrink-0">
                      {loc.is_active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>

                  {/* Assigned employees */}
                  <div className="mb-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Asignados</span>
                    </div>
                    {assigned.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">Sin cuadrilla asignada</p>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {assigned.map(emp => (
                          <Badge key={emp} variant="secondary" className="text-xs py-0.5">{emp}</Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recent activity */}
                  {stat && (
                    <div className="mb-3 rounded-lg bg-muted/40 px-3 py-2">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Activity className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase">Últimos 7 días</span>
                      </div>
                      <div className="flex gap-4 text-xs">
                        <span><strong>{stat.total}</strong> fichajes</span>
                        <span><strong>{stat.employees.size}</strong> empleados</span>
                      </div>
                      {recentEmps.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {recentEmps.slice(0, 3).map(e => (
                            <span key={e} className="text-[10px] bg-white border border-border/60 rounded px-1.5 py-0.5">{e}</span>
                          ))}
                          {recentEmps.length > 3 && (
                            <span className="text-[10px] text-muted-foreground">+{recentEmps.length - 3} más</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-8 gap-2 text-xs"
                    onClick={() => openAssign(loc)}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Gestionar cuadrilla
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Assignment Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Cuadrilla — {selectedLoc?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              Seleccioná los empleados asignados a esta ubicación. Los empleados con actividad reciente aparecen primero.
            </p>

            {/* Recent employees section */}
            {selectedLoc && getRecentEmployees(selectedLoc.name).length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Con actividad reciente</p>
                <div className="space-y-1">
                  {getRecentEmployees(selectedLoc.name).map(empName => {
                    const isAssigned = tempAssigned.includes(empName);
                    return (
                      <div
                        key={empName}
                        onClick={() => toggleEmployee(empName)}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                          isAssigned ? 'bg-primary/10 border-primary/30' : 'bg-muted/30 border-border hover:bg-muted/60'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`h-5 w-5 rounded-full flex items-center justify-center ${isAssigned ? 'bg-primary' : 'bg-muted'}`}>
                            {isAssigned && <Check className="h-3 w-3 text-primary-foreground" />}
                          </div>
                          <span className="text-sm font-medium">{empName}</span>
                        </div>
                        <Badge variant="outline" className="text-[10px]">Activo</Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* All employees */}
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Todos los empleados</p>
              <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                {allEmployeeNames
                  .filter(n => !getRecentEmployees(selectedLoc?.name || '').includes(n))
                  .map(empName => {
                    const isAssigned = tempAssigned.includes(empName);
                    return (
                      <div
                        key={empName}
                        onClick={() => toggleEmployee(empName)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                          isAssigned ? 'bg-primary/10 border-primary/30' : 'bg-muted/30 border-border hover:bg-muted/60'
                        }`}
                      >
                        <div className={`h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0 ${isAssigned ? 'bg-primary' : 'bg-muted'}`}>
                          {isAssigned && <Check className="h-3 w-3 text-primary-foreground" />}
                        </div>
                        <span className="text-sm">{empName}</span>
                      </div>
                    );
                  })}
              </div>
            </div>

            {tempAssigned.length > 0 && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                <p className="text-xs font-semibold text-primary mb-1">{tempAssigned.length} asignado{tempAssigned.length !== 1 ? 's' : ''}</p>
                <div className="flex flex-wrap gap-1">
                  {tempAssigned.map(e => (
                    <Badge key={e} className="text-[10px] py-0 gap-1">
                      {e}
                      <X className="h-2.5 w-2.5 cursor-pointer" onClick={() => toggleEmployee(e)} />
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2 border-t">
            <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={saveAssignments} disabled={saving}>
              Guardar asignaciones
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}