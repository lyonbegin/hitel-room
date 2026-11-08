/* 단원별 정보 **/
var INTERVAL_ID = null;
var isRedownLastChk_v = 1;
var DATA_FORMAT_CONFIG = {//다운로드 콘텐츠 포맷별 포맷코드&class명 구분_다운로드 콘텐츠 아이콘 변경 요청(EDUMIG-3409)
	"pdf" : {
		CODE : "2",
		CLASS_GUBUN : "pdf"
	}, 
	"scan" : {
		CODE : "3",
		CLASS_GUBUN : "hwp"
	}, 
	"스캔" : {
		CODE : "3",
		CLASS_GUBUN : "hwp"
	}, 
	"무료<br>열람" : {
		CODE : "3",
		CLASS_GUBUN : "hwp"
	}, 
	"hwp" : {
		CODE : "4",
		CLASS_GUBUN : "hwp"
	}, 
	"zip" : {
		CODE : "5",
		CLASS_GUBUN : "hwp"
	}, 
	"문제풀이" : {
		CODE : "94",
		CLASS_GUBUN : "interpret"
	}, 
	"정답<br/>요청" : {
		CODE : "96",
		CLASS_GUBUN : "right"
	}, 
	"오답<br>노트" : {
		CODE : "97",
		CLASS_GUBUN : "wrongnote"
	}, 
	"정답<br>입력" : {
		CODE : "98",
		CLASS_GUBUN : "right"
	}, 
	"채점<br>확인" : {
		CODE : "99",
		CLASS_GUBUN : "wrongnoteinput"
	}, 
	"답안<br>제출" : {
		CODE : "93",
		CLASS_GUBUN : "wrongnoteinput"
	}, 
	"결과<br>분석" : {
		CODE : "92",
		CLASS_GUBUN : "previousanalysis"
	}, 
	"해설<br>받기" : {
		CODE : "91",
		CLASS_GUBUN : "wrongnoteinput"
	}, 
	"개념영상" : {
		CODE : "90",
		CLASS_GUBUN : "concept"
	}, 
	"풀이영상" : {
		CODE : "89",
		CLASS_GUBUN : "interpret"
	}, 
	"기출<br>분석" : {
		CODE : "88",
		CLASS_GUBUN : "previousanalysis"
	}, 
	"무료열람" : {
		CODE : "33",
		CLASS_GUBUN : "previousviewer"
	}, 
	"기출<br>유사" : {
		CODE : "34",
		CLASS_GUBUN : "previousgo"
	}
};
var _Unit = {
    "M1":{
        "KR":{"Name":"국어", "unitItems":[
                // {"Name":"개념완성", "Value":"H", "CoreType":"S|C"},
                {"Name":"개념완성", "Value":"H", "Index":"0"},
                {"Name":"단원별 문제", "Value":"C", "CoreType":"", "Index":"1"},
                {"Name":"서술형 문제", "Value":"M", "CoreType":"", "Index":"2"},
                //{"Name":"최다빈출 문제", "Value":"H", "CoreType":"D", "Index":"3"},
                //{"Name":"최다오답 문제", "Value":"H", "CoreType":"E", "Index":"4"},
                {"Name":"고난도 문제", "Value":"S", "CoreType":"", "Index":"5"},
                //{"Name":"국어작품별 문제", "Value":"K", "CoreType":"P1", "Index":"6"},
                //{"Name":"국어문법 연습", "Value":"K", "CoreType":"O7", "Index":"7"},
                {"Name":"갈래별 문학(PRO)", "Value":"P", "CoreType":"D1", "Index":"8", "gubun":"PRO", "url":"/M/Pro/?gubun=5"},
                {"Name":"국어 문법(PRO)", "Value":"P", "CoreType":"A1", "Index":"9", "gubun":"PRO", "url":"/M/Pro/?gubun=6"}
            ], "Value": "KR"},
        "EG":{"Name":"영어", "unitItems":[
                // {"Name":"개념완성", "Value":"H", "CoreType":"V|C"},
                {"Name":"개념완성", "Value":"H", "Index":"0"},
                {"Name":"단원별 문제", "Value":"C", "CoreType":"", "Index":"1"},
                {"Name":"서술형 문제", "Value":"M", "CoreType":"", "Index":"2"},
                //{"Name":"최다빈출 문제", "Value":"H", "CoreType":"D", "Index":"3"},
                //{"Name":"최다오답 문제", "Value":"H", "CoreType":"E", "Index":"4"},
                {"Name":"영어문법 문제 (출판사별)", "Value":"H", "CoreType":"T", "Index":"5"},
                //{"Name":"영문법", "Value":"S", "CoreType": "G", "Index":"6"},
                {"Name":"영문법(PRO)", "Value":"K", "CoreType": "C", "Index":"7", "gubun":"PRO", "url":"/M/Pro/?gubun=3"},
                {"Name":"구문독해(PRO)", "Value":"P", "CoreType": "E1", "Index":"8", "gubun":"PRO", "url":"/M/Pro/?gubun=4"},
            ], "Value": "EG"},
        "MT":{"Name":"수학", "unitItems":[
                // {"Name":"개념완성", "Value":"H", "CoreType":"S|C"},
                {"Name":"개념완성", "Value":"H", "Index":"0"},
                {"Name":"단원별 문제", "Value":"C", "Index":"1"},
                {"Name":"서술형 문제", "Value":"M", "CoreType":"", "Index":"2"},
                //{"Name":"최다빈출 문제", "Value":"H", "CoreType":"D", "Index":"3"},
                //{"Name":"최다오답 문제", "Value":"H", "CoreType":"E", "Index":"4"},
                {"Name":"고난도 문제", "Value":"S", "Index":"5"},
                {"Name":"수학 유형별 문제", "Value":"K", "CoreType":"M", "Index":"6"},
                {"Name":"수학 계산력 문제", "Value":"K", "CoreType":"B1", "Index":"7"},
				//{"Name":"수학 교과서 변형", "Value":"K", "CoreType":"F", "Index":"8"},
				{"Name":"수학 단계별 학습관(PRO)", "Value":"P", "CoreType":"B1", "Index":"9", "gubun":"PRO", "url":"/M/Pro/?gubun=1"},
				{"Name":"수학 교과서 변형(PRO)", "Value":"P", "CoreType":"C1", "Index":"10", "gubun":"PRO", "url":"/M/Pro/?gubun=2"},
            ], "Value": "MT"},
        "SC":{"Name":"과학", "unitItems":[
            // {"Name":"개념완성", "Value":"H", "CoreType":"S|V|C"},
            {"Name":"개념완성", "Value":"H", "Index":"0"},
            {"Name":"단원별 문제", "Value":"C", "Index":"1"},
            {"Name":"서술형 문제", "Value":"M", "CoreType":"", "Index":"2"},
            //{"Name":"최다빈출 문제", "Value":"H", "CoreType":"D", "Index":"3"},
            //{"Name":"최다오답 문제", "Value":"H", "CoreType":"E", "Index":"4"},
            {"Name":"고난도 문제", "Value":"S", "Index":"5"},
            ], "Value": "SC"},
        "LS":{"Name":"사회", "unitItems":[
            // {"Name":"개념완성", "Value":"H", "CoreType":"S|V|C"},
            {"Name":"개념완성", "Value":"H", "Index":"0"},
            {"Name":"단원별 문제", "Value":"C", "Index":"1"},
            {"Name":"서술형 문제", "Value":"M", "CoreType":"", "Index":"2"},
            //{"Name":"최다빈출 문제", "Value":"H", "CoreType":"D", "Index":"3"},
            //{"Name":"최다오답 문제", "Value":"H", "CoreType":"E", "Index":"4"},
            ], "Value": "LS"},
         "HI":{"Name":"역사", "unitItems":[
             {"Name":"개념완성", "Value":"H", "Index":"0"},
             {"Name":"단원별 문제", "Value":"C", "Index":"1"},
             {"Name":"서술형 문제", "Value":"M", "CoreType":"", "Index":"2"},
             //{"Name":"최다빈출 문제", "Value":"H", "CoreType":"D", "Index":"3"},
             //{"Name":"최다오답 문제", "Value":"H", "CoreType":"E", "Index":"4"},
             ], "Value": "HI"},
        "ET":{"Name":"도덕", "unitItems":[
            // {"Name":"개념완성", "Value":"H", "CoreType":"S|V"},
            {"Name":"개념완성", "Value":"H", "Index":"0"},
            {"Name":"단원별 문제", "Value":"C", "Index":"1"},
			{"Name":"서술형 문제", "Value":"M", "CoreType":"", "Index":"2"},
            //{"Name":"최다빈출 문제", "Value":"H", "CoreType":"D", "Index":"3"},
            //{"Name":"최다오답 문제", "Value":"H", "CoreType":"E", "Index":"4"},
            ], "Value": "ET"},
        "TH":{"Name":"기술가정", "unitItems":[
            // {"Name":"개념완성", "Value":"H", "CoreType":"S|V"},
            {"Name":"개념완성", "Value":"H", "Index":"0"},
            {"Name":"단원별 문제", "Value":"C", "Index":"1"},
			{"Name":"서술형 문제", "Value":"M", "CoreType":"", "Index":"2"},
            //{"Name":"최다빈출 문제", "Value":"H", "CoreType":"D", "Index":"3"},
            //{"Name":"최다오답 문제", "Value":"H", "CoreType":"E", "Index":"4"},
            ], "Value": "TH"},
        "CH":{"Name":"한문", "unitItems":[
            {"Name":"개념완성", "Value":"H", "Index":"0"},
            {"Name":"단원별 문제", "Value":"C", "Index":"1"},
            ], "Value": "CH"},
    },
    "M2":{
        "KR":{"Name":"국어", "unitItems":[
            // {"Name":"개념완성", "Value":"H", "CoreType":"S"},
            {"Name":"개념완성", "Value":"H", "Index":"0"},
            {"Name":"단원별 문제", "Value":"C", "Index":"1"},
            {"Name":"서술형 문제", "Value":"M", "CoreType":"", "Index":"2"},
            //{"Name":"최다빈출 문제", "Value":"H", "CoreType":"D", "Index":"3"},
            //{"Name":"최다오답 문제", "Value":"H", "CoreType":"E", "Index":"4"},
            {"Name":"고난도 문제", "Value":"S", "Index":"5"},
            //{"Name":"국어작품별 문제", "Value":"K", "CoreType":"P1", "Index":"6"},
            //{"Name":"국어문법 연습", "Value":"K", "CoreType":"O7", "Index":"7"},
			{"Name":"갈래별 문학(PRO)", "Value":"P", "CoreType":"D1", "Index":"8", "gubun":"PRO", "url":"/M/Pro/?gubun=5"},
			{"Name":"국어 문법(PRO)", "Value":"P", "CoreType":"A1", "Index":"9", "gubun":"PRO", "url":"/M/Pro/?gubun=6"}
            ], "Value": "KR"},
        "EG":{"Name":"영어", "unitItems":[
            {"Name":"개념완성", "Value":"H", "CoreType":"", "Index":"0"},
            {"Name":"단원별 문제", "Value":"C", "Index":"1"},
            {"Name":"서술형 문제", "Value":"M", "CoreType":"", "Index":"2"},
			//{"Name":"최다빈출 문제", "Value":"H", "CoreType":"D", "Index":"3"},
			//{"Name":"최다오답 문제", "Value":"H", "CoreType":"E", "Index":"4"},
            {"Name":"영어문법 문제  (출판사별)", "Value":"H", "CoreType":"T", "Index":"5"},
            //{"Name":"영문법", "Value":"S", "CoreType": "G", "Index":"6"},
			{"Name":"영문법(PRO)", "Value":"K", "CoreType": "C", "Index":"7", "gubun":"PRO", "url":"/M/Pro/?gubun=3"},
			{"Name":"구문독해(PRO)", "Value":"P", "CoreType": "E1", "Index":"8", "gubun":"PRO", "url":"/M/Pro/?gubun=4"},
            ], "Value": "EG"},
        "MT":{"Name":"수학", "unitItems":[
            {"Name":"개념완성", "Value":"H", "CoreType":"", "Index":"0"},
            {"Name":"단원별 문제", "Value":"C", "Index":"1"},
            {"Name":"서술형 문제", "Value":"M", "CoreType":"", "Index":"2"},
            //{"Name":"최다빈출 문제", "Value":"H", "CoreType":"D", "Index":"3"},
            //{"Name":"최다오답 문제", "Value":"H", "CoreType":"E", "Index":"4"},
            {"Name":"고난도 문제", "Value":"S", "Index":"5"},
            {"Name":"수학 유형별 문제", "Value":"K", "CoreType":"M", "Index":"6"},
            {"Name":"수학 계산력 문제", "Value":"K", "CoreType":"B1", "Index":"7"},
			//{"Name":"수학 교과서 변형", "Value":"K", "CoreType":"F", "Index":"8"}
			{"Name":"수학 단계별 학습관(PRO)", "Value":"P", "CoreType":"B1", "Index":"9", "gubun":"PRO", "url":"/M/Pro/?gubun=1"},
			{"Name":"수학 교과서 변형(PRO)", "Value":"P", "CoreType":"C1", "Index":"10", "gubun":"PRO", "url":"/M/Pro/?gubun=2"},
            ], "Value": "MT"},
        "SC":{"Name":"과학", "unitItems":[
            // {"Name":"개념완성", "Value":"H", "CoreType":"V"},
            {"Name":"개념완성", "Value":"H", "Index":"0"},
            {"Name":"단원별 문제", "Value":"C", "Index":"1"},
            {"Name":"서술형 문제", "Value":"M", "CoreType":"", "Index":"2"},
            //{"Name":"최다빈출 문제", "Value":"H", "CoreType":"D", "Index":"3"},
            //{"Name":"최다오답 문제", "Value":"H", "CoreType":"E", "Index":"4"},
            {"Name":"고난도 문제", "Value":"S", "Index":"5"},
            ], "Value": "SC"},
        "LS":{"Name":"사회", "unitItems":[
            {"Name":"개념완성", "Value":"H", "CoreType":"", "Index":"0"},
            {"Name":"단원별 문제", "Value":"C", "Index":"1"},
            {"Name":"서술형 문제", "Value":"M", "CoreType":"", "Index":"2"},
            //{"Name":"최다빈출 문제", "Value":"H", "CoreType":"D", "Index":"3"},
            //{"Name":"최다오답 문제", "Value":"H", "CoreType":"E", "Index":"4"},
            ], "Value": "LS"},
        "HI":{"Name":"역사", "unitItems":[
            {"Name":"개념완성", "Value":"H", "CoreType":"", "Index":"0"},
            {"Name":"단원별 문제", "Value":"C", "Index":"1"},
            {"Name":"서술형 문제", "Value":"M", "CoreType":"", "Index":"2"},
            //{"Name":"최다빈출 문제", "Value":"H", "CoreType":"D", "Index":"3"},
            //{"Name":"최다오답 문제", "Value":"H", "CoreType":"E", "Index":"4"},
            ], "Value": "HI"},
        "ET":{"Name":"도덕", "unitItems":[
            {"Name":"개념완성", "Value":"H", "CoreType":"", "Index":"0"},
            {"Name":"단원별 문제", "Value":"C", "Index":"1"},
			{"Name":"서술형 문제", "Value":"M", "CoreType":"", "Index":"2"},
            //{"Name":"최다빈출 문제", "Value":"H", "CoreType":"D", "Index":"3"},
            //{"Name":"최다오답 문제", "Value":"H", "CoreType":"E", "Index":"4"},
            ], "Value": "ET"},
        "TH":{"Name":"기술가정", "unitItems":[
            {"Name":"개념완성", "Value":"H", "CoreType":"", "Index":"0"},
            {"Name":"단원별 문제", "Value":"C", "Index":"1"},
			{"Name":"서술형 문제", "Value":"M", "CoreType":"", "Index":"2"},
            //{"Name":"최다빈출 문제", "Value":"H", "CoreType":"D", "Index":"3"},
            //{"Name":"최다오답 문제", "Value":"H", "CoreType":"E", "Index":"4"},
            ], "Value": "TH"},
        "CH":{"Name":"한문", "unitItems":[
            {"Name":"개념완성", "Value":"H", "Index":"0"},
            {"Name":"단원별 문제", "Value":"C", "Index":"1"},
            ], "Value": "CH"},
    },
    "M3":{
        "KR":{"Name":"국어", "unitItems":[
            // {"Name":"개념완성", "Value":"H", "CoreType":"S"},
            {"Name":"개념완성", "Value":"H", "Index":"0"},
            {"Name":"단원별 문제", "Value":"C", "Index":"1"},
            {"Name":"서술형 문제", "Value":"M", "CoreType":"", "Index":"2"},
            //{"Name":"최다빈출 문제", "Value":"H", "CoreType":"D", "Index":"3"},
            //{"Name":"최다오답 문제", "Value":"H", "CoreType":"E", "Index":"4"},
            {"Name":"고난도 문제", "Value":"S", "Index":"5"},
            //{"Name":"국어작품별 문제", "Value":"K", "CoreType":"P1", "Index":"6"},
            //{"Name":"국어문법 연습", "Value":"K", "CoreType":"O7", "Index":"7"},
			{"Name":"갈래별 문학(PRO)", "Value":"P", "CoreType":"D1", "Index":"8", "gubun":"PRO", "url":"/M/Pro/?gubun=5"},
			{"Name":"국어 문법(PRO)", "Value":"P", "CoreType":"A1", "Index":"9", "gubun":"PRO", "url":"/M/Pro/?gubun=6"}
            ], "Value": "KR"},
        "EG":{"Name":"영어", "unitItems":[
            {"Name":"개념완성", "Value":"H", "CoreType":"", "Index":"0"},
            {"Name":"단원별 문제", "Value":"C", "Index":"1"},
            {"Name":"서술형 문제", "Value":"M", "CoreType":"", "Index":"2"},
            //{"Name":"최다빈출 문제", "Value":"H", "CoreType":"D", "Index":"3"},
            //{"Name":"최다오답 문제", "Value":"H", "CoreType":"E", "Index":"4"},
            {"Name":"영어문법 문제  (출판사별)", "Value":"H", "CoreType":"T", "Index":"5"},
            //{"Name":"영문법", "Value":"S", "CoreType": "G", "Index":"6"},
			{"Name":"영문법(PRO)", "Value":"K", "CoreType": "C", "Index":"7", "gubun":"PRO", "url":"/M/Pro/?gubun=3"},
			{"Name":"구문독해(PRO)", "Value":"P", "CoreType": "E1", "Index":"8", "gubun":"PRO", "url":"/M/Pro/?gubun=4"},
            ], "Value": "EG"},
        "MT":{"Name":"수학", "unitItems":[
            {"Name":"개념완성", "Value":"H", "CoreType":"", "Index":"0"},
            {"Name":"단원별 문제", "Value":"C", "Index":"1"},
            {"Name":"서술형 문제", "Value":"M", "CoreType":"", "Index":"2"},
            //{"Name":"최다빈출 문제", "Value":"H", "CoreType":"D", "Index":"3"},
            //{"Name":"최다오답 문제", "Value":"H", "CoreType":"E", "Index":"4"},
            {"Name":"고난도 문제", "Value":"S", "Index":"5"},
            {"Name":"수학 유형별 문제", "Value":"K", "CoreType":"M", "Index":"6"},
            {"Name":"수학 계산력 문제", "Value":"K", "CoreType":"B1", "Index":"7"},
			//{"Name":"수학 교과서 변형", "Value":"K", "CoreType":"F", "Index":"8"}
			{"Name":"수학 단계별 학습관(PRO)", "Value":"P", "CoreType":"B1", "Index":"9", "gubun":"PRO", "url":"/M/Pro/?gubun=1"},
			{"Name":"수학 교과서 변형(PRO)", "Value":"P", "CoreType":"C1", "Index":"10", "gubun":"PRO", "url":"/M/Pro/?gubun=2"}
            ], "Value": "MT"},
        "SC":{"Name":"과학", "unitItems":[
            {"Name":"개념완성", "Value":"H", "CoreType":"", "Index":"0"},
            {"Name":"단원별 문제", "Value":"C", "Index":"1"},
            {"Name":"서술형 문제", "Value":"M", "CoreType":"", "Index":"2"},
            //{"Name":"최다빈출 문제", "Value":"H", "CoreType":"D", "Index":"3"},
            //{"Name":"최다오답 문제", "Value":"H", "CoreType":"E", "Index":"4"},
            {"Name":"고난도 문제", "Value":"S", "Index":"5"},
            ], "Value": "SC"},
        "LS":{"Name":"사회", "unitItems":[
            {"Name":"개념완성", "Value":"H", "CoreType":"", "Index":"0"},
            {"Name":"단원별 문제", "Value":"C", "Index":"1"},
            {"Name":"서술형 문제", "Value":"M", "CoreType":"", "Index":"2"},
            //{"Name":"최다빈출 문제", "Value":"H", "CoreType":"D", "Index":"3"},
            //{"Name":"최다오답 문제", "Value":"H", "CoreType":"E", "Index":"4"},
            ], "Value": "LS"},
        "HI":{"Name":"역사", "unitItems":[
            {"Name":"개념완성", "Value":"H", "CoreType":"", "Index":"0"},
            {"Name":"단원별 문제", "Value":"C", "Index":"1"},
            {"Name":"서술형 문제", "Value":"M", "CoreType":"", "Index":"2"},
            //{"Name":"최다빈출 문제", "Value":"H", "CoreType":"D", "Index":"3"},
            //{"Name":"최다오답 문제", "Value":"H", "CoreType": "E", "Index":"4"},
            ], "Value": "HI"},
        "ET":{"Name":"도덕", "unitItems":[
            {"Name":"개념완성", "Value":"H", "CoreType":"", "Index":"0"},
            {"Name":"단원별 문제", "Value":"C", "Index":"1"},
			{"Name":"서술형 문제", "Value":"M", "CoreType":"", "Index":"2"},
            //{"Name":"최다빈출 문제", "Value":"H", "CoreType":"D", "Index":"3"},
            //{"Name":"최다오답 문제", "Value":"H", "CoreType":"E", "Index":"4"},
            ], "Value": "ET"},
        "TH":{"Name":"기술가정", "unitItems":[
            {"Name":"개념완성", "Value":"H", "CoreType":"", "Index":"0"},
            {"Name":"단원별 문제", "Value":"C", "Index":"1"},
			{"Name":"서술형 문제", "Value":"M", "CoreType":"", "Index":"2"},
            //{"Name":"최다빈출 문제", "Value":"H", "CoreType":"D", "Index":"3"},
            //{"Name":"최다오답 문제", "Value":"H", "CoreType":"E", "Index":"4"},
            ], "Value": "TH"},
        "CH":{"Name":"한문", "unitItems":[
            {"Name":"개념완성", "Value":"H", "Index":"0"},
            {"Name":"단원별 문제", "Value":"C", "Index":"1"},
            ], "Value": "CH"},
    },
    "H1":{
        "KR":{"Name":"국어", "unitItems":[
            {"Name":"개념완성", "Value":"H", "CoreType":"", "Index":"0"},
            {"Name":"단원별 문제", "Value":"C", "Index":"1"},
            {"Name":"서술형 문제", "Value":"M", "CoreType":"", "Index":"2"},
            //{"Name":"최다빈출 문제", "Value":"H", "CoreType":"D", "Index":"3"},
            //{"Name":"최다오답 문제", "Value":"H", "CoreType":"E", "Index":"4"},
            {"Name":"고난도 문제", "Value":"S", "Index":"5"}, // 맞는 값 : S , 기존 : K
            //{"Name":"시대별 문학", "Value":"K", "CoreType": "Q1", "Index":"6"}, // 맞는 값 : K
            {"Name":"시대별 문학(PRO)", "Value":"K", "CoreType": "Q1", "Index":"7", "gubun":"PRO", "url":"/H/Pro/?gubun=5"},
            {"Name":"국어 문법(PRO)", "Value":"P", "CoreType": "A1", "Index":"8", "gubun":"PRO", "url":"/H/Pro/?gubun=6"},
            ], "Value": "KR"},
        /*"KR2":{"Name":"국어 문법", "unitItems":[
            {"Name":"개념완성", "Value":"H", "CoreType": "", "Index":"0"},
            {"Name":"단원별 문제", "Value":"C", "Index":"1"},
            {"Name":"최다빈출 문제", "Value":"H", "CoreType": "D", "Index":"2"},
            {"Name":"최다오답 문제", "Value":"H", "CoreType": "E", "Index":"3"},
            {"Name":"고난도 문제", "Value":"S", "Index":"4"},
            //{"Name":"시대별 문학", "Value":"K", "CoreType": "Q1", "Index":"5"},
            {"Name":"시대별 문학(PRO)", "Value":"K", "CoreType": "Q1", "Index":"6", "gubun":"PRO", "url":"/H/Pro/?gubun=5"},
            {"Name":"국어 문법(PRO)", "Value":"P", "CoreType": "A1", "Index":"7", "gubun":"PRO", "url":"/H/Pro/?gubun=6"},
            ], "Value": "KR"},*/
        "EG":{"Name":"영어", "unitItems":[
            {"Name":"개념완성", "Value":"H", "CoreType":"", "Index":"0"},
            {"Name":"단원별 문제", "Value":"C", "Index":"1"},
            {"Name":"서술형 문제", "Value":"M", "CoreType":"", "Index":"2"},
            //{"Name":"최다빈출 문제", "Value":"H", "CoreType":"D", "Index":"3"},
            //{"Name":"최다오답 문제", "Value":"H", "CoreType":"E", "Index":"4"},
            {"Name":"영어문법 문제", "Value":"H", "CoreType":"T", "Index":"5"},
            //{"Name":"영문법", "Value":"S", "CoreType": "G", "Index":"6"},
			{"Name":"영문법(PRO)", "Value":"K", "CoreType": "C", "Index":"7", "gubun":"PRO", "url":"/H/Pro/?gubun=3"},
			{"Name":"구문독해(PRO)", "Value":"P", "CoreType": "E1", "Index":"8", "gubun":"PRO", "url":"/H/Pro/?gubun=4"},
            ], "Value": "EG"},
        "MT":{"Name":"수학", "unitItems":[
            {"Name":"개념완성", "Value":"H", "CoreType":"", "Index":"0"},
            {"Name":"단원별 문제", "Value":"C", "Index":"1"},
            {"Name":"서술형 문제", "Value":"M", "CoreType":"", "Index":"2"},
            //{"Name":"최다빈출 문제", "Value":"H", "CoreType":"D", "Index":"3"},
            //{"Name":"최다오답 문제", "Value":"H", "CoreType":"E", "Index":"4"},
            {"Name":"고난도 문제", "Value":"S", "Index":"5"},
            {"Name":"수학 유형별 문제", "Value":"H", "CoreType":"C", "Index":"6"}, // 기존 P1
            {"Name":"수학 계산력 문제", "Value":"K", "CoreType":"B1", "Index":"7"}, // CoreType : 기존 O7
			//{"Name":"수학 교과서 변형", "Value":"K", "CoreType":"F", "Index":"8"},
			{"Name":"수학 단계별 학습관(PRO)", "Value":"P", "CoreType":"B1", "Index":"9", "gubun":"PRO", "url":"/H/Pro/?gubun=1"},
			{"Name":"수학 교과서 변형(PRO)", "Value":"P", "CoreType":"C1", "Index":"10", "gubun":"PRO", "url":"/H/Pro/?gubun=2"},
            ], "Value": "MT"},
        "SC":{"Name":"통합과학", "unitItems":[
            {"Name":"개념완성", "Value":"H", "CoreType":"", "Index":"0"},
            {"Name":"단원별 문제", "Value":"C", "Index":"1"},
            {"Name":"서술형 문제", "Value":"M", "CoreType":"", "Index":"2"},
            //{"Name":"최다빈출 문제", "Value":"H", "CoreType":"D", "Index":"3"},
            //{"Name":"최다오답 문제", "Value":"H", "CoreType":"E", "Index":"4"},
            {"Name":"고난도 문제", "Value":"S", "Index":"5"},
            ], "Value": "SC"},

		"SC2":{"Name":"과학탐구실험", "unitItems":[
            {"Name":"개념완성", "Value":"H", "CoreType":"", "Index":"0"},
            {"Name":"", "Value":"", "Index":"1"},
            ], "Value": "SC"},

        "LS":{"Name":"통합사회", "unitItems":[
            {"Name":"개념완성", "Value":"H", "CoreType":"", "Index":"0"},
            {"Name":"단원별 문제", "Value":"C", "Index":"1"},
            {"Name":"서술형 문제", "Value":"M", "CoreType":"", "Index":"2"},
            //{"Name":"최다빈출 문제", "Value":"H", "CoreType":"D", "Index":"3"},
            //{"Name":"최다오답 문제", "Value":"H", "CoreType":"E", "Index":"4"},
            ], "Value": "LS"},
        "HI":{"Name":"한국사", "unitItems":[
            {"Name":"개념완성", "Value":"H", "CoreType":"", "Index":"0"},
            {"Name":"단원별 문제", "Value":"C", "Index":"1"},
            {"Name":"서술형 문제", "Value":"M", "CoreType":"", "Index":"2"},
			//{"Name":"최다빈출 문제", "Value":"H", "CoreType":"D", "Index":"3"},
            //{"Name":"최다오답 문제", "Value":"H", "CoreType":"E", "Index":"4"},
            ], "Value": "HI"},
		"TH":{"Name":"기술가정", "unitItems":[
			{"Name":"개념완성", "Value":"H", "CoreType":"", "Index":"0"},
			{"Name":"단원별 문제", "Value":"C", "Index":"1"},
            {"Name":"서술형 문제", "Value":"M", "CoreType":"", "Index":"2"},
			//{"Name":"최다빈출 문제", "Value":"H", "CoreType":"D", "Index":"3"},
            //{"Name":"최다오답 문제", "Value":"H", "CoreType":"E", "Index":"4"},
            ], "Value": "TH"},
    },
    "H2":{
        "KR1":{"Name":"문학", "unitItems":[
            {"Name":"개념완성", "Value":"H", "CoreType":"", "Index":"0"},
            {"Name":"단원별 문제", "Value":"C", "Index":"1"},
            {"Name":"서술형 문제", "Value":"M", "CoreType":"", "Index":"2"},
			//{"Name":"최다빈출 문제", "Value":"H", "CoreType":"D", "Index":"3"},
            //{"Name":"최다오답 문제", "Value":"H", "CoreType":"E", "Index":"4"},
            {"Name":"고난도 문제", "Value":"S", "Index":"5"},
            //{"Name":"시대별 문학", "Value":"K", "CoreType": "Q1", "Index":"6"},
            {"Name":"시대별 문학(PRO)", "Value":"K", "CoreType": "Q1", "Index":"7", "gubun":"PRO", "url":"/H/Pro/?gubun=5"},
            {"Name":"국어 문법(PRO)", "Value":"P", "CoreType": "A1", "Index":"8", "gubun":"PRO", "url":"/H/Pro/?gubun=6"},
            ], "Value": "KR",
            "subDetail" : [
                {
                    "Name" : "문학",
                    "Value": "문학",
                },
                {
                    "Name" : "독서",
                    "Value": "독서",
                },
                {
                    "Name" : "언어와 매체",
                    "Value": "언어와 매체",
                }
            ]
        },
        "KR3":{"Name":"독서", "unitItems":[
            {"Name":"개념완성", "Value":"H", "CoreType":"", "Index":"0"},
            {"Name":"단원별 문제", "Value":"C", "Index":"1"},
            {"Name":"서술형 문제", "Value":"M", "CoreType":"", "Index":"2"},
			//{"Name":"최다빈출 문제", "Value":"H", "CoreType": "D", "Index":"3"},
            //{"Name":"최다오답 문제", "Value":"H", "CoreType": "E", "Index":"4"},
            {"Name":"고난도 문제", "Value":"S", "Index":"5"},
            //{"Name":"시대별 문학", "Value":"K", "CoreType": "Q1", "Index":"6"},
            {"Name":"시대별 문학(PRO)", "Value":"K", "CoreType": "Q1", "Index":"7", "gubun":"PRO", "url":"/H/Pro/?gubun=5"},
            {"Name":"국어 문법(PRO)", "Value":"P", "CoreType": "A1", "Index":"8", "gubun":"PRO", "url":"/H/Pro/?gubun=6"},
            ], "Value": "KR",
            "subDetail" : [
                {
                    "Name" : "문학",
                    "Value": "문학",
                },
                {
                    "Name" : "독서",
                    "Value": "독서",
                },
                {
                    "Name" : "언어와 매체",
                    "Value": "언어와 매체",
                }
            ]
        },
        "KR4":{"Name":"언어와 매체", "unitItems":[
            {"Name":"개념완성", "Value":"H", "CoreType":"", "Index":"0"},
            {"Name":"단원별 문제", "Value":"C", "Index":"1"},
            {"Name":"서술형 문제", "Value":"M", "CoreType":"", "Index":"2"},
			//{"Name":"최다빈출 문제", "Value":"H", "CoreType": "D", "Index":"3"},
            //{"Name":"최다오답 문제", "Value":"H", "CoreType": "E", "Index":"4"},
            {"Name":"고난도 문제", "Value":"S", "Index":"5"},
            //{"Name":"시대별 문학", "Value":"K", "CoreType": "Q1", "Index":"6"},
            {"Name":"시대별 문학(PRO)", "Value":"K", "CoreType": "Q1", "Index":"7", "gubun":"PRO", "url":"/H/Pro/?gubun=5"},
            {"Name":"국어 문법(PRO)", "Value":"P", "CoreType": "A1", "Index":"8", "gubun":"PRO", "url":"/H/Pro/?gubun=6"},
            ], "Value": "KR",
            "subDetail" : [
                {
                    "Name" : "문학",
                    "Value": "문학",
                },
                {
                    "Name" : "독서",
                    "Value": "독서",
                },
                {
                    "Name" : "언어와 매체",
                    "Value": "언어와 매체",
                }
            ]
        },
        /*"KR2":{"Name":"국어 문법", "unitItems":[
            {"Name":"개념완성", "Value":"H", "CoreType": "", "Index":"0"},
            {"Name":"단원별 문제", "Value":"C", "Index":"1"},
            {"Name":"최다빈출 문제", "Value":"H", "CoreType": "D", "Index":"2"},
            {"Name":"최다오답 문제", "Value":"H", "CoreType": "E", "Index":"3"},
            {"Name":"고난도 문제", "Value":"S", "Index":"4"},
            //{"Name":"시대별 문학", "Value":"K", "CoreType": "Q1", "Index":"5"},
            {"Name":"시대별 문학(PRO)", "Value":"K", "CoreType": "Q1", "Index":"6", "gubun":"PRO", "url":"/H/Pro/?gubun=5"},
            {"Name":"국어 문법(PRO)", "Value":"P", "CoreType": "A1", "Index":"7", "gubun":"PRO", "url":"/H/Pro/?gubun=6"},
            ], "Value": "KR"},*/
        "EG1":{"Name":"영어Ⅰ", "unitItems":[
            {"Name":"개념완성", "Value":"H", "CoreType":"", "Index":"0"},
            {"Name":"단원별 문제", "Value":"C", "Index":"1"},
            {"Name":"서술형 문제", "Value":"M", "CoreType":"", "Index":"2"},
            //{"Name":"최다빈출 문제", "Value":"H", "CoreType": "D", "Index":"3"},
            //{"Name":"최다오답 문제", "Value":"H", "CoreType": "E", "Index":"4"},
            {"Name":"영어문법 문제(출판사별)", "Value":"H", "CoreType":"T", "Index":"5"},
            //{"Name":"영문법", "Value":"S", "CoreType": "G", "Index":"6"},
			{"Name":"영문법(PRO)", "Value":"K", "CoreType": "C", "Index":"7", "gubun":"PRO", "url":"/H/Pro/?gubun=3"},
			{"Name":"구문독해(PRO)", "Value":"P", "CoreType": "E1", "Index":"8", "gubun":"PRO", "url":"/H/Pro/?gubun=4"},
            ], "Value": "EG",
            "subDetail" : [
                {
                    "Name" : "영어Ⅰ",
                    "Value": "영어Ⅰ",
                },
                {
                    "Name" : "영어Ⅱ",
                    "Value": "영어Ⅱ",
                },
                {
                    "Name" : "영어 독해와 작문",
                    "Value": "영어 독해와 작문",
                },
				{
                    "Name" : "영어권 문화",
                    "Value": "영어권 문화",
                }
            ]
        },
        "EG2":{"Name":"영어Ⅱ", "unitItems":[
            {"Name":"개념완성", "Value":"H", "CoreType":"", "Index":"0"},
            {"Name":"단원별 문제", "Value":"C", "Index":"1"},
            {"Name":"서술형 문제", "Value":"M", "CoreType":"", "Index":"2"},
			//{"Name":"최다빈출 문제", "Value":"H", "CoreType": "D", "Index":"3"},
            //{"Name":"최다오답 문제", "Value":"H", "CoreType": "E", "Index":"4"},
            {"Name":"영어문법 문제(출판사별)", "Value":"H", "CoreType":"T", "Index":"5"},
            //{"Name":"영문법", "Value":"S", "CoreType": "G", "Index":"6"},
			{"Name":"영문법(PRO)", "Value":"K", "CoreType": "C", "Index":"7", "gubun":"PRO", "url":"/H/Pro/?gubun=3"},
			{"Name":"구문독해(PRO)", "Value":"P", "CoreType": "E1", "Index":"8", "gubun":"PRO", "url":"/H/Pro/?gubun=4"},
            ], "Value": "EG",
            "subDetail" : [
                {
                    "Name" : "영어Ⅰ",
                    "Value": "영어Ⅰ",
                },
                {
                    "Name" : "영어Ⅱ",
                    "Value": "영어Ⅱ",
                },
                {
                    "Name" : "영어 독해와 작문",
                    "Value": "영어 독해와 작문",
                },
				{
                    "Name" : "영어권 문화",
                    "Value": "영어권 문화",
                }
            ]
        },
        "EG3":{"Name":"영어 독해와 작문", "unitItems":[
            {"Name":"개념완성", "Value":"H", "CoreType":"", "Index":"0"},
            {"Name":"단원별 문제", "Value":"C", "Index":"1"},
            {"Name":"서술형 문제", "Value":"M", "CoreType":"", "Index":"2"},
			//{"Name":"최다빈출 문제", "Value":"H", "CoreType": "D", "Index":"3"},
            //{"Name":"최다오답 문제", "Value":"H", "CoreType": "E", "Index":"4"},
            {"Name":"영어문법 문제(출판사별)", "Value":"H", "CoreType":"T", "Index":"5"},
            //{"Name":"영문법", "Value":"S", "CoreType": "G", "Index":"6"},
			{"Name":"영문법(PRO)", "Value":"K", "CoreType": "C", "Index":"7", "gubun":"PRO", "url":"/H/Pro/?gubun=3"},
			{"Name":"구문독해(PRO)", "Value":"P", "CoreType": "E1", "Index":"8", "gubun":"PRO", "url":"/H/Pro/?gubun=4"},
            ], "Value": "EG",
            "subDetail" : [
                {
                    "Name" : "영어Ⅰ",
                    "Value": "영어Ⅰ",
                },
                {
                    "Name" : "영어Ⅱ",
                    "Value": "영어Ⅱ",
                },
                {
                    "Name" : "영어 독해와 작문",
                    "Value": "영어 독해와 작문",
                },
				{
                    "Name" : "영어권 문화",
                    "Value": "영어권 문화",
                }
            ]
        },
		 "EG4":{"Name":"영어권 문화", "unitItems":[
            {"Name":"개념완성", "Value":"H", "CoreType":"", "Index":"0"},
            {"Name":"단원별 문제", "Value":"C", "Index":"1"},
			{"Name":"서술형 문제", "Value":"M", "CoreType":"", "Index":"2"},
			//{"Name":"최다빈출 문제", "Value":"H", "CoreType": "D", "Index":"3"},
            //{"Name":"최다오답 문제", "Value":"H", "CoreType": "E", "Index":"4"},
            {"Name":"영어문법 문제(출판사별)", "Value":"H", "CoreType":"T", "Index":"5"},
			//{"Name":"영문법", "Value":"S", "CoreType": "G", "Index":"6"},
			{"Name":"영문법(PRO)", "Value":"K", "CoreType": "C", "Index":"7", "gubun":"PRO", "url":"/H/Pro/?gubun=3"},
			{"Name":"구문독해(PRO)", "Value":"P", "CoreType": "E1", "Index":"8", "gubun":"PRO", "url":"/H/Pro/?gubun=4"},
            ], "Value": "EG",
            "subDetail" : [
                {
                    "Name" : "영어Ⅰ",
                    "Value": "영어Ⅰ",
                },
                {
                    "Name" : "영어Ⅱ",
                    "Value": "영어Ⅱ",
                },
                {
                    "Name" : "영어 독해와 작문",
                    "Value": "영어 독해와 작문",
                },
				{
                    "Name" : "영어권 문화",
                    "Value": "영어권 문화",
                }
            ]
        },
        "MT":{"Name":"수학 영역", "unitItems":[
            {"Name":"개념완성", "Value":"H", "CoreType":"", "Index":"0"},
            {"Name":"단원별 문제", "Value":"C", "Index":"1"},
            {"Name":"서술형 문제", "Value":"M", "CoreType":"", "Index":"2"},
            //{"Name":"최다빈출 문제", "Value":"H", "CoreType":"D", "Index":"3"},
            //{"Name":"최다오답 문제", "Value":"H", "CoreType":"E", "Index":"4"},
            {"Name":"고난도 문제", "Value":"S", "Index":"5"},
            {"Name":"수학 유형별 문제", "Value":"H", "CoreType":"C", "Index":"6"},
            {"Name":"수학 계산력 문제", "Value":"K", "CoreType":"B1", "Index":"7"},
			//{"Name":"수학 교과서 변형", "Value":"K", "CoreType":"F", "Index":"8"},
			{"Name":"수학 단계별 학습관(PRO)", "Value":"P", "CoreType":"B1", "Index":"9", "gubun":"PRO", "url":"/H/Pro/?gubun=1"},
			{"Name":"수학 교과서 변형(PRO)", "Value":"P", "CoreType":"C1", "Index":"10", "gubun":"PRO", "url":"/H/Pro/?gubun=2"},
            ], "Value": "MT",
            "subDetail" : [
                {
                    "Name" : "수학Ⅰ",
                    "Value": "수학Ⅰ",
                },
                {
                    "Name" : "수학Ⅱ",
                    "Value": "수학Ⅱ",
                },
                {
                    "Name" : "확률과 통계",
                    "Value": "확률과 통계",
                },
                {
                    "Name" : "미적분",
                    "Value": "미적분",
                },
                {
                    "Name" : "기하",
                    "Value": "기하",
                }
            ]
        },
        "SC":{"Name":"과학 영역", "unitItems":[
            {"Name":"개념완성", "Value":"H", "CoreType":"", "Index":"0"},
            {"Name":"단원별 문제", "Value":"C", "Index":"1"},
            {"Name":"서술형 문제", "Value":"M", "CoreType":"", "Index":"2"},
            //{"Name":"최다빈출 문제", "Value":"H", "CoreType":"D", "Index":"3"},
            //{"Name":"최다오답 문제", "Value":"H", "CoreType":"E", "Index":"4"},
            {"Name":"고난도 문제", "Value":"S", "Index":"5"},
            ], "Value": "SC",
            "subDetail" : [
                {
                    "Name" : "물리학Ⅰ",
                    "Value": "물리학Ⅰ",
                },
                {
                    "Name" : "생명과학Ⅰ",
                    "Value": "생명과학Ⅰ",
                },
                {
                    "Name" : "지구과학Ⅰ",
                    "Value": "지구과학Ⅰ",
                },
                {
                    "Name" : "화학Ⅰ",
                    "Value": "화학Ⅰ",
                },
                {
                    "Name" : "물리학Ⅱ",
                    "Value": "물리학Ⅱ",
                },
                {
                    "Name" : "생명과학Ⅱ",
                    "Value": "생명과학Ⅱ",
                },
                {
                    "Name" : "지구과학Ⅱ",
                    "Value": "지구과학Ⅱ",
                },
                {
                    "Name" : "화학Ⅱ",
                    "Value": "화학Ⅱ",
                },
            ]
        },
        "LS":{"Name":"사회 영역", "unitItems":[
            {"Name":"개념완성", "Value":"H", "CoreType":"", "Index":"0"},
            {"Name":"단원별 문제", "Value":"C", "Index":"1"},
            {"Name":"서술형 문제", "Value":"M", "CoreType":"", "Index":"2"},
            //{"Name":"최다빈출 문제", "Value":"H", "CoreType":"D", "Index":"3"},
            //{"Name":"최다오답 문제", "Value":"H", "CoreType":"E", "Index":"4"},
            ], "Value": "LS",
            "subDetail" : [
                {
                    "Name" : "사회문화",
                    "Value": "사회문화",
                },
                {
                    "Name" : "한국지리",
                    "Value": "한국지리",
                },
                {
                    "Name" : "정치와 법",
                    "Value": "정치와 법",
                },
                {
                    "Name" : "세계사",
                    "Value": "세계사",
                },
                {
                    "Name" : "윤리와 사상",
                    "Value": "윤리와 사상",
                },
                {
                    "Name" : "생활과 윤리",
                    "Value": "생활과 윤리",
                },
                {
                    "Name" : "경제",
                    "Value": "경제",
                },
                {
                    "Name" : "동아시아사",
                    "Value": "동아시아사",
                },
                {
                    "Name" : "세계지리",
                    "Value": "세계지리",
                },
            ]},
        "HI":{"Name":"한국사", "unitItems":[
            {"Name":"개념완성", "Value":"H", "CoreType":"", "Index":"0"},
            {"Name":"단원별 문제", "Value":"C", "Index":"1"},
            {"Name":"서술형 문제", "Value":"M", "CoreType":"", "Index":"2"},
            //{"Name":"최다빈출 문제", "Value":"H", "CoreType":"D", "Index":"3"},
            //{"Name":"최다오답 문제", "Value":"H", "CoreType":"E", "Index":"4"},
            ], "Value": "HI"},
		"TH":{"Name":"기술가정", "unitItems":[
			{"Name":"개념완성", "Value":"H", "CoreType":"", "Index":"0"},
            {"Name":"단원별 문제", "Value":"C", "Index":"1"},
            {"Name":"서술형 문제", "Value":"M", "CoreType":"", "Index":"2"},
			//{"Name":"최다빈출 문제", "Value":"H", "CoreType":"D", "Index":"3"},
            //{"Name":"최다오답 문제", "Value":"H", "CoreType":"E", "Index":"4"},
            ], "Value": "TH"},
            /*
        "KR2":{"Name":"국어문법", "unitItems":[
            {"Name":"개념완성", "Value":"V"},
            {"Name":"단원별 문제", "Value":"C"},
            {"Name":"최다빈출 문제", "Value":"D"},
            {"Name":"최다오답 문제", "Value":"E"},
            {"Name":"고난도 문제", "Value":"F"},
            {"Name":"시대별 문학", "Value":"S"},
            ]},
            */
    },
    "H3":{
        "KR":{"Name":"국어 문법", "unitItems":[
            {"Name":"개념완성", "Value":"H", "CoreType":"", "Index":"0"},
            // {"Name":"서술형 문제", "Value":"M", "CoreType":""},
            //{"Name":"최다빈출 문제", "Value":"H", "CoreType":"D", "Index":"1"},
            //{"Name":"최다오답 문제", "Value":"H", "CoreType":"E", "Index":"2"},
            {"Name":"고난도 문제", "Value":"S", "Index":"3"}, // 기존 :S
            {"Name":"시대별 문학", "Value":"K", "CoreType":"Q1", "Index":"4"},
            ], "Value": "KR",
            "subDetail" : [
                {
                    "Name" : "문학",
                    "Value": "문학",
                },
                {
                    "Name" : "독서",
                    "Value": "독서",
                },
                {
                    "Name" : "언어와 매체",
                    "Value": "언어와 매체",
                }
            ]
        },
		"KR1":{"Name":"문학", "unitItems":[
            {"Name":"개념완성", "Value":"H", "CoreType":"", "Index":"0"},
            {"Name":"단원별 문제", "Value":"C", "Index":"1"},
            {"Name":"서술형 문제", "Value":"M", "CoreType":"", "Index":"2"},
			//{"Name":"최다빈출 문제", "Value":"H", "CoreType":"D", "Index":"3"},
            //{"Name":"최다오답 문제", "Value":"H", "CoreType":"E", "Index":"4"},
            {"Name":"고난도 문제", "Value":"S", "Index":"5"},
            {"Name":"시대별 문학", "Value":"K", "CoreType": "Q1", "Index":"6"},
            ], "Value": "KR",
            "subDetail" : [
                {
                    "Name" : "문학",
                    "Value": "문학",
                },
                {
                    "Name" : "독서",
                    "Value": "독서",
                },
                {
                    "Name" : "언어와 매체",
                    "Value": "언어와 매체",
                }
            ]
        },
		 "EG1":{"Name":"영어", "Value": "EG",
             "subDetail" : [
                 {
                     "Name" : "영어Ⅰ",
                     "Value": "영어Ⅰ",
                 },
                 {
                     "Name" : "영어Ⅱ",
                     "Value": "영어Ⅱ",
                 },
                 {
                     "Name" : "영어 독해와 작문",
                     "Value": "영어 독해와 작문",
                 },
				 {
                    "Name" : "영어권 문화",
                    "Value": "영어권 문화",
                 }
             ]
         },
        // "EG":{"Name":"영어", "unitItems":[
        //     {"Name":"개념완성", "Value":"H", "CoreType":""},
        //     // {"Name":"단원별 문제", "Value":"C"},
        //     {"Name":"서술형 문제", "Value":"M", "CoreType":""},
        //     {"Name":"최다빈출 문제", "Value":"H", "CoreType":"D"},
        //     {"Name":"최다오답 문제", "Value":"H", "CoreType":"E"},
        //     {"Name":"영어문법 문제", "Value":"H", "CoreType":"T"},
        //     {"Name":"고등 영문법", "Value":"K", "CoreType": "C1"},
        //     ], "Value": "EG",
        //     "subDetail" : [
        //         {
        //             "Name" : "영어Ⅰ",
        //             "Value": "영어Ⅰ",
        //         },
        //         {
        //             "Name" : "영어Ⅱ",
        //             "Value": "영어Ⅱ",
        //         },
        //         {
        //             "Name" : "영어 독해와 작문",
        //             "Value": "영어 독해와 작문",
        //         }
        //     ]
        // },
        "MT":{"Name":"수학 영역", "unitItems":[
            {"Name":"개념완성", "Value":"H", "CoreType":"", "Index":"0"},
            // {"Name":"단원별 문제", "Value":"C"},
            {"Name":"서술형 문제", "Value":"M", "CoreType":"", "Index":"1"},
            //{"Name":"최다빈출 문제", "Value":"H", "CoreType":"D", "Index":"2"},
            //{"Name":"최다오답 문제", "Value":"H", "CoreType":"E", "Index":"3"},
            {"Name":"고난도 문제", "Value":"S", "Index":"4"},  // 기존 : S
            // {"Name":"수학 유형별 문제", "Value":"H", "CoreType":"C"},
            // {"Name":"수학 계산력 문제", "Value":"K", "CoreType":"B1"},
            ], "Value": "MT",
            "subDetail" : [
                {
                    "Name" : "수학Ⅰ",
                    "Value": "수학Ⅰ",
                },
                {
                    "Name" : "수학Ⅱ",
                    "Value": "수학Ⅱ",
                },
                {
                    "Name" : "확률과 통계",
                    "Value": "확률과 통계",
                },
                {
                    "Name" : "미적분",
                    "Value": "미적분",
                },
                {
                    "Name" : "기하",
                    "Value": "기하",
                }
            ]},
        "SC":{"Name":"과학 영역", "unitItems":[
            {"Name":"개념완성", "Value":"H", "CoreType":"", "Index":"0"},
            // {"Name":"단원별 문제", "Value":"C"},
            {"Name":"서술형 문제", "Value":"M", "CoreType":"", "Index":"1"},
            //{"Name":"최다빈출 문제", "Value":"H", "CoreType":"D", "Index":"2"},
            //{"Name":"최다오답 문제", "Value":"H", "CoreType":"E", "Index":"3"},
            {"Name":"고난도 문제", "Value":"S", "Index":"4"},
            ], "Value": "SC",
            "subDetail" : [
                {
                    "Name" : "물리학Ⅰ",
                    "Value": "물리학Ⅰ",
                },
                {
                    "Name" : "생명과학Ⅰ",
                    "Value": "생명과학Ⅰ",
                },
                {
                    "Name" : "지구과학Ⅰ",
                    "Value": "지구과학Ⅰ",
                },
                {
                    "Name" : "화학Ⅰ",
                    "Value": "화학Ⅰ",
                },
                {
                    "Name" : "물리학Ⅱ",
                    "Value": "물리학Ⅱ",
                },
                {
                    "Name" : "생명과학Ⅱ",
                    "Value": "생명과학Ⅱ",
                },
                {
                    "Name" : "지구과학Ⅱ",
                    "Value": "지구과학Ⅱ",
                },
                {
                    "Name" : "화학Ⅱ",
                    "Value": "화학Ⅱ",
                },
            ]},
        "LS":{"Name":"사회 영역", "unitItems":[
            {"Name":"개념완성", "Value":"H", "CoreType":"", "Index":"0"},
            // {"Name":"단원별 문제", "Value":"C"},
            {"Name":"서술형 문제", "Value":"M", "CoreType":"", "Index":"1"},
            //{"Name":"최다빈출 문제", "Value":"H", "CoreType":"D", "Index":"2"},
            //{"Name":"최다오답 문제", "Value":"H", "CoreType":"E", "Index":"3"},
            ], "Value": "LS",
            "subDetail" : [
                {
                    "Name" : "사회문화",
                    "Value": "사회문화",
                },
                {
                    "Name" : "한국지리",
                    "Value": "한국지리",
                },
                {
                    "Name" : "정치와 법",
                    "Value": "정치와 법",
                },
                {
                    "Name" : "세계사",
                    "Value": "세계사",
                },
                {
                    "Name" : "윤리와 사상",
                    "Value": "윤리와 사상",
                },
                {
                    "Name" : "생활과 윤리",
                    "Value": "생활과 윤리",
                },
                {
                    "Name" : "경제",
                    "Value": "경제",
                },
                {
                    "Name" : "동아시아사",
                    "Value": "동아시아사",
                },
                {
                    "Name" : "세계지리",
                    "Value": "세계지리",
                },
            ]},
        "HI":{"Name":"한국사", "unitItems":[
            {"Name":"개념완성", "Value":"H", "CoreType":"", "Index":"0"},
            // {"Name":"단원별 문제", "Value":"C"},
            {"Name":"서술형 문제", "Value":"M", "CoreType":"", "Index":"1"},
            //{"Name":"최다빈출 문제", "Value":"H", "CoreType":"D", "Index":"2"},
            //{"Name":"최다오답 문제", "Value":"H", "CoreType":"E", "Index":"3"},
            ], "Value": "HI"},
            /*
        "KR2":{"Name":"국어문법", "unitItems":[
            {"Name":"개념완성", "Value":"V"},
            {"Name":"단원별 문제", "Value":"C"},
            {"Name":"최다빈출 문제", "Value":"D"},
            {"Name":"최다오답 문제", "Value":"E"},
            {"Name":"고난도 문제", "Value":"F"},
            {"Name":"시대별 문학", "Value":"S"},
            ]},
            */
    },


    btnCount:0,
	
	//클릭한 다운로드 상품 가격 임시 input 생성(동영상 제외)(EDUMIG-3409)
	makeClickedProductPriceInput : function(item_price){
		var clickedProductPrice = $("#clickedProductPrice");
		var hiddenInputPrice = "<input type='hidden' id='clickedProductPrice' value='" + item_price + "' />";
		
		if (clickedProductPrice.length) {
			clickedProductPrice.val(item_price);
		} else {
			$("body").append(hiddenInputPrice);
			clickedProductPrice = $("#clickedProductPrice");
		}
	},

	//다운로드 버튼 상세 아이콘 셋팅_a태그안내용(EDUMIG-3409)
	drawButtonDetail : function(format_class, etc_class, inner_text){
		var make_detail = '<span class="renewal2024-btn-download-' + format_class + ' '+ etc_class +'"><span class="renewal2024-dwn-sbj">' + inner_text + '</span></span>';
		
		return make_detail
	},

	//다운로드 동영상 버튼 상세 아이콘 셋팅_a태그포함(EDUMIG-3409)
	drawVodButtonDetail : function(format_class, etc_class, inner_text){
		var make_detail = '<a href="javascript:void(0);" class="renewal2024-btn-download" data-src="vod_player" data-act="video_down"><span class="renewal2024-btn-download-' + format_class + '  '+ etc_class +'"><span class="renewal2024-dwn-sbj">' + inner_text + '</span></span></a>';
		return make_detail
	},

    // 다운로드 버튼 그리기
    drawPriceButtons:function(item_p, _callback) {
        var url_v = "/_api/member.api.asp";
        var data_v = "cmd=ISLOGIN";
        _Unit.btnCount = 0;
        comm.toggleLoading(true);
		comm.toggleLoading(true);
        comm.send(url_v, data_v, "post", function(json) {
            comm.toggleLoading(false);
            item_p["mem_id"] = json.mem_id;
            _Unit.renderPriceButtons(item_p, _callback);
        });
    },

     // 다운로드 버튼 만들기
    renderPriceButtons:function(item_p, _callback) {
        var item = util.keysToLowerCase(item_p);
        var format_i = item.formats || item.formats_i;		

        var url_p = "/_api/search.api.asp";
        var data_p = "cmd=GET_PAPER_PRICE&site_id=" + item.siteid;

        if(item.expapr_no) {
            data_p = data_p + "&ExPapr_No=" + item.expapr_no
        }

        if(item.expapr_group) {
            data_p = data_p + "&ExPapr_Group=" + item.expapr_group;
        }

        if(item.title) {
            data_p = data_p + "&ExPapr_title=" + item.title;
        }

        if(item.txcode) {
            data_p = data_p + "&TX_CODE=" + item.txcode;
        }

        if(format_i) {
            data_p = data_p + "&Exfl_Group=" + format_i;
        }

        if(item.coretype) {
            data_p = data_p + "&ExPapr_CoreType=" + item.coretype;
        }

		if(item.year){
			data_p = data_p + "&ExPapr_TestYear=" + item.year;
		}

        var pItem = item_p;
        var pRoot = pItem.pobject;

        var div2_o = document.createElement("div");
        div2_o.className = "detailLink renewal2024-detailLink";//다운로드 콘텐츠 아이콘 변경 요청 class명 추가(EDUMIG-3409)
        pRoot.appendChild(div2_o);

        var sul_o = document.createElement("ul");
        sul_o.className = "clearfix";
        div2_o.appendChild(sul_o);

        comm.toggleLoading(true);
        comm.send(url_p, data_p, "post", function(data){
            comm.toggleLoading(false);
            if(data) {
				var current_toggle = "C";
				if ($("div.header-mo-selector .header-selectd.active").attr("id") != undefined) {
					current_toggle = ($("div.header-mo-selector .header-selectd.active").attr("id").toUpperCase() == "BTN_TOGGLE_T") ? "T" : "C";
				}
				
                if(data.priceInfo) {
                    for(var p_i = 0; p_i < data.priceInfo.length; p_i++) {
                        comm.toggleLoading(true);
                        _Unit.btnCount = _Unit.btnCount + 1;
                    }

                    for(var p_i = 0; p_i < data.priceInfo.length; p_i++) {
                        var priceItem = data.priceInfo[p_i];
                        var formanName = "zip";

                        if(priceItem.format == "2") {
                            formatName = "pdf";
                        } else if(priceItem.format == "3") {
                            formatName = "scan";
                        } else if(priceItem.format == "4") {
                            formatName = "hwp";
                        } else if(priceItem.format == "96") {
                            formatName = "정답<br/>요청";
                        } else if(priceItem.format == "94") {
                            formatName = "문제풀이";
                        } else if(priceItem.format == "90") {
                            formatName = "개념영상";
                        } else if(priceItem.format == "89") {
                            formatName = "풀이영상";
                        } else if(priceItem.format == "88") {
                            formatName = "기출<br>분석";
                        } else if(priceItem.format == "33") {
                            formatName = "무료열람";
                        } else if(priceItem.format == "34") {
							formatName = "기출<br>유사";
						} else if(item.expapr_group == "K" && item.coretype == "T" && priceItem.format == "93") {		// 미리보기 중간고사 용
							pItem.formats = null;
                            pItem.price = priceItem.price;
                            pItem.format_i = priceItem.format;		// 91 ~ 93 들어가고
                            pItem.pobj = sul_o;

							var expapr_no = item.expapr_no;
							var siteid = item.siteid;
							var url_v = "/_api/search.api.asp";
							var data_v = "cmd=CONFIRM_BAROTEST&exPapr_No=" + expapr_no + "&SiteID=" + siteid
													+ "&Grade=" + item.grade + "&Subj_Code=" + item.subj_code;
							comm.toggleLoading(true);
							comm.send(url_v, data_v, "get", function(json) {
								// json : "{""isState"":""" & isState & """, ""baroState"":""" & baroState & """, ""BT_No"":""" & BT_No & """}"
								comm.toggleLoading(false);
								if(json) {
									var isState = json.isState;			// 0(or null):신규, 1:문제생성, 2:채점완료
									var baroState = json.baroState;		// Y:파일 다운, N:파일 다운 전
									var BT_No = json.BT_No;				// dbo.tb_BaroTestUser > bt_no 값

									formatName = "답안<br>제출";

									// 1) 평가 시험 버튼 선 생성 (priceItem.format = 93)
									var sli_o = _Unit.drawButton(formatName, pItem, -1, function(evo) {		// 버튼 클릭시 실행되는 _callback 함수
										if(isState == "2") {
											common.toast("이미 답안을 제출하셨습니다.\n결과분석지를 확인해 주세요.");
											comm.toggleLoading(false);
										} else {
											var url_v2 = "/_api/search.api.asp";
											var data_v2 = "cmd=CONFIRM_BAROTEST&exPapr_No=" + expapr_no + "&SiteID=" + siteid
														+ "&Grade=" + item.grade + "&Subj_Code=" + item.subj_code + "&BTS_FLAG=VirtualExam";

											comm.toggleLoading(true);
											comm.send(url_v2, data_v2, "post", function(json2) {
												comm.toggleLoading(false);
												if(json2) {
													var data2 = json2;

													data2["expapr_no"] = expapr_no;
													data2["BT_No"] = json2.BT_No;
													data2["SiteID"] = pItem.siteid;
													data2["Grade"] = pItem.grade;
													data2["Subj_Code"] = pItem.subj_code;

													data2["range"] = pItem.range;
													data2["pubname"] = pItem.pubname;
													data2["level"] = pItem.level;

													if(baroState == "Y") {
														if(typeof(_callback) == "function") _callback(data, data2);
													} else {
														common.toast("답안제출은 자료 다운로드 후 이용 가능합니다.");
														comm.toggleLoading(false);
													}
												}
											});
										}
									});

									// 2) 결과분석(92) 생성
									formatName = "결과<br>분석";
									var sli_o = _Unit.drawButton(formatName, pItem, -1, function(evo) {
										if(isState == 2) {
											// 결과 분석 보기 (/event/virtual_exams/)
											//expapr_no, bt_no
											//virtual_exams.getExamResult();
											var url_v2 = "/_api/search.api.asp";
											var data_v2 = "cmd=CONFIRM_BAROTEST&exPapr_No=" + expapr_no + "&SiteID=" + siteid
														+ "&Grade=" + item.grade + "&Subj_Code=" + item.subj_code;

											comm.toggleLoading(true);
											comm.send(url_v2, data_v2, "post", function(json2) {
												comm.toggleLoading(false);
												if(json2) {
													var data2 = json2;

													data2["expapr_no"] = expapr_no;
													data2["BT_No"] = json2.BT_No;
													data2["SiteID"] = pItem.siteid;
													data2["Grade"] = pItem.grade;
													data2["Subj_Code"] = pItem.subj_code;

													if(baroState == "Y") {
														virtual_exams.getExamResult(data2);
													}
												}
											});
										} else {
											common.toast("결과분석은 답안제출 이후 이용 가능합니다.");
											comm.toggleLoading(false);
										}
									});

									// 3) 해설받기(91) 생성
									formatName = "해설<br>받기";
									var sli_o = _Unit.drawButton(formatName, pItem, -1, function(evo) {
										if(isState == 2) {
											// format : 91, group : K, coretype : T
											var dataItem = _Unit.getAttributeValue(evo);

											/* 재다운로드 버튼과 동일하게 호출 */
											fn_examDownload(dataItem.expapr_no, dataItem.format, dataItem.siteid, dataItem.group, "", dataItem.subj_code, dataItem.grade, dataItem.coretype);
										} else {
											common.toast("해설받기는 답안제출 이후 이용 가능합니다.");
											comm.toggleLoading(false);
										}
									});

									// 미리보는 중간(기말)고사 버튼 활성화 위해
									virtual_exams.setExamTestFlag(isState, baroState);
								}
							});

						} 	//else if(priceItem.format == "97" || priceItem.format == "98" || priceItem.format == "99") { // 기출오답노트 미노출로 변경 2020-04-29
						else if(item.expapr_group != "A" && (priceItem.format == "97" || priceItem.format == "98" || priceItem.format == "99")) {
                            pItem.formats = null;
                            pItem.price = priceItem.price;
                            pItem.format_i = priceItem.format;
                            pItem.pobj = sul_o;

                            var expapr_no = item.expapr_no;
                            var siteid = item.siteid;
                            var url_v = "/_api/search.api.asp";
                            var data_v = "cmd=CONFIRM_BAROTEST&exPapr_No=" + expapr_no + "&SiteID=" + siteid
                                                    + "&Grade=" + item.grade + "&Subj_Code=" + item.subj_code;
                            comm.toggleLoading(true);
                            comm.send(url_v, data_v, "get", function(json) {
                                comm.toggleLoading(false);
                                if(json){
                                    var isState = json.isState;
                                    var baroState = json.baroState;
                                    var BT_No = json.BT_No;
                                    if(isState == "1" || isState == "0" || isState == null){
                                        if(baroState == "Y") {
                                            formatName = "정답<br>입력";
                                        }
                                        else{
                                            formatName = "오답<br>노트";
                                        }
                                    }
                                    else if(isState == "2"){
                                        formatName = "채점<br>확인";
                                    }
                                    else{
                                        formatName = "오답<br>노트";
                                    }

                                    var sli_o = _Unit.drawButton(formatName, pItem, -1, function(evo) {
                                        var url_v2 = "/_api/search.api.asp";
                                        var data_v2 = "cmd=CONFIRM_BAROTEST&exPapr_No=" + expapr_no + "&SiteID=" + siteid
                                                    + "&Grade=" + item.grade + "&Subj_Code=" + item.subj_code;

                                        comm.toggleLoading(true);
                                        comm.send(url_v2, data_v2, "post", function(json2){
                                            comm.toggleLoading(false);
                                            if(json2){
                                                var data2 = json2;
                                                data2["expapr_no"] = expapr_no;
                                                data2["BT_No"] = json2.BT_No;
                                                data2["SiteID"] = pItem.siteid;
                                                data2["Grade"] = pItem.grade;
                                                data2["Subj_Code"] = pItem.subj_code;

                                                if(typeof(_callback) == "function") _callback(data, data2);
                                            }
                                        });
                                    });
                                }
                            });
                        }

                        if(priceItem.format == "94" || priceItem.format == "89") {//94:문제풀이(영상), 89:풀이영상
                            pItem.formats = null;					
                            pItem.price = _downPrice["VOD"]["prob_" + pItem.siteid.toLowerCase()];    // 문제풀이 가격.
                            pItem.format_i = priceItem.format;
                            pItem.pobj = sul_o;
                            var sli_o = _Unit.drawButton(formatName, pItem, -1, function(evo) {
                                var dataItem = _Unit.getAttributeValue(evo);
                                var data_o = {};
                                
                                // 3 : toggle 관련 > 다운로드 발생 Data Log 적재
                                fetch("/Include/ajax/toggle_action_log_insert_ajax.asp?log_type=3&exam_type=VOD&expapr_no="+dataItem.expapr_no+"&current_toggle="+current_toggle);
                                // End

                                data_o["part"] = dataItem.partnum;
                                data_o["grade"] = dataItem.grade;
                                data_o["subj_code"] = dataItem.subj_code;
                                data_o["siteid"] = dataItem.siteid;
                                player.vodPlayer(dataItem.expapr_no, dataItem.type, "", "", "", "", dataItem.name, "", data_o);
                                // video play check
                            });
                            if(typeof(_callback) == "function") _callback(data);
                        }
						else if(priceItem.format == "90") {//90:개념영상
							formatName = "개념영상";
                            pItem.formats = null;					
                            //pItem.price = _downPrice["VOD"]["korGram"];    // 문제풀이 가격.
							pItem.price = _downPrice["VOD"]["concept_" + pItem.siteid.toLowerCase()];    // 개념영상 가격.
                            pItem.format_i = priceItem.format;
                            pItem.pobj = sul_o;
                            var sli_o = _Unit.drawButton(formatName, pItem, -1, function(evo) {
                                var dataItem = _Unit.getAttributeValue(evo);
                                var data_o = {};
                                // 3 : toggle 관련 > 다운로드 발생 Data Log 적재
                                fetch("/Include/ajax/toggle_action_log_insert_ajax.asp?log_type=3&exam_type=VOD&expapr_no="+dataItem.expapr_no+"&current_toggle="+current_toggle);
                                // End
                                
                                data_o["part"] = dataItem.partnum;
                                data_o["grade"] = pItem.grade;
                                data_o["subj_code"] = pItem.subj_code;
                                data_o["siteid"] = pItem.siteid;
                                player.vodPlayer(pItem.expapr_no, "Concept", "", "", "", "", pItem.title, dataItem.partnum, data_o);
                                // video play check
                            });
                            if(typeof(_callback) == "function") _callback(data);
                        }
                        else if(priceItem.format == "96") {//96:정답요청
                            pItem.formats = null;
                            pItem.price = priceItem.price;
                            pItem.format_i = priceItem.format;
                            pItem.pobj = sul_o;
                            var sli_o = _Unit.drawButton(formatName, pItem, -1, function(evo) {
                                var dataItem = _Unit.getAttributeValue(evo);

                                var url_v = "/ZocboXFile/X_File_Request_p.asp";
                                var data_v = "EXNo=" + dataItem.expapr_no;
                                comm.toggleLoading(true);
                                comm.send(url_v, data_v, "post", function(json) {
                                    comm.toggleLoading(false);
                                    if(json.result == "0") {
                                        common.alert("알림", json.msg, null, {});
                                    }
                                    else if(json.result == "1") {
                                        common.toast(json.msg, null);
                                    }
                                    else {
                                        common.alert("알림", json.msg, null, function(){
                                            // location.href="/member/login.asp";
                                        });
                                    }
                                })
                            });
                            if(typeof(_callback) == "function") _callback(data);
                        }
                        else if(priceItem.format != "91" && priceItem.format != "92" && priceItem.format != "93" && priceItem.format != "97" && priceItem.format != "98" && priceItem.format != "99") {							
                            pItem.formats = null;
                            pItem.price = priceItem.price;
                            pItem.format_i = priceItem.format;
                            pItem.pobj = sul_o;

							if(priceItem.format == "33") {
								pItem.sclname = item.sclname;
							}

							if(priceItem.format == "34") {
								pItem.si = item.si;
								pItem.gu = item.gu;
								pItem.scl = item.scl;
							}

                            var sli_o = _Unit.drawButton(formatName, pItem, -1, function(evo) {
                                var dataItem = _Unit.getAttributeValue(evo);
								
								//이용권 사용 시 상품 가격 정보를 위해 임시 사용(아이템 클릭하여 팝업 뜬 후 해당 내용 삭제됨)(EDUMIG-3409)
								_Unit.makeClickedProductPriceInput(dataItem.price);
								// End

                                // 3 : toggle 관련 > 다운로드 발생 Data Log 적재 (상단에서 일괄 적용 가능할지 체크 필요)                                
                                fetch("/Include/ajax/toggle_action_log_insert_ajax.asp?log_type=3&exam_type=FILE&expapr_no="+dataItem.expapr_no+"&exfl_group="+dataItem.format+"&current_toggle="+current_toggle);                                
                                // End

                                if(pItem.issoopring) {
									if(pItem.expapr_group == "D" && pItem.coretype == "B")
									{
										var season_State = $("#season_State").val();
									}

                                    main.download_S(evo);
                                } else {
									/* 수정본 : S */
									if(dataItem.group == "K" && dataItem.coretype == "T") {
										var today = new Date();
										var endDay = new Date("6/30/2020 23:59:59");

										if(dataItem.redown == "N") {
											if(today.getTime() > endDay.getTime()) {
												alert("이벤트가 종료되었습니다.");
											} else {
												fn_examDownload(dataItem.expapr_no, dataItem.format, dataItem.siteid, dataItem.group, "", dataItem.subj_code, dataItem.grade, dataItem.coretype);
											}
										} else {
											fn_examDownload(dataItem.expapr_no, dataItem.format, dataItem.siteid, dataItem.group, "", dataItem.subj_code, dataItem.grade, dataItem.coretype);
										}
									} else {
										if (dataItem.group == "A" && (dataItem.coretype == "B" || dataItem.coretype == "E" || dataItem.coretype == "X") && (dataItem.format == "88" || dataItem.format == "34")) {
										} else {
											if (dataItem.group == "A" && dataItem.coretype == "A" && dataItem.format == "3" && pItem.educationcheck == "0") {// 학교별 기출족보 스캔파일
												var is_login_chk = false;

												$.ajax({
													type : "POST"
													, url : "/_api/member.api.asp"
													, data : "cmd=ISLOGIN"
													, dataType : "json"
													, contentType: "application/x-www-form-urlencoded; charset=eur-kr"
													, async : false
													, success : function(json) {
														if(!util.isEmpty(json.user_id)) {
															is_login_chk = true;
														}
													}
												});

												if(is_login_chk) {
													if(!(!this.popup_Chk || this.popup_Chk.closed)){
														this.popup_Chk.close();
													}

													this.popup_Chk = window.open("/include/pdf_Viewer.asp?SiteID="+pItem.siteid+"&Scl_ID="+pItem.sclid+"&Scl_Name=&Grade="+pItem.grade+"&Subj_Code="+pItem.subj_code+"&ExPapr_TestYear="+pItem.year+"&ExPapr_MidEndTerm="+pItem.midandterm+"&TX_Name="+pItem.txname+"&sub_TX_CODE="+pItem.txcode, 'viewer');

													filter_2.querySelector("[id='err_msg']").style.display = "none";
												}
												else {
													common.alert("알림", "로그인이 필요합니다.", null, {});
													return;
												}
											} else {
												fn_examDownload(dataItem.expapr_no, dataItem.format, dataItem.siteid, dataItem.group, "", dataItem.subj_code, dataItem.grade, dataItem.coretype);
											}
										}
									}
									/* 수정본 : E */

									/* 원본 : S */
									//fn_examDownload(dataItem.expapr_no, dataItem.format, dataItem.siteid, dataItem.group, "", dataItem.subj_code, dataItem.grade, dataItem.coretype);
									/* 원본 : E */
                                }
                            });

                            if(typeof(_callback) == "function") _callback(data);
                        }
                    }
                }
                else {
					_Unit.btnCount = _Unit.btnCount + 1;

                    var formatName = "zip";

                    if(data.Exfl_Group == "2") {
                        formatName = "pdf";
                    } else if(data.Exfl_Group == "3") {
                        formatName = "scan";
                    } else if(data.Exfl_Group == "4") {
                        formatName = "hwp";
                    } /*else if(data.Exfl_Group == "33") {
                        formatName = "무료열람";
						pItem.sclname = item.sclname;
                    }*/

                    pItem.formats = null;
                    pItem.pobj = sul_o;

					var sli_o = _Unit.drawButton(formatName, pItem, -1, function(evo) {
                        var dataItem = _Unit.getAttributeValue(evo);

						//이용권 사용 시 상품 가격 정보를 위해 임시 사용(아이템 클릭하여 팝업 뜬 후 해당 내용 삭제됨)(EDUMIG-3409)
						_Unit.makeClickedProductPriceInput(dataItem.price);
						// End

                        if(dataItem.format == "99") {
                            var url_v = "/_api/member.api.asp";
                            var data_v = "cmd=ISLOGIN";
                            comm.toggleLoading(true);
                            comm.send(url_v, data_v, "post", function(json) {
                                comm.toggleLoading(false);
                                if(json.mem_id == "") { // req login
                                }
                                else {

                                    // var url_v = "/BaroTest/BTS_Chk.asp";
                                    // var data_v = "exPapr_No=" + dataItem.expapr_no + "&SiteID=" + dataItem.siteid + "&Grade=" + dataItem.grade;
                                    // data_v = data_v + "&Subj_Code=" + dataItem.subjcode;
                                    // comm.send(url_v, data_v, "get", function(json) {

                                    // });
                                }
                            });
                        }
                        else {                            
                            if(pItem.issoopring) {
                                // 3 : toggle 관련 > 다운로드 발생 Data Log 적재
                                fetch("/Include/ajax/toggle_action_log_insert_ajax.asp?log_type=3&exam_type=FILE&expapr_no="+dataItem.expapr_no+"&exfl_group="+dataItem.format+"&current_toggle="+current_toggle);                                                                
                                // End
                                main.download_S(evo);
                            } else {
                                if(dataItem.pageinfo == "previous") {
                                    // 3 : toggle 관련 > 다운로드 발생 Data Log 적재                                
                                    fetch("/Include/ajax/toggle_action_log_insert_ajax.asp?log_type=3&exam_type=FILE&expapr_no="+dataItem.expapr_no+"&exfl_group="+dataItem.format+"&current_toggle="+current_toggle);                                                                
                                    // End

									var ssi = (sessionStorage.getItem("school_sel_idx") == null) ? 0 : sessionStorage.getItem("school_sel_idx");                                    
									// 학교★맞춤 수정                                    
									fn_examDownload(dataItem.expapr_no, '2', dataItem.siteid, dataItem.group, false, dataItem.subj_code, dataItem.grade, dataItem.coretype, 'matchSvc_main');
								}
								else {
									if (((dataItem.group == "V" || dataItem.group == "W") && dataItem.coretype == "") || (dataItem.group == "B" && dataItem.coretype == "C")) 
									{
										$.ajax(
										{
											type : "POST",
											url : "/_api/member.api.asp",
											data : "cmd=ISLOGIN",
											dataType : "json",
											contentType: "application/x-www-form-urlencoded; charset=eur-kr",
											async : false,
											success : function(json) 
											{
												if(dataItem.group == "B")
												{
													var season_State = $("#season_State").val();

													if(season_State == "N")
													{
														alert('직전대비 다운로드 제공 기간이 종료 되었습니다. 2학기에 다시 만나요!');
														return;
													}
													else
													{
                                                        // 3 : toggle 관련 > 다운로드 발생 Data Log 적재                                
                                                        fetch("/Include/ajax/toggle_action_log_insert_ajax.asp?log_type=3&exam_type=FILE&expapr_no="+dataItem.expapr_no+"&exfl_group=2&current_toggle="+current_toggle);
                                                        // End
														fn_examDownload(dataItem.expapr_no, "2", dataItem.siteid, "B", "", dataItem.subj_code, dataItem.grade, "C");
													}													
												}
												else if(dataItem.group == "W")
												{
													var season_State = $("#season_State").val();

													if(season_State == "N")
													{
														alert('다운로드 제공 기간이 종료 되었습니다.');
														return;
													}
													else
													{
                                                        // 3 : toggle 관련 > 다운로드 발생 Data Log 적재
                                                        fetch("/Include/ajax/toggle_action_log_insert_ajax.asp?log_type=3&exam_type=AUTOEXAM&expapr_no="+dataItem.expapr_no+"&current_toggle="+current_toggle);
                                                        // End
														ExamDownload_AutoExam_V2(json.user_id, dataItem.expapr_no, dataItem.subj_code, dataItem.siteid, dataItem.grade, document.getElementById("part_ID").value, dataItem.exam_index, isRedownLastChk_v, dataItem.group);
													}													
												}
												else
												{
                                                    // 3 : toggle 관련 > 다운로드 발생 Data Log 적재
                                                    fetch("/Include/ajax/toggle_action_log_insert_ajax.asp?log_type=3&exam_type=AUTOEXAM&expapr_no="+dataItem.expapr_no+"&current_toggle="+current_toggle);
                                                    // End
													ExamDownload_AutoExam_V2(json.user_id, dataItem.expapr_no, dataItem.subj_code, dataItem.siteid, dataItem.grade, document.getElementById("part_ID").value, dataItem.exam_index, isRedownLastChk_v, dataItem.group);
												}											
											}
										});
									} 
									else 
									{
                                        // 3 : toggle 관련 > 다운로드 발생 Data Log 적재
                                        fetch("/Include/ajax/toggle_action_log_insert_ajax.asp?log_type=3&exam_type=FILE&expapr_no="+dataItem.expapr_no+"&exfl_group="+dataItem.format+"&current_toggle="+current_toggle);                                                                
                                        // End

										if(dataItem.group == "B")
										{
											var season_State = $("#season_State").val();

											if(season_State == "N")
											{
												alert('직전대비 다운로드 제공 기간이 종료 되었습니다. 2학기에 다시 만나요!');
												return;
											}
											else
											{
												fn_examDownload(dataItem.expapr_no, dataItem.format, dataItem.siteid, dataItem.group, "", dataItem.subj_code, dataItem.grade, dataItem.coretype);
											}
										}
										else if(dataItem.group == "W")
										{
											var season_State = $("#season_State").val();

											if(season_State == "N")
											{
												alert('다운로드 제공 기간이 종료 되었습니다.');
												return;
											}
											else
											{
												fn_examDownload(dataItem.expapr_no, dataItem.format, dataItem.siteid, dataItem.group, "", dataItem.subj_code, dataItem.grade, dataItem.coretype);
											}													
										}
										else
										{
											fn_examDownload(dataItem.expapr_no, dataItem.format, dataItem.siteid, dataItem.group, "", dataItem.subj_code, dataItem.grade, dataItem.coretype);
										}
									}
								}
                            }
                        }
                    });
                    // sul_o.appendChild(sli_o);                    
                    if(typeof(_callback) == "function") _callback(data);
                }

            }
        });
    },	

    // 속성 데이터 값 조회
    getAttributeValue:function(evo) {
        var dataItem = {};
        dataItem.expapr_no = evo.getAttribute("data-no");
        dataItem.siteid = evo.getAttribute("data-siteid");
        dataItem.group = evo.getAttribute("data-group");
        dataItem.grade = evo.getAttribute("data-grade");
        dataItem.subj_code = evo.getAttribute("data-subjcode");
        dataItem.coretype = evo.getAttribute("data-coretype");
        dataItem.year = evo.getAttribute("data-year");
        dataItem.title = evo.getAttribute("data-title");
        dataItem.code = evo.getAttribute("data-code");
        dataItem.type = evo.getAttribute("data-type");
        dataItem.format = evo.getAttribute("data-format");
        dataItem.name = evo.getAttribute("data-name");
        dataItem.partnum = evo.getAttribute("data-partnum");
		dataItem.pageinfo = evo.getAttribute("data-pageinfo");
		dataItem.tx_name = evo.getAttribute("data-tx_name");
		dataItem.redown = evo.getAttribute("redown");
		dataItem.exam_index = evo.getAttribute("data-exam-index");
		dataItem.price = evo.getAttribute("data-price");

        return dataItem;
    },

    // 버튼 그리기
    drawButton:function(type_p, item_p, index_p, _callback) {
        var item = util.keysToLowerCase(item_p);
        var format_i = DATA_FORMAT_CONFIG[type_p].CODE;
        item.format_i = format_i;

        if(item.format_i == "96") {//96:정답요청
			_Unit.renderButton(type_p, item_p, index_p, _callback);
        } else if(item.format_i == "94" || item.format_i == "90" || item.format_i == "89") {//94:문제풀이(영상), 90:개념영상, 89:풀이영상
			_Unit.renderButton(type_p, item, index_p, _callback);
        } else if(item.format_i == "93") {		// (미리보는중간고사) 답안제출
			_Unit.renderButton(type_p, item, index_p, _callback);
        } else if(item.format_i == "92") {		// (미리보는중간고사) 결과분석
			_Unit.renderButton(type_p, item, index_p, _callback);
        } else if(item.format_i == "91") {		// (미리보는중간고사) 해설받기
			_Unit.renderButton(type_p, item, index_p, _callback);
        } else if(item.price == null) {
            var url_p = "/_api/search.api.asp";
            var data_p = "cmd=GET_PAPER_PRICE&site_id=" + item.siteid;

            if(item.expapr_no) {
                data_p = data_p + "&ExPapr_No=" + item.expapr_no
            }

            if(item.expapr_group) {
                data_p = data_p + "&ExPapr_Group=" + item.expapr_group;
            }

            if(item.title) {
                data_p = data_p + "&ExPapr_title=" + item.title;
            }

            if(item.txcode) {
                data_p = data_p + "&TX_CODE=" + item.txcode;
            }

            if(format_i) {
                data_p = data_p + "&Exfl_Group=" + format_i;
            }

            if(item.coretype){
                data_p = data_p + "&ExPapr_CoreType=" + item.coretype;
            }

            if(item.year){
                data_p = data_p + "&ExPapr_TestYear=" + item.year;
            }

            comm.toggleLoading(true);
            comm.send(url_p, data_p, "post", function(data){
                comm.toggleLoading(false);
                item.price = "0";
                if(data){
                    item.price = data.price;
                }

                var is_soopring = "";
                if(item.expapr_no && !item.issoopring) {
                    is_soopring = "";
                } else {
                    is_soopring = "SOO";
                }

                var new_url_2 = "/_api/member.api.asp";
                var new_data_2 = "cmd=IS_REDOWN_V2&ExPapr_No=" + item.expapr_no + "&Exfl_Group=" + item.format_i + "&price=" + item.price + "&flag="+is_soopring;

                comm.toggleLoading(true);
                comm.send(new_url_2, new_data_2, "post", function(rdata) {
                    comm.toggleLoading(false);
                    // 수프링일때는 item, 이외는 rItem
                    if(is_soopring == "SOO") {
                        item.redown = rdata.Result;
						item.price = rdata.price;
                        _Unit.renderButton(type_p, item, index_p, _callback);
                    } else {
                        var rItem = {};
                        var sel_v = "";
						if (item.root_expapr_no) {
							sel_v = "li[data-no='" + item.root_expapr_no + "'][data-title]";
						} else if (item.dataindex) {
							sel_v = "li[data-no='" + rdata.ExPapr_No + "'][data-index="+ item.dataindex +"]";
						} 
						else if(item.exam_index)
						{
							sel_v = "li[data-exam-index='" + item.exam_index + "']";
						}
						else {							
							sel_v = "li[data-no='" + rdata.ExPapr_No + "'][data-title]";
						}
						
                        var obj = document.querySelector(sel_v);

                        if(obj)
						{
							rItem = _Unit.getAttributeValue(obj);
						}

                        rItem.price = rdata.price;
						rItem.pobj = obj.querySelector(".detailLink ul");
                        rItem.redown = rdata.Result;

						if(item.exam_index)
						{
							rItem.exam_index = item.exam_index;
						}

						if (item.root_expapr_no) {
							rItem.expapr_no = item.expapr_no;
						}

                        _Unit.renderButton(type_p, rItem, index_p, _callback);
                    }
                });
            });
        }
        else {
            var is_soopring = "";
            if(item.expapr_no && !item.issoopring) {
                is_soopring = "";
            } else {
                is_soopring = "SOO";
            }

            var new_url_2 = "/_api/member.api.asp";
            var new_data_2 = "cmd=IS_REDOWN_V2&ExPapr_No=" + item.expapr_no + "&Exfl_Group=" + item.format_i + "&price=" + item.price + "&flag="+is_soopring;

            comm.toggleLoading(true);
            comm.send(new_url_2, new_data_2, "post", function(rdata) {
                comm.toggleLoading(false);
                // 수프링일때는 item, 이외는 rItem
                if(is_soopring == "SOO") {
                    item.redown = rdata.Result;
					item.price = rdata.price;
                    _Unit.renderButton(type_p, item, index_p, _callback);
                } else {
                    var rItem = {};
					var sel_v = "";

					if (item.root_expapr_no) {
						sel_v = "li[data-no='" + item.root_expapr_no + "'][data-title]";
					} else if (item.dataindex) {
						sel_v = "li[data-no='" + rdata.ExPapr_No + "'][data-index='"+ item.dataindex +"']";
					} else if (item.grammidx) {
						sel_v = "li[data-no='" + rdata.ExPapr_No + "'][data-idx='" + item.grammidx + "']";
					} else {
						sel_v = "li[data-no='" + rdata.ExPapr_No + "'][data-title]";
					}
                    _hLog("sel_v=" + sel_v);
                    var obj = document.querySelector(sel_v);
                    if(obj) rItem = _Unit.getAttributeValue(obj);
                    rItem.price = rdata.price;
                    rItem.pobj = obj.querySelector(".detailLink ul");
                    rItem.redown = rdata.Result;

					if (item.expapr_group == "A" && item.coretype == "B") { // 기출유사 예외처리
						rItem.sclid = item.sclid;
					}

					if (item.root_expapr_no) {
						rItem.expapr_no = item.expapr_no;
					}

                    // 학기 정보 버튼으로 전달 (정효태)
                    if (item_p.midandterm) {
                        rItem.midandterm = item_p.midandterm;
					}

                    // TX_CODE 전달 (정효태)
					if (item_p.txcode) {
                        rItem.txcode = item_p.txcode;
					}

					if(rdata.Exfl_Group == "33")
					{
						rItem.sclid = item.sclid;
						rItem.sclname = item.sclname;
						rItem.txname = item.txname;
					}

					if(rdata.Exfl_Group == "34")
					{
						rItem.si = item.si;
						rItem.gu = item.gu;
						//rItem.scl = item.scl;						
						rItem.sclid = item.sclid;
					}

					if(rdata.Exfl_Group == "88")
					{
						rItem.pdf = item.pdf;
						rItem.hwp2002 = item.hwp2002;
					}

					if (item.educationcheck) {	// 가족학원 채크유무
						rItem.educationcheck = item.educationcheck;
					}

                    _Unit.renderButton(type_p, rItem, index_p, _callback);
                }
            });
        }
    },

    // 버튼 만들기
    renderButton:function(type_p, item_p, index_p, _callback) {
        comm.toggleLoading(false);
        comm.toggleLoading(false);
        _Unit.btnCount = _Unit.btnCount - 1;

        if(_Unit.btnCount <= 0) {
            _Unit.btnCount = 0;
            comm.toggleLoading(false);
        }

        var item = item_p;

        var format_i = DATA_FORMAT_CONFIG[type_p].CODE;//다운로드 콘텐츠 포맷 코드
		var format_class_i = DATA_FORMAT_CONFIG[type_p].CLASS_GUBUN;//다운로드 콘텐츠 아이콘 변경 요청_포맷별 class명(EDUMIG-3409)
		var innerText_i = type_p.toUpperCase().replace("<BR>","");//다운로드 콘텐츠 아이콘 변경 요청_포맷별 보여줄 명칭(EDUMIG-3409)

        var sli_o = document.createElement("li");

        var a_o = document.createElement("a");
        a_o.href = "javascript:;";

        if(item.price) {
			a_o.className = "renewal2024-btn-download";
            if(format_i == "91" || format_i == "92" || format_i == "93" || format_i == "97" || format_i == "98" || format_i == "99") {//91:해설받기, 92:결과분석, 93:답안제출, 97:오답노트, 98:정답입력, 99:채점확인
				a_o.innerHTML =  _Unit.drawButtonDetail(format_class_i, "", innerText_i);
            } else if(format_i == "94" || format_i == "90" || format_i == "89") {//94:문제풀이(영상), 90:개념영상, 89:풀이영상
				innerText_i = innerText_i.replace("영상","").replace("문제","");
				
				//START : main.js에서 search검색으로 동영상 재다운로드 상태 가져올때 특정 예외처리로 인해 재다운로드 상태값을 가져오지 않을 경우 동영상 재다운로드 여부 확인을 위해 동영상 콘텐츠 재다운로드 여부 확인함
				if (isValueEmpty(item.revodstate) == true) {
					var vod_type, url_2, data_2;

					if (format_i == "90") {//90:개념영상 상태값 셋팅
						vod_type = "Concept";
					}

					if(item.coretype.substring(0,1) == "Q") {
						item.partnum = "1";
					}
				
					url_2 = "/_api/member.api.asp?";
					data_2 = "cmd=IS_VOD_REDOWN&siteid=" + item.siteid + "&expapr_no=" + item.expapr_no + "&vod_type=" + vod_type + "&seq=" + item.partnum;

					jQuery.ajax({
						type : "get",
						dataType:"json",
						async: false,
						url : url_2 + data_2,					
						success: function(responseJson) {	
							if (responseJson.isRedown > 0) {//다운로드 이력 있을 경우
								item.revodstate = "Y";//동영상 재다운로드 상태값 변경
							}
						}
					});
				}
				//END

                if(item.revodstate == "Y"){
					a_o.innerHTML =  _Unit.drawButtonDetail(format_class_i, "reconfirm", innerText_i);
                }
                else{
				   a_o.innerHTML =  _Unit.drawButtonDetail(format_class_i, "", innerText_i);
                }
            } else if(DATA_FORMAT_CONFIG[type_p].CODE) {
				if (format_i == "88") {	//88:풀이영상 ,기출유사 예외처리					
					item.price = 0;

					if(item.group == "A" && (item.coretype == "B" || item.coretype == "E" || item.coretype == "X"))
					{
						if(item.subj_code == "ET" || item.subj_code == "TH" || item.subj_code == "CH" || item.subj_code == "OT")
						{
							sli_o.style.display = "none";
						}
					}
				}
				
				if (format_i == "34")//34:기출유사
				{
					item.price = 0;

					if(item.subj_code == "ET" || item.subj_code == "TH" || item.subj_code == "CH" || item.subj_code == "OT")
					{
						sli_o.style.display = "none";
					}
				}

				if (item.group == "A" && type_p == "무료열람") {	//학교별 기출족보 Scan 예외처리
					item.price = 0;
					type_p = "무료 열람";
					innerText_i = type_p;
                    // 무료열람실 > X인 경우는 무료열람 불가
                    if(item.coretype == "X") {
						sli_o.style.display = "none";
					}					
				} else if(type_p == "pdf" && item.group == "A" && item.coretype == "B") {	// 기출유사 예외처리
					type_p = "기출유사";
				}

                if(item.group == "A" && item.coretype == "B") {	// 기출유사 예외처리
				} else if (type_p == "scan") {
					type_p = "스캔";
					innerText_i = type_p;
				}

                if(item.price > 0) {
                    if( ui_updater.getUI(item.expapr_no, format_i) == "Y" && item.group != "V" && item.group != "W") {
                        a_o.innerHTML =  _Unit.drawButtonDetail(format_class_i, "reconfirm", innerText_i);
                    }
					else if(item.group == 'V' || item.group == 'W')
					{
						var url_v = "/Member/reDown_Chk_V.asp";
						var data_v = "ExPapr_No=" + item.expapr_no;
						data_v = data_v + "&Part_ID_Set=" + document.getElementById("part_ID").value;
						data_v = data_v + "&exam_Index=" + item.exam_index;

						var num_v = item.price;

						comm.send(url_v, data_v, "POST", function(json) 
						{
							isRedownLastChk_v = json.isRedownLastChk;

							if(isRedownLastChk_v == 0)
							{
								a_o.innerHTML =  _Unit.drawButtonDetail(format_class_i, "reconfirm", innerText_i);

							}
							else
							{
								a_o.innerHTML =  _Unit.drawButtonDetail(format_class_i, "", innerText_i);
							}
						});
					}
                    else {
                        var num_v = item.price;

                        if (item.group == "D") {
                            if(item.coretype == "C") {
                                num_v = 0;
                            } else if (item.coretype == "A") {
                                num_v = 2000;
                            }
                        } else if (item.group == "H" && item.coretype == "S") {

                        }
                        a_o.innerHTML =  _Unit.drawButtonDetail(format_class_i, "", innerText_i);
                    }
                }
                else {
					a_o.innerHTML =  _Unit.drawButtonDetail(format_class_i, "", innerText_i);
                }
            } else {
				a_o.innerHTML =  _Unit.drawButtonDetail(format_class_i, "", innerText_i);
            }
        }
		
        sli_o.appendChild(a_o);

        a_o.setAttribute("data-pos", index_p);
        a_o.setAttribute("data-key", item.id);

        if(item.id == null) {
            if(item.expapr_no) {
                a_o.setAttribute("data-key", item.expapr_no);
            }
        }
        if(index_p < 0) {
            a_o.setAttribute("data-group", item.group);
            a_o.setAttribute("data-coretype", item.coretype);
            a_o.setAttribute("data-year", item.year);
        }
        a_o.setAttribute("data-no", item.expapr_no);
        a_o.setAttribute("data-siteid", item.siteid);
        a_o.setAttribute("data-grade", item.grade);
        a_o.setAttribute("data-subjcode", item.subj_code);
		
		if (item.group == "A" && item.coretype == "B") {		// 기출유사 2
			a_o.setAttribute("data-format", 2);	
		} else if (item.group == "A" && (item.coretype == "A" || item.coretype == "E" || item.coretype == "X") && format_i == "88") {
	        a_o.setAttribute("data-format", 2);	
		} else {
	        a_o.setAttribute("data-format", DATA_FORMAT_CONFIG[type_p].CODE);           // 2:pdf, 3:scan, 4:hwp, 5:zip
		}
        a_o.setAttribute("data-type", item.type);           // 2:pdf, 3:scan, 4:hwp, 5:zip
        a_o.setAttribute("data-code", item.code);           // 2:pdf, 3:scan, 4:hwp, 5:zip
        a_o.setAttribute("data-price", item.price);
        a_o.setAttribute("data-name", item.name);
        a_o.setAttribute("data-type", item.type);
        a_o.setAttribute("data-partnum", item.partnum);
		a_o.setAttribute("redown", item.redown);		

		if(item.exam_index)
		{
			a_o.setAttribute("data-exam-index", item.exam_index);
		}

		var disabled_Chk = "N";

		if (item.group == "A" && (item.coretype == "A" || item.coretype == "B" || item.coretype == "E" || item.coretype == "X") && format_i == "88") {
			if(item.pdf != "NONE" || item.hwp2002 != "NONE")
			{
				a_o.setAttribute("data-src", "common");
				a_o.setAttribute("data-act", "previous_analysis");
				a_o.setAttribute("data-txcode", item.txcode);		// 정효태
				a_o.setAttribute("data-scl-id", item.sclid);
				a_o.setAttribute("data-subj-code", item.subj_code);
				a_o.setAttribute("data-midandterm", item.midandterm);   // 정효태
			}
			else
			{
				a_o.style.border = "1px solid #A6A6A6";
				a_o.style.backgroundColor = "#EAEAEA";
				a_o.style.setProperty("color", "#A6A6A6", "important");
				disabled_Chk = "Y";
			}
		}

		if (item.pageinfo == 'previous')
		{
			a_o.setAttribute("data-pageInfo", item.pageinfo);
			a_o.setAttribute("data-tx_name", item.tx_name);			
		}	

        $(a_o).bind("click", function() {return false;});

		if(format_i == "33")//33:무료열람
		{			
			var season_FreeState = $("#season_FreeState").val();

			a_o.setAttribute("data-act", "viewer");

			$(a_o).bind("click", function(ee) {
				if(season_FreeState == 'N')
				{
					alert('무료열람 기간이 종료 되었습니다.');
					return;
				}
				else
				{
					var is_login_chk = false;

					$.ajax({
						type : "POST"
						, url : "/_api/member.api.asp"
						, data : "cmd=ISLOGIN"
						, dataType : "json"
						, contentType: "application/x-www-form-urlencoded; charset=eur-kr"
						, async : false
						, success : function(json) {
							if(!util.isEmpty(json.user_id)) {
								is_login_chk = true;
							}
						}
					});

					if(is_login_chk) {
						var SiteID = item.siteid;
						var Scl_ID = item.sclid;
						var Scl_Name = item.sclname;
						var Grade = item.grade;
						var Subj_Code = item.subj_code;
						var ExPapr_TestYear = item.year;
						var ExPapr_MidEndTerm = item.midandterm;
						var TX_Name = item.txname;
						var sub_TX_CODE = item.txcode;

						if(!(!this.popup_Chk || this.popup_Chk.closed))
						{
							this.popup_Chk.close();
						}

						var url_vv = "/_api/member.api.asp";
						var data_vv = "cmd=ISLOGIN";

						comm.send(url_vv, data_vv, "post", function(data) {
							if(data.mem_group == "A")
							{							
								common.mem_Group_A_Block(function(){});
							}
							else
							{
                                // 무료열람 허용 체크 방식으로 변경 (정효태, 2024.05.18)
								limitCheck.viewer_open_check(this, item.expapr_no, SiteID, Scl_ID, Scl_Name, Grade, Subj_Code, ExPapr_TestYear, ExPapr_MidEndTerm, TX_Name, sub_TX_CODE);						
							}
						});
					}
					else {
						loginPop.show("", "/Freetrial/FreeReading.asp", false);
					}
				}
			});
		}
		else if(format_i == "34")//34:기출유사
		{
			$(a_o).bind("click", function(ee) {				
				var SiteID = item.siteid;
				var scl = item.sclid;
				var grade = item.grade;
				var site_gubun = "";

				if(SiteID == "M")
				{
					site_gubun = "/M/";
				}
				else
				{
					site_gubun = "/H/";
				}

				location.href = site_gubun + "?menu=2&type=0&yusatype=Y&scl="+scl+"&grade="+grade+"&year="+item.year+"&midend="+item.midandterm+"&isFirst=Y";				
			});
		}
		else
		{
			if(disabled_Chk == "Y")
			{
				$(a_o).bind("click", function(ee) {
					alert('해당 학교는 기출분석을 제공하지 않습니다.');
					return;
				});
			}
			else
			{
				$(a_o).bind("click", function(ee) {
					var ev = window.event || ee;
					var evo = ev.srcElement || ev.target;
					evo = util.findObjectByAttr(evo, "data-pos", null);

					if(typeof(_callback) == "function") {
						_callback(evo);
					}
				});
			}
		}
        
        if(item.pobj) {
            if(format_i > 90) {
                item.pobj.appendChild(sli_o);
            }
            else {
                var li_a = item.pobj.querySelectorAll("li");
                if(li_a.length > 0) {
                    var f_o = null;
                    for(var ii = 0; ii < li_a.length ; ii++) {
                        if( li_a[ii].querySelector("a").getAttribute("data-format") > 90) {
                            f_o = li_a[ii];
                            item.pobj.insertBefore(sli_o, f_o);
                            break;
                        }
                    }
                    if(f_o == null) {
                        item.pobj.appendChild(sli_o);
                    }
                }
                else {
                    item.pobj.appendChild(sli_o);
                }
            }
        }

		if(item.group == "A" && (item.coretype == "A" || item.coretype == "B" || item.coretype == "E" || item.coretype == "X") && format_i == "88") {		// 기출유사 예외처리
			common.init();
		}

        return sli_o;
    }
};

