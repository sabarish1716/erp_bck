export enum Permission {
  // ─── ADMISSION ─────────────────────────────
  ADMISSION_CREATE = 'admission:create',
  ADMISSION_READ   = 'admission:read',
  ADMISSION_UPDATE = 'admission:update',
  ADMISSION_APPROVE = 'admission:approve',
  ADMISSION_DELETE = 'admission:delete',

  // ─── STUDENT ───────────────────────────────
  STUDENT_CREATE = 'student:create',
  STUDENT_READ   = 'student:read',
  STUDENT_UPDATE = 'student:update',
  STUDENT_DELETE = 'student:delete',

  // ─── FEES ──────────────────────────────────
  FEES_STRUCTURE_CREATE = 'fees:structure:create',
  FEES_STRUCTURE_READ   = 'fees:structure:read',
  FEES_STRUCTURE_UPDATE = 'fees:structure:update',
  FEES_STRUCTURE_DELETE = 'fees:structure:delete',
  FEES_ASSIGN           = 'fees:assign',
  FEES_COLLECT          = 'fees:collect',
  FEES_READ             = 'fees:read',
  FEES_DASHBOARD        = 'fees:dashboard',

  // ─── TRANSPORT ─────────────────────────────
  TRANSPORT_ROUTE_CREATE = 'transport:route:create',
  TRANSPORT_ROUTE_READ   = 'transport:route:read',
  TRANSPORT_ROUTE_UPDATE = 'transport:route:update',
  TRANSPORT_ROUTE_DELETE = 'transport:route:delete',
  TRANSPORT_ASSIGN       = 'transport:assign',
  TRANSPORT_READ         = 'transport:read',

  // ─── STAFF ─────────────────────────────────
  STAFF_CREATE = 'staff:create',
  STAFF_READ   = 'staff:read',
  STAFF_UPDATE = 'staff:update',
  STAFF_DELETE = 'staff:delete',

  // ─── USERS ─────────────────────────────────
  USER_CREATE = 'user:create',
  USER_READ   = 'user:read',
  USER_UPDATE = 'user:update',
  USER_DELETE = 'user:delete',

  // ─── LOCATION ──────────────────────────────
  LOCATION_CREATE = 'location:create',
  LOCATION_READ   = 'location:read',

  // ─── REPORTS ───────────────────────────────
  REPORTS_READ = 'reports:read',

  // ─── SETTINGS ──────────────────────────────
  SETTINGS_READ = 'settings:read',
  SETTINGS_UPDATE = 'settings:update',
}
