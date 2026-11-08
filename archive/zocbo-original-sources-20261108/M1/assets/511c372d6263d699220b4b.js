/*
    ★★★★★★★★★★★★★★★★수정 전 주의사항 !!!★★★★★★★★★★★★★★★★
    Hierarchy에 Tx_Code 값이 여러개인 경우(ex. 고3 / 단원별문제 / 생명과학Ⅰ / Tx_Code : "H8SCCHA2001|H7SCEXA2005|H7SCCHA2004|H7SCEXA2006|H7SCEXP2004|H7SCEXP2018|H7SCEXAA005")
    exec [usp_RootPartFromTxCode] 'H8SCCHA2001'
    exec [usp_RootPartFromTxCode] 'H7SCEXA2005'
    exec [usp_RootPartFromTxCode] 'H7SCCHA2004'
    exec [usp_RootPartFromTxCode] 'H7SCEXA2006'
    exec [usp_RootPartFromTxCode] 'H7SCEXP2004'
    exec [usp_RootPartFromTxCode] 'H7SCEXP2018'
    exec [usp_RootPartFromTxCode] 'H7SCEXAA005'

    이처럼 하나씩 코드값을 입력해서 결과값이 출력되는 Tx_Code를 필히 ! 맨 앞에 배치해야 대단원 명이 검색된다 !
    ★★★★★★★★★★★★★★★★//수정 전 주의사항 !!!★★★★★★★★★★★★★★★★
*/

