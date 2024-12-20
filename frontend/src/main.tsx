import React from 'react'
import ReactDOM from 'react-dom/client'
import { Auth0Provider } from '@auth0/auth0-react'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Auth0Provider
      domain={import.meta.env.VITE_AUTH0_DOMAIN}
      clientId={import.meta.env.VITE_AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: window.location.origin,
        response_type: "token id_token",
        response_mode: "fragment",
      }}
      useRefreshTokens={true}
      cacheLocation="localstorage"
      skipRedirectCallback={window !== window.parent}
    >
      <App />
    </Auth0Provider>
  </React.StrictMode>,
)
