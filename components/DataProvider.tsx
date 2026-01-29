import React, { createContext, useContext, useState, useEffect } from 'react';

// --- Global Types ---
export interface Product {
  id: number;
  name: string;
  sku: string;
  price: number;
  cost: number;
  stock: number;
  alertThreshold: number;
  category: 'drinks' | 'snacks' | 'tobacco' | 'daily' | 'fresh' | 'homemade' | 'custom' | 'other';
  tags: string[];
  image: string;
}

export interface OrderItem {
  id: number; // Snapshot of product ID
  name: string;
  qty: number;
  price: number; // Snapshot of price at sale
  cost: number;  // Snapshot of cost at sale
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
}

export interface Expense {
  id: number;
  name: string;
  amount: number;
  date: string; // YYYY-MM-DD
  category: 'utilities' | 'rent' | 'salary' | 'restock' | 'other';
}

interface DataContextType {
  products: Product[];
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

// --- Initial Mock Data ---
const INITIAL_PRODUCTS: Product[] = [
  { id: 10, name: '红富士苹果', sku: 'FRESH-001', price: 8.50, cost: 4.00, stock: 50, alertThreshold: 10, category: 'fresh', tags: ['水果', '称重'], image: 'https://placehold.co/200x200/ff9999/ffffff?text=Apple' },
  { id: 12, name: '自制鲜肉包', sku: 'HOME-001', price: 2.50, cost: 0.80, stock: 20, alertThreshold: 5, category: 'homemade', tags: ['早餐', '热食'], image: 'https://placehold.co/200x200/e6ccb3/000000?text=Bun' },
  { id: 101, name: '可口可乐 330ml', sku: '690123456789', price: 3.00, cost: 1.80, stock: 142, alertThreshold: 24, category: 'drinks', tags: ['饮料', '碳酸'], image: 'https://picsum.photos/id/400/100/100' },
  { id: 102, name: '农夫山泉 550ml', sku: '690123456790', price: 2.00, cost: 0.80, stock: 8, alertThreshold: 24, category: 'drinks', tags: ['饮料', '矿泉水'], image: 'https://picsum.photos/id/402/100/100' },
  { id: 201, name: '乐事薯片 原味', sku: '692123456788', price: 7.50, cost: 4.50, stock: 12, alertThreshold: 15, category: 'snacks', tags: ['零食', '膨化'], image: 'https://picsum.photos/id/401/100/100' },
  { id: 301, name: '中华(硬)', sku: '690102800001', price: 45.00, cost: 38.00, stock: 5, alertThreshold: 5, category: 'tobacco', tags: ['香烟', '高档'], image: 'https://picsum.photos/id/407/100/100' },
  { id: 401, name: '打火机', sku: '200102800001', price: 1.00, cost: 0.20, stock: 200, alertThreshold: 10, category: 'daily', tags: ['日用', '小百货'], image: 'https://picsum.photos/id/409/100/100' },
];

const INITIAL_EXPENSES: Expense[] = [
    { id: 1, name: '十月电费', amount: 320.50, date: '2023-10-01', category: 'utilities' },
    { id: 2, name: '桶装水费', amount: 45.00, date: '2023-10-15', category: 'other' },
];

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>(INITIAL_EXPENSES);

  // Initialize some mock orders for "Past History" simulation if needed, 
  // or start empty. Let's start with a few to populate the dashboard.
  useEffect(() => {
      // Create some mock orders for "Today" and "Yesterday"
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const mockOrders: Order[] = [
          {
              id: '#OLD-8821',
              timestamp: yesterday.getTime(),
              time: '14:30',
              amount: 45.00,
              itemsCount: 1,
              status: 'paid',
              paymentMethod: 'wechat',
              details: [{ id: 301, name: '中华(硬)', qty: 1, price: 45.00, cost: 38.00, sku: '690102800001' }]
          }
      ];
      setOrders(mockOrders);
  }, []);

  const addProduct = (product: Product) => {
    setProducts(prev => [product, ...prev]);
  };

  const updateProduct = (updatedProduct: Product) => {
    setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
  };

  const deleteProduct = (id: number) => {
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  const addOrder = (order: Order) => {
    setOrders(prev => [order, ...prev]);
    
    // Deduct Stock
    setProducts(prev => prev.map(p => {
        const soldItem = order.details.find(d => d.id === p.id);
        if (soldItem) {
            return { ...p, stock: Math.max(0, p.stock - soldItem.qty) };
        }
        return p;
    }));
  };

  const addExpense = (expense: Expense) => {
      setExpenses(prev => [...prev, expense]);
  };

  const deleteExpense = (id: number) => {
      setExpenses(prev => prev.filter(e => e.id !== id));
  };

  const restockProduct = (productId: number, quantity: number, totalCost: number) => {
      // 1. Update Stock
      setProducts(prev => prev.map(p => {
          if (p.id === productId) {
              return { ...p, stock: p.stock + quantity };
          }
          return p;
      }));

      // 2. Add Expense Log
      const product = products.find(p => p.id === productId);
      const expense: Expense = {
          id: Date.now(),
          name: `进货: ${product ? product.name : 'Unknown'} x${quantity}`,
          amount: totalCost,
          date: new Date().toISOString().split('T')[0],
          category: 'restock'
      };
      setExpenses(prev => [expense, ...prev]);
  };

  return (
    <DataContext.Provider value={{ 
        products, orders, expenses, 
        addProduct, updateProduct, deleteProduct, 
        addOrder, addExpense, deleteExpense,
        restockProduct
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};