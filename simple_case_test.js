/* §69: 追加10件が「短い聞き取り＋安全操作」で実際に解けることを固定する。 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { readGameSource, functionSource } = require('./test_helpers');

const dataPath = process.argv[2] || path.join(__dirname, 'p2_data.js');
const dataSource = fs.readFileSync(dataPath, 'utf8') +
  '\nreturn {CAUSES,TYPES,TESTS,RISKY,REMEDIES,SCENARIOS};';
const { CAUSES, TYPES, TESTS, RISKY, REMEDIES, SCENARIOS } = new Function(dataSource)();
const gameSource = process.argv[3] ? fs.readFileSync(process.argv[3], 'utf8') : readGameSource(__dirname);
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
const remedyMatchesScenarioSource = functionSource(gameSource, 'remedyMatchesScenario');
const doCloseSource = functionSource(gameSource, 'doClose');
assert(remedyMatchesScenarioSource, '§69: 案件ごとの対処一致判定がない');
assert(doCloseSource.includes('scenarioRemedyMatched &&'), '§69: 同じ原因内の別案件用対処が成功を遮断されない');
const remedyMatchesScenario = new Function(remedyMatchesScenarioSource + '\nreturn remedyMatchesScenario;')();
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
  assert(remedyMatchesScenario(scenario, scenario.best), scenario.id + ': 正解対処が案件に適用できない');
  (scenario.partial || []).forEach(remedyId => assert(remedyMatchesScenario(scenario, remedyId), scenario.id + ': 部分解が案件に適用できない'));
  (REMEDIES[scenario.trueCause] || []).filter(remedy => remedy.id !== scenario.best && !(scenario.partial || []).includes(remedy.id)).forEach(remedy => {
    assert(!remedyMatchesScenario(scenario, remedy.id), scenario.id + ': 別案件用対処 ' + remedy.id + ' が適用可能になっている');
  });

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

// 実際のdoClose経路でも、テスト前提のない旧対処を選ぶだけでは閉じない。
simpleCases.forEach(scenario => {
  const bypass = (REMEDIES[scenario.trueCause] || []).find(remedy =>
    remedy.outcomeMode === 'treatment' && remedy.id !== scenario.best && !(scenario.partial || []).includes(remedy.id)
  );
  if (!bypass) return;
  const ticket = {s:scenario,transcript:[],misdiagnoses:0,patience:100,state:'open',stress:0};
  const state = {focus:ticket,ui:{},cost:0,escLeft:3};
  let successful = false;
  const doClose = new Function(
    'state','REMEDIES','remedyBlockReason','spendOnCall','playClueSound','advance','pushCustomerLine','addStress','CALL_FLOW_LINES','treatmentSucceeds','finishSuccessfulClose','finishDeferredArrangement','finishRemedyRefund','render','defaultUi','remedyMatchesScenario',
    doCloseSource + '\nreturn doClose;'
  )(
    state,REMEDIES,() => '',() => true,() => {},() => {},
    (target,text) => target.transcript.push({who:'cust',text}),() => true,
    {misdiagnosis:{failure:'失敗',apology:'謝罪'},unverifiable:{noSignal:{[scenario.type]:'未復旧'}}},
    () => true,() => { successful = true; },() => { successful = true; },() => { successful = true; },
    () => {},() => ({}),remedyMatchesScenario
  );
  doClose(scenario.trueCause, bypass.id);
  assert(!successful && ticket.state === 'open', scenario.id + ': 同じ原因の別案件用対処 ' + bypass.id + ' で閉じられる');
});

console.log('簡単案件10件の収束・安全操作・実行経路: 問題なし');
