#10		Hacer que cuando se responda a una foto si se vea			x
#9		Agregar fecha de los mensajes			x
#8		Arreglar notificaciones			-
#7		Burbuja con numero de notificaciones			x
#6		Mensajes de riego en el chat			x
#5		Hacer que al momento de hacer slide sobre un mensaje automaticamente el teclado se despliegue			x
#4		Arreglar no poder eliminar lazos			x
#3		Meter un metodo para reiniciar la racha en caso de que se pierda			x
#2		Arreglar login para que los campos no aparezcan en oscuro			x
#1		Arreglar riego para que no se quede atascado			x 

> **Estado de migraciones (FASE B):** `backend/config/migrations/002_system_messages.sql` PENDIENTE de aplicar en producción (permite `type='system'` en messages). Sin ella, los mensajes de riego (B3) fallarán con error de CHECK constraint. `schema.sql` ya actualizado. B1 y B2 no requieren migraciones.

estas seran las tareas para ti en el proyecto de hoy, primero que nada estudia la base de codigo, te dire un poquito lo que quiero en cada parte del proyecto:
1.- Cuando yo riego la planta sino quito el pulgar antes de que se termine de regar se queda atascada, tengo un marge de 1 segundo en el que si se termino de regar y lo quito se puede regresar pero en la mayoria de los casos simplemente se queda atascada hasta que yo salga y vuelva a entrar, necesito una manera de forzar a que vuelva a su lugar despues del riego.
2.- Cuando veo la pantalla de login los campos aparecen en color negro, como si la aplicacion estuviese en modo oscuro, arregla esto
3.- Necesito un boton o algo que permita revivir la racha cuando se pierda, de momento se pierde y no hay una manera clara de reinciarla
4.- No puedo eliminar lazos, los borro y vuelven a aparecer despues de iniciar de nuevo la aplicacion, haz que el borrado sea permanente, en cuanto uno de los 2 lados decida borrar el lazo asi se quedara
5.- Esto es bastante autoexplicativo, por ahora cada que yo hago slide para contestar a un mensaje en especifico tengo que presionar manualmente el teclado para que se despliegue, quiero que cuando quiera contestar a un mensaje especificamente el teclado se despliegue
6.- Quiero que se manden mensajes del estilo "[usuario] ha regado la planta" y "No se ha regado, quedan [cantidad] dias", asegurate que cuando sea 1 diga 1 dia
7.- Quiero una implementacion que me permita ver una burbuja con el numero de mensajes pendientes, 1,2,3...9+. de modo de que un vistazo pueda ver si tengo algun mensaje sin ver o no
8.- No existen notificaciones, no he logrado hacer que funcionen. de todas las notificaciones que deberia haber en la aplicacion no hay ni una sola. Quiero notificaciones de mensajes, recordatorios de riego y una en caso de que se haya perdido la racha de riego
9.- Quiero que mientras scrolleo en el chat pueda ver los mensajes con fecha, quiero fechas relativas, tipo ayer, jueves, miercoles, lunes, hasta un maximo de 3 dias donde ya se debera presentar en formato fecha, dd/mm, en caso de ser mensajes mayor a 1 year, deberan presentar el formato dd/mm/aa
10.- ahora cuando envio una foto el preview se ve bien, aunque me gustaria que este se ajustara al tamano de la foto, en relacion al ratio de la foto, ademas ahora cuando se contesta a una foto el mensaje aparece vacio, la repspuesta, ahi me gustaria que hubiera una contestacion tipo [(imagen a la que se esta respondiendo en chiquito) Foto (literalmente texto)] o algo por el estilo, similar a las respuestas en whatsapp.
11.- por ultimo y este es extra a la lista que te envie:
Ya se pueden compartir videos de redes sociales, el problema es que no se pueden copiar links, a lo que me refiero es, el link se envia, pero la persona que lo recibe no puede abrirlo, quiero que cuando la aplicacion detecte un link automaticamente lo haga un hipervinculo de modo de que con un simple toque te lleve a la aplicacion deseada.
Otra cosa es que me gustaria que hubiera un preview del video, se que cuando envio un link en otras redes sociales aparece un preview, la "portada" del video, quiero eso.
12.- ligado a lo anterior, revisa la viabilidad de hacer un reproductor interno a la aplicacion, en whatsapp cuando yo veo ciertos videos en lugar de enviarme directamente a la aplicacion el video se puede reproducir ahi mismo, como si fuera un video descargado y enviado pero sin necesidad de descargar, simplemente con el link, abre un reproductor y ahi mismo se ve, esto seria maravilloso para tiktok debido a que no tengo la aplicacion y su web es horrible de navegar, pero aun asi quiero ver comodamente los tiktoks que se me mandan, entonces me encantaria esta funcionalidad, estudia la viabilidad, dime que opinas. este sera el plan que seguiremos para esto

---

# INSTRUCCIONES PARA EL AGENTE EJECUTOR

Este documento es tu fuente de verdad. Fue generado tras una exploración exhaustiva del codebase. Las referencias `archivo:línea` corresponden al estado actual del repo (rama `main`). Las líneas pueden desplazarse a medida que completas tareas: **usa siempre el contexto del código, no solo el número de línea**.

