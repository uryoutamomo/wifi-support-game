/* ビジュアル追加でゲームの中身が変わっていないかを、ことの手元の期待値と突き合わせる */
const fs = require('fs');
const { readGameSource, functionSource: extractFunctionSource } = require('./test_helpers');
const src = fs.readFileSync(__dirname + '/p2_data.js', 'utf8') +
  '\nreturn {CAUSES,TYPES,QUESTIONS,QUESTION_GROUPS,LOOKUPS,TESTS,RISKY,REMEDIES,SCENARIOS,SOOTHES,SOOTHE_EFFECTS,SMALLTALK_EFFECTS,IDENTITY_CALMING_EFFECTS,APOLOGIES,APOLOGY_REPLIES,FAREWELL_LINES,REDIAL_OPENINGS,REDIAL_STRESS,COMMAND_DEFS,SLOGANS,OFFICE_PALETTE,MORNING_OFFICE_PALETTE,OFFICE_STATIONS,MORNING_STAFF,ARTIFACT_URL,ARTIFACT_QR,ARTIFACT_QR_QUIET_ZONE,LUCK_RATE,GAME_FLAGS,CAREER_STORAGE_KEY,CAREER_VERSION,CAREER_STAGES,CAREER_BADGES,PRESIDENT_ENDING_LINE,REFUND_POLICY,ANGRY_DEFAULT_OUTCOMES,ANGRY_END_LINES,COMPLAINT_EMAIL_TEMPLATES,CALL_FLOW_LINES};';
const D = new Function(src)();
const { CAUSES, TYPES, SCENARIOS, LOOKUPS, QUESTIONS, QUESTION_GROUPS, REMEDIES, SOOTHES, SOOTHE_EFFECTS, SMALLTALK_EFFECTS, IDENTITY_CALMING_EFFECTS, APOLOGIES, APOLOGY_REPLIES, FAREWELL_LINES, REDIAL_OPENINGS, REDIAL_STRESS, COMMAND_DEFS, SLOGANS, OFFICE_PALETTE, MORNING_OFFICE_PALETTE, OFFICE_STATIONS, MORNING_STAFF, ARTIFACT_QR, ARTIFACT_QR_QUIET_ZONE, LUCK_RATE, GAME_FLAGS, CAREER_STORAGE_KEY, CAREER_VERSION, CAREER_STAGES, CAREER_BADGES, PRESIDENT_ENDING_LINE, REFUND_POLICY, ANGRY_DEFAULT_OUTCOMES, ANGRY_END_LINES, COMPLAINT_EMAIL_TEMPLATES, CALL_FLOW_LINES } = D;

const EXPECTED_SLOGANS = [
  '凡事徹底',
  'クイックレスポンス',
  '顧客目線',
  'たゆまぬベンチャーマインド',
  '上場まで1000日',
  'ボーリングのセンターピンを抑えろ',
];

// 現在の正解仕様。S8 は内田さんの明示指示でSIM清掃を第一選択に更新した。
const EXPECT = {
  S1: { cause:'fup',         best:'r_topup',           noOut:null,               partial:['r_slow_ok'],      tone:'warm' },
  S2: { cause:'device_side', best:'r_forget_guide',    noOut:null,               partial:['r_use_other'],    tone:'warm' },
  S3: { cause:'devices',     best:'r_disconnect',      noOut:null,               partial:['r_second_unit'],  tone:'brief' },
  S4: { cause:'geo_block',   best:'r_vpn_plan',        noOut:null,               partial:['r_explain_block'],tone:'technical' },
  S5: { cause:'carrier',     best:'r_outage_explain',  noOut:'r_escalate_line',  partial:['r_escalate_line'],tone:'warm' },
  S6: { cause:'carrier',     best:'r_outage_explain',  noOut:'r_escalate_line',  partial:['r_escalate_line'],tone:'brief' },
  S7: { cause:'coverage',    best:'r_escalate_band',   noOut:null,               partial:['r_city_only'],    tone:'technical' },
  S8: { cause:'sim',         best:'r_sim_clean',       noOut:null,               partial:['r_escalate_swap'],tone:'warm' },
  S9: { cause:'logistics',   best:'r_transfer_logi',   noOut:null,               partial:['r_come_tomorrow'],tone:'brief' },
  S10:{ cause:'hardware',    best:'r_hardware_swap',   noOut:null,               partial:['r_hardware_no_swap'],tone:'warm' },
  S11:{ cause:'location',    best:'r_move_guide',      noOut:null,               partial:['r_window_stationary'],tone:'brief' },
  S12:{ cause:'provision',   best:'r_escalate_prov',   noOut:null,               partial:[],                 tone:'warm' },
};

// 依頼で渡した液晶データ
const PANEL = {
  S1:{ bars:3, carrier:'AIS',          sim:'ok',   throttle:true,  clients:2, battery:62 },
  S2:{ bars:4, carrier:'Vodafone UK',  sim:'ok',   throttle:false, clients:3, battery:71 },
  S3:{ bars:4, carrier:'T-Mobile US',  sim:'ok',   throttle:false, clients:5, battery:55 },
  S4:{ bars:4, carrier:'China Unicom', sim:'ok',   throttle:false, clients:2, battery:80 },
  S5:{ bars:0, carrier:null,           sim:'ok',   throttle:false, clients:2, battery:45 },
  S6:{ bars:0, carrier:null,           sim:'ok',   throttle:false, clients:2, battery:38 },
  S7:{ bars:0, carrier:null,           sim:'ok',   throttle:false, clients:3, battery:66 },
  S8:{ bars:null, carrier:null,        sim:'none', throttle:false, clients:0, battery:80 },
  S9:null,
  S10:{ bars:null, carrier:null,        sim:'none', throttle:false, clients:0, battery:76 },
  S11:{ bars:1, carrier:'TIM',          sim:'ok',   throttle:false, clients:2, battery:68 },
  S12:{ bars:0, carrier:null,           sim:'ok',   throttle:false, clients:2, battery:73 },
};

let ng = 0;
const bad = (m) => { console.log('  NG  ' + m); ng++; };

if (JSON.stringify(SLOGANS) !== JSON.stringify(EXPECTED_SLOGANS)) bad('SLOGANS が確定6文言・順番と一致しない');
if (SLOGANS.some(slogan => !slogan)) bad('SLOGANS に空文字がある');
if (LUCK_RATE !== 0.9) bad('運の本来どおり率が0.9ではない');
if (JSON.stringify(GAME_FLAGS) !== JSON.stringify({luckRate:0.9,shuffleArrival:true,dailyTickets:null,careerStage:null,unlockedBadges:null,solvedScenarios:null,soundEnabled:true,soundVolume:0.55})) bad('運・音・1日件数・キャリアの初期GAME_FLAGSが確定値と違う');
if (JSON.stringify(REFUND_POLICY) !== JSON.stringify({
  amount:2400,
  company:{causes:['hardware','provision','logistics','carrier','coverage'],satisfactionRate:0.5},
  customer:{causes:['fup','devices','heavy','device_side','device_net','power'],satisfactionRate:0.1},
  neutral:{causes:['location','geo_block','sim'],satisfactionRate:0.25},
})) bad('返金の金額・14原因分類・満足率が確定値と違う');
const refundCauseIds = ['company','customer','neutral'].flatMap(group => REFUND_POLICY[group].causes);
if (refundCauseIds.length !== CAUSES.length || new Set(refundCauseIds).size !== CAUSES.length || !CAUSES.every(cause => refundCauseIds.includes(cause.id))) bad('返金の責任所在で14原因に欠落・重複がある');

const officeColors = Object.values(OFFICE_PALETTE);
if (officeColors.length > 16 || new Set(officeColors).size > 16) bad('オフィスのドット絵パレットが16色を超えている');
if (OFFICE_STATIONS.length < 5) bad('島型デスクの席数が不足している');
if (OFFICE_STATIONS.filter(station => station.active).length !== 1) bad('点灯モニターが自席の1台だけではない');
if (ARTIFACT_QR.length !== 33) bad('公開ページQRが33行ではない');
if (ARTIFACT_QR.some(row => row.length !== 33 || /[^01]/.test(row))) bad('公開ページQRが33文字の0/1パターンではない');
if (ARTIFACT_QR_QUIET_ZONE !== 4) bad('公開ページQRのクワイエットゾーンが4モジュールではない');

const EXPECTED_FAREWELLS = {
  best:{
    anxious:'本当に戻った…！ 最後までいてくださって、ありがとうございました。',
    novice:'まあ、私にもできました。何度も丁寧に、ありがとうございました。',
    hurried:'直った。間に合う。ありがとう。',
    expert:'復旧を確認しました。切り分けも妥当でした。ありがとうございます。',
  },
  partial:'…分かりました。まだ心配ですが、その方法で様子を見ます。',
  poor:'……承知しました。これ以上は結構です。',
};
if (JSON.stringify(FAREWELL_LINES) !== JSON.stringify(EXPECTED_FAREWELLS)) bad('解決度・顧客タイプ別の別れの言葉が確定本文と違う');
if (JSON.stringify(REDIAL_OPENINGS) !== JSON.stringify({
  calm:'あの…切れましたよね？ 私、置いていかれたのかと思って…。',
  direct:'いま切りましたね。理由を短く説明してください。',
})) bad('途中切断後の再着信第一声が確定本文と違う');
if (REDIAL_STRESS !== 25) bad('途中切断の基本ストレスが+25ではない');

