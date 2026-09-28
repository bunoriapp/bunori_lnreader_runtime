#!/usr/bin/env python3
"""
Test runner for Bunori extensions.
Validates that an LNReader / Bunori extension (.ts or .js) compiles and functions
correctly inside the bunori-runtime environment.

Usage:
    python3 test_extension.py <path_to_extension> [--live] [--search QUERY]
"""

import sys
import os
import json
import subprocess
import argparse

# Terminal colors
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"

NODE_RUNNER_CODE = r"""
import esbuild from 'esbuild';
import fs from 'fs';
import vm from 'vm';

const extensionPath = process.argv[1];
const runtimePath = process.argv[2];
const isLive = process.argv[3] === 'true';
const searchQuery = process.argv[4] || 'test';

const report = {
    steps: [],
    capturedRequests: [],
    success: false,
    error: null
};

function logStep(name, status, details = null) {
    report.steps.push({ name, status, details });
}

async function run() {
    // 1. Bundle extension with esbuild
    let bundledCode = '';
    try {
        const result = await esbuild.build({
            entryPoints: [extensionPath],
            bundle: true,
            format: 'cjs',
            write: false,
            external: ['cheerio', '@libs/*', '@/types/*'],
            target: 'es2020'
        });
        bundledCode = result.outputFiles[0].text;
        logStep('bundle', 'ok', { sizeKb: (bundledCode.length / 1024).toFixed(1) });
    } catch (e) {
        logStep('bundle', 'failed', { error: e.message });
        throw e;
    }

    // 2. Set up sandbox with runtime
    const runtimeCode = fs.readFileSync(runtimePath, 'utf8');

    const sandbox = {
        __native_fetch: async (url, initJson) => {
            const init = JSON.parse(initJson);
            report.capturedRequests.push({ url, method: init.method || 'GET', headers: init.headers });

            if (isLive) {
                const headers = {
                    ...init.headers,
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                };
                try {
                    const res = await fetch(url, {
                        method: init.method || 'GET',
                        headers,
                        body: init.body
                    });
                    const text = await res.text();
                    const resHeaders = {};
                    res.headers.forEach((v, k) => { resHeaders[k] = v; });
                    return JSON.stringify({
                        url: res.url,
                        status: res.status,
                        statusText: res.statusText,
                        headers: resHeaders,
                        body: text
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
                // Mock responses for common endpoints
                let mockBody = '';
                if (url.includes('autosuggest') || url.includes('search')) {
                    mockBody = JSON.stringify({
                        items: [{
                            results: [{
                                title: 'Test Novel Result',
                                thumbnail: 'https://example.com/cover.jpg',
                                permalink: '/novel/test-novel/'
                            }]
                        }]
                    });
                } else if (url.includes('chapter-list')) {
                    mockBody = '<div class="ch-list"><a class="ch-link" href="/novel/test-novel/c1">Chapter 1</a></div>';
                } else if (url.includes('/c1')) {
                    mockBody = '<div class="par"><p>Chapter content paragraph 1.</p></div>';
                } else if (url.includes('/novel/')) {
                    mockBody = '<h1 class="entry-title">Test Novel</h1><div class="desc"><p>Test summary</p></div><div class="nov-head"><amp-img src="/cover.jpg"></amp-img></div><table class="info"><tr><td>Author</td><td>:</td><td>Author Name</td></tr></table>';
                } else {
                    mockBody = '<div class="box wide"><a class="list-title" href="/novel/test-novel/">Test Novel</a><amp-img src="/cover.jpg"></amp-img></div>';
                }

                return JSON.stringify({
                    url,
                    status: 200,
                    statusText: 'OK',
                    headers: { 'content-type': 'text/html' },
                    body: mockBody
                });
            }
        },
        __native_log: (level, msg) => {}
    };

    vm.createContext(sandbox);
    vm.runInContext(runtimeCode, sandbox);
    logStep('runtime_init', 'ok');

    // 3. Verify Headers availability
    if (typeof sandbox.Headers !== 'function') {
        throw new Error('globalThis.Headers is not a constructor in this runtime');
    }
    logStep('headers_check', 'ok');

    // 4. Load the extension
    vm.runInContext(bundledCode, sandbox);
    logStep('extension_load', 'ok');

    // 5. Test Bridge calls
    const bridge = sandbox.__bunori_bridge;
    if (!bridge) throw new Error('__bunori_bridge was not created by runtime');

    // getListings
    const listings = bridge.getListings ? bridge.getListings() : [];
    logStep('get_listings', 'ok', { listings: listings.map(l => l.name) });

    // getListingNovels
    const popularNovels = await bridge.getListingNovels('popular', 1);
    logStep('get_popular_novels', 'ok', {
        count: (popularNovels || []).length,
        first: popularNovels && popularNovels[0] ? { title: popularNovels[0].title, url: popularNovels[0].url } : null
    });

    // search
    let searchResults = [];
    try {
        searchResults = await bridge.search(searchQuery, 1);
        logStep('search', 'ok', {
            query: searchQuery,
            count: (searchResults || []).length,
            first: searchResults && searchResults[0] ? { title: searchResults[0].title, url: searchResults[0].url } : null
        });
    } catch (e) {
        logStep('search', 'warning', { message: e.message });
    }

    // getNovelDetails
    const sampleNovelUrl = (popularNovels && popularNovels[0] ? popularNovels[0].url : null) ||
                           (searchResults && searchResults[0] ? searchResults[0].url : null);
    if (sampleNovelUrl) {
        try {
            const details = await bridge.getNovelDetails(sampleNovelUrl);
            logStep('get_novel_details', 'ok', {
                title: details.title,
                author: details.author,
                chapterCount: (details.chapters || []).length
            });

            if (details.chapters && details.chapters.length > 0) {
                const sampleChapterUrl = details.chapters[0].url;
                try {
                    const content = await bridge.getChapterContent(sampleChapterUrl);
                    logStep('get_chapter_content', 'ok', {
                        title: details.chapters[0].title,
                        length: (content || '').length
                    });
                } catch (ce) {
                    logStep('get_chapter_content', 'warning', { message: ce.message });
                }
            }
        } catch (de) {
            logStep('get_novel_details', 'warning', { message: de.message });
        }
    }

    report.success = true;
}

run().catch(err => {
    report.success = false;
    report.error = err.stack || err.message;
}).finally(() => {
    console.log("===JSON_REPORT_START===");
    console.log(JSON.stringify(report));
    console.log("===JSON_REPORT_END===");
});
"""

