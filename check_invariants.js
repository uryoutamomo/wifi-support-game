/* ビジュアル追加でゲームの中身が変わっていないかを、ことの手元の期待値と突き合わせる */
const fs = require('fs');
const { readGameSource } = require('./test_helpers');
const src = fs.readFileSync(__dirname + '/p2_data.js', 'utf8') +
  '\nreturn {CAUSES,TYPES,QUESTIONS,QUESTION_GROUPS,LOOKUPS,TESTS,RISKY,REMEDIES,SCENARIOS,SOOTHES,SOOTHE_EFFECTS,SMALLTALK_EFFECTS,IDENTITY_CALMING_EFFECTS,APOLOGIES,APOLOGY_REPLIES,FAREWELL_LINES,REDIAL_OPENINGS,REDIAL_STRESS,COMMAND_DEFS,SLOGANS,OFFICE_PALETTE,OFFICE_STATIONS,ARTIFACT_URL,ARTIFACT_QR,ARTIFACT_QR_QUIET_ZONE,LUCK_RATE,GAME_FLAGS,REFUND_POLICY};';
const D = new Function(src)();
const { CAUSES, TYPES, SCENARIOS, LOOKUPS, QUESTIONS, QUESTION_GROUPS, SOOTHES, SOOTHE_EFFECTS, SMALLTALK_EFFECTS, IDENTITY_CALMING_EFFECTS, APOLOGIES, APOLOGY_REPLIES, FAREWELL_LINES, REDIAL_OPENINGS, REDIAL_STRESS, COMMAND_DEFS, SLOGANS, OFFICE_PALETTE, OFFICE_STATIONS, ARTIFACT_QR, ARTIFACT_QR_QUIET_ZONE, LUCK_RATE, GAME_FLAGS, REFUND_POLICY } = D;

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
};

let ng = 0;
const bad = (m) => { console.log('  NG  ' + m); ng++; };

if (JSON.stringify(SLOGANS) !== JSON.stringify(EXPECTED_SLOGANS)) bad('SLOGANS が確定6文言・順番と一致しない');
if (SLOGANS.some(slogan => !slogan)) bad('SLOGANS に空文字がある');
if (LUCK_RATE !== 0.9) bad('運の本来どおり率が0.9ではない');
if (JSON.stringify(GAME_FLAGS) !== JSON.stringify({luckRate:0.9,shuffleArrival:true})) bad('運の初期GAME_FLAGSが確定値と違う');
if (JSON.stringify(REFUND_POLICY) !== JSON.stringify({
  amount:2400,
  company:{causes:['hardware','provision','logistics','carrier','coverage'],delta:-25,csat:0.4},
  customer:{causes:['fup','devices','heavy','device_side','device_net','power'],delta:15,csat:-0.6},
  neutral:{causes:['location','geo_block','sim'],delta:-5,csat:0},
})) bad('返金の金額・14原因分類・効果が確定値と違う');
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

// 5-2〜5-4: 通話料、折り返し枠、折り返し先の仕様はゲーム本体とは独立して固定する。
const CALLBACK_TO = { S1:'hotel', S2:'mobile', S3:'mobile', S4:'hotel', S5:'hotel', S6:'mobile', S7:'mobile', S8:'hotel', S9:'mobile', S10:'hotel', S11:'mobile' };
SCENARIOS.forEach(s => {
  if (s.callbackTo !== CALLBACK_TO[s.id]) bad(s.id + ': callbackTo が ' + CALLBACK_TO[s.id] + ' のはずが ' + s.callbackTo);
});
const gameSource = readGameSource(__dirname);
const pageSource = fs.readFileSync(__dirname + '/p1_head.html', 'utf8');
if ((gameSource.match(/farewellLine\(/g) || []).length !== 2) bad('別れの言葉が通常解決以外（上長引き取り・放棄呼など）にも追加されている');
if (!/const CALL_RATE_PER_MIN = 180;/.test(gameSource)) bad('国際通話料が1分¥180ではない');
if (!/const CALLBACKS = 4;/.test(fs.readFileSync(__dirname + '/p2_data.js', 'utf8'))) bad('折り返し枠が4回ではない');
if (!/t\.callbackPenalty = t\.callbackDestination === 'hotel' \? 1\.0 : 0\.5;/.test(gameSource)) bad('誤った折り返し先のCSATペナルティが hotel:-1.0 / mobile:-0.5 ではない');
const resumeCallbackStart = gameSource.indexOf('function resumeCallback(');
const resumeCallbackEnd = gameSource.indexOf('\nfunction spendOnCall', resumeCallbackStart);
const resumeCallbackSource = resumeCallbackStart < 0 || resumeCallbackEnd < 0 ? '' : gameSource.slice(resumeCallbackStart, resumeCallbackEnd);
if (!/t\.callbackDestination !== t\.s\.callbackTo[\s\S]*?spendOnCall\(t, 2, 0\);/.test(resumeCallbackSource)) bad('誤った折り返し先の2分の時間ロスがない');

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
if (SCENARIOS.length !== 11 || !SCENARIOS.every(s => Array.isArray(s.smalltalk) && s.smalltalk.length >= 1 && s.smalltalk.every(topic => requiredTopicFields.every(field => typeof topic[field] === 'string' && topic[field].length > 0)))) bad('全11シナリオの雑談話題6項目が揃っていない');
const section13QuestionIds = new Set(QUESTIONS.map(question => question.id));
const universallyReachableQuestions = new Set(['q_name','q_destination','q_contract']);
if (!SCENARIOS.every(scenario => scenario.smalltalk.every(topic => topic.reveal === 'opening' || (section13QuestionIds.has(topic.reveal) && (universallyReachableQuestions.has(topic.reveal) || Boolean((scenario.replies || {})[topic.reveal])))))) bad('雑談話題のrevealが実際に到達できる質問へ接続されていない');
if (!gameSource.includes("const DESTINATION_IN_OPENING = new Set(['S9','S11'])")) bad('第一声で地名を話す案件がS9とS11の2件ではない');

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
