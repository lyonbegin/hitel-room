var UseAmountControl =
[
// ---------------------------------------------------------------------------
// PRO
// ---------------------------------------------------------------------------
	{ Value: "P", Flag: [
		// 0: 중등 학생용 이용권 (selectGrade : control : 0, flag: 0) (flag idx : 0)
		{ Name: "학생 PRO", Value: "1", Grade: [ // 학생용
			{ Name: "중1", Value: "M", Plvl_Term: [
				{ Name: "30일", Value: "30", Plvl_DownCount: "300", Level_Code: "44", Plvl_Code: "97", Plvl_Price: "30000", PLVL_SOOPRING_CNT : "0", IsSale: false , IsBaroTest:true , IsEtest:true },
				{ Name: "12개월", Value: "12", Plvl_DownCount: "1550", Level_Code: "44", Plvl_Code: "3", Plvl_Price: "234000", PLVL_SOOPRING_CNT : "0", IsSale: true , IsBaroTest:true , IsEtest:true },
				{ Name: "6개월", Value: "6", Plvl_DownCount: "620", Level_Code: "44", Plvl_Code: "9", Plvl_Price: "143000", PLVL_SOOPRING_CNT : "0", IsSale: true , IsBaroTest:true , IsEtest:true },
				{ Name: "46일", Value: "1", Plvl_DownCount: "220", Level_Code: "44", Plvl_Code: "15", Plvl_Price: "72000", PLVL_SOOPRING_CNT : "0", IsSale: false , IsBaroTest:true , IsEtest:true }
			]},
			{ Name: "중2", Value: "M", Plvl_Term: [
				{ Name: "30일", Value: "30", Plvl_DownCount: "300", Level_Code: "44", Plvl_Code: "98", Plvl_Price: "30000", PLVL_SOOPRING_CNT : "0", IsSale: false , IsBaroTest:true , IsEtest:true },
				{ Name: "12개월", Value: "12", Plvl_DownCount: "1550", Level_Code: "44", Plvl_Code: "2", Plvl_Price: "234000", PLVL_SOOPRING_CNT : "0", IsSale: true , IsBaroTest:true , IsEtest:true },
				{ Name: "6개월", Value: "6", Plvl_DownCount: "620", Level_Code: "44", Plvl_Code: "8", Plvl_Price: "143000", PLVL_SOOPRING_CNT : "0", IsSale: true , IsBaroTest:true , IsEtest:true },
				{ Name: "46일", Value: "1", Plvl_DownCount: "220", Level_Code: "44", Plvl_Code: "14", Plvl_Price: "72000", PLVL_SOOPRING_CNT : "0", IsSale: false , IsBaroTest:true , IsEtest:true }
			]},
			{ Name: "중3", Value: "M", Plvl_Term: [
				{ Name: "30일", Value: "30", Plvl_DownCount: "300", Level_Code: "44", Plvl_Code: "99", Plvl_Price: "30000", PLVL_SOOPRING_CNT : "0", IsSale: false , IsBaroTest:true , IsEtest:true },
				{ Name: "12개월", Value: "12", Plvl_DownCount: "1550", Level_Code: "44", Plvl_Code: "1", Plvl_Price: "234000", PLVL_SOOPRING_CNT : "0", IsSale: true , IsBaroTest:true , IsEtest:true },
				{ Name: "6개월", Value: "6", Plvl_DownCount: "620", Level_Code: "44", Plvl_Code: "7", Plvl_Price: "143000", PLVL_SOOPRING_CNT : "0", IsSale: true , IsBaroTest:true , IsEtest:true },
				{ Name: "46일", Value: "1", Plvl_DownCount: "220", Level_Code: "44", Plvl_Code: "13", Plvl_Price: "72000", PLVL_SOOPRING_CNT : "0", IsSale: false , IsBaroTest:true , IsEtest:true }
			]}
		]},		
		// 1 : 선생님 이용권 (flag idx : 1)
		{ Name: "선생님", Value: "2", Grade: [	// 선생님용
			{ Name: "중고등 통합", Value: "T", Plvl_Term: [
				{ Name: "12개월S", Value: "12", Plvl_DownCount: "6600", Level_Code: "43", Plvl_Code: "39", Plvl_Price: "646000", PLVL_SOOPRING_CNT : "200", IsSale: true },
				{ Name: "12개월", Value: "12", Plvl_DownCount: "6600", Level_Code: "43", Plvl_Code: "40", Plvl_Price: "555000", PLVL_SOOPRING_CNT : "0", IsSale: true },
				{ Name: "6개월", Value: "6", Plvl_DownCount: "3220", Level_Code: "43", Plvl_Code: "41", Plvl_Price: "391000", PLVL_SOOPRING_CNT : "0", IsSale: true }
			]},
			{ Name: "중등", Value: "M", Plvl_Term: [
				{ Name: "12개월", Value: "12", Plvl_DownCount: "3300", Level_Code: "43", Plvl_Code: "32", Plvl_Price: "315000", PLVL_SOOPRING_CNT : "0", IsSale: true },
				{ Name: "6개월", Value: "6", Plvl_DownCount: "1350", Level_Code: "43", Plvl_Code: "35", Plvl_Price: "187000", PLVL_SOOPRING_CNT : "0", IsSale: true },
				{ Name: "46일", Value: "1", Plvl_DownCount: "320", Level_Code: "43", Plvl_Code: "37", Plvl_Price: "104000", PLVL_SOOPRING_CNT : "0", IsSale: false }
			]},
			{ Name: "고등", Value: "H", Plvl_Term: [
				{ Name: "12개월S", Value: "12", Plvl_DownCount: "3300", Level_Code: "43", Plvl_Code: "34", Plvl_Price: "412000", PLVL_SOOPRING_CNT : "150", IsSale: true },
				{ Name: "12개월", Value: "12", Plvl_DownCount: "3300", Level_Code: "43", Plvl_Code: "33", Plvl_Price: "321000", PLVL_SOOPRING_CNT : "0", IsSale: true },
				{ Name: "6개월", Value: "6", Plvl_DownCount: "1550", Level_Code: "43", Plvl_Code: "36", Plvl_Price: "204000", PLVL_SOOPRING_CNT : "0", IsSale: true },
				{ Name: "46일", Value: "1", Plvl_DownCount: "370", Level_Code: "43", Plvl_Code: "38", Plvl_Price: "116000", PLVL_SOOPRING_CNT : "0", IsSale: false }
			]}
		]},		
		// 2: 과목별 이용권 (flag idx : 2)
		{ Name: "과목별", Value: "3", Grade: [
			{ Name: "중고등 통합", Value: "T", Subj_Code : [	// 과목별
				{ Name: "국어", Value: "KR", Plvl_Term: [
					{ Name: "12개월", Value: "12", Plvl_DownCount: "4000", Level_Code: "43", Plvl_Code: "81", Plvl_Price: "373000", IsSale: true },
					{ Name: "6개월", Value: "6", Plvl_DownCount: "1950", Level_Code: "43", Plvl_Code: "86", Plvl_Price: "272000", IsSale: true }
				]},
				{ Name: "영어", Value: "EG", Plvl_Term: [
					{ Name: "12개월", Value: "12", Plvl_DownCount: "4000", Level_Code: "43", Plvl_Code: "82", Plvl_Price: "373000", IsSale: true },
					{ Name: "6개월", Value: "6", Plvl_DownCount: "1950", Level_Code: "43", Plvl_Code: "87", Plvl_Price: "272000", IsSale: true }
				]},
				{ Name: "수학", Value: "MT", Plvl_Term: [
					{ Name: "12개월", Value: "12", Plvl_DownCount: "4000", Level_Code: "43", Plvl_Code: "83", Plvl_Price: "373000", IsSale: true },
					{ Name: "6개월", Value: "6", Plvl_DownCount: "1950", Level_Code: "43", Plvl_Code: "88", Plvl_Price: "272000", IsSale: true }
				]},
				{ Name: "과학탐구", Value: "SC", Plvl_Term: [
					{ Name: "12개월", Value: "12", Plvl_DownCount: "4000", Level_Code: "43", Plvl_Code: "84", Plvl_Price: "373000", IsSale: true },
					{ Name: "6개월", Value: "6", Plvl_DownCount: "1950", Level_Code: "43", Plvl_Code: "89", Plvl_Price: "272000", IsSale: true }
				]},
				{ Name: "사회탐구/한국사", Value: "LS", Plvl_Term: [
					{ Name: "12개월", Value: "12", Plvl_DownCount: "4000", Level_Code: "43", Plvl_Code: "85", Plvl_Price: "373000", IsSale: true },
					{ Name: "6개월", Value: "6", Plvl_DownCount: "1950", Level_Code: "43", Plvl_Code: "90", Plvl_Price: "272000", IsSale: true }
				]}
			]},
			{ Name: "중등", Value: "M", Subj_Code : [	// 과목별
				{ Name: "국어", Value: "KR", Plvl_Term: [
					{ Name: "12개월", Value: "12", Plvl_DownCount: "2000", Level_Code: "43", Plvl_Code: "42", Plvl_Price: "211000", IsSale: true },
					{ Name: "6개월", Value: "6", Plvl_DownCount: "850", Level_Code: "43", Plvl_Code: "50", Plvl_Price: "131000", IsSale: true },
					{ Name: "46일", Value: "1", Plvl_DownCount: "270", Level_Code: "43", Plvl_Code: "58", Plvl_Price: "78000", IsSale: false }
				]},
				{ Name: "영어", Value: "EG", Plvl_Term: [
					{ Name: "12개월", Value: "12", Plvl_DownCount: "2000", Level_Code: "43", Plvl_Code: "43", Plvl_Price: "211000", IsSale: true },
					{ Name: "6개월", Value: "6", Plvl_DownCount: "850", Level_Code: "43", Plvl_Code: "51", Plvl_Price: "131000", IsSale: true },
					{ Name: "46일", Value: "1", Plvl_DownCount: "270", Level_Code: "43", Plvl_Code: "59", Plvl_Price: "78000", IsSale: false }
				]},
				{ Name: "수학", Value: "MT", Plvl_Term: [
					{ Name: "12개월", Value: "12", Plvl_DownCount: "2000", Level_Code: "43", Plvl_Code: "44", Plvl_Price: "211000", IsSale: true },
					{ Name: "6개월", Value: "6", Plvl_DownCount: "850", Level_Code: "43", Plvl_Code: "52", Plvl_Price: "131000", IsSale: true },
					{ Name: "46일", Value: "1", Plvl_DownCount: "270", Level_Code: "43", Plvl_Code: "60", Plvl_Price: "78000", IsSale: false }
				]},
				{ Name: "과학", Value: "SC", Plvl_Term: [
					{ Name: "12개월", Value: "12", Plvl_DownCount: "2000", Level_Code: "43", Plvl_Code: "45", Plvl_Price: "211000", IsSale: true },
					{ Name: "6개월", Value: "6", Plvl_DownCount: "850", Level_Code: "43", Plvl_Code: "53", Plvl_Price: "131000", IsSale: true },
					{ Name: "46일", Value: "1", Plvl_DownCount: "270", Level_Code: "43", Plvl_Code: "61", Plvl_Price: "78000", IsSale: false }
				]},
				{ Name: "사회/역사", Value: "LS", Plvl_Term: [
					{ Name: "12개월", Value: "12", Plvl_DownCount: "2000", Level_Code: "43", Plvl_Code: "46", Plvl_Price: "211000", IsSale: true },
					{ Name: "6개월", Value: "6", Plvl_DownCount: "850", Level_Code: "43", Plvl_Code: "54", Plvl_Price: "131000", IsSale: true },
					{ Name: "46일", Value: "1", Plvl_DownCount: "270", Level_Code: "43", Plvl_Code: "62", Plvl_Price: "78000", IsSale: false }
				]},
				{ Name: "기술가정", Value: "TH", Plvl_Term: [
					{ Name: "12개월", Value: "12", Plvl_DownCount: "2000", Level_Code: "43", Plvl_Code: "47", Plvl_Price: "211000", IsSale: true },
					{ Name: "6개월", Value: "6", Plvl_DownCount: "850", Level_Code: "43", Plvl_Code: "55", Plvl_Price: "131000", IsSale: true },
					{ Name: "46일", Value: "1", Plvl_DownCount: "270", Level_Code: "43", Plvl_Code: "63", Plvl_Price: "78000", IsSale: false }
				]},
				{ Name: "도덕", Value: "ET", Plvl_Term: [
					{ Name: "12개월", Value: "12", Plvl_DownCount: "2000", Level_Code: "43", Plvl_Code: "48", Plvl_Price: "211000", IsSale: true },
					{ Name: "6개월", Value: "6", Plvl_DownCount: "850", Level_Code: "43", Plvl_Code: "56", Plvl_Price: "131000", IsSale: true },
					{ Name: "46일", Value: "1", Plvl_DownCount: "270", Level_Code: "43", Plvl_Code: "64", Plvl_Price: "78000", IsSale: false }
				]},
				{ Name: "한문", Value: "CH", Plvl_Term: [
					{ Name: "12개월", Value: "12", Plvl_DownCount: "2000", Level_Code: "43", Plvl_Code: "49", Plvl_Price: "211000", IsSale: true },
					{ Name: "6개월", Value: "6", Plvl_DownCount: "850", Level_Code: "43", Plvl_Code: "57", Plvl_Price: "131000", IsSale: true },
					{ Name: "46일", Value: "1", Plvl_DownCount: "270", Level_Code: "43", Plvl_Code: "65", Plvl_Price: "78000", IsSale: false }
				]}
			]},
			{ Name: "고등", Value: "H", Subj_Code : [	// 과목별
				{ Name: "국어", Value: "KR", Plvl_Term: [
					{ Name: "12개월", Value: "12", Plvl_DownCount: "2000", Level_Code: "43", Plvl_Code: "66", Plvl_Price: "213000", IsSale: true },
					{ Name: "6개월", Value: "6", Plvl_DownCount: "980", Level_Code: "43", Plvl_Code: "71", Plvl_Price: "141000", IsSale: true },
					{ Name: "46일", Value: "1", Plvl_DownCount: "310", Level_Code: "43", Plvl_Code: "76", Plvl_Price: "85000", IsSale: false }
				]},
				{ Name: "영어", Value: "EG", Plvl_Term: [
					{ Name: "12개월", Value: "12", Plvl_DownCount: "2000", Level_Code: "43", Plvl_Code: "67", Plvl_Price: "213000", IsSale: true },
					{ Name: "6개월", Value: "6", Plvl_DownCount: "980", Level_Code: "43", Plvl_Code: "72", Plvl_Price: "141000", IsSale: true },
					{ Name: "46일", Value: "1", Plvl_DownCount: "310", Level_Code: "43", Plvl_Code: "77", Plvl_Price: "85000", IsSale: false }
				]},
				{ Name: "수학", Value: "MT", Plvl_Term: [
					{ Name: "12개월", Value: "12", Plvl_DownCount: "2000", Level_Code: "43", Plvl_Code: "68", Plvl_Price: "213000", IsSale: true },
					{ Name: "6개월", Value: "6", Plvl_DownCount: "980", Level_Code: "43", Plvl_Code: "73", Plvl_Price: "141000", IsSale: true },
					{ Name: "46일", Value: "1", Plvl_DownCount: "310", Level_Code: "43", Plvl_Code: "78", Plvl_Price: "85000", IsSale: false }
				]},
				{ Name: "과학탐구", Value: "SC", Plvl_Term: [
					{ Name: "12개월", Value: "12", Plvl_DownCount: "2000", Level_Code: "43", Plvl_Code: "69", Plvl_Price: "213000", IsSale: true },
					{ Name: "6개월", Value: "6", Plvl_DownCount: "980", Level_Code: "43", Plvl_Code: "74", Plvl_Price: "141000", IsSale: true },
					{ Name: "46일", Value: "1", Plvl_DownCount: "310", Level_Code: "43", Plvl_Code: "79", Plvl_Price: "85000", IsSale: false }
				]},
				{ Name: "사회탐구/한국사", Value: "LS", Plvl_Term: [
					{ Name: "12개월", Value: "12", Plvl_DownCount: "2000", Level_Code: "43", Plvl_Code: "70", Plvl_Price: "213000", IsSale: true },
					{ Name: "6개월", Value: "6", Plvl_DownCount: "980", Level_Code: "43", Plvl_Code: "75", Plvl_Price: "141000", IsSale: true },
					{ Name: "46일", Value: "1", Plvl_DownCount: "310", Level_Code: "43", Plvl_Code: "80", Plvl_Price: "85000", IsSale: false }
				]}
			]}
		]},		
		// 3: 포인트 이용권 (flag idx : 3)
		{ Name: "포인트", Value: "3", Grade: [	// 포인트
			{ Name: "통합", Value: "I", ZB_Point: [
				{ Name: "79,200 포인트", Value: "1", Plvl_Price: "72000", Bonus_Point: "7200", Normal_Point: "72000", IsSale: false },
				{ Name: "58,300 포인트", Value: "2", Plvl_Price: "54000", Bonus_Point: "4300", Normal_Point: "54000", IsSale: false },
				{ Name: "37,800 포인트", Value: "3", Plvl_Price: "36000", Bonus_Point: "1800", Normal_Point: "36000", IsSale: false },
				//{ Name: "21,400 포인트", Value: "4", Plvl_Price: "20000", Bonus_Point: "400", Normal_Point: "21000", IsSale: false },
				{ Name: "18,000 포인트", Value: "5", Plvl_Price: "18000", Bonus_Point: "0", Normal_Point: "18000", IsSale: false }
			]}
		]},
		// 4 : 수프링 전용 이용권 (flag idx : 4)
		{ Name: "수프링", Value: "6", Grade: [
			{ Name: "고등", Value: "H", Plvl_Term: [
				{ Name: "46일", Value: "1", Plvl_DownCount: "60", Level_Code: "44", Plvl_Code: "91", Plvl_Price: "62000", IsSale: false }
			]}
		]},		
		// 5 :고등 학생용 이용권 (selectGrade : control : 0, flag: 0) (flag idx : 5)
		{ Name: "학생 PRO", Value: "7", Grade: [ // 학생용
			{ Name: "고1", Value: "H", Plvl_Term: [
				{ Name: "30일", Value: "30", Plvl_DownCount: "300", Level_Code: "44", Plvl_Code: "100", Plvl_Price: "30000", IsSale: true },
				{ Name: "12개월", Value: "12", Plvl_DownCount: "1950", Level_Code: "44", Plvl_Code: "21", Plvl_Price: "247000", IsSale: true },
				{ Name: "6개월", Value: "6", Plvl_DownCount: "750", Level_Code: "44", Plvl_Code: "25", Plvl_Price: "151000", IsSale: true },
				{ Name: "46일", Value: "1", Plvl_DownCount: "260", Level_Code: "44", Plvl_Code: "29", Plvl_Price: "78000", IsSale: false }
			]},
			{ Name: "고2ㆍ3", Value: "H", Plvl_Term: [
				{ Name: "30일", Value: "30", Plvl_DownCount: "300", Level_Code: "44", Plvl_Code: "101", Plvl_Price: "30000", IsSale: true },
				{ Name: "12개월", Value: "12", Plvl_DownCount: "1950", Level_Code: "44", Plvl_Code: "19", Plvl_Price: "247000", IsSale: true },
				{ Name: "6개월", Value: "6", Plvl_DownCount: "750", Level_Code: "44", Plvl_Code: "24", Plvl_Price: "151000", IsSale: true },
				{ Name: "46일", Value: "1", Plvl_DownCount: "260", Level_Code: "44", Plvl_Code: "28", Plvl_Price: "78000", IsSale: false }
			]}
		]},
		// 6 : 예비고1 전용 이용권 (flag idx : 6)
		{ Name: "예비고1", Value: "8", Grade: [
			{ Name: "고등", Value: "T", Plvl_Term: [
				{ Name: "60일", Value: "1", Plvl_DownCount: "200", Level_Code: "44", Plvl_Code: "92", Plvl_Price: "29000", IsSale: false }
			]}
		]},
		// 7 : 이투스 결합상품 (flag idx : 7)
		{ Name: "학생 PRO", Value: "9", Grade: [ // 학생용
			{ Name: "중3", Value: "M", Plvl_Term: [
				{ Name: "6개월", Value: "6", Plvl_DownCount: "650", Level_Code: "32", Plvl_Code: "212", Plvl_Price: "255000", BaroTest_Count: "300", Eeval_Count:"16", IsSale: false },
				{ Name: "46일", Value: "1", Plvl_DownCount: "220", Level_Code: "32", Plvl_Code: "211", Plvl_Price: "122000", BaroTest_Count: "100", Eeval_Count:"5", IsSale: false }
			]},
			{ Name: "고1", Value: "H", Plvl_Term: [
				{ Name: "6개월", Value: "6", Plvl_DownCount: "850", Level_Code: "32", Plvl_Code: "212", Plvl_Price: "257000", BaroTest_Count: "330", IsSale: false },
				{ Name: "46일", Value: "1", Plvl_DownCount: "275", Level_Code: "32", Plvl_Code: "211", Plvl_Price: "125000", BaroTest_Count: "110", IsSale: false }
			]}
		]}
	]},
// ---------------------------------------------------------------------------
// BASIC
// ---------------------------------------------------------------------------
	// 중등 학생용 이용권 (selectGrade : control : 1, flag: 0)
	{ Value: "B", Flag: [
		{ Name: "학생 BASIC", Value: "1", Grade: [ // 학생용
			{ Name: "중1", Value: "M", Plvl_Term: [
				{ Name: "12개월", Value: "12", Plvl_DownCount: "850", Level_Code: "44", Plvl_Code: "6", Plvl_Price: "189000", IsSale: true },
				{ Name: "6개월", Value: "6", Plvl_DownCount: "350", Level_Code: "44", Plvl_Code: "12", Plvl_Price: "121000", IsSale: true },
				{ Name: "46일", Value: "1", Plvl_DownCount: "130", Level_Code: "44", Plvl_Code: "18", Plvl_Price: "64000", IsSale: false }
			]},
			{ Name: "중2", Value: "M", Plvl_Term: [
				{ Name: "12개월", Value: "12", Plvl_DownCount: "850", Level_Code: "44", Plvl_Code: "5", Plvl_Price: "189000", IsSale: true },
				{ Name: "6개월", Value: "6", Plvl_DownCount: "350", Level_Code: "44", Plvl_Code: "11", Plvl_Price: "121000", IsSale: true },
				{ Name: "46일", Value: "1", Plvl_DownCount: "130", Level_Code: "44", Plvl_Code: "17", Plvl_Price: "64000", IsSale: false }
			]},
			{ Name: "중3", Value: "M", Plvl_Term: [
				{ Name: "12개월", Value: "12", Plvl_DownCount: "850", Level_Code: "44", Plvl_Code: "4", Plvl_Price: "189000", IsSale: true },
				{ Name: "6개월", Value: "6", Plvl_DownCount: "350", Level_Code: "44", Plvl_Code: "10", Plvl_Price: "121000", IsSale: true },
				{ Name: "46일", Value: "1", Plvl_DownCount: "130", Level_Code: "44", Plvl_Code: "16", Plvl_Price: "64000", IsSale: false }
			]}
		]}
		, { Name: "학생 BASIC", Value: "1", Grade: [ // 학생용
			{ Name: "고1", Value: "H", Plvl_Term: [
				{ Name: "12개월", Value: "12", Plvl_DownCount: "930", Level_Code: "44", Plvl_Code: "23", Plvl_Price: "204000", IsSale: true },
				{ Name: "6개월", Value: "6", Plvl_DownCount: "390", Level_Code: "44", Plvl_Code: "27", Plvl_Price: "131000", IsSale: true },
				{ Name: "46일", Value: "1", Plvl_DownCount: "140", Level_Code: "44", Plvl_Code: "31", Plvl_Price: "68000", IsSale: false }
			]},
			{ Name: "고2,3", Value: "H", Plvl_Term: [
				{ Name: "12개월", Value: "12", Plvl_DownCount: "930", Level_Code: "44", Plvl_Code: "22", Plvl_Price: "204000", IsSale: true },
				{ Name: "6개월", Value: "6", Plvl_DownCount: "390", Level_Code: "44", Plvl_Code: "26", Plvl_Price: "131000", IsSale: true },
				{ Name: "46일", Value: "1", Plvl_DownCount: "140", Level_Code: "44", Plvl_Code: "30", Plvl_Price: "68000", IsSale: false }
			]}
		]}
	]}
];

