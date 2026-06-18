# Security Audit — Tricount Deluxe

## Current Surface
- Static React/Vite frontend
- Public `VITE_*` build variables
- BugZero third-party widget script
- GitHub Actions deployment workflow
- Local `.env` file that must remain uncommitted

## Review Checklist
- No secrets committed or exposed through frontend variables
- No unsafe HTML rendering for participant names, notes, categories, or imported text
- Dependency updates reviewed for Vite/React security advisories
- Third-party scripts are intentional and configurable
- Future backend designs include auth, authorization, tenant isolation, input validation, and rate limiting

## Guidance
- Treat all browser-delivered config as public.
- Keep expense data privacy in mind before adding sharing or persistence.
- Add regression tests for security-sensitive parsing or rendering behavior.
