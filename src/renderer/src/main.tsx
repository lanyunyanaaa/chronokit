import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { injectCkTokens } from './tokens'
import './i18n'
import './styles.css'

// --ck-* CSS variables must exist before the first paint
injectCkTokens()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
