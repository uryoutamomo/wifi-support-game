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
const CALL_CHARGE_CONCERN_MIN = 5;
const CALL_CHARGE_CONCERN_MAX = 10;
const SHIP_LEVELS = [
  { id:'fast', label:'最速便', eta:'現地翌朝08:00まで', fee:18000, rank:3 },
  { id:'next', label:'翌日便', eta:'現地翌日中', fee:9000, rank:2 },
  { id:'normal', label:'通常便', eta:'2〜3日', fee:4000, rank:1 },
];
const SHIPPING_REMEDIES = new Set(['r_hardware_swap','r_coverage_replacement','r_transfer_logi','r_second_unit','r_logistics_replacement']);
const DESTINATION_IN_OPENING = new Set(['S9','S11']);
function callCost(t){ return (t.outboundMinutes || 0) * CALL_RATE_PER_MIN; }
function customerCallCost(t){ return (t.inboundMinutes || 0) * CALL_RATE_PER_MIN; }
function totalCost(){ return state.cost + state.tickets.reduce((n,t) => n + callCost(t), 0); }
function pendingTypedLine(t){ return t.transcript.find(x => (x.who === 'cust' || x.who === 'front' || x.who === 'sys') && !x.typed); }

function ticketLocalMinute(t){
  const utc = state.clock - 9 * 60;
  return ((utc + t.s.localOffset * 60) % 1440 + 1440) % 1440;
}
function isLateLocalTime(t){
  const minute = ticketLocalMinute(t);
  return minute >= 22 * 60 || minute < 6 * 60;
}

function hotelRoom(t){
  const match = String(t.stayAddress || '').match(/(?:room\s*)?(\d{3,4})(?:号室)?/i);
  return match ? match[1] : null;
}

function hotelContactKnown(t){
  return Boolean(t && t.asked && t.asked.has('q_stay') && t.stayAddress && t.stayHotelName);
}

function defaultUi(tab = 'command'){
  return { tab, cause:null, remedy:null, lookup:null, askGroup:null };
}

const state = {
  phase: 'briefing',
  turn: 0,
  clock: SHIFT_START,
  tickets: [],
  focus: null,          // 表示中のチケット
  escLeft: ESCALATIONS,
  cost: 0,
  outageKnown: false,
  outageRegion: null,
  holdVisual: false,
  busy: false,
  ui: defaultUi(),
  desk: null,           // 折り返し待ちのあいだ、デスク端末で調べている案件
  slogan: '',
  report: null,
  career: null,
  careerUpdate: null,
  endingReplay: false,
  endingReturnPhase: 'briefing',
  officeEvents: [],
  handoverMeetingComplete: false,
  deviceVerificationMinutes: 0,
  verifiedDevices: 0,
  deviceVerificationFeedback: '',
  random: Math.random,
};

function rollLuck(){
  return state.random() < GAME_FLAGS.luckRate;
}

function callChargeConcernThreshold(random = state.random){
  return CALL_CHARGE_CONCERN_MIN + Math.floor(random() * (CALL_CHARGE_CONCERN_MAX - CALL_CHARGE_CONCERN_MIN + 1));
}

function shuffleScenarios(scenarios, random){
  const shuffled = scenarios.slice();
  for (let i = shuffled.length - 1; i > 0; i--){
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function dailyTicketCount(random, flags = GAME_FLAGS){
  if (flags.dailyTickets !== null){
    if (!Number.isInteger(flags.dailyTickets) || flags.dailyTickets < 2 || flags.dailyTickets > 5){
      throw new Error('dailyTickets は null または2〜5の整数で指定してください');
    }
    return flags.dailyTickets;
  }
  const roll = random();
  if (roll < 0.2) return 2;
  if (roll < 0.8) return 3;
  if (roll < 0.9) return 4;
  return 5;
}

function handoverTicketCount(random, flags = GAME_FLAGS){
  if (flags.handoverTickets !== null && flags.handoverTickets !== undefined){
    if (!Number.isInteger(flags.handoverTickets) || flags.handoverTickets < 0 || flags.handoverTickets > 2){
      throw new Error('handoverTickets は null または0〜2の整数で指定してください');
    }
    return flags.handoverTickets;
  }
  const roll = random();
  if (roll < HANDOVER_ZERO_RATE) return 0;
  if (roll < HANDOVER_ZERO_RATE + HANDOVER_ONE_RATE) return 1;
  return 2;
}

function scenarioLocalMinute(scenario, place){
  const absolute = SHIFT_START + scenario.arrive + place.localOffset * 60;
  return ((absolute % 1440) + 1440) % 1440;
}

function placeAllowedForScenario(scenario, place){
  const constraint = PLACE_CONSTRAINTS[scenario.trueCause];
  if (constraint === 'china_only') return place.cityEn === 'SHANGHAI';
  if (constraint === 'deep_night'){
    const minute = scenarioLocalMinute(scenario, place);
    return minute >= 22 * 60 || minute < 4 * 60;
  }
  return true;
}

function scenarioNeedsSharedRegion(scenario){
  return ['carrier'].includes(scenario.trueCause);
}

function assignScenarioPlaces(scenarios, random){
  const shuffledPlaces = shuffleScenarios(PLACE_POOL, random);
  const carrierCount = scenarios.filter(scenarioNeedsSharedRegion).length;
  const candidatesFor = scenario => shuffledPlaces.filter(place => {
    if (!placeAllowedForScenario(scenario, place)) return false;
    if (!scenarioNeedsSharedRegion(scenario) || carrierCount < 2) return true;
    return place.regionGroup && shuffledPlaces.filter(item => item.regionGroup === place.regionGroup).length >= carrierCount;
  });
  const ordered = scenarios.slice().sort((a,b) => candidatesFor(a).length - candidatesFor(b).length);
  const assigned = new Map();
  const used = new Set();
  const visit = index => {
    if (index === ordered.length) return true;
    const scenario = ordered[index];
    const sharedCarrierRegion = [...assigned.entries()].find(([id]) => {
      const other = scenarios.find(item => item.id === id);
      return other && scenarioNeedsSharedRegion(other);
    });
    for (const place of candidatesFor(scenario)){
      if (used.has(place.sourceScenarioId)) continue;
      if (scenarioNeedsSharedRegion(scenario) && carrierCount >= 2 && sharedCarrierRegion && place.regionGroup !== sharedCarrierRegion[1].regionGroup) continue;
      assigned.set(scenario.id, place);
      used.add(place.sourceScenarioId);
      if (visit(index + 1)) return true;
      assigned.delete(scenario.id);
      used.delete(place.sourceScenarioId);
    }
    return false;
  };
  if (!visit(0)) throw new Error('土地の割り当て条件を満たせません');
  return assigned;
}

function replaceScenarioTemplates(value, replacements){
  if (typeof value === 'string') return value.replace(/\{(city|country|carrier|region|wrongCountry|spouse|hotel|alternateHotel)\}/g, (_, key) => replacements[key]);
  if (Array.isArray(value)) return value.map(item => replaceScenarioTemplates(item, replacements));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key,item]) => [key,replaceScenarioTemplates(item,replacements)]));
}

function scenarioWithIdentityAndPlace(scenario, identity, place, wrongCountry){
  const replacements = {
    city:place.city,
    country:place.country,
    carrier:place.carrier,
    region:place.regionName,
    wrongCountry,
    hotel:place.hotelName,
    alternateHotel:place.alternateHotelName,
    /* §47: 配偶者の呼び方は客の性別で決まる。女性客なら「夫」、男性客なら「妻」。 */
    spouse:identity.gender === 'female' ? '夫' : '妻',
  };
  const assigned = replaceScenarioTemplates(scenario, replacements);
  return Object.assign(assigned, identity, {
    country:place.country,
    city:place.city,
    cityEn:place.cityEn,
    localOffset:place.localOffset,
    carrierName:place.carrier,
    regionGroup:place.regionGroup,
    regionName:place.regionName,
    hotelName:place.hotelName,
    alternateHotelName:place.alternateHotelName,
    placeSourceScenarioId:place.sourceScenarioId,
    wrongCountry,
  });
}

/* §47: 名前は案件の並べ替えではなく、性別つきの候補48名から引く。
   性別を先に決め、その性別の候補のうち案件の年齢の幅と重なるものだけを対象にする。
   年齢は「案件の幅」と「名前の幅」が重なった範囲から引くので、71歳の「結衣」も
   24歳の「和子」も出ない。同じシフトで同じ名前は二度出ない。 */
function drawScenarioIdentities(scenarios, random){
  const usedNames = new Set();
  return scenarios.map(scenario => {
    const range = scenario.ageRange;
    const candidatesFor = want => NAME_POOL.filter(entry =>
      entry.gender === want && !usedNames.has(entry.name) &&
      entry.ageBand[0] <= range[1] && range[0] <= entry.ageBand[1]);
    const wanted = random() < 0.5 ? 'female' : 'male';
    /* その性別の候補が尽きたら、もう一方の性別から引く。台詞は {spouse} で追随する。 */
    const candidates = candidatesFor(wanted).length ? candidatesFor(wanted) : candidatesFor(wanted === 'female' ? 'male' : 'female');
    if (!candidates.length) throw new Error('名前の候補がありません: ' + scenario.id);
    const entry = candidates[Math.floor(random() * candidates.length)];
    usedNames.add(entry.name);
    const low = Math.max(range[0], entry.ageBand[0]);
    const high = Math.min(range[1], entry.ageBand[1]);
    return { name:entry.name, nameEn:entry.nameEn, age:low + Math.floor(random() * (high - low + 1)), gender:entry.gender };
  });
}

function assignScenarioIdentities(scenarios, random, flags = GAME_FLAGS){
  const identities = flags.shuffleIdentity ? drawScenarioIdentities(scenarios, random) : scenarios.map(scenario => ({name:scenario.name,nameEn:scenario.nameEn,age:scenario.age,gender:scenario.gender}));
  const assignedPlaces = flags.shuffleIdentity ? assignScenarioPlaces(scenarios, random) : new Map(scenarios.map(scenario => {
    const place = PLACE_POOL.find(item => item.sourceScenarioId === scenario.id);
    return [scenario.id, place];
  }));
  const wrongCountryOrder = shuffleScenarios(PLACE_POOL, random);
  return scenarios.map((scenario,index) => {
    const place = assignedPlaces.get(scenario.id);
    const wrongPlace = wrongCountryOrder.find(item => item.country !== place.country);
    return scenarioWithIdentityAndPlace(scenario, identities[index], place, wrongPlace.country);
  });
}

