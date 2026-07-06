FROM node:20-alpine

WORKDIR /app

# Install pnpm and tsx globally
RUN npm install -g pnpm@9.15.0 tsx

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

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

# Expose the port Railway injects via $PORT (default 3001 for local)
EXPOSE ${PORT:-3001}

# Start the server — tsx is installed globally so it's resolvable from any directory
WORKDIR /app/apps/server
CMD ["tsx", "src/index.ts"]