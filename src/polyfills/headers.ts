export type HeadersInit =
    | HeadersPolyfill
    | [string, string][]
    | Record<string, string | undefined>
    | Iterable<[string, string]>;

export class HeadersPolyfill {
    private _map = new Map<string, {name: string; value: string }>()

    constructor(init?: HeadersInit) {
        if (!init) return;
        if (init instanceof HeadersPolyfill || (typeof init === 'object' && typeof (init as any).forEach === "function")) {
            (init as any).forEach((value: string, key: string) => {
                this.append(key, value);
            });
        } else if (typeof (init as any)[Symbol.iterator] === "function") {
            for (const [k, v] of init as Iterable<[string, string]>) {
                this.append(k, v);
            };
        } else if (typeof init === "object") {
            for (const [k, v] of Object.entries(init)) {
                if (v != undefined && v != null) {
                    this.append(k, String(v));
                }
            }
        }
    }

    append(name: string, value: any): void {
        const key = String(name).trim();
        const lower = key.toLowerCase();
        const val = String(value);

        const existing = this._map.get(lower);
        if (existing) {
            existing.value = `${existing.value}, ${val}`
        } else {
            this._map.set(lower, { name: key, value: val });
        };
    }

    set(name: string, value: any): void {
        const key = String(name).trim();
        this._map.set(key.toLowerCase(), { name: key, value: String(value) });
    }

    get(name: string): string | null {
        const entry = this._map.get(String(name).toLowerCase());
        return entry ? entry.value : null;
    }

    has(name: string): boolean {
        return this._map.has(String(name).toLowerCase());
    }

    delete(name: string): void {
        this._map.delete(String(name).toLowerCase());
    }

    forEach(callback: (value: string, key: string, parent: HeadersPolyfill) => void, thisArgs?: any): void {
        for (const entry of this._map.values()) {
            callback.call(thisArgs, entry.value, entry.name.toLowerCase(), this);
        }
    }

    *entries(): IterableIterator<[string, string]> {
        for (const entry of this._map.values()) {
            yield [entry.name.toLowerCase(), entry.value];
        }
    }

    *keys(): IterableIterator<string> {
        for (const entry of this._map.values()) {
            yield entry.name.toLowerCase();
        }
    }

    *values(): IterableIterator<string> {
        for (const entry of this._map.values()) {
            yield entry.value;
        }
    }

    [Symbol.iterator](): IterableIterator<[string, string]> {
        return this.entries();
    }
}

export function installHeaders(target: any) {
    if (typeof target.Headers === "undefined") {
        target.Headers = HeadersPolyfill;
    }
}
