import {
  ArrowUp,
  Award,
  Bell,
  BarChart3,
  BookOpen,
  ChartNoAxesColumn,
  ClipboardCheck,
  Crown,
  FileText,
  Home,
  Library,
  LifeBuoy,
  LogOut,
  Moon,
  NotebookTabs,
  PanelsTopLeft,
  Route,
  RotateCcw,
  Settings,
  Sparkles,
  Star,
  Sun,
} from 'lucide-react';
import React from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const links = [
  { to: '/dashboard', label: '首页', icon: Home },
  { to: '/word-books', label: '词库', icon: Library },
  { to: '/study', label: '新词', icon: BookOpen },
  { to: '/review', label: '复习', icon: RotateCcw },
  { to: '/mistakes', label: '错词', icon: NotebookTabs },
  { to: '/favorites', label: '收藏', icon: Star },
  { to: '/quiz', label: '测试', icon: ClipboardCheck },
  { to: '/stats', label: '统计', icon: ChartNoAxesColumn },
  { to: '/learning-report', label: '报告', icon: BarChart3 },
  { to: '/check-in', label: '打卡', icon: Award },
  { to: '/learning-plan', label: '学习计划', icon: Route },
  { to: '/learning-settings', label: '学习设置', icon: Settings },
  { to: '/notifications', label: '消息', icon: Bell },
];

const extraLinks = [
  { to: '/onboarding', label: '学习引导', icon: Sparkles },
  { to: '/membership', label: '会员', icon: Crown },
  { to: '/support', label: '反馈', icon: LifeBuoy },
  { to: '/legal', label: '合规', icon: FileText },
  { to: '/admin', label: '后台', icon: PanelsTopLeft },
];

const navigationLinks = [...links, ...extraLinks];
const mobileLinks = navigationLinks;

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dark, setDark] = React.useState(() => localStorage.getItem('theme') === 'dark');
  const [showBackTop, setShowBackTop] = React.useState(false);

  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  React.useEffect(() => {
    function handleScroll() {
      const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
      const pageHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      setShowBackTop(pageHeight > viewportHeight + 260 && scrollTop > 160);
    }
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    const timer = window.setTimeout(handleScroll, 120);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [location.pathname]);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <main className="app-shell">
      <div className="mx-auto grid min-h-screen w-full max-w-[1540px] grid-cols-1 md:grid-cols-[260px_1fr]">
        <aside
          className="hidden border-r px-5 py-6 backdrop-blur md:sticky md:top-0 md:block md:h-screen"
          style={{ borderColor: 'var(--line)', background: 'color-mix(in srgb, var(--paper) 94%, transparent)' }}
        >
          <BrandBlock />

          <nav className="mt-6 grid gap-2">
            {navigationLinks.map((link) => {
              const Icon = link.icon;
              return (
                <NavLink
                  className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
                  key={link.to}
                  to={link.to}
                >
                  <Icon size={17} />
                  {link.label}
                </NavLink>
              );
            })}
          </nav>

          <AccountPanel
            dark={dark}
            email={user?.email}
            onLogout={handleLogout}
            onToggleTheme={() => setDark((value) => !value)}
          />
        </aside>

        <section className="min-w-0 px-4 pb-24 pt-4 md:px-8 md:py-8 xl:px-12">
          <MobileTopBar
            dark={dark}
            email={user?.email}
            onLogout={handleLogout}
            onToggleTheme={() => setDark((value) => !value)}
          />
          <Outlet />
        </section>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex gap-1 overflow-x-auto border-t px-2 py-2 backdrop-blur md:hidden"
        style={{ borderColor: 'var(--line)', background: 'color-mix(in srgb, var(--paper) 94%, transparent)' }}
      >
        {mobileLinks.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              className={({ isActive }) => `mobile-nav-link ${isActive ? 'mobile-nav-link-active' : ''}`}
              key={link.to}
              to={link.to}
            >
              <Icon size={18} />
              <span>{link.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {showBackTop && (
        <button
          aria-label="回到页面顶部"
          className="fixed bottom-24 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-lg border shadow-lg md:bottom-6 md:right-6"
          onClick={() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            document.documentElement.scrollTo?.({ top: 0, behavior: 'smooth' });
          }}
          style={{ borderColor: 'var(--line)', background: 'var(--paper)', color: 'var(--green)' }}
          type="button"
        >
          <ArrowUp size={20} />
        </button>
      )}
    </main>
  );
}

function BrandBlock() {
  return (
    <NavLink
      aria-label="返回首页"
      className="flex min-w-0 items-center gap-3 rounded-lg transition hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
      to="/dashboard"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#204f35] text-lg font-black text-white shadow-lg shadow-green-900/10">
        W
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--muted)' }}>
          Vocabulary
        </p>
        <h1 className="text-xl font-semibold tracking-normal" style={{ color: 'var(--ink)' }}>
          单词学习
        </h1>
      </div>
    </NavLink>
  );
}

function AccountPanel({
  dark,
  email,
  onToggleTheme,
  onLogout,
}: {
  dark: boolean;
  email?: string;
  onToggleTheme: () => void;
  onLogout: () => void;
}) {
  return (
    <div className="mt-6 rounded-lg border p-4" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
      <p className="text-xs font-bold" style={{ color: 'var(--muted)' }}>当前账号</p>
      <p className="mt-1 truncate text-sm font-semibold" style={{ color: 'var(--ink)' }}>{email}</p>
      <button className="button-secondary mt-3 w-full" onClick={onToggleTheme} type="button">
        {dark ? <Sun size={16} /> : <Moon size={16} />}
        {dark ? '浅色模式' : '深色模式'}
      </button>
      <button className="button-secondary mt-2 w-full" onClick={onLogout} type="button">
        <LogOut size={16} />
        退出登录
      </button>
    </div>
  );
}

function MobileTopBar({
  dark,
  email,
  onToggleTheme,
  onLogout,
}: {
  dark: boolean;
  email?: string;
  onToggleTheme: () => void;
  onLogout: () => void;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3 md:hidden">
      <BrandBlock />
      <div className="flex items-center gap-2">
        <button aria-label={dark ? '切换浅色模式' : '切换深色模式'} className="icon-button" onClick={onToggleTheme} type="button">
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button aria-label={`退出账号 ${email ?? ''}`} className="icon-button" onClick={onLogout} type="button">
          <LogOut size={18} />
        </button>
      </div>
    </div>
  );
}
