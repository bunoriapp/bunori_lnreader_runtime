import esbuild from 'esbuild';
import fs from 'fs';

async function build() {
    const result = await esbuild.build({
        entryPoints: ['src/index.ts'],
        bundle: true,
        minify: true,
        format: 'iife',
        platform: 'browser',
        target: 'es2020',
        inject: ['./src/shims/buffer-shim.ts'],
        outfile: 'dist/runtime.js',
        metafile: true,
    });

    const stats = fs.statSync('dist/runtime.js');
    console.log(`Build complete, file: dist/runtime.js (${(stats.size / 1024).toFixed(1)} KB)`);
}

build().catch(err => {
    console.error("Build failed:", err);
    process.exit(1);
});
