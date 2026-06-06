import { existsSync, mkdirSync } from 'fs';

export function ensureUploadDirs() {
  const dirs = [
    './uploads/others',
    './uploads/signatures/principal',
    './uploads/signatures/staff',
    './uploads/documents/aadhar',
    './uploads/documents/tc',
    './uploads/documents/birth',
    './uploads/documents/staff',
    './uploads/fuel-logs',
    process.env.STUDENT_DOCS_PATH || 'D:/Student_Documents',
    process.env.STAFF_DOCS_PATH || 'D:/Staff_Documents',
  ];
  for (const dir of dirs) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}
