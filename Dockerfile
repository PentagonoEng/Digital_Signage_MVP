# syntax=docker/dockerfile:1
FROM node:18-alpine AS deps
WORKDIR /app/server
COPY server/package.json server/package-lock.json* ./
RUN npm ci || npm i

FROM node:18-alpine AS runner
WORKDIR /app/server
COPY --from=deps /app/server/node_modules ./node_modules
COPY server ./
COPY docs /app/docs
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
