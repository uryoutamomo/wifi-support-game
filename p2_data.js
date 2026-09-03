/* ============================================================
   データ定義
   ============================================================ */

const TURN_MIN = 1;          // 時間進行の最小単位＝ゲーム内1分
const SHIFT_START = 23 * 60; // 23:00 JST
const SHIFT_DURATION = 8 * 60;
const SHIFT_END = SHIFT_START + SHIFT_DURATION; // 翌07:00 JST
/* §52: 着信時刻は案件データではなく、この夜勤の器から引く。 */
const LAST_INBOUND_TURN = 7 * 60; // 06:00 までに最後の着信
const MIN_INBOUND_GAP = 20;
const ESCALATIONS = 3;       // 1シフトのエスカレーション枠
const LUCK_RATE = 0.9;       // 本来どおりに転ぶ確率
const CARRIER_REPLY_RATE = 0.8; // 現地キャリアから30分後に完了連絡が届く確率
const DESK_LOOKUP_MINUTES = 2;  // 折り返し待ちのあいだ、デスク端末で1件調べるのにかかる時間
/* §41: 通しプレイで調整できる、折り返しの約束と待機の基準。 */
const CALLBACK_SCHEDULED_MINUTES = 60;
const CALLBACK_IMMEDIATE_LOOKUP_ALLOWANCE = 1;
const CALLBACK_SCHEDULED_LOOKUP_ALLOWANCE = 2;
const CALLBACK_OVER_LOOKUP_STRESS = 10;
const CALLBACK_IDLE_STRESS = 8;
/* §53: 保留はその場で負担になる。こちらから掛けた電話で再び待たせるほうを重くする。 */
const HOLD_STRESS_PER_MINUTE = Object.freeze({ inbound:2, outbound:4 });
const ABANDON_REDIAL_LIMIT = 1;
const ABANDON_REDIAL_MIN_DELAY = MIN_INBOUND_GAP;
const ABANDON_REDIAL_STRESS = 24;
const CALLBACK_WAIT_REPLIES = Object.freeze({
  anxious:'ずっと待っていました…。何か進んだのでしょうか？',
  novice:'すみません、いつ戻るのか分からなくて不安でした。',
  expert:'照会の進捗を説明してください。これ以上、根拠なく待たせないでください。',
  hurried:'いつまで待たせるんですか。結論を。',
});
/* §49-1: 約束の時刻までに折り返して客室へつながったときの、満足度の回復。
   何に安心するかがタイプで違う。expert は約束を守るのを当然と見ているので小さい。
   遊んだ感触で動かせるよう、ここに集めてある。 */
const CALLBACK_PUNCTUAL_RELIEF = Object.freeze({ anxious:-14, novice:-12, hurried:-8, expert:-4 });
const CALLBACK_PUNCTUAL_REPLIES = Object.freeze({
  anxious:'…本当に掛け直してくださったんですね。少し、落ち着きました。',
  novice:'まあ、わざわざ掛けてくださって。ありがとうございます。',
  expert:'時間どおりですね。では続けてください。',
  hurried:'お、ちゃんと掛かってきた。じゃあ続き、頼みます。',
});
const GAME_FLAGS = {
  luckRate: LUCK_RATE,
  shuffleArrival: true,
  shuffleIdentity: true,
  dailyTickets: null,
  careerStage: null,
  unlockedBadges: null,
  solvedScenarios: null,
  soundEnabled: true,
  soundVolume: 0.55,
};

const REFUND_POLICY = Object.freeze({
  amount: 2400,
  company: Object.freeze({ causes:Object.freeze(['hardware','provision','logistics','carrier','coverage']), rejectionRate:0.05, satisfactionRate:0.5 }),
  customer: Object.freeze({ causes:Object.freeze(['fup','devices','heavy','device_side','device_net','power']), rejectionRate:0.2, satisfactionRate:0.1 }),
  neutral: Object.freeze({ causes:Object.freeze(['location','geo_block','sim']), rejectionRate:0.1, satisfactionRate:0.25 }),
});

const COMMAND_DEFS = Object.freeze([
  Object.freeze({ id:'ask',      no:'1', label:'聞く' }),
  Object.freeze({ id:'lookup',   no:'2', label:'調べる' }),
  Object.freeze({ id:'tell',     no:'3', label:'伝える' }),
  Object.freeze({ id:'record',   no:'4', label:'ログ' }),
]);

/* 壁に貼られた今月のスローガン。シフトを始めるたびに1つ選ばれる */
const SLOGANS = [
  '凡事徹底',
  'クイックレスポンス',
  '顧客目線',
  'たゆまぬベンチャーマインド',
  '上場まで1000日',
  'ボーリングのセンターピンを抑えろ',
];

/* 公開中のGitHub PagesをiPhoneで開くQR。1=黒、0=白。URL変更時は再生成する。 */
const ARTIFACT_URL = 'https://uryoutamomo.github.io/wifi-support-game/';
const ARTIFACT_QR_QUIET_ZONE = 4;
const ARTIFACT_QR = Object.freeze([
  '111111100011000000111111001111111',
  '100000100111100110101100001000001',
  '101110101101001010011110001011101',
  '101110101000100000100010101011101',
  '101110101000111111001101001011101',
  '100000101101111000110110001000001',
  '111111101010101010101010101111111',
  '000000001001001010011101000000000',
  '101111100110011001010010001111100',
  '011011001000111011011001001101101',
  '010101111000111111000110000010110',
  '110001001011110101111111000011101',
  '101001110011001010011011110011010',
  '111010000010000100100101001000011',
  '111111100011001110001100011101110',
  '001110001100010100100110011100100',
  '000010101101000101000011110110001',
  '000110001001000010110101011101101',
  '110100100110110100101110011110110',
  '011000000010001010011110111111110',
  '001110100101100000110001110011001',
  '110001010011100111001001111001001',
  '100001100010111000110110110001110',
  '101010000101101010111110010001100',
  '101011101100101001010010111111000',
  '000000001000110001011001100010101',
  '111111100111100101001011101010110',
  '100000101011001001101111100011111',
  '101110101110000110010100111111010',
  '101110101000010100100000010010111',
  '101110101000011110000010111101000',
  '100000100101100100000111000011100',
  '111111101011010101000011101101010',
]);

/* オフィスのCanvasドット絵で使う色。16色以内をデータ側で固定する。 */
const OFFICE_PALETTE = Object.freeze({
  ink:'#07111c', navy:'#102a43', blue:'#244b70', carpet:'#50677d', carpetShade:'#40566b',
  white:'#eef4f8', silver:'#c6d0d8', gray:'#8999a8', charcoal:'#263746', black:'#101820',
  glow:'#8fd7ff', amber:'#e2a447', paper:'#f5e9c9', red:'#c94f45',
});

/* 夜勤の記録はこの版だけを読み書きする。個人情報や会話本文は保存しない。 */
const CAREER_STORAGE_KEY = 'wifi-support-game:career:v1';
const CAREER_VERSION = 1;
const CAREER_STAGES = Object.freeze({
  probation:Object.freeze({ label:'試用期間', next:'本採用', condition:'通算3シフト、直近3シフトにD・Eなし' }),
  employed:Object.freeze({ label:'本採用', next:'リーダー', condition:'通算6シフト、直近3シフトがすべてB以上' }),
  lead:Object.freeze({ label:'リーダー', next:null, condition:'最上位。降格はありません' }),
});
const CAREER_BADGES = Object.freeze([
  Object.freeze({ id:'quiet_night', label:'静かな夜', condition:'全案件で満足度が一度も30%を下回らない' }),
  Object.freeze({ id:'no_redial', label:'一度でつながる', condition:'再入電0件・放棄呼0件' }),
  Object.freeze({ id:'frugal', label:'倹約家', condition:'返金と配送をどちらも使わない' }),
  Object.freeze({ id:'all_first', label:'一発解決', condition:'全案件を解決（再入電があってもよい）' }),
  Object.freeze({ id:'storm', label:'嵐の夜', condition:'同じ夜に苦情と一方的切断の両方が発生' }),
  Object.freeze({ id:'money_talks', label:'お金で解決', condition:'全案件で返金を実施' }),
  Object.freeze({ id:'ten_nights', label:'五夜勤', condition:'通算5シフトを完了' }),
  Object.freeze({ id:'clean_record', label:'無苦情記録', condition:'直近2シフトの苦情が0件' }),
]);
const PRESIDENT_ENDING_LINE = 'ハードワークご苦労様です。あなたが身を粉にして、お値段以上に顧客第一で働いてくれたことを感謝します。明日からもまた夜勤を頑張ってください';
const MORNING_STAFF = Object.freeze([
  Object.freeze({ x:24,  y:107, facing:'back', hair:'short', hairColor:'black',    coat:'blue',     shoulders:11 }),
  Object.freeze({ x:56,  y:105, facing:'back', hair:'long',  hairColor:'charcoal', coat:'navy',     shoulders:9 }),
  Object.freeze({ x:88,  y:110, facing:'back', hair:'bob',   hairColor:'gray',     coat:'red',      shoulders:10 }),
  Object.freeze({ x:121, y:106, facing:'back', hair:'short', hairColor:'charcoal', coat:'silver',   shoulders:12 }),
  Object.freeze({ x:38,  y:132, facing:'back', hair:'bob',   hairColor:'black',    coat:'amber',    shoulders:9 }),
  Object.freeze({ x:72,  y:135, facing:'back', hair:'short', hairColor:'gray',     coat:'charcoal', shoulders:13 }),
  Object.freeze({ x:108, y:130, facing:'back', hair:'long',  hairColor:'navy',     coat:'blue',     shoulders:10 }),
  Object.freeze({ x:143, y:136, facing:'back', hair:'short', hairColor:'black',    coat:'white',    shoulders:12 }),
  Object.freeze({ x:57,  y:158, facing:'back', hair:'long',  hairColor:'charcoal', coat:'red',      shoulders:10 }),
  Object.freeze({ x:99,  y:156, facing:'back', hair:'bob',   hairColor:'gray',     coat:'navy',     shoulders:11 }),
]);
const MORNING_OFFICE_PALETTE = Object.freeze({
  ink:'#27445b', navy:'#5f87a3', blue:'#9cc7df', carpet:'#92aebe', carpetShade:'#7898aa',
  white:'#fffdf1', silver:'#e5edf0', gray:'#a9bbc3', charcoal:'#385263', black:'#172733',
  glow:'#fff3a3', amber:'#f0b84d', paper:'#fff8d7', red:'#d45d57',
});

/* 同じ島型デスクを共有する6席。自席のモニターだけが点灯する。 */
const OFFICE_STATIONS = Object.freeze([
  Object.freeze({ x:25,  y:82,  scale:1, active:false, facing:'back' }),
  Object.freeze({ x:78,  y:82,  scale:1, active:false, facing:'back' }),
  Object.freeze({ x:131, y:82,  scale:1, active:false, facing:'back' }),
  Object.freeze({ x:25,  y:122, scale:1, active:false, facing:'front' }),
  Object.freeze({ x:78,  y:122, scale:1, active:true,  facing:'front' }),
  Object.freeze({ x:131, y:122, scale:1, active:false, facing:'front' }),
]);

/* ---------- 原因マスタ（診断ボードに常時並ぶ） ---------- */

const CAUSES = [
  { id:'fup',        tier:'確定', label:'データ容量の上限到達による速度制限' },
  { id:'devices',    tier:'確定', label:'同時接続台数の上限超過' },
  { id:'geo_block',  tier:'確定', label:'渡航先の通信規制（特定サービスのみ不通）' },
  { id:'heavy',      tier:'有力', label:'一部端末の大容量通信による帯域の圧迫' },
  { id:'device_side',tier:'有力', label:'端末側に保存されたWi-Fi情報の不整合' },
  { id:'device_net', tier:'有力', label:'端末側のVPN／DNS／プロファイル設定' },
  { id:'location',   tier:'有力', label:'電波の届きにくい場所（地下・建物構造）' },
  { id:'power',      tier:'有力', label:'充電・電源まわり（ケーブル／アダプタ／過熱）' },
  { id:'carrier',    tier:'要ESC', label:'現地キャリアの広域障害' },
  { id:'coverage',   tier:'要ESC', label:'契約の対象エリア外／機種と地域の不一致' },
  { id:'sim',        tier:'確定', label:'SIM未認識（接点の汚れ／装着不良）' },
  { id:'hardware',   tier:'要ESC', label:'本体の機器故障（SIMリーダー／基板）' },
  { id:'provision',  tier:'要ESC', label:'事業者側の回線開通設定の不備' },
  { id:'logistics',  tier:'他部署', label:'技術以外の案件（受取・返却・請求）' },
];

/* ---------- 顧客タイプと伝え方 ---------- */

const TYPES = {
  anxious: { label:'不安が強い', tone:'warm', note:'落ち着いて、噛み砕いた言葉で。', stressStart:20, stressRate:1.2, missRate:1.0, sootheReply:'…本当に、戻るんですね。すみません…お願いします。', sootheMissReply:'でも、まだ何も戻っていなくて…怖いんです。', sootheRepeatReply:'さっきも同じ言葉で…。本当に置いていきませんよね？', solvedReply:'あ、つながりました…！ 何が原因だったのかも教えていただけますか？', refundRejectReply:'返金だけでは、この先も使えないままですよね…。お金ではなく、つながるようになるまで助けてください。',
    irritated:['あの…このまま全部だめになったりしませんよね？', 'すみません、手が震えてきて…。'],
    angry:['もう無理です…私、何か壊したんでしょうか？', 'お願いです、置いていかないでください。泣きそうです…。'],
    furious:['もう限界です…誰か、最後まで助けてください…！', '責任者の方に代わってください。私、このままでは話せません…。'] },
  novice:  { label:'機器に不慣れ', tone:'warm', note:'専門用語は通じない。手順は一つずつ。', stressStart:5, stressRate:0.9, missRate:1.0, sootheReply:'あ、はい…私にもできるよう、一つずつお願いできますか。', sootheMissReply:'すみません、その説明もよく分からなくて…。', sootheRepeatReply:'同じことを言われても、次に押す所が分からないんです…。', solvedReply:'まあ、つながりました！ 何が起きていたのかも教えてください。', refundRejectReply:'返金のお話より、使えるようにしていただきたいんです。まだ何をすればいいか教えてください。',
    irritated:['あの、その言葉が分からなくて…すみません。', '私、また違う所を押しましたか…？'],
    angry:['やっぱり私には無理なんですね…。', '何度も聞いてごめんなさい。もう手が動かなくて…。'],
    furious:['すみません、もう怖くて触れません。どなたか代わってください。', '私が壊したのでしょうか…。契約を続ける自信がありません。'] },
  expert:  { label:'技術に明るい', tone:'technical', note:'噛み砕きすぎると、軽く扱われたと感じる。', stressStart:5, stressRate:1.0, missRate:2.0, sootheReply:'整理は妥当です。その順で進めてください。', sootheMissReply:'安心の話ではなく、仮説と観測結果を示してください。', sootheRepeatReply:'同じ説明は不要です。検証結果を更新してください。', solvedReply:'通信復旧を確認しました。原因と再発時の対応を説明してください。', refundRejectReply:'返金提案は受けません。利用可能な状態への復旧を優先し、切り分けを続けてください。',
    irritated:['その質問は、どの仮説を切るためですか。', '先ほどの観測結果と重複しています。'],
    angry:['切り分けの順序が逆です。根拠を示してください。', 'その説明では一次障害と端末要因を区別できません。'],
    furious:['これ以上は検証になりません。責任者へ引き継いでください。', 'この品質なら、契約継続は再検討します。記録を残してください。'] },
  hurried: { label:'急いでいる', tone:'brief', note:'前置きは邪魔。結論から短く。', stressStart:15, stressRate:1.6, missRate:1.3, sootheReply:'分かった。次。結論から。', sootheMissReply:'落ち着く話は後。結論を。', sootheRepeatReply:'それは聞いた。次へ。', solvedReply:'復旧した。原因だけ短く説明して。', refundRejectReply:'返金は要らない。今つながる方法を出して。対応を続けてください。',
    irritated:['あと何分？ バス、もう着きます。', '前置きはいい。次は？'],
    angry:['その話、後。結論を言って。', '時計見てます？ 次の予定が迫ってる。急いで。'],
    furious:['もう待てない。責任者に代わって。今。', 'ここで終わらせる。解約の手順だけ言って。'] },
};

