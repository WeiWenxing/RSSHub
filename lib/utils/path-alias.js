import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function resolveRoot(...paths) {
    return join(__dirname, '../..', ...paths);
}

export function resolveLib(...paths) {
    return join(__dirname, '..', ...paths);
}