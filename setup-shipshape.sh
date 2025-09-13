#setup-shipshape.sh

#!/usr/bin/env bash
set -euo pipefail

# From the monorepo root
echo "→ Installing root deps"
npm i -D concurrently@^9 eslint@^9 typescript@^5.6

echo "→ Install API runtime deps"
npm i -w @shipshape/api express cors cookie-parser better-sqlite3 multer bcrypt

echo "→ Install API dev deps"
npm i -D -w @shipshape/api ts-node@^10.9.2 nodemon@^3 @types/node@latest typescript@^5.6

echo "→ Install Web runtime deps"
npm i -w @shipshape/web react react-dom

echo "→ Install Web dev deps"
npm i -D -w @shipshape/web vite @vitejs/plugin-react typescript @types/react @types/react-dom tailwindcss postcss autoprefixer eslint eslint-plugin-react-hooks eslint-plugin-react-refresh @typescript-eslint/parser @typescript-eslint/eslint-plugin globals

echo "→ Generate Tailwind if needed (safe to re-run)"
(
  cd apps/web
  npx tailwindcss init -p || true
)

echo "→ Done. Try: npm run dev"
