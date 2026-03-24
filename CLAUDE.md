# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Lazos** is a mobile app for tracking relationships between two users via a shared virtual plant ("lazo"). Users grow their plant by chatting and interacting daily. Built as a monorepo with a React Native frontend and Node.js/Express backend.

## Commands

### Frontend (React Native)

```bash
# Start Metro bundler
npm start

# Run on Android
npm run android

# Run on iOS
npm run ios

# Run tests
npm test

# Run a single test file
npx jest __tests__/App.test.tsx

# Lint
npm run lint

# TypeScript check
npx tsc --noEmit
```

### Backend

```bash
cd backend

# Start development server (with hot reload)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Start database + backend with Docker
docker-compose up -d

# Stop Docker services
docker-compose down
```

## Architecture

### Frontend (`src/`)

**Navigation flow** driven by auth state in `AuthContext`:
- Unauthenticated → `AuthStack` (Login/Register screens)
- Authenticated → `AppTabs` bottom navigation:
  - **Lazos tab** → `LazosStack`: lazo list → chat screen, invite/join flows
  - **Settings tab** → user profile, logout

**Auth flow**: JWT stored in `react-native-keychain` (secure storage), injected via axios interceptor in `src/services/api.ts`. The `AuthContext` (`src/context/AuthContext.tsx`) is the single source of truth for user state.

**Plant mechanics** constants live in `src/constants/index.ts`: XP thresholds, plant phases (seed→sprout→small→big→flower), warning/death thresholds (3/5 days without watering).

### Backend (`backend/src/`)

Express app with JWT auth middleware. Routes:
- `POST /api/auth/register` — creates user, returns JWT
- `POST /api/auth/login` — verifies credentials, returns JWT
- `GET/POST /api/lazos/` — lazo management (requires auth middleware)

A cleanup job (`backend/src/jobs/`) runs to expire old invite codes (15-minute lifetime).

### Database (PostgreSQL)

Schema in `backend/config/schema.sql`. Key tables:
- `users` — accounts with bcrypt passwords, FCM token for future push notifications
- `lazos` — two-user relationships; unique constraint prevents duplicate lazos between same users
- `daily_watering` — tracks per-lazo daily interactions
- `messages` — chat messages
- `invite_codes` — 15-min expiring codes for creating lazos

### Docker / Deployment

Backend deployed via Docker. The `backend/docker-compose.yml` runs PostgreSQL 16 and the backend service on port 3000. The app currently points to a hardcoded production IP (`187.173.233.24`) in `src/constants/index.ts`.

## Development Notes

- **Husky pre-commit hook** runs `npm test` and `lint-staged` (eslint + prettier on staged `.ts/.tsx` files). Tests must pass before commits.
- Backend has no tests yet; frontend has Jest configured with react-native preset.
- Firebase Admin SDK is included in backend dependencies but not yet implemented (planned for push notifications in a future sprint).

## REQUERIMIENTOS DE PROYECTO
### 1.2 Alcance

Este documento define los objetivos, características, restricciones y criterios de éxito del proyecto. El desarrollo tendrá una duración de 3 meses y entregará un producto mínimo viable (MVP) publicable en Google Play Store, con la arquitectura preparada para un futuro lanzamiento en iOS.

---

## 2. Descripción General

### 2.1 Perspectiva del Producto

- **Plataforma:** React Native (CLI) con target principal Android (API 26+), compatible con iOS en el futuro.
    
- **Backend:** API REST desarrollada con Node.js + Express y base de datos PostgreSQL en servidor.
    
- **Almacenamiento local:** WatermelonDB (recomendado) o SQLite vía `react-native-sqlite-storage` para sincronización offline eficiente.
    
- **Autenticación:** Usuario y contraseña con JWT, sin verificación inicial.
    
- **Sistema de invitaciones:** Códigos de un solo uso con validez de 15 minutos.
    
- **Visualización de progreso:** Animaciones SVG creadas con `react-native-svg` y `react-native-reanimated` para una planta que crece por fases (niveles). El crecimiento se basa en el "riego" diario de ambos usuarios y acciones complementarias (mensajes, fotos).
    
