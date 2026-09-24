// Bunori Runtime Entry Point
import { installConsole } from './polyfills/console';
import { installEncoding } from './polyfills/encoding';
import { installBuffer } from './polyfills/buffer';
import { installFormData } from './polyfills/formData';
import { installURL } from './polyfills/url';
import { installStorage } from './polyfills/storage';
import { installFetch } from './polyfills/fetch';
import { installCheerio } from './libs/cheerio';
import { installCrypto } from './libs/crypto';
import dayjs from 'dayjs';

// Resolve global scope
const g: any = typeof globalThis !== "undefined"
    ? globalThis
    : typeof window !== "undefined"
        ? window
        : typeof global !== "undefined"
            ? global
            : this;

g.globalThis = g;
g.window = g;
g.global = g;

// Timers fallback
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

// Install Polyfills
installConsole(g);
installEncoding(g);
installBuffer(g);
installFormData(g);
installURL(g);
installStorage(g);
installFetch(g);

// Install Libraries
installCheerio(g);
installCrypto(g);
g.dayjs = dayjs;

// Export metadata
export const RUNTIME_VERSION = "1.0.0";