/* useCouponList */
var useCouponList =
[
	// 학생용 이용권 (0), category : 1
	{ Name: "중학생", Value: "1", Type: [
		{ Name: "PRO 이용권", Value: "1", Control_Num: "0", Flag_Num: "0", GoodsInfoTemplateId:"hidden-pro-information-middle-template", Plvl_Term: [
			{ Name: "30일", Value: "30", Value_Unit: "일", Plvl_DownCount: "300", Plvl_Price: "30000", IsSale: false, IsBaroTest:true , IsEtest:true },
			{ Name: "12개월", Value: "12", Value_Unit: "개월", Plvl_DownCount: "1550", Plvl_Price: "234000", IsSale: true, IsBaroTest:true , IsEtest:true },
			{ Name: "6개월",  Value: "6",  Value_Unit: "개월", Plvl_DownCount: "620",  Plvl_Price: "143000", IsSale: true, IsBaroTest:true , IsEtest:true},
			{ Name: "46일",   Value: "46", Value_Unit: "일",   Plvl_DownCount: "220",  Plvl_Price: "72000",  IsSale: false, IsBaroTest:true , IsEtest:true}
		]},
		{ Name: "BASIC 이용권", Value: "2", Control_Num: "1", Flag_Num: "0", Plvl_Term: [
			{ Name: "12개월", Value: "12", Value_Unit: "개월", Plvl_DownCount: "850", Plvl_Price: "189000", IsSale: true },
			{ Name: "6개월",  Value: "6",  Value_Unit: "개월", Plvl_DownCount: "350", Plvl_Price: "121000", IsSale: true },
			{ Name: "46일",   Value: "46", Value_Unit: "일",   Plvl_DownCount: "130", Plvl_Price: "64000", IsSale: false }
		]}
	]},
	// 선생님용 (1), category : 2
	{ Name: "선생님", Value: "1", Type: [
		{ Name: "중고등 통합", Value: "T", Control_Num: "0", Flag_Num: "1", GoodsInfoTemplateId:"hidden-pro-information-teacher-template", Plvl_Term: [
			{ Name: "12개월", Value: "12", Value_Unit: "개월", Plvl_DownCount: "6600", Plvl_Price: "646000", PLVL_SOOPRING_CNT : "200", IsSale: true, sub_title:"S" },
			{ Name: "12개월", Value: "12", Value_Unit: "개월", Plvl_DownCount: "6600", Plvl_Price: "555000", IsSale: true },
			{ Name: "6개월", Value: "6", Value_Unit: "개월", Plvl_DownCount: "3220", Plvl_Price: "391000", IsSale: true }
		]},
		{ Name: "중등 전용", Value: "M", Control_Num: "0", Flag_Num: "1", GoodsInfoTemplateId:"hidden-pro-information-teacher-middle-template", Plvl_Term: [
			{ Name: "12개월", Value: "12", Value_Unit: "개월", Plvl_DownCount: "3300", Plvl_Price: "315000", IsSale: true },
			{ Name: "6개월", Value: "6", Value_Unit: "개월", Plvl_DownCount: "1350", Plvl_Price: "187000", IsSale: true },
			{ Name: "46일", Value: "46", Value_Unit: "일", Plvl_DownCount: "320", Plvl_Price: "104000", IsSale: false }
		]},
		{ Name: "고등 전용", Value: "H", Control_Num: "0", Flag_Num: "1", GoodsInfoTemplateId:"hidden-pro-information-teacher-high-template", Plvl_Term: [
			{ Name: "12개월", Value: "12", Value_Unit: "개월", Plvl_DownCount: "3300", Plvl_Price: "412000", PLVL_SOOPRING_CNT : "150", IsSale: true , sub_title:"S"},
			{ Name: "12개월", Value: "12", Value_Unit: "개월", Plvl_DownCount: "3300", Plvl_Price: "321000", IsSale: true },
			{ Name: "6개월", Value: "6", Value_Unit: "개월", Plvl_DownCount: "1550", Plvl_Price: "204000", IsSale: true },
			{ Name: "46일", Value: "46", Value_Unit: "일", Plvl_DownCount: "370", Plvl_Price: "116000", IsSale: false }
		]}
	]},
	// 과목별 이용권(2), catetory : 3
	{ Name: "과목별", Value: "2", Type: [
		{ Name: "중고등 통합", Value: "T", Control_Num: "0", Flag_Num: "2", Plvl_Term: [
			{ Name: "12개월", Value: "12", Value_Unit: "개월", Plvl_DownCount: "4000", Plvl_Price: "373000", IsSale: true },
			{ Name: "6개월", Value: "6", Value_Unit: "개월", Plvl_DownCount: "1950", Plvl_Price: "272000", IsSale: true }
		]},
		{ Name: "중등 전용", Value: "M", Control_Num: "0", Flag_Num: "2", Plvl_Term: [
			{ Name: "12개월", Value: "12", Value_Unit: "개월", Plvl_DownCount: "2000", Plvl_Price: "211000", IsSale: true },
			{ Name: "6개월", Value: "6", Value_Unit: "개월", Plvl_DownCount: "850", Plvl_Price: "131000", IsSale: true },
			{ Name: "46일", Value: "46", Value_Unit: "일", Plvl_DownCount: "270", Plvl_Price: "78000", IsSale: false }
		]},
		{ Name: "고등 전용", Value: "H", Control_Num: "0", Flag_Num: "2", Plvl_Term: [
			{ Name: "12개월", Value: "12", Value_Unit: "개월", Plvl_DownCount: "2000", Plvl_Price: "213000", IsSale: true },
			{ Name: "6개월", Value: "6", Value_Unit: "개월", Plvl_DownCount: "980", Plvl_Price: "141000", IsSale: true },
			{ Name: "46일", Value: "46", Value_Unit: "일", Plvl_DownCount: "310", Plvl_Price: "85000", IsSale: false }
		]}
	]},
	// 수프링 전용 이용권(3), category : 4
	{ Name: "수프링", Value: "3", Type: [
		{ Name: "고등 수프링", Value: "H", Control_Num: "0", Flag_Num: "4", Plvl_Term: [
			{ Name: "46일", Value: "46", Value_Unit: "일", Plvl_DownCount: "60", Plvl_Price: "62000", IsSale: false }
		]}
	]},
	// 포인트 충전(4), category : 5
	{ Name: "포인트", Value: "3", Type: [	
		{ Name: "79,200 포인트", Value: "1", Control_Num: "0", Flag_Num: "3", Plvl_Price: "72000", Bonus_Point: "7200", Normal_Price: "72000", Payment_Point: "79200", IsSale: false, Bonus_Point_Title: "10%추가적립"},
		{ Name: "58,300 포인트", Value: "2", Control_Num: "0", Flag_Num: "3", Plvl_Price: "54000", Bonus_Point: "4300", Normal_Price: "54000", Payment_Point: "58300", IsSale: false, Bonus_Point_Title: "8%추가적립" },
		{ Name: "37,800 포인트", Value: "3", Control_Num: "0", Flag_Num: "3", Plvl_Price: "36000", Bonus_Point: "1800", Normal_Price: "36000", Payment_Point: "37800", IsSale: false , Bonus_Point_Title: "5%추가적립" },
		//{ Name: "21,400 포인트", Value: "4", Control_Num: "0", Flag_Num: "3", Plvl_Price: "20000", Bonus_Point: "400", Normal_Price: "21000", Payment_Point: "21400", IsSale: false },
		{ Name: "18,000 포인트", Value: "5", Control_Num: "0", Flag_Num: "3", Plvl_Price: "18000", Bonus_Point: "0", Normal_Price: "18000",Payment_Point: "18000", IsSale: false }
	]},
	// 학생용 이용권(5), category : 6
	{ Name: "고등학생", Value: "1", Type: [
		{ Name: "PRO 이용권", Value: "1", Control_Num: "0", Flag_Num: "5", GoodsInfoTemplateId:"hidden-pro-information-high-template", Plvl_Term: [
			{ Name: "30일", Value: "30", Value_Unit: "일", Plvl_DownCount: "300", Plvl_Price: "30000", IsSale: false },
			{ Name: "12개월", Value: "12", Value_Unit: "개월", Plvl_DownCount: "1950", Plvl_Price: "247000", IsSale: true },
			{ Name: "6개월", Value: "6", Value_Unit: "개월", Plvl_DownCount: "750", Plvl_Price: "151000", IsSale: true },
			{ Name: "46일", Value: "46", Value_Unit: "일", Plvl_DownCount: "260", Plvl_Price: "78000", IsSale: false }
		]},
		{ Name: "BASIC 이용권", Value: "2", Control_Num: "1", Flag_Num: "1", Plvl_Term: [
			{ Name: "12개월", Value: "12", Value_Unit: "개월", Plvl_DownCount: "930", Plvl_Price: "204000", IsSale: true },
			{ Name: "6개월", Value: "6", Value_Unit: "개월", Plvl_DownCount: "390", Plvl_Price: "131000", IsSale: true },
			{ Name: "46일", Value: "46", Value_Unit: "일", Plvl_DownCount: "140", Plvl_Price: "68000", IsSale: false }
		]}
	]},
	// 예비고1 전용 이용권(6), category : 7
	{ Name: "예비고1", Value: "3", Type: [
		{ Name: "예비고1 전용", Value: "T", Control_Num: "0", Flag_Num: "6", Plvl_Term: [
			{ Name: "60일", Value: "60", Value_Unit: "일", Plvl_DownCount: "200", Plvl_Price: "29000", IsSale: false }
		]}
	]},
	// 족보닷컴X이투스 결합상품(7), category : 8
	{ Name: "학생 PRO", Value: "6", Type: [
		{ Name: "중등 PRO 이용권", Value: "1", Control_Num: "0", Flag_Num: "7", Include_BaroTest: "Y", Plvl_Term: [
			{ Name: "6개월", Value: "6", Value_Unit: "개월", Plvl_DownCount: "650", Plvl_Price: "255000", BaroTest_Count: "300", Eeval_Count:"16", IsSale: false },
			{ Name: "46일", Value: "46", Value_Unit: "일", Plvl_DownCount: "200", Plvl_Price: "122000", BaroTest_Count: "100", Eeval_Count:"5", IsSale: false }
		]},
		{ Name: "고등 PRO 이용권", Value: "2", Control_Num: "1", Flag_Num: "7", Include_BaroTest: "Y", Include_Soopring: "Y", Plvl_Term: [
			{ Name: "6개월", Value: "6", Value_Unit: "개월", Plvl_DownCount: "850", Plvl_Price: "257000", BaroTest_Count: "330", IsSale: false },
			{ Name: "46일", Value: "46", Value_Unit: "일", Plvl_DownCount: "275", Plvl_Price: "125000", BaroTest_Count: "110", IsSale: false }
		]}
	]}
];

