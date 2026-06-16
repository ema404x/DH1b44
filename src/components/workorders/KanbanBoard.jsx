import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Badge } from '@/components/ui/badge';
import { MapPin, User, Zap, Wrench, QrCode } from 'lucide-react';
import { isPast, parseISO } from 'date-fns';
import WorkOrderQRButton from './WorkOrderQRButton';

const COLUMNS = [
  { id: 'pendiente',   label: 'Pendiente',   color: 'border-t-yellow-500',  dot: 'bg-yellow-500',  count_bg: 'bg-yellow-500/20 text-yellow-400' },
  { id: 'asignada',    label: 'Asignada',    color: 'border-t-blue-500',    dot: 'bg-blue-500',    count_bg: 'bg-blue-500/20 text-blue-400' },
  { id: 'en_progreso', label: 'En Progreso', color: 'border-t-purple-500',  dot: 'bg-purple-500',  count_bg: 'bg-purple-500/20 text-purple-400' },
  { id: 'en_espera',   label: 'En Espera',   color: 'border-t-amber-500',   dot: 'bg-amber-500',   count_bg: 'bg-amber-500/20 text-amber-400' },
  { id: 'obra',        label: 'Obra',        color: 'border-t-pink-400',    dot: 'bg-pink-400',    count_bg: 'bg-pink-400/20 text-pink-300' },
  { id: 'completada',  label: 'Completada',  color: 'border-t-emerald-500', dot: 'bg-emerald-500', count_bg: 'bg-emerald-500/20 text-emerald-400' },
  { id: 'cancelada',   label: 'Cancelada',   color: 'border-t-red-500',     dot: 'bg-red-500',     count_bg: 'bg-red-500/20 text-red-400' },
];

const priorityColors = {
  baja:    'bg-slate-700 text-slate-300',
  media:   'bg-blue-900/60 text-blue-300',
  alta:    'bg-orange-900/60 text-orange-300',
  urgente: 'bg-red-900/60 text-red-300 font-bold',
};

function KanbanCard({ order, index, onOpen, onShowQR }) {
  const isOverdue = (() => { try { return order.scheduled_date && order.scheduled_date.length >= 10 && isPast(parseISO(order.scheduled_date)) && !['completada','cancelada'].includes(order.status); } catch { return false; } })();

  return (
    <Draggable draggableId={order.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onOpen(order)}
          className={`group bg-card border rounded-xl p-3 cursor-pointer transition-all select-none
            ${snapshot.isDragging
              ? 'shadow-2xl shadow-primary/30 border-primary/50 rotate-1 scale-105'
              : isOverdue
              ? 'border-red-500/30 hover:border-red-500/60'
              : 'border-border hover:border-primary/40'}
          `}
        >
          {/* Priority + QR */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize ${priorityColors[order.priority] || priorityColors.media}`}>
              {order.priority}
            </span>
            <div onClick={e => e.stopPropagation()} className="opacity-0 group-hover:opacity-100 transition-opacity">
              <WorkOrderQRButton order={order} onShowQR={onShowQR} size="icon" variant="ghost" className="h-6 w-6" />
            </div>
          </div>

          {/* Title */}
          <p className="text-sm font-semibold text-foreground leading-tight line-clamp-2 mb-2">{order.title}</p>

          {/* Meta */}
          <div className="space-y-1">
            {order.location_qr_name || order.location ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                <MapPin className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{order.location_qr_name || order.location}</span>
              </p>
            ) : null}
            {order.assigned_name && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                <User className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{order.assigned_name}</span>
              </p>
            )}
          </div>

          {isOverdue && (
            <div className="mt-2 text-[10px] font-bold text-red-400 bg-red-500/10 rounded-md px-2 py-0.5 inline-block">
              VENCIDA
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
}

const KANBAN_VISIBLE_LIMIT = 40; // máximo de cards visibles por columna

function KanbanColumn({ col, orders, onOpen, onShowQR }) {
  const [showAll, setShowAll] = React.useState(false);
  const visible = showAll ? orders : orders.slice(0, KANBAN_VISIBLE_LIMIT);
  const hidden = orders.length - KANBAN_VISIBLE_LIMIT;

  return (
    <div className={`flex flex-col min-w-[240px] w-[240px] bg-slate-900/50 rounded-xl border-t-2 ${col.color} flex-shrink-0`}>
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-border">
        <div className={`h-2.5 w-2.5 rounded-full ${col.dot}`} />
        <span className="text-sm font-semibold text-foreground flex-1">{col.label}</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${col.count_bg}`}>{orders.length}</span>
      </div>

      {/* Cards */}
      <Droppable droppableId={col.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 p-2 space-y-2 min-h-[120px] transition-colors rounded-b-xl overflow-y-auto max-h-[70vh] ${
              snapshot.isDraggingOver ? 'bg-primary/5' : ''
            }`}
          >
            {visible.map((order, index) => (
              <KanbanCard
                key={order.id}
                order={order}
                index={index}
                onOpen={onOpen}
                onShowQR={onShowQR}
              />
            ))}
            {provided.placeholder}
            {orders.length === 0 && !snapshot.isDraggingOver && (
              <div className="flex items-center justify-center h-20 text-xs text-muted-foreground/50 border border-dashed border-border/50 rounded-lg">
                Sin órdenes
              </div>
            )}
            {!showAll && hidden > 0 && (
              <button
                onClick={() => setShowAll(true)}
                className="w-full text-xs text-slate-400 hover:text-white py-2 border border-dashed border-slate-700 rounded-lg transition-colors"
              >
                + {hidden} más...
              </button>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
}

export default function KanbanBoard({ orders, onOpen, onShowQR, onStatusChange }) {
  const grouped = COLUMNS.reduce((acc, col) => {
    acc[col.id] = orders.filter(o => o.status === col.id);
    return acc;
  }, {});

  const handleDragEnd = (result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;
    onStatusChange(draggableId, destination.droppableId);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4 min-h-[500px]">
        {COLUMNS.map(col => (
          <KanbanColumn
            key={col.id}
            col={col}
            orders={grouped[col.id] || []}
            onOpen={onOpen}
            onShowQR={onShowQR}
          />
        ))}
      </div>
    </DragDropContext>
  );
}