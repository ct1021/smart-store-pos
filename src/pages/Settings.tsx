import React from 'react';
import { Bluetooth, ChevronRight, User, Moon, Sun, Smartphone, Laptop } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../components/ThemeContext';

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 pb-24 transition-colors duration-300">
      <header className="px-6 py-6 sticky top-0 bg-zinc-100/80 dark:bg-zinc-950/80 backdrop-blur-md z-10">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">设置</h1>
      </header>

      <div className="px-6 space-y-6">
        {/* Profile Card */}
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl flex items-center justify-between border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center border border-zinc-200 dark:border-zinc-700">
                    <User size={28} className="text-zinc-500 dark:text-zinc-400" />
                </div>
                <div>
                    <h3 className="font-bold text-zinc-900 dark:text-white text-lg">张店长</h3>
                    <p className="text-zinc-500 text-xs">Store Manager</p>
                </div>
            </div>
            <button 
                onClick={() => navigate('/')}
                className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-bold px-3 py-2 rounded-lg border border-red-100 dark:border-red-500/20"
            >
                退出
            </button>
        </div>

        {/* Appearance Settings */}
         <div>
            <h3 className="text-zinc-500 text-xs font-bold uppercase ml-2 mb-2">系统偏好</h3>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <button 
                    onClick={toggleTheme}
                    className="w-full p-4 flex justify-between items-center active:bg-zinc-50 dark:active:bg-zinc-800/50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-purple-500/20 text-purple-400' : 'bg-orange-100 text-orange-500'}`}>
                            {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
                        </div>
                        <span className="text-zinc-900 dark:text-white font-medium">界面主题</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500">{theme === 'dark' ? '深色模式' : '浅色模式'}</span>
                        <ChevronRight size={16} className="text-zinc-300" />
                    </div>
                </button>
            </div>
        </div>

        {/* Bluetooth Devices */}
        <div>
            <div className="flex justify-between items-end mb-2 ml-2">
                <h3 className="text-zinc-500 text-xs font-bold uppercase">蓝牙设备列表</h3>
                <span className="text-[10px] text-primary animate-pulse font-medium">搜索中...</span>
            </div>
            
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                {/* Connected Device */}
                <div className="p-4 flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                            <Bluetooth size={16} />
                        </div>
                        <div>
                            <div className="text-zinc-900 dark:text-white font-medium text-sm">XP-58 热敏打印机</div>
                            <div className="text-zinc-400 text-[10px]">MAC: 00:1A:7D:DA:71:13</div>
                        </div>
                    </div>
                    <span className="text-xs text-green-500 font-medium bg-green-100 dark:bg-green-500/10 px-2 py-1 rounded-md">已连接</span>
                </div>

                {/* Available Device 1 */}
                 <div className="p-4 flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400">
                            <Smartphone size={16} />
                        </div>
                        <div>
                            <div className="text-zinc-900 dark:text-white font-medium text-sm">Scanner Gun 8820</div>
                            <div className="text-zinc-400 text-[10px]">MAC: 4F:22:90:11:00:2A</div>
                        </div>
                    </div>
                    <button className="text-xs text-primary font-bold px-3 py-1.5 bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors">连接</button>
                </div>

                 {/* Available Device 2 */}
                 <div className="p-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400">
                            <Laptop size={16} />
                        </div>
                        <div>
                            <div className="text-zinc-900 dark:text-white font-medium text-sm">Store PC (Admin)</div>
                            <div className="text-zinc-400 text-[10px]">MAC: 1C:3B:55:92:44:88</div>
                        </div>
                    </div>
                    <button className="text-xs text-primary font-bold px-3 py-1.5 bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors">连接</button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;