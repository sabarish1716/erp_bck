# Frontend Integration Notes

Base API prefix: `/erp/api`

## Admission dashboard

Endpoint:

```http
GET /erp/api/admission/dashboard/summary?academicYear=2026-2027
```

Use these fields for the admin dashboard:

```json
{
  "academicYear": "2026-2027",
  "total": 120,
  "approved": 98,
  "pending": 22,
  "yearComparison": {
    "currentAcademicYear": "2026-2027",
    "previousAcademicYear": "2025-2026",
    "currentTotal": 120,
    "previousTotal": 100,
    "difference": 20,
    "percentageChange": 20,
    "trend": "up"
  },
  "admissionProgress": {
    "basis": "approved_vs_total_seats",
    "totalTarget": 150,
    "currentCount": 98,
    "progressPercent": 65.33
  },
  "milestones": [
    {
      "label": "25% admissions milestone",
      "threshold": 25,
      "targetCount": 38,
      "currentCount": 98,
      "remainingCount": 0,
      "achieved": true
    }
  ],
  "upcomingMilestones": []
}
```

UI mapping:

- Show year-over-year percentage from `yearComparison.percentageChange`.
- Use `yearComparison.trend` for up or down indicator.
- Use `milestones` for the milestone list.
- Use `upcomingMilestones` for the upcoming milestone cards.
- `admissionProgress.progressPercent` is ready for a progress ring or progress bar.

## Supabase Sync Admin

Admin monitoring endpoints for the queued Supabase worker:

```http
GET /erp/api/supabase-sync/dashboard?limit=10
GET /erp/api/supabase-sync/jobs?status=FAILED&type=LOCATION&limit=50&cursor=<jobId>
```

`dashboard` returns queue depth, counts by status and job type, whether the Supabase client is configured, the oldest pending job, and recent failures.

`jobs` returns a cursor-paged list of sync jobs with payload, attempts, last error, and timestamps. Both endpoints require `settings:read`.

Succeeded sync jobs are automatically purged by a cron cleanup task. Retention defaults to 7 days and can be overridden with `SUPABASE_SYNC_SUCCESS_RETENTION_DAYS`.

## Promotion

Endpoint:

```http
POST /erp/api/admission/promote
Content-Type: application/json
```

Payload:

```json
{
  "fromStandard": "9",
  "toStandard": "10",
  "academicYear": "2025-2026",
  "newAcademicYear": "2026-2027"
}
```

Notes:

- `newAcademicYear` is optional.
- If `newAcademicYear` is omitted, the backend moves to the next academic year automatically.
- Response now includes both `academicYear` and `newAcademicYear`.

## Transport academic year selector

Endpoint:

```http
GET /erp/api/transport/academic-years
```

Response:

```json
["2026-2027", "2025-2026"]
```

Use this API for the transport view page academic year dropdown.

## Transport pending students for mapping

Endpoint:

```http
GET /erp/api/transport/students/pending?academicYear=2026-2027
```

Response:

```json
{
  "academicYear": "2026-2027",
  "total": 2,
  "students": [
    {
      "id": "student-id",
      "name": "Student Name",
      "standard": "STD_10",
      "standardLabel": "10th Standard",
      "transportMode": "VAN",
      "admissionNo": "PSF/2026-2027/0001",
      "admissionDate": "2026-04-12T00:00:00.000Z",
      "currentTransportAssignment": null
    }
  ]
}
```

UI mapping:

- Show this list in the transport module for new students who need transport mapping.
- Use `standardLabel` instead of `standard` on the assign transport page and pending student list.
- Students with `transportMode` like `LOCAL`, `SELF`, or `WALKING` are excluded.

## Transport assignment list

Endpoint:

```http
GET /erp/api/transport/assignments?academicYear=2026-2027
```

Notes:

- `academicYear` is optional. If omitted, the backend uses the configured academic year from admin settings.
- Each item returns `student.standardLabel` for UI display.

## Assign transport

Endpoint:

```http
POST /erp/api/transport/assign
Content-Type: application/json
```

Payload:

```json
{
  "studentId": "student-id",
  "routeId": "route-id",
  "stopId": "stop-id",
  "academicYear": "2026-2027",
  "isSplClass": false
}
```

Success response includes:

- `message`
- `student.standardLabel`
- route and stop data

Duplicate handling:

