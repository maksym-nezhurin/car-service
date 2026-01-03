FROM node:20-bookworm AS builder
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including dev)
RUN npm install --legacy-peer-deps

COPY . .

RUN npx prisma generate
RUN npm run build

# Production image
FROM node:20-bookworm
WORKDIR /app
# Copy package files and install only production dependencies
COPY --from=builder /app/package*.json ./
RUN npm install --only=production --legacy-peer-deps
# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
# Generate Prisma client for production
RUN npx prisma generate
# Environment variables
ENV NODE_ENV=production
ENV PORT=3002
# Expose the port the app runs on
EXPOSE 3002

# Use the correct path based on your build output
CMD ["node", "dist/main.js"]
