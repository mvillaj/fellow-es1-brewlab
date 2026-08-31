# syntax=docker/dockerfile:1

# ---- build ------------------------------------------------------------------
FROM node:22-slim AS build
WORKDIR /app

# Manifests first so `npm ci` is cached until a dependency actually changes.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci

COPY . .

# Clerk's publishable key is inlined into the JS bundle at build time — Vite
# only exposes VITE_-prefixed variables, and it does so by substitution, not by
# reading the environment at runtime. So it has to be a build arg: setting it
# with `fly secrets set` does nothing for the client, and the app boots to the
# "Missing VITE_CLERK_PUBLISHABLE_KEY" screen. Fail here instead of shipping
# a bundle that cannot sign anyone in.
ARG VITE_CLERK_PUBLISHABLE_KEY
RUN test -n "$VITE_CLERK_PUBLISHABLE_KEY" || { \
      echo ""; \
      echo "ERROR: VITE_CLERK_PUBLISHABLE_KEY build arg is required."; \
      echo "  fly deploy --build-arg VITE_CLERK_PUBLISHABLE_KEY=pk_live_..."; \
      echo ""; \
      exit 1; \
    }
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
RUN npm run build

# ---- runtime ----------------------------------------------------------------
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Litestream streams the SQLite file to object storage as it changes. Without it
# a single Fly volume is the only copy of the brew log that exists.
ARG LITESTREAM_VERSION=0.3.13
ARG TARGETARCH
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates wget \
 && wget -q "https://github.com/benbjohnson/litestream/releases/download/v${LITESTREAM_VERSION}/litestream-v${LITESTREAM_VERSION}-linux-${TARGETARCH}.deb" -O /tmp/litestream.deb \
 && dpkg -i /tmp/litestream.deb \
 && rm /tmp/litestream.deb \
 && apt-get purge -y wget \
 && apt-get autoremove -y \
 && rm -rf /var/lib/apt/lists/*

# The server runs TypeScript through tsx, so the sources and the full
# node_modules (tsx is a devDependency) both have to come along.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages ./packages
COPY --from=build /app/server ./server
COPY --from=build /app/client/dist ./client/dist

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 4000
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
