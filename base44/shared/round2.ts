// base44/shared/round2.ts
//
// Precisión financiera: 2 decimales con Number.EPSILON (regla de oro del proyecto:
// "2-decimal precision across all financial calculations").
// Evita drift float en certificados, KPIs y exports. El formato es-AR (coma
// decimal) va en la capa de presentación; acá solo número redondeado.

// Redondea a 2 decimales usando Number.EPSILON para corregir el error de
// representación binaria (ej: 1.005 → 1.01, no 1.00).
export function round2(n: number | null | undefined): number {
  if (!Number.isFinite(n as number)) return 0;
  return Math.round(((n as number) + Number.EPSILON) * 100) / 100;
}

// Suma un campo de una lista con precisión de 2 decimales. fn extrae el número
// de cada elemento; valores no finitos se tratan como 0.
export function sumRound2<T>(
  arr: T[] | null | undefined,
  fn: (x: T) => number | null | undefined,
): number {
  const total = (arr || []).reduce((s, x) => s + (Number(fn(x)) || 0), 0);
  return round2(total);
}