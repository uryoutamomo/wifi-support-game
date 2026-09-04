/* 実効表示高が低いスマホで、情報と操作が一つの文書フローに並び、スクロールで届くことを測る。 */
const assert = require('assert');
const path = require('path');
const VIEWPORTS = [
  { width:430, height:708 },
  { width:430, height:745 },
  { width:393, height:659 },
  { width:375, height:553 },
];
const pageUrl = 'file://' + path.join(__dirname, 'index.html');

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function browserAt(port){
  const browser = await (await fetch('http://127.0.0.1:' + port + '/json/version')).json();
  return browser.webSocketDebuggerUrl ? { browserWsUrl:browser.webSocketDebuggerUrl } : null;
}

async function connectChrome(){
  const port = Number(process.env.WIFI_LAYOUT_CDP_PORT);
  assert(Number.isInteger(port) && port > 0, 'WIFI_LAYOUT_CDP_PORT がない。headless Chrome の DevTools ポートを指定して実行する');
  for (let attempt = 0; attempt < 200; attempt++){
    try {
      const endpoints = await browserAt(port);
      if (endpoints) return { port, ...endpoints };
    } catch (error){ /* 起動待ち */ }
    await pause(25);
  }
  throw new Error('Chrome DevTools の起動を待てなかった');
}

async function createdPageAt(port, targetId){
  for (let attempt = 0; attempt < 200; attempt++){
    try {
      const pages = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
      const target = pages.find(page => page.id === targetId && page.type === 'page');
      if (target && target.webSocketDebuggerUrl) return target.webSocketDebuggerUrl;
    } catch (error){ /* ターゲット登録待ち */ }
    await pause(25);
  }
  throw new Error('作成した Chrome ページターゲットに接続できなかった');
}

