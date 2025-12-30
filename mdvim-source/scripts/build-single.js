/**
 * Build Single HTML File
 * TypeScriptをコンパイルし、CSS/JSを埋め込んだ単一HTMLを生成
 */

import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

async function build() {
  console.log('Building mdvim single HTML...');
  
  // 1. TypeScriptをバンドル
  console.log('Bundling TypeScript...');
  const result = await esbuild.build({
    entryPoints: [path.join(SRC_DIR, 'ts/main.ts')],
    bundle: true,
    minify: true,
    format: 'iife',
    globalName: 'mdvim',
    write: false,
  });
  
  const jsCode = result.outputFiles[0].text;
  
  // 2. CSSを読み込み
  console.log('Reading CSS...');
  const cssPath = path.join(SRC_DIR, 'styles', 'main.css');
  let cssCode = '';
  if (fs.existsSync(cssPath)) {
    cssCode = fs.readFileSync(cssPath, 'utf-8');
  }
  
  // 3. HTMLテンプレートを読み込み
  console.log('Reading HTML template...');
  const htmlTemplate = fs.readFileSync(
    path.join(SRC_DIR, 'index.html'),
    'utf-8'
  );
  
  // 4. 結合
  console.log('Combining files...');
  // 注意: replace()の第2引数で$&は特殊文字なので、関数を使って回避
  let finalHtml = htmlTemplate.replace('<!-- CSS_PLACEHOLDER -->', `<style>\n${cssCode}</style>`);
  finalHtml = finalHtml.replace('<!-- JS_PLACEHOLDER -->', () => `<script>\n${jsCode}\n</script>`);
  
  // 5. 出力
  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }
  
  fs.writeFileSync(path.join(DIST_DIR, 'mdvim.html'), finalHtml);
  console.log('Done! Output: dist/mdvim.html');
  console.log(`  CSS: ${cssCode.length} bytes`);
  console.log(`  JS: ${jsCode.length} bytes`);
  console.log(`  HTML: ${finalHtml.length} bytes`);
}

build().catch(console.error);
