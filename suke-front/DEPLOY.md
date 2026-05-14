# 蜀科部署说明

当前商业化部署采用“前端 + 蜀科 API 代理 + Dify 工作流”的形态：

- 前端只访问同源 `/api`。
- `suke-api` 负责保存 Dify API Key、上传文件到 Dify、运行 workflow。
- Dify 可部署在同一台服务器、另一台服务器，或客户内网已有 Dify 环境。

## 1. 准备 Dify

1. 部署 Dify。
2. 在 Dify 控制台导入仓库根目录的 [`suke-2.1.yml`](../suke-2.1.yml)（Dify DSL 导出）工作流。
3. 发布工作流。
4. 创建工作流 API Key。

## 2. 配置蜀科服务

在项目根目录执行：

```bash
cp .env.example .env
```

编辑 `.env`：

```bash
SUKE_HTTP_PORT=8080
DIFY_BASE_URL=http://host.docker.internal:5001
DIFY_API_KEY=替换为Dify工作流API_KEY
DIFY_USER=suke-api
REQUEST_TIMEOUT_SECONDS=600
```

如果 Dify 不在同机宿主机，把 `DIFY_BASE_URL` 改成实际地址，例如：

```bash
DIFY_BASE_URL=http://10.0.0.12:5001
```

## 3. 启动

在项目根目录执行：

```bash
docker compose up -d --build
```

访问：

```text
http://服务器IP:8080
```

## 4. 验证

后端健康检查：

```bash
curl http://服务器IP:8080/health
```

预期返回：

```json
{"status":"ok"}
```

## 5. 生产注意事项

- 不要把 `DIFY_API_KEY` 写入前端 `.env` 或任何 `VITE_` 变量。
- 正式生产建议在外层再加 HTTPS 证书与域名。
- 客户私有化部署时，优先让 Dify、蜀科 API、前端处于同一内网。
- 后续需要补充 PostgreSQL、用户权限、任务历史、报告归档和审计日志。
