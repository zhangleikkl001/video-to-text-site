// @ts-check
import { defineConfig } from 'astro/config';

import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  site: 'https://lifeofcity.com',
  integrations: [tailwind()],
  vite: {
    server: {
      allowedHosts: [
        'lifeofcity.com',
        'www.lifeofcity.com',
        'localhost'
      ]
    }
  }
});
