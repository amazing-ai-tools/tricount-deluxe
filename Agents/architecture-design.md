# Architecture Design — Tricount Deluxe

Design for a static-first bill-splitting product.

## Current Architecture
- Single-page React app served by Vite
- No backend, database, auth, or API layer
- GitHub Actions builds static assets into `dist`

## Domain Boundaries
- Participants: people in a group
- Expenses: amount, payer, date, category, notes
- Splits: equal, shares, exact amounts, or percentages
- Balances: derived totals per participant
- Settlements: simplified transfers that resolve balances

## Guidance
- Keep money calculations pure, deterministic, and independent from React.
- Introduce persistence only when user flows require saved groups or collaboration.
- If a backend is added, define API contracts and tenant/group isolation before implementation.
