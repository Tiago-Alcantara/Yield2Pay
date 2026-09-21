import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { HttpException, HttpStatus, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import {
  allowRequest,
  pruneExpiredBuckets,
  RATE_LIMIT_MAX_HITS,
  RATE_LIMIT_WINDOW_MS,
} from './common/rate-limit';
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
  // Render (and any reverse proxy) puts the client in X-Forwarded-For.
  // Without this, req.ip is the load balancer and every user shares one bucket.
  app.set('trust proxy', 1);
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.on('finish', () => {
      if (res.statusCode >= 400) {
        console.log(`[HTTP] ${req.method} ${req.url} -> ${res.statusCode}`);
      }
    });
    next();
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const config = app.get<Env>(APP_CONFIG);
  app.enableCors({
    origin: config.corsOrigins ?? true,
    credentials: true,
  });
  const rateLimitBuckets = new Map<string, number[]>();
  const rateLimitSweep = setInterval(() => {
    pruneExpiredBuckets(rateLimitBuckets, Date.now(), RATE_LIMIT_WINDOW_MS);
  }, RATE_LIMIT_WINDOW_MS);
  rateLimitSweep.unref();
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (req.path === '/health' || req.path.startsWith('/health/')) {
      next();
      return;
    }
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    if (
      !allowRequest(
        rateLimitBuckets,
        key,
        Date.now(),
        RATE_LIMIT_WINDOW_MS,
        RATE_LIMIT_MAX_HITS,
      )
    ) {
      next(new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS));
      return;
    }
    next();
  });
  // Todo erro sai daqui no mesmo formato (ApiErrorPayload) que as telas de erro
  // consomem; fora de produção o corpo ainda carrega technicalDetails.
  app.useGlobalFilters(new AllExceptionsFilter(config.appEnv));
  await app.listen(config.port);
}
void bootstrap();
