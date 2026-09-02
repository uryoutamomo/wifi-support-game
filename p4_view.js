/* ============================================================
   描画
   ============================================================ */

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let typeTimer = null;
let typingLine = null;
let endingRevealTimer = null;
let tapGuardTimer = null;
let endingTapGuard = false;
let officeRingTimer = null;
let officeRingLit = false;
let audioContext = null;

function initAudio(){
  try {
    if (audioContext) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) audioContext = new AudioContextClass();
  } catch (error){ audioContext = null; }
}

function withAudio(makeSound){
  if (!GAME_FLAGS.soundEnabled || !audioContext) return;
  try {
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    makeSound(audioContext, clamp(GAME_FLAGS.soundVolume, 0, 1));
  } catch (error){ /* 音が出せなくてもゲーム進行は続ける */ }
}

function synthTone(ctx, volume, frequency, delay, duration, options = {}){
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  const start = ctx.currentTime + delay;
  const end = start + duration;
  oscillator.type = options.type || 'sine';
  oscillator.frequency.setValueAtTime(frequency, start);
  if (options.endFrequency) oscillator.frequency.exponentialRampToValueAtTime(options.endFrequency, end);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * (options.level || 0.12)), start + Math.min(0.02, duration / 3));
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  oscillator.connect(gain); gain.connect(ctx.destination);
  oscillator.start(start); oscillator.stop(end + 0.02);
}

function playOfficeRing(){ withAudio((ctx, volume) => synthTone(ctx, volume, 400, 0, .22, {type:'sine',level:.1})); }
function playPickupSound(){ withAudio((ctx, volume) => { synthTone(ctx, volume, 1150, 0, .035, {type:'square',level:.08}); synthTone(ctx, volume, 520, .04, .045, {type:'square',level:.07}); }); }
function playDisconnectSound(){ withAudio((ctx, volume) => { synthTone(ctx, volume, 400, 0, .18, {level:.07}); synthTone(ctx, volume, 400, .28, .18, {level:.07}); }); }
function playTypeSound(index){ if (index % 4) return; withAudio((ctx, volume) => synthTone(ctx, volume, 760 + (index % 3) * 35, 0, .018, {type:'square',level:.025})); }
function playCommandSound(){ withAudio((ctx, volume) => synthTone(ctx, volume, 880, 0, .045, {type:'square',level:.055})); }
function playStressWarning(){ withAudio((ctx, volume) => { synthTone(ctx, volume, 980, 0, .11, {type:'square',level:.12}); synthTone(ctx, volume, 980, .17, .11, {type:'square',level:.12}); }); }
function playClueSound(){ withAudio((ctx, volume) => { synthTone(ctx, volume, 660, 0, .07, {level:.06}); synthTone(ctx, volume, 880, .08, .1, {level:.07}); }); }
function playBadActionSound(){ withAudio((ctx, volume) => { synthTone(ctx, volume, 155, 0, .42, {type:'sawtooth',level:.1,endFrequency:105}); synthTone(ctx, volume, 164, 0, .36, {type:'square',level:.045,endFrequency:110}); }); }

function closeSoundKind(result){
  if (result.kind === 'complaint' || result.kind === 'hangup') return 'accident';
  if (result.kind === 'abandoned' || result.csat < 2) return 'failure';
  if (result.csat >= 4) return 'fanfare';
  if (result.csat >= 3) return 'success';
  return 'neutral';
}

function playCloseJingle(result){
  const kind = closeSoundKind(result);
  withAudio((ctx, volume) => {
    if (kind === 'fanfare') [[523,0,.1],[659,.1,.1],[784,.2,.1],[1047,.3,.32]].forEach(([f,d,n]) => synthTone(ctx, volume, f, d, n, {type:'square',level:.09}));
    else if (kind === 'success') [[784,0,.1],[1047,.11,.2]].forEach(([f,d,n]) => synthTone(ctx, volume, f, d, n, {type:'square',level:.075}));
    else if (kind === 'neutral') synthTone(ctx, volume, 440, 0, .18, {type:'triangle',level:.065});
    else if (kind === 'failure') [[294,0,.24],[220,.2,.32],[147,.45,.5]].forEach(([f,d,n]) => synthTone(ctx, volume, f, d, n, {type:'sawtooth',level:.08}));
    else {
      synthTone(ctx, volume, 155.56, 0, 1.2, {type:'sawtooth',level:.105,endFrequency:82});
      synthTone(ctx, volume, 164.81, 0, 1.2, {type:'square',level:.085,endFrequency:87});
    }
  });
}

function playShiftEndSound(){ withAudio((ctx, volume) => [[392,0,.16],[523,.18,.16],[659,.36,.16],[784,.54,.48]].forEach(([f,d,n]) => synthTone(ctx, volume, f, d, n, {type:'triangle',level:.065}))); }
function playPromotionSound(){ withAudio((ctx, volume) => [[523,0,.12],[659,.13,.12],[784,.26,.12],[1047,.39,.42]].forEach(([f,d,n]) => synthTone(ctx, volume, f, d, n, {type:'square',level:.08}))); }
function playBadgeSound(){ withAudio((ctx, volume) => [[880,0,.07],[1175,.08,.13]].forEach(([f,d,n]) => synthTone(ctx, volume, f, d, n, {type:'triangle',level:.065}))); }
function playCareerEndingSound(){ withAudio((ctx, volume) => [[392,0,.2],[523,.2,.2],[659,.4,.2],[784,.6,.2],[1047,.8,.28],[1319,1.08,.65]].forEach(([f,d,n]) => synthTone(ctx, volume, f, d, n, {type:'triangle',level:.085}))); }

function typewriterOff(){ return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }

function finishTyping(skipEndingBeat = true){
  if (!typingLine) return;
  if (state.phase === 'ending' && endingTapGuard){
    return;
  }
  clearTimeout(typeTimer);
  typingLine.typed = true;
  typingLine = null;
  document.body.classList.remove('typing');
  if (state.phase === 'ending'){ renderCareerEndingComplete(skipEndingBeat); return; }
  const t = state.focus;
  if (t && advanceConversationFlow(t)) return;
  renderCall();
}

function startTyping(t){
  if (typingLine) return;
  const line = pendingTypedLine(t);
  if (!line) return;
  if (typewriterOff()){
    line.typed = true;
    if (state.phase === 'ending'){ renderCareerEndingComplete(true); return; }
    if (advanceConversationFlow(t)) return;
    renderCall();
    return;
  }
  typingLine = line;
  document.body.classList.add('typing');
  const say = document.querySelector('.line.typing .say');
  if (!say) return finishTyping(false);
  let pos = 0;
  const step = () => {
    if (typingLine !== line) return;
    pos++;
    say.textContent = line.text.slice(0, pos);
    playTypeSound(pos);
    if (pos >= line.text.length){ finishTyping(false); return; }
    typeTimer = setTimeout(step, /[、。！？!?]/.test(line.text[pos - 1]) ? 175 : 25);
  };
  typeTimer = setTimeout(step, 25);
}

function render(){
  if (state.phase === 'office'){ renderOffice(); return; }
  if (state.phase === 'desk'){ renderDesk(); return; }
  if (state.phase !== 'call') return;
  $('clock').textContent = fmtClock(state.clock);
  renderWorldStrip();
  renderQueue();
  renderCall();
  renderBoard();
}

function metrics(){
  const finished = state.tickets.filter(t => t.result);
  const answered = finished.filter(t => t.result.kind !== 'abandoned');
  const abandoned = finished.filter(t => t.result.kind === 'abandoned').length;
  const csats = answered.map(t => t.result.csat);
  const csat = csats.length ? csats.reduce((a,b) => a+b, 0) / csats.length : null;
  const fcrCount = answered.filter(t => t.result.firstCallResolved).length;
  const fcr = answered.length ? fcrCount / answered.length : null;
  const answerRate = (state.tickets.length - abandoned) / state.tickets.length;
  const handled = state.tickets.filter(t => t.callMinutes > 0);
  const aht = handled.length ? handled.reduce((n,t) => n + t.callMinutes, 0) / handled.length : null;
  return { finished, answered, abandoned, csat, fcrCount, fcr, answerRate, aht };
}

function renderWorldStrip(){
  const strip = $('world-strip');
  if (!strip) return;

  const stops = [];
  for (let i = 0; i <= 48; i++){
    const offset = -12 + i / 2;
    const pos = i / 48 * 100;
    stops.push('color-mix(in srgb, var(--amber) ' + daylightMix(offset) + '%, var(--panel-3)) ' + pos.toFixed(2) + '%');
  }

  const seen = new Map();
  const pins = state.tickets.filter(t => t.destinationKnown).map(t => {
    const utcOffset = 9 + t.s.localOffset;
    const pos = clamp((utcOffset + 12) / 24 * 100, 0, 100);
    const key = pos.toFixed(3);
    const stack = seen.get(key) || 0;
    seen.set(key, stack + 1);

    let cls = 'closed';
    if (t.state === 'waiting') cls = 'waiting';
    else if (t.state === 'open') cls = 'active';
    else if (t.state === 'callback') cls = 'callback';
    else if (t.result && t.result.kind === 'abandoned') cls = 'abandoned';

    const status = cls === 'waiting' ? '待ち中' : cls === 'active' ? '通話中' : cls === 'callback' ? '現地キャリア照会中' : cls === 'abandoned' ? '放棄呼' : '完了';
    return '<span class="world-pin ' + cls + '" style="left:' + pos.toFixed(2) + '%;--stack:' + stack + '" ' +
      'title="' + esc(t.s.city) + ' ' + esc(localClock(t)) + ' ' + status + '" aria-label="' + esc(t.s.city) + ' ' + status + '">' +
      '<i class="world-pin-dot"></i><span class="world-pin-label">' + esc(t.s.id) + '</span></span>';
  }).join('');

  strip.innerHTML =
    '<div class="world-sky" style="background:linear-gradient(90deg,' + stops.join(',') + ')"></div>' +
    '<div class="world-axis">' +
      '<span class="world-zone-label first">UTC−12</span>' +
      '<span class="world-zone-label mid">UTC</span>' +
      '<span class="world-zone-label last">UTC+12</span>' +
      '<span class="world-jst"><span>JST</span></span>' + pins +
    '</div>';
}

function renderQueue(){
  const q = state.tickets.filter(t => t.state === 'waiting')
    .sort((a,b) => a.arrivedTurn - b.arrivedTurn);
  const callbacks = state.tickets.filter(t => t.state === 'callback');
  const longest = q.length ? Math.max(0, ...q.map(t => state.turn - t.arrivedTurn)) : 0;
  $('queue-count').textContent = q.length + '件';
  $('call-summary').innerHTML = '<b>待ち ' + q.length + '件 ／ 最長 ' + longest + '分</b><br>現地キャリア照会中 <b>' + callbacks.length + '件</b><br><span class="hint-bar">通話中は個別の電話を取れません。保留時間と待ち行列を見比べて判断してください。</span>';
  $('queue-hint').innerHTML = '終話後はオフィスで、新しい電話を取るか、照会結果が出た相手へ電話をかけます。';
}

function pixelRect(ctx, color, x, y, width, height){
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
}

function drawCeilingLights(ctx, p){
  pixelRect(ctx, p.navy, 0, 0, 192, 34);
  for (let x = 0; x < 192; x += 48) pixelRect(ctx, p.blue, x, 0, 2, 34);
  pixelRect(ctx, p.blue, 0, 16, 192, 2);
  for (const y of [4, 21]){
    for (const x of [7, 55, 103, 151]){
      pixelRect(ctx, p.silver, x, y, 32, 9);
      pixelRect(ctx, p.white, x + 3, y + 2, 26, 5);
    }
  }
}

function drawBackWall(ctx, p){
  pixelRect(ctx, p.silver, 0, 34, 192, 35);
  pixelRect(ctx, p.gray, 0, 66, 192, 3);
  for (const x of [7, 36, 65, 94]){
    pixelRect(ctx, p.charcoal, x, 39, 25, 24);
    pixelRect(ctx, p.blue, x + 2, 41, 21, 20);
    for (let y = 44; y < 60; y += 4) pixelRect(ctx, p.silver, x + 2, y, 21, 1);
  }
  pixelRect(ctx, p.white, 128, 39, 55, 27);
  for (const x of [128, 146, 165]) pixelRect(ctx, p.gray, x, 39, 2, 27);
  for (const y of [47, 56]) pixelRect(ctx, p.gray, 128, y, 55, 2);
  pixelRect(ctx, p.paper, 115, 60, 12, 5);
  pixelRect(ctx, p.white, 118, 57, 9, 3);
  pixelRect(ctx, p.paper, 176, 34, 9, 5);
}

function drawDeskIslands(ctx, p){
  pixelRect(ctx, p.carpet, 0, 69, 192, 99);
  for (let x = 0; x < 192; x += 24) pixelRect(ctx, p.carpetShade, x, 69, 1, 99);
  for (let y = 69; y < 168; y += 20) pixelRect(ctx, p.carpetShade, 0, y, 192, 1);
  pixelRect(ctx, p.charcoal, 15, 82, 162, 4);
  pixelRect(ctx, p.silver, 17, 86, 158, 12);
  pixelRect(ctx, p.gray, 17, 98, 158, 3);
  pixelRect(ctx, p.charcoal, 15, 122, 162, 4);
  pixelRect(ctx, p.silver, 17, 126, 158, 13);
  pixelRect(ctx, p.gray, 17, 139, 158, 3);
  pixelRect(ctx, p.blue, 18, 103, 156, 5);
  pixelRect(ctx, p.navy, 18, 108, 156, 2);
}

