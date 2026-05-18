import axios from 'axios';
import { extractStructuredFromApiResponse } from '../utils/radarParse';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

/**
 * 代理下载 Dify 同域文件（需后端白名单）
 * @param {string} remoteUrl
 */
export function getFileProxyUrl(remoteUrl) {
  if (!remoteUrl) return '#';
  return `${API_BASE_URL}/api/files/proxy?url=${encodeURIComponent(remoteUrl)}`;
}

const LINK_ONLY_LINE =
  /^-\s*\[[^\]]*\]\([^)]+\)\s*$|^\[[^\]]*\]\([^)]+\)\s*$/;

/** 与后端预览逻辑类似的本地兜底摘要 */
export function derivePreviewFromMarkdown(markdown, maxLen = 400) {
  if (!markdown) return '';
  const lines = markdown
    .split('\n')
    .filter((line) => !LINK_ONLY_LINE.test(line.trim()))
    .map((line) =>
      line.replace(/\[([^\]]*)\]\([^)]+\)/g, (_, label) =>
        (label || '链接').trim()
      )
    );
  let text = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1).trim()}…`;
}

/**
 * 将接口返回的 evaluation / decision 规范为 { markdown, previewText, files }
 * @param {unknown} raw
 */
export function normalizeOutputBlock(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const md = raw.markdown ?? '';
    const preview = raw.previewText || derivePreviewFromMarkdown(md);
    return {
      markdown: md,
      previewText: preview,
      files: Array.isArray(raw.files) ? raw.files : [],
    };
  }
  const md = typeof raw === 'string' ? raw : '';
  return {
    markdown: md,
    previewText: derivePreviewFromMarkdown(md),
    files: [],
  };
}

function normalizeFileCandidate(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const url = item.url || item.remote_url || item.preview_url;
  if (!url) return null;
  return {
    name: String(item.name || item.filename || item.id || '下载文件'),
    url: String(url),
  };
}

function collectFilesFromAny(value, out = []) {
  const direct = normalizeFileCandidate(value);
  if (direct) out.push(direct);

  if (Array.isArray(value)) {
    value.forEach((item) => collectFilesFromAny(item, out));
  } else if (value && typeof value === 'object') {
    for (const key of ['files', 'attachments', 'documents']) {
      collectFilesFromAny(value[key], out);
    }
  }

  return out;
}

function uniqueFiles(files) {
  const seen = new Set();
  return files.filter((file) => {
    if (!file?.url || seen.has(file.url)) return false;
    seen.add(file.url);
    return true;
  });
}

function classifyUnifiedFiles(files) {
  const evaluation = [];
  const decision = [];
  const unknown = [];
  const decisionRe = /(决策|转化|策略|decision|conversion|strategy)/i;
  const evaluationRe = /(评估|评价|评审|报告|evaluation|assessment|report)/i;

  uniqueFiles(files).forEach((file) => {
    const name = file.name || '';
    if (decisionRe.test(name)) {
      decision.push(file);
    } else if (evaluationRe.test(name)) {
      evaluation.push(file);
    } else {
      unknown.push(file);
    }
  });

  return {
    evaluation: evaluation.length ? evaluation : unknown,
    decision,
  };
}

function extractUnifiedFiles(data) {
  const outputs = data?.outputs || data?.raw?.data?.outputs || data?.raw?.outputs;
  return uniqueFiles([
    ...collectFilesFromAny(data?.files),
    ...collectFilesFromAny(outputs?.files),
    ...collectFilesFromAny(outputs?.attachments),
    ...collectFilesFromAny(data?.raw?.data?.files),
  ]);
}

/**
 * 展开正文前去掉「仅链接」行，并把 [label](url) 换成可读文字，避免重复暴露 URL。
 */
export function markdownForDisplay(markdown) {
  if (!markdown) return '';
  const lines = markdown
    .split('\n')
    .filter((line) => !LINK_ONLY_LINE.test(line.trim()))
    .map((line) =>
      line.replace(/\[([^\]]*)\]\([^)]+\)/g, (_, label) =>
        (label || '附件').trim()
      )
    );
  return lines.join('\n');
}

/**
 * 调用评估服务进行科技成果评估（当前流程仅接收单份上传材料）
 * @param {import('antd').UploadFile[]} fileList - Ant Design Upload 的 fileList（仅取第一份）
 * @param {string} certify - 成果鉴定评价结论
 * @param {string} award - 科技奖励获奖情况
 * @param {Function} onProgress - 进度回调
 * @param {{ signal?: AbortSignal }} [fetchOptions]
 * @returns {Promise<{evaluation: object, decision: object}>}
 */
export async function runEvaluation(
  fileList,
  certify,
  award,
  onProgress,
  fetchOptions = {}
) {
  if (!fileList || fileList.length === 0) {
    throw new Error('请上传专利文件');
  }
  if (fileList.length > 1) {
    throw new Error('当前评估工作流仅支持单个文件，请只保留一份专利文件后再试');
  }

  const formData = new FormData();
  const item = fileList[0];
  const blob = item.originFileObj || item;
  formData.append('file', blob);

  formData.append('certify', certify || '国内领先');
  formData.append('award', award || '无');

  try {
    onProgress?.('正在上传文件并启动评估...');

    const response = await axios.post(
      `${API_BASE_URL}/api/evaluations/run`,
      formData,
      {
        // 勿手动设置 multipart Content-Type，需由浏览器带上 boundary
        timeout: 600000,
        signal: fetchOptions.signal,
      }
    );

    onProgress?.('评估完成');

    const data = response.data;
    const evaluation = normalizeOutputBlock(data.evaluation ?? data.outputs?.evaluation);
    const decision = normalizeOutputBlock(data.decision ?? data.outputs?.decision);
    const fallbackFiles = classifyUnifiedFiles(extractUnifiedFiles(data));
    if (!evaluation.files.length && fallbackFiles.evaluation.length) {
      evaluation.files = fallbackFiles.evaluation;
    }
    if (!decision.files.length && fallbackFiles.decision.length) {
      decision.files = fallbackFiles.decision;
    }

    return {
      evaluation,
      decision,
      /** 若后端在顶层或 outputs 中返回雷达/分值字段，则供前端结构化展示（无则降级为正文解析） */
      structuredDimensions: extractStructuredFromApiResponse(data),
    };

  } catch (error) {
    const aborted =
      axios.isCancel?.(error) ||
      error?.code === 'ERR_CANCELED' ||
      error?.name === 'CanceledError';
    if (aborted) throw error;

    console.error('Dify API Error:', error);
    throw new Error(error.response?.data?.detail || error.message || '调用评估服务失败');
  }
}

/**
 * 检查Dify服务连接状态
 */
export async function checkServiceHealth() {
  try {
    const response = await axios.get(`${API_BASE_URL}/health`, { timeout: 5000 });
    return response.status === 200;
  } catch {
    return false;
  }
}