- **Navegación:** React Navigation (stack navigator para autenticación y bottom tabs para la sección principal).
    
- **UI Components:** React Native Paper para componentes Material Design adaptados a Android.
    

### 2.2 Funcionalidades Principales (MVP)

- Registro e inicio de sesión con usuario/contraseña.
    
- Creación y gestión de lazos (múltiples conexiones).
    
- Sistema de invitación mediante códigos temporales.
    
- Chat de texto en tiempo real (con sincronización offline usando WatermelonDB).
    
- Envío de fotos (opcional para MVP, podría postergarse a versión 2.0).
    
- Sistema de rachas por lazo basado en "riego" diario.
    
- Animación de planta con niveles de crecimiento mediante SVG.
    
- Notificaciones push básicas (al recibir mensaje o riego) usando Firebase Cloud Messaging.
    
- Sincronización con servidor cuando hay conexión (cola de operaciones pendientes).
    

### 2.3 Usuarios

Usuarios finales: personas que desean mantener una comunicación diaria con sus seres queridos. Cada usuario puede tener múltiples lazos.

### 2.4 Restricciones

- Tiempo de desarrollo: 3 meses.
    
- Recursos: desarrollador único (conocimientos de React/React Native a adquirir o existentes).
    
- Publicación en Google Play requiere cuenta de desarrollador y política de privacidad.
    
- Sin cifrado de extremo a extremo en MVP.
    
- Compatibilidad mínima: Android 8.0 (API 26) o superior.

## 3. Requisitos Específicos (Funcionales y No Funcionales)

### 3.1 Requisitos Funcionales

#### Módulo de Usuarios

- **RF-01:** El sistema permitirá el registro de usuarios con nombre de usuario y contraseña (mínimo 6 caracteres).
    
- **RF-02:** El sistema permitirá el inicio de sesión con credenciales, utilizando JWT para mantener la sesión.
    
- **RF-03:** El usuario podrá cerrar sesión (eliminando el token local).
    
- **RF-04:** El usuario podrá eliminar su cuenta, lo que borrará todos sus lazos y mensajes tanto local como remotamente.
    

#### Módulo de Lazos

- **RF-05:** El usuario podrá generar un código de invitación único desde la app.
    
- **RF-06:** El código tendrá una validez de 15 minutos y caducará automáticamente (controlado por backend).
    
- **RF-07:** El usuario podrá introducir un código de invitación para crear un lazo con otro usuario.
    
- **RF-08:** Al introducir un código válido, ambos usuarios quedarán vinculados en un nuevo lazo.
    
- **RF-09:** El usuario podrá ver una lista de todos sus lazos activos en la pantalla principal (usando FlatList para rendimiento).
    
- **RF-10:** El usuario podrá eliminar un lazo, lo que borrará todos los mensajes asociados (con confirmación previa).
    
- **RF-11:** (Opcional) El usuario podrá cambiar entre lazos mediante un carrusel rotatorio. En fases iniciales, se usará un menú de lista con navegación a la pantalla de chat.
    

#### Módulo de Mensajes

- **RF-12:** Dentro de un lazo, el usuario podrá enviar mensajes de texto.
    
- **RF-13:** Los mensajes se almacenarán localmente en WatermelonDB y se sincronizarán con el servidor cuando haya conexión.
    
- **RF-14:** El usuario podrá ver el historial de mensajes del lazo con paginación (carga de mensajes antiguos al hacer scroll).
    
- **RF-15:** (Post-MVP) El usuario podrá enviar fotos desde galería o cámara usando `react-native-image-picker`.
    
- **RF-16:** Los mensajes no enviados por falta de conexión se encolarán con estado "pendiente" y se enviarán automáticamente al recuperar la conexión (mediante un background task o al abrir la app).
    

#### Módulo de Racha y Planta

- **RF-17:** Cada lazo tendrá una planta virtual con niveles de crecimiento (ej. semilla, brote, planta pequeña, planta grande, flor).
    
