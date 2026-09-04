import React from 'react';
import ReactDOM from 'react-dom/client';
import Popup from './Popup.jsx';
import './popup.css';
import '@/lib/i18n.js';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>,
);
