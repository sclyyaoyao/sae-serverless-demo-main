# sae-serverless-demo-main

蜀科科技成果评估演示栈：**React 前端（`suke-front`） + FastAPI 代理（`suke-api`） + Dify 工作流**，支持文件上传评估、结构化输出展示、**经后端白名单的同域文件代理下载**，避免在前端暴露 Dify Key。

## 仓库与本地对照说明

| 本地路径 | 说明 |
|---------|------|
| **`蜀科项目文档/suke-api`、`suke-front`、`docker-compose.prod.yml`** | **本次推送主体**：与当前「蜀科 + Dify」交付一致 |
| **`patent/sae-serverless-demo-main-1.0.1/project`** | 历史 Node 版 sae-serverless-demo（另一套栈），**未纳入本仓库**；若需旧版请参考该目录 |

## 快速开始（Docker）

```bash
cp .env.example .env
# 编辑 .env，填写 DIFY_BASE_URL、DIFY_API_KEY 等真实值（勿提交）
docker compose up -d --build
```

浏览器访问：`http://localhost:${SUKE_HTTP_PORT:-8080}`。

详见 [suke-front/DEPLOY.md](suke-front/DEPLOY.md)。

## Dify 工作流

可将仓库中的 [suke-2.1.yml](suke-2.1.yml) 导入 Dify 控制台，发布后创建工作流 API Key，并写入环境变量 `DIFY_API_KEY`。

## 密钥与合规

所有敏感配置必须通过环境变量或部署平台密钥管理注入：**不要**把真实 `app-…` Key、腾讯云密钥或 `.pem` 私钥写入任何可被 Git 跟踪的文件。

## 目录结构

- `suke-api/` — 隐藏 Dify Key、上传文件、运行 `/v1/workflows/run`、文件代理 `/api/files/proxy`
- `suke-front/` — 蜀科前端（Vite + React）
- `docker-compose.yml` — 由交付用 `docker-compose.prod.yml` 同步，Compose 编排
- `.env.example` — 占位说明模板
