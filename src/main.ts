import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ensureUploadDirs } from './utils/ensure-upload-dirs';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';

async function bootstrap() {
  ensureUploadDirs();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Allow larger base64 payloads for admin document assets (seal/signature uploads).
  app.use(json({ limit: '15mb' }));
  app.use(urlencoded({ extended: true, limit: '15mb' }));
  app.enableCors();
  app.setGlobalPrefix('erp/api');
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/erp/api/uploads/',
  });
  app.useStaticAssets(process.env.STUDENT_DOCS_PATH || 'D:/Student_Documents', {
    prefix: '/erp/api/student_documents/',
  });
  app.useStaticAssets(process.env.STAFF_DOCS_PATH || 'D:/Staff_Documents', {
    prefix: '/erp/api/staff_documents/',
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // remove extra fields
      forbidNonWhitelisted: true,
      transform: true, // auto transform types
    }),
  );
  await app.listen(3000, '0.0.0.0');
}
bootstrap();
