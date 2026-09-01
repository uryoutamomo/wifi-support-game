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
  '\nreturn {CAUSES,TESTS,RISKY,REMEDIES,SCENARIOS,TYPES,SOOTHES,SOOTHE_EFFECTS,APOLOGIES,APOLOGY_REPLIES,FAREWELL_LINES,REDIAL_OPENINGS,REDIAL_STRESS,COMMAND_DEFS,QUESTION_GROUPS,QUESTIONS,SMALLTALK_EFFECTS,IDENTITY_CALMING_EFFECTS,OFFICE_PALETTE,OFFICE_STATIONS,ARTIFACT_URL,ARTIFACT_QR,LUCK_RATE,GAME_FLAGS,REFUND_POLICY,ANGRY_DEFAULT_OUTCOMES,ANGRY_END_LINES,COMPLAINT_EMAIL_TEMPLATES};';
const { CAUSES, TESTS, RISKY, REMEDIES, SCENARIOS, TYPES, SOOTHES, SOOTHE_EFFECTS, APOLOGIES, APOLOGY_REPLIES, FAREWELL_LINES, REDIAL_OPENINGS, REDIAL_STRESS, COMMAND_DEFS, QUESTION_GROUPS, QUESTIONS, SMALLTALK_EFFECTS, IDENTITY_CALMING_EFFECTS, OFFICE_PALETTE, OFFICE_STATIONS, ARTIFACT_URL, ARTIFACT_QR, LUCK_RATE, GAME_FLAGS, REFUND_POLICY, ANGRY_DEFAULT_OUTCOMES, ANGRY_END_LINES, COMPLAINT_EMAIL_TEMPLATES } = new Function(dataSource)();

const functionSource = (name) => {
  return extractFunctionSource(game, name);
};

