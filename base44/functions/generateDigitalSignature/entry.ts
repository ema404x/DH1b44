import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { crypto } from 'https://deno.land/std@0.208.0/crypto/mod.ts';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Solo admins pueden firmar' }, { status: 403 });
  }

  const { entity_type, entity_id, entity_data } = await req.json();

  try {
    // Crear hash SHA-256 del contenido
    const dataString = JSON.stringify(entity_data);
    const encoder = new TextEncoder();
    const data = encoder.encode(dataString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Crear firma digital
    const signature = {
      entity_type,
      entity_id,
      signer_email: user.email,
      signer_role: user.role,
      signature_hash: hashHex,
      timestamp: new Date().toISOString(),
      signature_algorithm: 'SHA256',
      is_valid: true,
      certificate: `CN=${user.full_name},O=Ministerio,C=AR`
    };

    const result = await base44.asServiceRole.entities.DigitalSignature.create(signature);

    // Registrar en auditoría
    await base44.functions.invoke('logAudit', {
      entity_type,
      entity_id,
      action: 'sign',
      notes: `Firmado digitalmente por ${user.full_name}`
    });

    return Response.json({ success: true, signatureId: result.id, hash: hashHex });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});