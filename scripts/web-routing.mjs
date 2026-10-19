// The web build is a single-page app: every URL (e.g. /story/123 opened from a
// link) must serve index.html, and the router takes it from there. This writes
// the rewrite rule into dist/ so Vercel applies it when deploying the folder.
import { writeFileSync } from 'node:fs';

writeFileSync('dist/vercel.json', JSON.stringify({ cleanUrls: true, rewrites: [{ source: '/(.*)', destination: '/' }] }, null, 2));
console.log('dist/vercel.json written');
