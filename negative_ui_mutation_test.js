/* §6-E の重要UI契約を意図的に壊し、ui_contract_test が赤になることを確認する。 */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const projectFiles = fs.readdirSync(__dirname).filter(name => !name.startsWith('.'));
const deskPane = `  <section class="pane desk">
    <div class="pane-head">
      <h2 class="pane-title">対応デスク</h2>
      <span class="count-chip mono" id="line-state">待機</span>
    </div>
    <div class="call" id="call"></div>
  </section>`;
const retiredBoardPane = `  <section class="pane board">
    <div class="pane-head">
      <h2 class="pane-title">診断ボード</h2>
      <span class="count-chip mono" id="fact-count">0件</span>
    </div>
    <div id="board"></div>
  </section>`;
const callSummaryPane = `  <section class="pane call-summary">
    <div class="pane-head">
      <h2 class="pane-title">待機状況</h2>
      <span class="count-chip mono" id="queue-count">0件</span>
    </div>
    <div class="summary-figure" id="call-summary"></div>
    <div class="hint-bar" id="queue-hint"></div>
  </section>`;
const mutations = [
  {
    name:'§50 誤診で解決しても翌日なにも起きない', file:'p3_game.js',
    from:'  if (misdiagnosisResurfaces(result)) return true;\n',
    to:'',
    expected:'§50 検査1: 誤診で解決しても翌日クレームが届かない',
  },
  {
    name:'§50 誤診の再発にも運を挟む', file:'p3_game.js',
    from:'  if (misdiagnosisResurfaces(result)) return true;',
    to:'  if (misdiagnosisResurfaces(result)) return rollLuck();',
    expected:'§50 検査1: 誤診で解決しても翌日クレームが届かない',
  },
  {
    name:'§50 原因を当てた案件まで再発扱いにする', file:'p3_game.js',
    from:"  return (result.kind === 'closed' || result.kind === 'refunded') && result.causeMatched === false;",
    to:"  return (result.kind === 'closed' || result.kind === 'refunded');",
    expected:'§50 検査1: 原因を当てた案件まで再発扱いにしている',
  },
  {
    name:'§50 感謝を抽選なしで必ず届ける', file:'p3_game.js',
    from:'  return flags.luckRate === 1 ? true : state.random() < GRATITUDE_RATE;',
    to:'  return true;',
    expected:'§50 検査4: 感謝が抽選を通らずに必ず届いている',
  },
  {
    name:'§50 ファインプレーでなくても感謝を届ける', file:'p3_game.js',
    from:"  if (!result.causeMatched || result.grade !== 'best' || !result.firstCallResolved || result.csat < 4.5) return false;",
    to:'',
    expected:'§50 検査5: grade を欠いても感謝が届く',
  },
  {
    name:'§50 苦情と感謝を同時に届ける', file:'p3_game.js',
    from:'  t.gratitudeEmail = !t.complaintEmail && gratitudeEmailArrives(result);',
    to:'  t.gratitudeEmail = gratitudeEmailArrives(result);',
    expected:'§50 検査7: 苦情と感謝が同時に届きうる',
  },
  {
    name:'§50 誤診の再発を苦情と同じ文面で出す', file:'p4_view.js',
    from:"    ? dayAfterMail(t, MISDIAGNOSIS_EMAIL_TEMPLATES, '再発のご連絡', 'complaint-email')",
    to:"    ? dayAfterMail(t, COMPLAINT_EMAIL_TEMPLATES, '再発のご連絡', 'complaint-email')",
    expected:'§50 検査2: 翌日の画面が誤診の再発を別の文面で出さない',
  },
  {
    name:'§49 約束どおり折り返しても満足度を回復させない', file:'p3_game.js',
    from:'  applyPunctualCallbackRelief(t, false);\n  finishCarrierLookup(t);',
    to:'  finishCarrierLookup(t);',
    expected:'§49 検査1: 約束どおり折り返して客室へつながっても満足度が回復しない',
  },
  {
    name:'§49 遅れた折り返しでも満足度を回復させる', file:'p3_game.js',
    from:'  if (t.callbackReliefApplied || t.callbackLate) return;',
    to:'  if (t.callbackReliefApplied) return;',
    expected:'§49 検査3: 約束に遅れた折り返しでも満足度が回復してしまう',
  },
  {
    name:'§49 折り返すたびに満足度を回復させる', file:'p3_game.js',
    from:'  t.callbackReliefApplied = true;\n  const delta = CALLBACK_PUNCTUAL_RELIEF[t.s.type];',
    to:'  const delta = CALLBACK_PUNCTUAL_RELIEF[t.s.type];',
    expected:'§49 検査7: 折り返しを繰り返すたびに満足度が回復してしまう',
  },
  {
    name:'§49 客室へつながっても他人のまま扱う', file:'p3_game.js',
    from:'  t.identified = true;\n  applyPunctualCallbackRelief(t, false);',
    to:'  applyPunctualCallbackRelief(t, false);',
    expected:'§49 検査5: 客室へつながっても本人確認が済んだ扱いにならない',
  },
  {
    name:'§49 Front Deskへつないだ段階で本人確認済みにする', file:'p3_game.js',
    from:"  t.callbackStage = 'front_desk';\n  t.frontDeskAttempts = 0;",
    to:"  t.callbackStage = 'front_desk';\n  t.identified = true;\n  t.frontDeskAttempts = 0;",
    expected:'§49 検査4/6: Front Deskへつないだ段階で回復または本人確認済みにしている',
  },
  {
    name:'§48-7 通話中も待機状況の中身を出す', file:'p1_head.html',
    from:'body.call-view .pane.call-summary > .summary-figure,\nbody.call-view .pane.call-summary > .hint-bar{ display: none; }',
    to:'body.call-view .pane.call-summary > .hint-bar{ display: none; }',
    expected:'§48-7 検査5: 通話中に待機状況の中身が畳まれない',
  },
  {
    name:'§48-7 選択肢の枠を実在しない入れ子へ向ける', file:'p1_head.html',
    from:'body.call-view .call .opts{ max-height: 42vh; overflow-y: auto; }',
    to:'body.call-view .command-box .opts{ max-height: 42vh; overflow-y: auto; }',
    expected:'§48-7 検査9: 選択肢の高さを抑えるCSSが、実際の入れ子（.call の中の .opts）を対象にしていない: .command-box .opts',
  },
  {
    name:'§48-7 選択肢を枠に収めずページごと伸ばす', file:'p1_head.html',
    from:'body.call-view .call .opts{ max-height: 42vh; overflow-y: auto; }',
    to:'body.call-view .call .opts{ overflow-y: auto; }',
    expected:'§48-7 検査6: 選択肢が枠内でスクロールせず、ページごと伸びる',
  },
  {
    name:'§48-7 通話中に保留の累計を出さない', file:'p4_view.js',
    from:`  const held = t.holdMinutes ? '<span class="call-hold">うち保留 ' + t.holdMinutes + '分</span>' : '';`,
    to:`  const held = '';`,
    expected:'§48-7 検査1: 通話中に保留の累計が出ない',
  },
  {
    name:'§48-7 保留していなくても保留の行を出す', file:'p4_view.js',
    from:`  const held = t.holdMinutes ? '<span class="call-hold">うち保留 ' + t.holdMinutes + '分</span>' : '';`,
    to:`  const held = '<span class="call-hold">うち保留 ' + (t.holdMinutes || 0) + '分</span>';`,
    expected:'§48-7 検査2: 保留していないのに保留の表示が出る',
  },
  {
    name:'§48-7 通話中に待ち件数を出さない', file:'p4_view.js',
    from:`      '<span class="call-waiting">待ち ' + waiting + '件</span>' +`,
    to:'',
    expected:'§48-7 検査3: 通話中に他の待ち件数が出ない',
  },
  {
    name:'§48-6 満足度をストレスのまま表示する', file:'p4_view.js',
    from:'  return Math.round(100 - stress);',
    to:'  return Math.round(stress);',
    expected:'§48-6 検査1: 満足度が 100 からストレスを引いた値になっていない',
  },
  {
    name:'§48-6 メーターの見出しを苛立ちへ戻す', file:'p4_view.js',
    from:`'<div class="stress-panel-head"><span>顧客の満足度</span><b>' + satisfaction + '%</b>`,
    to:`'<div class="stress-panel-head"><span>顧客の苛立ち</span><b>' + satisfaction + '%</b>`,
    expected:'§48-6 検査2: メーターの見出しが満足度になっていない',
  },
  {
    name:'§48-6 メーターの長さをストレスへ戻す', file:'p4_view.js',
    from:`'<i class="stress-track"><b class="stress-fill" style="width:' + satisfaction + '%"></b></i></section>';`,
    to:`'<i class="stress-track"><b class="stress-fill" style="width:' + t.stress + '%"></b></i></section>';`,
    expected:'§48-6 検査4: メーターの長さが満足度に比例していない',
  },
  {
    name:'§46-3 解決したのに結果を確定させない', file:'p3_game.js',
    from:'  finishSuccessfulClose(t, remedy, causeId, remedyId, causeMatched);',
    to:'',
    expected:'裏目の誤診が解決扱いにならない',
  },
  {
    name:'§48-5 本人確認なしでも減点しない', file:'p3_game.js',
    from:'  if (identityRecordMissing) base -= IDENTITY_RECORD_PENALTY;',
    to:'',
    expected:'運なしの同一操作列でCSATが決定論的な結果に戻らない（本人確認なしの記録不足0.4を含む）',
  },
  {
    name:'§51 名前を伺っても減点を戻さない', file:'p3_game.js',
    from:'  if (t.pendingResult.identityRecordMissing){\n    t.pendingResult.identityRecordMissing = false;\n    t.pendingResult.csat = clamp(Math.round((t.pendingResult.csat + IDENTITY_RECORD_PENALTY) * 10) / 10, 1.0, 5.0);\n  }\n',
    to:'',
    expected:'§51 検査4: 名前を伺っても記録不足の減点が戻らない',
  },
  {
    name:'§51 名前を伺うたびに減点が二重に戻る', file:'p3_game.js',
    from:'    t.pendingResult.identityRecordMissing = false;\n',
    to:'',
    expected:'§51 検査4: 記録不足の印が残ったまま',
  },
  {
    name:'§51 解決前でも名前を後から伺えるようにする', file:'p3_game.js',
    from:'  if (!t || !t.pendingResult || t.nameKnown) return;',
    to:'  if (!t || t.nameKnown) return;',
    expected:'§51 検査1: 解決前でも名前を後から伺えてしまう',
  },
  {
    name:'§51 記録が残せないことを知らせる条件を壊す', file:'p4_view.js',
    from:"    const recordGap = t.nameKnown ? '' :",
    to:"    const recordGap = false ? '' :",
    expected:'§51 検査2: 名前を伺い済みでも導線が出る',
  },
  {
    name:'§51 苛立ちによる記録不足の免除を復活させる', file:'p3_game.js',
    from:'  const identityRecordMissing = !t.nameKnown;',
    to:'  const identityRecordMissing = !t.nameKnown && !t.identityStressSeen;',
    expected:'§51 検査6: 苛立ちが高いと記録不足の減点が免除されてしまう',
  },
  {
    name:'§51 記録不足の判定を本人確認の成立へ戻す', file:'p3_game.js',
    from:'  const identityRecordMissing = !t.nameKnown;\n  if (identityRecordMissing)',
    to:'  const identityRecordMissing = !t.identified;\n  if (identityRecordMissing)',
    expected:'§51 検査7: 名前を伺っていても記録不足の減点が入る',
  },
  {
    name:'§48-3 原因の選択画面へ誘導を戻す', file:'p4_view.js',
    from:`        '<span class="opt-label">' + esc(c.label) + '<span class="opt-sub">' + c.tier + '</span></span>' +`,
    to:`        '<span class="opt-label">● ' + esc(c.label) + '<span class="opt-sub">' + c.tier + ' ／ 手がかりが指しています</span></span>' +`,
    expected:'§48-3 検査1: 原因選択に診断ボード用の強調・除外表示が残っている',
  },
  {
    name:'§48-2 復旧後の対処選択見出しを未復旧と同じに戻す', file:'p4_view.js',
    from:`'どの対処が効いたかを選んでください'`,
    to:`'対処を選んでください'`,
    expected:'§48-2 検査3: 復旧後の対処選択見出しがない',
  },
  {
    name:'§48-1 終話に伝え方の第三引数を戻す', file:'p3_game.js',
    from:'function doClose(causeId, remedyId){',
    to:'function doClose(causeId, remedyId, toneId){',
    expected:'§48-1 検査1: 終話の伝え方選択または採点が残っている',
  },
  {
    name:'§46-4 通話を離れてもオフィス画面へ移らない', file:'p3_game.js',
    from:"function leaveCallForOffice(){\n  state.focus = null;\n  state.ui = defaultUi();\n  playDisconnectSound();\n  enterOffice();\n}",
    to:"function leaveCallForOffice(){\n  state.focus = null;\n  state.ui = defaultUi();\n  playDisconnectSound();\n}",
    expected:'§46-4 検査5: 通話を離れてもオフィス画面へ移らない',
  },
  {
    name:'§46-4 通話を離れても対応中の案件を解除しない', file:'p3_game.js',
    from:"function leaveCallForOffice(){\n  state.focus = null;\n",
    to:"function leaveCallForOffice(){\n",
    expected:'§46-4 検査2: 通話を離れても対応中の案件が解除されない',
  },
  {
    name:'§46-4 通話を離れても切断音を鳴らさない', file:'p3_game.js',
    from:"  state.ui = defaultUi();\n  playDisconnectSound();\n  enterOffice();\n}",
    to:"  state.ui = defaultUi();\n  enterOffice();\n}",
    expected:'§46-4 検査4: 通話を離れても切断音が鳴らない',
  },
  {
    name:'§46-4 再着信の知らせを画面を描いたあとに記録する', file:'p3_game.js',
    from:"  recordOfficeEvent('redial', customerLabel(t, true) + 'から再着信しています。');\n  leaveCallForOffice();",
    to:"  leaveCallForOffice();\n  recordOfficeEvent('redial', customerLabel(t, true) + 'から再着信しています。');",
    expected:'§46-4 検査1: オフィス画面を描く時点で再着信の知らせが記録されていない',
  },
  {
    name:'§47 性別を案件に固定へ戻す', file:'p3_game.js',
    from:"    const wanted = random() < 0.5 ? 'female' : 'male';",
    to:"    const wanted = scenario.gender;",
    expected:'§47 検査3: 性別が乱数で決まらない、または引いた性別と名前の性別が食い違う',
  },
  {
    name:'§47 名前の年齢帯を無視して引く', file:'p3_game.js',
    from:'      entry.ageBand[0] <= range[1] && range[0] <= entry.ageBand[1]);',
    to:'      true);',
    expected:'§47 検査1: 年齢が案件の幅と名前の年齢帯の重なりに収まらない',
  },
  {
    name:'§47 年齢を重なりの外から引く', file:'p3_game.js',
    from:'age:low + Math.floor(random() * (high - low + 1))',
    to:'age:low - 1',
    expected:'§47 検査1: 年齢が案件の幅と名前の年齢帯の重なりに収まらない',
  },
  {
    name:'§47 同じシフトで同じ名前を許す', file:'p3_game.js',
    from:'    usedNames.add(entry.name);',
    to:'',
    expected:'§38 検査1: 名前・ローマ字が候補から切り離され、シフトごとに割り当てられない',
  },
  {
    name:'§47 配偶者の呼び方を「夫」固定に戻す', file:'p3_game.js',
    from:"    spouse:identity.gender === 'female' ? '夫' : '妻',",
    to:"    spouse:'夫',",
    expected:'§47 検査5: 男性客に「妻」が入らない',
  },
  {
    name:'§45 客から切られたら折り返しの約束を捨てる', file:'p3_game.js',
    from:'  if (t.callbackPromised){\n    t.transcript.push({ who:\'note\', text:\'お客様から切られましたが、折り返しのお約束は残っています。\' });\n    finishPromisedCallback(t, false);\n    return false;\n  }\n',
    to:'',
    expected:'§45 検査8: 客から切られると折り返しの約束が失効する',
  },
  {
    name:'§45 折り返しの申し出でその場で切る', file:'p3_game.js',
    from:'  t.callbackPromised = preferredKind;', to:"  t.callbackPromised = preferredKind;\n  t.state = 'callback';\n  state.focus = null;",
    expected:'§45 検査1: 折り返しの申し出がその場で通話を終わらせる',
  },
  {
    name:'§45 約束したあとも「伝える」に折り返しを残す', file:'p4_view.js',
    from:"return t.callDirection !== 'outbound' && !t.callbackPromised;", to:"return t.callDirection !== 'outbound';",
    expected:'§45 約束したあとも「伝える」に折り返しが残る',
  },
  {
    name:'§45 戻る時間の質問を約束前から出す', file:'p4_view.js',
    from:'.filter(q => q && (!q.needsDevice || t.s.deviceInHand) && (!q.needsCallbackPromise || t.callbackPromised));',
    to:'.filter(q => q && (!q.needsDevice || t.s.deviceInHand));',
    expected:'§45 戻る時間の質問が約束前から出る',
  },
  {
    name:'§53 切る前の案内で滞在先未確認を漏らす', file:'p4_view.js',
    from:"    return '<b>' + CALL_FLOW_LINES.callbackPromise.guide + '</b>';",
    to:"    return '<b>' + (t.stayAddress ? CALL_FLOW_LINES.callbackPromise.guide : '滞在先は未確認です。') + '</b>';",
    expected:'§53 検査: 滞在先の有無で終話前案内が変わり、内部状態を漏らす',
  },
  {
    name:'§41 本人確認前に顧客レコードを開く', file:'p4_view.js',
    from:'  const identified = identificationReady(t);', to:'  const identified = t.nameKnown;',
    expected:'§41-11 本人確認前または未照会欄が伏せられない',
  },
  {
    name:'§43 確かめられない対処をその場の失敗へ戻す', file:'p3_game.js',
    from:'if (!remedy.verifiable && (causeMatched || t.misdiagnoses < 2)){',
    to:'if (false && !remedy.verifiable && (causeMatched || t.misdiagnoses < 2)){',
    expected:'§43-6 検査3: 確かめられない対処の失敗を後日の再入電へ分けない',
  },
  {
    name:'§44 連続する顧客発話を最後の1行だけへ戻す', file:'p4_view.js',
    from:"return (player ? [player] : []).concat(spoken.slice(runStart, customerIndex + 1)).slice(-4);",
    to:'return player ? [player, customer] : [customer];',
    expected:'§44 連続する顧客発話の1行目が通話画面から落ちる',
  },
  {
    name:'上部の通話・待機・診断タブを復活させる', file:'p1_head.html',
    from:'<div class="console">\n\n  <section class="pane desk">',
    to:'<div class="console">\n\n  <nav class="mobile-pane-nav">通話／待機／診断</nav>\n\n  <section class="pane desk">',
    expected:'上部の通話・待機・診断タブが戻っている',
  },
  {
    name:'待機ペインをdisplay noneへ戻す', file:'p1_head.html',
    from:'.pane-head{ padding-bottom:10px; }',
    to:'.pane.call-summary{ display:none; }\n.pane-head{ padding-bottom:10px; }',
    expected:'2ペインの一部が非表示になっている',
  },
  {
    name:'pane単独セレクタで全ペインをdisplay noneにする', file:'p1_head.html',
    from:'.pane-head{ padding-bottom:10px; }',
    to:'.pane{ display:none; }\n.pane-head{ padding-bottom:10px; }',
    expected:'2ペインの一部が非表示になっている',
  },
  {
    name:'§56 対応デスクと待機状況のDOM順を入れ替える', file:'p1_head.html',
    from:deskPane + '\n\n' + callSummaryPane,
    to:callSummaryPane + '\n\n' + deskPane,
    expected:'§56 2ペインのDOM順が対応デスク→待機状況ではない',
  },
  {
    name:'§56 診断ボードのDOMを復活させる', file:'p1_head.html',
    from:deskPane + '\n\n' + callSummaryPane,
    to:deskPane + '\n\n' + retiredBoardPane + '\n\n' + callSummaryPane,
    expected:'§56 診断ボードのDOMが残っている',
  },
  {
    name:'§56 原因候補の要約をログへ移す', file:'p4_view.js',
    from:`  return '<section class="record-system-block"><h3>会話の全履歴</h3><div class="record-system-transcript">' + renderRecordTranscript(t) + '</div></section>';`,
    to:`  return '<section><h3>残っている原因の候補</h3></section><section class="record-system-block"><h3>会話の全履歴</h3><div class="record-system-transcript">' + renderRecordTranscript(t) + '</div></section>';`,
    expected:'§56 ログに顧客情報・引き継ぎ事実・全履歴以外の要約が残っている',
  },
  {
    name:'§56 原因選択を内部候補で絞る', file:'p4_view.js',
    from:`return '<div class="opts">' + CAUSES.map(c => {`,
    to:`return '<div class="opts">' + CAUSES.filter(c => hotCauses(t).has(c.id)).map(c => {`,
    expected:'§56 原因選択で14原因を絞り込んでいる',
  },
  {
    name:'§56 内部の原因絞り込みを捨てる', file:'p4_view.js',
    from:`  t.facts.forEach(f => (f.hot || []).forEach(c => s.add(c)));`,
    to:`  t.facts.forEach(() => {});`,
    expected:'§56 内部の原因絞り込み状態が失われている',
  },
  {
    name:'公開QRのURLを1文字変える', file:'p2_data.js',
    from:'https://uryoutamomo.github.io/wifi-support-game/', to:'https://uryoutamomo.github.io/wifi-support-games/',
    expected:'公開QR URLがGitHub Pagesの正規URLではない',
  },
  {
    name:'公開QRを32行へ減らす', file:'p2_data.js',
    from:"  '111111101011010101000011101101010',\n]);", to:']);',
    expected:'公開ページQRが33×33の0/1パターンではない',
  },
  {
    name:'公開QRをdata:imageへ置き換える', file:'p4_view.js',
    from:'<canvas class="artifact-qr-canvas" id="artifact-qr-canvas" role="img" aria-label="この公開ページを開くQRコード"></canvas>',
    to:'<img class="artifact-qr-canvas" src="data:image/png;base64,broken" alt="QRコード">',
    expected:'公開ページQRがCanvasだけで描画されていない',
  },
  {
    name:'公開QRの余白確保を外す', file:'p4_view.js',
    from:'canvas.width = (size + quietZone * 2) * moduleSize;\n  canvas.height = (size + quietZone * 2) * moduleSize;',
    to:'canvas.width = size * moduleSize;\n  canvas.height = size * moduleSize;',
    expected:'公開ページQRの4モジュール余白が描画寸法に含まれない',
  },
  {
    name:'プレイ中ヘッダーへ進行ステータス行を戻す', file:'p1_head.html',
    from:'    <div class="clock">',
    to:'    <div class="kpis" id="kpis">CSAT ／ 一次解決率 ／ 応答率 ／ AHT ／ 費用</div>\n    <div class="clock">',
    expected:'プレイ中ヘッダーに無効な進行ステータス行が残っている',
  },
  {
    name:'メーターをstaticへ戻す', file:'p1_head.html',
    from:'.stress-panel{ position:sticky;', to:'.stress-panel{ position:static;',
    expected:'苛立ちメーターがsticky固定されていない',
  },
  {
    name:'直近会話を5行へ増やす', file:'p4_view.js',
    from:'.slice(-4);',
    to:'.slice(-5);',
    expected:'§44 直近表示が4行を超える',
  },
  {
    // デスク端末画面も同じ call-head を使うので、通話ヘッダ側だけを狙う。
    name:'ヘッダへ氏名を戻す', file:'p4_view.js',
    from:'\'<span class="call-time">通話 \' + String(t.callSegmentMinutes',
    to:'\'<span class="cname">\' + esc(t.s.name) + \'</span><span class="call-time">通話 \' + String(t.callSegmentMinutes',
    expected:'通話ヘッダにログへ移す情報が残っている: t.s.name',
  },
  {
    name:'ログから会話の全履歴を消す', file:'p4_view.js',
    from:'<section class="record-system-block"><h3>会話の全履歴</h3>',
    to:'<section class="record-system-block"><h3>案内なし</h3>',
    expected:'§56 ログに顧客情報・引き継ぎ事実・全履歴以外の要約が残っている',
  },
  {
    name:'ログへ真因を出す', file:'p4_view.js',
    from:'  return \'<div class="log-view">\' + base + handover + (includeLog ? renderRecordLog(t) : \'\') + \'</div><footer>RECORD ／ VERIFIED</footer></section></div>\';',
    to:'  return \'<div class="log-view" data-correct=\' + esc(t.s.trueCause) + \">\' + base + handover + (includeLog ? renderRecordLog(t) : \'\') + \'</div><footer>RECORD ／ VERIFIED</footer></section></div>\';',
    expected:'ログが真因または正解対処を参照している: trueCause',
  },
  {
    name:'質問区分を1列へ戻す', file:'p1_head.html',
    from:'.opts.ask-groups{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr));',
    to:'.opts.ask-groups{ display:grid; grid-template-columns:1fr;',
    expected:'質問区分CSSの全ブロックが2列グリッドではない',
  },
  {
    name:'質問区分の通常CSSだけ1列へ戻す', file:'p1_head.html',
    from:'.opts.ask-groups{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr));',
    to:'.opts.ask-groups{ display:grid; grid-template-columns:1fr;',
    expected:'質問区分CSSの全ブロックが2列グリッドではない',
  },
  {
    name:'質問区分のスマホCSSだけ1列へ戻す', file:'p1_head.html',
    from:'.opts.ask-groups{ width:calc(100% + 48px); margin-inline:-24px; grid-template-columns:repeat(2,minmax(0,1fr));',
    to:'.opts.ask-groups{ width:calc(100% + 48px); margin-inline:-24px; grid-template-columns:1fr;',
    expected:'質問区分CSSの全ブロックが2列グリッドではない',
  },
  {
    name:'ログ見出しへ接尾辞を足す', file:'p4_view.js',
    from:'<h3>会話の全履歴</h3>', to:'<h3>会話の全履歴_x</h3>',
    expected:'§56 ログに顧客情報・引き継ぎ事実・全履歴以外の要約が残っている',
  },
  {
    name:'ストレス終話を上長引き取りへ戻す', file:'p3_game.js',
    from:"endAngryCall(t, 'stress');", to:"closeTicket(t, { kind:'supervisor', reason:'stress' });",
    expected:'ストレス100が怒り終話の共通経路を通らない',
  },
  {
    name:'電話を取る文言へ接尾辞を足す', file:'p1_head.html',
    from:'<b>電話を取る</b>', to:'<b>電話を取る_x</b>',
    expected:'「電話を取る」ボタンがない',
  },
  {
    name:'オフィスの電話をかけるボタンを消す', file:'p1_head.html',
    from:'      <button class="office-call-action" id="office-callback" data-office-callback="1"><b>電話をかける</b><span id="office-callback-status">折り返し 0件</span></button>\n',
    to:'',
    expected:'オフィスの操作が受話・折り返し・端末調査・機器検証の4ボタンではない',
  },
  {
    name:'折り返し待ちの端末調査を消す', file:'p1_head.html',
    from:'      <button class="office-call-action" id="office-desk" data-office-desk="1"><b>端末で調べる</b><span id="office-desk-status">調査可能 0件</span></button>\n',
    to:'',
    expected:'オフィスの操作が受話・折り返し・端末調査・機器検証の4ボタンではない',
  },
  {
    name:'端末調査を通話中と同じストレス付きにする', file:'p3_game.js',
    from:'  advance(DESK_LOOKUP_MINUTES);\n  // 時間を進めた結果、折り返しの相手が待ちきれずに切っていることがある。',
    to:'  addStress(t, 5);\n  advance(DESK_LOOKUP_MINUTES);\n  // 時間を進めた結果、折り返しの相手が待ちきれずに切っていることがある。',
    expected:'端末調査が時間を使わない、または通話中と同じストレスを与えている',
  },
  {
    name:'選択肢ボタンを縦に潰せるようにする', file:'p1_head.html',
    from:'  /* 選択肢は縦に潰さない。潰れると説明文や「前提不足」の理由が読めなくなる。 */\n  flex: none;\n',
    to:'',
    expected:'選択肢ボタンが縦に潰れて説明文が切れる',
  },
  {
    name:'通話中の選択肢を小窓スクロールへ戻す', file:'p1_head.html',
    from:'body.playing .opts{ max-height:none; overflow:visible; }',
    to:'body.playing .opts{ max-height:min(32vh,300px); overflow-y:auto; }',
    expected:'通話中の選択肢一覧が小窓スクロールに閉じ込められている',
  },
  {
    name:'照会結果を客へ読み上げに戻す', file:'p3_game.js',
    from:"  pushFlowLines(t, [{ who:'me', text:hold ? CALL_FLOW_LINES.lookup.holdComplete : CALL_FLOW_LINES.lookup.talkComplete }]);",
    to:"  const spokenSummary = r && r.fact ? r.fact.text : (r ? r.text : l.spoken);\n  pushFlowLines(t, [{ who:'me', text:'お待たせしました。確認結果は、' + spokenSummary }]);",
    expected:'社内照会の開始と完了の合図が発話で揃わない',
  },
  {
    name:'滞在先未確認の折り返しを黙って握り潰す', file:'p3_game.js',
    from:'  if (!hotelContactKnown(t)){ blindCallbackRedial(t); return; }',
    to:'  if (!hotelContactKnown(t)){ render(); return; }',
    expected:'滞在先未確認の折り返しを別扱いにしていない',
  },
  {
    name:'折り返せなかった客を黙って待ち行列へ戻す', file:'p3_game.js',
    from:'  t.redialOpening = CALL_FLOW_LINES.callback.blameOpenings[t.s.type];',
    to:'  t.redialOpening = REDIAL_OPENINGS.direct;',
    expected:'折り返せなかった客が理由を言わずに掛け直してくる',
  },
  {
    name:'折り返しをコマンド直下の別枠へ戻す', file:'p4_view.js',
    from:"    ...(hotelCallbackOffered(t) ? [\n      { attrs:'data-hotel-callback=\"immediate\"', body:'<span class=\"opt-label\">いますぐ折り返す<span class=\"opt-sub\">すぐにこちらから掛け直します</span></span>' },\n      { attrs:'data-hotel-callback=\"scheduled\"', body:'<span class=\"opt-label\">1時間後に折り返す<span class=\"opt-sub\">確認のうえ掛け直します。' + esc(hotelCallbackSub(t)) + '</span></span>' },\n    ] : []),\n",
    to:'',
    expected:'「伝える」のID・項目名・注意書きが完全一致しない',
  },
  {
    name:'着信トーストを復活させる', file:'p3_game.js',
    from:'      activated++;', to:"      activated++;\n      toast('着信', '新しい着信です', '');",
    expected:'トーストの関数・呼び出し・DOM・CSSが残っている',
  },
  {
    name:'expertの既定終話を切断へ変える', file:'p2_data.js',
    from:"  expert:'complaint',", to:"  expert:'hangup',",
    expected:'顧客タイプ別の既定終話が確定仕様と違う',
  },
  {
    name:'クレームCSATを上げる', file:'p3_game.js',
    from:"csat:kind === 'complaint' ? 1.0 : 0.5", to:"csat:kind === 'complaint' ? 1.1 : 0.5",
    expected:'クレーム／切断のCSATが1.0／0.5ではない',
  },
  {
    name:'苦情メール低CSAT境界を1へ下げる', file:'p3_game.js',
    from:"(result.kind === 'closed' || result.kind === 'refunded') && result.csat < 2 ? rollLuck() : false", to:"(result.kind === 'closed' || result.kind === 'refunded') && result.csat < 1 ? rollLuck() : false",
    expected:'不満足な返金が後日の苦情メール対象に入らない',
  },
  {
    name:'苦情メールをデブリーフから消す', file:'p4_view.js',
    from:'翌日、次の苦情が届いています', to:'翌日の連絡',
    expected:'翌日デブリーフの苦情メール別枠・件数表示がない',
  },
  {
    name:'苛立ち点滅境界を90超へずらす', file:'p4_view.js',
    from:"t.stress > 80 ? ' alert' : ''", to:"t.stress > 90 ? ' alert' : ''",
    expected:'ストレス80超でメーターが点滅しない',
  },
  {
    // 途中切断と、折り返せずに掛け直された場合の2か所で同じ記録を残している。
    name:'再着信をオフィス記録から外す', file:'p3_game.js',
    from:"function finishInterruptedCall(t){\n  if (!t || !t.pendingInterruption) return;\n  t.pendingInterruption = false;\n  t.redialCount++;\n  t.state = 'waiting';\n  t.arrivedTurn = state.turn;\n  t.greeted = false;\n  t.redialOpening = redialOpening(t);\n  t.redialSpoken = false;\n  t.redialGreeting = true;\n  state.focus = null;\n  state.ui = defaultUi();\n  playDisconnectSound();\n  recordOfficeEvent('redial', customerLabel(t, true) + 'から再着信しています。');", to:"function finishInterruptedCall(t){\n  if (!t || !t.pendingInterruption) return;\n  t.pendingInterruption = false;\n  t.redialCount++;\n  t.state = 'waiting';\n  t.arrivedTurn = state.turn;\n  t.greeted = false;\n  t.redialOpening = redialOpening(t);\n  t.redialSpoken = false;\n  t.redialGreeting = true;\n  state.focus = null;\n  state.ui = defaultUi();\n  playDisconnectSound();\n  void customerLabel(t, true);",
    expected:'再着信の情報が状態表示・会話メモ・無効理由へ移っていない',
  },
  {
    name:'AudioContextをシフト開始前に作る', file:'p4_view.js',
    from:"  $('btn-start').onclick = () => {\n    initAudio();\n    unlockAudioFromGesture();", to:"  unlockAudioFromGesture();\n  $('btn-start').onclick = () => {\n    initAudio();",
    expected:'シフト開始タップでiPhone音声を解除しない',
  },
  {
    name:'音声例外をゲームへ投げ直す', file:'p4_view.js',
    from:'} catch (error){ /* 音が出せなくてもゲーム進行は続ける */ }', to:'} catch (error){ throw error; }',
    expected:'音声処理の例外でゲーム進行が止まる',
  },
  {
    name:'ミュート判定を無視する', file:'p4_view.js',
    from:'if (!GAME_FLAGS.soundEnabled || !audioContext) return;', to:'if (!audioContext) return;',
    expected:'soundEnabled:falseでも発音処理が起きる',
  },
  {
    name:'ファンファーレ境界を4超へずらす', file:'p4_view.js',
    from:'if (result.csat >= 4) return \'fanfare\';', to:'if (result.csat > 4) return \'fanfare\';',
    expected:'クローズ音のCSAT 4.0／3.0／2.0境界または放棄呼の分類が違う',
  },
  {
    name:'事故音を失敗音と同じにする', file:'p4_view.js',
    from:"if (result.kind === 'complaint' || result.kind === 'hangup') return 'accident';", to:"if (result.kind === 'complaint' || result.kind === 'hangup') return 'failure';",
    expected:'complaint／hangupが事故音へ分類されない',
  },
  {
    name:'タイプ音を毎文字鳴らす', file:'p4_view.js',
    from:'function playTypeSound(index, line, ticket){\n  if (index % 4) return;', to:'function playTypeSound(index, line, ticket){',
    expected:'タイプ音が1文字ごとではなく間引かれていない',
  },
  {
    name:'§58 男性の声を中間音へ戻す', file:'p4_view.js',
    from:'const TYPE_SOUND_BASE_HZ = Object.freeze({ male:660, neutral:760, female:860 });',
    to:'const TYPE_SOUND_BASE_HZ = Object.freeze({ male:760, neutral:760, female:860 });',
    expected:'§58 男性・性別なし・女性の打鍵音が低・中・高に分かれない',
  },
  {
    name:'§58 性別不明で顧客データを直接参照する', file:'p4_view.js',
    from:"  const gender = line && line.who === 'cust' && ticket && ticket.s ? ticket.s.gender : null;",
    to:"  const gender = line.who === 'cust' ? ticket.s.gender : null;",
    expected:'§58 性別のない話し手または案件で打鍵音が落ちる',
  },
  {
    name:'§58 症状で声を高くして答えを漏らす', file:'p4_view.js',
    from:"  const base = gender === 'male' ? TYPE_SOUND_BASE_HZ.male",
    to:"  if (ticket && ticket.s && String(ticket.s.opening || '').includes('圏外')) return 1040;\n  const base = gender === 'male' ? TYPE_SOUND_BASE_HZ.male",
    expected:'§58 声の高さが性別以外の症状・真因・顧客タイプを参照する',
  },
  {
    name:'§58 文字送りから話し手を渡さない', file:'p4_view.js',
    from:'    playTypeSound(pos, line, t);',
    to:'    playTypeSound(pos);',
    expected:'顧客発話で対応する効果音関数が呼ばれない',
  },
  {
    name:'§58 打鍵音を長くする', file:'p4_view.js',
    from:"  withAudio((ctx, volume) => synthTone(ctx, volume, frequency, 0, .018, {type:'square',level:.025}));",
    to:"  withAudio((ctx, volume) => synthTone(ctx, volume, frequency, 0, .08, {type:'square',level:.025}));",
    expected:'§58 打鍵音の高さだけを変え、長さと音量を維持できない',
  },
  {
    name:'§58 オペレーター発話にも顧客の文字送り音を付ける', file:'p3_game.js',
    from:"(x.who === 'cust' || x.who === 'front' || x.who === 'sys')",
    to:"(x.who === 'cust' || x.who === 'front' || x.who === 'sys' || x.who === 'me')",
    expected:'未表示行を会話順に選んでいない',
  },
  {
    name:'§59 共通出力倍率を1へ戻す', file:'p2_data.js',
    from:'  outputGain:3,',
    to:'  outputGain:1,',
    expected:'§59 共通倍率3と既定音量0.75で全効果音が十分に増幅されない',
  },
  {
    name:'§59 プレイ中の音ボタンを外す', file:'p1_head.html',
    from:'data-sound-toggle="1" data-sound-compact="1"',
    to:'data-sound-topbar="1" data-sound-compact="1"',
    expected:'§59 プレイ中と開始前の両方に音のON/OFFがない',
  },
  {
    name:'§59 開始前の音ボタンを外す', file:'p4_view.js',
    from:'      soundQuickControlHtml() +\n      audioDiagnosticHtml() +',
    to:'      audioDiagnosticHtml() +',
    expected:'§59 プレイ中と開始前の両方に音のON/OFFがない',
  },
  {
    name:'§59 音のON/OFFを保存しない', file:'p4_view.js',
    from:"function setSoundEnabled(enabled, storage = getCareerStorage()){\n  GAME_FLAGS.soundEnabled = Boolean(enabled);\n  setAudioUnlockStatus(GAME_FLAGS.soundEnabled ? 'idle' : 'disabled');\n  writeSoundSettings(storage);",
    to:"function setSoundEnabled(enabled, storage = getCareerStorage()){\n  GAME_FLAGS.soundEnabled = Boolean(enabled);\n  setAudioUnlockStatus(GAME_FLAGS.soundEnabled ? 'idle' : 'disabled');",
    expected:'§59 音のON/OFFまたは音量変更が保存されない',
  },
  {
    name:'§59 音ボタンを演出スキップより後に処理する', file:'p5_events.js',
    from:"  const soundToggle = e.target.closest('[data-sound-toggle]');\n  if (soundToggle){ toggleSoundFromGesture(); return; }\n  if (timePassage){\n    const answerDuringPassage = e.target.closest('[data-office-answer]');\n    finishTimePassage();\n    if (!answerDuringPassage) return;\n  }",
    to:"  if (timePassage){\n    const answerDuringPassage = e.target.closest('[data-office-answer]');\n    finishTimePassage();\n    if (!answerDuringPassage) return;\n  }\n  const soundToggle = e.target.closest('[data-sound-toggle]');\n  if (soundToggle){ toggleSoundFromGesture(); return; }",
    expected:'§59 音のON/OFFが文字送り・時間経過のスキップより先に反応しない',
  },
  {
    name:'§59 起動時に保存した音設定を読まない', file:'p5_events.js',
    from:'initializeSoundSettings();\ninitializeCareer();',
    to:'initializeCareer();',
    expected:'§59 ゲーム起動前に保存済みの音設定を復元しない',
  },
  {
    name:'§60 resume失敗後もAudioContextを作り直さない', file:'p4_view.js',
    from:"    if (ctx.state !== 'running') ctx = await recreateAudioContextFromGesture(ctx);",
    to:"    if (ctx.state !== 'running') return false;",
    expected:'§60 interruptedからresumeし、戻らなければ作り直す実挙動がない',
  },
  {
    name:'§60 古いAudioContextを閉じても強制作り直しをしない', file:'p4_view.js',
    from:'  const fresh = initAudio(true);',
    to:'  const fresh = initAudio(false);',
    expected:'§60 古いAudioContextを閉じ、新規作成して再開する実挙動がない',
  },
  {
    name:'§60 診断表示のAudioContext状態を固定する', file:'p4_view.js',
    from:"  const context = ' AudioContext: ' + currentAudioContextState() + '。';",
    to:"  const context = ' AudioContext: running。';",
    expected:'§60 現在のAudioContext状態が診断表示に出ない',
  },
  {
    name:'通話開始時に着信音を止めない', file:'p4_view.js',
    from:'function enterCall(){\n  stopOfficeRing();', to:'function enterCall(){',
    expected:'通話画面へ移ってもオフィス着信音が止まらない',
  },
  {
    name:'苦情メールを第三者要約1行へ戻す', file:'p2_data.js',
    from:"lines:Object.freeze(['「{symptom}」とお伝えしたのに、不安なまま通話を終えることになりました。', '海外で一人取り残されたようで、本当に怖かったです。最後まで安心できる説明をしてほしかったです。'])", to:"lines:Object.freeze(['{symptom}について不安が残ったとの訴えです。'])",
    expected:'苦情メールが客自身の感情ある2〜3行の文面ではない',
  },
  {
    name:'苦情メールへ真因を差し込む', file:'p4_view.js',
    from:"line.replace('{symptom}', t.s.opening)", to:"line.replace('{symptom}', causeName(t.s.trueCause))",
    expected:'苦情メールが症状ではなく客の知らない真因を漏らしている',
  },
  {
    name:'クローズ結果をオフィスから消す', file:'p3_game.js',
    from:"  recordOfficeEvent('closed', t.s.id + '：' + result.label + ' CSAT ' + result.csat.toFixed(1));\n", to:'',
    expected:'クローズ結果の情報が状態表示・会話メモ・無効理由へ移っていない',
  },
  {
    name:'ネタバレ警告へ接尾辞を足す', file:'p4_view.js',
    from:"SCENARIOS.length + '件の真因と正解対処がすべて表示されます。", to:"SCENARIOS.length + '件の真因と正解対処がすべて表示されます。_x",
    expected:'調整コンソールを開く前のネタバレ警告が案件数へ追従しない',
  },
  {
    name:'不明表示へ接尾辞を足す', file:'p4_view.js',
    from:'<strong>まだ不明</strong>', to:'<strong>まだ不明_x</strong>',
    expected:'発話前の苛立ち表示が不明値と完全一致しない',
  },
  {
    name:'未解決終話確認へ接尾辞を足す', file:'p4_view.js',
    from:'原因と対処を案内すると、この電話を終われます。', to:'説明を続けてください。',
    expected:'§33 検査2: 原因絞り込み後の終話確認が対処案内を次手にしない',
  },
  {
    name:'1案件から雑談話題を外す', file:'p2_data.js',
    from:'  handoverSymptom:\'地図の読み込みが非常に遅い\',\n  smalltalk:[', to:'  handoverSymptom:\'地図の読み込みが非常に遅い\',\n  smalltalk_missing:[',
    expected:'雑談話題のrevealが実際に到達できる質問へ接続されていない',
  },
  {
    name:'未解禁の雑談話題も表示する', file:'p4_view.js',
    from:'return (t.s.smalltalk || []).filter(topic => topicAvailable(t, topic));',
    to:'return (t.s.smalltalk || []);',
    expected:'会話に出ていない雑談話題が描画候補へ入る',
  },
  {
    name:'hurriedの雑談を成功へ反転する', file:'p2_data.js',
    from:'hurried:14', to:'hurried:-14',
    expected:'タイプ別の雑談効果が完全一致しない',
  },
  {
    name:'高ストレスの雑談逆効果を外す', file:'p3_game.js',
    from:'const scaled = t.stress >= 40;', to:'const scaled = false;',
    expected:'ストレス40以上で全タイプが一律+8の逆効果にならない',
  },
  {
    name:'雑談2回目の式を変える', file:'p3_game.js',
    from:'delta = delta / 2 + 5;', to:'delta = delta / 2 + 4;',
    expected:'同じ雑談話題の2回目が delta/2+5 ではない',
  },
  {
    name:'話を向ける1.5倍を外す', file:'p3_game.js',
    from:"if (mode === 'ask') delta *= 1.5;", to:"if (mode === 'ask') delta *= 1;",
    expected:'「話を向ける」が成功値を1.5倍しない',
  },
  {
    name:'雑談の時間を2分へ変える', file:'p3_game.js',
    from:'  if (!applyReactionStress(t, result)) return;\n  if (!spendOnCall(t, 1, 0)) return;\n  state.ui = defaultUi();\n  render();\n}\n\nfunction sootheResult', to:'  if (!applyReactionStress(t, result)) return;\n  if (!spendOnCall(t, 2, 0)) return;\n  state.ui = defaultUi();\n  render();\n}\n\nfunction sootheResult',
    expected:'雑談の両入口が共通の1分消費を通らない',
  },
  {
    name:'雑談ラベルへおすすめを漏らす', file:'p2_data.js',
    from:'tellLabel:\'新婚旅行、おめでとうございます\'', to:'tellLabel:\'新婚旅行、おめでとうございます（おすすめ）\'',
    expected:'雑談データのラベルが効果の答えを漏らしている',
  },
  {
    name:'使用済み雑談をdisabledにする', file:'p4_view.js',
    from:'class="opt smalltalk-choice" data-smalltalk="', to:'class="opt smalltalk-choice" disabled data-smalltalk="',
    expected:'使用済み雑談話題が無効化または表示で識別される',
  },
  {
    name:'質問区分の番号を戻す', file:'p4_view.js',
    from:'<span class="command-copy"><b>\' + esc(group.label)',
    to:'<span class="command-no">\' + group.no + \'</span><span class="command-copy"><b>\' + esc(group.label)',
    expected:'「聞く」の区分ボタンに番号が残っている',
  },
  {
    name:'質問区分の本文を番号用24px列へ戻す', file:'p1_head.html',
    from:'.ask-group-choice{ min-height:101px; grid-template-columns:minmax(0,1fr); }',
    to:'.ask-group-choice{ min-height:101px; }',
    expected:'§42-3 番号なしcommand-choiceが番号用の列指定を上書きしない',
  },
  {
    name:'雑談のクリック監視を外す', file:'p5_events.js',
    from:',[data-smalltalk]', to:'',
    expected:'雑談ボタンがクリック監視セレクタに含まれない',
  },
  {
    name:'雑談の描画側へ逆効果注記を足す', file:'p4_view.js',
    from:"esc(mode === 'ask' ? topic.askLabel : topic.tellLabel) + '</span>",
    to:"esc(mode === 'ask' ? topic.askLabel : topic.tellLabel) + '（急ぎの方には逆効果）</span>",
    expected:'雑談の描画処理が効果の答えを注記している',
  },
  {
    name:'運の基準率を80%へ変える', file:'p2_data.js',
    from:'const LUCK_RATE = 0.9;', to:'const LUCK_RATE = 0.8;',
    expected:'運の本来どおり率が0.9ではない',
  },
  {
    name:'GAME_FLAGSの初期運率を変える', file:'p2_data.js',
    from:'luckRate: LUCK_RATE,', to:'luckRate: 0.8,',
    expected:'運・音・1日件数・引き継ぎ件数・キャリアの初期GAME_FLAGSが確定値と違う',
  },
  {
    name:'注入可能な乱数源を固定値へ置き換える', file:'p3_game.js',
    from:'random: Math.random,', to:'random: () => 0.5,',
    expected:'Math.randomがstate.random以外でも直接使われている',
  },
  {
    name:'rollLuckでMath.randomを直呼びする', file:'p3_game.js',
    from:'return state.random() < GAME_FLAGS.luckRate;', to:'return Math.random() < GAME_FLAGS.luckRate;',
    expected:'rollLuckが注入可能な乱数源とGAME_FLAGSを使わない',
  },
  {
    name:'対処の裏目分岐を外す', file:'p3_game.js',
    from:'return rollLuck() ? causeMatched : !causeMatched;', to:'return causeMatched;',
    expected:'裏目時に正しい対処が未解決にならない',
  },
  {
    name:'正しい対処の裏目も誤診へ数える', file:'p3_game.js',
    from:'if (!causeMatched){\n      t.misdiagnoses++;', to:'if (true){\n      t.misdiagnoses++;',
    expected:'裏目の正しい対処でmisdiagnosesが増える',
  },
  {
    name:'追加時間を抽選結果で変える', file:'p3_game.js',
    from:'if (!causeMatched) advance(2);', to:'if (!treatmentWorked) advance(2);',
    expected:'正しい対処の時間・費用が抽選結果で揺れる',
  },
  {
    name:'苛立ちの裏目で符号を反転する', file:'p3_game.js',
    from:'if (!expectedOutcome) delta = 0;', to:'if (!expectedOutcome) delta = -delta;',
    expected:'裏目の苛立ち増減が0にならない',
  },
  {
    name:'雑談から反応反転を外す', file:'p3_game.js',
    from:'return flipReaction({ delta, scaled, reply }, topic.goodReply, topic.badReply);', to:'return { delta, scaled, reply };',
    expected:'hurriedが裏目でも雑談goodReplyへ到達しない',
  },
  {
    name:'なだめるから反応反転を外す', file:'p3_game.js',
    from:"return flipReaction({ delta, scaled:false, reply:delta < 0 ? goodReply : badReply }, goodReply, badReply);",
    to:"return { delta, scaled:false, reply:delta < 0 ? goodReply : badReply };",
    expected:'なだめるが裏目で反対側の結果にならない',
  },
  {
    name:'謝るから反応反転を外す', file:'p3_game.js',
    from:'const result = flipReaction({ delta, scaled:false, reply }, goodReply, badReply);', to:'const result = { delta, scaled:false, reply };',
    expected:'謝るが裏目で反対側の結果にならない',
  },
  {
    name:'登場順フラグを無視する', file:'p3_game.js',
    from:'function prepareDailyScenarios(scenarios, random, flags = GAME_FLAGS){\n  const count = dailyTicketCount(random, flags);\n  const ordered = flags.shuffleArrival ?',
    to:'function prepareDailyScenarios(scenarios, random, flags = GAME_FLAGS){\n  const count = dailyTicketCount(random, flags);\n  const ordered = false ?',
    expected:'登場順シャッフルを元へ戻せない',
  },
  {
    name:'シャッフル後に到着枠を振り直さない', file:'p3_game.js',
    from:'{ arrive:arrivalSlots[index] }', to:'{ arrive:scenario.arrive }',
    expected:'シャッフル後の順番へ固定到着枠を振り直していない',
  },
  {
    name:'シャッフルで1案件を落とす', file:'p3_game.js',
    from:'const shuffled = scenarios.slice();', to:'const shuffled = scenarios.slice(1);',
    expected:'シャッフル後に全案件の欠落・重複がある',
  },
  {
    name:'裏目を顧客発話へ漏らす', file:'p3_game.js',
    from:'試してみましたが、変わりません…。まだ繋がらないです。', to:'運が悪かったので、まだ繋がらないです。',
    expected:'抽選結果が画面・ログ・transcriptに漏れる',
  },
  {
    name:'質問回答で乱数を直に引く', file:'p3_game.js',
    from:'function doAsk(qid){\n  const t = state.focus;', to:'function doAsk(qid){\n  state.random();\n  const t = state.focus;',
    expected:'doAskが質問回答・事実・診断結果を直接ランダム化する',
  },
  {
    name:'調整コンソールから運切替を外す', file:'p4_view.js',
    from:'id="balance-luck"', to:'id="balance-luck-missing"',
    expected:'調整コンソールに運と登場順の切り替えがない',
  },
  {
    name:'運なし専用の特別経路を作る', file:'p3_game.js',
    from:'return state.random() < GAME_FLAGS.luckRate;', to:'if (GAME_FLAGS.luckRate === 1) return true;\n  return state.random() < GAME_FLAGS.luckRate;',
    expected:'運なし専用の特別経路がrollLuckにある',
  },
  {
    name:'旧挙動の正解CSATを変える', file:'p3_game.js',
    from:"else if (remedyId === bestId){ base = 5.0; grade = 'best'; }", to:"else if (remedyId === bestId){ base = 4.9; grade = 'best'; }",
    expected:'運なしの同一操作列でCSATが決定論的な結果に戻らない（本人確認なしの記録不足0.4を含む）',
  },
  {
    name:'誤診復旧の振り返り補正を外す', file:'p4_view.js',
    from:"else if (r.causeMatched === false) judge = '選んだ対応のあと通信は復旧し、一次解決になりました。'", to:"else if (false) judge = '選んだ対応のあと通信は復旧し、一次解決になりました。'",
    expected:'誤診から復旧した振り返りが原因・対処とも最適と誤表示する',
  },
  {
    name:'対処ラベルを終話表現へ戻す', file:'p4_view.js',
    from:"(t.symptomResolved ? '原因を伝える' : '原因と対処を伝える')", to:"(t.symptomResolved ? '原因を伝える' : '対応を決めて終える')",
    expected:'「伝える」のID・項目名・注意書きが完全一致しない',
  },
  {
    name:'対処の注意書きへ終話表現を戻す', file:'p4_view.js',
    from:'原因を見立てて、対処をご案内します。', to:'原因を見立てて、対処をご案内します。選ぶと通話が終わります。',
    expected:'「伝える」のID・項目名・注意書きが完全一致しない',
  },
  {
    name:'対処を伝えた瞬間に案件を閉じる', file:'p3_game.js',
    from:'t.pendingResult = result;', to:'closeTicket(t, result);',
    expected:'裏目の誤診が解決扱いにならない',
  },
  {
    name:'会社側返金満足率を60%へ変える', file:'p2_data.js',
    from:"causes:Object.freeze(['hardware','provision','logistics','carrier','coverage']), rejectionRate:0.05, satisfactionRate:0.5",
    to:"causes:Object.freeze(['hardware','provision','logistics','carrier','coverage']), rejectionRate:0.05, satisfactionRate:0.6",
    expected:'会社側の返金拒否率5%／満足率50%が違う',
  },
  {
    name:'返金額を0円にする', file:'p2_data.js',
    from:'amount: 2400,', to:'amount: 0,',
    expected:'返金額が確定値2,400円ではない',
  },
  {
    name:'返金ラベルへ責任所在を漏らす', file:'p4_view.js',
    from:'<span class="opt-label">返金をご案内する</span>', to:'<span class="opt-label">返金をご案内する（hardware等の会社側向け）</span>',
    expected:'返金の責任所在一覧が画面・ログ・ラベルに漏れる',
  },
  {
    name:'返金の確認を飛ばす', file:'p5_events.js',
    from:"if (d.refund){ if (!state.focus.refundProposalRejected) state.ui = defaultUi('refund_confirm'); render(); return true; }", to:"if (d.refund){ doRefund(); return true; }",
    expected:'返金が確認を挟まず実行される',
  },
  {
    name:'返金確認から終話明示を消す', file:'p4_view.js',
    from:'受け入れていただければ、この電話は終わります。', to:'返金を実行します。',
    expected:'§31 検査9: 返金確認が提案と条件つき終話を伝えない',
  },
  {
    name:'返金費用を加算しない', file:'p3_game.js',
    from:'state.cost += REFUND_POLICY.amount;', to:'state.cost += 0;',
    expected:'満足した返金で2,400円が加算されない',
  },
  {
    name:'luckRate 1でも中立を満足させる', file:'p3_game.js',
    from:"if (GAME_FLAGS.luckRate === 1) return assessment.group === 'company';", to:"if (GAME_FLAGS.luckRate === 1) return assessment.group !== 'customer';",
    expected:'luckRate 1.0で診断済みの会社側だけが返金に満足する決定論へ戻らない',
  },
  {
    name:'返金クリック監視を外す', file:'p5_events.js',
    from:',[data-refund]', to:'',
    expected:'返金ボタンが実行処理へ接続されていない',
  },
  {
    name:'満足返金CSATを4.0へ上げる', file:'p3_game.js',
    from:'csat:satisfied ? 2.5 : 1.0', to:'csat:satisfied ? 4.0 : 1.0',
    expected:'満足した返金が未解決扱いのCSAT 2.5にならない',
  },
  {
    name:'中立分類からsimを落とす', file:'p2_data.js',
    from:"causes:Object.freeze(['location','geo_block','sim'])", to:"causes:Object.freeze(['location','geo_block'])",
    expected:'中立の返金拒否率10%／満足率25%が違う',
  },
  {
    name:'不満足返金にも別れの言葉を付ける', file:'p3_game.js',
    from:"  } else {\n    pushCustomerLine(t, 'お金の話ではなく", to:"  } else {\n    pushCustomerLine(t, farewellLine(t.s, 'partial'), { plain:true });\n    pushCustomerLine(t, 'お金の話ではなく",
    expected:'不満足な返金に別れの言葉が付く',
  },
  {
    name:'不満足返金を苦情メール対象から外す', file:'p3_game.js',
    from:"(result.kind === 'closed' || result.kind === 'refunded') && result.csat < 2", to:"result.kind === 'closed' && result.csat < 2",
    expected:'不満足な返金が後日の苦情メール対象に入らない',
  },
  {
    name:'旧refunds回数管理を戻す', file:'p3_game.js',
    from:'const satisfied = refundSatisfied(t, assessment);', to:'t.refunds = (t.refunds || 0) + 1;\n  const satisfied = refundSatisfied(t, assessment);',
    expected:'旧返金の回数管理・CSAT逓減がコードに残っている',
  },
  {
    name:'広域障害正規対処の費用を消す', file:'p2_data.js',
    from:"{ id:'r_outage_explain', label:'広域障害であることと復旧見込みを説明し、日割りの返金を案内する', sub:'原因が判明している場合の正規対応', kind:'resolve', needsOutage:true, cost:2400 }",
    to:"{ id:'r_outage_explain', label:'広域障害であることと復旧見込みを説明する', sub:'原因が判明している場合の正規対応', kind:'resolve', needsOutage:true, cost:0 }",
    expected:'広域障害の正規対処 r_outage_explain が損なわれている',
  },
  {
    name:'anxiousの苛立ち段階を空にする', file:'p2_data.js',
    from:"irritated:['あの…このまま全部だめになったりしませんよね？', 'すみません、手が震えてきて…。']",
    to:'irritated:[]',
    expected:'顧客タイプ4種の苛立ち段階が2〜3本で揃っていない',
  },
  {
    name:'苛立ち文言を別タイプへ使い回す', file:'p2_data.js',
    from:'あの、その言葉が分からなくて…すみません。',
    to:'あの…このまま全部だめになったりしませんよね？',
    expected:'顧客タイプをまたいで同じ苛立ち文言が使い回されている',
  },
  {
    name:'顧客会話へ人格攻撃を混ぜる', file:'p2_data.js',
    from:'機械のことが本当に分からなくて…。',
    to:'私って馬鹿で、機械のことが本当に分からなくて…。',
    expected:'顧客向け会話に禁止語が含まれている',
  },
  {
    name:'顧客会話へモデル企業名を混ぜる', file:'p2_data.js',
    from:'社内システムと海外系サービスだけ到達しません。',
    to:'社内システムとイモトのWiFiだけ到達しません。',
    expected:'公開画面にモデル企業名が含まれている',
  },
  {
    name:'社内照会へモデル運営会社名を混ぜる', file:'p2_data.js',
    from:'提携: {carrier} ✓ ／ 備考: 通常のデータプラン',
    to:'提携: {carrier} ✓ ／ 運営: エクスコムグローバル ／ 備考: 通常のデータプラン',
    expected:'公開画面にモデル企業名が含まれている',
  },
  {
    name:'顧客会話をtyping_budget超過へ伸ばす', file:'p2_data.js',
    from:'前置きはいい。次は？',
    to:'前置きはいい。次は？説明が長すぎます説明が長すぎます説明が長すぎます説明が長すぎます説明が長すぎます説明が長すぎます説明が長すぎます説明が長すぎます説明が長すぎます説明が長すぎます説明が長すぎます説明が長すぎます説明が長すぎます説明が長すぎます説明が長すぎます説明が長すぎます説明が長すぎます説明が長すぎます説明が長すぎます説明が長すぎます',
    expected:'顧客向け会話がtyping_budgetの4秒上限を超えている',
  },
  {
    name:'会話改稿に紛れて苛立ち初期値を変える', file:'p2_data.js',
    from:'stressStart:20, stressRate:1.2, missRate:1.0',
    to:'stressStart:21, stressRate:1.2, missRate:1.0',
    expected:'顧客会話改稿で苛立ち数値・運・判定ロジックが変わっている',
  },
  {
    name:'1シナリオの第一声を空にする', file:'p2_data.js',
    from:"opening:'急いでます。一台だけ繋がりません。ほかは使えます。あと10分で移動しないといけません。何を見ればいいですか。',",
    to:"opening:'',",
    expected:'全シナリオの第一声が揃っていない',
  },
  {
    name:'全タイプを名乗る前に喋らせる', file:'p3_game.js',
    from:"return t.s.type === 'hurried';", to:"return true;",
    expected:'hurried以外の顧客が名乗る前に話し始める',
  },
  {
    name:'hurriedも名乗るまで黙らせる', file:'p3_game.js',
    from:"return t.s.type === 'hurried';", to:"return false;",
    expected:'hurriedが名乗る前に話し始めない',
  },
  {
    name:'主コマンドに操作を戻す', file:'p2_data.js',
    from:"  Object.freeze({ id:'record',   no:'4', label:'ログ' }),",
    to:"  Object.freeze({ id:'try',      no:'4', label:'操作' }),\n  Object.freeze({ id:'record',   no:'5', label:'ログ' }),",
    expected:'主コマンド4つの順番・名称が違う',
  },
  {
    name:'hurriedにも名乗りを強制する', file:'p4_view.js',
    from:'if (!t.greeted && !customerHasSpoken(t)) return',
    to:'if (!t.greeted) return',
    expected:'名乗る前の専用描画がない',
  },
  {
    name:'任意の名乗るボタンを消す', file:'p4_view.js',
    from:'class="command-choice optional-greeting" data-greet="1"',
    to:'class="command-choice optional-greeting" data-optional-greeting="1"',
    expected:'§24 任意の名乗る、またはrushedReplyが残っていない',
  },
  {
    name:'危険操作を正解対処の前提にする', file:'p2_data.js',
    from:"kind:'resolve', needsTest:'t_move'",
    to:"kind:'resolve', needsTest:'t_reset'",
    expected:'§24 危険な操作が初手の正解になっている',
  },
  {
    name:'将来復帰用callbackToを1件消す', file:'p2_data.js',
    from:"id:'S1', arrive:0, name:'三宅 千夏', nameEn:'Chika Miyake', age:27, ageRange:[24,36], type:'anxious', abandonAfter:32, callbackTo:'hotel',",
    to:"id:'S1', arrive:0, name:'三宅 千夏', nameEn:'Chika Miyake', age:27, ageRange:[24,36], type:'anxious', abandonAfter:32, callbackTo:null,",
    expected:'§24/§25 案件データのcallbackToが揃っていない',
  },
  {
    name:'五夜勤を旧ラベルへ戻す', file:'p2_data.js',
    from:"id:'ten_nights', label:'五夜勤'", to:"id:'ten_nights', label:'十夜勤'",
    expected:'5シフト条件のバッジ名が「五夜勤」ではない',
  },
  {
    name:'現地キャリア照会を29分へ短縮する', file:'p2_data.js',
    from:"title:'現地キャリアへの再開通依頼', spoken:'現地キャリアへ再開通を依頼しました。', minutes:30, external:true",
    to:"title:'現地キャリアへの再開通依頼', spoken:'現地キャリアへ再開通を依頼しました。', minutes:29, external:true",
    expected:'§25 l_carrierが30分の社外照会ではない',
  },
  {
    name:'現地キャリア照会を通話中に直接実行する', file:'p3_game.js',
    from:'  if (l.external) return;', to:'  if (false) return;',
    expected:'§25 l_carrierをdoLookupから直接実行できる',
  },
  {
    name:'照会選択前から折り返しを開始する', file:'p3_game.js',
    from:"state.ui.tab !== 'lookup' || state.ui.lookup !== lookup.id",
    to:'false',
    expected:'§25 l_carrier選択前から折り返し照会を開始できる',
  },
  {
    name:'折り返すを5つ目の主コマンドへ戻す', file:'p2_data.js',
    from:"  Object.freeze({ id:'record',   no:'4', label:'ログ' }),",
    to:"  Object.freeze({ id:'record',   no:'4', label:'ログ' }),\n  Object.freeze({ id:'callback', no:'5', label:'折り返す' }),",
    expected:'主コマンド4つの順番・名称が違う',
  },
  {
    name:'ホテル折り返し先の選択を消す', file:'p4_view.js',
    from:'data-callback-destination="hotel"', to:'data-callback-hotel="1"',
    expected:'§39 現地キャリア折り返しがホテルと滞在先確認へ統一されていない',
  },
  {
    name:'折り返しのFront Desk段階を飛ばす', file:'p3_game.js',
    from:"t.callbackStage = 'front_desk';", to:"t.callbackStage = 'connected';",
    expected:'§39 折り返しがホテルのフロントから始まらない',
  },
  {
    name:'折り返し再接続から顧客発話を消す', file:'p3_game.js',
    from:"    { who:'front', text:frontReply },\n    { who:'cust', text:customerReply },",
    to:"    { who:'front', text:frontReply },\n    { who:'note', text:customerReply },",
    expected:'§39 フロント接続後にFront Deskと顧客の発話が揃わない',
  },
  {
    name:'S12現地照会から0時停止を消す', file:'p2_data.js',
    from:'当該回線は現地時間 00:00 に契約満了として停止',
    to:'当該回線は契約満了として停止',
    expected:'§25 S12の自社契約照会と現地キャリア照会が食い違って見えない',
  },
  {
    name:'S12第一声で0時停止を明かす', file:'p2_data.js',
    from:'夜になって急に圏外になりました。さっきまで使えていたのに',
    to:'0時になって急に圏外になりました。さっきまで使えていたのに',
    expected:'§25 S12の時間手がかりが第一声で漏れる、またはq_whenで得られない',
  },
  {
    name:'S12正解対処に現地照会を必須化する', file:'p2_data.js',
    from:"id:'r_escalate_prov', label:'開通設定の不備としてプロビジョニング担当へエスカレーションする', sub:'枠を1つ消費', kind:'escalate'",
    to:"id:'r_escalate_prov', label:'開通設定の不備としてプロビジョニング担当へエスカレーションする', sub:'枠を1つ消費', kind:'escalate', needsLookup:'l_carrier'",
    expected:'§25 l_carrierがS12の正解対処に必須化されている',
  },
  {
    name:'折り返し開始時に別の待ち電話を閉じる', file:'p3_game.js',
    from:"  t.callbackDue = state.clock + lookup.minutes;\n  t.state = 'callback';\n  leaveCallForOffice();",
    to:"  t.callbackDue = state.clock + lookup.minutes;\n  t.state = 'callback';\n  state.tickets.filter(ticket => ticket !== t && ticket.state === 'waiting').forEach(ticket => { ticket.state = 'closed'; });\n  leaveCallForOffice();",
    expected:'§25 折り返し中にほかの電話を取れない',
  },
  {
    name:'照会完了の記録なし発話を復活させる', file:'p2_data.js',
    from:"    talkComplete:'ありがとうございます。こちらでも確認が取れました。',",
    to:"    talkComplete:'ありがとうございます。こちらでも確認が取れました。',\n    miss:'該当する記録は確認できませんでした。',",
    expected:'§26 CALL_FLOW_LINES.lookup.missが残っている',
  },
  {
    name:'契約照会から顧客向けspokenを消す', file:'p2_data.js',
    from:"spoken:'契約は有効で、使用量も制限内でした。'",
    to:"spoken:''",
    expected:'§26 LOOKUPSの全項目に顧客向けspokenがない',
  },
  {
    // §40で照会結果の読み上げ自体をやめたので、読み上げ内容の取り違えではなく
    // 「読み上げに戻すこと」を変異として見る（上の「照会結果を客へ読み上げに戻す」）。
    name:'照会完了の合図を空文字にする', file:'p2_data.js',
    from:"    holdComplete:'お待たせしました。確認が取れました。',",
    to:"    holdComplete:'',",
    expected:'§40 照会完了の合図が保留・通話中で揃っていない',
  },
  {
    name:'既定照会結果をmissへ戻す', file:'p2_data.js',
    from:"defaultResult:'[契約照会] 契約: 有効 ／ 使用量: 制限内 ／ 速度制限なし'",
    to:"miss:'[契約照会] 契約: 有効 ／ 使用量: 制限内 ／ 速度制限なし'",
    expected:'§26 LOOKUPSの既定結果がdefaultResultへ改名されていない',
  },
  {
    name:'質問の二度聞き用missを消す', file:'p2_data.js',
    from:"id:'q_name', label:'恐れ入ります、お名前をフルネームでうかがえますか', miss:",
    to:"id:'q_name', label:'恐れ入ります、お名前をフルネームでうかがえますか', repeatReply:",
    expected:'§26 QUESTIONSの二度聞き用missが損なわれている',
  },
  {
    name:'照会結果から共通システム画面クラスを外す', file:'p4_view.js',
    from:'class="system-screen lookup-system-screen',
    to:'class="lookup-system-screen',
    expected:'§26 照会結果が枠・タイトル・等幅フォントのシステム画面にならない',
  },
  {
    name:'照会直後のシステム結果を直近会話から落とす', file:'p3_game.js',
    from:"    who:'sys',\n    typed:true,",
    to:"    who:'sys',\n    typed:false,",
    expected:'§26 照会結果が直近会話で未表示になる',
  },
  {
    name:'照会項目をスラッシュで分割しない', file:'p4_view.js',
    from:"body.split(/\\s*／\\s*|\\s*。\\s*(?=\\S)/)",
    to:"body.split(/\\s*。\\s*(?=\\S)/)",
    expected:'§26 照会結果の項目が行ごとに分かれない',
  },
  {
    name:'システム画面を等幅フォント以外にする', file:'p1_head.html',
    from:'.system-screen{\n  display: block;\n  overflow: hidden;\n  border: 1px solid var(--signal-deep);\n  border-radius: 3px;\n  background: var(--panel-2);\n  color: var(--signal);\n  font-family: var(--mono);',
    to:'.system-screen{\n  display: block;\n  overflow: hidden;\n  border: 1px solid var(--signal-deep);\n  border-radius: 3px;\n  background: var(--panel-2);\n  color: var(--signal);\n  font-family: sans-serif;',
    expected:'§26 照会結果が枠・タイトル・等幅フォントのシステム画面にならない',
  },
  {
    name:'照会画面から使用量vizを外す', file:'p4_view.js',
    from:"    (line.viz ? renderLookupViz(line.viz) : '') +",
    to:"    '' +",
    expected:'§26 使用量vizがシステム画面の外へ出ている',
  },
  {
    name:'現地キャリアの外部照会表示を消す', file:'p4_view.js',
    from:"? '<em class=\"lookup-system-external\">外部照会</em>'",
    to:"? '<em>社内システム</em>'",
    expected:'§26 l_carrierが外部照会として見分けられない',
  },
  {
    name:'本人特定前のログを無効化する', file:'p4_view.js',
    from:'const choices = COMMAND_DEFS.map(c =>',
    to:"const choices = COMMAND_DEFS.map(command => Object.assign({}, command, command.id === 'record' ? {disabled:true} : {})).map(c =>",
    expected:'§27 本人特定前のログが押せない',
  },
  {
    name:'共通拒否画面から必要条件を消す', file:'p4_view.js',
    from:'フルネームと渡航先、または契約IDを確認してください。',
    to:'必要な情報を確認してください。',
    expected:'§27 本人特定前に必要条件を共通システム画面で案内しない',
  },
  {
    name:'ライト画面の本人確認拒否文を暗く戻す', file:'p1_head.html',
    from:'.system-screen .record-denied-message p{ color:#E4F6F4; }',
    to:'.system-screen .record-denied-message p{ color:var(--text); }',
    expected:'§27 ライト画面で本人確認の拒否文が暗く読めない',
  },
  {
    name:'共通本人確認拒否でも1分消費する', file:'p3_game.js',
    from:"  if (identificationReady(t)) return true;\n  state.ui = defaultUi('identity_denied');",
    to:"  if (identificationReady(t)) return true;\n  spendOnCall(t, 1, 0);\n  state.ui = defaultUi('identity_denied');",
    expected:'§27 本人特定前の共通拒否で時間を消費する',
  },
  {
    name:'契約IDで本人特定してもログを拒否する', file:'p3_game.js',
    from:'if (identificationReady(t)) return true;',
    to:'if (identificationReady(t) && !t.identified) return true;',
    expected:'§27 identificationReadyの契約ID／氏名＋渡航先条件を共通ガードが保たない',
  },
  {
    name:'氏名と渡航先が揃ってもログを拒否する', file:'p3_game.js',
    from:'if (identificationReady(t)) return true;',
    to:'if (identificationReady(t) && t.identified) return true;',
    expected:'§27 identificationReadyの契約ID／氏名＋渡航先条件を共通ガードが保たない',
  },
  {
    name:'通話記録を開く時間を2分にする', file:'p3_game.js',
    from:'if (!spendOnCall(t, 1, 0)) return;\n  state.ui = defaultUi(\'record\');',
    to:'if (!spendOnCall(t, 2, 0)) return;\n  state.ui = defaultUi(\'record\');',
    expected:'ログを読んでも通話1分を消費しない',
  },
  {
    name:'共通ガードに本人特定判定を複製する', file:'p3_game.js',
    from:'if (identificationReady(t)) return true;',
    to:'if (t.identified || (t.nameKnown && t.destinationKnown)) return true;',
    expected:'§27 共通ガードがidentificationReady以外の専用判定を持っている',
  },
  {
    name:'本人特定前の調べるを無効化する', file:'p4_view.js',
    from:'const choices = COMMAND_DEFS.map(c =>',
    to:"const choices = COMMAND_DEFS.map(command => Object.assign({}, command, command.id === 'lookup' ? {disabled:true} : {})).map(c =>",
    expected:'§27 本人特定前の「調べる」が押せない',
  },
  {
    name:'調べるが共通本人確認ガードを迂回する', file:'p3_game.js',
    from:'function openLookup(){\n  const t = state.focus;\n  if (!t || !requireIdentification(t)) return;',
    to:'function openLookup(){\n  const t = state.focus;\n  if (!t) return;',
    expected:'§27 調べる・ログが同じ本人確認ガードを使っていない',
  },
  {
    name:'調べるを開くと1分消費する', file:'p3_game.js',
    from:"  if (!t || !requireIdentification(t)) return;\n  state.ui = defaultUi('lookup');",
    to:"  if (!t || !requireIdentification(t)) return;\n  spendOnCall(t, 1, 0);\n  state.ui = defaultUi('lookup');",
    expected:'§27 「調べる」で時間を消費する',
  },
  {
    name:'通話記録から共通システム画面クラスを外す', file:'p4_view.js',
    from:'class="system-screen record-system-screen"',
    to:'class="record-system-screen"',
    expected:'§27 通話記録が枠・タイトル行を持つシステム画面ではない',
  },
  {
    name:'ライト画面の通話記録項目を暗く戻す', file:'p1_head.html',
    from:'.system-screen .log-customer b{ color:#78B8B3; }',
    to:'.system-screen .log-customer b{ color:var(--dim); }',
    expected:'§27 ライト画面で通話記録の見出し・項目が暗く読めない',
  },
  {
    name:'通話記録からシステム応答の話者を消す', file:'p4_view.js',
    from:"const who = { cust:'客', me:'あなた', sys:'社内システム', note:'メモ' }[line.who];",
    to:"const who = { cust:'客', me:'あなた', sys:'記録', note:'メモ' }[line.who];",
    expected:'§27 通話記録から従来の中身が欠ける: 社内システム',
  },
  {
    name:'通話記録を会話の吹き出しへ戻す', file:'p4_view.js',
    from:"'<section class=\"record-system-block\"><h3>会話の全履歴</h3><div class=\"record-system-transcript\">' + renderRecordTranscript(t) + '</div></section>'",
    to:"'<section class=\"record-system-block\"><h3>会話の全履歴</h3><div class=\"record-system-transcript\">' + renderTranscript(t, true) + '</div></section>'",
    expected:'ログで全履歴を表示しない',
  },
  {
    // 折り返せなかった場合も同じ2行で待ち行列へ戻すので、途中切断側だけを狙う。
    name:'途中切断後の再着信を閉じる', file:'p3_game.js',
    from:"  t.pendingInterruption = false;\n  t.redialCount++;\n  t.state = 'waiting';\n  t.arrivedTurn = state.turn;",
    to:"  t.pendingInterruption = false;\n  t.redialCount++;\n  t.state = 'closed';\n  t.arrivedTurn = state.turn;",
    expected:'途中切断した顧客がすぐ再着信しない',
  },
  {
    name:'第一声の地名案件を3件へ増やす', file:'p3_game.js',
    from:"const DESTINATION_IN_OPENING = new Set(['S9','S11']);", to:"const DESTINATION_IN_OPENING = new Set(['S6','S9','S11']);",
    expected:'第一声で地名を話す案件がS9とS11の2件ではない',
  },
  {
    name:'通常案件の第一声へ渡航先を戻す', file:'p2_data.js',
    from:"opening:'あの…30分前に全部切れて、再起動しても戻りません。", to:"opening:'あの…ニューヨークです。30分前に全部切れて、再起動しても戻りません。",
    expected:'第一声に渡航先・旅行目的・同行者の情報が残っている',
  },
  {
    name:'固定都市リストにないcityを通常案件の第一声へ入れる', file:'p2_data.js',
    from:"country:'タイ', city:'バンコク', cityEn:'BANGKOK', localOffset:-2, carrierName:'AIS', device:'GD-500', plan:'{country} ／ 500MBプラン',\n  opening:'あの…地図が全然開かないんです。",
    to:"country:'タイ', city:'架空都市', cityEn:'BANGKOK', localOffset:-2, carrierName:'AIS', device:'GD-500', plan:'{country} ／ 500MBプラン',\n  opening:'架空都市です。あの…地図が全然開かないんです。",
    expected:'通常案件の第一声に自身のcityが残っている',
  },
  {
    name:'雑談revealを答えのない質問へ付け替える', file:'p2_data.js',
    from:"id:'st_s2_tour', reveal:'q_other_device'", to:"id:'st_s2_tour', reveal:'q_stay_length'",
    expected:'雑談話題のrevealが実際に到達できる質問へ接続されていない',
  },
  {
    name:'高ストレス本人確認のanxious効果を弱める', file:'p2_data.js',
    from:'const IDENTITY_CALMING_EFFECTS = Object.freeze({ anxious:-10, novice:-8, hurried:-4, expert:0 });',
    to:'const IDENTITY_CALMING_EFFECTS = Object.freeze({ anxious:-9, novice:-8, hurried:-4, expert:0 });',
    expected:'高ストレス本人確認のタイプ別効果が確定値と違う',
  },
  {
    name:'本人確認の鎮静境界を50超へずらす', file:'p3_game.js',
    from:'t.stress < 50', to:'t.stress <= 50',
    expected:'q_nameが苛立ち50以上でタイプ別の鎮静値にならない',
  },
  {
    name:'本人確認の鎮静から運を外す', file:'p3_game.js',
    from:'const expectedOutcome = rollLuck();', to:'const expectedOutcome = true;',
    expected:'本人確認の鎮静が裏目でも通常の質問ストレスへ戻らない',
  },
  {
    name:'expertの高ストレス本人確認でも運を先に抽選する', file:'p3_game.js',
    from:'if (delta === 0) return changeStress(t, 0, true);\n  const expectedOutcome = rollLuck();',
    to:'const expectedOutcome = rollLuck();\n  if (delta === 0) return changeStress(t, 0, true);',
    expected:'expertの高ストレス本人確認が無駄に運の抽選を消費する',
  },
  {
    name:'氏名だけで本人特定できるようにする', file:'p3_game.js',
    from:'t.nameKnown && t.destinationKnown', to:'t.nameKnown || t.destinationKnown',
    expected:'渡航先を聞かずに氏名だけで本人特定へ到達する',
  },
  {
    name:'q_nameを本人確認専用ストレスから外す', file:'p3_game.js',
    from:'identityQuestionStress(t, qid, askStressBase(t, 3))', to:'addStress(t, askStressBase(t, 3))',
    expected:'q_nameとq_contractだけが本人確認専用のストレス経路を通っていない',
  },
  {
    name:'廃止したmobilePane状態を戻す', file:'p3_game.js',
    from:'  ui: defaultUi(),', to:"  mobilePane: 'desk',\n  ui: defaultUi(),",
    expected:'廃止したペイン切替状態 mobilePane が残っている',
  },
  {
    name:'1タイプの謝罪反応を欠落させる', file:'p2_data.js',
    from:"expert:Object.freeze({ brief:'承知しました。では、切り分けを続けてください。', accepted:",
    to:"expert:Object.freeze({ brief:'', accepted:",
    expected:'謝罪の受け止め方が4タイプ分揃っていない',
  },
  {
    name:'ランダムな1日件数を1〜4件へずらす', file:'p3_game.js',
    from:'return 2 + Math.floor(random() * 4);',
    to:'return 1 + Math.floor(random() * 4);',
    expected:'ランダムな1日件数が2〜5の境界に収まらない',
  },
  {
    name:'ランダムな1日件数を2件固定にする', file:'p3_game.js',
    from:'return 2 + Math.floor(random() * 4);',
    to:'return 2;',
    expected:'ランダムな1日件数が2〜5の境界に収まらない',
  },
  {
    name:'日次案件を同じ1件の重複にする', file:'p3_game.js',
    from:'const selected = ordered.slice(0, count).map((scenario, index) =>',
    to:'const selected = Array(count).fill(ordered[0]).map((scenario, index) =>',
    expected:'日次案件の選択に重複がある',
  },
  {
    name:'応答率を11件固定で割る', file:'p4_view.js',
    from:'const answerRate = answerAttempts ? answered.length / answerAttempts : 1;',
    to:'const answerRate = answerAttempts ? answered.length / 11 : 1;',
    expected:'レポート集計がその日の実件数で計算されない',
  },
  {
    name:'レポートの対応件数を11件固定へ戻す', file:'p4_view.js',
    from:"対応件数 ' + state.tickets.length + '件",
    to:"対応件数 ' + SCENARIOS.length + '件",
    expected:'2件の日のレポートが件数と空項目を成立させて表示しない',
  },
  {
    name:'GAME_FLAGSの日次件数固定を無視する', file:'p3_game.js',
    from:'if (flags.dailyTickets !== null){',
    to:'if (false){',
    expected:'2件固定で選択数が一致しない',
  },
  {
    name:'顧客の最終発話中にも終話ボタンを出す', file:'p4_view.js',
    from:"    if (pendingTypedLine(t)) return '<div class=\"actions\"><div class=\"pending-note\">お客様の最後の言葉を聞いています。</div></div>';",
    to:"    if (false) return '<div class=\"actions\"><div class=\"pending-note\">お客様の最後の言葉を聞いています。</div></div>';",
    expected:'解決後に顧客発話待ちと経路別終話ボタンだけが残らない',
  },
  {
    name:'一方的切断のボタンを電話を切るへ戻す', file:'p4_view.js',
    from:"return result.kind === 'complaint' || result.kind === 'hangup' ? 'オフィスへ戻る' : '電話を切る';",
    to:"return result.kind === 'complaint' ? 'オフィスへ戻る' : '電話を切る';",
    expected:'5経路の終話ボタン文言が違う',
  },
  {
    name:'怒り終話の締めをnoteへ落とす', file:'p3_game.js',
    from:"{ who:'me', text:CALL_FLOW_LINES.ending[kind] },",
    to:"{ who:'note', text:CALL_FLOW_LINES.ending[kind] },",
    expected:'5経路のいずれかで最後付近にオペレーター発話がない',
  },
  {
    name:'誤診2回目の謝罪と不調報告を逆転する', file:'p3_game.js',
    from:"{ who:'cust', text:CALL_FLOW_LINES.misdiagnosis.failure },\n        { who:'me', text:CALL_FLOW_LINES.misdiagnosis.apology },",
    to:"{ who:'me', text:CALL_FLOW_LINES.misdiagnosis.apology },\n        { who:'cust', text:CALL_FLOW_LINES.misdiagnosis.failure },",
    expected:'誤診2回目が「対処→不調報告→謝罪→最終怒り」の順ではない',
  },
  {
    name:'伝えるからやってみてもらうを外す', file:'p4_view.js',
    from:'      ? { attrs:\'data-tell="try"\', body:\'<span class="opt-label">やってみてもらう<span class="opt-sub">機器や端末で試していただくことを選びます。</span></span>\' }',
    to:'      ? null',
    expected:'「伝える」の項目から data-tell="try" が欠けている',
  },
  {
    name:'危険操作の罰を弱める', file:'p2_data.js',
    from:"note:'初期化で回線設定ごと飛んだ。サポート側の指示なく客に踏ませてよい操作ではない。', damage:1.5",
    to:"note:'初期化で回線設定ごと飛んだ。サポート側の指示なく客に踏ませてよい操作ではない。', damage:1.0",
    expected:'§24 RISKY 3項目の内容・所要時間・罰が変わっている',
  },
  {
    name:'社内照会の完了発話を消す', file:'p3_game.js',
    from:"  pushFlowLines(t, [{ who:'me', text:hold ? CALL_FLOW_LINES.lookup.holdComplete : CALL_FLOW_LINES.lookup.talkComplete }]);",
    to:'  void hold;',
    expected:'社内照会の開始と完了の合図が発話で揃わない',
  },
  {
    name:'会話記録の確認に余計な完了文を足す', file:'p3_game.js',
    from:"  pushFlowLines(t, [{ who:'me', text:CALL_FLOW_LINES.recordStart }]);",
    to:"  pushFlowLines(t, [{ who:'me', text:CALL_FLOW_LINES.recordStart }, { who:'me', text:'お待たせしました。' }]);",
    expected:'会話記録の確認が開始文だけではない',
  },
  {
    name:'途中切断noteを受動態へ戻す', file:'p3_game.js',
    from:'オペレーターが対応途中で切断しました。',
    to:'対応途中で通話が終了しました。',
    expected:'途中切断の発話・能動態note・専用再入電挨拶が揃わない',
  },
  {
    name:'通常解決の締めを顧客の別れ後へ移す', file:'p3_game.js',
    from:"  pushFlowLines(t, [{ who:'me', text:resolutionOperatorClosing(grade, causeMatched) }]);\n  pushCustomerLine(t, farewellLine(s, grade), { plain:true });",
    to:"  pushCustomerLine(t, farewellLine(s, grade), { plain:true });\n  pushFlowLines(t, [{ who:'me', text:resolutionOperatorClosing(grade, causeMatched) }]);",
    expected:'通常解決が「客の解決確認→オペレーターの締め→客の別れ」の順ではない',
  },
  {
    name:'追加発話をtyping_budget超過へ伸ばす', file:'p2_data.js',
    from:"recordStart:'少し記録を確認させてください。'",
    to:"recordStart:'少し記録を確認させてください。長い説明をここで何度も繰り返します。長い説明をここで何度も繰り返します。長い説明をここで何度も繰り返します。長い説明をここで何度も繰り返します。長い説明をここで何度も繰り返します。長い説明をここで何度も繰り返します。長い説明をここで何度も繰り返します。長い説明をここで何度も繰り返します。'",
    expected:'§21で追加した発話がtyping_budgetの4秒上限を超えている',
  },
  {
    name:'追加発話の2行上限を3行へ緩める', file:'p3_game.js',
    from:'if (lines.length > 2) throw',
    to:'if (lines.length > 3) throw',
    expected:'1操作の追加発話を2行以内に制限できない',
  },
  {
    name:'保存領域例外で初期記録を返さない', file:'p4_view.js',
    from:'} catch (error){ return freshCareerRecord(); }\n}\n\nfunction writeCareerRecord',
    to:'} catch (error){ return null; }\n}\n\nfunction writeCareerRecord',
    expected:'localStorage読取例外でゲームを継続できない',
  },
  {
    name:'異版キャリア記録を受け入れる', file:'p3_game.js',
    from:'value.version !== CAREER_VERSION || !Array.isArray(value.shifts)',
    to:'false || !Array.isArray(value.shifts)',
    expected:'不正な保存記録を新規扱いにできない',
  },
  {
    name:'初回表示を2日目にする', file:'p4_view.js',
    from:"(career.totals.days + 1) + '日目", to:"(career.totals.days + 2) + '日目",
    expected:'ブリーフィングに日数と保存範囲がない',
  },
  {
    name:'シフト履歴を31件残す', file:'p3_game.js',
    from:'career.shifts.length > 30', to:'career.shifts.length > 31',
    expected:'保存シフトが直近30件に丸められない',
  },
  {
    name:'通算日数の加算を止める', file:'p3_game.js',
    from:'career.totals.days = previousDays + 1;', to:'career.totals.days = previousDays;',
    expected:'30件丸め込みで通算日数まで失われる',
  },
  {
    name:'試用期間の昇格条件をB以上へ狭める', file:'p3_game.js',
    from:"recent3.every(shift => gradeAtLeast(shift.grade, 'C'))", to:"recent3.every(shift => gradeAtLeast(shift.grade, 'B'))",
    expected:'試用期間の3日境界で本採用にならない',
  },
  {
    name:'本採用からリーダーへ昇格させない', file:'p3_game.js',
    from:"recent3.every(shift => gradeAtLeast(shift.grade, 'B'))) return 'lead';", to:"recent3.every(shift => gradeAtLeast(shift.grade, 'B'))) return 'employed';",
    expected:'直近3回B以上でリーダーにならない',
  },
  {
    name:'静かな夜を70未満だけにする', file:'p3_game.js',
    from:'context.maxStresses.every(value => value <= 70)', to:'context.maxStresses.every(value => value < 70)',
    expected:'8バッジの条件判定が揃わない',
  },
  {
    name:'卒業バッジを追加する', file:'p2_data.js',
    from:"const CAREER_BADGES = Object.freeze([", to:"const CAREER_BADGES = Object.freeze([\n  Object.freeze({ id:'graduate', label:'卒業', condition:'卒業する' }),",
    expected:'卒業バッジまたは卒業段階がある',
  },
  {
    name:'直近成績を4回だけにする', file:'p4_view.js',
    from:'career.shifts.slice(-5)', to:'career.shifts.slice(-4)',
    expected:'勤務記録UIに必要項目がない: slice(-5)',
  },
  {
    name:'未取得バッジから条件文を消す', file:'p4_view.js',
    from:"'<span>' + esc(badge.condition) + '</span></div>'", to:"'<span>条件は非表示</span></div>'",
    expected:'未取得バッジの条件が表示されない',
  },
  {
    name:'終了レポートからキャリア欄を外す', file:'p4_view.js',
    from:'    careerDebriefHtml() +\n    \'<h1>シフト終了</h1>\' +', to:'    \'<h1>シフト終了</h1>\' +',
    expected:'昇格バナーが終了レポート上部にない',
  },
  {
    name:'キャリア表示を音設定へ依存させる', file:'p4_view.js',
    from:'function careerDebriefHtml(){\n  const career', to:'function careerDebriefHtml(){\n  if (!GAME_FLAGS.soundEnabled) return \'\';\n  const career',
    expected:'ミュート時にキャリア表示まで消える',
  },
  {
    name:'GAME_FLAGSの強制段階を無視する', file:'p3_game.js',
    from:'next.stage = flags.careerStage;', to:'void flags.careerStage;',
    expected:'GAME_FLAGSで段階を固定できない',
  },
  {
    name:'勤務記録消去の確認を外す', file:'p4_view.js',
    from:"if (!window.confirm('勤務記録を消去して、1日目から始めますか？')) return false;", to:'if (false) return false;',
    expected:'勤務記録消去の確認回数が1回ではない',
  },
  {
    name:'全案件でも表エンディングを開始しない', file:'p3_game.js',
    from:'career.solvedScenarios.length === SCENARIOS.length', to:'career.solvedScenarios.length > SCENARIOS.length',
    expected:'§28 全案件を解決しても表エンディングへ進まない',
  },
  {
    name:'1件不足で表エンディングを開始する', file:'p3_game.js',
    from:'career.solvedScenarios.length === SCENARIOS.length', to:'career.solvedScenarios.length >= SCENARIOS.length - 1',
    expected:'§28 1件不足で表エンディングへ進む',
  },
  {
    name:'失客と不満返金も解決へ数える', file:'p3_game.js',
    from:"return result && result.kind === 'closed';",
    to:"return result && (result.kind === 'closed' || result.kind === 'refunded');",
    expected:'§53 返金を解決に数える、または同じ案件を重複して数える',
  },
  {
    name:'同じ案件をシフト内で重複して数える', file:'p3_game.js',
    from:'return [...new Set(tickets.filter(ticket => {', to:'return [...Array.from(tickets.filter(ticket => {',
    expected:'§53 返金を解決に数える、または同じ案件を重複して数える',
  },
  {
    name:'保存済みの同じ案件を重複して数える', file:'p3_game.js',
    from:'career.solvedScenarios = [...new Set(career.solvedScenarios.concat(context.solvedScenarioIds || []))];',
    to:'career.solvedScenarios = career.solvedScenarios.concat(context.solvedScenarioIds || []);',
    expected:'§28 保存済みの同じ案件を重複して数える',
  },
  {
    name:'30件丸め込みで解決済み案件を消す', file:'p3_game.js',
    from:'if (career.shifts.length > 30) career.shifts = career.shifts.slice(-30);',
    to:'if (career.shifts.length > 30){ career.shifts = career.shifts.slice(-30); career.solvedScenarios = []; }',
    expected:'§28 solvedScenariosが30日制限で捨てられる',
  },
  {
    name:'同時達成時に裏から表の順で出す', file:'p3_game.js',
    from:"  if (career.solvedScenarios.length === SCENARIOS.length && !career.ending) queue.push('career');\n  if (career.badges.length === CAREER_BADGES.length && !career.secretEnding) queue.push('secret');",
    to:"  if (career.badges.length === CAREER_BADGES.length && !career.secretEnding) queue.push('secret');\n  if (career.solvedScenarios.length === SCENARIOS.length && !career.ending) queue.push('career');",
    expected:'§28 同じ夜に両条件を満たしても表→裏の順にならない',
  },
  {
    name:'閲覧済みの裏エンディングを再発火する', file:'p3_game.js',
    from:'career.badges.length === CAREER_BADGES.length && !career.secretEnding',
    to:'career.badges.length === CAREER_BADGES.length && true',
    expected:'§28 見た表・裏エンディングが次の夜にも自動再生される',
  },
  {
    name:'旧v1勤務記録を移行しない', file:'p3_game.js',
    from:'if (next.version === CAREER_VERSION && next.solvedScenarios === undefined) next.solvedScenarios = [];',
    to:'if (false) next.solvedScenarios = [];',
    expected:'§28 旧v1勤務記録の通算日数を移行できない',
  },
  {
    name:'8バッジでも裏エンディングを開始しない', file:'p3_game.js',
    from:'career.badges.length === CAREER_BADGES.length', to:'career.badges.length > CAREER_BADGES.length',
    expected:'§28 8バッジで裏エンディングへ進まない',
  },
  {
    name:'裏エンディングで表の演出を再利用しない', file:'p4_view.js',
    from:"  showCareerEnding(replay, 'secret');", to:'  void replay;',
    expected:'§28 裏エンディングが表と同じ演出を再生しない',
  },
  {
    name:'同じ朝礼演出から裏の小さな印を外す', file:'p4_view.js',
    from:"state.endingType === 'secret'", to:'false',
    expected:'§28 同じ朝礼演出の裏エンディングに小さな印がない',
  },
  {
    name:'裏エンディング閲覧済みを保存しない', file:'p4_view.js',
    from:"if (endingType === 'secret') state.career.secretEnding = true;", to:"if (endingType === 'secret') state.career.secretEnding = false;",
    expected:'§28 裏エンディング閲覧済みを保存しない',
  },
  {
    name:'表の後に裏エンディングへ続けない', file:'p4_view.js',
    from:"function continueAfterCareerEnding(){\n  const next = pendingCareerEndingType();\n  if (next === 'career'){ showCareerEnding(false); return; }\n  if (next === 'secret'){ showSecretEnding(false); return; }", to:"function continueAfterCareerEnding(){\n  const next = pendingCareerEndingType();\n  if (next === 'career'){ showCareerEnding(false); return; }\n  if (next === 'secret'){ resetGame(); showBriefing(); return; }",
    expected:'§28 表の後に裏エンディングへ続かない',
  },
  {
    name:'終了レポートへ案件名を漏らす', file:'p4_view.js',
    from:"'<div class=\"career-ending-progress\"><b>表エンディング</b><span>解決した案件 '",
    to:"'<p>' + SCENARIOS.map(scenario => scenario.name).join('・') + '</p><div class=\"career-ending-progress\"><b>表エンディング</b><span>解決した案件 '",
    expected:'§28 レポートが解決数を出さない、または未解決案件名を漏らす',
  },
  {
    name:'GAME_FLAGSの強制解決済み案件を無視する', file:'p3_game.js',
    from:'next.solvedScenarios = [...new Set(flags.solvedScenarios.filter(id => known.has(id)))];', to:'next.solvedScenarios = [];',
    expected:'§28 GAME_FLAGSから表・裏エンディングを再現できない',
  },
  {
    name:'毎夜のブリーフィングへ舞台説明を戻す', file:'p4_view.js',
    from:"      careerBriefingHtml() +\n      '<div class=\"artifact-qr-card\"",
    to:"      careerBriefingHtml() +\n      '<p class=\"lead\">海外用モバイルWiFiレンタルのテクニカルサポート</p>' +\n      '<div class=\"artifact-qr-card\"",
    expected:'§29 ブリーフィングに毎夜不要な説明が残っている',
  },
  {
    name:'ブリーフィング状態行から引き継ぎ件数を消す', file:'p4_view.js',
    from:"+ '件 ／ 引き継ぎ ' + handoverCount + '件</b>'", to:"+ '件</b>'",
    expected:'当日の入電・引き継ぎ実件数がブリーフィングとレポートに表示されない',
  },
  {
    name:'ブリーフィングの開始ボタンIDを外す', file:'p4_view.js',
    from:'id="btn-start">シフトを始める</button>', to:'id="btn-begin">シフトを始める</button>',
    expected:'§29 ブリーフィングにシフト開始ボタンがない',
  },
  {
    name:'保存注記を2日目以降にも表示する', file:'p4_view.js',
    from:'career.totals.days === 0', to:'career.totals.days >= 0',
    expected:'§29 保存注記が2日目以降にも出る',
  },
  {
    name:'対応マニュアルのCSAT配点を変える', file:'p4_view.js',
    from:'顧客満足（CSAT）35%', to:'顧客満足（CSAT）34%',
    expected:'§29 評価の配点5項目が対応マニュアルにない',
  },
  {
    name:'対応マニュアルの現地キャリア30分を消す', file:'p4_view.js',
    from:'現地キャリアへの照会だけは30分かかります。', to:'現地キャリアへの照会は時間がかかります。',
    expected:'§29 やること6項目が対応マニュアルに揃っていない',
  },
  {
    name:'スマホ幅でもブリーフィングQRを表示する', file:'p1_head.html',
    from:'.artifact-qr-card{ display:none; }', to:'.artifact-qr-card{ display:grid; }',
    expected:'スマホ幅で公開ページQRが隠れない',
  },
  {
    name:'報告提出直後にエンディングを開始する', file:'p4_view.js',
    from:'  recordCurrentCareerShift();\n  state.phase = \'debrief\';', to:'  recordCurrentCareerShift();\n  showCareerEnding(false);\n  state.phase = \'debrief\';',
    expected:'§28 エンディングが終了レポートを閉じる前に始まる',
  },
  {
    name:'エンディング閲覧済みを保存しない', file:'p4_view.js',
    from:'else state.career.ending = true;', to:'else state.career.ending = false;',
    expected:'エンディング閲覧済みを保存しない',
  },
  {
    name:'ゲーム調整からエンディング再生を外す', file:'p4_view.js',
    from:"$('balance-replay-ending').onclick = event => { event.stopImmediatePropagation(); showCareerEnding(true); };", to:"$('balance-replay-ending').onclick = () => {};",
    expected:'§28 ゲーム調整から表・裏エンディングを見返せない',
  },
  {
    name:'朝のオフィスを夜パレットで描く', file:'p4_view.js',
    from:"drawOfficePixelArt(false, 'ending-office-canvas', MORNING_OFFICE_PALETTE);", to:"drawOfficePixelArt(false, 'ending-office-canvas', OFFICE_PALETTE);",
    expected:'朝のオフィスが夜景のパレット差し替えになっていない',
  },
  {
    name:'社長の表示を役職以外へ変える', file:'p4_view.js',
    from:"'<section class=\"ending-speech\"><b>社長</b><p>' + esc(PRESIDENT_ENDING_LINE) + '</p></section>' +", to:"'<section class=\"ending-speech\"><b>代表取締役</b><p>' + esc(PRESIDENT_ENDING_LINE) + '</p></section>' +",
    expected:'社長表示または匿名化契約が崩れている',
  },
  {
    name:'社長の確定文を一字変える', file:'p2_data.js',
    from:'ハードワークご苦労様です。', to:'ハードワーク、お疲れ様です。',
    expected:'社長の確定文が完全一致しない',
  },
  {
    name:'エンディングから苦情通算を消す', file:'p4_view.js',
    from:'career.totals.complaints', to:'0',
    expected:'エンディングに通算成績と8バッジが揃わない',
  },
  {
    name:'ミュート時にエンディング画面を止める', file:'p4_view.js',
    from:"function showCareerEnding(replay = false, endingType = 'career'){\n  stopOfficeRing();", to:"function showCareerEnding(replay = false, endingType = 'career'){\n  if (!GAME_FLAGS.soundEnabled) return;\n  stopOfficeRing();",
    expected:'ミュート時にエンディング画面が成立しない',
  },
  {
    name:'GAME_FLAGSの強制バッジを無視する', file:'p3_game.js',
    from:'next.badges = [...new Set(flags.unlockedBadges.filter(id => known.has(id)))];', to:'next.badges = flags.unlockedBadges.length === 8 ? [] : [...new Set(flags.unlockedBadges.filter(id => known.has(id)))];',
    expected:'§28 GAME_FLAGSから表・裏エンディングを再現できない',
  },
  {
    name:'社長の確定文を最初から全文表示する', file:'p4_view.js',
    from:'<span class="say"></span>', to:'<span class="say">\' + esc(PRESIDENT_ENDING_LINE) + \'</span>',
    expected:'社長の台詞が1文字ずつではなく一度に全文表示される',
  },
  {
    name:'社長の台詞でstartTypingを通らない', file:'p4_view.js',
    from:'  setTimeout(() => startTyping(state.endingSpeech), 0);', to:'  renderCareerEndingComplete();',
    expected:'社長の台詞が顧客と同じstartTyping速度を通らない',
  },
  {
    name:'再生ボタンのクリック中に社長のタイプ表示を始める', file:'p4_view.js',
    from:"$('balance-replay-ending').onclick = event => { event.stopImmediatePropagation(); showCareerEnding(true); };", to:"$('balance-replay-ending').onclick = () => showCareerEnding(true);",
    expected:'社長の再生操作自体がタップ送りに誤認される',
  },
  {
    name:'社長の台詞完了前に通算成績を表示する', file:'p4_view.js',
    from:'      \'<p class="ending-line line typing"><span class="say"></span></p></section>\';',
    to:'      \'<p class="ending-line line typing"><span class="say"></span></p></section>\' + careerEndingDetailsHtml(state.career);',
    expected:'社長の台詞完了前に後続要素が現れる: ending-totals',
  },
  {
    name:'社長の台詞のタップ送りを外す', file:'p5_events.js',
    from:'if (typingLine){ finishTyping(); return; }', to:'if (false){ finishTyping(); return; }',
    expected:'社長の台詞をタップで送り切れない',
  },
  {
    name:'社長の頭頂部を髪で塗る', file:'p4_view.js',
    from:'pixelRect(ctx, p.paper, x + 1, y - 24, 9, 5);', to:'pixelRect(ctx, p.charcoal, x + 1, y - 24, 9, 5);',
    expected:'社長の頭頂部地肌と両サイドの髪が描き分けられていない',
  },
  {
    name:'エンディングのENDを別の文字へ変える', file:'p4_view.js',
    from:'id="ending-end">END</div>', to:'id="ending-end">FIN</div>',
    expected:'ENDが称号一覧の下・戻るボタンの上に簡潔に表示されない',
  },
  {
    name:'ENDを称号と同時に表示する', file:'p4_view.js',
    from:'setTimeout(revealCareerEndingFinal, 1000)', to:'setTimeout(revealCareerEndingFinal, 0)',
    expected:'ENDが通算成績と称号一覧より約1秒遅れて現れない',
  },
  {
    name:'戻るボタンをENDより先に置く', file:'p4_view.js',
    from:'return \'<div class="ending-end" id="ending-end">END</div>\' +\n    \'<button class="btn-primary" id="ending-back-to-shift">深夜シフトへ戻る</button>\';',
    to:'return \'<button class="btn-primary" id="ending-back-to-shift">深夜シフトへ戻る</button>\' +\n    \'<div class="ending-end" id="ending-end">END</div>\';',
    expected:'ENDが称号一覧の下・戻るボタンの上に簡潔に表示されない',
  },
  {
    name:'タップ送りでもENDを1秒待たせる', file:'p4_view.js',
    from:'function finishTyping(skipEndingBeat = true){', to:'function finishTyping(skipEndingBeat = false){',
    expected:'タップ送りでENDと戻るボタンまで一度に表示されない',
  },
  {
    name:'朝礼の社員を3人だけに戻す', file:'p4_view.js',
    from:'MORNING_STAFF.forEach(staff => drawMorningStaffMember(ctx, p, staff));', to:'MORNING_STAFF.slice(0, 3).forEach(staff => drawMorningStaffMember(ctx, p, staff));',
    expected:'エンディングの朝礼に立った社員が10人描かれない',
  },
  {
    name:'後ろ姿の社員に顔を描く', file:'p4_view.js',
    from:'pixelRect(ctx, p.paper, x - 3, y - 17, 7, 8);', to:'pixelRect(ctx, p.paper, x - 3, y - 17, 7, 8);\n  pixelRect(ctx, p.black, x - 1, y - 13, 3, 1); // face',
    expected:'社員が社長を見る後ろ姿になっていない',
  },
  {
    name:'社員の髪色差を無視する', file:'p4_view.js',
    from:'const hair = p[staff.hairColor];', to:'const hair = p.black;',
    expected:'社員の髪型・髪色・服色・肩幅が描き分けられていない',
  },
  {
    name:'プレイヤーだけ服色を変える', file:'p4_view.js',
    from:'const coat = p[staff.coat];', to:'const coat = staff.player ? p.red : p[staff.coat];',
    expected:'プレイヤーだけを示す強調表示がある',
  },
  {
    name:'S13の真因をlogistics以外へ変える', file:'p2_data.js',
    from:"trueCause:'logistics', best:'r_logistics_replacement'", to:"trueCause:'hardware', best:'r_logistics_replacement'",
    expected:'§30 検査1: 13件目がlogistics案件ではない',
  },
  {
    name:'S13をS9と同じ未受取へ変える', file:'p2_data.js',
    from:'受け取ってから一度もつながらず、ずっと圏外なんです。', to:'まだ受け取れていません。',
    expected:'§30 検査2: S9の未受取とS13の受取済み初回不通を区別できない',
  },
  {
    name:'S13の貸出SIMを申込国向けへ変える', file:'p2_data.js',
    from:'貸出品: {wrongCountry}向けSIM', to:'貸出品: {country}向けSIM',
    expected:'§30 検査3: l_shipに申込国と利用不可SIMの食い違いがない',
  },
  {
    name:'S13の正常契約を失効へ変える', file:'p2_data.js',
    from:'[契約照会] 申込: {country} ／ 契約: 有効 ／ 使用量: 制限内 ／ 速度制限なし',
    to:'[契約照会] 申込: {country} ／ 契約: 失効 ／ 使用量: 制限内 ／ 速度制限なし',
    expected:'§30 検査4: l_planが有効・制限内の正常契約ではない',
  },
  {
    name:'S13最適対処から謝罪を外す', file:'p2_data.js',
    from:"{ id:'r_logistics_replacement', label:'手配の誤りをお詫びし、滞在期間と滞在先を確認したうえで代替機を発送する'",
    to:"{ id:'r_logistics_replacement', label:'滞在期間と滞在先を確認したうえで代替機を発送する'",
    expected:'§30 検査5: 最適対処が謝罪と代替機発送を明記しない',
  },
  {
    name:'S13次善対処から謝罪を外す', file:'p2_data.js',
    from:"{ id:'r_logistics_refund', label:'手配の誤りをお詫びし、返金する'", to:"{ id:'r_logistics_refund', label:'返金する'",
    expected:'§30 検査6: 次善対処が謝罪と返金を明記しない',
  },
  {
    name:'S13代替機発送から滞在期間質問を外す', file:'p2_data.js',
    from:"{ id:'r_logistics_replacement', label:'手配の誤りをお詫びし、滞在期間と滞在先を確認したうえで代替機を発送する', sub:'自社の手配ミスを正直に伝え、残りの滞在で使える機器を届ける', kind:'transfer', cost:28000,\n      requiresQuestions:['q_stay','q_stay_length','q_replacement']",
    to:"{ id:'r_logistics_replacement', label:'手配の誤りをお詫びし、滞在期間と滞在先を確認したうえで代替機を発送する', sub:'自社の手配ミスを正直に伝え、残りの滞在で使える機器を届ける', kind:'transfer', cost:28000,\n      requiresQuestions:['q_stay','q_replacement']",
    expected:'§30 検査7: remedyBlockReasonが滞在期間・滞在先不足を止めない',
  },
  {
    name:'S13代替機発送の長期滞在条件を無効化する', file:'p2_data.js',
    from:"requiresQuestions:['q_stay','q_stay_length','q_replacement'], requiresLongStay:3, requiresConsent:true },\n    { id:'r_logistics_refund'",
    to:"requiresQuestions:['q_stay','q_stay_length','q_replacement'], requiresLongStay:0, requiresConsent:true },\n    { id:'r_logistics_refund'",
    expected:'§30 検査8: 代替機発送が既存の長期滞在・同意条件を使わない',
  },
  {
    name:'S13次善対処へ隠蔽を混ぜる', file:'p2_data.js',
    from:"{ id:'r_logistics_refund', label:'手配の誤りをお詫びし、返金する'", to:"{ id:'r_logistics_refund', label:'手配の誤りをお詫びし、隠して返金する'",
    expected:'§30 検査9: 非を認めず切り抜けるS13対処がある',
  },
  {
    name:'S13の顧客タイプをexpertへ変える', file:'p2_data.js',
    from:"id:'S13', arrive:74, name:'秋山 美咲', nameEn:'Misaki Akiyama', age:32, ageRange:[25,42], type:'anxious'", to:"id:'S13', arrive:74, name:'秋山 美咲', nameEn:'Misaki Akiyama', age:32, ageRange:[25,42], type:'expert'",
    expected:'§30 検査10: anxiousの自己責任型第一声になっていない',
  },
  {
    name:'解決数レポートの総数を12固定へ戻す', file:'p4_view.js',
    from:"' / ' + SCENARIOS.length", to:"' / 12'",
    expected:'§28 レポートが解決数を出さない、または未解決案件名を漏らす',
  },
  {
    name:'S13から代替機希望の返答を外す', file:'p2_data.js',
    from:"    q_replacement:{ text:'はい、使えるものが届くなら代替機を送ってください。ホテルで受け取ります。',\n      fact:{ text:'本人が同じホテルへの代替機配送を希望している', hot:['logistics'] } },\n",
    to:'',
    expected:'§30 検査12: progression_test用の正解ルート前提が揃っていない',
  },
  {
    name:'返金提案の拒否分岐を無効化する', file:'p3_game.js',
    from:'if (refundProposalRejected(t.s.trueCause)){', to:'if (false && refundProposalRejected(t.s.trueCause)){',
    expected:'§31 検査1: 返金が満足受入／不満受入／拒否の3通りにならない',
  },
  {
    name:'返金拒否で案件をクローズ待ちにする', file:'p3_game.js',
    from:'t.refundProposalRejected = true;', to:"t.refundProposalRejected = true;\n    t.pendingResult = {kind:'refunded',satisfied:false,csat:1.0};",
    expected:'§31 検査1: 返金が満足受入／不満受入／拒否の3通りにならない',
  },
  {
    name:'返金拒否でも費用を加算する', file:'p3_game.js',
    from:'t.refundProposalRejected = true;', to:'t.refundProposalRejected = true;\n    state.cost += REFUND_POLICY.amount;',
    expected:'§31 検査3: 拒否された返金提案で費用が加算される',
  },
  {
    name:'返金拒否の所要時間を1分へ短縮する', file:'p3_game.js',
    from:"pushCustomerLine(t, TYPES[t.s.type].refundRejectReply, { plain:true });\n    if (!spendOnCall(t, 2, 0)){ render(); return; }",
    to:"pushCustomerLine(t, TYPES[t.s.type].refundRejectReply, { plain:true });\n    if (!spendOnCall(t, 1, 0)){ render(); return; }",
    expected:'§31 検査4: 返金拒否で2分と苛立ち増を消費しない',
  },
  {
    name:'返金拒否率の境界を以下へ緩める', file:'p3_game.js',
    from:'return state.random() < REFUND_POLICY[group].rejectionRate;', to:'return state.random() <= REFUND_POLICY[group].rejectionRate;',
    expected:'§31 検査5: 返金拒否率が会社5%／中立10%／顧客20%ではない',
  },
  {
    name:'会社側の返金満足率を60%へ戻す', file:'p2_data.js',
    from:'rejectionRate:0.05, satisfactionRate:0.5', to:'rejectionRate:0.05, satisfactionRate:0.6',
    expected:'会社側の返金拒否率5%／満足率50%が違う',
  },
  {
    name:'luckRate 1でも返金拒否を起こす', file:'p3_game.js',
    from:'if (GAME_FLAGS.luckRate === 1) return false;\n  return state.random() < REFUND_POLICY[group].rejectionRate;',
    to:'if (GAME_FLAGS.luckRate === 1) return true;\n  return state.random() < REFUND_POLICY[group].rejectionRate;',
    expected:'§31 検査7: luckRate 1.0でも返金拒否が起きる',
  },
  {
    name:'返金拒否後も案内ボタンを表示する', file:'p4_view.js',
    from:'    t.refundProposalRejected\n      ? null\n      : { attrs:\'data-refund="refund"\'', to:'    false\n      ? null\n      : { attrs:\'data-refund="refund"\'',
    expected:'§31 検査8: 拒否後に返金を再提案できる',
  },
  {
    name:'返金確認を確定表現へ戻す', file:'p4_view.js',
    from:'の返金をご提案します。受け入れていただければ、この電話は終わります。よろしいですか？',
    to:'を返金します。この電話はこれで終わります。よろしいですか？',
    expected:'§31 検査9: 返金確認が提案と条件つき終話を伝えない',
  },
  {
    name:'不満足な返金を苦情メール対象から外す（§31）', file:'p3_game.js',
    from:"return (result.kind === 'closed' || result.kind === 'refunded') && result.csat < 2 ? rollLuck() : false;",
    to:"return result.kind === 'closed' && result.csat < 2 ? rollLuck() : false;",
    expected:'不満足な返金が後日の苦情メール対象に入らない',
  },
  {
    name:'返金拒否へ評価用CSAT変数を持ち込む', file:'p3_game.js',
    from:'t.refundProposalRejected = true;', to:'t.refundProposalRejected = true;\n    const rejectionPenalty = {csat:1.0};',
    expected:'§31 検査11: 返金拒否そのものが評価結果を確定する',
  },
  {
    name:'返金拒否のexpert台詞をhurriedと同じにする', file:'p2_data.js',
    from:"refundRejectReply:'返金提案は受けません。利用可能な状態への復旧を優先し、切り分けを続けてください。'",
    to:"refundRejectReply:'返金は要らない。今つながる方法を出して。対応を続けてください。'",
    expected:'§31 検査12: 返金を拒否する台詞が4タイプ分書き分けられていない',
  },
  {
    name:'S13の客へSIM表示の鑑別を戻す', file:'p2_data.js',
    from:'画面には「圏外」と出ています。アンテナの棒が、ずっと0本のままで…。',
    to:'画面には「圏外」と出ています。SIMがないという表示ではなく、アンテナだけ0本です。',
    expected:'§32 検査1: S13 q_lampが客自身にSIM表示の鑑別をさせている',
  },
  {
    name:'S10の客へSIM清掃1回目を自己申告させる', file:'p2_data.js',
    from:'乾いた布で拭いて、挿し直してみました。まだ「No SIM」です…。もう一度やってみましょうか？',
    to:'1回目、乾いた布で拭いて挿しました。まだ「No SIM」です…。次もやって大丈夫ですか？',
    expected:'§32 検査2: SIM清掃の初回が回数を自己申告する、または従来の再試行表現がない',
  },
  {
    name:'non-expertの客へ網側障害の否定を言わせる', file:'p2_data.js',
    from:'あの…受け取ってから一度もつながらず、ずっと圏外なんです。私が最初の設定を何か間違えたのでしょうか。',
    to:'あの…受け取ってから一度もつながらず、ずっと圏外なんです。網側の障害ではなく、私が間違えたのでしょうか。',
    expected:'§32 検査3: non-expertの客が知らない技術的区別を否定形で述べている',
  },
  {
    name:'non-expertの客へ操作回数を自己申告させる', file:'p2_data.js',
    from:'一度拭いて挿しました。まだ「No SIM」です…。もう一度で、本当にいいんですね？',
    to:'1回目、拭いて挿しました。まだ「No SIM」です…。もう一度で、本当にいいんですね？',
    expected:'§32 検査4: non-expertの客が自分の操作へ番号を振っている',
  },
  {
    name:'expertの全断否定を平文化する', file:'p2_data.js',
    from:'全断ではありません。現地系サイトは正常です。', to:'一部だけつながりません。現地系サイトは正常です。',
    expected:'§32 検査5: expertの自然な否定形切り分けが失われている',
  },
  {
    name:'S13の台詞改稿に紛れてfactを変える', file:'p2_data.js',
    from:'SIMは認識しているが、到着時から現地回線を一度も捕捉していない',
    to:'到着時から現地回線を一度も捕捉していない',
    expected:'§32 検査6: 客の台詞改稿でfact.textが変わっている',
  },
  {
    name:'S13の台詞改稿に紛れてsim除外を消す', file:'p2_data.js',
    from:"out:['sim','device_side','device_net']", to:"out:['device_side','device_net']",
    expected:'§32 検査7: 客の台詞改稿でhot/outの関係が変わっている',
  },
  {
    name:'S13のl_shipからprovision除外を消して収束を壊す', file:'p2_data.js',
    from:"fact:{ text:'申込国と異なる利用不可SIMを貸し出した自社の手配ミス', hot:['logistics'], out:['fup','devices','geo_block','heavy','device_side','device_net','location','power','carrier','coverage','sim','hardware','provision'] }",
    to:"fact:{ text:'申込国と異なる利用不可SIMを貸し出した自社の手配ミス', hot:['logistics'], out:[] }",
    expected:'§32 検査8: verifyが13案件を真因1つへ収束させない',
  },
  {
    name:'S10から配送先回答を消して進行を止める', file:'p2_data.js',
    from:"    q_stay:{ text:'{hotel}、704号室です。ここで待っていれば届きますか？' },\n",
    to:'',
    expected:'§32 検査9: progression_testが通らない',
  },
  {
    name:'返金拒否台詞をtyping_budget超過へ伸ばす', file:'p2_data.js',
    from:"refundRejectReply:'返金だけでは、この先も使えないままですよね…。お金ではなく、つながるようになるまで助けてください。'",
    to:"refundRejectReply:'返金だけでは、この先も使えないままですよね…。お金ではなく、つながるようになるまで助けてください。状況が分からないまま終わるのは本当に困りますし、この先の予定にも必要なので、どうか最後まで確認を続けてください。'",
    expected:'§31 検査12: 返金を拒否する台詞が4タイプ分書き分けられていない',
  },
  {
    name:'未絞り込み終話から聞く・調べるの次手を消す', file:'p4_view.js',
    from:'「聞く」「調べる」で手がかりを集める', to:'対応を続ける',
    expected:'§33 検査1: 原因未絞り込みの終話確認が次の質問・照会を案内しない',
  },
  {
    name:'絞り込み後終話から対処を伝える次手を消す', file:'p4_view.js',
    from:'まだ対処をお伝えしていません。「伝える」→「原因と対処を伝える」で原因と対処を案内すると、この電話を終われます。',
    to:'まだ対処をお伝えしていません。対応を続けてください。',
    expected:'§33 検査2: 原因絞り込み後の終話確認が対処案内を次手にしない',
  },
  {
    name:'未解決切断の再入電説明を消す', file:'p4_view.js',
    from:'このまま切ると、お客様から再入電になります。', to:'このまま電話を切ります。',
    expected:'§33 検査3: 未解決切断で再入電になる説明が欠けている',
  },
  {
    name:'終話ガイドの分岐を真因非依存と検証できない形へ変える', file:'p4_view.js',
    from:'const causeNarrowed = hotCauses(t).size === 1;', to:'const causeNarrowed = 1 === hotCauses(t).size;',
    expected:'§56 内部の原因絞り込み状態が失われている',
  },
  {
    name:'前提不足の理由専用クラスを外す', file:'p4_view.js',
    from:"' remedy-block-reason'", to:"' ordinary-block-reason'",
    expected:'§33 検査5: 前提不足の対処と理由が通常説明とは違う見た目にならない',
  },
  {
    name:'前提不足の従来理由文を書き換える', file:'p3_game.js',
    from:'先に「伝える」→「やってみてもらう」を ', to:'先に操作を ',
    expected:'§33 検査6: 前提不足の理由文そのものが変わっている',
  },
  {
    name:'苛立ちの運ガードを同値だが契約外の形へ変える', file:'p3_game.js',
    from:'if (!expectedOutcome) delta = 0;', to:'if (expectedOutcome !== true) delta = 0;',
    expected:'裏目の苛立ち増減が0にならない',
  },
  {
    name:'S7最適対処から滞在期間確認を消す', file:'p2_data.js',
    from:"{ id:'r_coverage_replacement', label:'手配の誤りをお詫びし、滞在期間と滞在先を確認したうえで代替機を発送する'", to:"{ id:'r_coverage_replacement', label:'手配の誤りをお詫びし、滞在先へ代替機を発送する'",
    expected:'§34 検査1: S7最適対処が謝罪・滞在確認・代替機発送ではない',
  },
  {
    name:'S7次善対処から返金を消す', file:'p2_data.js',
    from:"{ id:'r_coverage_refund', label:'手配の誤りをお詫びし、返金する'", to:"{ id:'r_coverage_refund', label:'手配の誤りをお詫びする'",
    expected:'§34 検査2: S7次善対処が謝罪・返金ではない',
  },
  {
    name:'S7両対処の会社非明示を弱める', file:'p2_data.js',
    from:"{ id:'r_coverage_refund', label:'手配の誤りをお詫びし、返金する'", to:"{ id:'r_coverage_refund', label:'ご不便をお詫びし、返金する'",
    expected:'§34 検査2: S7次善対処が謝罪・返金ではない',
  },
  {
    name:'廃止したr_city_onlyを別選択肢として戻す', file:'p2_data.js',
    from:"{ id:'r_swap_same'", to:"{ id:'r_city_only'",
    expected:'§34 検査4: r_escalate_band または r_city_only が残っている',
  },
  {
    name:'S7配送の長期滞在前提を外す', file:'p2_data.js',
    from:"requiresQuestions:['q_stay','q_stay_length','q_replacement'], requiresLongStay:3, requiresConsent:true },\n    { id:'r_swap_same'",
    to:"requiresQuestions:['q_stay','q_stay_length','q_replacement'], requiresConsent:true },\n    { id:'r_swap_same'",
    expected:'§34 検査5: S7代替機が既存の長期滞在・同意条件を使わない',
  },
  {
    name:'S7を短期滞在へ戻す', file:'p2_data.js',
    from:"id:'S7', arrive:38, name:'中西 悠真', nameEn:'Yuma Nakanishi', age:29, ageRange:[25,40], type:'expert', abandonAfter:38, callbackTo:'hotel', stayDays:6,\n  deviceInHand:true", to:"id:'S7', arrive:38, name:'中西 悠真', nameEn:'Yuma Nakanishi', age:29, ageRange:[25,40], type:'expert', abandonAfter:38, callbackTo:'hotel', stayDays:2,\n  deviceInHand:true",
    expected:'§32 検査9: progression_testが通らない',
  },
  {
    name:'§53 S7照会データへ顧客発話を戻す', file:'p2_data.js',
    from:"hot:['coverage'], out:['sim','carrier','provision'] } },",
    to:"hot:['coverage'], out:['sim','carrier','provision'] },\n      customerReply:'照会結果を知りました。' },",
    expected:'§53 検査: S7照会データに顧客発話または苛立ち増加が残る',
  },
  {
    name:'§53 S7照会データへ苛立ち増加を戻す', file:'p2_data.js',
    from:"hot:['coverage'], out:['sim','carrier','provision'] } },",
    to:"hot:['coverage'], out:['sim','carrier','provision'] },\n      stressDelta:35 },",
    expected:'§53 検査: S7照会データに顧客発話または苛立ち増加が残る',
  },
  {
    name:'§53 finishLookupへ顧客発話例外を戻す', file:'p3_game.js',
    from:"  state.ui = defaultUi('system_record');",
    to:"  if (r && r.customerReply) pushCustomerLine(t, r.customerReply);\n  state.ui = defaultUi('system_record');",
    expected:'§53 検査: 別案件またはfinishLookupに顧客発話例外が残る',
  },
  {
    name:'S7を市街地でも使えない症状へ変える', file:'p2_data.js',
    from:'市街地では正常でしたが、郊外へ移動後は完全に圏外です。', to:'市街地でも郊外でも一度もつながりません。',
    expected:'§34 検査10: S7の部分利用可とS13の初回から利用不可を書き分けていない',
  },
  {
    name:'S7の真因をlogisticsへ混同する', file:'p2_data.js',
    from:"trueCause:'coverage', best:'r_coverage_replacement'", to:"trueCause:'logistics', best:'r_coverage_replacement'",
    expected:'§32 検査8: verifyが13案件を真因1つへ収束させない',
  },
  {
    name:'他案件の回線エスカレーションをresolveへ変える', file:'p2_data.js',
    from:"{ id:'r_escalate_line', label:'回線障害の疑いとして技術部門へエスカレーションする', sub:'枠を1つ消費。確実だが自己解決にはならない', kind:'escalate' }",
    to:"{ id:'r_escalate_line', label:'回線障害の疑いとして技術部門へエスカレーションする', sub:'枠を1つ消費。確実だが自己解決にはならない', kind:'resolve' }",
    expected:'§34 検査12: 他案件のエスカレーション設計が変わっている',
  },
  {
    name:'S7照会からprovision除外を消して収束を壊す', file:'p2_data.js',
    from:"hot:['coverage'], out:['sim','carrier','provision'] } },", to:"hot:['coverage'], out:['coverage','sim','carrier','provision'] } },",
    expected:'§32 検査8: verifyが13案件を真因1つへ収束させない',
  },
  {
    name:'S7から配送同意回答を消して正解経路を止める', file:'p2_data.js',
    from:"    q_replacement:{ text:'はい、郊外でも使える対応機を同じホテルへ送ってください。受け取ります。',\n      fact:{ text:'本人が同じホテルへの対応機配送を希望している', hot:['coverage'] } },\n", to:'',
    expected:'§32 検査9: progression_testが通らない',
  },
  {
    name:'S1からdeviceInHandフラグを消す', file:'p2_data.js',
    from:"id:'S1', arrive:0, name:'三宅 千夏', nameEn:'Chika Miyake', age:27, ageRange:[24,36], type:'anxious', abandonAfter:32, callbackTo:'hotel', stayDays:2,\n  deviceInHand:true,\n  contractId:{ minutes:2, text:'予約番号", to:"id:'S1', arrive:0, name:'三宅 千夏', nameEn:'Chika Miyake', age:27, ageRange:[24,36], type:'anxious', abandonAfter:32, callbackTo:'hotel', stayDays:2,\n  contractId:{ minutes:2, text:'予約番号",
    expected:'§35 検査1: deviceInHandの明示フラグではなくdevice表示文字列で判定している',
  },
  {
    name:'S9を機器所持済みにする', file:'p2_data.js',
    from:'  deviceInHand:false,',
    to:'  deviceInHand:true,',
    expected:'§35 検査2: S9がdeviceInHand falseではない',
  },
  {
    name:'q_lampから機器必須印を外す', file:'p2_data.js',
    from:"{ id:'q_lamp', label:'本体の画面表示とアンテナの状態を教えてください', needsDevice:true", to:"{ id:'q_lamp', label:'本体の画面表示とアンテナの状態を教えてください'",
    expected:'§35 検査3: 機器未所持のS9に本体表示・SSID・電池質問が出る',
  },
  {
    name:'再起動から機器必須印を外す', file:'p2_data.js',
    from:"wait:'再起動をお願いしました。立ち上がるまで少しかかります。', needsDevice:true", to:"wait:'再起動をお願いしました。立ち上がるまで少しかかります。'",
    expected:'§35 検査4: 機器未所持のS9に機器操作が出る',
  },
  {
    name:'q_replacementへ直らない場合を戻す', file:'p2_data.js',
    from:"label:'代替機の配送をご希望ですか'", to:"label:'直らない場合、代替機の配送をご希望ですか'",
    expected:'§35 検査5: q_replacementに「直らない場合」が残っている',
  },
  {
    name:'機器なしでも見えるq_whenへ再起動前提を入れる', file:'p2_data.js',
    from:'いつ、どのような状況で気づかれましたか？', to:'再起動しても直らないと気づいたのはいつですか？',
    expected:'§35 検査6: 機器なし案件に見える質問が特定症状を前提にしている',
  },
  {
    name:'S9へ成立しないq_lamp回答を戻す', file:'p2_data.js',
    from:"    q_when:{ text:'予約時刻を過ぎて到着したら無人でした。担当者も不在です。タクシーを待たせてます。'",
    to:"    q_lamp:{ text:'機器は未受取なので画面は見られません。' },\n    q_when:{ text:'予約時刻を過ぎて到着したら無人でした。担当者も不在です。タクシーを待たせてます。'",
    expected:'§35 検査7: S9に成立しないq_lampまたはq_other_device回答が残っている',
  },
  {
    name:'S9の成立するq_whenから物流手がかりを外す', file:'p2_data.js',
    from:"fact:{ text:'予約時刻を過ぎ、カウンターは臨時閉鎖。担当者も不在', hot:['logistics'] }",
    to:"fact:{ text:'予約時刻を過ぎ、カウンターは臨時閉鎖。担当者も不在' }",
    expected:'§35 検査8: S9から削った無効回答に代わる物流の手がかりが成立する質問にない',
  },
  {
    name:'機器所持案件から全操作を隠す', file:'p4_view.js',
    from:'TESTS.filter(test => !test.needsDevice || t.s.deviceInHand)', to:'TESTS.filter(test => !test.needsDevice && t.s.deviceInHand)',
    expected:'§35 検査9: 機器所持案件の質問・操作一覧が従来どおりではない',
  },
  {
    name:'S9貸出記録からprovision除外を消す', file:'p2_data.js',
    from:"out:['sim','hardware','carrier','coverage','provision','fup','devices','geo_block','device_side','device_net','location','power','heavy'] } },",
    to:"out:['logistics','sim','hardware','carrier','coverage','provision','fup','devices','geo_block','device_side','device_net','location','power','heavy'] } },",
    expected:'§32 検査8: verifyが13案件を真因1つへ収束させない',
  },
  {
    name:'S10から配送先回答を消して進行を止める（§35）', file:'p2_data.js',
    from:"    q_stay:{ text:'{hotel}、704号室です。ここで待っていれば届きますか？' },\n", to:'',
    expected:'§32 検査9: progression_testが通らない',
  },
  {
    name:'「伝える」の表示番号を2開始にする', file:'p4_view.js',
    from:"' + (index + 1) + '</span>'",
    to:"' + (index + 2) + '</span>'",
    expected:'§35 追加検査: 「伝える」の表示項目が1からの連番ではない',
  },
  {
    name:'復旧結果を客発話からnoteへ戻す', file:'p3_game.js',
    from:'pushCustomerLine(t, def.solves ? TYPES[t.s.type].solvedReply : def.text);',
    to:"pushCustomerLine(t, def.text);\n    if (def.solves) t.transcript.push({ who:'note', text:'この操作で症状が解消しました。原因を確定して案内できます。' });",
    expected:'§36 検査1: def.solvesの復旧がnoteのままで通話画面に出ない',
  },
  {
    name:'復旧発話を客タイプから切り離す', file:'p3_game.js',
    from:'def.solves ? TYPES[t.s.type].solvedReply : def.text', to:"def.solves ? '症状が解消しました。' : def.text",
    expected:'§36 検査1: def.solvesの復旧がnoteのままで通話画面に出ない',
  },
  {
    name:'noviceとanxiousの復旧発話を同じにする', file:'p2_data.js',
    from:"solvedReply:'まあ、つながりました！ 何が起きていたのかも教えてください。'",
    to:"solvedReply:'あ、つながりました…！ 何が原因だったのかも教えていただけますか？'",
    expected:'§36 検査3: 復旧発話が4タイプ分書き分けられていない',
  },
  {
    name:'復旧済み終話ガイドを通常の絞り込み案内へ戻す', file:'p4_view.js',
    from:"const next = t.symptomResolved\n    ? '症状は復旧しました。「伝える」→「原因を伝える」で原因をご説明すると、この電話を終われます。'\n    : causeNarrowed",
    to:'const next = causeNarrowed',
    expected:'§36 検査4: 復旧済み未案内の終話確認に第三の次手が出ない',
  },
  {
    name:'r_sim_cleanを手順記録ラベルへ戻す', file:'p2_data.js',
    from:'接点の一時的な接触不良だったことをご説明し、そのままご利用いただく',
    to:'2回目のSIM抜き差しと接点清掃で認識が戻ったことを確認し、利用を再開していただく',
    expected:'§36 検査5: r_sim_cleanが手順記録のままで原因説明になっていない',
  },
  {
    name:'r_topupを説明のない手順ラベルへ戻す', file:'p2_data.js',
    from:'容量超過だったことと追加購入の選択肢をご説明し、希望時はその場で適用する',
    to:'追加データをその場で購入して適用する',
    expected:'§36 検査6: 他のresolve対処に手順記録のままのラベルが残っている',
  },
  {
    name:'r_sim_cleanのkindをescalateへ変える', file:'p2_data.js',
    from:"kind:'resolve', needsTest:'t_simout', needsTestCount:2 },\n    { id:'r_escalate_swap'",
    to:"kind:'escalate', needsTest:'t_simout', needsTestCount:2 },\n    { id:'r_escalate_swap'",
    expected:'§36 検査7: resolve対処のID・kind・needsTestが文言修正に紛れて変わっている',
  },
  {
    name:'謝罪だけで評価結果を確定する', file:'p3_game.js',
    from:'const previous = t.apologies.get(id) || 0;', to:"t.pendingResult = {kind:'closed'};\n  const previous = t.apologies.get(id) || 0;",
    expected:'§36 検査8: 謝罪だけで終話でき、原因案内が不要になっている',
  },
  {
    name:'S7配送前提回答を消してprogressionを壊す（§36）', file:'p2_data.js',
    from:"    q_stay_length:{ text:'今日を含めてあと6泊です。郊外へ出る予定が続くので、対応機なら受け取る意味があります。',\n      fact:{ text:'残り6泊、同じホテルに滞在するため代替機を使える期間が十分にある', hot:['coverage'] } },\n", to:'',
    expected:'§32 検査9: progression_testが通らない',
  },
  {
    name:'キャリア完了連絡率を80%から下げる', file:'p2_data.js',
    from:'const CARRIER_REPLY_RATE = 0.8;', to:'const CARRIER_REPLY_RATE = 0.7;',
    expected:'§37 検査3: キャリア完了連絡の既定確率が80%ではない',
  },
  {
    name:'luckRate 1でもキャリア連絡を確定させない', file:'p3_game.js',
    from:'return flags.luckRate === 1 ? 1 : CARRIER_REPLY_RATE;', to:'return CARRIER_REPLY_RATE;',
    expected:'§37 検査4: luckRate 1.0でキャリア完了連絡が必ず届かない',
  },
  {
    name:'S12折り返し冒頭から復旧済み発話を消す', file:'p2_data.js',
    from:'あ、さっきから使えてます！ もうつながっています。直してくださって、本当にありがとうございます。',
    to:'その後どうなりましたか。状況を教えてください。',
    expected:'§37 検査7: 客室接続後に客が復旧と感謝を先に伝えない',
  },
  {
    name:'キャリア未返信でも客を復旧済みにする', file:'p2_data.js',
    from:'まだ圏外のままです…。連絡が来なかったのですね。もう一度お願いできますか。',
    to:'もうつながっています。ありがとうございました。',
    expected:'§37 検査9: 完了連絡なしでも回線が直り、客の落胆が出ない',
  },
  {
    name:'キャリア復旧前にS12の最適説明を許す', file:'p2_data.js',
    from:'kind:\'resolve\', needsCarrierRestored:true, reportsRestored:true',
    to:'kind:\'resolve\', reportsRestored:true',
    expected:'§37 検査11: 再開通完了の説明が返金より高い最適評価にならない',
  },
  {
    name:'人物シャッフルを常に無効にする', file:'p3_game.js',
    from:'const identities = flags.shuffleIdentity ? drawScenarioIdentities(scenarios, random) : scenarios.map(scenario => ({name:scenario.name,nameEn:scenario.nameEn,age:scenario.age,gender:scenario.gender}));',
    to:'const identities = scenarios.map(scenario => ({name:scenario.name,nameEn:scenario.nameEn,age:scenario.age,gender:scenario.gender}));',
    expected:'§38 検査1: 名前・ローマ字が候補から切り離され、シフトごとに割り当てられない',
  },
  {
    name:'geo_blockを中国以外にも割り当てる', file:'p3_game.js',
    from:"if (constraint === 'china_only') return place.cityEn === 'SHANGHAI';",
    to:"if (constraint === 'china_only') return true;",
    expected:'§38 検査6-1: geo_block案件が中国以外へ割り当てられる',
  },
  {
    name:'provisionの深夜制約を外す', file:'p3_game.js',
    from:'return minute >= 22 * 60 || minute < 4 * 60;',
    to:'return true;',
    expected:'§38 検査6: S12が日付境界の話として成立しない時差の土地へ割り当てられる',
  },
  {
    name:'S9へ固定時刻を戻す', file:'p2_data.js',
    from:'カウンターは無人で、機器を受け取れていません。',
    to:'現地22:35、カウンターは無人で、機器を受け取れていません。',
    expected:'§38 検査6-4: S9に固定時刻が残る、または営業時間外の芯が消えている',
  },
  {
    name:'S13へ申込国と同じSIMを割り当てる', file:'p3_game.js',
    from:'const wrongPlace = wrongCountryOrder.find(item => item.country !== place.country);',
    to:'const wrongPlace = wrongCountryOrder.find(item => item.country === place.country);',
    expected:'§38 検査6-5: S13の貸出品が申込国と別の土地から差し込まれない',
  },
  {
    name:'土地bundleと違うキャリア名を入れる', file:'p3_game.js',
    from:'carrierName:place.carrier,',
    to:"carrierName:'Broken Carrier',",
    expected:'§38 検査2: 国・都市・cityEn・localOffset・キャリアが1組で割り当てられない',
  },
  {
    name:'S7へ固定周波数帯を戻す', file:'p2_data.js',
    from:'郊外をカバーする周波数帯に非対応',
    to:'B20 800MHzに非対応',
    expected:'§38 検査6-7: 周波数帯の具体名が残っている',
  },
  {
    name:'都市テンプレートの差し込みを外す', file:'p3_game.js',
    from:'city|country|carrier|region|wrongCountry',
    to:'country|carrier|region|wrongCountry',
    expected:'§38 検査3: 台詞・照会結果に固定都市名または未解決の差し込みが残っている',
  },
  {
    name:'土地の一晩重複識別子を同じにする', file:'p3_game.js',
    from:'placeSourceScenarioId:place.sourceScenarioId,',
    to:"placeSourceScenarioId:'duplicate',",
    expected:'§38 検査8: 同じ名前または同じ土地が一晩に二度出る',
  },
  {
    name:'shuffleIdentity falseでも人物をシャッフルする', file:'p3_game.js',
    from:': scenarios.map(scenario => ({name:scenario.name,nameEn:scenario.nameEn,age:scenario.age,gender:scenario.gender}));',
    to:': shuffleScenarios(NAME_POOL, random);',
    expected:'§38 検査9: shuffleIdentity falseで案件データどおりの割り当てに戻らない',
  },
  {
    name:'入電通話料を会社負担へ戻す', file:'p3_game.js',
    from:'function callCost(t){ return (t.outboundMinutes || 0) * CALL_RATE_PER_MIN; }',
    to:'function callCost(t){ return (t.inboundMinutes || 0) * CALL_RATE_PER_MIN; }',
    expected:'§39 検査1: 客からかかってきた通話の料金が会社費用に計上される',
  },
  {
    name:'通話ヘッダの負担者を常に当社にする', file:'p4_view.js',
    from:"const payer = outbound ? '当社負担' : 'お客様負担';",
    to:"const payer = '当社負担';",
    expected:'通話ヘッダがチケットID・通話時間・負担者つき費用だけを表示していない',
  },
  {
    name:'通話料の心配をタイプ間で使い回す', file:'p2_data.js',
    from:'国際通話が5分を超えています。以降はホテルへの折り返しに切り替えられますか。',
    to:'海外からの通話料が心配で…。このまま長くなっても大丈夫でしょうか。',
    expected:'§39 検査4: 通話料を気にする発話がタイプ別に書き分けられていない',
  },
  {
    name:'5分超の通話料発話を毎分繰り返す', file:'p3_game.js',
    from:"!t.callChargeThresholdPassed && t.callDirection === 'inbound' && inboundBefore <= 5 && t.inboundMinutes > 5",
    to:"t.callDirection === 'inbound' && t.inboundMinutes > 5",
    expected:'§39 検査5: 通話料判定後に発話を繰り返す',
  },
  {
    // §40: 連絡先を持たないまま、ふつうの折り返しとして成立させてしまう変異。
    name:'滞在先未確認でも一般折り返しを開始する', file:'p3_game.js',
    from:'if (!hotelContactKnown(t)){ blindCallbackRedial(t); return; }',
    to:'if (false && !hotelContactKnown(t)){ blindCallbackRedial(t); return; }',
    expected:'§40 滞在先未確認の折り返しが、折り返せなかった扱いにならない',
  },
  {
    name:'Front Deskの選択肢を日本語にする', file:'p2_data.js',
    from:"This is a callback. The guest called us earlier.",
    to:'先ほどお客様からお電話をいただいた件の折り返しです。',
    expected:'§39 検査8: Front Deskの発話と選択肢が平易な英語で揃わない',
  },
  {
    name:'Front Deskの話者表示を客にする', file:'p4_view.js',
    from:"front:'Front Desk'", to:"front:'客'",
    expected:'§39 検査9: 客室接続後に話者がFront Deskから客へ切り替わらない',
  },
  {
    name:'現地深夜判定を常に無効にする', file:'p3_game.js',
    from:'return minute >= 22 * 60 || minute < 6 * 60;',
    to:'return false;',
    expected:'§39 検査10: 現地22時以降の深夜判定ができない',
  },
  {
    name:'折り返し説明でも深夜対応を遅らせる', file:'p3_game.js',
    from:"const direct = choice === 'callback';",
    to:'const direct = false;',
    expected:'§39 検査11: 折り返しと伝えてもFront Deskが円滑につながない',
  },
  {
    name:'折り返し以外の英語選択肢を詰ませる', file:'p3_game.js',
    from:"if (choice === 'room' && !hotelRoom(t)) return;",
    to:"if (choice === 'room' && !hotelRoom(t)) return;\n  if (choice !== 'callback') return;",
    expected:'§39 検査12: 別の英語選択肢で客室へつながらず詰む',
  },
  {
    name:'現地時刻から土地の時差を外す', file:'p3_game.js',
    from:'utc + t.s.localOffset * 60',
    to:'utc',
    expected:'§39 検査13: 現地時刻が割り当て土地のlocalOffsetから計算されない',
  },
  {
    name:'一般折り返しをキャリア専用扱いにする', file:'p3_game.js',
    from:"t.callbackReason = 'general';",
    to:"t.callbackReason = 'carrier';",
    expected:'§32 検査9: progression_testが通らない',
  },
  {
    name:'Front Deskの発話を選択画面から隠す', file:'p4_view.js',
    from:" + frontContext + renderCommandHead('Front Desk'",
    to:" + renderCommandHead('Front Desk'",
    expected:'§39 検査7: Front Deskの発話が選択画面に表示されない',
  },
  {
    name:'Front Deskへ顧客名を日本語で伝える', file:'p4_view.js',
    from:"options.guest.replace('{name}', t.s.nameEn)",
    to:"options.guest.replace('{name}', t.s.name)",
    expected:'§39 検査8: Front Deskへ伝える顧客名がローマ字になっていない',
  },
  {
    name:'部屋番号不明でもroom選択肢を表示する', file:'p4_view.js',
    from:'const roomChoice = room\n    ?',
    to:"const roomChoice = room || '—'\n    ?",
    expected:'§39 検査8: 部屋番号不明時にroom選択肢またはダッシュが表示される',
  },
  {
    name:'S2へ同行者をいま待たせている台詞を戻す', file:'p2_data.js',
    from:'同行のお二人にも迷惑をかけないか心配で…。',
    to:'同行のお二人をいま待たせています…。',
    expected:'§38 検査6-8: S2に同行者をいま待たせている現在進行が残っている',
  },
  {
    name:'S9へ退勤済み表現を戻す', file:'p2_data.js',
    from:'担当者も不在です。タクシーを待たせてます。',
    to:'担当者も退勤済みです。タクシーを待たせてます。',
    expected:'§38 検査6-9: S9が時間帯に依存しない担当者不在の表現になっていない',
  },
  {
    name:'S11へ会議開始カウントダウンを戻す', file:'p2_data.js',
    from:'切り分けを急いでいます。次の指示をください。',
    to:'会議開始まで5分です。次の指示をください。',
    expected:'§38 検査6-10: S11の会議カウントダウンが消えていない、または会議場・地下の芯が消えている',
  },
  {
    name:'hurried共通文へ会議開始を戻す', file:'p2_data.js',
    from:'時計見てます？ 次の予定が迫ってる。急いで。',
    to:'時計見てます？ 会議が始まる。急いで。',
    expected:'§38 検査6-11: hurried共通文が予定一般の表現になっていない',
  },
  {
    name:'土地制約へcarrierを追加する', file:'p2_data.js',
    from:"  provision:'deep_night',\n});",
    to:"  provision:'deep_night',\n  carrier:'shared_region',\n});",
    expected:'§38 検査6-12: 土地の制約がgeo_blockとprovisionの2つだけではない',
  },
  {
    name:'§52 夜勤を22時開始へ戻す', file:'p2_data.js',
    from:'const SHIFT_START = 23 * 60; // 23:00 JST',
    to:'const SHIFT_START = 22 * 60; // 22:00 JST',
    expected:'§52 検査1: 勤務が23:00に始まらない',
  },
  {
    name:'§52 07時の終了時刻を一分前にする', file:'p3_game.js',
    from:'  state.clock = SHIFT_END;\n  state.turn = SHIFT_DURATION;',
    to:'  state.clock = SHIFT_END - 1;\n  state.turn = SHIFT_DURATION;',
    expected:'§52 検査2: 07:00でシフトが終わらない',
  },
  {
    name:'§52 時間切れの残件を放棄呼にしない', file:'p3_game.js',
    from:"    else abandonTicket(t, '07:00の勤務終了で放棄呼になりました。');",
    to:"    else { t.state = 'closed'; t.result = { kind:'handed_off' }; }",
    expected:'§52 検査3/24: 07:00の待機案件と通話中案件を放棄呼・日勤引き継ぎへ分けない',
  },
  {
    name:'§52 案件データの固定arriveを着信に戻す', file:'p3_game.js',
    from:'  const arrivalSlots = drawInboundArrivalTurns(count, random);',
    to:'  const arrivalSlots = drawInboundArrivalTurns(count, random); // scenario.arrive',
    expected:'§52 検査4: 案件データの arrive を着信時刻に使っている',
  },
  {
    name:'§52 着信間隔をなくす', file:'p2_data.js',
    from:'const MIN_INBOUND_GAP = 20;',
    to:'const MIN_INBOUND_GAP = 0;',
    expected:'§52 検査5: 着信どうしが20分以上離れない',
  },
  {
    name:'§52 放棄までの残り時間を表示する', file:'p4_view.js',
    from:"  $('office-answer-status').textContent = '待ち ' + waiting.length + '件';",
    to:"  $('office-answer-status').textContent = '待ち ' + waiting.length + '件 ／ 最短あと 1分で切断';",
    expected:'電話を取るボタンが待ち件数だけを表示していない',
  },
  {
    name:'§52 patienceによる放棄を止める', file:'p3_game.js',
    from:'if (t.state === \'waiting\') t.patience -= 100 / t.s.abandonAfter;',
    to:"if (t.state === 'waiting') t.patience -= 0;",
    expected:'§52 検査8: patienceが0で切断される仕組みが変わった',
  },
  {
    name:'§52 日報後にもオフィスへ戻す', file:'p4_view.js',
    from:"function enterOffice(){\n  if (state.phase === 'report') return;",
    to:'function enterOffice(){',
    expected:'§52 検査2: 07:00の日報後にデスク照会からオフィスへ戻って進行不能になる',
  },
  {
    name:'§52 日報後にも未検証対処を再入電へ戻す', file:'p3_game.js',
    from:"function queueUnverifiableRedial(t){\n  if (state.phase === 'report') return;",
    to:'function queueUnverifiableRedial(t){',
    expected:'§52 検査2: 07:00後に未検証対処が放棄呼を再入電待ちへ戻す',
  },
  {
    name:'§52 ブリーフィングを22時表記へ戻す', file:'p4_view.js',
    from:"'<p class=\"eyebrow\">SHIFT BRIEFING ／ 08月31日 ' + fmtClock(SHIFT_START) + ' JST</p>' +",
    to:"'<p class=\"eyebrow\">SHIFT BRIEFING ／ 08月31日 22:00 JST</p>' +",
    expected:'§52 検査1: 画面に出る勤務開始時刻がSHIFT_STARTと一致しない',
  },
  {
    name:'§52 verifyを固定22時到着表へ戻す', file:'verify.js',
    from:'  const min = SHIFT_START + arrival;',
    to:'  const min = 22 * 60 + arrival;',
    expected:'§52 検査4: verify.jsの到着スケジュールが実際の着信を表示しない',
  },
  {
    name:'§52 タイムシフト表の終点を8時へずらす', file:'p4_view.js',
    from:"[0,'23'], [25,'01'], [50,'03'], [75,'05'], [100,'07']",
    to:"[0,'23'], [25,'01'], [50,'03'], [75,'05'], [100,'08']",
    expected:'§52 検査12: 帯の目盛りが23時から7時にならない',
  },
  {
    name:'§52 現在時刻線を消す', file:'p4_view.js',
    from:"ticks + '<span class=\"shift-now\" style=\"left:' + now.toFixed(2) + '%\" aria-label=\"現在時刻\"></span>' + pins +",
    to:'ticks + pins +',
    expected:'§52 検査13: 現在時刻がラベルなしの線で帯に出ない',
  },
  {
    name:'§52 ピンを現在時刻へ寄せる', file:'p4_view.js',
    from:'const pos = clamp(arrivedTurn / SHIFT_DURATION * 100, 0, 100);',
    to:'const pos = clamp(state.turn / SHIFT_DURATION * 100, 0, 100);',
    expected:'§52 検査14: 案件のピンが着信時刻の位置に立たない',
  },
  {
    name:'§52 未着信ピンを出す', file:'p4_view.js',
    from:'    if (t.handover || t.arrivedTurn <= state.turn){',
    to:'    if (true){',
    expected:'§52 検査15: まだ着信していない案件のピンが出る',
  },
  {
    name:'§52 通話中にタイムシフト表を畳む', file:'p1_head.html',
    from:'/* §52: 通話中にも、自分の夜がどこまで来たかを判断できるようタイムシフト表を残す。',
    to:'body.call-view .shift-strip{ height: 0; }\n/* §52: 通話中にも、自分の夜がどこまで来たかを判断できるようタイムシフト表を残す。',
    expected:'§52 検査16: 通話中にタイムシフト表が畳まれる、または旧名称が残る',
  },
  {
    name:'§52 ピンから現地時刻を外す', file:'p4_view.js',
    from:"esc(localClock(t))",
    to:"esc(fmtClock(state.clock))",
    expected:'§52 検査17: ピンに都市・現地時刻・状態が残らない',
  },
  {
    name:'§52 右端07を軸の外へずらす', file:'p1_head.html',
    from:'.shift-tick.last{ right: auto; transform: translateX(-100%); }',
    to:'.shift-tick.last{ right: 0; transform: none; }',
    expected:'§52 検査12: 右端07の目盛りが軸の外へはみ出す',
  },
  {
    name:'§52 夜明けの目盛りを読めなくする', file:'p1_head.html',
    from:'.shift-tick.dark{ color:#102a43;',
    to:'.shift-tick.dark{ color:#5d7185;',
    expected:'§52 検査12: 夜明けの背景で目盛りのコントラストが読めない',
  },
  {
    name:'§55 引き継ぎなしの夜を少数にする', file:'p2_data.js',
    from:'const HANDOVER_ZERO_RATE = 0.6;',
    to:'const HANDOVER_ZERO_RATE = 0.3;',
    expected:'§55 検査1: 引き継ぎが0〜2件で、0件の夜を最も多くする抽選にならない',
  },
  {
    name:'§55 引き継ぎを入電件数の内数にする', file:'p3_game.js',
    from:'  const total = inboundCount + handoverCount;',
    to:'  const total = inboundCount;',
    expected:'§55 検査2: 入電2〜5件とは別に引き継ぎ0〜2件を置けない',
  },
  {
    name:'§55 引き継ぎを新規入電として始める', file:'p3_game.js',
    from:"    s, state:handover ? 'callback' : 'inbound', patience:100, arrivedTurn:handover ? callbackTurn : s.arrive,",
    to:"    s, state:'inbound', patience:100, arrivedTurn:handover ? callbackTurn : s.arrive,",
    expected:'§55 検査5: 引き継ぎ案件が約束時刻の直接折り返し待ちとして始まらない',
  },
  {
    name:'§55 引き継ぎを現地キャリア照会中と表示する', file:'p4_view.js',
    from:"<br>折り返し待ち <b>' + callbacks.length",
    to:"<br>現地キャリア照会中 <b>' + callbacks.length",
    expected:'§55 検査7: 引き継ぎの折り返し待ちを現地キャリア照会中と誤表示する',
  },
  {
    name:'§55 日勤の本人確認を捨てる', file:'p3_game.js',
    from:'greeted:handover, identified:handover, nameKnown:handover, destinationKnown:handover,',
    to:'greeted:handover, identified:false, nameKnown:false, destinationKnown:false,',
    expected:'§55 検査6: 日勤の本人確認を引き継げない、または原因の手がかりまで先に渡している',
  },
  {
    name:'§55 引き継ぎに原因の手がかりを先に入れる', file:'p3_game.js',
    from:'    facts:[], asked:new Set(),',
    to:"    facts:handover ? [{hot:[s.trueCause],out:[]}] : [], asked:new Set(),",
    expected:'§55 検査6: 日勤の本人確認を引き継げない、または原因の手がかりまで先に渡している',
  },
  {
    name:'§55 引き継ぎMTGで真の原因を明かす', file:'p4_view.js',
    from:"      esc(ticket.s.handoverSymptom) + '」とお困りなので、<strong>' +",
    to:"      esc(ticket.s.handoverSymptom) + ' 原因:' + esc(ticket.s.trueCause) + '」とお困りなので、<strong>' +",
    expected:'§55 検査9: 引き継ぎMTGが3点以外の原因・照会・会話を漏らす',
  },
  {
    name:'§55 引き継ぎMTGへ説明用ラベルを戻す', file:'p4_view.js',
    from:"    '<article class=\"handover-card\"><p><strong>' + esc(ticket.s.name) + '様</strong>が「' +",
    to:"    '<article class=\"handover-card\"><p>誰か：<strong>' + esc(ticket.s.name) + '様</strong>が「' +",
    expected:'§55 検査8: 引き継ぎMTGがラベルのない1行の申し送りになっていない',
  },
  {
    name:'§55 引き継ぎMTGで顧客名を重複する', file:'p4_view.js',
    from:"    '<article class=\"handover-card\"><p><strong>' + esc(ticket.s.name) + '様</strong>が「' +",
    to:"    '<article class=\"handover-card\"><p><strong>' + esc(ticket.s.name) + '様</strong>について、<strong>' + esc(ticket.s.name) + '様</strong>が「' +",
    expected:'§55 検査8: 引き継ぎMTGで顧客名が重複している',
  },
  {
    name:'§55 引き継ぎ0件でも空の会議を開く', file:'p4_view.js',
    from:'  if (handoverMeetingTickets().length){ showHandoverMeeting(); return; }',
    to:'  if (true){ showHandoverMeeting(); return; }',
    expected:'§55 検査10: 引き継ぎ0件の日に空の会議を見せる、または0件と知らせず夜勤へ入る',
  },
  {
    name:'§55 在室率を80%にする', file:'p2_data.js',
    from:'const HANDOVER_ANSWER_RATE = 0.5;',
    to:'const HANDOVER_ANSWER_RATE = 0.8;',
    expected:'§55 検査11: 在室50%またはluckRate 1で必ず在室の境界が違う',
  },
  {
    name:'§55 luckRate 1でも不在にする', file:'p3_game.js',
    from:'  return flags.luckRate === 1 || state.random() < HANDOVER_ANSWER_RATE;',
    to:'  return state.random() < HANDOVER_ANSWER_RATE;',
    expected:'§55 検査11: 在室50%またはluckRate 1で必ず在室の境界が違う',
  },
  {
    name:'§55 引き継ぎへ何度でも発信できる', file:'p3_game.js',
    from:'t.handover || t.handoverAttempted || t.state',
    to:'t.handover || false || t.state',
    expected:'§55 検査12: 引き継ぎへ一度連絡したあと再発信を拒否しない',
  },
  {
    name:'§55 不在案件を評価へ入れる', file:'p4_view.js',
    from:'  const scored = finished.filter(t => !unscoredOutcome(t));',
    to:'  const scored = finished;',
    expected:'§55 検査14: 不在の引き継ぎ案件がCSAT・応答率・平均通話を下げる',
  },
  {
    name:'§55 朝の通話中案件を放棄呼にする', file:'p3_game.js',
    from:"    if (t.state === 'open') handoffActiveTicket(t);",
    to:"    if (t.state === 'open') abandonTicket(t, '07:00の勤務終了で放棄呼になりました。');",
    expected:'§52 検査3/24: 07:00の待機案件と通話中案件を放棄呼・日勤引き継ぎへ分けない',
  },
  {
    name:'§55 朝の引き継ぎを必須申し送りから外す', file:'p4_view.js',
    from:"  state.tickets.filter(ticket => ticket.result && ticket.result.kind === 'handed_off').forEach(ticket => {",
    to:"  state.tickets.filter(ticket => false).forEach(ticket => {",
    expected:'§55 検査15: 07時の通話中案件が日勤への必須申し送りに残らない',
  },
  {
    name:'§57 1時間の経過を0.12秒で飛ばす', file:'p4_view.js',
    from:'  return Math.min(2800, Math.max(25, minutes * 25));',
    to:'  return Math.min(2800, Math.max(25, minutes * 2));',
    expected:'§57 検査1: 1時間の経過演出が1〜2秒に収まらない',
  },
  {
    name:'§57 経過時間にかかわらず同じ長さで見せる', file:'p4_view.js',
    from:'  return Math.min(2800, Math.max(25, minutes * 25));',
    to:'  return 1500;',
    expected:'§57 検査2: 経過時間に応じて演出時間が変わらない、または長時間待たせすぎる',
  },
  {
    name:'§57 オフィス時計だけ更新しない', file:'p4_view.js',
    from:'  if (officeClock) officeClock.textContent = fmtClock(rounded);',
    to:'',
    expected:'§57 検査3: 2つの時計と現在線が同じ分へ着地しない',
  },
  {
    name:'§57 タイムシフト表を動かさない', file:'p4_view.js',
    from:'  renderShiftStrip(rounded);',
    to:'  renderShiftStrip(state.clock);',
    expected:'§57 検査3: 時計とタイムシフト表が同じ表示時刻で動かない',
  },
  {
    name:'§57 タイムシフト現在線を最終時刻へ飛ばす', file:'p4_view.js',
    from:'  const now = clamp((displayClock - SHIFT_START) / SHIFT_DURATION * 100, 0, 100);',
    to:'  const now = clamp((state.clock - SHIFT_START) / SHIFT_DURATION * 100, 0, 100);',
    expected:'§57 検査4: タイムシフト表の現在線が補間中の表示時刻を使わない',
  },
  {
    name:'§57 reduced-motionでもアニメーションする', file:'p4_view.js',
    from:'  if (typewriterOff()){\n    finishTimePassage();',
    to:'  if (false){\n    finishTimePassage();',
    expected:'§57 検査5: prefers-reduced-motionで即着地しない',
  },
  {
    name:'§57 タップで時間経過を飛ばせなくする', file:'p5_events.js',
    from:"  if (timePassage){\n    const answerDuringPassage = e.target.closest('[data-office-answer]');\n    finishTimePassage();\n    if (!answerDuringPassage) return;\n  }\n",
    to:"  if (timePassage){\n    const answerDuringPassage = e.target.closest('[data-office-answer]');\n    if (!answerDuringPassage) return;\n  }\n",
    expected:'§57 検査8: タップで時間経過演出を飛ばせない',
  },
  {
    name:'§57 演出中にゲーム時刻を書き換える', file:'p4_view.js',
    from:'  const rounded = Math.round(minute);',
    to:'  const rounded = Math.round(minute);\n  state.clock = rounded;',
    expected:'§57 検査7: 演出の途中でゲーム時刻または判定を動かしている',
  },
  {
    name:'§57 07時の着地前に業務報告へ飛ぶ', file:'p4_view.js',
    from:'  if (startTimePassageIfNeeded(() => renderReport())) return;\n',
    to:'',
    expected:'§57 検査9: 07:00の着地前に業務報告へ飛ぶ',
  },
  {
    name:'§53 iPhoneで再生用AudioSessionを設定しない', file:'p4_view.js',
    from:"      try { navigator.audioSession.type = 'playback'; }", to:"      try { navigator.audioSession.type = 'ambient'; }",
    expected:'iPhoneのユーザー操作内でAudioContextを再開し、再生用AudioSessionへ切り替えない',
  },
  {
    name:'§60 interruptedのAudioContextをresumeしない', file:'p4_view.js',
    from:"      if (ctx.state !== 'running' && typeof ctx.resume === 'function') await ctx.resume();", to:"      if (ctx.state === 'suspended' && typeof ctx.resume === 'function') await ctx.resume();",
    expected:'§60 interruptedからresumeし、戻らなければ作り直す実挙動がない',
  },
  {
    name:'§53 AudioContext生成失敗を診断表示へ出さない', file:'p4_view.js',
    from:"    audioContext = null;\n    setAudioUnlockStatus('error');", to:"    audioContext = null;\n    setAudioUnlockStatus('idle');",
    expected:'AudioContext生成失敗がiPhone診断表示へ反映されない',
  },
  {
    name:'§53 着信タイマー側からAudioContextをresumeする', file:'p4_view.js',
    from:"    if (audioContext.state !== 'running'){", to:"    if (audioContext.state === 'suspended') audioContext.resume();\n    if (audioContext.state !== 'running'){",
    expected:'着信タイマー等のユーザー操作外からAudioContext.resumeを呼ぶ',
  },
  {
    name:'§53 iPhone音声の試聴ボタンを外す', file:'p4_view.js',
    from:'data-audio-unlock="1"', to:'data-audio-retry="1"',
    expected:'iPhoneで解除失敗と端末側無音を切り分ける試聴UIがない',
  },
  {
    name:'§53 前通話の会話を折り返し画面へ戻す', file:'p4_view.js',
    from:'  const delivered = t.transcript.slice(start, end);', to:'  const delivered = t.transcript.slice(0, end);',
    expected:'§53 検査3: 折り返し画面に前の通話の顧客発話が混ざる',
  },
  {
    name:'§53 接続時の待機不満を二重発話させる', file:'p3_game.js',
    from:'  applyCallbackWaitStress(t, false);', to:'  applyCallbackWaitStress(t, true);',
    expected:'§53 検査3: Front Desk接続時に顧客が複数回発話する',
  },
  {
    name:'§53 expert待機文で時刻超過を断定する', file:'p2_data.js',
    from:'照会の進捗を説明してください。これ以上、根拠なく待たせないでください。', to:'約束した時間を超えています。照会の進捗を説明してください。',
    expected:'§53 検査4: 実時間を見ていない不満発話が時刻超過を断定する、または定刻発話まで失われる',
  },
  {
    name:'§53 発信保留を着信保留と同じ重さにする', file:'p2_data.js',
    from:'const HOLD_STRESS_PER_MINUTE = Object.freeze({ inbound:2, outbound:4 });', to:'const HOLD_STRESS_PER_MINUTE = Object.freeze({ inbound:2, outbound:2 });',
    expected:'§53 検査6: 保留の即時ストレスが0分にも入り、または発信時が着信時の2倍でない',
  },
  {
    name:'§53 保留ストレスへ運を挟む', file:'p3_game.js',
    from:'addStress(t, held * HOLD_STRESS_PER_MINUTE[direction], false, true)', to:'addStress(t, held * HOLD_STRESS_PER_MINUTE[direction], false, false)',
    expected:'§53 検査6: 保留の即時ストレスが0分にも入り、または発信時が着信時の2倍でない',
  },
  {
    name:'§53 見切り返金も満足抽選へ入れる', file:'p3_game.js',
    from:'  if (!assessment.diagnosed) return false;', to:'  if (!assessment.diagnosed) return state.random() < REFUND_POLICY[assessment.group].satisfactionRate;',
    expected:'原因を絞らない返金が抽選で満足になる',
  },
  {
    name:'§53 見切り返金の苦情印を消す', file:'p3_game.js',
    from:'refundComplaint:!assessment.diagnosed,', to:'refundComplaint:false,',
    expected:'原因を絞らない返金が運を挟まず翌日の苦情にならない',
  },
  {
    name:'§53 見切り返金の苦情に運を戻す', file:'p3_game.js',
    from:'  if (result.refundComplaint) return true;', to:'  if (result.refundComplaint) return rollLuck();',
    expected:'§53 検査7: 見切り返金の翌日苦情に運が入り、届かない場合がある',
  },
  {
    name:'§53 放棄後の再着信を二回許す', file:'p3_game.js',
    from:'if (t.abandonRedialScheduled || t.abandonedCalls > ABANDON_REDIAL_LIMIT || state.clock >= SHIFT_END)', to:'if (t.abandonedCalls > ABANDON_REDIAL_LIMIT + 1 || state.clock >= SHIFT_END)',
    expected:'§53 検査8: 二度目も再予約する、または一度目の放棄履歴を失う',
  },
  {
    name:'§53 放棄後再着信の20分間隔を外す', file:'p3_game.js',
    from:'Math.abs(candidate - other.arrivedTurn) >= MIN_INBOUND_GAP', to:'Math.abs(candidate - other.arrivedTurn) > 0',
    expected:'§53 検査8: 再着信が20分間隔または06:00上限を破る',
  },
  {
    name:'§53 最終着信を07:00へ延ばす', file:'p2_data.js',
    from:'const LAST_INBOUND_TURN = 7 * 60;', to:'const LAST_INBOUND_TURN = 8 * 60;',
    expected:'§53 検査8: 最終着信上限が06:00でない',
  },
  {
    name:'§53 最初の放棄履歴を保存しない', file:'p3_game.js',
    from:"  t.attempts.push({ kind:'abandoned', atTurn:abandonedAtTurn, arrivedTurn:abandonedArrival, note });", to:'',
    expected:'§53 検査8: 一度目の放棄記録を保持したまま再着信待ちへ戻らない',
  },
  {
    name:'§53 オフィスでシフト帯をトップバーへ残す', file:'p4_view.js',
    from:'  mountShiftStrip(true);', to:'  mountShiftStrip(false);',
    expected:'§53 検査9: 画面遷移に応じて単一シフト帯を移動しない',
  },
  {
    name:'§53 オフィスでトップバー時計も表示する', file:'p1_head.html',
    from:'body.office-view .topbar .clock{ display:none; }', to:'body.office-view .topbar .clock{ display:flex; }',
    expected:'§53 検査9: オフィス時計・シフト帯が見出し直下でなく、トップバー時計も重複表示される',
  },
  {
    name:'§61 ホテル名から都市名を外す', file:'p2_data.js',
    from:"    hotelName:hotelStem + ' ' + scenario.city,",
    to:'    hotelName:hotelStem,',
    expected:'§61 検査1: ホテル名の末尾が割り当て土地の都市名でない',
  },
  {
    name:'§61 住所だけでホテル折り返しを許す', file:'p3_game.js',
    from:"return Boolean(t && t.asked && t.asked.has('q_stay') && t.stayAddress && t.stayHotelName);",
    to:"return Boolean(t && t.asked && t.asked.has('q_stay') && t.stayAddress);",
    expected:'§61 検査4/5: 住所だけで折り返せる、またはホテル名を聞いても折り返せない',
  },
  {
    name:'§63 約束後の必要なホテル確認でも怒らせる', file:'p3_game.js',
    from:"    if ((!necessaryCallbackStay || !r) && !addStress(t, askStressBase(t, r ? 3 : 9), !r)) return;",
    to:"    if (!addStress(t, askStressBase(t, r ? 3 : 9), !r)) return;",
    expected:'§63 検査1: 折り返し約束後の初回ホテル確認が名前を返す、怒らない、1分進むの3点を満たさない',
  },
  {
    name:'§63 S4の3時間後希望を消す', file:'p2_data.js',
    from:"stayDays:4, callbackPreference:'three_hours',",
    to:'stayDays:4,',
    expected:'§63 検査4/5: S4とS12に3時間後・翌日の希望が付いていない',
  },
  {
    name:'§64 オフィスへ戻るだけで1分進める', file:'p4_view.js',
    from:"  state.phase = 'office';\n  activateDueInbound();\n  if (state.phase === 'report') return;",
    to:"  state.phase = 'office';\n  advance(1);\n  activateDueInbound();\n  if (state.phase === 'report') return;",
    expected:'§64 検査1: オフィスへ戻るだけで時刻を進める',
  },
  {
    name:'§64 機器検証を1分ずつ進めない', file:'p3_game.js',
    from:'    state.deviceVerificationMinutes++;\n    advance(1);',
    to:'    state.deviceVerificationMinutes += remaining;\n    advance(remaining);',
    expected:'§25 機器検証中の着信と折り返し期限の進行を両立できない',
  },
  {
    name:'§64 着信しても機器検証を止めない', file:'p3_game.js',
    from:"    if (state.tickets.some(t => t.state === 'waiting')) break;",
    to:'',
    expected:'機器検証が着信した分で中断し、途中時間を保存できない',
  },
  {
    name:'§65 通話料を訴える客を半分以外にする', file:'p2_data.js',
    from:"const CALL_CHARGE_COMPLAINT_TYPES = Object.freeze(['hurried','expert']);",
    to:"const CALL_CHARGE_COMPLAINT_TYPES = Object.freeze(['hurried','expert','anxious']);",
    expected:'§65 検査1: 通話料を直接訴えるタイプが半分でない',
  },
  {
    name:'§65 急ぐ客も一般折り返しを承諾する', file:'p3_game.js',
    from:"  if (t.s && t.s.type === 'hurried'){",
    to:"  if (false && t.s && t.s.type === 'hurried'){",
    expected:'§65 検査4/5: 急ぐ客が一般折り返しを断って同じ通話で解決を続けられない',
  },
  {
    name:'§9 引き継ぎ会議の人物を1人にする', file:'p4_view.js',
    from:"    { x:115, y:120, facing:'back', hair:'bob', hairColor:'charcoal', coat:'silver', shoulders:11 },\n",
    to:'',
    expected:'§9 検査2: 既存オフィス背景と人物部品で2人の申し送りを描かない',
  },
  {
    name:'小画面でオフィス操作の固定を外す', file:'p1_head.html', layout:true,
    from:'    position:fixed; z-index:45; left:0; right:0; bottom:0;',
    to:'    position:static; z-index:45; left:0; right:0; bottom:0;',
    expected:'オフィス4操作 の中心が初期表示の画面外',
  },
  {
    name:'小画面で直近の顧客発話を消す', file:'p1_head.html', layout:true,
    from:'  body.call-view .transcript.recent{\n    position:fixed; z-index:101; isolation:isolate; left:0; right:0;\n    bottom:var(--short-call-actions-height);\n    display:flex;',
    to:'  body.call-view .transcript.recent{\n    position:fixed; z-index:101; isolation:isolate; left:0; right:0;\n    bottom:var(--short-call-actions-height);\n    display:none;',
    expected:'直近の顧客発話が描画されていない',
  },
  {
    name:'小画面の上部バーを時計込み5列へ戻す', file:'p1_head.html', layout:true,
    from:'  .topbar-inner{ grid-template-columns:minmax(0,1fr) auto auto auto; }\n  .topbar-inner > .clock{ display:none; }\n  .topbar-inner > .btn-sound{ grid-column:2; }\n  .topbar-inner > .btn-balance{ grid-column:3; }\n  .topbar-inner > .btn-help{ grid-column:4; }',
    to:'  .topbar-inner{ grid-template-columns:minmax(0,1fr) auto auto auto auto; }\n  .topbar-inner > .clock{ display:flex; }\n  .topbar-inner > .btn-sound{ grid-column:3; }\n  .topbar-inner > .btn-balance{ grid-column:4; }\n  .topbar-inner > .btn-help{ grid-column:5; }',
    expected:'上部バーの実描画が重なっている',
  },
];

