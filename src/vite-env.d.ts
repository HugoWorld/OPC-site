/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GATEWAY_BASE?: string
  readonly VITE_DATA_ADAPTER?: "feishu" | "local"
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
