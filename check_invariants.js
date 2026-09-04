/* ビジュアル追加でゲームの中身が変わっていないかを、ことの手元の期待値と突き合わせる */
const fs = require('fs');
const { readGameSource, functionSource: extractFunctionSource } = require('./test_helpers');
const src = fs.readFileSync(__dirname + '/p2_data.js', 'utf8') +
  '\nreturn {SHIFT_START,SHIFT_END,LAST_INBOUND_TURN,MIN_INBOUND_GAP,HANDOVER_ZERO_RATE,HANDOVER_ONE_RATE,HANDOVER_ANSWER_RATE,CAUSES,TYPES,QUESTIONS,QUESTION_GROUPS,LOOKUPS,TESTS,RISKY,REMEDIES,SCENARIOS,NAME_POOL,PLACE_POOL,PLACE_CONSTRAINTS,SOOTHES,SOOTHE_EFFECTS,SMALLTALK_EFFECTS,IDENTITY_CALMING_EFFECTS,APOLOGIES,APOLOGY_REPLIES,FAREWELL_LINES,REDIAL_OPENINGS,REDIAL_STRESS,BLIND_CALLBACK_STRESS,BLIND_CALLBACK_CSAT_PENALTY,DESK_LOOKUP_MINUTES,DEVICE_VERIFICATION_MINUTES,CALL_CHARGE_COMPLAINT_TYPES,COMMAND_DEFS,SLOGANS,OFFICE_PALETTE,MORNING_OFFICE_PALETTE,OFFICE_STATIONS,MORNING_STAFF,ARTIFACT_URL,ARTIFACT_QR,ARTIFACT_QR_QUIET_ZONE,LUCK_RATE,CARRIER_REPLY_RATE,SOUND_SETTINGS,GAME_FLAGS,CAREER_STORAGE_KEY,CAREER_VERSION,CAREER_STAGES,CAREER_BADGES,PRESIDENT_ENDING_LINE,REFUND_POLICY,ANGRY_DEFAULT_OUTCOMES,ANGRY_REDIAL_OPENINGS,COMPLAINT_EMAIL_TEMPLATES,MISDIAGNOSIS_EMAIL_TEMPLATES,GRATITUDE_EMAIL_TEMPLATES,LOW_CSAT_COMPLAINT_RATE,GRATITUDE_RATE,CALL_FLOW_LINES};';
const D = new Function(src)();
const { SHIFT_START, SHIFT_END, LAST_INBOUND_TURN, MIN_INBOUND_GAP, HANDOVER_ZERO_RATE, HANDOVER_ONE_RATE, HANDOVER_ANSWER_RATE, CAUSES, TYPES, SCENARIOS, NAME_POOL, PLACE_POOL, PLACE_CONSTRAINTS, LOOKUPS, QUESTIONS, QUESTION_GROUPS, REMEDIES, SOOTHES, SOOTHE_EFFECTS, SMALLTALK_EFFECTS, IDENTITY_CALMING_EFFECTS, APOLOGIES, APOLOGY_REPLIES, FAREWELL_LINES, REDIAL_OPENINGS, REDIAL_STRESS, BLIND_CALLBACK_STRESS, BLIND_CALLBACK_CSAT_PENALTY, DESK_LOOKUP_MINUTES, DEVICE_VERIFICATION_MINUTES, CALL_CHARGE_COMPLAINT_TYPES, COMMAND_DEFS, SLOGANS, OFFICE_PALETTE, MORNING_OFFICE_PALETTE, OFFICE_STATIONS, MORNING_STAFF, ARTIFACT_QR, ARTIFACT_QR_QUIET_ZONE, LUCK_RATE, CARRIER_REPLY_RATE, SOUND_SETTINGS, GAME_FLAGS, CAREER_STORAGE_KEY, CAREER_VERSION, CAREER_STAGES, CAREER_BADGES, PRESIDENT_ENDING_LINE, REFUND_POLICY, ANGRY_DEFAULT_OUTCOMES, ANGRY_REDIAL_OPENINGS, COMPLAINT_EMAIL_TEMPLATES,MISDIAGNOSIS_EMAIL_TEMPLATES,GRATITUDE_EMAIL_TEMPLATES,LOW_CSAT_COMPLAINT_RATE,GRATITUDE_RATE, CALL_FLOW_LINES } = D;

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
  S7: { cause:'coverage',    best:'r_coverage_replacement',noOut:null,            partial:['r_coverage_refund'],tone:'technical' },
  S8: { cause:'sim',         best:'r_sim_clean',       noOut:null,               partial:['r_escalate_swap'],tone:'warm' },
  S9: { cause:'logistics',   best:'r_transfer_logi',   noOut:null,               partial:['r_come_tomorrow'],tone:'brief' },
  S10:{ cause:'hardware',    best:'r_hardware_swap',   noOut:null,               partial:['r_hardware_no_swap'],tone:'warm' },
  S11:{ cause:'location',    best:'r_move_guide',      noOut:null,               partial:['r_window_stationary'],tone:'brief' },
  S12:{ cause:'provision',   best:'r_carrier_reopened_explain',noOut:null,        partial:[],                 tone:'warm' },
  S13:{ cause:'logistics',   best:'r_logistics_replacement',noOut:null,           partial:['r_logistics_refund'],tone:'warm' },
  S14:{ cause:'fup',         best:'r_topup',           noOut:null,               partial:['r_slow_ok'],      tone:'brief' },
};

// 依頼で渡した液晶データ
const PANEL = {
  S1:{ bars:3, carrier:'{carrier}',     sim:'ok',   throttle:true,  clients:2, battery:62 },
  S2:{ bars:4, carrier:'{carrier}',     sim:'ok',   throttle:false, clients:3, battery:71 },
  S3:{ bars:4, carrier:'{carrier}',     sim:'ok',   throttle:false, clients:5, battery:55 },
  S4:{ bars:4, carrier:'{carrier}',     sim:'ok',   throttle:false, clients:2, battery:80 },
  S5:{ bars:0, carrier:null,           sim:'ok',   throttle:false, clients:2, battery:45 },
  S6:{ bars:0, carrier:null,           sim:'ok',   throttle:false, clients:2, battery:38 },
  S7:{ bars:0, carrier:null,           sim:'ok',   throttle:false, clients:3, battery:66 },
  S8:{ bars:null, carrier:null,        sim:'none', throttle:false, clients:0, battery:80 },
  S9:null,
  S10:{ bars:null, carrier:null,        sim:'none', throttle:false, clients:0, battery:76 },
  S11:{ bars:1, carrier:'{carrier}',    sim:'ok',   throttle:false, clients:2, battery:68 },
  S12:{ bars:0, carrier:null,           sim:'ok',   throttle:false, clients:2, battery:73 },
  S13:{ bars:0, carrier:null,           sim:'ok',   throttle:false, clients:2, battery:82 },
  S14:{ bars:4, carrier:'{carrier}',    sim:'ok',   throttle:true,  clients:1, battery:58 },
};

let ng = 0;
const bad = (m) => { console.log('  NG  ' + m); ng++; };

if (JSON.stringify(SLOGANS) !== JSON.stringify(EXPECTED_SLOGANS)) bad('SLOGANS が確定6文言・順番と一致しない');
if (SLOGANS.some(slogan => !slogan)) bad('SLOGANS に空文字がある');
if (LUCK_RATE !== 0.9) bad('運の本来どおり率が0.9ではない');
if (JSON.stringify(GAME_FLAGS) !== JSON.stringify({luckRate:0.9,shuffleArrival:true,shuffleIdentity:true,dailyTickets:null,handoverTickets:null,careerStage:null,unlockedBadges:null,solvedScenarios:null,soundEnabled:true,soundVolume:0.75})) bad('運・音・1日件数・引き継ぎ件数・キャリアの初期GAME_FLAGSが確定値と違う');
if (JSON.stringify(REFUND_POLICY) !== JSON.stringify({
  amount:2400,
  company:{causes:['hardware','provision','logistics','carrier','coverage'],rejectionRate:0.05,satisfactionRate:0.5},
  customer:{causes:['fup','devices','heavy','device_side','device_net','power'],rejectionRate:0.2,satisfactionRate:0.1},
  neutral:{causes:['location','geo_block','sim'],rejectionRate:0.1,satisfactionRate:0.25},
})) bad('返金の金額・14原因分類・拒否率・満足率が確定値と違う');
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
  { id:'customer', no:'1', label:'顧客のこと', questionIds:['q_name','q_contract','q_stay','q_stay_length','q_replacement','q_return'] },
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
const SHIP = { S3:'normal', S7:'next', S9:'fast', S10:'next', S13:'next' };
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

