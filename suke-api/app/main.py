import re
from typing import Annotated, Any
from urllib.parse import unquote, urlparse

import httpx
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from .config import settings


app = FastAPI(title="蜀科评估 API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


def dify_headers() -> dict[str, str]:
    if not settings.dify_api_key:
        raise HTTPException(status_code=500, detail="服务端未配置 DIFY_API_KEY")
    return {"Authorization": f"Bearer {settings.dify_api_key}"}


def dify_url(path: str) -> str:
    return f"{str(settings.dify_base_url).rstrip('/')}{path}"


_MD_LINK = re.compile(r"\[([^\]]*)\]\(([^)]+)\)")


def normalize_output(value) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        lines = []
        for index, item in enumerate(value, start=1):
            if isinstance(item, dict):
                name = item.get("name") or item.get("filename") or item.get("id") or f"文件{index}"
                url = item.get("url") or item.get("remote_url") or item.get("preview_url")
                if url:
                    lines.append(f"- [{name}]({url})")
                else:
                    lines.append(f"- {name}")
            else:
                lines.append(f"- {item}")
        return "\n".join(lines)
    if isinstance(value, dict):
        name = value.get("name") or value.get("filename") or value.get("id")
        url = value.get("url") or value.get("remote_url") or value.get("preview_url")
        if name and url:
            return f"[{name}]({url})"
        if name:
            return str(name)
    return str(value)


def markdown_from_value(value: Any) -> str:
    """从工作流原始字段提取可读 Markdown 文本（兼容 str / list / dict）。"""
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        for key in ("markdown", "text", "content", "result", "output", "answer"):
            item = value.get(key)
            if isinstance(item, str) and item.strip():
                return item.strip()
        for key in ("files", "attachments", "documents"):
            sub = value.get(key)
            if isinstance(sub, list) and sub:
                return normalize_output(sub)
        return normalize_output(value)
    if isinstance(value, list):
        return normalize_output(value)
    return str(value)


def markdown_link_files(text: str) -> list[dict[str, str]]:
    seen: set[str] = set()
    out: list[dict[str, str]] = []
    for m in _MD_LINK.finditer(text or ""):
        label, url = m.group(1).strip(), m.group(2).strip()
        name = label or "下载文件"
        if url and url not in seen:
            seen.add(url)
            out.append({"name": name, "url": url})
    return out


def collect_files_from_value(value: Any) -> list[dict[str, str]]:
    files: list[dict[str, str]] = []
    if isinstance(value, list):
        for item in value:
            files.extend(collect_files_from_value(item))
    elif isinstance(value, dict):
        url = value.get("url") or value.get("remote_url") or value.get("preview_url")
        if url:
            name = (
                value.get("name")
                or value.get("filename")
                or value.get("id")
                or "下载文件"
            )
            files.append({"name": str(name), "url": str(url)})
        for key in ("files", "attachments", "documents"):
            sub = value.get(key)
            if isinstance(sub, list):
                for item in sub:
                    files.extend(collect_files_from_value(item))
    return files


def dedupe_files(files: list[dict[str, str]]) -> list[dict[str, str]]:
    seen: set[str] = set()
    out: list[dict[str, str]] = []
    for f in files:
        u = f.get("url") or ""
        if u and u not in seen:
            seen.add(u)
            out.append(f)
    return out


def preview_text_from_markdown(md: str, max_len: int = 400) -> str:
    """去掉仅含链接的行，并将正文内 [label](url) 替换为 label 后截取摘要。"""
    if not md:
        return ""
    link_only = re.compile(
        r"^-\s*\[([^\]]*)\]\(([^)]+)\)\s*$|^\[([^\]]*)\]\(([^)]+)\)\s*$"
    )
    out_lines: list[str] = []
    for line in md.splitlines():
        if link_only.match(line.strip()):
            continue
        plain = _MD_LINK.sub(lambda m: (m.group(1).strip() or "链接").strip(), line)
        out_lines.append(plain)
    text = "\n".join(out_lines)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    if len(text) <= max_len:
        return text
    return text[: max_len - 1].rstrip() + "…"


def workflow_preview_text(value: Any) -> str | None:
    if not isinstance(value, dict):
        return None
    for key in ("previewText", "preview", "summary", "conclusion", "abstract"):
        item = value.get(key)
        if isinstance(item, str) and item.strip():
            return item.strip()
    return None


def structure_output(value: Any) -> dict[str, Any]:
    """统一为前端可用的结构化块：markdown / previewText / files。"""
    markdown = markdown_from_value(value)
    files = dedupe_files(markdown_link_files(markdown) + collect_files_from_value(value))
    hint = workflow_preview_text(value)
    preview = hint or preview_text_from_markdown(markdown)
    return {"markdown": markdown, "previewText": preview, "files": files}


def allowed_proxy_url(url: str) -> bool:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return False
    base = urlparse(str(settings.dify_base_url))
    return bool(parsed.netloc) and parsed.netloc == base.netloc


def parse_filename_from_cd(value: str | None) -> str | None:
    if not value:
        return None
    for part in value.split(";"):
        part = part.strip()
        if part.lower().startswith("filename*="):
            meta = part.split("=", 1)[1].strip()
            if "''" in meta:
                return unquote(meta.split("''", 1)[1].strip().strip('"'))
            continue
        if part.lower().startswith("filename="):
            raw = part.split("=", 1)[1].strip().strip('"')
            return unquote(raw)
    return None


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/files/proxy")
async def proxy_dify_file(url: str) -> Response:
    """代理下载 Dify 域名下的文件，避免跨域与 Cookie 限制；URL 必须与 DIFY_BASE_URL 同 host。"""
    if not url:
        raise HTTPException(status_code=400, detail="缺少 url 参数")
    if not allowed_proxy_url(url):
        raise HTTPException(status_code=400, detail="URL 不在允许的白名单内")

    timeout = httpx.Timeout(settings.request_timeout_seconds)
    headers = dify_headers()
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        upstream = await client.get(url, headers=headers)
    if upstream.status_code == 401 or upstream.status_code == 403:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            upstream = await client.get(url)

    if upstream.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail=f"文件下载失败：HTTP {upstream.status_code}",
        )

    filename = parse_filename_from_cd(upstream.headers.get("content-disposition"))
    if not filename:
        path_part = urlparse(url).path.rsplit("/", 1)[-1]
        filename = unquote(path_part) if path_part else "download"

    media_type = upstream.headers.get("content-type") or "application/octet-stream"
    return Response(
        content=upstream.content,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


async def upload_to_dify(client: httpx.AsyncClient, file: UploadFile) -> dict:
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail=f"{file.filename or '文件'} 内容为空")

    response = await client.post(
        dify_url("/v1/files/upload"),
        headers=dify_headers(),
        data={"user": settings.dify_user},
        files={
            "file": (
                file.filename or "upload.bin",
                content,
                file.content_type or "application/octet-stream",
            )
        },
    )

    if response.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail=f"Dify 文件上传失败：{response.text}",
        )

    return response.json()


