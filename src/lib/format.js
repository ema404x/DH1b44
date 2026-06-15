/**
 * Shared formatting utilities — import these everywhere for consistency.
 * All monetary values are in ARS with Argentine locale separators.
 */

import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

// ─── Currency ────────────────────────────────────────────────────────────────

/** Full ARS amount: $ 1.800.000 */
export const fmtCurrency = (n) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n ?? 0);

/** Compact: 1.8M / 450K / 320 */
export const fmtCurrencyCompact = (n) => {
  const v = n ?? 0;
  if (Math.abs(v) >= 1_000_000)
    return `$${(v / 1_000_000).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`;
  if (Math.abs(v) >= 1_000)
    return `$${(v / 1_000).toLocaleString('es-AR', { maximumFractionDigits: 0 })}K`;
  return `$${v.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
};

/** Plain number with thousands separator: 1.800.000 */
export const fmtNumber = (n, decimals = 0) =>
  (n ?? 0).toLocaleString('es-AR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

/** Percentage: 83.5% */
export const fmtPct = (n, decimals = 1) =>
  `${fmtNumber(n ?? 0, decimals)}%`;

// ─── Dates ───────────────────────────────────────────────────────────────────

/** dd/MM/yy — e.g. 15/06/26 */
export const fmtDateShort = (d) => {
  try { return d ? format(parseISO(d), 'dd/MM/yy') : '—'; } catch { return '—'; }
};

/** dd/MM/yyyy — e.g. 15/06/2026 */
export const fmtDate = (d) => {
  try { return d ? format(parseISO(d), 'dd/MM/yyyy') : '—'; } catch { return '—'; }
};

/** "15 jun. 2026" */
export const fmtDateLong = (d) => {
  try { return d ? format(parseISO(d), "d MMM yyyy", { locale: es }) : '—'; } catch { return '—'; }
};

/** dd/MM/yyyy HH:mm */
export const fmtDateTime = (d) => {
  try {
    const dt = typeof d === 'string' ? new Date(d) : d;
    return dt ? format(dt, 'dd/MM/yyyy HH:mm') : '—';
  } catch { return '—'; }
};

// ─── Misc ────────────────────────────────────────────────────────────────────

/** Safe truncate with ellipsis */
export const truncate = (str, max = 40) =>
  str && str.length > max ? str.slice(0, max) + '…' : (str || '—');