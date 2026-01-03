# Build stage
FROM node:20-bookworm AS builder
WORKDIR /app

# 1. Copy package files first for better caching
COPY package*.json ./
# 2. Copy prisma directory from src/prisma
COPY src/prisma ./src/prisma

# 3. Install all dependencies (including dev for building)
RUN npm install --legacy-peer-deps

# 4. Copy the rest of the application
COPY . .

# 5. Generate Prisma client and build
RUN npx prisma generate --schema=./src/prisma/schema.prisma
RUN npm run build

# Production stage
FROM node:20-bookworm
WORKDIR /app

# 6. Copy package files and install only production dependencies
COPY --from=builder /app/package*.json ./
RUN npm install --only=production --legacy-peer-deps

# 7. Copy built files and necessary assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
# 8. Copy prisma directory from the correct location
COPY --from=builder /app/src/prisma ./src/prisma

# 9. Generate Prisma client for production with explicit schema path
RUN npx prisma generate --schema=./src/prisma/schema.prisma

# 10. Environment variables
ENV NODE_ENV=production
ENV PORT=3002

# 11. Expose the port
EXPOSE 3002

# 12. Command to run the application
CMD ["node", "dist/main"]