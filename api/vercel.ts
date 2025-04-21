import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import moduleAlias from 'module-alias';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

moduleAlias.addAlias('@', join(__dirname, '../lib'));

import { setConfig } from '../lib/config.js';
setConfig({
    NO_LOGFILES: true,
});

import { handle } from 'hono/vercel';
import app from '../lib/app.js';
import logger from '../lib/utils/logger.js';

logger.info(`🎉 RSSHub is running! Cheers!`);
logger.info('💖 Can you help keep this open source project alive? Please sponsor 👉 https://docs.rsshub.app/sponsor');

export default handle(app);


