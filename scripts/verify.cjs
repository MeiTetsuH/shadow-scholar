const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { JSDOM } = require('jsdom');
const manifest = JSON.parse(fs.readFileSync('manifest.json'));
const pkg = JSON.parse(fs.readFileSync('package.json'));
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.version, pkg.version);
assert.equal(manifest.minimum_chrome_version, '116');
assert.ok(!manifest.permissions.includes('offscreen'));
const files = fs.readdirSync('.').filter(f => f.endsWith('.js'));
for (const file of files) execFileSync(process.execPath, ['--check', file]);
for (const file of ['sidepanel.html', 'popup.html']) {
  const doc = new JSDOM(fs.readFileSync(file, 'utf8')).window.document;
  for (const node of doc.querySelectorAll('*')) {
    assert.ok(![...node.attributes].some(attr => /^on/i.test(attr.name)), `Inline event handler in ${file}`);
  }
  for (const script of doc.querySelectorAll('script')) {
    assert.ok(script.src && !/^https?:/.test(script.src), `Unpackaged script in ${file}`);
    assert.ok(fs.existsSync(script.src));
  }
}
for (const file of [manifest.background.service_worker, manifest.side_panel.default_path, ...Object.values(manifest.icons), ...manifest.content_scripts.flatMap(c => c.js)]) assert.ok(fs.existsSync(file), file);
const en = JSON.parse(fs.readFileSync('_locales/en/messages.json'));
const zh = JSON.parse(fs.readFileSync('_locales/zh_CN/messages.json'));
assert.deepEqual(Object.keys(en).sort(), Object.keys(zh).sort());
const sources = [...files, 'sidepanel.html', 'popup.html'].map(f => fs.readFileSync(f, 'utf8')).join('\n');
for (const match of sources.matchAll(/(?:I18n\.t\(['"]|data-i18n(?:-title|-placeholder)?=")([^'"\s]+)['"]/g)) assert.ok(en[match[1]], `Missing translation: ${match[1]}`);
assert.ok(en.extDescription.message.length <= 132);
assert.ok(zh.extDescription.message.length <= 132);
assert.equal(fs.readFileSync('lib/marked.min.js', 'utf8'), fs.readFileSync('node_modules/marked/lib/marked.umd.js', 'utf8'), 'Vendored Markdown must match the pinned package');
assert.ok(fs.existsSync('lib/marked.LICENSE'));
execFileSync('git', ['diff', '--check']);
console.log('Manifest, syntax, locale keys, CSP handlers, and vendored dependency checks passed.');