## 0. Contexto crítico del codebase (trampas a evitar)

1. **El chat NO es una pantalla de navegación.** Es un modal (`ChatModal`) definido dentro de `src/screens/lazos/LazosListScreen.tsx` (archivo de ~2360 líneas). La ruta `Chat` en `src/types/index.ts:90` nunca se registra en `LazosStack.tsx`. Casi todo el trabajo de frontend de este plan ocurre en ese archivo: `ChatModal` (~líneas 497-1111), `SideMenu` (~1114-1330), `WaterButton` (274-456), y la pantalla principal (resto).
2. **CLAUDE.md está desactualizado.** Menciona WatermelonDB y react-native-reanimated: **ninguno está instalado**. El estado local se maneja con servicios propios + `react-native-keychain` (ver `src/services/unreadService.ts` como patrón de referencia). Las animaciones usan `Animated` del core de RN.
3. **La app apunta a producción.** `src/constants/index.ts:2`: `API_BASE_URL = 'https://lazos.axeldchosting.org/api'`. Todo cambio de backend que despliegues afecta el servidor real. El socket va a `SOCKET_BASE_URL` (misma línea 6).
4. **Realtime = Socket.IO.** Cliente: `src/services/realtimeService.ts` (re-emite todo por `DeviceEventEmitter` como `rt:<evento>`). Servidor: `backend/src/realtime.ts`. Eventos existentes: `message:new`, `message:reaction`, `watering:update`, `lazo:deleted`, `lazo:created`.
5. **Deploy backend:** `./deploy-backend.sh` hace `git push` + SSH a `187.173.233.24` + `docker-compose build --no-cache && up -d`. **NUNCA lo ejecutes ni hagas `git push`/`git commit` sin permiso explícito del usuario.** Pregunta siempre antes.
6. **Migraciones SQL son manuales.** `docker-compose.yml` monta `schema.sql` solo como initdb (corre una sola vez al crear el volumen). Las migraciones nuevas se aplican a mano en el servidor (ver sección 2).
7. **Husky pre-commit** corre `npm test` + lint-staged. Los tests deben pasar antes de cualquier commit.
8. **Tipos compartidos** de mensajes/lazos en `src/types/index.ts` (tipo `Message` en líneas 38-58). Si cambias el payload del backend, actualiza aquí también.
9. **El media se sirve sin auth** (`backend/src/index.ts:32-35`, hay un TODO). No es parte de este plan; no lo "arregles" (cambiaría las URLs existentes).
10. **`backend/dist/` está commiteado.** El Dockerfile reconstruye desde fuente (`npm run build` en stage 1), así que `dist/` en el repo es irrelevante para producción, pero corre `cd backend && npm run build` localmente para verificar que compila.

## 1. Verificación obligatoria por tarea

Tras completar CADA tarea:

```bash
npx tsc --noEmit        # TypeScript limpio
npm test                # Jest (lo exige Husky)
npm run lint            # ESLint
# Si tocaste backend:
cd backend && npm run build
```

Pruebas manuales: el usuario prueba en su dispositivo. Tú verificas con los comandos anteriores y, cuando aplique, con tests unitarios nuevos de la lógica que agregues (el proyecto tiene Jest configurado; ver `__tests__/App.test.tsx`).

## 2. Cómo aplicar migraciones SQL en producción

1. Crea el archivo de migración en `backend/config/migrations/00X_descripcion.sql` (sigue la numeración: ya existe `001_messages_media.sql`; la siguiente es `002`).
2. Aplícala localmente si tienes la BD local (`cd backend && docker-compose up -d db && docker exec -i lazos_db psql -U lazos -d lazos < config/migrations/00X_....sql`).
3. **Producción:** pide permiso al usuario y luego, vía SSH: `docker exec -i lazos_db psql -U lazos -d lazos < migration.sql` (copiando el archivo al servidor primero), o entrega el SQL al usuario para que lo aplique. Documenta en el PR/commit qué migraciones faltan por aplicar.
4. Actualiza también `backend/config/schema.sql` para que refleje el estado final (es la referencia para instalaciones nuevas).

## 3. Orden de ejecución (por riesgo/dependencias)

Las tareas están ordenadas de menor a mayor riesgo. La numeración `#N` corresponde a la lista original del usuario (arriba). **Complétalas en este orden:**

### FASE A — Fixes aislados de frontend (bajo riesgo, sin backend)
1. **A1 = #2** Login oscuro
2. **A2 = #5** Teclado al swipe-reply
3. **A3 = #1** Riego atascado
4. **A4 = #9** Fechas relativas en chat
5. **A5 = #7** Badge de no leídos

### FASE B — Full-stack (frontend + backend)
6. **B1 = #10** Reply a foto + aspect ratio de imágenes
7. **B2 = #4** Borrado permanente de lazos
8. **B3 = #6** Mensajes de riego en el chat
9. **B4 = #3** Botón visible de revivir planta

### FASE C — Infraestructura y features grandes
10. **C1 = #8** Notificaciones push
11. **C2 = #11** Hyperlinks + previews de links
12. **C3 = #12** Reproductor interno de video

Cada fase es desplegable de forma independiente. Puedes hacer commit por tarea (pide permiso antes de cada commit).

