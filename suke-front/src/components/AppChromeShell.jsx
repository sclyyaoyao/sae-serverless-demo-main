import { useNavigate } from 'react-router-dom';
import { CloudOutlined, LogoutOutlined, UnorderedListOutlined, ClearOutlined } from '@ant-design/icons';
import { Button, Typography } from 'antd';

const { Text } = Typography;

const FOOTER_COMPANY = '四川蜀科专利代理有限公司';

export function AppChromeShell({ children, showReset, onReset }) {
  const navigate = useNavigate();

  const displayName = (() => {
    try {
      const k = 'suke_guest_id';
      let id = sessionStorage.getItem(k);
      if (!id) {
        id = Math.random().toString(36).slice(2, 8);
        sessionStorage.setItem(k, id);
      }
      return `用户 ${id}`;
    } catch {
      return '用户';
    }
  })();

  const handleLogout = () => {
    try {
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
    navigate('/', { replace: true });
    window.location.reload();
  };

  return (
    <div className="app-container app-container--workbench">
      <header className="app-header suke-topbar" role="banner">
        <div className="header-inner suke-topbar-inner">
          <div className="suke-topbar-left">
            <div className="suke-brand-cloud">
              <CloudOutlined className="suke-cloud-icon" aria-hidden />
              <span className="suke-logo-dot">蜀</span>
            </div>
            <div className="suke-greeting">
              <span className="suke-greeting-main">我是 Suke，很高兴见到你!</span>
              <Text type="secondary" className="suke-greeting-sub">
                蜀科科技成果智能评估
              </Text>
            </div>
          </div>
          <div className="suke-topbar-right">
            <Text className="suke-user-pill">{displayName}</Text>
            <Button type="text" className="suke-topbar-link" icon={<UnorderedListOutlined />}>
              任务管理
            </Button>
            {showReset ? (
              <Button
                type="text"
                className="suke-topbar-link"
                icon={<ClearOutlined />}
                onClick={onReset}
                aria-label="清除并开始新分析"
              >
                清除并开始新分析
              </Button>
            ) : null}
            <Button type="text" className="suke-topbar-link suke-exit" icon={<LogoutOutlined />} onClick={handleLogout}>
              退出
            </Button>
          </div>
        </div>
      </header>

      {children}

      <footer className="app-footer suke-footer" role="contentinfo">
        <Text type="secondary" className="footer-text footer-company">
          {FOOTER_COMPANY}
        </Text>
        <Text type="secondary" className="footer-text footer-standards">
          依据 GB/T 44731-2024《科技成果评估规范》｜GB/T 45997-2025 五元价值评估标准
        </Text>
      </footer>
    </div>
  );
}
