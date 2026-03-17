# PocketPal Finance — v3.0

> Gestor de finanzas personales con agente de inteligencia artificial integrado.

PocketPal es una aplicación web full-stack que permite registrar ingresos, gastos y metas de ahorro. El asistente **NOVA** (GPT-4o con function calling) entiende lenguaje natural en español colombiano y puede registrar transacciones, consultar estadísticas y gestionar metas directamente desde el chat.

---

## Tecnologías

| Capa         | Tecnología                                           |
|--------------|------------------------------------------------------|
| Backend      | Node.js 20 + Express 5 (ES Modules)                 |
| Base de datos| MySQL 8 — pool de conexiones via `mysql2/promise`    |
| Auth         | JWT (`jsonwebtoken`) + Google OAuth 2.0 (Passport)   |
| IA           | OpenAI GPT-4o con function calling                   |
| Gmail sync   | Google APIs (`googleapis`) + parser de extractos     |
| Frontend     | HTML + Tailwind CSS (CDN) + Chart.js 4               |
| Cron         | `node-cron` — sync automático de Gmail cada hora     |
| Seguridad    | `helmet`, `cors`, `express-rate-limit`, `bcryptjs`   |

---

## Instalación rápida

```bash
# 1. Instalar dependencias
cd backend && npm install

# 2. Configurar entorno
cp backend/.env.example backend/.env   # editar con tus valores reales

# 3. Crear base de datos MySQL
mysql -u root -p -e "CREATE DATABASE pocketpal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
# Las tablas se crean automáticamente al arrancar

# 4. Arrancar
npm run dev     # desarrollo con nodemon
npm start       # producción
```

El frontend se sirve estático en `http://localhost:3000`.

---

## Variables de entorno (`.env`)

| Variable               | Descripción                                | Ejemplo                     |
|------------------------|--------------------------------------------|-----------------------------|
| `DB_HOST`              | Host de MySQL                              | `localhost`                 |
| `DB_PORT`              | Puerto de MySQL                            | `3306`                      |
| `DB_NAME`              | Nombre de la base de datos                 | `pocketpal`                 |
| `DB_USER`              | Usuario de MySQL                           | `root`                      |
| `DB_PASSWORD`          | Contraseña de MySQL                        | `mi_password`               |
| `JWT_SECRET`           | Clave secreta para firmar tokens JWT       | string largo y aleatorio    |
| `JWT_EXPIRES_IN`       | Tiempo de expiración del JWT               | `7d`                        |
| `OPENAI_API_KEY`       | Clave de API de OpenAI                     | `sk-proj-...`               |
| `OPENAI_MODEL`         | Modelo de OpenAI                           | `gpt-4o` (defecto)          |
| `GOOGLE_CLIENT_ID`     | Client ID de Google OAuth                  | `...apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Client Secret de Google OAuth              | `GOCSPX-...`                |
| `CORS_ORIGIN`          | Orígenes permitidos (separados por coma)   | `http://localhost:3000`     |
| `FRONTEND_URL`         | URL base del frontend para redirects OAuth | `http://localhost:3000`     |
| `PORT`                 | Puerto del servidor HTTP                   | `3000`                      |
| `NODE_ENV`             | Entorno                                    | `development`               |

---

## Estructura del proyecto

