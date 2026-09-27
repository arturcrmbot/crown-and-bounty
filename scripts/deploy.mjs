// Builds the game and publishes it to GitHub Pages, as the gh-pages branch of origin: npm run deploy
import { execFileSync, execSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const read = (command) => execSync(command, { encoding: 'utf8' }).trim();
const remote = read('git remote get-url origin');
const sha = read('git rev-parse --short HEAD');
const dirty = read('git status --porcelain') !== '';

execSync('npm run build', { stdio: 'inherit' });
const site = mkdtempSync(join(tmpdir(), 'kc-pages-'));
try {
  cpSync('dist', site, { recursive: true });
  // No Jekyll: Pages serves the files exactly as built.
  writeFileSync(join(site, '.nojekyll'), '');
  const git = (args) => execFileSync('git', args, { cwd: site, stdio: 'inherit' });
  const identity = read('git config user.name || true') ? [] : ['-c', 'user.name=Copilot', '-c', 'user.email=copilot@github.com'];
  git(['init', '-q', '-b', 'gh-pages']);
  git(['add', '-A']);
  git([...identity, 'commit', '-q', '-m', `Deploy ${sha}${dirty ? ' with local changes' : ''}\n\nCo-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>`]);
  git(['push', '-q', '--force', remote, 'gh-pages']);
} finally {
  rmSync(site, { recursive: true, force: true });
}
const [, owner, repo] = remote.match(/github\.com[/:]([^/]+)\/(.+?)(?:\.git)?$/) ?? [];
console.log(owner ? `Deployed ${sha}. Live in a minute or so at https://${owner.toLowerCase()}.github.io/${repo}/` : `Deployed ${sha} to ${remote}.`);