const EXPECTED_QUESTION_GROUPS = [
  { id:'customer', no:'1', label:'顧客のこと', questionIds:['q_name','q_contract','q_stay','q_stay_length','q_replacement'] },
  { id:'local', no:'2', label:'現地のこと', questionIds:['q_destination','q_where','q_moved'] },
  { id:'device', no:'3', label:'本体のこと', questionIds:['q_lamp','q_battery','q_ssid'] },
  { id:'symptom', no:'4', label:'症状のこと', questionIds:['q_other_device','q_when','q_count','q_what_fails'] },
];
if (JSON.stringify(QUESTION_GROUPS) !== JSON.stringify(EXPECTED_QUESTION_GROUPS)) bad('聞くの4区分と質問の内訳が確定表と違う');
const groupedQuestionIds = QUESTION_GROUPS.flatMap(group => group.questionIds);
if (groupedQuestionIds.length !== QUESTIONS.length) bad('15問すべてがちょうど1区分に入っていない');
if (new Set(groupedQuestionIds).size !== groupedQuestionIds.length) bad('複数区分に重複している質問がある');
const questionIdSet = new Set(QUESTIONS.map(question => question.id));
if (groupedQuestionIds.some(id => !questionIdSet.has(id)) || QUESTIONS.some(question => !groupedQuestionIds.includes(question.id))) bad('区分と質問マスタのIDが一致しない');

SCENARIOS.forEach(s => {
  const e = EXPECT[s.id];
  if (!e) { bad(s.id + ': 期待値の定義がない（シナリオが増減した？）'); return; }
  if (s.trueCause !== e.cause) bad(s.id + ': trueCause が ' + e.cause + ' → ' + s.trueCause);
  if (s.best !== e.best) bad(s.id + ': best が ' + e.best + ' → ' + s.best);
  if ((s.bestNoOutage || null) !== e.noOut) bad(s.id + ': bestNoOutage が ' + e.noOut + ' → ' + s.bestNoOutage);
  if (JSON.stringify(s.partial || []) !== JSON.stringify(e.partial)) bad(s.id + ': partial が ' + JSON.stringify(e.partial) + ' → ' + JSON.stringify(s.partial));
  if (TYPES[s.type].tone !== e.tone) bad(s.id + ': 正解の伝え方が ' + e.tone + ' → ' + TYPES[s.type].tone);

  // 液晶データ
  const p = PANEL[s.id];
  if (p === null){
    if (s.panel) bad(s.id + ': panel は null のはずが定義されている');
  } else if (!s.panel){
    bad(s.id + ': panel が未定義');
  } else {
    Object.keys(p).forEach(k => {
      if ((s.panel[k] === undefined ? null : s.panel[k]) !== p[k]) bad(s.id + ': panel.' + k + ' が ' + p[k] + ' → ' + s.panel[k]);
    });
  }
});

// 配送手配（TGX）が正解・選択肢に絡む案件だけが shipNeed を持つ。
const SHIP = { S3:'normal', S7:'next', S9:'fast', S10:'next' };
SCENARIOS.forEach(s => {
  const want = SHIP[s.id] || null;
  const got = s.shipNeed || null;
  if (got !== want) bad(s.id + ': shipNeed が ' + want + ' のはずが ' + got);
  // 滞在先の聞き取りは配送に必要。診断の手がかりにはしない
  if (want){
    if (!s.replies.q_stay) bad(s.id + ': 配送が絡むのに q_stay の返答がない（滞在先を聞けない）');
    else if (s.replies.q_stay.fact) bad(s.id + ': q_stay に fact が付いている（診断ボードを汚してはいけない）');
  }
});

// 圏外3件が同じ見た目であること（設計の芯）
const outOfRange = ['S5','S6','S7'].map(id => SCENARIOS.find(s => s.id === id).panel);
const same = outOfRange.every(p => p.bars === 0 && p.carrier === null && p.sim === 'ok');
if (!same) bad('S5/S6/S7 の液晶が同じ見た目になっていない（区別できてしまう）');
['S8','S10'].forEach(id => {
  const panel = SCENARIOS.find(s => s.id === id).panel;
  if (panel.sim !== 'none') bad(id + ': SIM未認識案件なのに No SIM 表示ではない');
});

// SIM清掃は安全操作で、No SIM案件の第一選択。電源OFFを前提にしない。
const simTest = D.TESTS.find(t => t.id === 't_simout');
if (!simTest) bad('SIMの抜き差し・接点清掃が低リスク操作にない');
if (D.RISKY.some(t => t.id === 't_simout')) bad('SIM清掃が危険操作に残っている');
if (simTest && /電源を切|電源OFF|電源オフ/.test(simTest.label + simTest.wait)) bad('SIM清掃が電源OFFを前提にしている');
const s8Scenario = SCENARIOS.find(s => s.id === 'S8');
const s8Sequence = s8Scenario.tests.t_simout && s8Scenario.tests.t_simout.sequence;
if (!s8Sequence || s8Sequence.length !== 2 || s8Sequence[0].solves || !s8Sequence[1].solves) bad('S8が1回目は未復旧・2回目のSIM清掃で復旧する仕様ではない');
const simRemedy = D.REMEDIES.sim.find(r => r.id === 'r_sim_clean');
if (!simRemedy || simRemedy.needsTest !== 't_simout' || simRemedy.needsTestCount !== 2) bad('SIM清掃の正解案内が2回の実施を要求していない');
const simEscalation = D.REMEDIES.sim.find(r => r.id === 'r_escalate_swap');
if (!simEscalation || simEscalation.needsTest !== 't_simout' || simEscalation.needsTestCount !== 2) bad('機器故障への切り分けが2回のSIM清掃を要求していない');
const hardwareSwap = D.REMEDIES.hardware.find(r => r.id === 'r_hardware_swap');
if (!hardwareSwap || hardwareSwap.needsTestCount !== 2 || hardwareSwap.requiresLongStay !== 3 || !hardwareSwap.requiresConsent) bad('機器故障の代替機配送条件が確定仕様と違う');

