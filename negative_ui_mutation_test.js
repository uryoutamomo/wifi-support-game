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
const boardPane = `  <section class="pane board">
    <div class="pane-head">
      <h2 class="pane-title">診断ボード</h2>
      <span class="count-chip mono" id="fact-count">0件</span>
    </div>
    <div id="board"></div>
  </section>`;
const mutations = [
  {
    name:'上部の通話・待機・診断タブを復活させる', file:'p1_head.html',
    from:'<div class="console">\n\n  <section class="pane desk">',
    to:'<div class="console">\n\n  <nav class="mobile-pane-nav">通話／待機／診断</nav>\n\n  <section class="pane desk">',
    expected:'上部の通話・待機・診断タブが戻っている',
  },
  {
    name:'診断ペインをdisplay noneへ戻す', file:'p1_head.html',
    from:'.pane-head{ padding-bottom:10px; }',
    to:'.pane.board{ display:none; }\n.pane-head{ padding-bottom:10px; }',
    expected:'3ペインの一部が非表示になっている',
  },
  {
    name:'pane単独セレクタで全ペインをdisplay noneにする', file:'p1_head.html',
    from:'.pane-head{ padding-bottom:10px; }',
    to:'.pane{ display:none; }\n.pane-head{ padding-bottom:10px; }',
    expected:'3ペインの一部が非表示になっている',
  },
  {
    name:'対応デスクと診断ボードのDOM順を入れ替える', file:'p1_head.html',
    from:deskPane + '\n\n' + boardPane,
    to:boardPane + '\n\n' + deskPane,
    expected:'3ペインのDOM順が対応デスク→診断ボード→待機状況ではない',
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
    from:'size + quietZone * 2', to:'size', all:true,
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
    name:'直近会話を3行へ戻す', file:'p4_view.js',
    from:'return player ? [player, customer] : [customer];',
    to:'return t.transcript.slice(Math.max(0, end - 3), end);',
    expected:'直近表示が「最新の顧客発話＋直前の自分」の最大2行ではない',
  },
  {
    name:'ヘッダへ氏名を戻す', file:'p4_view.js',
    from:'return \'<div class="call-head">\' +',
    to:'return \'<div class="call-head"><span class="cname">\' + esc(t.s.name) + \'</span>\' +',
    expected:'通話ヘッダにログへ移す情報が残っている: t.s.name',
  },
  {
    name:'ログから次の一手を消す', file:'p4_view.js',
    from:'<section class="record-system-block"><h3>次にできること</h3>',
    to:'<section class="record-system-block"><h3>案内なし</h3>',
    expected:'ログの4見出しが完全一致しない',
  },
  {
    name:'ログへ真因を出す', file:'p4_view.js',
    from:'return \'<div class="log-view">',
    to:'return \'<div class="log-view" data-correct=\' + esc(t.s.trueCause) + \'>',
    expected:'ログが真因または正解対処を参照している: trueCause',
  },
  {
    name:'質問区分を1列へ戻す', file:'p1_head.html',
    from:'grid-template-columns:repeat(2,minmax(0,1fr));',
    to:'grid-template-columns:1fr;', all:true,
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
    from:'<h3>次にできること</h3>', to:'<h3>次にできること_x</h3>',
    expected:'ログの4見出しが完全一致しない',
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
    expected:'オフィスの電話操作が受話・折り返しの2ボタンではない',
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
    name:'再着信をオフィス記録から外す', file:'p3_game.js',
    from:"recordOfficeEvent('redial', customerLabel(t, true) + 'から再着信しています。');", to:"void customerLabel(t, true);",
    expected:'再着信の情報が状態表示・会話メモ・無効理由へ移っていない',
  },
  {
    name:'AudioContextをシフト開始前に作る', file:'p4_view.js',
    from:"  $('btn-start').onclick = () => {\n    initAudio();", to:"  initAudio();\n  $('btn-start').onclick = () => {",
    expected:'AudioContextが「シフトを始める」操作の中で生成されない',
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
    from:'function playTypeSound(index){ if (index % 4) return;', to:'function playTypeSound(index){',
    expected:'タイプ音が1文字ごとではなく間引かれていない',
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
    from:'<b>まだ対応が終わっていません。このまま切りますか？</b>', to:'<b>まだ対応が終わっていません。このまま切りますか？_x</b>',
    expected:'未解決終話の確認文が完全一致しない',
  },
  {
    name:'1案件から雑談話題を外す', file:'p2_data.js',
    from:'  smalltalk:[', to:'  smalltalk_missing:[',
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
    from:'if (!spendOnCall(t, 1, 0)) return;', to:'if (!spendOnCall(t, 2, 0)) return;',
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
    expected:'運・音・1日件数・キャリアの初期GAME_FLAGSが確定値と違う',
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
    from:'const ordered = flags.shuffleArrival ?', to:'const ordered = false ?',
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
    expected:'シャッフル後に12案件の欠落・重複がある',
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
    expected:'運なしの同一操作列でCSATが決定論的な旧結果に戻らない',
  },
  {
    name:'誤診復旧の振り返り補正を外す', file:'p4_view.js',
    from:"else if (r.causeMatched === false) judge = '選んだ対応のあと通信は復旧し、一次解決になりました。'", to:"else if (false) judge = '選んだ対応のあと通信は復旧し、一次解決になりました。'",
    expected:'誤診から復旧した振り返りが原因・対処とも最適と誤表示する',
  },
  {
    name:'対処ラベルを終話表現へ戻す', file:'p4_view.js',
    from:'<span class="opt-label">対処を伝える<span class="opt-sub">', to:'<span class="opt-label">対応を決めて終える<span class="opt-sub">',
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
    from:"causes:Object.freeze(['hardware','provision','logistics','carrier','coverage']), satisfactionRate:0.5",
    to:"causes:Object.freeze(['hardware','provision','logistics','carrier','coverage']), satisfactionRate:0.6",
    expected:'会社側の返金満足率が50%ではない',
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
    from:"if (d.refund){ state.ui = defaultUi('refund_confirm'); render(); return true; }", to:"if (d.refund){ doRefund(); return true; }",
    expected:'返金が確認を挟まず実行される',
  },
  {
    name:'返金確認から終話明示を消す', file:'p4_view.js',
    from:'この電話はこれで終わります。', to:'返金を実行します。',
    expected:'返金確認に金額・終話の明示・確認ボタンが揃っていない',
  },
  {
    name:'返金費用を加算しない', file:'p3_game.js',
    from:'state.cost += REFUND_POLICY.amount;', to:'state.cost += 0;',
    expected:'満足した返金で2,400円が加算されない',
  },
  {
    name:'luckRate 1でも中立を満足させる', file:'p3_game.js',
    from:"if (GAME_FLAGS.luckRate === 1) return group === 'company';", to:"if (GAME_FLAGS.luckRate === 1) return group !== 'customer';",
    expected:'luckRate 1.0で会社側だけが返金に満足する決定論へ戻らない',
  },
  {
    name:'返金クリック監視を外す', file:'p5_events.js',
    from:',[data-refund]', to:'',
    expected:'返金ボタンが実行処理へ接続されていない',
  },
  {
    name:'満足返金CSATを4.0へ上げる', file:'p3_game.js',
    from:'csat:satisfied ? 3.0 : 1.0', to:'csat:satisfied ? 4.0 : 1.0',
    expected:'満足した返金のkind／satisfied／CSATが違う',
  },
  {
    name:'中立分類からsimを落とす', file:'p2_data.js',
    from:"causes:Object.freeze(['location','geo_block','sim'])", to:"causes:Object.freeze(['location','geo_block'])",
    expected:'中立の返金満足率が25%ではない',
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
    from:'const satisfied = refundSatisfied(t.s.trueCause);', to:'t.refunds = (t.refunds || 0) + 1;\n  const satisfied = refundSatisfied(t.s.trueCause);',
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
    from:'提携: T-Mobile US ✓',
    to:'提携: T-Mobile US ✓ ／ 運営: エクスコムグローバル',
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
    expected:'12シナリオの第一声が揃っていない',
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
    from:"callbackTo:'hotel',",
    to:"callbackTo:null,",
    expected:'§24/§25 案件データのcallbackToが揃っていない',
  },
  {
    name:'五夜勤を旧ラベルへ戻す', file:'p2_data.js',
    from:"id:'ten_nights', label:'五夜勤'", to:"id:'ten_nights', label:'十夜勤'",
    expected:'5シフト条件のバッジ名が「五夜勤」ではない',
  },
  {
    name:'現地キャリア照会を29分へ短縮する', file:'p2_data.js',
    from:"title:'現地キャリア照会', spoken:'現地キャリア側でも契約は有効で、開通状態に問題はありませんでした。', minutes:30, external:true",
    to:"title:'現地キャリア照会', spoken:'現地キャリア側でも契約は有効で、開通状態に問題はありませんでした。', minutes:29, external:true",
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
    expected:'§25 折り返し先の2択またはホテル確認条件がない',
  },
  {
    name:'折り返し先違いの判定を無効化する', file:'p3_game.js',
    from:'t.callbackDestination !== t.s.callbackTo', to:'false',
    expected:'§25 宛先違いの罰が戻っていない',
  },
  {
    name:'折り返し再接続から顧客発話を消す', file:'p3_game.js',
    from:"{ who:'cust', text:CALL_FLOW_LINES.callback.replies[t.s.type] },",
    to:"{ who:'note', text:CALL_FLOW_LINES.callback.replies[t.s.type] },",
    expected:'§25 折り返し再接続にオペレーターと顧客の発話が揃わない',
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
    from:"  t.state = 'callback';\n  state.focus = null;",
    to:"  t.state = 'callback';\n  state.tickets.filter(ticket => ticket !== t && ticket.state === 'waiting').forEach(ticket => { ticket.state = 'closed'; });\n  state.focus = null;",
    expected:'§25 折り返し中にほかの電話を取れない',
  },
  {
    name:'照会完了の記録なし発話を復活させる', file:'p2_data.js',
    from:"    completePrefix:'お待たせしました。確認結果は、',",
    to:"    completePrefix:'お待たせしました。確認結果は、',\n    miss:'該当する記録は確認できませんでした。',",
    expected:'§26 CALL_FLOW_LINES.lookup.missが残っている',
  },
  {
    name:'契約照会から顧客向けspokenを消す', file:'p2_data.js',
    from:"spoken:'契約は有効で、使用量も制限内でした。'",
    to:"spoken:''",
    expected:'§26 LOOKUPSの全項目に顧客向けspokenがない',
  },
  {
    name:'既定照会結果をそのまま顧客へ読み上げる', file:'p3_game.js',
    from:"const spokenSummary = r && r.fact ? r.fact.text : (r ? r.text : l.spoken);",
    to:"const spokenSummary = r && r.fact ? r.fact.text : (r ? r.text : l.defaultResult);",
    expected:'§26 案件固有結果なしでオペレーターがspokenを伝えない',
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
    from:'.system-screen .log-customer b,.system-screen .log-candidates b{ color:#78B8B3; }',
    to:'.system-screen .log-customer b,.system-screen .log-candidates b{ color:var(--dim); }',
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
    name:'途中切断後の再着信を閉じる', file:'p3_game.js',
    from:"  t.state = 'waiting';\n  t.arrivedTurn = state.turn;",
    to:"  t.state = 'closed';\n  t.arrivedTurn = state.turn;",
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
    from:"city:'バンコク', cityEn:'BANGKOK', localOffset:-2, device:'GD-500', plan:'タイ ／ 500MBプラン',\n  opening:'あの…地図が全然開かないんです。",
    to:"city:'架空都市', cityEn:'BANGKOK', localOffset:-2, device:'GD-500', plan:'タイ ／ 500MBプラン',\n  opening:'架空都市です。あの…地図が全然開かないんです。",
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
    from:'return ordered.slice(0, count).map((scenario, index) =>',
    to:'return Array(count).fill(ordered[0]).map((scenario, index) =>',
    expected:'日次案件の選択に重複がある',
  },
  {
    name:'未選択案件を世界地図へ戻す', file:'p4_view.js',
    from:'const pins = state.tickets.filter(t => t.destinationKnown).map(t => {',
    to:'const pins = SCENARIOS.filter(t => t.destinationKnown).map(t => {',
    expected:'渡航先未判明の待ちチケットが世界地図に現れる',
  },
  {
    name:'全件終了でも日報へ進めない', file:'p3_game.js',
    from:"if (!live){ playShiftEndSound(); state.phase = 'report'; renderReport(); }",
    to:"if (false){ playShiftEndSound(); state.phase = 'report'; renderReport(); }",
    expected:'2件の日を全件終えてもシフト終了レポートへ到達しない',
  },
  {
    name:'応答率を11件固定で割る', file:'p4_view.js',
    from:'const answerRate = (state.tickets.length - abandoned) / state.tickets.length;',
    to:'const answerRate = (state.tickets.length - abandoned) / 11;',
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
    from:'    \'<button class="opt" data-tell="try"><span class="command-no">2</span><span class="opt-label">やってみてもらう<span class="opt-sub">機器や端末で試していただくことを選びます。</span></span></button>\' +\n',
    to:'',
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
    from:"  pushFlowLines(t, [{ who:'me', text:CALL_FLOW_LINES.lookup.completePrefix + spokenSummary }]);",
    to:'  void spokenSummary;',
    expected:'社内照会の開始・完了・結果要約が発話で揃わない',
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
    name:'12案件でも表エンディングを開始しない', file:'p3_game.js',
    from:'career.solvedScenarios.length === SCENARIOS.length', to:'career.solvedScenarios.length > SCENARIOS.length',
    expected:'§28 12案件すべてを解決しても表エンディングへ進まない',
  },
  {
    name:'11案件で表エンディングを開始する', file:'p3_game.js',
    from:'career.solvedScenarios.length === SCENARIOS.length', to:'career.solvedScenarios.length >= SCENARIOS.length - 1',
    expected:'§28 11案件で表エンディングへ進む',
  },
  {
    name:'失客と不満返金も解決へ数える', file:'p3_game.js',
    from:"result.kind === 'closed' || (result.kind === 'refunded' && result.satisfied === true)",
    to:"['closed','complaint','hangup','abandoned'].includes(result.kind) || result.kind === 'refunded'",
    expected:'§28 解決・満足返金以外を数える、または同じ案件を重複して数える',
  },
  {
    name:'同じ案件をシフト内で重複して数える', file:'p3_game.js',
    from:'return [...new Set(tickets.filter(ticket => {', to:'return [...Array.from(tickets.filter(ticket => {',
    expected:'§28 解決・満足返金以外を数える、または同じ案件を重複して数える',
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
    from:"if (next === 'secret'){ showSecretEnding(false); return; }", to:"if (next === 'secret'){ resetGame(); showBriefing(); return; }",
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
    from:'<section class="ending-speech"><b>社長</b>', to:'<section class="ending-speech"><b>代表取締役</b>',
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
];

for (const mutation of mutations){
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
    const result = spawnSync(process.execPath, ['ui_contract_test.js'], { cwd:temp, encoding:'utf8' });
    const output = (result.stdout || '') + (result.stderr || '');
    assert.notEqual(result.status, 0, mutation.name + ': contract test stayed green');
    assert(output.includes(mutation.expected), mutation.name + ': wrong failure\n' + output);
    console.log('RED:', mutation.name, '→', mutation.expected);
  } finally {
    fs.rmSync(temp, { recursive:true, force:true });
  }
}

console.log('UI negative mutations:', mutations.length + '/' + mutations.length, 'red');
