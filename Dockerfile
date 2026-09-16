FROM node:22-slim AS build
WORKDIR /repo

COPY app/package*.json app/
COPY server/package*.json server/
RUN npm ci --prefix app && npm ci --prefix server

COPY app app
COPY server server
RUN npm run build --prefix app && npm run build --prefix server

FROM node:22-slim
WORKDIR /repo
ENV NODE_ENV=production

COPY --from=build /repo/app/dist app/dist
COPY --from=build /repo/server/dist server/dist
COPY --from=build /repo/server/package*.json server/
RUN npm ci --omit=dev --prefix server

EXPOSE 8787
CMD ["node", "server/dist/index.js"]
