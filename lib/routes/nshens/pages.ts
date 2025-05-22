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
    const $ = load(listPageHtml);
    console.log(`[Nshens Pages] Loaded list page HTML for ${pageUrl}. Content (first 500 chars): ${String(listPageHtml).substring(0, 500)}...`);

    // nshens.com - 更新列表项选择器
    const itemElements = $('div.row > div.col'); 
    console.log(`[Nshens Pages] Found ${itemElements.length} item elements with selector 'div.row > div.col' on page ${pageUrl}.`);

    const processedItems: any[] = [];
    const itemDetailFetchDelay = 3000; // 3秒延迟

    let itemCounter = 0;
    for (const element of itemElements.get()) {
        itemCounter++;
        const $item = $(element);
        console.log(`[Nshens Pages] Processing item ${itemCounter}/${itemElements.length} (serially)`);

        // nshens.com - 更新详情页链接提取
        const detailPageLinkHref = $item.find('a').attr('href');
        const relativeLink: string | undefined = typeof detailPageLinkHref === 'string' ? detailPageLinkHref : undefined;
        
        let itemUrl = '';
        if (relativeLink) {
            if (relativeLink.startsWith('http')) {
                itemUrl = relativeLink;
            } else {
                // nshens.com 详情页链接已经是相对根路径的 /web/...
                itemUrl = `${baseUrl}${relativeLink}`;
            }
        }
        console.log(`[Nshens Pages] Item ${itemCounter}: relativeLink='${relativeLink}', itemUrl='${itemUrl}'`);

        // nshens.com - 更新标题提取
        const title = $item.find('a > div > div:last-child > div').text().trim();
        console.log(`[Nshens Pages] Item ${itemCounter}: title='${title}'`);

        // nshens.com - 从 itemUrl 提取日期
        let date = '';
        if (itemUrl) {
            const datePathMatch = itemUrl.match(/\/web\/(\d{4})\/(\d{2})\/(\d{2})\//);
            if (datePathMatch && datePathMatch[1] && datePathMatch[2] && datePathMatch[3]) {
                date = `${datePathMatch[1]}-${datePathMatch[2]}-${datePathMatch[3]}`;
            }
        }
        console.log(`[Nshens Pages] Item ${itemCounter}: extractedDate='${date}' from itemUrl.`);

        // nshens.com - 更新列表图片提取 (从 background-image)
        let itemDescription = `<p>${title}</p>`;
        const bgImageDiv = $item.find('div.v-image__image--cover');
        const bgImageStyle = bgImageDiv.attr('style');
        let baseImageUrl = '';
        let thumbnailUrl = ''; // Declare thumbnailUrl here

        if (bgImageStyle) {
            const urlMatch = bgImageStyle.match(/url\("(.*?thumbnail\.jpg)"\)/); // 确保匹配到 thumbnail.jpg
            if (urlMatch && urlMatch[1]) {
                thumbnailUrl = urlMatch[1]; // Assign value here
                itemDescription += `<img src="${thumbnailUrl}" alt="${title} (Thumbnail)"><br>`;
                baseImageUrl = thumbnailUrl.substring(0, thumbnailUrl.lastIndexOf('/') + 1); // 获取目录路径
            }
        }

        // 从标题中提取图片数量，例如 (85P)
        const countMatch = title.match(/\((\d+)P\)/i);
        let imageCount = 0;
        if (countMatch && countMatch[1]) {
            imageCount = parseInt(countMatch[1], 10);
        }
        console.log(`[Nshens Pages] Item ${itemCounter}: Detected image count: ${imageCount} from title.`);

        if (baseImageUrl && imageCount > 0) {
            // 如果缩略图不是第一张，并且我们想从001.jpg开始，可能需要调整这里的逻辑
            // 这里假设我们直接从1开始生成到imageCount
            for (let k = 1; k <= imageCount; k++) {
                // nshens.com - 图片命名是 1.jpg, 2.jpg ...
                const imageName = k + '.jpg';
                // 如果实际图片名不是补零的，或者不是.jpg，需要调整这里
                // 例如，如果缩略图是 snapshot_1.jpg, 那么其他可能是 snapshot_2.jpg ...
                // 这个需要根据实际情况调整，当前假设是 001.jpg 格式
                if (baseImageUrl + imageName !== thumbnailUrl) { // 避免重复添加缩略图（如果它也是数字命名的）
                     itemDescription += `<img src="${baseImageUrl}${imageName}" alt="${title} - Image ${k}"><br>`;
                }
            }
        } else if (!baseImageUrl && imageCount === 0) { // 如果没有背景图且标题没数量，保留最初的标题
             // itemDescription 已经是 <p>${title}</p>
        }


        // 不再访问 itemUrl 获取详情
        // if (itemUrl) { ... } else { ... }
        console.log(`[Nshens Pages] Item ${itemCounter}: final itemDescription length: ${itemDescription.length} (generated from list page info)`);

        const resultItem = {
            title,
            link: itemUrl,
            description: itemDescription,
            pubDate: date ? parseDate(date) : undefined,
            guid: itemUrl || `${baseUrl}/item/${category}/${title}/${date}`, // Fallback GUID
        };
        console.log(`[Nshens Pages] Item ${itemCounter}: constructed item object:`, JSON.stringify(resultItem).substring(0, 200) + '...');
        processedItems.push(resultItem);
    }

    console.log(`[Nshens Pages] fetchPageItems for ${pageUrl} finished. Total items generated: ${processedItems.length}. First item (if any): ${processedItems.length > 0 ? JSON.stringify(processedItems[0]).substring(0, 100) + '...' : 'N/A'}`);
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
