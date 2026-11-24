import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    // Only the simulator's own tests: without this, `npm test` also discovers
    // the Hallmark skill's internal tests under .agents/ and fails on them.
    include: ['test/**/*.{js,jsx}'],
  },
});
