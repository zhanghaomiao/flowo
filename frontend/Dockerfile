FROM node:22-alpine AS build

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install --registry=https://registry.npmmirror.com


# Copy source code
COPY . .

# Set production environment variables - these must be set at build time
ARG VITE_DISABLE_SSE=false
# Default to empty string (relative path) - frontend will use same origin
# This works with Caddy reverse proxy setup
ARG VITE_API_BASE_PATH=

ENV VITE_API_BASE_PATH=${VITE_API_BASE_PATH}
ENV VITE_DISABLE_SSE=${VITE_DISABLE_SSE}

# Build the application
RUN pnpm run build

# Production stage
FROM nginx:alpine

# Copy built files to nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"] 
