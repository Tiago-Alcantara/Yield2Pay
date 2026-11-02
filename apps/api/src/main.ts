import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { APP_CONFIG } from './config/config.module';
import { corsOptionsFor, type Env } from './config/env';

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
  const app = await NestFactory.create(AppModule);
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.on('finish', () => {
      if (res.statusCode >= 400) {
        console.log(`[HTTP] ${req.method} ${req.url} -> ${res.statusCode}`);
      }
    });
    next();
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // CORS: origens de CORS_ORIGIN e allowedHeaders explícito (Authorization,
  // Content-Type, privy-id-token, X-Household-Id). Regra em config/env.ts.
  app.enableCors(corsOptionsFor(process.env));
  const config = app.get<Env>(APP_CONFIG);
  // Todo erro sai daqui no mesmo formato (ApiErrorPayload) que as telas de erro
  // consomem; fora de produção o corpo ainda carrega technicalDetails, sem stack.
  app.useGlobalFilters(new AllExceptionsFilter(config.appEnv));
  await app.listen(config.port);
}
void bootstrap();
