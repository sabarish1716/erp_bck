# HR Dashboard Frontend (Next.js)

This is a production-ready frontend module for the ERP HR dashboard.

## Features

- Componentized Next.js app-router setup.
- Full HR endpoint action coverage from backend `src/hr/hr.controller.ts`.
- Filters and path params surfaced for each endpoint card.
- DTO body templates included for write operations.
- Runtime base URL and bearer token.
- KPI strip wired to dashboard and payroll endpoints.

## Run

1. Install dependencies:

```bash
npm install
```

2. Start dev server:

```bash
npm run dev
```

3. Open:

```text
http://localhost:3000/hr
```

## Backend integration defaults

- Default API base URL: `/erp/api`
- If backend runs on another host, set full base URL in header input.

## Key files

- `app/hr/page.tsx`: route page and screen orchestration.
- `components/ActionCard.tsx`: request card with params/query/body editors.
- `components/KpiCards.tsx`: KPI summary cards.
- `components/Sidebar.tsx`: HR module navigation.
- `lib/endpoints.ts`: complete endpoint catalog.
- `lib/hr-api.ts`: typed API client utilities.
