import path from 'path';
import { readFile, writeFile, stat as statAsync } from 'fs/promises';
import Time from '../services/time';

const REPO_ROOT = path.resolve(process.cwd(), '../../..');

function addLastChecked(raw: string, iso: string): { changed: boolean; output: string } {
  // Require existing YAML frontmatter; otherwise do nothing
  const fmRe = /^---\r?\n([\s\S]*?)\r?\n---/;
  const match = raw.match(fmRe);
  if (!match) return { changed: false, output: raw };

  const header = match[1];
  if(!header)
  {
    throw new Error("Failed to parse frontmatter header");
  }
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  

  // overwrite (replace existing or append if missing)
const updatedHeader = header
    .replace(/^\s*lastChecked\s*:\s*.*$/m, '') // strip existing
    .replace(/\s*$/, '') + `${eol}lastChecked: ${iso}`;
  const output = raw.replace(fmRe, `---${eol}${updatedHeader}${eol}---`);
  return { changed: true, output };
}

async function setLastChecked(filePath: string) {

  const target = path.resolve(REPO_ROOT, filePath);
  let st;
  try {
    st = await statAsync(target);
  } catch {
    console.error(`File not found: ${path.relative(REPO_ROOT, target)}`);
    process.exit(1);
  }
  if (!st.isFile()) {
    console.error('Path is not a file.');
    process.exit(1);
  }
  const ext = path.extname(target).toLowerCase();
  if (!['.md', '.mdx'].includes(ext)) {
    console.error('Only .md/.mdx files are supported.');
    process.exit(1);
  }

  const raw = await readFile(target, 'utf8');
  
  const iso = Time.getNow().toISOString();

  const { changed, output } = addLastChecked(raw, iso);
  if (changed) {
    await writeFile(target, output, 'utf8');
    console.log(`updated: ${path.relative(REPO_ROOT, target)}`);
  } else {
    console.log('No changes needed.', target);
  }
}


export {setLastChecked};