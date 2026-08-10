// Lógica de acumulación de medición para certificados, centralizada para que
// editor, vista previa y PDF coincidan siempre.
//
// Reglas profesionales:
//  - importe = unidad × precio_unitario en cada tramo (anterior y presente).
//  - acumulado presente = acumulado anterior + presente.
//  - saldo = max(0, cantidad − acumulado presente) y max(0, total − acum. presente $).
//  - El operario puede editar la unidad O el importe de cada tramo; el otro se
//    recalcula coherente (ambos editables y coherentes).
//  - Si el acumulado supera la cantidad contratada se marca sobrecertificación.

export const parseMonto = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const s = String(v).trim();
  const dots = (s.match(/\./g) || []).length;
  const commas = (s.match(/,/g) || []).length;
  let norm = s;
  if (dots > 1) { norm = s.replace(/\./g, '').replace(',', '.'); }
  else if (dots === 1 && commas === 0) { if ((s.split('.')[1] || '').length > 2) norm = s.replace('.', ''); }
  else if (commas >= 1) { norm = dots === 0 && commas === 1 ? s.replace(',', '.') : s.replace(/\./g, '').replace(',', '.'); }
  const n = parseFloat(norm);
  return isNaN(n) ? 0 : n;
};
export const round0 = (n) => Math.round(parseMonto(n));
export const round2 = (n) => Math.round(parseMonto(n) * 100) / 100;

// Recalcula los campos derivados confiando en que los pares (unidad, importe)
// de cada tramo ya son coherentes (los handlers aplicar* lo garantizan).
// Acá solo se acumula, se calcula el saldo y se marca sobrecertificación.
export function recalcItem(item) {
  const cantidad = round0(item.cantidad);
  const pu = round0(item.importe_unitario);
  const importe_total = (cantidad > 0 && pu > 0) ? cantidad * pu : round0(item.importe_total);

  const aau = round2(item.med_acum_anterior_unidad);
  const aa$ = round0(item.med_acum_anterior_importe);
  const pu_u = round2(item.med_presente_unidad);
  const p$ = round0(item.med_presente_importe);

  const apu = round2(aau + pu_u);
  const ap$ = round0(aa$ + p$);
  const su = Math.max(0, round2(cantidad - apu));
  const s$ = Math.max(0, importe_total - ap$);
  const sobrecertificado = cantidad > 0 && apu > cantidad + 0.001;

  return {
    ...item,
    cantidad,
    importe_unitario: pu,
    importe_total,
    med_acum_anterior_unidad: aau,
    med_acum_anterior_importe: aa$,
    med_presente_unidad: pu_u,
    med_presente_importe: p$,
    med_acum_presente_unidad: apu,
    med_acum_presente_importe: ap$,
    saldo_pendiente_unidad: su,
    saldo_pendiente_importe: s$,
    _sobrecertificado: sobrecertificado,
  };
}

// Editar UNIDAD del tramo presente → importe = unidad × pu
export function aplicarPresenteUnidad(item, unidad) {
  const pu = round0(item.importe_unitario);
  const u = round2(unidad);
  return { ...item, med_presente_unidad: u, med_presente_importe: Math.round(u * pu), _med_editado: true };
}
// Editar IMPORTE del tramo presente → unidad = importe / pu
export function aplicarPresenteImporte(item, importe) {
  const pu = round0(item.importe_unitario);
  const imp = round0(importe);
  return { ...item, med_presente_importe: imp, med_presente_unidad: pu > 0 ? round2(imp / pu) : 0, _med_editado: true };
}
// Editar UNIDAD del tramo anterior → importe = unidad × pu (marca override)
export function aplicarAnteriorUnidad(item, unidad) {
  const pu = round0(item.importe_unitario);
  const u = round2(unidad);
  return { ...item, med_acum_anterior_unidad: u, med_acum_anterior_importe: Math.round(u * pu), _anterior_override: true };
}
// Editar IMPORTE del tramo anterior → unidad = importe / pu (marca override)
export function aplicarAnteriorImporte(item, importe) {
  const pu = round0(item.importe_unitario);
  const imp = round0(importe);
  return { ...item, med_acum_anterior_importe: imp, med_acum_anterior_unidad: pu > 0 ? round2(imp / pu) : 0, _anterior_override: true };
}

// Al cambiar cantidad o precio unitario: recalcula importe_total y, si el
// presente fue editado, mantiene la unidad elegida y recalcula su importe.
// Si no fue editado, el presente cubre todo el ítem (unidad = cantidad).
export function aplicarCantidadPu(item) {
  const cantidad = round0(item.cantidad);
  const pu = round0(item.importe_unitario);
  const importe_total = cantidad * pu;
  const next = { ...item, cantidad, importe_unitario: pu, importe_total };
  if (item._med_editado) {
    next.med_presente_importe = Math.round(round2(item.med_presente_unidad) * pu);
  } else {
    next.med_presente_unidad = cantidad;
    next.med_presente_importe = importe_total;
  }
  return next;
}

