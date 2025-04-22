import { Route } from '@/types';
import got from '@/utils/got';
import { parseDate } from '@/utils/parse-date';
import cache from '@/utils/cache';
import { load } from 'cheerio';
import { logger } from '@/utils/logger';

const baseUrl = 'https://www.06se.com';

const handler = async (ctx, page) => {
    const { data: response } = await got(`${baseUrl}/xiuren/page/${page}`);
    console.log(`url: ${baseUrl}/xiuren/page/${page}`);
    const $ = load(response);

    const items = (await Promise.all(
        $('.posts-row.ajaxpager .posts-item')
            .map(async (_, item) => {
                const $item = $(item);
                const link = $item.find('.item-heading a').attr('href');
                const title = $item.find('.item-heading a').text().trim();
                const date = $item.find('.item-meta item').attr('title') || $item.find('.item-meta item').text().trim();

                let description;
                try {
                    description = await cache.tryGet(link, async () => {
                        const detailResponse = await got(link);
                        const $detail = load(detailResponse.body);

                        // 获取所有图片并改造
                        const images = $detail('.article-content img').map((_, img) => {
                            const $img = $(img);
                            const src = $img.attr('data-src');
                            let imgSrc = src;
                            // 处理 url= 参数的情况
                            if (src && src.includes('url=')) {
                                imgSrc = src.match(/url=([^&]+)/g)?.pop()?.replace('url=', '') || src;
                            }
                            // 处理直接在 src 属性中的情况
                            else if (!src) {
                                // 如果 data-src 为空，尝试获取普通的 src 属性
                                const normalSrc = $img.attr('src');
                                if (normalSrc && normalSrc.includes('url=')) {
                                    imgSrc = normalSrc.match(/url=([^&]+)/g)?.pop()?.replace('url=', '') || normalSrc;
                                } else {
                                    imgSrc = normalSrc;
                                }
                            }

                            // 确保 imgSrc 有值
                            if (!imgSrc) {
                                return '';
                            }
                            return `<img src="${imgSrc}" />`;
                        }).get().filter(Boolean).join('');

                        return `<p>${title}</p>${images}`;
                    });

                    // 如果成功获取描述，返回完整的 item
                    return {
                        title,
                        link,
                        description,
                        pubDate: parseDate(date),
                        guid: link,
                    };
                } catch (err) {
                    // 如果获取失败，返回 null，后续会被过滤掉
                    logger.error(`Error getting description for ${link}: ${err.message}`);
                    return null;
                }
            })
            .get()
    )).filter(Boolean); // 过滤掉 null 的项

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




