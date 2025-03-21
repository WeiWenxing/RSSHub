import { Route } from '@/types';
import got from '@/utils/got';
import { parseDate } from '@/utils/parse-date';
import cache from '@/utils/cache';
import { load } from 'cheerio';

const baseUrl = 'https://www.06se.com';

const fetchPageItems = async (category, page) => {
    const { data: response } = await got(`${baseUrl}/${category}/page/${page}`);
    const $ = load(response);

    return $('.posts-row.ajaxpager .posts-item')
        .map(async (_, item) => {
            const $item = $(item);
            const link = $item.find('.item-heading a').attr('href');
            const title = $item.find('.item-heading a').text().trim();
            const date = $item.find('.item-meta item').attr('title') || $item.find('.item-meta item').text().trim();

            const description = await cache.tryGet(link, async () => {
                const detailResponse = await got(link);
                const $detail = load(detailResponse.body);

                // 获取所有图片并改造
                const images = $detail('.article-content img').map((_, img) => {
                    const $img = $(img);
                    const src = $img.attr('data-src');
                    let imgSrc = src;
                    if (src && src.includes('url=')) {
                        imgSrc = src.match(/url=([^&]+)/g)?.pop()?.replace('url=', '') || src;
                    }
                    return `<img src="${imgSrc}" />`;
                }).get().filter(Boolean).join('');

                return `<p>${title}</p>${images}`;
            });

            return {
                title,
                link,
                description,
                pubDate: parseDate(date),
                guid: link,
            };
        })
        .get();
};

const handler = async (ctx) => {
    const category = ctx.req.param('category') || 'xiuren';
    const pageRange = ctx.req.param('pageRange');
    const [startPage, endPage] = pageRange.split('-').map(Number);

    const allItems = [];
    for (let page = startPage; page <= endPage; page++) {
        const items = await fetchPageItems(category, page);
        allItems.push(...items);
    }

    return {
        title: `06se - ${category} 页 ${startPage}-${endPage}`,
        link: `${baseUrl}/${category}/page/${startPage}`,
        description: `06se - ${category} 页 ${startPage}-${endPage} 最新更新`,
        item: allItems,
    };
};

export const route: Route = {
    path: '/:category?/page/:pageRange',
    name: '06se - 分类分页范围',
    example: '/xiuren/page/2-10',
    maintainers: ['your-name'],
    categories: ['picture'],
    features: {
        requireConfig: false,
        requirePuppeteer: false,
    },
    radar: [
        {
            source: ['06se.com/:category/page/:page'],
            target: '/:category/page/:pageRange',
        },
    ],
    handler,
    description: `支持获取指定分类指定页范围的内容`,
};