- **RF-18:** Para que la planta crezca, ambos usuarios deben "regarla" (acción de riego) al menos una vez al día.
    
- **RF-19:** El riego consiste en pulsar un botón específico en la pantalla del lazo (con feedback háptico opcional).
    
- **RF-20:** Cuando un usuario riega, se envía una notificación push al otro.
    
- **RF-21:** Si ambos riegan en el mismo día, la racha del lazo aumenta en 1 y la planta gana experiencia.
    
- **RF-22:** Acciones adicionales como enviar un mensaje o una foto aceleran el crecimiento (otorgan puntos de experiencia extra, configurables desde backend).
    
- **RF-23:** La planta tiene un contador de "días consecutivos de riego mutuo" (racha) visible en la interfaz.
    
- **RF-24:** Si un día ningún usuario riega, la racha se congela (no aumenta ni disminuye). Si se acumulan 5 días sin riego mutuo, la planta muere y la racha se reinicia a cero.
    
- **RF-25:** La planta puede revivirse dentro de los 5 días si ambos riegan nuevamente (restaurando la planta a su estado anterior).
    
- **RF-26:** La interfaz mostrará la racha numérica y la fase actual de la planta mediante una animación SVG creada con `react-native-svg` y `react-native-reanimated`.
    
- **RF-27:** La planta cambiará de fase al alcanzar ciertos hitos de racha o experiencia (ej. 7 días, 30 días, 100 días). La transición entre fases incluirá una animación suave.
    

#### Módulo de Notificaciones

- **RF-28:** El usuario recibirá notificaciones push cuando (usando `react-native-firebase/messaging`):
    
    - Le llegue un nuevo mensaje.
        
    - Su compañero riegue la planta.
        
    - La planta esté en riesgo de morir (después de 3 días sin riego mutuo, recordatorio diario).
        
- **RF-29:** Las notificaciones serán configurables desde ajustes de la app (activar/desactivar cada tipo).
    

#### Módulo de Sincronización y Backend

- **RF-30:** La API REST proporcionará endpoints para:
    
    - Registro y login (POST /auth/register, POST /auth/login).
        
    - Generar y validar códigos de invitación (POST /lazos/invite, POST /lazos/join).
        
    - Crear, listar y eliminar lazos (GET /lazos, POST /lazos, DELETE /lazos/:id).
        
    - Enviar y recuperar mensajes (GET /lazos/:id/mensajes?page=, POST /lazos/:id/mensajes).
        
    - Actualizar y consultar estado de la planta y racha (GET /lazos/:id/planta, POST /lazos/:id/regar).
        
    - Registrar acciones de riego y sincronizar operaciones offline (POST /sync).
        
- **RF-31:** La base de datos del servidor (PostgreSQL) almacenará usuarios, lazos, mensajes y estados de plantas.
    
- **RF-32:** La app usará WatermelonDB como base de datos local reactiva, sincronizando con el servidor mediante un sistema de colas (operaciones pendientes).
    
- **RF-33:** La sincronización se activará al abrir la app, al recuperar conexión y periódicamente en segundo plano (si es posible).
    

### 3.2 Requisitos No Funcionales

- **RNF-01 (Usabilidad):** La interfaz debe ser intuitiva, con colores cálidos y navegación clara usando React Navigation. Se seguirán las guías de Material Design para Android.
    
- **RNF-02 (Rendimiento):**
    
    - La carga de mensajes debe ser rápida; se usará paginación (20 mensajes por vez) con FlatList optimizada.
        
    - Las animaciones SVG deben mantener 60 fps usando `react-native-reanimated`.
        
    - El tamaño de la app debe optimizarse (eliminar recursos no utilizados, usar Hermes).
        
- **RNF-03 (Seguridad):**
    
    - Las contraseñas se almacenarán hasheadas con bcrypt en backend.
        
    - Las comunicaciones serán mediante HTTPS.
        
    - Los tokens JWT se almacenarán de forma segura en el dispositivo (react-native-keychain).
        