var Hierarchy =
[
// ---------------------------------------------------------------------------
// 중등
// ---------------------------------------------------------------------------
    {Value: "M", ExPapr_Group: [
        { Value: "C", ExPapr_CoreType: [ // 단원별족보
            {Value: "", Grade: [
                { Name: "1학년", Value: "1", Subj_Code: [
                    { Name: "국어", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "천재(노미숙)", Value: "MAKRCHA1001" },
                        { Name: "미래엔(민병곤)", Value: "MAKRCHA1002" },
                        { Name: "비상(박현숙)", Value: "MAKRCHA1003" },
                        { Name: "미래엔(신유식)", Value: "MAKRCHA1004" },
						{ Name: "천재(정호웅)", Value: "MAKRCHA1005" },
						{ Name: "비상(박영민)", Value: "MAKRCHA1006" },
						{ Name: "해냄(강양희)", Value: "MAKRCHA1007" },
						{ Name: "창비(이도영)", Value: "MAKRCHA1008" }
                    ]
                    },
                    { Name: "영어", Value: "EG", WithTxCode: true, TX_CODE: [
                        { Name: "천재(소영순)", Value: "MAEGCHA1001" },
                        { Name: "천재(이상기)", Value: "MAEGCHA1002" },
						{ Name: "능률(김기택)", Value: "MAEGCHA1003" },
						{ Name: "YBM(박준언)", Value: "MAEGCHA1004" },
						{ Name: "미래엔(문영인)", Value: "MAEGCHA1005" },
						{ Name: "동아(윤정미)", Value: "MAEGCHA1006" },
						{ Name: "동아(이병민)", Value: "MAEGCHA1007" },
                        { Name: "비상(황종배)", Value: "MAEGCHA1008" }
                    ]
                    },
                    { Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "MAMTCHA1001" }
                    ]
                    },
                    { Name: "과학", Value: "SC", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "MASCCHA1001" }
                    ]
                    },
                    { Name: "사회", Value: "LS", WithTxCode: true, TX_CODE: [
                        { Name: "사회①", Value: "MALSCHA0001" }
                    ]
                    },
					{ Name: "역사", Value: "HI", WithTxCode: true, TX_CODE: [
						{ Name: "역사①", Value: "M9HICHA0001" }
                    ]
                    },
                    { Name: "도덕", Value: "ET", WithTxCode: true, TX_CODE: [
						{ Name: "도덕①", Value: "MAETCHA0001" }
                    ]
					},
                    { Name: "기술가정", Value: "TH", WithTxCode: true, TX_CODE: [
						{ Name: "기술가정①", Value: "MATHCHA0001" }
                    ]
                    }
                ]
                },
                { Name: "2학년", Value: "2", Subj_Code: [
                    { Name: "국어", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "천재(노미숙)", Value: "MAKRCHA2001" },
                        { Name: "미래엔(민병곤)", Value: "MAKRCHA2002" },
                        { Name: "비상(박현숙)", Value: "MAKRCHA2003" },
                        { Name: "미래엔(신유식)", Value: "MAKRCHA2004" },
                        { Name: "천재(정호웅)", Value: "MAKRCHA2005" },
                        { Name: "비상(박영민)", Value: "MAKRCHA2006" },
                        { Name: "해냄(강양희)", Value: "MAKRCHA2007" },
                        { Name: "창비(이도영)", Value: "MAKRCHA2008" }
                    ]
                    },
                    { Name: "영어", Value: "EG", WithTxCode: true, TX_CODE: [     
                        { Name: "천재(소영순)", Value: "MAEGCHA2001" },
                        { Name: "천재(이상기)", Value: "MAEGCHA2002" },
						{ Name: "능률(김기택)", Value: "MAEGCHA2003" },
						{ Name: "YBM(박준언)", Value: "MAEGCHA2004" },
						{ Name: "미래엔(문영인)", Value: "MAEGCHA2005" },
						{ Name: "동아(윤정미)", Value: "MAEGCHA2006" },
						{ Name: "동아(이병민)", Value: "MAEGCHA2007" },
                        { Name: "비상(황종배)", Value: "MAEGCHA2008" }
                    ]
                    },
                    { Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "M6MTCHA2001" }
                    ]
                    },
                    { Name: "과학", Value: "SC", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "M7SCCHA2001" }
                    ]
                    },
                    { Name: "사회", Value: "LS", WithTxCode: true, TX_CODE: [
                        { Name: "사회①", Value: "M9LSCHA0001" },
                        { Name: "사회②", Value: "M9LSCHA0002" }
                    ]
                    },
                    { Name: "역사", Value: "HI", WithTxCode: true, TX_CODE: [
                        { Name: "역사①", Value: "M9HICHA0001" },
                        { Name: "역사②", Value: "M9HICHA0002" }
                    ]
                    },
                    { Name: "도덕", Value: "ET", WithTxCode: true, TX_CODE: [
                        { Name: "도덕①", Value: "M9ETCHA0001" },
                        { Name: "도덕②", Value: "M9ETCHA0002" }

                    ]
                    },
                    { Name: "기술가정", Value: "TH", WithTxCode: true, TX_CODE: [
                        { Name: "기술가정①", Value: "M9THCHA0001" },
                        { Name: "기술가정②", Value: "M9THCHA0002" }
                    ]
                    },
                    { Name: "한문", Value: "CH", WithTxCode: true, TX_CODE: [
                        { Name: "미래엔(송혁기)", Value: "MACHCHA0005" },
                        { Name: "비상(이동재)", Value: "MACHCHA0006" },
                        { Name: "천재(안대회)", Value: "MACHCHA0007" },
                        { Name: "중3 미래엔(심경호)", Value: "M9CHCHA0001" },
                        { Name: "중3 비상(이동재)", Value: "M9CHCHA0002" },
                        { Name: "중3 천재(안대회)", Value: "M9CHCHA0003" }
                    ]
                    }
                ]
                },
                { Name: "3학년", Value: "3", Subj_Code: [
                    { Name: "국어", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "미래엔(신유식)", Value: "M9KRCHA3001" },
                        { Name: "천재(박영목)", Value: "M9KRCHA3002" },
                        { Name: "비상(김진수)", Value: "M9KRCHA3003" },
                        { Name: "천재(노미숙)", Value: "M9KRCHA3004" },
                        { Name: "지학사(이삼형)", Value: "M9KRCHA3005" },
						{ Name: "창비(이도영)", Value: "M9KRCHA3006" }
                    ]
                    },
                    { Name: "영어", Value: "EG", WithTxCode: true, TX_CODE: [                        
						{ Name: "동아(윤정미)", Value: "M9EGCHA3001" },
                        { Name: "동아(이병민)", Value: "M9EGCHA3002" },
                        { Name: "천재(이재영)", Value: "M9EGCHA3003" },
                        { Name: "미래엔(최연희)", Value: "M9EGCHA3004" },
                        { Name: "능률(김성곤)", Value: "M9EGCHA3005" },
                        { Name: "비상(김진완)", Value: "M9EGCHA3006" },
                        { Name: "천재(정사열)", Value: "M9EGCHA3007" },
                        { Name: "YBM(박준언)", Value: "M9EGCHA3008" }
                    ]
                    },
                    { Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "M6MTCHA3001" }
                    ]
                    },
                    { Name: "과학", Value: "SC", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "M7SCCHA3001" }
                    ]
                    },
                    { Name: "사회", Value: "LS", WithTxCode: true, TX_CODE: [
                        { Name: "사회②", Value: "M9LSCHA0002" }
                    ]
                    },
                    { Name: "역사", Value: "HI", WithTxCode: true, TX_CODE: [
                        { Name: "역사①", Value: "M9HICHA0001" },
                        { Name: "역사②", Value: "M9HICHA0002" }
                    ]
                    },
                    { Name: "도덕", Value: "ET", WithTxCode: true, TX_CODE: [
                        { Name: "도덕①", Value: "M9ETCHA0001" },
                        { Name: "도덕②", Value: "M9ETCHA0002" }

                    ]
                    },
                    { Name: "기술가정", Value: "TH", WithTxCode: true, TX_CODE: [
                        { Name: "기술가정①", Value: "M9THCHA0001" },
                        { Name: "기술가정②", Value: "M9THCHA0002" }

                    ]
                    },
                    { Name: "한문", Value: "CH", WithTxCode: true, TX_CODE: [
                        { Name: "미래엔(송혁기)", Value: "MACHCHA0005" },
                        { Name: "비상(이동재)", Value: "MACHCHA0006" },
                        { Name: "천재(안대회)", Value: "MACHCHA0007" },
                        { Name: "중3 미래엔(심경호)", Value: "M9CHCHA0001" },
                        { Name: "중3 비상(이동재)", Value: "M9CHCHA0002" },
                        { Name: "중3 천재(안대회)", Value: "M9CHCHA0003" }
                    ]
                    }
                ]
                }
            ]
        },
        ]
    },

		{ Value: "B", ExPapr_CoreType: [ // 직전대비
            {Value: "", Grade: [
                { Name: "1학년", Value: "1", Subj_Code: [
                    { Name: "국어", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "천재(노미숙)", Value: "MAKRCHA1001" },
                        { Name: "미래엔(민병곤)", Value: "MAKRCHA1002" },
                        { Name: "비상(박현숙)", Value: "MAKRCHA1003" },
                        { Name: "미래엔(신유식)", Value: "MAKRCHA1004" },
						{ Name: "천재(정호웅)", Value: "MAKRCHA1005" },
						{ Name: "비상(박영민)", Value: "MAKRCHA1006" },
						{ Name: "해냄(강양희)", Value: "MAKRCHA1007" },
						{ Name: "창비(이도영)", Value: "MAKRCHA1008" }
                    ]
                    },
                    { Name: "영어", Value: "EG", WithTxCode: true, TX_CODE: [
						{ Name: "동아(윤정미)", Value: "MAEGCHA1006" },
						{ Name: "동아(이병민)", Value: "MAEGCHA1007" },
                        { Name: "천재(소영순)", Value: "MAEGCHA1001" },
                        { Name: "천재(이상기)", Value: "MAEGCHA1002" },
						{ Name: "능률(김기택)", Value: "MAEGCHA1003" },
						{ Name: "YBM(박준언)", Value: "MAEGCHA1004" },
						{ Name: "미래엔(문영인)", Value: "MAEGCHA1005" }
                    ]
                    },
                    { Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "MAMTCHA1001" }
                    ]
                    },
                    { Name: "과학", Value: "SC", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "MASCCHA1001" }
                    ]
                    },
                    { Name: "사회", Value: "LS", WithTxCode: true, TX_CODE: [
                        { Name: "사회①", Value: "MALSCHA0001" }
                    ]
                    },
					{ Name: "역사", Value: "HI", WithTxCode: true, TX_CODE: [
						{ Name: "역사①", Value: "M9HICHA0001" }
                    ]
                    },
                    { Name: "도덕", Value: "ET", WithTxCode: true, TX_CODE: [
						{ Name: "도덕①", Value: "MAETCHA0001" }
                    ]
					},
                    { Name: "기술가정", Value: "TH", WithTxCode: true, TX_CODE: [
						{ Name: "기술가정①", Value: "MATHCHA0001" }
                    ]
                    }
                ]
                },
                { Name: "2학년", Value: "2", Subj_Code: [
                    { Name: "국어", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "미래엔(신유식)", Value: "M9KRCHA2001" },
                        { Name: "천재(박영목)", Value: "M9KRCHA2002" },
                        { Name: "비상(김진수)", Value: "M9KRCHA2003" },
                        { Name: "천재(노미숙)", Value: "M9KRCHA2004" },
                        { Name: "지학사(이삼형)", Value: "M9KRCHA2005" },
						{ Name: "창비(이도영)", Value: "M9KRCHA2006" }
                    ]
                    },
                    { Name: "영어", Value: "EG", WithTxCode: true, TX_CODE: [                        
                        { Name: "천재(이재영)", Value: "M9EGCHA2003" },
                        { Name: "미래엔(최연희)", Value: "M9EGCHA2004" },
                        { Name: "능률(김성곤)", Value: "M9EGCHA2005" },
                        { Name: "비상(김진완)", Value: "M9EGCHA2006" },
                        { Name: "천재(정사열)", Value: "M9EGCHA2007" },
						{ Name: "YBM(박준언)", Value: "M9EGCHA2008" },
						{ Name: "동아(윤정미)", Value: "M9EGCHA2001" },
                        { Name: "동아(이병민)", Value: "M9EGCHA2002" }
                    ]
                    },
                    { Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "M6MTCHA2001" }
                    ]
                    },
                    { Name: "과학", Value: "SC", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "M7SCCHA2001" }
                    ]
                    },
                    { Name: "사회", Value: "LS", WithTxCode: true, TX_CODE: [
                        { Name: "사회①", Value: "M9LSCHA0001" },
                        { Name: "사회②", Value: "M9LSCHA0002" }
                    ]
                    },
                    { Name: "역사", Value: "HI", WithTxCode: true, TX_CODE: [
                        { Name: "역사①", Value: "M9HICHA0001" },
						{ Name: "역사②", Value: "M9HICHA0002" }
                    ]
                    }
                ]
                },
                { Name: "3학년", Value: "3", Subj_Code: [
                    { Name: "국어", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "미래엔(신유식)", Value: "M9KRCHA3001" },
                        { Name: "천재(박영목)", Value: "M9KRCHA3002" },
                        { Name: "비상(김진수)", Value: "M9KRCHA3003" },
                        { Name: "천재(노미숙)", Value: "M9KRCHA3004" },
                        { Name: "지학사(이삼형)", Value: "M9KRCHA3005" },
						{ Name: "창비(이도영)", Value: "M9KRCHA3006" }
                    ]
                    },
                    { Name: "영어", Value: "EG", WithTxCode: true, TX_CODE: [                        
						{ Name: "천재(이재영)", Value: "M9EGCHA3003" },
                        { Name: "미래엔(최연희)", Value: "M9EGCHA3004" },
                        { Name: "능률(김성곤)", Value: "M9EGCHA3005" },
                        { Name: "비상(김진완)", Value: "M9EGCHA3006" },
                        { Name: "천재(정사열)", Value: "M9EGCHA3007" },
                        { Name: "YBM(박준언)", Value: "M9EGCHA3008" },
						{ Name: "동아(윤정미)", Value: "M9EGCHA3001" },
                        { Name: "동아(이병민)", Value: "M9EGCHA3002" }
                    ]
                    },
                    { Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "M6MTCHA3001" }
                    ]
                    },
                    { Name: "과학", Value: "SC", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "M7SCCHA3001" }
                    ]
                    },
                    { Name: "사회", Value: "LS", WithTxCode: true, TX_CODE: [
                        { Name: "사회②", Value: "M9LSCHA0002" }
                    ]
                    },
                    { Name: "역사", Value: "HI", WithTxCode: true, TX_CODE: [
						{ Name: "역사①", Value: "M9HICHA0001" },
                        { Name: "역사②", Value: "M9HICHA0002" }
                    ]
                    }
                ]
                }
            ]
        }
        ]
    },
		{ Value: "A", ExPapr_CoreType: [ // 학교별 족보
            {Value: "Z", Grade: [   // 학교별 기출 족보
                { Name: "1학년", Value: "1", Subj_Code: [
					{ Name: "전체", Value: ""},
                    { Name: "국어", Value: "KR"},
                    { Name: "영어", Value: "EG"},
                    { Name: "수학", Value: "MT"},
                    { Name: "과학", Value: "SC"},
                    { Name: "사회", Value: "LS"},
                    { Name: "역사", Value: "HI"},
                    { Name: "도덕", Value: "ET"},
                    { Name: "기술·가정", Value: "TH"},
					{ Name: "한문", Value: "CH"},
                    { Name: "기타", Value: "OT"}
                ]
                },
                { Name: "2학년", Value: "2", Subj_Code: [
					{ Name: "전체", Value: ""},
                    { Name: "국어", Value: "KR"},
                    { Name: "영어", Value: "EG"},
                    { Name: "수학", Value: "MT"},
                    { Name: "과학", Value: "SC"},
                    { Name: "사회", Value: "LS"},
                    { Name: "역사", Value: "HI"},
                    { Name: "도덕", Value: "ET"},
                    { Name: "기술·가정", Value: "TH"},
                    { Name: "한문", Value: "CH"},
                    { Name: "기타", Value: "OT"}
                ]
                },
                { Name: "3학년", Value: "3", Subj_Code: [
					{ Name: "전체", Value: ""},
                    { Name: "국어", Value: "KR"},
                    { Name: "영어", Value: "EG"},
                    { Name: "수학", Value: "MT"},
                    { Name: "과학", Value: "SC"},
                    { Name: "사회", Value: "LS"},
                    { Name: "역사", Value: "HI"},
                    { Name: "도덕", Value: "ET"},
                    { Name: "기술·가정", Value: "TH"},
                    { Name: "한문", Value: "CH"},
                    { Name: "기타", Value: "OT"}
                ]
                }
            ]
            },
            {Value: "Y", Grade: [   // 학교별 기출유사
                { Name: "1학년", Value: "1", Subj_Code: [
                    { Name: "국어", Value: "KR"},
                    { Name: "영어", Value: "EG"},
                    { Name: "수학", Value: "MT"},
                    { Name: "과학", Value: "SC"},
                    { Name: "사회", Value: "LS"},
                    { Name: "역사", Value: "HI"}
                ]
                },
                { Name: "2학년", Value: "2", Subj_Code: [
                    { Name: "국어", Value: "KR"},
                    { Name: "영어", Value: "EG"},
                    { Name: "수학", Value: "MT"},
                    { Name: "과학", Value: "SC"},
                    { Name: "사회", Value: "LS"},
                    { Name: "역사", Value: "HI"}
                ]
                },
                { Name: "3학년", Value: "3", Subj_Code: [
                    { Name: "국어", Value: "KR"},
                    { Name: "영어", Value: "EG"},
                    { Name: "수학", Value: "MT"},
                    { Name: "과학", Value: "SC"},
                    { Name: "사회", Value: "LS"},
                    { Name: "역사", Value: "HI"}
                ]
                }
            ]
            },
            {Value: "A", Grade: [   // 학교별 기출 무료 열람실
                    { Name: "전체", Value: "", Subj_Code: [
                        { Name: "국어", Value: "KR"},
                        { Name: "영어", Value: "EG"},
                        { Name: "수학", Value: "MT"},
                        { Name: "과학", Value: "SC"},
                        { Name: "사회", Value: "LS"},
                        { Name: "역사", Value: "HI"},
                        { Name: "도덕", Value: "ET"},
                        { Name: "기술·가정", Value: "TH"},
                        { Name: "한문", Value: "CH"},
						{ Name: "기타", Value: "OT"}
                    ]
                    },
                    { Name: "1학년", Value: "1", Subj_Code: [
                        { Name: "국어", Value: "KR"},
                        { Name: "영어", Value: "EG"},
                        { Name: "수학", Value: "MT"},
                        { Name: "과학", Value: "SC"},
                        { Name: "사회", Value: "LS"},
                        { Name: "역사", Value: "HI"},
                        { Name: "도덕", Value: "ET"},
                        { Name: "기술·가정", Value: "TH"},
                        { Name: "한문", Value: "CH"},
						{ Name: "기타", Value: "OT"}
                    ]
                    },
                    { Name: "2학년", Value: "2", Subj_Code: [
                        { Name: "국어", Value: "KR"},
                        { Name: "영어", Value: "EG"},
                        { Name: "수학", Value: "MT"},
                        { Name: "과학", Value: "SC"},
                        { Name: "사회", Value: "LS"},
                        { Name: "역사", Value: "HI"},
                        { Name: "도덕", Value: "ET"},
                        { Name: "기술·가정", Value: "TH"},
                        { Name: "한문", Value: "CH"},
						{ Name: "기타", Value: "OT"}
                    ]
                    },
                    { Name: "3학년", Value: "3", Subj_Code: [
                        { Name: "국어", Value: "KR"},
                        { Name: "영어", Value: "EG"},
                        { Name: "수학", Value: "MT"},
                        { Name: "과학", Value: "SC"},
                        { Name: "사회", Value: "LS"},
                        { Name: "역사", Value: "HI"},
                        { Name: "도덕", Value: "ET"},
                        { Name: "기술·가정", Value: "TH"},
                        { Name: "한문", Value: "CH"},
						{ Name: "기타", Value: "OT"}
                    ]
                    }
                ]
            },
            {Value: "E", Grade: [   // 학교별 예상 족보
                    { Name: "1학년", Value: "1", Subj_Code: [
                        { Name: "국어", Value: "KR"},
                        { Name: "영어", Value: "EG"},
                        { Name: "수학", Value: "MT"},
                        { Name: "과학", Value: "SC"},
                        { Name: "사회①", Value: "LS"},
                        { Name: "도덕①", Value: "ET"},
                        { Name: "도덕②", Value: "ET"},
                        { Name: "기술가정①", Value: "TH"},
                        { Name: "역사", Value: "HI"},
                    ]
                    },
                    { Name: "2학년", Value: "2", Subj_Code: [
                        { Name: "국어", Value: "KR"},
                        { Name: "영어", Value: "EG"},
                        { Name: "수학", Value: "MT"},
                        { Name: "과학", Value: "SC"},
                        { Name: "사회①", Value: "LS"},
						{ Name: "사회②", Value: "LS"},
                        { Name: "도덕①", Value: "ET"},
                        { Name: "도덕②", Value: "ET"},
                        { Name: "기술가정①", Value: "TH"},
                        { Name: "역사", Value: "HI"},
                    ]
                    },
                    { Name: "3학년", Value: "3", Subj_Code: [
                        { Name: "국어", Value: "KR"},
                        { Name: "영어", Value: "EG"},
                        { Name: "수학", Value: "MT"},
                        { Name: "과학", Value: "SC"},
                        { Name: "사회②", Value: "LS"},
                        { Name: "도덕②", Value: "ET"},
                        { Name: "기술가정②", Value: "TH"},
                        { Name: "역사", Value: "HI"},
                    ]
                    }
                ]
            },
			{Value: "W", Grade: [   // 학교별 AI기출변형
                    { Name: "1학년", Value: "1", Subj_Code: [
                        { Name: "국어", Value: "KR"},
                        { Name: "영어", Value: "EG"},
                        { Name: "수학", Value: "MT"},
                        { Name: "과학", Value: "SC"},
                        { Name: "사회①", Value: "LS"},
                        { Name: "역사", Value: "HI"},
                    ]
                    },
                    { Name: "2학년", Value: "2", Subj_Code: [
                        /*{ Name: "국어", Value: "KR"},
                        { Name: "영어", Value: "EG"},
                        { Name: "수학", Value: "MT"},
                        { Name: "과학", Value: "SC"},
                        { Name: "사회 ①", Value: "LS"},
						{ Name: "사회 ②", Value: "LS"},
                        { Name: "역사", Value: "HI"},*/
                        { Name: "수학", Value: "MT"},
                        { Name: "과학", Value: "SC"},
                        { Name: "사회①", Value: "LS"},
						{ Name: "사회②", Value: "LS"},
                        { Name: "역사", Value: "HI"},
                    ]
                    },
                    { Name: "3학년", Value: "3", Subj_Code: [
                        { Name: "국어", Value: "KR"},
                        { Name: "영어", Value: "EG"},
                        { Name: "수학", Value: "MT"},
                        { Name: "과학", Value: "SC"},
                        { Name: "사회②", Value: "LS"},
                        { Name: "역사", Value: "HI"},
                    ]
                    }
                ]
            }
        ]
    },
        { Value: "M", ExPapr_CoreType: [ //서술형 문제
            {Value: "", Grade: [
                { Name: "1학년", Value: "1", Subj_Code: [
                    { Name: "국어", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "천재(노미숙)", Value: "MAKRCHA1001" },
                        { Name: "미래엔(민병곤)", Value: "MAKRCHA1002" },
                        { Name: "비상(박현숙)", Value: "MAKRCHA1003" },
                        { Name: "미래엔(신유식)", Value: "MAKRCHA1004" },
						{ Name: "천재(정호웅)", Value: "MAKRCHA1005" },
						{ Name: "비상(박영민)", Value: "MAKRCHA1006" },
						{ Name: "해냄(강양희)", Value: "MAKRCHA1007" },
						{ Name: "창비(이도영)", Value: "MAKRCHA1008" }
                    ]
                    },
                    { Name: "영어", Value: "EG", WithTxCode: true, TX_CODE: [
                        { Name: "천재(소영순)", Value: "MAEGCHA1001" },
                        { Name: "천재(이상기)", Value: "MAEGCHA1002" },
						{ Name: "능률(김기택)", Value: "MAEGCHA1003" },
						{ Name: "YBM(박준언)", Value: "MAEGCHA1004" },
						{ Name: "미래엔(문영인)", Value: "MAEGCHA1005"},
						{ Name: "동아(윤정미)", Value: "MAEGCHA1006" },
						{ Name: "동아(이병민)", Value: "MAEGCHA1007" },
                    ]
                    },
                    { Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "MAMTCHA1001" }
                    ]
                    },
                    { Name: "과학", Value: "SC", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "MASCCHA1001" }
                    ]
                    },
                    { Name: "사회", Value: "LS", WithTxCode: true, TX_CODE: [
                        { Name: "사회①", Value: "MALSCHA0001" }
                    ]
                    },
					{ Name: "역사", Value: "HI", WithTxCode: true, TX_CODE: [
						{ Name: "역사①", Value: "MAHICHA0001" }
                    ]
                    },
                    { Name: "도덕", Value: "ET", WithTxCode: true, TX_CODE: [
						{ Name: "도덕①", Value: "MAETCHA0001" },
						{ Name: "도덕②", Value: "MAETCHA0003" }
                    ]
					},
                    { Name: "기술가정", Value: "TH", WithTxCode: true, TX_CODE: [
						{ Name: "기술가정①", Value: "MATHCHA0001" }
                    ]
                    }
                ]
                },
                { Name: "2학년", Value: "2", Subj_Code: [
                    { Name: "국어", Value: "KR", WithTxCode: true, TX_CODE: [
						{ Name: "천재(노미숙)", Value: "MAKRCHA2001" },
                        { Name: "미래엔(민병곤)", Value: "MAKRCHA2002" },
                        { Name: "비상(박현숙)", Value: "MAKRCHA2003" },
                        { Name: "미래엔(신유식)", Value: "MAKRCHA2004" },
                        { Name: "천재(정호웅)", Value: "MAKRCHA2005" },
						{ Name: "비상(박영민)", Value: "MAKRCHA2006" },
						{ Name: "해냄(강양희)", Value: "MAKRCHA2007" },
						{ Name: "창비(이도영)", Value: "MAKRCHA2008" }
                    ]
                    },
                    { Name: "영어", Value: "EG", WithTxCode: true, TX_CODE: [ 
						{ Name: "천재(소영순)", Value: "MAEGCHA2001" },
                        { Name: "천재(이상기)", Value: "MAEGCHA2002" },
                        { Name: "능률(김기택)", Value: "MAEGCHA2003" },
                        { Name: "YBM(박준언)", Value: "MAEGCHA2004" },
                        { Name: "미래엔(문영인)", Value: "MAEGCHA2005" },
                        { Name: "동아(윤정미)", Value: "MAEGCHA2006" },
						{ Name: "동아(이병민)", Value: "MAEGCHA2007" },
                        { Name: "비상(황종배)", Value: "MAEGCHA2008" }
                    ]
                    },
					{ Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "MAMTCHA2001" }
                    ]
                    },
                    { Name: "과학", Value: "SC", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "MASCCHA2001" }
                    ]
                    },
                    { Name: "사회", Value: "LS", WithTxCode: true, TX_CODE: [
                        { Name: "사회①", Value: "MALSCHA0001" },
                        { Name: "사회②", Value: "MALSCHA0002" }
                    ]
                    },
                    { Name: "역사", Value: "HI", WithTxCode: true, TX_CODE: [
                        { Name: "역사①", Value: "MAHICHA0001" },
                        { Name: "역사②", Value: "M9HICHA0002" }
                    ]
                    },
					{ Name: "도덕", Value: "ET", WithTxCode: true, TX_CODE: [
                        { Name: "도덕①", Value: "MAETCHA0001" },
                        { Name: "도덕②", Value: "MAETCHA0003" }
                    ]
                    },
					{ Name: "기술가정", Value: "TH", WithTxCode: true, TX_CODE: [
                        { Name: "기술가정①", Value: "MATHCHA0001" },
                        { Name: "기술가정②", Value: "MATHCHA0004" }
                    ]
                    },
					{ Name: "한문", Value: "CH", WithTxCode: true, TX_CODE: [
                        { Name: "미래엔(송혁기)", Value: "MACHCHA0005" },
                        { Name: "비상(이동재)", Value: "MACHCHA0006" },
						{ Name: "천재(안대희)", Value: "MACHCHA0007" }
                    ]
                    }
                ]
                },
                { Name: "3학년", Value: "3", Subj_Code: [
                    { Name: "국어", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "미래엔(신유식)", Value: "M9KRCHA3001" },
                        { Name: "천재(박영목)", Value: "M9KRCHA3002" },
                        { Name: "비상(김진수)", Value: "M9KRCHA3003" },
                        { Name: "천재(노미숙)", Value: "M9KRCHA3004" },
                        { Name: "지학사(이삼형)", Value: "M9KRCHA3005" },
						{ Name: "창비(이도영)", Value: "M9KRCHA3006" }
                    ]
                    },
                    { Name: "영어", Value: "EG", WithTxCode: true, TX_CODE: [                        
                        { Name: "천재(이재영)", Value: "M9EGCHA3003" },
                        { Name: "미래엔(최연희)", Value: "M9EGCHA3004" },
                        { Name: "능률(김성곤)", Value: "M9EGCHA3005" },
                        { Name: "비상(김진완)", Value: "M9EGCHA3006" },
                        { Name: "천재(정사열)", Value: "M9EGCHA3007" },
                        { Name: "YBM(박준언)", Value: "M9EGCHA3008" },
						{ Name: "동아(윤정미)", Value: "M9EGCHA3001" },
                        { Name: "동아(이병민)", Value: "M9EGCHA3002" }
                    ]
                    },
                    { Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "M6MTCHA3001" }
                    ]
                    },
                    { Name: "과학", Value: "SC", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "M7SCCHA3001" }
                    ]
                    },
                    { Name: "사회", Value: "LS", WithTxCode: true, TX_CODE: [
                        { Name: "사회②", Value: "M9LSCHA0002" }
                    ]
                    },
                    { Name: "역사", Value: "HI", WithTxCode: true, TX_CODE: [
                        { Name: "역사①", Value: "M9HICHA0001" },
                        { Name: "역사②", Value: "M9HICHA0002" }
                    ]
                    },
					{ Name: "도덕", Value: "ET", WithTxCode: true, TX_CODE: [
                        { Name: "도덕②", Value: "M9ETCHA0002" }
                    ]
                    },
                    { Name: "기술가정", Value: "TH", WithTxCode: true, TX_CODE: [
                        { Name: "기술가정①", Value: "M9THCHA0001" },
                        { Name: "기술가정②", Value: "M9THCHA0002" }
                    ]
                    }
                ]
                }
            ]
        }
        ]
    },
        { Value: "H", ExPapr_CoreType: [
            { Value: "D", Grade: [ //최다빈출 문제
                {Name: "1학년", Value: "1", Subj_Code: [
                    { Name: "국어", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "천재(노미숙)", Value: "MAKRCHA1001" },
                        { Name: "미래엔(민병곤)", Value: "MAKRCHA1002" },
                        { Name: "비상(박현숙)", Value: "MAKRCHA1003" },
                        { Name: "미래엔(신유식)", Value: "MAKRCHA1004" },
						{ Name: "천재(정호웅)", Value: "MAKRCHA1005" },
						{ Name: "비상(박영민)", Value: "MAKRCHA1006" },
						{ Name: "해냄(강양희)", Value: "MAKRCHA1007" },
						{ Name: "창비(이도영)", Value: "MAKRCHA1008" }
                    ]
                    },
                    { Name: "영어", Value: "EG", WithTxCode: true, TX_CODE: [
                        { Name: "천재(소영순)", Value: "MAEGCHA1001" },
                        { Name: "천재(이상기)", Value: "MAEGCHA1002" },
						{ Name: "능률(김기택)", Value: "MAEGCHA1003" },
						{ Name: "YBM(박준언)", Value: "MAEGCHA1004" },
						{ Name: "미래엔(문영인)", Value: "MAEGCHA1005" },
						{ Name: "동아(윤정미)", Value: "MAEGCHA1006" },
						{ Name: "동아(이병민)", Value: "MAEGCHA1007" },
                    ]
                    },
                    { Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "MAMTCHA1001" }
                    ]
                    },
                    { Name: "과학", Value: "SC", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "MASCCHA1001" }
                    ]
                    },
                    { Name: "사회", Value: "LS", WithTxCode: true, TX_CODE: [
                        { Name: "사회①", Value: "MALSCHA0001" }
                    ]
                    },
					{ Name: "역사", Value: "HI", WithTxCode: true, TX_CODE: [
						{ Name: "역사①", Value: "MAHICHA0001" }
                    ]
                    },
                    { Name: "도덕", Value: "ET", WithTxCode: true, TX_CODE: [
						{ Name: "도덕①", Value: "MAETCHA0001" },
						{ Name: "도덕②", Value: "MAETCHA0003" }
                    ]
					},
                    { Name: "기술가정", Value: "TH", WithTxCode: true, TX_CODE: [
						{ Name: "기술가정①", Value: "MATHCHA0001" }
                    ]
                    }
                ]
                },
                { Name: "2학년", Value: "2", Subj_Code: [
                    { Name: "국어", Value: "KR", WithTxCode: true, TX_CODE: [
						{ Name: "천재(노미숙)", Value: "MAKRCHA2001" },
                        { Name: "미래엔(민병곤)", Value: "MAKRCHA2002" },
                        { Name: "비상(박현숙)", Value: "MAKRCHA2003" },
                        { Name: "미래엔(신유식)", Value: "MAKRCHA2004" },
                        { Name: "천재(정호웅)", Value: "MAKRCHA2005" },
						{ Name: "비상(박영민)", Value: "MAKRCHA2006" },
						{ Name: "해냄(강양희)", Value: "MAKRCHA2007" },
						{ Name: "창비(이도영)", Value: "MAKRCHA2008" }
                    ]
                    },
                    { Name: "영어", Value: "EG", WithTxCode: true, TX_CODE: [ 
						{ Name: "천재(소영순)", Value: "MAEGCHA2001" },
                        { Name: "천재(이상기)", Value: "MAEGCHA2002" },
                        { Name: "능률(김기택)", Value: "MAEGCHA2003" },
                        { Name: "YBM(박준언)", Value: "MAEGCHA2004" },
                        { Name: "미래엔(문영인)", Value: "MAEGCHA2005" },
                        { Name: "동아(윤정미)", Value: "MAEGCHA2006" },
						{ Name: "동아(이병민)", Value: "MAEGCHA2007" },
                        { Name: "비상(황종배)", Value: "MAEGCHA2008" }
                    ]
                    },
					{ Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "MAMTCHA2001" }
                    ]
                    },
                    { Name: "과학", Value: "SC", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "MASCCHA2001" }
                    ]
                    },
                    { Name: "사회", Value: "LS", WithTxCode: true, TX_CODE: [
                        { Name: "사회①", Value: "MALSCHA0001" },
                        { Name: "사회②", Value: "MALSCHA0002" }
                    ]
                    },
                    { Name: "역사", Value: "HI", WithTxCode: true, TX_CODE: [
                        { Name: "역사①", Value: "MAHICHA0001" },
                        { Name: "역사②", Value: "M9HICHA0002" }
                    ]
                    },
					{ Name: "도덕", Value: "ET", WithTxCode: true, TX_CODE: [
                        { Name: "도덕①", Value: "MAETCHA0001" },
                        { Name: "도덕②", Value: "MAETCHA0003" }
                    ]
                    },
					{ Name: "기술가정", Value: "TH", WithTxCode: true, TX_CODE: [
                        { Name: "기술가정①", Value: "MATHCHA0001" },
                        { Name: "기술가정②", Value: "MATHCHA0004" }
                    ]
                    },
					{ Name: "한문", Value: "CH", WithTxCode: true, TX_CODE: [
                        { Name: "미래엔(송혁기)", Value: "MACHCHA0005" },
                        { Name: "비상(이동재)", Value: "MACHCHA0006" },
						{ Name: "천재(안대희)", Value: "MACHCHA0007" }
                    ]
                    }
                ]
                },
                { Name: "3학년", Value: "3", Subj_Code: [
                    { Name: "국어", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "미래엔(신유식)", Value: "M9KRCHA3001" },
                        { Name: "천재(박영목)", Value: "M9KRCHA3002" },
                        { Name: "비상(김진수)", Value: "M9KRCHA3003" },
                        { Name: "천재(노미숙)", Value: "M9KRCHA3004" },
                        { Name: "지학사(이삼형)", Value: "M9KRCHA3005" },
						{ Name: "창비(이도영)", Value: "M9KRCHA3006" }
                    ]
                    },
                    { Name: "영어", Value: "EG", WithTxCode: true, TX_CODE: [                        
                        { Name: "천재(이재영)", Value: "M9EGCHA3003" },
                        { Name: "미래엔(최연희)", Value: "M9EGCHA3004" },
                        { Name: "능률(김성곤)", Value: "M9EGCHA3005" },
                        { Name: "비상(김진완)", Value: "M9EGCHA3006" },
                        { Name: "천재(정사열)", Value: "M9EGCHA3007" },
                        { Name: "YBM(박준언)", Value: "M9EGCHA3008" },
						{ Name: "동아(윤정미)", Value: "M9EGCHA3001" },
                        { Name: "동아(이병민)", Value: "M9EGCHA3002" }
                    ]
                    },
                    { Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "M6MTCHA3001" }
                    ]
                    },
                    { Name: "과학", Value: "SC", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "M7SCCHA3001" }
                    ]
                    },
                    { Name: "사회", Value: "LS", WithTxCode: true, TX_CODE: [
                        { Name: "사회②", Value: "M9LSCHA0002" }
                    ]
                    },
                    { Name: "역사", Value: "HI", WithTxCode: true, TX_CODE: [
                        { Name: "역사①", Value: "M9HICHA0001" },
                        { Name: "역사②", Value: "M9HICHA0002" }
                    ]
                    },
                    { Name: "도덕", Value: "ET", WithTxCode: true, TX_CODE: [
                        { Name: "도덕②", Value: "M9ETCHA0002" }
                    ]
                    },
                    { Name: "기술가정", Value: "TH", WithTxCode: true, TX_CODE: [
                        { Name: "기술가정①", Value: "M9THCHA0001" },
                        { Name: "기술가정②", Value: "M9THCHA0002" }
                    ]
                    }
                ]
                }
            ]
        },
            { Value: "E", Grade: [     // 최다오답 문제
                {Name: "1학년", Value: "1", Subj_Code: [
                    { Name: "국어", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "천재(노미숙)", Value: "MAKRCHA1001" },
                        { Name: "미래엔(민병곤)", Value: "MAKRCHA1002" },
                        { Name: "비상(박현숙)", Value: "MAKRCHA1003" },
                        { Name: "미래엔(신유식)", Value: "MAKRCHA1004" },
						{ Name: "천재(정호웅)", Value: "MAKRCHA1005" },
						{ Name: "비상(박영민)", Value: "MAKRCHA1006" },
						{ Name: "해냄(강양희)", Value: "MAKRCHA1007" },
						{ Name: "창비(이도영)", Value: "MAKRCHA1008" }
                    ]
                    },
                    { Name: "영어", Value: "EG", WithTxCode: true, TX_CODE: [
                        { Name: "천재(소영순)", Value: "MAEGCHA1001" },
                        { Name: "천재(이상기)", Value: "MAEGCHA1002" },
						{ Name: "능률(김기택)", Value: "MAEGCHA1003" },
						{ Name: "YBM(박준언)", Value: "MAEGCHA1004" },
						{ Name: "미래엔(문영인)", Value: "MAEGCHA1005" },
						{ Name: "동아(윤정미)", Value: "MAEGCHA1006" },
						{ Name: "동아(이병민)", Value: "MAEGCHA1007" },
                    ]
                    },
                    { Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "MAMTCHA1001" }
                    ]
                    },
                    { Name: "과학", Value: "SC", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "MASCCHA1001" }
                    ]
                    },
                    { Name: "사회", Value: "LS", WithTxCode: true, TX_CODE: [
                        { Name: "사회①", Value: "MALSCHA0001" }
                    ]
                    },
					{ Name: "역사", Value: "HI", WithTxCode: true, TX_CODE: [
						{ Name: "역사①", Value: "MAHICHA0001" }
                    ]
                    },
                    { Name: "도덕", Value: "ET", WithTxCode: true, TX_CODE: [
						{ Name: "도덕①", Value: "MAETCHA0001" },
						{ Name: "도덕②", Value: "MAETCHA0003" }
                    ]
					},
                    { Name: "기술가정", Value: "TH", WithTxCode: true, TX_CODE: [
						{ Name: "기술가정①", Value: "MATHCHA0001" }
                    ]
                    }
                ]
                },
                { Name: "2학년", Value: "2", Subj_Code: [
                    { Name: "국어", Value: "KR", WithTxCode: true, TX_CODE: [
						{ Name: "천재(노미숙)", Value: "MAKRCHA2001" },
                        { Name: "미래엔(민병곤)", Value: "MAKRCHA2002" },
                        { Name: "비상(박현숙)", Value: "MAKRCHA2003" },
                        { Name: "미래엔(신유식)", Value: "MAKRCHA2004" },
                        { Name: "천재(정호웅)", Value: "MAKRCHA2005" },
						{ Name: "비상(박영민)", Value: "MAKRCHA2006" },
						{ Name: "해냄(강양희)", Value: "MAKRCHA2007" },
						{ Name: "창비(이도영)", Value: "MAKRCHA2008" }
                    ]
                    },
                    { Name: "영어", Value: "EG", WithTxCode: true, TX_CODE: [ 
						{ Name: "천재(소영순)", Value: "MAEGCHA2001" },
                        { Name: "천재(이상기)", Value: "MAEGCHA2002" },
                        { Name: "능률(김기택)", Value: "MAEGCHA2003" },
                        { Name: "YBM(박준언)", Value: "MAEGCHA2004" },
                        { Name: "미래엔(문영인)", Value: "MAEGCHA2005" },
                        { Name: "동아(윤정미)", Value: "MAEGCHA2006" },
						{ Name: "동아(이병민)", Value: "MAEGCHA2007" },
                        { Name: "비상(황종배)", Value: "MAEGCHA2008" }
                    ]
                    },
					{ Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "MAMTCHA2001" }
                    ]
                    },
                    { Name: "과학", Value: "SC", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "MASCCHA2001" }
                    ]
                    },
                    { Name: "사회", Value: "LS", WithTxCode: true, TX_CODE: [
                        { Name: "사회①", Value: "MALSCHA0001" },
                        { Name: "사회②", Value: "MALSCHA0002" }
                    ]
                    },
                    { Name: "역사", Value: "HI", WithTxCode: true, TX_CODE: [
                        { Name: "역사①", Value: "MAHICHA0001" },
                        { Name: "역사②", Value: "M9HICHA0002" }
                    ]
                    },
					{ Name: "도덕", Value: "ET", WithTxCode: true, TX_CODE: [
                        { Name: "도덕①", Value: "MAETCHA0001" },
                        { Name: "도덕②", Value: "MAETCHA0003" }
                    ]
                    },
					{ Name: "기술가정", Value: "TH", WithTxCode: true, TX_CODE: [
                        { Name: "기술가정①", Value: "MATHCHA0001" },
                        { Name: "기술가정②", Value: "MATHCHA0004" }
                    ]
                    },
					{ Name: "한문", Value: "CH", WithTxCode: true, TX_CODE: [
                        { Name: "미래엔(송혁기)", Value: "MACHCHA0005" },
                        { Name: "비상(이동재)", Value: "MACHCHA0006" },
						{ Name: "천재(안대희)", Value: "MACHCHA0007" }
                    ]
                    }
                ]
                },
                { Name: "3학년", Value: "3", Subj_Code: [
                    { Name: "국어", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "미래엔(신유식)", Value: "M9KRCHA3001" },
                        { Name: "천재(박영목)", Value: "M9KRCHA3002" },
                        { Name: "비상(김진수)", Value: "M9KRCHA3003" },
                        { Name: "천재(노미숙)", Value: "M9KRCHA3004" },
                        { Name: "지학사(이삼형)", Value: "M9KRCHA3005" },
						{ Name: "창비(이도영)", Value: "M9KRCHA3006" }
                    ]
                    },
                    { Name: "영어", Value: "EG", WithTxCode: true, TX_CODE: [                        
                        { Name: "천재(이재영)", Value: "M9EGCHA3003" },
                        { Name: "미래엔(최연희)", Value: "M9EGCHA3004" },
                        { Name: "능률(김성곤)", Value: "M9EGCHA3005" },
                        { Name: "비상(김진완)", Value: "M9EGCHA3006" },
                        { Name: "천재(정사열)", Value: "M9EGCHA3007" },
                        { Name: "YBM(박준언)", Value: "M9EGCHA3008" },
						{ Name: "동아(윤정미)", Value: "M9EGCHA3001" },
                        { Name: "동아(이병민)", Value: "M9EGCHA3002" }
                    ]
                    },
                    { Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "M6MTCHA3001" }
                    ]
                    },
                    { Name: "과학", Value: "SC", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "M7SCCHA3001" }
                    ]
                    },
                    { Name: "사회", Value: "LS", WithTxCode: true, TX_CODE: [
                        { Name: "사회②", Value: "M9LSCHA0002" }
                    ]
                    },
                    { Name: "역사", Value: "HI", WithTxCode: true, TX_CODE: [
                        { Name: "역사①", Value: "M9HICHA0001" },
                        { Name: "역사②", Value: "M9HICHA0002" }
                    ]
                    },
                    { Name: "도덕", Value: "ET", WithTxCode: true, TX_CODE: [
                        { Name: "도덕②", Value: "M9ETCHA0002" }
                    ]
                    },
                    { Name: "기술가정", Value: "TH", WithTxCode: true, TX_CODE: [
                        { Name: "기술가정①", Value: "M9THCHA0001" },
                        { Name: "기술가정②", Value: "M9THCHA0002" }
                    ]
                    }
                ]
                }
            ]
        },

		{Value: "G", Grade: [ //최상위 공략
                { Name: "1학년", Value: "1", Subj_Code: [
                        { Name: "국어", Value: "KR", WithTxCode: true, TX_CODE: [
							{ Name: "천재(노미숙)", Value: "MAKRCHA1001" },
							{ Name: "미래엔(민병곤)", Value: "MAKRCHA1002" },
							{ Name: "비상(박현숙)", Value: "MAKRCHA1003" },
							{ Name: "미래엔(신유식)", Value: "MAKRCHA1004" },
							{ Name: "천재(정호웅)", Value: "MAKRCHA1005" },
							{ Name: "비상(박영민)", Value: "MAKRCHA1006" },
							{ Name: "해냄(강양희)", Value: "MAKRCHA1007" },
							{ Name: "창비(이도영)", Value: "MAKRCHA1008" }
						]
						},
						{ Name: "영어", Value: "EG", WithTxCode: true, TX_CODE: [
							{ Name: "천재(소영순)", Value: "MAEGCHA1001" },
							{ Name: "천재(이상기)", Value: "MAEGCHA1002" },
							{ Name: "능률(김기택)", Value: "MAEGCHA1003" },
							{ Name: "YBM(박준언)", Value: "MAEGCHA1004" },
							{ Name: "미래엔(문영인)", Value: "MAEGCHA1005" },
							{ Name: "동아(윤정미)", Value: "MAEGCHA1006" },
							{ Name: "동아(이병민)", Value: "MAEGCHA1007" },
						]
						},
						{ Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
							{ Name: "공통", Value: "MAMTCHA1001" }
						]
						},
						{ Name: "과학", Value: "SC", WithTxCode: true, TX_CODE: [
							{ Name: "공통", Value: "MASCCHA1001" }
						]
						},
						{ Name: "사회", Value: "LS", WithTxCode: true, TX_CODE: [
							{ Name: "사회①", Value: "MALSCHA0001" }
						]
						},
						{ Name: "역사", Value: "HI", WithTxCode: true, TX_CODE: [
							{ Name: "역사①", Value: "MAHICHA0001" }
						]
						}
                    ]
                },
                { Name: "2학년", Value: "2", Subj_Code: [
                        { Name: "국어", Value: "KR", WithTxCode: true, TX_CODE: [
							{ Name: "천재(노미숙)", Value: "MAKRCHA2001" },
							{ Name: "미래엔(민병곤)", Value: "MAKRCHA2002" },
							{ Name: "비상(박현숙)", Value: "MAKRCHA2003" },
							{ Name: "미래엔(신유식)", Value: "MAKRCHA2004" },
							{ Name: "천재(정호웅)", Value: "MAKRCHA2005" },
							{ Name: "비상(박영민)", Value: "MAKRCHA2006" },
							{ Name: "해냄(강양희)", Value: "MAKRCHA2007" },
							{ Name: "창비(이도영)", Value: "MAKRCHA2008" }
						]
						},
						{ Name: "영어", Value: "EG", WithTxCode: true, TX_CODE: [ 
							{ Name: "천재(소영순)", Value: "MAEGCHA2001" },
							{ Name: "천재(이상기)", Value: "MAEGCHA2002" },
							{ Name: "능률(김기택)", Value: "MAEGCHA2003" },
							{ Name: "YBM(박준언)", Value: "MAEGCHA2004" },
							{ Name: "미래엔(문영인)", Value: "MAEGCHA2005" },
							{ Name: "동아(윤정미)", Value: "MAEGCHA2006" },
							{ Name: "동아(이병민)", Value: "MAEGCHA2007" },
							{ Name: "비상(황종배)", Value: "MAEGCHA2008" }
						]
						},
						{ Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
							{ Name: "공통", Value: "MAMTCHA2001" }
						]
						},
						{ Name: "과학", Value: "SC", WithTxCode: true, TX_CODE: [
							{ Name: "공통", Value: "MASCCHA2001" }
						]
						},
						{ Name: "사회", Value: "LS", WithTxCode: true, TX_CODE: [
							{ Name: "사회①", Value: "MALSCHA0001" },
							{ Name: "사회②", Value: "MALSCHA0002" }
						]
						},
						{ Name: "역사", Value: "HI", WithTxCode: true, TX_CODE: [
							{ Name: "역사①", Value: "MAHICHA0001" },
							{ Name: "역사②", Value: "M9HICHA0002" }
						]
						},
						{ Name: "도덕", Value: "ET", WithTxCode: true, TX_CODE: [
							{ Name: "도덕①", Value: "MAETCHA0001" },
							{ Name: "도덕②", Value: "MAETCHA0003" }
						]
						},
						{ Name: "기술가정", Value: "TH", WithTxCode: true, TX_CODE: [
							{ Name: "기술가정①", Value: "MATHCHA0001" },
							{ Name: "기술가정②", Value: "MATHCHA0004" }
						]
						},
						{ Name: "한문", Value: "CH", WithTxCode: true, TX_CODE: [
							{ Name: "미래엔(송혁기)", Value: "MACHCHA0005" },
							{ Name: "비상(이동재)", Value: "MACHCHA0006" },
							{ Name: "천재(안대희)", Value: "MACHCHA0007" }
						]
						}
                    ]
                },
                { Name: "3학년", Value: "3", Subj_Code: [
                        { Name: "국어", Value: "KR", WithTxCode: true, TX_CODE: [
                                { Name: "미래엔(신유식)", Value: "M9KRCHA3001" },
                                { Name: "천재(박영목)", Value: "M9KRCHA3002" },
                                { Name: "비상(김진수)", Value: "M9KRCHA3003" },
                                { Name: "천재(노미숙)", Value: "M9KRCHA3004" },
                                { Name: "지학사(이삼형)", Value: "M9KRCHA3005" },
								{ Name: "창비(이도영)", Value: "M9KRCHA3006" }
                            ]
                        },
                        { Name: "영어", Value: "EG", WithTxCode: true, TX_CODE: [
                                { Name: "천재(이재영)", Value: "M9EGCHA3003" },
                                { Name: "미래엔(최연희)", Value: "M9EGCHA3004" },
                                { Name: "능률(김성곤)", Value: "M9EGCHA3005" },
                                { Name: "비상(김진완)", Value: "M9EGCHA3006" },
                                { Name: "천재(정사열)", Value: "M9EGCHA3007" },
                                { Name: "YBM(박준언)", Value: "M9EGCHA3008" },
								{ Name: "동아(윤정미)", Value: "M9EGCHA3001" },
                                { Name: "동아(이병민)", Value: "M9EGCHA3002" }
                            ]
                        },
                        { Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
                                { Name: "공통", Value: "M6MTCHA3001" }
                            ]
                        },
                        { Name: "과학", Value: "SC", WithTxCode: true, TX_CODE: [
                                { Name: "공통", Value: "M7SCCHA3001" }
                            ]
                        },
                        { Name: "사회", Value: "LS", WithTxCode: true, TX_CODE: [
                                { Name: "사회②", Value: "M9LSCHA0002" }
                            ]
                        },
                        { Name: "역사", Value: "HI", WithTxCode: true, TX_CODE: [
                                { Name: "역사①", Value: "M9HICHA0001" },
                                { Name: "역사②", Value: "M9HICHA0002" },
                                { Name: "역사①", Value: "M8HICHAA001", OldData: "Y" }	,
                                { Name: "역사②", Value: "M8HICHAA002", OldData: "Y" }
                            ]
                        },
                        { Name: "도덕", Value: "ET", WithTxCode: true, TX_CODE: [
                                { Name: "도덕②", Value: "M9ETCHA0002" }
                            ]
                        },
                        { Name: "기술가정", Value: "TH", WithTxCode: true, TX_CODE: [
                                { Name: "기술가정①", Value: "M9THCHA0001" },
                                { Name: "기술가정②", Value: "M9THCHA0002" }
                            ]
                        },
                        { Name: "한문", Value: "CH", WithTxCode: true, TX_CODE: [
                                { Name: "미래엔(심경호)", Value: "M9CHCHA0001" },
                                { Name: "비상(이동재)", Value: "M9CHCHA0002" },
                                { Name: "천재(안대회)", Value: "M9CHCHA0003" }
                            ]
                        }
                    ]
                }
            ]
        },
	
            { Value: "", Grade: [ // 요점정리, 개념완성
                {Name: "1학년", Value: "1", Subj_Code: [
                    { Name: "국어", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "천재(노미숙)", Value: "MAKRCHA1001" },
                        { Name: "미래엔(민병곤)", Value: "MAKRCHA1002" },
                        { Name: "비상(박현숙)", Value: "MAKRCHA1003" },
                        { Name: "미래엔(신유식)", Value: "MAKRCHA1004" },
						{ Name: "천재(정호웅)", Value: "MAKRCHA1005" },
						{ Name: "비상(박영민)", Value: "MAKRCHA1006" },
						{ Name: "해냄(강양희)", Value: "MAKRCHA1007" },
						{ Name: "창비(이도영)", Value: "MAKRCHA1008" }
                    ]
                    },
                    { Name: "영어", Value: "EG", WithTxCode: true, TX_CODE: [
                        { Name: "천재(소영순)", Value: "MAEGCHA1001" },
                        { Name: "천재(이상기)", Value: "MAEGCHA1002" },
						{ Name: "능률(김기택)", Value: "MAEGCHA1003" },
						{ Name: "YBM(박준언)", Value: "MAEGCHA1004" },
						{ Name: "미래엔(문영인)", Value: "MAEGCHA1005" },
						{ Name: "동아(윤정미)", Value: "MAEGCHA1006" },
						{ Name: "동아(이병민)", Value: "MAEGCHA1007" },
						{ Name: "비상(황종배)", Value: "MAEGCHA1008" }
                    ]
                    },
                    { Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "MAMTCHA1001" }
                    ]
                    },
                    { Name: "과학", Value: "SC", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "MASCCHA1001" }
                    ]
                    },
                    { Name: "사회", Value: "LS", WithTxCode: true, TX_CODE: [
                        { Name: "사회①", Value: "MALSCHA0001" }
                    ]
                    },
					{ Name: "역사", Value: "HI", WithTxCode: true, TX_CODE: [
						{ Name: "역사①", Value: "MAHICHA0001" }
                    ]
                    },
                    { Name: "도덕", Value: "ET", WithTxCode: true, TX_CODE: [
						{ Name: "도덕①", Value: "MAETCHA0001" },
						{ Name: "도덕②", Value: "MAETCHA0003" }
                    ]
					},
                    { Name: "기술가정", Value: "TH", WithTxCode: true, TX_CODE: [
						{ Name: "기술가정①", Value: "MATHCHA0001" }
                    ]
                    },
					{ Name: "한문", Value: "CH", WithTxCode: true, TX_CODE: [
						{ Name: "미래엔(송혁기)", Value: "MACHCHA0005" },
						{ Name: "비상(이동재)", Value: "MACHCHA0006" },
						{ Name: "천재(안대회)", Value: "MACHCHA0007" }
                    ]
                    }
                ]
                },
                { Name: "2학년", Value: "2", Subj_Code: [
                    { Name: "국어", Value: "KR", WithTxCode: true, TX_CODE: [
						{ Name: "천재(노미숙)", Value: "MAKRCHA2001" },
                        { Name: "미래엔(민병곤)", Value: "MAKRCHA2002" },
                        { Name: "비상(박현숙)", Value: "MAKRCHA2003" },
                        { Name: "미래엔(신유식)", Value: "MAKRCHA2004" },
                        { Name: "천재(정호웅)", Value: "MAKRCHA2005" },
						{ Name: "비상(박영민)", Value: "MAKRCHA2006" },
						{ Name: "해냄(강양희)", Value: "MAKRCHA2007" },
						{ Name: "창비(이도영)", Value: "MAKRCHA2008" }
                    ]
                    },
                    { Name: "영어", Value: "EG", WithTxCode: true, TX_CODE: [ 
						{ Name: "천재(소영순)", Value: "MAEGCHA2001" },
                        { Name: "천재(이상기)", Value: "MAEGCHA2002" },
                        { Name: "능률(김기택)", Value: "MAEGCHA2003" },
                        { Name: "YBM(박준언)", Value: "MAEGCHA2004" },
                        { Name: "미래엔(문영인)", Value: "MAEGCHA2005" },
                        { Name: "동아(윤정미)", Value: "MAEGCHA2006" },
						{ Name: "동아(이병민)", Value: "MAEGCHA2007" },
                        { Name: "비상(황종배)", Value: "MAEGCHA2008" }
                    ]
                    },
					{ Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "MAMTCHA2001" }
                    ]
                    },
                    { Name: "과학", Value: "SC", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "MASCCHA2001" }
                    ]
                    },
                    { Name: "사회", Value: "LS", WithTxCode: true, TX_CODE: [
                        { Name: "사회①", Value: "MALSCHA0001" },
                        { Name: "사회②", Value: "MALSCHA0002" }
                    ]
                    },
                    { Name: "역사", Value: "HI", WithTxCode: true, TX_CODE: [
                        { Name: "역사①", Value: "MAHICHA0001" },
                        { Name: "역사②", Value: "M9HICHA0002" }
                    ]
                    },
					{ Name: "도덕", Value: "ET", WithTxCode: true, TX_CODE: [
                        { Name: "도덕①", Value: "MAETCHA0001" },
                        { Name: "도덕②", Value: "MAETCHA0003" }
                    ]
                    },
					{ Name: "기술가정", Value: "TH", WithTxCode: true, TX_CODE: [
                        { Name: "기술가정①", Value: "MATHCHA0001" },
                        { Name: "기술가정②", Value: "MATHCHA0004" }
                    ]
                    },
					{ Name: "한문", Value: "CH", WithTxCode: true, TX_CODE: [
                        { Name: "미래엔(송혁기)", Value: "MACHCHA0005" },
                        { Name: "비상(이동재)", Value: "MACHCHA0006" },
						{ Name: "천재(안대희)", Value: "MACHCHA0007" }
                    ]
                    }
                ]
                },
                { Name: "3학년", Value: "3", Subj_Code: [
                    { Name: "국어", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "미래엔(신유식)", Value: "M9KRCHA3001" },
                        { Name: "천재(박영목)", Value: "M9KRCHA3002" },
                        { Name: "비상(김진수)", Value: "M9KRCHA3003" },
                        { Name: "천재(노미숙)", Value: "M9KRCHA3004" },
                        { Name: "지학사(이삼형)", Value: "M9KRCHA3005" }
                    ]
                    },
                    { Name: "영어", Value: "EG", WithTxCode: true, TX_CODE: [                        
                        { Name: "천재(이재영)", Value: "M9EGCHA3003" },
                        { Name: "미래엔(최연희)", Value: "M9EGCHA3004" },
                        { Name: "능률(김성곤)", Value: "M9EGCHA3005" },
                        { Name: "비상(김진완)", Value: "M9EGCHA3006" },
                        { Name: "천재(정사열)", Value: "M9EGCHA3007" },
                        { Name: "YBM(박준언)", Value: "M9EGCHA3008" },
						{ Name: "동아(윤정미)", Value: "M9EGCHA3001" },
                        { Name: "동아(이병민)", Value: "M9EGCHA3002" }
                    ]
                    },
                    { Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "M6MTCHA3001" }
                    ]
                    },
                    { Name: "과학", Value: "SC", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "M7SCCHA3001" }
                    ]
                    },
                    { Name: "사회", Value: "LS", WithTxCode: true, TX_CODE: [
                        { Name: "사회②", Value: "M9LSCHA0002" }
                    ]
                    },
                    { Name: "역사", Value: "HI", WithTxCode: true, TX_CODE: [
						{ Name: "역사①", Value: "M9HICHA0001" },
                        { Name: "역사②", Value: "M9HICHA0002" }
                    ]
                    },
                    { Name: "도덕", Value: "ET", WithTxCode: true, TX_CODE: [
                        { Name: "도덕①", Value: "M9ETCHA0001" },
                        { Name: "도덕②", Value: "M9ETCHA0002" }
                    ]
                    },
                    { Name: "기술가정", Value: "TH", WithTxCode: true, TX_CODE: [
                        { Name: "기술가정①", Value: "M9THCHA0001" },
                        { Name: "기술가정②", Value: "M9THCHA0002" }
                    ]
                    },
                    { Name: "한문", Value: "CH", WithTxCode: true, TX_CODE: [
                        { Name: "미래엔(심경호)", Value: "M9CHCHA0001" },
                        { Name: "비상(이동재)", Value: "M9CHCHA0002" },
                        { Name: "천재(안대회)", Value: "M9CHCHA0003" }
                    ]
                    }
                ]
                }
            ]
        },
            { Value: "C", Grade: [ //대표유형
                {Name: "1학년", Value: "1", Subj_Code: [
                    { Name: "국어", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "미래엔(신유식)", Value: "M9KRCHA1001" },
                        { Name: "천재(박영목)", Value: "M9KRCHA1002" },
                        { Name: "비상(김진수)", Value: "M9KRCHA1003" },
                        { Name: "천재(노미숙)", Value: "M9KRCHA1004" }
                    ]
                    },
                    { Name: "영어", Value: "EG", WithTxCode: true, TX_CODE: [                        
                        { Name: "미래엔(최연희)", Value: "M9EGCHA1003" },
                        { Name: "천재(이재영)", Value: "M9EGCHA1004" },
						{ Name: "동아(윤정미)", Value: "M9EGCHA1001" },
                        { Name: "동아(이병민)", Value: "M9EGCHA1002" }
                    ]
                    },
                    { Name: "수학", Value: "MT" },
                    { Name: "사회", Value: "LS", WithTxCode: true, TX_CODE: [
                        { Name: "사회①", Value: "M9LSCHA0001" }
                    ]
                    },
                    { Name: "역사", Value: "HI", WithTxCode: true, TX_CODE: [
                        { Name: "역사①", Value: "M8HICHAA001" }
                    ]
                    },
                    { Name: "과학", Value: "SC" }
                ]
            },
                { Name: "2학년", Value: "2", Subj_Code: [
                    { Name: "수학", Value: "MT" },
                    { Name: "사회", Value: "LS", WithTxCode: true, TX_CODE: [
                        { Name: "사회①", Value: "M9LSCHA0001" },
                        { Name: "사회②", Value: "M9LSCHA0002" }
                    ]
                    },
                    { Name: "역사", Value: "HI", WithTxCode: true, TX_CODE: [
                        { Name: "역사①", Value: "M8HICHAA001" },
                        { Name: "역사②", Value: "M8HICHAA002" }
                    ]
                    },
                    { Name: "과학", Value: "SC" }
                ]
                },
                { Name: "3학년", Value: "3", Subj_Code: [
                    { Name: "국어", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "천재(노미숙)", Value: "M8KRCHA3001" },
                        { Name: "천재(박영목)", Value: "M8KRCHA3016" },
                        { Name: "비상(김태철)", Value: "M8KRCHA3013" },
                        { Name: "미래엔(윤여탁)", Value: "M8KRCHA3017" },
                        { Name: "천재(김종철)", Value: "M8KRCHA3018" }
                    ]
                    },
                    { Name: "영어", Value: "EG", WithTxCode: true, TX_CODE: [
                        { Name: "동아(김성곤)", Value: "M7EGCHA3004" },
                        { Name: "천재(이재영)", Value: "M7EGCHA3015" },
                        { Name: "천재(김진완)", Value: "M7EGCHA3013" },
                        { Name: "천재(정사열)", Value: "M8EGCHA3001" },
                        { Name: "비상(이석재)", Value: "M8EGCHA3002" },
                        { Name: "미래엔(배두본)", Value: "M8EGCHA3003" },
                        { Name: "동아(이병민)", Value: "M7EGCHA3012" }
                    ]
                    },
                    { Name: "수학", Value: "MT" },
                    { Name: "과학", Value: "SC" },
                    { Name: "사회", Value: "LS", WithTxCode: true, TX_CODE: [
                        { Name: "사회①", Value: "M8LSCHAA001" },
                        { Name: "사회②", Value: "M8LSCHAA002" }
                    ]
                    },
                    { Name: "역사", Value: "HI", WithTxCode: true, TX_CODE: [
                        { Name: "역사①", Value: "M8HICHAA001" },
                        { Name: "역사②", Value: "M8HICHAA002" }
                    ]
                    }
                ]
                }
            ]
        }
            ,
            { Value: "T", Grade: [ //영어 문법 족보
                {Name: "1학년", Value: "1", Subj_Code: [
                    { Name: "영어", Value: "EG", WithTxCode: true, TX_CODE: [
                        { Name: "천재(소영순)", Value: "MAEGCHA1001" },
						{ Name: "천재(이상기)", Value: "MAEGCHA1002" },
						{ Name: "능률(김기택)", Value: "MAEGCHA1003" },
						{ Name: "YBM(박준언)", Value: "MAEGCHA1004" },
						{ Name: "미래엔(문영인)", Value: "MAEGCHA1005" },
						{ Name: "동아(윤정미)", Value: "MAEGCHA1006" },
						{ Name: "동아(이병민)", Value: "MAEGCHA1007" }
                    ]
                    }
                ]
                },
                { Name: "2학년", Value: "2", Subj_Code: [
                    { Name: "영어", Value: "EG", WithTxCode: true, TX_CODE: [                        
                        { Name: "천재(소영순)", Value: "MAEGCHA2001" },
                        { Name: "천재(이상기)", Value: "MAEGCHA2002" },
                        { Name: "능률(김기택)", Value: "MAEGCHA2003" },
                        { Name: "YBM(박준언)", Value: "MAEGCHA2004" },
                        { Name: "미래엔(문영인)", Value: "MAEGCHA2005" },
                        { Name: "동아(윤정미)", Value: "MAEGCHA2006" },
						{ Name: "동아(이병민)", Value: "MAEGCHA2007" },
                        { Name: "비상(황종배)", Value: "MAEGCHA2008" }
                    ]
                    }
                ]
                },
                { Name: "3학년", Value: "3", Subj_Code: [
                    { Name: "영어", Value: "EG", WithTxCode: true, TX_CODE: [                        
                        { Name: "천재(이재영)", Value: "M9EGCHA3003" },
                        { Name: "미래엔(최연희)", Value: "M9EGCHA3004" },
                        { Name: "능률(김성곤)", Value: "M9EGCHA3005" },
                        { Name: "비상(김진완)", Value: "M9EGCHA3006" },
                        { Name: "천재(정사열)", Value: "M9EGCHA3007" },
                        { Name: "YBM(박준언)", Value: "M9EGCHA3008" },
						{ Name: "동아(윤정미)", Value: "M9EGCHA3001" },
                        { Name: "동아(이병민)", Value: "M9EGCHA3002" }
                    ]
                    }
                ]
                }
            ]
        },
            { Value: "V", Grade: [ //개념 확인 학습  (암기노트)
                {Name: "1학년", Value: "1", Subj_Code: [
                    { Name: "국어", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "천재(노미숙)", Value: "MAKRCHA1001" },
                        { Name: "미래엔(민병곤)", Value: "MAKRCHA1002" },
                        { Name: "비상(박현숙)", Value: "MAKRCHA1003" },
                        { Name: "미래엔(신유식)", Value: "MAKRCHA1004" },
						{ Name: "천재(정호웅)", Value: "MAKRCHA1005" },
						{ Name: "비상(박영민)", Value: "MAKRCHA1006" },
						{ Name: "해냄(강양희)", Value: "MAKRCHA1007" }
                    ]
                    },
                    { Name: "영어", Value: "EG", WithTxCode: true, TX_CODE: [
                        { Name: "천재(소영순)", Value: "MAEGCHA1001" },
                        { Name: "천재(이상기)", Value: "MAEGCHA1002" },
						{ Name: "능률(김기택)", Value: "MAEGCHA1003" },
						{ Name: "YBM(박준언)", Value: "MAEGCHA1004" },
						{ Name: "미래엔(문영인)", Value: "MAEGCHA1005" }
                    ]
                    },
                    { Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "MAMTCHA1001" }
                    ]
                    },
                    { Name: "과학", Value: "SC", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "MASCCHA1001" }
                    ]
                    },
                    { Name: "사회", Value: "LS", WithTxCode: true, TX_CODE: [
                        { Name: "사회①", Value: "MALSCHA0001" }
                    ]
                    },
					{ Name: "역사", Value: "HI", WithTxCode: true, TX_CODE: [
						{ Name: "역사①", Value: "M9HICHA0001" },
						{ Name: "역사①", Value: "M8HICHAA001", OldData: "Y" }
                    ]
                    },
                    { Name: "도덕", Value: "ET", WithTxCode: true, TX_CODE: [
						{ Name: "도덕①", Value: "MAETCHA0001" }
                    ]
					},
                    { Name: "기술가정", Value: "TH", WithTxCode: true, TX_CODE: [
						{ Name: "기술가정①", Value: "MATHCHA0001" }
                    ]
                    }
                ]
                },
                { Name: "2학년", Value: "2", Subj_Code: [
                    { Name: "국어", Value: "KR", TX_CODE: [
                        { Name: "미래엔(신유식)", Value: "M9KRCHA2001" },
                        { Name: "천재(박영목)", Value: "M9KRCHA2002" },
                        { Name: "비상(김진수)", Value: "M9KRCHA2003" },
                        { Name: "천재(노미숙)", Value: "M9KRCHA2004" },
                        { Name: "지학사(이삼형)", Value: "M9KRCHA2005" }
                    ]
                    },
                    { Name: "영어", Value: "EG", TX_CODE: [                        
                        { Name: "천재(이재영)", Value: "M9EGCHA2003" },
                        { Name: "미래엔(최연희)", Value: "M9EGCHA2004" },
                        { Name: "능률(김성곤)", Value: "M9EGCHA2005" },
                        { Name: "비상(김진완)", Value: "M9EGCHA2006" },
                        { Name: "천재(정사열)", Value: "M9EGCHA2007" },
                        { Name: "YBM(박준언)", Value: "M9EGCHA2008" },
						{ Name: "동아(윤정미)", Value: "M9EGCHA2001" },
                        { Name: "동아(이병민)", Value: "M9EGCHA2002" }
                    ]
                    },
                    { Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "M6MTCHA2001" }
                    ]
                    },
                    { Name: "과학", Value: "SC", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "M7SCCHA2001" }
                    ]
                    },
                    { Name: "사회", Value: "LS", WithTxCode: true, TX_CODE: [
                        { Name: "사회①", Value: "M9LSCHA0001" },
                        { Name: "사회②", Value: "M9LSCHA0002" }
                    ]
                    },
                    { Name: "역사", Value: "HI", WithTxCode: true, TX_CODE: [
                        { Name: "역사①", Value: "M8HICHAA001" },
                        { Name: "역사②", Value: "M8HICHAA002" }
                    ]
                    },
                    { Name: "도덕", Value: "ET", WithTxCode: true, TX_CODE: [
                        { Name: "도덕①", Value: "M9ETCHA0001" },
                        { Name: "도덕②", Value: "M9ETCHA0002" }
                    ]
                    },
                    { Name: "기술가정", Value: "TH", WithTxCode: true, TX_CODE: [
                        { Name: "기술가정①", Value: "M9THCHA0001" },
                        { Name: "기술가정②", Value: "M9THCHA0002" }
                    ]
                    },
                    { Name: "한문", Value: "CH", WithTxCode: true, TX_CODE: [
                        { Name: "미래엔(심경호)", Value: "M9CHCHA0001" },
                        { Name: "비상(이동재)", Value: "M9CHCHA0002" },
                        { Name: "천재(안대회)", Value: "M9CHCHA0003" }
                    ]
                    }
                ]
                },
                { Name: "3학년", Value: "3", Subj_Code: [
                    { Name: "국어", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "미래엔(신유식)", Value: "M9KRCHA3001" },
                        { Name: "천재(박영목)", Value: "M9KRCHA3002" },
                        { Name: "비상(김진수)", Value: "M9KRCHA3003" },
                        { Name: "천재(노미숙)", Value: "M9KRCHA3004" },
                        { Name: "지학사(이삼형)", Value: "M9KRCHA3005" }
                    ]
                    },
                    { Name: "영어", Value: "EG", WithTxCode: true, TX_CODE: [                        
                        { Name: "천재(이재영)", Value: "M9EGCHA3003" },
                        { Name: "미래엔(최연희)", Value: "M9EGCHA3004" },
                        { Name: "능률(김성곤)", Value: "M9EGCHA3005" },
                        { Name: "비상(김진완)", Value: "M9EGCHA3006" },
                        { Name: "천재(정사열)", Value: "M9EGCHA3007" },
                        { Name: "YBM(박준언)", Value: "M9EGCHA3008" },
						{ Name: "동아(윤정미)", Value: "M9EGCHA3001" },
                        { Name: "동아(이병민)", Value: "M9EGCHA3002" }
                    ]
                    },
                    { Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "M6MTCHA3001" }
                    ]
                    },
                    { Name: "과학", Value: "SC", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "M7SCCHA3001" }
                    ]
                    },
                    { Name: "사회", Value: "LS", WithTxCode: true, TX_CODE: [
                        { Name: "사회②", Value: "M9LSCHA0002" }
                    ]
                    },
                    { Name: "역사", Value: "HI", WithTxCode: true, TX_CODE: [
                        { Name: "역사②", Value: "M8HICHAA002" }
                    ]
                    },
                    { Name: "도덕", Value: "ET", WithTxCode: true, TX_CODE: [
                        { Name: "도덕①", Value: "M9ETCHA0001" },
                        { Name: "도덕②", Value: "M9ETCHA0002" }
                    ]
                    },
                    { Name: "기술가정", Value: "TH", WithTxCode: true, TX_CODE: [
                        { Name: "기술가정①", Value: "M9THCHA0001" },
                        { Name: "기술가정②", Value: "M9THCHA0001" }
                    ]
                    },
                    { Name: "한문", Value: "CH", WithTxCode: true, TX_CODE: [
                        { Name: "미래엔(심경호)", Value: "M9CHCHA0001" },
                        { Name: "비상(이동재)", Value: "M9CHCHA0002" },
                        { Name: "천재(안대회)", Value: "M9CHCHA0003" }
                    ]
                    }
                ]
                }
            ]
        }
        ]
    },
		{ Value: "T", ExPapr_CoreType: [ // 수행 마스터
            {Value: "A", Grade: [ // 수행 마스터 - 탐구형 수행평가
				{ Name: "1학년", Value: "1", Subj_Code: [
                    { Name: "국어", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "미래엔(신유식)", Value: "M9KRCHA1001" },
                        { Name: "천재(박영목)", Value: "M9KRCHA1002" },
						{ Name: "비상(김진수)", Value: "M9KRCHA1003" },
						{ Name: "천재(노미숙)", Value: "M9KRCHA1004" }
                    ]
                    },
					{ Name: "영어", Value: "EG", WithTxCode: true, TX_CODE: [                        
						{ Name: "미래엔(최연희)", Value: "M9EGCHA1003" },
						{ Name: "천재(이재영)", Value: "M9EGCHA1004" },
						{ Name: "동아(윤정미)", Value: "M9EGCHA1001" },
						{ Name: "동아(이병민)", Value: "M9EGCHA1002" }
                    ]
					},
                    { Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "M6MTCHA1001" }
                    ]
                    }
                ]
                },
                { Name: "2학년", Value: "2", Subj_Code: [
                    { Name: "국어", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "미래엔(신유식)", Value: "M9KRCHA2001" },
                        { Name: "천재(박영목)", Value: "M9KRCHA2002" },
						{ Name: "비상(김진수)", Value: "M9KRCHA2003" },
						{ Name: "천재(노미숙)", Value: "M9KRCHA2004" },
						{ Name: "지학사(이삼형)", Value: "M9KRCHA2005" }
                    ]
                    },
					{ Name: "영어", Value: "EG", WithTxCode: true, TX_CODE: [                        
						{ Name: "천재(이재영)", Value: "M9EGCHA2003" },
						{ Name: "미래엔(최연희)", Value: "M9EGCHA2004" },
						{ Name: "능률(김성곤)", Value: "M9EGCHA2005" },
						{ Name: "비상(김진완)", Value: "M9EGCHA2006" },
						{ Name: "천재(정사열)", Value: "M9EGCHA2007" },
						{ Name: "YBM(박준언)", Value: "M9EGCHA2008" },
						{ Name: "동아(윤정미)", Value: "M9EGCHA2001" },
						{ Name: "동아(이병민)", Value: "M9EGCHA2002" }
                    ]
                    },
                    { Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "M6MTCHA2001" }
                    ]
                    }
                ]
                },
                { Name: "3학년", Value: "3", Subj_Code: [
                    { Name: "국어", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "미래엔(신유식)", Value: "M9KRCHA3001" },
                        { Name: "천재(박영목)", Value: "M9KRCHA3002" },
						{ Name: "비상(김진수)", Value: "M9KRCHA3003" },
						{ Name: "천재(노미숙)", Value: "M9KRCHA3004" },
						{ Name: "지학사(이삼형)", Value: "M9KRCHA3005" }
                    ]
                    },
					{ Name: "영어", Value: "EG", WithTxCode: true, TX_CODE: [                        
						{ Name: "천재(이재영)", Value: "M9EGCHA3003" },
						{ Name: "미래엔(최연희)", Value: "M9EGCHA3004" },
						{ Name: "능률(김성곤)", Value: "M9EGCHA3005" },
						{ Name: "비상(김진완)", Value: "M9EGCHA3006" },
						{ Name: "천재(정사열)", Value: "M9EGCHA3007" },
						{ Name: "YBM(박준언)", Value: "M9EGCHA3008" },
						{ Name: "동아(윤정미)", Value: "M9EGCHA3001" },
						{ Name: "동아(이병민)", Value: "M9EGCHA3002" }
                    ]
                    },
                    { Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "M6MTCHA3001" }
                    ]
                    }
                ]
                }
            ]
        },
			{Value: "B", Grade: [ // 수행 마스터 - 서술형 수행평가
				{ Name: "1학년", Value: "1", Subj_Code: [
                    { Name: "국어", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "미래엔(신유식)", Value: "M9KRCHA1001" },
                        { Name: "천재(박영목)", Value: "M9KRCHA1002" },
						{ Name: "비상(김진수)", Value: "M9KRCHA1003" },
						{ Name: "천재(노미숙)", Value: "M9KRCHA1004" }
                    ]
                    },
					{ Name: "영어", Value: "EG", WithTxCode: true, TX_CODE: [                        
						{ Name: "미래엔(최연희)", Value: "M9EGCHA1003" },
						{ Name: "천재(이재영)", Value: "M9EGCHA1004" },
						{ Name: "동아(윤정미)", Value: "M9EGCHA1001" },
						{ Name: "동아(이병민)", Value: "M9EGCHA1002" }
                    ]
                    },
                    { Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "M6MTCHA1001" }
                    ]
                    }
                ]
                },
                { Name: "2학년", Value: "2", Subj_Code: [
                    { Name: "국어", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "미래엔(신유식)", Value: "M9KRCHA2001" },
                        { Name: "천재(박영목)", Value: "M9KRCHA2002" },
						{ Name: "비상(김진수)", Value: "M9KRCHA2003" },
						{ Name: "천재(노미숙)", Value: "M9KRCHA2004" },
						{ Name: "지학사(이삼형)", Value: "M9KRCHA2005" }
                    ]
                    },
					{ Name: "영어", Value: "EG", WithTxCode: true, TX_CODE: [                        
						{ Name: "천재(이재영)", Value: "M9EGCHA2003" },
						{ Name: "미래엔(최연희)", Value: "M9EGCHA2004" },
						{ Name: "능률(김성곤)", Value: "M9EGCHA2005" },
						{ Name: "비상(김진완)", Value: "M9EGCHA2006" },
						{ Name: "천재(정사열)", Value: "M9EGCHA2007" },
						{ Name: "YBM(박준언)", Value: "M9EGCHA2008" },
						{ Name: "동아(윤정미)", Value: "M9EGCHA2001" },
						{ Name: "동아(이병민)", Value: "M9EGCHA2002" }
                    ]
                    },
                    { Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "M6MTCHA2001" }
                    ]
                    }
                ]
                },
                { Name: "3학년", Value: "3", Subj_Code: [
                    { Name: "국어", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "미래엔(신유식)", Value: "M9KRCHA3001" },
                        { Name: "천재(박영목)", Value: "M9KRCHA3002" },
						{ Name: "비상(김진수)", Value: "M9KRCHA3003" },
						{ Name: "천재(노미숙)", Value: "M9KRCHA3004" },
						{ Name: "지학사(이삼형)", Value: "M9KRCHA3005" }
                    ]
                    },
					{ Name: "영어", Value: "EG", WithTxCode: true, TX_CODE: [                        
						{ Name: "천재(이재영)", Value: "M9EGCHA3003" },
						{ Name: "미래엔(최연희)", Value: "M9EGCHA3004" },
						{ Name: "능률(김성곤)", Value: "M9EGCHA3005" },
						{ Name: "비상(김진완)", Value: "M9EGCHA3006" },
						{ Name: "천재(정사열)", Value: "M9EGCHA3007" },
						{ Name: "YBM(박준언)", Value: "M9EGCHA3008" },
						{ Name: "동아(윤정미)", Value: "M9EGCHA3001" },
						{ Name: "동아(이병민)", Value: "M9EGCHA3002" }
                    ]
                    },
                    { Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "M6MTCHA3001" }
                    ]
                    }
                ]
                }
            ]
        }
        ]
    },

        { Value: "K", ExPapr_CoreType: [ //과목별 향상 족보
			{Value: "T", Grade: [ //성적진단평가
				{ Name: "1학년", Value: "1", Subj_Code: [
                    { Name: "국어", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "비상(박현숙)", Value: "MAKRCHA1003" },
                        { Name: "비상(박영민)", Value: "MAKRCHA1006" },
                        { Name: "미래엔(민병곤)", Value: "MAKRCHA1002" },
                        { Name: "해냄(강양희)", Value: "MAKRCHA1007" },
						{ Name: "천재(정호웅)", Value: "MAKRCHA1005" },
						{ Name: "천재(노미숙)", Value: "MAKRCHA1001" },
						{ Name: "미래엔(신유식)", Value: "MAKRCHA1004" },
						{ Name: "창비(이도영)", Value: "MAKRCHA1008" }
                    ]
                    },
                    { Name: "영어", Value: "EG", WithTxCode: true, TX_CODE: [
                        { Name: "천재(이상기)", Value: "MAEGCHA1002" },
                        { Name: "천재(소영순)", Value: "MAEGCHA1001" },
						{ Name: "미래엔(문영인)", Value: "MAEGCHA1005" },
						{ Name: "동아(이병민)", Value: "MAEGCHA1007" },
						{ Name: "동아(윤정미)", Value: "MAEGCHA1006" },
						{ Name: "YBM(박준언)", Value: "MAEGCHA1004" },
						{ Name: "능률(김기택)", Value: "MAEGCHA1003" },
						{ Name: "비상(황종배)", Value: "MAEGCHA1008" }						
                    ]
                    },
                    { Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "MAMTCHA1001" }
                    ]
                    }
                ]
                },
                { Name: "2학년", Value: "2", Subj_Code: [
                    { Name: "국어", Value: "KR", WithTxCode: true, TX_CODE: [
						{ Name: "미래엔(신유식)", Value: "MAKRCHA2004" },
						{ Name: "미래엔(민병곤)", Value: "MAKRCHA2002" },
						{ Name: "비상(박현숙)", Value: "MAKRCHA2003" },
						{ Name: "비상(박영민)", Value: "MAKRCHA2006" },
						{ Name: "천재(정호웅)", Value: "MAKRCHA2005" },
                        { Name: "천재(노미숙)", Value: "MAKRCHA2001" },
                        { Name: "해냄(강양희)", Value: "MAKRCHA2007" },
                        { Name: "창비(이도영)", Value: "MAKRCHA2008" }
                    ]
                    },
                    { Name: "영어", Value: "EG", WithTxCode: true, TX_CODE: [
						{ Name: "YBM(박준언)", Value: "MAEGCHA2004" },
						{ Name: "미래엔(문영인)", Value: "MAEGCHA2005" },
                        { Name: "천재(소영순)", Value: "MAEGCHA2001" },
						{ Name: "동아(윤정미)", Value: "MAEGCHA2006" },
						{ Name: "능률(김기택)", Value: "MAEGCHA2003" },
						{ Name: "비상(황종배)", Value: "MAEGCHA2008" },
						{ Name: "동아(이병민)", Value: "MAEGCHA2007" },
                        { Name: "천재(이상기)", Value: "MAEGCHA2002" }
                    ]
                    },
                    { Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "MAMTCHA2001" }
                    ]
                    }
                ]
                },
                { Name: "3학년", Value: "3", Subj_Code: [
                    { Name: "국어", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "천재(박영목)", Value: "M9KRCHA3002" },
                        { Name: "지학사(이삼형)", Value: "M9KRCHA3005" },
                        { Name: "천재(노미숙)", Value: "M9KRCHA3004" },
                        { Name: "비상(김진수)", Value: "M9KRCHA3003" },
                        { Name: "미래엔(신유식)", Value: "M9KRCHA3001" }
                    ]
                    },
                    { Name: "영어", Value: "EG", WithTxCode: true, TX_CODE: [
						{ Name: "천재(정사열)", Value: "M9EGCHA3007" },
                        { Name: "천재(이재영)", Value: "M9EGCHA3003" },
                        { Name: "비상(김진완)", Value: "M9EGCHA3006" },
                        { Name: "미래엔(최연희)", Value: "M9EGCHA3004" },
                        { Name: "동아(이병민)", Value: "M9EGCHA3002" },
						{ Name: "동아(윤정미)", Value: "M9EGCHA3001" },
						{ Name: "능률(김성곤)", Value: "M9EGCHA3005" },
						{ Name: "YBM(박준언)", Value: "M9EGCHA3008" }
                    ]
                    },
                    { Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "M6MTCHA3001" }
                    ]
                    }
                ]
                }
            ]
			}
        ]
    },        
		{ Value: "X", ExPapr_CoreType: [ // 미리보는 XX고사
            {Value: "X", Grade: [
                { Name: "1학년", Value: "1", Subj_Code: [
                    { Name: "국어", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "천재(노미숙)", Value: "MAKRCHA1001" },
                        { Name: "미래엔(민병곤)", Value: "MAKRCHA1002" },
                        { Name: "비상(박현숙)", Value: "MAKRCHA1003" },
                        { Name: "미래엔(신유식)", Value: "MAKRCHA1004" },
                        { Name: "천재(정호웅)", Value: "MAKRCHA1005" },
                        { Name: "비상(박영민)", Value: "MAKRCHA1006" },
                        { Name: "해냄(강양희)", Value: "MAKRCHA1007" },
                        { Name: "창비(이도영)", Value: "MAKRCHA1008" },
                    ]
                    },
                    { Name: "영어", Value: "EG", WithTxCode: true, TX_CODE: [
                        { Name: "천재(소영순)", Value: "MAEGCHA1001" },
                        { Name: "천재(이상기)", Value: "MAEGCHA1002" },
						{ Name: "능률(김기택)", Value: "MAEGCHA1003" },
						{ Name: "YBM(박준언)", Value: "MAEGCHA1004" },
						{ Name: "미래엔(문영인)", Value: "MAEGCHA1005" },
						{ Name: "동아(윤정미)", Value: "MAEGCHA1006" },
						{ Name: "동아(이병민)", Value: "MAEGCHA1007" },
                        { Name: "비상(황종배)", Value: "MAEGCHA1008" },
                    ]
                    },
                    { Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "MAMTCHA1001" }
                    ]
                    },
                    { Name: "과학", Value: "SC", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "MASCCHA1001" }
                    ]
                    },
                    { Name: "사회①", Value: "LS", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "MALSCHA0001" }
                    ]
                    },
					{ Name: "역사①", Value: "HI", WithTxCode: true, TX_CODE: [
						{ Name: "공통", Value: "MAHICHA0001" }
                    ]
                    }
                ]
                },
                { Name: "2학년", Value: "2", Subj_Code: [
                    { Name: "국어", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "천재(노미숙)", Value: "MAKRCHA2001" },
                        { Name: "미래엔(민병곤)", Value: "MAKRCHA2002" },
                        { Name: "비상(박현숙)", Value: "MAKRCHA2003" },
                        { Name: "미래엔(신유식)", Value: "MAKRCHA2004" },
                        { Name: "천재(정호웅)", Value: "MAKRCHA2005" },
                        { Name: "비상(박영민)", Value: "MAKRCHA2006" },
                        { Name: "해냄(강양희)", Value: "MAKRCHA2007" },
                        { Name: "창비(이도영)", Value: "MAKRCHA2008" },
                    ]
                    },
                    { Name: "영어", Value: "EG", WithTxCode: true, TX_CODE: [
                        { Name: "천재(소영순)", Value: "MAEGCHA2001" },
                        { Name: "천재(이상기)", Value: "MAEGCHA2002" },
						{ Name: "능률(김기택)", Value: "MAEGCHA2003" },
						{ Name: "YBM(박준언)", Value: "MAEGCHA2004" },
						{ Name: "미래엔(문영인)", Value: "MAEGCHA2005" },
						{ Name: "동아(윤정미)", Value: "MAEGCHA2006" },
						{ Name: "동아(이병민)", Value: "MAEGCHA2007" },
                        { Name: "비상(황종배)", Value: "MAEGCHA2008" },
                    ]
                    },
                    { Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "MAMTCHA2001" }
                    ]
                    },
                    { Name: "과학", Value: "SC", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "MASCCHA2001" }
                    ]
                    },
                    { Name: "사회①", Value: "LS1", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "MALSCHA0001" }
                    ]
                    },
					{ Name: "사회②", Value: "LS2", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "MALSCHA0002" }
                    ]
                    },
                    { Name: "역사①", Value: "HI1", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "MAHICHA0001" }
                    ]
                    },
                    { Name: "역사②", Value: "HI2", WithTxCode: true, TX_CODE: [
						{ Name: "공통", Value: "M9HICHA0002" }
                    ]
                    }
                ]
                },
                { Name: "3학년", Value: "3", Subj_Code: [
                    { Name: "국어", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "미래엔(신유식)", Value: "M9KRCHA3001" },
                        { Name: "천재(박영목)", Value: "M9KRCHA3002" },
                        { Name: "비상(김진수)", Value: "M9KRCHA3003" },
                        { Name: "천재(노미숙)", Value: "M9KRCHA3004" },
                        { Name: "지학사(이삼형)", Value: "M9KRCHA3005" },
                        { Name: "창비(이도영)", Value: "M9KRCHA3006" },
                    ]
                    },
                    { Name: "영어", Value: "EG", WithTxCode: true, TX_CODE: [
						{ Name: "동아(윤정미)", Value: "M9EGCHA3001" },
                        { Name: "동아(이병민)", Value: "M9EGCHA3002" },
						{ Name: "천재(이재영)", Value: "M9EGCHA3003" },
                        { Name: "미래엔(최연희)", Value: "M9EGCHA3004" },
                        { Name: "능률(김성곤)", Value: "M9EGCHA3005" },
                        { Name: "비상(김진완)", Value: "M9EGCHA3006" },
                        { Name: "천재(정사열)", Value: "M9EGCHA3007" },
                        { Name: "YBM(박준언)", Value: "M9EGCHA3008" },
                    ]
                    },
                    { Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "M6MTCHA3001" }
                    ]
                    },
                    { Name: "과학", Value: "SC", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "M7SCCHA3001" }
                    ]
                    },
                    { Name: "사회②", Value: "LS", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "M9LSCHA0002" }
                    ]
                    },
                    { Name: "역사①", Value: "HI1", WithTxCode: true, TX_CODE: [
						{ Name: "공통", Value: "M9HICHA0001" }
                    ]
                    },
                    { Name: "역사②", Value: "HI2", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "M9HICHA0002" }
                    ]
                    }
                ]
                }
            ]
        }
        ]
    }
    ]
},
// ---------------------------------------------------------------------------
// 고등
// ---------------------------------------------------------------------------
    {Value: "H", ExPapr_Group: [
        { Value: "C", ExPapr_CoreType: [ // 단원별족보
            {Value: "", Grade: [
                { Name: "1학년", Value: "1", Subj_Code: [
                    { Name: "공통국어", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "미래엔(신유식)", Value: "HAKRCHA1001" },
                        { Name: "비상(강호영)", Value: "HAKRCHA1002" },
                        { Name: "비상(박영민)", Value: "HAKRCHA1003" },
                        { Name: "천재(김수학)", Value: "HAKRCHA1004" },
						{ Name: "창비(최원식)", Value: "HAKRCHA1005" }
                    ]
                    },
                    { Name: "영어", Value: "EG", WithTxCode: true, TX_CODE: [ 
                        { Name: "능률(민병천)", Value: "HAEGCHA1001" },
                        { Name: "YBM(박준언)", Value: "HAEGCHA1002" },
                        { Name: "능률(오선영)", Value: "HAEGCHA1003" },
						{ Name: "미래엔(김성연)", Value: "HAEGCHA1004" },
                        { Name: "비상(홍민표)", Value: "HAEGCHA1005" },                        
						{ Name: "YBM(김은형)", Value: "HAEGCHA1006" },
						{ Name: "천재(조수경)", Value: "HAEGCHA1007" }
                    ]
                    },
                    { Name: "공통수학", Value: "MT",  WithTxCode: true, TX_CODE: [ 
                        { Name: "공통", Value: "HAMTCHA1001" } 
                    ]
					},
                    { Name: "통합과학", Value: "SC", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "HASCCHA1001" }
                    ]
                    },
                    { Name: "통합사회", Value: "LS", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "HALSCHA1001" }
                    ]
                    },
					{ Name: "한국사", Value: "HI", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "HALSCHA0001" }
                    ]
                    },
					{ Name: "기술가정", Value: "TH", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "HATHCHA0001" }
                    ]
                    }
                ]
                },
                { Name: "2,3학년", Value: "2", Subj_Code: [
                    { Name: "문학", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "비상(강호영)", Value: "HAKRCHA2001" },
                        { Name: "미래엔(방민호)", Value: "HAKRCHA2002" },
                        { Name: "천재(정호웅)", Value: "HAKRCHA2003" },
                        { Name: "창비(최원식)", Value: "HAKRCHA2004" },
						{ Name: "지학사(정재찬)", Value: "HAKRCHA2005" }
                    ]
                    },
                    { Name: "독서와 작문", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "비상(최인영)", Value: "HAKRCHA2006" },
                        { Name: "미래엔(방민호)", Value: "HAKRCHA2007" },
                        { Name: "해냄(송승훈)", Value: "HAKRCHA2008" },
                        { Name: "천재(천경록)", Value: "HAKRCHA2009" },
                        { Name: "지학사(서혁)", Value: "HAKRCHA2010" }
                    ]
                    },
                    { Name: "화법과 언어", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "비상(이관규)", Value: "HAKRCHA2011" },
                        { Name: "미래엔(민병곤)", Value: "HAKRCHA2012" },
                        { Name: "창비(최형용)", Value: "HAKRCHA2013" }
                    ]
                    },

                    { Name: "영어Ⅰ", Value: "EG", WithTxCode: true, TX_CODE: [
                        { Name: "능률(오선영)", Value: "HAEGCHA2001" },
                        { Name: "YBM(박준언)", Value: "HAEGCHA2002" },
                        { Name: "비상(홍민표)", Value: "HAEGCHA2003" },                        
						{ Name: "미래엔(김성연)", Value: "HAEGCHA2004" },
						{ Name: "천재(조수경)", Value: "HAEGCHA2005" }
                    ]
                    },

                    { Name: "영어Ⅱ", Value: "EG", WithTxCode: true, TX_CODE: [
                        { Name: "능률(오선영)", Value: "HAEGCHA2006" },
                        { Name: "YBM(박준언)", Value: "HAEGCHA2007" },
                        { Name: "비상(홍민표)", Value: "HAEGCHA2008" },
                        { Name: "미래엔(김성연)", Value: "HAEGCHA2009" },
						{ Name: "천재(조수경)", Value: "HAEGCHA2010" }

                    ]
                    },
                    { Name: "영어 독해와 작문", Value: "EG", WithTxCode: true, TX_CODE: [
                        { Name: "YBM(신정현)", Value: "H9EGCHA2012" },
                        { Name: "천재(안병규)", Value: "H9EGCHA2013" },
                        { Name: "능률(양현권)", Value: "H9EGCHA2014" }
                    ]
                    },
					{ Name: "영어권 문화", Value: "EG", WithTxCode: true, TX_CODE: [
                        { Name: "능률(김정렬)", Value: "H9EGCHA0018" }
                    ]
                    },
                    { Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
                        { Name: "대수", Value: "HAMTCHA2001" },
                        { Name: "확률과 통계", Value: "HAMTCHA2002" },
                        { Name: "기하", Value: "HAMTCHA2005" },
                        { Name: "미적분Ⅰ", Value: "HAMTCHA2003" },
                        { Name: "미적분Ⅱ", Value: "HAMTCHA2004" }
                    ]
                    },
                    { Name: "과학", Value: "SC", WithTxCode: true, TX_CODE: [
                        { Name: "물리학", Value: "HASCCHA2001" },
                        { Name: "화학", Value: "HASCCHA2002" },
                        { Name: "생명과학", Value: "HASCCHA2003" },
                        { Name: "지구과학", Value: "HASCCHA2004" },
                        { Name: "역학과 에너지", Value: "HASCCHA2005" },
                        { Name: "물질과 에너지", Value: "HASCCHA2006" },
                        { Name: "세포와 물질대사", Value: "HASCCHA2007" },
                        { Name: "지구시스템과학", Value: "HASCCHA2008" }
                    ]
                    },
                    { Name: "사회", Value: "LS", WithTxCode: true, TX_CODE: [
                        { Name: "사회와 문화", Value: "HALSCHA2001" },
                        { Name: "현대사회와 윤리", Value: "HALSCHA2002" },
                        { Name: "세계시민과 지리", Value: "HALSCHA2003" },
                        { Name: "세계사", Value: "HALSCHA2004" },
                        { Name: "윤리와 사상", Value: "HALSCHA2005" },
                        { Name: "법과 사회", Value: "HALSCHA2006" },
                        { Name: "정치", Value: "HALSCHA2007" },
                        { Name: "경제", Value: "HALSCHA2008" },
                        { Name: "한국지리 탐구", Value: "HALSCHA2009" }
                        
                    ]
                    },
                    { Name: "한국사", Value: "HI", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "H9HICHA0001|H7LSEXAA002" }
                    ]
                    },
                    { Name: "기술가정", Value: "TH", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "H9THCHA0070" }
                    ]
                    }
                ]
                }
            ]
        }
        ]
    },

		{ Value: "B", ExPapr_CoreType: [ // 직전대비
            {Value: "", Grade: [
                { Name: "1학년", Value: "1", Subj_Code: [                    
                    { Name: "공통국어", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "미래엔(신유식)", Value: "HAKRCHA1001" },
                        { Name: "비상(강호영)", Value: "HAKRCHA1002" },
                        { Name: "비상(박영민)", Value: "HAKRCHA1003" },
                        { Name: "천재(김수학)", Value: "HAKRCHA1004" },
						{ Name: "창비(최원식)", Value: "HAKRCHA1005" }
                    ]
                    },
                    { Name: "공통영어", Value: "EG", WithTxCode: true, TX_CODE: [
                        { Name: "능률(민병천)", Value: "HAEGCHA1001" },
                        { Name: "YBM(박준언)", Value: "HAEGCHA1002" },
                        { Name: "능률(오선영)", Value: "HAEGCHA1003" },
						{ Name: "미래엔(김성연)", Value: "HAEGCHA1004" },
                        { Name: "비상(홍민표)", Value: "HAEGCHA1005" },                        
						{ Name: "YBM(김은형)", Value: "HAEGCHA1006" },
						{ Name: "천재(조수경)", Value: "HAEGCHA1007" }
                    ]
                    },
                    { Name: "공통수학", Value: "MT",  WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "HAMTCHA1001" }
                    ]
					},
                    { Name: "통합과학", Value: "SC", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "HASCCHA1001" }
                    ]
                    },
                    { Name: "통합사회", Value: "LS", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "HALSCHA1001" }
                    ]
                    },
					{ Name: "한국사", Value: "HI", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "HALSCHA0001" }
                    ]
                    }
                ]
                },
                { Name: "2,3학년", Value: "2", Subj_Code: [
                    { Name: "문학", Value: "KR", WithTxCode: true, TX_CODE: [ 
                        { Name: "비상(한철우)", Value: "H9KRCHA2004" }, 
                        { Name: "미래엔(방민호)", Value: "H9KRCHA2005" }, 
                        { Name: "천재(정호웅)", Value: "H9KRCHA2006" }, 
						{ Name: "지학사(정재찬)", Value: "H9KRCHA2007" },
						{ Name: "창비(최원식)", Value: "H9KRCHA2017" }
                    ]
                    },
					{ Name: "독서", Value: "KR", WithTxCode: true, TX_CODE: [ 
                        { Name: "비상(한철우)", Value: "H9KRCHA2008" }, 
                        { Name: "미래엔(방민호)", Value: "H9KRCHA2009" }, 
                        { Name: "천재(박영목)", Value: "H9KRCHA2010" }  
                    ]
                    },		
					{ Name: "언어와 매체", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "비상(이관규)", Value: "H9KRCHA2011" },
                        { Name: "미래엔(방민호)", Value: "H9KRCHA2012" },
                        { Name: "지학사(이삼형)", Value: "H9KRCHA2013" },
						{ Name: "천재(민현식)", Value: "H9KRCHA2014" }
                    ]
                    },	
					{ Name: "영어Ⅰ", Value: "EG", WithTxCode: true, TX_CODE: [
                        { Name: "YBM(박준언)", Value: "H9EGCHA2006" },
                        { Name: "YBM(한상호)", Value: "H9EGCHA2007" },
                        { Name: "능률(김성곤)", Value: "H9EGCHA2008" },
                        { Name: "비상(홍민표)", Value: "H9EGCHA2009" },
                        { Name: "천재(이재영)", Value: "H9EGCHA2010" },
                        { Name: "동아(권혁승)", Value: "H9EGCHA2011" }
                    ]
                    },
					{ Name: "영어Ⅱ", Value: "EG", WithTxCode: true, TX_CODE: [
                        { Name: "YBM(박준언)", Value: "H9EGCHA2001" },
                        { Name: "YBM(한상호)", Value: "H9EGCHA2002" },
						{ Name: "비상(홍민표)", Value: "H9EGCHA2003" },
						{ Name: "천재(이재영)", Value: "H9EGCHA2004" },
                        { Name: "능률(김성곤)", Value: "H9EGCHA2005" },
                        { Name: "동아(권혁승)", Value: "H9EGCHA2015" }
                    ]
                    },
                    { Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
						{ Name: "수학Ⅰ", Value: "H9MTCHA2003" },
						{ Name: "수학Ⅱ", Value: "H9MTCHA2004" },
						{ Name: "확률과 통계", Value: "H9MTCHA2005" },
						{ Name: "미적분", Value: "H9MTCHA2001" },
						{ Name: "기하", Value: "H9MTCHA2002" }
                    ]
                    },
                    { Name: "과학", Value: "SC", WithTxCode: true, TX_CODE: [
                        { Name: "물리학Ⅰ", Value: "H9SCCHA2001" },
                        { Name: "생명과학Ⅰ", Value: "H9SCCHA2002" },
                        { Name: "지구과학Ⅰ", Value: "H9SCCHA2003" },
						{ Name: "화학Ⅰ", Value: "H9SCCHA2004" }
                    ]
                    },
                    { Name: "사회", Value: "LS", WithTxCode: true, TX_CODE: [
                        { Name: "사회문화", Value: "H9LSCHA2002" },
                        { Name: "한국지리", Value: "H9LSCHA2003" },
						{ Name: "정치와 법", Value: "H9LSCHA2001" },
                        { Name: "윤리와 사상", Value: "H9LSCHA2005" },
                        { Name: "생활과 윤리", Value: "H9LSCHA2006" }
                    ]
                    }
                ]
                }
            ]
        }
        ]
    },
        { Value: "A", ExPapr_CoreType: [ // 학교별 족보
            {Value: "Z", Grade: [   // 학교별 기출족보
                { Name: "1학년", Value: "1", Subj_Code: [
					{ Name: "전체", Value: ""},
                    { Name: "국어", Value: "KR", TX_CODE: [
                        { Name: "미래엔(신유식)", Value: "H9KRCHA1001" },
                        { Name: "비상(박안수)", Value: "H9KRCHA1002" },
                        { Name: "비상(박영민)", Value: "H9KRCHA1004" },
                        { Name: "천재(박영목)", Value: "H9KRCHA1003" },
                        { Name: "지학사(이삼형)", Value: "H9KRCHA1005" }
                    ]},
                    { Name: "영어", Value: "EG", TX_CODE: [
                        { Name: "능률(김성곤)", Value: "H9EGCHA1001" },
                        { Name: "YBM(박준언)", Value: "H9EGCHA1002" },
                        { Name: "YBM(한상호)", Value: "H9EGCHA1004" },
                        { Name: "비상(홍인표)", Value: "H9EGCHA1003" },
                        { Name: "천재(이재영)", Value: "H9EGCHA1005" },
                    ]},
                    { Name: "수학", Value: "MT", TX_CODE: [
                        { Name: "공통", Value: "H9MTCHA1001|H7MTEXP1005|H8MTCHA1004" }
                    ]},
                    { Name: "통합과학", Value: "SC", TX_CODE: [
                        { Name: "공통", Value: "H9SCCHA1001" }
                    ]},
                    { Name: "통합사회", Value: "LS", TX_CODE: [
                        { Name: "공통", Value: "H9LSCHA1001" }
                    ]},
                    { Name: "한국사", Value: "HI", TX_CODE: [
                        { Name: "공통", Value: "H7LSEXAA002|H7LSCHA1002" }
                    ]},
                    { Name: "기가/직탐", Value: "TH", TX_CODE: [
                        { Name: "공통", Value: "" }
                    ]},
//                    { Name: "직업탐구", Value: "TH", TX_CODE: [
//                        { Name: "공통", Value: "" }
//                    ]},
					{ Name: "제2외국어", Value: "CH", TX_CODE: [
                        { Name: "공통", Value: "" }
                    ]},
                    { Name: "기타", Value: "OT", TX_CODE: [
                        { Name: "공통", Value: "" }
                    ]},
                ]
                },
                { Name: "2학년", Value: "2", Subj_Code: [
					{ Name: "전체", Value: ""},
                    { Name: "국어", Value: "KR"},
                    { Name: "영어", Value: "EG"},
                    { Name: "수학", Value: "MT"},
                    { Name: "과학", Value: "SC"},
                    { Name: "사회", Value: "LS"},
                    { Name: "한국사", Value: "HI"},
                    { Name: "기가/직탐", Value: "TH"},
                    //{ Name: "직업탐구", Value: "TH"},
                    { Name: "제2외국어", Value: "CH"},
                    { Name: "기타", Value: "OT"}
                ]
                },
                { Name: "3학년", Value: "3", Subj_Code: [
					{ Name: "전체", Value: ""},
                    { Name: "국어", Value: "KR"},
                    { Name: "영어", Value: "EG"},
                    { Name: "수학", Value: "MT"},
                    { Name: "과학", Value: "SC"},
                    { Name: "사회", Value: "LS"},
                    { Name: "한국사", Value: "HI"},
                    { Name: "기가/직탐", Value: "TH"},
                    //{ Name: "직업탐구", Value: "TH"},
                    { Name: "제2외국어", Value: "CH"},
                    { Name: "기타", Value: "OT"}
                ]
                }
            ]
        },
			{Value: "Y", Grade: [   // 학교별 기출유사
                { Name: "1학년", Value: "1", Subj_Code: [
                    { Name: "국어", Value: "KR", TX_CODE: [
                        { Name: "미래엔(신유식)", Value: "H9KRCHA1001" },
                        { Name: "비상(박안수)", Value: "H9KRCHA1002" },
                        { Name: "비상(박영민)", Value: "H9KRCHA1004" },
                        { Name: "천재(박영목)", Value: "H9KRCHA1003" },
                        { Name: "지학사(이삼형)", Value: "H9KRCHA1005" }
                    ]},
                    { Name: "영어", Value: "EG", TX_CODE: [
                        { Name: "능률(김성곤)", Value: "H9EGCHA1001" },
                        { Name: "YBM(박준언)", Value: "H9EGCHA1002" },
                        { Name: "YBM(한상호)", Value: "H9EGCHA1004" },
                        { Name: "비상(홍인표)", Value: "H9EGCHA1003" },
                        { Name: "천재(이재영)", Value: "H9EGCHA1005" },
                    ]},
                    { Name: "수학", Value: "MT", TX_CODE: [
                        { Name: "공통", Value: "H9MTCHA1001|H7MTEXP1005|H8MTCHA1004" }
                    ]},
                    { Name: "과학", Value: "SC", TX_CODE: [
                        { Name: "공통", Value: "H9SCCHA1001" }
                    ]},
                    { Name: "사회", Value: "LS", TX_CODE: [
                        { Name: "공통", Value: "H9LSCHA1001" }
                    ]},
                    { Name: "한국사", Value: "HI", TX_CODE: [
                        { Name: "공통", Value: "H7LSEXAA002|H7LSCHA1002" }
                    ]},
                ]
                },
                { Name: "2,3학년", Value: "2", Subj_Code: [
                    { Name: "국어", Value: "KR"},
                    { Name: "영어", Value: "EG"},
                    { Name: "수학", Value: "MT"},
                    { Name: "과학", Value: "SC"},
                    { Name: "사회", Value: "LS"},
					{ Name: "한국사", Value: "HI"}
                ]
                },
				{ Name: "3학년", Value: "3", Subj_Code: [
                    { Name: "수학", Value: "MT"}
                ]
                },
            ]
        },
			{Value: "A", Grade: [   // 학교별 기출 무료 열람실
                { Name: "1학년", Value: "1", Subj_Code: [
                    { Name: "국어", Value: "KR"},
                    { Name: "영어", Value: "EG"},
                    { Name: "수학", Value: "MT"},
                    { Name: "통합과학", Value: "SC"},
                    { Name: "통합사회", Value: "LS"},
                    { Name: "한국사", Value: "HI"},
                    { Name: "기술가정", Value: "TH"},
                    { Name: "직업탐구", Value: "TH"},
					{ Name: "제2외국어", Value: "CH"},
					{ Name: "기타", Value: "OT"}
                ]
                },
                { Name: "2학년", Value: "2", Subj_Code: [
                    { Name: "국어", Value: "KR"},
                    { Name: "영어", Value: "EG"},
                    { Name: "수학", Value: "MT"},
                    { Name: "과학", Value: "SC"},
                    { Name: "사회", Value: "LS"},
                    { Name: "한국사", Value: "HI"},
                    { Name: "기술가정", Value: "TH"},
                    { Name: "직업탐구", Value: "TH"},
					{ Name: "제2외국어", Value: "CH"},
					{ Name: "기타", Value: "OT"}
                ]
                },
                { Name: "3학년", Value: "3", Subj_Code: [
                    { Name: "국어", Value: "KR"},
                    { Name: "영어", Value: "EG"},
                    { Name: "수학", Value: "MT"},
                    { Name: "과학", Value: "SC"},
                    { Name: "사회", Value: "LS"},
                    { Name: "한국사", Value: "HI"},
                    { Name: "기술가정", Value: "TH"},
                    { Name: "직업탐구", Value: "TH"},
					{ Name: "제2외국어", Value: "CH"},
					{ Name: "기타", Value: "OT"}
                ]
                }
            ]
        },
        {Value: "E", Grade: [ // 학교별 예상족보
                { Name: "1학년", Value: "1", Subj_Code: [
                    { Name: "국어", Value: "KR"},
                    { Name: "영어", Value: "EG"},
                    { Name: "수학", Value: "MT"},
                    { Name: "통합과학", Value: "SC"},
                    { Name: "통합사회", Value: "LS"},
                    { Name: "한국사", Value: "HI"},
                ]
                },
                { Name: "2학년", Value: "2", Subj_Code: [
                    { Name: "문학", Value: "KR", TX_CODE: "HAKRCHA0004"},
                    { Name: "독서와 작문", Value: "KR", TX_CODE: "HAKRCHA0003"},
                    { Name: "화법과 언어", Value: "KR", TX_CODE: "HAKRCHA0005"},
                    { Name: "영어Ⅰ", Value: "EG", TX_CODE: "HAEGCHA0006"},
                    { Name: "대수", Value: "MT", TX_CODE: "HAMTCHA0005"},
                    { Name: "확률과 통계", Value: "MT", TX_CODE: "HAMTCHA0007"},
                    { Name: "기하", Value: "MT", TX_CODE: "HAMTCHA0009"},
                    { Name: "미적분I", Value: "MT", TX_CODE: "HAMTCHA0006"},
                    { Name: "미적분II", Value: "MT", TX_CODE: "HAMTCHA0010"},
                    { Name: "물리학", Value: "SC", TX_CODE: "HASCCHA0004"},
					{ Name: "화학", Value: "SC", TX_CODE: "HASCCHA0007"},
                    { Name: "생명과학", Value: "SC", TX_CODE: "HASCCHA0005"},                    
                    { Name: "지구과학", Value: "SC", TX_CODE: "HASCCHA0006"},
                    { Name: "사회와 문화", Value: "LS", TX_CODE: "HALSCHA0003"},
                    { Name: "현대사회와 윤리", Value: "LS", TX_CODE: "HALSCHA0006"},
                    { Name: "세계시민과 지리", Value: "LS", TX_CODE: "HALSCHA0005"},
                    { Name: "세계사", Value: "LS", TX_CODE: "HALSCHA0004"},
                    { Name: "윤리와 사상", Value: "LS", TX_CODE: "HALSCHA0012"},
					{ Name: "법과 사회", Value: "LS", TX_CODE: "HALSCHA0011"},
					{ Name: "정치", Value: "LS", TX_CODE: "HALSCHA0014"},
                    { Name: "경제", Value: "LS", TX_CODE: "HALSCHA0007"},
                    { Name: "한국지리 탐구", Value: "LS", TX_CODE: "HALSCHA0015"},
					{ Name: "한국사", Value: "HI", TX_CODE: "HALSCHA1002"},
                ]
                },
				{ Name: "3학년", Value: "2", Subj_Code: [
					{ Name: "독서", Value: "KR", TX_CODE: "H7KREXAA004"},
                    { Name: "수학 II", Value: "MT", TX_CODE: "H7MTEXAA004"},
                    { Name: "확률과 통계", Value: "MT", TX_CODE: "H7MTEXAA006"},
                    { Name: "미적분", Value: "MT", TX_CODE: "H9MTCHA2001"},
                    { Name: "기하", Value: "MT", TX_CODE: "H9MTCHA2002"},
					{ Name: "물리학 I", Value: "SC", TX_CODE: "H9SCCHA2001"},
                    { Name: "생명과학 I", Value: "SC", TX_CODE: "H8SCCHA2001"},
                    { Name: "화학 I", Value: "SC", TX_CODE: "H7SCEXAA004"},
                    { Name: "지구과학 I", Value: "SC", TX_CODE: "H7SCEXAA006"},
                    { Name: "사회문화", Value: "LS", TX_CODE: "H7LSEXAA014"},
                    { Name: "한국지리", Value: "LS", TX_CODE: "H7LSEXAA006"},
                    { Name: "정치와 법", Value: "LS", TX_CODE: "H9LSCHA2001"},
					//{ Name: "세계사", Value: "LS", TX_CODE: "H7LSEXAA010"},
                    { Name: "윤리와 사상", Value: "LS", TX_CODE: "H7LSEXAA004"},
					{ Name: "생활과 윤리", Value: "LS", TX_CODE: "H8LSCHAA002"},
					//{ Name: "경제", Value: "LS", TX_CODE: "H7LSEXAA008"},
					//{ Name: "동아시아사", Value: "LS", TX_CODE: "H8LSCHAA001"},
                    //{ Name: "세계지리", Value: "LS", TX_CODE: "H7LSEXAA007"},
					{ Name: "한국사", Value: "HI", TX_CODE: "H7LSEXAA002"},
                ]
                },
            ]
        },
        {Value: "W", Grade: [ // 학교별 AI기출변형
                { Name: "1학년", Value: "1", Subj_Code: [
                    { Name: "국어", Value: "KR"},
                    { Name: "영어", Value: "EG"},
                    { Name: "공통수학", Value: "MT"},
                    { Name: "통합과학", Value: "SC"},
                    { Name: "통합사회", Value: "LS"},
                    { Name: "한국사", Value: "HI"},
                ]
                },
                { Name: "2학년", Value: "2", Subj_Code: [
                    { Name: "대수", Value: "MT", TX_CODE: "HAMTCHA0005"},
                    { Name: "확률과 통계", Value: "MT", TX_CODE: "HAMTCHA0007"},
                    { Name: "기하", Value: "MT", TX_CODE: "HAMTCHA0009"},
                    { Name: "물리학", Value: "SC", TX_CODE: "HASCCHA0004"},
					{ Name: "화학", Value: "SC", TX_CODE: "HASCCHA0007"},
                    { Name: "생명과학", Value: "SC", TX_CODE: "HASCCHA0005"},                    
                    { Name: "지구과학", Value: "SC", TX_CODE: "HASCCHA0006"},
                    { Name: "사회와 문화", Value: "LS", TX_CODE: "HALSCHA0003"},
                    { Name: "현대사회와 윤리", Value: "LS", TX_CODE: "HALSCHA0006"},
                    { Name: "세계시민과 지리", Value: "LS", TX_CODE: "HALSCHA0005"},
                    { Name: "세계사", Value: "LS", TX_CODE: "HALSCHA0004"},
                    { Name: "윤리와 사상", Value: "LS", TX_CODE: "HALSCHA0012"},
					{ Name: "법과 사회", Value: "LS", TX_CODE: "HALSCHA0011"},
					{ Name: "정치", Value: "LS", TX_CODE: "HALSCHA0014"},
                    { Name: "경제", Value: "LS", TX_CODE: "HALSCHA0007"},
                    { Name: "한국지리 탐구 ", Value: "LS", TX_CODE: "HALSCHA0015"},
                    { Name: "한국사", Value: "HI", TX_CODE: "HALSCHA1002"},
                ]
                },
                { Name: "3학년", Value: "3", Subj_Code: [
                    //{ Name: "문학", Value: "KR", TX_CODE: "H7KREXAA007"},
					{ Name: "독서", Value: "KR", TX_CODE: "H7KREXAA004"},
                    //{ Name: "영어 Ⅰ", Value: "EG", TX_CODE: "H7EGEXAA001"},
					// { Name: "영어 Ⅱ", Value: "EG", TX_CODE: "H7EGEXAA002"},
					// { Name: "영어 독해와 작문", Value: "EG", TX_CODE: "H8EGCHAA001"},
                    { Name: "수학 Ⅰ", Value: "MT", TX_CODE: "H7MTEXAA003"},
                    { Name: "수학 Ⅱ", Value: "MT", TX_CODE: "H7MTEXAA004"},
                    { Name: "확률과 통계", Value: "MT", TX_CODE: "H7MTEXAA006"},
                    { Name: "미적분", Value: "MT", TX_CODE: "H9MTCHA2001"},
                    { Name: "기하", Value: "MT", TX_CODE: "H9MTCHA2002"},
                    { Name: "물리학 I", Value: "SC", TX_CODE: "H9SCCHA2001"},
                    { Name: "생명과학 I", Value: "SC", TX_CODE: "H8SCCHA2001"},
                    { Name: "화학 I", Value: "SC", TX_CODE: "H7SCEXAA004"},
                    { Name: "지구과학 I", Value: "SC", TX_CODE: "H7SCEXAA006"},
                    { Name: "생활과 윤리", Value: "LS", TX_CODE: "H8LSCHAA002"},
                    { Name: "사회문화", Value: "LS", TX_CODE: "H7LSEXAA014"},
                    { Name: "정치와 법", Value: "LS", TX_CODE: "H9LSCHA2001"},
                    { Name: "윤리와 사상", Value: "LS", TX_CODE: "H7LSEXAA004"},
                    { Name: "한국지리", Value: "LS", TX_CODE: "H7LSEXAA006"},
                ]
                },
            ]
        }
        ]
    },
        { Value: "H", ExPapr_CoreType: [
            { Value: "C", Grade: [ // 유형별족보
                {Name: "1학년", Value: "1", Subj_Code: [
                    { Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
                        //{ Name: "공통", Value: "H9MTCHA1001|H7MTEXP1005|H8MTCHA1004" }
                        //{ Name: "공통", Value: "" }
						{ Name: "공통", Value: "H9MTCHA1001" }
                    ]
                    }
                ]
                },
                {Name: "2학년", Value: "2", Subj_Code: [
                    { Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
                        { Name: "수학Ⅰ", Value: "H9MTCHA2003|H8MTCHA2006|H8MTCHA1004" },
                        { Name: "수학Ⅱ", Value: "H9MTCHA2004|H8MTCHA2005" },
                        { Name: "확률과 통계", Value: "H9MTCHA2005|H7MTEXP2004" },
                        { Name: "미적분", Value: "H9MTCHA2001|H8MTCHA2005|H8MTCHA2006" },
                        { Name: "기하", Value: "H9MTCHA2002|H7MTCHA2004" }
                    ]
                    }
                ]
                }
            ]
            },
            { Value: "T", Grade: [ // 문법족보
                {Name: "1학년", Value: "1", Subj_Code: [
                    { Name: "공통영어", Value: "EG", WithTxCode: true, TX_CODE: [
                        { Name: "능률(민병천)", Value: "HAEGCHA1001" },
						{ Name: "YBM(박준언)", Value: "HAEGCHA1002" },
						{ Name: "능률(오선영)", Value: "HAEGCHA1003" },
						{ Name: "미래엔(김성연)", Value: "HAEGCHA1004" },
						{ Name: "비상(홍민표)", Value: "HAEGCHA1005" },                        
						{ Name: "YBM(김은형)", Value: "HAEGCHA1006" },
						{ Name: "천재(조수경)", Value: "HAEGCHA1007" }
                    ]
                    }
                ]
            },
                { Name: "2학년", Value: "2", Subj_Code: [
                    { Name: "영어Ⅰ", Value: "EG", WithTxCode: true, TX_CODE: [
                        { Name: "능률(오선영)", Value: "HAEGCHA2001" },
                        { Name: "YBM(박준언)", Value: "HAEGCHA2002" },
                        { Name: "비상(홍민표)", Value: "HAEGCHA2003" },
                        { Name: "미래엔(김성연)", Value: "HAEGCHA2004" },
                        { Name: "천재(조수경)", Value: "HAEGCHA2005" }
                    ]
                    },
					{ Name: "영어Ⅱ", Value: "EG", WithTxCode: true, TX_CODE: [
                        { Name: "능률(오선영)", Value: "HAEGCHA2006", term2_ServiceYN: "N" },
                        { Name: "YBM(박준언)", Value: "HAEGCHA2007", term2_ServiceYN: "N" },
                        { Name: "비상(홍민표)", Value: "HAEGCHA2008", term2_ServiceYN: "N" },
                        { Name: "미래엔(김성연)", Value: "HAEGCHA2009", term2_ServiceYN: "N" },
                        { Name: "천재(조수경)", Value: "HAEGCHA2010", term2_ServiceYN: "N" }
                    ]
                    }
                ]
                }
            ]
        },
            { Value: "D", Grade: [ // 최다빈출
                {Name: "1학년", Value: "1", Subj_Code: [
                    { Name: "공통국어", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "미래엔(신유식)", Value: "HAKRCHA1001" },
                        { Name: "비상(강호영)", Value: "HAKRCHA1002" },
                        { Name: "비상(박영민)", Value: "HAKRCHA1003" },
                        { Name: "천재(김수학)", Value: "HAKRCHA1004" },
						{ Name: "창비(최원식)", Value: "HAKRCHA1005" }
                    ]
                    },
                    { Name: "공통영어", Value: "EG", WithTxCode: true, TX_CODE: [
                        { Name: "능률(민병천)", Value: "HAEGCHA1001" },
                        { Name: "YBM(박준언)", Value: "HAEGCHA1002" },
                        { Name: "능률(오선영)", Value: "HAEGCHA1003" },
						{ Name: "미래엔(김성연)", Value: "HAEGCHA1004" },
                        { Name: "비상(홍민표)", Value: "HAEGCHA1005" },                        
						{ Name: "YBM(김은형)", Value: "HAEGCHA1006" },
						{ Name: "천재(조수경)", Value: "HAEGCHA1007" }
                    ]
                    },
                    { Name: "공통수학", Value: "MT",  WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "HAMTCHA1001" }
                    ]
					},
                    { Name: "통합과학", Value: "SC", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "HASCCHA1001" }
                    ]
                    },
                    { Name: "통합사회", Value: "LS", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "HALSCHA1001" }
                    ]
                    },
					{ Name: "한국사", Value: "HI", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "HALSCHA0001" }
                    ]
                    },
					{ Name: "기술가정", Value: "TH", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "HATHCHA0001" }
                    ]
                    }
                ]
            },
                { Name: "2,3학년", Value: "2", Subj_Code: [
					{ Name: "문학", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "비상(강호영)", Value: "HAKRCHA2001" },
                        { Name: "미래엔(방민호)", Value: "HAKRCHA2002" },
                        { Name: "천재(정호웅)", Value: "HAKRCHA2003" },
                        { Name: "창비(최원식)", Value: "HAKRCHA2004" },
						{ Name: "지학사(정재찬)", Value: "HAKRCHA2005" }
                    ]
                    },
					{ Name: "독서와 작문", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "비상(최인영)", Value: "HAKRCHA2006", term2_ServiceYN: "N" },
						{ Name: "미래엔(방민호)", Value: "HAKRCHA2007", term2_ServiceYN: "N" },
						{ Name: "해냄(송승훈)", Value: "HAKRCHA2008", term2_ServiceYN: "N" },
						{ Name: "천재(천경록)", Value: "HAKRCHA2009", term2_ServiceYN: "N" },
						{ Name: "지학사(서혁)", Value: "HAKRCHA2010", term2_ServiceYN: "N" }
                    ]
                    },
					{ Name: "화법과 언어", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "비상(이관규)", Value: "HAKRCHA2011", term2_ServiceYN: "N" },
						{ Name: "미래엔(민병곤)", Value: "HAKRCHA2012", term2_ServiceYN: "N" },
						{ Name: "창비(최형용)", Value: "HAKRCHA2013", term2_ServiceYN: "N" }
                    ]
                    },
                    { Name: "영어Ⅰ", Value: "EG", WithTxCode: true, TX_CODE: [
                        { Name: "능률(오선영)", Value: "HAEGCHA2001" },
                        { Name: "YBM(박준언)", Value: "HAEGCHA2002" },
                        { Name: "비상(홍민표)", Value: "HAEGCHA2003" },
                        { Name: "미래엔(김성연)", Value: "HAEGCHA2004" },
                        { Name: "천재(조수경)", Value: "HAEGCHA2005" }
                    ]
                    },
					{ Name: "영어Ⅱ", Value: "EG", WithTxCode: true, TX_CODE: [
                        { Name: "능률(오선영)", Value: "HAEGCHA2006", term2_ServiceYN: "N" },
                        { Name: "YBM(박준언)", Value: "HAEGCHA2007", term2_ServiceYN: "N" },
                        { Name: "비상(홍민표)", Value: "HAEGCHA2008", term2_ServiceYN: "N" },
                        { Name: "미래엔(김성연)", Value: "HAEGCHA2009", term2_ServiceYN: "N" },
                        { Name: "천재(조수경)", Value: "HAEGCHA2010", term2_ServiceYN: "N" }
                    ]
                    },
                    { Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
                        { Name: "대수", Value: "HAMTCHA2001" },
                        { Name: "확률과 통계", Value: "HAMTCHA2002" },
                        { Name: "기하", Value: "HAMTCHA2005" },
                        { Name: "미적분Ⅰ", Value: "HAMTCHA2003", term2_ServiceYN: "N" },
                        { Name: "미적분Ⅱ", Value: "HAMTCHA2004", term2_ServiceYN: "N" }
                    ]
                    },
                    { Name: "과학", Value: "SC", WithTxCode: true, TX_CODE: [
                        { Name: "물리학", Value: "HASCCHA2001" },
                        { Name: "화학", Value: "HASCCHA2002" },
                        { Name: "생명과학", Value: "HASCCHA2003" },
                        { Name: "지구과학", Value: "HASCCHA2004" },
						{ Name: "역학과 에너지", Value: "HASCCHA2005", term2_ServiceYN: "N" },
						{ Name: "물질과 에너지", Value: "HASCCHA2006", term2_ServiceYN: "N" },
						{ Name: "세포와 물질대사", Value: "HASCCHA2007", term2_ServiceYN: "N" },
						{ Name: "지구시스템과학", Value: "HASCCHA2008", term2_ServiceYN: "N" }
                    ]
                    },
                    { Name: "사회", Value: "LS", WithTxCode: true, TX_CODE: [
                        { Name: "사회와 문화", Value: "HALSCHA2001" },
                        { Name: "현대사회와 윤리", Value: "HALSCHA2002" },
                        { Name: "세계시민과 지리", Value: "HALSCHA2003" },
                        { Name: "세계사", Value: "HALSCHA2004" },
                        { Name: "윤리와 사상", Value: "HALSCHA2005" },
                        { Name: "법과 사회", Value: "HALSCHA2006" },
                        { Name: "정치", Value: "HALSCHA2007" },
                        { Name: "경제", Value: "HALSCHA2008", term2_ServiceYN: "N" },
                        { Name: "한국지리 탐구", Value: "HALSCHA2009", term2_ServiceYN: "N" }
                    ]
                    },
                    { Name: "한국사", Value: "HI", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "HALSCHA0001" }
                    ]
                    }
                ]
                }
            ]
        },
            { Value: "E", Grade: [ // 최다오답
                {Name: "1학년", Value: "1", Subj_Code: [
                    { Name: "공통국어", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "미래엔(신유식)", Value: "HAKRCHA1001" },
                        { Name: "비상(강호영)", Value: "HAKRCHA1002" },
                        { Name: "비상(박영민)", Value: "HAKRCHA1003" },
                        { Name: "천재(김수학)", Value: "HAKRCHA1004" },
						{ Name: "창비(최원식)", Value: "HAKRCHA1005" }
                    ]
                    },
                    { Name: "공통영어", Value: "EG", WithTxCode: true, TX_CODE: [
                        { Name: "능률(민병천)", Value: "HAEGCHA1001" },
                        { Name: "YBM(박준언)", Value: "HAEGCHA1002" },
                        { Name: "능률(오선영)", Value: "HAEGCHA1003" },
						{ Name: "미래엔(김성연)", Value: "HAEGCHA1004" },
                        { Name: "비상(홍민표)", Value: "HAEGCHA1005" },                        
						{ Name: "YBM(김은형)", Value: "HAEGCHA1006" },
						{ Name: "천재(조수경)", Value: "HAEGCHA1007" }
                    ]
                    },
                    { Name: "공통수학", Value: "MT",  WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "HAMTCHA1001" }
                    ]
					},
                    { Name: "통합과학", Value: "SC", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "HASCCHA1001" }
                    ]
                    },
                    { Name: "통합사회", Value: "LS", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "HALSCHA1001" }
                    ]
                    },
					{ Name: "한국사", Value: "HI", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "HALSCHA0001" }
                    ]
                    },
					{ Name: "기술가정", Value: "TH", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "HATHCHA0001" }
                    ]
                    }
                ]
            },
                { Name: "2,3학년", Value: "2", Subj_Code: [
					{ Name: "문학", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "비상(강호영)", Value: "HAKRCHA2001" },
                        { Name: "미래엔(방민호)", Value: "HAKRCHA2002" },
                        { Name: "천재(정호웅)", Value: "HAKRCHA2003" },
                        { Name: "창비(최원식)", Value: "HAKRCHA2004" },
						{ Name: "지학사(정재찬)", Value: "HAKRCHA2005" }
                    ]
                    },
					{ Name: "독서와 작문", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "비상(최인영)", Value: "HAKRCHA2006", term2_ServiceYN: "N" },
						{ Name: "미래엔(방민호)", Value: "HAKRCHA2007", term2_ServiceYN: "N" },
						{ Name: "해냄(송승훈)", Value: "HAKRCHA2008", term2_ServiceYN: "N" },
						{ Name: "천재(천경록)", Value: "HAKRCHA2009", term2_ServiceYN: "N" },
						{ Name: "지학사(서혁)", Value: "HAKRCHA2010", term2_ServiceYN: "N" }
                    ]
                    },
					{ Name: "화법과 언어", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "비상(이관규)", Value: "HAKRCHA2011", term2_ServiceYN: "N" },
						{ Name: "미래엔(민병곤)", Value: "HAKRCHA2012", term2_ServiceYN: "N" },
						{ Name: "창비(최형용)", Value: "HAKRCHA2013", term2_ServiceYN: "N" }
                    ]
                    },
                    { Name: "영어Ⅰ", Value: "EG", WithTxCode: true, TX_CODE: [
                        { Name: "능률(오선영)", Value: "HAEGCHA2001" },
                        { Name: "YBM(박준언)", Value: "HAEGCHA2002" },
                        { Name: "비상(홍민표)", Value: "HAEGCHA2003" },
                        { Name: "미래엔(김성연)", Value: "HAEGCHA2004" },
                        { Name: "천재(조수경)", Value: "HAEGCHA2005" }
                    ]
                    },
					{ Name: "영어Ⅱ", Value: "EG", WithTxCode: true, TX_CODE: [
                        { Name: "능률(오선영)", Value: "HAEGCHA2006", term2_ServiceYN: "N" },
                        { Name: "YBM(박준언)", Value: "HAEGCHA2007", term2_ServiceYN: "N" },
                        { Name: "비상(홍민표)", Value: "HAEGCHA2008", term2_ServiceYN: "N" },
                        { Name: "미래엔(김성연)", Value: "HAEGCHA2009", term2_ServiceYN: "N" },
                        { Name: "천재(조수경)", Value: "HAEGCHA2010", term2_ServiceYN: "N" }
                    ]
                    },
                    { Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
                        { Name: "대수", Value: "HAMTCHA2001" },
                        { Name: "확률과 통계", Value: "HAMTCHA2002" },
                        { Name: "기하", Value: "HAMTCHA2005" },
                        { Name: "미적분Ⅰ", Value: "HAMTCHA2003", term2_ServiceYN: "N" },
                        { Name: "미적분Ⅱ", Value: "HAMTCHA2004", term2_ServiceYN: "N" }
                    ]
                    },
                    { Name: "과학", Value: "SC", WithTxCode: true, TX_CODE: [
                        { Name: "물리학", Value: "HASCCHA2001" },
                        { Name: "화학", Value: "HASCCHA2002" },
                        { Name: "생명과학", Value: "HASCCHA2003" },
                        { Name: "지구과학", Value: "HASCCHA2004" },
						{ Name: "역학과 에너지", Value: "HASCCHA2005", term2_ServiceYN: "N" },
						{ Name: "물질과 에너지", Value: "HASCCHA2006", term2_ServiceYN: "N" },
						{ Name: "세포와 물질대사", Value: "HASCCHA2007", term2_ServiceYN: "N" },
						{ Name: "지구시스템과학", Value: "HASCCHA2008", term2_ServiceYN: "N" }
                    ]
                    },
                    { Name: "사회", Value: "LS", WithTxCode: true, TX_CODE: [
                        { Name: "사회와 문화", Value: "HALSCHA2001" },
                        { Name: "현대사회와 윤리", Value: "HALSCHA2002" },
                        { Name: "세계시민과 지리", Value: "HALSCHA2003" },
                        { Name: "세계사", Value: "HALSCHA2004" },
                        { Name: "윤리와 사상", Value: "HALSCHA2005" },
                        { Name: "법과 사회", Value: "HALSCHA2006" },
                        { Name: "정치", Value: "HALSCHA2007" },
                        { Name: "경제", Value: "HALSCHA2008", term2_ServiceYN: "N" },
                        { Name: "한국지리 탐구", Value: "HALSCHA2009", term2_ServiceYN: "N" }
                    ]
                    },
                    { Name: "한국사", Value: "HI", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "HALSCHA0001" }
                    ]
                    }
                ]
                }
            ]
        },

		{Value: "G", Grade: [  //최상위 공략
            { Name: "1학년", Value: "1", Subj_Code: [
                { Name: "공통국어", Value: "KR", WithTxCode: true, TX_CODE: [
					{ Name: "미래엔(신유식)", Value: "HAKRCHA1001" },
					{ Name: "비상(강호영)", Value: "HAKRCHA1002" },
					{ Name: "비상(박영민)", Value: "HAKRCHA1003" },
					{ Name: "천재(김수학)", Value: "HAKRCHA1004" },
					{ Name: "창비(최원식)", Value: "HAKRCHA1005" }
				]
				},
				{ Name: "공통영어", Value: "EG", WithTxCode: true, TX_CODE: [
					{ Name: "능률(민병천)", Value: "HAEGCHA1001" },
					{ Name: "YBM(박준언)", Value: "HAEGCHA1002" },
					{ Name: "능률(오선영)", Value: "HAEGCHA1003" },
					{ Name: "미래엔(김성연)", Value: "HAEGCHA1004" },
					{ Name: "비상(홍민표)", Value: "HAEGCHA1005" },                        
					{ Name: "YBM(김은형)", Value: "HAEGCHA1006" },
					{ Name: "천재(조수경)", Value: "HAEGCHA1007" }
				]
				},
				{ Name: "공통수학", Value: "MT",  WithTxCode: true, TX_CODE: [ 
					{ Name: "공통", Value: "HAMTCHA1001" } 
				]
				},
				{ Name: "통합과학", Value: "SC", WithTxCode: true, TX_CODE: [
					{ Name: "공통", Value: "HASCCHA1001" }
				]
				},
				{ Name: "통합사회", Value: "LS", WithTxCode: true, TX_CODE: [
					{ Name: "공통", Value: "HALSCHA1001" }
				]
				},
				{ Name: "한국사", Value: "HI", WithTxCode: true, TX_CODE: [
					{ Name: "공통", Value: "HALSCHA0001" }
				]
				}
            ]
            },
            { Name: "2,3학년", Value: "2", Subj_Code: [
                { Name: "문학", Value: "KR", WithTxCode: true, TX_CODE: [
					{ Name: "비상(강호영)", Value: "HAKRCHA2001" },
					{ Name: "미래엔(방민호)", Value: "HAKRCHA2002" },
					{ Name: "천재(정호웅)", Value: "HAKRCHA2003" },
					{ Name: "창비(최원식)", Value: "HAKRCHA2004" },
					{ Name: "지학사(정재찬)", Value: "HAKRCHA2005" }
				]
				},
				{ Name: "독서와 작문", Value: "KR", WithTxCode: true, TX_CODE: [
					{ Name: "비상(최인영)", Value: "HAKRCHA2006", term2_ServiceYN: "N" },
					{ Name: "미래엔(방민호)", Value: "HAKRCHA2007", term2_ServiceYN: "N" },
					{ Name: "해냄(송승훈)", Value: "HAKRCHA2008", term2_ServiceYN: "N" },
					{ Name: "천재(천경록)", Value: "HAKRCHA2009", term2_ServiceYN: "N" },
					{ Name: "지학사(서혁)", Value: "HAKRCHA2010", term2_ServiceYN: "N" }
				]
				},
				{ Name: "화법과 언어", Value: "KR", WithTxCode: true, TX_CODE: [
					{ Name: "비상(이관규)", Value: "HAKRCHA2011", term2_ServiceYN: "N" },
					{ Name: "미래엔(민병곤)", Value: "HAKRCHA2012", term2_ServiceYN: "N" },
					{ Name: "창비(최형용)", Value: "HAKRCHA2013", term2_ServiceYN: "N" }
				]
				},
				{ Name: "영어Ⅰ", Value: "EG", WithTxCode: true, TX_CODE: [
					{ Name: "능률(오선영)", Value: "HAEGCHA2001" },
					{ Name: "YBM(박준언)", Value: "HAEGCHA2002" },
					{ Name: "비상(홍민표)", Value: "HAEGCHA2003" },
					{ Name: "미래엔(김성연)", Value: "HAEGCHA2004" },
					{ Name: "천재(조수경)", Value: "HAEGCHA2005" }
				]
				},
				{ Name: "영어Ⅱ", Value: "EG", WithTxCode: true, TX_CODE: [
					{ Name: "능률(오선영)", Value: "HAEGCHA2006", term2_ServiceYN: "N" },
					{ Name: "YBM(박준언)", Value: "HAEGCHA2007", term2_ServiceYN: "N" },
					{ Name: "비상(홍민표)", Value: "HAEGCHA2008", term2_ServiceYN: "N" },
					{ Name: "미래엔(김성연)", Value: "HAEGCHA2009", term2_ServiceYN: "N" },
					{ Name: "천재(조수경)", Value: "HAEGCHA2010", term2_ServiceYN: "N" }
				]
				},
				{ Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
					{ Name: "대수", Value: "HAMTCHA2001" },
					{ Name: "확률과 통계", Value: "HAMTCHA2002" },
					{ Name: "기하", Value: "HAMTCHA2005" },
					{ Name: "미적분Ⅰ", Value: "HAMTCHA2003", term2_ServiceYN: "N" },
					{ Name: "미적분Ⅱ", Value: "HAMTCHA2004", term2_ServiceYN: "N" }
				]
				},
				{ Name: "과학", Value: "SC", WithTxCode: true, TX_CODE: [
					{ Name: "물리학", Value: "HASCCHA2001" },
					{ Name: "화학", Value: "HASCCHA2002" },
					{ Name: "생명과학", Value: "HASCCHA2003" },
					{ Name: "지구과학", Value: "HASCCHA2004" },
					{ Name: "역학과 에너지", Value: "HASCCHA2005", term2_ServiceYN: "N" },
					{ Name: "물질과 에너지", Value: "HASCCHA2006", term2_ServiceYN: "N" },
					{ Name: "세포와 물질대사", Value: "HASCCHA2007", term2_ServiceYN: "N" },
					{ Name: "지구시스템과학", Value: "HASCCHA2008", term2_ServiceYN: "N" }
				]
				},
				{ Name: "사회", Value: "LS", WithTxCode: true, TX_CODE: [
					{ Name: "사회와 문화", Value: "HALSCHA2001" },
					{ Name: "현대사회와 윤리", Value: "HALSCHA2002" },
					{ Name: "세계시민과 지리", Value: "HALSCHA2003" },
					{ Name: "세계사", Value: "HALSCHA2004" },
					{ Name: "윤리와 사상", Value: "HALSCHA2005" },
					{ Name: "법과 사회", Value: "HALSCHA2006" },
					{ Name: "정치", Value: "HALSCHA2007" },
					{ Name: "경제", Value: "HALSCHA2008", term2_ServiceYN: "N" },
					{ Name: "한국지리 탐구", Value: "HALSCHA2009", term2_ServiceYN: "N" }
				]
				},
				{ Name: "한국사", Value: "HI", WithTxCode: true, TX_CODE: [
					{ Name: "공통", Value: "HALSCHA0001" }
				]
				}
            ]
            }
        ]
    },

            { Value: "", Grade: [ // 요점정리, 개념완성
                {Name: "1학년", Value: "1", WithTxCode: true, Subj_Code: [
                    { Name: "공통국어", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "미래엔(신유식)", Value: "HAKRCHA1001" },
                        { Name: "비상(강호영)", Value: "HAKRCHA1002" },
                        { Name: "비상(박영민)", Value: "HAKRCHA1003" },
                        { Name: "천재(김수학)", Value: "HAKRCHA1004" },
						{ Name: "창비(최원식)", Value: "HAKRCHA1005" }
                    ]
                    },
                    { Name: "국어 문법", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "H8KRCHA0002" }
                    ]
                    },
                    { Name: "공통영어", Value: "EG", WithTxCode: true, TX_CODE: [
                        { Name: "능률(민병천)", Value: "HAEGCHA1001" },
                        { Name: "YBM(박준언)", Value: "HAEGCHA1002" },
                        { Name: "능률(오선영)", Value: "HAEGCHA1003" },
						{ Name: "미래엔(김성연)", Value: "HAEGCHA1004" },
                        { Name: "비상(홍민표)", Value: "HAEGCHA1005" },                        
						{ Name: "YBM(김은형)", Value: "HAEGCHA1006" },
						{ Name: "천재(조수경)", Value: "HAEGCHA1007" }
                    ]
                    },
                    { Name: "공통수학", Value: "MT",  WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "HAMTCHA1001" }
                    ]
					},
                    { Name: "통합과학", Value: "SC", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "HASCCHA1001" }
                    ]
                    },
					{ Name: "과학탐구실험", Value: "SC", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "H9SCCHA1002" }
                    ]
                    },
                    { Name: "통합사회", Value: "LS", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "HALSCHA1001" }
                    ]
                    },
					{ Name: "한국사", Value: "HI", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "HALSCHA0001" }
                    ]
                    },
					{ Name: "기술가정", Value: "TH", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "HATHCHA0001" }
                    ]
                    }
                ]
            },
                { Name: "2학년", Value: "2", Subj_Code: [
                    { Name: "문학", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "비상(강호영)", Value: "HAKRCHA2001" },
                        { Name: "미래엔(방민호)", Value: "HAKRCHA2002" },
                        { Name: "천재(정호웅)", Value: "HAKRCHA2003" },
                        { Name: "창비(최원식)", Value: "HAKRCHA2004" },
						{ Name: "지학사(정재찬)", Value: "HAKRCHA2005" }
                    ]
                    },
					{ Name: "독서와 작문", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "비상(최인영)", Value: "HAKRCHA2006", term2_ServiceYN: "N" },
						{ Name: "미래엔(방민호)", Value: "HAKRCHA2007", term2_ServiceYN: "N" },
						{ Name: "해냄(송승훈)", Value: "HAKRCHA2008", term2_ServiceYN: "N" },
						{ Name: "천재(천경록)", Value: "HAKRCHA2009", term2_ServiceYN: "N" },
						{ Name: "지학사(서혁)", Value: "HAKRCHA2010", term2_ServiceYN: "N" }
                    ]
                    },
					{ Name: "화법과 언어", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "비상(이관규)", Value: "HAKRCHA2011", term2_ServiceYN: "N" },
						{ Name: "미래엔(민병곤)", Value: "HAKRCHA2012", term2_ServiceYN: "N" },
						{ Name: "창비(최형용)", Value: "HAKRCHA2013", term2_ServiceYN: "N" }
                    ]
                    },
                    { Name: "영어Ⅰ", Value: "EG", WithTxCode: true, TX_CODE: [
                        { Name: "능률(오선영)", Value: "HAEGCHA2001" },
                        { Name: "YBM(박준언)", Value: "HAEGCHA2002" },
                        { Name: "비상(홍민표)", Value: "HAEGCHA2003" },
                        { Name: "미래엔(김성연)", Value: "HAEGCHA2004" },
                        { Name: "천재(조수경)", Value: "HAEGCHA2005" }
                    ]
                    },
					{ Name: "영어Ⅱ", Value: "EG", WithTxCode: true, TX_CODE: [
                        { Name: "능률(오선영)", Value: "HAEGCHA2006", term2_ServiceYN: "N" },
                        { Name: "YBM(박준언)", Value: "HAEGCHA2007", term2_ServiceYN: "N" },
                        { Name: "비상(홍민표)", Value: "HAEGCHA2008", term2_ServiceYN: "N" },
                        { Name: "미래엔(김성연)", Value: "HAEGCHA2009", term2_ServiceYN: "N" },
                        { Name: "천재(조수경)", Value: "HAEGCHA2010", term2_ServiceYN: "N" }
                    ]
                    },
                    { Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
                        { Name: "대수", Value: "HAMTCHA2001" },
                        { Name: "확률과 통계", Value: "HAMTCHA2002" },
                        { Name: "기하", Value: "HAMTCHA2005" },
                        { Name: "미적분Ⅰ", Value: "HAMTCHA2003", term2_ServiceYN: "N" },
                        { Name: "미적분Ⅱ", Value: "HAMTCHA2004", term2_ServiceYN: "N" }
                    ]
                    },
                    { Name: "과학", Value: "SC", WithTxCode: true, TX_CODE: [
                        { Name: "물리학", Value: "HASCCHA2001" },
                        { Name: "화학", Value: "HASCCHA2002" },
                        { Name: "생명과학", Value: "HASCCHA2003" },
                        { Name: "지구과학", Value: "HASCCHA2004" },
						{ Name: "역학과 에너지", Value: "HASCCHA2005", term2_ServiceYN: "N" },
						{ Name: "물질과 에너지", Value: "HASCCHA2006", term2_ServiceYN: "N" },
						{ Name: "세포와 물질대사", Value: "HASCCHA2007", term2_ServiceYN: "N" },
						{ Name: "지구시스템과학", Value: "HASCCHA2008", term2_ServiceYN: "N" }
                    ]
                    },
                    { Name: "사회", Value: "LS", WithTxCode: true, TX_CODE: [
                        { Name: "사회와 문화", Value: "HALSCHA2001" },
                        { Name: "현대사회와 윤리", Value: "HALSCHA2002" },
                        { Name: "세계시민과 지리", Value: "HALSCHA2003" },
                        { Name: "세계사", Value: "HALSCHA2004" },
                        { Name: "윤리와 사상", Value: "HALSCHA2005" },
                        { Name: "법과 사회", Value: "HALSCHA2006" },
                        { Name: "정치", Value: "HALSCHA2007" },
                        { Name: "경제", Value: "HALSCHA2008", term2_ServiceYN: "N" },
                        { Name: "한국지리 탐구", Value: "HALSCHA2009", term2_ServiceYN: "N" }
                    ]
                    },
                    { Name: "한국사", Value: "HI", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "HALSCHA0001" }
                    ]
                    },
                    { Name: "기술가정", Value: "TH", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "HATHCHA0001" }
                    ]
                    }
                ]
                },
                { Name: "3학년", Value: "3", Subj_Code: [
                    { Name: "국어 문법", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "H8KRCHA0002" }
                    ]
                    },
                    { Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
                        { Name: "미적분I", Value: "H8MTCHA2005" },
                        { Name: "미적분Ⅱ", Value: "H8MTCHA2006" },
                        { Name: "확률과 통계", Value: "H7MTEXP2004111" },
                        { Name: "기하와 벡터", Value: "H7MTCHA2004" }
                    ]
                    },
                    { Name: "과학", Value: "SC", WithTxCode: true, TX_CODE: [
                        { Name: "물리Ⅰ", Value: "H7SCEXP2002" },
                        { Name: "생명과학Ⅰ", Value: "H8SCCHA2001" },
                        { Name: "지구과학Ⅰ", Value: "H7SCCHA2003" },
                        { Name: "화학Ⅰ", Value: "H7SCEXP2017" },
                    ]
                    },
                    { Name: "사회", Value: "LS", WithTxCode: true, TX_CODE: [
                        { Name: "사회문화", Value: "H6LSCHA2003" },
                        { Name: "한국지리", Value: "H7LSEXPA012" },
                        { Name: "법과 정치", Value: "H8LSCHA2004" },
                        { Name: "윤리와 사상", Value: "H7LSEXP2014" },
                        { Name: "경제", Value: "H7LSEXP2001" },
                    ]
                    },
                    { Name: "한국사", Value: "HI", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "H7LSEXAA002" }
                    ]
                    }
                ]
                }
            ]
            },
            { Value: "V", Grade: [ // 영어본문학습(개념확인) = 영어본문암기 = 암기노트 동일한 용어임.
                {Name: "1학년", Value: "1", Subj_Code: [
                    { Name: "영어", Value: "EG", WithTxCode: true, TX_CODE: [
                        { Name: "능률(김성곤)", Value: "H9EGCHA1001" },
                        { Name: "YBM(박준언)", Value: "H9EGCHA1002" },
                        { Name: "비상(홍민표)", Value: "H9EGCHA1003" },
                        { Name: "YBM(한상호)", Value: "H9EGCHA1004" },
                        { Name: "천재(이재영)", Value: "H9EGCHA1005" },                        
                        { Name: "지학사(민찬규)", Value: "H9EGCHA1007" },
                        { Name: "능률(양현권)", Value: "H9EGCHA1008" },
                        { Name: "천재(김태영)", Value: "H9EGCHA1009" },
						{ Name: "동아(이병민)", Value: "H9EGCHA1006" }
                    ]
                    }
                ]
                },
                { Name: "2학년", Value: "2", Subj_Code: [
                    { Name: "영어Ⅰ", Value: "EG", WithTxCode: true, TX_CODE: [
                        { Name: "YBM(박준언)", Value: "H9EGCHA2006" },
                        { Name: "YBM(한상호)", Value: "H9EGCHA2007" },
                        { Name: "능률(김성곤)", Value: "H9EGCHA2008" },
                        { Name: "비상(홍민표)", Value: "H9EGCHA2009" },
                        { Name: "천재(이재영)", Value: "H9EGCHA2010" },
                        { Name: "동아(권혁승)", Value: "H9EGCHA2011" }
                    ]
                    },
                    { Name: "영어Ⅱ", Value: "EG", WithTxCode: true, TX_CODE: [
                        { Name: "YBM(박준언)", Value: "H9EGCHA2001" },
                        { Name: "YBM(한상호)", Value: "H9EGCHA2002" },
                        { Name: "비상(홍민표)", Value: "H9EGCHA2003" },
                        { Name: "천재(이재영)", Value: "H9EGCHA2004" },
                        { Name: "능률(김성곤)", Value: "H9EGCHA2005" }
                    ]
                    },
                    { Name: "영어 독해와 작문", Value: "EG", WithTxCode: true, TX_CODE: [
                        { Name: "YBM(신정현)", Value: "H9EGCHA2012" },
                        { Name: "천재(안병규)", Value: "H9EGCHA2013" },
                        { Name: "능률(양현권)", Value: "H9EGCHA2014" }
                    ]
                    }
                ]
                }
            ]
            },
            { Value: "W", Grade: [ // 대표유형
                {Name: "1학년", Value: "1", Subj_Code: [
                    { Name: "국어", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "미래엔(신유식)", Value: "H9KRCHA1001" },
                        { Name: "비상(박안수)", Value: "H9KRCHA1002" },
                        { Name: "천재(박영목)", Value: "H9KRCHA1003" },
                        { Name: "비상(박영민)", Value: "H9KRCHA1004" },
                        { Name: "지학사(이삼형)", Value: "H9KRCHA1005" }
                    ]
                    },
                    { Name: "영어", Value: "EG", WithTxCode: true, TX_CODE: [
                        { Name: "능률(김성곤)", Value: "H9EGCHA1001" },
                        { Name: "YBM(박준언)", Value: "H9EGCHA1002" },
                        { Name: "비상(홍민표)", Value: "H9EGCHA1003" },
                        { Name: "YBM(한상호)", Value: "H9EGCHA1004" },
                        { Name: "천재(이재영)", Value: "H9EGCHA1005" }
                    ]
                    },
                    { Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "H9MTCHA1001" }
                    ]
                    },
                    { Name: "사회", Value: "LS", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "H9LSCHA1001" }
                    ]
                    },
                    { Name: "한국사", Value: "HI", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "H7LSEXAA002" }
                    ]
                    },
                    { Name: "과학", Value: "SC", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "H9SCCHA1001" }
                    ]
                    },
                    { Name: "기술가정", Value: "TH", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "H9THCHA0070" }
                    ]
                    }
                ]
                },
                { Name: "2학년", Value: "2", Subj_Code: [
                    { Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
                        { Name: "수학Ⅰ", Value: "H9MTCHA2003" },
                        { Name: "수학Ⅱ", Value: "H9MTCHA2004" },
                        { Name: "확률과 통계", Value: "H9MTCHA2005" },
                        { Name: "미적분", Value: "H9MTCHA2001" },
                        { Name: "기하", Value: "H9MTCHA2002" }
                    ]
                    },
                    { Name: "사회", Value: "LS", WithTxCode: true, TX_CODE: [
                        { Name: "사회문화", Value: "H9LSCHA2002" },
                        { Name: "한국지리", Value: "H9LSCHA2003" },
                        { Name: "정치와 법", Value: "H9LSCHA2001" },
                        { Name: "세계사", Value: "H9LSCHA2004" },
                        { Name: "윤리와 사상", Value: "H9LSCHA2005" },
                        { Name: "생활과 윤리", Value: "H9LSCHA2006" },
                        { Name: "경제", Value: "H9LSCHA2007" },
                        { Name: "동아시아사", Value: "H9LSCHA2008" },
                        { Name: "세계지리", Value: "H9LSCHA2009" }
                    ]
                    },
                    { Name: "과학", Value: "SC", WithTxCode: true, TX_CODE: [
                        { Name: "물리학Ⅰ", Value: "H9SCCHA2001" },
                        { Name: "생명과학Ⅰ", Value: "H9SCCHA2002" },
                        { Name: "지구과학Ⅰ", Value: "H9SCCHA2003" },
                        { Name: "화학Ⅰ", Value: "H9SCCHA2004" },
						{ Name: "생명과학Ⅱ", Value: "H9SCCHA2005" },
						{ Name: "화학Ⅱ", Value: "H9SCCHA2006" },
						{ Name: "지구과학Ⅱ", Value: "H9SCCHA2007" }
                    ]
                    },
                    { Name: "기술가정", Value: "TH", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "H9THCHA0070" }
                    ]
                    }
                ]
                }
            ]
            }
        ]
        },
		{ Value: "K", ExPapr_CoreType: [ // 상시평가족보            
			{ Value: "T", Grade: [ // 성적 진단평가
                { Name: "1학년", Value: "1", Subj_Code: [
                    { Name: "국어", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "비상(박영민)", Value: "HAKRCHA1003" },
                        { Name: "비상(강호영)", Value: "HAKRCHA1002" },
                        { Name: "미래엔(신유식)", Value: "HAKRCHA1001" },
                        { Name: "천재(김수학)", Value: "HAKRCHA1004" },
						{ Name: "창비(최원식)", Value: "HAKRCHA1005" }
                    ]
                    },
                    { Name: "영어", Value: "EG", WithTxCode: true, TX_CODE: [
                        { Name: "천재(조수경)", Value: "HAEGCHA1007" },
                        { Name: "비상(홍민표)", Value: "HAEGCHA1005" },
                        { Name: "미래엔(김성연)", Value: "HAEGCHA1004" },
						{ Name: "능률(오선영)", Value: "HAEGCHA1003" },
                        { Name: "능률(민병천)", Value: "HAEGCHA1001" },
						{ Name: "YBM(박준언)", Value: "HAEGCHA1002" },
						{ Name: "YBM(김은형)", Value: "HAEGCHA1006" },
                    ]
                    },
                    { Name: "수학", Value: "MT",  WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "HAMTCHA1001" }
                    ]
					}
                ]
                }              
            ]
			}
        ]
    },  
        { Value: "M", ExPapr_CoreType: [ // 단원별 서술형
            {Value: "", Grade: [
                { Name: "1학년", Value: "1", Subj_Code: [
                    { Name: "공통국어", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "미래엔(신유식)", Value: "HAKRCHA1001" },
                        { Name: "비상(강호영)", Value: "HAKRCHA1002" },
                        { Name: "비상(박영민)", Value: "HAKRCHA1003" },
                        { Name: "천재(김수학)", Value: "HAKRCHA1004" },
						{ Name: "창비(최원식)", Value: "HAKRCHA1005" }
                    ]
                    },
                    { Name: "공통영어", Value: "EG", WithTxCode: true, TX_CODE: [
                        { Name: "능률(민병천)", Value: "HAEGCHA1001" },
                        { Name: "YBM(박준언)", Value: "HAEGCHA1002" },
                        { Name: "능률(오선영)", Value: "HAEGCHA1003" },
						{ Name: "미래엔(김성연)", Value: "HAEGCHA1004" },
                        { Name: "비상(홍민표)", Value: "HAEGCHA1005" },                        
						{ Name: "YBM(김은형)", Value: "HAEGCHA1006" },
						{ Name: "천재(조수경)", Value: "HAEGCHA1007" }
                    ]
                    },
                    { Name: "공통수학", Value: "MT",  WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "HAMTCHA1001" }
                    ]
					},
                    { Name: "통합과학", Value: "SC", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "HASCCHA1001" }
                    ]
                    },
                    { Name: "통합사회", Value: "LS", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "HALSCHA1001" }
                    ]
                    },
					{ Name: "한국사", Value: "HI", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "HALSCHA0001" }
                    ]
                    },
					{ Name: "기술가정", Value: "TH", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "HATHCHA0001" }
                    ]
                    }
                ]
                },
                { Name: "2,3학년", Value: "2", Subj_Code: [
                    { Name: "문학", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "비상(강호영)", Value: "HAKRCHA2001" },
                        { Name: "미래엔(방민호)", Value: "HAKRCHA2002" },
                        { Name: "천재(정호웅)", Value: "HAKRCHA2003" },
                        { Name: "창비(최원식)", Value: "HAKRCHA2004" },
						{ Name: "지학사(정재찬)", Value: "HAKRCHA2005" }
                    ]
                    },
					{ Name: "독서와 작문", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "비상(최인영)", Value: "HAKRCHA2006", term2_ServiceYN: "N" },
						{ Name: "미래엔(방민호)", Value: "HAKRCHA2007", term2_ServiceYN: "N" },
						{ Name: "해냄(송승훈)", Value: "HAKRCHA2008", term2_ServiceYN: "N" },
						{ Name: "천재(천경록)", Value: "HAKRCHA2009", term2_ServiceYN: "N" },
						{ Name: "지학사(서혁)", Value: "HAKRCHA2010", term2_ServiceYN: "N" }
                    ]
                    },
					{ Name: "화법과 언어", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "비상(이관규)", Value: "HAKRCHA2011", term2_ServiceYN: "N" },
						{ Name: "미래엔(민병곤)", Value: "HAKRCHA2012", term2_ServiceYN: "N" },
						{ Name: "창비(최형용)", Value: "HAKRCHA2013", term2_ServiceYN: "N" }
                    ]
                    },
                    { Name: "영어Ⅰ", Value: "EG", WithTxCode: true, TX_CODE: [
                        { Name: "능률(오선영)", Value: "HAEGCHA2001" },
                        { Name: "YBM(박준언)", Value: "HAEGCHA2002" },
                        { Name: "비상(홍민표)", Value: "HAEGCHA2003" },
                        { Name: "미래엔(김성연)", Value: "HAEGCHA2004" },
                        { Name: "천재(조수경)", Value: "HAEGCHA2005" }
                    ]
                    },
					{ Name: "영어Ⅱ", Value: "EG", WithTxCode: true, TX_CODE: [
                        { Name: "능률(오선영)", Value: "HAEGCHA2006", term2_ServiceYN: "N" },
                        { Name: "YBM(박준언)", Value: "HAEGCHA2007", term2_ServiceYN: "N" },
                        { Name: "비상(홍민표)", Value: "HAEGCHA2008", term2_ServiceYN: "N" },
                        { Name: "미래엔(김성연)", Value: "HAEGCHA2009", term2_ServiceYN: "N" },
                        { Name: "천재(조수경)", Value: "HAEGCHA2010", term2_ServiceYN: "N" }
                    ]
                    },
                    { Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
                        { Name: "대수", Value: "HAMTCHA2001" },
                        { Name: "확률과 통계", Value: "HAMTCHA2002" },
                        { Name: "기하", Value: "HAMTCHA2005" },
                        { Name: "미적분Ⅰ", Value: "HAMTCHA2003", term2_ServiceYN: "N" },
                        { Name: "미적분Ⅱ", Value: "HAMTCHA2004", term2_ServiceYN: "N" }
                    ]
                    },
                    { Name: "과학", Value: "SC", WithTxCode: true, TX_CODE: [
                        { Name: "물리학", Value: "HASCCHA2001" },
                        { Name: "화학", Value: "HASCCHA2002" },
                        { Name: "생명과학", Value: "HASCCHA2003" },
                        { Name: "지구과학", Value: "HASCCHA2004" },
						{ Name: "역학과 에너지", Value: "HASCCHA2005", term2_ServiceYN: "N" },
						{ Name: "물질과 에너지", Value: "HASCCHA2006", term2_ServiceYN: "N" },
						{ Name: "세포와 물질대사", Value: "HASCCHA2007", term2_ServiceYN: "N" },
						{ Name: "지구시스템과학", Value: "HASCCHA2008", term2_ServiceYN: "N" }
                    ]
                    },
                    { Name: "사회", Value: "LS", WithTxCode: true, TX_CODE: [
                        { Name: "사회와 문화", Value: "HALSCHA2001" },
                        { Name: "현대사회와 윤리", Value: "HALSCHA2002" },
                        { Name: "세계시민과 지리", Value: "HALSCHA2003" },
                        { Name: "세계사", Value: "HALSCHA2004" },
                        { Name: "윤리와 사상", Value: "HALSCHA2005" },
                        { Name: "법과 사회", Value: "HALSCHA2006" },
                        { Name: "정치", Value: "HALSCHA2007" },
                        { Name: "경제", Value: "HALSCHA2008", term2_ServiceYN: "N" },
                        { Name: "한국지리 탐구", Value: "HALSCHA2009", term2_ServiceYN: "N" }
                    ]
                    },
                    { Name: "한국사", Value: "HI", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "HALSCHA0001" }
                    ]
                    }
                ]
                }
            ]
        }
        ]
    },
        { Value: "T", ExPapr_CoreType: [ // 수행 마스터
			{Value: "A", Grade: [ // 수행 마스터 - 탐구형 수행평가
                { Name: "1학년", Value: "1", Subj_Code: [
                    { Name: "국어", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "미래엔(신유식)", Value: "H9KRCHA1001" },
                        { Name: "비상(박안수)", Value: "H9KRCHA1002" },
						{ Name: "천재(박영목)", Value: "H9KRCHA1003" },
						{ Name: "비상(박영민)", Value: "H9KRCHA1004" },
						{ Name: "지학사(이삼형)", Value: "H9KRCHA1005" }
                    ]
                    },
					{ Name: "영어", Value: "EG", WithTxCode: true, TX_CODE: [
                        { Name: "능률(김성곤)", Value: "H9EGCHA1001" },
						{ Name: "YBM(박준언)", Value: "H9EGCHA1002" },
						{ Name: "비상(홍민표)", Value: "H9EGCHA1003" },
						{ Name: "YBM(한상호)", Value: "H9EGCHA1004" },
						{ Name: "천재(이재영)", Value: "H9EGCHA1005" },						
						{ Name: "지학사(민찬규)", Value: "H9EGCHA1007" },
						{ Name: "능률(양현권)", Value: "H9EGCHA1008" },
						{ Name: "천재(김태영)", Value: "H9EGCHA1009" },
						{ Name: "동아(이병민)", Value: "H9EGCHA1006" }
                    ]
                    },
                    { Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "H9MTCHA1001" }
                    ]
                    }
                ]
                }
            ]
        },
			{Value: "B", Grade: [ // 수행 마스터 - 서술형 수행평가
                { Name: "1학년", Value: "1", Subj_Code: [
                    { Name: "국어", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "미래엔(신유식)", Value: "H9KRCHA1001" },
                        { Name: "비상(박안수)", Value: "H9KRCHA1002" },
						{ Name: "천재(박영목)", Value: "H9KRCHA1003" },
						{ Name: "비상(박영민)", Value: "H9KRCHA1004" },
						{ Name: "지학사(이삼형)", Value: "H9KRCHA1005" }
                    ]
                    },
					{ Name: "영어", Value: "EG", WithTxCode: true, TX_CODE: [
                        { Name: "능률(김성곤)", Value: "H9EGCHA1001" },
						{ Name: "YBM(박준언)", Value: "H9EGCHA1002" },
						{ Name: "비상(홍민표)", Value: "H9EGCHA1003" },
						{ Name: "YBM(한상호)", Value: "H9EGCHA1004" },
						{ Name: "천재(이재영)", Value: "H9EGCHA1005" },						
						{ Name: "지학사(민찬규)", Value: "H9EGCHA1007" },
						{ Name: "능률(양현권)", Value: "H9EGCHA1008" },
						{ Name: "천재(김태영)", Value: "H9EGCHA1009" },
						{ Name: "동아(이병민)", Value: "H9EGCHA1006" }
                    ]
                    },
                    { Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "H9MTCHA1001" }
                    ]
                    }
                ]
                }
            ]
        },			
            {Value: "", Grade: [
                { Name: "1학년", Value: "1", Subj_Code: [
                    { Name: "국어", Value: "KR" },
                    { Name: "수학", Value: "MT" },
                    { Name: "과학", Value: "SC" },
                    { Name: "사회", Value: "LS" }
                ]
                },
                { Name: "2학년", Value: "2", Subj_Code: [
                    { Name: "국어", Value: "KR" },
                    { Name: "수학", Value: "MT" },
                    { Name: "과학", Value: "SC" },
                    { Name: "사회", Value: "LS" }
                ]
                }
            ]
        }
        ]
    },  

	{ Value: "OLD", ExPapr_CoreType: [ // 단원별족보
            {Value: "", Grade: [
                { Name: "1학년", Value: "1", Subj_Code: [                    
                ]
                },
                { Name: "2,3학년", Value: "2", Subj_Code: [
                    { Name: "독서", Value: "KR", WithTxCode: true, TX_CODE: [ 
						{ Name: "비상(한철우)", Value: "H9KRCHA2008" }, 
						{ Name: "미래엔(방민호)", Value: "H9KRCHA2009" }, 
						{ Name: "천재(박영목)", Value: "H9KRCHA2010" }  
					]
                    },
					{ Name: "언어와 매체", Value: "KR", WithTxCode: true, TX_CODE: [
						{ Name: "비상(이관규)", Value: "H9KRCHA2011" },
						{ Name: "미래엔(방민호)", Value: "H9KRCHA2012" },
						{ Name: "지학사(이삼형)", Value: "H9KRCHA2013" },
						{ Name: "천재(민현식)", Value: "H9KRCHA2014" }
					]
                    },
                    { Name: "수학", Value: "MT", WithTxCode: true, TX_CODE: [
						{ Name: "수학Ⅰ", Value: "H9MTCHA2003" },
						{ Name: "수학Ⅱ", Value: "H9MTCHA2004" },
						{ Name: "확률과 통계", Value: "H9MTCHA2005" },
						{ Name: "미적분", Value: "H9MTCHA2001" },
						{ Name: "기하", Value: "H9MTCHA2002" },
                    ]
                    },
                    { Name: "과학", Value: "SC", WithTxCode: true, TX_CODE: [
                        { Name: "물리학Ⅰ", Value: "H9SCCHA2001" },
                        { Name: "생명과학Ⅰ", Value: "H9SCCHA2002" },
						{ Name: "생명과학Ⅱ", Value: "H9SCCHA2005" },
                        { Name: "지구과학Ⅰ", Value: "H9SCCHA2003" },
						{ Name: "지구과학Ⅱ", Value: "H9SCCHA2007" },
						{ Name: "화학Ⅰ", Value: "H9SCCHA2004" },						
						{ Name: "화학Ⅱ", Value: "H9SCCHA2006" }						
                    ]
                    },
                    { Name: "사회", Value: "LS", WithTxCode: true, TX_CODE: [
                        { Name: "사회문화", Value: "H9LSCHA2002" },
                        { Name: "한국지리", Value: "H9LSCHA2003" },
						{ Name: "정치와 법", Value: "H9LSCHA2001" },
						{ Name: "세계사", Value: "H9LSCHA2004" },
                        { Name: "윤리와 사상", Value: "H9LSCHA2005" },
                        { Name: "생활과 윤리", Value: "H9LSCHA2006" },
                        { Name: "경제", Value: "H9LSCHA2007" },
						{ Name: "동아시아사", Value: "H9LSCHA2008" },
						{ Name: "세계지리", Value: "H9LSCHA2009" }
                    ]
                    },
                    { Name: "한국사", Value: "HI", WithTxCode: true, TX_CODE: [
						{ Name: "공통", Value: "H9HICHA0001" }
					]
					}
                ]
                }
            ]
        }
        ]
    },

		{ Value: "X", ExPapr_CoreType: [ // 미리보는 XX고사
            {Value: "X", Grade: [
                { Name: "1학년", Value: "1", Subj_Code: [
                    { Name: "국어", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "미래엔(신유식)", Value: "HAKRCHA1001" },
                        { Name: "비상(강호영)", Value: "HAKRCHA1002" },
                        { Name: "비상(박영민)", Value: "HAKRCHA1003" },
                        { Name: "천재(김수학)", Value: "HAKRCHA1004" },
                        { Name: "창비(최원식)", Value: "HAKRCHA1005" }
                    ]
                    },
                    { Name: "영어", Value: "EG", WithTxCode: true, TX_CODE: [
                        { Name: "능률(민병천)", Value: "HAEGCHA1001" },
                        { Name: "YBM(박준언)", Value: "HAEGCHA1002" },
						{ Name: "능률(오선영)", Value: "HAEGCHA1003" },
						{ Name: "미래엔(김성연)", Value: "HAEGCHA1004" },
                        { Name: "비상(홍민표)", Value: "HAEGCHA1005" },
                        { Name: "YBM(김은형)", Value: "HAEGCHA1006" },
						{ Name: "천재(조수경)", Value: "HAEGCHA1007" },
                    ]
                    },
                    { Name: "수학", Value: "MT",  WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "H9MTCHA1001|H7MTEXP1005|H8MTCHA1004" }
                    ]
					},
                    { Name: "통합과학", Value: "SC", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "H9SCCHA1001" }
                    ]
                    },
                    { Name: "통합사회", Value: "LS", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "HALSCHA1001" }
                    ]
                    },
					{ Name: "한국사", Value: "HI", WithTxCode: true, TX_CODE: [
                        { Name: "공통", Value: "HALSCHA0001" }
                    ]
                    }
                ]
                },
                { Name: "2학년", Value: "2", Subj_Code: [
                    { Name: "문학", Value: "KR", WithTxCode: true, TX_CODE: [
                        { Name: "비상(강호영)", Value: "HAKRCHA2001" },
                        { Name: "미래엔(방민호)", Value: "HAKRCHA2002" },
                        { Name: "천재(정호웅)", Value: "HAKRCHA2003" },
						{ Name: "창비(최원식)", Value: "HAKRCHA2004" },
                        { Name: "지학사(정재찬)", Value: "HAKRCHA2005" },
                    ]
                    },
                    { Name: "독서와 작문", Value: "KR1", WithTxCode: true, TX_CODE: [
                        { Name: "비상(최인영)", Value: "HAKRCHA2006" },
                        { Name: "미래엔(방민호)", Value: "HAKRCHA2007" },
                        { Name: "해냄(송승훈)", Value: "HAKRCHA2008" },
						{ Name: "천재(천경록)", Value: "HAKRCHA2009" },
						{ Name: "지학사(서혁)", Value: "HAKRCHA2010" },
                    ]
                    },
                    { Name: "화법과 언어", Value: "KR2", WithTxCode: true, TX_CODE: [
                        { Name: "비상(이관규)", Value: "HAKRCHA2011" },
                        { Name: "미래엔(민병곤)", Value: "HAKRCHA2012" },
                        { Name: "창비(최형용)", Value: "HAKRCHA2013" }
                    ]
                    },
                    { Name: "영어Ⅰ", Value: "EG", WithTxCode: true, TX_CODE: [
                        { Name: "능률(오선영)", Value: "HAEGCHA2001" },
						{ Name: "YBM(박준언)", Value: "HAEGCHA2002" },
                        { Name: "비상(홍민표)", Value: "HAEGCHA2003" },
                        { Name: "미래엔(김성연)", Value: "HAEGCHA2004" },
                        { Name: "천재(조수경)", Value: "HAEGCHA2005" },
                    ]
                    },
					{ Name: "영어Ⅱ", Value: "EG1", WithTxCode: true, TX_CODE: [
                        { Name: "능률(오선영)", Value: "HAEGCHA2006" },
						{ Name: "YBM(박준언)", Value: "HAEGCHA2007" },
                        { Name: "비상(홍민표)", Value: "HAEGCHA2008" },
                        { Name: "미래엔(김성연)", Value: "HAEGCHA2009" },
                        { Name: "천재(조수경)", Value: "HAEGCHA2010" },
                    ]
                    },
                    { Name: "수학 영역", Value: "MT", WithTxCode: true, TX_CODE: [
						{ Name: "대수", Value: "HAMTCHA2001" },
						{ Name: "확률과 통계", Value: "HAMTCHA2002" },
						{ Name: "기하", Value: "HAMTCHA2005" },
						{ Name: "미적분Ⅰ", Value: "HAMTCHA2003" },
						{ Name: "미적분Ⅱ", Value: "HAMTCHA2004" },
                    ]
                    },
                    { Name: "과학 영역", Value: "SC", WithTxCode: true, TX_CODE: [
                        { Name: "물리학", Value: "HASCCHA2001" },
						{ Name: "화학", Value: "HASCCHA2002" },
                        { Name: "생명과학", Value: "HASCCHA2003" },
                        { Name: "지구과학", Value: "HASCCHA2004" }
                    ]
                    },
                    { Name: "사회 영역", Value: "LS", WithTxCode: true, TX_CODE: [
                        { Name: "사회와 문화", Value: "HALSCHA2001" },
                        { Name: "현대사회와 윤리", Value: "HALSCHA2002" },
						{ Name: "세계시민과 지리", Value: "HALSCHA2003" },
                        { Name: "세계사", Value: "HALSCHA2004" },
                        { Name: "윤리와 사상", Value: "HALSCHA2005" },
                        { Name: "법과 사회", Value: "HALSCHA2006" },
                        { Name: "정치", Value: "HALSCHA2007" },
                        { Name: "경제", Value: "HALSCHA2008" },
                        { Name: "한국지리 탐구", Value: "HALSCHA2009" },
                    ]
                    }
                ]
                }
            ]
        }
        ]
    }
    ]
}
];

