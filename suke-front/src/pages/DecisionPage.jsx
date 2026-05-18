import { Link } from 'react-router-dom';
import { Card, Typography, Button, Space } from 'antd';
import { ArrowLeftOutlined, BulbOutlined } from '@ant-design/icons';
import { AppChromeShell } from '../components/AppChromeShell';

const { Title, Paragraph, Text } = Typography;

/**
 * 第二阶段「转化决策」说明页：仅前端路由占位，不伪造后端数据。
 */
export default function DecisionPage() {
  return (
    <AppChromeShell showReset={false}>
      <main className="app-main app-main--narrow">
        <Card className="shell-card decision-intro-card">
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
              <Title level={3} style={{ marginTop: 0 }}>
                <BulbOutlined style={{ marginRight: 8, color: '#7c3aed' }} />
                转化决策报告
              </Title>
              <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                请先于首页完成专利材料上传与智能评估。工作流完成后，可在结果区点击转化决策查看已有决策报告下载。
              </Paragraph>
            </div>
            <div>
              <Text strong>下一步</Text>
              <Paragraph>
                返回工作台上传专利文件并获取评估结论后，可将关键结论用于转化路径研判与对内汇报材料整理。
              </Paragraph>
            </div>
            <Link to="/">
              <Button type="primary" size="large" icon={<ArrowLeftOutlined />}>
                返回专利评估工作台
              </Button>
            </Link>
          </Space>
        </Card>
      </main>
    </AppChromeShell>
  );
}
