import {
  BookOpen,
  ChartNoAxesColumn,
  ClipboardCheck,
  Home,
  Library,
  LogOut,
  Moon,
  NotebookTabs,
  RotateCcw,
  Settings,
  Sun,
} from 'lucide-react';
import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const links = [
  { to: '/dashboard', label: '首页', icon: Home },
  { to: '/word-books', label: '词库', icon: Library },
  { to: '/study', label: '新词', icon: BookOpen },
  { to: '/review', label: '复习', icon: RotateCcw },
  { to: '/mistakes', label: '错词', icon: NotebookTabs },
  { to: '/quiz', label: '测试', icon: ClipboardCheck },
  { to: '/stats', label: '统计', icon: ChartNoAxesColumn },
  { to: '/settings', label: '设置', icon: Settings },
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dark, setDark] = React.useState(() => localStorage.getItem('theme') === 'dark');

  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <main className="app-shell">
      <div className="mx-auto grid min-h-screen w-full max-w-[1540px] grid-cols-1 md:grid-cols-[260px_1fr]">
        <aside
          className="border-b px-4 py-4 backdrop-blur md:sticky md:top-0 md:h-screen md:border-b-0 md:border-r md:px-5 md:py-6"
          style={{ borderColor: 'var(--line)', background: 'color-mix(in srgb, var(--paper) 94%, transparent)' }}
        >
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#204f35] text-lg font-black text-white shadow-lg shadow-green-900/10">
              W
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--muted)' }}>
                Vocabulary
              </p>
              <h1 className="text-xl font-semibold tracking-normal" style={{ color: 'var(--ink)' }}>
                单词学习
              </h1>
            </div>
          </div>

          <nav className="grid grid-cols-4 gap-2 md:grid-cols-1">
            {links.map((link) => {
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

          <div className="mt-6 hidden rounded-lg border p-4 md:block" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
            <p className="text-xs font-bold" style={{ color: 'var(--muted)' }}>当前账号</p>
            <p className="mt-1 truncate text-sm font-semibold" style={{ color: 'var(--ink)' }}>{user?.email}</p>
            <button className="button-secondary mt-3 w-full" onClick={() => setDark((value) => !value)} type="button">
              {dark ? <Sun size={16} /> : <Moon size={16} />}
              {dark ? '浅色模式' : '暗色模式'}
            </button>
            <button className="button-secondary mt-2 w-full" onClick={handleLogout} type="button">
              <LogOut size={16} />
              退出登录
            </button>
          </div>
        </aside>

        <section className="min-w-0 px-4 py-5 md:px-8 md:py-8 xl:px-12">
          <Outlet />
        </section>
      </div>
    </main>
  );
}
