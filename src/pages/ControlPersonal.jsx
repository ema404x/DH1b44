import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Sun, ClipboardList, UserRound, Building2, Clock3 } from 'lucide-react';
import HoyTab from '@/components/control-personal/HoyTab';
import AsistenciasTab from '@/components/control-personal/AsistenciasTab';
import PersonasTab from '@/components/control-personal/PersonasTab';
import LugaresTab from '@/components/control-personal/LugaresTab';
import HorarioConfig from '@/components/control-personal/HorarioConfig';

const TABS = [
  { value: 'hoy', label: 'Hoy', icon: Sun },
  { value: 'asistencias', label: 'Asistencias', icon: ClipboardList },
  { value: 'personas', label: 'Por persona', icon: UserRound },
  { value: 'lugares', label: 'Por lugar', icon: Building2 },
  { value: 'horario', label: 'Horario', icon: Clock3 },
];

export default function ControlPersonal() {
  const [tab, setTab] = useState('hoy');
  const irAHorario = () => setTab('horario');

  return (
    <div className="space-y-5 page-enter">
      <header className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Control de personal</h1>
          <p className="text-sm text-muted-foreground">Quién está, quién se fue, quién llegó tarde y quién falta.</p>
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="-mx-1 px-1 overflow-x-auto pb-1">
          <TabsList className="h-11 w-max">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="gap-2 px-3.5 h-9">
                <t.icon className="h-4 w-4" /> {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="hoy" className="mt-5"><HoyTab onConfigurarHorario={irAHorario} /></TabsContent>
        <TabsContent value="asistencias" className="mt-5"><AsistenciasTab /></TabsContent>
        <TabsContent value="personas" className="mt-5"><PersonasTab onConfigurarHorario={irAHorario} /></TabsContent>
        <TabsContent value="lugares" className="mt-5"><LugaresTab /></TabsContent>
        <TabsContent value="horario" className="mt-5"><HorarioConfig /></TabsContent>
      </Tabs>
    </div>
  );
}