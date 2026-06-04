import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, X, ChevronDown } from 'lucide-react';

export default function FiltrosAvanzadosFacturas({ invoices = [], onFilter, clients = [] }) {
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [amountFrom, setAmountFrom] = useState('');
  const [amountTo, setAmountTo] = useState('');

  // Extraer clientes únicos
  const uniqueClients = Array.from(new Set(invoices.map(i => i.client_name))).filter(Boolean).sort();
  // Extraer proyectos únicos
  const uniqueProjects = Array.from(new Set(invoices.map(i => i.project_name))).filter(Boolean).sort();

  const applyFilters = () => {
    const filtered = invoices.filter(i => {
      const matchSearch = !search || 
        i.client_name?.toLowerCase().includes(search.toLowerCase()) || 
        i.code?.toLowerCase().includes(search.toLowerCase()) ||
        i.project_name?.toLowerCase().includes(search.toLowerCase());
      
      const matchStatus = statusFilter === 'all' || i.status === statusFilter;
      const matchClient = clientFilter === 'all' || i.client_name === clientFilter;
      const matchProject = projectFilter === 'all' || i.project_name === projectFilter;
      
      const invoiceDate = i.issue_date ? new Date(i.issue_date) : null;
      const matchDateFrom = !dateFrom || (invoiceDate && invoiceDate >= new Date(dateFrom));
      const matchDateTo = !dateTo || (invoiceDate && invoiceDate <= new Date(dateTo));
      
      const amount = i.total || 0;
      const matchAmountFrom = !amountFrom || amount >= parseFloat(amountFrom);
      const matchAmountTo = !amountTo || amount <= parseFloat(amountTo);
      
      return matchSearch && matchStatus && matchClient && matchProject && matchDateFrom && matchDateTo && matchAmountFrom && matchAmountTo;
    });
    
    onFilter(filtered);
  };

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setClientFilter('all');
    setProjectFilter('all');
    setDateFrom('');
    setDateTo('');
    setAmountFrom('');
    setAmountTo('');
    onFilter(invoices);
  };

  React.useEffect(() => {
    applyFilters();
  }, [search, statusFilter, clientFilter, projectFilter, dateFrom, dateTo, amountFrom, amountTo]);

  const activeFilters = [
    search, statusFilter !== 'all', clientFilter !== 'all', projectFilter !== 'all',
    dateFrom, dateTo, amountFrom, amountTo
  ].filter(Boolean).length;

  return (
    <div className="space-y-3 animate-in fade-in-50 duration-300">
      {/* Búsqueda principal */}
      <div className="relative flex-1 group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
        <Input 
          placeholder="Buscar por cliente, nº factura o proyecto..." 
          value={search} 
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 border-border/50 focus:border-primary/30 transition-colors" 
        />
      </div>

      {/* Toggle filtros avanzados */}
      <Button 
        variant="outline" 
        size="sm"
        onClick={() => setExpanded(!expanded)}
        className="w-full justify-between bg-muted/20 border-border/50 hover:bg-muted/40 hover:border-primary/30 transition-all"
      >
        <span className="flex items-center gap-2">
          <span className="text-sm font-medium">Filtros avanzados</span>
          {activeFilters > 0 && (
            <span className="bg-primary text-primary-foreground px-2 py-0.5 rounded-full text-xs font-bold animate-pulse">
              {activeFilters}
            </span>
          )}
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
      </Button>

      {/* Panel de filtros avanzados */}
      {expanded && (
        <Card className="p-4 space-y-4 border-border/50 animate-in fade-in-50 duration-200 shadow-sm bg-card/50 backdrop-blur-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Estado */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Estado</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 text-sm border-border/50 hover:border-primary/30 transition-colors">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="pagada">Pagada</SelectItem>
                  <SelectItem value="vencida">Vencida</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Cliente */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Cliente</label>
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger className="h-8 text-sm border-border/50 hover:border-primary/30 transition-colors">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {uniqueClients.map(client => (
                    <SelectItem key={client} value={client}>{client}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Proyecto */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Proyecto</label>
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger className="h-8 text-sm border-border/50 hover:border-primary/30 transition-colors">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {uniqueProjects.map(project => (
                    <SelectItem key={project} value={project}>{project}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Rango de fechas */}
          <div className="border-t border-border/50 pt-3">
            <label className="text-xs font-semibold text-foreground block mb-2">Rango de fechas</label>
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Input 
                  type="date" 
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-8 text-sm border-border/50 hover:border-primary/30 transition-colors"
                  placeholder="Desde"
                />
              </div>
              <div className="flex-1 space-y-1">
                <Input 
                  type="date" 
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-8 text-sm border-border/50 hover:border-primary/30 transition-colors"
                  placeholder="Hasta"
                />
              </div>
            </div>
          </div>

          {/* Rango de montos */}
          <div className="border-t border-border/50 pt-3">
            <label className="text-xs font-semibold text-foreground block mb-2">Rango de monto ($)</label>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input 
                  type="number" 
                  value={amountFrom}
                  onChange={(e) => setAmountFrom(e.target.value)}
                  className="h-8 text-sm border-border/50 hover:border-primary/30 transition-colors"
                  placeholder="Desde"
                />
              </div>
              <div className="flex-1">
                <Input 
                  type="number" 
                  value={amountTo}
                  onChange={(e) => setAmountTo(e.target.value)}
                  className="h-8 text-sm border-border/50 hover:border-primary/30 transition-colors"
                  placeholder="Hasta"
                />
              </div>
            </div>
          </div>

          {/* Botón reset */}
          {activeFilters > 0 && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={resetFilters}
              className="w-full text-xs border-border/50 hover:bg-muted/40 hover:border-primary/30 transition-all"
            >
              <X className="h-3 w-3 mr-1" />
              Limpiar todos los filtros
            </Button>
          )}
        </Card>
      )}
    </div>
  );
}