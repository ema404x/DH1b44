import React from 'react';
import { Users } from 'lucide-react';
import VacioModulo from '@/components/shared/VacioModulo';
import { usePuedeLeerModulo } from '@/hooks/usePuedeLeerModulo';

export default function SinOperariosAviso() {
  const puedeEmpleados = usePuedeLeerModulo('Employee');
  return (
    <VacioModulo
      icon={Users}
      titulo="Todavía no hay operarios cargados."
      texto="Cargalos en Empleados con rol Operario y su DNI."
      accion={puedeEmpleados ? { label: 'Ir a Empleados', to: '/empleados' } : null}
    />
  );
}