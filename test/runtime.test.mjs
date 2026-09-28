import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import vm from 'node:vm';

const runtimeCode = fs.readFileSync(new URL('../dist/runtime.js', import.meta.url), 'utf8');

function createEnvironment() {
    let capturedRequest = null;
    let loggedMessages = [];

    const sandbox = {
        __native_fetch: async (url, initJson) => {
            capturedRequest = { url, init: JSON.parse(initJson) };
            return JSON.stringify({
                status: 200,
                statusText: "OK",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ success: true, count: 42 })
            });
        },
        __native_log: (level, msg) => {
            loggedMessages.push({ level, msg });
        }
    };

    vm.createContext(sandbox);
    vm.runInContext(runtimeCode, sandbox);

    return { sandbox, getCapturedRequest: () => capturedRequest, getLogs: () => loggedMessages };
}

test('FormData polyfill operations', () => {
    const { sandbox } = createEnvironment();
    const fd = new sandbox.FormData();

    fd.append('action', 'nd_getchapters');
    fd.append('mypostid', '999');
    fd.append('tag', 'fantasy');
    fd.append('tag', 'action');

    assert.strictEqual(fd.get('action'), 'nd_getchapters');
    assert.strictEqual(fd.get('mypostid'), '999');
    assert.deepStrictEqual([...fd.getAll('tag')], ['fantasy', 'action']);
    assert.strictEqual(fd.has('action'), true);
    assert.strictEqual(fd.has('nonexistent'), false);

    assert.strictEqual(fd.toString(), 'action=nd_getchapters&mypostid=999&tag=fantasy&tag=action');
});

test('URLSearchParams and iterable initialization', () => {
    const { sandbox } = createEnvironment();
    const fd = new sandbox.FormData();
    fd.append('query', 'solo leveling');
    fd.append('page', '2');

    const sp = new sandbox.URLSearchParams(fd);
    assert.strictEqual(sp.toString(), 'query=solo+leveling&page=2'.replace('+', '%20'));
});

test('fetchApi serializes FormData with correct Content-Type', async () => {
    const { sandbox, getCapturedRequest } = createEnvironment();
    const fd = new sandbox.FormData();
    fd.append('action', 'nd_getchapters');
    fd.append('mypostid', '12345');

    const response = await sandbox.fetchApi('https://www.novelupdates.com/wp-admin/admin-ajax.php', {
        method: 'POST',
        body: fd
    });

    const captured = getCapturedRequest();
    assert.strictEqual(captured.url, 'https://www.novelupdates.com/wp-admin/admin-ajax.php');
    assert.strictEqual(captured.init.method, 'POST');
    assert.strictEqual(captured.init.headers['Content-Type'], 'application/x-www-form-urlencoded; charset=UTF-8');
    assert.strictEqual(captured.init.body, 'action=nd_getchapters&mypostid=12345');

    assert.strictEqual(response.url, 'https://www.novelupdates.com/wp-admin/admin-ajax.php');
    assert.strictEqual(response.redirected, false);

    const data = await response.json();
    assert.strictEqual(data.success, true);
});

test('fetchApi handles redirected response.url correctly', async () => {
    let capturedRequest = null;
    const sandbox = {
        __native_fetch: async (url, initJson) => {
            capturedRequest = { url, init: JSON.parse(initJson) };
            return JSON.stringify({
                url: "https://www.webnovel.com/rssbook/123/456",
                status: 200,
                statusText: "OK",
                headers: { "content-type": "text/html" },
                body: "<html><head><title>Chapter 1</title></head><body>Content</body></html>"
            });
        }
    };

    vm.createContext(sandbox);
    vm.runInContext(runtimeCode, sandbox);

    const res = await sandbox.fetchApi('https://www.novelupdates.com/extnu/2303410/');
    assert.strictEqual(res.url, 'https://www.webnovel.com/rssbook/123/456');
    assert.strictEqual(res.redirected, true);

    const domainParts = res.url.toLowerCase().split('/')[2].split('.');
    assert.deepStrictEqual([...domainParts], ['www', 'webnovel', 'com']);
});

test('Cheerio HTML parsing works correctly', () => {
    const { sandbox } = createEnvironment();
    const html = `
        <div class="seriestitlenu">Shadow Slave</div>
        <ul class="chapters">
            <li class="sp_li_chp"><a href="/ch1">Chapter 1</a></li>
            <li class="sp_li_chp"><a href="/ch2">Chapter 2</a></li>
        </ul>
    `;

    const $ = sandbox.parseHTML(html);
    assert.strictEqual($('.seriestitlenu').text().trim(), 'Shadow Slave');
    assert.strictEqual($('li.sp_li_chp').length, 2);
    assert.strictEqual($('li.sp_li_chp a').first().text(), 'Chapter 1');
});