```
pocketpal/
├── backend/
│   ├── server.js                      ← Punto de entrada: initDB + app.listen()
│   └── src/
│       ├── app.js                     ← Express: middlewares, rutas, error handler
│       ├── config/
│       │   ├── db.js                  ← Pool MySQL (mysql2/promise)
│       │   └── passport.js            ← Estrategia Google OAuth 2.0
│       ├── db/
│       │   └── init.js                ← CREATE TABLE + migraciones + seed categorías
│       ├── errors/
│       │   └── AppError.js            ← Clases de error tipadas (400/401/404/409...)
│       ├── middleware/
│       │   ├── authMiddleware.js      ← protect(): verifica JWT en Authorization header
│       │   ├── errorHandler.js        ← Handler centralizado de errores (4 params)
│       │   ├── rateLimiter.js         ← Limitadores: API, Auth, IA
│       │   └── validate.js            ← Motor de validación declarativa
│       ├── routes/                    ← Solo URLs + middlewares → controller
│       ├── controllers/               ← Reciben req, llaman servicio, forman res.json()
│       ├── services/                  ← Lógica de negocio + queries SQL
│       │   ├── aiService.js           ← Agente NOVA (OpenAI + tools + historial)
│       │   ├── authService.js         ← Registro, login, OAuth helpers
│       │   ├── categoryService.js     ← CRUD categorías con control de scope
│       │   ├── goalService.js         ← CRUD metas + aportes (transacciones MySQL)
│       │   ├── summaryService.js      ← Totales, desglose, tendencia mensual
│       │   ├── transactionService.js  ← CRUD transacciones + paginación server-side
│       │   └── gmailService.js        ← Lectura Gmail + parser de extractos bancarios
│       ├── utils/
│       │   ├── hash.js                ← bcrypt: hashPassword / comparePassword
│       │   └── jwt.js                 ← generateToken / verifyToken
│       └── jobs/
│           └── syncCron.js            ← Cron Gmail (cada hora, todos los usuarios)
└── frontend/
    ├── index.html                     ← Login / Registro
    ├── dashboard.html                 ← Dashboard principal
    ├── ai.html                        ← Chat con el agente NOVA
    ├── css/
    │   └── styles.css                 ← Estilos globales (tema dark premium)
    └── js/
        ├── api.js                     ← Cliente HTTP + auth, transactions, categories,
        │                                goals, summary, ai, fmt, toast
        ├── dashboard.js               ← Orquestador: carga datos, renderStats, sync Gmail
        ├── script.js                  ← Sidebar móvil (open/close)
        └── modules/
            ├── ui.js                  ← Helpers DOM: openModal, closeModal, setTxType,
            │                            populateCategorySelects, setButtonLoading
            ├── charts.js              ← Chart.js: barras, dona, línea acumulada
            ├── txModule.js            ← CRUD transacciones + paginación + filtros
            ├── goalsModule.js         ← CRUD metas + aportes + flujo completada
            └── categoriesModule.js    ← CRUD categorías personalizadas
```

---

## API Reference

> Todas las rutas (excepto `/api/auth/*`) requieren: `Authorization: Bearer <token>`

### Auth — `/api/auth`

| Método | Ruta               | Auth | Descripción                          |
|--------|--------------------|------|--------------------------------------|
| POST   | `/register`        | No   | Registro con email/contraseña        |
| POST   | `/login`           | No   | Login con email/contraseña           |
| GET    | `/me`              | Sí   | Datos del usuario autenticado        |
| GET    | `/google`          | No   | Inicia flujo Google OAuth            |
| GET    | `/google/callback` | No   | Callback de Google                   |

### Transacciones — `/api/transactions`

Filtros en GET `/`: `?type`, `?category_id`, `?start_date`, `?end_date`, `?page`, `?limit`

```json
// Respuesta con paginación:
{
  "success": true,
  "data": {
    "transactions": [...],
    "pagination": { "total": 73, "page": 2, "limit": 20, "totalPages": 4 }
  }
}
```

| Método | Ruta   | Descripción                        |
|--------|--------|------------------------------------|
| GET    | `/`    | Listar con paginación y filtros     |
| GET    | `/:id` | Obtener por ID                     |
| POST   | `/`    | Crear (`type`, `amount`, `category_id`, `date?`, `description?`) |
| PUT    | `/:id` | Actualizar (todos los campos requeridos) |
| DELETE | `/:id` | Eliminar                           |

### Categorías — `/api/categories`

Las categorías globales son de solo lectura para el usuario.

| Método | Ruta   | Descripción                                     |
|--------|--------|-------------------------------------------------|
| GET    | `/`    | Listar (globales + personalizadas del usuario)   |
| GET    | `/:id` | Obtener por ID                                  |
| POST   | `/`    | Crear categoría personalizada (`name`, `type`)  |
| PUT    | `/:id` | Editar (solo propias del usuario)               |
| DELETE | `/:id` | Eliminar (solo propias, sin transacciones)      |

### Metas — `/api/goals`

| Método | Ruta                  | Descripción                                    |
|--------|-----------------------|------------------------------------------------|
| GET    | `/`                   | Listar todas las metas con porcentaje          |
| GET    | `/:id`                | Obtener meta con historial de aportes          |
| POST   | `/`                   | Crear meta (`title`, `target_amount`)          |
| PUT    | `/:id`                | Actualizar (objetivo ≥ monto ya ahorrado)      |
| DELETE | `/:id`                | Eliminar meta + goal_allocations               |
| POST   | `/:goalId/contribute` | Abonar dinero (crea transacción tipo 'saving') |
| POST   | `/:goalId/complete`   | Registrar decisión final                       |

