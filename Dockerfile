FROM node:20-alpine AS build
WORKDIR /app

COPY server/package*.json ./server/
RUN cd server && npm ci

COPY client/package*.json ./client/
RUN cd client && npm ci

COPY server/ ./server/
COPY client/ ./client/

RUN cd client && npm run build
RUN cd server && npm run build

FROM node:20-alpine
WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/node_modules ./server/node_modules
COPY --from=build /app/client/dist ./client/dist
COPY server/package.json ./server/

USER appuser

EXPOSE 3000
CMD ["node", "server/dist/index.js"]
