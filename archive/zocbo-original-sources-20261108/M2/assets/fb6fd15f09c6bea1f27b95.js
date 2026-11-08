/*
	중등 상품목록
*/
var expected = function() {
	var _id = "expected";
	var _site_id = "M";
	var mem_base_info = {};
	var root = null;
	var param = null;
	var PageSize = 20;
	var Page = 1;
	var totalCount = 0;
	var items = null;
	var activeRow = null;
	var selectedInfo = {};
	var _url_v = "";
	var _data_v = "";
	var loginCheck = 0;
	var popSubjectItems = [];
	var gu2Items = [];
	var sch2Items = [];
	var page_Act_Chk = true;	 //학년, 과목, 구분값 클릭시만 true
	var isLoading = false;
	var html = "";
	var icon_html = "";
	var isRedownLastChk_v;
	var row_A;
	var app_school_info = {};
	var param_Subj_Code;
	var param_Grade;
	var param_scl_id;
	var param_si;
	var param_gugun;

	//AI_250808
	/*var pop2TypeItems = [
		{"Name":"학교별 Ai기출유사", "value":"A", "Index":"7"},
		{"Name":"학교별 Ai기출변형", "value":"W", "Index":"8"},
		{"Name":"학교별 Ai예상족보", "value":"V", "Index":"2"},		
		{"Name":"학교별 기출 무료열람실<span class='mo-label grade15 mid' style='margin-left:10px;height:17px;line-height:17px;margin-top:-3px;'>무료열람</span>", "value":"", "Index":"0"},
		{"Name":"강남 3구 유형공략", "value": "K3", "Index":"4"},
		{"Name":"빠른족보", "value":"", "Index":"9"}
	];*/
	var pop2TypeItems = [
		//{"Name":"학교별 기출유사", "value":"A", "Index":"7", "menuCD":"000010000500002"},
		{"Name":"학교별 기출변형", "value":"W", "Index":"8", "menuCD":"000010000500003"},
		{"Name":"학교별 예상족보", "value":"V", "Index":"2", "menuCD":"000010000500004"},		
		{"Name":"학교별 기출 무료열람실<span class='mo-label grade15 mid' style='margin-left:10px;height:17px;line-height:17px;margin-top:-3px;'>무료열람</span>", "value":"", "Index":"0", "menuCD":"000010000500001"},
		{"Name":"강남 3구 유형공략", "value": "K3", "Index":"4", "menuCD":"000010000500005"},
		// {"Name":"빠른족보", "value":"", "Index":"9"}
	];
	var popGrade2Items = [
		{"title":"1학년", "value":"1"},
		{"title":"2학년", "value":"2"},
		{"title":"3학년", "value":"3"}
	];
	var errorItems = [
		{"Name":"오답신고", "value":"2"},
		{"Name":"불량신고", "value":"3"},
		{"Name":"건의사항", "value":"5"}
	];

	var _init = function() {
		var this_val = document.querySelector("#fixMenu01");
		$(this_val).addClass("on");

		root = document.querySelector("[data-id='" + _id + "']");
		param = util.queryStringToJSON(null);
		row_A = root.querySelector("#row_A");
		activeRow = row_A;

//		var k3_show_target = $("#k3_show_target").val();
//
//		if(k3_show_target != "Y") {
//			for(var i = 0; i < pop2TypeItems.length; i++) {
//				if(pop2TypeItems[i].value == "K3") {
//					pop2TypeItems.splice(i, 1);
//				}
//			}
//		}

		if(param == null) {
			param = {};
			param.menu = 1;
		} else if(param.menu == null) {
			param = {};
			param.menu = 1;
		}		

		param_Subj_Code = $("#Subj_Code").val();
		param_Grade = $("#Grade").val();
		param_scl_id = $("#scl_id").val();
		param_si = $("#si").val();

		commonGLB.setStorage(storage.SEARCH_MENU_CD, "000010000500004");//메뉴코드 셋팅
		
		setInitConfig(function() {
			_loadInitData();
			_initEvent();

			$(window).scroll(function() {				
				var m_i = parseInt($(window).scrollTop());
				var s_i = $(document).height() - $(window).height();
				var season_State = $("#season_State").val();

				if(season_State == 'Y') {
					if(m_i > 0) {
						$(".mo-label.grade15").hide();
					} else {
						$(".mo-label.grade15").show();
					}
				}
			});
		});
	};
	
	// 이벤트 초기화
	var _initEvent = function() {
		if(root) {
			var selector_str = "[data-src='" + _id + "'][data-act]";
			$(root).find(selector_str).unbind();
			$(root).find(selector_str).bind("click", function() {return false;});
			$(root).find(selector_str).bind("click", function(ev) {_click(ev);});
		}

		common.resetA();
		common.init();
	};

	// 페이지 진입시 파라미터에 따라 필터 및 보여줄 데이터 설정
	var setInitConfig = function(_cback) {
		var data_m_v = localStorage.getItem("data_m"); 		// 쿠키 설정 값

		if(data_m_v) {
			selectedInfo = eval("(" + data_m_v + ")");
		} else {
			selectedInfo = {};
		}

		// 2) 기존 로직 적용 (바깥에 있던걸 안으로 이동)
		_hLog("setInitConfig data_m=" + JSON.stringify(selectedInfo));
		var isParam = false;
		
		if(param != null && param.menu != null) {			
			selectedInfo.menuIndex = param.menu - 1;

			var url_v = "/_api/member.api.asp";
			var data_v = "cmd=GET_MEMBER_INTEGRATION_BASE_INFO&flag=" + _site_id;

			$.ajax({
				type : "POST"
				, url : url_v
				, data : data_v
				, dataType : "json"
				, contentType: "application/x-www-form-urlencoded; charset=eur-kr"
				, async : false
				, success : function(data) {
					if (data.result == "1") {
						// 1) 시에 해당하는 index 체크
						mem_base_info.init = "Y";		// 시정보를 이용 구, 셋팅 시 최초 1회 사용 (이후는 N으로 치환)

						_SI_LIST.forEach(function(d, i) {
							if (d.Name == data.list[0].si) {
								selectedInfo.si2Index = i;
								mem_base_info.gugun = data.list[0].gugun;
								mem_base_info.scl_id = data.list[0].scl_id;
								mem_base_info.grade = data.list[0].grade;
							}
						})

						if (mem_base_info.grade && !isNaN(mem_base_info.grade)) {
							selectedInfo.grade2Index = (parseInt(mem_base_info.grade) > 3) ? 2 : parseInt(mem_base_info.grade) - 1;
						} else {
							selectedInfo.grade2Index = 1;
						}
					} else {
						selectedInfo.si2Index = 0;
						selectedInfo.gu2Index = 0;
						selectedInfo.sch2Index = 0;
						selectedInfo.grade2Index = 1;
					}
				}
			});

			if(param.grade != "" && param.grade != null) {
				selectedInfo.grade2Index = parseInt(param.grade) -1;
			}

			if(param.subject != "" && param.subject != null) {
				selectedInfo.subject2Index = param.subject;
				popSubjectItems = Object.values(_Unit[_site_id + (selectedInfo.grade2Index-0+1)]);
				selectedInfo.subject2Code = popSubjectItems[param.subject].Value;
				selectedInfo.subject2Name = popSubjectItems[param.subject].Name;
			}
		}

		selectedInfo.type2Index = 0;
		for(var i = 0; i < pop2TypeItems.length; i++) {
			if(pop2TypeItems[i].value == "V") { //학교별 예상족보
				selectedInfo.type2Index = i;
				break;
			}
		}

		if(param_Subj_Code != "" && param_Grade != "" && param_scl_id != "") {
			_SI_LIST.forEach(function(d, i) {
				if (d.Name == param_si) {
					selectedInfo.si2Index = i;
				}
			});

			var param_gugun = $("#gugun").val().trim();

			app_school_info.init = "Y";
			app_school_info.gugun = param_gugun;
			app_school_info.scl_id = param_scl_id;

			$.each(popGrade2Items, function(idx) {
				if(popGrade2Items[idx].value == param_Grade) {
					selectedInfo.grade2Index = idx;
				}
			});

			_setHierarchy();
			popSubjectItems = _Hierarchy[selectedInfo.grade2Index].Subj_Code;

			$.each(popSubjectItems, function(idx) {
				if(popSubjectItems[idx].Value == param_Subj_Code) {
					selectedInfo.subject2Index = idx;
				}
			});

			if($("#appYN").val() == "Y") {
				$("#viewAppGo").show();

				setTimeout(function(){
					var SiteID = _site_id;
					var Grade = popGrade2Items[selectedInfo.grade2Index].value;
					var Subj_Code = popSubjectItems[selectedInfo.subject2Index].Value;
					var Subj_Name = popSubjectItems[selectedInfo.subject2Index].Name;
					var Rg_CitiesProvinces = encodeURIComponent(_SI_LIST[selectedInfo.si2Index].Name.trim());
					var Rg_District = encodeURIComponent(gu2Items[selectedInfo.gu2Index].Name.trim());
					var Scl_ID = sch2Items[selectedInfo.sch2Index].Scl_ID;
					var part_ids = document.getElementById("part_ID").value;
					var expapr_Group = "V";
					var url = "/_api/Search.api.asp";
					var data = "cmd=EXPAPR_NO_CHK&SiteID=" + SiteID + "&Grade=" + Grade + "&Subj_Code=" + Subj_Code + "&Rg_CitiesProvinces=" + Rg_CitiesProvinces + "&Rg_District=" + Rg_District + "&Scl_ID=" + Scl_ID + "&Subj_Name=" + Subj_Name + "&expapr_Group=" + expapr_Group;
	
					comm.send(url, data, "POST", function(json) {
						if(json.expapr_No == "undefined" || typeof json.expapr_No == "undefined") {
							$(".zoboInfoPop_V_NoData").show();
						} else {
							fn_examDownload(json.expapr_No, "2", SiteID, expapr_Group, "", Subj_Code, Grade, "", _id);	
						}
					});
				}, 500);				
			}
			
			if($("#part_id").val() != "") {
				setTimeout(function(){
					var part_id = $("#part_id").val();
					
					document.getElementById("part_ID").value = part_id;
					_loadData_2_V();
				}, 500);
			}		
		} else {
			if(param_Subj_Code != "" && param_Grade != "") {
				$.each(popGrade2Items, function(idx) {				
					if(popGrade2Items[idx].value == param_Grade) {
						selectedInfo.grade2Index = idx;
					}
				});

				_setHierarchy();
				popSubjectItems = _Hierarchy[selectedInfo.grade2Index].Subj_Code;

				$.each(popSubjectItems, function(idx) {
					if(popSubjectItems[idx].Value == param_Subj_Code) {
						selectedInfo.subject2Index = idx;
					}
				});
			}
		}

		if(typeof(_cback) == "function") { _cback();}
	};

	// 초기 데이터 설정
	var _loadInitData = function() {
		var url_v = "/_api/member.api.asp";
		var data_v = "cmd=ISLOGIN";

		comm.send(url_v, data_v, "post", function(data) {
			loginCheck = data.user_id;  // 1 : 가족학원, 0 : 일반
		});

		if(selectedInfo.subject2Index == null) selectedInfo.subject2Index = 2;
		if(selectedInfo.grade2Index == null) selectedInfo.grade2Index = 1;

		_setHierarchy();

		if(popSubjectItems == "") {
			popSubjectItems = _Hierarchy[selectedInfo.grade2Index].Subj_Code;
		}

		_setSelectedValue();

		if(util.isEmpty(param)) return;
		if(util.isEmpty(param.menu)) return;
	};

	// 필터 값 저장
	var _saveInitData = function() {
		if(selectedInfo) {
			localStorage.setItem("data_m", JSON.stringify(selectedInfo));
		}
	};

	// 하이라키 설정
	var _setHierarchy = function() {
		var group_v = "A";
		var coretype_v = "E";

		Hierarchy_Init(_site_id, group_v, coretype_v);
	};

	// 필터 설정
	var _setSelectedValue = function() {
		comm.toggleLoading(true);
		Page = 1;
		popSubjectItems = _Hierarchy[selectedInfo.grade2Index].Subj_Code;

		var filter = root.querySelector("#filter");
		var part_ids = document.getElementById("part_ID").value;

		if(filter) {
			var gu_o = filter.querySelector("[data-act='filter_gu']");
			var sch_o = filter.querySelector("[data-act='filter_sch']");
			var chapter_o = filter.querySelector("[data-act='filter_Chapter']");

			obj = filter.querySelector("[data-act='filter_si']");

			if (typeof _SI_LIST[selectedInfo.si2Index] == "undefined") { selectedInfo.si2Index = 0; }
			obj.innerHTML = _SI_LIST[selectedInfo.si2Index].Name;

			$(gu_o).removeAttr("disabled");
			$(sch_o).removeAttr("disabled");

			if(selectedInfo.si2Index == 0) {
				$(gu_o).attr("disabled", "true");
				$(sch_o).attr("disabled", "true");
				selectedInfo.gu2Index = 0;

				gu2Items = [{"Name":"구/군", "Value":""}];
				selectedInfo.sch2Index = 0;
				sch2Items = [{"Scl_Name":"학교", "Value":"", "Scl_ID":"", "Name":"학교"}];

				_setSelectedValueForFilter2SubLoad();
			} else {
				var url_v = "/_api/community.api.asp";
				var data_v = "cmd=GET_REGION_LIST&si=" + obj.innerHTML;
				
				comm.send(url_v, data_v, "post", function(json) {
					gu2Items = [{"Name":"구/군", "rg_District":"구/군", "Value":""}].concat(json.list);

					for(var i = 0; i < gu2Items.length; i++) {
						gu2Items[i]["Name"] = gu2Items[i].rg_District;
					}

					// 아래코드 제외 테스트 (2024.07.10-이슈있으면 제외)
					if(param.yusatype == "Y" && 1==2) {
						var url_v = "/_api/school_info.api.asp";
						var data_v = "cmd=School_Region_l&scl_ID=" + param.scl;
							
						comm.send(url_v, data_v, "post", function(json) {
							var si_name = json.list[0].si_name;
							var gu_name = json.list[0].gu_name;

							gu2Items.forEach(function(d, i) {
								if (d.Name == gu_name) {
									selectedInfo.gu2Index = i;
								}
							});
						});
					} else if(app_school_info.init =="Y") {
						gu2Items.forEach(function(d, i) {
							if (d.Name == app_school_info.gugun) {
								selectedInfo.gu2Index = i;
							}
						});
					} else {
						if (mem_base_info.init == "Y") {
							gu2Items.forEach(function(d, i) {
								if (d.Name == mem_base_info.gugun) {
									selectedInfo.gu2Index = i;
								}
							})
						}
					}				

					obj = filter.querySelector("[data-act='filter_gu']");
					obj.innerHTML = gu2Items[selectedInfo.gu2Index].Name;

					if(selectedInfo.gu2Index == 0) {
						$(sch_o).attr("disabled", "true");
						selectedInfo.sch2Index = 0;
						sch2Items = [{"Scl_Name":"학교", "Value":"", "Scl_ID":"", "Name":"학교"}];

						_setSelectedValueForFilter2SubLoad();
					} else {
						var url2_v = "/_api/community.api.asp";
						var si_v;
						var gu_v;

						// 아래코드 제외 테스트 (2024.07.10-이슈있으면 제외)
						if(param.yusatype == "Y" && 1==2) {
							var url_v = "/_api/school_info.api.asp";
							var data_v = "cmd=School_Region_l&scl_ID=" + param.scl;						

							comm.send(url_v, data_v, "post", function(json) {
								var si_name = json.list[0].si_name;
								var gu_name = json.list[0].gu_name;

								_SI_LIST.forEach(function(d, i) {
									if (d.Name == si_name) {
										selectedInfo.si2Index = i;
									}
								});

								var url_v = "/_api/community.api.asp";
								var data_v = "cmd=GET_REGION_LIST&si=" + si_name;

								comm.send(url_v, data_v, "post", function(json) {
									gu2Items = [{"Name":"구/군", "rg_District":"구/군", "Value":""}].concat(json.list);

									for(var i = 0; i < gu2Items.length; i++) {
										gu2Items[i]["Name"] = gu2Items[i].rg_District;
									}

									gu2Items.forEach(function(d, i) {
										if (d.Name == gu_name) {
											selectedInfo.gu2Index = i;
										}
									});
								});
							});	

							si_v = _SI_LIST[selectedInfo.si2Index].Name;
							gu_v = gu2Items[selectedInfo.gu2Index].Name;
						} else {
							si_v = _SI_LIST[selectedInfo.si2Index].Name;
							gu_v = gu2Items[selectedInfo.gu2Index].Name;
						}

						if(si_v == "지역" || si_v == "지역 선택") {
							si_v = "";								
						}
						
						var data2_v = "cmd=GET_SCHOOL_LIST&site_id=" + _site_id + "&si=" + encodeURIComponent(si_v);
						data2_v = data2_v + "&region=" + encodeURIComponent(gu_v);

						comm.send(url2_v, data2_v, "post", function(json2) {
							sch2Items = [{"Scl_Name":"학교", "Value":"", "Scl_ID":""}].concat(json2.list);

							for(var i = 0; i < sch2Items.length; i++) {
								sch2Items[i]["Name"] = sch2Items[i].Scl_Name;
							}

							// 2) 내 학교 선택
							if(param.yusatype == "Y" && 1==2) {										
								sch2Items.forEach(function(d, i) {
									if (d.Scl_ID == param.scl) {
										selectedInfo.sch2Index = i;
									}
								});
							} else if(app_school_info.init =="Y") {
								sch2Items.forEach(function(d, i) {
									if (d.Scl_ID == app_school_info.scl_id) {
										selectedInfo.sch2Index = i;
									}
								});

								//app_school_info.init = "N";	// 최소 1회만 할당하기 위해
							} else {
								if (mem_base_info.init == "Y") {
									sch2Items.forEach(function(d, i) {
										if (d.Scl_ID == mem_base_info.scl_id) {
											selectedInfo.sch2Index = i;
										}
									})

									mem_base_info.init = "N";	// 최소 1회만 할당하기 위해
								}	
							}							

							_setSelectedValueForFilter2SubLoad();
						});
					}
				});
			}
		}
	};

	// 학교별 족보 필터 설정
	var _setSelectedValueForFilter2SubLoad = function() {
		var filter = root.querySelector("#filter");

		obj = filter.querySelector("[data-act='filter_gu']");
		obj.innerHTML = gu2Items[selectedInfo.gu2Index].Name;

		obj = filter.querySelector("[data-act='filter_sch']");
		obj.innerHTML = sch2Items[selectedInfo.sch2Index].Name;

		obj = filter.querySelector("[data-act='filter_grade']");
		obj.innerHTML = popGrade2Items[selectedInfo.grade2Index].title || popGrade2Items[selectedInfo.grade2Index].Name;

		obj = filter.querySelector("[data-act='filter_subject']");
		obj.innerHTML = popSubjectItems[selectedInfo.subject2Index].Name;

		//PV 쌓기
		if (page_Act_Chk) {	//처음 페이지 로딩시, 학년, 과목, 구분값 변경시 true
			common.setCount(pop2TypeItems[selectedInfo.type2Index].Name, popGrade2Items[selectedInfo.grade2Index].title, popSubjectItems[selectedInfo.subject2Index].Name, null);
		}	
		
		_loadData();
	};
	
	// 데이터 가져오기
	var _loadData = function() {
		isLoading = true;
		window.setTimeout(function(ev) { isLoading = false;}, 1000);

		_saveInitData();

		var dl_o = document.querySelector("#downloadLayer");
		var dlMsg_o = dl_o.querySelectorAll("#subMsg");
		var dlMsg_o2 = dl_o.querySelectorAll(".subMsg2");

		if(dlMsg_o) {
			$(dlMsg_o).hide();
		}

		if(dlMsg_o2) {
			$(dlMsg_o2).hide();
		}

		$(dlMsg_o).show();
		$(dlMsg_o2).show();

		_loadData_2_V();
	};

	var _loadData_2_V = function() {
		html = "";

		var f_2 = root.querySelector("#filter");
		var site_v = _site_id;
		var group_v = pop2TypeItems[selectedInfo.type2Index].value;
		var scl_id_v = sch2Items[selectedInfo.sch2Index].Scl_ID;
		var grade_v = popGrade2Items[selectedInfo.grade2Index].value;
		var subject_v = popSubjectItems[selectedInfo.subject2Index].Value;
		var subjectname_v = encodeURIComponent(popSubjectItems[selectedInfo.subject2Index].Name);
		var Rg_CitiesProvinces_v = encodeURIComponent(_SI_LIST[selectedInfo.si2Index].Name.trim());	// 지역
		var Rg_District_v = encodeURIComponent(gu2Items[selectedInfo.gu2Index].Name.trim());		// 구/군
		var coreType_v = "";		
		var txcode_v = "";
		var search_Part_ID_Set = document.getElementById("part_ID").value;
		var url_v = "/ZocboMid/ZocboExam/Exam_Default.asp";		
		var data_v = "SiteID=" + site_v;

		if(subjectname_v == encodeURIComponent("전체 과목")) {
			subjectname_v = "";
		}

		if(Rg_CitiesProvinces_v == encodeURIComponent("지역")) {
			Rg_CitiesProvinces_v = "";
		}

		if(Rg_District_v == encodeURIComponent("구/군")) {
			Rg_District_v = "";
		}

		data_v = data_v + "&Rg_CitiesProvinces=" + Rg_CitiesProvinces_v;
		data_v = data_v + "&Rg_District=" + Rg_District_v;
		data_v = data_v + "&Scl_ID=" + scl_id_v;
		data_v = data_v + "&Exfl_Group=2";
		data_v = data_v + "&ExPapr_CoreType=" + coreType_v + "&Grade=" + grade_v;
		data_v = data_v + "&Subj_Code=" + subject_v;
		data_v = data_v + "&Subj_Name=" + subjectname_v;
		data_v = data_v + "&tx_code=" + txcode_v;
		data_v = data_v + "&search_Part_ID_Set=" + search_Part_ID_Set;		

		comm.send(url_v, data_v, "POST", function(json) {
			items = json;
			totalCount = json.RecordCount;

			if(search_Part_ID_Set == 'last_Search_Y') {
				document.getElementById("part_ID").value = json.search_Part_ID_Set;
				search_Part_ID_Set = document.getElementById("part_ID").value;
			}

			$("#recordCount").html(0);

			if(selectedInfo.si2Index == 0 || selectedInfo.gu2Index == 0 || selectedInfo.sch2Index == 0) {
				$("#filter_Chapter").text("범위 선택");
				$("#recordCount").html(0);
				items = "";
			} else {
				if (search_Part_ID_Set != '') {
					$("#filter_Chapter").text("범위 재선택");
					$("#div_Img").hide();
					$("#recordCount").html(util.toNumber(totalCount));
				} else {
					$("#filter_Chapter").text("범위 선택");
					$("#div_Img").show();
					$("#recordCount").html(util.toNumber(0));
					items = "";
				}
			}

			if(items.length == 0) {
				_drawNoList();
			} else {
				_drawList_V(items);			
			}

			_initEvent();
			comm.toggleLoading(false);
		});
	};

	var _drawList_V = function(dataItems) {
    	var ul_o = root.querySelector("#list_A");

		PageSize = 20;
		Page = 1;

    	if(ul_o) {
    		if(Page == 1) {
    			ul_o.innerHTML = "";
    		}

    		if(dataItems == null || dataItems.length == 0) {
				_drawNoList();
	    		return;
    		}

    		if(Page == 1) {
    			ul_o.innerHTML = "";
    		}

    		if(dataItems.length <= 0) {
    			return;
    		}

			if(dataItems.RecordCount == 0 || typeof dataItems.RecordCount == 'undefined') {
				_drawNoList('W_NoData');
	    		return;
			}	

			for(var i = 0; i < dataItems.RecordCount; i++) {
				_drawItem_V(dataItems, PageSize * (Page - 1) + i);
			}

			_initEvent();
		}
	};

	var _drawItem_V = function(item, index_p) {
		var ul_o = root.querySelector("#list_A");
		var title_v = item.expapr_title + ' ' + (index_p + 1) + '회';
		var key_v = null;
		key_v = _site_id + item.grade;
		var hash1 = "#" + _categorySub[key_v].title;
		var hash2 = "#" + item.tx_name;
		var exam_index = (index_p + 1);
		var url_v = "/Member/reDown_Chk_V.asp";
		var data_v = "ExPapr_No=" + item.exPapr_no;
		data_v = data_v + "&Part_ID_Set=" + item.search_Part_ID_Set;
		data_v = data_v + "&exam_Index=" + exam_index;

		html = html + templateReplace($("#hidden-autoexam-list").html(), [title_v, hash1, hash2, item.exPapr_no, item.siteid, item.grade, item.subj_code, item.TX_CODE, item.scl_id, exam_index, item.exPapr_group, item.exPapr_CoreType, '2', _id]);

		$("#list_A").html(html);
		$(".list_icon_area").attr("data-title", item.expapr_title);		

		comm.send(url_v, data_v, "POST", function(json) {
			if(json.isRedownLastChk == 0) {
				$(".list_icon_area").eq(index_p).addClass("downloaded");				
			} else {
				$(".list_icon_area > .listMenu").eq(index_p).hide();
			}
		});
	};

	// 목록이 존재하지 않을때 그리기
	var _drawNoList = function(chk) {
		var recordCount_o = activeRow.querySelector(".bbsNumber b");
		var ul_o = root.querySelector("#list_A");

		if(recordCount_o) {
			recordCount_o.innerHTML = 0;
		} else {
			_hLog(recordCount_o);
		}

		if(ul_o) {
			ul_o.innerHTML = "";
		}
		
		$("#div_Img").show();
		$("#div_V").show();
	};

	var _icon_Setting = function(format, item, list_index) {
		var template;
		var icon_class_name = "";

		icon_html = "";
		template = "";

		if(format == "PDF") {
			template = $("#hidden-autoexam-list-icon-pdf").html();
		} else if(format == "HWP") {
			template = $("#hidden-list-icon-hwp").html();
		} else if(format == "HWP_PDF") {
			template = $("#hidden-list-icon-hwp-pdf").html();
		}

		if($(".list_icon_area").eq(list_index - 1).hasClass("downloaded") === true) {
			icon_class_name = " reconfirm";
		} else {
			$(".list_icon_area > .listMenu button").eq(list_index - 1).hide();
		}
		
		icon_html = templateReplace(template, [_id, "icon_click(" + list_index + ")", list_index, icon_class_name]);

		//$(".list_icon_area > .detailLink").remove();
		$(".list_icon_area").eq(list_index - 1).children("div").remove();
		$(".list_icon_area > .listMenu").eq(list_index - 1).after(icon_html);
		$(".list_icon_area > .listMenu").eq(list_index - 1).show();			
	}

	var _get_Btn_Price = function(item) {
		var url_p = "/_api/search.api.asp";
		var data_p = "cmd=GET_PAPER_PRICE&site_id=" + _site_id;

		if(item.expapr_no) {
			data_p = data_p + "&ExPapr_No=" + item.expapr_no;
		}

		if(item.expapr_group) {
			data_p = data_p + "&ExPapr_Group=" + item.expapr_group;
		}

		if(item.title) {
			data_p = data_p + "&ExPapr_title=" + item.title;
		}

		if(item.format) {
			data_p = data_p + "&Exfl_Group=" + item.format;
		}

		if(item.coretype){
			data_p = data_p + "&ExPapr_CoreType=" + item.coretype;
		}

		comm.toggleLoading(true);
		comm.send(url_p, data_p, "post", function(data){
			comm.toggleLoading(false);
			item.price = "0";

			if(data){
				item.price = data.price;
				_Unit.makeClickedProductPriceInput(item.price);
			}
		});
	};

	var _click = function(ee) {
		var ev = window.event || ee;
		var evo = util.findEventObject(ev);
		var act_v = evo.getAttribute("data-act");

		if (act_v == "filter_type" || act_v == "filter_grade" || act_v == "filter_subject") {
			page_Act_Chk = true;
		} else {
			page_Act_Chk = false;
		}

		if(act_v == "item_down_V") {			
			var eroot = util.findObjectByAttr(evo, "data-exam-index", null);
			var em_a = evo.querySelectorAll("em");
			var span_o = evo.querySelector(".down");
			var list_o = eroot.querySelector(".detailLink");

			if(em_a[0].style.display == "none") {
				$(span_o).removeClass("active");
				em_a[0].style.display = "";
				em_a[1].style.display = "none";
				list_o.style.display = "none";
			} else {
				$(span_o).addClass("active");
				em_a[0].style.display = "none";
				em_a[1].style.display = "inline";

				var no_v = eroot.getAttribute("data-no");
				var group_v = eroot.getAttribute("data-group");
				var grade_v = eroot.getAttribute("data-grade");
				var subject_v = eroot.getAttribute("data-subjcode");
				var coretype_v = eroot.getAttribute("data-coretype");
				var formats_v = eroot.getAttribute("data-formats");
				var title_v = eroot.getAttribute("data-title");
				var exam_index_v = eroot.getAttribute("data-exam-index");
				var part_id_v = document.getElementById("part_ID").value;
				var pItem = {};

				pItem.siteid = _site_id;
				pItem.expapr_no = no_v;
				pItem.expapr_group = group_v;
				pItem.grade = grade_v;
				pItem.subj_code = subject_v;
				pItem.coretype = coretype_v;
				pItem.formats = formats_v;
				pItem.title = title_v;
				pItem.exam_index = exam_index_v;
				pItem.pObject = eroot;

				for (var i = 1; i <= $(".list_icon_area").length; i++) {
					if(i == span_o.getAttribute("id")) {
						_icon_Setting("PDF", pItem, i);
					}
				}
			}
		} else if(act_v == "filter_type") {
			let before_index = 0;
			common.showFlexSelect("구분", pop2TypeItems, selectedInfo.type2Index, false, function(data) {
				Page = 1;
				before_index = selectedInfo.type2Index;
				selectedInfo.type2Index = data.pos;

				if(data.pos == 0) {
					location.href = '/M/ai_transform.asp';
				} else if(data.pos == 2) {
					selectedInfo.type2Index = before_index;
					if(TRK_GLB_USER_ID == "-1") {
						trkCLS.setExternalEvent("ID7P78JVPM4UCQRMX27HUOY8W20250403", "");
						location.href = $("#sign_url").val();
					} else {
						location.href = '/Freetrial/freereading.asp?type=0';
					}
				// } else if(data.Name == "빠른족보") {
				// 	location.href = '/event/quickzocbo2025a/?flag=M1';
				} else if(data.Name == "강남 3구 유형공략") {
					location.href = '/M/?menu=2&type=4';
				}

				document.getElementById("part_ID").value = "";
			});
		} else if(act_v == "filter_si") {
			common.showFlexSelect("시 선택", _SI_LIST, selectedInfo.si2Index, false, function(data) {
				selectedInfo.si2Index = data.pos;
				selectedInfo.gu2Index = 0;
				selectedInfo.sch2Index = 0;

				document.getElementById("part_ID").value = "";

				if(app_school_info.init == "Y") {
					app_school_info.init = "N";
					mem_base_info.init = "N";
				}
				
				_setSelectedValue();
			});
		} else if(act_v == "filter_gu") {
			common.showFlexSelect("구 선택", gu2Items, selectedInfo.gu2Index, false, function(data) {
				selectedInfo.gu2Index = data.pos;
				selectedInfo.sch2Index = 0;		// 학교정보 초기화

				document.getElementById("part_ID").value = "";
				
				if(app_school_info.init == "Y") {
					app_school_info.init = "N";
					mem_base_info.init = "N";
				}

				_setSelectedValue();
			});
		} else if(act_v == "filter_sch") {
			common.showFlexSelect("학교 선택", sch2Items, selectedInfo.sch2Index, false, function(data) {
				selectedInfo.sch2Index = data.pos;

				document.getElementById("part_ID").value = "";
				
				if(app_school_info.init == "Y") {
					app_school_info.init = "N";
					mem_base_info.init = "N";
				}

				_setSelectedValue();
			});
		} else if(act_v == "filter_grade") {
			var gradeIdx = selectedInfo.grade2Index;

			common.showFlexSelect("학년", popGrade2Items, gradeIdx, false, function(data) {
				selectedInfo.grade2Index = data.pos;
				selectedInfo.subject2Index = 2;

				_setHierarchy();
				document.getElementById("part_ID").value = "";
				_setSelectedValue();
			});
		} else if(act_v == "filter_subject") {
			common.showFlexSelect("과목", popSubjectItems, selectedInfo.subject2Index, false, function(data) {
				selectedInfo.subject2Index = data.pos;

				document.getElementById("part_ID").value = "";

				if(sch2Items[selectedInfo.sch2Index].Scl_ID == '') {
					_setSelectedValue();
				} else {
					var url_v = "/ZocboExam/examRange.ajax.asp";
					var data_v = "SiteID=" + _site_id;
					data_v = data_v + "&Grade=" + popGrade2Items[selectedInfo.grade2Index].value;
					data_v = data_v + "&Subj_Code=" + popSubjectItems[selectedInfo.subject2Index].Value;
					data_v = data_v + "&Subj_Name=" + escape(popSubjectItems[selectedInfo.subject2Index].Name);
					data_v = data_v + "&Scl_ID=" + sch2Items[selectedInfo.sch2Index].Scl_ID;

					comm.send(url_v, data_v, "POST", function(json) {
						_setSelectedValue();

//						var chk_Val = json.chk_Val;
//						
//						if(chk_Val == 1) {
//							if(!confirm("최근 검색한 " + popSubjectItems[selectedInfo.subject2Index].Name + " 범위를 다시 검색하시겠습니까?")) {
//								_setSelectedValue();
//							} else {
//								document.getElementById("part_ID").value = "last_Search_Y";								
//								_loadData_2_V();
//								_setSelectedValue();
//							}
//						} else {
//							_setSelectedValue();
//						}
					});
				}
			});
		} else if(act_v == "filter_Chapter") {
			if(selectedInfo.si2Index != 0 && selectedInfo.gu2Index != 0 && selectedInfo.sch2Index != 0) {
				var SiteID = _site_id;
				var Grade = popGrade2Items[selectedInfo.grade2Index].value;
				var Subj_Code = popSubjectItems[selectedInfo.subject2Index].Value;
				var Subj_Name = popSubjectItems[selectedInfo.subject2Index].Name;
				var Rg_CitiesProvinces = encodeURIComponent(_SI_LIST[selectedInfo.si2Index].Name.trim());
				var Rg_District = encodeURIComponent(gu2Items[selectedInfo.gu2Index].Name.trim());
				var Scl_ID = sch2Items[selectedInfo.sch2Index].Scl_ID;
				var part_ids = document.getElementById("part_ID").value;
				var expapr_Group = "V";
				var url = "/_api/Search.api.asp";
				var data = "cmd=EXPAPR_NO_CHK&SiteID=" + SiteID + "&Grade=" + Grade + "&Subj_Code=" + Subj_Code + "&Rg_CitiesProvinces=" + Rg_CitiesProvinces + "&Rg_District=" + Rg_District + "&Scl_ID=" + Scl_ID + "&Subj_Name=" + Subj_Name + "&expapr_Group=" + expapr_Group;

				comm.send(url, data, "POST", function(json) {
					if(json.expapr_No == "undefined" || typeof json.expapr_No == "undefined") {
						$(".zoboInfoPop_V_NoData").show();
					} else {
						fn_examDownload(json.expapr_No, "2", SiteID, expapr_Group, "", Subj_Code, Grade, "", _id);	
					}
				});
			} else {
				$(".zoboInfoPop_V_NoSelect").show();
			}
		} else if(act_v == "errorPopup") {
			common.showSelect(errorItems, 0, function(item){
				_hLog(item);
				var go = evo.parentElement.parentElement;
				var data = {};

				if(loginCheck == "") {			
					loginPop.show('', "/M/expected.asp", true);
				} else {
					var url_v = "/_api/member.api.asp";
					var data_v = "cmd=GET_AUTOEXAM_EXDOWNNO&expapr_No=" + go.getAttribute("data-no") + "&exam_index=" + go.getAttribute("data-exam-index") + "&Part_ID_Set=" + document.getElementById("part_ID").value;

					comm.send(url_v, data_v, "POST", function(json) {
						if(json.exdown_no) {
							data["expapr_no"] = go.getAttribute("data-no");
							data["section"] = item.value;
							data["exam_DownNo"] = json.exdown_no;

							report_w.show(root, data);
						}
					});
				}
			});
		}
	};

	var _icon_click = function(exam_index) {
		if($("#appYN").val() == "Y") {
			trkCLS.setExternalEvent("GUOQXKC6QMBN6M5RPBEF3N6DU20240819", "");
		}

		var expapr_no_v = $(".list_icon_area").attr("data-no");
		var group_v = $(".list_icon_area").attr("data-group");
		var grade_v = $(".list_icon_area").attr("data-grade");
		var subject_v = $(".list_icon_area").attr("data-subjcode");
		var coretype_v = $(".list_icon_area").attr("data-coretype");
		var formats_v = $(".list_icon_area").attr("data-formats");
		var title_v = $(".list_icon_area").attr("data-title");
		var exam_index_v = exam_index;
		var part_id_v = document.getElementById("part_ID").value;
		var current_toggle = $("#toggle_Group").val();
		var url_v = "/Member/reDown_Chk_V.asp";
		var data_v = "ExPapr_No=" + expapr_no_v;
		data_v = data_v + "&Part_ID_Set=" + part_id_v;
		data_v = data_v + "&exam_Index=" + exam_index_v;				

	    comm.send(url_v, data_v, "POST", function(json) {
			isRedownLastChk_v = json.isRedownLastChk;

			if(loginCheck == "") {			
				loginPop.show('', "/M/expected.asp", true);
			} else {
				var item = {};
				item.expapr_no = expapr_no_v;
				item.expapr_group = group_v;
				item.title = title_v;
				item.format = formats_v;
				item.coretype = coretype_v;

				_get_Btn_Price(item);
				fetch("/Include/ajax/toggle_action_log_insert_ajax.asp?log_type=3&exam_type=AUTOEXAM&expapr_no="+expapr_no_v+"&current_toggle="+current_toggle);
				ExamDownload_AutoExam_V2(loginCheck, expapr_no_v, subject_v, _site_id, grade_v, part_id_v, exam_index_v, isRedownLastChk_v, group_v);
			}
		});
	}

	return {
		init:function() {
			_init();
		},
		initEvent: function(){
			_initEvent();
		},
		loadData_2_V: function() {
			_loadData_2_V();
		},
		icon_click: function(exam_index) {
			_icon_click(exam_index);
		},
		get_Btn_Price: function(item) {
			_get_Btn_Price(item);
		}
	};
}();