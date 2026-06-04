# Build stage
FROM node:20-bookworm AS builder
WORKDIR /app

COPY package*.json ./
COPY src/prisma ./src/prisma

RUN npm install --legacy-peer-deps

COPY . .

RUN npx prisma generate --schema=./src/prisma/schema.prisma
RUN npm run build

# Production stage — reuse builder node_modules (avoids prod-only install + postinstall prisma)
FROM node:20-bookworm
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3002

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src/prisma ./src/prisma

RUN npx prisma generate --schema=./src/prisma/schema.prisma

EXPOSE 3002

CMD ["node", "dist/main.js"]
