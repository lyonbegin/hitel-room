/* UNNI PC reference clone - interface prototype, no production booking/payment backend */
const ASSETS=[
'https://image2.gnsister.com/images/direct/1760679757630_a8f996fe946d43229cbf8b4a99e1dfe5.jpg?w=400&f=webp',
'https://image2.gnsister.com/images/direct/1755841995626_6926752772134c859c43ad571d04b2d7.jpg?w=400&f=webp',
'https://image2.gnsister.com/images/direct/1754987375281_a4df4296d41b4f169844c314aaab7bfe.jpg?w=400&f=webp',
'https://image2.gnsister.com/images/direct/1761201319449_13c346cd3dda4874b3fc8d30e08ad8ab.jpg?w=400&f=webp',
'https://image2.gnsister.com/images/direct/1786692261404_bc6ca72ac81545c8b6a6d19f66411e8f.jpg?w=400&f=webp',
'https://image2.gnsister.com/images/direct/1774920216229_c2218b66a95d4052b04aac87e7f439b1.jpg?w=400&f=webp',
'https://image2.gnsister.com/images/direct/1761200804068_431a6b79c9074f5f8bb558a49e492f38.jpg?w=400&f=webp',
'https://image2.gnsister.com/images/direct/1761200931649_a25feaadfe334c0abeb082c60e783a0a.jpg?w=400&f=webp',
'https://image2.gnsister.com/images/direct/1699239555529_4890829b86c14468a0e6a874779b07ab.jpg?w=400&f=webp',
'https://image2.gnsister.com/images/direct/1756108593794_6f2ac7b4b28746e3b8d04d682b99e897.jpg?w=400&f=webp',
'https://image2.gnsister.com/images/direct/1777347457955_c89a2a7461f440bca5e082cf38457611.jpg?w=400&f=webp',
'https://image2.gnsister.com/images/direct/1753850007300_5ff4f74421ca4834aa631ec32e4ce9a0.jpg?w=400&f=webp',
'https://image2.gnsister.com/images/direct/1744181311829_9e7ceed9eae04fe3b60473f95cc0661c.jpg?w=400&f=webp',
'https://image2.gnsister.com/images/direct/1783914022201_b851e5e55540444ea12562304c259c74.jpg?w=400&f=webp',
'https://image2.gnsister.com/images/direct/1770258559571_c2188a136033489ea0be5de2b29700a3.jpg?w=400&f=webp',
'https://image2.gnsister.com/images/direct/1697074943991_da6c7540853a4ed9896c218f06d013f9.jpg?w=400&f=webp'
];
const ORIGINAL_EVENT_COVERS=["https://image2.gnsister.com/images/direct/1792143625591_925cf148e42e487ba2af35e69fe598f4.jpg?w=330&h=330&f=webp","https://image2.gnsister.com/images/direct/1790561111051_b3da0ce7b07d411a8a03409fbc779d4d.jpg?w=330&h=330&f=webp","https://image2.gnsister.com/images/direct/1765763337990_b5eda4d32e594aa6a92caf3eab006681.jpg?w=330&h=330&f=webp","https://image2.gnsister.com/images/direct/1790664420340_dadfb7cf2c924b8394484565d9a5d7e9.jpg?w=330&h=330&f=webp","https://image2.gnsister.com/images/direct/1792567530151_ef4b48c3d96a4c12bfb59f128e817e93.jpg?w=330&h=330&f=webp","https://image2.gnsister.com/images/direct/1765191394109_eb5dc08558a44901b0b3d305501c1568.jpg?w=330&h=330&f=webp","https://image2.gnsister.com/images/direct/1792462178449_b106c5e858a34347b33d7d384ee439ca.png?w=330&h=330&f=webp","https://image2.gnsister.com/images/direct/1791419794995_6aebfe0ce4ab4689ac19efe3a68af4fa.jpg?w=330&h=330&f=webp","https://image2.gnsister.com/images/direct/1763435828727_0f825406b9bc4aaaa2f995623b740a88.jpg?w=330&h=330&f=webp","https://image2.gnsister.com/images/direct/1777530405563_925b377c00c243fd9bce5d993526d100.jpg?w=330&h=330&f=webp","https://image2.gnsister.com/images/direct/1783928818463_17798decfa2a4324ad99f8c90ab4026c.png?w=330&h=330&f=webp","https://image2.gnsister.com/images/direct/1782369606823_3e876398ff0e433493d4b9ba829a9f89.jpg?w=330&h=330&f=webp"];
const ORIGINAL_HOSPITAL_COVERS=["https://image2.gnsister.com/images/direct/1612146121984_a734c57dfd2e4af1aa1a8f02fa2496dd.png?f=webp","https://image2.gnsister.com/images/direct/1574324057313_0878603dd94b4201a1777f4274533864.jpg?f=webp","https://image2.gnsister.com/images/direct/1612406632389_c1d45f8232154966823e267a41876056.jpg?f=webp","https://image2.gnsister.com/images/direct/1617089701958_404f3eee95dc4faf802cfae51830042e.jpg?f=webp","https://image2.gnsister.com/images/direct/1600749036157_1f01b1a4e6664629b065a0dcc073f8ff.jpg?f=webp","https://image2.gnsister.com/images/hospital/profile/1583389826847_441394bc88a64d8082927f3d5c79dd4a.jpg?f=webp","https://image2.gnsister.com/images/hospital/profile/1481698165749_e4459537e92e45c48b3f4c89a6522974.jpg?f=webp","https://image2.gnsister.com/images/hospital/profile/1562998305471_fff974c81e1d4ee8959c195194bfd784.jpg?f=webp","https://image2.gnsister.com/images/direct/1627880074657_13a2a4633e4040dbb61f313f5bf1a9f8.png?f=webp","https://image2.gnsister.com/images/direct/1598492698481_9271eb1dd4c54aa49d587b538297b089.jpg?f=webp","https://image2.gnsister.com/images/hospital/profile/1536217787980_27cbe1169e2a4a20a628a59b103e918c.jpg?f=webp","https://image2.gnsister.com/images/hospital/profile/1577933821691_6808f690c9114a01b62e34eeda91bd54.png?f=webp"];
const ORIGINAL_HOSPITAL_GALLERY=["https://image2.gnsister.com/images/hospital/7933605c8dbd40e0a6b8ba2301de29e8_80a336c4-6e34-4774-bf32-f178e88ac5fa?f=webp","https://image2.gnsister.com/images/hospital/d89bae521ff647808a20c1274078506c_48621cd7-6ca4-47ea-b373-2b384bb65a37?f=webp","https://image2.gnsister.com/images/hospital/d984b00d9c8d4c61801c75063619e0b4_d75a5999-06a6-48bc-96c9-2c7f738402e6?f=webp","https://image2.gnsister.com/images/hospital/72c5026f39a6492da86e8ba8c581646e_ef59d456-d636-4419-9716-427f0b1ce8d8?f=webp","https://image2.gnsister.com/images/hospital/7bb7c8e50a994d3fa6bfd5aa0a98e5f4_c3601a8c-6ce7-4471-a42b-45ce12f9804f?f=webp","https://image2.gnsister.com/images/hospital/db47b3b70c1b40288eea54a0d823a744_469f67c5-adea-447d-88cc-549463f5a9e3?f=webp"];
const ORIGINAL_COLUMN_IMAGES=["https://image2.gnsister.com/images/community/19ba2a9f72784d5aacb2e98915430d60_collagenbooster-nodule.jpg","https://image2.gnsister.com/images/community/0db03738834d41ac8a415d2c79c9da7b_collagenbooster-recovery-sideeffect.jpg","https://image2.gnsister.com/images/community/fef92ee5cf084d959b17c603f93dc391_collagenbooster-products.jpg","https://image2.gnsister.com/images/community/35f342ece4fc40649ce6c6bf5d98aefc_collagenbooster-effect.jpg","https://image2.gnsister.com/images/community/d56aff94f17a4f859b272035c6f893f5_collagenbooster-guide.jpg","https://image2.gnsister.com/images/community/a067abf7d89e4fd89ca95e61d351b8f6_ptosis-price.jpg","https://image2.gnsister.com/images/community/84e9a61e2f9242a794762ac47f899755_ptosis-resurgery.jpg","https://image2.gnsister.com/images/community/8b1998acb86b427ba9773e4a4a3c2bbc_acne-all-guide.jpg","https://image2.gnsister.com/images/community/400d32493388421c8d13e208f6830452_darkcircles-reason.jpg"];
const bannerImages=["https://image2.gnsister.com/images/notice/1791350697663_f4277c8e3f6545b2a94c2c84687a27a0.png?originalImageWidth=1406&originalImageHeight=656","https://image2.gnsister.com/images/notice/1791349750787_965fb1144e5b4ce4bc7cd9dcfae57a0f.png?originalImageWidth=1406&originalImageHeight=656","https://image2.gnsister.com/images/notice/1791350817695_b4a61934b070438891b57fe67564ae36.png?originalImageWidth=1406&originalImageHeight=656","https://image2.gnsister.com/images/notice/1787822332537_8bd89e7cd6d44cf4936c32ed3fba18be.png?originalImageWidth=1406&originalImageHeight=656","https://image2.gnsister.com/images/notice/1787822247039_458f6a8c549b473d8da6f1da5e502911.png?originalImageWidth=1406&originalImageHeight=656","https://image2.gnsister.com/images/notice/1788340766965_1166a2b52e5348a0be05fcd5cfd30f0b.png?originalImageWidth=1406&originalImageHeight=656","https://image2.gnsister.com/images/notice/1786585139949_5f8b7c3f98d54b58a6c8091a1275e97b.png?originalImageWidth=1406&originalImageHeight=656"];
const banners=[
{title:'모공, 왜 줄어들지 않을까?',sub:'피지+탄력 관리를 함께 챙겨요',tag:'피부 고민 큐레이션',bg:'#fbd3ce',emoji:'✦'},
{title:'울쎄라랑 써마지,\n뭐가 다를까?',sub:'처짐엔 울쎄라, 탄력엔 써마지',tag:'리프팅 가이드',bg:'#d4e7f5',emoji:'◕'},
{title:'팔자주름, 마사지 해도\n그대로일까?',sub:'같은 팔자주름도 관리법은 달라요',tag:'고민별 추천',bg:'#e5dfef',emoji:'♡'},
{title:'처음 방문이라면\n더 특별한 가격으로',sub:'첫방문 체험가 모음',tag:'첫방문 이벤트',bg:'#fff0d9',emoji:'✿'},
{title:'전문의가 직접 진행하는\n시술 모음',sub:'검증된 전문의 시술',tag:'믿을 수 있는 선택',bg:'#dee9d6',emoji:'✧'},
{title:'시간이 흘러도\n여전히 나답게',sub:'처짐, 눈가 고민별 이벤트 모음',tag:'시술 추천',bg:'#e8e4db',emoji:'❀'},
{title:'원하는 나를 향한 여정',sub:'새로워진 강남언니가 함께 해요',tag:'강남언니 이야기',bg:'#ffd9c4',emoji:'♥'}
];
const catNames=['리프팅','피부','보톡스','제모','필러','눈성형','코성형','안면윤곽·양악','지방·다이어트','가슴성형','치아','한방','모발이식','기타'];
const icons=['transplant','acne','botox','waxing','filler','eye','nose','faceline','bodyline','breast','teethandoptical','oriental','hair','etc'];
const catEmoji=['♧','✿','✧','✦','◇','◉','♙','♡','♧','♥','☺','☘','♧','⋯'];
const H=[
{id:'250',name:'디에이성형외과의원',region:'서울 강남역',rating:'9.6',review:'77,104',events:73,langs:'중국어 간체 · 일본어 · 영어'},
{id:'370',name:'팝성형외과의원',region:'서울 압구정역',rating:'9.6',review:'63,603',events:34,langs:'일본어 · 영어'},
{id:'938',name:'나나성형외과의원',region:'서울 압구정로데오역',rating:'9.6',review:'62,187',events:47,langs:'일본어'},
{id:'3234',name:'사적인아름다움지유의원',region:'서울 강남역',rating:'9.0',review:'39,250',events:14,langs:'영어 · 일본어'},
{id:'3004',name:'에이비성형외과의원',region:'서울 강남역',rating:'9.5',review:'28,462',events:36,langs:'중국어 · 영어'},
{id:'1982',name:'미케이의원',region:'서울 강남역',rating:'9.0',review:'28,010',events:31,langs:'일본어'},
{id:'166',name:'에이트성형외과의원',region:'서울 압구정역',rating:'9.5',review:'23,657',events:38,langs:'영어 · 일본어'},
{id:'398',name:'기린성형외과의원',region:'서울 신논현역',rating:'9.3',review:'22,707',events:82,langs:'일본어 · 영어'},
{id:'3402',name:'루비의원',region:'서울 명동역',rating:'8.5',review:'22,632',events:82,langs:'일본어'},
{id:'2776',name:'옐로우성형외과의원',region:'서울 강남역',rating:'9.8',review:'21,816',events:12,langs:'중국어 · 영어'},
{id:'1197',name:'어린공주성형외과',region:'서울 신사역',rating:'9.1',review:'21,118',events:4,langs:'일본어 · 영어'},
{id:'189',name:'뷰성형외과의원',region:'서울 신논현역',rating:'9.6',review:'19,453',events:56,langs:'일본어'}
];
const E=[
{id:'6554',title:'팝 평생 눈성형 맛집 자연유착 쌍꺼풀 매몰 앞트임 눈매교정',hospital:'팝성형외과의원',hid:'370',area:'서울 압구정역',price:429000,old:849000,off:49,rating:'9.7',reviews:'19,575',cat:'눈성형',img:0},
{id:'3957',title:'디에이 눈맛집 첫눈자연유착 눈성형 쌍꺼풀 매몰',hospital:'디에이성형외과의원',hid:'250',area:'서울 강남역',price:429000,old:850000,off:49,rating:'9.7',reviews:'17,152',cat:'눈성형',img:1},
{id:'6492',title:'대표원장님 직접시술 러블리 입술필러 & 입꼬리필러',hospital:'어린공주성형외과',hid:'1197',area:'서울 신사역',price:119900,old:239000,off:49,rating:'9.1',reviews:'11,554',cat:'필러',img:2},
{id:'3853',title:'디에이 자려한 코성형 비순각코수술 콧대 복코교정',hospital:'디에이성형외과의원',hid:'250',area:'서울 강남역',price:1089000,old:2139000,off:49,rating:'9.7',reviews:'11,755',cat:'코성형',img:3},
{id:'6353',title:'팝 눈재수술 맛집 절개 비절개 자연유착 눈매교정',hospital:'팝성형외과의원',hid:'370',area:'서울 압구정역',price:720000,old:1430000,off:49,rating:'9.5',reviews:'8,273',cat:'눈성형',img:4},
{id:'63161',title:'대용량 지방분해주사 포키주사',hospital:'롤리팝성형외과의원',hid:'370',area:'서울 신사역',price:99000,old:99000,off:0,rating:'8.8',reviews:'5,292',cat:'지방·다이어트',img:5},
{id:'13600',title:'옐로우 토탈 눈성형 자연유착 부분절개',hospital:'옐로우성형외과의원',hid:'2776',area:'서울 강남역',price:529000,old:1040000,off:49,rating:'9.8',reviews:'5,597',cat:'눈성형',img:6},
{id:'38735',title:'아띠에르 볼륨필러',hospital:'코디성형외과의원',hid:'250',area:'서울 강남역',price:209000,old:209000,off:0,rating:'9.0',reviews:'3,668',cat:'필러',img:7},
{id:'19701',title:'한 부위당 시간 X2배 인모드',hospital:'마이닥터의원',hid:'250',area:'서울 남성역',price:45000,old:60000,off:25,rating:'9.4',reviews:'3,692',cat:'리프팅',img:8},
{id:'30642',title:'윤곽주사 지방분해주사 갸름주사',hospital:'기린성형외과의원',hid:'398',area:'서울 신논현역',price:132000,old:263000,off:49,rating:'9.2',reviews:'3,668',cat:'지방·다이어트',img:9},
{id:'84173',title:'포레 프리미엄 보형물 성형외과 전문의 가슴성형',hospital:'포레성형외과의원',hid:'250',area:'서울 신논현역',price:8990000,old:12100000,off:25,rating:'9.9',reviews:'95',cat:'가슴성형',img:10},
{id:'8229',title:'여성 레이저 제모 여의사시술',hospital:'브이에스라인의원',hid:'250',area:'서울 강남역',price:30800,old:59400,off:48,rating:'9.3',reviews:'3,320',cat:'제모',img:11},
{id:'108081',title:'PRP주사 두피탈모 주사치료',hospital:'한나이브성형외과의원',hid:'250',area:'경기 안양역',price:120000,old:120000,off:0,rating:'9.9',reviews:'131',cat:'모발이식',img:12},
{id:'10037',title:'리스펙 이마축소',hospital:'리스펙성형외과의원',hid:'250',area:'서울 강남역',price:2300000,old:2300000,off:0,rating:'9.9',reviews:'397',cat:'모발이식',img:13},
{id:'82226',title:'프리미엄 탈모관리 모낭주사 두피레이저',hospital:'한나이브성형외과의원',hid:'250',area:'경기 안양역',price:55000,old:55000,off:0,rating:'9.7',reviews:'45',cat:'모발이식',img:14},
{id:'30836',title:'서진 헤어라인 비절개 모발이식 3000모',hospital:'서진성형외과의원',hid:'250',area:'서울 압구정역',price:3960000,old:7260000,off:45,rating:'9.9',reviews:'224',cat:'모발이식',img:15},
{id:'10628',title:'무보형물 코성형으로 자연스럽게 맞춤 코끝 디자인',hospital:'나나성형외과의원',hid:'938',area:'서울 압구정역',price:1639000,old:1639000,off:0,rating:'9.6',reviews:'959',cat:'코성형',img:1},
{id:'89442',title:'새살침으로 시작하는 모공 흉터 관리',hospital:'로담한의원',hid:'250',area:'서울 잠실역',price:50000,old:99000,off:49,rating:'9.5',reviews:'276',cat:'피부',img:3},
{id:'30784',title:'웨딩 신부 드레스라인 승모근보톡스 팔지방분해주사',hospital:'4월31일성형외과의원',hid:'250',area:'서울 학동역',price:330000,old:517000,off:36,rating:'8.3',reviews:'7',cat:'보톡스',img:5},
{id:'30781',title:'포텐자 모공 흉터 피부결 집중 케어',hospital:'디에이성형외과의원',hid:'250',area:'서울 역삼역',price:165000,old:325000,off:49,rating:'9.1',reviews:'52',cat:'피부',img:7},
{id:'62915',title:'웨딩 티타늄 온다리프팅 관리',hospital:'리프톤피부과의원',hid:'250',area:'서울 신사역',price:770000,old:1520000,off:49,rating:'9.6',reviews:'27',cat:'리프팅',img:9},
{id:'105376',title:'프리미엄 여성 헤어라인 모발이식',hospital:'모모성형외과의원',hid:'370',area:'서울 압구정역',price:825000,old:1500000,off:45,rating:'10',reviews:'56',cat:'모발이식',img:11}
];
const C=[
{id:'3f9d9338-d3d4-80da-916a-f41425fe332d',tag:'스킨부스터',title:'쥬베룩볼륨·레디어스 결절 부작용의 원인부터 예방·치료법까지',date:'2026.10.23',img:2},
{id:'3f9d9338-d3d4-80ad-b9b8-e68f17a4da55',tag:'스킨부스터',title:'레디어스·고우리·쥬베룩볼륨, 꼭 알아야 할 부작용과 주의사항',date:'2026.10.23',img:3},
{id:'3f9d9338-d3d4-80a2-a5cb-e79381ce9da1',tag:'스킨부스터',title:'고우리·레디어스·쥬베룩볼륨, 콜라겐부스터 성분별 효과 차이는?',date:'2026.10.23',img:4},
{id:'3f9d9338-d3d4-8046-b45f-c30e8c04e2fc',tag:'스킨부스터',title:'레디어스·쥬베룩볼륨·고우리 효과는 언제부터? 유지기간·주기까지',date:'2026.10.23',img:6},
{id:'3f9d9338-d3d4-8006-b5df-ca768da43e84',tag:'스킨부스터',title:'콜라겐부스터 필수 정보 총정리',date:'2026.10.23',img:9},
{id:'3ecd9338-d3d4-80c4-a030-e4932cc22a06',tag:'눈성형',title:'안검하수 수술 비용, 급여 인정 기준과 실비보험 청구 방법',date:'2026.10.08',img:1},
{id:'3ecd9338-d3d4-8021-85d5-f264039656f6',tag:'눈성형',title:'안검하수·눈매교정 재수술, 타이밍은 언제?',date:'2026.10.08',img:5},
{id:'3e2d9338-d3d4-80fa-8564-c527e6b1d0d8',tag:'피부',title:'여드름 관리 가이드 - 원인부터 시술까지 총정리',date:'2026.10.01',img:11},
{id:'3e2d9338-d3d4-80d7-a45e-fe521849320f',tag:'눈성형',title:'다크서클 원인과 유형별 치료 방법',date:'2026.10.01',img:13}
];
const POSTS=[
{author:'시원하군이제',time:'약 3시간 전',title:'앙코르 눈밑지 (레이저) 한달차!! 가오나시상 탈출했어요',body:'한 달 차가 되었는데 거울 볼 때마다 정말 달라진 느낌이에요. 처음에는 걱정했지만 시술 후 관리를 꾸준히 해주니 만족스러운 결과를 확인하고 있어요.',likes:23,comments:14},
{author:'푸룬실물영접',time:'약 3시간 전',title:'콧대 필러 이후 코수술 경험 공유',body:'코필러를 했을 때 콧대는 높아졌지만 제가 원하던 느낌이 아니었어요. 상담을 받고 고민했던 부분들을 비교한 다음 결정했습니다.',likes:17,comments:8},
{author:'피부톤올라가',time:'약 3시간 전',title:'리쥬란 상담 후기, 피부 컨디션이 좋아졌어요',body:'건조하고 얇은 피부 때문에 상담을 받았어요. 시술 전 여러 제품을 비교해봤고, 관리하면서 피부가 조금씩 변화하고 있습니다.',likes:33,comments:10},
{author:'애니모어르',time:'약 3시간 전',title:'마른 체형 골반 지방이식 경험담',body:'예전부터 고민하던 부분을 해결하기 위해 여러 곳을 알아봤어요. 현재는 시술 후 두 달 정도 지났고 일상생활도 편해졌습니다.',likes:19,comments:12},
{author:'이별이슈',time:'약 4시간 전',title:'코끝 라인이 제일 고민이에요',body:'코의 전체적인 모양에서 코끝 부분이 가장 신경 쓰여요. 비슷한 고민이 있으신 분들은 어떻게 상담받으셨나요?',likes:11,comments:9},
{author:'안녕달',time:'약 5시간 전',title:'첫 피부 시술 어디부터 시작하면 좋을까요?',body:'처음이라 여러 가지 정보들을 보고 있어요. 후기와 가격을 같이 확인하며 천천히 선택하려고 합니다.',likes:9,comments:5}
];
const CURATED=[
{title:'헤어라인부터 두피까지 모발 시술 모음',sub:'수술부터 비수술까지 내게 맞게 시작해요',ids:['108081','10037','82226','30836','105376','10628'],tabs:['전체','머리모발이식','헤어라인모발이식','두피케어','모발재생치료']},
{title:'무보형물 코성형으로 자연스럽게',sub:'자가조직으로 자연스러운 라인을 만들어보세요',ids:['10628','3853','6554','6353'],tabs:['전체','무보형물','콧대','코끝']},
{title:'흉터 고민 시술 모음',sub:'패인 자국을 깔끔하게 관리해보세요',ids:['89442','30781','19701','6492'],tabs:['전체','모공·흉터','레이저','새살침']},
{title:'웨딩 준비 시술 모음',sub:'결혼식 전 준비하기 좋은 시술이에요',ids:['30784','62915','8229','30642'],tabs:['전체','웨딩관리','리프팅','보톡스']}
];
const districts=['서울','경기','인천','부산','대구','대전','광주','울산','충남/세종','충북','전남','전북','경남','경북','강원','제주'];
const areas=['전체','강남역/신논현역/양재','청담/압구정/신사','선릉/삼성','논현/반포/학동','서초/교대/방배','홍대/합정/신촌','서울역/명동/회현','잠실/석촌/천호','종로/을지로/충정로'];
let heroIndex=0,collectionTabs={},activeRegion='서울',activeArea='전체',sortValue='RECOMMENDED',listCategory='전체',showModal='',modalDetails='',pageCount=12;
const fmt=n=>Number(n).toLocaleString('ko-KR');
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const encode=s=>encodeURIComponent(s);
const navigate=(p)=>{history.pushState({},'',p);window.scrollTo(0,0);listCategory='전체';sortValue='RECOMMENDED';pageCount=12;render()};
const route=()=>decodeURIComponent(location.pathname);
const qs=()=>new URLSearchParams(location.search);
const img=(u,cl='',alt='')=>'<img loading="lazy" class="'+cl+'" src="'+safe(u)+'" alt="'+safe(alt)+'" onerror="this.style.opacity=0;this.parentElement.classList.add(\'broken-img\')"/>';
const link=(t,path,cls='')=>'<button class="'+cls+'" data-to="'+safe(path)+'">'+t+'</button>';
const catNav=()=>'<div class="cat-strip">'+catNames.map((c,i)=>'<button class="cat-link" data-to="/search?category='+encode(c)+'"><img src="https://image2.gnsister.com/images/icon/20260604/'+icons[i]+'_off.png" alt="" onerror="this.outerHTML=\'<span class=cat-fallback>'+catEmoji[i]+'</span>\'"/><span>'+safe(c)+'</span></button>').join('')+'</div>';
function header(){
 const p=route();const sections=[['/','홈'],['/hospitals','병원'],['/events','이벤트'],['/community','커뮤니티'],['/contents','칼럼']];
 return '<div class="promo"><strong>앱 첫 설치 시</strong> 89,000원 쿠폰팩 증정 <span>🎁</span></div><header class="top-header"><div class="wrap topbar">'+
 '<button class="logo" aria-label="강남언니 홈" data-to="/"><span class="logo-symbol source-logo"><svg aria-hidden="true" viewBox="0 0 20 20" width="23" height="23"><path d="M11.389 9.107C9.9 10.595 8.45 13.72 8.45 16.014c0 2.968 1.805 3.986 2.959 3.986 1.868 0 3.378-2.736 4.109-4.11 1.867-3.507 3.412-8.154 4.04-11.244.549-2.693.619-3.615.015-4.22s-1.526-.534-4.22.014c-3.09.629-7.738 2.174-11.245 4.04C2.736 5.213 0 6.724 0 8.59c0 1.154 1.018 2.959 3.986 2.959 2.293 0 5.419-1.45 6.907-2.938z" fill="#FF6A3B"/></svg></span></button>'+
 '<form class="head-search" id="search-form"><input name="query" value="'+safe(qs().get('q')||'')+'" placeholder="궁금한 시술, 병원 이름을 검색해보세요" autocomplete="off"/><button class="search-go" type="submit" title="검색">⌕</button></form>'+
 '<div class="head-actions"><button class="head-link" data-action="region">지역 선택 ⌄</button><button class="head-login" data-action="login">로그인/가입</button></div></div>'+
 '<div class="navigation"><nav class="wrap nav-inner">'+sections.map(([path,name])=>'<button class="nav-item '+((path==='/'?p==='/':p.startsWith(path))?'selected':'')+'" data-to="'+path+'">'+name+'</button>').join('')+'<div class="nav-right"><button data-to="/about">강남언니 소개</button><button data-action="download">앱 다운로드 ↗</button></div></nav></div></header>';
}
function footer(){
 return '<footer class="site-footer"><div class="wrap footer-content"><div class="footer-tabs">'+[['홈','/'],['병원','/hospitals'],['이벤트','/events'],['커뮤니티','/community'],['칼럼','/contents'],['서비스 소개','/about']].map(x=>link(x[0],x[1])).join('')+'</div><div class="company"><strong>강남언니 · 주식회사 힐링페이퍼</strong><br/>대표: 홍승일 · 서울특별시 강남구 테헤란로 142<br/>사업자등록번호: 117-81-81256 · 통신판매업신고: 2015-서울서초-1147호<br/>이용약관 · 개인정보처리방침 · 고객센터<br/><span class="clone-label">※ 별도 개발된 UI 연구용 클론 시제품으로 강남언니 공식 사이트가 아닙니다. 상담·결제·예약 기능 및 실시간 DB는 제공되지 않습니다.</span></div></div></footer>'+
 '<nav class="bottom-mobile" aria-label="주요 탐색">'+ORIGINAL_BOTTOM_NAV.map(x=>'<button data-to="'+x.href+'" class="'+(route()===x.href?'on':'')+'" aria-label="'+x.label+'"><span class="source-bottom-icon"><svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="'+(route()===x.href?x.paths[1]:x.paths[0])+'"/></svg></span>'+x.label+'</button>').join('')+'</nav>';
}
function eventCard(e){
 if(!e)return '';
 const cover=e.image||ORIGINAL_EVENT_COVERS[E.indexOf(e)]||ASSETS[(e.img||0)%ASSETS.length];
 const off=e.discount??e.off??null;
 const review=e.reviews?String(e.reviews).replace(/[()]/g,''):null;
 return '<button class="event-card" data-to="/events/'+safe(e.id)+'"><div class="event-cover">'+img(cover,'',e.title)+'</div><div class="event-area">'+safe(e.hospital)+(e.area?' · '+safe(e.area):'')+'</div><h3 class="event-title">'+safe(e.title)+'</h3><div class="event-price">'+(off?'<span class="off">'+off+'%</span>':'')+'<strong>'+fmt(e.price)+'원</strong></div>'+(e.rating?'<div class="event-rating">★ '+safe(e.rating)+(review?' <span>('+review+')</span>':'')+'</div>':'')+'</button>';
}
const sectionHead=(title,sub,path)=>'<div class="section-head"><div><h2>'+safe(title)+'</h2>'+(sub?'<p>'+safe(sub)+'</p>':'')+'</div>'+(path?link('더보기 →',path):'')+'</div>';
function editorialCard(c){return '<button class="editorial-card" data-to="/contents/'+c.id+'">'+img(c.image||ORIGINAL_COLUMN_IMAGES[C.indexOf(c)]||ASSETS[c.img],'editorial-img',c.title)+'<div class="editorial-card-copy"><span class="editorial-category">'+safe(c.tag)+'</span><h3>'+safe(c.title)+'</h3><span class="editorial-date">'+c.date+'</span></div></button>'}
function home(){
 let s='<div class="wrap">'+catNav()+'<section class="hero"><div class="hero-shell">'+heroSlide()+'</div><div class="hero-dotbar">'+banners.map((b,i)=>'<button data-hero="'+i+'" class="'+(i===heroIndex?'current':'')+'" aria-label="'+(i+1)+'번 배너"></button>').join('')+'</div></section>';
 s+='<section class="site-section" style="margin-top:15px">'+sectionHead('강남언니 칼럼','', '/contents')+'<div class="editorial-cards">'+C.slice(0,4).map(editorialCard).join('')+'</div></section>';
 for(let i=0;i<ORIGINAL_CURATED.length;i++){const q=ORIGINAL_CURATED[i],selected=collectionTabs[i]||'전체',intro=CURATED[i];const items=q.items;s+='<section class="site-section curated-source">'+sectionHead(q.heading,intro?.sub||'',null)+'<div class="tabs">'+q.tabs.map(tab=>'<button class="'+(tab===selected?'active':'')+'" data-collection="'+i+'" data-tab="'+safe(tab)+'">'+safe(tab)+'</button>').join('')+'</div><div class="cards">'+items.map(eventCard).join('')+'</div></section>'}
 s+='<section class="site-section source-popular">'+sectionHead('인기 시술','',null)+'<div class="source-popular-links">'+['인모드리프팅','인모드','콧볼축소','쌍꺼풀(절개)','쌍꺼풀(자연유착)','코끝(자가연골)','코성형','눈성형','윤곽주사','눈매교정','눈재수술','가슴(보형물)','사각턱수술','이마필러'].map(n=>link(n,'/search?q='+encode(n),'source-popular-link')).join('')+'</div></section>';
 s+='<div class="bottom-space"></div></div>';return s;
}
function heroSlide(){const b=banners[heroIndex],src=bannerImages[heroIndex];return '<div class="hero-slide source-banner" style="background:'+b.bg+'"><img src="'+src+'" alt="'+safe(b.title)+'" onerror="this.style.display=\'none\'"/><div class="hero-controls"><button data-hero="prev" aria-label="이전 배너">‹</button><span class="hero-index">'+(heroIndex+1)+' / '+banners.length+'</span><button data-hero="next" aria-label="다음 배너">›</button></div></div>'}
function hospitalCard(h){return '<button class="hospital-card" data-to="/hospitals/'+h.id+'"><div class="hospital-pic">'+img(ORIGINAL_HOSPITAL_COVERS[H.indexOf(h)],'',h.name)+'</div><div class="copy"><p>'+safe(h.region)+'</p><h3>'+safe(h.name)+'</h3><p class="orange">★ '+h.rating+' <span style="color:#999">('+h.review+')</span></p><div class="hospital-count">이벤트 '+h.events+'개</div><p>'+safe(h.langs)+' 소통 가능</p></div></button>'}

