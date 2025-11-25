import { fileURLToPath } from 'url';
import path from 'path';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { cp } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const frontendDir = path.join(rootDir, 'frontend');
const backendDir = path.join(rootDir, 'backend');
const apiDir = path.join(frontendDir, 'api');
const backendCopyDir = path.join(apiDir, 'backend');

rmSync(apiDir, { recursive: true, force: true });
mkdirSync(apiDir, { recursive: true });

await cp(backendDir, backendCopyDir, {
  recursive: true,
  filter: (source) => {
    if (source.includes(`${path.sep}node_modules${path.sep}`)) {
      return false;
    }

    const basename = path.basename(source);

    if (basename === '.env' || basename === 'firebase-key.json' || basename === 'db.sqlite') {
      return false;
    }

    return true;
  }
});

const indexContent = `import app from './backend/index.js';

export default app;
`;

writeFileSync(path.join(apiDir, 'index.js'), indexContent);