// §25: 折り返し先データは12案件すべてに持たせる。
const CALLBACK_TO = { S1:'hotel', S2:'mobile', S3:'mobile', S4:'hotel', S5:'hotel', S6:'mobile', S7:'mobile', S8:'hotel', S9:'mobile', S10:'hotel', S11:'mobile', S12:'hotel' };
SCENARIOS.forEach(s => {
  if (s.callbackTo !== CALLBACK_TO[s.id]) bad(s.id + ': callbackTo が ' + CALLBACK_TO[s.id] + ' のはずが ' + s.callbackTo);
});
const gameSource = readGameSource(__dirname);
const sourceOf = name => extractFunctionSource(gameSource, name);
const pageSource = fs.readFileSync(__dirname + '/p1_head.html', 'utf8');
const generatedPage = fs.readFileSync(__dirname + '/index.html', 'utf8');
if (generatedPage.includes('mobile-pane-nav') || generatedPage.includes('data-mobile-pane')) bad('上部の通話・待機・診断タブが残っている');
const paneOrder = [...pageSource.matchAll(/<section class="pane ([^"]+)">/g)].map(match => match[1]);
if (JSON.stringify(paneOrder) !== JSON.stringify(['desk','board','call-summary'])) bad('3ペインのDOM順が対応デスク→診断ボード→待機状況ではない');
const stackedPaneCss = (pageSource.match(/\.pane,body\.playing \.pane\{([^}]*)\}/) || [])[1] || '';
if (!/display\s*:\s*flex/.test(stackedPaneCss)) bad('3ペインが同時表示になっていない');
const hidesGamePane = [...pageSource.matchAll(/([^{}]+)\{([^}]*)\}/g)].some(([, selectors, declarations]) =>
  /display\s*:\s*none/.test(declarations) && selectors.split(',').some(selector =>
    /\.pane(?:\.(?:desk|board|call-summary))?$/.test(selector.trim())
  )
);
if (hidesGamePane) bad('3ペインの一部が非表示になっている');
['line-state','fact-count','queue-count'].forEach(id => {
  if (!pageSource.includes('id="' + id + '"')) bad('count-chip ' + id + ' がない');
});
if (!gameSource.includes("$('line-state').textContent")) bad('通話状態のcount-chipが更新されない');
if (!gameSource.includes("$('fact-count').textContent")) bad('診断件数のcount-chipが更新されない');
if (!gameSource.includes("$('queue-count').textContent")) bad('待ち件数のcount-chipが更新されない');
if (gameSource.includes('mobilePane')) bad('廃止したペイン切替状態 mobilePane が残っている');
if ((gameSource.match(/farewellLine\(/g) || []).length !== 3 || !gameSource.includes("if (satisfied){") || !gameSource.includes("farewellLine(t.s, 'partial')")) bad('別れの言葉が通常解決と満足した返金だけに限定されていない');
if (!/const CALL_RATE_PER_MIN = 180;/.test(gameSource)) bad('国際通話料が1分¥180ではない');
if (/const CALLBACKS|callbacksLeft/.test(gameSource)) bad('現地キャリア照会と無関係な折り返し枠が戻っている');
const carrierLookup25 = LOOKUPS.find(lookup => lookup.id === 'l_carrier');
if (!carrierLookup25 || carrierLookup25.minutes !== 30 || carrierLookup25.external !== true) bad('l_carrierが30分の社外照会ではない');
if (!sourceOf('doLookup').includes('if (l.external) return') || !sourceOf('startCarrierCallback').includes("state.ui.lookup !== lookup.id")) bad('l_carrier以外または通話継続から折り返しを開始できる');
if (COMMAND_DEFS.length !== 4 || COMMAND_DEFS.some(command => command.id === 'callback')) bad('折り返すが5つ目の主コマンドへ戻っている');
if (!pageSource.includes('data-office-callback="1"') || !pageSource.includes('id="office-tray-status"')) bad('オフィスの電話をかけるボタンまたは折り返し待ち表示がない');
if (!sourceOf('resumeCallback').includes('t.callbackDestination !== t.s.callbackTo') || !sourceOf('doClose').includes('base -= t.callbackPenalty || 0')) bad('折り返し先違いの罰が戻っていない');
if (!sourceOf('resumeCallback').includes('callbackOperatorLine(t)') || !sourceOf('resumeCallback').includes('CALL_FLOW_LINES.callback.replies[t.s.type]')) bad('折り返し再接続の会話が戻っていない');
const s12Carrier25 = SCENARIOS.find(s => s.id === 'S12');
if (!s12Carrier25 || !s12Carrier25.lookups.l_plan.text.includes('契約: 有効') || !s12Carrier25.lookups.l_carrier.text.includes('00:00 に契約満了として停止') || (s12Carrier25.lookups.l_carrier.fact.hot || []).join(',') !== 'provision' || s12Carrier25.lookups.l_carrier.fact.out.length !== CAUSES.length - 1) bad('S12の自社契約照会と現地キャリア照会の食い違い・provision確定力がない');
if (/00:00|0時|日付が変わ/.test(s12Carrier25.opening) || !(s12Carrier25.replies.q_when.fact.hot || []).includes('provision')) bad('S12の第一声が正確な日付境界を漏らす、またはq_whenで手がかりを得られない');
if (!sourceOf('advanceIdleOffice').includes("t.state === 'waiting'") || !sourceOf('advanceIdleOffice').includes("t.state === 'callback'") || !sourceOf('handleOfficeAction').includes("firstTicketIn('waiting', 'arrivedTurn')")) bad('折り返し中にほかの電話を取れない');
const fiveNightBadge25 = CAREER_BADGES.find(badge => badge.id === 'ten_nights');
if (!fiveNightBadge25 || fiveNightBadge25.label !== '五夜勤' || fiveNightBadge25.condition !== '通算5シフトを完了') bad('ten_nightsのID互換を保った「五夜勤」表示になっていない');

// §26: 既定照会結果と顧客向け要約を分離し、共通のシステム画面で見せる。
if (Object.prototype.hasOwnProperty.call(CALL_FLOW_LINES.lookup, 'miss') || gameSource.includes('CALL_FLOW_LINES.lookup.miss') || gameSource.includes('該当する記録は確認できませんでした')) bad('§26 矛盾した照会miss要約が残っている');
if (!LOOKUPS.every(lookup => lookup.spoken && lookup.defaultResult && lookup.title && !Object.prototype.hasOwnProperty.call(lookup, 'miss'))) bad('§26 LOOKUPSのspoken・defaultResult・titleが揃っていない');
if (!QUESTIONS.every(question => typeof question.miss === 'string' && question.miss.length)) bad('§26 QUESTIONSの二度聞き用missを損なっている');
const finishLookup26 = sourceOf('finishLookup');
const lookupSystemLine26 = sourceOf('lookupSystemLine');
const recentTranscript26 = sourceOf('recentTranscriptLines');
if (!finishLookup26.includes('lookupSystemLine(l, null)') || !finishLookup26.includes('l.spoken') || finishLookup26.includes('lookup.miss')) bad('§26 案件固有結果なしで既定結果とspokenを使わない');
if (!lookupSystemLine26.includes('typed:true') || !recentTranscript26.includes('latestLookupIndex') || !recentTranscript26.includes('return [delivered[latestLookupIndex], playerAfter]')) bad('§26 照会直後にシステム結果画面と読み上げ要約が表示されない');
const lookupScreen26 = sourceOf('renderLookupSystemScreen');
const lookupRows26 = sourceOf('lookupResultRows');
if (!lookupScreen26.includes('system-screen lookup-system-screen') || !lookupScreen26.includes('lookupTitle') || !pageSource.includes('.system-screen{') || !pageSource.includes('font-family: var(--mono)')) bad('§26 照会結果が枠・タイトル・等幅のシステム画面ではない');
if (!lookupRows26.includes('／') || !lookupScreen26.includes('lookup-system-row')) bad('§26 照会結果を項目ごとの行へ分けられない');
if (!pageSource.includes('.lcd,.lcd.obscured,.lcd.missing,.system-screen{ background:#10212B; color:#A8E4DF; box-shadow:inset 0 0 18px #071118; }')) bad('§26 システム画面の配色がROUTER DISPLAYと揃っていない');
if (!lookupScreen26.includes("line.viz ? renderLookupViz(line.viz) : ''") || !lookupScreen26.includes("line.external ? ' external'") || !lookupScreen26.includes('外部照会')) bad('§26 vizの画面内表示またはl_carrierの外部照会表示がない');

// §27: 調べる・ログは常時押せ、未特定なら共通の時間無消費システム画面で拒否する。
const commandMenu27 = sourceOf('renderCommandMenu');
const requireIdentification27 = sourceOf('requireIdentification');
const openLookup27 = sourceOf('openLookup');
const openRecord27 = sourceOf('openRecord');
const denied27 = sourceOf('renderIdentityDenied');
const record27 = sourceOf('renderRecord');
const recordTranscript27 = sourceOf('renderRecordTranscript');
if (/record:\{[^}]*disabled/.test(commandMenu27)) bad('§27 ログが本人特定前に無効化されている');
if (/lookup:\{[^}]*disabled/.test(commandMenu27) || commandMenu27.includes('disabled:!t.identified')) bad('§27 調べるが本人特定前に無効化されている');
if (!requireIdentification27.includes('identificationReady(t)') || /nameKnown\s*&&\s*t\.destinationKnown/.test(requireIdentification27)) bad('§27 共通ガードが既存のidentificationReady以外で判定している');
if (!openRecord27.includes('requireIdentification(t)') || !openLookup27.includes('requireIdentification(t)')) bad('§27 調べる・ログが共通の本人確認ガードを通らない');
const denyIndex27 = requireIdentification27.indexOf("defaultUi('identity_denied')");
const spendIndex27 = openRecord27.indexOf('spendOnCall(t, 1, 0)');
if (denyIndex27 < 0 || spendIndex27 < 0 || openRecord27.indexOf('requireIdentification(t)') >= spendIndex27 || requireIdentification27.includes('spendOnCall') || openLookup27.includes('spendOnCall')) bad('§27 本人特定前の拒否で時間を消費する');
if (!denied27.includes('system-screen record-system-screen identity-denied-screen denied') || !denied27.includes('フルネームと渡航先、または契約IDを確認してください。')) bad('§27 本人特定前の要件を共通システム画面で案内しない');
if (!record27.includes('system-screen record-system-screen') || !record27.includes('<b>通話記録</b>') || !record27.includes('renderRecordTranscript(t)')) bad('§27 通話記録が共通システム画面で全履歴を表示しない');
if (!recordTranscript27.includes('t.transcript.map') || !recordTranscript27.includes("cust:'客'") || !recordTranscript27.includes("sys:'社内システム'") || !recordTranscript27.includes('line.text')) bad('§27 通話記録から従来の発言・メモ・システム応答が欠ける');

// §28: 12案件解決の表エンディングと、8バッジの裏エンディングを独立して管理する。
const freshCareer28 = sourceOf('freshCareerRecord');
const validCareer28 = sourceOf('validCareerRecord');
const normalizeCareer28 = sourceOf('normalizeCareerRecord');
const appendCareer28 = sourceOf('appendCareerShift');
const solvedIds28 = sourceOf('solvedScenarioIdsFromTickets');
const endingQueue28 = sourceOf('careerEndingQueue');
const careerFlags28 = sourceOf('careerWithFlags');
const careerContext28 = sourceOf('careerShiftContext');
const careerDebrief28 = sourceOf('careerDebriefHtml');
const secretEnding28 = sourceOf('showSecretEnding');
const nextEnding28 = sourceOf('pendingCareerEndingType');
const balance28 = sourceOf('showBalanceConsole');
if (!freshCareer28.includes('solvedScenarios:[]') || !freshCareer28.includes('secretEnding:false') || !validCareer28.includes('value.solvedScenarios') || !validCareer28.includes("typeof value.secretEnding !== 'boolean'")) bad('§28 表裏エンディングの保存項目が揃っていない');
if (!normalizeCareer28.includes('next.solvedScenarios === undefined') || !normalizeCareer28.includes('next.secretEnding === undefined') || !sourceOf('readCareerRecord').includes('normalizeCareerRecord')) bad('§28 旧v1勤務記録を新しい保存形式へ移行できない');
if (!solvedIds28.includes("result.kind === 'closed'") || !solvedIds28.includes("result.kind === 'refunded' && result.satisfied === true") || !solvedIds28.includes('new Set')) bad('§28 解決・満足返金だけを重複なしで数えない');
if (!appendCareer28.includes('career.solvedScenarios.concat(context.solvedScenarioIds || [])') || appendCareer28.indexOf('career.shifts = career.shifts.slice(-30)') > appendCareer28.indexOf('career.solvedScenarios =')) bad('§28 solvedScenariosが30日制限と分離されていない');
if (endingQueue28.indexOf("queue.push('career')") < 0 || endingQueue28.indexOf("queue.push('secret')") < 0 || endingQueue28.indexOf("queue.push('career')") > endingQueue28.indexOf("queue.push('secret')")) bad('§28 表と裏の条件または同時達成時の表示順が違う');
if (!endingQueue28.includes('career.solvedScenarios.length === SCENARIOS.length') || !endingQueue28.includes('!career.ending') || !endingQueue28.includes('career.badges.length === CAREER_BADGES.length') || !endingQueue28.includes('!career.secretEnding')) bad('§28 表・裏を独立判定できない、または閲覧済みが再発火する');
if (!careerContext28.includes('solvedScenarioIds:solvedScenarioIdsFromTickets(tickets)')) bad('§28 シフト結果から解決済み案件を保存経路へ渡さない');
if (!secretEnding28.includes("showCareerEnding(replay, 'secret')") || secretEnding28.includes('準備中') || !sourceOf('showCareerEnding').includes("endingType === 'secret'") || !sourceOf('showCareerEnding').includes('state.career.secretEnding = true')) bad('§28 裏エンディングが表と同じ演出を使わない、または閲覧済みを保存しない');
if (!sourceOf('careerEndingEyebrowHtml').includes("state.endingType === 'secret'") || !sourceOf('careerEndingEyebrowHtml').includes('aria-label="裏エンディング">裏</span>')) bad('§28 同じ朝礼演出の裏エンディングに小さな印がない');
if (!nextEnding28.includes("type === 'career' ? !state.career.ending : !state.career.secretEnding") || !sourceOf('continueAfterCareerEnding').includes("if (next === 'secret')")) bad('§28 表の後に裏を続ける、または両方を一度ずつにする制御がない');
if (!careerDebrief28.includes("解決した案件 ' + career.solvedScenarios.length + ' / ' + SCENARIOS.length") || careerDebrief28.includes('SCENARIOS.map') || careerDebrief28.includes('scenario.name')) bad('§28 レポートが解決数を出さない、または未解決案件名を漏らす');
if (!Object.prototype.hasOwnProperty.call(GAME_FLAGS,'solvedScenarios') || GAME_FLAGS.solvedScenarios !== null || !careerFlags28.includes('flags.solvedScenarios') || !balance28.includes('showCareerEnding(true)') || !balance28.includes('showSecretEnding(true)')) bad('§28 GAME_FLAGSと調から表・裏エンディングを再現できない');

// 通話フロー v2: 本人確認の3問は診断の手がかりを増やさない。
const IDENTITY_QUESTIONS = ['q_name', 'q_destination', 'q_contract'];
IDENTITY_QUESTIONS.forEach(id => {
  const question = QUESTIONS.find(q => q.id === id);
  if (!question) { bad(id + ': 本人確認の質問がない'); return; }
  if (question.fact) bad(id + ': 質問定義に fact が付いている');
  SCENARIOS.forEach(s => {
    const reply = (s.replies || {})[id];
    if (reply && reply.fact) bad(s.id + '/' + id + ': 本人確認の返答に fact が付いている');
  });
});

// 焦った3件だけが、先に話したあと名乗りへ短く応じる。
const RUSHED_REPLIES = {
  S3:'はい。挨拶は分かった。続き、早く。',
  S6:'分かってます。前置きは終わり。進めて。',
  S9:'はい。で、結論は？',
  S11:'はい。場所なら動く。指示を。',
};
SCENARIOS.forEach(s => {
  const want = RUSHED_REPLIES[s.id];
  if (want && s.rushedReply !== want) bad(s.id + ': rushedReply が確定本文と違う');
  if (!want && s.rushedReply !== undefined) bad(s.id + ': hurried 以外に rushedReply がある');
});

// 契約IDは各シナリオ固有の探索時間と予約番号を持つ。
const CONTRACT_IDS = {
  S1:{ minutes:2, number:'GDW-410882' },
  S2:{ minutes:4, number:'GDW-336104' },
  S3:{ minutes:1, number:'GDW-529017' },
  S4:{ minutes:1, number:'GDW-118350' },
  S5:{ minutes:2, number:'GDW-673925' },
  S6:{ minutes:1, number:'GDW-206441' },
  S7:{ minutes:1, number:'GDW-887302' },
  S8:{ minutes:3, number:'GDW-745168' },
  S9:{ minutes:1, number:'GDW-091774' },
  S10:{ minutes:2, number:'GDW-814263' },
  S11:{ minutes:1, number:'GDW-562940' },
  S12:{ minutes:3, number:'GDW-348621' },
};
SCENARIOS.forEach(s => {
  const want = CONTRACT_IDS[s.id];
  if (!want || !s.contractId) { bad(s.id + ': contractId がない'); return; }
  if (s.contractId.minutes !== want.minutes) bad(s.id + ': contractId.minutes が ' + want.minutes + ' → ' + s.contractId.minutes);
  if (!s.contractId.text.includes(want.number)) bad(s.id + ': contractId.text に ' + want.number + ' がない');
  const numbers = s.contractId.text.match(/GDW-\d{6}/g) || [];
  if (numbers.length !== 1 || numbers[0] !== want.number) bad(s.id + ': 予約番号が GDW-6桁の確定値ではない');
});

const askStart = gameSource.indexOf('function doAsk(');
const askEnd = gameSource.indexOf('\nfunction doLookup', askStart);
const askSource = askStart < 0 || askEnd < 0 ? '' : gameSource.slice(askStart, askEnd);
if (!/qid === 'q_contract'[\s\S]*?spendOnCall\(t, t\.s\.contractId\.minutes, 0\)/.test(askSource)) bad('契約IDの質問が contractId.minutes 分を消費していない');

// 聞き取りだけを、通話内の質問回数に応じて +2 ずつ重くする。
const askStressStart = gameSource.indexOf('function askStressBase(');
const askStressEnd = gameSource.indexOf('\n\nfunction doAsk', askStressStart);
const askStressSource = askStressStart < 0 || askStressEnd < 0 ? '' : gameSource.slice(askStressStart, askStressEnd);
try {
  const askStressBase = new Function(askStressSource + '\nreturn askStressBase;')();
  const cases = [
    { n:1, base:3, want:3 }, { n:3, base:3, want:7 }, { n:8, base:3, want:17 },
    { n:1, base:9, want:9 }, { n:3, base:9, want:13 }, { n:8, base:9, want:23 },
    { n:1, base:14, want:14 }, { n:3, base:14, want:18 }, { n:8, base:14, want:28 },
  ];
  cases.forEach(({n, base, want}) => {
    const got = askStressBase({ asked:{ size:n } }, base);
    if (got !== want) bad(n + '回目・基本値' + base + 'の質問ストレスが ' + want + ' → ' + got);
  });
} catch (error) {
  bad('聞き取り加速の式を検査できない: ' + error.message);
}
if ((askSource.match(/askStressBase\(/g) || []).length !== 5) bad('通常の聞き取り4経路と再質問に加速式が適用されていない');
const contractStart = askSource.indexOf("if (qid === 'q_contract')");
const contractAskSource = askSource.slice(contractStart, askSource.indexOf("if (qid === 'q_name')", contractStart));
if (contractAskSource.includes('askStressBase(')) bad('契約IDの所要分×3に聞き取り加速を重ねている');
if (!contractAskSource.includes('identityQuestionStress(t, qid, t.s.contractId.minutes * 3)')) bad('契約IDが本人確認専用のストレス経路を通らない');
if (contractAskSource.includes('asked.size')) bad('契約IDのストレスに質問回数の加速を足している');

// ストレス係数は実装から独立した確定値と比較する。
const STRESS_TYPES = {
  anxious:{ stressStart:20, stressRate:1.2, missRate:1.0 },
  novice:{ stressStart:5, stressRate:0.9, missRate:1.0 },
  hurried:{ stressStart:15, stressRate:1.6, missRate:1.3 },
  expert:{ stressStart:5, stressRate:1.0, missRate:2.0 },
};
Object.entries(STRESS_TYPES).forEach(([type, want]) => {
  Object.entries(want).forEach(([key, value]) => {
    if (TYPES[type][key] !== value) bad('TYPES.' + type + '.' + key + ' が ' + value + ' → ' + TYPES[type][key]);
  });
});

// ストレス段階ごとの言葉遣いは、タイプごとに確定本文を持つ。
const STRESS_LANGUAGE = {
  anxious:{
    irritated:['あの…このまま全部だめになったりしませんよね？', 'すみません、手が震えてきて…。'],
    angry:['もう無理です…私、何か壊したんでしょうか？', 'お願いです、置いていかないでください。泣きそうです…。'],
    furious:['もう限界です…誰か、最後まで助けてください…！', '責任者の方に代わってください。私、このままでは話せません…。'],
  },
  novice:{
    irritated:['あの、その言葉が分からなくて…すみません。', '私、また違う所を押しましたか…？'],
    angry:['やっぱり私には無理なんですね…。', '何度も聞いてごめんなさい。もう手が動かなくて…。'],
    furious:['すみません、もう怖くて触れません。どなたか代わってください。', '私が壊したのでしょうか…。契約を続ける自信がありません。'],
  },
  hurried:{
    irritated:['あと何分？ バス、もう着きます。', '前置きはいい。次は？'],
    angry:['その話、後。結論を言って。', '時計見てます？ 会議が始まる。急いで。'],
    furious:['もう待てない。責任者に代わって。今。', 'ここで終わらせる。解約の手順だけ言って。'],
  },
  expert:{
    irritated:['その質問は、どの仮説を切るためですか。', '先ほどの観測結果と重複しています。'],
    angry:['切り分けの順序が逆です。根拠を示してください。', 'その説明では一次障害と端末要因を区別できません。'],
    furious:['これ以上は検証になりません。責任者へ引き継いでください。', 'この品質なら、契約継続は再検討します。記録を残してください。'],
  },
};
Object.entries(STRESS_LANGUAGE).forEach(([type, stages]) => {
  Object.entries(stages).forEach(([stage, lines]) => {
    if (JSON.stringify(TYPES[type][stage]) !== JSON.stringify(lines)) bad('TYPES.' + type + '.' + stage + ' の言葉遣いが確定本文と違う');
  });
});

const stageStart = gameSource.indexOf('function stressSpeechStage(');
const stageEnd = gameSource.indexOf('\nfunction stressLeadIn', stageStart);
const stageSourceRaw = stageStart < 0 || stageEnd < 0 ? '' : gameSource.slice(stageStart, stageEnd);
const stageSource = stageSourceRaw.replace(/\s+/g, ' ');
if (!/value <= 50\) return null; if \(value <= 70\) return 'irritated'; if \(value <= 90\) return 'angry'; return 'furious';/.test(stageSource)) bad('言葉遣いの境界が 0-50 / 51-70 / 71-90 / 91-100 ではない');

// 実際の前置きロジックでも、境界・1回おき・順番・plain除外を固定する。
const leadStart = gameSource.indexOf('function stressLeadIn(');
const leadEnd = gameSource.indexOf('\nfunction pushCustomerLine', leadStart);
const customerStart = gameSource.indexOf('function pushCustomerLine(');
const customerEnd = gameSource.indexOf('\n\nfunction doAsk', customerStart);
try {
  const speech = new Function('TYPES',
    stageSourceRaw + '\n' + gameSource.slice(leadStart, leadEnd) + '\n' + gameSource.slice(customerStart, customerEnd) +
    '\nreturn {stressSpeechStage,pushCustomerLine};')(TYPES);
  const boundaries = [[50,null],[51,'irritated'],[70,'irritated'],[71,'angry'],[90,'angry'],[91,'furious']];
  boundaries.forEach(([value, want]) => {
    if (speech.stressSpeechStage(value) !== want) bad('言葉遣いの境界 ' + value + ' が ' + String(want) + ' ではない');
  });
  const t = { stress:51, s:{type:'hurried'}, speechTurns:{irritated:0,angry:0,furious:0}, transcript:[] };
  speech.pushCustomerLine(t, '返答A');
  speech.pushCustomerLine(t, '返答B');
  speech.pushCustomerLine(t, '返答C');
  t.stress = 71; speech.pushCustomerLine(t, '返答D'); speech.pushCustomerLine(t, '返答E');
  t.stress = 91; speech.pushCustomerLine(t, '返答F'); speech.pushCustomerLine(t, '除外', {plain:true});
  const want = [
    'あと何分？ バス、もう着きます。 返答A', '返答B', '前置きはいい。次は？ 返答C',
    'その話、後。結論を言って。 返答D', '時計見てます？ 会議が始まる。急いで。 返答E',
    'もう待てない。責任者に代わって。今。 返答F', '除外',
  ];
  if (JSON.stringify(t.transcript.map(line => line.text)) !== JSON.stringify(want)) bad('言葉遣いの頻度・順番・plain除外が仕様と違う');
} catch (error) {
  bad('言葉遣いロジックを検査できない: ' + error.message);
}

const SOOTHE_BASE = { s_wait:-12, s_apology:-15, s_recap:-18 };
Object.entries(SOOTHE_BASE).forEach(([id, value]) => {
  const soothe = SOOTHES.find(s => s.id === id);
  if (!soothe || soothe.base !== value) bad(id + ': なだめる基本効果が ' + value + ' ではない');
});
const SOOTHE_BY_TYPE = {
  anxious:{s_wait:-12,s_apology:-22,s_recap:-18},
  novice:{s_wait:-12,s_apology:-15,s_recap:-25},
  hurried:{s_wait:-18,s_apology:-5,s_recap:-10},
  expert:{s_wait:-8,s_apology:3,s_recap:-25},
};
if (JSON.stringify(SOOTHE_EFFECTS) !== JSON.stringify(SOOTHE_BY_TYPE)) bad('タイプ別のなだめる効果が確定表と違う');
if (JSON.stringify(SMALLTALK_EFFECTS) !== JSON.stringify({anxious:-10,novice:-12,hurried:14,expert:6})) bad('タイプ別の雑談効果が確定表と違う');
if (JSON.stringify(IDENTITY_CALMING_EFFECTS) !== JSON.stringify({anxious:-10,novice:-8,hurried:-4,expert:0})) bad('高ストレス本人確認のタイプ別効果が確定表と違う');
const requiredTopicFields = ['id','reveal','askLabel','tellLabel','goodReply','badReply'];
if (SCENARIOS.length !== 12 || !SCENARIOS.every(s => Array.isArray(s.smalltalk) && s.smalltalk.length >= 1 && s.smalltalk.every(topic => requiredTopicFields.every(field => typeof topic[field] === 'string' && topic[field].length > 0)))) bad('全12シナリオの雑談話題6項目が揃っていない');
const section13QuestionIds = new Set(QUESTIONS.map(question => question.id));
const universallyReachableQuestions = new Set(['q_name','q_destination','q_contract']);
if (!SCENARIOS.every(scenario => scenario.smalltalk.every(topic => topic.reveal === 'opening' || (section13QuestionIds.has(topic.reveal) && (universallyReachableQuestions.has(topic.reveal) || Boolean((scenario.replies || {})[topic.reveal])))))) bad('雑談話題のrevealが実際に到達できる質問へ接続されていない');
const openingDestinationIds = ['S9','S11'];
if (!gameSource.includes("const DESTINATION_IN_OPENING = new Set(['S9','S11'])")) bad('第一声で地名を話す案件がS9とS11の2件ではない');
if (!SCENARIOS.filter(scenario => !openingDestinationIds.includes(scenario.id)).every(scenario => !scenario.opening.includes(scenario.city))) bad('通常案件の第一声に自身のcityが残っている');

const identityStressStart = gameSource.indexOf('function identityQuestionStress(');
const identityStressEnd = gameSource.indexOf('\nfunction repeatedQuestionReply', identityStressStart);
const identityStressSource = identityStressStart < 0 || identityStressEnd < 0 ? '' : gameSource.slice(identityStressStart, identityStressEnd);
const zeroDeltaReturn = identityStressSource.indexOf('if (delta === 0) return changeStress(t, 0, true);');
const identityLuckRoll = identityStressSource.indexOf('const expectedOutcome = rollLuck();');
if (zeroDeltaReturn < 0 || identityLuckRoll < 0 || zeroDeltaReturn > identityLuckRoll) bad('expertの高ストレス本人確認が無駄に運の抽選を消費する');

const SOOTHE_REPLIES = {
  anxious:'…本当に、戻るんですね。すみません…お願いします。',
  novice:'あ、はい…私にもできるよう、一つずつお願いできますか。',
  hurried:'分かった。次。結論から。',
  expert:'整理は妥当です。その順で進めてください。',
};
Object.entries(SOOTHE_REPLIES).forEach(([type, reply]) => {
  if (TYPES[type].sootheReply !== reply) bad('TYPES.' + type + '.sootheReply が確定本文と違う');
});

// 40未満は +8×stressRate、40以上で効いたときはタイプ別に必ず反応する。
const sootheResultStart = gameSource.indexOf('function sootheResult(');
const sootheResultEnd = gameSource.indexOf('\nfunction doSoothe', sootheResultStart);
const sootheResultSource = sootheResultStart < 0 || sootheResultEnd < 0 ? '' : gameSource.slice(sootheResultStart, sootheResultEnd);
const doSootheStart = gameSource.indexOf('function doSoothe(');
const doSootheEnd = gameSource.indexOf('\nfunction doApologize', doSootheStart);
const doSootheSource = doSootheStart < 0 || doSootheEnd < 0 ? '' : gameSource.slice(doSootheStart, doSootheEnd);
try {
  const flipReactionStart = gameSource.indexOf('function flipReaction(');
  const flipReactionEnd = gameSource.indexOf('\nfunction ', flipReactionStart + 1);
  const flipReactionSource = flipReactionStart < 0 || flipReactionEnd < 0 ? '' : gameSource.slice(flipReactionStart, flipReactionEnd);
  const flipReaction = new Function('rollLuck', flipReactionSource + '\nreturn flipReaction;')(() => true);
  const sootheResult = new Function('TYPES', 'SOOTHE_EFFECTS', 'flipReaction', sootheResultSource + '\nreturn sootheResult;')(TYPES, SOOTHE_EFFECTS, flipReaction);
  const low = sootheResult({ stress:39, s:{type:'anxious'} }, 's_wait', 0);
  if (JSON.stringify(low) !== JSON.stringify({ delta:8, scaled:true, reply:TYPES.anxious.sootheMissReply })) bad('ストレス39のなだめるが +8・係数あり・タイプ別反応ではない');
  const boundary = sootheResult({ stress:40, s:{type:'anxious'} }, 's_wait', 0);
  if (JSON.stringify(boundary) !== JSON.stringify({ delta:-12, scaled:false, reply:SOOTHE_REPLIES.anxious })) bad('ストレス40で通常のなだめる効果へ切り替わらない');
  const effective = { anxious:'s_apology', novice:'s_recap', hurried:'s_wait', expert:'s_recap' };
  Object.entries(effective).forEach(([type, id]) => {
    const result = sootheResult({ stress:40, s:{type} }, id, 0);
    if (result.reply !== SOOTHE_REPLIES[type]) bad(type + ': 効いたなだめるへの反応が確定本文と違う');
  });
  const mismatch = sootheResult({ stress:40, s:{type:'expert'} }, 's_apology', 0);
  if (mismatch.delta !== 3 || mismatch.reply !== TYPES.expert.sootheMissReply) bad('expertへの的外れな謝罪が +3・タイプ別反応ではない');
} catch (error) {
  bad('なだめるの境界・反応を検査できない: ' + error.message);
}
if (!doSootheSource.includes('pushCustomerLine(t, result.reply)')) bad('なだめた直後に顧客の反応を会話へ積んでいない');
if (!doSootheSource.includes('applyReactionStress(t, result)')) bad('なだめるの反応が共通のストレス適用経路を通らない');
if (!sootheResultSource.includes('TYPES[t.s.type].sootheReply')) bad('なだめ成功時の反応が TYPES の sootheReply を参照していない');

// §6-E: 通話画面は苛立ち中心。詳細は有料のログへ退避する。
if (!/\.stress-panel\{[^}]*position:sticky/.test(pageSource)) bad('苛立ちメーターがsticky固定ではない');
const recentStart = gameSource.indexOf('function recentTranscriptLines(');
const recentEnd = gameSource.indexOf('\n\nfunction renderTranscript', recentStart);
const recentSource = recentStart < 0 || recentEnd < 0 ? '' : gameSource.slice(recentStart, recentEnd);
if (!recentSource.includes("line.who === 'cust' || line.who === 'me'") || !recentSource.includes('return player ? [player, customer] : [customer]')) bad('直近会話が顧客最新発話と直前の自分の最大2行ではない');
const headerStart = gameSource.indexOf('function renderCallHeader(');
const headerEnd = gameSource.indexOf('\n\nfunction stressDisplayStage', headerStart);
const headerSource = headerStart < 0 || headerEnd < 0 ? '' : gameSource.slice(headerStart, headerEnd);
['t.s.name','t.s.city','localClock','t.s.device','t.s.plan','TYPES','call-guide'].forEach(leak => {
  if (headerSource.includes(leak)) bad('通話ヘッダにログへ移す情報が残っている: ' + leak);
});
const logStart = gameSource.indexOf('function renderRecord(');
const logEnd = gameSource.indexOf('\n\nfunction remainingCauseCandidates', logStart);
const logSource = logStart < 0 || logEnd < 0 ? '' : gameSource.slice(logStart, logEnd);
const logHeadings = [...logSource.matchAll(/<h3>([^<]+)<\/h3>/g)].map(match => match[1]);
if (JSON.stringify(logHeadings) !== JSON.stringify(['お客様','ここまでの状況','次にできること','会話の全履歴'])) bad('ログの4見出しが完全一致しない');
['trueCause','REMEDIES','scenarioRoute','bestRemedy','correctRemedy'].forEach(secret => {
  if (logSource.includes(secret)) bad('ログが真因または正解対処を参照している: ' + secret);
});
const askGroupCssBlocks = [...pageSource.matchAll(/\.opts\.ask-groups\{([^}]*)\}/g)].map(match => match[1]);
if (askGroupCssBlocks.length !== 2 || !askGroupCssBlocks.every(block => /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/.test(block))) bad('質問区分CSSの全ブロックが2列グリッドではない');

