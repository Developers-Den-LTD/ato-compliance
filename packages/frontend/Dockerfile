FROM node:20-alpine as builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/frontend/package.json ./packages/frontend/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/shared ./packages/shared
COPY packages/frontend ./packages/frontend

# Build shared package
WORKDIR /app/packages/shared
RUN pnpm build

# Build frontend
WORKDIR /app/packages/frontend
RUN pnpm build

# Production stage with nginx
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/packages/frontend/dist /usr/share/nginx/html

# Copy nginx config
COPY packages/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