---

## FASE A — Fixes aislados de frontend

### A1 (#2): Login oscuro

**Diagnóstico:** `App.tsx:13` renderiza `<PaperProvider>` **sin prop `theme`**. En react-native-paper v5 eso hace que siga el modo oscuro del sistema. Como los fondos de `LoginScreen.tsx` están hardcodeados a claro (`#FAFAFA`, línea 90), el resultado es pantalla clara con campos oscuros. Además el tema nativo es `Theme.AppCompat.DayNight.NoActionBar` (`android/app/src/main/res/values/styles.xml:4`).

**Pasos:**
1. En `App.tsx`: importar `MD3LightTheme` de `react-native-paper`, crear un tema explícito (puedes personalizar `colors.primary` con el verde de la app, revisa la paleta en `LazosListScreen.tsx`, constante `C`) y pasarlo: `<PaperProvider theme={theme}>`.
2. En `android/app/src/main/res/values/styles.xml`: cambiar el parent a `Theme.AppCompat.Light.NoActionBar` para que el splash/statusbar nativos tampoco sigan al sistema.
3. Revisar `LoginScreen.tsx` y `RegisterScreen.tsx`: si algún `TextInput` sigue viéndose mal, agregar `textColor` explícito. No cambies los fondos de pantalla.

**Verificación:** `npx tsc --noEmit && npm test`. Visual: con el modo oscuro del sistema ACTIVADO, el login debe verse claro.

---

### A2 (#5): Teclado automático al swipe-reply

**Diagnóstico:** El swipe (`LazosListScreen.tsx:916-934`) solo hace `setReplyTarget(item)`. El `TextInput` de `ChatInput.tsx:108-117` no expone ref ni tiene `autoFocus`, así que nadie lo enfoca. Además `handleFocusExpand` (~líneas 810-817), que expande el chat de modo medio a pantalla completa, solo corre cuando el input recibe foco.

**Pasos:**
1. En `src/components/ChatInput.tsx`: convertir a `forwardRef` exponiendo el `TextInput` interno (o exponer una prop `inputRef`). Mantén intacta la API existente del componente.
2. En el `ChatModal` (`LazosListScreen.tsx`): crear `const inputRef = useRef<TextInput>(null)` y pasarlo a `ChatInput`.
3. En `onSwipeableWillOpen` (donde hoy se hace `setReplyTarget(item)`, ~línea 928): después de `setReplyTarget`, llamar `inputRef.current?.focus()` y también `handleFocusExpand()` para que el chat pase a pantalla completa.
4. Probar también el caso del reply desde el menú contextual si existe (busca otros lugares que hagan `setReplyTarget`).

**Verificación:** `npx tsc --noEmit && npm test`. Manual: swipe sobre un mensaje → teclado se abre y el chat expande sin tocar el input.

---

### A3 (#1): Riego se queda atascado

**Diagnóstico (causa raíz confirmada):** En `WaterButton` (`LazosListScreen.tsx:274-456`):
- Cuando la animación de llenado de 3s termina (callback en `startFill`, líneas 326-342), se hace `pan.flattenOffset()` y se dispara el spring de retorno **con el dedo todavía apoyado**.
- `onPanResponderMove` (líneas 374-390) escribe `pan.x/pan.y` en CADA movimiento **sin verificar si ya completó** → cualquier micro-movimiento del dedo tras completar re-arrastra el botón bajo el dedo.
- `onPanResponderRelease` (líneas 391-400) hace **early return vacío** si `completedRef.current === true` → si el move re-arrastró el botón después del completion, ya nada lo regresa jamás. El `pan` es un ref que sobrevive re-renders; solo se resetea al desmontar (salir y re-entrar).

**Pasos (fix mínimo, no reescribir el componente):**
1. En `onPanResponderMove`: agregar guard al inicio → `if (completedRef.current) { return; }`.
2. En `onPanResponderRelease`: eliminar el early return vacío. Hacer la limpieza **siempre** (es idempotente): `pan.flattenOffset()`, `isNearRef.current = false`, `setIsRaining(false)`, y `returnToOrigin()`. Si no completó, además `resetFill()`. (Hoy `returnToOrigin` ya incluye el spring a `{x:0,y:0}`, líneas 355-362; llamarlo dos veces es inofensivo.)
3. En el `useEffect` de `disabled` (líneas 421-433): cuando pasa a `true`, además de lo que ya hace, forzar `pan.setValue({ x: 0, y: 0 })` como red de seguridad final.
4. NO cambies `useNativeDriver` ni la duración de 3s; no es el problema.

**Casos a probar manualmente:** (a) arrastrar y soltar antes de completar → regresa; (b) mantener el dedo quieto tras completar y soltar tarde → regresa; (c) completar y seguir moviendo el dedo sin soltar → el botón NO se mueve tras completar y regresa al soltar.

**Verificación:** `npx tsc --noEmit && npm test` + prueba manual de los 3 casos.

---

### A4 (#9): Fechas relativas en el chat

**Diagnóstico:** Solo se muestra la hora por mensaje (`formatTime`, `LazosListScreen.tsx:783-789`). No hay separadores de día ni agrupación.

