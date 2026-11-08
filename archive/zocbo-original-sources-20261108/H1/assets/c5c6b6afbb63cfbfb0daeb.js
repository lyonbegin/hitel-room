var config = {
	// WWW_ETOOS_URL:"https://m.etoos.com:44300/",
	SIGN_ZOCBO_URL:"https://sign.zocbo.com",
	WWW_ETOOS_URL:"https://m.etoos.com/",
	// ETS_ZB_URL:"http://nm.zocbo.com",
	ETS_ZB_URL:"https://m.zocbo.com",
	// ETS_SSL_URL:"https://stageㆍweb.etoos.com",
	ETS_SSL_URL:"https://www.etoos.com",
	// SSL_ZOCBO_URL:"https://nm.zocbo.com",
	SSL_ZOCBO_URL:"https://m.zocbo.com",
	IMAGE_URL_DEF:"https://www.zocbo.com",
	IMAGE_URL_ERR:"https://www.zocbo.com/",	// 오답노트 이미지 주소
	IMAGE_URL_GO:"https://www.zocbo.com/",	// 고득점 이미지 주소
	IMAGE_URL_SOO:"https://www.zocbo.com/",
	IMAGE_URL_BAROTEST: "https://www.zocbo.com/File/BaroTest/", // 바로테스트 이미지 주소
    TMS_IMAGE_URL_BAROTEST: "https://m.zocbo.com/tms-api/GetS3File.asp?", // TMS 바로테스트 이미지 주소
	INAPP_CHECK:false,
	TMS_IMAGE_URL: "https://m.zocbo.com/tms-api/GetS3File.asp?", // TMS 이미지 헤더
};

var _hLog = function(str) {
	// console.log(str);
};

var _hLog1 = function(str) {
	//console.log(str);
};

// 학기 이름 가져오기
var _getTermName = function(term_p, endMid_p) {
	var sch_v = term_p + endMid_p;
	var rtn = null;

	for(var i = 0; i < _term.length; i++) {
		var item = _term[i];
		if(item.Value == sch_v) {
			rtn = item.title;
			break;
		}
	}
	return rtn;
};

// return URL
var _rtnUrl = location.pathname + location.search;

var _getGradeName = function() {

};

// 상품별 가격
var _downPrice = {	"pdf":"2000", 
					"hwp":"2600", 
					"scan":"2000",
					"zip":"0", 
					"vod":"3000",
					"baro":"3700",
					"S":{
						"pdf":"3100",		// 올림포스
						"hwp":"4000",		// 유형별 기출공략, 올림포스
						"pdf4": "5500",		// 올림포스
						"hwp4": "7300"		// 올림포스
						}, // 수프링 단가 하드코딩값					
					"VOD":{
						"basic":"0",
						"concept":"0",
						"concept_m":"3000",
						"concept_h":"3600",
						"prob":"0",
						"prob_m":"3000",
						"prob_h":"3600",
						"midEng":"3000",
						"korGram":"0"
					},
					"BaroTest":{
						"BaroTest":"3700",
						"BaroTest_m":"3700",
						"BaroTest_h":"4200",
					}
};

// 국어 카테고리 (국어 작품별 족보)
var _KR_GENRE = [ {"Name":"시", "Value":"P1"},
				{"Name":"소설", "Value":"P2"},
				{"Name":"수필", "Value":"P3"},
				{"Name":"극 문학", "Value":"P4"},
				{"Name":"기타", "Value":"P5"}
];

// 국어 문법 카테고리
var _KR_EXAM = [ {"Name":"실전 문제", "Value":"O4"},{"Name":"문법 연습", "Value":"O7"},
];

// 중등 수학 계산력 카테고리
var _KR_MT_O7 = [ {"Name":"수와 연산", "Value":"B1"},
				{"Name":"문자와 식", "Value":"B2"},
				{"Name":"함수", "Value":"B3"},
				{"Name":"기하", "Value":"B5"},
				{"Name":"확률과 통계", "Value":"B4"}
];

// 중등 교과서 변형
var M_MT_Math = [
	{ Name: "1학년", Value: "1", Grade_Value: "1", bookinfo: [
		{ Name: "천재(김화)",   Value: "MAMTCHA1001", textbook: "908" },
		{ Name: "비상(이)",   Value: "MAMTCHA1001", textbook: "903" },
		{ Name: "동아(강)",   Value: "MAMTCHA1001", textbook: "843" },
		{ Name: "천재(김동)",   Value: "MAMTCHA1001", textbook: "907" },
		{ Name: "지학사(장)", Value: "MAMTCHA1001", textbook: "848" },
		{ Name: "YBM(류)",   Value: "MAMTCHA1001", textbook: "906" },
		{ Name: "미래엔(황)", Value: "MAMTCHA1001", textbook: "845" },
		{ Name: "능률(권)", Value: "MAMTCHA1001", textbook: "905" },
		{ Name: "교학사(김)", Value: "MAMTCHA1001", textbook: "904" }
	]},
	{ Name: "2학년", Value: "2", Grade_Value: "2", bookinfo: [
		{ Name: "천재(김화)",   Value: "MAMTCHA2001", textbook: "1122" },
		{ Name: "비상(이)",   Value: "MAMTCHA2001", textbook: "1117" },
		{ Name: "동아(강)",   Value: "MAMTCHA2001", textbook: "1125" },
		{ Name: "천재(김동)",   Value: "MAMTCHA2001", textbook: "1121" },
		{ Name: "지학사(장)", Value: "MAMTCHA2001", textbook: "1130" },
		{ Name: "YBM(류)",   Value: "MAMTCHA2001", textbook: "1120" },
		{ Name: "미래엔(황)", Value: "MAMTCHA2001", textbook: "1127" },
		{ Name: "능률(권)", Value: "MAMTCHA2001", textbook: "1119" },
		{ Name: "교학사(김)", Value: "MAMTCHA2001", textbook: "1118" }
	]},
	{ Name: "3학년", Value: "3", Grade_Value: "3", bookinfo: [
		{ Name: "천재(류)",  Value: "M6MTCHA3001", textbook: "5408" },
		{ Name: "천재(이)",  Value: "M6MTCHA3001", textbook: "5409" },
		{ Name: "동아(강)",  Value: "M6MTCHA3001", textbook: "5410" },
		{ Name: "동아(박)",  Value: "M6MTCHA3001", textbook: "5411" },
		{ Name: "미래엔(황)", Value: "M6MTCHA3001", textbook: "5412" },
		{ Name: "비상(김)",  Value: "M6MTCHA3001", textbook: "5413" },
		{ Name: "신사고(김)", Value: "M6MTCHA3001", textbook: "5414" },
		{ Name: "지학사(장)", Value: "M6MTCHA3001", textbook: "5415" },
		{ Name: "교학사(고)", Value: "M6MTCHA3001", textbook: "5416" },
		{ Name: "금성(주)",  Value: "M6MTCHA3001", textbook: "5417" }
	]}
];

var M_MT_Math_OLD = [
	{ Name: "1학년", Value: "1", Grade_Value: "1", bookinfo: [
		{ Name: "천재(김화)",   Value: "MAMTCHA1001", textbook: "908" },
		{ Name: "비상(이)",   Value: "MAMTCHA1001", textbook: "903" },
		{ Name: "동아(강)",   Value: "MAMTCHA1001", textbook: "843" },
		{ Name: "천재(김동)",   Value: "MAMTCHA1001", textbook: "907" },
		{ Name: "지학사(장)", Value: "MAMTCHA1001", textbook: "848" },
		{ Name: "YBM(류)",   Value: "MAMTCHA1001", textbook: "906" },
		{ Name: "미래엔(황)", Value: "MAMTCHA1001", textbook: "845" },
		{ Name: "능률(권)", Value: "MAMTCHA1001", textbook: "905" },
		{ Name: "교학사(김)", Value: "MAMTCHA1001", textbook: "904" }
	]},
	{ Name: "2학년", Value: "2", Grade_Value: "2", bookinfo: [
		{ Name: "천재(류)",  Value: "M6MTCHA2001", textbook: "5398" },
		{ Name: "천재(이)",  Value: "M6MTCHA2001", textbook: "5399" },
		{ Name: "동아(강)",  Value: "M6MTCHA2001", textbook: "5400" },
		{ Name: "동아(박)",  Value: "M6MTCHA2001", textbook: "5401" },
		{ Name: "미래엔(황)", Value: "M6MTCHA2001", textbook: "5402" },
		{ Name: "비상(김)",  Value: "M6MTCHA2001", textbook: "5403" },
		{ Name: "신사고(김)", Value: "M6MTCHA2001", textbook: "5404" },
		{ Name: "지학사(장)", Value: "M6MTCHA2001", textbook: "5405" },
		{ Name: "교학사(고)", Value: "M6MTCHA2001", textbook: "5406" },
		{ Name: "금성(주)",  Value: "M6MTCHA2001", textbook: "5407" }
	]},
	{ Name: "3학년", Value: "3", Grade_Value: "3", bookinfo: [
		{ Name: "천재(류)",  Value: "M6MTCHA3001", textbook: "5408" },
		{ Name: "천재(이)",  Value: "M6MTCHA3001", textbook: "5409" },
		{ Name: "동아(강)",  Value: "M6MTCHA3001", textbook: "5410" },
		{ Name: "동아(박)",  Value: "M6MTCHA3001", textbook: "5411" },
		{ Name: "미래엔(황)", Value: "M6MTCHA3001", textbook: "5412" },
		{ Name: "비상(김)",  Value: "M6MTCHA3001", textbook: "5413" },
		{ Name: "신사고(김)", Value: "M6MTCHA3001", textbook: "5414" },
		{ Name: "지학사(장)", Value: "M6MTCHA3001", textbook: "5415" },
		{ Name: "교학사(고)", Value: "M6MTCHA3001", textbook: "5416" },
		{ Name: "금성(주)",  Value: "M6MTCHA3001", textbook: "5417" }
	]}
];

