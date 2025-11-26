FROM node:20-alpine
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
# Build backend
WORKDIR /app/apps/backend
RUN pnpm build
# Expose port
EXPOSE 3000
# Start the application
CMD ["node", "dist/main.js"]