var _progress = function(Token, _function) {
	$.ajax({
		url: "/Common/System/Token_hs.asp?Token=" + Token + "&Idx=" +  Math.random(),
		method: "get",
		asynchronous: false,
		contentType: 'application/x-www-form-urlencoded',
		encoding: 'UTF-8',
		dataType: "xml",
		complete: function(Request){

			if(Request.status == 200){

				if(Request.responseXML){
					var Doc = Request.responseXML.documentElement;
					var _Percent = Doc.getElementsByTagName('Percent')[0].firstChild.nodeValue;
					var _Status = Doc.getElementsByTagName('Status')[0].firstChild.nodeValue;

					// _Status : 100 = 정상, 000 = 문제 없음
					if ( _Status != '' ) 
					{
						Start = true;
					}
					if (Start == true && _Percent == 100)
					{
						clearInterval(INTERVAL_ID);
						if(typeof(_function) == "function"){
							_function();
						}
						return;
					}

					// 문제를 찾기 못 한다면
					if (_Status == '000') {
						common.alert('알림','해당 범위의 문제가 조회가 되질 않습니다.', null, {});
						clearInterval(INTERVAL_ID);
						return;
					}
					else{
						comm.toggleProcessLoading(_Percent);
					}
				}
			}
			else if(Start && Request.status == 404){
				clearInterval(INTERVAL_ID);
				if(typeof(_function) == "function"){
					_function();
				}
				return;
			}
		}
	});
};

var _hide = function() {
	var curScrollY = null;
	var parentRoot = null;

	parentRoot = document.querySelector("[data-id='" + "main" + "']");
	root = document.querySelector("#" + "goods_select");

	parentRoot.style.display = "";
	root.style.display = "none";
	if(curScrollY) {
		window.scrollTo(0, curScrollY);
		sessionStorage.removeItem("curScroll");
	}
};