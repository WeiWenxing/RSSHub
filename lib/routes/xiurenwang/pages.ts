import { Route } from '@/types';
import got from '@/utils/got';
import { parseDate } from '@/utils/parse-date';
import cache from '@/utils/cache';
import { load } from 'cheerio';

console.log('[Xiurenwang Pages Module] File loaded and parsed by Node.js');

const baseUrl = 'https://xiurenwang.me';

// 注意：此函数中的选择器和数据提取逻辑需要根据 xiurenwang.me 的实际 HTML 结构进行调整。
const fetchPageItems = async (category, page) => {
    console.log(`[Xiurenwang Pages] fetchPageItems started for category='${category}', page='${page}'`);
    // URL 结构: https://xiurenwang.me/?k=<category>&page=<page>
    const pageUrl = `${baseUrl}/?k=${encodeURIComponent(category)}&page=${page}`;

    const headers = {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
        'Referer': baseUrl,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
    };
    console.log(`[Xiurenwang Pages] Attempting to fetch URL: ${pageUrl} with headers:`, JSON.stringify(headers));

    const { data: response } = await got(pageUrl, { headers });
    console.log(`[Xiurenwang Pages] Successfully fetched URL: ${pageUrl}`);
    const $ = load(response);
    console.log(`[Xiurenwang Pages] Loaded URL: ${pageUrl}. Response (first 500 chars): ${String(response).substring(0, 500)}...`);

    // 使用用户提供的 HTML 结构更新选择器
    const itemElements = $('div.paragraph');
    console.log(`[Xiurenwang Pages] Found ${itemElements.length} item elements with selector 'div.paragraph' on page ${pageUrl}.`);

    const items = await Promise.all(
        itemElements
        .map(async (i, item) => {
            const $item = $(item);
            console.log(`[Xiurenwang Pages] Processing item ${i + 1}/${itemElements.length}`);

            // 从 "全套预览" 按钮获取详情页链接
            const detailPageLinkHref = $item.find('div.link > a.button:contains("全套预览")').attr('href');
            const relativeLink: string | undefined = typeof detailPageLinkHref === 'string' ? detailPageLinkHref : undefined;

            const itemUrl = relativeLink ? `${baseUrl}${relativeLink}` : ''; // 启用 itemUrl
            console.log(`[Xiurenwang Pages] Item ${i + 1}: relativeLink='${relativeLink}', itemUrl='${itemUrl}'`);

            const title = $item.find('div.title > a').text().trim();
            console.log(`[Xiurenwang Pages] Item ${i + 1}: title='${title}'`);

            const dateText = $item.find('div.volDate').text().trim();
            const dateMatch = dateText.match(/\d{4}-\d{2}-\d{2}/);
            const date = dateMatch ? dateMatch[0] : '';
            console.log(`[Xiurenwang Pages] Item ${i + 1}: dateText='${dateText}', extractedDate='${date}'`);

            // 构建列表页的初步描述 (主要用于无详情页或详情页抓取失败时)
            let initialDescription = `<p>${title}</p>`;
            $item.find('div.intro > img').each((_, imgElem) => {
                const imgSrc = $(imgElem).attr('src');
                if (imgSrc) {
                    initialDescription += `<img src="${imgSrc}" alt="${title}"><br>`;
                }
            });

            let itemDescription: string | undefined;
            if (itemUrl) {
                console.log(`[Xiurenwang Pages] Item ${i + 1}: Attempting cache.tryGet for itemUrl='${itemUrl}'`);
                itemDescription = await cache.tryGet(itemUrl, async () => {
                    console.log(`[Xiurenwang Pages] Item ${i + 1}: cache.tryGet callback for itemUrl='${itemUrl}'`);
                    const detailResponse = await got(itemUrl, { headers });
                    const $detail = load(detailResponse.data);
                    
                    let fetchedDescription = `<p>${title}</p>`; // Start with the title
                    // Extract images from the detail page's div.intro
                    $detail('div.intro > img').each((_, imgElem) => {
                        const imgSrc = $detail(imgElem).attr('src');
                        // Use the title from the list page as alt text for detail images as well
                        const imgAlt = $detail(imgElem).attr('alt') || title; 
                        if (imgSrc) {
                            fetchedDescription += `<img src="${imgSrc}" alt="${imgAlt}"><br>`;
                        }
                    });
                    console.log(`[Xiurenwang Pages] Detail page ${itemUrl} fetched and parsed. Description length: ${fetchedDescription.length}`);
                    return fetchedDescription;
                });
            } else {
                console.log(`[Xiurenwang Pages] Item ${i + 1}: itemUrl is empty, using description from list page.`);
                itemDescription = initialDescription;
            }
            console.log(`[Xiurenwang Pages] Item ${i + 1}: final itemDescription length: ${itemDescription?.length}`);

            const resultItem = {
                title,
                link: itemUrl, // 现在会是详情页链接
                description: itemDescription,
                pubDate: date ? parseDate(date) : undefined,
                guid: itemUrl || `${baseUrl}/item/${category}/${title}/${date}`, // Fallback GUID if itemUrl is empty
            };
            console.log(`[Xiurenwang Pages] Item ${i + 1}: constructed item object:`, JSON.stringify(resultItem).substring(0, 200) + '...');
            return resultItem;
        })
        .get()
    );
    console.log(`[Xiurenwang Pages] fetchPageItems for ${pageUrl} finished. Total items generated: ${items.length}. First item (if any): ${items.length > 0 ? JSON.stringify(items[0]).substring(0, 100) + '...' : 'N/A'}`);
    return items;
};