- **RNF-04 (Privacidad):**
    
    - Solo los miembros del lazo pueden acceder a los mensajes.
        
    - Se publicará una política de privacidad que cumpla con GDPR y normas de Google Play.
        
    - El usuario podrá descargar sus datos y eliminar su cuenta.
        
- **RNF-05 (Disponibilidad):** El backend debe tener un uptime del 99% (puede ser un servidor básico en Railway, Heroku o similar).
    
- **RNF-06 (Portabilidad):**
    
    - La app debe funcionar en Android 8.0 (API 26) o superior.
        
    - El código debe estar estructurado para permitir un futuro lanzamiento en iOS con mínimo esfuerzo.
        
- **RNF-07 (Mantenibilidad):**
    
    - El código usará TypeScript para tipado estático.
        
    - Se seguirán convenciones de estilo (ESLint + Prettier).
        
    - Control de versiones con Git (GitHub/GitLab).
        
    - Documentación básica de componentes y pantallas.## 3. Requisitos Específicos (Funcionales y No Funcionales)

### 3.1 Requisitos Funcionales

#### Módulo de Usuarios

- **RF-01:** El sistema permitirá el registro de usuarios con nombre de usuario y contraseña (mínimo 6 caracteres).
    
- **RF-02:** El sistema permitirá el inicio de sesión con credenciales, utilizando JWT para mantener la sesión.
    
- **RF-03:** El usuario podrá cerrar sesión (eliminando el token local).
    
- **RF-04:** El usuario podrá eliminar su cuenta, lo que borrará todos sus lazos y mensajes tanto local como remotamente.
    

#### Módulo de Lazos

- **RF-05:** El usuario podrá generar un código de invitación único desde la app.
    
- **RF-06:** El código tendrá una validez de 15 minutos y caducará automáticamente (controlado por backend).
    
- **RF-07:** El usuario podrá introducir un código de invitación para crear un lazo con otro usuario.
    
- **RF-08:** Al introducir un código válido, ambos usuarios quedarán vinculados en un nuevo lazo.
    
- **RF-09:** El usuario podrá ver una lista de todos sus lazos activos en la pantalla principal (usando FlatList para rendimiento).
    
- **RF-10:** El usuario podrá eliminar un lazo, lo que borrará todos los mensajes asociados (con confirmación previa).
    
- **RF-11:** (Opcional) El usuario podrá cambiar entre lazos mediante un carrusel rotatorio. En fases iniciales, se usará un menú de lista con navegación a la pantalla de chat.
    

#### Módulo de Mensajes

- **RF-12:** Dentro de un lazo, el usuario podrá enviar mensajes de texto.
    
- **RF-13:** Los mensajes se almacenarán localmente en WatermelonDB y se sincronizarán con el servidor cuando haya conexión.
    
- **RF-14:** El usuario podrá ver el historial de mensajes del lazo con paginación (carga de mensajes antiguos al hacer scroll).
    
- **RF-15:** (Post-MVP) El usuario podrá enviar fotos desde galería o cámara usando `react-native-image-picker`.
    
- **RF-16:** Los mensajes no enviados por falta de conexión se encolarán con estado "pendiente" y se enviarán automáticamente al recuperar la conexión (mediante un background task o al abrir la app).
    

#### Módulo de Racha y Planta

- **RF-17:** Cada lazo tendrá una planta virtual con niveles de crecimiento (ej. semilla, brote, planta pequeña, planta grande, flor).
    
- **RF-18:** Para que la planta crezca, ambos usuarios deben "regarla" (acción de riego) al menos una vez al día.
    
- **RF-19:** El riego consiste en pulsar un botón específico en la pantalla del lazo (con feedback háptico opcional).
    
- **RF-20:** Cuando un usuario riega, se envía una notificación push al otro.
    
- **RF-21:** Si ambos riegan en el mismo día, la racha del lazo aumenta en 1 y la planta gana experiencia.
    
