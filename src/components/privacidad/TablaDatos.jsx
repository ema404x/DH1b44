import React from 'react';

const FILAS = [
  ['Nombre y apellido', 'Identificar al usuario dentro de la plataforma y en las órdenes de trabajo (OT).'],
  ['Correo electrónico', 'Iniciar sesión y enviar avisos relacionados con el trabajo.'],
  ['Identificador de usuario', 'Vincular las acciones de cada usuario (OT, fichajes, registros).'],
  ['Ubicación precisa (GPS)', 'Registrar dónde se realiza un fichaje o un trabajo y asociarlo al establecimiento correspondiente. Solo se toma cuando el usuario realiza esas acciones en la app.'],
  ['DNI', 'Identificar a la persona que registra un fichaje.'],
  ['Firma dibujada', 'Confirmar el registro de un fichaje.'],
  ['Fotos', 'Documentar el estado de los trabajos realizados en las OT. Solo se toman cuando el usuario las saca o adjunta.'],
];

export default function TablaDatos() {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm text-left">
        <thead className="bg-muted text-foreground">
          <tr>
            <th className="px-3 py-2.5 font-semibold w-2/5 sm:w-1/3">Dato</th>
            <th className="px-3 py-2.5 font-semibold">Para qué se usa</th>
          </tr>
        </thead>
        <tbody>
          {FILAS.map(([dato, uso]) => (
            <tr key={dato} className="border-t border-border align-top">
              <td className="px-3 py-2.5"><strong className="text-foreground">{dato}</strong></td>
              <td className="px-3 py-2.5">{uso}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}