const stressPenaltyStart = gameSource.indexOf('function stressPenalty(');
const stressPenaltyEnd = gameSource.indexOf('\n\nfunction doAsk', stressPenaltyStart);
const stressPenaltySource = stressPenaltyStart < 0 || stressPenaltyEnd < 0 ? '' : gameSource.slice(stressPenaltyStart, stressPenaltyEnd).replace(/\s+/g, ' ');
if (!/v <= 25 \? 0 : v <= 50 \? \.3 : v <= 70 \? \.8 : v <= 90 \? 1\.5 : 2\.2/.test(stressPenaltySource)) bad('ストレスのCSAT減点段階が 0/.3/.8/1.5/2.2 ではない');

// §16／§17: 怒り終話・翌日苦情メール・トースト全廃。
if (gameSource.includes("kind:'supervisor'") || gameSource.includes('上長が引き取り')) bad('怒り終話に上長引き取りが残っている');
if (JSON.stringify(ANGRY_DEFAULT_OUTCOMES) !== JSON.stringify({anxious:'hangup',novice:'complaint',expert:'complaint',hurried:'hangup'})) bad('顧客タイプ別の既定怒り終話が確定仕様と違う');
if (Object.keys(ANGRY_END_LINES).length !== 4 || Object.values(ANGRY_END_LINES).some(lines => !lines.complaint || !lines.hangup)) bad('クレーム／切断の終話台詞が4タイプ分揃っていない');
if (Object.keys(COMPLAINT_EMAIL_TEMPLATES).length !== 4 || Object.values(COMPLAINT_EMAIL_TEMPLATES).some(template => !Array.isArray(template.lines) || template.lines.length < 2 || template.lines.length > 3 || !template.lines[0].includes('{symptom}'))) bad('翌日の苦情メールが4タイプ分・客自身の2〜3行で揃っていない');
if (!gameSource.includes("endAngryCall(t, 'stress')") || !sourceOf('advanceConversationFlow').includes('endAngryCall(t, reason)')) bad('ストレス100と誤診2回目が共通の怒り終話を通らない');
if (!gameSource.includes("csat:kind === 'complaint' ? 1.0 : 0.5")) bad('クレーム／切断のCSATが1.0／0.5ではない');
if (!gameSource.includes('function complaintEmailArrives') || !gameSource.includes("(result.kind === 'closed' || result.kind === 'refunded') && result.csat < 2 ? rollLuck() : false")) bad('苦情メールの必着・低CSAT抽選条件がない');
if (!gameSource.includes('翌日、次の苦情が届いています') || !pageSource.includes('.complaint-mailbox')) bad('翌日デブリーフの苦情メール別枠がない');
if (!gameSource.includes("line.replace('{symptom}', t.s.opening)") || /template\.lines[\s\S]{0,240}(?:trueCause|causeName)/.test(gameSource)) bad('苦情メールが客の症状ではなく真因を漏らしている');
if (/toast/i.test(pageSource + '\n' + gameSource)) bad('トーストの関数・呼び出し・DOM・CSSが残っている');
if (!pageSource.includes('.stress-panel.alert') || !gameSource.includes("t.stress > 80 ? ' alert' : ''") || gameSource.includes('stressWarned')) bad('苛立ち80超の状態駆動点滅が往復に追従しない');
if (!gameSource.includes("recordOfficeEvent('abandoned'") || !gameSource.includes("recordOfficeEvent('redial'") || !gameSource.includes('state.officeEvents.slice(-3)')) bad('放棄呼・再着信がオフィス状態へ移っていない');
if (!gameSource.includes("recordOfficeEvent('closed'") || !gameSource.includes("result.label + ' CSAT ' + result.csat.toFixed(1)")) bad('案件クローズ結果がオフィス状態へ移っていない');

