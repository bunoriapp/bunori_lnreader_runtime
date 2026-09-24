const B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

export function btoaPolyfill(input: string): string {
    const str = String(input);
    let output = "";
    for (
        let block = 0, charCode = 0, idx = 0, map = B64_CHARS;
        str.charAt(idx | 0) || (map = "=", idx % 1);
        output += map.charAt(63 & block >> 8 - idx % 1 * 8)
    ) {
        charCode = str.charCodeAt(idx += 3 / 4);
        if (charCode > 0xFF) {
            throw new Error("'btoa' failed: The string to be encoded contains characters outside of the Latin1 range.");
        }
        block = block << 8 | charCode;
    }
    return output;
}

export function atobPolyfill(input: string): string {
    const str = String(input).replace(/=+$/, "");
    if (str.length % 4 === 1) {
        throw new Error("'atob' failed: The string to be decoded is not correctly encoded.");
    }
    let output = "";
    for (
        let bc = 0, bs = 0, buffer: any = 0, idx = 0;
        (buffer = str.charAt(idx++));
        ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer,
            bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0
    ) {
        buffer = B64_CHARS.indexOf(buffer);
    }
    return output;
}

export class TextEncoderPolyfill {
    get encoding() { return "utf-8"; }
    encode(str: string = ""): Uint8Array {
        const s = unescape(encodeURIComponent(String(str)));
        const buf = new Uint8Array(s.length);
        for (let i = 0; i < s.length; i++) buf[i] = s.charCodeAt(i);
        return buf;
    }
}

export class TextDecoderPolyfill {
    readonly encoding: string;
    constructor(label: string = "utf-8") {
        this.encoding = (label || "utf-8").toLowerCase();
    }
    decode(bytes?: Uint8Array | ArrayBuffer): string {
        if (!bytes) return "";
        const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
        let s = "";
        for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
        try { return decodeURIComponent(escape(s)); } catch (_) { return s; }
    }
}

export function installEncoding(target: any) {
    if (typeof target.btoa === "undefined") target.btoa = btoaPolyfill;
    if (typeof target.atob === "undefined") target.atob = atobPolyfill;
    if (typeof target.TextEncoder === "undefined") target.TextEncoder = TextEncoderPolyfill;
    if (typeof target.TextDecoder === "undefined") target.TextDecoder = TextDecoderPolyfill;
}
