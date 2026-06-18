# Deploying — Tricount Deluxe

## Current Pipeline
- Workflow: `.github/workflows/deploy.yml`
- Trigger: push to `main` or manual `workflow_dispatch`
- Runtime: Node.js 22
- Build: `npm ci --include=dev` then `npm run build`
- Output: `dist`
- Default host: Azure Static Web Apps
- Optional host: Cloudflare Pages

## Required Variables
- `APP_DISPLAY_NAME`
- `APP_DOMAIN`
- `BUGZERO_APP_KEY`
- `BUGZERO_WIDGET_URL`
- `RUNNER_LABEL`

## Required Secrets
- Azure: `AZURE_STATIC_WEB_APPS_API_TOKEN`
- Cloudflare: `CLOUDFLARE_API_TOKEN` plus account/project variables

## Guidance
- Keep `.env` local and uncommitted.
- Do not register the self-hosted runner without a valid `GH_TOKEN`.
- Verify `npm run build` locally before deploy changes.
