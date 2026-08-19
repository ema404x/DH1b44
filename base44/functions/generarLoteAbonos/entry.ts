import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const parseMonto = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  const clean = String(v).replace(/\./g, '').replace(',', '.');
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
};

// "2026-07" → 202607 (entero comparable)
function mesToInt(mes) {
  return parseInt(String(mes).replace('-', ''), 10);
}

// Mes actual en formato "YYYY-MM"
function currentMes() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Crea UN certificado para el mes dado.
// El PDF NO se genera aquí — se genera on-demand desde la página de Certificados.
// Esto evita el timeout de Cloudflare (120s) cuando hay muchos abonos.
async function generateOneCertificate(base44, abono, mesInfo, currentNum) {
  const duracionMeses = Math.max(parseInt(abono.duracion_meses) || 1, 1);
  const montoTotalContrato = parseMonto(abono.monto_total_contrato);
  const montoMensual = parseMonto(abono.monto_mensual) || (montoTotalContrato / duracionMeses);

  const { mesFormato, mesLabel, numeroEnContrato } = mesInfo;
  // El número de certificado es secuencial DENTRO del contrato (por OC/ADA):
  // mes 1 del contrato = cert N° 1, mes 2 = N° 2, etc.
  const numero = numeroEnContrato;

  // Los items del abono pueden representar el TOTAL del contrato (extraídos del PDF)
  // o el MONTO MENSUAL (si el usuario usó auto-fill). Solo usamos los items
  // si su suma coincide con el monto mensual; si suman el total del ADA/OC,
  // generamos un item único con el monto mensual calculado.
  const itemsSum = abono.items?.length
    ? abono.items.reduce((acc, it) => acc + parseMonto(it.importe_total), 0)
    : 0;
  const itemsMatchMonthly = itemsSum > 0 && Math.abs(itemsSum - montoMensual) < 1;

  const certItems = (abono.items?.length && itemsMatchMonthly)
    ? abono.items.map((it, idx) => ({
        numero: idx + 1,
        descripcion: it.descripcion || `Abono mensual – ${mesLabel}`,
        um: it.um || 'MES',
        cantidad: parseFloat(it.cantidad) || 1,
        importe_unitario: parseMonto(it.importe_unitario),
        importe_total: parseMonto(it.importe_total),
      }))
    : [{
        numero: 1,
        descripcion: `Abono mensual de mantenimiento – ${mesLabel}`,
        um: 'MES',
        cantidad: 1,
        importe_unitario: montoMensual,
        importe_total: montoMensual,
      }];

  const subtotalReal = montoMensual;
  const todayStr = new Date().toISOString().split('T')[0];

  const newCert = {
    numero,
    tipo: 'abono_mensual',
    estado: 'emitido',
    generado_automaticamente: true,
    contratista: abono.contratista,
    contratista_id: abono.created_by_id || '',
    emprendimiento: abono.emprendimiento || '',
    obra_servicio: abono.obra_servicio || '',
    ada_numero: abono.ada_numero || '',
    oc_numero: abono.oc_numero || '',
    mes_periodo: mesFormato,
    fecha_certificado: todayStr,
    fecha_inicio: abono.fecha_inicio_validez || '',
    plazo_obra: abono.plazo_obra || 'Mensual',
    plazo_entrega: abono.plazo_entrega || '',
    condiciones_pago: abono.condiciones_pago || '',
    monto_contratado: montoTotalContrato,
    subtotal: subtotalReal,
    anticipo_pct: abono.anticipo_pct || 0,
    fondo_reparo_pct: abono.fondo_reparo_pct || 0,
    items: certItems,
    sector_id: abono.sector_id || '',
  };

  const created = await base44.asServiceRole.entities.Certificado.create(newCert);

  return {
    generated: true,
    nextNum: numero,
    id: created.id,
    numero,
    numero_en_contrato: numeroEnContrato,
    mes: mesLabel,
    monto: subtotalReal,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// MOTOR DE CERTIFICACIÓN MENSUAL
// ---------------------------------------------------------------------------
// Certifica UN mes específico para todos los abonos activos cuya vigencia
// incluye ese mes. Sin PDF en batch (se genera on-demand). Idempotente.
// ════════════════════════════════════════════════════════════════════════════
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fail closed en sector: el admin solo certifica abonos de su sector activo.
    const callerSector = user.data?.sector_id || user.sector_id;
    if (!callerSector) {
      return Response.json({ error: 'Sin sector asignado' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { mes_target, regenerar = false, comunas = [], abono_id } = body;

    if (!mes_target) {
      return Response.json({ error: 'mes_target es requerido (formato YYYY-MM)' }, { status: 400 });
    }

    const mesMatch = String(mes_target).match(/^(\d{4})-(\d{2})$/);
    if (!mesMatch) {
      return Response.json({ error: 'mes_target debe tener formato YYYY-MM' }, { status: 400 });
    }
    const targetY = parseInt(mesMatch[1]);
    const targetM = parseInt(mesMatch[2]);
    if (targetM < 1 || targetM > 12) {
      return Response.json({ error: 'Mes inválido' }, { status: 400 });
    }

    const targetInt = mesToInt(mes_target);
    const currentInt = mesToInt(currentMes());
    if (targetInt > currentInt) {
      return Response.json({ error: 'No se puede certificar un mes futuro' }, { status: 400 });
    }

    const mesLabel = `${MESES_ES[targetM - 1]} ${targetY}`;

    // ── Obtener abonos a procesar ───────────────────────────────────────────
    // Al regenerar, incluir también abonos completados cuya vigencia cubre
    // el mes objetivo (pueden haberse completado en una generación previa
    // del mismo mes y quedar excluidos si solo se busca estado: 'activo').
    let abonos;
    if (abono_id) {
      const a = await base44.asServiceRole.entities.AbonoMaestro.get(abono_id);
      abonos = a ? [a] : [];
    } else {
      abonos = await base44.asServiceRole.entities.AbonoMaestro.filter({ sector_id: callerSector, estado: 'activo' });
      if (regenerar) {
        const completados = await base44.asServiceRole.entities.AbonoMaestro.filter({ sector_id: callerSector, estado: 'completado' });
        abonos = [...abonos, ...completados];
      }
    }

    // Aislar por sector incluso cuando se pide por abono_id (evita certificar un abono de otro sector).
    abonos = abonos.filter(a => (a.sector_id || callerSector) === callerSector);

    if (comunas.length > 0) {
      abonos = abonos.filter(a => comunas.includes(a.comuna));
    }

    // Número de certificado global (auto-incremental)
    const lastCerts = await base44.asServiceRole.entities.Certificado.filter({}, '-numero', 1);
    let currentNum = lastCerts.length > 0 ? (lastCerts[0].numero || 0) : 0;

    const results = [];
    let totalGenerated = 0;
    let totalSkipped = 0;

    for (const abono of abonos) {
      const duracionMeses = Math.max(parseInt(abono.duracion_meses) || 1, 1);
      const inicioMes = abono.fecha_inicio_validez ? abono.fecha_inicio_validez.slice(0, 7) : null;
      const finMes = abono.fecha_fin_validez ? abono.fecha_fin_validez.slice(0, 7) : null;

      const baseResult = {
        contratista: abono.contratista,
        comuna: abono.comuna || '—',
        mes: mesLabel,
      };

      // ── Validar vigencia del contrato ───────────────────────────────────
      if (!inicioMes || !finMes) {
        results.push({ ...baseResult, skipped: true, reason: 'Sin fechas de validez' });
        totalSkipped++;
        continue;
      }

      const inicioInt = mesToInt(inicioMes);
      const finInt = mesToInt(finMes);

      if (targetInt < inicioInt || targetInt > finInt) {
        results.push({ ...baseResult, skipped: true, reason: 'Fuera del contrato' });
        totalSkipped++;
        continue;
      }

      // ── Verificar duplicado para este mes ───────────────────────────────
      const existingForMonth = await base44.asServiceRole.entities.Certificado.filter({
        ada_numero: abono.ada_numero || '',
        tipo: 'abono_mensual',
        mes_periodo: mes_target,
      });

      if (existingForMonth.length > 0 && !regenerar) {
        results.push({ ...baseResult, skipped: true, reason: 'Ya certificado' });
        totalSkipped++;
        continue;
      }

      // Si regenerar, eliminar certificados automáticos previos de este mes
      // y sus solicitudes de aprobación vinculadas
      if (existingForMonth.length > 0 && regenerar) {
        for (const c of existingForMonth) {
          if (c.generado_automaticamente) {
            // Borrar solicitud vinculada antes de borrar el certificado
            try {
              const sols = await base44.asServiceRole.entities.SolicitudCertificado.filter({ certificado_id: c.id });
              for (const sol of sols) {
                await base44.asServiceRole.entities.SolicitudCertificado.delete(sol.id);
              }
            } catch (_) { /* no bloquear si falla */ }
            await base44.asServiceRole.entities.Certificado.delete(c.id);
          }
        }
      }

      // ── Calcular número de mes dentro del contrato ──────────────────────
      const inicioY = parseInt(inicioMes.slice(0, 4));
      const inicioM = parseInt(inicioMes.slice(5, 7));
      const monthIndex = (targetY - inicioY) * 12 + (targetM - inicioM);
      const numeroEnContrato = monthIndex + 1;

      try {
        const mesInfo = { mesFormato: mes_target, mesLabel, numeroEnContrato };
        const res = await generateOneCertificate(base44, abono, mesInfo, currentNum);
        currentNum = res.nextNum;
        totalGenerated++;

        // ── Crear solicitud de aprobación vinculada ───────────────────────
        const sectorId = abono.sector_id || callerSector;
        const numeroSol = `CERT-${res.id.slice(-6).toUpperCase()}`;
        try {
          await base44.asServiceRole.entities.SolicitudCertificado.create({
            numero: numeroSol,
            titulo: `Certificado N°${res.numero} — ${abono.contratista || abono.emprendimiento || ''} (${abono.comuna || ''})`,
            establecimiento: abono.emprendimiento || abono.obra_servicio || '',
            jefe_sitio: user.full_name || user.email || 'Sistema',
            jefe_sitio_email: user.email || '',
            descripcion_trabajo: abono.obra_servicio || `Abono mensual ${mesLabel}`,
            monto_solicitado: res.monto || 0,
            porcentaje_avance: 0,
            periodo: mesLabel,
            estado: 'enviada',
            prioridad: 'normal',
            certificado_id: res.id,
            sector_id: sectorId,
            historial: [{
              fecha: new Date().toISOString(),
              estado: 'enviada',
              usuario: user.full_name || user.email || 'Sistema',
              comentario: `Certificado automático N°${res.numero} — ${mesLabel}`,
            }],
          });
        } catch (solErr) {
          console.log(`Error creando solicitud para ${abono.contratista}:`, solErr.message);
        }

        // ── Actualizar progreso del abono (sin query adicional) ───────────
        const completado = numeroEnContrato >= duracionMeses;
        await base44.asServiceRole.entities.AbonoMaestro.update(abono.id, {
          certificados_emitidos: numeroEnContrato,
          lote_generado: true,
          estado: completado ? 'completado' : 'activo',
        });

        results.push({
          ...baseResult,
          generated: true,
          numero: res.numero,
          monto: res.monto,
        });
      } catch (e) {
        results.push({ ...baseResult, error: e.message });
        totalSkipped++;
      }
    }

    return Response.json({
      success: true,
      mes_target,
      mes_label: mesLabel,
      total_abonos: abonos.length,
      generated: totalGenerated,
      skipped: totalSkipped,
      results,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});