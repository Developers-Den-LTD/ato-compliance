# ---- Build Stage ----
FROM node:18-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

# Build TypeScript to JavaScript (creates dist/)
RUN npm run build



# ---- Production Stage ----
FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --production

# Copy only built files from builder stage
COPY --from=builder /usr/src/app/dist ./dist

# If you have static folders like 'public' or 'uploads', copy them too:
# COPY --from=builder /usr/src/app/public ./public

EXPOSE 3000

CMD ["node", "dist/main.js"]