var _Hierarchy;

var ___SiteID;
var ___ExPapr_Group;
var ___ExPapr_CoreType;

function Hierarchy_Init(SiteID, ExPapr_Group, ExPapr_CoreType) {
    _hLog("Hierarchy_Init SiteID=" + SiteID + ", Group=" + ExPapr_Group + ", TYPE=" + ExPapr_CoreType);
    ___SiteID = SiteID;
    ___ExPapr_Group = ExPapr_Group;
    ___ExPapr_CoreType = ExPapr_CoreType;

    // 현재 SiteID, ExPapr_Group, ExPapar_CoreType 하위의 JSON 검색
    for (var i = 0; i < Hierarchy.length; i++) {
        if (Hierarchy[i].Value == SiteID) {
            for (var j = 0; j < Hierarchy[i].ExPapr_Group.length; j++) {
                if (Hierarchy[i].ExPapr_Group[j].Value == ExPapr_Group) {
                    for (var k = 0; k < Hierarchy[i].ExPapr_Group[j].ExPapr_CoreType.length; k++) {
                        // alert(Hierarchy[i].ExPapr_Group[j].ExPapr_CoreType[k].Value);

                        if (Hierarchy[i].ExPapr_Group[j].ExPapr_CoreType[k].Value == ExPapr_CoreType) {
                            _Hierarchy = Hierarchy[i].ExPapr_Group[j].ExPapr_CoreType[k].Grade;
                            _hLog("_Hierarchy set = " + _Hierarchy);
                            break;
                        }
                    }
                    break;
                }
            }
            break;
        }
    }
}

