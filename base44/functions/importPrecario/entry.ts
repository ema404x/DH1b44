import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Importa el preciario desde una URL de archivo Excel (.xlsx) ya subido
// Parsea la hoja PREMOD y carga todos los ítems a la entidad PrecarioMinisterio

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { file_url, comuna } = await req.json();
    if (!file_url || !comuna) {
      return Response.json({ error: 'file_url y comuna son requeridos' }, { status: 400 });
    }

    // Extraer los datos del Excel usando la integración de base44
    const extracted = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                numero: { type: "number" },
                codigo: { type: "string" },
                descripcion: { type: "string" },
                unidad: { type: "string" },
                cantidad: { type: "number" },
                pu_mat: { type: "number" },
                pu_mo: { type: "number" },
                pu_mat_coef_pase: { type: "number" },
                pu_mo_coef_pase: { type: "number" },
                total_coef_pase: { type: "number" },
                total_coef_oferta: { type: "number" },
                total_oferta_mejores: { type: "number" },
                categoria: { type: "string" },
                subcategoria: { type: "string" }
              }
            }
          }
        }
      }
    });

    if (extracted.status !== 'success' || !extracted.output?.items?.length) {
      return Response.json({ error: 'No se pudieron extraer datos', details: extracted.details }, { status: 400 });
    }

    const items = extracted.output.items;

    // Borrar preciario anterior de esta comuna
    const existing = await base44.asServiceRole.entities.PrecarioMinisterio.filter({ comuna });
    for (const item of existing) {
      await base44.asServiceRole.entities.PrecarioMinisterio.delete(item.id);
    }

    // Insertar nuevos en lotes de 50
    const BATCH = 50;
    let created = 0;
    const coef_pase = 1.6504;
    const coef_oferta = 1.38;

    for (let i = 0; i < items.length; i += BATCH) {
      const batch = items.slice(i, i + BATCH).map(item => ({
        codigo: item.codigo || '',
        descripcion: item.descripcion || '',
        unidad: item.unidad || 'UN',
        categoria: item.categoria || '',
        subcategoria: item.subcategoria || '',
        comuna,
        pu_mat: item.pu_mat || 0,
        pu_mo: item.pu_mo || 0,
        pu_mat_coef_pase: item.pu_mat_coef_pase || 0,
        pu_mo_coef_pase: item.pu_mo_coef_pase || 0,
        coef_pase,
        coef_oferta,
        total_coef_pase: item.total_coef_pase || 0,
        total_coef_oferta: item.total_oferta_mejores || item.total_coef_oferta || 0,
        activo: true
      })).filter(item => item.codigo && item.descripcion);

      if (batch.length > 0) {
        await base44.asServiceRole.entities.PrecarioMinisterio.bulkCreate(batch);
        created += batch.length;
      }
    }

    return Response.json({
      success: true,
      message: `Preciario ${comuna} importado: ${created} ítems`,
      total: created
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});