import { existsSync, mkdirSync } from 'fs';

export function ensureUploadDirs() {
  const dirs = [
    './uploads/others',
    './uploads/signatures/principal',
    './uploads/signatures/staff',
    './uploads/documents/aadhar',
    './uploads/documents/tc',
    './uploads/documents/birth',
  ];
  for (const dir of dirs) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}
