declare const __native_log: ((level: string, msg: string) => void) | undefined;

export function installConsole(target: any) {
    if (typeof target.console === "undefined") {
        target.console = {};
    }

    const levels = ["log", "info", "warn", "error", "debug"] as const;
    for (const level of levels) {
        const existing = target.console[level];
        target.console[level] = (...args: any[]) => {
            if (typeof existing === "function") {
                try { existing.apply(target.console, args); } catch (_) {}
            }
            if (typeof __native_log === "function") {
                try {
                    const message = args.map(arg => {
                        if (typeof arg === "object" && arg !== null) {
                            try { return JSON.stringify(arg); } catch (_) { return String(arg); }
                        }
                        return String(arg);
                    }).join(" ");
                    __native_log(level, message);
                } catch (_) {}
            }
        };
    }
}
