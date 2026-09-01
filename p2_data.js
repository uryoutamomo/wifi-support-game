/* ============================================================
   データ定義
   ============================================================ */

const TURN_MIN = 1;          // 時間進行の最小単位＝ゲーム内1分
const SHIFT_START = 22 * 60; // 22:00 JST
const ESCALATIONS = 3;       // 1シフトのエスカレーション枠
const CALLBACKS = 4;         // 1シフトの折り返し枠
const LUCK_RATE = 0.9;       // 本来どおりに転ぶ確率
const GAME_FLAGS = {
  luckRate: LUCK_RATE,
  shuffleArrival: true,
  dailyTickets: null,
  careerStage: null,
  unlockedBadges: null,
  soundEnabled: true,
  soundVolume: 0.55,
};

const REFUND_POLICY = Object.freeze({
  amount: 2400,
  company: Object.freeze({ causes:Object.freeze(['hardware','provision','logistics','carrier','coverage']), satisfactionRate:0.5 }),
  customer: Object.freeze({ causes:Object.freeze(['fup','devices','heavy','device_side','device_net','power']), satisfactionRate:0.1 }),
  neutral: Object.freeze({ causes:Object.freeze(['location','geo_block','sim']), satisfactionRate:0.25 }),
});

const COMMAND_DEFS = Object.freeze([
  Object.freeze({ id:'ask',      no:'1', label:'聞く' }),
  Object.freeze({ id:'lookup',   no:'2', label:'調べる' }),
  Object.freeze({ id:'test',     no:'3', label:'操作' }),
  Object.freeze({ id:'tell',     no:'4', label:'伝える' }),
  Object.freeze({ id:'callback', no:'5', label:'折り返す' }),
  Object.freeze({ id:'record',   no:'6', label:'ログ' }),
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
  Object.freeze({ id:'quiet_night', label:'静かな夜', condition:'全案件で苛立ちが一度も50%を超えない' }),
  Object.freeze({ id:'no_redial', label:'一度でつながる', condition:'再入電0件・放棄呼0件' }),
  Object.freeze({ id:'frugal', label:'倹約家', condition:'シフトの総費用0円' }),
  Object.freeze({ id:'all_first', label:'一発解決', condition:'全案件が一次解決' }),
  Object.freeze({ id:'storm', label:'嵐の夜', condition:'同じ夜に苦情と一方的切断の両方が発生' }),
  Object.freeze({ id:'money_talks', label:'お金で解決', condition:'全案件で返金を実施' }),
  Object.freeze({ id:'ten_nights', label:'十夜勤', condition:'通算10シフトを完了' }),
  Object.freeze({ id:'clean_record', label:'無苦情記録', condition:'直近3シフトの苦情が0件' }),
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
  anxious: { label:'不安が強い', tone:'warm', note:'落ち着いて、噛み砕いた言葉で。', stressStart:20, stressRate:1.2, missRate:1.0, sootheReply:'…本当に、戻るんですね。すみません…お願いします。', sootheMissReply:'でも、まだ何も戻っていなくて…怖いんです。', sootheRepeatReply:'さっきも同じ言葉で…。本当に置いていきませんよね？',
    irritated:['あの…このまま全部だめになったりしませんよね？', 'すみません、手が震えてきて…。'],
    angry:['もう無理です…私、何か壊したんでしょうか？', 'お願いです、置いていかないでください。泣きそうです…。'],
    furious:['もう限界です…誰か、最後まで助けてください…！', '責任者の方に代わってください。私、このままでは話せません…。'] },
  novice:  { label:'機器に不慣れ', tone:'warm', note:'専門用語は通じない。手順は一つずつ。', stressStart:5, stressRate:0.9, missRate:1.0, sootheReply:'あ、はい…私にもできるよう、一つずつお願いできますか。', sootheMissReply:'すみません、その説明もよく分からなくて…。', sootheRepeatReply:'同じことを言われても、次に押す所が分からないんです…。',
    irritated:['あの、その言葉が分からなくて…すみません。', '私、また違う所を押しましたか…？'],
    angry:['やっぱり私には無理なんですね…。', '何度も聞いてごめんなさい。もう手が動かなくて…。'],
    furious:['すみません、もう怖くて触れません。どなたか代わってください。', '私が壊したのでしょうか…。契約を続ける自信がありません。'] },
  expert:  { label:'技術に明るい', tone:'technical', note:'噛み砕きすぎると、軽く扱われたと感じる。', stressStart:5, stressRate:1.0, missRate:2.0, sootheReply:'整理は妥当です。その順で進めてください。', sootheMissReply:'安心の話ではなく、仮説と観測結果を示してください。', sootheRepeatReply:'同じ説明は不要です。検証結果を更新してください。',
    irritated:['その質問は、どの仮説を切るためですか。', '先ほどの観測結果と重複しています。'],
    angry:['切り分けの順序が逆です。根拠を示してください。', 'その説明では一次障害と端末要因を区別できません。'],
    furious:['これ以上は検証になりません。責任者へ引き継いでください。', 'この品質なら、契約継続は再検討します。記録を残してください。'] },
  hurried: { label:'急いでいる', tone:'brief', note:'前置きは邪魔。結論から短く。', stressStart:15, stressRate:1.6, missRate:1.3, sootheReply:'分かった。次。結論から。', sootheMissReply:'落ち着く話は後。結論を。', sootheRepeatReply:'それは聞いた。次へ。',
    irritated:['あと何分？ バス、もう着きます。', '前置きはいい。次は？'],
    angry:['その話、後。結論を言って。', '時計見てます？ 会議が始まる。急いで。'],
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
  }),
  lookup:Object.freeze({
    holdStart:'確認いたしますので、少々お待ちください。',
    talkStart:'お話ししながら確認いたしますね。',
    completePrefix:'お待たせしました。確認結果は、',
    miss:'該当する記録は確認できませんでした。',
  }),
  recordStart:'少し記録を確認させてください。',
  interrupt:'申し訳ございません、一度お切りします。',
  redialGreeting:'先ほどは通話が切れてしまい、申し訳ございません。',
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

const TONES = [
  { id:'technical', name:'技術的に', sub:'用語をそのまま使い、手順を番号で正確に伝える' },
  { id:'warm',      name:'噛み砕いて', sub:'専門用語を避け、一つずつ確認しながら伝える' },
  { id:'brief',     name:'手短に',   sub:'前置きを省き、やることだけを結論から伝える' },
];

/* ---------- 質問プール ---------- */

const QUESTIONS = [
  { id:'q_name', label:'恐れ入ります、お名前をフルネームでうかがえますか', miss:'…名前ですか。えっと、それ、いま必要ですか？' },
  { id:'q_destination', label:'いま、どちらの国・都市にいらっしゃいますか', miss:'さっき申し上げたと思うんですけど。' },
  { id:'q_contract', label:'ご予約番号（契約番号）はお手元にございますか', miss:'番号ですか…すみません、いますぐには分からなくて。' },
  { id:'q_other_device', label:'ほかの端末でも同じ状態ですか？',
    miss:'ええと…ほかの端末は、いま試せる状況になくて。' },
  { id:'q_lamp', label:'本体の画面表示とアンテナの状態を教えてください',
    miss:'見てみます…とくに変わったところはないと思うんですけど。' },
  { id:'q_ssid', label:'Wi-Fiの一覧に、ルーターの名前は出ていますか？',
    miss:'名前は出ています。そこは問題なさそうです。' },
  { id:'q_when', label:'いつから、直前に何をされていましたか？',
    miss:'いつから、と言われると…気づいたらこうなっていた感じで。' },
  { id:'q_count', label:'いま何台つないでいらっしゃいますか？',
    miss:'台数ですか。そんなに繋いでいないと思います。' },
  { id:'q_where', label:'いま、どのような場所にいらっしゃいますか？',
    miss:'普通の建物の中です。とくに変わった場所ではないです。' },
  { id:'q_moved', label:'別の場所でも試されましたか？',
    miss:'いえ、そこまではまだ試していないです。' },
  { id:'q_battery', label:'本体のバッテリー残量はどのくらいですか？',
    miss:'半分くらいはあります。電池は大丈夫そうです。' },
  { id:'q_what_fails', label:'開けないのは特定のサービスだけですか、全部ですか？',
    miss:'全部です。特定のものだけ、ということはないです。' },
  { id:'q_stay', label:'ご滞在先（ホテル名とお部屋番号）を教えてください',
    miss:'ホテルですけど…それが何か関係あるんでしょうか。' },
  { id:'q_stay_length', label:'あと何日ほどご滞在の予定ですか',
    miss:'日程ですか。すぐには確認できません。' },
  { id:'q_replacement', label:'直らない場合、代替機の配送をご希望ですか',
    miss:'まだ原因も分からないのに、交換の話ですか？' },
];

const QUESTION_GROUPS = Object.freeze([
  Object.freeze({ id:'customer', no:'1', label:'顧客のこと', questionIds:Object.freeze(['q_name','q_contract','q_stay','q_stay_length','q_replacement']) }),
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

/* ---------- 社内照会プール ---------- */

const LOOKUPS = [
  { id:'l_plan',    label:'契約プランとデータ使用量を照会', miss:'[契約照会] 契約: 有効 ／ 使用量: 制限内 ／ 速度制限なし' },
  { id:'l_session', label:'ルーターの接続セッション履歴を照会', miss:'[セッション] 直近の異常イベントなし。SIM認識 正常。' },
  { id:'l_outage',  label:'現地キャリアの障害情報を確認', miss:'[障害情報] 該当エリアの提携キャリア 障害報告なし。' },
  { id:'l_area',    label:'渡航先の対応エリアと機種対応を確認', miss:'[エリア照会] 渡航先: 対応地域内 ／ 貸出機種: 対応 ✓' },
  { id:'l_ship',    label:'貸出・返却・配送の記録を照会', miss:'[貸出記録] 通常の貸出。受取済み・返却期限内。特記事項なし。',
    missFact:{ text:'貸出・返却に問題はなく、物流側の案件ではない', out:['logistics'] } },
];

/* ---------- 低リスク操作（通話をつないだまま実行） ---------- */

const TESTS = [
  { id:'t_reboot',     label:'ルーターの再起動をご案内する', turns:3, wait:'再起動をお願いしました。立ち上がるまで少しかかります。' },
  { id:'t_simout',     label:'SIMを抜き差しし、接点を乾いた柔らかい布で清掃していただく', turns:2,
    wait:'電源はそのままで、SIMの抜き差しと接点の清掃をお願いしました。', sub:'No SIM／SIM未認識の表示があるときの重要な復旧操作' },
  { id:'t_forget',     label:'端末のWi-Fi設定を一度削除して、繋ぎ直していただく', turns:3, wait:'設定の削除と再接続をお願いしました。操作していただいています。' },
  { id:'t_move',       label:'窓際か屋外へ移動して試していただく', turns:4, wait:'場所を移っていただいています。' },
  { id:'t_disconnect', label:'使っていない端末をWi-Fiから切っていただく', turns:2, wait:'不要な端末を切っていただいています。' },
  { id:'t_charge',     label:'付属のケーブルとアダプタで充電していただく', turns:5, wait:'充電をお願いしました。しばらく様子を見ます。' },
];

/* 危険な操作。選べるが、初手の正解にはならない */
const RISKY = [
  { id:'t_reset', label:'本体を初期化（工場出荷リセット）していただく', turns:2,
    wait:'初期化をお願いしました。',
    result:'（操作後）…あの、画面が英語だらけになって、何も繋がらなくなりました。前より悪くなってませんか？',
    note:'初期化で回線設定ごと飛んだ。サポート側の指示なく客に踏ませてよい操作ではない。', damage:1.5 },
  { id:'t_apn', label:'スマートフォンのAPN設定を書き換えていただく', turns:2,
    wait:'端末のAPN設定を開いていただいています。',
    result:'（操作後）言われたとおり入れましたけど、何も変わりません。元の設定も分からなくなりました。',
    note:'レンタルWiFiのAPNはルーター内のSIM側の設定で、客のスマホには関係がない。手元の端末を壊しただけ。', damage:1.5 },
  { id:'t_roaming', label:'端末のデータローミングをONにしていただく', turns:1,
    wait:'端末のデータローミング設定を確認していただいています。',
    result:'（操作後）ONにしました。…変わりません。というか、これ日本の携帯代がかかったりしませんか？',
    note:'データローミングは自分のキャリア回線を海外で使う設定。Pocket WiFiの復旧策ではなく、高額請求の入口になる。', damage:1.0 },
];

/* ---------- 対処（原因ごと） ---------- */

const REMEDIES = {
  fup: [
    { id:'r_topup', label:'追加データの購入方法をご案内し、その場で適用する', sub:'当日中に速度が戻る。追加料金は客側の任意', kind:'resolve' },
    { id:'r_slow_ok', label:'制限は明日リセットされる旨を伝え、今日は低速のまま使っていただく', sub:'費用はかからないが、今日の不便は残る', kind:'resolve' },
  ],
  devices: [
    { id:'r_disconnect', label:'接続台数の上限を説明し、使っていない端末を切っていただく', sub:'その場で解決する', kind:'resolve' },
    { id:'r_second_unit', label:'2台目のルーターを追加で手配する', sub:'解決はするが配送に時間と費用がかかる', kind:'resolve', cost:12000 },
  ],
  geo_block: [
    { id:'r_vpn_plan', label:'VPN付きオプションの追加を手配する', sub:'当日中に適用され、規制対象のサービスに繋がる', kind:'resolve', cost:3200 },
    { id:'r_explain_block', label:'現地の通信規制であることだけを説明して終話する', sub:'原因は伝わるが、客の問題は解決しない', kind:'resolve' },
  ],
  heavy: [
    { id:'r_throttle_talk', label:'大容量通信をしている端末を特定して控えていただく', sub:'その場で改善する', kind:'resolve' },
  ],
  device_side: [
    { id:'r_forget_guide', label:'その端末のWi-Fi設定を削除して繋ぎ直す手順をご案内する', sub:'端末側の情報を作り直す。低リスク', kind:'resolve' },
    { id:'r_use_other', label:'ほかの端末を使っていただくよう案内する', sub:'その場はしのげるが、原因は残る', kind:'resolve' },
  ],
  device_net: [
    { id:'r_vpn_off', label:'端末のVPN／プロファイル設定を一度切っていただく', sub:'端末側の設定を戻す。低リスク', kind:'resolve' },
  ],
  location: [
    { id:'r_move_guide', label:'電波の入る場所の目安をご案内する', sub:'実際に移動して改善したことを確認してから案内する', kind:'resolve', needsTest:'t_move' },
    { id:'r_window_stationary', label:'ルーターを地上階の窓際に置いたまま使うよう案内する', sub:'通信は戻るが、地下の会議室へ持ち込めず不便が残る', kind:'resolve' },
  ],
  power: [
    { id:'r_charge_guide', label:'付属アダプタでの充電と、使わない時間の電源オフをご案内する', sub:'消耗の理由も添えて伝える', kind:'resolve' },
  ],
  carrier: [
    { id:'r_outage_explain', label:'広域障害であることと復旧見込みを説明し、日割りの返金を案内する', sub:'原因が判明している場合の正規対応', kind:'resolve', needsOutage:true, cost:2400 },
    { id:'r_escalate_line', label:'回線障害の疑いとして技術部門へエスカレーションする', sub:'枠を1つ消費。確実だが自己解決にはならない', kind:'escalate' },
    { id:'r_swap_unit', label:'本体の不具合とみて代替機を手配する', sub:'網側の障害なら代替機を送っても直らない', kind:'resolve', cost:28000 },
  ],
  coverage: [
    { id:'r_escalate_band', label:'対応バンドの広い機種への交換を技術部門へエスカレーションする', sub:'枠を1つ消費。機種を変えないと解決しない', kind:'escalate', cost:28000 },
    { id:'r_swap_same', label:'同じ機種の代替機を手配する', sub:'同型機では同じ場所でまた圏外になる', kind:'resolve', cost:28000 },
    { id:'r_city_only', label:'市内であれば使える旨を説明して終話する', sub:'客の予定は変えられない', kind:'resolve' },
  ],
  sim: [
    { id:'r_sim_clean', label:'2回目のSIM抜き差しと接点清掃で認識が戻ったことを確認し、利用を再開していただく', sub:'1回で戻らなくても、接触位置が変わる2回目で復旧する場合がある', kind:'resolve', needsTest:'t_simout', needsTestCount:2 },
    { id:'r_escalate_swap', label:'2回清掃してもSIMを認識しないため、機器故障として切り分ける', sub:'交換判断へ進む前に、接触不良の可能性を2回試す', kind:'escalate', needsTest:'t_simout', needsTestCount:2 },
    { id:'r_reboot_again', label:'もう一度、時間を置いて再起動していただく', sub:'SIM接点の問題には届かない', kind:'resolve' },
  ],
  hardware: [
    { id:'r_hardware_swap', label:'本体の機器故障と診断し、希望を確認して代替機を配送する', sub:'長期滞在で、本人が交換を希望する場合の正規対応', kind:'escalate', cost:28000, needsTest:'t_simout', needsTestCount:2,
      requiresQuestions:['q_stay','q_stay_length','q_replacement'], requiresLongStay:3, requiresConsent:true },
    { id:'r_hardware_no_swap', label:'機器故障と診断し、交換せず利用料金の返金だけを案内する', sub:'短期滞在または配送を希望しない場合', kind:'escalate', needsTest:'t_simout', needsTestCount:2 },
  ],
  provision: [
    { id:'r_escalate_prov', label:'開通設定の不備としてプロビジョニング担当へエスカレーションする', sub:'枠を1つ消費', kind:'escalate' },
  ],
  logistics: [
    { id:'r_transfer_logi', label:'物流・カウンター担当へ引き継ぎ、宿泊先への当日配送を手配する', sub:'エスカレーション枠は消費しない別系統', kind:'transfer', cost:4800 },
    { id:'r_come_tomorrow', label:'翌朝あらためてカウンターへ寄っていただくよう案内する', sub:'客の初日が丸ごと潰れる', kind:'resolve' },
  ],
};

/* ---------- シナリオ ---------- */

const SCENARIOS = [

/* === 1. バンコク：容量超過。導入。社内照会で確定できる === */
{
  id:'S1', arrive:0, name:'三宅 千夏', age:27, type:'anxious', abandonAfter:32, callbackTo:'hotel',
  contractId:{ minutes:2, text:'予約番号…はい、探します。手が震えて…すみません。ありました。GDW-410882、これで合っていますか？' },
  city:'バンコク', cityEn:'BANGKOK', localOffset:-2, device:'GD-500', plan:'タイ ／ 500MBプラン',
  opening:'あの…地図が全然開かないんです。昨日まで使えたのに、今日だけ急に遅くて…。どうしたらいいでしょうか。',
  smalltalk:[
    { id:'st_s1_trip', reveal:'q_when', askLabel:'バンコクでは、どちらを回られるご予定ですか？', tellLabel:'新婚旅行、おめでとうございます', goodReply:'ありがとうございます…。夫と一緒だと思ったら、少し息ができました。', badReply:'ありがとうございます。でも地図がないと、ホテルにも戻れなくなりそうで…。' },
    { id:'st_s1_movie', reveal:'q_when', askLabel:'昨夜は、どのような映画をご覧になったんですか？', tellLabel:'お二人で映画を楽しまれたんですね', goodReply:'はい…つい見入ってしまって。思い出したら、少し落ち着きました。', badReply:'映画の話をしたら、私が使いすぎたせいって決まるんでしょうか…？' },
  ],
  panel:{ bars:3, carrier:'AIS', sim:'ok', throttle:true, clients:2, maxClients:5, battery:62, ssid:'Globaldesk-2210' },
  trueCause:'fup', best:'r_topup', partial:['r_slow_ok'],
  replies:{
    q_other_device:{ text:'夫のスマホも同じです。二人とも遅くて…。端末まで二つとも壊れたんでしょうか？',
      fact:{ text:'同行者の端末も同様に遅い。端末固有ではない', out:['device_side','device_net'] } },
    q_lamp:{ text:'画面…アンテナは3本です。下に「節」みたいな印が…。これ、悪い表示ですか？',
      fact:{ text:'アンテナ3本。本体に速度制限アイコンが表示されている', hot:['fup'], out:['sim','carrier','coverage'] } },
    q_when:{ text:'今朝からです。新婚旅行で、昨夜、夫と映画を1本見て…。私が見たせいですよね？ すみません…。',
      fact:{ text:'前夜に動画を長時間視聴。翌朝から低速化', hot:['fup'] } },
    q_count:{ text:'2台だけです。私と夫のスマホだけ。本当にそれだけです。',
      fact:{ text:'接続は2台のみ', out:['devices'] } },
    q_what_fails:{ text:'全部です。ずっとくるくる回って…。何も開かなくなるんじゃないかって。',
      fact:{ text:'特定サービスではなく全体が低速', out:['geo_block'] } },
    q_stay:{ text:'バンコクのホテル、1208号室です。ここまで来ていただけるんですか？' },
  },
  lookups:{
    l_plan:{ text:'[契約照会] プラン: 500MB/日 ／ 本日の使用量: 512MB（上限到達）／ 現在 速度制限中（最大128kbps）／ 前日使用量: 4.2GB',
      fact:{ text:'本日の使用量が上限に到達し、速度制限がかかっている', hot:['fup'], out:['heavy','location','power','hardware','provision'] },
      viz:{ label:'本日の使用量', value:512, max:500, unit:'MB', note:'前日 4,200MB' } },
    l_outage:{ text:'[障害情報] タイ AIS 網 正常。障害報告なし。',
      fact:{ text:'現地キャリアに障害なし', out:['carrier'] } },
  },
  debrief:'いちばん素直な形。<em>社内の使用量照会で裏が取れる「確定」案件</em>で、客に余計な操作をさせる必要はありません。前夜の動画視聴という自己申告だけで決めつけず、契約照会まで引いて数字を見たかどうかが分かれ目でした。'
},

/* === 2. ロンドン：一台だけ繋がらない。端末側の保存情報 === */
{
  id:'S2', arrive:5, name:'田辺 幸子', age:71, type:'novice', abandonAfter:30, callbackTo:'mobile',
  contractId:{ minutes:4, text:'番号…どの紙でしょう。すみません、老眼鏡も見つからなくて…。これですか？ GDW-336104。違っていたら、ごめんなさいね。' },
  city:'ロンドン', cityEn:'LONDON', localOffset:-8, device:'GD-500', plan:'イギリス ／ 無制限プラン',
  opening:'も、もしもし。インターネットが繋がらなくて…。変な所を押して壊したんでしょうか。すみません、機械のことが本当に分からなくて…。',
  smalltalk:[{ id:'st_s2_tour', reveal:'q_other_device', askLabel:'ツアーでは、今日はどちらを回られたんですか？', tellLabel:'皆様とのご旅行、素敵ですね', goodReply:'今日は博物館へ…。皆さんと一緒だと思うと、少し心強いです。', badReply:'お気遣いまで、すみません。でも私だけ待たせていて…どうしましょう。' }],
  panel:{ bars:4, carrier:'Vodafone UK', sim:'ok', throttle:false, clients:3, maxClients:5, battery:71, ssid:'Globaldesk-4471' },
  trueCause:'device_side', best:'r_forget_guide', partial:['r_use_other'],
  replies:{
    q_other_device:{ text:'ツアーのほかのお二人は繋がっています。同じ機械なのに私だけで…。やっぱり私の押し方ですか？',
      fact:{ text:'同一ルーターで他端末は正常。本人の端末だけ不通', hot:['device_side','device_net'], out:['carrier','sim','hardware','coverage','fup','provision'] } },
    q_lamp:{ text:'四角い画面に棒が4本…数字は3です。これで合っていますか？ 見る所、違いませんか？',
      fact:{ text:'アンテナ4本。接続3台。本体は正常に電波を掴んでいる', out:['sim','carrier','coverage','power'] } },
    q_ssid:{ text:'一覧…はい、「Globaldesk-4471」です。押すと「接続できません」と…。次はどこですか？ 怖くて押せなくて。',
      fact:{ text:'SSIDは見えており、認証の段階で失敗している', out:['sim','power','location','geo_block','heavy'] } },
    q_count:{ text:'三人ですから、三台…ですよね？ 数え方、これでいいでしょうか。',
      fact:{ text:'接続は3台', out:['devices'] } },
    q_when:{ text:'今朝ホテルを出てからです。昨日は使えました。私、今朝何か触ったかしら…。' },
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
  id:'S3', arrive:11, name:'大久保 健', age:44, type:'hurried', abandonAfter:22, callbackTo:'mobile',
  rushedReply:'はい。挨拶は分かった。続き、早く。', contractId:{ minutes:1, text:'メールにあります。GDW-529017。はい、次。' },
  city:'ホノルル', cityEn:'HONOLULU', localOffset:-19, device:'GD-500', plan:'ハワイ ／ 無制限プラン',
  opening:'急いでます。一台だけ繋がりません。ほかは使えます。あと10分で移動しないといけません。何を見ればいいですか。',
  smalltalk:[{ id:'st_s3_daughter', reveal:'q_other_device', askLabel:'お嬢様はタブレットで何をご覧になるんですか？', tellLabel:'お嬢様とのご旅行、楽しそうですね', goodReply:'家族旅行です。…はい、少し落ち着きました。次は？', badReply:'その話は後。バスが着きます。直し方を先に。' }],
  panel:{ bars:4, carrier:'T-Mobile US', sim:'ok', throttle:false, clients:5, maxClients:5, battery:55, ssid:'Globaldesk-8802' },
  trueCause:'devices', best:'r_disconnect', partial:['r_second_unit'], shipNeed:'normal',
  replies:{
    q_other_device:{ text:'私と妻は使えてます。子どもの分だけ駄目。次の質問は？',
      fact:{ text:'既存の接続端末は正常。新しい端末だけが入れない', hot:['devices','device_side'], out:['carrier','sim','hardware','coverage','provision'] } },
    q_lamp:{ text:'はい、画面出した。棒4本、数字は5。バスはあと7分。',
      fact:{ text:'電波は正常。接続台数の表示が5台', hot:['devices'], out:['sim','carrier','coverage','power','location'] } },
    q_count:{ text:'私、妻、子ども二人、ゲーム機、妻の予備端末。6台か7台。結論は？',
      fact:{ text:'接続を試みている端末が6〜7台ある', hot:['devices'] } },
    q_when:{ text:'ホテルを出るとき、娘のタブレットを追加した瞬間から。',
      fact:{ text:'新しい端末を追加した時点で発生', hot:['devices'] } },
    q_ssid:{ text:'名前は出る。押しても入れない。娘が騒いでる。早く。',
      fact:{ text:'SSIDは見えているが参加できない', out:['location','power','device_net'] } },
    q_what_fails:{ text:'Wi-Fi自体に入れない。サイト以前。次。',
      fact:{ text:'接続自体ができていない', out:['geo_block'] } },
    q_stay:{ text:'ワイキキのホテル。未到着だから部屋番号はまだ。' },
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
  id:'S4', arrive:18, name:'森 達彦', age:39, type:'expert', abandonAfter:35, callbackTo:'hotel',
  contractId:{ minutes:1, text:'GDW-118350です。控えてあります。' },
  city:'上海', cityEn:'SHANGHAI', localOffset:-1, device:'GD-500', plan:'中国本土 ／ 1GBプラン',
  opening:'電波強度と回線速度は正常。ただ、社内システムと海外系サービスだけ到達しません。疎通は取れて、名前解決で落ちます。経路条件を疑っています。',
  smalltalk:[{ id:'st_s4_work', reveal:'q_when', askLabel:'上海では、どのようなお仕事をされているんですか？', tellLabel:'上海でのお仕事、お疲れさまです', goodReply:'ありがとうございます。現地チームとの技術打ち合わせです。では続けましょう。', badReply:'お気遣いは不要です。その質問が障害切り分けにどう寄与しますか。' }],
  panel:{ bars:4, carrier:'China Unicom', sim:'ok', throttle:false, clients:2, maxClients:5, battery:80, ssid:'Globaldesk-1174' },
  trueCause:'geo_block', best:'r_vpn_plan', partial:['r_explain_block'],
  replies:{
    q_what_fails:{ text:'全断ではありません。現地系サイトは正常です。落ちるのは海外系サービスと、社内の暗号化ゲートウェイです。',
      fact:{ text:'一部のサービスのみ不通。現地系サービスは正常', hot:['geo_block'], out:['fup','carrier','sim','devices','power','location'] } },
    q_other_device:{ text:'ノートPCとスマホで再現します。端末固有要因はこちらで除外済みです。',
      fact:{ text:'複数端末で同じ挙動。端末固有ではない', out:['device_side','device_net'] } },
    q_lamp:{ text:'アンテナ4本。現地回線を正常に捕捉しています。',
      fact:{ text:'現地キャリアを正常に掴んでいる', out:['sim','hardware','coverage','provision'] } },
    q_when:{ text:'現地チームとの技術打ち合わせで到着した初日から再現しています。経時劣化ではありません。',
      fact:{ text:'渡航当初から一貫して同じ症状', out:['heavy'] } },
    q_stay:{ text:'浦東のホテル、1506号室です。この情報は配送判断用ですか？' },
  },
  lookups:{
    l_area:{ text:'[エリア照会] 中国本土 ／ 貸出機種 GD-500: 対応 ✓ ／ 提携: China Unicom ✓ ／ 備考: 通常のデータプランには現地の通信規制を回避する経路が含まれない。規制対象サービスの利用には「VPN付きオプション」の追加が必要。',
      fact:{ text:'契約プランが規制回避に対応していない。VPN付きプランで解消する', hot:['geo_block'], out:['coverage','provision'] } },
    l_outage:{ text:'[障害情報] 中国 China Unicom 網 正常。障害報告なし。',
      fact:{ text:'現地キャリアに障害なし', out:['carrier'] } },
  },
  debrief:'「繋がらない」の中身を分けられたかどうかです。<em>回線は生きていて、特定のサービスだけが落ちている</em>なら、疑うのは機器ではなく契約と地域の条件。相手はpingとDNSの区別がつく人なので、噛み砕きすぎるとかえって信用を落とします。'
},

/* === 5. ニューヨーク①：広域障害。この時点ではまだ見えない === */
{
  id:'S5', arrive:25, name:'小林 亜衣', age:33, type:'anxious', abandonAfter:28, callbackTo:'hotel',
  contractId:{ minutes:2, text:'はい…会社の手配です。えっと、GDW-673925。間違っていませんよね？' },
  city:'ニューヨーク', cityEn:'NEW YORK', localOffset:-13, device:'GD-500', plan:'アメリカ ／ 無制限プラン',
  opening:'あの…30分前に全部切れて、再起動しても戻りません。明朝までに必要な資料が開けなくて…。失敗したらと思うと、手が震えます。どうしよう…。',
  smalltalk:[{ id:'st_s5_visit', reveal:'q_when', askLabel:'明日は、どのようなお客様を訪問されるんですか？', tellLabel:'明日のご訪問、うまく進むといいですね', goodReply:'ありがとうございます…。大事な提案なので、その一言で少し呼吸が戻りました。', badReply:'ありがとうございます。でも、このままだと提案そのものができなくなります…。' }],
  panel:{ bars:0, carrier:null, sim:'ok', throttle:false, clients:2, maxClients:5, battery:45, ssid:'Globaldesk-6390' },
  trueCause:'carrier', best:'r_outage_explain', bestNoOutage:'r_escalate_line', partial:['r_escalate_line'],
  replies:{
    q_other_device:{ text:'同僚も同じです。二人とも繋がりません。会社全体に迷惑をかけたらどうしよう…。',
      fact:{ text:'複数端末で同時に不通', out:['device_side','device_net'] } },
    q_lamp:{ text:'アンテナ0本、「圏外」です。さっきまで4本だったのに…。急に全部消えました。',
      fact:{ text:'圏外表示。直前まで電波は正常だった', hot:['carrier','sim','coverage'], out:['fup','devices','geo_block','heavy'] } },
    q_where:{ text:'ミッドタウンのホテルです。窓際もロビーも駄目で…。もう外へ出るしかないですか？',
      fact:{ text:'複数の場所で試しても圏外のまま', out:['location'] } },
    q_when:{ text:'30分前です。急に切れて…。明朝に大事な提案があるのに、それまで普通だったから、余計に怖くて。',
      fact:{ text:'突発的に発生。前兆なし', out:['power'] } },
    q_stay:{ text:'ミッドタウンのホテル、816号室です。ここで待っていて大丈夫でしょうか？' },
  },
  lookups:{
    l_outage:{ text:'[障害情報] 米国 提携キャリア: 現時点で報告なし（最終更新 03:10）',
      fact:{ text:'障害情報はまだ上がっていない（更新が古い）' } },
    l_area:{ text:'[エリア照会] 米国 ／ 貸出機種 GD-500: 対応 ✓ ／ 提携: T-Mobile US ✓',
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
  id:'S6', arrive:31, name:'渡辺 圭吾', age:52, type:'hurried', abandonAfter:20, callbackTo:'mobile',
  rushedReply:'分かってます。前置きは終わり。進めて。', contractId:{ minutes:1, text:'毎月使うので控えてます。GDW-206441。次。' },
  city:'ニューヨーク', cityEn:'NEW YORK', localOffset:-13, device:'GD-500', plan:'アメリカ ／ 無制限プラン',
  opening:'急に圏外。再起動済み、変化なし。次の移動まで15分。交換が要るか、いま判断してください。',
  smalltalk:[{ id:'st_s6_regular', reveal:'q_when', askLabel:'毎月のご出張では、いつもニューヨークへ来られるんですか？', tellLabel:'いつもご利用いただき、ありがとうございます', goodReply:'毎月です。はい、少しだけ落ち着きました。判断を。', badReply:'利用歴の話は後。残り15分。交換判断を先に。' }],
  panel:{ bars:0, carrier:null, sim:'ok', throttle:false, clients:2, maxClients:5, battery:38, ssid:'Globaldesk-6512' },
  trueCause:'carrier', best:'r_outage_explain', bestNoOutage:'r_escalate_line', partial:['r_escalate_line'],
  replies:{
    q_lamp:{ text:'圏外。アンテナ0。回線名も消えた。',
      fact:{ text:'圏外表示。キャリア名も表示されない', hot:['carrier','sim','coverage'], out:['fup','devices','geo_block','heavy'] } },
    q_where:{ text:'ブルックリン。歩いて移動中。ずっと圏外。',
      fact:{ text:'移動しながらでも一貫して圏外', out:['location'] } },
    q_other_device:{ text:'2台とも駄目。端末の話はこれで終わり。',
      fact:{ text:'複数端末で同時に不通', out:['device_side','device_net'] } },
    q_when:{ text:'1時間前。急に。毎月使っていて操作は分かります。はい、次。',
      fact:{ text:'突発的に発生', out:['power'] } },
  },
  lookups:{
    l_outage:{ text:'[障害情報] 米国 提携キャリア T-Mobile US ／ 04:40頃より北東部で広域の接続障害を確認（最終更新 05:22）。復旧見込み: 未定。同一エリアからの入電: 2件。',
      fact:{ text:'ニューヨークを含む北東部で提携キャリアの広域障害が発生中', hot:['carrier'], out:['sim','coverage','provision','device_side','device_net'] }, outage:true },
    l_session:{ text:'[セッション] 05:31以降、圏内復帰なし。SIM認識: 正常。',
      fact:{ text:'SIMは認識されている。本体側の故障ではない', out:['sim','hardware','provision'] } },
    l_area:{ text:'[エリア照会] 米国 ／ 貸出機種 GD-500: 対応 ✓ ／ 提携: T-Mobile US ✓',
      fact:{ text:'渡航先も機種も対応範囲内', out:['coverage'] } },
  },
  debrief:'同じ都市から似た症状が続いたら、個別の故障ではなく<em>地域で起きていること</em>を疑う。障害情報の照会でそれが裏付けられ、先に受けた一件の答えもここで確定します。障害と分かってさえいれば、代替機を送らずに説明と返金で収められました。'
},

/* === 7. バルセロナ郊外：対象エリア外。上級 === */
{
  id:'S7', arrive:38, name:'中西 悠真', age:29, type:'expert', abandonAfter:38, callbackTo:'mobile',
  contractId:{ minutes:1, text:'GDW-887302。画面に出しています。照合してください。' },
  city:'バルセロナ近郊', cityEn:'BARCELONA', localOffset:-7, device:'GD-200', plan:'ヨーロッパ周遊 ／ 1GBプラン',
  opening:'市街地では正常でしたが、郊外へ移動後は完全に圏外です。3台とも同じなので端末要因は除外済み。地域差か対応周波数を確認していただけますか。',
  smalltalk:[{ id:'st_s7_village', reveal:'q_where', askLabel:'その村へは、どのような目的で来られたんですか？', tellLabel:'バルセロナ近郊の村、素敵なところでしょうね', goodReply:'静かで景色のよい場所です。ありがとうございます。では確認を。', badReply:'観光情報は障害条件ではありません。地域と機種の適合を確認してください。' }],
  panel:{ bars:0, carrier:null, sim:'ok', throttle:false, clients:3, maxClients:5, battery:66, ssid:'Globaldesk-3028' },
  trueCause:'coverage', best:'r_escalate_band', partial:['r_city_only'], shipNeed:'next',
  replies:{
    q_other_device:{ text:'3台で同一症状です。ルーター自体が圏外なので、端末要因は除外できますよね。',
      fact:{ text:'複数端末で同時に不通。ルーター自体が圏外', out:['device_side','device_net'] } },
    q_where:{ text:'ジローナ手前の山寄りの村です。現地端末は正常なので、単純な無電波地域ではありません。',
      fact:{ text:'現地の携帯は通じている場所で、ルーターだけが圏外', hot:['coverage'], out:['location'] } },
    q_moved:{ text:'村内3地点と丘の上で再現しました。場所要因の再確認は不要です。',
      fact:{ text:'複数地点で試しても圏外のまま', out:['location'] } },
    q_lamp:{ text:'圏外表示で回線名なし。市内では現地回線名が表示されていました。',
      fact:{ text:'市内では接続実績あり。郊外でのみ圏外', hot:['coverage'], out:['sim','provision','fup','devices','geo_block','heavy'] } },
    q_stay:{ text:'今夜はジローナの民宿、明日は移動します。配送条件に影響しますか。' },
  },
  lookups:{
    l_area:{ text:'[エリア照会] スペイン ／ 貸出機種: GD-200（旧型・3バンド）／ 提携: Orange ES ／ 備考: GD-200 は Orange ES の800MHz帯(B20)非対応。1800/2100MHz帯のみ対応のため、郊外・山間部では圏外となる場合あり。',
      fact:{ text:'貸出機種が現地の郊外カバー用バンドに非対応。機種を替えないと解決しない', hot:['coverage'], out:['sim','carrier','provision'] } },
    l_session:{ text:'[セッション] 07:40以降、圏内復帰なし。SIM認識: 正常。',
      fact:{ text:'SIMは認識されている。本体側の故障ではない', out:['sim','hardware'] } },
    l_outage:{ text:'[障害情報] スペイン Orange ES 網 正常。障害報告なし。',
      fact:{ text:'現地キャリアに障害なし', out:['carrier'] } },
  },
  tests:{
    t_move:{ text:'丘の上まで試行済みです。結果は同じ。ログを確認してください。',
      fact:{ text:'高所へ移動しても圏外', out:['location'] } },
    t_reboot:{ text:'再起動完了。圏外のままです。仮説は更新されましたか。',
      fact:{ text:'再起動でも復旧しない', out:['power'] } },
  },
  debrief:'ここで<em>同じ機種の代替機を送ると、届いた先でまた圏外になります</em>。問題は個体ではなく、旧型機の対応バンドと郊外のカバー用周波数が噛み合っていないこと。エリア照会まで引かないと見えない情報で、遠隔の会話だけで確定できない典型なのでエスカレーションが正解です。'
},

/* === 8. ドバイ：SIM未認識。清掃と挿し直しで復旧 === */
{
  id:'S8', arrive:44, name:'藤川 みどり', age:58, type:'novice', abandonAfter:26, callbackTo:'hotel',
  contractId:{ minutes:3, text:'番号…箱の紙ですか？ すみません、見方が…。あ、GDW-745168。これでしょうか？' },
  city:'ドバイ', cityEn:'DUBAI', localOffset:-5, device:'GD-500', plan:'UAE ／ 1GBプラン',
  opening:'あの、すみません。今日受け取って、電源を入れただけなのに「SIMカードがありません」と…。再起動は何度かしました。私、最初から何か間違えましたでしょうか。',
  smalltalk:[{ id:'st_s8_arrival', reveal:'q_when', askLabel:'ドバイには、今日着かれたばかりですか？', tellLabel:'長いご移動、お疲れさまでした', goodReply:'はい、着いたばかりです。お気遣いまで…少し安心しました。', badReply:'ありがとうございます。でも受け取ってすぐなので、私が壊したのかと…。' }],
  panel:{ bars:null, carrier:null, sim:'none', throttle:false, clients:0, maxClients:5, battery:80, ssid:'Globaldesk-7745' },
  trueCause:'sim', best:'r_sim_clean', partial:['r_escalate_swap'],
  replies:{
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
    l_ship:{ text:'[貸出記録] ドバイ国際空港カウンター受取 8/31 18:40 ／ 検品ステータス: 出荷時OK ／ 代替機在庫: 市内デポに 3台',
      fact:{ text:'市内デポに代替機の在庫があり、当日配送が可能', hot:['sim'], out:['logistics'] } },
    l_area:{ text:'[エリア照会] UAE ／ 貸出機種 GD-500: 対応 ✓ ／ 提携: Etisalat ✓',
      fact:{ text:'渡航先も機種も対応範囲内', out:['coverage'] } },
    l_outage:{ text:'[障害情報] UAE Etisalat 網 正常。障害報告なし。',
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
  id:'S9', arrive:50, name:'石橋 玲', age:35, type:'hurried', abandonAfter:16, callbackTo:'mobile',
  rushedReply:'はい。で、結論は？', contractId:{ minutes:1, text:'GDW-091774。番号は最初からあります。次。' },
  city:'ハノイ', cityEn:'HANOI', localOffset:-2, device:'（未受取）', plan:'ベトナム ／ 500MBプラン',
  opening:'ハノイ空港。カウンターは無人で、機器を受け取れていません。タクシーを待たせています。市内へ出る前に、受取方法を決めてください。',
  smalltalk:[{ id:'st_s9_city', reveal:'opening', askLabel:'市内では、まずどちらへ向かわれるんですか？', tellLabel:'ハノイまでのご移動、お疲れさまでした', goodReply:'旧市街のホテルです。ありがとう。では、受取方法を。', badReply:'行き先の話は後。タクシーが待ってる。受取方法を今。' }],
  panel:null,
  trueCause:'logistics', best:'r_transfer_logi', partial:['r_come_tomorrow'], shipNeed:'fast',
  techPenalty:true,
  replies:{
    q_lamp:{ text:'機器は未受取。手元にない。画面確認はできない。',
      fact:{ text:'（機器が手元にないため技術的な確認はできない）' } },
    q_other_device:{ text:'機器がない。試せない。その質問は飛ばして。',
      fact:{ text:'（機器が手元にないため技術的な確認はできない）' } },
    q_when:{ text:'予約は20時。到着したら無人。いま22時半。タクシーを待たせてます。',
      fact:{ text:'受取予約は20時。現地時刻はすでに22時半', hot:['logistics'] } },
    q_stay:{ text:'旧市街のホテルへ向かいます。名称は予約票にある。配送できますか。' },
  },
  lookups:{
    l_ship:{ text:'[貸出記録] ハノイ ノイバイ空港 受取予約 8/31 20:00 ／ カウンター営業時間 06:00-21:00（現地）／ 現在 現地22:35（営業時間外）／ ステータス: 未受取 ／ 市内デポからの宿泊先配送: 当日手配可（到着目安 90分）',
      fact:{ text:'カウンターは営業時間外。市内デポから宿泊先への当日配送が手配できる', hot:['logistics'], out:['sim','hardware','carrier','coverage','provision','fup','devices','geo_block','device_side','device_net','location','power','heavy'] } },
  },
  debrief:'テクニカルサポートにかかってくる電話が、いつも技術の話とはかぎりません。<em>手元に機器がない相手に切り分けの質問をするのは、時間を奪っているだけ</em>です。技術案件でないと早く見抜き、物流担当へ確実に渡すのがこの一件の正解でした。'
},

/* === 10. パリ：SIM清掃を2回試しても戻らない機器故障。長期滞在なら交換 === */
{
  id:'S10', arrive:56, name:'佐伯 奈緒', age:41, type:'anxious', abandonAfter:30, callbackTo:'hotel',
  contractId:{ minutes:2, text:'予約番号はGDW-814263です。あと6日もあるのに…。すみません、ちゃんと控えていてよかった…。' },
  city:'パリ', cityEn:'PARIS', localOffset:-8, device:'GD-500', plan:'フランス ／ 1GBプラン',
  opening:'3日使えたのに、突然「No SIM」になって…。再起動しても戻りません。このまま全部の予定が駄目になったらと思うと…すみません、助けてください。',
  smalltalk:[{ id:'st_s10_stay', reveal:'q_stay_length', askLabel:'パリには、あと6日ほどお仕事で滞在されるんですね？', tellLabel:'長いご滞在でのお仕事、お疲れさまです', goodReply:'ありがとうございます…。まだ一人じゃないと思えて、少し落ち着きました。', badReply:'ありがとうございます。でも残り6日、全部使えないままだったらどうしよう…。' }],
  panel:{ bars:null, carrier:null, sim:'none', throttle:false, clients:0, maxClients:5, battery:76, ssid:'Globaldesk-9031' },
  trueCause:'hardware', best:'r_hardware_swap', partial:['r_hardware_no_swap'], shipNeed:'next', stayDays:6, wantsReplacement:true,
  replies:{
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
    l_ship:{ text:'[貸出記録] パリ市内デポに交換用GD-500在庫あり。翌日便でホテル配送可能。',
      fact:{ text:'滞在中に使える日程で代替機を配送できる', hot:['hardware'], out:['logistics'] } },
    l_area:{ text:'[エリア照会] フランス ／ GD-500: 対応 ✓ ／ Orange FR: 正常',
      fact:{ text:'渡航先・機種・回線契約は対応範囲内', out:['coverage','carrier','provision'] } },
  },
  tests:{
    t_reboot:{ text:'再起動しました。でも「No SIM」です…。このまま戻らないんでしょうか。', fact:{ text:'再起動でもカード検出が戻らない', out:['power'] } },
    t_simout:{ sequence:[
      { text:'1回目、乾いた布で拭いて挿しました。まだ「No SIM」です…。次もやって大丈夫ですか？', fact:{ text:'1回目のSIM清掃では認識しない', hot:['sim','hardware'] } },
      { text:'もう一度、向きも奥まで入ったことも確認しました。それでも「No SIM」です…。もう機械そのものですか？',
        fact:{ text:'SIM清掃と正しい挿し直しを2回行っても認識しない。本体SIMリーダー故障と判断できる', hot:['hardware'], out:['sim','fup','devices','geo_block','heavy','device_side','device_net','location','power','carrier','coverage','provision','logistics'] } },
    ] },
  },
  debrief:'No SIMだからと即交換せず、接点清掃と挿し直しを2回行って接触不良を除外します。それでも戻らず、<em>長期滞在・本人の希望・ホテル配送先</em>が揃ったため、機器故障と診断して代替機を送るのが正解です。短期滞在や交換不要の客に高額配送を押しつけてはいけません。'
},

/* === 11. ローマ：地下の会議室だけ電波が弱い。場所移動で即復旧 === */
{
  id:'S11', arrive:62, name:'川上 亮', age:36, type:'hurried', abandonAfter:20, callbackTo:'mobile',
  rushedReply:'はい。場所なら動く。指示を。', contractId:{ minutes:1, text:'GDW-562940。はい、次。' },
  city:'ローマ', cityEn:'ROME', localOffset:-8, device:'GD-500', plan:'イタリア ／ 無制限プラン',
  opening:'ローマの会議場。地下へ入ったら圏外。地上では使えました。会議開始まで5分。場所なら動きます。次の指示をください。',
  smalltalk:[{ id:'st_s11_meeting', reveal:'opening', askLabel:'これから始まるのは、どのような会議ですか？', tellLabel:'会議前のお忙しいところ、お電話ありがとうございます', goodReply:'海外拠点との会議です。ありがとう。次の確認を。', badReply:'会議内容は後。開始まで5分。通信確認を先に。' }],
  panel:{ bars:1, carrier:'TIM', sim:'ok', throttle:false, clients:2, maxClients:5, battery:68, ssid:'Globaldesk-6154' },
  trueCause:'location', best:'r_move_guide', partial:['r_window_stationary'],
  replies:{
    q_other_device:{ text:'スマホもPCも駄目。ルーターのアンテナは1本。残り4分。',
      fact:{ text:'複数端末で同じ。本体の受信電波が弱い', hot:['location'], out:['device_side','device_net','hardware'] } },
    q_lamp:{ text:'回線名あり、アンテナ1本、ときどき圏外。SIM認識あり。次。',
      fact:{ text:'SIMとキャリア認識は正常だが受信強度が極端に弱い', hot:['location'], out:['sim','hardware','fup','devices','geo_block','heavy','provision'] } },
    q_where:{ text:'石造りの地下2階、窓なし。地上ロビーでは使えた。移動する？',
      fact:{ text:'遮蔽の強い地下2階でのみ不通。地上では接続実績あり', hot:['location'], out:['coverage','carrier','power'] } },
    q_moved:{ text:'まだ地下。廊下に階段あり。上がればいい？' },
  },
  lookups:{
    l_area:{ text:'[エリア照会] ローマ中心部 ／ GD-500: 対応 ✓ ／ TIM: 対応 ✓', fact:{ text:'地域と機種は対応範囲内', out:['coverage'] } },
    l_outage:{ text:'[障害情報] ローマ TIM網 正常。周辺障害なし。', fact:{ text:'現地キャリア障害なし', out:['carrier'] } },
  },
  tests:{
    t_move:{ text:'地上ロビーに出た。アンテナ4本、接続復旧。間に合った。ありがとう。',
      fact:{ text:'地下から地上へ移動しただけで電波4本となり通信が復旧した', hot:['location'], out:['hardware','sim','carrier','coverage','provision','fup','devices','geo_block','heavy','device_side','device_net','power','logistics'] }, solves:true },
  },
  debrief:'場所が原因なら、設定変更より先に<em>遮蔽物の外へ移動する</em>のが最も速く安全です。地下から地上へ出ただけで電波が1本から4本へ戻りました。場所を変えず再起動を繰り返すのは時間とストレスの無駄です。'
},

];
