import { Route } from '@/types';

// 顶层模块加载日志，确认文件被读取
console.log('[XChina Debug Module] File loaded and parsed by Node.js (debug.ts)');

const baseUrl = 'https://xchina.co'; // 示例中会用到

export const route: Route = {
    // 使用一个简单、唯一的静态路径
    path: '/pingdebug', // 完整路径将是 /xchina/pingdebug
    name: 'XChina Ping Debug Route',
    example: '/xchina/pingdebug',
    maintainers: ['debug-user'], // 请替换为您的名字或标识
    categories: ['other'],
    features: {
        requireConfig: false,
        requirePuppeteer: false,
    },
    radar: [], // 测试路由通常不需要 radar
    handler: async (ctx) => {
        // Handler 入口日志，确认 handler 被调用
        console.log('[XChina Debug Handler] Entered /pingdebug handler.');

        // 返回一个包含有效 item 的、非空的 RSS 对象
        // 这是为了确保能通过 parameter.ts 中间件的检查
        return {
            title: 'XChina Ping Debug Test - SUCCESS',
            link: `${baseUrl}/xchina/pingdebug`, // 示例链接
            description: 'If you see this, the /pingdebug handler was called and returned items successfully.',
            item: [{
                title: 'Ping Debug Success Item 1',
                link: `${baseUrl}/xchina/pingdebug/item1`,
                description: 'This item confirms the debug handler executed and returned data.',
                pubDate: new Date().toUTCString(), // 有效的发布日期
                guid: `${baseUrl}/xchina/pingdebug/item1/${Date.now()}`, // 唯一的 GUID
            }],
            allowEmpty: false, // 明确表示我们期望 item 非空, 以测试 parameter.ts
        };
    },
    description: 'A minimal ping debug test route for the xchina namespace, designed to return non-empty items.',
};
