# Sprint 0 — Setup inicial

Archivos a copiar en tu proyecto React Native existente.

## Estructura

```
(raíz del proyecto)
├── .eslintrc.js          → reemplaza el existente
├── .prettierrc.js        → reemplaza el existente
├── .husky/
│   └── pre-commit        → nuevo
├── src/
│   ├── types/index.ts    → nuevo
│   ├── constants/index.ts→ nuevo
│   ├── components/
│   │   ├── common/
│   │   ├── plant/
│   │   └── chat/
│   ├── screens/
│   │   ├── auth/
│   │   ├── lazos/
│   │   ├── chat/
│   │   └── plant/
│   ├── navigation/
│   ├── services/
│   ├── hooks/
│   ├── store/
│   ├── utils/
│   └── assets/
└── backend/
    ├── package.json
    ├── tsconfig.json
    ├── .env.example
    ├── config/
    │   └── schema.sql
    └── src/
        ├── index.ts
        └── config/
            └── database.ts
```

## Pasos

### 1. Copiar archivos
Copia todo el contenido de este zip en la raíz de tu proyecto.

### 2. Instalar dependencias del frontend
```sh
npm install --save-dev husky lint-staged @typescript-eslint/eslint-plugin @typescript-eslint/parser
npx husky init
```

### 3. Agregar scripts al package.json principal
```json
"lint:fix": "eslint . --ext .ts,.tsx --fix",
"format": "prettier --write 'src/**/*.{ts,tsx}'",
"prepare": "husky"
```

### 4. Agregar lint-staged al package.json principal
```json
"lint-staged": {
  "src/**/*.{ts,tsx}": ["eslint --fix", "prettier --write"]
}
```

### 5. Base de datos
```sh
createdb lazos
psql lazos -f backend/config/schema.sql
```

### 6. Setup backend
```sh
cd backend
cp .env.example .env
# Editar .env: cambiar TU_USUARIO por tu usuario de postgres (ej: axeldc)
npm install
npm run dev   # Debe mostrar: 🚀 Backend corriendo en http://localhost:3000
```
