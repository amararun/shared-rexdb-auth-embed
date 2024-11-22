/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FLOWISE_API_ENDPOINT: string
  readonly VITE_API_ENDPOINT: string
  readonly VITE_OPENAI_API_KEY: string
  readonly VITE_OPENAI_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
} 