// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// We import App, which contains the <Router> inside it
import App from './App.jsx'
import './index.css'

// 1. Create the Query Client (The Data Cache)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Prevents reloading data when you click other tabs
      retry: 1, // If API fails, try one more time before showing error
      staleTime: 5 * 60 * 1000, // Data stays fresh for 5 minutes (Performance boost)
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* 2. Wrap App with Query Provider */}
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
)