FROM node:20-bookworm AS builder
WORKDIR /app

COPY package*.json ./
COPY src/prisma ./src/prisma

# Install all dependencies (including dev)
RUN npm install --legacy-peer-deps

COPY . .

RUN npx prisma generate
RUN npm run build

# Production image
FROM node:20-bookworm

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/prisma ./src/prisma
COPY --from=builder /app/package*.json ./

ENV NODE_ENV=production

EXPOSE 3002

CMD ["node", "dist/src/main.js"]
