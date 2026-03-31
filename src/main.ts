

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ensureUploadDirs } from './utils/ensure-upload-dirs';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  ensureUploadDirs();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors();
  app.setGlobalPrefix('erp/api');
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/erp/api/uploads/' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,        // remove extra fields
      forbidNonWhitelisted: true,
      transform: true,        // auto transform types
    }),
  );
await app.listen(3000, '0.0.0.0');
}
bootstrap();
