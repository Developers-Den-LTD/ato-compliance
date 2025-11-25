FROM node:20-alpine as builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy all workspace files
COPY . .

# Install all dependencies from root
RUN pnpm install

# Build shared package first
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