function eventListRow(e){
 const title=safe(e.title),loc=safe(e.location||''),off=e.discount;
 return '<button class="source-event-row" data-to="/events/'+safe(e.id)+'">'+img(e.image,'source-event-thumb',e.title)+'<span class="source-event-copy"><span class="source-event-location">'+loc+'</span><strong>'+title+'</strong><small>VAT 포함</small><span class="source-event-price">'+(off?'<b>'+off+'% </b>':'')+fmt(e.price)+'원</span>'+(e.rating?'<span class="source-event-rating">★ '+safe(e.rating)+(e.reviews?' <small>'+safe(e.reviews)+'</small>':'')+'</span>':'')+'</span></button>';
}
function eventsListing(){
 const q=qs().get('q')||'',sort=qs().get('s')||sortValue;
 let list=ORIGINAL_EVENT_LIST.filter(e=>!q||[e.title,e.location].join(' ').includes(q));
 if(sort==='LOWEST_DISCOUNTED_COST')list.sort((a,b)=>a.price-b.price);
 if(sort==='HIGHEST_DISCOUNTED_COST')list.sort((a,b)=>b.price-a.price);
 if(sort==='HIGHEST_DISCOUNT_RATE')list.sort((a,b)=>(b.discount||0)-(a.discount||0));
 if(sort==='HIGHEST_RATING_AMOUNT')list.sort((a,b)=>Number(b.rating||0)-Number(a.rating||0));
 if(sort==='MOST_REVIEWS')list.sort((a,b)=>Number(String(b.reviews||'').replace(/[^0-9]/g,''))-Number(String(a.reviews||'').replace(/[^0-9]/g,'')));
 const sorts=[['RECOMMENDED','추천순'],['LATEST_STARTS_AT','최신순'],['LOWEST_DISCOUNTED_COST','낮은 가격순'],['HIGHEST_DISCOUNT_RATE','높은 할인순'],['HIGHEST_DISCOUNTED_COST','높은 가격순'],['MOST_REVIEWS','후기많은순'],['ENDING_SOON','마감 임박순'],['POPULAR','인기순'],['HIGHEST_RATING_AMOUNT','높은 평점순']];
 return '<div class="wrap"><section class="source-list-heading"><h1>이벤트</h1><button data-action="region">지역</button></section><div class="source-list-controls"><select id="sort-select" aria-label="정렬 기준">'+sorts.map(([v,n])=>'<option value="'+v+'" '+(sort===v?'selected':'')+'>'+n+'</option>').join('')+'</select></div><div class="source-event-list">'+(list.length?list.map(eventListRow).join(''):'<div class="empty-box">검색 결과가 없습니다.</div>')+'</div><div class="bottom-space"></div></div>';
}
function hospitalCard(h){
 const photo=h.image||ORIGINAL_HOSPITAL_COVERS[H.indexOf(h)]||'';
 const reviews=h.reviews||'('+String(h.review||'0')+')',langs=h.languages||((h.langs||'')+' 소통 가능');
 return '<button class="hospital-card" data-to="/hospitals/'+safe(h.id)+'"><div class="hospital-pic">'+img(photo,'',h.name)+'</div><div class="copy"><p class="source-hospital-location">'+safe(h.region||'')+'</p><h3>'+safe(h.name)+'</h3><p class="source-hospital-score">★ '+safe(h.rating||'')+' <span>'+safe(reviews)+'</span>　<span>이벤트 '+h.events+'개</span></p><p class="source-hospital-languages">'+safe(langs)+'</p></div></button>';
}
function hospitalListing(){
 const q=qs().get('q')||'';
 const list=ORIGINAL_HOSPITAL_LIST.filter(h=>!q||h.name.includes(q)||h.region.includes(q));
 return '<div class="wrap"><section class="source-list-heading"><h1>병원</h1><button data-action="region">지역</button></section><div class="source-list-controls"><button data-action="hospital-filter">추천순 ▾</button><strong>전체 '+(q?list.length.toLocaleString('ko-KR'):'1,635')+'건</strong></div><div class="hospitals-grid">'+list.map(hospitalCard).join('')+'</div><div class="bottom-space"></div></div>';
}

