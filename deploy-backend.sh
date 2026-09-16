#!/usr/bin/env bash
# ─── Deploy backend a producción (ejecutar EN el servidor) ────────────────────
# Uso: ./deploy-backend.sh

set -e

cd "$(dirname "$0")/backend"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   Lazos — Deploy Backend             ║"
echo "╚══════════════════════════════════════╝"
echo ""
echo "  Directorio: $(pwd)"
echo "→ Reconstruyendo imagen Docker..."
docker-compose build --no-cache
echo "→ Reiniciando servicios..."
docker-compose up -d
echo "→ Estado de los contenedores:"
docker-compose ps

echo ""
echo "✓ Deploy completado"
echo "  Health check: curl http://localhost:3000/health"