def main():
    parser = argparse.ArgumentParser(
        description="Test a Bunori/LNReader extension against bunori-runtime."
    )
    parser.add_argument("extension_path", help="Path to the extension (.ts or .js file)")
    parser.add_argument("--live", action="store_true", help="Send real live HTTP requests instead of mock responses")
    parser.add_argument("--search", default="test", help="Query to test searchNovels with (default: 'test')")
    parser.add_argument("--runtime", default=None, help="Path to dist/runtime.js (defaults to local dist/runtime.js)")

    args = parser.parse_args()

    ext_path = os.path.abspath(args.extension_path)
    if not os.path.exists(ext_path):
        print(f"{RED}[ERROR]{RESET} Extension file does not exist: {ext_path}")
        sys.exit(1)

    # Find runtime path
    runtime_dir = os.path.dirname(os.path.abspath(__file__))
    runtime_path = args.runtime or os.path.join(runtime_dir, "dist", "runtime.js")
    runtime_path = os.path.abspath(runtime_path)

    if not os.path.exists(runtime_path):
        print(f"{YELLOW}[INFO]{RESET} dist/runtime.js not found. Running build...")
        subprocess.run(["npm", "run", "build"], cwd=runtime_dir, check=True)

    print(f"\n{BOLD}{CYAN}=== Testing Extension with Bunori Runtime ==={RESET}")
    print(f"{BOLD}Extension:{RESET} {ext_path}")
    print(f"{BOLD}Runtime:{RESET}   {runtime_path}")
    print(f"{BOLD}Mode:{RESET}      {'LIVE NETWORK' if args.live else 'MOCK / OFFLINE'}\n")

    # Run the Node worker
    node_cmd = [
        "node",
        "--input-type=module",
        "-e",
        NODE_RUNNER_CODE,
        ext_path,
        runtime_path,
        "true" if args.live else "false",
        args.search
    ]

    result = subprocess.run(
        node_cmd,
        cwd=runtime_dir,
        capture_output=True,
        text=True
    )

    stdout = result.stdout
    report = None
    if "===JSON_REPORT_START===" in stdout and "===JSON_REPORT_END===" in stdout:
        json_part = stdout.split("===JSON_REPORT_START===")[1].split("===JSON_REPORT_END===")[0].strip()
        try:
            report = json.loads(json_part)
        except json.JSONDecodeError:
            pass

    if not report:
        print(f"{RED}[FAIL] Failed to execute extension worker:{RESET}")
        print(stdout)
        print(result.stderr)
        sys.exit(1)

    # Print step results
    for step in report.get("steps", []):
        name = step.get("name")
        status = step.get("status")
        details = step.get("details") or {}

        if status == "ok":
            status_str = f"{GREEN}✔ OK{RESET}"
        elif status == "warning":
            status_str = f"{YELLOW}⚠ WARN{RESET}"
        else:
            status_str = f"{RED}✖ FAIL{RESET}"

        print(f"[{status_str}] {BOLD}{name}{RESET}")
        if details:
            for k, v in details.items():
                print(f"      • {k}: {v}")

    # Inspect captured HTTP headers
    requests = report.get("capturedRequests", [])
    if requests:
        print(f"\n{BOLD}Captured HTTP Requests ({len(requests)}):{RESET}")
        for idx, req in enumerate(requests, 1):
            url = req.get("url")
            headers = req.get("headers") or {}
            print(f"  {idx}. {req.get('method')} {url}")

            # Highlight specific headers like Alt-Used
            alt_used = next((headers[k] for k in headers if k.lower() == "alt-used"), None)
            if alt_used:
                print(f"     {GREEN}✔ Alt-Used header detected:{RESET} {alt_used}")
            else:
                print(f"     (Alt-Used not present in this request)")

    if report.get("success"):
        print(f"\n{GREEN}{BOLD}=== Extension test passed successfully! ==={RESET}\n")
    else:
        print(f"\n{RED}{BOLD}=== Extension test encountered errors: ==={RESET}")
        print(report.get("error", "Unknown error"))
        sys.exit(1)

if __name__ == "__main__":
    main()
