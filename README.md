# FundaData — Sistema de Gestión Comunitaria

> Plataforma digital para la gestión integral de beneficiarios en centros comunitarios de salud. Desarrollada como Trabajo Práctico Integrador para la materia **Minería y Big Data** — UCA Rosario, 2026.

**Deploy:** [fundadata.vercel.app](https://fundadata.vercel.app)

---

## El problema que resuelve

Las fundaciones comunitarias con múltiples centros operan con datos fragmentados en planillas Excel independientes por centro, sin visibilidad centralizada, sin control de duplicados entre centros, y sin mecanismos de alerta ante situaciones críticas como inasistencias reiteradas de niños o adultos mayores vulnerables.

**FundaData** reemplaza ese modelo por una plataforma unificada con roles diferenciados, auditoría completa y notificaciones automáticas vía WhatsApp.

---

## Funcionalidades principales

### Para tutores (pantalla de login)
- Botón **"Soy tutor"** que despliega un panel con:
  - QR dinámico generado en el browser que abre WhatsApp con Twilio y el código de sandbox (`join music-report`) pre-llenado — el tutor solo toca Enviar
  - Botón de contacto directo con soporte de la Fundación vía WhatsApp

### Para operadores de centro
- Registro de beneficiarios con búsqueda por DNI y **anti-duplicación entre centros** — el sistema detecta si una persona ya está activa en otro centro y lo bloquea
- Fichas técnicas diferenciadas por tipo de centro:
  - **Centro de Niñez:** escolarización, discapacidad, referencia a salud, indicadores de vulnerabilidad
  - **Centro de Día (adultos mayores):** obra social, medicación, movilidad, diagnósticos, CUD, situación social
- Registro de hasta **3 tutores/referentes** por beneficiario con número de WhatsApp
- Control de asistencia diaria con navegación por fechas y modo edición retroactiva
- Indicadores de vulnerabilidad sensibles (consumo, violencia familiar) con campo de detalle condicional
- Dashboard con KPIs del centro y detección de **faltas críticas** (2+ días consecutivos) con ventana de 30 días para detectar ausencias que cruzan el límite de mes

### Para la Fundación
- Dashboard central con KPIs globales: total de activos, % escolarizados, % con CUD, % consumo declarado, % violencia familiar
- Gráficos de distribución por centro y pirámide de edad/sexo
- Tabla centralizada con todos los beneficiarios de todos los centros, filtrable por centro, barrio, estado y fecha de alta
- Vista de expediente individual con **historial de auditoría** — línea de tiempo de todos los cambios realizados por operadores
- Vista de asistencia global con faltas críticas por centro (detección cruzando límite de mes)

### Panel de administración
- Creación de cuentas de operadores con asignación directa de centro
- **Operadores pendientes:** cuando un operador se auto-registra, aparece en una sección "Accesos Pendientes" donde el admin le asigna un centro y lo activa con un clic
- Botón de **disparo manual de alertas** WhatsApp — invoca la Edge Function `check-asistencias` al instante y muestra el resultado por beneficiario (DNI, enviado/error)

### Alertas automáticas
- Edge Function que corre diariamente a las 12:00 (hora Argentina) vía `pg_cron`
- Detecta beneficiarios con **2 días hábiles consecutivos de inasistencia** (el último registro anterior a hoy, no necesariamente ayer exacto — tolera fines de semana y feriados sin carga)
- Envía WhatsApp automático al tutor/referente vía **Twilio WhatsApp API**
- Registro en `notificacion_log` para evitar duplicados el mismo día
- La función consulta `tutor_v2` (multi-tutor) a través de la tabla `vinculo`

### Flujo de registro de operadores
- **Vía admin:** la Fundación crea la cuenta con email, contraseña temporal y centro asignado
- **Auto-registro:** el operador se registra solo desde la pantalla de login → ve la pantalla "Rol Pendiente" con un botón de WhatsApp para contactar a la Fundación → el admin lo ve en la sección "Accesos Pendientes" y le asigna el centro

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + TypeScript + Vite 8 |
| Estilos | Tailwind CSS v4 + Glassmorphism custom |
| Iconografía | Lucide React |
| QR | qrcode.react (generación dinámica en browser) |
| Routing | React Router v7 |
| Deploy | Vercel (SPA routing via `vercel.json`) |
| Backend | Supabase (PostgreSQL + Auth + RLS) |
| Edge Functions | Deno (Supabase Functions) |
| Notificaciones | Twilio WhatsApp Sandbox API |
| Control de acceso | Row Level Security por dispositivo/centro |

---

## Arquitectura de datos

```
persona (DNI único)
    └── vinculo (persona ↔ dispositivo, con estado y auditoría)
            ├── ficha_ninez (campos específicos de niñez)
            ├── ficha_dia (campos específicos de adultos mayores)
            ├── tutor_v2 (hasta 3 referentes con WhatsApp)
            ├── registro_asistencia (por día, con UPSERT idempotente)
            ├── historial_seguimiento (bitácora de cambios)
            └── notificacion_log (log de WhatsApps enviados)

dispositivo (centro comunitario, tipo: ninez | dia)
user_roles (operador | fundacion | pendiente, asignado a un dispositivo)
```

**Decisiones de diseño:**
- Una persona puede tener vínculos en múltiples centros a lo largo del tiempo, pero solo uno activo simultáneamente
- Los campos extendidos de observaciones se almacenan como JSON en la columna `observaciones` para evitar migraciones frecuentes ante cambios de ficha
- La detección de ausencias consecutivas usa una ventana de 30 días (no el mes calendario) para no perder ausencias que cruzan el límite de mes
- Los tutores se almacenan en `tutor_v2` vinculados a través de `vinculo`, permitiendo múltiples referentes por beneficiario por centro

---

## Setup local

### 1. Clonar e instalar dependencias

```bash
git clone https://github.com/aformen9/fundadata.git
cd fundadata
npm install
```

### 2. Variables de entorno

Crear `.env.local` en la raíz del proyecto:

```env
VITE_SUPABASE_URL=https://<tu-proyecto>.supabase.co
VITE_SUPABASE_ANON_KEY=<tu-anon-key>
```

### 3. Base de datos

Ejecutar en orden en el **SQL Editor de Supabase**:

```
1. schema_setup.sql               — tablas principales y RLS
2. migration_asistencia.sql       — asistencia, tutores y notificaciones
3. migration_tutor_v2.sql         — soporte multi-tutor (hasta 3 por beneficiario)
4. migration_fix_tutor_v2.sql     — fix: get_consecutive_absences usa tutor_v2
5. migration_pending_operators.sql — role 'pendiente' y RLS de auto-registro
```

### 4. Edge Function (alertas WhatsApp)

Configurar en **Supabase → Edge Functions → Secrets**:

```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_WHATSAPP_FROM   → whatsapp:+14155238886
```

```bash
supabase functions deploy check-asistencias
```

### 5. Correr en desarrollo

```bash
npm run dev
```

---

## Estructura del proyecto

```
fundadata/
├── public/
│   └── qr-tutor.png               # (ya no usado — QR se genera dinámicamente)
├── src/
│   ├── components/
│   │   ├── CustomCharts.tsx        # BarChart, ProgressCircle, AgeSexDistribution
│   │   └── ProtectedRoute.tsx      # Guard de rutas + pantalla Rol Pendiente
│   ├── context/
│   │   └── AuthContext.tsx         # Sesión, roles, dispositivo asignado
│   ├── pages/
│   │   ├── Login.tsx               # Auth + panel tutor con QR dinámico
│   │   ├── OperatorDashboard.tsx   # Panel operador: fichas + asistencia
│   │   ├── FoundationDashboard.tsx # Panel fundación: KPIs + tabla global
│   │   └── AdminPanel.tsx          # Operadores, pendientes y alertas manuales
│   ├── types.ts                    # Interfaces TypeScript del dominio
│   └── supabaseClient.ts           # Instancia del cliente Supabase
├── supabase/
│   └── functions/
│       └── check-asistencias/
│           └── index.ts            # Edge Function: detección + WhatsApp
├── vercel.json                     # Rewrite SPA para React Router
├── schema_setup.sql
├── migration_asistencia.sql
├── migration_tutor_v2.sql
├── migration_fix_tutor_v2.sql
└── migration_pending_operators.sql
```

---

## Roles y accesos

| Rol | Acceso |
|---|---|
| `fundacion` | Vista global de todos los centros, KPIs, expedientes, admin de cuentas |
| `operador` | Solo ve y opera su centro asignado (enforced por RLS en PostgreSQL) |
| `pendiente` | Solo ve la pantalla "Rol Pendiente" hasta que el admin le asigne un centro |

El primer usuario en registrarse obtiene rol `fundacion` automáticamente. Los demás pueden ser creados por el admin o auto-registrarse (quedan como `pendiente` hasta asignación).

---

## Equipo

Trabajo Práctico Integrador — Minería y Big Data  
Licenciatura en Ciencias de Datos — UCA Rosario, 2026

| Integrantes |
|---|
| Chocobares, Juan Cruz |
| Formenti, Agustín |
| Morenico, Andrés |
| Mendes, Lorenzo |

---

## Licencia

Proyecto académico — UCA Rosario 2026. No destinado a uso productivo sin revisión de seguridad adicional.
