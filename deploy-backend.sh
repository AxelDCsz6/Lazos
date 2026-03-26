#!/usr/bin/env bash
# ─── Deploy backend a producción ─────────────────────────────────────────────
# Uso: ./deploy-backend.sh
# Requiere: acceso SSH al servidor (configura SERVER y SSH_USER abajo)

set -e

SERVER="187.173.233.24"
SSH_USER="${1:-root}"   # pasar usuario como argumento o editar aquí

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   Lazos — Deploy Backend             ║"
echo "╚══════════════════════════════════════╝"
echo ""
echo "→ Subiendo cambios a Git..."
git push

echo "→ Conectando a $SSH_USER@$SERVER..."
ssh "$SSH_USER@$SERVER" bash << 'REMOTE'
  set -e
  cd "$(find /root /home -name 'docker-compose.yml' -path '*/Lazos/*' 2>/dev/null | head -1 | xargs dirname 2>/dev/null || echo '/opt/lazos')"
  echo "  Directorio: $(pwd)"
  echo "→ Actualizando código..."
  git pull
  echo "→ Reconstruyendo imagen Docker..."
  docker-compose build --no-cache
  echo "→ Reiniciando servicios..."
  docker-compose up -d
  echo "→ Estado de los contenedores:"
  docker-compose ps
REMOTE

echo ""
echo "✓ Deploy completado"
echo "  Health check: curl http://$SERVER:3000/health"
