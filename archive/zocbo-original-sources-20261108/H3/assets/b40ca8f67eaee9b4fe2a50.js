const hijackingCLS = {
    COMMON_PAGE_HIJACKING_POPUP_PASS : false,
    COMMON_PAGE_HIJACKING_POPUP_TRACK_CD : "",
    init : function (trackCD) {
        //트레킹 팝업 뷰 코드
        hijackingCLS.COMMON_PAGE_HIJACKING_POPUP_TRACK_CD = trackCD;
        document.addEventListener('click', (e) => {
			if (hijackingCLS.COMMON_PAGE_HIJACKING_POPUP_PASS == false) {
				if (jQuery(e.target).parents('.COMMON_GLB_PAGE_OUT_CHECK_TARGET').length > 0 && jQuery(e.target).parents('.COMMON_GLB_PAGE_OUT_NOT_CHECK_TARGET').length == 0) {
					if (e.target.toString().indexOf('javascript') > -1 || e.target.toString().indexOf('https://') > -1 ) {
						hijackingCLS.getPopupView(e, "");
						e.preventDefault();
					} else if (e.target.className.toString().indexOf('COMMON_GLB_LOGO') > -1 || (isValueEmpty(e.target.className.baseVal) == false && e.target.className.baseVal.toString().indexOf('COMMON_GLB_LOGO') > -1)){
						hijackingCLS.getPopupView(e, "home");
						
						e.preventDefault();
					} else if (e.target.className.toString().indexOf('COMMON_GLB_FULL_MENU') > -1 || (isValueEmpty(e.target.className.baseVal) == false && e.target.className.baseVal.toString().indexOf('COMMON_GLB_FULL_MENU') > -1)){
						hijackingCLS.getPopupView(e, "fullMenu");
						
						e.preventDefault();
						e.stopPropagation();     // 이벤트 전파 차단
    					return false;
					} else if (e.target.className.toString().indexOf('COMMON_GLB_PAYMENT') > -1 || (isValueEmpty(e.target.className.baseVal) == false && e.target.className.baseVal.toString().indexOf('COMMON_GLB_PAYMENT') > -1)){
						hijackingCLS.getPopupView(e, "payment");
						
						e.preventDefault();
						e.stopPropagation();     // 이벤트 전파 차단
    					return false;
					} else if (e.target.className.toString().indexOf('COMMON_GLB_MY_PAGE') > -1 || (isValueEmpty(e.target.className.baseVal) == false && e.target.className.baseVal.toString().indexOf('COMMON_GLB_MY_PAGE') > -1)){
						hijackingCLS.getPopupView(e, "mypage");
						
						e.preventDefault();
						e.stopPropagation();     // 이벤트 전파 차단
    					return false;
					}
				}
			}
		}, true);
    },
    goReturnPageUrl : function () {
		let page = jQuery("#GLB_PAGE_HIJACKING_LINK").val();
        let type = jQuery("#GLB_PAGE_HIJACKING_STEP").val(); 
		jQuery('#pageout-popup').removeClass('active');

		if (type == "fullMenu") {
			jQuery("#section").hide();
			jQuery('#fullMenu').addClass('active');
		} else {
			location.href = page;
		}
	},
	getPopupView : function (e, type) {
		jQuery("#GLB_PAGE_HIJACKING_STEP").val(type);
		if (type == "home") {
			jQuery("#GLB_PAGE_HIJACKING_LINK").val("/");
        } else if (type == 'fullMenu'){
		    jQuery("#GLB_PAGE_HIJACKING_LINK").val("/");
		} else if (type == 'payment'){
		    jQuery("#GLB_PAGE_HIJACKING_LINK").val("/payment/");
		} else if (type == 'mypage'){
		    jQuery("#GLB_PAGE_HIJACKING_LINK").val("/MyPage/myPage.asp");
		} else {
			jQuery("#GLB_PAGE_HIJACKING_LINK").val(e.target);
		}

		trkCLS.setExternalEvent(commonGLB.COMMON_PAGE_HIJACKING_POPUP_TRACK_CD, "");
		jQuery("#pageout-popup").addClass('active');
	},
};