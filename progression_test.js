/* ゲームが次の案件へ進めなくなる経路を防ぐ回帰テスト。 */
const assert = require('assert');
const fs = require('fs');
const { readGameSource, functionSource: extractFunctionSource } = require('./test_helpers');

const game = readGameSource(__dirname);
const dataSource = fs.readFileSync(__dirname + '/p2_data.js', 'utf8') +
  '\nreturn {CAUSES,QUESTIONS,TESTS,REMEDIES,SCENARIOS};';
const { CAUSES, QUESTIONS, TESTS, REMEDIES, SCENARIOS } = new Function(dataSource)();

const functionSource = (name) => {
  return extractFunctionSource(game, name);
};

const nextInboundDelta = new Function(functionSource('nextInboundDelta') + '\nreturn nextInboundDelta;')();
assert.equal(nextInboundDelta([
  { state:'closed', arrivedTurn:0 },
  { state:'inbound', arrivedTurn:5 },
  { state:'inbound', arrivedTurn:11 },
], 2), 3, 'S1を早く解決した後、S2の着信まで3分進められない');
assert.equal(nextInboundDelta([{ state:'waiting', arrivedTurn:0 }], 2), null, '未来の着信がないのに待機時間を作る');

const idleSource = functionSource('advanceIdleOffice');
assert(idleSource.includes("t.state === 'waiting' || t.state === 'callback'"), '応答可能な電話があるのに時刻を飛ばす');
assert(idleSource.includes('activateDueInbound()'), '到着時刻と現在時刻が同じ電話を待機中へ移せない');
assert(idleSource.includes('nextInboundDelta(state.tickets, state.turn)'), '次の着信まで進める処理がない');
assert(functionSource('enterOffice').includes('advanceIdleOffice()'), 'オフィスへ戻る際に次の着信を起こしていない');
assert(functionSource('activateDueInbound').includes('t.arrivedTurn <= state.turn'), '到着済み着信の判定がない');

const closeSource = functionSource('doClose');
assert(closeSource.includes('t.pendingResult = result'), '解決後に終話待ち状態へ入らない');
assert(!closeSource.includes('closeTicket(t, result)'), '解決判定だけで電話が切れ、別れの言葉を確認できない');
assert(functionSource('finishResolvedCall').includes('closeTicket(t, result)'), '「電話を切る」で解決済み案件を閉じられない');
const interruptSource = functionSource('interruptCall');
assert(interruptSource.includes("t.state = 'waiting'") && interruptSource.includes('t.arrivedTurn = state.turn'), '途中切断後に再着信へ進まない');
assert(interruptSource.includes('state.focus = null') && interruptSource.includes('enterOffice()'), '途中切断後にオフィスへ戻れない');

const causeIds = new Set(CAUSES.map(cause => cause.id));
const questionIds = new Set(QUESTIONS.map(question => question.id));
const testIds = new Set(TESTS.map(test => test.id));
SCENARIOS.forEach(scenario => {
  assert(causeIds.has(scenario.trueCause), scenario.id + ': trueCause が原因マスタにない');
  const remedies = REMEDIES[scenario.trueCause] || [];
  const best = remedies.find(remedy => remedy.id === scenario.best);
  assert(best, scenario.id + ': 正解対処が原因の対処一覧にない');
  if (best.needsTest){
    assert(testIds.has(best.needsTest), scenario.id + ': 正解対処の前提操作が存在しない');
    const test = scenario.tests && scenario.tests[best.needsTest];
    assert(test, scenario.id + ': 正解対処に必要な操作結果がシナリオにない');
    if (best.needsTestCount > 1) assert((test.sequence || []).length >= best.needsTestCount, scenario.id + ': 必要回数ぶんの操作結果がない');
  }
  if (best.requiresQuestions) best.requiresQuestions.forEach(id => {
    assert(questionIds.has(id), scenario.id + ': 正解対処の前提質問 ' + id + ' が存在しない');
    assert(scenario.replies && scenario.replies[id], scenario.id + ': 前提質問 ' + id + ' への返答がない');
  });
  if (best.requiresLongStay) assert(scenario.stayDays >= best.requiresLongStay, scenario.id + ': 正解配送なのに滞在期間が条件を満たさない');
  if (best.requiresConsent) assert(scenario.wantsReplacement === true, scenario.id + ': 正解配送なのに顧客が希望していない');
});

// 全案件を最短で閉じても、次の着信へ順番に到達して最後まで終われる。
const simulated = SCENARIOS.map(scenario => ({ state:'inbound', arrivedTurn:scenario.arrive, id:scenario.id }));
let simulatedTurn = 0;
const handled = [];
while (simulated.some(ticket => ticket.state !== 'closed')){
  simulated.filter(ticket => ticket.state === 'inbound' && ticket.arrivedTurn <= simulatedTurn)
    .forEach(ticket => { ticket.state = 'waiting'; });
  let waiting = simulated.filter(ticket => ticket.state === 'waiting').sort((a,b) => a.arrivedTurn - b.arrivedTurn);
  if (!waiting.length){
    const delta = nextInboundDelta(simulated, simulatedTurn);
    assert(delta !== null && delta > 0, '未完了案件があるのに次の着信へ進めない');
    simulatedTurn += delta;
    simulated.filter(ticket => ticket.state === 'inbound' && ticket.arrivedTurn <= simulatedTurn)
      .forEach(ticket => { ticket.state = 'waiting'; });
    waiting = simulated.filter(ticket => ticket.state === 'waiting').sort((a,b) => a.arrivedTurn - b.arrivedTurn);
  }
  assert(waiting.length, '待ち電話を作れず進行が止まった');
  waiting[0].state = 'closed';
  handled.push(waiting[0].id);
}
assert.deepEqual(handled, SCENARIOS.map(scenario => scenario.id), '全案件を到着順に最後まで処理できない');

console.log('進行不能・正解ルート到達性: 問題なし');
