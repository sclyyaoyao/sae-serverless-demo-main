/**
 * 从评估接口 payload 或 Markdown 正文中尽量提取五维雷达数据（无法提取时返回 null，由 UI 降级占位）。
 */

const CANONICAL_LABELS = ['科学价值', '技术价值', '经济价值', '社会价值', '文化价值'];

function clamp01to100(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, x));
}

/**
 * 将后端可能返回的多种结构归一为 { label, value }[]
 * @param {unknown} raw
 * @returns {{ label: string, value: number }[] | null}
 */
export function normalizeDimensionList(raw) {
  if (!raw) return null;

  if (Array.isArray(raw)) {
    const out = raw
      .map((item) => {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          const label =
            item.label ??
            item.name ??
            item.dimension ??
            item.title ??
            item.key ??
            '';
          const value =
            item.value ?? item.score ?? item.val ?? item.number ?? item.rating;
          return {
            label: String(label || '').trim() || '维度',
            value: clamp01to100(value),
          };
        }
        return null;
      })
      .filter(Boolean);
    return out.length >= 3 ? out : null;
  }

  if (typeof raw === 'object') {
    const entries = Object.entries(raw).filter(
      ([k, v]) =>
        typeof k === 'string' &&
        k.trim() &&
        (typeof v === 'number' || (typeof v === 'string' && v.trim() !== ''))
    );
    if (entries.length < 3) return null;
    return entries.map(([label, value]) => ({
      label: label.trim(),
      value: clamp01to100(value),
    }));
  }

  return null;
}

/**
 * 从整条接口响应中探测结构化雷达/分数字段（不假定固定 schema，宽松匹配）。
 * @param {unknown} data
 */
export function extractStructuredFromApiResponse(data) {
  if (!data || typeof data !== 'object') return null;

  const candidates = [];
  const push = (x) => {
    const n = normalizeDimensionList(x);
    if (n) candidates.push(n);
  };

  const outputs = data.outputs;
  if (outputs && typeof outputs === 'object') {
    push(outputs.radar);
    push(outputs.scores);
    push(outputs.dimensions);
    push(outputs.evaluation_radar);
  }

  push(data.radar);
  push(data.scores);
  push(data.dimensions);
  push(data.evaluation_radar);
  push(data.evaluation_scores);

  return candidates.length ? candidates[0] : null;
}

/**
 * 从 Markdown 中用启发式正则提取「名称：数字分」类行（最多取前若干个配对成五维）。
 * @param {string} markdown
 */
export function tryParseScoresFromMarkdown(markdown) {
  if (!markdown || typeof markdown !== 'string') return null;

  const lines = markdown.split('\n');
  const pairs = [];
  const lineRe =
    /^[\s>*-]*(.{2,24}?)[：:]\s*(\d{1,3})(?:\s*(?:分|\/\s*100|\/100))?/u;

  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    const m = t.match(lineRe);
    if (m) {
      const label = m[1].replace(/^[-*]\s*/, '').trim();
      const value = clamp01to100(m[2]);
      if (label && label.length <= 20) {
        pairs.push({ label, value });
      }
    }
  }

  if (pairs.length < 3) {
    // 备选：全文内联「xx：88」
    const globalRe = /([\u4e00-\u9fa5a-zA-Z0-9（）]{2,12})[：:]\s*(\d{1,3})(?:\s*分)?/g;
    let gm;
    const seen = new Set();
    while ((gm = globalRe.exec(markdown)) !== null) {
      const label = gm[1].trim();
      const value = clamp01to100(gm[2]);
      const key = `${label}:${value}`;
      if (!seen.has(key)) {
        seen.add(key);
        pairs.push({ label, value });
      }
      if (pairs.length >= 8) break;
    }
  }

  if (pairs.length < 3) return null;

  // 去重同名取首次
  const uniq = [];
  const names = new Set();
  for (const p of pairs) {
    if (names.has(p.label)) continue;
    names.add(p.label);
    uniq.push(p);
    if (uniq.length >= 5) break;
  }

  if (uniq.length < 3) return null;

  return uniq.slice(0, 5);
}

/**
 * @param {{ label: string, value: number }[] | null} fromApi
 * @param {string} markdown
 */
export function buildRadarDimensions(fromApi, markdown) {
  const orderCanonical = (items) => {
    const byLabel = new Map(items.map((item) => [item.label, item]));
    const canonical = CANONICAL_LABELS.map((label) => byLabel.get(label)).filter(Boolean);
    if (canonical.length >= 3) return canonical;
    return items;
  };

  if (fromApi && fromApi.length >= 3) {
    return orderCanonical(fromApi).slice(0, 5);
  }
  const fromText = tryParseScoresFromMarkdown(markdown);
  if (fromText && fromText.length >= 3) {
    return orderCanonical(fromText);
  }
  return null;
}

/**
 * 从段落标题或正文首行提取分数展示用数字
 */
export function extractSectionScore(text) {
  if (!text) return null;
  const m = text.match(/(\d{1,3})\s*分/);
  if (m) return clamp01to100(m[1]);
  const m2 = text.match(/[:：]\s*(\d{1,3})(?:\s*分)?/);
  if (m2) return clamp01to100(m[2]);
  return null;
}

/**
 * 按二级标题将 Markdown 拆成多段，用于「详细评价」卡片分块展示。
 * @param {string} md
 * @returns {{ title: string, body: string }[]}
 */
export function splitMarkdownSections(md) {
  if (!md || !md.trim()) return [];
  const lines = md.split('\n');
  const sections = [];
  let title = '详细评价';
  let buf = [];

  const flush = () => {
    const body = buf.join('\n').trim();
    if (body) sections.push({ title, body });
    buf = [];
  };

  for (const line of lines) {
    if (/^##\s+/.test(line) && !line.startsWith('###')) {
      flush();
      title = line.replace(/^##\s+/, '').trim() || '详细评价';
      continue;
    }
    buf.push(line);
  }
  flush();

  if (sections.length === 0) {
    return [{ title: '详细评价', body: md.trim() }];
  }
  return sections;
}
