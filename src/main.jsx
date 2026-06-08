import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import * as inspireApi from './lib/api.js'

// Expose the API client (configured from VITE_API_URL) so the app + console can use it.
// UI modules migrate off localStorage onto this client in the API-integration slice.
if (typeof window !== 'undefined') {
  window.inspireApi = inspireApi
  console.info('[Inspire CRM] API base:', import.meta.env.VITE_API_URL ?? '/api')
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
