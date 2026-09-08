import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app/App.tsx'
import { UpdateProvider } from './components/UpdateProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UpdateProvider>
      <App />
    </UpdateProvider>
  </StrictMode>,
)
