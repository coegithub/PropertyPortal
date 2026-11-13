# One image, one process: Express serves the API and the built React app.
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY shared ./shared
COPY --from=build /app/dist ./dist
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD wget -qO- http://localhost:${PORT:-3000}/api/health || exit 1
# DATABASE_URL is supplied by the platform at runtime; it is never baked into the image.
CMD ["node", "server/index.js", "--prod"]
