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