// §25: 折り返し先データは全案件に持たせる。
const CALLBACK_TO = { S1:'hotel', S2:'mobile', S3:'mobile', S4:'hotel', S5:'hotel', S6:'mobile', S7:'hotel', S8:'hotel', S9:'mobile', S10:'hotel', S11:'mobile', S12:'hotel', S13:'hotel', S14:'mobile' };
SCENARIOS.forEach(s => {
  if (s.callbackTo !== CALLBACK_TO[s.id]) bad(s.id + ': callbackTo が ' + CALLBACK_TO[s.id] + ' のはずが ' + s.callbackTo);
});
const gameSource = readGameSource(__dirname);
const sourceOf = name => extractFunctionSource(gameSource, name);
const pageSource = fs.readFileSync(__dirname + '/p1_head.html', 'utf8');
const generatedPage = fs.readFileSync(__dirname + '/index.html', 'utf8');
if (generatedPage.includes('mobile-pane-nav') || generatedPage.includes('data-mobile-pane')) bad('上部の通話・待機・診断タブが残っている');
const paneOrder = [...pageSource.matchAll(/<section class="pane ([^"]+)">/g)].map(match => match[1]);
if (JSON.stringify(paneOrder) !== JSON.stringify(['desk','call-summary'])) bad('§56 2ペインのDOM順が対応デスク→待機状況ではない');
const stackedPaneCss = (pageSource.match(/\.pane,body\.playing \.pane\{([^}]*)\}/) || [])[1] || '';
if (!/display\s*:\s*flex/.test(stackedPaneCss)) bad('2ペインが同時表示になっていない');
const hidesGamePane = [...pageSource.matchAll(/([^{}]+)\{([^}]*)\}/g)].some(([, selectors, declarations]) =>
  /display\s*:\s*none/.test(declarations) && selectors.split(',').some(selector =>
    /\.pane(?:\.(?:desk|call-summary))?$/.test(selector.trim())
  )
);
if (hidesGamePane) bad('2ペインの一部が非表示になっている');
['line-state','queue-count'].forEach(id => {
  if (!pageSource.includes('id="' + id + '"')) bad('count-chip ' + id + ' がない');
});
if (!gameSource.includes("$('line-state').textContent")) bad('通話状態のcount-chipが更新されない');
if (!gameSource.includes("$('queue-count').textContent")) bad('待ち件数のcount-chipが更新されない');
if (/<section class="pane board">|id="fact-count"|id="board"/.test(pageSource) || /function render(?:Board|DevicePanel)\(|remainingCauseCandidates|nextActionGuide|boardExcluded/.test(gameSource)) bad('§56 診断ボードまたは候補要約の実装が残っている');
if (gameSource.includes('mobilePane')) bad('廃止したペイン切替状態 mobilePane が残っている');
if ((gameSource.match(/farewellLine\(/g) || []).length !== 3 || !gameSource.includes("if (satisfied){") || !gameSource.includes("farewellLine(t.s, 'partial')")) bad('別れの言葉が通常解決と満足した返金だけに限定されていない');
if (!/const CALL_RATE_PER_MIN = 180;/.test(gameSource)) bad('国際通話料が1分¥180ではない');
if (/const CALLBACKS|callbacksLeft/.test(gameSource)) bad('現地キャリア照会と無関係な折り返し枠が戻っている');
const carrierLookup25 = LOOKUPS.find(lookup => lookup.id === 'l_carrier');
if (!carrierLookup25 || carrierLookup25.minutes !== 30 || carrierLookup25.external !== true) bad('l_carrierが30分の社外照会ではない');
if (!sourceOf('doLookup').includes('if (l.external) return') || !sourceOf('startCarrierCallback').includes("state.ui.lookup !== lookup.id")) bad('l_carrierの再開通依頼を通常照会として実行できる');
if (COMMAND_DEFS.length !== 4 || COMMAND_DEFS.some(command => command.id === 'callback')) bad('折り返すが5つ目の主コマンドへ戻っている');
if (!pageSource.includes('data-office-callback="1"') || !pageSource.includes('id="office-tray-status"')) bad('オフィスの電話をかけるボタンまたは折り返し待ち表示がない');
if (!sourceOf('resumeCallback').includes("t.callbackStage = 'front_desk'") || !sourceOf('resumeCallback').includes("who:'front'")) bad('ホテル折り返しがFront Deskから始まらない');
if (!sourceOf('handleFrontDeskChoice').includes("{ who:'front', text:frontReply }") || !sourceOf('handleFrontDeskChoice').includes("{ who:'cust', text:customerReply }")) bad('Front Deskから客へ話者が切り替わらない');
const s12Carrier25 = SCENARIOS.find(s => s.id === 'S12');
if (!s12Carrier25 || !s12Carrier25.lookups.l_plan.text.includes('契約: 有効') || !s12Carrier25.lookups.l_carrier.text.includes('00:00 に契約満了として停止') || (s12Carrier25.lookups.l_carrier.fact.hot || []).join(',') !== 'provision' || s12Carrier25.lookups.l_carrier.fact.out.length !== CAUSES.length - 1) bad('S12の自社契約照会と現地キャリア照会の食い違い・provision確定力がない');
if (/00:00|0時|日付が変わ/.test(s12Carrier25.opening) || !(s12Carrier25.replies.q_when.fact.hot || []).includes('provision')) bad('S12の第一声が正確な日付境界を漏らす、またはq_whenで手がかりを得られない');
if (!sourceOf('enterOffice').includes('activateDueInbound()') || !sourceOf('handleOfficeAction').includes("firstTicketIn('waiting', 'arrivedTurn')")) bad('折り返し中にほかの電話を取れない');
const fiveNightBadge25 = CAREER_BADGES.find(badge => badge.id === 'ten_nights');
if (!fiveNightBadge25 || fiveNightBadge25.label !== '五夜勤' || fiveNightBadge25.condition !== '通算5シフトを完了') bad('ten_nightsのID互換を保った「五夜勤」表示になっていない');

// §26: 既定照会結果と顧客向け要約を分離し、共通のシステム画面で見せる。
if (Object.prototype.hasOwnProperty.call(CALL_FLOW_LINES.lookup, 'miss') || gameSource.includes('CALL_FLOW_LINES.lookup.miss') || gameSource.includes('該当する記録は確認できませんでした')) bad('§26 矛盾した照会miss要約が残っている');
if (!LOOKUPS.every(lookup => lookup.spoken && lookup.defaultResult && lookup.title && !Object.prototype.hasOwnProperty.call(lookup, 'miss'))) bad('§26 LOOKUPSのspoken・defaultResult・titleが揃っていない');
if (!QUESTIONS.every(question => typeof question.miss === 'string' && question.miss.length)) bad('§26 QUESTIONSの二度聞き用missを損なっている');
const finishLookup26 = sourceOf('finishLookup');
const lookupSystemLine26 = sourceOf('lookupSystemLine');
const recentTranscript26 = sourceOf('recentTranscriptLines');
if (!finishLookup26.includes('lookupSystemLine(l, null)') || finishLookup26.includes('lookup.miss')) bad('§26 案件固有結果なしで既定結果を使わない');
// §40: 調べた結果を客へ勝手に読み上げない。何を伝えるかは「伝える」で選ぶ。
if (finishLookup26.includes('r.fact ? r.fact.text') || finishLookup26.includes('l.spoken') || finishLookup26.includes('completePrefix')) bad('§40 照会しただけで結果の中身を客へ発話している');
if (!lookupSystemLine26.includes('typed:true') || !recentTranscript26.includes('latestLookupIndex') || !recentTranscript26.includes('return [delivered[latestLookupIndex], playerAfter]')) bad('§26 照会直後にシステム結果画面と読み上げ要約が表示されない');
const lookupScreen26 = sourceOf('renderLookupSystemScreen');
const lookupRows26 = sourceOf('lookupResultRows');
if (!lookupScreen26.includes('system-screen lookup-system-screen') || !lookupScreen26.includes('lookupTitle') || !pageSource.includes('.system-screen{') || !pageSource.includes('font-family: var(--mono)')) bad('§26 照会結果が枠・タイトル・等幅のシステム画面ではない');
if (!lookupRows26.includes('／') || !lookupScreen26.includes('lookup-system-row')) bad('§26 照会結果を項目ごとの行へ分けられない');
if (!pageSource.includes('.system-screen{ background:#10212B; color:#A8E4DF; box-shadow:inset 0 0 18px #071118; }')) bad('§26 システム画面の配色が指定値と揃っていない');
if (!lookupScreen26.includes("line.viz ? renderLookupViz(line.viz) : ''") || !lookupScreen26.includes("line.external ? ' external'") || !lookupScreen26.includes('外部照会')) bad('§26 vizの画面内表示またはl_carrierの外部照会表示がない');

// §27: 調べる・ログは常時押せ、未特定なら共通の時間無消費システム画面で拒否する。
const commandMenu27 = sourceOf('renderCommandMenu');
const requireIdentification27 = sourceOf('requireIdentification');
const openLookup27 = sourceOf('openLookup');
const openRecord27 = sourceOf('openRecord');
const denied27 = sourceOf('renderIdentityDenied');
const record27 = sourceOf('renderRecord') + sourceOf('renderCustomerRecord') + sourceOf('renderRecordLog');
const recordTranscript27 = sourceOf('renderRecordTranscript');
if (/record:\{[^}]*disabled/.test(commandMenu27)) bad('§27 ログが本人特定前に無効化されている');
if (/lookup:\{[^}]*disabled/.test(commandMenu27) || commandMenu27.includes('disabled:!t.identified')) bad('§27 調べるが本人特定前に無効化されている');
if (!requireIdentification27.includes('identificationReady(t)') || /nameKnown\s*&&\s*t\.destinationKnown/.test(requireIdentification27)) bad('§27 共通ガードが既存のidentificationReady以外で判定している');
if (!openRecord27.includes('requireIdentification(t)') || !openLookup27.includes('requireIdentification(t)')) bad('§27 調べる・ログが共通の本人確認ガードを通らない');
const denyIndex27 = requireIdentification27.indexOf("defaultUi('identity_denied')");
const spendIndex27 = openRecord27.indexOf('spendOnCall(t, 1, 0)');
if (denyIndex27 < 0 || spendIndex27 < 0 || openRecord27.indexOf('requireIdentification(t)') >= spendIndex27 || requireIdentification27.includes('spendOnCall') || openLookup27.includes('spendOnCall')) bad('§27 本人特定前の拒否で時間を消費する');
if (!denied27.includes('system-screen record-system-screen identity-denied-screen denied') || !denied27.includes('フルネームと渡航先、または契約IDを確認してください。')) bad('§27 本人特定前の要件を共通システム画面で案内しない');
if (!record27.includes('system-screen record-system-screen') || !record27.includes('<b>顧客レコード</b>') || !record27.includes('renderRecordTranscript(t)')) bad('§27 通話記録が共通システム画面で全履歴を表示しない');
if (!recordTranscript27.includes('t.transcript.map') || !recordTranscript27.includes("cust:'客'") || !recordTranscript27.includes("sys:'社内システム'") || !recordTranscript27.includes('line.text')) bad('§27 通話記録から従来の発言・メモ・システム応答が欠ける');

// §28: 全案件解決の表エンディングと、8バッジの裏エンディングを独立して管理する。
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
if (!solvedIds28.includes("result.kind === 'closed'") || solvedIds28.includes("result.kind === 'refunded'") || !solvedIds28.includes('new Set')) bad('§53 返金を解決扱いせず、真の解決だけを重複なしで数えない');
if (!appendCareer28.includes('career.solvedScenarios.concat(context.solvedScenarioIds || [])') || appendCareer28.indexOf('career.shifts = career.shifts.slice(-30)') > appendCareer28.indexOf('career.solvedScenarios =')) bad('§28 solvedScenariosが30日制限と分離されていない');
if (endingQueue28.indexOf("queue.push('career')") < 0 || endingQueue28.indexOf("queue.push('secret')") < 0 || endingQueue28.indexOf("queue.push('career')") > endingQueue28.indexOf("queue.push('secret')")) bad('§28 表と裏の条件または同時達成時の表示順が違う');
if (!endingQueue28.includes('career.solvedScenarios.length === SCENARIOS.length') || !endingQueue28.includes('!career.ending') || !endingQueue28.includes('career.badges.length === CAREER_BADGES.length') || !endingQueue28.includes('!career.secretEnding')) bad('§28 表・裏を独立判定できない、または閲覧済みが再発火する');
if (!careerContext28.includes('solvedScenarioIds:solvedScenarioIdsFromTickets(tickets)')) bad('§28 シフト結果から解決済み案件を保存経路へ渡さない');
if (!secretEnding28.includes("showCareerEnding(replay, 'secret')") || secretEnding28.includes('準備中') || !sourceOf('showCareerEnding').includes("endingType === 'secret'") || !sourceOf('showCareerEnding').includes('state.career.secretEnding = true')) bad('§28 裏エンディングが表と同じ演出を使わない、または閲覧済みを保存しない');
if (!sourceOf('careerEndingEyebrowHtml').includes("state.endingType === 'secret'") || !sourceOf('careerEndingEyebrowHtml').includes('aria-label="裏エンディング">裏</span>')) bad('§28 同じ朝礼演出の裏エンディングに小さな印がない');
if (!nextEnding28.includes("type === 'career' ? !state.career.ending : !state.career.secretEnding") || !sourceOf('continueAfterCareerEnding').includes("if (next === 'secret')")) bad('§28 表の後に裏を続ける、または両方を一度ずつにする制御がない');
if (!careerDebrief28.includes("解決した案件 ' + career.solvedScenarios.length + ' / ' + SCENARIOS.length") || careerDebrief28.includes('SCENARIOS.map') || careerDebrief28.includes('scenario.name')) bad('§28 レポートが解決数を出さない、または未解決案件名を漏らす');
if (!Object.prototype.hasOwnProperty.call(GAME_FLAGS,'solvedScenarios') || GAME_FLAGS.solvedScenarios !== null || !careerFlags28.includes('flags.solvedScenarios') || !balance28.includes('showCareerEnding(true)') || !balance28.includes('showSecretEnding(true)')) bad('§28 GAME_FLAGSと調から表・裏エンディングを再現できない');

// §29: 毎夜のブリーフィングは状態と開始操作だけに絞り、説明はマニュアルへ残す。
const careerBriefing29 = sourceOf('careerBriefingHtml');
const briefing29 = sourceOf('showBriefing');
const manual29 = sourceOf('showManual');
const removedBriefing29 = ['海外用モバイルWiFiレンタルのテクニカルサポート','ここは、すでに海外にいるお客様','<h2>やること</h2>','<h2>評価の重みは隠しません</h2>','<h2>ひとつだけ先に</h2>'];
if (removedBriefing29.some(token => briefing29.includes(token))) bad('§29 ブリーフィングに毎夜不要な説明が残っている');
if (!careerBriefing29.includes("'日目 ／ '") || !careerBriefing29.includes('CAREER_STAGES[career.stage].label') || /inboundCount|handoverCount|入電|引き継ぎ/.test(careerBriefing29)) bad('§67 ブリーフィングは日数・段階だけを示し、今夜の件数を漏らさない');
if (!briefing29.includes('id="btn-start">シフトを始める</button>')) bad('§29 ブリーフィングにシフト開始ボタンがない');
if (!careerBriefing29.includes('career.totals.days === 0') || !careerBriefing29.includes('勤務記録はこのブラウザ内だけに保存されます。氏名や会話内容は保存しません。')) bad('§29 保存注記が初回だけになっていない');
const scoreWeights29 = ['顧客満足（CSAT）35%','一次解決率 25%','応答率 20%','費用 10%','業務報告 10%'];
if (!scoreWeights29.every(token => manual29.includes(token))) bad('§29 評価の配点5項目が対応マニュアルにない');
const operatingRules29 = ['電話は1本ずつしか取れません','無駄な質問1つが通話を1分延ばし','調べものは保留にすれば速く済みます','現地キャリアへの照会だけは30分かかります',"枠は' + ESCALATIONS + '回だけ",'相手によって刺さる話し方が違います'];
if (!operatingRules29.every(token => manual29.includes(token))) bad('§29 やること6項目が対応マニュアルに揃っていない');
if (!briefing29.includes('artifact-qr-card') || !briefing29.includes('drawArtifactQr()') || !/@media \(max-width:480px\)[\s\S]*?\.artifact-qr-card\{ display:none; \}/.test(pageSource)) bad('§29 QRカードの従来の表示・スマホ非表示が崩れている');

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
  S14:'はい。挨拶はいいです。原因を。',
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
  S13:{ minutes:2, number:'GDW-630519' },
  S14:{ minutes:1, number:'GDW-771403' },
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
    angry:['その話、後。結論を言って。', '時計見てます？ 次の予定が迫ってる。急いで。'],
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
    'その話、後。結論を言って。 返答D', '時計見てます？ 次の予定が迫ってる。急いで。 返答E',
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
if (SCENARIOS.length !== 14 || !SCENARIOS.every(s => Array.isArray(s.smalltalk) && s.smalltalk.length >= 1 && s.smalltalk.every(topic => requiredTopicFields.every(field => typeof topic[field] === 'string' && topic[field].length > 0)))) bad('全14シナリオの雑談話題6項目が揃っていない');
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
if (!recentSource.includes("line.who === 'cust' || line.who === 'front' || line.who === 'me'") || !recentSource.includes('spoken.slice(runStart, customerIndex + 1)).slice(-4)')) bad('§44 直近会話が連続する顧客・Front Desk発話を最大4行で残さない');
const headerStart = gameSource.indexOf('function renderCallHeader(');
const headerEnd = gameSource.indexOf('\n\nfunction stressDisplayStage', headerStart);
const headerSource = headerStart < 0 || headerEnd < 0 ? '' : gameSource.slice(headerStart, headerEnd);
['t.s.name','t.s.city','localClock','t.s.device','t.s.plan','TYPES','call-guide'].forEach(leak => {
  if (headerSource.includes(leak)) bad('通話ヘッダにログへ移す情報が残っている: ' + leak);
});
const logSource = sourceOf('renderRecordLog');
const logHeadings = [...logSource.matchAll(/<h3>([^<]+)<\/h3>/g)].map(match => match[1]);
if (JSON.stringify(logHeadings) !== JSON.stringify(['会話の全履歴'])) bad('§56 ログに全履歴以外の要約が残っている');
if (/残っている原因の候補|次にできること|集まった手がかり|この案件のここまで/.test(gameSource)) bad('§56 診断ボードの候補数・手がかり・次の一手を別画面へ移している');
if (!sourceOf('renderCloseFlow').includes('CAUSES.map') || sourceOf('renderCloseFlow').includes('filter(')) bad('§56 原因選択で14原因を絞り込んでいる');
if (!sourceOf('hotCauses').includes('f.hot')) bad('§56 内部の原因絞り込み状態が失われている');
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
if (JSON.stringify(ANGRY_DEFAULT_OUTCOMES) !== JSON.stringify({anxious:'redial',novice:'email',expert:'email',hurried:'redial'})) bad('顧客タイプ別の既定苦情経路が確定仕様と違う');
if (Object.keys(ANGRY_REDIAL_OPENINGS).length !== 4 || Object.values(ANGRY_REDIAL_OPENINGS).some(line => !line)) bad('後から掛かる苦情電話の第一声が4タイプ分揃っていない');
if (Object.keys(COMPLAINT_EMAIL_TEMPLATES).length !== 4 || Object.values(COMPLAINT_EMAIL_TEMPLATES).some(template => !Array.isArray(template.lines) || template.lines.length < 2 || template.lines.length > 3 || !template.lines[0].includes('{symptom}'))) bad('翌日の苦情メールが4タイプ分・客自身の2〜3行で揃っていない');
if (!gameSource.includes("endAngryCall(t, 'stress')") || !sourceOf('advanceConversationFlow').includes('endAngryCall(t, reason)')) bad('ストレス100と誤診2回目が共通の怒り終話を通らない');
if (!sourceOf('endAngryCall').includes("kind:'complaint'") || !sourceOf('endAngryCall').includes("label:'翌日の苦情メール'") || sourceOf('endAngryCall').includes('pendingResult')) bad('怒りの限界で即時結果を見せず、後続の苦情へ分けられない');
if (!sourceOf('scheduleAngryRedial').includes('state.turn + MIN_INBOUND_GAP') || !sourceOf('scheduleAngryRedial').includes('ANGRY_REDIAL_OPENINGS')) bad('怒りの限界後に時間を空けた苦情再入電がない');
if (!gameSource.includes('function complaintEmailArrives') || !gameSource.includes("(result.kind === 'closed' || result.kind === 'refunded') && result.csat < 2") || !gameSource.includes('state.random() < LOW_CSAT_COMPLAINT_RATE') || LOW_CSAT_COMPLAINT_RATE !== 0.45 || GRATITUDE_RATE !== 0.25) bad('苦情・感謝メールの半減後の抽選条件がない');
if (!gameSource.includes('翌日、次の苦情が届いています') || !pageSource.includes('.complaint-mailbox')) bad('翌日デブリーフの苦情メール別枠がない');
if (!gameSource.includes("line.replace('{symptom}', t.s.opening)") || /template\.lines[\s\S]{0,240}(?:trueCause|causeName)/.test(gameSource)) bad('苦情メールが客の症状ではなく真因を漏らしている');
if (/toast/i.test(pageSource + '\n' + gameSource)) bad('トーストの関数・呼び出し・DOM・CSSが残っている');
if (!pageSource.includes('.stress-panel.alert') || !gameSource.includes("t.stress > 80 ? ' alert' : ''") || gameSource.includes('stressWarned')) bad('苛立ち80超の状態駆動点滅が往復に追従しない');
if (!gameSource.includes("recordOfficeEvent('abandoned'") || !gameSource.includes("recordOfficeEvent('redial'") || !gameSource.includes('state.officeEvents.slice(-3)')) bad('放棄呼・再着信がオフィス状態へ移っていない');
if (!gameSource.includes("recordOfficeEvent('closed'") || !gameSource.includes('result.label + scoreText') || !gameSource.includes('Number.isFinite(result.csat)')) bad('案件クローズ結果がオフィス状態へ移っていない');

// §18: Web Audio合成音は任意の飾りで、10場面と5段階の案件結果を区別する。
if (!gameSource.includes('new AudioContextClass()') || !gameSource.includes('createOscillator()') || !gameSource.includes('createGain()')) bad('Web Audioのコード合成がない');
if (/\.(?:mp3|wav|ogg|m4a)\b/i.test(pageSource + gameSource)) bad('外部の音声ファイルを参照している');
if (!gameSource.includes("$('btn-start').onclick = () => {\n    initAudio();")) bad('AudioContextがシフト開始操作の中で初期化されない');
if (!gameSource.includes("if (!GAME_FLAGS.soundEnabled || !audioContext) return") || !gameSource.includes('catch (error){ /* 音が出せなくてもゲーム進行は続ける */ }')) bad('ミュートまたは音声例外の安全経路がない');
['playOfficeRing()','playPickupSound()','playDisconnectSound()','playTypeSound(pos, line, t)','playCommandSound()','playStressWarning()','playClueSound()','playBadActionSound()','playCloseJingle(','playShiftEndSound()'].forEach(call => {
  if (!gameSource.includes(call)) bad('効果音10場面の呼び出しが欠けている: ' + call);
});
if (!gameSource.includes("result.kind === 'complaint' || result.kind === 'hangup') return 'accident'") || !gameSource.includes("result.kind === 'abandoned' || result.csat < 2") || !gameSource.includes("result.csat >= 4") || !gameSource.includes("result.csat >= 3")) bad('案件クローズ音の5段階分類がない');
if (!gameSource.includes('if (index % 4) return')) bad('タイプ音が1文字ごとに鳴る');
if (!gameSource.includes('previousStress <= 80 && t.stress > 80')) bad('苛立ち警告音が状態の80境界を再横断しても鳴らない');
if (!gameSource.includes('id="balance-sound"') || !gameSource.includes('id="balance-volume"')) bad('ゲーム調整にミュートと音量がない');

// §58: 顧客の打鍵音だけを性別で穏やかに分け、性別不明は中間音へ戻す。
const pitch58 = sourceOf('typeSoundFrequency');
const typeSound58 = sourceOf('playTypeSound');
if (!gameSource.includes("const TYPE_SOUND_BASE_HZ = Object.freeze({ male:380, neutral:760, female:1520 })") || !pitch58.includes("line.who === 'cust'") || !pitch58.includes('ticket.s.gender') || !pitch58.includes('TYPE_SOUND_BASE_HZ.neutral')) bad('§67 顧客の男女の打鍵音を中立から1オクターブずつ分けていない');
if (/trueCause|handoverSymptom|\.opening|\.type\b/.test(pitch58 + typeSound58)) bad('§58 声の高さが性別以外の症状・真因・顧客タイプを漏らしている');
if (!typeSound58.includes(".018, {type:'square',level:.025}") || !sourceOf('startTyping').includes('playTypeSound(pos, line, t)')) bad('§58 打鍵音の音量・長さを維持して話し手を渡していない');
if (sourceOf('pendingTypedLine').includes("x.who === 'me'")) bad('§58 オペレーター発話に顧客と同じ文字送り音を付けている');

// §59: 共通倍率で音量を持ち上げ、通常画面の切替をブラウザ内へ保存する。
if (JSON.stringify(SOUND_SETTINGS) !== JSON.stringify({storageKey:'wifi-support-game:audio:v1',defaultEnabled:true,defaultVolume:0.75,outputGain:3}) || !sourceOf('synthTone').includes('volume * SOUND_SETTINGS.outputGain *')) bad('§59 音全体の既定値と共通出力倍率が1か所にまとまっていない');
if (!pageSource.includes('data-sound-toggle="1"') || !sourceOf('showBriefing').includes('soundQuickControlHtml()') || !sourceOf('soundQuickControlHtml').includes('data-sound-toggle="1"')) bad('§59 音のON/OFFが上部バーとブリーフィングの届く場所にない');
if (!sourceOf('readSoundSettings').includes('SOUND_SETTINGS.storageKey') || !sourceOf('writeSoundSettings').includes('SOUND_SETTINGS.storageKey') || !sourceOf('setSoundEnabled').includes('writeSoundSettings(storage)') || !sourceOf('setSoundVolume').includes('writeSoundSettings(storage)')) bad('§59 音のON/OFFと音量をブラウザへ保存できない');
if (!gameSource.includes('initializeSoundSettings();\ninitializeCareer();') || sourceOf('clearCareerRecord').includes('SOUND_SETTINGS.storageKey')) bad('§59 音設定を起動時に復元できない、または勤務記録の消去で失う');
if (sourceOf('toggleSoundFromGesture').includes('GAME_FLAGS.soundVolume') || !sourceOf('applySoundEnabledFromGesture').includes('stopOfficeRing()')) bad('§59 音のON/OFFが音量を壊す、または鳴っている着信音を止めない');

// §60: iOS独自状態を含むrunning以外をタップでresumeし、失敗時だけ文脈を作り直す。
const unlock60 = sourceOf('unlockAudioFromGesture');
const recreate60 = sourceOf('recreateAudioContextFromGesture');
if (!unlock60.includes("ctx.state !== 'running'") || /ctx\.state === ['\"](?:suspended|interrupted)['\"]/.test(unlock60)) bad('§60 running以外のAudioContextをすべて再開対象にしていない');
if (!unlock60.includes("if (ctx.state !== 'running') ctx = await recreateAudioContextFromGesture(ctx)") || !recreate60.includes('await stale.close()') || !recreate60.includes('initAudio(true)')) bad('§60 resumeで戻らないAudioContextを閉じて作り直せない');
if (!sourceOf('audioStatusText').includes("' AudioContext: ' + currentAudioContextState()") || !sourceOf('currentAudioContextState').includes('audioContext.state')) bad('§60 現在のAudioContext状態を診断表示へ出していない');

// §19／§31／§53: 返金は提案し、拒否なら通話継続、受入後も未解決扱いにする。
const refund31 = sourceOf('doRefund');
const refundReject31 = sourceOf('refundProposalRejected');
const refundConfirm31 = sourceOf('renderRefundConfirmation');
const refundTell31 = sourceOf('renderTellOptions');
if (!gameSource.includes("kind:'refunded'") || !gameSource.includes('csat:satisfied ? 2.5 : 1.0') || !gameSource.includes('refundComplaint:!assessment.diagnosed')) bad('返金受入が未解決2.5以下となり、未診断返金の苦情を記録しない');
if (!gameSource.includes("defaultUi('refund_confirm')") || !refundConfirm31.includes('返金をご提案します') || !refundConfirm31.includes('受け入れていただければ') || refundConfirm31.includes('この電話はこれで終わります。')) bad('返金確認が提案と条件つき終話を伝えない');
if (!refundReject31.includes('GAME_FLAGS.luckRate === 1') || !refundReject31.includes('rejectionRate')) bad('返金拒否率またはluckRate 1.0の拒否なし経路がない');
if (!refund31.includes('t.refundProposalRejected = true') || !refund31.includes('spendOnCall(t, 2, 0)') || !refund31.includes('addStress(t, 18)') || !refundTell31.includes('t.refundProposalRejected') || !refundTell31.includes('data-refund="refund"')) bad('返金拒否後の通話継続・2分・苛立ち・再提案禁止が揃っていない');
if (!['anxious','novice','hurried','expert'].every(type => typeof TYPES[type].refundRejectReply === 'string' && TYPES[type].refundRejectReply.length)) bad('返金拒否の台詞が4タイプ分ない');
if (/\brefunds\b|refundCsat|refundResult|refundEffect/.test(gameSource)) bad('旧返金の回数管理・CSAT逓減が残っている');
if (!gameSource.includes("result.kind === 'closed' || result.kind === 'refunded'")) bad('不満足な返金が苦情メール対象に入らない');
const outageRefundRemedy = REMEDIES.carrier.find(remedy => remedy.id === 'r_outage_explain');
if (!outageRefundRemedy || outageRefundRemedy.cost !== 2400 || !outageRefundRemedy.needsOutage || outageRefundRemedy.kind !== 'resolve') bad('広域障害の正規対処 r_outage_explain が損なわれている');

// §32: non-expertの客は見えたことだけを話し、オペレーター側のfact/hot/outは維持する。
const scenarioSpeech32 = scenario => {
  const speech = [scenario.opening,scenario.contractId && scenario.contractId.text,scenario.rushedReply];
  Object.values(scenario.replies || {}).forEach(reply => speech.push(reply.text));
  Object.values(scenario.tests || {}).forEach(test => {
    if (test.text) speech.push(test.text);
    (test.sequence || []).forEach(step => speech.push(step.text));
  });
  (scenario.smalltalk || []).forEach(topic => speech.push(topic.goodReply,topic.badReply));
  return speech.filter(text => typeof text === 'string' && text.length);
};
const nonExpertSpeech32 = SCENARIOS.filter(scenario => scenario.type !== 'expert').flatMap(scenarioSpeech32);
if (nonExpertSpeech32.some(text => /SIMがないという表示ではなく|SIMカードではなく|回線登録だけが|プロビジョニングでは|網側の(?:障害|拒否)では/.test(text))) bad('non-expertの客が知らない技術的区別を否定形で述べている');
if (nonExpertSpeech32.some(text => /(?:^|[。！？…\s])(?:1|2|一|二)回目[、,]/.test(text))) bad('non-expertの客が自分の操作へ番号を振っている');
const s10Speech32 = SCENARIOS.find(scenario => scenario.id === 'S10').tests.t_simout.sequence;
const s13Lamp32 = SCENARIOS.find(scenario => scenario.id === 'S13').replies.q_lamp;
if (s10Speech32[0].text.includes('1回目') || !s10Speech32[1].text.includes('もう一度') || s13Lamp32.text.includes('SIMがないという表示ではなく')) bad('S10/S13の指定台詞が自然な言い方へ直っていない');
if (s10Speech32[0].fact.text !== '1回目のSIM清掃では認識しない' || s13Lamp32.fact.text !== 'SIMは認識しているが、到着時から現地回線を一度も捕捉していない' || JSON.stringify(s13Lamp32.fact.out) !== JSON.stringify(['sim','device_side','device_net'])) bad('台詞改稿でfactまたはhot/outが変わっている');

// §15-5/§25: 1日は全案件から2〜5件を重複なく選び、先頭の到着枠へ詰める。
try {
  const dailyCount15 = new Function(sourceOf('dailyTicketCount') + '\nreturn dailyTicketCount;')();
  const shuffle15 = new Function(sourceOf('shuffleScenarios') + '\nreturn shuffleScenarios;')();
  const drawArrivals15 = new Function('LAST_INBOUND_TURN','MIN_INBOUND_GAP', sourceOf('drawInboundArrivalTurns') + '\nreturn drawInboundArrivalTurns;')(LAST_INBOUND_TURN,MIN_INBOUND_GAP);
  const prepare15 = new Function('shuffleScenarios','dailyTicketCount','drawInboundArrivalTurns','assignScenarioIdentities', sourceOf('prepareDailyScenarios') + '\nreturn prepareDailyScenarios;')(shuffle15,dailyCount15,drawArrivals15,scenarios => scenarios);
  // 1-2. 何度選んでも2〜5件で、乱数境界により日ごとに変わる。
  const counts15 = [0,.199999,.2,.799999,.8,.899999,.9,.999999].map(value => dailyCount15(() => value, {dailyTickets:null}));
  if (JSON.stringify(counts15) !== JSON.stringify([2,2,3,3,4,4,5,5]) || new Set(counts15).size !== 4) bad('1日件数が20%/60%/10%/10%の境界で2〜5件にならない');
  // 3-5. 重複なし、勤務の器の中で06:00まで・20分以上離して着信。
  [2,3,4,5].forEach(count => {
    const selected = prepare15(SCENARIOS, () => .37, {dailyTickets:count,shuffleArrival:true});
    if (selected.length !== count || new Set(selected.map(s => s.id)).size !== count) bad(count + '件の日次案件に欠落または重複がある');
    if (selected.some(s => s.arrive < 0 || s.arrive > LAST_INBOUND_TURN) || selected.slice(1).some((s,index) => s.arrive - selected[index].arrive < MIN_INBOUND_GAP)) bad(count + '件の日の着信が06:00まで・20分間隔にならない');
  });
  if (sourceOf('prepareDailyScenarios').includes('scenario.arrive')) bad('案件データの arrive を夜勤の着信時刻に使っている');
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
if (!sourceOf('renderQueue').includes('state.tickets.filter') || !sourceOf('renderOffice').includes('state.tickets.filter')) bad('未選択案件が待機状況またはオフィス表示から除外されない');
// 6. 夜勤は23:00〜07:00で終了し、残件は放棄呼にする。
if (SHIFT_START !== 23 * 60 || SHIFT_END - SHIFT_START !== 8 * 60 || !sourceOf('checkShiftEnd').includes('state.clock >= SHIFT_END') || !sourceOf('finishShiftAtTime').includes('abandonTicket(t')) bad('夜勤が23:00〜07:00で終わらない、または残件を放棄呼にしない');
// 7. 集計と表示が実件数を使い、2件の日の空欄にも表示を持つ。
if (!sourceOf('metrics').includes('answered.length / answerAttempts') || !sourceOf('renderReport').includes("state.tickets.length + '件（入電 '") || !sourceOf('renderReport').includes('該当する特記事項はありません。') || /inboundCount|handoverCount/.test(sourceOf('careerBriefingHtml'))) bad('レポート集計が実件数に追従しない、またはブリーフィングが件数を漏らす');
if (!sourceOf('resetGame').includes('prepareShiftScenarios(SCENARIOS, state.random).map(newTicket)')) bad('resetGameが入電・引き継ぎ案件の選択を使わない');

// §21-7: 会話の継ぎ目に関する12検査。
const actions21 = sourceOf('renderActions');
const refund21 = sourceOf('doRefund');
const angry21 = sourceOf('endAngryCall');
const close21 = sourceOf('doClose') + sourceOf('finishSuccessfulClose');
// 1. 通常解決と返金はpendingResultで最後の顧客発話を待つ。怒りの限界は§67で即時切断する。
if (!actions21.includes('if (pendingTypedLine(t))') || !refund21.includes('t.pendingResult = {') || !close21.includes('t.pendingResult = result') || refund21.includes('closeTicket(') || close21.includes('closeTicket(t, result)') || angry21.includes('pendingResult')) bad('通常解決・返金の発話待ち、または怒りの即時切断が崩れている');
// 2. すべての終話経路で同じボタン文言。
const resultLabel21 = sourceOf('pendingResultButtonLabel');
if (!resultLabel21.includes("return '電話を切る'") || resultLabel21.includes("'オフィスへ戻る'")) bad('終話ボタンが全経路で「電話を切る」に揃っていない');
// 3. すべての終話経路にオペレーター発話を置く。
if (!close21.includes('resolutionOperatorClosing(') || !refund21.includes('CALL_FLOW_LINES.ending.refundSatisfied') || !refund21.includes('CALL_FLOW_LINES.ending.refundDissatisfied') || !angry21.includes('お客様との通話が切れました。')) bad('通常終話のオペレーター発話、または怒り切断の中立記録が揃っていない');
// 4. 誤診2回目の順序。
const misFailure21 = close21.indexOf('CALL_FLOW_LINES.misdiagnosis.failure');
const misApology21 = close21.indexOf('CALL_FLOW_LINES.misdiagnosis.apology');
const misStage21 = close21.indexOf("pendingConversation = { kind:'second_misdiagnosis'");
if (misFailure21 < 0 || misFailure21 >= misApology21 || misApology21 >= misStage21 || !sourceOf('advanceConversationFlow').includes('endAngryCall(t, reason)')) bad('誤診2回目が不調報告・謝罪・最終怒りの順ではない');
// 7. 社内照会の開始・完了・要約。
const lookupStart21 = sourceOf('doLookup');
const lookupFinish21 = sourceOf('finishLookup');
if (!lookupStart21.includes('lookup.holdStart') || !lookupStart21.includes('lookup.talkStart') || !lookupFinish21.includes('lookup.holdComplete') || !lookupFinish21.includes('lookup.talkComplete')) bad('社内照会の開始と完了の合図が発話で揃わない');
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
/* 照会結果はシステム画面に出るだけなので、発話の所要時間には数えない。 */
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

// §66: 未解決終話の案内と確認を廃止し、「伝える」の先頭から即時に切る。
const tell66 = sourceOf('renderTellOptions');
const endCall66 = sourceOf('endCurrentCall');
if (!tell66.includes("{ attrs:'data-end-call=\"1\"', body:'<span class=\"opt-label\">電話を切る</span>' }") || tell66.indexOf('data-end-call') > tell66.indexOf('data-tell="close"')) bad('§66 「電話を切る」が「伝える」の先頭にない');
if (!endCall66.includes('CALL_FLOW_LINES.interrupt') || !endCall66.includes('finishPromisedCallback(t)') || !endCall66.includes('t.symptomResolved') || !endCall66.includes('finishResolvedWithoutExplanation(t)') || !endCall66.includes('interruptCall(t)')) bad('§66/§68 即時終話が通常切断・折り返し約束・復旧後終話を分けていない');
if (sourceOf('unresolvedHangupGuide') || sourceOf('renderHangupConfirmation') || /data-hangup(?:=|-)/.test(gameSource) || gameSource.includes('hangup-confirm')) bad('§66 廃止した終話案内・確認が残っている');
if (!sourceOf('renderCloseFlow').includes('remedy-block-reason') || !pageSource.includes('.opt:disabled.has-block-reason') || !pageSource.includes('.remedy-block-reason')) bad('§33 前提不足の理由が通常説明と違う見た目にならない');
if (!sourceOf('remedyBlockReason').includes('先に「伝える」→「やってみてもらう」を ')) bad('§33 前提不足の従来理由文が変わっている');

// §34: S7は会社の機種選定ミスとして謝罪・対応機配送／返金で扱う。
const s7_34 = SCENARIOS.find(scenario => scenario.id === 'S7');
const s7Best34 = REMEDIES.coverage.find(remedy => remedy.id === s7_34.best);
const s7Partial34 = REMEDIES.coverage.find(remedy => s7_34.partial.includes(remedy.id));
if (!s7Best34 || s7Best34.label !== '手配の誤りをお詫びし、滞在期間と滞在先を確認したうえで代替機を発送する' || !s7Partial34 || s7Partial34.label !== '手配の誤りをお詫びし、返金する') bad('§34 S7の謝罪・代替機発送／返金が確定対処と違う');
if (Object.values(REMEDIES).flat().some(remedy => ['r_escalate_band','r_city_only'].includes(remedy.id))) bad('§34 廃止対象のS7対処が残っている');
if (JSON.stringify(s7Best34 && s7Best34.requiresQuestions) !== JSON.stringify(['q_stay','q_stay_length','q_replacement']) || s7Best34.requiresLongStay !== 3 || s7Best34.requiresConsent !== true || s7_34.stayDays < 3 || !s7_34.wantsReplacement) bad('§34 S7配送の既存3前提または長期滞在設定が違う');
if (SCENARIOS.some(scenario => Object.values(scenario.lookups || {}).some(result => result.customerReply || result.stressDelta)) || sourceOf('finishLookup').includes('r.customerReply')) bad('§53 照会結果だけで顧客が発話・苛立ち増加する例外が残る');
const s13_34 = SCENARIOS.find(scenario => scenario.id === 'S13');
if (s7_34.trueCause !== 'coverage' || s13_34.trueCause !== 'logistics' || !/市街地では正常/.test(s7_34.opening) || !/一度も/.test(s13_34.opening + s13_34.replies.q_when.text)) bad('§34 S7とS13の症状・真因を書き分けていない');

// §35: 機器未所持案件では成立しない質問・操作を表示も実行もしない。
const s9_35 = SCENARIOS.find(scenario => scenario.id === 'S9');
if (!SCENARIOS.every(scenario => typeof scenario.deviceInHand === 'boolean') || s9_35.deviceInHand !== false) bad('§35 全案件のdeviceInHandまたはS9=falseがない');
if (!['q_lamp','q_ssid','q_battery'].every(id => QUESTIONS.find(question => question.id === id).needsDevice) || !D.TESTS.concat(D.RISKY).every(test => test.needsDevice)) bad('§35 機器が必要な質問・操作の印が不足している');
if (!sourceOf('renderAskOptions').includes('!q.needsDevice || t.s.deviceInHand') || !sourceOf('renderTellOptions').includes('t.s.deviceInHand') || !sourceOf('renderTestOptions').includes('!test.needsDevice || t.s.deviceInHand')) bad('§35 機器未所持の質問・操作を一覧から隠していない');
if (!sourceOf('doAsk').includes('q.needsDevice && !t.s.deviceInHand') || !sourceOf('doTest').includes('test.needsDevice && !t.s.deviceInHand')) bad('§35 非表示項目をイベント経由で実行できる');
if (QUESTIONS.find(question => question.id === 'q_replacement').label.includes('直らない場合') || s9_35.replies.q_lamp || s9_35.replies.q_other_device || !(s9_35.replies.q_when.fact.hot || []).includes('logistics')) bad('§35 S9の前提不一致質問・回答または代替手がかりが直っていない');

// §36: 復旧は客の発話で見せ、原因説明へ導く。対処の構造は変えない。
const doTest36 = sourceOf('doTest');
if (!doTest36.includes('TYPES[t.s.type].solvedReply') || !doTest36.includes('t.symptomResolved = true') || doTest36.includes("who:'note', text:'この操作で症状が解消しました")) bad('§36 復旧が客のタイプ別発話で通話画面に出ない');
if (!Object.values(TYPES).every(type => type.solvedReply) || new Set(Object.values(TYPES).map(type => type.solvedReply)).size !== 4) bad('§36 復旧発話が4タイプ分書き分けられていない');
const simClean36 = REMEDIES.sim.find(remedy => remedy.id === 'r_sim_clean');
if (!simClean36 || simClean36.label !== '接点の一時的な接触不良だったことをご説明し、そのままご利用いただく' || simClean36.kind !== 'resolve' || simClean36.needsTest !== 't_simout' || simClean36.needsTestCount !== 2) bad('§36 r_sim_cleanの説明文または構造が違う');
if (sourceOf('doApologize').includes('pendingResult') || sourceOf('doApologize').includes('closeTicket')) bad('§36 謝罪だけで終話できる');
if (/who:'note', text:'[^']*(?:症状が解消|原因を確定して案内)/.test(gameSource)) bad('§36 次の手に必要な復旧情報がnoteへ残っている');

// §37: 現地キャリアへ再開通を依頼し、完了連絡を待ってから説明する。
const s12_37 = SCENARIOS.find(scenario => scenario.id === 'S12');
const carrier37 = LOOKUPS.find(lookup => lookup.id === 'l_carrier');
const remedy37 = REMEDIES.provision.find(remedy => remedy.id === 'r_carrier_reopened_explain');
if (!carrier37 || carrier37.label !== '現地キャリアへ回線の再開通を依頼する' || CARRIER_REPLY_RATE !== 0.8) bad('§37 再開通依頼または80%完了連絡が定義されていない');
if (!sourceOf('startCarrierCallback').includes("t.carrierReplyStatus = 'pending'") || !sourceOf('resolveCarrierRequest').includes("state.random() < carrierReplyProbability()")) bad('§37 30分後の完了連絡を確率で一度だけ決めていない');
if (!sourceOf('carrierReplyProbability').includes('flags.luckRate === 1 ? 1') || !sourceOf('resolveCarrierRequest').includes("recordOfficeEvent('carrier'")) bad('§37 luckRate 1.0の確定連絡またはホワイトボード通知がない');
if (!CALL_FLOW_LINES.carrier.reopenedReplies.novice.includes('あ、さっきから使えてます') || !CALL_FLOW_LINES.carrier.pendingReplies.novice.includes('まだ圏外')) bad('§37 折り返し冒頭の復旧感謝または未復旧の落胆がない');
if (!remedy37 || s12_37.best !== remedy37.id || !remedy37.needsCarrierRestored || !remedy37.reportsRestored || !/同期ずれ.*再開通が完了/.test(remedy37.label)) bad('§37 S12最適対処が復旧後の原因説明になっていない');
if (!sourceOf('finishCarrierLookup').includes("t.carrierReplyStatus === 'arrived'") || !sourceOf('finishCarrierLookup').includes('t.carrierRestored = true') || !sourceOf('remedyBlockReason').includes('remedy.needsCarrierRestored')) bad('§37 未完了のまま復旧説明を選べる');

// §38: 人物と土地だけを日ごとに入れ替え、土地依存の症状制約とbundleを保つ。
const names47 = new Set(NAME_POOL.map(entry => entry.name));
const namesEn47 = new Set(NAME_POOL.map(entry => entry.nameEn));
const cities38 = new Set(PLACE_POOL.map(place => place.city));
if (NAME_POOL.length < SCENARIOS.length * 2 || names47.size !== NAME_POOL.length || namesEn47.size !== NAME_POOL.length || NAME_POOL.some(entry => !/^[A-Za-z]+(?: [A-Za-z]+)+$/.test(entry.nameEn))) bad('§47 名前プールに重複・非ローマ字があるか、案件数の2倍の候補がない');
if (NAME_POOL.some(entry => !Array.isArray(entry.ageBand) || entry.ageBand.length !== 2 || !Number.isInteger(entry.ageBand[0]) || !Number.isInteger(entry.ageBand[1]) || entry.ageBand[0] > entry.ageBand[1])) bad('§47 名前の年齢帯が2つの整数の組になっていない');
if (PLACE_POOL.length !== SCENARIOS.length || cities38.size !== SCENARIOS.length || PLACE_POOL.some(place => !place.country || !place.cityEn || !Number.isFinite(place.localOffset) || !place.carrier)) bad('§38 土地bundleに欠落または都市重複がある');
if (JSON.stringify(PLACE_CONSTRAINTS) !== JSON.stringify({geo_block:'china_only',provision:'deep_night'})) bad('§38 検査6-12: 土地制約がgeo_blockとprovisionの2つだけではない');
const assign38 = sourceOf('assignScenarioIdentities');
const allowed38 = sourceOf('placeAllowedForScenario');
const places38 = sourceOf('assignScenarioPlaces');
if (!GAME_FLAGS.shuffleIdentity || !assign38.includes('flags.shuffleIdentity ? drawScenarioIdentities(scenarios, random)') || !assign38.includes('item.country !== place.country')) bad('§38 人物・土地シャッフルまたは別国SIMの差し込みがない');
if (!allowed38.includes("place.cityEn === 'SHANGHAI'") || !allowed38.includes('minute >= 22 * 60 || minute < 4 * 60')) bad('§38 中国限定または深夜限定の土地制約がない');
if (!sourceOf('scenarioNeedsSharedRegion').includes("['carrier'].includes(scenario.trueCause)") || !places38.includes('place.regionGroup !== sharedCarrierRegion[1].regionGroup') || !places38.includes('used.has(place.sourceScenarioId)')) bad('§38 キャリア同地域または一晩の土地重複防止がない');
if (!sourceOf('replaceScenarioTemplates').includes('city|country|carrier|region|wrongCountry|spouse')) bad('§38 土地bundleの差し込み対象が不足している');
if (/20時|22時|22:35/.test(SCENARIOS.find(scenario => scenario.id === 'S9').opening + SCENARIOS.find(scenario => scenario.id === 'S9').replies.q_when.text)) bad('§38 S9に固定時刻が残っている');
if (/B20|1800MHz|2100MHz/.test(SCENARIOS.find(scenario => scenario.id === 'S7').lookups.l_area.text)) bad('§38 S7に特定キャリア依存の周波数名が残っている');
const strings38 = scenario => JSON.stringify(scenario);
if (/同行.{0,8}(?:いま|今).{0,8}待たせ|待たせて(?:います|いる|ます)/.test(strings38(SCENARIOS.find(scenario => scenario.id === 'S2')))) bad('§38 検査6-8: S2に同行者をいま待たせている現在進行が残っている');
if (/退勤済み|退勤した/.test(strings38(SCENARIOS.find(scenario => scenario.id === 'S9'))) || !/担当者も不在/.test(strings38(SCENARIOS.find(scenario => scenario.id === 'S9')))) bad('§38 検査6-9: S9が時間帯に依存しない担当者不在の表現ではない');
const s11Strings38 = strings38(SCENARIOS.find(scenario => scenario.id === 'S11'));
if (/会議開始まで|開始まで\d+分|残り\d+分|これから始まる|間に合った/.test(s11Strings38) || !/会議場/.test(s11Strings38) || !/地下/.test(s11Strings38)) bad('§38 検査6-10: S11の会議カウントダウンが残る、または会議場・地下の芯がない');
if (TYPES.hurried.angry.some(text => /会議が始まる/.test(text)) || !TYPES.hurried.angry.some(text => /次の予定が迫って/.test(text))) bad('§38 検査6-11: hurried共通文が予定一般の表現ではない');
if (SCENARIOS.some(scenario => Object.prototype.hasOwnProperty.call(scenario,'timeConstraint')) || allowed38.includes('timeConstraint')) bad('§38 検査6-12: 案件固有の追加土地・時間帯制約が残っている');

// §39: 入電は客負担、ホテル折り返しは当社負担。Front Deskを英語で通す。
if (!sourceOf('callCost').includes('t.outboundMinutes') || !sourceOf('customerCallCost').includes('t.inboundMinutes') || sourceOf('callCost').includes('t.callMinutes')) bad('§39 入電と折り返しの通話料負担が分離されていない');
if (!sourceOf('spendOnCall').includes("t.callDirection === 'outbound'") || !sourceOf('spendOnCall').includes('callChargeConcernThreshold()') || !sourceOf('spendOnCall').includes('t.callChargeThresholdPassed = true') || !sourceOf('spendOnCall').includes('!t.symptomResolved && !resolvingSymptom') || !sourceOf('spendOnCall').includes('t.callChargeConcerned = true') || !sourceOf('spendOnCall').includes('CALL_FLOW_LINES.callChargeConcern[t.s.type]')) bad('§39/§68 方向別分数、通話料発話の幅、または復旧後の抑止がない');
if (Object.keys(CALL_FLOW_LINES.callChargeConcern).length !== 4 || new Set(Object.values(CALL_FLOW_LINES.callChargeConcern)).size !== 4) bad('§39 通話料を気にする発話が4タイプ分ない');
if (!sourceOf('renderCallHeader').includes("outbound ? '当社負担' : 'お客様負担'") || !sourceOf('renderCallHeader').includes('t.callSegmentMinutes')) bad('§39 通話ヘッダに負担者と区間時間が出ない');
// §40: 折り返しは「伝える」の中の一手。滞在先を聞かずに切ることもでき、その場合は折り返せず客から掛かってくる。
if (!sourceOf('renderTellOptions').includes('data-hotel-callback') || sourceOf('renderCommandMenu').includes('data-hotel-callback')) bad('§40 ホテルへの折り返しが「伝える」の中にない');
const blindCallback40 = sourceOf('blindCallbackRedial');
if (!sourceOf('finishPromisedCallback').includes('!hotelContactKnown(t)') || !sourceOf('finishPromisedCallback').includes('blindCallbackRedial(t)')) bad('§40 滞在先未確認の折り返しを取り違えずに分けていない');
// §45: 折り返しは「約束」と「切る」に分かれた。約束した時点では通話を終わらせない。
const promise45 = sourceOf('startHotelCallback');
const finish45 = sourceOf('finishPromisedCallback');
if (!promise45.includes('t.callbackPromised = preferredKind') || promise45.includes("t.state = 'callback'") || promise45.includes('state.focus = null')) bad('§45 折り返しの申し出がその場で通話を終わらせている');
if (!finish45.includes("t.state = 'callback'") || !finish45.includes('leaveCallForOffice()') || !sourceOf('endCurrentCall').includes('finishPromisedCallback(t)')) bad('§45 「電話を切る」で折り返し待ちへ入らない');
if (!sourceOf('hotelCallbackOffered').includes('!t.callbackPromised')) bad('§45 約束したあとも「伝える」に折り返しが残る');
if (!sourceOf('renderCallHeader').includes('callbackPromise.headScheduled') || !sourceOf('renderCallHeader').includes('callbackPromise.headImmediate')) bad('§45 約束したことが通話ヘッダに出ない');
if (!sourceOf('renderAskOptions').includes('!q.needsCallbackPromise || t.callbackPromised')) bad('§45 戻る時間の質問が約束前から出る');
if (Object.prototype.hasOwnProperty.call(CALL_FLOW_LINES.callbackPromise,'guide') || /まだ原因を絞れていません|このまま切ると、お客様から再入電になります/.test(gameSource)) bad('§66 廃止した終話前案内文が残っている');
if (!blindCallback40.includes('CALL_FLOW_LINES.callback.blameOpenings[t.s.type]') || !blindCallback40.includes("t.state = 'waiting'") || !blindCallback40.includes('BLIND_CALLBACK_STRESS') || !blindCallback40.includes('BLIND_CALLBACK_CSAT_PENALTY')) bad('§40 折り返せなかった客が非難つきで掛け直してこない');
if (Object.keys(CALL_FLOW_LINES.callback.blameOpenings).length !== 4 || new Set(Object.values(CALL_FLOW_LINES.callback.blameOpenings)).size !== 4) bad('§40 折り返しなしを責める発話が4タイプ分ない');
if (BLIND_CALLBACK_STRESS <= REDIAL_STRESS) bad('§40 連絡先なしの切断が、ただの切断より軽い');
if (!sourceOf('resumeCallback').includes("t.callbackStage = 'front_desk'") || !sourceOf('renderTranscript').includes("front:'Front Desk'")) bad('§39 折り返しでFront Deskの英語応対へ入らない');
if (!Object.values(CALL_FLOW_LINES.frontDesk.options).every(line => /^[\x20-\x7E]+$/.test(line)) || !sourceOf('renderFrontDeskOptions').includes('Please choose what to say in English.')) bad('§39 Front Deskの選択肢が英語で揃っていない');
if (!sourceOf('renderFrontDeskOptions').includes('front-desk-context') || !sourceOf('renderFrontDeskOptions').includes('latestFront.text')) bad('§39 Front Deskの発話が選択画面に固定表示されない');
if (!sourceOf('renderFrontDeskOptions').includes('t.s.nameEn') || !sourceOf('handleFrontDeskChoice').includes('t.s.nameEn')) bad('§39 Front Deskへ伝える顧客名がローマ字ではない');
if (!sourceOf('renderFrontDeskOptions').includes("const roomChoice = room") || sourceOf('renderFrontDeskOptions').includes("replace('{room}', room || '—')")) bad('§39 部屋番号不明時にroom選択肢またはダッシュが出る');
if (!sourceOf('isLateLocalTime').includes('ticketLocalMinute(t)') || !sourceOf('ticketLocalMinute').includes('t.s.localOffset') || !sourceOf('resumeCallback').includes('CALL_FLOW_LINES.frontDesk.lateQuestion')) bad('§39 土地のlocalOffsetによる深夜判定または難色発話がない');
if (!sourceOf('handleFrontDeskChoice').includes("const direct = choice === 'callback'") || !sourceOf('handleFrontDeskChoice').includes("t.callbackStage = 'connected'") || sourceOf('handleFrontDeskChoice').includes("t.callbackStage = 'blocked'")) bad('§39 折り返し説明の円滑接続または他選択肢の非詰みを守らない');
if (sourceOf('finishPromisedCallback').includes('l_carrier') || !sourceOf('finishPromisedCallback').includes("t.callbackReason = 'general'")) bad('§39 一般折り返しがl_carrier専用のまま');

// §41: 二種類の折り返し、社内レコード、配送先の再確認。実プレイ用の不変条件。
const callback41 = sourceOf('startHotelCallback') + sourceOf('finishPromisedCallback');
const tell41 = sourceOf('renderTellOptions');
const desk41 = sourceOf('doDeskLookup');
const front41 = sourceOf('handleFrontDeskChoice') + sourceOf('applyCallbackWaitStress') + sourceOf('callbackLookupAllowance');
const record41 = sourceOf('renderCustomerRecord') + sourceOf('renderRecordLog') + sourceOf('renderRecord') + sourceOf('recordValue');
const ask41 = sourceOf('doAsk') + sourceOf('replacementAddressConfirmation');
const hint41 = sourceOf('deliverStayHint');
if (!tell41.includes('data-hotel-callback="immediate"') || !tell41.includes('data-hotel-callback="scheduled"')) bad('§41-1 折り返しの二択がない');
if (!callback41.includes('CALLBACK_SCHEDULED_MINUTES') || !callback41.includes("kind === 'scheduled'")) bad('§41-2 1時間後の折り返し時刻がない');
if (!callback41.includes('blindCallbackRedial(t)')) bad('§41-3 滞在先未確認でも失敗できる折り返しでない');
if (!desk41.includes('callbackLookupCount') || !front41.includes('callbackWaitStressDelta') || !sourceOf('callbackWaitStressDelta').includes('CALLBACK_OVER_LOOKUP_STRESS') || !sourceOf('callbackConnectionCustomerReply').includes('CALLBACK_WAIT_REPLIES')) bad('§41-4/5 折り返し中の照会超過ストレスがない');
if (!sourceOf('callbackWaitStressDelta').includes('CALLBACK_IDLE_STRESS') || !sourceOf('callbackLookupAllowance').includes('CALLBACK_SCHEDULED_LOOKUP_ALLOWANCE')) bad('§41-6/7 1時間待ちの未照会代償または上限なしがない');
if (!sourceOf('renderOffice').includes('callbackRemaining') || sourceOf('renderOffice').includes('queueCutoff') || sourceOf('renderOffice').includes('切断')) bad('§41-8/§52 待機時間が見えない、または放棄までの時間を見せている');
if (!sourceOf('finishLookup').includes("defaultUi('system_record')") || !record41.includes('顧客レコード') || record41.includes('includeLog ? renderRecordLog(t) :') === false) bad('§41-9/13 照会・ログのレコード表示が分かれていない');
['l_plan','l_ship','l_area','l_session','l_outage'].forEach(id => { if (!record41.includes("lookupRecordValue(t, '" + id + "')")) bad('§41-10 レコード欄がない: ' + id); });
if (!record41.includes('identificationReady(t)') || !record41.includes('―― 未照会')) bad('§41-11 本人確認前または未照会欄が伏せられない');
if (sourceOf('renderDevicePanel')) bad('§56 廃止した聞き取りメモの診断パネルが残っている');
if (!ask41.includes('replacementAddressCheck') || !ask41.includes("['q_stay','q_stay_length']") || !ask41.includes('t.s.wantsReplacement')) bad('§41-16/17 代替機発送後の届け先確認がない');
if (!ask41.includes('repeatedQuestionReply(t)')) bad('§41-18 通常の再質問ペナルティが消えている');
if (!hint41.includes('t.s.stayHint') || !src.includes('SCENARIO_RECORD_META') || !src.includes('出張') || !src.includes('旅行')) bad('§41-19/20 長短滞在のほのめかしがない');
if (!sourceOf('doAsk').includes("qid === 'q_stay_length') t.stayDaysKnown = true")) bad('§41-21 滞在日数確定の条件が変わった');
if (SCENARIOS.some(s => !['female','male'].includes(s.gender) || !Number.isInteger(s.tripDays) || !Number.isInteger(s.tripDay) || !Number.isInteger(s.stayDays) || s.stayDays !== s.tripDays - s.tripDay)) bad('§41-22 全件の顧客レコード日数・性別が揃わない');
const draw47 = sourceOf('drawScenarioIdentities');
if (NAME_POOL.some(entry => !['female','male'].includes(entry.gender)) || !sourceOf('assignScenarioIdentities').includes('gender:scenario.gender')) bad('§41-23 性別が人物bundleでシャッフルされない');
// §47: 性別は案件に固定せず引く。名前は引いた性別の候補から選び、年齢は案件と名前の幅の重なりから引く。
if (NAME_POOL.filter(entry => entry.gender === 'female').length < SCENARIOS.length || NAME_POOL.filter(entry => entry.gender === 'male').length < SCENARIOS.length) bad('§47 男女いずれかの候補が案件数に足りない');
if (!draw47.includes("random() < 0.5 ? 'female' : 'male'") || !draw47.includes('gender:entry.gender')) bad('§47 性別が候補から引かれない、または引いた名前の性別と食い違う');
if (!draw47.includes('entry.ageBand[0] <= range[1] && range[0] <= entry.ageBand[1]')) bad('§47 名前の年齢帯と案件の年齢の幅が突き合わされていない');
if (!draw47.includes('usedNames.add(entry.name)') || !draw47.includes('!usedNames.has(entry.name)')) bad('§47 同じシフトで同じ名前が二度出るのを防いでいない');
if (SCENARIOS.some(s => !Array.isArray(s.ageRange) || s.ageRange.length !== 2 || !Number.isInteger(s.ageRange[0]) || !Number.isInteger(s.ageRange[1]) || s.ageRange[0] > s.ageRange[1])) bad('§47 案件の年齢の幅が2つの整数の組になっていない');
if (SCENARIOS.some(s => s.age < s.ageRange[0] || s.age > s.ageRange[1])) bad('§47 案件本体の年齢が自分の年齢の幅の外にある');
// §47: 案件ごとに、男女どちらでも名前の候補が残ること（片方の性別で詰まない）。
if (SCENARIOS.some(s => ['female','male'].some(want => NAME_POOL.filter(entry => entry.gender === want && entry.ageBand[0] <= s.ageRange[1] && s.ageRange[0] <= entry.ageBand[1]).length < 3))) bad('§47 男女どちらかで名前の候補が3人未満の案件がある');
// §47: 性別で変わる語は {spouse} に寄せ、生の「夫」「妻」を台詞に残さない。
const spouseText47 = JSON.stringify(SCENARIOS).replace(/大丈夫/g, '');
if (/[^{]夫|妻/.test(spouseText47.replace(/\{spouse\}/g, ''))) bad('§47 台詞に生の「夫」または「妻」が残っている');
if (!JSON.stringify(SCENARIOS.find(s => s.id === 'S1')).includes('{spouse}') || !JSON.stringify(SCENARIOS.find(s => s.id === 'S3')).includes('{spouse}')) bad('§47 S1・S3 の配偶者の呼び方が {spouse} になっていない');
if (!sourceOf('scenarioWithIdentityAndPlace').includes("spouse:identity.gender === 'female' ? '夫' : '妻'")) bad('§47 配偶者の呼び方が客の性別から決まらない');
const hints411 = SCENARIOS.map(s => s.stayHint || '');
if (new Set(hints411).size !== SCENARIOS.length) bad('§41-26 滞在のほのめかしが案件ごとに固有でない');
if (SCENARIOS.some(s => /明日(?:には|は).*移動/.test(s.stayHint || '') && s.stayDays > 1)) bad('§41-27 滞在のほのめかしと残り泊数が矛盾する');
if (hints411.some(text => /\d|[０-９]/.test(text))) bad('§41-28 滞在のほのめかしが日数を明言している');
if (new Set(SCENARIOS.map(s => s.tripDay)).size === 1 || SCENARIOS.find(s => s.id === 'S1').tripDay < 2 || SCENARIOS.find(s => s.id === 'S10').tripDay !== 4) bad('§41-29 渡航日数が案件の発話と合わない');
if (!callback41.includes('t.callbackLookupCount = 0') || !callback41.includes('t.callbackWaitStressApplied = false') || sourceOf('applyCallbackWaitStress').includes("callbackReason !== 'general'")) bad('§41-30/31 折り返しごとの代償リセットまたはキャリア待機の代償がない');
if (!sourceOf('doDeskLookup').includes('state.desk.recordTicketId') || !sourceOf('renderDesk').includes('renderCustomerRecord(t, false)')) bad('§41-32 端末調査後に顧客レコードが開かない');
if (!sourceOf('lookupRecordValue').includes('lookup.defaultResult')) bad('§41-33 既定照会結果が顧客レコードから消える');
if (!sourceOf('newTicket').includes('callbackWaitStressApplied:false') || !sourceOf('newTicket').includes('stayHintDelivered:false')) bad('§41-34 §41の新しいticket状態が初期化されない');
const expectedHintKinds411 = {S1:'新婚旅行',S2:'旅行',S3:'移る予定',S4:'出張',S5:'仕事',S6:'資料',S7:'仕事',S8:'旅行',S9:'泊まり',S10:'出張',S11:'会議',S12:'旅行',S13:'長い滞在',S14:'移動'};
if (SCENARIOS.some(s => !(s.stayHint || '').includes(expectedHintKinds411[s.id]))) bad('§41-35 滞在のほのめかしが案件の他の台詞と矛盾する');
if ((src.match(/stayDays:/g) || []).length !== SCENARIOS.length || /SCENARIO_RECORD_META[\s\S]*?stayDays:/.test(src)) bad('§41-36 滞在・顧客レコード属性が二重定義されている');
const moving411 = SCENARIOS.filter(s => s.deliveryAddress);
if (moving411.length !== 1 || !['r_coverage_replacement','r_hardware_swap','r_logistics_replacement'].includes(moving411[0].best)) bad('§41-38 代替機発送の正解案件に移動する客が1件いない');
const deliveryAddressGate411 = "qid === 'q_stay' && t.s.deliveryAddress";
if (!sourceOf('doAsk').includes(deliveryAddressGate411) || !sourceOf('doAsk').includes('t.stayAddress = t.s.deliveryAddress') || !sourceOf('replacementAddressConfirmation').includes(deliveryAddressGate411)) bad('§41-39 移動先の台詞と配送先更新が再質問条件で揃わない');
const close411 = sourceOf('doClose') + sourceOf('finishSuccessfulClose');
if (!close411.includes('t.s.deliveryAddress && !t.deliveryAddressConfirmed') || !close411.includes('base -= 1.0')) bad('§41-40 配送先取り違えが満足度だけへ影響しない');
const tripExpected411 = {S1:[3,5],S10:[4,10],S13:[1,8]};
if (Object.entries(tripExpected411).some(([id,values]) => { const s=SCENARIOS.find(x=>x.id===id); return !s || s.tripDay !== values[0] || s.tripDays !== values[1]; })) bad('§41-41 渡航日数の検査が導出値だけを見ている');

// §52-4 / §55: 日勤からの引き継ぎは、既存案件を23時に受けて一度だけ直接折り返す。
try {
  const count55 = new Function('HANDOVER_ZERO_RATE','HANDOVER_ONE_RATE', sourceOf('handoverTicketCount') + '\nreturn handoverTicketCount;')(HANDOVER_ZERO_RATE,HANDOVER_ONE_RATE);
  const counts55 = [0,.599999,.6,.849999,.85,.999999].map(value => count55(() => value, {handoverTickets:null}));
  if (JSON.stringify(counts55) !== JSON.stringify([0,0,1,1,2,2]) || HANDOVER_ZERO_RATE <= HANDOVER_ONE_RATE || HANDOVER_ZERO_RATE <= 1-HANDOVER_ZERO_RATE-HANDOVER_ONE_RATE) bad('§55 引き継ぎが0〜2件で、0件の夜が最も多くない');
  if ([0,1,2].some(count => count55(() => 0, {handoverTickets:count}) !== count)) bad('§55 GAME_FLAGSで引き継ぎ件数を固定できない');
} catch (error) { bad('§55 引き継ぎ件数を検査できない: ' + error.message); }
const prepare55 = sourceOf('prepareShiftScenarios');
if (!prepare55.includes('const total = inboundCount + handoverCount') || !prepare55.includes("workOrigin:'handover'") || !prepare55.includes('drawHandoverCallbackTurns(handoverCount, arrivalSlots, random)')) bad('§55 入電とは別の引き継ぎを既存案件から選び、約束時刻を割り当てていない');
if ((prepare55.match(/assignScenarioIdentities\(/g) || []).length !== 1 || !prepare55.includes('assignScenarioIdentities(timed')) bad('§55 入電と引き継ぎをまとめて人物・土地割り当てせず、同じ客が重複しうる');
if (SCENARIOS.some(scenario => typeof scenario.handoverSymptom !== 'string' || !scenario.handoverSymptom.trim())) bad('§55 既存14案件の引き継ぎ用症状が揃わない');
const ticket55 = sourceOf('newTicket');
if (!ticket55.includes("state:handover ? 'callback' : 'inbound'") || !ticket55.includes('callbackDestination:handover ? \'direct\' : null') || !ticket55.includes('identified:handover') || !ticket55.includes('facts:[]')) bad('§55 引き継ぎ案件が本人確認済み・手がかりなしの直接折り返し待ちで始まらない');
const meeting55 = sourceOf('showHandoverMeeting');
if (!meeting55.includes('ticket.s.name') || !meeting55.includes('ticket.s.handoverSymptom') || !meeting55.includes('fmtClock(ticket.callbackDue)') || /trueCause|\.facts|\.lookups|\.opening|CAUSES|REMEDIES/.test(meeting55)) bad('§55 23時の引き継ぎMTGが誰か・何が・いつの3点に限られていない');
if (!meeting55.includes("'様</strong>が「'") || !meeting55.includes("'」とお困りなので、<strong>'") || !meeting55.includes("'ごろ</strong>に連絡してください。</p></article>'") || /<dt>|誰か|何が|いつ/.test(meeting55) || (meeting55.match(/ticket\.s\.name/g) || []).length !== 1) bad('§55 23時の引き継ぎMTGがラベルや重複のない1行の申し送りになっていない');
if (!sourceOf('startShiftFromBriefing').includes('if (handoverMeetingTickets().length)')) bad('§55 引き継ぎ0件の日に空の会議を飛ばせない');
const available55 = sourceOf('handoverCustomerAvailable');
if (HANDOVER_ANSWER_RATE !== .5 || !available55.includes('flags.luckRate === 1') || !available55.includes('state.random() < HANDOVER_ANSWER_RATE')) bad('§55 在室50%またはluckRate 1で必ず在室にならない');
const resume55 = sourceOf('resumeHandoverCallback');
if (!resume55.includes('t.handoverAttempted') || !resume55.includes('t.handoverAttempted = true') || !resume55.includes("t.callbackStage = 'direct'") || !resume55.includes('finishUnavailableHandover(t)')) bad('§55 引き継ぎへ直接一度だけ連絡し、不在時に完了できない');
if (!sourceOf('metrics').includes('const scored = finished.filter(t => !unscoredOutcome(t))') || !sourceOf('renderDebrief').includes('if (unscoredOutcome(t))')) bad('§55 不在・朝の引き継ぎを評価対象外にできない');
if (!sourceOf('finishShiftAtTime').includes("if (t.state === 'open') handoffActiveTicket(t)") || !sourceOf('reportOptions').includes("ticket.result.kind === 'handed_off'")) bad('§55 07時の通話中案件を放棄呼でなく日勤への必須申し送りにできない');

// §57 / §66: 判定済みの最終時刻を共通時計へ補間し、撤去した時刻表示は更新しない。
const duration57 = sourceOf('timePassageDuration');
const passage57 = sourceOf('startTimePassageIfNeeded');
const display57 = sourceOf('renderPresentedTime');
if (!duration57.includes('minutes * 25') || !duration57.includes('2800')) bad('§57 経過時間に比例する1時間1.5秒・最大2.8秒の演出でない');
if (!display57.includes("$('clock')") || display57.includes('office-clock') || display57.includes('renderShiftStrip')) bad('§57 共通時計が表示時刻で動かない、または撤去した時刻表示を更新する');
if (!passage57.includes('typewriterOff()') || !passage57.includes('requestAnimationFrame(step)')) bad('§57 reduced-motion即着地またはフレーム補間がない');
if (/state\.(?:clock|turn)\s*=|\badvance\(|activateDueInbound|abandonTicket|resolveCarrierRequest/.test(passage57 + display57)) bad('§57 演出の途中でゲーム時刻または判定を動かしている');
if (!gameSource.includes('if (timePassage){') || !gameSource.includes('finishTimePassage();') || !gameSource.includes("if (timePassage && (e.key === ' ' || e.key === 'Enter'))")) bad('§57 時間経過演出を飛ばせない');
if (!sourceOf('renderReport').includes('startTimePassageIfNeeded(() => renderReport())')) bad('§57 07:00の着地前に業務報告へ飛ぶ');

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
