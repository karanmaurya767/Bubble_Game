import { defineConfig } from 'vite';

export default defineConfig({
    root: '.',
    publicDir: 'assets',
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        target: 'es2020',
        minify: 'esbuild',
        sourcemap: true,
        rollupOptions: {
            input: {
                main: 'index.html',
            },
        },
        cssMinify: true,
    },
    server: {
        port: 3000,
        open: true,
        host: true,
    },
    preview: {
        port: 4173,
        host: true,
    },
});