@app.post("/api/evaluations/run")
async def run_evaluation(
    files: Annotated[list[UploadFile], File(description="成果/专利相关文件")],
    certify: Annotated[str, Form()] = "国内领先",
    award: Annotated[str, Form()] = "无",
) -> dict:
    if not files:
        raise HTTPException(status_code=400, detail="请上传至少一个文件")

    timeout = httpx.Timeout(settings.request_timeout_seconds)
    async with httpx.AsyncClient(timeout=timeout) as client:
        uploaded_files = [await upload_to_dify(client, file) for file in files]

        workflow_payload = {
            "inputs": {
                "patent_files": [
                    {
                        "type": "document",
                        "transfer_method": "local_file",
                        "upload_file_id": item["id"],
                    }
                    for item in uploaded_files
                ],
                "certify": certify or "国内领先",
                "award": award or "无",
            },
            "response_mode": "blocking",
            "user": settings.dify_user,
        }

        response = await client.post(
            dify_url("/v1/workflows/run"),
            headers={**dify_headers(), "Content-Type": "application/json"},
            json=workflow_payload,
        )

    if response.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail=f"Dify 工作流执行失败：{response.text}",
        )

    data = response.json()
    outputs = data.get("data", {}).get("outputs") or data.get("outputs") or {}

    eval_raw = outputs.get("evaluation") or outputs.get("result")
    decision_raw = outputs.get("decision")

    return {
        "evaluation": structure_output(eval_raw),
        "decision": structure_output(decision_raw),
        "raw": data,
    }
