import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { TrendingUp, DollarSign, Package } from 'lucide-react';

export default function Dashboard() {
    const [orders, setOrders] = useState<any[]>([]);

    useEffect(() => {
        supabase.from('orders').select('*').order('created_at', { ascending: false })
            .then(({ data }) => setOrders(data || []));
    }, []);

    const totalSales = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-6">经营概况</h2>

            {/* 顶部卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-neutral-900 p-6 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-3 text-gray-400 mb-2">
                        <DollarSign size={20} className="text-green-500" /> 总销售额
                    </div>
                    <div className="text-3xl font-bold text-white font-mono">¥{totalSales.toFixed(2)}</div>
                </div>
                <div className="bg-neutral-900 p-6 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-3 text-gray-400 mb-2">
                        <Package size={20} className="text-blue-500" /> 总订单数
                    </div>
                    <div className="text-3xl font-bold text-white font-mono">{orders.length} 单</div>
                </div>
                <div className="bg-neutral-900 p-6 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-3 text-gray-400 mb-2">
                        <TrendingUp size={20} className="text-red-500" /> 客单价
                    </div>
                    <div className="text-3xl font-bold text-white font-mono">
                        ¥{orders.length > 0 ? (totalSales / orders.length).toFixed(2) : '0.00'}
                    </div>
                </div>
            </div>

            {/* 订单列表 */}
            <h3 className="font-bold text-lg mb-4">最新交易记录</h3>
            <div className="bg-neutral-900 rounded-2xl border border-white/5 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-white/5 text-gray-400">
                        <tr>
                            <th className="p-4">时间</th>
                            <th className="p-4">订单号</th>
                            <th className="p-4">金额</th>
                            <th className="p-4">状态</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {orders.map(order => (
                            <tr key={order.id} className="hover:bg-white/5 transition-colors">
                                <td className="p-4 text-gray-400">{new Date(order.created_at).toLocaleString()}</td>
                                <td className="p-4 font-mono text-xs text-gray-500">#{order.id}</td>
                                <td className="p-4 font-bold">¥{order.total_amount}</td>
                                <td className="p-4"><span className="bg-green-500/10 text-green-500 px-2 py-1 rounded text-xs">已完成</span></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}