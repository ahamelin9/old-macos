/// <reference types="vite/client" />
/// <reference types="react" />
/// <reference types="react-dom" />

interface ImportMetaEnv {
  readonly VITE_POKEAPI_BASE_URL: string;
  readonly VITE_ENABLE_CORS_PROXY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
  }
}