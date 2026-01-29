import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './components/ThemeContext';
import { DataProvider } from './components/DataProvider';
import { Layout } from './components/Layout';
import Login from './pages/Login';
import ManagementDashboard from './pages/ManagementDashboard';
import Cashier from './pages/Cashier';
import Inventory from './pages/Inventory';
import Settings from './pages/Settings';

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <DataProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<ManagementDashboard />} />
              <Route path="/cashier" element={<Cashier />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            {/* Fallback route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </DataProvider>
    </ThemeProvider>
  );
};

export default App;