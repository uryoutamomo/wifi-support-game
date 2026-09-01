/* Source fragments are kept readable during editing; this creates the single-file game. */
const fs = require('fs');
const path = require('path');
const { SOURCE_PARTS } = require('./source_manifest');

const root = __dirname;
const source = SOURCE_PARTS
  .map(name => fs.readFileSync(path.join(root, name), 'utf8').trimEnd())
  .join('\n\n');

fs.writeFileSync(
  path.join(root, 'index.html'),
  source + '\n</script>\n</body>\n</html>\n',
  'utf8',
);

console.log('index.html を生成しました');
