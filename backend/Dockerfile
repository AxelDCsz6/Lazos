# Stage 1: build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: producción
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
# Firebase Admin requiere el service account en runtime (notificationService.ts).
# Debe existir en el contexto de build (backend/) ANTES de hacer docker-compose build.
COPY firebase-service-account.json ./
EXPOSE 3000
CMD ["node", "dist/index.js"]
