import { Controller, Get, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { HealthService, SystemStatus } from './health.service';

// Liveness / readiness + connectivity probe, served from the unprefixed
// /health root. Browser (Accept: text/html) gets the dashboard; API clients
// get JSON. Uses @Res({ passthrough: false }) to bypass the JSON envelope.
@Public()
@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  status(@Req() req: Request, @Res({ passthrough: false }) res: Response): void {
    const status = this.health.getStatus();
    const accept = (req.headers.accept ?? '').toLowerCase();
    if (accept.includes('text/html')) {
      res.type('html').send(this.render(status));
      return;
    }
    res.json(status);
  }

  private dotClass(ok: boolean, configured: boolean): string {
    return !configured ? 'warn' : ok ? 'ok' : 'bad';
  }

  private textClass(ok: boolean, configured: boolean): string {
    return ok ? 'ok' : configured ? 'bad' : 'warn';
  }

  private textLabel(ok: boolean, configured: boolean): string {
    return ok ? 'Connected' : configured ? 'Error' : 'Not configured';
  }

  private render(s: SystemStatus): string {
    const mongoDot = this.dotClass(s.mongodb.ok, s.mongodb.configured);
    const mongoTxt = this.textClass(s.mongodb.ok, s.mongodb.configured);
    const mongoLbl = this.textLabel(s.mongodb.ok, s.mongodb.configured);
    const supaDot = this.dotClass(s.supabase.ok, s.supabase.configured);
    const supaTxt = this.textClass(s.supabase.ok, s.supabase.configured);
    const supaLbl = this.textLabel(s.supabase.ok, s.supabase.configured);
    const overallClass = s.status === 'operational' ? 'ok' : 'bad';
    const overallDot = s.status === 'offline' ? 'bad' : overallClass;

    const mongoCard = `
      <div class="card">
        <div>
          <div class="name">MongoDB</div>
          <div class="msg">${this.esc(s.mongodb.message)}</div>
        </div>
        <div class="right">
          <span class="status-text ${mongoTxt}">${mongoLbl}</span>
          <span class="dot ${mongoDot}"></span>
        </div>
      </div>`;

    const supaCard = `
      <div class="card">
        <div>
          <div class="name">Supabase Storage</div>
          <div class="msg">${this.esc(s.supabase.message)}</div>
        </div>
        <div class="right">
          <span class="status-text ${supaTxt}">${supaLbl}</span>
          <span class="dot ${supaDot}"></span>
        </div>
      </div>`;

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>ML Knowledge Hub — System Status</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; background:#131313; color:#fff; font-family:'Helvetica Neue',Arial,sans-serif;
         -webkit-font-smoothing:antialiased; padding:48px 20px; }
  .wrap { max-width:620px; margin:0 auto; }
  .kicker { font-family:'Courier New',monospace; text-transform:uppercase; letter-spacing:1.5px; font-size:11px; color:#949494; }
  h1 { font-size:34px; font-weight:800; margin:6px 0 4px; letter-spacing:-0.5px; }
  .sub { color:#949494; font-size:13px; margin-bottom:24px; }
  .overall { display:inline-flex; align-items:center; gap:8px; padding:8px 16px; border-radius:20px;
             font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:1.2px; margin-bottom:20px; border:1px solid; }
  .ok { background:rgba(60,255,208,0.12); color:#3cffd0; border-color:#309875; }
  .bad { background:rgba(255,110,199,0.12); color:#ff6ec7; border-color:#ff6ec7; }
  .warn { background:rgba(255,225,77,0.12); color:#ffe14d; border-color:#ffe14d; }
  .card { background:#2d2d2d; border:1px solid rgba(255,255,255,0.12); border-radius:20px;
          padding:18px 20px; margin-bottom:12px; display:flex; align-items:center; justify-content:space-between; gap:16px; }
  .card .name { font-family:'Courier New',monospace; text-transform:uppercase; letter-spacing:1.2px; font-size:12px; color:#fff; }
  .card .msg { font-size:12px; color:#949494; margin-top:4px; word-break:break-word; }
  .dot { width:12px; height:12px; border-radius:50%; flex:none; }
  .dot.ok { background:#3cffd0; box-shadow:0 0 0 4px rgba(60,255,208,0.18); }
  .dot.bad { background:#ff6ec7; box-shadow:0 0 0 4px rgba(255,110,199,0.18); }
  .dot.warn { background:#ffe14d; box-shadow:0 0 0 4px rgba(255,225,77,0.18); }
  .right { display:flex; align-items:center; gap:12px; }
  .status-text { font-family:'Courier New',monospace; text-transform:uppercase; font-size:11px; letter-spacing:1px; }
  .meta { margin-top:26px; font-family:'Courier New',monospace; font-size:11px; color:#949494; line-height:1.9; }
  a { color:#3860be; text-decoration:none; }
  a:hover { color:#3cffd0; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="kicker">ML Knowledge Hub</div>
    <h1>System Status</h1>
    <div class="sub">Backend connectivity &amp; health dashboard</div>
    <div class="overall ${overallClass}"><span class="dot ${overallDot}"></span>${s.status.toUpperCase()}</div>
    ${mongoCard}
    ${supaCard}
    <div class="meta">
      Uptime: ${Math.round(s.uptime)}s · ${this.esc(s.timestamp)}<br />
      API docs: <a href="/docs">/docs</a>
    </div>
  </div>
</body>
</html>`;
  }

  private esc(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
