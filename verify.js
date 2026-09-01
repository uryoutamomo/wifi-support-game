/* データ整合性の検査。
   問題があれば終了コード 1 で落ちるので、CI や自動処理から呼べる。
   検査対象は第1引数で差し替えられる（壊したコピーで検査自体を試すため） */
const fs = require('fs');
const path = process.argv[2] || require('path').join(__dirname, 'p2_data.js');
const src = fs.readFileSync(path, 'utf8') +
  '\nreturn {CAUSES,TYPES,TONES,QUESTIONS,LOOKUPS,TESTS,RISKY,REMEDIES,SCENARIOS};';
const D = new Function(src)();
const {CAUSES, TYPES, TONES, QUESTIONS, LOOKUPS, TESTS, RISKY, REMEDIES, SCENARIOS} = D;

const causeIds = new Set(CAUSES.map(c => c.id));
const qIds = new Set(QUESTIONS.map(q => q.id));
const lIds = new Set(LOOKUPS.map(l => l.id));
const tIds = new Set(TESTS.map(t => t.id));
const riskyIds = new Set(RISKY.map(t => t.id));

let errors = 0;
const bad = (msg) => { console.log('  NG  ' + msg); errors++; };

// REMEDIES のキーが全部 cause として存在するか
Object.keys(REMEDIES).forEach(k => {
  if (!causeIds.has(k)) bad('REMEDIES のキー ' + k + ' に対応する原因がない');
});
// 全 cause に remedy があるか
CAUSES.forEach(c => {
  if (!REMEDIES[c.id] || !REMEDIES[c.id].length) bad('原因 ' + c.id + ' に対処が定義されていない');
});
Object.values(REMEDIES).flat().forEach(r => {
  if (r.needsTest && !tIds.has(r.needsTest)) bad('対処 ' + r.id + ': needsTest ' + r.needsTest + ' が安全操作にない');
});

console.log('--- シナリオ検査 ---');
SCENARIOS.forEach(s => {
  const tag = s.id + ' ' + s.name;
  if (!causeIds.has(s.trueCause)) bad(tag + ': trueCause ' + s.trueCause + ' が原因マスタにない');

  const rem = (REMEDIES[s.trueCause] || []).map(r => r.id);
  if (!rem.includes(s.best)) bad(tag + ': best ' + s.best + ' が REMEDIES[' + s.trueCause + '] にない');
  if (s.bestNoOutage && !rem.includes(s.bestNoOutage)) bad(tag + ': bestNoOutage ' + s.bestNoOutage + ' がない');
  (s.partial || []).forEach(p => {
    if (!rem.includes(p)) bad(tag + ': partial ' + p + ' がない');
  });

  const facts = [];
  Object.keys(s.replies || {}).forEach(k => {
    if (!qIds.has(k)) bad(tag + ': 質問ID ' + k + ' が存在しない');
    if (s.replies[k].fact) facts.push(['聞き取り:' + k, s.replies[k].fact]);
  });
  Object.keys(s.lookups || {}).forEach(k => {
    if (!lIds.has(k)) bad(tag + ': 照会ID ' + k + ' が存在しない');
    if (s.lookups[k].fact) facts.push(['照会:' + k, s.lookups[k].fact]);
  });
  // シナリオ固有の定義がない照会は miss になる。miss に情報がある場合はそれも数える
  LOOKUPS.forEach(l => {
    if (!(s.lookups || {})[l.id] && l.missFact) facts.push(['照会(空振り):' + l.id, l.missFact]);
  });
  Object.keys(s.tests || {}).forEach(k => {
    if (!tIds.has(k) && !riskyIds.has(k)) bad(tag + ': テストID ' + k + ' が存在しない');
    const test = s.tests[k];
    if (test.fact) facts.push(['操作:' + k, test.fact]);
    (test.sequence || []).forEach((step, index) => {
      if (step.fact) facts.push(['操作:' + k + '#' + (index + 1), step.fact]);
    });
  });

  // fact の参照先が実在するか／真の原因を自分で除外していないか
  facts.forEach(([src, f]) => {
    (f.out || []).forEach(c => {
      if (!causeIds.has(c)) bad(tag + ' ' + src + ': out の ' + c + ' が原因マスタにない');
      if (c === s.trueCause) bad(tag + ' ' + src + ': ★真の原因 ' + c + ' を自分で除外している');
    });
    (f.hot || []).forEach(c => {
      if (!causeIds.has(c)) bad(tag + ' ' + src + ': hot の ' + c + ' が原因マスタにない');
    });
  });

  // 全部の手がかりを集めたとき、真の原因が残り、候補が十分に絞れるか
  const allOut = new Set();
  facts.forEach(([, f]) => (f.out || []).forEach(c => allOut.add(c)));
  const remaining = CAUSES.filter(c => !allOut.has(c.id)).map(c => c.id);
  const hot = new Set();
  facts.forEach(([, f]) => (f.hot || []).forEach(c => hot.add(c)));

  console.log(tag + ' [' + s.trueCause + '] 手がかり' + facts.length + '件 → 残る候補 ' +
    remaining.length + '/' + CAUSES.length + ' : ' + remaining.join(',') +
    ' ／ hot: ' + ([...hot].join(',') || '(なし)'));

  if (!hot.has(s.trueCause)) bad(tag + ': どの手がかりも真の原因を hot として指していない');
  // 契約：手がかりを全部集めたら、残る候補は真の原因ちょうど1つ
  if (remaining.length !== 1){
    bad(tag + ': 全部集めても候補が ' + remaining.length + ' 個残る（1つに絞れる必要がある）: ' + remaining.join(','));
  } else if (remaining[0] !== s.trueCause){
    bad(tag + ': 全部集めると ' + remaining[0] + ' だけが残るが、真の原因は ' + s.trueCause);
  }
});

console.log('\n--- 到着スケジュール ---');
SCENARIOS.forEach(s => {
  const min = 22 * 60 + s.arrive;
  const h = Math.floor(min / 60) % 24, m = min % 60;
  console.log('  ' + s.id + ' +' + String(s.arrive).padStart(2) + '分  ' +
    String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') + '  ' +
    s.city + ' / ' + s.trueCause + ' / ' + s.abandonAfter + '分で放棄');
});

console.log('\n' + (errors ? '★ ' + errors + ' 件の問題あり' : '問題なし'));
if (errors) process.exitCode = 1;
