/* UIとSIM清掃の、見た目に依存しない回帰契約。 */
const assert = require('assert');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { readGameSource, functionSource: extractFunctionSource, builtIndexSource } = require('./test_helpers');
const { SOURCE_PARTS } = require('./source_manifest');

const game = readGameSource(__dirname);
const page = fs.readFileSync(__dirname + '/p1_head.html', 'utf8');
const gameLogicSource = fs.readFileSync(__dirname + '/p3_game.js', 'utf8');
const viewSource = fs.readFileSync(__dirname + '/p4_view.js', 'utf8');
const eventSource = fs.readFileSync(__dirname + '/p5_events.js', 'utf8');
const handover = fs.readFileSync(__dirname + '/HANDOVER.md', 'utf8');
const dataSource = fs.readFileSync(__dirname + '/p2_data.js', 'utf8') +
  '\nreturn {CAUSES,LOOKUPS,TESTS,RISKY,REMEDIES,SCENARIOS,IDENTITY_POOL,PLACE_POOL,PLACE_CONSTRAINTS,TYPES,SOOTHES,SOOTHE_EFFECTS,APOLOGIES,APOLOGY_REPLIES,FAREWELL_LINES,REDIAL_OPENINGS,REDIAL_STRESS,BLIND_CALLBACK_STRESS,BLIND_CALLBACK_CSAT_PENALTY,DESK_LOOKUP_MINUTES,CALLBACK_SCHEDULED_MINUTES,COMMAND_DEFS,QUESTION_GROUPS,QUESTIONS,SMALLTALK_EFFECTS,IDENTITY_CALMING_EFFECTS,OFFICE_PALETTE,MORNING_OFFICE_PALETTE,OFFICE_STATIONS,MORNING_STAFF,ARTIFACT_URL,ARTIFACT_QR,LUCK_RATE,CARRIER_REPLY_RATE,GAME_FLAGS,CAREER_STORAGE_KEY,CAREER_VERSION,CAREER_STAGES,CAREER_BADGES,PRESIDENT_ENDING_LINE,REFUND_POLICY,ANGRY_DEFAULT_OUTCOMES,ANGRY_END_LINES,COMPLAINT_EMAIL_TEMPLATES,CALL_FLOW_LINES};';
const { CAUSES, LOOKUPS, TESTS, RISKY, REMEDIES, SCENARIOS, IDENTITY_POOL, PLACE_POOL, PLACE_CONSTRAINTS, TYPES, SOOTHES, SOOTHE_EFFECTS, APOLOGIES, APOLOGY_REPLIES, FAREWELL_LINES, REDIAL_OPENINGS, REDIAL_STRESS, BLIND_CALLBACK_STRESS, BLIND_CALLBACK_CSAT_PENALTY, DESK_LOOKUP_MINUTES, CALLBACK_SCHEDULED_MINUTES, COMMAND_DEFS, QUESTION_GROUPS, QUESTIONS, SMALLTALK_EFFECTS, IDENTITY_CALMING_EFFECTS, OFFICE_PALETTE, MORNING_OFFICE_PALETTE, OFFICE_STATIONS, MORNING_STAFF, ARTIFACT_URL, ARTIFACT_QR, LUCK_RATE, CARRIER_REPLY_RATE, GAME_FLAGS, CAREER_STORAGE_KEY, CAREER_VERSION, CAREER_STAGES, CAREER_BADGES, PRESIDENT_ENDING_LINE, REFUND_POLICY, ANGRY_DEFAULT_OUTCOMES, ANGRY_END_LINES, COMPLAINT_EMAIL_TEMPLATES, CALL_FLOW_LINES } = new Function(dataSource)();

const functionSource = (name) => {
  return extractFunctionSource(game, name);
};

