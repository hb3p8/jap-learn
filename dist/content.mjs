export const KANA = [
  ['a','あ','а','Открытый короткий «а», без растягивания.'],
  ['i','い','и','Короткий «и». Не добавляй звук «й».'],
  ['u','う','у','Губы расслаблены и почти не округлены. Сверяйся с записью.'],
  ['e','え','э','Ближе к русскому «э», без начального «й».'],
  ['o','お','о','Ровный короткий «о», без перехода в «у».'],
  ['ka','か','ка'],['ki','き','ки'],['ku','く','ку'],['ke','け','кэ'],['ko','こ','ко'],
  ['sa','さ','са'],['shi','し','си','Звук между русскими «с» и «щ». Ориентируйся на запись; в латинице — shi.'],['su','す','су'],['se','せ','сэ'],['so','そ','со'],
  ['ta','た','та'],['chi','ち','ти','Мягкий звук, похожий на «чи»; в латинице — chi.'],['tsu','つ','цу'],['te','て','тэ'],['to','と','то'],
  ['na','な','на'],['ni','に','ни'],['nu','ぬ','ну'],['ne','ね','нэ'],['no','の','но'],
  ['ha','は','ха','Как отдельный знак читается ha; частица は читается wa.'],['hi','ひ','хи'],['fu','ふ','фу','Воздух проходит между губами: верхние зубы не касаются нижней губы. В латинице — fu.'],['he','へ','хэ'],['ho','ほ','хо'],
  ['ma','ま','ма'],['mi','み','ми'],['mu','む','му'],['me','め','мэ'],['mo','も','мо'],
  ['ya','や','я'],['yu','ゆ','ю'],['yo','よ','ё'],
  ['ra','ら','ра','Короткое однократное касание языком; без раскатистого русского «р».'],['ri','り','ри'],['ru','る','ру'],['re','れ','рэ'],['ro','ろ','ро'],
  ['wa','わ','ва','Губной звук, без касания зубами губы.'],['wo','を','о','В современном языке обычно произносится «о». Используется как частица; латиницей также wo.'],['n','ん','н','Носовой звук. Его звучание зависит от соседних звуков.']
].map(([id,char,ru,hint])=>({id,char,ru,hint:hint||'Послушай запись и повтори коротко, без ударного выделения.'}));

export const LESSONS = [
  {id:'vowels',title:'Гласные',label:'Гласные',ids:['a','i','u','e','o'],duration:4,word:['あい','ai','любовь']},
  {id:'k',title:'Ряд К',label:'Ряд К',ids:['ka','ki','ku','ke','ko'],duration:4,word:['いけ','ike','пруд']},
  {id:'s',title:'Ряд С',label:'Ряд С',ids:['sa','shi','su','se','so'],duration:4,word:['すし','sushi','суши']},
  {id:'t',title:'Ряд Т',label:'Ряд Т',ids:['ta','chi','tsu','te','to'],duration:4,word:['くつ','kutsu','обувь']},
  {id:'n-row',title:'Ряд Н',label:'Ряд Н',ids:['na','ni','nu','ne','no'],duration:4,word:['ねこ','neko','кошка']},
  {id:'h',title:'Ряд Х',label:'Ряд Х',ids:['ha','hi','fu','he','ho'],duration:4,word:['はな','hana','цветок']},
  {id:'m',title:'Ряд М',label:'Ряд М',ids:['ma','mi','mu','me','mo'],duration:4,word:['みみ','mimi','уши']},
  {id:'y',title:'Ряд Я',label:'Ряд Я',ids:['ya','yu','yo'],duration:3,word:['やま','yama','гора']},
  {id:'r',title:'Ряд Р',label:'Ряд Р',ids:['ra','ri','ru','re','ro'],duration:4,word:['とり','tori','птица']},
  {id:'wn',title:'Ва, о и н',label:'Ва, о и н',ids:['wa','wo','n'],duration:3,word:['にわ','niwa','сад']}
];
export const BY_ID = Object.fromEntries(KANA.map(k=>[k.id,k]));
export const CONFUSABLES = {a:['o'],o:['a'],i:['ri'],u:['fu'],e:['n'],ki:['sa'],sa:['ki'],nu:['me'],me:['nu'],ne:['re','wa'],re:['ne','wa'],wa:['ne','re'],ru:['ro'],ro:['ru'],ha:['ho'],ho:['ha'],chi:['sa'],shi:['tsu']};
export const SOURCES = [
 {title:'Irodori Starter — русская версия',organization:'Japan Foundation',url:'https://jpfmw.ru/ru/yaponskij-yazyik/uchebnyie-materialyi-irodori/',use:'Письменность и произношение в начальном курсе; короткая практика с понятной целью.'},
 {title:'Marugoto Plus — Hiragana',organization:'Japan Foundation',url:'https://a1.marugotoweb.jp/en/hiragana.php',use:'Сетка годзюон и сопоставление знака со звуком.'},
 {title:'Tae Kim — Hiragana',organization:'Tae Kim',url:'https://guidetojapanese.org/learn/grammar/hiragana',use:'Базовые чтения и различие печатного и рукописного начертания.'}
];
