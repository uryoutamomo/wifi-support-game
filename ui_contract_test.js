/* UIとSIM清掃の、見た目に依存しない回帰契約。 */
const assert = require('assert');
const fs = require('fs');
const { readGameSource, functionSource: extractFunctionSource, builtIndexSource } = require('./test_helpers');
const { SOURCE_PARTS } = require('./source_manifest');

const game = readGameSource(__dirname);
const page = fs.readFileSync(__dirname + '/p1_head.html', 'utf8');
const gameLogicSource = fs.readFileSync(__dirname + '/p3_game.js', 'utf8');
const viewSource = fs.readFileSync(__dirname + '/p4_view.js', 'utf8');
const eventSource = fs.readFileSync(__dirname + '/p5_events.js', 'utf8');
const handover = fs.readFileSync(__dirname + '/HANDOVER.md', 'utf8');
const dataSource = fs.readFileSync(__dirname + '/p2_data.js', 'utf8') +
  '\nreturn {CAUSES,TESTS,RISKY,REMEDIES,SCENARIOS,TYPES,SOOTHES,SOOTHE_EFFECTS,APOLOGIES,APOLOGY_REPLIES,FAREWELL_LINES,REDIAL_OPENINGS,REDIAL_STRESS,COMMAND_DEFS,QUESTION_GROUPS,QUESTIONS,SMALLTALK_EFFECTS,IDENTITY_CALMING_EFFECTS,OFFICE_PALETTE,OFFICE_STATIONS,ARTIFACT_URL,ARTIFACT_QR,LUCK_RATE,GAME_FLAGS,REFUND_POLICY};';
const { CAUSES, TESTS, RISKY, REMEDIES, SCENARIOS, TYPES, SOOTHES, SOOTHE_EFFECTS, APOLOGIES, APOLOGY_REPLIES, FAREWELL_LINES, REDIAL_OPENINGS, REDIAL_STRESS, COMMAND_DEFS, QUESTION_GROUPS, QUESTIONS, SMALLTALK_EFFECTS, IDENTITY_CALMING_EFFECTS, OFFICE_PALETTE, OFFICE_STATIONS, ARTIFACT_URL, ARTIFACT_QR, LUCK_RATE, GAME_FLAGS, REFUND_POLICY } = new Function(dataSource)();

const functionSource = (name) => {
  return extractFunctionSource(game, name);
};