/* 怒りが限界に達した通話の終わり方と、翌日に届く苦情メール。 */
const ANGRY_DEFAULT_OUTCOMES = Object.freeze({
  anxious:'hangup',
  novice:'complaint',
  expert:'complaint',
  hurried:'hangup',
});

const ANGRY_END_LINES = Object.freeze({
  anxious:Object.freeze({
    complaint:'もう限界です…。この対応について、あとで正式に連絡します。',
    hangup:'もう無理です…。これ以上お話しできません。',
  }),
  novice:Object.freeze({
    complaint:'私にはもう分かりません。この対応は、あとで相談させてください。',
    hangup:'すみません、もう怖いので切ります。',
  }),
  expert:Object.freeze({
    complaint:'この対応品質は正式に問題として連絡します。記録を残してください。',
    hangup:'これ以上の通話に意味はありません。ここで切ります。',
  }),
  hurried:Object.freeze({
    complaint:'もう時間切れ。この対応はあとで正式に連絡する。',
    hangup:'もう待てない。切る。',
  }),
});

/* 通話の継ぎ目を埋める短い発話。1回の追加は最大2行に制限する。 */
const CALL_FLOW_LINES = Object.freeze({
  ending:Object.freeze({
    refundSatisfied:'ご理解いただき、ありがとうございます。失礼いたします。',
    refundDissatisfied:'重ねてお詫び申し上げます。失礼いたします。',
    complaint:'申し訳ございません。いただいたご意見は必ず——',
    hangup:'お客様……？ 申し訳ございません、失礼いたします。',
  }),
  misdiagnosis:Object.freeze({
    failure:'言われたとおりにしましたが、やっぱり直りません。',
    apology:'申し訳ございません。もう一度、確認させてください。',
  }),
  /* §45: 折り返しは「約束」と「切る」に分かれる。約束しただけでは通話は終わらない。 */
  callbackPromise:Object.freeze({
    immediate:'すぐにこちらから掛け直します。いまの通話はいったん切らせてください。',
    scheduled:'1時間ほどお時間をいただいて、確認のうえ掛け直します。',
    consent:'分かりました。では、お待ちしています。',
    note:'折り返しをお約束しました。切る前に、折り返し先とお戻りの時間を確認できます。',
    headImmediate:'折り返し約束済み（すぐに）',
    headScheduled:'折り返し約束済み（1時間後）',
    guide:'折り返しをお約束しました。「電話を切る」で、こちらから掛け直します。',
    guideNoReturn:'お戻りの時間を伺っていません。フロントで確認の手間が増えます。',
  }),
  callback:Object.freeze({
    normal:'お待たせしました。先ほどの件でお電話しました。',
    late:'お約束の時刻を過ぎてしまい、申し訳ございません。先ほどの件です。',
    wrongMobile:'携帯へおかけしたため、通話料が発生します。申し訳ございません。',
    wrongHotel:'ホテルへ誤っておかけしました。お待たせして申し訳ございません。',
    lateWrongMobile:'お約束より遅れ、携帯の通話料も発生します。申し訳ございません。',
    lateWrongHotel:'お約束より遅れ、ホテルへも誤っておかけしました。申し訳ございません。',
    replies:Object.freeze({
      anxious:'はい、待っていました。状況を教えてください。',
      novice:'はい、ありがとうございます。続きもお願いします。',
      hurried:'はい。待ってました。結論からお願いします。',
      expert:'はい。調査結果をお願いします。',
    }),
    promise:'通話料のご負担を止めるため、いったんお切りして、こちらからホテルへ折り返してもよろしいですか。',
    consent:'はい、ホテルで待っています。お願いします。',
    /* 滞在先を聞かないまま切ると、折り返す先がない。客が自分から掛け直してくる。 */
    noAddressNote:'滞在先を確認しないまま通話を切りました。折り返す先がありません。',
    blameOpenings:Object.freeze({
      anxious:'待っていたのに、電話が来ないんです…。ホテルの名前も聞かれていないのに、どこへかけるつもりだったんですか…？',
      novice:'あの、いくら待ってもお電話が鳴らなくて…。私、宿の名前をお伝えしましたでしょうか。聞かれていない気がして…。',
      hurried:'折り返すと言って切ったのに、来ませんでしたよね。ホテルも聞かずにどこへかけたんですか。時間を返してください。',
      expert:'折り返しの連絡先を取得しないまま切断していますね。滞在先の確認は折り返しの前提条件のはずです。掛け直したのはこちらです。',
    }),
  }),
  callChargeConcern:Object.freeze({
    anxious:'海外からの通話料が心配で…。このまま長くなっても大丈夫でしょうか。',
    novice:'この電話、海外からなので料金がかかりますよね。まだ長くなりますか？',
    hurried:'もう5分超えてます。国際電話代もあるので、長引くなら折り返してください。',
    expert:'国際通話が5分を超えています。以降はホテルへの折り返しに切り替えられますか。',
  }),
  frontDesk:Object.freeze({
    greeting:'Good evening, this is the front desk. How may I help you?',
    lateQuestion:"It's quite late here. May I ask what this is regarding?",
    connect:'I see. One moment, please.',
    delayedConnect:"I understand. It's quite late, but I'll connect you this time. One moment, please.",
    options:Object.freeze({
      guest:"I'd like to speak with a guest, Mr./Ms. {name}.",
      room:'Could you connect me to room {room}?',
      callback:'This is a callback. The guest called us earlier.',
    }),
  }),
  carrier:Object.freeze({
    promise:'現地キャリアへ回線の再開通を依頼します。30分ほどかかりますので、いったんお切りして、完了状況が分かり次第お電話してもよろしいですか。',
    consent:'分かりました。お願いします。',
    reopenedReplies:Object.freeze({
      anxious:'あ、さっきから使えてます…！ もう駄目かと思いました。直してくださって、本当にありがとうございます。',
      novice:'あ、さっきから使えてます！ もうつながっています。直してくださって、本当にありがとうございます。',
      hurried:'あ、さっきから使えてます。直りました、ありがとう。原因だけ教えてください。',
      expert:'先ほどから疎通が戻っています。再開通を確認しました。対応ありがとうございます。原因をご説明ください。',
    }),
    pendingReplies:Object.freeze({
      anxious:'まだつながっていません…。返事も来なかったんですね。もう一度お願いするか、ほかの方法はありますか。',
      novice:'まだ圏外のままです…。連絡が来なかったのですね。もう一度お願いできますか。',
      hurried:'まだ圏外。返事なしですね。再依頼か返金か、次を決めてください。',
      expert:'疎通は戻っていません。先方から完了連絡もないなら、再依頼または代替案を提示してください。',
    }),
  }),
  lookup:Object.freeze({
    holdStart:'確認いたしますので、少々お待ちください。',
    talkStart:'お話ししながら確認いたしますね。',
    /* 照会結果は端末に出るだけで、客へ話すかどうかはオペレーターが決める。
       保留を解いた合図だけを返し、中身は「伝える」で自分が選ぶ。 */
    holdComplete:'お待たせしました。確認が取れました。',
    talkComplete:'ありがとうございます。こちらでも確認が取れました。',
  }),
  recordStart:'少し記録を確認させてください。',
  interrupt:'申し訳ございません、一度お切りします。',
  redialGreeting:'先ほどは通話が切れてしまい、申し訳ございません。',
  abandonedRedialOpenings:Object.freeze({
    anxious:'さっきはつながらなくて…また掛けてしまってすみません。でも、まだ困っています。',
    novice:'お忙しいところすみません。さっき切れてしまって、どうしたらいいか分からなくて…。',
    expert:'先ほどは接続できませんでした。継続して利用不能です。今回は対応してください。',
    hurried:'さっきから掛けています。今度こそ、すぐ結論をお願いします。',
  }),
  unverifiable:Object.freeze({
    closing:Object.freeze({
      anxious:'分かりました…。では、ご連絡を待っています。どうか早く戻りますように。',
      novice:'分かりました。では、そのご連絡を待っていますね。',
      expert:'承知しました。引き継ぎ結果と対応予定を記録してください。',
      hurried:'分かった。結果が出たらすぐ連絡して。',
    }),
    redial:Object.freeze({
      anxious:'待っていたのに、まだ使えません…。どうしてそのままなんですか？',
      novice:'連絡を待っていたのに、まだ使えないままです。どうしたらいいですか？',
      expert:'引き継ぎ後も事象は継続しています。対応状況と次の手を説明してください。',
      hurried:'待ったのにまだ使えない。引き継ぎ先は何をしてる？',
    }),
    noSignal:Object.freeze({
      anxious:'画面は…まだ圏外のままです。これは直ったんでしょうか？',
      novice:'画面がまだ圏外のままです。これで大丈夫なんでしょうか？',
      expert:'表示は依然として圏外です。復旧の成否はどのように確認すべきですか。',
      hurried:'まだ圏外表示です。これ、復旧したの？',
    }),
  }),
  resolved:Object.freeze({
    best:'復旧をご確認いただき、ありがとうございます。',
    partial:'ご不便を残しますが、この方法でお願いいたします。',
    recovered:'復旧を確認できました。ご協力ありがとうございました。',
  }),
});

const COMPLAINT_EMAIL_TEMPLATES = Object.freeze({
  anxious:Object.freeze({ lines:Object.freeze(['「{symptom}」とお伝えしたのに、不安なまま通話を終えることになりました。', '海外で一人取り残されたようで、本当に怖かったです。最後まで安心できる説明をしてほしかったです。']) }),
  novice:Object.freeze({ lines:Object.freeze(['「{symptom}」と相談しましたが、説明が難しく、何をすればよいのか最後まで分かりませんでした。', '機械に詳しくない人にも分かるよう、一つずつ案内していただきたかったです。']) }),
  expert:Object.freeze({ lines:Object.freeze(['「{symptom}」という事象に対し、仮説と観測結果の対応が示されないまま終話となりました。', 'この切り分け品質は看過できません。対応記録を確認し、根拠を明示して回答してください。']) }),
  hurried:Object.freeze({ lines:Object.freeze(['「{symptom}」と急ぎで伝えたのに、結論が出ないまま大切な予定に間に合いませんでした。', '前置きではなく必要な対応をすぐ示すべきです。失った時間をどう考えているのか回答してください。']) }),
});

/* §53: 原因を確かめない返金は、金銭より復旧を求めていた顧客から必ず苦情になる。 */
const BLIND_REFUND_EMAIL_TEMPLATES = Object.freeze({
  anxious:Object.freeze({ lines:Object.freeze(['通信を使えるようにしてほしかったのに、原因も今後の案内もないまま返金だけで終わりました。', '海外でまだ困っています。お金ではなく、どうすれば使えるのかを説明してください。']) }),
  novice:Object.freeze({ lines:Object.freeze(['使えるようにしてほしくて相談したのに、何が悪かったのか分からないまま返金だけで終わりました。', '次に何をすればよいのか、私にも分かるように教えてください。']) }),
  expert:Object.freeze({ lines:Object.freeze(['原因仮説も復旧方針も示されないまま、返金だけで終話されました。', '金銭処理は障害解決ではありません。観測結果に基づく原因と次の対応を回答してください。']) }),
  hurried:Object.freeze({ lines:Object.freeze(['必要だったのは通信の復旧です。原因も次の手も示さず、返金だけで終わらせないでください。', 'まだ使えません。結論と対応をすぐ連絡してください。']) }),
});


/* §50-3: 誤診で解決した案件は、その場では感謝されている。翌日、同じことが再発して
   初めて発覚する。怒って終わったときとは書き出しから違う。 */
const MISDIAGNOSIS_EMAIL_TEMPLATES = Object.freeze({
  anxious:Object.freeze({ lines:Object.freeze(['昨夜はありがとうございました。あのときは本当に助かって、やっと眠れたんです。', 'それが今朝、また「{symptom}」と同じことになってしまって…。原因が違ったということでしょうか。せっかく安心できたのに、また怖くなっています。']) }),
  novice:Object.freeze({ lines:Object.freeze(['昨日は丁寧に教えてくださって、ありがとうございました。あのときは直ったと思ったんです。', 'ところが今日また「{symptom}」なんです。私がまた何か間違えたのでしょうか。それとも、直っていなかったのでしょうか。']) }),
  expert:Object.freeze({ lines:Object.freeze(['昨夜の対応で通信は復旧しましたが、本日同一事象が再発しました。「{symptom}」と同じ状態です。', '症状が消えただけで、原因の切り分けが誤っていたと判断します。対症で終わらせず、根本原因の再調査を求めます。']) }),
  hurried:Object.freeze({ lines:Object.freeze(['昨日はどうも。あのときは繋がったので、そのまま予定に向かえました。', 'で、今日また同じです。「{symptom}」。直ってなかったってことですよね。今度は原因まで突き止めてください。']) }),
});

/* §50-4: うまくやった夜にだけ届く。半分の確率でしか来ないので、来たときは嬉しい。
   何が嬉しかったかはタイプで違う。 */
const GRATITUDE_EMAIL_TEMPLATES = Object.freeze({
  anxious:Object.freeze({ lines:Object.freeze(['昨夜は本当にありがとうございました。「{symptom}」と申し上げたとき、頭が真っ白でした。', '落ち着いて聞いてくださって、原因まで教えていただけたので、もう怖くありません。旅の続きを楽しめます。あの時間に働いてくださる方がいることに、救われました。']) }),
  novice:Object.freeze({ lines:Object.freeze(['昨日はお世話になりました。機械のことが分からない私に、一つずつ教えてくださいましたね。', '「{symptom}」がなぜ起きたのかまで分かって、本当に安心しました。同じ旅行の方にも、こちらの会社をお勧めしておきました。']) }),
  expert:Object.freeze({ lines:Object.freeze(['昨夜の対応について記録を残します。「{symptom}」に対し、切り分けの順序が適切で、無用な操作を求められませんでした。', '原因の説明も観測結果と整合しており、再発時の判断材料になります。この品質であれば継続利用します。担当者へ評価が伝わることを望みます。']) }),
  hurried:Object.freeze({ lines:Object.freeze(['昨日は助かりました。正直、あの時間で直るとは思っていませんでした。', '「{symptom}」の原因も一言で分かったので、予定に間に合いました。手短で的確でした。またよろしく。']) }),
});