**Requisito del usuario (exacto):** fechas relativas: `Hoy`, `Ayer`, nombre del día en español (`lunes`, `martes`...) hasta un máximo de 3 días atrás; más de 3 días → `dd/mm`; más de 1 año → `dd/mm/aa`.

**Pasos:**
1. Crear `src/utils/dateFormat.ts` con una función pura y testeable:
   ```ts
   export function formatChatDateSeparator(dateIso: string, now: Date = new Date()): string
   ```
   Lógica: comparar por **días calendario** (no por diferencia de 24h): misma fecha → `Hoy`; 1 día → `Ayer`; 2-3 días → nombre del día (`domingo`...`sábado`, usa `toLocaleDateString('es-ES', { weekday: 'long' })` o array propio para no depender del locale del dispositivo); >3 días del mismo año → `dd/mm`; distinto año → `dd/mm/aa` (año a 2 dígitos).
2. Crear `__tests__/dateFormat.test.ts` con casos: hoy, ayer, 2 días, 3 días exactos, 4 días, cambio de mes, cambio de año, más de 1 año. Inyecta `now` como parámetro para tests deterministas.
3. En el `ChatModal`: la `GHFlatList` es `inverted` con `data={messages}` ordenado descendente. Para cada mensaje en índice `i`, muéstrale separador si `i === messages.length - 1` o si `messages[i+1]` (el mensaje cronológicamente anterior) es de otro día. Como la lista está invertida, el separador se renderiza **después** visualmente-arriba del mensaje: ponlo dentro del mismo item renderizado, encima de la burbuja (recuerda que con `inverted` el layout se invierte; prueba visual).
4. Estilo del separador: pill centrado, fondo gris claro semitransparente, texto pequeño gris oscuro (coherente con la paleta existente, constante `C`).

**Verificación:** `npm test` (los tests nuevos deben pasar), `npx tsc --noEmit`. Manual: scroll en chat con mensajes de varios días.

---

### A5 (#7): Burbuja con número de mensajes pendientes

**Diagnóstico:** La mayor parte YA existe:
- `src/services/unreadService.ts` (67 líneas): mapa `lazoId→count` en Keychain, evento `UNREAD_CHANGED`, `incrementUnread`, `clearUnread`.
- UI de badge ya implementada en dos lugares: SideMenu (`LazosListScreen.tsx:1267-1272`, estilos 2218-2237) y FAB del chat (~1865-1869).
- Al abrir un chat ya se limpia (`clearUnread`, líneas 552-560).

**Lo que falta:**
1. **El badge nunca sube con la app en foreground.** El incremento solo ocurre vía FCM (`notificationService.ts:140-147` y 185-188), y las push están rotas (ver C1). Cuando llega un mensaje por socket con el chat cerrado, **nadie incrementa**: el listener de `rt:message:new` solo existe DENTRO del `ChatModal` abierto (línea 601).
   - **Fix:** en la pantalla principal (componente raíz de `LazosListScreen`, NO dentro de `ChatModal`), suscribirse a `DeviceEventEmitter` al evento `rt:message:new`; si `message.senderId !== userId actual` y `message.lazoId !== getActiveChatLazo()` (importar de `notificationService.ts`, líneas 117-119) → `incrementUnread(message.lazoId)`. Desuscribirse en el cleanup. Ojo con no duplicar conteo si en el futuro FCM y socket llegan a la vez: por ahora acepta el riesgo (FCM foreground incrementa solo si llega push; documenta el posible doble conteo como conocido).
2. **Formato:** el usuario pidió `1,2,3...9+` pero `formatUnreadBadge` (`unreadService.ts:63-67`) devuelve `"+9"`. Cambiar a `"9+"` y agregar test en `__tests__/unreadService.test.ts` (la función es pura; testea 0→`''`, 1→`'1'`, 9→`'9'`, 10→`'9+'`, 150→`'9+'`).
3. (Badge en el ícono del launcher NO está en scope: requeriría librería nativa nueva. No lo agregues.)

**Verificación:** `npm test && npx tsc --noEmit`. Manual con dos cuentas: enviar mensaje con la app receptora abierta y chat cerrado → badge sube; abrir chat → badge se limpia.

---

## FASE B — Full-stack

### B1 (#10): Reply a foto visible + aspect ratio de imágenes

**Diagnóstico (dos bugs relacionados):**

*Bug A — reply a foto se ve vacío:* cadena completa de la falla:
1. Los mensajes de media se insertan con `content = ''` (`backend/src/controllers/messagesController.ts:209`).
2. El JOIN de reply solo trae `r.content AS reply_content` y `r.sender_id` (líneas 51-52, 60) → `reply_content = ''` para fotos.
3. El render de la cita exige `item.replyToId && item.replyContent` (`LazosListScreen.tsx:953`) → `''` es falsy → **la cita no se renderiza en absoluto**.
4. La barra de preview sobre el input muestra `replyTarget.content` (~línea 1057) → vacía al responder a foto.
5. El mensaje optimista copia `replyContent: replyTarget?.content` (~líneas 679, 726) → también `''`.

