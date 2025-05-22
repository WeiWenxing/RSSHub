import { Route } from '@/types';
import got from '@/utils/got';
import { parseDate } from '@/utils/parse-date';
import cache from '@/utils/cache';
import { load } from 'cheerio';

console.log('[Nshens Pages Module] File loaded and parsed by Node.js');

const baseUrl = 'https://nshens.com';

// 注意：此函数中的选择器和数据提取逻辑需要根据 nshens.com 的实际 HTML 结构进行调整。
const fetchPageItems = async (category, page) => {
    console.log(`[Nshens Pages] fetchPageItems started for category='${category}', page='${page}'`);
    // URL 结构: https://nshens.com/web/category/{category}/{page}
    const pageUrl = `${baseUrl}/web/category/${category}/${page}`;

    const headers = {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
        'Referer': baseUrl,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
    };
    console.log(`[Nshens Pages] Attempting to fetch/cache list page URL: ${pageUrl}`);

    const listPageCacheTTL = 12 * 60 * 60; // 12 hours in seconds
    const listPageHtml = await cache.tryGet(pageUrl, async () => {
        console.log(`[Nshens Pages] Cache miss or expired for list page ${pageUrl}. Fetching from network.`);
        const networkResponse = await got(pageUrl, { headers });
        return networkResponse.data; // Return the HTML string to be cached
    }, listPageCacheTTL);

    console.log(`[Nshens Pages] Successfully fetched/retrieved list page HTML for ${pageUrl}`);
    if (!listPageHtml || typeof listPageHtml !== 'string') {
        console.error(`[Nshens Pages] Failed to load list page HTML for ${pageUrl} or HTML is not a string. Received:`, listPageHtml);
        return []; // Return empty array if HTML is not valid
    }
    // 提取 window.__NUXT__ 数据
    let posts = [];
    try {
        // Regex to capture the object returned by the IIFE in window.__NUXT__
        // This looks for `return {` and captures everything until the matching `}` of that return object,
        // right before the IIFE arguments `}(`
        const nuxtReturnObjectMatch = listPageHtml.match(/window\.__NUXT__\s*=\s*\(function\s*\(.*?\)\s*\{[\s\S]*?return\s*(\{[\s\S]*?\})\s*\}\)\s*\(.*?\)\s*;/s);

        if (nuxtReturnObjectMatch && nuxtReturnObjectMatch[1]) {
            let returnedObjectString = nuxtReturnObjectMatch[1];
            console.log('[Nshens Pages] Extracted NUXT IIFE return object string (first 1000 chars):', returnedObjectString.substring(0, 1000) + (returnedObjectString.length > 1000 ? '...' : ''));

            // The extracted string is a JavaScript object literal, not strict JSON.
            // It contains variable placeholders like 'a', 'b', 'h', 'k' etc.
            // We need to get the arguments passed to the IIFE to replace these.
            const iifeArgsMatch = listPageHtml.match(/window\.__NUXT__\s*=\s*\(function\s*\(([^)]*?)\)\s*\{[\s\S]*?return\s*\{[\s\S]*?\}\s*\}\)\s*\(([^;]*?)\)\s*;/s);

            if (iifeArgsMatch && iifeArgsMatch[1] && iifeArgsMatch[2]) {
                const paramNames = iifeArgsMatch[1].split(',').map(p => p.trim());
                // Arguments are tricky because they can be strings, numbers, or 'void 0' (for undefined)
                // This crude regex tries to split them. A proper parser would be better.
                const argValuesRaw = iifeArgsMatch[2].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/); // Split by comma, respecting quotes

                if (paramNames.length === argValuesRaw.length) {
                    for (let i = 0; i < paramNames.length; i++) {
                        const paramName = paramNames[i];
                        let argValue = argValuesRaw[i].trim();

                        // If argValue is a string literal like "Xiuren", keep quotes for JSON.
                        // If it's a variable like 'k' which means null/undefined from the IIFE, replace with 'null'.
                        // If it's a number, it's fine.
                        // This is still very heuristic.
                        if (argValue === 'void 0' || argValue === 'null' || argValue === 'undefined') {
                             returnedObjectString = returnedObjectString.replace(new RegExp(`(?<=[,:{\\[\\s])${paramName}(?=,|:|}|}|\\s)`, 'g'), 'null');
                        } else if (!argValue.startsWith('"') && !/^\d+$/.test(argValue) && argValue !== 'false' && argValue !== 'true') {
                            // It's a placeholder that should have been a string from the args, but wasn't quoted in the return {}
                            // This case is complex. The example shows 'a' for "Xiuren".
                            // The example data string you provided: [{title:a,name:a,...}]
                            // 'a' is the first argument "Xiuren".
                            // We need to replace 'title:a' with 'title:"Xiuren"'
                             returnedObjectString = returnedObjectString.replace(new RegExp(`(?<=[,:{\\[\\s])${paramName}(?=,|:|}|}|\\s)`, 'g'), argValue);
                        }
                        // else if (argValue.startsWith('"')) {
                        //    returnedObjectString = returnedObjectString.replace(new RegExp(paramName, 'g'), argValue);
                        // }
                        // else { // numbers, true, false
                        //    returnedObjectString = returnedObjectString.replace(new RegExp(paramName, 'g'), argValue);
                        // }
                    }
                     // Now, make property names be quoted for JSON
                    returnedObjectString = returnedObjectString.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
                    console.log('[Nshens Pages] Attempting to parse NUXT data string after replacements. Length:', returnedObjectString.length);
                    console.log('[Nshens Pages] Modified object string (first 1000):', returnedObjectString.substring(0,1000) + "...");


                    const nuxtData = JSON.parse(returnedObjectString.replace(/\\u002F/g, '/'));
                    if (nuxtData && nuxtData.data && nuxtData.data[0] && nuxtData.data[0].postList) {
                        posts = nuxtData.data[0].postList;
                        console.log(`[Nshens Pages] Successfully extracted ${posts.length} posts from window.__NUXT__.`);
                    } else {
                        console.error('[Nshens Pages] Failed to find postList in parsed window.__NUXT__ (after replacements). Structure might be different.');
                        console.log('[Nshens Pages] Parsed nuxtData.data[0]:', nuxtData && nuxtData.data && nuxtData.data[0]);
                    }
                } else {
                    console.error('[Nshens Pages] IIFE param names and arg values count mismatch.');
                }
            } else {
                 console.error('[Nshens Pages] Failed to extract IIFE arguments from regex match.');
            }
        } else {
            console.warn('[Nshens Pages] Primary regex for NUXT IIFE return object did not match.');
            // Fallback: Try to capture the entire assignment to window.__NUXT__ for debugging
            const fullNuxtScriptMatch = listPageHtml.match(/<script>\s*window\.__NUXT__\s*=\s*([\s\S]*?)\s*;?\s*<\/script>/s);
            if (fullNuxtScriptMatch && fullNuxtScriptMatch[1]) {
                console.log('[Nshens Pages] Fallback: Captured full window.__NUXT__ assignment (first 2000 chars):', fullNuxtScriptMatch[1].substring(0, 2000) + (fullNuxtScriptMatch[1].length > 2000 ? '...' : ''));
            } else {
                console.warn('[Nshens Pages] Fallback: Could not even capture the full window.__NUXT__ script content.');
            }
        }
    } catch (e) {
        console.error('[Nshens Pages] Error processing window.__NUXT__ data:', e);
    }

    if (!posts || posts.length === 0) {
        console.log('[Nshens Pages] No posts extracted from NUXT data. Returning empty.');
        return [];
    }

    const processedItems: any[] = [];
    let itemCounter = 0;
    for (const p of posts) { // Changed post to p to avoid conflict if post was a global
        const post = p as any; // Type assertion to any to resolve TS errors
        itemCounter++;
        const title = post.title;
        // 构造 itemUrl: baseUrl + /web/ + y + / + m + / + d + / + slug
        const itemUrl = `${baseUrl}/web/${post.y}/${post.m}/${post.d}/${post.slug}`;
        const postDate = post.date; // Already in YYYY-MM-DD HH:MM:SS format

        let itemDescription = `<p>${title}</p>`;
        const thumbnailUrl = post.img; // This is the thumbnail/cover image
        let baseImageUrl = '';

        if (thumbnailUrl && thumbnailUrl.includes('thumbnail.jpg')) { // Or a more generic check if not always thumbnail.jpg
            itemDescription += `<img src="${thumbnailUrl}" alt="${title} (Thumbnail)"><br>`;
            baseImageUrl = thumbnailUrl.substring(0, thumbnailUrl.lastIndexOf('/') + 1);
        } else if (thumbnailUrl) { // If not a thumbnail.jpg, still add it as the primary image
            itemDescription += `<img src="${thumbnailUrl}" alt="${title}"><br>`;
            // Attempt to derive baseImageUrl if it's a common pattern, otherwise this might be tricky
            // For now, if not thumbnail.jpg, we might not be able to reliably get other images in sequence
            // baseImageUrl = thumbnailUrl.substring(0, thumbnailUrl.lastIndexOf('/') + 1); // This might be incorrect if not thumbnail.jpg
        }


        const countMatch = title.match(/\((\d+)P\)/i);
        let imageCount = 0;
        if (countMatch && countMatch[1]) {
            imageCount = parseInt(countMatch[1], 10);
        }

        if (baseImageUrl && imageCount > 0) {
            for (let k = 1; k <= imageCount; k++) {
                const imageName = k + '.jpg';
                if (baseImageUrl + imageName !== thumbnailUrl) {
                    itemDescription += `<img src="${baseImageUrl}${imageName}" alt="${title} - Image ${k}"><br>`;
                }
            }
        }

        const resultItem = {
            title,
            link: itemUrl,
            description: itemDescription,
            pubDate: postDate ? parseDate(postDate) : undefined,
            guid: itemUrl || `${baseUrl}/item/${category}/${title}/${postDate}`, // Use postDate for GUID
        };
        processedItems.push(resultItem);
    }

    console.log(`[Nshens Pages] fetchPageItems for ${pageUrl} finished. Total items generated: ${processedItems.length}.`);
    return processedItems;
};

