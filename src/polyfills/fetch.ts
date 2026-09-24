// HTTP Fetch and Native Bridge implementation
import { FormDataPolyfill } from './formData';
import { URLSearchParamsPolyfill } from './url';

declare const __native_fetch: ((url: string, initJson: string) => Promise<string> | string) | undefined;

export interface FetchOptions {
    method?: string;
    headers?: Record<string, string | undefined> | [string, string][] | any;
    body?: any;
    [key: string]: any;
}

export function serializeBody(body: any, headers: Record<string, string>): string | null {
    if (body === undefined || body === null) return null;

    if (typeof body === "string") {
        return body;
    }

    if (body instanceof FormDataPolyfill || (typeof body === "object" && typeof body.entries === "function" && Array.isArray(body._data))) {
        const params: string[] = [];
        const entries = typeof body.entries === "function" ? Array.from(body.entries()) : body._data;
        for (const [k, v] of entries) {
            params.push(encodeURIComponent(k) + "=" + encodeURIComponent(v !== undefined && v !== null ? String(v) : ""));
        }
        if (!Object.keys(headers).some(k => k.toLowerCase() === "content-type")) {
            headers["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8";
        }
        return params.join("&");
    }

    if (body instanceof URLSearchParamsPolyfill || (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams)) {
        if (!Object.keys(headers).some(k => k.toLowerCase() === "content-type")) {
            headers["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8";
        }
        return body.toString();
    }

    if (body instanceof Uint8Array || body instanceof ArrayBuffer) {
        const u8 = body instanceof ArrayBuffer ? new Uint8Array(body) : body;
        let binary = "";
        for (let i = 0; i < u8.length; i++) {
            binary += String.fromCharCode(u8[i]);
        }
        return binary;
    }

    if (typeof body === "object") {
        const contentTypeKey = Object.keys(headers).find(k => k.toLowerCase() === "content-type");
        const contentTypeVal = contentTypeKey ? headers[contentTypeKey] : "";
        if (contentTypeVal.includes("application/json")) {
            return JSON.stringify(body);
        } else if (typeof body.toString === "function" && Object.prototype.toString.call(body) !== "[object Object]") {
            return body.toString();
        } else {
            try {
                const params: string[] = [];
                for (const [k, v] of Object.entries(body)) {
                    params.push(encodeURIComponent(k) + "=" + encodeURIComponent(v !== undefined && v !== null ? String(v) : ""));
                }
                if (!contentTypeKey) {
                    headers["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8";
                }
                return params.join("&");
            } catch (_) {
                return String(body);
            }
        }
    }

    return String(body);
}

export async function fetchApi(url: string, init: FetchOptions = {}): Promise<any> {
    const rawHeaders = init.headers || {};
    const normalizedHeaders: Record<string, string> = {};

    if (typeof rawHeaders.forEach === "function") {
        rawHeaders.forEach((v: any, k: string) => { normalizedHeaders[k] = String(v); });
    } else if (Array.isArray(rawHeaders)) {
        for (const [k, v] of rawHeaders) normalizedHeaders[k] = String(v);
    } else if (typeof rawHeaders === "object" && rawHeaders !== null) {
        for (const [k, v] of Object.entries(rawHeaders)) {
            if (v !== undefined && v !== null) normalizedHeaders[k] = String(v);
        }
    }

    const defaultHeaders: Record<string, string> = {
        "Connection": "keep-alive",
        "Accept": "*/*",
        "Accept-Language": "*",
        "Sec-Fetch-Mode": "cors",
        "Cache-Control": "max-age=0"
    };

    for (const key of Object.keys(defaultHeaders)) {
        if (!Object.keys(normalizedHeaders).some(k => k.toLowerCase() === key.toLowerCase())) {
            normalizedHeaders[key] = defaultHeaders[key];
        }
    }

    const requestBody = serializeBody(init.body, normalizedHeaders);

    const serializedInit = {
        url: url,
        method: (init.method || "GET").toUpperCase(),
        headers: normalizedHeaders,
        body: requestBody
    };

    const raw = typeof __native_fetch === "function" ? await __native_fetch(url, JSON.stringify(serializedInit)) : "{}";
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    const headersObj = parsed.headers || {};

    return {
        status: parsed.status || 200,
        statusText: parsed.statusText || "OK",
        ok: (parsed.status >= 200 && parsed.status < 300) || parsed.status === undefined,
        headers: {
            get: (key: string) => headersObj[key.toLowerCase()] || headersObj[key] || null,
            ...headersObj
        },
        text: async () => parsed.body || "",
        json: async () => JSON.parse(parsed.body || "{}"),
        blob: async () => parsed.body || "",
        arrayBuffer: async () => {
            const str = parsed.body || "";
            const buf = new Uint8Array(str.length);
            for (let i = 0; i < str.length; i++) {
                buf[i] = str.charCodeAt(i) & 0xff;
            }
            return buf.buffer;
        }
    };
}

export async function fetchText(url: string, init: FetchOptions = {}, _encoding?: string): Promise<string> {
    try {
        const res = await fetchApi(url, init);
        if (!res.ok) return "";
        return await res.text();
    } catch (_) {
        return "";
    }
}

export async function fetchFile(url: string, init: FetchOptions = {}): Promise<string> {
    try {
        const res = await fetchApi(url, init);
        if (!res.ok) return "";
        const text = await res.text();
        return (globalThis as any).btoa ? (globalThis as any).btoa(text) : text;
    } catch (_) {
        return "";
    }
}

export function installFetch(target: any) {
    target.fetchApi = fetchApi;
    target.fetch = fetchApi;
    target.fetchText = fetchText;
    target.fetchFile = fetchFile;
    target.fetchProto = async () => {
        throw new Error("fetchProto is not supported in this runtime");
    };
}
