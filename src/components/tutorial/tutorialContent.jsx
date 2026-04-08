export const TUTORIAL_MODULES = [
  {
    id: 'dashboard',
    icon: '📊',
    title: 'Panel Principal (Dashboard)',
    description: 'Visualiza el estado general de tu negocio en un solo lugar',
    color: '#3b82f6',
    keywords: ['inicio', 'resumen', 'métricas', 'gráficos'],
    steps: [
      {
        title: 'Acceder al Dashboard',
        duration: '2 min',
        description: 'El Dashboard es tu centro de control. Al iniciar sesión, verás un resumen completo de tu negocio con métricas clave, gráficos y alertas importantes.',
        instructions: [
          'Haz clic en "Inicio" en el menú lateral',
          'Observa los indicadores (KPIs) en la parte superior',
          'Revisa los gráficos de ingresos y estado de proyectos'
        ],
        tips: [
          'El dashboard se actualiza automáticamente cada minuto',
          'Puedes personalizar los datos según tus necesidades'
        ],
        example: 'Si tienes 5 proyectos activos, 12 órdenes pendientes y $50,000 en ingresos mensuales, estos datos aparecerán en las tarjetas superiores.'
      },
      {
        title: 'Interpretar métricas',
        duration: '3 min',
        difficulty: 'Básica',
        description: 'Aprende a leer e interpretar los indicadores clave del negocio.',
        instructions: [
          'Identifica los KPIs en la sección superior',
          'Lee los gráficos de tendencias mensuales',
          'Revisa la sección de proyectos activos',
          'Observa las órdenes de trabajo pendientes'
        ],
        tips: [
          'Los números en rojo indican alertas o problemas',
          'Los gráficos te ayudan a ver tendencias rápidamente'
        ],
        important: 'Si un proyecto está atrasado, aparecerá destacado en rojo para que tomes acción inmediata.'
      },
      {
        title: 'Usar alertas y notificaciones',
        duration: '2 min',
        difficulty: 'Básica',
        description: 'Las alertas te notifican sobre eventos importantes que requieren tu atención.',
        instructions: [
          'Lee las alertas en la sección superior del dashboard',
          'Haz clic en una alerta para ir directamente al módulo correspondiente',
          'Revisa las notificaciones (icono de campana)',
          'Marca notificaciones como leídas según sea necesario'
        ],
        tips: [
          'Abre las alertas inmediatamente para resolver problemas rápido',
          'Las notificaciones están ordenadas por importancia'
        ]
      }
    ]
  },
  {
    id: 'proyectos',
    icon: '🏗️',
    title: 'Gestión de Proyectos',
    description: 'Crea, organiza y controla todos tus proyectos de construcción',
    color: '#10b981',
    keywords: ['proyectos', 'obras', 'timeline', 'presupuesto'],
    steps: [
      {
        title: 'Crear un nuevo proyecto',
        duration: '5 min',
        difficulty: 'Básica',
        description: 'Los proyectos son el núcleo de tu negocio. Cada proyecto contiene información sobre la obra, cliente, equipo y presupuesto.',
        instructions: [
          'Ve a Proyectos en el menú lateral',
          'Haz clic en "Nuevo Proyecto"',
          'Completa los datos básicos: nombre, cliente, dirección',
          'Define el tipo de proyecto (obra nueva, remodelación, etc.)',
          'Establece fechas de inicio y fin estimadas',
          'Define el presupuesto estimado',
          'Haz clic en "Guardar"'
        ],
        tips: [
          'Los nombres descriptivos facilitan identificar proyectos después',
          'Las fechas realistas ayudan a cumplir plazos'
        ],
        example: 'Proyecto: "Remodelación Casa Rosada - San Isidro" con inicio 01/05/2024, fin 30/08/2024, presupuesto $75,000'
      },
      {
        title: 'Asignar equipo al proyecto',
        duration: '3 min',
        difficulty: 'Básica',
        description: 'Forma tu equipo de trabajo asignando empleados con roles específicos.',
        instructions: [
          'Abre el proyecto creado',
          'Ve a la pestaña "Equipo"',
          'Haz clic en "Agregar miembro"',
          'Selecciona empleados de la lista',
          'Define su rol (supervisor, técnico, operario, etc.)',
          'Guarda los cambios'
        ],
        tips: [
          'Asigna un supervisor responsable a cada proyecto',
          'Los roles determinan responsabilidades y acceso a funciones'
        ]
      },
      {
        title: 'Monitorear progreso',
        duration: '3 min',
        difficulty: 'Básica',
        description: 'Mantén el control del avance del proyecto en tiempo real.',
        instructions: [
          'Abre el proyecto',
          'Ve a la sección "Progreso"',
          'Actualiza el porcentaje de avance',
          'Revisa hitos (milestones) completados',
          'Lee comentarios del equipo',
          'Descarga reportes si es necesario'
        ],
        tips: [
          'Actualiza el progreso semanalmente',
          'Un proyecto con 0% de avance durante 2 semanas genera alerta'
        ],
        important: 'Si el proyecto se atrasa más de 10%, recibirás una alerta automática.'
      }
    ]
  },
  {
    id: 'ordenes',
    icon: '📋',
    title: 'Órdenes de Trabajo',
    description: 'Crea y sigue órdenes de trabajo para tareas específicas',
    color: '#f59e0b',
    keywords: ['órdenes', 'tareas', 'mantenimiento', 'urgencias'],
    steps: [
      {
        title: 'Crear una orden de trabajo',
        duration: '4 min',
        difficulty: 'Básica',
        description: 'Las órdenes de trabajo son tareas específicas que deben completarse en el proyecto.',
        instructions: [
          'Ve a Órdenes de Trabajo',
          'Haz clic en "Nueva Orden"',
          'Selecciona el proyecto asociado',
          'Define el tipo (mantenimiento, instalación, reparación, etc.)',
          'Asigna un empleado responsable',
          'Establece una fecha de inicio y estimado de horas',
          'Define la prioridad (baja, media, alta, urgente)',
          'Haz clic en "Guardar"'
        ],
        tips: [
          'Las órdenes urgentes aparecen destacadas en el dashboard',
          'Las horas estimadas ayudan a calcular costos'
        ],
        example: 'Orden: "Instalación de cableado eléctrico" - Prioridad Alta - 16 horas estimadas - Asignado a Juan García'
      },
      {
        title: 'Actualizar estado de orden',
        duration: '2 min',
        difficulty: 'Básica',
        description: 'Mantén el estado de las órdenes actualizado conforme avanza el trabajo.',
        instructions: [
          'Abre la orden de trabajo',
          'Cambia el estado: Pendiente → Asignada → En Progreso → Completada',
          'Si es necesario, cámbialo a "En espera" con motivo',
          'Haz clic en "Guardar"'
        ],
        tips: [
          'El sistema rastrea cuánto tiempo toma cada orden',
          'Los cambios de estado son registrados automáticamente'
        ]
      },
      {
        title: 'Agregar notas, fotos y firmas',
        duration: '4 min',
        difficulty: 'Media',
        description: 'Documenta el trabajo con evidencia fotográfica, notas y firmas digitales.',
        instructions: [
          'Abre la orden de trabajo',
          'Ve a la pestaña "Documentación"',
          'Carga fotos del antes y después del trabajo',
          'Escribe notas sobre lo realizado',
          'Solicita firma digital del cliente o responsable',
          'Guarda todos los cambios'
        ],
        tips: [
          'Las fotos en alta calidad son importantes para auditorías',
          'Las notas detalladas evitan confusiones después'
        ],
        important: 'Solicita firma del cliente para órdenes completadas; sin firma no se cierra.'
      }
    ]
  },
  {
    id: 'clientes',
    icon: '👥',
    title: 'Gestión de Clientes',
    description: 'Administra información y relaciones con clientes',
    color: '#8b5cf6',
    keywords: ['clientes', 'contactos', 'empresas', 'particulares'],
    steps: [
      {
        title: 'Agregar un nuevo cliente',
        duration: '3 min',
        difficulty: 'Básica',
        description: 'Los clientes son la base de tus proyectos. Registra toda su información importante.',
        instructions: [
          'Ve a Clientes',
          'Haz clic en "Nuevo Cliente"',
          'Completa datos: nombre/razón social, CUIT, tipo',
          'Agrega contacto responsable con email y teléfono',
          'Escribe la dirección de domicilio',
          'Selecciona estado (activo/inactivo)',
          'Haz clic en "Guardar"'
        ],
        tips: [
          'El CUIT es obligatorio para facturación',
          'Mantén actualizado el contacto principal'
        ],
        example: 'Cliente: "Empresa Construcciones S.A." - Contacto: "María Pérez" - Email: maria@construcciones.com'
      },
      {
        title: 'Ver historial de proyectos',
        duration: '2 min',
        difficulty: 'Básica',
        description: 'Accede rápidamente a todos los proyectos de un cliente.',
        instructions: [
          'Abre un cliente',
          'Ve a la pestaña "Proyectos"',
          'Observa todos los proyectos pasados y actuales',
          'Haz clic en cualquier proyecto para ver detalles'
        ],
        tips: [
          'Esto te ayuda a ver el valor total que le has generado',
          'Facilita cotizar nuevos trabajos basándote en lo anterior'
        ]
      }
    ]
  },
  {
    id: 'facturacion',
    icon: '💰',
    title: 'Facturación e Invoices',
    description: 'Crea y gestiona facturas, presupuestos y cobranza',
    color: '#ec4899',
    keywords: ['facturas', 'dinero', 'pagos', 'cobranza', 'invoices'],
    steps: [
      {
        title: 'Crear una factura',
        duration: '5 min',
        difficulty: 'Media',
        description: 'Las facturas formalizar los cobros a tus clientes.',
        instructions: [
          'Ve a Facturación > Facturas',
          'Haz clic en "Nueva Factura"',
          'Selecciona el cliente',
          'Elige si es por proyecto específico o servicios generales',
          'Agrega items con descripción, cantidad y precio unitario',
          'El total se calcula automáticamente (+ IVA 21%)',
          'Establece fecha de vencimiento',
          'Haz clic en "Guardar" y luego "Emitir"'
        ],
        tips: [
          'Verifica que el cliente sea correcto antes de emitir',
          'Las facturas emitidas no se pueden editar, solo anular'
        ],
        important: 'Una vez emitida, la factura tiene validez legal. Guarda un PDF para tus archivos.'
      },
      {
        title: 'Registrar pagos',
        duration: '2 min',
        difficulty: 'Básica',
        description: 'Marca los pagos recibidos de clientes.',
        instructions: [
          'Abre la factura pendiente',
          'Haz clic en "Registrar Pago"',
          'Escribe el monto pagado',
          'Selecciona método de pago (efectivo, banco, tarjeta)',
          'Agrega número de comprobante si existe',
          'Haz clic en "Guardar"'
        ],
        tips: [
          'Si es pago parcial, el sistema calcula el saldo restante',
          'Completa el monto exacto para marcar como pagada'
        ]
      },
      {
        title: 'Crear un presupuesto',
        duration: '4 min',
        difficulty: 'Media',
        description: 'Los presupuestos son cotizaciones que envías a clientes antes de la factura.',
        instructions: [
          'Ve a Facturación > Presupuestos',
          'Haz clic en "Nuevo Presupuesto"',
          'Selecciona cliente y proyecto (opcional)',
          'Agrega items con descripción y precio',
          'Establece fecha de validez (ej: 30 días)',
          'Añade términos y condiciones si es necesario',
          'Haz clic en "Guardar"',
          'Envía al cliente por email'
        ],
        tips: [
          'Los presupuestos pueden convertirse en facturas después',
          'Incluye márgenes razonables para ganancias'
        ]
      }
    ]
  },
  {
    id: 'inventario',
    icon: '📦',
    title: 'Inventario y Materiales',
    description: 'Controla stock de materiales y herramientas',
    color: '#06b6d4',
    keywords: ['stock', 'materiales', 'inventario', 'herramientas'],
    steps: [
      {
        title: 'Registrar un material nuevo',
        duration: '3 min',
        difficulty: 'Básica',
        description: 'Crea un registro para cada material que usas en tus proyectos.',
        instructions: [
          'Ve a Inventario',
          'Haz clic en "Nuevo Material"',
          'Completa: nombre, código, categoría',
          'Define unidad de medida (metros, kilos, litros, etc.)',
          'Establece stock inicial',
          'Define stock mínimo (alerta cuando llega a este punto)',
          'Escribe costo unitario',
          'Haz clic en "Guardar"'
        ],
        tips: [
          'Códigos únicos facilitan búsquedas rápidas',
          'El stock mínimo genera alertas automáticas'
        ],
        example: 'Material: "Hormigón preparado" - Código: HORM001 - Unidad: m³ - Stock inicial: 50 - Costo: $180/m³'
      },
      {
        title: 'Actualizar stock',
        duration: '2 min',
        difficulty: 'Básica',
        description: 'Mantén el inventario actualizado conforme usas o compras materiales.',
        instructions: [
          'Abre el material',
          'Ve a la sección "Movimientos"',
          'Haz clic en "Nuevo Movimiento"',
          'Selecciona tipo: entrada (compra) o salida (uso)',
          'Escribe cantidad',
          'Agrega documento de referencia si existe',
          'Haz clic en "Guardar"'
        ],
        tips: [
          'El sistema rastrea todos los movimientos automáticamente',
          'Puedes ver el historial completo de cada material'
        ]
      },
      {
        title: 'Asignar materiales a un proyecto',
        duration: '3 min',
        difficulty: 'Media',
        description: 'Vincula materiales específicos a un proyecto para rastrear costos.',
        instructions: [
          'Abre el proyecto',
          'Ve a la pestaña "Materiales"',
          'Haz clic en "Asignar Material"',
          'Selecciona el material del inventario',
          'Escribe cantidad a utilizar',
          'El costo se calcula automáticamente',
          'Haz clic en "Guardar"'
        ],
        tips: [
          'Esto te ayuda a calcular el costo real del proyecto',
          'Puedes ver qué proyectos consumen más recursos'
        ]
      }
    ]
  },
  {
    id: 'empleados',
    icon: '👨‍💼',
    title: 'Gestión de Empleados',
    description: 'Administra datos, roles y desempeño de tu equipo',
    color: '#14b8a6',
    keywords: ['empleados', 'equipo', 'roles', 'especialidades'],
    steps: [
      {
        title: 'Agregar un empleado',
        duration: '3 min',
        difficulty: 'Básica',
        description: 'Registra los datos principales de cada integrante de tu equipo.',
        instructions: [
          'Ve a Empleados',
          'Haz clic en "Nuevo Empleado"',
          'Completa: nombre completo, DNI, teléfono',
          'Selecciona rol: operario, técnico, supervisor, etc.',
          'Elige especialidad: electricidad, plomería, albañilería, etc.',
          'Define estado (activo, licencia, vacaciones, inactivo)',
          'Establece tarifa horaria',
          'Haz clic en "Guardar"'
        ],
        tips: [
          'Almacena datos de contacto de emergencia',
          'Los roles determinan qué funciones pueden hacer'
        ],
        example: 'Empleado: "Juan Carlos García" - DNI: 28456789 - Rol: Técnico - Especialidad: Electricidad - Tarifa: $450/hora'
      },
      {
        title: 'Generar código QR para asistencia',
        duration: '2 min',
        difficulty: 'Básica',
        description: 'Crea códigos QR individuales para que empleados registren asistencia rápidamente.',
        instructions: [
          'Abre el empleado',
          'Haz clic en "Generar Código QR"',
          'Se abrirá una ventana con el código',
          'Descarga la imagen o imprímela',
          'Comparte con el empleado para que lo guarde'
        ],
        tips: [
          'El código QR es personal y único',
          'Facilita el registro rápido en la obra'
        ]
      }
    ]
  },
  {
    id: 'asistencia',
    icon: '⏰',
    title: 'Control de Asistencia (Fichar)',
    description: 'Registra entrada y salida de empleados con GPS',
    color: '#f43f5e',
    keywords: ['asistencia', 'fichar', 'qr', 'gps', 'entrada', 'salida'],
    steps: [
      {
        title: 'Fichar desde el móvil',
        duration: '3 min',
        difficulty: 'Básica',
        description: 'Los empleados registran entrada y salida usando la app móvil con código QR y GPS.',
        instructions: [
          'El empleado abre la app en su móvil',
          'Va a la sección "Fichar"',
          'Escanea el código QR de la ubicación con su cámara',
          'Captura su firma digital en la pantalla',
          'Haz clic en "Confirmar Entrada" o "Confirmar Salida"',
          'El sistema registra automáticamente GPS y hora'
        ],
        tips: [
          'La firma es obligatoria para validar el fichaje',
          'El GPS verifica que el empleado esté en el lugar correcto'
        ],
        important: 'Sin firma válida, el fichaje no se registra en el sistema.'
      },
      {
        title: 'Ver historial de asistencia',
        duration: '2 min',
        difficulty: 'Básica',
        description: 'Supervisa la asistencia del equipo desde el panel administrativo.',
        instructions: [
          'Ve a Asistencia',
          'Selecciona el rango de fechas',
          'Observa la lista de fichajes por fecha',
          'Haz clic en un fichaje para ver detalles (hora, GPS, firma)',
          'Filtra por empleado o ubicación si es necesario'
        ],
        tips: [
          'Los fichajes incompletos aparecen destacados',
          'Descarga reportes en PDF o Excel para análisis'
        ]
      }
    ]
  },
  {
    id: 'mapa',
    icon: '🗺️',
    title: 'Mapa Interactivo (GPS)',
    description: 'Visualiza ubicaciones de proyectos y empleados en tiempo real',
    color: '#06b6d4',
    keywords: ['mapa', 'gps', 'ubicaciones', 'tiempo real', 'seguimiento'],
    steps: [
      {
        title: 'Crear ubicaciones en el mapa',
        duration: '4 min',
        difficulty: 'Básica',
        description: 'Define puntos de referencia para tus obras y proyectos en el mapa.',
        instructions: [
          'Ve a Mapa Interactivo',
          'Haz clic derecho en el lugar donde quieres crear una ubicación',
          'Se abrirá un formulario con las coordenadas GPS automáticas',
          'Completa: nombre, dirección, descripción',
          'Selecciona tipo de evento: entrada, salida o ambos',
          'Elige un color distintivo',
          'Haz clic en "Crear Ubicación"'
        ],
        tips: [
          'Las coordenadas se rellenan automáticamente según donde hagas clic',
          'Los colores ayudan a identificar ubicaciones rápidamente'
        ],
        example: 'Ubicación: "Obra Centro - Av. 9 de Julio" - Tipo: Ambos - Color: Azul'
      },
      {
        title: 'Visualizar información de ubicaciones',
        duration: '2 min',
        difficulty: 'Básica',
        description: 'Observa estadísticas y detalles de cada ubicación.',
        instructions: [
          'Haz clic en un marcador en el mapa',
          'Se abrirá un popup con información de la ubicación',
          'Lee: nombre, dirección, total de escaneos, estado',
          'Haz clic en la ubicación para ver panel detallado'
        ],
        tips: [
          'El número de escaneos te muestra qué ubicaciones se usan más',
          'Los marcadores azules indican ubicaciones activas'
        ]
      }
    ]
  },
  {
    id: 'reportes',
    icon: '📈',
    title: 'Reportes y Análisis',
    description: 'Genera reportes detallados de operaciones y finanzas',
    color: '#8b5cf6',
    keywords: ['reportes', 'análisis', 'datos', 'gráficos', 'export'],
    steps: [
      {
        title: 'Generar un reporte de proyectos',
        duration: '4 min',
        difficulty: 'Media',
        description: 'Crea reportes sobre el estado y rentabilidad de tus proyectos.',
        instructions: [
          'Ve a Reportes',
          'Selecciona "Proyectos"',
          'Define rango de fechas',
          'Selecciona qué datos incluir: presupuesto, gasto, ganancia, etc.',
          'Haz clic en "Generar Reporte"',
          'Observa gráficos y tablas interactivas',
          'Descarga en PDF o Excel si lo necesitas'
        ],
        tips: [
          'Los gráficos muestran tendencias visuales claramente',
          'Puedes comparar múltiples períodos en paralelo'
        ]
      },
      {
        title: 'Crear reporte de rentabilidad',
        duration: '3 min',
        difficulty: 'Media',
        description: 'Analiza la ganancia real de cada proyecto.',
        instructions: [
          'Ve a Reportes > Rentabilidad',
          'Selecciona un período (mes, trimestre, año)',
          'Selecciona proyectos específicos o todos',
          'El sistema calcula automáticamente:',
          '  - Ingresos totales',
          '  - Costos (materiales, mano de obra)',
          '  - Gastos operativos',
          '  - Ganancia neta y margen',
          'Descarga el análisis'
        ],
        tips: [
          'Un margen sano está entre 20-30%',
          'Identifica proyectos menos rentables para optimizar'
        ]
      }
    ]
  },
  {
    id: 'soporte',
    icon: '🆘',
    title: 'Soporte y Ayuda',
    description: 'Contacta con nosotros y resuelve problemas rápidamente',
    color: '#f59e0b',
    keywords: ['soporte', 'ayuda', 'contacto', 'problemas', 'asistencia'],
    steps: [
      {
        title: 'Acceder al centro de ayuda',
        duration: '2 min',
        difficulty: 'Básica',
        description: 'Encuentra respuestas rápidas y contacta con nuestro equipo de soporte.',
        instructions: [
          'Haz clic en el icono de ayuda (?) en la esquina inferior derecha',
          'Busca tu pregunta en la barra de búsqueda',
          'Navega por las categorías de temas',
          'Lee artículos detallados y tutoriales',
          'Si no encuentras la respuesta, crea un ticket'
        ],
        tips: [
          'La mayoría de problemas tienen solución en la base de conocimiento',
          'Los tickets son respondidos en máximo 24 horas'
        ]
      },
      {
        title: 'Crear un ticket de soporte',
        duration: '2 min',
        difficulty: 'Básica',
        description: 'Si tienes un problema, abre un ticket para que nuestro equipo te ayude.',
        instructions: [
          'Ve a Soporte',
          'Haz clic en "Nuevo Ticket"',
          'Escribe un título claro del problema',
          'Describe detalladamente qué sucede',
          'Selecciona prioridad (baja, media, alta, urgente)',
          'Adjunta capturas de pantalla si es necesario',
          'Haz clic en "Enviar"',
          'Recibirás respuesta por email'
        ],
        tips: [
          'Detalles específicos ayudan a resolver más rápido',
          'Las capturas de pantalla aceleran la solución'
        ]
      }
    ]
  }
];