import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json } from 'express';
import { AppModule } from './app.module';
import { AppConfig } from './config/configuration';
import { AppLogger } from './common/logger/logger.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: false,
    rawBody: true,
  });

  // ----- Request body size limit -----
  // The default Express JSON body parser caps payloads at 100kb. The resource
  // create endpoint receives the document's full `extractedText` (capped at
  // ~1MB in SupabaseStorageService) in the JSON body, so any sizeable PDF
  // (>100kb of extracted text) blew past the limit and Express threw a
  // `PayloadTooLargeError`. That error is NOT an `HttpException`, so it slipped
  // past HttpExceptionFilter and was reported as a generic HTTP 500 — even
  // though the file had already uploaded to Supabase. Raising the limit fixes
  // the 500 while keeping `rawBody` available for future webhook verification.
  // This middleware is registered before listen(), so it runs ahead of the
  // framework's default JSON parser and consumes the body at the higher limit.
  app.use(
    json({
      limit: '10mb',
      verify: (req, _res, buf) => {
        (req as unknown as { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );

  const config = app.get(ConfigService);
  const appConfig = config.get<AppConfig>('app');
  if (!appConfig) {
    throw new Error('App configuration is missing.');
  }
  const logger = new AppLogger();

  // ----- Global API prefix (health + docs kept at root for uptime/tooling) -----
  // Nest's prefix-exclude only matches exact controller roots (it can't exclude
  // sub-paths), so `/health` is the single unprefixed probe root; the HTML
  // dashboard is served from the same route via the Accept header.
  app.setGlobalPrefix(appConfig.apiPrefix, {
    exclude: ['health', 'docs', 'docs-json'],
  });

  // ----- CORS (Next.js frontend: localhost + Vercel preview domains) -----
  const origins = appConfig.corsOrigin
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Skip-Log'],
  });

  // ----- Global validation (whitelist + transform) -----
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      forbidNonWhitelisted: false,
    }),
  );

  // ----- Swagger API docs -----
  const swagger = new DocumentBuilder()
    .setTitle('ML Knowledge Hub API')
    .setDescription(
      'Production-grade REST API for a personal AI/ML learning knowledge base.',
    )
    .setVersion('1.0')
    .setContact('syamm', '', '')
    .build();
  const document = SwaggerModule.createDocument(app, swagger);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(appConfig.port, '0.0.0.0');
  logger.log(
    `🚀 API ready on http://localhost:${appConfig.port}/${appConfig.apiPrefix}`,
  );
  logger.log(`📚 Swagger docs on http://localhost:${appConfig.port}/docs`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal bootstrap error', err);
  process.exit(1);
});
