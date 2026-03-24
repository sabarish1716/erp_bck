

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
  app.useStaticAssets(join(__dirname, '..', 'uploads'), { prefix: '/uploads/' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,        // remove extra fields
      forbidNonWhitelisted: true,
      transform: true,        // auto transform types
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
