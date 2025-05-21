import { Route } from '@/types';
import got from '@/utils/got';
import { parseDate } from '@/utils/parse-date';
import cache from '@/utils/cache';
import { load } from 'cheerio';

const baseUrl = 'https://www.xsnvshen.co/album/hd/147';

// 定义获取单页数据的函数
const fetchPageItems = async (page: number) => {
    const { data: response } = await got(`${baseUrl}/?p=${page}`);
    const $ = load(response);

    const items = await Promise.all(
        // 根据实际页面结构调整选择器
        $('.min-h-imgall_300')
           .map(async (_, item) => {
                const $item = $(item);
                // 提取链接
                const link = $item.find('a.itemimg').attr('href');
                if (!link) {
                    return null;
                }
                // 补全链接
                const fullLink = `https://www.xsnvshen.co${link}`;
                // 提取标题
                const title = $item.find('.camLiTitleC a').attr('title')?.trim() || '';
                // 从标题中提取日期
                const dateMatch = title.match(/\d{4}\.\d{2}\.\d{2}/);
                const date = dateMatch ? dateMatch[0] : '';

                const description = await cache.tryGet(fullLink, async () => {
                    const detailResponse = await got(fullLink);
                    const $detail = load(detailResponse.body);

                    // 获取图片总数
                    const totalImagesText = $detail('.swpt-time').text();
                    const totalImagesMatch = totalImagesText.match(/共 (\d+) 张/);
                    const totalImages = totalImagesMatch ? parseInt(totalImagesMatch[1], 10) : 0;

                    // 获取第一张图片 URL 作为基础 URL
                    const firstImageUrl = $detail('#bigImg').attr('src');
                    if (!firstImageUrl) {
                        return `<p>${title}</p>`;
                    }
                    const baseUrl = firstImageUrl.replace(/\d+\.jpg$/, '');

                    // 生成所有图片 URL
                    const images = [];
                    for (let i = 0; i < totalImages; i++) {
                        const imgSrc = `${baseUrl}${String(i).padStart(3, '0')}.jpg`;
                        images.push(`<img src="${imgSrc}" />`);
                    }

                    return `<p>${title}</p>${images.join('')}`;
                });

                return {
                    title,
                    link: fullLink,
                    description,
                    pubDate: parseDate(date, 'YYYY.MM.DD'),
                    guid: fullLink,
                };
            })
           .get()
           .filter(Boolean)
    );
    if (items.length > 0 && items[0]) {
        console.log(`Items first item pubDate: ${items[0].pubDate}`);
    }
    return items;
};

// 路由处理函数
const handler = async (ctx) => {
    const pageRange = ctx.req.param('pageRange');
    const [startPage, endPage] = pageRange.split('-').map(Number);

    const allItems = [];
    for (let page = startPage; page <= endPage; page++) {
        const items = await fetchPageItems(page);
        allItems.push(...items);
    }

    return {
        title: `xsnvshen - 页 ${startPage}-${endPage}`,
        link: `${baseUrl}/?p=${startPage}`,
        description: `xsnvshen - 页 ${startPage}-${endPage} 最新更新`,
        item: allItems,
    };
};

// 导出路由配置
export const route: Route = {
    path: '/page/:pageRange',
    name: 'xsnvshen - 分页范围',
    example: '/page/1-5',
    maintainers: ['your-name'],
    categories: ['picture'],
    features: {
        requireConfig: false,
        requirePuppeteer: false,
    },
    radar: [
        {
            source: ['xsnvshen.co/album/hd/147/?p=:page'],
            target: '/page/:pageRange',
        },
    ],
    handler,
    description: `支持获取指定页范围的内容`,
};