test('CommonJS environment, require, and __bunori_bridge are properly defined', () => {
    const { sandbox } = createEnvironment();

    assert.strictEqual(typeof sandbox.exports, 'object');
    assert.strictEqual(typeof sandbox.module, 'object');
    assert.strictEqual(sandbox.module.exports, sandbox.exports);

    assert.strictEqual(typeof sandbox.require, 'function');
    const fetchMod = sandbox.require('@libs/fetch');
    assert.strictEqual(typeof fetchMod.fetchApi, 'function');

    const statusMod = sandbox.require('@libs/novelStatus');
    assert.strictEqual(statusMod.NovelStatus.Ongoing, 'Ongoing');

    const storageMod = sandbox.require('@libs/storage');
    assert.strictEqual(typeof storageMod.storage.get, 'function');
    assert.strictEqual(storageMod.storage.get('hideLocked'), undefined);
    storageMod.storage.set('hideLocked', true);
    assert.strictEqual(storageMod.storage.get('hideLocked'), true);

    const htmlparser2Mod = sandbox.require('htmlparser2');
    assert.strictEqual(typeof htmlparser2Mod.Parser, 'function');

    assert.strictEqual(typeof sandbox.__bunori_bridge, 'object');
    assert.strictEqual(typeof sandbox.__bunori_bridge.search, 'function');
    assert.strictEqual(typeof sandbox.__bunori_bridge.getNovelDetails, 'function');
    assert.strictEqual(typeof sandbox.__bunori_bridge.getChapterContent, 'function');
    assert.strictEqual(typeof sandbox.__bunori_bridge.getListings, 'function');
    assert.strictEqual(typeof sandbox.__bunori_bridge.getListingNovels, 'function');
});

test('Headers polyfill operations', () => {
    const { sandbox } = createEnvironment();

    assert.strictEqual(typeof sandbox.Headers, 'function');
    const fetchMod = sandbox.require('@libs/fetch');
    assert.strictEqual(typeof fetchMod.Headers, 'function');

    const headers = new sandbox.Headers({
        'Content-Type': 'application/json',
        'X-Custom': 'initial'
    });

    assert.strictEqual(headers.get('content-type'), 'application/json');
    assert.strictEqual(headers.get('Content-Type'), 'application/json');
    assert.strictEqual(headers.has('content-type'), true);
    assert.strictEqual(headers.has('nonexistent'), false);

    headers.append('Alt-Used', 'www.mtlnovels.com');
    assert.strictEqual(headers.get('alt-used'), 'www.mtlnovels.com');
    assert.strictEqual(headers.has('alt-used'), true);

    headers.append('Accept-Encoding', 'gzip');
    headers.append('Accept-Encoding', 'deflate');
    assert.strictEqual(headers.get('accept-encoding'), 'gzip, deflate');

    headers.set('x-custom', 'updated');
    assert.strictEqual(headers.get('X-Custom'), 'updated');

    headers.delete('content-type');
    assert.strictEqual(headers.get('content-type'), null);
    assert.strictEqual(headers.has('content-type'), false);

    const keys = [...headers.keys()];
    assert.ok(keys.includes('alt-used'));
    assert.ok(keys.includes('accept-encoding'));
    assert.ok(keys.includes('x-custom'));
});

test('safeFecth pattern and fetchApi header serialization', async () => {
    const { sandbox, getCapturedRequest } = createEnvironment();

    sandbox.safeFecth = async function(url, headers = new sandbox.Headers()) {
        headers.append('Alt-Used', 'www.mtlnovels.com');
        const r = await sandbox.fetchApi(url, { headers });
        if (!r.ok) {
            throw new Error('Could not reach site (' + r.status + ') try to open in webview.');
        }
        return r;
    };

    const res = await sandbox.safeFecth('https://www.mtlnovels.com/novel-list/');
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.headers.get('content-type'), 'application/json');

    const captured = getCapturedRequest();
    assert.strictEqual(captured.url, 'https://www.mtlnovels.com/novel-list/');
    const capturedHeaders = captured.init.headers;
    const altUsedKey = Object.keys(capturedHeaders).find(k => k.toLowerCase() === 'alt-used');
    assert.ok(altUsedKey, 'Alt-Used header should be present in fetch request');
    assert.strictEqual(capturedHeaders[altUsedKey], 'www.mtlnovels.com');
});