function sourceCategoryResults(q,data){
 const eventCards=data.events||[],hospitals=(data.hospitalIds||[]).map(id=>ORIGINAL_HOSPITAL_LIST.find(x=>x.id===id)).filter(Boolean);
 return '<div class="wrap source-search"><section class="source-search-heading"><h1>&#39;'+safe(q)+'&#39;에 대한 검색결과</h1><button data-action="region">지역　⌄</button></section>'+
 '<section class="source-search-section"><div class="source-search-section-head"><h2>이벤트</h2><span>'+fmt(data.eventCount)+'건</span></div><div class="source-event-list">'+eventCards.map(eventListRow).join('')+'</div><button class="source-search-more" data-to="/events?q='+encode(q)+'">이벤트 더보기 →</button></section>'+
 '<section class="source-search-section"><div class="source-search-section-head"><h2>시술후기</h2></div><div class="original-review-locked">'+img('https://unni.app/images/review-login/kr.webp','','로그인 후 후기')+'<p>로그인하면 자세한 시술 후기를 볼 수 있어요.</p><button class="cta" data-action="login">로그인하고 후기 보기</button></div></section>'+
 '<section class="source-search-section"><div class="source-search-section-head"><h2>병원</h2></div><div class="hospitals-grid">'+hospitals.map(hospitalCard).join('')+'</div><button class="source-search-more" data-to="/hospitals?q='+encode(q)+'">병원 더보기 →</button></section>'+
 '<section class="source-search-section"><div class="source-search-section-head"><h2>커뮤니티</h2></div><button class="source-search-more" data-to="/community?q='+encode(q)+'">커뮤니티 더보기 →</button></section>'+
 '<div class="bottom-space"></div></div>';
}
function searchPage(){const q=qs().get('q')||qs().get('category')||'';if(ORIGINAL_CATEGORY_SEARCH[q])return sourceCategoryResults(q,ORIGINAL_CATEGORY_SEARCH[q]);const events=E.filter(e=>!q||[e.title,e.hospital,e.cat].join(' ').includes(q));const hos=H.filter(h=>!q||[h.name,h.region].join(' ').includes(q));const cols=C.filter(c=>!q||c.title.includes(q)||c.tag.includes(q));let sections='<section class="search-section">'+sectionHead('이벤트','검색 결과 '+events.length+'건','/events?q='+encode(q))+'<div class="cards">'+events.slice(0,4).map(eventCard).join('')+'</div></section>';sections+='<section class="search-section">'+sectionHead('시술후기','자세한 후기는 로그인 후 볼 수 있습니다',null)+'<div class="empty-box"><b>로그인하면 실제로 방문한 분들의 자세한 후기를 볼 수 있어요</b><br/><button data-action="login" class="pill" style="margin-top:15px">로그인/가입 →</button></div></section>';sections+='<section class="search-section">'+sectionHead('병원','검색 결과 '+hos.length+'건','/hospitals?q='+encode(q))+'<div class="search-mini">'+(hos.length?hos.slice(0,3).map(h=>'<button class="search-hospital" data-to="/hospitals/'+h.id+'"><h3>'+safe(h.name)+'</h3><p>'+safe(h.region)+'　 <span class="orange">★ '+h.rating+'</span></p></button>').join(''):'<p style="font-size:13px;color:#999">병원 검색 결과가 없습니다.</p>')+'</div></section>';sections+='<section class="search-section">'+sectionHead('칼럼','관련 정보 콘텐츠','/contents')+'<div class="editorial-cards">'+(cols.length?cols.slice(0,4):C.slice(0,4)).map(editorialCard).join('')+'</div></section>';return '<div class="wrap"><div class="list-head"><h1>\''+safe(q)+'\'에 대한 검색결과</h1><p>시술, 병원, 후기와 칼럼 정보를 한곳에서 찾아보세요</p></div><div class="search-sections">'+sections+'</div><div class="bottom-space"></div></div>'}
function eventDetail(e){if(!e)return notFound();if(e.id==='6554')return eventDetailPop(e);if(e.image)return eventDetailCatalog(e);const h=H.find(x=>x.id===e.hid);return '<div class="wrap"><div class="breadcrumbs">홈　›　이벤트　›　'+safe(e.cat)+'</div><div class="detail-layout"><main class="detail-main"><div class="detail-heroimg" style="overflow:hidden">'+img(ASSETS[e.img],'detail-heroimg',e.title)+'</div><div class="detail-info"><div class="blog-pill">'+safe(e.cat)+'</div><h1 style="margin-top:12px">'+safe(e.title)+'</h1><p>'+safe(e.hospital)+'　·　'+safe(e.area)+'　·　<span class="orange">★ '+e.rating+'</span> ('+e.reviews+')</p></div><section class="detail-block"><h2>시술 후기</h2><p>로그인하면 실제로 방문한 분들의 자세한 후기를 볼 수 있어요.</p><button class="pill" data-action="login" style="margin-top:15px">후기 확인하기 →</button></section><section class="detail-block"><h2>시술 설명</h2><p>원하는 나를 위한 시술을 살펴보세요. '+safe(e.hospital)+'에서 제공하는 '+safe(e.cat)+' 관련 이벤트와 시술 정보를 확인할 수 있습니다.</p><p>시술 내용과 비용은 병원 및 선택 옵션에 따라 달라질 수 있습니다. 해당 내용은 원본 서비스를 참고해 재구성한 화면 시제품입니다.</p></section><section class="detail-block"><h2>옵션 정보</h2><div class="feature-tags"><span>VAT 포함</span><span>방문 상담</span><span>선택 옵션별 가격</span></div>'+[e.title,e.cat+' 추가 옵션','부가 시술 패키지'].map((n,i)=>'<div style="padding:18px 0;border-bottom:1px solid #eee"><strong>'+(i+1)+'. '+safe(n)+'</strong><p>'+safe(e.cat)+' · 1회</p><strong class="orange">'+fmt(Math.round(e.price*(1+i*.6)))+'원</strong></div>').join('')+'</section><section class="detail-block"><h2>병원 정보</h2><button class="doctor-row" data-to="/hospitals/'+safe(e.hid)+'"><span class="doctor-avatar">✚</span><span><strong>'+safe(e.hospital)+'</strong><span>'+safe(e.area)+'</span></span></button></section><div class="bottom-space"></div></main><aside class="detail-side"><span class="blog-pill">이벤트 · '+safe(e.cat)+'</span><h3 style="line-height:1.55;margin-top:12px">'+safe(e.title)+'</h3><select class="option-select" aria-label="옵션 선택"><option>기본 시술 옵션 (1회)</option><option>추가 옵션</option><option>패키지 옵션</option></select><p>VAT 포함'+(e.off?'　·　할인 '+e.off+'%':'')+'</p><div class="price-big">'+(e.off?'<span>'+e.off+'% </span>':'')+fmt(e.price)+'원</div><p>최대 18,000P 적립 · 후기 적립 혜택</p><button class="cta" data-action="consult">상담 신청하기</button><button class="pill" data-action="favorite" style="width:100%;margin-top:10px">♡ 관심 시술 저장</button></aside></div></div>'}
function eventDetailPop(e){
 const options=[
  ['추가금 없는 12홀 자연유착(비절개)','쌍꺼풀(자연유착) 1회',849000,429000,49],
  ['윗트임','윗트임 1회',650000,330000,49],
  ['눈매교정','눈매교정 1회',650000,330000,49],
  ['눈재수술','눈재수술 1회',1420000,720000,49],
  ['앞트임','앞트임 1회',650000,330000,49],
  ['밑트임','밑트임 1회',650000,330000,49],
  ['뒤트임','뒤트임 1회',650000,330000,49],
  ['12홀 매몰','쌍꺼풀(매몰) 1회',829000,429000,48],
  ['절개 눈성형','절개 눈성형 1회',2830000,1430000,49]
 ];
 const dImgs=[
  'https://image2.gnsister.com/images/direct/1792488261170_99207eff91e74846a1b62f5260510559.jpg?originalImageWidth=1080&originalImageHeight=11821',
  'https://image2.gnsister.com/images/direct/1792488260746_fdc7f884b7b0414593e242c613860d96.jpg?originalImageWidth=1080&originalImageHeight=5950',
  'https://image2.gnsister.com/images/direct/1792488260702_bc43e69c09fb4f6996971c495e8ad6f7.jpg?originalImageWidth=1080&originalImageHeight=5378',
  'https://image2.gnsister.com/images/direct/1792488261032_b682eaf26821471d901840dce10fd412.jpg?originalImageWidth=1080&originalImageHeight=14546'
 ];
 const cover='https://image2.gnsister.com/images/direct/1792143627496_b77779c2e7b14596a89a739caba8587d.jpg?originalImageWidth=1080&originalImageHeight=470';
 return '<div class="wrap"><div class="breadcrumbs">홈　›　이벤트　›　눈성형</div><div class="detail-layout"><main class="detail-main">'+
 img(cover,'original-event-hero',e.title)+
 '<div class="detail-info"><h1>'+safe(e.title)+'</h1><p class="orange">★ 9.7　<span style="color:#888">(19,574)</span></p></div>'+
 '<section class="detail-block"><div class="original-option-primary"><strong>옵션 1</strong><h2>추가금 없는 12홀 자연유착(비절개)</h2><p>쌍꺼풀(자연유착), 1회</p><p><del>849,000원</del> (VAT 포함)</p><div class="original-price"><b>49%</b> 429,000원</div></div><div class="feature-tags"><span>최대 18,000P 적립</span><span>사진 있는 일반 후기 3,000P</span><span>영수증 인증 3,000P</span><span>경과 후기 15,000P</span></div><button class="doctor-row" data-to="/hospitals/370"><span class="doctor-avatar">✚</span><span><strong>팝성형외과의원</strong><span>서울 압구정역</span></span></button></section>'+
 '<section class="detail-block"><h2>시술 후기</h2><div class="original-review-locked">'+img('https://unni.app/images/review-login/kr.webp','','로그인 후 상세 후기')+'<p>로그인하면 실제로 방문한 분들의 자세한 후기를 모두 볼 수 있어요</p><button class="cta" data-action="login">3초만에 로그인하고 보기</button></div></section>'+
 '<section class="detail-block"><h2>시술 설명</h2><p>팝성형외과의원 눈성형 후기 많은 순 1위 · 눈성형 전담 케이스 56,000건 이상</p><p>12개의 유착 포인트에 고정하는 자연유착 방식과 개인별 라인 디자인, 필요에 따른 트임 및 눈매교정 시술을 소개합니다.</p></section>'+
 '<section class="detail-block"><h2>옵션 정보</h2><div class="feature-tags"><span>VAT 포함</span><span>마취비 포함</span><span>사후관리비 포함</span></div><p>시술에 대한 정보는 참고 사항이며, 병원 방문 시 개인의 상태에 따라 달라질 수 있어요.</p>'+
 options.map((o,i)=>'<div class="source-option-row"><b>'+String(i+1)+'</b><div><h3>'+safe(o[0])+'</h3><p>'+safe(o[1])+'</p><p class="source-was"><del>'+fmt(o[2])+'원</del> (VAT 포함)</p><div><strong class="orange">'+o[4]+'% </strong><strong>'+fmt(o[3])+'원</strong></div></div></div>').join('')+'</section>'+
 '<section class="detail-block"><h2>이런 분에게 추천해요</h2><ul><li>나에게 맞는 쌍꺼풀을 찾고 싶으신 분</li><li>흉터와 회복 기간을 고려하시는 분</li><li>자연스러운 쌍꺼풀 라인을 원하시는 분</li><li>고정력과 유지력을 중요하게 생각하시는 분</li></ul></section>'+
 '<section class="detail-block"><h2>시술 과정 : 60분</h2><ol><li>1:1 상담</li><li>수술 전 원장님 상담</li><li>마취 후 수술 진행</li><li>회복 후 귀가</li></ol></section>'+
 '<section class="detail-block"><h2>부작용 안내</h2><p>수술 후 예상치 못한 염증, 출혈, 감염 등 부작용이 발생할 수 있습니다.</p></section>'+
 '<section class="detail-block"><h2>상세 정보</h2><div class="source-detail-images">'+dImgs.map(u=>img(u,'','시술 상세 정보')).join('')+'</div></section>'+
 '<section class="detail-block"><h2>팝성형외과의원</h2><button class="doctor-row" data-to="/hospitals/370"><span class="doctor-avatar">✚</span><span><strong>병원 정보 보기</strong><span>서울 강남구 논현로 837 원방빌딩 1층</span></span></button></section></main>'+
 '<aside class="detail-side"><p>옵션 1</p><h3>추가금 없는 12홀 자연유착(비절개)</h3><select class="option-select" id="pop-option-select">'+options.map((o,i)=>'<option value="'+i+'">'+String(i+1)+'. '+safe(o[0])+'</option>').join('')+'</select><p>VAT 포함</p><div class="price-big" id="pop-price"><span>49% </span>429,000원</div><p>최대 18,000P 적립 · 후기 적립</p><button class="cta" data-action="consult">상담받기</button></aside></div></div>';
}

