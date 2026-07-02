FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9.15.0

# Copy monorepo root files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy workspace package files
COPY packages/config/package.json ./packages/config/
COPY packages/db/package.json ./packages/db/
COPY packages/schema/package.json ./packages/schema/
COPY apps/server/package.json ./apps/server/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY packages/config ./packages/config
COPY packages/db ./packages/db
COPY packages/schema ./packages/schema
COPY apps/server ./apps/server

# Build the server
RUN pnpm build --filter=@bantayog/server

# Expose port
EXPOSE 3001

# Start the server
CMD ["pnpm", "--filter=@bantayog/server", "dev"]