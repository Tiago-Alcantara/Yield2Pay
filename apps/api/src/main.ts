import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { APP_CONFIG } from './config/config.module';
import type { Env } from './config/env';

// JSON cannot serialize BigInt; encode as decimal string at the boundary.
declare global {
  interface BigInt {
    toJSON(): string;
  }
}
BigInt.prototype.toJSON = function () {
  return this.toString();
};

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const logger = new Logger('HTTP');
  const isProd = process.env.NODE_ENV === 'production';
  // Atrás de proxy (Render/Cloudflare) o IP real vem no X-Forwarded-For. Sem
  // trust proxy, req.ip = IP do proxy e o rate limit chavearia todos no mesmo
  // bucket. 1 = confia no primeiro hop. AJUSTAR ao nº real de proxies (ex.: 2
  // se colocar Cloudflare na frente do Render). Só em prod — em dev não há proxy.
  if (isProd) {
    app.set('trust proxy', 1);
  }
  // Só loga erros do servidor (5xx). 4xx é ruído esperado (auth/validação) e,
  // sob flood, viraria amplificação de disco/CPU. Sem log de URL/token.
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.on('finish', () => {
      if (res.statusCode >= 500) {
        logger.warn(`${req.method} ${req.path} -> ${res.statusCode}`);
      }
    });
    next();
  });
  // Headers de segurança (HSTS, no-sniff, frameguard, etc).
  app.use(helmet());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // CORS: o web roda em outra origem (localhost:3000 em dev, domínio Vercel em
  // prod). Permite apenas as origens de CORS_ORIGIN (separadas por vírgula).
  // Falha fechado: em produção, sem CORS_ORIGIN → aborta o boot (nunca refletir
  // qualquer origem com credentials). Em dev, sem a var → libera localhost.
  const corsEnv = process.env.CORS_ORIGIN?.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (isProd && (!corsEnv || corsEnv.length === 0)) {
    throw new Error('CORS_ORIGIN é obrigatório em produção');
  }
  app.enableCors({
    origin: corsEnv && corsEnv.length > 0 ? corsEnv : true,
    credentials: true,
  });
  const config = app.get<Env>(APP_CONFIG);
  await app.listen(config.port);
}
void bootstrap();
