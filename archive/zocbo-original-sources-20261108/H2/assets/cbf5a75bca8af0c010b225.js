const commonCLS = {
    URL : {
        "문제리스트"            : "/exam/examList.asp",
        "메뉴설명"              : "/exam/menuDescription.asp",
        "메뉴별필터정보"        : "/exam/ajax/getMenuByFilterAjax.asp",
        "메뉴별시험정보조회"    : "/exam/ajax/getMenuByExamSearchAjax.asp",
        "메뉴별파트정보조회"    : "/exam/ajax/getMenuByExamPartAjax.asp",
        "대단원조회"            : "/exam/ajax/getRootPartByTxCodeAjax.asp",
        "시험지권한체크"        : "/exam/ajax/getExpaprAuthorityAjax.asp",
        "상품페이지"            : "/payment/",
        "랜딩"                  : "/app/landing/solutionTip.asp",
        "공유하기인입페이지"     : "/event/landing_membership/?share_platform=kakao&share_user_id=",
        "공유하기로그적재"       : "/Include/ajax/set_Share_i_ajax.asp",
        "단원조회"              : "/exam/ajax/getFinalPartByTxCodeAjax.asp",
        "시험지생성"            : "/ZocboExam/autoExam_Layer.asp",
        "시험지생성토근조회"     : "/Common/System/Token_hs.asp",
        "작품필터정보조회"       : "/exam/ajax/getWorkFilterAjax.asp",
		"다운로드권한체크"        : "/exam/ajax/getDownAuthorityAjax.asp",
		"동영상차감및로그"        : "/exam/ajax/setVodPlayCompleteAjax.asp",
        "연계정보조회"          : "/exam/ajax/getAssociateAjax.asp",
		"뷰어내동영상권한팝업"     : "/exam/examVodDownPop.asp",
        "국어작가작품조회"       : "/exam/ajax/getKoreanLiteratureAjax.asp",
        "정답차감및로그"         : "/exam/ajax/setAnswerCompleteAjax.asp",
		"마케팅수신동의조회" : "/event/include/ajax/event_marketing_chk_ajax.asp",
        "마케팅수신동의수정" : "/event/include/ajax/event_marketing_u_ajax.asp",
        "에비고1국어작가작품조회" : "/exam/ajax/getPrego1KoreanLiteratureAjax.asp",
        "정답보기무료권한체크" : "/exam/ajax/getAnswerFreeServiceAuthorityAjax.asp",
    },
    MEM_GROUP : {
        "학생" : "S",
        "학부모" : "P",
        "교강사" : "T",
        "준회원" : "A",
    },
    TOGGLE_GROUP : {
        "교강사" : "T",
        "학생" : "C",
    },
    TERM : {
        "1학기중간" : "1M",
        "1학기기말" : "1E",
        "2학기중간" : "2M",
        "2학기기말" : "2E",
    },
    PART_USE_CD : {
        "미사용" : {
            CD : 0,
            ID : "",
        },
        "루트파트까지사용" : {
            CD : 1,
            ID : "ROOT_PART_CD",
        },
        "서브파트까지사용" : {
            CD : 2,
            ID : "SUB_PART_CD",
        },
        "디테일파트까지사용" : {
            CD : 3,
            ID : "DETAIL_PART_CD",
        },
    },
    FILTER : {
        "분류"      : {
            CD : "SEARCH_SUB_MENU_CD",
            NM : "분류",
            FILTER_CD : "FILTER_12",
            FILTER_KEY : "SUB_MENU_CD",
        },
        "학년"      : {
            CD : "SEARCH_GRADE",
            NM : "학년",
            FILTER_CD : "FILTER_1",
            FILTER_KEY : "GRADE_NM",
        },
        "상세과목"      : {
            CD : "SEARCH_SUBJECT_DETAIL_CD",
            NM : "상세과목",
            FILTER_CD : "FILTER_3",
            FILTER_KEY : "SUBJECT_DETAIL_NM",
        },
        "교과서"      : {
            CD : "SEARCH_TX_CD",
            NM : "교과서",
            FILTER_CD : "FILTER_2",
            FILTER_KEY : "TX_NM",
        },
        "단원"      : {
            CD : "SEARCH_ROOTPART_CD",
            NM : "단원 선택",
            FILTER_CD : "FILTER_4",
            FILTER_KEY : "ROOTPART_NAME",
        },
        "출판사"      : {
            CD : "SEARCH_TEXT_BOOK_CD",
            NM : "출판사",
            FILTER_CD : "FILTER_10",
            FILTER_KEY : "TEXT_BOOK_NM",
        },
        "과목"      : {
            CD : "SEARCH_SUBJECT_CD",
            NM : "과목",
            FILTER_CD : "FILTER_11",
            FILTER_KEY : "SUBJECT_NM",
        },
        "난이도"      : {
            CD : "SEARCH_LEVEL_CD",
            NM : "난이도",
            FILTER_CD : "FILTER_13",
            FILTER_KEY : "",
        },
        "년도"      : {
            CD : "SEARCH_YEAR_CD",
            NM : "년도",
            FILTER_CD : "FILTER_14",
            FILTER_KEY : "YEAR_NM",
        },
        "단계"      : {
            CD : "SEARCH_STAGE_CD",
            NM : "단계",
            FILTER_CD : "FILTER_15",
            FILTER_KEY : "",
        },
        "갈래"      : {
            CD : "SEARCH_BRANCH_CD",
            NM : "갈래",
            FILTER_CD : "FILTER_16",
            FILTER_KEY : "BRANCH_NM",
        },
        "작품"      : {
            CD : "SEARCH_WORK_CD",
            NM : "작품/작가",
            FILTER_CD : "FILTER_17",
            FILTER_KEY : "WORK_NM",
        },
        "시대"      : {
            CD : "SEARCH_ERA_CD",
            NM : "시대",
            FILTER_CD : "FILTER_18",
            FILTER_KEY : "ERA_NM",
        },
        "학습단계"      : {
            CD : "SEARCH_STEP_CD",
            NM : "학습 단계",
            FILTER_CD : "FILTER_20",
            FILTER_KEY : "STEP_NM",
        },
        "시험지그룹코드"      : {
            CD : "SEARCH_EXPAPR_GROUP_CD",
            NM : "시험지그룹코드"
        },
        "시험지코어타입코드"      : {
            CD : "SEARCH_EXPAPR_CORETYPE_CD",
            NM : "시험지코어타입코드"
        },
    },
    EXPAPER_TYPE_CD : {
        "일반" : 1,
        "생성" : 2,
    },
    EXPAPER_FILE_GROUP_CD : {
        "PDF" : {
            CD : 2,
            NM : "PDF",
        },
        "HWP" : {
            CD : 4,
            NM : "HWP",
        },
    },
	DATA_FORMAT_CD : {
		"PDF" : {
			CD : 2,
			NM : "PDF"
		},
		"HWP" : {
			CD : 4,
			NM : "HWP"
		},
		"개념영상" : {
			CD : 90,
			NM : "개념영상",
			CLS : "is-video-1"
		},
		"풀이영상" : {
			CD : 89,
			NM : "풀이영상",
			CLS : "is-video-2"
		},
	},
	DOWN_FLAG_CD : {
		"시험지단독" : 1,
		"시험지동영상혼합" : 2,
		"동영상단독" : 3,
		"뷰어내동영상단독" : 4,
	},
    EXPAPER_DOWNLOAD_FILE_ACT_TYPE : {
        "권한없음" : "NOAUTH",
        "다운로드" : "DOWN",
        "재다운로드" : "REDOWN",
        "생성형다운로드" : "DOWN_AUTOEXAM",
    },
    EXPAPER_EXEC_TYPE : {
        "다운로드" : "DOWN",
        "바로보기" : "VIEW",
        "생성바로보기" : "VIEW_AUTOEXAM",
    },
    EXPAPER_AUTHORITY_ERROR : {
        "미로그인" : {
            CD : -99,
            MSG : "",
        },
        "필수값누락" : {
            CD : -1,
            MSG : "필수정보가 누락되었습니다.",
        },
        "시험지정보없음" : {
            CD : -2,
            MSG : "시험지정보가 제공되지 않습니다.",
        },
        "시험지상세정보없음" : {
            CD : -3,
            MSG : "시험지정보가 제공되지 않습니다.",
        },
		"동영상정보없음" : {
            CD : -4,
            MSG : "동영상정보가 제공되지 않습니다.",
        },
        "정답정보없음" : {
            CD : -5,
            MSG : "정답정보가 제공되지 않습니다.",
        },
    },
    EXPAPER_AUTHORITY : {
        "재다운로드"            : "REDOWN",
        "이벤트"                : "EVENT",
        "쿠폰포인트"            : "COUPON_POINT",
        "쿠폰포인트와일반포인트" : "COUPON_POINT_ADD_POINT",
        "쿠폰이용권"            : "COUPON_TICKET",
        "이용권"                : "TICKET",
        "포인트"                : "POINT",
        "추천상품"              : "PRODUCT_RECOMMEND",
        "대표시험지선다운X"      : "REPRESENTATIVE_NOT_DOWN",
		"학년변경"              : "YEAR_CHANGE",
    },
    getExpaprNo : function () {
        return isValueEmpty(storage.getSession(storage.EXPAPR_NO)) ? "" : storage.getSession(storage.EXPAPR_NO);
    },
    getRepresentativeExpaprNo : function () {
        return isValueEmpty(storage.getSession(storage.REPRESENTATIVE_EXPAPR_NO)) ? 0 : storage.getSession(storage.REPRESENTATIVE_EXPAPR_NO);
    },
    getExpaprNm : function () {
        return isValueEmpty(storage.getSession(storage.EXPAPR_NAME)) ? "" : storage.getSession(storage.EXPAPR_NAME);
    },
    getExpaprGrade : function () {
        return isValueEmpty(storage.getSession(storage.EXPAPR_GRADE)) ? "" : storage.getSession(storage.EXPAPR_GRADE);
    },
    getExpaprFileGroup : function () {
        return isValueEmpty(storage.getSession(storage.EXPAPER_FILE_GROUP)) ? "" : storage.getSession(storage.EXPAPER_FILE_GROUP);
    },
    getExpaprFileGroupList : function () {
        return isValueEmpty(storage.getSession(storage.EXPAPER_FILE_GROUP_LIST)) ? "" : storage.getSession(storage.EXPAPER_FILE_GROUP_LIST);
    },
    getExpaprAuth : function () {
        return isValueEmpty(storage.getSession(storage.EXPAPER_AUTH)) ? "" : storage.getSession(storage.EXPAPER_AUTH);
    },
    getPaySvc : function () {
        return isValueEmpty(storage.getSession(storage.PAY_SVC)) ? "" : storage.getSession(storage.PAY_SVC);
    },
    getTicketName : function () {
        return isValueEmpty(storage.getSession(storage.TICKET_NAME)) ? "" : storage.getSession(storage.TICKET_NAME);
    },
    getProductCD : function () {
        return isValueEmpty(storage.getSession(storage.PRODUCT_CD)) ? "" : storage.getSession(storage.PRODUCT_CD);
    },
    getMode : function () {
        return isValueEmpty(storage.getSession(storage.SELECTED_MODE)) ? "" : storage.getSession(storage.SELECTED_MODE);
    },
    getExpaprSiteID : function () {
        return isValueEmpty(storage.getSession(storage.SITEID)) ? "" : storage.getSession(storage.SITEID);
    },
    getExpaprGroupCD : function () {
        return isValueEmpty(storage.getSession(storage.EXPAPR_GROUP_CD)) ? "" : storage.getSession(storage.EXPAPR_GROUP_CD);
    },
    getExpaprCoreTypeCD : function () {
        return isValueEmpty(storage.getSession(storage.EXPAPR_CORETYPE_CD)) ? "" : storage.getSession(storage.EXPAPR_CORETYPE_CD);
    },
    getPartCD : function () {
        return isValueEmpty(storage.getSession(storage.EXPAPR_PART_CD)) ? "" : storage.getSession(storage.EXPAPR_PART_CD);
    },
    getPartID : function () {
        return isValueEmpty(storage.getSession(storage.EXPAPR_PART_ID)) ? "" : storage.getSession(storage.EXPAPR_PART_ID);
    },
    getExpaprAutoDownSeq : function () {
        return isValueEmpty(storage.getSession(storage.EXPAPR_AUTO_DOWN_SEQ)) ? "" : storage.getSession(storage.EXPAPR_AUTO_DOWN_SEQ);
    },
    getExpaprTypeCD : function () {
        return isValueEmpty(storage.getSession(storage.EXPAPR_TYPE_CD)) ? "" : storage.getSession(storage.EXPAPR_TYPE_CD);
    },
    getExpaprExamIndex : function () {
        return isValueEmpty(storage.getSession(storage.EXPAPR_EXAM_INDEX)) ? "" : storage.getSession(storage.EXPAPR_EXAM_INDEX);
    },
	getVodNo : function () {
        return isValueEmpty(storage.getSession(storage.VOD_NO)) ? "" : storage.getSession(storage.VOD_NO);
    },
	getVodAuth : function () {
        return isValueEmpty(storage.getSession(storage.VOD_AUTH)) ? "" : storage.getSession(storage.VOD_AUTH);
    },
	getDownFlag : function () {
        return isValueEmpty(storage.getSession(storage.DOWN_FLAG)) ? "" : storage.getSession(storage.DOWN_FLAG);
    },
	getVodDataFormart : function () {
        return isValueEmpty(storage.getSession(storage.VOD_DATA_FORMAT)) ? "" : storage.getSession(storage.VOD_DATA_FORMAT);
    },
	getTopicId : function () {
        return isValueEmpty(storage.getSession(storage.TOPIC_ID)) ? "" : storage.getSession(storage.TOPIC_ID);
    },
    getVodType : function () {
        return isValueEmpty(storage.getSession(storage.VOD_TYPE)) ? "" : storage.getSession(storage.VOD_TYPE);
    },
    getVodTitle : function () {
        return isValueEmpty(storage.getSession(storage.VOD_TITLE)) ? "" : storage.getSession(storage.VOD_TITLE);
    },
	getVodPaySvc : function () {
        return isValueEmpty(storage.getSession(storage.VOD_PAY_SVC)) ? "" : storage.getSession(storage.VOD_PAY_SVC);
    },
	getVodExpaprGrade : function () {
        return isValueEmpty(storage.getSession(storage.VOD_EXPAPR_GRADE)) ? "" : storage.getSession(storage.VOD_EXPAPR_GRADE);
    },
	getVodExpaprSiteID : function () {
        return isValueEmpty(storage.getSession(storage.VOD_SITEID)) ? "" : storage.getSession(storage.VOD_SITEID);
    },
	getVodExpaprGroupCD : function () {
        return isValueEmpty(storage.getSession(storage.VOD_EXPAPR_GROUP_CD)) ? "" : storage.getSession(storage.VOD_EXPAPR_GROUP_CD);
    },
    getVodExpaprCoreTypeCD : function () {
        return isValueEmpty(storage.getSession(storage.VOD_EXPAPR_CORETYPE_CD)) ? "" : storage.getSession(storage.VOD_EXPAPR_CORETYPE_CD);
    },
    getAnswerAuth : function () {
        return isValueEmpty(storage.getSession(storage.ANSWER_AUTH)) ? "" : storage.getSession(storage.ANSWER_AUTH);
    },
	getHijackingPromotionTargetCD : function () {
        return isValueEmpty(storage.getSession(storage.HIJACKING_PROMOTION_TARGET_CD)) ? "" : storage.getSession(storage.HIJACKING_PROMOTION_TARGET_CD);
    },
	getHijackingPromotionTargetDay : function () {
        return isValueEmpty(storage.getSession(storage.HIJACKING_PROMOTION_TARGET_DAY)) ? "" : storage.getSession(storage.HIJACKING_PROMOTION_TARGET_DAY);
    },
	getHijackingPromotionTargetDisrate : function () {
        return isValueEmpty(storage.getSession(storage.HIJACKING_PROMOTION_TARGET_DISRATE)) ? "" : storage.getSession(storage.HIJACKING_PROMOTION_TARGET_DISRATE);
    },
	getShareDiscountCouponYN : function () {
        return isValueEmpty(storage.getSession(storage.SHARE_DISCOUNT_COUPON_YN)) ? "" : storage.getSession(storage.SHARE_DISCOUNT_COUPON_YN);
    },
	getShareDiscountCouponExistYN : function () {
        return isValueEmpty(storage.getSession(storage.SHARE_DISCOUNT_COUPON_EXISTS_YN)) ? "" : storage.getSession(storage.SHARE_DISCOUNT_COUPON_EXISTS_YN);
    },
    getExpaprTestYear : function () {
        return isValueEmpty(storage.getSession(storage.EXPAPR_TESTYEAR)) ? "" : storage.getSession(storage.EXPAPR_TESTYEAR);
    },
    getIsBeforeExam : function () {
        return isValueEmpty(storage.getSession(storage.IS_BEFORE_EXAM)) ? "" : storage.getSession(storage.IS_BEFORE_EXAM);
    },
};