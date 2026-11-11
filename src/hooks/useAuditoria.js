import { useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { parseFechaLocal, finDiaLocal } from '@/lib/fechaLocal';

// Auditoría del sector activo. Los filtros, los indicadores y la exportación
// se resuelven en el servidor sobre TODO el historial; la lista se trae por páginas.
const Log = base44.entities.AuditLog;
const PAGINA = 100;
export const TOPE_EXPORT = 5000;

const elementos = (p) => (Array.isArray(p) ? p : (p?.items || []));
const cuenta = (rows, action) => rows.find(r => r.action === action)?.count || 0;

export function construirConsulta({ filters, dateFrom, dateTo, search }) {
  const query = {};
  if (filters.entity_type) query.entity_type = filters.entity_type;
  if (filters.action) query.action = filters.action;
  if (filters.user_email) query.user_email = filters.user_email;
  if (dateFrom || dateTo) {
    query.timestamp = {};
    if (dateFrom) query.timestamp.$gte = parseFechaLocal(dateFrom).toISOString();
    if (dateTo) query.timestamp.$lte = finDiaLocal(dateTo).toISOString();
  }
  if (search) {
    const texto = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    query.$or = ['entity_id', 'entity_type', 'user_email', 'changed_fields'].map(campo => ({ [campo]: texto }));
  }
  return query;
}

const pagina = (query, limit, cursor) =>
  Log.filter(query, { sort: '-timestamp', limit, ...(cursor ? { cursor } : {}) });

// Todos los registros que coinciden (para exportar), hasta TOPE_EXPORT.
export async function traerTodos(query) {
  const filas = [];
  let cursor = null;
  do {
    const p = await pagina(query, 500, cursor);
    filas.push(...elementos(p));
    cursor = p?.has_more ? p.next_cursor : null;
  } while (cursor && filas.length < TOPE_EXPORT);
  return filas;
}

export function useAuditoria(filtros) {
  // Espera a que el usuario termine de escribir antes de consultar.
  const clave = JSON.stringify(filtros);
  const [claveLenta, setClaveLenta] = useState(clave);
  useEffect(() => {
    const t = setTimeout(() => setClaveLenta(clave), 350);
    return () => clearTimeout(t);
  }, [clave]);
  const query = useMemo(() => construirConsulta(JSON.parse(claveLenta)), [claveLenta]);

  const lista = useInfiniteQuery({
    queryKey: ['auditLogs', claveLenta],
    queryFn: ({ pageParam }) => pagina(query, PAGINA, pageParam),
    initialPageParam: null,
    getNextPageParam: (p) => (p?.has_more ? p.next_cursor : undefined),
  });

  const { data: resumen } = useQuery({
    queryKey: ['auditResumen', claveLenta],
    queryFn: async () => {
      const [porAccion, porUsuario, porEntidad] = await Promise.all(
        ['action', 'user_email', 'entity_type'].map(groupBy => Log.aggregate({ query, groupBy }).then(r => r.rows)),
      );
      return { porAccion, porUsuario, porEntidad };
    },
  });

  // Filtro por usuario: todas las personas vinculadas al sector (tengan o no
  // actividad) más quienes figuran en el historial (operarios del portal, "sistema").
  const { data: usuarios = [] } = useQuery({
    queryKey: ['auditUsuarios'],
    queryFn: async () => {
      const [{ rows }, sector] = await Promise.all([
        Log.aggregate({ query: {}, groupBy: 'user_email' }),
        base44.functions.invoke('getOperariosSector', { todos: true }),
      ]);
      // El correo del historial tiene prioridad: es el valor exacto por el que se filtra.
      const porCorreo = new Map();
      for (const o of sector.data?.operarios || []) if (o.email) porCorreo.set(o.email.toLowerCase(), o.email);
      for (const r of rows) if (r.user_email) porCorreo.set(r.user_email.toLowerCase(), r.user_email);
      return [...porCorreo.values()].sort((a, b) => a.localeCompare(b));
    },
    staleTime: 5 * 60 * 1000,
  });

  const logs = useMemo(() => (lista.data?.pages || []).flatMap(elementos), [lista.data]);
  const stats = useMemo(() => {
    const acciones = resumen?.porAccion || [];
    return {
      total: acciones.reduce((s, r) => s + r.count, 0),
      creates: cuenta(acciones, 'create'),
      updates: cuenta(acciones, 'update'),
      deletes: cuenta(acciones, 'delete'),
      users: resumen?.porUsuario.length || 0,
    };
  }, [resumen]);

  return {
    query, logs, stats, resumen, usuarios,
    cargando: lista.isLoading,
    hayMas: Boolean(lista.hasNextPage),
    cargarMas: () => lista.fetchNextPage(),
    cargandoMas: lista.isFetchingNextPage,
  };
}