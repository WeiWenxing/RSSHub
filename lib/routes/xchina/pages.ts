import { Route } from '@/types';
import got from '@/utils/got';
import { parseDate } from '@/utils/parse-date';
import cache from '@/utils/cache';
import { load } from 'cheerio';

console.log('[XChina Pages Module] File loaded and parsed by Node.js');

const baseUrl = 'https://xchina.co'; // 修改为 xchina.co

// 注意：此函数中的选择器和数据提取逻辑需要根据 xchina.co 的实际 HTML 结构进行调整。
const XIUREN_SERIES_ID = 'series-5f1476781eab4';

const fetchPageItems = async (category, page) => {
    console.log(`[XChina Pages] fetchPageItems started for category='${category}', page='${page}'`);
    let pageUrl = '';
    if (category === 'xiuren') {
        pageUrl = `${baseUrl}/photos/${XIUREN_SERIES_ID}/${page}.html`;
    } else {
        // TODO: 确认 xchina.co 其他分类的分页 URL 结构
        pageUrl = `${baseUrl}/${category}/page/${page}`; // 假设的通用 URL 结构
    }

    const headers = {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
        Referer: category === 'xiuren' ? `${baseUrl}/photos/${XIUREN_SERIES_ID}/` : baseUrl,
    };
    console.log(`[XChina Pages] Attempting to fetch URL: ${pageUrl} with headers:`, JSON.stringify(headers));

    const { data: response } = await got(pageUrl, { headers });
    console.log(`[XChina Pages] Successfully fetched URL: ${pageUrl}`);
    const $ = load(response);
    console.log(`[XChina Pages] Loaded URL: ${pageUrl}. Response (first 500 chars): ${String(response).substring(0, 500)}...`);


    const itemElements = $('div.item.photo');
    console.log(`[XChina Pages] Found ${itemElements.length} item elements with selector 'div.item.photo' on page ${pageUrl}.`);

    // 使用新的选择器根据用户提供的HTML结构
    const items = await Promise.all(
        itemElements // Updated item selector
        .map(async (i, item) => {
            const $item = $(item);
            console.log(`[XChina Pages] Processing item ${i + 1}/${itemElements.length}`);

            const relativeLink = $item.find('a:first-child').attr('href');
            // As per user's repeated denial to change, itemUrl remains hardcoded to ''.
            const itemUrl = ''; // relativeLink ? `${baseUrl}${relativeLink}` : '';
            console.log(`[XChina Pages] Item ${i + 1}: relativeLink='${relativeLink}', itemUrl='${itemUrl}' (hardcoded empty)`);

            const title = $item.find('div:nth-child(3) > a').text().trim();
            console.log(`[XChina Pages] Item ${i + 1}: title='${title}'`);

            const dateText = $item.find('div:nth-child(4) > div:nth-child(2)').text().trim();
            const dateMatch = dateText.match(/\d{4}-\d{2}-\d{2}/);
            const date = dateMatch ? dateMatch[0] : '';
            console.log(`[XChina Pages] Item ${i + 1}: dateText='${dateText}', extractedDate='${date}'`);

            const listImageSrc = $item.find('a:first-child img').attr('src');
            let initialDescription = '';
            if (listImageSrc) {
                initialDescription = `<img src="${listImageSrc}" alt="${title}">`;
            }
            console.log(`[XChina Pages] Item ${i + 1}: listImageSrc='${listImageSrc}', initialDescription set: ${!!initialDescription}`);

            let itemDescription: string | undefined;
            // Since itemUrl is '', this block will not be executed.
            if (itemUrl) {
                console.log(`[XChina Pages] Item ${i + 1}: Attempting cache.tryGet for itemUrl='${itemUrl}'`);
                itemDescription = await cache.tryGet(itemUrl, async () => {
                    console.log(`[XChina Pages] Item ${i + 1}: cache.tryGet callback for itemUrl='${itemUrl}'`);
                    // TODO: 以下图片提取逻辑需要根据 xchina.co 详情页的 HTML 结构进行修改
                    return `<p>${title}</p>${initialDescription}`;
                });
            } else {
                console.log(`[XChina Pages] Item ${i + 1}: itemUrl is empty, setting description from title and list image.`);
                itemDescription = `<p>${title}</p>${initialDescription}`;
            }
            console.log(`[XChina Pages] Item ${i + 1}: final itemDescription length: ${itemDescription?.length}`);

            const resultItem = {
                title,
                link: itemUrl, // Will be ''
                description: itemDescription || `<p>${title}</p>${initialDescription}`,
                pubDate: date ? parseDate(date) : undefined,
                guid: itemUrl, // Will be ''
            };
            console.log(`[XChina Pages] Item ${i + 1}: constructed item object:`, JSON.stringify(resultItem).substring(0, 200) + '...'); // Log part of the object
            return resultItem;
        })
        .get()
    );
    console.log(`[XChina Pages] fetchPageItems for ${pageUrl} finished. Total items generated: ${items.length}. First item (if any): ${items.length > 0 ? JSON.stringify(items[0]).substring(0, 100) + '...' : 'N/A'}`);
    return items;
};

