# BugZero Static Frontend Template

Minimal Vite + React frontend used by BugZero's simplified app provisioning flow.

The generated app ships with:

- Azure Static Web Apps deployment workflow.
- BugZero widget injected from GitHub Actions variables.
- A small first screen that can be replaced by the app's Amazing Chat agent.

Required repository variables:

- `APP_DISPLAY_NAME`
- `APP_DOMAIN`
- `BUGZERO_APP_KEY`
- `BUGZERO_WIDGET_URL`
- `RUNNER_LABEL`

Required repository secret:

- `AZURE_STATIC_WEB_APPS_API_TOKEN`
