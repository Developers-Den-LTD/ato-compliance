FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy backend source
COPY src ./src
COPY tsconfig.json ./
COPY drizzle.config.ts ./

# Build backend
RUN npm run build:backend

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm install --production

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY drizzle.config.ts ./

# Copy environment file template
COPY .env.example .env

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "dist/main.js"]
