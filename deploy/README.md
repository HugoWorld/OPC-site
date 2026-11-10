# 部署目录说明

这个目录同时放两套部署方式。**普通用户只需要看根目录的 `install.sh`**；本目录面向需要自己接管服务器的人。

## 方案 A：一体化镜像（推荐，0 基础）

根目录 `install.sh` 会调用 `Dockerfile` + `compose.yaml`，把 Nginx、Node 网关和静态产物打进一个镜像：

```bash
git clone https://github.com/HugoWorld/OPC-site.git
cd OPC-site
bash install.sh
```

- 访客站：`http://服务器IP:8080`
- 工作台：`http://服务器IP:8081`
- 数据：宿主机 `./data`（`current.json` + 版本快照）
- 容器内网关只监听 `127.0.0.1:8787`，公网只经 Nginx 的 8080/8081

| 文件 | 用途 |
|---|---|
| `../Dockerfile` | 双阶段构建：Node 构建 → Nginx + Node 运行时 |
| `../compose.yaml` | 端口、数据卷、重启策略 |
| `../.env.example` | 首次配置模板（4 个飞书值） |
| `../install.sh` | 检查/安装 Docker、生成 `.env`、启动、健康检查 |
| `../hugow` | 日常 `start/stop/restart/status/logs/backup/upgrade` |
| `docker/nginx.conf` | 容器内双端口 Nginx：8080 访客、8081 工作台 + `/api` |
| `docker/entrypoint.sh` | 同时拉起 Node 与 Nginx，任一退出则容器退出 |

## 方案 B：宿主机 Nginx + systemd（进阶）

适合已有 Nginx、想自己管证书和系统服务的情况。文件：

| 文件 | 用途 |
|---|---|
| `make-release.ps1` / `make-release.sh` | 本地构建并打发布包（含 SHA256） |
| `deploy.sh` | Ubuntu 首次/增量部署（装依赖、建用户、同步、证书、启动） |
| `nginx-www.conf` | 访客站 `www` 的 80/443、静态缓存、`/data/` 快照 |
| `nginx-admin.conf` | 工作台 `admin` 的 80/443、`/api` 反代、限流 |
| `nginx-bootstrap.conf` | 签证书前只开 80 的临时配置 |
| `nginx-limits.conf` | 两个子域共享的限流区 |
| `hugow-gateway.service` | systemd 单元（只监听 127.0.0.1:8787） |
| `gateway.env.example` | 环境变量模板（复制到 `/etc/hugow/gateway.env`） |
| `backup.sh` | 快照数据 + 配置的每日备份 |
| `health-check.sh` | 服务、TLS、快照、磁盘检查 |

最短路径：

```bash
pwsh ./deploy/make-release.ps1
# 上传 _release/hugow-release-<timestamp>.tar.gz 到服务器后：
sudo DOMAIN=example.com ACME_EMAIL=you@example.com \
     /tmp/hugow-release/deploy/deploy.sh /tmp/hugow-release
```

## 重要约束

- 网关只监听 `127.0.0.1:8787`，不要把它暴露到公网。
- `FEISHU_REDIRECT_URI`、`PUBLIC_ADMIN_ORIGIN`、Nginx `server_name`、DNS、证书域名必须完全一致，否则飞书会报 `20029`。
- `.env` / `/etc/hugow/gateway.env` 权限必须是 `600`，不要提交到 Git、不要贴到聊天。
- 12 张表按**表名**自动发现 `table_id`；复制模板 Base 后不需要改代码。表名必须与 `src/site/admin/data/table-specs.ts` 里的 12 个英文名一致。
- 发布失败时网关不会切换 `current.json`，前台继续读上一份完整快照。