// 고등 교과서 변형
var H_MT_Math = [
	{ Name: "공통수학1", Value: "0", Grade_Value: "1", bookinfo: [
		{ Name: "천재(홍)",   Value: "H9MTCHA1001", textbook: "902" },
		{ Name: "비상(김)",   Value: "H9MTCHA1001", textbook: "836" },
		{ Name: "미래엔(황)",   Value: "H9MTCHA1001", textbook: "835" },
		{ Name: "천재(전)",   Value: "H9MTCHA1001", textbook: "901" },
		{ Name: "지학사(장)", Value: "H9MTCHA1001", textbook: "899" },
		{ Name: "YBM(류)", Value: "H9MTCHA1001", textbook: "900" },
		{ Name: "동아(고)", Value: "H9MTCHA1001", textbook: "898" }
	]},
	{ Name: "수학Ⅰ", Value: "1", Grade_Value: "2", bookinfo: [
		{ Name: "천재(류)",  Value: "H9MTCHA2003", textbook: "5370" },
		{ Name: "천재(이)",  Value: "H9MTCHA2003", textbook: "5371" },
		{ Name: "동아(박)",  Value: "H9MTCHA2003", textbook: "5372" },
		{ Name: "비상(김)",  Value: "H9MTCHA2003", textbook: "5373" },
		{ Name: "미래엔(황)", Value: "H9MTCHA2003", textbook: "5374" },
		{ Name: "신사고(고)", Value: "H9MTCHA2003", textbook: "5375" },
		{ Name: "지학사(홍)", Value: "H9MTCHA2003", textbook: "5376" },
		{ Name: "교학사(권)", Value: "H9MTCHA2003", textbook: "5377" },
		{ Name: "금성(배)",  Value: "H9MTCHA2003", textbook: "5378" }
	]},
	{ Name: "수학Ⅱ", Value: "2", Grade_Value: "2", bookinfo: [
		{ Name: "천재(류)",  Value: "H9MTCHA2004", textbook: "5379" },
		{ Name: "천재(이)",  Value: "H9MTCHA2004", textbook: "5380" },
		{ Name: "동아(박)",  Value: "H9MTCHA2004", textbook: "5381" },
		{ Name: "비상(김)",  Value: "H9MTCHA2004", textbook: "5382" },
		{ Name: "미래엔(황)", Value: "H9MTCHA2004", textbook: "5383" },
		{ Name: "신사고(고)", Value: "H9MTCHA2004", textbook: "5384" },
		{ Name: "지학사(홍)", Value: "H9MTCHA2004", textbook: "5385" },
		{ Name: "교학사(권)", Value: "H9MTCHA2004", textbook: "5386" },
		{ Name: "금성(배)",  Value: "H9MTCHA2004", textbook: "5387" }
	]},
	{ Name: "확률과 통계", Value: "3", Grade_Value: "2", bookinfo: [
		{ Name: "천재(류)",  Value: "H9MTCHA2005", textbook: "5361" },
		{ Name: "천재(이)",  Value: "H9MTCHA2005", textbook: "5362" },
		{ Name: "동아(박)",  Value: "H9MTCHA2005", textbook: "5363" },
		{ Name: "비상(김)",  Value: "H9MTCHA2005", textbook: "5364" },
		{ Name: "미래엔(황)", Value: "H9MTCHA2005", textbook: "5365" },
		{ Name: "신사고(고)", Value: "H9MTCHA2005", textbook: "5366" },
		{ Name: "지학사(홍)", Value: "H9MTCHA2005", textbook: "5367" },
		{ Name: "교학사(권)", Value: "H9MTCHA2005", textbook: "5368" },
		{ Name: "금성(배)",  Value: "H9MTCHA2005", textbook: "5369" }
	]},
	{ Name: "미적분", Value: "4", Grade_Value: "2", bookinfo: [
		{ Name: "천재(류)",  Value: "H9MTCHA2001", textbook: "5353" },
		{ Name: "천재(이)",  Value: "H9MTCHA2001", textbook: "5354" },
		{ Name: "동아(박)",  Value: "H9MTCHA2001", textbook: "5355" },
		{ Name: "비상(김)",  Value: "H9MTCHA2001", textbook: "5357" },
		{ Name: "미래엔(황)", Value: "H9MTCHA2001", textbook: "5356" },
		{ Name: "신사고(고)", Value: "H9MTCHA2001", textbook: "5358" },
		{ Name: "지학사(홍)", Value: "H9MTCHA2001", textbook: "5359" },
		{ Name: "교학사(권)", Value: "H9MTCHA2001", textbook: "5360" }
	]},
	{ Name: "기하", Value: "5", Grade_Value: "2", bookinfo: [
		{ Name: "천재(류)",  Value: "H9MTCHA2002", textbook: "5346" },
		{ Name: "천재(이)",  Value: "H9MTCHA2002", textbook: "5347" },
		{ Name: "비상(김)",  Value: "H9MTCHA2002", textbook: "5349" },
		{ Name: "미래엔(황)", Value: "H9MTCHA2002", textbook: "5348" },
		{ Name: "신사고(고)", Value: "H9MTCHA2002", textbook: "5350" },
		{ Name: "지학사(홍)", Value: "H9MTCHA2002", textbook: "5351" },
		{ Name: "교학사(권)", Value: "H9MTCHA2002", textbook: "5352" }
	]}
];

var H_MT_Math_1_C = [
	{ Name: "공통수학1", Value: "0", Grade_Value: "1", bookinfo: [
		{ Name: "천재(홍)",   Value: "H9MTCHA1001", textbook: "902" },
		{ Name: "비상(김)",   Value: "H9MTCHA1001", textbook: "836" },
		{ Name: "미래엔(황)",   Value: "H9MTCHA1001", textbook: "835" },
		{ Name: "천재(전)",   Value: "H9MTCHA1001", textbook: "901" },
		{ Name: "지학사(장)", Value: "H9MTCHA1001", textbook: "899" },
		{ Name: "YBM(류)", Value: "H9MTCHA1001", textbook: "900" },
		{ Name: "동아(고)", Value: "H9MTCHA1001", textbook: "898" }
	]}
];

var H_MT_Math_2_C = [
	{ Name: "대수", Value: "1", Grade_Value: "2", bookinfo: [
		{ Name: "비상(김)",  Value: "HAMTCHA2001", textbook: "1001" },
		{ Name: "미래엔(황)",  Value: "HAMTCHA2001", textbook: "1000" },
		{ Name: "천재(전)",  Value: "HAMTCHA2001", textbook: "1009" },
		{ Name: "지학사(장)",  Value: "HAMTCHA2001", textbook: "1007" },
		{ Name: "YBM(류)", Value: "HAMTCHA2001", textbook: "1008" },
		{ Name: "동아(고)", Value: "HAMTCHA2001", textbook: "1006" }
	]},
	{ Name: "확률과 통계", Value: "2", Grade_Value: "2", bookinfo: [
		{ Name: "비상(김)",  Value: "HAMTCHA2002", textbook: "1029" },
		{ Name: "미래엔(황)",  Value: "HAMTCHA2002", textbook: "1028" },
		{ Name: "천재(전)",  Value: "HAMTCHA2002", textbook: "1037" },
		{ Name: "지학사(장)",  Value: "HAMTCHA2002", textbook: "1035" },
		{ Name: "YBM(류)", Value: "HAMTCHA2002", textbook: "1036" },
		{ Name: "동아(고)", Value: "HAMTCHA2002", textbook: "1034" }
	]},
	{ Name: "기하", Value: "3", Grade_Value: "2", bookinfo: [
		{ Name: "비상(김)",  Value: "HAMTCHA2005", textbook: "1057" },
		{ Name: "미래엔(황)",  Value: "HAMTCHA2005", textbook: "1056" },
		{ Name: "천재(전)",  Value: "HAMTCHA2005", textbook: "1065" },
		{ Name: "지학사(장)",  Value: "HAMTCHA2005", textbook: "1063" },
		{ Name: "YBM(류)", Value: "HAMTCHA2005", textbook: "1064" },
		{ Name: "동아(고)", Value: "HAMTCHA2005", textbook: "1062" }
	]}
];