- Exact duplicate assignment returns HTTP `409` with message `Transport is already assigned to this student for the selected academic year`.
- Same student with changed route or stop updates the existing mapping instead of creating a duplicate row.

## Route create and update with multiple stops

Endpoints:

```http
POST /erp/api/transport/routes
PUT /erp/api/transport/routes/:id
```

Payload shape:

```json
{
  "routeName": "North Route",
  "routeNo": "R-01",
  "baseFee": 1200,
  "splClassFee": 300,
  "description": "Morning route",
  "stops": [
    {
      "id": "optional-existing-id",
      "stopName": "Main Road",
      "stopOrder": 1,
      "distanceKm": 2.5,
      "pickupTime": "08:10",
      "dropTime": "16:20",
      "fee": 100
    },
    {
      "stopName": "Market",
      "stopOrder": 2,
      "distanceKm": 4,
      "pickupTime": "08:20",
      "dropTime": "16:30",
      "fee": 150
    }
  ]
}
```

Notes:

- Multiple stops are supported.
- Frontend may keep sending `id` for existing stops; backend accepts it and ignores it for persistence.
- Avoid sending blank `stopName` or duplicate `stopOrder` values.
- Duplicate route numbers return HTTP `409` with a readable message.

## Staff employee ID

Preview next ID:

```http
GET /erp/api/staff/next-employee-id
```

Response:

```json
{
  "employeeId": "EMP0007"
}
```

Create staff:

```http
POST /erp/api/staff
Content-Type: application/json
```

Payload:

```json
{
  "name": "Staff Name",
  "email": "staff@example.com",
  "designation": "Teacher",
  "password": "secret123",
  "category": "NON_TEACHING_ACTING_DRIVER",
  "perDaySalary": 850
}
```

Notes:

- `perDaySalary` is optional for regular staff.
- For acting drivers, use `category = NON_TEACHING_ACTING_DRIVER` and send `perDaySalary`.
- Staff responses now include top-level `perDaySalary` and `staffStatutory.dailyRate`.

## Acting driver per-day salary flow

Use these APIs for an acting driver salary setup/edit screen.

List acting drivers with configured rates:

```http
GET /erp/api/transport-expense/acting-drivers/daily-rate
```

Response shape:

```json
[
  {
    "staffId": "staff-uuid",
    "employeeId": "EMP0042",
    "name": "Acting Driver 1",
    "designation": "Acting Driver",
    "category": "NON_TEACHING_ACTING_DRIVER",
    "perDaySalary": 850,
    "fallbackPerDaySalary": 769.23
  }
]
```

Update per-day salary:

```http
PUT /erp/api/transport-expense/acting-drivers/:staffId/daily-rate
Content-Type: application/json
```

```json
{
  "dailyRate": 900
}
```

## Fees collect payment manual discount

Endpoint:

```http
POST /erp/api/fees/collect
Content-Type: application/json
```

Payload (single payment):

```json
{
  "studentFeeId": "student-fee-id",
  "amount": 12000,
  "manualDiscount": 500,
  "paymentMode": "CASH",
  "paymentDate": "2026-05-02",
  "receiptComponents": ["transportFee", "manualDiscount"],
  "remarks": "Collected with concession"
}
```

UI behavior:

- Add a numeric input field named Manual Discount in the collect payment form.
- Treat Amount as gross settlement value (before discount).
- Net cash paid is computed as Amount - Manual Discount.
- Manual Discount cannot be greater than Amount.
- For split-term mode, the term split amounts must sum to the net cash paid value.
- Receipt Components to Include can include manualDiscount.

Backend behavior:

- Pending validation uses gross Amount.
- Payment rows store net paid amount in amount and store concession in manualDiscount.
- Paid history and pending calculations use amount + manualDiscount as effective settlement.

Frontend screen checklist:

- Screen name suggestion: `Acting Driver Salary Setup`.
- Columns: `employeeId`, `name`, `designation`, `perDaySalary`, `fallbackPerDaySalary`.
- On page load call `GET /erp/api/transport-expense/acting-drivers/daily-rate`.
- For each row, use an editable number input bound to `perDaySalary`.
- If `perDaySalary` is `null`, prefill input with `fallbackPerDaySalary`.
- On Save button click for a row, call `PUT /erp/api/transport-expense/acting-drivers/:staffId/daily-rate` with `{ "dailyRate": <inputValue> }`.
- Show success toast and refresh only that row (or re-fetch list).
- Validation: block empty, zero, negative, and non-numeric values.