/* §50-4: 感謝が届く確率。調整コンソールで運を切る（luckRate 1.0）と必ず届く。 */
const GRATITUDE_RATE = 0.5;

/* §51-3: 解決したあとに名前を伺ったときの答え。用は済んでいるので、怒っていた客も
   答える。ただし hurried は最後まで急いでいる。 */
const LATE_NAME_REPLIES = Object.freeze({
  anxious:'すみません、名乗るのも忘れていました。{name}です。',
  novice:'あら、そういえば申し上げていませんでしたね。{name}と申します。',
  expert:'{name}です。記録に残すのであれば、先に伺うべきでしたね。',
  hurried:'{name}。じゃあ切りますよ。',
});

/* ---------- 質問プール ---------- */

const QUESTIONS = [
  { id:'q_name', label:'恐れ入ります、お名前をフルネームでうかがえますか', miss:'…名前ですか。えっと、それ、いま必要ですか？' },
  { id:'q_destination', label:'いま、どちらの国・都市にいらっしゃいますか', miss:'さっき申し上げたと思うんですけど。' },
  { id:'q_contract', label:'ご予約番号（契約番号）はお手元にございますか', miss:'番号ですか…すみません、いますぐには分からなくて。' },
  { id:'q_other_device', label:'ほかの端末でも同じ状態ですか？', needsDevice:true,
    miss:'ええと…ほかの端末は、いま試せる状況になくて。' },
  { id:'q_lamp', label:'本体の画面表示とアンテナの状態を教えてください', needsDevice:true,
    miss:'見てみます…とくに変わったところはないと思うんですけど。' },
  { id:'q_ssid', label:'Wi-Fiの一覧に、ルーターの名前は出ていますか？', needsDevice:true,
    miss:'名前は出ています。そこは問題なさそうです。' },
  { id:'q_when', label:'いつ、どのような状況で気づかれましたか？',
    miss:'いつから、と言われると…気づいたらこうなっていた感じで。' },
  { id:'q_count', label:'いま何台つないでいらっしゃいますか？', needsDevice:true,
    miss:'台数ですか。そんなに繋いでいないと思います。' },
  { id:'q_where', label:'いま、どのような場所にいらっしゃいますか？',
    miss:'普通の建物の中です。とくに変わった場所ではないです。' },
  { id:'q_moved', label:'別の場所でも試されましたか？', needsDevice:true,
    miss:'いえ、そこまではまだ試していないです。' },
  { id:'q_battery', label:'本体のバッテリー残量はどのくらいですか？', needsDevice:true,
    miss:'半分くらいはあります。電池は大丈夫そうです。' },
  { id:'q_what_fails', label:'開けないのは特定のサービスだけですか、全部ですか？', needsDevice:true,
    miss:'全部です。特定のものだけ、ということはないです。' },
  { id:'q_stay', label:'ご滞在先（ホテル名とお部屋番号）を教えてください',
    miss:'ホテルですけど…それが何か関係あるんでしょうか。' },
  { id:'q_stay_length', label:'あと何日ほどご滞在の予定ですか',
    miss:'日程ですか。すぐには確認できません。' },
  { id:'q_replacement', label:'代替機の配送をご希望ですか',
    miss:'代替機ですか。配送条件を先に教えてください。' },
  /* §45: 折り返しを約束したあとにだけ出る。約束前は意味がないので表示しない。 */
  { id:'q_return', label:'何時ごろお部屋にお戻りになりますか', needsCallbackPromise:true,
    miss:'戻る時間ですか。はっきりとは決めていません。' },
];

const QUESTION_GROUPS = Object.freeze([
  Object.freeze({ id:'customer', no:'1', label:'顧客のこと', questionIds:Object.freeze(['q_name','q_contract','q_stay','q_stay_length','q_replacement','q_return']) }),
  Object.freeze({ id:'local', no:'2', label:'現地のこと', questionIds:Object.freeze(['q_destination','q_where','q_moved']) }),
  Object.freeze({ id:'device', no:'3', label:'本体のこと', questionIds:Object.freeze(['q_lamp','q_battery','q_ssid']) }),
  Object.freeze({ id:'symptom', no:'4', label:'症状のこと', questionIds:Object.freeze(['q_other_device','q_when','q_count','q_what_fails']) }),
]);

const SOOTHES = [
  { id:'s_wait', label:'お手数をおかけしております。いま確認しておりますので、もう少しだけお時間をください', base:-12 },
  { id:'s_apology', label:'今夜中に使える状態にします。解決まで責任を持って確認いたします', base:-15 },
  { id:'s_recap', label:'ここまでを整理しますと、集めた手がかりから順に確認しております', base:-18, needsFacts:3 },
];
const SOOTHE_EFFECTS = { anxious:{s_wait:-12,s_apology:-22,s_recap:-18}, novice:{s_wait:-12,s_apology:-15,s_recap:-25}, hurried:{s_wait:-18,s_apology:-5,s_recap:-10}, expert:{s_wait:-8,s_apology:3,s_recap:-25} };
const SMALLTALK_EFFECTS = Object.freeze({ anxious:-10, novice:-12, hurried:14, expert:6 });
const IDENTITY_CALMING_EFFECTS = Object.freeze({ anxious:-10, novice:-8, hurried:-4, expert:0 });
const IDENTITY_RECORD_PENALTY = 0.4;

const APOLOGIES = Object.freeze([
  Object.freeze({ id:'a_brief', label:'ご不便をおかけして申し訳ございません', minutes:1, kind:'brief' }),
  Object.freeze({ id:'a_deep', label:'大切なご旅行中に通信を止めてしまい、誠に申し訳ございません。最後まで責任を持って対応いたします', minutes:2, kind:'deep' }),
]);
const APOLOGY_REPLIES = Object.freeze({
  anxious:Object.freeze({ brief:'…ありがとうございます。声が震えてしまって…お願いします。', accepted:'そこまで言ってくださるなら…信じます。お願いします。', repeated:'お気持ちは分かりました…。それより、もう置いていかないでください。', excessive:'そんなに謝られると、もっと怖くなります…。確認を進めてください。' }),
  novice:Object.freeze({ brief:'いえ、こちらこそ何度もすみません。ゆっくりお願いします。', accepted:'そこまでしていただくなんて…。では、どうぞお願いします。', repeated:'もう十分です。私にもできる手順を教えていただけますか。', excessive:'私が悪いのかと思ってしまいます…。普通に教えてください。' }),
  expert:Object.freeze({ brief:'承知しました。では、切り分けを続けてください。', accepted:'責任範囲は理解しました。具体的な確認へ進めてください。', repeated:'謝罪は記録しました。次は根拠と対応を示してください。', excessive:'その深さの謝罪は不要です。事実確認を優先してください。' }),
  hurried:Object.freeze({ brief:'分かった。次へ。', accepted:'了解。なら最後まで頼みます。急いで。', repeated:'謝罪はもういい。対応して。', excessive:'大ごとにしなくていい。早く進めて。' }),
});

const FAREWELL_LINES = Object.freeze({
  best:Object.freeze({
    anxious:'本当に戻った…！ 最後までいてくださって、ありがとうございました。',
    novice:'まあ、私にもできました。何度も丁寧に、ありがとうございました。',
    hurried:'直った。間に合う。ありがとう。',
    expert:'復旧を確認しました。切り分けも妥当でした。ありがとうございます。',
  }),
  partial:'…分かりました。まだ心配ですが、その方法で様子を見ます。',
  poor:'……承知しました。これ以上は結構です。',
});
const REDIAL_OPENINGS = Object.freeze({
  calm:'あの…切れましたよね？ 私、置いていかれたのかと思って…。',
  direct:'いま切りましたね。理由を短く説明してください。',
});
const REDIAL_STRESS = 25;
/* 折り返すと約束しながら連絡先を持たずに切ったときの重さ。単なる切断より重い。 */
const BLIND_CALLBACK_STRESS = 35;
const BLIND_CALLBACK_CSAT_PENALTY = 1.5;

/* ---------- 社内照会プール ---------- */

const LOOKUPS = [
  { id:'l_plan',    label:'契約プランとデータ使用量を照会', title:'契約照会', spoken:'契約は有効で、使用量も制限内でした。', defaultResult:'[契約照会] 契約: 有効 ／ 使用量: 制限内 ／ 速度制限なし' },
  { id:'l_session', label:'ルーターの接続セッション履歴を照会', title:'セッション履歴', spoken:'直近の接続履歴に異常はなく、SIMも正常に認識されています。', defaultResult:'[セッション] 直近の異常イベントなし。SIM認識 正常。' },
  { id:'l_outage',  label:'現地キャリアの障害情報を確認', title:'障害情報', spoken:'該当エリアの提携キャリアに、障害報告はありませんでした。', defaultResult:'[障害情報] 該当エリアの提携キャリア 障害報告なし。' },
  { id:'l_area',    label:'渡航先の対応エリアと機種対応を確認', title:'エリア照会', spoken:'渡航先は対応地域内で、貸出機種も対応しています。', defaultResult:'[エリア照会] 渡航先: 対応地域内 ／ 貸出機種: 対応 ✓' },
  { id:'l_ship',    label:'貸出・返却・配送の記録を照会', title:'貸出記録', spoken:'貸出と返却の記録に問題はなく、特記事項もありませんでした。', defaultResult:'[貸出記録] 通常の貸出。受取済み・返却期限内。特記事項なし。',
    missFact:{ text:'貸出・返却に問題はなく、物流側の案件ではない', out:['logistics'] } },
  { id:'l_carrier', label:'現地キャリアへ回線の再開通を依頼する', title:'現地キャリアへの再開通依頼', spoken:'現地キャリアへ再開通を依頼しました。', minutes:30, external:true,
    defaultResult:'[現地キャリア] 再開通依頼を受け付けました ／ 完了連絡待ち',
    missFact:{ text:'現地キャリア側でも回線契約は有効で、開通設定の不備はない', out:['provision'] } },
];

/* ---------- 低リスク操作（通話をつないだまま実行） ---------- */

const TESTS = [
  { id:'t_reboot',     label:'ルーターの再起動をご案内する', turns:3, wait:'再起動をお願いしました。立ち上がるまで少しかかります。', needsDevice:true },
  { id:'t_simout',     label:'SIMを抜き差しし、接点を乾いた柔らかい布で清掃していただく', turns:2,
    wait:'電源はそのままで、SIMの抜き差しと接点の清掃をお願いしました。', sub:'No SIM／SIM未認識の表示があるときの重要な復旧操作', needsDevice:true },
  { id:'t_forget',     label:'端末のWi-Fi設定を一度削除して、繋ぎ直していただく', turns:3, wait:'設定の削除と再接続をお願いしました。操作していただいています。', needsDevice:true },
  { id:'t_move',       label:'窓際か屋外へ移動して試していただく', turns:4, wait:'場所を移っていただいています。', needsDevice:true },
  { id:'t_disconnect', label:'使っていない端末をWi-Fiから切っていただく', turns:2, wait:'不要な端末を切っていただいています。', needsDevice:true },
  { id:'t_charge',     label:'付属のケーブルとアダプタで充電していただく', turns:5, wait:'充電をお願いしました。しばらく様子を見ます。', needsDevice:true },
];

/* 危険な操作。選べるが、初手の正解にはならない */
const RISKY = [
  { id:'t_reset', label:'本体を初期化（工場出荷リセット）していただく', turns:2, needsDevice:true,
    wait:'初期化をお願いしました。',
    result:'（操作後）…あの、画面が英語だらけになって、何も繋がらなくなりました。前より悪くなってませんか？',
    note:'初期化で回線設定ごと飛んだ。サポート側の指示なく客に踏ませてよい操作ではない。', damage:1.5 },
  { id:'t_apn', label:'スマートフォンのAPN設定を書き換えていただく', turns:2, needsDevice:true,
    wait:'端末のAPN設定を開いていただいています。',
    result:'（操作後）言われたとおり入れましたけど、何も変わりません。元の設定も分からなくなりました。',
    note:'レンタルWiFiのAPNはルーター内のSIM側の設定で、客のスマホには関係がない。手元の端末を壊しただけ。', damage:1.5 },
  { id:'t_roaming', label:'端末のデータローミングをONにしていただく', turns:1, needsDevice:true,
    wait:'端末のデータローミング設定を確認していただいています。',
    result:'（操作後）ONにしました。…変わりません。というか、これ日本の携帯代がかかったりしませんか？',
    note:'データローミングは自分のキャリア回線を海外で使う設定。Pocket WiFiの復旧策ではなく、高額請求の入口になる。', damage:1.0 },
];

/* ---------- 対処（原因ごと） ---------- */

