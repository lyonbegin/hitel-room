const filterFinalCLS = {
    ARRAY_PART_CD : Array(),   
    getTermHTML : function() {
        let today = new Date();
		let html = "";

        if (commonGLB.getSiteID() == "M" && commonGLB.getGrade() == "3") { 
            switch (GLB_PREPARATION_FINAL_SEASON_M3_VAL) {
                case commonCLS.TERM["1학기중간"]:				
                    html = templateReplace(jQuery("#hidden-exam-part-term-item-template").html(), ["1학기 중간 🔥"]);
                    break;
                case commonCLS.TERM["1학기기말"]:
                    html = templateReplace(jQuery("#hidden-exam-part-term-item-template").html(), ["1학기 기말 🔥"]);
                    break;
                case commonCLS.TERM["2학기중간"]:
                    html = templateReplace(jQuery("#hidden-exam-part-term-item-template").html(), ["2학기 중간 🔥"]);
                    break;
                case commonCLS.TERM["2학기기말"]:
                    html = templateReplace(jQuery("#hidden-exam-part-term-item-template").html(), ["2학기 기말 🔥"]);
                    break;
            }
        } else {
            switch (GLB_PREPARATION_FINAL_SEASON_VAL) {
                case commonCLS.TERM["1학기중간"]:				
                    html = templateReplace(jQuery("#hidden-exam-part-term-item-template").html(), ["1학기 중간 🔥"]);
                    break;
                case commonCLS.TERM["1학기기말"]:
                    html = templateReplace(jQuery("#hidden-exam-part-term-item-template").html(), ["1학기 기말 🔥"]);
                    break;
                case commonCLS.TERM["2학기중간"]:
                    html = templateReplace(jQuery("#hidden-exam-part-term-item-template").html(), ["2학기 중간 🔥"]);
                    break;
                case commonCLS.TERM["2학기기말"]:
                    html = templateReplace(jQuery("#hidden-exam-part-term-item-template").html(), ["2학기 기말 🔥"]);
                    break;
            }
        }

		return html;
	},
    getTitleHTML : function() {
        let today = new Date();
		let html = "";

        if (commonGLB.getSiteID() == "M" && commonGLB.getGrade() == "3") {
            switch (GLB_PREPARATION_FINAL_SEASON_M3_VAL) {
                case commonCLS.TERM["1학기중간"]:				
                    html = today.getFullYear() + "년 1학기 중간 대비";
                    break;
                case commonCLS.TERM["1학기기말"]:
                    html = today.getFullYear() + "년 1학기 기말 대비";
                    break;
                case commonCLS.TERM["2학기중간"]:
                    html = today.getFullYear() + "년 2학기 중간 대비";
                    break;
                case commonCLS.TERM["2학기기말"]:
                    html = today.getFullYear() + "년 2학기 기말 대비";
                    break;
            }
        } else {
            switch (GLB_PREPARATION_FINAL_SEASON_VAL) {
                case commonCLS.TERM["1학기중간"]:				
                    html = today.getFullYear() + "년 1학기 중간 대비";
                    break;
                case commonCLS.TERM["1학기기말"]:
                    html = today.getFullYear() + "년 1학기 기말 대비";
                    break;
                case commonCLS.TERM["2학기중간"]:
                    html = today.getFullYear() + "년 2학기 중간 대비";
                    break;
                case commonCLS.TERM["2학기기말"]:
                    html = today.getFullYear() + "년 2학기 기말 대비";
                    break;
            }
        }

		return html;
	},
    getPart : function (selectedItem) {
		if (TRK_GLB_IS_LOGIN == false) {//비로그인 시 로그인페이지
			if (TRK_GLB_SERVICE_TYPE_CD == 2) {//모바일웹인 경우
				loginPop.show("", _rtnUrl, false);
			} else {
				appCLS.goToLogin();
			}
			return;
        }

		if(season_State == "N" && (commonGLB.getMenuCD().slice(0, 10) == "0000100004" || commonGLB.getMenuCD().slice(0, 10) == "0000200004")) {
			menuCLS.goSelectedMenu(99, commonGLB.getMenuCD(), "");
			return false;
		}

        jQuery.ajax({
			type : "GET",
			dataType:'json',
			url : commonCLS.URL.단원조회,
			data: {
                "menuCD" : commonGLB.getMenuCD(),
                "txCD" : commonGLB.getTxCD(),
			}, success: function(responseJson) {
                if (responseJson.RESULT == "false") {
                    alert("필수정보를 조회하는데 실패하였습니다.");
                } else {
                    filterFinalCLS.ARRAY_PART_CD = responseJson.PART_LIST;
                    filterFinalCLS.setPart(selectedItem);
                }
            }, error: function(request, exception) {
				return false;
			}
		});
    },
    setPart : function(selectedItem) {
        filterFinalCLS.setBottomSheetLayer(selectedItem, filterFinalCLS.setBottomSheetLayerHeader("범위"), filterFinalCLS.getPartBottomSheetLayerBodyHtml(), filterFinalCLS.getPartBottomSheetLayerFooterHtml());
    },
    setBottomSheetLayer : function (selectedItem, header, body, footer) {
        bottomSheetLayerCLS.init(selectedItem);
        bottomSheetLayerCLS.setHeader(header);
        bottomSheetLayerCLS.setBody(body);
        bottomSheetLayerCLS.setFooter(footer);
    },
    setBottomSheetLayerHeader : function (filterNm) {
        let html = templateReplace(jQuery("#hidden-bottom-sheet-layer-header-title-template").html(), [filterNm]);
        html += jQuery("#hidden-bottom-sheet-layer-header-close-template").html();
        return html;
    },
    getPartBottomSheetLayerBodyHtml: function () {
        let selectedPart = commonCLS.getPartID().toString().split(",");
        let semesterMax = Math.max(...filterFinalCLS.ARRAY_PART_CD.map(o => o.ROOTPART_TERM));
        let checkboxAllHtml = templateReplace(jQuery("#hidden-bottom-sheet-layer-body-part-all-item-main-template").html(), ["filterFinalCLS", filterFinalCLS.ARRAY_PART_CD.length == selectedPart.length ? "전체 해제" : "전체 선택"]);
        let bodyHtml = "";

        for (let semester = 1; semester <= semesterMax; semester++) {
            let semesterList = filterFinalCLS.ARRAY_PART_CD.filter((val) => { return val.ROOTPART_TERM == semester; });

			var chapter_siteid = commonGLB.getSiteID();
			var chapter_grade = commonGLB.getGrade();
			var chapter_subject = commonGLB.getSubjectCD();
			var term_name = "";

            if (semesterMax == 2) {
				if(chapter_siteid == "H" && chapter_grade == "1") {
					if(chapter_subject == "KR" || chapter_subject == "EG") {
						term_name = semester + "학기";
					} else if(chapter_subject == "MT") {
						term_name = "공통수학" + semester;
					} else if(chapter_subject == "SC") {
						term_name = "통합과학" + semester;
					} else if(chapter_subject == "LS") {
						term_name = "통합사회" + semester;
					} else if(chapter_subject == "HI") {
						term_name = "한국사" + semester;
					}
				} else {
					term_name = semester + "학기";
				}

                bodyHtml += templateReplace(jQuery("#hidden-bottom-sheet-layer-body-checkbox-semester-title-template").html(), [term_name]);
            }

            let contentHtml = "";
            jQuery.each(semesterList, function (i, item) {
                let selectedItem = selectedPart.filter((val) => { return val == item.ROOTPART_ID; });
                let checked = selectedItem.length > 0 ? "checked" : "";
                
                let subPartHtml = "";
                jQuery.each(item.SUBPART_LIST, function (i, subitem) {
                    let selectedSubItem = selectedPart.filter((val) => { return val == subitem.SUBPART_ID ; });
                    let subChecked = selectedSubItem.length > 0 ? "checked" : "";
                    subPartHtml += templateReplace(jQuery("#hidden-bottom-sheet-part-filter-sub-part-item-template").html(), [subitem.SUBPART_ID, subChecked, subitem.SUBPART_NAME, item.ROOTPART_ID]);
                });

				if(chapter_subject == "EG") {
					contentHtml += templateReplace(jQuery("#hidden-bottom-sheet-part-filter-root-part-EG-item-template").html(), [item.ROOTPART_ID, checked, item.ROOTPART_NAME]);
				} else {
					contentHtml += templateReplace(jQuery("#hidden-bottom-sheet-part-filter-root-part-item-template").html(), [item.ROOTPART_ID, checked, item.ROOTPART_NAME, subPartHtml]);
				}
            });
            bodyHtml += templateReplace(jQuery("#hidden-bottom-sheet-layer-body-checkbox-item-main-template").html(), [contentHtml]);
        }
        return templateReplace(jQuery("#hidden-bottom-sheet-layer-body-checkbox-body-template").html(), [checkboxAllHtml, bodyHtml]);;
    },
    getPartBottomSheetLayerFooterHtml: function () {
        let selectedPartLength = isValueEmpty(commonCLS.getPartID()) ? 0 : commonCLS.getPartID().toString().split(",").length;
        let isDisabled = selectedPartLength > 0 ? "" : "disabled";
        return templateReplace(jQuery("#hidden-bottom-sheet-layer-footer-part-submit-button-template").html(), [isDisabled]);
    },
    selectedPartAll: function () {
        let ischecked =  jQuery("input[name='bottomPartCD']").length == $("input[name='bottomPartCD']:checked").length ? true : false;
        if (ischecked) {
            jQuery("input[name='bottomPartCD']").prop("checked", false);
        } else {
            jQuery("input[name='bottomPartCD']").prop("checked", true);
        }
        filterFinalCLS.selectedPart();
    },
    selectedPart : function () {
        let checkedCount = $("input[name='bottomPartCD']:checked").length;
        if (checkedCount > 0) {
            jQuery("#bottomPartSubmit").attr("disabled", false);
        } else {
            jQuery("#bottomPartSubmit").attr("disabled", true);
        }

        if (jQuery("input[name='bottomPartCD']").length == checkedCount) {
            jQuery("#bottomPartAll").text('전체 해제');
        } else {
            jQuery("#bottomPartAll").text('전체 선택');
        }
    },
    setRootPart : function (selectedItem, rootPartID) {
        let isChecked = jQuery(selectedItem).is(':checked');
        if (isChecked) {
            let isSubCheckedAll = true;
            jQuery("#bottomRootPart_" + rootPartID).find('input[type=checkbox]').each(function () {
                if (jQuery(this).is(':checked') == false) isSubCheckedAll = false;
            });

            if (isSubCheckedAll) {
                jQuery("input[value='"+ rootPartID +"']").prop("checked", true);
            }
        } else {
            jQuery("input[value='"+ rootPartID +"']").prop("checked", false);
        }
    },
    setSubPart : function (selectedItem, rootPartID) {
        let checked = jQuery(selectedItem).is(':checked');
        jQuery("#" + rootPartID).find('input[type=checkbox]').each(function (i, item) {
            jQuery(item).attr("checked", checked);
        });
    },
    setPartBottomSheetLayerSubmit : function (selectedItem) {
        if (jQuery("input[name='bottomPartCD']:checked").length == 0) {
            alert("대단원을 선택해주세요.");
            return false;
        }
        let partList = new Array();
        jQuery("input[name='bottomPartCD']:checked").each(function () {
            partList.push(jQuery(this).val());
        });
        storage.setSession(storage.EXPAPR_PART_ID, partList.join(","))
        bottomSheetClose(selectedItem);
    },
};