// §18: Web Audio合成音は任意の飾りで、10場面と5段階の案件結果を区別する。
if (!gameSource.includes('new AudioContextClass()') || !gameSource.includes('createOscillator()') || !gameSource.includes('createGain()')) bad('Web Audioのコード合成がない');
if (/\.(?:mp3|wav|ogg|m4a)\b/i.test(pageSource + gameSource)) bad('外部の音声ファイルを参照している');
if (!gameSource.includes("$('btn-start').onclick = () => {\n    initAudio();")) bad('AudioContextがシフト開始操作の中で初期化されない');
if (!gameSource.includes("if (!GAME_FLAGS.soundEnabled || !audioContext) return") || !gameSource.includes('catch (error){ /* 音が出せなくてもゲーム進行は続ける */ }')) bad('ミュートまたは音声例外の安全経路がない');
['playOfficeRing()','playPickupSound()','playDisconnectSound()','playTypeSound(pos)','playCommandSound()','playStressWarning()','playClueSound()','playBadActionSound()','playCloseJingle(','playShiftEndSound()'].forEach(call => {
  if (!gameSource.includes(call)) bad('効果音10場面の呼び出しが欠けている: ' + call);
});
if (!gameSource.includes("result.kind === 'complaint' || result.kind === 'hangup') return 'accident'") || !gameSource.includes("result.kind === 'abandoned' || result.csat < 2") || !gameSource.includes("result.csat >= 4") || !gameSource.includes("result.csat >= 3")) bad('案件クローズ音の5段階分類がない');
if (!gameSource.includes('if (index % 4) return')) bad('タイプ音が1文字ごとに鳴る');
if (!gameSource.includes('previousStress <= 80 && t.stress > 80')) bad('苛立ち警告音が状態の80境界を再横断しても鳴らない');
if (!gameSource.includes('id="balance-sound"') || !gameSource.includes('id="balance-volume"')) bad('ゲーム調整にミュートと音量がない');