assert.deepEqual(SOURCE_PARTS, ['p1_head.html','p2_data.js','p3_game.js','p4_view.js','p5_events.js'], '編集素材の結合順が変わっている');
assert(!/function render(?:WorldStrip|Shipping)\(/.test(gameLogicSource), 'ゲームロジックに画面描画の責務が残っている');
assert(!/\b(?:document|window)\./.test(gameLogicSource), 'ゲームロジックがブラウザDOMを直接操作している');
assert(!gameLogicSource.includes('mobilePane'), '廃止したペイン切替状態 mobilePane が残っている');
assert(!/function (?:doSoothe|doApologize|openRecord)\(/.test(viewSource), '画面描画に会話状態を変更する責務が残っている');
assert(!/function (?:greetCurrentCustomer|chooseRemedy)\(/.test(eventSource), 'イベント配線にゲーム実処理の責務が残っている');

const commands = ['聞く', '調べる', '操作', '伝える', '折り返す', 'ログ'];
assert.deepEqual(COMMAND_DEFS.map(command => command.label), commands, '主コマンド6つの順番・名称が違う');
assert(!COMMAND_DEFS.some(command => ['診断','なだめる','謝る'].includes(command.label)), '診断・なだめる・謝るが最上位に残っている');
assert(COMMAND_DEFS.every(command => !Object.prototype.hasOwnProperty.call(command, 'desc')), '主コマンドに小さい説明書きdescが残っている');
assert(!game.includes('data-tab='), '廃止したタブUIが戻っている');
assert(functionSource('renderCommandHead').includes('data-command="\' + backTarget + \'"'), 'コマンド階層の「戻る」がない');
const generatedPage = builtIndexSource(__dirname);
assert(!generatedPage.includes('mobile-pane-nav') && !generatedPage.includes('data-mobile-pane'), '上部の通話・待機・診断タブが戻っている');
const paneOrder = [...page.matchAll(/<section class="pane ([^"]+)">/g)].map(match => match[1]);
assert.deepEqual(paneOrder, ['desk','board','call-summary'], '3ペインのDOM順が対応デスク→診断ボード→待機状況ではない');
const stackedPaneCss = (page.match(/\.pane,body\.playing \.pane\{([^}]*)\}/) || [])[1] || '';
assert(/display\s*:\s*flex/.test(stackedPaneCss), '3ペインが同時表示になっていない');
const hidesGamePane = [...page.matchAll(/([^{}]+)\{([^}]*)\}/g)].some(([, selectors, declarations]) =>
  /display\s*:\s*none/.test(declarations) && selectors.split(',').some(selector =>
    /\.pane(?:\.(?:desk|board|call-summary))?$/.test(selector.trim())
  )
);
assert(!hidesGamePane, '3ペインの一部が非表示になっている');
['line-state','fact-count','queue-count'].forEach(id => assert(page.includes('id="' + id + '"'), 'count-chip ' + id + ' がない'));
assert(functionSource('renderCall').includes("$('line-state').textContent"), '通話状態のcount-chipが更新されない');
assert(functionSource('renderBoard').includes("$('fact-count').textContent"), '診断件数のcount-chipが更新されない');
assert(functionSource('renderQueue').includes("$('queue-count').textContent"), '待ち件数のcount-chipが更新されない');
assert(!page.includes('id="kpis"') && !game.includes('renderKpis') && !game.includes('function kpi('), 'プレイ中ヘッダーに無効な進行ステータス行が残っている');

// 公開物へ、実機確認用のローカル接続先やQRを混ぜない。
const publicSource = page + '\n' + game;
const privateUrl = /\bhttps?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})(?::\d+)?(?:[/?#]|$)/i;
assert(!privateUrl.test(publicSource), '公開物にローカルIPのURLが含まれている');
assert(!game.includes('MOBILE_QR') && !publicSource.includes('mobile-qr'), '実機確認用QRが公開物に残っている');
const PUBLISHED_URL = 'https://uryoutamomo.github.io/wifi-support-game/';
const handoverArtifactUrl = (handover.match(/\*\*成果物の URL：\*\*\s*(https:\/\/\S+)/) || [])[1];
assert(ARTIFACT_URL === PUBLISHED_URL, '公開QR URLがGitHub Pagesの正規URLではない');
assert(handoverArtifactUrl && ARTIFACT_URL === handoverArtifactUrl, 'QRの平文URLがHANDOVERの公開先と一致しない');
assert(ARTIFACT_QR.length === 33 && ARTIFACT_QR.every(row => row.length === 33 && /^[01]+$/.test(row)), '公開ページQRが33×33の0/1パターンではない');
const briefingSource = functionSource('showBriefing');
const qrDrawSource = functionSource('drawArtifactQr');
assert(briefingSource.includes('artifact-qr-url') && briefingSource.includes('esc(ARTIFACT_URL)'), 'ブリーフィングに省略なしの平文Artifact URLがない');
assert(briefingSource.includes('<canvas') && !/<img\b/i.test(briefingSource) && !/data:image/i.test(briefingSource), '公開ページQRがCanvasだけで描画されていない');
assert(qrDrawSource.includes('const quietZone = ARTIFACT_QR_QUIET_ZONE') && qrDrawSource.includes('size + quietZone * 2'), '公開ページQRの4モジュール余白が描画寸法に含まれない');
assert(qrDrawSource.includes("ctx.fillStyle = '#fff'") && qrDrawSource.includes("ctx.fillStyle = '#000'"), '公開ページQRが純白・純黒ではない');
assert(page.includes('.artifact-qr-canvas') && page.includes('image-rendering:pixelated'), '公開ページQRにpixelated指定がない');
assert(/@media \(max-width:480px\)[\s\S]*?\.artifact-qr-card\{ display:none; \}/.test(page), 'スマホ幅で公開ページQRが隠れない');

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
assert(SCENARIOS.filter(scenario => !openingDestinationIds.includes(scenario.id)).every(scenario => !scenario.opening.includes(scenario.city)), '通常案件の第一声に自身のcityが残っている');

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
const expertIdentity = runIdentityStress(false,'expert',80,'q_name',7);
assert.deepEqual(expertIdentity.calls, [{path:'calming',delta:0,expectedOutcome:true}], 'expertの高ストレス本人確認で苛立ちが上下する');
assert.equal(expertIdentity.rolls, 0, 'expertの高ストレス本人確認が無駄に運の抽選を消費する');

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
assert(changeStressSource.includes("endAngryCall(t, 'stress')"), 'ストレス100が怒り終話の共通経路を通らない');
const debriefSource = functionSource('renderDebrief');
assert(debriefSource.includes('お客様の苛立ちが限界に達し、強い苦情を述べて終話しました。'), 'ストレス由来のクレーム振り返り文がない');
assert(debriefSource.includes('お客様の苛立ちが限界に達し、一方的に通話を切りました。'), 'ストレス由来の切断振り返り文がない');
assert(functionSource('doClose').includes("endAngryCall(t, 'misdiagnosis')"), '誤診2回目が怒り終話の共通経路を通らない');
assert(debriefSource.includes("r.reason === 'misdiagnosis'"), '振り返りが誤診由来の怒り終話を区別していない');

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
assert(arrivalSource.includes("t.state = 'waiting'"), '到着した着信が待機状態へ移らない');

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
assert.deepEqual(GAME_FLAGS, { luckRate:0.9, shuffleArrival:true, soundEnabled:true, soundVolume:0.55 }, '運・音の初期GAME_FLAGSが確定値と違う');
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
    playClueSound:() => {},
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
  'rollLuck','clamp','endAngryCall','playStressWarning',
  changeStressContractSource + '\nreturn changeStress;'
)(rollLuck, (v,min,max) => Math.max(min,Math.min(max,v)), () => false, () => {});
for (const delta of [12, -12]){
  const ticket = { stress:50, state:'open' };
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
assert.deepEqual(GAME_FLAGS, {luckRate:0.9,shuffleArrival:true,soundEnabled:true,soundVolume:0.55}, '顧客会話改稿で苛立ち数値・運・判定ロジックが変わっている');

// §19: 返金は確認後に2,400円を払い、その場で終わらせる単発の賭け。
assert.equal(REFUND_POLICY.amount, 2400, '返金額が確定値2,400円ではない');
assert.deepEqual(REFUND_POLICY.company, {causes:['hardware','provision','logistics','carrier','coverage'],satisfactionRate:0.5}, '会社側の返金満足率が50%ではない');
assert.deepEqual(REFUND_POLICY.customer, {causes:['fup','devices','heavy','device_side','device_net','power'],satisfactionRate:0.1}, '顧客側の返金満足率が10%ではない');
assert.deepEqual(REFUND_POLICY.neutral, {causes:['location','geo_block','sim'],satisfactionRate:0.25}, '中立の返金満足率が25%ではない');
const refundCauseIds = ['company','customer','neutral'].flatMap(group => REFUND_POLICY[group].causes).sort();
assert.deepEqual(refundCauseIds, CAUSES.map(cause => cause.id).sort(), '返金の責任所在で14原因に欠落・重複がある');
const refundResponsibilitySource = functionSource('refundResponsibility');
const refundResponsibility = new Function('REFUND_POLICY', refundResponsibilitySource + '\nreturn refundResponsibility;')(REFUND_POLICY);
assert.deepEqual(['hardware','sim','fup'].map(refundResponsibility), ['company','neutral','customer'], '返金の責任分類が確定表どおりではない');
const refundSatisfiedSource = functionSource('refundSatisfied');
const makeRefundSatisfied = (luckRate, random) => new Function('REFUND_POLICY','GAME_FLAGS','state','refundResponsibility', refundSatisfiedSource + '\nreturn refundSatisfied;')(REFUND_POLICY,{luckRate},{random},refundResponsibility);
assert.deepEqual([
  makeRefundSatisfied(.9, () => .4999)('hardware'), makeRefundSatisfied(.9, () => .5)('hardware'),
  makeRefundSatisfied(.9, () => .2499)('sim'), makeRefundSatisfied(.9, () => .25)('sim'),
  makeRefundSatisfied(.9, () => .0999)('fup'), makeRefundSatisfied(.9, () => .1)('fup'),
], [true,false,true,false,true,false], '返金の満足確率が会社50%／中立25%／顧客10%ではない');
assert.deepEqual(['hardware','sim','fup'].map(cause => makeRefundSatisfied(1, () => 0)(cause)), [true,false,false], 'luckRate 1.0で会社側だけが返金に満足する決定論へ戻らない');

function runRefund(satisfied){
  const ticket = {s:{trueCause:'hardware',type:'expert'},state:'open',transcript:[]};
  const refundState = {focus:ticket,cost:0,ui:{tab:'refund_confirm'}};
  let closed;
  const deps = {
    state:refundState, REFUND_POLICY, refundSatisfied:() => satisfied,
    pushCustomerLine:(t,text) => t.transcript.push({who:'cust',text}), farewellLine:() => '通常の別れの言葉',
    closeTicket:(t,result) => { t.state='closed'; closed=result; }, render:() => {},
  };
  new Function(...Object.keys(deps), functionSource('doRefund') + '\nreturn doRefund;')(...Object.values(deps))();
  return {ticket,state:refundState,result:closed};
}
const satisfiedRefund = runRefund(true);
const dissatisfiedRefund = runRefund(false);
assert.equal(satisfiedRefund.ticket.state, 'closed', '返金を確認しても案件がclosedにならない');
assert.deepEqual([satisfiedRefund.result.kind,satisfiedRefund.result.satisfied,satisfiedRefund.result.csat], ['refunded',true,3.0], '満足した返金のkind／satisfied／CSATが違う');
assert.deepEqual([dissatisfiedRefund.result.kind,dissatisfiedRefund.result.satisfied,dissatisfiedRefund.result.csat], ['refunded',false,1.0], '不満足な返金のkind／satisfied／CSATが違う');
assert.equal(satisfiedRefund.state.cost, 2400, '満足した返金で2,400円が加算されない');
assert.equal(dissatisfiedRefund.state.cost, 2400, '不満足な返金で2,400円が加算されない');
assert(satisfiedRefund.ticket.transcript.some(line => line.text === '通常の別れの言葉'), '満足した返金に通常の別れの言葉が付かない');
assert(!dissatisfiedRefund.ticket.transcript.some(line => line.text === '通常の別れの言葉'), '不満足な返金に別れの言葉が付く');
assert(satisfiedRefund.result.csat < 4, '返金に満足したCSATが正しく解決した4点台へ届く');
const refundComplaintArrival = new Function('rollLuck', functionSource('complaintEmailArrives') + '\nreturn complaintEmailArrives;')(() => true);
assert.equal(refundComplaintArrival({kind:'refunded',csat:1.0}), true, '不満足な返金が後日の苦情メール対象に入らない');
const refundConfirmSource = functionSource('renderRefundConfirmation');
assert(refundConfirmSource.includes('REFUND_POLICY.amount.toLocaleString') && refundConfirmSource.includes('この電話はこれで終わります') && refundConfirmSource.includes('data-refund-confirm'), '返金確認に金額・終話の明示・確認ボタンが揃っていない');
const refundEventSource = functionSource('handleConversationAction');
assert(refundEventSource.includes("defaultUi('refund_confirm')") && refundEventSource.includes('if (d.refundConfirm){ doRefund()'), '返金が確認を挟まず実行される');
assert(!/\brefunds\b|refundCsat|refundResult|refundEffect/.test(gameLogicSource), '旧返金の回数管理・CSAT逓減がコードに残っている');
assert(functionSource('doRefund').includes("kind:'refunded'") && !functionSource('doRefund').includes("state = 'waiting'") && !functionSource('doRefund').includes('redial'), '返金クローズした案件が再入電する');
const outageRefund = REMEDIES.carrier.find(remedy => remedy.id === 'r_outage_explain');
assert(outageRefund && outageRefund.cost === 2400 && outageRefund.needsOutage === true && outageRefund.kind === 'resolve', '広域障害の正規対処 r_outage_explain が損なわれている');
assert(game.includes('[data-refund]') && refundEventSource.includes('d.refund'), '返金ボタンが実行処理へ接続されていない');
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
const balanceNodes = { sheet:{innerHTML:''}, 'balance-luck':{}, 'balance-shuffle':{}, 'balance-sound':{}, 'balance-volume':{}, 'btn-close-balance':{} };
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
assert.deepEqual(GAME_FLAGS, {luckRate:1.0,shuffleArrival:false,soundEnabled:true,soundVolume:0.55}, '調整コンソールから運なし・定義順へ切り替わらない');
balanceNodes['balance-luck'].onchange({target:{checked:true}});
balanceNodes['balance-shuffle'].onchange({target:{checked:true}});
assert.deepEqual(GAME_FLAGS, {luckRate:0.9,shuffleArrival:true,soundEnabled:true,soundVolume:0.55}, '調整コンソールから運あり・シャッフルへ戻せない');
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
assert.equal((game.match(/farewellLine\(/g) || []).length, 3, '通常解決と満足した返金以外にも別れの言葉を追加している');
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

// §16: 怒りによる終話はクレーム／一方的切断だけ。苦情メールは翌日のデブリーフだけに出す。
assert(!game.includes("kind:'supervisor'") && !game.includes('上長が引き取り'), '怒り終話に上長引き取りが残っている');
assert(changeStressSource.includes("endAngryCall(t, 'stress')"), 'ストレス100がクレーム／切断以外の経路へ進む');

const angryKindSource = functionSource('angryOutcomeKind');
const makeAngryKind = expected => new Function(
  'ANGRY_DEFAULT_OUTCOMES', 'rollLuck', angryKindSource + '\nreturn angryOutcomeKind;'
)(ANGRY_DEFAULT_OUTCOMES, () => expected);
const angryTypes = ['anxious','novice','expert','hurried'];
assert.deepEqual(angryTypes.map(type => makeAngryKind(true)({s:{type}})), ['hangup','complaint','complaint','hangup'], '顧客タイプ別の既定終話が確定仕様と違う');
assert.deepEqual(angryTypes.map(type => makeAngryKind(false)({s:{type}})), ['complaint','hangup','hangup','complaint'], '裏目で既定終話が反転しない');
assert(closeSource.includes("endAngryCall(t, 'misdiagnosis')"), '誤診2回目がストレス100と同じ終話経路を使わない');

const angryEndSource = functionSource('endAngryCall');
assert(!angryEndSource.includes('farewellLine') && !angryEndSource.includes('FAREWELL_LINES'), 'クレーム／切断のあとに別れの言葉を追加している');
function runAngryEnd(type, expected){
  let closed;
  const ticket = { s:{type}, transcript:[] };
  const run = new Function(
    'ANGRY_DEFAULT_OUTCOMES','ANGRY_END_LINES','rollLuck','pushCustomerLine','closeTicket',
    angryKindSource + '\n' + angryEndSource + '\nreturn endAngryCall;'
  )(
    ANGRY_DEFAULT_OUTCOMES, ANGRY_END_LINES, () => expected,
    (t,text) => t.transcript.push({who:'cust',text}),
    (t,result) => { closed = result; }
  );
  run(ticket, 'stress');
  return { ticket, closed };
}
const complaintEnd = runAngryEnd('expert', true);
const hangupEnd = runAngryEnd('hurried', true);
assert.deepEqual([complaintEnd.closed.kind, complaintEnd.closed.csat, hangupEnd.closed.kind, hangupEnd.closed.csat], ['complaint',1.0,'hangup',0.5], 'クレーム／切断のCSATが1.0／0.5ではない');
assert(complaintEnd.ticket.transcript.some(line => line.who === 'note' && line.text.includes('強い苦情')), 'クレーム終話の情報が通話メモに残らない');
assert(hangupEnd.ticket.transcript.some(line => line.who === 'note' && line.text.includes('一方的')), '一方的切断の情報が通話メモに残らない');

const complaintArrivalSource = functionSource('complaintEmailArrives');
const complaintArrival = luck => new Function('rollLuck', complaintArrivalSource + '\nreturn complaintEmailArrives;')(() => luck);
let emailRolls = 0;
const fixedEmailArrival = new Function('rollLuck', complaintArrivalSource + '\nreturn complaintEmailArrives;')(() => { emailRolls++; return false; });
assert(fixedEmailArrival({kind:'complaint',csat:1}) && fixedEmailArrival({kind:'hangup',csat:.5}), 'クレーム／切断で苦情メールが必着にならない');
assert.equal(emailRolls, 0, 'クレーム／切断の苦情メール判定が不要な運抽選を行う');
assert.equal(complaintArrival(true)({kind:'closed',csat:1.9}), true, '通常クローズCSAT 2未満で運が当たっても苦情メールが来ない');
assert.equal(complaintArrival(false)({kind:'closed',csat:1.9}), false, '通常クローズCSAT 2未満で運が外れても苦情メールが必着になる');
assert.equal(complaintArrival(true)({kind:'closed',csat:2.0}), false, '通常クローズCSAT 2以上にも苦情メールが来る');
assert(!functionSource('renderCall').includes('complaintEmail') && !officeSource.includes('complaintEmail'), '苦情メールが通話中または直後のオフィスに表示される');
assert(debriefSource.includes('complaint-mailbox') && debriefSource.includes('翌日、次の苦情が届いています') && debriefSource.includes("ts.filter(t => t.complaintEmail).length + '件</p>'"), '翌日デブリーフの苦情メール別枠・件数表示がない');
assert.deepEqual(Object.keys(COMPLAINT_EMAIL_TEMPLATES).sort(), angryTypes.slice().sort(), '苦情メール本文が4顧客タイプ分揃っていない');
assert(Object.values(COMPLAINT_EMAIL_TEMPLATES).every(template => Array.isArray(template.lines) && template.lines.length >= 2 && template.lines.length <= 3 && template.lines[0].includes('{symptom}')), '苦情メールが客自身の感情ある2〜3行の文面ではない');
assert(debriefSource.includes("line.replace('{symptom}', t.s.opening)") && !/trueCause|causeName/.test(debriefSource.slice(debriefSource.indexOf('const complaintEmails'), debriefSource.indexOf('const complaintMailbox'))), '苦情メールが症状ではなく客の知らない真因を漏らしている');

// §17: トーストを全廃し、情報を会話メモ・無効理由・オフィス状態へ移す。
assert(!/toast/i.test(page + '\n' + gameLogicSource + '\n' + viewSource + '\n' + eventSource), 'トーストの関数・呼び出し・DOM・CSSが残っている');
const informationMappings = [
  ['着信', officeSource, "'着信 ' + waiting.length + '件'"],
  ['放棄呼', advanceSource, "recordOfficeEvent('abandoned'"],
  ['障害情報', functionSource('triggerOutage'), "who:'note'"],
  ['通話中の受話', pickupSource, 'if (state.focus) return'],
  ['通話中の折り返し', functionSource('resumeCallback'), 'if (state.focus) return'],
  ['苛立ち警告', functionSource('renderStressPanel'), "t.stress > 80 ? ' alert'"],
  ['怒り終話', changeStressSource, "endAngryCall(t, 'stress')"],
  ['危険操作の悪化', functionSource('doTest'), '【まずい対応】'],
  ['操作結果', functionSource('doTest'), '操作結果：'],
  ['ホテル折り返し不可', functionSource('renderCallbackDestination'), '滞在先が未確認です。「聞く」で確認してください。'],
  ['折り返し約束', functionSource('startCallback'), '30分以内に折り返す約束を記録しました。'],
  ['対処の前提不足', functionSource('renderCloseFlow'), "const sub = block || r.sub || ''"],
  ['配送手配中断', functionSource('startShipping'), '配送先が未確認です。手配を中断して滞在先を確認します。'],
  ['配送確定', functionSource('confirmShipment'), 'TGX ' + "' + level.label + '" + 'の手配を確定しました。'],
  ['クローズ前提不足', closeSource, 'const blocked = remedyBlockReason(t, remedy)'],
  ['誤診2回目', closeSource, "endAngryCall(t, 'misdiagnosis')"],
  ['未解決', closeSource, '原因の見立てが外れていました。もう一度切り分けをやり直せます。'],
  ['対応結果確定', closeSource, '対応結果が確定しました。電話を切って終話してください。'],
  ['クローズ結果', functionSource('closeTicket'), "result.label + ' CSAT ' + result.csat.toFixed(1)"],
  ['再着信', interruptSource, "recordOfficeEvent('redial'"],
];
assert.equal(informationMappings.length, 20, '旧トースト20箇所の情報移行表が20件ではない');
informationMappings.forEach(([name, source, marker]) => assert(source.includes(marker), name + 'の情報が状態表示・会話メモ・無効理由へ移っていない'));
const stateStressPanelSource = functionSource('renderStressPanel');
assert(stateStressPanelSource.includes("t.stress > 80 ? ' alert' : ''"), '苛立ち80超で点滅クラスが付かない');
assert(!game.includes('stressWarned'), '苛立ちが80以下へ戻ったあと再び超えても点滅を再開できない');
assert(functionSource('renderCallbackDestination').includes('disabled') && functionSource('renderCloseFlow').includes("const sub = block || r.sub || ''"), 'ブロックされた操作の無効化と理由表示が揃っていない');
assert(officeSource.includes('state.officeEvents.slice(-3)') && officeSource.includes("'再着信 ' + redials.length") && officeSource.includes('event.text'), '放棄呼・再着信がオフィスで目立つ状態表示にならない');
assert(functionSource('closeTicket').includes("recordOfficeEvent('closed'") && officeSource.includes('event.text'), '案件クローズの結果とCSATが終話後のオフィス画面に出ない');

// §18: Web Audio合成音。聞こえない環境でも、画面情報とゲーム進行は変えない。
const initAudioSource = functionSource('initAudio');
const briefingSourceForAudio = functionSource('showBriefing');
assert(initAudioSource.includes('new AudioContextClass()') && briefingSourceForAudio.includes("$('btn-start').onclick") && briefingSourceForAudio.indexOf('initAudio()') > briefingSourceForAudio.indexOf("$('btn-start').onclick"), 'AudioContextが「シフトを始める」操作の中で生成されない');
assert.equal((game.match(/initAudio\(\)/g) || []).length, 2, 'AudioContext初期化がシフト開始以外からも呼ばれる');
assert(game.includes('createOscillator()') && game.includes('createGain()') && !/\.(?:mp3|wav|ogg|m4a)\b/i.test(page + game), '効果音がWeb Audioのコード合成だけで作られていない');

const withAudioSource = functionSource('withAudio');
let failedAudioProgress = 0;
const safeAudio = new Function('GAME_FLAGS','audioContext','clamp', withAudioSource + '\nreturn withAudio;')(
  {soundEnabled:true,soundVolume:.5}, {state:'running'}, (value,min,max) => Math.max(min,Math.min(max,value))
);
assert.doesNotThrow(() => safeAudio(() => { failedAudioProgress++; throw new Error('audio unavailable'); }), '音声処理の例外でゲーム進行が止まる');
assert.equal(failedAudioProgress, 1, '音声処理の失敗ケースを検査できていない');
let mutedCalls = 0;
const mutedAudio = new Function('GAME_FLAGS','audioContext','clamp', withAudioSource + '\nreturn withAudio;')(
  {soundEnabled:false,soundVolume:.5}, {state:'running'}, (value,min,max) => Math.max(min,Math.min(max,value))
);
mutedAudio(() => { mutedCalls++; });
assert.equal(mutedCalls, 0, 'soundEnabled:falseでも発音処理が起きる');

assert(officeSource.includes("'再着信 ' + redials.length") && page.includes('.stress-panel.alert') && functionSource('doTest').includes('【まずい対応】') && functionSource('closeTicket').includes("recordOfficeEvent('closed'"), '着信・苛立ち・失敗・クローズ結果に音以外の画面情報がない');
const soundSceneCalls = [
  ['オフィス着信', functionSource('syncOfficeRing'), 'playOfficeRing()'],
  ['受話', pickupSource + functionSource('resumeCallback'), 'playPickupSound()'],
  ['切断', functionSource('closeTicket') + interruptSource + functionSource('startCallback'), 'playDisconnectSound()'],
  ['顧客発話', functionSource('startTyping'), 'playTypeSound(pos)'],
  ['コマンド選択', eventSource, 'playCommandSound()'],
  ['苛立ち80超', changeStressSource, 'playStressWarning()'],
  ['手がかり／原因確定', functionSource('addFact') + closeSource, 'playClueSound()'],
  ['悪化', functionSource('doTest'), 'playBadActionSound()'],
  ['案件クローズ', functionSource('closeTicket') + advanceSource, 'playCloseJingle('],
  ['シフト終了', functionSource('checkShiftEnd'), 'playShiftEndSound()'],
];
assert.equal(soundSceneCalls.length, 10, '効果音の対象場面が10件ではない');
soundSceneCalls.forEach(([name, source, call]) => assert(source.includes(call), name + 'で対応する効果音関数が呼ばれない'));

const closeSoundKindSource = functionSource('closeSoundKind');
const closeSoundKind = new Function(closeSoundKindSource + '\nreturn closeSoundKind;')();
assert.deepEqual([
  closeSoundKind({kind:'closed',csat:4.0}), closeSoundKind({kind:'closed',csat:3.999}),
  closeSoundKind({kind:'closed',csat:3.0}), closeSoundKind({kind:'closed',csat:2.999}),
  closeSoundKind({kind:'closed',csat:2.0}), closeSoundKind({kind:'closed',csat:1.999}),
  closeSoundKind({kind:'abandoned',csat:0}),
], ['fanfare','success','success','neutral','neutral','failure','failure'], 'クローズ音のCSAT 4.0／3.0／2.0境界または放棄呼の分類が違う');
assert.deepEqual([closeSoundKind({kind:'complaint',csat:1}), closeSoundKind({kind:'hangup',csat:.5})], ['accident','accident'], 'complaint／hangupが事故音へ分類されない');
assert(!['fanfare','success','neutral','failure'].includes(closeSoundKind({kind:'complaint',csat:1})), '事故音が他の案件結果音と同じ分類になる');
assert(functionSource('checkShiftEnd').includes('playShiftEndSound()') && !functionSource('playShiftEndSound').includes('playCloseJingle'), 'シフト終了音が案件クローズ音と別になっていない');

let warningCount = 0;
const crossingStress = new Function('rollLuck','clamp','endAngryCall','playStressWarning', changeStressSource + '\nreturn changeStress;')(
  () => true, (value,min,max) => Math.max(min,Math.min(max,value)), () => false, () => { warningCount++; }
);
const crossingTicket = {stress:79,state:'open'};
crossingStress(crossingTicket,2,true);
crossingStress(crossingTicket,-2,true);
crossingStress(crossingTicket,2,true);
assert.equal(warningCount, 2, '苛立ち警告音が80超→低下→再上昇で二度鳴らない');
assert(functionSource('playTypeSound').includes('if (index % 4) return'), 'タイプ音が1文字ごとではなく間引かれていない');
assert(balanceConsoleSource.includes('id="balance-sound"') && balanceConsoleSource.includes('id="balance-volume"') && balanceConsoleSource.includes('GAME_FLAGS.soundEnabled') && balanceConsoleSource.includes('GAME_FLAGS.soundVolume'), 'ゲーム調整にミュートと音量がない');
assert(functionSource('enterCall').includes('stopOfficeRing()') && functionSource('syncOfficeRing').includes("state.phase !== 'office'"), '通話画面へ移ってもオフィス着信音が止まらない');

// 編集用の3素材と配布用 index.html は、build.js と同じ規則で完全一致する。
const expectedIndex = builtIndexSource(__dirname);
assert.equal(fs.readFileSync(__dirname + '/index.html', 'utf8'), expectedIndex, 'index.html が編集用素材から再生成されていない');

console.log('UI契約・素材同期・SIM清掃仕様: 問題なし');
