# Frontend Testing — Tricount Deluxe

## Current Baseline
- `npm run build` is the only configured verification command.
- No Vitest, React Testing Library, or Playwright setup exists yet.

## Recommended Test Coverage
- Unit tests for money and settlement calculations
- Component tests for participant and expense forms
- Browser smoke tests for create group, add expense, view balances, and settlement copy/export
- Responsive checks for mobile expense entry

## Guidance
- Add Vitest before building non-trivial calculation logic.
- Add Playwright when the app has a real multi-step user flow.
- Keep tests deterministic around currency rounding.
