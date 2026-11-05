const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const dir = path.join(__dirname, '../app/src/main/assets');
function extract(file, name) {
  const source = fs.readFileSync(path.join(dir, file), 'utf8');
  new vm.Script(source); // Validate the entire bundled script, not just the redirect function.
  const match = source.match(new RegExp(`const ${name} = \\(path\\) => \\{([\\s\\S]*?)\\n\\s*\\};`));
  assert.ok(match, `Missing ${name}`);
  return `(path) => {${match[1]}}`;
}
const instagram = vm.runInNewContext(extract('instagram.js', 'reelsRedirect'));
assert.equal(instagram('/reels/'), '/');
assert.equal(instagram('/reels/abc/'), '/reel/abc/');
assert.equal(instagram('/someone/reels/'), '/someone/');
assert.equal(instagram('/reel/abc/'), null);
assert.equal(instagram('/direct/inbox/'), null);
const settings = {showShorts:false, showSubscriptions:false};
const youtube = vm.runInNewContext(extract('youtube.js', 'redirect'), {settings});
assert.equal(youtube('/shorts/'), '/');
assert.equal(youtube('/shorts/abc'), '/watch?v=abc');
assert.equal(youtube('/@channel/shorts'), '/@channel');
assert.equal(youtube('/channel/id/shorts'), '/channel/id');
assert.equal(youtube('/feed/subscriptions'), '/');
assert.equal(youtube('/watch'), null);
settings.showShorts = true;
settings.showSubscriptions = true;
assert.equal(youtube('/shorts/abc'), null);
assert.equal(youtube('/feed/subscriptions'), null);
console.log('13 filter-navigation assertions passed; both bundled scripts parse.');