function drawOfficeStation(ctx, p, station, ringLit){
  const x = station.x;
  const y = station.y;
  const screen = station.active ? p.glow : p.black;
  pixelRect(ctx, p.charcoal, x + 3, y - 13, 20, 12);
  pixelRect(ctx, screen, x + 5, y - 11, 16, 8);
  if (station.active) pixelRect(ctx, p.white, x + 7, y - 9, 5, 2);
  pixelRect(ctx, p.charcoal, x + 11, y - 1, 4, 4);
  pixelRect(ctx, p.charcoal, x + 7, y + 3, 12, 2);
  const phoneColor = station.active && ringLit ? p.red : p.charcoal;
  pixelRect(ctx, phoneColor, x + 27, y - 6, 9, 7);
  pixelRect(ctx, station.active && ringLit ? p.amber : p.black, x + 29, y - 4, 5, 2);
  pixelRect(ctx, p.paper, x + 29, y + 3, 8, 3);
  pixelRect(ctx, p.charcoal, x + 2, y + 7, 11, 15);
  pixelRect(ctx, p.gray, x + 4, y + 9, 7, 3);
  pixelRect(ctx, p.gray, x + 4, y + 13, 7, 3);
  pixelRect(ctx, p.gray, x + 4, y + 17, 7, 3);
  pixelRect(ctx, p.navy, x + 20, y + 12, 15, 9);
  pixelRect(ctx, p.black, x + 22, y + 21, 11, 3);
  pixelRect(ctx, p.black, x + 20, y + 24, 3, 3);
  pixelRect(ctx, p.black, x + 32, y + 24, 3, 3);
}