assert.deepEqual(SOURCE_PARTS, ['p1_head.html','p2_data.js','p3_game.js','p4_view.js','p5_events.js'], '編集素材の結合順が変わっている');
assert(!/function render(?:WorldStrip|Shipping)\(/.test(gameLogicSource), 'ゲームロジックに画面描画の責務が残っている');
assert(!/\b(?:document|window)\./.test(gameLogicSource), 'ゲームロジックがブラウザDOMを直接操作している');
assert(!gameLogicSource.includes('mobilePane'), '廃止したペイン切替状態 mobilePane が残っている');
assert(!/function (?:doSoothe|doApologize|openRecord)\(/.test(viewSource), '画面描画に会話状態を変更する責務が残っている');
assert(!/function (?:greetCurrentCustomer|chooseRemedy)\(/.test(eventSource), 'イベント配線にゲーム実処理の責務が残っている');

const commands = ['聞く', '調べる', '伝える', 'ログ'];
assert.deepEqual(COMMAND_DEFS.map(command => command.label), commands, '主コマンド4つの順番・名称が違う');
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

// 通話フロー v2: IVRなし、通常客は名乗り必須、本人特定前の社内照会は理由を示して拒否。
const actionsSource = functionSource('renderActions');
const greetGate = actionsSource.indexOf('if (!t.greeted && !customerHasSpoken(t)) return');
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
const stayHintSource = functionSource('deliverStayHint');
assert(pickupSource.includes('deliverCustomerOpening(t, true)') && greetCustomerSource.includes('deliverCustomerOpening(t, false)'), '通話開始と名乗り後の第一声が共通処理を使わない');
assert(openingDeliverySource.includes('customerSpeaksBeforeGreeting(t)'), '第一声の共通処理が顧客タイプ判定を使わない');
const openingLines = [];
const deliverStayHint = new Function('pushCustomerLine', stayHintSource + '\nreturn deliverStayHint;')(() => {});
const deliverCustomerOpening = new Function('customerSpeaksBeforeGreeting','pushCustomerLine','DESTINATION_IN_OPENING','deliverStayHint', openingDeliverySource + '\nreturn deliverCustomerOpening;')(
  ticket => ticket.s.type === 'hurried',
  (ticket, line, options) => openingLines.push({line,plain:Boolean(options && options.plain)}),
  new Set(['S9','S11']), deliverStayHint
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
assert.deepEqual(SCENARIOS.filter(scenario => openingDestinationIds.includes(scenario.id) && scenario.opening.includes('{city}')).map(scenario => scenario.id), openingDestinationIds, '地名を許した2案件の第一声に渡航先がない');
const forbiddenOpeningContext = /バンコク|ロンドン|ホノルル|上海|ニューヨーク|バルセロナ|ドバイ|パリ|新婚旅行|夫|妻|娘|家族旅行|ツアー|出張|会議|同僚|お仕事/;
assert(SCENARIOS.filter(scenario => !openingDestinationIds.includes(scenario.id)).every(scenario => !forbiddenOpeningContext.test(scenario.opening)), '第一声に渡航先・旅行目的・同行者の情報が残っている');
assert(SCENARIOS.filter(scenario => !openingDestinationIds.includes(scenario.id)).every(scenario => !scenario.opening.includes('{city}') && !scenario.opening.includes(scenario.city)), '通常案件の第一声に自身のcityが残っている');

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
assert(!menuSource.includes('disabled:!t.identified') && !menuSource.includes('本人特定が必要'), '本人特定前の「調べる」が押せない、または理由のmetaを残している');
assert(menuSource.includes('COMMAND_DEFS.map'), '主コマンドが調整コンソールと同じ定義を使っていない');
assert(!menuSource.includes('c.desc'), '主コマンドに小さい説明書きが描画される');
assert(!/未確認|質問計|繰り返し可|通話を終える|残り \+|時間消費なし|1〜2分/.test(menuSource), '主コマンドに残数や補助説明のmetaが残っている');

const lookupSource = functionSource('renderLookupOptions');
assert(!lookupSource.includes('t.identified') && !lookupSource.includes('identificationReady'), '照会画面内側に本人特定判定を重複している');

const changeStressSource = functionSource('changeStress');
assert(changeStressSource.includes("endAngryCall(t, 'stress')"), 'ストレス100が怒り終話の共通経路を通らない');
const debriefSource = functionSource('renderDebrief');
assert(debriefSource.includes('お客様の苛立ちが限界に達し、強い苦情を述べて終話しました。'), 'ストレス由来のクレーム振り返り文がない');
assert(debriefSource.includes('お客様の苛立ちが限界に達し、一方的に通話を切りました。'), 'ストレス由来の切断振り返り文がない');
assert(functionSource('advanceConversationFlow').includes("endAngryCall(t, reason)"), '誤診2回目が怒り終話の共通経路を通らない');
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
assert.equal(officeActionButtons.length, 3, 'オフィスの操作が受話・折り返し・端末調査の3ボタンではない');
assert(page.includes('data-office-answer="1"') && page.includes('>電話を取る<'), '「電話を取る」ボタンがない');
assert(page.includes('data-office-callback="1"') && page.includes('>電話をかける<') && page.includes('折り返し待ち'), 'オフィスに電話をかけるボタンまたは折り返し待ち表示がない');
// §40: 選択肢は縦に潰さない。潰れると「前提不足」の理由や対処の説明が読めず、
//      押せる選択肢が1つだけ残って詰んだように見える。
assert(/\.opt\{[^}]*flex:\s*none/.test(page.replace(/\s*\n\s*/g, '')), '選択肢ボタンが縦に潰れて説明文が切れる');
assert(page.includes('body.playing .opts{ max-height:none; overflow:visible; }'), '通話中の選択肢一覧が小窓スクロールに閉じ込められている');
// §40: 折り返しを待つあいだ、通話をつながずに社内システムだけ調べられる。
assert(page.includes('data-office-desk="1"') && page.includes('>端末で調べる<'), 'オフィスに端末調査のボタンがない');
const deskLookupSource = functionSource('doDeskLookup');
assert(deskLookupSource.includes('advance(DESK_LOOKUP_MINUTES)') && !deskLookupSource.includes('addStress'), '端末調査が時間を使わない、または通話中と同じストレスを与えている');
assert(deskLookupSource.includes('l.external') && deskLookupSource.includes('identificationReady(t)'), '端末調査が社外照会や本人未特定を素通ししている');
assert(functionSource('deskTickets').includes("t.state === 'callback'"), '端末調査の対象が折り返し待ちの案件に限られていない');

const customerLabel = new Function(functionSource('customerLabel') + '\nreturn customerLabel;')();
const unknownCustomer = { nameKnown:false, s:{ id:'S5', name:'小林 亜衣' } };
const knownCustomer = { nameKnown:true, s:{ id:'S5', name:'小林 亜衣' } };
assert.equal(customerLabel(unknownCustomer), 'お客様', '未特定の表示名が「お客様」ではない');
assert.equal(customerLabel(unknownCustomer, true), 'お客様（S5）', '未特定の内部表示名にチケットIDがない');
assert.equal(customerLabel(knownCustomer), '小林 亜衣', '本人特定後も氏名が表示されない');
const officeSource = functionSource('renderOffice');
assert(officeSource.includes("sort((a,b) => a.arrivedTurn - b.arrivedTurn)"), '着信を到着順に並べていない');
assert(officeSource.includes("$('office-answer-status').textContent = waiting.length") && officeSource.includes('最短あと'), '電話を取るボタンに待ち件数と切断までの時間を表示していない');
const officeActionSource = functionSource('handleOfficeAction');
const firstTicketSource = functionSource('firstTicketIn');
assert(firstTicketSource.includes('.sort((a, b) => a[orderKey] - b[orderKey])'), '待機案件を指定された時刻順に選べない');
assert(officeActionSource.includes("firstTicketIn('waiting', 'arrivedTurn')"), '「電話を取る」が最古の着信を選んでいない');
assert(!officeActionSource.includes('patience'), '「電話を取る」が見えない機嫌で選んでいる');
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
// §45: 戻る時間の質問は、折り返しを約束したあとにだけ出す。
const askOptions45 = new Function('QUESTIONS','esc','renderSmalltalkChoices',askOptionsSource + '\nreturn renderAskOptions;')(
  QUESTIONS,text => String(text),() => ''
);
const customerGroup45 = QUESTION_GROUPS.find(group => group.id === 'customer');
const askTicket45 = promised => ({ s:{deviceInHand:true,contractId:{minutes:2}}, asked:new Set(), askCounts:new Map(), callbackPromised:promised });
assert(!askOptions45(askTicket45(null), customerGroup45).includes('data-ask="q_return"'),'§45 戻る時間の質問が約束前から出る');
assert(askOptions45(askTicket45('immediate'), customerGroup45).includes('data-ask="q_return"'),'§45 約束したあとも戻る時間を聞けない');
const askGroupsSource = functionSource('renderAskGroups');
assert(askGroupsSource.includes('QUESTION_GROUPS.filter') && askGroupsSource.includes('groups.map'), '「聞く」が利用可能な4区分を表示しない');
assert(askGroupsSource.includes('data-ask-group=') && askGroupsSource.includes('.every(id => t.asked.has(id))'), '質問区分の選択または完了時disabledがない');
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
assert(balanceWarningSource.includes("SCENARIOS.length + '件の真因と正解対処がすべて表示されます。</strong>"), '調整コンソールを開く前のネタバレ警告が案件数へ追従しない');
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
assert(recentTranscriptLines(recentFixture).length <= 4, '§44 直近表示が4行を超える');
assert(recentSource.includes('.slice(-4)'), '§44 直近表示が4行を超える');
assert(recentTranscriptLines(recentFixture).every(line => line.who !== 'note'), '直近表示にメモが混ざる');
const consecutiveCustomer44 = { transcript:[
  {who:'me',text:'直前の自分'}, {who:'cust',text:'症状の訴え'}, {who:'cust',text:'滞在のほのめかし'},
] };
assert.deepEqual(recentTranscriptLines(consecutiveCustomer44).map(line => line.text), ['直前の自分','症状の訴え','滞在のほのめかし'], '§44 連続する顧客発話の1行目が通話画面から落ちる');
const frontThenCustomer44 = { transcript:[
  {who:'me',text:'おつなぎします'}, {who:'front',text:'客室へつなぎます'}, {who:'cust',text:'お待たせしました'},
] };
assert.deepEqual(recentTranscriptLines(frontThenCustomer44).map(line => line.text), ['おつなぎします','客室へつなぎます','お待たせしました'], '§44 Front Desk経由の連続発話が落ちる');
const lookupRecentFixture = { transcript:[
  {who:'cust',text:'直前の客',typed:true},
  {who:'sys',text:'照会結果',typed:true,lookupTitle:'契約照会'},
  {who:'me',text:'読み上げ要約'},
]};
assert.deepEqual(recentTranscriptLines(lookupRecentFixture).map(line => line.text), ['照会結果','読み上げ要約'], '§26 照会直後にシステム結果画面と読み上げ要約が表示されない');
const headerSource = functionSource('renderCallHeader');
['t.s.name','t.s.city','localClock','t.s.device','t.s.plan','TYPES','call-guide','hold-state'].forEach(leak => {
  assert(!headerSource.includes(leak), '通話ヘッダにログへ移す情報が残っている: ' + leak);
});
assert(headerSource.includes('t.s.id') && headerSource.includes('t.callSegmentMinutes') && headerSource.includes("outbound ? '当社負担' : 'お客様負担'") && headerSource.includes('CALL_RATE_PER_MIN'), '通話ヘッダがチケットID・通話時間・負担者つき費用だけを表示していない');
const stressPanelSource = functionSource('renderStressPanel');
assert(stressPanelSource.includes('if (!customerHasSpoken(t))'), '顧客が話す前にも苛立ちの数値が見える');
assert(stressPanelSource.includes('<b>—</b>') && stressPanelSource.includes('<strong>まだ不明</strong>'), '発話前の苛立ち表示が不明値と完全一致しない');
assert(stressPanelSource.includes("t.stress > 80 ? ' alert' : ''"), 'ストレス80超でメーターが点滅しない');
const stageSource = functionSource('stressDisplayStage').replace(/\s+/g, ' ');
assert(/value <= 50.*?平静.*?value <= 70.*?苛立ち.*?value <= 90.*?怒り.*?限界/.test(stageSource), '苛立ちメーターの境界・ラベルが仕様と違う');
assert(page.includes('.stress-panel.alert') && page.includes('@keyframes stress-alert'), '苛立ちメーターの点滅CSSがない');
assert(/\.stress-panel\{[^}]*position:sticky/.test(page), '苛立ちメーターがsticky固定されていない');
const recordSource = functionSource('renderRecord') + functionSource('renderCustomerRecord') + functionSource('renderRecordLog');
const logHeadings = [...recordSource.matchAll(/<h3>([^<]+)<\/h3>/g)].map(match => match[1]);
assert.deepEqual(logHeadings, ['顧客情報','ログの手がかり','次にできること','会話の全履歴'], 'ログの見出しが完全一致しない');
assert(recordSource.includes('renderRecordTranscript(t)'), 'ログで全履歴を表示しない');
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
// §42-3: command-no を持たない質問区分は、親の番号用24px列を本文に使ってはならない。
const askGroupChoiceCss42 = [...page.matchAll(/\.ask-group-choice\{([^}]*)\}/g)].map(match => match[1]);
assert(askGroupChoiceCss42.some(block => /grid-template-columns\s*:\s*minmax\(0,1fr\)/.test(block)), '§42-3 番号なしcommand-choiceが番号用の列指定を上書きしない');
assert(askGroupChoiceCss42.every(block => !/grid-template-columns\s*:\s*24px/.test(block)), '§42-3 番号なし質問区分の本文が24px列へ押し込まれる');

const worldSource = functionSource('renderWorldStrip');
assert(worldSource.includes('state.tickets.filter(t => t.destinationKnown)'), '渡航先未判明の待ちチケットが世界地図に現れる');
assert(page.includes('.stress-panel'), '大きな苛立ちメーターCSSがない');

const tellSource = functionSource('renderTellOptions');
['data-tell="close"','data-tell="try"','data-tell="soothe"','data-tell="apologize"'].forEach(marker => assert(tellSource.includes(marker), '「伝える」の項目から ' + marker + ' が欠けている'));
assert(tellSource.includes('data-refund="refund"'), '「伝える」にrefund項目がない');
const escForTell = text => String(text).replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
const hotelCallbackOffered = new Function(functionSource('hotelCallbackOffered') + '\nreturn hotelCallbackOffered;')();
const hotelCallbackSub = new Function(functionSource('hotelCallbackSub') + '\nreturn hotelCallbackSub;')();
const renderTellOptions = new Function('REFUND_POLICY', 'hotelCallbackOffered', 'hotelCallbackSub', 'esc', tellSource + '\nreturn renderTellOptions;')(REFUND_POLICY, hotelCallbackOffered, hotelCallbackSub, escForTell);
const tellTicket = { refundProposalRejected:false, s:{ deviceInHand:true }, callDirection:'inbound', asked:new Set(), stayAddress:null, callChargeConcerned:false };
const tellHtml = renderTellOptions(tellTicket);
assert(!/hardware|provision|logistics|carrier|coverage|fup|devices|heavy|device_side|device_net|power|location|geo_block|sim|会社側|顧客側|中立/.test(tellHtml), '返金の責任所在一覧が画面・ログ・ラベルに漏れる');
const tellEntries = [...tellHtml.matchAll(/data-(tell|refund|hotel-callback)="([^"]+)"[\s\S]*?<span class="opt-label">([^<]+)(?:<span class="opt-sub">([^<]+)<\/span>)?/g)]
  .map(match => ({ id:match[1] === 'hotel-callback' ? 'hotel-callback' : match[2], label:match[3], note:match[4] || '' }));
assert.deepEqual(tellEntries, [
  { id:'close', label:'対処を伝える', note:'原因を見立てて、対処をご案内します。' },
  { id:'try', label:'やってみてもらう', note:'機器や端末で試していただくことを選びます。' },
  { id:'refund', label:'返金をご案内する', note:'' },
  { id:'hotel-callback', label:'いますぐ折り返す', note:'すぐにこちらから掛け直します' },
  { id:'hotel-callback', label:'1時間後に折り返す', note:'確認のうえ掛け直します。滞在先はまだ伺っていません。' },
  { id:'soothe', label:'気持ちを落ち着ける', note:'' },
  { id:'apologize', label:'お詫びする', note:'' },
  { id:'smalltalk', label:'一言かける', note:'' },
], '「伝える」のID・項目名・注意書きが完全一致しない');
// §40: 折り返しはこちらから掛け直している最中には出さない。
assert(!renderTellOptions({ ...tellTicket, callDirection:'outbound' }).includes('data-hotel-callback'), '折り返し中の通話にも折り返しの選択肢が出る');
assert(!/終わります|締めます/.test(tellHtml + functionSource('commandPrompt') + functionSource('renderCloseFlow')), '「伝える」の項目に終話・締めを示す文言が残っている');
const actionsAskBranch = actionsSource.slice(actionsSource.indexOf("if (tab === 'ask')"), actionsSource.indexOf("if (tab === 'tell')"));
assert(actionsAskBranch.includes('renderAskGroups(t)') && actionsAskBranch.includes('renderAskOptions(t, group)'), '「聞く」の区分選択と質問一覧が2段階で接続されていない');

// §8 雑談（空気を読む）
const requiredTopicFields = ['id','reveal','askLabel','tellLabel','goodReply','badReply'];
assert(SCENARIOS.length === 14 && SCENARIOS.every(s => Array.isArray(s.smalltalk) && s.smalltalk.length >= 1 && s.smalltalk.every(topic => requiredTopicFields.every(field => typeof topic[field] === 'string' && topic[field].length > 0))), '全14シナリオの雑談話題6項目が揃っていない');
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
assert(askGroupsSource.includes('ask-group-choice'), '§42-3 番号なし質問区分の描画と1列CSSの対応がない');

// §43: 客が通話中に確かめられない手配・説明を「試したのに直らない」とは言わせない。
const remedies43 = Object.values(REMEDIES).flat();
assert(remedies43.every(remedy => typeof remedy.verifiable === 'boolean'), '§43-6 検査1: 全対処にverifiableがない');
['r_escalate_line','r_outage_explain','r_coverage_replacement','r_coverage_refund','r_hardware_swap','r_logistics_replacement','r_logistics_refund'].forEach(id => {
  const remedy = remedies43.find(item => item.id === id);
  assert(remedy && remedy.verifiable === false, '§43-6 検査2: 手配・返金・説明系がverifiable:falseではない: ' + id);
});
const close43 = functionSource('doClose');
const redial43 = functionSource('queueUnverifiableRedial');
assert(!close43.includes('運が悪かった'), '抽選結果が画面・ログ・transcriptに漏れる');
assert(/if \(!remedy\.verifiable && \(causeMatched \|\| t\.misdiagnoses < 2\)\)/.test(close43), '§43-6 検査3: 確かめられない対処の失敗を後日の再入電へ分けない');
assert(close43.includes('CALL_FLOW_LINES.unverifiable.closing[s.type]') && close43.includes('queueUnverifiableRedial(t)'), '§43-6 検査4: 結果待ちの終話と再入電がない');
assert(redial43.includes('t.redialCount++') && redial43.includes('t.redialOpening') && redial43.includes('t.redialGreeting = true'), '§43-6 検査5: 再入電が既存のredial状態を使わない');
assert(close43.includes('t.misdiagnoses >= 2'), '§43-6 検査7: 2回目誤診の上長引き取りが消えている');
assert(close43.includes("s.panel.bars === 0 || s.panel.sim === 'none'") && close43.includes('CALL_FLOW_LINES.unverifiable.noSignal[s.type]'), '§43-6 検査8: 圏外の客に復旧可否を判断させる');
const s3_43 = SCENARIOS.find(s => s.id === 'S3');
assert(s3_43.contradicts && s3_43.contradicts.carrier && !/devices|接続台数|真因/.test(s3_43.contradicts.carrier), '§43-6 検査9/10: S3の食い違い指摘がない、または真因を漏らす');
assert(close43.includes('s.contradicts[causeId]') && close43.includes("t.state = 'open'"), '§43-6 検査11: 食い違い指摘のあと切り分けを続けられない');

// §9: 90/10の運、反応と対処だけの揺れ、登場順シャッフル、旧挙動への復帰。
assert.equal(LUCK_RATE, 0.9, '運の本来どおり率が0.9ではない');
assert.deepEqual(GAME_FLAGS, { luckRate:0.9, shuffleArrival:true, shuffleIdentity:true, dailyTickets:null, careerStage:null, unlockedBadges:null, solvedScenarios:null, soundEnabled:true, soundVolume:0.55 }, '運・音・1日件数・キャリアの初期GAME_FLAGSが確定値と違う');
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
    shipment:null, pendingResult:null, extraMinutes:0,
  };
  const closeState = { focus:ticket, cost:0, escLeft:3, ui:null };
  const deps = {
    state:closeState,
    REMEDIES:{
      right:[{id:'r_right', label:'正しい対処', cost:100, kind:'guide', verifiable:true}],
      wrong:[{id:'r_wrong', label:'誤った対処', cost:200, kind:'guide', verifiable:true}],
    },
    TYPES:{ hurried:{tone:'brief'} },
    remedyBlockReason:() => '', toneLabel:id => id,
    spendOnCall:(t, minutes) => { t.callMinutes += minutes; return true; },
    treatmentSucceeds:matched => expectedOutcome ? matched : !matched,
    addStress:(t, delta) => { t.stress += delta; return true; },
    render:() => {}, toast:() => {}, advance:minutes => { ticket.extraMinutes += minutes; },
    playClueSound:() => {},
    pushCustomerLine:(t, text) => t.transcript.push({who:'cust', text}),
    pushFlowLines:(t, lines) => lines.forEach(line => t.transcript.push({who:line.who,text:line.text})),
    closeTicket:(t, result) => { t.result = result; t.state = 'closed'; },
    causeName:id => id, customerLabel:() => 'お客様',
    clamp:(value, min, max) => Math.max(min, Math.min(max, value)),
    patiencePenalty:() => 0, holdPenalty:() => 0, stressPenalty:() => 0,
    gradeLabel:grade => grade === 'best' ? '解決' : grade,
    defaultUi:() => ({}), closingLine:() => '解決しました', farewellLine:() => 'ありがとうございました',
    resolutionOperatorClosing:() => '失礼いたします', CALL_FLOW_LINES,
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
assert.equal(SCENARIOS.filter(scenario => typeof scenario.opening === 'string' && scenario.opening.length > 0).length, SCENARIOS.length, '全シナリオの第一声が揃っていない');
assert.equal(SCENARIOS.flatMap(scenario => scenario.smalltalk || []).length, 15, '雑談15話題が揃っていない');
assert(typeNames.every(type => ['sootheReply','sootheMissReply','sootheRepeatReply'].every(key => TYPES[type][key])), 'なだめる反応が4タイプ分揃っていない');
assert(typeNames.every(type => APOLOGY_REPLIES[type] && ['brief','accepted','repeated','excessive'].every(key => APOLOGY_REPLIES[type][key])), '謝罪の受け止め方が4タイプ分揃っていない');

const customerDialogue = [];
typeNames.forEach(type => {
  dialogueStages.forEach(stage => customerDialogue.push(...TYPES[type][stage]));
  customerDialogue.push(TYPES[type].sootheReply, TYPES[type].sootheMissReply, TYPES[type].sootheRepeatReply, TYPES[type].solvedReply, TYPES[type].refundRejectReply);
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
assert.deepEqual(GAME_FLAGS, {luckRate:0.9,shuffleArrival:true,shuffleIdentity:true,dailyTickets:null,careerStage:null,unlockedBadges:null,solvedScenarios:null,soundEnabled:true,soundVolume:0.55}, '顧客会話改稿で苛立ち数値・運・判定ロジックが変わっている');

// §19／§31: 返金は確認後に提案し、受入後の満足判定とは別に、まれな拒否を持つ。
assert.equal(REFUND_POLICY.amount, 2400, '返金額が確定値2,400円ではない');
assert.deepEqual(REFUND_POLICY.company, {causes:['hardware','provision','logistics','carrier','coverage'],rejectionRate:0.05,satisfactionRate:0.5}, '会社側の返金拒否率5%／満足率50%が違う');
assert.deepEqual(REFUND_POLICY.customer, {causes:['fup','devices','heavy','device_side','device_net','power'],rejectionRate:0.2,satisfactionRate:0.1}, '顧客側の返金拒否率20%／満足率10%が違う');
assert.deepEqual(REFUND_POLICY.neutral, {causes:['location','geo_block','sim'],rejectionRate:0.1,satisfactionRate:0.25}, '中立の返金拒否率10%／満足率25%が違う');
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

const refundProposalRejectedSource = functionSource('refundProposalRejected');
const makeRefundProposalRejected = (luckRate, random) => new Function('REFUND_POLICY','GAME_FLAGS','state','refundResponsibility', refundProposalRejectedSource + '\nreturn refundProposalRejected;')(REFUND_POLICY,{luckRate},{random},refundResponsibility);
assert.deepEqual([
  makeRefundProposalRejected(.9, () => .0499)('hardware'), makeRefundProposalRejected(.9, () => .05)('hardware'),
  makeRefundProposalRejected(.9, () => .0999)('sim'), makeRefundProposalRejected(.9, () => .1)('sim'),
  makeRefundProposalRejected(.9, () => .1999)('fup'), makeRefundProposalRejected(.9, () => .2)('fup'),
], [true,false,true,false,true,false], '§31 検査5: 返金拒否率が会社5%／中立10%／顧客20%ではない');
assert.deepEqual(['hardware','sim','fup'].map(cause => makeRefundProposalRejected(1, () => 0)(cause)), [false,false,false], '§31 検査7: luckRate 1.0でも返金拒否が起きる');

function runRefund({rejected=false,satisfied=false,type='expert'}={}){
  const ticket = {s:{trueCause:'hardware',type},state:'open',transcript:[],callMinutes:0,holdMinutes:0,stress:10,maxStress:10,refundProposalRejected:false};
  const refundState = {focus:ticket,cost:0,ui:{tab:'refund_confirm'}};
  const deps = {
    state:refundState, REFUND_POLICY, TYPES, refundProposalRejected:() => rejected, refundSatisfied:() => satisfied,
    pushCustomerLine:(t,text) => t.transcript.push({who:'cust',text}), farewellLine:() => '通常の別れの言葉',
    pushFlowLines:(t,lines) => lines.forEach(line => t.transcript.push({who:line.who,text:line.text})),
    spendOnCall:(t,minutes) => { t.callMinutes += minutes; return true; },
    addStress:(t,amount) => { t.stress += amount; t.maxStress = Math.max(t.maxStress,t.stress); return true; },
    CALL_FLOW_LINES, defaultUi:() => ({}), render:() => {},
  };
  const refund = new Function(...Object.keys(deps), functionSource('doRefund') + '\nreturn doRefund;')(...Object.values(deps));
  refund();
  return {ticket,state:refundState,result:ticket.pendingResult,refund};
}
const satisfiedRefund = runRefund({satisfied:true});
const dissatisfiedRefund = runRefund({satisfied:false});
const rejectedRefund = runRefund({rejected:true,type:'anxious'});
assert.deepEqual([Boolean(satisfiedRefund.result),Boolean(dissatisfiedRefund.result),Boolean(rejectedRefund.result)],[true,true,false], '§31 検査1: 返金が満足受入／不満受入／拒否の3通りにならない');
assert.equal(satisfiedRefund.ticket.state, 'open', '返金の最後の発話前に案件がclosedになる');
assert.deepEqual([satisfiedRefund.result.kind,satisfiedRefund.result.satisfied,satisfiedRefund.result.csat], ['refunded',true,3.0], '満足した返金のkind／satisfied／CSATが違う');
assert.deepEqual([dissatisfiedRefund.result.kind,dissatisfiedRefund.result.satisfied,dissatisfiedRefund.result.csat], ['refunded',false,1.0], '不満足な返金のkind／satisfied／CSATが違う');
assert.equal(satisfiedRefund.state.cost, 2400, '満足した返金で2,400円が加算されない');
assert.equal(dissatisfiedRefund.state.cost, 2400, '不満足な返金で2,400円が加算されない');
assert.equal(rejectedRefund.state.cost, 0, '§31 検査3: 拒否された返金提案で費用が加算される');
assert(rejectedRefund.ticket.state === 'open' && !rejectedRefund.ticket.pendingResult, '§31 検査2: 返金拒否で案件がクローズする');
assert(rejectedRefund.ticket.callMinutes === 2 && rejectedRefund.ticket.stress > 10, '§31 検査4: 返金拒否で2分と苛立ち増を消費しない');
assert(satisfiedRefund.ticket.transcript.some(line => line.text === '通常の別れの言葉'), '満足した返金に通常の別れの言葉が付かない');
assert(!dissatisfiedRefund.ticket.transcript.some(line => line.text === '通常の別れの言葉'), '不満足な返金に別れの言葉が付く');
assert(satisfiedRefund.result.csat < 4, '返金に満足したCSATが正しく解決した4点台へ届く');
const refundComplaintArrival = new Function('rollLuck', functionSource('complaintEmailArrives') + '\nreturn complaintEmailArrives;')(() => true);
assert.equal(refundComplaintArrival({kind:'refunded',csat:1.0}), true, '不満足な返金が後日の苦情メール対象に入らない');
const refundConfirmSource = functionSource('renderRefundConfirmation');
assert(refundConfirmSource.includes('REFUND_POLICY.amount.toLocaleString') && refundConfirmSource.includes('返金をご提案します') && refundConfirmSource.includes('受け入れていただければ') && !refundConfirmSource.includes('この電話はこれで終わります。') && refundConfirmSource.includes('data-refund-confirm'), '§31 検査9: 返金確認が提案と条件つき終話を伝えない');
const refundEventSource = functionSource('handleConversationAction');
assert(refundEventSource.includes("defaultUi('refund_confirm')") && refundEventSource.includes('if (d.refundConfirm){ doRefund()'), '返金が確認を挟まず実行される');
assert(!/\brefunds\b|refundCsat|refundResult|refundEffect/.test(gameLogicSource), '旧返金の回数管理・CSAT逓減がコードに残っている');
assert(functionSource('doRefund').includes("kind:'refunded'") && !functionSource('doRefund').includes("state = 'waiting'") && !functionSource('doRefund').includes('redial'), '返金クローズした案件が再入電する');
const rejectedTranscriptCount = rejectedRefund.ticket.transcript.length;
rejectedRefund.state.ui = {tab:'refund_confirm'};
rejectedRefund.refund();
assert(rejectedRefund.ticket.transcript.length === rejectedTranscriptCount && functionSource('renderTellOptions').includes('t.refundProposalRejected') && functionSource('renderTellOptions').includes('data-refund="refund"'), '§31 検査8: 拒否後に返金を再提案できる');
assert(!/pendingResult|csat|result\s*=/.test(functionSource('doRefund').slice(functionSource('doRefund').indexOf('if (refundProposalRejected'),functionSource('doRefund').indexOf('const satisfied'))), '§31 検査11: 返金拒否そのものが評価結果を確定する');
assert.deepEqual(typeNames.map(type => TYPES[type].refundRejectReply),[
  '返金だけでは、この先も使えないままですよね…。お金ではなく、つながるようになるまで助けてください。',
  '返金のお話より、使えるようにしていただきたいんです。まだ何をすればいいか教えてください。',
  '返金は要らない。今つながる方法を出して。対応を続けてください。',
  '返金提案は受けません。利用可能な状態への復旧を優先し、切り分けを続けてください。',
], '§31 検査12: 返金を拒否する台詞が4タイプ分書き分けられていない');
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
assert.deepEqual([...new Set(firstOrder.map(s => s.id))].sort(), SCENARIOS.map(s => s.id).sort(), 'シャッフル後に全案件の欠落・重複がある');
assert(firstOrder.every(item => SCENARIOS.includes(item)), 'シャッフルで案件間の参照を失う複製を作っている');
const luckResetSource = functionSource('resetGame');
assert(luckResetSource.includes('prepareDailyScenarios(SCENARIOS, state.random).map(newTicket)'), 'resetGameが日次案件の選択と到着圧縮を通らない');
assert(functionSource('prepareDailyScenarios').includes('flags.shuffleArrival') && functionSource('prepareDailyScenarios').includes(': scenarios.slice()'), '登場順シャッフルを元へ戻せない');
assert(functionSource('prepareDailyScenarios').includes('{ arrive:arrivalSlots[index] }'), 'シャッフル後の順番へ固定到着枠を振り直していない');
assert.deepEqual(SCENARIOS.map(s => s.arrive).sort((a,b) => a-b), [0,5,11,18,25,31,38,44,50,56,62,68,74,80], '14案件の固定到着枠が変わっている');

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
const balanceNodes = { sheet:{innerHTML:''}, 'balance-luck':{}, 'balance-shuffle':{}, 'balance-identity':{}, 'balance-sound':{}, 'balance-volume':{}, 'balance-replay-ending':{}, 'balance-replay-secret-ending':{}, 'balance-clear-career':{}, 'btn-close-balance':{} };
const balanceDeps = {
  state:{phase:'briefing'}, GAME_FLAGS, LUCK_RATE, COMMAND_DEFS, SCENARIOS, TYPES, REMEDIES,
  $:id => balanceNodes[id], esc:value => String(value), causeName:id => id, scenarioRoute:() => [],
  openSheet:() => {}, showBriefing:() => {}, renderDebrief:() => {}, closeSheet:() => {}, render:() => {}, showCareerEnding:() => {}, showSecretEnding:() => {}, clearCareerRecord:() => {},
};
new Function(...Object.keys(balanceDeps), balanceConsoleSource + '\nreturn showBalanceConsole;')(...Object.values(balanceDeps))();
assert.equal(typeof balanceNodes['balance-luck'].onchange, 'function', '運の切り替えイベントが接続されない');
assert.equal(typeof balanceNodes['balance-shuffle'].onchange, 'function', '登場順の切り替えイベントが接続されない');
assert.equal(typeof balanceNodes['balance-identity'].onchange, 'function', '名前・土地シャッフルの切り替えイベントが接続されない');
balanceNodes['balance-luck'].onchange({target:{checked:false}});
balanceNodes['balance-shuffle'].onchange({target:{checked:false}});
balanceNodes['balance-identity'].onchange({target:{checked:false}});
assert.deepEqual(GAME_FLAGS, {luckRate:1.0,shuffleArrival:false,shuffleIdentity:false,dailyTickets:null,careerStage:null,unlockedBadges:null,solvedScenarios:null,soundEnabled:true,soundVolume:0.55}, '調整コンソールから運なし・定義順へ切り替わらない');
balanceNodes['balance-luck'].onchange({target:{checked:true}});
balanceNodes['balance-shuffle'].onchange({target:{checked:true}});
balanceNodes['balance-identity'].onchange({target:{checked:true}});
assert.deepEqual(GAME_FLAGS, {luckRate:0.9,shuffleArrival:true,shuffleIdentity:true,dailyTickets:null,careerStage:null,unlockedBadges:null,solvedScenarios:null,soundEnabled:true,soundVolume:0.55}, '調整コンソールから運あり・シャッフルへ戻せない');
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
assert.deepEqual(SCENARIOS.map(s => s.id), ['S1','S2','S3','S4','S5','S6','S7','S8','S9','S10','S11','S12','S13','S14'], 'シャッフルOFFの定義順が確定登場順と違う');

// §15/§25: 1シフトは全案件から重複なく2〜5件を選び、到着を先頭枠へ詰める。
const dailyCountSource = functionSource('dailyTicketCount');
const dailyTicketCount = new Function(dailyCountSource + '\nreturn dailyTicketCount;')();
const prepareDailyScenarios = new Function(
  'shuffleScenarios','dailyTicketCount','assignScenarioIdentities',
  functionSource('prepareDailyScenarios') + '\nreturn prepareDailyScenarios;'
)(shuffleScenarios, dailyTicketCount, scenarios => scenarios);
const randomCounts = [0,.249999,.25,.5,.999999].map(value => dailyTicketCount(() => value, {dailyTickets:null}));
assert.deepEqual(randomCounts, [2,2,3,4,5], 'ランダムな1日件数が2〜5の境界に収まらない');
assert(new Set(randomCounts).size === 4, '1日件数が日によって変わらない');

const dailyFlags = count => ({dailyTickets:count,shuffleArrival:true});
[2,3,4,5].forEach(count => {
  const selected = prepareDailyScenarios(SCENARIOS, () => .37, dailyFlags(count));
  assert.equal(selected.length, count, count + '件固定で選択数が一致しない');
  assert.equal(new Set(selected.map(scenario => scenario.id)).size, count, '日次案件の選択に重複がある');
  assert.deepEqual(selected.map(scenario => scenario.arrive), SCENARIOS.slice(0,count).map(scenario => scenario.arrive), '選択件数ぶんの到着時刻が先頭枠へ詰められていない');
});
assert.deepEqual(prepareDailyScenarios(SCENARIOS, () => .9, {dailyTickets:2,shuffleArrival:false}).map(s => s.id), ['S1','S2'], '登場順OFFで日次案件を決定論的に固定できない');
assert.throws(() => dailyTicketCount(() => 0, {dailyTickets:1}), /2〜5/, 'dailyTicketsの範囲外を拒否しない');

const queue21Source = functionSource('renderQueue');
const world21Source = functionSource('renderWorldStrip');
assert(queue21Source.includes('state.tickets.filter') && world21Source.includes('state.tickets.filter') && functionSource('renderOffice').includes('state.tickets.filter'), '未選択案件が待機・世界地図から除外されない');

let shiftReportCalls = 0;
const checkShiftEnd = new Function('state','playShiftEndSound','renderReport','enterOffice', functionSource('checkShiftEnd') + '\nreturn checkShiftEnd;')(
  {tickets:[{state:'closed'},{state:'closed'}],phase:'office'}, () => {}, () => { shiftReportCalls++; }, () => {}
);
checkShiftEnd();
assert.equal(shiftReportCalls, 1, '2件の日を全件終えてもシフト終了レポートへ到達しない');

const metricsForTwo = new Function('state', functionSource('metrics') + '\nreturn metrics;')({tickets:[
  {result:{kind:'closed',csat:5,firstCallResolved:true},callMinutes:2},
  {result:{kind:'abandoned',csat:0,firstCallResolved:false},callMinutes:0},
]});
const twoMetrics = metricsForTwo();
assert.deepEqual([twoMetrics.finished.length,twoMetrics.answered.length,twoMetrics.abandoned,twoMetrics.answerRate,twoMetrics.aht], [2,1,1,.5,2], 'レポート集計がその日の実件数で計算されない');

const reportSheet = {innerHTML:''};
const twoTicketState = {tickets:[{escUsed:false},{escUsed:false}],report:null,clock:22 * 60};
const renderTwoTicketReport = new Function(
  'state','SCENARIOS','reportOptions','metrics','$','fmtClock','esc','totalCost','openSheet',
  functionSource('renderReport') + '\nreturn renderReport;'
)(twoTicketState, SCENARIOS, () => ({special:[],handoff:[]}), () => ({abandoned:0,aht:null}), () => reportSheet, () => '22:00', String, () => 0, () => {});
renderTwoTicketReport();
assert(reportSheet.innerHTML.includes('対応件数 2件') && reportSheet.innerHTML.includes('該当する特記事項はありません。'), '2件の日のレポートが件数と空項目を成立させて表示しない');
assert(functionSource('careerBriefingHtml').includes("state.tickets.length + '件</b>'") && functionSource('renderReport').includes("state.tickets.length + '件"), '当日の実件数がブリーフィングとレポートに表示されない');
assert(Object.prototype.hasOwnProperty.call(GAME_FLAGS, 'dailyTickets') && GAME_FLAGS.dailyTickets === null, 'GAME_FLAGSから日次件数を固定できない');

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
assert(pendingBranch.includes('pendingTypedLine(t)') && pendingBranch.includes('pendingResultButtonLabel(t.pendingResult)'), '解決後に顧客発話待ちと経路別終話ボタンだけが残らない');
assert(!/data-command|data-greet|renderCommandMenu|renderCallback/.test(pendingBranch), '解決後も別の操作ができる');
const hangupConfirmSource = functionSource('renderHangupConfirmation');
assert(hangupConfirmSource.includes('unresolvedHangupGuide(t)'), '未解決終話の確認が次の一手ガイドを表示しない');
const routeHangup = functionSource('handleCallNavigation');
const hangupBranch = routeHangup.slice(routeHangup.indexOf('if (d.hangup){'), routeHangup.indexOf('if (d.hangupConfirm)'));
assert(hangupBranch.includes("defaultUi('hangup_confirm')") && !hangupBranch.includes('interruptCall('), '未解決の電話を確認なしで切れる');
const interruptSource = functionSource('interruptCall');
const finishInterruptedSource = functionSource('finishInterruptedCall');
assert(interruptSource.includes('addStress(t, REDIAL_STRESS)'), '途中切断で+25×顧客係数のストレスが加算されない');
assert(finishInterruptedSource.includes("t.state = 'waiting'") && finishInterruptedSource.includes('t.arrivedTurn = state.turn'), '途中切断した顧客がすぐ再着信しない');
assert(finishInterruptedSource.includes('t.greeted = false') && finishInterruptedSource.includes('t.redialOpening = redialOpening(t)'), '再着信の名乗りと専用第一声がリセットされない');
assert(!/\.facts\s*=|identified\s*=\s*false|asked\s*=/.test(interruptSource + finishInterruptedSource), '途中切断で収集済みの事実・本人特定・質問履歴を消している');
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
assert(game.includes("return t.transcript.find(x => (x.who === 'cust' || x.who === 'front' || x.who === 'sys') && !x.typed);"), '未表示行を会話順に選んでいない');
assert(game.includes('const pending = pendingTypedLine(t);'), '文字送り対象の行を固定していない');
assert(game.includes('const typing = l === pending;'), '複数の未表示行を同時に typing にしている');
assert(game.includes("if ((l.who === 'cust' || l.who === 'front' || l.who === 'sys') && !l.typed && l !== pending) return '';"), '順番待ちの発話を先読み表示している');

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
assert(functionSource('advanceConversationFlow').includes('endAngryCall(t, reason)'), '誤診2回目がストレス100と同じ終話経路を使わない');

const angryEndSource = functionSource('endAngryCall');
assert(!angryEndSource.includes('farewellLine') && !angryEndSource.includes('FAREWELL_LINES'), 'クレーム／切断のあとに別れの言葉を追加している');
function runAngryEnd(type, expected){
  const ticket = { s:{type}, state:'open', transcript:[] };
  const angryState = {ui:null};
  const run = new Function(
    'ANGRY_DEFAULT_OUTCOMES','ANGRY_END_LINES','CALL_FLOW_LINES','rollLuck','pushFlowLines','state','defaultUi','render',
    angryKindSource + '\n' + angryEndSource + '\nreturn endAngryCall;'
  )(
    ANGRY_DEFAULT_OUTCOMES, ANGRY_END_LINES, CALL_FLOW_LINES, () => expected,
    (t,lines) => lines.forEach(line => t.transcript.push({who:line.who,text:line.text})),
    angryState, () => ({}), () => {}
  );
  run(ticket, 'stress');
  return { ticket, closed:ticket.pendingResult };
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
  ['苛立ち警告', functionSource('renderStressPanel'), "t.stress > 80 ? ' alert'"],
  ['怒り終話', changeStressSource, "endAngryCall(t, 'stress')"],
  ['危険操作の悪化', functionSource('doTest'), '【まずい対応】'],
  ['操作結果', functionSource('doTest'), '操作結果：'],
  ['対処の前提不足', functionSource('renderCloseFlow'), "const sub = block || r.sub || ''"],
  ['配送手配中断', functionSource('startShipping'), '配送先が未確認です。手配を中断して滞在先を確認します。'],
  ['配送確定', functionSource('confirmShipment'), 'TGX ' + "' + level.label + '" + 'の手配を確定しました。'],
  ['クローズ前提不足', closeSource, 'const blocked = remedyBlockReason(t, remedy)'],
  ['誤診2回目', closeSource, "pendingConversation = { kind:'second_misdiagnosis'"],
  ['未解決', closeSource, '原因の見立てが外れていました。もう一度切り分けをやり直せます。'],
  ['対応結果確定', closeSource, '対応結果が確定しました。電話を切って終話してください。'],
  ['クローズ結果', functionSource('closeTicket'), "result.label + ' CSAT ' + result.csat.toFixed(1)"],
  ['再着信', finishInterruptedSource, "recordOfficeEvent('redial'"],
];
assert.equal(informationMappings.length, 17, '現行トースト移行表が17件ではない');
informationMappings.forEach(([name, source, marker]) => assert(source.includes(marker), name + 'の情報が状態表示・会話メモ・無効理由へ移っていない'));
const stateStressPanelSource = functionSource('renderStressPanel');
assert(stateStressPanelSource.includes("t.stress > 80 ? ' alert' : ''"), '苛立ち80超で点滅クラスが付かない');
assert(!game.includes('stressWarned'), '苛立ちが80以下へ戻ったあと再び超えても点滅を再開できない');
assert(functionSource('renderCloseFlow').includes("const sub = block || r.sub || ''"), 'ブロックされた対処の無効化と理由表示が揃っていない');
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
  ['受話', pickupSource, 'playPickupSound()'],
  ['切断', functionSource('closeTicket') + interruptSource + finishInterruptedSource, 'playDisconnectSound()'],
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

// §21: 会話の継ぎ目は、終話・照会・途中切断を発話でつなぐ。
const endingTickets = [correctExpected, satisfiedRefund.ticket, dissatisfiedRefund.ticket, complaintEnd.ticket, hangupEnd.ticket];
assert(endingTickets.every(ticket => ticket.state === 'open' && ticket.pendingResult), '5経路のいずれかが顧客の最後の台詞より先に終話する');
assert(pendingBranch.includes("if (pendingTypedLine(t))") && pendingBranch.indexOf("if (pendingTypedLine(t))") < pendingBranch.indexOf('renderHangupButton('), '顧客の最後の台詞が表示され切る前に終話ボタンが出る');

const pendingLabelSource = functionSource('pendingResultButtonLabel');
const pendingResultButtonLabel = new Function(pendingLabelSource + '\nreturn pendingResultButtonLabel;')();
assert.deepEqual(['closed','refunded','refunded','complaint','hangup'].map(kind => pendingResultButtonLabel({kind})), ['電話を切る','電話を切る','電話を切る','オフィスへ戻る','オフィスへ戻る'], '5経路の終話ボタン文言が違う');

assert.deepEqual(CALL_FLOW_LINES.ending, {
  refundSatisfied:'ご理解いただき、ありがとうございます。失礼いたします。',
  refundDissatisfied:'重ねてお詫び申し上げます。失礼いたします。',
  complaint:'申し訳ございません。いただいたご意見は必ず——',
  hangup:'お客様……？ 申し訳ございません、失礼いたします。',
}, '返金・クレーム・一方的切断の締めが確定本文と違う');
assert(endingTickets.every(ticket => ticket.transcript.slice(-3).some(line => line.who === 'me')), '5経路のいずれかで最後付近にオペレーター発話がない');

const misdiagnosisSource = functionSource('doClose');
const flowAdvanceSource = functionSource('advanceConversationFlow');
const treatmentIndex = misdiagnosisSource.indexOf("text:'【' + toneLabel(toneId) + '】' + remedy.label");
const failureIndex = misdiagnosisSource.indexOf('CALL_FLOW_LINES.misdiagnosis.failure');
const apologyIndex = misdiagnosisSource.indexOf('CALL_FLOW_LINES.misdiagnosis.apology');
const stagedIndex = misdiagnosisSource.indexOf("pendingConversation = { kind:'second_misdiagnosis'");
assert(treatmentIndex >= 0 && treatmentIndex < failureIndex && failureIndex < apologyIndex && apologyIndex < stagedIndex && flowAdvanceSource.includes('endAngryCall(t, reason)'), '誤診2回目が「対処→不調報告→謝罪→最終怒り」の順ではない');

const lookupStartSource = functionSource('doLookup');
const lookupFinishSource = functionSource('finishLookup');
assert(lookupStartSource.includes('CALL_FLOW_LINES.lookup.holdStart') && lookupStartSource.includes('CALL_FLOW_LINES.lookup.talkStart') && lookupFinishSource.includes('CALL_FLOW_LINES.lookup.holdComplete') && lookupFinishSource.includes('CALL_FLOW_LINES.lookup.talkComplete'), '社内照会の開始と完了の合図が発話で揃わない');
// §40: 調べただけで結果の中身まで客へ喋らない。何を伝えるかは「伝える」で選ぶ。
assert(!lookupFinishSource.includes('r.fact ? r.fact.text') && !lookupFinishSource.includes('l.spoken') && !lookupFinishSource.includes('completePrefix'), '照会しただけで結果の中身を客へ発話している');
assert(CALL_FLOW_LINES.lookup.holdComplete && CALL_FLOW_LINES.lookup.talkComplete && CALL_FLOW_LINES.lookup.holdComplete !== CALL_FLOW_LINES.lookup.talkComplete, '§40 照会完了の合図が保留・通話中で揃っていない');
const conversationRecordSource = functionSource('openRecord');
assert(conversationRecordSource.includes('CALL_FLOW_LINES.recordStart') && !conversationRecordSource.includes('completePrefix') && !conversationRecordSource.includes('お待たせしました'), '会話記録の確認が開始文だけではない');

const greetSource = functionSource('greetCurrentCustomer');
assert(interruptSource.includes('CALL_FLOW_LINES.interrupt') && interruptSource.includes('オペレーターが対応途中で切断しました。') && finishInterruptedSource.includes('t.redialGreeting = true') && greetSource.includes('CALL_FLOW_LINES.redialGreeting'), '途中切断の発話・能動態note・専用再入電挨拶が揃わない');

const resolutionReplyIndex = closeSource.indexOf('pushCustomerLine(t, resolutionReply');
const resolutionCloseIndex = closeSource.indexOf('resolutionOperatorClosing(grade, causeMatched)');
const farewellIndex = closeSource.indexOf('pushCustomerLine(t, farewellLine(s, grade)');
assert(resolutionReplyIndex >= 0 && resolutionReplyIndex < resolutionCloseIndex && resolutionCloseIndex < farewellIndex, '通常解決が「客の解決確認→オペレーターの締め→客の別れ」の順ではない');
assert.deepEqual(['best','partial','recovered'].map(key => CALL_FLOW_LINES.resolved[key]), [
  '復旧をご確認いただき、ありがとうございます。',
  'ご不便を残しますが、この方法でお願いいたします。',
  '復旧を確認できました。ご協力ありがとうございました。',
], '通常解決の3種類の締めが揃わない');

const addedSpeech = [];
const collectSpeech = value => {
  if (typeof value === 'string') addedSpeech.push(value);
  else if (value && typeof value === 'object') Object.values(value).forEach(collectSpeech);
};
collectSpeech(CALL_FLOW_LINES);
SCENARIOS.forEach(scenario => Object.values(scenario.lookups || {}).forEach(result => {
  if (result && result.text) addedSpeech.push(CALL_FLOW_LINES.lookup.completePrefix + (result.fact ? result.fact.text : result.text));
}));
assert(addedSpeech.every(text => dialogueDuration(text) <= 4000), '§21で追加した発話がtyping_budgetの4秒上限を超えている');

const pushFlowSource = functionSource('pushFlowLines');
const pushFlowLinesContract = new Function('pushCustomerLine', pushFlowSource + '\nreturn pushFlowLines;')((t,text) => t.transcript.push({who:'cust',text}));
assert.throws(() => pushFlowLinesContract({transcript:[]}, [{who:'me',text:'1'},{who:'cust',text:'2'},{who:'me',text:'3'}]), /最大2行/, '1操作の追加発話を2行以内に制限できない');
assert(!functionSource('doTest').includes('CALL_FLOW_LINES'), '操作（テスト）へ不要な追加発話が入っている');

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

// §22: ブラウザ内に残るキャリア記録。
const careerLogicNames = ['freshCareerRecord','normalizeCareerRecord','validCareerRecord','careerWithFlags','solvedScenarioIdsFromTickets','careerEndingQueue','gradeAtLeast','promotedCareerStage','earnedBadgeIds','appendCareerShift'];
const careerLogic = careerLogicNames.map(functionSource).join('\n') + '\nreturn {freshCareerRecord,normalizeCareerRecord,validCareerRecord,careerWithFlags,solvedScenarioIdsFromTickets,careerEndingQueue,gradeAtLeast,promotedCareerStage,earnedBadgeIds,appendCareerShift};';
const careerFns = new Function('CAREER_VERSION','CAREER_STAGES','CAREER_BADGES','GAME_FLAGS','SCENARIOS', careerLogic)(CAREER_VERSION,CAREER_STAGES,CAREER_BADGES,GAME_FLAGS,SCENARIOS);
const baseShift = (grade='B', complaints=0, endedAt='2026-09-01T00:00:00.000Z') => ({
  endedAt, tickets:2, grade, scores:{csat:4,fcr:1,answer:1,cost:100,report:1}, complaints,
});
const readCareerRecord = new Function('getCareerStorage','freshCareerRecord','normalizeCareerRecord','validCareerRecord','CAREER_STORAGE_KEY', functionSource('readCareerRecord') + '\nreturn readCareerRecord;')(
  () => null, careerFns.freshCareerRecord, careerFns.normalizeCareerRecord, careerFns.validCareerRecord, CAREER_STORAGE_KEY
);
const writeCareerRecord = new Function('getCareerStorage','CAREER_STORAGE_KEY','JSON', functionSource('writeCareerRecord') + '\nreturn writeCareerRecord;')(
  () => null, CAREER_STORAGE_KEY, JSON
);

// §22-8 検査1: localStorageが例外でも初期記録で続行し、書き込み失敗もfalseで閉じる。
const throwingStorage = {getItem(){ throw new Error('denied'); },setItem(){ throw new Error('denied'); }};
assert.deepEqual(readCareerRecord(throwingStorage), careerFns.freshCareerRecord(), 'localStorage読取例外でゲームを継続できない');
assert.equal(writeCareerRecord(careerFns.freshCareerRecord(), throwingStorage), false, 'localStorage書込例外を安全に閉じない');

// §22-8 検査2: 壊れたJSON・想定外shape・異版はすべて新規扱い。
const wrongVersionRecord = careerFns.freshCareerRecord(); wrongVersionRecord.version = 2;
for (const raw of ['{broken', JSON.stringify({version:1,shifts:'wrong'}), JSON.stringify(wrongVersionRecord)]){
  assert.deepEqual(readCareerRecord({getItem:() => raw}), careerFns.freshCareerRecord(), '不正な保存記録を新規扱いにできない');
}
const legacyCareerRecord = careerFns.freshCareerRecord();
legacyCareerRecord.totals.days = 4;
delete legacyCareerRecord.solvedScenarios;
delete legacyCareerRecord.secretEnding;
const migratedCareerRecord = readCareerRecord({getItem:() => JSON.stringify(legacyCareerRecord)});
assert.equal(migratedCareerRecord.totals.days,4,'§28 旧v1勤務記録の通算日数を移行できない');
assert.deepEqual(migratedCareerRecord.solvedScenarios,[],'§28 旧v1勤務記録へsolvedScenarios初期値を補えない');
assert.equal(migratedCareerRecord.secretEnding,false,'§28 旧v1勤務記録へsecretEnding初期値を補えない');

// §22-8 検査3: 記録なしは1日目。
assert.equal(careerFns.freshCareerRecord().totals.days + 1, 1, '初回が1日目にならない');
assert(functionSource('careerBriefingHtml').includes("career.totals.days + 1") && functionSource('careerBriefingHtml').includes('このブラウザ内だけに保存'), 'ブリーフィングに日数と保存範囲がない');

// §22-8 検査4: 31件目で最古だけを落とす。
let thirtyOne = careerFns.freshCareerRecord();
for (let day=1; day<=31; day++) thirtyOne = careerFns.appendCareerShift(thirtyOne, baseShift('B',0,new Date(Date.UTC(2026,0,day)).toISOString()), {maxStresses:[80,80],redials:1,abandoned:0,resultKinds:['closed','closed'],noRefundsOrShipments:false,allResolved:false,allRefunded:false}).career;
assert.equal(thirtyOne.shifts.length, 30, '保存シフトが直近30件に丸められない');
assert.equal(thirtyOne.shifts[0].endedAt, new Date(Date.UTC(2026,0,2)).toISOString(), '31件目で最古のシフト以外を落としている');

// §22-8 検査5: 通算値と既得バッジは30件の丸め込み後も残る。
assert.equal(thirtyOne.totals.days, 31, '30件丸め込みで通算日数まで失われる');
const persistentBadge = careerFns.freshCareerRecord(); persistentBadge.badges=['frugal'];
assert(careerFns.appendCareerShift(persistentBadge,baseShift(),{maxStresses:[80,80],redials:1,abandoned:0,resultKinds:['closed'],noRefundsOrShipments:false,allResolved:false,allRefunded:false}).career.badges.includes('frugal'), '既得バッジが次のシフトで失われる');

// §22-8 検査6: 昇格境界。B,B,Cでは本採用にはなれるが、リーダーにはなれない。
assert.equal(careerFns.promotedCareerStage('probation',3,[baseShift('B'),baseShift('B'),baseShift('C')]),'employed','試用期間の3日境界で本採用にならない');
assert.equal(careerFns.promotedCareerStage('employed',6,[baseShift('B'),baseShift('B'),baseShift('C')]),'employed','B,B,Cでリーダーへ上がる');
assert.equal(careerFns.promotedCareerStage('employed',6,[baseShift('B'),baseShift('A'),baseShift('S')]),'lead','直近3回B以上でリーダーにならない');

// §22-8 検査7: リーダーが最高位で、降格しない。
assert.equal(careerFns.promotedCareerStage('lead',40,[baseShift('D'),baseShift('E'),baseShift('D')]),'lead','リーダーから降格する');
assert.deepEqual(Object.keys(CAREER_STAGES),['probation','employed','lead'],'キャリア段階が3段階から変わっている');

// §22-8 検査8: 8バッジの条件を全て判定し、既得分を保持する。
const badgeCareer = careerFns.freshCareerRecord();
badgeCareer.totals.days=5; badgeCareer.shifts=[baseShift('B'),baseShift('B')];
const badgeShift = baseShift();
const requiredCareerBadges = ['quiet_night','no_redial','frugal','all_first','storm','money_talks','ten_nights','clean_record'];
assert.deepEqual(careerFns.earnedBadgeIds(badgeCareer,badgeShift,{maxStresses:[70,40],redials:0,abandoned:0,resultKinds:['complaint','hangup'],noRefundsOrShipments:true,allResolved:true,allRefunded:true}).sort(), requiredCareerBadges.sort(), '8バッジの条件判定が揃わない');

// §22-8 検査9: graduateという段階・バッジを作らない。
assert(!game.includes("id:'graduate'") && !CAREER_BADGES.some(badge => badge.id === 'graduate'), '卒業バッジまたは卒業段階がある');

// §22-8 検査10: 終了画面に段階・日数・直近5回・次条件・バッジ数・NEWが出る。
const careerDebriefSource = functionSource('careerDebriefHtml');
for (const token of ['career.stage','totals.days','slice(-5)','stage.condition','career.badges.length','badge-new','NEW']) assert(careerDebriefSource.includes(token), '勤務記録UIに必要項目がない: ' + token);

// §22-8 検査11: 未取得バッジも条件文つきで表示する。
assert(careerDebriefSource.includes("'未取得'") && careerDebriefSource.includes('badge.condition'), '未取得バッジの条件が表示されない');

// §22-8 検査12: 昇格バナーは終了レポート上部に置く。
const careerDebriefIndex = functionSource('renderDebrief').indexOf('careerDebriefHtml()');
assert(careerDebriefSource.includes('promotion-banner') && careerDebriefIndex >= 0 && careerDebriefIndex < functionSource('renderDebrief').indexOf("'<h1>シフト終了"), '昇格バナーが終了レポート上部にない');

// §22-8 検査13: ミュートでも昇格・バッジ表示は音声処理から独立して残る。
assert(!careerDebriefSource.includes('soundEnabled') && functionSource('recordCurrentCareerShift').includes('playPromotionSound') && functionSource('recordCurrentCareerShift').includes('playBadgeSound'), 'ミュート時にキャリア表示まで消える');

// §22-8 検査14: GAME_FLAGSで段階とバッジを固定できる。
const forcedCareer = careerFns.careerWithFlags(careerFns.freshCareerRecord(),{careerStage:'lead',unlockedBadges:['storm','frugal']});
assert.equal(forcedCareer.stage,'lead','GAME_FLAGSで段階を固定できない');
assert.deepEqual(forcedCareer.badges,['storm','frugal'],'GAME_FLAGSでバッジを固定できない');

// §22-8 検査15: 一度の確認後に保存とセッションを消し、1日目へ戻す。
const clearCareerSource = functionSource('clearCareerRecord');
assert.equal((clearCareerSource.match(/window\.confirm/g)||[]).length,1,'勤務記録消去の確認回数が1回ではない');
assert(clearCareerSource.includes('removeItem(CAREER_STORAGE_KEY)') && clearCareerSource.includes('freshCareerRecord()') && clearCareerSource.includes('showBriefing()'), '勤務記録消去後に1日目へ戻れない');

// §28-5 検査1〜2: 表は全案件の解決で発火し、1件不足では発火しない。
const scenarioIds28 = SCENARIOS.map(scenario => scenario.id);
const surfaceRecord28 = careerFns.freshCareerRecord(); surfaceRecord28.solvedScenarios=scenarioIds28.slice(0,-1);
const neutralContext = {maxStresses:[80,80],redials:1,abandoned:0,resultKinds:['closed'],noRefundsOrShipments:false,allResolved:false,allRefunded:false,solvedScenarioIds:[]};
const surfaceUpdate28 = careerFns.appendCareerShift(surfaceRecord28,baseShift(),Object.assign({},neutralContext,{solvedScenarioIds:[scenarioIds28.at(-1)]}));
assert.deepEqual(surfaceUpdate28.endingQueue,['career'],'§28 全案件を解決しても表エンディングへ進まない');
assert.deepEqual(careerFns.appendCareerShift(surfaceRecord28,baseShift(),neutralContext).endingQueue,[],'§28 1件不足で表エンディングへ進む');

// §28-5 検査3〜5: 失客は数えず、closedと満足返金だけを重複なしで数える。
const solvedTickets28 = [
  {s:{id:'S1'},result:{kind:'closed'}},
  {s:{id:'S1'},result:{kind:'closed'}},
  {s:{id:'S2'},result:{kind:'refunded',satisfied:true}},
  {s:{id:'S3'},result:{kind:'refunded',satisfied:false}},
  {s:{id:'S4'},result:{kind:'complaint'}},
  {s:{id:'S5'},result:{kind:'hangup'}},
  {s:{id:'S6'},result:{kind:'abandoned'}},
];
assert.deepEqual(careerFns.solvedScenarioIdsFromTickets(solvedTickets28),['S1','S2'],'§28 解決・満足返金以外を数える、または同じ案件を重複して数える');

// §28-5 検査6: 直近30シフトを丸めても解決済み集合は捨てない。
const persistentSolved28 = JSON.parse(JSON.stringify(thirtyOne)); persistentSolved28.solvedScenarios=scenarioIds28.slice(0,4);
const persistentSolvedUpdate28 = careerFns.appendCareerShift(persistentSolved28,baseShift(),Object.assign({},neutralContext,{solvedScenarioIds:['S5']}));
assert.deepEqual(persistentSolvedUpdate28.career.solvedScenarios,['S1','S2','S3','S4','S5'],'§28 solvedScenariosが30日制限で捨てられる');
const duplicateSolved28 = careerFns.freshCareerRecord(); duplicateSolved28.solvedScenarios=['S1'];
assert.deepEqual(careerFns.appendCareerShift(duplicateSolved28,baseShift(),Object.assign({},neutralContext,{solvedScenarioIds:['S1']})).career.solvedScenarios,['S1'],'§28 保存済みの同じ案件を重複して数える');

// §28-5 検査7〜11: 裏は8バッジ、両方同時なら表→裏、一度見た側は再発火しない。
const endingRecord = careerFns.freshCareerRecord(); endingRecord.badges=CAREER_BADGES.map(b=>b.id);
const sevenRecord = careerFns.freshCareerRecord(); sevenRecord.badges=CAREER_BADGES.slice(0,7).map(b=>b.id);
assert.deepEqual(careerFns.appendCareerShift(endingRecord,baseShift(),neutralContext).endingQueue,['secret'],'§28 8バッジで裏エンディングへ進まない');
assert.deepEqual(careerFns.appendCareerShift(sevenRecord,baseShift(),neutralContext).endingQueue,[],'§28 7バッジで裏エンディングへ進む');
const bothRecord28 = careerFns.freshCareerRecord(); bothRecord28.badges=CAREER_BADGES.map(b=>b.id); bothRecord28.solvedScenarios=scenarioIds28;
assert.deepEqual(careerFns.appendCareerShift(bothRecord28,baseShift(),neutralContext).endingQueue,['career','secret'],'§28 同じ夜に両条件を満たしても表→裏の順にならない');
const bothSeen28 = JSON.parse(JSON.stringify(bothRecord28)); bothSeen28.ending=true; bothSeen28.secretEnding=true;
assert.deepEqual(careerFns.appendCareerShift(bothSeen28,baseShift(),neutralContext).endingQueue,[],'§28 見た表・裏エンディングが次の夜にも自動再生される');

// §23/§28: 報告提出時ではなく終了レポートを閉じた後に、キューから開始する。
assert(!functionSource('submitReport').includes('showCareerEnding') && functionSource('renderDebrief').includes('state.careerUpdate.endingQueue.length') && functionSource('renderDebrief').includes('showNextCareerEnding()'), '§28 エンディングが終了レポートを閉じる前に始まる');

// §23-6 検査3: 表の閲覧時にending=trueを保存する。
const endingSource = functionSource('showCareerEnding');
assert(endingSource.includes('state.career.ending = true') && endingSource.includes('writeCareerRecord(state.career)'), 'エンディング閲覧済みを保存しない');
const secretEndingSource28 = functionSource('showSecretEnding');
assert(secretEndingSource28.includes("showCareerEnding(replay, 'secret')") && !secretEndingSource28.includes('準備中'), '§28 裏エンディングが表と同じ演出を再生しない');
assert(endingSource.includes("endingType === 'secret'") && endingSource.includes('state.career.secretEnding = true') && endingSource.includes('writeCareerRecord(state.career)'), '§28 裏エンディング閲覧済みを保存しない');
const endingEyebrowSource28 = functionSource('careerEndingEyebrowHtml');
assert(endingEyebrowSource28.includes("state.endingType === 'secret'") && endingEyebrowSource28.includes('aria-label="裏エンディング">裏</span>') && endingEyebrowSource28.includes('THE NEXT MORNING ／ ALL-HANDS MEETING'), '§28 同じ朝礼演出の裏エンディングに小さな印がない');
assert(functionSource('continueAfterCareerEnding').includes("if (next === 'secret'){ showSecretEnding(false); return; }"), '§28 表の後に裏エンディングへ続かない');

// §23/§28: ゲーム調整から表・裏を明示的に再生できる。
assert(balanceConsoleSource.includes('balance-replay-ending') && balanceConsoleSource.includes('showCareerEnding(true)') && balanceConsoleSource.includes('balance-replay-secret-ending') && balanceConsoleSource.includes('showSecretEnding(true)'), '§28 ゲーム調整から表・裏エンディングを見返せない');

// §23-6 検査5: 同じオフィスを朝パレットで再描画する。
assert(functionSource('drawMorningOffice').includes("drawOfficePixelArt(false, 'ending-office-canvas', MORNING_OFFICE_PALETTE)"), '朝のオフィスが夜景のパレット差し替えになっていない');

// §23-6 検査6: 表示名は「社長」だけで、特定人物・企業を示す実装名を置かない。
assert(endingSource.includes('<b>社長</b>') && !/代表取締役|モデル企業|実名/.test(viewSource + '\n' + gameLogicSource + '\n' + fs.readFileSync(__dirname + '/p2_data.js','utf8')), '社長表示または匿名化契約が崩れている');

// §23-6 検査7: 確定文を一字一句そのまま表示する。
const approvedPresidentLine = 'ハードワークご苦労様です。あなたが身を粉にして、お値段以上に顧客第一で働いてくれたことを感謝します。明日からもまた夜勤を頑張ってください';
assert.equal(PRESIDENT_ENDING_LINE,approvedPresidentLine,'社長の確定文が完全一致しない');

// §23-6 検査8: 通算成績と8バッジをまとめて見せる。
const endingDetailsSource = functionSource('careerEndingDetailsHtml');
assert(endingDetailsSource.includes('totals.days') && endingDetailsSource.includes('totals.averageCsat') && endingDetailsSource.includes('totals.complaints') && functionSource('endingBadgeHtml').includes('CAREER_BADGES.map'), 'エンディングに通算成績と8バッジが揃わない');

// §23-6 検査9: ミュートでも朝景・社長・戻るボタンは描画される。
assert(!endingSource.includes('soundEnabled') && endingSource.includes('drawMorningOffice()') && functionSource('careerEndingFinalHtml').includes('ending-back-to-shift'), 'ミュート時にエンディング画面が成立しない');

// §28-5 検査12〜13: レポートは解決数だけを示し、GAME_FLAGSから表・裏の条件を再現できる。
assert(careerDebriefSource.includes("解決した案件 ' + career.solvedScenarios.length + ' / ' + SCENARIOS.length") && !careerDebriefSource.includes('SCENARIOS.map') && !careerDebriefSource.includes('scenario.name'), '§28 レポートが解決数を出さない、または未解決案件名を漏らす');
const forcedEnding = careerFns.careerWithFlags(careerFns.freshCareerRecord(),{careerStage:null,unlockedBadges:CAREER_BADGES.map(b=>b.id),solvedScenarios:scenarioIds28});
assert.deepEqual(careerFns.careerEndingQueue(forcedEnding),['career','secret'],'§28 GAME_FLAGSから表・裏エンディングを再現できない');

// §23-6 検査11: 初期DOMには空の発話欄だけを置き、全文を一度に表示しない。
assert(endingSource.includes('class="ending-line line typing"') && endingSource.includes('<span class="say"></span>') && !endingSource.includes('esc(PRESIDENT_ENDING_LINE)'), '社長の台詞が1文字ずつではなく一度に全文表示される');

// §23-6 検査12: 顧客と同じstartTypingを使い、専用速度を持たない。
assert(endingSource.includes('startTyping(state.endingSpeech)') && functionSource('startTyping').includes("/[、。！？!?]/.test(line.text[pos - 1]) ? 175 : 25") && !/ending[^\n]{0,80}(?:setTimeout|25|175)/i.test(endingSource), '社長の台詞が顧客と同じstartTyping速度を通らない');
assert.equal(dialogueDuration(PRESIDENT_ENDING_LINE),2225,'社長の68文字台詞がtyping_budgetの実測2.225秒と一致しない');

// §23-6 検査13: 完了前DOMから通算・バッジ・戻るを外し、完了後だけ追加する。
for (const token of ['ending-totals','ending-badge-grid']) assert(!endingSource.includes(token) && endingDetailsSource.includes(token), '社長の台詞完了前に後続要素が現れる: ' + token);
assert(!endingSource.includes('ending-back-to-shift') && functionSource('careerEndingFinalHtml').includes('ending-back-to-shift'), '社長の台詞完了前に後続要素が現れる: ending-back-to-shift');
assert(!endingSource.includes('careerEndingDetailsHtml('), '社長の台詞完了前に後続要素が現れる: ending-totals');
assert(functionSource('finishTyping').includes("if (state.phase === 'ending'){ renderCareerEndingComplete(skipEndingBeat); return; }"), '社長の台詞完了後に後続要素を開示しない');

// §23-6 検査14: 全画面クリックの既存作法がtypingLineを即時完了する。
assert(eventSource.includes("if (typingLine){ finishTyping(); return; }"), '社長の台詞をタップで送り切れない');
assert(endingSource.includes('setTimeout(() => startTyping(state.endingSpeech), 0)') && endingSource.includes('tapGuardTimer = setTimeout(clearEndingTapGuard, 400)') && functionSource('finishTyping').includes("state.phase === 'ending' && endingTapGuard") && balanceConsoleSource.includes("$('balance-replay-ending').onclick = event => { event.stopImmediatePropagation(); showCareerEnding(true); };") && balanceConsoleSource.includes("$('balance-replay-secret-ending').onclick = event => { event.stopImmediatePropagation(); showSecretEnding(true); };") && functionSource('renderDebrief').includes('event.stopImmediatePropagation()'), '社長の再生操作自体がタップ送りに誤認される');

// §23-6 検査15: 頭頂部は地肌、髪は左右の側頭部だけで、上をつながない。
const presidentDrawSource = functionSource('drawCompanyPresident');
assert(presidentDrawSource.includes("pixelRect(ctx, p.paper, x + 1, y - 24, 9, 5)") && presidentDrawSource.includes("pixelRect(ctx, p.charcoal, x - 2, y - 21, 3, 8)") && presidentDrawSource.includes("pixelRect(ctx, p.charcoal, x + 10, y - 21, 3, 8)"), '社長の頭頂部地肌と両サイドの髪が描き分けられていない');
assert(!presidentDrawSource.includes("pixelRect(ctx, p.charcoal, x - 1, y - 23, 13, 5)"), '社長の頭頂部を髪が横断している');

// §23-6 検査16: ENDは称号の後、戻るボタンの前に置き、簡潔な文字組みにする。
const endingFinalSource = functionSource('careerEndingFinalHtml');
assert(endingFinalSource.includes('id="ending-end">END</div>') && endingFinalSource.indexOf('ending-end') < endingFinalSource.indexOf('ending-back-to-shift'), 'ENDが称号一覧の下・戻るボタンの上に簡潔に表示されない');
const endingEndCss = page.slice(page.indexOf('.ending-end{'), page.indexOf('}', page.indexOf('.ending-end{')));
assert(/font:800 34px/.test(endingEndCss) && /letter-spacing:\.36em/.test(endingEndCss) && /text-align:center/.test(endingEndCss) && !/border|animation/.test(endingEndCss), 'ENDが大きな中央揃え・字間広めの簡潔な表示でない');

// §23-6 検査17: 通算と称号を描いたDOMには空スロットだけを置き、約1秒後にENDを入れる。
const endingCompleteSource = functionSource('renderCareerEndingComplete');
assert(endingCompleteSource.includes("'<div id=\"ending-finale\"></div>'") && endingCompleteSource.includes('setTimeout(revealCareerEndingFinal, 1000)'), 'ENDが通算成績と称号一覧より約1秒遅れて現れない');

// §23-6 検査18: 戻るボタンはENDと同じ最終開示で、その後ろにある。
assert(functionSource('revealCareerEndingFinal').includes('slot.innerHTML = careerEndingFinalHtml()') && endingFinalSource.indexOf('ending-back-to-shift') > endingFinalSource.indexOf('ending-end'), '戻るボタンがENDより先に現れる');

// §23-6 検査19: タップ完了は一拍を省略し、自然完了だけが待つ。
assert(functionSource('finishTyping').includes('skipEndingBeat = true') && functionSource('startTyping').includes('finishTyping(false)') && endingCompleteSource.includes('if (skipEndingBeat) revealCareerEndingFinal()'), 'タップ送りでENDと戻るボタンまで一度に表示されない');

// §23-6 検査20: 10人全員をデータから描画し、座席の3人だけに戻らない。
assert.equal(MORNING_STAFF.length,10,'エンディングの朝礼に立った社員が10人描かれない');
assert(functionSource('drawMorningStaff').includes('MORNING_STAFF.forEach'), 'エンディングの朝礼に立った社員が10人描かれない');

// §23-6 検査21: 全員をbackで固定し、顔の部品を描かない。
const staffMemberSource = functionSource('drawMorningStaffMember');
assert(MORNING_STAFF.every(staff => staff.facing === 'back') && !/eye|mouth|face/.test(staffMemberSource) && staffMemberSource.includes('後頭部・肩・背中・立ち脚'), '社員が社長を見る後ろ姿になっていない');

// §23-6 検査22: 髪型・髪色・服色・肩幅に複数の見た目を持つ。
assert(new Set(MORNING_STAFF.map(staff => staff.hair)).size >= 3 && new Set(MORNING_STAFF.map(staff => staff.hairColor)).size >= 3 && new Set(MORNING_STAFF.map(staff => staff.coat)).size >= 5 && new Set(MORNING_STAFF.map(staff => staff.shoulders)).size >= 3 && staffMemberSource.includes('p[staff.hairColor]') && staffMemberSource.includes('p[staff.coat]'), '社員の髪型・髪色・服色・肩幅が描き分けられていない');

// §23-6 検査23: プレイヤーを示す専用属性・矢印・ラベル・色分岐を持たない。
assert(!MORNING_STAFF.some(staff => Object.keys(staff).some(key => /player|highlight|arrow|label/i.test(key))) && !/staff\.(?:player|highlight|arrow|label)/i.test(staffMemberSource), 'プレイヤーだけを示す強調表示がある');

// §24-5 検査1: 主コマンドは4つだけで、「操作」「折り返す」を持たない。
assert.deepEqual(COMMAND_DEFS.map(command => [command.id,command.label]), [['ask','聞く'],['lookup','調べる'],['tell','伝える'],['record','ログ']], '§24 主コマンドが4つ（聞く／調べる／伝える／ログ）ではない');

// §24-5 検査2: TESTS 6件とRISKY 3件の内容・所要時間・危険操作の罰を保ち、「伝える」配下へ接続する。
assert.deepEqual(TESTS.map(test => [test.id,test.label,test.turns,test.wait,test.sub || '']), [
  ['t_reboot','ルーターの再起動をご案内する',3,'再起動をお願いしました。立ち上がるまで少しかかります。',''],
  ['t_simout','SIMを抜き差しし、接点を乾いた柔らかい布で清掃していただく',2,'電源はそのままで、SIMの抜き差しと接点の清掃をお願いしました。','No SIM／SIM未認識の表示があるときの重要な復旧操作'],
  ['t_forget','端末のWi-Fi設定を一度削除して、繋ぎ直していただく',3,'設定の削除と再接続をお願いしました。操作していただいています。',''],
  ['t_move','窓際か屋外へ移動して試していただく',4,'場所を移っていただいています。',''],
  ['t_disconnect','使っていない端末をWi-Fiから切っていただく',2,'不要な端末を切っていただいています。',''],
  ['t_charge','付属のケーブルとアダプタで充電していただく',5,'充電をお願いしました。しばらく様子を見ます。',''],
], '§24 TESTS 6項目の内容または所要時間が変わっている');
assert.deepEqual(RISKY.map(test => [test.id,test.label,test.turns,test.wait,test.damage]), [
  ['t_reset','本体を初期化（工場出荷リセット）していただく',2,'初期化をお願いしました。',1.5],
  ['t_apn','スマートフォンのAPN設定を書き換えていただく',2,'端末のAPN設定を開いていただいています。',1.5],
  ['t_roaming','端末のデータローミングをONにしていただく',1,'端末のデータローミング設定を確認していただいています。',1.0],
], '§24 RISKY 3項目の内容・所要時間・罰が変わっている');
assert.deepEqual(RISKY.map(test => [test.id,test.result,test.note]), [
  ['t_reset','（操作後）…あの、画面が英語だらけになって、何も繋がらなくなりました。前より悪くなってませんか？','初期化で回線設定ごと飛んだ。サポート側の指示なく客に踏ませてよい操作ではない。'],
  ['t_apn','（操作後）言われたとおり入れましたけど、何も変わりません。元の設定も分からなくなりました。','レンタルWiFiのAPNはルーター内のSIM側の設定で、客のスマホには関係がない。手元の端末を壊しただけ。'],
  ['t_roaming','（操作後）ONにしました。…変わりません。というか、これ日本の携帯代がかかったりしませんか？','データローミングは自分のキャリア回線を海外で使う設定。Pocket WiFiの復旧策ではなく、高額請求の入口になる。'],
], '§24 RISKY 3項目の結果・注意書きが変わっている');
assert(tellSource.includes('data-tell="try"') && actionsSource.includes('try: () => renderTestOptions(t)') && eventSource.includes("if (d.tell){ state.ui = defaultUi(d.tell)"), '§24 操作9項目が「伝える」→「やってみてもらう」の下にない');

// §24-5 検査3: 危険操作を正解対処の前提にしない。
const riskyIds24 = new Set(RISKY.map(test => test.id));
assert(Object.values(REMEDIES).flat().every(remedy => !riskyIds24.has(remedy.needsTest)), '§24 危険な操作が初手の正解になっている');

// §24-5 検査4・5: hurriedだけは名乗らず進め、ほかの客は名乗りを必須にする。
assert(actionsSource.includes('if (!t.greeted && !customerHasSpoken(t)) return') && openingDeliverySource.includes('customerSpeaksBeforeGreeting(t)'), '§24 客が先に話した場合だけ名乗りを任意にできない');
assert(Object.keys(TYPES).every(type => customerSpeaksBeforeGreeting({s:{type}}) === (type === 'hurried')), '§24 hurried以外まで名乗らずコマンドへ進める');
const customerHasSpoken24 = new Function(functionSource('customerHasSpoken') + '\nreturn customerHasSpoken;')();
const renderActions24 = new Function('state','customerHasSpoken','renderCommandMenu','pendingTypedLine','renderHangupButton', actionsSource + '\nreturn renderActions;')(
  {busy:false,ui:{tab:'command'}}, customerHasSpoken24, () => 'COMMANDS', () => null, () => 'HANGUP'
);
assert.equal(renderActions24({greeted:false,transcript:[{who:'cust',typed:true}],callTranscriptStart:0}), 'COMMANDS', '§24 hurriedの受話直後に名乗らずコマンド一覧を使えない');
assert(renderActions24({greeted:false,transcript:[],callTranscriptStart:0}).includes('まず名乗ってください'), '§24 hurried以外でも名乗らずコマンド一覧を使える');

// §24-5 検査6: 任意の「名乗る」を残し、選べばrushedReplyを返す。
assert(menuSource.includes('optional-greeting') && menuSource.includes('data-greet="1"') && openingDeliverySource.includes('t.s.rushedReply'), '§24 任意の名乗る、またはrushedReplyが残っていない');

// §24-5 検査7は§25で限定折り返しを復活させたため、§25-7 検査5へ移行した。

// §24-5 検査8: callbackToは全案件に持たせる。
assert(SCENARIOS.length === 14 && SCENARIOS.every(scenario => ['hotel','mobile'].includes(scenario.callbackTo)), '§24/§25 案件データのcallbackToが揃っていない');

// §24-5 検査9: 途中切断から再着信する既存経路を保つ。
assert(interruptSource.includes('t.pendingInterruption = true') && finishInterruptedSource.includes("t.state = 'waiting'") && finishInterruptedSource.includes('t.redialCount++'), '§24 interruptCallからの再着信が従来どおり動かない');

// §24-5 検査10: 8バッジの緩和条件と表示文言を一致させる。
assert.deepEqual(CAREER_BADGES.map(badge => [badge.id,badge.condition]), [
  ['quiet_night','全案件で苛立ちが一度も70%を超えない'],
  ['no_redial','再入電0件・放棄呼0件'],
  ['frugal','返金と配送をどちらも使わない'],
  ['all_first','全案件を解決（再入電があってもよい）'],
  ['storm','同じ夜に苦情と一方的切断の両方が発生'],
  ['money_talks','全案件で返金を実施'],
  ['ten_nights','通算5シフトを完了'],
  ['clean_record','直近2シフトの苦情が0件'],
], '§24 バッジ8種の表示文言が緩和条件と一致しない');
const badgeLogic24 = functionSource('earnedBadgeIds');
['value <= 70','context.noRefundsOrShipments','context.allResolved','career.totals.days >= 5','career.shifts.length >= 2','slice(-2)'].forEach(marker => assert(badgeLogic24.includes(marker), '§24 バッジ条件が表どおりでない: ' + marker));
assert(CAREER_BADGES.some(badge => badge.id === 'ten_nights' && badge.label === '五夜勤'), '5シフト条件のバッジ名が「五夜勤」ではない');

// §25-7 検査1: l_carrierは30分の社外照会。
const carrierLookup25 = LOOKUPS.find(lookup => lookup.id === 'l_carrier');
assert(carrierLookup25 && carrierLookup25.label === '現地キャリアへ回線の再開通を依頼する' && carrierLookup25.minutes === 30 && carrierLookup25.external === true, '§25 l_carrierが30分の社外照会ではない');

// §25-7 検査2: 保留・通話継続は無効で、理由を表示する。
const carrierLookupUi25 = functionSource('renderCarrierLookupOptions');
assert.equal((carrierLookupUi25.match(/disabled/g) || []).length, 3, '§25 l_carrierの通話継続2経路または未確認ホテルが無効化されない');
assert(carrierLookupUi25.includes('通話をつないだままでは実行できません') && carrierLookupUi25.includes('社外への再開通依頼のため、通話継続では実行できません'), '§25 l_carrierを通話継続できない理由が画面にない');
assert(functionSource('doLookup').includes('if (l.external) return'), '§25 l_carrierをdoLookupから直接実行できる');

// §25-7 検査3: l_carrier選択後に折り返しを約束した場合だけ開始・完了する。
const startCarrierSource25 = functionSource('startCarrierCallback');
assert(startCarrierSource25.includes("state.ui.tab !== 'lookup'") && startCarrierSource25.includes("state.ui.lookup !== lookup.id") && startCarrierSource25.includes('t.carrierLookupStarted = true'), '§25 l_carrier選択前から折り返し照会を開始できる');
const carrierState25 = {clock:100,focus:null,ui:{tab:'command'},tickets:[]};
const carrierTicket25 = {s:SCENARIOS.find(scenario => scenario.id === 'S12'),asked:new Set(['q_stay']),lookedUp:new Set(),carrierLookupStarted:false,callbackCount:0,transcript:[]};
carrierState25.focus = carrierTicket25; carrierState25.tickets = [carrierTicket25,{state:'waiting',id:'other'}];
const startCarrier25 = new Function('LOOKUPS','CALL_FLOW_LINES','state','pushFlowLines','spendOnCall','defaultUi','playDisconnectSound','enterOffice','render', startCarrierSource25 + '\nreturn startCarrierCallback;')(
  LOOKUPS,CALL_FLOW_LINES,carrierState25,(ticket,lines) => ticket.transcript.push(...lines),() => true,tab => ({tab:tab || 'command'}),() => {},() => {},() => {}
);
startCarrier25('hotel');
assert.equal(carrierTicket25.state, undefined, '§25 l_carrier選択前に折り返しを開始できる');
carrierState25.ui = {tab:'lookup',lookup:'l_carrier'};
startCarrier25('hotel');
assert(carrierTicket25.carrierLookupStarted && carrierTicket25.state === 'callback' && carrierTicket25.callbackDue === 130 && carrierState25.focus === null, '§25 折り返し約束後に30分照会が始まらない');
const finishCarrier25 = new Function('LOOKUPS','addFact', functionSource('finishCarrierLookup') + '\nreturn finishCarrierLookup;')(
  LOOKUPS,(ticket,fact,src) => ticket.facts = [{fact,src}]
);
const unpromised25 = {carrierLookupStarted:false,lookedUp:new Set(),s:carrierTicket25.s,transcript:[]};
assert.equal(finishCarrier25(unpromised25), false, '§25 折り返し約束前にl_carrier照会が完了する');

// §25-7 検査4: 主コマンドは4つのまま。
assert.deepEqual(COMMAND_DEFS.map(command => command.label), ['聞く','調べる','伝える','ログ'], '§25 折り返すが5つ目の主コマンドへ戻っている');

// §25-7 検査5: オフィスの発信ボタンと折り返し待ち表示を復活させる。
assert(page.includes('data-office-callback="1"') && page.includes('>電話をかける<') && page.includes('id="office-tray-status"'), '§25 オフィスの電話をかけるボタンまたは折り返し待ち表示がない');
assert(officeSource.includes('readyCallbacks') && officeSource.includes('callbackDue <= state.clock'), '§25 30分経過前から電話をかけるボタンが有効になる');

// §25-7 検査6は§39でホテル折り返しへ統一した。
assert(!carrierLookupUi25.includes('data-callback-destination="mobile"') && carrierLookupUi25.includes('data-callback-destination="hotel"') && carrierLookupUi25.includes("t.asked.has('q_stay')"), '§39 現地キャリア折り返しがホテルと滞在先確認へ統一されていない');
const resumeCallback25 = functionSource('resumeCallback');
assert(resumeCallback25.includes("t.callbackStage = 'front_desk'") && resumeCallback25.includes("who:'front'"), '§39 折り返しがホテルのフロントから始まらない');

// §25-7 検査7は§39でフロント接続後に顧客発話を積む。
assert(functionSource('handleFrontDeskChoice').includes("{ who:'front', text:frontReply }") && functionSource('handleFrontDeskChoice').includes("{ who:'cust', text:callbackCustomerReply(t) }"), '§39 フロント接続後にFront Deskと顧客の発話が揃わない');
assert.deepEqual(Object.keys(CALL_FLOW_LINES.callback.replies).sort(), ['anxious','expert','hurried','novice'], '§25 折り返し再接続の顧客応答が4タイプ分ない');

// §25-7 検査8: S12は自社では有効、現地では0時失効となり、現地照会でprovisionをほぼ確定する。
const s12Carrier25 = SCENARIOS.find(scenario => scenario.id === 'S12');
const s12Plan25 = s12Carrier25.lookups.l_plan;
const s12External25 = s12Carrier25.lookups.l_carrier;
assert(s12Plan25.text.includes('契約: 有効') && s12External25.text.includes('00:00 に契約満了として停止'), '§25 S12の自社契約照会と現地キャリア照会が食い違って見えない');
assert.deepEqual(s12External25.fact.hot, ['provision'], '§25 S12の現地キャリア照会がprovisionを強く示さない');
assert(s12External25.fact.out.length === CAUSES.length - 1 && !s12External25.fact.out.includes('provision'), '§25 S12の現地キャリア照会がprovision以外を除外しない');

// §25-7 検査9: 第一声では正確な日付境界を隠し、l_carrierなしでも聞き取りと除外からprovisionへ到達できる。
assert(!/00:00|0時|日付が変わ/.test(s12Carrier25.opening) && (s12Carrier25.replies.q_when.fact.hot || []).includes('provision'), '§25 S12の時間手がかりが第一声で漏れる、またはq_whenで得られない');
assert(!Object.values(REMEDIES).flat().some(remedy => remedy.needsLookup === 'l_carrier'), '§25 l_carrierがS12の正解対処に必須化されている');

// §25-7 検査10: 折り返し中も別の待ち電話はそのまま受話できる。
assert(carrierState25.tickets[1].state === 'waiting' && functionSource('handleOfficeAction').includes("firstTicketIn('waiting', 'arrivedTurn')"), '§25 折り返し中にほかの電話を取れない');
const idleSource25 = functionSource('advanceIdleOffice');
assert(idleSource25.includes("t.state === 'waiting'") && idleSource25.includes("t.state === 'callback'") && idleSource25.includes('t.callbackDue <= state.clock'), '§25 待ち電話と折り返し期限の進行を両立できない');

// §26-3 検査1: 「記録なし」という存在しない結果要約を削除する。
assert(!Object.prototype.hasOwnProperty.call(CALL_FLOW_LINES.lookup, 'miss') && !game.includes('CALL_FLOW_LINES.lookup.miss'), '§26 CALL_FLOW_LINES.lookup.missが残っている');
assert(!game.includes('該当する記録は確認できませんでした'), '§26 照会成功後の矛盾した「記録なし」発話が残っている');

// §26-3 検査2・4・5: 全照会がspoken/defaultResult/titleを持ち、QUESTIONSのmissだけは残す。
assert(LOOKUPS.every(lookup => typeof lookup.spoken === 'string' && lookup.spoken.length > 0), '§26 LOOKUPSの全項目に顧客向けspokenがない');
assert(LOOKUPS.every(lookup => typeof lookup.defaultResult === 'string' && lookup.defaultResult.length > 0 && !Object.prototype.hasOwnProperty.call(lookup, 'miss')), '§26 LOOKUPSの既定結果がdefaultResultへ改名されていない');
assert(LOOKUPS.every(lookup => typeof lookup.title === 'string' && lookup.title.length > 0), '§26 照会画面のタイトルが全項目にない');
assert(QUESTIONS.length > 0 && QUESTIONS.every(question => typeof question.miss === 'string' && question.miss.length > 0), '§26 QUESTIONSの二度聞き用missが損なわれている');

// §26-3 検査3: 案件固有結果がなくても既定結果を表示し、spokenを客へ伝える。
const lookupSystemLine26 = new Function(functionSource('lookupSystemLine') + '\nreturn lookupSystemLine;')();
const fallbackTicket26 = {state:'open',s:{lookups:{}},lookedUp:new Set(),transcript:[]};
const fallbackState26 = {focus:fallbackTicket26,busy:true,holdVisual:false,ui:{}};
const finishLookup26 = new Function(
  'state','lookupSystemLine','addFact','triggerOutage','spendOnCall','pushFlowLines','CALL_FLOW_LINES','defaultUi','render',
  functionSource('finishLookup') + '\nreturn finishLookup;'
)(fallbackState26,lookupSystemLine26,() => {},() => {},() => true,(ticket,lines) => ticket.transcript.push(...lines),CALL_FLOW_LINES,() => ({}),() => {});
finishLookup26(fallbackTicket26, LOOKUPS.find(lookup => lookup.id === 'l_plan'), 3, 0);
assert(fallbackTicket26.transcript.some(line => line.who === 'sys' && line.text === LOOKUPS[0].defaultResult), '§26 案件固有結果なしで既定のシステム結果が表示されない');
// §40: 結果が空振りでも、オペレーターは合図だけ返し、中身は読み上げない。
assert(fallbackTicket26.transcript.some(line => line.who === 'me' && line.text === CALL_FLOW_LINES.lookup.talkComplete), '§40 照会の完了を客へ知らせていない');
assert(!fallbackTicket26.transcript.some(line => line.who === 'me' && line.text.includes(LOOKUPS[0].spoken)), '§40 照会結果の中身を客へ読み上げている');

// §26-3 検査6〜10: 共通の暗いシステム画面、縦項目、内包viz、外部照会表示。
const esc26 = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const lookupRows26 = new Function(functionSource('lookupResultRows') + '\nreturn lookupResultRows;')();
const renderViz26 = new Function('clamp','esc', functionSource('renderLookupViz') + '\nreturn renderLookupViz;')((value,min,max) => Math.max(min,Math.min(max,value)),esc26);
const renderScreen26 = new Function('lookupResultRows','esc','renderLookupViz', functionSource('renderLookupSystemScreen') + '\nreturn renderLookupSystemScreen;')(lookupRows26,esc26,renderViz26);
const screen26 = renderScreen26({lookupId:'l_plan',lookupTitle:'契約照会',text:'[契約照会] 契約: 有効 ／ 使用量: 制限内',viz:{label:'使用量',value:1,max:5,unit:'GB'}});
assert(screen26.includes('class="system-screen lookup-system-screen"') && screen26.includes('<header>') && screen26.includes('<b>契約照会</b>') && /\.system-screen\{[^}]*font-family: var\(--mono\)/.test(page), '§26 照会結果が枠・タイトル・等幅フォントのシステム画面にならない');
assert(functionSource('lookupSystemLine').includes('typed:true'), '§26 照会結果が直近会話で未表示になる');
assert((screen26.match(/lookup-system-row/g) || []).length === 2 && !screen26.includes('／ 使用量'), '§26 照会結果の項目が行ごとに分かれない');
assert(page.includes('.lcd,.lcd.obscured,.lcd.missing,.system-screen{ background:#10212B; color:#A8E4DF; box-shadow:inset 0 0 18px #071118; }'), '§26 システム画面の配色がROUTER DISPLAYと揃っていない');
assert(screen26.indexOf('lookup-viz') > screen26.indexOf('lookup-system-fields') && screen26.indexOf('lookup-viz') < screen26.indexOf('</section>'), '§26 使用量vizがシステム画面の外へ出ている');
const externalScreen26 = renderScreen26({lookupId:'l_carrier',lookupTitle:'現地キャリア照会',external:true,text:'[現地キャリア照会] 回線契約: 有効'});
assert(externalScreen26.includes('lookup-system-screen external') && externalScreen26.includes('外部照会'), '§26 l_carrierが外部照会として見分けられない');

// §27-3 検査1〜10: 調べる・ログは常時押せ、共通の本人確認ガードで時間無消費の案内へ分岐する。
const renderMenu27 = new Function('COMMAND_DEFS','esc','hotelCallbackOffered','renderHangupButton', menuSource + '\nreturn renderCommandMenu;')(COMMAND_DEFS,esc26,hotelCallbackOffered,() => '');
const menuBefore27 = renderMenu27({greeted:true,identified:false,nameKnown:false,destinationKnown:false,callDirection:'inbound'}, 'actions');
const recordButton27 = html => (html.match(/<button class="command-choice" data-command="record"[^>]*>[\s\S]*?<\/button>/) || [''])[0];
assert(recordButton27(menuBefore27) && !recordButton27(menuBefore27).includes('disabled'), '§27 本人特定前のログが押せない');
const lookupButton27 = html => (html.match(/<button class="command-choice" data-command="lookup"[^>]*>[\s\S]*?<\/button>/) || [''])[0];
assert(lookupButton27(menuBefore27) && !lookupButton27(menuBefore27).includes('disabled'), '§27 本人特定前の「調べる」が押せない');
const deniedHtml27 = new Function(functionSource('renderIdentityDenied') + '\nreturn renderIdentityDenied;')()();
assert(deniedHtml27.includes('system-screen record-system-screen identity-denied-screen denied') && deniedHtml27.includes('本人確認が完了していません。') && deniedHtml27.includes('フルネームと渡航先、または契約IDを確認してください。'), '§27 本人特定前に必要条件を共通システム画面で案内しない');
assert(page.includes('.system-screen .record-denied-message b{ color:#F6C56A; }') && page.includes('.system-screen .record-denied-message p{ color:#E4F6F4; }'), '§27 ライト画面で本人確認の拒否文が暗く読めない');
const requireIdentification27Source = functionSource('requireIdentification');
assert(requireIdentification27Source.includes('identificationReady(t)') && !/nameKnown\s*&&\s*t\.destinationKnown/.test(requireIdentification27Source), '§27 共通ガードがidentificationReady以外の専用判定を持っている');
assert(!requireIdentification27Source.includes('spendOnCall'), '§27 本人特定前の共通拒否で時間を消費する');
const runRequireIdentification27 = ticket => {
  const runtime = {state:{ui:{tab:'command'}},rendered:0};
  const requireIdentification = new Function('state','identificationReady','defaultUi','render', requireIdentification27Source + '\nreturn requireIdentification;')(
    runtime.state,identificationReady,tab => ({tab:tab || 'command'}),() => { runtime.rendered++; }
  );
  return {granted:requireIdentification(ticket),runtime};
};
const deniedIdentity27 = runRequireIdentification27({identified:false,nameKnown:false,destinationKnown:false});
const contractIdentity27 = runRequireIdentification27({identified:true,nameKnown:false,destinationKnown:false});
const nameOnlyIdentity27 = runRequireIdentification27({identified:false,nameKnown:true,destinationKnown:false});
const nameDestinationIdentity27 = runRequireIdentification27({identified:false,nameKnown:true,destinationKnown:true});
assert(!deniedIdentity27.granted && deniedIdentity27.runtime.state.ui.tab === 'identity_denied' && deniedIdentity27.runtime.rendered === 1, '§27 本人特定前に共通拒否画面へ分岐しない');
assert(contractIdentity27.granted && !nameOnlyIdentity27.granted && nameDestinationIdentity27.granted, '§27 identificationReadyの契約ID／氏名＋渡航先条件を共通ガードが保たない');
const openRecord27Source = functionSource('openRecord');
const openLookup27Source = functionSource('openLookup');
assert(openRecord27Source.includes('requireIdentification(t)') && openLookup27Source.includes('requireIdentification(t)'), '§27 調べる・ログが同じ本人確認ガードを使っていない');
assert(!openLookup27Source.includes('spendOnCall'), '§27 「調べる」で時間を消費する');
const runOpenRecord27 = ticket => {
  const runtime = { state:{focus:ticket,ui:{tab:'command'}}, pushed:0, stressed:0, spent:0, rendered:0 };
  const requireIdentification = current => {
    if (identificationReady(current)) return true;
    runtime.state.ui = {tab:'identity_denied'};
    runtime.rendered++;
    return false;
  };
  const open = new Function('state','requireIdentification','defaultUi','render','pushFlowLines','CALL_FLOW_LINES','addStress','spendOnCall', openRecord27Source + '\nreturn openRecord;')(
    runtime.state,requireIdentification,tab => ({tab:tab || 'command'}),() => { runtime.rendered++; },
    () => { runtime.pushed++; },CALL_FLOW_LINES,() => { runtime.stressed++; return true; },(t,minutes) => { runtime.spent += minutes; return true; }
  );
  open();
  return runtime;
};
const deniedRecord27 = runOpenRecord27({identified:false,nameKnown:false,destinationKnown:false,transcript:[]});
assert(deniedRecord27.state.ui.tab === 'identity_denied' && deniedRecord27.spent === 0 && deniedRecord27.stressed === 0 && deniedRecord27.pushed === 0, '§27 本人特定前のログ拒否で時間・費用相当の処理を消費する');
const contractRecord27 = runOpenRecord27({identified:true,nameKnown:false,destinationKnown:false,transcript:[]});
assert(contractRecord27.state.ui.tab === 'record' && contractRecord27.spent === 1, '§27 契約IDで本人特定しても通話記録が開かない、または1分消費しない');
const nameOnlyRecord27 = runOpenRecord27({identified:false,nameKnown:true,destinationKnown:false,transcript:[]});
const nameDestinationRecord27 = runOpenRecord27({identified:false,nameKnown:true,destinationKnown:true,transcript:[]});
assert(nameOnlyRecord27.state.ui.tab === 'identity_denied' && nameDestinationRecord27.state.ui.tab === 'record' && nameDestinationRecord27.spent === 1, '§27 氏名だけでログが開く、または氏名と渡航先で開かない');
const runOpenLookup27 = ticket => {
  const runtime = { state:{focus:ticket,ui:{tab:'command'}}, rendered:0 };
  const requireIdentification = current => {
    if (identificationReady(current)) return true;
    runtime.state.ui = {tab:'identity_denied'};
    runtime.rendered++;
    return false;
  };
  const open = new Function('state','requireIdentification','defaultUi','render', openLookup27Source + '\nreturn openLookup;')(
    runtime.state,requireIdentification,tab => ({tab:tab || 'command'}),() => { runtime.rendered++; }
  );
  open();
  return runtime;
};
const deniedLookup27 = runOpenLookup27({identified:false,nameKnown:false,destinationKnown:false});
const identifiedLookup27 = runOpenLookup27({identified:true,nameKnown:false,destinationKnown:false});
assert(deniedLookup27.state.ui.tab === 'identity_denied' && deniedLookup27.rendered === 1 && identifiedLookup27.state.ui.tab === 'lookup', '§27 「調べる」が未特定時に共通画面で弾かれない、または本人特定後に開かない');
assert(functionSource('handleCallNavigation').includes("d.command === 'lookup') openLookup()"), '§27 「調べる」の入口が共通本人確認処理を通らない');

// §27-3 検査11〜13: 通話記録も同じシステム画面を使い、全話者・本文・vizを記録行として保つ。
const recordSource27 = functionSource('renderRecord') + functionSource('renderCustomerRecord') + functionSource('renderRecordLog');
const recordTranscriptSource27 = functionSource('renderRecordTranscript');
assert(recordSource27.includes('system-screen record-system-screen') && recordSource27.includes('<b>顧客レコード</b>') && page.includes('.record-system-screen'), '§27 通話記録が枠・タイトル行を持つシステム画面ではない');
assert(page.includes('.system-screen{') && page.includes('.record-system-entry') && page.includes('font: 11px/1.6 var(--mono)'), '§27 通話記録が照会画面と共通配色・等幅フォントになっていない');
assert(page.includes('.system-screen .record-system-block h3,.system-screen .log-customer span,.system-screen .log-candidates span{ color:#A8E4DF; }') && page.includes('.system-screen .log-customer b,.system-screen .log-candidates b{ color:#78B8B3; }'), '§27 ライト画面で通話記録の見出し・項目が暗く読めない');
const renderRecordTranscript27 = new Function('renderLookupSystemScreen','renderLookupViz','esc', recordTranscriptSource27 + '\nreturn renderRecordTranscript;')(renderScreen26,renderViz26,esc26);
const recordHtml27 = renderRecordTranscript27({transcript:[
  {who:'cust',text:'顧客発話'}, {who:'me',text:'担当者発話'}, {who:'note',text:'対応メモ'}, {who:'sys',text:'システム応答'},
]});
['客','顧客発話','あなた','担当者発話','メモ','対応メモ','社内システム','システム応答'].forEach(text => assert(recordHtml27.includes(text), '§27 通話記録から従来の中身が欠ける: ' + text));
assert(!recordTranscriptSource27.includes('renderTranscript(t, true)') && recordTranscriptSource27.includes('t.transcript.map'), '§27 通話記録が会話の吹き出しをそのまま並べている');

// §29-5 検査1: 毎夜不要な説明をブリーフィングから外す。
const briefingSource29 = functionSource('showBriefing');
const manualSource29 = functionSource('showManual');
const removedBriefing29 = ['海外用モバイルWiFiレンタルのテクニカルサポート','ここは、すでに海外にいるお客様','<h2>やること</h2>','<h2>評価の重みは隠しません</h2>','<h2>ひとつだけ先に</h2>'];
assert(removedBriefing29.every(token => !briefingSource29.includes(token)), '§29 ブリーフィングに毎夜不要な説明が残っている');

// §29-5 検査2・4: 状態を1行にし、保存注記は通算0日の初回だけ出す。
const careerBriefingSource29 = functionSource('careerBriefingHtml');
const briefingRuntime29 = {state:{career:{totals:{days:0},stage:'probation'},tickets:[{},{},{},{}]}};
const careerBriefing29 = new Function('state','freshCareerRecord','esc','CAREER_STAGES', careerBriefingSource29 + '\nreturn careerBriefingHtml;')(
  briefingRuntime29.state,() => briefingRuntime29.state.career,value => String(value),CAREER_STAGES
);
const firstBriefing29 = careerBriefing29();
assert(firstBriefing29.includes('<b>1日目 ／ 試用期間 ／ 今夜 4件</b>'), '§29 何日目・段階・今夜の件数が1行で出ない');
assert(firstBriefing29.includes('勤務記録はこのブラウザ内だけに保存されます。氏名や会話内容は保存しません。'), '§29 初回ブリーフィングに保存注記がない');
briefingRuntime29.state.career = {totals:{days:1},stage:'probation'};
const secondBriefing29 = careerBriefing29();
assert(secondBriefing29.includes('<b>2日目 ／ 試用期間 ／ 今夜 4件</b>') && !secondBriefing29.includes('勤務記録はこのブラウザ内だけに保存されます。氏名や会話内容は保存しません。'), '§29 保存注記が2日目以降にも出る');

// §29-5 検査3: 開始操作を残す。
assert(briefingSource29.includes('id="btn-start">シフトを始める</button>') && briefingSource29.includes("$('btn-start').onclick"), '§29 ブリーフィングにシフト開始ボタンがない');

// §29-5 検査5: 公開していた採点基準をマニュアルへ移す。
const scoreWeights29 = ['顧客満足（CSAT）35%','一次解決率 25%','応答率 20%','費用 10%','業務報告 10%'];
assert(scoreWeights29.every(token => manualSource29.includes(token)), '§29 評価の配点5項目が対応マニュアルにない');

// §29-5 検査6: 「やること」の6項目をマニュアルで読めるようにする。
const operatingRules29 = ['電話は1本ずつしか取れません','無駄な質問1つが通話を1分延ばし','調べものは保留にすれば速く済みます','現地キャリアへの照会だけは30分かかります',"枠は' + ESCALATIONS + '回だけ",'相手によって刺さる話し方が違います'];
assert(operatingRules29.every(token => manualSource29.includes(token)), '§29 やること6項目が対応マニュアルに揃っていない');

// §29-5 検査7: QRカードとスマホ幅での非表示を維持する。
assert(briefingSource29.includes('artifact-qr-card') && briefingSource29.includes('drawArtifactQr()') && /@media \(max-width:480px\)[\s\S]*?\.artifact-qr-card\{ display:none; \}/.test(page), '§29 QRカードの従来の表示・スマホ非表示が崩れている');

// §30-6 検査1: 13件目をlogistics案件として追加する。
const s9Logistics30 = SCENARIOS.find(scenario => scenario.id === 'S9');
const s13Logistics30 = SCENARIOS.find(scenario => scenario.id === 'S13');
assert(s13Logistics30 && s13Logistics30.trueCause === 'logistics', '§30 検査1: 13件目がlogistics案件ではない');

// §30-6 検査2: S9の未受取と、S13の受取済み・初回から不通を書き分ける。
assert(s9Logistics30.device === '（未受取）' && /受け取ってから一度も|初回起動から一度も/.test(s13Logistics30.opening + s13Logistics30.replies.q_when.text) && !/未受取|受け取れていません/.test(s13Logistics30.opening), '§30 検査2: S9の未受取とS13の受取済み初回不通を区別できない');

// §30-6 検査3: 貸出記録が申込国と利用不可SIMの食い違いを自社の記録として示す。
const s13Ship30 = s13Logistics30.lookups.l_ship;
assert(s13Ship30.text.includes('申込: {country}') && s13Ship30.text.includes('貸出品: {wrongCountry}向けSIM') && s13Ship30.text.includes('{country}: 利用不可') && (s13Ship30.fact.hot || []).includes('logistics'), '§30 検査3: l_shipに申込国と利用不可SIMの食い違いがない');

// §30-6 検査4: 契約照会自体は正常である。
const s13Plan30 = s13Logistics30.lookups.l_plan;
assert(s13Plan30.text.includes('契約: 有効') && s13Plan30.text.includes('使用量: 制限内') && !/失効|上限到達|速度制限中/.test(s13Plan30.text), '§30 検査4: l_planが有効・制限内の正常契約ではない');

// §30-6 検査5: 最適対処は非を認めて代替機を送る。
const s13Best30 = REMEDIES.logistics.find(remedy => remedy.id === s13Logistics30.best);
assert(s13Best30 && s13Best30.label.includes('手配の誤りをお詫びし') && s13Best30.label.includes('代替機を発送する'), '§30 検査5: 最適対処が謝罪と代替機発送を明記しない');

// §30-6 検査6: 次善対処は非を認めて返金する。
const s13Partial30 = REMEDIES.logistics.find(remedy => (s13Logistics30.partial || []).includes(remedy.id));
assert(s13Logistics30.partial.length === 1 && s13Partial30 && s13Partial30.label.includes('手配の誤りをお詫びし') && s13Partial30.label.includes('返金する'), '§30 検査6: 次善対処が謝罪と返金を明記しない');

// §30-6 検査7: 滞在期間と配送先の不足を既存remedyBlockReasonで止める。
const remedyBlockReason30 = new Function('state','remedyNeedsShipping', functionSource('remedyBlockReason') + '\nreturn remedyBlockReason;')(
  {escLeft:3,outageKnown:false}, id => id === 'r_logistics_replacement'
);
const s13Ticket30 = overrides => Object.assign({s:s13Logistics30,asked:new Set(),testCounts:new Map(),stayAddress:null,stayDaysKnown:false,replacementConsentKnown:false},overrides);
const missingStayPeriod30 = remedyBlockReason30(s13Ticket30({asked:new Set(['q_stay','q_replacement'])}),s13Best30);
const missingDestination30 = remedyBlockReason30(s13Ticket30({asked:new Set(s13Best30.requiresQuestions),stayDaysKnown:true,replacementConsentKnown:true}),s13Best30);
assert(missingStayPeriod30.includes('聞き取り') && missingDestination30.includes('配送先'), '§30 検査7: remedyBlockReasonが滞在期間・滞在先不足を止めない');

// §30-6 検査8: 新しい前提機構を作らず既存3条件を使う。
assert.deepEqual(s13Best30.requiresQuestions,['q_stay','q_stay_length','q_replacement'],'§30 検査8: 代替機発送が既存の質問条件を使わない');
assert(s13Best30.requiresLongStay === 3 && s13Best30.requiresConsent === true, '§30 検査8: 代替機発送が既存の長期滞在・同意条件を使わない');

// §30-6 検査9: S13で選べる正解・次善のどちらも非を隠さない。
const s13AssignedRemedies30 = [s13Best30,s13Partial30];
assert(s13AssignedRemedies30.every(remedy => remedy && remedy.label.includes('手配の誤りをお詫びし') && !/隠|黙|伏せ|ごまか/.test(remedy.label)), '§30 検査9: 非を認めず切り抜けるS13対処がある');

// §30-6 検査10: 不安型の客が第一声で自分を責め、会社の手配ミスは疑わない。
assert(s13Logistics30.type === 'anxious' && /私が.*間違え/.test(s13Logistics30.opening) && !/手配|貸出|会社|御社|違うSIM/.test(s13Logistics30.opening), '§30 検査10: anxiousの自己責任型第一声になっていない');

// §30-6 検査11: 案件が増えても表エンディングとレポートは動的総数を使う。
assert(SCENARIOS.length === 14 && functionSource('careerEndingQueue').includes('career.solvedScenarios.length === SCENARIOS.length') && functionSource('careerDebriefHtml').includes("' / ' + SCENARIOS.length"), '§30 検査11: 14件または動的な全件エンディング・集計になっていない');

// §30-6 検査12: progression_testが辿る既存前提データをS13にも揃える。
assert(s13Best30.requiresQuestions.every(id => QUESTIONS.some(question => question.id === id) && s13Logistics30.replies[id]) && s13Logistics30.stayDays >= s13Best30.requiresLongStay && s13Logistics30.wantsReplacement === true, '§30 検査12: progression_test用の正解ルート前提が揃っていない');

// §32-6: 客の口調だけを自然にし、診断情報と到達性は変えない。
const s10Dialogue32 = SCENARIOS.find(scenario => scenario.id === 'S10');
const s13Dialogue32 = SCENARIOS.find(scenario => scenario.id === 'S13');
assert(!s13Dialogue32.replies.q_lamp.text.includes('SIMがないという表示ではなく') && s13Dialogue32.replies.q_lamp.text.includes('アンテナの棒が、ずっと0本'), '§32 検査1: S13 q_lampが客自身にSIM表示の鑑別をさせている');
const s10SimSequence32 = s10Dialogue32.tests.t_simout.sequence;
assert(!s10SimSequence32[0].text.includes('1回目') && s10SimSequence32[0].text.includes('乾いた布で拭いて、挿し直してみました') && s10SimSequence32[1].text.includes('もう一度'), '§32 検査2: SIM清掃の初回が回数を自己申告する、または従来の再試行表現がない');

function scenarioCustomerUtterances32(scenario){
  const utterances = [scenario.opening,scenario.contractId && scenario.contractId.text,scenario.rushedReply];
  Object.values(scenario.replies || {}).forEach(reply => utterances.push(reply.text));
  Object.values(scenario.tests || {}).forEach(test => {
    if (test.text) utterances.push(test.text);
    (test.sequence || []).forEach(step => utterances.push(step.text));
  });
  (scenario.smalltalk || []).forEach(topic => utterances.push(topic.goodReply,topic.badReply));
  return utterances.filter(text => typeof text === 'string' && text.length);
}
const nonExpertUtterances32 = SCENARIOS.filter(scenario => scenario.type !== 'expert').flatMap(scenarioCustomerUtterances32);
const unnaturalTechnicalDenial32 = /SIMがないという表示ではなく|SIMカードではなく|回線登録だけが|プロビジョニングでは|網側の(?:障害|拒否)では/;
assert(nonExpertUtterances32.every(text => !unnaturalTechnicalDenial32.test(text)), '§32 検査3: non-expertの客が知らない技術的区別を否定形で述べている');
assert(nonExpertUtterances32.every(text => !/(?:^|[。！？…\s])(?:1|2|一|二)回目[、,]/.test(text)), '§32 検査4: non-expertの客が自分の操作へ番号を振っている');
const expertUtterances32 = SCENARIOS.filter(scenario => scenario.type === 'expert').flatMap(scenarioCustomerUtterances32).join('\n');
assert(['全断ではありません','経時劣化ではありません','単純な無電波地域ではありません'].every(text => expertUtterances32.includes(text)), '§32 検査5: expertの自然な否定形切り分けが失われている');

assert(s13Dialogue32.replies.q_lamp.fact.text === 'SIMは認識しているが、到着時から現地回線を一度も捕捉していない' &&
  s10SimSequence32[0].fact.text === '1回目のSIM清掃では認識しない' &&
  s10SimSequence32[1].fact.text === 'SIM清掃と正しい挿し直しを2回行っても認識しない。本体SIMリーダー故障と判断できる', '§32 検査6: 客の台詞改稿でfact.textが変わっている');
assert.deepEqual({
  s13Hot:s13Dialogue32.replies.q_lamp.fact.hot,s13Out:s13Dialogue32.replies.q_lamp.fact.out,
  s10FirstHot:s10SimSequence32[0].fact.hot,s10SecondHot:s10SimSequence32[1].fact.hot,s10SecondOut:s10SimSequence32[1].fact.out,
},{
  s13Hot:['coverage','provision','logistics'],s13Out:['sim','device_side','device_net'],
  s10FirstHot:['sim','hardware'],s10SecondHot:['hardware'],s10SecondOut:['sim','fup','devices','geo_block','heavy','device_side','device_net','location','power','carrier','coverage','provision','logistics'],
}, '§32 検査7: 客の台詞改稿でhot/outの関係が変わっている');

const verify32 = spawnSync(process.execPath,['verify.js'],{cwd:__dirname,encoding:'utf8'});
assert.equal(verify32.status,0,'§32 検査8: verifyが13案件を真因1つへ収束させない\n' + (verify32.stdout || '') + (verify32.stderr || ''));
const progression32 = spawnSync(process.execPath,['progression_test.js'],{cwd:__dirname,encoding:'utf8'});
assert.equal(progression32.status,0,'§32 検査9: progression_testが通らない\n' + (progression32.stdout || '') + (progression32.stderr || ''));
const allCustomerUtterances32 = SCENARIOS.flatMap(scenarioCustomerUtterances32).concat(typeNames.flatMap(type => [TYPES[type].solvedReply,TYPES[type].refundRejectReply]));
assert(allCustomerUtterances32.every(text => dialogueDuration(text) <= 4000), '§32 検査10: 改稿後の顧客台詞がtyping_budgetの4秒を超える');

// §33-5: 未解決で切ろうとしたとき、止めるだけでなく次の一手を示す。
const unresolvedGuide33 = new Function('hotCauses','esc', functionSource('unresolvedHangupGuide') + '\nreturn unresolvedHangupGuide;')(
  ticket => ticket.hot, String
);
const notNarrowedGuide33 = unresolvedGuide33({hot:new Set(['sim','hardware'])});
const narrowedGuide33 = unresolvedGuide33({hot:new Set(['hardware'])});
assert(notNarrowedGuide33.includes('「聞く」「調べる」で手がかりを集める') && notNarrowedGuide33.includes('対処を案内できるようになります'), '§33 検査1: 原因未絞り込みの終話確認が次の質問・照会を案内しない');
assert(narrowedGuide33.includes('「伝える」→「対処を伝える」') && narrowedGuide33.includes('原因と対処を案内すると、この電話を終われます'), '§33 検査2: 原因絞り込み後の終話確認が対処案内を次手にしない');
assert([notNarrowedGuide33,narrowedGuide33].every(html => html.includes('このまま切ると、お客様から再入電になります')), '§33 検査3: 未解決切断で再入電になる説明が欠けている');
assert(functionSource('unresolvedHangupGuide').includes('hotCauses(t).size === 1'), '§33 検査4: 終話ガイドが真因ではなく現在の絞り込み状態で分岐しない');
assert(functionSource('renderCloseFlow').includes('has-block-reason') && functionSource('renderCloseFlow').includes('remedy-block-reason') && page.includes('.opt:disabled.has-block-reason') && page.includes('.remedy-block-reason'), '§33 検査5: 前提不足の対処と理由が通常説明とは違う見た目にならない');
const unchangedBlockReason33 = remedyBlockReason30({asked:new Set(),testCounts:new Map([['t_simout',0]])},{kind:'resolve',needsTest:'t_simout',needsTestCount:2});
assert.equal(unchangedBlockReason33,'先に「伝える」→「やってみてもらう」を 2回行ってください（現在 0回）','§33 検査6: 前提不足の理由文そのものが変わっている');
assert(functionSource('addStress').includes('base * type.stressRate * (miss ? type.missRate : 1)') && functionSource('changeStress').includes('if (!expectedOutcome) delta = 0') && functionSource('stressDisplayStage').includes('value <= 50'), '§33 検査7: 苛立ちの加算・運・表示境界が変わっている');

// §34-5: S7を会社の機種選定ミスとして謝罪・代替機発送／返金で扱う。
const s7Coverage34 = SCENARIOS.find(scenario => scenario.id === 'S7');
const s7Best34 = REMEDIES.coverage.find(remedy => remedy.id === s7Coverage34.best);
const s7Partial34 = REMEDIES.coverage.find(remedy => s7Coverage34.partial.includes(remedy.id));
assert.equal(s7Best34.label,'手配の誤りをお詫びし、滞在期間と滞在先を確認したうえで代替機を発送する','§34 検査1: S7最適対処が謝罪・滞在確認・代替機発送ではない');
assert.equal(s7Partial34.label,'手配の誤りをお詫びし、返金する','§34 検査2: S7次善対処が謝罪・返金ではない');
assert([s7Best34,s7Partial34].every(remedy => remedy.label.includes('手配の誤りをお詫びし')),'§34 検査3: S7対処ラベルが会社の非を認めない');
assert(!Object.values(REMEDIES).flat().some(remedy => ['r_escalate_band','r_city_only'].includes(remedy.id)),'§34 検査4: r_escalate_band または r_city_only が残っている');
assert.deepEqual(s7Best34.requiresQuestions,['q_stay','q_stay_length','q_replacement'],'§34 検査5: S7代替機が既存requiresQuestionsを使わない');
assert(s7Best34.requiresLongStay === 3 && s7Best34.requiresConsent === true,'§34 検査5: S7代替機が既存の長期滞在・同意条件を使わない');
assert(s7Coverage34.stayDays >= 3 && s7Coverage34.wantsReplacement === true && s7Coverage34.callbackTo === 'hotel' && s7Coverage34.replies.q_stay.text.includes('同じホテル'),'§34 検査6: S7が長期滞在・同じホテル・配送希望に設定されていない');
const finishLookup34 = new Function('state','lookupSystemLine','addFact','triggerOutage','spendOnCall','pushFlowLines','CALL_FLOW_LINES','pushCustomerLine','addStress','render','defaultUi', functionSource('finishLookup') + '\nreturn finishLookup;');
const s7Lookup34 = s7Coverage34.lookups.l_area;
const s7Ticket34 = {s:s7Coverage34,state:'open',lookedUp:new Set(),transcript:[],stress:8};
const s7State34 = {focus:s7Ticket34,busy:true,holdVisual:false,ui:null};
let s7StressDelta34 = 0;
finishLookup34(s7State34,(lookup,result) => ({who:'sys',text:result.text}),() => {},() => {},() => true,(ticket,lines) => ticket.transcript.push(...lines),CALL_FLOW_LINES,(ticket,text) => ticket.transcript.push({who:'cust',text}),(_ticket,delta) => { s7StressDelta34 += delta; return true; },() => {},() => ({tab:'command'}))(s7Ticket34,{id:'l_area',spoken:'照会結果'},3,0);
assert(s7Ticket34.transcript.some(line => line.who === 'cust' && line.text === s7Lookup34.customerReply),'§34 検査7: S7の手配ミス判明後に客の非難発話が出ない');
assert(s7StressDelta34 === 35 && s7Lookup34.stressDelta > 0,'§34 検査8: S7の非難発話で苛立ちが上がらない');
assert(/申込地域|非対応|御社|手配側の責任/.test(s7Lookup34.customerReply) && !/[!！]{2,}|ふざけ|ありえない/.test(s7Lookup34.customerReply),'§34 検査9: S7の非難が事実を並べて責任を問うexpert調ではない');
const s13Symptoms34 = s13Logistics30.opening + s13Logistics30.replies.q_when.text;
assert(/市街地では正常|郊外.*圏外/.test(s7Coverage34.opening) && !/一度も.*(?:使え|つなが)/.test(s7Coverage34.opening) && /一度も.*(?:使え|つなが)/.test(s13Symptoms34),'§34 検査10: S7の部分利用可とS13の初回から利用不可を書き分けていない');
assert(s7Coverage34.trueCause === 'coverage' && s13Logistics30.trueCause === 'logistics','§34 検査11: S7とS13の真因が別のままではない');
assert(['r_escalate_line','r_escalate_swap','r_escalate_prov'].every(id => Object.values(REMEDIES).flat().some(remedy => remedy.id === id && remedy.kind === 'escalate')),'§34 検査12: 他案件のエスカレーション設計が変わっている');
const verify34 = spawnSync(process.execPath,['verify.js'],{cwd:__dirname,encoding:'utf8'});
assert.equal(verify34.status,0,'§34 検査13: verifyが13案件を真因1つへ収束させない\n' + (verify34.stdout || '') + (verify34.stderr || ''));
const progression34 = spawnSync(process.execPath,['progression_test.js'],{cwd:__dirname,encoding:'utf8'});
assert.equal(progression34.status,0,'§34 検査14: progression_testが通らない\n' + (progression34.stdout || '') + (progression34.stderr || ''));

// §35-7: 手元に機器がない案件から、成立しない質問・操作を隠す。
const s9Device35 = SCENARIOS.find(scenario => scenario.id === 'S9');
assert(SCENARIOS.every(scenario => typeof scenario.deviceInHand === 'boolean') && !/device\s*(?:===|!==)|device\.includes\(/.test(functionSource('renderAskOptions') + functionSource('renderTestOptions') + functionSource('doAsk') + functionSource('doTest')),'§35 検査1: deviceInHandの明示フラグではなくdevice表示文字列で判定している');
assert.equal(s9Device35.deviceInHand,false,'§35 検査2: S9がdeviceInHand falseではない');
const renderAskOptions35 = new Function('QUESTIONS','esc', functionSource('renderAskOptions') + '\nreturn renderAskOptions;')(QUESTIONS,String);
const s9AskTicket35 = {s:s9Device35,asked:new Set(),askCounts:new Map()};
const s9DeviceQuestions35 = renderAskOptions35(s9AskTicket35,QUESTION_GROUPS.find(group => group.id === 'device'));
assert(!['q_lamp','q_ssid','q_battery'].some(id => s9DeviceQuestions35.includes('data-ask="' + id + '"')),'§35 検査3: 機器未所持のS9に本体表示・SSID・電池質問が出る');
const renderTellOptions35 = new Function('REFUND_POLICY', 'hotelCallbackOffered', 'hotelCallbackSub', 'esc', functionSource('renderTellOptions') + '\nreturn renderTellOptions;')(REFUND_POLICY, hotelCallbackOffered, hotelCallbackSub, escForTell);
const tellTicket35 = extra => ({ asked:new Set(), stayAddress:null, callDirection:'inbound', callChargeConcerned:false, ...extra });
const renderTestOptions35 = new Function('simCleaningRecommended','TESTS','RISKY','esc', functionSource('renderTestOptions') + '\nreturn renderTestOptions;')(() => false,TESTS,RISKY,String);
assert(!renderTellOptions35(tellTicket35({s:s9Device35,refundProposalRejected:false})).includes('data-tell="try"') && !renderTestOptions35({s:s9Device35,testCounts:new Map()}).includes('data-test='),'§35 検査4: 機器未所持のS9に機器操作が出る');
const tellNumbers35 = html => [...html.matchAll(/class="command-no">(\d+)<\/span>/g)].map(match => Number(match[1]));
[
  { ticket:tellTicket35({s:s9Device35,refundProposalRejected:false}), expected:[1,2,3,4,5,6,7] },
  { ticket:tellTicket35({s:s9Device35,refundProposalRejected:true}), expected:[1,2,3,4,5,6] },
  { ticket:tellTicket35({s:SCENARIOS.find(scenario => scenario.deviceInHand),refundProposalRejected:false}), expected:[1,2,3,4,5,6,7,8] },
  { ticket:tellTicket35({s:SCENARIOS.find(scenario => scenario.deviceInHand),refundProposalRejected:true}), expected:[1,2,3,4,5,6,7] },
  // §40: 折り返し中の通話では折り返しの行が消え、番号が詰まる。
  { ticket:tellTicket35({s:s9Device35,refundProposalRejected:true,callDirection:'outbound'}), expected:[1,2,3,4] },
].forEach(({ticket,expected}) => assert.deepEqual(tellNumbers35(renderTellOptions35(ticket)),expected,'§35 追加検査: 「伝える」の表示項目が1からの連番ではない'));
const replacementQuestion35 = QUESTIONS.find(question => question.id === 'q_replacement');
assert(!replacementQuestion35.label.includes('直らない場合') && replacementQuestion35.label === '代替機の配送をご希望ですか','§35 検査5: q_replacementに「直らない場合」が残っている');
const s9VisibleQuestions35 = QUESTIONS.filter(question => !question.needsDevice).map(question => question.label);
assert(s9VisibleQuestions35.every(label => !/直らない場合|再起動しても|圏外なら|接続できない場合/.test(label)),'§35 検査6: 機器なし案件に見える質問が特定症状を前提にしている');
assert(!s9Device35.replies.q_lamp && !s9Device35.replies.q_other_device,'§35 検査7: S9に成立しないq_lampまたはq_other_device回答が残っている');
assert(s9Device35.replies.q_when.fact && s9Device35.replies.q_when.fact.hot.includes('logistics'),'§35 検査8: S9から削った無効回答に代わる物流の手がかりが成立する質問にない');
const deviceGroup35 = QUESTION_GROUPS.find(group => group.id === 'device');
const trueDeviceTicket35 = tellTicket35({s:{deviceInHand:true},askCounts:new Map(),testCounts:new Map(),refundProposalRejected:false});
const trueDeviceAsk35 = renderAskOptions35(trueDeviceTicket35,deviceGroup35);
const trueDeviceTests35 = renderTestOptions35(trueDeviceTicket35);
assert(deviceGroup35.questionIds.every(id => trueDeviceAsk35.includes('data-ask="' + id + '"')) && [...TESTS,...RISKY].every(test => trueDeviceTests35.includes('data-test="' + test.id + '"')) && renderTellOptions35(trueDeviceTicket35).includes('data-tell="try"'),'§35 検査9: 機器所持案件の質問・操作一覧が従来どおりではない');
const verify35 = spawnSync(process.execPath,['verify.js'],{cwd:__dirname,encoding:'utf8'});
assert.equal(verify35.status,0,'§35 検査10: verifyが13案件を真因1つへ収束させない\n' + (verify35.stdout || '') + (verify35.stderr || ''));
const progression35 = spawnSync(process.execPath,['progression_test.js'],{cwd:__dirname,encoding:'utf8'});
assert.equal(progression35.status,0,'§35 検査11: progression_testが通らない\n' + (progression35.stdout || '') + (progression35.stderr || ''));

// §36-6: 操作で復旧した事実と、次に原因を説明することを通話画面で分かるようにする。
const doTest36 = functionSource('doTest');
assert(doTest36.includes('pushCustomerLine(t, def.solves ? TYPES[t.s.type].solvedReply : def.text)') && !doTest36.includes("who:'note', text:'この操作で症状が解消しました"),'§36 検査1: def.solvesの復旧がnoteのままで通話画面に出ない');
assert(doTest36.includes('TYPES[t.s.type].solvedReply') && doTest36.includes('t.symptomResolved = true'),'§36 検査2: 復旧が客の発話ではなくオペレーター宣言になっている');
const solvedReplies36 = typeNames.map(type => TYPES[type].solvedReply);
assert(solvedReplies36.every(Boolean) && new Set(solvedReplies36).size === typeNames.length && solvedReplies36.every(reply => /つなが|復旧/.test(reply)),'§36 検査3: 復旧発話が4タイプ分書き分けられていない');
const resolvedGuide36 = unresolvedGuide33({hot:new Set(['sim']),symptomResolved:true});
assert(resolvedGuide36.includes('症状は復旧しました') && resolvedGuide36.includes('「伝える」→「対処を伝える」') && resolvedGuide36.includes('原因をご説明すると、この電話を終われます'),'§36 検査4: 復旧済み未案内の終話確認に第三の次手が出ない');
const simClean36 = REMEDIES.sim.find(remedy => remedy.id === 'r_sim_clean');
assert.equal(simClean36.label,'接点の一時的な接触不良だったことをご説明し、そのままご利用いただく','§36 検査5: r_sim_cleanが手順記録のままで原因説明になっていない');
const explanationRemedies36 = ['r_topup','r_slow_ok','r_disconnect','r_vpn_plan','r_throttle_talk','r_forget_guide','r_vpn_off','r_move_guide','r_charge_guide'].map(id => Object.values(REMEDIES).flat().find(remedy => remedy.id === id));
assert(explanationRemedies36.every(remedy => remedy && /説明|ご説明/.test(remedy.label)),'§36 検査6: 他のresolve対処に手順記録のままのラベルが残っている');
assert.deepEqual([
  [simClean36.id,simClean36.kind,simClean36.needsTest,simClean36.needsTestCount],
  [REMEDIES.location.find(remedy => remedy.id === 'r_move_guide').id,REMEDIES.location.find(remedy => remedy.id === 'r_move_guide').kind,REMEDIES.location.find(remedy => remedy.id === 'r_move_guide').needsTest],
  [REMEDIES.device_side.find(remedy => remedy.id === 'r_forget_guide').id,REMEDIES.device_side.find(remedy => remedy.id === 'r_forget_guide').kind],
  [REMEDIES.devices.find(remedy => remedy.id === 'r_disconnect').id,REMEDIES.devices.find(remedy => remedy.id === 'r_disconnect').kind],
],[['r_sim_clean','resolve','t_simout',2],['r_move_guide','resolve','t_move'],['r_forget_guide','resolve'],['r_disconnect','resolve']],'§36 検査7: resolve対処のID・kind・needsTestが文言修正に紛れて変わっている');
assert(!functionSource('doApologize').includes('pendingResult') && !functionSource('doApologize').includes('closeTicket') && functionSource('doClose').includes('t.pendingResult = result'),'§36 検査8: 謝罪だけで終話でき、原因案内が不要になっている');
const progression36 = spawnSync(process.execPath,['progression_test.js'],{cwd:__dirname,encoding:'utf8'});
assert.equal(progression36.status,0,'§36 検査9: progression_testが通らない\n' + (progression36.stdout || '') + (progression36.stderr || ''));
assert(!/who:'note', text:'[^']*(?:症状が解消|原因を確定して案内|次の手を選)/.test(game),'§36 note監査: 次の手に必要な情報が非表示noteへ残っている');

// §37-6: S12は現地キャリアへ再開通を依頼し、完了結果を待ってから折り返す。
const s12Carrier37 = SCENARIOS.find(scenario => scenario.id === 'S12');
const carrierRequest37 = LOOKUPS.find(lookup => lookup.id === 'l_carrier');
const carrierRemedy37 = REMEDIES.provision.find(remedy => remedy.id === 'r_carrier_reopened_explain');
assert(carrierRequest37.label === '現地キャリアへ回線の再開通を依頼する' && /再開通を依頼/.test(CALL_FLOW_LINES.carrier.promise) && !/状態を問い合わせ/.test(carrierRequest37.label),'§37 検査1: l_carrierが「照会」ではなく「再開通の依頼」として扱われない');
assert(startCarrierSource25.includes('t.callbackDue = state.clock + lookup.minutes') && startCarrierSource25.includes("t.state = 'callback'") && startCarrierSource25.includes('state.focus = null'),'§37 検査2: 折り返しを約束して通話を切る従来フローがない');
const carrierProbabilityRaw37 = new Function('CARRIER_REPLY_RATE',functionSource('carrierReplyProbability') + '\nreturn carrierReplyProbability;')(CARRIER_REPLY_RATE);
const carrierProbability37 = () => carrierProbabilityRaw37(GAME_FLAGS);
assert.equal(CARRIER_REPLY_RATE,0.8,'§37 検査3: キャリア完了連絡の既定確率が80%ではない');
assert.equal(carrierProbabilityRaw37({luckRate:1}),1,'§37 検査4: luckRate 1.0でキャリア完了連絡が必ず届かない');
const carrierReference37 = new Function(functionSource('carrierReference') + '\nreturn carrierReference;')();
const makeResolveCarrier37 = state37 => new Function('state','carrierReplyProbability','recordOfficeEvent','carrierReference',functionSource('resolveCarrierRequest') + '\nreturn resolveCarrierRequest;')(
  state37,carrierProbability37,(kind,text) => state37.officeEvents.push({kind,text}),carrierReference37
);
const arrivedState37 = {clock:130,random:() => .79,officeEvents:[]};
const arrivedTicket37 = {carrierLookupStarted:true,carrierReplyStatus:'pending',callbackDue:130,s:s12Carrier37};
assert(makeResolveCarrier37(arrivedState37)(arrivedTicket37) && arrivedTicket37.carrierReplyStatus === 'arrived' && arrivedState37.officeEvents.some(event => /再開通を完了.*GDW-348621/.test(event.text)),'§37 検査5: 完了連絡が折り返し前にオフィスで分からない');
const missingState37 = {clock:130,random:() => .8,officeEvents:[]};
const missingTicket37 = {carrierLookupStarted:true,carrierReplyStatus:'pending',callbackDue:130,s:s12Carrier37};
assert(makeResolveCarrier37(missingState37)(missingTicket37) && missingTicket37.carrierReplyStatus === 'missing' && missingState37.officeEvents.some(event => /完了連絡は届いていません/.test(event.text)),'§37 検査6: 連絡が届かなかったことをオフィスで確認できない');
const frontDeskChoice37 = functionSource('handleFrontDeskChoice');
assert(/あ、さっきから使えてます/.test(CALL_FLOW_LINES.carrier.reopenedReplies.novice) && /ありがとう/.test(CALL_FLOW_LINES.carrier.reopenedReplies.novice) && frontDeskChoice37.indexOf('callbackCustomerReply(t)') < frontDeskChoice37.indexOf('finishCarrierLookup(t)'),'§37 検査7: 客室接続後に客が復旧と感謝を先に伝えない');
assert(carrierRemedy37 && carrierRemedy37.label === '契約情報の同期ずれで回線が停止していたこと、現地キャリアによる再開通が完了したことをご説明する' && carrierRemedy37.reportsRestored === true,'§37 検査8: 復旧後の対処が原因と復旧の説明になっていない');
assert(/まだ圏外|まだつなが/.test(CALL_FLOW_LINES.carrier.pendingReplies.novice) && /もう一度/.test(CALL_FLOW_LINES.carrier.pendingReplies.novice) && !missingTicket37.carrierRestored,'§37 検査9: 完了連絡なしでも回線が直り、客の落胆が出ない');
const finishCarrier37 = new Function('LOOKUPS','lookupSystemLine','addFact',functionSource('finishCarrierLookup') + '\nreturn finishCarrierLookup;')(LOOKUPS,() => ({who:'sys'}),() => {});
const retryTicket37 = {carrierLookupStarted:true,carrierReplyStatus:'missing',carrierRestored:false,lookedUp:new Set(),s:s12Carrier37,transcript:[]};
assert(finishCarrier37(retryTicket37) && !retryTicket37.carrierLookupStarted && !retryTicket37.lookedUp.has('l_carrier') && startCarrierSource25.includes("t.lookedUp.has(lookup.id)"),'§37 検査10: 完了連絡なしの後に再依頼できず解決経路が詰む');
assert(s12Carrier37.best === carrierRemedy37.id && carrierRemedy37.needsCarrierRestored === true && functionSource('doClose').includes('remedy.reportsRestored ? causeMatched && t.carrierRestored'),'§37 検査11: 再開通完了の説明が返金より高い最適評価にならない');
const verify37 = spawnSync(process.execPath,['verify.js'],{cwd:__dirname,encoding:'utf8'});
assert.equal(verify37.status,0,'§37 検査12: verifyが13案件を真因1つへ収束させない\n' + (verify37.stdout || '') + (verify37.stderr || ''));
const progression37 = spawnSync(process.execPath,['progression_test.js'],{cwd:__dirname,encoding:'utf8'});
assert.equal(progression37.status,0,'§37 検査10: 完了連絡なしを含む解決経路でprogression_testが通らない\n' + (progression37.stdout || '') + (progression37.stderr || ''));

// §38-6: 名前・年齢と土地bundleを、症状の土地制約を守ってシフトごとに割り当てる。
const identityModule38 = new Function(
  'SHIFT_START','PLACE_POOL','PLACE_CONSTRAINTS','IDENTITY_POOL','shuffleScenarios',
  [
    functionSource('scenarioLocalMinute'),functionSource('placeAllowedForScenario'),functionSource('scenarioNeedsSharedRegion'),functionSource('assignScenarioPlaces'),
    functionSource('replaceScenarioTemplates'),functionSource('scenarioWithIdentityAndPlace'),functionSource('assignScenarioIdentities'),
  ].join('\n') + '\nreturn {scenarioLocalMinute,placeAllowedForScenario,assignScenarioPlaces,replaceScenarioTemplates,scenarioWithIdentityAndPlace,assignScenarioIdentities};'
)(22 * 60,PLACE_POOL,PLACE_CONSTRAINTS,IDENTITY_POOL,shuffleScenarios);
const identitySelection38 = ['S4','S5','S6','S12','S13'].map((id,index) => Object.assign({},SCENARIOS.find(scenario => scenario.id === id),{arrive:[0,5,11,18,25][index]}));
const assigned38 = identityModule38.assignScenarioIdentities(identitySelection38,() => .37,{shuffleIdentity:true});
const byId38 = id => assigned38.find(scenario => scenario.id === id);
assert(assigned38.every(scenario => IDENTITY_POOL.some(identity => identity.name === scenario.name && identity.nameEn === scenario.nameEn && identity.age === scenario.age)) && IDENTITY_POOL.every(identity => /^[A-Za-z]+(?: [A-Za-z]+)+$/.test(identity.nameEn)) && new Set(assigned38.map(scenario => scenario.name)).size === assigned38.length && new Set(assigned38.map(scenario => scenario.nameEn)).size === assigned38.length && assigned38.some(scenario => scenario.name !== SCENARIOS.find(raw => raw.id === scenario.id).name),'§38 検査1: 名前・ローマ字・年齢が案件から切り離され、シフトごとに割り当てられない');
assert(assigned38.every(scenario => PLACE_POOL.some(place => place.country === scenario.country && place.city === scenario.city && place.cityEn === scenario.cityEn && place.localOffset === scenario.localOffset && place.carrier === scenario.carrierName)),'§38 検査2: 国・都市・cityEn・localOffset・キャリアが1組で割り当てられない');
const scenarioStrings38 = scenario => {
  const strings = [];
  const walk = (value,key) => {
    if (typeof value === 'string'){ if (!['name','country','city','cityEn','carrierName','regionName'].includes(key)) strings.push(value); return; }
    if (Array.isArray(value)){ value.forEach(item => walk(item,key)); return; }
    if (value && typeof value === 'object') Object.entries(value).forEach(([childKey,item]) => walk(item,childKey));
  };
  walk(scenario,'scenario');
  return strings;
};
const fixedCities38 = PLACE_POOL.map(place => place.city);
assert(SCENARIOS.every(scenario => !scenarioStrings38(scenario).some(text => fixedCities38.some(city => text.includes(city)))) && assigned38.every(scenario => !scenarioStrings38(scenario).some(text => /\{(?:city|country|carrier|region|wrongCountry)\}/.test(text))),'§38 検査3: 台詞・照会結果に固定都市名または未解決の差し込みが残っている');
assert(!scenarioStrings38(SCENARIOS.find(scenario => scenario.id === 'S9')).some(text => /ノイバイ/.test(text)),'§38 検査4: 固有空港名が一般名詞へ直されていない');
assert(!SCENARIOS.some(scenario => scenario.city.includes('近郊')) && !scenarioStrings38(SCENARIOS.find(scenario => scenario.id === 'S7')).some(text => /バルセロナ近郊/.test(text)),'§38 検査5: 都市名に地形を含む固定表現が残っている');
const provision38 = byId38('S12');
const provisionMinute38 = identityModule38.scenarioLocalMinute(provision38,provision38);
assert(provisionMinute38 >= 22 * 60 || provisionMinute38 < 4 * 60,'§38 検査6: S12が日付境界の話として成立しない時差の土地へ割り当てられる');
assert(byId38('S4').cityEn === 'SHANGHAI' && /中国/.test(byId38('S4').country),'§38 検査6-1: geo_block案件が中国以外へ割り当てられる');
assert(Object.keys(PLACE_CONSTRAINTS).every(cause => {
  if (PLACE_CONSTRAINTS[cause] === 'shared_region') return PLACE_POOL.some(place => place.regionGroup && PLACE_POOL.filter(other => other.regionGroup === place.regionGroup).length >= 2);
  const scenario = SCENARIOS.find(item => item.trueCause === cause);
  return scenario && PLACE_POOL.some(place => identityModule38.placeAllowedForScenario(scenario,place));
}),'§38 検査6-2: 土地を選ぶ症状に割り当て可能な土地がない');
assert(byId38('S5').regionGroup && byId38('S5').regionGroup === byId38('S6').regionGroup && byId38('S5').city !== byId38('S6').city,'§38 検査6-3: S5/S6が同じ地域の別都市へ割り当てられない');
const s9Texts38 = scenarioStrings38(SCENARIOS.find(scenario => scenario.id === 'S9'));
assert(!s9Texts38.some(text => /20時|22時|\d{1,2}:\d{2}/.test(text)) && s9Texts38.some(text => /営業時間外|臨時閉鎖/.test(text)),'§38 検査6-4: S9に固定時刻が残る、または営業時間外の芯が消えている');
const s13Assigned38 = byId38('S13');
assert(s13Assigned38.wrongCountry !== s13Assigned38.country && s13Assigned38.lookups.l_ship.text.includes(s13Assigned38.wrongCountry + '向けSIM') && s13Assigned38.lookups.l_ship.text.includes('申込: ' + s13Assigned38.country),'§38 検査6-5: S13の貸出品が申込国と別の土地から差し込まれない');
assert(assigned38.every(scenario => !scenario.panel || scenario.panel.carrier === null || scenario.panel.carrier === scenario.carrierName) && assigned38.every(scenario => PLACE_POOL.some(place => place.city === scenario.city && place.carrier === scenario.carrierName)),'§38 検査6-6: キャリア名が土地プールに含まれず割り当て土地と一致しない');
assert(!/B20|\b(?:700|800|900|1800|2100|2600)MHz\b/.test(SCENARIOS.find(scenario => scenario.id === 'S7').lookups.l_area.text) && /郊外をカバーする周波数帯/.test(SCENARIOS.find(scenario => scenario.id === 'S7').lookups.l_area.text),'§38 検査6-7: 周波数帯の具体名が残っている');
const s2Texts38 = scenarioStrings38(SCENARIOS.find(scenario => scenario.id === 'S2'));
assert(!s2Texts38.some(text => /同行.{0,8}(?:いま|今).{0,8}待たせ|待たせて(?:います|いる|ます)/.test(text)),'§38 検査6-8: S2に同行者をいま待たせている現在進行が残っている');
assert(!s9Texts38.some(text => /退勤済み|退勤した/.test(text)) && s9Texts38.some(text => /担当者も不在/.test(text)),'§38 検査6-9: S9が時間帯に依存しない担当者不在の表現になっていない');
const s11Texts38 = scenarioStrings38(SCENARIOS.find(scenario => scenario.id === 'S11'));
assert(!s11Texts38.some(text => /会議開始まで|開始まで\d+分|残り\d+分|これから始まる|間に合った/.test(text)) && s11Texts38.some(text => /会議場/.test(text)) && s11Texts38.some(text => /地下/.test(text)),'§38 検査6-10: S11の会議カウントダウンが消えていない、または会議場・地下の芯が消えている');
assert(!TYPES.hurried.angry.some(text => /会議が始まる/.test(text)) && TYPES.hurried.angry.some(text => /次の予定が迫って/.test(text)),'§38 検査6-11: hurried共通文が予定一般の表現になっていない');
assert.deepEqual(PLACE_CONSTRAINTS,{geo_block:'china_only',provision:'deep_night'},'§38 検査6-12: 土地の制約がgeo_blockとprovisionの2つだけではない');
assert(!SCENARIOS.some(scenario => Object.prototype.hasOwnProperty.call(scenario,'timeConstraint')) && !functionSource('placeAllowedForScenario').includes('timeConstraint'),'§38 検査6-12: 案件固有の追加土地・時間帯制約が残っている');
assert(!SCENARIOS.filter(scenario => scenario.id !== 'S12').flatMap(scenarioStrings38).some(text => /現地(?:はいま|時刻は).*\d|日付が変わった瞬間/.test(text)),'§38 検査7: S12以外に土地と矛盾する固定の現地時刻・昼夜表現が残っている');
assert(new Set(assigned38.map(scenario => scenario.name)).size === assigned38.length && new Set(assigned38.map(scenario => scenario.placeSourceScenarioId)).size === assigned38.length && new Set(PLACE_POOL.map(place => place.city)).size === PLACE_POOL.length,'§38 検査8: 同じ名前または同じ土地が一晩に二度出る');
const unshuffled38 = identityModule38.assignScenarioIdentities(SCENARIOS,() => .37,{shuffleIdentity:false});
assert(unshuffled38.every((scenario,index) => scenario.name === SCENARIOS[index].name && scenario.nameEn === SCENARIOS[index].nameEn && scenario.age === SCENARIOS[index].age && scenario.city === SCENARIOS[index].city && scenario.country === SCENARIOS[index].country && scenario.localOffset === SCENARIOS[index].localOffset),'§38 検査9: shuffleIdentity falseで案件データどおりの割り当てに戻らない');
assert(assigned38.every(scenario => {
  const raw = SCENARIOS.find(item => item.id === scenario.id);
  return scenario.type === raw.type && scenario.trueCause === raw.trueCause && scenario.best === raw.best && JSON.stringify(scenario.partial || []) === JSON.stringify(raw.partial || []);
}),'§38 検査10: 症状・タイプ・真因・対処までシャッフルされている');
const verify38 = spawnSync(process.execPath,['verify.js'],{cwd:__dirname,encoding:'utf8'});
assert.equal(verify38.status,0,'§38 検査11: verifyが13案件を真因1つへ収束させない\n' + (verify38.stdout || '') + (verify38.stderr || ''));
const progression38 = spawnSync(process.execPath,['progression_test.js'],{cwd:__dirname,encoding:'utf8'});
assert.equal(progression38.status,0,'§38 検査12: progression_testが通らない\n' + (progression38.stdout || '') + (progression38.stderr || ''));

// §39-8: 客の国際通話料を止め、ホテルのFront Deskを英語で通して折り返す。
const callCost39 = new Function('CALL_RATE_PER_MIN',functionSource('callCost') + '\nreturn callCost;')(180);
const customerCallCost39 = new Function('CALL_RATE_PER_MIN',functionSource('customerCallCost') + '\nreturn customerCallCost;')(180);
assert.equal(callCost39({inboundMinutes:8,outboundMinutes:0}),0,'§39 検査1: 客からかかってきた通話の料金が会社費用に計上される');
assert.equal(customerCallCost39({inboundMinutes:8,outboundMinutes:0}),1440,'§39 検査1: 客負担の国際通話料を追跡できない');
assert.equal(callCost39({inboundMinutes:8,outboundMinutes:3}),540,'§39 検査2: 折り返した通話の料金が会社費用に計上されない');
const totalCost39 = new Function('state','callCost',functionSource('totalCost') + '\nreturn totalCost;')({cost:100,tickets:[{outboundMinutes:3},{outboundMinutes:0}]},callCost39);
assert.equal(totalCost39(),640,'§39 検査1/2: totalCostが入電と折り返しの負担を分離しない');

const renderHeader39 = new Function('esc','CALL_RATE_PER_MIN',functionSource('renderCallHeader') + '\nreturn renderCallHeader;')(value => String(value),180);
assert(/通話 08分[\s\S]*お客様負担 ¥1,440/.test(renderHeader39({s:{id:'S1'},callDirection:'inbound',callSegmentMinutes:8})) && /通話 03分[\s\S]*当社負担 ¥540/.test(renderHeader39({s:{id:'S1'},callDirection:'outbound',callSegmentMinutes:3})),'§39 検査3: 通話ヘッダに時間・負担者・費用が揃わない');

assert.deepEqual(Object.keys(CALL_FLOW_LINES.callChargeConcern).sort(),['anxious','expert','hurried','novice'],'§39 検査4: 通話料を気にする発話が4タイプ分ない');
assert.equal(new Set(Object.values(CALL_FLOW_LINES.callChargeConcern)).size,4,'§39 検査4: 通話料を気にする発話がタイプ別に書き分けられていない');
const spend39 = new Function('CALL_FLOW_LINES','advance','pushCustomerLine','changeStress','addStress',functionSource('spendOnCall') + '\nreturn spendOnCall;')(
  CALL_FLOW_LINES,() => {},(ticket,text) => ticket.concerns.push(text),(ticket,delta) => { ticket.stress += delta; return true; },() => true
);
Object.keys(TYPES).forEach(type => {
  const ticket = {s:{type},state:'open',pendingResult:null,callMinutes:5,inboundMinutes:5,outboundMinutes:0,callSegmentMinutes:5,callDirection:'inbound',holdMinutes:0,callChargeConcerned:false,stress:10,concerns:[]};
  assert(spend39(ticket,1,0) && ticket.concerns[0] === CALL_FLOW_LINES.callChargeConcern[type] && ticket.stress === 14,'§39 検査4: 5分超でタイプ別発話と小さな苛立ち増が起きない');
  spend39(ticket,1,0);
  assert.equal(ticket.concerns.length,1,'§39 検査5: 通話料を気にする発話を繰り返す');
});

// §40: 折り返しは滞在先の有無にかかわらず選べる。未確認なら注意書きが変わる。
assert(hotelCallbackSub({asked:new Set(),stayAddress:null,callChargeConcerned:true}) === '滞在先はまだ伺っていません。','§40 滞在先未確認の折り返しに注意書きが出ない');
assert(hotelCallbackSub({asked:new Set(['q_stay']),stayAddress:'ホテル、512号室',callChargeConcerned:true}).includes('国際通話料'),'§40 通話料を気にしている客への折り返し案内が出ない');
assert(hotelCallbackOffered({callDirection:'inbound'}) && !hotelCallbackOffered({callDirection:'outbound'}),'§40 折り返し中の通話にも折り返しが出る');
assert(!hotelCallbackOffered({callDirection:'inbound',callbackPromised:'immediate'}),'§45 約束したあとも「伝える」に折り返しが残る');
const startState39 = {clock:100,turn:7,focus:null,ui:{tab:'command'}};
const startHotel39 = new Function('CALL_FLOW_LINES','state','spendOnCall','pushFlowLines','defaultUi','render',functionSource('startHotelCallback') + '\nreturn startHotelCallback;')(
  CALL_FLOW_LINES,startState39,() => true,(ticket,lines) => ticket.transcript.push(...lines),() => ({tab:'command'}),() => {}
);
const finishHotel45 = new Function('CALL_FLOW_LINES','state','spendOnCall','defaultUi','playDisconnectSound','enterOffice','blindCallbackRedial','CALLBACK_SCHEDULED_MINUTES',functionSource('finishPromisedCallback') + '\nreturn finishPromisedCallback;')(
  CALL_FLOW_LINES,startState39,() => true,() => ({tab:'command'}),() => {},() => {},ticket => { ticket.blind = true; },CALLBACK_SCHEDULED_MINUTES
);

// §45 検査1: 折り返しを申し出ても、その場では通話が終わらない。
const promised45 = {asked:new Set(['q_stay']),stayAddress:'ホテル、512号室',transcript:[],callbackCount:0,state:'open',callbackPromised:null};
startState39.focus = promised45; startHotel39('immediate');
assert(promised45.callbackPromised === 'immediate' && promised45.state === 'open' && startState39.focus === promised45,'§45 検査1: 折り返しの申し出がその場で通話を終わらせる');
assert(promised45.callbackCount === 0,'§45 検査1: 申し出だけで折り返し回数が増える');

// §45 検査3: 二重に約束できない。
startHotel45Twice = promised45.transcript.length;
startHotel39('scheduled');
assert(promised45.callbackPromised === 'immediate' && promised45.transcript.length === startHotel45Twice,'§45 検査3: 約束したあともう一度折り返しを申し出られる');

// §45 検査5: 「電話を切る」で折り返し待ちへ入る。
finishHotel45(promised45);
assert(promised45.state === 'callback' && promised45.callbackCount === 1 && promised45.callbackPromised === null && startState39.focus === null,'§45 検査5: 切っても折り返し待ちへ入らない');
assert(promised45.callbackDue === startState39.clock,'§45 検査5: いますぐの折り返し時刻が現在時刻でない');

// §45 検査2: 1時間後を選ぶと、折り返し時刻が60分後になる。
const scheduled45 = {asked:new Set(['q_stay']),stayAddress:'ホテル、512号室',transcript:[],callbackCount:0,state:'open',callbackPromised:null};
startState39.focus = scheduled45; startHotel39('scheduled');
finishHotel45(scheduled45);
assert(scheduled45.callbackDue === startState39.clock + CALLBACK_SCHEDULED_MINUTES,'§45 検査2: 1時間後の折り返し時刻が60分後でない');

// §40/§45 検査6: 滞在先を聞かずに切ると、折り返せなかった扱いになる（既存の経路を使う）。
const noStay39 = {asked:new Set(),stayAddress:null,transcript:[],callbackCount:0,state:'open',callbackPromised:null};
startState39.focus = noStay39; startHotel39('immediate');
assert(!noStay39.blind && noStay39.callbackPromised === 'immediate','§45 検査6: 滞在先未確認でも申し出の時点では失敗にしない');
finishHotel45(noStay39);
assert(noStay39.blind && noStay39.state === 'open' && noStay39.callbackCount === 0,'§40 滞在先未確認の折り返しが、折り返せなかった扱いにならない');

// §45 検査7: 切る前の案内に、何が足りていないかが出る。
const guide45 = functionSource('unresolvedHangupGuide');
const guideFn45 = new Function('CALL_FLOW_LINES','hotCauses',guide45 + '\nreturn unresolvedHangupGuide;')(CALL_FLOW_LINES,() => new Set());
assert(guideFn45({callbackPromised:'immediate',asked:new Set(),stayAddress:null}).includes(CALL_FLOW_LINES.callbackPromise.guideNoAddress),'§45 検査7: 滞在先未確認のまま切る案内が出ない');
assert(guideFn45({callbackPromised:'immediate',asked:new Set(['q_stay']),stayAddress:'ホテル',returnTimeKnown:false}).includes(CALL_FLOW_LINES.callbackPromise.guideNoReturn),'§45 検査7: 戻る時間が未確認であることを知らせない');
assert(guideFn45({callbackPromised:'immediate',asked:new Set(['q_stay']),stayAddress:'ホテル',returnTimeKnown:true}).includes(CALL_FLOW_LINES.callbackPromise.guideReady),'§45 検査7: 折り返し先が揃っていることを知らせない');

// §45 検査9/10: 戻る時間の質問は、約束したあとにだけ出る。聞かなくても折り返しは成立する。
const returnQ45 = QUESTIONS.find(q => q.id === 'q_return');
assert(returnQ45 && returnQ45.needsCallbackPromise === true,'§45 検査9: q_return が約束後限定になっていない');
assert(SCENARIOS.every(scenario => (scenario.replies || {}).q_return && (scenario.replies.q_return.text || '').length > 0),'§45 検査9: q_return の答えがない案件がある');
assert(new Set(SCENARIOS.map(scenario => scenario.replies.q_return.text)).size === SCENARIOS.length,'§45 検査9: q_return の答えが案件どうしで重複している');
assert(!functionSource('finishPromisedCallback').includes('returnTimeKnown'),'§45 検査10: 戻る時間を聞かないと折り返せない');
// 折り返せなかった客は、責めながら自分で掛け直してくる。
const blindRedial39 = new Function('CALL_FLOW_LINES','state','BLIND_CALLBACK_STRESS','BLIND_CALLBACK_CSAT_PENALTY','spendOnCall','addStress','defaultUi','playDisconnectSound','recordOfficeEvent','customerLabel','enterOffice','render',functionSource('blindCallbackRedial') + '\nreturn blindCallbackRedial;')(
  CALL_FLOW_LINES,startState39,BLIND_CALLBACK_STRESS,BLIND_CALLBACK_CSAT_PENALTY,() => true,() => true,() => ({tab:'command'}),() => {},() => {},() => 'お客様',() => {},() => {}
);
const blind39 = {s:{type:'hurried'},asked:new Set(),stayAddress:null,transcript:[],redialCount:0,state:'open'};
startState39.focus = blind39; blindRedial39(blind39);
assert(blind39.state === 'waiting' && blind39.arrivedTurn === 7 && blind39.redialCount === 1,'§40 折り返せなかった案件が待ち行列へ戻らない');
assert(blind39.redialOpening === CALL_FLOW_LINES.callback.blameOpenings.hurried && blind39.callbackPenalty === BLIND_CALLBACK_CSAT_PENALTY,'§40 再入電の非難とCSATの重みが付いていない');
assert(blind39.transcript.some(line => line.who === 'note' && line.text === CALL_FLOW_LINES.callback.noAddressNote),'§40 折り返せない理由が記録に残らない');
const readyStay39 = {asked:new Set(['q_stay']),stayAddress:'ホテル、512号室',transcript:[],callbackCount:0,state:'open',callbackPromised:null};
startState39.focus = readyStay39; startHotel39('immediate'); finishHotel45(readyStay39);
assert(readyStay39.state === 'callback' && readyStay39.callbackReason === 'general' && readyStay39.callbackDue === 100 && startState39.focus === null,'§39 検査14: l_carrier以外から一般折り返しを開始できない');

const resume39 = functionSource('resumeCallback');
assert(resume39.includes("t.callbackStage = 'front_desk'") && resume39.includes("who:'front'") && resume39.includes('CALL_FLOW_LINES.frontDesk.greeting'),'§39 検査7: 折り返すと最初にFront Deskへつながらない');
const frontOptions39 = Object.values(CALL_FLOW_LINES.frontDesk.options);
assert(frontOptions39.length === 3 && frontOptions39.every(line => /^[\x20-\x7E]+$/.test(line)) && functionSource('renderFrontDeskOptions').includes('Please choose what to say in English.'),'§39 検査8: Front Deskの発話と選択肢が平易な英語で揃わない');
assert(functionSource('renderTranscript').includes("front:'Front Desk'") && functionSource('handleFrontDeskChoice').includes("{ who:'cust', text:callbackCustomerReply(t) }"),'§39 検査9: 客室接続後に話者がFront Deskから客へ切り替わらない');
const renderFront39 = new Function('CALL_FLOW_LINES','esc','renderCommandHead',functionSource('hotelRoom') + '\n' + functionSource('renderFrontDeskOptions') + '\nreturn renderFrontDeskOptions;')(
  CALL_FLOW_LINES,value => String(value),() => '<div class="head">Front Desk</div>'
);
const frontGreeting39 = CALL_FLOW_LINES.frontDesk.greeting;
const unknownRoomFront39 = renderFront39({nameKnown:true,stayAddress:'ホテル名のみ',s:{name:'試験 顧客',nameEn:'Test Customer'},transcript:[{who:'front',text:frontGreeting39,typed:true}]});
assert(unknownRoomFront39.includes('front-desk-context') && unknownRoomFront39.includes('Front Desk') && unknownRoomFront39.includes(frontGreeting39),'§39 検査7: Front Deskの発話が選択画面に表示されない');
assert(unknownRoomFront39.includes('Test Customer') && !unknownRoomFront39.includes('試験 顧客'),'§39 検査8: Front Deskへ伝える顧客名がローマ字になっていない');
assert(!unknownRoomFront39.includes('data-front-desk="room"') && !unknownRoomFront39.includes('—'),'§39 検査8: 部屋番号不明時にroom選択肢またはダッシュが表示される');
const knownRoomFront39 = renderFront39({nameKnown:true,stayAddress:'ホテル、512号室',s:{name:'試験 顧客',nameEn:'Test Customer'},transcript:[{who:'front',text:frontGreeting39,typed:true}]});
assert(knownRoomFront39.includes('data-front-desk="room"') && knownRoomFront39.includes('512'),'§39 検査8: 部屋番号判明後もroom選択肢が表示されない');

const localModule39 = new Function('state',functionSource('ticketLocalMinute') + '\n' + functionSource('isLateLocalTime') + '\nreturn {ticketLocalMinute,isLateLocalTime};');
const lateLocal39 = localModule39({clock:22*60});
assert.equal(localModule39({clock:10*60}).ticketLocalMinute({s:{localOffset:-5}}),20*60,'§39 検査13: 現地時刻が割り当て土地のlocalOffsetから計算されない');
assert(lateLocal39.isLateLocalTime({s:{localOffset:9}}) && !localModule39({clock:21*60}).isLateLocalTime({s:{localOffset:9}}),'§39 検査10: 現地22時以降の深夜判定ができない');
assert(resume39.includes('isLateLocalTime(t)') && resume39.includes('CALL_FLOW_LINES.frontDesk.lateQuestion'),'§39 検査10: 深夜のFront Deskが難色を示さない');

const frontState39 = {clock:22*60,focus:null,ui:{tab:'command'}};
const frontModule39 = new Function('state','CALL_FLOW_LINES','spendOnCall','pushFlowLines','applyCallbackWaitStress','finishCarrierLookup','defaultUi','render',[
  functionSource('ticketLocalMinute'),functionSource('isLateLocalTime'),functionSource('hotelRoom'),functionSource('callbackCustomerReply'),functionSource('handleFrontDeskChoice'),
].join('\n') + '\nreturn handleFrontDeskChoice;')(
  frontState39,CALL_FLOW_LINES,(ticket,minutes) => { ticket.spent = minutes; return true; },(ticket,lines) => ticket.lines = lines,() => {},() => true,() => ({tab:'command'}),() => {}
);
const makeFrontTicket39 = () => ({callbackStage:'front_desk',callbackReason:'general',nameKnown:true,stayAddress:'ホテル、512号室',s:{name:'試験 顧客',nameEn:'Test Customer',type:'novice',localOffset:9,lookups:{}},transcript:[],frontDeskAttempts:0});
const directFront39 = makeFrontTicket39(); frontState39.focus = directFront39; frontModule39('callback');
assert(directFront39.callbackStage === 'connected' && directFront39.spent === 1 && directFront39.lines[0].text === CALL_FLOW_LINES.frontDesk.connect,'§39 検査11: 折り返しと伝えてもFront Deskが円滑につながない');
['guest','room'].forEach(choice => {
  const ticket = makeFrontTicket39(); frontState39.focus = ticket; frontModule39(choice);
  assert(ticket.callbackStage === 'connected' && ticket.spent === 2 && ticket.lines.some(line => line.who === 'cust'),'§39 検査12: 別の英語選択肢で客室へつながらず詰む');
});
assert(functionSource('finishPromisedCallback').includes("t.callbackReason = 'general'") && !functionSource('finishPromisedCallback').includes('l_carrier'),'§39 検査14: 一般折り返しがl_carrier専用のまま');
const progression39 = spawnSync(process.execPath,['progression_test.js'],{cwd:__dirname,encoding:'utf8'});
assert.equal(progression39.status,0,'§39 検査15: progression_testが通らない\n' + (progression39.stdout || '') + (progression39.stderr || ''));

// §41: 氏名だけでは顧客レコードを開かず、既存の本人特定契約を守る。
const customerRecord41 = functionSource('renderCustomerRecord') + functionSource('recordValue');
assert(customerRecord41.includes('const identified = identificationReady(t);') && customerRecord41.includes('―― 未照会'), '§41-11 本人確認前または未照会欄が伏せられない');

// 編集用の3素材と配布用 index.html は、build.js と同じ規則で完全一致する。
const expectedIndex = builtIndexSource(__dirname);
assert.equal(fs.readFileSync(__dirname + '/index.html', 'utf8'), expectedIndex, 'index.html が編集用素材から再生成されていない');

console.log('UI契約・素材同期・SIM清掃仕様: 問題なし');