function connect(wsUrl){
  const socket = new WebSocket(wsUrl);
  let nextId = 1;
  const waiting = new Map();
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    const resolve = waiting.get(message.id);
    if (!resolve) return;
    waiting.delete(message.id);
    if (message.error) resolve.reject(new Error(message.error.message));
    else resolve.resolve(message.result);
  };
  const opened = new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });
  return {
    async ready(){ await opened; },
    send(method, params = {}){
      const id = nextId++;
      return new Promise((resolve, reject) => {
        waiting.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close(){ socket.close(); },
  };
}

async function evaluate(cdp, expression){
  const result = await cdp.send('Runtime.evaluate', { expression, returnByValue:true, awaitPromise:true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'ページ内評価に失敗した');
  return result.result.value;
}

function visibleCenters(label, rects, height){
  assert(rects.length, label + ' が描画されていない');
  rects.forEach(rect => assert(
    rect.width > 0 && rect.height > 0,
    label + ' が描画されていない: ' + JSON.stringify(rect)
  ));
  rects.forEach(rect => assert(
    rect.center >= 0 && rect.center <= height,
    label + ' の中心が初期表示の画面外: ' + JSON.stringify({ height, rect })
  ));
  rects.forEach(rect => assert(rect.hit, label + ' の中心が別要素に覆われている: ' + JSON.stringify(rect)));
}

function verticalFlow(label, rects){
  assert(rects.length, label + ' の要素がない');
  rects.forEach(rect => assert(rect.width > 0 && rect.height > 0, label + ' の要素が描画されていない: ' + JSON.stringify(rect)));
  for (let i = 1; i < rects.length; i++){
    assert(rects[i].top >= rects[i - 1].bottom - 1, label + ' の順序または領域が重なっている: ' + JSON.stringify({ before:rects[i - 1], after:rects[i] }));
  }
}

function noTopbarOverlap(label, rects){
  const visible = rects.filter(rect => rect.width > 0 && rect.height > 0);
  for (let i = 0; i < visible.length; i++){
    for (let j = i + 1; j < visible.length; j++){
      const a = visible[i];
      const b = visible[j];
      const overlaps = a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      assert(!overlaps, '上部バーの実描画が重なっている: ' + JSON.stringify({ label, a, b }));
    }
  }
}

async function assertScrollReachable(cdp, label, selector){
  const count = await evaluate(cdp, `document.querySelectorAll(${JSON.stringify(selector)}).length`);
  assert(count > 0, label + ' が描画されていない');
  for (let index = 0; index < count; index++){
    const result = await evaluate(cdp, `(() => {
      const node=document.querySelectorAll(${JSON.stringify(selector)})[${index}];
      node.scrollIntoView({ block:'center' });
      const r=node.getBoundingClientRect();
      const x=Math.max(0,Math.min(innerWidth-1,r.left+r.width/2));
      const y=Math.max(0,Math.min(innerHeight-1,r.top+r.height/2));
      const hit=document.elementFromPoint(x,y);
      return { text:node.textContent.trim(), top:r.top, bottom:r.bottom, width:r.width, height:r.height, hit:hit === node || node.contains(hit) };
    })()`);
    assert(result.width > 0 && result.height > 0 && result.top >= 0 && result.bottom <= viewportHeight, label + ' へスクロールしても画面内に届かない: ' + JSON.stringify(result));
    assert(result.hit, label + ' が別要素に覆われている: ' + JSON.stringify(result));
  }
}

let viewportHeight = 0;

async function assertTopbarClear(cdp, label){
  const rects = await evaluate(cdp, `(() => {
    const textRect = (name, selector) => { const node=document.querySelector(selector), range=document.createRange(); range.selectNodeContents(node); const r=range.getBoundingClientRect(); return { name, left:r.left, right:r.right, top:r.top, bottom:r.bottom, width:r.width, height:r.height }; };
    const boxRect = node => { const r=node.getBoundingClientRect(); return { name:node.className, left:r.left, right:r.right, top:r.top, bottom:r.bottom, width:r.width, height:r.height }; };
    const result=[textRect('logo', '.brand .mark'), ...[...document.querySelectorAll('.topbar-inner > button')].map(boxRect)];
    if (document.querySelector('.topbar-inner > .clock .t')) result.splice(1,0,textRect('clock', '.topbar-inner > .clock .t'));
    return result;
  })()`);
  noTopbarOverlap(label, rects);
}

async function verifyViewport(cdp, viewport){
  viewportHeight = viewport.height;
  await cdp.send('Emulation.setDeviceMetricsOverride', { width:viewport.width, height:viewport.height, deviceScaleFactor:1, mobile:false });
  await cdp.send('Page.navigate', { url:pageUrl });
  await pause(180);
  const start = await evaluate(cdp, `(() => { const node=document.querySelector('#btn-start'), r=node.getBoundingClientRect(), hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2); return { scrollY, rects:[{center:r.top+r.height/2,top:r.top,bottom:r.bottom,width:r.width,height:r.height,hit:hit === node || node.contains(hit)}] }; })()`);
  assert.equal(start.scrollY, 0, 'ブリーフィングが初期表示でスクロールしている');
  await assertTopbarClear(cdp, 'ブリーフィング');
  visibleCenters('シフトを始める', start.rects, viewport.height);
  await evaluate(cdp, 'closeSheet(); enterOffice(); null');
  await pause(80);

  const office = await evaluate(cdp, `(() => {
    const clock=document.querySelector('.office-wall > .clock'), r=clock.getBoundingClientRect();
    const slogan=document.querySelector('.slogan-text'), sr=slogan.getBoundingClientRect();
    return { scrollY, positions:[...document.querySelectorAll('.office-call-actions')].map(node => getComputedStyle(node).position), count:document.querySelectorAll('.office-call-action').length, clockVisible:getComputedStyle(clock).display !== 'none' && r.width > 0 && r.height > 0, clockBelowSlogan:r.top >= sr.bottom, clockSize:parseFloat(getComputedStyle(clock.querySelector('.t')).fontSize), sloganSize:parseFloat(getComputedStyle(slogan).fontSize), topbarClock:document.querySelectorAll('.topbar-inner > .clock').length, description:document.querySelectorAll('.office-head > p').length, shiftStrips:document.querySelectorAll('.shift-strip,#shift-strip').length };
  })()`);
  assert.equal(office.scrollY, 0, 'オフィスが初期表示でスクロールしている');
  await assertTopbarClear(cdp, 'オフィス');
  assert.equal(office.count, 4, 'オフィス操作が4つではない');
  assert(office.clockVisible, 'オフィスでスローガン下の時計が消えている');
  assert(office.clockBelowSlogan && office.clockSize > office.sloganSize, 'オフィス時計が小さくしたスローガンの下で読みやすく表示されていない: ' + JSON.stringify(office));
  assert.equal(office.topbarClock, 0, 'オフィスで時計が上部バーに残っている');
  assert.equal(office.description, 0, 'オフィス見出し下の説明文が残っている');
  assert.equal(office.shiftStrips, 0, 'オフィスに撤去したシフト帯が残っている');
  assert(office.positions.every(position => position !== 'fixed'), 'オフィス操作が固定配置のまま: ' + office.positions.join(','));
  await assertScrollReachable(cdp, 'オフィス4操作', '.office-call-action');

  /* 入電の時刻・案件は日ごとに変わるので、ここだけは画面の操作ではなく既存の
     通話開始関数を直接呼ぶ。表示後の矩形を固定し、日程の偶然で検査を揺らさない。 */
  await evaluate(cdp, `(() => {
    const ticket = state.tickets.find(item => !item.handover) || state.tickets[0];
    ticket.state = 'waiting'; pickup(ticket); greetCurrentCustomer();
    while (typingLine) finishTyping();
    return null;
  })()`);
  await pause(80);
  const call = await evaluate(cdp, `(() => {
    const rect = (name,node) => { const r=node.getBoundingClientRect(); return { name, top:r.top+scrollY, bottom:r.bottom+scrollY, width:r.width, height:r.height }; };
    const selectors = [['上部バー','.topbar-inner'],['チケット情報','.call-head'],['満足度メーター','.stress-panel'],['顧客との会話','.transcript.recent'],['操作','.actions']];
    const flow=selectors.map(([name,selector]) => rect(name,document.querySelector(selector)));
    const positions=selectors.slice(1).map(([name,selector]) => ({ name, position:getComputedStyle(document.querySelector(selector)).position }));
    const transcriptStyle=getComputedStyle(document.querySelector('.transcript.recent'));
    const clock=document.querySelector('.topbar .clock'), clockRect=clock.getBoundingClientRect();
    return { scrollY, flow, positions, transcriptOverflow:transcriptStyle.overflowY, clockVisible:getComputedStyle(clock).display !== 'none' && clockRect.width > 0 && clockRect.height > 0, shiftStrips:document.querySelectorAll('.shift-strip,#shift-strip').length, commands:document.querySelectorAll('.command-grid .command-choice').length, independentHangups:document.querySelectorAll('.hangup-box,.hangup-button,[data-hangup]').length };
  })()`);
  assert.equal(call.scrollY, 0, '通話が初期表示でスクロールしている');
  await assertTopbarClear(cdp, '通話');
  verticalFlow('通話の縦一列', call.flow);
  assert(call.clockVisible, '小画面で上部の時計が消えている');
  assert.equal(call.shiftStrips, 0, '撤去したシフト帯が画面に残っている');
  assert(call.positions.every(item => item.position !== 'fixed' && item.position !== 'sticky'), '通話要素が通常フローから外れている: ' + JSON.stringify(call.positions));
  assert(call.transcriptOverflow === 'visible', '顧客との会話が内部スクロール窓のまま: ' + call.transcriptOverflow);
  assert.equal(call.commands, 4, '通話の主コマンドが4つではない');
  assert.equal(call.independentHangups, 0, '独立した「電話を切る」が残っている');
  await assertScrollReachable(cdp, '通話4コマンド', '.command-grid .command-choice');
  await evaluate(cdp, `(() => { document.querySelector('[data-command="tell"]').click(); return null; })()`);
  await pause(40);
  const tell = await evaluate(cdp, `(() => { const first=document.querySelector('.actions .opts .opt'), box=document.querySelector('.actions .opts'), r=box.getBoundingClientRect(); return { text:first && first.textContent.trim(), endCall:first && first.hasAttribute('data-end-call'), box:{width:r.width,height:r.height} }; })()`);
  assert(tell.endCall && tell.text === '1電話を切る', '「伝える」の先頭が「電話を切る」ではない: ' + JSON.stringify(tell));
  assert(tell.box.width > 0 && tell.box.height > 0, '「伝える」の選択肢が高さ0に潰れている');
  await assertScrollReachable(cdp, '「伝える」の全操作', '.actions .opts .opt');
  await evaluate(cdp, `(() => { state.ui=defaultUi(); render(); document.querySelector('[data-command="ask"]').click(); return null; })()`);
  await pause(40);
  await assertScrollReachable(cdp, '質問カテゴリ', '[data-ask-group]');
  await evaluate(cdp, `(() => { document.querySelector('[data-ask-group]').click(); return null; })()`);
  await pause(40);
  const askBox = await evaluate(cdp, `(() => { const r=document.querySelector('.actions .opts').getBoundingClientRect(); return { width:r.width, height:r.height }; })()`);
  assert(askBox.width > 0 && askBox.height > 0, '質問選択肢が高さ0に潰れている');
  await assertScrollReachable(cdp, '質問選択肢', '.actions .opts .opt');
}

(async () => {
  const chrome = await connectChrome();
  const browserCdp = connect(chrome.browserWsUrl);
  let cdp;
  let targetId;
  try {
    await browserCdp.ready();
    ({ targetId } = await browserCdp.send('Target.createTarget', { url:'about:blank' }));
    cdp = connect(await createdPageAt(chrome.port, targetId));
    await cdp.ready();
    await cdp.send('Page.enable');
    for (const viewport of VIEWPORTS) await verifyViewport(cdp, viewport);
    console.log('Small viewport layout: 4/4 green');
  } finally {
    if (cdp) cdp.close();
    if (targetId) {
      try { await browserCdp.send('Target.closeTarget', { targetId }); } catch (error){ /* 接続失敗時は外部 Chrome を閉じない */ }
    }
    browserCdp.close();
  }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
