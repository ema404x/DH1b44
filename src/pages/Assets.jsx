import React from 'react';
import PendientesTab from '@/components/assets/PendientesTab';
import { ClipboardList } from 'lucide-react';

export default function Assets() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <ClipboardList className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Pendientes SAP</h1>
          <p className="text-sm text-muted-foreground">Órdenes de trabajo importadas desde SAP por comuna</p>
        </div>
      </div>
      <PendientesTab />
    </div>
  );
}