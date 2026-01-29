import React from 'react';
import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Archive, Settings, LogOut } from 'lucide-react';

export const Layout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Define paths where the bottom nav should be hidden (e.g., Login, Cashier if simpler view needed)
  // Requirement says: "Cashier page hides bottom nav" implies Cashier might be fullscreen or separate flow.
  // However, usually Cashier is a tab. Based on the prompt "Layout component checks route to show bottom nav (Cashier doesn't show, Management shows)", 
  // I will hide it for /cashier and / (login).
  const hideNavPaths = ['/', '/cashier', '/login'];
  const showNav = !hideNavPaths.includes(location.pathname);

  const navItems = [
    { icon: LayoutDashboard, label: '概览', path: '/dashboard' },
    { icon: ShoppingCart, label: '收银', path: '/cashier' },
    { icon: Archive, label: '库存', path: '/inventory' },
    { icon: Settings, label: '设置', path: '/settings' },
  ];

  return (
    <div className="flex flex-col h-screen w-full bg-zinc-100 dark:bg-zinc-950 text-zinc-900 dark:text-white overflow-hidden transition-colors duration-300">
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <Outlet />
      </div>

      {showNav && (
        <nav className="shrink-0 h-20 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex justify-around items-center px-2 pb-4 pt-2 z-50">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center justify-center w-full h-full gap-1 ${
                  isActive ? 'text-primary' : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'
                }`}
              >
                <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
};