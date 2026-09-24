export const utf8ToBytes = (str: string) => new TextEncoder().encode(str);
export const bytesToUtf8 = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
