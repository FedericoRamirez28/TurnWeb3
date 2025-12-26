import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { AuthProvider } from '@/auth/AuthProvider'
import '@/styles/global.scss'

console.log('[ENV]', {
  MODE: import.meta.env.MODE,
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
})


ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
)