var H_MT_Math_2_C_OLD = [
	{ Name: "수학Ⅰ", Value: "1", Grade_Value: "2", bookinfo: [
		{ Name: "천재(류)",  Value: "H9MTCHA2003", textbook: "5370" },
		{ Name: "천재(이)",  Value: "H9MTCHA2003", textbook: "5371" },
		{ Name: "동아(박)",  Value: "H9MTCHA2003", textbook: "5372" },
		{ Name: "비상(김)",  Value: "H9MTCHA2003", textbook: "5373" },
		{ Name: "미래엔(황)", Value: "H9MTCHA2003", textbook: "5374" },
		{ Name: "신사고(고)", Value: "H9MTCHA2003", textbook: "5375" },
		{ Name: "지학사(홍)", Value: "H9MTCHA2003", textbook: "5376" },
		{ Name: "교학사(권)", Value: "H9MTCHA2003", textbook: "5377" },
		{ Name: "금성(배)",  Value: "H9MTCHA2003", textbook: "5378" }
	]},
	{ Name: "수학Ⅱ", Value: "2", Grade_Value: "2", bookinfo: [
		{ Name: "천재(류)",  Value: "H9MTCHA2004", textbook: "5379" },
		{ Name: "천재(이)",  Value: "H9MTCHA2004", textbook: "5380" },
		{ Name: "동아(박)",  Value: "H9MTCHA2004", textbook: "5381" },
		{ Name: "비상(김)",  Value: "H9MTCHA2004", textbook: "5382" },
		{ Name: "미래엔(황)", Value: "H9MTCHA2004", textbook: "5383" },
		{ Name: "신사고(고)", Value: "H9MTCHA2004", textbook: "5384" },
		{ Name: "지학사(홍)", Value: "H9MTCHA2004", textbook: "5385" },
		{ Name: "교학사(권)", Value: "H9MTCHA2004", textbook: "5386" },
		{ Name: "금성(배)",  Value: "H9MTCHA2004", textbook: "5387" }
	]},
	{ Name: "확률과 통계", Value: "3", Grade_Value: "2", bookinfo: [
		{ Name: "천재(류)",  Value: "H9MTCHA2005", textbook: "5361" },
		{ Name: "천재(이)",  Value: "H9MTCHA2005", textbook: "5362" },
		{ Name: "동아(박)",  Value: "H9MTCHA2005", textbook: "5363" },
		{ Name: "비상(김)",  Value: "H9MTCHA2005", textbook: "5364" },
		{ Name: "미래엔(황)", Value: "H9MTCHA2005", textbook: "5365" },
		{ Name: "신사고(고)", Value: "H9MTCHA2005", textbook: "5366" },
		{ Name: "지학사(홍)", Value: "H9MTCHA2005", textbook: "5367" },
		{ Name: "교학사(권)", Value: "H9MTCHA2005", textbook: "5368" },
		{ Name: "금성(배)",  Value: "H9MTCHA2005", textbook: "5369" }
	]},
	{ Name: "미적분", Value: "4", Grade_Value: "2", bookinfo: [
		{ Name: "천재(류)",  Value: "H9MTCHA2001", textbook: "5353" },
		{ Name: "천재(이)",  Value: "H9MTCHA2001", textbook: "5354" },
		{ Name: "동아(박)",  Value: "H9MTCHA2001", textbook: "5355" },
		{ Name: "비상(김)",  Value: "H9MTCHA2001", textbook: "5357" },
		{ Name: "미래엔(황)", Value: "H9MTCHA2001", textbook: "5356" },
		{ Name: "신사고(고)", Value: "H9MTCHA2001", textbook: "5358" },
		{ Name: "지학사(홍)", Value: "H9MTCHA2001", textbook: "5359" },
		{ Name: "교학사(권)", Value: "H9MTCHA2001", textbook: "5360" }
	]},
	{ Name: "기하", Value: "5", Grade_Value: "2", bookinfo: [
		{ Name: "천재(류)",  Value: "H9MTCHA2002", textbook: "5346" },
		{ Name: "천재(이)",  Value: "H9MTCHA2002", textbook: "5347" },
		{ Name: "비상(김)",  Value: "H9MTCHA2002", textbook: "5349" },
		{ Name: "미래엔(황)", Value: "H9MTCHA2002", textbook: "5348" },
		{ Name: "신사고(고)", Value: "H9MTCHA2002", textbook: "5350" },
		{ Name: "지학사(홍)", Value: "H9MTCHA2002", textbook: "5351" },
		{ Name: "교학사(권)", Value: "H9MTCHA2002", textbook: "5352" }
	]}
];

var H_MT_Math_1_B = [
	{ Name: "공통수학1", Value: "0", Grade_Value: "1"}
];

var H_MT_Math_2_B = [
	{ Name: "대수", Value: "1", Grade_Value: "2"},
	{ Name: "확률과 통계", Value: "2", Grade_Value: "2"},
	{ Name: "기하", Value: "3", Grade_Value: "2"},
	{ Name: "미적분Ⅰ", Value: "4", Grade_Value: "2"},
	{ Name: "미적분Ⅱ", Value: "5", Grade_Value: "2"}
];

var H_MT_Math_2_B_OLD = [
	{ Name: "수학Ⅰ", Value: "1", Grade_Value: "2"},
	{ Name: "수학Ⅱ", Value: "2", Grade_Value: "2"},
	{ Name: "확률과 통계", Value: "3", Grade_Value: "2"},
	{ Name: "미적분", Value: "4", Grade_Value: "2"},
	{ Name: "기하", Value: "5", Grade_Value: "2"}
];

// 고등 수학 계산력 카테고리
var _H2_MT_O7_1 = [ {"Name":"공통수학1", "Value":"B1", "tabIdx" : 1},
				{"Name":"공통수학2", "Value":"B2", "tabIdx": 2}
];

var _H2_MT_O7 = [ {"Name":"대수", "Value":"B3", "tabIdx": 3},
				{"Name":"확률과 통계", "Value":"B4", "tabIdx": 4},
				{"Name":"기하", "Value":"B5", "tabIdx": 5},
				{"Name":"미적분Ⅰ", "Value":"B6", "tabIdx": 6},
				{"Name":"미적분Ⅱ", "Value":"B7", "tabIdx": 7}
];

// 고등 영문법 카테고리
var _KR_EG_C1 = [ {"Name":"동사", "Value":"C1"},
				{"Name":"준동사", "Value":"C2"},
				{"Name":"수일치", "Value":"C3"},
				{"Name":"접속사", "Value":"C4"},
				{"Name":"관계사", "Value":"C5"},
				{"Name":"구문", "Value":"C6"},
				{"Name":"품사", "Value":"C7"}
];

// 고등 국어 시대별문학 카테고리
var _H_KR_SI = [ {"Name":"고대", "Value":"Q1"},
                {"Name":"삼국시대", "Value":"Q2"},
                {"Name":"고려시대", "Value":"Q3"},
                {"Name":"조선시대", "Value":"Q4"},
                {"Name":"일제 강점기", "Value":"Q5"},
                {"Name":"광복 이후", "Value":"Q6"}
];

// 고등 국어 시대별문학 카테고리
var _H_KR_SI_KIND = [ {"Name":"작품별 보기", "Value":"W"},
                {"Name":"작가별 보기", "Value":"A"}
];

// 중등 프로전용관 갈래별 카테고리
var _M_PRO_GAL = [ {"Name":"시", "Value":"M9KRCHA0004"},
                {"Name":"소설", "Value":"M9KRCHA0005"},
                {"Name":"수필", "Value":"M9KRCHA0006"},
                {"Name":"극문학", "Value":"M9KRCHA0007"}
];

// 학기 정보
var _term = [
				{"title":"전체 학기", "Value":""},
		{"title":"1학기 중간", "Value":"1M"},
		{"title":"1학기 기말", "Value":"1E"},
		{"title":"2학기 중간", "Value":"2M"},
		{"title":"2학기 기말", "Value":"2E"}
];

var _term_FreeReading = [
		{"title":"1학기 중간", "Value":"1M"},
		{"title":"1학기 기말", "Value":"1E"},
		{"title":"2학기 중간", "Value":"2M"},
		{"title":"2학기 기말", "Value":"2E"}
];

// 공통 지역 정보
var _SI_LIST = [
				{"Name":"지역", "Value":""},
				{"Name":"서울"},
				{"Name":"세종"},
				{"Name":"대구"},
				{"Name":"대전"},
				{"Name":"부산"},
				{"Name":"인천"},
				{"Name":"울산"},
				{"Name":"경기"},
				{"Name":"강원"},
				{"Name":"충남"},
				{"Name":"충북"},
				{"Name":"경남"},
				{"Name":"경북"},
				{"Name":"전남광주"},
				{"Name":"전북"},
				{"Name":"제주"},
				{"Name":"기타"}
];

var _SI_LIST_FREE_READING = [
				{"Name":"지역 선택", "Value":""},
				{"Name":"서울"},
				{"Name":"세종"},
				{"Name":"대구"},
				{"Name":"대전"},
				{"Name":"부산"},
				{"Name":"인천"},
				{"Name":"울산"},
				{"Name":"경기"},
				{"Name":"강원"},
				{"Name":"충남"},
				{"Name":"충북"},
				{"Name":"경남"},
				{"Name":"경북"},
				{"Name":"전남광주"},
				{"Name":"전북"},
				{"Name":"제주"},
				{"Name":"기타"}
];

// 수프링 과목 카테고리
var _category = {
	"M1":[
		{"title":"국어", "value":"korean"},
		{"title":"영어", "value":"english"},
		{"title":"수학", "value":"math"},
		{"title":"과학", "value":"science"},
		{"title":"사회", "value":"social"},
		{"title":"역사", "value":"history"},
		{"title":"도덕,기술,가정", "value":"ethics"}
	],
	"M2":[
		{"title":"국어", "value":"korean"},
		{"title":"영어", "value":"english"},
		{"title":"수학", "value":"math"},
		{"title":"과학", "value":"science"},
		{"title":"사회", "value":"social"},
		{"title":"역사", "value":"history"},
		{"title":"도덕,기술,가정", "value":"ethics"}
	],
	"M3":[
		{"title":"국어", "value":"korean"},
		{"title":"영어", "value":"english"},
		{"title":"수학", "value":"math"},
		{"title":"과학", "value":"science"},
		{"title":"사회", "value":"social"},
		{"title":"역사", "value":"history"},
		{"title":"도덕,기술,가정", "value":"ethics"}
	],
	"H1":[
		{"title":"국어", "value":"korean"},
		{"title":"영어", "value":"english"},
		{"title":"수학", "value":"math"},
		{"title":"통합과학", "value":"science"},
		{"title":"통합사회", "value":"social"},
		{"title":"학국사", "value":"history"}
	],
	"H2":[
		{"title":"국어", "value":"korean"},
		{"title":"영어", "value":"english"},
		{"title":"수학", "value":"math"},
		{"title":"과학", "value":"science"},
		{"title":"사회", "value":"social"},
		{"title":"학국사", "value":"history"}
	],
	"H3":[
		{"title":"수학", "value":"math"},
		{"title":"과학", "value":"science"},
		{"title":"사회", "value":"social"},
		{"title":"학국사", "value":"history"}
	],
};

