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
let presentedClock = SHIFT_START;
let timePassage = null;
let officeRingTimer = null;
let officeRingLit = false;
let audioContext = null;
let audioUnlockStatus = 'idle';
const TYPE_SOUND_BASE_HZ = Object.freeze({ male:380, neutral:760, female:1520 });

function currentAudioContextState(){
  return audioContext && audioContext.state ? audioContext.state : 'not-created';
}

function audioStatusText(){
  const context = ' AudioContext: ' + currentAudioContextState() + '。';
  if (!GAME_FLAGS.soundEnabled) return '効果音はOFFです。ONにしてから試してください。' + context;
  if (audioUnlockStatus === 'ready') return '音声機能は利用可能です。試聴音が聞こえなければ、iPhoneのメディア音量・Bluetooth出力先を確認してください。' + context;
  if (audioUnlockStatus === 'needs_gesture') return '音声が中断されています。画面をタップするか「音をテスト」を押して再開してください。' + context;
  if (audioUnlockStatus === 'unavailable') return 'このブラウザでは効果音機能を利用できません。ゲームは音なしで続けられます。' + context;
  if (audioUnlockStatus === 'error') return '音声を開始できませんでした。「音をテスト」を再度タップしてください。' + context;
  return '未確認です。「音をテスト」をタップすると、iPhoneで音声が開始できたか確認できます。' + context;
}

function setAudioUnlockStatus(status){
  audioUnlockStatus = status;
  document.querySelectorAll('[data-audio-status]').forEach(node => { node.textContent = audioStatusText(); });
}

function initAudio(force = false){
  try {
    if (!force && audioContext && audioContext.state !== 'closed') return audioContext;
    if (force && audioContext){
      const stale = audioContext;
      audioContext = null;
      try { if (stale.state !== 'closed' && typeof stale.close === 'function') stale.close(); } catch (error){ /* 新規作成は続ける */ }
    }
    audioContext = null;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass){
      const created = new AudioContextClass();
      audioContext = created;
      created.onstatechange = () => {
        if (audioContext !== created) return;
        setAudioUnlockStatus(created.state === 'running' ? 'ready' : 'needs_gesture');
      };
    }
    else setAudioUnlockStatus('unavailable');
  } catch (error){
    audioContext = null;
    setAudioUnlockStatus('error');
  }
  return audioContext;
}

function primeAudioContext(ctx){
  try { synthTone(ctx, 0.01, 220, 0, 0.01, { level:0.0001 }); }
  catch (error){ /* priming非対応でもresumeは続ける */ }
}

async function recreateAudioContextFromGesture(stale){
  try {
    if (stale && stale.state !== 'closed' && typeof stale.close === 'function') await stale.close();
  } catch (error){ /* 閉じられなくても参照を外して作り直す */ }
  if (audioContext === stale) audioContext = null;
  const fresh = initAudio(true);
  if (!fresh) return null;
  primeAudioContext(fresh);
  try {
    if (fresh.state !== 'running' && typeof fresh.resume === 'function') await fresh.resume();
  } catch (error){ /* 下の状態判定で失敗を表示する */ }
  return fresh;
}

async function unlockAudioFromGesture(){
  if (!GAME_FLAGS.soundEnabled){ setAudioUnlockStatus('disabled'); return false; }
  try {
    if (typeof navigator !== 'undefined' && navigator.audioSession){
      try { navigator.audioSession.type = 'playback'; } catch (error){ /* 未対応の値でも再生開始は試す */ }
    }
    let ctx = initAudio();
    if (!ctx) return false;
    /* 状態名を限定しない。iOS独自の interrupted なども、次のタップでまず再開を試す。 */
    primeAudioContext(ctx);
    try {
      if (ctx.state !== 'running' && typeof ctx.resume === 'function') await ctx.resume();
    } catch (error){ /* 戻らなければ下で文脈を作り直す */ }
    if (ctx.state !== 'running') ctx = await recreateAudioContextFromGesture(ctx);
    const ready = Boolean(ctx && ctx.state === 'running');
    setAudioUnlockStatus(ready ? 'ready' : 'needs_gesture');
    return ready;
  } catch (error){
    setAudioUnlockStatus('error');
    return false;
  }
}

function withAudio(makeSound){
  if (!GAME_FLAGS.soundEnabled || !audioContext) return;
  try {
    /* 着信タイマーなど、ユーザー操作外からresumeしてもiOSでは解除できない。 */
    if (audioContext.state !== 'running'){
      if (audioContext.state === 'closed') audioContext = null;
      setAudioUnlockStatus('needs_gesture');
      return;
    }
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
  const audibleGain = Math.min(1, Math.max(0.0001, volume * SOUND_SETTINGS.outputGain * (options.level || 0.12)));
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(audibleGain, start + Math.min(0.02, duration / 3));
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  oscillator.connect(gain); gain.connect(ctx.destination);
  oscillator.start(start); oscillator.stop(end + 0.02);
}

function playOfficeRing(){ withAudio((ctx, volume) => synthTone(ctx, volume, 400, 0, .22, {type:'sine',level:.1})); }
function playPickupSound(){ withAudio((ctx, volume) => { synthTone(ctx, volume, 1150, 0, .035, {type:'square',level:.08}); synthTone(ctx, volume, 520, .04, .045, {type:'square',level:.07}); }); }
function playDisconnectSound(){ withAudio((ctx, volume) => { synthTone(ctx, volume, 400, 0, .18, {level:.07}); synthTone(ctx, volume, 400, .28, .18, {level:.07}); }); }
function typeSoundFrequency(index, line, ticket){
  const gender = line && line.who === 'cust' && ticket && ticket.s ? ticket.s.gender : null;
  const base = gender === 'male' ? TYPE_SOUND_BASE_HZ.male
    : gender === 'female' ? TYPE_SOUND_BASE_HZ.female
    : TYPE_SOUND_BASE_HZ.neutral;
  return base + (index % 3) * 35;
}
function playTypeSound(index, line, ticket){
  if (index % 4) return;
  const frequency = typeSoundFrequency(index, line, ticket);
  withAudio((ctx, volume) => synthTone(ctx, volume, frequency, 0, .018, {type:'square',level:.025}));
}
function playCommandSound(){ withAudio((ctx, volume) => synthTone(ctx, volume, 880, 0, .045, {type:'square',level:.055})); }
function playAudioTestSound(){ withAudio((ctx, volume) => { synthTone(ctx, volume, 523, 0, .12, {type:'triangle',level:.13}); synthTone(ctx, volume, 784, .15, .2, {type:'triangle',level:.13}); }); }
function playStressWarning(){ withAudio((ctx, volume) => { synthTone(ctx, volume, 980, 0, .11, {type:'square',level:.12}); synthTone(ctx, volume, 980, .17, .11, {type:'square',level:.12}); }); }
function playClueSound(){ withAudio((ctx, volume) => { synthTone(ctx, volume, 660, 0, .07, {level:.06}); synthTone(ctx, volume, 880, .08, .1, {level:.07}); }); }
function playBadActionSound(){ withAudio((ctx, volume) => { synthTone(ctx, volume, 155, 0, .42, {type:'sawtooth',level:.1,endFrequency:105}); synthTone(ctx, volume, 164, 0, .36, {type:'square',level:.045,endFrequency:110}); }); }

function closeSoundKind(result){
  if (result.kind === 'complaint' || result.kind === 'hangup') return 'accident';
  if (result.kind === 'deferred') return 'neutral';
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

function timePassageDuration(minutes){
  return Math.min(2800, Math.max(25, minutes * 25));
}

function presentedGameClock(){
  return presentedClock;
}

function renderPresentedTime(minute){
  const rounded = Math.round(minute);
  const topClock = $('clock');
  const officeClock = $('office-clock');
  if (topClock) topClock.textContent = fmtClock(rounded);
  if (officeClock) officeClock.textContent = fmtClock(rounded);
  renderShiftStrip(rounded);
}

function resetTimePassage(){
  if (timePassage && timePassage.frame) cancelAnimationFrame(timePassage.frame);
  timePassage = null;
  presentedClock = state.clock;
  document.body.classList.remove('time-advancing');
}

function finishTimePassage(){
  if (!timePassage) return false;
  if (timePassage.frame) cancelAnimationFrame(timePassage.frame);
  const target = timePassage.to;
  const onComplete = timePassage.onComplete;
  timePassage = null;
  presentedClock = target;
  document.body.classList.remove('time-advancing');
  renderPresentedTime(presentedClock);
  if (onComplete) onComplete();
  return true;
}

function startTimePassageIfNeeded(onComplete = null){
  const target = state.clock;
  if (target <= presentedClock) return false;
  if (timePassage){
    if (onComplete) timePassage.onComplete = onComplete;
    return true;
  }
  const from = presentedClock;
  const minutes = target - from;
  timePassage = { from, to:target, startedAt:null, frame:null, onComplete };
  document.body.classList.add('time-advancing');
  const indicator = $('time-passage-indicator');
  if (indicator) indicator.textContent = minutes + '分経過中 ／ タップで進む';
  if (typewriterOff()){
    finishTimePassage();
    return true;
  }
  const duration = timePassageDuration(minutes);
  const step = timestamp => {
    if (!timePassage) return;
    if (timePassage.startedAt === null) timePassage.startedAt = timestamp;
    const progress = clamp((timestamp - timePassage.startedAt) / duration, 0, 1);
    presentedClock = from + (target - from) * progress;
    renderPresentedTime(presentedClock);
    if (progress >= 1){ finishTimePassage(); return; }
    timePassage.frame = requestAnimationFrame(step);
  };
  timePassage.frame = requestAnimationFrame(step);
  return true;
}

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
    playTypeSound(pos, line, t);
    if (pos >= line.text.length){ finishTyping(false); return; }
    typeTimer = setTimeout(step, /[、。！？!?]/.test(line.text[pos - 1]) ? 175 : 25);
  };
  typeTimer = setTimeout(step, 25);
}