// Trae el acumulado presente del certificado previo como acumulado anterior de
// los ítems actuales, emparejando por número (fallback descripción). Respeta
// los ítems que el usuario ya sobreescribió (_anterior_override).
export function matchAnteriorDesdeCert(items, certAnterior) {
  if (!certAnterior?.items?.length) return items;
  const byNumero = new Map();
  const byDesc = new Map();
  for (const it of certAnterior.items) {
    if (it.numero != null && it.numero !== '') byNumero.set(Number(it.numero), it);
    const d = (it.descripcion || '').trim().toLowerCase();
    if (d) byDesc.set(d, it);
  }
  return items.map(it => {
    if (it._anterior_override) return it;
    const prev = byNumero.get(Number(it.numero)) || byDesc.get((it.descripcion || '').trim().toLowerCase());
    if (!prev) return { ...it, med_acum_anterior_unidad: 0, med_acum_anterior_importe: 0 };
    return {
      ...it,
      med_acum_anterior_unidad: round2(prev.med_acum_presente_unidad ?? prev.med_acum_anterior_unidad ?? 0),
      med_acum_anterior_importe: round0(prev.med_acum_presente_importe ?? prev.med_acum_anterior_importe ?? 0),
    };
  });
}

// Cálculo centralizado de los totales financieros de un certificado.
// Editor, vista previa y PDF llaman a esta ÚNICA función → producen números
// idénticos siempre. Una sola fuente de verdad elimina la divergencia entre
// las tres vistas (causa raíz de los totales que no coincidían al abrir un
// certificado guardado: el editor detectaba hasMedicion solo por _med_editado
// mientras preview/PDF usaban una regla distinta).
//
// Semántica de negocio:
//  - subtotalContrato = Σ importe_total de los ítems = valor total del contrato.
//  - hasMedicion = true si algún ítem fue editado (_med_editado) o si su monto
//    presente difiere del total contratado del ítem. Definición ÚNICA.
//  - baseCalculo = monto PARCIAL a certificar (totalPresente si hay medición;
//    sino el total del contrato). Base de anticipo y fondo de reparo.
//  - Anticipo y fondo de reparo → sobre baseCalculo (el parcial).
//  - % pagado anteriormente → sobre el PARCIAL a certificar (baseCalculo),
//    igual que anticipo y fondo de reparo. Todas las deducciones sobre la misma base.
//  - Saldo pendiente = max(0, contrato − acumulado). Llega a 0 al 100%.
export function calcularTotales(form) {
  const items = (form && form.items) || [];
  const totalItem = (it) =>
    round0(it.importe_total) || Math.round(parseMonto(it.cantidad) * round0(it.importe_unitario));

  const subtotalContrato = round0(items.reduce((acc, it) => acc + totalItem(it), 0));

  const hasMedicion = items.some((it) => {
    if (it._med_editado) return true;
    if (it.med_presente_importe == null) return false;
    return round0(it.med_presente_importe) !== totalItem(it);
  });

  const totalPresente = hasMedicion
    ? round0(items.reduce((acc, it) => acc + round0(it.med_presente_importe), 0))
    : 0;
  const totalAcumAnterior = round0(
    items.reduce((acc, it) => acc + round0(it.med_acum_anterior_importe), 0)
  );

  const pctB = parseMonto(form.porcentaje_pagado_anteriormente) || 0;
  const anteriorPorB = pctB > 0 ? Math.round(subtotalContrato * (pctB / 100)) : 0;
  const acumuladoAnterior = Math.max(totalAcumAnterior, anteriorPorB);
  const acumuladoTotal = acumuladoAnterior + totalPresente;
  const totalSaldo = hasMedicion ? Math.max(0, subtotalContrato - acumuladoTotal) : 0;

  const baseCalculo = hasMedicion ? totalPresente : subtotalContrato;

  const anticipo =
    form.anticipo_monto_manual != null
      ? round0(form.anticipo_monto_manual)
      : parseMonto(form.anticipo_pct) > 0
        ? Math.round(baseCalculo * (parseMonto(form.anticipo_pct) / 100))
        : 0;
  const fondoReparoMonto =
    form.fondo_reparo_monto_manual != null
      ? round0(form.fondo_reparo_monto_manual)
      : parseMonto(form.fondo_reparo_pct) > 0
        ? Math.round(baseCalculo * (parseMonto(form.fondo_reparo_pct) / 100))
        : 0;
  const fondoReparo = form.fondo_reparo_aplicar ? fondoReparoMonto : 0;

  // % pagado anteriormente: deducción sobre el PARCIAL a certificar (baseCalculo),
  // igual que anticipo y fondo de reparo. Coherente: nunca genera neto negativo.
  const pagadoAnteriormente = pctB > 0 ? Math.round(baseCalculo * (pctB / 100)) : 0;

  const totalNeto = baseCalculo - anticipo - fondoReparo - pagadoAnteriormente;

  const pctAnterior = subtotalContrato > 0 ? (acumuladoAnterior / subtotalContrato) * 100 : 0;
  const pctActual = subtotalContrato > 0 ? (totalPresente / subtotalContrato) * 100 : 0;
  const pctFinal = pctAnterior + pctActual;
  const pctRestante = Math.max(0, 100 - pctFinal);
  const overCertContrato = pctFinal > 100.01;
  const pctCertificado = subtotalContrato > 0 ? (totalPresente / subtotalContrato) * 100 : 0;

  return {
    subtotalContrato,
    hasMedicion,
    totalPresente,
    totalAcumAnterior,
    acumuladoAnterior,
    acumuladoTotal,
    totalSaldo,
    baseCalculo,
    anticipo,
    fondoReparoMonto,
    fondoReparo,
    pagadoAnteriormente,
    totalNeto,
    pctAnterior,
    pctActual,
    pctFinal,
    pctRestante,
    overCertContrato,
    pctCertificado,
    anteriorPorB,
  };
}