const handler = async (ctx) => {
    console.log('[Xiurenwang Pages Handler] Entered handler.');

    const rawCategory = ctx.req.param('category');
    console.log(`[Xiurenwang Pages Handler] Raw category from param: '${rawCategory}'`);
    // 用户提供的分页地址中 k=%E7%A7%80%E4%BA%BA%E7%BD%91，这里 category 就是 k 的值
    const category = rawCategory || '秀人网'; // 如果路由没有 category, 默认使用 "秀人网"
    console.log(`[Xiurenwang Pages Handler] Effective category: '${category}'`);

    const pageRangeParam = ctx.req.param('pageRange');
    console.log(`[Xiurenwang Pages Handler] Raw pageRangeParam from param: '${pageRangeParam}'`);

    if (!pageRangeParam) {
        console.error('[Xiurenwang Pages Handler] Error: Page range parameter is missing.');
        throw new Error('Page range parameter is missing.');
    }
    const pageRange = pageRangeParam.trim();
    console.log(`[Xiurenwang Pages Handler] Trimmed pageRange: '${pageRange}'`);

    if (!/^\d+-\d+$/.test(pageRange)) {
        console.error(`[Xiurenwang Pages Handler] Error: Invalid page range format. Received: '${pageRange}' (original: '${pageRangeParam}')`);
        throw new Error(`Invalid page range format. Expected format: start-end (e.g., 1-5). Received: '${pageRange}'`);
    }
    console.log(`[Xiurenwang Pages Handler] pageRange format check passed for '${pageRange}'`);

    const [startPage, endPage] = pageRange.split('-').map(Number);
    console.log(`[Xiurenwang Pages Handler] Parsed startPage: ${startPage}, endPage: ${endPage}`);

    if (startPage > endPage || startPage < 1) {
        console.error(`[Xiurenwang Pages Handler] Error: Invalid page range values. startPage=${startPage}, endPage=${endPage}`);
        throw new Error('Invalid page range values.');
    }
    console.log(`[Xiurenwang Pages Handler] Page range values check passed.`);

    const allItems: any[] = []; // 指定类型为 any[] 以解决 TS 错误
    console.log('[Xiurenwang Pages Handler] Initialized allItems. Starting page loop.');
    for (let page = startPage; page <= endPage; page++) {
        try {
            const items = await fetchPageItems(category, page);
            allItems.push(...items);
        } catch (error) {
            console.error(`[Xiurenwang Pages] Error fetching page ${page} for category ${category}:`, error);
            // 根据需求，可以选择继续下一页或停止
        }
    }

    // Manually add a test item for debugging purposes
    const debugItem = {
        title: 'Hardcoded Debug Item - Xiurenwang Pages',
        link: `${baseUrl}/xiurenwang/debug_item_link`,
        description: 'This is a hardcoded item added for debugging the pages.ts handler output.',
        pubDate: new Date().toUTCString(),
        guid: `${baseUrl}/xiurenwang/debug_item_link/${Date.now()}`,
    };
    allItems.push(debugItem);
    console.log(`[Xiurenwang Pages Handler] Manually added a debug item. allItems.length is now: ${allItems.length}`);

    const feedLink = `${baseUrl}/?k=${encodeURIComponent(category)}&page=${startPage}`;

    return {
        title: `秀人网 - ${category} 页 ${startPage}-${endPage}`,
        link: feedLink,
        description: `秀人网 - ${category} 页 ${startPage}-${endPage} 最新更新`,
        item: allItems,
    };
};

export const route: Route = {
    path: '/:category/:pageRange', // category 作为 k 查询参数的值
    name: '秀人网 - 分类分页范围',
    example: '/xiurenwang/秀人网/1-3', // 示例，假设 "秀人网" 是一个分类 (k值)
    maintainers: ['your-name'], // 请替换为您的 GitHub ID
    categories: ['picture'],
    features: {
        requireConfig: false,
        requirePuppeteer: false,
    },
    radar: [
        {
            title: '秀人网 分页',
            source: ['xiurenwang.me/*'], // 匹配 xiurenwang.me 下的所有路径
            target: (params, url, document) => { // 添加 document 参数，并确保返回 string
                const u = new URL(url);
                const kVal = u.searchParams.get('k');
                const pageVal = u.searchParams.get('page');
                if (kVal && pageVal) {
                    // 将网站 URL 映射到 RSSHub 路由
                    return `/xiurenwang/${kVal}/${pageVal}-${pageVal}`;
                }
                // 可选: 如果 URL 中只有 page 参数，可以假定一个默认的 k 值
                // else if (pageVal && !kVal) {
                //    return `/xiurenwang/秀人网/${pageVal}-${pageVal}`; // 假设默认 k="秀人网"
                // }
                return ''; // 确保返回 string
            },
        },
    ],
    handler,
    description: `支持获取秀人网指定分类 (对应 URL中的 'k' 参数) 在指定页码范围的内容。页码范围格式为 '起始页-结束页'。例如，访问 /xiurenwang/摄影/1-5 将获取 'k=摄影' 的第1到5页内容。`,
};
