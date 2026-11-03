/// <reference types="vitest/config" />
import path from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// GitHub Pages serves the site under /<repository-name>/. The workflow sets GITHUB_REPOSITORY to "owner/name"; a build
// outside the workflow uses this repository's own name (medoma-resilience-sus, from the git remote); the dev server uses "/".
const REPOSITORY_NAME = 'medoma-resilience-sus';
const repository = process.env.GITHUB_REPOSITORY;
const name = repository ? repository.split('/')[1] : REPOSITORY_NAME;

export default defineConfig(({ command }) => ({
  base: command === 'build' ? `/${name}/` : '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
}));
