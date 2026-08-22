import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { registerSW } from 'virtual:pwa-register'

let updateServiceWorker;

updateServiceWorker = registerSW({
  onNeedRefresh() {
    window.dispatchEvent(new CustomEvent('namao_update_available', {
      detail: { update: () => updateServiceWorker(true) },
    }));
  },
  onOfflineReady() {},
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
