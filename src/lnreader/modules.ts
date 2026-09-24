import * as htmlparser2 from 'htmlparser2';

class PluginStorage {
    private _db: Record<string, any> = {};

    set(key: string, value: any, expires?: Date | number): void {
        this._db[key] = {
            created: new Date(),
            value,
            expires: expires instanceof Date ? expires.getTime() : expires
        };
    }

    get(key: string, raw?: boolean): any {
        const item = this._db[key];
        if (!item) return undefined;
        if (item.expires && Date.now() > item.expires) {
            delete this._db[key];
            return undefined;
        }
        return raw ? item : item.value;
    }

    delete(key: string): void {
        delete this._db[key];
    }

    clearAll(): void {
        this._db = {};
    }

    getAllKeys(): string[] {
        return Object.keys(this._db);
    }
}

class PluginLocalStorage {
    private _db: Record<string, string> = {};
    get(): Record<string, string> {
        return this._db;
    }
}

export function installLNReaderModules(target: any) {
    const defaultStorage = new PluginStorage();
    const defaultLocalStorage = new PluginLocalStorage();
    const defaultSessionStorage = new PluginLocalStorage();

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
            FilterTypes: {
                TextInput: "Text",
                Picker: "Picker",
                CheckboxGroup: "Checkbox",
                Switch: "Switch",
                ExcludableCheckboxGroup: "XCheckbox"
            }
        },
        "@libs/novelStatus": {
            NovelStatus: {
                Unknown: "Unknown",
                Ongoing: "Ongoing",
                Completed: "Completed",
                Licensed: "Licensed",
                PublishingFinished: "Publishing Finished",
                Cancelled: "Cancelled",
                OnHiatus: "On Hiatus",
                STUB: "STUB",
                Inactive: "Inactive"
            }
        },
        "@libs/showStatus": {
            ShowStatus: {
                All: "All",
                Ongoing: "Ongoing",
                Completed: "Completed"
            }
        },
        "@libs/defaultFilter": {
            defaultFilter: {}
        },
        "@libs/defaultCover": {
            defaultCover: "https://github.com/LNReader/lnreader-plugins/blob/main/icons/src/coverNotAvailable.jpg?raw=true"
        },
        "@libs/isAbsoluteUrl": {
            isUrlAbsolute: function (url: string) {
                if (!url) return false;
                if (url.indexOf("//") === 0) return true;
                if (url.indexOf("://") === -1) return false;
                if (url.indexOf(".") === -1) return false;
                if (url.indexOf("/") === -1) return false;
                if (url.indexOf(":") > url.indexOf("/")) return false;
                if (url.indexOf("://") < url.indexOf(".")) return true;
                return false;
            }
        },
        "@libs/storage": {
            storage: defaultStorage,
            localStorage: defaultLocalStorage,
            sessionStorage: defaultSessionStorage
        },
        "@libs/aes": {
            gcm: target.aesGcm
        },
        "@libs/utils": {
            utf8ToBytes: (str: string) => new TextEncoder().encode(str),
            bytesToUtf8: (bytes: Uint8Array) => new TextDecoder().decode(bytes)
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
