# Setup de Lazos

Esta guía complementa el `README.md` con pasos de configuración necesarios para que el proyecto compile y se ejecute en local. Cubre los archivos sensibles que **no** están versionados (ver `.gitignore`).

## Configuración de Firebase

Lazos usa Firebase Cloud Messaging (FCM) para notificaciones push. Hacen falta **dos** archivos de credenciales que deben provisionarse manualmente. Ambos están en `.gitignore` y **no deben commitearse jamás**.

### 1. `android/app/google-services.json` (cliente Android)

Configura el SDK nativo de Firebase en la app.

**Cómo obtenerlo:**

1. Entra a [Firebase Console](https://console.firebase.google.com/) → selecciona el proyecto **Lazos**.
2. Engranaje (Project Settings) → pestaña **General**.
3. En la sección "Your apps", busca la app Android con package `com.lazos`. Si no existe, créala con ese package name exacto.
4. Pulsa **Download google-services.json**.
5. Copia el archivo a `android/app/google-services.json` (en la raíz del módulo `app/`, junto al `build.gradle` del app).

**Verificación:**
- `android/app/build.gradle` aplica `com.google.gms.google-services` al final. Sin el JSON, el build falla silenciosamente y FCM no entrega token válido en runtime.
- En cold-start, sin el archivo, `safeMessaging()` en `src/services/notificationService.ts` lo detecta y degrada a no-op para que la app no crashee.

### 2. `backend/firebase-service-account.json` (servidor)

Permite al backend enviar pushes vía Firebase Admin SDK.

**Cómo obtenerlo:**

1. En [Firebase Console](https://console.firebase.google.com/) → proyecto **Lazos**.
2. Engranaje (Project Settings) → pestaña **Service accounts**.
3. Pulsa **Generate new private key** → confirma → se descargará un JSON.
4. Renombra y mueve a `backend/firebase-service-account.json`.

Opcionalmente, puedes ubicarlo en otra ruta y exportar la variable de entorno:

```bash
export FIREBASE_SERVICE_ACCOUNT_PATH=/ruta/absoluta/al/json
```

**Verificación:**
- Sin el archivo, `backend/src/services/notificationService.ts` loguea `Firebase Admin no inicializado` y descarta cada envío sin tirar el proceso.
- Con el archivo, al arrancar el backend verás `[notifications] Firebase Admin inicializado` en stdout la primera vez que se intente enviar una push.

### Notas de seguridad

- **Nunca** subas estos archivos al repositorio. Ambos están listados en `.gitignore`.
- El service account otorga permisos de admin sobre el proyecto Firebase; trátalo como una contraseña.
- Para producción, considera montar el JSON como secreto en el orquestador (Docker secrets, env vars con el contenido JSON, etc.) en lugar de copiarlo al filesystem.
