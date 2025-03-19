import { Route } from '@/types';
import got from '@/utils/got';
import { parseDate } from '@/utils/parse-date';
import cache from '@/utils/cache';
import { load } from 'cheerio';

export const route: Route = {
    path: '/',
    name: '美仁图',
    example: '/meirentu',
    maintainers: ['your-name'],
    handler: async (ctx) => {
        const baseUrl = 'https://meirentu.cc';
        const { data: response } = await got(baseUrl);

        const $ = load(response);

        const items = await Promise.all(
            $('.update_area_lists .i_list.list_n2')
                .map(async (_, item) => {
                    const $item = $(item);
                    const link = baseUrl + $item.find('a').attr('href');
                    const img = $item.find('img.lazyimg').data('src');
                    const title = $item.find('.meta-title').text().trim();
                    const date = $item.find('.meta-post span').first().text().trim();

                    const description = await cache.tryGet(link, async () => {
                        const { data: detailResponse } = await got(link);
                        const $detail = load(detailResponse);
                        return `<img src="${img}" alt="${title}" /><p>${title}</p>${$detail('.content').html()}`;
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
            title: '美人图 - 最新图片',
            link: baseUrl,
            description: '美人图 - 最新图片更新',
            item: items,
        };
    },
};
