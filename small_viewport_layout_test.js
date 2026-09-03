/* 実効表示高が低いスマホで、最初に必要な操作の中心が画面内にあることを測る。 */
const assert = require('assert');
const path = require('path');
const VIEWPORTS = [
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
    rect.center >= 0 && rect.center <= height,
    label + ' の中心が初期表示の画面外: ' + JSON.stringify({ height, rect })
  ));
  rects.forEach(rect => assert(rect.hit, label + ' の中心が別要素に覆われている: ' + JSON.stringify(rect)));
}

async function verifyViewport(cdp, viewport){
  await cdp.send('Emulation.setDeviceMetricsOverride', { width:viewport.width, height:viewport.height, deviceScaleFactor:1, mobile:false });
  await cdp.send('Page.navigate', { url:pageUrl });
  await pause(180);
  const start = await evaluate(cdp, `(() => { const node=document.querySelector('#btn-start'), r=node.getBoundingClientRect(), hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2); return { scrollY, rects:[{center:r.top+r.height/2,top:r.top,bottom:r.bottom,hit:hit === node || node.contains(hit)}] }; })()`);
  assert.equal(start.scrollY, 0, 'ブリーフィングが初期表示でスクロールしている');
  visibleCenters('シフトを始める', start.rects, viewport.height);
  await evaluate(cdp, 'closeSheet(); enterOffice(); null');
  await pause(80);

  const office = await evaluate(cdp, `(() => ({ scrollY, rects:[...document.querySelectorAll('.office-call-action')].map(node => { const r=node.getBoundingClientRect(), hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2); return { text:node.textContent.trim(), center:r.top+r.height/2, top:r.top, bottom:r.bottom, hit:hit === node || node.contains(hit) }; }) }))()`);
  assert.equal(office.scrollY, 0, 'オフィスが初期表示でスクロールしている');
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
  const call = await evaluate(cdp, `(() => ({ scrollY, commands:[...document.querySelectorAll('.command-grid .command-choice')].map(node => { const r=node.getBoundingClientRect(), hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2); return { text:node.textContent.trim(), center:r.top+r.height/2, top:r.top, bottom:r.bottom, hit:hit === node || node.contains(hit), hitClass:hit && hit.className }; }), hangup:(() => { const node=document.querySelector('.hangup-button'), r=node.getBoundingClientRect(), hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2); return { center:r.top+r.height/2, top:r.top, bottom:r.bottom, hit:hit === node || node.contains(hit), hitClass:hit && hit.className }; })() }))()`);
  assert.equal(call.scrollY, 0, '通話が初期表示でスクロールしている');
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
    console.log('Small viewport layout: 3/3 green');
  } finally {
    if (cdp) cdp.close();
    if (targetId) {
      try { await browserCdp.send('Target.closeTarget', { targetId }); } catch (error){ /* 接続失敗時は外部 Chrome を閉じない */ }
    }
    browserCdp.close();
  }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
