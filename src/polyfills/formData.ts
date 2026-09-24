export class FormDataPolyfill {
    private _data: [string, any][] = [];

    append(name: string, value: any): void {
        this._data.push([String(name), value]);
    }

    set(name: string, value: any): void {
        this._data = this._data.filter(([k]) => k !== String(name));
        this._data.push([String(name), value]);
    }

    get(name: string): any {
        const entry = this._data.find(([k]) => k === String(name));
        return entry ? entry[1] : null;
    }

    getAll(name: string): any[] {
        return this._data.filter(([k]) => k === String(name)).map(([, v]) => v);
    }

    has(name: string): boolean {
        return this._data.some(([k]) => k === String(name));
    }

    delete(name: string): void {
        this._data = this._data.filter(([k]) => k !== String(name));
    }

    entries(): IterableIterator<[string, any]> {
        return this._data[Symbol.iterator]();
    }

    keys(): IterableIterator<string> {
        return this._data.map(([k]) => k)[Symbol.iterator]();
    }

    values(): IterableIterator<any> {
        return this._data.map(([, v]) => v)[Symbol.iterator]();
    }

    forEach(callback: (value: any, key: string, parent: FormDataPolyfill) => void, thisArg?: any): void {
        for (const [k, v] of this._data) {
            callback.call(thisArg, v, k, this);
        }
    }

    [Symbol.iterator](): IterableIterator<[string, any]> {
        return this._data[Symbol.iterator]();
    }

    toString(): string {
        return this._data
            .map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v !== undefined && v !== null ? String(v) : ""))
            .join("&");
    }
}

export function installFormData(target: any) {
    if (typeof target.FormData === "undefined") {
        target.FormData = FormDataPolyfill;
    }
}