function prepareDailyScenarios(scenarios, random, flags = GAME_FLAGS){
  const count = dailyTicketCount(random, flags);
  const ordered = flags.shuffleArrival ? shuffleScenarios(scenarios, random) : scenarios.slice();
  const arrivalSlots = drawInboundArrivalTurns(count, random);
  const selected = ordered.slice(0, count).map((scenario, index) =>
    Object.assign({}, scenario, { arrive:arrivalSlots[index] })
  );
  return assignScenarioIdentities(selected, random, flags);
}

function drawHandoverCallbackTurns(count, inboundTurns, random){
  const candidates = [];
  for (let minute = 30; minute <= LAST_INBOUND_TURN; minute += 30){
    if (inboundTurns.every(turn => Math.abs(turn - minute) >= MIN_INBOUND_GAP)) candidates.push(minute);
  }
  const selected = shuffleScenarios(candidates, random).slice(0, count).sort((a,b) => a - b);
  if (selected.length !== count || selected.slice(1).some((turn,index) => turn - selected[index] < MIN_INBOUND_GAP)){
    throw new Error('引き継ぎの折り返し時刻を安全に割り当てられません');
  }
  return selected;
}

function prepareShiftScenarios(scenarios, random, flags = GAME_FLAGS){
  const inboundCount = dailyTicketCount(random, flags);
  const handoverCount = handoverTicketCount(random, flags);
  const total = inboundCount + handoverCount;
  const ordered = flags.shuffleArrival ? shuffleScenarios(scenarios, random) : scenarios.slice();
  const arrivalSlots = drawInboundArrivalTurns(inboundCount, random);
  const callbackTurns = drawHandoverCallbackTurns(handoverCount, arrivalSlots, random);
  const timed = ordered.slice(0, total).map((scenario,index) => index < inboundCount
    ? Object.assign({}, scenario, { workOrigin:'inbound', arrive:arrivalSlots[index] })
    : Object.assign({}, scenario, { workOrigin:'handover', arrive:callbackTurns[index - inboundCount], handoverCallbackTurn:callbackTurns[index - inboundCount] })
  );
  return assignScenarioIdentities(timed, random, flags);
}

/* §52: 圧縮した乱数を並べてから最小間隔を足す。これなら最後は06:00まで、
   各着信は20分以上離れ、案件定義の arrive には依存しない。 */
function drawInboundArrivalTurns(count, random){
  const freeMinutes = LAST_INBOUND_TURN - (count - 1) * MIN_INBOUND_GAP;
  const compressed = Array.from({ length:count }, () => Math.floor(random() * (freeMinutes + 1))).sort((a,b) => a - b);
  return compressed.map((minute,index) => minute + index * MIN_INBOUND_GAP);
}

/* ---------- キャリア記録 ---------- */

function freshCareerRecord(){
  return {
    version:CAREER_VERSION,
    shifts:[],
    stage:'probation',
    badges:[],
    solvedScenarios:[],
    ending:false,
    secretEnding:false,
    finalEnding:false,
    totals:{ days:0, averageCsat:0, complaints:0 },
  };
}

function normalizeCareerRecord(value){
  if (!value || typeof value !== 'object') return value;
  const next = JSON.parse(JSON.stringify(value));
  // v1公開済み記録には後から追加された項目がないため、その場合だけ安全な初期値を補う。
  if (next.version === CAREER_VERSION && next.solvedScenarios === undefined) next.solvedScenarios = [];
  if (next.version === CAREER_VERSION && next.secretEnding === undefined) next.secretEnding = false;
  if (next.version === CAREER_VERSION && next.finalEnding === undefined) next.finalEnding = false;
  return next;
}

function validCareerRecord(value){
  if (!value || value.version !== CAREER_VERSION || !Array.isArray(value.shifts)) return false;
  if (!Object.prototype.hasOwnProperty.call(CAREER_STAGES, value.stage) || !Array.isArray(value.badges) || !Array.isArray(value.solvedScenarios) || typeof value.ending !== 'boolean' || typeof value.secretEnding !== 'boolean' || typeof value.finalEnding !== 'boolean') return false;
  if (!value.totals || !Number.isInteger(value.totals.days) || value.totals.days < 0 || !Number.isFinite(value.totals.averageCsat) || !Number.isInteger(value.totals.complaints) || value.totals.complaints < 0) return false;
  const badgeIds = new Set(CAREER_BADGES.map(badge => badge.id));
  const scenarioIds = new Set(SCENARIOS.map(scenario => scenario.id));
  if (value.badges.some(id => !badgeIds.has(id)) || new Set(value.badges).size !== value.badges.length) return false;
  if (value.solvedScenarios.some(id => !scenarioIds.has(id)) || new Set(value.solvedScenarios).size !== value.solvedScenarios.length) return false;
  return value.shifts.every(shift => shift && typeof shift.endedAt === 'string' && !Number.isNaN(Date.parse(shift.endedAt)) &&
    Number.isInteger(shift.tickets) && shift.tickets >= 2 && shift.tickets <= 7 && /^[SABCDE]$/.test(shift.grade) &&
    shift.scores && ['csat','fcr','answer','cost','report'].every(key => Number.isFinite(shift.scores[key])) &&
    Number.isInteger(shift.complaints) && shift.complaints >= 0);
}

function careerWithFlags(record, flags = GAME_FLAGS){
  const next = JSON.parse(JSON.stringify(record));
  if (flags.careerStage !== null && Object.prototype.hasOwnProperty.call(CAREER_STAGES, flags.careerStage)) next.stage = flags.careerStage;
  if (Array.isArray(flags.unlockedBadges)){
    const known = new Set(CAREER_BADGES.map(badge => badge.id));
    next.badges = [...new Set(flags.unlockedBadges.filter(id => known.has(id)))];
  }
  if (Array.isArray(flags.solvedScenarios)){
    const known = new Set(SCENARIOS.map(scenario => scenario.id));
    next.solvedScenarios = [...new Set(flags.solvedScenarios.filter(id => known.has(id)))];
  }
  return next;
}

function solvedScenarioIdsFromTickets(tickets){
  return [...new Set(tickets.filter(ticket => {
    const result = ticket && ticket.result;
    return result && result.kind === 'closed';
  }).map(ticket => ticket.s.id))];
}

function careerEndingQueue(career){
  const queue = [];
  if (career.stage === 'lead' && career.badges.length === CAREER_BADGES.length && !career.finalEnding) queue.push('career');
  return queue;
}

function gradeAtLeast(grade, minimum){
  const order = { E:0, D:1, C:2, B:3, A:4, S:5 };
  return Object.prototype.hasOwnProperty.call(order, grade) && order[grade] >= order[minimum];
}

function promotedCareerStage(stage, totalDays, recentShifts){
  const recent3 = recentShifts.slice(-3);
  if (stage === 'probation' && totalDays >= 3 && recent3.length === 3 && recent3.every(shift => gradeAtLeast(shift.grade, 'C'))) return 'employed';
  if (stage === 'employed' && totalDays >= 6 && recent3.length === 3 && recent3.every(shift => gradeAtLeast(shift.grade, 'B'))) return 'lead';
  return stage;
}

function earnedBadgeIds(career, shift, context){
  const resultKinds = context.resultKinds || [];
  const candidates = [];
  if ((context.maxStresses || []).length === shift.tickets && context.maxStresses.every(value => value <= 70)) candidates.push('quiet_night');
  if (context.redials === 0 && context.abandoned === 0) candidates.push('no_redial');
  if (context.noRefundsOrShipments) candidates.push('frugal');
  if (context.allResolved) candidates.push('all_first');
  if (resultKinds.includes('complaint') && resultKinds.includes('hangup')) candidates.push('storm');
  if (context.anyRefunded) candidates.push('money_talks');
  if (career.totals.days >= 5) candidates.push('ten_nights');
  if (career.shifts.length >= 2 && career.shifts.slice(-2).every(item => item.complaints === 0)) candidates.push('clean_record');
  return candidates;
}