const REMEDIES = {
  fup: [
    { id:'r_topup', label:'容量超過だったことと追加購入の選択肢をご説明し、希望時はその場で適用する', sub:'当日中に速度が戻る。追加料金は客側の任意', kind:'resolve' },
    { id:'r_slow_ok', label:'容量制限が明日リセットされることをご説明し、今日は低速で利用いただく', sub:'費用はかからないが、今日の不便は残る', kind:'resolve' },
  ],
  devices: [
    { id:'r_disconnect', label:'接続台数の上限が原因だったことをご説明し、不要端末を切った状態で利用いただく', sub:'その場で解決する', kind:'resolve' },
    { id:'r_second_unit', label:'2台目のルーターを追加で手配する', sub:'解決はするが配送に時間と費用がかかる', kind:'resolve', cost:12000 },
  ],
  geo_block: [
    { id:'r_vpn_plan', label:'現地の通信規制をご説明し、VPN付きオプションの追加を手配する', sub:'当日中に適用され、規制対象のサービスに繋がる', kind:'resolve', cost:3200 },
    { id:'r_explain_block', label:'現地の通信規制であることだけを説明して終話する', sub:'原因は伝わるが、客の問題は解決しない', kind:'resolve' },
  ],
  heavy: [
    { id:'r_throttle_talk', label:'大容量通信が速度低下の原因だったことをご説明し、該当端末での通信を控えていただく', sub:'その場で改善する', kind:'resolve' },
  ],
  device_side: [
    { id:'r_forget_guide', label:'端末に残ったWi-Fi設定が原因だったことをご説明し、再接続後はそのまま利用いただく', sub:'端末側の情報を作り直す。低リスク', kind:'resolve' },
    { id:'r_use_other', label:'ほかの端末を使っていただくよう案内する', sub:'その場はしのげるが、原因は残る', kind:'resolve' },
  ],
  device_net: [
    { id:'r_vpn_off', label:'VPN／プロファイル設定が原因だったことをご説明し、無効化した状態で利用いただく', sub:'端末側の設定を戻す。低リスク', kind:'resolve' },
  ],
  location: [
    { id:'r_move_guide', label:'建物の遮蔽が原因だったことをご説明し、電波の入る場所で利用いただく', sub:'実際に移動して改善したことを確認してから案内する', kind:'resolve', needsTest:'t_move' },
    { id:'r_window_stationary', label:'ルーターを地上階の窓際に置いたまま使うよう案内する', sub:'通信は戻るが、地下の会議室へ持ち込めず不便が残る', kind:'resolve' },
  ],
  power: [
    { id:'r_charge_guide', label:'接続台数による電池消耗をご説明し、付属アダプタでの充電と節電をご案内する', sub:'消耗の理由も添えて伝える', kind:'resolve' },
  ],
  carrier: [
    { id:'r_outage_explain', label:'広域障害であることと復旧見込みを説明し、日割りの返金を案内する', sub:'原因が判明している場合の正規対応', kind:'resolve', needsOutage:true, cost:2400 },
    { id:'r_escalate_line', label:'回線障害の疑いとして技術部門へエスカレーションする', sub:'枠を1つ消費。確実だが自己解決にはならない', kind:'escalate' },
    { id:'r_swap_unit', label:'本体の不具合とみて代替機を手配する', sub:'網側の障害なら代替機を送っても直らない', kind:'resolve', cost:28000 },
  ],
  coverage: [
    { id:'r_coverage_replacement', label:'手配の誤りをお詫びし、滞在期間と滞在先を確認したうえで代替機を発送する', sub:'自社の機種選定ミスを正直に伝え、郊外でも使える機器を届ける', kind:'transfer', cost:28000,
      requiresQuestions:['q_stay','q_stay_length','q_replacement'], requiresLongStay:3, requiresConsent:true },
    { id:'r_swap_same', label:'同じ機種の代替機を手配する', sub:'同型機では同じ場所でまた圏外になる', kind:'resolve', cost:28000 },
    { id:'r_coverage_refund', label:'手配の誤りをお詫びし、返金する', sub:'非を認めて返金するが、郊外で通信を使えない問題は残る', kind:'resolve', cost:2400 },
  ],
  sim: [
    { id:'r_sim_clean', label:'接点の一時的な接触不良だったことをご説明し、そのままご利用いただく', sub:'1回で戻らなくても、接触位置が変わる2回目で復旧する場合がある', kind:'resolve', needsTest:'t_simout', needsTestCount:2 },
    { id:'r_escalate_swap', label:'2回清掃してもSIMを認識しないため、機器故障として切り分ける', sub:'交換判断へ進む前に、接触不良の可能性を2回試す', kind:'escalate', needsTest:'t_simout', needsTestCount:2 },
    { id:'r_reboot_again', label:'もう一度、時間を置いて再起動していただく', sub:'SIM接点の問題には届かない', kind:'resolve' },
  ],
  hardware: [
    { id:'r_hardware_swap', label:'本体の機器故障と診断し、希望を確認して代替機を配送する', sub:'長期滞在で、本人が交換を希望する場合の正規対応', kind:'escalate', cost:28000, needsTest:'t_simout', needsTestCount:2,
      requiresQuestions:['q_stay','q_stay_length','q_replacement'], requiresLongStay:3, requiresConsent:true },
    { id:'r_hardware_no_swap', label:'機器故障と診断し、交換せず利用料金の返金だけを案内する', sub:'短期滞在または配送を希望しない場合', kind:'escalate', needsTest:'t_simout', needsTestCount:2 },
  ],
  provision: [
    { id:'r_carrier_reopened_explain', label:'契約情報の同期ずれで回線が停止していたこと、現地キャリアによる再開通が完了したことをご説明する', sub:'現地キャリアへ依頼し、実際に回線が復旧した後の結果報告', kind:'resolve', needsCarrierRestored:true, reportsRestored:true },
    { id:'r_escalate_prov', label:'開通設定の不備としてプロビジョニング担当へエスカレーションする', sub:'枠を1つ消費', kind:'escalate' },
  ],
  logistics: [
    { id:'r_transfer_logi', label:'物流・カウンター担当へ引き継ぎ、宿泊先への当日配送を手配する', sub:'エスカレーション枠は消費しない別系統', kind:'transfer', cost:4800 },
    { id:'r_come_tomorrow', label:'翌朝あらためてカウンターへ寄っていただくよう案内する', sub:'客の初日が丸ごと潰れる', kind:'resolve' },
    { id:'r_logistics_replacement', label:'手配の誤りをお詫びし、滞在期間と滞在先を確認したうえで代替機を発送する', sub:'自社の手配ミスを正直に伝え、残りの滞在で使える機器を届ける', kind:'transfer', cost:28000,
      requiresQuestions:['q_stay','q_stay_length','q_replacement'], requiresLongStay:3, requiresConsent:true },
    { id:'r_logistics_refund', label:'手配の誤りをお詫びし、返金する', sub:'非を認めて返金するが、残りの滞在中も通信は使えない', kind:'resolve', cost:2400 },
  ],
};

// 対処の種類ではなく、客が通話中に通信の戻りを確かめられるかで分ける。
const VERIFIABLE_REMEDY_IDS = new Set([
  'r_topup','r_disconnect','r_vpn_plan','r_throttle_talk','r_forget_guide','r_use_other',
  'r_vpn_off','r_move_guide','r_window_stationary','r_charge_guide','r_sim_clean','r_reboot_again',
  'r_carrier_reopened_explain',
]);
Object.values(REMEDIES).flat().forEach(remedy => { remedy.verifiable = VERIFIABLE_REMEDY_IDS.has(remedy.id); });

/* ---------- シナリオ ---------- */

