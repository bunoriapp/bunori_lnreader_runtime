// Crypto & Cipher utilities
import { gcm } from '@noble/ciphers/aes.js';

export function installCrypto(target: any) {
    if (typeof target.crypto === "undefined") {
        target.crypto = {};
    }
    if (typeof target.crypto.getRandomValues === "undefined") {
        target.crypto.getRandomValues = function (buffer: any) {
            for (let i = 0; i < buffer.length; i++) {
                buffer[i] = Math.floor(Math.random() * 256);
            }
            return buffer;
        };
    }
    target.aesGcm = gcm;
}
