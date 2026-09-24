// LNReader Module Registry and require() shim

export function installLNReaderModules(target: any) {
    const modules: Record<string, any> = {
        "cheerio": target.cheerio || {},
        "dayjs": target.dayjs || {},
        "htmlparser2": (target.cheerio && (target.cheerio as any).htmlparser2) || {},
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
            storage: target.localStorage,
            localStorage: target.localStorage,
            sessionStorage: target.sessionStorage
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