- **RF-22:** Acciones adicionales como enviar un mensaje o una foto aceleran el crecimiento (otorgan puntos de experiencia extra, configurables desde backend).
    
- **RF-23:** La planta tiene un contador de "días consecutivos de riego mutuo" (racha) visible en la interfaz.
    
- **RF-24:** Si un día ningún usuario riega, la racha se congela (no aumenta ni disminuye). Si se acumulan 5 días sin riego mutuo, la planta muere y la racha se reinicia a cero.
    
- **RF-25:** La planta puede revivirse dentro de los 5 días si ambos riegan nuevamente (restaurando la planta a su estado anterior).
    
- **RF-26:** La interfaz mostrará la racha numérica y la fase actual de la planta mediante una animación SVG creada con `react-native-svg` y `react-native-reanimated`.
    
- **RF-27:** La planta cambiará de fase al alcanzar ciertos hitos de racha o experiencia (ej. 7 días, 30 días, 100 días). La transición entre fases incluirá una animación suave.
    

#### Módulo de Notificaciones

- **RF-28:** El usuario recibirá notificaciones push cuando (usando `react-native-firebase/messaging`):
    
    - Le llegue un nuevo mensaje.
        
    - Su compañero riegue la planta.
        
    - La planta esté en riesgo de morir (después de 3 días sin riego mutuo, recordatorio diario).
        
- **RF-29:** Las notificaciones serán configurables desde ajustes de la app (activar/desactivar cada tipo).
    

#### Módulo de Sincronización y Backend

- **RF-30:** La API REST proporcionará endpoints para:
    
    - Registro y login (POST /auth/register, POST /auth/login).
        
    - Generar y validar códigos de invitación (POST /lazos/invite, POST /lazos/join).
        
    - Crear, listar y eliminar lazos (GET /lazos, POST /lazos, DELETE /lazos/:id).
        
    - Enviar y recuperar mensajes (GET /lazos/:id/mensajes?page=, POST /lazos/:id/mensajes).
        
    - Actualizar y consultar estado de la planta y racha (GET /lazos/:id/planta, POST /lazos/:id/regar).
        
    - Registrar acciones de riego y sincronizar operaciones offline (POST /sync).
        
- **RF-31:** La base de datos del servidor (PostgreSQL) almacenará usuarios, lazos, mensajes y estados de plantas.
    
- **RF-32:** La app usará WatermelonDB como base de datos local reactiva, sincronizando con el servidor mediante un sistema de colas (operaciones pendientes).
    
- **RF-33:** La sincronización se activará al abrir la app, al recuperar conexión y periódicamente en segundo plano (si es posible).
    

### 3.2 Requisitos No Funcionales

- **RNF-01 (Usabilidad):** La interfaz debe ser intuitiva, con colores cálidos y navegación clara usando React Navigation. Se seguirán las guías de Material Design para Android.
    
- **RNF-02 (Rendimiento):**
    
    - La carga de mensajes debe ser rápida; se usará paginación (20 mensajes por vez) con FlatList optimizada.
        
    - Las animaciones SVG deben mantener 60 fps usando `react-native-reanimated`.
        
    - El tamaño de la app debe optimizarse (eliminar recursos no utilizados, usar Hermes).
        
- **RNF-03 (Seguridad):**
    
    - Las contraseñas se almacenarán hasheadas con bcrypt en backend.
        
    - Las comunicaciones serán mediante HTTPS.
        
    - Los tokens JWT se almacenarán de forma segura en el dispositivo (react-native-keychain).
        
- **RNF-04 (Privacidad):**
    
    - Solo los miembros del lazo pueden acceder a los mensajes.
        
    - Se publicará una política de privacidad que cumpla con GDPR y normas de Google Play.
        
    - El usuario podrá descargar sus datos y eliminar su cuenta.
        
- **RNF-05 (Disponibilidad):** El backend debe tener un uptime del 99% (puede ser un servidor básico en Railway, Heroku o similar).
    