**Sobre eliminar una meta:** Los aportes previos (transacciones tipo `saving`) permanecen en el historial. Solo se eliminan la meta y los registros de `goal_allocations`. El balance ya fue afectado en cada aporte y no se revierte.

### Resumen — `/api/summary`

| Método | Ruta     | Query params             | Descripción                                  |
|--------|----------|--------------------------|----------------------------------------------|
| GET    | `/`      | `start_date`, `end_date` | Totales, desglose por categoría, tendencia mensual |
| GET    | `/goals` | —                        | Metas activas y completadas con estadísticas |

### Agente IA — `/api/ai`

| Método | Ruta       | Descripción                              |
|--------|------------|------------------------------------------|
| POST   | `/chat`    | Enviar mensaje al agente NOVA (30/hora)  |
| GET    | `/history` | Historial de conversación                |
| DELETE | `/history` | Borrar historial                         |

### Gmail — `/api/gmail`

| Método | Ruta    | Descripción                       |
|--------|---------|-----------------------------------|
| POST   | `/sync` | Sincronización manual desde Gmail |

---

## Flujo de autenticación Google OAuth

```
Usuario → "Continuar con Google"
  → GET /api/auth/google
  → Google (scope: profile + email + gmail.readonly)
  → Usuario autoriza
  → GET /api/auth/google/callback
  → Passport crea/vincula usuario en DB
  → Genera JWT y redirige a:
    /frontend/dashboard.html?token=<jwt>&name=...&email=...&avatar=...
  → dashboard.js captura token, guarda en localStorage, limpia URL
```

---

## Agente NOVA — Capacidades

| Frase de ejemplo | Tool ejecutada |
|---|---|
| "Gasté 50.000 en almuerzo hoy" | `create_transaction` → expense |
| "Recibí mi salario de 3 millones" | `create_transaction` → income |
| "¿Cuánto gasté este mes?" | `query_stats` → period: month |
| "Muéstrame mis últimas transacciones" | `list_transactions` |
| "¿Cómo van mis metas?" | `goals_status` |
| "Crea una meta para viaje a Europa por 5M" | `create_goal` |
| "Abona 200.000 a mi meta de viaje" | `allocate_to_goal` |
| "Actualiza mi meta de viaje a 6 millones" | `update_goal` |

---

## Arquitectura del frontend (módulos)

```
dashboard.html
  ├── api.js                  — cliente HTTP global, fmt, toast, auth helpers
  ├── modules/
  │   ├── ui.js               — DOM helpers sin lógica de negocio
  │   ├── charts.js           — renderCharts(summaryData) → Chart.js
  │   ├── txModule.js         — CRUD transacciones + paginación + filtros
  │   ├── goalsModule.js      — CRUD metas + aportes + flujo completada
  │   └── categoriesModule.js — CRUD categorías custom del usuario
  └── dashboard.js            — orquestador: loadAllData(), renderStats(), init
```

Cada módulo tiene su propio estado interno (prefijo `_`) y funciones expuestas globalmente. La comunicación entre módulos se hace a través de la función global `loadAllData()` que el orquestador expone.

---

## Rate limiting

| Endpoint         | Límite              |
|------------------|---------------------|
| Toda la API      | 200 req / 15 min    |
| Login / Registro | 10 req / 15 min     |
| Chat con NOVA    | 30 mensajes / hora  |

---

## Buenas prácticas implementadas

- **Arquitectura en capas**: Routes → Controllers → Services. Sin lógica de negocio ni SQL en controllers.
- **Transacciones MySQL**: operaciones multi-tabla usan `BEGIN / COMMIT / ROLLBACK` (goalService.allocate, goalService.delete).
- **Errores tipados**: `AppError` y subclases garantizan respuestas JSON consistentes con `statusCode` y `code`.
- **Paginación server-side**: la tabla de transacciones nunca carga el historial completo.
- **Validación declarativa**: middleware `validate(rules.xxx)` antes del controller.
- **Sin contraseñas en texto plano**: bcrypt con 10 salt rounds.
- **Modularización frontend**: cada recurso tiene su módulo JS con estado propio y responsabilidad única.
- **JSDoc completo**: todos los archivos tienen `@file`, `@param`, `@returns`, `@throws`.
- **FOR UPDATE en aportes**: el bloqueo de fila evita condiciones de carrera en aportes concurrentes a la misma meta.

---

## Licencia

MIT
