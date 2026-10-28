# The website, built to static files and served by Caddy on port 8080. Built from the repository root: the site takes
# the Cofy theme from packages/web-components, which resolves packages/frontend-sdk through a `file:` path, so the three
# are installed and built in that order - as in apps/demo_multitenant/management.Dockerfile.
FROM node:24-alpine AS builder
WORKDIR /app

COPY tsconfig.base.json ./
COPY packages/frontend-sdk/package.json packages/frontend-sdk/package-lock.json ./packages/frontend-sdk/
RUN cd packages/frontend-sdk && npm ci
COPY packages/frontend-sdk ./packages/frontend-sdk
RUN cd packages/frontend-sdk && npm run build

COPY packages/web-components/package.json packages/web-components/package-lock.json ./packages/web-components/
RUN cd packages/web-components && npm ci
COPY packages/web-components ./packages/web-components
RUN cd packages/web-components && npm run build

COPY apps/website/package.json apps/website/package-lock.json ./apps/website/
RUN cd apps/website && npm ci
COPY apps/website ./apps/website
RUN cd apps/website && npm run build

FROM caddy:2-alpine
# Under a name of its own, so the server's process metrics tell this Caddy from the one in front of it.
COPY apps/website/Caddyfile /etc/caddy/website.Caddyfile
COPY --from=builder /app/apps/website/dist /srv
CMD ["caddy", "run", "--config", "/etc/caddy/website.Caddyfile", "--adapter", "caddyfile"]