- **RNF-06 (Portabilidad):**
    
    - La app debe funcionar en Android 8.0 (API 26) o superior.
        
    - El código debe estar estructurado para permitir un futuro lanzamiento en iOS con mínimo esfuerzo.
        
- **RNF-07 (Mantenibilidad):**
    
    - El código usará TypeScript para tipado estático.
        
    - Se seguirán convenciones de estilo (ESLint + Prettier).
        
    - Control de versiones con Git (GitHub/GitLab).
        
    - Documentación básica de componentes y pantallas.

## 4. Criterios de Éxito

- La aplicación permite a dos usuarios registrarse, crear un lazo mediante código y enviarse mensajes.
    
- La planta refleja correctamente el estado de riego y racha, con animaciones fluidas.
    
- Las notificaciones push funcionan en dispositivos Android con Google Play Services.
    
- La sincronización offline encola mensajes y los envía al recuperar conexión sin pérdida de datos.
    
- No hay errores críticos (crash) en las funcionalidades principales.
    
- La aplicación está publicada en Google Play (al menos en pruebas cerradas) con todos los assets requeridos.
    
- El código está correctamente estructurado y documentado para futuras iteraciones.
    

---

## 5. Decisiones Técnicas y Pendientes

### 5.1 Decisiones tomadas

- **Frontend:** React Native CLI (TypeScript) para tener control total sobre módulos nativos.
    
- **Backend:** Node.js + Express + PostgreSQL (mismo lenguaje que frontend).
    
- **Autenticación:** JWT almacenado en react-native-keychain.
    
- **Base de datos local:** WatermelonDB por su reactividad, soporte offline y sincronización.
    
- **Notificaciones:** Firebase Cloud Messaging (react-native-firebase/messaging).
    
- **Navegación:** React Navigation 6.x (stack, bottom tabs).
    
- **UI Components:** React Native Paper (Material Design para Android).
    
- **Animaciones:** react-native-svg + react-native-reanimated 2.x.
    
- **Cámara/Galería (post-MVP):** react-native-image-picker.
    
- **Almacenamiento de fotos (post-MVP):** Cloudinary o AWS S3 con URLs firmadas.
    
- **Sincronización:** Estrategia basada en WatermelonDB con colecciones sincronizables y cola de operaciones pendientes.
    

### 5.2 Puntos pendientes por resolver

- **Husos horarios:** Definir cómo se manejará el corte del día para el riego (ej. UTC o basado en zona horaria del usuario). Pendiente de decisión.
    
- **Sistema de experiencia:** Determinar puntos exactos:
    
    - Riego base: ¿10 puntos?
        
    - Mensaje de texto: ¿1 punto? (con límite diario para evitar spam)
        
    - Foto: ¿5 puntos?
        
    - Umbrales para cambios de fase: ¿100, 500, 1000 puntos?
        
- **Diseño de la animación SVG:** Crear o contratar los assets de la planta en cada fase (mínimo 5 fases).
    
- **Manejo de conflictos offline:** Si ambos usuarios modifican algo sin conexión (ej. regar a la vez), definir política: "último en sincronizar gana" o implementar merge básico.
    
- **Estrategia de paginación en WatermelonDB:** Cómo sincronizar mensajes antiguos sin saturar memoria.
    
- **Despliegue del backend:** Elegir plataforma (Railway, Render, DigitalOcean) y configurar CI/CD.

## 6. Plan de Desarrollo (Sprints orientativos con React Native)

### Sprint 0 (Setup inicial - Semana 1)

- [x] Configurar entorno React Native CLI + TypeScript.
- [x] Estructura de carpetas (src/components, src/screens, src/services, etc.).
- [x] Configurar ESLint, Prettier, Husky.
- [x] Crear repositorio Git.
- [x] Diseñar esquema de base de datos PostgreSQL.
- [x] Configurar proyecto backend básico con Express.

### Sprint 1 (Semanas 2-3): Autenticación y navegación base

