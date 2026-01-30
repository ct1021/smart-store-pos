import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, ArrowRight, User, Lock } from 'lucide-react';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      navigate('/dashboard');
    }, 800);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-zinc-950 text-white relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-[-20%] right-[-20%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="w-full max-w-sm z-10 flex flex-col gap-8">
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-800 flex items-center justify-center shadow-2xl shadow-primary/20">
            <Store size={40} className="text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-center">
            Smart Store <span className="text-primary">POS</span>
          </h1>
          <p className="text-zinc-500 text-sm">小卖部智能进销存系统</p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div className="space-y-4">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User size={20} className="text-zinc-500 group-focus-within:text-primary transition-colors" />
              </div>
              <input
                type="text"
                placeholder="用户名 / 店长ID"
                className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl py-4 pl-12 pr-4 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-zinc-600"
                defaultValue="admin"
              />
            </div>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock size={20} className="text-zinc-500 group-focus-within:text-primary transition-colors" />
              </div>
              <input
                type="password"
                placeholder="密码"
                className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl py-4 pl-12 pr-4 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-zinc-600"
                defaultValue="password"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button type="button" className="text-xs text-zinc-500 hover:text-zinc-300">
              忘记密码?
            </button>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="mt-4 w-full bg-primary hover:bg-primary-hover text-white font-bold py-4 rounded-xl shadow-lg shadow-red-900/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <span className="animate-pulse">登录中...</span>
            ) : (
              <>
                进入系统 <ArrowRight size={20} />
              </>
            )}
          </button>
        </form>
      </div>
      
      <div className="absolute bottom-8 text-zinc-700 text-xs">
        v2.0.4 Release
      </div>
    </div>
  );
};

export default Login;