// Prepares dist/ for deploying the web demo to Vercel:
// - Single-page app routing: every URL (e.g. /story/123 opened from a link)
//   serves index.html, and the router takes it from there.
// - Never upload env files (the Vercel CLI can create one with a token).
// - Restores the Vercel project link, which `expo export` wipes with dist/.
// - Fonts and icons: Expo puts them under assets/node_modules/, but Vercel
//   never uploads folders named node_modules. Rename it and fix the paths.
// - Link preview: page title, description and preview image (Open Graph),
//   so a shared link shows a card instead of a bare URL.
import { cpSync, existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';

const SITE = 'https://destress-ai.vercel.app';
const TITLE = 'Destress AI · An AI companion for everyday stress';
const DESCRIPTION =
  'A two-minute evening check-in instead of mood sliders: the AI tracks stress, sleep and mood from the conversation, finds your patterns and helps when stress hits. Try the live demo.';
const meta = [
  `<meta name="description" content="${DESCRIPTION}" />`,
  `<meta name="theme-color" content="#FBFAF7" />`,
  `<meta property="og:type" content="website" />`,
  `<meta property="og:url" content="${SITE}" />`,
  `<meta property="og:title" content="${TITLE}" />`,
  `<meta property="og:description" content="${DESCRIPTION}" />`,
  `<meta property="og:image" content="${SITE}/og.png" />`,
  `<meta property="og:image:width" content="1200" />`,
  `<meta property="og:image:height" content="630" />`,
  `<meta name="twitter:card" content="summary_large_image" />`,
  `<meta name="twitter:title" content="${TITLE}" />`,
  `<meta name="twitter:description" content="${DESCRIPTION}" />`,
  `<meta name="twitter:image" content="${SITE}/og.png" />`,
].join('\n    ');
let html = readFileSync('dist/index.html', 'utf8');
if (!html.includes('og:image')) {
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${TITLE}</title>`).replace('</head>', `    ${meta}\n  </head>`);
  writeFileSync('dist/index.html', html);
}
cpSync('assets/web/og.png', 'dist/og.png');

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
