// Simple in-memory localStorage / sessionStorage polyfill

export class StoragePolyfill {
    private _map = new Map<string, string>();

    getItem(key: string): string | null {
        const val = this._map.get(String(key));
        return val !== undefined ? val : null;
    }

    setItem(key: string, value: any): void {
        this._map.set(String(key), String(value));
    }

    removeItem(key: string): void {
        this._map.delete(String(key));
    }

    clear(): void {
        this._map.clear();
    }

    get length(): number {
        return this._map.size;
    }

    key(index: number): string | null {
        const keys = Array.from(this._map.keys());
        return keys[index] !== undefined ? keys[index] : null;
    }
}

export function installStorage(target: any) {
    if (typeof target.localStorage === "undefined") {
        target.localStorage = new StoragePolyfill();
    }
    if (typeof target.sessionStorage === "undefined") {
        target.sessionStorage = new StoragePolyfill();
    }
}