// Grade 에 해당하는 Subj_Code 를 설정
function Set_Subj_Code() {
    if (_Hierarchy == null)
        return;

    var Form = document.SearchFrm;
    var SiteID = ___SiteID;
    var Grade = Form.Grade;
    var Subj_Code = Form.Subj_Code;

    var Grade_Idx = Grade.selectedIndex;

    // Subj_Code 폼을 초기화하고 기본값만 추가를 한다.
    Subj_Code.innerHTML = "";
    Subj_Code.add(new Option("과목", ""));

    // Grade 가 선택이 된 경우만 Subj_Code를 설정한다.
    if (Grade_Idx != 0) {

        if (!_Hierarchy[Grade_Idx - 1]) return;

        // 현재 Grade 하위의 과목 그룹을 가져와 Subj_Code 에 추가한다.
        for (var i = 0; i < _Hierarchy[Grade_Idx - 1].Subj_Code.length; i++) {
            var _Option = new Option(
                                _Hierarchy[Grade_Idx - 1].Subj_Code[i].Name,
                                _Hierarchy[Grade_Idx - 1].Subj_Code[i].Value
                                );

            Subj_Code.add(_Option);

            // 과목만 선택될 경우 Tx_Code값을 함께 넘기기 위한 Attr
            if (_Hierarchy[Grade_Idx - 1].Subj_Code[i].WithTxCode == true) {
                _Option.setAttribute('WithTxCode', 'Y');
            } else {
                _Option.removeAttribute('WithTxCode');
            }
        }
    }

    if (Form.TX_CODE == null)
        return;

    var TX_CODE = Form.TX_CODE;
    // TX_CODE 폼을 초기화하고 기본값만 추가를 한다.
    TX_CODE.innerHTML = "";
    TX_CODE.add(new Option("교과서", ""));
}

