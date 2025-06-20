# Multi-stage build for frontend
FROM hub.miaodocker.space:8443/library/node:20-alpine AS build

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Set production environment variables - these must be set at build time
ARG VITE_DISABLE_SSE=false
ARG VITE_SSE_RECONNECT_INTERVAL=3000
ARG VITE_SSE_MAX_RETRIES=5
ARG VITE_API_BASE_PATH=localhost:3100

ENV VITE_API_BASE_PATH=${VITE_API_BASE_PATH}
ENV VITE_DISABLE_SSE=${VITE_DISABLE_SSE}
ENV VITE_SSE_RECONNECT_INTERVAL=${VITE_SSE_RECONNECT_INTERVAL}
ENV VITE_SSE_MAX_RETRIES=${VITE_SSE_MAX_RETRIES}

# Build the application
RUN pnpm run build

# Production stage
FROM hub.miaodocker.space:8443/library/nginx:alpine

# Copy built files to nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"] 