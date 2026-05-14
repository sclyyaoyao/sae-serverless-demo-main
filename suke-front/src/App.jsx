import { useState } from 'react';
import { Upload, Button, Input, Card, Typography, Space, message, Spin, Result } from 'antd';
import {
  UploadOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { runEvaluation, getFileProxyUrl, markdownForDisplay } from './services/api';
import './App.css';

const { Title, Text, Paragraph } = Typography;

function renderMarkdown(text) {
  if (!text) return null;
  return text.split('\n').map((line, i) => {
    if (line.startsWith('###')) {
      return (
        <h4 key={i} style={{ marginTop: 16, marginBottom: 8 }}>
          {line.replace('###', '').trim()}
        </h4>
      );
    }
    if (line.startsWith('##')) {
      return (
        <h3
          key={i}
          style={{
            marginTop: 20,
            marginBottom: 12,
            borderBottom: '1px solid #eee',
            paddingBottom: 8,
          }}
        >
          {line.replace('##', '').trim()}
        </h3>
      );
    }
    if (line.startsWith('- ')) {
      return (
        <li key={i} style={{ marginLeft: 20 }}>
          {line.replace('- ', '')}
        </li>
      );
    }
    if (line.startsWith('|')) {
      return (
        <div key={i} style={{ fontFamily: 'monospace', fontSize: 12, marginLeft: 20 }}>
          {line}
        </div>
      );
    }
    if (line.trim() === '') {
      return <br key={i} />;
    }
    return (
      <p key={i} style={{ margin: '4px 0' }}>
        {line}
      </p>
    );
  });
}

function ResultPanel({ title, icon, block }) {
  const { markdown, previewText, files } = block;
  const [expanded, setExpanded] = useState(false);
  const displayMarkdown = markdownForDisplay(markdown);
  const canToggle = Boolean(displayMarkdown.trim());
  const previewFallback =
    !previewText && canToggle
      ? '点击下方「展开全文」查看详细结论。'
      : !previewText && files.length > 0
        ? '评估报告已生成，请使用上方按钮下载 PDF。'
        : '（暂无文字结论）';

  return (
    <div className="result-section">
      <Title level={4}>
        {icon} {title}
      </Title>
      {files.length > 0 && (
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
      )}
      <div className="markdown-content">
        {!expanded && (
          <Paragraph className="result-preview" ellipsis={false}>
            {previewText || previewFallback}
          </Paragraph>
        )}
        {expanded && canToggle && renderMarkdown(displayMarkdown)}
        {canToggle && (
          <Button type="link" size="small" onClick={() => setExpanded((v) => !v)} style={{ paddingLeft: 0 }}>
            {expanded ? '收起全文' : '展开全文'}
          </Button>
        )}
      </div>
    </div>
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

  const handleFileChange = ({ fileList }) => {
    setFiles(fileList);
    setResult(null);
    setError(null);
  };

  const handleSubmit = async () => {
    if (files.length === 0) {
      message.error('请上传至少一个专利文件');
      return;
    }

    setLoading(true);
    setProgress('正在启动评估...');
    setResult(null);
    setError(null);

    try {
      const evaluationResult = await runEvaluation(files, certify, award, setProgress);
      setResult(evaluationResult);

      message.success('评估完成');

    } catch (err) {
      console.error('Evaluation error:', err);
      setError(err.message || '评估过程出错，请重试');
      message.error('评估失败');
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <Title level={2} style={{ margin: 0, color: '#fff' }}>蜀科科技成果评估系统</Title>
        <Text style={{ color: 'rgba(255,255,255,0.8)' }}>
          交通领域科技成果智能评估与转化决策辅助
        </Text>
      </header>

      <main className="app-main">
        <Card className="input-card">
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>上传专利文件</Text>
              <Upload
                multiple
                fileList={files}
                onChange={handleFileChange}
                beforeUpload={() => false}
                accept=".pdf,.doc,.docx,.xls,.xlsx"
              >
                <Button icon={<UploadOutlined />}>选择文件</Button>
              </Upload>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                支持 PDF、DOC、DOCX、XLS、XLSX 格式
              </Text>
            </div>

            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>成果鉴定评价结论</Text>
              <Input
                placeholder="如：国内领先、国际先进"
                value={certify}
                onChange={(e) => setCertify(e.target.value)}
              />
            </div>

            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>科技奖励获奖情况</Text>
              <Input
                placeholder="如：无、省部级二等奖"
                value={award}
                onChange={(e) => setAward(e.target.value)}
              />
            </div>

            <Button
              type="primary"
              size="large"
              icon={<PlayCircleOutlined />}
              onClick={handleSubmit}
              loading={loading}
              block
            >
              {loading ? '评估中...' : '开始评估'}
            </Button>

            {loading && progress && (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <Spin tip={progress} />
              </div>
            )}
          </Space>
        </Card>

        {result && (
          <Card className="result-card">
            <ResultPanel
              title="评估结果"
              icon={<CheckCircleOutlined />}
              block={result.evaluation}
            />
            <ResultPanel title="转化决策建议" block={result.decision} />
          </Card>
        )}

        {error && (
          <Result
            status="error"
            title="评估失败"
            subTitle={error}
            extra={
              <Button type="primary" onClick={() => setError(null)}>
                重试
              </Button>
            }
          />
        )}
      </main>

      <footer className="app-footer">
        <Text type="secondary">
          依据 GB/T 44731-2024《科技成果评估规范》 | GB/T 45997-2025 五元价值评估标准
        </Text>
      </footer>
    </div>
  );
}

export default App;