*Bug B — aspect ratio:* las columnas `media_width`, `media_height`, `media_duration_ms` existen en la BD (`backend/config/migrations/001_messages_media.sql:17-19`) pero **nunca se escriben**: el cliente no las envía en el FormData (`src/services/mediaService.ts:80-100`, aunque `image-picker` sí las entrega en el asset) y el INSERT no las incluye. El render ya sabe usar `aspectRatio` cuando existen (`LazosListScreen.tsx:967-990`).

**Pasos backend (`messagesController.ts`):**
1. En TODAS las consultas que traen mensajes con su reply (el listado paginado ~líneas 45-70, y los fetch post-insert de `sendMessage` ~116-125 y `sendMediaMessage` ~218-227): agregar al JOIN `r.type AS reply_type`, `r.media_url AS reply_media_url`, `r.media_mime AS reply_media_mime`.
2. En `sendMediaMessage` (146-243): aceptar `media_width`, `media_height`, `media_duration_ms` del body y persistirlos en el INSERT.
3. No requiere migración SQL (las columnas ya existen).

**Pasos frontend:**
4. `src/types/index.ts` (38-58): agregar `replyType?`, `replyMediaUrl?`, `replyMediaMime?` al tipo `Message`.
5. `src/services/mediaService.ts` `uploadMedia` (80-100): agregar al FormData `width`, `height` (y `duration` si el asset lo trae, videos) desde el asset de `image-picker`.
6. Render de la cita dentro de la burbuja (~953-966): cambiar la condición a `item.replyToId && (item.replyContent || item.replyType)`. Si es foto: thumbnail pequeño (~40x40, usa `resolveMediaUrl` de `mediaService.ts:72-78`) + texto literal `"Foto"`; si es video: ícono/thumbnail + texto `"Video"`; si es texto: como hoy. Estilo tipo cita de WhatsApp: miniatura a la izquierda, texto gris a la derecha.
7. Barra de preview sobre el input (~1054-1062): mismo tratamiento (si el target es foto sin content → mostrar `"Foto"` + miniatura).
8. Mensaje optimista (~679, 726): copiar también `replyType`/`replyMediaUrl` del `replyTarget`.

**Verificación:** `cd backend && npm run build`, `npx tsc --noEmit`. Manual: responder a una foto → la cita muestra miniatura + "Foto"; subir foto nueva → se renderiza con su aspect ratio real (esto último solo aplica a fotos subidas DESPUÉS del fix; las viejas no tienen dimensiones guardadas).

---

### B2 (#4): Borrado permanente de lazos

**Diagnóstico (causa raíz):** El backend está BIEN: `DELETE /api/lazos/:id` hace hard delete (`lazosController.ts:346`) con CASCADE. El problema es 100% cliente: el borrado tiene una "ventana para deshacer" de 4 segundos implementada con `setTimeout` (`LazosListScreen.tsx:1701-1731`). Si el usuario **cierra/mata la app dentro de esos 4s**, o el componente se desmonta (el cleanup de líneas 1749-1753 CANCELA todos los timers sin ejecutarlos), `deleteLazoRemote` nunca se llama → el lazo reaparece al reiniciar.

**Pasos (patrón outbox con Keychain, siguiendo el patrón de `unreadService.ts`):**
1. Crear `src/services/pendingDeletesService.ts`: persiste un array de `lazoId` pendientes en Keychain (servicio `'lazos_pending_deletes'`), con cache en memoria. Funciones: `getPendingDeletes()`, `addPendingDelete(lazoId)`, `removePendingDelete(lazoId)`, y `flushPendingDeletes()` que itera la cola llamando `deleteLazoRemote` (de `src/services/lazosService.ts:45-52`), remueve de la cola los que tengan éxito (incluye 404 como éxito: ya no existe) y conserva los que fallen por red.
2. En `markPendingDelete` (~1675-1732): al marcar, llamar `addPendingDelete(lazoId)` ANTES de iniciar el timer. Cuando el timer dispara `deleteLazoRemote` con éxito → `removePendingDelete(lazoId)`.
3. En `undoDelete` (~1734-1747): `removePendingDelete(lazoId)`.
4. Flush al arranque: en la pantalla principal (o `AuthContext` tras autenticarse, ver `src/context/AuthContext.tsx`), ejecutar `flushPendingDeletes()` una vez montada la sesión. Mantén el filtro visual existente (`pendingDeleteIdsRef`) para que los lazos pendientes no parpadeen al cargar: inicialízalo desde `getPendingDeletes()`.
5. Mantener el Snackbar de "Deshacer" y los 4s tal cual (la UX no cambia; solo se vuelve resiliente).

**Verificación:** `npm test` (agrega test del servicio mockeando Keychain si es sencillo; ver `__mocks__/`), `npx tsc --noEmit`. Manual: borrar lazo y matar la app ANTES de 4s → al reabrir, el lazo no debe reaparecer (se borra en el flush).

---

### B3 (#6): Mensajes de riego en el chat

**Requisito del usuario (exacto):** mensajes tipo sistema `"[usuario] ha regado la planta"` y `"No se ha regado, quedan [cantidad] dias"`, con singular correcto cuando es 1 ("queda 1 día").

**Diseño:** tipo de mensaje nuevo `'system'`, generado en backend, renderizado centrado sin burbuja de usuario.

