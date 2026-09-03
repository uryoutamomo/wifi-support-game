/* ゲームが次の案件へ進めなくなる経路を防ぐ回帰テスト。 */
const assert = require('assert');
const fs = require('fs');
const { readGameSource, functionSource: extractFunctionSource } = require('./test_helpers');

const game = readGameSource(__dirname);
const dataSource = fs.readFileSync(__dirname + '/p2_data.js', 'utf8') +
  '\nreturn {CAUSES,QUESTIONS,LOOKUPS,TESTS,REMEDIES,SCENARIOS,COMMAND_DEFS,DEVICE_VERIFICATION_MINUTES};';
const { CAUSES, QUESTIONS, LOOKUPS, TESTS, REMEDIES, SCENARIOS, COMMAND_DEFS, DEVICE_VERIFICATION_MINUTES } = new Function(dataSource)();

const functionSource = (name) => {
  return extractFunctionSource(game, name);
};

assert(!game.includes('function advanceIdleOffice') && !game.includes('function nextInboundDelta'), 'オフィスへ戻るだけで次の事象まで時間を飛ばす処理が残っている');
assert(functionSource('enterOffice').includes('activateDueInbound()') && !functionSource('enterOffice').includes('advance('), '§64 検査1: オフィスへ戻るだけで時刻を進める');
assert(functionSource('activateDueInbound').includes('t.arrivedTurn <= state.turn'), '到着済み着信の判定がない');

const verificationState = {
  phase:'office', focus:null, turn:0, clock:23*60, deviceVerificationMinutes:0, verifiedDevices:0,
  tickets:[{state:'inbound',arrivedTurn:7}], officeEvents:[],
};
const verificationAdvance = minutes => {
  for (let i=0; i<minutes; i++){
    verificationState.turn++;
    verificationState.clock++;
    verificationState.tickets.forEach(ticket => {
      if (ticket.state === 'inbound' && ticket.arrivedTurn <= verificationState.turn) ticket.state = 'waiting';
    });
  }
};
let verificationRenders = 0;
const runVerification = new Function('state','DEVICE_VERIFICATION_MINUTES','advance','recordOfficeEvent','renderOffice', functionSource('runDeviceVerification') + '\nreturn runDeviceVerification;')(
  verificationState,DEVICE_VERIFICATION_MINUTES,verificationAdvance,(kind,text) => verificationState.officeEvents.push({kind,text}),() => { verificationRenders++; }
);
const interruptedVerification = runVerification();
assert(interruptedVerification.advanced === 7 && interruptedVerification.interrupted && !interruptedVerification.completed && verificationState.deviceVerificationMinutes === 7 && verificationState.tickets[0].state === 'waiting', '機器検証が着信した分で中断し、途中時間を保存できない');
const blockedTurn = verificationState.turn;
assert(runVerification().advanced === 0 && verificationState.turn === blockedTurn, '着信中にも機器検証で時間を進められる');
verificationState.tickets[0].state = 'closed';
const completedVerification = runVerification();
assert(completedVerification.advanced === DEVICE_VERIFICATION_MINUTES - 7 && completedVerification.completed && verificationState.verifiedDevices === 1 && verificationState.deviceVerificationMinutes === 0 && verificationRenders === 2, '中断した機器検証を再開して合計60分で1台完了できない');

const closeSource = functionSource('doClose') + functionSource('finishSuccessfulClose');
assert(closeSource.includes('t.pendingResult = result'), '解決後に終話待ち状態へ入らない');
assert(!closeSource.includes('closeTicket(t, result)'), '解決判定だけで電話が切れ、別れの言葉を確認できない');
assert(functionSource('finishResolvedCall').includes('closeTicket(t, result)'), '「電話を切る」で解決済み案件を閉じられない');
const interruptSource = functionSource('interruptCall');
const finishInterruptedSource = functionSource('finishInterruptedCall');
assert(interruptSource.includes('t.pendingInterruption = true') && finishInterruptedSource.includes("t.state = 'waiting'") && finishInterruptedSource.includes('t.arrivedTurn = state.turn'), '途中切断後に再着信へ進まない');
assert(finishInterruptedSource.includes('state.focus = null') && finishInterruptedSource.includes('enterOffice()'), '途中切断の発話確認後にオフィスへ戻れない');

const causeIds = new Set(CAUSES.map(cause => cause.id));
const questionIds = new Set(QUESTIONS.map(question => question.id));
const testIds = new Set(TESTS.map(test => test.id));
SCENARIOS.forEach(scenario => {
  assert(['hotel','mobile'].includes(scenario.callbackTo), scenario.id + ': 将来復帰用callbackToが残っていない');
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
  if (best.needsCarrierRestored) assert(scenario.lookups && scenario.lookups.l_carrier && scenario.lookups.l_carrier.restores === true, scenario.id + ': 正解対処が要求する現地キャリア復旧結果がない');
});
const carrierLookup = LOOKUPS.find(lookup => lookup.id === 'l_carrier');
assert(carrierLookup && carrierLookup.minutes === 30 && carrierLookup.external === true, '現地キャリア照会が30分の社外照会ではない');
assert.deepEqual(COMMAND_DEFS.map(command => command.label), ['聞く','調べる','伝える','ログ'], '折り返しが主コマンドへ戻っている');
assert(functionSource('startCarrierCallback').includes("state.ui.lookup !== lookup.id") && functionSource('resumeCallback').includes("t.state !== 'callback'"), '現地キャリア照会以外から折り返しを開始できる');
assert(SCENARIOS.every(scenario => {
  const best = (REMEDIES[scenario.trueCause] || []).find(remedy => remedy.id === scenario.best);
  return best && best.needsLookup !== 'l_carrier';
}), '現地キャリア照会が正解ルートの必須条件になっている');
const carrierFinishSource = functionSource('finishCarrierLookup');
assert(carrierFinishSource.includes("t.carrierReplyStatus === 'arrived'") && carrierFinishSource.includes("t.transcript.push({ who:'sys', text:'[現地キャリア] 完了連絡なし"), 'S12の完了連絡なし経路が未復旧を明示しない');
assert(carrierFinishSource.includes('t.carrierLookupStarted = false') && !carrierFinishSource.includes("t.lookedUp.add(l.id);\n  t.carrierLookupStarted = false"), 'S12の完了連絡なし経路から現地キャリアへ再依頼できない');
assert(functionSource('remedyBlockReason').includes('remedy.needsCarrierRestored && !t.carrierRestored'), 'S12が現地キャリアの再開通前に最適対処で閉じられる');

