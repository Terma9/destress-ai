// Deploys the built web demo (dist/) to Vercel production.
// Deploys from a copy outside the Git repo: inside it, the Vercel CLI attaches
// the commit author, and Vercel blocks authors who aren't team members.
import { execSync } from 'node:child_process';
import { cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const target = join(tmpdir(), 'destress-web-deploy');
rmSync(target, { recursive: true, force: true });
cpSync('dist', target, { recursive: true });
execSync('npx vercel deploy --prod --yes', { cwd: target, stdio: 'inherit' });
