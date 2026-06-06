import { diskStorage } from 'multer';
import { extname } from 'path';

export const multerConfig = {
  storage: diskStorage({
    destination: (req, file, cb) => {
      const folder = process.env.STUDENT_DOCS_PATH || 'D:/Student_Documents';
      cb(null, folder);
    },

    filename: (req, file, cb) => {
      const uniqueName =
        Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, uniqueName + extname(file.originalname));
    },
  }),

  fileFilter: (req, file, cb) => {
    if (!file.mimetype.match(/\/(jpg|jpeg|png|pdf)$/)) {
      return cb(new Error('Only images & PDFs allowed'), false);
    }
    cb(null, true);
  },

  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
};