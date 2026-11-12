import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// VITE_BASE lets the site be served from a sub-path (GitHub Pages project sites); default is the domain root.
export default defineConfig({ base: process.env.VITE_BASE || '/', plugins: [react()] });
