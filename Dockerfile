# Build recipe for the `web` service.
#
# Railway's own builder could not prepare this repository: it is a pnpm
# workspace on pnpm 12.4.2 with the Next app in a sub-package, and the
# heuristics give up before they reach a build command. A Dockerfile removes
# the guessing entirely, and pins the same Node and pnpm the repository pins.
FROM node:24-slim

RUN corepack enable && corepack prepare pnpm@12.4.2 --activate

WORKDIR /app

# Build-time only: Next inlines NEXT_PUBLIC_* into the client bundle, so it has
# to be present while `next build` runs, not just at boot.
ARG NEXT_PUBLIC_RPC_URL=""
ENV NEXT_PUBLIC_RPC_URL=$NEXT_PUBLIC_RPC_URL

COPY . .

# The lockfile is authoritative; a deploy that quietly resolves different
# versions than the ones tested is not the same application.
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @tipvault/web build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["pnpm", "--filter", "@tipvault/web", "start"]
