import { Route } from '@/types';
import got from '@/utils/got';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';
import { art } from '@/utils/render';
import path from 'node:path';
import { getCurrentPath } from '@/utils/helpers';
const __dirname = getCurrentPath(import.meta.url);

export const route: Route = {
    path: '/all',
    categories: ['game'],
    example: '/html5game/all',
    parameters: {},
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['html5games.com/All-Games'],
        },
    ],
    name: 'All Games',
    maintainers: ['vincent'],
    handler,
    url: 'html5games.com/All-Games',
};

async function handler() {
    const baseUrl = 'https://html5games.com';
    const response = await got(`${baseUrl}/All-Games`);
    const $ = load(response.data);

    const items = await Promise.all(
        $('.content .main-section .games li')
            .map(async (_, item) => {
                const $item = $(item);
                const $link = $item.find('a');
                const $img = $item.find('img');
                const $name = $item.find('.name');
                const itemLink = `${baseUrl}${$link.attr('href')}`;

                // 获取详细页面内容
                const detailResponse = await got(itemLink);
                const $detail = load(detailResponse.data);
                const description = $detail('.game-description p').text().trim();
                const frameLink = $detail('.textarea-autogrow textarea').text().trim();

                return {
                    title: $name.text().trim(),
                    description: art(path.join(__dirname, 'templates/description.art'), {
                        image: $img.attr('src'),
                        description,
                        frameLink,
                    }),
                    link: itemLink,
                    pubDate: parseDate(new Date().toISOString()),
                    category: 'HTML5 Game',
                };
            })
            .get()
    );

    return {
        title: 'HTML5 Games - All Games',
        link: `${baseUrl}/All-Games`,
        description: 'Latest HTML5 games from HTML5Games.com',
        item: items,
    };
}

