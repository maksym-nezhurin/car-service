FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY src/prisma ./src/prisma
RUN npm install --production

COPY . .

RUN npx prisma generate
RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/prisma ./src/prisma
COPY --from=builder /app/package*.json ./

ENV NODE_ENV=production

EXPOSE 3002

CMD ["node", "dist/main.js"]

