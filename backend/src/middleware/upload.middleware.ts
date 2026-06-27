import fs from 'node:fs';
import path from 'node:path';
import type { Request, Response } from 'express';
import multer from 'multer';
import { HttpError } from '../utils/http-error.js';

// Thư mục lưu file tải lên (tạo nếu chưa có)
export const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');
const HORSE_PDF_DIR = path.join(UPLOAD_ROOT, 'horses');
fs.mkdirSync(HORSE_PDF_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, HORSE_PDF_DIR),
  filename: (_req, _file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `horse-${unique}.pdf`);
  },
});

/** Chỉ nhận đúng 1 file PDF, tối đa 10MB, field name = "file". */
const uploadSingle = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      cb(new HttpError(400, 'Chỉ chấp nhận file PDF'));
      return;
    }
    cb(null, true);
  },
}).single('file');

/**
 * Chạy multer trong promise và chuẩn hóa lỗi về HttpError để errorHandler
 * trả về status/message đẹp (thay vì 500 chung chung).
 */
export function runHorsePdfUpload(req: Request, res: Response): Promise<void> {
  return new Promise((resolve, reject) => {
    uploadSingle(req, res, (err: unknown) => {
      if (!err) return resolve();
      if (err instanceof HttpError) return reject(err);
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') return reject(new HttpError(400, 'File vượt quá 10MB'));
        return reject(new HttpError(400, err.message));
      }
      reject(new HttpError(400, 'Tải file thất bại'));
    });
  });
}
