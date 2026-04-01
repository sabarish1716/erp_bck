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

  // ─── HR ────────────────────────────────────
  HR_DASHBOARD         = 'hr:dashboard',
  HR_ATTENDANCE_READ   = 'hr:attendance:read',
  HR_ATTENDANCE_MANAGE = 'hr:attendance:manage',
  HR_LEAVE_READ        = 'hr:leave:read',
  HR_LEAVE_MANAGE      = 'hr:leave:manage',
  HR_LEAVE_APPROVE     = 'hr:leave:approve',
  HR_PERMISSION_READ   = 'hr:permission:read',
  HR_PERMISSION_MANAGE = 'hr:permission:manage',
  HR_PERMISSION_APPROVE = 'hr:permission:approve',
  HR_STATUTORY_READ    = 'hr:statutory:read',
  HR_STATUTORY_MANAGE  = 'hr:statutory:manage',
  HR_ESSL_READ         = 'hr:essl:read',
  HR_ESSL_MANAGE       = 'hr:essl:manage',
  HR_PAYROLL_READ      = 'hr:payroll:read',
  HR_PAYROLL_MANAGE    = 'hr:payroll:manage',
  HR_PAYROLL_APPROVE   = 'hr:payroll:approve',



  //POS permissions
  POS_READ = 'pos:read',
  POS_MANAGE = 'pos:manage',
  POS_DASHBOARD = 'pos:dashboard',
  POS_PURCHASE_CREATE = 'pos:purchase:create',
  POS_PURCHASE_READ = 'pos:purchase:read',
  POS_PURCHASE_UPDATE = 'pos:purchase:update',
  POS_PURCHASE_DELETE = 'pos:purchase:delete',
  POS_PURCHASE = 'pos:purchase',
  POS_SALE_CREATE = 'pos:sale:create',
  POS_SALE_READ = 'pos:sale:read',
  POS_SELL = 'pos:sell',

  // ─── DOCUMENT ISSUE ────────────────────────
  DOC_REQUEST_CREATE  = 'doc:request:create',
  DOC_REQUEST_READ    = 'doc:request:read',
  DOC_REQUEST_REVIEW  = 'doc:request:review',
  DOC_REQUEST_ISSUE   = 'doc:request:issue',
  DOC_REQUEST_DELETE  = 'doc:request:delete',
}