var _UseAmountControl;
var __UseAmountControl;

function UseAmountControl_Init() {
	var _SiteID = SiteID;
	var _Flag = Flag;
	var SelectID;
	var _radioPro = radioPro;
	var __Grade = _Grade;
	var _goods_E = Goods_E;

	switch (_Flag) {
		case "1":
			SelectID = $('#Grade');
			break;
		case "2":
			SelectID = $('#Grade');
			break;
		case "3":
			SelectID = $('#Subj_Code');
			break;
		case "4":
			SelectID = $('#SiteID');
			break;
		case "5":
			SelectID = $('#Grade');
			break;
		case "6":
			SelectID = $('#Subj_Code');
			break;

		case "7":
			SelectID = $('#Grade');
			break;
	}

	// 현재 radioPro, ExPapr_Group, ExPapar_CoreType 하위의 JSON 검색
	for (var i = 0; i < UseAmountControl.length; i++) {
		if (UseAmountControl[i].Value == _radioPro) {
			for (var j = 0; j < UseAmountControl[i].Flag.length; j++) {
				if (UseAmountControl[i].Flag[j].Value == _Flag) {
					if (_Flag == '3' || _Flag) {
						for (var n = 0; n < UseAmountControl[i].Flag[j].Grade.length; n++) {
							if (UseAmountControl[i].Flag[j].Grade[n].Value == __Grade) {

								_UseAmountControl = UseAmountControl[i].Flag[j].Grade[n].Subj_Code;

								for (var k = 0; k < UseAmountControl[i].Flag[j].Grade[n].Subj_Code.length; k++) {
									SelectID.append($("<option></option>")
											.attr('value', UseAmountControl[i].Flag[j].Grade[n].Subj_Code[k].Value)
											.text(UseAmountControl[i].Flag[j].Grade[n].Subj_Code[k].Name));
								}
							}
						}
					} else {
						if (UseAmountControl[i].Flag[j].Grade != null) {
							_UseAmountControl = UseAmountControl[i].Flag[j].Grade;

							for (var k = 0; k < UseAmountControl[i].Flag[j].Grade.length; k++) {
								SelectID.append($("<option></option>")
										.attr('value', UseAmountControl[i].Flag[j].Grade[k].Value)
										.text(UseAmountControl[i].Flag[j].Grade[k].Name));
							}
							break;
						}

						if (UseAmountControl[i].Flag[j].Plvl_Term != null) {						
							__UseAmountControl = UseAmountControl[i].Flag[j].Plvl_Term;

							for (var k = 0; k < UseAmountControl[i].Flag[j].Plvl_Term.length; k++) {
								SelectID.append($("<option></option>")
										.attr('value', UseAmountControl[i].Flag[j].Plvl_Term[k].Value)
										.text(UseAmountControl[i].Flag[j].Plvl_Term[k].Name));
							}
							break;
						}

						if (UseAmountControl[i].Flag[j].Subj_Code != null) {
							_UseAmountControl = UseAmountControl[i].Flag[j].Subj_Code;

							for (var k = 0; k < UseAmountControl[i].Flag[j].Subj_Code.length; k++) {
								SelectID.append($("<option></option>")
										.attr('value', UseAmountControl[i].Flag[j].Subj_Code[k].Value)
										.text(UseAmountControl[i].Flag[j].Subj_Code[k].Name));
							}
							break;
						}

						if (UseAmountControl[i].Flag[j].ZB_Point != null) {
							__UseAmountControl = UseAmountControl[i].Flag[j].ZB_Point;

							for (var k = 0; k < UseAmountControl[i].Flag[j].ZB_Point.length; k++) {
								SelectID.append($("<option></option>")
										.attr('value', UseAmountControl[i].Flag[j].ZB_Point[k].Value)
										.text(UseAmountControl[i].Flag[j].ZB_Point[k].Name));
							}
							break;
						}
					}
				}
			}
			break;
		}
	}
}

