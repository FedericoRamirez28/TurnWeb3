import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import 'dotenv/config';
import cookieParser from 'cookie-parser';
import type { INestApplication } from '@nestjs/common';
import type { Application as ExpressApp } from 'express';

type CorsCallback = (err: Error | null, allow?: boolean) => void;

function setTrustProxy(app: INestApplication) {
  const instance = app.getHttpAdapter().getInstance() as ExpressApp & {
    set: (setting: string, val: unknown) => unknown;
  };
  instance.set('trust proxy', 1);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  setTrustProxy(app);
  app.use(cookieParser());

  const isProd = process.env.NODE_ENV === 'production';

  const allowedOrigins = (process.env.WEB_ORIGIN ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  // ✅ Vite puede cambiar de puerto: 5173 / 5174
  const devDefaultOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
  ];

  const allowlist = isProd
    ? allowedOrigins
    : Array.from(new Set([...allowedOrigins, ...devDefaultOrigins]));

  app.enableCors({
    origin: (origin: string | undefined, callback: CorsCallback): void => {
      if (!origin) return callback(null, true);
      if (allowlist.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id'],
  });

  const PORT = Number(process.env.PORT || 4000);
  await app.listen(PORT);

  console.log(`🚀 Backend running on http://localhost:${PORT}`);
  console.log(`✅ CORS allowlist (${isProd ? 'PROD' : 'DEV'}):`, allowlist);
}

void bootstrap();
