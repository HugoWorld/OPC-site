# syntax=docker/dockerfile:1.7

# ------------------------------------------------------------------
# 一体化镜像：Node 构建 → Nginx + Node 网关同容器运行
# 访客站 8080 / 工作台 8081 / 网关仅监听容器内 127.0.0.1:8787
# ------------------------------------------------------------------

FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build:all

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    HOST=127.0.0.1 \
    PORT=8787 \
    DATA_DIR=/srv/hugow/data

RUN apt-get update \
    && apt-get install -y --no-install-recommends nginx gosu curl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 10001 hugow \
    && useradd --system --uid 10001 --gid hugow --home /srv/hugow --shell /usr/sbin/nologin hugow

WORKDIR /srv/hugow

COPY --from=build /app/dist ./www
COPY --from=build /app/dist-admin ./admin
COPY --from=build /app/src/server ./server
COPY --from=build /app/src/site/admin/data ./site/admin/data
COPY --from=build /app/package.json ./package.json
COPY deploy/docker/nginx.conf /etc/nginx/nginx.conf
COPY deploy/docker/entrypoint.sh /usr/local/bin/hugow-entrypoint

RUN chmod +x /usr/local/bin/hugow-entrypoint \
    && mkdir -p /srv/hugow/data \
    && chown -R hugow:hugow /srv/hugow/data

EXPOSE 8080 8081

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8081/api/health >/dev/null || exit 1

ENTRYPOINT ["/usr/local/bin/hugow-entrypoint"]
