# Backend Testing — Tricount Deluxe

There is no backend in this repository yet.

## Current Responsibility
- Test pure domain logic for expense splitting and settlements once it exists.
- Treat those tests as the future backend contract.

## Future Backend Test Areas
- Auth and group membership isolation
- Expense CRUD validation
- Split calculation invariants
- Settlement generation
- Export endpoints
- Rate limits and abuse prevention

## Guidance
- Do not invent API tests before an API exists.
- When backend work starts, add integration tests alongside the API framework chosen for the project.