test('MTLNovel plugin integration with mock HTML and safeFecth', async () => {
    const { sandbox } = createEnvironment();

    // Mock HTML responses for MTLNovel endpoints
    const mockNovelListHtml = `
        <div class="box wide">
            <amp-img src="https://pt.mtlnovels.com/cover.jpg"></amp-img>
            <a class="list-title" href="https://pt.mtlnovels.com/martial-peak/">Martial Peak</a>
        </div>
    `;

    const mockNovelDetailHtml = `
        <h1 class="entry-title">Martial Peak</h1>
        <div class="nov-head"><amp-img src="https://pt.mtlnovels.com/cover.jpg"></amp-img></div>
        <div class="desc"><h2>Summary</h2><p>The journey to the martial peak is lonely.</p></div>
        <table class="info">
            <tr><td>Author</td><td>:</td><td>Momo</td></tr>
            <tr><td>Genre</td><td>:</td><td>Action, Martial Arts</td></tr>
            <tr><td>Status</td><td>:</td><td>Completed</td></tr>
        </table>
    `;

    const mockChapterListHtml = `
        <div class="ch-list">
            <a class="ch-link" href="https://pt.mtlnovels.com/martial-peak/chapter-1/">~ Chapter 1</a>
            <a class="ch-link" href="https://pt.mtlnovels.com/martial-peak/chapter-2/">~ Chapter 2</a>
        </div>
    `;

    const mockChapterContentHtml = `
        <div class="par"><p>Chapter 1 text content goes here.</p></div>
    `;

    let capturedHeadersList = [];
    sandbox.__native_fetch = async (url, initJson) => {
        const init = JSON.parse(initJson);
        capturedHeadersList.push({ url, headers: init.headers });

        let body = '';
        if (url.includes('chapter-1')) {
            body = mockChapterContentHtml;
        } else if (url.includes('chapter-list')) {
            body = mockChapterListHtml;
        } else if (url.includes('martial-peak')) {
            body = mockNovelDetailHtml;
        } else {
            body = mockNovelListHtml;
        }

        return JSON.stringify({
            status: 200,
            statusText: 'OK',
            headers: { 'content-type': 'text/html' },
            body: body
        });
    };

    // Minimal MTLNovel plugin simulating the real plugin structure
    const pluginCode = `
        const { load: parseHTML } = require('cheerio');
        const { fetchApi } = require('@libs/fetch');
        const { defaultCover } = require('@libs/defaultCover');

        class MTLNovelPlugin {
            constructor() {
                this.site = 'https://pt.mtlnovels.com/';
                this.mainUrl = 'https://www.mtlnovels.com/';
            }

            async safeFecth(url, headers = new Headers()) {
                headers.append('Alt-Used', 'www.mtlnovels.com');
                const r = await fetchApi(url, { headers });
                if (!r.ok) throw new Error('Could not reach site (' + r.status + ') try to open in webview.');
                return r;
            }

            async popularNovels(page, { filters, showLatestNovels }) {
                const body = await this.safeFecth(this.site + 'novel-list/?pg=' + page).then(r => r.text());
                const loadedCheerio = parseHTML(body);
                const novels = [];
                loadedCheerio('div.box.wide').each((i, el) => {
                    const name = loadedCheerio(el).find('a.list-title').text().trim();
                    const cover = loadedCheerio(el).find('amp-img').attr('src') || defaultCover;
                    const url = loadedCheerio(el).find('a.list-title').attr('href');
                    if (url) novels.push({ name, cover, path: url.replace(this.mainUrl, '').replace(this.site, '') });
                });
                return novels;
            }

            async parseNovel(novelPath) {
                const headers = new Headers();
                headers.append('Referer', this.site + 'novel-list/');
                const body = await this.safeFecth(this.site + novelPath, headers).then(r => r.text());
                const $ = parseHTML(body);
                const listBody = await this.safeFecth(this.site + novelPath + 'chapter-list/', headers).then(r => r.text());
                const $ch = parseHTML(listBody);
                const chapters = [];
                $ch('div.ch-list a.ch-link').each((i, el) => {
                    chapters.push({
                        path: $ch(el).attr('href').replace(this.mainUrl, '').replace(this.site, ''),
                        name: $ch(el).text().replace('~ ', '')
                    });
                });
                return {
                    path: novelPath,
                    name: $('h1.entry-title').text().trim(),
                    cover: $('.nov-head amp-img').attr('src') || defaultCover,
                    summary: $('div.desc p').text().trim(),
                    author: 'Momo',
                    status: 'Completed',
                    chapters: chapters.reverse()
                };
            }

            async parseChapter(chapterPath) {
                const body = await this.safeFecth(this.site + chapterPath).then(r => r.text());
                const $ = parseHTML(body);
                return $('div.par').html() || '';
            }
        }

        module.exports = { default: MTLNovelPlugin };
    `;

    // Load plugin into the runtime VM
    vm.runInContext(pluginCode, sandbox);

    // Verify Bunori bridge hooks into the plugin correctly
    const popular = await sandbox.__bunori_bridge.getListingNovels('popular', 1);
    assert.strictEqual(popular.length, 1);
    assert.strictEqual(popular[0].title, 'Martial Peak');
    assert.strictEqual(popular[0].url, 'https://pt.mtlnovels.com/martial-peak/');

    const details = await sandbox.__bunori_bridge.getNovelDetails('https://pt.mtlnovels.com/martial-peak/');
    assert.strictEqual(details.title, 'Martial Peak');
    assert.strictEqual(details.author, 'Momo');
    assert.strictEqual(details.chapters.length, 2);
    assert.strictEqual(details.chapters[0].title, 'Chapter 2');

    const content = await sandbox.__bunori_bridge.getChapterContent('https://pt.mtlnovels.com/martial-peak/chapter-1/');
    assert.ok(content.includes('Chapter 1 text content'));

    // Verify all requests had Alt-Used: www.mtlnovels.com
    assert.ok(capturedHeadersList.length >= 3);
    for (const req of capturedHeadersList) {
        const altUsed = Object.keys(req.headers).find(k => k.toLowerCase() === 'alt-used');
        assert.ok(altUsed, 'Every request must include Alt-Used');
        assert.ok(req.headers[altUsed].includes('www.mtlnovels.com'));
    }
});

