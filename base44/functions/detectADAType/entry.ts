import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { file_url } = await req.json();

  const tipoResult = await base44.integrations.Core.InvokeLLM({
    prompt: `Analizá este documento y determiná su tipo exacto:
- "abono_mensual": contrato de mantenimiento o servicio recurrente mensual
- "obra": presupuesto o contrato de obra civil con ítems de medición  
- "informe": informe de avance o certificado de medición con acumulados

Respondé SOLO con uno de esos tres valores, sin explicación ni puntuación.`,
    file_urls: [file_url],
    model: 'claude_sonnet_4_6'
  });

  const raw = (tipoResult || '').toString().trim().toLowerCase().replace(/[^a-z_]/g, '');
  const tipo = ['abono_mensual', 'obra', 'informe'].includes(raw) ? raw : 'obra';

  return Response.json({ tipo });
});