- [ ] Implementar pantallas de registro y login con React Native Paper.
- [ ] Conectar con API de autenticación (JWT).
- [ ] Configurar React Navigation (Stack para auth, Bottom Tabs para app principal).
- [ ] Almacenar token en Keychain.

### Sprint 2 (Semanas 4-5): Gestión de lazos y códigos

- [ ] Pantalla principal con lista de lazos (FlatList).
- [ ] Pantalla para generar código de invitación (con temporizador de 15 min).
- [ ] Pantalla para introducir código y crear lazo.
- [ ] Conectar con endpoints de lazos en backend.
- [ ] Integración básica con WatermelonDB para almacenar lazos localmente.

### Sprint 3 (Semanas 6-7): Chat de texto offline-first

- [ ] Pantalla de chat con Gifted Chat o componente personalizado.
- [ ] Implementar WatermelonDB para mensajes (modelo Message).
- [ ] Sistema de cola para mensajes pendientes (pendientes de envío).
- [ ] Conectar con API de mensajes (paginación al hacer scroll).
- [ ] Sincronización básica al abrir la app.

### Sprint 4 (Semanas 8-9): Sistema de riego y planta

- [ ] Implementar botón de riego en pantalla de chat.
- [ ] Crear componente de planta con SVG estático (fases iniciales).
- [ ] Conectar con API para registrar riego y actualizar racha.
- [ ] Lógica de cálculo de racha en backend (cron job diario).
- [ ] Almacenar estado de planta en WatermelonDB.
- [ ] Mostrar racha numérica.

### Sprint 5 (Semanas 10-11): Animaciones y notificaciones

- [ ] Integrar react-native-reanimated con SVG para transiciones entre fases.
- [ ] Implementar notificaciones push con Firebase (solicitar permisos, manejar mensajes).
- [ ] Notificaciones al recibir mensaje y al recibir riego.
- [ ] Recordatorios de planta en riesgo (después de 3 días sin riego).
- [ ] Pulir animaciones y feedback visual.

### Sprint 6 (Semana 12): Pruebas, publicación y documentación

- [ ] Pruebas integrales en dispositivos reales (Android 8-13).
- [ ] Corrección de bugs críticos.
- [ ] Preparar assets para Google Play (icono, capturas, descripción).
- [ ] Escribir política de privacidad.
- [ ] Generar APK firmado y subir a Play Console (pruebas cerradas).
- [ ] Documentación final del proyecto (README, guía de despliegue).

## 7. Glosario

- **Lazo:** Conexión entre dos usuarios que comparten un chat y una planta.
    
- **Riego:** Acción diaria que indica que el usuario ha interactuado con el lazo (pulsar botón).
    
- **Racha:** Número de días consecutivos en que ambos usuarios han regado.
    
- **Planta:** Representación visual del progreso del lazo, con fases de crecimiento (SVG animado).
    
- **Código de invitación:** Token temporal (15 min) de un solo uso para crear un lazo.
    
- **WatermelonDB:** Base de datos local reactiva para React Native, ideal para apps offline-first.
    
- **React Native Paper:** Librería de componentes Material Design para React Native.
    

---

## 8. Stack Tecnológico Resumido

|Capa|Tecnología|Propósito|
|---|---|---|
|Frontend|React Native (CLI) + TypeScript|Desarrollo móvil multiplataforma|
|Navegación|React Navigation 6|Rutas y transiciones|
|UI|React Native Paper|Componentes Material Design|
|Estado global|Context API / Redux Toolkit (según necesidad)|Manejo de estado de la app|
|Base de datos local|WatermelonDB|Almacenamiento offline y sincronización|
|Animaciones|react-native-svg + react-native-reanimated|Planta animada por fases|
|Notificaciones|@react-native-firebase/messaging|Push notifications|
|Backend|Node.js + Express + PostgreSQL|API REST y datos persistentes|
|Autenticación|JWT + react-native-keychain|Sesión segura|
|Almacenamiento seguro|react-native-keychain|Tokens y credenciales|
|HTTP Client|Axios|Peticiones a API|
|Despliegue|Google Play Console|Publicación Android|

