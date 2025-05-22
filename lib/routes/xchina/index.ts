import { Route } from '@/types';
import got from '@/utils/got';
import { parseDate } from '@/utils/parse-date';
import cache from '@/utils/cache';
import { load } from 'cheerio';

const baseUrl = 'https://xchina.co'; // 修改为 xchina.co

// 注意：此 handler 函数中的选择器和数据提取逻辑需要根据 xchina.co 的实际 HTML 结构进行调整。
const handler = async (ctx, category) => {
    const url = `${baseUrl}/${category || ''}`; // 如果 category 为空，则访问首页
    const { data: response } = await got(url);
    console.log(`url: ${url}`); // 更新 console.log
    const $ = load(response);

    // TODO: 以下选择器需要根据 xchina.co 的 HTML 结构进行修改
    const items = await Promise.all(
        $('.posts-row.ajaxpager .posts-item') // 示例选择器，需要修改
            .map(async (_, item) => {
                const $item = $(item);
                // TODO: 以下数据提取逻辑需要根据 xchina.co 的 HTML 结构进行修改
                const link = $item.find('.item-heading a').attr('href');
                const title = $item.find('.item-heading a').text().trim();
                const date = $item.find('.item-meta item').attr('title') || $item.find('.item-meta item').text().trim();

                let finalDescription: string | undefined;
                if (link) {
                    // link is guaranteed to be string here because of the if(link) check
                    finalDescription = await cache.tryGet(link, async () => {
                        const detailResponse = await got(link);
                        const $detail = load(detailResponse.body);

                        // TODO: 以下图片提取逻辑需要根据 xchina.co 的 HTML 结构进行修改
                        const images = $detail('.article-content img').map((_, img) => {
                            const $img = $(img);
                            let imgSrc = $img.attr('data-src') || $img.attr('src');
                            if (imgSrc && imgSrc.includes('url=')) {
                                imgSrc = imgSrc.match(/url=([^&]+)/g)?.pop()?.replace('url=', '') || imgSrc;
                            }
                            return imgSrc ? `<img src="${imgSrc}" />` : '';
                        }).get().filter(Boolean).join('');

                        return `<p>${title}</p>${images || title}`; // This returns string, so cache.tryGet returns Promise<string | undefined>
                    });
                } else {
                    finalDescription = title; // title is string. So finalDescription is string | undefined
                }

                return {
                    title,
                    link,
                    description: finalDescription, // finalDescription is string | undefined, which is assignable
                    pubDate: date ? parseDate(date) : undefined, // 处理日期可能不存在的情况
                    guid: link,
                };
            })
            .get()
    );

    return {
        title: `XChina - ${category || '首页'}`, // 修改 title
        link: url,
        description: `XChina - ${category || '首页'} 最新更新`, // 修改 description
        item: items,
    };
};

export const route: Route = {
    path: '/:category?',
    name: 'XChina', // 修改 name
    example: '/xchina/some-category', // 修改 example，后续根据实际情况调整
    maintainers: ['your-name'], // 修改 maintainers
    categories: ['picture'], // 保持或根据实际情况调整
    features: {
        requireConfig: false,
        requirePuppeteer: false, // 假设不需要 Puppeteer，后续可调整
    },
    radar: [
        {
            source: ['xchina.co/:category'], // 修改 source
            target: '/:category',
        },
        {
            source: ['xchina.co/'], // 增加首页的 radar
            target: '/',
        },
    ],
    handler: async (ctx) => {
        const category = ctx.req.param('category'); // 获取 category，可能为空
        return handler(ctx, category);
    },
    description: `XChina 的分类路由，请根据实际网站分类填写。
    例如:
    | 分类1 | 分类2 |
    |-------|-------|
    | cat1  | cat2  |`, // 修改 description，提示用户根据实际情况填写
};
