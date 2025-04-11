import { Route } from '@/types';
import got from '@/utils/got';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';
import { art } from '@/utils/render';
import path from 'node:path';
import { getCurrentPath } from '@/utils/helpers';
import cache from '@/utils/cache';
import logger from '@/utils/logger';

const __dirname = getCurrentPath(import.meta.url);

interface GameItem {
    title: string;
    description: string;
    link: string;
    pubDate: string;
    category: string;
}

const CACHE_KEY = 'html5games:all';

async function fetchGameDetail(baseUrl: string, $item: cheerio.Cheerio, index: number, currentTime: number) {
    const $link = $item.find('a');
    const $img = $item.find('img');
    const $name = $item.find('.name');
    const itemLink = `${baseUrl}${$link.attr('href')}`;

    const detailResponse = await got(itemLink);
    const $detail = load(detailResponse.data);
    const description = $detail('.game-description p').text().trim();
    let frameLink = $detail('.textarea-autogrow textarea').text().trim();

    // 获取 frameLink 的最终重定向链接
    try {
        const response = await got(frameLink, {
            followRedirect: true,
            throwHttpErrors: false,
            method: 'HEAD'  // 只获取头信息，不下载内容，更快
        });
        frameLink = response.url;
    } catch (error) {
        // 如果获取失败，保持原始链接
        logger.error(`Failed to get final URL for ${frameLink}: ${error.message}`);
    }

    const timestamp = currentTime - index * 60 * 1000;

    return {
        title: $name.text().trim(),
        description: art(path.join(__dirname, 'templates/description.art'), {
            image: $img.attr('src'),
            description,
            frameLink,
        }),
        link: itemLink,
        pubDate: new Date(timestamp).toISOString(),
        category: 'HTML5 Game',
    };
}

export const route: Route = {
    path: '/all',
    categories: ['game'],
    example: '/html5games/all',
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

    // 获取缓存的历史数据并确保它是数组
    const cachedData = await cache.get(CACHE_KEY);
    let historicalItems: GameItem[] = Array.isArray(cachedData) ? cachedData : [];

    const historicalUrls = new Set(historicalItems.map(item => item.link));
    const currentTime = new Date().getTime();

    // 获取当前页面所有游戏
    const gameElements = $('.content .main-section .games li').toArray();
    const currentUrls = new Set();

    // 处理新游戏
    const newItems = await Promise.all(
        gameElements.map(async (element, index) => {
            const $item = $(element);
            const itemLink = `${baseUrl}${$item.find('a').attr('href')}`;
            currentUrls.add(itemLink);

            // 如果是新游戏，获取详细信息
            if (!historicalUrls.has(itemLink)) {
                return await fetchGameDetail(baseUrl, $item, index, currentTime);
            }
            return null;
        })
    );

    // 过滤掉已经不在网站上的游戏
    historicalItems = historicalItems.filter(item => currentUrls.has(item.link));

    // 添加新游戏到历史数据的开头
    const validNewItems = newItems.filter((item): item is GameItem => item !== null);
    historicalItems = [...validNewItems, ...historicalItems];

    // 更新缓存
    await cache.set(CACHE_KEY, historicalItems);

    return {
        title: 'HTML5 Games - All Games',
        link: `${baseUrl}/All-Games`,
        description: 'Latest HTML5 games from HTML5Games.com',
        item: historicalItems,
    };
}