var _categorySub = {
	"M0":{"title":"전학년"},
	"M1":{"title":"중1",
			items:{
				"korean":[
					{"title":"단원별 문제", 	"value":"Group=C&Grade=1&Subj_Code=KR"},
					{"title":"서술형 문제", 	"value":"Group=M&Grade=1&Subj_Code=KR"},
					{"title":"최다빈출 문제", 	"value":"Group=H&ExPapr_CoreType=D&grade=1&subj_code=KR&tx_code=M9KRCHA1001%7CM9KRCHA1002%7CM9KRCHA1003%7CM9KRCHA1004"},
					{"title":"최다오답 문제", 	"value":"Group=H&ExPapr_CoreType=E&grade=1&subj_code=EG&subj_name=%BF%B5%BE%EE&tx_code=M9EGCHA1001%7CM9EGCHA1002%7CM9EGCHA1003%7CM9EGCHA1004"},
					{"title":"고난도 문제", 	"value":"Group=S&Grade=1&Subj_Code=KR"},
					{"title":"국어작품별 문제", "value":""},
					{"title":"국어문법 문제", 	"value":""}
					],
				"english":[
					{"title":"단원별 문제", 	"value":""},
					{"title":"서술형 문제", 	"value":""},
					{"title":"최다빈출 문제", 	"value":""},
					{"title":"최다오답 문제", 	"value":""},
					{"title":"영어문법 문제", 	"value":""},
					{"title":"중등 영문법", 	"value":""}
					],
				"math":[
					{"title":"단원별 문제", 		"value":""},
					{"title":"서술형 문제", 		"value":""},
					{"title":"최다빈출 문제", 		"value":""},
					{"title":"최다오답 문제", 		"value":""},
					{"title":"고난도 문제", 		"value":""},
					{"title":"수학 유형별 문제", 	"value":""},
					{"title":"수학 계산력 문제", 	"value":""}
					]
				},

		},
	"M2":{"title":"중2"},
	"M3":{"title":"중3"},
	"H0":{"title":"전학년"},
	"H1":{"title":"고1"},
	"H2":{"title":"고2"},
	"H3":{"title":"고3"}
};

// 1:1 문의 카테고리
var _1to1CatItems1 = [
	{"pos": 0, "title": "초등족보"},
	{"pos": 1, "title": "중등족보"},
	{"pos": 2, "title": "고등족보"},
	{"pos": 3, "title": "기타"}
];

// 1:1 문의 카테고리
var _1to1CatItems2 = [
	{"pos": 0, "title": "사이트이용"},
	{"pos": 1, "title": "컨텐츠"},
	{"pos": 2, "title": "오답/불량"},
	{"pos": 3, "title": "상품결제"},
	{"pos": 4, "title": "환불/변경"},
	{"pos": 5, "title": "회원관련"},
	{"pos": 6, "title": "원격지원"},
	{"pos": 7, "title": "기타문의"}
];

