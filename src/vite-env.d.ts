/// <reference types="vite/client" />
/// <reference types="react" />
/// <reference types="react-dom" />

interface ImportMetaEnv {
  readonly VITE_POKEAPI_BASE_URL: string
  // add other VITE_* variables here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}