import * as htmlparser2 from 'htmlparser2';
import { storage, localStorage, sessionStorage } from './storage';
import { utf8ToBytes, bytesToUtf8 } from './utils';
import { NovelStatus, ShowStatus, defaultCover } from './constants';
import { FilterTypes } from './filters';
import { isUrlAbsolute } from './isAbsoluteUrl';

export function installLNReaderModules(target: any) {
    if (typeof target.localStorage === "undefined") target.localStorage = localStorage;
    if (typeof target.sessionStorage === "undefined") target.sessionStorage = sessionStorage;

    const modules: Record<string, any> = {
        "cheerio": target.cheerio || {},
        "dayjs": target.dayjs || {},
        "htmlparser2": htmlparser2,
        "urlencode": {
            encode: (str: string) => encodeURIComponent(str),
            decode: (str: string) => decodeURIComponent(str)
        },
        "@libs/fetch": {
            fetchApi: (...args: any[]) => target.fetchApi(...args),
            fetchText: (...args: any[]) => target.fetchText(...args),
            fetchFile: (...args: any[]) => target.fetchFile(...args),
            fetchProto: (...args: any[]) => target.fetchProto(...args)
        },
        "@libs/filterInputs": {
            FilterTypes
        },
        "@libs/novelStatus": {
            NovelStatus
        },
        "@libs/showStatus": {
            ShowStatus
        },
        "@libs/defaultFilter": {
            defaultFilter: {}
        },
        "@libs/defaultCover": {
            defaultCover
        },
        "@libs/isAbsoluteUrl": {
            isUrlAbsolute
        },
        "@libs/storage": {
            storage,
            localStorage,
            sessionStorage
        },
        "@libs/aes": {
            gcm: target.aesGcm
        },
        "@libs/utils": {
            utf8ToBytes,
            bytesToUtf8
        }
    };

    target.__modules = modules;

    target.require = function (moduleName: string) {
        if (modules[moduleName]) {
            return modules[moduleName];
        }
        if (typeof moduleName === "string" && moduleName.startsWith("@libs/")) {
            return modules[moduleName] || {};
        }
        return target[moduleName] || {};
    };
}