function appendCareerShift(record, shift, context){
  const career = JSON.parse(JSON.stringify(record));
  const previousStage = career.stage;
  career.shifts.push(shift);
  if (career.shifts.length > 30) career.shifts = career.shifts.slice(-30);
  const previousDays = career.totals.days;
  career.totals.days = previousDays + 1;
  career.totals.averageCsat = (career.totals.averageCsat * previousDays + shift.scores.csat) / career.totals.days;
  career.totals.complaints += shift.complaints;
  career.stage = promotedCareerStage(career.stage, career.totals.days, career.shifts);
  const earned = earnedBadgeIds(career, shift, context);
  const newBadges = earned.filter(id => !career.badges.includes(id));
  career.badges = [...new Set(career.badges.concat(newBadges))];
  career.solvedScenarios = [...new Set(career.solvedScenarios.concat(context.solvedScenarioIds || []))];
  const endingQueue = careerEndingQueue(career);
  return {
    career,
    previousStage,
    promoted:career.stage !== previousStage,
    newBadges,
    endingQueue,
  };
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

/* ---------- 初期化 ---------- */

function newTicket(s){
  const handover = s.workOrigin === 'handover';
  const callbackTurn = handover ? s.handoverCallbackTurn : null;
  return {
    s, state:handover ? 'callback' : 'inbound', patience:100, arrivedTurn:handover ? callbackTurn : s.arrive,
    workOrigin:handover ? 'handover' : 'inbound', handover, handoverAttempted:false,
    facts:[], asked:new Set(), askCounts:new Map(), questionCount:0, lookedUp:new Set(), tested:new Set(), testCounts:new Map(),
    transcript:[], callTranscriptStart:0, greeted:handover, identified:handover, nameKnown:handover, destinationKnown:handover,
    stress:TYPES[s.type].stressStart, maxStress:TYPES[s.type].stressStart, soothed:new Map(), smalltalkCounts:new Map(),
    speechTurns:{ irritated:0, angry:0, furious:0 }, callMinutes:0, inboundMinutes:0, outboundMinutes:0, callSegmentMinutes:0, callDirection:'inbound', holdMinutes:0,
    callChargeConcerned:false, callChargeThresholdPassed:false, callChargeThreshold:null,
    callbackCount:0, callbackDue:handover ? SHIFT_START + callbackTurn : null, callbackLate:false, callbackKind:handover ? 'handover' : null, callbackDestination:handover ? 'direct' : null, callbackPenalty:0, callbackLookupCount:0, callbackWaitStressApplied:false, callbackReliefApplied:false, stayHintDelivered:false, carrierLookupStarted:false,
    callbackReason:handover ? 'handover' : null, callbackStage:handover ? 'scheduled' : null, callbackPromised:handover ? 'day_shift' : null, returnTimeKnown:handover, frontDeskAttempts:0,
    carrierReplyStatus:null, carrierRestored:false, carrierRequestAttempts:0,
    stayAddress:null, stayHotelName:null, stayDaysKnown:false, replacementConsentKnown:false, deliveryAddressConfirmed:false, shipment:null, apologies:new Map(),
    misdiagnoses:0, damage:0, wasted:0, symptomResolved:false, refundProposalRejected:false, result:null, pendingResult:null, pendingInterruption:false, pendingConversation:null,
    complaintEmail:false, misdiagnosisEmail:false, gratitudeEmail:false, refundComplaint:false,
    attempts:[], abandonedCalls:0, abandonRedialScheduled:false,
    redialCount:0, redialOpening:null, redialSpoken:false, redialGreeting:false, escUsed:false,
  };
}

function resetGame(){
  stopOfficeRing();
  state.phase = 'briefing';
  state.turn = 0;
  state.clock = SHIFT_START;
  state.tickets = prepareShiftScenarios(SCENARIOS, state.random).map(newTicket);
  state.focus = null;
  state.escLeft = ESCALATIONS;
  state.cost = 0;
  state.outageKnown = false;
  state.outageRegion = null;
  state.holdVisual = false;
  state.busy = false;
  state.ui = defaultUi();
  state.desk = null;
  state.slogan = SLOGANS[Math.floor(state.random() * SLOGANS.length)];
  state.report = null;
  state.careerUpdate = null;
  state.officeEvents = [];
  state.handoverMeetingComplete = false;
  state.deviceVerificationMinutes = 0;
  state.verifiedDevices = 0;
  state.deviceVerificationFeedback = '';
}

function recordOfficeEvent(kind, text){
  state.officeEvents.push({ kind, text });
  if (state.officeEvents.length > 6) state.officeEvents.shift();
}

function carrierReplyProbability(flags = GAME_FLAGS){
  return flags.luckRate === 1 ? 1 : CARRIER_REPLY_RATE;
}

function carrierReference(t){
  const match = t && t.s && t.s.contractId && String(t.s.contractId.text).match(/GDW-\d+/);
  return match ? match[0] : (t && t.s ? t.s.id : '番号不明');
}

function resolveCarrierRequest(t){
  if (!t || !t.carrierLookupStarted || t.carrierReplyStatus !== 'pending' || state.clock < t.callbackDue) return false;
  const arrived = state.random() < carrierReplyProbability();
  t.carrierReplyStatus = arrived ? 'arrived' : 'missing';
  if (arrived){
    recordOfficeEvent('carrier', '[現地キャリア] 回線の再開通を完了しました（' + carrierReference(t) + '）');
  } else {
    recordOfficeEvent('carrier', '[現地キャリア] 30分経過しましたが完了連絡は届いていません（' + carrierReference(t) + '）');
  }
  return true;
}

/* ---------- ターン進行 ---------- */

function activateDueInbound(){
  let activated = 0;
  state.tickets.forEach(t => {
    if (t.state === 'inbound' && t.arrivedTurn <= state.turn){
      t.state = 'waiting';
      activated++;
    }
  });
  return activated;
}

function inboundSlotAvailable(candidate, tickets = state.tickets){
  return candidate <= LAST_INBOUND_TURN && tickets.every(other =>
    !Number.isFinite(other.arrivedTurn) || Math.abs(candidate - other.arrivedTurn) >= MIN_INBOUND_GAP
  );
}

function scheduleAbandonRedial(t){
  if (t.abandonRedialScheduled || t.abandonedCalls > ABANDON_REDIAL_LIMIT || state.clock >= SHIFT_END) return false;
  let candidate = state.turn + ABANDON_REDIAL_MIN_DELAY;
  while (candidate <= LAST_INBOUND_TURN && !inboundSlotAvailable(candidate)) candidate++;
  if (candidate > LAST_INBOUND_TURN) return false;

  t.abandonRedialScheduled = true;
  t.redialCount++;
  t.state = 'inbound';
  t.result = null;
  t.arrivedTurn = candidate;
  t.patience = 100;
  t.greeted = false;
  t.redialOpening = CALL_FLOW_LINES.abandonedRedialOpenings[t.s.type];
  t.redialSpoken = false;
  t.redialGreeting = true;
  t.stress = clamp(t.stress + ABANDON_REDIAL_STRESS, 0, 100);
  t.maxStress = Math.max(t.maxStress, t.stress);
  recordOfficeEvent('redial', t.s.id + '：放棄呼のあと、' + fmtClock(SHIFT_START + candidate) + 'に再着信予定です。');
  return true;
}

function abandonTicket(t, note){
  if (t.state === 'closed') return false;
  const unansweredInbound = t.state === 'waiting';
  const abandonedAtTurn = state.turn;
  const abandonedArrival = t.arrivedTurn;
  t.state = 'closed';
  t.result = { kind:'abandoned', csat:0, label:'放棄呼', firstCallResolved:false };
  t.abandonedCalls = (t.abandonedCalls || 0) + 1;
  if (!Array.isArray(t.attempts)) t.attempts = [];
  t.attempts.push({ kind:'abandoned', atTurn:abandonedAtTurn, arrivedTurn:abandonedArrival, note });
  playCloseJingle(t.result);
  recordOfficeEvent('abandoned', t.s.id + '：' + note);
  if (unansweredInbound) scheduleAbandonRedial(t);
  return true;
}

function unscoredOutcome(t){
  return Boolean(t && t.result && ['unavailable','handed_off','deferred'].includes(t.result.kind));
}

function handoffActiveTicket(t){
  const deferredCustomerRequest = t && t.state === 'callback' && t.callbackDue > SHIFT_END && ['three_hours','tomorrow'].includes(t.callbackKind);
  if (!t || (t.state !== 'open' && !deferredCustomerRequest)) return false;
  t.state = 'closed';
  t.pendingResult = null;
  t.pendingInterruption = false;
  t.pendingConversation = null;
  t.result = { kind:'handed_off', csat:null, label:deferredCustomerRequest ? '希望時刻の折り返しを日勤へ引き継ぎ' : '日勤へ引き継ぎ', firstCallResolved:false };
  if (!Array.isArray(t.attempts)) t.attempts = [];
  const note = deferredCustomerRequest
    ? 'お客様が希望した折り返し時刻が夜勤終了後のため、日勤担当へ引き継ぎました。'
    : '07:00時点で通話中のため日勤担当へ引き継ぎました。';
  t.attempts.push({ ...t.result, atTurn:SHIFT_DURATION, arrivedTurn:t.arrivedTurn, note });
  t.transcript.push({ who:'note', text:note });
  recordOfficeEvent('handoff', t.s.id + '：' + note);
  return true;
}

function finishShiftAtTime(){
  if (state.phase === 'report') return;
  state.clock = SHIFT_END;
  state.turn = SHIFT_DURATION;
  state.tickets.forEach(t => {
    if (t.state === 'open') handoffActiveTicket(t);
    else if (t.state === 'callback' && t.callbackDue > SHIFT_END && ['three_hours','tomorrow'].includes(t.callbackKind)) handoffActiveTicket(t);
    else abandonTicket(t, '07:00の勤務終了で放棄呼になりました。');
  });
  state.focus = null;
  state.desk = null;
  playShiftEndSound();
  state.phase = 'report';
  renderReport();
}

function advance(turns){
  if (turns === 0) activateDueInbound();
  for (let i = 0; i < turns; i++){
    state.turn++;
    state.clock += TURN_MIN;

    if (state.clock >= SHIFT_END){
      finishShiftAtTime();
      break;
    }

    state.tickets.forEach(t => resolveCarrierRequest(t));

    // すでに待っている呼だけが、この1分の待ち時間を消費する
    state.tickets.forEach(t => {
      if (t.state === 'waiting') t.patience -= 100 / t.s.abandonAfter;
      else if (t.state === 'callback' && state.clock > t.callbackDue) t.patience -= 100 / CALLBACK_OVERDUE_MIN;
      if (t.patience <= 0 && (t.state === 'waiting' || t.state === 'callback')){
        t.patience = 0;
        abandonTicket(t, '応答前に切断され、放棄呼になりました。');
      }
    });

    // この分に到着した呼は、次の1分から待ち時間を消費する
    activateDueInbound();
  }
}

/* §73: 完了台数を順番として使うため、誤選択や着信中断では同じ返却機が残り、
   完了したときだけ次の機器へ進む。 */
function currentDeviceVerificationCase(){
  return DEVICE_VERIFICATION_CASES[state.verifiedDevices % DEVICE_VERIFICATION_CASES.length];
}

function deviceVerificationChoiceMatches(actionId){
  const verificationCase = currentDeviceVerificationCase();
  return Boolean(verificationCase && DEVICE_VERIFICATION_ACTIONS.some(action => action.id === actionId) && verificationCase.correctAction === actionId);
}

function chooseDeviceVerification(actionId){
  const verificationCase = currentDeviceVerificationCase();
  const action = DEVICE_VERIFICATION_ACTIONS.find(candidate => candidate.id === actionId);
  if (!verificationCase || !action || !deviceVerificationChoiceMatches(actionId)){
    state.deviceVerificationFeedback = action
      ? '「' + action.label + '」では、この症状を優先して切り分けられません。症状に合う検査を選び直してください。'
      : '検査項目を選び直してください。';
    return { accepted:false, advanced:0, interrupted:false, completed:false };
  }
  state.deviceVerificationFeedback = '';
  return Object.assign({ accepted:true }, runDeviceVerification());
}

/* §64: 待機そのものでは時刻を進めない。返却機1台を60分かけて検証し、
   着信した分で止める。途中までの作業は、通話後に同じ台から再開できる。 */
function runDeviceVerification(){
  const alreadyWaiting = state.tickets.some(t => t.state === 'waiting');
  const callbackReady = state.tickets.some(t => t.state === 'callback' && t.callbackDue <= state.clock);
  if (state.phase !== 'office' || state.focus || alreadyWaiting || callbackReady) return { advanced:0, interrupted:alreadyWaiting || callbackReady, completed:false };
  const remaining = DEVICE_VERIFICATION_MINUTES - state.deviceVerificationMinutes;
  let advanced = 0;
  let completed = false;
  while (advanced < remaining && state.phase !== 'report'){
    state.deviceVerificationMinutes++;
    advance(1);
    advanced++;
    if (state.deviceVerificationMinutes >= DEVICE_VERIFICATION_MINUTES){
      const verificationCase = currentDeviceVerificationCase();
      state.verifiedDevices++;
      state.deviceVerificationMinutes = 0;
      completed = true;
      recordOfficeEvent('verification', verificationCase.device + '：' + verificationCase.result + '（検証済み ' + state.verifiedDevices + '台）');
      break;
    }
    if (state.tickets.some(t => t.state === 'waiting' || (t.state === 'callback' && t.callbackDue <= state.clock))) break;
  }
  const waitingInterrupted = state.phase !== 'report' && state.tickets.some(t => t.state === 'waiting');
  const callbackInterrupted = state.phase !== 'report' && state.tickets.some(t => t.state === 'callback' && t.callbackDue <= state.clock);
  const interrupted = waitingInterrupted || callbackInterrupted;
  if (interrupted && !completed){
    recordOfficeEvent('verification', (callbackInterrupted ? '折り返し時刻になったため' : '着信のため') + '機器検証を中断しました（' + state.deviceVerificationMinutes + ' / ' + DEVICE_VERIFICATION_MINUTES + '分）。');
  }
  if (state.phase === 'office') renderOffice();
  return { advanced, interrupted, completed };
}

function addFact(t, fact, src){
  t.facts.push({ text:fact.text, src:src, out:fact.out || [], hot:fact.hot || [] });
  if (t === state.focus) playClueSound();
}

/* ---------- 広域障害の判明（シフトの山場） ---------- */

function triggerOutage(origin){
  if (state.outageKnown) return;
  state.outageKnown = true;
  state.outageRegion = origin.s.regionName || origin.s.country;
  origin.transcript.push({ who:'note', text:'[全社通知] ' + state.outageRegion + ' 提携キャリアの広域障害を確認。同一エリアの他チケットにも当てはまります。' });

  state.tickets.forEach(t => {
    if (t === origin) return;
    if (t.s.trueCause !== 'carrier') return;
    if (t.state === 'closed') return;
    t.transcript.push({ who:'sys', text:'[全社通知] ' + state.outageRegion + ' 提携キャリアの広域障害を確認。同一エリアからの入電はこの障害による可能性が高い。' });
    addFact(t, { text:'同じエリアで広域障害が確認された', hot:['carrier'], out:['sim','coverage','provision','device_side','device_net'] }, '全社通知');
  });
}

/* ---------- プレイヤーの行動 ---------- */

function pickup(t){
  if (state.focus) return;
  playPickupSound();
  t.state = 'open';
  t.callDirection = 'inbound';
  t.callSegmentMinutes = 0;
  t.callbackStage = null;
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
  t.transcript.push({
    who:'me',
    text:t.redialGreeting ? CALL_FLOW_LINES.redialGreeting : 'お電話ありがとうございます。グローバルデスクでございます',
  });
  t.redialGreeting = false;
  deliverCustomerOpening(t, false);
  render();
}

function resumeCallback(t){
  if (state.focus || !t || t.state !== 'callback' || state.clock < t.callbackDue) return;
  if (t.handover){ resumeHandoverCallback(t); return; }
  playPickupSound();
  t.callbackLate = state.clock > t.callbackDue;
  t.state = 'open';
  t.callDirection = 'outbound';
  t.callSegmentMinutes = 0;
  t.callbackStage = 'front_desk';
  t.frontDeskAttempts = 0;
  t.callTranscriptStart = t.transcript.length;
  state.focus = t;
  resolveCarrierRequest(t);
  t.transcript.push({ who:'front', text:CALL_FLOW_LINES.frontDesk.greeting + (isLateLocalTime(t) ? ' ' + CALL_FLOW_LINES.frontDesk.lateQuestion : '') });
  state.ui = defaultUi();
  enterCall();
}

function handoverCustomerAvailable(flags = GAME_FLAGS){
  return flags.luckRate === 1 || state.random() < HANDOVER_ANSWER_RATE;
}

function finishUnavailableHandover(t){
  t.state = 'closed';
  t.result = { kind:'unavailable', csat:null, label:'不在（連絡実施）', firstCallResolved:false };
  t.transcript.push({ who:'note', text:'呼び出しましたが応答はありませんでした。その夜の連絡義務は完了です。' });
  t.attempts.push({ ...t.result, atTurn:state.turn, arrivedTurn:t.arrivedTurn });
  playDisconnectSound();
  recordOfficeEvent('handover', t.s.id + '：引き継ぎ案件へ一度連絡しましたが不在でした。');
  if (state.focus === t) state.focus = null;
  state.ui = defaultUi();
  checkShiftEnd();
}

function resumeHandoverCallback(t){
  if (state.focus || !t || !t.handover || t.handoverAttempted || t.state !== 'callback' || state.clock < t.callbackDue) return;
  playPickupSound();
  t.handoverAttempted = true;
  t.callbackCount++;
  t.callbackLate = state.clock > t.callbackDue;
  t.state = 'open';
  t.callDirection = 'outbound';
  t.callSegmentMinutes = 0;
  t.callbackStage = 'direct';
  t.callTranscriptStart = t.transcript.length;
  state.focus = t;
  t.transcript.push({ who:'me', text:t.s.name + '様でしょうか。日勤担当から引き継いだグローバルデスクです。' });
  const available = handoverCustomerAvailable();
  if (!available){
    t.dialMinutes = (t.dialMinutes || 0) + 1;
    advance(1);
    finishUnavailableHandover(t);
    return;
  }
  if (!spendOnCall(t, 1, 0)) return;
  pushCustomerLine(t, t.s.opening);
  deliverStayHint(t);
  state.ui = defaultUi();
  enterCall();
}

function callbackCustomerReply(t){
  const carrierResult = (t.s.lookups || {}).l_carrier;
  if (t.callbackReason === 'carrier' && t.carrierReplyStatus === 'arrived' && carrierResult && carrierResult.restores) return CALL_FLOW_LINES.carrier.reopenedReplies[t.s.type];
  if (t.callbackReason === 'carrier' && t.carrierReplyStatus === 'missing') return CALL_FLOW_LINES.carrier.pendingReplies[t.s.type];
  return CALL_FLOW_LINES.callback.replies[t.s.type];
}

function handleFrontDeskChoice(choice){
  const t = state.focus;
  if (!t || t.callbackStage !== 'front_desk' || !['guest','room','callback'].includes(choice)) return;
  if (choice === 'guest' && !t.nameKnown) return;
  if (choice === 'room' && !hotelRoom(t)) return;
  const option = CALL_FLOW_LINES.frontDesk.options[choice]
    .replace('{name}', t.s.nameEn)
    .replace('{room}', hotelRoom(t) || 'the guest room');
  t.transcript.push({ who:'me', text:option });
  const late = isLateLocalTime(t);
  const direct = choice === 'callback';
  t.frontDeskAttempts++;
  if (!spendOnCall(t, late && !direct ? 2 : 1, 0)){ render(); return; }
  const frontReply = late && !direct ? CALL_FLOW_LINES.frontDesk.delayedConnect : CALL_FLOW_LINES.frontDesk.connect;
  const customerReply = callbackConnectionCustomerReply(t);
  pushFlowLines(t, [
    { who:'front', text:frontReply },
    { who:'cust', text:customerReply },
  ]);
  applyCallbackWaitStress(t, false);
  t.callbackStage = 'connected';
  /* §49-2: こちらから指定した客室へ繋がった相手なので、本人確認は済んだものとして扱う。
     フロントには名前か部屋番号を伝えて繋いでもらっており、入電で名乗る前の相手とは
     なりすましの余地がまるで違う。滞在先だけ聞いて折り返すと社内システムを開けない、
     という食い違いはここで解く。入電側の条件（§41）は変えない。 */
  t.identified = true;
  applyPunctualCallbackRelief(t, false);
  finishCarrierLookup(t);
  state.ui = defaultUi();
  render();
}

function callbackLookupAllowance(t){
  return t.callbackKind === 'scheduled' ? CALLBACK_SCHEDULED_LOOKUP_ALLOWANCE : CALLBACK_IMMEDIATE_LOOKUP_ALLOWANCE;
}
/* §49-1: 約束の時刻までに掛け直せていれば、客室につながった時点で客が落ち着く。
   遅れた場合は回復させない（遅れの罰は採点の -1.5 にあり、二重に罰さない）。
   運は入れない。「守っても報われないことがある」形にすると、折り返しを選ぶ判断が
   成り立たなくなる。回復は接続の1回だけで、折り返しを繰り返しても増えない。 */
function callbackPunctualReliefAvailable(t){
  return !t.callbackReliefApplied && !t.callbackLate && Boolean(CALLBACK_PUNCTUAL_RELIEF[t.s.type]);
}

function applyPunctualCallbackRelief(t, speak = true){
  if (t.callbackReliefApplied || t.callbackLate) return;
  t.callbackReliefApplied = true;
  const delta = CALLBACK_PUNCTUAL_RELIEF[t.s.type];
  if (!delta) return;
  if (speak) pushCustomerLine(t, CALLBACK_PUNCTUAL_REPLIES[t.s.type], { plain:true });
  changeStress(t, delta, true);
}

function callbackWaitStressDelta(t){
  const over = Math.max(0, (t.callbackLookupCount || 0) - callbackLookupAllowance(t));
  const idle = t.callbackKind === 'scheduled' && !t.callbackLookupCount;
  return over * CALLBACK_OVER_LOOKUP_STRESS + (idle ? CALLBACK_IDLE_STRESS : 0);
}

function callbackConnectionCustomerReply(t){
  const carrierReply = callbackCustomerReply(t);
  if (t.callbackReason === 'carrier') return carrierReply;
  if (!t.callbackWaitStressApplied && callbackWaitStressDelta(t)) return CALLBACK_WAIT_REPLIES[t.s.type];
  if (callbackPunctualReliefAvailable(t)) return CALLBACK_PUNCTUAL_REPLIES[t.s.type];
  return carrierReply;
}

function applyCallbackWaitStress(t, speak = true){
  if (t.callbackWaitStressApplied) return;
  const delta = callbackWaitStressDelta(t);
  if (delta){
    if (speak) pushCustomerLine(t, CALLBACK_WAIT_REPLIES[t.s.type], { plain:true });
    addStress(t, delta);
  }
  t.callbackWaitStressApplied = true;
}

function callbackOperatorLine(t){
  const wrong = t.callbackDestination !== t.s.callbackTo;
  if (t.callbackLate && wrong) return t.callbackDestination === 'hotel' ? CALL_FLOW_LINES.callback.lateWrongHotel : CALL_FLOW_LINES.callback.lateWrongMobile;
  if (wrong) return t.callbackDestination === 'hotel' ? CALL_FLOW_LINES.callback.wrongHotel : CALL_FLOW_LINES.callback.wrongMobile;
  return t.callbackLate ? CALL_FLOW_LINES.callback.late : CALL_FLOW_LINES.callback.normal;
}

function spendOnCall(t, minutes, holdMinutes, resolvingSymptom = false){
  const before = t.callMinutes;
  const inboundBefore = t.inboundMinutes || 0;
  const chargeConcernType = CALL_CHARGE_COMPLAINT_TYPES.includes(t.s.type);
  if (chargeConcernType && t.callDirection === 'inbound' && !Number.isInteger(t.callChargeThreshold)){
    t.callChargeThreshold = callChargeConcernThreshold();
  }
  t.callMinutes += minutes;
  t.callSegmentMinutes = (t.callSegmentMinutes || 0) + minutes;
  if (t.callDirection === 'outbound') t.outboundMinutes = (t.outboundMinutes || 0) + minutes;
  else t.inboundMinutes = inboundBefore + minutes;
  t.holdMinutes += holdMinutes || 0;
  advance(minutes);
  const held = holdMinutes || 0;
  if (held && t.state === 'open' && !t.pendingResult){
    const direction = t.callDirection === 'outbound' ? 'outbound' : 'inbound';
    if (!addStress(t, held * HOLD_STRESS_PER_MINUTE[direction], false, true)) return false;
  }
  const chargeThreshold = t.callChargeThreshold;
  if (!t.callChargeThresholdPassed && chargeConcernType && t.callDirection === 'inbound' && inboundBefore <= chargeThreshold && t.inboundMinutes > chargeThreshold && t.state === 'open' && !t.pendingResult && !t.symptomResolved && !resolvingSymptom){
    t.callChargeThresholdPassed = true;
    t.callChargeConcerned = true;
    pushCustomerLine(t, CALL_FLOW_LINES.callChargeConcern[t.s.type], { plain:true });
    if (!changeStress(t, 4, true)) return false;
  }
  const longMinutes = Math.max(0, t.callMinutes - 10) - Math.max(0, before - 10);
  if (longMinutes && t.state === 'open') addStress(t, longMinutes * 2);
  return t.state === 'open' && !t.pendingResult;
}

function addStress(t, base, miss, expectedOutcome){
  const type = TYPES[t.s.type];
  return changeStress(t, base * type.stressRate * (miss ? type.missRate : 1), expectedOutcome);
}
function changeStress(t, delta, expectedOutcome = rollLuck()){
  const previousStress = t.stress;
  if (!expectedOutcome) delta = 0;
  t.stress = clamp(t.stress + delta, 0, 100);
  t.maxStress = Math.max(t.maxStress, t.stress);
  // 本人確認の質問と同じ境界で、記録不足の減点免除を残す。
  if (t.stress >= 50) t.identityStressSeen = true;
  if (previousStress <= 80 && t.stress > 80) playStressWarning();
  if (t.stress >= 100 && t.state === 'open' && !t.pendingResult){
    endAngryCall(t, 'stress');
  }
  return t.state === 'open' && !t.pendingResult;
}

function angryOutcomeKind(t){
  const normal = ANGRY_DEFAULT_OUTCOMES[t.s.type];
  if (rollLuck()) return normal;
  return normal === 'email' ? 'redial' : 'email';
}

function scheduleAngryRedial(t){
  let candidate = state.turn + MIN_INBOUND_GAP;
  while (candidate <= LAST_INBOUND_TURN && !inboundSlotAvailable(candidate)) candidate++;
  if (candidate > LAST_INBOUND_TURN) return false;
  t.redialCount++;
  t.state = 'inbound';
  t.arrivedTurn = candidate;
  t.greeted = false;
  t.redialOpening = ANGRY_REDIAL_OPENINGS[t.s.type];
  t.redialSpoken = false;
  t.redialGreeting = true;
  t.stress = Math.min(t.stress, 80);
  t.pendingConversation = null;
  state.focus = null;
  state.ui = defaultUi();
  playDisconnectSound();
  enterOffice();
  return true;
}

function endAngryCall(t, reason){
  t.transcript.push({ who:'note', text:'お客様との通話が切れました。' });
  // §45: 折り返しを約束していたなら、怒って切られても約束は生きている。折り返さないほうが業務として悪い。
  if (t.callbackPromised){
    t.transcript.push({ who:'note', text:'お客様から切られましたが、折り返しのお約束は残っています。' });
    finishPromisedCallback(t, false);
    return false;
  }
  const followup = angryOutcomeKind(t);
  if (followup === 'redial' && scheduleAngryRedial(t)) return false;
  const result = {
    kind:'complaint', reason, csat:1.0, label:'翌日の苦情メール',
    firstCallResolved:false,
  };
  t.pendingConversation = null;
  closeTicket(t, result);
  render();
  return false;
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

function pushFlowLines(t, lines){
  if (lines.length > 2) throw new Error('追加会話は1操作につき最大2行です');
  lines.forEach(line => {
    if (line.who === 'cust') pushCustomerLine(t, line.text, { plain:true });
    else t.transcript.push({ who:line.who, text:line.text });
  });
}

function advanceConversationFlow(t){
  if (!t || pendingTypedLine(t) || !t.pendingConversation) return false;
  if (t.pendingConversation.kind === 'second_misdiagnosis'){
    const reason = t.pendingConversation.reason;
    t.pendingConversation = null;
    endAngryCall(t, reason);
    return true;
  }
  return false;
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
      deliverStayHint(t);
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
  deliverStayHint(t);
  t.destinationKnown = DESTINATION_IN_OPENING.has(t.s.id);
}

function deliverStayHint(t){
  if (t.stayHintDelivered || !t.s.stayHint) return;
  pushCustomerLine(t, t.s.stayHint, { plain:true });
  t.stayHintDelivered = true;
}

function identificationReady(t){
  return t.identified || (t.nameKnown && t.destinationKnown);
}

function requireIdentification(t){
  if (identificationReady(t)) return true;
  state.ui = defaultUi('identity_denied');
  render();
  return false;
}

function identityQuestionStress(t, qid, normalBase){
  if (!['q_name','q_contract'].includes(qid) || t.stress < 50) return addStress(t, normalBase);
  t.identityStressSeen = true;
  const delta = IDENTITY_CALMING_EFFECTS[t.s.type];
  if (delta === 0) return changeStress(t, 0, true);
  const expectedOutcome = rollLuck();
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

function openLookup(){
  const t = state.focus;
  if (!t || !requireIdentification(t)) return;
  state.ui = defaultUi('lookup');
  render();
}

/* ---------- 折り返し待ちのあいだ、デスク端末で調べる ----------
   相手を待たせているのは通話ではないので、ストレスは増えない。
   ただし時間は進むので、折り返しが約束の時刻に遅れる危険はそのまま残る。 */

function deskTickets(){
  return state.tickets.filter(t => t.state === 'callback').sort((a, b) => a.callbackDue - b.callbackDue);
}

function deskTicket(){
  if (!state.desk || !state.desk.ticketId) return null;
  return deskTickets().find(t => t.s.id === state.desk.ticketId) || null;
}

function openDeskLookup(){
  const list = deskTickets();
  if (!list.length || state.focus) return;
  state.desk = { ticketId:list.length === 1 ? list[0].s.id : null, recordTicketId:null };
  enterDesk();
}

function selectDeskTicket(id){
  if (!state.desk) return;
  state.desk.ticketId = (id === '__back') ? null : id;
  state.desk.recordTicketId = null;
  renderDesk();
}

function closeDeskLookup(){
  state.desk = null;
  enterOffice();
}

function doDeskLookup(lid){
  const t = deskTicket();
  if (!t || state.busy) return;
  const l = LOOKUPS.find(x => x.id === lid);
  if (!l || l.external || t.lookedUp.has(lid) || !identificationReady(t)) return;
  t.lookedUp.add(lid);
  t.callbackLookupCount = (t.callbackLookupCount || 0) + 1;
  const r = (t.s.lookups || {})[lid];
  if (r){
    t.transcript.push(lookupSystemLine(l, r));
    if (r.fact) addFact(t, r.fact, 'デスク端末で照会');
    if (r.outage) triggerOutage(t);
  } else {
    t.transcript.push(lookupSystemLine(l, null));
    if (l.missFact) addFact(t, l.missFact, 'デスク端末で照会');
    else t.wasted++;
  }
  advance(DESK_LOOKUP_MINUTES);
  // 時間を進めた結果、折り返しの相手が待ちきれずに切っていることがある。
  if (t.state !== 'callback'){ closeDeskLookup(); return; }
  state.desk.recordTicketId = t.s.id;
  renderDesk();
}

function openRecord(){
  const t = state.focus;
  if (!t || !requireIdentification(t)) return;
  pushFlowLines(t, [{ who:'me', text:CALL_FLOW_LINES.recordStart }]);
  t.transcript.push({ who:'note', text:'ログを1分かけて確認しました。' });
  if (!addStress(t, 4)) return;
  if (!spendOnCall(t, 1, 0)) return;
  state.ui = defaultUi('record');
  render();
}

function refundResponsibility(causeId){
  return ['company','neutral','customer'].find(group => REFUND_POLICY[group].causes.includes(causeId));
}

function refundAssessment(t){
  const excluded = new Set();
  t.facts.forEach(fact => (fact.out || []).forEach(cause => excluded.add(cause)));
  const candidates = CAUSES.map(cause => cause.id).filter(cause => !excluded.has(cause));
  return {
    diagnosed:candidates.length === 1 && candidates[0] === t.s.trueCause,
    group:refundResponsibility(t.s.trueCause),
  };
}

function refundSatisfied(t, assessment = refundAssessment(t)){
  if (!assessment.diagnosed) return false;
  if (GAME_FLAGS.luckRate === 1) return assessment.group === 'company';
  return state.random() < REFUND_POLICY[assessment.group].satisfactionRate;
}

function refundProposalRejected(causeId){
  const group = refundResponsibility(causeId);
  if (GAME_FLAGS.luckRate === 1) return false;
  return state.random() < REFUND_POLICY[group].rejectionRate;
}

function doRefund(){
  const t = state.focus;
  if (!t || state.ui.tab !== 'refund_confirm' || t.refundProposalRejected) return;
  if (refundProposalRejected(t.s.trueCause)){
    t.refundProposalRejected = true;
    t.transcript.push({ who:'me', text:'ご不便のお詫びとして、今回のご利用料金から2,400円の返金をご提案いたします。' });
    pushCustomerLine(t, TYPES[t.s.type].refundRejectReply, { plain:true });
    if (!spendOnCall(t, 2, 0)){ render(); return; }
    if (!addStress(t, 18)){ render(); return; }
    state.ui = defaultUi();
    render();
    return;
  }
  const assessment = refundAssessment(t);
  const satisfied = refundSatisfied(t, assessment);
  state.cost += REFUND_POLICY.amount;
  t.transcript.push({ who:'me', text:'ご不便のお詫びとして、今回のご利用料金から2,400円を返金いたします。' });
  if (satisfied){
    pushCustomerLine(t, '返金の件、分かりました。それなら今回は受け取ります。', { plain:true });
    pushCustomerLine(t, farewellLine(t.s, 'partial'), { plain:true });
  } else {
    pushCustomerLine(t, 'お金の話ではなく、いま使えないことに困っているんです。これで終わりには納得できません。', { plain:true });
  }
  pushFlowLines(t, [{
    who:'me',
    text:satisfied ? CALL_FLOW_LINES.ending.refundSatisfied : CALL_FLOW_LINES.ending.refundDissatisfied,
  }]);
  t.pendingResult = {
    kind:'refunded', satisfied, diagnosed:assessment.diagnosed, refundComplaint:!assessment.diagnosed,
    csat:satisfied ? 2.5 : 1.0,
    label:satisfied ? '返金で終結（未解決）' : '返金で終結（不満）', firstCallResolved:false,
  };
  state.ui = defaultUi();
  render();
}

function replacementAddressConfirmation(t, qid){
  if (qid === 'q_stay' && t.s.deliveryAddress){
    return {
      anxious:'到着する頃には次のホテルへ移っています。' + t.s.deliveryAddress + 'へお願いします…。',
      novice:'届く頃は別のホテルへ移っています。' + t.s.deliveryAddress + 'で受け取れます。',
      expert:'到着時点の滞在先は' + t.s.deliveryAddress + 'です。配送先を更新してください。',
      hurried:'届く頃は' + t.s.deliveryAddress + '。そっちへ送って。',
    }[t.s.type];
  }
  return {
    anxious:{ q_stay:'届く頃も同じホテルにいます。部屋番号も確認しておきます…。', q_stay_length:'あと' + t.s.stayDays + '泊あります。明日なら、まだ十分使えますよね…？' },
    novice:{ q_stay:'届く頃も同じホテルです。フロントにも伝えておきます。', q_stay_length:'あと' + t.s.stayDays + '泊あります。明日届くなら受け取れます。' },
    expert:{ q_stay:'到着時点も同じホテルです。客室宛で手配してください。', q_stay_length:'残り' + t.s.stayDays + '泊です。翌日便なら利用期間は足ります。' },
    hurried:{ q_stay:'届く頃も同じホテル。部屋まで頼む。', q_stay_length:'あと' + t.s.stayDays + '泊。明日なら間に合う。' },
  }[t.s.type][qid];
}

function doAsk(qid){
  const t = state.focus;
  const q = QUESTIONS.find(x => x.id === qid);
  if (!t || !q || (q.needsDevice && !t.s.deviceInHand)) return;
  const previous = t.askCounts.get(qid) || 0;
  const necessaryCallbackStay = qid === 'q_stay' && Boolean(t.callbackPromised) && previous === 0;
  t.askCounts.set(qid, previous + 1);
  t.questionCount++;
  t.asked.add(qid);
  t.transcript.push({ who:'me', text:q.label });
  const replacementAddressCheck = previous > 0 && ['q_stay','q_stay_length'].includes(qid) && t.asked.has('q_stay') && t.asked.has('q_replacement') && t.s.wantsReplacement;
  if (replacementAddressCheck){
    if (qid === 'q_stay' && t.s.deliveryAddress){ t.stayAddress = t.s.deliveryAddress; t.stayHotelName = t.s.alternateHotelName; t.deliveryAddressConfirmed = true; }
    pushCustomerLine(t, replacementAddressConfirmation(t, qid));
    if (qid === 'q_stay_length') t.stayDaysKnown = true;
    if (!spendOnCall(t, 1, 0)) return;
    state.ui = defaultUi(); render(); return;
  }
  if (qid === 'q_return') t.returnTimeKnown = true;
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
    if (qid === 'q_stay'){ t.stayAddress = r.text; t.stayHotelName = t.s.hotelName; }
    if (qid === 'q_stay_length') t.stayDaysKnown = true;
    if (qid === 'q_replacement') t.replacementConsentKnown = true;
  } else {
    pushCustomerLine(t, q.miss);
    t.wasted++;
  }
    if ((!necessaryCallbackStay || !r) && !addStress(t, askStressBase(t, r ? 3 : 9), !r)) return;
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
  if (l.external) return;
  if (!t.identified) return;
  const minutes = mode === 'hold' ? 2 : 3;
  const hold = mode === 'hold' ? 2 : 0;
  if (!addStress(t, mode === 'hold' ? 7 : 3)) return;

  state.busy = true;
  state.holdVisual = mode === 'hold';
  pushFlowLines(t, [{ who:'me', text:mode === 'hold' ? CALL_FLOW_LINES.lookup.holdStart : CALL_FLOW_LINES.lookup.talkStart }]);
  t.transcript.push({ who:'note', text:mode === 'hold' ? 'お客さまを保留にして社内照会を始めました。' : 'お客さまと話しながら社内照会を始めました。' });
  render();

  setTimeout(() => finishLookup(t, l, minutes, hold), mode === 'hold' ? 420 : 0);
}

function lookupSystemLine(lookup, result){
  return {
    who:'sys',
    typed:true,
    text:result ? result.text : lookup.defaultResult,
    viz:result && result.viz ? result.viz : null,
    lookupId:lookup.id,
    lookupTitle:lookup.title,
    external:Boolean(lookup.external),
  };
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
    t.transcript.push(lookupSystemLine(l, r));
    if (r.fact) addFact(t, r.fact, '社内照会');
    if (r.outage) triggerOutage(t);
  } else {
    t.transcript.push(lookupSystemLine(l, null));
    if (l.missFact) addFact(t, l.missFact, '社内照会');
    else t.wasted++;
  }

  const continued = spendOnCall(t, minutes, hold);
  state.busy = false;
  state.holdVisual = false;
  if (!continued){ render(); return; }
  // 照会しただけで結果を客へ読み上げない。何をどう伝えるかは「伝える」で選ぶ。
  pushFlowLines(t, [{ who:'me', text:hold ? CALL_FLOW_LINES.lookup.holdComplete : CALL_FLOW_LINES.lookup.talkComplete }]);
  state.ui = defaultUi('system_record');
  render();
}

function finishCarrierLookup(t){
  if (!t || !t.carrierLookupStarted || t.lookedUp.has('l_carrier') || !['arrived','missing'].includes(t.carrierReplyStatus)) return false;
  const l = LOOKUPS.find(item => item.id === 'l_carrier');
  if (!l) return false;
  t.carrierLookupStarted = false;
  const result = (t.s.lookups || {})[l.id];
  if (t.carrierReplyStatus === 'arrived' && result){
    t.lookedUp.add(l.id);
    t.transcript.push(lookupSystemLine(l, result));
    if (result.fact) addFact(t, result.fact, '現地キャリア照会');
    if (result.restores){
      t.carrierRestored = true;
      t.symptomResolved = true;
    }
  } else if (t.carrierReplyStatus === 'arrived') {
    t.lookedUp.add(l.id);
    t.transcript.push(lookupSystemLine(l, null));
    if (l.missFact) addFact(t, l.missFact, '現地キャリア照会');
    else t.wasted++;
  } else {
    t.transcript.push({ who:'sys', text:'[現地キャリア] 完了連絡なし。回線はまだ再開通されていません。' });
  }
  return true;
}

function doTest(tid){
  const t = state.focus;
  const risky = RISKY.find(x => x.id === tid);
  const test = risky || TESTS.find(x => x.id === tid);
  if (!t || !test || (test.needsDevice && !t.s.deviceInHand)) return;
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
  if (!spendOnCall(t, test.turns, 0, Boolean(def && !redundant && def.solves))) return;

  if (risky){
    pushCustomerLine(t, risky.result);
    t.transcript.push({ who:'note', text:'【まずい対応】' + risky.note });
    t.damage += risky.damage;
    playBadActionSound();
  } else if (def && !redundant){
    pushCustomerLine(t, def.solves ? TYPES[t.s.type].solvedReply : def.text);
    t.transcript.push({ who:'note', text:'操作結果：' + def.text });
    if (def.fact) addFact(t, def.fact, '操作の結果');
    if (def.solves) t.symptomResolved = true;
  } else {
    pushCustomerLine(t, previous > 0 ? '同じ操作はもう行いました。もう一度やっても変わりません。' : 'やってみましたが、変わりませんでした。');
    t.transcript.push({ who:'note', text:'操作結果：症状に変化はありませんでした。' });
    t.wasted++;
  }
  state.ui = defaultUi();
  render();
}

function leaveCallForOffice(){
  state.focus = null;
  state.ui = defaultUi();
  playDisconnectSound();
  enterOffice();
}

function startCarrierCallback(destination){
  const t = state.focus;
  const lookup = LOOKUPS.find(item => item.id === 'l_carrier');
  if (!t || !lookup || state.ui.tab !== 'lookup' || state.ui.lookup !== lookup.id || t.carrierLookupStarted || t.lookedUp.has(lookup.id)) return;
  if (destination !== 'hotel' || !hotelContactKnown(t)){ render(); return; }
  pushFlowLines(t, [
    { who:'me', text:CALL_FLOW_LINES.carrier.promise },
    { who:'cust', text:CALL_FLOW_LINES.carrier.consent },
  ]);
  t.transcript.push({ who:'note', text:'ホテルへ30分後に折り返す約束と、現地キャリアへの再開通依頼を記録しました。' });
  t.callbackCount++;
  t.callbackLookupCount = 0;
  t.callbackWaitStressApplied = false;
  t.callbackDestination = 'hotel';
  t.callbackReason = 'carrier';
  t.callbackStage = null;
  t.carrierLookupStarted = true;
  t.carrierReplyStatus = 'pending';
  t.carrierRequestAttempts++;
  if (!spendOnCall(t, 1, 0)) return;
  t.callbackDue = state.clock + lookup.minutes;
  t.state = 'callback';
  leaveCallForOffice();
}

/* §45: 折り返しの申し出。ここでは切らない。折り返し先を確認してから「伝える」の「電話を切る」で終話する。 */
function startHotelCallback(kind = 'immediate'){
  const t = state.focus;
  if (!t || t.pendingResult || t.pendingInterruption || t.callbackStage === 'front_desk' || t.callbackPromised) return;
  if (t.s && t.s.type === 'hurried'){
    pushFlowLines(t, [
      { who:'me', text:kind === 'scheduled' ? CALL_FLOW_LINES.callbackPromise.scheduled : CALL_FLOW_LINES.callbackPromise.immediate },
      { who:'cust', text:CALL_FLOW_LINES.callbackPromise.hurriedRefusal },
    ]);
    if (!spendOnCall(t, 1, 0)) return;
    if (!changeStress(t, 6, true)) return;
    state.ui = defaultUi();
    render();
    return;
  }
  const preferredKind = kind === 'scheduled' && t.s && ['three_hours','tomorrow'].includes(t.s.callbackPreference) ? t.s.callbackPreference : kind;
  const customerReply = preferredKind === 'three_hours' ? CALL_FLOW_LINES.callbackPromise.threeHours
    : preferredKind === 'tomorrow' ? CALL_FLOW_LINES.callbackPromise.tomorrow
    : CALL_FLOW_LINES.callbackPromise.consent;
  pushFlowLines(t, [
    { who:'me', text:kind === 'scheduled' ? CALL_FLOW_LINES.callbackPromise.scheduled : CALL_FLOW_LINES.callbackPromise.immediate },
    { who:'cust', text:customerReply },
  ]);
  t.callbackPromised = preferredKind;
  t.transcript.push({ who:'note', text:CALL_FLOW_LINES.callbackPromise.note });
  if (!spendOnCall(t, 1, 0)) return;
  state.ui = defaultUi();
  render();
}

/* §45: 約束したうえで電話を切ったときの終話。滞在先を持たないまま切れば、折り返せない。 */
function finishPromisedCallback(t, charge = true){
  if (!t || !t.callbackPromised) return;
  const kind = t.callbackPromised;
  t.callbackPromised = null;
  // 滞在先を聞かずに切ると、折り返す先がない。客が自分から掛け直してきて責める（§40-4）。
  if (!hotelContactKnown(t)){ blindCallbackRedial(t); return; }
  t.transcript.push({ who:'note', text:'お客様の国際通話料を止め、ホテルへ折り返す約束を記録しました。' });
  t.callbackCount++;
  t.callbackLookupCount = 0;
  t.callbackWaitStressApplied = false;
  t.callbackDestination = 'hotel';
  t.callbackReason = 'general';
  t.callbackKind = kind;
  t.callbackStage = null;
  if (charge && !spendOnCall(t, 1, 0)) return;
  t.callbackDue = kind === 'tomorrow' ? CALLBACK_TOMORROW_DUE
    : state.clock + (kind === 'three_hours' ? CALLBACK_THREE_HOURS_MINUTES : kind === 'scheduled' ? CALLBACK_SCHEDULED_MINUTES : 0);
  t.state = 'callback';
  leaveCallForOffice();
}

/* 折り返しを約束しながら滞在先を持たずに切った場合。折り返せないので、客から掛かってくる。 */
function blindCallbackRedial(t){
  t.transcript.push({ who:'note', text:CALL_FLOW_LINES.callback.noAddressNote });
  t.callbackPenalty = (t.callbackPenalty || 0) + BLIND_CALLBACK_CSAT_PENALTY;
  if (!spendOnCall(t, 1, 0)) return;
  if (!addStress(t, BLIND_CALLBACK_STRESS)){ render(); return; }
  t.redialCount++;
  t.state = 'waiting';
  t.arrivedTurn = state.turn;
  t.greeted = false;
  t.redialOpening = CALL_FLOW_LINES.callback.blameOpenings[t.s.type];
  t.redialSpoken = false;
  t.redialGreeting = true;
  /* 再着信の知らせは、オフィス画面を描く前に記録する。あとに置くと描画に間に合わず、
     次に画面が描き直されるまで「特記事項なし」のままになる。 */
  recordOfficeEvent('redial', customerLabel(t, true) + 'から再着信しています。');
  leaveCallForOffice();
}

/* ---------- TGX 国際配送 ---------- */

function shipLevel(id){ return SHIP_LEVELS.find(x => x.id === id); }
function remedyNeedsShipping(id){ return SHIPPING_REMEDIES.has(id); }
function remedyBlockReason(t, remedy){
  if (remedy.kind === 'escalate' && state.escLeft <= 0) return 'エスカレーション枠を使い切っています';
  if (remedy.needsOutage && !state.outageKnown) return '障害の裏付けが取れていないため、この案内はできません';
  if (remedy.needsCarrierRestored && !t.carrierRestored) return '現地キャリアから再開通完了の連絡がまだ届いていません';
  if (remedy.needsTest){
    const required = remedy.needsTestCount || 1;
    const count = t.testCounts.get(remedy.needsTest) || 0;
    if (count < required) return '先に「伝える」→「やってみてもらう」を ' + required + '回行ってください（現在 ' + count + '回）';
  }
  const missing = (remedy.requiresQuestions || []).filter(id => !t.asked.has(id));
  if (missing.length) return '配送判断に必要な聞き取りが不足しています';
  if (remedyNeedsShipping(remedy.id) && !hotelContactKnown(t)) return '配送先が未確認です。先にホテル名と滞在先を確認してください';
  if (remedy.requiresLongStay && (!t.stayDaysKnown || t.s.stayDays < remedy.requiresLongStay)) return '残り滞在期間が短く、到着後に使える期間が足りません';
  if (remedy.requiresConsent && (!t.replacementConsentKnown || !t.s.wantsReplacement)) return 'お客様の代替機配送希望を確認できていません';
  return '';
}

function chooseRemedy(remedyId){
  const t = state.focus;
  const remedy = (REMEDIES[state.ui.cause] || []).find(item => item.id === remedyId);
  const blocked = remedy && remedyBlockReason(t, remedy);
  if (blocked){ render(); return; }
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
  if (!hotelContactKnown(t)){
    t.transcript.push({ who:'note', text:'配送先が未確認です。手配を中断してホテル名と滞在先を確認します。' });
    if (!spendOnCall(t, 2, 0)) return;
    state.ui = defaultUi('ask');
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
  t.transcript.push({ who:'note', text:'TGX ' + level.label + 'の手配を確定しました。追跡番号：' + t.shipment.awb });
  state.ui.shipping = null;
  render();
}

/* ---------- クローズ判定 ---------- */

/* §51-2: 解決したあと、電話を切るまでの間に名前を伺える。用は済んでいるので、
   怒っていた客も答える。伺えれば記録が残せるので、記録不足の減点を返す。
   戻すだけで加点はしない——最初から聞いていた対応と同じ点に戻るだけ。 */
function askLateName(){
  const t = state.focus;
  if (!t || !t.pendingResult || t.nameKnown) return;
  pushCustomerLine(t, LATE_NAME_REPLIES[t.s.type].replace('{name}', t.s.name), { plain:true });
  t.nameKnown = true;
  t.identified = identificationReady(t);
  if (t.pendingResult.identityRecordMissing){
    t.pendingResult.identityRecordMissing = false;
    t.pendingResult.csat = clamp(Math.round((t.pendingResult.csat + IDENTITY_RECORD_PENALTY) * 10) / 10, 1.0, 5.0);
  }
  state.ui = defaultUi();
  render();
}

function finishSuccessfulClose(t, remedy, causeId, remedyId, causeMatched){
  const s = t.s;
  if (remedy.cost) state.cost += remedy.cost;
  if (remedy.kind === 'escalate'){ state.escLeft--; t.escUsed = true; }

  let bestId = s.best;
  if (s.bestNoOutage && !state.outageKnown) bestId = s.bestNoOutage;

  let base, grade;
  if (!causeMatched){ base = 5.0; grade = 'best'; }
  else if (remedyId === bestId){ base = 5.0; grade = 'best'; }
  else if ((s.partial || []).includes(remedyId)){ base = 3.5; grade = 'partial'; }
  else { base = 2.2; grade = 'poor'; }

  /* §51-2: 記録に残すのは名前。社内システムを開く鍵（契約番号、または氏名＋渡航先）とは
     目的が違うので、判定を名前に絞る。苛立ちによる免除は置かない——解決したあとなら
     怒っていた客でも名前は答えるので、聞かなかったことの言い訳にならない（§51-1）。 */
  const identityRecordMissing = !t.nameKnown;
  if (identityRecordMissing) base -= IDENTITY_RECORD_PENALTY;
  base -= t.damage;
  base -= t.misdiagnoses * 1.2;
  base -= Math.min(0.6, t.wasted * 0.1);
  base -= patiencePenalty(t.patience);
  base -= holdPenalty(t.holdMinutes);
  base -= stressPenalty(t.stress);
  if (t.callbackCount > 0) base -= t.callbackLate ? 1.5 : 0.2;
  base -= t.callbackPenalty || 0;
  if (t.shipment && t.shipment.remedyId === remedyId && t.shipment.tooSlow) base -= 1.0;
  if (t.shipment && t.s.deliveryAddress && !t.deliveryAddressConfirmed) base -= 1.0;

  const csat = clamp(Math.round(base * 10) / 10, 1.0, 5.0);
  const result = { kind:'closed', csat, grade, remedyId, causeId, identityRecordMissing,
    causeMatched, firstCallResolved:grade === 'best' && t.callbackCount === 0 && t.misdiagnoses === 0, label:gradeLabel(grade) };
  const resolutionReply = remedy.reportsRestored
    ? '原因まで分かって安心しました。回線を戻していただき、ありがとうございました。'
    : causeMatched ? closingLine(s, grade) : 'あ、繋がりました。これで使えそうです。';
  pushCustomerLine(t, resolutionReply, { plain:true });
  pushFlowLines(t, [{ who:'me', text:resolutionOperatorClosing(grade, causeMatched) }]);
  pushCustomerLine(t, farewellLine(s, grade), { plain:true });
  t.pendingResult = result;
  t.transcript.push({ who:'note', text:'対応結果が確定しました。電話を切って終話してください。' });
  state.ui = defaultUi();
  render();
}

function finishDeferredArrangement(t, remedy, causeId, remedyId, causeMatched){
  if (remedy.cost) state.cost += remedy.cost;
  if (remedy.kind === 'escalate'){ state.escLeft--; t.escUsed = true; }
  pushFlowLines(t, [
    { who:'cust', text:CALL_FLOW_LINES.unverifiable.closing[t.s.type] },
    { who:'me', text:'手配内容を記録しました。結果が分かりましたら、あらためてご連絡ください。失礼いたします。' },
  ]);
  t.pendingResult = {
    kind:'deferred', csat:null, label:'手配完了（結果待ち）', remedyId, causeId, causeMatched,
    firstCallResolved:false,
  };
  t.transcript.push({ who:'note', text:'手配は完了しました。通信復旧の成否は、配送・引き継ぎ後に確認されます。' });
  state.ui = defaultUi();
  render();
}

function finishRemedyRefund(t, remedy, causeId, remedyId, causeMatched){
  const assessment = refundAssessment(t);
  const satisfied = refundSatisfied(t, assessment);
  state.cost += remedy.cost || REFUND_POLICY.amount;
  pushCustomerLine(t, satisfied
    ? '返金の件、分かりました。通信は戻っていませんが、今回は受け取ります。'
    : '返金されても通信は戻らないんですね…。これで終わりには納得できません。', { plain:true });
  pushFlowLines(t, [{ who:'me', text:satisfied ? CALL_FLOW_LINES.ending.refundSatisfied : CALL_FLOW_LINES.ending.refundDissatisfied }]);
  t.pendingResult = {
    kind:'refunded', satisfied, diagnosed:true, refundComplaint:!satisfied,
    csat:satisfied ? 2.5 : 1.0, label:satisfied ? '返金で終結（未解決）' : '返金で終結（不満）',
    remedyId, causeId, causeMatched, firstCallResolved:false,
  };
  state.ui = defaultUi();
  render();
}

function doClose(causeId, remedyId){
  const t = state.focus;
  const s = t.s;
  const remedy = (REMEDIES[causeId] || []).find(r => r.id === remedyId);
  if (!remedy) return;
  const blocked = remedyBlockReason(t, remedy);
  if (blocked){ render(); return; }

  t.transcript.push({ who:'me', text:remedy.label });
  if (!spendOnCall(t, 2, 0)) return;

  const causeMatched = causeId === s.trueCause;
  if (causeMatched) playClueSound();
  // 見立て違いのやり直し時間は選択内容で決まり、抽選結果では揺らさない。
  if (!causeMatched) advance(2);

  if (!t.symptomResolved && !causeMatched && s.contradicts && s.contradicts[causeId]){
    pushCustomerLine(t, s.contradicts[causeId]);
    if (!addStress(t, 12)){ render(); return; }
    t.state = 'open';
    state.ui = defaultUi();
    render();
    return;
  }

  if (!t.symptomResolved && remedy.outcomeMode === 'refund'){
    finishRemedyRefund(t, remedy, causeId, remedyId, causeMatched);
    return;
  }
  if (!t.symptomResolved && remedy.outcomeMode === 'arrangement'){
    finishDeferredArrangement(t, remedy, causeId, remedyId, causeMatched);
    return;
  }
  // 原因の大分類が同じでも、別案件用の対処では直らない。
  // 原因自体を外したときの「運で一時的に直る」経路だけは従来どおり残す。
  const scenarioRemedyMatched = !causeMatched || remedyMatchesScenario(s, remedyId);
  const explanationMatched = causeMatched && remedyMatchesScenario(s, remedyId);
  // 安全操作ですでに復旧している場合、ここで選ぶのは復旧操作の説明である。
  // 正しい説明を運で失敗へ戻さず、誤った説明を「偶然直った」扱いにもしない。
  const treatmentWorked = t.symptomResolved
    ? explanationMatched
    : scenarioRemedyMatched && (remedy.reportsRestored ? causeMatched && t.carrierRestored : treatmentSucceeds(causeMatched));

  // ---- 対処後も解決しない ----
  if (!treatmentWorked){
    const afterResolvedReply = t.symptomResolved ? CALL_FLOW_LINES.misdiagnosis.afterResolved[s.type] : '';
    if (!causeMatched){
      t.misdiagnoses++;
    }
    if (remedy.cost) state.cost += remedy.cost;
    if (remedy.kind === 'escalate'){ state.escLeft--; t.escUsed = true; }

    if (!causeMatched && t.misdiagnoses >= 2){
      pushFlowLines(t, [
        { who:'cust', text:afterResolvedReply || CALL_FLOW_LINES.misdiagnosis.failure },
        { who:'me', text:CALL_FLOW_LINES.misdiagnosis.apology },
      ]);
      t.pendingConversation = { kind:'second_misdiagnosis', reason:'misdiagnosis' };
      state.ui = defaultUi();
    } else {
      const noSignal = s.panel && (s.panel.bars === 0 || s.panel.sim === 'none');
      pushCustomerLine(t, afterResolvedReply || (noSignal
        ? CALL_FLOW_LINES.unverifiable.noSignal[s.type]
        : (causeMatched ? '試してみましたが、変わりません…。まだ繋がらないです。' : '言われたとおりにしましたが、やっぱり直りません。まだ繋がらないんですけど。')));
      if (!causeMatched) t.transcript.push({ who:'note', text:'原因の見立てが外れていました。もう一度切り分けをやり直せます。' });
      if (!addStress(t, 30)){ render(); return; }
      t.patience -= 20;
      t.state = 'open';
      state.ui = defaultUi();
    }
    render();
    return;
  }

  finishSuccessfulClose(t, remedy, causeId, remedyId, causeMatched);
}

function remedyMatchesScenario(scenario, remedyId){
  return remedyId === scenario.best || (scenario.partial || []).includes(remedyId);
}

function resolutionOperatorClosing(grade, causeMatched){
  if (!causeMatched) return CALL_FLOW_LINES.resolved.recovered;
  return grade === 'best' ? CALL_FLOW_LINES.resolved.best : CALL_FLOW_LINES.resolved.partial;
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

function closingLine(s, grade){
  if (grade === 'best'){
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
  render();
}

function finishResolvedWithoutExplanation(t){
  const identityRecordMissing = !t.nameKnown;
  const csat = clamp(Math.round((3.0 - (identityRecordMissing ? IDENTITY_RECORD_PENALTY : 0)) * 10) / 10, 1.0, 5.0);
  pushFlowLines(t, [{ who:'me', text:CALL_FLOW_LINES.interrupt }]);
  t.transcript.push({ who:'note', text:'通信は復旧済みですが、原因をご説明しないまま終話しました。' });
  closeTicket(t, {
    kind:'closed', csat, grade:'partial', causeId:t.s.trueCause, causeMatched:true,
    identityRecordMissing, firstCallResolved:t.callbackCount === 0 && t.misdiagnoses === 0,
    label:'復旧（原因説明なし）',
  });
  render();
}

/* §66: 「伝える」の先頭から確認なしで終話する。折り返し約束だけは専用の待機状態へ進める。 */
function endCurrentCall(t){
  if (!t || t.state !== 'open' || t.pendingResult) return;
  if (t.callbackPromised){
    pushFlowLines(t, [{ who:'me', text:CALL_FLOW_LINES.interrupt }]);
    finishPromisedCallback(t);
    return;
  }
  if (t.symptomResolved){
    finishResolvedWithoutExplanation(t);
    return;
  }
  interruptCall(t);
}

function redialOpening(t){
  return (t.s.type === 'anxious' || t.s.type === 'novice') ? REDIAL_OPENINGS.calm : REDIAL_OPENINGS.direct;
}

function interruptCall(t){
  if (!t || t.state !== 'open' || t.pendingResult) return;
  pushFlowLines(t, [{ who:'me', text:CALL_FLOW_LINES.interrupt }]);
  t.transcript.push({ who:'note', text:'オペレーターが対応途中で切断しました。' });
  t.pendingInterruption = true;
  finishInterruptedCall(t);
  /* 先に回線を切って再入電へ移す。苛立ち加算を先に行うと100到達時だけ
     顧客側の怒り終話画面を挟み、§66の即時終話ではなくなる。 */
  addStress(t, REDIAL_STRESS);
}

function finishInterruptedCall(t){
  if (!t || !t.pendingInterruption) return;
  t.pendingInterruption = false;
  t.redialCount++;
  t.state = 'waiting';
  t.arrivedTurn = state.turn;
  t.greeted = false;
  t.redialOpening = redialOpening(t);
  t.redialSpoken = false;
  t.redialGreeting = true;
  state.focus = null;
  state.ui = defaultUi();
  playDisconnectSound();
  recordOfficeEvent('redial', customerLabel(t, true) + 'から再着信しています。');
  enterOffice();
}

function closeTicket(t, result){
  t.complaintEmail = complaintEmailArrives(result);
  t.misdiagnosisEmail = t.complaintEmail && misdiagnosisResurfaces(result);
  t.gratitudeEmail = !t.complaintEmail && gratitudeEmailArrives(result);
  t.refundComplaint = Boolean(result.refundComplaint);
  t.state = 'closed';
  t.result = result;
  if (!Array.isArray(t.attempts)) t.attempts = [];
  t.attempts.push({ ...result, atTurn:state.turn, arrivedTurn:t.arrivedTurn });
  playDisconnectSound();
  playCloseJingle(result);
  const scoreText = Number.isFinite(result.csat) ? ' CSAT ' + result.csat.toFixed(1) : '';
  recordOfficeEvent('closed', t.s.id + '：' + result.label + scoreText);
  if (state.focus === t) state.focus = null;
  state.ui = defaultUi();
  checkShiftEnd();
  if (state.phase === 'office') return;
}

/* §50: 一夜の評価は、その場と後からの2つある。誤診はその場では気づかれない——
   症状が消えているので客は満足して切る——が、原因が違うので翌日に再発する。
   その場の CSAT は書き換えない。「満点だった」ことと「後から発覚した」ことは、
   どちらも起きた事実として残す。 */
function misdiagnosisResurfaces(result){
  return (result.kind === 'closed' || result.kind === 'refunded' || result.kind === 'deferred') && result.causeMatched === false;
}

function complaintEmailArrives(result, flags = GAME_FLAGS){
  if (result.kind === 'complaint' || result.kind === 'hangup') return true;
  if (result.refundComplaint) return true;
  if (misdiagnosisResurfaces(result)) return true;
  return (result.kind === 'closed' || result.kind === 'refunded') && result.csat < 2
    ? (flags.luckRate === 1 ? true : state.random() < LOW_CSAT_COMPLAINT_RATE)
    : false;
}

/* §50-4: 原因を当て、最適な対処を選び、折り返しも誤診もなく初回で終えた夜にだけ届く。
   4分の1の確率でしか来ないので、来たときに嬉しい。全案件に何か届くと、届いたことの
   意味がなくなる。 */
function gratitudeEmailArrives(result, flags = GAME_FLAGS){
  if (result.kind !== 'closed') return false;
  if (!result.causeMatched || result.grade !== 'best' || !result.firstCallResolved || result.csat < 4.5) return false;
  return flags.luckRate === 1 ? true : state.random() < GRATITUDE_RATE;
}

function causeName(id){
  const c = CAUSES.find(x => x.id === id);
  return c ? c.label : id;
}

function checkShiftEnd(){
  if (state.clock >= SHIFT_END) finishShiftAtTime();
  else enterOffice();
}
