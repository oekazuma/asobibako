// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
  /** ペットの形の控えの版（vite.config.ts が形のコードの中身から作る） */
  const __PET_SHAPES__: string;
}

export {};
