import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { AppProvider } from './lib/app-context.tsx'
import { backendPromise } from './lib/backend'
import './index.css'

backendPromise.then((backend) =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AppProvider backend={backend}>
        <App />
      </AppProvider>
    </StrictMode>,
  ),
)