const requestedMutations = process.env.MUTATION_MATCH
  ? mutations.filter(mutation => mutation.name.includes(process.env.MUTATION_MATCH))
  : mutations;
assert(requestedMutations.length, 'MUTATION_MATCH に一致する変異がない');
const skippedMutations = requestedMutations.filter(mutation => mutation.layout && !process.env.WIFI_LAYOUT_CDP_PORT);
const selectedMutations = requestedMutations.filter(mutation => !skippedMutations.includes(mutation));
if (process.env.MUTATION_MATCH && skippedMutations.length) {
  throw new Error('小画面レイアウト変異には WIFI_LAYOUT_CDP_PORT が必要');
}

/* 変異の的が現行ソースに当たるかを、走らせる前にまとめて確かめる。
   0箇所なら止める。複数箇所は「意図しないほうを壊している」恐れがあるので一覧に出す。
   2026-09-02、狙いが複数に当たって別の場所を壊し、検査が緑のままになる事故が3度あった。 */
(function auditMutationTargets(){
  const cache = {};
  const readOnce = file => cache[file] || (cache[file] = fs.readFileSync(path.join(__dirname, file), 'utf8'));
  const missing = [];
  const ambiguous = [];
  requestedMutations.forEach((mutation, index) => {
    if (!mutation || !mutation.file || typeof mutation.from !== 'string') return;
    const hits = readOnce(mutation.file).split(mutation.from).length - 1;
    if (hits === 0) missing.push('[' + (index + 1) + '] ' + mutation.name + ' (' + mutation.file + ')');
    else if (hits > 1) ambiguous.push('[' + (index + 1) + '] ' + mutation.name + ' (' + mutation.file + ' に ' + hits + ' 箇所)');
  });
  assert.equal(missing.length, 0, '変異の的が現行ソースに当たりません:\n  ' + missing.join('\n  '));
  assert.equal(ambiguous.length, 0, '変異の的が複数箇所に当たります:\n  ' + ambiguous.join('\n  '));
})();

