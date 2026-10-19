// Prepares dist/ for deploying the web demo to Vercel:
// - Single-page app routing: every URL (e.g. /story/123 opened from a link)
//   serves index.html, and the router takes it from there.
// - Never upload env files (the Vercel CLI can create one with a token).
// - Restores the Vercel project link, which `expo export` wipes with dist/.
// - Fonts and icons: Expo puts them under assets/node_modules/, but Vercel
//   never uploads folders named node_modules. Rename it and fix the paths.
import { cpSync, existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';

if (existsSync('dist/assets/node_modules')) {
  renameSync('dist/assets/node_modules', 'dist/assets/vendor');
  const dir = 'dist/_expo/static/js/web';
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.js'))) {
    const code = readFileSync(`${dir}/${file}`, 'utf8');
    writeFileSync(`${dir}/${file}`, code.replaceAll('/assets/node_modules/', '/assets/vendor/'));
  }
}

writeFileSync('dist/vercel.json', JSON.stringify({ cleanUrls: true, rewrites: [{ source: '/(.*)', destination: '/' }] }, null, 2));
writeFileSync('dist/.vercelignore', '.env*\n');
if (existsSync('.vercel-web')) cpSync('.vercel-web', 'dist/.vercel', { recursive: true });
console.log('dist/ prepared for Vercel');
