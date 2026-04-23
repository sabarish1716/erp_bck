import { Role } from './role.enum';
import { Permission } from './permission.enum';

/**
 * Maps each role to the set of permissions it has.
 *
 * ADMIN        – full access to everything
 * PRINCIPAL    – read everything + approve admissions/fee actions; no user management
 * STAFF        – manage admissions, read fees/reports; cannot create fee structures or delete
 * TRANSPORT_MANAGER – transport-only access, including transport dashboard
 * STUDENT      – read-only access to their own data (admission, fees, transport)
 */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.ADMIN]: Object.values(Permission) as Permission[],

  [Role.PRINCIPAL]: [
    // Admission
    Permission.ADMISSION_CREATE,
    Permission.ADMISSION_READ,
    Permission.ADMISSION_UPDATE,
    Permission.ADMISSION_APPROVE,
    Permission.ADMISSION_DELETE,
    // Student
    Permission.STUDENT_READ,
    Permission.STUDENT_CREATE,
    Permission.STUDENT_UPDATE,
    // Fees — read + collect; no structure create/delete
    Permission.FEES_STRUCTURE_READ,
    Permission.FEES_ASSIGN,
    Permission.FEES_COLLECT,
    Permission.FEES_READ,
    Permission.FEES_DASHBOARD,
    // Transport
    Permission.TRANSPORT_DASHBOARD,
    Permission.TRANSPORT_ROUTE_READ,
    Permission.TRANSPORT_ASSIGN,
    Permission.TRANSPORT_READ,
    // Staff
    Permission.STAFF_READ,
    Permission.STAFF_CREATE,
    Permission.STAFF_UPDATE,
    // HR
    Permission.HR_DASHBOARD,
    Permission.HR_ATTENDANCE_READ,
    Permission.HR_ATTENDANCE_MANAGE,
    Permission.HR_LEAVE_READ,
    Permission.HR_LEAVE_MANAGE,
    Permission.HR_LEAVE_APPROVE,
    Permission.HR_PERMISSION_READ,
    Permission.HR_PERMISSION_MANAGE,
    Permission.HR_PERMISSION_APPROVE,
    Permission.HR_STATUTORY_READ,
    Permission.HR_STATUTORY_MANAGE,
    Permission.HR_ESSL_READ,
    Permission.HR_ESSL_MANAGE,
    Permission.HR_PAYROLL_READ,
    Permission.HR_PAYROLL_MANAGE,
    Permission.HR_PAYROLL_APPROVE,
    // Reports
    Permission.REPORTS_READ,
    // Location
    Permission.LOCATION_READ,
    // POS
    Permission.POS_READ,
    Permission.POS_MANAGE,
    Permission.POS_DASHBOARD,
    Permission.POS_PURCHASE,
    Permission.POS_SELL,
    // Document Issue
    Permission.DOC_REQUEST_CREATE,
    Permission.DOC_REQUEST_READ,
    Permission.DOC_REQUEST_REVIEW,
    Permission.DOC_REQUEST_ISSUE,
    // House
    Permission.HOUSE_READ,
    Permission.HOUSE_UPDATE,
    // Exam
    Permission.EXAM_CREATE,
    Permission.EXAM_READ,
    Permission.EXAM_SUBJECT_MANAGE,
    Permission.EXAM_HALL_MANAGE,
    Permission.EXAM_TIMETABLE_MANAGE,
    Permission.EXAM_ROLL_GENERATE,
    Permission.EXAM_SEAT_ALLOCATE,
  ],

  [Role.STAFF]: [
    // Student — read only
    Permission.STUDENT_READ,
    // HR — own attendance, leave, permission, payslip
    Permission.HR_DASHBOARD,
    Permission.HR_ATTENDANCE_READ,
    Permission.HR_LEAVE_READ,
    Permission.HR_LEAVE_MANAGE,
    Permission.HR_PERMISSION_READ,
    Permission.HR_PERMISSION_MANAGE,
    Permission.HR_PAYROLL_READ,
    // Document Issue — create & view own requests
    Permission.DOC_REQUEST_CREATE,
    Permission.DOC_REQUEST_READ,
    // House — read only
    Permission.HOUSE_READ,
    // Exam — read only
    Permission.EXAM_READ,
  ],

  [Role.TEACHER]: [
    // Student — read only
    Permission.STUDENT_READ,
    // HR — own attendance, leave, permission, payslip
    Permission.HR_DASHBOARD,
    Permission.HR_ATTENDANCE_READ,
    Permission.HR_LEAVE_READ,
    Permission.HR_LEAVE_MANAGE,
    Permission.HR_PERMISSION_READ,
    Permission.HR_PERMISSION_MANAGE,
    Permission.HR_PAYROLL_READ,
    // Document Issue — create & view own requests
    Permission.DOC_REQUEST_CREATE,
    Permission.DOC_REQUEST_READ,
    // House — read only
    Permission.HOUSE_READ,
    // Exam — read only
    Permission.EXAM_READ,
  ],

  [Role.TRANSPORT_MANAGER]: [
    Permission.TRANSPORT_DASHBOARD,
    Permission.TRANSPORT_ROUTE_CREATE,
    Permission.TRANSPORT_ROUTE_READ,
    Permission.TRANSPORT_ROUTE_UPDATE,
    Permission.TRANSPORT_ROUTE_DELETE,
    Permission.TRANSPORT_ASSIGN,
    Permission.TRANSPORT_READ,
    Permission.LOCATION_READ,
    Permission.ADMISSION_READ,
    // POS-INCOME-EXPENCE
    Permission.POS_DASHBOARD,
    Permission.POS_PURCHASE_READ,
    Permission.POS_SALE_READ,
    Permission.POS_SELL,
    Permission.POS_MANAGE,
    Permission.POS_READ,
    // Exam
    Permission.EXAM_CREATE,
    Permission.EXAM_READ,
    Permission.EXAM_SUBJECT_MANAGE,
    Permission.EXAM_HALL_MANAGE,
    Permission.EXAM_TIMETABLE_MANAGE,
    Permission.EXAM_ROLL_GENERATE,
    Permission.EXAM_SEAT_ALLOCATE,
  
  ],

  [Role.STUDENT]: [
    // Only view their own data — controllers enforce student-level filtering
    Permission.ADMISSION_READ,
    Permission.STUDENT_READ,
    Permission.FEES_READ,
    Permission.TRANSPORT_READ,
    Permission.LOCATION_READ,
    // Document Issue — view own requests
    Permission.DOC_REQUEST_READ,
    // House
    Permission.HOUSE_READ,
    // Exam
    Permission.EXAM_READ,
  ],
};

export const DEFAULT_ROLE_PERMISSIONS: Record<Role, Permission[]> = ROLE_PERMISSIONS;
