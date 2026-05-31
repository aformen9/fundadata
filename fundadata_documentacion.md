# 🏥 FundaData — Documentación y Flujo del Sistema

Este documento detalla la arquitectura técnica y el recorrido completo de la aplicación (User Journey) para la plataforma FundaData, diseñada para la gestión de beneficiarios en Centros Comunitarios.

---

## 🛠️ Resumen de Tecnologías Usadas

El proyecto está construido bajo una arquitectura moderna de **Single Page Application (SPA)** con un backend Serverless.

### Frontend
- **React 19:** Motor principal de la interfaz de usuario.
- **TypeScript:** Agrega tipado estático estricto, previniendo errores de datos en tiempo de ejecución.
- **Vite (v8):** Herramienta de compilación (bundler) súper rápida y servidor de desarrollo local.
- **Tailwind CSS (v4):** Framework de utilidades CSS para diseño responsive, interfaces oscuras (Dark Mode) y efectos premium como glassmorphism.
- **Lucide React:** Iconografía moderna y ligera en formato SVG.
- **React Router (v7):** Enrutador para manejar la navegación fluida entre páginas sin recargas.

### Backend y Base de Datos
- **Supabase (BaaS):** Plataforma backend integral que provee:
  - **Auth:** Gestión de usuarios, inicio de sesión y tokens JWT.
  - **PostgreSQL:** Base de datos relacional robusta.
  - **Row Level Security (RLS):** Políticas de seguridad a nivel de fila (cada operador solo puede acceder y modificar los datos de su propio centro).

---

## 🔄 Flujo Detallado de la Aplicación

El flujo del sistema se divide en tres partes principales dependiendo de la autenticación y el rol del usuario conectado.

### 1. Ingreso y Autenticación (`/login`)
El usuario ingresa a la aplicación y se topa con la pantalla de inicio de sesión.
- Si no tiene cuenta, puede registrarse. (El primer usuario en registrarse obtiene rol de Fundación/Admin; los siguientes necesitan ser habilitados manualmente o creados desde el panel).
- Al iniciar sesión correctamente, Supabase emite un token de sesión. El `AuthContext` (Contexto de React) lee este token, busca en la base de datos el rol del usuario (`fundacion` u `operador`) y lo deja guardado en memoria.
- **Enrutamiento:** Dependiendo del rol detectado, el sistema redirige automáticamente al usuario a su Dashboard correspondiente.

### 2. Flujo del Operador (Centros Comunitarios)
El operador (trabajador del centro) es dirigido al **OperatorDashboard**.

1. **Pantalla Principal (Listado):** 
   - Ve una interfaz con el nombre de su centro (Niñez o Día).
   - Abajo se lista a todos los beneficiarios **Activos** vinculados exclusivamente a ese centro (gracias a los filtros y al RLS de Supabase).

2. **Búsqueda y Registro (Flujo Anti-Duplicación):**
   - El operador escribe el DNI de una persona en el buscador principal.
   - **Camino A (El DNI no existe):** El sistema abre un formulario en blanco. El operador llena los datos personales, crea el vínculo con el centro y llena la ficha técnica (de niñez o de día según corresponda).
   - **Camino B (El DNI ya existe, pero no asiste al centro):** El sistema dice "Persona encontrada". El operador no tiene que volver a escribir el nombre ni la fecha de nacimiento. Simplemente le da a "Vincular a este centro" y se crea la ficha nueva.
   - **Camino C (El DNI ya tiene un vínculo activo en OTRO centro):** El sistema alerta y prohíbe la carga cruzada, evitando que dos centros contabilicen al mismo beneficiario al mismo tiempo.

3. **Edición y Auditoría:**
   - Si el operador hace clic en "Editar Ficha", puede modificar los indicadores de vulnerabilidad (consumos, violencia, etc.).
   - Al guardar, la app detecta automáticamente qué campos cambiaron y los guarda en la tabla `historial_seguimiento`. Esto deja una bitácora perfecta de "quién cambió qué y cuándo".

### 3. Flujo de la Fundación (Administradores)
El rol de Fundación entra al **FoundationDashboard**. Tiene una vista panorámica (modo "Dios") de todos los centros.

1. **Dashboard de Impacto (Métricas):**
   - Observa gráficos y KPIs globales: Distribución por centros, porcentajes de vulnerabilidad, escolarización, y pirámides de edades. Estos gráficos (`CustomCharts`) iteran sobre los miles de registros en la base de datos agrupando la información en tiempo real.
   
2. **Tabla Centralizada y Buscador General:**
   - Puede buscar a cualquier persona en la base de datos completa.
   - Puede filtrar por Estado (Activos, Egresados, etc.) y por Centro.

3. **Vista de Expediente (Modal de Ficha):**
   - Al hacer clic en el "Ojo" (Ver Ficha) de cualquier persona, se abre un Portal/Modal inmersivo.
   - **Columna Izquierda:** Resumen de los datos duros (Edad calculada en el momento, barrio, alertas si es un usuario egresado).
   - **Columna Derecha (Historial Clínico):** Muestra la línea de tiempo de auditoría (`historial_seguimiento`). La fundación puede ver cómo evolucionó un caso (ej: si un operador marcó violencia familiar hace 3 meses).

4. **Panel de Control de Personal (`/admin`):**
   - Una ruta exclusiva (`ProtectedRoute`) donde la Fundación crea nuevas cuentas de operadores y les asigna contraseñas temporales.
   - Asigna a qué centro exacto va a trabajar cada cuenta, lo cual configura automáticamente la seguridad RLS para ese empleado.
