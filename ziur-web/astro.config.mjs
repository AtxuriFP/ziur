// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
    vite: {
      resolve: {
        alias: {
          '@lib': '/lib'  // This maps @lib to your lib directory
        }
      }
    }
  });
