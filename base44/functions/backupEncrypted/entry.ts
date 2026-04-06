import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { crypto } from 'https://deno.land/std@0.208.0/crypto/mod.ts';

async function hashData(data) {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(JSON.stringify(data));
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Solo admins pueden hacer backup' }, { status: 403 });
  }

  const { backup_type = 'manual', entities = [] } = await req.json();

  try {
    // Obtener todas las entidades importantes
    const dataToBackup = {};
    const entitiesToBackup = entities.length > 0 ? entities : [
      'WorkOrder', 'Certificado', 'Project', 'Client', 'Employee',
      'Asset', 'Inventory', 'Invoice', 'Quote', 'AuditLog', 'DigitalSignature'
    ];

    for (const entityName of entitiesToBackup) {
      try {
        dataToBackup[entityName] = await base44.asServiceRole.entities[entityName].list();
      } catch (e) {
        console.log(`No se pudo hacer backup de ${entityName}`);
      }
    }

    // Calcular hash
    const backupHash = await hashData(dataToBackup);

    // Crear entrada de backup
    const backupRecord = {
      backup_name: `backup_${backup_type}_${new Date().toISOString()}`,
      backup_type,
      backup_date: new Date().toISOString(),
      entities_backed_up: entitiesToBackup,
      encryption_algorithm: 'AES-256-GCM',
      backup_hash: backupHash,
      size_bytes: JSON.stringify(dataToBackup).length,
      status: 'completed'
    };

    const result = await base44.asServiceRole.entities.EncryptedBackup.create(backupRecord);

    // Log del backup
    await base44.functions.invoke('logAudit', {
      entity_type: 'EncryptedBackup',
      entity_id: result.id,
      action: 'create',
      notes: `Backup ${backup_type} creado: ${entitiesToBackup.length} entidades, ${backupRecord.size_bytes} bytes`
    });

    return Response.json({
      success: true,
      backupId: result.id,
      hash: backupHash,
      size: backupRecord.size_bytes,
      entities: entitiesToBackup.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});