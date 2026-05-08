import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertTriangle, XCircle, Users } from 'lucide-react';

export default function DiagnosticoVinculacion() {
  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list('-created_date', 200)
  });

  const { data: rolePermissions = [] } = useQuery({
    queryKey: ['rolePermissions'],
    queryFn: () => base44.entities.RolePermission.list()
  });

  const validRoleNames = rolePermissions.map(r => r.role_name.toLowerCase().trim());

  const diagnosed = employees
    .filter(e => e.email) // solo los que tienen email (pueden vincularse)
    .map(emp => {
      const roleOk = emp.role && validRoleNames.includes(emp.role.toLowerCase().trim());
      const vinculado = !!emp.user_id;
      let status, label;

      if (!emp.role) {
        status = 'sin_rol';
        label = 'Sin rol asignado';
      } else if (!roleOk) {
        status = 'rol_invalido';
        label = `Rol "${emp.role}" no existe en Permisos`;
      } else if (!vinculado) {
        status = 'no_vinculado';
        label = 'Rol OK, pendiente de primer login';
      } else {
        status = 'ok';
        label = 'Vinculado correctamente';
      }

      return { ...emp, status, label };
    });

  const counts = {
    ok: diagnosed.filter(e => e.status === 'ok').length,
    no_vinculado: diagnosed.filter(e => e.status === 'no_vinculado').length,
    rol_invalido: diagnosed.filter(e => e.status === 'rol_invalido').length,
    sin_rol: diagnosed.filter(e => e.status === 'sin_rol').length,
  };

  const problemas = diagnosed.filter(e => e.status !== 'ok' && e.status !== 'no_vinculado');

  const statusConfig = {
    ok: { icon: CheckCircle2, color: 'text-emerald-400', badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
    no_vinculado: { icon: AlertTriangle, color: 'text-amber-400', badge: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
    rol_invalido: { icon: XCircle, color: 'text-red-400', badge: 'bg-red-500/15 text-red-400 border-red-500/20' },
    sin_rol: { icon: XCircle, color: 'text-red-400', badge: 'bg-red-500/15 text-red-400 border-red-500/20' },
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          Diagnóstico de Vinculación de Empleados
        </CardTitle>
        <div className="flex flex-wrap gap-3 mt-2 text-sm">
          <span className="flex items-center gap-1.5 text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" />{counts.ok} correctos</span>
          <span className="flex items-center gap-1.5 text-amber-400"><AlertTriangle className="h-3.5 w-3.5" />{counts.no_vinculado} pendientes de login</span>
          {counts.rol_invalido > 0 && <span className="flex items-center gap-1.5 text-red-400"><XCircle className="h-3.5 w-3.5" />{counts.rol_invalido} con rol inválido</span>}
          {counts.sin_rol > 0 && <span className="flex items-center gap-1.5 text-red-400"><XCircle className="h-3.5 w-3.5" />{counts.sin_rol} sin rol</span>}
        </div>
      </CardHeader>

      {problemas.length > 0 && (
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3 font-medium">⚠️ Empleados que requieren corrección:</p>
          <div className="space-y-2">
            {problemas.map(emp => {
              const cfg = statusConfig[emp.status];
              const Icon = cfg.icon;
              return (
                <div key={emp.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 flex-shrink-0 ${cfg.color}`} />
                    <div>
                      <p className="text-sm font-medium">{emp.full_name}</p>
                      <p className="text-xs text-muted-foreground">{emp.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center text-[10px] px-2 py-0.5 rounded-full border font-medium ${cfg.badge}`}>
                      {emp.label}
                    </span>
                    {emp.role && (
                      <p className="text-[10px] text-muted-foreground mt-1">Rol actual: <code className="bg-muted px-1 rounded">{emp.role}</code></p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Para corregir: ir a <strong>Empleados</strong> y cambiar el rol del empleado a uno de los definidos en esta pantalla.
          </p>
        </CardContent>
      )}

      {problemas.length === 0 && diagnosed.length > 0 && (
        <CardContent>
          <p className="text-sm text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Todos los empleados con email tienen roles válidos.
          </p>
        </CardContent>
      )}
    </Card>
  );
}