// §19: 返金は確認後に費用を払い、満足3.0／不満足1.0で単発クローズする。
if (!gameSource.includes("kind:'refunded'") || !gameSource.includes('csat:satisfied ? 3.0 : 1.0')) bad('返金が満足3.0／不満足1.0で案件を閉じない');
if (!gameSource.includes("defaultUi('refund_confirm')") || !gameSource.includes('この電話はこれで終わります')) bad('返金が金額・終話の確認を挟まない');
if (/\brefunds\b|refundCsat|refundResult|refundEffect/.test(gameSource)) bad('旧返金の回数管理・CSAT逓減が残っている');
if (!gameSource.includes("result.kind === 'closed' || result.kind === 'refunded'")) bad('不満足な返金が苦情メール対象に入らない');
const outageRefundRemedy = REMEDIES.carrier.find(remedy => remedy.id === 'r_outage_explain');
if (!outageRefundRemedy || outageRefundRemedy.cost !== 2400 || !outageRefundRemedy.needsOutage || outageRefundRemedy.kind !== 'resolve') bad('広域障害の正規対処 r_outage_explain が損なわれている');

// §15-5/§25: 1日は12案件から2〜5件を重複なく選び、先頭の到着枠へ詰める。
try {
  const dailyCount15 = new Function(sourceOf('dailyTicketCount') + '\nreturn dailyTicketCount;')();
  const shuffle15 = new Function(sourceOf('shuffleScenarios') + '\nreturn shuffleScenarios;')();
  const prepare15 = new Function('shuffleScenarios','dailyTicketCount', sourceOf('prepareDailyScenarios') + '\nreturn prepareDailyScenarios;')(shuffle15,dailyCount15);
  // 1-2. 何度選んでも2〜5件で、乱数境界により日ごとに変わる。
  const counts15 = [0,.249999,.25,.5,.999999].map(value => dailyCount15(() => value, {dailyTickets:null}));
  if (JSON.stringify(counts15) !== JSON.stringify([2,2,3,4,5]) || new Set(counts15).size !== 4) bad('1日件数が2〜5の範囲で日ごとに変わらない');
  // 3-4. 重複なし、件数ぶんだけ先頭到着枠へ圧縮。
  [2,3,4,5].forEach(count => {
    const selected = prepare15(SCENARIOS, () => .37, {dailyTickets:count,shuffleArrival:true});
    if (selected.length !== count || new Set(selected.map(s => s.id)).size !== count) bad(count + '件の日次案件に欠落または重複がある');
    const expectedArrivals = SCENARIOS.slice(0,count).map(s => s.arrive);
    if (JSON.stringify(selected.map(s => s.arrive)) !== JSON.stringify(expectedArrivals)) bad(count + '件の日の到着時刻が先頭枠へ詰められていない');
  });
  // 8. GAME_FLAGSで2〜5件を固定でき、範囲外は拒否する。
  if (!Object.prototype.hasOwnProperty.call(GAME_FLAGS,'dailyTickets') || GAME_FLAGS.dailyTickets !== null) bad('GAME_FLAGS.dailyTicketsの既定値がnullではない');
  if ([2,3,4,5].some(count => dailyCount15(() => 0, {dailyTickets:count}) !== count)) bad('GAME_FLAGSから1日件数を2〜5へ固定できない');
  let invalidRejected = false;
  try { dailyCount15(() => 0, {dailyTickets:1}); } catch (_) { invalidRejected = true; }
  if (!invalidRejected) bad('dailyTicketsの範囲外を拒否しない');
} catch (error) {
  bad('日次案件の選択ロジックを検査できない: ' + error.message);
}
// 5. 非選択案件を参照せず、その日のstate.ticketsだけを表示する。
if (!sourceOf('renderQueue').includes('state.tickets.filter') || !sourceOf('renderWorldStrip').includes('state.tickets.filter') || !sourceOf('renderOffice').includes('state.tickets.filter')) bad('未選択案件が待機・世界地図から除外されない');
// 6. 実際の全件closedで既存日報へ進む。
if (!sourceOf('checkShiftEnd').includes("state.tickets.some(t => t.state !== 'closed')") || !sourceOf('checkShiftEnd').includes("state.phase = 'report'; renderReport()")) bad('その日の全件終了でシフト終了レポートへ到達しない');
// 7. 集計と表示が実件数を使い、2件の日の空欄にも表示を持つ。
if (!sourceOf('metrics').includes('state.tickets.length - abandoned') || !sourceOf('renderReport').includes("state.tickets.length + '件") || !sourceOf('renderReport').includes('該当する特記事項はありません。') || !sourceOf('showBriefing').includes("state.tickets.length + '件の電話を受けます")) bad('レポート集計・ブリーフィング・空項目が当日の実件数に追従しない');
if (!sourceOf('resetGame').includes('prepareDailyScenarios(SCENARIOS, state.random).map(newTicket)')) bad('resetGameが日次案件選択を使わない');