assert.deepEqual(SOURCE_PARTS, ['p1_head.html','p2_data.js','p3_game.js','p4_view.js','p5_events.js'], '編集素材の結合順が変わっている');
assert(!/function render(?:WorldStrip|Shipping)\(/.test(gameLogicSource), 'ゲームロジックに画面描画の責務が残っている');
assert(!/\b(?:document|window)\./.test(gameLogicSource), 'ゲームロジックがブラウザDOMを直接操作している');
assert(!/function (?:doSoothe|doApologize|openRecord)\(/.test(viewSource), '画面描画に会話状態を変更する責務が残っている');
assert(!/function (?:greetCurrentCustomer|chooseRemedy)\(/.test(eventSource), 'イベント配線にゲーム実処理の責務が残っている');

const commands = ['聞く', '調べる', '操作', '伝える', '折り返す', 'ログ'];
assert.deepEqual(COMMAND_DEFS.map(command => command.label), commands, '主コマンド6つの順番・名称が違う');
assert(!COMMAND_DEFS.some(command => ['診断','なだめる','謝る'].includes(command.label)), '診断・なだめる・謝るが最上位に残っている');
assert(COMMAND_DEFS.every(command => !Object.prototype.hasOwnProperty.call(command, 'desc')), '主コマンドに小さい説明書きdescが残っている');
assert(!game.includes('data-tab='), '廃止したタブUIが戻っている');
assert(functionSource('renderCommandHead').includes('data-command="\' + backTarget + \'"'), 'コマンド階層の「戻る」がない');
assert(page.includes('mobile-pane-nav'), 'スマホ用の画面切替がない');
assert(!page.includes('id="kpis"') && !game.includes('renderKpis') && !game.includes('function kpi('), 'プレイ中ヘッダーに無効な進行ステータス行が残っている');

// 公開物へ、実機確認用のローカル接続先やQRを混ぜない。
const publicSource = page + '\n' + game;
const privateUrl = /\bhttps?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})(?::\d+)?(?:[/?#]|$)/i;
assert(!privateUrl.test(publicSource), '公開物にローカルIPのURLが含まれている');
assert(!game.includes('MOBILE_QR') && !publicSource.includes('mobile-qr'), '実機確認用QRが公開物に残っている');
const handoverArtifactUrl = (handover.match(/\*\*成果物の URL：\*\*\s*(https:\/\/\S+)/) || [])[1];
assert(handoverArtifactUrl && ARTIFACT_URL === handoverArtifactUrl, 'QRの平文URLがHANDOVERの公開先と一致しない');
const briefingSource = functionSource('showBriefing');
const qrDrawSource = functionSource('drawArtifactQr');
assert(briefingSource.includes('artifact-qr-url') && briefingSource.includes('esc(ARTIFACT_URL)'), 'ブリーフィングに省略なしの平文Artifact URLがない');
assert(briefingSource.includes('<canvas') && !/<img\b/i.test(briefingSource) && !/data:image/i.test(briefingSource), 'Artifact QRがCanvasだけで描画されていない');
assert(qrDrawSource.includes('const quietZone = ARTIFACT_QR_QUIET_ZONE') && qrDrawSource.includes('size + quietZone * 2'), 'Artifact QRの4モジュール余白が描画寸法に含まれない');
assert(qrDrawSource.includes("ctx.fillStyle = '#fff'") && qrDrawSource.includes("ctx.fillStyle = '#000'"), 'Artifact QRが純白・純黒ではない');
assert(page.includes('.artifact-qr-canvas') && page.includes('image-rendering:pixelated'), 'Artifact QRにpixelated指定がない');
assert(/@media \(max-width:480px\)[\s\S]*?\.artifact-qr-card\{ display:none; \}/.test(page), 'スマホ幅でArtifact QRが隠れない');

// 通話フロー v2: IVRなし、名乗り必須、本人特定まで社内照会不可。
const actionsSource = functionSource('renderActions');
const greetGate = actionsSource.indexOf('if (!t.greeted) return');
assert(actionsSource.includes('data-greet="1"'), '名乗りボタン data-greet がない');
assert(greetGate >= 0, '名乗る前の専用描画がない');
assert(greetGate < actionsSource.indexOf("const tab = state.ui.tab || 'command'"), '名乗る前に他のコマンドが描画される');
assert(!functionSource('showBriefing').includes("t.transcript.push({ who:'cust', text:t.s.opening })"), '着信時点で第一声を会話ログへ積んでいる');

// §13: 通話の入り口、第一声、本人確認の鎮静効果。
const speaksBeforeGreetingSource = functionSource('customerSpeaksBeforeGreeting');
const customerSpeaksBeforeGreeting = new Function(speaksBeforeGreetingSource + '\nreturn customerSpeaksBeforeGreeting;')();
assert(Object.keys(TYPES).filter(type => type !== 'hurried').every(type => !customerSpeaksBeforeGreeting({s:{type}})), 'hurried以外の顧客が名乗る前に話し始める');
assert(customerSpeaksBeforeGreeting({s:{type:'hurried'}}), 'hurriedが名乗る前に話し始めない');
const pickupSource = functionSource('pickup');
const greetCustomerSource = functionSource('greetCurrentCustomer');
const openingDeliverySource = functionSource('deliverCustomerOpening');
assert(pickupSource.includes('deliverCustomerOpening(t, true)') && greetCustomerSource.includes('deliverCustomerOpening(t, false)'), '通話開始と名乗り後の第一声が共通処理を使わない');
assert(openingDeliverySource.includes('customerSpeaksBeforeGreeting(t)'), '第一声の共通処理が顧客タイプ判定を使わない');
const openingLines = [];
const deliverCustomerOpening = new Function('customerSpeaksBeforeGreeting','pushCustomerLine','DESTINATION_IN_OPENING', openingDeliverySource + '\nreturn deliverCustomerOpening;')(
  ticket => ticket.s.type === 'hurried',
  (ticket, line, options) => openingLines.push({line,plain:Boolean(options && options.plain)}),
  new Set(['S9','S11'])
);
const normalOpening = {s:{id:'S1',type:'anxious',opening:'通常第一声',rushedReply:'急ぎ返答'},destinationKnown:false,redialOpening:null,redialSpoken:false};
deliverCustomerOpening(normalOpening, true);
assert.deepEqual(openingLines, [], '通常顧客が名乗る前に第一声を話す');
deliverCustomerOpening(normalOpening, false);
assert.deepEqual(openingLines, [{line:'通常第一声',plain:false}], '通常顧客が名乗った後に第一声を話さない');
openingLines.length = 0;
const hurriedRedial = {s:{id:'S9',type:'hurried',opening:'急ぎ第一声',rushedReply:'急ぎ返答'},destinationKnown:false,redialOpening:'再入電第一声',redialSpoken:false};
deliverCustomerOpening(hurriedRedial, true);
deliverCustomerOpening(hurriedRedial, false);
assert.deepEqual(openingLines, [{line:'再入電第一声',plain:true}], '急いでいる顧客の再入電第一声が重複する');
assert(!hurriedRedial.redialOpening && !hurriedRedial.redialSpoken, '再入電第一声の状態が消費後に残る');

const openingDestinationIds = ['S9','S11'];
assert(game.includes("const DESTINATION_IN_OPENING = new Set(['S9','S11'])"), '第一声で地名を話す案件がS9とS11の2件ではない');
assert.deepEqual(SCENARIOS.filter(scenario => openingDestinationIds.includes(scenario.id) && scenario.opening.includes(scenario.city)).map(scenario => scenario.id), openingDestinationIds, '地名を許した2案件の第一声に渡航先がない');
const forbiddenOpeningContext = /バンコク|ロンドン|ホノルル|上海|ニューヨーク|バルセロナ|ドバイ|パリ|新婚旅行|夫|妻|娘|家族旅行|ツアー|出張|会議|同僚|お仕事/;
assert(SCENARIOS.filter(scenario => !openingDestinationIds.includes(scenario.id)).every(scenario => !forbiddenOpeningContext.test(scenario.opening)), '第一声に渡航先・旅行目的・同行者の情報が残っている');

const reachableIdentityQuestions = new Set(['q_name','q_destination','q_contract']);
const section13QuestionIds = new Set(QUESTIONS.map(question => question.id));
const revealIsReachable = (scenario, reveal) => reveal === 'opening'
  ? openingDestinationIds.includes(scenario.id)
  : section13QuestionIds.has(reveal) && (reachableIdentityQuestions.has(reveal) || Boolean((scenario.replies || {})[reveal]));
assert(SCENARIOS.every(scenario => Array.isArray(scenario.smalltalk) && scenario.smalltalk.every(topic => revealIsReachable(scenario, topic.reveal))), '雑談話題のrevealが実際に到達できる質問へ接続されていない');

assert.deepEqual(IDENTITY_CALMING_EFFECTS, {anxious:-10,novice:-8,hurried:-4,expert:0}, '高ストレス本人確認のタイプ別効果が確定値と違う');
const identityStressSource = functionSource('identityQuestionStress');
const section13DoAskSource = functionSource('doAsk');
assert.equal((section13DoAskSource.match(/identityQuestionStress\(t, qid,/g) || []).length, 2, 'q_nameとq_contractだけが本人確認専用のストレス経路を通っていない');
const runIdentityStress = (luck, type, stress, qid, normalBase) => {
  const calls = [];
  let rolls = 0;
  const fn = new Function('IDENTITY_CALMING_EFFECTS','rollLuck','addStress','changeStress', identityStressSource + '\nreturn identityQuestionStress;')(
    IDENTITY_CALMING_EFFECTS,
    () => { rolls++; return luck; },
    (ticket, delta, miss, expectedOutcome) => { calls.push({path:'normal',delta,miss,expectedOutcome}); return true; },
    (ticket, delta, expectedOutcome) => { calls.push({path:'calming',delta,expectedOutcome}); return true; }
  );
  fn({stress,s:{type}}, qid, normalBase);
  return {calls,rolls};
};
for (const qid of ['q_name','q_contract']){
  const high = Object.keys(IDENTITY_CALMING_EFFECTS).map(type => runIdentityStress(true,type,50,qid,9));
  assert.deepEqual(high.map(result => result.calls[0].delta), [-10,-8,-4,0], qid + 'が苛立ち50以上でタイプ別の鎮静値にならない');
  assert(high.every(result => result.calls[0].path === 'calming'), qid + 'が高ストレス時に鎮静経路を通らない');
}
const lowIdentity = runIdentityStress(true,'anxious',49,'q_name',7);
assert.deepEqual(lowIdentity.calls, [{path:'normal',delta:7,miss:undefined,expectedOutcome:undefined}], '苛立ち50未満の本人確認が通常質問と同じ扱いではない');
const adverseIdentity = runIdentityStress(false,'anxious',80,'q_contract',9);
assert.deepEqual(adverseIdentity.calls, [{path:'normal',delta:9,miss:false,expectedOutcome:true}], '本人確認の鎮静が裏目でも通常の質問ストレスへ戻らない');
assert.equal(adverseIdentity.rolls, 1, '高ストレス本人確認が運の抽選を1回通らない');
assert.deepEqual(runIdentityStress(false,'expert',80,'q_name',7).calls, [{path:'calming',delta:0,expectedOutcome:true}], 'expertの高ストレス本人確認で苛立ちが上下する');

const identificationReady = new Function(functionSource('identificationReady') + '\nreturn identificationReady;')();
assert(!identificationReady({identified:false,nameKnown:true,destinationKnown:false}), '渡航先を聞かずに氏名だけで本人特定へ到達する');
assert(identificationReady({identified:false,nameKnown:true,destinationKnown:true}), '氏名と渡航先が揃っても本人特定へ到達しない');

const menuSource = functionSource('renderCommandMenu');
assert(menuSource.includes('lookup:{') && menuSource.includes('disabled:!t.identified'), '本人特定前に「調べる」が無効化されていない');
assert(menuSource.includes('COMMAND_DEFS.map'), '主コマンドが調整コンソールと同じ定義を使っていない');
assert(!menuSource.includes('c.desc') && !menuSource.includes('<small>'), '主コマンドに小さい説明書きが描画される');
assert(!/未確認|質問計|繰り返し可|通話を終える|残り \+|時間消費なし|1〜2分/.test(menuSource), '主コマンドに残数や補助説明のmetaが残っている');

const lookupSource = functionSource('renderLookupOptions');
assert(lookupSource.includes('if (!t.identified) return'), '照会画面内側の本人特定ガードがない');

const changeStressSource = functionSource('changeStress');
assert(/closeTicket\(t, \{ kind:'supervisor', reason:'stress', csat:1\.5, label:'上長が引き取り' \}\)/.test(changeStressSource), 'ストレス100でCSAT 1.5の上長引き取りにならない');
assert(changeStressSource.includes("toast('引き取り'"), 'ストレス100の上長引き取りトーストがない');
const debriefSource = functionSource('renderDebrief');
assert(debriefSource.includes("r.reason === 'stress'"), '振り返りがストレス由来の上長引き取りを区別していない');
assert(debriefSource.includes("'お客様の苛立ちが限界に達し、上長が引き取りました。'"), 'ストレス由来の振り返り文が完全一致しない');
assert(functionSource('doClose').includes("reason:'misdiagnosis'"), '誤診由来の上長引き取りに理由がない');
assert(debriefSource.includes("r.reason === 'misdiagnosis'"), '振り返りが誤診由来の上長引き取りを区別していない');

// ストレス前置きは顧客発話を積む1経路だけで適用し、sys/noteや除外台詞には重ねない。
const customerLineSource = functionSource('pushCustomerLine');
assert(customerLineSource.includes("who:'cust'"), 'ストレス前置きの顧客発話経路がない');
assert(!customerLineSource.includes("who:'sys'") && !customerLineSource.includes("who:'note'"), 'sys/note にストレス前置きを付けている');
assert.equal((game.match(/stressLeadIn\(/g) || []).length, 2, 'ストレス前置きが顧客発話以外にも適用されている');
assert(openingDeliverySource.includes("pushCustomerLine(t, t.s.rushedReply, { plain:true })"), 'rushedReply にストレス前置きが付く');
const closeCustomerReplySource = functionSource('doClose');
assert(closeCustomerReplySource.includes('closingLine(s, grade, toneOk)') && closeCustomerReplySource.includes('pushCustomerLine(t, resolutionReply, { plain:true })'), 'closingLine にストレス前置きが付く');

assert.equal(functionSource('queueCard'), '', '廃止した着信一覧の queueCard が残っている');
['office-incoming', 'office-queue', 'office-callbacks', 'office-next', 'data-office-phone'].forEach(removed => {
  assert(!publicSource.includes(removed), '廃止した着信一覧要素 ' + removed + ' が残っている');
});
const officeActionButtons = page.match(/class="office-call-action"/g) || [];
assert.equal(officeActionButtons.length, 2, 'オフィスの電話操作が2ボタンではない');
assert(page.includes('data-office-answer="1"') && page.includes('>電話を取る<'), '「電話を取る」ボタンがない');
assert(page.includes('data-office-callback="1"') && page.includes('>電話をかける<'), '「電話をかける」ボタンがない');

const directNameToasts = game.split('\n').filter(line => line.includes("toast('") && line.includes('t.s.name'));
assert.equal(directNameToasts.length, 0, '本人特定前のトーストへ氏名を直接渡している');
const customerLabel = new Function(functionSource('customerLabel') + '\nreturn customerLabel;')();
const unknownCustomer = { nameKnown:false, s:{ id:'S5', name:'小林 亜衣' } };
const knownCustomer = { nameKnown:true, s:{ id:'S5', name:'小林 亜衣' } };
assert.equal(customerLabel(unknownCustomer), 'お客様', '未特定の表示名が「お客様」ではない');
assert.equal(customerLabel(unknownCustomer, true), 'お客様（S5）', '未特定の折り返し表示名にチケットIDがない');
assert.equal(customerLabel(knownCustomer), '小林 亜衣', '本人特定後も氏名が表示されない');
const officeSource = functionSource('renderOffice');
assert(officeSource.includes("sort((a,b) => a.arrivedTurn - b.arrivedTurn)"), '着信を到着順に並べていない');
assert(officeSource.includes("sort((a,b) => a.callbackDue - b.callbackDue)"), '折り返しを約束時刻順に並べていない');
assert(officeSource.includes("$('office-answer-status').textContent = '待ち ' + waiting.length + '件'"), '電話を取るボタンに待ち件数を表示していない');
assert(officeSource.includes("'折り返し ' + callbacks.length + '件 ／ 最短 ' + fmtClock(callbacks[0].callbackDue)"), '電話をかけるボタンに折り返し件数と最短時刻を表示していない');
const officeActionSource = functionSource('handleOfficeAction');
const firstTicketSource = functionSource('firstTicketIn');
assert(firstTicketSource.includes('.sort((a, b) => a[orderKey] - b[orderKey])'), '待機案件を指定された時刻順に選べない');
assert(officeActionSource.includes("firstTicketIn('waiting', 'arrivedTurn')"), '「電話を取る」が最古の着信を選んでいない');
assert(!officeActionSource.includes('patience'), '「電話を取る」が見えない機嫌で選んでいる');
assert(officeActionSource.includes("firstTicketIn('callback', 'callbackDue')"), '「電話をかける」が最短の約束から選んでいない');
const routeSource = functionSource('routeAction');
['handleDisplayAction','handleOfficeAction','handleCallNavigation','handleConversationAction','handleResolutionAction'].forEach(handler => {
  assert(routeSource.includes(handler), 'イベントルーターから ' + handler + ' が外れている');
});
const advanceSource = functionSource('advance');
const arrivalSource = functionSource('activateDueInbound');
assert(arrivalSource.includes("toast('着信', '新しい着信です', '')"), '着信トーストが全件通常色ではない');
assert(!/toast\('着信'[\s\S]*?abandonAfter/.test(arrivalSource), '着信トーストの色が放棄までの時間に依存している');

const sootheSource = functionSource('doSoothe');
assert(sootheSource.includes('pushCustomerLine(t, result.reply)'), 'なだめた直後に顧客が反応しない');
assert(sootheSource.indexOf('pushCustomerLine(t, result.reply)') < sootheSource.indexOf('spendOnCall(t, 1, 0)'), '顧客の反応より先に時間を進めている');
assert(sootheSource.includes('state.ui = defaultUi(); render();'), 'なだめたあとコマンドメニューへ戻らない');

const askOptionsSource = functionSource('renderAskOptions');
const askGroupsSource = functionSource('renderAskGroups');
assert(askGroupsSource.includes('QUESTION_GROUPS.map'), '「聞く」が4区分を表示しない');
assert(askGroupsSource.includes('data-ask-group=') && askGroupsSource.includes('group.questionIds.every'), '質問区分の選択または完了時disabledがない');
assert(!/残り|questionIds\.length/.test(askGroupsSource), '質問区分に件数を表示している');
assert(askOptionsSource.includes('group.questionIds.map') && !askOptionsSource.includes('QUESTIONS.map'), '「聞く」で区分を挟まず15問を直接表示する');
assert(!askOptionsSource.includes("t.asked.has(q.id) ? 'disabled'"), '確認済みの質問が再質問できない');
assert(askOptionsSource.includes('t.askCounts.get(q.id)'), '質問の実施回数を表示していない');
const askSource = functionSource('doAsk');
assert(askSource.includes('previous > 0') && askSource.includes('repeatedQuestionReply(t)'), '同じ質問への時間・ストレス処理がない');
const testSource = functionSource('doTest');
assert(testSource.includes('t.testCounts.set(tid, attempt)'), '操作の繰り返し回数を記録していない');
assert(testSource.includes('testDef.sequence'), '複数回で結果が変わる操作を扱えない');
assert(!functionSource('renderTestOptions').includes("t.tested.has(test.id) ? 'disabled'"), '実施済み操作が再実行できない');

assert.deepEqual(APOLOGIES.map(apology => [apology.id, apology.minutes]), [['a_brief',1],['a_deep',2]], '2段階謝罪の時間が違う');
const apologySource = functionSource('doApologize');
assert(apologySource.includes("apology.kind === 'brief'") && apologySource.includes('delta = -6'), '簡単なお詫びの安全な効果がない');
assert(apologySource.includes('t.stress >= 40') && apologySource.includes('delta = -20'), '高ストレス時の深いお詫びが効かない');
assert(apologySource.includes('delta = 12'), '不要な深いお詫びが逆効果にならない');
assert(page.includes('id="btn-balance"') && functionSource('showBalanceConsole').includes('scenarioRoute(s)'), 'ゲーム調整コンソールがない');
const balanceWarningSource = functionSource('showBalanceWarning');
assert(balanceWarningSource.includes('<strong>11件の真因と正解対処がすべて表示されます。</strong>'), '調整コンソールを開く前のネタバレ警告が完全一致しない');
assert(balanceWarningSource.includes("$('btn-confirm-balance').onclick") && balanceWarningSource.includes('showBalanceConsole()'), '確認しなくても調整コンソールが開く');
assert(game.includes("$('btn-balance').onclick = showBalanceWarning;") && !game.includes("$('btn-balance').onclick = showBalanceConsole;"), '調ボタンが確認画面を通らない');

const callSource = functionSource('renderCall');
assert(callSource.includes('renderStressPanel(t)'), '苛立ちメーターが通話画面に常時描画されない');
assert(callSource.indexOf('renderStressPanel(t)') < callSource.indexOf('renderActions(t)'), '苛立ちメーターが記録画面で消える位置にある');
assert(callSource.includes('renderTranscript(t, false)'), '通話画面の既定表示が直近履歴ではない');
assert(!functionSource('renderCallHeader').includes('stress-panel'), '苛立ちメーターがヘッダの隅に戻っている');
const recentSource = functionSource('recentTranscriptLines');
assert(recentSource.includes('pendingTypedLine(t)'), '直近表示から文字送り対象が外れる');
const recentTranscriptLines = new Function('pendingTypedLine', recentSource + '\nreturn recentTranscriptLines;')(() => null);
const recentFixture = { transcript:[
  {who:'cust', text:'古い客'}, {who:'note', text:'内部メモ'}, {who:'me', text:'直前の自分'},
  {who:'sys', text:'社内照会'}, {who:'cust', text:'最新の客'}, {who:'note', text:'最新メモ'},
] };
assert.deepEqual(recentTranscriptLines(recentFixture).map(line => line.text), ['直前の自分','最新の客'], '直近表示が「最新の顧客発話＋直前の自分」の最大2行ではない');
assert(recentTranscriptLines(recentFixture).length <= 2, '直近表示が3行以上ある');
assert(recentTranscriptLines(recentFixture).every(line => line.who !== 'note'), '直近表示にメモが混ざる');
const headerSource = functionSource('renderCallHeader');
['t.s.name','t.s.city','localClock','t.s.device','t.s.plan','TYPES','call-guide','hold-state'].forEach(leak => {
  assert(!headerSource.includes(leak), '通話ヘッダにログへ移す情報が残っている: ' + leak);
});
assert(headerSource.includes('t.s.id') && headerSource.includes('t.callMinutes') && headerSource.includes('callCost(t)'), '通話ヘッダがチケットID・通話時間・費用だけを表示していない');
const stressPanelSource = functionSource('renderStressPanel');
assert(stressPanelSource.includes('if (!customerHasSpoken(t))'), '顧客が話す前にも苛立ちの数値が見える');
assert(stressPanelSource.includes('<b>—</b>') && stressPanelSource.includes('<strong>まだ不明</strong>'), '発話前の苛立ち表示が不明値と完全一致しない');
assert(stressPanelSource.includes("t.stress > 80 ? ' alert' : ''"), 'ストレス80超でメーターが点滅しない');
const stageSource = functionSource('stressDisplayStage').replace(/\s+/g, ' ');
assert(/value <= 50.*?平静.*?value <= 70.*?苛立ち.*?value <= 90.*?怒り.*?限界/.test(stageSource), '苛立ちメーターの境界・ラベルが仕様と違う');
assert(page.includes('.stress-panel.alert') && page.includes('@keyframes stress-alert'), '苛立ちメーターの点滅CSSがない');
assert(/\.stress-panel\{[^}]*position:sticky/.test(page), '苛立ちメーターがsticky固定されていない');
const recordSource = functionSource('renderRecord');
const logHeadings = [...recordSource.matchAll(/<h3>([^<]+)<\/h3>/g)].map(match => match[1]);
assert.deepEqual(logHeadings, ['お客様','ここまでの状況','次にできること','会話の全履歴'], 'ログの4見出しが完全一致しない');
assert(recordSource.includes('renderTranscript(t, true)'), 'ログで全履歴を表示しない');
assert(recordSource.includes('remainingCauseCandidates(t)') && recordSource.includes('nextActionGuide(t)'), 'ログに残る候補または次の一手がない');
['trueCause','REMEDIES','scenarioRoute','bestRemedy','correctRemedy'].forEach(secret => assert(!recordSource.includes(secret), 'ログが真因または正解対処を参照している: ' + secret));
const openRecordSource = functionSource('openRecord');
assert(openRecordSource.includes('addStress(t, 4)'), 'ログを読んでもストレス+4×係数にならない');
assert(openRecordSource.includes('spendOnCall(t, 1, 0)'), 'ログを読んでも通話1分を消費しない');
assert(functionSource('handleCallNavigation').includes("d.command === 'record') openRecord()"), 'ログを開く入口が有料処理を通らない');
assert(askGroupsSource.includes('command-choice ask-group-choice'), '質問区分が主コマンドと同じボタン表示ではない');
const askGroupCssBlocks = [...page.matchAll(/\.opts\.ask-groups\{([^}]*)\}/g)].map(match => match[1]);
assert.equal(askGroupCssBlocks.length, 2, '質問区分CSSが通常・スマホ用の2ブロックではない');
assert(askGroupCssBlocks.every(block => /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/.test(block)), '質問区分CSSの全ブロックが2列グリッドではない');

const worldSource = functionSource('renderWorldStrip');
assert(worldSource.includes('state.tickets.filter(t => t.destinationKnown)'), '渡航先未判明の待ちチケットが世界地図に現れる');
assert(page.includes('.stress-panel'), '大きな苛立ちメーターCSSがない');

const tellSource = functionSource('renderTellOptions');
['data-tell="close"','data-tell="soothe"','data-tell="apologize"'].forEach(marker => assert(tellSource.includes(marker), '「伝える」の3項目から ' + marker + ' が欠けている'));
assert(tellSource.includes('data-refund="refund"'), '「伝える」にrefund項目がない');
const renderTellOptions = new Function('REFUND_POLICY', tellSource + '\nreturn renderTellOptions;')(REFUND_POLICY);
const tellHtml = renderTellOptions();
assert(!/hardware|provision|logistics|carrier|coverage|fup|devices|heavy|device_side|device_net|power|location|geo_block|sim|会社側|顧客側|中立/.test(tellHtml), '返金の責任所在一覧が画面・ログ・ラベルに漏れる');
const tellEntries = [...tellHtml.matchAll(/data-(tell|refund)="([^"]+)"[\s\S]*?<span class="opt-label">([^<]+)(?:<span class="opt-sub">([^<]+)<\/span>)?/g)]
  .map(match => ({ id:match[2], label:match[3], note:match[4] || '' }));
assert.deepEqual(tellEntries, [
  { id:'close', label:'対処を伝える', note:'原因を見立てて、対処をご案内します。' },
  { id:'refund', label:'返金をご案内する', note:'' },
  { id:'soothe', label:'気持ちを落ち着ける', note:'' },
  { id:'apologize', label:'お詫びする', note:'' },
  { id:'smalltalk', label:'一言かける', note:'' },
], '「伝える」のID・項目名・注意書きが完全一致しない');
assert(!/終わります|締めます/.test(tellHtml + functionSource('commandPrompt') + functionSource('renderCloseFlow')), '「伝える」の項目に終話・締めを示す文言が残っている');
const actionsAskBranch = actionsSource.slice(actionsSource.indexOf("if (tab === 'ask')"), actionsSource.indexOf("if (tab === 'tell')"));
assert(actionsAskBranch.includes('renderAskGroups(t)') && actionsAskBranch.includes('renderAskOptions(t, group)'), '「聞く」の区分選択と質問一覧が2段階で接続されていない');

// §8 雑談（空気を読む）
const requiredTopicFields = ['id','reveal','askLabel','tellLabel','goodReply','badReply'];
assert(SCENARIOS.length === 11 && SCENARIOS.every(s => Array.isArray(s.smalltalk) && s.smalltalk.length >= 1 && s.smalltalk.every(topic => requiredTopicFields.every(field => typeof topic[field] === 'string' && topic[field].length > 0))), '全11シナリオの雑談話題6項目が揃っていない');
const questionIds = new Set(QUESTIONS.map(question => question.id));
assert(SCENARIOS.every(s => s.smalltalk.every(topic => topic.reveal === 'opening' || questionIds.has(topic.reveal))), '雑談話題の解禁条件が第一声または実在質問ではない');
assert.deepEqual(SMALLTALK_EFFECTS, { anxious:-10, novice:-12, hurried:14, expert:6 }, 'タイプ別の雑談効果が完全一致しない');
assert(SMALLTALK_EFFECTS.hurried > 0 && SMALLTALK_EFFECTS.expert > 0, '急ぎ・手慣れタイプの雑談が逆効果ではない');

const topicAvailableSource = functionSource('topicAvailable');
const topicAvailable = new Function('customerHasSpoken', topicAvailableSource + '\nreturn topicAvailable;')(t => t.spoken);
const availableSmalltalkSource = functionSource('availableSmalltalkTopics');
const availableSmalltalkTopics = new Function('topicAvailable', availableSmalltalkSource + '\nreturn availableSmalltalkTopics;')(topicAvailable);
const availabilityFixture = { spoken:true, asked:new Set(), s:{ smalltalk:[{id:'open',reveal:'opening'},{id:'later',reveal:'q_when'}] } };
assert.deepEqual(availableSmalltalkTopics(availabilityFixture).map(topic => topic.id), ['open'], '会話に出ていない雑談話題が描画候補へ入る');
availabilityFixture.spoken = false;
assert.deepEqual(availableSmalltalkTopics(availabilityFixture), [], '第一声の前から雑談話題が描画候補へ入る');
availabilityFixture.spoken = true; availabilityFixture.asked.add('q_when');
assert.deepEqual(availableSmalltalkTopics(availabilityFixture).map(topic => topic.id), ['open','later'], '質問後に判明した雑談話題が解禁されない');

const flipReactionSource = functionSource('flipReaction');
const expectedFlipReaction = new Function('rollLuck', flipReactionSource + '\nreturn flipReaction;')(() => true);
const smalltalkResultSource = functionSource('smalltalkResult');
const smalltalkResult = new Function('SMALLTALK_EFFECTS', 'flipReaction', smalltalkResultSource + '\nreturn smalltalkResult;')(SMALLTALK_EFFECTS, expectedFlipReaction);
const topicFixture = { goodReply:'和らいだ返事', badReply:'用件へ戻す返事' };
const lowResults = Object.keys(SMALLTALK_EFFECTS).map(type => smalltalkResult({stress:20,s:{type}}, topicFixture, 'tell', 0));
assert.deepEqual(lowResults.map(result => result.delta), [-10,-12,14,6], '平静時の雑談がタイプ別基準値を使わない');
assert.deepEqual(Object.keys(SMALLTALK_EFFECTS).map(type => smalltalkResult({stress:40,s:{type}}, topicFixture, 'tell', 0).delta), [8,8,8,8], 'ストレス40以上で全タイプが一律+8の逆効果にならない');
assert(Object.keys(SMALLTALK_EFFECTS).every(type => smalltalkResult({stress:40,s:{type}}, topicFixture, 'tell', 0).scaled), 'ストレス40以上の雑談がaddStress経路を選ばない');
assert.equal(smalltalkResult({stress:20,s:{type:'anxious'}}, topicFixture, 'tell', 1).delta, -10 / 2 + 5, '同じ雑談話題の2回目が delta/2+5 ではない');
assert.equal(smalltalkResult({stress:20,s:{type:'novice'}}, topicFixture, 'ask', 0).delta, -12 * 1.5, '「話を向ける」が成功値を1.5倍しない');
assert.equal(smalltalkResult({stress:40,s:{type:'novice'}}, topicFixture, 'ask', 0).delta, 8 * 1.5, '「話を向ける」が失敗値を1.5倍しない');
const doSmalltalkSource = functionSource('doSmalltalk');
assert.equal((doSmalltalkSource.match(/spendOnCall\(t, 1, 0\)/g) || []).length, 1, '雑談の両入口が共通の1分消費を通らない');
assert(doSmalltalkSource.includes("mode === 'ask' ? topic.askLabel : topic.tellLabel"), '雑談の2入口が別の発言ラベルを使わない');
assert(functionSource('handleConversationAction').includes('doSmalltalk(d.smalltalk, d.smalltalkMode)'), '雑談のクリックが実行処理へ接続されていない');
assert(game.includes('[data-smalltalk]'), '雑談ボタンがクリック監視セレクタに含まれない');
const allTopicLabels = SCENARIOS.flatMap(s => s.smalltalk.flatMap(topic => [topic.askLabel, topic.tellLabel]));
const smalltalkDisclosurePattern = /効く|逆効果|おすすめ|推奨|ストレス|苛立ち/;
assert(allTopicLabels.every(label => !smalltalkDisclosurePattern.test(label)), '雑談データのラベルが効果の答えを漏らしている');
const smalltalkChoicesSource = functionSource('renderSmalltalkChoices');
assert(!smalltalkDisclosurePattern.test(smalltalkChoicesSource), '雑談の描画処理が効果の答えを注記している');
assert(!smalltalkChoicesSource.includes('disabled') && !smalltalkChoicesSource.includes('smalltalkCounts'), '使用済み雑談話題が無効化または表示で識別される');
assert(smalltalkChoicesSource.includes("data-smalltalk-mode=\"' + mode + '\""), '雑談のask/tell入口がdata属性で区別されない');
assert(!askGroupsSource.includes('group.no') && !askGroupsSource.includes('command-no'), '「聞く」の区分ボタンに番号が残っている');

// §9: 90/10の運、反応と対処だけの揺れ、登場順シャッフル、旧挙動への復帰。
assert.equal(LUCK_RATE, 0.9, '運の本来どおり率が0.9ではない');
assert.deepEqual(GAME_FLAGS, { luckRate:0.9, shuffleArrival:true }, '運の初期GAME_FLAGSが確定値と違う');
const rollLuckSource = functionSource('rollLuck');
assert(rollLuckSource.includes('state.random() < GAME_FLAGS.luckRate'), 'rollLuckが注入可能な乱数源とGAME_FLAGSを使わない');
assert.equal((game.match(/Math\.random/g) || []).length, 1, 'Math.randomがstate.random以外でも直接使われている');
assert(game.includes('random: Math.random'), 'stateに注入可能な乱数源がない');
const makeRollLuck = (random, flags = {luckRate:LUCK_RATE}) =>
  new Function('state', 'GAME_FLAGS', rollLuckSource + '\nreturn rollLuck;')({ random }, flags);
assert.equal(makeRollLuck(() => 0.899999)(), true, '固定乱数で本来どおり側を再現できない');
assert.equal(makeRollLuck(() => 0.9)(), false, '固定乱数で裏目側を再現できない');

const treatmentSucceedsSource = functionSource('treatmentSucceeds');
const expectedTreatment = new Function('rollLuck', treatmentSucceedsSource + '\nreturn treatmentSucceeds;')(() => true);
const adverseTreatment = new Function('rollLuck', treatmentSucceedsSource + '\nreturn treatmentSucceeds;')(() => false);
assert.equal(expectedTreatment(true), true, '本来どおり時に正しい対処が解決しない');
assert.equal(expectedTreatment(false), false, '本来どおり時に誤診が失敗しない');
assert.equal(adverseTreatment(true), false, '裏目時に正しい対処が未解決にならない');
assert.equal(adverseTreatment(false), true, '裏目時に誤診が解決しない');

function runCloseContract(causeMatched, expectedOutcome){
  const ticket = {
    s:{ trueCause:'right', best:'r_right', partial:[], type:'hurried' }, state:'open', transcript:[],
    callMinutes:0, holdMinutes:0, stress:10, patience:100, damage:0, wasted:0, misdiagnoses:0,
    callbackCount:0, callbackPenalty:0, shipment:null, pendingResult:null, extraMinutes:0,
  };
  const closeState = { focus:ticket, cost:0, escLeft:3, ui:null };
  const deps = {
    state:closeState,
    REMEDIES:{
      right:[{id:'r_right', label:'正しい対処', cost:100, kind:'guide'}],
      wrong:[{id:'r_wrong', label:'誤った対処', cost:200, kind:'guide'}],
    },
    TYPES:{ hurried:{tone:'brief'} },
    remedyBlockReason:() => '', toneLabel:id => id,
    spendOnCall:(t, minutes) => { t.callMinutes += minutes; return true; },
    treatmentSucceeds:matched => expectedOutcome ? matched : !matched,
    addStress:(t, delta) => { t.stress += delta; return true; },
    render:() => {}, toast:() => {}, advance:minutes => { ticket.extraMinutes += minutes; },
    pushCustomerLine:(t, text) => t.transcript.push({who:'cust', text}),
    closeTicket:(t, result) => { t.result = result; t.state = 'closed'; },
    causeName:id => id, customerLabel:() => 'お客様',
    clamp:(value, min, max) => Math.max(min, Math.min(max, value)),
    patiencePenalty:() => 0, holdPenalty:() => 0, stressPenalty:() => 0,
    gradeLabel:grade => grade === 'best' ? '解決' : grade,
    defaultUi:() => ({}), closingLine:() => '解決しました', farewellLine:() => 'ありがとうございました',
  };
  const run = new Function(...Object.keys(deps), functionSource('doClose') + '\nreturn doClose;')(...Object.values(deps));
  run(causeMatched ? 'right' : 'wrong', causeMatched ? 'r_right' : 'r_wrong', 'brief');
  ticket.totalCost = closeState.cost;
  return ticket;
}
const correctAdverse = runCloseContract(true, false);
assert.equal(correctAdverse.pendingResult, null, '裏目の正しい対処が解決扱いになる');
assert.equal(correctAdverse.misdiagnoses, 0, '裏目の正しい対処でmisdiagnosesが増える');
assert(correctAdverse.transcript.some(line => line.text.includes('まだ繋がらない')), '裏目の正しい対処後に未解決の返答がない');
const wrongAdverse = runCloseContract(false, false);
assert(wrongAdverse.pendingResult && wrongAdverse.pendingResult.causeMatched === false, '裏目の誤診が解決扱いにならない');
assert.equal(wrongAdverse.misdiagnoses, 0, '裏目の誤診でmisdiagnosesが増える');
const wrongExpected = runCloseContract(false, true);
assert.equal(wrongExpected.misdiagnoses, 1, '本来どおりの誤診がmisdiagnosesに数えられない');
const correctExpected = runCloseContract(true, true);
assert.deepEqual(
  [correctExpected.callMinutes + correctExpected.extraMinutes, correctAdverse.callMinutes + correctAdverse.extraMinutes, correctExpected.totalCost, correctAdverse.totalCost],
  [2,2,100,100],
  '正しい対処の時間・費用が抽選結果で揺れる'
);
assert.deepEqual(
  [wrongExpected.callMinutes + wrongExpected.extraMinutes, wrongAdverse.callMinutes + wrongAdverse.extraMinutes, wrongExpected.totalCost, wrongAdverse.totalCost],
  [4,4,200,200],
  '誤診の時間・費用が抽選結果で揺れる'
);

const changeStressContractSource = functionSource('changeStress');
assert(changeStressContractSource.includes('expectedOutcome = rollLuck()'), '苛立ちの共通経路が抽選を通らない');
assert(changeStressContractSource.includes('if (!expectedOutcome) delta = 0'), '裏目の苛立ち増減が0にならない');
assert(functionSource('addStress').includes('changeStress('), 'addStressが抽選付きchangeStressを通らない');
const makeChangeStress = rollLuck => new Function(
  'rollLuck','clamp','pushCustomerLine','closeTicket','toast','customerHonorific','customerLabel',
  changeStressContractSource + '\nreturn changeStress;'
)(rollLuck, (v,min,max) => Math.max(min,Math.min(max,v)), () => {}, () => {}, () => {}, () => '', () => '');
for (const delta of [12, -12]){
  const ticket = { stress:50, state:'open', stressWarned:false };
  makeChangeStress(() => false)(ticket, delta);
  assert.equal(ticket.stress, 50, '裏目で苛立ちの符号が反転または増減する');
}

const adverseFlipReaction = new Function('rollLuck', flipReactionSource + '\nreturn flipReaction;')(() => false);
const adverseSmalltalk = new Function('SMALLTALK_EFFECTS', 'flipReaction', smalltalkResultSource + '\nreturn smalltalkResult;')(SMALLTALK_EFFECTS, adverseFlipReaction);
for (const type of ['hurried','expert']){
  const result = adverseSmalltalk({stress:20,s:{type}}, topicFixture, 'tell', 0);
  assert.equal(result.reply, topicFixture.goodReply, type + 'が裏目でも雑談goodReplyへ到達しない');
  assert(result.delta < 0, type + 'が裏目でも雑談で苛立ちが下がらない');
}
const sootheResultContractSource = functionSource('sootheResult');
const adverseSoothe = new Function('TYPES','SOOTHE_EFFECTS','flipReaction', sootheResultContractSource + '\nreturn sootheResult;')(
  {hurried:{sootheReply:'和らいだ返事',sootheMissReply:'急ぎの外れ返事',sootheRepeatReply:'繰り返し返事'}}, {hurried:{s_wait:-18}}, adverseFlipReaction
);
assert.deepEqual(adverseSoothe({stress:40,s:{type:'hurried'}}, 's_wait', 0), {delta:18,scaled:false,reply:'急ぎの外れ返事'}, 'なだめるが裏目で反対側の結果にならない');
let apologyReaction;
const apologyTicket = { stress:60, s:{type:'anxious'}, apologies:new Map(), transcript:[] };
const apologyState = { focus:apologyTicket, ui:null };
const apologyDeps = {
  state:apologyState, APOLOGIES:[{id:'deep',kind:'deep',label:'深いお詫び',minutes:2}],
  APOLOGY_REPLIES:{anxious:{brief:'短い返事',accepted:'受け止めた返事',repeated:'繰り返し返事',excessive:'怖くなる返事'}},
  flipReaction:adverseFlipReaction,
  pushCustomerLine:(t,text) => t.transcript.push({who:'cust',text}),
  applyReactionStress:(t,result) => { apologyReaction = result; return true; },
  spendOnCall:() => true, defaultUi:() => ({}), render:() => {},
};
new Function(...Object.keys(apologyDeps), functionSource('doApologize') + '\nreturn doApologize;')(...Object.values(apologyDeps))('deep');
assert(apologyReaction && apologyReaction.delta === 20 && apologyReaction.reply.includes('怖く'), '謝るが裏目で反対側の結果にならない');

// §10: 顧客の声を4タイプで明確に書き分け、表現だけを変更する。
const dialogueStages = ['irritated','angry','furious'];
const typeNames = ['anxious','novice','hurried','expert'];
assert(typeNames.every(type => dialogueStages.every(stage =>
  Array.isArray(TYPES[type][stage]) && TYPES[type][stage].length >= 2 && TYPES[type][stage].length <= 3 && TYPES[type][stage].every(Boolean)
)), '顧客タイプ4種の苛立ち段階が2〜3本で揃っていない');
const stagedByType = typeNames.flatMap(type => dialogueStages.flatMap(stage => TYPES[type][stage].map(text => ({type,text}))));
const stagedOwners = new Map();
stagedByType.forEach(({type,text}) => {
  const owners = stagedOwners.get(text) || new Set();
  owners.add(type);
  stagedOwners.set(text, owners);
});
assert([...stagedOwners.values()].every(owners => owners.size === 1), '顧客タイプをまたいで同じ苛立ち文言が使い回されている');
assert.equal(SCENARIOS.filter(scenario => typeof scenario.opening === 'string' && scenario.opening.length > 0).length, 11, '11シナリオの第一声が揃っていない');
assert.equal(SCENARIOS.flatMap(scenario => scenario.smalltalk || []).length, 12, '雑談12話題が揃っていない');
assert(typeNames.every(type => ['sootheReply','sootheMissReply','sootheRepeatReply'].every(key => TYPES[type][key])), 'なだめる反応が4タイプ分揃っていない');
assert(typeNames.every(type => APOLOGY_REPLIES[type] && ['brief','accepted','repeated','excessive'].every(key => APOLOGY_REPLIES[type][key])), '謝罪の受け止め方が4タイプ分揃っていない');

const customerDialogue = [];
typeNames.forEach(type => {
  dialogueStages.forEach(stage => customerDialogue.push(...TYPES[type][stage]));
  customerDialogue.push(TYPES[type].sootheReply, TYPES[type].sootheMissReply, TYPES[type].sootheRepeatReply);
  customerDialogue.push(...Object.values(APOLOGY_REPLIES[type]));
});
SCENARIOS.forEach(scenario => {
  customerDialogue.push(scenario.opening, scenario.contractId && scenario.contractId.text, scenario.rushedReply);
  Object.values(scenario.replies || {}).forEach(reply => customerDialogue.push(reply.text));
  Object.values(scenario.tests || {}).forEach(test => {
    if (test.text) customerDialogue.push(test.text);
    (test.sequence || []).forEach(step => customerDialogue.push(step.text));
  });
  (scenario.smalltalk || []).forEach(topic => customerDialogue.push(topic.goodReply, topic.badReply));
});
customerDialogue.push(...Object.values(FAREWELL_LINES.best), FAREWELL_LINES.partial, FAREWELL_LINES.poor, ...Object.values(REDIAL_OPENINGS));
const compactDialogue = customerDialogue.filter(text => typeof text === 'string' && text.length > 0);
const forbiddenDialogue = /馬鹿|アホ|無能|役立たず|死ね|消えろ/i;
assert(compactDialogue.every(text => !forbiddenDialogue.test(text)), '顧客向け会話に禁止語が含まれている');
const forbiddenModelCompany = /イモト|imoto|エクスコム|xcom|excomm|exkom/i;
const visiblePublicSource = builtIndexSource(__dirname);
assert(!forbiddenModelCompany.test(visiblePublicSource), '公開画面にモデル企業名が含まれている');
const restoredPublicNames = ['T-Mobile US','Vodafone UK','Orange ES','Orange FR','TIM','AIS','Etisalat','China Unicom','iPhone / MAC末尾 :C4','iPhoneで遊ぶ'];
assert(restoredPublicNames.every(name => visiblePublicSource.includes(name)), '指定された実在キャリア名またはiPhone表記が復元されていない');
const retiredPseudonyms = /T-Mobius|Vodacore|Naranja|\bTIQ\b|\bAIX\b|Emisalat|China Unilink|スマホで遊ぶ|スマートフォン \/ MAC/;
assert(!retiredPseudonyms.test(visiblePublicSource), '旧仮名または置換対象だった端末表記が公開画面に残っている');
const dialogueDuration = text => text.length * 25 + ((text.match(/[、。！？!?]/g) || []).length * 175);
assert(compactDialogue.every(text => dialogueDuration(text) <= 4000), '顧客向け会話がtyping_budgetの4秒上限を超えている');
assert.deepEqual(typeNames.map(type => [type,TYPES[type].stressStart,TYPES[type].stressRate,TYPES[type].missRate]), [
  ['anxious',20,1.2,1.0], ['novice',5,0.9,1.0], ['hurried',15,1.6,1.3], ['expert',5,1.0,2.0],
], '顧客会話改稿で苛立ち数値・運・判定ロジックが変わっている');
assert.equal(LUCK_RATE, 0.9, '顧客会話改稿で苛立ち数値・運・判定ロジックが変わっている');
assert.deepEqual(GAME_FLAGS, {luckRate:0.9,shuffleArrival:true}, '顧客会話改稿で苛立ち数値・運・判定ロジックが変わっている');

// §11: 「伝える」と終話を分離し、責任所在を読んで返金を案内する。
assert.equal(REFUND_POLICY.amount, 2400, '返金額が確定値2,400円ではない');
assert.deepEqual(REFUND_POLICY.company, {causes:['hardware','provision','logistics','carrier','coverage'],delta:-25,csat:0.4}, '会社側の返金分類・効果が確定値と違う');
assert.deepEqual(REFUND_POLICY.customer, {causes:['fup','devices','heavy','device_side','device_net','power'],delta:15,csat:-0.6}, '顧客側の返金分類・効果が確定値と違う');
assert.deepEqual(REFUND_POLICY.neutral, {causes:['location','geo_block','sim'],delta:-5,csat:0}, '中立の返金分類・効果が確定値と違う');
const refundCauseIds = ['company','customer','neutral'].flatMap(group => REFUND_POLICY[group].causes).sort();
assert.deepEqual(refundCauseIds, CAUSES.map(cause => cause.id).sort(), '返金の責任所在で14原因に欠落・重複がある');
const refundEffectSource = functionSource('refundEffect');
const refundEffect = new Function('REFUND_POLICY', refundEffectSource + '\nreturn refundEffect;')(REFUND_POLICY);
const refundResultSource = functionSource('refundResult');
const makeRefundResult = flipReaction => new Function('refundEffect','flipReaction', refundResultSource + '\nreturn refundResult;')(refundEffect, flipReaction);
const expectedRefund = makeRefundResult(expectedFlipReaction);
const adverseRefund = makeRefundResult(adverseFlipReaction);
assert.deepEqual(expectedRefund({s:{trueCause:'hardware'}}, 0), {delta:-25,scaled:false,csat:0.4,reply:'返金していただけるなら助かります。ありがとうございます。'}, '会社側の返金が苛立ち減・CSAT加点にならない');
assert.deepEqual(expectedRefund({s:{trueCause:'fup'}}, 0), {delta:15,scaled:false,csat:-0.6,reply:'いえ、そういうことでは…。返金より、まず使えるようにしていただけますか。'}, '顧客側の返金が苛立ち増・CSAT減点にならない');
assert.deepEqual(expectedRefund({s:{trueCause:'sim'}}, 0), {delta:-5,scaled:false,csat:0,reply:'返金していただけるなら助かります。ありがとうございます。'}, '中立の返金が小さな苛立ち減・CSAT補正0にならない');
assert.deepEqual(adverseRefund({s:{trueCause:'hardware'}}, 0), {delta:25,scaled:false,csat:-0.4,reply:'いえ、そういうことでは…。返金より、まず使えるようにしていただけますか。'}, '会社側の返金が裏目で反対結果にならない');
assert.deepEqual(adverseRefund({s:{trueCause:'fup'}}, 0), {delta:-15,scaled:false,csat:0.6,reply:'返金していただけるなら助かります。ありがとうございます。'}, '顧客側の返金が裏目で反対結果にならない');
assert.equal(expectedRefund({s:{trueCause:'hardware'}}, 1).delta, -25 / 2 + 5, '返金2回目がdelta/2+5にならない');
assert.equal(expectedRefund({s:{trueCause:'hardware'}}, 1).csat, 0, '返金2回目にもCSAT補正が累積する');

const refundTicket = { s:{trueCause:'hardware'}, refunds:0, refundCsat:0, transcript:[] };
const refundState = { focus:refundTicket, cost:0, ui:null };
let refundMinutes = 0;
const refundDeps = {
  state:refundState, REFUND_POLICY,
  refundResult:(t,times) => ({delta:times ? -7.5 : -25,scaled:false,csat:times ? 0 : 0.4,reply:'返金への反応'}),
  pushCustomerLine:(t,text) => t.transcript.push({who:'cust',text}),
  applyReactionStress:() => true, spendOnCall:(t,minutes) => { refundMinutes += minutes; return true; },
  defaultUi:() => ({}), render:() => {},
};
const doRefund = new Function(...Object.keys(refundDeps), functionSource('doRefund') + '\nreturn doRefund;')(...Object.values(refundDeps));
doRefund(); doRefund();
assert.equal(refundState.cost, 4800, '返金費用が実行のたびに必ず加算されない');
assert.equal(refundTicket.refundCsat, 0.4, '返金のCSAT補正が初回だけにならない');
assert.equal(refundMinutes, 2, '返金案内の時間が毎回1分で固定されない');
assert(functionSource('doClose').includes('base += t.refundCsat || 0'), '返金のCSAT補正が解決時の評価へ反映されない');
assert(game.includes('[data-refund]') && functionSource('handleConversationAction').includes('doRefund()'), '返金ボタンが実行処理へ接続されていない');
const responsibilityLeakSource = tellSource + '\n' + functionSource('renderCall') + '\n' + functionSource('renderRecord') + '\n' + functionSource('renderTranscript');
assert(!/REFUND_POLICY\.(?:company|customer|neutral)|company\.causes|customer\.causes|neutral\.causes/.test(responsibilityLeakSource), '返金の責任所在一覧が画面・ログ・ラベルに漏れる');

const shuffleScenariosSource = functionSource('shuffleScenarios');
const shuffleScenarios = new Function(shuffleScenariosSource + '\nreturn shuffleScenarios;')();
const firstOrder = shuffleScenarios(SCENARIOS, () => 0);
const secondOrder = shuffleScenarios(SCENARIOS, () => 0.999999);
assert.notDeepEqual(firstOrder.map(s => s.id), secondOrder.map(s => s.id), '固定乱数を変えても案件の登場順が変わらない');
assert.deepEqual([...new Set(firstOrder.map(s => s.id))].sort(), SCENARIOS.map(s => s.id).sort(), 'シャッフル後に11案件の欠落・重複がある');
assert(firstOrder.every(item => SCENARIOS.includes(item)), 'シャッフルで案件間の参照を失う複製を作っている');
const luckResetSource = functionSource('resetGame');
assert(luckResetSource.includes('GAME_FLAGS.shuffleArrival') && luckResetSource.includes(': SCENARIOS.slice()'), '登場順シャッフルを元へ戻せない');
assert(luckResetSource.includes('{ arrive:arrivalSlots[index] }'), 'シャッフル後の順番へ固定到着枠を振り直していない');
assert.deepEqual(SCENARIOS.map(s => s.arrive).sort((a,b) => a-b), [0,5,11,18,25,31,38,44,50,56,62], '11案件の固定到着枠が変わっている');

const luckDisclosurePattern = /運が悪|裏目|抽選結果/;
const playerFacingLuckSource = [functionSource('renderCall'), functionSource('renderRecord'), functionSource('renderTranscript'), functionSource('pushCustomerLine')].join('\n');
assert(!luckDisclosurePattern.test(playerFacingLuckSource) && !/(pushCustomerLine|transcript\.push|toast)\([^\n]*(運が悪|裏目|抽選結果)/.test(game), '抽選結果が画面・ログ・transcriptに漏れる');
for (const name of ['doAsk','doLookup','doTest']){
  const source = functionSource(name);
  assert(!source.includes('state.random') && !source.includes('rollLuck()'), name + 'が質問回答・事実・診断結果を直接ランダム化する');
}
assert(!/trueCause\s*=/.test(game), 'プレイ中に真因を書き換える経路がある');

const balanceConsoleSource = functionSource('showBalanceConsole');
assert(balanceConsoleSource.includes('id="balance-luck"') && balanceConsoleSource.includes('id="balance-shuffle"'), '調整コンソールに運と登場順の切り替えがない');
assert(balanceConsoleSource.includes('GAME_FLAGS.luckRate = event.target.checked ? LUCK_RATE : 1.0') && balanceConsoleSource.includes('GAME_FLAGS.shuffleArrival = event.target.checked'), '調整コンソールの切り替えがGAME_FLAGSへ反映されない');
const balanceNodes = { sheet:{innerHTML:''}, 'balance-luck':{}, 'balance-shuffle':{}, 'btn-close-balance':{} };
const balanceDeps = {
  state:{phase:'briefing'}, GAME_FLAGS, LUCK_RATE, COMMAND_DEFS, SCENARIOS, TYPES, REMEDIES,
  $:id => balanceNodes[id], esc:value => String(value), causeName:id => id, scenarioRoute:() => [],
  openSheet:() => {}, showBriefing:() => {}, renderDebrief:() => {}, closeSheet:() => {}, render:() => {},
};
new Function(...Object.keys(balanceDeps), balanceConsoleSource + '\nreturn showBalanceConsole;')(...Object.values(balanceDeps))();
assert.equal(typeof balanceNodes['balance-luck'].onchange, 'function', '運の切り替えイベントが接続されない');
assert.equal(typeof balanceNodes['balance-shuffle'].onchange, 'function', '登場順の切り替えイベントが接続されない');
balanceNodes['balance-luck'].onchange({target:{checked:false}});
balanceNodes['balance-shuffle'].onchange({target:{checked:false}});
assert.deepEqual(GAME_FLAGS, {luckRate:1.0,shuffleArrival:false}, '調整コンソールから運なし・定義順へ切り替わらない');
balanceNodes['balance-luck'].onchange({target:{checked:true}});
balanceNodes['balance-shuffle'].onchange({target:{checked:true}});
assert.deepEqual(GAME_FLAGS, {luckRate:0.9,shuffleArrival:true}, '調整コンソールから運あり・シャッフルへ戻せない');
assert(!functionSource('renderCall').includes('GAME_FLAGS'), '運の設定がプレイ画面に表示される');
assert(!/GAME_FLAGS\.luckRate\s*===?\s*1|GAME_FLAGS\.luckRate\s*!==?\s*1/.test(rollLuckSource), '運なし専用の特別経路がrollLuckにある');
const noLuckRoll = makeRollLuck(() => 0.999999999, {luckRate:1.0});
assert.equal(noLuckRoll(), true, 'luckRate 1.0で本来どおりの結果へ自然に戻らない');
const noLuckStress = makeChangeStress(noLuckRoll);
const baselineTicket = { stress:40, state:'open', stressWarned:false };
noLuckStress(baselineTicket, 12); noLuckStress(baselineTicket, -7);
assert.equal(baselineTicket.stress, 45, '運なしの同一操作列で苛立ちが決定論的な旧結果に戻らない');
const noLuckTreatment = new Function('rollLuck', treatmentSucceedsSource + '\nreturn treatmentSucceeds;')(noLuckRoll);
assert.equal(noLuckTreatment(true), true, '運なしで正しい対処の旧成否に戻らない');
assert.equal(noLuckTreatment(false), false, '運なしで誤診の旧成否に戻らない');
assert.deepEqual(SCENARIOS.map(s => s.id), ['S1','S2','S3','S4','S5','S6','S7','S8','S9','S10','S11'], 'シャッフルOFFの定義順が旧登場順と違う');
const baselineClosed = runCloseContract(true, true);
assert.equal(baselineClosed.pendingResult.csat, 5.0, '運なしの同一操作列でCSATが決定論的な旧結果に戻らない');
assert(functionSource('renderDebrief').includes("r.causeMatched === false") && functionSource('renderDebrief').includes('選んだ対応のあと通信は復旧し、一次解決になりました。'), '誤診から復旧した振り返りが原因・対処とも最適と誤表示する');

// 6-C: 解決後の別れの言葉と明示終話、途中切断からの再着信。
assert.deepEqual(FAREWELL_LINES, {
  best:{
    anxious:'本当に戻った…！ 最後までいてくださって、ありがとうございました。',
    novice:'まあ、私にもできました。何度も丁寧に、ありがとうございました。',
    hurried:'直った。間に合う。ありがとう。',
    expert:'復旧を確認しました。切り分けも妥当でした。ありがとうございます。',
  },
  partial:'…分かりました。まだ心配ですが、その方法で様子を見ます。',
  poor:'……承知しました。これ以上は結構です。',
}, '別れの言葉が確定本文と違う');
assert.deepEqual(REDIAL_OPENINGS, {
  calm:'あの…切れましたよね？ 私、置いていかれたのかと思って…。',
  direct:'いま切りましたね。理由を短く説明してください。',
}, '再着信第一声が確定本文と違う');
assert.equal(REDIAL_STRESS, 25, '途中切断の基本ストレスが+25ではない');
const closeSource = functionSource('doClose');
assert(closeSource.includes('pushCustomerLine(t, farewellLine(s, grade), { plain:true })'), '別れの言葉にストレス前置きが混ざる');
assert(closeSource.includes('t.pendingResult = result') && !closeSource.includes('closeTicket(t, result)'), '解決判定と同時に電話が切れてしまう');
const pendingBranch = actionsSource.slice(actionsSource.indexOf('if (t.pendingResult)'), actionsSource.indexOf("if (state.ui.tab === 'hangup_confirm')"));
assert(pendingBranch.includes("renderHangupButton('お客様との会話が終わりました。電話を切って終話してください。')"), '解決後に「電話を切る」だけが残らない');
assert(!/data-command|data-greet|renderCommandMenu|renderCallback/.test(pendingBranch), '解決後も別の操作ができる');
const hangupConfirmSource = functionSource('renderHangupConfirmation');
assert(hangupConfirmSource.includes('<b>まだ対応が終わっていません。このまま切りますか？</b>'), '未解決終話の確認文が完全一致しない');
const routeHangup = functionSource('handleCallNavigation');
const hangupBranch = routeHangup.slice(routeHangup.indexOf('if (d.hangup){'), routeHangup.indexOf('if (d.hangupConfirm)'));
assert(hangupBranch.includes("defaultUi('hangup_confirm')") && !hangupBranch.includes('interruptCall('), '未解決の電話を確認なしで切れる');
const interruptSource = functionSource('interruptCall');
assert(interruptSource.includes('addStress(t, REDIAL_STRESS)'), '途中切断で+25×顧客係数のストレスが加算されない');
assert(interruptSource.includes("t.state = 'waiting'") && interruptSource.includes('t.arrivedTurn = state.turn'), '途中切断した顧客がすぐ再着信しない');
assert(interruptSource.includes('t.greeted = false') && interruptSource.includes('t.redialOpening = redialOpening(t)'), '再着信の名乗りと専用第一声がリセットされない');
assert(!/\.facts\s*=|identified\s*=\s*false|asked\s*=/.test(interruptSource), '途中切断で収集済みの事実・本人特定・質問履歴を消している');
assert.equal((game.match(/farewellLine\(/g) || []).length, 2, '上長引き取りまたは放棄呼にも別れの言葉を追加している');
assert(menuSource.indexOf('renderHangupButton()') > menuSource.indexOf('</div></div>'), '「電話を切る」が8コマンドのグリッド内に入っている');
assert(page.includes('.hangup-button') && page.includes('.hangup-confirm'), '終話操作の見た目がない');

// オフィス画面: 画像を埋め込まず、16色以内のCanvasドット絵で描く。
const officeStart = page.indexOf('<div class="office-floor">');
const officeEnd = page.indexOf('</section>', officeStart);
const officeHtml = officeStart < 0 || officeEnd < 0 ? '' : page.slice(officeStart, officeEnd);
assert(officeHtml.includes('id="office-slogan"'), '壁のスローガン要素がない');
assert(/<canvas\b[^>]*\bid="office-canvas"/.test(officeHtml), 'オフィスのCanvasがない');
assert(!/<img\b/i.test(officeHtml), 'オフィス描画に画像要素を追加している');
assert(!/data:image/i.test(officeHtml), 'オフィス描画にdata:imageを埋め込んでいる');
assert(page.includes('image-rendering:pixelated') || page.includes('image-rendering: pixelated'), 'Canvasへpixelated指定がない');
assert(Object.values(OFFICE_PALETTE).length <= 16, 'ドット絵パレットが16色を超えている');
assert(new Set(Object.values(OFFICE_PALETTE)).size <= 16, 'ドット絵の実色数が16色を超えている');
assert.equal(OFFICE_STATIONS.filter(station => station.active).length, 1, '点灯PCが自席の1台だけではない');
assert(OFFICE_STATIONS.filter(station => !station.active).length >= 4, '周囲の消灯PCが4台未満');
const officeDrawSource = functionSource('drawOfficePixelArt');
['drawCeilingLights', 'drawBackWall', 'drawDeskIslands', 'drawOfficeStation'].forEach(name => {
  assert(officeDrawSource.includes(name), 'ドット絵に ' + name + ' が接続されていない');
});
assert(functionSource('syncOfficeRing').includes('officeRingLit = !officeRingLit'), 'Canvas内の自席電話が点滅しない');
const resetSource = functionSource('resetGame');
assert(resetSource.includes('state.slogan = SLOGANS[Math.floor(state.random() * SLOGANS.length)]'), 'resetGame がシフトごとのスローガンを選んでいない');
assert(functionSource('renderOffice').includes("$('office-slogan').textContent = state.slogan"), 'オフィス画面へスローガンを書き込んでいない');
assert(!/url\(\s*["']?https?:/i.test(page), 'CSSに外部画像URLを追加している');
['.office-wall', '.office-pixel-frame', '.office-pixel-canvas', '.office-status-grid'].forEach(selector => assert(page.includes(selector), selector + ' のCSSがない'));

const simTest = TESTS.find(test => test.id === 't_simout');
assert(simTest, 'SIM清掃が安全操作にない');
assert(!RISKY.some(test => test.id === 't_simout'), 'SIM清掃が危険操作に残っている');
assert(!/電源を切|電源OFF|電源オフ/.test(simTest.label + simTest.wait), 'SIM清掃が電源OFFを前提にしている');

const simScenario = SCENARIOS.find(scenario => scenario.id === 'S8');
assert.equal(simScenario.best, 'r_sim_clean', 'S8の第一選択がSIM清掃ではない');
assert.equal(simScenario.tests.t_simout.sequence.length, 2, 'S8のSIM清掃が2段階ではない');
assert(!simScenario.tests.t_simout.sequence[0].solves && simScenario.tests.t_simout.sequence[1].solves, 'S8が2回目のSIM清掃で復旧しない');
assert.equal(REMEDIES.sim.find(remedy => remedy.id === 'r_sim_clean').needsTest, 't_simout');
assert.equal(REMEDIES.sim.find(remedy => remedy.id === 'r_sim_clean').needsTestCount, 2, 'SIM復旧確認が清掃2回を要求しない');
const hardwareScenario = SCENARIOS.find(scenario => scenario.id === 'S10');
assert(hardwareScenario && hardwareScenario.best === 'r_hardware_swap', '機器故障から代替機配送へ進む案件がない');
assert.equal(REMEDIES.hardware.find(remedy => remedy.id === 'r_hardware_swap').requiresLongStay, 3, '長期滞在の配送条件がない');
const locationScenario = SCENARIOS.find(scenario => scenario.id === 'S11');
const locationPartial = REMEDIES.location.find(remedy => remedy.id === 'r_window_stationary');
assert(locationPartial && locationScenario.partial.includes(locationPartial.id), 'S11に不便が残る次善策がない');

// 連続する未表示行でも、先頭から一行ずつ表示する。後続行を先行行へ流し込まない。
assert(game.includes("return t.transcript.find(x => (x.who === 'cust' || x.who === 'sys') && !x.typed);"), '未表示行を会話順に選んでいない');
assert(game.includes('const pending = pendingTypedLine(t);'), '文字送り対象の行を固定していない');
assert(game.includes('const typing = l === pending;'), '複数の未表示行を同時に typing にしている');
assert(game.includes("if ((l.who === 'cust' || l.who === 'sys') && !l.typed && l !== pending) return '';"), '順番待ちの発話を先読み表示している');

// 同じ配送対処の再選択は、手配と費用を再発生させない。配送画面からも戻れる。
assert(game.includes('if (t.shipment && t.shipment.remedyId === remedyId){'), '同じ配送手配の重複防止がない');
assert(game.includes("renderCommandHead('国際配送の手配', '配送方法を選んでください。')"), '配送画面の戻る導線がない');

// 編集用の3素材と配布用 index.html は、build.js と同じ規則で完全一致する。
const expectedIndex = builtIndexSource(__dirname);
assert.equal(fs.readFileSync(__dirname + '/index.html', 'utf8'), expectedIndex, 'index.html が編集用素材から再生成されていない');

console.log('UI契約・素材同期・SIM清掃仕様: 問題なし');
