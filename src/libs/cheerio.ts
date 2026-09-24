// Re-export Cheerio API for embedded QuickJS runtime
import * as cheerio from 'cheerio';

export function installCheerio(target: any) {
    target.cheerio = cheerio;
    target.parseHTML = cheerio.load;
    target.load = cheerio.load;
}