const handler = async (ctx) => {
    console.log('[XChina Pages Handler] Entered handler.');

    const rawCategory = ctx.req.param('category');
    console.log(`[XChina Pages Handler] Raw category from param: '${rawCategory}'`);
    const category = rawCategory || 'default-category'; // Defaulting here
    console.log(`[XChina Pages Handler] Effective category: '${category}'`);

    const pageRangeParam = ctx.req.param('pageRange');
    console.log(`[XChina Pages Handler] Raw pageRangeParam from param: '${pageRangeParam}'`);

    if (!pageRangeParam) {
        console.error('[XChina Pages Handler] Error: Page range parameter is missing.');
        throw new Error('Page range parameter is missing.');
    }
    const pageRange = pageRangeParam.trim();
    console.log(`[XChina Pages Handler] Trimmed pageRange: '${pageRange}'`);

    if (!/^\d+-\d+$/.test(pageRange)) {
        console.error(`[XChina Pages Handler] Error: Invalid page range format. Received: '${pageRange}' (original: '${pageRangeParam}')`);
        throw new Error(`Invalid page range format. Expected format: start-end (e.g., 1-5). Received: '${pageRange}'`);
    }
    console.log(`[XChina Pages Handler] pageRange format check passed for '${pageRange}'`);

    const [startPage, endPage] = pageRange.split('-').map(Number);
    console.log(`[XChina Pages Handler] Parsed startPage: ${startPage}, endPage: ${endPage}`);

    if (startPage > endPage || startPage < 1) {
        console.error(`[XChina Pages Handler] Error: Invalid page range values. startPage=${startPage}, endPage=${endPage}`);
        throw new Error('Invalid page range values.');
    }
    console.log(`[XChina Pages Handler] Page range values check passed.`);

    const allItems = [];
    console.log('[XChina Pages Handler] Initialized allItems. Starting page loop.');
    for (let page = startPage; page <= endPage; page++) {
        // Adding a try-catch block for individual page fetches
        try {
            const items = await fetchPageItems(category, page);
            allItems.push(...items);
        } catch (error) {
            // Log error for the specific page and continue if needed, or rethrow
            console.error(`[XChina Pages] Error fetching page ${page} for category ${category}:`, error);
            // Depending on requirements, you might want to continue to next page or stop
        }
    }

    let feedLink = '';
    if (category === 'xiuren') {
        feedLink = `${baseUrl}/photos/${XIUREN_SERIES_ID}/${startPage}.html`;
    } else {
        feedLink = `${baseUrl}/${category}/page/${startPage}`; // 假设的通用 URL 结构
    }

    return {
        title: `XChina - ${category} 页 ${startPage}-${endPage}`, // 修改 title
        link: feedLink, // 根据 category 修改 link
        description: `XChina - ${category} 页 ${startPage}-${endPage} 最新更新`, // 修改 description
        item: allItems,
    };
};

export const route: Route = {
    path: '/:category/:pageRange', // category 设为必需参数
    name: 'XChina - 分类分页范围', // 修改 name
    example: '/xchina/some-category/page/2-10, /xchina/xiuren/page/1-3', // 修改 example
    maintainers: ['your-name'], // 修改 maintainers
    categories: ['picture'], // 保持或根据实际情况调整
    features: {
        requireConfig: false,
        requirePuppeteer: false, // 假设不需要 Puppeteer
    },
    radar: [
        {
            title: 'XChina xiuren 系列分页',
            source: [`xchina.co/photos/${XIUREN_SERIES_ID}/:page.html`],
            target: (_params, url) => {
                const page = new URL(url).pathname.match(/\/(\d+)\.html$/)?.[1];
                if (page) {
                    return `/xchina/xiuren/${page}-${page}`;
                }
            },
        },
        {
            title: 'XChina 其他分类分页',
            // TODO: 确认 xchina.co 其他分类的分页 URL 结构
            source: ['xchina.co/:category/page/:page'], // 修改 source
            target: '/:category/:pageRange',
        },
    ],
    handler,
    description: `支持获取 XChina 指定分类在指定页码范围的内容。页码范围格式为 '起始页-结束页'。对于 'xiuren' 分类，它对应特定的系列ID。`, // 修改 description
};