const eventSelectedState={},eventExpandedState={};
function eventDetailCatalog(e){
 const d=ORIGINAL_EVENT_DETAILS[e.id];
 if(!d){return '<div class="wrap"><div class="detail-info"><h1>'+safe(e.title)+'</h1><p>'+safe(e.hospital||e.location||'')+'</p></div>'+img(e.image||ASSETS[0],'original-event-hero',e.title)+'<p class="source-detail-note">원본에서 확인한 상세 정보가 등록되지 않은 항목입니다.</p></div>';}
 const ops=d.options||[],selected=Math.min(eventSelectedState[e.id]||0,Math.max(ops.length-1,0)),choice=ops[selected]||{price:e.price,discount:e.discount,name:e.title};
 const hospital=ORIGINAL_HOSPITAL_LIST.find(h=>(e.location||'').includes(h.name));
 const images=d.details||[];
 const expanded=Boolean(eventExpandedState[e.id]);
 return '<div class="wrap source-event-detail">'+
 img(d.banner||e.image,'source-event-banner',e.title)+
 '<section class="source-event-summary"><h1>'+safe(d.title||e.title)+'</h1><p>'+safe(e.location||'')+'　'+(e.rating?'★ '+safe(e.rating):'')+(e.reviews?' '+safe(e.reviews):'')+'</p></section>'+
 '<section class="detail-block"><div class="source-event-main-option"><strong>옵션 '+(selected+1)+'</strong><h2>'+safe(choice.name)+'</h2><p>VAT 포함</p><div class="source-event-main-price">'+(e.discount?'<b>'+e.discount+'% </b>':'')+fmt(choice.price||e.price)+'원</div></div><button class="source-option-open" data-action="event-options">전체보기</button></section>'+
 '<section class="detail-block"><h2>시술 후기</h2><div class="original-review-locked">'+img('https://unni.app/images/review-login/kr.webp','','시술 후기 로그인 안내')+'<button class="cta" data-action="login">3초만에 로그인하고 보기</button></div></section>'+
 '<section class="detail-block"><h2>시술 설명</h2><p>'+safe(d.sourceDescription||'')+'</p></section>'+
 '<section class="detail-block source-all-options" id="source-event-option-list"><h2>옵션 정보</h2><div class="feature-tags"><span>VAT 포함</span><span>마취비 포함</span><span>사후관리비 포함</span></div><p class="source-detail-note">시술에 대한 정보는 참고 사항이며, 병원 방문 시 개인의 상태에 따라 달라질 수 있어요.</p>'+
 ops.map((op,i)=>'<button class="source-option-row '+(i===selected?'selected':'')+'" data-event-opt="'+safe(e.id)+'" data-opt-index="'+i+'"><b>'+(i+1)+'</b><span><strong>'+safe(op.name)+'</strong>'+(op.originalPrice&&op.originalPrice!==op.price?'<small><del>'+fmt(op.originalPrice)+'원</del></small>':'')+'<span class="source-option-price">'+fmt(op.price||e.price)+'원</span></span></button>').join('')+'</section>'+
 '<section class="detail-block"><h2>이런 분에게 추천해요</h2>'+(d.recommendations?.length?'<ul class="source-recommend-list">'+d.recommendations.map(n=>'<li>'+safe(n)+'</li>').join('')+'</ul>':'')+'</section>'+ 
 '<section class="detail-block"><h2>시술 과정'+(d.duration?' : '+safe(d.duration):'')+'</h2>'+(d.steps?.length?'<ol class="source-step-list">'+d.steps.map(n=>'<li>'+safe(n)+'</li>').join('')+'</ol>':'')+'</section>'+ 
 '<section class="detail-block"><h2>부작용 안내</h2><p>'+safe(d.sideEffects||'')+'</p></section>'+ 
 '<section class="detail-block"><h2>상세 정보</h2><div class="source-event-more '+(expanded?'expanded':'')+'">'+images.map(u=>img(u,'','시술 상세 이미지')).join('')+'</div>'+(images.length?'<button class="source-event-expand" data-event-expand="'+safe(e.id)+'">'+(expanded?'접기':'전체보기')+'</button>':'')+'</section>'+
 '<section class="detail-block"><h2>'+safe(hospital?.name||e.location||'병원 정보')+'</h2>'+(hospital?'<button class="doctor-row" data-to="/hospitals/'+hospital.id+'">'+img(hospital.image,'source-brief-hospital-image',hospital.name)+'<span><strong>'+safe(hospital.name)+'</strong><span>'+safe(hospital.region)+'</span></span></button>':'')+'</section>'+
 '<button class="source-event-sticky-cta" data-action="consult">상담 신청하기</button>'+
 '<div class="bottom-space"></div></div>';
}
const hospitalSlideState={};
function hospitalDetailSource(h){
 const d=ORIGINAL_HOSPITAL_DETAILS[h.id],images=d.gallery.length>1?[...d.gallery.slice(1),d.gallery[0]]:d.gallery;
 const slide=(hospitalSlideState[h.id]||0)%Math.max(1,images.length);
 const about=(d.introduction||'');
 const events=(d.eventIds||[]).map(id=>ORIGINAL_EVENT_LIST.find(e=>e.id===id)||ORIGINAL_CURATED.flatMap(c=>c.items).find(e=>e.id===id)||E.find(e=>e.id===id)).filter(Boolean).slice(0,4);
 const review=h.reviews||'('+h.review+')';
 const rows=d.hours||[];
 return '<div class="wrap source-hospital-detail"><div class="source-hospital-gallery">'+img(images[slide]||h.image,'source-hospital-main-photo',h.name)+'<button aria-label="이전 사진" class="source-gallery-arrow previous" data-hospital-slide="'+h.id+'" data-dir="-1">‹</button><button aria-label="다음 사진" class="source-gallery-arrow next" data-hospital-slide="'+h.id+'" data-dir="1">›</button><span class="source-gallery-count">'+(slide+1)+' / '+images.length+'</span></div>'+
 '<div class="source-hospital-intro"><h1>'+safe(h.name)+'</h1><p>'+safe(h.region||'')+'　★ '+safe(h.rating||'')+'　'+safe(review)+'</p><div class="source-hospital-nav"><a href="#hospital-intro">병원 정보</a><a href="#hospital-events">이벤트 가격</a><a href="#hospital-reviews">시술 후기</a></div></div>'+
 '<section id="hospital-intro" class="detail-block"><h2>병원 정보 '+d.features.length+'건</h2><div class="source-hospital-features">'+d.features.map(n=>'<div><span>✓</span>'+safe(n)+'</div>').join('')+'</div></section>'+
 '<section class="detail-block"><h2>병원 소개</h2><p class="source-hospital-description">'+safe(about)+'</p></section>'+
 '<section class="detail-block"><h2>진료 항목</h2><div class="feature-tags">'+d.departments.map(n=>'<span>'+safe(n)+'</span>').join('')+'</div></section>'+
 '<section class="detail-block"><h2>주요 의료진</h2>'+(d.doctorProfiles||[]).map((doctor,i)=>'<button class="doctor-row" data-to="/doctors/'+safe(doctor.id)+'"><span class="doctor-avatar">'+img(doctor.image,'',doctor.name)+'</span><span><strong>'+safe(d.doctors[i]||doctor.name)+'</strong><span>의료진 상세보기</span></span></button>').join('')+'</section>'+
 '<section class="detail-block"><h2>진료 시간</h2><div class="source-hours">'+['월','화','수','목','금','토','일'].map((n,i)=>'<div><strong>'+n+'</strong><span>'+safe(rows[i]||'')+'</span></div>').join('')+'</div></section>'+
 '<section class="detail-block"><h2>주소</h2><p>'+safe(d.address||'')+'</p></section>'+
 '<section class="detail-block" id="hospital-events"><h2>이벤트 가격 '+Number(h.events||0)+'건</h2><div class="source-hospital-event-cards">'+events.map(e=>'<div>'+eventCard(e)+'</div>').join('')+'</div></section>'+
 '<section class="detail-block" id="hospital-reviews"><h2>시술 후기 '+safe(review)+'건</h2><div class="original-review-locked"><p>로그인하면 자세한 후기를 볼 수 있어요.</p><button class="cta" data-action="login">로그인하고 후기 보기</button></div></section>'+
 '<div class="bottom-space"></div></div>';
}
function hospitalDetail(h){if(!h)return notFound();if(ORIGINAL_HOSPITAL_DETAILS[h.id])return hospitalDetailSource(h);return '<div class="wrap"><div class="breadcrumbs">홈　›　병원　›　'+safe(h.name)+'</div><div class="detail-layout"><main class="detail-main"><div class="hospital-gallery">'+img(h.id==='250'?ORIGINAL_HOSPITAL_GALLERY[0]:ORIGINAL_HOSPITAL_COVERS[H.indexOf(h)],'hospital-gallery-main',h.name)+(h.id==='250'?'<div class="hospital-gallery-thumbs">'+ORIGINAL_HOSPITAL_GALLERY.slice(1).map((u,i)=>img(u,'',h.name+' 사진 '+(i+2))).join('')+'</div>':'')+'</div><div class="detail-info"><h1>'+safe(h.name)+'</h1><p>'+safe(h.region)+'　 <span class="orange">★ '+h.rating+'</span> 후기 '+h.review+'개　·　이벤트 '+h.events+'개</p></div><section class="detail-block"><h2>병원 정보 11건</h2><div class="feature-tags">'+['분야별 공동 진료','응급 대응 체계','시술 후 관리','전용 휴식 공간','입원 시설','마취과 전문의 상주','의료진 실명 공개','성형외과 전문의 진료'].map(n=>'<span>'+n+'</span>').join('')+'</div></section><section class="detail-block"><h2>병원 소개</h2><p>'+safe(h.name)+'은(는) 방문하시는 분들을 위한 다양한 상담과 시술 정보를 제공하는 의료기관입니다. 이 페이지는 원본 사이트 구성과 탐색 동선을 재현한 UI 시제품입니다.</p></section><section class="detail-block"><h2>진료 항목</h2><div class="feature-tags">'+catNames.slice(0,11).map(n=>'<span>'+safe(n)+'</span>').join('')+'</div></section><section class="detail-block"><h2>주요 의료진</h2>'+[1,2,3].map((n,i)=>'<button class="doctor-row" data-to="/doctors/2319"><span class="doctor-avatar">♙</span><span><strong>'+(i===0?'양희재':i===1?'성형외과 전문의':'피부과 의료진')+'</strong><span>'+safe(h.name)+' · 의료진 상세보기</span></span></button>').join('')+'</section><section class="detail-block"><h2>진료 시간</h2><p>월–목 10:00~19:00　금 10:00~20:00<br/>토 10:00~18:00　일 휴진</p></section><section class="detail-block"><h2>주소</h2><p>'+safe(h.region)+' · 병원 상세 주소는 원본 서비스에서 확인하세요</p></section><section class="detail-block"><h2>이벤트 가격 '+h.events+'건</h2><div class="cards">'+E.filter(e=>e.hid===h.id).slice(0,4).map(eventCard).join('')+'</div></section><section class="detail-block"><h2>시술 후기 '+h.review+'건</h2><p>로그인하면 자세한 후기를 볼 수 있어요.</p><button class="pill" data-action="login">로그인하고 후기 보기 →</button></section></main><aside class="detail-side"><span class="blog-pill">병원</span><h2 style="margin-top:13px">'+safe(h.name)+'</h2><p>'+safe(h.region)+'</p><div class="price-big"><span>★ '+h.rating+'</span></div><p>후기 '+h.review+'개　·　이벤트 '+h.events+'개</p><button class="cta" data-action="consult">상담 신청하기</button><button class="pill" style="width:100%;margin-top:10px" data-action="favorite">♡ 관심 병원 등록</button></aside></div></div>'}