// §21-7: 会話の継ぎ目に関する12検査。
const actions21 = sourceOf('renderActions');
const refund21 = sourceOf('doRefund');
const angry21 = sourceOf('endAngryCall');
const close21 = sourceOf('doClose');
// 1. 5経路はすべてpendingResultで待ち、顧客発話中はボタンを出さない。
if (!actions21.includes('if (pendingTypedLine(t))') || !refund21.includes('t.pendingResult = {') || !angry21.includes('t.pendingResult = {') || !close21.includes('t.pendingResult = result') || refund21.includes('closeTicket(') || angry21.includes('closeTicket(') || close21.includes('closeTicket(t, result)')) bad('5経路のいずれかが顧客最終発話より先に終話する');
// 2. 経路別ボタン。
const resultLabel21 = sourceOf('pendingResultButtonLabel');
if (!resultLabel21.includes("result.kind === 'complaint' || result.kind === 'hangup'") || !resultLabel21.includes("'オフィスへ戻る'") || !resultLabel21.includes("'電話を切る'")) bad('終話ボタンが経路別の文言になっていない');
// 3. すべての終話経路にオペレーター発話を置く。
if (!close21.includes('resolutionOperatorClosing(') || !refund21.includes('CALL_FLOW_LINES.ending.refundSatisfied') || !refund21.includes('CALL_FLOW_LINES.ending.refundDissatisfied') || !angry21.includes('CALL_FLOW_LINES.ending[kind]')) bad('終話経路の最後付近にオペレーター発話が揃っていない');
// 4. 誤診2回目の順序。
const misFailure21 = close21.indexOf('CALL_FLOW_LINES.misdiagnosis.failure');
const misApology21 = close21.indexOf('CALL_FLOW_LINES.misdiagnosis.apology');
const misStage21 = close21.indexOf("pendingConversation = { kind:'second_misdiagnosis'");
if (misFailure21 < 0 || misFailure21 >= misApology21 || misApology21 >= misStage21 || !sourceOf('advanceConversationFlow').includes('endAngryCall(t, reason)')) bad('誤診2回目が不調報告・謝罪・最終怒りの順ではない');
// 7. 社内照会の開始・完了・要約。
const lookupStart21 = sourceOf('doLookup');
const lookupFinish21 = sourceOf('finishLookup');
if (!lookupStart21.includes('lookup.holdStart') || !lookupStart21.includes('lookup.talkStart') || !lookupFinish21.includes('lookup.completePrefix') || !lookupFinish21.includes('r && r.fact ? r.fact.text')) bad('社内照会の開始・完了・結果要約が発話で揃わない');
// 8. 記録確認は開始だけ。
const record21 = sourceOf('openRecord');
if (!record21.includes('CALL_FLOW_LINES.recordStart') || record21.includes('completePrefix') || record21.includes('お待たせしました')) bad('会話記録の確認が開始文だけではない');
// 9. 途中切断と再入電。
const interrupt21 = sourceOf('interruptCall');
const finishInterrupt21 = sourceOf('finishInterruptedCall');
if (!interrupt21.includes('CALL_FLOW_LINES.interrupt') || !interrupt21.includes('オペレーターが対応途中で切断しました。') || !finishInterrupt21.includes('t.redialGreeting = true') || !sourceOf('greetCurrentCustomer').includes('CALL_FLOW_LINES.redialGreeting')) bad('途中切断の発話・能動態note・専用再入電挨拶が揃わない');
// 10. 通常解決の順序。
const resolvedReply21 = close21.indexOf('pushCustomerLine(t, resolutionReply');
const operatorClose21 = close21.indexOf('resolutionOperatorClosing(grade, causeMatched)');
const farewell21 = close21.indexOf('pushCustomerLine(t, farewellLine(s, grade)');
if (resolvedReply21 < 0 || resolvedReply21 >= operatorClose21 || operatorClose21 >= farewell21 || Object.keys(CALL_FLOW_LINES.resolved).length !== 3) bad('通常解決の発話順または締め3種類が違う');
// 11. typing_budgetは4秒以内。
const duration21 = text => text.length * 25 + ((text.match(/[、。！？!?]/g) || []).length * 175);
const speech21 = [];
const collect21 = value => typeof value === 'string' ? speech21.push(value) : value && typeof value === 'object' && Object.values(value).forEach(collect21);
collect21(CALL_FLOW_LINES);
SCENARIOS.forEach(scenario => Object.values(scenario.lookups || {}).forEach(result => result && result.text && speech21.push(CALL_FLOW_LINES.lookup.completePrefix + (result.fact ? result.fact.text : result.text))));
if (speech21.some(text => duration21(text) > 4000)) bad('§21の追加発話がtyping_budgetの4秒上限を超えている');
// 12. 追加発話は1操作2行まで。テスト操作には追加しない。
if (!sourceOf('pushFlowLines').includes('if (lines.length > 2) throw') || sourceOf('doTest').includes('CALL_FLOW_LINES')) bad('追加発話の2行上限またはテスト操作の無追加を守っていない');