function drawOfficePixelArt(ringLit = false, canvasId = 'office-canvas', palette = OFFICE_PALETTE){
  const canvas = $(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  const p = palette;
  pixelRect(ctx, p.ink, 0, 0, canvas.width, canvas.height);
  drawCeilingLights(ctx, p);
  drawBackWall(ctx, p);
  drawDeskIslands(ctx, p);
  OFFICE_STATIONS.forEach(station => drawOfficeStation(ctx, p, station, ringLit));
}

function drawMorningStaffMember(ctx, p, staff){
  const x = staff.x, y = staff.y;
  const coat = p[staff.coat];
  const hair = p[staff.hairColor];
  const bodyX = x - Math.floor(staff.shoulders / 2);
  // 全員が奥の社長を見る後ろ姿。顔は置かず、後頭部・肩・背中・立ち脚だけを描く。
  pixelRect(ctx, p.paper, x - 3, y - 17, 7, 8);
  if (staff.hair === 'short'){
    pixelRect(ctx, hair, x - 4, y - 19, 9, 5);
    pixelRect(ctx, hair, x - 4, y - 15, 2, 4);
    pixelRect(ctx, hair, x + 3, y - 15, 2, 4);
  } else if (staff.hair === 'bob'){
    pixelRect(ctx, hair, x - 4, y - 19, 9, 10);
    pixelRect(ctx, p.paper, x - 2, y - 15, 5, 5);
  } else {
    pixelRect(ctx, hair, x - 4, y - 19, 9, 14);
    pixelRect(ctx, p.paper, x - 2, y - 15, 5, 5);
  }
  pixelRect(ctx, p.paper, x - 1, y - 9, 3, 3);
  pixelRect(ctx, coat, bodyX, y - 7, staff.shoulders, 13);
  pixelRect(ctx, p[staff.coat] === p.white ? p.silver : p.navy, x, y - 5, 1, 9);
  pixelRect(ctx, p.black, bodyX + 1, y + 6, 3, 7);
  pixelRect(ctx, p.black, bodyX + staff.shoulders - 4, y + 6, 3, 7);
}

function drawMorningStaff(ctx, p){
  MORNING_STAFF.forEach(staff => drawMorningStaffMember(ctx, p, staff));
}

function drawCompanyPresident(ctx, p){
  const x = 160, y = 82;
  // 明るい頭頂部と、左右に分かれた濃い側頭部。上をつながないことで小さくても形を読む。
  pixelRect(ctx, p.gray, x + 3, y - 25, 5, 1);
  pixelRect(ctx, p.gray, x, y - 23, 2, 3);
  pixelRect(ctx, p.gray, x + 10, y - 23, 2, 3);
  pixelRect(ctx, p.paper, x + 1, y - 24, 9, 5);
  pixelRect(ctx, p.paper, x, y - 21, 11, 11);
  pixelRect(ctx, p.charcoal, x - 2, y - 21, 3, 8);
  pixelRect(ctx, p.charcoal, x + 10, y - 21, 3, 8);
  pixelRect(ctx, p.charcoal, x - 4, y - 10, 19, 22);
  pixelRect(ctx, p.white, x + 4, y - 8, 3, 12);
  pixelRect(ctx, p.amber, x + 5, y - 6, 2, 8);
  pixelRect(ctx, p.black, x + 2, y - 17, 2, 2);
  pixelRect(ctx, p.black, x + 8, y - 17, 2, 2);
  pixelRect(ctx, p.red, x + 4, y - 13, 4, 1);
}

function drawMorningOffice(){
  drawOfficePixelArt(false, 'ending-office-canvas', MORNING_OFFICE_PALETTE);
  const canvas = $('ending-office-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  drawMorningStaff(ctx, MORNING_OFFICE_PALETTE);
  drawCompanyPresident(ctx, MORNING_OFFICE_PALETTE);
}

function stopOfficeRing(){
  if (officeRingTimer !== null) clearInterval(officeRingTimer);
  officeRingTimer = null;
  officeRingLit = false;
}

function syncOfficeRing(ringing){
  stopOfficeRing();
  officeRingLit = Boolean(ringing);
  drawOfficePixelArt(officeRingLit);
  if (officeRingLit) playOfficeRing();
  if (!ringing) return;
  officeRingTimer = setInterval(() => {
    officeRingLit = !officeRingLit;
    if (state.phase !== 'office'){ stopOfficeRing(); return; }
    drawOfficePixelArt(officeRingLit);
    if (officeRingLit) playOfficeRing();
  }, 420);
}

function renderOffice(){
  document.body.classList.add('office-view');
  document.body.classList.remove('call-view');
  $('clock').textContent = fmtClock(state.clock);
  $('office-clock').textContent = fmtClock(state.clock);
  $('office-slogan').textContent = state.slogan;
  renderWorldStrip();
  const waiting = state.tickets.filter(t => t.state === 'waiting').sort((a,b) => a.arrivedTurn - b.arrivedTurn);
  const callbacks = state.tickets.filter(t => t.state === 'callback').sort((a,b) => a.callbackDue - b.callbackDue);
  const readyCallbacks = callbacks.filter(t => t.callbackDue <= state.clock);
  const redials = waiting.filter(t => t.redialOpening);
  const shipments = state.tickets.filter(t => t.shipment).length;
  $('office-phone').classList.toggle('ringing', waiting.length > 0);
  $('office-phone-status').textContent = redials.length
    ? '再着信 ' + redials.length + '件 ／ 着信 ' + waiting.length + '件'
    : waiting.length ? '着信 ' + waiting.length + '件' : '着信待ち';
  syncOfficeRing(waiting.length > 0);
  $('office-sv').classList.toggle('busy', state.escLeft === 0);
  $('office-sv-status').textContent = state.escLeft ? 'ESC枠 ' + state.escLeft + ' / ' + ESCALATIONS : '別件対応中';
  $('office-ship-status').textContent = '手配 ' + shipments + '件 ／ 費用 ¥' + state.tickets.reduce((n,t) => n + (t.shipment ? t.shipment.fee : 0), 0).toLocaleString('ja-JP');
  const callbackRemaining = callbacks.length ? Math.max(0, callbacks[0].callbackDue - state.clock) : 0;
  const queueCutoff = waiting.length ? Math.ceil(Math.min(...waiting.map(ticket => ticket.patience / 100 * ticket.s.abandonAfter))) : null;
  $('office-tray-status').textContent = callbacks.length ? '折り返し待ち ' + callbacks.length + '件 ／ ' + callbacks[0].s.id + 'まであと ' + callbackRemaining + '分' : '折り返し待ち 0件';
  const officeNotices = [];
  if (state.outageKnown) officeNotices.push(esc(state.outageRegion) + '：提携キャリアの広域障害<br>復旧見込み 未定');
  state.officeEvents.slice(-3).forEach(event => officeNotices.push(esc(event.text)));
  $('office-notice').innerHTML = officeNotices.length
    ? officeNotices.map(text => '<div class="notice">' + text + '</div>').join('')
    : '<div class="blank">特記事項なし</div>';
  $('office-answer').disabled = !waiting.length;
  $('office-answer-status').textContent = waiting.length ? '待ち ' + waiting.length + '件 ／ 最短あと ' + queueCutoff + '分で切断' : '待ち 0件';
  $('office-callback').disabled = !readyCallbacks.length;
  $('office-callback-status').textContent = callbacks.length
    ? (readyCallbacks.length ? '折り返し可能 ' + readyCallbacks.length + '件' : '照会中 ' + callbacks.length + '件 ／ ' + fmtClock(callbacks[0].callbackDue))
    : '折り返し 0件';
  $('office-desk').disabled = !callbacks.length;
  $('office-desk-status').textContent = callbacks.length ? '調査可能 ' + callbacks.length + '件' : '調査可能 0件';
}

function enterOffice(){
  state.phase = 'office';
  advanceIdleOffice();
  renderOffice();
  window.scrollTo(0, 0);
}
function enterCall(){
  stopOfficeRing();
  state.phase = 'call';
  document.body.classList.remove('office-view'); document.body.classList.add('call-view'); render();
  window.scrollTo(0, 0);
}
function enterDesk(){
  stopOfficeRing();
  state.phase = 'desk';
  document.body.classList.remove('office-view'); document.body.classList.add('call-view');
  renderDesk();
  window.scrollTo(0, 0);
}

/* 折り返し待ちの案件を、通話をつながずにデスク端末だけで調べる画面。 */
function renderDesk(){
  $('clock').textContent = fmtClock(state.clock);
  renderWorldStrip();
  renderQueue();
  $('line-state').textContent = '端末作業中';
  $('call').classList.remove('on-hold');
  const t = deskTicket();
  const list = deskTickets();
  if (!list.length){ closeDeskLookup(); return; }
  const head = '<div class="command-panel-head"><button class="command-back" data-desk="close">← オフィスへ戻る</button>' +
    '<div><span>DESK TERMINAL ／ 折り返し待ちの調査</span><b>' +
    (t ? esc(customerLabel(t, true)) + ' の社内照会' : 'どの案件を調べますか？') + '</b></div></div>';
  const body = t ? (state.desk.recordTicketId === t.s.id
    ? renderCustomerRecord(t, false) + renderDeskLookupOptions(t, list)
    : renderDeskLookupOptions(t, list)) : renderDeskTicketChoice(list);
  $('call').innerHTML = renderDeskHeader(t || list[0]) +
    '<div class="transcript recent" id="transcript">' + renderTranscript(t || list[0], false) + '</div>' +
    '<div class="actions">' + head + body + '</div>';
  const box = $('transcript');
  if (box) box.scrollTop = box.scrollHeight;
  renderBoard();
}

/* 通話は切れているので、通話時間と通話料の代わりに折り返しの約束時刻を出す。 */
function renderDeskHeader(t){
  return '<div class="call-head">' +
      '<span class="call-ticket"><b>チケット</b> ' + esc(t.s.id) + '</span>' +
      '<span class="call-time">通話は切断中</span>' +
      '<span class="call-cost">折り返し ' + fmtClock(t.callbackDue) + '</span>' +
    '</div>';
}

function renderDeskTicketChoice(list){
  return '<div class="opts">' + list.map(t =>
    '<button class="opt" data-desk-ticket="' + t.s.id + '"><span class="opt-label">' + esc(customerLabel(t, true)) +
    '<span class="opt-sub">折り返しの約束 ' + fmtClock(t.callbackDue) + '</span></span></button>'
  ).join('') + '</div><p class="hint-bar">折り返しを待っているあいだ、通話をつながずに社内システムだけを調べられます。</p>';
}

function renderDeskLookupOptions(t, list){
  const back = list.length > 1
    ? '<button class="opt" data-desk-ticket="__back"><span class="opt-label">← 案件の選び直し</span></button>'
    : '';
  if (!identificationReady(t)){
    return back + '<p class="hint-bar">本人確認が済んでいないため、社内システムを開けません。折り返しの通話で確認してください。</p>';
  }
  const items = LOOKUPS.filter(l => !l.external).map(l =>
    '<button class="opt" data-desk-lookup="' + l.id + '" ' + (t.lookedUp.has(l.id) ? 'disabled' : '') +
    '><span class="opt-label">' + esc(l.label) + (t.lookedUp.has(l.id) ? '<span class="opt-sub">照会済み</span>' : '') +
    '</span><span class="cost">' + DESK_LOOKUP_MINUTES + '分</span></button>'
  ).join('');
  return '<div class="opts">' + back + items + '</div>' +
    '<p class="hint-bar">通話中ではないので、お客様の苛立ちは増えません。ただし時間は進むため、折り返しが約束より遅れることがあります。</p>';
}

function renderCall(){
  const t = state.focus;
  $('line-state').textContent = t ? '通話中' : '待機';
  $('call').classList.toggle('on-hold', !!(t && state.holdVisual));
  if (!t){
    $('call').innerHTML = '<div class="transcript"><p class="empty-note">' +
      'オフィスで電話を取るか、<br>約束した相手へ電話をかけてください。</p></div>';
    return;
  }

  $('call').innerHTML = renderCallHeader(t) + renderStressPanel(t) +
    '<div class="transcript recent" id="transcript">' + renderTranscript(t, false) + '</div>' + renderActions(t);

  const transcript = $('transcript');
  if (transcript) transcript.scrollTop = transcript.scrollHeight;
  startTyping(t);
}

function renderCallHeader(t){
  const outbound = t.callDirection === 'outbound';
  const payer = outbound ? '当社負担' : 'お客様負担';
  const cost = (t.callSegmentMinutes || 0) * CALL_RATE_PER_MIN;
  return '<div class="call-head">' +
      '<span class="call-ticket"><b>チケット</b> ' + esc(t.s.id) + '</span>' +
      '<span class="call-time">通話 ' + String(t.callSegmentMinutes || 0).padStart(2,'0') + '分</span>' +
      '<span class="call-cost">' + payer + ' ¥' + cost.toLocaleString('ja-JP') + '</span>' +
    '</div>';
}

function stressDisplayStage(value){
  if (value <= 50) return { label:'平静', className:'calm' };
  if (value <= 70) return { label:'苛立ち', className:'irritated' };
  if (value <= 90) return { label:'怒り', className:'angry' };
  return { label:'限界', className:'limit' };
}

function renderStressPanel(t){
  if (!customerHasSpoken(t)){
    return '<section class="stress-panel unknown" aria-label="顧客の苛立ちはまだ分かりません">' +
      '<div class="stress-panel-head"><span>顧客の苛立ち</span><b>—</b><strong>まだ不明</strong></div>' +
      '<i class="stress-track"><b class="stress-fill" style="width:0%"></b></i></section>';
  }
  const stage = stressDisplayStage(t.stress);
  return '<section class="stress-panel ' + stage.className + (t.stress > 80 ? ' alert' : '') + '" aria-label="顧客の苛立ち ' + Math.round(t.stress) + 'パーセント ' + stage.label + '">' +
    '<div class="stress-panel-head"><span>顧客の苛立ち</span><b>' + Math.round(t.stress) + '%</b><strong>' + stage.label + '</strong></div>' +
    '<i class="stress-track"><b class="stress-fill" style="width:' + t.stress + '%"></b></i></section>';
}

function recentTranscriptLines(t){
  const pending = pendingTypedLine(t);
  const end = pending ? t.transcript.indexOf(pending) + 1 : t.transcript.length;
  const delivered = t.transcript.slice(0, end);
  let latestLookupIndex = -1;
  for (let i = delivered.length - 1; i >= 0; i--){
    if (delivered[i].who === 'sys' && delivered[i].lookupTitle){ latestLookupIndex = i; break; }
  }
  if (latestLookupIndex >= 0){
    const afterLookup = delivered.slice(latestLookupIndex + 1);
    const customerAfter = afterLookup.some(line => line.who === 'cust');
    const playerAfter = afterLookup.slice().reverse().find(line => line.who === 'me');
    if (!customerAfter && playerAfter) return [delivered[latestLookupIndex], playerAfter];
  }
  const spoken = t.transcript.slice(0, end).filter(line => line.who === 'cust' || line.who === 'front' || line.who === 'me');
  if (spoken.length && spoken[spoken.length - 1].who === 'me'){
    const player = spoken[spoken.length - 1];
    const customer = spoken.slice(0, -1).reverse().find(line => line.who === 'cust' || line.who === 'front');
    return customer ? [customer, player] : [player];
  }
  let customerIndex = -1;
  for (let i = spoken.length - 1; i >= 0; i--){
    if (spoken[i].who === 'cust' || spoken[i].who === 'front'){ customerIndex = i; break; }
  }
  if (customerIndex < 0) return spoken.slice(-1);
  const customer = spoken[customerIndex];
  const player = spoken.slice(0, customerIndex).reverse().find(line => line.who === 'me');
  return player ? [player, customer] : [customer];
}

function renderTranscript(t, full){
  const pending = pendingTypedLine(t);
  const lines = full ? t.transcript : recentTranscriptLines(t);
  return lines.map(l => {
    if ((l.who === 'cust' || l.who === 'front' || l.who === 'sys') && !l.typed && l !== pending) return '';
    const who = { cust:'客', front:'Front Desk', me:'あなた', sys:'社内システム', note:'メモ' }[l.who];
    const typing = l === pending;
    const lookupResult = l.who === 'sys' && l.lookupTitle;
    const roleClass = l.who === 'front' ? 'front cust' : l.who;
    const content = typing ? '' : lookupResult ? renderLookupSystemScreen(l) : esc(l.text) + (l.viz ? renderLookupViz(l.viz) : '');
    return '<div class="line ' + roleClass + (lookupResult ? ' lookup-result' : '') + (typing ? ' typing' : '') + '"><span class="who">' + who + '</span>' +
      '<span class="say">' + content + '</span></div>';
  }).join('');
}

function renderActions(t){
  if (state.busy){
    return '<div class="actions"><div class="pending-note">社内照会中です。通話はつながったまま、時間が自動で進みます。</div></div>';
  }
  if (state.ui.shipping) return '<div class="actions">' + renderCommandHead('国際配送の手配', '配送方法を選んでください。') + renderShipping(t) + renderHangupButton() + '</div>';

  if (t.pendingResult){
    if (pendingTypedLine(t)) return '<div class="actions"><div class="pending-note">お客様の最後の言葉を聞いています。</div></div>';
    return '<div class="actions">' + renderHangupButton('お客様との会話が終わりました。終話してください。', pendingResultButtonLabel(t.pendingResult)) + '</div>';
  }
  if (t.pendingInterruption) return '<div class="actions">' + renderHangupButton('こちらから通話を切ります。', 'オフィスへ戻る') + '</div>';
  if (state.ui.tab === 'hangup_confirm') return '<div class="actions">' + renderHangupConfirmation(t) + '</div>';
  if (state.ui.tab === 'refund_confirm') return '<div class="actions">' + renderRefundConfirmation() + '</div>';
  if (t.callbackStage === 'front_desk') return '<div class="actions">' + renderFrontDeskOptions(t) + '</div>';

  if (!t.greeted && !customerHasSpoken(t)) return '<div class="actions"><div class="command-box"><div class="command-title"><span>CALL</span><b>まず名乗ってください</b></div><button class="command-choice" data-greet="1"><span class="command-no">1</span><span class="command-copy"><b>名乗る</b><small>お電話ありがとうございます。グローバルデスクでございます</small></span></button></div>' + renderHangupButton() + '</div>';

  const tab = state.ui.tab || 'command';
  const actionClass = 'actions' + (pendingTypedLine(t) ? ' is-typing' : '');
  if (tab === 'command') return renderCommandMenu(t, actionClass);
  if (tab === 'ask'){
    const group = QUESTION_GROUPS.find(item => item.id === state.ui.askGroup);
    return '<div class="' + actionClass + '">' +
      renderCommandHead('聞く', group ? group.label : '何について聞きますか？', group ? 'ask' : 'command') +
      (group ? renderAskOptions(t, group) : renderAskGroups(t)) + renderHangupButton() + '</div>';
  }
  if (tab === 'tell'){
    return '<div class="' + actionClass + '">' + renderCommandHead('伝える', '何を伝えますか？') + renderTellOptions(t) + renderHangupButton() + '</div>';
  }

  const bodyByCommand = {
    lookup: () => renderLookupOptions(t),
    try: () => renderTestOptions(t),
    soothe: () => renderSootheOptions(t),
    apologize: () => renderApologyOptions(t),
    smalltalk: () => renderSmalltalkOptions(t, 'tell'),
    record: () => renderRecord(t),
    system_record: () => renderCustomerRecord(t, false),
    identity_denied: () => renderIdentityDenied(),
    close: () => renderCloseFlow(t),
  };
  const renderBody = bodyByCommand[tab] || bodyByCommand.close;
  const [command, prompt] = commandPrompt(tab);
  const backTarget = ['close','try','soothe','apologize'].includes(tab) ? 'tell' : 'command';
  return '<div class="' + actionClass + '">' + renderCommandHead(command, prompt, backTarget) + renderBody() + renderHangupButton() + '</div>';
}

function pendingResultButtonLabel(result){
  return result.kind === 'complaint' || result.kind === 'hangup' ? 'オフィスへ戻る' : '電話を切る';
}

function renderHangupButton(note, label = '電話を切る'){
  return '<div class="hangup-box">' + (note ? '<p>' + esc(note) + '</p>' : '') + '<button class="hangup-button" data-hangup="1">' + esc(label) + '</button></div>';
}

function unresolvedHangupGuide(t){
  const causeNarrowed = hotCauses(t).size === 1;
  const next = t.symptomResolved
    ? '症状は復旧しました。「伝える」→「対処を伝える」で原因をご説明すると、この電話を終われます。'
    : causeNarrowed
    ? 'まだ対処をお伝えしていません。「伝える」→「対処を伝える」で原因と対処を案内すると、この電話を終われます。'
    : 'まだ原因を絞れていません。「聞く」「調べる」で手がかりを集めると、対処を案内できるようになります。';
  return '<b>' + next + '</b><p>このまま切ると、お客様から再入電になります。</p>';
}

function renderHangupConfirmation(t){
  return '<div class="hangup-confirm">' + unresolvedHangupGuide(t) + '<div><button class="hangup-button" data-hangup-confirm="1">電話を切る</button><button class="command-back" data-hangup-cancel="1">対応に戻る</button></div></div>';
}

function renderRefundConfirmation(){
  return '<div class="hangup-confirm"><b>¥' + REFUND_POLICY.amount.toLocaleString('ja-JP') + 'の返金をご提案します。受け入れていただければ、この電話は終わります。よろしいですか？</b><div><button class="hangup-button" data-refund-confirm="1">返金を提案する</button><button class="command-back" data-refund-cancel="1">対応に戻る</button></div></div>';
}

function renderCommandMenu(t, actionClass){
  const choices = COMMAND_DEFS.map(c =>
    '<button class="command-choice" data-command="' + c.id + '" ' + (c.disabled ? 'disabled' : '') + '>' +
      '<span class="command-no">' + c.no + '</span><span class="command-copy"><b>' + c.label + '</b></span>' + (c.meta ? '<span class="command-meta">' + c.meta + '</span>' : '') +
    '</button>'
  ).join('');
  const optionalGreeting = !t.greeted && customerHasSpoken(t)
    ? '<button class="command-choice optional-greeting" data-greet="1"><span class="command-no">任意</span><span class="command-copy"><b>名乗る</b><small>急いでいるお客様には省略できます</small></span></button>'
    : '';
  const chargeHint = hotelCallbackOffered(t) && t.callChargeConcerned
    ? '<p class="hint-bar">お客様が国際通話料を気にしています。「伝える」→「ホテルへ折り返す」で通話料を止められます。</p>'
    : '';
  return '<div class="' + actionClass + '"><div class="command-box"><div class="command-title"><span>COMMAND</span><b>コマンドを選んでください</b></div>' + optionalGreeting + '<div class="command-grid">' + choices + '</div></div>' + chargeHint + renderHangupButton() + '</div>';
}

/* 折り返しはこちらから掛け直す行為なので、折り返し中の通話には出さない。 */
function hotelCallbackOffered(t){
  return t.callDirection !== 'outbound';
}

function hotelCallbackSub(t){
  if (!t.asked.has('q_stay') || !t.stayAddress) return '滞在先はまだ伺っていません。';
  return t.callChargeConcerned ? 'お客様が国際通話料を気にしています。' : '5分を超えそうなら、お客様の通話料を止められます。';
}

function renderFrontDeskOptions(t){
  const room = hotelRoom(t);
  const options = CALL_FLOW_LINES.frontDesk.options;
  const latestFront = t.transcript.slice().reverse().find(line => line.who === 'front');
  const frontContext = latestFront && latestFront.typed
    ? '<div class="line front cust front-desk-context"><span class="who">Front Desk</span><span class="say">' + esc(latestFront.text) + '</span></div>'
    : '';
  const roomChoice = room
    ? '<button class="opt" data-front-desk="room"><span class="opt-label">' + esc(options.room.replace('{room}', room)) + '</span></button>'
    : '';
  return frontContext + renderCommandHead('Front Desk', 'Please choose what to say in English.') + '<div class="opts front-desk-options">' +
    '<button class="opt" data-front-desk="guest" ' + (t.nameKnown ? '' : 'disabled') + '><span class="opt-label">' + esc(options.guest.replace('{name}', t.s.nameEn)) + '</span></button>' +
    roomChoice +
    '<button class="opt" data-front-desk="callback"><span class="opt-label">' + esc(options.callback) + '</span></button></div>';
}

function renderAskGroups(t){
  const groups = QUESTION_GROUPS.filter(group => group.questionIds.some(id => {
    const question = QUESTIONS.find(item => item.id === id);
    return question && (!question.needsDevice || t.s.deviceInHand);
  }));
  return '<div class="opts ask-groups">' + groups.map(group => {
    const availableIds = group.questionIds.filter(id => {
      const question = QUESTIONS.find(item => item.id === id);
      return question && (!question.needsDevice || t.s.deviceInHand);
    });
    const complete = availableIds.every(id => t.asked.has(id));
    return '<button class="command-choice ask-group-choice" data-ask-group="' + group.id + '" ' + (complete ? 'disabled' : '') + '><span class="command-copy"><b>' + esc(group.label) + '</b></span></button>';
  }).join('') + '</div>';
}

function renderAskOptions(t, group){
  const questions = group.questionIds.map(id => QUESTIONS.find(q => q.id === id)).filter(q => q && (!q.needsDevice || t.s.deviceInHand));
  return '<div class="opts">' + questions.map(q =>
    '<button class="opt" data-ask="' + q.id + '"><span class="opt-label">' + esc(q.label) + ((t.askCounts.get(q.id) || 0) ? '<span class="opt-sub">確認済み ' + t.askCounts.get(q.id) + '回</span>' : '') + '</span><span class="cost">' + (q.id === 'q_contract' && !t.asked.has(q.id) ? t.s.contractId.minutes : 1) + '分</span></button>'
  ).join('') + (group.id === 'customer' ? renderSmalltalkChoices(t, 'ask') : '') + '</div><p class="hint-bar">同じ質問もできますが、時間を使い、回答済みならお客様のストレスが大きく増えます。</p>';
}

function renderTellOptions(t){
  const entries = [
    { attrs:'data-tell="close"', body:'<span class="opt-label">対処を伝える<span class="opt-sub">原因を見立てて、対処をご案内します。</span></span>' },
    t.s.deviceInHand
      ? { attrs:'data-tell="try"', body:'<span class="opt-label">やってみてもらう<span class="opt-sub">機器や端末で試していただくことを選びます。</span></span>' }
      : null,
    t.refundProposalRejected
      ? null
      : { attrs:'data-refund="refund"', body:'<span class="opt-label">返金をご案内する</span><span class="cost">¥' + REFUND_POLICY.amount.toLocaleString('ja-JP') + '</span>' },
    ...(hotelCallbackOffered(t) ? [
      { attrs:'data-hotel-callback="immediate"', body:'<span class="opt-label">いますぐ折り返す<span class="opt-sub">すぐにこちらから掛け直します</span></span>' },
      { attrs:'data-hotel-callback="scheduled"', body:'<span class="opt-label">1時間後に折り返す<span class="opt-sub">確認のうえ掛け直します。' + esc(hotelCallbackSub(t)) + '</span></span>' },
    ] : []),
    { attrs:'data-tell="soothe"', body:'<span class="opt-label">気持ちを落ち着ける</span>' },
    { attrs:'data-tell="apologize"', body:'<span class="opt-label">お詫びする</span>' },
    { attrs:'data-tell="smalltalk"', body:'<span class="opt-label">一言かける</span>' },
  ].filter(Boolean);
  return '<div class="opts">' + entries.map((entry, index) =>
    '<button class="opt" ' + entry.attrs + '><span class="command-no">' + (index + 1) + '</span>' + entry.body + '</button>'
  ).join('') + '</div>';
}

function availableSmalltalkTopics(t){
  return (t.s.smalltalk || []).filter(topic => topicAvailable(t, topic));
}

function renderSmalltalkChoices(t, mode){
  return availableSmalltalkTopics(t).map(topic =>
    '<button class="opt smalltalk-choice" data-smalltalk="' + topic.id + '" data-smalltalk-mode="' + mode + '"><span class="opt-label">' + esc(mode === 'ask' ? topic.askLabel : topic.tellLabel) + '</span><span class="cost">1分</span></button>'
  ).join('');
}

function renderSmalltalkOptions(t, mode){
  const choices = renderSmalltalkChoices(t, mode);
  return choices
    ? '<div class="opts smalltalk-options">' + choices + '</div>'
    : '<p class="hint-bar">お客様が会話で触れた話題は、まだありません。</p>';
}

function renderLookupOptions(t){
  if (!state.ui.lookup){
    return '<div class="opts">' + LOOKUPS.map(l =>
      '<button class="opt" data-lookup="' + l.id + '" ' + (t.lookedUp.has(l.id) || t.carrierLookupStarted ? 'disabled' : '') + '><span class="opt-label">' + esc(l.label) + (l.external ? '<span class="opt-sub">社外へ再開通を依頼。通話を切り、30分後に折り返します</span>' : '') + '</span>' + (l.external ? '<span class="cost">30分</span>' : '') + '</button>'
    ).join('') + '</div><p class="hint-bar">照会項目を選んだあと、保留にするか話しながら調べるかを選びます。</p>';
  }
  const lookup = LOOKUPS.find(x => x.id === state.ui.lookup);
  if (lookup && lookup.external) return renderCarrierLookupOptions(t, lookup);
  return '<div class="opts"><button class="opt" data-lookup-back="1"><span class="opt-label">← 照会項目の選び直し</span></button>' +
    '<button class="opt" data-lookup-mode="hold"><span class="opt-label">保留にして調べる<span class="opt-sub">相手を待たせるが速い</span></span><span class="cost">2分</span></button>' +
    '<button class="opt" data-lookup-mode="talk"><span class="opt-label">話しながら調べる<span class="opt-sub">相手を待たせないが通話が長引く</span></span><span class="cost">3分</span></button></div><p class="hint-bar">照会: ' + esc(lookup.label) + '</p>';
}

function renderCarrierLookupOptions(t, lookup){
  const hotelReady = t.asked.has('q_stay');
  return '<div class="opts"><button class="opt" data-lookup-back="1"><span class="opt-label">← 照会項目の選び直し</span></button>' +
    '<button class="opt" disabled><span class="opt-label">保留にして調べる<span class="opt-sub">30分かかるため、通話をつないだままでは実行できません</span></span><span class="cost">不可</span></button>' +
    '<button class="opt" disabled><span class="opt-label">話しながら調べる<span class="opt-sub">社外への再開通依頼のため、通話継続では実行できません</span></span><span class="cost">不可</span></button></div>' +
    '<p class="hint-bar"><b>現地キャリアへ再開通を依頼します。30分ほどお時間をいただき、完了状況が分かり次第折り返します。</b><br>折り返し先を選ぶと、通話を終えて再開通依頼を始めます。</p>' +
    '<div class="opts"><button class="opt" data-callback-destination="hotel" ' + (hotelReady ? '' : 'disabled') + '><span class="opt-label">ホテルへ折り返す<span class="opt-sub">滞在先へ電話し、フロントを通して客室につないでもらいます</span></span><span class="cost">' + lookup.minutes + '分</span></button></div>' +
    (hotelReady ? '' : '<p class="hint-bar">ホテル客室は滞在先が未確認です。「聞く」で確認してください。</p>');
}

function simCleaningRecommended(t){
  return t.asked.has('q_lamp') && t.s.panel && t.s.panel.sim === 'none' && (t.testCounts.get('t_simout') || 0) < 2;
}

function renderTestOptions(t){
  const recommendCleaning = simCleaningRecommended(t);
  const availableTests = TESTS.filter(test => !test.needsDevice || t.s.deviceInHand);
  const availableRisky = RISKY.filter(test => !test.needsDevice || t.s.deviceInHand);
  const safe = availableTests.map(test => {
    const recommended = test.id === 't_simout' && recommendCleaning;
    const count = t.testCounts.get(test.id) || 0;
    return '<button class="opt ' + (recommended ? 'recommended' : '') + '" data-test="' + test.id + '">' +
      '<span class="opt-label">' + (recommended ? '● 推奨：' : '') + esc(test.label) + (test.sub ? '<span class="opt-sub">' + esc(test.sub) + '</span>' : '') + (count ? '<span class="opt-sub">実施済み ' + count + '回</span>' : '') + '</span><span class="cost">' + test.turns + '分</span></button>';
  }).join('');
  const risky = availableRisky.map(test =>
    '<button class="opt danger" data-test="' + test.id + '"><span class="opt-label">' + esc(test.label) + ((t.testCounts.get(test.id) || 0) ? '<span class="opt-sub">実施済み ' + t.testCounts.get(test.id) + '回</span>' : '') + '</span><span class="cost">' + test.turns + '分</span></button>'
  ).join('');
  return '<div class="opts">' + safe + (availableRisky.length ? '<p class="hint-bar" style="margin:6px 0 2px">— 以下は本体や端末の設定を壊しうる操作です —</p>' + risky : '') + '</div>' +
    '<p class="hint-bar">操作が終わるまで通話をつないだまま待ち、所要時間は自動で進みます。</p>';
}
function renderSootheOptions(t){
  return '<div class="opts">' + SOOTHES.map(s => '<button class="opt" data-soothe="' + s.id + '" ' + (s.needsFacts && t.facts.length < s.needsFacts ? 'disabled' : '') + '><span class="opt-label">' + esc(s.label) + '</span><span class="cost">1分</span></button>').join('') + '</div>';
}
function renderApologyOptions(t){
  return '<div class="opts">' + APOLOGIES.map(apology => {
    const count = t.apologies.get(apology.id) || 0;
    const sub = apology.kind === 'brief'
      ? '時間は使うが、不要でもストレスは増やさない'
      : '強く苛立っている相手には有効。平静な相手には大げさで逆効果';
    return '<button class="opt" data-apology="' + apology.id + '"><span class="opt-label">' + esc(apology.label) + '<span class="opt-sub">' + sub + (count ? ' ／ 実施済み ' + count + '回' : '') + '</span></span><span class="cost">' + apology.minutes + '分</span></button>';
  }).join('') + '</div>';
}
function recordValue(ready, value){ return ready ? esc(value) : '―― 未照会'; }
function lookupRecordValue(t, id, fallback){
  const lookup = LOOKUPS.find(item => item.id === id);
  return t.lookedUp.has(id) ? esc(fallback || ((t.s.lookups || {})[id] || {}).text || (lookup && lookup.defaultResult) || '照会結果なし') : '―― 未照会';
}
function renderCustomerRecord(t, includeLog){
  const identified = identificationReady(t);
  const gender = t.s.gender === 'female' ? '女性' : '男性';
  const base = '<section class="system-screen record-system-screen"><header><span>GLOBALDESK OPS</span><b>顧客レコード</b><em>社内システム</em></header><div class="record-system-body">' +
    '<section class="record-system-block"><h3>顧客情報</h3><div class="log-customer">' +
      '<p><b>お名前</b><span>' + recordValue(identified, t.s.name + ' ／ ' + gender + ' ／ ' + t.s.age + '歳') + '</span></p>' +
      '<p><b>渡航期間</b><span>' + recordValue(identified, t.s.tripDays + '日間（本日 ' + t.s.tripDay + '日目 ／ 残り ' + t.s.stayDays + '泊）') + '</span></p>' +
      '<p><b>渡航先国</b><span>' + recordValue(identified, t.s.country) + '</span></p>' +
      '<p><b>契約プラン</b><span>' + recordValue(identified, t.s.plan) + '</span></p>' +
      '<p><b>利用データ量</b><span>' + lookupRecordValue(t, 'l_plan') + '</span></p>' +
      '<p><b>貸出・配送</b><span>' + lookupRecordValue(t, 'l_ship') + '</span></p>' +
      '<p><b>エリア・機種</b><span>' + lookupRecordValue(t, 'l_area') + '</span></p>' +
      '<p><b>セッション履歴</b><span>' + lookupRecordValue(t, 'l_session') + '</span></p>' +
      '<p><b>障害情報</b><span>' + lookupRecordValue(t, 'l_outage') + '</span></p>' +
    '</div></section>';
  return '<div class="log-view">' + base + (includeLog ? renderRecordLog(t) : '') + '</div><footer>RECORD ／ VERIFIED</footer></section></div>';
}
function renderRecordLog(t){
  const ty = TYPES[t.s.type];
  const facts = t.facts.length
    ? '<ul>' + t.facts.map(fact => '<li>' + esc(fact.text) + '</li>').join('') + '</ul>'
    : '<p>まだ手がかりはありません。</p>';
  const remaining = remainingCauseCandidates(t);
  const candidateText = remaining.length
    ? remaining.map(cause => esc(cause.label)).join(' ／ ')
    : '候補なし';
  return '<section class="record-system-block"><h3>ログの手がかり</h3>' + facts + '<p class="log-candidates"><b>残っている原因の候補</b><span>' + candidateText + '</span></p></section>' +
    '<section class="record-system-block"><h3>次にできること</h3><p>' + esc(nextActionGuide(t)) + '</p></section>' +
    '<section class="record-system-block"><h3>会話の全履歴</h3><div class="record-system-transcript">' + renderRecordTranscript(t) + '</div></section>';
}
function renderRecord(t){
  return '<p class="hint-bar">1分かけてログを確認しています。お客様は通話口で待っています。</p>' + renderCustomerRecord(t, true);
}

function renderIdentityDenied(){
  return '<div class="log-view"><section class="system-screen record-system-screen identity-denied-screen denied"><header>' +
    '<span>GLOBALDESK OPS</span><b>本人確認</b><em>アクセス拒否</em></header>' +
    '<div class="record-denied-message"><b>本人確認が完了していません。</b>' +
    '<p>フルネームと渡航先、または契約IDを確認してください。</p></div>' +
    '<footer>ACCESS ／ DENIED</footer></section></div>';
}

function renderRecordTranscript(t){
  return t.transcript.map(line => {
    const who = { cust:'客', me:'あなた', sys:'社内システム', note:'メモ' }[line.who];
    const content = line.who === 'sys' && line.lookupTitle
      ? renderLookupSystemScreen(line)
      : esc(line.text) + (line.viz ? renderLookupViz(line.viz) : '');
    return '<div class="record-system-entry ' + line.who + '"><b>' + who + '</b><span>' + content + '</span></div>';
  }).join('');
}

function remainingCauseCandidates(t){
  const excluded = ruledOut(t);
  return CAUSES.filter(cause => !excluded.has(cause.id));
}

function nextActionGuide(t){
  const remaining = remainingCauseCandidates(t).length;
  if (!t.facts.length) return 'まだ手がかりがありません。まず「聞く」コマンドから始めてください。';
  if (remaining <= 2) return '候補が' + remaining + 'つまで絞れています。診断に進めます。';
  return '手がかりをもとに候補を絞り込み中です。聞き取りか社内照会を続けてください。';
}

function commandPrompt(tab){
  return {
    lookup:['調べる', state.ui.lookup ? 'どの方法で調べますか？' : '何を調べますか？'],
    try:['やってみてもらう', '何を試していただきますか？'],
    soothe:['気持ちを落ち着ける', 'どの言葉をかけますか？'],
    apologize:['お詫びする', 'どの深さでお詫びしますか？'],
    smalltalk:['一言かける', '会話に出た話題から選んでください'],
    record:['ログ', 'この通話の状況と全履歴'],
    identity_denied:['本人確認', '本人確認が必要です'],
    close:['対処を伝える', state.ui.cause ? 'どのように対処を伝えますか？' : '原因を選んでください'],
  }[tab] || ['コマンド', '次の行動を選んでください'];
}

function renderCommandHead(command, prompt, backTarget = 'command'){
  return '<div class="command-panel-head"><button class="command-back" data-command="' + backTarget + '">← もどる</button>' +
    '<div><span>COMMAND ／ ' + esc(command) + '</span><b>' + esc(prompt) + '</b></div></div>';
}

function renderCloseFlow(t){
  const ruled = ruledOut(t);
  const hot = hotCauses(t);

  if (!state.ui.cause){
    return '<div class="opts">' + CAUSES.map(c => {
      const out = ruled.has(c.id);
      const isHot = hot.has(c.id);
      return '<button class="opt ' + (out ? 'used' : '') + '" data-cause="' + c.id + '">' +
        '<span class="opt-label">' + (isHot ? '● ' : '') + esc(c.label) +
        '<span class="opt-sub">' + c.tier + (out ? ' ／ 集めた情報とは噛み合いません' : (isHot ? ' ／ 手がかりが指しています' : '')) + '</span></span>' +
        '</button>';
    }).join('') + '</div>' +
    '<p class="hint-bar">原因を選ぶと、その原因に対する対処が出ます。</p>';
  }

  const cause = CAUSES.find(c => c.id === state.ui.cause);
  const list = REMEDIES[state.ui.cause] || [];

  if (!state.ui.remedy){
    return '<div class="opts">' +
      '<button class="opt" data-cause="__back"><span class="opt-label">← 原因の選び直し</span></button>' +
      list.map(r => {
        const block = remedyBlockReason(t, r);
        const dis = Boolean(block);
        const sub = block || r.sub || '';
        return '<button class="opt ' + (r.kind === 'escalate' ? 'esc ' : '') + (dis ? 'has-block-reason' : '') + '" data-remedy="' + r.id + '" ' + (dis ? 'disabled' : '') + '>' +
          '<span class="opt-label">' + esc(r.label) + '<span class="opt-sub' + (dis ? ' remedy-block-reason' : '') + '">' + (dis ? '<b>前提不足</b>' : '') + esc(sub) + '</span></span>' +
          '<span class="cost">' + (r.cost ? '¥' + r.cost.toLocaleString('ja-JP') : '—') + '</span></button>';
      }).join('') + '</div>' +
      '<p class="hint-bar">診断: ' + esc(cause.label) + '</p>';
  }

  if (state.ui.remedy && remedyNeedsShipping(state.ui.remedy) && (!t.shipment || t.shipment.remedyId !== state.ui.remedy)){
    return '<div class="pending-note">配送手配を完了してから、客への案内を選びます。</div>';
  }

  const ty = TYPES[t.s.type];
  return '<div class="tone-row">' + TONES.map(tn =>
    '<button class="tone" data-tone="' + tn.id + '"><span class="tname">' + tn.name + '</span>' + esc(tn.sub) + '</button>'
  ).join('') + '</div>' +
  '<p class="hint-bar">相手は「' + esc(ty.label) + '」タイプです。' + esc(ty.note) + ' 相手に合わせて伝え方を選んでください。</p>';
}

function renderShipping(t){
  const ship = state.ui.shipping;
  const level = ship && shipLevel(ship.level);
  if (!level){
    return '<div class="shipment"><p class="eyebrow">TRANSGLOBE EXPRESS ／ TGX</p><h3>国際配送の手配</h3><p class="shipment-address">届け先：' + esc(t.stayAddress) + '</p><div class="opts">' + SHIP_LEVELS.map(x =>
      '<button class="opt" data-ship-level="' + x.id + '"><span class="opt-label">' + x.label + '<span class="opt-sub">' + x.eta + '</span></span><span class="cost">¥' + x.fee.toLocaleString('ja-JP') + '</span></button>'
    ).join('') + '</div></div>';
  }
  const eta = shipmentEta(t, level), awb = shipmentAwb(t);
  return '<div class="shipment"><p class="eyebrow">TRANSGLOBE EXPRESS ／ TGX</p><h3>送り状を確認</h3><div class="waybill"><div><b>AWB No.</b><span>' + awb + '</span></div><div><b>発送元</b><span>現地デポ（' + esc(t.s.city) + '）</span></div><div><b>届け先</b><span>' + esc(t.stayAddress) + '</span></div><div><b>内容品</b><span>レンタル用モバイルWiFiルーター 1台（返送予定品）</span></div><div><b>サービス</b><span>' + esc(level.label) + ' ／ ' + esc(level.eta) + '</span></div><div><b>到着目安</b><span>現地 ' + fmtClock(eta) + '</span></div></div><button class="btn-primary shipment-confirm" data-ship-confirm="1">TGXへ手配を確定する</button></div>';
}

function ruledOut(t){
  const s = new Set();
  t.facts.forEach(f => (f.out || []).forEach(c => s.add(c)));
  return s;
}
function hotCauses(t){
  const s = new Set();
  t.facts.forEach(f => (f.hot || []).forEach(c => s.add(c)));
  return s;
}

function renderLookupViz(v){
  const unlimited = v.max === null;
  const ratio = unlimited ? 72 : clamp(v.value / Math.max(v.max, 1) * 100, 0, 100);
  const over = !unlimited && v.value > v.max;
  const value = v.value.toLocaleString('ja-JP') + (v.unit ? ' ' + v.unit : '');
  const ceiling = unlimited ? '上限なし' : v.max.toLocaleString('ja-JP') + (v.unit ? ' ' + v.unit : '');
  return '<span class="lookup-viz">' +
    '<span class="lookup-viz-head"><span>' + esc(v.label) + '</span><b>' + esc(value) + ' / ' + esc(ceiling) + '</b></span>' +
    '<span class="lookup-viz-track"><i class="lookup-viz-fill ' + (over ? 'over' : unlimited ? 'unlimited' : '') + '" style="width:' + ratio + '%"></i></span>' +
    '<span class="lookup-viz-note">' + esc(v.note || '') + '</span></span>';
}

function lookupResultRows(text){
  const body = String(text || '').replace(/^\[[^\]]+\]\s*/, '').trim();
  return body.split(/\s*／\s*|\s*。\s*(?=\S)/).map(part => part.trim()).filter(Boolean).map(part => {
    const split = part.search(/[:：]/);
    if (split < 0) return { label:'', value:part.replace(/。$/, '') };
    return { label:part.slice(0, split).trim(), value:part.slice(split + 1).trim().replace(/。$/, '') };
  });
}

function renderLookupSystemScreen(line){
  const rows = lookupResultRows(line.text).map(row =>
    '<div class="lookup-system-row">' +
      (row.label ? '<b>' + esc(row.label) + '</b>' : '<b aria-hidden="true">—</b>') +
      '<span>' + esc(row.value) + '</span></div>'
  ).join('');
  const external = line.external
    ? '<em class="lookup-system-external">外部照会</em>'
    : '<em>社内システム</em>';
  return '<section class="system-screen lookup-system-screen' + (line.external ? ' external' : '') + '" data-lookup-screen="' + esc(line.lookupId || '') + '">' +
    '<header><span>GLOBALDESK OPS</span><b>' + esc(line.lookupTitle) + '</b>' + external + '</header>' +
    '<div class="lookup-system-fields">' + rows + '</div>' +
    (line.viz ? renderLookupViz(line.viz) : '') +
    '<footer>STATUS ／ COMPLETE</footer></section>';
}

function renderDevicePanel(t){
  const p = t.s.panel;
  const label = '<div class="device-label"><span>聞き取りメモ</span><span>' + esc(t.identified ? t.s.device : '機種未特定') + '</span></div>';

  if (!p){
    return '<div class="device-card">' + label +
      '<div class="lcd missing"><span class="lcd-placeholder"><b>端末未受取</b>本体の表示は確認できません</span></div></div>';
  }
  if (!t.asked.has('q_lamp')){
    return '<div class="device-card">' + label +
      '<div class="lcd obscured"><span class="lcd-placeholder"><b>本体の表示は未確認</b>「聞く」で表示を確認してください</span></div></div>';
  }

  const status = p.sim === 'none' ? 'No SIM' : p.bars === 0 ? '圏外 ／ SIM 認識あり' : 'SIM 認識あり';
  return '<div class="device-card listening-note">' + label + '<dl>' +
    '<div><dt>アンテナ</dt><dd>' + (p.bars === null ? '表示なし' : p.bars + '本') + '</dd></div>' +
    '<div><dt>表示</dt><dd>' + status + (p.throttle ? ' ／ 速度制限アイコンあり' : '') + '</dd></div>' +
    '<div><dt>事業者</dt><dd>' + esc(p.carrier || '表示なし') + '</dd></div>' +
    '<div><dt>接続台数</dt><dd>' + p.clients + ' / ' + p.maxClients + '</dd></div>' +
    '<div><dt>電池残量</dt><dd>' + p.battery + '%</dd></div>' +
    '<div><dt>SSID</dt><dd>' + esc(p.ssid) + '</dd></div></dl></div>';
}

function renderBoard(){
  const t = state.focus;
  if (!t){
    $('fact-count').textContent = '0件';
    $('board').innerHTML = '<p class="empty-note">案件を開くと、ここに原因の候補と<br>集まった手がかりが並びます。</p>';
    return;
  }
  const ruled = ruledOut(t);
  const hot = hotCauses(t);
  $('fact-count').textContent = t.facts.length + '件';

  const causeRow = c => {
    const out = ruled.has(c.id) && !hot.has(c.id);
    const isHot = hot.has(c.id);
    return '<div class="cause ' + (out ? 'out' : '') + ' ' + (isHot ? 'hot' : '') + '">' +
      '<span class="tick">' + (out ? '×' : isHot ? '●' : '·') + '</span>' +
      '<span>' + esc(c.label) + '</span>' +
      '<span class="tier">' + c.tier + '</span></div>';
  };
  const remainingCauses = CAUSES.filter(c => !(ruled.has(c.id) && !hot.has(c.id)));
  const excludedCauses = CAUSES.filter(c => ruled.has(c.id) && !hot.has(c.id));
  const causes = remainingCauses.map(causeRow).join('');
  const excluded = excludedCauses.length
    ? '<button class="board-toggle" data-board-excluded="1" aria-expanded="' + !!state.ui.boardExcludedOpen + '">除外済み（' + excludedCauses.length + '件）<span>' + (state.ui.boardExcludedOpen ? '閉じる' : '開く') + '</span></button>' +
      (state.ui.boardExcludedOpen ? '<div class="board-excluded">' + excludedCauses.map(causeRow).join('') + '</div>' : '')
    : '';

  const facts = t.facts.length
    ? t.facts.map(f => '<div class="fact"><span class="src">' + esc(f.src) + '</span>' + esc(f.text) + '</div>').join('')
    : '<p class="empty-note" style="padding:10px 0">まだ手がかりがありません。</p>';

  $('board').innerHTML =
    renderDevicePanel(t) +
    '<p class="eyebrow" style="margin:0 0 6px">残っている候補 ' + remainingCauses.length + ' / ' + CAUSES.length + '</p>' +
    causes + excluded +
    '<p class="eyebrow" style="margin:20px 0 8px">集まった手がかり</p>' +
    '<div class="facts">' + facts + '</div>' +
    '<p class="eyebrow" style="margin:20px 0 8px">この案件のここまで</p>' +
    '<div class="mini-list">' +
      mini('通話時間', t.callMinutes + '分') +
      mini('うち保留', t.holdMinutes + '分') +
      mini('聞き取り', t.asked.size + '回') +
      mini('社内照会', t.lookedUp.size + '回') +
      mini('見立て違い', t.misdiagnoses + '回') +
    '</div>';
}
function mini(k, v){ return '<div class="mini"><span>' + k + '</span><b>' + esc(v) + '</b></div>'; }

/* ============================================================
   オーバーレイ
   ============================================================ */

/* シートの開閉。開いている間はコンソールを隠し、通常のスクロールに戻す */
function openSheet(){
  $('overlay').classList.add('on');
  document.body.classList.add('sheet-open');
  document.body.classList.remove('playing');
  window.scrollTo(0, 0);
}
function closeSheet(){
  $('overlay').classList.remove('on');
  document.body.classList.remove('sheet-open');
  document.body.classList.add('playing');
}

function drawArtifactQr(){
  const canvas = $('artifact-qr-canvas');
  if (!canvas) return;
  const size = ARTIFACT_QR.length;
  const quietZone = ARTIFACT_QR_QUIET_ZONE;
  const moduleSize = 4;
  canvas.width = (size + quietZone * 2) * moduleSize;
  canvas.height = (size + quietZone * 2) * moduleSize;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000';
  ARTIFACT_QR.forEach((row, y) => {
    [...row].forEach((module, x) => {
      if (module === '1') ctx.fillRect((x + quietZone) * moduleSize, (y + quietZone) * moduleSize, moduleSize, moduleSize);
    });
  });
}

function getCareerStorage(){
  try { return window.localStorage; }
  catch (error){ return null; }
}

function readCareerRecord(storage = getCareerStorage()){
  try {
    if (!storage) return freshCareerRecord();
    const raw = storage.getItem(CAREER_STORAGE_KEY);
    if (!raw) return freshCareerRecord();
    const parsed = normalizeCareerRecord(JSON.parse(raw));
    return validCareerRecord(parsed) ? parsed : freshCareerRecord();
  } catch (error){ return freshCareerRecord(); }
}

function writeCareerRecord(record, storage = getCareerStorage()){
  try {
    if (!storage) return false;
    storage.setItem(CAREER_STORAGE_KEY, JSON.stringify(record));
    return true;
  } catch (error){ return false; }
}

function initializeCareer(){
  state.career = careerWithFlags(readCareerRecord());
  state.careerUpdate = null;
  state.endingReplay = false;
  state.endingType = 'career';
}

function careerBriefingHtml(){
  const career = state.career || freshCareerRecord();
  const storageNote = career.totals.days === 0
    ? '<span>勤務記録はこのブラウザ内だけに保存されます。氏名や会話内容は保存しません。</span>'
    : '';
  return '<section class="career-briefing"><b>' + (career.totals.days + 1) + '日目 ／ ' + esc(CAREER_STAGES[career.stage].label) + ' ／ 今夜 ' + state.tickets.length + '件</b>' +
    storageNote + '</section>';
}

function showBriefing(){
  $('sheet').innerHTML =
    '<p class="eyebrow">SHIFT BRIEFING ／ 08月31日 22:00 JST</p>' +
    '<h1>深夜のグローバルデスク</h1>' +
    careerBriefingHtml() +
    '<div class="artifact-qr-card" aria-label="iPhoneで遊ぶためのQRコード">' +
      '<canvas class="artifact-qr-canvas" id="artifact-qr-canvas" role="img" aria-label="この公開ページを開くQRコード"></canvas>' +
      '<div class="artifact-qr-copy"><b>iPhoneで遊ぶ</b><p>カメラでQRコードを読み取ると、このページが開きます。</p>' +
      '<code class="artifact-qr-url">' + esc(ARTIFACT_URL) + '</code></div>' +
    '</div>' +

    '<button class="btn-primary" id="btn-start">シフトを始める</button>';

  openSheet();
  drawArtifactQr();
  $('btn-start').onclick = () => {
    initAudio();
    closeSheet();
    advance(0);
    enterOffice();
  };
}

function showManual(){
  const wasPhase = state.phase;
  $('sheet').innerHTML =
    '<p class="eyebrow">OPERATIONS MANUAL</p>' +
    '<h1>対応マニュアル</h1>' +
    '<p class="lead">迷ったら順番どおりに枝を折ります。会話だけで確定できないものは、無理に確定させないこと。</p>' +
    '<p>この席は、すでに海外にいるお客様のための24時間窓口です。渡航前・帰国後の国内窓口はいま閉まっているため、現地の手配までここで判断します。</p>' +

    '<h2>夜勤の進め方</h2>' +
    '<ul>' +
      '<li><strong>電話は1本ずつしか取れません。</strong>話している間、ほかの電話は鳴り続けます。</li>' +
      '<li>無駄な質問1つが通話を1分延ばし、その1分だけ、待っている誰かが切りやすくなります。</li>' +
      '<li>調べものは保留にすれば速く済みますが、相手は無音のまま待たされます。話しながら調べると保留は増えませんが、通話が長引きます。</li>' +
      '<li>現地キャリアへの照会だけは30分かかります。通話を切って折り返す間に、ほかの電話を対応できます。</li>' +
      '<li>相手によって刺さる話し方が違います。急いでいる人に前置きは要りません。</li>' +
    '</ul>' +

    '<h2>切り分けの順番</h2>' +
    '<ul>' +
      '<li>渡航先・利用期間・機種・プランを押さえる</li>' +
      '<li>本体の画面（電波・キャリア名・SIM表示・制限表示）を見てもらう</li>' +
      '<li>Wi-Fiが見えるか／接続できるか／<strong>全端末か一台だけか</strong>を分ける</li>' +
      '<li>低リスクの操作（再起動、窓際へ移動、Wi-Fi設定の削除と再接続、不要端末の切断、No SIM表示時のSIM抜き差し・接点清掃）</li>' +
      '<li>容量・現地障害・契約条件は社内照会で裏を取る</li>' +
      '<li>回線障害・清掃後も続くSIM未認識・故障・機種非対応はエスカレーション。枠は' + ESCALATIONS + '回だけ。</li>' +
    '</ul>' +

    '<h2>評価の重みは隠しません</h2>' +
    '<p>シフト終了時、次の5つで採点されます。AHT（平均通話時間）も表示されますが、直接の配点はありません。</p>' +
    '<ul>' +
      '<li><strong>顧客満足（CSAT）35%</strong> — 正しく直せたか、保留や折り返し、伝え方が相手にどう映ったか。</li>' +
      '<li><strong>一次解決率 25%</strong> — 最初の通話で正しい対処まで到達したか。正しいエスカレーションも含みます。</li>' +
      '<li><strong>応答率 20%</strong> — その夜の案件のうち、放棄呼にせず応答できた割合です。</li>' +
      '<li><strong>費用 10%</strong> — 代替機の手配や返金は会社の持ち出しです。要らない手配をしないこと。</li>' +
      '<li><strong>業務報告 10%</strong> — その夜の重要な出来事を、必要十分に翌シフトへ残せたか。</li>' +
    '</ul>' +

    '<h2>確信度の3段階</h2>' +
    '<table class="tbl"><tr><th>段階</th><th>例</th><th>やること</th></tr>' +
    '<tr><td>確定</td><td>容量超過、接続台数上限、通信規制</td><td>社内照会で裏を取ってから案内する</td></tr>' +
    '<tr><td>有力</td><td>端末側の設定、電波の弱い場所</td><td>低リスク操作で試してから確定させる</td></tr>' +
    '<tr><td>要ESC</td><td>広域障害、清掃後も続くSIM未認識、機種非対応</td><td>低リスク操作で直らないことを確認してから渡す</td></tr>' +
    '</table>' +

    '<h2>やってはいけないこと</h2>' +
    '<ul>' +
      '<li><strong>客に本体を初期化させる</strong> — 回線設定が消え、復旧できなくなるおそれがあります。</li>' +
      '<li><strong>スマホのAPNを書き換えさせる</strong> — レンタルWiFiのAPNはルーター内のSIM側の設定で、客の端末には関係がありません。</li>' +
      '<li><strong>データローミングをONにさせる</strong> — 自分のキャリア回線を海外で使う設定です。復旧策ではなく、高額請求の入口です。</li>' +
      '<li><strong>とりあえず代替機を送る</strong> — 網側の障害なら届いても直りません。同じ機種を送っても機種非対応は解決しません。</li>' +
    '</ul>' +

    '<button class="btn-primary" id="btn-close-manual">デスクに戻る</button>';

  openSheet();
  $('btn-close-manual').onclick = () => {
    if (wasPhase === 'briefing') { showBriefing(); return; }
    if (wasPhase === 'debrief') { renderDebrief(); return; }
    closeSheet();
    render();
  };
}

function scenarioRoute(s){
  const remedy = (REMEDIES[s.trueCause] || []).find(item => item.id === s.best);
  const hotQuestions = Object.entries(s.replies || {})
    .filter(([,reply]) => reply.fact && (reply.fact.hot || []).includes(s.trueCause))
    .map(([id]) => (QUESTIONS.find(question => question.id === id) || {label:id}).label);
  const requiredQuestions = (remedy && remedy.requiresQuestions || [])
    .map(id => (QUESTIONS.find(question => question.id === id) || {label:id}).label);
  const questions = [...new Set(hotQuestions.concat(requiredQuestions))];
  const hotLookups = Object.entries(s.lookups || {})
    .filter(([,lookup]) => lookup.fact && (lookup.fact.hot || []).includes(s.trueCause))
    .map(([id]) => (LOOKUPS.find(lookup => lookup.id === id) || {label:id}).label);
  const route = ['名乗る → 契約番号、または氏名＋渡航先で本人特定'];
  if (TYPES[s.type].stressStart >= 15) route.push('冒頭の温度感を見て、必要なら簡単なお詫び');
  if (questions.length) route.push('聞く: ' + questions.join(' ／ '));
  if (hotLookups.length) route.push('調べる: ' + hotLookups.join(' ／ '));
  if (remedy && remedy.needsTest){
    const test = TESTS.find(item => item.id === remedy.needsTest);
    route.push('伝える→やってみてもらう: ' + (test ? test.label : remedy.needsTest) + ' × ' + (remedy.needsTestCount || 1));
  } else {
    const solving = Object.entries(s.tests || {}).filter(([,test]) => test.solves || (test.sequence || []).some(step => step.solves));
    if (solving.length){
      const test = TESTS.find(item => item.id === solving[0][0]);
      route.push('伝える→やってみてもらう: ' + (test ? test.label : solving[0][0]));
    }
  }
  const cause = CAUSES.find(item => item.id === s.trueCause);
  route.push('伝える → 対処を伝える: ' + (cause ? cause.label : s.trueCause));
  if (s.bestNoOutage) route.push('障害未確認なら「' + ((REMEDIES[s.trueCause] || []).find(item => item.id === s.bestNoOutage) || {}).label + '」');
  route.push('対処: ' + (remedy ? remedy.label : s.best));
  if (remedy && remedyNeedsShipping(remedy.id)) route.push('配送: 滞在先・残り日数・本人希望を確認し、必要速度のTGX便を選ぶ');
  route.push('伝え方: ' + toneLabel(TYPES[s.type].tone));
  return route;
}

function showBalanceWarning(){
  const wasPhase = state.phase;
  $('sheet').innerHTML =
    '<p class="eyebrow">BALANCE CONSOLE ／ CONFIRM</p>' +
    '<h1>正解ルートを表示します</h1>' +
    '<p class="lead"><strong>' + SCENARIOS.length + '件の真因と正解対処がすべて表示されます。</strong>プレイ中に見ると、そのシフトの答えが分かります。ゲーム調整のために開きますか？</p>' +
    '<button class="btn-primary" id="btn-confirm-balance">正解を表示する</button>' +
    '<button class="btn-ghost" id="btn-cancel-balance">表示しない</button>';
  openSheet();
  $('btn-confirm-balance').onclick = () => showBalanceConsole();
  $('btn-cancel-balance').onclick = () => {
    if (wasPhase === 'briefing'){ showBriefing(); return; }
    if (wasPhase === 'debrief'){ renderDebrief(); return; }
    closeSheet(); render();
  };
}

function showBalanceConsole(){
  const wasPhase = state.phase;
  const luckEnabled = GAME_FLAGS.luckRate !== 1;
  const commandRows = COMMAND_DEFS.map(command =>
    '<tr><td>' + command.no + '</td><td><b>' + esc(command.label) + '</b></td></tr>'
  ).join('');
  const scenarioCards = SCENARIOS.map(s => {
    const type = TYPES[s.type];
    const remedy = (REMEDIES[s.trueCause] || []).find(item => item.id === s.best);
    return '<details class="balance-card"><summary>' + esc(s.id + ' ' + s.name + ' ／ ' + s.city + ' ／ ' + type.label) + '</summary>' +
      '<div class="balance-card-body"><p>' + esc(s.opening) + '</p>' +
      '<div class="balance-facts">' +
        '<div class="balance-fact"><b>到着</b>22:00 +' + s.arrive + '分</div>' +
        '<div class="balance-fact"><b>開始ストレス</b>' + type.stressStart + ' ／ ' + esc(type.note) + '</div>' +
        '<div class="balance-fact"><b>真因</b>' + esc(causeName(s.trueCause)) + '</div>' +
        '<div class="balance-fact"><b>正解対処</b>' + esc(remedy ? remedy.label : s.best) + '</div>' +
        '<div class="balance-fact"><b>放棄まで</b>' + s.abandonAfter + '分</div>' +
        '<div class="balance-fact"><b>配送条件</b>' + (s.shipNeed ? esc(s.shipNeed + '便以上') : 'なし') + '</div>' +
      '</div><b>推奨ルート</b><ol class="balance-route">' + scenarioRoute(s).map(step => '<li>' + esc(step) + '</li>').join('') + '</ol></div></details>';
  }).join('');
  $('sheet').innerHTML =
    '<p class="eyebrow">BALANCE CONSOLE ／ INTERNAL</p><h1>ゲーム調整コンソール</h1>' +
    '<p class="lead">顧客、真因、正解対処、推奨ルートを一画面で確認できます。これは調整用で、プレイ中の答え合わせを目的とした内部画面です。</p>' +
    '<h2>比較設定</h2><div class="balance-flags">' +
      '<label><input type="checkbox" id="balance-luck"' + (luckEnabled ? ' checked' : '') + '> 運を入れる（本来どおり ' + Math.round(LUCK_RATE * 100) + '%）</label>' +
      '<label><input type="checkbox" id="balance-shuffle"' + (GAME_FLAGS.shuffleArrival ? ' checked' : '') + '> 案件の登場順をシャッフルする（次のシフトから反映）</label>' +
      '<label><input type="checkbox" id="balance-identity"' + (GAME_FLAGS.shuffleIdentity ? ' checked' : '') + '> 名前・年齢と土地をシャッフルする（次のシフトから反映）</label>' +
      '<label><input type="checkbox" id="balance-sound"' + (GAME_FLAGS.soundEnabled ? ' checked' : '') + '> 効果音を鳴らす</label>' +
      '<label>音量 <input type="range" id="balance-volume" min="0" max="1" step="0.05" value="' + GAME_FLAGS.soundVolume + '"></label>' +
      '<p>OFFにすると従来の決定論的な挙動へ戻ります。抽選結果はプレイ画面や会話記録には表示されません。</p>' +
    '</div>' +
    '<h2>キャリア記録</h2><div class="balance-career-actions">' +
      '<button class="btn-ghost" id="balance-replay-ending">表エンディング（翌朝の全体朝礼）を再生する</button>' +
      '<button class="btn-ghost" id="balance-replay-secret-ending">裏エンディングを再生する</button>' +
      '<button class="btn-ghost danger" id="balance-clear-career">勤務記録を消去する</button>' +
      '<p>消去は一度確認してから実行します。次回は1日目から始まります。</p>' +
    '</div>' +
    '<h2>コマンド一覧</h2><div class="balance-table-wrap"><table class="balance-table"><tr><th>No.</th><th>コマンド</th></tr>' + commandRows + '</table></div>' +
    '<h2>シナリオ ' + SCENARIOS.length + '件</h2><div class="balance-console">' + scenarioCards + '</div>' +
    '<button class="btn-primary" id="btn-close-balance">デスクに戻る</button>';
  openSheet();
  $('balance-luck').onchange = event => {
    GAME_FLAGS.luckRate = event.target.checked ? LUCK_RATE : 1.0;
  };
  $('balance-shuffle').onchange = event => {
    GAME_FLAGS.shuffleArrival = event.target.checked;
  };
  $('balance-identity').onchange = event => {
    GAME_FLAGS.shuffleIdentity = event.target.checked;
  };
  $('balance-sound').onchange = event => {
    GAME_FLAGS.soundEnabled = event.target.checked;
  };
  $('balance-volume').oninput = event => {
    GAME_FLAGS.soundVolume = clamp(Number(event.target.value), 0, 1);
  };
  $('balance-replay-ending').onclick = event => { event.stopImmediatePropagation(); showCareerEnding(true); };
  $('balance-replay-secret-ending').onclick = event => { event.stopImmediatePropagation(); showSecretEnding(true); };
  $('balance-clear-career').onclick = () => clearCareerRecord();
  $('btn-close-balance').onclick = () => {
    if (wasPhase === 'briefing'){ showBriefing(); return; }
    if (wasPhase === 'debrief'){ renderDebrief(); return; }
    closeSheet(); render();
  };
}

/* ---------- 業務報告 ---------- */

function reportOptions(){
  const handled = id => {
    const t = state.tickets.find(x => x.s.id === id);
    return t && t.result && t.result.kind !== 'abandoned';
  };
  const shipments = state.tickets.filter(t => t.shipment);
  const byId = id => state.tickets.find(t => t.s.id === id);
  const special = [];
  if (state.outageKnown) special.push({ id:'outage', required:true, ticketId:'S5', text:state.outageRegion + 'で提携キャリアの広域障害。同一エリアから2件入電、復旧見込み未定' });
  if (handled('S7')) special.push({ id:'gd200', required:true, ticketId:'S7', text:'GD-200 が現地の郊外カバー用周波数に非対応。市内では使えるが郊外で圏外となる事例' });
  if (shipments.length) special.push({ id:'shipments', required:true, ticketId:shipments[0].s.id, text:'代替機を ' + shipments.length + '台手配（費用計 ¥' + shipments.reduce((n,t) => n + t.shipment.fee, 0).toLocaleString('ja-JP') + '）' });
  if (handled('S9')) special.push({ id:'counter', required:true, ticketId:'S9', text:'空港カウンターの営業時間外受取が発生。デポからの配送で対応' });
  if (handled('S1')) special.push({ id:'s1_daily', required:false, ticketId:'S1', text:byId('S1').s.city + 'のお客様が容量超過。追加データの案内で解決' });
  if (handled('S2')) special.push({ id:'s2_daily', required:false, ticketId:'S2', text:byId('S2').s.city + 'のお客様の端末側Wi-Fi設定を作り直して復旧' });
  if (handled('S3')) special.push({ id:'s3_daily', required:false, ticketId:'S3', text:byId('S3').s.city + 'のお客様に接続台数の上限を説明' });

  const handoff = [];
  if (state.outageKnown) handoff.push({ id:'outage_watch', required:true, ticketId:'S5', text:state.outageRegion + 'の障害は未復旧。朝の入電増に注意' });
  const s8 = byId('S8');
  if (s8 && s8.shipment) handoff.push({ id:'s8_delivery', required:true, ticketId:'S8', text:s8.s.city + '宛の代替機が現地' + fmtClock(s8.shipment.eta) + '到着予定。着荷確認が必要' });
  return { special, handoff };
}

function scoreReportGroup(options, selected){
  const required = options.filter(x => x.required).map(x => x.id);
  const chosen = selected.filter(id => id !== 'none');
  let points = 0;
  required.forEach(id => { points += chosen.includes(id) ? 1 : -1; });
  chosen.filter(id => !required.includes(id)).forEach(() => { points -= .5; });
  if (selected.includes('none')) points += required.length ? -1 : 1;
  const max = Math.max(1, required.length || 1);
  return { score:clamp(points / max, 0, 1), missed:required.filter(id => !chosen.includes(id)), noise:chosen.filter(id => !required.includes(id)) };
}

function currentShiftSummary(){
  const m = metrics();
  const avg = m.csat === null ? 0 : m.csat;
  const cost = totalCost();
  const costScore = clamp(1 - cost / 70000, 0, 1);
  const reportScore = state.report && typeof state.report.score === 'number' ? state.report.score : 0;
  const total = avg / 5 * 35 + (m.fcr || 0) * 25 + m.answerRate * 20 + costScore * 10 + reportScore * 10;
  const grade = total >= 88 ? 'S' : total >= 74 ? 'A' : total >= 60 ? 'B' : total >= 44 ? 'C' : 'D';
  return { m, avg, cost, costScore, reportScore, total, grade };
}

function careerShiftContext(){
  const tickets = state.tickets;
  return {
    maxStresses:tickets.map(ticket => ticket.maxStress),
    redials:tickets.reduce((sum, ticket) => sum + ticket.redialCount, 0),
    abandoned:tickets.filter(ticket => ticket.result && ticket.result.kind === 'abandoned').length,
    resultKinds:tickets.map(ticket => ticket.result && ticket.result.kind).filter(Boolean),
    noRefundsOrShipments:tickets.length > 0 && tickets.every(ticket => ticket.result && ticket.result.kind !== 'refunded' && !ticket.shipment),
    allResolved:tickets.length > 0 && tickets.every(ticket => ticket.result && ['closed','refunded'].includes(ticket.result.kind)),
    allRefunded:tickets.length > 0 && tickets.every(ticket => ticket.result && ticket.result.kind === 'refunded'),
    solvedScenarioIds:solvedScenarioIdsFromTickets(tickets),
  };
}

function recordCurrentCareerShift(summary = currentShiftSummary()){
  if (state.careerUpdate) return state.careerUpdate;
  if (!state.career) state.career = freshCareerRecord();
  const shift = {
    endedAt:new Date().toISOString(),
    tickets:state.tickets.length,
    grade:summary.grade,
    scores:{
      csat:summary.avg,
      fcr:summary.m.fcr || 0,
      answer:summary.m.answerRate,
      cost:summary.cost,
      report:summary.reportScore,
    },
    complaints:state.tickets.filter(ticket => ticket.complaintEmail).length,
  };
  state.careerUpdate = appendCareerShift(state.career, shift, careerShiftContext());
  state.career = state.careerUpdate.career;
  writeCareerRecord(state.career);
  if (state.careerUpdate.promoted) playPromotionSound();
  else if (state.careerUpdate.newBadges.length) playBadgeSound();
  return state.careerUpdate;
}

function renderReport(){
  const o = reportOptions();
  if (!state.report) state.report = { special:[], handoff:[] };
  const m = metrics();
  const escaped = x => esc(x.text);
  /* 提出前は required を一切見せない。何を報告すべきかを選ぶことがこの画面の中身なので、
     正解が先に見えていると判断が消える。答え合わせは提出後の振り返りで行う */
  const checks = (items, chosen, attr) => items.map(x => '<label class="report-check"><input type="checkbox" data-' + attr + '="' + x.id + '" ' + (chosen.includes(x.id) ? 'checked' : '') + '><span>' + escaped(x) + '</span></label>').join('') || '<p class="empty-note">該当する特記事項はありません。</p>';
  $('sheet').innerHTML =
    '<p class="eyebrow">DAILY REPORT ／ ' + fmtClock(state.clock) + ' JST</p><h1>業務報告 ／ 深夜シフト</h1>' +
    '<div class="report-auto">対応件数 ' + state.tickets.length + '件（うち放棄呼 ' + m.abandoned + '件）／ 平均通話 ' + (m.aht === null ? '—' : m.aht.toFixed(1)) + '分 ／ エスカレーション ' + state.tickets.filter(t => t.escUsed).length + '件 ／ 発生費用 ¥' + totalCost().toLocaleString('ja-JP') + '</div>' +
    '<h2>特記事項</h2><p class="hint-bar">実際に起きたことで、次の担当が知るべきものを選びます。必須と日常対応が混ざっています。</p><div class="report-list">' + checks(o.special, state.report.special, 'report-special') + '</div>' +
    '<h2>申し送り</h2><p class="hint-bar">翌シフトへの引き継ぎです。必須がある夜に「特になし」は誤りです。</p><div class="report-list">' + checks(o.handoff, state.report.handoff, 'report-handoff') + '<label class="report-check"><input type="checkbox" data-report-handoff="none" ' + (state.report.handoff.includes('none') ? 'checked' : '') + '><span>特になし<i>引き継ぎ不要</i></span></label></div>' +
    '<button class="btn-primary" id="report-submit" data-report-submit="1">業務報告を提出する</button>';
  openSheet();
}

function toggleReport(kind, id, checked){
  const list = state.report[kind];
  const idx = list.indexOf(id);
  if (checked && idx < 0) list.push(id);
  if (!checked && idx >= 0) list.splice(idx, 1);
}

function submitReport(){
  const o = reportOptions();
  const special = scoreReportGroup(o.special, state.report.special);
  const handoff = scoreReportGroup(o.handoff, state.report.handoff);
  state.report.score = Math.round((special.score + handoff.score) / 2 * 100) / 100;
  state.report.missedSpecial = special.missed;
  state.report.missedHandoff = handoff.missed;
  state.report.noise = [...special.noise, ...handoff.noise];
  state.report.options = o;
  recordCurrentCareerShift();
  state.phase = 'debrief';
  renderDebrief();
}

function reportMissForTicket(t){
  if (!state.report || !state.report.options) return [];
  const missed = new Set([...state.report.missedSpecial, ...state.report.missedHandoff]);
  return [...state.report.options.special, ...state.report.options.handoff].filter(o => o.ticketId === t.s.id && missed.has(o.id)).map(o => o.text);
}

function careerDebriefHtml(){
  const career = state.career || freshCareerRecord();
  const update = state.careerUpdate || { promoted:false, newBadges:[] };
  const stage = CAREER_STAGES[career.stage];
  const recent = career.shifts.slice(-5).map(shift => shift.grade).join('・') || 'まだありません';
  const fresh = new Set(update.newBadges);
  const acquired = new Set(career.badges);
  const badgeCards = CAREER_BADGES.map(badge =>
    '<div class="career-badge ' + (acquired.has(badge.id) ? 'earned' : 'locked') + (fresh.has(badge.id) ? ' badge-new' : '') + '">' +
      '<b>' + (acquired.has(badge.id) ? '取得済み' : '未取得') + ' ／ ' + esc(badge.label) + (fresh.has(badge.id) ? ' NEW' : '') + '</b>' +
      '<span>' + esc(badge.condition) + '</span></div>'
  ).join('');
  return (update.promoted
      ? '<div class="promotion-banner">昇格 ／ ' + esc(CAREER_STAGES[update.previousStage].label) + ' → ' + esc(stage.label) + '</div>'
      : '') +
    '<section class="career-panel"><h2>勤務記録</h2>' +
      '<div class="career-summary"><b>' + esc(stage.label) + '</b><span>通算 ' + career.totals.days + '日</span><span>直近5回 ' + esc(recent) + '</span></div>' +
      '<p class="career-next">次の段階：' + esc(stage.next || 'なし') + ' ／ ' + esc(stage.condition) + '</p>' +
      '<div class="career-ending-progress"><b>表エンディング</b><span>解決した案件 ' + career.solvedScenarios.length + ' / ' + SCENARIOS.length + '</span></div>' +
      '<div class="career-badge-count">裏エンディング ／ バッジ ' + career.badges.length + ' / ' + CAREER_BADGES.length + '</div>' +
      '<div class="career-badge-grid">' + badgeCards + '</div>' +
    '</section>';
}

function clearCareerRecord(){
  if (!window.confirm('勤務記録を消去して、1日目から始めますか？')) return false;
  const storage = getCareerStorage();
  try { if (storage) storage.removeItem(CAREER_STORAGE_KEY); }
  catch (error){ /* 保存領域が使えなくても、このセッションの記録は消す */ }
  state.career = freshCareerRecord();
  state.careerUpdate = null;
  writeCareerRecord(state.career, storage);
  resetGame();
  showBriefing();
  return true;
}

function endingBadgeHtml(career){
  const acquired = new Set(career.badges);
  return CAREER_BADGES.map(badge => '<div class="ending-badge ' + (acquired.has(badge.id) ? 'earned' : 'locked') + '"><b>' + esc(badge.label) + '</b><span>' + esc(badge.condition) + '</span></div>').join('');
}

function careerEndingDetailsHtml(career){
  return '<div class="ending-totals"><b>通算 ' + career.totals.days + '日</b><span>平均CSAT ' + career.totals.averageCsat.toFixed(2) + '</span><span>苦情 ' + career.totals.complaints + '件</span></div>' +
    '<h2>集めたバッジ</h2><div class="ending-badge-grid">' + endingBadgeHtml(career) + '</div>';
}

function careerEndingFinalHtml(){
  return '<div class="ending-end" id="ending-end">END</div>' +
    '<button class="btn-primary" id="ending-back-to-shift">深夜シフトへ戻る</button>';
}

function careerEndingEyebrowHtml(){
  const secretMark = state.endingType === 'secret'
    ? '<span class="ending-variant-mark" aria-label="裏エンディング">裏</span>'
    : '';
  return '<p class="eyebrow">THE NEXT MORNING ／ ALL-HANDS MEETING' + secretMark + '</p>';
}

function clearEndingRevealTimer(){
  if (endingRevealTimer !== null) clearTimeout(endingRevealTimer);
  endingRevealTimer = null;
}

function clearEndingTapGuard(){
  if (tapGuardTimer !== null) clearTimeout(tapGuardTimer);
  tapGuardTimer = null;
  endingTapGuard = false;
}

function revealCareerEndingFinal(){
  clearEndingRevealTimer();
  const slot = $('ending-finale');
  if (!slot) return;
  slot.innerHTML = careerEndingFinalHtml();
  $('ending-back-to-shift').onclick = () => continueAfterCareerEnding();
}

function pendingCareerEndingType(){
  if (state.endingReplay || !state.careerUpdate) return null;
  return (state.careerUpdate.endingQueue || []).find(type =>
    type === 'career' ? !state.career.ending : !state.career.secretEnding
  ) || null;
}

function continueAfterCareerEnding(){
  const next = pendingCareerEndingType();
  if (next === 'career'){ showCareerEnding(false); return; }
  if (next === 'secret'){ showSecretEnding(false); return; }
  state.endingReplay = false;
  resetGame();
  showBriefing();
}

function showNextCareerEnding(){
  const next = pendingCareerEndingType();
  if (next === 'career'){ showCareerEnding(false); return; }
  if (next === 'secret'){ showSecretEnding(false); return; }
  continueAfterCareerEnding();
}

function renderCareerEndingComplete(skipEndingBeat = false){
  const career = state.career;
  clearEndingRevealTimer();
  clearEndingTapGuard();
  state.endingSpeech = null;
  $('sheet').innerHTML =
    careerEndingEyebrowHtml() +
    '<h1>翌朝、全体朝礼</h1>' +
    '<canvas class="ending-office-canvas" id="ending-office-canvas" width="192" height="168" role="img" aria-label="朝の明るいオフィスに社員が集まり、社長が笑顔で立っている"></canvas>' +
    '<section class="ending-speech"><b>社長</b><p>' + esc(PRESIDENT_ENDING_LINE) + '</p></section>' +
    careerEndingDetailsHtml(career) + '<div id="ending-finale"></div>';
  drawMorningOffice();
  if (skipEndingBeat) revealCareerEndingFinal();
  else endingRevealTimer = setTimeout(revealCareerEndingFinal, 1000);
}

function showCareerEnding(replay = false, endingType = 'career'){
  stopOfficeRing();
  clearEndingRevealTimer();
  clearEndingTapGuard();
  endingTapGuard = true;
  if (!state.career) state.career = freshCareerRecord();
  state.endingReplay = replay;
  state.endingType = endingType;
  state.phase = 'ending';
  if (!replay){
    if (endingType === 'secret') state.career.secretEnding = true;
    else state.career.ending = true;
    writeCareerRecord(state.career);
  }
  playCareerEndingSound();
  state.endingSpeech = { transcript:[{ who:'cust', text:PRESIDENT_ENDING_LINE, typed:false }] };
  $('sheet').innerHTML =
    careerEndingEyebrowHtml() +
    '<h1>翌朝、全体朝礼</h1>' +
    '<canvas class="ending-office-canvas" id="ending-office-canvas" width="192" height="168" role="img" aria-label="朝の明るいオフィスに社員が集まり、社長が笑顔で立っている"></canvas>' +
    '<section class="ending-speech"><b>社長</b>' +
      '<p class="ending-line line typing"><span class="say"></span></p></section>';
  openSheet();
  drawMorningOffice();
  // 再生ボタンの同じclickが、document側の「タップで送り切る」に重ならないよう次のtaskで始める。
  setTimeout(() => startTyping(state.endingSpeech), 0);
  tapGuardTimer = setTimeout(clearEndingTapGuard, 400);
}

function showSecretEnding(replay = false){
  showCareerEnding(replay, 'secret');
}

function renderDebrief(){
  const ts = state.tickets;
  const summary = currentShiftSummary();
  const { m, avg, reportScore } = summary;
  const rank = summary.grade;
  const rankNote = {
    S:'非の打ちどころがありません。あなたはこのデスクの柱です。',
    A:'安定した夜勤。判断も費用感も信頼できます。',
    B:'ひととおり捌けています。取りこぼした一件を見直しましょう。',
    C:'解決はしていますが、遠回りと持ち出しが目立ちます。',
    D:'切り分けの順番から立て直しが要ります。マニュアルをもう一度。',
  }[rank];

  const reviews = ts.map(t => {
    const r = t.result || { kind:'abandoned', csat:0, label:'未対応' };
    const cls = r.csat >= 4 ? 'win' : r.csat >= 2.5 ? 'mid' : 'bad';
    let judge;
    if (r.kind === 'abandoned') judge = '呼び出しに応答できず、放棄呼になりました。';
    else if (r.kind === 'complaint') judge = r.reason === 'misdiagnosis' ? '見立てが二度外れ、お客様が強い苦情を述べて終話しました。' : 'お客様の苛立ちが限界に達し、強い苦情を述べて終話しました。';
    else if (r.kind === 'hangup') judge = r.reason === 'misdiagnosis' ? '見立てが二度外れ、お客様が一方的に通話を切りました。' : 'お客様の苛立ちが限界に達し、一方的に通話を切りました。';
    else if (r.causeMatched === false) judge = '選んだ対応のあと通信は復旧し、一次解決になりました。' + (r.toneOk ? '伝え方も相手に合っていました。' : 'ただし話し方が相手に合っていませんでした。');
    else if (r.grade === 'best') judge = '原因も対処も最適でした。' + (r.toneOk ? '伝え方も相手に合っていました。' : 'ただし話し方が相手に合っていませんでした。');
    else if (r.grade === 'partial') judge = '原因は当たっていましたが、対処は次善どまりでした。';
    else judge = '原因は当たっていましたが、対処が噛み合っていませんでした。';

    const misses = reportMissForTicket(t);
    return '<div class="review ' + cls + '">' +
      '<div class="rh"><span class="rn">' + esc(t.s.name) + '</span>' +
      '<span class="rp">' + esc(t.s.cityEn) + '</span>' +
      '<span class="rs">CSAT ' + r.csat.toFixed(1) + ' ／ ' + esc(r.label) + ' ／ 通話' + t.callMinutes + '分（保留' + t.holdMinutes + '分）</span></div>' +
      '<div class="review-csat" aria-label="CSAT ' + r.csat.toFixed(1) + ' / 5"><i style="width:' + clamp(r.csat / 5 * 100, 0, 100) + '%"></i></div>' +
      '<div class="rb"><b style="color:var(--text);font-weight:500">真の原因：' + esc(causeName(t.s.trueCause)) + '</b><br>' +
      esc(judge) + '<br>' + t.s.debrief + (misses.length ? '<div class="report-miss">これは報告すべきでした：' + misses.map(esc).join(' ／ ') + '</div>' : '') + '</div></div>';
  }).join('');

  const complaintEmails = ts.filter(t => t.complaintEmail).map(t => {
    const template = COMPLAINT_EMAIL_TEMPLATES[t.s.type];
    const lines = template.lines.map(line => esc(line.replace('{symptom}', t.s.opening))).join('<br>');
    return '<div class="complaint-email"><b>' + esc(t.s.name) + '様からの苦情メール</b><p>' + lines + '</p></div>';
  }).join('');
  const complaintMailbox = complaintEmails
    ? '<section class="complaint-mailbox"><h2>翌日、次の苦情が届いています</h2><p>' + ts.filter(t => t.complaintEmail).length + '件</p>' + complaintEmails + '</section>'
    : '';

  $('sheet').innerHTML =
    '<p class="eyebrow">SHIFT DEBRIEF ／ ' + fmtClock(state.clock) + ' JST</p>' +
    careerDebriefHtml() +
    '<h1>シフト終了</h1>' +
    '<div class="rank-badge"><span class="r">' + rank + '</span><span class="rt">' + esc(rankNote) + '</span></div>' +

    '<div class="score-grid">' +
      cell('平均CSAT', avg.toFixed(2), '5.0満点 ／ 配点35%') +
      cell('一次解決率', Math.round((m.fcr || 0) * 100) + '%', m.fcrCount + ' / ' + m.answered.length + '件 ／ 配点25%') +
      cell('応答率', Math.round(m.answerRate * 100) + '%', '放棄呼 ' + m.abandoned + '件 ／ 配点20%') +
      cell('発生費用', '¥' + totalCost().toLocaleString('ja-JP'), '通話料を含む ／ 配点10%') +
      cell('業務報告', Math.round(reportScore * 100) + '%', '必須・漏れ・冗長さ ／ 配点10%') +
      cell('AHT', m.aht === null ? '—' : m.aht.toFixed(1) + '分', '平均通話時間 ／ 配点なし') +
      cell('所要', (state.clock - SHIFT_START) + '分', '22:00 〜 ' + fmtClock(state.clock)) +
    '</div>' +

    complaintMailbox +
    '<h2>一件ずつの振り返り</h2>' + reviews +

    '<button class="btn-primary" id="btn-again">' + (state.careerUpdate && state.careerUpdate.endingQueue.length ? '勤務記録を閉じる' : 'もう一度シフトに入る') + '</button>' +
    '<button class="btn-ghost" id="btn-manual2">マニュアルを読む</button>';

  openSheet();
  $('btn-again').onclick = event => {
    if (state.careerUpdate && state.careerUpdate.endingQueue.length){ event.stopImmediatePropagation(); showNextCareerEnding(); }
    else { resetGame(); showBriefing(); }
  };
  $('btn-manual2').onclick = showManual;
}
function cell(k, v, n){
  return '<div class="score-cell"><div class="k">' + k + '</div><div class="v">' + esc(v) + '</div><div class="n">' + esc(n) + '</div></div>';
}
