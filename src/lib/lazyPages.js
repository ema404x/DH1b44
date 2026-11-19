/**
 * lazyPages — mapa ÚNICO de las pantallas que se cargan con import dinámico.
 * App.jsx arma sus rutas con `lazyPages` y offlinePreload.js precarga
 * `pageLoaders`, así una pantalla nueva agregada acá queda incluida sola
 * en la precarga del modo sin conexión.
 */
import { lazy, createElement } from 'react';

export const pageLoaders = {
  Dashboard: () => import('@/pages/Dashboard'),
  Projects: () => import('@/pages/Projects'),
  WorkOrders: () => import('@/pages/WorkOrders'),
  Clients: () => import('@/pages/Clients'),
  Employees: () => import('@/pages/Employees'),
  Inventory: () => import('@/pages/Inventory'),
  Invoices: () => import('@/pages/Invoices'),
  Presupuestos: () => import('@/pages/Presupuestos'),
  Informes: () => import('@/pages/Informes'),
  Assets: () => import('@/pages/Assets'),
  ActivoFicha: () => import('@/pages/ActivoFicha'),
  Calendario: () => import('@/pages/Calendario'),
  Reportes: () => import('@/pages/Reportes'),
  Automatizaciones: () => import('@/pages/Automatizaciones'),
  Certificados: () => import('@/pages/Certificados'),
  Auditoria: () => import('@/pages/Auditoria'),
  Permisos: () => import('@/pages/Permisos'),
  Seguridad: () => import('@/pages/Seguridad'),
  Mapa: () => import('@/pages/Mapa'),
  Tutorial: () => import('@/pages/Tutorial'),
  ImportarDatos: () => import('@/pages/ImportarDatos'),
  ConfigAlertas: () => import('@/pages/ConfigAlertas'),
  InformacionGeneral: () => import('@/pages/InformacionGeneral'),
  Emergencias: () => import('@/pages/Emergencias'),
  MapaJefes: () => import('@/pages/MapaJefes'),
  InspeccionColegio: () => import('@/pages/InspeccionColegio'),
  AprobacionCertificados: () => import('@/pages/AprobacionCertificados'),
  ControlRiesgo: () => import('@/pages/ControlRiesgo'),
  CertificacionObras: () => import('@/pages/CertificacionObras'),
  CalendarioInformes: () => import('@/pages/CalendarioInformes'),
  CrearOT: () => import('@/pages/CrearOT'),
  Foro: () => import('@/pages/Foro'),
  Calefaccion: () => import('@/pages/Calefaccion'),
  Sectores: () => import('@/pages/Sectores'),
  Rutinas: () => import('@/pages/Rutinas'),
  PortalOperarioApp: () => import('@/pages/PortalOperarioApp'),
  OperarioHome: () => import('@/pages/OperarioHome'),
  PropuestasOT: () => import('@/pages/PropuestasOT'),
};

// React.lazy recuerda para siempre una carga fallida. Cada pantalla guarda su
// componente lazy en `current`; si la carga falló, resetFailedLazyPages() lo
// reemplaza por uno nuevo para que el próximo render vuelva a pedir el archivo.
const entries = {};
const failed = new Set();

function retryableLazy(name, loader) {
  const make = () => lazy(() => loader().catch((err) => { failed.add(name); throw err; }));
  const entry = { current: make(), make };
  entries[name] = entry;
  const Page = (props) => createElement(entry.current, props);
  Page.displayName = name;
  return Page;
}

export function resetFailedLazyPages() {
  failed.forEach((name) => { entries[name].current = entries[name].make(); });
  failed.clear();
}

export const lazyPages = Object.fromEntries(
  Object.entries(pageLoaders).map(([name, loader]) => [name, retryableLazy(name, loader)])
);