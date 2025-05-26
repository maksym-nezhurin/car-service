FROM node:18-alpine

WORKDIR /app

COPY package.json ./
COPY pnpm-lock.yaml* ./

RUN corepack enable && corepack prepare pnpm@9.15.2 --activate && pnpm install --prod

COPY . .

CMD ["node", "dist/main.js"]