const SCENARIOS = [

/* === 1. バンコク：容量超過。導入。社内照会で確定できる === */
{
  id:'S1', arrive:0, name:'三宅 千夏', nameEn:'Chika Miyake', age:27, ageRange:[24,36], type:'anxious', abandonAfter:32, callbackTo:'hotel', stayDays:2,
  deviceInHand:true,
  contractId:{ minutes:2, text:'予約番号…はい、探します。手が震えて…すみません。ありました。GDW-410882、これで合っていますか？' },
  country:'タイ', city:'バンコク', cityEn:'BANGKOK', localOffset:-2, carrierName:'AIS', device:'GD-500', plan:'{country} ／ 500MBプラン',
  opening:'あの…地図が全然開かないんです。昨日まで使えたのに、今日だけ急に遅くて…。どうしたらいいでしょうか。',
  smalltalk:[
    { id:'st_s1_trip', reveal:'q_when', askLabel:'{city}では、どちらを回られるご予定ですか？', tellLabel:'新婚旅行、おめでとうございます', goodReply:'ありがとうございます…。{spouse}と一緒だと思ったら、少し息ができました。', badReply:'ありがとうございます。でも地図がないと、ホテルにも戻れなくなりそうで…。' },
    { id:'st_s1_movie', reveal:'q_when', askLabel:'昨夜は、どのような映画をご覧になったんですか？', tellLabel:'お二人で映画を楽しまれたんですね', goodReply:'はい…つい見入ってしまって。思い出したら、少し落ち着きました。', badReply:'映画の話をしたら、私が使いすぎたせいって決まるんでしょうか…？' },
  ],
  panel:{ bars:3, carrier:'{carrier}', sim:'ok', throttle:true, clients:2, maxClients:5, battery:62, ssid:'Globaldesk-2210' },
  trueCause:'fup', best:'r_topup', partial:['r_slow_ok'],
  replies:{
    q_return:{ text:'もう部屋にいます。{spouse}と一緒に、ここで待っていますので…。' },
    q_other_device:{ text:'{spouse}のスマホも同じです。二人とも遅くて…。端末まで二つとも壊れたんでしょうか？',
      fact:{ text:'同行者の端末も同様に遅い。端末固有ではない', out:['device_side','device_net'] } },
    q_lamp:{ text:'画面…アンテナは3本です。下に「節」みたいな印が…。これ、悪い表示ですか？',
      fact:{ text:'アンテナ3本。本体に速度制限アイコンが表示されている', hot:['fup'], out:['sim','carrier','coverage'] } },
    q_when:{ text:'今朝からです。新婚旅行で、昨夜、{spouse}と映画を1本見て…。私が見たせいですよね？ すみません…。',
      fact:{ text:'前夜に動画を長時間視聴。翌朝から低速化', hot:['fup'] } },
    q_count:{ text:'2台だけです。私と{spouse}のスマホだけ。本当にそれだけです。',
      fact:{ text:'接続は2台のみ', out:['devices'] } },
    q_what_fails:{ text:'全部です。ずっとくるくる回って…。何も開かなくなるんじゃないかって。',
      fact:{ text:'特定サービスではなく全体が低速', out:['geo_block'] } },
    q_stay:{ text:'{city}のホテル、1208号室です。ここまで来ていただけるんですか？' },
  },
  lookups:{
    l_plan:{ text:'[契約照会] プラン: 500MB/日 ／ 本日の使用量: 512MB（上限到達）／ 現在 速度制限中（最大128kbps）／ 前日使用量: 4.2GB',
      fact:{ text:'本日の使用量が上限に到達し、速度制限がかかっている', hot:['fup'], out:['heavy','location','power','hardware','provision'] },
      viz:{ label:'本日の使用量', value:512, max:500, unit:'MB', note:'前日 4,200MB' } },
    l_outage:{ text:'[障害情報] {country} {carrier} 網 正常。障害報告なし。',
      fact:{ text:'現地キャリアに障害なし', out:['carrier'] } },
  },
  debrief:'いちばん素直な形。<em>社内の使用量照会で裏が取れる「確定」案件</em>で、客に余計な操作をさせる必要はありません。前夜の動画視聴という自己申告だけで決めつけず、契約照会まで引いて数字を見たかどうかが分かれ目でした。'
},

/* === 2. ロンドン：一台だけ繋がらない。端末側の保存情報 === */
{
  id:'S2', arrive:5, name:'田辺 幸子', nameEn:'Sachiko Tanabe', age:71, ageRange:[62,78], type:'novice', abandonAfter:30, callbackTo:'mobile', stayDays:3,
  deviceInHand:true,
  contractId:{ minutes:4, text:'番号…どの紙でしょう。すみません、老眼鏡も見つからなくて…。これですか？ GDW-336104。違っていたら、ごめんなさいね。' },
  country:'イギリス', city:'ロンドン', cityEn:'LONDON', localOffset:-8, carrierName:'Vodafone UK', device:'GD-500', plan:'{country} ／ 無制限プラン',
  opening:'も、もしもし。インターネットが繋がらなくて…。変な所を押して壊したんでしょうか。すみません、機械のことが本当に分からなくて…。',
  smalltalk:[{ id:'st_s2_tour', reveal:'q_other_device', askLabel:'ツアーでは、どちらを回られたんですか？', tellLabel:'皆様とのご旅行、素敵ですね', goodReply:'旅程では博物館へ…。皆さんと一緒だと思うと、少し心強いです。', badReply:'お気遣いまで、すみません。同行のお二人にも迷惑をかけないか心配で…。' }],
  panel:{ bars:4, carrier:'{carrier}', sim:'ok', throttle:false, clients:3, maxClients:5, battery:71, ssid:'Globaldesk-4471' },
  trueCause:'device_side', best:'r_forget_guide', partial:['r_use_other'],
  replies:{
    q_return:{ text:'もう部屋におります。明日の朝が早いので、今夜はここにおりますよ。' },
    q_other_device:{ text:'ツアー同行のお二人は繋がっています。同じ機械なのに私だけで…。やっぱり私の押し方ですか？',
      fact:{ text:'同一ルーターで他端末は正常。本人の端末だけ不通', hot:['device_side','device_net'], out:['carrier','sim','hardware','coverage','fup','provision'] } },
    q_lamp:{ text:'四角い画面に棒が4本…数字は3です。これで合っていますか？ 見る所、違いませんか？',
      fact:{ text:'アンテナ4本。接続3台。本体は正常に電波を掴んでいる', out:['sim','carrier','coverage','power'] } },
    q_ssid:{ text:'一覧…はい、「Globaldesk-4471」です。押すと「接続できません」と…。次はどこですか？ 怖くて押せなくて。',
      fact:{ text:'SSIDは見えており、認証の段階で失敗している', out:['sim','power','location','geo_block','heavy'] } },
    q_count:{ text:'三人ですから、三台…ですよね？ 数え方、これでいいでしょうか。',
      fact:{ text:'接続は3台', out:['devices'] } },
    q_when:{ text:'旅行中にホテルを出てからです。それまでは使えました。私、何か触ったかしら…。' },
  },
  lookups:{
    l_plan:{ text:'[契約照会] プラン: 無制限 ／ 使用量: 1.8GB ／ 速度制限なし',
      fact:{ text:'容量制限はかかっていない', out:['fup'] },
      viz:{ label:'使用量', value:1800, max:null, unit:'MB', note:'無制限プラン' } },
    l_session:{ text:'[セッション] 現在3台接続中。うち1台（iPhone / MAC末尾 :C4）が本日04:12以降、認証失敗を6回記録。',
      fact:{ text:'当該端末だけが認証に失敗し続けている', hot:['device_side'], out:['device_net'] } },
  },
  tests:{
    t_forget:{ text:'…あら、繋がりました！ 地図です。私にもできました…。ゆっくり教えてくださって、本当にありがとうございます。',
      fact:{ text:'Wi-Fi情報を削除して再接続したところ復旧', hot:['device_side'], out:['device_net','location','power'] }, solves:true },
    t_reboot:{ text:'入れ直しました。私のだけ、まだ駄目です…。ほかのお二人は使えています。私、何を間違えたんでしょう。',
      fact:{ text:'ルーター再起動では変化なし。他端末は影響なし', out:['sim','carrier','power'] } },
  },
  debrief:'「別の端末では？」が最も情報量の高い質問だという典型例です。全端末なら回線側、<em>一台だけなら端末側</em>。ここを最初に押さえると、ルーターの再起動でツアー客全員を巻き込む必要がなくなります。伝え方も要点で、71歳の相手に「認証シーケンス」と言っても伝わりません。'
},

/* === 3. ホノルル：同時接続台数の上限超過。FUPと紛らわしい === */
{
  id:'S3', arrive:11, name:'大久保 健', nameEn:'Ken Okubo', age:44, ageRange:[36,52], type:'hurried', abandonAfter:22, callbackTo:'mobile', stayDays:2,
  deviceInHand:true,
  contradicts:{ carrier:'ほかの端末は使えてるんですが。回線の話ですか？' },
  rushedReply:'はい。挨拶は分かった。続き、早く。', contractId:{ minutes:1, text:'メールにあります。GDW-529017。はい、次。' },
  country:'ハワイ', city:'ホノルル', cityEn:'HONOLULU', localOffset:-19, carrierName:'T-Mobile US', device:'GD-500', plan:'{country} ／ 無制限プラン',
  opening:'急いでます。一台だけ繋がりません。ほかは使えます。あと10分で移動しないといけません。何を見ればいいですか。',
  smalltalk:[{ id:'st_s3_daughter', reveal:'q_other_device', askLabel:'お嬢様はタブレットで何をご覧になるんですか？', tellLabel:'お嬢様とのご旅行、楽しそうですね', goodReply:'家族旅行です。…はい、少し落ち着きました。次は？', badReply:'その話は後。バスが着きます。直し方を先に。' }],
  panel:{ bars:4, carrier:'{carrier}', sim:'ok', throttle:false, clients:5, maxClients:5, battery:55, ssid:'Globaldesk-8802' },
  trueCause:'devices', best:'r_disconnect', partial:['r_second_unit'], shipNeed:'normal',
  replies:{
    q_return:{ text:'いまバス待ち。部屋に戻るのは30分くらい先だ。' },
    q_other_device:{ text:'私と{spouse}は使えてます。子どもの分だけ駄目。次の質問は？',
      fact:{ text:'既存の接続端末は正常。新しい端末だけが入れない', hot:['devices','device_side'], out:['carrier','sim','hardware','coverage','provision'] } },
    q_lamp:{ text:'はい、画面出した。棒4本、数字は5。バスはあと7分。',
      fact:{ text:'電波は正常。接続台数の表示が5台', hot:['devices'], out:['sim','carrier','coverage','power','location'] } },
    q_count:{ text:'私、{spouse}、子ども二人、ゲーム機、{spouse}の予備端末。6台か7台。結論は？',
      fact:{ text:'接続を試みている端末が6〜7台ある', hot:['devices'] } },
    q_when:{ text:'ホテルを出るとき、娘のタブレットを追加した瞬間から。',
      fact:{ text:'新しい端末を追加した時点で発生', hot:['devices'] } },
    q_ssid:{ text:'名前は出る。押しても入れない。娘が騒いでる。早く。',
      fact:{ text:'SSIDは見えているが参加できない', out:['location','power','device_net'] } },
    q_what_fails:{ text:'Wi-Fi自体に入れない。サイト以前。次。',
      fact:{ text:'接続自体ができていない', out:['geo_block'] } },
    q_stay:{ text:'{city}市内のホテル。未到着だから部屋番号はまだ。' },
  },
  lookups:{
    l_plan:{ text:'[契約照会] プラン: 無制限 ／ 使用量: 2.1GB ／ 速度制限なし',
      fact:{ text:'容量制限はかかっていない', out:['fup'] },
      viz:{ label:'使用量', value:2100, max:null, unit:'MB', note:'無制限プラン' } },
    l_session:{ text:'[セッション] 同時接続 5/5（上限到達）。6台目以降の認証要求を04:41以降 11回拒否。',
      fact:{ text:'同時接続が上限5台に達し、追加の端末を拒否している', hot:['devices'], out:['device_side','heavy'] },
      viz:{ label:'同時接続', value:5, max:5, unit:'台', note:'6台目以降を11回拒否' } },
  },
  tests:{
    t_disconnect:{ text:'ゲーム機と予備端末を切った。…繋がった。娘も静か。助かった。',
      fact:{ text:'不要端末の切断で新しい端末が接続できた', hot:['devices'] }, solves:true },
  },
  debrief:'「遅い・繋がらない」で反射的に容量超過を疑うと外します。<em>上限超過では、すでに繋がっている端末は影響を受けず、新しい端末だけが入れない</em>。この非対称が決め手でした。契約照会で容量が正常だと確認できれば、残るのは台数です。急いでいる相手なので、説明は短いほうが刺さります。'
},

/* === 4. 上海：渡航先の通信規制。技術に明るい客 === */
{
  id:'S4', arrive:18, name:'森 達彦', nameEn:'Tatsuhiko Mori', age:39, ageRange:[30,50], type:'expert', abandonAfter:35, callbackTo:'hotel', stayDays:4,
  deviceInHand:true,
  contractId:{ minutes:1, text:'GDW-118350です。控えてあります。' },
  country:'中国本土', city:'上海', cityEn:'SHANGHAI', localOffset:-1, carrierName:'China Unicom', device:'GD-500', plan:'{country} ／ 1GBプラン',
  opening:'電波強度と回線速度は正常。ただ、社内システムと海外系サービスだけ到達しません。疎通は取れて、名前解決で落ちます。経路条件を疑っています。',
  smalltalk:[{ id:'st_s4_work', reveal:'q_when', askLabel:'{city}では、どのようなお仕事をされているんですか？', tellLabel:'{city}でのお仕事、お疲れさまです', goodReply:'ありがとうございます。現地チームとの技術打ち合わせです。では続けましょう。', badReply:'お気遣いは不要です。その質問が障害切り分けにどう寄与しますか。' }],
  panel:{ bars:4, carrier:'{carrier}', sim:'ok', throttle:false, clients:2, maxClients:5, battery:80, ssid:'Globaldesk-1174' },
  trueCause:'geo_block', best:'r_vpn_plan', partial:['r_explain_block'],
  replies:{
    q_return:{ text:'20分ほどで部屋へ戻ります。それ以降ならいつでも構いません。' },
    q_what_fails:{ text:'全断ではありません。現地系サイトは正常です。落ちるのは海外系サービスと、社内の暗号化ゲートウェイです。',
      fact:{ text:'一部のサービスのみ不通。現地系サービスは正常', hot:['geo_block'], out:['fup','carrier','sim','devices','power','location'] } },
    q_other_device:{ text:'ノートPCとスマホで再現します。端末固有要因はこちらで除外済みです。',
      fact:{ text:'複数端末で同じ挙動。端末固有ではない', out:['device_side','device_net'] } },
    q_lamp:{ text:'アンテナ4本。現地回線を正常に捕捉しています。',
      fact:{ text:'現地キャリアを正常に掴んでいる', out:['sim','hardware','coverage','provision'] } },
    q_when:{ text:'現地チームとの技術打ち合わせで到着した初日から再現しています。経時劣化ではありません。',
      fact:{ text:'渡航当初から一貫して同じ症状', out:['heavy'] } },
    q_stay:{ text:'{city}市内のホテル、1506号室です。この情報は配送判断用ですか？' },
  },
  lookups:{
    l_area:{ text:'[エリア照会] {country} ／ 貸出機種 GD-500: 対応 ✓ ／ 提携: {carrier} ✓ ／ 備考: 通常のデータプランには現地の通信規制を回避する経路が含まれない。規制対象サービスの利用には「VPN付きオプション」の追加が必要。',
      fact:{ text:'契約プランが規制回避に対応していない。VPN付きプランで解消する', hot:['geo_block'], out:['coverage','provision'] } },
    l_outage:{ text:'[障害情報] {country} {carrier} 網 正常。障害報告なし。',
      fact:{ text:'現地キャリアに障害なし', out:['carrier'] } },
  },
  debrief:'「繋がらない」の中身を分けられたかどうかです。<em>回線は生きていて、特定のサービスだけが落ちている</em>なら、疑うのは機器ではなく契約と地域の条件。相手はpingとDNSの区別がつく人なので、噛み砕きすぎるとかえって信用を落とします。'
},

/* === 5. ニューヨーク①：広域障害。この時点ではまだ見えない === */
{
  id:'S5', arrive:25, name:'小林 亜衣', nameEn:'Ai Kobayashi', age:33, ageRange:[26,44], type:'anxious', abandonAfter:28, callbackTo:'hotel', stayDays:2,
  deviceInHand:true,
  contractId:{ minutes:2, text:'はい…会社の手配です。えっと、GDW-673925。間違っていませんよね？' },
  country:'アメリカ', city:'ニューヨーク', cityEn:'NEW YORK', localOffset:-13, carrierName:'T-Mobile US', regionGroup:'us_northeast', regionName:'米国北東部', device:'GD-500', plan:'{country} ／ 無制限プラン',
  opening:'あの…30分前に全部切れて、再起動しても戻りません。明朝までに必要な資料が開けなくて…。失敗したらと思うと、手が震えます。どうしよう…。',
  smalltalk:[{ id:'st_s5_visit', reveal:'q_when', askLabel:'明日は、どのようなお客様を訪問されるんですか？', tellLabel:'明日のご訪問、うまく進むといいですね', goodReply:'ありがとうございます…。大事な提案なので、その一言で少し呼吸が戻りました。', badReply:'ありがとうございます。でも、このままだと提案そのものができなくなります…。' }],
  panel:{ bars:0, carrier:null, sim:'ok', throttle:false, clients:2, maxClients:5, battery:45, ssid:'Globaldesk-6390' },
  trueCause:'carrier', best:'r_outage_explain', bestNoOutage:'r_escalate_line', partial:['r_escalate_line'],
  replies:{
    q_return:{ text:'部屋にいます。眠れそうにないので、ずっと起きています…。' },
    q_other_device:{ text:'同僚も同じです。二人とも繋がりません。会社全体に迷惑をかけたらどうしよう…。',
      fact:{ text:'複数端末で同時に不通', out:['device_side','device_net'] } },
    q_lamp:{ text:'アンテナ0本、「圏外」です。さっきまで4本だったのに…。急に全部消えました。',
      fact:{ text:'圏外表示。直前まで電波は正常だった', hot:['carrier','sim','coverage'], out:['fup','devices','geo_block','heavy'] } },
    q_where:{ text:'{city}中心部のホテルです。窓際もロビーも駄目で…。もう外へ出るしかないですか？',
      fact:{ text:'複数の場所で試しても圏外のまま', out:['location'] } },
    q_when:{ text:'30分前です。急に切れて…。明朝に大事な提案があるのに、それまで普通だったから、余計に怖くて。',
      fact:{ text:'突発的に発生。前兆なし', out:['power'] } },
    q_stay:{ text:'{city}中心部のホテル、816号室です。ここで待っていて大丈夫でしょうか？' },
  },
  lookups:{
    l_outage:{ text:'[障害情報] {region} {carrier}: 現時点で報告なし（更新待ち）',
      fact:{ text:'障害情報はまだ上がっていない（更新が古い）' } },
    l_area:{ text:'[エリア照会] {country} ／ 貸出機種 GD-500: 対応 ✓ ／ 提携: {carrier} ✓',
      fact:{ text:'渡航先も機種も対応範囲内', out:['coverage'] } },
    l_plan:{ text:'[契約照会] プラン: 無制限 ／ 使用量: 0.9GB ／ 速度制限なし',
      fact:{ text:'容量制限はかかっていない', out:['fup'] } },
    l_session:{ text:'[セッション] 04:58以降、圏内復帰なし。SIM認識: 正常（本体はSIMを認識している）。',
      fact:{ text:'SIMは認識されている。本体側の故障ではない', out:['sim','hardware','provision'] } },
  },
  tests:{
    t_reboot:{ text:'もう一度やりました。でも圏外です…。何度やっても戻らなかったら、どうしましょう。',
      fact:{ text:'再起動でも復旧しない', out:['power','device_side'] } },
    t_move:{ text:'外の通りまで出ました。空の下でも圏外です…。もう場所のせいでもないんですね？',
      fact:{ text:'屋外でも圏外', out:['location'] } },
  },
  debrief:'いちばん難しい一件でした。この時点で障害情報は上がっておらず、<em>SIMは正常・機種もエリアも対応内・複数端末で同時・屋外でも圏外</em>という消去法しか手がありません。ここで代替機を送ってしまうと、網側の障害なので届いても直らず、費用だけが出ていきます。判断がつかないならエスカレーションが正解です。'
},

/* === 6. ニューヨーク②：ここで相関が見える。山場 === */
{
  id:'S6', arrive:31, name:'渡辺 圭吾', nameEn:'Keigo Watanabe', age:52, ageRange:[42,60], type:'hurried', abandonAfter:20, callbackTo:'mobile', stayDays:3,
  deviceInHand:true,
  rushedReply:'分かってます。前置きは終わり。進めて。', contractId:{ minutes:1, text:'毎月使うので控えてます。GDW-206441。次。' },
  country:'アメリカ', city:'ボストン', cityEn:'BOSTON', localOffset:-13, carrierName:'T-Mobile US', regionGroup:'us_northeast', regionName:'米国北東部', device:'GD-500', plan:'{country} ／ 無制限プラン',
  opening:'急に圏外。再起動済み、変化なし。次の移動まで15分。交換が要るか、いま判断してください。',
  smalltalk:[{ id:'st_s6_regular', reveal:'q_when', askLabel:'毎月のご出張では、いつも{city}へ来られるんですか？', tellLabel:'いつもご利用いただき、ありがとうございます', goodReply:'毎月です。はい、少しだけ落ち着きました。判断を。', badReply:'利用歴の話は後。残り15分。交換判断を先に。' }],
  panel:{ bars:0, carrier:null, sim:'ok', throttle:false, clients:2, maxClients:5, battery:38, ssid:'Globaldesk-6512' },
  trueCause:'carrier', best:'r_outage_explain', bestNoOutage:'r_escalate_line', partial:['r_escalate_line'],
  replies:{
    q_return:{ text:'いまロビー。10分で上がる。それからにしてくれ。' },
    q_lamp:{ text:'圏外。アンテナ0。回線名も消えた。',
      fact:{ text:'圏外表示。キャリア名も表示されない', hot:['carrier','sim','coverage'], out:['fup','devices','geo_block','heavy'] } },
    q_where:{ text:'{city}市内。歩いて移動中。ずっと圏外。',
      fact:{ text:'移動しながらでも一貫して圏外', out:['location'] } },
    q_other_device:{ text:'2台とも駄目。端末の話はこれで終わり。',
      fact:{ text:'複数端末で同時に不通', out:['device_side','device_net'] } },
    q_when:{ text:'1時間前。急に。毎月使っていて操作は分かります。はい、次。',
      fact:{ text:'突発的に発生', out:['power'] } },
  },
  lookups:{
    l_outage:{ text:'[障害情報] {region} 提携キャリア {carrier} ／ 広域の接続障害を確認。復旧見込み: 未定。同一エリアからの入電: 2件。',
      fact:{ text:'{region}で提携キャリアの広域障害が発生中', hot:['carrier'], out:['sim','coverage','provision','device_side','device_net'] }, outage:true },
    l_session:{ text:'[セッション] 05:31以降、圏内復帰なし。SIM認識: 正常。',
      fact:{ text:'SIMは認識されている。本体側の故障ではない', out:['sim','hardware','provision'] } },
    l_area:{ text:'[エリア照会] {country} ／ 貸出機種 GD-500: 対応 ✓ ／ 提携: {carrier} ✓',
      fact:{ text:'渡航先も機種も対応範囲内', out:['coverage'] } },
  },
  debrief:'同じ都市から似た症状が続いたら、個別の故障ではなく<em>地域で起きていること</em>を疑う。障害情報の照会でそれが裏付けられ、先に受けた一件の答えもここで確定します。障害と分かってさえいれば、代替機を送らずに説明と返金で収められました。'
},

/* === 7. バルセロナ郊外：対象エリア外。上級 === */
{
  id:'S7', arrive:38, name:'中西 悠真', nameEn:'Yuma Nakanishi', age:29, ageRange:[25,40], type:'expert', abandonAfter:38, callbackTo:'hotel', stayDays:6,
  deviceInHand:true,
  contractId:{ minutes:1, text:'GDW-887302。画面に出しています。照合してください。' },
  country:'スペイン', city:'バルセロナ', cityEn:'BARCELONA', localOffset:-7, carrierName:'Orange ES', device:'GD-200', plan:'{country} ／ 1GBプラン',
  opening:'市街地では正常でしたが、郊外へ移動後は完全に圏外です。3台とも同じなので端末要因は除外済み。地域差か対応周波数を確認していただけますか。',
  smalltalk:[{ id:'st_s7_village', reveal:'q_where', askLabel:'その村へは、どのような目的で来られたんですか？', tellLabel:'{city}近郊の村、素敵なところでしょうね', goodReply:'静かで景色のよい場所です。ありがとうございます。では確認を。', badReply:'観光情報は障害条件ではありません。地域と機種の適合を確認してください。' }],
  panel:{ bars:0, carrier:null, sim:'ok', throttle:false, clients:3, maxClients:5, battery:66, ssid:'Globaldesk-3028' },
  trueCause:'coverage', best:'r_coverage_replacement', partial:['r_coverage_refund'], shipNeed:'next', wantsReplacement:true,
  replies:{
    q_return:{ text:'いま部屋です。夜のうちは動きませんので、いつでも。' },
    q_other_device:{ text:'3台で同一症状です。ルーター自体が圏外なので、端末要因は除外できますよね。',
      fact:{ text:'複数端末で同時に不通。ルーター自体が圏外', out:['device_side','device_net'] } },
    q_where:{ text:'{city}近郊の山寄りの村です。現地端末は正常なので、単純な無電波地域ではありません。',
      fact:{ text:'現地の携帯は通じている場所で、ルーターだけが圏外', hot:['coverage'], out:['location'] } },
    q_moved:{ text:'村内3地点と丘の上で再現しました。場所要因の再確認は不要です。',
      fact:{ text:'複数地点で試しても圏外のまま', out:['location'] } },
    q_lamp:{ text:'圏外表示で回線名なし。市内では現地回線名が表示されていました。',
      fact:{ text:'市内では接続実績あり。郊外でのみ圏外', hot:['coverage'], out:['sim','provision','fup','devices','geo_block','heavy'] } },
    q_stay:{ text:'{city}近郊のホテル、312号室です。帰国まで同じホテルに滞在します。' },
    q_stay_length:{ text:'今日を含めてあと6泊です。郊外へ出る予定が続くので、対応機なら受け取る意味があります。',
      fact:{ text:'残り6泊、同じホテルに滞在するため代替機を使える期間が十分にある', hot:['coverage'] } },
    q_replacement:{ text:'はい、郊外でも使える対応機を同じホテルへ送ってください。受け取ります。',
      fact:{ text:'本人が同じホテルへの対応機配送を希望している', hot:['coverage'] } },
  },
  lookups:{
    l_area:{ text:'[エリア照会] {country} ／ 貸出機種: GD-200（旧型）／ 提携: {carrier} ／ 備考: GD-200 は提携キャリアが郊外をカバーする周波数帯に非対応のため、郊外・山間部では圏外となる場合あり。',
      fact:{ text:'貸出機種が現地の郊外カバー用バンドに非対応。機種を替えないと解決しない', hot:['coverage'], out:['sim','carrier','provision'] } },
    l_session:{ text:'[セッション] 07:40以降、圏内復帰なし。SIM認識: 正常。',
      fact:{ text:'SIMは認識されている。本体側の故障ではない', out:['sim','hardware'] } },
    l_outage:{ text:'[障害情報] {country} {carrier} 網 正常。障害報告なし。',
      fact:{ text:'現地キャリアに障害なし', out:['carrier'] } },
  },
  tests:{
    t_move:{ text:'丘の上まで試行済みです。結果は同じ。ログを確認してください。',
      fact:{ text:'高所へ移動しても圏外', out:['location'] } },
    t_reboot:{ text:'再起動完了。圏外のままです。仮説は更新されましたか。',
      fact:{ text:'再起動でも復旧しない', out:['power'] } },
  },
  debrief:'市街地では使えても郊外で使えない機種を貸し出したのは、自社の手配ミスです。<em>同じ機種ではなく、郊外の周波数帯に対応した代替機</em>を、滞在期間・滞在先・本人の希望を確認して届けるのが最適です。非を認めてお詫びし、配送が間に合わない場合は返金を提案します。'
},

/* === 8. ドバイ：SIM未認識。清掃と挿し直しで復旧 === */
{
  id:'S8', arrive:44, name:'藤川 みどり', nameEn:'Midori Fujikawa', age:58, ageRange:[50,68], type:'novice', abandonAfter:26, callbackTo:'hotel', stayDays:2,
  deviceInHand:true,
  contractId:{ minutes:3, text:'番号…箱の紙ですか？ すみません、見方が…。あ、GDW-745168。これでしょうか？' },
  country:'UAE', city:'ドバイ', cityEn:'DUBAI', localOffset:-5, carrierName:'Etisalat', device:'GD-500', plan:'{country} ／ 1GBプラン',
  opening:'あの、すみません。今日受け取って、電源を入れただけなのに「SIMカードがありません」と…。再起動は何度かしました。私、最初から何か間違えましたでしょうか。',
  smalltalk:[{ id:'st_s8_arrival', reveal:'q_when', askLabel:'{city}には、今日着かれたばかりですか？', tellLabel:'長いご移動、お疲れさまでした', goodReply:'はい、着いたばかりです。お気遣いまで…少し安心しました。', badReply:'ありがとうございます。でも受け取ってすぐなので、私が壊したのかと…。' }],
  panel:{ bars:null, carrier:null, sim:'none', throttle:false, clients:0, maxClients:5, battery:80, ssid:'Globaldesk-7745' },
  trueCause:'sim', best:'r_sim_clean', partial:['r_escalate_swap'],
  replies:{
    q_return:{ text:'部屋におります。今日はもう出かけません。' },
    q_lamp:{ text:'「No SIM」と、小さい×です。英語をそのまま読めばいいですか？',
      fact:{ text:'本体が SIM を認識していない（No SIM表示）', hot:['sim'], out:['fup','devices','geo_block','carrier','heavy','device_side','device_net'] } },
    q_when:{ text:'今日着いて受け取り、箱から出して、電源を押しただけです。それでも押し方が悪かったでしょうか。',
      fact:{ text:'受取直後の初回起動から発生', out:['fup','heavy'] } },
    q_where:{ text:'ホテルの部屋です。窓にも置きました。余計なことをしていませんよね？',
      fact:{ text:'場所を変えても変化なし', out:['location'] } },
    q_battery:{ text:'電池は8割です。充電の印はありません。見る所、合っていますか？',
      fact:{ text:'バッテリーは十分', out:['power'] } },
    q_stay:{ text:'ジュメイラのホテル、1204です。すみません、これで足りますか？' },
  },
  lookups:{
    l_session:{ text:'[セッション] 本体からのSIM認識イベントなし。最終認識は出荷検品時（8/28 11:20）。接点の汚れまたは装着不良の可能性あり。',
      fact:{ text:'出荷検品後、SIMを認識していない。接点の汚れまたは装着不良が疑われる', hot:['sim'], out:['provision','carrier','coverage'] } },
    l_ship:{ text:'[貸出記録] {city}国際空港カウンター受取 ／ 検品ステータス: 出荷時OK ／ 代替機在庫: 市内デポに 3台',
      fact:{ text:'市内デポに代替機の在庫があり、当日配送が可能', hot:['sim'], out:['logistics'] } },
    l_area:{ text:'[エリア照会] {country} ／ 貸出機種 GD-500: 対応 ✓ ／ 提携: {carrier} ✓',
      fact:{ text:'渡航先も機種も対応範囲内', out:['coverage'] } },
    l_outage:{ text:'[障害情報] {country} {carrier} 網 正常。障害報告なし。',
      fact:{ text:'現地キャリアに障害なし', out:['carrier'] } },
  },
  tests:{
    t_reboot:{ text:'やりました。でも「No SIM」のままです…。私、また同じ所を押してしまいましたか？',
      fact:{ text:'再起動を繰り返しても認識しない', out:['power','device_side'] } },
    t_simout:{ sequence:[
      { text:'一度拭いて挿しました。まだ「No SIM」です…。もう一度で、本当にいいんですね？',
        fact:{ text:'1回目のSIM清掃と挿し直しでは認識が戻らなかった', hot:['sim'] } },
      { text:'あっ、今度は「No SIM」が消えました。回線名が出て、スマホもつながりました！ 私にもできました…！',
        fact:{ text:'2回目のSIM抜き差しと接点清掃で認識が戻り、通信も復旧した', hot:['sim'], out:['fup','devices','geo_block','carrier','coverage','hardware','provision','logistics','device_side','device_net','location','power','heavy'] }, solves:true },
    ] },
  },
  debrief:'No SIM／SIM未認識の表示があるなら、<em>SIMの抜き差しと接点清掃が重要な第一選択</em>です。この機種では電源を切る必要はありません。1回で戻らなくても接触位置が変わる2回目で復旧することがあるため、乾いた柔らかい布で再度清掃して認識と通信を確認します。2回でも戻らなければ機器故障を疑います。'
},

/* === 9. ハノイ：技術ではない。物流案件 === */
{
  id:'S9', arrive:50, name:'石橋 玲', nameEn:'Rei Ishibashi', age:35, ageRange:[28,46], type:'hurried', abandonAfter:16, callbackTo:'mobile', stayDays:2,
  deviceInHand:false,
  rushedReply:'はい。で、結論は？', contractId:{ minutes:1, text:'GDW-091774。番号は最初からあります。次。' },
  country:'ベトナム', city:'ハノイ', cityEn:'HANOI', localOffset:-2, carrierName:'Viettel', device:'（未受取）', plan:'{country} ／ 500MBプラン',
  opening:'{city}国際空港。カウンターは無人で、機器を受け取れていません。タクシーを待たせています。市内へ出る前に、受取方法を決めてください。',
  smalltalk:[{ id:'st_s9_city', reveal:'opening', askLabel:'市内では、まずどちらへ向かわれるんですか？', tellLabel:'{city}までのご移動、お疲れさまでした', goodReply:'市内のホテルです。ありがとう。では、受取方法を。', badReply:'行き先の話は後。タクシーが待ってる。受取方法を今。' }],
  panel:null,
  trueCause:'logistics', best:'r_transfer_logi', partial:['r_come_tomorrow'], shipNeed:'fast',
  techPenalty:true,
  replies:{
    q_return:{ text:'これから市内へ向かう。部屋に入るのは30分後くらいだ。' },
    q_when:{ text:'予約時刻を過ぎて到着したら無人でした。担当者も不在です。タクシーを待たせてます。',
      fact:{ text:'予約時刻を過ぎ、カウンターは臨時閉鎖。担当者も不在', hot:['logistics'] } },
    q_stay:{ text:'{city}市内のホテルへ向かいます。名称は予約票にあります。そこへ配送できますか。' },
  },
  lookups:{
    l_ship:{ text:'[貸出記録] {city}国際空港 受取予約 ／ 予約時刻経過後にカウンター臨時閉鎖・担当者不在 ／ ステータス: 未受取 ／ 市内デポからの宿泊先配送: 当日手配可（到着目安 90分）',
      fact:{ text:'カウンターは営業時間外。市内デポから宿泊先への当日配送が手配できる', hot:['logistics'], out:['sim','hardware','carrier','coverage','provision','fup','devices','geo_block','device_side','device_net','location','power','heavy'] } },
  },
  debrief:'テクニカルサポートにかかってくる電話が、いつも技術の話とはかぎりません。<em>手元に機器がない相手に切り分けの質問をするのは、時間を奪っているだけ</em>です。技術案件でないと早く見抜き、物流担当へ確実に渡すのがこの一件の正解でした。'
},

/* === 10. パリ：SIM清掃を2回試しても戻らない機器故障。長期滞在なら交換 === */
{
  id:'S10', arrive:56, name:'佐伯 奈緒', nameEn:'Nao Saeki', age:41, ageRange:[33,52], type:'anxious', abandonAfter:30, callbackTo:'hotel', stayDays:6,
  deviceInHand:true,
  contractId:{ minutes:2, text:'予約番号はGDW-814263です。あと6日もあるのに…。すみません、ちゃんと控えていてよかった…。' },
  country:'フランス', city:'パリ', cityEn:'PARIS', localOffset:-8, carrierName:'Orange FR', device:'GD-500', plan:'{country} ／ 1GBプラン',
  opening:'3日使えたのに、突然「No SIM」になって…。再起動しても戻りません。このまま全部の予定が駄目になったらと思うと…すみません、助けてください。',
  smalltalk:[{ id:'st_s10_stay', reveal:'q_stay_length', askLabel:'{city}には、あと6日ほどお仕事で滞在されるんですね？', tellLabel:'長いご滞在でのお仕事、お疲れさまです', goodReply:'ありがとうございます…。まだ一人じゃないと思えて、少し落ち着きました。', badReply:'ありがとうございます。でも残り6日、全部使えないままだったらどうしよう…。' }],
  panel:{ bars:null, carrier:null, sim:'none', throttle:false, clients:0, maxClients:5, battery:76, ssid:'Globaldesk-9031' },
  trueCause:'hardware', best:'r_hardware_swap', partial:['r_hardware_no_swap'], shipNeed:'next', wantsReplacement:true,
  replies:{
    q_return:{ text:'部屋にいます。心配で眠れないので、何時でも大丈夫です…。' },
    q_lamp:{ text:'「No SIM」と小さな×です。アンテナも回線名も消えて…。完全に壊れたんでしょうか？',
      fact:{ text:'稼働中だった本体が突然SIMを認識しなくなった', hot:['sim','hardware'], out:['fup','devices','geo_block','carrier','coverage','heavy','device_side','device_net'] } },
    q_when:{ text:'3日間は普通でした。会議後に突然です。落としても濡らしてもいません。本当に何もしていないんです…。',
      fact:{ text:'正常利用3日後に突然発生。落下・水濡れなし', hot:['hardware'], out:['logistics','power'] } },
    q_battery:{ text:'76%です。充電もできます。電源まで止まることはないですよね…？',
      fact:{ text:'電源と充電は正常', out:['power'] } },
    q_stay:{ text:'オペラ地区のホテル、704号室です。ここで待っていれば届きますか？' },
    q_stay_length:{ text:'今日を含めてあと6泊です。6日全部、使えないままにはなりませんよね？',
      fact:{ text:'残り6泊で、交換機を受け取って使う期間が十分にある', hot:['hardware'] } },
    q_replacement:{ text:'はい、直らないなら交換機を送ってください。ホテルで受け取ります。どうか間に合わせてください…。',
      fact:{ text:'本人がホテルへの代替機配送を希望している', hot:['hardware'] } },
  },
  lookups:{
    l_session:{ text:'[セッション] SIMリーダー応答途絶。再起動後もカード検出信号なし。出荷時検品と直近3日間の通信は正常。',
      fact:{ text:'SIMカードではなく本体SIMリーダーの応答が途絶している疑い', hot:['hardware'], out:['provision'] } },
    l_ship:{ text:'[貸出記録] {city}市内デポに交換用GD-500在庫あり。翌日便でホテル配送可能。',
      fact:{ text:'滞在中に使える日程で代替機を配送できる', hot:['hardware'], out:['logistics'] } },
    l_area:{ text:'[エリア照会] {country} ／ GD-500: 対応 ✓ ／ {carrier}: 正常',
      fact:{ text:'渡航先・機種・回線契約は対応範囲内', out:['coverage','carrier','provision'] } },
  },
  tests:{
    t_reboot:{ text:'再起動しました。でも「No SIM」です…。このまま戻らないんでしょうか。', fact:{ text:'再起動でもカード検出が戻らない', out:['power'] } },
    t_simout:{ sequence:[
      { text:'乾いた布で拭いて、挿し直してみました。まだ「No SIM」です…。もう一度やってみましょうか？', fact:{ text:'1回目のSIM清掃では認識しない', hot:['sim','hardware'] } },
      { text:'もう一度、向きも奥まで入ったことも確認しました。それでも「No SIM」です…。もう機械そのものですか？',
        fact:{ text:'SIM清掃と正しい挿し直しを2回行っても認識しない。本体SIMリーダー故障と判断できる', hot:['hardware'], out:['sim','fup','devices','geo_block','heavy','device_side','device_net','location','power','carrier','coverage','provision','logistics'] } },
    ] },
  },
  debrief:'No SIMだからと即交換せず、接点清掃と挿し直しを2回行って接触不良を除外します。それでも戻らず、<em>長期滞在・本人の希望・ホテル配送先</em>が揃ったため、機器故障と診断して代替機を送るのが正解です。短期滞在や交換不要の客に高額配送を押しつけてはいけません。'
},

/* === 11. ローマ：地下の会議室だけ電波が弱い。場所移動で即復旧 === */
{
  id:'S11', arrive:62, name:'川上 亮', nameEn:'Ryo Kawakami', age:36, ageRange:[28,48], type:'hurried', abandonAfter:20, callbackTo:'mobile', stayDays:2,
  deviceInHand:true,
  rushedReply:'はい。場所なら動く。指示を。', contractId:{ minutes:1, text:'GDW-562940。はい、次。' },
  country:'イタリア', city:'ローマ', cityEn:'ROME', localOffset:-8, carrierName:'TIM', device:'GD-500', plan:'{country} ／ 無制限プラン',
  opening:'{city}の会議場。地下へ入ったときだけ圏外。地上では使えました。場所なら動けます。切り分けを急いでいます。次の指示をください。',
  smalltalk:[{ id:'st_s11_meeting', reveal:'opening', askLabel:'この会議場では、どのような会議に参加されるんですか？', tellLabel:'会議場からのお電話、ありがとうございます', goodReply:'海外拠点との会議で使っています。ありがとう。次の確認を。', badReply:'会議内容は後。通信確認を先に。' }],
  panel:{ bars:1, carrier:'{carrier}', sim:'ok', throttle:false, clients:2, maxClients:5, battery:68, ssid:'Globaldesk-6154' },
  trueCause:'location', best:'r_move_guide', partial:['r_window_stationary'],
  replies:{
    q_return:{ text:'会議が終われば部屋に戻る。あと20分くらいか。' },
    q_other_device:{ text:'スマホもPCも駄目。ルーターのアンテナは1本。切り分けを急いでいます。',
      fact:{ text:'複数端末で同じ。本体の受信電波が弱い', hot:['location'], out:['device_side','device_net','hardware'] } },
    q_lamp:{ text:'回線名あり、アンテナ1本、ときどき圏外。SIM認識あり。次。',
      fact:{ text:'SIMとキャリア認識は正常だが受信強度が極端に弱い', hot:['location'], out:['sim','hardware','fup','devices','geo_block','heavy','provision'] } },
    q_where:{ text:'石造りの地下2階、窓なし。地上ロビーでは使えた。移動する？',
      fact:{ text:'遮蔽の強い地下2階でのみ不通。地上では接続実績あり', hot:['location'], out:['coverage','carrier','power'] } },
    q_moved:{ text:'まだ地下。廊下に階段あり。上がればいい？' },
  },
  lookups:{
    l_area:{ text:'[エリア照会] {city}中心部 ／ GD-500: 対応 ✓ ／ {carrier}: 対応 ✓', fact:{ text:'地域と機種は対応範囲内', out:['coverage'] } },
    l_outage:{ text:'[障害情報] {city} {carrier}網 正常。周辺障害なし。', fact:{ text:'現地キャリア障害なし', out:['carrier'] } },
  },
  tests:{
    t_move:{ text:'地上ロビーに出た。アンテナ4本、接続復旧。これで使えます。ありがとう。',
      fact:{ text:'地下から地上へ移動しただけで電波4本となり通信が復旧した', hot:['location'], out:['hardware','sim','carrier','coverage','provision','fup','devices','geo_block','heavy','device_side','device_net','power','logistics'] }, solves:true },
  },
  debrief:'場所が原因なら、設定変更より先に<em>遮蔽物の外へ移動する</em>のが最も速く安全です。地下から地上へ出ただけで電波が1本から4本へ戻りました。場所を変えず再起動を繰り返すのは時間とストレスの無駄です。'
},

/* === 12. シドニー：日付境界で回線停止。契約終了日の登録不備 === */
{
  id:'S12', arrive:68, name:'吉田 和子', nameEn:'Kazuko Yoshida', age:64, ageRange:[56,72], type:'novice', abandonAfter:28, callbackTo:'hotel', stayDays:3,
  deviceInHand:true,
  contractId:{ minutes:3, text:'予約番号ですね…。箱の裏に、GDW-348621とあります。これで合っていますか？' },
  country:'オーストラリア', city:'シドニー', cityEn:'SYDNEY', localOffset:1, carrierName:'Telstra', device:'GD-500', plan:'{country} ／ 無制限プラン',
  opening:'夜になって急に圏外になりました。さっきまで使えていたのに、再起動しても戻りません。私、何か設定を変えてしまったのでしょうか。',
  smalltalk:[{ id:'st_s12_night', reveal:'q_when', askLabel:'夜になってから、急に使えなくなったのですね？', tellLabel:'遅い時間に突然つながらなくなると、ご不安ですよね', goodReply:'そうなんです。日付が変わる頃までは使えていたのですが…。ゆっくり確認していただけると助かります。', badReply:'ありがとうございます。でも、夜になって急に止まった理由が分からなくて…。' }],
  panel:{ bars:0, carrier:null, sim:'ok', throttle:false, clients:2, maxClients:5, battery:73, ssid:'Globaldesk-4826' },
  trueCause:'provision', best:'r_carrier_reopened_explain', partial:[],
  replies:{
    q_return:{ text:'部屋におります。もう休むところでしたけれど、構いませんよ。' },
    q_when:{ text:'時計を見たら、ちょうど日付が変わったあたりです。23時台は使えていて、0時を過ぎた直後から急に圏外になりました。',
      fact:{ text:'現地の日付が変わる境目までは正常で、その直後に回線だけが停止した', hot:['provision'], out:['fup','devices','geo_block','heavy','device_side','device_net','location','power','coverage','sim','hardware','logistics'] } },
    q_lamp:{ text:'「圏外」と出ています。SIMがないという表示はありません。回線名だけが消えています。',
      fact:{ text:'SIMは認識しているが、回線登録だけが失われている', hot:['provision','carrier'], out:['sim','hardware','device_side','device_net'] } },
    q_other_device:{ text:'スマートフォンとパソコンの両方が同じです。どちらもWi-Fiにはつながりますが、インターネットが使えません。',
      fact:{ text:'複数端末が本体には接続できるが、回線通信だけができない', out:['device_side','device_net','devices'] } },
    q_where:{ text:'{city}中心部のホテルです。日付が変わる前は同じ部屋で普通に使えていました。',
      fact:{ text:'同じ市内ホテルの部屋で直前まで通信できていた', out:['location','coverage'] } },
    q_moved:{ text:'ロビーとホテルの外でも試しましたが、圏外のままです。',
      fact:{ text:'ホテル内外へ移動しても圏外のまま', out:['location'] } },
    q_battery:{ text:'73%あります。充電もできています。', fact:{ text:'電源と充電は正常', out:['power'] } },
    q_stay:{ text:'{city}中心部のホテル、512号室です。折り返しでしたら、こちらへお願いします。' },
  },
  lookups:{
    l_plan:{ text:'[契約照会] 契約: 有効 ／ 利用終了予定: 9/4 ／ 使用量: 制限内 ／ 速度制限なし',
      fact:{ text:'自社の契約登録では利用期間内で、容量制限もない', hot:['provision'], out:['fup','heavy','logistics'] } },
    l_session:{ text:'[セッション] 現地時間 23:59 まで通信正常 ／ 00:00 以降、網側から登録拒否 ／ SIM認識: 正常',
      fact:{ text:'日付境界を挟んで網側の登録拒否へ切り替わった', hot:['provision','carrier'], out:['sim','hardware','power'] } },
    l_outage:{ text:'[障害情報] {city}周辺の{carrier} 障害報告なし。', fact:{ text:'周辺の広域障害は報告されていない', out:['carrier'] } },
    l_area:{ text:'[エリア照会] {city}中心部 ／ GD-500: 対応 ✓ ／ {carrier}: 対応 ✓', fact:{ text:'地域と機種は対応範囲内', out:['coverage'] } },
    l_carrier:{ text:'[現地キャリア] 当該回線は現地時間 00:00 に契約満了として停止 ／ 自社登録の終了日と同期不一致 ／ 再開通完了', restores:true,
      fact:{ text:'現地キャリア側だけ終了日が早く登録され、日付境界で停止していた回線の再開通が完了した', hot:['provision'], out:['fup','devices','geo_block','heavy','device_side','device_net','location','power','carrier','coverage','sim','hardware','logistics'] } },
  },
  tests:{
    t_reboot:{ text:'再起動しましたが、やはり圏外です。SIMがないという表示は出ていません。', fact:{ text:'再起動しても回線登録は戻らない', out:['power','device_side'] } },
    t_move:{ text:'ホテルの外まで出ましたが、圏外のままです。', fact:{ text:'屋外へ移動しても回線登録は戻らない', out:['location','coverage'] } },
  },
  debrief:'現地の日付が変わった直後に突然止まったことが重要な手がかりです。自社の契約照会は有効でも、現地キャリアでは終了日が早く登録され、<em>現地時間0時に契約満了として回線が停止</em>していました。現地照会を使えばほぼ確定できますが、日付境界と各原因の除外だけでもプロビジョニング不備へ到達できます。'
},

/* === 13. リスボン：申込国と異なるSIMを貸し出した手配ミス === */
{
  id:'S13', arrive:74, name:'秋山 美咲', nameEn:'Misaki Akiyama', age:32, ageRange:[25,42], type:'anxious', abandonAfter:30, callbackTo:'hotel', stayDays:7,
  deviceInHand:true,
  contractId:{ minutes:2, text:'予約番号はGDW-630519です。受け取ったときの紙にありました。私の扱い方が悪かったのでしょうか…。' },
  country:'ポルトガル', city:'リスボン', cityEn:'LISBON', localOffset:-8, carrierName:'MEO', device:'GD-500', plan:'{country} ／ 無制限プラン',
  opening:'あの…受け取ってから一度もつながらず、ずっと圏外なんです。私が最初の設定を何か間違えたのでしょうか。',
  smalltalk:[{ id:'st_s13_stay', reveal:'q_stay_length', askLabel:'こちらのホテルには、あと7日ほどご滞在の予定ですか？', tellLabel:'長いご滞在の初日からつながらず、ご不安でしたよね', goodReply:'はい、あと7泊ずっと同じホテルです。そう言っていただけると、少し安心します…。', badReply:'はい、あと7泊です。でも初日から使えないのは、やはり私のせいでしょうか…。' }],
  panel:{ bars:0, carrier:null, sim:'ok', throttle:false, clients:2, maxClients:5, battery:82, ssid:'Globaldesk-3418' },
  trueCause:'logistics', best:'r_logistics_replacement', partial:['r_logistics_refund'], shipNeed:'next', wantsReplacement:true,
  replies:{
    q_return:{ text:'部屋にいます。初日から外にも出られなくて…ずっとここです。' },
    q_other_device:{ text:'スマートフォンもパソコンも同じです。Wi-Fiの名前にはつながりますが、インターネットは使えません。',
      fact:{ text:'複数端末が本体には接続できるが、回線通信だけができない', out:['device_side','device_net','devices'] } },
    q_lamp:{ text:'画面には「圏外」と出ています。アンテナの棒が、ずっと0本のままで…。',
      fact:{ text:'SIMは認識しているが、到着時から現地回線を一度も捕捉していない', hot:['coverage','provision','logistics'], out:['sim','device_side','device_net'] } },
    q_when:{ text:'今日、空港で受け取ってホテルに着いてからです。箱から出した最初の電源投入から、一度もつながっていません。',
      fact:{ text:'機器は受取済みで、初回起動から一度も通信できていない', hot:['coverage','provision','logistics'], out:['fup','heavy'] } },
    q_where:{ text:'{city}中心部のホテルです。部屋でもロビーでも、外へ出ても同じでした。',
      fact:{ text:'市内ホテルの内外で圏外が続く', out:['location'] } },
    q_battery:{ text:'82%です。充電もできています。電池は足りていますよね…？', fact:{ text:'電源と充電は正常', out:['power'] } },
    q_stay:{ text:'{city}中心部のホテル、608号室です。滞在中はずっとこちらにいます。' },
    q_stay_length:{ text:'今日を含めてあと7泊です。帰国まで同じホテルに滞在します。',
      fact:{ text:'残り7泊、同じホテルに滞在するため代替機を使える期間が十分にある', hot:['logistics'] } },
    q_replacement:{ text:'はい、使えるものが届くなら代替機を送ってください。ホテルで受け取ります。',
      fact:{ text:'本人が同じホテルへの代替機配送を希望している', hot:['logistics'] } },
  },
  lookups:{
    l_plan:{ text:'[契約照会] 申込: {country} ／ 契約: 有効 ／ 使用量: 制限内 ／ 速度制限なし',
      fact:{ text:'{country}向け契約は有効で、使用量も制限内', out:['fup','heavy'] } },
    l_ship:{ text:'[貸出記録] 申込: {country} ／ 貸出品: {wrongCountry}向けSIM ／ {country}: 利用不可 ／ 貸出済み ／ 市内デポに対応代替機あり',
      fact:{ text:'申込国と異なる利用不可SIMを貸し出した自社の手配ミス', hot:['logistics'], out:['fup','devices','geo_block','heavy','device_side','device_net','location','power','carrier','coverage','sim','hardware','provision'] } },
    l_outage:{ text:'[障害情報] {city}周辺の{carrier} 障害報告なし。', fact:{ text:'現地キャリアに広域障害なし', out:['carrier'] } },
    l_area:{ text:'[エリア照会] {country} ／ 貸出機種 GD-500: 対応 ✓ ／ {country}向けSIM: 対応 ✓',
      fact:{ text:'地域と機種は対応範囲内で、正しいSIMなら利用できる', out:['coverage'] } },
  },
  tests:{
    t_reboot:{ text:'再起動しました。でも圏外のままです。私の押し方が悪いわけではないんですね…？', fact:{ text:'再起動でも回線を捕捉しない', out:['power','device_side'] } },
    t_move:{ text:'ホテルの外まで出ましたが、やはり圏外です。', fact:{ text:'屋外へ移動しても圏外のまま', out:['location','coverage'] } },
  },
  debrief:'契約は有効でも、貸出記録には<em>申込国と違う、その国では利用できないSIM</em>が記録されていました。お客様は自分の設定ミスだと思っていましたが、原因は自社の手配ミスです。非を隠さず先にお詫びし、長期滞在・同じホテル・本人の希望を確認したうえで、使える代替機を届けるのが最適です。返金だけでは、残りの滞在中も通信が使えません。'
},

/* === 14. 台北：容量超過。実務でいちばん多い問い合わせを、素直な形でもう一件置く ===
   S1と真因は同じだが、あちらが「自分のせいだ」と怯える客なのに対し、
   こちらは「無制限だと思っていた」と食ってかかる客。同じ答えでも通し方が変わる。 */
{
  id:'S14', arrive:80, name:'原口 大地', nameEn:'Daichi Haraguchi', age:24, ageRange:[21,32], type:'hurried', abandonAfter:24, callbackTo:'mobile', stayDays:2,
  deviceInHand:true,
  rushedReply:'はい。挨拶はいいです。原因を。', contractId:{ minutes:1, text:'GDW-771403。控えてあります。次。' },
  country:'台湾', city:'台北', cityEn:'TAIPEI', localOffset:-1, carrierName:'Chunghwa Telecom', device:'GD-500', plan:'{country} ／ 1GBプラン',
  opening:'昼から急に遅いです。動画は止まるし、地図もなかなか出ません。使い放題のはずでは？ 原因を短くお願いします。',
  smalltalk:[{ id:'st_s14_work', reveal:'q_destination', askLabel:'お仕事で{city}へいらしているんですか？', tellLabel:'移動の合間にご不便をおかけしています', goodReply:'出張です。移動中に資料を落とすので通信は要ります。で、原因は？', badReply:'その話は後で。遅い理由を先に教えてください。' }],
  panel:{ bars:4, carrier:'{carrier}', sim:'ok', throttle:true, clients:1, maxClients:5, battery:58, ssid:'Globaldesk-3390' },
  trueCause:'fup', best:'r_topup', partial:['r_slow_ok'],
  replies:{
    q_return:{ text:'もう部屋。朝まではここにいる。' },
    q_when:{ text:'昼過ぎからです。午前は普通に見られました。急に落ちた感じです。',
      fact:{ text:'午前は正常で、昼過ぎから急に低速化した', hot:['fup'] } },
    q_lamp:{ text:'棒は4本立っています。その下に小さい亀みたいな印が出ています。これ何ですか。',
      fact:{ text:'アンテナ4本。本体に速度制限アイコンが表示されている', hot:['fup'], out:['sim','carrier','coverage'] } },
    q_other_device:{ text:'パソコンでも同じです。両方遅い。端末の問題ではないですよね。',
      fact:{ text:'複数端末で同じように遅い。端末固有ではない', out:['device_side','device_net'] } },
    q_count:{ text:'私のスマホ1台だけです。ほかは繋いでいません。',
      fact:{ text:'接続は1台のみ', out:['devices'] } },
    q_what_fails:{ text:'全部です。特定のサービスだけということはありません。とにかく全体が重い。',
      fact:{ text:'特定サービスではなく全体が低速', out:['geo_block'] } },
    q_stay:{ text:'{city}駅前のホテル、704号室です。ただ日中は外に出ています。' },
  },
  lookups:{
    l_plan:{ text:'[契約照会] プラン: 1GB/日 ／ 本日の使用量: 1,024MB（上限到達）／ 現在 速度制限中（最大128kbps）／ 追加購入: 未適用',
      fact:{ text:'本日の使用量が上限1GBに到達し、速度制限がかかっている', hot:['fup'], out:['heavy','location','power','hardware','provision'] },
      viz:{ label:'本日の使用量', value:1024, max:1024, unit:'MB', note:'1GBプラン' } },
    l_outage:{ text:'[障害情報] {country} {carrier} 網 正常。障害報告なし。',
      fact:{ text:'現地キャリアに障害なし', out:['carrier'] } },
  },
  debrief:'いちばん件数の多い問い合わせです。<em>「無制限だと思っていた」という思い込みと、実際の契約内容の食い違い</em>が正体で、機器はどこも壊れていません。契約照会で使用量の数字を出せば、その場で確定できます。急いでいる相手なので、原因を短く言い切ってから追加購入の選択肢を示すのが最短です。容量が戻るのは翌日で、今日中に使いたいなら追加購入しかない、という順番で伝えてください。'
},

];

