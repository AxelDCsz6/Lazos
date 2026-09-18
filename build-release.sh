#!/usr/bin/env bash
# ─── Script de build release para Lazos ──────────────────────────────────────
# Uso: ./build-release.sh
# Genera el APK en: android/app/build/outputs/apk/release/app-release.apk

set -e

echo ""
echo "╔══════════════════════════════════════╗"
echo "║     Lazos — Build Release APK        ║"
echo "╚══════════════════════════════════════╝"
echo ""

# Pedir contraseñas de forma segura (no quedan en historial)
read -rsp "Contraseña del keystore (MYAPP_RELEASE_STORE_PASSWORD): " STORE_PASS
echo ""
read -rsp "Contraseña de la key    (MYAPP_RELEASE_KEY_PASSWORD):   " KEY_PASS
echo ""
echo ""

export MYAPP_RELEASE_STORE_PASSWORD="$STORE_PASS"
export MYAPP_RELEASE_KEY_PASSWORD="$KEY_PASS"

# Limpiar build anterior
echo "→ Limpiando build anterior..."
cd android
./gradlew clean --quiet

# Generar APK release
echo "→ Compilando APK release (puede tardar varios minutos)..."
./gradlew assembleRelease

APK_PATH="app/build/outputs/apk/release/app-release.apk"

if [ -f "$APK_PATH" ]; then
  SIZE=$(du -h "$APK_PATH" | cut -f1)
  echo ""
  echo "✓ APK generado exitosamente"
  echo "  Ruta:  android/$APK_PATH"
  echo "  Tamaño: $SIZE"
  echo ""
  echo "  Instalar directamente en el dispositivo conectado:"
  echo "  adb install android/$APK_PATH"
else
  echo "✗ Error: no se encontró el APK en $APK_PATH"
  exit 1
fi
