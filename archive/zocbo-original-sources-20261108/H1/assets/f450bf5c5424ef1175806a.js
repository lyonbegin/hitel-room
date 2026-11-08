const TRK_ACTION_CD = {
	"노출" : 1,
	"클릭" : 2,
	"회원가입" : 3,
	"결제" : 4,
    "클릭결제" : 5,
};

const TRK_ACTION_TARGET_TYPE_CD = {
	"이벤트페이지" : 1,
	"비주얼배너" : 2,
	"띠배너" : 3,
	"퀵배너" : 4,
    "레이어팝업" : 5,
    "이벤트를통한전환" : 6,
};

const TRK_EVENT_LOG_TYPE_VALUE = "EVENT";
const TRK_TODAY_DT = new Date;
const TRK_PAGE_URL = location.pathname.toLowerCase();

const trkCLS = {
    USE_CD : 1, // (1 : 신규 방식 , 0 : 기존방식)
    ARRAY_TRACK : Array(),
    ARRAY_EXTERNAL_EVENT : Array(),
    get getTrkURL () {
		return 'https://trk.zocbo.com/Collect/IndexJson';
	},
    get EVNET_JSON_URL () { /** 사이트마다 url 변경 필요함 */
        return "https://"+ TRK_GLB_S3_HOST +"/file/EVENT/event.json";
    },
    getIsCookie : function () {
        return navigator.cookieEnabled ? 1 : 0;
    },
    getEncType : function () {
        return document.characterSet;
    },
    getScheme : function () {
        return location.protocol.replace(":", "");
    }, 
    getHost : function () {
        return location.hostname;
    },
    getPort : function () {
        return "" == location.port ? 0 <= location.protocol.indexOf("https") ? "443" : "80" : location.port;
    },
    getPageUrl : function () {
        return location.pathname;
    },
    getFullUrl : function () {
        return location.href;
    },
    getGetData : function () {
        return location.search.replace("?", "");
    },
    getReferrer : function (EVENT_LOG_TYPE, referrer) {
        let refer = referrer;
        if (isValueEmpty(referrer)) {
            refer = "EVENT" == EVENT_LOG_TYPE ? location.href : document.referrer;
        }
        return refer.indexOf("?") >=0 ? refer = refer.split("?")[0] : refer;
    },
    getReferrerParam : function (EVENT_LOG_TYPE, referrer) {
        let refer = referrer;
        if (isValueEmpty(referrer)) {
            refer = "EVENT" == EVENT_LOG_TYPE ? location.href : document.referrer;
        }
        return refer.indexOf("?") >=0 ? refer.split("?")[1] : "";
    },
    getOutRefer : function (paramName) {
        let out_refer = "";
        let getData = trkCLS.getGetData().split("&");
        for (let e = 0; e < getData.length; e++) {
            let c = getData[e].split("=");
            isValueEmpty(out_refer) && paramName == c[0].toLowerCase() && (out_refer = c[1]);
        }
        return out_refer;
    },
    getIsOutRefer : function (EVENT_LOG_TYPE) {
        return trkCLS.getReferrer(EVENT_LOG_TYPE, "").indexOf("zocbo.com") == -1 && isValueEmpty(trkCLS.getReferrer(EVENT_LOG_TYPE, "")) == false ? 1 : 0;
    },
    getOutReferType : function () {
        return isValueEmpty(trkCLS.getOutRefer("utm_source"))? "ORG" : "PAID";
    },
    getPayNo : function () {
        const url = new URL(location.href);
        return isValueEmpty(url.searchParams.get('Pay_No')) ? "" : url.searchParams.get('Pay_No');
    },
    getCookie: function(v) {
        for (var a = document.cookie.split(";"), b = 0; b < a.length; b++) {
            var e = a[b].replace(/\s/gi, "").split("=");
            if (v == e[0])
                return decodeURIComponent(e[1])
        }
        return null
    },
    getBrowser: function() {
        const user = navigator.userAgent.toLowerCase();
        
        // 1. 모바일 앱 내 내장 브라우저 (인앱) 먼저 체크 (한국 시장 필수)
        if (user.includes("kakaotalk")) return "KAKAOTALK";
        if (user.includes("whale")) return "WHALE";
        if (user.includes("naver")) return "NAVER_APP";
        
        // 2. 모바일 전용 브라우저 체크
        if (user.includes("samsungbrowser")) return "SAMSUNG_INTERNET";
        if (user.includes("crios")) return "CHROME(IOS)";
        if (user.includes("fxios")) return "FIREFOX(IOS)";
        
        // 3. 일반 브라우저 체크
        if (user.includes("edge") || user.includes("edg/")) return "EDGE";
        if (user.includes("opr") || user.includes("opera")) return "OPERA";
        if (user.includes("chrome")) return "CHROME";
        if (user.includes("trident") || user.includes("msie")) return "IE";
        if (user.includes("firefox")) return "FIREFOX";
        if (user.includes("safari")) return "SAFARI"; // 크롬/Whale 등도 safari 문구를 포함하므로 아래쪽에 위치
        
        return "OTHER BROWSER";
    },
    
    getOS: function() {
        const ua = navigator.userAgent;
        let os = "Unknown OS";
        
        // 1. 모바일 OS 우선 체크
        if (/iPad|iPhone|iPod/.test(ua)) {
            const m = ua.match(/OS (\d+)_?(\d+)?/);
            if (m) {
                os = "Apple iOS " +
                    m[1] + "." +
                    (m[2] || 0);
            } else {
                os = "Apple iOS";
            }
        } 
        // ★ 핵심: iPad 데스크톱 모드 우회 판별 (Mac으로 위장한 아이패드 잡기)
        else if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) {
            os = "Apple iOS (iPad)";
        } 
        else if (ua.includes("Android")) {
            const m = ua.match(/Android\s([\d\.]+)/);
            if (m) {
                os = "Android " + m[1];
            } else {
                os = "Android OS";
            }
        }
        // 2. 데스크톱 OS 체크
        else if (ua.includes("Windows NT 10.0") || ua.includes("Windows NT 6.4")) os = "Windows 10";
        else if (ua.includes("Windows NT 6.3") || ua.includes("Windows NT 8.1")) os = "Windows 8.1";
        else if (ua.includes("Windows NT 6.2") || ua.includes("Windows NT 8.0")) os = "Windows 8";
        else if (ua.includes("Windows NT 6.1") || ua.includes("Windows NT 7.0")) os = "Windows 7";
        else if (/Mac|PPC/.test(ua)) {
            const m = ua.match(/Mac OS X ([\d_]+)/);
            if (m) {
                os =
                "Mac OS X " +
                m[1].replace(/_/g, ".");
            } else {
                os = "Mac OS";
            }
        } 
        else if (ua.includes("Linux")) os = "Linux";
        
        // 3. Windows 비트 수 체크
        if (os.includes("Windows")) {
            if (ua.includes("WOW64") || ua.includes("Win64") || ua.includes("x64")) {
                os += ' 64bit';
            } else {
                os += ' 32bit';
            }
        }
        return os;
    },
    addExternalEvent : function (trackCD, params) {
        const innertCD = 
                { 
                    CODE_CD : trackCD,
                    PARAMS : params
                };
        trkCLS.ARRAY_EXTERNAL_EVENT.push(innertCD);
    },
    getEvent : function() {
        try {
            jQuery.ajax({
                url : this.EVNET_JSON_URL,
                dataType : 'json',
                cache : false,
                success : function (jsonData) {
                    trkCLS.ARRAY_TRACK = jsonData.EVENT_LIST;
                    trkCLS.setEvent(jsonData.EVENT_LIST);
                }
            });
        } catch (e) {
            console.log(e);
        }
    },
    setEvent : function(json) {
        jQuery.each(json, function (i, evnet) {
			var eventCD = evnet.EVENT_CD.replace('EVENT_CD_','');
			var eventStartDT = new Date(evnet.EVENT_START_DT);
			var eventEndDT = new Date(evnet.EVENT_END_DT);

			if (TRK_TODAY_DT.getTime() < eventStartDT.getTime() 
                    && eventEndDT.getTime() > TRK_TODAY_DT.getTime()) {
				return false;
			}
            
            //기본 트레킹 정보 이벤트
            jQuery(".TRACK_TRG").each(function (idx, element) {
				var trackCD = jQuery(element).attr('track_cd');
				var eventDetail = evnet.EVENT_DETAIL_LSIT.filter((val) => {return val.EVENT_ACTION_TARGET_CD == trackCD});
				if (eventDetail.length > 0) {
					var eventActionCD = Number(eventDetail[0].EVENT_ACTION_CD);
                    var eventActionTargetCD = eventDetail[0].EVENT_ACTION_TARGET_CD;
                    var eventActionTargetTypeCD = Number(eventDetail[0].EVENT_ACTION_TARGET_TYPE_CD);
					switch(eventActionCD) {
						case TRK_ACTION_CD.노출 :
							trkCLS.setViewEvent(eventCD, eventActionCD, eventActionTargetCD, eventActionTargetTypeCD);
							break;
						case TRK_ACTION_CD.클릭 :
							trkCLS.setClickEvent(element, eventCD, eventActionCD, eventActionTargetCD, eventActionTargetTypeCD);
							break;
						case TRK_ACTION_CD.회원가입:
                        case TRK_ACTION_CD.결제:
                            if (TRK_ACTION_TARGET_TYPE_CD.이벤트를통한전환 == eventActionTargetTypeCD) {
                                trkCLS.setConversion(eventActionTargetCD, eventActionCD);
                            }
							break;
                        case TRK_ACTION_CD.클릭결제:
                            if (TRK_ACTION_TARGET_TYPE_CD.이벤트를통한전환 == eventActionTargetTypeCD) {
                                trkCLS.setClickConversion(element, eventActionTargetCD, eventActionCD);
                            }
                            break;
					}
				}
			});

            //결제 전환 체크
            if (TRK_PAGE_URL.indexOf("completepayment.asp") > -1) {
                eventDetail = evnet.EVENT_DETAIL_LSIT.filter((val) => {return Number(val.EVENT_ACTION_CD) == TRK_ACTION_CD.결제});
                if (eventDetail.length > 0) {
                    var conversionEventActionTargetCD = eventDetail[0].EVENT_ACTION_TARGET_CD;
                    if (trkCLS.getCookie(conversionEventActionTargetCD) == "Y") {
                        eventActionCD = Number(eventDetail[0].EVENT_ACTION_CD);
                        eventActionTargetCD = eventDetail[0].EVENT_ACTION_TARGET_CD;
                        eventActionTargetTypeCD = Number(eventDetail[0].EVENT_ACTION_TARGET_TYPE_CD);
                        let conversion_cd = trkCLS.getPayNo();
                        trkCLS.setConversionComplete(eventCD, eventActionCD, eventActionTargetCD, eventActionTargetTypeCD, 0, conversion_cd);
                    }
                }
				
				eventDetail = evnet.EVENT_DETAIL_LSIT.filter((val) => {return Number(val.EVENT_ACTION_CD) == TRK_ACTION_CD.클릭결제 && val.EVENT_ACTION_TARGET_CD == trkCLS.getCookie("clickConversionEventCD")});
                if (eventDetail.length > 0) {
					var conversionEventActionTargetCD = eventDetail[0].EVENT_ACTION_TARGET_CD;
                    if (trkCLS.getCookie("clickConversionEventCD") == conversionEventActionTargetCD) {
                        eventActionCD = Number(eventDetail[0].EVENT_ACTION_CD);
                        eventActionTargetCD = eventDetail[0].EVENT_ACTION_TARGET_CD;
                        eventActionTargetTypeCD = Number(eventDetail[0].EVENT_ACTION_TARGET_TYPE_CD);
                        let conversion_cd = trkCLS.getPayNo();
                        trkCLS.setConversionComplete(eventCD, eventActionCD, eventActionTargetCD, eventActionTargetTypeCD, 0, conversion_cd);
                    }
                }
            }

            //동적 파라메터가 추가된 트레킹 정보
            jQuery.each(trkCLS.ARRAY_EXTERNAL_EVENT, function (i, addExternalEvent) {
                let trackCD = addExternalEvent.CODE_CD;
                let params = addExternalEvent.PARAMS;
				let eventDetail = evnet.EVENT_DETAIL_LSIT.filter((val) => {return val.EVENT_ACTION_TARGET_CD == trackCD});
                if (eventDetail.length > 0) {
                    let eventActionCD = Number(eventDetail[0].EVENT_ACTION_CD);
                    let eventActionTargetCD = eventDetail[0].EVENT_ACTION_TARGET_CD;
                    let eventActionTargetTypeCD = Number(eventDetail[0].EVENT_ACTION_TARGET_TYPE_CD);

                    if (isValueEmpty(params)) {
                        params = {
                            "param1" : "", 
                            "param2" : "",
                            "param3" : "",
                            "param4" : "",
                            "param5" : "",
                            "param6" : "",
                            "param7" : "",
                            "param8" : "",
                            "share_platform" : "",
                            "share_user_id" : "",
                            "expapr_no" : "",
                            "product_cd" : "",
                            "conversion_target_cd" : "",
                            "conversion_cd" : "",
                            "grade" : "",
                            "subject_cd" : "",
                            "site_id" : "",
                            "expapr_file_group_cd" : "",
                            "expapr_group" : "",
                            "expapr_coretype" : "",
                            "pay_svc" : "",
                            "authority_cd" : "",
                            "refer_url" : "",
                            "out_refer_src" : "",
                            "out_refer_medium" : "",
                            "menu_cd" : "",
                            "expapr_title" : "",
                            "ticket_yn" : "",
                            "qst_id" : "",
                            "total_qst_count" : "",
                            "now_page" : "",
                            "total_exam_count" : "",
                            "exam_qst_show_mode" : "",
                            "click_navi_mode" : "",
                            "con_grade" : ""
                        };
                    } else {
                        if (isValueEmpty(params.param1)) params.param1 = "";
                        if (isValueEmpty(params.param2)) params.param2 = "";
                        if (isValueEmpty(params.param3)) params.param3 = "";
                        if (isValueEmpty(params.param4)) params.param4 = "";
                        if (isValueEmpty(params.param5)) params.param5 = "";
                        if (isValueEmpty(params.param6)) params.param6 = "";
                        if (isValueEmpty(params.param7)) params.param7 = "";
                        if (isValueEmpty(params.param8)) params.param8 = "";
                        if (isValueEmpty(params.share_platform)) params.share_platform = "";
                        if (isValueEmpty(params.share_user_id)) params.share_user_id = "";
                        if (isValueEmpty(params.expapr_no)) params.expapr_no = "";
                        if (isValueEmpty(params.product_cd)) params.product_cd = "";
                        if (isValueEmpty(params.out_refer_src)) params.out_refer_src = "";
                        if (isValueEmpty(params.out_refer_medium)) params.out_refer_medium = "";
                        if (isValueEmpty(params.grade)) params.grade = "";
                        if (isValueEmpty(params.subject_cd)) params.subject_cd = "";
                        if (isValueEmpty(params.site_id)) params.site_id = "";
                        if (isValueEmpty(params.expapr_file_group_cd)) params.expapr_file_group_cd = "";
                        if (isValueEmpty(params.expapr_group)) params.expapr_group = "";
                        if (isValueEmpty(params.expapr_coretype)) params.expapr_coretype = "";
                        if (isValueEmpty(params.pay_svc)) params.pay_svc = "";
                        if (isValueEmpty(params.authority_cd)) params.authority_cd = "";
                        if (isValueEmpty(params.refer_url)) params.refer_url = trkCLS.getReferrer(TRK_EVENT_LOG_TYPE_VALUE, params.refer_url);
                        if (isValueEmpty(params.menu_cd)) params.menu_cd = "";
                        if (isValueEmpty(params.expapr_title)) params.expapr_title = "";
                        if (isValueEmpty(params.ticket_yn)) params.ticket_yn = "";
                        if (isValueEmpty(params.qst_id)) params.qst_id = "";
                        if (isValueEmpty(params.total_qst_count)) params.total_qst_count = "";
                        if (isValueEmpty(params.now_page)) params.now_page = "";
                        if (isValueEmpty(params.total_exam_count)) params.total_exam_count = "";
                        if (isValueEmpty(params.exam_qst_show_mode)) params.exam_qst_show_mode = "";
                        if (isValueEmpty(params.click_navi_mode)) params.click_navi_mode = "";
                        if (isValueEmpty(params.con_grade)) params.con_grade = "";
                    }
                    

                    const payload = {
                        "log_type" : TRK_EVENT_LOG_TYPE_VALUE,
                        //"uuid" : crypto.randomUUID(),
                        "uuid" : generateRandomString(40),
                        "timestamp" : Date.now(),
                        "cid" : trkCLS.getCookie("CID"),
                        "promotion_target_cd" : TRK_GLB_PROMOTION_TARGET_CD,
                        "promotion_grade" : TRK_GLB_MEMBER_PROMOTION_GRADE,
                        "promotion_is_private" : TRK_GLB_MEMBER_PROMOTION_IS_PRIVATE,
                        "promotion_subject" : TRK_GLB_MEMBER_SUBJECT,
                        "user_id" : TRK_GLB_USER_ID,
                        "mem_group" : TRK_GLB_MEM_GROUP,
                        "is_login_cd" : TRK_GLB_IS_LOGIN_CD,
                        "is_cookie_cd" : trkCLS.getIsCookie(),
                        "user_agent" : navigator.userAgent,
                        "enc_type" : trkCLS.getEncType(),
                        "server_ip" : TRK_GLB_SERVER_IP,
                        "ip" : TRK_GLB_USER_IP,
                        "scheme" : trkCLS.getScheme(),
                        "host" : trkCLS.getHost(),
                        "port" : trkCLS.getPort(),
                        "page_url" : trkCLS.getPageUrl(),
                        "get_data" : trkCLS.getGetData(),
                        "post_data" : "",
                        "full_url" : trkCLS.getFullUrl(),
                        "refer_url" : trkCLS.getReferrer(TRK_EVENT_LOG_TYPE_VALUE, params.refer_url),
                        "refer_param" : trkCLS.getReferrerParam(TRK_EVENT_LOG_TYPE_VALUE, params.refer_url),
                        "category1" : document.title,
                        "toggle_group_cd" : TRK_GLB_TOGGLE_GROUP_CD,
                        "expapr_no" : params.expapr_no,
                        "product_cd" : params.product_cd,
                        "service_type_cd" : TRK_GLB_SERVICE_TYPE_CD,
                        "session_id" : TRK_GLB_SESSION_ID,
                        "menu_cd" : TRK_GLB_MENU_CD,
                        "site_id" : TRK_GLB_SITE_ID,
                        "grade" : TRK_GLB_GRADE,
                        "subject_cd" : TRK_GLB_SUBJECT_CD,
                        "tx_cd" : TRK_GLB_TX_CD,
                        "root_part_cd" : TRK_GLB_ROOT_PART_CD,
                        "expapr_file_group_cd" : params.expapr_file_group_cd,
                        "expapr_group" : params.expapr_group,
                        "expapr_coretype" : params.expapr_coretype,
                        "pay_svc" : params.pay_svc,
                        "authority_cd" : params.authority_cd,
                        "os_type" : trkCLS.getOS(),
                        "os_version" : trkCLS.getOS(),
                        "app_version" : TRK_GLB_APP_VERSION,
                        "brower" : trkCLS.getBrowser(),
                        "is_out_refer" : trkCLS.getIsOutRefer(),
                        "out_refer_type" : trkCLS.getOutReferType(),
                        "out_keyword" : trkCLS.getOutRefer("n_query"),
                        "out_refer_campaign" : trkCLS.getOutRefer("utm_campaign"),
                        "out_refer_content" : trkCLS.getOutRefer("utm_content"),
                        "out_refer_term" : trkCLS.getOutRefer("utm_term"),
                        "out_refer_idx" : trkCLS.getOutRefer("referidx"),
                        "event_cd" : eventCD,
                        "event_action_cd" : eventActionCD,
                        "event_action_target_cd" : eventActionTargetCD,
                        "event_action_target_type_cd" : eventActionTargetTypeCD,
                        "category2" : params.param1,
                        "category3" : params.param2,
                        "category4" : params.param3,
                        "category5" : params.param4,
                        "category6" : params.param5,
                        "category7" : params.param6,
                        "category8" : params.param7,
                        "share_platform" : params.share_platform,
                        "share_user_id" : params.share_user_id,
                        "out_refer_src" : params.out_refer_src,
                        "out_refer_medium" : params.out_refer_medium,
                        "menu_cd" : params.menu_cd,
                        "EXPAPR_TITLE" : params.expapr_title,
                        "TICKET_YN" : params.ticket_yn,
                        "QST_ID" : params.qst_id,
                        "TOTAL_QST_COUNT" : params.total_qst_count,
                        "NOW_PAGE" : params.now_page,
                        "TOTAL_EXAM_COUNT" : params.total_exam_count,
                        "EXAM_QST_SHOW_MODE" : params.exam_qst_show_mode,
                        "CLICK_NAVI_MODE" : params.click_navi_mode,
                        "CON_GRADE" : params.con_grade,
                    };

                    const success = navigator.sendBeacon(trkCLS.getTrkURL, JSON.stringify(payload));
                    if (success == false) {
                        console.warn("sendBeacon 실패 → 로컬스토리지에 백업");
                    }
                }
            });
        });
    },
	setViewEvent : function(eventCD, eventActionCD, eventActionTargetCD, eventActionTargetTypeCD) {
        
        const payload = {
            "log_type" : TRK_EVENT_LOG_TYPE_VALUE,
            //"uuid" : crypto.randomUUID(),
            "uuid" : generateRandomString(40),
            "timestamp" : Date.now(),
            "cid" : trkCLS.getCookie("CID"),
            "promotion_target_cd" : TRK_GLB_PROMOTION_TARGET_CD,
            "promotion_grade" : TRK_GLB_MEMBER_PROMOTION_GRADE,
            "promotion_is_private" : TRK_GLB_MEMBER_PROMOTION_IS_PRIVATE,
            "promotion_subject" : TRK_GLB_MEMBER_SUBJECT,
            "user_id" : TRK_GLB_USER_ID,
            "mem_group" : TRK_GLB_MEM_GROUP,
            "is_login_cd" : TRK_GLB_IS_LOGIN_CD,
            "is_cookie_cd" : trkCLS.getIsCookie(),
            "user_agent" : navigator.userAgent,
            "enc_type" : trkCLS.getEncType(),
            "server_ip" : TRK_GLB_SERVER_IP,
            "ip" : TRK_GLB_USER_IP,
            "scheme" : trkCLS.getScheme(),
            "host" : trkCLS.getHost(),
            "port" : trkCLS.getPort(),
            "page_url" : trkCLS.getPageUrl(),
            "get_data" : trkCLS.getGetData(),
            "post_data" : "",
            "full_url" : trkCLS.getFullUrl(),
            "refer_url" : trkCLS.getReferrer(TRK_EVENT_LOG_TYPE_VALUE, ""),
            "refer_param" : trkCLS.getReferrerParam(TRK_EVENT_LOG_TYPE_VALUE, ""),
            "category1" : document.title,
            "toggle_group_cd" : TRK_GLB_TOGGLE_GROUP_CD,
            "expapr_no" : TRK_GLB_EXPAPR_NO,
            "product_cd" : TRK_GLB_PRODUCT_CD,
            "service_type_cd" : TRK_GLB_SERVICE_TYPE_CD,
            "session_id" : TRK_GLB_SESSION_ID,
            "menu_cd" : TRK_GLB_MENU_CD,
            "site_id" : TRK_GLB_SITE_ID,
            "grade" : TRK_GLB_GRADE,
            "subject_cd" : TRK_GLB_SUBJECT_CD,
            "tx_cd" : TRK_GLB_TX_CD,
            "root_part_cd" : TRK_GLB_ROOT_PART_CD,
            "os_type" : trkCLS.getOS(),
            "os_version" : trkCLS.getOS(),
            "app_version" : TRK_GLB_APP_VERSION,
            "brower" : trkCLS.getBrowser(),
            "is_out_refer" : trkCLS.getIsOutRefer(),
            "out_refer_type" : trkCLS.getOutReferType(),
            "out_keyword" : trkCLS.getOutRefer("n_query"),
            "out_refer_src" : trkCLS.getOutRefer("utm_source"),
            "out_refer_medium" : trkCLS.getOutRefer("utm_medium"),
            "out_refer_campaign" : trkCLS.getOutRefer("utm_campaign"),
            "out_refer_content" : trkCLS.getOutRefer("utm_content"),
            "out_refer_term" : trkCLS.getOutRefer("utm_term"),
            "out_refer_idx" : trkCLS.getOutRefer("referidx"),
            "event_cd" : eventCD,
            "event_action_cd" : eventActionCD,
            "event_action_target_cd" : eventActionTargetCD,
            "event_action_target_type_cd" : eventActionTargetTypeCD,
            //"category2" : TRK_GLB_CATEGORY2,
        };

        const success = navigator.sendBeacon(trkCLS.getTrkURL, JSON.stringify(payload));
        if (success == false) {
            console.warn("sendBeacon 실패 → 로컬스토리지에 백업");
        }
	},
	setClickEvent : function(element, eventCD, eventActionCD, eventActionTargetCD, eventActionTargetTypeCD) {
        element.addEventListener('click', function () {
            const payload = {
                "log_type" : TRK_EVENT_LOG_TYPE_VALUE,
                //"uuid" : crypto.randomUUID(),
                "uuid" : generateRandomString(40),
                "timestamp" : Date.now(),
                "cid" : trkCLS.getCookie("CID"),
                "promotion_target_cd" : TRK_GLB_PROMOTION_TARGET_CD,
                "promotion_grade" : TRK_GLB_MEMBER_PROMOTION_GRADE,
                "promotion_is_private" : TRK_GLB_MEMBER_PROMOTION_IS_PRIVATE,
                "promotion_subject" : TRK_GLB_MEMBER_SUBJECT,
                "user_id" : TRK_GLB_USER_ID,
                "mem_group" : TRK_GLB_MEM_GROUP,
                "is_login_cd" : TRK_GLB_IS_LOGIN_CD,
                "is_cookie_cd" : trkCLS.getIsCookie(),
                "user_agent" : navigator.userAgent,
                "enc_type" : trkCLS.getEncType(),
                "server_ip" : TRK_GLB_SERVER_IP,
                "ip" : TRK_GLB_USER_IP,
                "scheme" : trkCLS.getScheme(),
                "host" : trkCLS.getHost(),
                "port" : trkCLS.getPort(),
                "page_url" : trkCLS.getPageUrl(),
                "get_data" : trkCLS.getGetData(),
                "post_data" : "",
                "full_url" : trkCLS.getFullUrl(),
                "refer_url" : trkCLS.getReferrer(TRK_EVENT_LOG_TYPE_VALUE, ""),
                "refer_param" : trkCLS.getReferrerParam(TRK_EVENT_LOG_TYPE_VALUE, ""),
                "toggle_group_cd" : TRK_GLB_TOGGLE_GROUP_CD,
                "expapr_no" : TRK_GLB_EXPAPR_NO,
                "product_cd" : TRK_GLB_PRODUCT_CD,
                "session_id" : TRK_GLB_SESSION_ID,
                "menu_cd" : TRK_GLB_MENU_CD,
                "site_id" : TRK_GLB_SITE_ID,
                "grade" : TRK_GLB_GRADE,
                "subject_cd" : TRK_GLB_SUBJECT_CD,
                "tx_cd" : TRK_GLB_TX_CD,
                "root_part_cd" : TRK_GLB_ROOT_PART_CD,
                "service_type_cd" : TRK_GLB_SERVICE_TYPE_CD,
                "os_type" : trkCLS.getOS(),
                "os_version" : trkCLS.getOS(),
                "app_version" : TRK_GLB_APP_VERSION,
                "brower" : trkCLS.getBrowser(),
                "is_out_refer" : trkCLS.getIsOutRefer(),
                "out_refer_type" : trkCLS.getOutReferType(),
                "out_keyword" : trkCLS.getOutRefer("n_query"),
                "out_refer_src" : trkCLS.getOutRefer("utm_source"),
                "out_refer_medium" : trkCLS.getOutRefer("utm_medium"),
                "out_refer_campaign" : trkCLS.getOutRefer("utm_campaign"),
                "out_refer_content" : trkCLS.getOutRefer("utm_content"),
                "out_refer_term" : trkCLS.getOutRefer("utm_term"),
                "out_refer_idx" : trkCLS.getOutRefer("referidx"),
                "event_cd" : eventCD,
                "event_action_cd" : eventActionCD,
                "event_action_target_cd" : eventActionTargetCD,
                "event_action_target_type_cd" : eventActionTargetTypeCD,
                //"category2" : TRK_GLB_CATEGORY2,
            };

            const success = navigator.sendBeacon(trkCLS.getTrkURL, JSON.stringify(payload));
            if (success == false) {
                console.warn("sendBeacon 실패 → 로컬스토리지에 백업");
            }
        }, true);
	},
    setConversion : function(eventActionTargetCD, eventActionCD) {
        jQuery.ajax({
            type : "GET",
            dataType:'json',
            url : "/include/ajax/setEventAjax.asp",
            data: {
                "event_action_target_cd": eventActionTargetCD,
                "event_action_cd" : eventActionCD,
            },
            success: function(responseJson) {
            }, error: function(request, exception) {
            }
        });
    }, 
    setExternalEvent : function(trackCD, params) {
        jQuery.each(trkCLS.ARRAY_TRACK, function (i, evnet) {
			let eventCD = evnet.EVENT_CD.replace('EVENT_CD_','');
			let eventStartDT = new Date(evnet.EVENT_START_DT);
			let eventEndDT = new Date(evnet.EVENT_END_DT);

			if (TRK_TODAY_DT.getTime() < eventStartDT.getTime() 
                    && eventEndDT.getTime() > TRK_TODAY_DT.getTime()) {
				return false;
			}

            let eventDetail = evnet.EVENT_DETAIL_LSIT.filter((val) => {return val.EVENT_ACTION_TARGET_CD == trackCD});
            if (eventDetail.length > 0) {
                let eventActionCD = Number(eventDetail[0].EVENT_ACTION_CD);
                let eventActionTargetCD = eventDetail[0].EVENT_ACTION_TARGET_CD;
                let eventActionTargetTypeCD = Number(eventDetail[0].EVENT_ACTION_TARGET_TYPE_CD);
                if (isValueEmpty(params)) {
                    params = {
                        "param1" : "", 
                        "param2" : "",
                        "param3" : "",
                        "param4" : "",
                        "param5" : "",
                        "param6" : "",
                        "param7" : "",
                        "param8" : "",
                        "share_platform" : "",
                        "share_user_id" : "",
                        "expapr_no" : "",
                        "product_cd" : "",
                        "conversion_target_cd" : "",
                        "conversion_cd" : "",
                        "grade" : "",
                        "subject_cd" : "",
                        "site_id" : "",
                        "expapr_file_group_cd" : "",
                        "expapr_group" : "",
                        "expapr_coretype" : "",
                        "pay_svc" : "",
                        "authority_cd" : "",
                        "refer_url" : "",
                        "out_refer_src" : "",
                        "out_refer_medium" : "",
						"vod_no" : "",
						"vod_title" : "",
						"vod_type" : "",
						"down_flag" : "",
                        "community_no" : "",
                        "community_kind" : "",
                        "community_grade" : "",
                        "community_like_flag" : "",
                        "community_subj" : "",
                        "menu_cd" : "",
                        "expapr_title" : "",
						"ticket_yn" : "",
						"qst_id" : "",
						"total_qst_count" : "",
						"now_page" : "",
						"total_exam_count" : "",
						"exam_qst_show_mode" : "",
						"click_navi_mode" : "",
                        "con_grade" : ""
                    };
                } else {
                    if (isValueEmpty(params.param1)) params.param1 = "";
                    if (isValueEmpty(params.param2)) params.param2 = "";
                    if (isValueEmpty(params.param3)) params.param3 = "";
                    if (isValueEmpty(params.param4)) params.param4 = "";
                    if (isValueEmpty(params.param5)) params.param5 = "";
                    if (isValueEmpty(params.param6)) params.param6 = "";
                    if (isValueEmpty(params.param7)) params.param7 = "";
                    if (isValueEmpty(params.param8)) params.param8 = "";
                    if (isValueEmpty(params.share_platform)) params.share_platform = "";
                    if (isValueEmpty(params.share_user_id)) params.share_user_id = "";
                    if (isValueEmpty(params.expapr_no)) params.expapr_no = "";
                    if (isValueEmpty(params.product_cd)) params.product_cd = "";
                    if (isValueEmpty(params.conversion_target_cd)) params.conversion_target_cd = "";
                    if (isValueEmpty(params.conversion_cd)) params.conversion_cd = "";
                    if (isValueEmpty(params.out_refer_src)) params.out_refer_src = "";
                    if (isValueEmpty(params.out_refer_medium)) params.out_refer_medium = "";
                    if (isValueEmpty(params.grade)) params.grade = "";
                    if (isValueEmpty(params.subject_cd)) params.subject_cd = "";
                    if (isValueEmpty(params.expapr_file_group_cd)) params.expapr_file_group_cd = "";
                    if (isValueEmpty(params.expapr_group)) params.expapr_group = "";
                    if (isValueEmpty(params.expapr_coretype)) params.expapr_coretype = "";
                    if (isValueEmpty(params.pay_svc)) params.pay_svc = "";
                    if (isValueEmpty(params.authority_cd)) params.authority_cd = "";
                    if (isValueEmpty(params.menu_cd)) params.menu_cd = TRK_GLB_MENU_CD;
                    if (isValueEmpty(params.site_id)) params.site_id = TRK_GLB_SITE_ID;
                    if (isValueEmpty(params.tx_cd)) params.tx_cd = TRK_GLB_TX_CD;
                    if (isValueEmpty(params.root_part_cd)) params.root_part_cd = TRK_GLB_ROOT_PART_CD;
                    if (isValueEmpty(params.refer_url)) params.refer_url = "";
                    if (isValueEmpty(params.vod_no)) params.vod_no = "";
                    if (isValueEmpty(params.vod_title)) params.vod_title  = "";
                    if (isValueEmpty(params.vod_type)) params.vod_type = "";
                    if (isValueEmpty(params.down_flag)) params.down_flag = "";
                    if (isValueEmpty(params.community_no)) params.community_no = "";
                    if (isValueEmpty(params.community_kind)) params.community_kind = "";
                    if (isValueEmpty(params.community_grade)) params.community_grade = "";
                    if (isValueEmpty(params.community_like_flag)) params.community_like_flag = "";
                    if (isValueEmpty(params.community_subj)) params.community_subj = "";
                    if (isValueEmpty(params.menu_cd)) params.menu_cd = "";
                    if (isValueEmpty(params.expapr_title)) params.expapr_title = "";
                    if (isValueEmpty(params.ticket_yn)) params.ticket_yn = "";
                    if (isValueEmpty(params.qst_id)) params.qst_id = "";
                    if (isValueEmpty(params.total_qst_count)) params.total_qst_count = "";
                    if (isValueEmpty(params.now_page)) params.now_page = "";
                    if (isValueEmpty(params.total_exam_count)) params.total_exam_count = "";
                    if (isValueEmpty(params.exam_qst_show_mode)) params.exam_qst_show_mode = "";
                    if (isValueEmpty(params.click_navi_mode)) params.click_navi_mode = "";
                    if (isValueEmpty(params.con_grade)) params.con_grade = "";
                }

                
                const payload = {
                    "log_type" : TRK_EVENT_LOG_TYPE_VALUE,
                    //"uuid" : crypto.randomUUID(),
                    "uuid" : generateRandomString(40),
                    "timestamp" : Date.now(),
                    "cid" : trkCLS.getCookie("CID"),
                    "promotion_target_cd" : TRK_GLB_PROMOTION_TARGET_CD,
                    "promotion_grade" : TRK_GLB_MEMBER_PROMOTION_GRADE,
                    "promotion_is_private" : TRK_GLB_MEMBER_PROMOTION_IS_PRIVATE,
                    "promotion_subject" : TRK_GLB_MEMBER_SUBJECT,
                    "user_id" : TRK_GLB_USER_ID,
                    "mem_group" : TRK_GLB_MEM_GROUP,
                    "is_login_cd" : TRK_GLB_IS_LOGIN_CD,
                    "is_cookie_cd" : trkCLS.getIsCookie(),
                    "user_agent" : navigator.userAgent,
                    "enc_type" : trkCLS.getEncType(),
                    "server_ip" : TRK_GLB_SERVER_IP,
                    "ip" : TRK_GLB_USER_IP,
                    "scheme" : trkCLS.getScheme(),
                    "host" : trkCLS.getHost(),
                    "port" : trkCLS.getPort(),
                    "page_url" : trkCLS.getPageUrl(),
                    "get_data" : trkCLS.getGetData(),
                    "post_data" : "",
                    "full_url" : trkCLS.getFullUrl(),
                    "refer_url" : trkCLS.getReferrer(TRK_EVENT_LOG_TYPE_VALUE, params.refer_url),
                    "refer_param" : trkCLS.getReferrerParam(TRK_EVENT_LOG_TYPE_VALUE, params.refer_url),
                    "toggle_group_cd" : TRK_GLB_TOGGLE_GROUP_CD,
                    "expapr_no" : params.expapr_no,
                    "product_cd" : params.product_cd,
                    "session_id" : TRK_GLB_SESSION_ID,
                    "menu_cd" : params.menu_cd,
                    "subject_cd" : params.subject_cd,
                    "site_id" : params.site_id,
                    "expapr_file_group_cd" : params.expapr_file_group_cd,
                    "expapr_group" : params.expapr_group,
                    "expapr_coretype" : params.expapr_coretype,
                    "pay_svc" : params.pay_svc,
                    "authority_cd" : params.authority_cd,
                    "tx_cd" : params.tx_cd,
                    "root_part_cd" : params.root_part_cd,
                    "service_type_cd" : TRK_GLB_SERVICE_TYPE_CD,
                    "os_type" : trkCLS.getOS(),
                    "os_version" : trkCLS.getOS(),
                    "app_version" : TRK_GLB_APP_VERSION,
                    "brower" : trkCLS.getBrowser(),
                    "is_out_refer" : trkCLS.getIsOutRefer(),
                    "out_refer_type" : trkCLS.getOutReferType(),
                    "out_keyword" : trkCLS.getOutRefer("n_query"),
                    "out_refer_src" : trkCLS.getOutRefer("utm_source"),
                    "out_refer_medium" : trkCLS.getOutRefer("utm_medium"),
                    "out_refer_campaign" : trkCLS.getOutRefer("utm_campaign"),
                    "out_refer_content" : trkCLS.getOutRefer("utm_content"),
                    "out_refer_term" : trkCLS.getOutRefer("utm_term"),
                    "out_refer_idx" : trkCLS.getOutRefer("referidx"),
                    "event_cd" : eventCD,
                    "event_action_cd" : eventActionCD,
                    "event_action_target_cd" : eventActionTargetCD,
                    "event_action_target_type_cd" : eventActionTargetTypeCD,
                    "category2" : params.param1,
                    "category3" : params.param2,
                    "category4" : params.param3,
                    "category5" : params.param4,
                    "category6" : params.param5,
                    "category7" : params.param6,
                    "category8" : params.param7,
                    "share_platform" : params.share_platform,
                    "share_user_id" : params.share_user_id,
                    "conversion_target_cd" : params.conversion_target_cd,
                    "conversion_cd" : params.conversion_cd,
					"vod_no" : params.vod_no,
					"vod_title" : params.vod_title,
					"vod_type" : params.vod_type,
					"down_flag" : params.down_flag,
                    "community_no" : params.community_no,
                    "community_kind" : params.community_kind,
                    "community_grade" : params.community_grade,
                    "community_subj" : params.community_subj,
                    "community_like_flag" : params.community_like_flag,
                    "menu_cd" : params.menu_cd,
                    "EXPAPR_TITLE" : params.expapr_title,
                    "TICKET_YN" : params.ticket_yn,
                    "QST_ID" : params.qst_id,
                    "TOTAL_QST_COUNT" : params.total_qst_count,
                    "NOW_PAGE" : params.now_page,
                    "TOTAL_EXAM_COUNT" : params.total_exam_count,
                    "EXAM_QST_SHOW_MODE" : params.exam_qst_show_mode,
                    "CLICK_NAVI_MODE" : params.click_navi_mode,
                    "CON_GRADE" : params.con_grade,
                };
    
                const success = navigator.sendBeacon(trkCLS.getTrkURL, JSON.stringify(payload));
                if (success == false) {
                    console.warn("sendBeacon 실패 → 로컬스토리지에 백업");
                }
            }
        });
    },
    setConversionComplete : function(eventCD, eventActionCD, eventActionTargetCD, eventActionTargetTypeCD, conversionTargetCD, conversionCD) {
        const payload = {
            "log_type" : TRK_EVENT_LOG_TYPE_VALUE,
            //"uuid" : crypto.randomUUID(),
            "uuid" : generateRandomString(40),
            "timestamp" : Date.now(),
            "cid" : trkCLS.getCookie("CID"),
            "promotion_target_cd" : TRK_GLB_PROMOTION_TARGET_CD,
            "promotion_grade" : TRK_GLB_MEMBER_PROMOTION_GRADE,
            "promotion_is_private" : TRK_GLB_MEMBER_PROMOTION_IS_PRIVATE,
            "promotion_subject" : TRK_GLB_MEMBER_SUBJECT,
            "user_id" : TRK_GLB_USER_ID,
            "mem_group" : TRK_GLB_MEM_GROUP,
            "is_login_cd" : TRK_GLB_IS_LOGIN_CD,
            "is_cookie_cd" : trkCLS.getIsCookie(),
            "user_agent" : navigator.userAgent,
            "enc_type" : trkCLS.getEncType(),
            "server_ip" : TRK_GLB_SERVER_IP,
            "ip" : TRK_GLB_USER_IP,
            "scheme" : trkCLS.getScheme(),
            "host" : trkCLS.getHost(),
            "port" : trkCLS.getPort(),
            "page_url" : trkCLS.getPageUrl(),
            "get_data" : trkCLS.getGetData(),
            "post_data" : "",
            "full_url" : trkCLS.getFullUrl(),
            "refer_url" : trkCLS.getReferrer(TRK_EVENT_LOG_TYPE_VALUE),
            "refer_param" : trkCLS.getReferrerParam(TRK_EVENT_LOG_TYPE_VALUE),
            "toggle_group_cd" : TRK_GLB_TOGGLE_GROUP_CD,
            "expapr_no" : TRK_GLB_EXPAPR_NO,
            "product_cd" : TRK_GLB_PRODUCT_CD,
            "session_id" : TRK_GLB_SESSION_ID,
            "menu_cd" : TRK_GLB_MENU_CD,
            "subject_cd" : TRK_GLB_SUBJECT_CD,
            "site_id" : TRK_GLB_SITE_ID,
            "tx_cd" : TRK_GLB_TX_CD,
            "root_part_cd" : TRK_GLB_ROOT_PART_CD,
            "event_cd" : eventCD,
            "event_action_cd" : eventActionCD,
            "event_action_target_cd" : eventActionTargetCD,
            "event_action_target_type_cd" : eventActionTargetTypeCD,
            "service_type_cd" : TRK_GLB_SERVICE_TYPE_CD,
            "os_type" : trkCLS.getOS(),
            "os_version" : trkCLS.getOS(),
            "app_version" : TRK_GLB_APP_VERSION,
            "brower" : trkCLS.getBrowser(),
            "is_out_refer" : trkCLS.getIsOutRefer(),
            "out_refer_type" : trkCLS.getOutReferType(),
            "out_keyword" : trkCLS.getOutRefer("n_query"),
            "out_refer_src" : trkCLS.getOutRefer("utm_source"),
            "out_refer_medium" : trkCLS.getOutRefer("utm_medium"),
            "out_refer_campaign" : trkCLS.getOutRefer("utm_campaign"),
            "out_refer_content" : trkCLS.getOutRefer("utm_content"),
            "out_refer_term" : trkCLS.getOutRefer("utm_term"),
            "out_refer_idx" : trkCLS.getOutRefer("referidx"),
            "conversion_target_cd" : conversionTargetCD,
            "conversion_cd" : conversionCD,
        };

        const success = navigator.sendBeacon(trkCLS.getTrkURL, JSON.stringify(payload));
        if (success == false) {
            console.warn("sendBeacon 실패 → 로컬스토리지에 백업");
        }

        jQuery.ajax({
            type : "GET",
            dataType:'json',
            url : "/include/ajax/setEventCompleteAjax.asp",
            data: {
                "event_action_target_cd": eventActionTargetCD
            },
            success: function(responseJson) {
            }, error: function(request, exception) {
            }
        });
    },
    setExamSearch : function (params) {
        const payload = {
            "log_type" : "VIEW",
            //"uuid" : crypto.randomUUID(),
            "uuid" : generateRandomString(40),
            "timestamp" : Date.now(),
            "cid" : trkCLS.getCookie("CID"),
            "promotion_target_cd" : TRK_GLB_PROMOTION_TARGET_CD,
            "promotion_grade" : TRK_GLB_MEMBER_PROMOTION_GRADE,
            "promotion_is_private" : TRK_GLB_MEMBER_PROMOTION_IS_PRIVATE,
            "promotion_subject" : TRK_GLB_MEMBER_SUBJECT,
            "user_id" : TRK_GLB_USER_ID,
            "mem_group" : TRK_GLB_MEM_GROUP,
            "is_login_cd" : TRK_GLB_IS_LOGIN_CD,
            "is_cookie_cd" : trkCLS.getIsCookie(),
            "user_agent" : navigator.userAgent,
            "enc_type" : trkCLS.getEncType(),
            "server_ip" : TRK_GLB_SERVER_IP,
            "ip" : TRK_GLB_USER_IP,
            "scheme" : trkCLS.getScheme(),
            "host" : trkCLS.getHost(),
            "port" : trkCLS.getPort(),
            "page_url" : trkCLS.getPageUrl(),
            "get_data" : trkCLS.getGetData(),
            "post_data" : "",
            "full_url" : trkCLS.getFullUrl(),
            "refer_url" : trkCLS.getReferrer("VIEW", ""),
            "refer_param" : trkCLS.getReferrerParam("VIEW", ""),
            "category1" : document.title,
            "toggle_group_cd" : TRK_GLB_TOGGLE_GROUP_CD,
            "expapr_no" : TRK_GLB_EXPAPR_NO,
            "product_cd" : TRK_GLB_PRODUCT_CD,
            "service_type_cd" : TRK_GLB_SERVICE_TYPE_CD,
            "session_id" : TRK_GLB_SESSION_ID,
            "menu_cd" : params.menu_cd,
            "site_id" : params.site_id,
            "grade" : params.grade,
            "subject_cd" : params.subject_cd,
            "subject_detail_cd" : params.subject_detail_cd,
            "tx_cd" : params.tx_cd,
            "root_part_cd" : params.root_part_cd,
            "level_cd" : params.level_cd,
            "sub_menu_cd" : params.sub_menu_cd,
            "text_book_nm" : params.text_book_nm,
            "year_cd" : params.year_cd,
            "vod_type" : params.vod_type,
            "work_author" : params.work_author,
            "work_title" : params.work_title,
            "text_id" : TRK_GLB_TEXT_ID,
            "now_page" : TRK_GLB_QST_SEQ,
            "share_platform" : TRK_GLB_SHARE_PLATFORM,
            "share_user_id" : TRK_GLB_SHARE_USER_ID,
            "os_type" : trkCLS.getOS(),
            "os_version" : trkCLS.getOS(),
            "app_version" : TRK_GLB_APP_VERSION,
            "brower" : trkCLS.getBrowser(),
            "is_out_refer" : trkCLS.getIsOutRefer(),
            "out_refer_type" : trkCLS.getOutReferType(),
            "out_keyword" : trkCLS.getOutRefer("n_query"),
            "out_refer_src" : trkCLS.getOutRefer("utm_source"),
            "out_refer_medium" : trkCLS.getOutRefer("utm_medium"),
            "out_refer_campaign" : trkCLS.getOutRefer("utm_campaign"),
            "out_refer_content" : trkCLS.getOutRefer("utm_content"),
            "out_refer_term" : trkCLS.getOutRefer("utm_term"),
            "out_refer_idx" : trkCLS.getOutRefer("referidx"),
        };

        const success = navigator.sendBeacon(trkCLS.getTrkURL, JSON.stringify(payload));
        if (success == false) {
            console.warn("sendBeacon 실패 → 로컬스토리지에 백업");
        }
    },
    setProduct : function (params) {
        const payload = {
            "log_type" : "EVENT",
            "uuid" : generateRandomString(40),
            "timestamp" : Date.now(),
            "cid" : trkCLS.getCookie("CID"),
            "promotion_target_cd" : TRK_GLB_PROMOTION_TARGET_CD,
            "promotion_grade" : TRK_GLB_MEMBER_PROMOTION_GRADE,
            "promotion_is_private" : TRK_GLB_MEMBER_PROMOTION_IS_PRIVATE,
            "promotion_subject" : TRK_GLB_MEMBER_SUBJECT,
            "user_id" : TRK_GLB_USER_ID,
            "mem_group" : TRK_GLB_MEM_GROUP,
            "is_login_cd" : TRK_GLB_IS_LOGIN_CD,
            "is_cookie_cd" : trkCLS.getIsCookie(),
            "user_agent" : navigator.userAgent,
            "enc_type" : trkCLS.getEncType(),
            "server_ip" : TRK_GLB_SERVER_IP,
            "ip" : TRK_GLB_USER_IP,
            "scheme" : trkCLS.getScheme(),
            "host" : trkCLS.getHost(),
            "port" : trkCLS.getPort(),
            "page_url" : trkCLS.getPageUrl(),
            "get_data" : trkCLS.getGetData(),
            "post_data" : "",
            "full_url" : trkCLS.getFullUrl(),
            "refer_url" : trkCLS.getReferrer("VIEW", ""),
            "refer_param" : trkCLS.getReferrerParam("VIEW", ""),
            "toggle_group_cd" : TRK_GLB_TOGGLE_GROUP_CD,
            "expapr_no" : TRK_GLB_EXPAPR_NO,
            "product_cd" : params.PRODUCT_CD,
            "service_type_cd" : TRK_GLB_SERVICE_TYPE_CD,
            "session_id" : TRK_GLB_SESSION_ID,
            "os_type" : trkCLS.getOS(),
            "os_version" : trkCLS.getOS(),
            "app_version" : TRK_GLB_APP_VERSION,
            "brower" : trkCLS.getBrowser(),
            "is_out_refer" : trkCLS.getIsOutRefer(),
            "out_refer_type" : trkCLS.getOutReferType(),
            "out_keyword" : trkCLS.getOutRefer("n_query"),
            "out_refer_src" : trkCLS.getOutRefer("utm_source"),
            "out_refer_medium" : trkCLS.getOutRefer("utm_medium"),
            "out_refer_campaign" : trkCLS.getOutRefer("utm_campaign"),
            "out_refer_content" : trkCLS.getOutRefer("utm_content"),
            "out_refer_term" : trkCLS.getOutRefer("utm_term"),
            "out_refer_idx" : trkCLS.getOutRefer("referidx"),
            "event_action_cd" : TRK_ACTION_CD.클릭,
            "event_action_target_cd" : "LXGFJ5WY3QCTVF3WHSP3FM23P20260105",
            "category1" : params.PRODUCT_BY_ACTION_CD,
            "category2" : params.PRODUCT_BY_SELECTED_CATEGORY_CD,
            "category3" : params.PRODUCT_BY_SELECTED_SITE_ID,
            "category4" : params.PRODUCT_BY_SELECTED_GRADE,
            "category5" : params.PRODUCT_BY_SUBJECTCD,
            "category6" : params.PRODUCT_BY_SELECTED_PERIOD,
            "category7" : params.PRODUCT_BY_SERVICE,
            "category8" : params.PRODUCT_BY_CONCURRENT_USERS_CNT,
            "category9" : params.PRODUCT_BY_NUDGE,
            "upselling_product_cd" : params.PRODUCT_BY_UPSELLING_PRODUCT_CD,
        };

        const success = navigator.sendBeacon(trkCLS.getTrkURL, JSON.stringify(payload));
        if (success == false) {
            console.warn("sendBeacon 실패 → 로컬스토리지에 백업");
        }
    },
    setClickConversion : function (element, eventActionTargetCD, eventActionCD) {
        if (TRK_PAGE_URL.indexOf("learning_product.asp") > -1 || TRK_PAGE_URL.indexOf("teacher_product.asp") > -1) {
            trkCLS.setConversion(eventActionTargetCD, eventActionCD);
        } else {
            element.addEventListener('click', function () {
                trkCLS.setConversion(eventActionTargetCD, eventActionCD);
            });
        }
    }
}