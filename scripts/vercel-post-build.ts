import fs from 'node:fs';
import path from 'node:path';

fs.mkdirSync(path.join(process.cwd(), 'public'), { recursive: true });