function doctorDetail(id){
 let profile=null,clinic=null;
 for(const h of ORIGINAL_HOSPITAL_LIST){
   const d=ORIGINAL_HOSPITAL_DETAILS[h.id];
   const p=(d?.doctorProfiles||[]).find(x=>x.id===id);
   if(p){profile=p;clinic=h;break;}
 }
 if(!profile)return notFound();
 return '<div class="wrap"><div class="breadcrumbs">홈　›　병원　›　의사</div><div class="source-doctor-detail"><div class="source-doctor-heading">'+img(profile.image,'source-doctor-image',profile.name)+'<div><h1>'+safe(profile.name)+' 원장</h1><p>'+safe(clinic.name)+'</p></div></div><section class="detail-block"><h2>시술 후기</h2><div class="original-review-locked"><p>로그인하면 실제 이용자의 자세한 후기를 볼 수 있어요.</p><button class="cta" data-action="login">후기 확인하기</button></div></section><section class="detail-block"><h2>소속 병원</h2><button class="doctor-row" data-to="/hospitals/'+clinic.id+'"><span class="doctor-avatar">'+img(clinic.image,'',clinic.name)+'</span><span><strong>'+safe(clinic.name)+'</strong><span>'+safe(clinic.region||'')+'</span></span></button></section></div><div class="bottom-space"></div></div>';
}

