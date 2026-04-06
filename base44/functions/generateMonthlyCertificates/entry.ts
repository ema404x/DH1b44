import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Calcula el último día hábil del mes (lunes-viernes, sin feriados argentinos)
function getLastBusinessDayOfMonth(year, month) {
  // Feriados argentinos fijos
  const fixedHolidays = [
    { month: 1, day: 1 },   // Año Nuevo
    { month: 5, day: 1 },   // Día del Trabajo
    { month: 7, day: 9 },   // Independencia
    { month: 12, day: 25 }, // Navidad
  ];

  const isHoliday = (date) => {
    return fixedHolidays.some(h => h.month === date.getMonth() + 1 && h.day === date.getDate());
  };

  const isBusinessDay = (date) => {
    const dayOfWeek = date.getDay();
    return dayOfWeek !== 0 && dayOfWeek !== 6 && !isHoliday(date);
  };

  // Obtener último día del mes
  const lastDay = new Date(year, month, 0).getDate();
  let date = new Date(year, month - 1, lastDay);

  // Retroceder hasta encontrar un día hábil
  while (!isBusinessDay(date)) {
    date.setDate(date.getDate() - 1);
  }

  return date;
}

// Obtiene el número secuencial del próximo certificado
async function getNextCertificateNumber(base44, contratista, mes) {
  const existingCerts = await base44.asServiceRole.entities.Certificado.filter({
    contratista: contratista,
    mes_periodo: mes
  });
  
  return (existingCerts.length || 0) + 1;
}

// Obtiene contratistas activos
async function getActiveContractors(base44) {
  const clients = await base44.asServiceRole.entities.Client.filter({ status: 'activo' });
  return clients;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Solo admin puede ejecutar esto
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;

    // Calcular último día hábil del mes actual
    const lastBusinessDay = getLastBusinessDayOfMonth(year, month);
    
    // Comparar solo la fecha (sin hora)
    const isLastBusinessDay = 
      today.getDate() === lastBusinessDay.getDate() &&
      today.getMonth() === lastBusinessDay.getMonth() &&
      today.getFullYear() === lastBusinessDay.getFullYear();

    if (!isLastBusinessDay) {
      return Response.json({ 
        message: `No es el último día hábil. Próxima ejecución: ${lastBusinessDay.toLocaleDateString('es-AR')}`,
        shouldRun: false
      });
    }

    // Obtener contratistas activos
    const contractors = await getActiveContractors(base44);
    const generatedCerts = [];

    // Generar certificado para cada contratista
    for (const contractor of contractors) {
      const certNumber = await getNextCertificateNumber(base44, contractor.name, `${year}-${String(month).padStart(2, '0')}`);
      
      const newCert = {
        numero: certNumber,
        tipo: 'abono_mensual',
        estado: 'emitido',
        contratista: contractor.name,
        mes_periodo: `${year}-${String(month).padStart(2, '0')}`,
        fecha_certificado: today.toISOString().split('T')[0],
        items: [],
        subtotal: 0,
        anticipo_pct: 0,
        fondo_reparo_pct: 5,
      };

      const created = await base44.asServiceRole.entities.Certificado.create(newCert);
      generatedCerts.push({
        id: created.id,
        numero: certNumber,
        contratista: contractor.name,
        mes: `${year}-${String(month).padStart(2, '0')}`
      });
    }

    return Response.json({ 
      success: true,
      message: `Se generaron ${generatedCerts.length} certificados mensuales`,
      generatedCertificates: generatedCerts,
      executionDate: today.toLocaleDateString('es-AR')
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});