// Subj_Code 에 해당하는 TX_CODE 를 설정
function Set_TX_CODE() {
    if (_Hierarchy == null)
        return;

    var Form = document.SearchFrm;
    var SiteID = ___SiteID;
    var Grade = Form.Grade;
    var Subj_Code = Form.Subj_Code;

    if (Form.TX_CODE == null)
        return;

    var TX_CODE = Form.TX_CODE;

    var Grade_Idx = Grade.selectedIndex;
    var Subj_Code_Idx = Subj_Code.selectedIndex;

    // TX_CODE 폼을 초기화하고 기본값만 추가를 한다.
    TX_CODE.innerHTML = "";
    TX_CODE.add(new Option("교과서", ""));

    // Subj_Code 가 선택이 된 경우만 TX_CODE를 설정한다.
    if (Subj_Code_Idx != 0) {
        // 현재 Subj_Code 하위의 교과서 그룹을 가져와 TX_CODE 에 추가한다.
        if (_Hierarchy[Grade_Idx - 1].Subj_Code[Subj_Code_Idx - 1].TX_CODE != null) {
            for (var i = 0; i < _Hierarchy[Grade_Idx - 1].Subj_Code[Subj_Code_Idx - 1].TX_CODE.length; i++) {
                TX_CODE.add(new Option(
                                    _Hierarchy[Grade_Idx - 1].Subj_Code[Subj_Code_Idx - 1].TX_CODE[i].Name,
                                    _Hierarchy[Grade_Idx - 1].Subj_Code[Subj_Code_Idx - 1].TX_CODE[i].Value
                                    ));
            }
        }
    }
}