// 포인트 설정
function Set_Point(SelectedID) {
	if (_UseAmountControl == null)
		return;

	var ZB_Point = $('#ZB_Point');
	var SelectedIdx = $("#" + SelectedID + " option").index($("#" + SelectedID + " option:selected"));

	// ZB_Point 폼을 초기화하고 기본값만 추가를 한다.
	ZB_Point.html("").append($("<option></option>").attr('value', '').text('선택'));

	// Grade 가 선택이 된 경우만 ZB_Point 설정한다.
	if (SelectedIdx != 0) {
		if (!_UseAmountControl[SelectedIdx - 1]) return;

		__UseAmountControl = _UseAmountControl[SelectedIdx - 1].ZB_Point;

		// 현재 option 하위의 기간 그룹을 가져와 ZB_Point 에 추가한다.
		for (var i = 0; i < _UseAmountControl[SelectedIdx - 1].ZB_Point.length; i++) {
			ZB_Point.append($("<option></option>")
					.attr('value', _UseAmountControl[SelectedIdx - 1].ZB_Point[i].Value)
					.text(_UseAmountControl[SelectedIdx - 1].ZB_Point[i].Name));
		}
	}
}

// 과목 설정
function Set_Subj_Code(SelectedID) {
	if (_UseAmountControl == null)
		return;

	var Subj_Code = $('#Subj_Code');
	var SelectedIdx = $("#" + SelectedID + " option").index($("#" + SelectedID + " option:selected"));

	// Subj_Code 폼을 초기화하고 기본값만 추가를 한다.
	Subj_Code.html("").append($("<option></option>").attr('value', '').text('선택'));

	// Grade 가 선택이 된 경우만 Subj_Code를 설정한다.
	if (SelectedIdx != 0) {
		if (!_UseAmountControl[SelectedIdx - 1]) return;

		__UseAmountControl = _UseAmountControl[SelectedIdx - 1].Subj_Code;

		// 현재 option 하위의 기간 그룹을 가져와 Plvl_Term 에 추가한다.
		for (var i = 0; i < _UseAmountControl[SelectedIdx - 1].Subj_Code.length; i++) {
			Subj_Code.append($("<option></option>")
					.attr('value', _UseAmountControl[SelectedIdx - 1].Subj_Code[i].Value)
					.text(_UseAmountControl[SelectedIdx - 1].Subj_Code[i].Name));
		}
	}
}

