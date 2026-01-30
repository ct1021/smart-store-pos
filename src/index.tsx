import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { DataProvider } from './components/DataProvider';
import { ThemeProvider } from './components/ThemeContext'; // 1. 引入主题电池

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* 2. 最外层包裹 ThemeProvider */}
    <ThemeProvider>
      {/* 3. 里层包裹 DataProvider */}
      <DataProvider>
        <App />
      </DataProvider>
    </ThemeProvider>
  </React.StrictMode>,
);