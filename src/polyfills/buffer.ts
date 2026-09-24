import { btoaPolyfill, atobPolyfill } from './encoding';

export class BufferPolyfill extends Uint8Array {
    static isBuffer(obj: any): boolean {
        return obj instanceof BufferPolyfill || (obj && obj._isBuffer);
    }

    static from(data: any, encoding?: string): BufferPolyfill {
        if (typeof data === "string") {
            if (encoding === "base64") {
                const binary = atobPolyfill(data);
                const buf = new BufferPolyfill(binary.length);
                for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
                return buf;
            }
            if (encoding === "hex") {
                const len = data.length / 2;
                const buf = new BufferPolyfill(len);
                for (let i = 0; i < len; i++) {
                    buf[i] = parseInt(data.substring(i * 2, i * 2 + 2), 16);
                }
                return buf;
            }
            // default UTF-8
            const s = unescape(encodeURIComponent(data));
            const buf = new BufferPolyfill(s.length);
            for (let i = 0; i < s.length; i++) buf[i] = s.charCodeAt(i);
            return buf;
        }

        if (data instanceof ArrayBuffer) {
            return new BufferPolyfill(data);
        }

        if (ArrayBuffer.isView(data)) {
            const buf = new BufferPolyfill(data.buffer, data.byteOffset, data.byteLength);
            return buf;
        }

        if (Array.isArray(data)) {
            return new BufferPolyfill(data);
        }

        return new BufferPolyfill(0);
    }

    static alloc(size: number, fill: number = 0): BufferPolyfill {
        const buf = new BufferPolyfill(size);
        if (fill !== 0) buf.fill(fill);
        return buf;
    }

    toString(encoding?: string): string {
        if (encoding === "base64") {
            let s = "";
            for (let i = 0; i < this.length; i++) s += String.fromCharCode(this[i]);
            return btoaPolyfill(s);
        }
        if (encoding === "hex") {
            let hex = "";
            for (let i = 0; i < this.length; i++) {
                hex += this[i].toString(16).padStart(2, "0");
            }
            return hex;
        }
        // default UTF-8
        let s = "";
        for (let i = 0; i < this.length; i++) s += String.fromCharCode(this[i]);
        try { return decodeURIComponent(escape(s)); } catch (_) { return s; }
    }
}

export function installBuffer(target: any) {
    if (typeof target.Buffer === "undefined") {
        target.Buffer = BufferPolyfill;
    }
}