Minimal frontend API helpers (TypeScript):

```ts
export type ActingDriverRateRow = {
  staffId: string;
  employeeId: string;
  name: string;
  designation: string;
  category: 'NON_TEACHING_ACTING_DRIVER';
  perDaySalary: number | null;
  fallbackPerDaySalary: number;
};

export async function fetchActingDriverRates(baseUrl: string, token: string) {
  const res = await fetch(`${baseUrl}/erp/api/transport-expense/acting-drivers/daily-rate`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to load acting driver rates');
  return (await res.json()) as ActingDriverRateRow[];
}

export async function updateActingDriverRate(
  baseUrl: string,
  token: string,
  staffId: string,
  dailyRate: number,
) {
  const res = await fetch(`${baseUrl}/erp/api/transport-expense/acting-drivers/${staffId}/daily-rate`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ dailyRate }),
  });
  if (!res.ok) throw new Error('Failed to update per-day salary');
  return res.json();
}
```

## Transport manager frontend scope

This repository only contains the backend. Frontend menu and route guard code must be implemented in the frontend app.

Use `GET /erp/api/auth/me` and the returned `role` plus `permissions` to restrict the UI for `TRANSPORT_MANAGER`.

Expected frontend behavior for `TRANSPORT_MANAGER`:

- Show only `Dashboard` and `Transport` in the main menu.
- Hide Admission, Fees, Staff, HR, POS, Settings, House, and other module menus.
- Allow routes only when the user has `transport:dashboard`, `transport:read`, `transport:assign`, `transport:route:create`, `transport:route:update`, `transport:route:delete`, or `location:read` as needed.
- Redirect any blocked route to the transport dashboard.

Recommended route mapping:

- `Dashboard` -> `GET /erp/api/transport/dashboard`
- `Transport` -> transport routes, buses, drivers, assignments, fuel, mileage

## Transport managers list

Endpoint:

```http
GET /erp/api/staff/transport-managers
```

Response shape:

```json
[
  {
    "id": "staff-id",
    "employeeId": "EMP0010",
    "name": "Transport Lead",
    "email": "transport.manager@example.com",
    "designation": "Transport Manager",
    "isActive": true,
    "user": {
      "id": 12,
      "email": "transport.manager@example.com",
      "role": "TRANSPORT_MANAGER",
      "isActive": true
    }
  }
]
```

## Individual bus fuel report

Endpoint:

```http
GET /erp/api/transport/buses/:id/fuel-report?from=2026-04-01&to=2026-04-10
```

Notes:

- `from` and `to` are optional.
- If omitted, the backend defaults to the current day.
- Response includes bus details, summary totals, and detailed fuel logs for that bus only.

Export endpoints:

```http
GET /erp/api/transport/buses/:id/fuel-report/export/excel?from=2026-04-01&to=2026-04-10
GET /erp/api/transport/buses/:id/fuel-report/export/pdf?from=2026-04-01&to=2026-04-10
```

Notes:

- Both endpoints return downloadable files.
- Excel export returns `.xlsx`.
- PDF export returns `.pdf`.
- Frontend should call these URLs directly for download or open them in a new tab.

## Individual bus mileage report

Endpoint:

```http
GET /erp/api/transport/buses/:id/mileage-report?from=2026-04-01&to=2026-04-10
```

Notes:

- `from` and `to` are optional.
- If omitted, the backend defaults to the current day.
- Response includes bus details, total distance, odometer start and end values, daily breakdown, and mileage snapshots for that bus only.

Export endpoints:

```http
GET /erp/api/transport/buses/:id/mileage-report/export/excel?from=2026-04-01&to=2026-04-10
GET /erp/api/transport/buses/:id/mileage-report/export/pdf?from=2026-04-01&to=2026-04-10
```

Notes:

- Both endpoints return downloadable files.
- Excel export returns `.xlsx`.
- PDF export returns `.pdf`.
- Frontend should call these URLs directly for download or open them in a new tab.

Notes:

- `employeeId` is now optional on create.
- If omitted, the backend auto-generates the next `EMP000x` value.
- Duplicate email or employee ID errors return HTTP `409` with a readable message.
