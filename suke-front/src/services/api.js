import axios from 'axios';

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
 * 调用Dify工作流进行科技成果评估
 * @param {File[]} files - 专利文件数组
 * @param {string} certify - 成果鉴定评价结论
 * @param {string} award - 科技奖励获奖情况
 * @param {Function} onProgress - 进度回调
 * @returns {Promise<{evaluation: object, decision: object}>}
 */
export async function runEvaluation(files, certify, award, onProgress) {
  if (!files || files.length === 0) {
    throw new Error('请上传至少一个专利文件');
  }

  const formData = new FormData();

  files.forEach((file) => {
    formData.append('files', file.originFileObj || file);
  });

  formData.append('certify', certify || '国内领先');
  formData.append('award', award || '无');

  try {
    onProgress?.('正在上传文件并启动评估...');

    const response = await axios.post(
      `${API_BASE_URL}/api/evaluations/run`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        timeout: 600000
      }
    );

    onProgress?.('评估完成');

    return {
      evaluation: normalizeOutputBlock(
        response.data.evaluation ?? response.data.outputs?.evaluation
      ),
      decision: normalizeOutputBlock(
        response.data.decision ?? response.data.outputs?.decision
      ),
    };

  } catch (error) {
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
