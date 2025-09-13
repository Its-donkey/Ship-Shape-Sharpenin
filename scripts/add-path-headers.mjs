import { promises as fs } from 'fs';
import path from 'path';

const repoRoot = process.cwd();
const csvPath = path.join(repoRoot, 'FILE_INDEX.csv');

/** Determine comment style for a file extension */
function commentFor(file) {
  const ext = path.extname(file).toLowerCase();
  const base = path.basename(file).toLowerCase();

  // Files to skip entirely (non-source or risky to mutate)
  const skipExts = new Set([
    '.json', '.lock', '.csv', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
    '.ttf', '.woff', '.woff2', '.eot', '.pdf', '.mp4', '.mp3', '.mov', '.zip',
    '.gz', '.bz2', '.7z', '.tar', '.md', '.map'
  ]);
  if (skipExts.has(ext)) return null;

  // Special basenames to skip
  const skipNames = new Set([
    'license', 'license.md'
  ]);
  if (skipNames.has(base)) return null;

  // Per-language comment tokens (single-line preferred when possible)
  if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) return { type: 'line', token: '//' };
  if (['.css', '.scss', '.less'].includes(ext)) return { type: 'block', open: '/*', close: '*/' };
  if (['.html', '.htm'].includes(ext)) return { type: 'block', open: '<!--', close: '-->' };
  if (['.sh', '.bash', '.zsh'].includes(ext)) return { type: 'line', token: '#' };
  if (['.yml', '.yaml'].includes(ext)) return { type: 'line', token: '#' };

  // Dotfiles that accept # comments
  if (base.startsWith('.') && !['.npmrc'].includes(base)) return { type: 'line', token: '#' };

  // Default: skip unknown types
  return null;
}

function buildHeader(relPath, style) {
  if (style.type === 'line') return `${style.token}${relPath}\n\n`;
  if (style.type === 'block') return `${style.open}${relPath}${style.close}\n\n`;
  return '';
}

function hasHeaderAlready(content, relPath) {
  // Check first two non-empty lines for the exact relPath string
  const lines = content.split(/\r?\n/);
  let checked = 0;
  for (const line of lines) {
    if (line.trim() === '') continue;
    if (line.includes(relPath)) return true;
    if (++checked >= 2) break;
  }
  return false;
}

async function processFile(relPath) {
  const abs = path.join(repoRoot, relPath);
  const style = commentFor(relPath);
  if (!style) return { relPath, skipped: true };

  const content = await fs.readFile(abs, 'utf8');
  if (hasHeaderAlready(content, relPath)) return { relPath, skipped: true, reason: 'exists' };

  const header = buildHeader(relPath, style);
  await fs.writeFile(abs, header + content, 'utf8');
  return { relPath, updated: true };
}

async function main() {
  let list;
  try {
    const csv = await fs.readFile(csvPath, 'utf8');
    list = csv.split(/\r?\n/).map(l => l.split(',')[0]?.trim()).filter(Boolean);
  } catch (e) {
    console.error('Could not read FILE_INDEX.csv. Generate it first.');
    process.exit(1);
  }

  // Filter out known directories we never want to touch
  const filtered = list.filter(p => !(
    p.startsWith('.git/') ||
    p.startsWith('node_modules/') ||
    p.startsWith('dist/') || p.startsWith('build/') ||
    p.startsWith('.turbo/') || p.startsWith('.next/') || p.startsWith('.cache/')
  ));

  let updated = 0, skipped = 0;
  for (const rel of filtered) {
    try {
      const res = await processFile(rel);
      if (res?.updated) updated++;
      else skipped++;
    } catch (e) {
      // Skip files that error (permissions/binary/etc.)
      skipped++;
    }
  }

  console.log(`Path headers inserted. Updated: ${updated}, Skipped: ${skipped}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