function render(){
  if (state.phase === 'office'){ renderOffice(); return; }
  if (state.phase === 'desk'){ renderDesk(); return; }
  if (state.phase !== 'call') return;
  mountShiftStrip(false);
  $('clock').textContent = fmtClock(presentedGameClock());
  renderShiftStrip(presentedGameClock());
  renderQueue();
  renderCall();
  startTimePassageIfNeeded();
}

function mountShiftStrip(inOffice){
  const strip = $('shift-strip');
  const slot = $(inOffice ? 'office-shift-slot' : 'topbar-shift-slot');
  if (strip && slot && strip.parentElement !== slot) slot.appendChild(strip);
}

function metrics(){
  const finished = state.tickets.filter(t => t.result);
  const scored = finished.filter(t => !unscoredOutcome(t));
  const answered = scored.filter(t => t.result.kind !== 'abandoned');
  const abandoned = state.tickets.reduce((sum, t) => sum + (Number.isInteger(t.abandonedCalls)
    ? t.abandonedCalls
    : (t.result && t.result.kind === 'abandoned' ? 1 : 0)), 0);
  const csats = answered.map(t => t.result.csat);
  const csat = csats.length ? csats.reduce((a,b) => a+b, 0) / csats.length : null;
  const fcrCount = answered.filter(t => t.result.firstCallResolved).length;
  const fcr = answered.length ? fcrCount / answered.length : null;
  const answerAttempts = answered.length + abandoned;
  const answerRate = answerAttempts ? answered.length / answerAttempts : 1;
  const handled = state.tickets.filter(t => t.callMinutes > 0 && !unscoredOutcome(t));
  const aht = handled.length ? handled.reduce((n,t) => n + t.callMinutes, 0) / handled.length : null;
  return { finished, scored, answered, abandoned, unscored:finished.length - scored.length, csat, fcrCount, fcr, answerRate, aht };
}

function renderShiftStrip(displayClock = state.clock){
  const strip = $('shift-strip');
  if (!strip) return;

  const pinRecords = [];
  state.tickets.forEach(t => {
    const attempts = Array.isArray(t.attempts) ? t.attempts : [];
    attempts.forEach((attempt, index) => {
      const isCurrentAbandon = t.result && t.result.kind === 'abandoned' && index === attempts.length - 1;
      if (attempt.kind === 'abandoned' && !isCurrentAbandon && attempt.arrivedTurn <= state.turn){
        pinRecords.push({ t, arrivedTurn:attempt.arrivedTurn, cls:'abandoned', status:'放棄呼' });
      }
    });
    if (t.handover || t.arrivedTurn <= state.turn){
      let cls = 'closed';
      if (t.state === 'waiting') cls = 'waiting';
      else if (t.state === 'open') cls = 'active';
      else if (t.state === 'callback') cls = 'callback';
      else if (t.result && t.result.kind === 'abandoned') cls = 'abandoned';
      const status = cls === 'waiting' ? '待ち中' : cls === 'active' ? '通話中' : cls === 'callback' ? (t.handover ? '引き継ぎ折り返し待ち' : '現地キャリア照会中') : cls === 'abandoned' ? '放棄呼' : '完了';
      pinRecords.push({ t, arrivedTurn:t.arrivedTurn, cls, status });
    }
  });

  const seen = new Map();
  const pins = pinRecords.map(({ t, arrivedTurn, cls, status }) => {
    const pos = clamp(arrivedTurn / SHIFT_DURATION * 100, 0, 100);
    const key = pos.toFixed(3);
    const stack = seen.get(key) || 0;
    seen.set(key, stack + 1);
    return '<span class="shift-pin ' + cls + '" style="left:' + pos.toFixed(2) + '%;--stack:' + stack + '" ' +
      'title="' + esc(t.s.city) + ' ' + esc(localClock(t)) + ' ' + status + '" aria-label="' + esc(t.s.city) + ' ' + status + '">' +
      '<i class="shift-pin-dot"></i><span class="shift-pin-label">' + esc(t.s.id) + '</span></span>';
  }).join('');

  const ticks = [
    [0,'23'], [25,'01'], [50,'03'], [75,'05'], [100,'07'],
  ].map(([pos,label], index) => '<span class="shift-tick ' + (index < 3 ? 'light' : 'dark') + ' ' + (index === 0 ? 'first' : index === 4 ? 'last' : '') + '" style="left:' + pos + '%">' + label + '</span>').join('');
  const now = clamp((displayClock - SHIFT_START) / SHIFT_DURATION * 100, 0, 100);

  strip.innerHTML =
    '<div class="shift-sky"></div>' +
    '<div class="shift-axis">' +
      ticks + '<span class="shift-now" style="left:' + now.toFixed(2) + '%" aria-label="現在時刻"></span>' + pins +
    '</div>';
}

