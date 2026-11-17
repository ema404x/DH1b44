import React from 'react';
import { Link } from 'react-router-dom';
import { WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function WorkOrdersOfflineNotice() {
  return (
    <div role="status" className="mx-auto mt-10 max-w-md rounded-lg border border-border bg-card p-6 text-center text-foreground">
      <WifiOff className="mx-auto h-8 w-8 text-muted-foreground" />
      <p className="mt-4 text-sm">
        Esta pantalla necesita conexión. Tus OT asignadas están disponibles en Mis Órdenes de Trabajo.
      </p>
      <Button asChild className="mt-5">
        <Link to="/mis-ots">Ir a Mis Órdenes de Trabajo</Link>
      </Button>
    </div>
  );
}