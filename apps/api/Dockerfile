# FixEarn API — portable container image (Render / Railway / Fly / any host).
# Build context MUST be the repo root (the app is part of a pnpm workspace and
# depends on packages/shared). Example: docker build -f apps/api/Dockerfile .
FROM node:20-slim AS build
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate
WORKDIR /app

# Install workspace deps (cache-friendly: copy ALL workspace manifests first so
# --frozen-lockfile matches; missing a member would break the frozen install).
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

# Copy sources and build
COPY . .
# prisma generate reads DATABASE_URL via prisma.config.ts; a dummy is fine here
# (generate does not connect — the real URL is injected at runtime).
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN pnpm --filter @fixearn/api exec prisma generate \
  && pnpm --filter @fixearn/api build

ENV NODE_ENV=production
# Render/Railway inject PORT at runtime; the app reads process.env.PORT.
EXPOSE 3001
WORKDIR /app/apps/api
# Apply pending migrations, then start the built entry. The monorepo build
# emits to dist/apps/api/src/main.js (packages/shared is pulled into rootDir).
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/apps/api/src/main.js"]
