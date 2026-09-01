/* ============================================================
   ゲーム本体
   ============================================================ */

const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
function customerLabel(t, withTicket){
  if (t.nameKnown) return t.s.name;
  return withTicket ? 'お客様（' + t.s.id + '）' : 'お客様';
}
function customerHonorific(t){ return t.nameKnown ? customerLabel(t) + 'さん' : customerLabel(t); }
const CALLBACK_OVERDUE_MIN = 10;
const CALL_RATE_PER_MIN = 180;
const SHIP_LEVELS = [
  { id:'fast', label:'最速便', eta:'現地翌朝08:00まで', fee:18000, rank:3 },
  { id:'next', label:'翌日便', eta:'現地翌日中', fee:9000, rank:2 },
  { id:'normal', label:'通常便', eta:'2〜3日', fee:4000, rank:1 },
];
const SHIPPING_REMEDIES = new Set(['r_hardware_swap','r_escalate_band','r_transfer_logi','r_second_unit']);
const DESTINATION_IN_OPENING = new Set(['S9','S11']);
function callCost(t){ return t.callMinutes * CALL_RATE_PER_MIN; }
function totalCost(){ return state.cost + state.tickets.reduce((n,t) => n + callCost(t), 0); }
function pendingTypedLine(t){ return t.transcript.find(x => (x.who === 'cust' || x.who === 'sys') && !x.typed); }

function defaultUi(tab = 'command'){
  return { tab, cause:null, remedy:null, lookup:null, askGroup:null, boardExcludedOpen:false };
}

const state = {
  phase: 'briefing',
  turn: 0,
  clock: SHIFT_START,
  tickets: [],
  focus: null,          // 表示中のチケット
  escLeft: ESCALATIONS,
  callbacksLeft: CALLBACKS,
  cost: 0,
  outageKnown: false,
  holdVisual: false,
  busy: false,
  mobilePane: 'desk',
  ui: defaultUi(),
  slogan: '',
  report: null,
  random: Math.random,
};

function rollLuck(){
  return state.random() < GAME_FLAGS.luckRate;
}

