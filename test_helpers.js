const fs = require('fs');
const path = require('path');
const { SOURCE_PARTS } = require('./source_manifest');

const GAME_PARTS = SOURCE_PARTS.filter(name => /^p[3-9]_/.test(name));

function readParts(root, parts){
  return parts.map(name => fs.readFileSync(path.join(root, name), 'utf8')).join('\n');
}

function readGameSource(root = __dirname){
  return readParts(root, GAME_PARTS);
}

function functionSource(source, name){
  const start = source.indexOf('function ' + name + '(');
  const end = source.indexOf('\nfunction ', start + 1);
  return start < 0 ? '' : source.slice(start, end < 0 ? source.length : end);
}

function builtIndexSource(root = __dirname){
  return SOURCE_PARTS
    .map(name => fs.readFileSync(path.join(root, name), 'utf8').trimEnd())
    .join('\n\n') + '\n</script>\n</body>\n</html>\n';
}

module.exports = { GAME_PARTS, readGameSource, functionSource, builtIndexSource };
