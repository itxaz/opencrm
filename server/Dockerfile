# Inspire CRM API — container image for Railway (or any container host).
FROM node:20-slim AS deps
WORKDIR /app
COPY package*.json ./
# Install all deps (incl. dev) — the migrate step and start command run via tsx.
RUN npm ci

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Railway injects PORT; the app reads it (defaults to 4000 locally).
EXPOSE 4000
CMD ["npm", "start"]
