import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../supabaseClient';

// 定义数据类型 (TypeScript 需要)
export interface Product {
  id: number;
  name: string;
  sku: string;
  price: number;
  cost: number; // ✅ 添加成本字段用于计算利润
  stock: number;
  alertThreshold: number; // Used by ManagementDashboard
  category: string;
  barcode: string;
  image: string;
  tags: string[];
}

export interface OrderItem {
  id: number;
  name: string;
  qty: number;
  price: number;
  cost: number;
  sku: string;
}

export interface Order {
  id: string;
  timestamp: number;
  time: string;
  amount: number;
  itemsCount: number;
  status: 'paid' | 'pending';
  details: OrderItem[];
  paymentMethod: 'wechat' | 'alipay' | 'cash';
  profit?: number;
}

export interface Expense {
  id: number;
  name: string;
  amount: number;
  date: string; // YYYY-MM-DD
  category: 'utilities' | 'rent' | 'salary' | 'restock' | 'other';
}

interface DataContextType {
  // For simplified App (Cashier view)
  products: Product[];
  cart: OrderItem[];
  addToCart: (product: Product) => void;
  updateCartCount: (id: number, delta: number) => void;
  checkout: () => Promise<void>;
  loading: boolean;
  refreshProducts: () => void;

  // For ManagementDashboard
  orders: Order[];
  expenses: Expense[];
  addProduct: (product: Product) => void;
  updateProduct: (product: Product) => void;
  deleteProduct: (id: number) => void;
  addOrder: (order: Order) => void;
  addExpense: (expense: Expense) => void;
  deleteExpense: (id: number) => void;
  restockProduct: (productId: number, quantity: number, totalCost: number) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  //  1. 获取商品 + 订单
  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('products').select('*').order('id');
    if (error) {
      console.error('Error fetching products:', error);
    } else {
      // Map database fields to frontend Product interface
      const mapped = (data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        sku: p.barcode || '',
        price: p.price,
        cost: p.cost || 0,
        stock: p.stock,
        alertThreshold: 10,
        category: p.category || 'other',
        barcode: p.barcode || '',
        image: p.image_url || 'https://placehold.co/200x200/cccccc/ffffff?text=No+Image',
        tags: []
      }));
      setProducts(mapped);
    }
    setLoading(false);
  };

  const fetchOrders = async () => {
    const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (data) {
      const mapped: Order[] = data.map((o: any) => ({
        id: `#${o.id}`,
        timestamp: new Date(o.created_at).getTime(),
        time: new Date(o.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        amount: o.total_amount,
        itemsCount: 1, // Would need order_items table for accurate count
        status: 'paid',
        details: [], // Would need order_items table
        paymentMethod: o.payment_method,
        profit: o.profit || 0
      }));
      setOrders(mapped);
    }
  };

  const fetchExpenses = async () => {
    const { data, error } = await supabase.from('expenses').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching expenses:', error);
    } else {
      const mapped = (data || []).map((e: any) => ({
        id: e.id,
        name: e.name,
        amount: e.amount,
        category: e.category || 'other',
        date: e.date || new Date().toISOString().split('T')[0]
      }));
      setExpenses(mapped);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchOrders();
    fetchExpenses();
  }, []);

  // 2. 加购逻辑 (for simplified Cashier)
  const addToCart = (product: Product) => {
    if (product.stock <= 0) return alert('库存不足');
    setCart(prev => {
      const existing = prev.find(p => p.id === product.id);
      if (existing) {
        if (existing.qty >= product.stock) return prev;
        return prev.map(p => p.id === product.id ? { ...p, qty: p.qty + 1 } : p);
      }
      return [...prev, {
        id: product.id,
        name: product.name,
        qty: 1,
        price: product.price,
        cost: product.cost,
        sku: product.sku
      }];
    });
  };

  // 3. 修改数量
  const updateCartCount = (id: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(0, item.qty + delta);
        const product = products.find(p => p.id === id);
        if (product && newQty > product.stock) return item;
        return { ...item, qty: newQty };
      }
      return item;
    }).filter(item => item.qty > 0));
  };

  // 4. 结账逻辑 - ✅ 修复三个关键BUG
  const checkout = async () => {
    if (cart.length === 0) return;

    const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
    const profit = cart.reduce((sum, item) => sum + (item.price - item.cost) * item.qty, 0);

    const { error: orderError } = await supabase.from('orders').insert([{
      total_amount: total,
      payment_method: 'wechat',
      profit: profit
    }]);
    if (orderError) return alert('订单创建失败: ' + orderError.message);

    // ✅ 扣减库存 - 修复BUG：使用数据库当前值而不是购物车缓存值
    for (const item of cart) {
      const { data: currentProduct } = await supabase
        .from('products')
        .select('stock')
        .eq('id', item.id)
        .single();

      if (currentProduct) {
        const newStock = Math.max(0, currentProduct.stock - item.qty);
        await supabase
          .from('products')
          .update({ stock: newStock })
          .eq('id', item.id);
      }
    }

    alert(`收款成功 ¥${total.toFixed(2)}\\n利润: ¥${profit.toFixed(2)}`);
    setCart([]);
    fetchProducts();
    fetchOrders();
  };

  // Management functions
  const addProduct = async (product: Product) => {
    setProducts(prev => [product, ...prev]);
    await supabase.from('products').insert([{
      name: product.name,
      price: product.price,
      cost: product.cost,
      stock: product.stock,
      barcode: product.barcode,
      category: product.category,
      image_url: product.image
    }]);
  };

  const updateProduct = async (product: Product) => {
    setProducts(prev => prev.map(p => p.id === product.id ? product : p));
    await supabase.from('products').update({
      name: product.name,
      price: product.price,
      cost: product.cost,
      stock: product.stock
    }).eq('id', product.id);
  };

  const deleteProduct = async (id: number) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    await supabase.from('products').delete().eq('id', id);
  };

  const addOrder = async (order: Order) => {
    setOrders(prev => [order, ...prev]);

    // Calculate profit
    const profit = order.details.reduce((sum, item) => sum + (item.price - item.cost) * item.qty, 0);

    await supabase.from('orders').insert([{
      total_amount: order.amount,
      payment_method: order.paymentMethod,
      profit: profit
    }]);

    // Update stock
    for (const item of order.details) {
      const { data: currentProduct } = await supabase
        .from('products')
        .select('stock')
        .eq('id', item.id)
        .single();

      if (currentProduct) {
        const newStock = Math.max(0, currentProduct.stock - item.qty);
        await supabase.from('products').update({ stock: newStock }).eq('id', item.id);
      }
    }

    // Update local state
    setProducts(prev => prev.map(p => {
      const soldItem = order.details.find(d => d.id === p.id);
      if (soldItem) return { ...p, stock: Math.max(0, p.stock - soldItem.qty) };
      return p;
    }));
  };

  const addExpense = async (expense: Expense) => {
    setExpenses(prev => [expense, ...prev]);

    await supabase.from('expenses').insert([{
      name: expense.name,
      amount: expense.amount,
      category: expense.category || 'other',
      date: expense.date || new Date().toISOString().split('T')[0]
    }]);
  };

  const deleteExpense = async (id: number) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
    await supabase.from('expenses').delete().eq('id', id);
  };

  const restockProduct = async (productId: number, quantity: number, totalCost: number) => {
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, stock: p.stock + quantity } : p));

    const product = products.find(p => p.id === productId);
    if (product) {
      await supabase.from('products').update({ stock: product.stock + quantity }).eq('id', productId);
    }

    addExpense({
      id: Date.now(),
      name: `进货: ${product?.name || 'Unknown'} x${quantity}`,
      amount: totalCost,
      date: new Date().toISOString().split('T')[0],
      category: 'restock'
    });
  };

  return (
    <DataContext.Provider value={{
      products, cart, addToCart, updateCartCount, checkout, loading, refreshProducts: fetchProducts,
      orders, expenses, addProduct, updateProduct, deleteProduct, addOrder, addExpense, deleteExpense, restockProduct
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) throw new Error('useData must be used within a DataProvider');
  return context;
};