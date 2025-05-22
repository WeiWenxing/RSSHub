import { Route } from '@/types';
import got from '@/utils/got';
import { parseDate } from '@/utils/parse-date';
import cache from '@/utils/cache';
import vm from 'node:vm'; // Import the vm module

console.log('[Nshens Pages Module] File loaded and parsed by Node.js');

const baseUrl = 'https://nshens.com';

const fetchPageItems = async (category, page) => {
    console.log(`[Nshens Pages] fetchPageItems started for category='${category}', page='${page}'`);
    const pageUrl = `${baseUrl}/web/category/${category}/${page}`;

    const headers = {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
        'Referer': baseUrl,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    };
    console.log(`[Nshens Pages] Attempting to fetch/cache list page URL: ${pageUrl}`);

    const listPageCacheTTL = 12 * 60 * 60; // 12 hours in seconds
    const listPageHtml = await cache.tryGet(pageUrl, async () => {
        console.log(`[Nshens Pages] Cache miss or expired for list page ${pageUrl}. Fetching from network.`);
        const networkResponse = await got(pageUrl, { headers });
        return networkResponse.data;
    }, listPageCacheTTL);

    console.log(`[Nshens Pages] Successfully fetched/retrieved list page HTML for ${pageUrl}`);
    if (!listPageHtml || typeof listPageHtml !== 'string') {
        console.error(`[Nshens Pages] Failed to load list page HTML for ${pageUrl} or HTML is not a string.`);
        return [];
    }

    let posts = [];
    try {
        const nuxtScriptRegex = /<script>\s*window\.__NUXT__\s*=\s*([\s\S]+?)\s*;?\s*<\/script>/s;
        const nuxtScriptMatch = listPageHtml.match(nuxtScriptRegex);

        if (nuxtScriptMatch && nuxtScriptMatch[1]) {
            const iifeString = nuxtScriptMatch[1].trim();
            console.log("[Nshens Pages] Captured IIFE String from NUXT data.");

            const nuxtData = vm.runInNewContext(iifeString);

            if (nuxtData && nuxtData.data && Array.isArray(nuxtData.data) && nuxtData.data[0] && nuxtData.data[0].postList) {
                posts = nuxtData.data[0].postList;
                console.log(`[Nshens Pages] Successfully extracted ${posts.length} posts using vm module.`);
            } else {
                console.error("[Nshens Pages] postList not found in executed nuxtData object.");
            }
        } else {
            console.warn("[Nshens Pages] window.__NUXT__ script tag not found or regex mismatch.");
        }
    } catch (e) {
        console.error('[Nshens Pages] Error processing window.__NUXT__ data:', e);
    }

    if (!posts || posts.length === 0) {
        console.log('[Nshens Pages] No posts extracted. Returning empty.');
        return [];
    }

    const processedItems: any[] = [];
    for (const p of posts) {
        const post = p as any; // Type assertion
        const title = post.title;
        const itemUrl = `${baseUrl}/web/${post.y}/${post.m}/${post.d}/${post.slug}`;
        const postDate = post.date;

        let itemDescription = `<p>${title}</p>`;
        const thumbnailUrl = post.img;
        let baseImageUrl = '';

        if (thumbnailUrl) {
            itemDescription += `<img src="${thumbnailUrl}" alt="${title} (Thumbnail)"><br>`;
            if (thumbnailUrl.includes('thumbnail.jpg') || thumbnailUrl.includes('snapshot_')) { // Common patterns for thumbnails
                baseImageUrl = thumbnailUrl.substring(0, thumbnailUrl.lastIndexOf('/') + 1);
            } else {
                 // If not a clear thumbnail pattern, still try to get a base path
                 // This might need adjustment based on actual non-thumbnail image URLs
                baseImageUrl = thumbnailUrl.substring(0, thumbnailUrl.lastIndexOf('/') + 1);
                console.warn(`[Nshens Pages] Thumbnail URL "${thumbnailUrl}" does not match expected patterns for deriving base image path. Image sequence might be incomplete.`);
            }
        }

        const countMatch = title.match(/\((\d+)P\)/i);
        let imageCount = 0;
        if (countMatch && countMatch[1]) {
            imageCount = parseInt(countMatch[1], 10);
        }

        if (baseImageUrl && imageCount > 0) {
            for (let k = 1; k <= imageCount; k++) {
                const imageName = k + '.jpg';
                if (baseImageUrl + imageName !== thumbnailUrl) { // Avoid re-adding thumbnail if it's part of sequence
                    itemDescription += `<img src="${baseImageUrl}${imageName}" alt="${title} - Image ${k}"><br>`;
                }
            }
        }

        processedItems.push({
            title,
            link: itemUrl,
            description: itemDescription,
            pubDate: postDate ? parseDate(postDate) : undefined,
            guid: itemUrl || `${baseUrl}/item/${category}/${title}/${postDate}`,
        });
    }
    console.log(`[Nshens Pages] fetchPageItems for ${pageUrl} finished. Total items generated: ${processedItems.length}.`);
    return processedItems;
};

const handler = async (ctx) => {
    console.log('[Nshens Pages Handler] Entered handler.');
    const rawCategory = ctx.req.param('category');
    const category = rawCategory || 'default'; // nshens.com - 使用一个合适的默认分类名
    console.log(`[Nshens Pages Handler] Effective category: '${category}'`);

    const pageRangeParam = ctx.req.param('pageRange');
    if (!pageRangeParam) {
        throw new Error('Page range parameter is missing.');
    }
    const pageRange = pageRangeParam.trim();
    if (!/^\d+-\d+$/.test(pageRange)) {
        throw new Error(`Invalid page range format. Expected format: start-end. Received: '${pageRange}'`);
    }

    const [startPage, endPage] = pageRange.split('-').map(Number);
    if (startPage > endPage || startPage < 1) {
        throw new Error('Invalid page range values.');
    }

    const allItems: any[] = [];
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
    example: '/nshens/xiuren/1-3',
    maintainers: ['your-name'], // 请替换为您的 GitHub ID
    categories: ['picture'],
    features: {
        requireConfig: false,
        requirePuppeteer: false, // Not using Puppeteer as we parse __NUXT__
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
