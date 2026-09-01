/* 一文字ずつ表示にかかる時間を見積もる（25ms/文字 + 句読点で175ms） */
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/p2_data.js', 'utf8') +
  '\nreturn {SCENARIOS,LOOKUPS,TYPES,APOLOGY_REPLIES,FAREWELL_LINES,REDIAL_OPENINGS};';
const { SCENARIOS, LOOKUPS, TYPES, APOLOGY_REPLIES, FAREWELL_LINES, REDIAL_OPENINGS } = new Function(src)();

const PER_CHAR = 25;
const PAUSE = 175;
const pauseChars = /[、。！？!?]/g;

function duration(text){
  const pauses = (text.match(pauseChars) || []).length;
  return text.length * PER_CHAR + pauses * PAUSE;
}

// 一文字ずつ出す対象は「顧客の発話」と「社内システムの応答」だけ
const lines = [];
SCENARIOS.forEach(s => {
  lines.push([s.id + ' 第一報', s.opening]);
  lines.push([s.id + ' 契約番号', s.contractId.text]);
  if (s.rushedReply) lines.push([s.id + ' 急ぎ返答', s.rushedReply]);
  Object.entries(s.replies || {}).forEach(([k, v]) => lines.push([s.id + ' ' + k, v.text]));
  Object.entries(s.lookups || {}).forEach(([k, v]) => lines.push([s.id + ' ' + k, v.text]));
  Object.entries(s.tests || {}).forEach(([k, v]) => {
    if (v.text) lines.push([s.id + ' ' + k, v.text]);
    (v.sequence || []).forEach((step, index) => lines.push([s.id + ' ' + k + '#' + (index + 1), step.text]));
  });
  (s.smalltalk || []).forEach(topic => {
    lines.push([s.id + ' 雑談成功 ' + topic.id, topic.goodReply]);
    lines.push([s.id + ' 雑談失敗 ' + topic.id, topic.badReply]);
  });
});
LOOKUPS.forEach(l => lines.push(['(空振り) ' + l.id, l.miss]));
Object.entries(TYPES).forEach(([type, data]) => {
  ['irritated','angry','furious'].forEach(stage => data[stage].forEach((text, index) => lines.push([type + ' ' + stage + '#' + (index + 1), text])));
  ['sootheReply','sootheMissReply','sootheRepeatReply'].forEach(key => lines.push([type + ' ' + key, data[key]]));
  Object.entries(APOLOGY_REPLIES[type]).forEach(([key, text]) => lines.push([type + ' apology ' + key, text]));
});
Object.entries(FAREWELL_LINES.best).forEach(([type, text]) => lines.push([type + ' 別れ', text]));
lines.push(['暫定対応の別れ', FAREWELL_LINES.partial], ['不適切対応の別れ', FAREWELL_LINES.poor]);
Object.entries(REDIAL_OPENINGS).forEach(([kind, text]) => lines.push(['再着信 ' + kind, text]));

const scored = lines.map(([tag, text]) => ({ tag, len: text.length, ms: duration(text), text }))
  .sort((a, b) => b.ms - a.ms);

console.log('一文字ずつ出す行の総数: ' + scored.length);
console.log('平均: ' + (scored.reduce((a, b) => a + b.ms, 0) / scored.length / 1000).toFixed(2) + '秒');
console.log('');
console.log('--- 長い順に10件 ---');
scored.slice(0, 10).forEach(x => {
  const mark = x.ms > 4000 ? ' ★4秒超' : '';
  console.log('  ' + (x.ms / 1000).toFixed(2) + '秒 / ' + x.len + '字 / ' + x.tag + mark);
  console.log('      ' + x.text.slice(0, 46) + (x.text.length > 46 ? '…' : ''));
});

const over = scored.filter(x => x.ms > 4000);
console.log('');
console.log('4秒を超える行: ' + over.length + '件 / ' + scored.length + '件');
if (over.length){
  // 4秒に収めるために必要な1文字あたりの時間
  const worst = over[0];
  const pauses = (worst.text.match(pauseChars) || []).length;
  const need = Math.floor((4000 - pauses * PAUSE) / worst.len);
  console.log('最長の行を4秒に収めるには ' + need + 'ms/文字 まで詰める必要がある');
  const need2 = Math.floor((4000 - pauses * 100) / worst.len);
  console.log('（句読点の間を100msに縮めるなら ' + need2 + 'ms/文字）');
  process.exitCode = 1;
}
