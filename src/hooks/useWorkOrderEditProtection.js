import { base44 } from '@/api/base44Client';

export async function useWorkOrderEditProtection(workOrderId) {
  const user = await base44.auth.me();
  
  // Solo admin puede editar órdenes de trabajo
  if (user?.role !== 'admin') {
    return {
      canEdit: false,
      reason: 'Solo administradores pueden modificar órdenes de trabajo',
      user
    };
  }

  return {
    canEdit: true,
    reason: null,
    user
  };
}

export async function logWorkOrderEdit(workOrderId, oldData, newData, changedFields) {
  const user = await base44.auth.me();
  
  await base44.functions.invoke('logAudit', {
    entity_type: 'WorkOrder',
    entity_id: workOrderId,
    action: 'update',
    old_values: oldData,
    new_values: newData,
    changed_fields: changedFields,
    notes: `Modificado por ${user.full_name}`
  });
}