
const appCLS = {
    IS_FULL_URL_CD : {
        "사용" : "1",
        "미사용" : "0"
    },
    MAX_FILE_SIZE : 20,
    VIDEO_MAX_FILE_SIZE : 2048,
    getLocationHref : function() {
		return new URL(location.href.toUpperCase());
	},
    getReferrer : function() {
        return isValueEmpty(document.referrer) ? "" : document.referrer.toUpperCase();
    },
	getAppYn : function() {
		const url = this.getLocationHref();
        return isValueEmpty(url.searchParams.get("RETURN_PAGE_URL")) ? "" : url.searchParams.get("RETURN_PAGE_URL").toUpperCase();
	},
	getAppReturnPageUrl : function() {
		const url = this.getLocationHref();
        return isValueEmpty(url.searchParams.get("APP_RETURN_PAGE_URL")) ? storage.getSession(storage.APP_RETURN_PAGE_URL) : url.searchParams.get("APP_RETURN_PAGE_URL").toUpperCase();
	},
    getMenuCD : function() {
		const url = this.getLocationHref();
        return isValueEmpty(url.searchParams.get("MENU_CD")) ? "" : url.searchParams.get("MENU_CD").toUpperCase();
	},
	getSiteID : function() {
		const url = this.getLocationHref();
        return isValueEmpty(url.searchParams.get("SITEID")) ? "" : url.searchParams.get("SITEID").toUpperCase();
	},
	setViewAppGo : function() {
		// mobile web 에서 엡으로 가기 버튼 공통 노출		
		$("#viewAppGo").hide();
        jQuery("#hijecking-FreeStorage").removeClass("is-app");		
		if(this.getAppYn() == "APP" || storage.getSession(storage.RETURN_APP) == "Y") {
			// 앱에서 접속한 경우 페이지 이동 시 유지 시키기 위해 세션스토리지 담음
			storage.setSession(storage.RETURN_APP, "Y");
			storage.setSession(storage.APP_RETURN_PAGE_URL, this.getAppReturnPageUrl());
            
            if( (this.getLocationHref().pathname.includes("/PAYMENT/") && !this.getLocationHref().pathname.includes(".ASP"))
                || this.getLocationHref().pathname.includes("/PAYMENT/LEARNING_PRODUCT.ASP")
                || this.getLocationHref().pathname.includes("/PAYMENT/DEFAULT.ASP") 
                || (this.getLocationHref().pathname.includes("/PAYMENT/") 
                && (!this.getReferrer() || this.getReferrer().includes("/PAYMENT/APPPAYMENT.ASP")))) {
				$(".btn_top[data-src='common'][data-act='back']").closest("a").attr("href", "javascript:appCLS.goAppActivation();").attr("data-src", "");	// 결제페이지의 빽버튼은 앱실행
				$("div.header-mo-selector").hide();		// 토글
			} else if (this.getLocationHref().pathname.includes("/PAYMENT/") && this.getLocationHref().pathname.includes(".ASP")) {
				// 결제 페이지 안에서
				$("div.header-mo-selector").hide();		// 토글
				$("div.headTop p.btnRight").hide();		// 마이페이지
				$("div.fixedMenu ul.clearfix").hide();
			} /*else if(this.getLocationHref().pathname == "/") {
				// 메인은 리턴
				storage.removeSession(storage.RETURN_APP);
				storage.removeSession(storage.APP_RETURN_PAGE_URL);				
			}*/ else {
				// 뷰어 APP 돌아가기 버튼 보이기				
				$(".headTop").hide();		// 상단 날리고
				$("div.fixedMenu ul.clearfix").hide();		// 하단 날리고
				$("#viewAppGo").show();	// 상단에 앱으로 빽 버튼 추가 하고
                jQuery("#hijecking-FreeStorage").addClass("is-app");
			}
		}
	},
    HEADER_ICONS : {
        "메인" : "HOME",
        "작성" : "PENCIL",
        "검색" : "SEARCH",
        "등록" : "REGIST",
        "공유" : "SHARE",
        "더보기" : "MORE",
        "설정" : "SETTING",
        "백키" : "BACK",
        "결제" : "GOPAY",
        "햄버거" : "HAMBUERGER",
    },
    getRecoomendedVersion : function () {
        return "3.3.0";
    },
    getInternalizationRecoomendedVersion : function () { // 내제화 버전 체크
        return "3.4.0";
    },
    getVodRecoomendedVersion : function () { // 영상 추가 버전 체크
        return "3.7.0";
    },
    getVodExamRecoomendedVersion : function () { // 내재화 영상 리스트 버전 체크
        if (this.getOS() == "AOS") {
            return "3.7.1"
        }
        return "3.7.0";
    },
    getHeaderRecoomendedVersion : function () { // 컨텐츠 리스트 해더 버전 체크
        return "3.8.1";
    },
    getBackGestureRecoomendedVersion : function () { // 백 제스처 버전 체크
        return "3.9.0";
    },
    getHapticRecoomendedVersion : function () { // 햅틱 버전 체크
        return "3.9.3";
    },
    getCaptureProtectionRecoomendedVersion : function () { // 캡쳐방지 버전 체크
        return "4.0.0";
    },
    getAnswerPaidRecoomendedVersion : function () {		// 정답 유료화
        return "4.1.0";        
    },
    getParticipantsAnswerRecoomendedVersion : function () {		// 참여 정답 (코드는 배포 하지만 실 적용은 안함 - 버전으로 미적용 처리)
        return "4.1.0";        
    },
    getInterfaceJsonRecoomendedVersion : function () {		// 이 버전 이후 인터페이스 호출 시 json 으로 전달
        return "4.1.0";
    },
    getTipV3RecoomendedVersion : function () {		// 풀이팁 V3 적용 버전
        return "4.1.1";
    },
    getShareRecoomendedVersion : function () {		// 이 버전 이후 공유하기 방식 변경
        return "4.1.1";
    },
    getAlarmRecoomendedVersion : function () {		// 이 버전 이후 커뮤니티 등록 시 알림 설정 알럿
        return "4.1.7";
    },
    getHeaderBackRecoomendedVersion : function () {		// newHeaderInfo의 callback은 showBack이 있어야 동작했는데 이 버전 이후부터 showBack이 false여도 callback 사용가능
        return "4.1.9";
    },
    getAppVersion_4_1_10 : function () {		// 하이재킹 랜딩 페이지에서 그냥 나가기 시 4.1.10 이후부터는 webviewClose 호출
        return "4.1.10";
    },
    getViewerDataRecoomendedVersion : function () {
        return "4.2.5";
    },
    getVideoRecoomendedVersion : function () {  // 동영상 업로드 적용 버전
        return "4.3.1";
    },
    getIOS : function () {
        return "IOS";
    },
    getAOS : function () {
        return "AOS";
    },
    getDefaultAction : function () {
        return "goWebViewLink";
    },
    getOS : function () {
        const url = new URL(location.href);
        return isValueEmpty(url.searchParams.get('os-type')) ? "" : url.searchParams.get('os-type').toUpperCase();
    },
    getAppVersion : function () {
        const url = new URL(location.href);
        return isValueEmpty(url.searchParams.get('app_version')) ? "" : url.searchParams.get('app_version').toUpperCase();
    },
    getDeviceId : function () {
        const url = new URL(location.href);
        return isValueEmpty(url.searchParams.get('device_id')) ? "" : url.searchParams.get('device_id').toUpperCase();
    },
    getURL : function () {
        const url = new URL(location.href);
        return url.pathname + url.search;
    },
    getIsRecoomendedVersion : function (checkVersion) {
        let isRecoomedVersion = false;
        if (isValueEmpty(this.getAppVersion()) == false) {
            let appVersion = this.getAppVersion();
            appVersion = appVersion.indexOf('(') > -1 ? appVersion.substring(0, appVersion.indexOf('(')) : appVersion;
            let recoomendedVersionArray = checkVersion.split('.');
            let appVersionArray =  appVersion.split('.');
            if (appVersionArray.length > 0) {
                let appVersionInt = (Number(appVersionArray[0]) * 10000) + (Number(appVersionArray[1]) * 100) + Number(appVersionArray[2]);
                let recoomendedVersion = (Number(recoomendedVersionArray[0]) * 10000) + (Number(recoomendedVersionArray[1]) * 100) + Number(recoomendedVersionArray[2]);
                if (appVersionInt >= recoomendedVersion) {
                    isRecoomedVersion = true;
                }
                return isRecoomedVersion;
            } else {
                return isRecoomedVersion;
            }
        } else {
            return isRecoomedVersion;
        }
    },
    getDeeplink : function () {
        //return "https://zocbo.onelink.me/ZU3M?af_xp=custom&pid=zocbo&c=launch&af_dp=zocbo://viewer&af_force_deeplink=true&type=3&keepSC=1";
		return "https://link.zocbo.com/runApp/?type=3&keepSC=1";
    },
    goWebToApp : function (menu_nm) {
        location.href = "/app/goWebToApp.asp?menu_nm=" + menu_nm;
    },
    goWebToAppRedirect : function (url) {
        location.href = url;
    },
    ARRAY_APP_RETURN_PAGE_URL_BY_MEMBER : new Array ("FIND_ID", "FIND_PWD"),
    //브라우저에서 앱활성화 시킬때 호출
    goAppActivation : function() {
        //로그인 토근 조회
        comm.send("/_api/member.api.asp", "cmd=GET_ACCESS_TOKEN", "get", function(mData){
            if (mData.rstVal == 0) {
                if (appCLS.ARRAY_APP_RETURN_PAGE_URL_BY_MEMBER.includes(storage.getSession(storage.APP_RETURN_PAGE_URL))) {
                    location.href = "https://link.zocbo.com/runApp/?type=3&keepSC=0&access=" + mData.access_token;
                } else {
                    location.href = "https://link.zocbo.com/runApp/?type=3&keepSC=1&access=" + mData.access_token + "&url=" + storage.getSession(storage.APP_RETURN_PAGE_URL);
                }
            } else {
                if (appCLS.ARRAY_APP_RETURN_PAGE_URL_BY_MEMBER.includes(storage.getSession(storage.APP_RETURN_PAGE_URL))) {
                    location.href = "https://link.zocbo.com/runApp/?type=3&keepSC=1";
                } else {
                    location.href = "https://link.zocbo.com/runApp/?type=3&keepSC=1&url=" + storage.getSession(storage.APP_RETURN_PAGE_URL);
                }
            }
        });
    },
    goToLogin : function() {
        appCLS.goInOutLink({"action" : "goToLogin"});
    },
    logout : function() {
        appCLS.goInOutLink({"action" : "logout"});
    },
	forceLogout : function(reasonMsg) {//강제 로그아웃 기능
        appCLS.goInOutLink({"action" : "forceLogout", "reasonMsg" : reasonMsg});
    },
    finishWebView : function() {
        appCLS.goInOutLink({"action" : "finishWebView"});
    },
    webviewClose : function() {
        appCLS.goInOutLink({"action" : "webviewClose"});
    },
    goToHome : function() {
        appCLS.goInOutLink({"action" : "goToHome"});
    },
    headerInnfo : function(menu_nm, menu_type) {
        appCLS.goInOutLink({"action" : "headerInnfo", "menu_nm" : menu_nm, "menu_type" : menu_type});
    },
    goWebViewLink : function(menu_nm, url, captureProtection) {		
		if (appCLS.getIsRecoomendedVersion(appCLS.getHeaderRecoomendedVersion())) {
			menu_nm = "";		// 헤더 타이틀 깜빡이는 노출 때문에 임시 주석 테스트
		}

		if (appCLS.getIsRecoomendedVersion(appCLS.getCaptureProtectionRecoomendedVersion())) {
            appCLS.goInOutLink({"action" : "goWebViewLink", "menu_nm" : menu_nm, "url" : url, "captureProtection" : captureProtection});
        } else {
            appCLS.goInOutLink({"action" : "goWebViewLink", "menu_nm" : menu_nm, "url" : url});
        }        
    },
    goPushSystem : function() {
        appCLS.goInOutLink({"action" : "goPushSystem"});
    },
    goToSearch : function() {
        appCLS.goInOutLink({"action" : "goToSearch"});
    },
    goToViewer : function(fileType, exPaprNo, shortUrl, pk, showAnswer) {
        if (appCLS.getIsRecoomendedVersion(appCLS.getInterfaceJsonRecoomendedVersion())) {
            appCLS.goInOutLink({"action": "goToViewer", "exPaprNo": exPaprNo, "fileType": fileType, "shortUrl": shortUrl, "pk": pk, "showAnswer": (isValueEmpty(showAnswer)) ? false : showAnswer});
        } else {
            appCLS.goInOutLink({"action": "goToViewer", "exPaprNo": exPaprNo, "fileType": fileType, "shortUrl": shortUrl, "pk": pk});
        }        
    },
    goToFilter : function(selectedDate, menuCD, subjCode, grade) {
        appCLS.goInOutLink({"action" : "goToFilter", "selectedDate" : selectedDate, "menuCD" : menuCD, "subjCode" : subjCode, "grade" : grade});
    },
    goToBrowser : function(url) {
        if (isValueEmpty( this.getOS()) == false) {
            if (url.indexOf("?") == -1) {
                url = url + "?return_page_url=APP";
                url = url + "&app_return_page_url=" + appCLS.getURL();
            } else {
                url = url + "&return_page_url=APP";
                url = url + "&app_return_page_url=" + appCLS.getURL();
            }
            appCLS.goInOutLink({"action" : "goToBrowser", "url" : url, "isFullUrl" : 0});
        } else {
            location.href = url;
        }
    },
    goToBrowserAndFinish : function(url, isExternal, goHome) {
        if (url.indexOf("?") == -1) {
            url = url + "?return_page_url=APP";
            url = url + "&app_return_page_url=" + appCLS.getURL();
        } else {
            url = url + "&return_page_url=APP";
            url = url + "&app_return_page_url=" + appCLS.getURL();
        }
        appCLS.goInOutLink({"action" : "goToBrowserAndFinish", "url" : url, "isExternal" : isExternal, "goHome" : goHome});
    },
    goToOutBrowser : function(url, domainCD, isTablet) {
        let isFullUrl = appCLS.IS_FULL_URL_CD.사용;
        let domain = commonGLB.getDomain(domainCD);
        let mUrl = commonGLB.getMappingURL(url);
        let goUrl = domain + mUrl;
        if (isValueEmpty(domain)) {
            isFullUrl = appCLS.IS_FULL_URL_CD.미사용;
        }
        if (commonGLB.IS_TABLET_CD.사용 == isTablet && commonGLB.isTablet() == false) {
            isFullUrl = appCLS.IS_FULL_URL_CD.미사용;
            goUrl = url;
        }
        if (commonGLB.getIsInAppURL(mUrl)) {
            appCLS.goWebViewLink(commonGLB.getInAppURLTitle(mUrl), mUrl);
        } else {
            appCLS.goInOutLink({"action" : "goToBrowser", "url" : goUrl, "isFullUrl" : isFullUrl});
        }
    },
    goToAnalyze : function(menu_nm, txCode, exPaprNo) {
        appCLS.goInOutLink({"action" : "goToAnalyze", "menu_nm" : menu_nm, "txCode" : txCode, "exPaprNo" : exPaprNo});
    },
    goPreviousExam : function() {
        appCLS.goInOutLink({"action" : "goPreviousExam"});
    },
    changedUserInfo : function() {
        appCLS.goInOutLink({"action" : "changedUserInfo"});
    },
    goPushSetting : function() {
        appCLS.goInOutLink({"action" : "goPushSetting"});
    },
	goWebViewerSetting : function(viewerWidth, viewerHeight, examHeight, questionHeight) {		
        appCLS.goInOutLink({"action" : "goWebViewerSetting", "viewerWidth" : viewerWidth, "viewerHeight" : viewerHeight, "examHeight" : examHeight, "questionHeight" : questionHeight});		
    },
    openFolder : function() {
        appCLS.goInOutLink({"action" : "openFolder"});
    },
    activateNextTipById : function(tipId) {
        appCLS.goInOutLink({"action" : "activateNextTipById", "id" : tipId});
    },
    headerInfo : function(title, showBack, callback, rIcons) { // 컨텐츠 리스트 외 
        if (appCLS.getIsRecoomendedVersion(appCLS.getHeaderRecoomendedVersion())) {
            appCLS.goInOutLink({"action" : "headerInfoV2", "title" : title, "showBack" : showBack, "needBackCallback" : callback, "rIcons": rIcons, "showHamburger": false });
        } else {
            if (appCLS.getIsRecoomendedVersion(appCLS.getInternalizationRecoomendedVersion())) {
                appCLS.goInOutLink({"action" : "newHeaderInfo", "title" : title, "showBack" : showBack, "needBackCallback" : callback, "rIcons": rIcons});
            } else {
                appCLS.headerInnfo(title, 0);
            }
        }
    },
    newHeaderInfo : function(title, showBack, callback, rIcons, showHamburger) {  // 컨텐츠 리스트
        if (appCLS.getIsRecoomendedVersion(appCLS.getHeaderRecoomendedVersion())) {
            appCLS.goInOutLink({"action" : "headerInfoV2", "title" : title, "showBack" : showBack, "needBackCallback" : callback, "rIcons": rIcons, "showHamburger": showHamburger });
        } else {
            appCLS.headerInfo(title, showBack, callback, rIcons);
        }
    },
    setSiteID : function(siteId) {
        appCLS.goInOutLink({"action" : "setSiteId", "siteId" : siteId});
    },
    callKakaoShare : function(param) { //공통 카카오 JS 추가가 필요함.
        if (appCLS.getIsRecoomendedVersion(appCLS.getInternalizationRecoomendedVersion())) {
            appCLS.goInOutLink({"action" : "callKakaoShare", "message" : param.description, "btnText" : param.btnText, "linkUrl" : param.linkUrl, "doDeepLink" : param.doDeepLink});
        } else {
            kakaoCLS.init(param.title, param.description, param.image, param.linkUrl, param.linkUrl, param.btnText, 'text');
        }
    },
    changeWebUrl : function(url) {
        appCLS.goInOutLink({"action" : "changeWebUrl", "changedUrl" : url});
    },
    requestFile : function(gubun, count) {
        if (appCLS.getIsRecoomendedVersion(appCLS.getHapticRecoomendedVersion())) {
            appCLS.goInOutLink({"action" : "requestFile", "type" : gubun, "maxCount": count, "maxSize" : appCLS.MAX_FILE_SIZE});
        } else {
            appCLS.goInOutLink({"action" : "requestFile", "type" : gubun, "maxCount": count});
        }

    },
    requestFileV2 : function(gubun, count, accept, format) {
        appCLS.goInOutLink({"action" : "requestFile", "type" : gubun, "maxCount": count, "maxSize" : accept == "video" ? appCLS.VIDEO_MAX_FILE_SIZE : appCLS.MAX_FILE_SIZE, "accept" : accept, "format" : format});
    },
    showImageViewer : function(url) {
        appCLS.goInOutLink({"action" : "showImageViewer", "imageUrl" : url});
    },
    tipPlayMode : function() {
        appCLS.goInOutLink({"action" : "tipPlayMode"});
    },
    goToIAP : function(webUrl) {		
        appCLS.goInOutLink({"action" : "goToIAP", "url" : webUrl});
    },
    goToContentList : function (url) {
        appCLS.goInOutLink({"action" : "goToContentList", "url" : url});
    },
	purchase : function(itemId, payCode) {		
        appCLS.goInOutLink({"action" : "purchase", "itemId" : itemId, "payCode" : payCode});
    },
	webBottomSheetClose : function() {
        appCLS.goInOutLink({"action" : "webBottomSheetClose"});
    },
	alertMsgAfterKakaoShare : function(message) {
		appCLS.goInOutLink({"action" : "alertMsgAfterKakaoShare", "message" : message});
	},
	webViewHeight : function(viewHeight) {
		appCLS.goInOutLink({"action" : "webViewHeight", "viewHeight" : viewHeight});
	},
	goToMiniVideoPlayer : function(videoUrl, title) {
		appCLS.goInOutLink({"action" : "goToMiniVideoPlayer", "videoUrl" : videoUrl, "title" : title});
	},
    goVodLayer : function(vodUrl, vodTitle, vodType, mappingKey, defaultIndex, isFullScreen) {		
        if (appCLS.getIsRecoomendedVersion(appCLS.getVideoRecoomendedVersion())) {
             appCLS.goInOutLink({"action" : "goToVideoPlayer", "videoUrl" : vodUrl, "title" : vodTitle, "vodType" : vodType, "mappingKey" : mappingKey, "defaultIndex" : defaultIndex, "isFullScreen" : isFullScreen});
        } else {
            appCLS.goInOutLink({"action" : "goToVideoPlayer", "videoUrl" : vodUrl, "title" : vodTitle, "vodType" : vodType, "mappingKey" : mappingKey, "defaultIndex" : defaultIndex});
        }
    },
    goHaptic : function(){
        appCLS.goInOutLink({"action" : "vibrationAlert", "step" : "high"});
    },
    showAnswer : function() {
        appCLS.goInOutLink({"action" : "showAnswer"});
    },
    setCaptureProtection : function(captureProtection) {		
        appCLS.goInOutLink({"action" : "setCaptureProtection", "protectionStatus" : captureProtection});
    },
    callOsShare : function(title, deepLink) {
        appCLS.goInOutLink({"action" : "callOsShare", "title" : title, "deepLink" : deepLink});
    },
    requestSystemPushStatus : function() {
        if (appCLS.getIsRecoomendedVersion(appCLS.getAlarmRecoomendedVersion())) {
            appCLS.goInOutLink({"action" : "requestSystemPushStatus"});
        }
    },
    requestViewerData : function() {
        if (appCLS.getIsRecoomendedVersion(appCLS.getViewerDataRecoomendedVersion())) {
            appCLS.goInOutLink({"action" : "requestViewerData"});
        }
    },
    cancelVideoUpload : function() {
        appCLS.goInOutLink({"action" : "cancelVideoUpload"});
    },
    requestVideoUpload : function(url, idx, path) {
        appCLS.goInOutLink({"action" : "requestVideoUpload", "url" : url, "idx" : idx, "path" : path});
    },
    versionUpdate : function(isForce) {
        appCLS.goInOutLink({"action" : "versionUpdate", "isForce" : isForce});
    },
    goInOutLink : function(param) {
        let appOS = this.getOS();
        if (isValueEmpty(param.menu_nm)) param.menu_nm = "";
        if (isValueEmpty(param.action)) param.action = this.getDefaultAction();
        if (isValueEmpty(param.shortUrl)) param.shortUrl = "";
        if (isValueEmpty(param.pk)) param.pk = "";

        if (isValueEmpty(appOS) == false) {
            if (appOS == this.getAOS()) {
                this.goAOS(param);
            } else if (appOS == this.getIOS()) {
                this.goIOS(param);
            }
        } else {
            if (isValueEmpty(param.url) == false) {
                location.href = param.url;
            }
        }
	},
    //AOS 는 param을 맞춰주지 않으면 오류 발생함.
    goAOS : function(param) {
        try {
            switch (param.action.toUpperCase()) {
                case "LOGOUT":
                    window.zocbostudyaos.logout();
                    break;
				case "VIBRATIONALERT":
                    window.zocbostudyaos.vibrationAlert(JSON.stringify({step: param.step}));
                    break;
                case "FORCELOGOUT":
                    window.zocbostudyaos.forceLogout(JSON.stringify({reasonMsg: param.reasonMsg}));
                    break;
                case "GOTOLOGIN":
                    window.zocbostudyaos.goToLogin();
                    break;
                case "FINISHWEBVIEW":
                    window.zocbostudyaos.finishWebView();
                    break;
                case "WEBVIEWCLOSE":
                    window.zocbostudyaos.webviewClose();
                    break;
                case "GOTOHOME":
                    window.zocbostudyaos.goToHome();
                    break;
                case "HEADERINNFO":
                    window.zocbostudyaos.headerInnfo(param.menu_nm, param.menu_type);
                    break;
                case "GOWEBVIEWLINK":
					if (appCLS.getIsRecoomendedVersion(appCLS.getCaptureProtectionRecoomendedVersion())) {
                        window.zocbostudyaos.goWebViewLink(JSON.stringify({
                                                                        headerTitle: param.menu_nm,
                                                                        webUrl: param.url,
                                                                        captureProtection: param.captureProtection
                                                                    }));
                    } else {
                        window.zocbostudyaos.goWebViewLink(param.menu_nm, param.url);
                    }
                    break;
                case "GOPUSHSYSTEM":
                    window.zocbostudyaos.goPushSystem();
                    break;
                case "GOTOSEARCH":
                    window.zocbostudyaos.goToSearch();
                    break;
                case "GOTOVIEWER":
                    if (appCLS.getIsRecoomendedVersion(appCLS.getInterfaceJsonRecoomendedVersion())) {
                        window.zocbostudyaos.goToViewer(JSON.stringify({
                                                                        exPaprNo: param.exPaprNo,
                                                                        fileType: param.fileType,
                                                                        shortUrl: param.shortUrl,
                                                                        pk: param.pk,
                                                                        showAnswer: param.showAnswer,
                                                                    }));
                    } else {
                        window.zocbostudyaos.goToViewer(param.exPaprNo, param.fileType, param.shortUrl, param.pk);
                    }
                    break;
                case "GOTOFILTER":
                    window.zocbostudyaos.goToFilter(param.selectedDate, param.menuCD, param.subjCode, param.grade);
                    break;
                case "GOTOBROWSER":
                    window.zocbostudyaos.goToBrowser(param.url);
                    break;
                case "GOTOANALYZE":
                    window.zocbostudyaos.goToAnalyze(param.menu_nm, param.txCode, param.exPaprNo);
                    break;
                case "GOPREVIOUSEXAM":
                    window.zocbostudyaos.goPreviousExam();
                    break;
                case "CHANGEDUSERINFO":
                    window.zocbostudyaos.changedUserInfo();
                    break;
                case "GOPUSHSETTING":
                    window.zocbostudyaos.goPushSetting();
                    break;
				case "GOWEBVIEWERSETTING":
                    window.zocbostudyaos.goWebViewerSetting(param.viewerWidth, param.viewerHeight, param.examHeight, param.questionHeight);
                    break;
                case "OPENFOLDER":
                    window.zocbostudyaos.openFolder();
                    break;
				case "GOTOOUTERBROWSER":
                    window.zocbostudyaos.goToOuterBrowser(param.url);
                    break;
                case "ACTIVATENEXTTIPBYID":
                    window.zocbostudyaos.activateNextTipById(param.id);
                    break;
                case "NEWHEADERINFO":
                    window.zocbostudyaos.newHeaderInfo(param.title, param.showBack, param.needBackCallback, JSON.stringify(param.rIcons));
                    break;
                case "SETSITEID":
                    window.zocbostudyaos.setSiteId(param.siteId);
                    break;
                case "CALLKAKAOSHARE":
                    window.zocbostudyaos.callKakaoShare(param.message, param.btnText, param.linkUrl, param.doDeepLink);
                    break;
                case "CHANGEWEBURL":
                    window.zocbostudyaos.changeWebUrl(param.changedUrl);
                    break;
                case "REQUESTFILE":
                    if (appCLS.getIsRecoomendedVersion(appCLS.getHapticRecoomendedVersion())) {
                        window.zocbostudyaos.requestFile(JSON.stringify({
                                                                        type: param.type,
                                                                        maxCount: param.maxCount,
                                                                        maxSize: param.maxSize,
                                                                        accept : param.accept,
                                                                        format : param.format,
                                                                    }));
                    } else {
                        window.zocbostudyaos.requestFile(param.type, param.maxCount);
                    }
                    break;
                case "SHOWIMAGEVIEWER":
                    window.zocbostudyaos.showImageViewer(param.imageUrl);
                    break;
                case "GOTOBROWSERANDFINISH":
                    window.zocbostudyaos.goToBrowserAndFinish(param.url, param.isExternal, param.goHome);
                    break;
                case "TIPPLAYMODE":
                    window.zocbostudyaos.tipPlayMode();
                    break;
				case "WEBBOTTOMSHEETCLOSE":
                    window.zocbostudyaos.webBottomSheetClose();
                    break;
				case "ALERTMSGAFTERKAKAOSHARE":                    
					window.zocbostudyaos.alertMsgAfterKakaoShare(JSON.stringify({message: param.message}));
                    break;
                case "WEBVIEWHEIGHT":                    
					window.zocbostudyaos.webViewHeight(JSON.stringify({viewHeight: param.viewHeight}));
                    break;
                case "GOTOMINIVIDEOPLAYER":                    
					window.zocbostudyaos.goToMiniVideoPlayer(JSON.stringify({videoUrl: param.videoUrl, title: param.title}));
                    break;
                case "GOTOVIDEOPLAYER":
                    if (appCLS.getIsRecoomendedVersion(appCLS.getVideoRecoomendedVersion())) { // 동영상 업로드 버전부터는 전체화면 파라미터 추가됨
                        window.zocbostudyaos.goToVideoPlayer(JSON.stringify({
																		videoUrl: param.videoUrl,
																		title: param.title,
																		vodType: param.vodType,
																		mappingKey: param.mappingKey,
                                                                        defaultIndex: param.defaultIndex,
                                                                        isFullScreen : param.isFullScreen,
																	}));
                    } else {
                        window.zocbostudyaos.goToVideoPlayer(JSON.stringify({
																		videoUrl: param.videoUrl,
																		title: param.title,
																		vodType: param.vodType,
																		mappingKey: param.mappingKey,
                                                                        defaultIndex: param.defaultIndex,
																	}));
                    }
                    break;
                case "HEADERINFOV2":                    
					window.zocbostudyaos.newHeaderInfo(param.title, param.showBack, param.needBackCallback, JSON.stringify(param.rIcons), param.showHamburger);
                    break;
                case "GOTOCONTENTLIST" : 
                    window.zocbostudyaos.goToContentList(JSON.stringify({webUrl : param.url}));
                    break;
                case "SHOWANSWER":
                    window.zocbostudyaos.showAnswer();
                    break;
                case "VERSIONUPDATE":
                    window.zocbostudyaos.versionUpdate(param.isForce);
                    break;
                default : 
                    window.zocbostudyaos.callbackHandler(
						JSON.stringify({
							callType: param.action,
							params: {
                                title : param.title,
								deepLink : param.deepLink,
								protectionStatus : param.protectionStatus,
                                url : param.url,
                                idx : param.idx,
                                path : param.path,
							}
						})
					);
                    break;
            }
        } catch {	
            alert("일시적인 오류가 발생하고 있습니다.\n 다시 실행 부탁 드립니다.");
        }
    },
    //IOS 는 param을 맞춰주지 않아도 오류 발생하지 않음
    goIOS : function(param) {
        switch (param.action.toUpperCase()) {
            case "HEADERINNFO":
                window.webkit.messageHandlers.callbackHandler.postMessage({
                    callType: param.action,
                    params: {
                        headerTitle : param.menu_nm,
                        headerType : param.menu_type
                    }
                });
                break;
            case "NEWHEADERINFO":
                window.webkit.messageHandlers.callbackHandler.postMessage({
                    callType: param.action,
                    params: {
                        title : param.title,
                        showBack : param.showBack,
                        needBackCallback : param.needBackCallback,
                        rIcons : param.rIcons,
                    }
                });
                break;
            case "HEADERINFOV2":
                window.webkit.messageHandlers.callbackHandler.postMessage({
                    callType: "newHeaderInfo",
                    params: {
                        title : param.title,
                        showBack : param.showBack,
                        needBackCallback : param.needBackCallback,
                        rIcons : param.rIcons,
                        showHamburger : param.showHamburger,
                    }
                });
                break;
            case "GOTOCONTENTLIST":
                window.webkit.messageHandlers.callbackHandler.postMessage({
                    callType: "goToContentList",
                    params: {
                        webUrl : param.url,
                        data: JSON.stringify({
							webUrl : param.url,
						}),
                    }
                });
                break;
            default:                
                window.webkit.messageHandlers.callbackHandler.postMessage({
                    callType: param.action,
                    params: {
                        headerTitle: param.menu_nm,
                        webUrl: param.url,
                        exPaprNo: param.exPaprNo,
                        fileType: param.fileType,
                        selectedDate: param.selectedDate,
                        menuCD: param.menuCD,
                        subjCode: param.subjCode,
                        grade: param.grade,
                        txCode: param.txCode,
                        shortUrl: param.shortUrl,
                        pk: param.pk,
                        isFullUrl: param.isFullUrl,
                        viewerWidth: param.viewerWidth,
                        viewerHeight: param.viewerHeight,
                        examHeight: param.examHeight,
                        questionHeight: param.questionHeight,
                        id: param.id,
                        siteId: param.siteId,
                        message: param.message,
                        btnText: param.btnText,
                        linkUrl: param.linkUrl,
                        doDeepLink: param.doDeepLink,
                        changedUrl: param.changedUrl,
                        type: param.type,
                        imageUrl: param.imageUrl,
                        maxCount: param.maxCount,
                        captureProtection: param.captureProtection,
                        isExternal: param.isExternal,
                        goHome: param.goHome,
                        itemId: param.itemId,
                        payCode: param.payCode,
                        showAnswer: param.showAnswer,                        
                        videoUrl: param.videoUrl,
                        title: param.title,
                        vodType: param.vodType,
                        mappingKey: param.mappingKey,
                        defaultIndex: param.defaultIndex,                        
                        viewHeight: param.viewHeight,
                        reasonMsg: param.reasonMsg,
                        step: param.step,                        
                        maxSize: param.maxSize,
                        protectionStatus : param.protectionStatus,
                        deepLink : param.deepLink,
                        type: param.type,
                        maxCount: param.maxCount,
                        maxSize: param.maxSize,
                        accept : param.accept,
                        format : param.format,
                        url : param.url,
                        idx : param.idx,
                        path : param.path,
                        isFullScreen : param.isFullScreen,
                        isForce : param.isForce,
                        data: JSON.stringify({
                            /* 하위 추가 및 값 할당 금지 (4.0.0) 에서 오류 발생 */
                            videoUrl: param.videoUrl,
                            title: param.title,
                            vodType: param.vodType,
                            mappingKey: param.mappingKey,
                            defaultIndex: param.defaultIndex,
                            message: param.message,
                            viewHeight: param.viewHeight,
                            reasonMsg: param.reasonMsg,
                            step: param.step, 
                            type: param.type,
                            maxCount: param.maxCount,
                            maxSize: param.maxSize,
                        }),
                    }
                });
                
        }
    },
};

// 뷰어 APP 돌아가기 함수 (테스트)
jQuery(document).ready(function() {
	appCLS.setViewAppGo();

    // 세션아이디 쿠키 삭제	
	if(TRK_GLB_USER_ID == "" || TRK_GLB_USER_ID == -1) {		
		(function() {
			var cookies = document.cookie.split("; ");
			for (var i = 0; i < cookies.length; i++) {
				var name = cookies[i].split("=")[0];
				if (name.indexOf("ASPSESSIONID") === 0) {
					document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
				}
			}
		})();
	}

    /*if(appCLS.getAppYn() == "APP") {		
		$('a').on('click', function(event) {
			let href = $(this).attr('href');
			if (href && href.indexOf('javascript:') === -1 && href.indexOf('#') !== 0) {
				event.preventDefault(); // 기본 이동 방지
				let separator = href.includes('?') ? '&' : '?';
				window.location.href = href + separator + 'return_page_url=APP';
			}
		});
	}*/
});