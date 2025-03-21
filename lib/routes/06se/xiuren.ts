import { Route } from '@/types';
import got from '@/utils/got';
import { parseDate } from '@/utils/parse-date';
import cache from '@/utils/cache';
import { load } from 'cheerio';

const baseUrl = 'https://www.06se.com';

const handler = async (ctx, page) => {
    const { data: response } = await got(`${baseUrl}/xiuren/page/${page}`);
    console.log(`url: ${baseUrl}/xiuren/page/${page}`);
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
                        if (src && src.includes('url=')) {
                            const realSrc = src.match(/url=([^&]+)/g)?.pop()?.replace('url=', '') || src;
                            return `<img src="${realSrc}" />`;
                        }
                        return '';
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
        title: `06se - 秀人网 第 ${page} 页`,
        link: `${baseUrl}/xiuren/page/${page}`,
        description: `06se - 秀人网 第 ${page} 页 最新更新`,
        item: items,
    };
};

export const route: Route = {
    path: '/xiuren/:page?',
    name: '06se - 秀人网分页',
    example: '/06se/xiuren/2',
    maintainers: ['your-name'],
    categories: ['picture'],
    features: {
        requireConfig: false,
        requirePuppeteer: false,
    },
    radar: [
        {
            source: ['06se.com/xiuren/page/:page'],
            target: '/xiuren/:page',
        },
    ],
    handler: async (ctx) => {
        const page = ctx.req.param('page') || '2';
        return handler(ctx, page);
    },
    description: `秀人网分页，支持第 2 页到第 100 页`,
};
