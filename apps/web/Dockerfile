# Yield2Pay Web (Next.js) — portable container image (Coolify / any host).
# Build context MUST be the repo root: the app is part of a pnpm workspace and
# depends on packages/shared. Example: docker build -f apps/web/Dockerfile .
FROM node:20-slim AS build
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate
WORKDIR /app

# Install workspace deps (cache-friendly: copy ALL workspace manifests first so
# --frozen-lockfile matches; missing a member would break the frozen install).
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

# NEXT_PUBLIC_* are baked at build time — Coolify passes them as build args.
# Mark these as "Build Variable" in the Coolify app settings.
ARG NEXT_PUBLIC_PRIVY_APP_ID
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_AUTH_BYPASS
ENV NEXT_PUBLIC_PRIVY_APP_ID=$NEXT_PUBLIC_PRIVY_APP_ID
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_AUTH_BYPASS=$NEXT_PUBLIC_AUTH_BYPASS

# Copy sources and build
COPY . .
RUN pnpm --filter @yield2pay/web build

ENV NODE_ENV=production
EXPOSE 3000
WORKDIR /app/apps/web
# Coolify may inject PORT at runtime; default to 3000.
CMD ["sh", "-c", "pnpm exec next start -p ${PORT:-3000}"]
