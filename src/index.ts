import { installConsole } from './polyfills/console';
import { installEncoding } from './polyfills/encoding';
import { installBuffer } from './polyfills/buffer';
import { installFormData } from './polyfills/formData';
import { installURL } from './polyfills/url';
import { installFetch } from './polyfills/fetch';
import { installCheerio } from './libs/cheerio';
import { installCrypto } from './libs/crypto';
import { installLNReaderModules } from './lnreader/modules';
import { installBunoriBridge } from './bridge/bunoriBridge';
import dayjs from 'dayjs';

const g: any = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : this;

g.globalThis = g;
g.window = g;
g.global = g;
g.exports = {};
g.module = { exports: g.exports };
g.process = { env: {} };

if (typeof g.setTimeout === "undefined") {
    g.setTimeout = (fn: Function, _ms: number, ...args: any[]) => {
        if (typeof fn === "function") fn(...args);
        return 0;
    };
    g.clearTimeout = () => {};
}
if (typeof g.setInterval === "undefined") {
    g.setInterval = () => 0;
    g.clearInterval = () => {};
}

installConsole(g);
installEncoding(g);
installBuffer(g);
installFormData(g);
installURL(g);
installFetch(g);

installCheerio(g);
installCrypto(g);
g.dayjs = dayjs;

installLNReaderModules(g);
installBunoriBridge(g);

export const RUNTIME_VERSION = "1.0.0";