var setYears = function(sy, ey) {
    var years = [];
    for(var i=sy;i>=ey;i--) {
        years.push({value:i});
    }

    return years;
}

var initYears = [
    // 중 1 단원별
    {code : "M_1_C__KR", years : setYears(2020,2018)},
    {code : "M_1_C__EG", years : setYears(2020,2018)},
    {code : "M_1_C__MT", years : setYears(2020,2018)},
	{code : "M_1_C__MT_O", years : setYears(2017,2013)},
    {code : "M_1_C__SC", years : setYears(2020,2018)},
	{code : "M_1_C__SC_O", years : setYears(2017,2013)},
    {code : "M_1_C__LS", years : setYears(2020,2018)},
    {code : "M_1_C__HI", years : setYears(2023,2020)},
    {code : "M_1_C__HI_O", years : setYears(2020,2014)},
    {code : "M_1_C__ET", years : setYears(2023,2019)},
    {code : "M_1_C__TH", years : setYears(2023,2019)},
    {code : "M_1_C__CH", years : setYears(2023,2019)},
	{code : "M_1_C__", years : setYears(2023,2013)}, // 중1 단원별 과목 없는 경우

    // 중 1 서술형
    {code : "M_1_M__KR", years : setYears(2020,2018)},
    {code : "M_1_M__EG", years : setYears(2020,2018)},
    {code : "M_1_M__MT", years : setYears(2020,2018)},
    {code : "M_1_M__MT_O", years : setYears(2017,2013)},
    {code : "M_1_M__SC", years : setYears(2020,2018)},
    {code : "M_1_M__SC_O", years : setYears(2017,2013)},
    {code : "M_1_M__LS", years : setYears(2020,2018)},
    {code : "M_1_M__HI", years : setYears(2023,2020)},
    {code : "M_1_M__HI_O", years : setYears(2020,2014)},
	{code : "M_1_M__TH", years : setYears(2023,2021)},
	{code : "M_1_M__ET", years : setYears(2023,2021)},
	{code : "M_1_M__", years : setYears(2023,2013)}, // 중1 서술형 과목 없는 경우

    // 중 1 최다빈출
    {code : "M_1_H_D_KR", years : setYears(2020,2019)},
    {code : "M_1_H_D_EG", years : setYears(2020,2019)},
    {code : "M_1_H_D_MT", years : setYears(2020,2018)},
    {code : "M_1_H_D_MT_O", years : setYears(2017,2013)},
    {code : "M_1_H_D_SC", years : setYears(2020,2018)},
    {code : "M_1_H_D_SC_O", years : setYears(2017,2013)},
    {code : "M_1_H_D_LS", years : setYears(2020,2018)},
    {code : "M_1_H_D_HI", years : setYears(2023,2020)},
    {code : "M_1_H_D_HI_O", years : setYears(2020,2014)},
    {code : "M_1_H_D_ET", years : setYears(2023,2019)},
    {code : "M_1_H_D_TH", years : setYears(2023,2019)},
	{code : "M_1_H_D_", years : setYears(2023,2013)}, // 중1 최다빈출 과목 없는 경우

    // 중 1 최다오답
    {code : "M_1_H_E_KR", years : setYears(2020,2019)},
    {code : "M_1_H_E_EG", years : setYears(2020,2019)},
    {code : "M_1_H_E_MT", years : setYears(2020,2018)},
    {code : "M_1_H_E_MT_O", years : setYears(2017,2013)},
    {code : "M_1_H_E_SC", years : setYears(2020,2018)},
    {code : "M_1_H_E_SC_O", years : setYears(2017,2013)},
    {code : "M_1_H_E_LS", years : setYears(2020,2018)},
    {code : "M_1_H_E_HI", years : setYears(2023,2020)},
    {code : "M_1_H_E_HI_O", years : setYears(2020,2014)},
    {code : "M_1_H_E_ET", years : setYears(2023,2019)},
    {code : "M_1_H_E_TH", years : setYears(2023,2019)},
	{code : "M_1_H_E_", years : setYears(2023,2013)}, // 중1 최다오답 과목 없는 경우

    // 중 1 영어문법문제
    {code : "M_1_H_T_EG", years : setYears(2020,2018)},

    // 중 2 단원별
    {code : "M_2_C__KR", years : setYears(2023,2019)},
    {code : "M_2_C__EG", years : setYears(2023,2019)},
    {code : "M_2_C__MT", years : setYears(2023,2019)},
	{code : "M_2_C__MT_O", years : setYears(2018,2014)},
    {code : "M_2_C__SC", years : setYears(2023,2019)},
	{code : "M_2_C__SC_O", years : setYears(2018,2014)},
    {code : "M_2_C__LS", years : setYears(2023,2019)},
    {code : "M_2_C__HI", years : setYears(2023,2020)},
	{code : "M_2_C__HI_O", years : setYears(2021,2014)},
    {code : "M_2_C__ET", years : setYears(2023,2019)},
    {code : "M_2_C__TH", years : setYears(2023,2019)},
    {code : "M_2_C__CH", years : setYears(2023,2019)},
	{code : "M_2_C__", years : setYears(2023,2018)}, // 중2 단원별 과목 없는 경우

    // 중 2 서술형
    {code : "M_2_M__KR", years : setYears(2023,2019)},
    {code : "M_2_M__EG", years : setYears(2023,2019)},
    {code : "M_2_M__MT", years : setYears(2023,2019)},
    {code : "M_2_M__MT_O", years : setYears(2018,2014)},
    {code : "M_2_M__SC", years : setYears(2023,2019)},
    {code : "M_2_M__SC_O", years : setYears(2018,2014)},
    {code : "M_2_M__LS", years : setYears(2023,2019)},
    {code : "M_2_M__HI", years : setYears(2023,2020)},
	{code : "M_2_M__HI_O", years : setYears(2021,2014)},
	{code : "M_2_M__ET", years : setYears(2023,2021)},
	{code : "M_2_M__TH", years : setYears(2023,2021)},
	{code : "M_2_M__", years : setYears(2023,2014)}, // 중2 서술형 과목 없는 경우

    // 중 2 최다빈출
    {code : "M_2_H_D_KR", years : setYears(2023,2020)},
	{code : "M_2_H_D_EG", years : setYears(2023,2020)},
    {code : "M_2_H_D_MT", years : setYears(2023,2019)},
    {code : "M_2_H_D_MT_O", years : setYears(2018,2014)},
    {code : "M_2_H_D_SC", years : setYears(2023,2019)},
    {code : "M_2_H_D_SC_O", years : setYears(2018,2014)},
    {code : "M_2_H_D_LS", years : setYears(2023,2019)},
    {code : "M_2_H_D_HI", years : setYears(2023,2020)},
	{code : "M_2_H_D_HI_O", years : setYears(2021,2014)},
    {code : "M_2_H_D_ET", years : setYears(2023,2019)},
    {code : "M_2_H_D_TH", years : setYears(2023,2019)},
	{code : "M_2_H_D_", years : setYears(2023,2014)}, // 중2 최다빈출 과목 없는 경우

    // 중 2 최다오답
    {code : "M_2_H_E_KR", years : setYears(2023,2020)},
	{code : "M_2_H_E_EG", years : setYears(2023,2020)},
    {code : "M_2_H_E_MT", years : setYears(2023,2019)},
    {code : "M_2_H_E_MT_O", years : setYears(2018,2014)},
    {code : "M_2_H_E_SC", years : setYears(2023,2019)},
    {code : "M_2_H_E_SC_O", years : setYears(2018,2014)},
    {code : "M_2_H_E_LS", years : setYears(2023,2019)},
    {code : "M_2_H_E_HI", years : setYears(2023,2020)},
	{code : "M_2_H_E_HI_O", years : setYears(2021,2014)},
    {code : "M_2_H_E_ET", years : setYears(2023,2019)},
    {code : "M_2_H_E_TH", years : setYears(2023,2019)},
	{code : "M_2_H_E_", years : setYears(2023,2014)}, // 중2 최다오답 과목 없는 경우

    // 중 2 영어문법문제
    {code : "M_2_H_T_EG", years : setYears(2023,2019)},

    // 중 3 단원별
    {code : "M_3_C__KR", years : setYears(2023,2020)},
    {code : "M_3_C__EG", years : setYears(2023,2020)},
    {code : "M_3_C__MT", years : setYears(2023,2020)},
	{code : "M_3_C__MT_O", years : setYears(2019,2015)},
    {code : "M_3_C__SC", years : setYears(2023,2020)},
	{code : "M_3_C__SC_O", years : setYears(2019,2015)},
    {code : "M_3_C__LS", years : setYears(2023,2019)},
    {code : "M_3_C__HI", years : setYears(2023,2020)},
	{code : "M_3_C__HI_O", years : setYears(2021,2014)},
    {code : "M_3_C__ET", years : setYears(2023,2019)},
    {code : "M_3_C__TH", years : setYears(2023,2019)},
    {code : "M_3_C__CH", years : setYears(2023,2019)},
	{code : "M_3_C__", years : setYears(2023,2014)}, // 중3 단원별 과목 없는 경우

    // 중 3 서술형
    {code : "M_3_M__KR", years : setYears(2023,2020)},
    {code : "M_3_M__EG", years : setYears(2023,2020)},
    {code : "M_3_M__MT", years : setYears(2023,2020)},
    {code : "M_3_M__MT_O", years : setYears(2019,2015)},
    {code : "M_3_M__SC", years : setYears(2023,2020)},
    {code : "M_3_M__SC_O", years : setYears(2019,2015)},
    {code : "M_3_M__LS", years : setYears(2023,2019)},
    {code : "M_3_M__HI", years : setYears(2023,2020)},
	{code : "M_3_M__HI_O", years : setYears(2021,2014)},
	{code : "M_3_M__ET", years : setYears(2023,2021)},
	{code : "M_3_M__TH", years : setYears(2023,2021)},
	{code : "M_3_M__", years : setYears(2023,2014)}, // 중3 서술형 과목 없는 경우

    // 중 3 최다빈출
    {code : "M_3_H_D_KR", years : setYears(2023,2020)},
	{code : "M_3_H_D_EG", years : setYears(2023,2020)},
    {code : "M_3_H_D_MT", years : setYears(2023,2020)},
    {code : "M_3_H_D_MT_O", years : setYears(2019,2015)},
    {code : "M_3_H_D_SC", years : setYears(2023,2020)},
    {code : "M_3_H_D_SC_O", years : setYears(2019,2015)},
    {code : "M_3_H_D_LS", years : setYears(2023,2019)},
    {code : "M_3_H_D_HI", years : setYears(2023,2020)},
	{code : "M_3_H_D_HI_O", years : setYears(2021,2014)},
    {code : "M_3_H_D_ET", years : setYears(2023,2019)},
    {code : "M_3_H_D_TH", years : setYears(2023,2019)},
	{code : "M_3_H_D_", years : setYears(2023,2014)}, // 중3 최다빈출 과목 없는 경우

    // 중 3 최다오답
    {code : "M_3_H_E_KR", years : setYears(2023,2020)},
	{code : "M_3_H_E_EG", years : setYears(2023,2020)},
    {code : "M_3_H_E_MT", years : setYears(2023,2020)},
    {code : "M_3_H_E_MT_O", years : setYears(2019,2015)},
    {code : "M_3_H_E_SC", years : setYears(2023,2020)},
    {code : "M_3_H_E_SC_O", years : setYears(2019,2015)},
    {code : "M_3_H_E_LS", years : setYears(2023,2019)},
    {code : "M_3_H_E_HI", years : setYears(2023,2020)},
	{code : "M_3_H_E_HI_O", years : setYears(2021,2014)},
    {code : "M_3_H_E_ET", years : setYears(2023,2019)},
    {code : "M_3_H_E_TH", years : setYears(2023,2019)},
	{code : "M_3_H_E_", years : setYears(2023,2014)}, // 중3 최다오답 과목 없는 경우

    // 중 3 영어문법문제
    {code : "M_3_H_T_EG", years : setYears(2023,2020)},

    // 중등 수학유형별
	{code : "M_1_K_M_MT", years : setYears(2021,2018)},
	{code : "M_1_K_M_MT_O", years : setYears(2017,2013)},
	{code : "M_2_K_M_MT", years : setYears(2022,2019)},
	{code : "M_2_K_M_MT_O", years : setYears(2018,2014)},
	{code : "M_3_K_M_MT", years : setYears(2022,2020)},
	{code : "M_3_K_M_MT_O", years : setYears(2019,2015)},
	{code : "M__K_M_MT", years : setYears(2022,2015)}, // 중등 학년이 없는 경우

    // 중등 국어작품별
    {code : "M_0_K_P1_KR", years : setYears(2020,2011)},
    {code : "M_0_K_P2_KR", years : setYears(2020,2011)},
    {code : "M_0_K_P3_KR", years : setYears(2020,2011)},
    {code : "M_0_K_P4_KR", years : setYears(2020,2011)},
    {code : "M_0_K_P5_KR", years : setYears(2020,2011)},

    // 고 1 단원별
    {code : "H_1_C__KR", years : setYears(2023,2018)},
	{code : "H_1_C__KR1", years : setYears(2018,2015)},
	{code : "H_1_C__KR3", years : setYears(2018,2015)},
    {code : "H_1_C__EG", years : setYears(2023,2018)},
    {code : "H_1_C__MT", years : setYears(2023,2018)},
	{code : "H_1_C__MT_O", years : setYears(2017,2014)},
    {code : "H_1_C__SC", years : setYears(2023,2018)},
    {code : "H_1_C__LS", years : setYears(2023,2018)},
    {code : "H_1_C__HI", years : setYears(2023,2020)},
    {code : "H_1_C__HI_O", years : setYears(2019,2014)},
	{code : "H_1_C__TH", years : setYears(2023,2021)},
	{code : "H_1_C__", years : setYears(2023,2015)}, // 고1 단원별 과목 없는 경우

    // 고 1 서술형
    {code : "H_1_M__KR", years : setYears(2023,2018)},
    {code : "H_1_M__EG", years : setYears(2023,2018)},
    {code : "H_1_M__MT", years : setYears(2023,2018)},
    {code : "H_1_M__MT_O", years : setYears(2017,2014)},
    {code : "H_1_M__SC", years : setYears(2023,2018)},
    {code : "H_1_M__LS", years : setYears(2023,2018)},
    {code : "H_1_M__HI", years : setYears(2023,2020)},
    {code : "H_1_M__HI_O", years : setYears(2019,2014)},
	{code : "H_1_M__TH", years : setYears(2023,2021)},
	{code : "H_1_M__", years : setYears(2023,2014)}, // 고1 서술형 과목 없는 경우

    // 고 1 최다빈출
    {code : "H_1_H_D_KR", years : setYears(2023,2019)},
	{code : "H_1_H_D_KR1", years : setYears(2018,2017)},
    {code : "H_1_H_D_EG", years : setYears(2023,2019)},
    {code : "H_1_H_D_MT", years : setYears(2023,2018)},
    {code : "H_1_H_D_MT_O", years : setYears(2017,2014)},
    {code : "H_1_H_D_SC", years : setYears(2023,2018)},
    {code : "H_1_H_D_LS", years : setYears(2023,2018)},
    {code : "H_1_H_D_HI", years : setYears(2023,2020)},
    {code : "H_1_H_D_HI_O", years : setYears(2019,2014)},
	{code : "H_1_H_D_TH", years : setYears(2023,2021)},
	{code : "H_1_H_D_", years : setYears(2023,2014)}, // 고1 최다빈출 과목 없는 경우

    // 고 1 최다오답
    {code : "H_1_H_E_KR", years : setYears(2023,2019)},
	{code : "H_1_H_E_KR1", years : setYears(2018,2017)},
    {code : "H_1_H_E_EG", years : setYears(2023,2018)},
    {code : "H_1_H_E_MT", years : setYears(2023,2018)},
    {code : "H_1_H_E_MT_O", years : setYears(2017,2014)},
    {code : "H_1_H_E_SC", years : setYears(2023,2018)},
    {code : "H_1_H_E_LS", years : setYears(2023,2018)},
    {code : "H_1_H_E_HI", years : setYears(2023,2020)},
    {code : "H_1_H_E_HI_O", years : setYears(2019,2014)},
	{code : "H_1_H_E_TH", years : setYears(2023,2021)},
	{code : "H_1_H_E_", years : setYears(2023,2014)}, // 고1 최다오답 과목 없는 경우

    // 고 1 영어문법문제
    {code : "H_1_H_T_EG", years : setYears(2023,2018)},
	{code : "H_1_H_T_", years : setYears(2023,2018)}, // 고등 학년이 없는 경우

    // 고 2 단원별
    {code : "H_2_C__KR", years : setYears(2023,2019)},
	{code : "H_2_C__KR1", years : setYears(2023,2019)},
	{code : "H_2_C__KR2", years : setYears(2023,2019)},
	{code : "H_2_C__KR3", years : setYears(2018,2015)},
    {code : "H_2_C__EG", years : setYears(2023,2019)},
	{code : "H_2_C__EG1", years : setYears(2023,2019)},
	{code : "H_2_C__EG2", years : setYears(2023,2019)},
	{code : "H_2_C__EG3", years : setYears(2023,2020)},
    {code : "H_2_C__MT", years : setYears(2023,2019)},
	{code : "H_2_C__MT_O", years : setYears(2018,2015)},
    {code : "H_2_C__MT2", years : setYears(2023,2019)},		// 수학II만 예외적으로 년도를 바꿔달라는 요청사항이 있었음. 과목값에 2를 추가하여 호출
    {code : "H_2_C__SC", years : setYears(2023,2019)},
    {code : "H_2_C__LS", years : setYears(2023,2019)},
    {code : "H_2_C__HI", years : setYears(2023,2020)},
    {code : "H_2_C__SC_O", years : setYears(2018,2015)},
    {code : "H_2_C__LS_O", years : setYears(2018,2015)},
    {code : "H_2_C__HI_O", years : setYears(2019,2014)},
	{code : "H_2_C__TH", years : setYears(2023,2021)},
	{code : "H_2_C__", years : setYears(2023,2014)}, // 고2 단원별 과목 없는 경우

    // 고 2 서술형
    {code : "H_2_M__KR", years : setYears(2023,2019)},
	{code : "H_2_M__KR1", years : setYears(2023,2019)},
	{code : "H_2_M__KR2", years : setYears(2023,2019)},
    {code : "H_2_M__EG", years : setYears(2023,2019)},
	{code : "H_2_M__EG1", years : setYears(2023,2019)},
	{code : "H_2_M__EG2", years : setYears(2023,2019)},
	{code : "H_2_M__EG3", years : setYears(2022,2020)},
    {code : "H_2_M__MT", years : setYears(2023,2019)},
    {code : "H_2_M__MT_O", years : setYears(2018,2015)},
    {code : "H_2_M__MT2", years : setYears(2023,2019)},		// 수학II만 예외적으로 년도를 바꿔달라는 요청사항이 있었음. 과목값에 2를 추가하여 호출
    {code : "H_2_M__SC", years : setYears(2023,2019)},
    {code : "H_2_M__LS", years : setYears(2023,2019)},
    {code : "H_2_M__HI", years : setYears(2023,2020)},
    {code : "H_2_M__SC_O", years : setYears(2018,2015)},
    {code : "H_2_M__LS_O", years : setYears(2018,2015)},
    {code : "H_2_M__HI_O", years : setYears(2019,2014)},
	{code : "H_2_M__TH", years : setYears(2023,2021)},
	{code : "H_2_M__", years : setYears(2023,2014)}, // 고2 서술형 과목 없는 경우

    // 고 2 최다빈출
    {code : "H_2_H_D_KR", years : setYears(2023,2020)},
	{code : "H_2_H_D_KR1", years : setYears(2023,2020)},
	{code : "H_2_H_D_KR2", years : setYears(2023,2020)},
	{code : "H_2_H_D_KR3", years : setYears(2018,2017)},
	{code : "H_2_H_D_EG", years : setYears(2023,2020)},
	{code : "H_2_H_D_EG1", years : setYears(2023,2020)},
	{code : "H_2_H_D_EG2", years : setYears(2023,2020)},
	{code : "H_2_H_D_EG3", years : setYears(2022,2020)},
    {code : "H_2_H_D_MT", years : setYears(2023,2019)},
    {code : "H_2_H_D_MT_O", years : setYears(2018,2015)},
    {code : "H_2_H_D_MT2", years : setYears(2023,2019)},		// 수학II만 예외적으로 년도를 바꿔달라는 요청사항이 있었음. 과목값에 2를 추가하여 호출
    {code : "H_2_H_D_SC", years : setYears(2023,2019)},
    {code : "H_2_H_D_LS", years : setYears(2023,2019)},
    {code : "H_2_H_D_HI", years : setYears(2023,2020)},
    {code : "H_2_H_D_SC_O", years : setYears(2018,2015)},
    {code : "H_2_H_D_LS_O", years : setYears(2018,2015)},
    {code : "H_2_H_D_HI_O", years : setYears(2019,2014)},
	{code : "H_2_H_D_TH", years : setYears(2023,2021)},
	{code : "H_2_H_D_", years : setYears(2023,2014)}, // 고2 최다빈출 과목 없는 경우

    // 고 2 최다오답
    {code : "H_2_H_E_KR", years : setYears(2023,2020)},
	{code : "H_2_H_E_KR1", years : setYears(2023,2020)},
	{code : "H_2_H_E_KR2", years : setYears(2023,2020)},
	{code : "H_2_H_E_KR3", years : setYears(2018,2017)},
	{code : "H_2_H_E_EG", years : setYears(2023,2020)},
	{code : "H_2_H_E_EG1", years : setYears(2023,2020)},
	{code : "H_2_H_E_EG2", years : setYears(2023,2020)},
	{code : "H_2_H_E_EG3", years : setYears(2022,2020)},
    {code : "H_2_H_E_MT", years : setYears(2023,2019)},
    {code : "H_2_H_E_MT_O", years : setYears(2018,2015)},
    {code : "H_2_H_E_MT2", years : setYears(2023,2019)},		// 수학II만 예외적으로 년도를 바꿔달라는 요청사항이 있었음. 과목값에 2를 추가하여 호출
    {code : "H_2_H_E_SC", years : setYears(2023,2019)},
    {code : "H_2_H_E_LS", years : setYears(2023,2019)},
    {code : "H_2_H_E_HI", years : setYears(2023,2020)},
    {code : "H_2_H_E_SC_O", years : setYears(2018,2015)},
    {code : "H_2_H_E_LS_O", years : setYears(2018,2015)},
    {code : "H_2_H_E_HI_O", years : setYears(2019,2014)},
	{code : "H_2_H_E_TH", years : setYears(2023,2021)},
	{code : "H_2_H_E_", years : setYears(2023,2014)}, // 고2 최다오답 과목 없는 경우

    // 고등 수학유형별
    {code : "H_1_H_C_MT", years : setYears(2022,2018)},
    {code : "H_2_H_C_MT", years : setYears(2022,2019)},
    {code : "H_1_H_C_MT_O", years : setYears(2017,2014)},
    {code : "H_2_H_C_MT_O", years : setYears(2018,2015)},
	{code : "H__H_C_MT", years : setYears(2022,2014)}, // 고등 학년이 없는 경우

    // 고 2 영어문법문제
    {code : "H_2_H_T_EG", years : setYears(2023,2019)},
	{code : "H_2_H_T_EG1", years : setYears(2023,2019)},
	{code : "H_2_H_T_EG2", years : setYears(2023,2019)},
	{code : "H_2_H_T_EG3", years : setYears(2022,2020)},
	{code : "H_2_H_T_", years : setYears(2023,2019)} // 고등 학년이 없는 경우
];



var getYears = function(SiteID, Grade, Group, CoreType, SubjCode) {
    var CodeArray = [
        SiteID.toUpperCase(),
        Grade,
        Group.toUpperCase(),
        CoreType.toUpperCase(),
        SubjCode.toUpperCase()
    ];
    var YearCode = CodeArray.join('_');
    _hLog("YearCode= " + YearCode);
    var years = [];
    for(var i=0; i < initYears.length; i++) {
        if(initYears[i].code == YearCode) {
            try{
                if(initYears[i].years.length > 0) {
                    for(var j=0; j < initYears[i].years.length; j++){
                        years.push(
                            {
                                Name:initYears[i].years[j].value + '년',
                                text:initYears[i].years[j].value + '년',
                                Value:initYears[i].years[j].value
                            }
                        );
                    }
                }
            }
            catch(e) {
                years.push(
                    {
                        Name:'',
                        text:'',
                        Value:''
                    }
                );
            }
        }
    }

    if(years.length == 0) {
        var dt = new Date();
        var yyyy = dt.getFullYear();
        for(var j=yyyy; j >= 2004; j--) {
            years.push({Name:j+'년', text:j+'년', Value:j});
        }
    }

    return years;
};