const handler = async (ctx) => {
    console.log('[Nshens Pages Handler] Entered handler.');

    const rawCategory = ctx.req.param('category');
    console.log(`[Nshens Pages Handler] Raw category from param: '${rawCategory}'`);
    const category = rawCategory || 'default'; // nshens.com - 使用一个合适的默认分类名
    console.log(`[Nshens Pages Handler] Effective category: '${category}'`);

    const pageRangeParam = ctx.req.param('pageRange');
    console.log(`[Nshens Pages Handler] Raw pageRangeParam from param: '${pageRangeParam}'`);

    if (!pageRangeParam) {
        console.error('[Nshens Pages Handler] Error: Page range parameter is missing.');
        throw new Error('Page range parameter is missing.');
    }
    const pageRange = pageRangeParam.trim();
    console.log(`[Nshens Pages Handler] Trimmed pageRange: '${pageRange}'`);

    if (!/^\d+-\d+$/.test(pageRange)) {
        console.error(`[Nshens Pages Handler] Error: Invalid page range format. Received: '${pageRange}'`);
        throw new Error(`Invalid page range format. Expected format: start-end (e.g., 1-5). Received: '${pageRange}'`);
    }
    console.log(`[Nshens Pages Handler] pageRange format check passed for '${pageRange}'`);

    const [startPage, endPage] = pageRange.split('-').map(Number);
    console.log(`[Nshens Pages Handler] Parsed startPage: ${startPage}, endPage: ${endPage}`);

    if (startPage > endPage || startPage < 1) {
        console.error(`[Nshens Pages Handler] Error: Invalid page range values. startPage=${startPage}, endPage=${endPage}`);
        throw new Error('Invalid page range values.');
    }
    console.log(`[Nshens Pages Handler] Page range values check passed.`);

    const allItems: any[] = [];
    console.log('[Nshens Pages Handler] Initialized allItems. Starting page loop.');
    const pageProcessDelay = 3000; // 3秒延迟
    for (let page = startPage; page <= endPage; page++) {
        try {
            console.log(`[Nshens Pages Handler] Processing page ${page}.`);
            const items = await fetchPageItems(category, page);
            allItems.push(...items);
            if (page < endPage) {
                console.log(`[Nshens Pages Handler] Delaying ${pageProcessDelay}ms before fetching next list page.`);
                await new Promise(resolve => setTimeout(resolve, pageProcessDelay));
            }
        } catch (error) {
            console.error(`[Nshens Pages] Error fetching/processing page ${page} for category ${category}:`, error);
        }
    }

    const feedLink = `${baseUrl}/web/category/${category}/${startPage}`;

    return {
        title: `Nshens - ${category} 页 ${startPage}-${endPage}`,
        link: feedLink,
        description: `Nshens - ${category} 页 ${startPage}-${endPage} 最新更新`,
        item: allItems,
    };
};

export const route: Route = {
    path: '/:category/:pageRange',
    name: 'Nshens - 分类分页范围',
    example: '/nshens/xiuren/1-3', // nshens.com - 示例路径
    maintainers: ['your-name'], // 请替换为您的 GitHub ID
    categories: ['picture'],
    features: {
        requireConfig: false,
        requirePuppeteer: false,
    },
    radar: [
        {
            title: 'Nshens 分类分页',
            source: ['nshens.com/web/category/:category/:page'],
            target: (params) => `/nshens/${params.category}/${params.page}-${params.page}`,
        },
    ],
    handler,
    description: `支持获取 Nshens 指定分类在指定页码范围的内容。页码范围格式为 '起始页-结束页'。`,
};