**Pasos backend:**
1. Migración `backend/config/migrations/002_system_messages.sql`: el CHECK actual es inline en la columna (`schema.sql:50-51`: `CHECK (type IN ('text', 'photo', 'video'))`, nombre auto-generado `messages_type_check`). Hacer `ALTER TABLE messages DROP CONSTRAINT messages_type_check;` y recrearlo con `('text', 'photo', 'video', 'system')`. Verifica el nombre real del constraint en producción con `\d messages` en psql antes de dropearlo (si difiere, ajusta la migración). Actualiza también `schema.sql`.
2. En `waterLazo` (`lazosController.ts:191-321`): tras un riego NUEVO exitoso (no cuando `alreadyWateredToday`), hacer `INSERT INTO messages (lazo_id, sender_id, content, type) VALUES ($1, $2, $3, 'system')` con content `"<username> ha regado la planta"` (obtén el username de la tabla `users`). Emitir `message:new` por socket con `emitToLazo` (sigue el patrón de `messagesController.ts:133,234`).
3. En `streakJob.ts` (corre a medianoche CDMX): además de matar plantas a los 5 días, para lazos activos donde `CURRENT_DATE - last_mutual_watering_on` está entre 1 y 4 (y no están muertos): insertar mensaje system `"No se ha regado, quedan N días"` donde `N = 5 - días_transcurridos`; si `N === 1` → `"No se ha regado, queda 1 día"`. OJO: este mensaje describe los días que quedan ANTES de morir. Usa como `sender_id` el `user1_id` del lazo (es mensaje de sistema; el render lo ignora).
4. Decide (documenta tu decisión) si los mensajes system cuentan para no-leídos; recomendación: NO incrementan unread (el frontend los filtrará en el listener de A5 — coordina con esa tarea).

**Pasos frontend:**
5. `src/types/index.ts`: agregar `'system'` a la union de `Message.type`.
6. Render en `ChatModal`: si `item.type === 'system'`, renderizar pill centrado gris (texto itálico, fondo `#00000010` o similar coherente con la paleta), SIN `Swipeable`, SIN burbuja mine/other, SIN hora (o con hora discreta). Incluir en `keyExtractor` y paginación igual que los demás (vienen en el mismo listado).
7. En el listener de no-leídos de A5: ignorar mensajes `type === 'system'`.

**Verificación:** `cd backend && npm run build`, `npx tsc --noEmit`. Aplicar migración 002 (ver sección 2). Manual: regar → aparece el mensaje en ambos dispositivos vía socket.

---

### B4 (#3): Botón visible de revivir planta

**Contexto:** El backend YA revive automáticamente: si ambos riegan estando la planta `'dead'`, restaura la fase según el XP guardado y pone `streak = 1` (`lazosController.ts:243-259`; el XP no se pierde al morir). El usuario confirmó que solo quiere que este flujo sea EVIDENTE en la UI (NO restaurar el valor anterior de la racha).

**Pasos (solo frontend, en `LazosListScreen.tsx`):**
1. Cuando el lazo activo tiene `plant_phase === 'dead'`: mostrar un estado visual claro de "planta muerta" (la `AnimatedPlant` ya tiene fase dead; verifica cómo la dibuja `src/components/AnimatedPlant.tsx`).
2. Cambiar el `WaterButton` o su label de ayuda cuando está muerta: texto tipo `"¡Revive tu planta! Arrastra la gota para regar"` en lugar del texto normal. Reutiliza el MISMO flujo de riego (mismo endpoint, sin cambios de lógica).
3. Tras regar estando muerta y el compañero aún no riega: mostrar mensaje de estado tipo `"Ya regaste. Cuando <nombre> también riegue, la planta revivirá."` (el endpoint devuelve `partnerWateredToday`; el listado de lazos también trae esos campos — revisa `getLazos` y el tipo `Lazo` en `src/types/index.ts`).
4. Cuando ambos riegan y revive, la respuesta incluye `justStreaked: true` → ya dispara la celebración (`celebrateKey`, ~línea 1773). Asegúrate de que funcione también para el caso revive.

**Verificación:** `npx tsc --noEmit`. Manual: forzar un lazo muerto en BD (`UPDATE lazos SET plant_phase='dead', streak=0 WHERE id='...'`) y probar el flujo completo con dos cuentas.

---

## FASE C — Infraestructura y features grandes

### C1 (#8): Notificaciones push

**Diagnóstico:** El código está ~95% implementado en AMBOS lados:
- **Cliente:** `src/services/notificationService.ts` (199 líneas, completo: permisos Android 13+, getToken con timeout, upload a `PUT /auth/fcm-token`, handlers foreground/background). Android nativo configurado: permiso `POST_NOTIFICATIONS` (AndroidManifest.xml:5), servicio FCM (67-73), canal `lazos_default` creado en `MainApplication.kt:31-44`, plugin google-services aplicado (`android/app/build.gradle:130`).
- **Backend:** `backend/src/services/notificationService.ts` (215 líneas: `notifyNewMessage`, `notifyWatering`, `notifyLazoCreated`, `notifyLazoDeleted`, `sendDailyWateringReminders`), invocado desde controllers; recordatorio diario 20:00 CDMX (`backend/src/jobs/dailyReminderJob.ts`); `firebase-service-account.json` existe en `backend/`.

