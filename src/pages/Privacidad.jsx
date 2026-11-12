import React from 'react';
import TablaDatos from '@/components/privacidad/TablaDatos';

const H2 = ({ children }) => (
  <h2 className="text-lg sm:text-xl font-bold text-foreground pt-4">{children}</h2>
);
const B = ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>;

export default function Privacidad() {
  return (
    <div className="min-h-screen bg-background text-muted-foreground font-inter">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <article className="bg-card border border-border rounded-xl p-5 sm:p-8 space-y-4 text-[15px] leading-relaxed">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Política de Privacidad de DH1</h1>

          <p><B>Última actualización:</B> 12 de noviembre de 2026</p>

          <p>
            Esta Política de Privacidad explica cómo <B>DH1 Software</B>, proyecto a cargo de <B>Andres Emanuel Benitez</B>, de Argentina (en adelante, "DH1 Software" o "nosotros"), trata los datos personales de las personas que usan la aplicación <B>DH1</B> y la plataforma web <B>dh1m.com</B> (en adelante, "DH1").
          </p>
          <p>
            DH1 es una herramienta para la gestión de mantenimiento y obras. Su uso está reservado a los operarios, supervisores y colaboradores autorizados por cada organización que usa DH1 (en adelante, "la Organización"). Las cuentas de usuario las crea un administrador; no es posible registrarse libremente.
          </p>

          <H2>1. Datos que recopilamos</H2>
          <TablaDatos />
          <p>
            DH1 <B>no</B> recopila datos financieros, de salud, contactos, mensajes privados ni el historial de navegación, y <B>no</B> muestra publicidad.
          </p>

          <H2>2. Para qué usamos los datos</H2>
          <p>Usamos los datos únicamente para el funcionamiento de DH1:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>gestionar y asignar órdenes de trabajo;</li>
            <li>registrar el avance y el resultado de cada trabajo;</li>
            <li>registrar fichajes de entrada y salida;</li>
            <li>administrar las cuentas de los usuarios;</li>
            <li>mantener la seguridad de la plataforma.</li>
          </ul>
          <p>No usamos los datos con fines publicitarios ni los vendemos.</p>

          <H2>3. Con quién compartimos los datos</H2>
          <p>
            Los datos solo los ven las personas autorizadas de la Organización y de DH1 Software (por ejemplo, supervisores y administradores) según su función.
          </p>
          <p>
            Para operar DH1 usamos proveedores de servicios tecnológicos (alojamiento de la plataforma y de los archivos) que tratan los datos por cuenta de DH1 Software y solo para prestar ese servicio. No cedemos datos a terceros para sus propios fines, salvo obligación legal o requerimiento de una autoridad competente.
          </p>

          <H2>4. Seguridad</H2>
          <p>
            Todos los datos viajan cifrados entre la app y nuestros servidores (HTTPS). El acceso a la plataforma requiere usuario y contraseña, y cada usuario ve solo la información que corresponde a su rol.
          </p>

          <H2>5. Conservación de los datos</H2>
          <p>
            Conservamos los datos mientras el usuario tenga una cuenta activa y, después, durante el tiempo necesario para cumplir obligaciones legales o resolver reclamos relacionados con los trabajos registrados. Luego se eliminan o se anonimizan.
          </p>

          <H2>6. Derechos de los usuarios</H2>
          <p>
            De acuerdo con la Ley 25.326 de Protección de los Datos Personales, cualquier usuario puede pedir <B>acceder, rectificar, actualizar o suprimir</B> sus datos personales. Para hacerlo, escriba a <B>emmmanuel0011@gmail.com</B>. Responderemos dentro de los plazos que fija la ley (10 días corridos para el acceso y 5 días hábiles para la rectificación o supresión).
          </p>
          <p>El usuario también puede pedir al administrador de su Organización que dé de baja su cuenta.</p>
          <p>
            La Agencia de Acceso a la Información Pública, en su carácter de Órgano de Control de la Ley 25.326, tiene la atribución de atender las denuncias y reclamos que se interpongan con relación al incumplimiento de las normas sobre protección de datos personales.
          </p>

          <H2>7. Teléfonos administrados</H2>
          <p>
            Si DH1 se usa en un teléfono provisto y administrado por la Organización, ese equipo puede estar configurado con herramientas de administración (por ejemplo, Android Enterprise) para limitar las aplicaciones disponibles y mantenerlo seguro. Esa administración se rige por las políticas internas de la Organización sobre el uso de equipos de trabajo.
          </p>

          <H2>8. Menores de edad</H2>
          <p>DH1 es una herramienta laboral y no está dirigida a menores de 18 años.</p>

          <H2>9. Cambios en esta política</H2>
          <p>Podemos actualizar esta política. Publicaremos la versión vigente en esta misma página, con su fecha de actualización.</p>

          <H2>10. Contacto</H2>
          <p>Por cualquier consulta sobre esta política o sobre sus datos personales:</p>
          <p>
            <B>DH1 Software</B><br />
            Responsable: <B>Andres Emanuel Benitez</B><br />
            Correo: <B>emmmanuel0011@gmail.com</B>
          </p>
        </article>
      </main>
    </div>
  );
}