// §39: 一般のホテル折り返しでも、英語選択肢の違いで進行不能にならない。
assert(functionSource('startHotelCallback').includes('t.callbackPromised = preferredKind') && functionSource('finishPromisedCallback').includes("t.callbackReason = 'general'") && functionSource('finishPromisedCallback').includes("t.state = 'callback'"), 'l_carrier以外のホテル折り返しを開始できない');
assert(functionSource('resumeCallback').includes("t.callbackStage = 'front_desk'") && functionSource('resumeCallback').includes("who:'front'"), '折り返しがFront Deskから始まらない');
const frontChoiceSource = functionSource('handleFrontDeskChoice');
assert(frontChoiceSource.includes("['guest','room','callback'].includes(choice)") && frontChoiceSource.includes("t.callbackStage = 'connected'") && !frontChoiceSource.includes("t.callbackStage = 'blocked'"), 'Front Deskの英語選択肢に詰み経路がある');
// §40: 滞在先を聞かずに折り返しても詰まない。折り返せないまま客が掛け直してきて、対応を続けられる。
assert(functionSource('finishPromisedCallback').includes('!hotelContactKnown(t)') && functionSource('finishPromisedCallback').includes('blindCallbackRedial(t)'), 'ホテル名・滞在先未確認の折り返しを別扱いにしていない');
const blindRedialSource = functionSource('blindCallbackRedial');
assert(blindRedialSource.includes("t.state = 'waiting'") && blindRedialSource.includes('t.arrivedTurn = state.turn') && blindRedialSource.includes('leaveCallForOffice()'), '折り返せなかった案件が待ち行列へ戻らず進行不能になる');
assert(blindRedialSource.includes('t.redialOpening = CALL_FLOW_LINES.callback.blameOpenings[t.s.type]'), '折り返せなかった客が理由を言わずに掛け直してくる');

// §27-3 検査8: 調べる・ログを開けない状態でも、「聞く」で本人特定して全案件の正解ルートへ進める。
const identificationReady = new Function(functionSource('identificationReady') + '\nreturn identificationReady;')();
assert(!identificationReady({identified:false,nameKnown:true,destinationKnown:false}), '氏名だけで本人特定してログを開ける');
assert(identificationReady({identified:true,nameKnown:false,destinationKnown:false}), '契約IDによる本人特定でログを開けない');
assert(identificationReady({identified:false,nameKnown:true,destinationKnown:true}), '氏名と渡航先による本人特定でログを開けない');
const requireIdentificationSource = functionSource('requireIdentification');
const openLookupSource = functionSource('openLookup');
const openRecordSource = functionSource('openRecord');
assert(requireIdentificationSource.includes('identificationReady(t)') && requireIdentificationSource.includes("defaultUi('identity_denied')"), '調べる・ログの共通本人確認ガードがない');
assert(openLookupSource.includes('requireIdentification(t)') && !openLookupSource.includes('spendOnCall'), '本人特定前の調べる拒否が時間無消費でない');
assert(openRecordSource.includes('requireIdentification(t)') && openRecordSource.indexOf('requireIdentification(t)') < openRecordSource.indexOf('spendOnCall(t, 1, 0)'), '本人特定前のログ拒否が時間無消費でない');
assert(questionIds.has('q_contract') && questionIds.has('q_name') && questionIds.has('q_destination'), 'ログ拒否後に本人特定へ進む質問がない');

// §25-7 検査9: l_carrierも折り返しも使わず全案件を最短で閉じ、次の着信へ順番に到達して最後まで終われる。
const simulated = SCENARIOS.map(scenario => ({ state:'inbound', arrivedTurn:scenario.arrive, id:scenario.id }));
let simulatedTurn = 0;
const handled = [];
while (simulated.some(ticket => ticket.state !== 'closed')){
  simulated.filter(ticket => ticket.state === 'inbound' && ticket.arrivedTurn <= simulatedTurn)
    .forEach(ticket => { ticket.state = 'waiting'; });
  let waiting = simulated.filter(ticket => ticket.state === 'waiting').sort((a,b) => a.arrivedTurn - b.arrivedTurn);
  if (!waiting.length){
    simulatedTurn++;
    simulated.filter(ticket => ticket.state === 'inbound' && ticket.arrivedTurn <= simulatedTurn)
      .forEach(ticket => { ticket.state = 'waiting'; });
    waiting = simulated.filter(ticket => ticket.state === 'waiting').sort((a,b) => a.arrivedTurn - b.arrivedTurn);
    if (!waiting.length) continue;
  }
  assert(waiting.length, '待ち電話を作れず進行が止まった');
  waiting[0].state = 'closed';
  handled.push(waiting[0].id);
}
assert.deepEqual(handled, SCENARIOS.map(scenario => scenario.id), '全案件を到着順に最後まで処理できない');

console.log('進行不能・正解ルート到達性: 問題なし');