function renderQueue(){
  const q = state.tickets.filter(t => t.state === 'waiting')
    .sort((a,b) => a.arrivedTurn - b.arrivedTurn);
  const callbacks = state.tickets.filter(t => t.state === 'callback');
  const longest = q.length ? Math.max(0, ...q.map(t => state.turn - t.arrivedTurn)) : 0;
  $('queue-count').textContent = q.length + '件';
  $('call-summary').innerHTML = '<b>待ち ' + q.length + '件 ／ 最長 ' + longest + '分</b><br>折り返し待ち <b>' + callbacks.length + '件</b><br><span class="hint-bar">通話中は個別の電話を取れません。保留時間と待ち行列を見比べて判断してください。</span>';
  $('queue-hint').innerHTML = '終話後はオフィスで、新しい電話を取るか、照会結果が出た相手へ電話をかけます。';
}

function pixelRect(ctx, color, x, y, width, height){
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
}

function drawCeilingLights(ctx, p){
  // 16-bit風の天井。蛍光灯を「白い長方形」だけで終わらせず、枠・反射・梁で奥行きを作る。
  pixelRect(ctx, p.navy, 0, 0, 192, 35);
  pixelRect(ctx, p.ink, 0, 0, 192, 3);
  for (let x = 0; x <= 192; x += 48){
    pixelRect(ctx, p.blue, x, 3, 2, 32);
    pixelRect(ctx, p.charcoal, x + 2, 3, 1, 32);
  }
  for (const y of [5, 22]){
    pixelRect(ctx, p.blue, 0, y - 2, 192, 1);
    for (const x of [7, 55, 103, 151]){
      pixelRect(ctx, p.charcoal, x - 2, y - 1, 36, 11);
      pixelRect(ctx, p.silver, x, y, 32, 9);
      pixelRect(ctx, p.white, x + 3, y + 2, 26, 4);
      pixelRect(ctx, p.glow, x + 5, y + 6, 22, 1);
    }
  }
}

function drawBackWall(ctx, p){
  pixelRect(ctx, p.silver, 0, 35, 192, 37);
  pixelRect(ctx, p.white, 0, 36, 192, 2);
  pixelRect(ctx, p.gray, 0, 68, 192, 4);
  pixelRect(ctx, p.charcoal, 0, 72, 192, 2);
  // 奥の消灯したモニターとブラインド。小さくても「夜の無人フロア」を読ませる。
  for (const x of [7, 36, 65, 94]){
    pixelRect(ctx, p.charcoal, x, 42, 25, 22);
    pixelRect(ctx, p.black, x + 2, 44, 21, 18);
    for (let y = 46; y < 61; y += 4) pixelRect(ctx, p.blue, x + 2, y, 21, 1);
    pixelRect(ctx, p.gray, x + 10, 64, 5, 3);
  }
  pixelRect(ctx, p.charcoal, 126, 40, 58, 27);
  pixelRect(ctx, p.blue, 128, 42, 54, 23);
  for (let y = 44; y < 64; y += 4) pixelRect(ctx, p.silver, 128, y, 54, 1);
  for (const x of [128, 146, 164, 182]) pixelRect(ctx, p.gray, x, 42, 2, 23);
  pixelRect(ctx, p.paper, 112, 62, 15, 6);
  pixelRect(ctx, p.white, 115, 59, 10, 4);
  pixelRect(ctx, p.paper, 176, 35, 9, 5);
  pixelRect(ctx, p.red, 177, 36, 2, 1);
}

function drawDeskIslands(ctx, p){
  pixelRect(ctx, p.carpet, 0, 74, 192, 94);
  // カーペットの遠近線と、机の影。1段の陰影だけで深さを作る。
  for (let y = 82; y < 168; y += 18) pixelRect(ctx, p.carpetShade, 0, y, 192, 1);
  for (const x of [15, 48, 80, 112, 144, 176]){
    pixelRect(ctx, p.carpetShade, x, 74, 1, 94);
  }
  // 奥の島は細く、手前の島は太くしてカメラ寄りに見せる。
  pixelRect(ctx, p.black, 13, 82, 166, 5);
  pixelRect(ctx, p.charcoal, 16, 86, 160, 4);
  pixelRect(ctx, p.silver, 18, 90, 156, 8);
  pixelRect(ctx, p.white, 20, 91, 152, 2);
  pixelRect(ctx, p.gray, 18, 98, 156, 3);
  pixelRect(ctx, p.black, 11, 120, 170, 6);
  pixelRect(ctx, p.charcoal, 15, 126, 162, 5);
  pixelRect(ctx, p.silver, 18, 131, 156, 12);
  pixelRect(ctx, p.white, 20, 132, 152, 3);
  pixelRect(ctx, p.gray, 18, 143, 156, 4);
  pixelRect(ctx, p.navy, 18, 147, 156, 3);
  pixelRect(ctx, p.blue, 20, 150, 152, 2);
}

