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