/* §41: 顧客レコード用の人物・渡航情報。滞在日数は案件の筋に従う。 */
const SCENARIO_RECORD_META = Object.freeze([
  {gender:'female',tripDay:3,tripDays:5,stayHint:'新婚旅行の途中なので、二人の予定が止まると困ります。'},
  {gender:'male',tripDay:2,tripDays:5,stayHint:'旅行の途中で、家族との予定もまだ残っています。'},
  {gender:'female',tripDay:2,tripDays:4,stayHint:'明日は次の街へ移る予定で、今夜中に確認したいです。'},
  {gender:'male',tripDay:2,tripDays:6,stayHint:'出張先での会議が続くので、通信が要ります。'},
  {gender:'female',tripDay:2,tripDays:4,stayHint:'帰国前の仕事の連絡が残っていて、すぐ確認したいです。'},
  {gender:'male',tripDay:2,tripDays:5,stayHint:'こちらでの滞在中に資料を仕上げる必要があります。'},
  {gender:'male',tripDay:3,tripDays:9,stayHint:'郊外での仕事が今週いっぱい続く予定です。'},
  {gender:'female',tripDay:1,tripDays:3,stayHint:'短い旅行なので、今夜の予定に間に合わせたいです。'},
  {gender:'female',tripDay:1,tripDays:3,stayHint:'今夜は市内に泊まり、明日は次の予定へ向かいます。'},
  {gender:'female',tripDay:4,tripDays:10,stayHint:'出張はまだ続くので、このまま使えないと本当に困ります。'},
  {gender:'male',tripDay:2,tripDays:4,stayHint:'会議は明日までで、地下でも連絡を取りたいです。'},
  {gender:'female',tripDay:2,tripDays:5,stayHint:'旅行の序盤なので、帰国前に連絡が取れないと困ります。'},
  {gender:'female',tripDay:1,tripDays:8,stayHint:'長い滞在の初日から、ずっと不安なんです。',deliveryAddress:'次のホテル、214号室'},
  {gender:'male',tripDay:2,tripDays:4,stayHint:'明日の移動までに、必要な連絡を済ませたいです。'},
]);
SCENARIOS.forEach((scenario, index) => {
  const meta = SCENARIO_RECORD_META[index];
  Object.assign(scenario, meta);
});

