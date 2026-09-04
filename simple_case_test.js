/* §69: 追加10件が「短い聞き取り＋安全操作」で実際に解けることを固定する。 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { readGameSource, functionSource } = require('./test_helpers');

const dataPath = process.argv[2] || path.join(__dirname, 'p2_data.js');
const dataSource = fs.readFileSync(dataPath, 'utf8') +
  '\nreturn {CAUSES,TYPES,TESTS,RISKY,REMEDIES,SCENARIOS};';
const { CAUSES, TYPES, TESTS, RISKY, REMEDIES, SCENARIOS } = new Function(dataSource)();
const gameSource = readGameSource(__dirname);
const simpleIds = Array.from({length:10}, (_, index) => 'S' + (index + 15));
const simpleCases = simpleIds.map(id => SCENARIOS.find(scenario => scenario.id === id));
const safeTestIds = new Set(TESTS.map(test => test.id));
const riskyTestIds = new Set(RISKY.map(test => test.id));
const expectedCauses = new Set(['device_side','device_net','location','power']);

assert.equal(SCENARIOS.length, 24, '§69: 案件総数が24件でない');
assert(simpleCases.every(Boolean), '§69: S15〜S24の10件が揃っていない');
assert.equal(new Set(simpleCases.map(scenario => scenario.id)).size, 10, '§69: 追加10件のIDが重複している');
assert(simpleCases.every(scenario => scenario.difficulty === 'easy'), '§69: 追加案件にeasy指定がない');
assert(simpleCases.every(scenario => expectedCauses.has(scenario.trueCause)), '§69: 追加案件が安全に戻せる4原因の外へ広がっている');
assert(simpleCases.every(scenario => scenario.source && /^https:\/\//.test(scenario.source.url) && scenario.source.title), '§69: 追加案件の公式根拠URLが揃っていない');
assert.equal(new Set(simpleCases.map(scenario => scenario.source.url)).size, 10, '§69: 追加案件の公式根拠URLが重複している');
assert(simpleCases.every(scenario => !scenario.lookups || Object.keys(scenario.lookups).length === 0), '§69: 簡単案件が社内・社外照会を必須にしている');

const doTestSource = functionSource(gameSource, 'doTest');
simpleCases.forEach(scenario => {
  const diagnosticFacts = Object.entries(scenario.replies || {})
    .filter(([id, reply]) => id !== 'q_return' && reply.fact);
  assert.equal(diagnosticFacts.length, 1, scenario.id + ': 診断に必要な聞き取りが1問に収まっていない');
  assert(diagnosticFacts[0][1].fact.hot.includes(scenario.trueCause), scenario.id + ': 1問の手がかりが真因を指していない');

  const best = (REMEDIES[scenario.trueCause] || []).find(remedy => remedy.id === scenario.best);
  assert(best, scenario.id + ': 正解対処が原因の一覧にない');
  assert(best.needsTest && safeTestIds.has(best.needsTest), scenario.id + ': 正解対処に安全操作の前提がない');
  assert(!riskyTestIds.has(best.needsTest), scenario.id + ': 正解対処が危険操作を要求する');
  const result = scenario.tests && scenario.tests[best.needsTest];
  assert(result && result.solves === true && result.fact, scenario.id + ': 安全操作で復旧を確認できない');
  assert(result.fact.hot.includes(scenario.trueCause), scenario.id + ': 復旧操作の事実が真因を指していない');
  assert.deepEqual([...new Set(result.fact.out)].sort(), CAUSES.filter(cause => cause.id !== scenario.trueCause).map(cause => cause.id).sort(), scenario.id + ': 復旧確認後に真因以外が残る');

  const ticket = {
    s:scenario, testCounts:new Map(), tested:new Set(), transcript:[], facts:[], stress:0,
    symptomResolved:false, wasted:0, damage:0,
  };
  const state = {focus:ticket,ui:{}};
  const doTest = new Function(
    'state','RISKY','TESTS','TYPES','addStress','spendOnCall','pushCustomerLine','addFact','playBadActionSound','defaultUi','render',
    doTestSource + '\nreturn doTest;'
  )(
    state,RISKY,TESTS,TYPES,() => true,() => true,
    (target,text) => target.transcript.push({who:'cust',text}),
    (target,fact,src) => target.facts.push({text:fact.text,src,out:fact.out || [],hot:fact.hot || []}),
    () => {},() => ({}),() => {}
  );
  doTest(best.needsTest);
  assert(ticket.symptomResolved, scenario.id + ': 実際のdoTest経路で復旧状態にならない');
  assert(ticket.tested.has(best.needsTest) && ticket.facts.length === 1, scenario.id + ': 実際のdoTest経路で操作・事実が記録されない');
  assert(ticket.transcript.some(line => line.text === TYPES[scenario.type].solvedReply), scenario.id + ': 実際のdoTest経路で復旧した顧客反応が出ない');
  doTest(best.needsTest);
  assert.equal(ticket.facts.length, 1, scenario.id + ': 同じ操作の繰り返しで事実が重複する');
});

console.log('簡単案件10件の収束・安全操作・実行経路: 問題なし');
