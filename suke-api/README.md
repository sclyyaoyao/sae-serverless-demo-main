# 蜀科 API

`suke-api` 是前端与 Dify 之间的服务端代理层，负责：

- 隐藏 Dify API Key。
- 上传用户文件到 Dify `/v1/files/upload`。
- 使用 `upload_file_id` 运行 Dify workflow；`inputs.patent_files` 须为**单个**文件对象（与 DSL 中 `type: file` 一致），不能传数组。
- 向前端返回评估报告和转化建议。

## 本地启动

```bash
cp .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## 关键环境变量

```bash
DIFY_BASE_URL=http://localhost:5001
DIFY_API_KEY=替换为Dify工作流API_KEY
DIFY_USER=suke-api
REQUEST_TIMEOUT_SECONDS=600
```

## API

### `GET /health`

健康检查。

### `POST /api/evaluations/run`

表单字段（`multipart/form-data`）：

- `file`：单份专利/成果文件（对应 Dify 工作流变量 `patent_files`）。
- `certify`：成果鉴定评价结论（对应 `certify`）。
- `award`：科技奖励获奖情况（对应 `award`）。