/* 名前・年齢・性別と土地は、シフト開始時に案件本体から切り離して割り当てる。
   §47: 名前は14案件の切り出しをやめ、性別つきの候補48名から引く。ageBand は名前が
   自然に見える年齢の幅で、案件の ageRange と重なる名前だけが候補になる。
   （71歳の「結衣」や24歳の「和子」を出さないため。） */
const NAME_POOL = Object.freeze([
  Object.freeze({ name:'三宅 千夏',   nameEn:'Chika Miyake',       gender:'female', ageBand:[21,40] }),
  Object.freeze({ name:'田辺 幸子',   nameEn:'Sachiko Tanabe',     gender:'female', ageBand:[55,80] }),
  Object.freeze({ name:'小林 亜衣',   nameEn:'Ai Kobayashi',       gender:'female', ageBand:[21,40] }),
  Object.freeze({ name:'藤川 みどり', nameEn:'Midori Fujikawa',    gender:'female', ageBand:[45,70] }),
  Object.freeze({ name:'佐伯 奈緒',   nameEn:'Nao Saeki',          gender:'female', ageBand:[24,48] }),
  Object.freeze({ name:'吉田 和子',   nameEn:'Kazuko Yoshida',     gender:'female', ageBand:[55,80] }),
  Object.freeze({ name:'秋山 美咲',   nameEn:'Misaki Akiyama',     gender:'female', ageBand:[21,40] }),
  Object.freeze({ name:'石橋 玲',     nameEn:'Rei Ishibashi',      gender:'female', ageBand:[24,45] }),
  Object.freeze({ name:'岡田 真理',   nameEn:'Mari Okada',         gender:'female', ageBand:[28,52] }),
  Object.freeze({ name:'西村 遥',     nameEn:'Haruka Nishimura',   gender:'female', ageBand:[21,38] }),
  Object.freeze({ name:'小野 詩織',   nameEn:'Shiori Ono',         gender:'female', ageBand:[21,40] }),
  Object.freeze({ name:'長谷川 佳奈', nameEn:'Kana Hasegawa',      gender:'female', ageBand:[22,42] }),
  Object.freeze({ name:'内藤 沙織',   nameEn:'Saori Naito',        gender:'female', ageBand:[26,48] }),
  Object.freeze({ name:'木下 陽子',   nameEn:'Yoko Kinoshita',     gender:'female', ageBand:[40,65] }),
  Object.freeze({ name:'平井 里美',   nameEn:'Satomi Hirai',       gender:'female', ageBand:[30,55] }),
  Object.freeze({ name:'宮本 結衣',   nameEn:'Yui Miyamoto',       gender:'female', ageBand:[20,35] }),
  Object.freeze({ name:'坂口 恵美',   nameEn:'Emi Sakaguchi',      gender:'female', ageBand:[28,50] }),
  Object.freeze({ name:'上田 智子',   nameEn:'Tomoko Ueda',        gender:'female', ageBand:[35,60] }),
  Object.freeze({ name:'中川 由紀',   nameEn:'Yuki Nakagawa',      gender:'female', ageBand:[26,50] }),
  Object.freeze({ name:'松原 かおり', nameEn:'Kaori Matsubara',    gender:'female', ageBand:[30,55] }),
  Object.freeze({ name:'荒木 千鶴',   nameEn:'Chizuru Araki',      gender:'female', ageBand:[45,72] }),
  Object.freeze({ name:'谷口 麻衣',   nameEn:'Mai Taniguchi',      gender:'female', ageBand:[21,40] }),
  Object.freeze({ name:'服部 久美',   nameEn:'Kumi Hattori',       gender:'female', ageBand:[40,65] }),
  Object.freeze({ name:'大槻 綾',     nameEn:'Aya Otsuki',         gender:'female', ageBand:[22,42] }),
  Object.freeze({ name:'大久保 健',   nameEn:'Ken Okubo',          gender:'male',   ageBand:[30,58] }),
  Object.freeze({ name:'森 達彦',     nameEn:'Tatsuhiko Mori',     gender:'male',   ageBand:[35,62] }),
  Object.freeze({ name:'渡辺 圭吾',   nameEn:'Keigo Watanabe',     gender:'male',   ageBand:[26,50] }),
  Object.freeze({ name:'中西 悠真',   nameEn:'Yuma Nakanishi',     gender:'male',   ageBand:[20,36] }),
  Object.freeze({ name:'川上 亮',     nameEn:'Ryo Kawakami',       gender:'male',   ageBand:[22,44] }),
  Object.freeze({ name:'原口 大地',   nameEn:'Daichi Haraguchi',   gender:'male',   ageBand:[20,36] }),
  Object.freeze({ name:'青木 慎一',   nameEn:'Shinichi Aoki',      gender:'male',   ageBand:[38,66] }),
  Object.freeze({ name:'岩田 浩二',   nameEn:'Koji Iwata',         gender:'male',   ageBand:[40,68] }),
  Object.freeze({ name:'篠原 拓也',   nameEn:'Takuya Shinohara',   gender:'male',   ageBand:[24,45] }),
  Object.freeze({ name:'堀内 誠',     nameEn:'Makoto Horiuchi',    gender:'male',   ageBand:[30,58] }),
  Object.freeze({ name:'村田 隆',     nameEn:'Takashi Murata',     gender:'male',   ageBand:[42,70] }),
  Object.freeze({ name:'相沢 康平',   nameEn:'Kohei Aizawa',       gender:'male',   ageBand:[26,48] }),
  Object.freeze({ name:'福井 直樹',   nameEn:'Naoki Fukui',        gender:'male',   ageBand:[28,52] }),
  Object.freeze({ name:'樋口 正和',   nameEn:'Masakazu Higuchi',   gender:'male',   ageBand:[40,68] }),
  Object.freeze({ name:'三浦 亮太',   nameEn:'Ryota Miura',        gender:'male',   ageBand:[21,40] }),
  Object.freeze({ name:'本間 英治',   nameEn:'Eiji Homma',         gender:'male',   ageBand:[38,64] }),
  Object.freeze({ name:'柳沢 俊介',   nameEn:'Shunsuke Yanagisawa',gender:'male',   ageBand:[24,46] }),
  Object.freeze({ name:'沢田 一馬',   nameEn:'Kazuma Sawada',      gender:'male',   ageBand:[22,42] }),
  Object.freeze({ name:'神谷 悠',     nameEn:'Yu Kamiya',          gender:'male',   ageBand:[20,38] }),
  Object.freeze({ name:'増田 和樹',   nameEn:'Kazuki Masuda',      gender:'male',   ageBand:[24,46] }),
  Object.freeze({ name:'河野 宗一郎', nameEn:'Soichiro Kono',      gender:'male',   ageBand:[45,72] }),
  Object.freeze({ name:'都築 陽介',   nameEn:'Yosuke Tsuzuki',     gender:'male',   ageBand:[22,42] }),
  Object.freeze({ name:'高梨 修',     nameEn:'Osamu Takanashi',    gender:'male',   ageBand:[40,68] }),
  Object.freeze({ name:'白石 大介',   nameEn:'Daisuke Shiraishi',  gender:'male',   ageBand:[28,52] }),
]);

/* キャリア名と地域も土地に従属する。sourceScenarioId は shuffleIdentity:false の復元に使う。 */
const PLACE_POOL = Object.freeze(SCENARIOS.map(scenario => Object.freeze({
  sourceScenarioId:scenario.id,
  country:scenario.country,
  city:scenario.city,
  cityEn:scenario.cityEn,
  localOffset:scenario.localOffset,
  regionGroup:scenario.regionGroup || null,
  regionName:scenario.regionName || scenario.country,
  carrier:scenario.carrierName,
})));

const PLACE_CONSTRAINTS = Object.freeze({
  geo_block:'china_only',
  provision:'deep_night',
});
