import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const args = process.argv.slice(2);
const isLive = args.includes('--live');
const targetFile = args.find(a => !a.startsWith('--')) || 
    path.resolve(process.env.HOME || '', '');

if (!fs.existsSync(targetFile)) {
    console.error(`\x1b[31m[ERROR]\x1b[0m Extension file not found: ${targetFile}`);
    console.log(`\nUsage: node test/test-extension.mjs [path-to-plugin.ts|js] [--live]`);
    process.exit(1);
}

const runtimePath = path.resolve('dist/runtime.js');
if (!fs.existsSync(runtimePath)) {
    console.log("Building runtime first...");
    const { execSync } = await import('child_process');
    execSync('npm run build', { stdio: 'inherit' });
}

console.log(`\x1b[36m=== Testing Extension in Bunori Runtime ===\x1b[0m`);
console.log(`Plugin target: ${targetFile}`);
console.log(`Mode: ${isLive ? 'LIVE NETWORK' : 'MOCK / DRY-RUN'}\n`);

// 1. Bundle plugin with esbuild
console.log(`1. Bundling plugin with esbuild...`);
let pluginCode = '';
try {
    const result = await esbuild.build({
        entryPoints: [targetFile],
        bundle: true,
        format: 'cjs',
        write: false,
        external: ['cheerio', '@libs/*', '@/types/*'],
        target: 'es2020'
    });
    pluginCode = result.outputFiles[0].text;
    console.log(`   \x1b[32m✔\x1b[0m Bundled successfully (${(pluginCode.length / 1024).toFixed(1)} KB)`);
} catch (err) {
    console.error(`   \x1b[31m✖ Bundling failed:\x1b[0m`, err);
    process.exit(1);
}

// 2. Set up sandbox
const runtimeCode = fs.readFileSync(runtimePath, 'utf8');
const capturedRequests = [];

const sandbox = {
    __native_fetch: async (url, initJson) => {
        const init = JSON.parse(initJson);
        capturedRequests.push({ url, init });

        if (isLive) {
            console.log(`   \x1b[34m[HTTP]\x1b[0m ${init.method || 'GET'} ${url}`);
            const headers = {
                ...init.headers,
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            };
            try {
                const res = await fetch(url, {
                    method: init.method || 'GET',
                    headers: headers,
                    body: init.body
                });
                const bodyText = await res.text();
                const resHeaders = {};
                res.headers.forEach((v, k) => { resHeaders[k] = v; });
                return JSON.stringify({
                    url: res.url,
                    status: res.status,
                    statusText: res.statusText,
                    headers: resHeaders,
                    body: bodyText
                });
            } catch (err) {
                return JSON.stringify({
                    url,
                    status: 500,
                    statusText: String(err),
                    headers: {},
                    body: ''
                });
            }
        } else {
            console.log(`   \x1b[34m[MOCK FETCH]\x1b[0m ${init.method || 'GET'} ${url}`);
            // Return dummy HTML
            return JSON.stringify({
                url,
                status: 200,
                statusText: 'OK',
                headers: { 'content-type': 'text/html' },
                body: '<div class="box wide"><a class="list-title" href="/test-novel">Test Novel</a></div>'
            });
        }
    },
    __native_log: (level, msg) => {
        console.log(`   [Runtime ${level}]`, msg);
    }
};

vm.createContext(sandbox);

// 3. Load runtime
console.log(`2. Loading Bunori runtime into VM...`);
try {
    vm.runInContext(runtimeCode, sandbox);
    console.log(`   \x1b[32m✔\x1b[0m Runtime initialized`);
} catch (err) {
    console.error(`   \x1b[31m✖ Runtime load error:\x1b[0m`, err);
    process.exit(1);
}

// 4. Verify Headers polyfill is installed
console.log(`3. Verifying Headers polyfill...`);
if (typeof sandbox.Headers !== 'function') {
    console.error(`   \x1b[31m✖ Headers constructor is NOT defined on globalThis!\x1b[0m`);
    process.exit(1);
}
const testH = new sandbox.Headers();
testH.append('Alt-Used', 'www.mtlnovels.com');
if (testH.get('alt-used') !== 'www.mtlnovels.com' || !testH.has('alt-used')) {
    console.error(`   \x1b[31m✖ Headers case-insensitive get/has failed!\x1b[0m`);
    process.exit(1);
}
console.log(`   \x1b[32m✔\x1b[0m Headers polyfill operational`);

// 5. Load the extension
console.log(`4. Loading extension into VM...`);
try {
    vm.runInContext(pluginCode, sandbox);
    console.log(`   \x1b[32m✔\x1b[0m Extension evaluated without syntax/reference errors`);
} catch (err) {
    console.error(`   \x1b[31m✖ Extension evaluation failed:\x1b[0m`, err);
    process.exit(1);
}

// 6. Test bridge methods
console.log(`5. Testing Bunori Bridge calls...`);
const bridge = sandbox.__bunori_bridge;
if (!bridge) {
    console.error(`   \x1b[31m✖ __bunori_bridge is missing!\x1b[0m`);
    process.exit(1);
}

try {
    const listings = bridge.getListings();
    console.log(`   \x1b[32m✔\x1b[0m bridge.getListings():`, listings.map(l => l.name).join(', '));

    console.log(`   Invoking bridge.getListingNovels("popular", 1)...`);
    const novels = await bridge.getListingNovels('popular', 1);
    console.log(`   \x1b[32m✔\x1b[0m Fetched ${novels.length} novels`);

    // Verify captured headers
    console.log(`6. Inspecting outgoing request headers...`);
    if (capturedRequests.length > 0) {
        for (const req of capturedRequests) {
            console.log(`   URL: ${req.url}`);
            console.log(`   Headers:`, JSON.stringify(req.init.headers, null, 2));
            const altUsed = Object.keys(req.init.headers).find(k => k.toLowerCase() === 'alt-used');
            if (altUsed) {
                console.log(`   \x1b[32m✔ 'Alt-Used' header present: ${req.init.headers[altUsed]}\x1b[0m`);
            } else {
                console.log(`   \x1b[33m⚠ 'Alt-Used' header not detected in this request\x1b[0m`);
            }
        }
    }

    console.log(`\n\x1b[32m=== Extension Test Passed Successfully! ===\x1b[0m\n`);
} catch (err) {
    console.error(`\n\x1b[31m✖ Runtime bridge test failed:\x1b[0m`, err.message);
    if (capturedRequests.length > 0) {
        console.log(`Captured requests before failure:`, capturedRequests);
    }
    process.exit(1);
}