// §23-6 ⑪〜⑮: 社長の確定文も既存タイプ処理を通し、読み終えてから後続を開く。
const ending23 = sourceOf('showCareerEnding');
const finishTyping23 = sourceOf('finishTyping');
const details23 = sourceOf('careerEndingDetailsHtml');
const final23 = sourceOf('careerEndingFinalHtml');
const complete23 = sourceOf('renderCareerEndingComplete');
const president23 = sourceOf('drawCompanyPresident');
if (!ending23.includes('class="ending-line line typing"') || !ending23.includes('<span class="say"></span>') || ending23.includes('esc(PRESIDENT_ENDING_LINE)')) bad('社長の台詞が1文字ずつではなく一度に全文表示される');
if (!ending23.includes('startTyping(state.endingSpeech)') || !sourceOf('startTyping').includes("/[、。！？!?]/.test(line.text[pos - 1]) ? 175 : 25")) bad('社長の台詞が顧客と同じstartTyping速度を通らない');
if (PRESIDENT_ENDING_LINE.length !== 68 || duration21(PRESIDENT_ENDING_LINE) !== 2225 || duration21(PRESIDENT_ENDING_LINE) > 4000) bad('社長の確定文が68文字・2.225秒のtyping_budgetに収まらない');
if (ending23.includes('careerEndingDetailsHtml(') || ['ending-totals','ending-badge-grid'].some(token => ending23.includes(token) || !details23.includes(token)) || !final23.includes('ending-back-to-shift') || !finishTyping23.includes("state.phase === 'ending'")) bad('社長の台詞完了前に通算・バッジ・戻るが現れる');
if (!gameSource.includes("if (typingLine){ finishTyping(); return; }")) bad('社長の台詞をタップで送り切れない');
if (!ending23.includes('setTimeout(() => startTyping(state.endingSpeech), 0)') || !ending23.includes('tapGuardTimer = setTimeout(clearEndingTapGuard, 400)') || !finishTyping23.includes("state.phase === 'ending' && endingTapGuard") || !sourceOf('showBalanceConsole').includes('event.stopImmediatePropagation()') || !sourceOf('renderDebrief').includes('event.stopImmediatePropagation()')) bad('社長の再生操作自体がタップ送りに誤認される');
if (!president23.includes('p.paper, x + 1, y - 24, 9, 5') || !president23.includes('p.charcoal, x - 2, y - 21, 3, 8') || !president23.includes('p.charcoal, x + 10, y - 21, 3, 8') || president23.includes('p.charcoal, x - 1, y - 23, 13, 5')) bad('社長の頭頂部地肌と両サイドの髪が描き分けられていない');

// §23-6 ⑯〜㉓: 一拍置くENDと、社長を見る10人の朝礼隊形。
const reveal23 = sourceOf('revealCareerEndingFinal');
const staff23 = sourceOf('drawMorningStaff');
const staffMember23 = sourceOf('drawMorningStaffMember');
if (!final23.includes('id="ending-end">END</div>') || final23.indexOf('ending-end') > final23.indexOf('ending-back-to-shift') || !pageSource.includes('.ending-end{') || /border|animation/.test(pageSource.slice(pageSource.indexOf('.ending-end{'), pageSource.indexOf('}', pageSource.indexOf('.ending-end{'))))) bad('ENDが称号一覧の下・戻るボタンの上に簡潔に表示されない');
if (!complete23.includes("'<div id=\"ending-finale\"></div>'") || !complete23.includes('setTimeout(revealCareerEndingFinal, 1000)')) bad('ENDが通算成績と称号一覧より約1秒遅れて現れない');
if (!reveal23.includes('slot.innerHTML = careerEndingFinalHtml()') || final23.indexOf('ending-back-to-shift') < final23.indexOf('ending-end')) bad('戻るボタンがENDより先に現れる');
if (!finishTyping23.includes('skipEndingBeat = true') || !sourceOf('startTyping').includes('finishTyping(false)') || !complete23.includes('if (skipEndingBeat) revealCareerEndingFinal()')) bad('タップ送りでENDと戻るボタンまで一度に表示されない');
if (MORNING_STAFF.length !== 10 || !staff23.includes('MORNING_STAFF.forEach')) bad('エンディングの朝礼に立った社員が10人描かれない');
if (MORNING_STAFF.some(staff => staff.facing !== 'back') || /eye|mouth|face/.test(staffMember23) || !staffMember23.includes('後頭部・肩・背中・立ち脚')) bad('社員が社長を見る後ろ姿になっていない');
if (new Set(MORNING_STAFF.map(staff => staff.hair)).size < 3 || new Set(MORNING_STAFF.map(staff => staff.hairColor)).size < 3 || new Set(MORNING_STAFF.map(staff => staff.coat)).size < 5 || new Set(MORNING_STAFF.map(staff => staff.shoulders)).size < 3 || !staffMember23.includes('p[staff.hairColor]') || !staffMember23.includes('p[staff.coat]')) bad('社員の髪型・髪色・服色・肩幅が描き分けられていない');
if (MORNING_STAFF.some(staff => Object.keys(staff).some(key => /player|highlight|arrow|label/i.test(key))) || /staff\.(?:player|highlight|arrow|label)/i.test(staffMember23)) bad('プレイヤーだけを示す強調表示がある');

// S2/S3 に q_lamp が入ったか
['S2','S3'].forEach(id => {
  const s = SCENARIOS.find(x => x.id === id);
  if (!s.replies.q_lamp) bad(id + ': q_lamp の返答が追加されていない');
});

// 照会グラフ
const vizAt = [];
SCENARIOS.forEach(s => Object.keys(s.lookups || {}).forEach(k => { if (s.lookups[k].viz) vizAt.push(s.id + '/' + k); }));
console.log('照会グラフの付いた箇所: ' + (vizAt.join(', ') || 'なし'));

console.log(ng ? '\n★ ' + ng + ' 件の食い違い' : '\n期待値と完全一致');
if (ng) process.exitCode = 1;
