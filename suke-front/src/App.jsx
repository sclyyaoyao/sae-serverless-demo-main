import { useCallback, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import {
  Upload,
  Button,
  Input,
  Card,
  Typography,
  Space,
  message,
  Spin,
  Alert,
  ConfigProvider,
} from 'antd';
import {
  PlayCircleOutlined,
  CheckCircleOutlined,
  DownloadOutlined,
  ClearOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import { runEvaluation, getFileProxyUrl, markdownForDisplay } from './services/api';
import { RadarChart } from './components/RadarChart';
import {
  buildRadarDimensions,
  extractSectionScore,
  splitMarkdownSections,
} from './utils/radarParse';
import './App.css';

const { Title, Text, Paragraph } = Typography;
const ESTIMATED_EVALUATION_MINUTES = 5;

/** 与用户主动「重置会话」对齐的浏览器端存储前缀（当前工程未写入，为未来预留）——非后端会话缓存 */
const CLIENT_EVAL_STORAGE_PREFIX = 'suke_patent_eval_';

/**
 * 清理可能存在的评估相关 localStorage/sessionStorage（仅前端）。
 * 与 Dify / 后端评估会话缓存无关。
 */
function clearFrontendEvaluationCaches() {
  for (const storage of [localStorage, sessionStorage]) {
    try {
      const keysToRemove = [];
      for (let i = 0; i < storage.length; i += 1) {
        const k = storage.key(i);
        if (k && k.startsWith(CLIENT_EVAL_STORAGE_PREFIX)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => storage.removeItem(k));
    } catch {
      // 隐私模式或禁用 storage 时忽略
    }
  }
}

function isRequestAborted(error) {
  return (
    axios.isCancel?.(error) ||
    error?.code === 'ERR_CANCELED' ||
    error?.name === 'CanceledError'
  );
}

function renderMarkdown(text) {
  if (!text) return null;
  return text.split('\n').map((line, i) => {
    if (line.startsWith('###')) {
      return (
        <h4 key={i} className="md-h4">
          {line.replace('###', '').trim()}
        </h4>
      );
    }
    if (line.startsWith('##')) {
      return <h3 key={i}>{line.replace('##', '').trim()}</h3>;
    }
    if (line.startsWith('- ')) {
      return (
        <li key={i} className="md-li">
          {line.replace('- ', '')}
        </li>
      );
    }
    if (line.startsWith('|')) {
      return (
        <div key={i} className="md-table-line">
          {line}
        </div>
      );
    }
    if (line.trim() === '') {
      return <br key={i} />;
    }
    return (
      <p key={i} className="md-p">
        {line}
      </p>
    );
  });
}

function DownloadButtons({ files = [] }) {
  if (!files.length) return null;
  return (
    <Space wrap className="result-files" size="middle">
      {files.map((f) => (
        <Button
          key={f.url}
          type="primary"
          icon={<DownloadOutlined />}
          href={getFileProxyUrl(f.url)}
          target="_blank"
          rel="noopener noreferrer"
        >
          下载 {f.name}
        </Button>
      ))}
    </Space>
  );
}

function DetailSection({ section }) {
  const score = extractSectionScore(`${section.title}\n${section.body}`);
  return (
    <article className="detail-section">
      <div className="detail-section-bar" aria-hidden />
      <div className="detail-section-body">
        <div className="detail-section-head">
          <Title level={4} className="detail-section-title">
            {section.title}
          </Title>
          {score !== null ? <span className="score-badge">{score} 分</span> : null}
        </div>
        <div className="markdown-content markdown-content--plain">{renderMarkdown(section.body)}</div>
      </div>
    </article>
  );
}

function ResultDashboard({ result, onReset }) {
  const [decisionDownloadsVisible, setDecisionDownloadsVisible] = useState(false);
  const [decisionDownloadError, setDecisionDownloadError] = useState('');
  const evaluationMarkdown = markdownForDisplay(result.evaluation?.markdown || '');
  const decisionMarkdown = markdownForDisplay(result.decision?.markdown || '');
  const combinedMarkdown = `${evaluationMarkdown}\n\n${decisionMarkdown}`.trim();
  const sections = splitMarkdownSections(evaluationMarkdown);
  const radarDimensions = buildRadarDimensions(result.structuredDimensions, combinedMarkdown);
  const evaluationFiles = result.evaluation?.files || [];
  const decisionFiles = result.decision?.files || [];

  const handleRevealDecisionDownloads = () => {
    if (decisionFiles.length === 0) {
      setDecisionDownloadError('未检测到决策报告文件');
      message.warning('未检测到决策报告文件');
      return;
    }
    setDecisionDownloadError('');
    setDecisionDownloadsVisible(true);
    message.success('已解锁决策报告下载');
  };

  return (
    <section className="result-dashboard" aria-label="评估结果">
      <div className="result-toolbar">
        <div>
          <Text className="eyebrow">评估完成</Text>
          <Title level={3} className="result-title">
            分析与建议
          </Title>
        </div>
        <Button size="middle" icon={<ClearOutlined />} onClick={onReset}>
          新分析
        </Button>
      </div>

      <div className="result-grid">
        <Card className="shell-card result-detail-card">
          <div className="result-card-heading">
            <CheckCircleOutlined className="result-card-icon" aria-hidden />
            <span>评估报告</span>
          </div>
          {evaluationFiles.length > 0 ? (
            <DownloadButtons files={evaluationFiles} />
          ) : (
            <div className="empty-panel empty-panel--compact">未检测到评估报告文件。</div>
          )}
          <div className="decision-download-panel">
            <Button
              type="primary"
              ghost
              icon={<DownloadOutlined />}
              onClick={handleRevealDecisionDownloads}
            >
              转化决策
            </Button>
            <Text type="secondary" className="decision-hint">
              后台已一次性完成评估与转化，点击后直接查看决策报告下载。
            </Text>
          </div>
          {decisionDownloadsVisible && (
            <div className="decision-files">
              <Text className="report-download-title">决策报告下载</Text>
              <DownloadButtons files={decisionFiles} />
            </div>
          )}
          {decisionDownloadError && (
            <Alert
              type="warning"
              showIcon
              className="decision-alert"
              message={decisionDownloadError}
            />
          )}
          {sections.length > 0 ? (
            <div className="detail-list">
              {sections.map((section, index) => (
                <DetailSection key={`${section.title}-${index}`} section={section} />
              ))}
            </div>
          ) : (
            <div className="empty-panel">暂无可展示的文字结论。</div>
          )}
        </Card>

        <Card className="shell-card radar-card">
          <div className="result-card-heading">
            <span className="radar-dot" aria-hidden />
            <span>评估雷达图</span>
          </div>
          {radarDimensions ? (
            <>
              <RadarChart dimensions={radarDimensions} />
              <div className="radar-score-list">
                {radarDimensions.map((item) => (
                  <div key={item.label} className="radar-score-item">
                    <span>{item.label}</span>
                    <strong>{item.value} 分</strong>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="radar-empty">
              <RadarChart dimensions={null} />
              <Text type="secondary">暂无结构化评分</Text>
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}

function App() {
  const [files, setFiles] = useState([]);
  const [certify, setCertify] = useState('国内领先');
  const [award, setAward] = useState('无');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const abortRef = useRef(null);

  const resetForNewAnalysis = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    clearFrontendEvaluationCaches();
    setFiles([]);
    setCertify('国内领先');
    setAward('无');
    setLoading(false);
    setProgress('');
    setResult(null);
    setError(null);
    message.success('已清除状态，可开始新分析');
  }, []);

  const handleFileChange = ({ fileList }) => {
    setFiles(fileList);
    setResult(null);
    setError(null);
  };

  const handleSubmit = async () => {
    if (files.length === 0) {
      message.error('请先上传材料文件');
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setProgress(`正在启动评估，预计用时约 ${ESTIMATED_EVALUATION_MINUTES} 分钟...`);
    setResult(null);
    setError(null);
    message.info(`预计用时约 ${ESTIMATED_EVALUATION_MINUTES} 分钟，你可以暂时离开，任务完成后可查看结果`);

    try {
      const evaluationResult = await runEvaluation(
        files,
        certify,
        award,
        setProgress,
        { signal: controller.signal }
      );
      setResult(evaluationResult);
      message.success('评估完成');
    } catch (err) {
      if (isRequestAborted(err)) {
        return;
      }
      console.error('Evaluation error:', err);
      setError(err.message || '评估过程出错，请重试');
      message.error('评估失败，请查看页面提示');
    } finally {
      setLoading(false);
      setProgress('');
      abortRef.current = null;
    }
  };

  const showReset = files.length > 0 || result || error || loading || certify !== '国内领先' || award !== '无';
  const selectedFileName = useMemo(() => files[0]?.name || files[0]?.originFileObj?.name || '', [files]);

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#4f46e5',
          borderRadius: 10,
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        },
      }}
    >
      <div className="app-container">
        <header className="app-header" role="banner">
          <div className="header-inner">
            <div className="header-brand">
              <div className="logo-mark" aria-hidden>
                蜀
              </div>
              <div className="header-titles">
                <Title level={2} className="header-title">
                  蜀科科技成果评估
                </Title>
                <Text className="header-subtitle">
                  交通领域科技成果智能评估与转化决策辅助
                </Text>
              </div>
            </div>
            <div className="header-actions">
              {showReset && (
                <Button
                  type="default"
                  icon={<ClearOutlined />}
                  onClick={resetForNewAnalysis}
                  className="btn-reset"
                  aria-label="清除并开始新分析"
                >
                  清除并开始新分析
                </Button>
              )}
            </div>
          </div>
        </header>

        <main className="app-main" aria-busy={loading}>
          <section className="hero-section">
            <div className="hero-copy">
              <Title level={1} className="hero-title">
                我是 Suke，很高兴见到你!
              </Title>
              <Paragraph className="hero-desc">
                上传成果材料，系统将结合鉴定结论与获奖情况，辅助完成交通领域科技成果价值评估。
              </Paragraph>
            </div>
          </section>

          <Card className="shell-card input-card">
            <div className="card-heading">
              <Title level={3} className="card-heading-title">
                提交材料
              </Title>
              <Text type="secondary" className="card-heading-desc">
                请上传一份成果材料，并补充基础评价信息。
              </Text>
            </div>

            <div className="submit-layout">
              <div className="upload-panel">
                <span className="field-label">上传材料</span>
                <Upload.Dragger
                  aria-label="上传成果材料"
                  maxCount={1}
                  fileList={files}
                  onChange={handleFileChange}
                  beforeUpload={() => false}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp"
                  className="suke-uploader"
                >
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined />
                  </p>
                  <p className="upload-title">{selectedFileName || '点击或拖拽文件到此处'}</p>
                  <p className="upload-hint">支持 PDF、Word、Excel 及常见图片格式，单次上传一份文件。</p>
                </Upload.Dragger>
              </div>

              <Space direction="vertical" size="large" className="form-stack">
                <div className="field-block">
                  <label className="field-label" htmlFor="certify-input">
                    成果鉴定评价结论
                  </label>
                  <Input
                    id="certify-input"
                    placeholder="如：国内领先、国际先进"
                    value={certify}
                    onChange={(e) => setCertify(e.target.value)}
                    autoComplete="off"
                    size="large"
                  />
                </div>

                <div className="field-block">
                  <label className="field-label" htmlFor="award-input">
                    科技奖励获奖情况
                  </label>
                  <Input
                    id="award-input"
                    placeholder="如：无、省部级二等奖"
                    value={award}
                    onChange={(e) => setAward(e.target.value)}
                    autoComplete="off"
                    size="large"
                  />
                </div>

                <Space direction="vertical" size="middle" className="actions-row">
                  <Button
                    type="primary"
                    size="large"
                    icon={<PlayCircleOutlined />}
                    onClick={handleSubmit}
                    loading={loading}
                    block
                    className="btn-primary-cta"
                  >
                    {loading ? '评估中…' : '开始评估'}
                  </Button>

                  {(files.length > 0 || loading || result || error) && (
                    <Button
                      type="default"
                      icon={<ClearOutlined />}
                      onClick={resetForNewAnalysis}
                      className="btn-reset-inline"
                      aria-label="重置表单与结果"
                    >
                      重置
                    </Button>
                  )}
                </Space>
              </Space>
            </div>

            {loading && progress && (
              <div className="progress-region" aria-live="polite">
                <Alert
                  type="info"
                  showIcon
                  className="estimate-alert"
                  message={`预计用时约 ${ESTIMATED_EVALUATION_MINUTES} 分钟`}
                  description="你可以暂时离开，任务完成后回到页面查看评估报告与转化决策结果。"
                />
                <Spin tip={progress} />
              </div>
            )}
          </Card>

          {error && (
            <Alert
              type="error"
              showIcon
              className="error-alert"
              message="评估失败"
              description={error}
              action={
                <Button size="small" type="primary" onClick={() => setError(null)}>
                  关闭提示
                </Button>
              }
            />
          )}

          {result && <ResultDashboard result={result} onReset={resetForNewAnalysis} />}
        </main>

        <footer className="app-footer" role="contentinfo">
          <Text type="secondary" className="footer-text">
            依据 GB/T 44731-2024《科技成果评估规范》｜GB/T 45997-2025 五元价值评估标准
          </Text>
        </footer>
      </div>
    </ConfigProvider>
  );
}

export default App;