function shuffleScenarios(scenarios, random){
  const shuffled = scenarios.slice();
  for (let i = shuffled.length - 1; i > 0; i--){
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/* ---------- 時刻 ---------- */

function fmtClock(min){
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
}
function localClock(t){
  return fmtClock(((state.clock + t.s.localOffset * 60) % 1440 + 1440) % 1440);
}

function daylightMix(utcOffset){
  const utc = state.clock - 9 * 60;
  const local = ((utc + utcOffset * 60) % 1440 + 1440) % 1440;
  const hour = local / 60;
  const sun = (hour > 6 && hour < 18) ? Math.sin((hour - 6) / 12 * Math.PI) : 0;
  return Math.round(7 + sun * 61);
}

/* ---------- 初期化 ---------- */

function newTicket(s){
  return {
    s, state:'inbound', patience:100, arrivedTurn:s.arrive,
    facts:[], asked:new Set(), askCounts:new Map(), questionCount:0, lookedUp:new Set(), tested:new Set(), testCounts:new Map(),
    transcript:[], callTranscriptStart:0, greeted:false, identified:false, nameKnown:false, destinationKnown:false,
    stress:TYPES[s.type].stressStart, stressWarned:false, soothed:new Map(), smalltalkCounts:new Map(),
    speechTurns:{ irritated:0, angry:0, furious:0 }, callMinutes:0, holdMinutes:0,
    callbackCount:0, callbackDue:null, callbackLate:false, callbackDestination:null, callbackPenalty:0,
    stayAddress:null, stayDaysKnown:false, replacementConsentKnown:false, shipment:null, apologies:new Map(), refunds:0, refundCsat:0,
    misdiagnoses:0, damage:0, wasted:0, result:null, pendingResult:null, redialOpening:null, redialSpoken:false, escUsed:false,
  };
}

function resetGame(){
  stopOfficeRing();
  state.phase = 'briefing';
  state.turn = 0;
  state.clock = SHIFT_START;
  const arrivalSlots = SCENARIOS.map(s => s.arrive).sort((a, b) => a - b);
  const orderedScenarios = GAME_FLAGS.shuffleArrival
    ? shuffleScenarios(SCENARIOS, state.random)
    : SCENARIOS.slice();
  state.tickets = orderedScenarios.map((scenario, index) =>
    newTicket(Object.assign({}, scenario, { arrive:arrivalSlots[index] }))
  );
  state.focus = null;
  state.escLeft = ESCALATIONS;
  state.callbacksLeft = CALLBACKS;
  state.cost = 0;
  state.outageKnown = false;
  state.holdVisual = false;
  state.busy = false;
  state.mobilePane = 'desk';
  state.ui = defaultUi();
  state.slogan = SLOGANS[Math.floor(state.random() * SLOGANS.length)];
  state.report = null;
}

/* ---------- ターン進行 ---------- */

function activateDueInbound(){
  let activated = 0;
  state.tickets.forEach(t => {
    if (t.state === 'inbound' && t.arrivedTurn <= state.turn){
      t.state = 'waiting';
      activated++;
      toast('着信', '新しい着信です', '');
    }
  });
  return activated;
}

function advance(turns){
  if (turns === 0) activateDueInbound();
  for (let i = 0; i < turns; i++){
    state.turn++;
    state.clock += TURN_MIN;

    // すでに待っている呼だけが、この1分の待ち時間を消費する
    state.tickets.forEach(t => {
      if (t.state === 'waiting') t.patience -= 100 / t.s.abandonAfter;
      else if (t.state === 'callback' && state.clock > t.callbackDue) t.patience -= 100 / CALLBACK_OVERDUE_MIN;

      if (t.patience <= 0 && (t.state === 'waiting' || t.state === 'callback')){
        t.patience = 0;
        t.state = 'closed';
        t.result = { kind:'abandoned', csat:0, label:'放棄呼', firstCallResolved:false };
        toast('放棄呼', '呼び出しに応答できず、切られました', 'crit');
      }
    });

    // この分に到着した呼は、次の1分から待ち時間を消費する
    activateDueInbound();
  }
}

function addFact(t, fact, src){
  t.facts.push({ text:fact.text, src:src, out:fact.out || [], hot:fact.hot || [] });
}

/* ---------- 広域障害の判明（シフトの山場） ---------- */

function triggerOutage(origin){
  if (state.outageKnown) return;
  state.outageKnown = true;
  toast('障害情報', '北東部の広域障害を確認。同一エリアの他チケットにも当てはまります', 'sig');

  state.tickets.forEach(t => {
    if (t === origin) return;
    if (t.s.trueCause !== 'carrier') return;
    if (t.state === 'closed') return;
    t.transcript.push({ who:'sys', text:'[全社通知] 米国北東部 提携キャリアの広域障害を確認。同一エリアからの入電はこの障害による可能性が高い。' });
    addFact(t, { text:'同じエリアで広域障害が確認された', hot:['carrier'], out:['sim','coverage','provision','device_side','device_net'] }, '全社通知');
  });
}

/* ---------- プレイヤーの行動 ---------- */

function pickup(t){
  if (state.focus){ toast('通話中', '通話中です。いまの電話を終えないと次を取れません', 'crit'); return; }
  t.state = 'open';
  t.callTranscriptStart = t.transcript.length;
  deliverCustomerOpening(t, true);
  state.focus = t;
  state.ui = defaultUi();
  enterCall();
}

function greetCurrentCustomer(){
  const t = state.focus;
  if (!t || t.greeted) return;
  t.greeted = true;
  t.transcript.push({ who:'me', text:'お電話ありがとうございます。グローバルデスクでございます' });
  deliverCustomerOpening(t, false);
  render();
}

function resumeCallback(t){
  if (state.focus){ toast('通話中', '通話中です。いまの電話を終えないと次を取れません', 'crit'); return; }
  if (!t || t.state !== 'callback') return;
  t.callbackLate = t.callbackLate || state.clock > t.callbackDue;
  if (t.callbackDestination !== t.s.callbackTo){
    t.callbackPenalty = t.callbackDestination === 'hotel' ? 1.0 : 0.5;
    t.transcript.push({ who:'note', text:t.callbackDestination === 'hotel' ? 'ホテル客室へ折り返しましたが、お客さまは移動中で不在でした。' : '携帯へ折り返したため、お客さま側に国際ローミング通話料が発生しました。' });
    spendOnCall(t, 2, 0);
  }
  t.state = 'open';
  t.callTranscriptStart = t.transcript.length;
  t.transcript.push({ who:'note', text:t.callbackLate ? '約束時刻を過ぎて折り返しました。' : '約束時刻内に折り返し、通話を再開しました。' });
  state.focus = t;
  state.ui = defaultUi();
  enterCall();
}

function spendOnCall(t, minutes, holdMinutes){
  const before = t.callMinutes;
  t.callMinutes += minutes;
  t.holdMinutes += holdMinutes || 0;
  advance(minutes);
  const longMinutes = Math.max(0, t.callMinutes - 10) - Math.max(0, before - 10);
  if (longMinutes && t.state === 'open') addStress(t, longMinutes * 2);
  return t.state === 'open';
}

function addStress(t, base, miss, expectedOutcome){
  const type = TYPES[t.s.type];
  return changeStress(t, base * type.stressRate * (miss ? type.missRate : 1), expectedOutcome);
}
function changeStress(t, delta, expectedOutcome = rollLuck()){
  if (!expectedOutcome) delta = 0;
  t.stress = clamp(t.stress + delta, 0, 100);
  if (t.stress > 80 && !t.stressWarned){
    t.stressWarned = true;
    toast('苛立ち警告', customerHonorific(t) + 'の苛立ちが強まっています', 'crit');
  }
  if (t.stress >= 100 && t.state === 'open'){
    pushCustomerLine(t, TYPES[t.s.type].furious[1], { plain:true });
    closeTicket(t, { kind:'supervisor', reason:'stress', csat:1.5, label:'上長が引き取り' });
    toast('引き取り', customerLabel(t) + 'の苛立ちが限界に達し、上長が引き取りました', 'crit');
  }
  return t.state === 'open';
}
function stressPenalty(v){ return v <= 25 ? 0 : v <= 50 ? .3 : v <= 70 ? .8 : v <= 90 ? 1.5 : 2.2; }

function stressSpeechStage(value){
  if (value <= 50) return null;
  if (value <= 70) return 'irritated';
  if (value <= 90) return 'angry';
  return 'furious';
}

function stressLeadIn(t){
  const stage = stressSpeechStage(t.stress);
  if (!stage) return '';
  const turn = t.speechTurns[stage] || 0;
  t.speechTurns[stage] = turn + 1;
  if (stage === 'irritated' && turn % 2 === 1) return '';
  const lines = TYPES[t.s.type][stage];
  const index = stage === 'irritated' ? Math.floor(turn / 2) : turn;
  return lines[index % lines.length];
}

function pushCustomerLine(t, text, options){
  const lead = options && options.plain ? '' : stressLeadIn(t);
  t.transcript.push({ who:'cust', text:lead ? lead + ' ' + text : text });
}

function customerHasSpoken(t){
  const start = Number.isInteger(t.callTranscriptStart) ? t.callTranscriptStart : 0;
  return t.transcript.slice(start).some(line => line.who === 'cust');
}

function askStressBase(t, base){
  const count = t.questionCount || t.asked.size;
  return base + Math.max(0, count - 1) * 2;
}

function customerSpeaksBeforeGreeting(t){
  return t.s.type === 'hurried';
}

function deliverCustomerOpening(t, beforeGreeting){
  if (t.redialOpening){
    if (!beforeGreeting || customerSpeaksBeforeGreeting(t)){
      pushCustomerLine(t, t.redialOpening, { plain:true });
      t.redialOpening = null;
      t.redialSpoken = beforeGreeting;
    }
    return;
  }
  if (beforeGreeting){
    if (customerSpeaksBeforeGreeting(t)){
      pushCustomerLine(t, t.s.opening);
      t.destinationKnown = DESTINATION_IN_OPENING.has(t.s.id);
    }
    return;
  }
  if (t.redialSpoken){ t.redialSpoken = false; return; }
  if (customerSpeaksBeforeGreeting(t)){
    pushCustomerLine(t, t.s.rushedReply, { plain:true });
    return;
  }
  pushCustomerLine(t, t.s.opening);
  t.destinationKnown = DESTINATION_IN_OPENING.has(t.s.id);
}

function identificationReady(t){
  return t.identified || (t.nameKnown && t.destinationKnown);
}

function identityQuestionStress(t, qid, normalBase){
  if (!['q_name','q_contract'].includes(qid) || t.stress < 50) return addStress(t, normalBase);
  const delta = IDENTITY_CALMING_EFFECTS[t.s.type];
  const expectedOutcome = rollLuck();
  if (delta === 0) return changeStress(t, 0, true);
  return expectedOutcome
    ? changeStress(t, delta, true)
    : addStress(t, normalBase, false, true);
}

function repeatedQuestionReply(t){
  return {
    anxious:'先ほどお答えした内容では足りませんでしたか…？',
    novice:'あら、さっきも同じことをお話ししたと思うのですが。',
    expert:'それは回答済みです。記録を確認してください。',
    hurried:'同じ質問はもう答えました。先に進めてください。',
  }[t.s.type];
}

function topicAvailable(t, topic){
  if (topic.reveal === 'opening') return customerHasSpoken(t);
  return t.asked.has(topic.reveal);
}

function smalltalkResult(t, topic, mode, times){
  const scaled = t.stress >= 40;
  let delta = scaled ? 8 : SMALLTALK_EFFECTS[t.s.type];
  if (times > 0) delta = delta / 2 + 5;
  if (mode === 'ask') delta *= 1.5;
  const reply = scaled
    ? 'あの、それより通信のほうを…'
    : delta < 0 ? topic.goodReply : topic.badReply;
  return flipReaction({ delta, scaled, reply }, topic.goodReply, topic.badReply);
}

function flipReaction(result, goodReply, badReply){
  if (rollLuck()) return result;
  const reversed = {
    delta:result.delta === 0 ? 0 : -result.delta,
    reply:result.delta < 0 ? badReply : goodReply,
  };
  if (typeof result.csat === 'number') reversed.csat = -result.csat;
  return Object.assign({}, result, reversed);
}

function applyReactionStress(t, result){
  return result.scaled
    ? addStress(t, result.delta, false, true)
    : changeStress(t, result.delta, true);
}

function doSmalltalk(topicId, mode){
  const t = state.focus;
  const topic = t && (t.s.smalltalk || []).find(item => item.id === topicId);
  if (!t || !topic || !['ask','tell'].includes(mode) || !topicAvailable(t, topic)) return;
  const times = t.smalltalkCounts.get(topicId) || 0;
  t.smalltalkCounts.set(topicId, times + 1);
  t.transcript.push({ who:'me', text:mode === 'ask' ? topic.askLabel : topic.tellLabel });
  const result = smalltalkResult(t, topic, mode, times);
  pushCustomerLine(t, result.reply);
  if (!applyReactionStress(t, result)) return;
  if (!spendOnCall(t, 1, 0)) return;
  state.ui = defaultUi();
  render();
}

function sootheResult(t, id, times){
  const goodReply = TYPES[t.s.type].sootheReply;
  const badReply = TYPES[t.s.type].sootheMissReply;
  if (t.stress < 40) return flipReaction({ delta:8, scaled:true, reply:badReply }, goodReply, badReply);
  let delta = SOOTHE_EFFECTS[t.s.type][id];
  if (times) return flipReaction({ delta:delta / 2 + 5, scaled:false, reply:TYPES[t.s.type].sootheRepeatReply }, goodReply, badReply);
  return flipReaction({ delta, scaled:false, reply:delta < 0 ? goodReply : badReply }, goodReply, badReply);
}

function doSoothe(id){
  const t = state.focus, s = SOOTHES.find(x => x.id === id); if (!t || !s) return;
  const times = t.soothed.get(id) || 0; t.soothed.set(id, times + 1);
  t.transcript.push({ who:'me', text:s.label });
  const result = sootheResult(t, id, times);
  pushCustomerLine(t, result.reply);
  if (!applyReactionStress(t, result)) return;
  if (!spendOnCall(t, 1, 0)) return;
  state.ui = defaultUi(); render();
}

function doApologize(id){
  const t = state.focus;
  const apology = APOLOGIES.find(item => item.id === id);
  if (!t || !apology) return;
  const previous = t.apologies.get(id) || 0;
  t.apologies.set(id, previous + 1);
  t.transcript.push({ who:'me', text:apology.label });
  let delta = 0;
  const replies = APOLOGY_REPLIES[t.s.type];
  let reply = replies.brief;
  if (apology.kind === 'brief'){
    if (t.stress > 50){ delta = -6; reply = replies.brief; }
  } else if (previous > 0){
    delta = 10;
    reply = replies.repeated;
  } else if (t.stress >= 40){
    delta = -20;
    reply = replies.accepted;
  } else {
    delta = 12;
    reply = replies.excessive;
  }
  const goodReply = replies.accepted;
  const badReply = replies.excessive;
  const result = flipReaction({ delta, scaled:false, reply }, goodReply, badReply);
  pushCustomerLine(t, result.reply);
  if (!applyReactionStress(t, result)) return;
  if (!spendOnCall(t, apology.minutes, 0)) return;
  state.ui = defaultUi(); render();
}

function openRecord(){
  const t = state.focus;
  if (!t) return;
  t.transcript.push({ who:'note', text:'ログを1分かけて確認しました。' });
  if (!addStress(t, 4)) return;
  if (!spendOnCall(t, 1, 0)) return;
  state.ui = defaultUi('record');
  render();
}

function refundEffect(causeId){
  return Object.values(REFUND_POLICY).find(effect => effect && effect.causes && effect.causes.includes(causeId));
}

function refundResult(t, times){
  const effect = refundEffect(t.s.trueCause);
  let delta = effect.delta;
  if (times > 0) delta = delta / 2 + 5;
  const goodReply = '返金していただけるなら助かります。ありがとうございます。';
  const badReply = 'いえ、そういうことでは…。返金より、まず使えるようにしていただけますか。';
  return flipReaction({ delta, scaled:false, csat:times > 0 ? 0 : effect.csat, reply:delta < 0 ? goodReply : badReply }, goodReply, badReply);
}

function doRefund(){
  const t = state.focus;
  if (!t) return;
  const times = t.refunds || 0;
  t.refunds = times + 1;
  t.transcript.push({ who:'me', text:'利用料金の一部を返金する旨をご案内します' });
  const result = refundResult(t, times);
  state.cost += REFUND_POLICY.amount;
  t.refundCsat += result.csat;
  pushCustomerLine(t, result.reply);
  if (!applyReactionStress(t, result)) return;
  if (!spendOnCall(t, 1, 0)) return;
  state.ui = defaultUi();
  render();
}

function doAsk(qid){
  const t = state.focus;
  const q = QUESTIONS.find(x => x.id === qid);
  if (!t || !q) return;
  const previous = t.askCounts.get(qid) || 0;
  t.askCounts.set(qid, previous + 1);
  t.questionCount++;
  t.asked.add(qid);
  t.transcript.push({ who:'me', text:q.label });
  if (previous > 0){
    pushCustomerLine(t, repeatedQuestionReply(t));
    t.wasted++;
    if (!addStress(t, askStressBase(t, 10), true)) return;
    if (!spendOnCall(t, 1, 0)) return;
    state.ui = defaultUi(); render(); return;
  }
  if (qid === 'q_contract'){
    pushCustomerLine(t, t.s.contractId.text);
    t.identified = true; t.nameKnown = true; t.destinationKnown = true;
    if (!identityQuestionStress(t, qid, t.s.contractId.minutes * 3)) return;
    if (!spendOnCall(t, t.s.contractId.minutes, 0)) return;
    state.ui = defaultUi(); render(); return;
  }

  if (qid === 'q_name'){
    pushCustomerLine(t, t.s.name + 'です。');
    t.nameKnown = true;
    if (!identityQuestionStress(t, qid, askStressBase(t, 3))) return;
  } else if (qid === 'q_destination'){
    if (t.destinationKnown){
      pushCustomerLine(t, q.miss); t.wasted++; if (!addStress(t, askStressBase(t, 14), true)) return;
    } else {
      pushCustomerLine(t, t.s.city + 'です。'); t.destinationKnown = true; if (!addStress(t, askStressBase(t, 3))) return;
    }
  } else {
  const r = (t.s.replies || {})[qid];
  if (r){
    pushCustomerLine(t, r.text);
    if (r.fact) addFact(t, r.fact, '聞き取り');
    if (qid === 'q_stay') t.stayAddress = r.text;
    if (qid === 'q_stay_length') t.stayDaysKnown = true;
    if (qid === 'q_replacement') t.replacementConsentKnown = true;
  } else {
    pushCustomerLine(t, q.miss);
    t.wasted++;
  }
    if (!addStress(t, askStressBase(t, r ? 3 : 9), !r)) return;
    if (t.s.techPenalty && !r) t.wasted++;
  }
  t.identified = identificationReady(t);

  if (!spendOnCall(t, 1, 0)) return;
  state.ui = defaultUi();
  render();
}

function doLookup(lid, mode){
  const t = state.focus;
  if (!t || state.busy || !['hold','talk'].includes(mode)) return;
  const l = LOOKUPS.find(x => x.id === lid);
  if (!l || t.lookedUp.has(lid)) return;
  if (!t.identified) return;
  const minutes = mode === 'hold' ? 2 : 3;
  const hold = mode === 'hold' ? 2 : 0;
  if (!addStress(t, mode === 'hold' ? 7 : 3)) return;

  state.busy = true;
  state.holdVisual = mode === 'hold';
  t.transcript.push({ who:'note', text:mode === 'hold' ? 'お客さまを保留にして社内照会を始めました。' : 'お客さまと話しながら社内照会を始めました。' });
  render();

  setTimeout(() => finishLookup(t, l, minutes, hold), mode === 'hold' ? 420 : 0);
}

function finishLookup(t, l, minutes, hold){
  if (state.focus !== t || t.state !== 'open'){
    state.busy = false;
    state.holdVisual = false;
    return;
  }
  const lid = l.id;
  t.lookedUp.add(lid);

  const r = (t.s.lookups || {})[lid];
  if (r){
    t.transcript.push({ who:'sys', text:r.text, viz:r.viz || null });
    if (r.fact) addFact(t, r.fact, '社内照会');
    if (r.outage) triggerOutage(t);
  } else {
    t.transcript.push({ who:'sys', text:l.miss });
    if (l.missFact) addFact(t, l.missFact, '社内照会');
    else t.wasted++;
  }

  if (!spendOnCall(t, minutes, hold)) return;
  state.busy = false;
  state.holdVisual = false;
  state.ui = defaultUi();
  render();
}

function doTest(tid){
  const t = state.focus;
  const risky = RISKY.find(x => x.id === tid);
  const test = risky || TESTS.find(x => x.id === tid);
  if (!t || !test) return;
  const previous = t.testCounts.get(tid) || 0;
  const attempt = previous + 1;
  t.testCounts.set(tid, attempt);
  t.tested.add(tid);
  t.transcript.push({ who:'me', text:test.label });
  t.transcript.push({ who:'note', text:test.wait + '（所要' + test.turns + '分。通話はつないだままです）' });
  if (!addStress(t, (risky ? 25 : test.turns * 3) + previous * 4)) return;

  const testDef = risky ? null : (t.s.tests || {})[tid];
  const sequence = testDef && testDef.sequence;
  const def = sequence ? sequence[Math.min(previous, sequence.length - 1)] : testDef;
  const redundant = previous > 0 && (!sequence || previous >= sequence.length);
  if (!spendOnCall(t, test.turns, 0)) return;

  if (risky){
    pushCustomerLine(t, risky.result);
    t.transcript.push({ who:'note', text:'【まずい対応】' + risky.note });
    t.damage += risky.damage;
    toast('悪化', customerLabel(t) + 'の状況が悪くなりました', 'crit');
  } else if (def && !redundant){
    pushCustomerLine(t, def.text);
    if (def.fact) addFact(t, def.fact, '操作の結果');
    if (def.solves) t.transcript.push({ who:'note', text:'この操作で症状が解消しました。原因を確定して案内できます。' });
    toast('結果', customerLabel(t) + 'の操作が終わりました', 'sig');
  } else {
    pushCustomerLine(t, previous > 0 ? '同じ操作はもう行いました。もう一度やっても変わりません。' : 'やってみましたが、変わりませんでした。');
    t.wasted++;
  }
  state.ui = defaultUi();
  render();
}

function startCallback(destination){
  const t = state.focus;
  if (!t || !['hotel','mobile'].includes(destination)) return;
  if (destination === 'hotel' && !t.asked.has('q_stay')){
    state.ui = defaultUi('ask');
    toast('折り返し先未確認', '滞在先が未確認です。ホテルへは折り返せません', 'crit');
    render(); return;
  }
  t.transcript.push({ who:'me', text:'一度お切りして、調べてから折り返します。30分以内にご連絡します。' });
  t.callbackCount++;
  t.callbackDestination = destination;
  state.callbacksLeft--;
  if (!spendOnCall(t, 1, 0)) return;
  t.callbackDue = state.clock + 30;
  t.state = 'callback';
  state.focus = null;
  state.ui = defaultUi();
  toast('折り返し', customerLabel(t) + 'へ' + (destination === 'hotel' ? 'ホテル客室' : '携帯') + 'に折り返す約束をしました', 'sig');
  enterOffice();
}

/* ---------- TGX 国際配送 ---------- */

function shipLevel(id){ return SHIP_LEVELS.find(x => x.id === id); }
function remedyNeedsShipping(id){ return SHIPPING_REMEDIES.has(id); }
function remedyBlockReason(t, remedy){
  if (remedy.kind === 'escalate' && state.escLeft <= 0) return 'エスカレーション枠を使い切っています';
  if (remedy.needsOutage && !state.outageKnown) return '障害の裏付けが取れていないため、この案内はできません';
  if (remedy.needsTest){
    const required = remedy.needsTestCount || 1;
    const count = t.testCounts.get(remedy.needsTest) || 0;
    if (count < required) return '先に「操作」を ' + required + '回行ってください（現在 ' + count + '回）';
  }
  const missing = (remedy.requiresQuestions || []).filter(id => !t.asked.has(id));
  if (missing.length) return '配送判断に必要な聞き取りが不足しています';
  if (remedy.requiresLongStay && (!t.stayDaysKnown || t.s.stayDays < remedy.requiresLongStay)) return '残り滞在期間が短く、到着後に使える期間が足りません';
  if (remedy.requiresConsent && (!t.replacementConsentKnown || !t.s.wantsReplacement)) return 'お客様の代替機配送希望を確認できていません';
  return '';
}

function chooseRemedy(remedyId){
  const t = state.focus;
  const remedy = (REMEDIES[state.ui.cause] || []).find(item => item.id === remedyId);
  const blocked = remedy && remedyBlockReason(t, remedy);
  if (blocked){ toast('対処の前提不足', blocked, 'crit'); render(); return; }
  state.ui.remedy = remedyId;
  if (remedyNeedsShipping(remedyId)) startShipping(remedyId);
  else render();
}

function startShipping(remedyId){
  const t = state.focus;
  if (!t) return;
  if (t.shipment && t.shipment.remedyId === remedyId){
    state.ui.shipping = null;
    render();
    return;
  }
  if (!t.stayAddress){
    t.transcript.push({ who:'note', text:'配送先が未確認です。手配を中断して滞在先を確認します。' });
    if (!spendOnCall(t, 2, 0)) return;
    state.ui = defaultUi('ask');
    toast('TGX手配中断', '配送先が未確認です', 'crit');
    render();
    return;
  }
  state.ui.shipping = { remedyId, level:null };
  render();
}

function shipmentEta(t, level){
  const local = state.clock + t.s.localOffset * 60;
  const day = Math.floor(local / 1440) * 1440;
  if (level.id === 'fast'){
    let eta = day + 8 * 60;
    if (eta <= local) eta += 1440;
    return eta;
  }
  if (level.id === 'next') return day + 1440 + 18 * 60;
  return local + 60 * 60;
}

function shipmentAwb(t){
  return 'TGX-' + String(Number(t.s.id.slice(1))).padStart(4,'0') + '-' + String(state.clock % 10000).padStart(4,'0');
}

function chooseShipLevel(id){
  const level = shipLevel(id);
  if (!state.ui.shipping || !level) return;
  state.ui.shipping.level = id;
  render();
}

function confirmShipment(){
  const t = state.focus;
  const ship = state.ui.shipping;
  const level = ship && shipLevel(ship.level);
  if (!t || !ship || !level) return;
  const need = shipLevel(t.s.shipNeed);
  const eta = shipmentEta(t, level);
  t.shipment = { remedyId:ship.remedyId, level:level.id, label:level.label, fee:level.fee, awb:shipmentAwb(t), eta, tooSlow:need ? level.rank < need.rank : false };
  state.cost += level.fee;
  t.transcript.push({ who:'me', text:'TGX の追跡番号 ' + t.shipment.awb + ' で手配しました。現地時間の' + fmtClock(eta) + 'までにホテルへお届けします。' });
  state.ui.shipping = null;
  toast('TGX手配', customerLabel(t) + '宛てに' + level.label + 'を確定しました', 'sig');
  render();
}

/* ---------- クローズ判定 ---------- */

function toneLabel(id){ const x = TONES.find(t => t.id === id); return x ? x.name : id; }

function doClose(causeId, remedyId, toneId){
  const t = state.focus;
  const s = t.s;
  const remedy = (REMEDIES[causeId] || []).find(r => r.id === remedyId);
  if (!remedy) return;
  const blocked = remedyBlockReason(t, remedy);
  if (blocked){ toast('対処の前提不足', blocked, 'crit'); render(); return; }

  t.transcript.push({ who:'me', text:'【' + toneLabel(toneId) + '】' + remedy.label });
  if (!spendOnCall(t, 2, 0)) return;

  const causeMatched = causeId === s.trueCause;
  const treatmentWorked = treatmentSucceeds(causeMatched);
  // 見立て違いのやり直し時間は選択内容で決まり、抽選結果では揺らさない。
  if (!causeMatched) advance(2);

  // ---- 対処後も解決しない ----
  if (!treatmentWorked){
    if (!causeMatched){
      t.misdiagnoses++;
    }
    if (remedy.cost) state.cost += remedy.cost;
    if (remedy.kind === 'escalate'){ state.escLeft--; t.escUsed = true; }

    if (!causeMatched && t.misdiagnoses >= 2){
      pushCustomerLine(t, '…もういいです。上の方に代わってもらえますか。');
      t.transcript.push({ who:'note', text:'上長が引き取り、正しい原因（' + causeName(s.trueCause) + '）で対応を引き継ぎました。' });
      closeTicket(t, { kind:'supervisor', reason:'misdiagnosis', csat:1.5, label:'上長が引き取り' });
      toast('引き取り', customerLabel(t) + 'の対応を上長が引き取りました', 'crit');
    } else {
      pushCustomerLine(t, causeMatched ? '試してみましたが、変わりません…。まだ繋がらないです。' : '言われたとおりにしましたが、やっぱり直りません。まだ繋がらないんですけど。');
      if (!causeMatched) t.transcript.push({ who:'note', text:'原因の見立てが外れていました。もう一度切り分けをやり直せます。' });
      if (!addStress(t, 30)){ render(); return; }
      t.patience -= 20;
      t.state = 'open';
      state.ui = defaultUi();
      toast('再入電', customerLabel(t) + 'の症状が解消していません', 'crit');
    }
    render();
    return;
  }

  // ---- 解決する ----
  if (remedy.cost) state.cost += remedy.cost;
  if (remedy.kind === 'escalate'){ state.escLeft--; t.escUsed = true; }

  let bestId = s.best;
  if (s.bestNoOutage && !state.outageKnown) bestId = s.bestNoOutage;

  let base, grade;
  if (!causeMatched){ base = 5.0; grade = 'best'; }
  else if (remedyId === bestId){ base = 5.0; grade = 'best'; }
  else if ((s.partial || []).includes(remedyId)){ base = 3.5; grade = 'partial'; }
  else { base = 2.2; grade = 'poor'; }

  const wantTone = TYPES[s.type].tone;
  const toneOk = (toneId === wantTone);
  if (!toneOk) base -= 1.0;

  base -= t.damage;
  base -= t.misdiagnoses * 1.2;
  base -= Math.min(0.6, t.wasted * 0.1);
  base -= patiencePenalty(t.patience);
  base -= holdPenalty(t.holdMinutes);
  base -= stressPenalty(t.stress);
  if (t.callbackCount > 0) base -= t.callbackLate ? 1.5 : 0.2;
  base -= t.callbackPenalty || 0;
  base += t.refundCsat || 0;
  if (t.shipment && t.shipment.remedyId === remedyId && t.shipment.tooSlow) base -= 1.0;

  const csat = clamp(Math.round(base * 10) / 10, 1.0, 5.0);

  const result = { kind:'closed', csat, grade, toneOk, remedyId, causeId, toneId,
    causeMatched, firstCallResolved:grade === 'best' && t.callbackCount === 0 && t.misdiagnoses === 0, label:gradeLabel(grade) };
  const resolutionReply = causeMatched
    ? closingLine(s, grade, toneOk)
    : 'あ、繋がりました。これで使えそうです。';
  pushCustomerLine(t, resolutionReply, { plain:true });
  pushCustomerLine(t, farewellLine(s, grade), { plain:true });
  t.pendingResult = result;
  state.ui = defaultUi();
  toast('対応完了', customerLabel(t) + ' ／ 電話を切って終話してください', csat >= 4 ? 'good' : (csat >= 3 ? '' : 'crit'));
  render();
}

function treatmentSucceeds(causeMatched){
  return rollLuck() ? causeMatched : !causeMatched;
}

function holdPenalty(minutes){
  if (minutes <= 0) return 0;
  if (minutes <= 4) return 0.2;
  if (minutes <= 8) return 0.5;
  return 1.0;
}

function patiencePenalty(p){
  if (p >= 80) return 0;
  if (p >= 60) return 0.3;
  if (p >= 40) return 0.7;
  if (p >= 20) return 1.2;
  return 1.8;
}

function gradeLabel(g){
  return g === 'best' ? '解決' : (g === 'partial' ? '暫定対応' : '不適切な対処');
}

function closingLine(s, grade, toneOk){
  if (grade === 'best'){
    if (!toneOk){
      const t = TYPES[s.type].tone;
      if (t === 'warm')      return s.type === 'anxious' ? '戻った…よかった。でも説明が難しくて、途中で本当に怖かったです。' : '直りました。でも次は、押す所を一つずつ教えてくださいね。';
      if (t === 'technical') return '復旧は確認しました。ただ、説明の粒度は次回見直してください。';
      return '直った。ありがとう。でも説明は半分でよかった。急ぎます。';
    }
    return {
      anxious:'繋がった…！ よかった、もう駄目かと思いました…。最後までいてくださって、本当にありがとうございます。',
      novice:'まあ、直りました！ 私にもできたんですね。ゆっくり一つずつ、本当にありがとうございました。',
      expert:'復旧を確認しました。仮説と検証の順序も妥当です。ありがとうございます。',
      hurried:'繋がった。間に合う。ありがとう、切ります。',
    }[s.type];
  }
  if (grade === 'partial') return s.type === 'expert' ? '暫定策としては理解しました。恒久対応は記録してください。' : (s.type === 'hurried' ? '一旦それで行く。続きは後で。' : '…分かりました。まだ心配ですが、その方法で様子を見ます。');
  return s.type === 'expert' ? 'その対処は原因仮説と整合しません。実施は保留します。' : (s.type === 'hurried' ? 'それで直る根拠は？ 時間がない。' : 'それ、本当に大丈夫ですか…？ 怖いですが、言われたとおりにします。');
}

function farewellLine(s, grade){
  return grade === 'best' ? FAREWELL_LINES.best[s.type] : FAREWELL_LINES[grade];
}

function finishResolvedCall(t){
  if (!t || !t.pendingResult) return;
  const result = t.pendingResult;
  t.pendingResult = null;
  closeTicket(t, result);
  toast('クローズ', customerLabel(t) + ' ／ CSAT ' + result.csat.toFixed(1), result.csat >= 4 ? 'good' : (result.csat >= 3 ? '' : 'crit'));
  render();
}

function redialOpening(t){
  return (t.s.type === 'anxious' || t.s.type === 'novice') ? REDIAL_OPENINGS.calm : REDIAL_OPENINGS.direct;
}

function interruptCall(t){
  if (!t || t.state !== 'open' || t.pendingResult) return;
  t.transcript.push({ who:'note', text:'対応途中で通話を終了しました。' });
  if (!addStress(t, REDIAL_STRESS)){ render(); return; }
  t.state = 'waiting';
  t.arrivedTurn = state.turn;
  t.greeted = false;
  t.redialOpening = redialOpening(t);
  t.redialSpoken = false;
  state.focus = null;
  state.ui = defaultUi();
  toast('再着信', customerLabel(t, true) + 'から再着信しています', 'crit');
  enterOffice();
}

function closeTicket(t, result){
  t.state = 'closed';
  t.result = result;
  if (state.focus === t) state.focus = null;
  state.ui = defaultUi();
  checkShiftEnd();
  if (state.phase === 'office') return;
}

function causeName(id){
  const c = CAUSES.find(x => x.id === id);
  return c ? c.label : id;
}

function checkShiftEnd(){
  const live = state.tickets.some(t => t.state !== 'closed');
  if (!live){ state.phase = 'report'; renderReport(); }
  else { enterOffice(); }
}

function nextInboundDelta(tickets, turn){
  const future = tickets.filter(t => t.state === 'inbound').map(t => t.arrivedTurn);
  if (!future.length) return null;
  return Math.max(0, Math.min(...future) - turn);
}

function advanceIdleOffice(){
  if (state.focus) return 0;
  activateDueInbound();
  const actionable = state.tickets.some(t => t.state === 'waiting' || t.state === 'callback');
  if (actionable) return 0;
  const delta = nextInboundDelta(state.tickets, state.turn);
  if (delta && delta > 0) advance(delta);
  return delta || 0;
}
