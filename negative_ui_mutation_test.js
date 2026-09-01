/* §6-E の重要UI契約を意図的に壊し、ui_contract_test が赤になることを確認する。 */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const projectFiles = fs.readdirSync(__dirname).filter(name => !name.startsWith('.'));
const mutations = [
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
    from:'<section class="log-section"><h3>次にできること</h3>',
    to:'<section class="log-section"><h3>案内なし</h3>',
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
    name:'ストレス引き取り文へ接尾辞を足す', file:'p4_view.js',
    from:'お客様の苛立ちが限界に達し、上長が引き取りました。', to:'お客様の苛立ちが限界に達し、上長が引き取りました。_x',
    expected:'ストレス由来の振り返り文が完全一致しない',
  },
  {
    name:'電話を取る文言へ接尾辞を足す', file:'p1_head.html',
    from:'<b>電話を取る</b>', to:'<b>電話を取る_x</b>',
    expected:'「電話を取る」ボタンがない',
  },
  {
    name:'電話をかける文言へ接尾辞を足す', file:'p1_head.html',
    from:'<b>電話をかける</b>', to:'<b>電話をかける_x</b>',
    expected:'「電話をかける」ボタンがない',
  },
  {
    name:'着信文言へ接尾辞を足す', file:'p3_game.js',
    from:"toast('着信', '新しい着信です', '');", to:"toast('着信', '新しい着信です_x', '');",
    expected:'着信トーストが全件通常色ではない',
  },
  {
    name:'ネタバレ警告へ接尾辞を足す', file:'p4_view.js',
    from:'<strong>11件の真因と正解対処がすべて表示されます。</strong>', to:'<strong>11件の真因と正解対処がすべて表示されます。_x</strong>',
    expected:'調整コンソールを開く前のネタバレ警告が完全一致しない',
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
    expected:'運の初期GAME_FLAGSが確定値と違う',
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
    from:'const orderedScenarios = GAME_FLAGS.shuffleArrival', to:'const orderedScenarios = false',
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
    expected:'シャッフル後に11案件の欠落・重複がある',
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
    name:'会社側返金の符号を反転する', file:'p2_data.js',
    from:"causes:Object.freeze(['hardware','provision','logistics','carrier','coverage']), delta:-25, csat:0.4",
    to:"causes:Object.freeze(['hardware','provision','logistics','carrier','coverage']), delta:25, csat:0.4",
    expected:'会社側の返金分類・効果が確定値と違う',
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
    name:'返金2回目の式を変える', file:'p3_game.js',
    from:'let delta = effect.delta;\n  if (times > 0) delta = delta / 2 + 5;',
    to:'let delta = effect.delta;\n  if (times > 0) delta = delta / 2 + 4;',
    expected:'返金2回目がdelta/2+5にならない',
  },
  {
    name:'返金から運の反転を外す', file:'p3_game.js',
    from:"return flipReaction({ delta, scaled:false, csat:times > 0 ? 0 : effect.csat, reply:delta < 0 ? goodReply : badReply }, goodReply, badReply);",
    to:"return { delta, scaled:false, csat:times > 0 ? 0 : effect.csat, reply:delta < 0 ? goodReply : badReply };",
    expected:'会社側の返金が裏目で反対結果にならない',
  },
  {
    name:'返金2回目にもCSATを加点する', file:'p3_game.js',
    from:'csat:times > 0 ? 0 : effect.csat', to:'csat:effect.csat',
    expected:'返金2回目にもCSAT補正が累積する',
  },
  {
    name:'返金費用を初回だけにする', file:'p3_game.js',
    from:'state.cost += REFUND_POLICY.amount;', to:'if (!times) state.cost += REFUND_POLICY.amount;',
    expected:'返金費用が実行のたびに必ず加算されない',
  },
  {
    name:'返金クリック監視を外す', file:'p5_events.js',
    from:',[data-refund]', to:'',
    expected:'返金ボタンが実行処理へ接続されていない',
  },
  {
    name:'返金CSATを解決評価へ反映しない', file:'p3_game.js',
    from:'base += t.refundCsat || 0;', to:'base += 0;',
    expected:'返金のCSAT補正が解決時の評価へ反映されない',
  },
  {
    name:'中立分類からsimを落とす', file:'p2_data.js',
    from:"causes:Object.freeze(['location','geo_block','sim'])", to:"causes:Object.freeze(['location','geo_block'])",
    expected:'中立の返金分類・効果が確定値と違う',
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
    expected:'11シナリオの第一声が揃っていない',
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
    name:'1タイプの謝罪反応を欠落させる', file:'p2_data.js',
    from:"expert:Object.freeze({ brief:'承知しました。では、切り分けを続けてください。', accepted:",
    to:"expert:Object.freeze({ brief:'', accepted:",
    expected:'謝罪の受け止め方が4タイプ分揃っていない',
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
