import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Mic, ScanLine, Package, TrendingUp, BarChart3, Bell, X, Search, Clock, ChevronLeft, Plus, FileText, CreditCard, Wallet, Smartphone, Minus, Check, Calculator, ArrowUp, ChevronRight, Tag, MessageSquare, PieChart, Calendar, DollarSign, ArrowRight, Trash2, CalendarRange, Edit3, Truck, AlertTriangle, LayoutGrid, List, Receipt } from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';
import { useNavigate } from 'react-router-dom';
import { useData, Order, Product, Expense } from '../components/DataProvider';

// Helper Types for Dashboard Logic
interface DailyStat {
    date: string; // "MM-DD"
    fullDate: string; // "YYYY-MM-DD"
    day: string; // "周X"
    sales: number;
    profit: number;
    orderCount: number;
    expenses: number; // Renamed from restock to generic expenses
}

interface Notification {
  id: number;
  title: string;
  desc: string;
  time: string;
  type: 'order' | 'system' | 'alert' | 'expense';
  read: boolean;
  data?: any;
}

const ManagementDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { orders, products, expenses, addExpense, deleteExpense, addOrder } = useData();
  
  const currentDateStr = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });
  const todayStr = new Date().toISOString().split('T')[0];
  
  // State
  const [activeModal, setActiveModal] = useState<null | 'voice' | 'scan' | 'allOrders' | 'orderDetail' | 'manualOrder' | 'notifications' | 'finance' | 'calendar' | 'dayDetail'>(null);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedDayStat, setSelectedDayStat] = useState<DailyStat | null>(null);
  const [currentDayOrders, setCurrentDayOrders] = useState<Order[]>([]); 
  const [currentDayExpenses, setCurrentDayExpenses] = useState<Expense[]>([]);
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);

  // Calendar State
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarViewMode, setCalendarViewMode] = useState<'week' | 'month' | 'year'>('month');

  // Misc State
  const [isListening, setIsListening] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState<number[]>([]);
  const [showExpenseEditor, setShowExpenseEditor] = useState(false);
  const [newExpense, setNewExpense] = useState({ name: '', amount: '' });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [notifFilter, setNotifFilter] = useState<'all' | 'order' | 'alert' | 'expense' | 'system'>('all');
  const [voiceMode, setVoiceMode] = useState<'sale' | 'restock'>('sale');
  
  // Manual Order State
  const [manualNote, setManualNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'wechat' | 'alipay' | 'cash'>('wechat');
  
  interface CartItem {
      productId: number;
      qty: number;
      overridePrice?: number;
  }
  const [manualCart, setManualCart] = useState<{ [id: number]: CartItem }>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Camera Logic
  useEffect(() => {
    let stream: MediaStream | null = null;
    if (activeModal === 'scan') {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(s => {
          stream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch(err => console.error("Camera permission denied", err));
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [activeModal]);

  // --- DYNAMIC DATA AGGREGATION ---

  // 1. Calculate Daily Stats from ORDERS and EXPENSES
  const dailyStatsMap = useMemo(() => {
      const stats = new Map<string, DailyStat>();
      
      const getOrInitStat = (dateKey: string, dateObj: Date) => {
          if (!stats.has(dateKey)) {
              const dayLabel = dateObj.toLocaleDateString('zh-CN', { weekday: 'short' });
              stats.set(dateKey, {
                  date: `${dateObj.getMonth()+1}-${dateObj.getDate()}`,
                  fullDate: dateKey,
                  day: dayLabel,
                  sales: 0,
                  profit: 0,
                  orderCount: 0,
                  expenses: 0
              });
          }
          return stats.get(dateKey)!;
      };

      // Process Orders
      orders.forEach(order => {
          const date = new Date(order.timestamp);
          const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
          const stat = getOrInitStat(dateKey, date);
          
          stat.sales += order.amount;
          stat.orderCount += 1;
          
          // Calculate Profit: Sum of (ItemPrice - ItemCost) * Qty
          const orderProfit = order.details.reduce((acc, item) => {
              return acc + ((item.price - item.cost) * item.qty);
          }, 0);
          stat.profit += orderProfit;
      });

      // Process Expenses (Restock, Utilities, etc.)
      expenses.forEach(exp => {
          const dateKey = exp.date;
          // Parse date strictly from string to avoid timezone issues
          const [y, m, d] = dateKey.split('-').map(Number);
          const dateObj = new Date(y, m - 1, d);
          
          const stat = getOrInitStat(dateKey, dateObj);
          stat.expenses += exp.amount;
      });

      return stats;
  }, [orders, expenses]);

  // Convert Map to sorted Array for Charts/Lists (Last 7 Days generally)
  const recentDailyStats = useMemo(() => {
      const sortedKeys = Array.from(dailyStatsMap.keys()).sort();
      // If empty, generate at least one dummy for today so UI doesn't break
      if (sortedKeys.length === 0) {
          const d = new Date();
          const k = d.toISOString().split('T')[0];
          return [{
              date: `${d.getMonth()+1}-${d.getDate()}`,
              fullDate: k,
              day: d.toLocaleDateString('zh-CN', { weekday: 'short' }),
              sales: 0,
              profit: 0,
              orderCount: 0,
              expenses: 0
          }];
      }
      return sortedKeys.map(k => dailyStatsMap.get(k)!);
  }, [dailyStatsMap]);

  // 2. Today's Specific Stats
  const todayStats = dailyStatsMap.get(todayStr) || { sales: 0, profit: 0, orderCount: 0, expenses: 0 };
  
  // 3. Alerts Check
  const lowStockProducts = products.filter(p => p.stock < p.alertThreshold);

  // 4. Notifications
  const notifications = useMemo(() => {
    const list: Notification[] = [];
    
    // Orders
    orders.slice(0, 20).forEach((order) => { 
        const nId = order.timestamp;
        list.push({
            id: nId,
            title: '新订单入账',
            desc: `订单 #${order.id.slice(-6)} 收款 ¥${order.amount.toFixed(2)}`,
            time: order.time,
            type: 'order',
            read: readNotificationIds.includes(nId),
            data: order
        });
    });

    // Expenses (Restock / Other)
    expenses.slice(0, 20).forEach((exp) => {
        // Use expense ID as notification ID (assuming timestamp based)
        const nId = exp.id;
        list.push({
            id: nId,
            title: exp.category === 'restock' ? '进货入库' : '支出记录',
            desc: `${exp.name} - 支出 ¥${exp.amount.toFixed(2)}`,
            time: new Date(exp.id).toLocaleTimeString('zh-CN', {hour: '2-digit', minute:'2-digit'}),
            type: 'expense',
            read: readNotificationIds.includes(nId),
            data: exp
        });
    });

    // Low Stock Alerts
    lowStockProducts.forEach((p) => {
        const nId = 20000 + p.id; 
        list.push({
            id: nId,
            title: '库存预警',
            desc: `“${p.name}” 库存仅剩 ${p.stock} 件 (低于阈值 ${p.alertThreshold})`,
            time: '当前',
            type: 'alert',
            read: readNotificationIds.includes(nId),
            data: p
        });
    });
    
    return list.sort((a, b) => b.id - a.id);
  }, [orders, lowStockProducts, expenses, readNotificationIds]);

  const unreadCount = notifications.filter(n => !n.read).length;
  const filteredNotifications = notifications.filter(n => notifFilter === 'all' ? true : n.type === notifFilter);

  // --- Calculations for Finance Modal ---
  const sevenDayStats = recentDailyStats.slice(-7);
  const sevenDaySales = sevenDayStats.reduce((acc, s) => acc + s.sales, 0);
  const sevenDayProfit = sevenDayStats.reduce((acc, s) => acc + s.profit, 0);
  // Calculate expenses within the date range of the displayed stats
  const periodStartDate = sevenDayStats[0]?.fullDate || '0000-00-00';
  const periodEndDate = sevenDayStats[sevenDayStats.length - 1]?.fullDate || '9999-99-99';
  const periodExpenses = expenses.filter(e => e.date >= periodStartDate && e.date <= periodEndDate);
  const totalPeriodExpenses = periodExpenses.reduce((acc, e) => acc + e.amount, 0);
  const netProfit = sevenDayProfit - totalPeriodExpenses;

  // --- Functions ---

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getDayData = (dateStr: string) => {
      if (dailyStatsMap.has(dateStr)) {
          return dailyStatsMap.get(dateStr)!;
      }
      return { sales: 0, profit: 0, expenses: 0, orderCount: 0 };
  };

  const navigateCalendar = (direction: 'prev' | 'next') => {
      const newDate = new Date(calendarDate);
      const diff = direction === 'next' ? 1 : -1;
      
      if (calendarViewMode === 'month') {
          newDate.setMonth(newDate.getMonth() + diff);
      } else if (calendarViewMode === 'week') {
          newDate.setDate(newDate.getDate() + (diff * 7));
      } else if (calendarViewMode === 'year') {
          newDate.setFullYear(newDate.getFullYear() + diff);
      }
      setCalendarDate(newDate);
  };

  const getCalendarTitle = () => {
      const y = calendarDate.getFullYear();
      const m = calendarDate.getMonth() + 1;
      if (calendarViewMode === 'year') return `${y}年`;
      if (calendarViewMode === 'week') return `${y}年 ${m}月 (周视图)`;
      return `${y}年 ${m}月`;
  };

  // Calendar View Stats Aggregation
  const currentViewStats = useMemo(() => {
      let sales = 0;
      let profit = 0;
      let expensesSum = 0;
      
      if (calendarViewMode === 'month') {
          const year = calendarDate.getFullYear();
          const month = calendarDate.getMonth();
          const days = new Date(year, month + 1, 0).getDate();
          for(let i=1; i<=days; i++) {
               const d = `${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
               const s = getDayData(d);
               sales += s.sales;
               profit += s.profit;
               expensesSum += s.expenses;
          }
      } else if (calendarViewMode === 'year') {
          const year = calendarDate.getFullYear();
          Array.from(dailyStatsMap.values()).forEach((stat: DailyStat) => {
              if (stat.fullDate.startsWith(`${year}-`)) {
                  sales += stat.sales;
                  profit += stat.profit;
                  expensesSum += stat.expenses;
              }
          });
      }
      return { sales, profit, expenses: expensesSum };
  }, [calendarDate, calendarViewMode, dailyStatsMap]);

  const handleOpenDayDetail = (stat: DailyStat) => {
      setSelectedDayStat(stat);
      const specificOrders = orders.filter(o => o.timestamp >= new Date(stat.fullDate).getTime() && o.timestamp < new Date(stat.fullDate).getTime() + 86400000);
      const specificExpenses = expenses.filter(e => e.date === stat.fullDate);
      setCurrentDayOrders(specificOrders);
      setCurrentDayExpenses(specificExpenses);
      setActiveModal('dayDetail');
  };

  const handleOpenGeneratedDayDetail = (date: Date) => {
      const dateStr = date.toISOString().split('T')[0];
      const data = getDayData(dateStr);
      const stat: DailyStat = {
          date: `${date.getMonth()+1}-${date.getDate()}`,
          fullDate: dateStr,
          day: date.toLocaleDateString('zh-CN', { weekday: 'short' }),
          sales: data.sales,
          profit: data.profit,
          orderCount: data.orderCount,
          expenses: data.expenses
      };
      handleOpenDayDetail(stat);
  }

  // --- Manual Order Logic ---
  const filteredProducts = selectedCategory === 'all' 
    ? products 
    : products.filter(p => p.category === selectedCategory || p.category === 'custom');

  const updateCart = (productId: number, delta: number) => {
    setManualCart(prev => {
        const currentItem = prev[productId] || { productId, qty: 0 };
        const newQty = Math.max(0, currentItem.qty + delta);
        const newCart = { ...prev };
        if (newQty === 0) delete newCart[productId];
        else newCart[productId] = { ...currentItem, qty: newQty };
        return newCart;
    });
  };

  const handleManualSubmit = () => {
      const details = [];
      let total = 0;
      let count = 0;

      products.forEach(p => {
          const item = manualCart[p.id];
          if (item && item.qty > 0) {
              const finalPrice = item.overridePrice !== undefined ? item.overridePrice : p.price;
              details.push({
                  id: p.id,
                  name: p.name,
                  qty: item.qty,
                  price: finalPrice,
                  cost: p.cost,
                  sku: p.sku
              });
              total += finalPrice * item.qty;
              count += item.qty;
          }
      });

      if (count === 0) return;

      const newOrder: Order = {
          id: `#${Date.now().toString().slice(-6)}`,
          timestamp: Date.now(),
          time: new Date().toLocaleTimeString('zh-CN', {hour: '2-digit', minute:'2-digit'}),
          amount: total,
          itemsCount: count,
          status: 'paid',
          paymentMethod: paymentMethod,
          details: details
      };

      addOrder(newOrder);
      showToast('记账成功');
      setManualCart({});
      setActiveModal(null);
  };

  const handleAddExpense = () => {
      if (!newExpense.name || !newExpense.amount) return;
      addExpense({
          id: Date.now(),
          name: newExpense.name,
          amount: parseFloat(newExpense.amount),
          date: todayStr,
          category: 'other'
      });
      setNewExpense({ name: '', amount: '' });
  };

  const handleNotificationClick = (n: Notification) => {
      if (!n.read) setReadNotificationIds(prev => [...prev, n.id]);
      if (n.type === 'order' && n.data) {
          handleOpenOrder(n.data);
      } else if (n.type === 'alert') {
          navigate('/inventory');
      } else if (n.type === 'expense') {
          setActiveModal('finance');
      }
      setActiveModal(null);
  };

  const handleOpenOrder = (order: Order) => {
      setSelectedOrder(order);
      setActiveModal('orderDetail');
  };

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 pb-20 transition-colors duration-300 relative">
      
      {/* Header */}
      <header className="px-6 py-6 flex justify-between items-start sticky top-0 z-20 bg-zinc-100/80 dark:bg-zinc-950/80 backdrop-blur-md">
        <div>
           <h2 className="text-zinc-500 dark:text-zinc-400 text-sm font-medium mb-1">欢迎回来, 店长</h2>
           <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{currentDateStr}</h1>
        </div>
        <div className="flex gap-3 relative">
            <ThemeToggle />
            <button 
                onClick={(e) => { e.stopPropagation(); setShowNotificationsDropdown(!showNotificationsDropdown); }}
                className="p-2 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 relative active:scale-95 transition-transform"
            >
                <Bell size={20} />
                {unreadCount > 0 && <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-primary rounded-full border-2 border-white dark:border-zinc-900 animate-pulse"></span>}
            </button>
            {/* Notification Dropdown */}
            {showNotificationsDropdown && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowNotificationsDropdown(false)} />
                <div className="absolute right-0 top-12 w-80 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 z-40 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                    <h3 className="font-bold text-zinc-900 dark:text-white">消息通知</h3>
                    <span className="text-xs text-zinc-500">{unreadCount} 条未读</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.slice(0, 3).map(n => (
                      <div key={n.id} onClick={() => { handleNotificationClick(n); setShowNotificationsDropdown(false); }} className={`p-4 border-b border-zinc-100 dark:border-zinc-800 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors relative cursor-pointer ${!n.read ? 'bg-zinc-50/50 dark:bg-zinc-800/20' : ''}`}>
                        {!n.read && <div className="absolute left-0 top-4 w-1 h-8 bg-primary rounded-r-full"></div>}
                        <div className="flex justify-between items-start mb-1">
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${n.type === 'alert' ? 'bg-red-100 text-red-600' : n.type === 'order' ? 'bg-green-100 text-green-600' : n.type === 'expense' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                             {n.type === 'alert' ? '预警' : n.type === 'order' ? '订单' : n.type === 'expense' ? '支出' : '系统'}
                          </span>
                          <span className="text-zinc-400 text-xs">{n.time}</span>
                        </div>
                        <h4 className="text-sm font-bold text-zinc-900 dark:text-white mb-0.5">{n.title}</h4>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-950/50 text-center border-t border-zinc-100 dark:border-zinc-800">
                    <button onClick={() => { setShowNotificationsDropdown(false); setActiveModal('notifications'); }} className="text-xs text-primary font-bold hover:underline">查看全部消息</button>
                  </div>
                </div>
              </>
            )}
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white dark:border-zinc-800 shadow-sm">
                <img src="https://picsum.photos/100/100" alt="Avatar" className="w-full h-full object-cover" />
            </div>
        </div>
      </header>

      {toast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[70] animate-in slide-in-from-top-5 duration-300 pointer-events-none">
          <div className={`px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 ${toast.type === 'success' ? 'bg-zinc-900 text-white' : 'bg-red-500 text-white'}`}>
             <Check size={18} /> <span className="font-bold text-sm">{toast.message}</span>
          </div>
        </div>
      )}

      <main className="px-6 space-y-6">
        {/* Today's Stats Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-xl shadow-zinc-200/50 dark:shadow-none border border-zinc-100 dark:border-zinc-800 relative overflow-hidden group">
            <div className="relative z-10">
                <div className="flex justify-between items-start mb-2">
                    <span className="text-zinc-500 dark:text-zinc-400 font-medium">今日销售额</span>
                    <span className="text-xs text-zinc-400 font-mono">{new Date().toLocaleTimeString()}</span>
                </div>
                <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-zinc-400 text-xl font-bold">¥</span>
                    <span className="text-4xl font-black text-zinc-900 dark:text-white tracking-tight">{todayStats.sales.toFixed(2)}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 border-t border-zinc-100 dark:border-zinc-800 pt-4">
                    <div>
                        <div className="text-zinc-400 text-xs mb-1">今日利润 (预估)</div>
                        <div className="text-lg font-bold text-primary">¥ {todayStats.profit.toFixed(2)}</div>
                    </div>
                    <div>
                        <div className="text-zinc-400 text-xs mb-1">今日订单</div>
                        <div className="text-lg font-bold text-zinc-900 dark:text-white">{todayStats.orderCount}</div>
                    </div>
                </div>
                <div className="mt-4 pt-2">
                    <button onClick={() => setActiveModal('finance')} className="w-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all">
                         <BarChart3 size={18} className="text-primary" />
                         查看详细财务报表
                    </button>
                </div>
            </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4">
            <button onClick={() => setActiveModal('voice')} className="col-span-1 row-span-2 bg-gradient-to-br from-primary to-red-600 rounded-3xl p-6 flex flex-col justify-between relative overflow-hidden shadow-lg shadow-red-900/20 active:scale-[0.98] transition-transform">
                <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full blur-xl transform translate-x-4 -translate-y-4"></div>
                <div className="bg-white/20 w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-sm"><Mic className="text-white" size={24} /></div>
                <div><div className="text-white font-bold text-lg mb-1">智能语音</div><div className="text-red-100 text-xs opacity-90">进货 / 记账</div></div>
            </button>
            <button onClick={() => setActiveModal('scan')} className="bg-white dark:bg-zinc-900 p-5 rounded-3xl flex flex-col gap-3 border border-zinc-100 dark:border-zinc-800 shadow-sm active:scale-[0.98] transition-all">
                <div className="text-blue-500 bg-blue-500/10 w-10 h-10 rounded-xl flex items-center justify-center"><ScanLine size={20} /></div>
                <div className="text-left"><div className="text-zinc-900 dark:text-white font-bold text-sm">扫码入库</div><div className="text-zinc-500 text-xs">摄像头扫描</div></div>
            </button>
            <button onClick={() => navigate('/inventory')} className="bg-white dark:bg-zinc-900 p-5 rounded-3xl flex flex-col gap-3 border border-zinc-100 dark:border-zinc-800 shadow-sm active:scale-[0.98] transition-all">
                <div className="text-orange-500 bg-orange-500/10 w-10 h-10 rounded-xl flex items-center justify-center"><Package size={20} /></div>
                <div className="text-left"><div className="text-zinc-900 dark:text-white font-bold text-sm">库存管理</div><div className="text-zinc-500 text-xs">查看剩余库存</div></div>
            </button>
        </div>

        {/* Recent Sales List */}
        <div className="pb-10">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2"><h3 className="text-lg font-bold text-zinc-900 dark:text-white">最近销售</h3><button onClick={() => setActiveModal('manualOrder')} className="bg-primary/10 hover:bg-primary/20 text-primary rounded-full p-1"><Plus size={16} /></button></div>
                <button onClick={() => setActiveModal('allOrders')} className="text-primary text-xs font-bold hover:text-primary-light">查看全部</button>
            </div>
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
                {orders.length === 0 ? (
                    <div className="p-8 text-center text-zinc-400 text-sm">暂无订单数据</div>
                ) : (
                    orders.slice(0, 5).map((sale, index) => (
                        <div key={sale.id} onClick={() => { setSelectedOrder(sale); setActiveModal('orderDetail'); }} className={`p-4 flex justify-between items-center ${index !== orders.length - 1 ? 'border-b border-zinc-100 dark:border-zinc-800' : ''} hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer group`}>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors"><BarChart3 size={18} /></div>
                                <div>
                                    <div className="text-sm font-bold text-zinc-900 dark:text-white">订单 {sale.id}</div>
                                    <div className="text-xs text-zinc-500">{new Date(sale.timestamp).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {sale.itemsCount}件商品</div>
                                </div>
                            </div>
                            <div className="text-right"><div className="text-sm font-bold text-zinc-900 dark:text-white">¥{sale.amount.toFixed(2)}</div><div className="text-xs text-green-500">已支付</div></div>
                        </div>
                    ))
                )}
            </div>
        </div>
      </main>

      {/* --- MODALS RESTORED --- */}

      {/* 1. Finance Modal */}
      {activeModal === 'finance' && (
         <div className="fixed inset-0 z-[60] flex flex-col bg-zinc-100 dark:bg-zinc-950 animate-in slide-in-from-right duration-300">
             <div className="px-4 py-4 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center shrink-0 z-10 shadow-sm sticky top-0">
                 <button onClick={() => setActiveModal(null)} className="flex items-center text-zinc-500 dark:text-zinc-400 active:opacity-50"><ChevronLeft size={24} /> <span className="ml-1 text-sm font-bold">返回</span></button>
                 <h2 className="font-bold text-lg text-zinc-900 dark:text-white">财务分析</h2>
                 <div className="w-16"></div> 
             </div>
             <div className="flex-1 overflow-y-auto p-4 pb-12 space-y-6">
                 {/* Big Calendar Button */}
                 <button onClick={() => setActiveModal('calendar')} className="w-full bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-between group active:scale-[0.99] transition-transform">
                     <div className="flex items-center gap-4">
                         <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center">
                             <CalendarRange size={24} />
                         </div>
                         <div className="text-left">
                             <div className="font-bold text-zinc-900 dark:text-white">历史账单日历</div>
                             <div className="text-xs text-zinc-500">查看往期每一天的营收详情</div>
                         </div>
                     </div>
                     <ChevronRight size={20} className="text-zinc-300 group-hover:text-primary transition-colors" />
                 </button>

                 {/* Period Summary */}
                 <div className="grid grid-cols-2 gap-3">
                     <div className="bg-gradient-to-br from-primary to-red-600 rounded-2xl p-4 text-white shadow-lg shadow-red-500/20">
                         <div className="flex items-center gap-2 mb-2 opacity-80"><DollarSign size={16} /><span className="text-xs font-bold">近7天总营收</span></div>
                         <div className="text-2xl font-black">¥{sevenDaySales.toFixed(2)}</div>
                         <div className="text-xs mt-1 opacity-80 flex items-center gap-1"><TrendingUp size={12} /></div>
                     </div>
                     <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white">
                         <div className="flex items-center gap-2 mb-2 text-zinc-500"><PieChart size={16} /><span className="text-xs font-bold">近7天净利润</span></div>
                         <div className={`text-2xl font-black ${netProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>¥{netProfit.toFixed(2)}</div>
                     </div>
                 </div>

                 {/* Updated Chart with Profit Bars */}
                 <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-200 dark:border-zinc-800">
                     <div className="flex justify-between items-center mb-6">
                         <h3 className="font-bold text-zinc-900 dark:text-white text-sm">营收趋势 (7天)</h3>
                         <div className="flex gap-3 text-[10px] font-bold">
                             <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-primary"></div>营收</div>
                             <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div>利润</div>
                         </div>
                     </div>
                     <div className="h-64 flex items-end justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-2">
                         {sevenDayStats.map((stat, idx) => {
                             const maxSales = Math.max(...sevenDayStats.map(s => s.sales)) || 1;
                             return (
                                 <div key={idx} onClick={() => handleOpenDayDetail(stat)} className="flex flex-col items-center flex-1 cursor-pointer group h-full justify-end">
                                     <div className="relative w-full flex items-end justify-center gap-1 pb-2 h-full">
                                         {/* Sales Bar */}
                                         <div className="w-2 md:w-3 rounded-t-sm bg-primary transition-all duration-300 opacity-80 group-hover:opacity-100" style={{ height: `${(stat.sales / maxSales) * 100}%` }}></div>
                                         {/* Profit Bar */}
                                         <div className="w-2 md:w-3 rounded-t-sm bg-green-500 transition-all duration-300 opacity-80 group-hover:opacity-100" style={{ height: `${Math.max(0, (stat.profit / maxSales) * 100)}%` }}></div>
                                     </div>
                                     <span className="text-[10px] font-bold text-zinc-400">{stat.date}</span>
                                 </div>
                             )
                         })}
                     </div>
                 </div>

                 {/* 7-Day Detail List */}
                 <div>
                     <h3 className="font-bold text-zinc-900 dark:text-white text-sm mb-3 ml-1">每日明细</h3>
                     <div className="space-y-3">
                         {[...sevenDayStats].reverse().map((stat, i) => (
                             <button key={i} onClick={() => handleOpenDayDetail(stat)} className="w-full bg-white dark:bg-zinc-900 p-4 rounded-2xl flex justify-between items-center border border-zinc-200 dark:border-zinc-800 active:scale-[0.99] transition-transform">
                                 <div className="text-left">
                                     <div className="font-bold text-zinc-900 dark:text-white text-sm">{stat.fullDate}</div>
                                     <div className="text-xs text-zinc-400">{stat.day} · {stat.orderCount} 单</div>
                                 </div>
                                 <div className="flex items-center gap-4 text-right">
                                     <div>
                                         <div className="text-xs text-zinc-400">营收</div>
                                         <div className="font-bold text-zinc-900 dark:text-white">¥{stat.sales.toFixed(0)}</div>
                                     </div>
                                     <div>
                                         <div className="text-xs text-zinc-400">利润</div>
                                         <div className="font-bold text-green-500">+¥{stat.profit.toFixed(0)}</div>
                                     </div>
                                     <ChevronRight size={16} className="text-zinc-300" />
                                 </div>
                             </button>
                         ))}
                     </div>
                 </div>

                 {/* Profit & Loss Summary */}
                 <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                     <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                         <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/20 text-green-600 flex items-center justify-center"><ArrowUp size={16} className="rotate-45" /></div><span className="text-sm font-bold text-zinc-900 dark:text-white">营业总收入</span></div>
                         <span className="font-bold text-zinc-900 dark:text-white">¥{sevenDaySales.toFixed(2)}</span>
                     </div>
                      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center group">
                         <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center"><Wallet size={16} /></div>
                             <div className="flex flex-col"><div className="flex items-center gap-2"><span className="text-sm font-bold text-zinc-900 dark:text-white">其它支出</span><button onClick={() => setShowExpenseEditor(true)} className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold hover:bg-primary hover:text-white transition-colors flex items-center gap-1"><Edit3 size={10} /> 记一笔</button></div></div>
                         </div>
                         <button onClick={() => setShowExpenseEditor(true)} className="font-bold text-red-500 hover:opacity-70 active:scale-95 transition-all">-¥{totalPeriodExpenses.toFixed(2)}</button>
                     </div>
                 </div>
                 {/* Expense Editor */}
                 {showExpenseEditor && (
                     <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 overflow-hidden p-5 animate-in fade-in zoom-in-95 duration-200 shadow-2xl">
                         <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-zinc-900 dark:text-white">支出记账本</h3><button onClick={() => setShowExpenseEditor(false)} className="text-primary text-sm font-bold">完成</button></div>
                         <div className="flex gap-2 mb-4">
                             <input type="text" placeholder="支出名称" value={newExpense.name} onChange={(e) => setNewExpense({...newExpense, name: e.target.value})} className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl px-3 py-2 text-sm outline-none text-zinc-900 dark:text-white" />
                             <input type="number" placeholder="金额" value={newExpense.amount} onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})} className="w-20 bg-zinc-100 dark:bg-zinc-800 rounded-xl px-3 py-2 text-sm outline-none text-zinc-900 dark:text-white" />
                             <button onClick={handleAddExpense} className="bg-primary text-white rounded-xl w-10 flex items-center justify-center hover:bg-primary-hover"><Plus size={18} /></button>
                         </div>
                         <div className="space-y-2 max-h-48 overflow-y-auto">
                             {expenses.map(exp => (
                                 <div key={exp.id} className="flex justify-between items-center p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
                                     <div className="flex flex-col"><span className="text-sm font-medium text-zinc-900 dark:text-white">{exp.name}</span><span className="text-[10px] text-zinc-400">{exp.date}</span></div>
                                     <div className="flex items-center gap-3"><span className="font-bold text-zinc-900 dark:text-white">¥{exp.amount.toFixed(2)}</span><button onClick={() => deleteExpense(exp.id)} className="text-zinc-400 hover:text-red-500"><Trash2 size={14} /></button></div>
                                 </div>
                             ))}
                         </div>
                     </div>
                 )}
             </div>
         </div>
      )}

      {/* 2. Notifications Modal */}
      {activeModal === 'notifications' && (
         <div className="fixed inset-0 z-50 flex flex-col bg-zinc-100 dark:bg-zinc-950 animate-in slide-in-from-right duration-300">
             <div className="px-6 py-4 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center sticky top-0 z-10">
                 <button onClick={() => setActiveModal(null)} className="p-2 -ml-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"><ChevronLeft size={24} className="text-zinc-900 dark:text-white" /></button>
                 <h2 className="text-lg font-bold text-zinc-900 dark:text-white">消息中心</h2>
                 <button onClick={() => setReadNotificationIds(notifications.map(n => n.id))} className="text-xs text-primary font-bold hover:underline">全部已读</button>
             </div>
             <div className="px-6 py-3 bg-zinc-50 dark:bg-zinc-900/50 flex gap-2 overflow-x-auto no-scrollbar border-b border-zinc-200 dark:border-zinc-800">
                 {['all', 'order', 'alert', 'expense', 'system'].map(f => (
                     <button key={f} onClick={() => setNotifFilter(f as any)} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${notifFilter === f ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900' : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700'}`}>
                        {f === 'all' ? '全部' : f === 'order' ? '订单' : f === 'alert' ? '库存预警' : f === 'expense' ? '支出/进货' : '系统'}
                     </button>
                 ))}
             </div>
             <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                 {filteredNotifications.length === 0 ? <div className="flex flex-col items-center justify-center pt-20 text-zinc-400"><MessageSquare size={48} className="opacity-20 mb-4" /><p>暂无此类消息</p></div> : filteredNotifications.map(n => (
                     <div key={n.id} onClick={() => handleNotificationClick(n)} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden active:scale-[0.99] transition-transform cursor-pointer">
                         {n.type === 'alert' && <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500"></div>}
                         {n.type === 'order' && <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500"></div>}
                         {n.type === 'expense' && <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500"></div>}
                         <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2"><span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${n.type === 'alert' ? 'bg-red-100 text-red-600' : n.type === 'order' ? 'bg-green-100 text-green-600' : n.type === 'expense' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>{n.type === 'alert' ? '预警' : n.type === 'order' ? '订单' : n.type === 'expense' ? '支出' : '系统'}</span><span className="text-zinc-400 text-xs">{n.time}</span></div>
                            {!n.read && <div className="w-2 h-2 rounded-full bg-primary"></div>}
                         </div>
                         <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-1">{n.title}</h3>
                         <p className="text-xs text-zinc-500 leading-relaxed">{n.desc}</p>
                     </div>
                 ))}
             </div>
         </div>
      )}

      {/* 3. Voice Modal */}
      {activeModal === 'voice' && (
        <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950/95 backdrop-blur-xl animate-in fade-in duration-200">
           <div className="absolute top-8 left-0 right-0 flex justify-center z-10">
               <div className="bg-zinc-800/80 backdrop-blur-md p-1 rounded-full flex">
                   <button onClick={() => setVoiceMode('sale')} className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${voiceMode === 'sale' ? 'bg-primary text-white shadow-lg' : 'text-zinc-400'}`}>语音记账</button>
                   <button onClick={() => setVoiceMode('restock')} className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${voiceMode === 'restock' ? 'bg-blue-500 text-white shadow-lg' : 'text-zinc-400'}`}>语音进货</button>
               </div>
           </div>
           <div className="flex-1 flex flex-col items-center justify-center relative pt-16">
              <button onClick={() => setActiveModal(null)} className="absolute top-6 right-6 text-white/50 hover:text-white p-2"><X size={32} /></button>
              <div className="text-center space-y-8 px-6">
                 {isListening ? <div className="space-y-4"><p className="text-primary font-bold text-xl animate-pulse">正在听...</p></div> : <div className="space-y-4 opacity-50"><Mic size={40} className="text-zinc-500 mx-auto" /><p className="text-zinc-300 font-bold text-lg">按住说话</p></div>}
              </div>
           </div>
           <div className="h-1/3 bg-zinc-900 rounded-t-[3rem] flex items-center justify-center pb-8 border-t border-zinc-800 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
              <button className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-200 ${isListening ? 'bg-primary scale-110 shadow-[0_0_50px_rgba(255,59,48,0.5)]' : 'bg-zinc-800 text-zinc-400'}`} onMouseDown={() => setIsListening(true)} onMouseUp={() => setIsListening(false)} onTouchStart={() => setIsListening(true)} onTouchEnd={() => setIsListening(false)}><Mic size={40} className={isListening ? 'text-white' : ''} /></button>
           </div>
        </div>
      )}

      {/* 4. Scan Modal */}
      {activeModal === 'scan' && (
        <div className="fixed inset-0 z-50 bg-black animate-in fade-in duration-300">
           <div className="absolute inset-0 overflow-hidden"><video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover opacity-80" /></div>
           <div className="absolute inset-0 flex flex-col">
              <div className="p-6 flex justify-between items-center z-10">
                <button onClick={() => setActiveModal(null)} className="p-2 rounded-full bg-black/40 text-white backdrop-blur-md"><ChevronLeft size={24} /></button>
                <span className="text-white font-medium drop-shadow-md">扫描条形码/二维码</span><div className="w-10"></div>
              </div>
              <div className="flex-1 flex items-center justify-center p-10">
                  <div className="w-64 h-64 border-2 border-primary/80 rounded-3xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]"><div className="absolute top-0 left-0 w-full h-1 bg-primary shadow-[0_0_10px_#FF3B30] animate-[scan_2s_ease-in-out_infinite]"></div></div>
              </div>
           </div>
        </div>
      )}

      {/* 5. Calendar Modal */}
      {activeModal === 'calendar' && (
          <div className="fixed inset-0 z-[60] flex flex-col bg-zinc-100 dark:bg-zinc-950 animate-in slide-in-from-bottom duration-300">
              <div className="px-4 py-4 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center shrink-0 z-10 shadow-sm">
                 <button onClick={() => setActiveModal('finance')} className="flex items-center text-zinc-500 dark:text-zinc-400 active:opacity-50"><X size={24} /></button>
                 <div className="flex items-center gap-4">
                     <button onClick={() => navigateCalendar('prev')} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full"><ChevronLeft size={24} /></button>
                     <h2 className="font-bold text-lg text-zinc-900 dark:text-white min-w-[100px] text-center">{getCalendarTitle()}</h2>
                     <button onClick={() => navigateCalendar('next')} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full"><ChevronRight size={24} /></button>
                 </div>
                 <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
                     <button onClick={() => setCalendarViewMode('week')} className={`p-1.5 rounded-md ${calendarViewMode === 'week' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-400'}`}><List size={16} /></button>
                     <button onClick={() => setCalendarViewMode('month')} className={`p-1.5 rounded-md ${calendarViewMode === 'month' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-400'}`}><Calendar size={16} /></button>
                     <button onClick={() => setCalendarViewMode('year')} className={`p-1.5 rounded-md ${calendarViewMode === 'year' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-400'}`}><LayoutGrid size={16} /></button>
                 </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 flex flex-col">
                  {/* MONTH VIEW */}
                  {calendarViewMode === 'month' && (
                      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800 flex-1 flex flex-col">
                            <div className="grid grid-cols-7 mb-2 border-b border-zinc-100 dark:border-zinc-800 pb-2">{['日','一','二','三','四','五','六'].map(d => (<div key={d} className="text-center text-xs text-zinc-400 font-bold py-1">{d}</div>))}</div>
                            <div className="grid grid-cols-7 gap-2 flex-1 auto-rows-fr">
                                {[...Array(new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1).getDay())].map((_, i) => <div key={`empty-${i}`} />)}
                                {[...Array(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0).getDate())].map((_, i) => {
                                    const day = i + 1;
                                    const dateStr = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                                    const stat = getDayData(dateStr);
                                    const hasData = stat.sales > 0 || stat.expenses > 0;
                                    return (
                                        <button key={day} onClick={() => handleOpenGeneratedDayDetail(new Date(dateStr))} disabled={!hasData} className={`rounded-xl flex flex-col p-1 border transition-all relative overflow-hidden min-h-[60px] ${hasData ? 'bg-zinc-50 dark:bg-zinc-800/30 border-zinc-100 dark:border-zinc-800 hover:border-primary active:scale-95 cursor-pointer' : 'bg-transparent border-transparent cursor-default'}`}>
                                            <span className={`text-sm font-bold absolute top-1 left-1.5 ${hasData ? 'text-zinc-900 dark:text-white' : 'text-zinc-300 dark:text-zinc-700'}`}>{day}</span>
                                            {hasData && (
                                                <div className="flex-1 flex flex-col justify-end gap-0.5 w-full mt-5">
                                                    {stat.sales > 0 && <div className="flex justify-between items-end w-full px-0.5"><span className="text-[9px] text-zinc-400 scale-90 origin-left">收</span><span className="text-[10px] font-bold text-zinc-700 dark:text-zinc-200 leading-none">¥{stat.sales}</span></div>}
                                                    {stat.profit > 0 && <div className="flex justify-between items-end w-full px-0.5"><span className="text-[9px] text-zinc-400 scale-90 origin-left">赚</span><span className="text-[10px] font-bold text-emerald-500 leading-none">¥{stat.profit}</span></div>}
                                                    {stat.expenses > 0 && <div className="flex justify-between items-end w-full px-0.5"><span className="text-[9px] text-zinc-400 scale-90 origin-left">支</span><span className="text-[10px] font-bold text-blue-500 leading-none">¥{stat.expenses}</span></div>}
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                      </div>
                  )}
                  {/* Summary Footer */}
                  <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                      <h3 className="text-xs font-bold text-zinc-500 mb-3 flex items-center justify-between"><span>当前视图汇总 ({getCalendarTitle()})</span><span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded text-[10px]">真实数据</span></h3>
                      <div className="grid grid-cols-3 gap-3">
                          <div className="bg-zinc-100 dark:bg-zinc-800/50 p-4 rounded-2xl"><div className="text-xs text-zinc-500 mb-1">总营收</div><div className="text-lg font-black text-zinc-900 dark:text-white">¥{currentViewStats.sales.toLocaleString()}</div></div>
                          <div className="bg-zinc-100 dark:bg-zinc-800/50 p-4 rounded-2xl"><div className="text-xs text-zinc-500 mb-1">净利润</div><div className="text-lg font-black text-green-600 dark:text-green-400">¥{currentViewStats.profit.toLocaleString()}</div></div>
                          <div className="bg-zinc-100 dark:bg-zinc-800/50 p-4 rounded-2xl border-l-4 border-blue-500"><div className="text-xs text-zinc-500 mb-1">总支出</div><div className="text-lg font-black text-blue-600 dark:text-blue-400">¥{currentViewStats.expenses.toLocaleString()}</div></div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* 6. Day Detail Modal */}
      {activeModal === 'dayDetail' && selectedDayStat && (
          <div className="fixed inset-0 z-[70] flex flex-col bg-zinc-100 dark:bg-zinc-950 animate-in slide-in-from-right duration-300">
              <div className="px-4 py-4 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center shrink-0 z-10 shadow-sm">
                 <button onClick={() => setActiveModal('calendar')} className="flex items-center text-zinc-500 dark:text-zinc-400 active:opacity-50"><ChevronLeft size={24} /> <span className="ml-1 text-sm font-bold">返回日历</span></button>
                 <h2 className="font-bold text-lg text-zinc-900 dark:text-white">{selectedDayStat.date} 详情</h2>
                 <div className="w-16"></div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm">
                      <div className="flex justify-between items-center mb-4"><span className="text-zinc-500 text-sm">{selectedDayStat.fullDate} {selectedDayStat.day}</span><span className="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-1 rounded-lg text-xs font-bold">{selectedDayStat.orderCount} 笔交易</span></div>
                      <div className="flex items-baseline gap-1 mb-1"><span className="text-2xl text-zinc-900 dark:text-white font-bold">¥</span><span className="text-4xl text-zinc-900 dark:text-white font-black">{selectedDayStat.sales.toFixed(2)}</span></div>
                      <div className="flex gap-4 mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                          <div><div className="text-xs text-zinc-400 mb-1">毛利润</div><div className="text-lg font-bold text-primary">¥{selectedDayStat.profit.toFixed(2)}</div></div>
                          <div><div className="text-xs text-zinc-400 mb-1">总支出</div><div className="text-lg font-bold text-blue-500">¥{selectedDayStat.expenses.toFixed(2)}</div></div>
                      </div>
                  </div>
                  
                  {/* Expenses List */}
                  {currentDayExpenses.length > 0 && (
                      <div>
                          <h3 className="font-bold text-zinc-900 dark:text-white text-sm mb-3 px-1 text-blue-500">今日支出 ({currentDayExpenses.length})</h3>
                          <div className="space-y-3">
                              {currentDayExpenses.map((exp, i) => (
                                  <div key={i} className="w-full bg-white dark:bg-zinc-900 p-4 rounded-2xl flex justify-between items-center border border-zinc-200 dark:border-zinc-800 border-l-4 border-l-blue-500">
                                      <div className="text-left">
                                          <div className="font-bold text-zinc-900 dark:text-white text-sm">{exp.name}</div>
                                          <div className="text-xs text-zinc-400">{exp.category === 'restock' ? '进货入库' : '其他支出'}</div>
                                      </div>
                                      <div className="text-right"><div className="font-bold text-blue-500">-¥{exp.amount.toFixed(2)}</div></div>
                                  </div>
                              ))}
                          </div>
                      </div>
                  )}

                  {/* Orders List */}
                  {currentDayOrders.length > 0 ? (
                      <div>
                          <h3 className="font-bold text-zinc-900 dark:text-white text-sm mb-3 px-1">当日订单 ({currentDayOrders.length})</h3>
                          <div className="space-y-3">
                              {currentDayOrders.map((sale, i) => (
                                  <button key={i} onClick={() => handleOpenOrder(sale)} className="w-full bg-white dark:bg-zinc-900 p-4 rounded-2xl flex justify-between items-center border border-zinc-200 dark:border-zinc-800 active:scale-[0.99] transition-transform text-left">
                                     <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 flex items-center justify-center font-bold text-xs">#{sale.id.slice(-3)}</div>
                                        <div>
                                            <div className="text-sm font-bold text-zinc-900 dark:text-white">订单 {sale.id}</div>
                                            <div className="text-xs text-zinc-500">{new Date(sale.timestamp).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {sale.itemsCount}件商品</div>
                                        </div>
                                     </div>
                                     <div className="text-right"><div className="font-bold text-zinc-900 dark:text-white">¥{sale.amount}</div><div className="text-xs text-primary flex items-center justify-end gap-1">查看 <ChevronRight size={10} /></div></div>
                                  </button>
                               ))}
                          </div>
                      </div>
                  ) : (
                      currentDayExpenses.length === 0 && <div className="text-center text-zinc-400 text-sm py-10">当日无数据</div>
                  )}
              </div>
          </div>
      )}

      {/* Manual Order Modal (Partial) */}
      {activeModal === 'manualOrder' && (
        <div className="fixed inset-0 z-[60] bg-zinc-100 dark:bg-zinc-950 flex flex-col animate-in slide-in-from-bottom duration-300 h-[100dvh]">
            <div className="px-4 py-3 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center shrink-0 z-10 shadow-sm">
                <button onClick={() => setActiveModal(null)} className="flex items-center text-zinc-500 dark:text-zinc-400 active:opacity-50"><ChevronLeft size={24} /> <span className="ml-1 text-sm font-bold">返回</span></button>
                <h2 className="font-bold text-lg text-zinc-900 dark:text-white">手动记账</h2><div className="w-16"></div> 
            </div>
            <div className="flex-1 overflow-y-auto p-4 pb-48">
                <div className="grid grid-cols-2 gap-3">
                    {filteredProducts.map(product => {
                        const item = manualCart[product.id] || { productId: product.id, qty: 0 };
                        return (
                            <div key={product.id} className="bg-white dark:bg-zinc-900 p-3 rounded-2xl flex flex-col shadow-sm border border-zinc-200 dark:border-zinc-800 relative overflow-hidden group active:scale-[0.98] transition-transform">
                                <div className="flex gap-3">
                                    <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-xl shrink-0 overflow-hidden flex items-center justify-center relative"><img src={product.image} alt={product.name} className="w-full h-full object-cover" /></div>
                                    <div className="flex-1 min-w-0 flex flex-col justify-center"><h3 className="font-bold text-zinc-900 dark:text-white truncate text-sm">{product.name}</h3><div className="text-primary font-bold mt-1">¥{product.price.toFixed(2)}</div></div>
                                </div>
                                <div className="mt-3 flex justify-end items-center gap-3">
                                    {item.qty > 0 ? (
                                        <><button onClick={() => updateCart(product.id, -1)} className="w-8 h-8 rounded-full border border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-zinc-500"><Minus size={16} /></button><span className="font-bold text-lg text-zinc-900 dark:text-white w-6 text-center">{item.qty}</span><button onClick={() => updateCart(product.id, 1)} className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center"><Plus size={16} /></button></>
                                    ) : (
                                        <button onClick={() => updateCart(product.id, 1)} className="w-full h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold text-xs flex items-center justify-center">添加</button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            <div className="bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 shrink-0 p-4 pb-safe shadow-[0_-4px_30px_rgba(0,0,0,0.1)] z-20">
                <button onClick={handleManualSubmit} className="w-full bg-primary hover:bg-primary-hover text-white rounded-2xl h-14 flex items-center justify-center px-6 font-bold shadow-xl shadow-primary/20 active:scale-[0.98] transition-transform">提交订单</button>
            </div>
        </div>
      )}

      {/* Order Detail Modal */}
      {activeModal === 'orderDetail' && selectedOrder && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setActiveModal(null)} />
            <div className="relative w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="h-32 bg-primary flex flex-col items-center justify-center text-white relative">
                   <button onClick={() => setActiveModal(null)} className="absolute top-4 right-4 p-2 bg-white/20 rounded-full hover:bg-white/30"><X size={20} /></button>
                   <div className="text-3xl font-bold mb-1">¥{selectedOrder.amount.toFixed(2)}</div>
                   <div className="text-white/80 text-sm">交易成功</div>
                </div>
                <div className="p-6 relative">
                   <div className="space-y-6">
                      <div className="space-y-1 text-center border-b border-dashed border-zinc-200 dark:border-zinc-800 pb-6">
                         <div className="text-sm text-zinc-500">订单编号</div>
                         <div className="font-mono text-zinc-900 dark:text-white select-all">{selectedOrder.id}</div>
                         <div className="text-xs text-zinc-400 mt-2">{new Date(selectedOrder.timestamp).toLocaleString('zh-CN')}</div>
                      </div>
                      <div>
                         <h4 className="text-xs font-bold text-zinc-500 uppercase mb-3">商品明细</h4>
                         <div className="space-y-3">
                            {selectedOrder.details.map((item, idx) => (
                               <div key={idx} className="flex flex-col gap-1 text-sm border-b border-zinc-100 dark:border-zinc-800/50 pb-2 last:border-0">
                                  <div className="flex justify-between items-center">
                                      <span className="font-medium text-zinc-900 dark:text-white">{item.name}</span>
                                      <span className="font-mono text-zinc-900 dark:text-white">¥{(item.price * item.qty).toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between items-center text-xs text-zinc-400">
                                      <div className="flex items-center gap-2">
                                        <span className="bg-zinc-100 dark:bg-zinc-800 px-1.5 rounded text-[10px]">SKU: {item.sku}</span>
                                      </div>
                                      <span>x{item.qty}</span>
                                  </div>
                               </div>
                            ))}
                         </div>
                      </div>
                   </div>
                </div>
            </div>
         </div>
      )}

      {/* All Orders Modal */}
      {activeModal === 'allOrders' && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setActiveModal(null)} />
            <div className="relative w-full h-[85vh] bg-zinc-100 dark:bg-zinc-950 rounded-t-3xl shadow-2xl flex flex-col animate-in slide-in-from-bottom duration-300">
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-zinc-900 rounded-t-3xl">
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-white">全部订单</h2>
                    <button onClick={() => setActiveModal(null)} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full text-zinc-500"><X size={20} /></button>
                </div>
                <div className="p-4 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                   <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                      <input type="text" placeholder="搜索订单号..." className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-xl py-3 pl-10 pr-4 text-sm outline-none focus:ring-1 focus:ring-primary text-zinc-900 dark:text-white" />
                   </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                   {orders.map((sale, i) => (
                      <div key={i} onClick={() => handleOpenOrder(sale)} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl flex justify-between items-center border border-zinc-200 dark:border-zinc-800 active:scale-[0.99] transition-transform">
                         <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center"><Clock size={18} /></div>
                            <div>
                                <div className="text-sm font-bold text-zinc-900 dark:text-white">订单 {sale.id}</div>
                                <div className="text-xs text-zinc-500">{new Date(sale.timestamp).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                            </div>
                         </div>
                         <div className="text-right"><div className="font-bold text-zinc-900 dark:text-white">¥{sale.amount.toFixed(2)}</div><div className="text-xs text-zinc-400">{sale.itemsCount}件商品</div></div>
                      </div>
                   ))}
                </div>
            </div>
        </div>
      )}

      <style>{`
        @keyframes scan {
          0%, 100% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default ManagementDashboard;