// SKY멘토 설명 정보_2025-06-01에 변경되는 정보(EDUMIG-7427)
var _mentoList = [
	{"pos": 0, "university": "서울대", "name": "김예희", "img": "../img/thumb/@img_teacher4.png",
		"awards" : [
		],
		"social" : [
			"ㆍ찾아가는 교육활동 16기 교육봉사 활동(2023 1학기)",
			"ㆍSAM멘토링(2023 2학기)"
		]
	},
	{"pos": 1, "university": "고려대", "name": "양현빈", "img": "../img/thumb/@img_teacher2.jpg",
		"awards" : [
			"ㆍ고등학교 1학년 모의유엔대회 최우수상",
			"ㆍ고등학교 1학년 영어글쓰기 대회 우수상",
			"ㆍ고등학교 1학년 영어연극경연대회 최우수상",
			"ㆍ고등학교 1학년 교과우수상(수학, 통합과학, 심화영어1, 전공 기초 스페인어)",
			"ㆍ고등학교 2학년 모의유엔대회 우수상",
			"ㆍ고등학교 2학년 영어연극경연대회 최우수상",
			"ㆍ고등학교 2학년 영어에세이대회 우수상",
			"ㆍ고등학교 2학년 교과우수상(수학1, 수학2, 사회문화, 통합과학, 심화영어작문2, 스페인어권 문화)",
			"ㆍ고등학교 3학년 교과우수상(한국사, 화법과 작문, 확률과 통계, 스페인어 독해와 작문1)",
			"ㆍ고등학교 3학년 글로벌인재 종합활동발표 대회 대상"
		],
		"social" : [
			"ㆍ고등학교 1학년 1학기, 2학년 1학기 학급회장",
			"ㆍ고등학교 1학년 언어학 소모임 결성 및 활동",
			"ㆍ고등학교 1학년, 2학년 교내 심리상담 동아리 활동",
			"ㆍ고등학교 2학년 사회과학연구반 진로학술동아리 활동",
			"ㆍ고등학교 2학년 교육 소모임 결성 및 활동",
			"ㆍ성북구 다문화가정 서포터즈 (멘토링) 활동",
			"ㆍ고려대학교 교육학과 교육학회 <제3교육> 활동, 홍보임원으로 참여",
			"ㆍ고려대학교 교육학과 제57대 학생회 <다원> 활동",
			"ㆍ고려대학교 교육학과 제57대 학생회 <온유> 활동",
			"ㆍ고려대학교 교육학과 신입생맞이준비위원회 활동"
		]
	},
	{"pos": 2, "university": "연세대", "name": "김지연", "img": "/cloudfront/images/mo/thumb/@img_teacher4.png",
		"awards" : [
			"ㆍ전국 일본어 스피치 대회 금상(2위)",
			"ㆍ고등학교 1,2,3학년 교과성적 우수상 다수",
			"ㆍ교내 영어 스토리텔링 대회 동상(3위)",
			"ㆍ교내 영어 패널 토론대회 은상(2위)",
			"ㆍ교내 영어 정보전달말하기 대회 우수상",
			"ㆍ자기 성장 포트폴리오 대회 우수상",
			"ㆍ일본어 에세이 대회 은상(2위)",
			"ㆍ일본 문화 심화 탐구 대회 대상(1위)",
			"ㆍ교내 영어 자기 표현 작문 대회 금상(2위)",
			"ㆍ이외 표창장, 봉사상 등"
		],
		"social" : [
			"ㆍ교내 교육 동아리 활동(1-3학년)",
			"ㆍ교내 일본 지역학 연구 동아리(2-3학년)",
			"ㆍ지역 아동 대상 영어/일본어 교육 봉사활동",
			"ㆍ영어/일본어 팟캐스트 제작 활동",
			"ㆍ지역 청소년 대상 국어/영어/수학 교육 봉사활동"
		]
	},
];
// SKY멘토 설명 정보_이전정보(EDUMIG-7427에 멘토 변경)
var _mentoList_before = [
	{"pos": 0, "university": "서울대", "name": "김예희", "img": "../img/thumb/@img_teacher4.png",
		"awards" : [
		],
		"social" : [
			"ㆍ찾아가는 교육활동 16기 교육봉사 활동(2023 1학기)",
			"ㆍSAM멘토링(2023 2학기)"
		]
	},
	{"pos": 1, "university": "고려대", "name": "양현빈", "img": "../img/thumb/@img_teacher2.jpg",
		"awards" : [
			"ㆍ고등학교 1학년 모의유엔대회 최우수상",
			"ㆍ고등학교 1학년 영어글쓰기 대회 우수상",
			"ㆍ고등학교 1학년 영어연극경연대회 최우수상",
			"ㆍ고등학교 1학년 교과우수상(수학, 통합과학, 심화영어1, 전공 기초 스페인어)",
			"ㆍ고등학교 2학년 모의유엔대회 우수상",
			"ㆍ고등학교 2학년 영어연극경연대회 최우수상",
			"ㆍ고등학교 2학년 영어에세이대회 우수상",
			"ㆍ고등학교 2학년 교과우수상(수학1, 수학2, 사회문화, 통합과학, 심화영어작문2, 스페인어권 문화)",
			"ㆍ고등학교 3학년 교과우수상(한국사, 화법과 작문, 확률과 통계, 스페인어 독해와 작문1)",
			"ㆍ고등학교 3학년 글로벌인재 종합활동발표 대회 대상"
		],
		"social" : [
			"ㆍ고등학교 1학년 1학기, 2학년 1학기 학급회장",
			"ㆍ고등학교 1학년 언어학 소모임 결성 및 활동",
			"ㆍ고등학교 1학년, 2학년 교내 심리상담 동아리 활동",
			"ㆍ고등학교 2학년 사회과학연구반 진로학술동아리 활동",
			"ㆍ고등학교 2학년 교육 소모임 결성 및 활동",
			"ㆍ성북구 다문화가정 서포터즈 (멘토링) 활동",
			"ㆍ고려대학교 교육학과 교육학회 <제3교육> 활동, 홍보임원으로 참여",
			"ㆍ고려대학교 교육학과 제57대 학생회 <다원> 활동",
			"ㆍ고려대학교 교육학과 제57대 학생회 <온유> 활동",
			"ㆍ고려대학교 교육학과 신입생맞이준비위원회 활동"
		]
	},
	{"pos": 2, "university": "연세대", "name": "이현주", "img": "../img/thumb/@img_teacher3.png",
		"awards" : [
			"ㆍ고등학교 1,2,3학년 교과성적우수상 다수",
			"ㆍ교내 프로젝트 우수상",
			"ㆍ교내 소논문탐구프로젝트 은상 (2위)",
			"ㆍ교내 학습발표회 우수상",
			"ㆍ교내 글쓰기 대회 우수상",
			"ㆍ교내 문예체 발표회 우수상",
			"ㆍ이외 표창장, 정근상, 모범학생상, 봉사상 등"
		],
		"social" : [
			"ㆍ교내 상설 심리토론부 활동 (1학년)",
			"ㆍ교내 교육 자율동아리 개설 (1학년, 교과목 멘토링)",
			"ㆍ교내 상설 독서부 차장 (2학년)",
			"ㆍ교내 교육 자율동아리 개설 (2/3학년, 교육문제 토론 및 모의수업)",
			"ㆍ교내 자율 사회정책 동아리 활동 (2/3학년)",
			"ㆍ정기 교육봉사 초등학생 학습 지도 (2/3학년)",
			"ㆍ연세대학교 교육학과 새내기맞이단",
			"ㆍ연세대학교 교육학과 과내 인문학 학회 부학회장",
			"ㆍ연세대학교 중앙동아리 국제연세학생회 IYC 부회장"
		]
	},
];
// 수프링 기출유형공략 (tab:1)
/*
var _soopringBasic = {
	"subject":[{"Name":"국어영역", "Value":"KR",
					"Data":[{"Name":"문학", "Value":"H7KREXAA007"},
						{"Name":"독서", "Value":"H7KREXPA003"},
						{"Name":"문법", "Value":"H7KREXPA004"},
						{"Name":"화법", "Value":"H7KREXAA001"},
						{"Name":"작문", "Value":"H7KREXPA006"}
					]
				},
				{"Name":"수학영역", "Value":"MT",
					"Data":[{"Name":"가형", "Value":"MT_TYPE_A"},
						{"Name":"나형", "Value":"MT_TYPE_B"}
					],
					"MT_TYPE_A":[{"Name":"미적분Ⅱ", "Value":"H8MTCHA2006"},
						{"Name":"기하와 벡터", "Value":"H7MTCHA2004"},
						{"Name":"확률과 통계", "Value":"H8MTCHA0003"}
					],
					"MT_TYPE_B":[{"Name":"수학Ⅱ", "Value":"H8MTCHA1004"},
						{"Name":"미적분Ⅰ", "Value":"H8MTCHA2005"},
						{"Name":"확률과 통계", "Value":"H8MTCHA0004"}
					]
				},
				{"Name":"영어영역", "Value":"EG",
					"Data":[{"Name":"독해", "Value":"H8EGCHA0010"}
					],
				},
				{"Name":"과학탐구", "Value":"SC",
					"Data":[{"Name":"물리 1", "Value":"H7SCEXP2002"},
						{"Name":"생명과학 1", "Value":"H8SCCHA2001"},
						{"Name":"화학 1", "Value":"H7SCEXP2017"},
						{"Name":"지구과학 1", "Value":"H7SCCHA2003"}
					]
				},
				{"Name":"사회탐구", "Value":"SO",
					"Data":[{"Name":"사회문화", "Value":"H7LSEXPA008"},
						{"Name":"윤리와 사상", "Value":"H7LSEXAA004"},
						{"Name":"한국 지리", "Value":"H7LSEXPA012"},
						{"Name":"생활과 윤리", "Value":"H8LSCHAA002"}
					]
				}
	],
	"yearItems":[ {"Name":"전체 년도", "Value":"ALL"},
				{"Name":"2017년(2018학년도)", "Value":"2017"},
				{"Name":"2016년(2017학년도)", "Value":"2016"},
				{"Name":"2015년(2016학년도)", "Value":"2015"},
				{"Name":"2014년(2015학년도)", "Value":"2014"}
	]
};
*/
var _soopringBasic = {
	"revision":[
		{"Name":"2009개정", "Value":"2009", "menuCD":"000020000600002"
			, "subject":[
				{"Name":"국어", "Value":"KR",
					"Data":[
						{"Name":"문학", "Value":"H7KREXAA007"},
						{"Name":"독서", "Value":"H7KREXPA003"},
						{"Name":"문법", "Value":"H7KREXPA004"},
						{"Name":"화법", "Value":"H7KREXAA001"},
						{"Name":"작문", "Value":"H7KREXPA006"}
					]
				},
				{"Name":"수학", "Value":"MT",
					"Data":[
						{"Name":"가형", "Value":"MT_TYPE_A"},
						{"Name":"나형", "Value":"MT_TYPE_B"}
					],
					"MT_TYPE_A":[
						{"Name":"미적분Ⅱ", "Value":"H8MTCHA2006"},
						{"Name":"기하와 벡터", "Value":"H7MTCHA2004"},
						{"Name":"확률과 통계", "Value":"H8MTCHA0003"}
					],
					"MT_TYPE_B":[
						{"Name":"수학Ⅱ", "Value":"H8MTCHA1004"},
						{"Name":"미적분Ⅰ", "Value":"H8MTCHA2005"},
						{"Name":"확률과 통계", "Value":"H8MTCHA0004"}
					]
				},
				{"Name":"영어", "Value":"EG",
					"Data":[
						{"Name":"독해", "Value":"H8EGCHA0010"}
					],
				},
				{"Name":"과학탐구", "Value":"SC",
					"Data":[
						{"Name":"물리 1", "Value":"H7SCEXP2002"},
						{"Name":"생명과학 1", "Value":"H8SCCHA2001"},
						{"Name":"화학 1", "Value":"H7SCEXP2017"},
						{"Name":"지구과학 1", "Value":"H7SCCHA2003"}
					]
				},
				{"Name":"사회탐구", "Value":"SO",
					"Data":[
						{"Name":"사회문화", "Value":"H7LSEXPA008"},
						{"Name":"윤리와 사상", "Value":"H7LSEXAA004"},
						{"Name":"한국 지리", "Value":"H7LSEXPA012"},
						{"Name":"생활과 윤리", "Value":"H8LSCHAA002"}
					]
				}
			],
			"yearItems":[
				{"Name":"전체 년도", "Value":"ALL"},
				{"Name":"2019년(2020학년도)", "Value":"2019"},
				{"Name":"2018년(2019학년도)", "Value":"2018"},
				{"Name":"2017년(2018학년도)", "Value":"2017"},
				{"Name":"2016년(2017학년도)", "Value":"2016"}
			]
		},
		{"Name":"2015개정", "Value":"2015", "menuCD":"000020000600001"
			, "subject":[
					{"Name":"국어", "Value":"KR",
						"Data":[{"Name":"공통", "Value":"KR_TYPE_A"},
							{"Name":"선택", "Value":"KR_TYPE_B"}
						],
						"KR_TYPE_A":[
							{"Name":"독서", "Value":"H9KRCHA0003"},
							{"Name":"문학", "Value":"H9KRCHA0002|H9KRCHA0018"}
						],
						"KR_TYPE_B":[
							{"Name":"화법과 작문", "Value":"H9KRCHA2002"},
							{"Name":"언어와 매체", "Value":"H9KRCHA2003"}
						]
					},
					{"Name":"수학", "Value":"MT",
						"Data":[
							{"Name":"공통", "Value":"MT_TYPE_A"},
							{"Name":"선택", "Value":"MT_TYPE_B"}
						],
						"MT_TYPE_A":[
							{"Name":"수학 I", "Value":"H9MTCHA2003"},
							{"Name":"수학 II", "Value":"H9MTCHA2004"}
						],
						"MT_TYPE_B":[
							{"Name":"확률과 통계", "Value":"H9MTCHA2005"},
							{"Name":"미적분", "Value":"H9MTCHA2001"},
							{"Name":"기하", "Value":"H9MTCHA2002"}
						]
					},
					{"Name":"영어", "Value":"EG",
						"Data":[
							{"Name":"독해", "Value":"H9EGCHA0028"}
						],
					},
					{"Name":"과학탐구", "Value":"SC",
						"Data":[
							{"Name":"물리학 I", "Value":"H9SCCHA2001"},
							{"Name":"화학 I", "Value":"H9SCCHA2004"},
							{"Name":"생명과학 I", "Value":"H9SCCHA2002"},
							{"Name":"지구과학 I", "Value":"H9SCCHA2003"}
						]
					},
					{"Name":"사회탐구", "Value":"SO",
						"Data":[
							{"Name":"사회문화", "Value":"H9LSCHA2002"},
							{"Name":"한국지리", "Value":"H9LSCHA2003"},
							{"Name":"윤리와 사상", "Value":"H9LSCHA2005"},
							{"Name":"생활과 윤리", "Value":"H9LSCHA2006"}
						]
					}
			],
			"yearItems":[
				{"Name":"전체 년도", "Value":"ALL"},
				{"Name":"2025년(2026학년도)", "Value":"2025"},
				{"Name":"2024년(2025학년도)", "Value":"2024"},
				{"Name":"2023년(2024학년도)", "Value":"2023"},
				{"Name":"2022년(2023학년도)", "Value":"2022"},
				{"Name":"2021년(2022학년도)", "Value":"2021"},
                {"Name":"2020년(2021학년도)", "Value":"2020"},
				{"Name":"2019년(2020학년도)", "Value":"2019"}
			]
		}
	]
};

