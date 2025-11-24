FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/backend/package.json ./apps/backend/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/shared ./packages/shared
COPY apps/backend ./apps/backend

# Build shared package
WORKDIR /app/packages/shared
RUN pnpm build

# Build backend
WORKDIR /app/apps/backend
RUN pnpm build

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "dist/main.js"]
