// ペルソナ別LPの定義。`node scripts/build-variants.js` が index.html からこの定義どおりに
// <name>.html を生成する。index.html は一切書き換えない。
//
// sections : 並べる順のセクションキー（書かなかったセクションは載らない）
//   hero / heroBelow / achievement / inside / authority / empathy / problem3 / realProblem /
//   realization / solution / textbook / science / products / bundle / community / voices / faq / final
// 並び替えの番号は index.html での出現順（1始まり）:
//   inside   1=Essential Verbs 2=TOEIC 3=NativeDose
//   bubbles  1=TOEICは上がっても話せない 2=アプリ3週間で挫折 3=Netflixが聞き取れない
//            4=年齢的に無理かも 5=学校英語が苦手で続かない 6=机に座る時間がない
//   products 1=NativeDose 2=TOEIC 3=Essential Verbs
//   voices   1=M.K(EV) 2=T.S(TOEIC) 3=H.N(ND) 4=A.K(Boo) 5=R.Y(通勤10分) 6=S.M(続いてる) 7=Y.T(効率・横長カードなので末尾固定)
//   faq      1=勉強法 2=レベル 3=受け取り 4=メール未着 5=再DL 6=視聴期限 7=オフライン 8=商用 9=サンプル
//
// empathyTitle の <span class="nb"> は「途中で折り返さない語句」（ビルド時に inline-block になる）。
// PCのヒーローは tagline が1行固定。全角24字程度までに収める。
// コピーには index.html に無い数値・実績・効果の断定を足さないこと。