// 수프링 EBS교재변형(tab:2) 탭
var _soopringOlympus = {
	"cate":[ {"Name":"2024수능특강 변형", "Value":"LIST_G", "Index":"8"},			// 따로 과목과 TX_CODE가 변경된 것이 없기에 LIST_G를 같이사용
			{"Name":"2023수능특강 변형", "Value":"LIST_G", "Index":"7"},			//0		0
			{"Name": "2022수능특강 변형", "Value": "LIST_F", "Index":"6"},			//6
			{"Name": "2021수능특강 변형", "Value": "LIST_B", "Index":"1"},			//1		5
			{"Name": "2020수능특강 변형", "Value": "LIST_B", "Index":"2"},			//2		1
			{"Name": "EBS 올림포스 변형", "Value":"LIST_A", "Index":"0"},
			{"Name": "EBS리딩파워 변형", "Value": "LIST_C", "Index":"3"},			//3		2
			{"Name":"EBS 수능특강 Light 변형", "Value":"LIST_E", "Index":"4"}		//4		3
			//,{"Name":"EBS 교재 변형(영역별)", "Value":"LIST_D", "Index":"5"}		//5		4
	],
	"LIST_A":[ {"Name":"국어", "Value":"KR",
				"Data":[
					{"Name":"국어", "TX_CODE":"H9KRCHA0014", "Value": "4"},
					{"Name":"현대문학", "TX_CODE":"H9KRCH0015", "Value": "7"},
					{"Name":"독서", "TX_CODE":"H9KRCH0017", "Value": "5"},
					{"Name":"고전문학", "TX_CODE":"H9KRCH0016", "Value": "6"},
				],
				},
				{"Name":"영어", "Value":"EG",
				"Data":[
					{"Name": "독해의 변형1", "TX_CODE": "H9EGCHA0005", "Value": "1"},
					{"Name": "독해의 변형2", "TX_CODE": "H9EGCHA0007", "Value": "2"},
				],
				},
	],
	"LIST_B": [ {"Name": "영어", "TX_CODE": "H9EGCHA0009", "Value": "EG"},
				{"Name": "영어독해연습", "TX_CODE": "H9EGCHA0010", "Value": "EG"},
				{"Name": "문학", "TX_CODE": "H9KRCHA0002", "Value": "KR"},
				{"Name": "화법 작문 문법", "TX_CODE": "H9KRCHA0004", "Value": "KR"},
				{"Name": "독서", "TX_CODE": "H9KRCHA0003", "Value": "KR"},
	],
	"LIST_C":  [ {"Name":"기본", "Value":"EG",
				"Data":[
					{"Name":"기본", "TX_CODE":"H9EGCHA0032", "Value": "EG"},
					{"Name":"빈출", "TX_CODE":"H9EGCHA0033", "Value": "EG"},
					{"Name":"심화", "TX_CODE":"H9EGCHA0034", "Value": "EG"},
				],
				},
				{"Name":"완성", "Value":"EG",
				"Data":[
					{"Name":"기본", "TX_CODE":"H9EGCHA0035", "Value": "EG"},
					{"Name":"빈출", "TX_CODE":"H9EGCHA0036", "Value": "EG"},
					{"Name":"심화", "TX_CODE":"H9EGCHA0037", "Value": "EG"},
				],
				},
	],
	"LIST_D":[ {"Name":"국어", "Value":"KR",
				"Data":[{"Name":"문학", "TX_CODE":"H7KREXAA007"},
					{"Name":"독서", "TX_CODE":"H7KREXPA003"},
					{"Name":"문법", "TX_CODE":"H7KREXPA004"},
					{"Name":"화법", "TX_CODE":"H7KREXAA001"},
					{"Name":"작문", "TX_CODE":"H7KREXPA006"}
				]
			},
			{"Name":"수학", "Value":"MT",
				"Data":[{"Name":"가형", "Value":"MT_TYPE_A"},
					{"Name":"나형", "Value":"MT_TYPE_B"}
				],
				"MT_TYPE_A":[{"Name":"미적분Ⅱ", "TX_CODE":"H8MTCHA2006"},
					{"Name":"기하와 벡터", "TX_CODE":"H7MTCHA2004"},
					{"Name":"확률과 통계", "TX_CODE":"H8MTCHA0003"}
				],
				"MT_TYPE_B":[{"Name":"수학Ⅱ", "TX_CODE":"H8MTCHA1004"},
					{"Name":"미적분Ⅰ", "TX_CODE":"H8MTCHA2005"},
					{"Name":"확률과 통계", "TX_CODE":"H8MTCHA0004"}
				]
			},
			{"Name":"영어", "Value":"EG",
				"Data":[{"Name":"독해", "TX_CODE":"H8EGCHA0010"},
						{"Name":"문법", "TX_CODE":"H8EGCHA0012"}
				],
			}
	],
	"LIST_E": [ {"Name": "영어", "TX_CODE": "H9EGCHA0031", "Value": "EG"}
	],
	"LIST_F":[
			{"Name":"국어", "Value":"KR",
				"Data":[
					{"Name":"공통", "Value":"KR_TYPE_A"},
					{"Name":"선택", "Value":"KR_TYPE_B"}
				],
				"KR_TYPE_A":[
					{"Name":"독서", "TX_CODE":"H9KRCHA0003"},
					{"Name":"문학", "TX_CODE":"H9KRCHA0002"}
				],
				"KR_TYPE_B":[
					{"Name":"화법과 작문", "TX_CODE":"H9KRCHA2002"},
					{"Name":"언어와 매체", "TX_CODE":"H9KRCHA2003"}
				]
			},
			{"Name":"수학", "Value":"MT",
				"Data":[
					{"Name":"공통", "Value":"MT_TYPE_A"},
					{"Name":"선택", "Value":"MT_TYPE_B"}
				],
				"MT_TYPE_A":[
					{"Name":"수학 Ⅰ", "TX_CODE":"H9MTCHA2003"},
					{"Name":"수학 Ⅱ", "TX_CODE":"H9MTCHA2004"}
				],
				"MT_TYPE_B":[
					{"Name":"확률과 통계", "TX_CODE":"H9MTCHA2005"},
					{"Name":"미적분", "TX_CODE":"H9MTCHA2001"},
					{"Name":"기하", "TX_CODE":"H9MTCHA2002"}
				]
			},
			{"Name":"영어", "Value":"EG",
				"Data":[
					{"Name":"영어", "TX_CODE":"H9EGCHA0009"},
					{"Name":"영어독해연습", "TX_CODE":"H9EGCHA0010"}
				],
			}
	],
	"LIST_G":[
			{"Name":"국어", "Value":"KR",
				"Data":[
					{"Name":"공통", "Value":"KR_TYPE_A"},
					{"Name":"선택", "Value":"KR_TYPE_B"}
				],
				"KR_TYPE_A":[
					{"Name":"독서", "TX_CODE":"H9KRCHA0003"},
					{"Name":"문학", "TX_CODE":"H9KRCHA0002"}
				],
				"KR_TYPE_B":[
					{"Name":"화법과 작문", "TX_CODE":"H9KRCHA2002"},
					{"Name":"언어와 매체", "TX_CODE":"H9KRCHA2003"}
				]
			},
			{"Name":"수학", "Value":"MT",
				"Data":[
					{"Name":"공통", "Value":"MT_TYPE_A"},
					{"Name":"선택", "Value":"MT_TYPE_B"}
				],
				"MT_TYPE_A":[
					{"Name":"수학 Ⅰ", "TX_CODE":"H9MTCHA2003"},
					{"Name":"수학 Ⅱ", "TX_CODE":"H9MTCHA2004"}
				],
				"MT_TYPE_B":[
					{"Name":"확률과 통계", "TX_CODE":"H9MTCHA2005"},
					{"Name":"미적분", "TX_CODE":"H9MTCHA2001"},
					{"Name":"기하", "TX_CODE":"H9MTCHA2002"}
				]
			},
			{"Name":"영어", "Value":"EG",
				"Data":[
					{"Name":"영어", "TX_CODE":"H9EGCHA0009"},
					{"Name":"영어독해연습", "TX_CODE":"H9EGCHA0010"}
				],
			},
			{"Name":"사회탐구", "Value":"LS",
				"Data":[
					{"Name":"생활과 윤리", "TX_CODE":"H9LSCHA2006"},
					{"Name":"사회문화", "TX_CODE":"H9LSCHA2002"},
					{"Name":"한국지리", "TX_CODE":"H9LSCHA2003"},
					{"Name":"정치와 법", "TX_CODE":"H9LSCHA2001"}
				],
			},
			{"Name":"과학탐구", "Value":"SC",
				"Data":[
					{"Name":"물리학Ⅰ", "TX_CODE":"H9SCCHA2001"},
					{"Name":"화학Ⅰ", "TX_CODE":"H9SCCHA2004"},
					{"Name":"생명과학Ⅰ", "TX_CODE":"H9SCCHA2002"},
					{"Name":"지구과학Ⅰ", "TX_CODE":"H9SCCHA2003"}
				],
			}
	]
};

