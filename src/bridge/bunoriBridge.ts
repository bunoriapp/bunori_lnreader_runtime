// Bunori Native Bridge for QuickJS

export function installBunoriBridge(target: any) {
    function getPlugin(): any {
        if (target.__pluginInstance) return target.__pluginInstance;

        if (target.module && target.module.exports) {
            const mod = target.module.exports;
            if (mod.default) {
                const def = mod.default;
                return (target.__pluginInstance = typeof def === "function" ? new def() : def);
            }
            if (typeof mod === "function") {
                return (target.__pluginInstance = new mod());
            }
            if (typeof mod === "object" && mod !== null && Object.keys(mod).length > 0) {
                return (target.__pluginInstance = mod);
            }
        }
        if (target.exports && target.exports.default) {
            const def = target.exports.default;
            return (target.__pluginInstance = typeof def === "function" ? new def() : def);
        }
        if (typeof (target as any).plugin !== "undefined") {
            const p = (target as any).plugin;
            return (target.__pluginInstance = typeof p === "function" ? new p() : p);
        }
        if (typeof (target as any).defaultPlugin !== "undefined") {
            const dp = (target as any).defaultPlugin;
            return (target.__pluginInstance = typeof dp === "function" ? new dp() : dp);
        }
        return target.__pluginInstance;
    }

    function resolveItemUrl(plugin: any, pathOrUrl: string, isNovel: boolean): string {
        if (!pathOrUrl) return "";
        if (pathOrUrl.startsWith("//")) {
            return "https:" + pathOrUrl;
        }
        if (target.__modules && target.__modules["@libs/isAbsoluteUrl"] && target.__modules["@libs/isAbsoluteUrl"].isUrlAbsolute(pathOrUrl)) {
            return pathOrUrl;
        }
        if (typeof plugin.resolveUrl === "function") {
            try {
                const resolved = plugin.resolveUrl(pathOrUrl, isNovel);
                if (resolved) {
                    return resolved.startsWith("//") ? ("https:" + resolved) : resolved;
                }
            } catch (_) {}
        }
        const site = (plugin.site || "").replace(/\/+$/, "");
        const cleanPath = pathOrUrl.startsWith("/") ? pathOrUrl : ("/" + pathOrUrl);
        return site + cleanPath;
    }

    function normalizeUrl(url: string): string {
        return (url || "")
            .replace(/^https?:\/\//i, "")
            .replace(/\/+$/, "")
            .toLowerCase();
    }

    function resolvePluginPath(plugin: any, fullUrlOrPath: string, isNovel?: boolean): string {
        if (!fullUrlOrPath) return "";
        let path = fullUrlOrPath;
        const site = plugin.site || "";
        const cleanSite = site.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
        const cleanUrl = fullUrlOrPath.replace(/^https?:\/\//i, "");

        if (cleanSite && cleanUrl.startsWith(cleanSite)) {
            path = cleanUrl.slice(cleanSite.length);
        }

        if (typeof plugin.resolveUrl === "function" && typeof isNovel === "boolean") {
            const normalizedTarget = normalizeUrl(fullUrlOrPath);
            const cleanPathNoSlash = path.replace(/^\/+/, "");

            const candidates: string[] = [];
            const addCand = (c: string) => {
                if (c && !candidates.includes(c)) candidates.push(c);
            };

            const slug = cleanPathNoSlash.split("/").filter(Boolean).pop() || "";
            addCand(slug);

            const strippedRoute = cleanPathNoSlash.replace(/^(novels?|series|book|library|manga|story)\//i, "");
            addCand(strippedRoute);

            addCand(cleanPathNoSlash);
            addCand(path.startsWith("/") ? path : ("/" + path));

            for (const cand of candidates) {
                try {
                    const resolved = plugin.resolveUrl(cand, isNovel);
                    if (resolved && normalizeUrl(resolved) === normalizedTarget) {
                        return cand;
                    }
                } catch (_) {}
            }
        }

        if (site.endsWith("/")) {
            return path.replace(/^\/+/, "");
        } else {
            return path.startsWith("/") ? path : ("/" + path);
        }
    }

    function getFilterValues(filters: any): Record<string, any> {
        if (!filters) return {};
        const values: Record<string, any> = {};
        for (const key of Object.keys(filters)) {
            const f = filters[key];
            if (f) {
                values[key] = {
                    type: f.type,
                    value: f.value
                };
            }
        }
        return values;
    }

    target.__bunori_bridge = {
        search: async function (query: string, page?: number) {
            const plugin = getPlugin();
            if (!plugin) throw new Error("LNReader Plugin not initialized");
            const res = await plugin.searchNovels(query, page || 1);
            return (res || []).map((item: any) => {
                let cover = item.cover || item.coverUrl || null;
                if (cover && cover.startsWith("//")) cover = "https:" + cover;
                else if (cover && !target.__modules["@libs/isAbsoluteUrl"].isUrlAbsolute(cover)) cover = resolveItemUrl(plugin, cover, true);
                return {
                    url: resolveItemUrl(plugin, item.path || item.url, true),
                    title: item.name || item.title || "",
                    coverUrl: cover,
                    author: null
                };
            });
        },
        getNovelDetails: async function (novelUrl: string) {
            const plugin = getPlugin();
            if (!plugin) throw new Error("LNReader Plugin not initialized");
            const novelPath = resolvePluginPath(plugin, novelUrl, true);

            let novel: any;
            try {
                novel = await plugin.parseNovel(novelPath);
            } catch (e: any) {
                if (novelPath !== novelUrl) {
                    try {
                        novel = await plugin.parseNovel(novelUrl);
                    } catch (e2) {
                        throw e;
                    }
                } else {
                    throw e;
                }
            }
            if (!novel) throw new Error("parseNovel returned null for " + novelUrl);

            let chapters = novel.chapters || [];
            const totalPages = Number(novel.totalPages) || 1;
            if (totalPages > 1 && typeof plugin.parsePage === "function") {
                for (let p = 2; p <= totalPages; p++) {
                    try {
                        const pageData = await plugin.parsePage(novelPath, String(p));
                        if (pageData && pageData.chapters && pageData.chapters.length > 0) {
                            chapters = chapters.concat(pageData.chapters);
                        }
                    } catch (_) {
                        break;
                    }
                }
            }

            const defaultCover = target.__modules["@libs/defaultCover"].defaultCover;
            let coverUrl = novel.cover || novel.coverUrl || null;
            if (coverUrl === defaultCover) coverUrl = null;
            if (coverUrl && coverUrl.startsWith("//")) {
                coverUrl = "https:" + coverUrl;
            } else if (coverUrl && !target.__modules["@libs/isAbsoluteUrl"].isUrlAbsolute(coverUrl)) {
                coverUrl = resolveItemUrl(plugin, coverUrl, true);
            }

            return {
                url: novelUrl,
                title: novel.name || novel.title || "",
                coverUrl: coverUrl,
                author: novel.author || novel.artist || null,
                description: novel.summary || novel.description || null,
                status: novel.status || null,
                genres: Array.isArray(novel.genres)
                    ? novel.genres
                    : (typeof novel.genres === "string" ? novel.genres.split(",").map((g: string) => g.trim()).filter(Boolean) : []),
                chapters: (chapters || []).map((ch: any, idx: number) => {
                    let chapterIndex = idx + 1;
                    if (ch.chapterNumber !== undefined && ch.chapterNumber !== null && !isNaN(ch.chapterNumber)) {
                        chapterIndex = Math.floor(Number(ch.chapterNumber));
                    }
                    let releaseDate = null;
                    if (ch.releaseTime !== undefined && ch.releaseTime !== null) {
                        releaseDate = String(ch.releaseTime);
                    }
                    let scanlation = null;
                    if (Array.isArray(ch.scanlator)) {
                        scanlation = ch.scanlator.join(", ");
                    } else if (ch.scanlator) {
                        scanlation = String(ch.scanlator);
                    } else if (ch.group) {
                        scanlation = String(ch.group);
                    } else if (ch.team) {
                        scanlation = String(ch.team);
                    }
                    return {
                        url: resolveItemUrl(plugin, ch.path || ch.url, false),
                        title: ch.name || ch.title || ("Chapter " + (idx + 1)),
                        index: chapterIndex,
                        releaseDate: releaseDate,
                        scanlation: scanlation
                    };
                }),
                extra: {}
            };
        },
        getChapterContent: async function (chapterUrl: string) {
            const plugin = getPlugin();
            if (!plugin) throw new Error("LNReader Plugin not initialized");
            const chapterPath = resolvePluginPath(plugin, chapterUrl, false);
            try {
                const content = await plugin.parseChapter(chapterPath);
                if (content) return content;
            } catch (_) {}
            if (chapterPath !== chapterUrl) {
                try {
                    return await plugin.parseChapter(chapterUrl);
                } catch (_) {}
            }
            return "";
        },
        getListings: function () {
            return [
                { id: "popular", name: "Popular" },
                { id: "latest", name: "Latest Updates" }
            ];
        },
        getListingNovels: async function (listingId: string, page?: number) {
            const plugin = getPlugin();
            if (!plugin) throw new Error("LNReader Plugin not initialized");
            const isLatest = listingId === "latest";
            const filterOptions = {
                showLatestNovels: isLatest,
                filters: getFilterValues(plugin.filters)
            };
            const res = await plugin.popularNovels(page || 1, filterOptions);
            return (res || []).map((item: any) => {
                let cover = item.cover || item.coverUrl || null;
                if (cover && cover.startsWith("//")) cover = "https:" + cover;
                else if (cover && !target.__modules["@libs/isAbsoluteUrl"].isUrlAbsolute(cover)) cover = resolveItemUrl(plugin, cover, true);
                return {
                    url: resolveItemUrl(plugin, item.path || item.url, true),
                    title: item.name || item.title || "",
                    coverUrl: cover,
                    author: null
                };
            });
        }
    };
}
