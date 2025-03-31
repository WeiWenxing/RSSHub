import { Route } from '@/types';
import got from '@/utils/got';
import { parseDate } from '@/utils/parse-date';
import cache from '@/utils/cache';
import { load } from 'cheerio';

const baseUrl = 'https://www.06se.com';

const handler = async (ctx, category) => {
    const { data: response } = await got(`${baseUrl}/${category}`);
    console.log(`url: ${baseUrl}/${category}`);
    const $ = load(response);

    const items = await Promise.all(
        $('.posts-row.ajaxpager .posts-item')
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
            .get()
    );

    return {
        title: `06se - ${category}`,
        link: `${baseUrl}/${category}`,
        description: `06se - ${category} 最新更新`,
        item: items,
    };
};

export const route: Route = {
    path: '/:category?',
    name: '06se',
    example: '/06se/xiuren',
    maintainers: ['your-name'],
    categories: ['picture'],
    features: {
        requireConfig: false,
        requirePuppeteer: false,
    },
    radar: [
        {
            source: ['06se.com/:category'],
            target: '/:category',
        },
    ],
    handler: async (ctx) => {
        const category = ctx.req.param('category') || 'xiuren';
        return handler(ctx, category);
    },
    description: `| 秀人网 | 其他美图 | Cosplay |
|--------|----------|---------|
| xiuren | other    | cos     |`,
};