// 수프링 변형문제 탭
var _soopringTrans = {
	"cate":[
			{"Name":"학평변형문제", "Value":"LIST_A", "menuCD":"000020000700001"},
			{"Name":"학평/수능기출문제 (무료)", "Value":"LIST_B", "menuCD":"000020000700003"},
			{"Name":"학평변형유형<sup>+</sup>", "Value":"LIST_C", "menuCD":"000020000700002"}
	],
	"LIST_C":{
		"subject":[ {"Name":"물리학Ⅰ", "Value":"SC", "TXCODE": "H9SCCHA2001"
								, "ROOT_PART": [
											{"Name":"전체 대단원", "Value":""
													, "SUB_PART": [
																{"Name":"힘과 운동", "Value":"0101"},
																{"Name":"에너지와 열", "Value":"0102"},
																{"Name":"시간과 공간", "Value":"0103"},
																{"Name":"물질의 전기적 특성", "Value":"0201"},
																{"Name":"물질의 자기적 특성", "Value":"0202"},
																{"Name":"파동의 성질과 이용<br/>~ 02. 빛과 물질의 이중성", "Value":"0301"}
													]
											},
											{"Name":"1. 역학과 에너지", "Value":"01"
													, "SUB_PART": [
																{"Name":"힘과 운동", "Value":"0101"},
																{"Name":"에너지와 열", "Value":"0102"},
																{"Name":"시간과 공간", "Value":"0103"}
													]
											},
											{"Name":"2. 물질과 전자기장", "Value":"02"
													, "SUB_PART": [
																{"Name":"물질의 전기적 특성", "Value":"0201"},
																{"Name":"물질의 자기적 특성", "Value":"0202"}
													]
											}
											,
											{"Name":"3. 파동과 정보 통신", "Value":"03"
													, "SUB_PART": [
																{"Name":"파동의 성질과 이용<br/>~ 02. 빛과 물질의 이중성", "Value":"0301"}
													]
											}
								]
					},
					{"Name":"화학Ⅰ", "Value":"SC", "TXCODE": "H9SCCHA2004"
								, "ROOT_PART": [
											{"Name":"전체 대단원", "Value":""
													, "SUB_PART": [
																{"Name":"화학과 우리 생활", "Value":"0101"},
																{"Name":"물질의 양과 화학반응식", "Value":"0102"},
																{"Name":"원자의 구조", "Value":"0201"},
																{"Name":"원소의 주기적 성질", "Value":"0202"},
																{"Name":"화학 결합", "Value":"0301"},
																{"Name":"분자의 구조와 성질", "Value":"0302"},
																{"Name":"화학 반응에서의 동적 평형", "Value":"0401"},
																{"Name":"화학 반응과 열의 출입", "Value":"0402"}
													]
											},
											{"Name":"1. 화학의 첫걸음", "Value":"01"
													, "SUB_PART": [
																{"Name":"화학과 우리 생활", "Value":"0101"},
																{"Name":"물질의 양과 화학반응식", "Value":"0102"}
													]
											},
											{"Name":"2. 원자의 세계", "Value":"02"
														, "SUB_PART": [
																{"Name":"원자의 구조", "Value":"0201"},
																{"Name":"원소의 주기적 성질", "Value":"0202"}
														]
											}
											,
											{"Name":"3. 화학 결합과 분자의 세계", "Value":"03"
														, "SUB_PART": [
																{"Name":"화학 결합", "Value":"0301"},
																{"Name":"분자의 구조와 성질", "Value":"0302"}
														]
											},
											{"Name":"4. 역동적인 화학 반응", "Value":"04"
														, "SUB_PART": [
																{"Name":"화학 반응에서의 동적 평형", "Value":"0401"},
																{"Name":"화학 반응과 열의 출입", "Value":"0402"}
														]
											}
								]
					},
					{"Name":"생명과학Ⅰ", "Value":"SC", "TXCODE": "H9SCCHA2002"
								, "ROOT_PART": [
											{"Name":"전체 대단원", "Value":""
														, "SUB_PART": [
																{"Name":"생명 과학의 이해", "Value":"0101"},
																{"Name":"사람의 물질대사", "Value":"0201"},
																{"Name":"신경계", "Value":"0301"},
																{"Name":"호르몬과 항상성", "Value":"0302"},
																{"Name":"방어 작용", "Value":"0303"},
																{"Name":"염색체와 세포 분열", "Value":"0401"},
																{"Name":"사람의 유전", "Value":"0402"},
																{"Name":"생태계의 구성과 기능<br/>~ 02. 생물 다양성과 보전", "Value":"0501"}
														]
											},
											{"Name":"1. 생명 과학의 이해", "Value":"01"
														, "SUB_PART": [
																{"Name":"생명 과학의 이해", "Value":"0101"}
														]
											},
											{"Name":"2. 사람의 물질대사", "Value":"02"
														, "SUB_PART": [
																{"Name":"사람의 물질대사", "Value":"0201"}
														]
											},
											{"Name":"3. 항상성과 몸의 조절", "Value":"03"
														, "SUB_PART": [
																{"Name":"신경계", "Value":"0301"},
																{"Name":"호르몬과 항상성", "Value":"0302"},
																{"Name":"방어 작용", "Value":"0303"}
														]
											}
											,
											{"Name":"4. 유전", "Value":"04"
														, "SUB_PART": [
																{"Name":"염색체와 세포 분열", "Value":"0401"},
																{"Name":"사람의 유전", "Value":"0402"}
														]
											},
											{"Name":"5. 생태계와 상호 작용", "Value":"05"
														, "SUB_PART": [
																{"Name":"생태계의 구성과 기능<br/>~ 02. 생물 다양성과 보전", "Value":"0501"}
														]
											}
								]
					},
					{"Name":"지구과학Ⅰ", "Value":"SC", "TXCODE": "H9SCCHA2003"
								, "ROOT_PART": [
											{"Name":"전체 대단원", "Value":""
														, "SUB_PART": [
																{"Name":"지권의 변동", "Value":"0101"},
																{"Name":"지구의 역사", "Value":"0102"},
																{"Name":"대기와 해양의 변화", "Value":"0201"},
																{"Name":"대기와 해양의 상호 작용", "Value":"0202"},
																{"Name":"별과 외계 행성계", "Value":"0301"},
																{"Name":"외부 은하와 우주 팽창", "Value":"0302"}
														]
											},
											{"Name":"1. 고체 지구", "Value":"01"
														, "SUB_PART": [
																{"Name":"지권의 변동", "Value":"0101"},
																{"Name":"지구의 역사", "Value":"0102"}
														]
											},
											{"Name":"2. 대기와 해양", "Value":"02"
														, "SUB_PART": [
																{"Name":"대기와 해양의 변화", "Value":"0201"},
																{"Name":"대기와 해양의 상호 작용", "Value":"0202"}
														]
											}
											,
											{"Name":"3. 우주", "Value":"03"
														, "SUB_PART": [
																{"Name":"별과 외계 행성계", "Value":"0301"},
																{"Name":"외부 은하와 우주 팽창", "Value":"0302"}
														]
											}
								]
					}
		],
		"yearItems":[
					{"Name":"2023년", "Value":"2023"},
					{"Name":"2022년", "Value":"2022"},
					{"Name":"2021년", "Value":"2021"}
		]
	},
	"LIST_A":{
		"subject":[ {"Name":"국어", "Value":"KR", "TXCODE": ["H9KRCHA1006", "H9KRCHA2001", "H9KRCHA0001"]},
					{"Name":"영어", "Value":"EG", "TXCODE": ["H8EGCHA1008", "H8EGCHA2012", "H8EGCHA0013", "H8EGCHA0014"]},
					{"Name":"수학", "Value":"MT", "TXCODE": ["H8MTCHA1005", "H8MTCHA2007", "H9MTCHA0001"]},
		],
		"grade":[
					{"Name":"1학년", "Value":"1"},
					{"Name":"2학년", "Value":"2"},
					{"Name":"3학년", "Value":"3"}
		],
		"yearItems":[ {"Name":"전체 년도", "Value":"ALL"},
					{"Name":"2024년", "Value":"2024"},
					{"Name":"2023년", "Value":"2023"},
					{"Name":"2022년", "Value":"2022"},
					{"Name":"2021년", "Value":"2021"},
					{"Name":"2020년", "Value":"2020"},
					{"Name":"2019년", "Value":"2019"},
					{"Name":"2018년", "Value":"2018"},
					{"Name":"2017년", "Value":"2017"}
		]
	},
	"LIST_B": {
		"subject":[
					{
						// 1학년 과목-영역 목록
						"pubList" : [
							{
								"Name": "국어", "Value": "KR", "Data": [
								{
									"Name": "공통", "Value": "H9KRCHA1006"
								}
							]
							},
							{
								"Name": "영어", "Value": "EG", "Data": [
									{
										"Name": "공통", "Value": "H8EGCHA1008"
									}
								]
							},
							{
								"Name": "수학", "Value": "MT", "Data": [
									{
										"Name": "공통", "Value": "H8MTCHA1005"
									}
								]
							},
							{
								"Name": "과학탐구", "Value": "SC", "Data": [
									{
										"Name": "통합과학", "Value": "H9SCCHA1001"
									}
								]
							},
							{
								"Name": "사회탐구", "Value": "LS", "Data": [
									{
										"Name": "통합사회", "Value": "H9LSCHA1001"
									}
								]
							},
							{
								"Name": "한국사", "Value": "HI", "Data": [
									{
										"Name": "공통", "Value": "H9HICHA1001"
									}
								]
							},
						]
					},
					{


						// 2학년 과목-영역 목록
						"pubList" : [
							{
								"Name": "국어", "Value": "KR", "Data": [
								{
									"Name": "공통", "Value": "H9KRCHA2001"
								}
							]
							},
							{
								"Name": "영어", "Value": "EG", "Data": [
									{
										"Name": "공통", "Value": "H8EGCHA2012"
									}
								]
							},
							{
								"Name": "수학", "Value": "MT", "Data": [
									{
										"Name": "공통", "Value": "H8MTCHA2007"
									}
								]
							},
							{
								"Name": "과학탐구", "Value": "SC", "Data": [
									{
										"Name": "물리학 I", "Value": "H9SCCHA2001"
									},
									{
										"Name": "화학 I", "Value": "H9SCCHA2004"
									},
									{
										"Name": "생명과학 I", "Value": "H9SCCHA2002"
									},
									{
										"Name": "지구과학 I ", "Value": "H9SCCHA2003"
									},
								]
							},
							{
								"Name": "사회탐구", "Value": "LS", "Data": [
									{
										"Name": "생활과 윤리", "Value": "H9LSCHA2006"
									},
									{
										"Name": "한국지리", "Value": "H9LSCHA2003"
									},
									{
										"Name": "동아시아사", "Value": "H9LSCHA2008"
									},
									{
										"Name": "정치와 법", "Value": "H9LSCHA2001"
									},
									{
										"Name": "사회문화", "Value": "H9LSCHA2002"
									},
									{
										"Name": "윤리와 사상", "Value": "H9LSCHA2005"
									},
									{
										"Name": "세계지리", "Value": "H9LSCHA2009"
									},
									{
										"Name": "세계사", "Value": "H9LSCHA2004"
									},
									{
										"Name": "경제", "Value": "H9LSCHA2007"
									},
								]
							},
							{
								"Name": "한국사", "Value": "HI", "Data": [
									{
										"Name": "공통", "Value": "H9HICHA2001"
									}
								]
							},
						]
					},
					{
						// 3학년 과목-영역 목록
						"pubList" : [
							{
								"Name": "국어", "Value": "KR", "Data": [
								{
									"Name": "공통", "Value": "H9KRCHA3003"
								}
							]
							},
							{
								"Name": "영어", "Value": "EG", "Data": [
									{
										"Name": "공통", "Value": "H9EGCHA3001"
									}
								]
							},
							{
								"Name": "수학", "Value": "MT", "Data": [
									{
										"Name": "공통", "Value": "H9MTCHA3002"
									}
								]
							},
							{
								"Name": "과학탐구", "Value": "SC", "Data": [
									{
										"Name": "물리 I", "Value": "H9SCCHA3002"
									},
									{
										"Name": "물리 II", "Value": "H9SCCHA3006"
									},
									{
										"Name": "화학 I", "Value": "H9SCCHA3003"
									},
									{
										"Name": "화학 II", "Value": "H9SCCHA3007"
									},
									{
										"Name": "생명과학 I", "Value": "H9SCCHA3004"
									},
									{
										"Name": "생명과학 II", "Value": "H9SCCHA3008"
									},
									{
										"Name": "지구과학 I", "Value": "H9SCCHA3005"
									},
									{
										"Name": "지구과학 II", "Value": "H9SCCHA3009"
									},
								]
							},
							{
								"Name": "사회탐구", "Value": "LS", "Data": [
									{
										"Name": "생활과 윤리", "Value": "H9LSCHA3002"
									},
									{
										"Name": "한국지리", "Value": "H9LSCHA3003"
									},
									{
										"Name": "동아시아사", "Value": "H9LSCHA3004"
									},
									{
										"Name": "정치와 법", "Value": "H9LSCHA3005"
									},
									{
										"Name": "사회문화", "Value": "H9LSCHA3006"
									},
									{
										"Name": "윤리와 사상", "Value": "H9LSCHA3007"
									},
									{
										"Name": "세계지리", "Value": "H9LSCHA3008"
									},
									{
										"Name": "세계사", "Value": "H9LSCHA3009"
									},
									{
										"Name": "경제", "Value": "H9LSCHA3010"
									},
								]
							},
							{
								"Name": "한국사", "Value": "HI", "Data": [
									{
										"Name": "공통", "Value": "H9HICHA3001"
									}
								]
							},
						]
					}
		],
		"grade":[
					{"Name":"1학년", "Value":"1"},
					{"Name":"2학년", "Value":"2"},
					{"Name":"3학년", "Value":"3"}
		],
		"yearItems":[ {"Name":"전체 년도", "Value":""},
					{"Name":"2025년", "Value":"2025"},
					{"Name":"2024년", "Value":"2024"},
					{"Name":"2023년", "Value":"2023"},
					{"Name":"2022년", "Value":"2022"},
					{"Name":"2021년", "Value":"2021"},
					{"Name":"2020년", "Value":"2020"},
					{"Name":"2019년", "Value":"2019"},
		],
	}
};

