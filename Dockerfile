# syntax=docker/dockerfile:1
# MoveAlong — Prisma + Next.js Docker (Debian for OpenSSL 3)
# ── Fix: previous alpine image generated Prisma engine for openssl-1.1.x
#    because OpenSSL was missing at generate time. Debian bookworm ships openssl 3.

FROM node:20-bookworm-slim AS base
WORKDIR /app
# Prisma needs openssl + ca-certificates at install AND runtime
RUN apt-get update -y && apt-get install -y openssl ca-certificates libssl-dev && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json* ./
COPY prisma ./prisma
# Generate Prisma client after openssl is present so binaryTargets are detected correctly
RUN npm install --ignore-scripts=false

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Install runtime deps needed for prisma db push
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/next.config.mjs ./next.config.mjs

EXPOSE 3000
CMD ["sh","-c","npx prisma db push --accept-data-loss && npx tsx prisma/seed.ts || true; exec npm start"]
