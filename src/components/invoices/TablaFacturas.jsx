import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Search, Pencil, Trash2, Receipt, ChevronDown, ChevronRight, X, Plus } from 'lucide-react';
import { format, isAfter, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const STATUS_CFG = {
  pendiente:  { label: 'Pendiente',  cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  pagada:     { label: 'Pagada',     cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  vencida:    { label: 'Vencida',    cls: 'bg-red-500/15 text-red-400 border-red-500/30' },
  cancelada:  { label: 'Cancelada',  cls: 'bg-slate-500/15 text-slate-400 border-slate-500/30' },
};

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);
const fmtDate = (d) => { try { return d ? format(parseISO(d), 'dd/MM/yy') : '—'; } catch { return '—'; } };

function InvoiceDetail({ invoice }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-4 py-3 bg-muted/20 border-t border-border/40 text-xs">
      <div>
        <p className="text-muted-foreground mb-1">Subtotal</p>
        <p className="font-semibold text-foreground">{fmt(invoice.subtotal)}</p>
      </div>
      <div>
        <p className="text-muted-foreground mb-1">IVA ({invoice.tax_rate || 0}%)</p>
        <p className="font-semibold text-foreground">{fmt((invoice.subtotal || 0) * (invoice.tax_rate || 0) / 100)}</p>
      </div>
      <div>
        <p className="text-muted-foreground mb-1">Fecha emisión</p>
        <p className="font-semibold text-foreground">{fmtDate(invoice.issue_date)}</p>
      </div>
      <div>
        <p className="text-muted-foreground mb-1">Fecha vencimiento</p>
        <p className={`font-semibold ${invoice.status === 'vencida' ? 'text-red-400' : 'text-foreground'}`}>{fmtDate(invoice.due_date)}</p>
      </div>
      {invoice.payment_date && (
        <div>
          <p className="text-muted-foreground mb-1">Fecha de pago</p>
          <p className="font-semibold text-emerald-400">{fmtDate(invoice.payment_date)}</p>
        </div>
      )}
      {invoice.notes && (
        <div className="col-span-2 md:col-span-4">
          <p className="text-muted-foreground mb-1">Notas</p>
          <p className="text-foreground/80 leading-relaxed">{invoice.notes}</p>
        </div>
      )}
    </div>
  );
}

export default function TablaFacturas({ invoices, isLoading, onEdit, onDelete, onNew }) {
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');
  const [expandedId, setExpandedId]     = useState(null);

  const uniqueClients = useMemo(() =>
    Array.from(new Set(invoices.map(i => i.client_name))).filter(Boolean).sort(),
    [invoices]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return invoices.filter(i => {
      const matchSearch = !q ||
        i.client_name?.toLowerCase().includes(q) ||
        i.code?.toLowerCase().includes(q) ||
        i.project_name?.toLowerCase().includes(q) ||
        i.notes?.toLowerCase().includes(q);
      const matchStatus = statusFilter === 'all' || i.status === statusFilter;
      const matchClient = clientFilter === 'all' || i.client_name === clientFilter;
      return matchSearch && matchStatus && matchClient;
    });
  }, [invoices, search, statusFilter, clientFilter]);

  const hasFilters = search || statusFilter !== 'all' || clientFilter !== 'all';

  const clearFilters = () => { setSearch(''); setStatusFilter('all'); setClientFilter('all'); };

  // Totales de la vista filtrada
  const totales = useMemo(() => ({
    total:   filtered.reduce((s, i) => s + (i.total || 0), 0),
    pending: filtered.filter(i => i.status === 'pendiente').reduce((s, i) => s + (i.total || 0), 0),
    paid:    filtered.filter(i => i.status === 'pagada').reduce((s, i) => s + (i.total || 0), 0),
  }), [filtered]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Filtros ────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, número, proyecto..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 text-sm w-full sm:w-36"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {Object.entries(STATUS_CFG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="h-9 text-sm w-full sm:w-44"><SelectValue placeholder="Cliente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los clientes</SelectItem>
            {uniqueClients.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive" onClick={clearFilters}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* ── Totales de vista ───────────────────────────────────────── */}
      {filtered.length > 0 && (
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground bg-muted/20 border border-border/40 rounded-lg px-4 py-2.5">
          <span>{filtered.length} facturas</span>
          <span className="w-px h-4 bg-border self-center" />
          <span>Total: <strong className="text-foreground">{fmt(totales.total)}</strong></span>
          <span className="w-px h-4 bg-border self-center" />
          <span>Pendiente: <strong className="text-amber-400">{fmt(totales.pending)}</strong></span>
          <span className="w-px h-4 bg-border self-center" />
          <span>Cobrado: <strong className="text-emerald-400">{fmt(totales.paid)}</strong></span>
        </div>
      )}

      {/* ── Tabla ──────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Receipt className="h-12 w-12 mb-3 opacity-20" />
          <p className="font-medium">{hasFilters ? 'Sin resultados para los filtros aplicados' : 'No hay facturas todavía'}</p>
          {!hasFilters && (
            <Button onClick={onNew} className="mt-4 gap-2" size="sm">
              <Plus className="h-3.5 w-3.5" /> Nueva Factura
            </Button>
          )}
        </div>
      ) : (
        <div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="w-8" />
                  <TableHead className="font-semibold text-xs">Nº Factura</TableHead>
                  <TableHead className="font-semibold text-xs">Cliente</TableHead>
                  <TableHead className="hidden md:table-cell font-semibold text-xs">Proyecto</TableHead>
                  <TableHead className="font-semibold text-xs">Estado</TableHead>
                  <TableHead className="text-right font-semibold text-xs">Total</TableHead>
                  <TableHead className="hidden lg:table-cell font-semibold text-xs">Vencimiento</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((invoice, idx) => {
                  const statusCfg = STATUS_CFG[invoice.status] || STATUS_CFG.pendiente;
                  const isExpanded = expandedId === invoice.id;
                  const isOverdue = invoice.status === 'pendiente' && invoice.due_date && isAfter(new Date(), parseISO(invoice.due_date));
                  return (
                    <React.Fragment key={invoice.id}>
                      <TableRow
                        className={`border-border/40 hover:bg-accent/30 transition-colors cursor-pointer group ${idx % 2 !== 0 ? 'bg-muted/10' : ''}`}
                        onClick={() => setExpandedId(isExpanded ? null : invoice.id)}
                      >
                        <TableCell className="py-2 pl-3 pr-0">
                          {isExpanded
                            ? <ChevronDown className="h-3.5 w-3.5 text-primary" />
                            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                          }
                        </TableCell>
                        <TableCell className="font-mono text-xs font-semibold text-primary/80 py-3">
                          {invoice.code || '—'}
                        </TableCell>
                        <TableCell className="font-medium text-sm text-foreground/90 py-3">
                          {invoice.client_name}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-foreground/70 py-3">
                          {invoice.project_name || '—'}
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex items-center gap-1.5">
                            <Badge className={`text-xs border px-1.5 py-0 ${statusCfg.cls}`}>{statusCfg.label}</Badge>
                            {isOverdue && <Badge className="text-xs border px-1.5 py-0 bg-red-500/15 text-red-400 border-red-500/30">Atrasada</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-bold text-foreground py-3 tabular-nums">
                          {fmt(invoice.total)}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground py-3 tabular-nums">
                          {fmtDate(invoice.due_date)}
                        </TableCell>
                        <TableCell className="py-3" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-primary/10 hover:text-primary"
                              onClick={() => onEdit(invoice)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/50 hover:bg-destructive/10 hover:text-destructive">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Eliminar factura?</AlertDialogTitle>
                                  <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => onDelete(invoice.id)}>Eliminar</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow className="border-border/40 hover:bg-transparent">
                          <TableCell colSpan={8} className="p-0">
                            <InvoiceDetail invoice={invoice} />
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}