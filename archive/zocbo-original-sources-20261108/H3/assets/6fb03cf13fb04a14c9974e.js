const commonLayerPopupCLS = {
    initSkyTabRepaymentLayerPopup : function () {  //스카이탭 재결제 팝업 초기화
		commonLayerPopupCLS.loadSkyTabExpiredTicketInfo();
	},
	loadSkyTabExpiredTicketInfo : function () {
		jQuery.ajax({
			type : "GET",
			dataType:'json',
			url : "/payment/Ajax/getSkyTabExpiredTicketInfoAjax.asp",
			success: function(responseJson) {
				if (responseJson.RESULT == "false") {
					let code = Number(responseJson.RESULT_CODE);
					switch (code) {
						case commonGLB.PRODUCT_ERROR_CONFIG.미로그인.CODE:
							loginPop.show("", _rtnUrl, false);
							break;
					}
				} else {
					commonLayerPopupCLS.setSkyTabExpiredTicketInfo(responseJson.TICKET_LIST);
				}
			}, error: function(request, exception) {
				return false;
			}
		});
	},
	setSkyTabExpiredTicketInfo : function (jsonData) {
		let html 		= "";
		let footerHtml 	= "";

		jQuery.each(jsonData, function (seq, item) {
			let ischecked 	= "";
			html += templateReplace(jQuery("#hidden-common-popup-skytab-expired-ticket-item-template").html(), [item.PRODUCT_CD, ischecked, item.SUBJECT_NM, item.TICKET_INFO, item.REMAINING_TUTORING_COUNT, item.END_DT, item.PAY_NO, item.REMAIN_DAY]);
		});
		jQuery("#SKY_TAB_EXTEND_LAYER_POPUP_BODY").html(html);
		// jQuery("#SKY_TAB_EXTEND_LAYER_POPUP").addClass('is-active');

		const $popup = jQuery("#SKY_TAB_EXTEND_LAYER_POPUP");

		$popup.addClass("is-active");

		$popup.find(".bottomSheet__backdrop")
			.removeClass("is-fadeOut")
			.addClass("is-fadeIn");

		$popup.find(".bottomSheet__content")
			.removeClass("is-slideDown")
			.addClass("is-slideUp");

		scrollLock();
	},
	issueDiscountCoupon : function (item) {
		if (jQuery("input[name='common_popup_skytab_extend_ticket']").is(":checked")) {
			let productCD 				= jQuery("input[name='common_popup_skytab_extend_ticket']:checked").val();
			let extensionServicePeriod 	= jQuery("input[name='common_popup_skytab_extend_ticket']:checked").attr("EXTENSION_SERVICE_PERIOD");
			jQuery.ajax({
				type : "GET",
				dataType:'json',
				url : "/payment/Ajax/setCouponAndBasketAjax.asp",
				data: {
                    CT_NO  		: "921", // 스카이탭 할인 쿠폰
					productCD 	: productCD,
					paySvc 		: "ZL",
					PAY_NO : jQuery("input[name='common_popup_skytab_extend_ticket']:checked").attr("PAY_NO")
                }, 
				success: function(responseJson) {
					if (responseJson.RESULT == "false") {
						let code = Number(responseJson.RESULT_CODE);
						switch (code) {
							case commonGLB.PRODUCT_ERROR_CONFIG.미로그인.CODE:
								loginPop.show("", _rtnUrl, false);
								break;
							case commonGLB.PRODUCT_ERROR_CONFIG.준회원.CODE:
								alert(commonGLB.PRODUCT_ERROR_CONFIG.준회원.MESSAGE);
								break;
						}
					} else {
						bottomSheetClose(item);

						let data_v = "mode=I";
						data_v += "&pcode=" + productCD;
						data_v += "&Pay_Svc=ZB";
						data_v += "&packageCD=";

						_h.cookie.set("paymentCode", data_v, 1); 
						_h.cookie.set("cloud_Mapping_Code", null, 1);

						storage.setSession(storage.PRODUCT_BY_SELECTED_SITE_ID, productCD.split(",")[0]);
						storage.setSession(storage.PRODUCT_BY_ZOCBO, productCD);
						storage.setSession(storage.PRODUCT_BY_EXTENSION_SERVICE_PERIOD, extensionServicePeriod);
						storage.setSession(storage.PRODUCT_BY_SELECTED_CATEGORY_CD, "0000100002");

						location.href = "/payment/payment.asp?mode=I";
					}
				}, error: function(request, exception) {
					return false;
				}
			});
		} else {
			alert("연장구매대상 상품을 선택해주세요.");
			return false;
		}
	},
	goSkytabPayment : function () {
		location.href = "/payment/learning_product.asp?categoryCD=0000100002&repaymentLayerPopup=N";
	},
}