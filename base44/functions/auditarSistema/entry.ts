import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const issues = [];
    const warnings = [];

    try {
      // 1. Verificar empleados sin vinculación
      const employees = await base44.asServiceRole.entities.Employee.list();
      const unlinkedWithEmail = employees.filter(e => e.email && !e.user_id);
      if (unlinkedWithEmail.length > 0) {
        warnings.push({
          severity: 'warning',
          message: `${unlinkedWithEmail.length} empleados con email pero sin user_id vinculado`,
          count: unlinkedWithEmail.length
        });
      }

      // 2. Verificar duplicados de email
      const emailMap = {};
      const duplicates = [];
      for (const emp of employees) {
        if (!emp.email) continue;
        const email = emp.email.toLowerCase().trim();
        if (!emailMap[email]) emailMap[email] = [];
        emailMap[email].push(emp);
      }
      
      for (const [email, emps] of Object.entries(emailMap)) {
        if (emps.length > 1) {
          const linked = emps.filter(e => e.user_id).length;
          duplicates.push({
            email,
            count: emps.length,
            linked_count: linked,
            employees: emps.map(e => ({ id: e.id, name: e.full_name, status: e.status }))
          });
        }
      }

      if (duplicates.length > 0) {
        issues.push({
          severity: 'critical',
          title: 'Duplicados de Email',
          description: `${duplicates.length} emails con múltiples fichas de empleado`,
          data: duplicates
        });
      }

      // 3. Verificar roles sin permisos configurados
      const roles = await base44.asServiceRole.entities.RolePermission.list();
      const roleNames = roles.map(r => r.role_name.toLowerCase());
      const employeeRoles = [...new Set(employees.map(e => e.role?.toLowerCase()).filter(Boolean))];
      const missingRoles = employeeRoles.filter(role => !roleNames.includes(role));

      if (missingRoles.length > 0) {
        warnings.push({
          severity: 'warning',
          message: `${missingRoles.length} roles de empleados sin RolePermission configurado`,
          roles: missingRoles
        });
      }

      // 4. Verificar audit logs para anomalías
      const auditLogs = await base44.asServiceRole.entities.AuditLog.list('-created_date', 100);
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 3600000);
      
      const recentLogs = auditLogs.filter(log => {
        try {
          return new Date(log.created_date) > oneHourAgo;
        } catch {
          return false;
        }
      });

      // Detectar alta frecuencia de cambios por usuario
      const userActivityMap = {};
      for (const log of recentLogs) {
        const userId = log.user_id || 'unknown';
        if (!userActivityMap[userId]) userActivityMap[userId] = [];
        userActivityMap[userId].push(log);
      }

      const highActivityUsers = Object.entries(userActivityMap).filter(([_, logs]) => logs.length > 20);
      if (highActivityUsers.length > 0) {
        warnings.push({
          severity: 'info',
          message: `${highActivityUsers.length} usuarios con alta actividad en última hora`,
          count: highActivityUsers.length
        });
      }

      // 5. Verificar certificados en estado inconsistente
      const certs = await base44.asServiceRole.entities.Certificado.list('-created_date', 100);
      const inconsistent = certs.filter(c => {
        if (c.estado === 'aprobado' && !c.aprobado_por) return true;
        if (c.estado === 'emitido' && !c.numero) return true;
        return false;
      });

      if (inconsistent.length > 0) {
        issues.push({
          severity: 'warning',
          title: 'Certificados Inconsistentes',
          description: `${inconsistent.length} certificados con datos incompletos`,
          count: inconsistent.length
        });
      }

    } catch (error) {
      return Response.json({
        error: `Error durante auditoría: ${error.message}`,
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

    return Response.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        critical_issues: issues.filter(i => i.severity === 'critical').length,
        warnings: warnings.length,
        info: warnings.filter(w => w.severity === 'info').length
      },
      issues,
      warnings
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});