module.exports = {
  // 構成だけを見直した版（コピーは現行のまま）。構成の効果とコピーの効果を分けて測るための対照。
  v2: {
    sections: ['hero', 'heroBelow', 'achievement', 'inside', 'empathy', 'problem3', 'realProblem',
      'solution', 'textbook', 'authority', 'community', 'voices', 'products', 'bundle', 'faq', 'final'],
  },

  // TOEICのスコアを上げたい大学生・社会人
  toeic: {
    title: 'import｜TOEIC®頻出1,101語を、映像で覚える英単語学習',
    description: 'TOEIC® L&R の頻出語彙とつまずきやすい多義語を、3D映像のコアイメージで。TOEIC® - VOCAB COMPLETE を含む3教材の完全エディションを期間限定価格で。',
    eyebrow: 'TOEIC® Vocab × 3D Video',
    h1: ['<span class="yellow-marker">TOEIC頻出語</span>を、', '映像で<span class="highlight">忘れない。</span>'],
    tagline: '何周しても抜ける語彙を、3D映像で覚える。',
    taglineMobile: '何周しても抜ける語彙を、<br>3D映像で<span class="highlight">コアイメージごと</span>。',
    sub: 'BASICからSCORE 600までの1,101語と、つまずきやすい多義語を収録。1日10分、通学・通勤のスマホだけで進められます。',
    empathyTitle: '単語帳を<span class="title-accent">何周しても</span>、<br class="mb-br">\n          <span class="nb">本番で<span class="blue">思い出せない</span>。</span>',
    productsLead: 'TOEIC® - VOCAB COMPLETE で頻出語彙を固め、句動詞とイディオムで「使える」語彙まで広げる3本立てです。',
    finalTitle: ['TOEICの語彙を、', '映像で忘れない。'],
    finalSub: '単語帳の次の一手を、ここから。',
    sections: ['hero', 'heroBelow', 'achievement', 'inside', 'empathy', 'problem3', 'realProblem',
      'solution', 'textbook', 'voices', 'community', 'products', 'bundle', 'faq', 'final'],
    inside: [2, 1, 3],
    bubbles: [2, 6, 5, 4],
    products: [2, 3, 1],
    voices: [2, 6, 5, 1, 3, 4, 7],
    faq: [9, 1, 2, 6, 7, 3, 4, 5, 8],
  },

  // 単語は知っているのに会話で出てこない社会人
  kaiwa: {
    title: 'import｜知っている英語を「使える」に変える、映像の英単語学習',
    description: '会話で本当に使われる句動詞・イディオムを、3D映像のコアイメージで。Essential Verbs を含む3教材の完全エディションを期間限定価格で。',
    eyebrow: 'Know It → Use It',
    h1: ['<span class="yellow-marker">知ってる英語</span>を、', '<span class="highlight">「使える」</span>英語へ。'],
    tagline: '会話で使われる句動詞を、3D映像で体感。',
    taglineMobile: '会話で使われる句動詞を、<br>3D映像の<span class="highlight">コアイメージ</span>で。',
    sub: '"take off" のような句動詞を、訳語の暗記ではなく場面と感覚ごと覚える設計。1日10分、スマホだけで完結します。',
    empathyTitle: '単語は<span class="title-accent">知っているのに</span>、<br class="mb-br">\n          <span class="nb">なぜ<span class="blue">口から出ない</span>のか。</span>',
    productsLead: '句動詞で会話の土台をつくり、イディオムで表現を広げ、TOEIC語彙で仕事の場面までカバーする3本立てです。',
    finalTitle: ['知ってる英語を、', '「使える」英語へ。'],
    sections: ['hero', 'heroBelow', 'achievement', 'inside', 'empathy', 'problem3', 'realProblem',
      'solution', 'community', 'voices', 'authority', 'products', 'bundle', 'faq', 'final'],
    inside: [1, 3, 2],
    bubbles: [1, 3, 6, 2],
    products: [3, 1, 2],
    voices: [1, 3, 5, 6, 2, 4, 7],
  },

  // 学び直したいが続かなかった人（30〜50代、英語に苦手意識）
  yarinaoshi: {
    title: 'import｜机に向かわない、英単語の学び直し',
    description: 'まずは眺めるだけ。3D映像とキャラクター Boo で、英単語の学び直しを続けやすく。3教材の完全エディションを期間限定価格で。',
    eyebrow: 'Watch · Listen · Remember',
    h1: ['<span class="yellow-marker">机に向かわない</span>、', '英単語の<span class="highlight">学び直し。</span>'],
    tagline: 'まずは眺めるだけ。3D映像で「続く」に変わる。',
    taglineMobile: 'まずは眺めるだけ。<br>3D映像で、英単語が<span class="highlight">「続く」</span>に変わる。',
    sub: '覚えられないのは、年齢や根気のせいではなく「記憶の入れ方」の問題。家事や通勤の合間の1日10分、スマホだけで始められます。',
    empathyTitle: '<span class="title-accent">何度やり直しても</span>、<br class="mb-br">\n          <span class="nb">なぜ<span class="blue">続かない</span>のか。</span>',
    productsLead: '初・中級の句動詞から始めて、イディオム、TOEIC語彙へ。自分のペースで進められる3本立てです。',
    finalTitle: ['机に向かわない、', '英単語の学び直し。'],
    finalSub: '今日は、眺めるだけで大丈夫。',
    sections: ['hero', 'heroBelow', 'achievement', 'inside', 'empathy', 'realProblem', 'realization',
      'solution', 'science', 'textbook', 'authority', 'voices', 'community', 'products', 'bundle', 'faq', 'final'],
    bubbles: [5, 4, 2, 6],
    products: [3, 1, 2],
    voices: [4, 6, 5, 1, 3, 2, 7],
    faq: [2, 1, 9, 6, 7, 3, 4, 5, 8],
  },

  // 映画・海外ドラマ・SNSの英語を字幕に頼らず楽しみたい人
  eiga: {
    title: 'import｜映画・ドラマの英語を、映像で覚える英単語学習',
    description: 'ネイティブが日常的に使うイディオム・スラング・句動詞を、3D映像で感覚ごと。NativeDose を含む3教材の完全エディションを期間限定価格で。',
    eyebrow: 'Real English × 3D Video',
    h1: ['<span class="yellow-marker">教科書にない英語</span>を、', '映像で<span class="highlight">そのまま。</span>'],
    tagline: '映画やSNSの生きた表現を、3D映像で感覚ごと。',
    taglineMobile: '映画やSNSで使われる表現を、<br>3D映像で<span class="highlight">感覚ごと</span>覚える。',
    sub: 'ネイティブが日常的に使うイディオム・スラング・句動詞を厳選。字幕に頼らず楽しみたい人のための、1日10分・スマホ完結の英単語学習。',
    empathyTitle: '<span class="title-accent">意味は分かるのに</span>、<br class="mb-br">\n          <span class="nb">なぜ<span class="blue">聞き取れない</span>のか。</span>',
    productsLead: 'イディオム・スラングで生の表現に触れ、句動詞で会話の骨格を固める。TOEIC語彙までそろう3本立てです。',
    finalTitle: ['教科書にない英語を、', '映像でそのまま。'],
    sections: ['hero', 'heroBelow', 'achievement', 'inside', 'community', 'empathy', 'problem3',
      'realProblem', 'solution', 'authority', 'voices', 'products', 'bundle', 'faq', 'final'],
    inside: [3, 1, 2],
    bubbles: [3, 5, 2, 6],
    products: [1, 3, 2],
    voices: [3, 1, 4, 6, 5, 2, 7],
  },
};
