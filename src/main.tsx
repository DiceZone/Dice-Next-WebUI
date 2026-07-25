import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './i18n'; // initialize i18next before the app renders
// C#109：字体本地化（woff2 随包分发，不再从 Google Fonts CDN 拉取——部分地区无法访问）
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error(
    'Root element not found. Make sure there is a <div id="root"></div> in index.html.'
  );
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