let activeCommunityTag='전체';
function community(){
 const posts=ORIGINAL_COMMUNITY_POSTS.filter(p=>activeCommunityTag==='전체'||p.category===activeCommunityTag);
 return '<div class="wrap source-community"><section class="source-list-heading"><h1>커뮤니티</h1><button data-action="community-sort">추천순　⌄</button></section><nav class="source-community-tabs">'+ORIGINAL_COMMUNITY_TAGS.map(tag=>'<button class="'+(tag===activeCommunityTag?'selected':'')+'" data-community-tab="'+safe(tag)+'">'+safe(tag)+'</button>').join('')+'</nav><div class="source-community-feed">'+posts.map(p=>'<button class="source-community-item" data-action="post" data-post="'+p.id+'"><div class="source-community-person"><span class="source-community-avatar">'+safe(p.author.slice(0,1))+'</span><div><strong>'+safe(p.author)+'</strong><p>'+safe(p.time)+'　·　'+safe(p.category)+'</p></div></div><p class="source-community-excerpt">'+safe(p.body)+'</p><div class="source-community-photo-lock"><img src="https://unni.app/images/community/photo-lock-banner-thumbs.webp" alt=""/><span><small>3초만에 로그인하고</small><strong>작성자가 올린 사진을 확인해 보세요</strong></span></div><div class="source-community-reactions"><span>♡ '+p.likes+'</span><span>☏ '+p.comments+'</span><span class="source-community-save">♧</span></div></button>').join('')+'</div><div class="bottom-space"></div></div>';
}
function contents(){
 return '<div class="wrap"><section class="source-list-heading"><h1>강남언니 칼럼</h1></section><div class="editorial-cards source-editorial-list">'+ORIGINAL_ARTICLE_LIST.map(editorialCard).join('')+'</div><div class="bottom-space"></div></div>';
}
function contentDetail(c){if(!c)return notFound();return '<div class="wrap"><div class="breadcrumbs">홈　›　칼럼　›　'+safe(c.tag)+'</div><article class="article-content"><span class="blog-pill">'+safe(c.tag)+'</span><h1 style="margin-top:15px">'+safe(c.title)+'</h1><time>'+c.date+'</time>'+img(c.image||ORIGINAL_COLUMN_IMAGES[C.indexOf(c)]||ASSETS[c.img],'',c.title)+'<p>어떤 시술을 선택할지 고민하고 있다면 정보를 충분히 이해하고 비교해보는 과정이 필요합니다.</p><div class="article-toc"><strong>목차</strong><br/>1. 시술의 특징과 원리<br/>2. 선택할 때 확인할 점<br/>3. 주의사항과 관리 방법<br/>4. 자주 묻는 질문(FAQ)</div><h2>1. 시술의 특징과 원리</h2><p>다양한 시술은 목적과 방법에 따라 특징이 다릅니다. 원하는 결과를 얻기 위해서는 시술 정보와 의료진의 설명을 함께 확인하는 것이 좋습니다.</p><h2>2. 선택할 때 확인할 점</h2><p>여러 병원과 후기, 시술 옵션을 비교하면서 나에게 적절한 선택을 고민할 수 있습니다.</p><h2>3. 주의사항과 관리 방법</h2><p>시술 전후 관리 방법과 발생 가능한 부작용은 의료진과 상담하여 확인해야 합니다.</p><h2>4. 자주 묻는 질문(FAQ)</h2><p>모든 시술은 개인의 상태에 따라 적용 방법과 결과가 다르므로 담당 의료진의 진료가 중요합니다.</p><div style="margin-top:40px">'+sectionHead('함께 읽으면 좋은 콘텐츠','', '/contents')+'<div class="editorial-cards">'+C.slice(0,4).map(editorialCard).join('')+'</div></div></article></div>'}
function about(){return '<div class="wrap"><div class="about-hero"><span class="blog-pill">GANGNAM UNNI</span><h1 style="margin-top:15px">내 선택에 확신을,<br/>강남언니</h1><p>탐색은 더 쉬워지고, 선택은 선명해지고,<br/>원하는 나를 향한 여정은 계속 이어져요</p></div><div class="about-features">'+[['시술이 궁금할 땐 AI 대화로 시작','필요한 질문으로 바로 검색하고 원하는 정보를 살펴보세요'],['시술 트렌드를 한눈에','전문 칼럼과 큐레이션으로 시술 정보를 탐색하세요'],['후기와 정보를 함께 비교','병원, 의료진, 시술 가격과 후기를 함께 살펴보세요'],['원하는 기준으로 시술 정보 비교','비교와 상세 옵션으로 선택을 도와줘요'],['혜택이 쌓이는 포인트와 쿠폰','다양한 혜택과 프로모션을 확인하세요'],['쓸수록 나에게 맞춰지는 탐색','개인화된 홈과 검색을 제공하는 서비스']].map(([a,b])=>'<div class="about-feature"><h3>'+a+'</h3><p>'+b+'</p></div>').join('')+'</div><div class="bottom-space"></div></div>'}
function promotion(){return '<div class="wrap"><div class="page-banner"><div><h1>강남언니 케어링 키트</h1><p>수술 후기 남기고 케어링 키트 신청하세요</p></div><span>🎁</span></div><div class="article-content"><h2>여러분의 선택, 그 이후의 삶은 어떠신가요?</h2><p>고민부터 결심, 그리고 지금의 회복까지. 고객님의 솔직한 경험을 다른 이용자와 함께 나눠주세요.</p><h2>HOW TO　신청 방법</h2><p>① 앱에서 시술 후 후기를 작성해 주세요.</p><p>② 후기 작성 후 신청 버튼을 통해 접수합니다.</p><button class="cta" data-action="download">앱 다운로드</button></div></div>'}
function notFound(){return '<div class="notfound"><h2>페이지를 찾을 수 없습니다</h2><p>다른 메뉴에서 원하는 정보를 찾아보세요.</p><button class="cta" style="max-width:250px;margin:25px auto" data-to="/">홈으로 돌아가기 →</button></div>'}
function modal(){
 if(!showModal)return '';
 if(showModal==='region')return '<div class="modal-bg"><div class="modal"><button class="modal-close" data-action="modalclose">×</button><h2>지역</h2><p>관심 지역을 선택하세요</p><div class="region-list">'+districts.map(n=>'<button class="'+(n===activeRegion?'on':'')+'" data-region="'+n+'">'+n+'</button>').join('')+'</div><h3>'+activeRegion+' 상세 지역</h3><div class="area-tags">'+areas.map(a=>'<button class="'+(a===activeArea?'on':'')+'" data-area="'+a+'">'+a+'</button>').join('')+'</div><div class="modal-actions"><button data-action="regionreset">초기화</button><button data-action="modalclose">필터 선택 완료</button></div></div></div>';
 if(showModal==='post'){const p=ORIGINAL_COMMUNITY_POSTS[Number(modalDetails)||0];return '<div class="modal-bg"><div class="modal"><button class="modal-close" data-action="modalclose">×</button><p>'+safe(p.author)+' · '+safe(p.time)+' · '+safe(p.category)+'</p><p style="color:#444;margin-top:22px;line-height:2">'+safe(p.body)+'</p><div class="comment-actions"><span>♡ '+p.likes+'</span><span>댓글 '+p.comments+'</span></div><button class="cta" data-action="login">로그인하고 댓글 보기</button></div></div>'}
 
 const titles={login:'로그인/가입',download:'앱 다운로드',consult:'상담 신청',favorite:'관심 목록', 'hospital-filter':'정렬 및 필터'};
 const descriptions={login:'강남언니 앱에서 계정을 만들고 후기를 확인하세요.',download:'앱에서 제공되는 추가 기능을 이용해 보세요.',consult:'이 화면은 UI 클론 시제품입니다. 실제 상담 예약과 결제는 연결되어 있지 않습니다.',favorite:'관심 목록은 로그인 후 사용할 수 있는 기능입니다. 현재 화면은 UI 시제품입니다.','hospital-filter':'병원 정렬 및 필터 화면입니다.'};
 return '<div class="modal-bg"><div class="modal" style="max-width:460px"><button class="modal-close" data-action="modalclose">×</button><h2>'+titles[showModal]+'</h2><p>'+descriptions[showModal]+'</p><div style="margin:32px auto;max-width:240px;background:#fff3ef;border-radius:15px;text-align:center;padding:40px 20px;color:#ff623e;font-weight:800;font-size:24px">강남언니<br/><span style="font-size:13px">PC UI REFERENCE</span></div><button class="cta" data-action="modalclose">확인</button></div></div>'}