// 상위 option 에 해당하는 기간을 설정
function Set_Plvl_Term(SelectedID) {
	if (_UseAmountControl == null)
		return;

	var Plvl_Term = $('#Plvl_Term');
	var SelectedIdx = $("#" + SelectedID + " option").index($("#" + SelectedID + " option:selected"));

	// Plvl_Term 폼을 초기화하고 기본값만 추가를 한다.
	Plvl_Term.html("").append($("<option></option>").attr('value', '').text('선택'));

	// Grade 가 선택이 된 경우만 Plvl_Term 설정한다.
	if (SelectedIdx != 0) {
		if (!_UseAmountControl[SelectedIdx - 1]) return;

		__UseAmountControl = _UseAmountControl[SelectedIdx - 1].Plvl_Term;

		// 현재 option 하위의 기간 그룹을 가져와 Plvl_Term 에 추가한다.
		for (var i = 0; i < _UseAmountControl[SelectedIdx - 1].Plvl_Term.length; i++) {
			Plvl_Term.append($("<option></option>")
					.attr('value', _UseAmountControl[SelectedIdx - 1].Plvl_Term[i].Value)
					.text(_UseAmountControl[SelectedIdx - 1].Plvl_Term[i].Name));
		}
	}
}

function Set_ServiceInfo(ApplyValue) {
	var _SiteID = SiteID;
	var _Flag = Flag;
	var oPreAmount = 0;
	var oPreAmount1 = 0;
	var oPreAmount2 = 0;//상품 결제 금액
	var pcode = "";
	var _Plvl_Term = "0개월";
	var _Plvl_DownCount = 0;
	var _BaroTest_Count = 0;
	var _SaleRate = SaleRate;

	_SiteID = $('#Grade option:selected').val();

	if (_Flag == '6')
	{
		_SiteID = 'M';
	}

	if (ApplyValue != null) {
		if (__UseAmountControl == null)
			return;

		for (var i = 0; i < __UseAmountControl.length; i++) {
			if (__UseAmountControl[i].Value == ApplyValue) {
				oPreAmount1 += __UseAmountControl[i].Plvl_Price;
				if (!__UseAmountControl[i].IsSale) {
					oPreAmount2 += __UseAmountControl[i].Plvl_Price;
				} else {
					oPreAmount2 += __UseAmountControl[i].Plvl_Price - ( __UseAmountControl[i].Plvl_Price * _SaleRate );
				}

				if (_Flag == "4") {
					this_pcode = ApplyValue;
				} else {
					this_pcode = _SiteID + "," + __UseAmountControl[i].Level_Code + "," + __UseAmountControl[i].Plvl_Code;
					_Plvl_Term = __UseAmountControl[i].Name;
					_Plvl_DownCount = __UseAmountControl[i].Plvl_DownCount;
					_BaroTest_Count = __UseAmountControl[i].BaroTest_Count;
				}

				if ( pcode == "" ) { pcode = this_pcode } else { pcode += ";" + this_pcode }
			}
		}
	}

	var tDownCount = new NumberFormat(parseInt(_Plvl_DownCount, 10));
	tDownCount.setCurrency(false);
	tDownCount.setCommas(true);
	tDownCount.setPlaces(0);

	var tBaroTestCount = new NumberFormat(parseInt(_BaroTest_Count, 10));
	tBaroTestCount.setCurrency(false);
	tBaroTestCount.setCommas(true);
	tBaroTestCount.setPlaces(0);

	if ( _Flag != "4" )
	{
		$("#_Plvl_Term").html(_Plvl_Term);
		$("#_Plvl_DownCount").html(tDownCount.toFormatted());
		$("#_BaroTest_Count").html(tBaroTestCount.toFormatted());
	}

	if (_Flag == '6')
	{
		if (oPreAmount2 == '0')
		{
			$("#_Plvl_DownCount").html('무제한');
		}
		else
		{
			if (radioPro == 'S')
			{
				$("#_Plvl_DownCount").html('선택과목 무제한');
			}
			else
			{
				$("#_Plvl_DownCount").html('예체능 전과목 무제한');
			}
		}
	}

	var tPrices = new NumberFormat(parseInt(oPreAmount1, 10));
	tPrices.setCurrency(false);
	tPrices.setCommas(true);
	tPrices.setPlaces(0);

	if ( SaleRate == 0 || _Flag == "4" ) {
		$("#Amount1").html("");
		$("#Amount2").html(tPrices.toFormatted());
	} else {
		$("#Amount1").html(tPrices.toFormatted());

		var tPrices = new NumberFormat(parseInt(oPreAmount2, 10));
		tPrices.setCurrency(false);
		tPrices.setCommas(true);
		tPrices.setPlaces(0);

		$("#Amount2").html("→ " + tPrices.toFormatted());
	}

	$("#pcode").val(pcode);
}