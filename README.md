# AI Hub

Multi-provider AI conversations and side-by-side model comparisons.
This export includes the latest animated public landing page and the navy-and-white signed-in workspace.

## Put this project on GitHub

1. Extract this ZIP.
2. Open the extracted `AI-Hub` folder.
3. Upload the **contents inside** that folder to your GitHub repository.
4. Include the dotfiles such as `.gitignore` and `.env.example`.
5. Never upload actual API keys, database credentials or `.env` files.

The ZIP is source code, not a database backup or a deployed website.
Downloading or uploading it does not publish your app or transfer your Replit secrets.

## Requirements and setup

- Node.js 20.19+ or 22.12+ and pnpm 10.
- A PostgreSQL database, Clerk authentication configuration, and provider keys for the services you enable.
- Run `pnpm install --frozen-lockfile` from this directory.
- Configure the variable names in `.env.example` using your environment or hosting secret manager.
  Simply copying that example does not automatically load variables into every service.
- Use a new empty database for a fresh setup. With its `DATABASE_URL` configured,
  `pnpm --filter @workspace/db run push` applies the included schema.
  Review changes before applying this to any existing database.

## Services

Run the services separately with their own environment and PORT:

- Web app: `PORT=3000 BASE_PATH=/ pnpm --filter @workspace/ai-hub run dev`
- API: `PORT=8080 pnpm --filter @workspace/api-server run dev`

An external host or local reverse proxy must route `/api` requests to the API service
and other application requests to the web app. Configure Clerk for your own domain.
The Replit artifact metadata is retained as a reference; it does not configure another host automatically.

## Checks

```sh
pnpm run typecheck
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/ai-hub run build
pnpm --filter @workspace/api-server run build
```

## Contents

- `artifacts/ai-hub/`: web application, animated landing page, workspace, static assets.
- `artifacts/api-server/`: Express API and provider integrations.
- `lib/`: shared API client, schema definitions and database code.
- `scripts/`: existing workspace scripts.
- Root package manifests, pnpm lockfile, TypeScript configuration and empty configuration checklist.

Dependencies, build output, local caches, personal chat data, credentials, Git history,
Signal Room and the design sandbox are deliberately excluded.
