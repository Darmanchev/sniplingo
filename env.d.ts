interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly WXT_TRANSLATION_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