for (const mutation of selectedMutations){
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wifi-support-negative-'));
  try {
    for (const name of projectFiles) fs.cpSync(path.join(__dirname, name), path.join(temp, name), { recursive:true });
    const target = path.join(temp, mutation.file);
    const before = fs.readFileSync(target, 'utf8');
    assert(before.includes(mutation.from), mutation.name + ': mutation target not found');
    const after = mutation.all ? before.split(mutation.from).join(mutation.to) : before.replace(mutation.from, mutation.to);
    fs.writeFileSync(target, after);
    const build = spawnSync(process.execPath, ['build.js'], { cwd:temp, encoding:'utf8' });
    assert.equal(build.status, 0, mutation.name + ': mutated build failed before contract test');
    const testScript = mutation.layout ? 'small_viewport_layout_test.js' : 'ui_contract_test.js';
    const result = spawnSync(process.execPath, [testScript], { cwd:temp, encoding:'utf8', env:process.env });
    const output = (result.stdout || '') + (result.stderr || '');
    assert.notEqual(result.status, 0, mutation.name + ': contract test stayed green');
    assert(output.includes(mutation.expected), mutation.name + ': wrong failure\n' + output);
    console.log('RED:', mutation.name, '→', mutation.expected);
  } finally {
    fs.rmSync(temp, { recursive:true, force:true });
  }
}

const skippedNote = skippedMutations.length ? ' (' + skippedMutations.length + '件は WIFI_LAYOUT_CDP_PORT 未指定のため未実行)' : '';
console.log('UI negative mutations:', selectedMutations.length + '/' + requestedMutations.length, 'red' + skippedNote);
