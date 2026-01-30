import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout'; // 使用你原本的 Layout
import Login from './pages/Login';
import Cashier from './pages/Cashier';
import Inventory from './pages/Inventory';
import ManagementDashboard from './pages/ManagementDashboard';
import Settings from './pages/Settings';

export default function App() {
  return (
    <Router>
      <Routes>
        {/* 登录页独立路由 */}
        <Route path="/" element={<Login />} />

        {/* 你的 App 布局结构 */}
        <Route element={<Layout />}>
          {/* 这里的 path 需要和你 Layout.tsx 里的 navItems 对应 */}
          <Route path="/dashboard" element={<ManagementDashboard />} />
          <Route path="/cashier" element={<Cashier />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        {/* 默认重定向 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}