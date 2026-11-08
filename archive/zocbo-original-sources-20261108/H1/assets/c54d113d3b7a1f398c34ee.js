let STORAGE_KEY = [] //
const storage = {
    //기본 key (그외 키값은 코드관리를 통해 등록해 사용한다.)
    get COMMON_CODE_JSON_URL () { /** 사이트마다 url 변경 필요함 */
        return "https://" + TRK_GLB_S3_HOST + "/file/common_code/common_code.json";
    },
    get COMMON_CODE_JSON_AJAX_URL () { /** 사이트마다 url 변경 필요함 */
        return "/Common/Ajax/GetCommonCodeJsonDataAjax.asp";
    },
    get COMMON_CODE_LIST () {
        return "COMMON_CODE_LIST";
    },
    get COMMON_CODE_GUID () {
        return "COMMON_CODE_GUID";
    },
    get DOWNLOADED_CONTENT_LIST () {
        return "DOWNLOADED_CONTENT_LIST";
    },
	get VOD_NO_CONTENT_LIST () {
        return "VOD_NO_CONTENT_LIST"
    },
    get CLOUD_EDIT_LIST () {
        return "CLOUD_EDIT_LIST"
    },
    get RETURN_PAGE_URL () {
        return "RETURN_PAGE_URL";
    },
    get PAGE () {
        return "PAGE";
    },
    get START_DT () {
        return "START_DT";
    },
    get SELECTED_MENU_CD () {
        return "SELECTED_MENU_CD";
    },
    get SELECTED_SUBJECT_CD () {
        return "SELECTED_SUBJECT_CD";
    },
    get SELECTED_GRADE () {
        return "SELECTED_GRADE";
    },
    get SELECTED_STORAGE_TYPE() {
        return "SELECTED_STORAGE_TYPE";
    },
    get SKEY () {
        return "SKEY";
    },
    get PAGE_SCROLL_POSITION () {
        return "PAGE_SCROLL_POSITION";
    },
    get IS_APP () {
        return "IS_APP";
    },
    get SEARCH_MENU_CD () {
        return "SEARCH_MENU_CD";
    },
    get SEARCH_SUB_MENU_CD () {
        return "SEARCH_SUB_MENU_CD";
    },
    get SEARCH_SITEID () {
        return "SEARCH_SITEID";
    },
    get SEARCH_GRADE () {
        return "SEARCH_GRADE";
    },
    get SEARCH_SCL_ID () {
        return "SEARCH_SCL_ID";
    },
    get SEARCH_SUBJECT_CD () {
        return "SEARCH_SUBJECT_CD";
    },
    get SEARCH_SUBJECT_DETAIL_CD () {
        return "SEARCH_SUBJECT_DETAIL_CD";
    },
    get SEARCH_TX_CD () {
        return "SEARCH_TX_CD";
    },
    get SEARCH_ROOTPART_CD () {
        return "SEARCH_ROOTPART_CD";
    },
    get SEARCH_SUBPART_CD () {
        return "SEARCH_SUBPART_CD";
    },
    get SEARCH_PART_CD () {
        return "SEARCH_PART_CD";
    },
    get SEARCH_LEVEL_CD () {
        return "SEARCH_LEVEL_CD";
    },
    get SEARCH_YEAR_CD () {
        return "SEARCH_YEAR_CD";
    },
    get SELECTED_WORK () {
        return "SELECTED_WORK";
    },
    get SEARCH_WORK_TITLE () {
        return "SEARCH_WORK_TITLE";
    },
    get SEARCH_WORK_AUTHOR () {
        return "SEARCH_WORK_AUTHOR";
    },
    get SEARCH_KEYWORD () {
        return "SEARCH_KEYWORD";
    },
    get SEARCH_EXPAPR_CORETYPE_CD () {
        return "SEARCH_EXPAPR_CORETYPE_CD";
    },
    get SEARCH_EXPAPR_GROUP_CD () {
        return "SEARCH_EXPAPR_GROUP_CD";
    },
    get SEARCH_TEXT_BOOK_CD () {
        return "SEARCH_TEXT_BOOK_CD";
    },
    get SEARCH_TEXT_BOOK_NM () {
        return "SEARCH_TEXT_BOOK_NM";
    },
    get SEARCH_VOD_TYPE () {
        return "SEARCH_VOD_TYPE";
    },
    get SEARCH_STEP_CD () {
        return "SEARCH_STEP_CD";
    },
    get EXPAPR_NO () {
        return "EXPAPR_NO";
    },
    get REPRESENTATIVE_EXPAPR_NO () {
        return "REPRESENTATIVE_EXPAPR_NO";
    },
    get EXPAPR_NAME () {
        return "EXPAPR_NAME";
    },
	get LEVEL_CD () {
        return "LEVEL_CD";
    },
    get SITEID () {
        return "SITEID";
    },
    get EXPAPR_GROUP_CD () {
        return "EXPAPR_GROUP_CD";
    },
    get EXPAPR_CORETYPE_CD () {
        return "EXPAPR_CORETYPE_CD";
    },
    get EXPAPER_FILE_GROUP_LIST () {
        return "EXPAPER_FILE_GROUP_LIST";
    },
    get EXPAPER_FILE_GROUP () {
        return "EXPAPER_FILE_GROUP";
    },
    get EXPAPER_AUTH () {
        return "EXPAPER_AUTH";
    },
    get PAY_SVC () {
        return "PAY_SVC";
    },
    get TICKET_NAME () {
        return "TICKET_NAME";
    },
    get PRODUCT_CD () {
        return "PRODUCT_CD";
    },
    get SELECTED_MODE () {
        return "SELECTED_MODE";
    },
	get EXPAPR_GENERATION_ROUND_CD () {
        return "EXPAPR_GENERATION_ROUND_CD";
    },
	get EXPAPR_RE_DOWN_NO () {
        return "EXPAPR_RE_DOWN_NO";
    },
	get EXAE_NO () {
        return "EXAE_NO";
    },
	get CLOUD_EXAE_NO () {
        return "CLOUD_EXAE_NO";
    },
    get ZOCBO_EXAE_NO () {
        return "ZOCBO_EXAE_NO";
    },
	get EXPAPER_CLOUD_AUTH () {
        return "EXPAPER_CLOUD_AUTH";
    },
    get EXPAPR_PART_NM () {
        return "EXPAPR_PART_NM";
    },
    get EXPAPR_CORE_TYPE_NM () {
        return "EXPAPR_CORE_TYPE_NM";
    },
    get EXPAPR_IS_EDIT () {
        return "EXPAPR_IS_EDIT";
    },
	get LOGO_PATH () {
        return "LOGO_PATH";
    },
	get LOGO_AUTH () {
        return "LOGO_AUTH";
    },
    get APP_RETURN_PAGE_URL () {
        return "APP_RETURN_PAGE_URL";
    },
    get RETURN_APP () {
        return "RETURN_APP";
    },
    get SELECTED_BOARDKIND () {
        return "SELECTED_BOARDKIND";
    },
    get SELECTED_BEST () {
        return "SELECTED_BEST";
    },
    get SELECTED_TAB () {
        return "SELECTED_TAB";
    },
    get COMMUNITY_SKEY () {
        return "COMMUNITY_SKEY";
    },
    get COMMUNITY_ORDER () {
        return "COMMUNITY_ORDER";
    },
    get COMMUNITY_SEARCH_KEYWORD () {
        return "COMMUNITY_SEARCH_KEYWORD";
    },
    get RELOAD () {
        return "RELOAD";
    },
    get COMMUNITY_BLOCK_INFO () {
        return "COMMUNITY_BLOCK_INFO";
    },
    get EXPAPR_PART_CD () {
        return "EXPAPR_PART_CD";
    },
    get EXPAPR_LEVEL_CD () {
        return "EXPAPR_LEVEL_CD";
    },
    get EXPAPR_PART_ID () {
        return "EXPAPR_PART_ID";
    },
    get EXPAPR_AUTO_DOWN_SEQ () {
        return "EXPAPR_AUTO_DOWN_SEQ";
    },
    get EXPAPR_EXAM_INDEX () {
        return "EXPAPR_EXAM_INDEX";
    },
    get EXPAPR_GRADE () {
        return "EXPAPR_GRADE";
    },
    get EXPAPR_TYPE_CD () {
        return "EXPAPR_TYPE_CD";
    },
    get EXPAPR_TESTYEAR () {
        return "EXPAPR_TESTYEAR";
    },
    get IS_BEFORE_EXAM () {
        return "IS_BEFORE_EXAM";
    },
	get VOD_NO () {
        return "VOD_NO";
    },
	get VOD_AUTH () {
        return "VOD_AUTH";
    },
    get VOD_TITLE () {
        return "VOD_TITLE";
    },
    get VOD_TYPE () {
        return "VOD_TYPE";
    },
	get DOWN_FLAG () {
        return "DOWN_FLAG";
    },
    get TOPIC_ID () {
        return "TOPIC_ID";
    },
    get TIP_BRAND_SERVICE_INFO_MSG_H2 () {
        return "TIP_BRAND_SERVICE_INFO_MSG_H2";
    },
    get TIP_BRAND_SERVICE_INFO_MSG_H3 () {
        return "TIP_BRAND_SERVICE_INFO_MSG_H3";
    },
    get EXPAPR_PART () {
        return "EXPAPR_PART";
    },
    get EXPAPR_COUNT () {
        return "EXPAPR_COUNT";
    },
    get NO_FIRST_LOGIN_LAYER_POPUP_TARGET () {
        return "NO_FIRST_LOGIN_LAYER_POPUP_TARGET";
    },
    get CONTENT_LIST_MOVE_WITHIN_PAGE () {
        return "CONTENT_LIST_MOVE_WITHIN_PAGE";
    },
    get VOD_PAY_SVC () {
        return "VOD_PAY_SVC";
    },
	get VOD_DATA_FORMAT () {
        return "VOD_DATA_FORMAT";
    },
	get VOD_EXPAPR_GRADE () {
        return "VOD_EXPAPR_GRADE";
    },
	get VOD_SITEID () {
        return "VOD_SITEID";
    },
    get VOD_EXPAPR_GROUP_CD () {
        return "VOD_EXPAPR_GROUP_CD";
    },
    get VOD_EXPAPR_CORETYPE_CD () {
        return "VOD_EXPAPR_CORETYPE_CD";
    },
    get ANSWER_AUTH () {
        return "ANSWER_AUTH"
    },
    get PRODUCT_BY_SELECTED_SITE_ID () {
        return "PRODUCT_BY_SELECTED_SITE_ID";
    },
    get PRODUCT_BY_SELECTED_GRADE () {
        return "PRODUCT_BY_SELECTED_GRADE";
    },
    get PRODUCT_BY_SELECTED_PERIOD () {
        return "PRODUCT_BY_SELECTED_PERIOD";
    },
    get PRODUCT_BY_EXTENSION_SERVICE_PERIOD () {
        return "PRODUCT_BY_EXTENSION_SERVICE_PERIOD";
    },
    get PRODUCT_BY_SELECTED_ZCOUPON_DISPLAY () {
        return "PRODUCT_BY_SELECTED_ZCOUPON_DISPLAY";
    },
    get PRODUCT_BY_SELECTED_PREGO1_PERIOD () {
        return "PRODUCT_BY_SELECTED_PREGO1_PERIOD";
    },
    get PRODUCT_BY_SELECTED_PREMID1_PERIOD () {
        return "PRODUCT_BY_SELECTED_PREMID1_PERIOD";
    },
    get PRODUCT_BY_SELECTED_DOWNLOAD_COUNT () {
        return "PRODUCT_BY_SELECTED_DOWNLOAD_COUNT";
    },
    get PRODUCT_BY_SELECTED_CATEGORY_CD () {
        return "PRODUCT_BY_SELECTED_CATEGORY_CD";
    },
    get PRODUCT_BY_POINT () {
        return "PRODUCT_BY_POINT";
    },
    get PRODUCT_BY_SKYTAB () {
        return "PRODUCT_BY_SKYTAB";
    },
    get PRODUCT_BY_ZOCBO () {
        return "PRODUCT_BY_ZOCBO";
    },
    get PRODUCT_BY_SOOPRING () {
        return "PRODUCT_BY_SOOPRING";
    },
    get PRODUCT_BY_RENTAL_PRODUCT () {
        return "PRODUCT_BY_RENTAL_PRODUCT";
    },
    get PRODUCT_BY_RENTAL_EQUIPMENT () {
        return "PRODUCT_BY_RENTAL_EQUIPMENT";
    },
    get PRODUCT_BY_SERVICE () {
        return "PRODUCT_BY_SERVICE";
    },
    get PRODUCT_BY_30_PERIOD_SERVICE () {
        return "PRODUCT_BY_30_PERIOD_SERVICE";
    },
    get PRODUCT_BY_PREGO1_SERVICE () {
        return "PRODUCT_BY_PREGO1_SERVICE";
    },
    get PRODUCT_BY_PREMID1_SERVICE () {
        return "PRODUCT_BY_PREMID1_SERVICE";
    },
    get PRODUCT_BY_CONCURRENT_USERS_CNT () {
        return "PRODUCT_BY_CONCURRENT_USERS_CNT";
    },
    get PRODUCT_BY_POINT_NUDGE () {
        return "PRODUCT_BY_POINT_NUDGE";
    },
    get PRODUCT_BY_UPSELLING_PRODUCT_CD () {
        return "PRODUCT_BY_UPSELLING_PRODUCT_CD";
    },
    get PRODUCT_BY_NUDGE_PROMOTION_NAME () {
        return "PRODUCT_BY_NUDGE_PROMOTION_NAME";
    },
    get PRODUCT_BY_SUBJECTCD () {
        return "PRODUCT_BY_SUBJECTCD";
    },
    get SKYTAB_BY_CLASS_NO () {
        return "SKYTAB_BY_CLASS_NO";
    },
    get SKYTAB_BY_PAY_STATUS () {
        return "SKYTAB_BY_PAY_STATUS";
    },
    get SKYTAB_BY_PAY_NO () {
        return "SKYTAB_BY_PAY_NO";
    },
	get HIJACKING_PROMOTION_TARGET_CD () {
        return "HIJACKING_PROMOTION_TARGET_CD";
    },
	get HIJACKING_PROMOTION_TARGET_DAY () {
        return "HIJACKING_PROMOTION_TARGET_DAY";
    },
	get HIJACKING_PROMOTION_TARGET_DISRATE () {
        return "HIJACKING_PROMOTION_TARGET_DISRATE";
    },
	get SHARE_DISCOUNT_COUPON_YN () {
        return "SHARE_DISCOUNT_COUPON_YN";
    },
	get SHARE_DISCOUNT_COUPON_EXISTS_YN () {
        return "SHARE_DISCOUNT_COUPON_EXISTS_YN";
    },
    get PRODUCT_BENEFIT_LIST () {
        return "PRODUCT_BENEFIT_LIST";
    },
    get PRODUCT_BENEFIT_END_DT () {
        return "PRODUCT_BENEFIT_END_DT";
    },
    get PRODUCT_BENEFIT_DIFF_DT () {
        return "PRODUCT_BENEFIT_DIFF_DT";
    },
    get IS_PROMOTION_BORAM () {
        return "IS_PROMOTION_BORAM";
    },
    get PAYMENT_PAY_TOTAL () {
        return "PAYMENT_PAY_TOTAL";
    },
    get PAYMENT_PAY_AMOUNT () {
        return "PAYMENT_PAY_AMOUNT";
    },
    get PAYMENT_MILEAGE_AMOUNT () {
        return "PAYMENT_MILEAGE_AMOUNT";
    },
    get PAYMENT_POINT_AMOUNT () {
        return "PAYMENT_POINT_AMOUNT";
    },
    get PAYMENT_DISCOUNT_AMOUNT () {
        return "PAYMENT_DISCOUNT_AMOUNT";
    },
	get IS_TRANSFER_CHAPTER () {
        return "IS_TRANSFER_CHAPTER";
    },
    get PAYMENT_COUPON () {
        return "PAYMENT_COUPON";
    },
    get PAYMENT_COUPON_DATA () {
        return "PAYMENT_COUPON_DATA";
    },
    get HITRATIORN_RELOAD () {
        return "HITRATIORN_RELOAD";
    },
    get TRANSFER_PAY_NO () {
        return "TRANSFER_PAY_NO";
    },
    get C_USER_ID () {
        return "C_USER_ID";
    },
    get TRANSFER_PRODUCT_NM () {
        return "TRANSFER_PRODUCT_NM";
    },
    clear : function () {
        storage.clearLocal();
        storage.clearSession();
    },
    //해당 키 존재 확인
    isKeyLocal : function(key) {
        return localStorage.hasOwnProperty(key);
    },
    //value 저장
    setLocal : function(key, value) {
		var temp_val = isValueEmpty(value) ? "" : value;
		if (temp_val.constructor == Array || temp_val.constructor == Object) {
			temp_val = JSON.stringify(temp_val);
		}
		localStorage.setItem(key, temp_val);
    },
    setLocalLimit : function(key, value, exp) {
        let date = new Date();
		date = date.setTime(date.getTime() + exp * 24 * 60 * 60 * 1000);
        var temp_val = isValueEmpty(value) ? "" : value;
		if (temp_val.constructor == Array || temp_val.constructor == Object) {
			temp_val = JSON.stringify(temp_val);
		}
        const item = {
            value : temp_val,
            expiry : date
        };
        localStorage.setItem(key, JSON.stringify(item))
    },
    //value 를 Array형태로 push
    pushArrayLocal : function(key, value) {
        var array = storage.getLocal(key);
        if (Array.isArray(array)) {
            array.push(value);
            storage.setLocal(key, array);
        }
    },
    //value 를 Array형태로 splice
    spliceArrayLocal : function(key, value) {
        var array = storage.getLocal(key);
        if (Array.isArray(array)) {
            var idx = array.indexOf(value);
            array.splice(idx, 1);
            storage.setLocal(key, array);
        }
    },
    //데이터 조회
    getLocal : function(key) {
        if (storage.isKeyLocal(key) == false) {
            return "";
        } else {
            try {
                return JSON.parse(localStorage.getItem(key));
            } catch (e) {
                return localStorage.getItem(key);
            }
        }
    },
    //데이터 조회
    getLocalLimit : function(key) {
        const now = new Date();
        let item;
        if (storage.isKeyLocal(key) == false) {
            return "";
        } else {
            try {
                item = JSON.parse(localStorage.getItem(key));
            } catch (e) {
                return "";
            }

            if (now.getTime() > item.expiry) {
                this.removeLocal(key);
                return "";
            }
            return item.value;
        }
    },
    //value의 Length
    getLengthLocal : function(key) {
        return storage.getLocal(key).length;
    },
    //value의 중복 확인
    inLocal : function(key, value) {
        var tempValue = storage.getLocal(key);
        if (isValueEmpty(tempValue) == true) {
            return false;
        } else if (Array.isArray(tempValue)) {
            return jQuery.inArray(value, tempValue) > -1 ? true : false;
        } else {
            return value == tempValue;
        }
    },
    //키의 데이터 삭제
    removeLocal : function(key) {
        if (storage.isKeyLocal(key)) {
            localStorage.removeItem(key);
        }
    },
    //모든 데이터 삭제
    clearLocal : function() {
        localStorage.clear();
    },
    //해당 키 존재 확인
    isKeySession : function(key) {
        return sessionStorage.hasOwnProperty(key);
    },
    //value 저장
    setSession : function(key, value) {
        if (Array.isArray(value)) {
            sessionStorage.setItem(key, JSON.stringify(value));
        } else {
            sessionStorage.setItem(key, (isValueEmpty(value) ? "" : value));
        }
    },
    //value 를 Array형태로 push
    pushArraySession : function(key, value) {
        var array = storage.getSession(key);
        if (Array.isArray(array)) {
            array.push(value);
            storage.setSession(key, array);
        } else {
            array = new Array();
            array.push(value);
            storage.setSession(key, array);
        }
    },
    //value 를 Array형태로 splice
    spliceArraySession : function(key, value) {
        var array = storage.getSession(key);
        if (Array.isArray(array)) {
            var idx = array.indexOf(value);
            array.splice(idx, 1);
            storage.setSession(key, array);
        }
    },
    //데이터 조회
    getSession : function(key) {
        if (storage.isKeySession(key) == false) {
            return "";
        } else {
            try {
                return JSON.parse(sessionStorage.getItem(key));
            } catch (e) {
                return sessionStorage.getItem(key);
            }
        }
    },
    //value의 Length
    getLengthSession : function(key) {
        return storage.getSession(key).length;
    },
    //value의 중복 확인
    inSession : function(key, value) {
        var tempValue = storage.getSession(key);
        if (isValueEmpty(tempValue) == true) {
            return false;
        } else if (Array.isArray(tempValue)) {
            return jQuery.inArray(value, tempValue) > -1 ? true : false;
        } else {
            return value == tempValue;
        }
    },
    //키의 데이터 삭제
    removeSession : function(key) {
        if (storage.isKeySession(key)) {
            sessionStorage.removeItem(key);
        }
    },
    //모든 데이터 삭제
    clearSession : function() {
        sessionStorage.clear();
    },
    getStrageKeyToSever : function() {
        jQuery.ajax({
            type : "GET",
            dataType:'json',
            url : this.COMMON_CODE_JSON_AJAX_URL,
            data: {
                searchCodeType         : "STORAGE_KEY",
            },
            success: function(responseJson) {
                if (responseJson.RESULT == "false") {
                    alert("반영하기 중 예기치않는 오류가 발생하였습니다.");
                    location.reload();
                } else {
                    storage.setStrageKey(responseJson);
                }
            },error: function(request, exception) {
                return false;
            }
        });
    },

    setLocalStorageKey : function(jsonData) {
        var keys = jsonData.filter(function(e){
            return e.CODE_TYPE == "STORAGE_KEY" && e.ENCRYPTION_STATUS == 0
        });

        jQuery.each(keys, function(index, value) {
            STORAGE_KEY[value.CODE_INFO] = value.CODE_INFO;
        });
    },

    setLocalCommonCode : function(jsonData) {
        this.setLocal(storage.COMMON_CODE_GUID, jsonData.COMMON_CODE_GUID);
        this.setLocal(storage.COMMON_CODE_LIST, jsonData.COMMON_CODE_LIST);
        this.setLocalStorageKey(this.getLocal(storage.COMMON_CODE_LIST));
    },

    getLocalJsonDataLoad : function() {
        jQuery.getJSON(this.COMMON_CODE_JSON_URL,function(jsonData) {
            if (storage.getLocal(storage.COMMON_CODE_GUID) !=jsonData.COMMON_CODE_GUID) {
                storage.setLocalCommonCode(jsonData);
            } else {
                storage.setLocalStorageKey(storage.getLocal(storage.COMMON_CODE_LIST));
            }
        });
    },
};