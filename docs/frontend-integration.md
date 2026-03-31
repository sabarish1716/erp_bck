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
  "password": "secret123"
}
```

Notes:

- `employeeId` is now optional on create.
- If omitted, the backend auto-generates the next `EMP000x` value.
- Duplicate email or employee ID errors return HTTP `409` with a readable message.