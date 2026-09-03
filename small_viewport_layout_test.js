/* 実効表示高が低いスマホで、最初に必要な操作の中心が画面内にあることを測る。 */
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

function noFixedContentOverlap(label, fixedRects, contentRects){
  const fixed = fixedRects.filter(rect => rect.width > 0 && rect.height > 0);
  const content = contentRects.filter(rect => rect.width > 0 && rect.height > 0);
  fixed.forEach(a => content.forEach(b => {
    const overlaps = a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    assert(!overlaps, '固定領域と本文情報が重なっている: ' + JSON.stringify({ label, a, b }));
  }));
}

async function assertTopbarClear(cdp, label){
  const rects = await evaluate(cdp, `(() => {
    const textRect = (name, selector) => { const node=document.querySelector(selector), range=document.createRange(); range.selectNodeContents(node); const r=range.getBoundingClientRect(); return { name, left:r.left, right:r.right, top:r.top, bottom:r.bottom, width:r.width, height:r.height }; };
    const boxRect = node => { const r=node.getBoundingClientRect(); return { name:node.className, left:r.left, right:r.right, top:r.top, bottom:r.bottom, width:r.width, height:r.height }; };
    return [textRect('logo', '.brand .mark'), textRect('clock', '.clock .t'), ...[...document.querySelectorAll('.topbar-inner > button')].map(boxRect)];
  })()`);
  noTopbarOverlap(label, rects);
}

async function verifyViewport(cdp, viewport){
  await cdp.send('Emulation.setDeviceMetricsOverride', { width:viewport.width, height:viewport.height, deviceScaleFactor:1, mobile:false });
  await cdp.send('Page.navigate', { url:pageUrl });
  await pause(180);
  const start = await evaluate(cdp, `(() => { const node=document.querySelector('#btn-start'), r=node.getBoundingClientRect(), hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2); return { scrollY, rects:[{center:r.top+r.height/2,top:r.top,bottom:r.bottom,width:r.width,height:r.height,hit:hit === node || node.contains(hit)}] }; })()`);
  assert.equal(start.scrollY, 0, 'ブリーフィングが初期表示でスクロールしている');
  await assertTopbarClear(cdp, 'ブリーフィング');
  visibleCenters('シフトを始める', start.rects, viewport.height);
  await evaluate(cdp, 'closeSheet(); enterOffice(); null');
  await pause(80);

  const office = await evaluate(cdp, `(() => ({ scrollY, rects:[...document.querySelectorAll('.office-call-action')].map(node => { const r=node.getBoundingClientRect(), hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2); return { text:node.textContent.trim(), center:r.top+r.height/2, top:r.top, bottom:r.bottom, width:r.width, height:r.height, hit:hit === node || node.contains(hit) }; }) }))()`);
  assert.equal(office.scrollY, 0, 'オフィスが初期表示でスクロールしている');
  await assertTopbarClear(cdp, 'オフィス');
  assert.equal(office.rects.length, 4, 'オフィス操作が4つではない');
  visibleCenters('オフィス4操作', office.rects, viewport.height);

  /* 入電の時刻・案件は日ごとに変わるので、ここだけは画面の操作ではなく既存の
     通話開始関数を直接呼ぶ。表示後の矩形を固定し、日程の偶然で検査を揺らさない。 */
  await evaluate(cdp, `(() => {
    const ticket = state.tickets.find(item => !item.handover) || state.tickets[0];
    ticket.state = 'waiting'; pickup(ticket); greetCurrentCustomer();
    while (typingLine) finishTyping();
    return null;
  })()`);
  await pause(80);
  const call = await evaluate(cdp, `(() => { const rectFor = node => { const r=node.getBoundingClientRect(), hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2); return { text:node.textContent.trim(), center:r.top+r.height/2, top:r.top, bottom:r.bottom, width:r.width, height:r.height, hit:hit === node || node.contains(hit), hitClass:hit && hit.className }; }; const rect = node => { const r=node.getBoundingClientRect(); return { text:node.textContent.trim(), top:r.top, bottom:r.bottom, left:r.left, right:r.right, width:r.width, height:r.height }; }; const customerLines=[...document.querySelectorAll('.transcript.recent .line.cust .say')]; return { scrollY, customer:customerLines.length ? rectFor(customerLines.at(-1)) : null, commands:[...document.querySelectorAll('.command-grid .command-choice')].map(rectFor), hangup:rectFor(document.querySelector('.hangup-button')), fixed:[...document.querySelectorAll('.transcript.recent, body.call-view .actions')].map(rect), content:[...document.querySelectorAll('.call-head, .stress-panel, #call-summary, .pane-title')].map(rect) }; })()`);
  assert.equal(call.scrollY, 0, '通話が初期表示でスクロールしている');
  await assertTopbarClear(cdp, '通話');
  noFixedContentOverlap('通話', call.fixed, call.content);
  assert(call.customer, '直近の顧客発話が描画されていない');
  visibleCenters('直近の顧客発話', [call.customer], viewport.height);
  assert.equal(call.commands.length, 4, '通話の主コマンドが4つではない');
  visibleCenters('通話4コマンド', call.commands, viewport.height);
  visibleCenters('電話を切る', [call.hangup], viewport.height);
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