**Causa raíz del fallo:** falta `android/app/google-services.json` (está en `.gitignore:74`, cada entorno debe colocarlo). Sin él Firebase no inicializa en el cliente → `getToken()` nunca corre → `users.fcm_token` queda NULL → el backend hace early-return en todos los `notify*`. Nada llega.

**Pasos:**

1. **Obtener `google-services.json` (puede requerir al usuario):**
   - Ir a [Firebase Console](https://console.firebase.google.com/) → proyecto de Lazos (el mismo del `firebase-service-account.json` del backend).
   - ⚙️ Configuración del proyecto → sección "Tus apps" → si ya existe la app Android con package `com.lazos`: descargar `google-services.json`. Si NO existe: "Agregar app" → Android → package name `com.lazos` (es el `applicationId`, `android/app/build.gradle:82`), nickname opcional, SHA-1 NO es necesario para FCM → registrar y descargar.
   - Colocar el archivo en `android/app/google-services.json`.
   - Verificar que compila: `cd android && ./gradlew assembleDebug` (el plugin `com.google.gms.google-services` falla ruidosamente si el archivo falta o el package no coincide — ese es tu check).
   - **NO commitear el archivo** (está gitignored; respeta eso).

2. **Verificar el flujo de token (en dispositivo/emulador con Play Services):**
   - Tras login, los logs deben mostrar `[notifications] Token FCM obtenido` (los `console.warn` de `notificationService.ts` delatan fallos).
   - En la BD: `SELECT id, username, fcm_token FROM users;` → el token NO debe ser NULL tras abrir la app.
   - En el servidor: verificar que el log del backend muestra `[notifications] Firebase Admin inicializado` al arrancar (si no, el `firebase-service-account.json` no está llegando al contenedor; revisa volumen/copia en el servidor — el Dockerfile hace `COPY . .` en stage 1 pero stage 2 solo copia `dist/` y `node_modules`: **verifica que el JSON esté presente en la imagen de producción**, puede requerir agregar `COPY firebase-service-account.json ./` al stage 2 del `backend/Dockerfile` si falta).

3. **Probar las 3 notificaciones pedidas:**
   - Mensaje nuevo: ya existe (`notifyNewMessage`, invocado en `messagesController.ts:136,237`).
   - Recordatorio de riego: ya existe (`dailyReminderJob` 20:00 CDMX → `sendDailyWateringReminders`). Para probar sin esperar, ejecuta la función manualmente con un script o ajusta temporalmente la hora del job (revierte después).
   - **Racha perdida: NO EXISTE — implementarla.** En `streakJob.ts`: el UPDATE que mata plantas debe hacer `RETURNING id, user1_id, user2_id` para capturar los lazos afectados, y por cada uno llamar a una nueva función `notifyStreakLost(userIds)` en `backend/src/services/notificationService.ts` (sigue el patrón de `notifyWatering`, líneas 110-138): título/cuerpo tipo `"Tu planta ha muerto 😢 / Perdiste la racha de N días"` (obtén el streak ANTES del update), con `data: { type: 'streak_lost', lazoId }`. En el cliente, `setupForegroundHandler` (`notificationService.ts:122-167`) ya despacha por `data.type`: agregar caso para refrescar la lista (emitir `lazos:refresh`).

4. **Deploy:** pide permiso al usuario para `./deploy-backend.sh` (hace git push). Confirma que la migración de tokens funciona y haz prueba E2E con ambos usuarios del usuario.

**Verificación:** build de Android OK; token en BD; push recibida con app en foreground, background y killed (las 3); recordatorio manual OK; streak-lost recibida al forzar muerte de planta.

---

### C2 (#11): Hyperlinks + previews de links

**Diagnóstico:** No existe NADA de linkify: los links se renderizan como `<Text>` plano (`LazosListScreen.tsx:1014-1018`), sin `Linking`, sin librería de parsing en `package.json`. Los links compartidos desde otras apps llegan vía share intent nativo (`src/services/shareIntent.ts` + `android/.../ShareIntentModule.kt`) y se envían como mensaje de texto plano.

**Parte 1 — Hyperlinks (frontend):**
1. Instalar `react-native-parsed-text` (`npm install react-native-parsed-text`). Si da problemas de compatibilidad con RN 0.84, alternativa: parser propio con regex `(https?:\/\/[^\s]+)` que trocee el string y renderice `<Text>` anidados (documenta la decisión).
2. En el render del texto del mensaje (~1014-1018): usar `ParsedText` con `parse={[{ type: 'url', style: styles.linkText, onPress: handleOpenUrl }]}`.
3. `handleOpenUrl`: `Linking.openURL(url)` envuelto en try/catch (y normalizar: si no empieza por http, prefijar `https://`). Estilo del link: color azul/acento + underline, respetando el color de burbuja mine/other.

**Parte 2 — Previews (backend + frontend):**
4. Backend: instalar un parser HTML ligero (`cheerio` o `node-html-parser`).
5. Nuevo endpoint `GET /api/lazos/:id/link-preview?url=<encoded>` (auth requerido, membresía del lazo verificada — sigue el patrón de otros handlers de `lazosRoutes.ts`):
   - Validar: solo `http(s)`, rechazar IPs privadas/localhost (anti-SSRF), timeout 5s, `User-Agent` tipo bot de redes sociales (`facebookexternalhit/1.1` suele desbloquear OG tags de TikTok/Instagram), tamaño máximo de respuesta (~1MB).
   - Parsear OpenGraph: `og:title`, `og:description`, `og:image`, `og:site_name`. Fallback: `<title>`.
   - **Seguir redirects** (fundamental para links cortos `vm.tiktok.com` / `vt.tiktok.com`) y devolver también la URL final resuelta (`resolved_url`).
   - Cache: tabla nueva `link_previews` (migración `003_link_previews.sql`): `url TEXT PRIMARY KEY, title TEXT, description TEXT, image_url TEXT, site_name TEXT, resolved_url TEXT, fetched_at TIMESTAMPTZ DEFAULT NOW()`. Cache hit (< 7 días) → responder sin scrapear. Actualiza `schema.sql`.
6. Frontend: en la burbuja, detectar la PRIMERA url del texto; si existe, `GET` al endpoint (cache en memoria por sesión) y renderizar card bajo el texto: imagen (si hay) + título + dominio; tap en la card → `Linking.openURL(resolved_url || url)`. Skeleton/gris mientras carga; si falla, no mostrar nada (degradación silenciosa).

**Verificación:** `cd backend && npm run build`, `npx tsc --noEmit`, migración 003 aplicada. Manual: enviar link de YouTube y de TikTok → link clickeable + card con portada.

---

### C3 (#12): Reproductor interno de video (TikTok)

**Estudio de viabilidad (ya realizado — conclusiones):**

- **Extraer el stream directo del video (para `react-native-video`): DESCARTADO.** Viola los ToS de TikTok, las URLs firmadas expiran en horas, y los scrapers se rompen constantemente. No es mantenible para una app en producción.
- **Embed oficial vía WebView: VIABLE y es la vía elegida (Plan A).** TikTok ofrece embed oficial: `https://www.tiktok.com/embed/v2/{videoId}` — es lo que usa WhatsApp y otras apps. Reproduce dentro de un WebView sin salir de la app.
- **Fallback (Plan B):** si el WebView resulta problemático (bloqueos, cookies, rendimiento), quedarse con la card de preview de C2 que abre el link externamente.

**Pasos (Plan A):**
1. Instalar `react-native-webview` (`npm install react-native-webview`).
2. Backend (extender el endpoint de C2): al scrapear, si el dominio es TikTok, extraer el `videoId` de la URL resuelta (patrón `/video/(\d+)`; también de `vm.tiktok.com` tras resolver redirect) y devolverlo en el JSON como `embed: { provider: 'tiktok', videoId }`.
3. Frontend: componente nuevo `src/components/InlineVideoPlayer.tsx`:
   - En la card de preview de C2, si el preview trae `embed.provider === 'tiktok'`, mostrar botón de play.
   - Al tocar: modal interno con `WebView` apuntando a `https://www.tiktok.com/embed/v2/{videoId}`, props: `javaScriptEnabled`, `mediaPlaybackRequiresUserAction={false}` (para autoplay al abrir), `allowsFullscreenVideo`. Aspect ratio 9:16 (TikTok vertical), ancho casi completo de pantalla.
   - Botón de cerrar; pausar/destruir el WebView al cerrar.
4. **Criterio de fallback:** si durante las pruebas el embed falla de forma consistente (pantalla en blanco, login wall), NO insistas: deja el `InlineVideoPlayer` detrás de un flag y entrega Plan B (card de C2 que abre con `Linking`). Documenta en el código y reporta al usuario la decisión.
5. Extensible (opcional, solo si es trivial): YouTube (`youtube.com/embed/{id}`) usa el mismo mecanismo. Instagram embed es menos confiable; no lo fuerces.

**Verificación:** `npx tsc --noEmit`. Manual en dispositivo: tocar play en un TikTok → se reproduce dentro de la app; cerrar → sin audio residual. Probar también link corto `vm.tiktok.com`.

---

## 4. Notas finales para el agente

- **NO hagas `git commit`/`git push` ni ejecutes `deploy-backend.sh` sin permiso explícito del usuario en ese momento.** Pregunta cada vez.
- **NO instales dependencias nuevas sin listarlas en tu reporte.** Las únicas previstas: `react-native-parsed-text` (C2), parser HTML en backend (C2), `react-native-webview` (C3). Las demás tareas no requieren deps nuevas (el outbox de B2 usa Keychain, ya instalado).
- **Haz cambios mínimos.** `LazosListScreen.tsx` es grande y frágil; ediciones quirúrgicas, siguiendo el estilo existente (2 espacios, prettier del repo).
- **Actualiza este archivo** marcando cada tarea completada (cambia el `-` por `x` en la lista original de arriba) y anota las migraciones aplicadas/pendientes.
- Si una referencia `archivo:línea` no coincide con lo que ves, confía en el código y busca el patrón descrito; el diagnóstico de causa raíz sigue siendo válido.
- Reporta al terminar cada fase: qué se hizo, qué se verificó, qué falta (especialmente pasos manuales pendientes del usuario: google-services.json, aplicar migraciones, deploy).
