import { ArrowUp, ChartNoAxesColumn, Dumbbell, Home, LayoutDashboard, LogOut, Moon, Settings, Sun } from 'lucide-react';
import React from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const moduleNav = [
  { to: '/dashboard', label: '首页', icon: LayoutDashboard },
  { to: '/today', label: '今日任务', icon: Home },
  { to: '/ability', label: '能力训练', icon: Dumbbell },
  { to: '/review-data', label: '复盘数据', icon: ChartNoAxesColumn },
  { to: '/services', label: '设置服务', icon: Settings },
];

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
  }, [location.pathname, location.search]);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <main className="app-shell">
      <header className="top-app-bar">
        <div className="mx-auto flex w-full max-w-[1540px] flex-col gap-3 px-4 py-3 md:px-8 xl:px-12">
          <div className="flex items-center justify-between gap-3">
            <BrandBlock />
            <div className="flex items-center gap-2">
              <button aria-label={dark ? '切换浅色模式' : '切换深色模式'} className="icon-button" onClick={() => setDark((value) => !value)} type="button">
                {dark ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button aria-label={`退出账号 ${user?.email ?? ''}`} className="icon-button" onClick={handleLogout} type="button">
                <LogOut size={18} />
              </button>
            </div>
          </div>

          <nav className="top-module-nav" aria-label="主功能导航">
            {moduleNav.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.to;
              return (
                <NavLink className={`top-module-link ${isActive ? 'top-module-link-active' : ''}`} key={item.to} to={item.to}>
                  <Icon size={17} />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </header>

      <div className="mx-auto min-h-screen w-full max-w-[1540px] px-4 pb-24 pt-5 md:px-8 md:pb-10 xl:px-12">
        <Outlet />
      </div>

      {showBackTop && (
        <button
          aria-label="回到页面顶部"
          className="back-top-button"
          onClick={() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            document.documentElement.scrollTo?.({ top: 0, behavior: 'smooth' });
          }}
          type="button"
        >
          <ArrowUp size={18} />
          <span>顶部</span>
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
        <p className="text-xs font-bold uppercase tracking-normal" style={{ color: 'var(--muted)' }}>
          AI English
        </p>
        <h1 className="text-xl font-semibold tracking-normal" style={{ color: 'var(--ink)' }}>
          智能英语学习
        </h1>
      </div>
    </NavLink>
  );
}
