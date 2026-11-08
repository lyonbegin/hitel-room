const examCLS = {
    examIntervalID : "",
    examTimer : false,
	noAuthAuthorityInfo : null,
    menuByNoSharePopupList: ["000010000300010","000020000600001","000020000600002","000020000700001","000020000700002","000020000700003","000020000800001","000020000800002","000020000800003","000020000800004","000020000800005","000020000800006"], // 수프링, E단원평가
    rootMenuByNoSharePopupList: ["0000100006", "0000100007", "0000100008", "0000200009", "0000200010", "0000200011", "0000200012"],
	marketing_chk : false,
	share_btn_name : "공유하고 무료 다운",
	goDownLayer : function (selectedItem, downFlag, expaprNo, isGeneratingBar, representativeExpaprNo, vodNo) {
        if (TRK_GLB_IS_LOGIN == false) {
            examCLS.setNotLogin();
        } else {
            storage.setSession(storage.DOWN_FLAG, downFlag);
            storage.setSession(storage.EXPAPR_NO, expaprNo);
            storage.setSession(storage.REPRESENTATIVE_EXPAPR_NO, representativeExpaprNo);
            storage.setSession(storage.VOD_NO, vodNo);
            storage.setSession(storage.EXPAPER_FILE_GROUP_LIST, commonCLS.EXPAPER_FILE_GROUP_CD.PDF.CD);
            examCLS.goDownAuthorityCheck(isGeneratingBar, selectedItem);
        }
    },
	goDownAuthorityCheck : function (isGeneratingBar, selectedItem) {
		if (TRK_GLB_MEM_GROUP == "T") {
			examCLS.share_btn_name = "공유하고 무료 편집";
		}

        jQuery.ajax({
			type : "GET",
			dataType:'json',
			url : commonCLS.URL.다운로드권한체크,
			data: {
				"menuCD": commonGLB.getMenuCD(),
				"downFlag": commonCLS.getDownFlag(),
				"expaprNo": commonCLS.getExpaprNo(),
                "representativeExpaprNo": commonCLS.getRepresentativeExpaprNo(),
				"vodNo": commonCLS.getVodNo(),
			},
            success: function(responseJson) {
                if (responseJson.RESULT == "false") {
                    let code = Number(responseJson.RESULT_CODE);
                    switch (code) {
                        case commonCLS.EXPAPER_AUTHORITY_ERROR.미로그인.CD:
                            examCLS.setNotLogin();
                            break;
                        case commonCLS.EXPAPER_AUTHORITY_ERROR.필수값누락.CD:
                            alert(commonCLS.EXPAPER_AUTHORITY_ERROR.필수값누락.MSG);
                            break;
                        case commonCLS.EXPAPER_AUTHORITY_ERROR.시험지정보없음.CD:
                            alert(commonCLS.EXPAPER_AUTHORITY_ERROR.시험지정보없음.MSG);
                            break;
                        case commonCLS.EXPAPER_AUTHORITY_ERROR.시험지상세정보없음.CD:
                            alert(commonCLS.EXPAPER_AUTHORITY_ERROR.시험지상세정보없음.MSG);
                            break;
						case commonCLS.EXPAPER_AUTHORITY_ERROR.동영상정보없음.CD:
                            alert(commonCLS.EXPAPER_AUTHORITY_ERROR.동영상정보없음.MSG);
                            break;
                    }
                } else {
					storage.setSession(storage.HIJACKING_PROMOTION_TARGET_CD, responseJson.AUTHORITY[0].HIJACKING_PROMOTION_TARGET_CD);
					storage.setSession(storage.HIJACKING_PROMOTION_TARGET_DAY, responseJson.AUTHORITY[0].HIJACKING_PROMOTION_TARGET_DAY);
					storage.setSession(storage.HIJACKING_PROMOTION_TARGET_DISRATE, responseJson.AUTHORITY[0].HIJACKING_PROMOTION_TARGET_DISRATE);
					storage.setSession(storage.SHARE_DISCOUNT_COUPON_YN, responseJson.AUTHORITY[0].SHARE_DISCOUNT_COUPON_YN);
					storage.setSession(storage.SHARE_DISCOUNT_COUPON_EXISTS_YN, responseJson.AUTHORITY[0].SHARE_DISCOUNT_COUPON_EXISTS_YN);

                    if (commonCLS.getDownFlag() !== commonCLS.DOWN_FLAG_CD.동영상단독) {//시험지단독 & 시험지동영상혼합 팝업
						storage.setSession(storage.EXPAPER_AUTH, responseJson.AUTHORITY[1].AUTHORITY_TYPE);
						storage.setSession(storage.PAY_SVC, responseJson.AUTHORITY[1].PAY_SVC);
						storage.setSession(storage.TICKET_NAME, responseJson.AUTHORITY[1].TICKET_NAME);
						storage.setSession(storage.PRODUCT_CD, responseJson.AUTHORITY[1].PRODUCT_CD);
						storage.setSession(storage.SITEID, responseJson.AUTHORITY[1].EXPAPR_SITEID);
						storage.setSession(storage.EXPAPR_GROUP_CD, responseJson.AUTHORITY[1].EXPAPR_GROUP);
						storage.setSession(storage.EXPAPR_CORETYPE_CD, responseJson.AUTHORITY[1].EXPAPR_CORETYPE);
						storage.setSession(storage.EXPAPR_NAME, responseJson.AUTHORITY[1].EXPAPR_TITLE);
						storage.setSession(storage.EXPAPR_GRADE, responseJson.AUTHORITY[1].EXPAPR_GRADE);
						storage.setSession(storage.EXPAPR_TYPE_CD, responseJson.AUTHORITY[1].EXPAPR_TYPE_CD);
					}

					if (commonCLS.getDownFlag() !== commonCLS.DOWN_FLAG_CD.시험지단독) {//동영상단독 & 시험지동영상혼합 팝업
						storage.setSession(storage.VOD_AUTH, responseJson.AUTHORITY[0].AUTHORITY_TYPE);
						storage.setSession(storage.VOD_PAY_SVC, responseJson.AUTHORITY[0].PAY_SVC);
						storage.setSession(storage.VOD_TICKET_NAME, responseJson.AUTHORITY[0].TICKET_NAME);
						storage.setSession(storage.VOD_PRODUCT_CD, responseJson.AUTHORITY[0].PRODUCT_CD);
						storage.setSession(storage.VOD_SITEID, responseJson.AUTHORITY[0].EXPAPR_SITEID);
						storage.setSession(storage.VOD_EXPAPR_GROUP_CD, responseJson.AUTHORITY[0].EXPAPR_GROUP);
						storage.setSession(storage.VOD_EXPAPR_CORETYPE_CD, responseJson.AUTHORITY[0].EXPAPR_CORETYPE);
						storage.setSession(storage.VOD_EXPAPR_NAME, responseJson.AUTHORITY[0].EXPAPR_TITLE);
						storage.setSession(storage.VOD_EXPAPR_GRADE, responseJson.AUTHORITY[0].EXPAPR_GRADE);
						storage.setSession(storage.VOD_DATA_FORMAT, responseJson.AUTHORITY[0].DATA_FORMAT);
					}

					let params
					if (commonCLS.getDownFlag() == commonCLS.DOWN_FLAG_CD.동영상단독) {//동영상 단독일때
						params = {"param1" : responseJson.AUTHORITY[0].PAYMEMBER_YN, "expapr_group" : responseJson.AUTHORITY[0].EXPAPR_GROUP, "expapr_coretype" : responseJson.AUTHORITY[0].EXPAPR_CORETYPE}; // 유/무료 회원 구분 -- Y : 유료 회원 / N : 무료 회원
						trkCLS.setExternalEvent("98JXB8HYBY9NNZ6AU3L4C49NW20250409", params);
					} else {
						params = {"param1" : responseJson.AUTHORITY[1].PAYMEMBER_YN, "expapr_group" : responseJson.AUTHORITY[1].EXPAPR_GROUP, "expapr_coretype" : responseJson.AUTHORITY[1].EXPAPR_CORETYPE}; // 유/무료 회원 구분 -- Y : 유료 회원 / N : 무료 회원
						trkCLS.setExternalEvent("98JXB8HYBY9NNZ6AU3L4C49NW20250409", params);
					}
					trkCLS.setExternalEvent("REHGLX4ASEFZSO171LHAWSHZU20250526", params);

					if (commonCLS.getDownFlag() == commonCLS.DOWN_FLAG_CD.시험지단독) {//시험지 단독일 경우
						if (commonCLS.EXPAPER_TYPE_CD.생성 == responseJson.AUTHORITY[1].EXPAPR_TYPE_CD && responseJson.AUTHORITY[1].AUTHORITY_TYPE != commonCLS.EXPAPER_AUTHORITY.추천상품) {
							if (isValueEmpty(commonCLS.getPartID())) {
								alert("범위를 먼저 선택하고 맞춤형\n시험지를 만들어보세요!");
							} else {
								bottomSheetLayerCLS.init(selectedItem);

								if(responseJson.AUTHORITY[1].AUTHORITY_TYPE == "YEAR_CHANGE") {
									examCLS.setFinalExpaprGenerating(responseJson.AUTHORITY[1], responseJson.IS_SHARE, selectedItem, responseJson.YEAR_CHANGE_ITEM);
								} else {
									examCLS.setFinalExpaprGenerating(responseJson.AUTHORITY[1], responseJson.IS_SHARE, selectedItem, "");
								}
							}
						} else {
							if(responseJson.AUTHORITY[1].AUTHORITY_TYPE == "YEAR_CHANGE") {
								examCLS.setDownLayer(null, responseJson.AUTHORITY[1], responseJson.AUTHORITY[1].AUTHORITY_TYPE, responseJson.YEAR_CHANGE_ITEM);
							} else {
								examCLS.setDownLayer(null, responseJson.AUTHORITY[1], responseJson.IS_SHARE, "");
							}
						}
					} else {
						if(responseJson.AUTHORITY[0].AUTHORITY_TYPE == "YEAR_CHANGE" || responseJson.AUTHORITY[1].AUTHORITY_TYPE == "YEAR_CHANGE") {
							examCLS.setDownLayer(responseJson.AUTHORITY[0], responseJson.AUTHORITY[1], "YEAR_CHANGE", responseJson.YEAR_CHANGE_ITEM);
						} else {
	                        examCLS.setDownLayer(responseJson.AUTHORITY[0] ,responseJson.AUTHORITY[1], responseJson.IS_SHARE, "");
						}
					}
                }
            },
            error: function(request, exception) {
				return false;
			}
		});
    },
	goExpaprLayer : function (selectedItem, expaprNo, isGeneratingBar, representativeExpaprNo, partCD, levelCD, expaprCount, isBeforeExam, expaprTestYear) {
		if(season_State == "N" && (commonGLB.getMenuCD().slice(0, 10) == "0000100004" || commonGLB.getMenuCD().slice(0, 10) == "0000200004")) {
			menuCLS.goSelectedMenu(99, commonGLB.getMenuCD(), "");
			return false;
		}

        if (TRK_GLB_IS_LOGIN == false) {
            examCLS.setNotLogin();
        } else {
			if(commonGLB.getMenuCD() == "000010000600001" && (expaprNo == 13558363 || expaprNo == 13558451 || expaprNo == 13558687)) { // 예비중1 기초학력진단평가 1회 콘텐츠 다운 시 마케팅 수신동의 여부 체크
				this.getMarketingChk();

				if(this.marketing_chk == false) {
					return false;
				}
			}

            storage.setSession(storage.EXPAPR_NO, expaprNo);
            storage.setSession(storage.REPRESENTATIVE_EXPAPR_NO, representativeExpaprNo);
            storage.setSession(storage.EXPAPER_FILE_GROUP_LIST, commonCLS.EXPAPER_FILE_GROUP_CD.PDF.CD);
            //examCLS.goExpaprUseAuthorityCheck(isGeneratingBar, selectedItem);
			storage.setSession(storage.DOWN_FLAG, 1);
            storage.setSession(storage.VOD_NO, null);
			storage.setSession(storage.EXPAPR_TESTYEAR, expaprTestYear);
			storage.setSession(storage.IS_BEFORE_EXAM, isBeforeExam);

            storage.setLocal(storage.EXPAPR_PART_CD, partCD);
            storage.setLocal(storage.EXPAPR_LEVEL_CD, levelCD);
			storage.setLocal(storage.EXPAPR_COUNT, expaprCount);
            examCLS.goDownAuthorityCheck(isGeneratingBar, selectedItem);
        }
    },
    setFinalExpaprGeneratingClose : function() {
        clearInterval(examCLS.examIntervalID);
        examCLS.examTimer = false;
    },
    setFinalExpaprGenerating : function(json, isShare, selectedItem, yearchangeItem) {
        let examIndex = 1; //고정
		var orgItemName = "";
		var nextItemName = "";
		var settingDate = "";

        bottomSheetLayerCLS.setHeader(jQuery("#hidden-bottom-sheet-layer-final-header-close-template").html());
		bottomSheetLayerCLS.setBody(templateReplace(jQuery("#hidden-bottom-sheet-layer-body-content-expapr-generating-bar-template").html(), [TRK_GLB_USER_NAME]));

        jQuery.ajax({
			type : "GET",
			dataType:'json',
			url : commonCLS.URL.시험지생성,
			data: {
				"ExPapr_No": commonCLS.getExpaprNo(),
                "Part_ID_Set": commonCLS.getPartID(),
                "ExPapr_Group" : commonCLS.getExpaprGroupCD(),
                "reSubj_Code" : commonGLB.getSubjectCD(),
                "exam_Index" : examIndex,
			},
            success: function(responseJson) {
                let token = responseJson.File;
                let autoSeq = responseJson.Auto_Seq;
				if (examCLS.examTimer == false) {
                    examCLS.examTimer = true;
                    examCLS.examIntervalID = window.setInterval(function() {
                        examCLS.setExpaprGeneratingProgress(token, function() {
                            storage.setSession(storage.EXPAPR_AUTO_DOWN_SEQ, autoSeq);
                            storage.setSession(storage.EXPAPR_EXAM_INDEX, examIndex);

							bottomSheetClose(document.querySelector("#bottomSheetLayer"));//팝업 닫기 필요!
                            examCLS.setDownLayer(null ,json, isShare, yearchangeItem);
                        });
                    }, 500);
                }
            }
        });
    },
    setExpaprGeneratingProgress: function(token, _function) {
        let Start = false;

        jQuery.ajax({
            method: "get",
            asynchronous: false,
            contentType: 'application/x-www-form-urlencoded',
            encoding: 'UTF-8',
            dataType: "xml",
			url : commonCLS.URL.시험지생성토근조회,
			data: {
				"Token": token,
                "Idx": Math.random(),
			},
            complete: function(request) {
                if (request.status == 200) {
                    if (request.responseXML) {
                        let Doc = request.responseXML.documentElement;
                        let percent = Number(Doc.getElementsByTagName('Percent')[0].firstChild.nodeValue);
                        let _Status = Doc.getElementsByTagName('Status')[0].firstChild.nodeValue;

                        if (_Status != '') {
                            Start = true;
                        }

                        if (Start == true && percent == 100) {
                            examCLS.setFinalExpaprGeneratingClose();
                            if(typeof(_function) == "function"){
                                _function();
                            }
                            return;
                        }

                        if (_Status == '000') { // 문제를 찾기 못 한다면
                            common.alert('알림','해당 범위의 문제가 조회가 되질 않습니다.', null, {});
                            examCLS.setFinalExpaprGeneratingClose();
                            return;
                        } else if (examCLS.examTimer == false) {
                            examCLS.setFinalExpaprGeneratingClose();
                        } else{
                            let percentStr = percent + "% 진행중"
                            jQuery("#expapr_generating_bar_progress").html(percentStr);
                            if (percent >= 100 ) {
                                examCLS.setFinalExpaprGeneratingClose();
                                if(typeof(_function) == "function"){
                                    _function();
                                }
                                return;
                            } else if (percent > 90 ) {
                                jQuery("#expapr_generating_bar_step3").addClass("is-active");
                                jQuery("#expapr_generating_bar_step3_state").html("완료");
                            } else if (percent > 60 ) {
                                jQuery("#expapr_generating_bar_step2").addClass("is-active");
                                jQuery("#expapr_generating_bar_step2_state").html("완료");
                            } else if (percent > 30 ) {
                                jQuery("#expapr_generating_bar_step1").addClass("is-active");
                                jQuery("#expapr_generating_bar_step1_state").html("완료");
                            }
                        }
                    }
                } else if(Start && request.status == 404){
                    examCLS.setFinalExpaprGeneratingClose();
                }
            }
        });
    },
    setRepresentativeExpaprNotDown : function() {
        modalCLS.popupOpen("대표유형 먼저 다운로드하세요.");
        modalCLS.setBodyContent(jQuery("#hidden-representative-expapr-no-down-modal-template").html());
    },
    setExpaprGeneratingBar : function(json, isShare) {
		bottomSheetLayerCLS.setHeader(jQuery("#hidden-bottom-sheet-layer-header-close-template").html());
		bottomSheetLayerCLS.setBody(templateReplace(jQuery("#hidden-bottom-sheet-layer-body-content-expapr-generating-bar-template").html(), [TRK_GLB_USER_NAME]));

        let percent = 0;
        const intervalld = setInterval(() => {
            let randomNum = Math.floor(Math.random() * 5) + 1;
            percent += randomNum;

            let percentStr = percent + "% 진행중"
            jQuery("#expapr_generating_bar_progress").html(percentStr);
            if (percent > 100 ) {
                clearInterval(intervalld);
                examCLS.setDownLayer(null ,json, isShare, "");
            } else if (percent > 90 ) {
                jQuery("#expapr_generating_bar_step3").addClass("is-active");
                jQuery("#expapr_generating_bar_step3_state").html("완료");
            } else if (percent > 60 ) {
                jQuery("#expapr_generating_bar_step2").addClass("is-active");
                jQuery("#expapr_generating_bar_step2_state").html("완료");
            } else if (percent > 30 ) {
                jQuery("#expapr_generating_bar_step1").addClass("is-active");
                jQuery("#expapr_generating_bar_step1_state").html("완료");
            }
        }, 70);
    },
	setDownLayer : function(jsonVod, jsonExpapr, isShare, yearchangeItem) {
		modal2CLS.setBottomHeader(examCLS.getHeaderHtml(jsonVod, jsonExpapr));

		if(isShare == "YEAR_CHANGE") {
			modal2CLS.setBottomBody(examCLS.setDownBottomSheetLayerBodyHtml(jsonVod, jsonExpapr, yearchangeItem));
			modal2CLS.setBottomFooter(examCLS.setDownBottomSheetLayerFooterHtml(jsonVod, jsonExpapr, isShare));
		} else {
			trkCLS.setExternalEvent("DKG22DRRV8BLAPK137HXNIHF720240911", "");
			modal2CLS.setBottomBody(examCLS.setDownBottomSheetLayerBodyHtml(jsonVod, jsonExpapr, yearchangeItem));
			modal2CLS.setBottomFooter(examCLS.setDownBottomSheetLayerFooterHtml(jsonVod, jsonExpapr, isShare));
		}

		if (isValueEmpty(commonCLS.getDownFlag()) == true || (commonCLS.getDownFlag() == commonCLS.DOWN_FLAG_CD.시험지단독 && commonCLS.getExpaprAuth() == commonCLS.EXPAPER_AUTHORITY.재다운로드) || (commonCLS.getDownFlag() == commonCLS.DOWN_FLAG_CD.동영상단독 && commonCLS.getVodAuth() == commonCLS.EXPAPER_AUTHORITY.재다운로드) || (commonCLS.getDownFlag() == commonCLS.DOWN_FLAG_CD.시험지동영상혼합 && commonCLS.getExpaprAuth() == commonCLS.EXPAPER_AUTHORITY.재다운로드 && commonCLS.getVodAuth() == commonCLS.EXPAPER_AUTHORITY.재다운로드)) {
			jQuery(".downCountInfo").hide();
		}

		let hijackingPromotionTargetCD = commonCLS.getHijackingPromotionTargetCD();
		let hijackingPromotionTargetDay = commonCLS.getHijackingPromotionTargetDay();
		let hijackingPromotionTargetDisrate = commonCLS.getHijackingPromotionTargetDisrate();
		let share_discount_coupon_YN = commonCLS.getShareDiscountCouponYN();
		let share_discount_coupon_Exist_YN = commonCLS.getShareDiscountCouponExistYN();
		let hijackingPromotionHtml = "";

		if (share_discount_coupon_YN !== "Y" && share_discount_coupon_Exist_YN !== "Y") {


			if (TRK_GLB_TOGGLE_GROUP == "T") {
				// 티칭 재결제
				if (TRK_GLB_IS_4Q_CLOSED_TEACHING_REPAYMENT_PROMOTION_TARGET) {
					hijackingPromotionHtml = templateReplace(jQuery("#hidden-hijacking-teacher-rep-template").html(), [TRK_GLB_PROMOTION_TARGET_DAY, hijackingPromotionTargetDisrate, TRK_GLB_OPEN_PROMOTION_TARGET_DAY]);
				} else {
					// 티칭 폐쇄형
					if (TRK_GLB_IS_CLOSED_TEACHING_PROMOTION_DISPLAY_TARGET) {
						hijackingPromotionHtml = templateReplace(jQuery("#hidden-hijacking-teacher-sub-template").html(), [TRK_GLB_PROMOTION_TARGET_DAY, hijackingPromotionTargetDisrate, TRK_GLB_OPEN_PROMOTION_TARGET_DAY]);
					} else {
						// 티칭 오픈형
						if (TRK_GLB_IS_OPEN_TEACHING_PROMOTION_DISPLAY_TARGET) {
							hijackingPromotionHtml = templateReplace(jQuery("#hidden-hijacking-teacher-open-template").html(), [TRK_GLB_OPEN_PROMOTION_TARGET_DAY, hijackingPromotionTargetDisrate, TRK_GLB_OPEN_PROMOTION_TARGET_DAY]);
						}
					}
				}
			} else {
				// 러닝 재결제
				if (TRK_GLB_IS_4Q_CLOSED_LEARNING_REPAYMENT_PROMOTION_TARGET) {
					hijackingPromotionHtml = templateReplace(jQuery("#hidden-hijacking-student-3q-rep-template").html(), [TRK_GLB_PROMOTION_TARGET_DAY, hijackingPromotionTargetDisrate]); 
				} else {
					// 러닝 폐쇄형
					if (TRK_GLB_IS_CLOSED_LEARNING_PROMOTION_DISPLAY_TARGET) {
						switch (TRK_GLB_MEMBER_PROMOTION_GRADE) {
							case commonGLB.PROMOTION_GRADE.중1:
								hijackingPromotionHtml = templateReplace(jQuery("#hidden-hijacking-student-3q-m1-template").html(), [TRK_GLB_PROMOTION_TARGET_DAY, hijackingPromotionTargetDisrate]); 
								break;
							case commonGLB.PROMOTION_GRADE.중2:
								hijackingPromotionHtml = templateReplace(jQuery("#hidden-hijacking-student-3q-m2-template").html(), [TRK_GLB_PROMOTION_TARGET_DAY, hijackingPromotionTargetDisrate]); 
								break;
							case commonGLB.PROMOTION_GRADE.중3:
								if (TRK_GLB_IS_3Q_3M_SHORT_TERM_LEARNING_PROMOTION) {
									hijackingPromotionHtml = templateReplace(jQuery("#hidden-hijacking-student-m3-short-template").html(), [TRK_GLB_3M_SHORT_PROMOTION_TARGET_DAY, hijackingPromotionTargetDisrate]);
								} else {
									hijackingPromotionHtml = templateReplace(jQuery("#hidden-hijacking-student-3q-m3-template").html(), [TRK_GLB_PROMOTION_TARGET_DAY, hijackingPromotionTargetDisrate]);
								}
								//hijackingPromotionHtml = templateReplace(jQuery("#hidden-hijacking-student-prego12027-template").html(), [TRK_GLB_PROMOTION_TARGET_DAY, hijackingPromotionTargetDisrate]); 
								break;
							case commonGLB.PROMOTION_GRADE.고1:
								hijackingPromotionHtml = templateReplace(jQuery("#hidden-hijacking-student-3q-h1-template").html(), [TRK_GLB_PROMOTION_TARGET_DAY, hijackingPromotionTargetDisrate]); 
								break;
							case commonGLB.PROMOTION_GRADE.고2:
								hijackingPromotionHtml = templateReplace(jQuery("#hidden-hijacking-student-3q-h2-template").html(), [TRK_GLB_PROMOTION_TARGET_DAY, hijackingPromotionTargetDisrate]); 
								break;
						}
					} else {
						// 러닝 오픈형
						if (TRK_GLB_IS_OPEN_LEARNING_PROMOTION_DISPLAY_TARGET) {
							hijackingPromotionHtml = templateReplace(jQuery("#hidden-hijacking-student-3q-dft-template").html(), [TRK_GLB_OPEN_PROMOTION_TARGET_DAY, hijackingPromotionTargetDisrate]); 
						}
					}
				}
			}
			
			if (isValueEmpty(hijackingPromotionHtml) == false) {
				jQuery("#hijackingPopupBanner").html(hijackingPromotionHtml);
				jQuery("#hijackingPopupBanner").show();
			}
		}

		modal2CLS.goBottomLayerOpen();
    },
	setDownBottomSheetLayerBodyHtml: function (jsonVod, jsonExpapr, yearchangeItem) {
		let setAuthority = jsonExpapr;

		if (commonCLS.getDownFlag() == commonCLS.DOWN_FLAG_CD.동영상단독) {
			setAuthority = jsonVod;
		} else if (commonCLS.getDownFlag() == commonCLS.DOWN_FLAG_CD.시험지동영상혼합) {
			if (commonCLS.getVodAuth() !== commonCLS.EXPAPER_AUTHORITY.재다운로드 && commonCLS.getVodAuth() !== commonCLS.EXPAPER_AUTHORITY.추천상품 && commonCLS.getVodAuth() !== commonCLS.EXPAPER_AUTHORITY.학년변경) {
				setAuthority = jsonVod;
			}
		}

		return examCLS.getDownBottomSheetLayerBodyContentHtml(setAuthority, yearchangeItem);
    },
    getDownBottomSheetLayerBodyContentHtml: function (AUTHORITY, yearchangeItem) {
        let tx_nm = "공통";
		let expaprContent = "";
		let vodContent = "";
        let grade_nm = examCLS.getGradeBage();
		var orgItemName = "";
		var nextItemName = "";
		var settingDate = "";

		if(yearchangeItem != "") {
			orgItemName = yearchangeItem.split(",")[1];
			nextItemName = yearchangeItem.split(",")[2];
			settingDate = yearchangeItem.split(",")[3];
		}

        if (jQuery('.' + commonCLS.FILTER.교과서.CD).text() != "") {
            tx_nm = jQuery('.' + commonCLS.FILTER.교과서.CD).text();
        } else if (jQuery('.' + commonCLS.FILTER.상세과목.CD).text() != "") {
			tx_nm = jQuery('.' + commonCLS.FILTER.상세과목.CD).text();
		}

		if (commonCLS.getDownFlag() == commonCLS.DOWN_FLAG_CD.동영상단독 || commonCLS.getDownFlag() == commonCLS.DOWN_FLAG_CD.시험지동영상혼합) {
			if (commonCLS.getVodDataFormart() == commonCLS.DATA_FORMAT_CD.개념영상.CD) {//개념영상일 경우
				vodContent = templateReplace(jQuery("#hidden-bottom-sheet-layer-body-content-product-vod-template").html(), [commonCLS.DATA_FORMAT_CD.개념영상.CLS, commonCLS.DATA_FORMAT_CD.개념영상.NM]);
			} else if (commonCLS.getVodDataFormart() == commonCLS.DATA_FORMAT_CD.풀이영상.CD) {//풀이영상일 경우
				vodContent = templateReplace(jQuery("#hidden-bottom-sheet-layer-body-content-product-vod-template").html(), [commonCLS.DATA_FORMAT_CD.풀이영상.CLS, commonCLS.DATA_FORMAT_CD.풀이영상.NM]);
			}
		}

		if (commonCLS.getDownFlag() !== commonCLS.DOWN_FLAG_CD.동영상단독) {
			expaprContent = jQuery("#hidden-bottom-sheet-layer-body-content-product-pdf-template").html();
		}

        let termHtml = "";

        if (menuCLS.getMenuByIsSemesterHiddenCD() != 1) {
            termHtml = templateReplace(jQuery("#hidden-bottom-sheet-layer-body-content-product-all-term-template").html(), [AUTHORITY.EXPAPR_TERM + "학기 " + AUTHORITY.EXPAPR_MIDEND]);
        }

		let viewerInfoHtml = "";
		//바로보기 버튼 안내 버튼
		if (commonCLS.getDownFlag() !== commonCLS.DOWN_FLAG_CD.동영상단독 && common.showViewerBtnCheck("VIEWER", 2)) {
			viewerInfoHtml = jQuery("#hidden-exam-footer-auth-viewer-info-zocbo-modal-template").html();
		}

		let html = "";
        switch (AUTHORITY.AUTHORITY_TYPE) {
            case commonCLS.EXPAPER_AUTHORITY.쿠폰포인트:
            case commonCLS.EXPAPER_AUTHORITY.쿠폰포인트와일반포인트:
            case commonCLS.EXPAPER_AUTHORITY.포인트:
				html += templateReplace(jQuery("#hidden-exam-body-point-modal-template").html(), [addComma(AUTHORITY.REMAINING_COUNT), addComma(AUTHORITY.DOWN_COUNT), addComma(AUTHORITY.PRICE_COUNT), addComma(AUTHORITY.PRICE_POINT), viewerInfoHtml]);
                break;
            case commonCLS.EXPAPER_AUTHORITY.쿠폰이용권:
            case commonCLS.EXPAPER_AUTHORITY.이용권:
				html += templateReplace(jQuery("#hidden-exam-body-ticket-modal-template").html(), [templateReplace(jQuery("#hidden-exam-body-ticket-voucher-modal-template").html(), [AUTHORITY.TICKET_NAME, addComma(AUTHORITY.REMAINING_COUNT), addComma(AUTHORITY.DOWN_COUNT)]), addComma(AUTHORITY.PRICE_COUNT), addComma(AUTHORITY.PRICE_POINT), viewerInfoHtml]);
                break;
			case commonCLS.EXPAPER_AUTHORITY.재다운로드:
				html += templateReplace(jQuery("#hidden-exam-body-ticket-modal-template").html(), ["", addComma(AUTHORITY.PRICE_COUNT), addComma(AUTHORITY.PRICE_POINT), viewerInfoHtml]);
                break;
            case commonCLS.EXPAPER_AUTHORITY.추천상품:
				var coupon_discount_show = "none";
				var coupon_discount_exists = "none";
				var discount_coupon_expire = "";

				if(AUTHORITY.SHARE_DISCOUNT_COUPON_YN == "Y") {
					trkCLS.setExternalEvent("W5N9AKRI8SH7VCGKN44PN264J20251017", "");
					coupon_discount_show = "";
				}

				if(AUTHORITY.SHARE_DISCOUNT_COUPON_EXISTS_YN == "Y") {
					trkCLS.setExternalEvent("MYAUV6GEJYMCH3QDDRWGR4V3L20251017", "");
					coupon_discount_exists = "";
				}

				if(AUTHORITY.SHARE_DISCOUNT_COUPON_YN == "Y" || AUTHORITY.SHARE_DISCOUNT_COUPON_EXISTS_YN == "Y") {
					discount_coupon_expire = AUTHORITY.SHARE_DISCOUNT_COUPON_EXISTS_DAY;
				}

				var kakaoShare_content = "공유하면 <strong class='color-point'>다운로드 1회 무료</strong> 제공<br>친구가 <strong class='color-point'>가입하면 3회 추가</strong> 제공";

				if(TRK_GLB_MEM_GROUP == "T") {
					kakaoShare_content = "공유하면 <strong class='color-point'>편집 1회&middot;문제은행 1일</strong> 제공<br>받은 사람 가입시 <strong class='color-point'>편집 3회&middot;문제은행 1일</strong> 추가 제공";
				}

//				if(examCLS.getMenuByBottomSheetSet()) {
//					html = templateReplace(jQuery("#hidden-exam-body-no-auth-modal-template").html(), ["", "", "none"]);
//				} else {
//					html = templateReplace(jQuery("#hidden-exam-body-no-auth-modal-template").html(), ["", "", "none"]);
//				}
	
				if(share_content_show_yn == true) {
					html = templateReplace(jQuery("#hidden-exam-body-no-auth-modal-template").html(), [kakaoShare_content, ""]);
				} else {
					html = templateReplace(jQuery("#hidden-no-share-exam-body-no-auth-modal-template").html(), []);
				}
				break;
			case commonCLS.EXPAPER_AUTHORITY.학년변경:
				html = templateReplace(jQuery("#hidden-exam-body-zocbo-yearchange-modal-template").html(), [orgItemName, nextItemName, settingDate]);
                break;
        }
        return html;
    },
    getDownloadFunctionName : function (authorityType) {
        let html = "goExpaprDownload(this)";
        switch (authorityType) {
            case commonCLS.EXPAPER_AUTHORITY.재다운로드:
                html = "goExpaprReDownload(this)";
                break;
            case commonCLS.EXPAPER_AUTHORITY.추천상품:
                html = "";
                break;
        }
        return html;
    },
    getViewFunctionName : function (authorityType) {
        let html = "goExpaprView(this)";
        switch (authorityType) {
            case commonCLS.EXPAPER_AUTHORITY.재다운로드:
                html = "goExpaprReView(this)";
                break;
            case commonCLS.EXPAPER_AUTHORITY.추천상품:
                //html = "goLandingPage(this)";
                break;
        }
        return html;
    },
    getAnswerFunctionName : function (authorityType){
        let html = "goAnswerView(this)";
        switch (authorityType) {
            case commonCLS.EXPAPER_AUTHORITY.재다운로드:
                html = "";
                break;
            case commonCLS.EXPAPER_AUTHORITY.추천상품:
                html = "";
                break;
        }
        return html;
    },
	getVodFunctionName : function (authorityType) {
        let html = "goVodLayer(this)";
        switch (authorityType) {
            case commonCLS.EXPAPER_AUTHORITY.추천상품:
                html = "";
                break;
        }
        return html;
    },
    setBottomSheetLayerExpaprDownloadComplete : function () {
        jQuery("#bottomSheetLayerExpaprDownloadLoader").hide();
        jQuery("#bottomSheetLayerExpaprDownloadInfo").show();
    },
	setBottomSheetLayerExpaprDownloadError : function () {//파일다운로드 실패시 다운로드중 로딩창 닫기&다운로드버튼 노출
        jQuery("#bottomSheetLayerExpaprDownload").removeClass("is-active");
    },
    setDownBottomSheetLayerFooterHtml: function (jsonVod, jsonExpapr, isShare) {
        let html = "";
		let vodPayCnt = "";
		let expaprPayCnt = "";
		let discountHtml = "";

		if (jsonExpapr.EVENT_SALE_CONTENTS == "Y") {
			discountHtml= jQuery("#hidden-bottom-sheet-layer-footer-pay_point_discount-download-button-template").html();
		}

		//시험지 권한결과
		if (commonCLS.getDownFlag() !== commonCLS.DOWN_FLAG_CD.동영상단독) {
			switch (commonCLS.getExpaprAuth()) {
				case commonCLS.EXPAPER_AUTHORITY.쿠폰포인트:
				case commonCLS.EXPAPER_AUTHORITY.쿠폰포인트와일반포인트:
				case commonCLS.EXPAPER_AUTHORITY.포인트:
					expaprPayCnt = templateReplace(jQuery("#hidden-bottom-sheet-layer-footer-pay_point-download-button-template").html(), [addComma(jsonExpapr.DOWN_COUNT), discountHtml]);
					break;
				case commonCLS.EXPAPER_AUTHORITY.쿠폰이용권:
				case commonCLS.EXPAPER_AUTHORITY.이용권:
					expaprPayCnt = templateReplace(jQuery("#hidden-bottom-sheet-layer-footer-pay_cnt-download-button-template").html(), [addComma(jsonExpapr.DOWN_COUNT)]);
					break;
			}
		}
		//동영상 권한결과
		if (commonCLS.getDownFlag() !== commonCLS.DOWN_FLAG_CD.시험지단독) {
			switch (commonCLS.getVodAuth()) {
				case commonCLS.EXPAPER_AUTHORITY.쿠폰포인트:
				case commonCLS.EXPAPER_AUTHORITY.쿠폰포인트와일반포인트:
				case commonCLS.EXPAPER_AUTHORITY.포인트:
					vodPayCnt = templateReplace(jQuery("#hidden-bottom-sheet-layer-footer-pay_point-download-button-template").html(), [addComma(jsonVod.DOWN_COUNT), ""]);
					break;
				case commonCLS.EXPAPER_AUTHORITY.쿠폰이용권:
				case commonCLS.EXPAPER_AUTHORITY.이용권:
					vodPayCnt = templateReplace(jQuery("#hidden-bottom-sheet-layer-footer-pay_cnt-download-button-template").html(), [addComma(jsonVod.DOWN_COUNT)]);
					break;
			}
		}

		if (commonCLS.getDownFlag() == commonCLS.DOWN_FLAG_CD.동영상단독) {
			if (commonCLS.getVodAuth() == commonCLS.EXPAPER_AUTHORITY.추천상품) {
				if (examCLS.getMenuByBottomSheetSet()) {
					html = share_content_show_yn == true ? templateReplace(jQuery("#hidden-exam-footer-zocbo-no-auth-modal-template").html(), [isShare, examCLS.share_btn_name]) : jQuery("#hidden-no-share-exam-footer-zocbo-no-auth-modal-template").html();
				} else {
					html = share_content_show_yn == true ? templateReplace(jQuery("#hidden-exam-footer-zocbo-no-auth-modal-template").html(), [isShare, examCLS.share_btn_name]) : jQuery("#hidden-no-share-exam-footer-zocbo-no-auth-modal-template").html();
				}
			} else if(commonCLS.getVodAuth() == commonCLS.EXPAPER_AUTHORITY.학년변경) {
				html = templateReplace(jQuery("#hidden-exam-footer-zocbo-yearchange-modal-template").html(), [isShare]);
			} else {
				let vodFunction = examCLS.getVodFunctionName(commonCLS.getVodAuth());
				let redownVodClass = "";
				if (commonCLS.getVodAuth() == commonCLS.EXPAPER_AUTHORITY.재다운로드) {
					redownVodClass = "is-disabled";
				}
				if (commonCLS.getVodDataFormart() == commonCLS.DATA_FORMAT_CD.개념영상.CD) {//개념영상일 경우
					html += templateReplace(jQuery("#hidden-vod-footer-auth-zocbo-modal-template").html(), [commonCLS.DATA_FORMAT_CD.개념영상.CLS, commonCLS.DATA_FORMAT_CD.개념영상.NM, vodPayCnt, vodFunction, redownVodClass]);
				} else if (commonCLS.getVodDataFormart() == commonCLS.DATA_FORMAT_CD.풀이영상.CD) {//풀이영상일 경우
					html += templateReplace(jQuery("#hidden-vod-footer-auth-zocbo-modal-template").html(), [commonCLS.DATA_FORMAT_CD.풀이영상.CLS, commonCLS.DATA_FORMAT_CD.풀이영상.NM, vodPayCnt, vodFunction, redownVodClass]);
				}
			}
		} else if (commonCLS.getDownFlag() == commonCLS.DOWN_FLAG_CD.시험지동영상혼합) {
			if (commonCLS.getExpaprAuth() == commonCLS.EXPAPER_AUTHORITY.추천상품 && commonCLS.getVodAuth() == commonCLS.EXPAPER_AUTHORITY.추천상품) {
				if (examCLS.getMenuByBottomSheetSet()) {
					html = share_content_show_yn == true ? templateReplace(jQuery("#hidden-exam-footer-zocbo-no-auth-modal-template").html(), [isShare, examCLS.share_btn_name]) : jQuery("#hidden-no-share-exam-footer-zocbo-no-auth-modal-template").html();
				} else {
					html = share_content_show_yn == true ? templateReplace(jQuery("#hidden-exam-footer-zocbo-no-auth-modal-template").html(), [isShare, examCLS.share_btn_name]) : jQuery("#hidden-no-share-exam-footer-zocbo-no-auth-modal-template").html();
				}
			} else if(commonCLS.getExpaprAuth() == commonCLS.EXPAPER_AUTHORITY.학년변경 && commonCLS.getVodAuth() == commonCLS.EXPAPER_AUTHORITY.학년변경) {
				html = templateReplace(jQuery("#hidden-exam-footer-zocbo-yearchange-modal-template").html(), [isShare]);
			} else {
				let vodFunction = examCLS.getVodFunctionName(commonCLS.getVodAuth());
				let downloadFunctionNm = examCLS.getDownloadFunctionName(commonCLS.getExpaprAuth());
				let viewFunctionNm = examCLS.getViewFunctionName(commonCLS.getExpaprAuth());
				let noAuthFunctionNm = "noAuth('"+isShare+"')";
				let viewerShow = false;

				//바로보기 버튼 추가되는 경우
				if (common.showViewerBtnCheck("VIEWER", 2)) {
					viewerShow = true;
				}

				if (commonCLS.getVodAuth() == commonCLS.EXPAPER_AUTHORITY.추천상품 || commonCLS.getVodAuth() == commonCLS.EXPAPER_AUTHORITY.학년변경) {
					examCLS.noAuthAuthorityInfo = jsonVod;
					vodFunction = noAuthFunctionNm;
				} else if (commonCLS.getExpaprAuth() == commonCLS.EXPAPER_AUTHORITY.추천상품 || commonCLS.getExpaprAuth() == commonCLS.EXPAPER_AUTHORITY.학년변경) {
					examCLS.noAuthAuthorityInfo = jsonExpapr;
					downloadFunctionNm = vodFunction;
					viewFunctionNm = vodFunction;
				}

				//동영상 권한 있는 경우 추가
				let redownVodClass = "";
				if (commonCLS.getVodAuth() == commonCLS.EXPAPER_AUTHORITY.재다운로드) {
					redownVodClass = "is-disabled";
				}

				if (viewerShow) {
					html += jQuery("#hidden-bottom-sheet-layer-footer-item-start-template").html();
				}

				if (commonCLS.getVodDataFormart() == commonCLS.DATA_FORMAT_CD.개념영상.CD) {//개념영상일 경우
					html += templateReplace(jQuery("#hidden-vod-footer-auth-zocbo-modal-template").html(), [commonCLS.DATA_FORMAT_CD.개념영상.CLS, commonCLS.DATA_FORMAT_CD.개념영상.NM, vodPayCnt, vodFunction, redownVodClass]);
				} else if (commonCLS.getVodDataFormart() == commonCLS.DATA_FORMAT_CD.풀이영상.CD) {//풀이영상일 경우
					html += templateReplace(jQuery("#hidden-vod-footer-auth-zocbo-modal-template").html(), [commonCLS.DATA_FORMAT_CD.풀이영상.CLS, commonCLS.DATA_FORMAT_CD.풀이영상.NM, vodPayCnt, vodFunction, redownVodClass]);
				}

				if (viewerShow) {
					html += jQuery("#hidden-bottom-sheet-layer-footer-item-end-template").html();
				}

				if (isValueEmpty(downloadFunctionNm) ==  false) {
					let redownFileClass = "";
					if (commonCLS.getExpaprAuth() == commonCLS.EXPAPER_AUTHORITY.재다운로드) {
						redownFileClass = "is-disabled";
					}

					//바로보기 버튼 포함일  경우 다운로드 버튼
					if (viewerShow) {
						html += jQuery("#hidden-bottom-sheet-layer-footer-item-start-template").html();
						html += templateReplace(jQuery("#hidden-exam-footer-auth-zocbo-modal-template").html(), [downloadFunctionNm, redownFileClass, expaprPayCnt]);
						html += templateReplace(jQuery("#hidden-exam-footer-auth-viewer-zocbo-modal-template").html(), [viewFunctionNm]);
						html += templateReplace(jQuery("#hidden-bottom-sheet-layer-expapr-download-template").html(), [commonCLS.getExpaprNm()]);//다운로드 로딩바
						html += jQuery("#hidden-bottom-sheet-layer-footer-item-end-template").html();
					} else {
						html += templateReplace(jQuery("#hidden-exam-footer-auth-zocbo-modal-template").html(), [downloadFunctionNm, redownFileClass, expaprPayCnt]);
						html += templateReplace(jQuery("#hidden-bottom-sheet-layer-expapr-download-template").html(), [commonCLS.getExpaprNm()]);//다운로드 로딩바
					}
				}
			}
		} else {
			if (commonCLS.getExpaprAuth() == commonCLS.EXPAPER_AUTHORITY.추천상품) {
				if(examCLS.getMenuByBottomSheetSet()) {
					html = share_content_show_yn == true ? templateReplace(jQuery("#hidden-exam-footer-zocbo-no-auth-modal-template").html(), [isShare, examCLS.share_btn_name]) : jQuery("#hidden-no-share-exam-footer-zocbo-no-auth-modal-template").html();
				} else {
					html = share_content_show_yn == true ? templateReplace(jQuery("#hidden-exam-footer-zocbo-no-auth-modal-template").html(), [isShare, examCLS.share_btn_name]) : jQuery("#hidden-no-share-exam-footer-zocbo-no-auth-modal-template").html();
				}
//				if(examCLS.getMenuByBottomSheetSet()) {
//					html = templateReplace(jQuery("#hidden-exam-footer-zocbo-no-auth-modal-template").html(), [isShare, "none"]);
//				} else {
//					html = templateReplace(jQuery("#hidden-exam-footer-zocbo-no-auth-modal-template").html(), [isShare, "none"]);
//				}
			} else if(commonCLS.getExpaprAuth() == commonCLS.EXPAPER_AUTHORITY.학년변경) {
				html = templateReplace(jQuery("#hidden-exam-footer-zocbo-yearchange-modal-template").html(), [isShare]);
			} else {
				let downloadFunctionNm = examCLS.getDownloadFunctionName(commonCLS.getExpaprAuth());
				let viewFunctionNm = examCLS.getViewFunctionName(commonCLS.getExpaprAuth());

				if (isValueEmpty(downloadFunctionNm) ==  false) {
					let redownFileClass = "";
					if (commonCLS.getExpaprAuth() == commonCLS.EXPAPER_AUTHORITY.재다운로드) {
						redownFileClass = "is-disabled";
					}
					//바로보기 버튼 포함일  경우 다운로드 버튼
					if (common.showViewerBtnCheck("VIEWER", 2)) {
						html += jQuery("#hidden-bottom-sheet-layer-footer-item-start-template").html();
						html += templateReplace(jQuery("#hidden-exam-footer-auth-zocbo-modal-template").html(), [downloadFunctionNm, redownFileClass, expaprPayCnt]);
						html += templateReplace(jQuery("#hidden-exam-footer-auth-viewer-zocbo-modal-template").html(), [viewFunctionNm]);
						html += templateReplace(jQuery("#hidden-bottom-sheet-layer-expapr-download-template").html(), [commonCLS.getExpaprNm()]);//다운로드 로딩바
						html += jQuery("#hidden-bottom-sheet-layer-footer-item-end-template").html();
					} else {
						html += templateReplace(jQuery("#hidden-exam-footer-auth-zocbo-modal-template").html(), [downloadFunctionNm, redownFileClass, expaprPayCnt]);
						html += templateReplace(jQuery("#hidden-bottom-sheet-layer-expapr-download-template").html(), [commonCLS.getExpaprNm()]);//다운로드 로딩바
					}
				}
			}
		}

        return html;
    },
	getHeaderHtml : function(jsonVod, jsonExpapr) {
		let tx_nm = "공통";
		let expaprContent = "";
		let vodContent = "";
		let bageHtml = "";
		let termHtml = "";
		let html = "";
		let setAuthority = jsonExpapr;

		if (isValueEmpty(jsonVod) == true && isValueEmpty(jsonExpapr) == true) {
			html = templateReplace(jQuery("#hidden-exam-menu-header-modal-template-v2").html(), [""]);
		} else {
			if (commonCLS.getDownFlag() == commonCLS.DOWN_FLAG_CD.동영상단독) {
				setAuthority = jsonVod;
			} else if (commonCLS.getDownFlag() == commonCLS.DOWN_FLAG_CD.시험지동영상혼합) {
				if (commonCLS.getVodAuth() !== commonCLS.EXPAPER_AUTHORITY.재다운로드 && commonCLS.getVodAuth() !== commonCLS.EXPAPER_AUTHORITY.추천상품 && commonCLS.getVodAuth() !== commonCLS.EXPAPER_AUTHORITY.학년변경) {
					setAuthority = jsonVod;
				}
			}

			let grade_nm = examCLS.getGradeBage();

			if (jQuery('.' + commonCLS.FILTER.교과서.CD).text() != "") {
				tx_nm = jQuery('.' + commonCLS.FILTER.교과서.CD).text();
			} else if (jQuery('.' + commonCLS.FILTER.상세과목.CD).text() != "") {
				tx_nm = jQuery('.' + commonCLS.FILTER.상세과목.CD).text();
			}

			if (commonCLS.getDownFlag() == commonCLS.DOWN_FLAG_CD.동영상단독 || commonCLS.getDownFlag() == commonCLS.DOWN_FLAG_CD.시험지동영상혼합) {
				if (commonCLS.getVodDataFormart() == commonCLS.DATA_FORMAT_CD.개념영상.CD) {//개념영상일 경우
					vodContent = templateReplace(jQuery("#hidden-bottom-sheet-layer-body-content-product-vod-template").html(), [commonCLS.DATA_FORMAT_CD.개념영상.CLS, commonCLS.DATA_FORMAT_CD.개념영상.NM]);
				} else if (commonCLS.getVodDataFormart() == commonCLS.DATA_FORMAT_CD.풀이영상.CD) {//풀이영상일 경우
					vodContent = templateReplace(jQuery("#hidden-bottom-sheet-layer-body-content-product-vod-template").html(), [commonCLS.DATA_FORMAT_CD.풀이영상.CLS, commonCLS.DATA_FORMAT_CD.풀이영상.NM]);
				}
			}

			if (commonCLS.getDownFlag() !== commonCLS.DOWN_FLAG_CD.동영상단독) {
				expaprContent = jQuery("#hidden-bottom-sheet-layer-body-content-product-pdf-template").html();
			}

			if (menuCLS.getMenuByIsSemesterHiddenCD() != 1) {
				termHtml = templateReplace(jQuery("#hidden-bottom-sheet-layer-body-content-product-all-term-template").html(), [setAuthority.EXPAPR_TERM + "학기 " + setAuthority.EXPAPR_MIDEND]);
			}

			let previewHtml = "";

			if (commonCLS.getDownFlag() !== commonCLS.DOWN_FLAG_CD.동영상단독 && isValueEmpty(setAuthority.EXPAPR_PREVIEW_IMAGE) ==  false) {
				previewHtml = templateReplace(jQuery("#hidden-bottom-sheet-layer-body-content-product-all-preview-template").html(), [setAuthority.EXPAPR_PREVIEW_IMAGE]);
			}

			let isBeforeExamHtml = "";

			if (commonCLS.getIsBeforeExam() !== "") {
				isBeforeExamHtml= templateReplace(jQuery("#hidden-bottom-sheet-layer-body-content-product-all-grade-template").html(), ["is-tertiary", commonCLS.getIsBeforeExam()]);
			}
				
			let expaprTestYearHtml = "";
			
			if (commonCLS.getExpaprTestYear() !== "" && isArrayInValue([2025, 2026], Number(commonCLS.getExpaprTestYear()))) {
				expaprTestYearHtml= templateReplace(jQuery("#hidden-bottom-sheet-layer-body-content-product-all-grade-template").html(), ["is-tertiary", commonCLS.getExpaprTestYear()]);
			}

			bageHtml = templateReplace(jQuery("#hidden-bottom-sheet-layer-body-content-product-all-template").html(), [grade_nm, termHtml, jQuery('.' + commonCLS.FILTER.과목.CD).text(), tx_nm, setAuthority.EXPAPR_TITLE, vodContent, expaprContent, previewHtml, isBeforeExamHtml, expaprTestYearHtml]);


			html = templateReplace(jQuery("#hidden-exam-menu-header-modal-template-v2").html(), [bageHtml]);
		}
		return html;
	},
    setReDownLoadUI : function() {
        jQuery('.download__file.is-active').addClass('has-re');
        ui_updater.appendLocalStorageData(commonCLS.getExpaprNo(), commonCLS.EXPAPER_FILE_GROUP_CD.PDF.CD);
		if (isValueEmpty(commonCLS.getDownFlag()) == true || commonCLS.getDownFlag() == commonCLS.DOWN_FLAG_CD.시험지단독 || (commonCLS.getDownFlag() == commonCLS.DOWN_FLAG_CD.시험지동영상혼합 && commonCLS.getVodAuth() == commonCLS.EXPAPER_AUTHORITY.재다운로드)) {
			jQuery(".bottom_sheet_layer_body_content").remove();
			jQuery(".bottom_sheet_layer_body_info").remove();
			jQuery(".downCountInfo").hide();
		}
		jQuery(".footer__item .footer__button.is-primary .button__number").hide();//차감건수 감추기
    },
    goExpaprView : function(item) {
        examCLS.goDownloadTrack();
        examCLS.setReDownLoadUI();
		common.setCookie("btnViewerClick", "Y", 1);
        this.goExamDownload(item, 2);
    },
    goExpaprReView : function(item) {
        examCLS.goDownloadTrack();
		common.setCookie("btnViewerClick", "Y", 1);
		this.goExamDownload(item, 2)
    },
    goExpaprDownload : function(item) {
        examCLS.goDownloadTrack();
        examCLS.setReDownLoadUI();
		this.goExamDownload(item, 2)
    },
	goExamDownload : function (item, expaprGroupCD) {
        let exPaprNo = commonCLS.getExpaprNo();
        let autoDownSeq = commonCLS.getExpaprAutoDownSeq();
		let examIndex = commonCLS.getExpaprExamIndex();

		if (commonCLS.getExpaprAuth() == commonCLS.EXPAPER_AUTHORITY.재다운로드) {
			if (commonCLS.getExpaprTypeCD() == commonCLS.EXPAPER_TYPE_CD.생성) {
				Download(exPaprNo, expaprGroupCD, 0, "", autoDownSeq, examIndex);
			} else {
				Download(exPaprNo, expaprGroupCD, 0, "", "", "");
			}
		} else {
			if (commonCLS.getExpaprTypeCD() == commonCLS.EXPAPER_TYPE_CD.생성) {
				Download(exPaprNo, expaprGroupCD, 1, "", autoDownSeq, examIndex);
			} else {
				Download(exPaprNo, expaprGroupCD, 1, "", "", "");
			}
		}

		setTimeout(function() {
			modal2CLS.goBottomLayerClose();
		}, (deviceTypeChk() == "aos" ? 1000 : 0));
    },
    goExpaprReDownload : function(item) {
        examCLS.goDownloadTrack();
        this.goExamDownload(item, 2);
    },
    goDownloadTrack: function () {
        let params = {
            "expapr_no" : commonCLS.getExpaprNo(),
            "expapr_file_group_group" : commonCLS.EXPAPER_FILE_GROUP_CD.PDF.CD,
            "grade" : commonCLS.getExpaprGrade(),
            "site_id" : commonCLS.getExpaprSiteID(),
            "expapr_title" : commonCLS.getExpaprNm(),
            "pay_svc" : commonCLS.getPaySvc(),
            "authority_cd" : commonCLS.getExpaprAuth(),
            "expapr_group" : commonCLS.getExpaprGroupCD(),
            "expapr_coretype" : commonCLS.getExpaprCoreTypeCD(),
            "menu_cd" : commonGLB.getMenuCD(),
            "tx_cd" : commonGLB.getTxCD(),
            "root_part_cd" : commonGLB.getRootPartCD(),
            "subject_cd" : commonGLB.getSubjectCD(),
            "expapr_part_id" : commonCLS.getPartID(),
            "expapr_exam_index" : commonCLS.getExpaprExamIndex(),
            "expapr_auto_down_seq" : commonCLS.getExpaprAutoDownSeq(),
            "down_flag" : commonCLS.getDownFlag(),
        };
        trkCLS.setExternalEvent("7V4CTG6EQHFCIFIS9F9X1727S20250113", params);
    },
    goLandingPage : function (item) {
		modal2CLS.goBottomLayerClose();
        let url = commonCLS.URL.랜딩 + filterCLS.getSearchParam();
        appCLS.goToBrowser(url);
    },
    goPayment : function (item) {
        let params = {
            "expapr_no" : commonCLS.getExpaprNo(),
            "expapr_file_group_group" : commonCLS.EXPAPER_FILE_GROUP_CD.PDF.CD,
            "grade" : commonCLS.getExpaprGrade(),
            "site_id" : commonCLS.getExpaprSiteID(),
            "expapr_title" : commonCLS.getExpaprNm(),
            "pay_svc" : commonCLS.getPaySvc(),
            "authority_cd" : commonCLS.getExpaprAuth(),
            "expapr_group" : commonCLS.getExpaprGroupCD(),
            "expapr_coretype" : commonCLS.getExpaprCoreTypeCD(),
            "menu_cd" : commonGLB.getMenuCD(),
            "tx_cd" : commonGLB.getTxCD(),
            "root_part_cd" : commonGLB.getRootPartCD(),
            "subject_cd" : commonGLB.getSubjectCD(),
            "expapr_part_id" : commonCLS.getPartID(),
            "expapr_exam_index" : commonCLS.getExpaprExamIndex(),
            "expapr_auto_down_seq" : commonCLS.getExpaprAutoDownSeq(),
        };
        trkCLS.setExternalEvent("RBMUMPIDXQ6CDD2RQIJGWQA6420250320", params);

		modal2CLS.goBottomLayerClose();

		location.href = commonCLS.URL.상품페이지;
    },

	goCommonForHijacking : function (item, trackcd, url) {
        let params = {
            "expapr_no" : commonCLS.getExpaprNo(),
            "expapr_file_group_group" : commonCLS.EXPAPER_FILE_GROUP_CD.PDF.CD,
            "grade" : commonCLS.getExpaprGrade(),
            "site_id" : commonCLS.getExpaprSiteID(),
            "expapr_title" : commonCLS.getExpaprNm(),
            "pay_svc" : commonCLS.getPaySvc(),
            "authority_cd" : commonCLS.getExpaprAuth(),
            "expapr_group" : commonCLS.getExpaprGroupCD(),
            "expapr_coretype" : commonCLS.getExpaprCoreTypeCD(),
            "menu_cd" : commonGLB.getMenuCD(),
            "tx_cd" : commonGLB.getTxCD(),
            "root_part_cd" : commonGLB.getRootPartCD(),
            "subject_cd" : commonGLB.getSubjectCD(),
            "expapr_part_id" : commonCLS.getPartID(),
            "expapr_exam_index" : commonCLS.getExpaprExamIndex(),
            "expapr_auto_down_seq" : commonCLS.getExpaprAutoDownSeq(),
        };

		if (trackcd !== "") {
			trkCLS.setExternalEvent(trackcd, params);
		}

		modal2CLS.goBottomLayerClose();
		location.href = url;
    },
	goPaymentForHijacking : function (item, trackcd) {
        let params = {
            "expapr_no" : commonCLS.getExpaprNo(),
            "expapr_file_group_group" : commonCLS.EXPAPER_FILE_GROUP_CD.PDF.CD,
            "grade" : commonCLS.getExpaprGrade(),
            "site_id" : commonCLS.getExpaprSiteID(),
            "expapr_title" : commonCLS.getExpaprNm(),
            "pay_svc" : commonCLS.getPaySvc(),
            "authority_cd" : commonCLS.getExpaprAuth(),
            "expapr_group" : commonCLS.getExpaprGroupCD(),
            "expapr_coretype" : commonCLS.getExpaprCoreTypeCD(),
            "menu_cd" : commonGLB.getMenuCD(),
            "tx_cd" : commonGLB.getTxCD(),
            "root_part_cd" : commonGLB.getRootPartCD(),
            "subject_cd" : commonGLB.getSubjectCD(),
            "expapr_part_id" : commonCLS.getPartID(),
            "expapr_exam_index" : commonCLS.getExpaprExamIndex(),
            "expapr_auto_down_seq" : commonCLS.getExpaprAutoDownSeq(),
        };

		if (trackcd !== "") {
			trkCLS.setExternalEvent(trackcd, params);
		}

		modal2CLS.goBottomLayerClose();
        location.href = commonCLS.URL.상품페이지;
    },
	goYearChange : function(item) {
		trkCLS.setExternalEvent("U6YMIQZDSR2V32JIFMXXSOT5K20250512", "");
        modal2CLS.goBottomLayerClose();
		location.href = "/guide/yearchange/";
    },
    goShareKaKao : function (isShare) {
        let params = {
            "expapr_no" : commonCLS.getExpaprNo(),
            "expapr_file_group_group" : commonCLS.EXPAPER_FILE_GROUP_CD.PDF.CD,
            "grade" : commonCLS.getExpaprGrade(),
            "site_id" : commonCLS.getExpaprSiteID(),
            "expapr_title" : commonCLS.getExpaprNm(),
            "pay_svc" : commonCLS.getPaySvc(),
            "authority_cd" : commonCLS.getExpaprAuth(),
            "expapr_group" : commonCLS.getExpaprGroupCD(),
            "expapr_coretype" : commonCLS.getExpaprCoreTypeCD(),
            "menu_cd" : commonGLB.getMenuCD(),
            "tx_cd" : commonGLB.getTxCD(),
            "root_part_cd" : commonGLB.getRootPartCD(),
            "subject_cd" : commonGLB.getSubjectCD(),
            "expapr_part_id" : commonCLS.getPartID(),
            "expapr_exam_index" : commonCLS.getExpaprExamIndex(),
            "expapr_auto_down_seq" : commonCLS.getExpaprAutoDownSeq(),
        };
        trkCLS.setExternalEvent("OW3WUAV8UVPFZPFCHGNSJIMY720240905", params);

		let couponType = jQuery("#hidden-modal-popup-kakao-student-coupon-template").html();
		if (TRK_GLB_TOGGLE_GROUP == "T") {
			couponType = jQuery("#hidden-modal-popup-kakao-teacher-coupon-template").html();
		}

        if (isShare == "Y") {
            jQuery.ajax({
                url: commonCLS.URL.공유하기로그적재,
                error: function(request, status, error) {
                    alert('code:' + request.status + '\n' + 'message:' + request.responseText + '\n' + 'error:' + error);
                },
                success: function(data) {
                    examCLS.goKaKao();
					modal2CLS.goBottomLayerClose();
					jQuery("#alertpop").show();
					jQuery("#div_share_Y").show();
                }
            });
        } else {
            examCLS.goKaKao();
			modal2CLS.goBottomLayerClose();
        }
    },
    goKaKao : function() {
        var kakao_title;
		var kakao_description;
		var m_url;
		var www_url;
		var bottomBtnTxt;
		var kakao_image = "";
		var share_Group = "C";

		if(TRK_GLB_MEM_GROUP == "T") {
			kakao_title = "[선생님 이번 수업은 편하게 준비해요.]\n\n";
			kakao_description = TRK_GLB_USER_NAME + " 선생님의 강력 추천!\n매번 수업 자료 만드느라 고생 많으시죠?\n단 2분이면 문제지 제작 완료!\n족보 클라우드에서 효율적인 수업 준비를 해보세요!";
			bottomBtnTxt = "편하게 자료 만들기";
			share_Group = "T";
		} else {
			kakao_title = "[내신 대비 꿀자료 공유]\n\n";
			kakao_description = "너 이번 시험 어떻게 공부하고 있어?\n내가 족보닷컴에서 우리 학교 맞춤 자료 찾아봤는데, 이거 진짜 너한테 꼭 필요할거 같아서 공유해.\n지금 바로 확인해 보고 시험에 꼭 활용해 봐!";
			bottomBtnTxt = "추천 꿀자료 확인하기";
		}

		m_url = jQuery("#m_zocbo_url").val() + commonCLS.URL.공유하기인입페이지 + enc_user_id + "&share_group=" + share_Group;
		www_url = m_url;

		kakaoCLS.init(kakao_title, kakao_description, kakao_image, m_url, www_url, bottomBtnTxt, 'text');
    },
	goNotServicePartCheck : function(partCD, rootpart_code) {
		let detailPartList = new Array();
		let isTxCode15 = false;

		if(season_State == "N" && (commonGLB.getMenuCD().slice(0, 10) == "0000100004" || commonGLB.getMenuCD().slice(0, 10) == "0000200004")) {
			menuCLS.goSelectedMenu(99, commonGLB.getMenuCD(), "");
			event.stopPropagation();
            event.stopImmediatePropagation();
			return false;
		}

        if (jQuery("#" + partCD).find('.download__button').length == 0) {
			if ((commonGLB.getMenuCD() == "000010000300005" || commonGLB.getMenuCD() == "000020000300005") && commonGLB.getGrade() == 2) {
				return false;
			}

			if (isArrayInValue(filterCLS.BEFORE_TX15_MENU_LIST, commonGLB.getMenuCD())) {
				let selectedPartCD = partCD.replace("PART_CD_", "");
				let selectedItem = "";

				if (filterCLS.PART_USE_CD == 1) {
					selectedItem = filterCLS.ARRAY_MENU_EXAM_PART_END.find(x => x.rootCd === selectedPartCD);
				} else if (filterCLS.PART_USE_CD == 2) {
					selectedItem = filterCLS.ARRAY_MENU_EXAM_PART_END.find(x => x.contentCd === selectedPartCD);
				} else {
					selectedItem = filterCLS.ARRAY_MENU_EXAM_PART_END.find(x => x.rootCd === rootpart_code && x.subCd === selectedPartCD.substring(3, 4) && x.detailCd != "");
					detailPartList = filterCLS.ARRAY_MENU_EXAM_PART_END.filter(x => x.rootCd === rootpart_code && x.subCd === selectedPartCD.substring(3, 4) && x.detailCd != "");

					detailPartList.forEach(item => {
						let selectedRootPartCD 	= item.rootCd;
						let selectedSubPartCD 	= item.subCd;
						let selectedDetailPartCD = item.detailCd;

						let beforePartData = filterCLS.getBeforePartData(filterCLS.PART_USE_CD, selectedRootPartCD, selectedSubPartCD, selectedDetailPartCD);
						if (!isValueEmpty(beforePartData.TX_CODE_15)) {
							isTxCode15 = true;
						}
					});
				}

				if (isValueEmpty(selectedItem)) {
					return false;
				}

				if (isTxCode15) {
					detailPartList.forEach(item => {
						let selectedRootPartCD 	= item.rootCd;
						let selectedSubPartCD 	= item.subCd;
						let selectedDetailPartCD = item.detailCd
						let beforePartData = {};

						beforePartData = filterCLS.getBeforePartData(filterCLS.PART_USE_CD, selectedRootPartCD, selectedSubPartCD, selectedDetailPartCD);

						if (!isValueEmpty(beforePartData.TX_CODE_15)) {
							filterCLS.goBeforeExamSearch(partCD, selectedRootPartCD, beforePartData, item);
						} else {
							filterCLS.setOpenMonthPart(partCD, selectedRootPartCD, selectedItem);
						}
					});
				} else {
					let selectedRootPartCD 	= selectedItem.rootCd;
					let selectedSubPartCD 	= selectedItem.subCd;
					let selectedDetailPartCD = selectedItem.detailCd;

					let beforePartData = filterCLS.getBeforePartData(filterCLS.PART_USE_CD, selectedRootPartCD, selectedSubPartCD, selectedDetailPartCD);

					if (!isValueEmpty(beforePartData.TX_CODE_15)) {
						filterCLS.goBeforeExamSearch(partCD, selectedRootPartCD, beforePartData, selectedItem);
					} else {
						filterCLS.setOpenMonthPart(partCD, selectedRootPartCD, selectedItem)
					}
				}
			} else {
				if (menuCLS.IsSoopring(commonGLB.getMenuCD())) {
					event.stopPropagation();
           			event.stopImmediatePropagation();

					return false;
				} else {
					filterCLS.goExamTransferPartData(rootpart_code);
				}
			}

            return false;
        }
    },
	goNotServicePartCheckV2 : function(partCD, rootpart_code) {
		let detailPartList = new Array();
		let isTxCode15 = false;

		if(season_State == "N" && (commonGLB.getMenuCD().slice(0, 10) == "0000100004" || commonGLB.getMenuCD().slice(0, 10) == "0000200004")) {
			menuCLS.goSelectedMenu(99, commonGLB.getMenuCD(), "");
			event.stopPropagation();
            event.stopImmediatePropagation();
			return false;
		}

		if (jQuery("#" + partCD).find('.download').length == 0 || (isArrayInValue(filterCLS.BEFORE_TX15_MENU_LIST, commonGLB.getMenuCD()) && jQuery("#" + partCD).find('.download .is-before').length == 0)) {
			if ((commonGLB.getMenuCD() == "000010000300005" || commonGLB.getMenuCD() == "000020000300005") && commonGLB.getGrade() == 2) {
				return false;
			}

			if (isArrayInValue(filterCLS.BEFORE_TX15_MENU_LIST, commonGLB.getMenuCD())) {
				let selectedPartCD = partCD.replace("PART_CD_", "");
				let selectedItem = "";

				if (filterCLS.PART_USE_CD == 1) {
					selectedItem = filterCLS.ARRAY_MENU_EXAM_PART_END.find(x => x.rootCd === selectedPartCD);
				} else if (filterCLS.PART_USE_CD == 2) {
					selectedItem = filterCLS.ARRAY_MENU_EXAM_PART_END.find(x => x.contentCd === selectedPartCD);
				} else {
					selectedItem = filterCLS.ARRAY_MENU_EXAM_PART_END.find(x => x.rootCd === rootpart_code && x.subCd === selectedPartCD.substring(3, 4) && x.detailCd != "");
					detailPartList = filterCLS.ARRAY_MENU_EXAM_PART_END.filter(x => x.rootCd === rootpart_code && x.subCd === selectedPartCD.substring(3, 4) && x.detailCd != "");

					detailPartList.forEach(item => {
						let selectedRootPartCD 	= item.rootCd;
						let selectedSubPartCD 	= item.subCd;
						let selectedDetailPartCD = item.detailCd;

						let beforePartData = filterCLS.getBeforePartData(filterCLS.PART_USE_CD, selectedRootPartCD, selectedSubPartCD, selectedDetailPartCD);
						if (!isValueEmpty(beforePartData.TX_CODE_15)) {
							isTxCode15 = true;
						}
					});
				}

				if (isValueEmpty(selectedItem)) {
					return false;
				}

				if (isTxCode15) {
					detailPartList.forEach(item => {
						let selectedRootPartCD 	= item.rootCd;
						let selectedSubPartCD 	= item.subCd;
						let selectedDetailPartCD = item.detailCd
						beforePartData = {};

						beforePartData = filterCLS.getBeforePartData(filterCLS.PART_USE_CD, selectedRootPartCD, selectedSubPartCD, selectedDetailPartCD);

						if (!isValueEmpty(beforePartData.TX_CODE_15)) {
							filterCLS.setBeforeExamContent(partCD, selectedRootPartCD, beforePartData, filterCLS.PART_USE_CD);

						} else {
							if (jQuery("#" + partCD).find('.download__button').length == 0) {
								filterCLS.setOpenMonthPart(partCD, selectedRootPartCD, selectedItem);
							}
						}
					});
				} else {
					let selectedRootPartCD 	= selectedItem.rootCd;
					let selectedSubPartCD 	= selectedItem.subCd;
					let selectedDetailPartCD = selectedItem.detailCd;
					let lastPartUseCD = filterCLS.PART_USE_CD;

					let beforePartData = filterCLS.getBeforePartData(lastPartUseCD, selectedRootPartCD, selectedSubPartCD, selectedDetailPartCD);

					if (!isValueEmpty(beforePartData.TX_CODE_15)) {
						filterCLS.setBeforeExamContent(partCD, selectedRootPartCD, beforePartData, lastPartUseCD);
					} else {
						if (jQuery("#" + partCD).find('.download__button').length == 0) {
							filterCLS.setOpenMonthPart(partCD, selectedRootPartCD, selectedItem)
						}
					}

					let zbAcordionButton = document.querySelectorAll('.zbAccordion__button');
					zbAcordionButton.forEach(function (item) { item.style.pointerEvents = 'auto'; });
					VOD_ui_updater.setUI();
					ui_updater.setUI();
				}
			} else {
				if (menuCLS.IsSoopring(commonGLB.getMenuCD())) {
					event.stopPropagation();
           			event.stopImmediatePropagation();

					return false;
				} else {
					filterCLS.goExamTransferPartData(rootpart_code);
				}
			}

            return false;
        }
    },
    goSurvey : function () {
		let surveyUrl = "https://forms.gle/Q7KCL1Z2d64eKPL49"; //설문 조사 링크
		trkCLS.setExternalEvent("F99TCFFMZ1MRS3X6C39VPCQSI20250519");
        window.open(surveyUrl);
    },
    goVodTrack: function () {
		return;//이후 모바일웹용이 따로 나오거나 servicetype으로 본다고 하면 return제거
        let params = {
            "expapr_no" : commonCLS.getExpaprNo(),
            "grade" : commonCLS.getVodExpaprGrade(),
            "site_id" : commonCLS.getVodExpaprSiteID(),
            "expapr_title" : commonCLS.getExpaprNm(),
            "pay_svc" : commonCLS.getVodPaySvc(),
            "expapr_group" : commonCLS.getVodExpaprGroupCD(),
            "expapr_coretype" : commonCLS.getVodExpaprCoreTypeCD(),
            "menu_cd" : commonGLB.getMenuCD(),
            "tx_cd" : commonGLB.getTxCD(),
            "root_part_cd" : commonGLB.getRootPartCD(),
            "subject_cd" : commonGLB.getSubjectCD(),
            "authority_cd" : commonCLS.getVodAuth(),
            "vod_no" : commonCLS.getVodNo(),
            "vod_title" : commonCLS.getVodTitle(),
            "vod_type" : commonCLS.getVodType(),
            "down_flag" : commonCLS.getDownFlag(),
        };

		let trackCd = "QYAMNBB86B19MNF4ZRZCI5DS320250728";//문제 리스트 영상 재생
        trkCLS.setExternalEvent(trackCd, params);
    },
	// 영상 실행
	goVodLayer : function(item) {
		if (isValueEmpty(commonCLS.getVodNo()) == true || isValueEmpty(commonCLS.getVodAuth()) == true) {
			alert(commonCLS.EXPAPER_AUTHORITY_ERROR.필수값누락.MSG);
			return;
		}

        jQuery.ajax({
			type : "GET",
			dataType:'json',
			url : commonCLS.URL.동영상차감및로그,
			data: {
				"menuCD": commonGLB.getMenuCD(),
				"authType": commonCLS.getVodAuth(),
				"vodNo": commonCLS.getVodNo(),
				"os-type" : appCLS.getOS(),
			},
            success: function(responseJson) {
                if (responseJson.RESULT == "false") {
                    let code = Number(responseJson.RESULT_CODE);
                    switch (code) {
                        case commonCLS.EXPAPER_AUTHORITY_ERROR.미로그인.CD:
                            examCLS.goToLogin();
                            break;
                        case commonCLS.EXPAPER_AUTHORITY_ERROR.필수값누락.CD:
                            alert(commonCLS.EXPAPER_AUTHORITY_ERROR.필수값누락.MSG);
                            break;
						case commonCLS.EXPAPER_AUTHORITY_ERROR.동영상정보없음.CD:
                            alert(commonCLS.EXPAPER_AUTHORITY_ERROR.동영상정보없음.MSG);
                            break;
                    }
                } else {
					let vodUrl = responseJson.APP_VOD_URL;
					let vodTitle = responseJson.VOD_TITLE;
					let vodType = responseJson.VOD_TYPE;
					let expaprNo = responseJson.EXPAPR_NO;     // 기본값은 0, TWEEZERS일 경우만 TB_VOD_INFO 에 expapr_no 값 사용
					let fileCode = responseJson.FILE_CODE;     // 동영상 코드
					let curriIdx = responseJson.CURRI_IDX;
					let defaultIndex = 0;    // 고정

					if (vodType == "TWEEZERS") {
						mappingKey = responseJson.EXPAPR_NO;
					}

					storage.setSession(storage.VOD_TITLE, vodTitle);
                    storage.setSession(storage.VOD_TYPE, vodType);
                    examCLS.goVodTrack();

					//영상 실행
					player.playerRun2(commonCLS.getVodNo());
					//player.vodPlayer(expaprNo, vodTitle, vodType, expaprNo, curriIdx, 1, vodTitle, fileCode);
					//동영상 재시청 표기
					examCLS.setReVodUI(vodType);
					modal2CLS.goBottomLayerClose();//팝업 닫기
                }
            },
            error: function(request, exception) {
				return false;
			}
		});
	},
	setReVodUI : function(vodType) {
        //동영상 재시청 표기
		if (jQuery(".vod_download_" + commonCLS.getVodNo()).hasClass('is-re') == false) {
			jQuery(".vod_download_" + commonCLS.getVodNo()).children('.button__text').addClass("is-re");
			jQuery(".vod_download_" + commonCLS.getVodNo()).children('.button__text').removeClass("is-primary");
            jQuery(".vod_download_" + commonCLS.getVodNo()).children('.button__text').removeClass("is-secondary");
		}
		VOD_ui_updater.appendLocalStorageData(commonCLS.getVodNo(), vodType, vodType);

		if (isValueEmpty(commonCLS.getDownFlag()) == true || commonCLS.getDownFlag() == commonCLS.DOWN_FLAG_CD.동영상단독 || (commonCLS.getDownFlag() == commonCLS.DOWN_FLAG_CD.시험지동영상혼합 && commonCLS.getExpaprAuth() == commonCLS.EXPAPER_AUTHORITY.재다운로드)) {
			jQuery(".bottom_sheet_layer_body_content").remove();
			jQuery(".bottom_sheet_layer_body_info").remove();
			jQuery(".downCountInfo").hide();
		}
		storage.removeLocal(storage.VOD_NO);
    },
	noAuth(isShare){
		let bodyHtml="";
		let footerHtml="";

		if (isValueEmpty(examCLS.noAuthAuthorityInfo) == false) {
			if (examCLS.noAuthAuthorityInfo.AUTHORITY_TYPE == commonCLS.EXPAPER_AUTHORITY.추천상품) {
				var kakaoShare_content = "공유하면 다운로드 1회 무료 제공<br>친구가 가입하면 3회 추가 제공";

				if(TRK_GLB_MEM_GROUP == "T") {
					kakaoShare_content = "공유하면 편집 1회&middot;문제은행 1일 제공<br>받은 사람 가입시 편집 3회&middot;문제은행 1일 추가 제공";
				}

				bodyHtml = templateReplace(jQuery("#hidden-exam-body-no-auth-modal-template").html(), [kakaoShare_content, ""]);
				footerHtml = share_content_show_yn == true ? templateReplace(jQuery("#hidden-exam-footer-zocbo-no-auth-modal-template").html(), [isShare, examCLS.share_btn_name]) : jQuery("#hidden-no-share-exam-footer-zocbo-no-auth-modal-template").html();
			} else if(examCLS.noAuthAuthorityInfo.AUTHORITY_TYPE == commonCLS.EXPAPER_AUTHORITY.학년변경) {
				bodyHtml = jQuery("#hidden-exam-body-zocbo-yearchange-modal-template").html();
				footerHtml = templateReplace(jQuery("#hidden-exam-footer-zocbo-yearchange-modal-template").html(), [isShare]);
			}
		}
		modal2CLS.setBottomHeader(jQuery("#hidden-bottom-sheet-layer-header-close-template").html());
		modal2CLS.setBottomBody(bodyHtml);
		modal2CLS.setBottomFooter(footerHtml);

		let hijackingPromotionTargetCD = commonCLS.getHijackingPromotionTargetCD();
		let hijackingPromotionTargetDay = commonCLS.getHijackingPromotionTargetDay();
		let hijackingPromotionTargetDisrate = commonCLS.getHijackingPromotionTargetDisrate();
		let share_discount_coupon_YN = commonCLS.getShareDiscountCouponYN();
		let share_discount_coupon_Exist_YN = commonCLS.getShareDiscountCouponExistYN();
		let hijackingPromotionHtml = "";

		if (share_discount_coupon_YN !== "Y" && share_discount_coupon_Exist_YN !== "Y" ) {
			if (TRK_GLB_TOGGLE_GROUP == "T") {
				// 티칭 재결제
				if (TRK_GLB_IS_4Q_CLOSED_TEACHING_REPAYMENT_PROMOTION_TARGET) {
					hijackingPromotionHtml = templateReplace(jQuery("#hidden-hijacking-teacher-sub-template").html(), [TRK_GLB_PROMOTION_TARGET_DAY, hijackingPromotionTargetDisrate, TRK_GLB_OPEN_PROMOTION_TARGET_DAY]);
				} else {
					// 티칭 폐쇠형
					if (TRK_GLB_IS_CLOSED_TEACHING_PROMOTION_DISPLAY_TARGET) {
						hijackingPromotionHtml = templateReplace(jQuery("#hidden-hijacking-teacher-sub-template").html(), [TRK_GLB_PROMOTION_TARGET_DAY, hijackingPromotionTargetDisrate, TRK_GLB_OPEN_PROMOTION_TARGET_DAY]);
					} else {
						// 티칭 오픈형
						if (TRK_GLB_IS_OPEN_TEACHING_PROMOTION_DISPLAY_TARGET) {
							hijackingPromotionHtml = templateReplace(jQuery("#hidden-hijacking-teacher-open-template").html(), [TRK_GLB_OPEN_PROMOTION_TARGET_DAY, hijackingPromotionTargetDisrate]);
						}
					}
				}
			} else {
				// 러닝 재결제
				if (TRK_GLB_IS_4Q_CLOSED_LEARNING_REPAYMENT_PROMOTION_TARGET) {
					hijackingPromotionHtml = templateReplace(jQuery("#hidden-hijacking-student-3q-rep-template").html(), [TRK_GLB_PROMOTION_TARGET_DAY, hijackingPromotionTargetDisrate]);
				} else {
					// 러닝 폐쇄형
					if (TRK_GLB_IS_CLOSED_LEARNING_PROMOTION_DISPLAY_TARGET) {
						switch (TRK_GLB_MEMBER_PROMOTION_GRADE) {
							case commonGLB.PROMOTION_GRADE.중1:
								hijackingPromotionHtml = templateReplace(jQuery("#hidden-hijacking-student-3q-m1-template").html(), [TRK_GLB_PROMOTION_TARGET_DAY, hijackingPromotionTargetDisrate]);
								break;
							case commonGLB.PROMOTION_GRADE.중2:
								hijackingPromotionHtml = templateReplace(jQuery("#hidden-hijacking-student-3q-m2-template").html(), [TRK_GLB_PROMOTION_TARGET_DAY, hijackingPromotionTargetDisrate]);
								break;
							case commonGLB.PROMOTION_GRADE.중3:
								if (TRK_GLB_IS_3Q_3M_SHORT_TERM_LEARNING_PROMOTION) {
									hijackingPromotionHtml = templateReplace(jQuery("#hidden-hijacking-student-m3-short-template").html(), [TRK_GLB_3M_SHORT_PROMOTION_TARGET_DAY, hijackingPromotionTargetDisrate]);
								} else {
									hijackingPromotionHtml = templateReplace(jQuery("#hidden-hijacking-student-3q-m3-template").html(), [TRK_GLB_PROMOTION_TARGET_DAY, hijackingPromotionTargetDisrate]);
								}
								//hijackingPromotionHtml = templateReplace(jQuery("#hidden-hijacking-student-prego12027-template").html(), [TRK_GLB_PROMOTION_TARGET_DAY, hijackingPromotionTargetDisrate]);
								break;
							case commonGLB.PROMOTION_GRADE.고1:
								hijackingPromotionHtml = templateReplace(jQuery("#hidden-hijacking-student-3q-h1-template").html(), [TRK_GLB_PROMOTION_TARGET_DAY, hijackingPromotionTargetDisrate]);
								break;
							case commonGLB.PROMOTION_GRADE.고2:
								hijackingPromotionHtml = templateReplace(jQuery("#hidden-hijacking-student-3q-h2-template").html(), [TRK_GLB_PROMOTION_TARGET_DAY, hijackingPromotionTargetDisrate]);
								break;
						}
					} else {
						// 러닝 오픈형
						if (TRK_GLB_IS_OPEN_LEARNING_PROMOTION_DISPLAY_TARGET) {
							hijackingPromotionHtml = templateReplace(jQuery("#hidden-hijacking-student-3q-dft-template").html(), [TRK_GLB_OPEN_PROMOTION_TARGET_DAY, hijackingPromotionTargetDisrate]);
						}
					}
				}
			}

			if (isValueEmpty(hijackingPromotionHtml) == false) {
				jQuery("#hijackingPopupBanner").html(hijackingPromotionHtml);
				jQuery("#hijackingPopupBanner").show();
			}
		}

		jQuery(".rewardsInform__small").css("marginBottom", "0px");
		jQuery(".rewardsInform__small").css("text-align", "center");
		jQuery(".footer__button.is-secondary.has-color").css("marginLeft", "0px");

		modal2CLS.goBottomLayerOpen();
	},
    getGradeName: function () {
        let gradeName = "";
        let grade = commonGLB.getGrade();
        let siteId = commonGLB.getSiteID();

		if (commonGLB.getMenuCD().slice(0, 10) == "0000100006" || commonGLB.getMenuCD().slice(0, 10) == "0000100007" || commonGLB.getMenuCD().slice(0, 10) == "0000100008") {
			gradeName = "예비중1";
		} else if (Number(grade) == 0) {
            switch (siteId) {
                case "M":
                    gradeName = "중등 전학년";
                    break;
                case "H":
                    gradeName = "고등 전학년";
                    break;
            }
        } else {
            gradeName = jQuery("." + commonCLS.FILTER.학년.CD).text();
        }

        return gradeName;
    },
	getGradeBage: function () {
		let gradeBage = "";
		let gradeBageClass = "is-tertiary";
		let gradeName = examCLS.getGradeName();

		if (gradeName == "예비중1") {
			gradeBageClass = "is-premid";
		}

		gradeBage = templateReplace(jQuery("#hidden-bottom-sheet-layer-body-content-product-all-grade-template").html(), [gradeBageClass, gradeName]);

		return gradeBage;
	},
	goHijackingPayment : function () {
		let pay_url =  jQuery("#hijacking_pay_url").val();

		if (TRK_GLB_MEM_GROUP == "T") {
			trkCLS.setExternalEvent("4DEOH22983KLXMH9LM1HQNP4A20250616", "");
		} else {
			trkCLS.setExternalEvent("YMWOTQFRVIK6VCAIYQSJRBIDL20250616", "");
		}

        appCLS.goToBrowser(pay_url);
	},
    goAnswerView : function() {
        if (isValueEmpty(commonCLS.getExpaprNo()) == true || isValueEmpty(commonCLS.getAnswerAuth()) == true) {
            alert(commonCLS.EXPAPER_AUTHORITY_ERROR.필수값누락.MSG);
            return;
        }

        jQuery.ajax({
			type : "GET",
			dataType:'json',
			url : commonCLS.URL.정답차감및로그,
			data: {
				"menuCD": commonGLB.getMenuCD(),
				"authType": commonCLS.getAnswerAuth(),
				"expaprNo": commonCLS.getExpaprNo(),
				"os-type" : appCLS.getOS(),
			},
            success: function(responseJson) {
                if (responseJson.RESULT == "false") {
                    let code = Number(responseJson.RESULT_CODE);
                    switch (code) {
                        case commonCLS.EXPAPER_AUTHORITY_ERROR.미로그인.CD:
                            examCLS.goToLogin();
                            break;
                        case commonCLS.EXPAPER_AUTHORITY_ERROR.필수값누락.CD:
                            alert(commonCLS.EXPAPER_AUTHORITY_ERROR.필수값누락.MSG);
                            break;
                        case commonCLS.EXPAPER_AUTHORITY_ERROR.정답정보없음.CD:
                            alert(commonCLS.EXPAPER_AUTHORITY_ERROR.정답정보없음.MSG);
                            break;
                    }
                } else {
					trkCLS.setExternalEvent("94MGD57S5CF5A3HAGV4L5GSJA20250917", "");
                    appCLS.showAnswer();
                }
            },
            error: function(request, exception) {
				return false;
			}
		});
    },
    getMenuByBottomSheetSet : function () {
        let res = false;
        let studentAndParentNoShareMenu = ["000010000500003", "000020000500003", "000010000400001", "000020000400001", "000010000400002", "000020000400002"];
        let teacherNoShareMenu = ["0000100001", "0000200001", "0000100003", "0000200003"];

        if (isArrayInValue(["S", "P"], TRK_GLB_MEM_GROUP)) {
            if (isArrayInValue(studentAndParentNoShareMenu, commonGLB.getMenuCD())) {
                res = true;
            }
        } else {
            if (isArrayInValue(teacherNoShareMenu, commonGLB.getMenuCD().slice(0,10))) {
                res = true;
            }
        }

        // 공통 제외 메뉴
        if (!res) {
            if (isArrayInValue(this.menuByNoSharePopupList, commonGLB.getMenuCD())) {
                res = true;
            } else if (isArrayInValue(this.rootMenuByNoSharePopupList, commonGLB.getMenuCD().slice(0,10))) {
                res = true;
            }
        }

        // 영상콘텐츠는 무조건 제외
        if (commonCLS.getDownFlag() == commonCLS.DOWN_FLAG_CD.동영상단독 || commonCLS.getDownFlag() == commonCLS.DOWN_FLAG_CD.시험지동영상혼합) {
            res = true;
        }

        return res
    },
	setMarketingPopup : function () {
        modalCLS.popupOpen();
        modalCLS.setBodyContent(templateReplace(jQuery("#hidden-exam-marketing-popup-template").html(), ["예비중1 기초학력진단평가"]));
        modalCLS.setFooter(jQuery("#hidden-exam-marketing-popup-footer-template").html());
    },
	getMarketingChk : function() {
		jQuery.ajax({
			url: commonCLS.URL.마케팅수신동의조회,
			dataType:"json",
			async: false,
			success: function(responseJson) {
				if (responseJson.RESULT == "true") {
					if (responseJson.RESULT_CODE == 0) {
						examCLS.marketing_chk = false;
						examCLS.setMarketingPopup();
						return;
					} else {
						examCLS.marketing_chk = true;
					}
				}
			},
			error: function(request, exception) {
				alert("일시적인 오류가 발생하였습니다. 잠시 후 다시 시도해주세요.");
			}
		})
	},
	setMarketing : function() {
		let msg = this.getTimeStamp() + " 에 마케팅 수신 동의가 완료되었습니다.\n수신거부 : 마이페이지 > 회원정보관리";

		jQuery.ajax({
			url: commonCLS.URL.마케팅수신동의수정,
			dataType:"json",
			async: false,
			success: function(responseJson) {
				if (responseJson.RESULT == "true") {
					if (responseJson.RESULT_CODE == 0) {
						this.marketing_chk = true;
						alert(msg);
                        //modalClose(this);
						jQuery("#commonModel").removeClass("is-active");
					} else {
						alert("일시적인 오류가 발생하였습니다. 잠시 후 다시 시도해주세요.");
					}
				}
			},
			error: function(request, exception) {
				alert("일시적인 오류가 발생하였습니다. 잠시 후 다시 시도해주세요.");
			}
		})
	},
	getTimeStamp : function() {
		var d = new Date();

		var s =
		this.leadingZeros(d.getFullYear(), 4) + '-' +
		this.leadingZeros(d.getMonth() + 1, 2) + '-' +
		this.leadingZeros(d.getDate(), 2) + ' ' +
		this.leadingZeros(d.getHours(), 2) + ':' +
		this.leadingZeros(d.getMinutes(), 2) + ':' +
		this.leadingZeros(d.getSeconds(), 2);

		return s;
	},
	leadingZeros : function (n, digits) {
		var zero = '';
		n = n.toString();

		if (n.length < digits) {
			for (i = 0; i < digits - n.length; i++)
			zero += '0';
		}

		return zero + n;
	},
	goToLogin : function() {
		jQuery("#commonModel").removeClass("is-active");
		loginPop.show("", _rtnUrl, false);
	},
	goLoginLayerOpen : function() {
        modal2CLS.goBottomLayerClose();
        loginPop.show("", _rtnUrl, false);
    },
	goJoinLayerOpen : function() {
        modal2CLS.goBottomLayerClose();
		trkCLS.setExternalEvent("ID7P78JVPM4UCQRMX27HUOY8W20250403", "");
		location.href = $("#sign_url").val();
    },
	setNotLogin : function() {
        modal2CLS.setBottomHeader(examCLS.getHeaderHtml(null, null));

		modal2CLS.setBottomBody(jQuery("#hidden-exam-not-login-toggle_teacher-body-modal-template").html());
        modal2CLS.setBottomFooter(jQuery("#hidden-exam-footer-not-login-modal-template").html());

		// 미로그인 시.... 하이재킹 배너가 나와야한다 하여.... 여기에 추가....
		
		if (TRK_GLB_IS_OPEN_PROMOTION_DISPLAY_TARGET) {
			if (TRK_GLB_TOGGLE_GROUP == "T") { // 수학
				jQuery("#hijackingPopupBanner").html(templateReplace(jQuery("#hidden-hijacking-teacher-open-template").html(), [TRK_GLB_OPEN_PROMOTION_TARGET_DAY, '']));
				jQuery("#hijackingPopupBanner").show();
			} else {
				// 여기 작업
				jQuery("#hijackingPopupBanner").html(templateReplace(jQuery("#hidden-hijacking-student-3q-dft-template").html(), [TRK_GLB_OPEN_PROMOTION_TARGET_DAY, '']));
				jQuery("#hijackingPopupBanner").show();
			}
		}

		modal2CLS.setBody("");

        modal2CLS.goBottomLayerOpen();
    },
	//수학 Master 페이지 이동
	goMathMaster : function() {
		var siteID = commonGLB.getSiteID();
		var grade = commonGLB.getGrade();
		var url = "";

		if (siteID == "H") {//고등
			url = "/H/?menu=4&group=1";

			if (grade == 2) {
				url = url + "&subject=5"
			} else {
				url = url + "&subject=2"
			}
		} else {//중등
			url = "/M/?menu=4&group=1&subject=2";
		}

		url = url + "&grade=" + grade.toString();

		location.href = url;
	},
	//최상위 공략 페이지로 이동
	goExamTopTable : function(obj, imgPath) {
		var siteID = commonGLB.getSiteID();
		var grade = commonGLB.getGrade();
		var subjectIndex = jQuery("#filterSubjectTitleMain li.is-active").index();
		var url = "";

		if (siteID == "H") {//고등
			url = "/H/exam_top_table.asp?group=3";

			if (grade = 2) {//2.3학년일때 과목값 0으로 셋팅
				subjectIndex = 0;
			}

			if (subjectIndex > 5) {
				subjectIndex = 0;
			}
		} else {//중등
			url = "/M/exam_top_table.asp?group=3";

			if (subjectIndex > 5) {
				subjectIndex = 0;
			}
		}

		url = url + "&subject=" + subjectIndex.toString();
		url = url + "&grade=" + grade.toString();

		location.href = url;
	},
	goPrevPart : function() {
        let subjectIndex = 2;

        if (commonGLB.getSiteID() == "M") {
            subjectIndex = commonGLB.getSubjectCD() == "SC" ? 3 : 2 ;
        } else {
            switch (commonGLB.getSubjectCD()) {
                case "MT":
                    subjectIndex = 2;
                    break;
                case "SC":
                    subjectIndex = 3;
                    break;
                case "LS":
                    subjectIndex = 4;
                    break;
                case "HI":
                    subjectIndex = 5;
                    break;
            }
        }

        location.href = "/"+ commonGLB.getSiteID() + "/?menu=4&oldData=Y&subject=" + subjectIndex;
    }
};