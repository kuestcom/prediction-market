FROM node:24-bookworm-slim AS build
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

ARG COMMIT_SHA=unknown

ENV COMMIT_SHA=$COMMIT_SHA

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable \
  && corepack install

RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build
RUN mkdir -p /tmp/runtime-node_modules \
  && cp -aL node_modules/postgres /tmp/runtime-node_modules/postgres

FROM node:24-bookworm-slim AS runner
WORKDIR /app

ARG COMMIT_SHA=unknown

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV COMMIT_SHA=$COMMIT_SHA
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN groupadd --gid 1001 nodejs
RUN useradd --uid 1001 --gid nodejs --create-home nextjs

COPY --from=build --chown=nextjs:nodejs /app/package.json ./package.json

RUN corepack enable \
  && corepack install

COPY --from=build --chown=nextjs:nodejs /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /tmp/runtime-node_modules/postgres ./node_modules/postgres
COPY --from=build --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=build --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=build --chown=nextjs:nodejs /app/src/lib/site-url.ts ./src/lib/site-url.ts
COPY --from=build --chown=nextjs:nodejs /app/src/lib/db/migrations ./src/lib/db/migrations

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