var _soopring_Event = {
	"cate":[ {"Name": "2021수능특강 변형", "Value": "LIST_B"},
			{"Name": "2020수능특강 변형", "Value": "LIST_B"}
	],
	"LIST_B": [ {"Name": "영어", "TX_CODE": "H9EGCHA0009", "Value": "EG"},
				{"Name": "영어독해연습", "TX_CODE": "H9EGCHA0010", "Value": "EG"},
				{"Name": "문학", "TX_CODE": "H9KRCHA0002", "Value": "KR"},
				{"Name": "화법 작문 문법", "TX_CODE": "H9KRCHA0004", "Value": "KR"},
				{"Name": "독서", "TX_CODE": "H9KRCHA0003", "Value": "KR"},
	]
}; 

// 수프링 부교재 변형(tap:4)
var _soopringSubTrans = {
	"cate":[ {"Name":"수능특강 유형", "Value":"LIST_C", "Index":"2", "menuCD":"000020000800001"},
			{"Name": "올림포스 유형", "Value": "LIST_D", "Index":"3", "menuCD":"000020000800002"},
			{"Name": "리딩파워 유형", "Value": "LIST_E", "Index":"4", "menuCD":"000020000800003"},
			{"Name": "수능특강 Light 유형", "Value": "LIST_F", "Index":"5", "menuCD":"000020000800004"},
			{"Name":"빠른독해 바른독해", "Value":"LIST_A", "Index":"0", "menuCD":"000020000800005"},
			{"Name": "THE 상승", "Value": "LIST_B", "Index":"1", "menuCD":"000020000800006"},				
	],
	"LIST_A":[ {"Name":"기초세우기", "TX_CODE":"H9EGCHA0038", "Value": "1"},
			{"Name":"유형독해", "TX_CODE":"H9EGCHA0039", "Value": "2"},
			{"Name":"구문독해", "TX_CODE":"H9EGCHA0040", "Value": "3"},
	],
	"LIST_B": [ {"Name": "구문법", "TX_CODE": "H9EGCHA0041", "Value": "1"},
				{"Name": "문법독해편", "TX_CODE": "H9EGCHA0042", "Value": "2"},
				{"Name": "수능유형편", "TX_CODE": "H9EGCHA0043", "Value": "3"},
	],
	"LIST_C": [ 
		{"Name":"국어", "Value":"KR",
			"Data":[				
				{
					"Name":"문학", "TX_CODE":"H9KRCHA0002", "Data":[
						{"Name": "고전시가", "Value": "L1"},
						{"Name": "현대시", "Value": "L2"},
						{"Name": "고전산문", "Value": "L3"},
						{"Name": "현대소설", "Value": "L4"},
						{"Name": "극&middot;수필", "Value": "L5"}
					]
				}
			]
		},
		{"Name":"영어", "Value":"EG",
			"Data":[
				{"Name":"영어", "TX_CODE":"H9EGCHA0009"},
				{"Name":"영어독해연습", "TX_CODE":"H9EGCHA0010"}
			],
		},
		{"Name":"수학", "Value":"MT",
			"Data":[
				{"Name":"수학 Ⅰ", "TX_CODE":"H9MTCHA0011"},
				{"Name":"수학 Ⅱ", "TX_CODE":"H9MTCHA0012"},
				{"Name":"확률과 통계", "TX_CODE":"H9MTCHA0013"},
				{"Name":"미적분", "TX_CODE":"H9MTCHA0014"},
				{"Name":"기하", "TX_CODE":"H9MTCHA0015"}
			]
		},
		{"Name":"과학탐구", "Value":"SC",
			"Data":[
				{"Name":"물리학Ⅰ", "TX_CODE":"H9SCCHA0024"},
				{"Name":"화학Ⅰ", "TX_CODE":"H9SCCHA0023"},
				{"Name":"생명과학Ⅰ", "TX_CODE":"H9SCCHA0021"},
				{"Name":"지구과학Ⅰ", "TX_CODE":"H9SCCHA0022"}
			],
		},
		{"Name":"사회탐구", "Value":"LS",
			"Data":[
				{"Name":"사회문화", "TX_CODE":"H9LSCHA0016"},
				{"Name":"정치와 법", "TX_CODE":"H9LSCHA0019"},
				{"Name":"한국지리", "TX_CODE":"H9LSCHA0018"},
				{"Name":"생활과 윤리", "TX_CODE":"H9LSCHA0017"}
			],
		}
	],
	"LIST_D":[ 
		{"Name":"국어", "Value":"KR",
			"Data":[
				{
					"Name": "현대문학", "TX_CODE": "H9KRCHA0015", "Value": "1", "Data":[
						{"Name": "현대 시", "Value": "M1"},
						{"Name": "현대 소설", "Value": "M2"},
						{"Name": "현대 수필", "Value": "M3"},
					],
				},
				{
					"Name": "고전문학", "TX_CODE": "H9KRCHA0016", "Value": "2", "Data":[
						{"Name": "상고 시대", "Value": "M4"},
						{"Name": "고려 시대", "Value": "M5"},
						{"Name": "조선 시대", "Value": "M6"},
					],
				},
				//{"Name": "독해의 기본2", "TX_CODE": "H9EGCHA0007", "Value": "2"},
			],
		},
		{"Name":"영어", "Value":"EG",
			"Data":[
				{"Name": "영어독해 기본1", "TX_CODE": "H9EGCHA0005", "Value": "1"},
				{"Name": "영어독해 기본2", "TX_CODE": "H9EGCHA0007", "Value": "2"},
			],
		},
	],
	"LIST_E":  [ 
		{"Name":"영어",
			"subData":[
				{"Name":"기본", "Value":"EG",
				"Data":[
					{"Name":"기본", "TX_CODE":"H9EGCHA0032", "Value": "EG"},
					{"Name":"빈출", "TX_CODE":"H9EGCHA0033", "Value": "EG"},
					{"Name":"심화", "TX_CODE":"H9EGCHA0034", "Value": "EG"},
				],
				},
				{"Name":"완성", "Value":"EG",
				"Data":[
					{"Name":"기본", "TX_CODE":"H9EGCHA0035", "Value": "EG"},
					{"Name":"빈출", "TX_CODE":"H9EGCHA0036", "Value": "EG"},
					{"Name":"심화", "TX_CODE":"H9EGCHA0037", "Value": "EG"},
				],
				},
			],
		},
	],
	"LIST_F": [ 
		{"Name":"영어", "Value":"EG",
			"Data":[
				{"Name": "영어", "TX_CODE": "H9EGCHA0031", "Value": "EG"},
			],
		}
		//{"Name": "영어영역", "TX_CODE": "H9EGCHA0031", "Value": "EG"}
	]
};