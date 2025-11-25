import { fileURLToPath } from 'url';
import path from 'path';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { cp } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const frontendDir = path.join(rootDir, 'frontend');
const backendDir = path.join(rootDir, 'backend');
const apiDir = path.join(frontendDir, 'api');
rmSync(apiDir, { recursive: true, force: true });
mkdirSync(apiDir, { recursive: true });

const backendEntries = readdirSync(backendDir, { withFileTypes: true });

const shouldSkip = (sourcePath) => {
  if (sourcePath.includes(`${path.sep}node_modules${path.sep}`)) {
    return true;
  }

  const basename = path.basename(sourcePath);

  return basename === '.env' || basename === 'firebase-key.json' || basename === 'db.sqlite';
};

for (const entry of backendEntries) {
  if (entry.name === 'node_modules' || shouldSkip(path.join(backendDir, entry.name))) {
    continue;
  }

  const sourcePath = path.join(backendDir, entry.name);
  const destinationPath = path.join(apiDir, entry.name);

  await cp(sourcePath, destinationPath, {
    recursive: true,
    filter: (source) => !shouldSkip(source)
  });
}

const indexContent = `import app from './server.js';

export default app;
`;

writeFileSync(path.join(apiDir, 'index.js'), indexContent);