function render(){
 document.title='강남언니 - 내 선택에 확신을';
 const p=route();let content;
 if(p==='/')content=home();
 else if(p==='/search')content=searchPage();
 else if(p==='/events')content=eventsListing();
 else if(/^\/events\/[^/]+$/.test(p))content=eventDetail(ORIGINAL_EVENT_LIST.find(e=>e.id===p.split('/')[2])||ORIGINAL_CURATED.flatMap(x=>x.items).find(e=>e.id===p.split('/')[2])||Object.values(ORIGINAL_CATEGORY_SEARCH).flatMap(x=>x.events).find(e=>e.id===p.split('/')[2])||E.find(e=>e.id===p.split('/')[2]));
 else if(p==='/hospitals')content=hospitalListing();
 else if(/^\/hospitals\/[^/]+$/.test(p))content=hospitalDetail(H.find(e=>e.id===p.split('/')[2])||ORIGINAL_HOSPITAL_LIST.find(e=>e.id===p.split('/')[2]));
 else if(/^\/doctors\/[^/]+$/.test(p))content=doctorDetail(p.split('/')[2]);
 else if(p==='/community')content=community();
 else if(p==='/contents')content=contents();
 else if(p.startsWith('/contents/'))content=contentDetail(ORIGINAL_ARTICLE_LIST.find(e=>e.id===p.split('/')[2])||C.find(e=>e.id===p.split('/')[2]));
 else if(p==='/about')content=about();
 else if(p.startsWith('/discovery/'))content=promotion();
 else if(p==='/district-filter'){showModal='region';content=home();}
 else content=notFound();
 document.querySelector('#app').innerHTML=header()+'<main>'+content+'</main>'+footer()+modal();
}
document.addEventListener('click',e=>{
 const target=e.target.closest('button');if(!target)return;
 if(target.dataset.to){navigate(target.dataset.to);return;}
 if(target.dataset.communityTab!==undefined){activeCommunityTag=target.dataset.communityTab;render();return;}
 if(target.dataset.eventOpt!==undefined){eventSelectedState[target.dataset.eventOpt]=Number(target.dataset.optIndex)||0;render();return;}
 if(target.dataset.eventExpand!==undefined){eventExpandedState[target.dataset.eventExpand]=!eventExpandedState[target.dataset.eventExpand];render();return;}
 if(target.dataset.hospitalSlide!==undefined){const id=target.dataset.hospitalSlide,n=ORIGINAL_HOSPITAL_DETAILS[id]?.gallery?.length||1;hospitalSlideState[id]=((hospitalSlideState[id]||0)+Number(target.dataset.dir||'1')+n)%n;render();return;}
 if(target.dataset.hero!==undefined){const n=target.dataset.hero;heroIndex=n==='next'?(heroIndex+1)%banners.length:n==='prev'?(heroIndex+banners.length-1)%banners.length:Number(n);render();return;}
 if(target.dataset.collection!==undefined){collectionTabs[target.dataset.collection]=target.dataset.tab;render();return;}
 if(target.dataset.listcat!==undefined){const c=target.dataset.listcat;const params=new URLSearchParams(location.search);if(c==='전체')params.delete('category');else params.set('category',c);history.pushState({},'', '/events'+(params.size?'?'+params:''));pageCount=12;render();return;}
 if(target.dataset.region){activeRegion=target.dataset.region;activeArea='전체';render();return;}
 if(target.dataset.area){activeArea=target.dataset.area;render();return;}
 if(target.dataset.action){const a=target.dataset.action;
 if(a==='event-options'){document.getElementById('source-event-option-list')?.scrollIntoView({behavior:'smooth',block:'start'});return;}
 if(a==='modalclose'){showModal='';render();return;}
 if(a==='regionreset'){activeRegion='서울';activeArea='전체';render();return;}
 if(a==='more'){pageCount+=12;render();return;}
 if(a==='community-filter'){document.querySelectorAll('.pills .pill').forEach(x=>x.classList.remove('selected'));target.classList.add('selected');return;}
 if(a==='post'){showModal='post';modalDetails=target.dataset.post;render();return;}
 showModal=a;render();
 }
});
document.addEventListener('submit',e=>{if(e.target.id==='search-form'){e.preventDefault();const term=e.target.querySelector('input').value.trim();navigate('/search?q='+encode(term));}});
document.addEventListener('change',e=>{if(e.target.id==='pop-option-select'){const prices=[[429000,49],[330000,49],[330000,49],[720000,49],[330000,49],[330000,49],[330000,49],[429000,48],[1430000,49]];const [p,d]=prices[Number(e.target.value)||0];document.querySelector('#pop-price').innerHTML='<span>'+d+'% </span>'+fmt(p)+'원';return;}});
document.addEventListener('change',e=>{if(e.target.id==='sort-select'){sortValue=e.target.value;const params=new URLSearchParams(location.search);params.set('s',sortValue);history.replaceState({},'',location.pathname+'?'+params.toString());render();}});
window.addEventListener('popstate',render);render();