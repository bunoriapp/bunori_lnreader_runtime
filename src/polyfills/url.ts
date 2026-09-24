// URL and URLSearchParams Polyfills for QuickJS

export class URLSearchParamsPolyfill {
    private _params: [string, string][] = [];

    constructor(init?: string | [string, string][] | Record<string, any> | Iterable<[string, any]>) {
        if (!init) return;

        if (typeof init === "string") {
            const str = init.startsWith("?") ? init.slice(1) : init;
            if (str.length > 0) {
                const pairs = str.split("&");
                for (const pair of pairs) {
                    const idx = pair.indexOf("=");
                    if (idx !== -1) {
                        this.append(decodeURIComponent(pair.slice(0, idx)), decodeURIComponent(pair.slice(idx + 1)));
                    } else {
                        this.append(decodeURIComponent(pair), "");
                    }
                }
            }
        } else if (Array.isArray(init)) {
            for (const [k, v] of init) {
                this.append(k, v);
            }
        } else if (init && typeof (init as any)[Symbol.iterator] === "function") {
            for (const [k, v] of (init as Iterable<[string, any]>)) {
                this.append(k, v);
            }
        } else if (typeof init === "object" && init !== null) {
            for (const key of Object.keys(init)) {
                this.append(key, (init as any)[key]);
            }
        }
    }

    append(name: string, value: any): void {
        this._params.push([String(name), String(value)]);
    }

    set(name: string, value: any): void {
        const key = String(name);
        const val = String(value);
        let found = false;
        this._params = this._params.filter(([k]) => {
            if (k === key && !found) {
                found = true;
                return false;
            }
            return k !== key;
        });
        this._params.push([key, val]);
    }

    get(name: string): string | null {
        const key = String(name);
        const entry = this._params.find(([k]) => k === key);
        return entry ? entry[1] : null;
    }

    getAll(name: string): string[] {
        const key = String(name);
        return this._params.filter(([k]) => k === key).map(([, v]) => v);
    }

    has(name: string): boolean {
        const key = String(name);
        return this._params.some(([k]) => k === key);
    }

    delete(name: string): void {
        const key = String(name);
        this._params = this._params.filter(([k]) => k !== key);
    }

    keys(): IterableIterator<string> {
        return this._params.map(([k]) => k)[Symbol.iterator]();
    }

    values(): IterableIterator<string> {
        return this._params.map(([, v]) => v)[Symbol.iterator]();
    }

    entries(): IterableIterator<[string, string]> {
        return this._params[Symbol.iterator]();
    }

    forEach(callback: (value: string, key: string, parent: URLSearchParamsPolyfill) => void, thisArg?: any): void {
        for (const [k, v] of this._params) {
            callback.call(thisArg, v, k, this);
        }
    }

    [Symbol.iterator](): IterableIterator<[string, string]> {
        return this._params[Symbol.iterator]();
    }

    toString(): string {
        return this._params
            .map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v))
            .join("&");
    }
}

export class URLPolyfill {
    private _href: string = "";
    private _protocol: string = "";
    private _host: string = "";
    private _hostname: string = "";
    private _port: string = "";
    private _pathname: string = "/";
    private _search: string = "";
    private _hash: string = "";
    private _searchParams: URLSearchParamsPolyfill;

    constructor(url: string, base?: string) {
        let full = String(url);
        if (base) {
            const b = String(base);
            if (!full.includes("://")) {
                if (full.startsWith("//")) {
                    const protoIdx = b.indexOf("://");
                    full = (protoIdx !== -1 ? b.slice(0, protoIdx + 1) : "https:") + full;
                } else if (full.startsWith("/")) {
                    const m = b.match(/^([a-zA-Z]+:\/\/[^/]+)/);
                    full = m ? m[1] + full : b + full;
                } else {
                    const lastSlash = b.lastIndexOf("/");
                    full = (lastSlash !== -1 ? b.slice(0, lastSlash + 1) : b + "/") + full;
                }
            }
        }

        const match = full.match(/^([a-zA-Z]+:)\/\/([^/?#]+)([^?#]*)(?:\?([^#]*))?(?:#(.*))?$/);
        if (match) {
            this._protocol = match[1];
            this._host = match[2];
            const portIdx = this._host.indexOf(":");
            if (portIdx !== -1) {
                this._hostname = this._host.slice(0, portIdx);
                this._port = this._host.slice(portIdx + 1);
            } else {
                this._hostname = this._host;
                this._port = "";
            }
            this._pathname = match[3] || "/";
            this._search = match[4] ? "?" + match[4] : "";
            this._hash = match[5] ? "#" + match[5] : "";
        } else {
            this._pathname = full;
        }

        this._href = full;
        this._searchParams = new URLSearchParamsPolyfill(this._search);
    }

    get href() { return this._href; }
    get origin() { return this._protocol ? `${this._protocol}//${this._host}` : ""; }
    get protocol() { return this._protocol; }
    get host() { return this._host; }
    get hostname() { return this._hostname; }
    get port() { return this._port; }
    get pathname() { return this._pathname; }
    get search() { return this._search; }
    get hash() { return this._hash; }
    get searchParams() { return this._searchParams; }

    toString() { return this._href; }
    toJSON() { return this._href; }
}

export function installURL(target: any) {
    if (typeof target.URLSearchParams === "undefined") {
        target.URLSearchParams = URLSearchParamsPolyfill;
    }
    if (typeof target.URL === "undefined") {
        target.URL = URLPolyfill;
    }
}