function drawOfficeStation(ctx, p, station, ringLit){
  const x = station.x;
  const y = station.y;
  const screen = station.active ? p.glow : p.black;
  // モニターは枠・液晶・反射・台座まで描く。自席だけに白い反射を入れて点灯を強調する。
  pixelRect(ctx, p.black, x + 2, y - 15, 22, 14);
  pixelRect(ctx, p.charcoal, x + 4, y - 13, 18, 11);
  pixelRect(ctx, screen, x + 6, y - 11, 14, 7);
  if (station.active){
    pixelRect(ctx, p.white, x + 8, y - 10, 5, 2);
    pixelRect(ctx, p.glow, x + 7, y - 6, 11, 1);
  }
  pixelRect(ctx, p.gray, x + 11, y - 2, 4, 3);
  pixelRect(ctx, p.charcoal, x + 10, y + 1, 6, 3);
  pixelRect(ctx, p.black, x + 7, y + 4, 12, 2);
  const phoneColor = station.active && ringLit ? p.red : p.charcoal;
  pixelRect(ctx, p.black, x + 26, y - 8, 11, 10);
  pixelRect(ctx, phoneColor, x + 27, y - 7, 9, 7);
  pixelRect(ctx, station.active && ringLit ? p.amber : p.black, x + 29, y - 5, 5, 2);
  pixelRect(ctx, p.paper, x + 28, y + 2, 9, 3);
  pixelRect(ctx, p.charcoal, x + 2, y + 7, 11, 16);
  for (const drawerY of [y + 9, y + 14, y + 19]){
    pixelRect(ctx, p.gray, x + 4, drawerY, 7, 3);
    pixelRect(ctx, p.silver, x + 5, drawerY + 1, 2, 1);
  }
  // 椅子は背もたれ・座面・キャスターまで。人物ではなく無人の席として残す。
  pixelRect(ctx, p.navy, x + 19, y + 12, 17, 9);
  pixelRect(ctx, p.charcoal, x + 21, y + 20, 13, 4);
  pixelRect(ctx, p.black, x + 26, y + 24, 3, 4);
  pixelRect(ctx, p.black, x + 20, y + 27, 15, 2);
  pixelRect(ctx, p.black, x + 19, y + 29, 3, 2);
  pixelRect(ctx, p.black, x + 33, y + 29, 3, 2);
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

function drawHandoverMeeting(){
  const canvas = $('handover-office-canvas');
  if (!canvas) return;
  drawOfficePixelArt(false, 'handover-office-canvas', OFFICE_PALETTE);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const p = OFFICE_PALETTE;
  // 奥の設備を隠し切らない大きさで、申し送り用ホワイトボードを重ねる。
  pixelRect(ctx, p.black, 43, 20, 106, 62);
  pixelRect(ctx, p.silver, 45, 22, 102, 58);
  pixelRect(ctx, p.white, 49, 26, 94, 48);
  pixelRect(ctx, p.blue, 56, 32, 32, 3);
  pixelRect(ctx, p.carpet, 56, 39, 61, 2);
  pixelRect(ctx, p.carpet, 56, 45, 48, 2);
  pixelRect(ctx, p.amber, 119, 31, 14, 11);
  pixelRect(ctx, p.red, 123, 47, 10, 9);
  pixelRect(ctx, p.charcoal, 94, 79, 5, 12);
  pixelRect(ctx, p.black, 76, 89, 42, 3);
  const meetingStaff = [
    { x:78, y:120, facing:'back', hair:'short', hairColor:'black', coat:'blue', shoulders:12 },
    { x:115, y:120, facing:'back', hair:'bob', hairColor:'charcoal', coat:'silver', shoulders:11 },
  ];
  meetingStaff.forEach(staff => drawMorningStaffMember(ctx, p, staff));
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

function callbackTimeLabel(t){
  return t && t.callbackKind === 'tomorrow' ? '翌日（日勤へ引き継ぎ）' : fmtClock(t.callbackDue);
}

function renderOffice(){
  document.body.classList.add('office-view');
  document.body.classList.remove('call-view');
  mountShiftStrip(true);
  $('clock').textContent = fmtClock(presentedGameClock());
  $('office-clock').textContent = fmtClock(presentedGameClock());
  $('office-slogan').textContent = state.slogan;
  renderShiftStrip(presentedGameClock());
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
  $('office-tray-status').textContent = callbacks.length
    ? '折り返し待ち ' + callbacks.length + '件 ／ ' + callbacks[0].s.id + (callbacks[0].callbackKind === 'tomorrow' ? 'は翌日（日勤へ引き継ぎ）' : 'まであと ' + callbackRemaining + '分')
    : '折り返し待ち 0件';
  const officeNotices = [];
  if (state.outageKnown) officeNotices.push(esc(state.outageRegion) + '：提携キャリアの広域障害<br>復旧見込み 未定');
  state.officeEvents.slice(-3).forEach(event => officeNotices.push(esc(event.text)));
  $('office-notice').innerHTML = officeNotices.length
    ? officeNotices.map(text => '<div class="notice">' + text + '</div>').join('')
    : '<div class="blank">特記事項なし</div>';
  $('office-answer').disabled = !waiting.length;
  $('office-answer-status').textContent = '待ち ' + waiting.length + '件';
  $('office-callback').disabled = !readyCallbacks.length;
  $('office-callback-status').textContent = callbacks.length
    ? (readyCallbacks.length ? '折り返し可能 ' + readyCallbacks.length + '件' : '折り返し予定 ' + callbacks.length + '件 ／ ' + callbackTimeLabel(callbacks[0]))
    : '折り返し 0件';
  $('office-desk').disabled = !callbacks.length;
  $('office-desk-status').textContent = callbacks.length ? '調査可能 ' + callbacks.length + '件' : '調査可能 0件';
  $('office-verify').disabled = waiting.length > 0 || readyCallbacks.length > 0;
  $('office-verify-status').textContent = '完了 ' + state.verifiedDevices + '台 ／ 作業 ' + state.deviceVerificationMinutes + ' / ' + DEVICE_VERIFICATION_MINUTES + '分';
  startTimePassageIfNeeded();
}

function enterOffice(){
  if (state.phase === 'report') return;
  state.phase = 'office';
  activateDueInbound();
  if (state.phase === 'report') return;
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
  mountShiftStrip(false);
  $('clock').textContent = fmtClock(presentedGameClock());
  renderShiftStrip(presentedGameClock());
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
  startTimePassageIfNeeded();
}

/* 通話は切れているので、通話時間と通話料の代わりに折り返しの約束時刻を出す。 */
function renderDeskHeader(t){
  return '<div class="call-head">' +
      '<span class="call-ticket"><b>チケット</b> ' + esc(t.s.id) + '</span>' +
      '<span class="call-time">通話は切断中</span>' +
      '<span class="call-cost">折り返し ' + callbackTimeLabel(t) + '</span>' +
    '</div>';
}

function renderDeskTicketChoice(list){
  return '<div class="opts">' + list.map(t =>
    '<button class="opt" data-desk-ticket="' + t.s.id + '"><span class="opt-label">' + esc(customerLabel(t, true)) +
    '<span class="opt-sub">折り返しの約束 ' + callbackTimeLabel(t) + '</span></span></button>'
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
    '<p class="hint-bar">通話中ではないので、お客様の満足度は下がりません。ただし時間は進むため、折り返しが約束より遅れることがあります。</p>';
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
  const promiseHeads = {
    immediate:CALL_FLOW_LINES.callbackPromise.headImmediate,
    scheduled:CALL_FLOW_LINES.callbackPromise.headScheduled,
    three_hours:CALL_FLOW_LINES.callbackPromise.headThreeHours,
    tomorrow:CALL_FLOW_LINES.callbackPromise.headTomorrow,
  };
  const promised = t.callbackPromised ? '<span class="call-promise">' + promiseHeads[t.callbackPromised] + '</span>' : '';
  /* §48-7: 電話の状態を1か所へ集める。保留の累計はこれまで業務報告でしか見えず、
     通話中に「どれだけ待たせているか」が分からなかった。待ち件数は、他の客を
     待たせている自覚のために要る。
     現地時刻はここへ置かない。§41 で氏名・都市・機種・プランとともにログへ移した
     もので、ヘッダを軽く保つ判断のほうが先にある。 */
  const held = t.holdMinutes ? '<span class="call-hold">うち保留 ' + t.holdMinutes + '分</span>' : '';
  const waiting = state.tickets.filter(ticket => ticket.state === 'waiting').length;
  return '<div class="call-head">' +
      '<span class="call-ticket"><b>チケット</b> ' + esc(t.s.id) + '</span>' +
      '<span class="call-time">通話 ' + String(t.callSegmentMinutes || 0).padStart(2,'0') + '分</span>' +
      held +
      '<span class="call-cost">' + payer + ' ¥' + cost.toLocaleString('ja-JP') + '</span>' +
      '<span class="call-waiting">待ち ' + waiting + '件</span>' +
      promised +
    '</div>';
}

function stressDisplayStage(value){
  if (value <= 50) return { label:'平静', className:'calm' };
  if (value <= 70) return { label:'苛立ち', className:'irritated' };
  if (value <= 90) return { label:'怒り', className:'angry' };
  return { label:'限界', className:'limit' };
}

/* §48-6: 画面には満足度として出す。内部の stress は「上がるほど悪い」のまま据え置き、
   ここで 100 から引いて反転するだけにする。なだめ・お詫び・雑談の効果表がすべて
   stress の符号で組まれているので、内部まで裏返すと全部の符号が逆になる。 */
function satisfactionFromStress(stress){
  return Math.round(100 - stress);
}

function renderStressPanel(t){
  if (!customerHasSpoken(t)){
    return '<section class="stress-panel unknown" aria-label="顧客の満足度はまだ分かりません">' +
      '<div class="stress-panel-head"><span>顧客の満足度</span><b>—</b><strong>まだ不明</strong></div>' +
      '<i class="stress-track"><b class="stress-fill" style="width:0%"></b></i></section>';
  }
  const stage = stressDisplayStage(t.stress);
  const satisfaction = satisfactionFromStress(t.stress);
  return '<section class="stress-panel ' + stage.className + (t.stress > 80 ? ' alert' : '') + '" aria-label="顧客の満足度 ' + satisfaction + 'パーセント ' + stage.label + '">' +
    '<div class="stress-panel-head"><span>顧客の満足度</span><b>' + satisfaction + '%</b><strong>' + stage.label + '</strong></div>' +
    '<i class="stress-track"><b class="stress-fill" style="width:' + satisfaction + '%"></b></i></section>';
}

function recentTranscriptLines(t){
  const pending = pendingTypedLine(t);
  const end = pending ? t.transcript.indexOf(pending) + 1 : t.transcript.length;
  const start = Number.isInteger(t.callTranscriptStart) ? t.callTranscriptStart : 0;
  const delivered = t.transcript.slice(start, end);
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
  const spoken = delivered.filter(line => line.who === 'cust' || line.who === 'front' || line.who === 'me');
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
  let runStart = customerIndex;
  while (runStart > 0 && (spoken[runStart - 1].who === 'cust' || spoken[runStart - 1].who === 'front')) runStart--;
  const player = spoken.slice(0, runStart).reverse().find(line => line.who === 'me');
  return (player ? [player] : []).concat(spoken.slice(runStart, customerIndex + 1)).slice(-4);
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
  if (state.ui.shipping) return '<div class="actions">' + renderCommandHead('国際配送の手配', '配送方法を選んでください。') + renderShipping(t) + '</div>';

  if (t.pendingResult){
    if (pendingTypedLine(t)) return '<div class="actions"><div class="pending-note">お客様の最後の言葉を聞いています。</div></div>';
    /* §51-2: 名前を伺えていなければ、切る前にここで気づける。解決したあとなので、
       怒っていた客でも答える。取り返せるのは名前だけで、対処の選び直しはできない。 */
    const recordGap = t.nameKnown ? '' :
      '<div class="record-gap"><b>お名前を伺えていないため、社内システムへ記録を残せません。</b>' +
      '<button class="opt" data-late-name="1"><span class="opt-label">お名前を確認する' +
      '<span class="opt-sub">解決したいま伺えば、記録を残せます。</span></span></button></div>';
    return '<div class="actions">' + recordGap + renderCallCompletionButton('お客様との会話が終わりました。終話してください。', pendingResultButtonLabel(t.pendingResult)) + '</div>';
  }
  if (state.ui.tab === 'refund_confirm') return '<div class="actions">' + renderRefundConfirmation() + '</div>';
  if (t.callbackStage === 'front_desk') return '<div class="actions">' + renderFrontDeskOptions(t) + '</div>';

  if (!t.greeted && !customerHasSpoken(t)) return '<div class="actions"><div class="command-box"><div class="command-title"><span>CALL</span><b>まず名乗ってください</b></div><button class="command-choice" data-greet="1"><span class="command-no">1</span><span class="command-copy"><b>名乗る</b><small>お電話ありがとうございます。グローバルデスクでございます</small></span></button></div></div>';

  const tab = state.ui.tab || 'command';
  const actionClass = 'actions' + (pendingTypedLine(t) ? ' is-typing' : '');
  if (tab === 'command') return renderCommandMenu(t, actionClass);
  if (tab === 'ask'){
    const group = QUESTION_GROUPS.find(item => item.id === state.ui.askGroup);
    return '<div class="' + actionClass + '">' +
      renderCommandHead('聞く', group ? group.label : '何について聞きますか？', group ? 'ask' : 'command') +
      (group ? renderAskOptions(t, group) : renderAskGroups(t)) + '</div>';
  }
  if (tab === 'tell'){
    return '<div class="' + actionClass + '">' + renderCommandHead('伝える', '何を伝えますか？') + renderTellOptions(t) + '</div>';
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
  return '<div class="' + actionClass + '">' + renderCommandHead(command, prompt, backTarget) + renderBody() + '</div>';
}

function pendingResultButtonLabel(result){
  return '電話を切る';
}

function renderCallCompletionButton(note, label){
  return '<div class="call-completion"><p>' + esc(note) + '</p><button class="call-completion-button" data-finish-call="1">' + esc(label) + '</button></div>';
}

function renderRefundConfirmation(){
  return '<div class="refund-confirm"><b>¥' + REFUND_POLICY.amount.toLocaleString('ja-JP') + 'の返金をご提案します。受け入れていただければ、この電話は終わります。よろしいですか？</b><div><button class="refund-confirm-button" data-refund-confirm="1">返金を提案する</button><button class="command-back" data-refund-cancel="1">対応に戻る</button></div></div>';
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
  return '<div class="' + actionClass + '"><div class="command-box"><div class="command-title"><span>COMMAND</span><b>コマンドを選んでください</b></div>' + optionalGreeting + '<div class="command-grid">' + choices + '</div></div>' + chargeHint + '</div>';
}

/* 折り返しはこちらから掛け直す行為なので、折り返し中の通話には出さない。 */
function hotelCallbackOffered(t){
  return t.callDirection !== 'outbound' && !t.callbackPromised;
}

function hotelCallbackSub(t){
  if (!hotelContactKnown(t)) return 'ホテル名と滞在先はまだ伺っていません。';
  const destination = '折り返し先：' + t.stayHotelName + '。';
  return destination + (t.callChargeConcerned ? 'お客様が国際通話料を気にしています。' : '5分を超えそうなら、お客様の通話料を止められます。');
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
  return '<p class="hint-bar"><b>発信先：' + esc(t.stayHotelName) + '</b></p>' + frontContext + renderCommandHead('Front Desk', 'Please choose what to say in English.') + '<div class="opts front-desk-options">' +
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
    const complete = availableIds.filter(id => {
      const q = QUESTIONS.find(item => item.id === id);
      return q && (!q.needsCallbackPromise || t.callbackPromised);
    }).every(id => t.asked.has(id));
    return '<button class="command-choice ask-group-choice" data-ask-group="' + group.id + '" ' + (complete ? 'disabled' : '') + '><span class="command-copy"><b>' + esc(group.label) + '</b></span></button>';
  }).join('') + '</div>';
}

function renderAskOptions(t, group){
  const questions = group.questionIds.map(id => QUESTIONS.find(q => q.id === id))
    .filter(q => q && (!q.needsDevice || t.s.deviceInHand) && (!q.needsCallbackPromise || t.callbackPromised));
  return '<div class="opts">' + questions.map(q =>
    '<button class="opt" data-ask="' + q.id + '"><span class="opt-label">' + esc(q.label) + ((t.askCounts.get(q.id) || 0) ? '<span class="opt-sub">確認済み ' + t.askCounts.get(q.id) + '回</span>' : '') + '</span><span class="cost">' + (q.id === 'q_contract' && !t.asked.has(q.id) ? t.s.contractId.minutes : 1) + '分</span></button>'
  ).join('') + (group.id === 'customer' ? renderSmalltalkChoices(t, 'ask') : '') + '</div><p class="hint-bar">同じ質問もできますが、時間を使い、回答済みならお客様のストレスが大きく増えます。</p>';
}

function renderTellOptions(t){
  const entries = [
    { attrs:'data-end-call="1"', body:'<span class="opt-label">電話を切る</span>' },
    { attrs:'data-tell="close"', body:'<span class="opt-label">' + (t.symptomResolved ? '原因を伝える' : '原因と対処を伝える') + '<span class="opt-sub">' + (t.symptomResolved ? '復旧した原因をご説明します。' : '原因を見立てて、対処をご案内します。') + '</span></span>' },
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
  const hotelReady = hotelContactKnown(t);
  return '<div class="opts"><button class="opt" data-lookup-back="1"><span class="opt-label">← 照会項目の選び直し</span></button>' +
    '<button class="opt" disabled><span class="opt-label">保留にして調べる<span class="opt-sub">30分かかるため、通話をつないだままでは実行できません</span></span><span class="cost">不可</span></button>' +
    '<button class="opt" disabled><span class="opt-label">話しながら調べる<span class="opt-sub">社外への再開通依頼のため、通話継続では実行できません</span></span><span class="cost">不可</span></button></div>' +
    '<p class="hint-bar"><b>現地キャリアへ再開通を依頼します。30分ほどお時間をいただき、完了状況が分かり次第折り返します。</b><br>折り返し先を選ぶと、通話を終えて再開通依頼を始めます。</p>' +
    '<div class="opts"><button class="opt" data-callback-destination="hotel" ' + (hotelReady ? '' : 'disabled') + '><span class="opt-label">ホテルへ折り返す<span class="opt-sub">' + (hotelReady ? esc(t.stayHotelName) : 'ホテル名と滞在先を未確認') + 'のフロントを通して客室につないでもらいます</span></span><span class="cost">' + lookup.minutes + '分</span></button></div>' +
    (hotelReady ? '' : '<p class="hint-bar">ホテル客室はホテル名と滞在先が未確認です。「聞く」で確認してください。</p>');
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
  const handover = t.handover
    ? '<section class="record-system-block handover-record"><h3>日勤引き継ぎ</h3><div class="log-customer">' +
      '<p><b>誰か</b><span>' + esc(t.s.name) + '様</span></p>' +
      '<p><b>何が</b><span>' + esc(t.s.handoverSymptom) + '</span></p>' +
      '<p><b>いつ</b><span>' + fmtClock(t.callbackDue) + 'ごろに連絡</span></p></div></section>'
    : '';
  return '<div class="log-view">' + base + handover + (includeLog ? renderRecordLog(t) : '') + '</div><footer>RECORD ／ VERIFIED</footer></section></div>';
}
function renderRecordLog(t){
  return '<section class="record-system-block"><h3>会話の全履歴</h3><div class="record-system-transcript">' + renderRecordTranscript(t) + '</div></section>';
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

function commandPrompt(tab){
  return {
    lookup:['調べる', state.ui.lookup ? 'どの方法で調べますか？' : '何を調べますか？'],
    try:['やってみてもらう', '何を試していただきますか？'],
    soothe:['気持ちを落ち着ける', 'どの言葉をかけますか？'],
    apologize:['お詫びする', 'どの深さでお詫びしますか？'],
    smalltalk:['一言かける', '会話に出た話題から選んでください'],
    record:['ログ', 'この通話の状況と全履歴'],
    identity_denied:['本人確認', '本人確認が必要です'],
    close:[state.focus && state.focus.symptomResolved ? '原因を伝える' : '原因と対処を伝える', state.ui.cause ? (state.focus && state.focus.symptomResolved ? 'どの対処が効いたかを選んでください' : '対処を選んでください') : '原因を選んでください'],
  }[tab] || ['コマンド', '次の行動を選んでください'];
}

function renderCommandHead(command, prompt, backTarget = 'command'){
  return '<div class="command-panel-head"><button class="command-back" data-command="' + backTarget + '">← もどる</button>' +
    '<div><span>COMMAND ／ ' + esc(command) + '</span><b>' + esc(prompt) + '</b></div></div>';
}

function renderCloseFlow(t){
  if (!state.ui.cause){
    return '<div class="opts">' + CAUSES.map(c => {
      return '<button class="opt" data-cause="' + c.id + '">' +
        '<span class="opt-label">' + esc(c.label) + '<span class="opt-sub">' + c.tier + '</span></span>' +
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

  return '<button class="btn-primary" data-close-confirm="1">この内容をお客様へ伝える</button>';
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

/* ============================================================
   オーバーレイ
   ============================================================ */

/* シートの開閉。開いている間はコンソールを隠し、通常のスクロールに戻す */
function openSheet(kind = ''){
  $('sheet').classList.toggle('briefing-sheet', kind === 'briefing');
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

function defaultSoundSettings(){
  return { enabled:SOUND_SETTINGS.defaultEnabled, volume:SOUND_SETTINGS.defaultVolume };
}

function readSoundSettings(storage = getCareerStorage()){
  const fallback = defaultSoundSettings();
  try {
    if (!storage) return fallback;
    const raw = storage.getItem(SOUND_SETTINGS.storageKey);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      enabled:typeof parsed.enabled === 'boolean' ? parsed.enabled : fallback.enabled,
      volume:Number.isFinite(parsed.volume) ? clamp(parsed.volume, 0, 1) : fallback.volume,
    };
  } catch (error){ return fallback; }
}

function writeSoundSettings(storage = getCareerStorage()){
  try {
    if (!storage) return false;
    storage.setItem(SOUND_SETTINGS.storageKey, JSON.stringify({ enabled:GAME_FLAGS.soundEnabled, volume:GAME_FLAGS.soundVolume }));
    return true;
  } catch (error){ return false; }
}

function syncSoundControls(){
  const enabled = GAME_FLAGS.soundEnabled;
  document.querySelectorAll('[data-sound-toggle]').forEach(button => {
    button.textContent = button.dataset.soundCompact ? (enabled ? '音 ON' : '音 OFF') : (enabled ? '音をOFFにする' : '音をONにする');
    button.setAttribute('aria-label', enabled ? '効果音をOFFにする' : '効果音をONにする');
    button.setAttribute('aria-pressed', String(enabled));
  });
  document.querySelectorAll('[data-sound-state]').forEach(node => { node.textContent = enabled ? 'ON' : 'OFF'; });
  const balanceSound = $('balance-sound');
  const balanceVolume = $('balance-volume');
  if (balanceSound) balanceSound.checked = enabled;
  if (balanceVolume) balanceVolume.value = String(GAME_FLAGS.soundVolume);
}

function initializeSoundSettings(storage = getCareerStorage()){
  const saved = readSoundSettings(storage);
  GAME_FLAGS.soundEnabled = saved.enabled;
  GAME_FLAGS.soundVolume = saved.volume;
  syncSoundControls();
}

function setSoundEnabled(enabled, storage = getCareerStorage()){
  GAME_FLAGS.soundEnabled = Boolean(enabled);
  setAudioUnlockStatus(GAME_FLAGS.soundEnabled ? 'idle' : 'disabled');
  writeSoundSettings(storage);
  syncSoundControls();
}

function setSoundVolume(volume, storage = getCareerStorage()){
  GAME_FLAGS.soundVolume = clamp(Number(volume), 0, 1);
  writeSoundSettings(storage);
  syncSoundControls();
}

function applySoundEnabledFromGesture(enabled){
  setSoundEnabled(enabled);
  if (!enabled){ stopOfficeRing(); return; }
  initAudio();
  unlockAudioFromGesture().then(ready => { if (ready) playAudioTestSound(); });
}

function toggleSoundFromGesture(){
  applySoundEnabledFromGesture(!GAME_FLAGS.soundEnabled);
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
  return '<section class="career-briefing"><b>' + (career.totals.days + 1) + '日目 ／ ' + esc(CAREER_STAGES[career.stage].label) + '</b>' +
    storageNote + '</section>';
}

function audioDiagnosticHtml(){
  return '<section class="audio-diagnostic" aria-label="iPhone音声の確認">' +
    '<b>iPhoneの音を確認</b><p data-audio-status="1">' + esc(audioStatusText()) + '</p>' +
    '<button class="btn-ghost" data-audio-unlock="1">音をテスト／再有効化</button></section>';
}

function soundQuickControlHtml(){
  return '<div class="sound-quick-control" aria-label="効果音の設定"><span>効果音 <b data-sound-state="1">' + (GAME_FLAGS.soundEnabled ? 'ON' : 'OFF') + '</b></span>' +
    '<button class="btn-ghost" data-sound-toggle="1">' + (GAME_FLAGS.soundEnabled ? '音をOFFにする' : '音をONにする') + '</button></div>';
}

function handoverMeetingTickets(){
  return state.tickets.filter(ticket => ticket.handover).sort((a,b) => a.callbackDue - b.callbackDue);
}

function enterShiftAfterMeeting(){
  if (state.handoverMeetingComplete) return;
  state.handoverMeetingComplete = true;
  closeSheet();
  advance(0);
  enterOffice();
}

function showHandoverMeeting(){
  const tickets = handoverMeetingTickets();
  if (!tickets.length){ enterShiftAfterMeeting(); return; }
  const entries = tickets.map(ticket =>
    '<article class="handover-card"><p><strong>' + esc(ticket.s.name) + '様</strong>が「' +
      esc(ticket.s.handoverSymptom) + '」とお困りなので、<strong>' +
      fmtClock(ticket.callbackDue) + 'ごろ</strong>に連絡してください。</p></article>'
  ).join('');
  $('sheet').innerHTML =
    '<p class="eyebrow">HANDOVER MEETING ／ ' + fmtClock(SHIFT_START) + ' JST</p>' +
    '<h1>23時の引き継ぎ</h1>' +
    '<figure class="handover-figure"><canvas id="handover-office-canvas" width="192" height="168" role="img" aria-label="深夜オフィスのホワイトボードの前で、後ろ姿の日勤担当と夜勤担当が申し送りをしている"></canvas></figure>' +
    '<p class="handover-speaker"><b>日勤担当</b>から、今夜の折り返しを引き継ぎます。</p>' +
    '<div class="handover-list">' + entries + '</div>' +
    '<button class="btn-primary" id="btn-finish-handover">引き継いで夜勤を始める</button>';
  openSheet();
  drawHandoverMeeting();
  $('btn-finish-handover').onclick = enterShiftAfterMeeting;
}

function startShiftFromBriefing(){
  if (handoverMeetingTickets().length){ showHandoverMeeting(); return; }
  enterShiftAfterMeeting();
}

function showBriefing(){
  resetTimePassage();
  $('sheet').innerHTML =
    '<div class="briefing-scroll">' +
      '<p class="eyebrow">SHIFT BRIEFING ／ 08月31日 ' + fmtClock(SHIFT_START) + ' JST</p>' +
      '<h1>深夜のグローバルデスク</h1>' +
      careerBriefingHtml() +
      '<div class="artifact-qr-card" aria-label="iPhoneで遊ぶためのQRコード">' +
        '<canvas class="artifact-qr-canvas" id="artifact-qr-canvas" role="img" aria-label="この公開ページを開くQRコード"></canvas>' +
        '<div class="artifact-qr-copy"><b>iPhoneで遊ぶ</b><p>カメラでQRコードを読み取ると、このページが開きます。</p>' +
        '<code class="artifact-qr-url">' + esc(ARTIFACT_URL) + '</code></div>' +
      '</div>' +
      soundQuickControlHtml() +
      audioDiagnosticHtml() +
    '</div>' +
    '<div class="briefing-actions"><button class="btn-primary" id="btn-start">シフトを始める</button></div>';

  openSheet('briefing');
  syncSoundControls();
  drawArtifactQr();
  $('btn-start').onclick = () => {
    initAudio();
    unlockAudioFromGesture();
    startShiftFromBriefing();
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
  route.push('伝える → 原因と対処を伝える: ' + (cause ? cause.label : s.trueCause));
  if (s.bestNoOutage) route.push('障害未確認なら「' + ((REMEDIES[s.trueCause] || []).find(item => item.id === s.bestNoOutage) || {}).label + '」');
  route.push('対処: ' + (remedy ? remedy.label : s.best));
  if (remedy && remedyNeedsShipping(remedy.id)) route.push('配送: 滞在先・残り日数・本人希望を確認し、必要速度のTGX便を選ぶ');
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
        '<div class="balance-fact"><b>着信</b>勤務中にランダムに決まります（' + fmtClock(SHIFT_START) + '〜' + fmtClock(SHIFT_START + LAST_INBOUND_TURN) + '）</div>' +
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
    audioDiagnosticHtml() +
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
    applySoundEnabledFromGesture(event.target.checked);
  };
  $('balance-volume').oninput = event => {
    setSoundVolume(event.target.value);
  };
  syncSoundControls();
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
    return t && t.result && t.result.kind !== 'abandoned' && !unscoredOutcome(t);
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
  state.tickets.filter(ticket => ticket.result && ticket.result.kind === 'handed_off').forEach(ticket => {
    handoff.push({ id:'morning_handoff_' + ticket.s.id, required:true, ticketId:ticket.s.id, text:ticket.s.name + '様との通話中。' + ticket.s.handoverSymptom + 'の対応を日勤へ引き継ぎ' });
  });
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
  const tickets = state.tickets.filter(ticket => !unscoredOutcome(ticket));
  return {
    maxStresses:tickets.map(ticket => ticket.maxStress),
    redials:tickets.reduce((sum, ticket) => sum + ticket.redialCount, 0),
    abandoned:tickets.reduce((sum, ticket) => sum + (ticket.abandonedCalls || 0), 0),
    resultKinds:tickets.map(ticket => ticket.result && ticket.result.kind).filter(Boolean),
    noRefundsOrShipments:tickets.length > 0 && tickets.every(ticket => ticket.result && ticket.result.kind !== 'refunded' && !ticket.shipment),
    allResolved:tickets.length > 0 && tickets.every(ticket => ticket.result && ticket.result.kind === 'closed'),
    allRefunded:tickets.length > 0 && tickets.every(ticket => ticket.result && ticket.result.kind === 'refunded'),
    solvedScenarioIds:solvedScenarioIdsFromTickets(tickets),
  };
}

function recordCurrentCareerShift(summary = currentShiftSummary()){
  if (state.careerUpdate) return state.careerUpdate;
  if (!state.career) state.career = freshCareerRecord();
  const shift = {
    endedAt:new Date().toISOString(),
    tickets:state.tickets.filter(ticket => !unscoredOutcome(ticket)).length,
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
  if (startTimePassageIfNeeded(() => renderReport())) return;
  const o = reportOptions();
  if (!state.report) state.report = { special:[], handoff:[] };
  const m = metrics();
  const inboundCount = state.tickets.filter(ticket => !ticket.handover).length;
  const handoverCount = state.tickets.filter(ticket => ticket.handover).length;
  const escaped = x => esc(x.text);
  /* 提出前は required を一切見せない。何を報告すべきかを選ぶことがこの画面の中身なので、
     正解が先に見えていると判断が消える。答え合わせは提出後の振り返りで行う */
  const checks = (items, chosen, attr) => items.map(x => '<label class="report-check"><input type="checkbox" data-' + attr + '="' + x.id + '" ' + (chosen.includes(x.id) ? 'checked' : '') + '><span>' + escaped(x) + '</span></label>').join('') || '<p class="empty-note">該当する特記事項はありません。</p>';
  $('sheet').innerHTML =
    '<p class="eyebrow">DAILY REPORT ／ ' + fmtClock(state.clock) + ' JST</p><h1>業務報告 ／ 深夜シフト</h1>' +
    '<div class="report-auto">対応件数 ' + state.tickets.length + '件（入電 ' + inboundCount + '件 ／ 引き継ぎ ' + handoverCount + '件 ／ 放棄呼 ' + m.abandoned + '件 ／ 評価対象外 ' + m.unscored + '件）／ 機器検証 ' + state.verifiedDevices + '台完了 ／ 平均通話 ' + (m.aht === null ? '—' : m.aht.toFixed(1)) + '分 ／ エスカレーション ' + state.tickets.filter(t => t.escUsed).length + '件 ／ 発生費用 ¥' + totalCost().toLocaleString('ja-JP') + '</div>' +
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
    const misses = reportMissForTicket(t);
    if (unscoredOutcome(t)){
      const judge = r.kind === 'unavailable'
        ? '約束どおり一度連絡しましたが不在でした。連絡義務は完了しており、評価には影響しません。'
        : '07:00時点で通話中だったため、放棄呼にせず日勤担当へ対応を引き継ぎました。';
      return '<div class="review mid"><div class="rh"><span class="rn">' + esc(t.s.name) + '</span>' +
        '<span class="rp">' + esc(t.s.cityEn) + '</span><span class="rs">評価対象外 ／ ' + esc(r.label) + ' ／ 通話' + t.callMinutes + '分</span></div>' +
        '<div class="rb">' + esc(judge) + (misses.length ? '<div class="report-miss">これは報告すべきでした：' + misses.map(esc).join(' ／ ') + '</div>' : '') + '</div></div>';
    }
    const cls = r.csat >= 4 ? 'win' : r.csat >= 2.5 ? 'mid' : 'bad';
    let judge;
    if (r.kind === 'abandoned') judge = '呼び出しに応答できず、放棄呼になりました。';
    else if (r.kind === 'complaint') judge = r.reason === 'misdiagnosis' ? '見立てが二度外れ、お客様が強い苦情を述べて終話しました。' : 'お客様のお怒りが限界に達し、強い苦情を述べて終話しました。';
    else if (r.kind === 'hangup') judge = r.reason === 'misdiagnosis' ? '見立てが二度外れ、お客様が一方的に通話を切りました。' : 'お客様のお怒りが限界に達し、一方的に通話を切りました。';
    else if (r.causeMatched === false) judge = '選んだ対応のあと通信は復旧し、一次解決になりました。';
    else if (r.grade === 'best') judge = '原因も対処も最適でした。';
    else if (r.grade === 'partial') judge = '原因は当たっていましたが、対処は次善どまりでした。';
    else judge = '原因は当たっていましたが、対処が噛み合っていませんでした。';

    const abandonmentNote = t.abandonedCalls ? '<br>応答前の放棄呼：' + t.abandonedCalls + '回（履歴に保持）' : '';
    return '<div class="review ' + cls + '">' +
      '<div class="rh"><span class="rn">' + esc(t.s.name) + '</span>' +
      '<span class="rp">' + esc(t.s.cityEn) + '</span>' +
      '<span class="rs">CSAT ' + r.csat.toFixed(1) + ' ／ ' + esc(r.label) + ' ／ 通話' + t.callMinutes + '分（保留' + t.holdMinutes + '分）</span></div>' +
      '<div class="review-csat" aria-label="CSAT ' + r.csat.toFixed(1) + ' / 5"><i style="width:' + clamp(r.csat / 5 * 100, 0, 100) + '%"></i></div>' +
      '<div class="rb"><b style="color:var(--text);font-weight:500">真の原因：' + esc(causeName(t.s.trueCause)) + '</b><br>' +
      /* §51-2: 記録に残すのは名前。免除は置かない——解決したあとなら伺えるので。 */
      esc(judge) + abandonmentNote + '<br>' + (r.identityRecordMissing
        ? 'お名前を伺えなかったため、社内システムへ記録を残せず、評価を下げました。<br>'
        : '') + t.s.debrief + (misses.length ? '<div class="report-miss">これは報告すべきでした：' + misses.map(esc).join(' ／ ') + '</div>' : '') + '</div></div>';
  }).join('');

  /* §50: その場の評価と、後からの評価は別もの。誤診はその場では感謝されて終わり、
     翌日に再発して初めて発覚するので、怒って終わったときとは文面から違う。 */
  const dayAfterMail = (t, templates, label, className) => {
    const template = templates[t.s.type];
    const lines = template.lines.map(line => esc(line.replace('{symptom}', t.s.opening))).join('<br>');
    return '<div class="' + className + '"><b>' + esc(t.s.name) + '様からの' + label + '</b><p>' + lines + '</p></div>';
  };
  const complaintEmails = ts.filter(t => t.complaintEmail).map(t => t.misdiagnosisEmail
    ? dayAfterMail(t, MISDIAGNOSIS_EMAIL_TEMPLATES, '再発のご連絡', 'complaint-email')
    : t.refundComplaint
    ? dayAfterMail(t, BLIND_REFUND_EMAIL_TEMPLATES, '苦情メール', 'complaint-email')
    : dayAfterMail(t, COMPLAINT_EMAIL_TEMPLATES, '苦情メール', 'complaint-email')).join('');
  const complaintMailbox = complaintEmails
    ? '<section class="complaint-mailbox"><h2>翌日、次の苦情が届いています</h2><p>' + ts.filter(t => t.complaintEmail).length + '件</p>' + complaintEmails + '</section>'
    : '';
  const gratitudeEmails = ts.filter(t => t.gratitudeEmail)
    .map(t => dayAfterMail(t, GRATITUDE_EMAIL_TEMPLATES, 'お礼のメール', 'gratitude-email')).join('');
  const gratitudeMailbox = gratitudeEmails
    ? '<section class="gratitude-mailbox"><h2>翌日、お礼が届いています</h2><p>' + ts.filter(t => t.gratitudeEmail).length + '件</p>' + gratitudeEmails + '</section>'
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
      cell('所要', (state.clock - SHIFT_START) + '分', fmtClock(SHIFT_START) + ' 〜 ' + fmtClock(state.clock)) +
    '</div>' +

    complaintMailbox +
    gratitudeMailbox +
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
