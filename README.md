# ML Knowledge Hub — Backend

Production-grade REST API for a personal AI/ML learning knowledge base.
Built with **NestJS 10**, **MongoDB (Mongoose)**, **Supabase Storage**, and a clean, layered, SOLID architecture.

## Modules

| Module      | Purpose                                                        |
| ----------- | -------------------------------------------------------------- |
| `resources` | Learning resources (GitHub / PDF / Docs / links) + document reader state |
| `todos`     | Personal learning todos (each linked to a resource)            |
| `notes`     | Company task notes (separate from personal learning)           |
| `uploads`   | File upload to Supabase Storage + short-lived preview URL generation |
| `search`    | Global instant search across resources / todos / notes        |
| `stats`     | Dashboard aggregations                                         |

## Tech highlights

- Layered architecture (Controller → Service → Schema/Repository)
- Global `ValidationPipe` (whitelist + transform + reject unknown fields), DTOs via `class-validator`
- Structured error handling (`AllExceptionsFilter`, `HttpExceptionFilter`)
- Unified response envelope (`ResponseInterceptor` + `SuccessResponse`)
- Winston-based structured logging + request `LoggingInterceptor`
- Rate limiting via `@nestjs/throttler`
- Swagger docs at `/docs`
- Text indexing on resources for content/title/tag search
- Reading-progress + bookmark persistence for the document reader
- Optional single-user API-key protection via `AUTH_API_KEY`; `/health` remains public
- Upload metadata is recorded in a short-lived server-owned manifest; resources
  never accept client-supplied file size, type, page count, or extracted text.
- Set `MONGO_SYNC_INDEXES=true` during an intentional production index rollout;
  it runs Mongoose `syncIndexes()` once at startup.

## Getting started

```bash
cp .env.example .env   # fill in MongoDB + Supabase values
npm install
npm run start:dev
```

API base: `http://localhost:5000/api/v1`
Swagger: `http://localhost:5000/docs`

> The backend boots even without Supabase configured. File-dependent endpoints
> return a clear error only when an upload is attempted.

## Environment

See `.env.example`. Required: `MONGODB_URI`. Supabase vars are required only
when uploading/serving files. Set `AUTH_API_KEY` for a private deployment; the
frontend can send the matching `NEXT_PUBLIC_API_KEY`.

## Folder structure

```
src/
  main.ts                 # bootstrap
  app.module.ts           # root wiring
  config/                 # typed env config + Joi validation
  core/                   # global filters/interceptors/guards providers
  common/                 # enums, utils, logger, decorators, filters, interceptors
  database/               # Mongoose connection module
  modules/
    resources/  todos/  notes/  uploads/  search/  stats/
```
