import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import PortalOperarioApp from '@/pages/PortalOperarioApp';
import OperarioHeader from '@/components/operario-home/OperarioHeader';
import FichajeCard from '@/components/operario-home/FichajeCard';
import AccesosOperario from '@/components/operario-home/AccesosOperario';
import EmergenciaRapidaDialog from '@/components/operario-home/EmergenciaRapidaDialog';
import { abrirEscanerOperario } from '@/lib/modoOperario';

/**
 * Inicio operario (/operario) — pantalla de inicio del "Modo operario (beta)".
 * Las OT, sus acciones, el escáner y el soporte sin conexión son los de
 * PortalOperarioApp en su variante compacta: misma consulta, mismo caché y misma cola.
 */
export default function OperarioHome() {
  const location = useLocation();
  const navigate = useNavigate();
  const [emergenciaOpen, setEmergenciaOpen] = useState(false);

  // Llegada desde "Escanear" de la barra inferior estando en otra pantalla.
  useEffect(() => {
    if (!location.state?.escanear) return;
    abrirEscanerOperario();
    navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 page-enter">
      <OperarioHeader />
      <FichajeCard />

      <section>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Mis OT de hoy</h2>
          <Link to="/mis-ots" className="-mr-2 inline-flex h-12 items-center gap-1 rounded-lg px-2 text-sm font-medium text-primary active:bg-accent">
            Ver todas
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <PortalOperarioApp compacto />
      </section>

      <AccesosOperario onEmergencia={() => setEmergenciaOpen(true)} />
      <EmergenciaRapidaDialog open={emergenciaOpen} onOpenChange={setEmergenciaOpen} />
    </div>
  );
}