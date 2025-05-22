import { Route } from '@/types';
import got from '@/utils/got';
import { parseDate } from '@/utils/parse-date';
import cache from '@/utils/cache';
import { load } from 'cheerio';

const baseUrl = 'https://xchina.co'; // 修改为 xchina.co

// 注意：此函数中的选择器和数据提取逻辑需要根据 xchina.co 的实际 HTML 结构进行调整。
const XIUREN_SERIES_ID = 'series-5f1476781eab4';

const fetchPageItems = async (category, page) => {
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

    const { data: response } = await got(pageUrl, { headers });
    const $ = load(response);

    // 使用新的选择器根据用户提供的HTML结构
    const items = await Promise.all(
        $('div.item.photo') // Updated item selector
            .map(async (_, item) => {
                const $item = $(item);

                const relativeLink = $item.find('a:first-child').attr('href');
                const itemUrl = ''; //relativeLink ? `${baseUrl}${relativeLink}` : ''; // Construct absolute URL

                const title = $item.find('div:nth-child(3) > a').text().trim();

                // Extract date: "2025-04-14" from "<i>&nbsp;2025-04-14"
                const dateText = $item.find('div:nth-child(4) > div:nth-child(2)').text().trim();
                const dateMatch = dateText.match(/\d{4}-\d{2}-\d{2}/);
                const date = dateMatch ? dateMatch[0] : '';

                const listImageSrc = $item.find('a:first-child img').attr('src');
                let initialDescription = '';
                if (listImageSrc) {
                    initialDescription = `<img src="${listImageSrc}" alt="${title}">`;
                }

                let itemDescription: string | undefined;
                if (itemUrl) {
                    // Ensure itemUrl is a string before passing to cache.tryGet
                    itemDescription = await cache.tryGet(itemUrl, async () => {
                        // itemUrl is guaranteed to be string here (though currently it's hardcoded to '')
                        // TODO: 以下图片提取逻辑需要根据 xchina.co 详情页的 HTML 结构进行修改
                        // For now, we can use the list image as a placeholder or extend it.
                        // const detailHeaders = {
                        //     'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
                        //     'Referer': pageUrl, // Referer for detail page should be the list page
                        // };
                        // const detailResponse = await got(itemUrl, { headers: detailHeaders });
                        // const $detail = load(detailResponse.body);
                        // const images = $detail('.article-content img')... (this needs detail page structure)

                        // Placeholder for detail page image fetching logic
                        // For now, just return the list image and title
                        return `<p>${title}</p>${initialDescription}`; // Or more detailed images if fetched
                    });
                } else {
                    // If no itemUrl, use title and list image for description
                    itemDescription = `<p>${title}</p>${initialDescription}`;
                }

                return {
                    title,
                    link: itemUrl,
                    description: itemDescription || `<p>${title}</p>${initialDescription}`, // Fallback if itemDescription is undefined
                    pubDate: date ? parseDate(date) : undefined,
                    guid: itemUrl, // Use itemUrl as guid
                };
            })
            .get()
    );
    // console.log(`Items first item pubDate: ${items[0]?.pubDate}`); // Optional: for debugging
    return items;
};

const handler = async (ctx) => {
    const category = ctx.req.param('category') || 'default-category'; // TODO: 修改默认分类 (如果需要), e.g. 'photos'
    const pageRange = ctx.req.param('pageRange');
    if (!pageRange || !/^\d+-\d+$/.test(pageRange)) {
        throw new Error('Invalid page range format. Expected format: start-end (e.g., 1-5)');
    }
    const [startPage, endPage] = pageRange.split('-').map(Number);

    if (startPage > endPage || startPage < 1) {
        throw new Error('Invalid page range values.');
    }

    const allItems = [];
    for (let page = startPage; page <= endPage; page++) {
        // Adding a try-catch block for individual page fetches
        try {
            const items = await fetchPageItems(category, page);
            allItems.push(...items);
        } catch (error) {
            // Log error for the specific page and continue if needed, or rethrow
            console.error(`Error fetching page ${page} for category ${category}: ${error.message}`);
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
    path: '/:category?/page/:pageRange(\\d+-\\d+)', // 添加 pageRange 格式校验
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
                    return `/xchina/xiuren/page/${page}-${page}`;
                }
            },
        },
        {
            title: 'XChina 其他分类分页',
            // TODO: 确认 xchina.co 其他分类的分页 URL 结构
            source: ['xchina.co/:category/page/:page'], // 修改 source
            target: '/:category/page/:pageRange',
        },
    ],
    handler,
    description: `支持获取 XChina 指定分类在指定页码范围的内容。页码范围格式为 '起始页-结束页'。对于 'xiuren' 分类，它对应特定的系列ID。`, // 修改 description
};
