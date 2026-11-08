const filterCLS = {
    IS_PART : true, //파트가 있는 형태
    IS_EXCEPTION_TEMPLATE : false, //파트가 있는 형태
    IS_PART_LOADING : false,
    ARRAY_MENU_FILTER: Array(),
    ARRAY_MENU_EXAM_FILTER: Array(),
    ARRAY_PART_CD: Array(),
    ARRAY_WORK_CD: Array(),
    ARRAY_MENU_EXAM: Array(),
    ARRAY_MENU_VOD : Array(),
    ARRAY_MENU_BEFORE_EXAM: Array(),
    ARRAY_MENU_BEFORE_VOD : Array(),
    ARRAY_MENU_PART: Array(),
    ARRAY_MENU_ASSOCIATE_PART: Array(),
    ARRAY_MENU_ASSOCIATE_INFO: Array(),
    ARRAY_MENU_KOREAN_LITERATURE_PART : Array(),
    KOREAN_PART_WORK_LIST : Array(),
    ARRAY_MENU_EXAM_PART_END : Array(),
    ARRAY_MENU_BEFORE_INFO_LIST : Array(),
    ARRAY_PART_COUNT_LIST : new Map(),
    BEFORE_15_MAX_COUNT : 0,
    PART_USE_CD: 0,
    IS_SCROLL_SEARCH_LOADING : false,
    IS_SCROLL : false,
    PAGE : 1,
	PAGESIZE : 5,
    MAX_PAGE : 0,
    ARRAY_MENU_SERVICE: Array(),
    KOREAN_PART_HANDLING_MENU_LIST : ["000010000300005", "000020000300005", "000020001000001"],
    PREMID_KOREAN_PART_HANDLING_MENU_LIST : ["000010000700001", "000010000700002", "000010000700003"],
    LEVEL_CD_HANDLING_MENU_LIST: ["000010000200001", "000020000200001", "000010000300008", "000020000300008", "000010000300006", "000020000300006", "000020000700001", "000010000200003", "000020000200003", "000030000200003", "00004000200003"],
    EXPAPR_CORETYPE_CD_NOT_GROUPING_MENU_LIST: ["000010000100003", "000020000100003", "000020000700001", "000020000700002"],
    EXPAPR_CORETYPE_FILTER_GROUPING_MENU_LIST: ["000020001200002"],
    TOGGLE_HANDLING_MENU_LIST: ["000010000100002", "000020000100002", "000010000100003", "000020000100003", "000020000800003", "000020001100001", "000030000200003", "000040000200003"],
    BEFORE_TX15_MENU_LIST : ["000010000200003", "000020000200003", "000010000200002", "000020000200002", "000010000300001" ,"000020000300001", "000010000300002", "000020000300002", "000010000300003", "000020000300003", "000010000300004", "000020000300004", "000010000300008", "000020000300008", "000010000100001", "000010000100004", "000020000100001", "000020000100004", "000010000300007", "000020000300007"],
    init: function (params) {
        commonGLB.setStorage(storage.SEARCH_MENU_CD, params.search_menu_cd);
        commonGLB.setStorage(storage.SEARCH_SITEID, params.search_siteid);
        commonGLB.setStorage(storage.SEARCH_SUB_MENU_CD, params.search_sub_menu_cd);
        commonGLB.setStorage(storage.SEARCH_GRADE, params.search_grade);
        commonGLB.setStorage(storage.SEARCH_SUBJECT_CD, params.search_subject_cd);
        commonGLB.setStorage(storage.SEARCH_SUBJECT_DETAIL_CD, params.search_subject_detail_cd);
        commonGLB.setStorage(storage.SEARCH_TX_CD, params.search_tx_cd);
        commonGLB.setStorage(storage.SEARCH_ROOTPART_CD, params.search_root_part_cd);
        commonGLB.setStorage(storage.SEARCH_EXPAPR_GROUP_CD, params.search_expapr_group_cd);
        commonGLB.setStorage(storage.SEARCH_EXPAPR_CORETYPE_CD, params.search_expapr_coretype_cd);
        commonGLB.setStorage(storage.SEARCH_LEVEL_CD, params.search_level_cd);
        commonGLB.setStorage(storage.SEARCH_TEXT_BOOK_CD, params.search_text_book_cd);
        commonGLB.setStorage(storage.SEARCH_TEXT_BOOK_NM, params.search_text_book_nm);
        commonGLB.setStorage(storage.SEARCH_VOD_TYPE, params.search_vod_type);
        commonGLB.setStorage(storage.SEARCH_YEAR_CD, params.search_year_cd);
        commonGLB.setStorage(storage.SEARCH_WORK_TITLE, params.search_work_title);
        commonGLB.setStorage(storage.SEARCH_WORK_AUTHOR, params.search_work_author);
        commonGLB.setStorage(storage.SEARCH_STEP_CD, params.search_step_cd);
    },
    getMenuByFilterAjax: function () {
        jQuery.ajax({
            type: "POST",
            dataType: 'json',
            async: false,
            url: commonCLS.URL.메뉴별필터정보,
            data: {
                "menuCD": commonGLB.getMenuCD(),
                "siteID": commonGLB.getSiteID(),
            }, success: function (responseJson) {
                if (responseJson.RESULT == "false") {
                    alert("필수정보를 조회하는데 실패하였습니다.");
                } else {
                    filterCLS.ARRAY_MENU_FILTER = responseJson.MENU_BY_FILTER;
                    filterCLS.ARRAY_MENU_EXAM_FILTER = responseJson.MENU_BY_EXAM;
                    filterCLS.setMenuByFilter();
                }
            }, error: function (request, exception) {
                return false;
            }
        });
    },
    getIsFilter: function (arrayFilter, searchFilter) {
        let isFilter = false;
        let filter = arrayFilter.filter((val) => { return val.FILTER_CD == searchFilter });
        if (filter.length > 0) {
            isFilter = true;
        }
        return isFilter;
    },
    getMenuByFilter: function () {
        let menuByFilter;
        let menuByFilterSubject = filterCLS.ARRAY_MENU_FILTER.filter((val) => { return val.MENU_CD == commonGLB.getMenuCD() && val.SITE_ID == commonGLB.getSiteID() && val.GRADE == commonGLB.getGrade() && val.SUBJECT_CD == commonGLB.getSubjectCD(); });
        if (menuByFilterSubject.length > 0) {
            menuByFilter = filterCLS.ARRAY_MENU_FILTER.filter((val) => { return val.MENU_CD == commonGLB.getMenuCD() && val.SITE_ID == commonGLB.getSiteID() && val.GRADE == commonGLB.getGrade() && val.SUBJECT_CD == commonGLB.getSubjectCD(); });
        } else {
            menuByFilter = filterCLS.ARRAY_MENU_FILTER.filter((val) => { return val.MENU_CD == commonGLB.getMenuCD() && val.SITE_ID == commonGLB.getSiteID() && val.GRADE == commonGLB.getGrade() && isValueEmpty(val.SUBJECT_CD) == true; });
        }
        return menuByFilter;
    },
    setMenuByFilter: function () {
        let params = "";
        let menuByFilter = filterCLS.getMenuByFilter();
        //각 필터 별 설정
        jQuery("#filter").html("");
        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.분류.FILTER_CD)) {
            params = {
                menuCD: commonGLB.getMenuCD(),
                siteID: commonGLB.getSiteID(),
                grade: commonGLB.getGrade(),
                subjectCD: commonGLB.getSubjectCD(),
            };
            filterCLS.setFilter(commonCLS.FILTER.분류.CD, commonCLS.FILTER.분류.FILTER_KEY, params);
        }

        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.학년.FILTER_CD)) {
            params = {
                menuCD: commonGLB.getMenuCD(),
                siteID: commonGLB.getSiteID(),
                grade: commonGLB.getGrade(),
                subjectCD: commonGLB.getSubjectCD(),
            };
            filterCLS.setFilter(commonCLS.FILTER.학년.CD, commonCLS.FILTER.학년.FILTER_KEY, params);
        }

        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.과목.FILTER_CD)) {
            params = {
                menuCD: commonGLB.getMenuCD(),
                siteID: commonGLB.getSiteID(),
                grade: commonGLB.getGrade(),
                subjectCD: commonGLB.getSubjectCD(),
            };
            filterCLS.setFilter(commonCLS.FILTER.과목.CD, commonCLS.FILTER.과목.FILTER_KEY, params);
        }

        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.상세과목.FILTER_CD)) {
            params = {
                menuCD: commonGLB.getMenuCD(),
                siteID: commonGLB.getSiteID(),
                grade: commonGLB.getGrade(),
                subjectCD: commonGLB.getSubjectCD(),
                subjectDetailCD: commonGLB.getSubjectDetailCD(),
            };
            filterCLS.setFilter(commonCLS.FILTER.상세과목.CD, commonCLS.FILTER.상세과목.FILTER_KEY, params);
        }

        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.시대.FILTER_CD)) {
            params = {
                menuCD: commonGLB.getMenuCD(),
                siteID: commonGLB.getSiteID(),
                grade: commonGLB.getGrade(),
                subjectCD: commonGLB.getSubjectCD(),
                subjectDetailCD: commonGLB.getSubjectDetailCD(),
            };
            filterCLS.setFilter(commonCLS.FILTER.시대.CD, commonCLS.FILTER.시대.FILTER_KEY, params);
        }

        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.갈래.FILTER_CD)) {
            params = {
                menuCD: commonGLB.getMenuCD(),
                siteID: commonGLB.getSiteID(),
                grade: commonGLB.getGrade(),
                subjectCD: commonGLB.getSubjectCD(),
                subjectDetailCD: commonGLB.getSubjectDetailCD(),
            };
            filterCLS.setFilter(commonCLS.FILTER.갈래.CD, commonCLS.FILTER.갈래.FILTER_KEY, params);
        }

        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.교과서.FILTER_CD)) {
            params = {
                menuCD: commonGLB.getMenuCD(),
                siteID: commonGLB.getSiteID(),
                grade: commonGLB.getGrade(),
                subjectCD: commonGLB.getSubjectCD(),
				is_default : 1,
            };
            filterCLS.setFilter(commonCLS.FILTER.교과서.CD, commonCLS.FILTER.교과서.FILTER_KEY, params);
        }

        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.단원.FILTER_CD)) {
            filterCLS.setFilterByPart();
        } else {
            jQuery("#partFilter").hide();
        }

        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.출판사.FILTER_CD)) {
            params = {
                menuCD: commonGLB.getMenuCD(),
                siteID: commonGLB.getSiteID(),
                grade: commonGLB.getGrade(),
                subjectCD: commonGLB.getSubjectCD(),
            };
            filterCLS.setFilter(commonCLS.FILTER.출판사.CD, commonCLS.FILTER.출판사.FILTER_KEY, params);
        }

        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.난이도.FILTER_CD)) {
            filterCLS.setFilterByLevelCD(commonCLS.FILTER.난이도.CD);
        }

        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.단계.FILTER_CD)) {
            filterCLS.setFilterByLevelCD(commonCLS.FILTER.단계.CD);
        }

        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.년도.FILTER_CD)) {
            params = {
                menuCD: commonGLB.getMenuCD(),
                siteID: commonGLB.getSiteID(),
                grade: commonGLB.getGrade(),
                subjectCD: commonGLB.getSubjectCD(),
                subjectDetailCD: commonGLB.getSubjectDetailCD(),
                yearCD: commonGLB.getYearCD(),
            };
            filterCLS.setFilter(commonCLS.FILTER.년도.CD, commonCLS.FILTER.년도.FILTER_KEY, params);
        }

        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.작품.FILTER_CD)) {
            filterCLS.setFilterByWork();
        } else {
            jQuery("#workFilter").hide();
        }

        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.학습단계.FILTER_CD)) {
            let selectedFilterNm = "중단원 학습";
            commonGLB.setStorage(commonCLS.FILTER.학습단계.CD, 1);

            jQuery("#filter").append(templateReplace(jQuery("#hidden-filter-item-template").html(), [jQuery("#hidden-filter-item-has-arrow-class-template").html(), commonCLS.FILTER.학습단계.CD, selectedFilterNm]));
        }
    },
    setFilterByWork: function () {
        jQuery("#filter").append(templateReplace($("#hidden-filter-item-template").html(), [jQuery("#hidden-filter-item-has-arrow-class-template").html(), commonCLS.FILTER.작품.CD, commonCLS.FILTER.작품.NM]));
        filterCLS.getWorkAjax();
    },
    setFilterByPart: function () {
        jQuery("#filter").append(templateReplace($("#hidden-filter-item-template").html(), [jQuery("#hidden-filter-item-has-arrow-class-template").html(), commonCLS.FILTER.단원.CD, "단원선택"]));
        jQuery("#partFilter").show();
        filterCLS.getRootPartByTxCodeAjax();
    },
    getLevelData: function (params) {
        return menuCLS.LEVEL_CD.filter((val) => {
            return val.MENU_CD == params.MENU_CD && (isValueEmpty(params.SUBJECT_CD) || val.SUBJECT_CD == params.SUBJECT_CD) && (isValueEmpty(params.GRADE) || val.GRADE == params.GRADE) && (isValueEmpty(params.LEVEL_CD) || val.CODE == params.LEVEL_CD) && (isValueEmpty(params.SUBJECT_DETAIL_CD) || val.SUBJECT_DETAIL_CD == params.SUBJECT_DETAIL_CD)
        });
    },
    setFilterByLevelCD: function (filterCD) {
        let selectedFilterNm = "";
        let hasClass = jQuery("#hidden-filter-item-has-arrow-class-template").html();
        let params = "";

        if ("000020000800003" == commonGLB.getMenuCD()) {
            params = {
                MENU_CD: commonGLB.getMenuCD(),
                LEVEL_CD: commonGLB.getLevelCD(),
                SUBJECT_DETAIL_CD: commonGLB.getSubjectDetailCD(),
            };
        } else if (isArrayInValue(["000010000200003", "000020000200003", "000010000300008", "000020000300008"], commonGLB.getMenuCD())) {
            if (isValueEmpty(commonGLB.getLevelCD())) {
                if (commonGLB.getSubjectCD() == "SC" || commonGLB.getSubjectCD() == "LS" || commonGLB.getSubjectCD() == "ET" || commonGLB.getSubjectCD() == "HI" || commonGLB.getSubjectCD() == "MT") {
                    commonGLB.setStorage(commonCLS.FILTER.난이도.CD, 2);
                } else {
                    commonGLB.setStorage(commonCLS.FILTER.난이도.CD, "");
                }
            }

            params = {
                MENU_CD: commonGLB.getMenuCD(),
                SUBJECT_CD: commonGLB.getSubjectCD(),
                LEVEL_CD: commonGLB.getLevelCD()
            };
        } else {
            params = {
                MENU_CD: commonGLB.getMenuCD(),
                LEVEL_CD: commonGLB.getLevelCD(),
            };
        }

        let filter = filterCLS.getLevelData(params);
        
        if (filter.length > 0) {
            selectedFilterNm = filter[0].NAME;

            if (isArrayInValue(["000010000100002", "000020000100002", "000010000100003", "000020000100003", "000020000800003", "000020001100001"], commonGLB.getMenuCD())) {
                commonGLB.setStorage(commonCLS.FILTER.교과서.CD, filter[0].TX_CD);
                commonGLB.setStorage(commonCLS.FILTER.난이도.CD, filter[0].CODE);
                filterCLS.setSearchExpaprCode(filter);
            } else if (isArrayInValue(["000010000200002", "000020000200002", "000030000200002", "000040000200002"], commonGLB.getMenuCD())) {
                commonGLB.setStorage(commonCLS.FILTER.난이도.CD, filter[0].CODE);
            }
        }
        if (isArrayInValue(["000010000200003", "000020000200003"], commonGLB.getMenuCD())) {
            if (commonGLB.getSubjectCD() == "MT" || commonGLB.getSubjectCD() == "SC" || commonGLB.getSubjectCD() == "LS" || commonGLB.getSubjectCD() == "ET" || commonGLB.getSubjectCD() == "HI") {
                jQuery("#filter").append(templateReplace($("#hidden-filter-item-template").html(), [hasClass, filterCD, selectedFilterNm]));
            }
        } else {
            jQuery("#filter").append(templateReplace($("#hidden-filter-item-template").html(), [hasClass, filterCD, selectedFilterNm]));
        }
    },
    setFilter: function (filterID, filterKey, params) {
        let selectedFilterNm = "";
        let storageKey = isArrayInValue([commonCLS.FILTER.갈래.CD, commonCLS.FILTER.시대.CD], filterID) ? commonCLS.FILTER.상세과목.FILTER_KEY : filterKey;
        let filter = filterCLS.getMenuExamFilterData(params);

        if (filter.length > 0) {
            selectedFilterNm = filter[0][storageKey];

            if (commonCLS.FILTER.분류.CD == filterID) {
                selectedFilterNm = menuCLS.getSelectedMenuNm(filter[0][filterKey]);
            }

            if (isValueEmpty(selectedFilterNm) == false) {
                jQuery("#filter").append(templateReplace(jQuery("#hidden-filter-item-template").html(), [jQuery("#hidden-filter-item-has-arrow-class-template").html(), filterID, selectedFilterNm]));
            }
        }
    },
    getMenuExamFilterData: function (params) {
        return filterCLS.ARRAY_MENU_EXAM_FILTER.filter((val) => {
            return (isValueEmpty(params.menuCD) || val.MENU_CD == params.menuCD) && (isValueEmpty(params.subMenuCD) || val.SUB_MENU_CD == params.subMenuCD) && (isValueEmpty(params.siteID) || val.SITE_ID == params.siteID) && (isValueEmpty(params.grade) || val.GRADE == params.grade) && (isValueEmpty(params.subjectCD) || val.SUBJECT_CD == params.subjectCD) && (isValueEmpty(params.subjectDetailCD) || val.SUBJECT_DETAIL_CD == params.subjectDetailCD) && (isValueEmpty(params.yearCD) || val.YEAR_CD == params.yearCD) && (isValueEmpty(params.is_default) || val.IS_DEFAULT == params.is_default) && (isValueEmpty(params.txCD) || val.TX_CD == params.txCD)
        });
    },
    getWorkAjax: function () {
        jQuery.ajax({
            type: "POST",
            dataType: 'json',
            async: false,
            url: commonCLS.URL.작품필터정보조회,
            data: {
                "expapr_coretype_cd": commonGLB.getSearchExpaprCoreTypeCD(),
                "expapr_group_cd": commonGLB.getSearchExpaprGroupCD(),
                "siteid": commonGLB.getSiteID(),
                "grade": commonGLB.getGrade(),
                "subject_cd": commonGLB.getSubjectCD(),
                "subject_detail_cd": commonGLB.getSubjectDetailCD(),
                "tx_cd": commonGLB.getTxCD(),
            }, success: function (responseJson) {
                if (responseJson.RESULT == "false") {
                    alert("필수정보를 조회하는데 실패하였습니다.");
                } else {
                    filterCLS.ARRAY_WORK_CD = responseJson.WORK_LIST;
                    filterCLS.setFilterHtmlByWork();
                }
            }, error: function (request, exception) {
                return false;
            }
        });
    },
    setFilterHtmlByWork : function () {
        jQuery("#workFilter").html("");

        let itemTitle;
        let itemValue;
        let selectedItem;
        let arraySelectedCD;

        if (commonGLB.getWork() == storage.SEARCH_WORK_TITLE) {
            arraySelectedCD = commonGLB.getWorkTitle().toString().split("|");
            if (arraySelectedCD.length > 0) {
                jQuery.each(arraySelectedCD, function (i, cd) {
                    selectedItem = filterCLS.ARRAY_WORK_CD.filter((val) => { return val.TITLE == cd; });
                    if (selectedItem.length > 0) {
                        itemTitle = selectedItem[0].TITLE + "-" + selectedItem[0].AUTHOR;
                        itemValue = selectedItem[0].TITLE;

                        jQuery("#workFilter").append(templateReplace(jQuery("#hidden-filter-work-item-template").html(), [itemValue, itemTitle]));
                    }
                });
            }
        } else {
            arraySelectedCD = commonGLB.getWorkAuthor().toString().split("|");
            if (arraySelectedCD.length > 0) {
                jQuery.each(arraySelectedCD, function (i, cd) {
                    selectedItem = filterCLS.ARRAY_WORK_CD.filter((val) => { return val.AUTHOR == cd; });
                    if (selectedItem.length > 0) {
                        jQuery.each(selectedItem, function (i, workItem) {
                            itemTitle = workItem.TITLE + "-" + workItem.AUTHOR;
                            itemValue = workItem.AUTHOR;

                            jQuery("#workFilter").append(templateReplace(jQuery("#hidden-filter-work-item-template").html(), [itemValue, itemTitle]));
                        });
                    }
                });
            }
        }
    },
    getRootPartByTxCodeAjax: function () {
        jQuery.ajax({
            type: "POST",
            dataType: 'json',
            async: false,
            url: commonCLS.URL.대단원조회,
            data: {
                "txCD": commonGLB.getTxCD(),
                "menuCD": commonGLB.getMenuCD(),
            }, success: function (responseJson) {
                if (responseJson.RESULT == "false") {
                    alert("필수정보를 조회하는데 실패하였습니다.");
                } else {
                    filterCLS.ARRAY_PART_CD = responseJson.LIST;
                    filterCLS.setFilterByPartCD();
                }
            }, error: function (request, exception) {
                return false;
            }
        });
    },
    setFilterByPartCD: function () {
        let html = "";
        jQuery("#partFilter").html(html);
        let selectedRootPart = commonGLB.getRootPartCD().toString().split(",");
        if (isValueEmpty(commonGLB.getRootPartCD()) == false) {
            jQuery.each(selectedRootPart, function (i, cd) {
                let arraySelectedItem = filterCLS.ARRAY_PART_CD.filter((val) => { return val.ROOTPART_CODE == cd; });
                if (arraySelectedItem.length > 0) {
                    jQuery("#partFilter").append(templateReplace(jQuery("#hidden-filter-part-item-template").html(), [cd, arraySelectedItem[0].ROOTPART_NAME]));
                }
            });
        } else {
            jQuery.each(filterCLS.ARRAY_PART_CD, function (i, item) {
                jQuery("#partFilter").append(templateReplace(jQuery("#hidden-filter-part-item-template").html(), [item.ROOTPART_CODE, item.ROOTPART_NAME]));
            });
        }
    },
    selectedPartCD: function (partCD) {
        if (jQuery(".FILTER_PART_" + partCD).hasClass("is-active")) {
            jQuery(".FILTER_PART_ITEM").removeClass("is-active");
            jQuery(".EXAM_PART_ITEM").show();
        } else {
            jQuery(".FILTER_PART_ITEM").removeClass("is-active");
            jQuery(".EXAM_PART_ITEM").hide();
            jQuery(".FILTER_PART_" + partCD).addClass("is-active");
            jQuery(".PART_ITEM_" + partCD).show();
        }
    },
    getFilterBySubMenuCD: function () {
        let params = {
            menuCD: commonGLB.getMenuCD(),
            siteID: commonGLB.getSiteID(),
            subjectCD: commonGLB.getSubjectCD(),
        };
        let arrayFilter = filterCLS.getMenuExamFilterData(params);
        return [...new Map(arrayFilter.map(item => [item.SUB_MENU_CD])).entries()].map(([VALUE]) => ({ VALUE }));
    },
    getFilterByGrade: function () {
        let params = {
            menuCD: commonGLB.getMenuCD(),
            siteID: commonGLB.getSiteID(),
            subjectCD: commonGLB.getSubjectCD(),
        };
        let arrayFilter = filterCLS.getMenuExamFilterData(params);
        return [...new Map(arrayFilter.map(item => [item.GRADE, item.GRADE_NM])).entries()].map(([VALUE, NAME]) => ({ VALUE, NAME }));
    },
    getFilterBySubjectCD: function () {
        let params = {
            menuCD: commonGLB.getMenuCD(),
            siteID: commonGLB.getSiteID(),
            grade: commonGLB.getGrade(),
        };
        let arrayFilter = filterCLS.getMenuExamFilterData(params);
        return [...new Map(arrayFilter.map(item => [item.SUBJECT_CD, item.SUBJECT_NM])).entries()].map(([VALUE, NAME]) => ({ VALUE, NAME }));
    },
    getFilterBySubjectDetailCD: function () {
        let params = {
            menuCD: commonGLB.getMenuCD(),
            siteID: commonGLB.getSiteID(),
            grade: commonGLB.getGrade(),
            subjectCD: commonGLB.getSubjectCD(),
        };
        let arrayFilter = filterCLS.getMenuExamFilterData(params);
        return [...new Map(arrayFilter.map(item => [item.SUBJECT_DETAIL_CD, item.SUBJECT_DETAIL_NM])).entries()].map(([VALUE, NAME]) => ({ VALUE, NAME }));
    },
    getFilterByLevelCD: function () {
        let arrayFilter = new Array();

        if (isArrayInValue(["000010000200003", "000020000200003"], commonGLB.getMenuCD())) {
            arrayFilter = menuCLS.LEVEL_CD.filter((val) => { return val.MENU_CD == commonGLB.getMenuCD() && val.SUBJECT_CD == commonGLB.getSubjectCD() });
        } else {
            arrayFilter = menuCLS.LEVEL_CD.filter((val) => { return val.MENU_CD == commonGLB.getMenuCD() });
        }

        return [...new Map(arrayFilter.map(item => [item.CODE, item.NAME])).entries()].map(([VALUE, NAME]) => ({ VALUE, NAME }));
    },
    getFilterByTxCD: function () {
        let params = {
            menuCD: commonGLB.getMenuCD(),
            siteID: commonGLB.getSiteID(),
            grade: commonGLB.getGrade(),
            subjectCD: commonGLB.getSubjectCD(),
            subjectDetailCD: commonGLB.getSubjectDetailCD(),
        };
        let arrayFilter = filterCLS.getMenuExamFilterData(params);
        return [...new Map(arrayFilter.map(item => [item.TX_CD, item.TX_NM])).entries()].map(([VALUE, NAME]) => ({ VALUE, NAME }));
    },
    getFilterByTextBookCD: function () {
        let params = {
            menuCD: commonGLB.getMenuCD(),
            siteID: commonGLB.getSiteID(),
            grade: commonGLB.getGrade(),
            subjectCD: commonGLB.getSubjectCD(),
            subjectDetailCD: commonGLB.getSubjectDetailCD(),
        };
        let arrayFilter = filterCLS.getMenuExamFilterData(params);
        return [...new Map(arrayFilter.map(item => [item.TEXT_BOOK_CD, item.TEXT_BOOK_NM])).entries()].map(([VALUE, NAME]) => ({ VALUE, NAME }));
    },
    getFilterByYearCD: function () {
        let params = {
            menuCD: commonGLB.getMenuCD(),
            siteID: commonGLB.getSiteID(),
            grade: commonGLB.getGrade(),
            subjectCD: commonGLB.getSubjectCD(),
            subjectDetailCD: commonGLB.getSubjectDetailCD(),
        };
        let arrayFilter = filterCLS.getMenuExamFilterData(params);
        return [...new Map(arrayFilter.map(item => [item.YEAR_CD, item.YEAR_NM])).entries()].map(([VALUE, NAME]) => ({ VALUE, NAME }));
    },
    getBottomSheetLayer: function (filterID, selectedItem) {
        switch (filterID) {
            case commonCLS.FILTER.분류.CD:
                filterCLS.setBottomSheetLayerRadio(selectedItem, filterID, filterCLS.getFilterBySubMenuCD());
                break;
            case commonCLS.FILTER.학년.CD:
                filterCLS.setBottomSheetLayerRadio(selectedItem, filterID, filterCLS.getFilterByGrade());
                break;
            case commonCLS.FILTER.과목.CD:
                filterCLS.setBottomSheetLayerRadio(selectedItem, filterID, filterCLS.getFilterBySubjectCD());
                break;
            case commonCLS.FILTER.갈래.CD:
            case commonCLS.FILTER.시대.CD:
            case commonCLS.FILTER.상세과목.CD:
                filterCLS.setBottomSheetLayerRadio(selectedItem, filterID, filterCLS.getFilterBySubjectDetailCD());
                break;
            case commonCLS.FILTER.교과서.CD:
                filterCLS.setBottomSheetLayerRadio(selectedItem, filterID, filterCLS.getFilterByTxCD());
                break;
            case commonCLS.FILTER.난이도.CD:
            case commonCLS.FILTER.단계.CD:
                filterCLS.setBottomSheetLayerRadio(selectedItem, filterID, filterCLS.getFilterByLevelCD());
                break;
            case commonCLS.FILTER.단원.CD:
                filterCLS.getRootPartBottomSheetLayer(selectedItem);
                break;
            case commonCLS.FILTER.출판사.CD:
                filterCLS.setBottomSheetLayerRadio(selectedItem, filterID, filterCLS.getFilterByTextBookCD());
                break;
            case commonCLS.FILTER.년도.CD:
                filterCLS.setBottomSheetLayerRadio(selectedItem, filterID, filterCLS.getFilterByYearCD());
                break;
            case commonCLS.FILTER.작품.CD:
                filterCLS.getWorkBottomSheetLayer(selectedItem);
                break;
            case commonCLS.FILTER.학습단계.CD:
                filterCLS.setBottomSheetLayerRadio(selectedItem, filterID, [{ VALUE : 1, NAME : "중단원 학습" }, { VALUE : 2, NAME : "대단원 학습" }]);
                break;
        }

        // 체크된 체크박스로 스크롤 이동
        const box = document.querySelector('.check__list.has-singleActive');

		if (isValueEmpty(box) == false) {
			const checked = box.querySelectorAll('input[type="checkbox"]:checked');

			if (checked.length > 0) {
				const firstChecked = checked[0];
				const top = firstChecked.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;

				box.scrollTo(0, top);
			}
		}
    },
    setBottomSheetLayerCheckBox: function (selectedItem, filterID, filterNm, arrayFilter) {
        filterCLS.setBottomSheetLayer(selectedItem, filterCLS.setBottomSheetLayerHeader(filterID), filterCLS.setBottomSheetLayerCheckBoxBody(filterID, arrayFilter), filterCLS.getBottomSheetLayerCheckBoxFooter(filterID, filterNm));
    },
    setBottomSheetLayerCheckBoxBody: function (filterID, arrayFilter) {
        let contentHtml = "";
        let checked = "";
        let selectedFilter = commonGLB.getStorage(filterID).toString().split(",");
        let checkboxAllHtml = templateReplace(jQuery("#hidden-bottom-sheet-layer-checkbox-all-item-template").html(), [arrayFilter.length == selectedFilter.length ? "전체 해제" : "전체 선택"]);
        jQuery.each(arrayFilter, function (i, filter) {
            let selectedFilterItem = selectedFilter.filter((val) => { return val == filter.VALUE; });
            checked = selectedFilterItem.length > 0 ? "checked" : "";
            let itemNm = filterID == commonCLS.FILTER.분류.CD ? menuCLS.getSelectedMenuNm(filter.VALUE) : filter.NAME;
            contentHtml += templateReplace(jQuery("#hidden-bottom-sheet-layer-checkbox-item-template").html(), [filter.VALUE, checked, itemNm]);
        });
        let bodyHtml = templateReplace(jQuery("#hidden-bottom-sheet-layer-body-item-template").html(), [contentHtml]);
        return templateReplace(jQuery("#hidden-bottom-sheet-layer-body-checkbox-body-template").html(), [checkboxAllHtml, bodyHtml]);
    },
    getBottomSheetLayerCheckBoxFooter: function (filterID, filterNm) {
        let selectedFilter = commonGLB.getStorage(filterID).toString().split(",");
        let selectedLength = isValueEmpty(commonGLB.getStorage(filterID)) ? 0 : selectedFilter.length;
        let isDisabled = selectedLength > 0 ? "" : "disabled";
        return templateReplace(jQuery("#hidden-bottom-sheet-layer-checkbox-submit-button-template").html(), [filterID, filterNm, isDisabled]);
    },
    selectedBottomSheetCheckBoxAll: function () {
        let ischecked = jQuery("input[name='bottomSheetCheckboxItem']").length == $("input[name='bottomSheetCheckboxItem']:checked").length ? true : false;
        if (ischecked) {
            jQuery("input[name='bottomSheetCheckboxItem']").prop("checked", false);
            jQuery("#bottomSheetCheckboxItemAll").text('전체 선택');
        } else {
            jQuery("input[name='bottomSheetCheckboxItem']").prop("checked", true);
            jQuery("#bottomSheetCheckboxItemAll").text('전체 해제');
        }
        filterCLS.selectedBottomSheetCheckBox();
    },
    selectedBottomSheetCheckBox: function () {
        let checkedCount = $("input[name='bottomSheetCheckboxItem']:checked").length;
        if (checkedCount > 0) {
            jQuery("#bottomSheetCheckboxSubmit").attr("disabled", false);
        } else {
            jQuery("#bottomSheetCheckboxSubmit").attr("disabled", true);
        }

        if (jQuery("input[name='bottomSheetCheckboxItem']").length == checkedCount) {
            jQuery("#bottomSheetCheckboxItemAll").text('전체 해제');
        } else {
            jQuery("#bottomSheetCheckboxItemAll").text('전체 선택');
        }
    },
    setBottomSheetCheckBoxSubmit: function (selectedItem, filterID, filterNm) {
        if (jQuery("input[name='bottomSheetCheckboxItem']:checked").length == 0) {
            alert(filterNm + "을 선택해주세요.");
            return false;
        }
        let itemList = new Array();
        jQuery("input[name='bottomSheetCheckboxItem']:checked").each(function () {
            itemList.push(jQuery(this).val());
        });
        commonGLB.setStorage(filterID, itemList.join(","));
        jQuery(".FILTER_PART_ITEM").removeClass("is-active");

        bottomSheetClose(selectedItem);
        unfoldToggle();
        filterCLS.goSearch();
    },
    setBottomSheetLayerRadio: function (selectedItem, filterID, arrayFilter) {
        filterCLS.setBottomSheetLayer(selectedItem, filterCLS.setBottomSheetLayerHeader(filterID), filterCLS.setBottomSheetLayerRadioBody(selectedItem, filterID, arrayFilter), "");
    },
    setBottomSheetLayerHeader: function (filterID) {
        let title = "";
        switch (filterID) {
            case commonCLS.FILTER.분류.CD:
                title = commonCLS.FILTER.분류.NM;
                break;
            case commonCLS.FILTER.학년.CD:
                title = commonCLS.FILTER.학년.NM;
                break;
            case commonCLS.FILTER.과목.CD:
                title = commonCLS.FILTER.과목.NM;
                break;
            case commonCLS.FILTER.상세과목.CD:
                title = commonCLS.FILTER.상세과목.NM;
                break;
            case commonCLS.FILTER.교과서.CD:
                title = commonCLS.FILTER.교과서.NM;
                break;
            case commonCLS.FILTER.단원.CD:
                title = commonCLS.FILTER.단원.NM;
                break;
            case commonCLS.FILTER.단계.CD:
                title = commonCLS.FILTER.단계.NM;
                break;
            case commonCLS.FILTER.난이도.CD:
                title = commonCLS.FILTER.난이도.NM;
                break;
            case commonCLS.FILTER.출판사.CD:
                title = commonCLS.FILTER.출판사.NM;
                break;
            case commonCLS.FILTER.년도.CD:
                title = commonCLS.FILTER.년도.NM;
                break;
            case commonCLS.FILTER.갈래.CD:
                title = commonCLS.FILTER.갈래.NM;
                break;
            case commonCLS.FILTER.작품.CD:
                title = commonCLS.FILTER.작품.NM;
                break;
            case commonCLS.FILTER.시대.CD:
                title = commonCLS.FILTER.시대.NM;
                break;
            case commonCLS.FILTER.학습단계.CD:
                title = commonCLS.FILTER.학습단계.NM;
                break;
        }
        let html = templateReplace(jQuery("#hidden-bottom-sheet-layer-header-title-template").html(), [title]);
        html += jQuery("#hidden-bottom-sheet-layer-header-close-template").html();
        return html;
    },
    setBottomSheetLayer: function (selectedItem, header, body, footer) {
        bottomSheetLayerCLS.init(selectedItem);
        bottomSheetLayerCLS.setHeader(header);
        bottomSheetLayerCLS.setBody(body);
        bottomSheetLayerCLS.setFooter(footer);
    },
    setBottomSheetLayerRadioBody: function (selectedItem, filterID, arrayFilter) {
        let html = "";
        let storageKey = isArrayInValue([commonCLS.FILTER.갈래.CD, commonCLS.FILTER.시대.CD], filterID) ? commonCLS.FILTER.상세과목.CD : filterID;
        storageKey = isArrayInValue([commonCLS.FILTER.단계.CD], filterID) ? commonCLS.FILTER.난이도.CD : storageKey;

        let selectedFilter = commonGLB.getStorage(storageKey);

        jQuery.each(arrayFilter, function (i, filter) {

            let checked = filter.VALUE == selectedFilter ? "checked" : "";
            let itemNm = filterID == commonCLS.FILTER.분류.CD ? menuCLS.getSelectedMenuNm(filter.VALUE) : filter.NAME;
            html += templateReplace(jQuery("#hidden-bottom-sheet-layer-body-radio-item-template").html(), [checked, filterID, filter.VALUE, itemNm]);
        });
        return templateReplace(jQuery("#hidden-bottom-sheet-layer-body-radio-item-main-template").html(), [html]);
    },
    selectedBottomSheetRadioItem: function (selectedItem, filterID, filterValue, filterName) {
        bottomSheetClose(selectedItem);
        jQuery("." + filterID).text(filterName);
        if (commonCLS.FILTER.단계.CD == filterID) {
            filterID = commonCLS.FILTER.난이도.CD;
        }
        if (isArrayInValue([commonCLS.FILTER.갈래.CD, commonCLS.FILTER.시대.CD], filterID)) {
            filterID = commonCLS.FILTER.상세과목.CD;
        }
        commonGLB.setStorage(filterID, filterValue);
        switch (filterID) {
            case commonCLS.FILTER.분류.CD:
                filterCLS.selectedSubMenuCD();
                break;
            case commonCLS.FILTER.학년.CD:
                filterCLS.selectedGrade();
                break;
            case commonCLS.FILTER.과목.CD:
                filterCLS.selectedSubjectCD();
                break;
            case commonCLS.FILTER.상세과목.CD:
            case commonCLS.FILTER.갈래.CD:
            case commonCLS.FILTER.시대.CD:
                filterCLS.selectedSubjectDetailCD();
                break;
            case commonCLS.FILTER.단계.CD:
            case commonCLS.FILTER.난이도.CD:
                filterCLS.selectedLevelCD();
                break;
            case commonCLS.FILTER.교과서.CD:
                filterCLS.selectedTxCD(filterName);
                break;
            case commonCLS.FILTER.출판사.CD:
                filterCLS.selectedTextBookCD();
                break;
            case commonCLS.FILTER.년도.CD:
                filterCLS.selectedTearCD();
                break;
            case commonCLS.FILTER.학습단계.CD:
                filterCLS.selectedStepCD(filterValue);
                break;
        }
    },
    filterInit : function (arrayFilter) {
        jQuery.each(arrayFilter, function (i, id) {
            jQuery("." + id).remove();
            if (id == commonCLS.FILTER.작품.CD) {
                storage.removeLocal(storage.SELECTED_WORK);
                storage.removeLocal(storage.SEARCH_WORK_TITLE);
                storage.removeLocal(storage.SEARCH_WORK_AUTHOR);
            } else {
                storage.removeLocal(id);
            }
        });
    },
    selectedSubMenuCD: function () {
        jQuery("." + commonCLS.FILTER.학년.CD).remove();
        jQuery("." + commonCLS.FILTER.과목.CD).remove();

        filterCLS.filterInit(Array(commonCLS.FILTER.상세과목.CD, commonCLS.FILTER.교과서.CD, commonCLS.FILTER.단원.CD, commonCLS.FILTER.난이도.CD, commonCLS.FILTER.단계.CD));
        filterCLS.filterInit(Array(commonCLS.FILTER.출판사.CD, commonCLS.FILTER.년도.CD, commonCLS.FILTER.갈래.CD, commonCLS.FILTER.시대.CD, commonCLS.FILTER.작품.CD, commonCLS.FILTER.학습단계.CD));
        jQuery("#partFilter").hide();
        jQuery("#workFilter").hide();

        let filter;
        let params;
        let selectedFilterNm = "";
        let selectedFilterCD = "";
        let hasClass = jQuery("#hidden-filter-item-has-arrow-class-template").html();

        params = {
            menuCD: commonGLB.getMenuCD(),
            siteID: commonGLB.getSiteID(),
            grade: commonGLB.getGrade(),
            subMenuCD : commonGLB.getSubMenuCD(),
            subjectCD: commonGLB.getSubjectCD(),
            subjectDetailCD: commonGLB.getSubjectDetailCD(),
            is_default : 1,
        };

        filter = filterCLS.getMenuExamFilterData(params);
        if (filter.length > 0) {
            selectedFilterNm = filter[0].GRADE_NM;
            selectedFilterCD = filter[0].GRADE;
        } else {
            params = {
                menuCD: commonGLB.getMenuCD(),
                siteID: commonGLB.getSiteID(),
                grade: commonGLB.getGrade(),
                subMenuCD : commonGLB.getSubMenuCD(),
                is_default : 1,
            };
            filter = filterCLS.getMenuExamFilterData(params);
            selectedFilterNm = filter[0].GRADE_NM;
            selectedFilterCD = filter[0].GRADE;
        }

        jQuery("#filter").append(templateReplace($("#hidden-filter-item-template").html(), [hasClass, commonCLS.FILTER.학년.CD, selectedFilterNm]));
        commonGLB.setStorage(commonCLS.FILTER.학년.CD, selectedFilterCD);
        filterCLS.setSearchExpaprCode(filter);

        let menuByFilter = filterCLS.getMenuByFilter();
        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.과목.FILTER_CD)) {
            params = {
                menuCD: commonGLB.getMenuCD(),
                siteID: commonGLB.getSiteID(),
                grade: commonGLB.getGrade(),
                subMenuCD : commonGLB.getSubMenuCD(),
                subjectCD: commonGLB.getSubjectCD(),
                is_default : 1,
            };
            filter = filterCLS.getMenuExamFilterData(params);
            if (filter.length > 0) {
                selectedFilterNm = filter[0].SUBJECT_NM;
                selectedFilterCD = filter[0].SUBJECT_CD;
            } else {
                params = {
                    menuCD: commonGLB.getMenuCD(),
                    siteID: commonGLB.getSiteID(),
                    grade: commonGLB.getGrade(),
                    subMenuCD : commonGLB.getSubMenuCD(),
                    is_default : 1,
                };
                filter = filterCLS.getMenuExamFilterData(params);
                selectedFilterNm = filter[0].SUBJECT_NM;
                selectedFilterCD = filter[0].SUBJECT_CD;
            }
            jQuery("#filter").append(templateReplace($("#hidden-filter-item-template").html(), [hasClass, commonCLS.FILTER.과목.CD, selectedFilterNm]));
            commonGLB.setStorage(commonCLS.FILTER.과목.CD, selectedFilterCD);
            filterCLS.setSearchExpaprCode(filter);
        }
        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.상세과목.FILTER_CD)) {
            params = {
                menuCD: commonGLB.getMenuCD(),
                siteID: commonGLB.getSiteID(),
                grade: commonGLB.getGrade(),
                subMenuCD : commonGLB.getSubMenuCD(),
                subjectCD: commonGLB.getSubjectCD(),
                is_default : 1,
            };
            filter = filterCLS.getMenuExamFilterData(params);
            if (filter.length > 0) {
                selectedFilterNm = filter[0].SUBJECT_DETAIL_NM;
                selectedFilterCD = filter[0].SUBJECT_DETAIL_CD;

                if (isValueEmpty(selectedFilterNm) == false) {
                    jQuery("#filter").append(templateReplace(jQuery("#hidden-filter-item-template").html(), [hasClass, commonCLS.FILTER.상세과목.CD, selectedFilterNm]));
                    commonGLB.setStorage(commonCLS.FILTER.상세과목.CD, selectedFilterCD);
                    filterCLS.setSearchExpaprCode(filter);
                }
            }
        }
        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.교과서.FILTER_CD)) {
            params = {
                menuCD: commonGLB.getMenuCD(),
                siteID: commonGLB.getSiteID(),
                grade: commonGLB.getGrade(),
                subMenuCD : commonGLB.getSubMenuCD(),
                subjectCD: commonGLB.getSubjectCD(),
                is_default : 1,
            };
            filter = filterCLS.getMenuExamFilterData(params);
            if (filter.length > 0) {
                selectedFilterNm = filter[0].TX_NM;
                selectedFilterCD = filter[0].TX_CD;
            }
            jQuery("#filter").append(templateReplace(jQuery("#hidden-filter-item-template").html(), [hasClass, commonCLS.FILTER.교과서.CD, selectedFilterNm]));
            commonGLB.setStorage(commonCLS.FILTER.교과서.CD, selectedFilterCD);
            filterCLS.setSearchExpaprCode(filter);
        } else {
            if (isValueEmpty(commonGLB.getSubjectDetailCD())) {
                params = {
                    menuCD: commonGLB.getMenuCD(),
                    siteID: commonGLB.getSiteID(),
                    grade: commonGLB.getGrade(),
                    subjectCD: commonGLB.getSubjectCD()
                };
                filter = filterCLS.getMenuExamFilterData(params);
                filter = filterCLS.ARRAY_MENU_EXAM_FILTER.filter((val) => { return val.MENU_CD == commonGLB.getMenuCD() && val.SITE_ID == commonGLB.getSiteID() && val.GRADE == commonGLB.getGrade() && val.SUBJECT_CD == commonGLB.getSubjectCD(); });
            } else {
                params = {
                    menuCD: commonGLB.getMenuCD(),
                    siteID: commonGLB.getSiteID(),
                    grade: commonGLB.getGrade(),
                    subjectCD: commonGLB.getSubjectCD(),
                    subjectDetailCD : commonGLB.getSubjectDetailCD(),
                };
                filter = filterCLS.getMenuExamFilterData(params);
            }

            if (filter.length > 0) {
                selectedFilterCD = filter[0].TX_CD;
                commonGLB.setStorage(commonCLS.FILTER.교과서.CD, selectedFilterCD);
            }
            filterCLS.setSearchExpaprCode(filter);
        }
        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.단원.FILTER_CD)) {
            filterCLS.setFilterByPart();
        }
        
        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.단계.FILTER_CD)) {
            filterCLS.setFilterByLevelCD(commonCLS.FILTER.단계.CD);
        }

        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.출판사.FILTER_CD)) {
            if (isValueEmpty(commonGLB.getSubjectDetailCD())) {
                params = {
                    menuCD: commonGLB.getMenuCD(),
                    siteID: commonGLB.getSiteID(),
                    grade: commonGLB.getGrade(),
                    subjectCD: commonGLB.getSubjectCD(),
                    is_default : 1,
                };
                filter = filterCLS.getMenuExamFilterData(params);
            } else {
                params = {
                    menuCD: commonGLB.getMenuCD(),
                    siteID: commonGLB.getSiteID(),
                    grade: commonGLB.getGrade(),
                    subjectCD: commonGLB.getSubjectCD(),
                    subjectDetailCD : commonGLB.getSubjectDetailCD(),
                    is_default : 1,
                };
                filter = filterCLS.getMenuExamFilterData(params);
            }

            if (filter.length > 0) {
                selectedFilterNm = filter[0].TEXT_BOOK_NM;
                selectedFilterCD = filter[0].TEXT_BOOK_CD;
            }
            jQuery("#filter").append(templateReplace(jQuery("#hidden-filter-item-template").html(), [hasClass, commonCLS.FILTER.출판사.CD, selectedFilterNm]));
            commonGLB.setStorage(commonCLS.FILTER.출판사.CD, selectedFilterCD);
            commonGLB.setStorage(storage.SEARCH_TEXT_BOOK_NM, selectedFilterNm);
            filterCLS.setSearchExpaprCode(filter);
        }

        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.난이도.FILTER_CD)) {
            filterCLS.setFilterByLevelCD(commonCLS.FILTER.난이도.CD);
        }

        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.년도.FILTER_CD)) {
            if (isValueEmpty(commonGLB.getSubjectDetailCD())) {
                params = {
                    menuCD: commonGLB.getMenuCD(),
                    siteID: commonGLB.getSiteID(),
                    grade: commonGLB.getGrade(),
                    subjectCD: commonGLB.getSubjectCD(),
                    is_default : 1,
                };
                filter = filterCLS.getMenuExamFilterData(params);
            } else {
                params = {
                    menuCD: commonGLB.getMenuCD(),
                    siteID: commonGLB.getSiteID(),
                    grade: commonGLB.getGrade(),
                    subjectCD: commonGLB.getSubjectCD(),
                    subjectDetailCD : commonGLB.getSubjectDetailCD(),
                    is_default : 1,
                };
                filter = filterCLS.getMenuExamFilterData(params);
            }

            if (filter.length > 0) {
                selectedFilterNm = filter[0].YEAR_NM;
                selectedFilterCD = filter[0].YEAR_CD;
                jQuery("#filter").append(templateReplace($("#hidden-filter-item-template").html(), [hasClass, commonCLS.FILTER.년도.CD, selectedFilterNm]));
                commonGLB.setStorage(commonCLS.FILTER.년도.CD, selectedFilterCD);
                filterCLS.setSearchExpaprCode(filter);
            }
        }

        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.작품.FILTER_CD)) {
            filterCLS.setFilterByWork();
        }

        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.학습단계.FILTER_CD)) {
            let selectedFilterNm = "중단원 학습";

            commonGLB.setStorage(commonCLS.FILTER.학습단계.CD, 1);

            jQuery("#filter").append(templateReplace(jQuery("#hidden-filter-item-template").html(), [jQuery("#hidden-filter-item-has-arrow-class-template").html(), commonCLS.FILTER.학습단계.CD, selectedFilterNm]));
        }

        filterCLS.goSearch();
    },
    selectedGrade: function () {
        jQuery("." + commonCLS.FILTER.과목.CD).remove();

        filterCLS.filterInit(Array(commonCLS.FILTER.상세과목.CD, commonCLS.FILTER.교과서.CD, commonCLS.FILTER.단원.CD, commonCLS.FILTER.난이도.CD, commonCLS.FILTER.단계.CD));
        filterCLS.filterInit(Array(commonCLS.FILTER.출판사.CD, commonCLS.FILTER.년도.CD, commonCLS.FILTER.갈래.CD, commonCLS.FILTER.시대.CD, commonCLS.FILTER.작품.CD, commonCLS.FILTER.학습단계.CD));
        jQuery("#partFilter").hide();
        jQuery("#workFilter").hide();

        let filter;
        let params;
        let selectedFilterNm = "";
        let selectedFilterCD = "";
        let hasClass = jQuery("#hidden-filter-item-has-arrow-class-template").html();

        params = {
            menuCD: commonGLB.getMenuCD(),
            siteID: commonGLB.getSiteID(),
            grade: commonGLB.getGrade(),
            subjectCD: commonGLB.getSubjectCD(),
            is_default : 1,
        };

        filter = filterCLS.getMenuExamFilterData(params);
        if (filter.length > 0) {
            selectedFilterNm = filter[0].SUBJECT_NM;
            selectedFilterCD = filter[0].SUBJECT_CD;
        } else {
            params = {
                menuCD: commonGLB.getMenuCD(),
                siteID: commonGLB.getSiteID(),
                grade: commonGLB.getGrade(),
                is_default : 1,
            };
            filter = filterCLS.getMenuExamFilterData(params);
            selectedFilterNm = filter[0].SUBJECT_NM;
            selectedFilterCD = filter[0].SUBJECT_CD;
        }
        jQuery("#filter").append(templateReplace($("#hidden-filter-item-template").html(), [hasClass, commonCLS.FILTER.과목.CD, selectedFilterNm]));
        commonGLB.setStorage(commonCLS.FILTER.과목.CD, selectedFilterCD);
        filterCLS.setSearchExpaprCode(filter);

        let menuByFilter = filterCLS.getMenuByFilter();
        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.상세과목.FILTER_CD)) {
            params = {
                menuCD: commonGLB.getMenuCD(),
                siteID: commonGLB.getSiteID(),
                grade: commonGLB.getGrade(),
                subjectCD: commonGLB.getSubjectCD(),
                is_default : 1,
            };
            filter = filterCLS.getMenuExamFilterData(params);
            if (filter.length > 0) {
                selectedFilterNm = filter[0].SUBJECT_DETAIL_NM;
                selectedFilterCD = filter[0].SUBJECT_DETAIL_CD;

                if (isValueEmpty(selectedFilterNm) == false) {
                    jQuery("#filter").append(templateReplace(jQuery("#hidden-filter-item-template").html(), [hasClass, commonCLS.FILTER.상세과목.CD, selectedFilterNm]));
                    commonGLB.setStorage(commonCLS.FILTER.상세과목.CD, selectedFilterCD);
                    filterCLS.setSearchExpaprCode(filter);
                }
            }
        }
                if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.갈래.FILTER_CD)) {
            params = {
                menuCD: commonGLB.getMenuCD(),
                siteID: commonGLB.getSiteID(),
                grade: commonGLB.getGrade(),
                subjectCD: commonGLB.getSubjectCD(),
                is_default : 1,
            };
            filter = filterCLS.getMenuExamFilterData(params);
            if (filter.length > 0) {
                selectedFilterNm = filter[0].SUBJECT_DETAIL_NM;
                selectedFilterCD = filter[0].SUBJECT_DETAIL_CD;

                if (isValueEmpty(selectedFilterNm) == false) {
                    jQuery("#filter").append(templateReplace(jQuery("#hidden-filter-item-template").html(), [hasClass, commonCLS.FILTER.갈래.CD, selectedFilterNm]));
                    commonGLB.setStorage(commonCLS.FILTER.상세과목.CD, selectedFilterCD);
                    filterCLS.setSearchExpaprCode(filter);
                }
            }
        }

        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.시대.FILTER_CD)) {
            params = {
                menuCD: commonGLB.getMenuCD(),
                siteID: commonGLB.getSiteID(),
                grade: commonGLB.getGrade(),
                subjectCD: commonGLB.getSubjectCD(),
                is_default : 1,
            };
            filter = filterCLS.getMenuExamFilterData(params);
            if (filter.length > 0) {
                selectedFilterNm = filter[0].SUBJECT_DETAIL_NM;
                selectedFilterCD = filter[0].SUBJECT_DETAIL_CD;

                if (isValueEmpty(selectedFilterNm) == false) {
                    jQuery("#filter").append(templateReplace(jQuery("#hidden-filter-item-template").html(), [hasClass, commonCLS.FILTER.시대.CD, selectedFilterNm]));
                    commonGLB.setStorage(commonCLS.FILTER.상세과목.CD, selectedFilterCD);
                    filterCLS.setSearchExpaprCode(filter);
                }
            }
        }

        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.교과서.FILTER_CD)) {
            params = {
                menuCD: commonGLB.getMenuCD(),
                siteID: commonGLB.getSiteID(),
                grade: commonGLB.getGrade(),
                subjectCD: commonGLB.getSubjectCD(),
                is_default : 1,
            };
            filter = filterCLS.getMenuExamFilterData(params);
            if (filter.length > 0) {
                selectedFilterNm = filter[0].TX_NM;
                selectedFilterCD = filter[0].TX_CD;
            }
            jQuery("#filter").append(templateReplace(jQuery("#hidden-filter-item-template").html(), [hasClass, commonCLS.FILTER.교과서.CD, selectedFilterNm]));
            commonGLB.setStorage(commonCLS.FILTER.교과서.CD, selectedFilterCD);
            filterCLS.setSearchExpaprCode(filter);
        } else {
            //교과서 정보를 사용하지 않지만 TX_CD 조회가 필요한 경우
            if (isValueEmpty(commonGLB.getSubjectDetailCD())) {
                params = {
                    menuCD: commonGLB.getMenuCD(),
                    siteID: commonGLB.getSiteID(),
                    grade: commonGLB.getGrade(),
                    subjectCD: commonGLB.getSubjectCD(),
                    is_default : 1,
                };
                filter = filterCLS.getMenuExamFilterData(params);
            } else {
                params = {
                    menuCD: commonGLB.getMenuCD(),
                    siteID: commonGLB.getSiteID(),
                    grade: commonGLB.getGrade(),
                    subjectCD: commonGLB.getSubjectCD(),
                    subjectDetailCD : commonGLB.getSubjectDetailCD(),
                    is_default : 1,
                };
                filter = filterCLS.getMenuExamFilterData(params);
            }
            if (filter.length > 0) {
                selectedFilterCD = filter[0].TX_CD;
                commonGLB.setStorage(commonCLS.FILTER.교과서.CD, selectedFilterCD);
            }
            filterCLS.setSearchExpaprCode(filter);
        }

        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.단원.FILTER_CD)) {
            filterCLS.setFilterByPart();
        }

        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.단계.FILTER_CD)) {
            filterCLS.setFilterByLevelCD(commonCLS.FILTER.단계.CD);
        }

        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.출판사.FILTER_CD)) {
            if (isValueEmpty(commonGLB.getSubjectDetailCD())) {
                 params = {
                    menuCD: commonGLB.getMenuCD(),
                    siteID: commonGLB.getSiteID(),
                    grade: commonGLB.getGrade(),
                    subjectCD: commonGLB.getSubjectCD(),
                    is_default : 1,
                };
                filter = filterCLS.getMenuExamFilterData(params);
            } else {
                params = {
                    menuCD: commonGLB.getMenuCD(),
                    siteID: commonGLB.getSiteID(),
                    grade: commonGLB.getGrade(),
                    subjectCD: commonGLB.getSubjectCD(),
                    subjectDetailCD : commonGLB.getSubjectDetailCD(),
                    is_default : 1,
                };
                filter = filterCLS.getMenuExamFilterData(params);
            }

            if (filter.length > 0) {
                selectedFilterNm = filter[0].TEXT_BOOK_NM;
                selectedFilterCD = filter[0].TEXT_BOOK_CD;
            }
            jQuery("#filter").append(templateReplace(jQuery("#hidden-filter-item-template").html(), [hasClass, commonCLS.FILTER.출판사.CD, selectedFilterNm]));
            commonGLB.setStorage(commonCLS.FILTER.출판사.CD, selectedFilterCD);
            commonGLB.setStorage(storage.SEARCH_TEXT_BOOK_NM, selectedFilterNm);
            filterCLS.setSearchExpaprCode(filter);
        }

        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.난이도.FILTER_CD)) {
            filterCLS.setFilterByLevelCD(commonCLS.FILTER.난이도.CD);
        }

        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.년도.FILTER_CD)) {
            if (isValueEmpty(commonGLB.getSubjectDetailCD())) {
                 params = {
                    menuCD: commonGLB.getMenuCD(),
                    siteID: commonGLB.getSiteID(),
                    grade: commonGLB.getGrade(),
                    subjectCD: commonGLB.getSubjectCD(),
                    is_default : 1,
                };
                filter = filterCLS.getMenuExamFilterData(params);
            } else {
                params = {
                    menuCD: commonGLB.getMenuCD(),
                    siteID: commonGLB.getSiteID(),
                    grade: commonGLB.getGrade(),
                    subjectCD: commonGLB.getSubjectCD(),
                    subjectDetailCD : commonGLB.getSubjectDetailCD(),
                    is_default : 1,
                };
                filter = filterCLS.getMenuExamFilterData(params);
            }
            if (filter.length > 0) {
                selectedFilterNm = filter[0].YEAR_NM;
                selectedFilterCD = filter[0].YEAR_CD;
                jQuery("#filter").append(templateReplace($("#hidden-filter-item-template").html(), [hasClass, commonCLS.FILTER.년도.CD, selectedFilterNm]));
                commonGLB.setStorage(commonCLS.FILTER.년도.CD, selectedFilterCD);
                filterCLS.setSearchExpaprCode(filter);
            }
        }

        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.작품.FILTER_CD)) {
            filterCLS.setFilterByWork();
        }

        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.학습단계.FILTER_CD)) {
            let selectedFilterNm = "중단원 학습";

            commonGLB.setStorage(commonCLS.FILTER.학습단계.CD, 1);

            jQuery("#filter").append(templateReplace(jQuery("#hidden-filter-item-template").html(), [jQuery("#hidden-filter-item-has-arrow-class-template").html(), commonCLS.FILTER.학습단계.CD, selectedFilterNm]));
        }

        filterCLS.goSearch();
    },
    selectedSubjectCD: function () {
        filterCLS.filterInit(Array(commonCLS.FILTER.상세과목.CD, commonCLS.FILTER.교과서.CD, commonCLS.FILTER.단원.CD, commonCLS.FILTER.난이도.CD, commonCLS.FILTER.단계.CD));
        filterCLS.filterInit(Array(commonCLS.FILTER.출판사.CD, commonCLS.FILTER.년도.CD, commonCLS.FILTER.갈래.CD, commonCLS.FILTER.시대.CD, commonCLS.FILTER.작품.CD, commonCLS.FILTER.학습단계.CD));
        jQuery("#partFilter").hide();
        jQuery("#workFilter").hide();

        let filter;
        let params;
        let selectedFilterNm = "";
        let selectedFilterCD = "";
        let hasClass = jQuery("#hidden-filter-item-has-arrow-class-template").html();

        $("#AccordionAllToggleMain").html("");
        if (isArrayInValue(menuCLS.ARRAY_NOT_EXISTS_PART_MENU_CD, commonGLB.getMenuCD()) || (isArrayInValue(["000020000800001", "000020000800002"], commonGLB.getMenuCD()) && commonGLB.getSubjectCD() == "KR") || isArrayInValue(["000010000700002", "000010000700003"], commonGLB.getMenuCD())) { // 부교재 변형 > 수능특강 AI 유형 / 올림포스AI유형 국어에 대해 예외 처리
            filterCLS.IS_PART = false;
            if (isArrayInValue(filterCLS.KOREAN_PART_HANDLING_MENU_LIST, commonGLB.getMenuCD()) || isArrayInValue(["000010000700002", "000010000700003"], commonGLB.getMenuCD())) {
                $("#AccordionAllToggleMain").html($("#hidden-accordion-all-toggle-template").html());
            }
            if (isArrayInValue(["000020000800001", "000020000800002"], commonGLB.getMenuCD())) {
                filterCLS.IS_EXCEPTION_TEMPLATE = true;
            } else {
                filterCLS.IS_EXCEPTION_TEMPLATE = false;
            }
        } else {
            filterCLS.IS_PART = true;
            filterCLS.IS_EXCEPTION_TEMPLATE = false;
            if (isArrayInValue(filterCLS.BEFORE_TX15_MENU_LIST, commonGLB.getMenuCD()) == false) {
                $("#AccordionAllToggleMain").html($("#hidden-accordion-all-toggle-template").html());
            }
        }

        let menuByFilter = filterCLS.getMenuByFilter();
        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.상세과목.FILTER_CD)) {
            params = {
                menuCD: commonGLB.getMenuCD(),
                siteID: commonGLB.getSiteID(),
                grade: commonGLB.getGrade(),
                subjectCD: commonGLB.getSubjectCD(),
                is_default : 1,
            };
            filter = filterCLS.getMenuExamFilterData(params);
            if (filter.length > 0) {
                selectedFilterNm = filter[0].SUBJECT_DETAIL_NM;
                selectedFilterCD = filter[0].SUBJECT_DETAIL_CD;

                if (isValueEmpty(selectedFilterNm) == false) {
                    jQuery("#filter").append(templateReplace(jQuery("#hidden-filter-item-template").html(), [hasClass, commonCLS.FILTER.상세과목.CD, selectedFilterNm]));
                    commonGLB.setStorage(commonCLS.FILTER.상세과목.CD, selectedFilterCD);
                    filterCLS.setSearchExpaprCode(filter);
                }
            }
        }

        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.갈래.FILTER_CD)) {
            params = {
                menuCD: commonGLB.getMenuCD(),
                siteID: commonGLB.getSiteID(),
                grade: commonGLB.getGrade(),
                subjectCD: commonGLB.getSubjectCD(),
                is_default : 1,
            };
            filter = filterCLS.getMenuExamFilterData(params);
            if (filter.length > 0) {
                selectedFilterNm = filter[0].SUBJECT_DETAIL_NM;
                selectedFilterCD = filter[0].SUBJECT_DETAIL_CD;

                if (isValueEmpty(selectedFilterNm) == false) {
                    jQuery("#filter").append(templateReplace(jQuery("#hidden-filter-item-template").html(), [hasClass, commonCLS.FILTER.갈래.CD, selectedFilterNm]));
                    commonGLB.setStorage(commonCLS.FILTER.상세과목.CD, selectedFilterCD);
                    filterCLS.setSearchExpaprCode(filter);
                }
            }
        }

        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.시대.FILTER_CD)) {
            params = {
                menuCD: commonGLB.getMenuCD(),
                siteID: commonGLB.getSiteID(),
                grade: commonGLB.getGrade(),
                subjectCD: commonGLB.getSubjectCD(),
                is_default : 1,
            };
            filter = filterCLS.getMenuExamFilterData(params);
            if (filter.length > 0) {
                selectedFilterNm = filter[0].SUBJECT_DETAIL_NM;
                selectedFilterCD = filter[0].SUBJECT_DETAIL_CD;

                if (isValueEmpty(selectedFilterNm) == false) {
                    jQuery("#filter").append(templateReplace(jQuery("#hidden-filter-item-template").html(), [hasClass, commonCLS.FILTER.시대.CD, selectedFilterNm]));
                    commonGLB.setStorage(commonCLS.FILTER.상세과목.CD, selectedFilterCD);
                    filterCLS.setSearchExpaprCode(filter);
                }
            }
        }

        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.교과서.FILTER_CD)) {
            params = {
                menuCD: commonGLB.getMenuCD(),
                siteID: commonGLB.getSiteID(),
                grade: commonGLB.getGrade(),
                subjectCD: commonGLB.getSubjectCD(),
                is_default : 1,
            };
            filter = filterCLS.getMenuExamFilterData(params);
            if (filter.length > 0) {
                selectedFilterNm = filter[0].TX_NM;
                selectedFilterCD = filter[0].TX_CD;
            }
            jQuery("#filter").append(templateReplace(jQuery("#hidden-filter-item-template").html(), [hasClass, commonCLS.FILTER.교과서.CD, selectedFilterNm]));
            commonGLB.setStorage(commonCLS.FILTER.교과서.CD, selectedFilterCD);
            filterCLS.setSearchExpaprCode(filter);
        } else {
            if (isValueEmpty(commonGLB.getSubjectDetailCD())) {
                params = {
                    menuCD: commonGLB.getMenuCD(),
                    siteID: commonGLB.getSiteID(),
                    grade: commonGLB.getGrade(),
                    subjectCD: commonGLB.getSubjectCD(),
                    is_default : 1,
                };
                filter = filterCLS.getMenuExamFilterData(params);
            } else {
                params = {
                    menuCD: commonGLB.getMenuCD(),
                    siteID: commonGLB.getSiteID(),
                    grade: commonGLB.getGrade(),
                    subjectCD: commonGLB.getSubjectCD(),
                    subjectDetailCD : commonGLB.getSubjectDetailCD(),
                    is_default : 1,
                };
                filter = filterCLS.getMenuExamFilterData(params);
            }
            if (filter.length > 0) {
                selectedFilterCD = filter[0].TX_CD;
                commonGLB.setStorage(commonCLS.FILTER.교과서.CD, selectedFilterCD);
            }
            filterCLS.setSearchExpaprCode(filter);
        }
        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.단원.FILTER_CD)) {
            filterCLS.setFilterByPart();
        }

        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.단계.FILTER_CD)) {
            filterCLS.setFilterByLevelCD(commonCLS.FILTER.단계.CD);
        }

        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.출판사.FILTER_CD)) {
            if (isValueEmpty(commonGLB.getSubjectDetailCD())) {
                params = {
                    menuCD: commonGLB.getMenuCD(),
                    siteID: commonGLB.getSiteID(),
                    grade: commonGLB.getGrade(),
                    subjectCD: commonGLB.getSubjectCD(),
                    is_default : 1,
                };
                filter = filterCLS.getMenuExamFilterData(params);
            } else {
                params = {
                    menuCD: commonGLB.getMenuCD(),
                    siteID: commonGLB.getSiteID(),
                    grade: commonGLB.getGrade(),
                    subjectCD: commonGLB.getSubjectCD(),
                    subjectDetailCD : commonGLB.getSubjectDetailCD(),
                    is_default : 1,
                };
                filter = filterCLS.getMenuExamFilterData(params);
            }
            if (filter.length > 0) {
                selectedFilterNm = filter[0].TEXT_BOOK_NM;
                selectedFilterCD = filter[0].TEXT_BOOK_CD;
            }
            jQuery("#filter").append(templateReplace(jQuery("#hidden-filter-item-template").html(), [hasClass, commonCLS.FILTER.출판사.CD, selectedFilterNm]));
            commonGLB.setStorage(commonCLS.FILTER.출판사.CD, selectedFilterCD);
            commonGLB.setStorage(storage.SEARCH_TEXT_BOOK_NM, selectedFilterNm);
            filterCLS.setSearchExpaprCode(filter);
        }

        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.난이도.FILTER_CD)) {
            filterCLS.setFilterByLevelCD(commonCLS.FILTER.난이도.CD);
        }

        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.년도.FILTER_CD)) {
            if (isValueEmpty(commonGLB.getSubjectDetailCD())) {
                params = {
                    menuCD: commonGLB.getMenuCD(),
                    siteID: commonGLB.getSiteID(),
                    grade: commonGLB.getGrade(),
                    subjectCD: commonGLB.getSubjectCD(),
                    is_default : 1,
                };
                filter = filterCLS.getMenuExamFilterData(params);
            } else {
                params = {
                    menuCD: commonGLB.getMenuCD(),
                    siteID: commonGLB.getSiteID(),
                    grade: commonGLB.getGrade(),
                    subjectCD: commonGLB.getSubjectCD(),
                    subjectDetailCD : commonGLB.getSubjectDetailCD(),
                    is_default : 1,
                };
                filter = filterCLS.getMenuExamFilterData(params);
            }

            if (filter.length > 0) {
                selectedFilterNm = filter[0].YEAR_NM;
                selectedFilterCD = filter[0].YEAR_CD;
                jQuery("#filter").append(templateReplace($("#hidden-filter-item-template").html(), [hasClass, commonCLS.FILTER.년도.CD, selectedFilterNm]));
                commonGLB.setStorage(commonCLS.FILTER.년도.CD, selectedFilterCD);
                filterCLS.setSearchExpaprCode(filter);
            }
        }

        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.작품.FILTER_CD)) {
            filterCLS.setFilterByWork();
        }

        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.학습단계.FILTER_CD)) {
            let selectedFilterNm = "중단원 학습";

            commonGLB.setStorage(commonCLS.FILTER.학습단계.CD, 1);

            jQuery("#filter").append(templateReplace(jQuery("#hidden-filter-item-template").html(), [jQuery("#hidden-filter-item-has-arrow-class-template").html(), commonCLS.FILTER.학습단계.CD, selectedFilterNm]));
        }

        filterCLS.goSearch();

		if (TRK_GLB_SERVICE_TYPE_CD == 2) {//모바일웹인 경우
			menuCLS.setLNBWeb();
		} else {
			if (menuCLS.LNB_TIP_USE_CD == 1) {
				menuCLS.setBrandLNB();
			} else {
				menuCLS.setLNB();
			}
		}
    },
    selectedSubjectDetailCD: function () {
        filterCLS.filterInit(Array(commonCLS.FILTER.교과서.CD, commonCLS.FILTER.단원.CD, commonCLS.FILTER.난이도.CD, commonCLS.FILTER.단계.CD));
        filterCLS.filterInit(Array(commonCLS.FILTER.출판사.CD, commonCLS.FILTER.년도.CD, commonCLS.FILTER.작품.CD, commonCLS.FILTER.학습단계.CD));
        jQuery("#partFilter").hide();
        jQuery("#workFilter").hide();

        let filter;
        let params;
        let selectedFilterNm = "";
        let selectedFilterCD = "";
        let hasClass = jQuery("#hidden-filter-item-has-arrow-class-template").html();

        let menuByFilter = filterCLS.getMenuByFilter();
        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.교과서.FILTER_CD)) {
            params = {
                menuCD: commonGLB.getMenuCD(),
                siteID: commonGLB.getSiteID(),
                grade: commonGLB.getGrade(),
				subjectCD: commonGLB.getSubjectCD(),
                subjectDetailCD : commonGLB.getSubjectDetailCD(),
            };
            filter = filterCLS.getMenuExamFilterData(params);
            if (filter.length > 0) {
                selectedFilterNm = filter[0].TX_NM;
                selectedFilterCD = filter[0].TX_CD;

                jQuery("#filter").append(templateReplace(jQuery("#hidden-filter-item-template").html(), [hasClass, commonCLS.FILTER.교과서.CD, selectedFilterNm]));
                commonGLB.setStorage(commonCLS.FILTER.교과서.CD, selectedFilterCD);
                filterCLS.setSearchExpaprCode(filter);
            }
        } else {
            //교과서 정보를 사용하지 않지만 TX_CD 조회가 필요한 경우
            if (isValueEmpty(commonGLB.getSubjectDetailCD())) {
                params = {
                    menuCD: commonGLB.getMenuCD(),
                    siteID: commonGLB.getSiteID(),
                    grade: commonGLB.getGrade(),
                    subjectCD: commonGLB.getSubjectCD(),
                };
                filter = filterCLS.getMenuExamFilterData(params);
            } else {
                params = {
                    menuCD: commonGLB.getMenuCD(),
                    siteID: commonGLB.getSiteID(),
                    grade: commonGLB.getGrade(),
                    subjectCD: commonGLB.getSubjectCD(),
                    subjectDetailCD : commonGLB.getSubjectDetailCD(),
                };
                filter = filterCLS.getMenuExamFilterData(params);
            }

            if (filter.length > 0) {
                selectedFilterCD = filter[0].TX_CD;
                commonGLB.setStorage(commonCLS.FILTER.교과서.CD, selectedFilterCD);
            }
            filterCLS.setSearchExpaprCode(filter);
        }
        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.단원.FILTER_CD)) {
            filterCLS.setFilterByPart();
        }

        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.단계.FILTER_CD)) {
            filterCLS.setFilterByLevelCD(commonCLS.FILTER.단계.CD);
        }

        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.출판사.FILTER_CD)) {
            if (isValueEmpty(commonGLB.getSubjectDetailCD())) {
                params = {
                    menuCD: commonGLB.getMenuCD(),
                    siteID: commonGLB.getSiteID(),
                    grade: commonGLB.getGrade(),
                    subjectCD: commonGLB.getSubjectCD(),
                    is_default : 1,
                };
                filter = filterCLS.getMenuExamFilterData(params);
            } else {
                params = {
                    menuCD: commonGLB.getMenuCD(),
                    siteID: commonGLB.getSiteID(),
                    grade: commonGLB.getGrade(),
                    subjectCD: commonGLB.getSubjectCD(),
                    subjectDetailCD : commonGLB.getSubjectDetailCD(),
                    is_default : 1,
                };
                filter = filterCLS.getMenuExamFilterData(params);
            }

            if (filter.length > 0) {
                selectedFilterNm = filter[0].TEXT_BOOK_NM;
                selectedFilterCD = filter[0].TEXT_BOOK_CD;
            }
            jQuery("#filter").append(templateReplace(jQuery("#hidden-filter-item-template").html(), [hasClass, commonCLS.FILTER.출판사.CD, selectedFilterNm]));
            commonGLB.setStorage(commonCLS.FILTER.출판사.CD, selectedFilterCD);
            commonGLB.setStorage(storage.SEARCH_TEXT_BOOK_NM, selectedFilterNm);
            filterCLS.setSearchExpaprCode(filter);
        }

        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.난이도.FILTER_CD)) {
            filterCLS.setFilterByLevelCD(commonCLS.FILTER.난이도.CD);
        }

        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.년도.FILTER_CD)) {
            if (isValueEmpty(commonGLB.getSubjectDetailCD())) {
                params = {
                    menuCD: commonGLB.getMenuCD(),
                    siteID: commonGLB.getSiteID(),
                    grade: commonGLB.getGrade(),
                    subjectCD: commonGLB.getSubjectCD(),
                };
                filter = filterCLS.getMenuExamFilterData(params);
            } else {
                params = {
                    menuCD: commonGLB.getMenuCD(),
                    siteID: commonGLB.getSiteID(),
                    grade: commonGLB.getGrade(),
                    subjectCD: commonGLB.getSubjectCD(),
                    subjectDetailCD : commonGLB.getSubjectDetailCD(),
                };
                filter = filterCLS.getMenuExamFilterData(params);
            }

            if (filter.length > 0) {
                selectedFilterNm = filter[0].YEAR_NM;
                selectedFilterCD = filter[0].YEAR_CD;
                jQuery("#filter").append(templateReplace($("#hidden-filter-item-template").html(), [hasClass, commonCLS.FILTER.년도.CD, selectedFilterNm]));
                commonGLB.setStorage(commonCLS.FILTER.년도.CD, selectedFilterCD);
                filterCLS.setSearchExpaprCode(filter);
            }
        }

        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.작품.FILTER_CD)) {
            filterCLS.setFilterByWork();
        }

        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.학습단계.FILTER_CD)) {
            let selectedFilterNm = "중단원 학습";

            commonGLB.setStorage(commonCLS.FILTER.학습단계.CD, 1);

            jQuery("#filter").append(templateReplace(jQuery("#hidden-filter-item-template").html(), [jQuery("#hidden-filter-item-has-arrow-class-template").html(), commonCLS.FILTER.학습단계.CD, selectedFilterNm]));
        }

        filterCLS.goSearch();
    },
    selectedTxCD: function (filterName) {
        filterCLS.filterInit(Array(commonCLS.FILTER.단원.CD, commonCLS.FILTER.난이도.CD, commonCLS.FILTER.단계.CD));
        filterCLS.filterInit(Array(commonCLS.FILTER.년도.CD, commonCLS.FILTER.작품.CD, commonCLS.FILTER.학습단계.CD));
        jQuery("#partFilter").hide();
        jQuery("#workFilter").hide();

        let menuByFilter = filterCLS.getMenuByFilter();
        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.단원.FILTER_CD)) {
            filterCLS.setFilterByPart();
        }

        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.난이도.FILTER_CD)) {
            filterCLS.setFilterByLevelCD(commonCLS.FILTER.난이도.CD);
        }

        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.단계.FILTER_CD)) {
            filterCLS.setFilterByLevelCD(commonCLS.FILTER.단계.CD);
        }

        if (filterCLS.getIsFilter(menuByFilter, commonCLS.FILTER.학습단계.FILTER_CD)) {
            let selectedFilterNm = "중단원 학습";

            commonGLB.setStorage(commonCLS.FILTER.학습단계.CD, 1);

            jQuery("#filter").append(templateReplace(jQuery("#hidden-filter-item-template").html(), [jQuery("#hidden-filter-item-has-arrow-class-template").html(), commonCLS.FILTER.학습단계.CD, selectedFilterNm]));
        }

        // 동아 권한이 없으면 팝업 노출 시키고, 리스트 노출 안시키기 위해
        if (filterName != "동아시아사" && filterName.includes("동아") == true && commonCLS.IS_EXPOSED_PUBLISHERS_ENDED == false) {
            modalCLS.popupOpen("서비스 재개 안내");
            modalCLS.setBodyContent($("#hidden-service-stop-modal-template").html());

            jQuery("#examMain").html("");
		} else {
            //TXCD 매칭되는 group, coretype 데이터로 수정
            filterCLS.setGroupAndCoreType();
			filterCLS.goSearch();
		}
    },
    selectedLevelCD : function() {
        if (isArrayInValue(["000010000100002", "000020000100002", "000010000100003", "000020000100003", "000020000800003", "000020001100001"], commonGLB.getMenuCD())) {
            let params = "";
            if ("000020000800003" == commonGLB.getMenuCD()) {
                params = {
                    MENU_CD: commonGLB.getMenuCD(),
                    LEVEL_CD: commonGLB.getLevelCD(),
                    SUBJECT_DETAIL_CD: commonGLB.getSubjectDetailCD(),
                };
            } else {
                params = {
                    MENU_CD: commonGLB.getMenuCD(),
                    SUBJECT_CD : commonGLB.getSubjectCD(),
                    GRADE : commonGLB.getGrade(),
                    LEVEL_CD: commonGLB.getLevelCD(),
                };
            }
            let filter = filterCLS.getLevelData(params);
            if (filter.length > 0) {
                selectedFilterCD = filter[0].TX_CD;
                commonGLB.setStorage(commonCLS.FILTER.교과서.CD, selectedFilterCD);
            }
            filterCLS.setSearchExpaprCode(filter);
        }

		filterCLS.goSearch();
    },
    selectedTextBookCD: function () {
        let selectedFilterNM = "";
        let filter = filterCLS.ARRAY_MENU_EXAM_FILTER.filter((val) => { return val.MENU_CD == commonGLB.getMenuCD() && val.SITE_ID == commonGLB.getSiteID() && val.GRADE == commonGLB.getGrade() && val.SUBJECT_CD == commonGLB.getSubjectCD() && val.TEXT_BOOK_CD == commonGLB.getSearchTextBookCD(); });
        if (filter.length > 0) {
            selectedFilterNM = filter[0].TEXT_BOOK_NM;
            commonGLB.setStorage(storage.SEARCH_TEXT_BOOK_NM, selectedFilterNM);
        }
        filterCLS.goSearch();
    },
    selectedTearCD: function () {
        let filter;
        let selectedFilterCD = "";
        if (isValueEmpty(commonGLB.getSubjectDetailCD())) {
            filter = filterCLS.ARRAY_MENU_EXAM_FILTER.filter((val) => { return val.MENU_CD == commonGLB.getMenuCD() && val.SITE_ID == commonGLB.getSiteID() && val.GRADE == commonGLB.getGrade() && val.SUBJECT_CD == commonGLB.getSubjectCD() && val.YEAR_CD == commonGLB.getYearCD(); });
        } else {
            filter = filterCLS.ARRAY_MENU_EXAM_FILTER.filter((val) => { return val.MENU_CD == commonGLB.getMenuCD() && val.SITE_ID == commonGLB.getSiteID() && val.GRADE == commonGLB.getGrade() && val.SUBJECT_CD == commonGLB.getSubjectCD() && val.SUBJECT_DETAIL_CD == commonGLB.getSubjectDetailCD() && val.YEAR_CD == commonGLB.getYearCD(); });
        }

        if (filter.length > 0) {
            selectedFilterCD = filter[0].YEAR_CD;
            commonGLB.setStorage(storage.SEARCH_YEAR_CD, selectedFilterCD);
            
            selectedFilterCD = filter[0].TX_CD;
            commonGLB.setStorage(commonCLS.FILTER.교과서.CD, selectedFilterCD);
        }
        filterCLS.goSearch();
    },
    setSearchExpaprCode: function (arrayFilter) {
        let filter = [...new Map(arrayFilter.map(item => [item.EXPAPR_GROUP_CD, item.EXPAPR_CORETYPE_CD])).entries()].map(([EXPAPR_GROUP_CD, EXPAPR_CORETYPE_CD]) => ({ EXPAPR_GROUP_CD, EXPAPR_CORETYPE_CD }))
        if (filter.length > 0) {
            commonGLB.setStorage(commonCLS.FILTER.시험지그룹코드.CD, filter[0].EXPAPR_GROUP_CD);
            commonGLB.setStorage(commonCLS.FILTER.시험지코어타입코드.CD, filter[0].EXPAPR_CORETYPE_CD);
        }
    },
    selectedStepCD: function (value) {
       commonGLB.setStorage(commonCLS.FILTER.학습단계.CD, value);
       filterCLS.goSearch();
    },
    getWorkBottomSheetLayer: function (selectedItem) {
        filterCLS.setBottomSheetLayer(selectedItem, filterCLS.setBottomSheetLayerHeader(commonCLS.FILTER.작품.CD), filterCLS.getWorkBottomSheetLayerBodyHtml(), filterCLS.getWorkBottomSheetLayerFooterHtml());
    },
    getWorkAuthorList : function () {
        return [...new Map(filterCLS.ARRAY_WORK_CD.map(item => [item.AUTHOR])).entries()].map(([AUTHOR]) => ({ AUTHOR }));
    },
    getWorkBottomSheetLayerBodyHtml: function () {
        let arraySelectedCD = commonGLB.getWork() == storage.SEARCH_WORK_TITLE ? commonGLB.getWorkTitle().toString().split("|") : commonGLB.getWorkAuthor().toString().split("|");
        let isActiveWorkCD = commonGLB.getWork() == storage.SEARCH_WORK_TITLE ? "is-active" : "";
        let isActiveWorkAuthor = commonGLB.getWork() == storage.SEARCH_WORK_AUTHOR ? "is-active" : "";
        let contentHtml = "";
        let checkboxAllHtml = filterCLS.ARRAY_WORK_CD.length == arraySelectedCD.length ? "전체 해제" : "전체 선택";
        let arrayWork = commonGLB.getWork() == storage.SEARCH_WORK_TITLE ? filterCLS.ARRAY_WORK_CD.sort((a, b) => a.TITLE.localeCompare(b.TITLE)) : filterCLS.getWorkAuthorList().sort((a, b) => a.AUTHOR.localeCompare(b.AUTHOR));
        jQuery.each(arrayWork, function (i, work) {
            let selectedItem;
            let itemTitle;
            let itemValue;
            if (commonGLB.getWork() == storage.SEARCH_WORK_TITLE) {
                selectedItem = arraySelectedCD.filter((val) => { return val == work.TITLE; });
                itemTitle = work.TITLE + "-" + work.AUTHOR;
                itemValue = work.TITLE;
            } else {
                selectedItem = arraySelectedCD.filter((val) => { return val == work.AUTHOR; });
                itemTitle = work.AUTHOR;
                itemValue = work.AUTHOR;
            }
            let checked = selectedItem.length > 0 ? "checked" : "";
            contentHtml += templateReplace(jQuery("#hidden-bottom-sheet-layer-body-work-checkbox-item-template").html(), [itemValue, checked, itemTitle]);
        });
        return templateReplace(jQuery("#hidden-bottom-sheet-layer-body-work-checkbox-body-template").html(), [isActiveWorkCD, isActiveWorkAuthor, checkboxAllHtml, contentHtml]);;
    },
    getWorkBottomSheetLayerFooterHtml: function () {
        let arraySelectedCD = commonGLB.getWork() == storage.SEARCH_WORK_TITLE ? commonGLB.getWorkTitle().toString().split("|") : commonGLB.getWorkAuthor().toString().split("|");
        let isDisabled = arraySelectedCD.length > 0 ? "" : "disabled";
        return templateReplace(jQuery("#hidden-bottom-sheet-layer-footer-work-checkbox-submit-button-template").html(), [isDisabled]);
    },
    selectedWorkTab :function (work) {
        commonGLB.setStorage(storage.SELECTED_WORK, work);
        if (commonGLB.getWork() == storage.SEARCH_WORK_TITLE) {
            storage.removeLocal(storage.SEARCH_WORK_AUTHOR);
        } else {
            storage.removeLocal(storage.SEARCH_WORK_TITLE);
        }
        bottomSheetLayerCLS.setBody(filterCLS.getWorkBottomSheetLayerBodyHtml());
    },
    selectedWorkAll: function () {
        let ischecked = jQuery("input[name='work']").length == $("input[name='work']:checked").length ? true : false;
        if (ischecked) {
            jQuery("input[name='work']").prop("checked", false);
            jQuery("#checkbox_all").text('전체 선택');
        } else {
            jQuery("input[name='work']").prop("checked", true);
            jQuery("#checkbox_all").text('전체 해제');
        }
        filterCLS.selectedWork();
    },
    selectedWork: function () {
        let checkedCount = $("input[name='work']:checked").length;
        if (checkedCount > 0) {
            jQuery("#workSubmit").attr("disabled", false);
        } else {
            jQuery("#workSubmit").attr("disabled", true);
        }
        if (jQuery("input[name='work']").length == checkedCount) {
            jQuery("#checkbox_all").text('전체 해제');
        } else {
            jQuery("#checkbox_all").text('전체 선택');
        }
    },
    setWorkBottomSheetLayerSubmit: function (selectedItem) {
        if (jQuery("input[name='work']:checked").length == 0) {
            alert("작품을 선택해주세요.");
            return false;
        }
        let workList = new Array();
        jQuery("input[name='work']:checked").each(function () {
            workList.push(jQuery(this).val());
        });

        commonGLB.setStorage(commonGLB.getWork(), workList.join("|"));
        bottomSheetClose(selectedItem);
        filterCLS.setFilterHtmlByWork();
        filterCLS.goSearch();
        jQuery("#workFilter").show();
    },
    getRootPartBottomSheetLayer: function (selectedItem) {
        if (isValueEmpty(commonGLB.getRootPartCD())) {
            let partList = new Array();
            jQuery.each(filterCLS.ARRAY_PART_CD, function (i, item) {
                partList.push(item.ROOTPART_CODE);
            });
            commonGLB.setStorage(commonCLS.FILTER.단원.CD, partList.join(","));
        }
        filterCLS.setBottomSheetLayer(selectedItem, filterCLS.setBottomSheetLayerHeader(commonCLS.FILTER.단원.CD), filterCLS.getRootPartBottomSheetLayerBodyHtml(), filterCLS.getRootPartBottomSheetLayerFooterHtml());
    },
    getRootPartBottomSheetLayerBodyHtml: function () {
        let selectedRootPart = commonGLB.getRootPartCD().toString().split(",");
        let semesterMax = Math.max(...filterCLS.ARRAY_PART_CD.map(o => o.ROOTPART_TERM));
        let checkboxAllHtml = templateReplace(jQuery("#hidden-bottom-sheet-layer-body-checkbox-all-item-main-template").html(), [filterCLS.ARRAY_PART_CD.length == selectedRootPart.length ? "전체 해제" : "전체 선택"]);
        let bodyHtml = "";
        for (let semester = 1; semester <= semesterMax; semester++) {
            let semesterList = filterCLS.ARRAY_PART_CD.filter((val) => { return val.ROOTPART_TERM == semester; });
            if (semesterMax == 2) {
                bodyHtml += templateReplace(jQuery("#hidden-bottom-sheet-layer-body-checkbox-semester-title-template").html(), [semester]);
            }
            let contentHtml = "";
            jQuery.each(semesterList, function (i, item) {
                let selectedItem = selectedRootPart.filter((val) => { return val == item.ROOTPART_CODE; });
                checked = selectedItem.length > 0 ? "checked" : "";
                contentHtml += templateReplace(jQuery("#hidden-bottom-sheet-layer-body-checkbox-list-li-template").html(), [item.ROOTPART_CODE, checked, item.ROOTPART_NAME]);
            });
            bodyHtml += templateReplace(jQuery("#hidden-bottom-sheet-layer-body-checkbox-item-main-template").html(), [contentHtml]);
        }
        return templateReplace(jQuery("#hidden-bottom-sheet-layer-body-checkbox-body-template").html(), [checkboxAllHtml, bodyHtml]);;
    },
    getRootPartBottomSheetLayerFooterHtml: function () {
        let selectedRootPartLength = isValueEmpty(commonGLB.getRootPartCD()) ? 0 : commonGLB.getRootPartCD().toString().split(",").length;
        let isDisabled = selectedRootPartLength > 0 ? "" : "disabled";
        return templateReplace(jQuery("#hidden-bottom-sheet-layer-footer-checkbox-submit-button-template").html(), [isDisabled]);
    },
    selectedRootPartAll: function () {
        let ischecked = jQuery("input[name='root_part_cd']").length == $("input[name='root_part_cd']:checked").length ? true : false;
        if (ischecked) {
            jQuery("input[name='root_part_cd']").prop("checked", false);
            jQuery("#checkbox_all").text('전체 선택');
        } else {
            jQuery("input[name='root_part_cd']").prop("checked", true);
            jQuery("#checkbox_all").text('전체 해제');
        }
        filterCLS.selectedRootPart();
    },
    selectedRootPart: function () {
        let checkedCount = $("input[name='root_part_cd']:checked").length;
        if (checkedCount > 0) {
            jQuery("#rootPartSubmit").attr("disabled", false);
        } else {
            jQuery("#rootPartSubmit").attr("disabled", true);
        }
        if (jQuery("input[name='root_part_cd']").length == checkedCount) {
            jQuery("#checkbox_all").text('전체 해제');
        } else {
            jQuery("#checkbox_all").text('전체 선택');
        }
    },
    setRootPartBottomSheetLayerSubmit: function (selectedItem) {
        if (jQuery("input[name='root_part_cd']:checked").length == 0) {
            alert("대단원을 선택해주세요.");
            return false;
        }
        let rootPartList = new Array();
        jQuery("input[name='root_part_cd']:checked").each(function () {
            rootPartList.push(jQuery(this).val());
        });
        commonGLB.setStorage(storage.SEARCH_ROOTPART_CD, rootPartList.join(","));

        bottomSheetClose(selectedItem);
        filterCLS.setFilterByPartCD();
        filterCLS.goSearch();
    },
    getSearchParam: function () {
        let searchParam = "?menu_cd=" + commonGLB.getMenuCD();
        if (isValueEmpty(commonGLB.getSiteID()) == false) searchParam += "&siteid=" + commonGLB.getSiteID();
        if (isValueEmpty(commonGLB.getGrade()) == false) searchParam += "&grade=" + commonGLB.getGrade();
        if (isValueEmpty(commonGLB.getSubjectCD()) == false) searchParam += "&subject_cd=" + commonGLB.getSubjectCD();
        if (isValueEmpty(commonGLB.getSubjectDetailCD()) == false) searchParam += "&subject_detail_cd=" + commonGLB.getSubjectDetailCD();
        if (isValueEmpty(commonGLB.getTxCD()) == false) searchParam += "&tx_cd=" + commonGLB.getTxCD();
        if (isValueEmpty(commonGLB.getRootPartCD()) == false) searchParam += "&root_part_cd=" + commonGLB.getRootPartCD();
        if (isValueEmpty(commonGLB.getSearchExpaprCoreTypeCD()) == false) searchParam += "&expapr_coretype_cd=" + commonGLB.getSearchExpaprCoreTypeCD();
        if (isValueEmpty(commonGLB.getSearchExpaprGroupCD()) == false) searchParam += "&expapr_group_cd=" + commonGLB.getSearchExpaprGroupCD();
        if (isValueEmpty(commonGLB.getKeyword()) == false) searchParam += "&keyword=" + commonGLB.getKeyword();
        if (isValueEmpty(commonGLB.getSearchTextBookCD()) == false) searchParam += "&text_book_cd=" + commonGLB.getSearchTextBookCD();
        if (isValueEmpty(commonGLB.getSearchTextBookNM()) == false) searchParam += "&text_book_nm=" + commonGLB.getSearchTextBookNM();
        if (isValueEmpty(commonGLB.getYearCD()) == false) searchParam += "&year_cd=" + commonGLB.getYearCD();
        if (isValueEmpty(commonGLB.getSearchVodType()) == false) searchParam += "&vod_type=" + commonGLB.getSearchVodType();
        if (isValueEmpty(appCLS.getOS()) == false) searchParam += "&os-type=" + appCLS.getOS();
        if (isValueEmpty(appCLS.getAppVersion()) == false) searchParam += "&app-version=" + appCLS.getAppVersion();
        if (isValueEmpty(appCLS.getDeviceId()) == false) searchParam += "&device_id=" + appCLS.getDeviceId();
        return searchParam;
    },
    goExamSearchTrack: function () {
        let trkParams = {
            "menu_cd": commonGLB.getMenuCD(),
            "site_id": commonGLB.getSiteID(),
            "grade": commonGLB.getGrade(),
            "subject_cd": commonGLB.getSubjectCD(),
            "subject_detail_cd": commonGLB.getSubjectDetailCD(),
            "tx_cd": commonGLB.getTxCD(),
            "root_part_cd": commonGLB.getRootPartCD(),
            "level_cd": commonGLB.getLevelCD(),
            "sub_menu_cd": commonGLB.getSubMenuCD(),
            "text_book_nm": commonGLB.getSearchTextBookNM(),
            "year_cd": commonGLB.getYearCD(),
            "vod_type": commonGLB.getSearchVodType(),
            "work_author": commonGLB.getWorkAuthor(),
            "work_title": commonGLB.getWorkTitle(),
        };
        trkCLS.setExamSearch(trkParams);
    },
    goSearch: function () {
        filterCLS.IS_PART_LOADING = false;
        storage.removeSession(storage.EXPAPR_PART_ID); // 파트 설정 값 초기화
        //filterCLS.getTipBrandInfoMgs();

        const params = new URLSearchParams(window.location.search);
        if (params.get("subject_cd")) {
            params.set("subject_cd", commonGLB.getSubjectCD())
        }

        if (params.get("grade")) {
            params.set("grade", commonGLB.getGrade())
        }
        history.replaceState(null, "", "?" + params.toString());

		if (TRK_GLB_SERVICE_TYPE_CD == 2) {//모바일웹인 경우
			window.showLoading?.();
		}

        if (filterCLS.IS_PART) {
            filterCLS.goPartSearch();
        } else {
            if (isArrayInValue(filterCLS.KOREAN_PART_HANDLING_MENU_LIST, commonGLB.getMenuCD())) {
                filterCLS.IS_SCROLL = true;
                filterCLS.goKoreanLiteratureSearch();
            } else {
                filterCLS.goExamSearch();
            }
        }
        filterCLS.goExamSearchTrack();
    },
    goScrollSearch: function (){
        filterCLS.IS_PART_LOADING = false;
        let childPartClass = "";

        filterCLS.IS_SCROLL_SEARCH_LOADING = true;

        if (filterCLS.PAGE > filterCLS.MAX_PAGE) {
            return false;
        }

		if (TRK_GLB_SERVICE_TYPE_CD == 2) {//모바일웹인 경우
			window.showLoading?.();
		}

		filterCLS.KOREAN_PART_WORK_LIST = [];

        let workTitleArray = new Array();
        let workAuthorArray = new Array();
        let koreanPartArray = new Array();

        if (isValueEmpty(commonGLB.getWorkTitle()) == false || isValueEmpty(commonGLB.getWorkAuthor()) == false) {
            workTitleArray = commonGLB.getWorkTitle().split("|");
            workAuthorArray = commonGLB.getWorkAuthor().split("|");

            filterCLS.ARRAY_MENU_KOREAN_LITERATURE_PART = filterCLS.ARRAY_MENU_KOREAN_LITERATURE_PART.filter((val) => { return workTitleArray.includes(val.TITLE) || workAuthorArray.includes(val.AUTHOR) });
        }

        if ((isArrayInValue(["000020001000001"], commonGLB.getMenuCD()))) {
            koreanPartArray = filterCLS.ARRAY_MENU_KOREAN_LITERATURE_PART.filter((v, i, a) => a.findIndex(t => t.TITLE_AUTHOR === v.TITLE_AUTHOR) === i);
        } else {
            koreanPartArray = filterCLS.ARRAY_MENU_KOREAN_LITERATURE_PART;
        }

        if (isArrayInValue(filterCLS.KOREAN_PART_HANDLING_MENU_LIST, commonGLB.getMenuCD())) {
            filterCLS.IS_SCROLL = true;
            let startPageSize = (filterCLS.PAGE + 3) * filterCLS.PAGESIZE;
            let endPageSize = (filterCLS.PAGE + 4) * filterCLS.PAGESIZE;

            jQuery.each(koreanPartArray, function (seq, part) {
                let html = "";
                let rootPartCD = "";
                let partCD = "";
                let partName = "";

                rootPartCD = part.EKL_CD;
                partCD = part.EKL_CD;
                partName = part.TITLE + " - " + part.AUTHOR;

                partTemplate = jQuery("#hidden-exam-part-scroll-item-template").html();

                if (seq >= startPageSize && seq < endPageSize) {
                    if ((filterCLS.MAX_PAGE - 1) == seq) {
                        pagingStatus = "finish"
                    } else {
                        pagingStatus = "next"
                    }

                    html= templateReplace(partTemplate, [childPartClass, partName, partCD, rootPartCD, "", pagingStatus]);

                    filterCLS.KOREAN_PART_WORK_LIST.push(part.TITLE + "_" + part.AUTHOR);

                    jQuery("#ROOT_PART_CD").append(html);
                }
            });

            filterCLS.PAGE = filterCLS.PAGE + 1;
        }

		let expaprNoList = new Array();
        if (commonGLB.getMenuCD() == "000020001000001")
		{
			expaprNoList = filterCLS.ARRAY_MENU_KOREAN_LITERATURE_PART.map(item => item.EXPAPR_NO).join(",");
		}
        
        jQuery.ajax({
            type: "POST",
            dataType: 'json',
            url: commonCLS.URL.메뉴별시험정보조회,
            data: {
                "menu_cd": commonGLB.getMenuCD(),
                "expapr_coretype_cd": commonGLB.getSearchExpaprCoreTypeCD(),
                "expapr_group_cd": commonGLB.getSearchExpaprGroupCD(),
                "siteid": commonGLB.getSiteID(),
                "grade": commonGLB.getGrade(),
                "subject_cd": commonGLB.getSubjectCD(),
                "subject_detail_cd": commonGLB.getSubjectDetailCD(),
                "tx_cd": commonGLB.getTxCD(),
                "root_part_cd": commonGLB.getRootPartCD(),
                "level_cd": commonGLB.getLevelCD(),
                "work_author": commonGLB.getWorkAuthor(),
                "work_title": commonGLB.getWorkTitle(),
                "text_book_nm": commonGLB.getSearchTextBookNM(),
                "korean_part_work_list": encodeURI(encodeURIComponent(filterCLS.KOREAN_PART_WORK_LIST.join("|"))),
                "year_cd": commonGLB.getYearCD(),
                "is_part": filterCLS.IS_PART ? 1 : 0,
                "vod_type": appCLS.getIsRecoomendedVersion(appCLS.getVodExamRecoomendedVersion()) == true ? commonGLB.getSearchVodType() : "",
				"expapr_no_array" : expaprNoList,
				"expapr_servicetype" : TRK_GLB_SERVICE_TYPE_CD == 2 ? TRK_GLB_TOGGLE_GROUP_CD : "2" ,//모바일웹일 경우에만 토글값 넘김, 앱에서는 학생으로 고정
            }, success: function (responseJson) {
                filterCLS.IS_PART_LOADING = true;
                if (responseJson.RESULT == "false") {
                    alert("필수정보를 조회하는데 실패하였습니다.");
                } else {
                    if (responseJson.EXAM_COUNT == 0) {
                        jQuery("#examMain").html(jQuery("#hidden-exam-item-not-item-template").html());
                        alert("과목별 출제 전문가가 제작 중입니다.");
                    } else {
                        const prevHeight = document.body.scrollHeight;

                        filterCLS.ARRAY_MENU_EXAM = responseJson.MENU_BY_EXAM;
                        filterCLS.ARRAY_MENU_VOD = responseJson.MENU_BY_VOD;
                        filterCLS.PART_USE_CD = Number(responseJson.PART_USE_CD);

                        //영상 매칭 조회
                        if (isValueEmpty(commonGLB.getSearchVodType()) == false) {
                            filterCLS.ARRAY_MENU_EXAM = filterCLS.ARRAY_MENU_EXAM.map(examItem =>{
                                const match = filterCLS.ARRAY_MENU_VOD.find(vodItem => vodItem.EXPAPR_NO === examItem.EXPAPR_NO && vodItem.CURRI_IDX === "1");
                                return match ? {... examItem, VOD_TYPE : match.VOD_TYPE, VOD_NO : match.VOD_NO } : examItem;
                            });
                        }
                        
                        filterCLS.setNotPartExamKoreanLiterature();

                        // Pointer-events Reset
                        let zbAcordionButton = document.querySelectorAll('.zbAccordion__button');
                        zbAcordionButton.forEach(function (item) { item.style.pointerEvents = 'auto'; });
                        VOD_ui_updater.setUI();
                        ui_updater.setUI();
                        // zbAccordion();

                        const newHeight = document.body.scrollHeight;

                        if (window.scrollY + window.innerHeight >= prevHeight - 10) {
                            window.scrollTo(0, newHeight - window.innerHeight - 70);
                        }
                    }
                }

                filterCLS.bindButtonClickEvents();

				if (TRK_GLB_SERVICE_TYPE_CD == 2) {//모바일웹인 경우
					window.hideLoading?.();
				}
            }, error: function (request, exception) {
                filterCLS.IS_PART_LOADING = true;
				if (TRK_GLB_SERVICE_TYPE_CD == 2) {//모바일웹인 경우
					window.hideLoading?.();
				}
                return false;
            }
        });
    },
    goPartSearch: function () {
        jQuery.ajax({
            type: "POST",
            dataType: 'json',
            async: false,
            url: commonCLS.URL.메뉴별파트정보조회,
            data: {
                "menu_cd": commonGLB.getMenuCD(),
                "expapr_coretype_cd": commonGLB.getSearchExpaprCoreTypeCD(),
                "expapr_group_cd": commonGLB.getSearchExpaprGroupCD(),
                "siteid": commonGLB.getSiteID(),
                "grade": commonGLB.getGrade(),
                "subject_cd": commonGLB.getSubjectCD(),
                "subject_detail_cd": commonGLB.getSubjectDetailCD(),
                "tx_cd": commonGLB.getTxCD(),
                "root_part_cd": commonGLB.getRootPartCD(),
                "level_cd": commonGLB.getLevelCD(),
                "work_author": commonGLB.getWorkAuthor(),
                "work_title": commonGLB.getWorkTitle(),
                "text_book_nm": commonGLB.getSearchTextBookNM(),
                "korean_part_work_list": encodeURI(encodeURIComponent(filterCLS.KOREAN_PART_WORK_LIST.join("|"))),
                "year_cd": commonGLB.getYearCD(),
                "vod_type": commonGLB.getSearchVodType(),
                "is_scroll" : filterCLS.IS_SCROLL ? 1 : 0,
            }, success: function (responseJson) {
                if (responseJson.RESULT == "false") {
                    alert("필수정보를 조회하는데 실패하였습니다.");
                } else {
                    filterCLS.ARRAY_MENU_PART = responseJson.MENU_BY_PART;

                    if (!isArrayInValue(["000010000100001", "000020000100001"], commonGLB.getMenuCD())) {
                        filterCLS.ARRAY_MENU_PART = filterCLS.ARRAY_MENU_PART.filter((val) => val.SPECIAL_YN != "Y");
                    }
                    
                    if (isArrayInValue(filterCLS.BEFORE_TX15_MENU_LIST, commonGLB.getMenuCD()) && commonGLB.getSubjectCD() == "KR") {
                        filterCLS.ARRAY_MENU_PART = filterCLS.ARRAY_MENU_PART.filter((val) => val.SUB_PART_NM != "복합" && val.SUB_PART_NM.indexOf("종합") < 0);
                    }             
                    
			        if (isArrayInValue(["000020000100004"], commonGLB.getMenuCD()) && commonGLB.getSubjectCD() == "MT" &&  commonGLB.getSubjectDetailCD() == "2" && commonGLB.getGrade() == "1") {//고1 계산력문제 공통수학2 비활성화 필요 대단원 제외처리
                        filterCLS.ARRAY_MENU_PART = filterCLS.ARRAY_MENU_PART.filter((val) => val.ROOT_PART_CD != "106");
                    }

                    //고2 사회 세계사, 동아시아사 15개정 예외처리 -- 15개정 내릴때 삭제 필요
                    if (isArrayInValue(["000040000100001"], commonGLB.getMenuCD()) && commonGLB.getSubjectCD() == "LS" && isArrayInValue(["H9LSCHA2004", "H9LSCHA2008"], commonGLB.getTxCD())) {
                        let tx_cd = commonGLB.getTxCD()

                        if (tx_cd == "H9LSCHA2004") {
                            filterCLS.ARRAY_MENU_PART.forEach(item => {
                                if (item.ROOT_PART_CD === "101" && item.SUB_PART_CD == "1") {
                                    item.SUB_PART_NM = "세계사 학습의 필요성~1-2. 인류의 출현과 선사 문화";
                                }
                            });
                        } else if (tx_cd == "H9LSCHA2008") {
                            filterCLS.ARRAY_MENU_PART.forEach(item => {
                                if (item.ROOT_PART_CD === "101" && item.SUB_PART_CD == "1") {
                                    item.SUB_PART_NM = "동아시아와 동아시아 사람들~1-2. 동아시아의 자연환경";
                                }
                            });
                        }
                    }

                    filterCLS.PART_USE_CD = Number(responseJson.PART_USE_CD);

                    if (isArrayInValue(["000010000100002", "000020000100002"], commonGLB.getMenuCD())) { // 중/고등 영문법만 사용
                        filterCLS.goAssociateSearch(); // 연계 단원 조회
                    }

                    if (isArrayInValue(["000010000700004"], commonGLB.getMenuCD())) {
                        filterCLS.setPreMidEgExamPart();
                    } else {
                        filterCLS.setExamPart();
                    }

                    if (isValueEmpty(commonGLB.getLevelCD()) == false && isArrayInValue(filterCLS.TOGGLE_HANDLING_MENU_LIST, commonGLB.getMenuCD()) == false && isArrayInValue(filterCLS.BEFORE_TX15_MENU_LIST, commonGLB.getMenuCD()) == false) { // 대단원 평가만 선택시 펼치기로 노출
                        jQuery(".EXAM_PART_ITEM").addClass('is-active');
                        jQuery("#AccordionAllToggle").removeClass('is-unfold', 'is-fold').addClass('is-unfold');
                        jQuery("#AccordionAllToggle").text('전체 접기');
                    } else {
                        jQuery("#AccordionAllToggle").removeClass('is-unfold', 'is-fold').addClass('is-fold');
                        jQuery("#AccordionAllToggle").text('전체 펼침');
                    }

                    filterCLS.goExamSearch();
                }
            }, error: function (request, exception) {
                return false;
            }
        });
    },
    goExamSearch: async function () {
		let expaprNoList = new Array();
		if (commonGLB.getMenuCD() == "000020001000001")
		{
			expaprNoList = filterCLS.ARRAY_MENU_KOREAN_LITERATURE_PART.map(item => item.EXPAPR_NO).join(",");
		}

        jQuery.ajax({
            type: "POST",
            dataType: 'json',
            url: commonCLS.URL.메뉴별시험정보조회,
            data: {
                "menu_cd": commonGLB.getMenuCD(),
                "expapr_coretype_cd": commonGLB.getSearchExpaprCoreTypeCD(),
                "expapr_group_cd": commonGLB.getSearchExpaprGroupCD(),
                "siteid": commonGLB.getSiteID(),
                "grade": commonGLB.getGrade(),
                "subject_cd": commonGLB.getSubjectCD(),
                "subject_detail_cd": commonGLB.getSubjectDetailCD(),
                "tx_cd": commonGLB.getTxCD(),
                "root_part_cd": commonGLB.getRootPartCD(),
                "level_cd": commonGLB.getLevelCD(),
                "work_author": commonGLB.getWorkAuthor(),
                "work_title": commonGLB.getWorkTitle(),
                "text_book_nm": commonGLB.getSearchTextBookNM(),
                "korean_part_work_list": encodeURI(encodeURIComponent(filterCLS.KOREAN_PART_WORK_LIST.join("|"))),
                "year_cd": commonGLB.getYearCD(),
                "is_part": filterCLS.IS_PART ? 1 : 0,
                "vod_type": filterCLS.getVodType(),
				"expapr_no_array" : expaprNoList,
                "step_cd" : commonGLB.getSearchStepCD(),
				"expapr_servicetype" : TRK_GLB_SERVICE_TYPE_CD == 2 ? TRK_GLB_TOGGLE_GROUP_CD : "2" ,//모바일웹일 경우에만 토글값 넘김, 앱에서는 학생으로 고정
            }, success: function (responseJson) {
                filterCLS.IS_PART_LOADING = true;
                if (responseJson.RESULT == "false") {
                    alert("필수정보를 조회하는데 실패하였습니다.");
                } else {
                    filterCLS.ARRAY_MENU_EXAM = responseJson.MENU_BY_EXAM;
                    filterCLS.ARRAY_MENU_VOD = responseJson.MENU_BY_VOD;
                    filterCLS.PART_USE_CD = Number(responseJson.PART_USE_CD);

                    filterCLS.ARRAY_MENU_EXAM = filterCLS.ARRAY_MENU_EXAM.filter((val) => val.EXPAPR_NAME.indexOf("임시파일") < 0);

                    //예비중1 영문법 미리보기 시험지 삭제
                    if (isArrayInValue(["000010000700004"], commonGLB.getMenuCD())) {
                        filterCLS.ARRAY_MENU_EXAM = filterCLS.ARRAY_MENU_EXAM.filter(
                            item => item.EXPAPR_LEVEL_CD != 6
                        );
                    }
                    
                    if (isArrayInValue(filterCLS.BEFORE_TX15_MENU_LIST, commonGLB.getMenuCD()) && filterCLS.ARRAY_MENU_PART.some(item => item.TX_CODE_15)) {
                        filterCLS.goBeforeExamSearchV2(filterCLS.ARRAY_MENU_EXAM);
                    }
                    
                    //영상 매칭 조회
                    if (isValueEmpty(commonGLB.getSearchVodType()) == false) {
                        filterCLS.ARRAY_MENU_EXAM = filterCLS.ARRAY_MENU_EXAM.map(examItem =>{
                            const match = filterCLS.ARRAY_MENU_VOD.find(vodItem => vodItem.EXPAPR_NO === examItem.EXPAPR_NO && vodItem.CURRI_IDX === "1");
                            return match ? {... examItem, VOD_TYPE : match.VOD_TYPE, VOD_NO : match.VOD_NO } : examItem;
                        });
                    }

                    if (responseJson.EXAM_COUNT == 0) {
                        jQuery("#examMain").html(jQuery("#hidden-exam-item-not-item-template").html());
                        alert("과목별 출제 전문가가 제작 중입니다.");

                        let examTransferDataHtml = filterCLS.getExamTransferDataHtml();
                        if (isValueEmpty(examTransferDataHtml) == false) {
                            jQuery("#examMain").append(examTransferDataHtml);
                        }
                    } else {
                        if (filterCLS.IS_PART) {
                            filterCLS.setVodContent();
                            filterCLS.setExamContent();
                            filterCLS.setAssociatePart();
                            filterCLS.setAssociateContent();
                            filterCLS.setPartUi();
                            
                            // 다운로드 바로 실행인 경우인지 체크
                            if (TRK_GLB_SERVICE_TYPE_CD !== 2) {//모바일웹인 경우
                                examCLS.getForceDownloadCheck();
                            }

                            // Pointer-events Reset
                            let zbAcordionButton = document.querySelectorAll('.zbAccordion__button');
                            zbAcordionButton.forEach(function (item) { item.style.pointerEvents = 'auto'; });
                        } else {
                            if (isArrayInValue(filterCLS.KOREAN_PART_HANDLING_MENU_LIST, commonGLB.getMenuCD())) {
                                filterCLS.setNotPartExamKoreanLiterature();
                            } else {
                                filterCLS.setNotPartExamContent();
                            }
                        }

                        if (isValueEmpty(commonGLB.getLevelCD()) == false && isArrayInValue(filterCLS.TOGGLE_HANDLING_MENU_LIST, commonGLB.getMenuCD()) == false && isArrayInValue(filterCLS.BEFORE_TX15_MENU_LIST, commonGLB.getMenuCD()) == false) { // 대단원 평가만 선택시 펼치기로 노출
                            jQuery(".EXAM_PART_ITEM").addClass('is-active');
                            jQuery("#AccordionAllToggle").removeClass('is-unfold', 'is-fold').addClass('is-unfold');
                            jQuery("#AccordionAllToggle").text('전체 접기');
                        } else {
                            jQuery("#AccordionAllToggle").removeClass('is-unfold', 'is-fold').addClass('is-fold');
                            jQuery("#AccordionAllToggle").text('전체 펼침');
                        }

                        // Pointer-events Reset
                        let zbAcordionButton = document.querySelectorAll('.zbAccordion__button');
                        zbAcordionButton.forEach(function (item) { item.style.pointerEvents = 'auto'; });
                        VOD_ui_updater.setUI();
                        ui_updater.setUI();
                        // zbAccordion();
                        filterCLS.bindButtonClickEvents();
                    }
                }

				if (TRK_GLB_SERVICE_TYPE_CD == 2) {//모바일웹인 경우
					window.hideLoading?.();
				}


            }, error: function (request, exception) {
                filterCLS.IS_PART_LOADING = true;
				if (TRK_GLB_SERVICE_TYPE_CD == 2) {//모바일웹인 경우
					window.hideLoading?.();
				}
                return false;
            },
        });
    },
    goAssociateSearch: async function() {
        jQuery.ajax({
            type: "POST",
            dataType: 'json',
            url: commonCLS.URL.연계정보조회,
            data: {
                "subject_cd": commonGLB.getSubjectCD(),
                "tx_cd": commonGLB.getTxCD(),
            }, success: function (responseJson) {
                if (responseJson.RESULT == "true") {
                    filterCLS.ARRAY_MENU_ASSOCIATE_PART = responseJson.MENU_BY_ASSOCIATE_PART;
                    filterCLS.ARRAY_MENU_ASSOCIATE_INFO = responseJson.MENU_BY_ASSOCIATE_INFO;
                }
            }, error: function (request, exception) {
                return false;
            }
        });
    },
    goKoreanLiteratureSearch: async function() {
        let url = "";

        if ((isArrayInValue(["000020001000001"], commonGLB.getMenuCD()))) {
            jQuery.ajax({
                type: "GET",
                dataType: 'json',
                url: commonCLS.URL.에비고1국어작가작품조회,
                data: {
                    "subject_detail_cd": commonGLB.getSubjectDetailCD(),
                }, success: function (responseJson) {
                    if (responseJson.RESULT == "true") {
                        filterCLS.ARRAY_MENU_KOREAN_LITERATURE_PART = responseJson.MENU_BY_PREGO1_KOREAN_LITERATURE_PART;
                        filterCLS.setKoreanLiteraturePart();
                        filterCLS.goExamSearch();
                    }
                }, error: function (request, exception) {
                    return false;
                }
            });
        } else {
            jQuery.ajax({
                type: "GET",
                dataType: 'json',
                url: commonCLS.URL.국어작가작품조회,
                data: {
                    "site_id": commonGLB.getSiteID(),
                    "tx_cd": commonGLB.getTxCD(),
                    "expapr_coretype_cd": commonGLB.getSearchExpaprCoreTypeCD(),
                    "expapr_group_cd": commonGLB.getSearchExpaprGroupCD(),
                }, success: function (responseJson) {
                    if (responseJson.RESULT == "true") {
                        filterCLS.ARRAY_MENU_KOREAN_LITERATURE_PART = responseJson.MENU_BY_KOREAN_LITERATURE_PART.sort((a, b) => a.TITLE.localeCompare(b.TITLE));
                        filterCLS.setKoreanLiteraturePart();
                        filterCLS.goExamSearch();
                    }
                }, error: function (request, exception) {
                    return false;
                }
            });
        }


    },
    setPartUi: function () {
        let termlHtml = jQuery("#hidden-exam-part-term-item-template").html();
        
        for (let partLevelCD = 1; partLevelCD <= filterCLS.PART_USE_CD; partLevelCD++) {
            jQuery.each(filterCLS.getExamPart(partLevelCD), function (seq, part) {
                let partCD = part.PART_CD.replaceAll('|', '');
                let rootPartCD = commonGLB.getSplitValue(part.PART_CD, 0);
                let subPartCD = commonGLB.getSplitValue(part.PART_CD, 1);
                let detailPartCD = commonGLB.getSplitValue(part.PART_CD, 2);
                let termCD = filterCLS.getExamPartTermBySeason(rootPartCD, subPartCD);
                let partTermHTML = "";

                if (menuCLS.getMenuByIsSemesterHiddenCD() != 1) {
                    partTermHTML = filterCLS.getTermHTML(termCD);
                }

                if (jQuery("#PART_CD_" + rootPartCD).find('.download__button').length == 0 && partLevelCD == commonCLS.PART_USE_CD.루트파트까지사용.CD) {
                    if (!isArrayInValue(filterCLS.BEFORE_TX15_MENU_LIST, commonGLB.getMenuCD())) {
                        jQuery("#PART_CD_" + rootPartCD).addClass('is-noData').parents('.zbAccordion__item').addClass('has-noData');
                    }
                }

                if (jQuery("#PART_LABEL_" + partCD).length > 0) {
                    if (isValueEmpty(termCD)) {
                        jQuery("#PART_LABEL_" + partCD).hide();
                    } else {
                        jQuery("#PART_LABEL_" + partCD).html(partTermHTML);
                    }

                    //학평변형문제 영어 워크북 할인 처리 
                    if (commonGLB.getMenuCD() == "000020000700001" && commonGLB.getSubjectCD() == "EG" && commonGLB.getYearCD() == "2026" && (rootPartCD == "102" || rootPartCD == "103" || rootPartCD == "104")) {
                        partTermHTML =  templateReplace(termlHtml, ["런칭 50% 할인"]);
                        jQuery("#PART_LABEL_" + partCD).removeAttr('style');
                        jQuery("#PART_LABEL_" + partCD).html(partTermHTML);
                    }
                }
            });
        }
        setTimeout(function(){
            if (filterCLS.IS_PART_LOADING) {
                jQuery(".EXAM_SUB_PART_ITEM").not('.is-noData').each(function (i, item) {
                    if (isArrayInValue(filterCLS.BEFORE_TX15_MENU_LIST, commonGLB.getMenuCD())) {
                        if (filterCLS.PART_USE_CD == 1) {
                           if (jQuery(item).find('.download').length == 0) {
                                jQuery(item).closest('[id^="SUB_PART_CD_"]').remove();
                            }
                        }
                    } else {
                        if (jQuery(item).find('.download').length == 0)
                        {
                            jQuery(item).closest('.EXAM_PART_ITEM').remove();
                        }
                    }
                });
            }
        }, 500);

        let examTransferDataHtml = filterCLS.getExamTransferDataHtml();
        if (isValueEmpty(examTransferDataHtml) == false) {
            jQuery("#examMain").append(examTransferDataHtml);
        }
    },
    getBeforePartData: function (partLevelCD, rootCd, subCd = "", detailCd = "") {
        if (partLevelCD == 1) {
            return filterCLS.ARRAY_MENU_PART.find(x => x.ROOT_PART_CD === rootCd) || null;
        } else if (partLevelCD == 2) {
            return filterCLS.ARRAY_MENU_PART.find(x => x.ROOT_PART_CD === rootCd && x.SUB_PART_CD === subCd) || null;
         } else {
            return filterCLS.ARRAY_MENU_PART.find(x => x.ROOT_PART_CD === rootCd && x.SUB_PART_CD === subCd && x.DETAIL_PART_CD == detailCd) || null;
        }
    },
    goBeforeExamSearch: function (partItemID, selectedRootPartCD, beforePartData, val) {
        let blnChk = true;
        if (filterCLS.PART_USE_CD == 1 && isValueEmpty(beforePartData.BEFORE_ROOTPART_ID)) {
            blnChk = false;
        } else if (filterCLS.PART_USE_CD == 2 && isValueEmpty(beforePartData.BEFORE_SUBPART_ID)) {
            blnChk = false;
        } else if (filterCLS.PART_USE_CD == 3 && isValueEmpty(beforePartData.BEFORE_DETAILPART_ID)) {
            blnChk = false;
        }        
        
        if (blnChk) {
            let lastPartCd = filterCLS.PART_USE_CD;
            let expaprGroupCd = commonGLB.getSearchExpaprGroupCD()
            
            if (isArrayInValue(["000010000200003", "000020000200003"], commonGLB.getMenuCD())) {
                expaprGroupCd = "C|E";
            }

            jQuery.ajax({
                type: "POST",
                dataType: 'json',
                url: commonCLS.URL.메뉴별시험정보조회,
                async: false,
                data: {
                    "menu_cd": commonGLB.getMenuCD(),
                    "expapr_coretype_cd": commonGLB.getSearchExpaprCoreTypeCD(),
                    "expapr_group_cd": expaprGroupCd,
                    "siteid": commonGLB.getSiteID(),
                    "grade": 0,
                    "subject_cd": commonGLB.getSubjectCD(),
                    "tx_cd": beforePartData.TX_CODE_15,
                    "level_cd": commonGLB.getLevelCD(),
                    "is_part": filterCLS.IS_PART ? 1 : 0,
                    "step_cd" : commonGLB.getSearchStepCD(),
                    "vod_type": commonGLB.getSearchVodType(),
                    "before_root_part_id" : beforePartData.BEFORE_ROOTPART_ID,
                    "before_sub_part_id" : beforePartData.BEFORE_SUBPART_ID,
                    "before_detail_part_id" : beforePartData.BEFORE_DETAILPART_ID,
                    "last_part_cd" : lastPartCd,
                    "expapr_servicetype" : TRK_GLB_SERVICE_TYPE_CD == 2 ? TRK_GLB_TOGGLE_GROUP_CD : "2" ,//모바일웹일 경우에만 토글값 넘김, 앱에서는 학생으로 고정
                }, success: function (responseJson) {
                    if (responseJson.RESULT == "true") {
                        if (Number(responseJson.EXAM_COUNT) == 0) {
                            filterCLS.setOpenMonthPart(partItemID, selectedRootPartCD)
                        } else {
                            filterCLS.ARRAY_MENU_EXAM   = responseJson.MENU_BY_EXAM;
                            filterCLS.ARRAY_MENU_VOD    = responseJson.MENU_BY_VOD;

                            //영상 매칭 조회
                            if (isValueEmpty(commonGLB.getSearchVodType()) == false) {
                                filterCLS.ARRAY_MENU_EXAM = filterCLS.ARRAY_MENU_EXAM.map(examItem =>{
                                    const match = filterCLS.ARRAY_MENU_VOD.find(vodItem => vodItem.EXPAPR_NO === examItem.EXPAPR_NO && vodItem.CURRI_IDX === "1");
                                    return match ? {... examItem, VOD_TYPE : match.VOD_TYPE, VOD_NO : match.VOD_NO } : examItem;
                                });
                            }
                            
                            filterCLS.setOpenMonthPart(partItemID, selectedRootPartCD, "MATH");
                            filterCLS.setBeforeExamLearningLevelList(partItemID, selectedRootPartCD, responseJson.MENU_BY_EXAM, beforePartData, val);

                            let zbAcordionButton = document.querySelectorAll('.zbAccordion__button');
                            zbAcordionButton.forEach(function (item) { item.style.pointerEvents = 'auto'; });
                            VOD_ui_updater.setUI();
                            ui_updater.setUI();
                        }
                    }
                }
            });
        } else {
            filterCLS.setOpenMonthPart(partItemID, selectedRootPartCD)
        }
    },
    goBeforeExamSearchV2: function () {
        filterCLS.ARRAY_MENU_BEFORE_INFO_LIST = Array();
        filterCLS.ARRAY_PART_COUNT_LIST = Array();

        filterCLS.ARRAY_PART_COUNT_LIST = filterCLS.groupByPart(filterCLS.ARRAY_MENU_EXAM);

        let expaprGroupCd = commonGLB.getSearchExpaprGroupCD()
        if (isArrayInValue(["000010000200003", "000020000200003"], commonGLB.getMenuCD())) {
            expaprGroupCd = "C|E";
        }
        
        let lastPartCd = filterCLS.PART_USE_CD;

        filterCLS.ARRAY_MENU_PART.forEach(function(item) {
            let currentPartCd = "";
            let cureentCount = 0;
            if (isValueEmpty(item.TX_CODE_15)) {
                return;
            }

            if (Number(lastPartCd) == 1) {
                currentPartCd = item.ROOT_PART_CD + "99" + "99";
            } else if (Number(lastPartCd) == 2) {
                currentPartCd = item.ROOT_PART_CD + item.SUB_PART_CD + "99";
            } else {
                currentPartCd = item.ROOT_PART_CD + item.SUB_PART_CD + item.DETAIL_PART_CD;
            }

            if (!isValueEmpty(filterCLS.ARRAY_PART_COUNT_LIST.get(currentPartCd))) {
                cureentCount = filterCLS.ARRAY_PART_COUNT_LIST.get(currentPartCd);
            }

            if (cureentCount > filterCLS.BEFORE_15_MAX_COUNT) {
                return;
            }

            switch (Number(lastPartCd)) {
                case 1:
                    if (isValueEmpty(item.BEFORE_ROOTPART_ID)) {
                        return;
                    }

                    filterCLS.ARRAY_MENU_BEFORE_INFO_LIST.push(
                        item.TX_CODE_15 + "|" + item.BEFORE_ROOTPART_ID + "|" + item.ROOT_PART_CD + "|" + item.ROOT_PART_CD + "|" + lastPartCd
                    );
                    break;
                case 2:
                    if (isValueEmpty(item.BEFORE_SUBPART_ID)) {
                        return;
                    }

                    filterCLS.ARRAY_MENU_BEFORE_INFO_LIST.push(
                        item.TX_CODE_15 + "|" + item.BEFORE_SUBPART_ID + "|" + item.ROOT_PART_CD + item.SUB_PART_CD + "|" + item.ROOT_PART_CD + item.SUB_PART_CD + "|" + lastPartCd
                    );
                    break;
                case 3:
                    if (isValueEmpty(item.BEFORE_DETAILPART_ID)) {
                        return;
                    }

                    filterCLS.ARRAY_MENU_BEFORE_INFO_LIST.push(
                        item.TX_CODE_15 + "|" + item.BEFORE_DETAILPART_ID + "|" + item.ROOT_PART_CD + item.SUB_PART_CD + "|" + item.ROOT_PART_CD + item.SUB_PART_CD + item.DETAIL_PART_CD + "|" + lastPartCd
                    );
                    break;
            }
            });
        

        if (filterCLS.ARRAY_MENU_BEFORE_INFO_LIST.length == 0)
        {
            return false;
        }
                        
        jQuery.ajax({
            type: "POST",
            dataType: 'json',
            url: commonCLS.URL.메뉴별시험정보조회,
            async: false,
            data: {
                "menu_cd": commonGLB.getMenuCD(),
                "expapr_coretype_cd": commonGLB.getSearchExpaprCoreTypeCD(),
                "expapr_group_cd": expaprGroupCd,
                "siteid": commonGLB.getSiteID(),
                "grade": 0,
                "subject_cd": commonGLB.getSubjectCD(),
                "level_cd": commonGLB.getLevelCD(),
                "is_part": filterCLS.IS_PART ? 1 : 0,
                "step_cd" : commonGLB.getSearchStepCD(),
                "vod_type": commonGLB.getSearchVodType(),
                "last_part_cd" : lastPartCd,
                "expapr_servicetype" : TRK_GLB_SERVICE_TYPE_CD == 2 ? TRK_GLB_TOGGLE_GROUP_CD : "2" ,//모바일웹일 경우에만 토글값 넘김, 앱에서는 학생으로 고정
                "before_info_list" : filterCLS.ARRAY_MENU_BEFORE_INFO_LIST.join(",")
            }, success: function (responseJson) {
                if (responseJson.RESULT == "true") {
                    filterCLS.ARRAY_MENU_BEFORE_EXAM   = responseJson.MENU_BY_EXAM;
                    filterCLS.ARRAY_MENU_BEFORE_VOD    = responseJson.MENU_BY_VOD;

                    //영상 매칭 조회
                    if (isValueEmpty(commonGLB.getSearchVodType()) == false) {
                        filterCLS.ARRAY_MENU_BEFORE_EXAM = filterCLS.ARRAY_MENU_BEFORE_EXAM.map(examItem =>{
                            const match = filterCLS.ARRAY_MENU_BEFORE_VOD.find(vodItem => vodItem.EXPAPR_NO === examItem.EXPAPR_NO && vodItem.CURRI_IDX === "1");
                            return match ? {... examItem, VOD_TYPE : match.VOD_TYPE, VOD_NO : match.VOD_NO } : examItem;
                        });
                    }
                }
            }
        });
                 
    },
    makeKeyByFields : function (obj, fields, ignoreFields = [], separator = "|") {
        return fields
            .filter(f => !ignoreFields.includes(f))
            .map(f => obj[f] ?? "")
            .join(separator);
    },
    setOpenMonthException: function(partItemID) {
        let monthException = oepnMonth.ARROPENMONTHEXCEPTION.find((v) => {
            return v.menuCd == commonGLB.getMenuCD() && v.grade == commonGLB.getGrade() && v.subjectCd == commonGLB.getSubjectCD() && v.txCd == commonGLB.getTxCD() && v.partContent == partItemID
        });
        
        if (monthException) {
            let buttonActionHtml = "";
            let arrButton = monthException.buttonAction.split("||");
            if (arrButton.length > 0) {
                arrButton.forEach(items => {
                    let item = items.split(">>");
                    if (item.length == 2) {
                        buttonActionHtml += templateReplace(jQuery("#hidden-OpenMonth-Exception-button-template").html(), [item[0], commonCLS.URL.문제리스트 + item[1]])
                    }
                })
            }
            
            if (!isValueEmpty(buttonActionHtml)) {
                let setOpenMonthExceptionHtml = templateReplace(jQuery("#hidden-OpenMonth-Exception-template").html(), [monthException.msgLabel, monthException.msgTitle, buttonActionHtml])
                jQuery("#"+ partItemID).append(setOpenMonthExceptionHtml);
            }
        }
    },     
    setOpenMonthPart: function(partItemID, selectedRootPartCD, type="") {
        const partTemplate = type == "MATH" ? jQuery("#hidden-exam-part-item-before-math-template").html() : jQuery("#hidden-exam-part-item-before-template").html();
        const openMonthMap = new Map();
        oepnMonth.ARROPENMONTH.forEach(item => {
            const ignore = isValueEmpty(item.TxCd) ? ["TxCd"] : [];
            openMonthMap.set(
                filterCLS.makeKeyByFields(item, oepnMonth.ARROPENMONTHFIELDS, ignore),
                item.openMonth
            );
        });

        let getSubjectDetailCD = commonGLB.getSubjectDetailCD()
        if (!isArrayInValue(["000010000200003", "000020000200003"], commonGLB.getMenuCD())) {
            getSubjectDetailCD = "";
        }

        let openMonthQuery = {
            "menuCd": commonGLB.getMenuCD(),
            "subjectCd": commonGLB.getSubjectCD(),
            "DetailSubjectCd": getSubjectDetailCD,
            "TxCd": commonGLB.getTxCD(),
            "RootPart": selectedRootPartCD
        };

        let openMonth = openMonthMap.get(filterCLS.makeKeyByFields(openMonthQuery, oepnMonth.ARROPENMONTHFIELDS))
        if (openMonth === undefined) {
            openMonth = openMonthMap.get(filterCLS.makeKeyByFields(openMonthQuery, oepnMonth.ARROPENMONTHFIELDS, ["TxCd"])) ?? "";
        }

        let html = templateReplace(partTemplate, [openMonth]);
        
        filterCLS.setOpenMonthException(partItemID);
        
        if (isArrayInValue(["000010000200002", "000020000200002"], commonGLB.getMenuCD())) {
            jQuery("#"+ partItemID).append(html);
        } else {
            if (jQuery("#" + partItemID).find('.is-infomationMesage').length == 0) {
                jQuery("#"+ partItemID).append(html);
            }                    
        }
    },
    setBeforeExamLearningLevelList : function (partItemID, selectedRootPartCD, exams, beforePartData, val) {
        //filterCLS.setOpenMonthPart(partItemID, selectedRootPartCD, "MATH");
        filterCLS.setExamContent(partItemID);
    },
    getExamTransferDataHtml: function () { //이전 개정자료 보기 (대상 메뉴 (수준별AI학습 / 실전대비 하위 메뉴) , 중1, 고1 수학/과학)
        let html = "";
        let isTaget = false;
        let menuCD = commonGLB.getMenuCD();

        if ((isArrayInValue(["000010000200001", "000020000200001"], menuCD) || (menuCD.startsWith("0000100003")) && commonGLB.getGrade() == 1)) {
            if (commonGLB.getSiteID() == commonGLB.SITE_ID.중학생 && isArrayInValue(["SC"], commonGLB.getSubjectCD())) {
                isTaget = true;
            }

            if (commonGLB.getSiteID() == commonGLB.SITE_ID.고등학생 && isArrayInValue(["SC", "TH"], commonGLB.getSubjectCD())) {
                isTaget = true;
            }

			// 교과서 변형은 이전 개정자료 보기 예외 처리
            if (isArrayInValue(["000010000300008"], menuCD)) {
                isTaget = false;
            }

            if (isTaget) {
                html = $("#hidden-exam-item-transfer-data-template").html();
            }
        }

        if (isArrayInValue(["000010000200003", "000010000200002"], menuCD) && commonGLB.getGrade() == 2) {
            if (isArrayInValue(["MT", "SC"], commonGLB.getSubjectCD())) {
                html = $("#hidden-exam-item-transfer-chapter-data-template").html();
            }
        }

        if (isArrayInValue(["000020000100001"], menuCD) && commonGLB.getGrade() == 2) {
            if (isArrayInValue(["EG"], commonGLB.getSubjectCD()) || (isArrayInValue(["KR"], commonGLB.getSubjectCD()) && commonGLB.getSubjectDetailCD() == 1)) {
            } else {
                html = $("#hidden-exam-item-transfer-data-etc-template").html();
            }
        }

        if (isArrayInValue(["000020000200003"], menuCD) && !(isArrayInValue(["KR"], commonGLB.getSubjectCD()) && commonGLB.getSubjectDetailCD() == 1)) {
            if (commonGLB.getGrade() == 1) {
                if (isArrayInValue(["TH"], commonGLB.getSubjectCD())) {
                    isTaget = true;
                    html = $("#hidden-exam-item-transfer-data-template").html();
                }
            } else if (commonGLB.getGrade() == 2) {
                if (isArrayInValue(["EG"], commonGLB.getSubjectCD()) == false) {
                    isTaget = true;
                    html = $("#hidden-exam-item-transfer-data-etc-template").html();
                }
            }
        }

        if (isArrayInValue(["000020000100004", "000020000200002"], menuCD) && commonGLB.getGrade() == 2) {
            html = $("#hidden-exam-item-transfer-data-etc-template").html();
        }

        if (isArrayInValue(["000010000300001", "000010000300002", "000010000300003", "000010000300004", "000010000300008"], menuCD) && commonGLB.getGrade() == 2) {
            if (isArrayInValue(["MT", "SC"], commonGLB.getSubjectCD())) {
                isTaget = true;
                html = $("#hidden-exam-item-transfer-chapter-data-template").html();
            }
        }

        if (isArrayInValue(["000020000300001", "000020000300002", "000020000300003", "000020000300004", "000020000300008"], menuCD) && !(isArrayInValue(["KR"], commonGLB.getSubjectCD()) && commonGLB.getSubjectDetailCD() == 1)) {
            if (commonGLB.getGrade() == 1) {
                if (isArrayInValue(["SC", "TH"], commonGLB.getSubjectCD())) {
                    isTaget = true;
                    html = $("#hidden-exam-item-transfer-chapter-data-template").html();
                }
            } else if (commonGLB.getGrade() == 2) {
                if (isArrayInValue(["KR", "MT", "SC", "LS", "HI"], commonGLB.getSubjectCD())) {
                    html = $("#hidden-exam-item-transfer-data-etc-template").html();
                }
            }
        }

        if (isArrayInValue(["000040000100001", "000040000100004", "000030000200003", "000040000200003", "000030000300001", "000030000300002", "000030000300003", "000030000300004", "000030000300008", "000040000300001", "000040000300002", "000040000300003", "000040000300004", "000040000300008", "000030000200002", "000040000200002"], menuCD)) {
            html = $("#hidden-exam-item-transfer-data-etc-old-template").html();
        }

        return html;
    },
    getExamPart: function (partLevelCD) {
        let arrayPart = new Array();
        switch (partLevelCD) {
            case commonCLS.PART_USE_CD.루트파트까지사용.CD:
				if (commonGLB.getMenuCD() == "000010000700004") {
					arrayPart = [...new Map(filterCLS.ARRAY_MENU_PART.map((item) => {
						return [item.ROOT_PART_CD + "|" + item.CHAPTER_EG_PART_CD, item.ROOT_PART_NM + "|" + item.ROOT_PART_SVC_YN + "|" + item.SUB_PART_SVC_YN + "|" + item.SPECIAL_YN];
					}
					)).entries()].map(([PART_CD, PART_NM]) => ({ PART_CD, PART_NM }));
				} else {
					arrayPart = [...new Map(filterCLS.ARRAY_MENU_PART.map((item) => {
						return [item.ROOT_PART_CD, item.ROOT_PART_NM + "|" + item.ROOT_PART_SVC_YN + "|" + item.SUB_PART_SVC_YN + "|" + item.SPECIAL_YN];
					}
					)).entries()].map(([PART_CD, PART_NM]) => ({ PART_CD, PART_NM }));
				}
                break;
            case commonCLS.PART_USE_CD.서브파트까지사용.CD:
                arrayPart = [...new Map(filterCLS.ARRAY_MENU_PART.map((item) => {
                    return [item.ROOT_PART_CD + "|" + item.SUB_PART_CD, item.SUB_PART_NM + "|" + item.ROOT_PART_SVC_YN + "|" + item.SUB_PART_SVC_YN + "|" + item.BEFORE_ROOTPART_ID];
                }
                )).entries()].map(([PART_CD, PART_NM]) => ({ PART_CD, PART_NM }));
                break;
            case commonCLS.PART_USE_CD.디테일파트까지사용.CD:
                arrayPart = [...new Map(filterCLS.ARRAY_MENU_PART.map((item) => {
                    return [item.ROOT_PART_CD + "|" + item.SUB_PART_CD + "|" + item.DETAIL_PART_CD, item.DETAIL_PART_NM + "|" + item.ROOT_PART_SVC_YN + "|" + item.SUB_PART_SVC_YN + "|" + item.DETAIL_PART_SVC_YN];
                }
                )).entries()].map(([PART_CD, PART_NM]) => ({ PART_CD, PART_NM }));
                break;
        }

        return arrayPart;
    },
    setExamPart: function () {
        const toggleClass = "has-toggle";
        const isChildPartClass = "has-nextUnit";
        const partMainTemplate = jQuery("#hidden-exam-part-template").html();
        filterCLS.ARRAY_MENU_EXAM_PART_END = [];
        let partTemplate = "";
        for (let partLevelCD = 1; partLevelCD <= filterCLS.PART_USE_CD; partLevelCD++) {
            let partItemID = "";
            let parentPartID = "";
            let childPartClass = "";

            if (commonCLS.PART_USE_CD.루트파트까지사용.CD == partLevelCD) {
                jQuery("#examMain").html(templateReplace(partMainTemplate, [toggleClass, commonCLS.PART_USE_CD.루트파트까지사용.ID]));
                childPartClass = filterCLS.PART_USE_CD > commonCLS.PART_USE_CD.루트파트까지사용.CD ? isChildPartClass : "";
            }

            jQuery.each(filterCLS.getExamPart(partLevelCD), function (seq, part) {
                let isInsert = true;
                let partCD = part.PART_CD.replaceAll('|', '');

                let rootPartCD = commonGLB.getSplitValue(part.PART_CD, 0);
                let subPartCD = commonGLB.getSplitValue(part.PART_CD, 1);
                let detailPartCD = commonGLB.getSplitValue(part.PART_CD, 2);

                let partName = commonGLB.getSplitValue(part.PART_NM, 0);
                let partNameOrg = partName;
                let rootPartSVCYN = commonGLB.getSplitValue(part.PART_NM, 1);
                let subPartSVCYN = commonGLB.getSplitValue(part.PART_NM, 2);
                let detailPartSVCYN = commonGLB.getSplitValue(part.PART_NM, 3);

                let specialYN = commonGLB.getSplitValue(part.PART_NM, 3);
                let termCD = "";
                let partTermHTML = ""; //filterCLS.getTermHTML(termCD, partLevelCD);

                switch (partLevelCD) {
                    case commonCLS.PART_USE_CD.루트파트까지사용.CD:
                        partItemID = commonCLS.PART_USE_CD.루트파트까지사용.ID;
                        if (specialYN == "Y" && isArrayInValue(["000010000100001", "000020000100001"], commonGLB.getMenuCD()))
						{
							partName = partName;
						} else {
							partName = filterCLS.getPartRootPartPeplace(rootPartCD, partName);
						}
                        if (filterCLS.PART_USE_CD == commonCLS.PART_USE_CD.루트파트까지사용.CD) filterCLS.addMenuExamPartEnd(rootPartCD, subPartCD, detailPartCD, rootPartCD + subPartCD + detailPartCD, rootPartCD, "99", partNameOrg)
                        break;
                    case commonCLS.PART_USE_CD.서브파트까지사용.CD:
                        isInsert = subPartCD == "99" ? false : isInsert;

                        if (commonGLB.getSubjectCD() == "KR" && commonGLB.getSearchStepCD() == 2) {
                            isInsert = false;
                        }

                        if (isInsert && parentPartID != rootPartCD) {
                            parentPartID = rootPartCD;
                            partItemID = commonCLS.PART_USE_CD.서브파트까지사용.ID + "_" + parentPartID;
                            jQuery("#PART_CD_" + parentPartID).html(templateReplace(partMainTemplate, ["", commonCLS.PART_USE_CD.서브파트까지사용.ID + "_" + parentPartID]));
                        }
                        if (filterCLS.PART_USE_CD >= commonCLS.PART_USE_CD.루트파트까지사용.CD) filterCLS.addMenuExamPartEnd(rootPartCD, subPartCD, detailPartCD, rootPartCD + subPartCD + detailPartCD, rootPartCD, rootPartCD + subPartCD, partNameOrg)
                        partName = filterCLS.getPartSubPartPeplace(rootPartCD, subPartCD, partName);
                        break;
                    case commonCLS.PART_USE_CD.디테일파트까지사용.CD:
                        if (filterCLS.PART_USE_CD >= commonCLS.PART_USE_CD.루트파트까지사용.CD) filterCLS.addMenuExamPartEnd(rootPartCD, subPartCD, detailPartCD, rootPartCD + subPartCD + detailPartCD, rootPartCD, rootPartCD + subPartCD + detailPartCD, partNameOrg)
                }

                if (commonCLS.PART_USE_CD.서브파트까지사용.CD == partLevelCD && subPartSVCYN == "N") {
                } else {
                    let html = "";
                    let is15Before = "";
                    partTermHTML = filterCLS.getTermSpanHTML(partCD, partLevelCD);

                    partTemplate = jQuery("#hidden-exam-part-item-v2-template").html();

                    if (isArrayInValue(filterCLS.BEFORE_TX15_MENU_LIST, commonGLB.getMenuCD()) && filterCLS.ARRAY_MENU_PART.some(item => item.TX_CODE_15) && commonCLS.PART_USE_CD.서브파트까지사용.CD == partLevelCD) {
                        is15Before = "is-15-before"
                    }

                    html= templateReplace(partTemplate, [childPartClass, partName, partCD, rootPartCD, partTermHTML, is15Before]);

                    if (isInsert && isValueEmpty(partTermHTML) == false && partLevelCD != 3) {
                        jQuery("#" + partItemID).append(html);
                    }
                }
            });
        }
    },
    addMenuExamPartEnd : function(rootCd, subCd, detailCd, contentCd, advanceCd, advanceCdFilter, partNameOrg) {
        const item = filterCLS.ARRAY_MENU_EXAM_PART_END.find(x => x.contentCd === contentCd);
        if (!item) {
            filterCLS.ARRAY_MENU_EXAM_PART_END.push({
                rootCd: rootCd
                , subCd: subCd
                , detailCd: detailCd
                , contentCd: contentCd
                , advanceCd: advanceCd
                , advanceCdFilter : advanceCdFilter
                , partNameOrg : partNameOrg
            })
        }
    },
    setPreMidEgExamPart: function () {
        const toggleClass = "has-toggle";
        const isChildPartClass = "has-nextUnit";
		const partMainTemplate = jQuery("#hidden-exam-part-template").html();
		let partTemplate = "";
        let childPartClass = "";

        let partList = new Array();
        let rootPartTopFilter = [];

        if (commonGLB.getMenuCD() == "000010000700004") {
            partList.push({
                "SEQ": "PART_0",
                "ROOT_PART_CD": "101",
                "ROOT_PART_NM": "동사(1)",
                "ROOT_PART_SVC_YN": "Y",
            });
            partList.push({
                "SEQ": "PART_1",
                "ROOT_PART_CD": "102",
                "ROOT_PART_NM": "동사(2)",
                "ROOT_PART_SVC_YN": "Y",
            });
            partList.push({
                "SEQ": "PART_2",
                "ROOT_PART_CD": "103",
                "ROOT_PART_NM": "시제",
                "ROOT_PART_SVC_YN": "Y",
            });
            partList.push({
                "SEQ": "PART_3",
                "ROOT_PART_CD": "104",
                "ROOT_PART_NM": "접속사(1)",
                "ROOT_PART_SVC_YN": "Y",
            });
            partList.push({
                "SEQ": "PART_4",
                "ROOT_PART_CD": "105",
                "ROOT_PART_NM": "접속사(2)",
                "ROOT_PART_SVC_YN": "Y",
            });
            partList.push({
                "SEQ": "PART_5",
                "ROOT_PART_CD": "106",
                "ROOT_PART_NM": "준동사",
                "ROOT_PART_SVC_YN": "Y",
            });
            partList.push({
                "SEQ": "PART_6",
                "ROOT_PART_CD": "107",
                "ROOT_PART_NM": "수식어",
                "ROOT_PART_SVC_YN": "Y",
            });
            partList.push({
                "SEQ": "PART_7",
                "ROOT_PART_CD": "108",
                "ROOT_PART_NM": "문장",
                "ROOT_PART_SVC_YN": "Y",
            });

            rootPartTopFilter = [
                {
                    "SEQ": "1",
                    "EXPAPR_NO": "15682115",
                    "ROOT_PART_CD": "101",
                    "APP_GROUP_TEXT": "핵심 개념 미리 알기 be동사",
                },
                {
                    "SEQ": "2",
                    "EXPAPR_NO": "15682113",
                    "ROOT_PART_CD": "102",
                    "APP_GROUP_TEXT": "핵심 개념 미리 알기 조동사",
                },
                {
                    "SEQ": "3",
                    "EXPAPR_NO": "15682112",
                    "ROOT_PART_CD": "103",
                    "APP_GROUP_TEXT": "핵심 개념 미리 알기 시제",
                },
                {
                    "SEQ": "4",
                    "EXPAPR_NO": "15682108",
                    "ROOT_PART_CD": "104",
                    "APP_GROUP_TEXT": "핵심 개념 미리 알기 명사절 접속사",
                },
                {
                    "SEQ": "5",
                    "EXPAPR_NO": "15682110",
                    "ROOT_PART_CD": "105",
                    "APP_GROUP_TEXT": "	핵심 개념 미리 알기 부사절 접속사",
                },
                {
                    "SEQ": "6",
                    "EXPAPR_NO": "15682114",
                    "ROOT_PART_CD": "106",
                    "APP_GROUP_TEXT": "핵심 개념 미리 알기 준동사",
                },
                {
                    "SEQ": "7",
                    "EXPAPR_NO": "15682111",
                    "ROOT_PART_CD": "107",
                    "APP_GROUP_TEXT": "핵심 개념 미리 알기 비교급과 최상급",
                },
                {
                    "SEQ": "8",
                    "EXPAPR_NO": "15682109",
                    "ROOT_PART_CD": "108",
                    "APP_GROUP_TEXT": "핵심 개념 미리 알기 문장 형식",
                }
            ];
    }

		jQuery("#examMain").html(templateReplace(partMainTemplate, [toggleClass, commonCLS.PART_USE_CD.루트파트까지사용.ID]));
		childPartClass = filterCLS.PART_USE_CD > commonCLS.PART_USE_CD.루트파트까지사용.CD ? isChildPartClass : "";

        jQuery.each(partList, function (seq, part) {
            let html = "";
            partTemplate = jQuery("#hidden-exam-part-item-template").html();
			html= templateReplace(partTemplate, ["", part.ROOT_PART_NM, part.ROOT_PART_CD, part.ROOT_PART_CD, "", ""]);

            jQuery("#ROOT_PART_CD").append(html);
        });

		for (let partLevelCD = 1; partLevelCD <= filterCLS.PART_USE_CD; partLevelCD++) {
            let partItemID = "";
            let parentPartID = "";
            let childPartClass = "";

            jQuery.each(filterCLS.getExamPart(partLevelCD), function (seq, part) {
                let rootPartCD = commonGLB.getSplitValue(part.PART_CD, 0);
                let chapterPartCD = commonGLB.getSplitValue(part.PART_CD, 1);
                let partName = commonGLB.getSplitValue(part.PART_NM, 0);

				if (parentPartID != chapterPartCD) {
					parentPartID = chapterPartCD;
					partItemID = commonCLS.PART_USE_CD.서브파트까지사용.ID + "_" + parentPartID;
					jQuery("#PART_CD_" + parentPartID).html(templateReplace(partMainTemplate, ["", commonCLS.PART_USE_CD.서브파트까지사용.ID + "_" + parentPartID]));

					let chapterExam = [];
					chapterExam = rootPartTopFilter.filter((val) => { return val.ROOT_PART_CD == parentPartID});
					examHtml = filterCLS.getNotPreMidPartExamContentSingle(chapterExam, "");

					jQuery("#SUB_PART_CD_" + parentPartID).append(examHtml);
				}

				partName = filterCLS.getPartRootPartPeplace(rootPartCD, partName);

				let html = "";
				partTemplate = jQuery("#hidden-exam-part-item-template").html();
				html= templateReplace(partTemplate, [childPartClass, partName, chapterPartCD + rootPartCD, chapterPartCD, "", ""]);

				jQuery("#" + partItemID).append(html);
            });
        }
    },
    setNotPartExamContent : function () {
        let html = "";
        let itemCD = "";
        switch (menuCLS.getMenuContentTemplateCD()) {
            case menuCLS.TEMPLATE_CD.파트_X_파이널모의고사형:
                html = filterCLS.getNotPartExamContentFinal(filterCLS.ARRAY_MENU_EXAM);
                break;
            case menuCLS.TEMPLATE_CD.파트_X_그룹형:
                jQuery.each(filterCLS.ARRAY_MENU_EXAM, function (i, item) {
                    if (itemCD != item.EXPAPR_LEVEL_CD) {
                        itemCD = item.EXPAPR_LEVEL_CD;
                        let params = {
                            EXPAPR_LEVEL_CD : item.EXPAPR_LEVEL_CD
                        };
                        let examList = filterCLS.getArrayMenuExam(params);
                        html += filterCLS.getNotPartExamContentGrouping(examList);
                    }
                });
                break;
            case menuCLS.TEMPLATE_CD.파트_X_단일:
                html = filterCLS.getNotPartExamContentSingle(filterCLS.ARRAY_MENU_EXAM);
                break;
            case menuCLS.TEMPLATE_CD.예비중1_파트X:
                html = filterCLS.getNotPreMidPartExamContentSingle(filterCLS.ARRAY_MENU_EXAM);
                break;
        }
        jQuery("#examMain").html(html);
    },
    setKoreanLiteraturePart : function() {
        const toggleClass = "has-toggle";
        const partMainTemplate = jQuery("#hidden-exam-part-template").html();
        let partTemplate = "";
        let childPartClass = "";
        let html = "";
        let examHtml = "";
        let rootPartTopFilter = new Array();

        filterCLS.PAGE = 1;
        filterCLS.KOREAN_PART_WORK_LIST = [];
        filterCLS.MAX_PAGE = filterCLS.ARRAY_MENU_KOREAN_LITERATURE_PART.length;

        jQuery("#examMain").html(templateReplace(partMainTemplate, [toggleClass, "ROOT_PART_CD"]));

        if (filterCLS.getIsFilter(filterCLS.getMenuByFilter(), commonCLS.FILTER.갈래.FILTER_CD)) {
            rootPartTopFilter = [
                {
                    "SEQ": 1,
                    "EXPAPR_NO": "11324604",
                    "expapr_title": "[갈래 분석] 1.시",
                    "EXPAPR_ADD_ATTR1": "2022년",
                    "EXPAPR_ADD_ATTR2": "1학기 중간",
                    "EXPAPR_ADD_ATTR4": "기타",
                    "EXPAPR_GRADE" : 0,
                    "EXAM_EPISODE": "01회",
                    "EXPAPR_TIP": "N",
                    "EXPAPR_CORETYPE_NAME_BY_FILTER": "갈래분석",
                    "EG_GUBUN_GROUP" : "",
                    "KR_GUBUN_GROUP": "",
                    "EXAM_TERM": "1M",
                    "EXPAPR_TESTYEAR": "2022",
                    "EXPAPR_TX_NAME" :  "시",
                    "TX_CODE" : "M9KRCHA0004"
                },
                {
                    "SEQ": 2,
                    "EXPAPR_NO": "11324605",
                    "expapr_title": "[갈래 분석] 2.소설",
                    "EXPAPR_ADD_ATTR1": "2022년",
                    "EXPAPR_ADD_ATTR2": "1학기 중간",
                    "EXPAPR_ADD_ATTR4": "기타",
                    "EXPAPR_GRADE" : 0,
                    "EXAM_EPISODE": "01회",
                    "EXPAPR_TIP": "N",
                    "EXPAPR_CORETYPE_NAME_BY_FILTER": "갈래분석",
                    "EG_GUBUN_GROUP" : "",
                    "KR_GUBUN_GROUP": "",
                    "EXAM_TERM": "1M",
                    "EXPAPR_TESTYEAR": "2022",
                    "EXPAPR_TX_NAME" :  "소설",
                    "TX_CODE" : "M9KRCHA0005"
                },
                {
                    "SEQ": 3,
                    "EXPAPR_NO": "11324606",
                    "expapr_title": "[갈래 분석] 3.수필",
                    "EXPAPR_ADD_ATTR1": "2022년",
                    "EXPAPR_ADD_ATTR2": "1학기 중간",
                    "EXPAPR_ADD_ATTR4": "기타",
                    "EXPAPR_GRADE" : 0,
                    "EXAM_EPISODE": "01회",
                    "EXPAPR_TIP": "N",
                    "EXPAPR_CORETYPE_NAME_BY_FILTER": "갈래분석",
                    "EG_GUBUN_GROUP" : "",
                    "KR_GUBUN_GROUP": "",
                    "EXAM_TERM": "1M",
                    "EXPAPR_TESTYEAR": "2022",
                    "EXPAPR_TX_NAME" :  "수필",
                    "TX_CODE" : "M9KRCHA0006"
                },
                {
                    "SEQ": 4,
                    "EXPAPR_NO": "11324607",
                    "expapr_title": "[갈래 분석] 4.극문학",
                    "EXPAPR_ADD_ATTR1": "2022년",
                    "EXPAPR_ADD_ATTR2": "1학기 중간",
                    "EXPAPR_ADD_ATTR4": "기타",
                    "EXPAPR_GRADE" : 0,
                    "EXAM_EPISODE": "01회",
                    "EXPAPR_TIP": "N",
                    "EXPAPR_CORETYPE_NAME_BY_FILTER": "갈래분석",
                    "EG_GUBUN_GROUP" : "",
                    "KR_GUBUN_GROUP": "",
                    "EXAM_TERM": "1M",
                    "EXPAPR_TESTYEAR": "2022",
                    "EXPAPR_TX_NAME" :  "극문학",
                    "TX_CODE" : "M9KRCHA0007"
                }
            ];

            if (commonGLB.getSubjectDetailCD() == 1) {
                partTemplate = jQuery("#hidden-exam-part-scroll-item-template").html();
                html= templateReplace(partTemplate, [childPartClass, "갈래분석", 0, 0, "", "next"]);
                jQuery("#ROOT_PART_CD").append(html);
            } else {
                partTemplate = jQuery("#hidden-exam-part-single-item-template").html();
                html= templateReplace(partTemplate, [0]);
                jQuery("#ROOT_PART_CD").append(html);
            }

            jQuery.each(rootPartTopFilter, function (seq, exam) {
                if (commonGLB.getTxCD().includes(exam.TX_CODE)) {
                    examHtml = filterCLS.getExamContentGroupingAndEpisode([exam], exam.EXPAPR_TX_NAME);
                    jQuery("#PART_CD_0").append(examHtml);
                }
            });
        }

        let workTitleArray = new Array();
        let workAuthorArray = new Array();
        let koreanPartArray = new Array();

        if (isValueEmpty(commonGLB.getWorkTitle()) == false || isValueEmpty(commonGLB.getWorkAuthor()) == false) {
            workTitleArray = commonGLB.getWorkTitle().split("|");
            workAuthorArray = commonGLB.getWorkAuthor().split("|");

            filterCLS.ARRAY_MENU_KOREAN_LITERATURE_PART = filterCLS.ARRAY_MENU_KOREAN_LITERATURE_PART.filter((val) => { return workTitleArray.includes(val.TITLE) || workAuthorArray.includes(val.AUTHOR) });
        }

        if ((isArrayInValue(["000020001000001"], commonGLB.getMenuCD()))) {
            koreanPartArray = filterCLS.ARRAY_MENU_KOREAN_LITERATURE_PART.filter((v, i, a) => a.findIndex(t => t.TITLE_AUTHOR === v.TITLE_AUTHOR) === i);
        } else {
            koreanPartArray = filterCLS.ARRAY_MENU_KOREAN_LITERATURE_PART;
        }

        filterCLS.MAX_PAGE = filterCLS.ARRAY_MENU_KOREAN_LITERATURE_PART.length;

		let startPageSize = (filterCLS.PAGE - 1) * (filterCLS.PAGESIZE * 4);
		let endPageSize = filterCLS.PAGE * (filterCLS.PAGESIZE * 4);

        jQuery.each(koreanPartArray, function (seq, part) {
            let html = "";
            let rootPartCD = "";
            let partCD = "";
            let partName = "";

            rootPartCD = part.EKL_CD;
            partCD = part.EKL_CD;
            partName = part.TITLE + " - " + part.AUTHOR + "\u2B50".repeat(part.IMPORTANCE);

            partTemplate = jQuery("#hidden-exam-part-scroll-item-template").html();

            if (seq >= startPageSize && seq < endPageSize) {
                if ((filterCLS.MAX_PAGE - 1) == seq) {
                    pagingStatus = "finish"
                } else {
                    pagingStatus = "next"
                }
                if ((isArrayInValue(["000020001000001"], commonGLB.getMenuCD()))) {
                    html= templateReplace(partTemplate, [childPartClass, partName, partCD, rootPartCD, "", "finish"]);
                    filterCLS.KOREAN_PART_WORK_LIST.push(part.TITLE + "_" + part.AUTHOR);
                    jQuery("#ROOT_PART_CD").append(html);
                } else {
                    html= templateReplace(partTemplate, [childPartClass, partName, partCD, rootPartCD, "", pagingStatus]);
                    filterCLS.KOREAN_PART_WORK_LIST.push(part.TITLE + "_" + part.AUTHOR);
                    jQuery("#ROOT_PART_CD").append(html);
                }
            }
        });
    },
    setNotPartExamKoreanLiterature : function () {
        let examPartCD = "";
        let itemPartCD = "";
        let partName = "";
        let examHtml = "";
        let partList = new Array();

        if ((isArrayInValue(["000020001000001"], commonGLB.getMenuCD()))) {
            jQuery.each(filterCLS.ARRAY_MENU_EXAM, function (i, item) {
                itemPartCD = item.EXPAPR_LEVEL_CD + item.EXPAPR_CORETYPE_CD + item.EXPAPR_ADD_ATTR3 + item.EXPAPR_ADD_ATTR4;

                if (examPartCD != itemPartCD) {
                    examPartCD = itemPartCD;

                    parentPartFilter = filterCLS.ARRAY_MENU_KOREAN_LITERATURE_PART.filter((val) => { return val.TITLE == item.EXPAPR_ADD_ATTR3 && val.AUTHOR == item.EXPAPR_ADD_ATTR4 });

                    if (parentPartFilter.length > 0) {
                        partName = parentPartFilter[0].TITLE_AUTHOR;

                        partList = filterCLS.ARRAY_MENU_EXAM.filter((val) => { return val.EXPAPR_NO == item.EXPAPR_NO });
                        examHtml = filterCLS.getExamContentGroupingAndEpisode(partList, partName);
                        jQuery("#PART_CD_" + parentPartFilter[0].EKL_CD).append(examHtml);
                    }
                }
            });
        } else {
            jQuery.each(filterCLS.ARRAY_MENU_EXAM, function (i, item) {
                itemPartCD = item.EXPAPR_LEVEL_CD + item.EXPAPR_CORETYPE_CD + item.EXPAPR_ADD_ATTR1 + item.EXPAPR_ADD_ATTR3 + item.EXPAPR_ADD_ATTR4;

                if (examPartCD != itemPartCD) {
                    examPartCD = itemPartCD;

                    parentPartFilter = filterCLS.ARRAY_MENU_KOREAN_LITERATURE_PART.filter((val) => { return val.TITLE == item.EXPAPR_ADD_ATTR3 && val.AUTHOR == item.EXPAPR_ADD_ATTR4 });

                    if (parentPartFilter.length > 0) {
                        partName = parentPartFilter[0].TITLE_AUTHOR;
                        partList = filterCLS.ARRAY_MENU_EXAM.filter((val) => { return val.EXPAPR_LEVEL_CD == item.EXPAPR_LEVEL_CD && val.EXPAPR_CORETYPE_CD == item.EXPAPR_CORETYPE_CD && val.EXPAPR_ADD_ATTR1 == item.EXPAPR_ADD_ATTR1 && val.EXPAPR_ADD_ATTR3 == item.EXPAPR_ADD_ATTR3 && val.EXPAPR_ADD_ATTR4 == item.EXPAPR_ADD_ATTR4 });
                        examHtml = filterCLS.getExamContentGroupingAndEpisode(partList, partName);
                        jQuery("#PART_CD_" + parentPartFilter[0].EKL_CD).append(examHtml);
                    }
                }
            });
        }
    },
    getNotPartExamContentSingle : function (examList) {
        let html = "";
        let date = new Date();
        let tipLabel = "";
        let targetYearLabel = date.getFullYear();
        let semesterLabel = "";
        let titleLabel = "";
        let label = "";
        jQuery.each(examList, function (i, item) {
            if (menuCLS.IsSoopring(commonGLB.getMenuCD())) {
                if (isArrayInValue(["000020000800001"], commonGLB.getMenuCD())){ 
                    semesterLabel = (Number(item.EXPAPR_TESTYEAR) + 1) + "학년도</span>";
                } else {
                    semesterLabel = item.EXPAPR_TESTYEAR;
                }
            } else {
                if (isValueEmpty(item.EXPAPR_ADD_ATTR2) == false) semesterLabel = item.EXPAPR_ADD_ATTR2;
            }
            html += templateReplace(jQuery("#hidden-exam-item-single-template").html(), [semesterLabel, item.EXPAPR_NO, item.WORK_TITLE +"-" + item.WORK_AUTHOR, item.EXPAPR_NO, 0, "", item.EXPAPR_TESTYEAR]);
        });
        return html;
    },
    getNotPreMidPartExamContentSingle : function (examList) {
        let html = "";

        jQuery.each(examList, function (i, item) {

			let subLabelHtml = "";

            if (commonGLB.getMenuCD() == "000010000700005") {
                let stepName = filterCLS.getWeekStepNameByNumber(i);
                subLabelHtml =  templateReplace(jQuery("#hidden-pre-mid-step-exam-item-single-template").html(), [stepName]);
            }

            if (commonGLB.getMenuCD() == "000010000600001") {
                if (item.EXAM_EPISODE == "01회") {
                    subLabelHtml = templateReplace(jQuery("#hidden-pre-free-exam-item-single-template").html(), []);
                }
            }

            if (commonGLB.getMenuCD() == "000020001100002") {
                if (isValueEmpty(item.EXPAPR_CORETYPE_NAME_BY_FILTER)) {
                    let stepName = filterCLS.getWeekStepNameByNumber(i);
                    subLabelHtml =  templateReplace(jQuery("#hidden-pre-mid-step-exam-item-single-template").html(), [stepName]);
                } else {
                    subLabelHtml = filterCLS.getLevelLabel(Number(item.EXPAPR_CORETYPE_NAME_BY_FILTER));
                }
            }

            html += templateReplace(jQuery("#hidden-pre-mid-exam-item-single-template").html(), [subLabelHtml, item.EXPAPR_NO, item.APP_GROUP_TEXT, item.EXPAPR_NO, 0, "", item.EXPAPR_TESTYEAR]);
        });
        return html;
    },
    getPreExamContentGroupingAndEpisode : function (partList, partNm) {
        let html = "";
        let tipLabel = "";
        let titleLabel = "";
        let subTitle = "";
        let subTitleLabel = "";
        let subLabelName = "";
        let subLabel = "";
        let semesterLabel = "";
        let gradeLabel = "";
        let isEpisode = partList.length > 1; //두개 이상일 경우 회차별로 표시

        jQuery.each(partList, function (i, item) {
            if (item.EXPAPR_TIP == "Y") tipLabel = jQuery("#hidden-exam-badge-tip-span-template").html();
            semesterLabel = filterCLS.getSemesterLabel(item.EXPAPR_ADD_ATTR2);

            if (isValueEmpty(item.EG_GUBUN_GROUP) == false) { //영문법, 구문독해 난이도 표시
                subTitle = filterCLS.getEgGubunGroupLabel(item.EG_GUBUN_GROUP);
                subLabelName = filterCLS.getStepLabel(item.EG_GUBUN_GROUP);
            };

            if (isValueEmpty(subLabelName) == false) {
                subLabel = templateReplace(jQuery("#hidden-exam-item-grouping-episode-mix-main-sub-label-template").html(), [subLabelName]);
            };

            if (isValueEmpty(subTitle) == false) {
                subTitleLabel = templateReplace(jQuery("#hidden-exam-item-grouping-sub-title-template").html(), [subTitle]);
            };

            if (isEpisode) {
                let episodeName = "";
                let reDownLoadClass = "";
                titleLabel = templateReplace(jQuery("#hidden-exam-item-grouping-title-template").html(), [partNm, subTitleLabel]);

                episodeName = filterCLS.getExamEpisodeTitle(item.EXAM_EPISODE, item.KR_GUBUN_GROUP);
                
                html += templateReplace(jQuery("#hidden-exam-item-episode-item-template").html(), [reDownLoadClass, item.EXPAPR_NO, episodeName, 0, 0, (item.ROOT_PART_CD + "-" + item.SUB_PART_CD + "-" + item.DETAIL_PART_CD), item.EXPAPR_LEVEL_CD, partList.length, "", ""]);
            } else {
                html += templateReplace(jQuery("#hidden-exam-item-grouping-single-item-template").html(), [item.EXPAPR_NO, partNm, 0, subTitleLabel, (item.ROOT_PART_CD + "-" + item.SUB_PART_CD + "-" + item.DETAIL_PART_CD), item.EXPAPR_LEVEL_CD, "", item.EXPAPR_TESTYEAR]);
            }
        });

        if (isEpisode) {
            return templateReplace(jQuery("#hidden-exam-item-episode-mix-main-template").html(), [tipLabel, titleLabel, html, subLabel, semesterLabel, gradeLabel]);
        } else {
            return templateReplace(jQuery("#hidden-exam-item-grouping-mix-main-template").html(), [tipLabel, titleLabel, html, subLabel, semesterLabel, gradeLabel]);
        }
    },
    //     let html = "";
    //     jQuery.each(partList, function (i, item) {
    //         let vodTypeClass = filterCLS.getVodClassName(item.VOD_TYPE);

    //         if (menuCLS.getMenuContentTemplateVodCD() == menuCLS.TEMPLATE_VOD_CD.복합형 && typeof(item.VOD_NO) != "undefined" ? true : false) {
    //             if (partList.length > 1) {
    //                 html += templateReplace(jQuery("#hidden-vod-exam-item-grouping-item-template").html(), [2, item.EXPAPR_NO, item.VOD_NO, item.EXPAPR_NAME, 0, vodTypeClass]);
    //             } else {
    //               html += templateReplace(jQuery("#hidden-vod-exam-item-grouping-single-item-template").html(), [2, item.EXPAPR_NO, item.VOD_NO, partNm, 0, subTitleLabel, vodTypeClass]);
    //             }
    //         } else {
    //             if (partList.length > 1) {
    //                 html += templateReplace(jQuery("#hidden-exam-item-grouping-item-template").html(), [item.EXPAPR_NO, item.EXPAPR_NAME, 0, (item.ROOT_PART_CD + "-" + item.SUB_PART_CD + "-" + item.DETAIL_PART_CD), item.EXPAPR_LEVEL_CD, partList.length]);
    //             } else {
    //                 html += templateReplace(jQuery("#hidden-exam-item-grouping-single-item-template").html(), [item.EXPAPR_NO, partNm, 0, subTitleLabel, (item.ROOT_PART_CD + "-" + item.SUB_PART_CD + "-" + item.DETAIL_PART_CD), item.EXPAPR_LEVEL_CD]);
    //             }
    //         }
    //     });
    //     return templateReplace(jQuery("#hidden-exam-item-grouping-main-template").html(), ["", "", "", "", html, ""]);
    // },
    getNotPreMidPartExamContentByCreatePartMt : function(partList, partNm) {
        let html = "";
        let tipLabel = "";
        let stepLabel = "STEP 1";
        let semesterLabel = "";
        let levelLabel = "";
        let titleLabel = "";
        jQuery.each(partList, function (i, item) {
            if (item.EXPAPR_LEVEL_CD == "1") {
                stepLabel = "STEP 1";
                levelLabel = templateReplace(jQuery("#hidden-exam-item-grouping-sub-title-template").html(), ["개념완성"]);
            } else if (item.EXPAPR_LEVEL_CD == "2") {
                stepLabel = "STEP 2";
                if (isArrayInValue(["000010000700007"], commonGLB.getMenuCD())) {
                    levelLabel = templateReplace(jQuery("#hidden-exam-item-grouping-sub-title-template").html(), ["기본완성"]);
                } else {
                    levelLabel = templateReplace(jQuery("#hidden-exam-item-grouping-sub-title-template").html(), ["유형완성"]);
                }
            } else {
                stepLabel = "STEP 3";
                if (isArrayInValue(["000010000700007"], commonGLB.getMenuCD())) {
                    levelLabel = templateReplace(jQuery("#hidden-exam-item-grouping-sub-title-template").html(), ["유형완성"]);
                } else {
                    levelLabel = templateReplace(jQuery("#hidden-exam-item-grouping-sub-title-template").html(), ["대단원 완성"]);
                }
            }

            if (i == 0 && partList.length > 1) {
                titleLabel = templateReplace(jQuery("#hidden-exam-item-grouping-title-template").html(), [partNm, levelLabel]);
            }

            if (menuCLS.getMenuContentTemplateVodCD() == menuCLS.TEMPLATE_VOD_CD.복합형 && typeof(item.VOD_NO) != "undefined" ? true : false) {
                let vodTypeClass = filterCLS.getVodClassName(item.VOD_TYPE);

                if (partList.length > 1) {
                    html += templateReplace(jQuery("#hidden-vod-exam-item-grouping-item-template").html(), [2, item.EXPAPR_NO, item.VOD_NO, item.APP_GROUP_TEXT, 0, vodTypeClass]);
                } else {
                    html += templateReplace(jQuery("#hidden-vod-exam-item-grouping-single-item-template").html(), [2, item.EXPAPR_NO, item.VOD_NO, partNm, 0, levelLabel, vodTypeClass]);
                }
            } else {
                if (partList.length > 1) {
                    html += templateReplace(jQuery("#hidden-exam-item-grouping-item-template").html(), [item.EXPAPR_NO, item.APP_GROUP_TEXT, 0, (item.ROOT_PART_CD + "-" + item.SUB_PART_CD + "-" + item.DETAIL_PART_CD), item.EXPAPR_LEVEL_CD, partList.length, "", item.EXPAPR_TESTYEAR]);
                } else {
                    html += templateReplace(jQuery("#hidden-exam-item-grouping-single-item-template").html(), [item.EXPAPR_NO, partNm, 0, levelLabel, (item.ROOT_PART_CD + "-" + item.SUB_PART_CD + "-" + item.DETAIL_PART_CD), item.EXPAPR_LEVEL_CD, "", item.EXPAPR_TESTYEAR]);
                }
            }
        });
        return templateReplace(jQuery("#hidden-exam-item-grouping-create-main-template").html(), [tipLabel, stepLabel, semesterLabel, titleLabel, html]);
    },
    getNotPartExamContentGrouping : function (examList) {
        let html = "";
        let date = new Date();
        let tipLabel = "";
        let targetYearLabel = date.getFullYear();
        let semesterLabel = "";
        let titleLabel = "";
        let label = "";

        jQuery.each(examList, function (i, item) {
            let levelCD = Number(item.EXPAPR_LEVEL_CD);

            if (i == 0 && examList.length > 1) {
                titleLabel = templateReplace(jQuery("#hidden-exam-item-grouping-title-template").html(), [menuCLS.getMenuByLevelNm(levelCD), ""]);
            }
            if (item.EXPAPR_TIP == "Y") tipLabel = jQuery("#hidden-exam-badge-tip-span-template").html();
            if (menuCLS.IsSoopring(commonGLB.getMenuCD())) {
                semesterLabel = item.EXPAPR_TESTYEAR;
            } else {
                if (isValueEmpty(item.EXPAPR_ADD_ATTR2) == false) semesterLabel = item.EXPAPR_ADD_ATTR2;
            }

            if (isArrayInValue(["000020000900001", "000020000900002"], commonGLB.getMenuCD())) {
                label = templateReplace(jQuery("#hidden-pre-go-free-exam-item-single-template").html(), []);
            }

            if (examList.length > 1) {
                html += templateReplace(jQuery("#hidden-exam-item-grouping-item-template").html(), [item.EXPAPR_NO, item.APP_GROUP_TEXT, 0, item.EXPAPR_NO, item.EXPAPR_LEVEL_CD, examList.length, "", item.EXPAPR_TESTYEAR]);
            } else {
                html += templateReplace(jQuery("#hidden-exam-item-grouping-single-item-template").html(), [item.EXPAPR_NO, menuCLS.getMenuByLevelNm(levelCD), 0, "", item.EXPAPR_NO, 0, "", item.EXPAPR_TESTYEAR]);
            }
        });
        return templateReplace(jQuery("#hidden-exam-item-grouping-main-template").html(), [tipLabel, targetYearLabel, semesterLabel, titleLabel, html, label]);
    },
    getNotPartExamContentFinal : function (examList) {
        let html        = "";
        let tipLabel    = "";
        jQuery.each(examList, function (i, item) {
            if (item.EXPAPR_TIP == "Y") tipLabel = jQuery("#hidden-exam-badge-tip-span-template").html();
            html += templateReplace(jQuery("#hidden-exam-item-episode-final-item-template").html(), ["", item.EXPAPR_NO, item.EXAM_EPISODE, 1, 0, item.EXPAPR_NO, 0, examList.length, "", item.EXPAPR_TESTYEAR]);
        });
        return templateReplace(jQuery("#hidden-exam-item-episode-final-main-template").html(), [tipLabel, filterFinalCLS.getTermHTML(), filterFinalCLS.getTitleHTML(), html]);
    },
    getArrayMenuExam : function (params) {
        return filterCLS.ARRAY_MENU_EXAM.filter((val) => {
            return (isValueEmpty(params.EXPAPR_CORETYPE_NAME_BY_FILTER) || val.EXPAPR_CORETYPE_NAME_BY_FILTER == params.EXPAPR_CORETYPE_NAME_BY_FILTER) && (isValueEmpty(params.EG_GUBUN_GROUP) || val.EG_GUBUN_GROUP == params.EG_GUBUN_GROUP) && (isValueEmpty(params.EXPAPR_CORETYPE_CD) || val.EXPAPR_CORETYPE_CD == params.EXPAPR_CORETYPE_CD) && (isValueEmpty(params.EXPAPR_LEVEL_CD) || val.EXPAPR_LEVEL_CD == params.EXPAPR_LEVEL_CD) && (isValueEmpty(params.ROOT_PART_CD) || val.ROOT_PART_CD == params.ROOT_PART_CD) && (isValueEmpty(params.SUB_PART_CD) || val.SUB_PART_CD == params.SUB_PART_CD) && (isValueEmpty(params.DETAIL_PART_CD) || val.DETAIL_PART_CD == params.DETAIL_PART_CD);
        });
    },
    getArrayBeforeMenuExam : function (params) {
        return filterCLS.ARRAY_MENU_BEFORE_EXAM.filter((val) => {
            return (isValueEmpty(params.EXPAPR_CORETYPE_NAME_BY_FILTER) || val.EXPAPR_CORETYPE_NAME_BY_FILTER == params.EXPAPR_CORETYPE_NAME_BY_FILTER) && (isValueEmpty(params.EG_GUBUN_GROUP) || val.EG_GUBUN_GROUP == params.EG_GUBUN_GROUP) && (isValueEmpty(params.EXPAPR_CORETYPE_CD) || val.EXPAPR_CORETYPE_CD == params.EXPAPR_CORETYPE_CD) && (isValueEmpty(params.EXPAPR_LEVEL_CD) || val.EXPAPR_LEVEL_CD == params.EXPAPR_LEVEL_CD) && (isValueEmpty(params.ROOTPART_ID) || val.ROOTPART_ID == params.ROOTPART_ID) && (isValueEmpty(params.SUBPART_ID) || val.SUBPART_ID == params.SUBPART_ID) && (isValueEmpty(params.DETAILPART_ID) || val.DETAILPART_ID == params.DETAILPART_ID);
        });
    },
    setExamContent: function (beforePartItemID) {
        let partCD = "";
        let parentPartID = "";
        let partNm = "";
        let levelPartID = 0;
        let itemPartCD = "";
        let params;
        
        const templateMenuCd = menuCLS.getMenuContentTemplateCD();
        const menuCd = commonGLB.getMenuCD();
        
        jQuery.each(filterCLS.ARRAY_MENU_EXAM, function (i, item) {
            if (isArrayInValue(filterCLS.EXPAPR_CORETYPE_CD_NOT_GROUPING_MENU_LIST, menuCd)) {
                itemPartCD = item.ROOT_PART_CD + item.SUB_PART_CD + item.DETAIL_PART_CD + item.EXPAPR_LEVEL_CD + item.EG_GUBUN_GROUP;
			} else if (isArrayInValue(filterCLS.PREMID_KOREAN_PART_HANDLING_MENU_LIST, menuCd)) {
				itemPartCD = item.ROOT_PART_CD + item.SUB_PART_CD + item.DETAIL_PART_CD + item.EXPAPR_LEVEL_CD  + item.EXPAPR_CORETYPE_CD + item.EG_GUBUN_GROUP + item.EXPAPR_CORETYPE_NAME_BY_FILTER;
            } else if (isArrayInValue(filterCLS.EXPAPR_CORETYPE_FILTER_GROUPING_MENU_LIST, menuCd)) {
                itemPartCD = item.ROOT_PART_CD + item.SUB_PART_CD + item.DETAIL_PART_CD + item.EXPAPR_LEVEL_CD  + item.EXPAPR_CORETYPE_CD + item.EG_GUBUN_GROUP + item.EXPAPR_CORETYPE_NAME_BY_FILTER;
            } else {
                itemPartCD = item.ROOT_PART_CD + item.SUB_PART_CD + item.DETAIL_PART_CD + item.EXPAPR_LEVEL_CD  + item.EXPAPR_CORETYPE_CD + item.EG_GUBUN_GROUP;
            }
            if (partCD != itemPartCD) {
                partCD = itemPartCD;
                let partList = new Array();
                switch (filterCLS.PART_USE_CD) {
                    case commonCLS.PART_USE_CD.미사용.CD:
                        partList = filterCLS.ARRAY_MENU_EXAM;
                        break;
                    case commonCLS.PART_USE_CD.루트파트까지사용.CD:
                        if (isArrayInValue(filterCLS.EXPAPR_CORETYPE_CD_NOT_GROUPING_MENU_LIST, menuCd)) {
                            params = {
                                EXPAPR_LEVEL_CD: item.EXPAPR_LEVEL_CD,
                                ROOT_PART_CD: item.ROOT_PART_CD,
                                EG_GUBUN_GROUP : item.EG_GUBUN_GROUP,
                            };
                        } else {
                            params = {
                                EG_GUBUN_GROUP : item.EG_GUBUN_GROUP,
                                EXPAPR_CORETYPE_CD: item.EXPAPR_CORETYPE_CD,
                                EXPAPR_LEVEL_CD: item.EXPAPR_LEVEL_CD,
                                ROOT_PART_CD: item.ROOT_PART_CD,
                                EG_GUBUN_GROUP : item.EG_GUBUN_GROUP,
                            };
                        }
                        partList = filterCLS.getArrayMenuExam(params);
                        if (isArrayInValue(["000010000700004"], menuCd)) {
                            parentPartID = "PART_CD_" + item.CHAPTER_EG_PART + item.ROOT_PART_CD;
                        } else {
                            parentPartID = "PART_CD_" + item.ROOT_PART_CD;
                        }

                        partNm = item.ROOT_PART_NM;
                        break;
                    case commonCLS.PART_USE_CD.서브파트까지사용.CD:
                        if (isArrayInValue(filterCLS.EXPAPR_CORETYPE_CD_NOT_GROUPING_MENU_LIST, menuCd)) {
                            params = {
                                EXPAPR_LEVEL_CD : item.EXPAPR_LEVEL_CD,
                                ROOT_PART_CD : item.ROOT_PART_CD,
                                SUB_PART_CD : item.SUB_PART_CD,
                            };
                        } else if (isArrayInValue(filterCLS.PREMID_KOREAN_PART_HANDLING_MENU_LIST, menuCd)) {
                            params = {
                                EXPAPR_CORETYPE_NAME_BY_FILTER : item.EXPAPR_CORETYPE_NAME_BY_FILTER,
                                EXPAPR_LEVEL_CD : item.EXPAPR_LEVEL_CD,
                                ROOT_PART_CD : item.ROOT_PART_CD,
                                SUB_PART_CD : item.SUB_PART_CD,
                            };
                        } else {
                            params = {
                                EXPAPR_CORETYPE_CD : item.EXPAPR_CORETYPE_CD,
                                EXPAPR_LEVEL_CD : item.EXPAPR_LEVEL_CD,
                                ROOT_PART_CD : item.ROOT_PART_CD,
                                SUB_PART_CD : item.SUB_PART_CD,
                            };
                        }
                        partList = filterCLS.getArrayMenuExam(params);
                        if (item.SUB_PART_CD == "99") {
                            parentPartID = "PART_CD_" + item.ROOT_PART_CD;
                            partNm = item.ROOT_PART_NM;
                        } else {
                            parentPartID = "PART_CD_" + item.ROOT_PART_CD + item.SUB_PART_CD;
                            partNm = filterCLS.getExamPartSubPartPeplace(item.ROOT_PART_CD, item.SUB_PART_NM);
                        }
                        break;
                    case commonCLS.PART_USE_CD.디테일파트까지사용.CD:
                        if (isArrayInValue(filterCLS.EXPAPR_CORETYPE_CD_NOT_GROUPING_MENU_LIST, menuCd)) {
                            params = {
                                EXPAPR_LEVEL_CD : item.EXPAPR_LEVEL_CD,
                                ROOT_PART_CD : item.ROOT_PART_CD,
                                SUB_PART_CD : item.SUB_PART_CD,
                                DETAIL_PART_CD : item.DETAIL_PART_CD,
                            };
                        } else if (isArrayInValue(filterCLS.EXPAPR_CORETYPE_FILTER_GROUPING_MENU_LIST, menuCd)) {
                            params = {
                                EXPAPR_CORETYPE_NAME_BY_FILTER : item.EXPAPR_CORETYPE_NAME_BY_FILTER,
                                EXPAPR_CORETYPE_CD : item.EXPAPR_CORETYPE_CD,
                                EXPAPR_LEVEL_CD : item.EXPAPR_LEVEL_CD,
                                ROOT_PART_CD : item.ROOT_PART_CD,
                                SUB_PART_CD : item.SUB_PART_CD,
                                DETAIL_PART_CD : item.DETAIL_PART_CD,
                            };
                        } else {
                            params = {
                                EXPAPR_CORETYPE_CD : item.EXPAPR_CORETYPE_CD,
                                EXPAPR_LEVEL_CD : item.EXPAPR_LEVEL_CD,
                                ROOT_PART_CD : item.ROOT_PART_CD,
                                SUB_PART_CD : item.SUB_PART_CD,
                                DETAIL_PART_CD : item.DETAIL_PART_CD,
                            };
                        }
                        partList = filterCLS.getArrayMenuExam(params);
						if (item.SUB_PART_CD == "99") {
							parentPartID = "PART_CD_" + item.ROOT_PART_CD;
                            partNm = item.ROOT_PART_NM;
                        } else if (item.DETAIL_PART_CD == "99") {
                            parentPartID = previousPartID;
                            partNm = filterCLS.getExamPartSubPartPeplace(item.ROOT_PART_CD, item.SUB_PART_NM);
                        } else {
                            parentPartID = "PART_CD_" + item.ROOT_PART_CD + item.SUB_PART_CD;
                            partNm = filterCLS.getExamPartDetailPartPeplace(item.ROOT_PART_CD, item.SUB_PART_CD, item.DETAIL_PART_NAME);
                        }
                        break;
                }

                if (templateMenuCd == menuCLS.TEMPLATE_CD.AI회차형 && levelPartID != item.ROOT_PART_CD + item.SUB_PART_CD + item.EXPAPR_LEVEL_CD) {
                    levelPartID = item.ROOT_PART_CD + item.SUB_PART_CD + item.EXPAPR_LEVEL_CD;
                    if (item.EXPAPR_LEVEL_CD == 4) {
                        parentPartID = "PART_CD_" + item.ROOT_PART_CD;
                        partNm = partList[0].ROOT_PART_NM;
                    }
                }
                
                if (!isValueEmpty(beforePartItemID)) {
                    partNm = partNm.replace(/^[\d-]+\./, '');
                }

                // 고2 사회영역 세계사, 동아시아사 예외 처리
                if (commonGLB.getTxCD() == "H9LSCHA2004" && commonGLB.getMenuCD() == "000040000100001") {
                    if (item.ROOT_PART_CD === "101" && item.SUB_PART_CD == "1") {
                        partNm= "1-1.세계사 학습의 필요성~1-2.인류의 출현과 선사 문화";
                    }
                } else if (commonGLB.getTxCD() == "H9LSCHA2008" && commonGLB.getMenuCD() == "000040000100001") {
                    if (item.ROOT_PART_CD === "101" && item.SUB_PART_CD == "1") {
                        partNm = "1-1.동아시아와 동아시아 사람들~1-2.동아시아의 자연환경";
                    }
                }

                let html = "";
                switch (templateMenuCd) {
                    case menuCLS.TEMPLATE_CD.그룹형:
                        html = filterCLS.getExamContentGroupingV2(partList, partNm, beforePartItemID);
                        break;
                    case menuCLS.TEMPLATE_CD.회차형:
                    case menuCLS.TEMPLATE_CD.레벨회차형:
                        if (partList.length > 1) {
							html = filterCLS.getExamContentEpisodeV2(partList, partNm, beforePartItemID);
						} else {
							html = filterCLS.getExamContentGroupingV2(partList, partNm, beforePartItemID);
						}
                        break;
                    case menuCLS.TEMPLATE_CD.AI회차형:
                        html = filterCLS.getExamContentAiEpisode(partList, partNm);
                        break;
                    case menuCLS.TEMPLATE_CD.생성그룹형:
                        html = filterCLS.getExamContentGroupingByCreateV2(partList, partNm, beforePartItemID);
                        break;
                    case menuCLS.TEMPLATE_CD.그룹회차형:
                        html = filterCLS.getExamContentGroupingAndEpisode(partList, partNm);
                        break;
                    case menuCLS.TEMPLATE_CD.예비중1_영문법:
                        html = filterCLS.getPreExamContentGroupingAndEpisode(partList, partNm);
                        break;
                    case menuCLS.TEMPLATE_CD.예비중1_수학:
                        html = filterCLS.getNotPreMidPartExamContentByCreatePartMt(partList, partNm);
                        break;
                    case menuCLS.TEMPLATE_CD.단원별학습형:
                        html = filterCLS.getExamContentPartEpisodeV2(partList, partNm, beforePartItemID);
                        break;
                }

                if (isValueEmpty(beforePartItemID)) {
                    jQuery("#" + parentPartID).append(html);
                } else {
                    jQuery("#" + beforePartItemID).append(html);
                }

                previousPartID = parentPartID;
                previousPartNm = partNm;
            }
        });
    },
    setBeforeExamContent: function(targetPartCD, selectedRootPartCD, beforePartData, lastPartCd) {
        let partCD = "";
        let partNm = "";
        let levelPartID = 0;
        let itemPartCD = "";
        let htmlBuffer = {};
        let beforeExamList = Array();

        switch (lastPartCd) {
            case commonCLS.PART_USE_CD.루트파트까지사용.CD:
                beforeExamList = filterCLS.ARRAY_MENU_BEFORE_EXAM.filter(v=> v.ROOTPART_ID == beforePartData.BEFORE_ROOTPART_ID && v.SUBPART_ID == "" && v.DETAILPART_ID == "");
                break;
            case commonCLS.PART_USE_CD.서브파트까지사용.CD:
                beforeExamList = filterCLS.ARRAY_MENU_BEFORE_EXAM.filter(v=> v.SUBPART_ID == beforePartData.BEFORE_SUBPART_ID && v.DETAILPART_ID == "");
                break;
            case commonCLS.PART_USE_CD.디테일파트까지사용.CD:
                beforeExamList = filterCLS.ARRAY_MENU_BEFORE_EXAM.filter(v=> v.DETAILPART_ID == beforePartData.BEFORE_DETAILPART_ID);
                break;
        }

        let beforeExamIndex = {};

        beforeExamList.forEach(function(item) {
            var key;
            switch (lastPartCd) {
                case commonCLS.PART_USE_CD.루트파트까지사용.CD:
                    key = item.EXPAPR_CORETYPE_CD + "|" + item.EXPAPR_LEVEL_CD + "|" + item.ROOTPART_ID;
                    break;
                case commonCLS.PART_USE_CD.서브파트까지사용.CD:
                    key = item.EXPAPR_CORETYPE_CD + "|" + item.EXPAPR_LEVEL_CD + "|" + item.ROOTPART_ID + "|" + item.SUBPART_ID;
                    break;
                case commonCLS.PART_USE_CD.디테일파트까지사용.CD:
                    key = item.EXPAPR_CORETYPE_CD + "|" + item.EXPAPR_LEVEL_CD + "|" + item.ROOTPART_ID + "|" + item.SUBPART_ID + "|" + item.DETAILPART_ID;
                    break;
            }
            if (!beforeExamIndex[key]) beforeExamIndex[key] = [];
            beforeExamIndex[key].push(item);
        });

        let beforeInfoMap = {};
        filterCLS.ARRAY_MENU_BEFORE_INFO_LIST.forEach(function(v) {
            let parts = v.split("|");
            beforeInfoMap[parts[1]] = parts[2];
        });

        let templateCD = menuCLS.getMenuContentTemplateCD();

        jQuery.each(beforeExamList, function (i, item) {
            itemPartCD = item.ROOTPART_ID + item.SUBPART_ID + item.DETAILPART_ID + item.EXPAPR_LEVEL_CD + item.EXPAPR_CORETYPE_CD + item.EG_GUBUN_GROUP;

            if (partCD != itemPartCD) {
                partCD = itemPartCD;
                let partList, indexKey;

                switch (lastPartCd) {
                    case commonCLS.PART_USE_CD.미사용.CD:
                        partList = beforeExamList;
                        break;
                    case commonCLS.PART_USE_CD.루트파트까지사용.CD:
                        indexKey = item.EXPAPR_CORETYPE_CD + "|" + item.EXPAPR_LEVEL_CD + "|" + item.ROOTPART_ID;
                        partList = beforeExamIndex[indexKey] || [];
                        partNm = item.ROOT_PART_NM;
                        beforePartItemID = beforeInfoMap[item.ROOTPART_ID];
                        break;
                    case commonCLS.PART_USE_CD.서브파트까지사용.CD:
                        indexKey = item.EXPAPR_CORETYPE_CD + "|" + item.EXPAPR_LEVEL_CD + "|" + item.ROOTPART_ID + "|" + item.SUBPART_ID;
                        partList = beforeExamIndex[indexKey] || [];
                        partNm = filterCLS.getExamPartSubPartPeplace(item.ROOT_PART_CD, item.SUB_PART_NM);
                        beforePartItemID = beforeInfoMap[item.SUBPART_ID];
                        break;
                    case commonCLS.PART_USE_CD.디테일파트까지사용.CD:
                        indexKey = item.EXPAPR_CORETYPE_CD + "|" + item.EXPAPR_LEVEL_CD + "|" + item.ROOTPART_ID + "|" + item.SUBPART_ID + "|" + item.DETAILPART_ID;
                        partList = beforeExamIndex[indexKey] || [];
                        partNm = filterCLS.getExamPartDetailPartPeplace(item.ROOT_PART_CD, item.SUB_PART_CD, item.DETAIL_PART_NAME);
                        beforePartItemID = beforeInfoMap[item.DETAILPART_ID];
                        break;
                }

                if (templateCD == menuCLS.TEMPLATE_CD.AI회차형 && levelPartID != item.ROOT_PART_CD + item.SUB_PART_CD + item.EXPAPR_LEVEL_CD) {
                    levelPartID = item.ROOT_PART_CD + item.SUB_PART_CD + item.EXPAPR_LEVEL_CD;
                    if (item.EXPAPR_LEVEL_CD == 4) {
                        parentPartID = "PART_CD_" + item.ROOT_PART_CD;
                        partNm = partList[0].ROOT_PART_NM;
                    }
                }

                if (!isValueEmpty(beforePartItemID)) {
                    partNm = partNm.replace(/^[\d-]+\./, '');
                    beforePartItemID = "PART_CD_" + beforePartItemID;
                }

                var html = "";

                switch (templateCD) {
                    case menuCLS.TEMPLATE_CD.그룹형:
                        html = filterCLS.getExamContentGroupingV2(partList, partNm, beforePartItemID);
                        break;
                    case menuCLS.TEMPLATE_CD.회차형:
                    case menuCLS.TEMPLATE_CD.레벨회차형:
                        html = partList.length > 1
                            ? filterCLS.getExamContentEpisodeV2(partList, partNm, beforePartItemID)
                            : filterCLS.getExamContentGroupingV2(partList, partNm, beforePartItemID);
                        break;
                    case menuCLS.TEMPLATE_CD.AI회차형:
                        html = filterCLS.getExamContentAiEpisode(partList, partNm);
                        break;
                    case menuCLS.TEMPLATE_CD.생성그룹형:
                        html = filterCLS.getExamContentGroupingByCreateV2(partList, partNm, beforePartItemID);
                        break;
                    case menuCLS.TEMPLATE_CD.그룹회차형:
                        html = filterCLS.getExamContentGroupingAndEpisode(partList, partNm);
                        break;
                    case menuCLS.TEMPLATE_CD.예비중1_영문법:
                        html = filterCLS.getPreExamContentGroupingAndEpisode(partList, partNm);
                        break;
                    case menuCLS.TEMPLATE_CD.예비중1_수학:
                        html = filterCLS.getNotPreMidPartExamContentByCreatePartMt(partList, partNm);
                        break;
                    case menuCLS.TEMPLATE_CD.단원별학습형:
                        html = filterCLS.getExamContentPartEpisodeV2(partList, partNm, beforePartItemID);
                        break;
                }

                var targetID = beforePartItemID;
                if (!htmlBuffer[targetID]) htmlBuffer[targetID] = "";
                htmlBuffer[targetID] += html;
            }
        });

        for (var id in htmlBuffer) {
            if (htmlBuffer.hasOwnProperty(id)) {
                jQuery("#" + id).append(htmlBuffer[id]);
            }
        }

        if (beforeExamList.length == 0 && jQuery("#" + targetPartCD).find('.download').length == 0) {
            filterCLS.setOpenMonthPart(targetPartCD, selectedRootPartCD);
        }
    },
    setVodContent: function () {
        switch (menuCLS.getMenuContentTemplateVodCD()) {
            case menuCLS.TEMPLATE_VOD_CD.단원형:
                filterCLS.setVodPart();
                break;
        }
    },
    setAssociatePart: function() {
        jQuery.each(filterCLS.ARRAY_MENU_ASSOCIATE_PART, function (seq, part) {
            let partName = "";
            let parentPartId = "";
            let parentPartName = "";
            let levelName = "";
            let levelLabel = "";

            let selectedParentFilter = filterCLS.ARRAY_MENU_PART.filter((val) => { return val.ROOT_PART_CD == part.TARGET_PART_CD; });
            if (selectedParentFilter.length > 0) {
                parentPartId = selectedParentFilter[0].ROOT_PART_CD;
                parentPartName = selectedParentFilter[0].ROOT_PART_NM;
            }

            if (isValueEmpty(part.PART_ORDER_NO)) {
                partName = filterCLS.getPartRootPartPeplace(parentPartId,  " " + parentPartName) + " 연계 단원";
            } else {
                partName = filterCLS.getPartRootPartPeplace(parentPartId,  " " + parentPartName) + " 연계 단원 (" + part.PART_ORDER_NO + ")";
            }

            levelName = filterCLS.getEgLevelLabel(part.LEVEL_CD);
            levelLabel = templateReplace(jQuery("#hidden-associate-part-item-level-template").html(), [levelName]);

            let html = templateReplace(jQuery("#hidden-associate-part-item-template").html(), [part.ASSOCIATE_PART_CD, partName, levelLabel]);

            if (isValueEmpty(html) == false) {
                jQuery("#PART_CD_" + parentPartId).append(html);
            }
        });
    },
    setAssociateContent: function() {
        if(filterCLS.ARRAY_MENU_ASSOCIATE_INFO.length > 0) {
            let examList = filterCLS.ARRAY_MENU_ASSOCIATE_INFO.filter((val) => { return val.FILE_TYPE_CD == 1; });
            let vodList = filterCLS.ARRAY_MENU_ASSOCIATE_INFO.filter((val) => { return val.FILE_TYPE_CD == 2; });
            if (vodList.length > 0 && (appCLS.getIsRecoomendedVersion(appCLS.getVodExamRecoomendedVersion()) == true || TRK_GLB_SERVICE_TYPE_CD == 2)) {
                filterCLS.setAssociateVodContentByPart(vodList);
            }

            if (examList.length > 0) {
                filterCLS.setAssociateExamContent(examList);
            }

            filterCLS.ARRAY_MENU_ASSOCIATE_INFO = null;
        }
    },
    setAssociateExamContent: function(examList) {
        let partName = "";
        let partCD = "";
        let parentPartID = "";
        let partList = new Array();

        jQuery.each(examList, function (seq, item) {
            let itemPartCD = item.ASSOCIATE_PART_CD + item.GUBUN_CD;
            if (partCD != itemPartCD) {
                partCD = itemPartCD;

                let partFilter = filterCLS.ARRAY_MENU_ASSOCIATE_PART.filter((val) => {return val.ASSOCIATE_PART_CD == item.ASSOCIATE_PART_CD });
                if (partFilter.length > 0) {
                    partTerms = filterCLS.ARRAY_MENU_ASSOCIATE_PART.filter((val) => { return val.ASSOCIATE_PART_CD == item.ASSOCIATE_PART_CD});

                    if (partTerms.length > 0) {
                        partName = filterCLS.getPartRootPartPeplace(partTerms[0].PART_CD, " " + partTerms[0].PART_NM);
                    }

                    partList = filterCLS.ARRAY_MENU_ASSOCIATE_INFO.filter((val) => { return val.ASSOCIATE_PART_CD == item.ASSOCIATE_PART_CD && val.FILE_TYPE_CD == item.FILE_TYPE_CD && val.GUBUN_CD == item.GUBUN_CD });
                }

                let html = filterCLS.getAssociateGroupingAndEpisode(partList, partName);
                parentPartID = "#ASSOCIATE_PART_" + item.ASSOCIATE_PART_CD;

                if (isValueEmpty(html) == false) {
                    jQuery(parentPartID).append(html);
                }
            }
        });
    },
    setAssociateVodContentByPart : function(vodList) {
        if (menuCLS.getMenuContentTemplateVodCD() == menuCLS.TEMPLATE_VOD_CD.단원형) {
            let partCD = "";
            let parentPartID = "";
            let partName = "";
            let partTerms = new Array();

            jQuery.each(vodList, function (i, item) {
                let itemPartCD = item.ASSOCIATE_PART_CD;
                if (partCD != itemPartCD) {
                    partCD = itemPartCD;

                    let vodPartList = new Array();

                    partTerms = filterCLS.ARRAY_MENU_ASSOCIATE_PART.filter((val) => { return val.ASSOCIATE_PART_CD == item.ASSOCIATE_PART_CD});

                    if (partTerms.length > 0) {
                        partName = filterCLS.getPartRootPartPeplace(partTerms[0].PART_CD, " " + partTerms[0].PART_NM);
                    }

                    vodPartList = vodList.filter((val) => { return val.ASSOCIATE_PART_CD == item.ASSOCIATE_PART_CD; });

                    let html = filterCLS.getAssociateVodContentByPart(vodPartList, partName);
                    parentPartID = "#ASSOCIATE_PART_" + item.ASSOCIATE_PART_CD;

                    if (isValueEmpty(html) == false) {
                        jQuery(parentPartID).append(html);
                    }
                }
            });
        }
    },
    setVodPart: function() {
        let partCD = "";
        let parentPartID = "";
        let partName = "";
        let partTerms = new Array();

        jQuery.each(filterCLS.ARRAY_MENU_VOD, function (i, item) {
            let itemPartCD = item.ROOT_PART_CD;
            if (partCD != itemPartCD) {
                partCD = itemPartCD;
                let vodPartList = new Array();

                switch (filterCLS.PART_USE_CD) {
                    case commonCLS.PART_USE_CD.루트파트까지사용.CD:
                        partTerms = filterCLS.ARRAY_MENU_PART.filter((val) => { return val.ROOT_PART_CD == item.ROOT_PART_CD});

                        if (partTerms.length > 0) {
                            partName = filterCLS.getPartRootPartPeplace(partTerms[0].ROOT_PART_CD, " " + partTerms[0].ROOT_PART_NM);
                        }

                        vodPartList = filterCLS.ARRAY_MENU_VOD.filter((val) => { return val.LEVEL_CD == item.LEVEL_CD && val.EXPAPR_GROUP_CD == item.EXPAPR_GROUP_CD && val.EXPAPR_CORETYPE_CD == item.EXPAPR_CORETYPE_CD && val.ROOT_PART_CD == item.ROOT_PART_CD; });

                        if (isArrayInValue(["000010000700004"], commonGLB.getMenuCD())) {
                            parentPartID = "PART_CD_" + item.CHAPTER_EG_PART + item.ROOT_PART_CD;
                        } else {
                            parentPartID = "PART_CD_" + item.ROOT_PART_CD;
                        }
                        break;
                }

                let html = filterCLS.getVodContentByPart(vodPartList, partName);

                jQuery("#" + parentPartID).append(html);
                //VOD_ui_updater.setUI();
                previousPartID = parentPartID;
                previousPartNm = partName;
            }
        });
    },
    getExamContentGrouping: function (partList, partNm, beforePartItemID) {
        let html = "";
        let date = new Date();
        let tipLabel = "";
        let targetYearLabel = date.getFullYear();
        let semesterLabel = "";
        let levelLabel = "";
        let titleLabel = "";
        let subTitleLabel = "";
        let label = "";
        let vodConceptList = Array();

        if (isValueEmpty(beforePartItemID)) {
            vodConceptList = filterCLS.ARRAY_MENU_VOD.filter((val) => { return val.VOD_TYPE == "CONCEPT"});    
        } else {
            vodConceptList = filterCLS.ARRAY_MENU_BEFORE_VOD.filter((val) => { return val.VOD_TYPE == "CONCEPT"});    
        }

        jQuery.each(partList, function (i, item) {
            let levelCD = Number(item.EXPAPR_LEVEL_CD);          

            // 컨셉 영상
            if ((i == 0 && partList.length > 1) || (i == 0 && item.VOD_TYPE == "CONCEPT")) {
                levelLabel = menuCLS.getMenuByLevelNm(levelCD);
                if (isValueEmpty(levelLabel) == false) {
                    if ("000020000700001" == commonGLB.getMenuCD()) {
                        titleLabel = templateReplace(jQuery("#hidden-exam-item-grouping-title-template").html(), [levelLabel, ""]);
                    } else {
                        label = filterCLS.getLevelLabel(levelCD);
                        levelLabel = templateReplace(jQuery("#hidden-exam-item-grouping-sub-title-template").html(), [levelLabel]);
                        titleLabel = templateReplace(jQuery("#hidden-exam-item-grouping-title-template").html(), [partNm, levelLabel]);
                    }
                } else {
                    if (isValueEmpty(item.EXPAPR_CORETYPE_NAME_BY_FILTER) == false) {
                        subTitleLabel = templateReplace(jQuery("#hidden-exam-item-grouping-sub-title-template").html(), [item.EXPAPR_CORETYPE_NAME_BY_FILTER]);
                    } else {
                        subTitleLabel = ""
                    }
                    label = filterCLS.getLevelLabel(levelCD);
                    titleLabel = templateReplace(jQuery("#hidden-exam-item-grouping-title-template").html(), [partNm, subTitleLabel]);
                }
            }

            if (item.EXPAPR_TIP == "Y") tipLabel = jQuery("#hidden-exam-badge-tip-span-template").html();

            if (menuCLS.IsSoopring(commonGLB.getMenuCD()) && isArrayInValue(["000020000800006", "000020000800005"], commonGLB.getMenuCD()) == false) { // 부교재 변형 > 빠른독해 바른독해,수프링 > 부교재 변형 >THE 상승
                if ((isArrayInValue(["000020000700001"], commonGLB.getMenuCD()) && levelCD == 10)) {
                    semesterLabel = "<span class='badge is-tertiary'>" + (Number(item.EXPAPR_TESTYEAR) + 1) + "</span>";
                } else if (isArrayInValue(["000020000800001"], commonGLB.getMenuCD())){ 
                    semesterLabel = "<span class='badge is-tertiary'>" + (Number(item.EXPAPR_TESTYEAR) + 1) + "학년도</span>";
                } else {
                    semesterLabel = "<span class='badge is-tertiary'>" + item.EXPAPR_TESTYEAR + "</span>";
                }
            } else {
                semesterLabel = filterCLS.getSemesterLabel(item.EXPAPR_ADD_ATTR2);
            }

            let beforeExams = "15개정";
            if (!isValueEmpty(beforePartItemID)) {
                semesterLabel = templateReplace(jQuery("#hidden-exam-badge-unify-template").html(), [beforeExams]);
            }

            let vodTypeClass = filterCLS.getVodClassName(item.VOD_TYPE);

            //복합형
            if (menuCLS.getMenuContentTemplateVodCD() == menuCLS.TEMPLATE_VOD_CD.복합형 && typeof(item.VOD_NO) != "undefined" ? true : false) {
                if (partList.length > 1) {
                    html += templateReplace(jQuery("#hidden-vod-exam-item-grouping-item-template").html(), [2, item.EXPAPR_NO, item.VOD_NO, item.APP_GROUP_TEXT, 0, vodTypeClass]);
                } else {
                    levelLabel = menuCLS.getMenuByLevelNm(levelCD);
                    label = filterCLS.getLevelLabel(levelCD);

                    if (isValueEmpty(levelLabel) == false) {
                        levelLabel = templateReplace(jQuery("#hidden-exam-item-grouping-sub-title-template").html(), [levelLabel]);
                        html += templateReplace(jQuery("#hidden-vod-exam-item-grouping-single-item-template").html(), [2, item.EXPAPR_NO,item.VOD_NO, partNm, 0, levelLabel, vodTypeClass]);
                    } else {
                        if (isValueEmpty(item.EXPAPR_CORETYPE_NAME_BY_FILTER) == false && isArrayInValue(["000020001200001", "000020001200002"], commonGLB.getMenuCD()) == false) {
                            subTitleLabel = templateReplace(jQuery("#hidden-exam-item-grouping-sub-title-template").html(), [item.EXPAPR_CORETYPE_NAME_BY_FILTER]);
                        } else {
                            subTitleLabel = ""
                        }

                        html += templateReplace(jQuery("#hidden-vod-exam-item-grouping-single-item-template").html(), [2, item.EXPAPR_NO, item.VOD_NO, partNm, 0, subTitleLabel, vodTypeClass]);
                    }
                }
            // 개념 + 풀이복합형
            } else if (menuCLS.getMenuContentTemplateVodCD() == menuCLS.TEMPLATE_VOD_CD.개념단원형_풀이복합형 && typeof(item.VOD_NO) != "undefined" ? true : false) {
                if (partList.length > 1 && item.VOD_TYPE =="TWEEZERS") {
                    html += templateReplace(jQuery("#hidden-vod-exam-item-grouping-item-template").html(), [2, item.EXPAPR_NO, item.VOD_NO, item.APP_GROUP_TEXT.replace(/^\(\d+\)\s*/g, ''), 0, vodTypeClass]);
                } else {
                    levelLabel = menuCLS.getMenuByLevelNm(levelCD);
                    label = filterCLS.getLevelLabel(levelCD);

                    if (item.VOD_TYPE =="CONCEPT") {
                        if (isValueEmpty(beforePartItemID)) {
                            vodConceptList = filterCLS.ARRAY_MENU_VOD.filter((val) => { return val.EXPAPR_NO == item.EXPAPR_NO && val.VOD_TYPE == item.VOD_TYPE});
                        } else {
                            vodConceptList = filterCLS.ARRAY_MENU_BEFORE_VOD.filter((val) => { return val.EXPAPR_NO == item.EXPAPR_NO && val.VOD_TYPE == item.VOD_TYPE});
                        }

                        html += templateReplace(jQuery("#hidden-exam-item-grouping-item-template").html(), [item.EXPAPR_NO, item.APP_GROUP_TEXT, 0, (item.ROOT_PART_CD + "-" + item.SUB_PART_CD + "-" + item.DETAIL_PART_CD), item.EXPAPR_LEVEL_CD, partList.length, beforeExams, item.EXPAPR_TESTYEAR]);
                        if (vodConceptList.length > 1) {
                            jQuery.each(vodConceptList, function (i, vodItem) {
                                html += templateReplace(jQuery("#hidden-vod-item-part-item-template").html(), [vodItem.VOD_NO, vodItem.DETAIL_TITLE]);
                            });
                        } else {
                            jQuery.each(vodConceptList, function (i, vodItem) {
                                html += templateReplace(jQuery("#hidden-vod-item-part-item-template").html(), [vodItem.VOD_NO, vodItem.DETAIL_TITLE]);
                            });
                        }

                    } else {
                        if (isValueEmpty(levelLabel) == false) {
                            levelLabel = templateReplace(jQuery("#hidden-exam-item-grouping-sub-title-template").html(), [levelLabel]);
                            html += templateReplace(jQuery("#hidden-vod-exam-item-grouping-single-item-template").html(), [2, item.EXPAPR_NO, item.VOD_NO, partNm, 0, levelLabel, vodTypeClass]);
                        } else {
                            if (isValueEmpty(item.EXPAPR_CORETYPE_NAME_BY_FILTER) == false) {
                                subTitleLabel = templateReplace(jQuery("#hidden-exam-item-grouping-sub-title-template").html(), [item.EXPAPR_CORETYPE_NAME_BY_FILTER]);
                            } else {
                                subTitleLabel = ""
                            }

                            html += templateReplace(jQuery("#hidden-vod-exam-item-grouping-single-item-template").html(), [2, item.EXPAPR_NO, item.VOD_NO, partNm, 0, subTitleLabel, vodTypeClass]);
                        }
                    }
                }
            } else {
                if (partList.length > 1) {
                    if (isArrayInValue(["000010000300008", "000020000300008"], commonGLB.getMenuCD())) {
                        html += templateReplace(jQuery("#hidden-exam-item-grouping-item-template").html(), [item.EXPAPR_NO, item.EXPAPR_ADD_ATTR3, 0, (item.ROOT_PART_CD + "-" + item.SUB_PART_CD + "-" + item.DETAIL_PART_CD), item.EXPAPR_LEVEL_CD, partList.length, beforeExams, item.EXPAPR_TESTYEAR]);
                    } else {
                        html += templateReplace(jQuery("#hidden-exam-item-grouping-item-template").html(), [item.EXPAPR_NO, item.APP_GROUP_TEXT.replace(/^\(\d+\)\s*/g, ''), 0, (item.ROOT_PART_CD + "-" + item.SUB_PART_CD + "-" + item.DETAIL_PART_CD), item.EXPAPR_LEVEL_CD, partList.length, beforeExams, item.EXPAPR_TESTYEAR]);
                    }
                } else {
                    if ("000020000800003" == commonGLB.getMenuCD()) {
                       levelLabel = menuCLS.getMenuByLevelNm(commonGLB.getLevelCD());
                    } else {
                       levelLabel = menuCLS.getMenuByLevelNm(levelCD);
                    }

                    if (((commonGLB.getSubjectCD() == "KR" && commonGLB.getSiteID() == "H" && !isValueEmpty(beforePartItemID)) || (commonGLB.getSubjectCD() == "KR" && commonGLB.getSiteID() == "M" && commonGLB.getGrade() == 3)) || (isArrayInValue(["000030000100001", "000040000100001"], commonGLB.getMenuCD()) && commonGLB.getSubjectCD() == "KR")) {
                        if (item.APP_GROUP_TEXT.includes("step1")) {
                            levelLabel = "이해전략";
                        } else if (item.APP_GROUP_TEXT.includes("step2")) {
                            levelLabel = "풀이전략";
                        } else {
                            levelLabel = "대표유형";
                        }
                    }

                    if (isValueEmpty(levelLabel) == false) {
                        if ("000020000700001" == commonGLB.getMenuCD()) {
                            html += templateReplace(jQuery("#hidden-exam-item-grouping-single-item-template").html(), [item.EXPAPR_NO, menuCLS.getMenuByLevelNm(levelCD), 0, "", (item.ROOT_PART_CD + "-" + item.SUB_PART_CD + "-" + item.DETAIL_PART_CD), item.EXPAPR_LEVEL_CD, beforeExams, item.EXPAPR_TESTYEAR]);
                        } else {
                            levelLabel = templateReplace(jQuery("#hidden-exam-item-grouping-sub-title-template").html(), [levelLabel]);
                            label = filterCLS.getLevelLabel(levelCD);
                            html += templateReplace(jQuery("#hidden-exam-item-grouping-single-item-template").html(), [item.EXPAPR_NO, partNm, 0, levelLabel, (item.ROOT_PART_CD + "-" + item.SUB_PART_CD + "-" + item.DETAIL_PART_CD), item.EXPAPR_LEVEL_CD, beforeExams, item.EXPAPR_TESTYEAR]);
                        }
                    } else {
                        label = filterCLS.getLevelLabel(levelCD);
                        if (isValueEmpty(item.EXPAPR_CORETYPE_NAME_BY_FILTER) == false) {
                            subTitleLabel = templateReplace(jQuery("#hidden-exam-item-grouping-sub-title-template").html(), [item.EXPAPR_CORETYPE_NAME_BY_FILTER]);
                        } else {
                            subTitleLabel = ""
                        }
                        html += templateReplace(jQuery("#hidden-exam-item-grouping-single-item-template").html(), [item.EXPAPR_NO, partNm, 0, subTitleLabel, (item.ROOT_PART_CD + "-" + item.SUB_PART_CD + "-" + item.DETAIL_PART_CD), item.EXPAPR_LEVEL_CD, beforeExams, item.EXPAPR_TESTYEAR]);
                    }
                }
            }
        });

        return templateReplace(jQuery("#hidden-exam-item-grouping-main-template").html(), [tipLabel, targetYearLabel, semesterLabel, titleLabel, html, label]);
    },
    getExamContentGroupingV2: function (partList, partNm, beforePartItemID) {
        // 1. 템플릿 캐싱 (루프 밖에서 한번만)
        const tpl = {
            groupingItem: jQuery("#hidden-exam-item-grouping-item-template").html(),
            groupingMain: jQuery("#hidden-exam-item-grouping-main-template").html(),
            groupingSingle: jQuery("#hidden-exam-item-grouping-single-item-template").html(),
            groupingTitle: jQuery("#hidden-exam-item-grouping-title-template").html(),
            groupingSubTitle: jQuery("#hidden-exam-item-grouping-sub-title-template").html(),
            tipSpan: jQuery("#hidden-exam-badge-tip-span-template").html(),
            mixGradeLabel: jQuery("#hidden-exam-item-grouping-episode-mix-main-grade-label-template").html(),
            unify: jQuery("#hidden-exam-badge-unify-v2-template").html(),
            vodExamGroupingItem: jQuery("#hidden-vod-exam-item-grouping-item-template").html(),
            vodExamGroupingSingle: jQuery("#hidden-vod-exam-item-grouping-single-item-template").html(),
            vodPartItem: jQuery("#hidden-vod-item-part-item-template").html()
        };

        // 2. 반복 호출 값 캐싱
        const htmlParts = [];
        const date = new Date();
        const targetYearLabel = date.getFullYear();
        let tipLabel = "";
        let semesterLabel = "";
        let levelLabel = "";
        let titleLabel = "";
        let subTitleLabel = "";
        let label = "";
        
        const hasBefore = !isValueEmpty(beforePartItemID);
        const menuCD = commonGLB.getMenuCD();
        const subjectCD = commonGLB.getSubjectCD();
        const siteID = commonGLB.getSiteID();
        const grade = commonGLB.getGrade();
        const templateVodCD = menuCLS.getMenuContentTemplateVodCD();
        const isSoopring = menuCLS.IsSoopring(menuCD);
        const partListLen = partList.length;

        let vodConceptList;
        if (hasBefore) {
            vodConceptList = filterCLS.ARRAY_MENU_BEFORE_VOD.filter(function (val) { return val.VOD_TYPE == "CONCEPT"; });
        } else {
            vodConceptList = filterCLS.ARRAY_MENU_VOD.filter(function (val) { return val.VOD_TYPE == "CONCEPT"; });
        }

        partList.forEach(function (item, i) {
            let levelCD = Number(item.EXPAPR_LEVEL_CD);

            // 컨셉 영상
            if ((i == 0 && partListLen > 1) || (i == 0 && item.VOD_TYPE == "CONCEPT")) {
                levelLabel = menuCLS.getMenuByLevelNm(levelCD);
                if (!isValueEmpty(levelLabel)) {
                    if ("000020000700001" == menuCD) {
                        titleLabel = templateReplace(tpl.groupingTitle, [levelLabel, ""]);
                    } else {
                        label = filterCLS.getLevelLabel(levelCD);
                        levelLabel = templateReplace(tpl.groupingSubTitle, [levelLabel]);
                        titleLabel = templateReplace(tpl.groupingTitle, [partNm, levelLabel]);
                    }
                } else {
                    if (!isValueEmpty(item.EXPAPR_CORETYPE_NAME_BY_FILTER)) {
                        subTitleLabel = templateReplace(tpl.groupingSubTitle, [item.EXPAPR_CORETYPE_NAME_BY_FILTER]);
                    } else {
                        subTitleLabel = "";
                    }
                    label = filterCLS.getLevelLabel(levelCD);
                    titleLabel = templateReplace(tpl.groupingTitle, [partNm, subTitleLabel]);
                }
            }
            if (item.EXPAPR_TIP == "Y") tipLabel = tpl.tipSpan;
            
            if (isSoopring && !isArrayInValue(["000020000800006", "000020000800005"], menuCD)) {
                if (isArrayInValue(["000020000700001"], menuCD) && levelCD == 10) {
                    semesterLabel = "<span class='badge is-tertiary'>" + (Number(item.EXPAPR_TESTYEAR) + 1) + "</span>";
                } else if (isArrayInValue(["000020000700001"], menuCD) && levelCD == 0 && commonGLB.getSubjectCD() == "EG") {
                    semesterLabel = "<span class='badge is-tertiary'>" + item.EXPAPR_TESTYEAR + "</span>" + "<span class='badge is-tertiary'>워크북</span>" ;
                } else {
                    semesterLabel = "<span class='badge is-tertiary'>" + item.EXPAPR_TESTYEAR + "</span>";
                }
            } else {
                semesterLabel = filterCLS.getSemesterLabel(item.EXPAPR_ADD_ATTR2);
            }

            let vodTypeClass = filterCLS.getVodClassName(item.VOD_TYPE);
            
            let beforeExams = "";
            let beforeExparTestYearHtml = "";
            if (hasBefore) {
                beforeExams = "15개정";
                if (isArrayInValue([2025, 2026], Number(item.EXPAPR_TESTYEAR))) {
                    beforeExparTestYearHtml = templateReplace(tpl.mixGradeLabel, [item.EXPAPR_TESTYEAR]);
                }
                semesterLabel = templateReplace(tpl.unify, [beforeExams, beforeExparTestYearHtml]);
            }

            const partKey = item.ROOT_PART_CD + "-" + item.SUB_PART_CD + "-" + item.DETAIL_PART_CD;
            // 복합형
            if (templateVodCD == menuCLS.TEMPLATE_VOD_CD.복합형 && typeof (item.VOD_NO) != "undefined" ? true : false) {
                if (partListLen > 1) {
                    htmlParts.push(templateReplace(tpl.vodExamGroupingItem, [2, item.EXPAPR_NO, item.VOD_NO, item.APP_GROUP_TEXT, 0, vodTypeClass]));
                } else {
                    levelLabel = menuCLS.getMenuByLevelNm(levelCD);
                    label = filterCLS.getLevelLabel(levelCD);

                    if (!isValueEmpty(levelLabel)) {
                        levelLabel = templateReplace(tpl.groupingSubTitle, [levelLabel]);
                        htmlParts.push(templateReplace(tpl.vodExamGroupingSingle, [2, item.EXPAPR_NO, item.VOD_NO, partNm, 0, levelLabel, vodTypeClass]));
                    } else {
                        if (!isValueEmpty(item.EXPAPR_CORETYPE_NAME_BY_FILTER) && !isArrayInValue(["000020001200001", "000020001200002"], menuCD)) {
                            subTitleLabel = templateReplace(tpl.groupingSubTitle, [item.EXPAPR_CORETYPE_NAME_BY_FILTER]);
                        } else {
                            subTitleLabel = "";
                        }
                        htmlParts.push(templateReplace(tpl.vodExamGroupingSingle, [2, item.EXPAPR_NO, item.VOD_NO, partNm, 0, subTitleLabel, vodTypeClass]));
                    }
                }
            // 개념 + 풀이복합형
            } else if (templateVodCD == menuCLS.TEMPLATE_VOD_CD.개념단원형_풀이복합형 && typeof (item.VOD_NO) != "undefined" ? true : false) {
                if (partListLen > 1 && item.VOD_TYPE == "TWEEZERS") {
                    htmlParts.push(templateReplace(tpl.vodExamGroupingItem, [2, item.EXPAPR_NO, item.VOD_NO, item.APP_GROUP_TEXT.replace(/^\(\d+\)\s*/g, ''), 0, vodTypeClass]));
                } else {
                    levelLabel = menuCLS.getMenuByLevelNm(levelCD);
                    label = filterCLS.getLevelLabel(levelCD);

                    if (item.VOD_TYPE == "CONCEPT") {
                        if (!hasBefore) {
                            vodConceptList = filterCLS.ARRAY_MENU_VOD.filter(function (val) { return val.EXPAPR_NO == item.EXPAPR_NO && val.VOD_TYPE == item.VOD_TYPE; });
                        } else {
                            vodConceptList = filterCLS.ARRAY_MENU_BEFORE_VOD.filter(function (val) { return val.EXPAPR_NO == item.EXPAPR_NO && val.VOD_TYPE == item.VOD_TYPE; });
                        }

                        htmlParts.push(templateReplace(tpl.groupingItem, [item.EXPAPR_NO, item.APP_GROUP_TEXT, 0, partKey, item.EXPAPR_LEVEL_CD, partListLen, beforeExams, item.EXPAPR_TESTYEAR]));

                        vodConceptList.forEach(function (vodItem) {
                            htmlParts.push(templateReplace(tpl.vodPartItem, [vodItem.VOD_NO, vodItem.DETAIL_TITLE]));
                        });

                    } else {
                        if (!isValueEmpty(levelLabel)) {
                            levelLabel = templateReplace(tpl.groupingSubTitle, [levelLabel]);
                            htmlParts.push(templateReplace(tpl.vodExamGroupingSingle, [2, item.EXPAPR_NO, item.VOD_NO, partNm, 0, levelLabel, vodTypeClass]));
                        } else {
                            if (!isValueEmpty(item.EXPAPR_CORETYPE_NAME_BY_FILTER)) {
                                subTitleLabel = templateReplace(tpl.groupingSubTitle, [item.EXPAPR_CORETYPE_NAME_BY_FILTER]);
                            } else {
                                subTitleLabel = "";
                            }
                            htmlParts.push(templateReplace(tpl.vodExamGroupingSingle, [2, item.EXPAPR_NO, item.VOD_NO, partNm, 0, subTitleLabel, vodTypeClass]));
                        }
                    }
                }
            } else {
                if (partListLen > 1) {
                    if (isArrayInValue(["000010000300008", "000020000300008"], menuCD)) {
                        htmlParts.push(templateReplace(tpl.groupingItem, [item.EXPAPR_NO, item.EXPAPR_ADD_ATTR3, 0, partKey, item.EXPAPR_LEVEL_CD, partListLen, beforeExams, item.EXPAPR_TESTYEAR]));
                    } else {
                        htmlParts.push(templateReplace(tpl.groupingItem, [item.EXPAPR_NO, item.APP_GROUP_TEXT.replace(/^\(\d+\)\s*/g, ''), 0, partKey, item.EXPAPR_LEVEL_CD, partListLen, beforeExams, item.EXPAPR_TESTYEAR]));
                    }
                } else {
                    if ("000020000800003" == menuCD) {
                        levelLabel = menuCLS.getMenuByLevelNm(commonGLB.getLevelCD());
                    } else {
                        levelLabel = menuCLS.getMenuByLevelNm(levelCD);
                    }

                    if (((subjectCD == "KR" && siteID == "H" && hasBefore) || (subjectCD == "KR" && siteID == "M" && grade == 3)) || (isArrayInValue(["000030000100001", "000040000100001"], menuCD) && subjectCD == "KR")) {
                        if (item.APP_GROUP_TEXT.includes("step1")) {
                            levelLabel = "이해전략";
                        } else if (item.APP_GROUP_TEXT.includes("step2")) {
                            levelLabel = "풀이전략";
                        } else {
                            levelLabel = "대표유형";
                        }
                    }

                    if (!isValueEmpty(levelLabel)) {
                        if ("000020000700001" == menuCD) {
                            htmlParts.push(templateReplace(tpl.groupingSingle, [item.EXPAPR_NO, menuCLS.getMenuByLevelNm(levelCD), 0, "", partKey, item.EXPAPR_LEVEL_CD, beforeExams, item.EXPAPR_TESTYEAR]));
                        } else {
                            levelLabel = templateReplace(tpl.groupingSubTitle, [levelLabel]);
                            label = filterCLS.getLevelLabel(levelCD);
                            htmlParts.push(templateReplace(tpl.groupingSingle, [item.EXPAPR_NO, partNm, 0, levelLabel, partKey, item.EXPAPR_LEVEL_CD, beforeExams, item.EXPAPR_TESTYEAR]));
                        }
                    } else {
                        label = filterCLS.getLevelLabel(levelCD);
                        if (!isValueEmpty(item.EXPAPR_CORETYPE_NAME_BY_FILTER)) {
                            subTitleLabel = templateReplace(tpl.groupingSubTitle, [item.EXPAPR_CORETYPE_NAME_BY_FILTER]);
                        } else {
                            subTitleLabel = "";
                        }
                        htmlParts.push(templateReplace(tpl.groupingSingle, [item.EXPAPR_NO, partNm, 0, subTitleLabel, partKey, item.EXPAPR_LEVEL_CD, beforeExams, item.EXPAPR_TESTYEAR]));
                    }
                }
            }
        });
        return templateReplace(tpl.groupingMain, [tipLabel, targetYearLabel, semesterLabel, titleLabel, htmlParts.join(''), label]);
    },
    getExamContentEpisode: function (partList, partNm, beforePartItemID) {
        let html = "";
        let date = new Date();
        let tipLabel = "";
        let targetYearLabel = date.getFullYear();
        let semesterLabel = "";
        let titleLabel = "";
        let subTitle = "";

        jQuery.each(partList, function (i, item) {
            if (item.EXPAPR_TIP == "Y") tipLabel = jQuery("#hidden-exam-badge-tip-span-template").html();
            if (menuCLS.IsSoopring(commonGLB.getMenuCD())) {
                semesterLabel = item.EXPAPR_TESTYEAR;
            } else {
                semesterLabel = filterCLS.getSemesterLabel(item.EXPAPR_ADD_ATTR2);
            }

            let beforeExams = "";
            let beforeExparTestYearHtml = "";
            if (!isValueEmpty(beforePartItemID)) {
                beforeExams = "15개정";
                if (isArrayInValue([2025, 2026], Number(item.EXPAPR_TESTYEAR))) {
                    beforeExparTestYearHtml = templateReplace(jQuery("#hidden-exam-item-grouping-episode-mix-main-grade-label-template").html(), [item.EXPAPR_TESTYEAR]);
                }
                semesterLabel = templateReplace(jQuery("#hidden-exam-badge-unify-template").html(), [beforeExams, beforeExparTestYearHtml]);
            } else {
                beforeExams = "";
                semesterLabel = filterCLS.getSemesterLabel(item.EXPAPR_ADD_ATTR2);
            }

            let reDownLoadClass = "";
            if (isValueEmpty(item.EXPAPR_CORETYPE_NAME) == false) {
                subTitle = templateReplace(jQuery("#hidden-exam-item-grouping-sub-title-template").html(), [item.EXPAPR_CORETYPE_NAME]);
            }
            titleLabel = templateReplace(jQuery("#hidden-exam-item-grouping-title-template").html(), [partNm, subTitle]);

            let episodeName = item.EXAM_EPISODE;

            if (!isValueEmpty(item.PAGE_RANGE)) {
                episodeName = item.EXAM_EPISODE + item.PAGE_RANGE;
            }

            html += templateReplace(jQuery("#hidden-exam-item-episode-item-template").html(), [reDownLoadClass, item.EXPAPR_NO, filterCLS.getExamEpisodeTitle(episodeName, item.KR_GUBUN_GROUP), 0, 0, (item.ROOT_PART_CD + "-" + item.SUB_PART_CD + "-" + item.DETAIL_PART_CD), item.EXPAPR_LEVEL_CD, partList.length, beforeExams, item.EXPAPR_TESTYEAR]);
        });
        return templateReplace(jQuery("#hidden-exam-item-episode-main-template").html(), [tipLabel, targetYearLabel, semesterLabel, titleLabel, html, "", ""]);
    },
    getExamContentEpisodeV2: function (partList, partNm, beforePartItemID) {
        // 1. 템플릿 캐싱
        const tpl = {
            tipSpan: jQuery("#hidden-exam-badge-tip-span-template").html(),
            mixGradeLabel: jQuery("#hidden-exam-item-grouping-episode-mix-main-grade-label-template").html(),
            unify: jQuery("#hidden-exam-badge-unify-v2-template").html(),
            subTitle: jQuery("#hidden-exam-item-grouping-sub-title-template").html(),
            title: jQuery("#hidden-exam-item-grouping-title-template").html(),
            episodeItem: jQuery("#hidden-exam-item-episode-item-template").html(),
            episodeMain: jQuery("#hidden-exam-item-episode-main-template").html()
        };

        // 2. 반복 호출 값 캐싱
        const htmlParts = [];
        const targetYearLabel = new Date().getFullYear();
        const hasBefore = !isValueEmpty(beforePartItemID);
        const menuCD = commonGLB.getMenuCD();
        const isSoopring = menuCLS.IsSoopring(menuCD);
        const partListLen = partList.length;

        let tipLabel = "";
        let semesterLabel = "";
        let titleLabel = "";
        let subTitle = "";

        partList.forEach(function (item, i) {
            if (item.EXPAPR_TIP == "Y") tipLabel = tpl.tipSpan;

            if (isSoopring) {
                semesterLabel = item.EXPAPR_TESTYEAR;
            } else {
                semesterLabel = filterCLS.getSemesterLabel(item.EXPAPR_ADD_ATTR2);
            }

            let beforeExams = "";
            let beforeExparTestYearHtml = "";
            if (hasBefore) {
                beforeExams = "15개정";
                if (isArrayInValue([2025, 2026], Number(item.EXPAPR_TESTYEAR))) {
                    beforeExparTestYearHtml = templateReplace(tpl.mixGradeLabel, [item.EXPAPR_TESTYEAR]);
                }
                semesterLabel = templateReplace(tpl.unify, [beforeExams, beforeExparTestYearHtml]);
            } else {
                beforeExams = "";
                semesterLabel = filterCLS.getSemesterLabel(item.EXPAPR_ADD_ATTR2);
            }

            let reDownLoadClass = "";
            if (!isValueEmpty(item.EXPAPR_CORETYPE_NAME)) {
                subTitle = templateReplace(tpl.subTitle, [item.EXPAPR_CORETYPE_NAME]);
            }

            titleLabel = templateReplace(tpl.title, [partNm, subTitle]);

            let episodeName = item.EXAM_EPISODE;
            if (!isValueEmpty(item.PAGE_RANGE)) {
                episodeName = item.EXAM_EPISODE + item.PAGE_RANGE;
            }

            htmlParts.push(templateReplace(tpl.episodeItem, [
                reDownLoadClass, item.EXPAPR_NO,
                filterCLS.getExamEpisodeTitle(episodeName, item.KR_GUBUN_GROUP),
                0, 0,
                (item.ROOT_PART_CD + "-" + item.SUB_PART_CD + "-" + item.DETAIL_PART_CD),
                item.EXPAPR_LEVEL_CD, partListLen, beforeExams, item.EXPAPR_TESTYEAR
            ]));
        });

        return templateReplace(tpl.episodeMain, [tipLabel, targetYearLabel, semesterLabel, titleLabel, htmlParts.join(''), "", ""]);
    },
    getExamContentGroupingByCreate: function (partList, partNm, beforePartItemID) {
        let html = "";
        let date = new Date();
        let tipLabel = "";
        let stepLabel = "STEP 1";
        let semesterLabel = "";
        let levelLabel = "";
        let titleLabel = "";
        jQuery.each(partList, function (i, item) {
            if (jQuery.inArray(item.EXPAPR_CORETYPE_CD, Array('A', 'B')) > -1) {
                if (item.EXPAPR_CORETYPE_CD == "A" || (item.EXPAPR_CORETYPE_CD == "B" && item.EXPAPR_SITEID == "H" && item.EXPAPR_GRADE == "2" && jQuery.inArray(item.EXPAPR_SUBJECT_CD, Array('KR', 'EG', 'MT')) > -1) || (item.EXPAPR_CORETYPE_CD == "B" && item.EXPAPR_PUB_NAME == '창비(이도영)' && item.EXPAPR_SITEID == "M" && jQuery.inArray(item.EXPAPR_GRADE, Array('2', '3')) > -1 && item.EXPAPR_SUBJECT_CD == "KR")) { //고2 국/영/수 중2/중3 출판사
                    stepLabel = "STEP 1";
                } else if (item.EXPAPR_CORETYPE_CD == "B") {
                    stepLabel = "STEP 2";
                }
                levelLabel = templateReplace(jQuery("#hidden-exam-item-grouping-sub-title-template").html(), [item.EXPAPR_CORETYPE_NAME_BY_FILTER]);
            } else if (item.EXPAPR_GROUP_CD == "P" && item.EXPAPR_SUBJECT_CD =="MT" && jQuery.inArray(item.EXPAPR_CORETYPE_CD, Array('B1', 'B2', 'B3', 'B4', 'B5', 'B6')) > -1) { //수학 Master 중/고등 공통
                levelLabel = templateReplace(jQuery("#hidden-exam-item-grouping-sub-title-template").html(), [item.EXPAPR_CORETYPE_NAME_BY_FILTER]);
                stepLabel = filterCLS.getStepLabel(item.EXPAPR_LEVEL_CD);
            } else {
                stepLabel = "STEP 1";
                levelLabel = templateReplace(jQuery("#hidden-exam-item-grouping-sub-title-template").html(), ["암기노트"]);
            }

			if (isArrayInValue(menuCLS.ARRAY_PREPARATION_MENU_CD, commonGLB.getMenuCD())) {
				stepLabel = filterCLS.getPreparationStepLabel(item.EXPAPR_CORETYPE_NAME_BY_FILTER);
			}
			
            if (i == 0 && partList.length > 1) {
                titleLabel = templateReplace(jQuery("#hidden-exam-item-grouping-title-template").html(), [partNm, levelLabel]);
            }
            if (item.EXPAPR_TIP == "Y") tipLabel = jQuery("#hidden-exam-badge-tip-span-template").html();
            semesterLabel = filterCLS.getSemesterLabel(item.EXPAPR_ADD_ATTR2);

            let beforeExams = "";
            let beforeExparTestYearHtml = "";
            if (!isValueEmpty(beforePartItemID)) {
                beforeExams = "15개정";
                if (isArrayInValue([2025, 2026], Number(item.EXPAPR_TESTYEAR))) {
                    beforeExparTestYearHtml = templateReplace(jQuery("#hidden-exam-item-grouping-episode-mix-main-grade-label-template").html(), [item.EXPAPR_TESTYEAR]);
                }
                semesterLabel = templateReplace(jQuery("#hidden-exam-badge-unify-template").html(), [beforeExams, beforeExparTestYearHtml]);
            } else {
                beforeExams = "";
                semesterLabel = filterCLS.getSemesterLabel(item.EXPAPR_ADD_ATTR2);
            }

            if (menuCLS.getMenuContentTemplateVodCD() == menuCLS.TEMPLATE_VOD_CD.복합형 && typeof(item.VOD_NO) != "undefined" ? true : false) {
                let vodTypeClass = filterCLS.getVodClassName(item.VOD_TYPE);

                if (partList.length > 1) {
                    html += templateReplace(jQuery("#hidden-vod-exam-item-grouping-item-template").html(), [2, item.EXPAPR_NO, item.VOD_NO, item.APP_GROUP_TEXT.replace(/^\(\d+\)\s*/g, ''), 0, vodTypeClass]);
                } else {
                    html += templateReplace(jQuery("#hidden-vod-exam-item-grouping-single-item-template").html(), [2, item.EXPAPR_NO, item.VOD_NO, partNm, 0, levelLabel, vodTypeClass]);
                }
            } else {
                if (partList.length > 1) {
                    html += templateReplace(jQuery("#hidden-exam-item-grouping-item-template").html(), [item.EXPAPR_NO, item.APP_GROUP_TEXT.replace(/^\(\d+\)\s*/g, ''), 0, (item.ROOT_PART_CD + "-" + item.SUB_PART_CD + "-" + item.DETAIL_PART_CD), item.EXPAPR_LEVEL_CD, partList.length, beforeExams, item.EXPAPR_TESTYEAR]);
                } else {
                    html += templateReplace(jQuery("#hidden-exam-item-grouping-single-item-template").html(), [item.EXPAPR_NO, partNm, 0, levelLabel, (item.ROOT_PART_CD + "-" + item.SUB_PART_CD + "-" + item.DETAIL_PART_CD), item.EXPAPR_LEVEL_CD, beforeExams, item.EXPAPR_TESTYEAR]);
                }
            }
        });
        return templateReplace(jQuery("#hidden-exam-item-grouping-create-main-template").html(), [tipLabel, stepLabel, semesterLabel, titleLabel, html]);
    },
    getExamContentGroupingByCreateV2: function (partList, partNm, beforePartItemID) {
        // 1. 템플릿 캐싱
        const tpl = {
            subTitle: jQuery("#hidden-exam-item-grouping-sub-title-template").html(),
            title: jQuery("#hidden-exam-item-grouping-title-template").html(),
            tipSpan: jQuery("#hidden-exam-badge-tip-span-template").html(),
            mixGradeLabel: jQuery("#hidden-exam-item-grouping-episode-mix-main-grade-label-template").html(),
            unify: jQuery("#hidden-exam-badge-unify-v2-template").html(),
            vodGroupingItem: jQuery("#hidden-vod-exam-item-grouping-item-template").html(),
            vodGroupingSingle: jQuery("#hidden-vod-exam-item-grouping-single-item-template").html(),
            groupingItem: jQuery("#hidden-exam-item-grouping-item-template").html(),
            groupingSingle: jQuery("#hidden-exam-item-grouping-single-item-template").html(),
            createMain: jQuery("#hidden-exam-item-grouping-create-main-template").html()
        };

        // 2. 반복 호출 값 캐싱
        const htmlParts = [];
        const hasBefore = !isValueEmpty(beforePartItemID);
        const menuCD = commonGLB.getMenuCD();
        const isPreparation = isArrayInValue(menuCLS.ARRAY_PREPARATION_MENU_CD, menuCD);
        const templateVodCD = menuCLS.getMenuContentTemplateVodCD();
        const partListLen = partList.length;
        const coreTypeCdAB = ['A', 'B'];
        const coreTypeCdBx = ['B1', 'B2', 'B3', 'B4', 'B5', 'B6'];

        let tipLabel = "";
        let stepLabel = "STEP 1";
        let semesterLabel = "";
        let levelLabel = "";
        let titleLabel = "";

        partList.forEach(function (item, i) {
            if (jQuery.inArray(item.EXPAPR_CORETYPE_CD, coreTypeCdAB) > -1) {
                if (item.EXPAPR_CORETYPE_CD == "A"
                    || (item.EXPAPR_CORETYPE_CD == "B" && item.EXPAPR_SITEID == "H" && item.EXPAPR_GRADE == "2" && jQuery.inArray(item.EXPAPR_SUBJECT_CD, ['KR', 'EG', 'MT']) > -1)
                    || (item.EXPAPR_CORETYPE_CD == "B" && item.EXPAPR_PUB_NAME == '창비(이도영)' && item.EXPAPR_SITEID == "M" && jQuery.inArray(item.EXPAPR_GRADE, ['2', '3']) > -1 && item.EXPAPR_SUBJECT_CD == "KR")) {
                    stepLabel = "STEP 1";
                } else if (item.EXPAPR_CORETYPE_CD == "B") {
                    stepLabel = "STEP 2";
                }
                levelLabel = templateReplace(tpl.subTitle, [item.EXPAPR_CORETYPE_NAME_BY_FILTER]);
            } else if (item.EXPAPR_GROUP_CD == "P" && item.EXPAPR_SUBJECT_CD == "MT" && jQuery.inArray(item.EXPAPR_CORETYPE_CD, coreTypeCdBx) > -1) {
                levelLabel = templateReplace(tpl.subTitle, [item.EXPAPR_CORETYPE_NAME_BY_FILTER]);
                stepLabel = filterCLS.getStepLabel(item.EXPAPR_LEVEL_CD);
            } else {
                stepLabel = "STEP 1";
                levelLabel = templateReplace(tpl.subTitle, ["암기노트"]);
            }

            if (isPreparation) {
                stepLabel = filterCLS.getPreparationStepLabel(item.EXPAPR_CORETYPE_NAME_BY_FILTER);
            }

            if (i == 0 && partListLen > 1) {
                titleLabel = templateReplace(tpl.title, [partNm, levelLabel]);
            }

            if (item.EXPAPR_TIP == "Y") tipLabel = tpl.tipSpan;

            semesterLabel = filterCLS.getSemesterLabel(item.EXPAPR_ADD_ATTR2);

            let beforeExams = "";
            let beforeExparTestYearHtml = "";
            if (hasBefore) {
                beforeExams = "15개정";
                if (isArrayInValue([2025, 2026], Number(item.EXPAPR_TESTYEAR))) {
                    beforeExparTestYearHtml = templateReplace(tpl.mixGradeLabel, [item.EXPAPR_TESTYEAR]);
                }
                semesterLabel = templateReplace(tpl.unify, [beforeExams, beforeExparTestYearHtml]);
            } else {
                beforeExams = "";
                semesterLabel = filterCLS.getSemesterLabel(item.EXPAPR_ADD_ATTR2);
            }

            const partKey = item.ROOT_PART_CD + "-" + item.SUB_PART_CD + "-" + item.DETAIL_PART_CD;

            if (templateVodCD == menuCLS.TEMPLATE_VOD_CD.복합형 && typeof (item.VOD_NO) != "undefined" ? true : false) {
                let vodTypeClass = filterCLS.getVodClassName(item.VOD_TYPE);

                if (partListLen > 1) {
                    htmlParts.push(templateReplace(tpl.vodGroupingItem, [2, item.EXPAPR_NO, item.VOD_NO, item.APP_GROUP_TEXT.replace(/^\(\d+\)\s*/g, ''), 0, vodTypeClass]));
                } else {
                    htmlParts.push(templateReplace(tpl.vodGroupingSingle, [2, item.EXPAPR_NO, item.VOD_NO, partNm, 0, levelLabel, vodTypeClass]));
                }
            } else {
                if (partListLen > 1) {
                    htmlParts.push(templateReplace(tpl.groupingItem, [item.EXPAPR_NO, item.APP_GROUP_TEXT.replace(/^\(\d+\)\s*/g, ''), 0, partKey, item.EXPAPR_LEVEL_CD, partListLen, beforeExams, item.EXPAPR_TESTYEAR]));
                } else {
                    htmlParts.push(templateReplace(tpl.groupingSingle, [item.EXPAPR_NO, partNm, 0, levelLabel, partKey, item.EXPAPR_LEVEL_CD, beforeExams, item.EXPAPR_TESTYEAR]));
                }
            }
        });

        return templateReplace(tpl.createMain, [tipLabel, stepLabel, semesterLabel, titleLabel, htmlParts.join('')]);
    },
    getExamContentAiEpisode: function (partList, partNm) {
        let html = "";
        let date = new Date();
        let tipLabel = "";
        let targetYearLabel = date.getFullYear();
        let semesterLabel = "";
        let label = "";
        let coreTpyelabel = "";
        let titleLabel = "";
        jQuery.each(partList, function (i, item) {
            if (i == 0) {
                if (item.EXPAPR_TIP == "Y") {
                    tipLabel = jQuery("#hidden-exam-badge-tip-span-template").html();
                }
                semesterLabel = filterCLS.getSemesterLabel(item.EXPAPR_ADD_ATTR2);

                if (isValueEmpty(item.AI_EXPAPR_CORETYPE_NAME) == false) {
                    coreTpyelabel = templateReplace(jQuery("#hidden-exam-item-grouping-sub-title-template").html(), [item.AI_EXPAPR_CORETYPE_NAME]);
                }
                label = filterCLS.getLevelLabel(item.EXPAPR_LEVEL_CD);
                titleLabel = templateReplace(jQuery("#hidden-exam-item-grouping-title-template").html(), [partNm, coreTpyelabel]);
            }

            let tipClass = item.EXPAPR_TIP == "Y" ? "is-tip" : "";
            let itemCount = isValueEmpty(item.AI_STATIC_EXPAPR_NO) == false ? item.AI_STATIC_EXPAPR_NO.split(',').length + 1 : 1;
            if (item.EXPAPR_LEVEL_CD == 4) {
                html += templateReplace(jQuery("#hidden-exam-item-episode-item-template").html(), [tipClass, item.EXPAPR_NO, "대표 (" + item.EXAM_EPISODE + ")", 0, 0, (item.ROOT_PART_CD + "-" + item.SUB_PART_CD + "-" + item.DETAIL_PART_CD), item.EXPAPR_LEVEL_CD, itemCount, "", item.EXPAPR_TESTYEAR]);
            } else {
                html += templateReplace(jQuery("#hidden-exam-item-episode-item-template").html(), [tipClass, item.EXPAPR_NO, item.EXAM_EPISODE, 0, 0, (item.ROOT_PART_CD + "-" + item.SUB_PART_CD + "-" + item.DETAIL_PART_CD), item.EXPAPR_LEVEL_CD, itemCount, "", item.EXPAPR_TESTYEAR]);
            }

            // if (isValueEmpty(item.AI_STATIC_EXPAPR_NO) == false) {
            //     html += filterCLS.getExamContentAiStatic(item.AI_STATIC_EXPAPR_NO.split(','), item.EXPAPR_NO, (item.ROOT_PART_CD + "-" + item.SUB_PART_CD + "-" + item.DETAIL_PART_CD), item.EXPAPR_LEVEL_CD);
            // }
        });
        return templateReplace(jQuery("#hidden-exam-item-episode-main-template").html(), [tipLabel, targetYearLabel, semesterLabel, titleLabel, html, label, ""]);
    },
    getExamContentPartEpisode: function (partList, partNm, beforePartItemID) {
        let html = "";
        let date = new Date();
        let tipLabel = "";
        let targetYearLabel = date.getFullYear();
        let semesterLabel = "";
        let label = "";
        let coreTpyelabel = "";
        let titleLabel = "";
        let titleName = "";

        jQuery.each(partList, function (i, item) {
            let beforeExams = "";
            let beforeExparTestYearHtml = "";
            if (!isValueEmpty(beforePartItemID)) {
                beforeExams = "15개정";
                if (isArrayInValue([2025, 2026], Number(item.EXPAPR_TESTYEAR))) {
                    beforeExparTestYearHtml = templateReplace(jQuery("#hidden-exam-item-grouping-episode-mix-main-grade-label-template").html(), [item.EXPAPR_TESTYEAR]);
                }
                semesterLabel = templateReplace(jQuery("#hidden-exam-badge-unify-template").html(), [beforeExams, beforeExparTestYearHtml]);
            } else {
                beforeExams = "";
                semesterLabel = filterCLS.getSemesterLabel(item.EXPAPR_ADD_ATTR2);
            }
                 
            if (i == 0) {
                if (item.EXPAPR_TIP == "Y") {
                    tipLabel = jQuery("#hidden-exam-badge-tip-span-template").html();
                }



                if (isValueEmpty(item.AI_EXPAPR_CORETYPE_NAME) == false) {
                    coreTpyelabel = templateReplace(jQuery("#hidden-exam-item-grouping-sub-title-template").html(), [item.AI_EXPAPR_CORETYPE_NAME]);
                }

                if (commonGLB.getSubjectCD() == "KR" && item.EXPAPR_GROUP_CD == "C")
                {
                    if (item.SUB_PART_CD == 99) {
                        label = "<span class='subunit__text is-septenary'>대단원 학습</span>"
                    } else {
                        label = "<span class='subunit__text is-senary'>중단원 학습</span>"
                    }
                } else {
                    label = filterCLS.getLevelLabel(item.EXPAPR_LEVEL_CD);
                }
                titleLabel = templateReplace(jQuery("#hidden-exam-item-grouping-title-template").html(), [partNm, coreTpyelabel]);
            }

            let tipClass = item.EXPAPR_TIP == "Y" ? "is-tip" : "";
            let itemCount = isValueEmpty(item.AI_STATIC_EXPAPR_NO) == false ? item.AI_STATIC_EXPAPR_NO.split(',').length + 1 : 1;

            if (commonGLB.getSubjectCD() == "EG" && item.EXPAPR_GROUP_CD == "C") {
                titleName = filterCLS.getEgQuestionNumName(item.STARTNUM, item.ENDNUM);
            } else {
                let episodeName = item.EXAM_EPISODE;

                if (!isValueEmpty(item.PAGE_RANGE)) {
                    episodeName = item.EXAM_EPISODE + item.PAGE_RANGE;
                }

                titleName = episodeName
            }

            html += templateReplace(jQuery("#hidden-exam-item-episode-item-template").html(), [tipClass, item.EXPAPR_NO, titleName, 0, 0, (item.ROOT_PART_CD + "-" + item.SUB_PART_CD + "-" + item.DETAIL_PART_CD), item.EXPAPR_LEVEL_CD, itemCount]);
        });

        return templateReplace(jQuery("#hidden-exam-item-episode-main-template").html(), [tipLabel, targetYearLabel, semesterLabel, titleLabel, html, label]);
    },
    getExamContentPartEpisodeV2: function (partList, partNm, beforePartItemID) {
        const episodeItemTpl = jQuery("#hidden-exam-item-episode-item-template").html();
        const episodeMainTpl = jQuery("#hidden-exam-item-episode-main-template").html();
        const tipSpanTpl = jQuery("#hidden-exam-badge-tip-span-template").html();
        const subTitleTpl = jQuery("#hidden-exam-item-grouping-sub-title-template").html();
        const titleTpl = jQuery("#hidden-exam-item-grouping-title-template").html();
        const mixGradeLabelTpl = jQuery("#hidden-exam-item-grouping-episode-mix-main-grade-label-template").html();
        const unifyTpl = jQuery("#hidden-exam-badge-unify-v2-template").html();

        const htmlParts = [];
        const date = new Date();
        const targetYearLabel = date.getFullYear();
        let tipLabel = "";
        let semesterLabel = "";
        let label = "";
        let titleLabel = "";
        
        const hasBefore = !isValueEmpty(beforePartItemID);
        const subjectCD = commonGLB.getSubjectCD();

        partList.forEach(function (item, i) {
            let beforeExams = "";
            
            if (hasBefore) {
                let beforeExparTestYearHtml = "";
                if (item.EXPAPR_TESTYEAR == "2025" || item.EXPAPR_TESTYEAR == "2026") {
                    beforeExparTestYearHtml = templateReplace(mixGradeLabelTpl, [item.EXPAPR_TESTYEAR]);
                }
                semesterLabel = templateReplace(unifyTpl, ["15개정", beforeExparTestYearHtml]);
                beforeExams = "15개정";
            } else if (i === 0) {
                semesterLabel = filterCLS.getSemesterLabel(partList[0].EXPAPR_ADD_ATTR2);
            }

            if (i === 0) {
                tipLabel = item.EXPAPR_TIP === "Y" ? tipSpanTpl : "";
                let coreTpyelabel = "";
                if (!isValueEmpty(item.AI_EXPAPR_CORETYPE_NAME)) {
                    coreTpyelabel = templateReplace(subTitleTpl, [item.AI_EXPAPR_CORETYPE_NAME]);
                }
                if (subjectCD === "KR" && item.EXPAPR_GROUP_CD === "C") {
                    label = item.SUB_PART_CD == 99
                        ? "<span class='subunit__text is-septenary'>대단원 학습</span>"
                        : "<span class='subunit__text is-senary'>중단원 학습</span>";
                } else {
                    label = filterCLS.getLevelLabel(item.EXPAPR_LEVEL_CD);
                }
                titleLabel = templateReplace(titleTpl, [partNm, coreTpyelabel]);
            }

            const tipClass = item.EXPAPR_TIP === "Y" ? "is-tip" : "";
            const itemCount = !isValueEmpty(item.AI_STATIC_EXPAPR_NO)
                ? item.AI_STATIC_EXPAPR_NO.split(',').length + 1
                : 1;

            let titleName;
            if (subjectCD === "EG" && item.EXPAPR_GROUP_CD === "C") {
                titleName = filterCLS.getEgQuestionNumName(item.STARTNUM, item.ENDNUM);
            } else {
                titleName = isValueEmpty(item.PAGE_RANGE)
                    ? item.EXAM_EPISODE
                    : item.EXAM_EPISODE + item.PAGE_RANGE;
            }

            htmlParts.push(templateReplace(episodeItemTpl, [
                tipClass, item.EXPAPR_NO, titleName, 0, 0,
                (item.ROOT_PART_CD + "-" + item.SUB_PART_CD + "-" + item.DETAIL_PART_CD),
                item.EXPAPR_LEVEL_CD, itemCount, beforeExams, item.EXPAPR_TESTYEAR
            ]));
        });

        return templateReplace(episodeMainTpl, [
            tipLabel, targetYearLabel, semesterLabel, titleLabel, htmlParts.join(''), label
        ]);
    },
    getExamContentGroupingAndEpisode : function (partList, partNm) {
        let html = "";
        let tipLabel = "";
        let titleLabel = "";
        let subTitle = "";
        let subTitleLabel = "";
        let subLabelName = "";
        let subLabel = "";
        let semesterLabel = "";
        let gradeLabel = "";
        let isEpisode = partList.length > 1; //두개 이상일 경우 회차별로 표시

        jQuery.each(partList, function (i, item) {
            if (item.EXPAPR_TIP == "Y") tipLabel = jQuery("#hidden-exam-badge-tip-span-template").html();
            semesterLabel = filterCLS.getSemesterLabel(item.EXPAPR_ADD_ATTR2);

            if (isValueEmpty(item.EG_GUBUN_GROUP) == false) { //영문법, 구문독해 난이도 표시
                subTitle = filterCLS.getEgGubunGroupLabel(item.EG_GUBUN_GROUP);
                subLabelName = filterCLS.getStepLabel(item.EG_GUBUN_GROUP);
            };

            if (isArrayInValue(filterCLS.KOREAN_PART_HANDLING_MENU_LIST, commonGLB.getMenuCD())) { // 갈래별, 시대별 년도 표시
                if (isValueEmpty(item.EXPAPR_CORETYPE_NAME_BY_FILTER) == false) {
                    subTitle = item.EXPAPR_CORETYPE_NAME_BY_FILTER;
                }

                if (isArrayInValue(["D3", "R1", "R2", "R3", "R4", "R5", "R6"], item.EXPAPR_CORETYPE_CD)) {
                    subLabelName = item.EXPAPR_ADD_ATTR1;
                }

                if (Number(item.EXPAPR_GRADE) == 0) {
                    let gradeName = "전학년";
                    gradeLabel = templateReplace(jQuery("#hidden-exam-item-grouping-episode-mix-main-grade-label-template").html(), [gradeName]);
                }
            };

            if (isValueEmpty(subLabelName) == false) {
                subLabel = templateReplace(jQuery("#hidden-exam-item-grouping-episode-mix-main-sub-label-template").html(), [subLabelName]);
            };

            if (isValueEmpty(subTitle) == false) {
                subTitleLabel = templateReplace(jQuery("#hidden-exam-item-grouping-sub-title-template").html(), [subTitle]);
            };

            if (isEpisode) {
                let episodeName = "";
                let reDownLoadClass = "";
                titleLabel = templateReplace(jQuery("#hidden-exam-item-grouping-title-template").html(), [partNm, subTitleLabel]);
                if (isValueEmpty(item.EG_GUBUN_GROUP) == false && isValueEmpty(item.EXPAPR_CORETYPE_NAME_BY_FILTER) == false) {
                    episodeName = item.EXPAPR_CORETYPE_NAME_BY_FILTER;
                } else {
                    episodeName = filterCLS.getExamEpisodeTitle(item.EXAM_EPISODE, item.KR_GUBUN_GROUP);
                }
                html += templateReplace(jQuery("#hidden-exam-item-episode-item-template").html(), [reDownLoadClass, item.EXPAPR_NO, episodeName, 0, 0, (item.ROOT_PART_CD + "-" + item.SUB_PART_CD + "-" + item.DETAIL_PART_CD), item.EXPAPR_LEVEL_CD, partList.length, "", item.EXPAPR_TESTYEAR]);
            } else {
                if (menuCLS.getMenuContentTemplateVodCD() == menuCLS.TEMPLATE_VOD_CD.복합형 && typeof(item.VOD_NO) != "undefined" ? true : false) {
                    let vodTypeClass = filterCLS.getVodClassName(item.VOD_TYPE);

                    html += templateReplace(jQuery("#hidden-vod-exam-item-grouping-single-item-template").html(), [2, item.EXPAPR_NO, item.VOD_NO, partNm, 0, subTitleLabel, vodTypeClass]);
                } else {
                    html += templateReplace(jQuery("#hidden-exam-item-grouping-single-item-template").html(), [item.EXPAPR_NO, partNm, 0, subTitleLabel, (item.ROOT_PART_CD + "-" + item.SUB_PART_CD + "-" + item.DETAIL_PART_CD), item.EXPAPR_LEVEL_CD, "", item.EXPAPR_TESTYEAR, "", item.EXPAPR_TESTYEAR]);
                }
            }
        });

        if (isEpisode) {
            return templateReplace(jQuery("#hidden-exam-item-episode-mix-main-template").html(), [tipLabel, titleLabel, html, subLabel, semesterLabel, gradeLabel]);
        } else {
            return templateReplace(jQuery("#hidden-exam-item-grouping-mix-main-template").html(), [tipLabel, titleLabel, html, subLabel, semesterLabel, gradeLabel]);
        }
    },
    getAssociateGroupingAndEpisode : function (partList, partNm) { // 연계 템플릿
        let html = "";
        let tipLabel = "";
        let titleLabel = "";
        let subTitle = "";
        let subTitleLabel = "";
        let stepLabel = ""; //스텝 표시
        let episodeTitle = "";
        let isEpisode = partList.length > 1;

        jQuery.each(partList, function (i, item) {
            if (isValueEmpty(item.GUBUN_CD) == false) {
                subTitle = filterCLS.getEgGubunGroupLabel(item.GUBUN_CD);
                stepLabel = filterCLS.getStepLabel(item.GUBUN_CD);
            };

            subTitleLabel = templateReplace(jQuery("#hidden-exam-item-grouping-sub-title-template").html(), [subTitle]);

            if (isValueEmpty(stepLabel) == false) {
                stepLabel = templateReplace(jQuery("#hidden-exam-item-grouping-episode-mix-main-sub-label-template").html(), [stepLabel]);
            };

            if (isEpisode) {
                let reDownLoadClass = "";
                titleLabel = templateReplace(jQuery("#hidden-exam-item-grouping-title-template").html(), [partNm, subTitleLabel]);
                episodeTitle = filterCLS.getEpisodeNameByNumber(i);
                html += templateReplace(jQuery("#hidden-exam-item-episode-item-template").html(), [reDownLoadClass, item.ASSOCIATE_FILE_CD, episodeTitle, 0, 0, (item.ROOT_PART_CD + "-" + item.SUB_PART_CD + "-" + item.DETAIL_PART_CD), 0, partList.length, "", item.EXPAPR_TESTYEAR]);
            } else {
                if (menuCLS.getMenuContentTemplateVodCD() == menuCLS.TEMPLATE_VOD_CD.복합형 && typeof(item.VOD_NO) != "undefined" ? true : false) {
                    let vodTypeClass = filterCLS.getVodClassName(item.VOD_TYPE);

                    html += templateReplace(jQuery("#hidden-vod-exam-item-grouping-single-item-template").html(), [2, item.EXPAPR_NO, item.VOD_NO, partNm, 0, subTitleLabel, vodTypeClass]);
                } else {
                    html += templateReplace(jQuery("#hidden-exam-item-grouping-single-item-template").html(), [item.ASSOCIATE_FILE_CD, partNm, 0, subTitleLabel, (item.ROOT_PART_CD + "-" + item.SUB_PART_CD + "-" + item.DETAIL_PART_CD), 0, "", item.EXPAPR_TESTYEAR]);
                }
            }
        });

        if(isEpisode) {
            return templateReplace(jQuery("#hidden-exam-item-episode-mix-main-template").html(), [tipLabel, titleLabel, html, stepLabel, "" , ""]);
        } else {
            return templateReplace(jQuery("#hidden-exam-item-grouping-mix-main-template").html(), [tipLabel, titleLabel, html, stepLabel, "", ""]);
        }
    },
    getVodContentByPart : function (vodPartList, partNm) {
        let html = "";
        let titleLabel = "";
        let subTitle = "";
        let subTitleLabel = "";

        jQuery.each(vodPartList, function (i, item) {
            if (item.VOD_TYPE  == "MID_ENG") {
                subTitle = "개념영상";
            }

            subTitleLabel = templateReplace(jQuery("#hidden-vod-item-part-sub-title-template").html(), [subTitle]);
            titleLabel = templateReplace(jQuery("#hidden-vod-item-part-title-template").html(), [partNm, subTitleLabel]);
            html += templateReplace(jQuery("#hidden-vod-item-part-item-template").html(), [item.VOD_NO, item.DETAIL_TITLE.replace(/^\(\d+\)\s*/g, '')]);
        });

        return templateReplace(jQuery("#hidden-vod-item-part-main-template").html(), [titleLabel, html]);
    },
    getAssociateVodContentByPart : function (vodPartList, partNm) {
        let html = "";
        let titleLabel = "";
        let subTitle = "개념영상";
        let subTitleLabel = "";

        jQuery.each(vodPartList, function (i, item) {
            subTitleLabel = templateReplace(jQuery("#hidden-vod-item-part-sub-title-template").html(), [subTitle]);
            titleLabel = templateReplace(jQuery("#hidden-vod-item-part-title-template").html(), [partNm, subTitleLabel]);
            html += templateReplace(jQuery("#hidden-vod-item-part-item-template").html(), [item.ASSOCIATE_FILE_CD, item.TITLE.replace(/^\(\d+\)\s*/g, '')]);
        });

        return templateReplace(jQuery("#hidden-vod-item-part-main-template").html(), [titleLabel, html]);
    },
    getExamContentAiStatic : function (arrayStaticExpaprNo, representativeExpaprNo, partCD, levelCD) {
        let html = "";
        jQuery.each(arrayStaticExpaprNo, function (i, expaprNo) {
            let title = "0" + (i + 1) + "회";
            html += templateReplace(jQuery("#hidden-exam-item-episode-item-template").html(), ["", expaprNo, title, 1, representativeExpaprNo, partCD, levelCD, arrayStaticExpaprNo.length + 1, "", item.EXPAPR_TESTYEAR]);
        });
        return html;
    },
    getLevelLabel: function (levelCD) {
        let label = "";

        if (isArrayInValue(filterCLS.LEVEL_CD_HANDLING_MENU_LIST, commonGLB.getMenuCD())) {
            switch (Number(levelCD)) {
                case 1:
                    label = "<span class='subunit__text is-primary'>기초</span>";
                    break;
                case 2:
                    label = "<span class='subunit__text is-secondary'>기본</span>";
                    break;
                case 3:
                    label = "<span class='subunit__text is-tertiary'>발전</span>";
                    break;
            }
        }

        if(isArrayInValue(filterCLS.LEVEL_CD_HANDLING_MENU_LIST, commonGLB.getMenuCD())) {
            switch (levelCD) {
                case 1:
                    label = "<span class='subunit__text is-primary'>개념 & 확인</span>";
                    break;
                case 2:
                    label = "<span class='subunit__text is-secondary'>기본</span>";
                    break;
                case 3:
                    label = "<span class='subunit__text is-tertiary'>발전</span>";
                    break;
                case 4:
                    label = "<span class='subunit__text is-quinary'>심화</span>";
            }
        }

        if(isArrayInValue(["000020001000002"], commonGLB.getMenuCD())) {
            switch (levelCD) {
                case 1:
                    label = "<span class='subunit__text is-primary'>개념완성</span>";
                    break;
                case 2:
                    label = "<span class='subunit__text is-secondary'>다시보기</span>";
                    break;
                case 3:
                    label = "<span class='subunit__text is-tertiary'>미리보기</span>";
                    break;
            }
        }

        if(isArrayInValue(["000020001100002"], commonGLB.getMenuCD())) {
            switch (levelCD) {
                case 1:
                    label = "<div class='download__badge'><span class='subunit__text is-secondary'>주제별</span></div>";
                    break;
                case 3:
                    label = "<div class='download__badge'><span class='subunit__text is-secondary'>기본</span></div>";
                    break;
                case 4:
                    label = "<div class='download__badge'><span class='subunit__text is-tertiary'>완성</span></div>";
                    break;
                case 5:
                    label = "<div class='download__badge'><span class='subunit__text is-secondary'>필수 어휘</span></div>";
                    break;
                case 6:
                    label = "<div class='download__badge'><span class='subunit__text is-secondary'>학평 필수</span></div>";
                    break;
            }
        }

        return label;
    },
    getPartRootPartPeplace: function (rootPartCD, partNm) {
        switch (Number(rootPartCD)) {
            case 101:
                partNm = "1." + partNm;
                break;
            case 102:
                partNm = "2." + partNm;
                break;
            case 103:
                partNm = "3." + partNm;
                break;
            case 104:
                partNm = "4." + partNm;
                break;
            case 105:
                partNm = "5." + partNm;
                break;
            case 106:
                partNm = "6." + partNm;
                break;
            case 107:
                partNm = "7." + partNm;
                break;
            case 108:
                partNm = "8." + partNm;
                break;
            case 109:
                partNm = "9." + partNm;
                break;
            case 110:
                partNm = "10." + partNm;
                break;
            case 111:
                partNm = "11." + partNm;
                break;
            case 112:
                partNm = "12." + partNm;
                break;
            case 113:
                partNm = "13." + partNm;
                break;
            case 114:
                partNm = "14." + partNm;
                break;
            case 115:
                partNm = "15." + partNm;
                break;
            case 116:
                partNm = "16." + partNm;
                break;
            case 117:
                partNm = "17." + partNm;
                break;
            case 118:
                partNm = "18." + partNm;
                break;
            case 119:
                partNm = "19." + partNm;
                break;
            case 120:
                partNm = "20." + partNm;
                break;
            case 121:
                partNm = "21." + partNm;
                break;
            case 122:
                partNm = "22." + partNm;
                break;
            case 123:
                partNm = "23." + partNm;
                break;
            case 124:
                partNm = "24." + partNm;
                break;
            case 125:
                partNm = "25." + partNm;
                break;
            case 126:
                partNm = "26." + partNm;
                break;
            case 127:
                partNm = "27." + partNm;
                break;
            case 128:
                partNm = "28." + partNm;
                break;
            case 129:
                partNm = "29." + partNm;
                break;
            case 130:
                partNm = "30." + partNm;
                break;
            case 131:
                partNm = "31." + partNm;
                break;
            case 132:
                partNm = "32." + partNm;
                break;
            case 133:
                partNm = "33." + partNm;
                break;
            case 134:
                partNm = "34." + partNm;
                break;
            case 135:
                partNm = "35." + partNm;
                break;
            case 136:
                partNm = "36." + partNm;
                break;
            case 137:
                partNm = "37." + partNm;
                break;
            case 138:
                partNm = "38." + partNm;
                break;
            case 139:
                partNm = "39." + partNm;
                break;
            case 140:
                partNm = "40." + partNm;
                break;

            case 201:
                partNm = "1." + partNm;
                break;
            case 202:
                partNm = "2." + partNm;
                break;
            case 203:
                partNm = "3." + partNm;
                break;
            case 204:
                partNm = "4." + partNm;
                break;
            case 205:
                partNm = "5." + partNm;
                break;
            case 206:
                partNm = "6." + partNm;
                break;
            case 207:
                partNm = "7." + partNm;
                break;
            case 208:
                partNm = "8." + partNm;
                break;
            case 209:
                partNm = "9." + partNm;
                break;
            case 210:
                partNm = "10." + partNm;
                break;
            case 211:
                partNm = "11." + partNm;
                break;
            case 212:
                partNm = "12." + partNm;
                break;
            case 213:
                partNm = "13." + partNm;
                break;
            case 214:
                partNm = "14." + partNm;
                break;
            case 215:
                partNm = "15." + partNm;
                break;
            case 216:
                partNm = "16." + partNm;
                break;
            case 217:
                partNm = "17." + partNm;
                break;
            case 218:
                partNm = "18." + partNm;
                break;
            case 219:
                partNm = "19." + partNm;
                break;
            case 220:
                partNm = "20." + partNm;
                break;
        }
        return partNm;
    },
    getPartSubPartPeplace: function (rootPartCD, subPartCD, partNm) {
        switch (Number(rootPartCD)) {
            case 101:
                partNm = "1-" + subPartCD + "." + partNm;
                break;
            case 102:
                partNm = "2-" + subPartCD + "." + partNm;
                break;
            case 103:
                partNm = "3-" + subPartCD + "." + partNm;
                break;
            case 104:
                partNm = "4-" + subPartCD + "." + partNm;
                break;
            case 105:
                partNm = "5-" + subPartCD + "." + partNm;
                break;
            case 106:
                partNm = "6-" + subPartCD + "." + partNm;
                break;
            case 107:
                partNm = "7-" + subPartCD + "." + partNm;
                break;
            case 108:
                partNm = "8-" + subPartCD + "." + partNm;
                break;
            case 109:
                partNm = "9-" + subPartCD + "." + partNm;
                break;
            case 110:
                partNm = "10-" + subPartCD + "." + partNm;
                break;
            case 111:
                partNm = "11-" + subPartCD + "." + partNm;
                break;
            case 112:
                partNm = "12-" + subPartCD + "." + partNm;
                break;
            case 113:
                partNm = "13-" + subPartCD + "." + partNm;
                break;
            case 114:
                partNm = "14-" + subPartCD + "." + partNm;
                break;
            case 115:
                partNm = "15-" + subPartCD + "." + partNm;
                break;
            case 116:
                partNm = "16-" + subPartCD + "." + partNm;
                break;
            case 117:
                partNm = "17-" + subPartCD + "." + partNm;
                break;
            case 118:
                partNm = "18-" + subPartCD + "." + partNm;
                break;
            case 119:
                partNm = "19-" + subPartCD + "." + partNm;
                break;
            case 120:
                partNm = "20-" + subPartCD + "." + partNm;
                break;
            case 201:
                partNm = "1-" + subPartCD + "." + partNm;
                break;
            case 202:
                partNm = "2-" + subPartCD + "." + partNm;
                break;
            case 203:
                partNm = "3-" + subPartCD + "." + partNm;
                break;
            case 204:
                partNm = "4-" + subPartCD + "." + partNm;
                break;
            case 205:
                partNm = "5-" + subPartCD + "." + partNm;
                break;
            case 206:
                partNm = "6-" + subPartCD + "." + partNm;
                break;
            case 207:
                partNm = "7-" + subPartCD + "." + partNm;
                break;
            case 208:
                partNm = "8-" + subPartCD + "." + partNm;
                break;
            case 209:
                partNm = "9-" + subPartCD + "." + partNm;
                break;
            case 210:
                partNm = "10-" + subPartCD + "." + partNm;
                break;
            case 211:
                partNm = "11-" + subPartCD + "." + partNm;
                break;
            case 212:
                partNm = "12-" + subPartCD + "." + partNm;
                break;
            case 213:
                partNm = "13-" + subPartCD + "." + partNm;
                break;
            case 214:
                partNm = "14-" + subPartCD + "." + partNm;
                break;
            case 215:
                partNm = "15-" + subPartCD + "." + partNm;
                break;
            case 216:
                partNm = "16-" + subPartCD + "." + partNm;
                break;
            case 217:
                partNm = "17-" + subPartCD + "." + partNm;
                break;
            case 218:
                partNm = "18-" + subPartCD + "." + partNm;
                break;
            case 219:
                partNm = "19-" + subPartCD + "." + partNm;
                break;
            case 220:
                partNm = "20-" + subPartCD + "." + partNm;
                break;
        }
        return partNm;
    },
    getExamPartSubPartPeplace: function (rootPartCD, partNm) {
        switch (Number(rootPartCD)) {
            case 101:
                partNm = "1-" + partNm;
                break;
            case 102:
                partNm = "2-" + partNm;
                break;
            case 103:
                partNm = "3-" + partNm;
                break;
            case 104:
                partNm = "4-" + partNm;
                break;
            case 105:
                partNm = "5-" + partNm;
                break;
            case 106:
                partNm = "6-" + partNm;
                break;
            case 107:
                partNm = "7-" + partNm;
                break;
            case 108:
                partNm = "8-" + partNm;
                break;
            case 109:
                partNm = "9-" + partNm;
                break;
            case 110:
                partNm = "10-" + partNm;
                break;
            case 111:
                partNm = "11-" + partNm;
                break;
            case 112:
                partNm = "12-" + partNm;
                break;
            case 113:
                partNm = "13-" + partNm;
                break;
            case 114:
                partNm = "14-" + partNm;
                break;
            case 115:
                partNm = "15-" + partNm;
                break;
            case 201:
                partNm = "1-" + partNm;
                break;
            case 202:
                partNm = "2-" + partNm;
                break;
            case 203:
                partNm = "3-" + partNm;
                break;
            case 204:
                partNm = "4-" + partNm;
                break;
            case 205:
                partNm = "5-" + partNm;
                break;
            case 206:
                partNm = "6-" + partNm;
                break;
            case 207:
                partNm = "7-" + partNm;
                break;
            case 208:
                partNm = "8-" + partNm;
                break;
            case 209:
                partNm = "9-" + partNm;
                break;
            case 210:
                partNm = "10-" + partNm;
                break;
            case 211:
                partNm = "11-" + partNm;
                break;
            case 212:
                partNm = "12-" + partNm;
                break;
            case 213:
                partNm = "13-" + partNm;
                break;
            case 214:
                partNm = "14-" + partNm;
                break;
            case 215:
                partNm = "15-" + partNm;
                break;
        }
        return partNm;
    },
    getExamPartDetailPartPeplace: function (rootPartCD, subPartCD, partNm) {
        let returnPartNm = filterCLS.getExamPartSubPartPeplace(rootPartCD, "");

        switch (Number(subPartCD)) {
            case 1:
                partNm = returnPartNm + "1-" + partNm;
                break;
            case 2:
                partNm = returnPartNm + "2-" + partNm;
                break;
            case 3:
                partNm = returnPartNm + "3-" + partNm;
                break;
            case 4:
                partNm = returnPartNm + "4-" + partNm;
                break;
            case 5:
                partNm = returnPartNm + "5-" + partNm;
                break;
            case 6:
                partNm = returnPartNm + "6-" + partNm;
                break;
            case 7:
                partNm = returnPartNm + "7-" + partNm;
                break;
            case 8:
                partNm = returnPartNm + "8-" + partNm;
                break;
            case 9:
                partNm = returnPartNm + "9-" + partNm;
                break;
            case 10:
                partNm = returnPartNm + "10-" + partNm;
                break;
            case 11:
                partNm = returnPartNm + "11-" + partNm;
                break;
            case 12:
                partNm = returnPartNm + "12-" + partNm;
                break;
            case 13:
                partNm = returnPartNm + "13-" + partNm;
                break;
            case 14:
                partNm = returnPartNm + "14-" + partNm;
                break;
            case 15:
                partNm = returnPartNm + "15-" + partNm;
                break;

        }
        return partNm;
    },
    getExamEpisodeTitle: function (episode, krGunbunGroup) {
        let title = episode;
        switch (Number(krGunbunGroup)) {
            case 1:
                title = "A_" + title;
                break;
            case 2:
                title = "B_" + title;
                break;
            case 3:
                title = "C_" + title;
                break;
        }
        return title;
    },
    getTermSpanHTML: function (partItemID, partLevelCD) {
        let termClass = partLevelCD > commonCLS.PART_USE_CD.루트파트까지사용.CD ? " is-primary" : "";
        return templateReplace(jQuery("#hidden-exam-part-term-spen-item-template").html(), [partItemID, termClass]);
    },
    getTermHTML: function (termCD) {
        let html = "";
        switch (termCD) {
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
        return html;
    },
    getExamPartTermBySeason: function (ROOT_PART_CD, SUB_PART_CD) {
        let termCD = "";
        let examPartTerm
        //EDUMIG-9015 중3 기말고사 시즌 표시 예외 처리
        if (commonGLB.getSiteID() == "M" && commonGLB.getGrade() == "3") {
            if (isArrayInValue(menuCLS.ARRAY_PREPARATION_MENU_CD, commonGLB.getMenuCD())) {
                examPartTerm = filterCLS.ARRAY_MENU_EXAM.filter((val) => { return val.ROOT_PART_CD == ROOT_PART_CD && (isValueEmpty(SUB_PART_CD) || val.SUB_PART_CD == SUB_PART_CD) && val.EXAM_TERM == GLB_PREPARATION_SEASON_M3_VAL; });
            } else if (isArrayInValue(menuCLS.ARRAY_UNIT_AND_CONCEPT_MENU_CD, commonGLB.getMenuCD())) {
				examPartTerm = filterCLS.ARRAY_MENU_EXAM.filter((val) => { return val.ROOT_PART_CD == ROOT_PART_CD && (isValueEmpty(SUB_PART_CD) || val.SUB_PART_CD == SUB_PART_CD) && val.EXAM_TERM == GLB_SEASON_UNIT_AND_CONCEPT_VALUE; });
            } else {
                examPartTerm = filterCLS.ARRAY_MENU_EXAM.filter((val) => { return val.ROOT_PART_CD == ROOT_PART_CD && (isValueEmpty(SUB_PART_CD) || val.SUB_PART_CD == SUB_PART_CD) && val.EXAM_TERM == GLB_SEASON_M3_VAL; });
            }
        } else {
            if (isArrayInValue(menuCLS.ARRAY_PREPARATION_MENU_CD, commonGLB.getMenuCD())) {
                examPartTerm = filterCLS.ARRAY_MENU_EXAM.filter((val) => { return val.ROOT_PART_CD == ROOT_PART_CD && (isValueEmpty(SUB_PART_CD) || val.SUB_PART_CD == SUB_PART_CD) && val.EXAM_TERM == GLB_PREPARATION_SEASON_VAL; });
            } else if (isArrayInValue(menuCLS.ARRAY_UNIT_AND_CONCEPT_MENU_CD, commonGLB.getMenuCD())) {
				examPartTerm = filterCLS.ARRAY_MENU_EXAM.filter((val) => { return val.ROOT_PART_CD == ROOT_PART_CD && (isValueEmpty(SUB_PART_CD) || val.SUB_PART_CD == SUB_PART_CD) && val.EXAM_TERM == GLB_SEASON_UNIT_AND_CONCEPT_VALUE; });
            } else {
                examPartTerm = filterCLS.ARRAY_MENU_EXAM.filter((val) => { return val.ROOT_PART_CD == ROOT_PART_CD && (isValueEmpty(SUB_PART_CD) || val.SUB_PART_CD == SUB_PART_CD) && val.EXAM_TERM == GLB_SEASON_VAL; });
            }
        }

        if (examPartTerm.length > 0) {
            termCD = examPartTerm[0].EXAM_TERM;
        }
        return termCD;
    },
    goExamTransferData: function () { //이전 개정 자료
        const oldCodes = ["00003", "00004"];
        const getPrefix = commonGLB.getMenuCD().substring(0, 5);
        let subjectIndex = 2;
        // 이전 개정 메뉴: 00003, 00004
        let oldMenu = oldCodes.includes(getPrefix);

        if (isArrayInValue(["000020000300001", "000020000300002", "000020000300003", "000020000300004"], commonGLB.getMenuCD())) {
            if (commonGLB.getSiteID() == "H") {
                switch (commonGLB.getSubjectCD()) {
                    case "TH":
                        subjectIndex = 6;
                        break;
                }
            }
            link = "/" + commonGLB.getSiteID() + "/?menu=5&oldData=Y&subject=" + subjectIndex + "&grade=" + commonGLB.getGrade();
        } else {
            if (commonGLB.getSiteID() == "M") {
                subjectIndex = commonGLB.getSubjectCD() == "SC" ? 3 : 2;
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
                    case "TH":
                        subjectIndex = 6;
                        break;
                }
            }
            link = "/" + commonGLB.getSiteID() + "/?menu=4&oldData=Y&subject=" + subjectIndex + "&grade=" + commonGLB.getGrade();
        }

        if (oldMenu) {
            trkCLS.setExternalEvent("6R82AQ4ZRKWZO6E3GQZ28FOOR20260223", "");
        } else {
            trkCLS.setExternalEvent("M7UEUXHTKUEU6JX7N1VA3NYDA20260223", "");
        }

		if (TRK_GLB_SERVICE_TYPE_CD == 2) {//모바일웹인 경우
			trkCLS.setExternalEvent("M7UEUXHTKUEU6JX7N1VA3NYDA20260223", "");
			location.href = link;
			return;
		}

        modalCLS.popupOpen("곧 APP에서도 만나요!");
        modalCLS.setBodyContent(jQuery("#hidden-menu-ready-msg-item-template").html());
        modalCLS.setFooter(templateReplace(jQuery("#hidden-menu-ready-msg-button-item-template").html(), [link]));
    },
    goExamTransferChpaterData: function () { //이전 개정 자료
        const oldCodes = ["00003", "00004"];
        const getPrefix = commonGLB.getMenuCD().substring(0, 5);

        let menuCD = "";
        let link = '/exam/examList.asp';
        // 이전 개정 메뉴: 00003, 00004
        let oldMenu = oldCodes.includes(getPrefix);

		switch (commonGLB.getMenuCD()) {
            //단원별 중등 이전
            case "000010000200003" :
                menuCD = "000030000200003";
                break;
            //단원별 고등 이전
            case "000020000200003" :
                menuCD = "000040000200003";
                break;
            //단원별 중등 최신
            case "000030000200003" :
                menuCD = "000010000200003";
                break;
            //단원별 고등 최신
            case "000040000200003" :
                menuCD = "000020000200003";
                break
            //수학마스터 중등 이전
            case "000010000200002" :
                menuCD = "000030000200002";
                break
            //수학마스터 고등 이전
            case "000020000200002" :
                menuCD = "000040000200002";
                break
            //수학마스터 중등 최신
            case "000030000200002" :
                menuCD = "000010000200002";
                break
            //수학마스터 고등 최신
            case "000040000200002" :
                menuCD = "000020000200002";
                break
            //개념완성 이전
			case "000020000100001":
				menuCD = "000040000100001";
				break;
            //개념완성 최신
			case "000040000100001":
				menuCD = "000020000100001";
				break;
            //계산력 이전
			case "000020000100004":
				menuCD = "000040000100004";
				break;
            //계산력 최신
			case "000040000100004":
				menuCD = "000020000100004";
				break;
            //실전대비 서술형 공략 이전
			case "000010000300001":
				menuCD = "000030000300001";
				break;
            //실전대비 서술형 공략 최신
			case "000030000300001":
				menuCD = "000010000300001";
				break;
            //실전대비 최다빈출 공략 이전
			case "000010000300002":
				menuCD = "000030000300002";
				break;
            //실전대비 최다빈출 공략 최신
			case "000030000300002":
				menuCD = "000010000300002";
				break;
            //실전대비 최다오답 공략 이전
			case "000010000300003":
				menuCD = "000030000300003";
				break;
            //실전대비 최다오답 공략 최신
			case "000030000300003":
				menuCD = "000010000300003";
				break;
            //실전대비 최상위 공략 이전
			case "000010000300004":
				menuCD = "000030000300004";
				break;
            //실전대비 최상위 공략 최신
			case "000030000300004":
				menuCD = "000010000300004";
				break;
            //실전대비 교과서 변형 이전
			case "000010000300008":
				menuCD = "000030000300008";
				break;
            //실전대비 교과서 변형 최신
			case "000030000300008":
				menuCD = "000010000300008";
				break;
            //실전대비 서술형 공략 이전
			case "000020000300001":
				menuCD = "000040000300001";
				break;
            //실전대비 서술형 공략 최신
			case "000040000300001":
				menuCD = "000020000300001";
				break;
            //실전대비 최다빈출 공략 이전
			case "000020000300002":
				menuCD = "000040000300002";
				break;
            //실전대비 최다빈출 공략 최신
			case "000040000300002":
				menuCD = "000020000300002";
				break;
            //실전대비 최다오답 공략 이전
			case "000020000300003":
				menuCD = "000040000300003";
				break;
            //실전대비 최다오답 공략 최신
			case "000040000300003":
				menuCD = "000020000300003";
				break;
            //실전대비 최상위 공략 이전
			case "000020000300004":
				menuCD = "000040000300004";
				break;
            //실전대비 최상위 공략 최신
			case "000040000300004":
				menuCD = "000020000300004";
				break;
            //실전대비 교과서 변형 이전
			case "000020000300008":
				menuCD = "000040000300008";
				break;
            //실전대비 교과서 변형 최신
			case "000040000300008":
				menuCD = "000020000300008";
				break;
		}

        commonGLB.setStorage(storage.SEARCH_SITEID, commonGLB.getSiteID());
        commonGLB.setStorage(storage.SEARCH_SUBJECT_CD, commonGLB.getSubjectCD());

        if (oldMenu) {
            trkCLS.setExternalEvent("6R82AQ4ZRKWZO6E3GQZ28FOOR20260223", "");
        } else {
            trkCLS.setExternalEvent("M7UEUXHTKUEU6JX7N1VA3NYDA20260223", "");
        }

		if (TRK_GLB_SERVICE_TYPE_CD == 2) {//모바일웹인 경우
			commonGLB.setStorage(storage.IS_TRANSFER_CHAPTER, "Y");
			location.href = commonCLS.URL.문제리스트 + "?menu_cd=" + menuCD + "&subject_cd=" + commonGLB.getSubjectCD() + "&grade=" + commonGLB.getGrade();
			return;
		}

        menuCLS.goSelectedMenu(1, menuCD, link);
    },
    goExamTransferPartData: function (rootpartCode) { //이전 개정 자료
        //수준별 유형학습
        const menuTargetList = [
            {
                MENU_CD_LIST: ["000010000200001"],
                SUBJECT_CD : "MT",
                PART_CD : 107,
                PART_NM : "7. 기본도형",
                TARGET_PART_CD : 107,
            },
            {
                MENU_CD_LIST: ["000010000200001"],
                SUBJECT_CD : "LS",
                PART_CD : 110,
                PART_NM : "10. 정치 과정과 시민 참여",
                TARGET_PART_CD : 110,
            },
            {
                MENU_CD_LIST: ["000010000200001"],
                SUBJECT_CD : "LS",
                PART_CD : 111,
                PART_NM : "11. 일상생활과 법",
                TARGET_PART_CD : 111,
            },
            {
                MENU_CD_LIST: ["000010000200001"],
                SUBJECT_CD : "LS",
                PART_CD : 112,
                PART_NM : "12. 인권과 기본권형",
                TARGET_PART_CD : 101,
            },
            {
                MENU_CD_LIST: ["000020000200001"],
                SUBJECT_CD : "MT",
                PART_CD : 202,
                PART_NM : "2. 집합과 명제",
                TARGET_PART_CD : 104,
            },
            {
                MENU_CD_LIST: ["000020000200001"],
                SUBJECT_CD : "MT",
                PART_CD : 203,
                PART_NM : "3. 함수",
                TARGET_PART_CD : 105,
            }
        ];

        //수준별 유형
        const menu4TargetList = ["000010000200001", "000020000200001", "000010000200003", "000020000200003"];
        //서술형 공략, 최다빈출 공략, 최다오답 공략
        const menu5TargetList = ["000010000300001", "000010000300002", "000010000300003", "000020000300001", "000020000300002", "000020000300003"];
        //최상위 공략
        const examTopTableList = ["000010000300004", "000020000300004"]

        let link = "";
        let subjectIndex = 2;
        let groupIndex = 0;

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

        let targetFilter = menuTargetList.filter((val) => { return isArrayInValue(val.MENU_CD_LIST, commonGLB.getMenuCD()) && val.SUBJECT_CD == commonGLB.getSubjectCD() && val.PART_CD == rootpartCode });

        if (targetFilter.length > 0) {
            let targetItem = targetFilter[0];

            if (isArrayInValue(menu4TargetList, commonGLB.getMenuCD())) {
                link = "/" + commonGLB.getSiteID() + "/?menu=4&oldData=Y&subject=" + subjectIndex + "&rootpart_code=" + targetItem.TARGET_PART_CD;
            }

            if (isArrayInValue(menu5TargetList, commonGLB.getMenuCD())) {
                switch (commonGLB.getMenuCD()) {
                    case "000010000300001":
                    case "000020000300001":
                        groupIndex = 0;
                        break;
                    case "000010000300002":
                    case "000020000300002":
                        groupIndex = 1;
                        break;
                    case "000010000300003":
                    case "000020000300003":
                        groupIndex = 2;
                        break;
                }

                link = "/" + commonGLB.getSiteID() + "/?menu=5&oldData=Y" + "&group=" + groupIndex + "&subject=" + subjectIndex + "&rootpart_code=" + targetItem.TARGET_PART_CD;
            }

            if (isArrayInValue(examTopTableList, commonGLB.getMenuCD())) {
                link = "/" + commonGLB.getSiteID() + "/exam_top_table.asp" + "?oldData=Y&subject=" + subjectIndex + "&rootpart_code=" + targetItem.TARGET_PART_CD;
            }
        }

        if (isValueEmpty(link) == false) {
            if (TRK_GLB_SERVICE_TYPE_CD == 2) {//모바일웹인 경우
				location.href = link;
				return;
			}

            modalCLS.popupOpen("과목별 출제 전문가가 제작 중입니다.");
            modalCLS.setBodyContent(jQuery("#hidden-menu-ready-part-msg-item-template").html());
            modalCLS.setFooter(templateReplace(jQuery("#hidden-menu-ready-msg-button-item-template").html(), [link]));
        } else {
            alert("과목별 출제 전문가가 제작 중입니다.");
        }
    },
    getEgGubunGroupLabel : function (egGubunGroup) {
        let label = "";

        if (isArrayInValue(["000010000100002", "000020000100002", "000010000700004", "000020001100001"], commonGLB.getMenuCD())) {
            switch (Number(egGubunGroup)) {
            case 1:
                label = "개념완성";
                break;
            case 2:
                label = "체크체크";
                break;
            case 3:
                label = "확인문제";
                break;
            case 4:
                label = "종합문제";
                break;
            }
        }

        if (isArrayInValue(["000010000100003", "000020000100003"], commonGLB.getMenuCD())) {
            switch (Number(egGubunGroup)) {
            case 1:
                label = "개념완성";
                break;
            case 2:
                label = "연습문제";
                break;
            case 3:
                label = "워크북";
                break;
            }
        }

        return label;
    },
    getStepLabel : function(egGubunGroup) {
        return "STEP " + egGubunGroup
    },
    getEgLevelLabel : function(level)  {
        let label = "";
        switch (Number(level)) {
            case 1:
                label = "기초";
                break;
            case 2:
                label = "기본"
                break;
            case 3:
                label = "심화"
                break;
            case 4:
                label = "완성"
                break;
        }

        return label;
    },
    getEpisodeNameByNumber : function(i) {
        let n = i + 1;
        return (n < 10 ? '0' : '') + n + '회';
    },
    getVodClassName :function(vodType){
        let label = "is-primary";
        switch (vodType) {
            case "MID_ENG":
                label = "is-primary";
                break;
            case "CONCEPT":
                label = "is-primary"
                break;
            case "TWEEZERS":
                label = "is-secondary"
                break;
        }

        return label;
    },
    getSemesterLabel : function (semesterName) {
        let label = "";

        if (menuCLS.getMenuByIsSemesterHiddenCD() != 1 && isValueEmpty(semesterName) == false) {
            label = "<span class='badge is-tertiary'>🔥" + semesterName + "</span>";
        }

        return label;
    },
    setTipBrandInfoH2 : function () {
        storage.setLocalLimit(storage.TIP_BRAND_SERVICE_INFO_MSG_H2, 1, 1);
    },
    setTipBrandInfoH3 : function () {
        storage.setLocalLimit(storage.TIP_BRAND_SERVICE_INFO_MSG_H3, 1, 1);
    },
    getTipBrandInfoMgs : function () {
        let isTipBrandServiceInfoMsgH2 = storage.getLocalLimit(storage.TIP_BRAND_SERVICE_INFO_MSG_H2);
        if ( menuCLS.LNB_TIP_USE_CD == 1 && isArrayInValue(["000010000200001", "000010000200003"]) && commonGLB.getGrade() == 2 && isTipBrandServiceInfoMsgH2 != 1) { // 수준별 AI 중2학년 1회 팝업 노출
            modalCLS.popupOpen("해당 학년의 풀이 TIP은 준비 중입니다.");
            modalCLS.setBodyContent($("#hidden-tip-brand-service-info-body-modal-template").html());
            modalCLS.setFooter($("#hidden-tip-brand-service-info-h2-footer-modal-template").html());
        }

        let isTipBrandServiceInfoMsgH3 = storage.getLocalLimit(storage.TIP_BRAND_SERVICE_INFO_MSG_H3);
        if ( menuCLS.LNB_TIP_USE_CD == 1 && isArrayInValue(["000010000200001", "000010000200003"]) && commonGLB.getGrade() == 3 && isTipBrandServiceInfoMsgH3 != 1) { // 수준별 AI 중3학년 1회 팝업 노출
            modalCLS.popupOpen("해당 학년의 풀이 TIP은 준비 중입니다.");
            modalCLS.setBodyContent($("#hidden-tip-brand-service-info-body-modal-template").html());
            modalCLS.setFooter($("#hidden-tip-brand-service-info-h3-footer-modal-template").html());
        }
    },
    getKoreanPartNmBySubjectDetailCd : function(subjectDetailCd) {
        let partNm = "";

        switch (Number(subjectDetailCd)) {
            case 1:
                partNm = "시";
                break;
            case 2:
                partNm = "소설"
                break;
            case 3:
                partNm = "수필"
                break;
            case 4:
                partNm = "극문학"
                break;
        }

        return partNm;
    },
    getWeekStepNameByNumber : function(i) {
        let n = i + 1;
        return "WEEK" + (n < 10 ? '0' : '') + n;
    },
    bindButtonClickEvents() {
        const buttons = document.querySelectorAll('.zbAccordion__button');
        buttons.forEach(function (button) {
            button.removeEventListener('click', zbAccordionScroll);
            button.addEventListener('click', zbAccordionScroll);
        });
    },
    getEgQuestionNumName : function (examStartNum, examEndNum) {
        let startNum = String(examStartNum).padStart(2, "0") + "번";
        let endNum = String(examEndNum).padStart(2, "0") + "번";

        return  startNum + "~" + endNum;
    },
    getVodType : function () {
        let vodType = "";

        if (TRK_GLB_SERVICE_TYPE_CD == 2) {
            vodType = commonGLB.getSearchVodType();
        } else {
            if (appCLS.getIsRecoomendedVersion(appCLS.getVodExamRecoomendedVersion()) == true) {
                vodType = commonGLB.getSearchVodType();
            }
        }

        return vodType;
    },
    goLink : function (link) {
        if (TRK_GLB_SERVICE_TYPE_CD != 2) {
            if (isValueEmpty(appCLS.getOS()) == false) link += "&os-type=" + appCLS.getOS();
			if (isValueEmpty(appCLS.getAppVersion()) == false) link += "&app_version=" + appCLS.getAppVersion();
			if (isValueEmpty(appCLS.getDeviceId()) == false) link += "&device_id=" + appCLS.getDeviceId();
        }
        
        location.href = link;
    },
    groupByPart : function (data) {
        var result = new Map();
        data.forEach(function(item) {
            var key = item.ROOT_PART_CD + item.SUB_PART_CD + item.DETAIL_PART_CD;
            result.set(key, (result.get(key) || 0) + 1);
        });
        return result;
    },
	//직전대비 step라벨 셋팅요청_edumig11020
	getPreparationStepLabel : function (gubun)  {
		let label = "STEP 1";
        switch (gubun) {
            case "직전요약노트", "암기노트":
                label = "STEP 1";
                break;
            case "시험에 꼭나오는 문제":
                label = "STEP 2";
                break;
            case "파이널 모의고사":
                label = "STEP 3";
                break;
        }

        return label;
    },
    setGroupAndCoreType: function() {
        let params = {
            menuCD: commonGLB.getMenuCD(),
            siteID: commonGLB.getSiteID(),
            grade: commonGLB.getGrade(),
            subjectCD: commonGLB.getSubjectCD(),
            txCD: commonGLB.getTxCD(),
        };
        
        filter = filterCLS.getMenuExamFilterData(params);

        if (filter.length > 0) {
            filterCLS.setSearchExpaprCode(filter);
        }
    },   
};

