FROM node:20-slim AS base
RUN apt-get update -y && apt-get install -y openssl curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ─── build ───
FROM base AS builder
ARG NEXT_PUBLIC_BASE_PATH=""
ENV NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH}
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
RUN npm run build
# Compile daemon to standalone JS
RUN npx esbuild src/daemon/index.ts --bundle --platform=node --external:@prisma/client --external:prisma --outfile=dist/daemon.js
# Compile bot to standalone JS
RUN npx esbuild src/daemon/bot.ts --bundle --platform=node --external:@prisma/client --external:prisma --outfile=dist/bot.js

# ─── runtime ───
FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --home /home/nextjs nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist/daemon.js ./daemon.js
COPY --from=builder /app/dist/bot.js ./bot.js
COPY --from=builder /app/src/data ./data
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["./entrypoint.sh"]
