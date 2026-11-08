/*
	중등 상품목록
*/
var main = function() {
	var _id = "main";
	var _site_id = "M";
	var _is_previous_chk = false;
	var mem_base_info = {};
	var tweezersPath = "/ZocboMid/Tweezers/Images/";
	var root = null;
	var isFirst = {"menu1":false, "menu2":false, "menu3":false}
	var gradeJson = null;
	var rootpart_codes = null;

	var param = null;

	var MathStepIndex = 0;

	var PageSize = 20;
	var Page = 1;
	var totalPage = 0;
	var totalCount = 0;
	var items = null;

	var imgBtn = null;

	var activeRow = null;

	var selectedInfo = {};

	var oldData_o = null;
	var isOldData = false;
 
	var _url_v = "";
	var _data_v = "";
	var _yusa_si_name = "";		// 기출유사 랜딩 처리시 지역명에 사용할 전역변수

	//가족학원 유무 채크
	var EducationCheck = 0;
	var loginCheck = 0;

	var iPhonePopChk = true;

	var popGradeItems = [{"Name":"1학년", "Value":"1"},
		{"Name":"2학년", "Value":"2"},
		{"Name":"3학년", "Value":"3"}
	];

	var popEngParseItems = [{"Name": "기초", "Value": "6"},
	{"Name": "기본", "Value": "7"},
	{"Name": "심화", "Value": "8"}
	];

	var paMasterItems = [{"Name": "탐구형 수행평가", "Value": "A", "Index":"0"},	{"Name": "서/논술형 수행평가", "Value": "B", "Index":"1"}];
	var paMasterM1Items = [{"Name": "서/논술형 수행평가", "Value": "B", "Index":"0"}];

	var popGroupItems = [];
	var popYearItems = [{"Name":"", "Value":""}];
	var popSubjectItems = [];

	var pop2TypeItems = [
		{"Name":"학교별 기출 무료 열람실", "value":"", "Index":"0", "menuCD":"000010000500001"},
		//{"Name":"학교별 기출유사", "value":"A", "Index":"7", "menuCD":"000010000500002"},
		//{"Name":"학교별 기출족보", "value":"A", "Index":"1"},
		{"Name":"학교별 예상족보", "value":"V", "Index":"2", "menuCD":"000010000500004"},
		//{"Name":"최다빈출 문제", "value":"H", "CoreType":"D", "Index":"5"},
        //{"Name":"최다오답 문제", "value":"H", "CoreType":"E", "Index":"6"},
		//{"Name":"지역별 문제", "value":"I", "Index":"3"},
		{"Name": "강남 3구 유형공략", "value": "K3", "Index":"4", "menuCD":"000010000500005"}
	];
	var popGrade2Items = [
	{"title":"1학년", "value":"1"},
	{"title":"2학년", "value":"2"},
	{"title":"3학년", "value":"3"}
	];

	var gu2Items = [];
	var sch2Items = [];
	var fileType2Items = [{"Name":"원본형 + 편집용", "Value":""}, {"Name":"편집용", "Value":"4"}];

	var subject3Items = [];
	var tx3Items = [];
	var chapter3Items = [];

	var sub3Items = [{"Name":"기본학습", "Value":"1"},
	{"Name":"실전적용", "Value":"2"}
	];
	var pubItems = [];

	var grammerYearItems = [{"Name": "기초", "Value": "1"},
	{"Name": "기본", "Value": "2"},
	{"Name": "심화", "Value": "3"},
	{"Name": "완성", "Value": "4"},
	];

	var grammerKindItems = [{title: "동영상", Value: ""}, {title: "다운로드", Value: ""}];

	var chapterItems = [];

	var levelItems = [];

	var termItems = null;

	var popSub3Items = [];

	var pageCnt = 0;

	var page_Act_Chk = true;	 //학년, 과목, 구분값 클릭시만 true

	var errorItems = [
	{"Name":"오답신고", "value":"2"},
	{"Name":"불량신고", "value":"3"},
	{"Name":"건의사항", "value":"5"}
	];

	var popTxItems = [];

	var _add_diff = "";
	var p_add_diff = ""
	var _chapterDatas = [];

	var _init = function() {
		var this_val = document.querySelector("#fixMenu01");
			$(this_val).addClass("on");

		root = document.querySelector("[data-id='" + _id + "']");
		param = util.queryStringToJSON(null);
		if(param == null) {
			param = {};
			param.menu = 1;
		}
		else if(param.menu == null) {
			param = {};
			param.menu = 1;
		}

		if(param.menu == 1 && param.oldData != "Y") {//개념완성 리뉴얼 페이지로 이동
			if(param.subject == 1) {//영어일 경우
				if (param.group == 1) {//영문법
					location.href = "/exam/examListWeb.asp?menu_cd=000010000100002&siteid=M&subject_cd=EG";
					return;	
				} else if (param.group == 2) {//구문독해
					location.href = "/exam/examListWeb.asp?menu_cd=000010000100003&siteid=M&subject_cd=EG";
					return;	
				}
			}
			
			if(param.subject == 2) {//수학일 경우
				if (param.group == 1) {//계산력문제
					location.href = "/exam/examListWeb.asp?menu_cd=000010000100004&siteid=M&subject_cd=MT";
					return;	
				}
			}
			
			//나머지 개념완성으로 리다이렉트
			location.href = "/exam/examListWeb.asp?menu_cd=000010000100001&siteid=M&subject_cd=MT";
			return;			
		}

		if(param.menu == 3)
		{
			location.href = '/Default.asp';
			return;
		}

		if(param.menu == 4 && param.oldData != "Y") {//Ai 수준별학습 리뉴얼 페이지로 이동
			if (param.group == "1") {//수학MASTER랜딩
				location.href = '/exam/examListWeb.asp?menu_cd=000010000200002&siteid=M&subject_cd=MT';				
			} else {//수준별학습
				location.href = '/exam/examListWeb.asp?menu_cd=000010000200003&siteid=M&subject_cd=MT';
			}
			return;			
		}

		if(param.menu == 5 && param.oldData == "Y") {
			isOldData = true;
		}

		if(param.menu == 5 && param.oldData != "Y") {//실전대비 > 리뉴얼 페이지로 이동
			if(param.learningtest == "Y") {
				let menucd = "0000100003";
				let subject_cd = "MT";

				if(param.subject == 0) {
					subject_cd = "KR";
				} else if(param.subject == 1) {
					subject_cd = "EG";
				}

				if(param.group == 0) {
					menucd = menucd + "00001";
				} else if(param.group == 1) {
					if(subject_cd == "EG") {
						menucd = menucd + "00007";
					} else {
						menucd = menucd + "00002";
					}					
				} else if(param.group == 2) {
					menucd = menucd + "00003";
				} else if(param.group == 4) {					
					menucd = menucd + "00008";
				}

				location.href = "/exam/examListWeb.asp?menu_cd=" + menucd + "&siteid=M&subject_cd=" + subject_cd + "&grade=" + param.grade;
				return;
			} else {
				location.href = "/exam/examListWeb.asp?menu_cd=000010000300001&siteid=M&subject_cd=MT";
				return;
			}
		}

		if(param.menu == 6) {//직전대비 리뉴얼 페이지로 이동
			location.href = "/exam/examListWeb.asp?menu_cd=000010000400001&siteid=M&subject_cd=MT";
			return;
		}		

		imgBtn = document.querySelector("#bindo");
		if(imgBtn) imgBtn.style.display = "none";
		// --> selectInfo --> generating
		//console.log("param=" + JSON.stringify(param));

		commonGLB.setStorage(storage.SEARCH_MENU_CD, "");//메뉴코드 초기화

		setInitConfig(function() {
			if(selectedInfo.menuIndex == 4 && selectedInfo.groupIndex == 3) {//실전대비 > 최상위공략
				location.href = "/M/exam_top_table.asp";
				return;
			}

			_loadInitData();
			_initDraw();
			//_initEvent();

			$(window).scroll(function() {				
				var m_i = parseInt($(window).scrollTop());
				var s_i = $(document).height() - $(window).height();
				var season_State = $("#season_State").val();

				if(season_State == 'Y')
				{
					if(m_i > 0)
					{
						$(".mo-label.grade15").hide();
						//$(".mo-label.new-img").hide();
					}
					else
					{
						$(".mo-label.grade15").show();
						//$(".mo-label.new-img").show();
					}
				}				

				// aos 삼성브라우저 하단기본 스크롤이 60 이상이어서 60 -> 150 으로 조정
				//if (m_i + 60 >= s_i && isLoading == false) {
				if (m_i + 150 >= s_i && isLoading == false) {
					if(totalPage > Page) {
						//if(selectedInfo.menuIndex != 1 && parseInt(pop2TypeItems[selectedInfo.type2Index].Index) != 2) {
						if(selectedInfo.menuIndex == 1 && parseInt(pop2TypeItems[(selectedInfo.type2Index == undefined) ? 0 : selectedInfo.type2Index].Index) == 2) {
						} 
						else if(selectedInfo.menuIndex == 1 && parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 0 && sch2Items[selectedInfo.sch2Index].Scl_ID == "")
						{
						}
						else {
							Page++;
							_loadData();
						}
					}
				}
			});

		});
	};

	var isLoading = false;
	// 이벤트 초기화
	var _initEvent = function() {
		if (mainCLS.init == true) {
			mainCLS.pageInit();
			mainCLS.init = false;
		}
		mainCLS.setViewAppGoUI();

		if(root) {
			var selector_str = "[data-src='" + _id + "'][data-act]";
			$(root).find(selector_str).unbind();
			$(root).find(selector_str).bind("click", function() {return false;});
			$(root).find(selector_str).bind("click", function(ev) {_click(ev);});

			selector_str = "[name='qry']";
			$(root).find(selector_str).unbind();
			$(root).find(selector_str).bind("keydown", function(ev){
				if(ev.keyCode == 13) {
					var evo = ev.target;
					$(evo).blur();
					_setSelectedValue();
				}
			});

		}
		player.initEvent();
		common.resetA();
		common.init();
	};

	var _setPreviousCheck = function() {
		var url_v = "/_api/member.api.asp";
		var data_v = "cmd=GET_MEMBER_PREVIOUS_CHECK";

		$.ajax({
			type : "POST"
			, url : url_v
			, data : data_v
			, dataType : "json"
			, contentType: "application/x-www-form-urlencoded; charset=eur-kr"
			, async : false
			, success : function(data) {
				//AI_250808
				/*if (data.result == "Y") {
					_is_previous_chk = true;
					pop2TypeItems = [
						//{"Name":"학교별 기출 무료 열람실", "value":"", "Index":"0"},
						{"Name":"학교별 Ai기출유사", "value":"A", "Index":"7"},
						{"Name":"학교별 Ai기출변형", "value":"W", "Index":"8"},
						{"Name":"학교별 기출족보", "value":"A", "Index":"1"},
						{"Name":"학교별 Ai예상족보", "value":"V", "Index":"2"},
						//{"Name":"최다빈출 문제", "value":"H", "CoreType":"D", "Index":"5"},
						//{"Name":"최다오답 문제", "value":"H", "CoreType":"E", "Index":"6"},
						//{"Name":"지역별 문제", "value":"I", "Index":"3"},						
						{"Name":"학교별 기출 무료열람실", "value":"", "Index":"0"},
						{"Name":"강남 3구 유형공략", "value": "K3", "Index":"4"},
						{"Name":"빠른족보", "value":"", "Index":"9"}
					];
				} else {
					_is_previous_chk = false;
					pop2TypeItems = [
						//{"Name":"학교별 기출 무료 열람실", "value":"", "Index":"0"},
						{"Name":"학교별 Ai기출유사", "value":"A", "Index":"7"},
						{"Name":"학교별 Ai기출변형", "value":"W", "Index":"8"},
						{"Name":"학교별 Ai예상족보", "value":"V", "Index":"2"},
						//{"Name":"최다빈출 문제", "value":"H", "CoreType":"D", "Index":"5"},
						//{"Name":"최다오답 문제", "value":"H", "CoreType":"E", "Index":"6"},						
						{"Name":"학교별 기출 무료열람실<span class='mo-label grade15 mid' style='margin-left:10px;height:17px;line-height:17px;margin-top:-3px;'>무료열람</span>", "value":"", "Index":"0"},
						{"Name":"강남 3구 유형공략", "value": "K3", "Index":"4"},
						{"Name":"빠른족보", "value":"", "Index":"9"}
					];
				}*/
				if (data.result == "Y") {
					_is_previous_chk = true;
					pop2TypeItems = [
						//{"Name":"학교별 기출 무료 열람실", "value":"", "Index":"0"},
						//{"Name":"학교별 기출유사", "value":"A", "Index":"7", "menuCD":"000010000500002"},
						{"Name":"학교별 기출변형", "value":"W", "Index":"8", "menuCD":"000010000500003"},
						{"Name":"학교별 기출족보", "value":"A", "Index":"1"},
						{"Name":"학교별 예상족보", "value":"V", "Index":"2", "menuCD":"000010000500004"},
						//{"Name":"최다빈출 문제", "value":"H", "CoreType":"D", "Index":"5"},
						//{"Name":"최다오답 문제", "value":"H", "CoreType":"E", "Index":"6"},
						//{"Name":"지역별 문제", "value":"I", "Index":"3"},						
						{"Name":"학교별 기출 무료열람실", "value":"", "Index":"0", "menuCD":"000010000500001"},
						{"Name":"강남 3구 유형공략", "value": "K3", "Index":"4", "menuCD":"000010000500005"},
						// {"Name":"빠른족보", "value":"", "Index":"9"}
					];
				} else {
					_is_previous_chk = false;
					pop2TypeItems = [
						//{"Name":"학교별 기출 무료 열람실", "value":"", "Index":"0"},
						//{"Name":"학교별 기출유사", "value":"A", "Index":"7", "menuCD":"000010000500002"},
						{"Name":"학교별 기출변형", "value":"W", "Index":"8", "menuCD":"000010000500003"},
						{"Name":"학교별 예상족보", "value":"V", "Index":"2", "menuCD":"000010000500004"},
						//{"Name":"최다빈출 문제", "value":"H", "CoreType":"D", "Index":"5"},
						//{"Name":"최다오답 문제", "value":"H", "CoreType":"E", "Index":"6"},						
						{"Name":"학교별 기출 무료열람실<span class='mo-label grade15 mid' style='margin-left:10px;height:17px;line-height:17px;margin-top:-3px;'>무료열람</span>", "value":"", "Index":"0", "menuCD":"000010000500001"},
						{"Name":"강남 3구 유형공략", "value": "K3", "Index":"4", "menuCD":"000010000500005"},
						// {"Name":"빠른족보", "value":"", "Index":"9"}
					];
				}
			}
		});
		
//		var k3_show_target = $("#k3_show_target").val();
//
//		if(k3_show_target != "Y") {
//			for(var i = 0; i < pop2TypeItems.length; i++) {
//				if(pop2TypeItems[i].value == "K3") {
//					pop2TypeItems.splice(i, 1);
//				}
//			}
//		}
	}
	// 페이지 진입시 파라미터에 따라 필터 및 보여줄 데이터 설정
	var setInitConfig = function(_cback) {
		//var gradeSet_v = localStorage.getItem("gradeSet1"); // 학년 설정 값
		var gradeSet_v = null;		// 기본 설정 사용 안함 (정효태, 2022.02.22)
		var data_m_v = localStorage.getItem("data_m"); 		// 쿠키 설정 값
		var gradeSet_o = null
		var data_m_o = null;
		if(gradeSet_v) {
			gradeSet_o = eval("(" + gradeSet_v + ")");
			gradeJson = gradeSet_o;
		}

		if(data_m_v) {
			selectedInfo = eval("(" + data_m_v + ")");
		}
		else {
			selectedInfo = {};
		}

		// 기출 노출 여부
		//var is_previous_chk = false;
		if(param.menu == 2 || param.sms) {
			_setPreviousCheck();
		}
		// E

		// 2) 기존 로직 적용 (바깥에 있던걸 안으로 이동)
		_hLog("setInitConfig data_m=" + JSON.stringify(selectedInfo));
		_hLog("setInitConfig gradeSet=" + JSON.stringify(gradeSet_o));
		var isParam = false;
		
		if(param != null && param.menu != null) {
			selectedInfo.menuIndex = param.menu - 1;

			// S : <기출, 예상> 기본 학년정보 설정
			if (selectedInfo.menuIndex == 1) {	// 학교별 족보에서만 필요
				var season_State = $("#season_State").val();

				if(season_State == "Y")
				{
					//selectedInfo.type2Index = 1;
				}
				else
				{
					selectedInfo.type2Index = 0;
				}

				if(param.yusa == "Y")
				{
					selectedInfo.si2Index = param.si;
					selectedInfo.gu2Index = param.gu;
					selectedInfo.sch2Index = param.scl;

					//_setHierarchy();
				}
				else if(param.yusatype)
				{
				}
				else
				{
					var url_v = "/_api/member.api.asp";
					var data_v = "cmd=GET_MEMBER_INTEGRATION_BASE_INFO&flag=M";
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
										//param.si = i;
										mem_base_info.gugun = data.list[0].gugun;
										mem_base_info.scl_id = data.list[0].scl_id;
										mem_base_info.grade = data.list[0].grade;
									}
								})

								if ( mem_base_info.grade && !isNaN(mem_base_info.grade)) {
									selectedInfo.grade2Index = (parseInt(mem_base_info.grade) > 3) ? 2 : parseInt(mem_base_info.grade)- 1;
									//selectedInfo.grade2Index = mem_base_info.grade;
								} else {
									selectedInfo.grade2Index = 1;
								}
							}
							else
							{
								if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 0) {
									selectedInfo.si2Index = 0;
								}
							}
						}
					});
				}
			}
			// E

			//수준별 AI 학습 내 이전 개정 자료 보기 시
			if (selectedInfo.menuIndex == 3 && param.oldData == "Y") {
				param.grade = 1
			}

			if((param.qry != null && param.qry != "") || (param.qryN != null && param.qryN != "")){
				// 통합검색에서 중등 페이지 진입시 값 설정
				isParam = true;
				if(param.type == null) {
					param.type = 2;
				}

				if(selectedInfo.menuIndex == 0 || selectedInfo.menuIndex == 3 || selectedInfo.menuIndex == 4) {
					if(param.qry != null && param.qry != "") {
						var qry_o = root.querySelector("#filter_1 [name='qry']");
						if(qry_o) {
							qry_o.value = param.qry;
						}
					}
					if(param.grade) {
						selectedInfo.gradeIndex = param.grade;
					}

					if(param.group) {
						selectedInfo.groupIndex = param.group;
						selectedInfo.subjectIndex = 0;
						selectedInfo.subjectCode = "KR";
						selectedInfo.subjectName = "국어";
					}
					if(param.group == 6) {
						selectedInfo.subjectIndex = 0;
						selectedInfo.subjectCode = "KR";
						selectedInfo.subjectName = "국어";
					}
					else if(param.group == 3) {
						selectedInfo.subjectIndex = 0;
						selectedInfo.subjectCode = "KR";
						selectedInfo.subjectName = "국어";
					}
				}
				else if(selectedInfo.menuIndex == 1) {
					if(param.qry != null && param.qry != "") {
						var qry_o = root.querySelector("#filter_2 [name='qry']");
						if(qry_o) {
							qry_o.value = param.qry;
						}
					}

					if(param.type) {
						selectedInfo.type2Index = param.type;
					}

					if(param.type == 4)
					{
						if (param.grade != "" && param.grade != null)
						{
							selectedInfo.gradeK3Index = parseInt(param.grade) - 2;
						}
					}

					if(param.grade != "" && param.grade != null) {
						selectedInfo.gradeIndex = parseInt(param.grade);
					}
				}
				else if(selectedInfo.menuIndex == 2) {
					if(param.qry != null && param.qry != "") {
						var qry_o = root.querySelector("#filter_3 [name='qry']");
						if(qry_o) {
							qry_o.value = param.qry;
						}
					}
				}

			}

			if(param.type != "" && param.type != null){
				if(selectedInfo.menuIndex == 1) {					
					//selectedInfo.type2Index = param.type;
					selectedInfo.type2Index = (_is_previous_chk || parseInt(param.type) < 3) ? param.type : (parseInt(param.type)-1);
				}
			}

			if(param.grade != "" && param.grade != null) {
				if(selectedInfo.menuIndex == 0 || selectedInfo.menuIndex == 3 || selectedInfo.menuIndex == 4 || selectedInfo.menuIndex == 5) {
					selectedInfo.gradeIndex = parseInt(param.grade) -1;
				}
				// 추가작업 / 2020-11-11 / 김진국
				else if (selectedInfo.menuIndex == 1) {
					selectedInfo.grade2Index = parseInt(param.grade) -1;
				}

				if(param.type == 3) {
					if (param.grade != "" && param.grade != null) {
						selectedInfo.gradeK3Index = parseInt(param.grade) - 2;
					}
				}
			}

			if(param.subject != "" && param.subject != null) {
				if(selectedInfo.menuIndex == 0 || selectedInfo.menuIndex == 3 || selectedInfo.menuIndex == 4 || selectedInfo.menuIndex == 5) {
					selectedInfo.subjectIndex = param.subject;			
					if (typeof(pop2TypeItems[selectedInfo.gradeIndex]) == "undefined") { selectedInfo.gradeIndex = 0; }
					popSubjectItems = Object.values(_Unit[_site_id + (selectedInfo.gradeIndex-0+1)]);
					selectedInfo.subjectCode = popSubjectItems[param.subject].Value;
					selectedInfo.subjectName = popSubjectItems[param.subject].Name;
				}
				// 추가작업 / 2020-11-11 / 김진국
				else if (selectedInfo.menuIndex == 1) {
										if(param.yusa == "Y")
					{
						selectedInfo.grade2Index = param.grade;
					}

					selectedInfo.subject2Index = param.subject;
					popSubjectItems = Object.values(_Unit[_site_id + (selectedInfo.grade2Index-0+1)]);
					selectedInfo.subject2Code = popSubjectItems[param.subject].Value;
					selectedInfo.subject2Name = popSubjectItems[param.subject].Name;
				}
							}

			if(param.group != "" && param.group != null) {
				if(selectedInfo.menuIndex == 0 || selectedInfo.menuIndex == 3 || selectedInfo.menuIndex == 4) {
					selectedInfo.groupIndex = param.group;
				}
			}

			if(param.group && param.grade && param.subject) {
				if(selectedInfo.menuIndex == 0 || selectedInfo.menuIndex == 3 || selectedInfo.menuIndex == 4) {
					if(param.subject != 1) {
						selectedInfo.yearIndex = 0;
						selectedInfo.termIndex = 0;
					}
				}
			}

			//레벨 설정
			if (isValueEmpty(param.level) == false && isValueEmpty(selectedInfo.subjectIndex) == false && isValueEmpty(selectedInfo.gradeIndex) == false) {
				selectedInfo.levelData = [];
				var arr_temp_level_cd = param.level.split(',');
				popSubjectItems = Object.values(_New_Unit[_site_id + (selectedInfo.gradeIndex-0+1) + "_" + (selectedInfo.menuIndex-0+1)]);
				
				if (arr_temp_level_cd.length > 0) {
					for (var i = 0; i < arr_temp_level_cd.length ;i ++ ) {
						var mItem = popSubjectItems[selectedInfo.subjectIndex].level[arr_temp_level_cd[i]];
						selectedInfo.levelData.push(mItem);

						if (p_add_diff == "") {
							p_add_diff = mItem.Value;
						} else {
							p_add_diff += "," + mItem.Value;
						}
					}
				}
				_add_diff = p_add_diff;
			}

			// S : sms발송용 링크 만들기 / 2021-11-02 / 김진국
			// is_previous_chk = false 인 경우 index가 2이상인 경우는 type2index -1 처리
			param.replace = false;
			if (param.sms) {
				if (param.menu == 1) {		// 내신완성
					// 공통
					if (param.sms == 1 || param.sms == 2 || param.sms == 3 || param.sms == 4) {
						selectedInfo.subjectCode = "MT";
						selectedInfo.subjectName = "수학";
						selectedInfo.subjectIndex = 2;
						selectedInfo.txIndex = 0;
						selectedInfo.yearIndex = 0;
						selectedInfo.termIndex = 0;
						selectedInfo.chapterIndex = 0;
						selectedInfo.yearIndex = 0;
						selectedInfo.termIndex = 0;

						// 기본값 3학년
						if(param.grade == "" || param.grade == null || param.grade == undefined) {
							param.grade = 3;
						}
					}

					if (param.sms == 1) {
						selectedInfo.gradeIndex = parseInt(param.grade) -1;
						selectedInfo.groupIndex = 1;		// 1은 단원별~
						//selectedInfo.subjectIndex = 2;		// 2는 수학~
					} else if (param.sms == 2) {
						selectedInfo.gradeIndex = parseInt(param.grade) -1;
						//selectedInfo.subjectIndex = 2;		// 2는 수학~
						selectedInfo.groupIndex = 8;		// 8은 수학 교과서 변형~
					}
					/*else if (param.sms == 3) {
						selectedInfo.gradeIndex = parseInt(param.grade) -1;
						selectedInfo.groupIndex = 3;		// 3은 최다빈출~
					} else if (param.sms == 4) {
						selectedInfo.gradeIndex = parseInt(param.grade) -1;
						selectedInfo.groupIndex = 4;		// 4는 최다오답~
					}
					*/
				} else if (param.menu == 2) {		// 학교별족보
					selectedInfo.menuIndex = 1		// 내신완성 -> 학교별족보로 메뉴 변경

					if (param.sms == 4) {		// 최다오답
						selectedInfo.type2Index = (_is_previous_chk) ? 5 : 4;
					} else if (param.sms == 3) {		// 예상족보
						selectedInfo.type2Index = (_is_previous_chk) ? 3 : 2;
					} else if (param.sms == 2) {		// 기출유사
						selectedInfo.type2Index = 1;
						selectedInfo.subject2Index = 0;
					} else if (param.sms == 1) {		// 무료열람실
						selectedInfo.type2Index = 0;
						selectedInfo.si2Index = 0;
						selectedInfo.gu2Index = 0;
						selectedInfo.sch2Index = 0;
						selectedInfo.subject2Index = 0;
					}
					else if(param.sms == 5)
					{
						selectedInfo.type2Index = (_is_previous_chk) ? 4 : 3;
					}

					// 공통 설정
					{
						if ( param.grade && !isNaN(param.grade)) {
							selectedInfo.grade2Index = parseInt(param.grade) - 1;
						} else {
							selectedInfo.grade2Index = 0;
						}

						selectedInfo.gradeK3Index = 1;
						selectedInfo.pub2Index = 0;
						selectedInfo.year2Index = 0;
						selectedInfo.term2Index = 0;
						selectedInfo.fileType2Index = 0;
					}
				}

				// 트래킹 추적용 로그 적재
				if(param.utmchk == "Y") {
					var land_url = "/_api/common.api.asp";
					var land_data = "cmd=SMS_TRACKING_LOG&utm="+param.utm_campaign+"#"+param.utm_content+"#"+param.utm_term+"#"+param.sms;
					comm.send(land_url, land_data, "post", function(json) {
						//console.log(json);
					});
				}
			}
			// E : sms발송용 링크 만들기 / 2021-11-02 / 김진국

			if(param.yusa == "Y")
			{
				selectedInfo.grade2Index = param.grade;
							}
		}

		// 통합검색이 아닌경우
		if(isParam == false) {
			// 학년설정값을 토대로 값 설정
			if(gradeSet_o) {
				var grade_v = parseInt(gradeSet_o.grade.substring(1));
				if(selectedInfo.menuIndex == 0 || selectedInfo.menuIndex == 3 || selectedInfo.menuIndex == 4) {
					if(gradeSet_o.grade == "M1" || gradeSet_o.grade == "M2" || gradeSet_o.grade == "M3") {
						selectedInfo.gradeIndex = grade_v - 1;
					}
					if(typeof(_cback) == "function") { _cback();}
				}
				else if(selectedInfo.menuIndex == 1) {
					if(gradeSet_o.grade == "M1" || gradeSet_o.grade == "M2" || gradeSet_o.grade == "M3") {
						selectedInfo.grade2Index = grade_v - 1;
						var Rg_City_v 		= gradeSet_o["Rg_City"];
						var Rg_District_v 	= gradeSet_o["Rg_District"];
						var Rg_School_v 	= gradeSet_o["Rg_School"];

						if(Rg_City_v) {
							for(var pi = 0; pi < _SI_LIST.length; pi++) {
								if(_SI_LIST[pi].Name == Rg_City_v) {
									selectedInfo.si2Index = pi;
									break;
								}
							}
						}
						if(Rg_District_v) {
							var url_v = "/_api/community.api.asp";
							var data_v = "cmd=GET_REGION_LIST&si=" + Rg_City_v;
							comm.send(url_v, data_v, "post", function(json_p1) {
								var gu2Items_t = json_p1.list;
								if(gu2Items_t.length == 0) {
									gu2Items_t = [{"Name":"구/군", "Value":""}];
								}
								for(var pj = 0; pj < gu2Items_t.length; pj++) {
									if(Rg_District_v == gu2Items_t[pj].rg_District.trim()) {
										selectedInfo.gu2Index = pj + 1;
										break;
									}
								}
								if(Rg_School_v) {
									var url2_v = "/_api/community.api.asp";
									var data2_v = "cmd=GET_SCHOOL_LIST&site_id=" + _site_id + "&si=" + encodeURIComponent(Rg_City_v);
									data2_v = data2_v + "&region=" + encodeURIComponent(Rg_District_v);
									comm.send(url2_v, data2_v, "post", function(json2) {
										sch2Items = [{"Name":"학교", "Value":"", "Scl_ID":""}].concat(json2.list);
										for(var pk = 0; pk < sch2Items.length; pk++) {
											if(Rg_School_v == sch2Items[pk].Scl_ID) {
												selectedInfo.sch2Index = pk;
												break;
											}
										}
										if(typeof(_cback) == "function") { _cback();}
									});
								}
								else {
									if(typeof(_cback) == "function") { _cback();}
								}
							});
						}
						else {
							if(typeof(_cback) == "function") { _cback();}
						}

					}
					else {
						if(typeof(_cback) == "function") { _cback();}
					}
				}
				else if(selectedInfo.menuIndex == 2) {
					if(gradeSet_o.grade == "M1" || gradeSet_o.grade == "M2" || gradeSet_o.grade == "M3") {
						selectedInfo.grade3Index = grade_v - 1;
	//						if(grade_v == 3) {
	//							// 고득점마스터의 3학년이 없어진 관계로 중3 설정시 2학년이 선택되도록 변경
	//							selectedInfo.grade3Index = grade_v - 2;
	//						}
					}
					if(typeof(_cback) == "function") { _cback();}
				}
			}
			else {
				if(typeof(_cback) == "function") { _cback();}
			}
		}
		else {
			if(typeof(_cback) == "function") { _cback();}
		}
	};

	// 초기 데이터 설정
	var _loadInitData = function() {

		// 가족학원 유무 채크
		var url_v = "/_api/member.api.asp";
		var data_v = "cmd=GET_MEMBER_EDUCATION_CHECK";
		comm.send(url_v, data_v, "post", function(data) {
			//console.log(data.RESULTCODE);
			EducationCheck = data.RESULTCODE;  // 1 : 가족학원, 0 : 일반
		});

		var url_vv = "/_api/member.api.asp";
		var data_vv = "cmd=ISLOGIN";
		comm.send(url_vv, data_vv, "post", function(data) {
			loginCheck = data.user_id;  // 1 : 가족학원, 0 : 일반
		});

		if(imgBtn) imgBtn.style.display = "none";
		if(selectedInfo.menuIndex == 0 || selectedInfo.menuIndex == 3 ||selectedInfo.menuIndex == 4 ||selectedInfo.menuIndex == 5) {
			if(param.tx_code){
				selectedInfo.txIndex = param.tx_code;
			}

			// 영문법 페이지 배너, url 직접 접근 시 완성 컨텐츠가 고정된 상태로 표시
			//if(selectedInfo.groupIndex == 6 && selectedInfo.subjectCode == "EG")
			//{
			//	selectedInfo.yearIndex = 3;
			//}

			// 구해줘 족보 이벤트에서 접속시 처리
			if(param.seek){
				selectedInfo.gradeIndex = param.grade - 1;
				selectedInfo.subjectIndex = param.subject;
				var _subjectCode = param.subjectCode;
				selectedInfo.subjectCode = _subjectCode;
				selectedInfo.groupIndex = param.group;
				// _hLog("paramGroup:" + param.group);
				// _hLog("paramSubj:" + param.subject);
				if(param.group == 1){

					selectedInfo.txIndex = param.tx_code - 1;
					if(param.grade == 1 || param.grade == 2){
						if(param.grade == 1){
							if(_subjectCode == "LS" || _subjectCode == "HI"
								|| _subjectCode == "ET" || _subjectCode == "TH"){
								selectedInfo.txIndex = 0;
						}
					}
				}

				if(_subjectCode == "MT" || _subjectCode == "SC"){
					selectedInfo.txIndex = 0;
				}
			}
			else if(param.group == 4){
				if(param.grade == 2){
					selectedInfo.subjectIndex = param.subject - 0 + 2;
				}

				if(_subjectCode == "ET" || _subjectCode == "TH"){
					selectedInfo.groupIndex = param.group - 1;
				}

				selectedInfo.txIndex = param.tx_code;
				if(param.grade == 1 || param.grade == 2){
					if(param.grade == 1){
						if(_subjectCode == "LS" || _subjectCode == "HI"){
							selectedInfo.txIndex = 0;
						}
					}

					if(_subjectCode == "ET" || _subjectCode == "TH"){
						selectedInfo.txIndex = 0;
					}
				}

				if(_subjectCode == "MT" || _subjectCode == "SC"){
					selectedInfo.txIndex = 0;
				}
			}
			_setHierarchy();
			popTxItems = _Hierarchy[selectedInfo.gradeIndex].Subj_Code[selectedInfo.subjectIndex].TX_CODE;
				// _hLog("selectedInfo.gradeIndex=" + selectedInfo.gradeIndex);
				// _hLog("selectedInfo.subjectIndex=" + selectedInfo.subjectIndex);
				// _hLog("selectedInfo.groupIndex=" + selectedInfo.groupIndex);
				// _hLog("selectedInfo.txIndex=" + selectedInfo.txIndex);
			}
			else if( gradeJson && gradeJson.grade.indexOf("M") > -1) {
				// 학년 설정 값이 있을 경우 기본값 설정
				selectedInfo.subjectCode = "MT";
				selectedInfo.groupIndex = 1;
				selectedInfo.subjectIndex = 2;
				selectedInfo.subjectName = "수학";
				selectedInfo.txIndex = 0;
				if (selectedInfo.yearIndex == null) selectedInfo.yearIndex = 0;
				if (selectedInfo.termIndex == null) selectedInfo.termIndex = 0;
				if (selectedInfo.chapterIndex == null) selectedInfo.chapterIndex = 0;
				if (selectedInfo.chapterData == null) selectedInfo.chapterData = [];
				if (selectedInfo.levelIndex == null) selectedInfo.levelIndex = 0;
				if (selectedInfo.levelData == null) selectedInfo.levelData = [];
			}

			if(selectedInfo.gradeIndex == null) selectedInfo.gradeIndex = 1;
			if(selectedInfo.subjectCode == null) selectedInfo.subjectCode = "MT";
			if(selectedInfo.groupIndex == null) selectedInfo.groupIndex = 0;
			if(selectedInfo.subjectCode == "G") selectedInfo.termIndex  = 1;
			_setHierarchy();
			if(selectedInfo.subjectIndex == null) selectedInfo.subjectIndex = 2;
			if(selectedInfo.txIndex == null) selectedInfo.txIndex = 0;
			if(selectedInfo.yearIndex == null) selectedInfo.yearIndex = 0;
			if(selectedInfo.termIndex == null) selectedInfo.termIndex = 0;
			if(selectedInfo.chapterIndex == null) selectedInfo.chapterIndex = 0;
			if(selectedInfo.chapterData == null) selectedInfo.chapterData = [];
			if (selectedInfo.levelIndex == null) selectedInfo.levelIndex = 0;
			if (selectedInfo.levelData == null) selectedInfo.levelData = [];

			// 수준별 학습은 최초진입시 무조건 단계별 학습으로
			if (selectedInfo.menuIndex == 3) {
				if(typeof param.group != "undefined")
				{
					selectedInfo.groupIndex = 1;
				}
				else
				{
					selectedInfo.groupIndex = 0;
				}				
			}

			// 콘텐츠 개편하면서 수정사항
			selectedInfo.yearIndex = 0;
			selectedInfo.termIndex = 0;

		}
		else if(selectedInfo.menuIndex == 1) {
			if (typeof(pop2TypeItems[selectedInfo.type2Index]) == "undefined") { selectedInfo.type2Index = 0; }
			if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 0) {
				selectedInfo.type = param.type;
				selectedInfo.subjectIndex = 0;
				selectedInfo.subjectCode = "";
				selectedInfo.groupIndex = 0;
				selectedInfo.type2Index = 0;

				if(param.si){
					selectedInfo.si2Index = param.si;
				}

				selectedInfo.gu2Index = 0;
				selectedInfo.sch2Index = 0;

				// 학년값을 파라미터로 받지 않은 경우에만
				if(isNaN(param.grade)) {
					if ( mem_base_info.grade && !isNaN(mem_base_info.grade)) {
						selectedInfo.grade2Index = (parseInt(mem_base_info.grade) > 3) ? 2 : parseInt(mem_base_info.grade) - 1;
					} else {
						selectedInfo.grade2Index = 0;
					}
				}

				//selectedInfo.grade2Index = 0;
				selectedInfo.gradeK3Index = 0;
				selectedInfo.subject2Index = 0;
				selectedInfo.subjectIndex = 0;
				selectedInfo.year2Index = 0;
				selectedInfo.term2Index = 0;
				_setHierarchy();
			}
			else
			{
				if(param.si){
					selectedInfo.si2Index = param.si;
				}

				if(param.seek){
					selectedInfo.type2Index = param.type;
					selectedInfo.si2Index = param.si;
					selectedInfo.grade2Index = param.grade - 1;
					selectedInfo.subject2Index = param.subject;
				}
				//브랜드 전략실 기출족보 검색어 유입
				else if(param.evt){
					selectedInfo.type = param.type;
					selectedInfo.subjectIndex = 0;
					selectedInfo.subjectCode = "";
					selectedInfo.groupIndex = 0;

					selectedInfo.type2Index = 1;
					selectedInfo.si2Index = 0;
					selectedInfo.gu2Index = 0;
					selectedInfo.sch2Index = 0;
					selectedInfo.grade2Index = 1;
					selectedInfo.gradeK3Index = 0;
					selectedInfo.subject2Index = 0;
					selectedInfo.subjectIndex = 0;

					_setHierarchy();
				}

				if(param.yusa == "Y")
				{
					selectedInfo.grade2Index = param.grade;
				}

				if(selectedInfo.type2Index == null) selectedInfo.type2Index = 0;	// 메뉴 : 무료열람실로 초기
				if(selectedInfo.si2Index == null) selectedInfo.si2Index = 0;
				if(selectedInfo.gu2Index == null) selectedInfo.gu2Index = 0;
				if(selectedInfo.sch2Index == null) selectedInfo.sch2Index = 0;
				if(selectedInfo.grade2Index == null) selectedInfo.grade2Index = 1;
				if(selectedInfo.gradeK3Index == null) selectedInfo.gradeK3Index = 0;

				if(pop2TypeItems[selectedInfo.type2Index].Index == "7" || pop2TypeItems[selectedInfo.type2Index].Index == "4") {
					// 학교별 기출유사 default = 0
					if(selectedInfo.subject2Index == null) selectedInfo.subject2Index = 0;		
				} else {
					if(selectedInfo.subject2Index == null) selectedInfo.subject2Index = 2;
				}

				_setHierarchy();
				if(selectedInfo.year2Index == null) selectedInfo.year2Index = 0;
				if(selectedInfo.term2Index == null) selectedInfo.term2Index = 0;
				if(selectedInfo.fileType2Index == null) selectedInfo.fileType2Index = 0;
				if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 1) {
					if(selectedInfo.sch2Index == 0 ) {
						common.toast("학교를 선택해 주세요.", null);
					}
				}
				if(selectedInfo.pub2Index == null) selectedInfo.pub2Index = 0;

				// 기출유사 랜딩 처리 고도화 (2024.07.10)
				if(param.yusatype == "Y") {
					//param.yusatype = "";	// 최초 1회 실행 위해

					// 기본값
					selectedInfo.subject2Index = 3;
					if(param.grade == 1) {
						selectedInfo.subject2Index = 1;
					}
					// E: 기본값

					// 기출년도 셋팅
					var year_s;
					year_s  = new Date().getFullYear() - 1;
					popYearItems = [];

					for(; year_s >= 2022; year_s-- ) {
						var year_o = {};
						year_o["Name"] = year_s + "년 기출";
						year_o["Value"] = year_s;
						popYearItems.push(year_o);
					}

					if(param.year != 2023 && param.year != 2022 && param.year != 2021) {
						selectedInfo.year2Index = 0;
					} else {
						popYearItems.forEach(function(d, i) {
							if (d.Value == param.year) {
								selectedInfo.year2Index = i;
							}
						});
					}
					// E: 기출년도 셋팅

					// 학기 셋팅
					if (popYearItems[selectedInfo.year2Index].Value == "2021") {
						termItems = [{"title": "전체 학기", "Value": ""}, {"title": "2학기 중간", "Value": "2M"}, {"title": "2학기 기말", "Value": "2E"}]
					} else {						
						termItems = [{"title": "전체 학기", "Value": ""}, {"title": "1학기 중간", "Value": "1M"}, {"title": "1학기 기말", "Value": "1E"}, {"title": "2학기 중간", "Value": "2M"}, {"title": "2학기 기말", "Value": "2E"}]
					}

					if(param.year == 2021 && (param.midend == "1M" || param.midend == "1E")){
						selectedInfo.term2Index = 0;
					} else if(param.year < 2021) {
						selectedInfo.term2Index = 0;
					} else {
						termItems.forEach(function(d, i) {
							if (d.Value == param.midend) {
								selectedInfo.term2Index = i;
							}
						});
					}
					// E: 학기 셋팅

					// 과목 셋팅
					_Hierarchy[selectedInfo.grade2Index].Subj_Code.forEach(function(d, i) {						
						if (d.Value == param.subj) {							
							selectedInfo.subject2Index = i;
						}
					});
					// E: 과목 셋팅

					// 지역, 학교정보 셋팅
					var url_v = "/_api/school_info.api.asp";
					var data_v = "cmd=School_Region_l&scl_ID=" + param.scl;
					comm.send(url_v, data_v, "post", function(json) {
						var si_name = json.list[0].si_name;
						var gu_name = json.list[0].gu_name;
						_yusa_si_name = si_name;

						_SI_LIST.forEach(function(d, i) {
							if (d.Name == si_name) {
								selectedInfo.si2Index = i;
							}
						});

						obj = filter_2.querySelector("[data-act='filter2_si']");
						obj.innerHTML = si_name;

						if(gu_name != "") {
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

								obj = filter_2.querySelector("[data-act='filter2_gu']");
								obj.innerHTML = gu_name;

								var url2_v = "/_api/community.api.asp";
								var data2_v = "cmd=GET_SCHOOL_LIST&site_id=" + _site_id + "&si=" + encodeURIComponent(si_name);
								
								data2_v = data2_v + "&region=" + encodeURIComponent(gu_name);

								comm.send(url2_v, data2_v, "post", function(json2) {										
									sch2Items = [{"Scl_Name":"학교", "Value":"", "Scl_ID":""}].concat(json2.list);

									for(var i = 0; i < sch2Items.length; i++) {
										sch2Items[i]["Name"] = sch2Items[i].Scl_Name;
									}

									sch2Items.forEach(function(d, i) {
										if (d.Scl_ID == param.scl) {
											selectedInfo.sch2Index = i;
										}
									});

									obj = filter_2.querySelector("[data-act='filter2_sch']");
									obj.innerHTML = sch2Items[selectedInfo.sch2Index].Name;

									//_setSelectedValueForFilter2SubLoad();
									_setSelectedValue();
								});
							});
						}
					});
					// E: 지역, 학교정보 셋팅
				}
				// E: 기출유사 랜딩 처리 고도화 (2024.07.10)
			}
		}
		else if(selectedInfo.menuIndex == 2) {
			document.querySelector(".txtNotice0716").style.display = "";
			_setHierarchy();
			if(selectedInfo.grade3Index == null) selectedInfo.grade3Index = 1;
			if(selectedInfo.subject3Index == null) selectedInfo.subject3Index = 2;
			if(selectedInfo.tx3Index == null) selectedInfo.tx3Index = 0;
			if(selectedInfo.chapter3Index == null) selectedInfo.chapter3Index = 0;
			if(selectedInfo.sub3Index == null) selectedInfo.sub3Index = 0;
		}
		if (param.isFirst != "Y") {
			_setSelectedValue();
		}
	};

	// 필터 값 저장
	var _saveInitData = function() {
		if(selectedInfo) {
			localStorage.setItem("data_m", JSON.stringify(selectedInfo));
		}
	};

	// 초기 그리기 설정
	var _initDraw = function() {
		if(util.isEmpty(param)) return;
		if(util.isEmpty(param.menu)) return;

		var menuIndex = param.menu - 1;
		var f_1 = root.querySelector("#filter_1");
		var f_2 = root.querySelector("#filter_2");
		var f_3 = root.querySelector("#filter_3");
		var listTop = root.querySelector(".listTop");
		var goPnl = root.querySelector("#goPnl");
		var pnlImg = root.querySelector("#pnlImg");
		var row_A = root.querySelector("#row_A");
		var row_B = root.querySelector("#row_B");
		var row_C = root.querySelector("#row_C");
		var basicTxt = root.querySelector("#basicTxt");
		var season_State = $("#season_State").val();

		if(menuIndex == 5 && season_State == "Y")
		{
			jQuery("#banner_join").hide();
//			var p_o = document.createElement("p");
//			p_o.innerHTML = "<span style='height:40px;padding-top:10px;display:inline-block;'>1학기 기말고사 직전대비 콘텐츠는 <span class='f_blue'>7월 21일까지</span> 다운로드 가능합니다.</span>";
//			document.getElementById("filter_1").prepend(p_o);
		}

		if(menuIndex == 1 && pop2TypeItems[selectedInfo.type2Index].Index == "8" && season_State == "Y")
		{
//			var p_o = document.createElement("p");
//			p_o.innerHTML = "<span style='height:40px;padding-top:10px;display:inline-block;'>1학기 기말고사 AI기출변형 콘텐츠는 <span class='f_blue'>7월 21일까지</span> 다운로드 가능합니다.</span>";
//			document.getElementById("filter_2").prepend(p_o);
		}

		if(menuIndex == 0 || menuIndex == 3 || menuIndex == 4 || menuIndex == 5) {			
			listTop.style.display = "";
			goPnl.style.display = "none";
			pnlImg.style.display = "none";
			f_1.style.display = "";
			f_2.style.display = "none";
			f_3.style.display = "none";
			if (menuIndex == 3 || menuIndex == 4) {
				row_A.style.display = "none";
				row_B.style.display = "";

				/*
				if (util.isEmpty(param.isFoldMode) == false ) {
					if (param.isFoldMode == "Y") {
						$("#fold1").prop("checked", false);
						$("#fold2").prop("checked", true);
						$("#fold1").removeClass("active");
						$("#fold2").addClass("active");
						
						$(".block_list").hide();
					}
				}*/

			} else {
				row_A.style.display = "";
				row_B.style.display = "none";
			}
			row_C.style.display = "none";
			$("#zocboInfo").hide();
			$("#zocboInfo_expect").hide();
			$("#zocboInfo_FreeReading").hide();
			$("#zocboInfo_V").hide();
			$("#zocboInfo_W").hide();
			$("#zocboInfo_HD").hide();
			$("#zocboInfo_HE").hide();
			$("#zocboInfo_I").hide();
			$("#zocboInfo_K3").hide();
			$("#zocboinfoBox").hide();	
			$("#zocboInfo_B").hide();	

			if(menuIndex == 5)
			{
				$("#zocboInfo_B").show();
			}

			activeRow = row_A;
		}
		else if(menuIndex == 1) {
			listTop.style.display = "";
			goPnl.style.display = "none";
			pnlImg.style.display = "none";
			f_1.style.display = "none";
			f_2.style.display = "";
			f_3.style.display = "none";
			row_A.style.display = "";
			row_B.style.display = "none";
			row_C.style.display = "none";
			activeRow = row_A;
			basicTxt.style.display = "none";
		}
		else if(menuIndex == 2) {
			listTop.style.display = "none";
			goPnl.style.display = "none";
			pnlImg.style.display = "none";
			f_1.style.display = "none";
			f_2.style.display = "none";
			f_3.style.display = "";
			row_A.style.display = "none";
			row_B.style.display = "none";
			row_C.style.display = "";
			$("#zocboInfo").hide();
			$("#zocboInfo_expect").hide();
			$("#zocboInfo_FreeReading").hide();
			$("#zocboInfo_V").hide();
			$("#zocboInfo_W").hide();
			$("#zocboInfo_HD").hide();
			$("#zocboInfo_HE").hide();
			$("#zocboInfo_I").hide();
			$("#zocboInfo_K3").hide();
			$("#zocboinfoBox").hide();
			activeRow = row_C;
			basicTxt.style.display = "none";
		}

		selectedInfo.menuIndex = menuIndex;

		var li_o = root.querySelector(".productSelect .active");
		if(li_o) {
			$(li_o).removeClass("active");
		}

		var li_a = root.querySelectorAll(".productSelect li");
		for (var i = 0; i< li_a.length ;i++ ) {
			if (li_a[i].getAttribute("data-mn") == menuIndex+1) {
				li_o = li_a[i];
			}
		}

		if(param.menu == 2 && param.type == 5) {
			$(".tabLine-round_M li").removeClass("active");
			$(".tabLine-round_M li").eq(5).addClass("active");
		} else {
			if(li_o) {
				$(li_o).addClass("active");
			}
		}
	};

	// 하이라키 설정
	var _setHierarchy = function() {
		if(selectedInfo.menuIndex == 0 || selectedInfo.menuIndex == 3 || selectedInfo.menuIndex == 4 || selectedInfo.menuIndex == 5) {

			var group_v = "C";

			var coreType_v;


			if(popGroupItems.length>0) {
				group_v = popGroupItems[selectedInfo.groupIndex].Value;
				coreType_v = popGroupItems[selectedInfo.groupIndex].CoreType;

				if (isValueEmpty(popGroupItems[selectedInfo.groupIndex].menuCD) == false) {
					if (commonGLB.getMenuCD() !== popGroupItems[selectedInfo.groupIndex].menuCD) {
						commonGLB.setStorage(storage.SEARCH_MENU_CD, popGroupItems[selectedInfo.groupIndex].menuCD);//메뉴코드 셋팅
					}
				} else {
					commonGLB.setStorage(storage.SEARCH_MENU_CD, "");
				}
			}

			if(coreType_v == null) coreType_v = "";

			Hierarchy_Init(_site_id, group_v, coreType_v);
		}
		else if(selectedInfo.menuIndex == 1) {
			var group_v = "A";
			var coretype_v = "";

			switch(parseInt(pop2TypeItems[selectedInfo.type2Index].Index)) {
				case 0:					
					coretype_v = "A";
					break;
				case 1:		// 기출족보
					coretype_v = "Z";
					break;
				case 2:
					coretype_v = "E";
					break;
				case 8:
					coretype_v = "W";
					break;
				case 3:		// 지역별
					group_v = "I";
					break;
				case 5:		// 최빈
					group_v = "H";
					coretype_v = "D";
					break;
				case 6:		// 최오
					group_v = "H";
					coretype_v = "E";
					break;
				case 7:		// 학교별 기출유사
					coretype_v = "Y";
					break;
			}

			if (isValueEmpty(pop2TypeItems[selectedInfo.type2Index].menuCD) == false) {
				if (commonGLB.getMenuCD() !== pop2TypeItems[selectedInfo.type2Index].menuCD) {
					commonGLB.setStorage(storage.SEARCH_MENU_CD, pop2TypeItems[selectedInfo.type2Index].menuCD);//메뉴코드 셋팅
				}
			} else {
				commonGLB.setStorage(storage.SEARCH_MENU_CD, "");
			}

			Hierarchy_Init(_site_id, group_v, coretype_v);

			if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 0)
			{
				if(TRK_GLB_USER_ID == "-1") {
					trkCLS.setExternalEvent("ID7P78JVPM4UCQRMX27HUOY8W20250403", "");
					location.href = $("#sign_url").val();
				} else {
					location.href = '/Freetrial/freereading.asp?type=0';
				}
				//var block_Chk = $("#block_Chk").val();
				//(GetCookie("excessive-warning-popup-" + block_Chk) != "excessive-warning-popup-" + block_Chk) ? $("#excessive-warning-popup-" + block_Chk).show() : '';
			}

			if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 1)
			{
				(GetCookie("excessive-download-stop-popup") != "excessive-download-stop-popup") ? $("#excessive-download-stop-popup").show() : '';
			}
		}
		else if(selectedInfo.menuIndex == 2) {
			Hierarchy_Init(_site_id, "I", '');
		}
	};

	// 필터 설정
	var _setSelectedValue = function() {
		/* 학교별 기출유사 Nodata관련 : 초기화 처리 */
		var viewSelect_o = root.querySelector(".new-tab-freereading");
		viewSelect_o.style.display = "none";
		$(".nologin-view").hide();
		$(".new-tab-title").hide();
		$(".expect_info").hide();
		/* // 학교별 기출유사 Nodata관련 : 초기화 처리 */

		comm.toggleLoading(true);
		Page = 1;

		if(selectedInfo.menuIndex == 0 || selectedInfo.menuIndex == 3 || selectedInfo.menuIndex == 4 || selectedInfo.menuIndex == 5) {
			_setSelectedValueForFilter1();
			rootpart_codes = null;	// 수행평가에서 사용
		} else if(selectedInfo.menuIndex == 1) {
			_setSelectedValueForFilter2();
		} else if(selectedInfo.menuIndex == 2) {
			_setSelectedValueForFilter3();
		}
	};

	// 단원문제 탭 필터 설정
	var _setSelectedValueForFilter1 = function() {
		var filter_1 = root.querySelector("#filter_1");
		if(filter_1) {
			_hLog("init tab 1 data=" + JSON.stringify(selectedInfo));

			var obj = filter_1.querySelector("[data-act='filter_grade']");
			obj.innerHTML = popGradeItems[selectedInfo.gradeIndex].Name;

			popSubjectItems = Object.values(_New_Unit[_site_id + (selectedInfo.gradeIndex-0+1) + "_" + (selectedInfo.menuIndex-0+1)]);
			obj = filter_1.querySelector("[data-act='filter_subject']");
			if (typeof(popSubjectItems[selectedInfo.subjectIndex]) == "undefined") { selectedInfo.subjectIndex = 0; selectedInfo.subjectCode = "";}
			obj.innerHTML = popSubjectItems[selectedInfo.subjectIndex].Name;

			popGroupItems = popSubjectItems[selectedInfo.subjectIndex].unitItems;
			obj = filter_1.querySelector("[data-act='filter_group']");
			if (typeof(popGroupItems[selectedInfo.groupIndex]) == "undefined") { selectedInfo.groupIndex = 0; }
			if (popGroupItems[selectedInfo.groupIndex].gubun == "PRO") { selectedInfo.groupIndex = 0; }
			obj.innerHTML = popGroupItems[selectedInfo.groupIndex].Name;

			obj = filter_1.querySelector("button[type='reset']");
			obj.style.display = "none";

			// PV 쌓기. 처음 페이지 로딩시, 학년, 과목, 구분값 변경시 true
			if (page_Act_Chk) {
				common.setCount(popGroupItems[selectedInfo.groupIndex].Name, popGradeItems[selectedInfo.gradeIndex].Name, popSubjectItems[selectedInfo.subjectIndex].Name, null);
			}

			var grade_v = popGradeItems[selectedInfo.gradeIndex].Value;
			var group_v = popGroupItems[selectedInfo.groupIndex].Value;
			var coreType_v = popGroupItems[selectedInfo.groupIndex].CoreType;
			if (coreType_v == null) coreType_v = "";

			var cutCoreType_v = coreType_v.substring(0,1);
			_setHierarchy();

			//console.log(group_v + " / " + cutCoreType_v)

			if (group_v == "H" && cutCoreType_v == "T") {
				// 영어 문법 문제
				//_setHierarchy();
				popTxItems = _Hierarchy[selectedInfo.gradeIndex].Subj_Code[0].TX_CODE;
			} else if (group_v == "C" ) {
				// 단원별 문제
				Hierarchy_Init(_site_id, group_v, "");
				popTxItems = _Hierarchy[selectedInfo.gradeIndex].Subj_Code[selectedInfo.subjectIndex].TX_CODE;
			} else if(group_v == "S" && cutCoreType_v == "G") {
				// 중등 영문법
				popTxItems = [{Name: "공통", Value: ""}];
			} else if(group_v == "K" && cutCoreType_v == "F") {
				// 교과서 변형
				popTxItems = M_MT_Math[selectedInfo.gradeIndex].bookinfo;
			} 
			// Pro 관련 (s)
			else if((group_v == "K" && cutCoreType_v == "C")) {
				// 영문법 구문독해
				popTxItems = [{Name: "공통", Value: ""}];
			} else if(group_v == "P" && cutCoreType_v == "C") {
				// 교과서 변형
				if(isOldData == true) {
					popTxItems = M_MT_Math_OLD[selectedInfo.gradeIndex].bookinfo;
				} else {
					popTxItems = M_MT_Math[selectedInfo.gradeIndex].bookinfo;
				}
			} else if (group_v == "P" && cutCoreType_v == "A") {
				// 국어문법
				popTxItems = [{"Name":"공통", "Value":""}];
			} else if (group_v == "P" && cutCoreType_v == "D") {
				// 갈래별문학 (중등 문학 공략)
				popTxItems = [{"Name":"공통", "Value":""}];
			} else if (group_v == "P" && cutCoreType_v == "E") {
				// 구문독해
				popTxItems = popEngParseItems
			} else if (group_v == "T") {
				// 수행마스터
				popTxItems = paMasterItems
				if (selectedInfo.gradeIndex == 0 && selectedInfo.subjectIndex == 1) {		// 1학년 영어 예외처리
					popTxItems = paMasterM1Items;
					selectedInfo.txIndex = 0;
				}
			}
			else if (group_v == "B" ) {
				// 직전대비
				Hierarchy_Init(_site_id, group_v, "");
				popTxItems = _Hierarchy[selectedInfo.gradeIndex].Subj_Code[selectedInfo.subjectIndex].TX_CODE;
			}
			// Pro 관련 (e)
			else {
				if (!selectedInfo.subjectCode) {
					selectedInfo.subjectCode = popSubjectItems[selectedInfo.subjectIndex].Value;
				}
				_getTXItems();
			}

			var subject_v = popSubjectItems[selectedInfo.subjectIndex].Value;

			//_hLog("popTxItems="+JSON.stringify(popTxItems));

			//if(isOldData == true && group_v == 'C' && (grade_v == '2' || grade_v == '3'))
			if(isOldData == true && (group_v == "C" || group_v == "M" || ( group_v == "H" && (cutCoreType_v == "D" || cutCoreType_v == "E")) || group_v == "S" || (group_v == "K" && cutCoreType_v == "M") || (group_v == "H" && cutCoreType_v == "T")))
			{
				if(subject_v == 'MT')
				{
					subject_v = 'MT_O';
				}
				else if (subject_v == 'SC')
				{
					subject_v = 'SC_O';
				}
				else if (subject_v == 'HI')
				{
					subject_v = 'HI_O';
				}
			}

			popYearItems = [{Name: "전체 년도", Value: ""}].concat(getYears(_site_id, grade_v, group_v, coreType_v, subject_v));

			// 과목/그룹별 설정 START
			if (subject_v == "KR") {
				// 국어

				if(cutCoreType_v) {
					// 교과서 설정
					if (cutCoreType_v == "O") {
						// 국어 문법 연습
						popTxItems = _KR_EXAM;
						coreType_v = popTxItems[selectedInfo.txIndex].Value;
					} else if (cutCoreType_v == "P") {
						// 국어 작품별 문제
						popTxItems = _KR_GENRE;
						coreType_v = popTxItems[selectedInfo.txIndex].Value;
					}
				}

				// 년도 설정
				if(cutCoreType_v == "O") {
					// 국어 문법 연습
					if(coreType_v == "O4") {
						popYearItems = [{Name: "전체 년도", Value: ""}].concat(getYears(_site_id, 0, group_v, coreType_v, subject_v));
					} else if (coreType_v == "O7") {
						popYearItems = [{Name: "전체 년도", Value: ""}];
					}
				} else if(cutCoreType_v == "P"){
					// 국어 작품별
					popYearItems = [{Name: "전체 년도", Value: ""}].concat(getYears(_site_id, 0, group_v, coreType_v, subject_v));
				} else if (group_v == "H" && cutCoreType_v == "F") {
					// 고난도 문제
				}
			} else if (subject_v == "EG") {
				// 영어
				if(group_v == "S" && cutCoreType_v == "G") {
					// 중등 영문법
					popYearItems = grammerYearItems;
				}
			} else if (subject_v == "MT") {
				// 수학
				if(cutCoreType_v == "B") {
					// 수학 계산력
					popTxItems = _KR_MT_O7;
				} else if(cutCoreType_v == "M") {
					// 수학 유형별
					popTxItems = null;
				}
			} else if (subject_v == "SC") {
			} else if (subject_v == "LS") {
				// 사회
				if(group_v == "H") {
					if(coreType_v != "D" && coreType_v != "E" && grade_v == "1") {
						popTxItems = [{Name: "공통", Value: ""}];
					}
				}
			} else if (subject_v == "ET" || subject_v == "TH" || subject_v == "CH") {
				// 도덕,기술가정,한문
				// 최다오답 최다빈출인경우 => popTxItems.length>1 일때만 전체교과서가 나와야함
				if(group_v == "H" && (coreType_v == "E" || coreType_v == "D")) {
					if(selectedInfo.gradeIndex == 1) {
						// popTxItems.splice(1,1);
					}
				} else {
				}
			} else {

			}
			termItems = _term;

			if(group_v == "S" && subject_v == "EG" && coreType_v == "G") {
				// 중등 영문법
				termItems = grammerKindItems;
			}
			// 과목/그룹별 설정 end

			// 교과서 설정 START
			//if(coreType_v != "G" && (group_v == "M" || group_v == "S" || (group_v == "H" && coreType_v == "F" ))) {	// 서술형, 고난도, 적중
			if(coreType_v != "G" && ((group_v == "H" && coreType_v == "F" ))) {	//적중
				if(popTxItems.length > 1) {
					popTxItems = [{"Name":"전체 교과서", Value: util.arrayValueAdd(popTxItems).join("|")}].concat( popTxItems );
				}

				popYearItems = [{Name: "전체 년도", Value: ""}].concat(getYears(_site_id, grade_v, group_v, coreType_v, subject_v));
			} else if(group_v != "C" && group_v != "B" && (group_v == "H" && (cutCoreType_v == "D" || cutCoreType_v == "E" || cutCoreType_v == "T")) && cutCoreType_v != "G") {
				// 전체교과서가 나와야하는 조건
				// 1) 1. 개념완성이 아님 , 2. 단원별문제가아님
				if(group_v == "H" && (cutCoreType_v == "D" || cutCoreType_v == "E" || cutCoreType_v == "T")) {
					if(popTxItems.length > 1) {
						// 1-1. 최다빈출과 최다오답인경우엔 popTxItems의 개수가 1개보다 많을 경우
						// 초기값 세팅으로 인한 주석처리 / 2021-03-17 / 김진국
						// popTxItems = [{Name: "전체 교과서", Value: util.arrayValueAdd(popTxItems).join("|")}].concat(popTxItems);
					}
				} else {
					popTxItems = [{Name: "전체 교과서", Value: ""}].concat(popTxItems);
				}
			}

			// Pro 관련 (s)
			if (group_v == "P" && cutCoreType_v == "D") {
				// 갈래별문학 (중등 문학 공략)
				popTxItems = _M_PRO_GAL;
				popYearItems = _H_KR_SI_KIND;
				popSubItems = [{"Name": "전체", "Value":""}];
			} else if ((group_v == "K" && cutCoreType_v == "C") || (group_v == "P" && cutCoreType_v == "E")) {
				// 영문법
				if (group_v == "K") {
					popYearItems = grammerYearItems;
				} else {
					popYearItems = popEngParseItems;
				}
				termItems = grammerKindItems;
			}

			if (group_v == "P" && cutCoreType_v == "B") {
				popTxItems = [{"Name":"공통", "Value":""}];
			}

			if (group_v == "T") {
				//수행마스터
				coreType_v = popTxItems[selectedInfo.txIndex].Value;
				Hierarchy_Init(_site_id, group_v, coreType_v);
				popYearItems = _Hierarchy[selectedInfo.gradeIndex].Subj_Code[selectedInfo.subjectIndex].TX_CODE;

				if(popYearItems == null) {
					popYearItems = [{"Name":"공통", "Value":""}];
				}
			}
			// Pro 관련 (e)

			// 교과서 설정 END
			if(popTxItems == null) {
				popTxItems = [{"Name":"공통", "Value":""}];
			}

			//_hLog("gorup_v=" + group_v + " coreType_v=" + coreType_v);

			//_hLog("popTxItems=" + JSON.stringify(popTxItems));

            if (isOldData == true && (group_v == "C" || group_v == "M" || ( group_v == "H" && (cutCoreType_v == "D" || cutCoreType_v == "E"))) && subject_v == "HI_O")
			{
				if (grade_v == "1")
				{
					popTxItems = [{"Name": "역사①", "Value": "M8HICHAA001"}];
				}
				else
				{
					//popTxItems = [{Name: "교과서 선택", Value: "-99"}, {"Name": "역사①", "Value": "M8HICHAA001"}, {"Name": "역사②", "Value": "M8HICHAA002"}];
					popTxItems = [{"Name": "역사①", "Value": "M8HICHAA001"}, {"Name": "역사②", "Value": "M8HICHAA002"}];
				}
			}

			obj = filter_1.querySelector("[data-act='filter_tx']");

			// 인덱스값 초기화 / 2021-11-02 / 김진국
			if (typeof(popTxItems[selectedInfo.txIndex]) == "undefined") {
				selectedInfo.txIndex = 0;
			}
			obj.innerHTML = popTxItems[selectedInfo.txIndex].Name;

			var filter1_pnl3 = filter_1.querySelector("#filter1_pnl3");
			var btn_group = filter_1.querySelector("[data-act='filter_group']");
			var btn_tx = filter_1.querySelector("[data-act='filter_tx']");

			var btn_1 = filter_1.querySelector("[data-act='filter_year']");
			var btn_2 = filter_1.querySelector("[data-act='filter_term']");
			var input_o = filter_1.querySelector("[name='qry']").parentNode;
			var chapter_o = filter_1.querySelector("[data-act='filter_chapter']");
			var level_o = filter_1.querySelector("[data-act='filter_level']");

			var basicTxt = filter_1.querySelector("#basicTxt");
			var basicTxtVal = $("#basicTxtVal").val();

			// filter display setting start
			basicTxt.style.display = "none";
			filter1_pnl3.style.display = "";
			level_o.parentNode.style.display = "none";
			btn_1.style.width = "47%";
			btn_2.style.width = "47%";
			$("#zocboInfo_expectedquestion").hide();

			if (subject_v == "MT") {	// 수학의 경우
				if (group_v == "K") {
					if (coreType_v == "M") {
						// 수학 유형별 문제
						btn_tx.style.display = "none";
						$(btn_group).removeClass("fL");
						$(btn_group).css("width", "100%");
						filter1_pnl3.style.display = "";
						chapter_o.parentNode.style.display = "none";
					//} else if (coreType_v.substring(0,1) == "B") {
					// 수학계산력문제(기존) + 수학과서변형(추가) / 2021-11-02 / 김진국
					} else if (subject_v == "MT" && (cutCoreType_v == "B" || cutCoreType_v == "F")) {
						$(btn_group).addClass("fL");
						$(btn_group).css("width", "47%");
						btn_tx.style.display = "";
						filter1_pnl3.style.display = "none";
						chapter_o.parentNode.style.display = "";
					}
				} else {
					$(btn_group).addClass("fL");
					$(btn_group).css("width", "47%");
					btn_tx.style.display = "";
				}
			} else {
				$(btn_group).addClass("fL");
				$(btn_group).css("width", "47%");
				btn_tx.style.display = "";
			}

			if (group_v == "H") {
				if (cutCoreType_v == "D" || cutCoreType_v == "E" || cutCoreType_v == "F") {
					// 최다빈출(D), 최다오답(E), 적중 모의고사(F)
					btn_1.style.display = "none";
					btn_2.style.display = "none";
					input_o.style.display = "";
					if (isOldData) {
						chapter_o.parentNode.style.display = "none";
					} else {
						chapter_o.parentNode.style.display = "";
					}
				} else if (cutCoreType_v == "T") {
					// 중등 영문문법 문제
					btn_1.style.display = "none";
					btn_2.style.display = "none";
					input_o.style.display = "";
					if (isOldData) {
						chapter_o.parentNode.style.display = "none";
					} else {
						chapter_o.parentNode.style.display = "";
					}
				} else {
					// 개념완성(H)
					btn_1.style.display = "none";
					btn_2.style.display = "none";
					input_o.style.display = "none";
					chapter_o.parentNode.style.display = "";
				}
			} else if (group_v == "C") {	// 단원별
				btn_1.style.display = "none";
				btn_2.style.display = "none";

				input_o.style.display = "";
				if (isOldData) {
					chapter_o.parentNode.style.display = "none";
				} else {
					chapter_o.parentNode.style.display = "";
				}
				// 국어 / 수학 / 영어 / 과학 / 사회 / 역사과목만 학습 단계 노출
				if (subject_v == "KR" || subject_v == "MT" || subject_v == "EG" || subject_v == "SC" || subject_v == "LS" || subject_v == "HI" || subject_v == "ET") {
					level_o.parentNode.style.display = "";
					levelItems = [{Name: "전체 선택", Value: ""}];
					
					for(var i=0; i< popSubjectItems[selectedInfo.subjectIndex].level.length; i++) {
						var mItem = popSubjectItems[selectedInfo.subjectIndex].level[i];
						var obj = {};

						var rc = mItem.Value;
						var rn = mItem.Name;
						obj.Name = rn;
						obj.Value = rc;
						levelItems.push(obj);
					}
				}
			} else if (group_v == "K" && subject_v == "MT" && cutCoreType_v == "F") {
				// 교과서변형
				btn_1.style.display = "none";
				btn_2.style.display = "none";
				input_o.style.display = "none";
				chapter_o.parentNode.style.display = "";
			} else if (group_v == "K" && subject_v == "MT" && cutCoreType_v == "B") {
				btn_1.style.display = "";
				btn_2.style.display = "";
				input_o.style.display = "none";
				chapter_o.parentNode.style.display = "";
			} else if (group_v == "K") {
				btn_1.style.display = "";
				btn_2.style.display = "";
				input_o.style.display = "";
				// 국어작품별문제, 국어문법연습 대단원 지우기 / 2021-09-28 / 김진국
				if (subject_v == "KR" && (cutCoreType_v == "P" || cutCoreType_v == "O")) {
					chapter_o.parentNode.style.display = "none";
				}
			} else if (group_v == "S" && subject_v == "EG" && cutCoreType_v == "G") {
				// 중등 영문법
				btn_group.style.width = "100%";
				btn_tx.style.display = "none";
				btn_1.style.display = "";
				btn_2.style.display = "";
				input_o.style.display = "none";
				chapter_o.parentNode.style.display = "";
			} else if (group_v == "B") {
				// 직전대비
				btn_1.style.display = "none";
				btn_2.style.display = "none";
				input_o.style.display = "none";
				chapter_o.parentNode.style.display = "";
			} 
			else if (group_v == "M") {
				btn_1.style.display = "none";
				btn_2.style.display = "none";
				input_o.style.display = "";
				if (isOldData) {
					chapter_o.parentNode.style.display = "none";
				} else {
					chapter_o.parentNode.style.display = "";
				}
			}
			else {
				btn_1.style.display = "";
				btn_2.style.display = "";
				input_o.style.display = "";
				chapter_o.parentNode.style.display = "none";
			}
			//alert("grade_v = " + grade_v + ", subject_v = " + subject_v);
			// 2021-03-10 / 김진국 / 중1 and (국어, 영어, 수학, 과학, 사회) and (단원별, 서술형, 최다빈, 최다오, 고난도, 수학유형별, 영어 문법문제) 년도삭제
			if (((grade_v == 1 && ( subject_v == "KR" || subject_v == "EG" || subject_v == "MT" || subject_v == "SC" || subject_v == "LS" )) || (grade_v == 2 && (subject_v == "LS" && $(btn_tx).text() == "사회①"))) && (group_v == "C" || group_v == "M" || ( group_v == "H" && (cutCoreType_v == "D" || cutCoreType_v == "E")) || group_v == "S" || (group_v == "K" && cutCoreType_v == "M") || (group_v == "H" && cutCoreType_v == "T"))) {
				btn_1.style.display = "none";
				btn_2.style.width = "100%";
			} else {
				btn_2.style.width = "47%";
			}

			if (group_v == "S" && subject_v == "EG" && cutCoreType_v == "G") {
				btn_1.style.display = "";
				btn_2.style.width = "47%";
			}

			obj = filter_1.querySelector("[data-act='filter_year']");

			if (typeof(popYearItems[selectedInfo.yearIndex]) == "undefined") {
				selectedInfo.yearIndex = 0;
			}
			obj.innerHTML = popYearItems[selectedInfo.yearIndex].Name;
			
			// ! 붙었음!
			if (!(group_v == "P" && cutCoreType_v == "D")) {
				if (typeof(termItems[selectedInfo.termIndex]) == "undefined") { selectedInfo.termIndex = 0; }
				obj = filter_1.querySelector("[data-act='filter_term']");
				obj.innerHTML = termItems[selectedInfo.termIndex].title;
			}
			// filter display setting end

			obj = root.querySelector("[data-act='oldData']");

			if (isOldData) {
				obj.innerHTML = "<span class='is-bedge'>22개정</span>최신 개정자료 보기";
			} else {
				obj.innerHTML = "<span class='is-bedge'>15개정</span>이전 개정자료 보기";
			}

			if (selectedInfo.menuIndex == 3 && param.oldData == "Y") {
				obj.innerHTML = "최신 개정자료 보기";
				$("button[data-act=filter_chapter]").hide();
				$("button[data-act=filter_level]").hide();
			}

			if (group_v == "K" && subject_v == "MT" && cutCoreType_v == "F") {
				obj.style.display = "none";
			} else if(group_v == "P" && subject_v == "MT" && cutCoreType_v == "B" && grade_v == "2") {
				obj.style.display = "";
			} else {
				if((grade_v == "2" && (subject_v.includes("MT") || subject_v.includes("SC"))) || (grade_v == "1" && (subject_v.includes("SC")))) {
					obj.style.display = "";
				} else {
					obj.style.display = "none";
				}
			}

			// Pro 관련 (s)
			if (group_v == "P" && cutCoreType_v == "C") {
				// 교과서변형
				btn_tx.style.display = "";
				btn_tx.style.width = "47%";
				$(btn_tx).removeClass("fL").addClass("fR");
				filter1_pnl3.style.display = "none";
				btn_1.style.width = "47%";
				btn_2.style.width = "47%";
				input_o.style.display = "none";
				chapter_o.parentNode.style.display = "";
				if (basicTxtVal == 1) { basicTxt.style.display = ""; }
			} else if (group_v == "K" && cutCoreType_v == "C") {
				// 영문법
				btn_group.style.width = "100%";
				btn_tx.style.display = "none";
				btn_tx.style.width = "47%";
				filter1_pnl3.style.display = "";
				btn_1.style.display = "";
				btn_2.style.display = "";
				$(btn_1).removeClass("fR").addClass("fL");
				$(btn_2).removeClass("fL").addClass("fR");
				btn_1.style.width = "47%";
				btn_2.style.width = "47%";
				input_o.style.display = "none";
				chapter_o.parentNode.style.display = "";
				if (basicTxtVal == 1) { basicTxt.style.display = ""; }
			} else if (group_v == "T") {
				// 수행마스터
				filter1_pnl3.style.display = "";
				btn_tx.style.width = "47%";
				btn_tx.style.display = "";
				btn_1.style.width = "100%";
				btn_2.style.display = "none";
				chapter_o.parentNode.style.display = "100%";
				chapter_o.parentNode.style.display = "";
				if (basicTxtVal == 1) { basicTxt.style.display = ""; }
			} else if (group_v == "P" && cutCoreType_v == "A") {
				//국어문법
				btn_group.style.width = "100%";
				btn_tx.style.display = "none";
				filter1_pnl3.style.display = "none";
				if (basicTxtVal == 1) { basicTxt.style.display = ""; }
			} else if (group_v == "P" && cutCoreType_v == "D") {
				//갈래별문학 (중등 문학 공략)
				btn_tx.style.display = "";
				btn_tx.style.width = "47%";
				filter1_pnl3.style.display = "";
				btn_1.style.display = "";
				btn_2.style.display = "";
				btn_1.style.width = "100%";
				btn_2.style.width = "100%";
				input_o.value = "";
				input_o.style.display = "none";
				if (basicTxtVal == 1) { basicTxt.style.display = ""; }
			} else if (group_v == "P" && cutCoreType_v == "E") {
				// 구문독해
				btn_group.style.width = "100%";
				btn_tx.style.display = "none";
				btn_tx.style.width = "47%";
				filter1_pnl3.style.display = "";
				btn_1.style.display = "";
				btn_2.style.display = "";
				$(btn_1).removeClass("fR").addClass("fL");
				$(btn_2).removeClass("fL").addClass("fR");
				btn_1.style.width = "47%";
				btn_2.style.width = "47%";
				input_o.style.display = "none";
				chapter_o.parentNode.style.display = "";
				if (basicTxtVal == 1) { basicTxt.style.display = ""; }
			} else if (group_v == "P" && cutCoreType_v == "B") {
				//수학 단계별 학습관 ( 수학 MASTER )
				btn_group.style.width = "100%";
				btn_tx.style.display = "none";
				filter1_pnl3.style.display = "none";
				btn_1.style.width = "47%";
				btn_2.style.width = "47%";
				chapter_o.parentNode.style.display = "100%";
				chapter_o.parentNode.style.display = "";
				input_o.style.display = "none";
				if (basicTxtVal == 1) { basicTxt.style.display = ""; }
			}

			
/*
			var filter1_pnl3 = filter_1.querySelector("#filter1_pnl3");
			var btn_group = filter_1.querySelector("[data-act='filter_group']");
			var btn_tx = filter_1.querySelector("[data-act='filter_tx']");

			var btn_1 = filter_1.querySelector("[data-act='filter_year']");
			var btn_2 = filter_1.querySelector("[data-act='filter_term']");
			var input_o = filter_1.querySelector("[name='qry']").parentNode;
			var chapter_o = filter_1.querySelector("[data-act='filter_chapter']");
			var level_o = filter_1.querySelector("[data-act='filter_level']");
*/

			if (group_v == "T") {
				_loadData();
			} else if (group_v == "P" && cutCoreType_v == "D") {
				popTxItems = _M_PRO_GAL;
				//popTxItems = _H_KR_SI;
				popYearItems = _H_KR_SI_KIND;

				var TxCode = popTxItems[selectedInfo.txIndex].Value;
				var divisionType_v = popYearItems[selectedInfo.yearIndex].Value;
				var url_p = "/_api/search.api.asp";
				var data_p = "cmd=M_PRO_TIME&site_id="+_site_id+"&ExPapr_Group="+group_v+"&TxCode=" + TxCode + "&DivisionType=" + divisionType_v;
				comm.send(url_p, data_p, "post", function(json_p) {
					popSubItems = [{"Name":"전체", "title":"전체", "Value":""}].concat(json_p.list);
					if (divisionType_v == "A") {
						korCateArr = json_p.aList;
					} else if (divisionType_v == "W"){
						korCateArr = json_p.wList;
					}

					for(var i = 0; i < popSubItems.length; i++) {
						if(popSubItems[i]["Name"] == null) {
							popSubItems[i]["Name"] = popSubItems[i]["RESULT_TEXT"];
							popSubItems[i]["title"] = popSubItems[i]["RESULT_TEXT"];
							popSubItems[i]["Value"] = popSubItems[i]["SEQ"];
						}
					}
					obj = filter_1.querySelector("[data-act='filter_year']");
					obj.innerHTML = popYearItems[selectedInfo.yearIndex].Name;

					obj = filter_1.querySelector("[data-act='filter_term']");
					obj.innerHTML = popSubItems[selectedInfo.termIndex].title;
					if (popSubItems[selectedInfo.termIndex].Value > 0) {
						korCateArr =  [{"SEQ" : popSubItems[selectedInfo.termIndex].Value, "RESULT_TEXT": popSubItems[selectedInfo.termIndex].RESULT_TEXT}];
					}

					_loadData();
					return;
				})
			} else if ( (group_v == "P" && (cutCoreType_v == "A" || cutCoreType_v == "B" || cutCoreType_v == "C" || cutCoreType_v == "E")) || (group_v == "K" && cutCoreType_v == "C")) {
				if (typeof(popYearItems[selectedInfo.yearIndex]) == "undefined") { selectedInfo.yearIndex = 0; }
				obj.innerHTML = popYearItems[selectedInfo.yearIndex].Name;
				obj = filter_1.querySelector("[data-act='filter_term']");
				obj.innerHTML = termItems[selectedInfo.termIndex].title;
				_loadData();
			} else {
				_loadData();
			}
			// Pro 관련 (e)

			//_loadData();
		}
	};

	// 학교별 족보 필터 설정
	var _setSelectedValueForFilter2 = function() {
		var filter_2 = root.querySelector("#filter_2");
		if(filter_2) {
			_setSelectedValueForFilter2_sub();
		}
	};

	// 학교별 족보 필터 설정
	var _setSelectedValueForFilter2_sub = function() {
		var part_ids = document.getElementById("part_ID").value;
		var filter_2 = root.querySelector("#filter_2");
		if(filter_2) {

			var obj = filter_2.querySelector("[data-act='filter2_type']");
			obj.innerHTML = pop2TypeItems[selectedInfo.type2Index].Name;

			// 학교별 기출 무료 열람실 IPhone Popup노출
			/*
			var iPhone_UserAgent = navigator.userAgent.toLowerCase();

			if (iPhonePopChk && (iPhone_UserAgent.indexOf("iphone") > -1 || iPhone_UserAgent.indexOf("ipad") > -1 || iPhone_UserAgent.indexOf("ipod") > -1 ) && selectedInfo.type2Index == 0) {
			//if (iPhonePopChk && selectedInfo.type2Index == 0) {
				$("#iosPopup").show();
				iPhonePopChk = false;
			}
			*/

			var type2_v = pop2TypeItems[selectedInfo.type2Index].value;
			var type2_index = pop2TypeItems[selectedInfo.type2Index].Index;
			var fileType_o = filter_2.querySelector("[data-act='filter2_fileType']");
			var gu_o = filter_2.querySelector("[data-act='filter2_gu']");
			var sch_o = filter_2.querySelector("[data-act='filter2_sch']");
			var year_o = filter_2.querySelector("[data-act='filter2_year']");
			var pub_o = filter_2.querySelector("[data-act='filter2_pub']");
			var chapter_o = filter_2.querySelector("[data-act='filter2_Chapter']");
			var input_o = filter_2.querySelector("[name='qry']");	// 검색 텍스트박스
			var reset_o = filter_2.querySelector("button[type='reset']");
			reset_o.style.display = "none";

			/* 메뉴 위치 변경 */
			if(type2_index == "7") {	// 학교별 기출유사
				$("div#grade_area").insertAfter("div#period_area");
			} else {
				$("div#period_area").insertAfter("div#grade_area");
			}
			/* // 메뉴 위치 변경 */
			$("#productBuyEventTargetBanner").hide();
			if(fileType_o) {
				$("#div_Img").hide();
				if(type2_v == "") {	// 학교별 기출 무료 열람실
					$("#zocboInfo").hide();
					$("#zocboInfo_expect").hide();
					$("#zocboInfo_FreeReading").show();
					$("#zocboInfo_expectedquestion").hide();
					$("#zocboInfo_V").hide();
					$("#zocboInfo_W").hide();
					$("#zocboInfo_HD").hide();
					$("#zocboInfo_HE").hide();
					$("#zocboInfo_I").hide();
					$("#zocboInfo_K3").hide();
					$("#zocboInfo_B").hide();
					$("#div_FreeReading").show();
					$("#div_V").hide();
					fileType_o.parentNode.style.display = "none";
					chapter_o.parentNode.style.display = "none";
					sch_o.parentNode.style.display = "";
					gu_o.parentNode.style.display = "";
					year_o.parentNode.style.display = "";
					pub_o.parentNode.style.display = "none";
					input_o.parentNode.style.display = "none";
					_getProductBuyEventTarget();
				} else if(type2_v == "A") {	// 학교별 기출 족보
					$("#zocboInfo").hide();
					$("#zocboInfo_expect").hide();
					$("#zocboInfo_FreeReading").hide();
					$("#zocboInfo_expectedquestion").hide();
					$("#zocboInfo_V").hide();
					$("#zocboInfo_W").hide();
					$("#zocboinfoBox").show();
					$("#zocboInfo_HD").hide();
					$("#zocboInfo_HE").hide();
					$("#zocboInfo_I").hide();
					$("#zocboInfo_K3").hide();
					$("#zocboInfo_B").hide();

					/*
						학교별 기출유사 버튼은 기출무료열람실과 UI가 동일하지만 실제 act는 기출 족보처럼
						-> search (5968), search_btn (6301)
					*/
					if(type2_index == "7") {	// 학교별 기출유사
						//$("#zocboInfo_expect").show();
						$("#zocboInfo_expect").hide();
						$("#zocboInfo_expectedquestion").show();
						fileType_o.parentNode.style.display = "none";		// 원본형, 편집형
						chapter_o.parentNode.style.display = "none";
						input_o.parentNode.style.display = "none";
					} else {
						$("#zocboInfo").show();
						fileType_o.parentNode.style.display = "";		// 원본형, 편집형
						chapter_o.parentNode.style.display = "none";
						input_o.parentNode.style.display = "";
					}

					//search_o.parentNode.style.display = "none";
					//err_msg.parentNode.style.display = "none";
					sch_o.parentNode.style.display = "";
					gu_o.parentNode.style.display = "";
					year_o.parentNode.style.display = "";
					pub_o.parentNode.style.display = "none";

					$("#div_Img").hide();
				} else if(type2_v == "V") {	// 학교별 예상 족보.
					$("#zocboInfo").hide();
					$("#zocboInfo_expect").hide();
					$("#zocboInfo_expectedquestion").hide();
					$("#zocboInfo_FreeReading").hide();
					$("#zocboInfo_V").show();
					$("#zocboInfo_W").hide();
					$("#zocboinfoBox").hide();
					$("#zocboInfo_HD").hide();
					$("#zocboInfo_HE").hide();
					$("#zocboInfo_I").hide();
					$("#zocboInfo_K3").hide();
					$("#zocboInfo_B").hide();
					$("#div_V").show();
					$("#div_W").hide();
					$("#div_W_Nodata").hide();
					$("#div_FreeReading").hide();
					fileType_o.parentNode.style.display = "none";
					chapter_o.parentNode.style.display = "";
					sch_o.parentNode.style.display = "";
					gu_o.parentNode.style.display = "";
					year_o.parentNode.style.display = "none";
					pub_o.parentNode.style.display = "none";
					input_o.parentNode.style.display = "none";
				} else if(type2_v == "W") {	// 학교별 AI기출변형
					$("#zocboInfo").hide();
					$("#zocboInfo_expect").hide();
					$("#zocboInfo_expectedquestion").hide();
					$("#zocboInfo_FreeReading").hide();
					$("#zocboInfo_V").hide();
					$("#zocboInfo_W").show();
					$("#zocboinfoBox").hide();
					$("#zocboInfo_HD").hide();
					$("#zocboInfo_HE").hide();
					$("#zocboInfo_I").hide();
					$("#zocboInfo_K3").hide();
					$("#zocboInfo_B").hide();
					$("#div_V").hide();
					$("#div_W").show();
					$("#div_W_Nodata").hide();
					$("#div_FreeReading").hide();
					fileType_o.parentNode.style.display = "none";
					chapter_o.parentNode.style.display = "";
					sch_o.parentNode.style.display = "";
					gu_o.parentNode.style.display = "";
					year_o.parentNode.style.display = "none";
					pub_o.parentNode.style.display = "none";
					input_o.parentNode.style.display = "none";
				} else if(type2_v == "I") {	// 지역별 문제
					$("#zocboInfo").hide();
					$("#zocboInfo_expect").hide();
					$("#zocboInfo_expectedquestion").hide();
					$("#zocboInfo_FreeReading").hide();
					$("#zocboInfo_V").hide();
					$("#zocboInfo_W").hide();
					$("#zocboinfoBox").hide();
					$("#zocboInfo_HD").hide();
					$("#zocboInfo_HE").hide();
					$("#zocboInfo_I").show();
					$("#zocboInfo_K3").hide();
					$("#zocboInfo_B").hide();
					fileType_o.parentNode.style.display = "none";
					chapter_o.parentNode.style.display = "none";
					sch_o.parentNode.style.display = "none";
					gu_o.parentNode.style.display = "none";
					year_o.parentNode.style.display = "";
					pub_o.parentNode.style.display = "";
					input_o.parentNode.style.display = "";
					$("#div_Img").hide();
				} else if(type2_v == "K3") {		// 강남 3구 유형공략
					$("#zocboInfo").hide();
					$("#zocboInfo_expect").hide();
					$("#zocboInfo_expectedquestion").hide();
					$("#zocboInfo_FreeReading").hide();
					$("#zocboInfo_V").hide();
					$("#zocboInfo_W").hide();
					$("#zocboinfoBox").hide();
					$("#zocboInfo_HD").hide();
					$("#zocboInfo_HE").hide();
					$("#zocboInfo_I").hide();
					$("#zocboInfo_K3").show();
					$("#zocboInfo_B").hide();
					fileType_o.parentNode.style.display = "none";
					chapter_o.parentNode.style.display = "none";
					gu_o.parentNode.style.display = "none";
					sch_o.parentNode.style.display = "none";
					year_o.parentNode.style.display = "none";
					pub_o.parentNode.style.display = "";
					input_o.parentNode.style.display = "none";
					input_o.value = "";
				} else if(type2_v == "H") {		// 최빈, 최오
					$("#zocboInfo").hide();
					$("#zocboInfo_expect").hide();
					$("#zocboInfo_expectedquestion").hide();
					$("#zocboInfo_FreeReading").hide();
					$("#zocboInfo_V").hide();
					$("#zocboInfo_W").hide();
					$("#zocboinfoBox").hide();
					$("#zocboInfo_B").hide();
					//if(selectedInfo.type2Index == 3) {
					if(selectedInfo.type2Index == ((_is_previous_chk) ? 4 : 3)) {
						$("#zocboInfo_HD").show();
						$("#zocboInfo_HE").hide();
					} else {
						$("#zocboInfo_HD").hide();
						$("#zocboInfo_HE").show();
					}

					$("#zocboInfo_I").hide();
					$("#zocboInfo_K3").hide();

					fileType_o.parentNode.style.display = "none";
					chapter_o.parentNode.style.display = "none";
					sch_o.parentNode.style.display = "none";
					gu_o.parentNode.style.display = "none";
					year_o.parentNode.style.display = "";
					pub_o.parentNode.style.display = "";
					input_o.parentNode.style.display = "";
				}
			}

			if(type2_v == "K3") {
				_setSelectedValueForFilter2SubLoadK3();
			} 
			else {
				obj = filter_2.querySelector("[data-act='filter2_si']");

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

					if(type2_v == "")
					{
						_setSelectedValueForFilter_FreeReding_Load();
					}
					else
					{
						_setSelectedValueForFilter2SubLoad();
					}
				}
				else {
					if((param.yusatype == "Y" && _yusa_si_name != "") || param.yusatype != "Y") {
						param.yusatype = "";	// 초기화
						var url_v = "/_api/community.api.asp";
						var data_v = "cmd=GET_REGION_LIST&si=" + obj.innerHTML;
						comm.send(url_v, data_v, "post", function(json) {
							gu2Items = [{"Name":"구/군", "rg_District":"구/군", "Value":""}].concat(json.list);

							for(var i = 0; i < gu2Items.length; i++) {
								gu2Items[i]["Name"] = gu2Items[i].rg_District;
							}

							// 아래코드 제외 테스트 (2024.07.10-이슈있으면 제외)
							if(param.yusatype == "Y" && 1==2)
							{
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
							}
							else
							{
								if (mem_base_info.init == "Y") {
									gu2Items.forEach(function(d, i) {
										if (d.Name == mem_base_info.gugun) {
											selectedInfo.gu2Index = i;
										}
									})
								}
							}

							obj = filter_2.querySelector("[data-act='filter2_gu']");
							obj.innerHTML = gu2Items[selectedInfo.gu2Index].Name;

							if(selectedInfo.gu2Index == 0) {
								$(sch_o).attr("disabled", "true");
								selectedInfo.sch2Index = 0;
								sch2Items = [{"Scl_Name":"학교", "Value":"", "Scl_ID":"", "Name":"학교"}];

								if(type2_v == "")
								{
									_setSelectedValueForFilter_FreeReding_Load();
								}
								else
								{
									_setSelectedValueForFilter2SubLoad();
								}
							}
							else {
								var url2_v = "/_api/community.api.asp";
								var si_v;
								var gu_v;

								// 아래코드 제외 테스트 (2024.07.10-이슈있으면 제외)
								if(param.yusatype == "Y" && 1==2)
								{
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

									// 기출열람실에서 넘어왔을 시 최초 강제 새로고침 하기 위함... 새로고침할땐 안넘김								
									if(param.isFirst == "Y" && 1==2) {
										location.replace("/M/?menu=2&type=0&yusatype=Y&scl="+param.scl+"&grade="+param.grade+"&year="+param.year+"&midend="+param.midend);
									}								

									si_v = _SI_LIST[selectedInfo.si2Index].Name;
									gu_v = gu2Items[selectedInfo.gu2Index].Name;
								}
								else
								{
									si_v = _SI_LIST[selectedInfo.si2Index].Name;
									gu_v = gu2Items[selectedInfo.gu2Index].Name;
								}

								if(si_v == "지역" || si_v == "지역 선택")
								{
									si_v = "";								
								}

								//gu_v = gu2Items[selectedInfo.gu2Index].Name;
								//var gu_v = gu2Items[selectedInfo.gu2Index].Name;
								
								
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
									}
									else
									{
										if (mem_base_info.init == "Y") {
											sch2Items.forEach(function(d, i) {
												if (d.Scl_ID == mem_base_info.scl_id) {
													selectedInfo.sch2Index = i;
												}
											})

											mem_base_info.init = "N";	// 최소 1회만 할당하기 위해
										}	
									}

									if(type2_v == "")
									{
										_setSelectedValueForFilter_FreeReding_Load();
									}
									else
									{
										_setSelectedValueForFilter2SubLoad();
									}
								});
							}
						});
					} else {
						// 기출유사 랜딩 처리 시 > 불필요한 호출에 대한 로딩아이콘 히든 (2024.07.10, 정효태)						
						comm.toggleLoading(false);
					}
				}
			}
		}
	};

	// 학교별 족보 필터 설정
	var _setSelectedValueForFilter2SubLoad = function() {
		if (typeof(popGrade2Items[selectedInfo.grade2Index]) == "undefined") { selectedInfo.grade2Index = 1; }
		var grade_v = popGrade2Items[selectedInfo.grade2Index].value;
		var subject_v = "";
		var type2_v = pop2TypeItems[selectedInfo.type2Index].value;
		var type2_index = pop2TypeItems[selectedInfo.type2Index].Index;
		var coreType_v = pop2TypeItems[selectedInfo.type2Index].CoreType;

		if(typeof(popSubjectItems[selectedInfo.subject2Index]) != "undefined") {
			subject_v = popSubjectItems[selectedInfo.subject2Index].Value
		}

		popGrade2Items = [
			{"title":"1학년", "value":"1"},
			{"title":"2학년", "value":"2"},
			{"title":"3학년", "value":"3"}
		];

//		if(type2_index == 7) {
//			popGrade2Items = [
//				//{"title":"1학년", "value":"1"},
//				{"title":"2학년", "value":"2"},
//				{"title":"3학년", "value":"3"}
//			];
//		}

		popYearItems = [{Name:"전체 년도",Value:""}];

		var year_s;

		year_s  = new Date().getFullYear();
		popSubjectItems = _Hierarchy[selectedInfo.grade2Index].Subj_Code;

		var year_t = 2003;

		/*
		if(subject_v == "KR" || subject_v == "EG") {
			year_t = year_s - 1;
		}
		*/
		if(type2_v == "A") {
			//year_s  = new Date().getFullYear() - 1;		// 기출 기본값은 당해 -1년
			year_s  = new Date().getFullYear() - 1;		// 기출 기본값은 당해 -1년
			if (type2_index == "7") { popYearItems = []; }

			// 학교별 기출유사 : 2021년도부터
			// 기출유사 전체년도 제외
			if (type2_index == "7") { popYearItems = []; }

			if((popGrade2Items[selectedInfo.grade2Index].value == "2" && popSubjectItems[selectedInfo.subject2Index].Value != "MT") || (popGrade2Items[selectedInfo.grade2Index].value == "1" && subject_v == "HI")) {
				year_s = "2024";
			}

			for(; year_s >= ((type2_index == "7") ? 2021 : 2013) ; year_s-- ) {
				var year_o = {};
				year_o["Name"] = year_s + "년 기출";
				year_o["Value"] = year_s;
				popYearItems.push(year_o);
			}
		} else if(type2_v == "H") {
			// 최빈, 최오는 학년에 따라 년도 다름
			// 이전, 최신 개정에 따라 년도값 다름
			if(isOldData == true) {
				if(subject_v == 'MT') {
					subject_v = 'MT_O';
				} else if (subject_v == 'SC') {
					subject_v = 'SC_O';
				} else if (subject_v == 'HI') {
					subject_v = 'HI_O';
				}
			}

			//popYearItems = [{Name: "전체 년도", Value: ""}].concat(getYears(_site_id, popGrade2Items[selectedInfo.grade2Index].value, pop2TypeItems[selectedInfo.type2Index].value, pop2TypeItems[selectedInfo.type2Index].CoreType, subject_v));
			popYearItems = popYearItems.concat(getYears(_site_id, grade_v, type2_v, coreType_v, subject_v));
		} else {
			//year_s  = new Date().getFullYear();

			for(; year_s >= year_t; year_s-- ) {
				var year_o = {};
				year_o["Name"] = year_s + "년";
				year_o["Value"] = year_s;
				popYearItems.push(year_o);
			}
		}

		// 학교별 기출유사는 분기마다 학기 늘려 나가기로~
		if(selectedInfo.menuIndex == 1 && pop2TypeItems[selectedInfo.type2Index].Index == "7") {			
			if (popYearItems[selectedInfo.year2Index].Value == "2021") {
				termItems = [{"title": "전체 학기", "Value": ""}, {"title": "2학기 중간", "Value": "2M"}, {"title": "2학기 기말", "Value": "2E"}]				
			} else {
				termItems = [{"title": "전체 학기", "Value": ""}, {"title": "1학기 중간", "Value": "1M"}, {"title": "1학기 기말", "Value": "1E"}, {"title": "2학기 중간", "Value": "2M"}, {"title": "2학기 기말", "Value": "2E"}]
			}
		} else {
			termItems = _term;
		}

		var filter_2 = root.querySelector("#filter_2");

		obj = filter_2.querySelector("[data-act='filter2_gu']");
		obj.innerHTML = gu2Items[selectedInfo.gu2Index].Name;

		obj = filter_2.querySelector("[data-act='filter2_sch']");
		obj.innerHTML = sch2Items[selectedInfo.sch2Index].Name;

		obj = filter_2.querySelector("[data-act='filter2_grade']");
		obj.innerHTML = popGrade2Items[selectedInfo.grade2Index].title || popGrade2Items[selectedInfo.grade2Index].Name;

		obj = filter_2.querySelector("[data-act='filter2_subject']");
		obj.innerHTML = popSubjectItems[selectedInfo.subject2Index].Name;

		obj = filter_2.querySelector("[data-act='filter2_year']");
		obj.innerHTML = popYearItems[selectedInfo.year2Index].Name;

		obj = filter_2.querySelector("[data-act='filter2_term']");
		obj.innerHTML = termItems[selectedInfo.term2Index].title;

		obj = filter_2.querySelector("[data-act='filter2_fileType']");
		obj.innerHTML = fileType2Items[selectedInfo.fileType2Index].Name;

		//PV 쌓기
		if (page_Act_Chk)	//처음 페이지 로딩시, 학년, 과목, 구분값 변경시 true
		{
			common.setCount(pop2TypeItems[selectedInfo.type2Index].Name, popGrade2Items[selectedInfo.grade2Index].title, popSubjectItems[selectedInfo.subject2Index].Name, null);
		}

		// 지역별, 최빈, 최오
		//if(selectedInfo.type2Index == 3) {
		if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 3 || parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 5 || parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 6) {
			pubItems = popSubjectItems[selectedInfo.subject2Index].TX_CODE;
			//var subject_v = popSubjectItems[selectedInfo.subject2Index].Value;

			obj = filter_2.querySelector("[data-act='filter2_pub']");
			if(pubItems.length > 1) {
				// 최빈, 최오의 경우는 전체 교과서 없이~
				if(type2_v == "H" && (coreType_v == "D" || coreType_v == "E")) {
					pubItems = pubItems;
				} else {
					pubItems = [{Name: "전체 교과서", Value: ""}].concat(pubItems);
				}
			}

			// 최빈, 최오 => 이전 개정 => 역사는 출판사 예외 처리
			if(type2_v == "H" && (coreType_v == "D" || coreType_v == "E")) {
				if(isOldData == true && subject_v == "HI_O") {
					if(grade_v == "1") {
						pubItems = [{"Name": "역사①", "Value": "M8HICHAA001"}];
					} else {
						pubItems = [{"Name": "역사①", "Value": "M8HICHAA001"}, {"Name": "역사②", "Value": "M8HICHAA002"}];
					}
				}
			}

			obj.innerHTML = pubItems[selectedInfo.pub2Index].Name;
		}

		/*
			- 최빈, 최오의 경우 년도값 숨김 처리
			- 내신완성 조건과 동일
		*/
		var btn_1 = filter_2.querySelector("[data-act='filter2_year']");
		var btn_2 = filter_2.querySelector("[data-act='filter2_term']");

		// 기본 노출
		btn_1.style.display = "";
		btn_2.style.display = "";

		var btn_tx = filter_2.querySelector("[data-act='filter2_pub']");

		if (((grade_v == 1 && ( subject_v == "KR" || subject_v == "EG" || subject_v == "MT" || subject_v == "SC" || subject_v == "LS" )) || (grade_v == 2 && (subject_v == "LS" && $(btn_tx).text() == "사회①"))) && (( type2_v == "H" && (coreType_v == "D" || coreType_v == "E")) )) {
			btn_1.style.display = "none";
			btn_2.style.width = "100%";
		} else {
			btn_2.style.width = "47%";
		}		
		
		_loadData();
	};

	var _setSelectedValueForFilter_FreeReding_Load = function() {
		popGrade2Items = [
			{"title":"1학년", "value":"1"},
			{"title":"2학년", "value":"2"},
			{"title":"3학년", "value":"3"}
		];

		termItems = _term;
		popYearItems = [{Name:"전체 년도",Value:""}];

		var type2_v = pop2TypeItems[selectedInfo.type2Index].value;
		var year_s;
		var last_Year;
		var grade_Val;

		grade_Val = popGrade2Items[selectedInfo.grade2Index].value;

		popSubjectItems = _Hierarchy[selectedInfo.grade2Index].Subj_Code;		

		// 2,3학년은 과목 index 최대 10, 1학년은 최대9라 아래 조건 맞을때 과목 index 강제 초기화
		if(grade_Val == 1 && selectedInfo.subject2Index == 10)
		{
			selectedInfo.subject2Index = 0;
		}

		var subject_v = popSubjectItems[selectedInfo.subject2Index].Value;

		year_s  = new Date().getFullYear() - 1;

		if(grade_Val == 1)
		{
			last_Year = 2018;
		}
		else if (grade_Val == 2)
		{
			last_Year = 2019;
		}
		else
		{
			last_Year = 2020;
		}

		for(var i = year_s; i >= last_Year; i-- ) {
			var year_o = {};
			year_o["Name"] = i + "년 기출";
			year_o["Value"] = i;
			popYearItems.push(year_o);
		}

		var filter_2 = root.querySelector("#filter_2");

		obj = filter_2.querySelector("[data-act='filter2_gu']");
		obj.innerHTML = gu2Items[selectedInfo.gu2Index].Name;

		obj = filter_2.querySelector("[data-act='filter2_sch']");
		obj.innerHTML = sch2Items[selectedInfo.sch2Index].Name;

		obj = filter_2.querySelector("[data-act='filter2_grade']");
		obj.innerHTML = popGrade2Items[selectedInfo.grade2Index].title || popGrade2Items[selectedInfo.grade2Index].Name;

		obj = filter_2.querySelector("[data-act='filter2_subject']");
		obj.innerHTML = popSubjectItems[selectedInfo.subject2Index].Name;

		obj = filter_2.querySelector("[data-act='filter2_year']");
		obj.innerHTML = popYearItems[selectedInfo.year2Index].Name;

		obj = filter_2.querySelector("[data-act='filter2_term']");
		obj.innerHTML = termItems[selectedInfo.term2Index].title;

		//PV 쌓기
		if (page_Act_Chk)	//처음 페이지 로딩시, 학년, 과목, 구분값 변경시 true
		{
			common.setCount(pop2TypeItems[selectedInfo.type2Index].Name, popGrade2Items[selectedInfo.grade2Index].title, popSubjectItems[selectedInfo.subject2Index].Name, null);
		}

		_loadData();
	};

	// 고득점마스터 필터 설정
	var _setSelectedValueForFilter2SubLoadK3 = function(){
		var filter_2 = root.querySelector("#filter_2");

		popGrade2Items = k3config[_site_id];		

		obj = filter_2.querySelector("[data-act='filter2_grade']");
		obj.innerHTML = popGrade2Items[selectedInfo.gradeK3Index].Name;

		popSubjectItems = popGrade2Items[selectedInfo.gradeK3Index]["subjItems"];	

//		if(selectedInfo.subject2Index > 1) {
//			selectedInfo.subject2Index = 0;
//		}

		obj = filter_2.querySelector("[data-act='filter2_subject']");
		obj.innerHTML = popSubjectItems[selectedInfo.subject2Index].Name;		

		pubItems = popGrade2Items[selectedInfo.gradeK3Index]["subjItems"][selectedInfo.subject2Index].pubList;
		//pubItems = popSubjectItems[selectedInfo.subject2Index].pubList;

		var subject_v = popSubjectItems[selectedInfo.subject2Index].Value;

		if (typeof(pubItems[selectedInfo.pub2Index]) == "undefined")
		{
			selectedInfo.pub2Index = 0;
		}

		obj = filter_2.querySelector("[data-act='filter2_pub']");
		obj.innerHTML = pubItems[selectedInfo.pub2Index].title;

		//alert("강남3구 / " + pop2TypeItems[selectedInfo.type2Index].Name + " / " + popGrade2Items[selectedInfo.gradeK3Index].Name + " / " + popSubjectItems[selectedInfo.subject2Index].Name );

		//PV 쌓기
		if (page_Act_Chk)	//처음 페이지 로딩시, 학년, 과목, 구분값 변경시 true
		{
			common.setCount(pop2TypeItems[selectedInfo.type2Index].Name, popGrade2Items[selectedInfo.gradeK3Index].Name, popSubjectItems[selectedInfo.subject2Index].Name, null);
		}

		_loadK3Data();
	};

	// 고득점마스터 필터 설정
	var _setSelectedValueForFilter3 = function() {
		var filter_3 = root.querySelector("#filter_3");
		if(filter_3) {
			if(isFirst.menu3) {
				if(gradeJson) {
					if(gradeJson.grade) {
						var isM = true;
						if(gradeJson.grade == "M1") {
							selectedInfo.grade3Index = 1;
						}
						else if(gradeJson.grade == "M2") {
							selectedInfo.grade3Index = 2;
						}
						else if(gradeJson.grade == "M3") {
							selectedInfo.grade3Index = 3;
						}
						else {
							isM = false;
						}

						if(isM) {
							var url_v = "/_api/search.api.asp";
							var data_v = "cmd=GET_GO_SUBJECT&site_id=" + _site_id + "&grade=" + popGradeItems[selectedInfo.grade3Index].value;
							comm.send(url_v, data_v, "post", function(json) {
								subject3Items = json.list;
								for(var i = 0; i < subject3Items.length; i++) {
									subject3Items[i]["Name"] = subject3Items[i].Course;
									subject3Items[i]["Value"] = subject3Items[i].Course_ID;
									if(gradeJson) {
										if(gradeJson.KR) {
											if(subject3Items[i].Course == "국어") {
												selectedInfo.subject3Index = i;
												break;
											}
										}
										else if(gradeJson.EG) {
											if(subject3Items[i].Course == "영어") {
												selectedInfo.subject3Index = i;
												break;
											}
										}
									}
								}

								var subject_id = subject3Items[selectedInfo.subject3Index].Value;
								var url2_v = "/_api/search.api.asp";
								var data2_v = "cmd=GET_GO_BOOK&subject_id=" + subject_id;
								comm.send(url2_v, data2_v, "post", function(json) {
									tx3Items = json.list;
									for(var j = 0; j < tx3Items.length; j++) {
										tx3Items[j]["Name"] = tx3Items[j].TextBook;
										tx3Items[j]["Value"] = tx3Items[j].TextBook_ID;

										if(gradeJson) {
											if(gradeJson.KR) {
												if(gradeJson.KR == tx3Items[j].TextBook_ID) {
													selectedInfo.tx3Items = j;
													break;
												}
											}
											else if(gradeJson.EG) {
												if(gradeJson.EG == tx3Items[j].TextBook_ID) {
													selectedInfo.tx3Items = j;
													break;
												}
											}
										}
									}
									_setSelectedValueForFilter3Sub();
								});
							});
						}
						else {
							_setSelectedValueForFilter3Sub();
						}
					}
					else {
						_setSelectedValueForFilter3Sub();
					}
				}
				else {
					_setSelectedValueForFilter3Sub();
				}
				isFirst.menu3 = false;
			}
			else {
				_setSelectedValueForFilter3Sub();
			}
		}
	};

	// 고득점마스터 필터 설정
	var _setSelectedValueForFilter3Sub = function() {
		var filter_3 = root.querySelector("#filter_3");
		if(filter_3) {
			var obj = filter_3.querySelector("[data-act='filter3_grade']");
			obj.innerHTML = popGradeItems[selectedInfo.grade3Index].Name;

			obj = root.querySelector("[data-act='showBindo']");
			obj.style.display = "";

			var url_v = "/_api/search.api.asp";
			var data_v = "cmd=GET_GO_SUBJECT&site_id=" + _site_id + "&grade=" + popGradeItems[selectedInfo.grade3Index].Value;
			comm.send(url_v, data_v, "post", function(json) {
				subject3Items = json.list;
				for(var i = 0; i < subject3Items.length; i++) {
					subject3Items[i]["Name"] = subject3Items[i].Course;
					subject3Items[i]["Value"] = subject3Items[i].Course_ID;
				}
				obj = filter_3.querySelector("[data-act='filter3_subject']");
				obj.innerHTML = subject3Items[selectedInfo.subject3Index].Name;

				//alert("챕터 3 고득점마스터 / 고득점마스터 / " + popGradeItems[selectedInfo.grade3Index].Name + " / " + subject3Items[selectedInfo.subject3Index].Name);

				//PV 쌓기
				if (page_Act_Chk)	//처음 페이지 로딩시, 학년, 과목, 구분값 변경시 true
				{
					common.setCount("고득점마스터", popGradeItems[selectedInfo.grade3Index].Name, subject3Items[selectedInfo.subject3Index].Name, null);
				}

				var subject_id = subject3Items[selectedInfo.subject3Index].Value;
				var url2_v = "/_api/search.api.asp";
				var data2_v = "cmd=GET_GO_BOOK&subject_id=" + subject_id;
				comm.send(url2_v, data2_v, "post", function(json) {
					tx3Items = json.list;
					for(var j = 0; j < tx3Items.length; j++) {
						tx3Items[j]["Name"] = tx3Items[j].TextBook;
						tx3Items[j]["Value"] = tx3Items[j].TextBook_ID;
					}
					if(subject_id == "17") {
						if(selectedInfo.grade3Index == 2) {
							tx3Items.splice(1,1);
						} else {
							tx3Items.reverse();
						}
					}

					if(subject_id == "18") {
						if(selectedInfo.grade3Index != 2) {
							tx3Items.reverse();
						}
					}
					obj = filter_3.querySelector("[data-act='filter3_tx']");
					obj.innerHTML = tx3Items[selectedInfo.tx3Index].Name;

					var url3_v = "/_api/search.api.asp";
					var data3_v = "cmd=GET_GO_CHAPTER&TextBook_ID=" + tx3Items[selectedInfo.tx3Index].Value;
					comm.send(url3_v, data3_v, "post", function(json) {
						chapter3Items = json.list;
						for(var j = 0; j < chapter3Items.length; j++) {
							chapter3Items[j]["Name"] = chapter3Items[j].Rootpart;
							chapter3Items[j]["Value"] = chapter3Items[j].Rootpart_ID;
						}
						obj = filter_3.querySelector("[data-act='filter3_chapter']");
						obj.innerHTML = chapter3Items[selectedInfo.chapter3Index].Name;

						obj = filter_3.querySelector("[data-act='filter3_sub']");
						obj.innerHTML = sub3Items[selectedInfo.sub3Index].Name;
						_loadData();
					});

				});
			});
		}
	};

	var mainList = [];
	// 데이터 가져오기
	var _loadData = function() {
		isLoading = true;
		window.setTimeout(function(ev) { isLoading = false;}, 1000);

		_saveInitData();	

		var obj = root.querySelector("[data-act='filter_chapter']");
		obj.innerHTML = "전체 대단원";
		selectedInfo.chapterData = [];
		
		if (p_add_diff == "") {
			var obj_level = root.querySelector("[data-act='filter_level']");
			obj_level.innerHTML = "난이도 선택";
			selectedInfo.levelData = [];
		} else {
			var level_title = "";
			var obj_level = root.querySelector("[data-act='filter_level']");
			for (var i = 0; i < selectedInfo.levelData.length ;i ++ ) {
				if (level_title == "") {
					level_title = selectedInfo.levelData[i].Name;
				} else {
					level_title += "," + selectedInfo.levelData[i].Name;
				}
			}
			obj_level.innerHTML = level_title;
		}

		var dl_o = document.querySelector("#downloadLayer");
		var dlMsg_o = dl_o.querySelectorAll("#subMsg");
		var dlMsg_o1 = dl_o.querySelectorAll("#subMsg1");
		var dlMsg_o2 = dl_o.querySelectorAll(".subMsg2");
		if(dlMsg_o){
			$(dlMsg_o).hide();
		}

		if(dlMsg_o1){
			$(dlMsg_o1).hide();
		}

		if(dlMsg_o2){
			$(dlMsg_o2).hide();
		}

		obj = root.querySelector("#oldData");
		if(obj){
			obj.style.display = "none";
		}

		if(Page == 1) {
		}

		obj = root.querySelectorAll("[name='qry']");
		obj.forEach(function(item){
			if(item.value){
				item.value = item.value.replaceAll('"', "");
				Page = 1;
				PageSize = 20;
			}
		});

		if(selectedInfo.menuIndex == 0) {
			var f_1 = root.querySelector("#filter_1");
			var site_v = _site_id;
			var grade_v = popGradeItems[selectedInfo.gradeIndex].Value;
			var group_v = popGroupItems[selectedInfo.groupIndex].Value;
			var coreType_v = popGroupItems[selectedInfo.groupIndex].CoreType;
			if(coreType_v == null) coreType_v = "";
			var subject_v = popSubjectItems[selectedInfo.subjectIndex].Value;
			var tx_v = popTxItems[selectedInfo.txIndex].Value;
			var tx_name = encodeURIComponent(popTxItems[selectedInfo.txIndex].Name);
			var year_v =popYearItems[selectedInfo.yearIndex].Value;
			var term_v = termItems[selectedInfo.termIndex].Value;

			if(parseInt(popGroupItems[selectedInfo.groupIndex].Index) == 0) {	//  개념완성 -> 대단원 조회부터.
			//if(selectedInfo.groupIndex == 0) {	//  개념완성 -> 대단원 조회부터.
				if(tx_name.indexOf("전체") >= 0) {
					tx_name = "";
				}
				var url_v = "/_api/search.api.asp";
				var data_v = "cmd=GET_BOOK_FINALTITLE&site_id=" + site_v;
				data_v = data_v + "&TX_CODE=" + tx_v;
				if(tx_v != "M8KRCHA3014") {
					data_v = data_v + "&Subj_Code=" + subject_v;
				}
				if(subject_v == "LS") {
					if(grade_v == "1") {
						data_v = data_v + "&pub_name=";
					} else {
						data_v = data_v + "&pub_name=" + tx_name;
					}

				} else {
					data_v = data_v + "&pub_name=" + tx_name;
				}

				if(subject_v == "HI") {
					data_v = data_v + "&course=28";
				}
				else if (subject_v == "ET") {
				}
				else if (subject_v == "SC") {
					data_v = data_v + "&course=28";
				}
				else if(subject_v == "KR") {
					if(tx_v == "M8KRCHA3014" || tx_v == "M8KRCHA3015" || tx_v == "M8KRCHA3018") {
						data_v = data_v + "&course=28";
					}
					else {
						data_v = data_v + "&course=31";
					}
				}
				else if (subject_v == "MT") {
					data_v = data_v + "&course=28";
				}
				else {
					if(subject_v == "EG" && grade_v == 3) {
						data_v = data_v + "&Group=" + group_v;
						data_v = data_v + "&course=28";
					} else {
						data_v = data_v + "&course=31";
					}
				}
				data_v = data_v + "&Grade=" + grade_v;
				comm.send(url_v, data_v, "post", function(json) {
					if(subject_v == "HI") {
						json.subList = [];
						for(var j = 0; j < json.list.length; j++) {
							json.list[j]["subList"] = [];
						}
					}
					if(subject_v == "EG") {
						if(grade_v == "2") {
							json.subList = [];
							for(var j = 0; j < json.list.length; j++) {
								json.list[j]["subList"] = [];
							}
						}
					}

					for(var i = 0; i < json.subList.length; i++) {
						var sitem = json.subList[i];
						for(var j = 0; j < json.list.length; j++) {
							var mitem = json.list[j];
							if(mitem.textbook_id == sitem.textbook_id && mitem.rootpart_code == sitem.rootpart_code) {
								if(json.list[j]["subList"] == null) json.list[j]["subList"] = [];
								json.list[j].subList.push(sitem);
								break;
							}
						}
					}
					mainList = json.list;
					if(mainList.length == 0) {
						mainList = [{"subList":[], "items":[]}];
					}

					$("#fold1").prop("checked", true);

					// 영어 Special Lesson 예외
					if(tx_v == "M9EGCHA2001" || tx_v == "M9EGCHA2002") {
						chapterItems = [{Name: "전체 대단원", Value: ""}];

						for(var i=0; i<mainList.length; i++) {
							var chapterItem = mainList[i];

							var rc = chapterItem.rootpart_code;
							var rn = chapterItem.rootpart_name;

							var obj = {};

							if(rn.indexOf("Special") >= 0 && rn.indexOf("Lesson") >= 0) {
								obj.Name = rn;
							} else {
								obj.Name = rc + ". " + rn;
							}

							obj.Value = rc;

							chapterItems.push(obj);

						}
					}

					_loadData_1_1();
				});

			}
			else {
				if(group_v == "C") {
					$("#fold1").prop("checked", true);
				}
				// 영문법 / 구문독해
				if ( (group_v == "K" && coreType_v.substring(0,1) == "C") || (group_v == "P" && coreType_v.substring(0,1) == "E" )) {
					_loadData_1_P();
				} else {
					_loadData_1();
				}
			}
			$(dlMsg_o).show();
			$(dlMsg_o1).show();
			$(dlMsg_o2).hide();
		}
		else if(selectedInfo.menuIndex == 1) {
			if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 2 || parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 8) {
				$(dlMsg_o).show();
				$(dlMsg_o1).hide();
				$(dlMsg_o2).show();
			} else {
				$(dlMsg_o).show();
				$(dlMsg_o1).show();
				$(dlMsg_o2).hide();
			}

			if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 0) {
				_loadData_FreeReading();
			} 
			else if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 4) {
				_loadK3Data();
			} else if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 5 || parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 6) {
				// 최빈, 최오
				//_loadData_1();
				_loadData_2_H();
			} 
			else if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 2 || parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 8) { // 예상족보, AI기출변형
				_loadData_2_V();
			}
			else {
				_loadData_2();
			}
		}
		else if(selectedInfo.menuIndex == 2) {
			_loadData_3();
			$(dlMsg_o).show();
			$(dlMsg_o1).show();
			$(dlMsg_o2).hide();
		}
		// Pro 관련 (s)
		else if (selectedInfo.menuIndex == 3 || selectedInfo.menuIndex == 4 || selectedInfo.menuIndex == 5) {
			var f_1 = root.querySelector("#filter_1");
			var site_v = _site_id;
			var grade_v = popGradeItems[selectedInfo.gradeIndex].Value;
			var group_v = popGroupItems[selectedInfo.groupIndex].Value;
			var coreType_v = popGroupItems[selectedInfo.groupIndex].CoreType;
			if(coreType_v == null) coreType_v = "";
			var subject_v = popSubjectItems[selectedInfo.subjectIndex].Value;
			var tx_v = popTxItems[selectedInfo.txIndex].Value;
			var tx_name = encodeURIComponent(popTxItems[selectedInfo.txIndex].Name);
			var year_v =popYearItems[selectedInfo.yearIndex].Value;

			if (group_v == "P" && coreType_v.substring(0,1) == "D") {//중등 갈래별
				if (typeof(popSubItems[selectedInfo.termIndex]) == "undefined") { selectedInfo.termIndex = 0; }
			} else {
				if (typeof(termItems[selectedInfo.termIndex]) == "undefined") { selectedInfo.termIndex = 0; }
				var term_v = termItems[selectedInfo.termIndex].Value;
			}

			if((group_v == "P" && coreType_v.substring(0,1) == "C") || (group_v == "P" && coreType_v.substring(0,1) == "B")){
				// 수학교과서변형 수학단계별학습관
				if(tx_name.indexOf("전체") >= 0) {
					tx_name = "";
				}

				obj = root.querySelector("#oldData");

				if(obj && group_v == "P" && (coreType_v.substring(0,1) == "B" || coreType_v.substring(0,1) == "C") && grade_v == "2"){
					obj.style.display = "";

					if (isOldData) {
						jQuery("#oldData > a").html("<span class='is-bedge'>22개정</span>최신 개정자료 보기");
					} else {
						jQuery("#oldData > a").html("<span class='is-bedge'>15개정</span>이전 개정자료 보기");
					}					
				}

				var url_v = "/_api/search.api.asp";
				var data_v = "cmd=GET_BOOK_FINALTITLE&site_id=" + site_v;
				data_v = data_v + "&TX_CODE=" + tx_v;
				data_v = data_v + "&Subj_Code=" + subject_v;
				data_v = data_v + "&pub_name=" + tx_name;
				data_v = data_v + "&course=28";
				data_v = data_v + "&Grade=" + grade_v;
				comm.send(url_v, data_v, "post", function(json) {
					//console.log(url_v)
					//console.log(data_v)
					//console.log(json)
					for(var i = 0; i < json.subList.length; i++) {
						var sitem = json.subList[i];
						for(var j = 0; j < json.list.length; j++) {
							var mitem = json.list[j];
							if(mitem.textbook_id == sitem.textbook_id && mitem.rootpart_code == sitem.rootpart_code) {
								if(json.list[j]["subList"] == null) json.list[j]["subList"] = [];
								json.list[j].subList.push(sitem);
								break;
							}
						}
					}
					mainList = json.list;
					if(mainList.length == 0) {
						mainList = [{"subList":[], "items":[]}];
					}
					$("#fold1").prop("checked", true);
					_loadData_1_1_P();
				});
			} 
			// 서술형 / 최다빈출 / 최다오답
			else if (group_v == "C" || group_v == "M" || ( group_v == "H" && ( coreType_v.substring(0,1) == "D" || coreType_v.substring(0,1) == "E" || coreType_v.substring(0,1) == "T" ))) {
				_loadData_1();
			}
			else if(group_v == "B")
			{				
				_loadData_1_1_Preparation();
			}
			else {
				_loadData_1_P();
			}
			$(dlMsg_o).show();
			$(dlMsg_o1).show();
			$(dlMsg_o2).hide();
		}
		// Pro 관련 (e)
	};

	var _loadData_1_1_Preparation = function() {		
		var f_1 = root.querySelector("#filter_1");
		var site_v = _site_id;
		var grade_v = popGradeItems[selectedInfo.gradeIndex].Value;
		var group_v = popGroupItems[selectedInfo.groupIndex].Value;
		var coreType_v = popGroupItems[selectedInfo.groupIndex].CoreType;
		if(coreType_v == null) coreType_v = "";
		var subject_v = popSubjectItems[selectedInfo.subjectIndex].Value;
		var tx_v = popTxItems[selectedInfo.txIndex].Value;
		var pubname_v = encodeURIComponent(popTxItems[selectedInfo.txIndex].Name);
		var group_n = popGroupItems[selectedInfo.groupIndex].Name;
		var url_v = "/ZocboMid/ZocboExam/Exam_Preparation.asp";

		var data_v = "site_id=" + site_v;
		data_v = data_v + "&Group=B";
		data_v = data_v + "&Grade=" + grade_v;
		data_v = data_v + "&Subj_Code=" + subject_v;
		data_v = data_v + "&ExPapr_CoreType=" + "A|B|C";
		data_v = data_v + "&TX_CODE=" + tx_v;
		data_v = data_v + "&Page=" + Page;
		data_v = data_v + "&PageSize=1000";	

		if(rootpart_codes && rootpart_codes.length != 0)
		{
			data_v = data_v + "&rootpart_code=" + rootpart_codes.join(",");
		}

		comm.send(url_v, data_v, "POST", function(json) {
			comm.toggleLoading(false);
			activeRow = row_B;

			if (json.RecordCount == 0) {
				_drawNoList();
				return;
			}			
			
			totalCount = json.RecordCount;
			mainList = json.list;

			if(typeof mainList == 'undefined')
			{
				mainList = {};
				mainList.RecordCount = 0;
			}
			else
			{
				mainList.RecordCount = json.RecordCount;
			}

			totalPage = 1;

			var vodLen = 0;

			chapterItems = [{Name: "전체 대단원", Value: ""}];

			for(var i=0; i<mainList.length; i++) {
				var mItem = mainList[i];
				var obj = {};

				var rc = mItem.rootpart_code;
				var rn = mItem.rootpart_name;
				
				obj.Name = rn ;

				obj.Value = rc;
				chapterItems.push(obj);
			}

			_hLog("chapterItems=" + JSON.stringify(chapterItems));

			var parent = root.querySelector("#row_B");
			var num_o = parent.querySelector(".bbsNumber b");

			num_o.innerHTML = util.toNumber(mainList.RecordCount);

			_drawList_Preparation(mainList);
		});
	};

	// Pro 관련 (s)
	// 수학교과서변형 / 수학단계별학습관
	var _loadData_1_1_P = function() {
		var f_1 = root.querySelector("#filter_1");
		var site_v = _site_id;
		var grade_v = popGradeItems[selectedInfo.gradeIndex].Value;
		var group_v = popGroupItems[selectedInfo.groupIndex].Value;
		var coreType_v = popGroupItems[selectedInfo.groupIndex].CoreType;
		if(coreType_v == null) coreType_v = "";
		var subject_v = popSubjectItems[selectedInfo.subjectIndex].Value;
		var tx_v = popTxItems[selectedInfo.txIndex].Value;
		var pubname_v = encodeURIComponent(popTxItems[selectedInfo.txIndex].Name);

		var group_n = popGroupItems[selectedInfo.groupIndex].Name;

		var url_v = "/ZocboMid/ZocboExam/Exam_MathTextbookChange.asp";

		if (group_v == "P" && coreType_v.substring(0,1) == "B") {
			url_v = "/ZocboMid/ZocboExam/Exam_MathStep.asp";
		}

		var data_v = "site_id=" + site_v;
		data_v = data_v + "&Grade=" + grade_v;
		data_v = data_v + "&Subj_Code=" + subject_v;
		data_v = data_v + "&ExPapr_CoreType=" + coreType_v;
		data_v = data_v + "&TX_CODE=" + tx_v;
		data_v = data_v + "&bookname=" + pubname_v;
		data_v = data_v + "&Page=" + Page;
		data_v = data_v + "&textbook=" + popTxItems[selectedInfo.txIndex].textbook;
		data_v = data_v + "&PageSize=1000";

		var oldData_v = (isOldData ? "Y" : "N" );

		if(coreType_v.substring(0,1) == "B" || coreType_v.substring(0,1) == "C") {
			data_v = data_v + "&OldData=" + oldData_v;
		}

		comm.send(url_v, data_v, "POST", function(json) {
			//console.log(url_v);
			//console.log(data_v);
			//console.log(json);
			comm.toggleLoading(false);
			activeRow = row_B;
			if (json.RecordCount == 0) {
				_drawNoList();
				return;
			}
			totalCount = json.RecordCount;
			mainList = json.list;
			mainList.RecordCount = json.RecordCount;
			//mainList.exPaprNoList = json.exPaprNoList;

			totalPage = 1;

			var vodLen = 0;

			chapterItems = [{Name: "전체 대단원", Value: ""}];
			for(var i=0; i<mainList.length; i++) {
				var mItem = mainList[i];
				var obj = {};

				var rc = mItem.rootpart_code;
				var rn = mItem.rootpart_name;
				if(rn.indexOf("Special") >= 0 && rn.indexOf("Lesson") >= 0) {
					obj.Name = rn ;
				} else {
					obj.Name = rc + ". " + rn;
				}
				obj.Value = rc;
				chapterItems.push(obj);

				//_getVODLength(mItem, vodLen);
			}

			_hLog("chapterItems=" + JSON.stringify(chapterItems));

			//var exPaprNoList = mainList.exPaprNoList;

			//var lstIdx = exPaprNoList.lastIndexOf(",");
			//if(exPaprNoList.substring(lstIdx, exPaprNoList.length) == ",") {
			//	exPaprNoList = exPaprNoList.substr(0, lstIdx);
			//}

			var parent = root.querySelector("#row_B");
			var num_o = parent.querySelector(".bbsNumber b");

			num_o.innerHTML = util.toNumber(mainList.RecordCount);

			_drawList_P(mainList);
			//_drawDownCount(exPaprNoList);
		});
	};

	// 국어문법 / 갈래별문학 (중등 문학 공략) / 영문법 / 영어독해
	var _loadData_1_P = function() {
		var f_1 = root.querySelector("#filter_1");
		var site_v = _site_id;
		var grade_v = popGradeItems[selectedInfo.gradeIndex].Value;
		var group_v = popGroupItems[selectedInfo.groupIndex].Value;
		var subject_v = popSubjectItems[selectedInfo.subjectIndex].Value;
		var subjectName_v = popSubjectItems[selectedInfo.subjectIndex].Name;
		var year_v =popYearItems[selectedInfo.yearIndex].Value;
		var coreType_v = popGroupItems[selectedInfo.groupIndex].CoreType;
		var tx_v = popTxItems[selectedInfo.txIndex].Value;
		var term_v
		if (group_v == "P" && coreType_v.substring(0,1) == "D") {
			term_v = popTxItems[selectedInfo.txIndex].Value;
		} else {
			term_v = termItems[selectedInfo.termIndex].Value;
		}
		var keyword_v = encodeURIComponent(f_1.querySelector("[name='qry']").value).trim();
		var oldData_v = (isOldData ? "Y" : "N" );
		if(coreType_v == null) coreType_v = "";
		var cutCoreType_v = coreType_v.substring(0,1);
		var isMathCalc = false;

		var url_v = "/_api/search.api.asp";
		var data_v = "cmd=CSEARCH";

		if (group_v == "P" && (cutCoreType_v == "A" || cutCoreType_v == "D")) {
			// 국어문법, 갈래별문학 (중등 문학 공략)
			subject_v = "KR"
			subjectName_v = "국어"
		} else if ((group_v == "P" && cutCoreType_v == "E") || (group_v == "K" && cutCoreType_v == "C")) {
			// 구문독해, 영문법
			subject_v = "EG"
			subjectName_v = "영어"
		}

		if((group_v == "K" && coreType_v == "C") || (group_v == "P" && cutCoreType_v == "E")) {
			// 영문법 구문독해
			url_v = "/ZocboMid/ZocboExam/Exam_MidEngGrammar_test0.asp";
			data_v = "flag=" + year_v;
			PageSize = 1000;
		} else {
			data_v = data_v + "&qry=" + keyword_v;
			data_v = data_v + "&ExPapr_TestYear=" + year_v;
			data_v = data_v + "&ExPapr_MidEndTerm=" + term_v;
			data_v = data_v + "&TX_CODE=" + encodeURIComponent(tx_v);
		}

		data_v = data_v + "&Grade=" + grade_v;
		data_v = data_v + "&Group=" + group_v;
		data_v = data_v + "&Subj_Code=" + subject_v;
		data_v = data_v + "&ExPapr_CoreType=" + coreType_v;
		data_v = data_v + "&Page=" + Page;
		data_v = data_v + "&PageSize=" + PageSize;

		if (group_v == "P" && cutCoreType_v == "D") {
			// 갈래별문학 (중등 문학 공략)
			url_v = "/ZocboMid/ZocboExam/Exam_KoreanPart.asp";
			data_v = data_v + "&ExPapr_CoreType=" + coreType_v;
			data_v = "site_id=" + _site_id + "&ExPapr_Group="+group_v;
			if (year_v == "W") {
				// 작품별 divisionType W
				coreType_v = tx_v;
			} else if (year_v == "A") {
				// 작가별	divisionType A
				coreType_v = tx_v;
			}
			var key_v = ""

			if (popSubItems[selectedInfo.termIndex].Name != "전체") {
				key_v = encodeURIComponent(popSubItems[selectedInfo.termIndex].Name);
			}

			if (keyword_v.length == 0) {
				keyword_v = key_v;
			} else {
				keyword_v = keyword_v + " " + key_v;
			}
			data_v = data_v + "&DivisionType=" + year_v;
			data_v = data_v + "&ExPapr_CoreType=" + coreType_v;
			totalPage = 1;
			data_v = data_v + "&Grade=" + grade_v;
			data_v = data_v + "&Subj_Code=" + subject_v;
			data_v = data_v + "&qry=" + keyword_v;
			data_v = data_v + "&Page=" + Page;
			data_v = data_v + "&PageSize=" + PageSize;
			data_v = data_v + "&Group=" + group_v;
			data_v = data_v + "&TX_CODE=" + term_v;
		}

		// 수행평가 예외처리
		if (group_v == "T") {			
			coreType_v = tx_v;	
			url_v = "/M/PAmaster/down_test.asp";

			data_v = "OldData=" + oldData_v;
			data_v = data_v + "&Subj_Name=" + encodeURIComponent(subjectName_v);

			if(rootpart_codes && rootpart_codes.length != 0)
			{
				data_v = data_v + "&rootpart_code=" + rootpart_codes.join(",");
			}

			data_v = data_v + "&qry=" + keyword_v;
			data_v = data_v + "&ExPapr_TestYear=";
			data_v = data_v + "&ExPapr_MidEndTerm=" + term_v;
			data_v = data_v + "&TX_CODE=" + encodeURIComponent(year_v);
			data_v = data_v + "&Grade=" + grade_v;
			data_v = data_v + "&Group=" + group_v;
			data_v = data_v + "&Subj_Code=" + subject_v;
			data_v = data_v + "&ExPapr_CoreType=" + coreType_v;
			data_v = data_v + "&Page=" + Page;
			data_v = data_v + "&PageSize=" + PageSize;
		}

		var row_A = root.querySelector("#row_A");
		var row_B = root.querySelector("#row_B");
		var lt_o = row_B.querySelector(".listTop");

		// toggle 선택 시 대단원에 해당하는 서브 리스트 호출하기 위해 호출 주소 전역변수에 저장
		_url_v = url_v;
		_data_v = data_v;


		// 대단원에 따라 리스트를 불러오는 경우 필요한 초기값 확인
		var rootpart_code = "";

		if (group_v == "P" && cutCoreType_v == "A") {
			item = pro_list[0].list;
			_drawList_P(item)
		} else {
			comm.send(url_v, data_v, "POST", function(json) {
				//console.log(_url_v)
				//console.log(_data_v)
				//console.log(json);
				if(Page == 1) {
					if((group_v == "K" && coreType_v == "C") || (group_v == "P" && cutCoreType_v == "E")) {
						// 영문법 구문독해
						items = json.list;
						totalCount = json.list.length;
						totalPage = Math.ceil(totalCount / PageSize);
					} else if (group_v == "P" && cutCoreType_v == "D") {
						//갈래별문학 (중등 문학 공략)
						cateItems = korCateArr;
						items = json.list;
						totalCount = json.RecordCount;
						totalPage = 1;
					} else if (group_v == "T") {
						// 수행평가
						// 그려져있던 li 태그 삭제
						var objs = row_B.querySelectorAll(".block_list");

						for(var i = 0; i < objs.length; i++)
						{
							var obj = objs[i];

							if(obj.parentNode)
							{
								obj.parentNode.removeChild(obj);
							}
						}

						items = json.list;
						totalCount = json.RecordCount;
						totalPage = Math.ceil(totalCount / PageSize);
						chapterItems = [{"Name" : "전체 대단원", "Value": ""}];

						for(var i = 0; i < json.cate.length; i++)
						{
							var chapterItem = json.cate[i];
							var obj = {};
							var rc = chapterItem.rootpart_code;
							var rn = chapterItem.rootpart_name;
							var ri = chapterItem.rootpart_id;
							var rt = chapterItem.rootpart_term;

							if(rt != "")
							{
								obj.term = rt;
							}

							if(rn.indexOf("Special") >= 0 && rn.indexOf("Lesson") >= 0)
							{

							}
							else
							{
								obj.Name = rc + ". " + rn;
								obj.Value = rc;
								chapterItems.push(obj);
							}
						}
					}

					$("#recordCount").html(util.toNumber(totalCount));

				} else {
					if((group_v == "K" && coreType_v == "C") || (group_v == "P" && cutCoreType_v == "E")) {
						//영문법 구문독해
						items = items.concat(json.list);
					} else if (group_v == "P" && cutCoreType_v == "D") {
						//갈래별문학 (중등 문학 공략)
						items = json.list;
						totalCount = json.RecordCount;
						totalPage = 1;
					} else if (group_v == "T") {
						// 수행평가
						items = json.list;
						totalCount = json.RecordCount;
						totalPage = Math.ceil(totalCount / PageSize);
						chapterItems = [{"Name" : "전체 대단원", "Value": ""}];

						for(var i = 0; i < json.cate.length; i++)
						{
							var chapterItem = json.cate[i];
							var obj = {};
							var rc = chapterItem.rootpart_code;
							var rn = chapterItem.rootpart_name;
							var ri = chapterItem.rootpart_id;
							var rt = chapterItem.rootpart_term;

							if(rt != "")
							{
								obj.term = rt;
							}

							if(chapterItem.rootpart_name.indexOf("Special") > -1)
							{
								obj.Name = rn ;
							}
							else
							{
								obj.Name = rc + ". " + rn;
							}

							obj.Value = rc;
							chapterItems.push(obj);
						}
					}
				}

				var exPaprNoList = "";

				if((group_v == "K" && coreType_v == "C") || (group_v == "P" && cutCoreType_v == "E")) {
					// 영문법 구문독해
					row_A.style.display = "none";
					row_B.style.display = "";
					activeRow = row_B;

					if (group_v == "P" && cutCoreType_v == "E") {
						// 구문독해는 마지막 대단원 미노출
						tmpChapterItems = [{Name: "전체 대단원", Value: ""}].concat(json.cate);
						chapterItems = [{Name: "전체 대단원", Value: ""}].concat(json.cate.slice(0, json.cate.length-1));
					} else {
						chapterItems = [{Name: "전체 대단원", Value: ""}].concat(json.cate);
					}

					grammerSelector.init(json.list, year_v, selectedInfo.termIndex, row_B, _site_id);

					return;
				} else if (group_v == "P" && cutCoreType_v == "D") {
					//갈래별문학 (중등 문학 공략)
					row_A.style.display = "none";
					row_B.style.display = "";
					activeRow = row_B;

					var exNoArr = [];
					var tmpItemsLength = 0;
					for(var i=0; i<items.length; i++) {
						var sItem = items[i];
						tmpItemsLength ++;
						exNoArr.push(sItem.exPapr_no);
					}
					var tmpItems = [];
					tmpItems["items"] = items;
					tmpItems["length"] = tmpItemsLength;
					items = tmpItems

					exPaprNoList = exNoArr.join(",");

					_drawList_v2_P(cateItems, items);
				} else if (group_v == "T") {
					//수행평가
					var exNoArr = [];

					row_A.style.display = "none";
					row_B.style.display = "";
					activeRow = row_B;

					for(var i = 0; i < items.length; i++)
					{
						var sItem = items[i];

						for(var j = 0; j < sItem.items.length; j++)
						{
							var s2Item = sItem.items[j];

							exNoArr.push(s2Item.exPapr_no);
						}
					}

					exPaprNoList = exNoArr.join(",");
					_drawList_P(items);
				}

				_initEvent();
				comm.toggleLoading(false);
				if(json.Zocbo) {
					_drawDownCount(json.Zocbo.exPaprNoList);
				} else {
					_drawDownCount(exPaprNoList);
				}
			});
		}
	};
	// Pro 관련 (e)

	// 단원별 문제 > 개념완성 그리기
	var _loadData_1_1 = function() {
		var f_1 = root.querySelector("#filter_1");
		var site_v = _site_id;
		var grade_v = popGradeItems[selectedInfo.gradeIndex].Value;
		var group_v = popGroupItems[selectedInfo.groupIndex].Value;
		var coreType_v = popGroupItems[selectedInfo.groupIndex].CoreType;
		if(coreType_v == null) coreType_v = "";
		var subject_v = popSubjectItems[selectedInfo.subjectIndex].Value;
		var tx_v = popTxItems[selectedInfo.txIndex].Value;
		var pubname_v = encodeURIComponent(popTxItems[selectedInfo.txIndex].Name);

		var group_n = popGroupItems[selectedInfo.groupIndex].Name;

		var filter_chapter = f_1.querySelector("[data-act='filter_chapter']");
		if(group_n == "개념완성" || group_n == "요점정리") {
			filter_chapter.parentNode.style.display = "";
		} else {
			filter_chapter.parentNode.style.display = "none";
		}

		var url_v = "/ZocboMid/ZocboExam/Exam_ConceptCheck_test0.asp";
		var data_v = "site_id=" + site_v;

		if(group_v == "H") {
			coreType_v = "";
		}

		data_v = data_v + "&Grade=" + grade_v;
		data_v = data_v + "&Subj_Code=" + subject_v;
		data_v = data_v + "&ExPapr_CoreType=" + coreType_v;
		data_v = data_v + "&TX_CODE=" + tx_v;
		data_v = data_v + "&pub_name=" + pubname_v;
		data_v = data_v + "&Page=" + Page;
		data_v = data_v + "&PageSize=1000";


		comm.send(url_v, data_v, "POST", function(json) {
			//console.log(url_v)
			//console.log(data_v)
			//console.log(json)
			comm.toggleLoading(false);
			totalCount = json.RecordCount;
			mainList = json.list;
			mainList.RecordCount = json.RecordCount;
			mainList.exPaprNoList = json.exPaprNoList;

			totalPage = 1;

			var vodLen = 0;

			// 영어 Special Lesson 예외
			if(tx_v != "M9EGCHA2001" && tx_v != "M9EGCHA2002") {
				chapterItems = [{Name: "전체 대단원", Value: ""}];
				for(var i=0; i<mainList.length; i++) {
					var mItem = mainList[i];
					var obj = {};

					var rc = mItem.rootpart_code;
					var rn = mItem.rootpart_name;
					if(rn.indexOf("Special") >= 0 && rn.indexOf("Lesson") >= 0) {
						obj.Name = rn ;
					} else {
						obj.Name = rc + ". " + rn;
					}
					obj.Value = rc;
					chapterItems.push(obj);

					_getVODLength(mItem, vodLen);
				}
			}

			_hLog("chapterItems=" + JSON.stringify(chapterItems));

			var exPaprNoList = mainList.exPaprNoList;

			var lstIdx = exPaprNoList.lastIndexOf(",");
			if(exPaprNoList.substring(lstIdx, exPaprNoList.length) == ",") {
				exPaprNoList = exPaprNoList.substr(0, lstIdx);
			}

			var parent = root.querySelector("#row_B");
			var num_o = parent.querySelector(".bbsNumber b");

			num_o.innerHTML = util.toNumber(mainList.RecordCount);

			_drawList(mainList);
			_drawDownCount(exPaprNoList);
		});
	};

	// 동영상 개수 구하기
	var _getVODLength = function(item_p, vodLen_p){
		if(item_p == null) return;

		var sList = item_p.subList;
		if(sList == null) {
			sList = item_p.items;
		}

		if(sList == null) {
			sList = item_p;
		}

		if(sList && sList.length > 0) {
			for(var i=0; i<sList.length; i++) {
				var sItem = sList[i];

				var vList = sItem.items;

				if(vList && vList.length > 0){
					for(var j=0; j<vList.length; j++) {
						var vItem = vList[j];
						vodLen_p += vItem.vodConcept.length;
					}
				} else {
					if(sItem.vodConcept){
						vodLen_p += sItem.vodConcept.length;
					}
				}
			}
		}

		totalCount = parseInt(totalCount) + vodLen_p;
		mainList.RecordCount = totalCount;
	};

	// 대단원/중단원이 있는 경우. 데이터 정렬
	var _sortData = function(mList, dList) {
		for(var k = 0 ; k < dList.length ; k ++) {
			var dItem = dList[k];
			var isFind = false;
			for(var i = 0; i < mList.length; i++) {
				var mItem = mList[i];
				for(var j = 0; j < mItem.subList.length; j++) {
					var sItem = mItem.subList[j];
					var stitle_v = sItem.subpart_name;
					var sNum = sItem.rootpart_code + "-" + sItem.subpart_code;
					if(stitle_v.indexOf("(") > 0) {
						var stitle_a = stitle_v.split("(");
						var title_1 = stitle_a[0];
						var title_2 = stitle_a[1].replace(")", "");
						var title_a = title_2.split(",");

						var sStr = sItem.rootpart_code + "-" + sItem.subpart_code + "." + title_1;
						if(dItem.expapr_title.indexOf(sStr) >= 0 && dItem.expapr_title.indexOf(sNum) >= 0) {
							if(mList[i].subList[j]["items"] == null) mList[i].subList[j]["items"] = [];
							dItem.mark = 1;
							dList[k] = dItem;
							mList[i].subList[j]["items"].push(dItem);
							isFind = true;
						}

						if(isFind == false) {
							for(var m = 0; m < title_a.length; m++) {
								if(dItem.expapr_title.indexOf(title_a[m].trim()) >= 0 && dItem.expapr_title.indexOf(sNum) >= 0) {
									isFind = true;
									break;
								}
							}
							if(isFind) {
								if(mList[i].subList[j]["items"] == null) mList[i].subList[j]["items"] = [];
								dItem.mark = 1;
								dList[k] = dItem;
								mList[i].subList[j]["items"].push(dItem);
								break;
							}
						}
					}
					else {
						var sStr = sItem.rootpart_code + "-" + sItem.subpart_code + "." + sItem.subpart_name;
						sStr = sItem.subpart_name;
						if(dItem.expapr_title.indexOf(sStr) >= 0 && dItem.expapr_title.indexOf(sNum) >= 0) {
							isFind = true;
							if(mList[i].subList[j]["items"] == null) mList[i].subList[j]["items"] = [];
							dItem.mark = 1;
							dList[k] = dItem;
							mList[i].subList[j]["items"].push(dItem);
							break;
						}
					}
				}
			}// end main list loop

			if(isFind == false) {
				var title_v = dItem.expapr_title || dItem.title || dItem.detail_Title;
				var title_a = title_v.split("]");
				_hLog("title_a=" + JSON.stringify(title_a));
				if(title_a.length >= 2) {
					var stitle_v = title_a[1].trim();
					var stitle_a = stitle_v.split(".");
					_hLog("stitle_a=" + JSON.stringify(stitle_a));
					if(stitle_a.length > 1) {
						var num_v = stitle_a[0].trim();
						var num_a = num_v.split("-");
						var rootpart_code_v = num_a[0];
						var subpart_code_v = num_a[1];

						for(var i = 0; i < mList.length; i++) {
							var mItem = mList[i];
							if(mItem.rootpart_code == rootpart_code_v) {
								for(var j = 0; j < mItem.subList.length; j++) {
									var sItem = mItem.subList[j];
									if(sItem.rootpart_code == rootpart_code_v && sItem.subpart_code == subpart_code_v) {
										if(mList[i].subList[j]["items"] == null) mList[i].subList[j]["items"] = [];
										dItem.mark = 1;
										dList[k] = dItem;
										mList[i].subList[j]["items"].push(dItem);
										break;
									}
								}
								if(dItem.mark == 1) break;
							}
						}

					}
				}
			}
		}

		for(var k = 0 ; k < dList.length ; k ++) {
			var dItem = dList[k];
			if(dItem.mark == null) {
				_hLog("not found A=" + dItem.expapr_title);
			}
		}

		return mList;
	};
	
		// 데이터 정렬
		var _sortDatsOnlyStep1 = function (mList, dList) {
			for(var k = 0; k < dList.length; k++) {
				var dItem = dList[k];
				var isFind = false;
				for(var i = 0; i < mList.length; i++) {
					var mItem = mList[i];
					mList[i].subList = [];
					var mtitle_v = mItem.rootpart_name.replace(/ /g, "");
					var dtitle_v = dItem.expapr_title.replace(/ /g, "");

					var sStr = mtitle_v;
					if(dtitle_v.indexOf(sStr) > 0) {
						if(mList[i]["items"] == null) mList[i]["items"] = [];
						isFind = true;
						dItem.mark = 1;
						dList[k] = dItem;
						mList[i]["items"].push(dItem);
						break;
					}
					else if(dtitle_v.replace(".", "").indexOf(sStr) > 0) {
						if(mList[i]["items"] == null) mList[i]["items"] = [];
						isFind = true;
						dItem.mark = 1;
						dList[k] = dItem;
						mList[i]["items"].push(dItem);
						break;
					}
				}
				if(isFind == false) {
					var title_v = dItem.expapr_title;
					var title_a = title_v.split("]");
					_hLog("title_a=" + JSON.stringify(title_a));
					if(title_a.length >= 2) {
						var stitle_v = title_a[1].trim();
						var stitle_a = stitle_v.split(".");
						_hLog("stitle_a=" + JSON.stringify(stitle_a));
						if(stitle_a.length > 1) {
							var num_v = stitle_a[0].trim();
							var num_a = num_v.split("-");
							var rootpart_code_v = num_a[0];
							var subpart_code_v = num_a[1];

							for(var i = 0; i < mList.length; i++) {
								var mItem = mList[i];
								if(mItem.rootpart_code == rootpart_code_v) {
									if(mList[i]["items"] == null) mList[i]["items"] = [];
									dItem.mark = 1;
									dList[k] = dItem;
									mList[i]["items"].push(dItem);
									break;
								}
							}

						}
					}
				}
			}
			for(var k = 0 ; k < dList.length ; k ++) {
				var dItem = dList[k];
				if(dItem.mark == null) {
					_hLog("not found B=" + dItem.expapr_title);
				}
			}
			return mList;
		};


		// 수학 유형별 : M
		// 수학 계산력 : B1
		// 국어 작품별
		// 국어 문법 연습 : 문법연습 = O7, 실전문제 = O4
		var _loadData_1 = function() {
			var f_1 = root.querySelector("#filter_1");
			var site_v = _site_id;
			var grade_v = popGradeItems[selectedInfo.gradeIndex].Value;
			var group_v = popGroupItems[selectedInfo.groupIndex].Value;
			var subject_v = popSubjectItems[selectedInfo.subjectIndex].Value;
			var subjectName_v = popSubjectItems[selectedInfo.subjectIndex].Name;
			var year_v =popYearItems[selectedInfo.yearIndex].Value;
			var coreType_v = popGroupItems[selectedInfo.groupIndex].CoreType;
			var tx_v = popTxItems[selectedInfo.txIndex].Value;
			var term_v = termItems[selectedInfo.termIndex].Value;
			var keyword_v = encodeURIComponent(f_1.querySelector("[name='qry']").value).trim();
			var oldData_v = (isOldData ? "Y" : "N" );
			if(coreType_v == null) coreType_v = "";
			var cutCoreType_v = coreType_v.substring(0,1);
			var isMathCalc = false;
			let urlParams = new URLSearchParams(window.location.search);
			let oldRootPartCode = urlParams.get('rootpart_code');

			var url_v = "/_api/search.api.asp";
			var data_v = "cmd=CSEARCH";
			if(group_v == "H") {
				if(cutCoreType_v == "F") {
					// 적중 모의고사
					if(tx_v == ""){
						for(var tx_i = 1; tx_i < popTxItems.length; tx_i++) {
							if(tx_v != "") tx_v = tx_v + "|";
							tx_v = tx_v + popTxItems[tx_i].Value;
						}
					}
				}
			} else if (group_v == "M") {
				// 서술형 문제
			} /*else if (group_v == "C") {
				// 단원별 문제
				url_v = "/ZocboMid/ZocboExam/Exam_Unit_test.asp";
				if(subject_v == "TH") {
					// 기술가정
					data_v = "OldData=N";
				} else {
					data_v = "OldData=" + oldData_v;
				}
				data_v = data_v + "&Subj_Name=" + encodeURIComponent(subjectName_v);
				if(oldData_v == "Y") {
					PageSize = 20;
				} else {
					PageSize = 1000;
				}
			} */else if (group_v == "S") {
				if(subject_v == "EG" && cutCoreType_v == "G"){
					// 중등 영문법
					PageSize = 1000;
				} else {
					// 고난도 문제
					PageSize = 20;
				}
			} else if (group_v == "K") {
				if(subject_v == "KR") {
					if(cutCoreType_v == "P") {
						// 국어 작품별 문제
						coreType_v = tx_v;
						tx_v = "";
						PageSize = 20;
					} else if (cutCoreType_v == "O") {
						// 국어 문법 연습
						coreType_v = tx_v;
						tx_v = "";
						PageSize = 20;
					}
				} else if (subject_v == "MT") {
					if(cutCoreType_v == "M") {
						// 수학 유형별 문제
					} else if (cutCoreType_v == "B") {
						// 수학 계산력 문제
					}
					else if(cutCoreType_v == "F")
					{
						tx_v = M_MT_Math[selectedInfo.gradeIndex].bookinfo[selectedInfo.txIndex].textbook;
					}
				}
			}

			if (selectedInfo.menuIndex == 3 && param.oldData == "Y") {
				if (tx_v == "MAMTCHA1001") {
					tx_v = "M6MTCHA1001";
				} else if (tx_v == "MASCCHA1001") {
					tx_v = "M7SCCHA1001";
				}
			}

			if (selectedInfo.menuIndex == 4 && param.oldData == "Y") {
				if (tx_v == "MALSCHA0001") {
					if (oldRootPartCode == 101) {
						tx_v = "M9LSCHA0002";
					} else {
						tx_v = "M9LSCHA0001";
					}
				}
			}

			if ((group_v == "C" || group_v == "M" || ( group_v == "H" && (cutCoreType_v == "D" || cutCoreType_v == "E")) || group_v == "S" || (group_v == "K" && cutCoreType_v == "M") || (group_v == "H" && cutCoreType_v == "T") || (group_v == "K" && cutCoreType_v == "F"))) {
				// 단원별 문제, 서술형, 최다빈출, 최다오답, 고난도문제, 수학유형별, 수학교과서변형
				url_v = "/ZocboMid/ZocboExam/Exam_Unit_test.asp";
				if(subject_v == "TH") {
					// 기술가정
					data_v = "OldData=N";
				} else {
					data_v = "OldData=" + oldData_v;
				}
				data_v = data_v + "&Subj_Name=" + encodeURIComponent(subjectName_v);
				if(oldData_v == "Y") {
					if (oldRootPartCode != "" && oldRootPartCode != null) {
						data_v = data_v + "&rootpart_code=" + oldRootPartCode;
					}
					PageSize = 20;
				} else {
					PageSize = 1000;
				}
			}

			if(group_v == "S" && coreType_v == "G" && subject_v == "EG") {
				// 영어 중등 영문법
				url_v = "/ZocboMid/ZocboExam/Exam_MidEngGrammar_test0.asp";
				data_v = "flag=" + year_v;
				PageSize = 1000;
			} else {
				data_v = data_v + "&qry=" + keyword_v;
				data_v = data_v + "&ExPapr_TestYear=" + year_v;
				data_v = data_v + "&ExPapr_MidEndTerm=" + term_v;
				data_v = data_v + "&TX_CODE=" + encodeURIComponent(tx_v);
			}

			if(group_v == "C") {
				// 단원별 문제
			}
			else if(group_v == "M") {
				// 서술형 문제
				//PageSize = 20;
			}
			else if(group_v == "H") {
				// 개념완성
				if(coreType_v == "D") {
					// 최다 빈출
					//PageSize = 20;
				}
				else if(coreType_v == "E") {
					// 최다 오답
					//PageSize = 20;
				}
				else if(coreType_v == "F") {
					// 적중 모의고사
					PageSize = 20;
				}
				else if (coreType_v == "T") {
					// 영어 문법 문제
					//PageSize = 20;
				}
			}
			else {
				_hLog("data_v =" + data_v + ", coretype_v = " + coreType_v);
			}

			data_v = data_v + "&Grade=" + grade_v;
			data_v = data_v + "&Group=" + group_v;
			data_v = data_v + "&Subj_Code=" + subject_v;
			data_v = data_v + "&ExPapr_CoreType=" + coreType_v;
			data_v = data_v + "&Page=" + Page;

			//if(selectedInfo.groupIndex == 0) {	//  개념완성 -> 대단원 조회부터.
			if(parseInt(popGroupItems[selectedInfo.groupIndex].Index) == 0) {	//  개념완성 -> 대단원 조회부터.
				data_v = data_v + "&PageSize=1000";
			}
			else {
				data_v = data_v + "&PageSize=" + PageSize;
			}

			// 중등 수학계산력 예외처리
			if(group_v == "K" && cutCoreType_v == "B" && subject_v == "MT") {
				url_v = "/ZocboMid/ZocboExam/Exam_MathCalculation_test0.asp";
				data_v = "Group=" + group_v + "&ExPapr_CoreType=" + tx_v;
				isMathCalc = true;
				data_v = data_v + "&PageSize=1000";
			}

			var row_A = root.querySelector("#row_A");
			var row_B = root.querySelector("#row_B");
			var lt_o = row_B.querySelector(".listTop");

			//if(group_v == "C") {
			if ((group_v == "C" || group_v == "M" || ( group_v == "H" && (cutCoreType_v == "D" || cutCoreType_v == "E")) || ( group_v == "S") || (group_v == "K" && cutCoreType_v == "M") || (group_v == "H" && cutCoreType_v == "T") || (group_v == "K" && cutCoreType_v == "F"))){
				oldData_o = root.querySelector("#oldData");
				if(oldData_o){
					if(subject_v == "MT" || subject_v == "SC" || subject_v == "HI") {
						oldData_o.style.display = "";
					} else {
						oldData_o.style.display = "none";
					}
				}

				if(isOldData) {
					// 이전자료
					row_A.style.display = "";
					row_B.style.display = "none";
					lt_o.style.display = "none";
				} else {
					// 최신자료
					row_A.style.display = "none";
					row_B.style.display = "";
					lt_o.style.display = "";
				}
			}

			// toggle 선택 시 대단원에 해당하는 서브 리스트 호출하기 위해 호출 주소 전역변수에 저장
			_url_v = url_v;
			_data_v = data_v;
			
			// 대단원에 따라 리스트를 불러오는 경우 필요한 초기값 확인
			var rootpart_code = ""; 

			if(group_v == "C") {
				// 단원별 문제(난이도 기본 셋팅_최상위 제외)
				if (p_add_diff == "0" || p_add_diff == "") {
					data_v = data_v + "&add_diff=1,2,3";
				} else {
					data_v = data_v + "&add_diff=" + p_add_diff;
				}
			}

			comm.send(url_v, data_v, "POST", function(json) {
				if(Page == 1) {
					if(group_v == "S" && subject_v == "EG" && coreType_v == "G") {
						items = json.list;
						totalCount = json.list.length;
						totalPage = Math.ceil(totalCount / PageSize);
					} else if (isMathCalc) {
						items = json.grade1.concat(json.grade2).concat(json.grade3);
					} else if ((group_v == "C"  || group_v == "M" || ( group_v == "H" && (cutCoreType_v == "D" || cutCoreType_v == "E")) || ( group_v == "S") || (group_v == "K" && cutCoreType_v == "M") || (group_v == "H" && cutCoreType_v == "T") || (group_v == "K" && cutCoreType_v == "F"))) {
						cateItems = json.cate;		// 카테고리 정보 별도 저장
						items = json.list;
						totalCount = json.RecordCount;

						if(isOldData){
							totalPage = Math.ceil(totalCount / PageSize);
						} else {
							totalPage = 1;
						}
						chapterItems = [{"Name" : "전체 대단원", "Value": ""}]
						for(var i=0; i<json.cate.length; i++) {
							var chapterItem = json.cate[i];
							var obj = {};
							rootpart_code = ((!isNaN(chapterItem.rootpart_term) && chapterItem.rootpart_term != "") ? (parseInt(chapterItem.rootpart_term) * 100) : 100) + parseInt(chapterItem.rootpart_code);

							var rc = chapterItem.rootpart_code;
							var rn = chapterItem.rootpart_name;
							var ri = chapterItem.rootpart_id;

							if (chapterItem.rootpart_name.indexOf("Special") > -1) {
								obj.Name = rn ;
							} else {
								obj.Name = rc + ". " + rn;
							}
							obj.Value = rc;
							// S : 대단원 선택 시 하위 리스트 불러오기 위한 필요값
							obj.parent_index = (i+1);
							obj.rootpart_code = rootpart_code;
							// E
							
							chapterItems.push(obj);
						}
					} else {
						items = json.Zocbo.data;
						totalCount = json.Zocbo.ResultCount;
						totalPage = json.Zocbo.PageCount;
					}

					$("#recordCount").html(util.toNumber(totalCount));

				} else {
					if(group_v == "S" && subject_v == "EG" && coreType_v == "G"){
						items = items.concat(json.list);
					} else if (isMathCalc) {
						items = json.grade1.concat(json.grade2).concat(json.grade3);
					} else if ((group_v == "C" || group_v == "M" || ( group_v == "H" && (cutCoreType_v == "D" || cutCoreType_v == "E")) || ( group_v == "S") || (group_v == "K" && cutCoreType_v == "M") || (group_v == "H" && cutCoreType_v == "T") || (group_v == "K" && cutCoreType_v == "F"))) {
						items = json.list;
						totalCount = json.RecordCount;
						if(isOldData){
							totalPage = Math.ceil(totalCount / PageSize);
						} else {
							totalPage = 1;
						}
						chapterItems = [{"Name" : "전체 대단원", "Value": ""}]

						for(var i=0; i<json.cate.length; i++) {
							var chapterItem = json.cate[i];
							var obj = {};

							var rc = chapterItem.rootpart_code;
							var rn = chapterItem.rootpart_name;
							var ri = chapterItem.rootpart_id;

							if(chapterItem.rootpart_name.indexOf("Special") > -1) {
								obj.Name = rn ;
							} else {
								obj.Name = rc + ". " + rn;
							}
							obj.Value = rc;
							
							chapterItems.push(obj);
						}
					} else {
						items = items.concat(json.Zocbo.data);
					}
				}

				if(isMathCalc) {
					var obj = root.querySelector("[data-act='filter_chapter']");
					obj.innerHTML = "전체 중단원";
					chapterItems = [{"Name": "전체 중단원", "Value": ""}];
					for(var i=0; i<items.length; i++) {
						var sItem = items[i];

						var obj = {};
						obj.Name = sItem.cate_name;
						obj.Value = sItem.root_id;
						chapterItems.push(obj);

					}
				}

				var exPaprNoList = "";

				//if(selectedInfo.groupIndex == 0) {	//  개념완성 -> 대단원 조회부터.
				if(parseInt(popGroupItems[selectedInfo.groupIndex].Index) == 0) {	//  개념완성 -> 대단원 조회부터.
					mainList = _sortData(mainList, json.Zocbo.data);
					_drawList(mainList)
				} else if(group_v == "S" && subject_v == "EG" && coreType_v == "G") {
					// 중등 영문법
					row_A.style.display = "none";
					row_B.style.display = "";
					activeRow = row_B;

					chapterItems = [{Name: "전체 대단원", Value: ""}].concat(json.cate);

					grammerSelector.init(json.list, year_v, selectedInfo.termIndex, row_B, _site_id);

					return;
				}
				else if (group_v == "K" && subject_v == "MT" && coreType_v.substring(0,1) == "B") {
					// 수학 계산력 문제
					row_A.style.display = "none";
					row_B.style.display = "";
					activeRow = row_B;

					var recordCount = 0;
					var exNoArr = [];
					for(var i=0; i<items.length; i++) {
						var sItem = items[i];
						recordCount += sItem.items.length;
						for(var j=0; j<sItem.items.length; j++) {
							var s2Item = sItem.items[j];
							exNoArr.push(s2Item.exPapr_no);
						}
					}

					exPaprNoList = exNoArr.join(",");
					totalCount = recordCount;

					_drawList(items);

				} else if ((group_v == "C" || group_v == "M" || ( group_v == "H" && (cutCoreType_v == "D" || cutCoreType_v == "E")) || ( group_v == "S") || (group_v == "K" && cutCoreType_v == "M") || (group_v == "H" && cutCoreType_v == "T") || (group_v == "K" && cutCoreType_v == "F"))) {
					// 단원별 문제
					row_A.style.display = "none";
					row_B.style.display = "";
					activeRow = row_B;

					if(isOldData) {
						row_A.style.display = "";
						row_B.style.display = "none";
						activeRow = row_A;
					}

					var exNoArr = [];
					for(var i=0; i<items.length; i++) {
						var sItem = items[i];

						if(isOldData == false) {
							for(var j=0; j<sItem.items.length; j++) {
								var s2Item = sItem.items[j];
								exNoArr.push(s2Item.exPapr_no);
							}
						} else {
							exNoArr.push(sItem.exPapr_no);
						}
					}

					exPaprNoList = exNoArr.join(",");
					//_drawList(items);
					_drawList_v2(cateItems, items);		// 변형 (첫번째 대단원리스트만 기본 호출되게)
				} else {
					_drawList(json.Zocbo.data);
				}
				
				_initEvent();

				if (oldRootPartCode != "" && oldRootPartCode != null && selectedInfo.menuIndex == 3) {
					const targetButton = $(`.toggle[data-rootpart_code="${oldRootPartCode}"]`);

					if (targetButton.length > 0) {
						let parentIndex = targetButton.closest('[data-index]').data('index');
						
						_drawToggleItem(parentIndex, oldRootPartCode, "bbsNumber");

						$('html, body').animate({
							scrollTop: $(`.toggle[data-rootpart_code="${oldRootPartCode}"`).offset().top - 75
						}, 1000);
					}
				}
				
				comm.toggleLoading(false);
				if(json.Zocbo) {
					_drawDownCount(json.Zocbo.exPaprNoList);
				} else {
					_drawDownCount(exPaprNoList);
				}
			});

			// 단원별 등 신형 리스트 일 경우 전체 리스트 카운팅을 구하기 위해
			// 전체 검색일 경우만 태우면 되는데??
			/*
			if (isNewLoading) {
				// 토탈 카운트만 체크하기 때문에 PageSize=1로 강제 치환 (속도 문제)
				comm.send(url_v, data_v.replace(/PageSize=([0-9]*)/, "PageSize=1") + "&flagRecord=Y", "POST", function(json) {
					console.log("json : ", json);
					var num_o = root.querySelector("#row_B").querySelector(".bbsNumber b");
					if (num_o) {
						if (typeof(json.RecordCount) != "undefined") {
							num_o.innerHTML = util.toNumber(json.RecordCount);
						}
					}
				});
			}
			*/
	};

	// 강남3구 기출 목록 가져오기
	var _loadK3Data = function(){
		var f_2 = root.querySelector("#filter_2");
		var site_v = _site_id;
		var flag_v = popGrade2Items[selectedInfo.gradeK3Index].flag;
		var qry_v = encodeURIComponent(f_2.querySelector("[name='qry']").value);
		var grade_v = popGrade2Items[selectedInfo.gradeK3Index].value;

		var exGroup_v = "K";
		var coreType_v = "D";
		var subject_v = popSubjectItems[selectedInfo.subject2Index].Value // KR
		var txcode_v =  pubItems[selectedInfo.pub2Index].TX_CODE; // txcode

		var url_v = "/_api/search.api.asp";
		var data_v = "cmd=ZCSEARCH&site_id="+site_v+"&ExPapr_Group="+exGroup_v+"&ExPapr_CoreType="+coreType_v;

		data_v = data_v + "&flag=M" + flag_v;
		data_v = data_v + "&Grade=" + grade_v;
		data_v = data_v + "&Subj_Code="+subject_v;
		data_v = data_v + "&TX_CODE="+txcode_v;
		data_v = data_v + "&Page=" + Page + "&PageSize=" + PageSize;

		var viewSelect_o = root.querySelector(".new-tab-freereading");
		viewSelect_o.style.display = "none";

		var search_o = root.querySelector("#qry").parentNode;
		search_o.style.display = "none";

		comm.send(url_v, data_v, "POST", function(json) {

			if(Page == 1) {
				items = json.Zocbo.data;

				totalCount = json.Zocbo.ResultCount;
				totalPage = Math.ceil(totalCount / PageSize);

				$("#recordCount").html(util.toNumber(totalCount));
			} else {
				items = items.concat(json.Zocbo.data);
			}

			if(items.length == 0) {
				_drawNoList();
				comm.toggleLoading(false);
				return;
			}

			_drawList(json.Zocbo.data);
			_drawDownCount(json.Zocbo.exPaprNoList);
			_initEvent();
			comm.toggleLoading(false);
		});
	};

	// 강남 3구 기출 목록 그리기
	var _drawK3Data = function(item, index_p){
		$(".tabLine-round_M li").removeClass("active");
		$(".tabLine-round_M li").eq(5).addClass("active");

		var scroll_subject = $j(".tabLine-round_M li.active").offset().left;
			
		if(scroll_subject > 300) {
			$j(".tabLine-round_M").animate({scrollLeft : scroll_subject - 200}, 0);
		}

		item = util.keysToLowerCase(item);

		var ul_o = root.querySelector("#list_A");

		item.hwp2002 = "NONE";

		var formatInfo = "";
        // 2:pdf, 3:scan, 4:hwp, 5:zip
        if(item.hwp2002 != "NONE") formatInfo = "4";
        if(item.pdf && item.pdf != "NONE") {
        	if(formatInfo != "") formatInfo = formatInfo + ",";
        	formatInfo = formatInfo + "2";
        }
        if(item.scan && item.scan != "NONE") {
        	if(formatInfo != "") formatInfo = formatInfo + ",";
        	formatInfo = formatInfo + "3";
        }
        if(item.zip && item.zip != "NONE") {
        	if(formatInfo != "") formatInfo = formatInfo + ",";
        	formatInfo = formatInfo + "5";
        }

        var li_o = document.createElement("li");
        li_o.setAttribute("data-no", item.expapr_no);
        li_o.setAttribute("data-siteid", item.siteid);
        li_o.setAttribute("data-no", item.expapr_no);
        li_o.setAttribute("data-group", item.expapr_group);
        li_o.setAttribute("data-grade", item.grade);
        li_o.setAttribute("data-subjcode", item.subj_code);
        li_o.setAttribute("data-coretype", item.expapr_coretype);
        li_o.setAttribute("data-tx", item.tx_code);
        li_o.setAttribute("data-year", item.expapr_testyear);
        li_o.setAttribute("data-formats", formatInfo);
        li_o.setAttribute("data-title", item.add_title);
        //li_o.setAttribute("data-title", item.expapr_title);
        ul_o.appendChild(li_o);

        {
        	var p_o = document.createElement("p");
        	p_o.className = "tag";
        	//p_o.innerHTML = "<span>" + _getTermName(item.expapr_term, item.expapr_midend) + "</span>";
			if(item.add_attr1.substr(0, 4) > 2022)
			{
				item.add_attr1 = new Date().getFullYear()+ "년 대비";
			}
			p_o.innerHTML = "<span>" + item.add_attr1 + "</span>";
			p_o.innerHTML = p_o.innerHTML + "<span>" + item.add_attr2 + "</span>";
        	li_o.appendChild(p_o);
        }
        {
        	var p_o = document.createElement("p");
        	p_o.className = "title";
        	var title_v = item.add_title;
        	p_o.innerHTML = "<span>"+title_v+"</span>";
        	//p_o.innerHTML = "<span>"+title_v+"</span>";
        	li_o.appendChild(p_o);
        }
        {
        	var p_o = document.createElement("p");
        	p_o.className = "hash";
        	var key_v = null;
        	key_v = _site_id + item.grade;

        	var hash1 = "#" + _categorySub[key_v].title;
        	var hash2 = "#" + item.subj_name;
        	var hash3 = "#" + item.pub_name;

        	p_o.innerHTML = "<span>"+hash1+"</span><span>"+hash2+"</span><span>"+hash3 + "</span>";

        	li_o.appendChild(p_o);
        }
        {
        	var p_o = document.createElement("p");
        	p_o.className = "downLink";
        	p_o.innerHTML = '<a href="#" data-src="main" data-act="item_down"><em>다운로드</em><em>닫기</em><span class="down">'
						+ '<svg xmlns="http://www.w3.org/2000/svg" width="9" height="7" viewBox="0 0 9 7"><path id="triangle" data-name="triangle" d="M3.659,1.308a1,1,0,0,1,1.682,0L8.01,5.459A1,1,0,0,1,7.168,7H1.832A1,1,0,0,1,.99,5.459Z"/></svg>'
						+'</span></a>';
        	li_o.appendChild(p_o);
        }
        {
        	var p_o = document.createElement("p");
        	p_o.className = "listMenu";
        	{
        		var button_o = document.createElement("button");
        		button_o.type = "button";
        		button_o.setAttribute("data-src", "main");
        		button_o.setAttribute("data-act", "errorPopup");
        		{
        			var img_o = document.createElement("img");
        			img_o.src = "/img/ico_menu.png";
        			img_o.setAttribute("width", "34");
        			button_o.appendChild(img_o);
        		}
        		p_o.appendChild(button_o);
        	}
        	li_o.appendChild(p_o);
        }
    };

	// 학교별 족보 > 최빈, 최오 경우만 사용
	var _loadData_2_H = function() {
		var f_2 = root.querySelector("#filter_2");
		var site_v = _site_id;
		var qry_v = encodeURIComponent(f_2.querySelector("[name='qry']").value);
		var group_v = pop2TypeItems[selectedInfo.type2Index].value;
		var coreType_v = pop2TypeItems[selectedInfo.type2Index].CoreType;

		var scl_id_v = sch2Items[selectedInfo.sch2Index].Scl_ID;
		var grade_v = popGrade2Items[selectedInfo.grade2Index].value;
		var subject_v = popSubjectItems[selectedInfo.subject2Index].Value;
		var subjectName_v = encodeURIComponent(popSubjectItems[selectedInfo.subject2Index].Name);
		var term_v = _term[selectedInfo.term2Index].Value;
		var exfl_group_v = fileType2Items[selectedInfo.fileType2Index].Value;

		var Rg_CitiesProvinces_v = encodeURIComponent(_SI_LIST[selectedInfo.si2Index].Name.trim());	// 지역
		var Rg_District_v = encodeURIComponent(gu2Items[selectedInfo.gu2Index].Name.trim());		// 구/군
		var oldData_v = (isOldData ? "Y" : "N" );
		var year_v = popYearItems[selectedInfo.year2Index].Value;
		var txcode_v = "";

		if(pubItems.length>0) {
			txcode_v = pubItems[selectedInfo.pub2Index].Value;
		}

		url_v = "/ZocboMid/ZocboExam/Exam_Unit_test.asp";
		if(subject_v == "TH") {
			// 기술가정
			data_v = "OldData=N";
		} else {
			data_v = "OldData=" + oldData_v;
		}
		data_v = data_v + "&Subj_Name=" + encodeURIComponent(subjectName_v);
		if(oldData_v == "Y") {
			PageSize = 20;
		} else {
			PageSize = 1000;
		}

		data_v = data_v + "&Grade=" + grade_v;
		data_v = data_v + "&Group=" + group_v;
		data_v = data_v + "&Subj_Code=" + subject_v;
		data_v = data_v + "&ExPapr_CoreType=" + coreType_v;
		data_v = data_v + "&Page=" + Page;
		data_v = data_v + "&PageSize=" + PageSize;
		// 요기 추가
		data_v = data_v + "&qry=" + qry_v;
		data_v = data_v + "&ExPapr_TestYear=" + year_v;
		data_v = data_v + "&ExPapr_MidEndTerm=" + term_v;
		data_v = data_v + "&TX_CODE=" + encodeURIComponent(txcode_v);

		var row_A = root.querySelector("#row_A");
		var row_B = root.querySelector("#row_B");
		var lt_o = row_B.querySelector(".listTop");

		oldData_o = root.querySelector("#oldData");
		if(oldData_o){
			// 수학, 과학, 역사인 경우는 이전 개정자료 보기 버튼 표시
			if(subject_v == "MT" || subject_v == "SC" || subject_v == "HI") {
				oldData_o.style.display = "";
			} else {
				oldData_o.style.display = "none";
			}
		}

		if(isOldData) {
			// 이전자료
			row_A.style.display = "";
			row_B.style.display = "none";
			lt_o.style.display = "none";
		} else {
			// 최신자료
			row_A.style.display = "none";
			row_B.style.display = "";
			lt_o.style.display = "";
		}

		_url_v = url_v;
		_data_v = data_v;

		// 대단원에 따라 리스트를 불러오는 경우 필요한 초기값 확인
		var rootpart_code = "";

		comm.send(url_v, data_v, "POST", function(json) {
			if(Page == 1) {
				//if (group_v == "H" && (cutCoreType_v == "D" || cutCoreType_v == "E")) {
				if (group_v == "H") {
					cateItems = json.cate;		// 카테고리 정보 별도 저장
					items = json.list;
					totalCount = json.RecordCount;

					if(isOldData){
						totalPage = Math.ceil(totalCount / PageSize);
					} else {
						totalPage = 1;
					}
					chapterItems = [{"Name" : "전체 대단원", "Value": ""}]
					for(var i=0; i<json.cate.length; i++) {
						var chapterItem = json.cate[i];
						var obj = {};
						rootpart_code = ((!isNaN(chapterItem.rootpart_term) && chapterItem.rootpart_term != "") ? (parseInt(chapterItem.rootpart_term) * 100) : 100) + parseInt(chapterItem.rootpart_code);

						var rc = chapterItem.rootpart_code;
						var rn = chapterItem.rootpart_name;
						var ri = chapterItem.rootpart_id;

						if (chapterItem.rootpart_name.indexOf("Special") > -1) {
							obj.Name = rn ;
						} else {
							obj.Name = rc + ". " + rn;
						}
						obj.Value = rc;
						// S : 대단원 선택 시 하위 리스트 불러오기 위한 필요값
						obj.parent_index = (i+1);
						obj.rootpart_code = rootpart_code;
						// E
						chapterItems.push(obj);
					}
				}

				$("#recordCount").html(util.toNumber(totalCount));
			} else {
				if (group_v == "H") {
					items = json.list;
					totalCount = json.RecordCount;
					if(isOldData){
						totalPage = Math.ceil(totalCount / PageSize);
					} else {
						totalPage = 1;
					}
					chapterItems = [{"Name" : "전체 대단원", "Value": ""}]

					for(var i=0; i<json.cate.length; i++) {
						var chapterItem = json.cate[i];
						var obj = {};

						var rc = chapterItem.rootpart_code;
						var rn = chapterItem.rootpart_name;
						var ri = chapterItem.rootpart_id;

						if(chapterItem.rootpart_name.indexOf("Special") > -1) {
							obj.Name = rn ;
						} else {
							obj.Name = rc + ". " + rn;
						}
						obj.Value = rc;
						chapterItems.push(obj);
					}
				}
			}

			var exPaprNoList = "";

			//if(selectedInfo.groupIndex == 0) {	//  개념완성 -> 대단원 조회부터.
			if (group_v == "H") {
				// 단원별 문제
				row_A.style.display = "none";
				row_B.style.display = "";
				activeRow = row_B;

				if(isOldData) {
					row_A.style.display = "";
					row_B.style.display = "none";
					activeRow = row_A;
				}

				var exNoArr = [];
				for(var i=0; i<items.length; i++) {
					var sItem = items[i];

					if(isOldData == false) {
						for(var j=0; j<sItem.items.length; j++) {
							var s2Item = sItem.items[j];
							exNoArr.push(s2Item.exPapr_no);
						}
					} else {
						exNoArr.push(sItem.exPapr_no);
					}
				}

				exPaprNoList = exNoArr.join(",");

				_drawList_v2_H(cateItems, items);		// 학교별족보(최빈, 최오)는 내신완성 리스트 같이 사용
			}

			_initEvent();
			comm.toggleLoading(false);
			if(json.Zocbo) {
				_drawDownCount(json.Zocbo.exPaprNoList);
			} else {
				_drawDownCount(exPaprNoList);
			}
		});

	}

	// 학교별 족보 탭 데이터 가져오기
	var _loadData_2 = function() {
		/*
		if(selectedInfo.menuIndex == 1) {
			if(pop2TypeItems[selectedInfo.type2Index].Index == "7" && selectedInfo.term2Index > 1) {
				selectedInfo.term2Index = 0;
			}
		}
		*/

		var f_2 = root.querySelector("#filter_2");
		var site_v = _site_id;
		var qry_v = encodeURIComponent(f_2.querySelector("[name='qry']").value);
		var group_v = pop2TypeItems[selectedInfo.type2Index].value;
		var scl_id_v = sch2Items[selectedInfo.sch2Index].Scl_ID;
		var grade_v = popGrade2Items[selectedInfo.grade2Index].value;
		var subject_v = popSubjectItems[selectedInfo.subject2Index].Value;
		var subjectname_v = encodeURIComponent(popSubjectItems[selectedInfo.subject2Index].Name);
		//var term_v = _term[selectedInfo.term2Index].Value;
		var term_v = termItems[selectedInfo.term2Index].Value;		// 기출유사 랜딩 고도화 하면서 _term 에서 termItems로 변경
		var exfl_group_v = fileType2Items[selectedInfo.fileType2Index].Value;
		var Rg_CitiesProvinces_v = encodeURIComponent(_SI_LIST[selectedInfo.si2Index].Name.trim());	// 지역
		var Rg_District_v = encodeURIComponent(gu2Items[selectedInfo.gu2Index].Name.trim());		// 구/군
		var coreType_v = "";

		if(group_v == "V" || group_v == "W") {
			// 학교별 예상 족보, AI기출변형
			popYearItems = _getExceptYears();
		} else if(group_v == "A") {			
			if (parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 1) {	// 기출족보
				coreType_v = "A"
			}
		} else if(group_v != "A"){
			// 지역별, 강남3구
			popYearItems = [{Name: "전체 년도", Value: ""}].concat(getYears(_site_id, grade_v, group_v, "", subject_v));
		}

		var year_v = popYearItems[selectedInfo.year2Index].Value;
		var cmd = "";

		var viewSelect_o = root.querySelector(".new-tab-freereading");
		var view_a_o = viewSelect_o.querySelectorAll("li a");

		var txcode_v = "";
		var txname_v = "";
		// 지역, 최빈, 최오
		//if(selectedInfo.type2Index == 3) {
		if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 3 || parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 5 || parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 6) {
			if(pubItems.length>0) {
				txcode_v = pubItems[selectedInfo.pub2Index].Value;
			}
		}

		var url_v = "/_api/search.api.asp";
		var data_v = "cmd=SEARCH_ZOCBO" + "&site_id=" + site_v + "&Group=" + group_v;

		//if(scl_id_v && (parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 1 || parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 7)) {
		// 학교, 학년, 과목 선택 시만 탭 노출
		//if(scl_id_v && grade_v && subject_v && (parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 1 || parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 7)) {
		if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 7) 
		{
			//viewSelect_o.style.display = "";
			$(".nologin-view").show();
			//$(".new-tab-title").show();

			if(scl_id_v == "" || typeof scl_id_v == "undefined")
			{
				$(".listMnumb").hide();
			}
			else
			{
				$(".listMnumb").show();				
			}
		} else {
			viewSelect_o.style.display = "none";
		}

		var kind_v = "";
		if(viewSelect_o.style.display == "") {
			var kind_o = root.querySelector(".new-tab-freereading li.active a");
			if(kind_o) {
				// 우리학교, 동일출판사 학교
				kind_v = kind_o.getAttribute("data-value");
			}
		}

		if(subjectname_v == encodeURIComponent("전체 과목")) {
			subjectname_v = "";
		}
		if(Rg_CitiesProvinces_v == encodeURIComponent("지역")) {
			Rg_CitiesProvinces_v = "";
		}
		if(Rg_District_v == encodeURIComponent("구/군")) {
			Rg_District_v = "";
		}

		if( group_v != "I" ){
			data_v = data_v + "&Rg_CitiesProvinces=" + Rg_CitiesProvinces_v;
			data_v = data_v + "&Rg_District=" + Rg_District_v;
			data_v = data_v + "&Scl_ID=" + scl_id_v;
			data_v = data_v + "&Exfl_Group=" + exfl_group_v;
		}

		if(kind_v) {
			data_v = data_v + "&Kind=" + kind_v;
		}

		// 학교별 기출유사일 경우
		if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 7) {
			data_v = data_v + "&gichul=Y";
			/*
			if(grade_v != "3" && term_v == "2E") {
				term_v = "";
			} else {
				term_v = termItems[selectedInfo.term2Index].Value;
			}
			*/
		}

		data_v = data_v + "&Page="+Page+"&PageSize="+PageSize;
		data_v = data_v + "&ExPapr_CoreType=" + coreType_v + "&Grade=" + grade_v;
		data_v = data_v + "&ExPapr_TestYear=" + year_v;
		data_v = data_v + "&ExPapr_MidEndTerm=" + term_v;
		data_v = data_v + "&Subj_Code=" + subject_v;
		data_v = data_v + "&Subj_Name=" + subjectname_v;
		data_v = data_v + "&tx_code=" + txcode_v;
		data_v = data_v + "&qry=" + qry_v;

		comm.send(url_v, data_v, "POST", function(json) {
			var rItems = [];
			var exNoList = "";

			if(Page == 1) {
				if(group_v == "A" && scl_id_v && typeof(json.hits) != "undefined") {
					// Tab 카운트 표시
					$("#ACnt").text(json.ACnt);
					$("#BCnt").text(json.BCnt);
					$("#CCnt").text(json.CCnt);
					$("#DCnt").text(json.DCnt);

					var donga_show_member_yn = $("#donga_show_member_yn").val();

					if(donga_show_member_yn != "Y" && subject_v == "EG" && json.donga_yn == "Y") {
						for(var i=0; i<0; i++) {
							var rItem = json.hits.hits[i]._source;

							rItems.push(rItem);
						}
						items = rItems;
						totalCount = 0;
						totalPage = 0;
					} else {
						for(var i=0; i<json.hits.hits.length; i++) {
							var rItem = json.hits.hits[i]._source;

							rItems.push(rItem);
						}
						items = rItems;
						totalCount = json.hits.total.value;
						totalPage = Math.ceil(totalCount / PageSize);
					}
				} else {
					$(".new-tab-freereading").hide();
					items = json.Zocbo.data;
					totalCount = json.Zocbo.ResultCount;
					totalPage = json.Zocbo.PageCount;
				}
				$("#recordCount").html(util.toNumber(totalCount));

				if((group_v == "V" || group_v == "W") && util.toNumber(totalCount) > 0)
				{
					$("#div_Img").hide();
				}

				if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 7) {
					textinfo_Show(kind_v);
				}
			}
			else {

				if(group_v == "A" && scl_id_v && typeof(json.hits) != "undefined") {
					var nData = [];
					for(var i=0; i<json.hits.hits.length; i++) {
						var nItem = json.hits.hits[i]._source;
						nData.push(nItem);
					}
					items = rItems.concat(nData);
				} else {
					// 버그를 발견 했는데, 기출에서만 발생하는듯 하여 우선 기출로만 예외 처리
					if(group_v == "A") {
						items = json.Zocbo.data;
					} else {
						items = items.concat(json.Zocbo.data);						
					}
				}
			}

			if(items.length == 0) {
				_drawNoList();
			} else {
				if(scl_id_v && group_v == "A") {
					for (var i=0; i<items.length; i++) {
						exNoList += "," + items[i].exPapr_no;
					}
					_drawList(items);
				} else {
					if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 7 && scl_id_v == "") 
					{
						_drawNoList();
					}
					else
					{
						exNoList = json.Zocbo.exPaprNoList;
						_drawList(json.Zocbo.data);
					}					
				}
			}

			_initEvent();
			_drawDownCount(exNoList);
			comm.toggleLoading(false);
		});
	};

	var _loadData_2_V = function() {
		var f_2 = root.querySelector("#filter_2");
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
		var typeIndex = parseInt(pop2TypeItems[selectedInfo.type2Index].Index);

		if(typeIndex == 8)
		{
			var url_v = "/ZocboMid/ZocboExam/Exam_AI_Transform.asp";
		}
		else
		{
			var url_v = "/ZocboMid/ZocboExam/Exam_Default.asp";
		}
		
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

		comm.send(url_v, data_v, "POST", function(json) 
		{
			items = json;
			totalCount = json.RecordCount;

			if(search_Part_ID_Set == 'last_Search_Y')
			{
				document.getElementById("part_ID").value = json.search_Part_ID_Set;
				search_Part_ID_Set = document.getElementById("part_ID").value;
			}

			$("#recordCount").html(0);

			if(selectedInfo.si2Index == 0 || selectedInfo.gu2Index == 0 || selectedInfo.sch2Index == 0)
			{
				$("#filter2_Chapter").text("범위 선택");
				$("#recordCount").html(0);
				items = "";
			}
			else
			{
				if (search_Part_ID_Set != '')
				{
					$("#filter2_Chapter").text("범위 재선택");
					$("#div_Img").hide();
					$("#recordCount").html(util.toNumber(totalCount));
				}
				else
				{
					$("#filter2_Chapter").text("범위 선택");
					$("#div_Img").show();
					$("#recordCount").html(util.toNumber(0));
					items = "";
				}
			}

			if(items.length == 0)
			{
				_drawNoList();
			} 
			else 
			{
				_drawList_V(items);			
			}

			_initEvent();
			comm.toggleLoading(false);
		});
	};

	var _loadData_FreeReading = function() {
		var f_2 = root.querySelector("#filter_2");
		var site_v = _site_id;
		var group_v = "A";
		var scl_id_v = sch2Items[selectedInfo.sch2Index].Scl_ID;
		var grade_v = popGrade2Items[selectedInfo.grade2Index].value;
		var subject_v = popSubjectItems[selectedInfo.subject2Index].Value;
		var subjectname_v = encodeURIComponent(popSubjectItems[selectedInfo.subject2Index].Name);
		var term_v = _term[selectedInfo.term2Index].Value;
		var Rg_CitiesProvinces_v = encodeURIComponent(_SI_LIST[selectedInfo.si2Index].Name.trim());	// 지역
		var Rg_District_v = encodeURIComponent(gu2Items[selectedInfo.gu2Index].Name.trim());		// 구/군
		var coreType_v = "A";
		var vYear = popYearItems[selectedInfo.year2Index].Value;
		var exfl_group_v = "";
		var cmd = "";
		var txcode_v = "";
		var txname_v = "";
		var url_v = "/_api/search.api.asp";
		var data_v = "cmd=SEARCH_ZOCBO" + "&site_id=" + site_v + "&Group=A";
		var kind_v = "A";

		var viewSelect_o = root.querySelector(".new-tab-freereading");
		viewSelect_o.style.display = "none";

		if(subjectname_v == encodeURIComponent("전체 과목")) {
			subjectname_v = "";
		}

		if(Rg_CitiesProvinces_v == encodeURIComponent("지역")) {
			Rg_CitiesProvinces_v = "";
		}

		if(Rg_District_v == encodeURIComponent("구/군")) {
			Rg_District_v = "";
		}

		if(group_v == "A") {			
			if (parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 0) {	// 기출무료열람실
				coreType_v = "A|C|D"
			}
		}

		data_v = data_v + "&Rg_CitiesProvinces=" + Rg_CitiesProvinces_v;
		data_v = data_v + "&Rg_District=" + Rg_District_v;
		data_v = data_v + "&Scl_ID=" + scl_id_v;
		data_v = data_v + "&Exfl_Group=" + exfl_group_v;

		if(kind_v) {
			data_v = data_v + "&Kind=" + kind_v;
		}

		data_v = data_v + "&Page="+Page+"&PageSize="+PageSize;
		data_v = data_v + "&ExPapr_CoreType=" + coreType_v + "&Grade=" + grade_v;
		data_v = data_v + "&ExPapr_TestYear=" + vYear;
		data_v = data_v + "&ExPapr_MidEndTerm=" + term_v;
		data_v = data_v + "&Subj_Code=" + subject_v;
		//data_v = data_v + "&Subj_Name=" + subjectname_v;
		//data_v = data_v + "&tx_code=" + txcode_v;

		$("#div_Img").hide();

		comm.send(url_v, data_v, "POST", function(json) {
			var rItems = [];
			var exNoList = "";
			
			if(Page == 1) {
				if(group_v == "A" && scl_id_v && typeof(json.hits) != "undefined") {
					for(var i=0; i<json.hits.hits.length; i++) {
						var rItem = json.hits.hits[i]._source;

						rItems.push(rItem);
					}
					items = rItems;
					totalCount = json.hits.total.value;
					totalPage = Math.ceil(totalCount / PageSize);
				} else {
					items = json.Zocbo.data;
					totalCount = json.Zocbo.ResultCount;
					totalPage = json.Zocbo.PageCount;
				}
				$("#recordCount").html(util.toNumber(totalCount));
			}
			else {
				if(group_v == "A" && scl_id_v && typeof(json.hits) != "undefined") {
					var nData = [];
					for(var i=0; i<json.hits.hits.length; i++) {
						var nItem = json.hits.hits[i]._source;
						nData.push(nItem);
					}
					items = rItems.concat(nData);
				} else {
					// 버그를 발견 했는데, 기출에서만 발생하는듯 하여 우선 기출로만 예외 처리
					if(group_v == "A") {
						items = json.Zocbo.data;
					} else {
						items = items.concat(json.Zocbo.data);
					}
				}
			}			

			if(items.length == 0) {
				_drawNoList("FreeReading");
			} else {
				if(scl_id_v && group_v == "A") {
					for (var i=0; i<items.length; i++) {
						exNoList += "," + items[i].exPapr_no;
					}
					_drawList(items);
				} else {
					exNoList = json.Zocbo.exPaprNoList;

					if(Rg_CitiesProvinces_v == "" || Rg_District_v == "" || scl_id_v == "")
					{
						_drawList("");
					}
					else
					{
						_drawList(json.Zocbo.data);
					}
				}
			}

			_initEvent();
			_drawDownCount(exNoList);
			comm.toggleLoading(false);
		});
	};

	// 다운로드수 그리기
	var _drawDownCount = function(exPaprNoList){
		return;		// 다운로드수 체크 X

		if(exPaprNoList.startsWith(',')) {
			exPaprNoList = exPaprNoList.substring(1, exPaprNoList.length);
		}

		var url_c = "/_api/search.api.asp";
		var data_c = "cmd=GET_PAPER_DOWNCNT&ExPapr_No=" + exPaprNoList;
		comm.send(url_c, data_c, "post", function(json) {

			if(json){
				var list = json.list;

				for( var i=0; i<list.length; i++) {
					var item = list[i];

					var count = item.downCount;
					if(count >= 10000) {
						count = "9999+";
					} else {
						count = util.toNumber(count);
					}

					var hash_p = root.querySelector("#list_A [data-no='"+item.ExPapr_No+"'] .hash");
					if(hash_p) {
						hash_p.innerHTML = hash_p.innerHTML + "<span>#다운로드 "+count+"</span>";
					}

					var mtHash_p = root.querySelector("#row_B [data-no='"+item.ExPapr_No+"'] .hash");
					if(mtHash_p) {
						mtHash_p.innerHTML = mtHash_p.innerHTML + "<span>#다운로드 " + count + "</span>";
					}
				}
			}
		});
	};

	var _topic3List = null;
	var basicList = null;
    // 고득점 마스터 데이터 가져오기
    var _loadData_3 = function() {
    	var f_3 = root.querySelector("#filter_3");
    	var rootPart_ID =chapter3Items[selectedInfo.chapter3Index].Value;
    	var url_v = "/ZocboMid/Tweezers/View_test.asp";
    	var data_v = "cmd=GO_VIEW&rootPart_ID=" + rootPart_ID + "&site_id=" + _site_id;

    	comm.send(url_v, data_v, "POST", function(json) {
    		_topic3List = json.imgList;
    		basicList = json.basicList;
    		var rList = json.rList;
    		totalPage = 1;
    		popSub3Items = [];

    		if(imgBtn && _topic3List.length > 0) {
    			imgBtn.style.display = "";
    		} else {
    			imgBtn.style.display = "none";
    		}

			// 출제빈도 타이틀명 넣기
			for( var i=0; i<_topic3List.length; i++) {
				var topicItem = _topic3List[i];
				var obj = {};
				obj.title = topicItem.topic;
				obj.pos = i;
				popSub3Items.push(obj);
			}

			if(selectedInfo.sub3Index == 0) {
				items = basicList;
			}
			else {
				items = rList;
			}

			totalCount = 0;

			if(items.length > 0) {
				var row_A = root.querySelector("#row_A");
				var row_C = root.querySelector("#row_C");

				if(items[0].PDF) {
					row_A.style.display = "";
					row_C.style.display = "none";
				} else {
					row_A.style.display = "none";
					row_C.style.display = "";
				}

				var tl_o = row_C.querySelector(".titleLine");
				if(!$(tl_o).hasClass("active")) {
					$(tl_o).addClass("active");
				}

				var pb_o = row_C.querySelectorAll(".productBlock.row");
				$(pb_o).show();

				var lt_o = row_C.querySelectorAll(".listTitle");
				for(var i=0; i<lt_o.length; i++) {
					var lt = lt_o[i];

					if(!$(lt).hasClass("active")) {
						$(lt).addClass("active");
					}
				}

				for(var i=0; i<pb_o.length; i++) {
					var bbs_o = row_C.querySelectorAll(".bbsList");
					$(bbs_o).show();
				}

				$("#fold3").prop("checked", true);

				var displayCnt = 0;
				var vodLen = 0;
				for(var i=0; i<items.length; i++) {
					var subList = items[i].subList;
					if(subList == null) {
						subList = items[i].list;
					}

					if(subList){
						displayCnt += subList.length;
					}

					if(selectedInfo.sub3Index == 0) {
						_getVODLength(subList, vodLen);
					}
				}

				_hLog("totalCount =" + totalCount);
				_hLog("displatCnt =" + displayCnt);
				_hLog("vodLen = " + vodLen);

				totalCount = totalCount + displayCnt;



				_drawList(items);
			}
			else{
				_drawNoList();
			}
			comm.toggleLoading(false);
		});
    };

    var sortDataItems = [];

	// Pro 관련 (s)
    // 수학교과서변형 / 수학단계별학습관 / 국어문법
    var _drawList_P = function(dataItems) {
    	var ul_o = root.querySelector("#list_A");
		var redown_expapr_no = [];		// 재다운표시 (정효태, 2021.11.26)

    	if(ul_o) {
    		if(Page == 1) {
    			ul_o.innerHTML = "";
    		}
    		if(dataItems == null || dataItems.length == 0) {				
    			_drawNoList();
    			return;
    		}
    		sortDataItems = [];
    		if(Page == 1) {
    			ul_o.innerHTML = "";
    		}
    		if(dataItems.length <= 0) {
    			return;
    		}

    		var row_A = root.querySelector("#row_A");
    		var row_B = root.querySelector("#row_B");
    		var row_C = root.querySelector("#row_C");

			var group_v = popGroupItems[selectedInfo.groupIndex].Value;
			var subject_v = popSubjectItems[selectedInfo.subjectIndex].Value;
			var coreType_v = popGroupItems[selectedInfo.groupIndex].CoreType;

			if((group_v == "P" && coreType_v.substring(0,1) == "C") || (group_v == "P" && coreType_v.substring(0,1) == "B")) {
				// 수학교과서변형
				row_A.style.display = "none";
				row_B.style.display = "";
				activeRow = row_B;

				$(row_B).find(".bbsNumber b").html(totalCount);

				var objs = row_B.querySelectorAll(".block_list");
				for(var i = 0; i < objs.length; i++) {
					var obj = objs[i];
					if(obj.parentNode) {
						obj.parentNode.removeChild(obj);
					}
				}

				for(var i = 0; i < dataItems.length; i++) {
					var item = dataItems[i];
					_drawItem_0_P(item, PageSize * (Page - 1) + i);
				}

				for (var i=0; i<dataItems.length; i++) {
					if (typeof(dataItems[i].items) == "undefined") {
						for (var y=0 ; y<dataItems[i].subList.length ; y++) {
							for (var x=0 ; x<dataItems[i].subList[y].items.length ; x++) {
								redown_expapr_no.push(dataItems[i].subList[y].items[x].exPapr_no);
								//redown_expapr_no.push(util.keysToLowerCase(dataItems[i].subList[y].items[x]).expapr_no);
							}
						}
					} else {	// 영문법인 경우만 sublist > items 아니라 바로 items 나옴.
						for (var y=0 ; y<dataItems[i].items.length ; y++) {
							redown_expapr_no.push(dataItems[i].items[y].exPapr_no);
							//redown_expapr_no.push(util.keysToLowerCase(dataItems[i].items[y]).expapr_no);
						}
					}
				}
			} else if (group_v == "T") {
				$(row_B).find(".bbsNumber b").html(totalCount);

				row_A.style.display = "none";
				row_B.style.display = "";
				activeRow = row_B;

				$(row_B).find(".bbsNumber b").html(totalCount);

				for(var i = 0; i < dataItems.length; i++)
				{
					var item = dataItems[i];

					_drawItem_C(item, PageSize * (Page - 1) + i);
				}

				//_viewAll(activeRow);
			} else {
				// 국어문법
				row_A.style.display = "none";
				row_B.style.display = "";
				activeRow = row_B;

				var row_o = root.querySelector("#row_B");
				dropRoot = row_o;

				if (group_v == "P" && coreType_v.substring(0,1) == "A") {
					var objs = row_B.querySelectorAll(".block_list");
					for(var i=0; i< objs.length; i++) {
						var obj = objs[i];
						if(obj.parentNode){
							obj.parentNode.removeChild(obj);
						}
					}

					for(var i = 0; i < dataItems.length; i++) {
						var item = dataItems[i];

						for (j = 0;j < item.list_group.length; j++ ) {
							var obj_length = Object.keys(item.list_group[j]).length
							var obj_Arr = Object.keys(item.list_group[j])
							var sItem = item.list_group[j]

							for (k = 1;k < obj_length ;k++ ) {
								redown_expapr_no.push(sItem[obj_Arr[k]])
							}
						}
						_drawItem_KoreanGra(item);
					}

					$(row_B).find(".bbsNumber b").html(util.toNumber(redown_expapr_no.length));
				}
			}

			// 재다운 표시
			ui_updater.setUI();

			_initEvent();
		}
	};

	var _drawList_Preparation = function(dataItems) {
    	var ul_o = root.querySelector("#list_A");
		var redown_expapr_no = [];		// 재다운표시 (정효태, 2021.11.26)

    	if(ul_o) {
    		if(Page == 1) {
    			ul_o.innerHTML = "";
    		}

    		if(dataItems == null || dataItems.length == 0) {				
    			_drawNoList();
    			return;
    		}

    		sortDataItems = [];

    		if(Page == 1) {
    			ul_o.innerHTML = "";
    		}

    		if(dataItems.length <= 0) {
    			return;
    		}

    		var row_A = root.querySelector("#row_A");
    		var row_B = root.querySelector("#row_B");
    		var row_C = root.querySelector("#row_C");
			var group_v = popGroupItems[selectedInfo.groupIndex].Value;
			var subject_v = popSubjectItems[selectedInfo.subjectIndex].Value;
			var coreType_v = popGroupItems[selectedInfo.groupIndex].CoreType;

			row_A.style.display = "none";
			row_B.style.display = "";
			activeRow = row_B;

			$(row_B).find(".bbsNumber b").html(totalCount);

			var objs = row_B.querySelectorAll(".block_list");

			for(var i = 0; i < objs.length; i++) {
				var obj = objs[i];

				if(obj.parentNode) {
					obj.parentNode.removeChild(obj);
				}
			}

			for(var i = 0; i < dataItems.length; i++) {
				var item = dataItems[i];

				_drawItem_Preparation(item, PageSize * (Page - 1) + i);
			}

			for (var i=0; i<dataItems.length; i++) {	
				if (typeof(dataItems[i].items) == "undefined") {
					for (var y=0 ; y<dataItems[i].subList.length ; y++) {
						for (var x=0 ; x<dataItems[i].subList[y].items.length ; x++) {
							redown_expapr_no.push(dataItems[i].subList[y].items[x].exPapr_no);
						}
					}
				} else {	// 영문법인 경우만 sublist > items 아니라 바로 items 나옴.
					for (var y=0 ; y<dataItems[i].items.length ; y++) {
						if(dataItems[i].items[y].exPapr_CoreType != "C")
						{
							redown_expapr_no.push(dataItems[i].items[y].exPapr_no);
						}							
					}
				}
			}

			if(coreType_v != "C")
			{
				// 재다운 표시
				ui_updater.setUI();
			}			

			_initEvent();
		}
	};

	// Pro 관련 (e)
    // 리스트 그리기 (개념학습)
    var _drawList = function(dataItems) {
    	var ul_o = root.querySelector("#list_A");
		var redown_expapr_no = [];		// 재다운표시 (정효태, 2021.11.26)

    	if(ul_o) {
    		if(Page == 1) {
    			ul_o.innerHTML = "";
    		}
    		if(dataItems == null || dataItems.length == 0) {
				if(dataItems == null && selectedInfo.menuIndex == 1 && parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 0)
				{
					_drawNoList();
					return;
				}
				else
				{
					_drawNoList();
	    			return;
				}
    		}
    		sortDataItems = [];
    		if(Page == 1) {
    			ul_o.innerHTML = "";
    		}
    		if(dataItems.length <= 0) {
    			return;
    		}

    		if(selectedInfo.menuIndex == 2 && Page == 1) {
    			var row_o = root.querySelector("#row_C");
    			var parent_o = row_o.querySelector(".productBlock");
    			parent_o.innerHTML = "";
    			{
    				var count_o = row_o.querySelector(".listTop .row .bbsNumber b");

					if(count_o){
						count_o.innerHTML = util.toNumber(totalCount);
					}

    				var p_o = row_o.querySelector(".titleLine");
    				if(selectedInfo.sub3Index == 0) {
    					p_o.style.display = "";
    					p_o.innerHTML = chapter3Items[selectedInfo.chapter3Index].Name + '<button type="button" data-src="main" data-act="toggleAll" class="toggle">접기/펼치기</button></p>';
    				} else {
    					p_o.style.display = "none";
    					p_o.innerHTML = "";
    				}
    			}
    		}

    		var row_A = root.querySelector("#row_A");
    		var row_B = root.querySelector("#row_B");
    		var row_C = root.querySelector("#row_C");

    		if (selectedInfo.menuIndex == 0 || selectedInfo.menuIndex == 3 || selectedInfo.menuIndex == 4) {
    			var group_v = popGroupItems[selectedInfo.groupIndex].Value;
    			var subject_v = popSubjectItems[selectedInfo.subjectIndex].Value;
    			var coreType_v = popGroupItems[selectedInfo.groupIndex].CoreType;
    			var isMathCalc = false;
				var isConcept = false;		// 개념완성 여부 체크 (정효태, 2021.11.29)

    			if(group_v == "K" && subject_v == "MT" && coreType_v.substring(0,1) == "B") {
    				isMathCalc = true;
    			}

				//if(selectedInfo.groupIndex == 0 || isMathCalc || ((group_v == "C" || group_v == "M" || ( group_v == "H" && (coreType_v == "D" || coreType_v == "E")) || ( group_v == "S") || (group_v == "K" && coreType_v == "M") || (group_v == "H" && coreType_v == "T") || (group_v == "K" && coreType_v == "F")) && isOldData == false)) {	//  개념완성 -> 대단원 조회부터.
				if(parseInt(popGroupItems[selectedInfo.groupIndex].Index) == 0 || isMathCalc || ((group_v == "C" || group_v == "M" || ( group_v == "H" && (coreType_v == "D" || coreType_v == "E")) || ( group_v == "S") || (group_v == "K" && coreType_v == "M") || (group_v == "H" && coreType_v == "T") || (group_v == "K" && coreType_v == "F")) && isOldData == false)) {	//  개념완성 -> 대단원 조회부터.
					row_A.style.display = "none";
					row_B.style.display = "";
					activeRow = row_B;

					$(row_B).find(".bbsNumber b").html(totalCount);

					var objs = row_B.querySelectorAll(".block_list");
					for(var i = 0; i < objs.length; i++) {
						var obj = objs[i];
						if(obj.parentNode) {
							obj.parentNode.removeChild(obj);
						}
					}

					for(var i = 0; i < dataItems.length; i++) {
						var item = dataItems[i];
						if((group_v == "C" || group_v == "M" || ( group_v == "H" && (coreType_v == "D" || coreType_v == "E")) || ( group_v == "S") || (group_v == "K" && coreType_v == "M") || (group_v == "H" && coreType_v == "T") || (group_v == "K" && coreType_v == "F"))) {
							_drawItem_C(item, PageSize * (Page - 1) + i);
						} else {
							isConcept = true;
							_drawItem_0(item, PageSize * (Page - 1) + i);
						}

					}

					// 재다운 표시 (정효태, 2021.11.26)
					if (isMathCalc) {	// 수학 계산력일 경우는 리스트 양식이 다름
						for (var i=0; i<dataItems.length; i++) {
							for (var y=0 ; y<dataItems[i].items.length ; y++) {
								redown_expapr_no.push(dataItems[i].items[y].exPapr_no);
							}
						}
					}  else if (isConcept) {		// 개념완성일 경우 별도 체크 (고등개념완성의 경우 dataItems.exPaprNoList 값이랑 안맞아서 중등도 그냥 개별 체크 - 정효태, 2021.11.29)
						for (var i=0; i<dataItems.length; i++) {
							if (typeof(dataItems[i].items) == "undefined") {
								for (var y=0 ; y<dataItems[i].subList.length ; y++) {
									for (var x=0 ; x<dataItems[i].subList[y].items.length ; x++) {
										redown_expapr_no.push(dataItems[i].subList[y].items[x].exPapr_no);
										//redown_expapr_no.push(util.keysToLowerCase(dataItems[i].subList[y].items[x]).expapr_no);
									}
								}
							} else {	// 영문법인 경우만 sublist > items 아니라 바로 items 나옴.
								for (var y=0 ; y<dataItems[i].items.length ; y++) {
									redown_expapr_no.push(dataItems[i].items[y].exPapr_no);
									//redown_expapr_no.push(util.keysToLowerCase(dataItems[i].items[y]).expapr_no);
								}
							}
						}
					} else if (dataItems.exPaprNoList) {
						redown_expapr_no = dataItems.exPaprNoList;
					}
				}
				else {
					row_A.style.display = "";
					row_B.style.display = "none";
					activeRow = row_A;

					for(var i = 0; i < dataItems.length; i++) {
						var item = dataItems[i];

						redown_expapr_no.push(item.exPapr_no);		// 재다운표시 (정효태, 2021.11.26)
						_drawItem(item, PageSize * (Page - 1) + i);
					}
				}
			}
			else {
				row_A.style.display = "";
				row_B.style.display = "none";
				activeRow = row_A;
				for(var i = 0; i < dataItems.length; i++) {
					var item = dataItems[i];

					redown_expapr_no.push(item.exPapr_no);		// 재다운표시 (정효태, 2021.11.29)

					_drawItem(item, PageSize * (Page - 1) + i);
				}
			}
			// 재다운 표시
			ui_updater.setUI();

			_initEvent();
		}
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

    		var row_A = root.querySelector("#row_A");
    		var row_B = root.querySelector("#row_B");
    		
			row_A.style.display = "";
			row_B.style.display = "none";

			if(dataItems.RecordCount == 0 || typeof dataItems.RecordCount == 'undefined')
			{
				_drawNoList('W_NoData');
	    		return;
			}

			for(var i = 0; i < dataItems.RecordCount; i++) {
				_drawItem(dataItems, PageSize * (Page - 1) + i);
			}

			_initEvent();
		}
	};

	// Pro 관련 (s)
	// 갈래별문학 (중등 문학 공략)
	var _drawList_v2_P = function(cateItems, dataItems) {
    	var ul_o = root.querySelector("#list_A");
    	if(ul_o) {
    		if(Page == 1) {
    			ul_o.innerHTML = "";
    		}
    		if(dataItems == null || dataItems.length == 0) {
    			_drawNoList();
    			return;
    		}
    		sortDataItems = [];

    		var row_A = root.querySelector("#row_A");
    		var row_B = root.querySelector("#row_B");
    		var row_C = root.querySelector("#row_C");

			var group_v = popGroupItems[selectedInfo.groupIndex].Value;
			var subject_v = popSubjectItems[selectedInfo.subjectIndex].Value;
			var coreType_v = popGroupItems[selectedInfo.groupIndex].CoreType;

			var isMathCalc = false;

			if(group_v == "P" && coreType_v.substring(0,1) == "D") {	//  개념완성 -> 대단원 조회부터.
				row_A.style.display = "none";
				row_B.style.display = "";
				activeRow = row_B;

				$(row_B).find(".bbsNumber b").html(totalCount);

				var objs = row_B.querySelectorAll(".block_list");
				for(var i = 0; i < objs.length; i++) {
					var obj = objs[i];
					if(obj.parentNode) {
						obj.parentNode.removeChild(obj);
					}
				}

				var item = null;
				var cateItem = null;

				// 검색조건이 없을 경우 전체 대메뉴 표시 (학기검색, 키워드검색)
				if (group_v == "P" && coreType_v.substring(0,1) == "D") {
					//갈래별문학 (중등 문학 공략)
					//갈래분석 상단에 표기
					var parent = root.querySelector("#row_B");
					$(parent).find("#fold1").trigger("click");

					var div_o = document.createElement("div");
					div_o.className = "block_list";
					div_o.setAttribute("data-index", 0);
					parent.appendChild(div_o);

					var p_o = document.createElement("p");
					p_o.className = "titleLine active";
					p_o.innerHTML = "갈래분석";

					div_o.appendChild(p_o);

					var btn_o = document.createElement("button");
					btn_o.className = "toggle";
					btn_o.innerHTML = "접기/펼치기";
					btn_o.setAttribute("data-src", _id);
					btn_o.setAttribute("data-version", "v2");		// list type 확인 (기존 리스트와 구분 위해)
					btn_o.setAttribute("data-rootpart_code", 0);	// 대단원코드
					btn_o.setAttribute("data-parent-index", 0);	// 상위 data-index 확인 (draw한 이후기 떄문에 +1 없음)
					btn_o.setAttribute("data-act", "toggleAll");
					p_o.appendChild(btn_o);

					var row_o = document.createElement("div");
					row_o.className = "productBlock row";

					var ul_o = document.createElement("ul");
					ul_o.className = "bbsList fullTitle mB20";
					row_o.appendChild(ul_o);

					var formatInfo = "2";
					item = util.keysToLowerCase(dataItems.items[0]);

					var li_o = document.createElement("li");

					li_o.setAttribute("data-no", item.expapr_no);
					li_o.setAttribute("data-siteid", item.siteid);
					li_o.setAttribute("data-group", item.expapr_group);
					li_o.setAttribute("data-grade", item.grade);
					li_o.setAttribute("data-subjcode", item.subj_code);
					li_o.setAttribute("data-coretype", item.expapr_coretype);
					li_o.setAttribute("data-tx", item.tx_code);
					li_o.setAttribute("data-year", item.expapr_testyear);
					li_o.setAttribute("data-formats", formatInfo);
					li_o.setAttribute("data-title", item.expapr_title);
					li_o.setAttribute("data-textbook", item.textbook);
					ul_o.appendChild(li_o);

					var p_o = document.createElement("p");
					p_o.className = "tag";
					p_o.innerHTML = "<span>갈래분석";
					li_o.appendChild(p_o);

					var p_o = document.createElement("p");
					p_o = document.createElement("p");
					p_o.className = "title";
					p_o.innerHTML = "<span>" + item.expapr_title + "</span>";
					li_o.appendChild(p_o);

					{
						var p_o = document.createElement("p");
						p_o.className = "hash";
						var key_v = null;
						key_v = _site_id + item.grade;

						var hash1 = "#전학년";
						//var hash2 = "#" + item.subj_name;
						var hash2 = "#국어";

						p_o.innerHTML = "<span>"+hash1+"</span><span>"+hash2+"</span>"
						li_o.appendChild(p_o);

					}

					var p2_o = document.createElement("p");
					p2_o.className = "downLink";
					p2_o.innerHTML = '<a href="#" data-src="main" data-act="item_down"><em>다운로드</em><em>닫기</em><span class="down">'
									+ '<svg xmlns="http://www.w3.org/2000/svg" width="9" height="7" viewBox="0 0 9 7"><path id="triangle" data-name="triangle" d="M3.659,1.308a1,1,0,0,1,1.682,0L8.01,5.459A1,1,0,0,1,7.168,7H1.832A1,1,0,0,1,.99,5.459Z"/></svg>'
									+ '</span></a>';


					li_o.appendChild(p2_o);
					// div_o : 리스트다 담길 대단원 영역
					div_o.appendChild(row_o);

					var redown_expapr_no = [];

					for (var i = 0; i < cateItems.length; i++) {
						cateItem = cateItems[i];
						_drawItem_C_v2_P(cateItem, dataItems);
					}

					for (var i = 0; i < dataItems.length; i++) {
    					dataItems.items[i] = util.keysToLowerCase(dataItems.items[i]);
						redown_expapr_no.push(dataItems.items[i].expapr_no);
					}

					// 재다운 표시
					ui_updater.setUI();
				}
			}
			_initEvent();
		}
	};
	// Pro 관련 (e)

	// 카테고리 정보와 리스트 정보 분리 (정효태)
	var _drawList_v2 = function(cateItems, dataItems) {
		var ul_o = root.querySelector("#list_A");
    	if(ul_o) {
    		if(Page == 1) {
    			ul_o.innerHTML = "";
    		}
    		if(dataItems == null || dataItems.length == 0) {
    			_drawNoList();
    			return;
    		}
    		sortDataItems = [];
    		if(Page == 1) {
    			ul_o.innerHTML = "";
    		}
    		if(dataItems.length <= 0) {
    			return;
    		}

			// PRO전용
    		if(selectedInfo.menuIndex == 2 && Page == 1) {
    			var row_o = root.querySelector("#row_C");
    			var parent_o = row_o.querySelector(".productBlock");
    			parent_o.innerHTML = "";
    			{
    				var count_o = row_o.querySelector(".listTop .row .bbsNumber b");
    				if(count_o){
    					count_o.innerHTML = util.toNumber(totalCount);
    				}

    				var p_o = row_o.querySelector(".titleLine");
    				if(selectedInfo.sub3Index == 0) {
    					p_o.style.display = "";
    					p_o.innerHTML = chapter3Items[selectedInfo.chapter3Index].Name + '<button type="button" data-src="main" data-act="toggleAll" class="toggle">접기/펼치기</button></p>';
    				} else {
    					p_o.style.display = "none";
    					p_o.innerHTML = "";
    				}
    			}
    		}

    		var row_A = root.querySelector("#row_A");
    		var row_B = root.querySelector("#row_B");
    		var row_C = root.querySelector("#row_C");

    		if(selectedInfo.menuIndex == 0 || selectedInfo.menuIndex == 3 || selectedInfo.menuIndex == 4) {
    			var group_v = popGroupItems[selectedInfo.groupIndex].Value;
    			var subject_v = popSubjectItems[selectedInfo.subjectIndex].Value;
    			var coreType_v = popGroupItems[selectedInfo.groupIndex].CoreType;

    			var isMathCalc = false;

    			if(group_v == "K" && subject_v == "MT" && coreType_v.substring(0,1) == "B") {
    				isMathCalc = true;
    			}

				//if(selectedInfo.groupIndex == 0 || isMathCalc || ((group_v == "C" || group_v == "M" || ( group_v == "H" && (coreType_v == "D" || coreType_v == "E")) || ( group_v == "S") || (group_v == "K" && coreType_v == "M") || (group_v == "H" && coreType_v == "T") || (group_v == "K" && coreType_v == "F")) && isOldData == false)) {	//  개념완성 -> 대단원 조회부터.
				if(parseInt(popGroupItems[selectedInfo.groupIndex].Index) == 0 || isMathCalc || ((group_v == "C" || group_v == "M" || ( group_v == "H" && (coreType_v == "D" || coreType_v == "E")) || ( group_v == "S") || (group_v == "K" && coreType_v == "M") || (group_v == "H" && coreType_v == "T") || (group_v == "K" && coreType_v == "F")) && isOldData == false)) {	//  개념완성 -> 대단원 조회부터.
					row_A.style.display = "none";
					row_B.style.display = "";
					activeRow = row_B;

					$(row_B).find(".bbsNumber b").html(totalCount);

					var objs = row_B.querySelectorAll(".block_list");
					for(var i = 0; i < objs.length; i++) {
						var obj = objs[i];
						if(obj.parentNode) {
							obj.parentNode.removeChild(obj);
						}
					}

					if ((group_v == "C" || group_v == "M" || ( group_v == "H" && (coreType_v == "D" || coreType_v == "E")) || ( group_v == "S") || (group_v == "K" && coreType_v == "M") || (group_v == "H" && coreType_v == "T") || (group_v == "K" && coreType_v == "F"))) {
						var item = null;
						var cateItem = null;

						// 검색조건이 없을 경우 전체 대메뉴 표시 (학기검색, 키워드검색)
						//if (selectedInfo.termIndex == "0" && filter_1.querySelector("input[name='qry']").value == "") {
						// 년도는 왜 누락되었을까요..? 년도값도 추가해야될거같은데... (2023.03.06)
						if (selectedInfo.yearIndex == "0" && selectedInfo.termIndex == "0" && filter_1.querySelector("input[name='qry']").value == "") {
							for (var i = 0; i < cateItems.length; i++) {
								cateItem = cateItems[i];
								item = dataItems[i];

								_drawItem_C_v2(cateItem, item);
							}

							var data_v = _data_v;
							if(group_v == "C") {
								// 단원별 문제(난이도 기본 셋팅_최상위 제외)
								if (p_add_diff == "0" || p_add_diff == "") {
									data_v = _data_v + "&add_diff=1,2,3";
								} else {
									data_v = _data_v + "&add_diff=" + p_add_diff;
								}
							}

							// 토탈 카운트만 체크하기 때문에 PageSize=1로 강제 치환 (속도 문제)
							comm.send(_url_v, data_v.replace(/PageSize=([0-9]*)/, "PageSize=1") + "&flagRecord=Y", "POST", function(json) {
								var num_o = root.querySelector("#row_B").querySelector(".bbsNumber b");
								if (num_o) {
									if (typeof(json.RecordCount) != "undefined") {
										num_o.innerHTML = util.toNumber(json.RecordCount);
									}
								}
							});
						} else {
							chapterItems = [];
							chapterItems = [{"Name" : "전체 대단원", "Value": ""}];

							for (var i = 0; i < dataItems.length; i++) {
								var obj = {};
								item = dataItems[i];
								cateItem = cateItems[parseInt(item.index_code) - 1];
								// 대메뉴 재 구성
								obj.Name = cateItem.rootpart_code +". " + cateItem.rootpart_name;
								obj.Value = cateItem.rootpart_id;
								obj.parent_index = (i+1);
								obj.rootpart_code = item.rootpart_code;
								chapterItems.push(obj);

								_drawItem_C_v2(cateItem, item);
							}
						}
					} else {
						for (var i = 0; i < dataItems.length; i++) {
							var item = dataItems[i];		// 기본 1개의 대메뉴 리스트만 존재 [0] 으로 처리해도 되나 관리차원에서 기존 로직대로...

							_drawItem_0(item, PageSize * (Page - 1) + i);
						}
					}
					/*
					for(var i = 0; i < dataItems.length; i++) {
						var item = dataItems[i];
						if((group_v == "C" || group_v == "M" || ( group_v == "H" && (coreType_v == "D" || coreType_v == "E")) || ( group_v == "S") || (group_v == "K" && coreType_v == "M") || (group_v == "H" && coreType_v == "T") || (group_v == "K" && coreType_v == "F"))) {
							_drawItem_C(item, PageSize * (Page - 1) + i);
						} else {
							_drawItem_0(item, PageSize * (Page - 1) + i);
						}
					}
					*/
				}
				else {
					row_A.style.display = "";
					row_B.style.display = "none";
					activeRow = row_A;

					for(var i = 0; i < dataItems.length; i++) {
						var item = dataItems[i];
						_drawItem(item, PageSize * (Page - 1) + i);
					}

				}
			}
			else {
				row_A.style.display = "";
				row_B.style.display = "none";
				activeRow = row_A;
				for(var i = 0; i < dataItems.length; i++) {
					var item = dataItems[i];
					_drawItem(item, PageSize * (Page - 1) + i);
				}
			}
			_initEvent();
		}
	};

	// 학교별족보(최빈, 최오)는 내신완성 리스트 템플릿 사용 (복붙)
	var _drawList_v2_H = function(cateItems, dataItems) {
    	var ul_o = root.querySelector("#list_A");
    	if(ul_o) {
    		if(Page == 1) {
    			ul_o.innerHTML = "";
    		}
    		if(dataItems == null || dataItems.length == 0) {
    			_drawNoList();
    			return;
    		}
    		sortDataItems = [];
    		if(Page == 1) {
    			ul_o.innerHTML = "";
    		}
    		if(dataItems.length <= 0) {
    			return;
    		}

    		var row_A = root.querySelector("#row_A");
    		var row_B = root.querySelector("#row_B");
    		var row_C = root.querySelector("#row_C");
			var group_v = pop2TypeItems[selectedInfo.type2Index].value;
			var subject_v = popSubjectItems[selectedInfo.subject2Index].Value;
			var coreType_v = pop2TypeItems[selectedInfo.type2Index].CoreType;

			// 학교별족보(최빈, 최오)는 내신완성 리스트 같이 사용 (내신완성 리스트 복붙)
			if(isOldData == false) {
				row_A.style.display = "none";
				row_B.style.display = "";
				activeRow = row_B;

				$(row_B).find(".bbsNumber b").html(totalCount);

				var objs = row_B.querySelectorAll(".block_list");
				for(var i = 0; i < objs.length; i++) {
					var obj = objs[i];
					if(obj.parentNode) {
						obj.parentNode.removeChild(obj);
					}
				}

				var item = null;
				var cateItem = null;

				// 검색조건이 없을 경우 전체 대메뉴 표시 (학기검색, 키워드검색)
				if (selectedInfo.term2Index == "0" && filter_2.querySelector("input[name='qry']").value == "") {
					for (var i = 0; i < cateItems.length; i++) {
						cateItem = cateItems[i];
						item = dataItems[i];

						_drawItem_C_v2(cateItem, item);
					}

					// 토탈 카운트만 체크하기 때문에 PageSize=1로 강제 치환 (속도 문제)
					comm.send(_url_v, _data_v.replace(/PageSize=([0-9]*)/, "PageSize=1") + "&flagRecord=Y", "POST", function(json) {
						var num_o = root.querySelector("#row_B").querySelector(".bbsNumber b");
						if (num_o) {
							if (typeof(json.RecordCount) != "undefined") {
								num_o.innerHTML = util.toNumber(json.RecordCount);
							}
						}
					});
				} else {
					chapterItems = [];
					chapterItems = [{"Name" : "전체 대단원", "Value": ""}];

					for (var i = 0; i < dataItems.length; i++) {
						var obj = {};
						item = dataItems[i];
						cateItem = cateItems[parseInt(item.index_code) - 1];
						// 대메뉴 재 구성
						obj.Name = cateItem.rootpart_code +". " + cateItem.rootpart_name;
						obj.Value = cateItem.rootpart_id;
						obj.parent_index = (i+1);
						obj.rootpart_code = item.rootpart_code;
						chapterItems.push(obj);

						_drawItem_C_v2(cateItem, item);
					}
				}
			} else {
				row_A.style.display = "";
				row_B.style.display = "none";
				activeRow = row_A;
				for(var i = 0; i < dataItems.length; i++) {
					var item = dataItems[i];
					_drawItem(item, PageSize * (Page - 1) + i);
				}
			}

			_initEvent();
		}
	};

	// 리스트 그리기
	var _drawItem = function(item, index_p) {
		if(selectedInfo.menuIndex == 0 || selectedInfo.menuIndex == 3 || selectedInfo.menuIndex == 4) {
			_drawItem_1(item, index_p);
		}
		else if(selectedInfo.menuIndex == 1) {

			if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 4) {
				_drawK3Data(item, index_p);
			}
			else if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 0) // 무료 열람실
			{
				_draw_FreeReding(item, index_p);
			}
			else if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 2 || parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 8) // 예상족보, AI기출변형
			{
				_drawItem_V(item, index_p);
			}
			else {
				_drawItem_2(item, index_p);
			}
		}
		else if(selectedInfo.menuIndex == 2) {
			_drawItem_3(item, index_p);
		}
	};
	// Pro 관련 (s)
	// 국어문법
	var _drawItem_KoreanGra = function(item) {
		var row_o = root.querySelector("#row_B");

		var group_v = popGroupItems[selectedInfo.groupIndex].Value;
		var subject_v = popSubjectItems[selectedInfo.subjectIndex].Value;

		var subItem = []

		var div_o = document.createElement("div");
		div_o.className = "block_list active";
		div_o.setAttribute("data-index", item.idx);
		row_o.appendChild(div_o);

		var p = document.createElement("p");
		if (item.idx == 1) {
			p.className = "titleLine active";
		} else {
			p.className = "titleLine";
		}
		p.innerHTML = item.Rootpart + '<button type="button" class="toggle">접기/펼치기</button></p>';
		div_o.appendChild(p);

		$(p).find(".toggle").bind("click", function(ee) {
			var ev = window.event || ee;
			var evo = ev.srcElement || ev.target;
			evo = util.findObjectByAttr(evo, "type", "button");
			if(evo) {
				var po = util.findObjectByAttr(evo, "class", "block_list");
				if(po) {
					var to = po.querySelectorAll(".titleLine");
					if($(to).hasClass("active")) {
						$(to).removeClass("active");
						$(po).find(".productBlock").css("display", "none");
					}
					else {
						$(to).addClass("active");
						$(po).find(".productBlock").css("display", "");
					}
				}
			}
		});
		for(var i = 0; i < item.list_group.length; i++) {
			var mItem = item.list_group[i];

			var div_1 = document.createElement("div");
			if (item.idx > 1) {
				div_1.style.display = "none";
			}
			div_1.className = "productBlock row";
			div_1.setAttribute("data-chap", item.idx);
			div_1.setAttribute("data-theme", i+1);
			div_o.appendChild(div_1);

			var p = document.createElement("p");
			p.className = "listTitle";
			p.innerHTML = mItem.Subpart + '<a href="#" class="arrowToggle"><img src="../../img/ico_arrow_up.png" width="16.5" alt=""></a>';
			div_1.appendChild(p);

			$(p).find(".arrowToggle").bind("click", function(ee) {
				var ev = window.event || ee;
				var evo = ev.srcElement || ev.target;
				evo = util.findObjectByAttr(evo, "class", "arrowToggle");
				if(evo) {
					var po = util.findObjectByAttr(evo, "class", "productBlock");
					if(po) {
						var to = po.querySelectorAll(".listTitle");
						if($(to).hasClass("active")) {
							$(to).removeClass("active");
							$(po).find(".bbsList").css("display", "");
						}
						else {
							$(to).addClass("active");
							$(po).find(".bbsList").css("display", "none");
						}
					}
				}
			});

			var ul_o = document.createElement("ul");
			ul_o.className = "bbsList mB20";
			div_1.appendChild(ul_o);

			subItem = item.list_group[i];

			var ul_o = ul_o;

			var formatInfo = "2";
			var type_p = "pdf";

			var obj_length = Object.keys(subItem).length
			var obj_Arr = Object.keys(subItem)
			var rootExpaprno = 0

			for (j = 1; j < obj_length ;j++ ){
				var li_o = document.createElement("li");
				var title = ""
				if (obj_Arr[j] == "exPapr_No1") { title = "개념&확인문제"; coreType_v = "A1"; formatInfo ="2,90" }
				else if (obj_Arr[j] == "exPapr_No2") { title = "기본문제"; coreType_v = "A2"; formatInfo ="2" }
				else if (obj_Arr[j] == "exPapr_No3") { title = "발전문제"; coreType_v = "A3"; formatInfo ="2" }
				else if (obj_Arr[j] == "exPapr_No4") { title = "심화문제"; coreType_v = "A4"; formatInfo ="2" }

				li_o.setAttribute("data-no", subItem[obj_Arr[j]]);
				li_o.setAttribute("data-siteid", _site_id);
				li_o.setAttribute("data-group", group_v);
				li_o.setAttribute("data-grade", 0);
				li_o.setAttribute("data-subjcode", "KR");
				li_o.setAttribute("data-coretype", coreType_v);
				li_o.setAttribute("data-tx", "");
				li_o.setAttribute("data-year", "");
				li_o.setAttribute("data-formats", formatInfo);
				li_o.setAttribute("data-title", encodeURIComponent(title));
				li_o.setAttribute("data-name", encodeURIComponent(title));
				li_o.setAttribute("data-partnum", 1);

				if (obj_Arr[j] == "exPapr_No1" || obj_Arr[j] == "exPapr_No2" || obj_Arr[j] == "exPapr_No3" || obj_Arr[j] == "exPapr_No4") {
					li_o.setAttribute("data-rootexpaprno", subItem[obj_Arr[j]]);
					ul_o.appendChild(li_o);

					rootExpaprno = subItem[obj_Arr[j]]
				} else {
					li_o.setAttribute("data-rootexpaprno", rootExpaprno);

					// 버튼그리기

				}
				if (((obj_Arr[j] == "exPapr_No2" && obj_Arr[j+1] == "exPapr_No2_2") || obj_Arr[j] == "exPapr_No2_2") || ((obj_Arr[j] == "exPapr_No3" && obj_Arr[j+1] == "exPapr_No3_2") || obj_Arr[j] == "exPapr_No3_2")) {
					var eroot = li_o;
					_drawDownLoadBtn(subItem[obj_Arr[j]], eroot);
				}
				{
					var p_o = document.createElement("p");
					p_o.className = "title";
					var title_v = title;
					p_o.innerHTML = "<span>" + title_v + "</span>";
					li_o.appendChild(p_o);

				}

				{
					var p_o = document.createElement("p");
					p_o.className = "hash";
					var key_v = null;
					key_v = _site_id + item.grade;

					var hash1 = "#전학년";
					//var hash2 = "#" + item.subj_name;
					var hash2 = "#국어";
					var hash3 = "";
					if(item.pub_name) hash3 = "<span>#" + item.pub_name + "</span>";

					p_o.innerHTML = "<span>"+hash1+"</span><span>"+hash2+"</span>" + hash3;
					li_o.appendChild(p_o);

				}

				{
					var p_o = document.createElement("p");
					p_o.className = "downLink";
					p_o.innerHTML = '<a href="#" data-src="main" data-act="item_down"><em>다운로드</em><em>닫기</em><span class="down">'
								+ '<svg xmlns="http://www.w3.org/2000/svg" width="9" height="7" viewBox="0 0 9 7"><path id="triangle" data-name="triangle" d="M3.659,1.308a1,1,0,0,1,1.682,0L8.01,5.459A1,1,0,0,1,7.168,7H1.832A1,1,0,0,1,.99,5.459Z"/></svg>'
								+'</span></a>';
					li_o.appendChild(p_o);
				}
				/*
				{
					var p_o = document.createElement("p");
					p_o.className = "listMenu";
					{
						var button_o = document.createElement("button");
						button_o.type = "button";
						button_o.setAttribute("data-src", "main");
						button_o.setAttribute("data-act", "errorPopup");
						{
							var img_o = document.createElement("img");
							img_o.src = "/img/ico_menu.png";
							img_o.setAttribute("width", "34");
							button_o.appendChild(img_o);
						}
						p_o.appendChild(button_o);
					}
					li_o.appendChild(p_o);
				}
				*/
			}
		}
		comm.toggleLoading(false);
	};
	// Pro 관련 (e)

	// Pro 관련 (s)
	// 수학교과서변형 / 수학단계별학습관
	var _drawItem_0_P = function(item, index_p) {
		var parent = root.querySelector("#row_B");
		var pItem = item;
		var div_o = document.createElement("div");
		div_o.className = "block_list";
		div_o.setAttribute("data-index", index_p + 1);			// 개념완성 리스트 안보이는 부분
		parent.appendChild(div_o);
		var p_o = document.createElement("p");
		var div_o_index = div_o.getAttribute("data-index")
		if (div_o_index > 1) {
			p_o.className = "titleLine";
		} else {
			p_o.className = "titleLine active";
		}
		var title_v = null;
		if(pItem.rootpart_code && pItem.rootpart_name) {
			if(pItem.rootpart_name.indexOf("Special") >= 0 && pItem.rootpart_name.indexOf("Lesson") >= 0) {
				title_v = pItem.rootpart_name;
			} else {
				title_v = pItem.rootpart_code + ". " + pItem.rootpart_name;
			}
		} else if(pItem.cate_name){
			title_v = pItem.cate_name;
		}
		p_o.innerHTML = title_v;
		div_o.appendChild(p_o);

		var btn_o = document.createElement("button");
		btn_o.className = "toggle";
		btn_o.innerHTML = "접기/펼치기";
		btn_o.setAttribute("data-src", _id);
		btn_o.setAttribute("data-act", "toggleAll");
		p_o.appendChild(btn_o);

		if(pItem.subList == null) pItem.subList = [];
		if(pItem.subList.length ==0) {
			var sub_o = _createSubItems_P(pItem, -1);
			if(sub_o) {
				div_o.appendChild(sub_o);
			}
		}
		else {
			for(var i = 0 ; i <pItem.subList.length; i++) {
				var sub_o = _createSubItems_P(pItem.subList[i], i);
				if(sub_o) {
					div_o.appendChild(sub_o);
				}
			}
		}

	};

	var _drawItem_Preparation = function(item, index_p) {
		var parent = root.querySelector("#row_B");
		var pItem = item;
		var div_o = document.createElement("div");

		div_o.className = "block_list";
		//div_o.setAttribute("data-index", index_p + 1);			// 개념완성 리스트 안보이는 부분
		div_o.setAttribute("data-index", $("div#row_B div.block_list").length+1);
		parent.appendChild(div_o);

		var p_o = document.createElement("p");
		var div_o_index = div_o.getAttribute("data-index");

		if (div_o_index > 1) {
			p_o.className = "titleLine";
		} else {
			p_o.className = "titleLine active";
		}

		var title_v = null;

		if(pItem.rootpart_code && pItem.rootpart_name) {
			title_v = pItem.rootpart_name;
		} else if(pItem.cate_name){
			title_v = pItem.cate_name;
		}

		if(title_v != null)
		{
//			p_o.innerHTML = title_v;

			var season_Txt = "";
			var seasonValue = $("#season_Val").val();

			if(seasonValue == "1M")
			{
				season_Txt = "1학기 중간고사";
			}
			else if(seasonValue == "1E")
			{
				season_Txt = "1학기 기말고사";
			}
			else if(seasonValue == "2M")
			{
				season_Txt = "2학기 중간고사";
			}
			else if(seasonValue == "2E")
			{
				season_Txt = "2학기 기말고사";
			}


			for(var i = 0; i < pItem.items.length; i++)
			{
				//if(i == 0 && pItem.items[0].exPapr_Term == "2" && pItem.items[0].exPapr_MidEnd == "E")
				if(i == 0 && pItem.items[0].exPapr_Term + pItem.items[0].exPapr_MidEnd == seasonValue)
				{
					p_o.innerHTML = "<em class=\"mo-label tbl-list mid\" style=\"margin-left:0px;\">" + season_Txt + "</em><br/>";
				}
			}

			p_o.innerHTML += title_v;

			div_o.appendChild(p_o);

			var btn_o = document.createElement("button");
			btn_o.className = "toggle";
			btn_o.innerHTML = "접기/펼치기";
			btn_o.setAttribute("data-src", _id);
			btn_o.setAttribute("data-act", "toggleAll");
			p_o.appendChild(btn_o);
		}

		if(pItem.subList == null) pItem.subList = [];

		if(pItem.subList.length == 0) {
			var sub_o = _createSubItems_Preparation(pItem, 1);

			if(sub_o) {
				div_o.appendChild(sub_o);
			}
		}
		else {
			for(var i = 0 ; i <pItem.subList.length; i++) {
				var sub_o = _createSubItems_Preparation(pItem.subList[i], i);
				if(sub_o) {
					div_o.appendChild(sub_o);
				}
			}
		}

	};

	// Pro 관련 (e)

	// 개념완성 그리기
	var _drawItem_0 = function(item, index_p) {
		var parent = root.querySelector("#row_B");
		var pItem = item;
		var div_o = document.createElement("div");
		div_o.className = "block_list";
		div_o.setAttribute("data-index", index_p + 1);			// 개념완성 리스트 안보이는 부분
		parent.appendChild(div_o);
		var p_o = document.createElement("p");
		//p_o.className = "titleLine active";
		// Pro 관련 (s)
		var div_o_index = div_o.getAttribute("data-index")
		p_o.className = "titleLine active";
		// Pro 관련 (e)
		var title_v = null;
		if(pItem.rootpart_code && pItem.rootpart_name) {
			if(pItem.rootpart_name.indexOf("Special") >= 0 && pItem.rootpart_name.indexOf("Lesson") >= 0) {
				title_v = pItem.rootpart_name;
			} else {
				title_v = pItem.rootpart_code + ". " + pItem.rootpart_name;
			}
		} else if(pItem.cate_name){
			title_v = pItem.cate_name;
		}
		p_o.innerHTML = title_v;
		div_o.appendChild(p_o);

		var btn_o = document.createElement("button");
		btn_o.className = "toggle";
		btn_o.innerHTML = "접기/펼치기";
		btn_o.setAttribute("data-src", _id);
		btn_o.setAttribute("data-act", "toggleAll");
		p_o.appendChild(btn_o);

		if(pItem.subList == null) pItem.subList = [];
		if(pItem.subList.length ==0) {
			var sub_o = _createSubItems(pItem, -1);
			if(sub_o) {
				div_o.appendChild(sub_o);
			}
		}
		else {
			for(var i = 0 ; i <pItem.subList.length; i++) {
				var sub_o = _createSubItems(pItem.subList[i], i);
				if(sub_o) {
					div_o.appendChild(sub_o);
				}
			}
		}

	};

    // 단원별 문제 그리기
    var _drawItem_C = function(item_p, index_p) {
    	var parent = root.querySelector("#row_B");
    	var num_o = parent.querySelector(".bbsNumber b");

    	if(num_o){
    		num_o.innerHTML = util.toNumber(totalCount);
    	}
    	$(parent).find("#fold1").trigger("click");

    	var div_o = document.createElement("div");
    	div_o.className = "block_list";
    	//div_o.setAttribute("data-index", item_p.index_code);
		div_o.setAttribute("data-index", $("div#row_B div.block_list").length+1);
    	parent.appendChild(div_o);

    	var p_o = document.createElement("p");
    	p_o.className = "titleLine active";
    	p_o.innerHTML = item_p.rootpart_name;
    	div_o.appendChild(p_o);

    	var btn_o = document.createElement("button");
    	btn_o.className = "toggle";
    	btn_o.innerHTML = "접기/펼치기";
    	btn_o.setAttribute("data-src", _id);
    	btn_o.setAttribute("data-act", "toggleAll");
    	p_o.appendChild(btn_o);

    	var rItem = item_p.items;
    	for(var i=0; i<rItem.length; i++) {
    		var item = rItem[i];

    		var row_o = document.createElement("div");
    		row_o.className = "productBlock row";

    		var ul_o = document.createElement("ul");
    		ul_o.className = "bbsList fullTitle mB20";
    		row_o.appendChild(ul_o);

    		var formatInfo = "";
    		// 2:pdf, 3:scan, 4:hwp, 5:zip
    		if(item.HWP2002 != "NONE") formatInfo = "4";
    		if(item.PDF && item.PDF != "NONE") {
    			if(formatInfo != "") formatInfo = formatInfo + ",";
    			formatInfo = formatInfo + "2";
    		}
    		if(item.SCAN && item.SCAN != "NONE") {
    			var _subj_code = popSubjectItems[selectedInfo.subjectIndex].Value;
    			var _group = popGroupItems[selectedInfo.groupIndex].Value;
    			var _coreType = popGroupItems[selectedInfo.groupIndex].CoreType
    			if(selectedInfo.menuIndex != 0 && _subj_code != "EG" && _group != "C" && _coreType != "") {
    				if(formatInfo != "") formatInfo = formatInfo + ",";
    				formatInfo = formatInfo + "3";
    			}
    		}
    		if(item.ZIP && item.ZIP != "NONE") {
    			if(formatInfo != "") formatInfo = formatInfo + ",";
    			formatInfo = formatInfo + "5";
    		}

    		if(item.vodProb && item.vodProb.length>0) {
    			if(formatInfo != "") formatInfo = formatInfo + ",";
    			formatInfo = formatInfo + "94";
    		}

    		if(item.expapr_title.indexOf("[Q]") > -1){
    			if(formatInfo != "") formatInfo = formatInfo + ",";
    			formatInfo = formatInfo + "97";
    		}
			

    		item = util.keysToLowerCase(item);

			// 수행평가 예외처리
			if (item.expapr_group == "T") {
				formatInfo = "2";
			}

    		var li_o = document.createElement("li");
    		li_o.setAttribute("data-no", item.expapr_no);
    		li_o.setAttribute("data-siteid", item.siteid);
    		li_o.setAttribute("data-group", item.expapr_group);
    		li_o.setAttribute("data-grade", item.grade);
    		li_o.setAttribute("data-subjcode", item.subj_code);
    		li_o.setAttribute("data-coretype", item.expapr_coretype);
    		li_o.setAttribute("data-tx", item.tx_code);
    		li_o.setAttribute("data-year", item.expapr_testyear);
    		li_o.setAttribute("data-formats", formatInfo);
    		li_o.setAttribute("data-title", item.expapr_title);
			li_o.setAttribute("data-textbook", item.textbook);

    		if(item.vodProb && item.vodProb.length>0) {
    			li_o.setAttribute("data-code", item.vodProb[0].Code);
    		}
    		ul_o.appendChild(li_o);

    		var p_o = document.createElement("p");
    		p_o.className = "tag";

			if (item.subj_code == 'MT' && item.expapr_group == 'K' && item.expapr_coretype == 'F') // 교과서 변형
			{
    			p_o.innerHTML = "<span>교과서 변형";
			}
			else
			{
				p_o.innerHTML = "<span>" + _getTermName(item.expapr_term, item.expapr_midend);
			}

    		if(common.isPremium(item.expapr_title)) {
    			p_o.innerHTML = p_o.innerHTML + "<span>프리미엄</span>";
    		}
    		li_o.appendChild(p_o);

    		p_o = document.createElement("p");
    		p_o.className = "title";
    		p_o.innerHTML = "<span>" + item.expapr_title + "</span>";
    		li_o.appendChild(p_o);

    		var p_o = document.createElement("p");
    		p_o.className = "hash";
    		var key_v = null;
    		key_v = _site_id + item.grade;

    		var hash1 = "#" + _categorySub[key_v].title;
    		var hash2 = "#" + item.subj_name;
			var hash3 = "#" + item.pub_name;

    		if (item.subj_code == 'MT' && item.expapr_group == 'K' && item.expapr_coretype == 'F') // 교과서 변형
			{
				p_o.innerHTML = "<span>"+hash1+"</span><span>"+hash2+"</span>";
			}
			else
			{
				p_o.innerHTML = "<span>"+hash1+"</span><span>"+hash2+"</span><span>" + hash3 + "</span>";
			}

    		li_o.appendChild(p_o);

    		var p2_o = document.createElement("p");
    		p2_o.className = "downLink";

			if (item.subj_code == 'MT' && item.expapr_group == 'K' && item.expapr_coretype == 'F') // 교과서 변형
			{
				p2_o.innerHTML = '<a href="#" data-src="main" data-act="item_down"><em>다운로드(PRO전용)</em><em>닫기</em><span class="down">'
							+ '<svg xmlns="http://www.w3.org/2000/svg" width="9" height="7" viewBox="0 0 9 7"><path id="triangle" data-name="triangle" d="M3.659,1.308a1,1,0,0,1,1.682,0L8.01,5.459A1,1,0,0,1,7.168,7H1.832A1,1,0,0,1,.99,5.459Z"/></svg>'
							+'</span></a>';
			}
			else
			{
				p2_o.innerHTML = '<a href="#" data-src="main" data-act="item_down"><em>다운로드</em><em>닫기</em><span class="down">'
							+ '<svg xmlns="http://www.w3.org/2000/svg" width="9" height="7" viewBox="0 0 9 7"><path id="triangle" data-name="triangle" d="M3.659,1.308a1,1,0,0,1,1.682,0L8.01,5.459A1,1,0,0,1,7.168,7H1.832A1,1,0,0,1,.99,5.459Z"/></svg>'
							+'</span></a>';
			}

    		li_o.appendChild(p2_o);

    		{
    			var p_o = document.createElement("p");
    			p_o.className = "listMenu";
    			{
    				var button_o = document.createElement("button");
    				button_o.type = "button";
    				button_o.setAttribute("data-src", "main");
    				button_o.setAttribute("data-act", "errorPopup");
    				{
    					var img_o = document.createElement("img");
    					img_o.src = "/img/ico_menu.png";
    					img_o.setAttribute("width", "34");
    					button_o.appendChild(img_o);
    				}
    				p_o.appendChild(button_o);
    			}
    			li_o.appendChild(p_o);
    		}

    		div_o.appendChild(row_o);
    	}
    };

	// 대단원에 맞는 서브 리스트 draw
	var _drawItem_C_sub_v2 = function(p_div_o, item_p) {
		var rItem = item_p.items;
		var redown_expapr_no = [];		// 정효태 (2021.11.26)
		var group_v = popGroupItems[selectedInfo.groupIndex].Value;
		var coretype_v = popGroupItems[selectedInfo.groupIndex].CoreType;

		var p_div_oIndex = p_div_o.getAttribute("data-index");
		
		//중등 갈래별 문학(작품별, 작가별 리스트 구분)
		if (group_v == "P" && coretype_v.substring(0,1) == "D") {
			let matchList = rItem.filter((val) => { 
				return (selectedInfo.yearIndex == 0 && val.add_attr3 == item_p.cate) || (selectedInfo.yearIndex == 1 && val.add_attr4 == item_p.cate) 
			});

			rItem = matchList;
		}

    	for (var i=0; i<rItem.length; i++) {
    		var item = rItem[i];

    		var row_o = document.createElement("div");
			if (group_v == "P" && coretype_v.substring(0,1) == "D") {
				if (p_div_oIndex > 1 ) {
					row_o.style.display = "none";
				}
			}
    		row_o.className = "productBlock row";

    		var ul_o = document.createElement("ul");
    		ul_o.className = "bbsList fullTitle mB20";
    		row_o.appendChild(ul_o);

			//if((group_v == "C" && (item.add_diff == "4" || item.add_diff == "5")) || (group_v == "H" && coretype_v == "T")) {
				item.HWP2002 = "NONE";
			//}

    		var formatInfo = "";
    		// 2:pdf, 3:scan, 4:hwp, 5:zip
    		if(item.HWP2002 != "NONE") formatInfo = "4";
    		if(item.PDF && item.PDF != "NONE") {
    			if(formatInfo != "") formatInfo = formatInfo + ",";
    			formatInfo = formatInfo + "2";
    		}
    		if(item.SCAN && item.SCAN != "NONE") {
    			var _subj_code = popSubjectItems[selectedInfo.subjectIndex].Value;
    			var _group = popGroupItems[selectedInfo.groupIndex].Value;
    			var _coreType = popGroupItems[selectedInfo.groupIndex].CoreType
    			if(selectedInfo.menuIndex != 0 && _subj_code != "EG" && _group != "C" && _coreType != "") {
    				if(formatInfo != "") formatInfo = formatInfo + ",";
    				formatInfo = formatInfo + "3";
    			}
    		}
    		if(item.ZIP && item.ZIP != "NONE") {
    			if(formatInfo != "") formatInfo = formatInfo + ",";
    			formatInfo = formatInfo + "5";
    		}

    		if(item.vodProb && item.vodProb.length>0) {
    			if(formatInfo != "") formatInfo = formatInfo + ",";
    			formatInfo = formatInfo + "94";
    		}

    		if(item.expapr_title.indexOf("[Q]") > -1){
    			if(formatInfo != "") formatInfo = formatInfo + ",";
    			formatInfo = formatInfo + "97";
    		}

    		item = util.keysToLowerCase(item);

			if (group_v == "P") {
				//갈래별문학 (중등 문학 공략)
				if (item.expapr_coretype == "D2") {
					// 영상&작품분석
					formatInfo = "2,90";
				} else if (item.expapr_coretype == "D3") {
					// 실전문제
					//formatInfo = "4,2"
					formatInfo = "2";
				}
			}

    		var li_o = document.createElement("li");

    		li_o.setAttribute("data-no", item.expapr_no);
    		li_o.setAttribute("data-siteid", item.siteid);
    		li_o.setAttribute("data-group", item.expapr_group);
    		li_o.setAttribute("data-grade", item.grade);
    		li_o.setAttribute("data-subjcode", item.subj_code);
    		li_o.setAttribute("data-coretype", item.expapr_coretype);
    		li_o.setAttribute("data-tx", item.tx_code);
    		li_o.setAttribute("data-year", item.expapr_testyear);
    		li_o.setAttribute("data-formats", formatInfo);
    		li_o.setAttribute("data-title", item.expapr_title);
			li_o.setAttribute("data-textbook", item.textbook);
			li_o.setAttribute("data-partnum", 1);

    		if(item.vodProb && item.vodProb.length>0) {
    			li_o.setAttribute("data-code", item.vodProb[0].Code);
    		}
    		ul_o.appendChild(li_o);

    		var p_o = document.createElement("p");
    		p_o.className = "tag";

			if (item.subj_code == 'MT' && item.expapr_group == 'K' && item.expapr_coretype == 'F') // 교과서 변형
			{
    			p_o.innerHTML = "<span>교과서 변형";
			}
			else
			{
				if (group_v == "P") {
					//갈래별문학 (중등 문학 공략)
					if (item.expapr_coretype == "D2") {
						// 영상&작품분석
						p_o.innerHTML = "<span>영상&작품분석";
					} else if (item.expapr_coretype == "D3") {
						// 실전문제
						p_o.innerHTML = "<span>실전문제";
					}
				} else {
					//p_o.innerHTML = "<span>" +item.add_attr1+ "</span>";
					p_o.innerHTML = "<span>" +item.expapr_testyear+ "년 대비</span>";

					p_o.innerHTML = p_o.innerHTML + "<span>" +item.add_attr2+ "</span>"
					if ((item.expapr_group == 'K' && item.expapr_coretype == 'M') || (item.expapr_group == 'H' && item.expapr_coretype == 'T')) {	// 수학 유형별 문제 or 영어문법문제(출판사별)
						p_o.innerHTML = p_o.innerHTML + "<span>" +item.add_attr3+ "</span>"
					} else if (item.expapr_group == 'C' && item.expapr_coretype == '') { // 단원별
						//if (item.subj_code != 'KR' && item.subj_code != 'EG') {	// 국어 / 영어 제외
						if (item.add_diff == '1') { p_o.innerHTML = p_o.innerHTML + "<span>기초</span>" }
						else if (item.add_diff == '2') { p_o.innerHTML = p_o.innerHTML + "<span>기본</span>" }
						else if (item.add_diff == '3') { p_o.innerHTML = p_o.innerHTML + "<span>발전</span>" }
						else if (item.add_diff == '4') { 
							if (item.subj_code == "MT" || item.subj_code == "SC") {
								p_o.innerHTML = p_o.innerHTML + "<span>최상위Ⅰ</span>";
							} else {
								p_o.innerHTML = p_o.innerHTML + "<span>최상위</span>";
							}
						}
						else if (item.add_diff == '5') { p_o.innerHTML = p_o.innerHTML + "<span>최상위Ⅱ</span>" }
						//}
					}
				}
			}

    		//if(common.isPremium(item.expapr_title)) {
    		//	p_o.innerHTML = p_o.innerHTML + "<span>프리미엄</span>";
    		//}
    		li_o.appendChild(p_o);

    		p_o = document.createElement("p");
    		p_o.className = "title";
			
			let setTitle = item.add_title;//리스트 내 출력 제목
			
			//중등 갈래별 문학(D2, D3)만 expapr_title 로 나오게 셋팅
			if (group_v == "P" && (item.expapr_coretype == "D2" || item.expapr_coretype == "D3")) {
				setTitle = item.expapr_title;
			}

			if(item.expapr_testyear == new Date().getFullYear()) {
				setTitle = setTitle + "<img src='/img/ico_new.png' style='margin-left:10px;width:12px;height:12px;'>";
			}
			
			p_o.innerHTML = "<span>" + setTitle + "</span>";

    		li_o.appendChild(p_o);

    		var p_o = document.createElement("p");
    		p_o.className = "hash";
    		var key_v = null;
    		key_v = _site_id + item.grade;

    		var hash1 = "#" + _categorySub[key_v].title;
    		var hash2 = "#" + item.subj_name;
			var hash3 = "#" + item.pub_name;

			/* 중1 단원별, 최다빈출, 최다오답 등록일 2022.07.01 이상일 경우 New표시 */
			var date1 = new Date("2022-07-06".replace(/-/g, "/"));		// 테스트 (2022-07-01 -> 2020-07-01)
			var date2 = new Date(item.expapr_regdate.replace(/-/g, "/"));
			var dic_subj_code = {};

			dic_subj_code['C'] = "KR|EG|MT|SC|LS|";	// 단원별
			dic_subj_code['HD'] = "MT|SC|LS|";		// 최빈
			dic_subj_code['HE'] = "SC|LS|";			// 최오
			p_o.innerHTML = "";

//			if( date2 > date1 && (item.grade == "0" || item.grade == "1") && (item.expapr_group + item.expapr_coretype in dic_subj_code)) {
//				if( dic_subj_code[item.expapr_group + item.expapr_coretype].includes(item.subj_code) ) {
//					p_o.innerHTML = "<span>#NEW</span>";
//				}
//			}
			/* END */

    		if (item.subj_code == 'MT' && item.expapr_group == 'K' && item.expapr_coretype == 'F') // 교과서 변형
			{
				p_o.innerHTML += "<span>"+hash1+"</span><span>"+hash2+"</span>";
			}
			else if (item.expapr_group == 'C' && item.expapr_coretype == '')
			{
				if (common.isPremium(item.expapr_title)) {
					p_o.innerHTML += "<span>"+hash1+"</span><span>#프리미엄</span><span>"+hash2+"</span><span>" + hash3 + "</span>";
				}
			}
			else
			{
				p_o.innerHTML += "<span>"+hash1+"</span><span>"+hash2+"</span><span>" + hash3 + "</span>";
			}

			// Pro 관련 (s)
			if (group_v == "P" && coretype_v.substring(0,1) == "D") {
				var p_o = document.createElement("p");
				p_o.className = "hash";
				var key_v = null;
				key_v = _site_id + item.grade;

				var hash1 = "#전학년";
				//var hash2 = "#" + item.subj_name;
				var hash2 = "#국어";

				p_o.innerHTML = "<span>"+hash1+"</span><span>"+hash2+"</span>"
			}
			// Pro 관련 (e)

    		li_o.appendChild(p_o);

    		var p2_o = document.createElement("p");
    		p2_o.className = "downLink";

			if (item.subj_code == 'MT' && item.expapr_group == 'K' && item.expapr_coretype == 'F') // 교과서 변형
			{
				//p2_o.innerHTML = '<a href="#" data-src="main" data-act="item_down"><em>다운로드(PRO전용)</em><em>닫기</em><span class="down"></span></a>';
				p2_o.innerHTML = '<a href="#" data-src="main" data-act="item_down"><em>다운로드(PRO전용)</em><em>닫기</em><span class="down">'
							+ '<svg xmlns="http://www.w3.org/2000/svg" width="9" height="7" viewBox="0 0 9 7"><path id="triangle" data-name="triangle" d="M3.659,1.308a1,1,0,0,1,1.682,0L8.01,5.459A1,1,0,0,1,7.168,7H1.832A1,1,0,0,1,.99,5.459Z"/></svg>'
							+'</span></a>';
			}
			else
			{
				//p2_o.innerHTML = '<a href="#" data-src="main" data-act="item_down"><em>다운로드</em><em>닫기</em><span class="down"></span></a>';
				p2_o.innerHTML = '<a href="#" data-src="main" data-act="item_down"><em>다운로드</em><em>닫기</em><span class="down">'
								+ '<svg xmlns="http://www.w3.org/2000/svg" width="9" height="7" viewBox="0 0 9 7"><path id="triangle" data-name="triangle" d="M3.659,1.308a1,1,0,0,1,1.682,0L8.01,5.459A1,1,0,0,1,7.168,7H1.832A1,1,0,0,1,.99,5.459Z"/></svg>'
								+ '</span></a>';
			}

    		li_o.appendChild(p2_o);

			if (group_v == "P" && coretype_v.substring(0,1) == "D") {
				// Pro 관련(s)
				// Pro 관련(e)
			} else 
    		{
    			var p_o = document.createElement("p");
    			p_o.className = "listMenu";
    			{
    				var button_o = document.createElement("button");
    				button_o.type = "button";
    				button_o.setAttribute("data-src", "main");
    				button_o.setAttribute("data-act", "errorPopup");
    				{
    					var img_o = document.createElement("img");
    					img_o.src = "/img/ico_menu.png";
    					img_o.setAttribute("width", "34");
    					button_o.appendChild(img_o);
    				}
    				p_o.appendChild(button_o);
    			}
    			li_o.appendChild(p_o);
    		}

			// p_div_o : 리스트다 담길 대단원 영역
    		p_div_o.appendChild(row_o);

			// 재다운 표시 위한 시험지 번호 취합 (정효태, 2021.11.26)
			redown_expapr_no.push(item.expapr_no);
    	}

		// 재다운 표시
		ui_updater.setUI();
	}

	// Pro 관련 (s)
	//갈래별문학 (중등 문학 공략)
	var _drawItem_C_v2_P = function(cateItem_p, item_p) {
    	var parent = root.querySelector("#row_B");
    	var num_o = parent.querySelector(".bbsNumber b");
		var group_v = popGroupItems[selectedInfo.groupIndex].Value;
		var coretype_v = popGroupItems[selectedInfo.groupIndex].CoreType;

		// 대단원에 맞는 서브 리스트를 불러오기 위해 rootpart_code 확인
		var rootpart_code = ((!isNaN(cateItem_p.rootpart_term) && cateItem_p.rootpart_term != "") ? (parseInt(cateItem_p.rootpart_term) * 100) : 100) + parseInt(cateItem_p.rootpart_code);
		if (group_v == "T") {
			rootpart_code = cateItem_p.rootpart_code;
		}
		/*
    	if (num_o){
    		num_o.innerHTML = util.toNumber(totalCount);
    	}
		*/
    	$(parent).find("#fold1").trigger("click");

    	var div_o = document.createElement("div");
    	div_o.className = "block_list";
    	//div_o.setAttribute("data-index", item_p.index_code);
		if (group_v == "P" && coretype_v.substring(0,1) == "D") {
			div_o.setAttribute("data-index", $("div#row_B div.block_list").length);
		} else {
			div_o.setAttribute("data-index", $("div#row_B div.block_list").length+1);
		}
    	parent.appendChild(div_o);

    	var p_o = document.createElement("p");

		// 첫번째만 show, 이외는 hidden
		var dataIndex =div_o.getAttribute("data-index");
		if(dataIndex > 1) {
    		p_o.className = "titleLine";
		} else {
			p_o.className = "titleLine active";
		}

    	//p_o.innerHTML = item_p.rootpart_name;
		if (group_v == "P" && coretype_v.substring(0,1) == "D") {
			//시대별문학 (고등 문학 공략)
			p_o.innerHTML = cateItem_p.RESULT_TEXT;
			item_p["cate"] = cateItem_p.RESULT_TEXT;
			rootpart_code = cateItem_p.SEQ;
		} else {
			p_o.innerHTML = cateItem_p.rootpart_code + ". " + cateItem_p.rootpart_name;
		}
    	div_o.appendChild(p_o);

    	var btn_o = document.createElement("button");
    	btn_o.className = "toggle";
    	btn_o.innerHTML = "접기/펼치기";
    	btn_o.setAttribute("data-src", _id);
		btn_o.setAttribute("data-version", "v2");		// list type 확인 (기존 리스트와 구분 위해)
		btn_o.setAttribute("data-rootpart_code", rootpart_code);	// 대단원코드
		btn_o.setAttribute("data-parent-index", $("div#row_B div.block_list").length);	// 상위 data-index 확인 (draw한 이후기 떄문에 +1 없음)
    	btn_o.setAttribute("data-act", "toggleAll");
    	p_o.appendChild(btn_o);

		// 대단원을 그리면서 기본 리스트정보는 추가
		if (typeof(item_p) != "undefined") {
			_drawItem_C_sub_v2(div_o, item_p);
		}
    };
	// Pro 관련 (e)

	/*
		대단원 정보를 그린 후 리스트는 별도 함수로 분리. 부하 줄이기 위해 (정효태)
	*/
	var _drawItem_C_v2 = function(cateItem_p, item_p) {
    	var parent = root.querySelector("#row_B");
    	var num_o = parent.querySelector(".bbsNumber b");

		// 대단원에 맞는 서브 리스트를 불러오기 위해 rootpart_code 확인
		var rootpart_code = ((!isNaN(cateItem_p.rootpart_term) && cateItem_p.rootpart_term != "") ? (parseInt(cateItem_p.rootpart_term) * 100) : 100) + parseInt(cateItem_p.rootpart_code);
		/*
    	if (num_o){
    		num_o.innerHTML = util.toNumber(totalCount);
    	}
		*/
    	$(parent).find("#fold1").trigger("click");

    	var div_o = document.createElement("div");
    	div_o.className = "block_list";
    	//div_o.setAttribute("data-index", item_p.index_code);
		div_o.setAttribute("data-index", $("div#row_B div.block_list").length+1);
    	parent.appendChild(div_o);

    	var p_o = document.createElement("p");

		// 첫번째만 show, 이외는 hidden
		/*
		if($("div#row_B div.block_list").length == 1) {
    		p_o.className = "titleLine active";
		} else {
			p_o.className = "titleLine";
		}
		*/
		p_o.className = "titleLine";

    	//p_o.innerHTML = item_p.rootpart_name;
		p_o.innerHTML = cateItem_p.rootpart_code + ". " + cateItem_p.rootpart_name;
    	div_o.appendChild(p_o);

    	var btn_o = document.createElement("button");
    	btn_o.className = "toggle";
    	btn_o.innerHTML = "접기/펼치기";
    	btn_o.setAttribute("data-src", _id);
		btn_o.setAttribute("data-version", "v2");		// list type 확인 (기존 리스트와 구분 위해)
		btn_o.setAttribute("data-rootpart_code", rootpart_code);	// 대단원코드
		btn_o.setAttribute("data-parent-index", $("div#row_B div.block_list").length);	// 상위 data-index 확인 (draw한 이후기 떄문에 +1 없음)
    	btn_o.setAttribute("data-act", "toggleAll");
    	p_o.appendChild(btn_o);

		// 대단원을 그리면서 기본 리스트정보는 추가
		if (typeof(item_p) != "undefined") {
			p_o.className = "titleLine active";
			_drawItem_C_sub_v2(div_o, item_p);
		}
    };

	// Pro 관련 (s)
	// 수학교과서변형 (수학 MASTRER) / 수학단계별학습관
    var _createSubItems_P = function(sItem, index_p) {
    	if(sItem == null ) return null;
    	var title_v = "";
    	var tag_v = "";
    	if(index_p < 0) {
    		var title_t = sItem.rootpart_name;
    		title_v = sItem.rootpart_code + ". " + title_t;
    	}
    	else {
    		var title_t = sItem.subpart_name;
    		title_v = sItem.rootpart_code + "." + sItem.subpart_code + " " + title_t;
    	}
		var sItem_index = sItem.rootpart_code;

    	var div_o = document.createElement("div");
    	div_o.className = "productBlock row";
		if (sItem_index > 1) {
			div_o.style.display = "none";
		}

    	if(index_p >= 0) {
    		var p_o = document.createElement("p");
    		p_o.className = "listTitle";
    		p_o.innerHTML = title_v + '<a href="#" class="arrowToggle" data-src="main" data-act="toggleGroup" ><img src="../../img/ico_arrow_up.png" width="16.5" alt=""></a>';
    		div_o.appendChild(p_o);
    	}

    	var ul_o = document.createElement("ul");
    	ul_o.className = "bbsList fullTitle mB20";
    	div_o.appendChild(ul_o);

    	if($.isEmptyObject(sItem.items)) {
    		_hLog( "notFound: grade=" + (selectedInfo.gradeIndex-0+1) + ", textbookName="+ sItem.textbook_name + ", rootpartName=" + sItem.rootpart_name);
    	}


    	if(sItem.items) {
    		for(var i = 0; i < sItem.items.length; i++) {
    			var item = sItem.items[i];

    			var coreType_v = item.exPapr_CoreType;
    			var subject_v = item.subj_code;
    			var group_v = item.exPapr_group;

    			var isMathCalc = false;

    			var formatInfo = "2";
				var vod_type = "";
	            // 2:pdf, 3:scan, 4:hwp, 5:zip
				if (item.exPapr_group == "P" && item.exPapr_CoreType.substring(0,1) == "B") {  
					if (item.exPapr_CoreType == "B1") {
						//수학 단계별 학습관 Step1
						formatInfo = "2,90";
						vod_type = "Concept";
					} else {
						//수학 단계별 학습관
						formatInfo = "2,89";
						vod_type = "Tweezers";
					}

				}

	            var li_o = document.createElement("li");
	            li_o.setAttribute("data-no", item.exPapr_no);
				if (item.exPapr_group == "P" && (item.exPapr_CoreType == "B4" || item.exPapr_CoreType == "B5" || item.exPapr_CoreType == "B6")) {
					li_o.setAttribute("data-index", MathStepIndex);
					MathStepIndex++ ;
				}
	            li_o.setAttribute("data-siteid", item.siteid);
	            li_o.setAttribute("data-group", item.exPapr_group);
	            li_o.setAttribute("data-grade", item.grade);
	            li_o.setAttribute("data-subjcode", item.subj_code);
	            li_o.setAttribute("data-coretype", item.exPapr_CoreType);
	            li_o.setAttribute("data-tx", item.TX_CODE);
	            li_o.setAttribute("data-year", item.exPapr_testyear);
	            li_o.setAttribute("data-formats", formatInfo);
	            li_o.setAttribute("data-title", item.expapr_title);
				li_o.setAttribute("data-partnum", 1);
				li_o.setAttribute("data-type", vod_type);		// 영상 타입이 누락되어 추가 (정효태, 2022.03.28)
	            ul_o.appendChild(li_o);

	            if(true)
	            {

	            	var p_o = document.createElement("p");
					if (item.exPapr_group == "P") {
						if (item.exPapr_CoreType.substring(0,1) == "B") {
							//수학 단계별 학습관
							tag_v = "STEP"+item.exPapr_CoreType.substring(1,2)+" "+item.expapr_title.substr(item.expapr_title.indexOf("[")+1, item.expapr_title.indexOf("]")-1);

						} else if (item.exPapr_CoreType == "C1") {
							//수학교과서변형
							tag_v = "기본";
						} else {
							tag_v = "발전";
						}
					}
	            	p_o.className = "tag";
					if (item.exPapr_CoreType == "B4") {
	            		p_o.className = "tag step4";
					} else if (item.exPapr_CoreType == "B5") {
	            		p_o.className = "tag step5";
					} else if (item.exPapr_CoreType == "B6") {
	            		p_o.className = "tag step6";
					}
	            	p_o.innerHTML = "<span>" + tag_v + "</span>";
	            	li_o.appendChild(p_o);
	            }

	            if(true)
	            {
					if (item.expapr_title) {
						if (item.exPapr_group == "P" && item.exPapr_CoreType.substring(0,1) == "B") {
							if ((item.exPapr_CoreType == "B1") || (item.exPapr_CoreType == "B2")) {
								item.expapr_title = item.expapr_title.substr(item.expapr_title.indexOf("_(")+1, item.expapr_title.length);
							} else {
								item.expapr_title = item.expapr_title.replace(item.expapr_title.substr(0, item.expapr_title.indexOf("]")+2), "");
							}
							item.expapr_title = item.expapr_title.substr(0,item.expapr_title.indexOf("_"));
						} else {
							item.expapr_title = item.expapr_title.replace("[교과서변형] ", "");
							item.expapr_title = item.expapr_title.substr(0,item.expapr_title.indexOf("]_")+1);
						}
					}
	            	var p_o = document.createElement("p");
	            	p_o.className = "title";
	            	p_o.innerHTML = "<span>" + item.expapr_title + "</span>";
	            	li_o.appendChild(p_o);
	            }
				if (item.exPapr_group == "P" && (item.exPapr_CoreType == "B4" || item.exPapr_CoreType == "B5" || item.exPapr_CoreType == "B6")) {
					var p_o = document.createElement("p");
					p_o.className = "hash";
					var hash1 = "";
					var hash2 = "";
					if (item.exPapr_CoreType == "B4") {
						//서술형완성
						hash1 = "#중단원학습";
					} else if (item.exPapr_CoreType == "B5" || item.exPapr_CoreType == "B6") {
						//고난도완성 대단원완성
						hash1 = "#대단원학습";
					}
					hash2 = "#수학";
					p_o.innerHTML = "<span>"+hash1+"</span><span>"+hash2+"</span>";

					li_o.appendChild(p_o);
				} else if (item.exPapr_group == "P" && item.exPapr_CoreType.substring(0,1) == "C") {
					var p_o = document.createElement("p");
					p_o.className = "hash";
					hash1 = "#전학년";
					hash2 = "#수학";
					p_o.innerHTML = "<span>"+hash1+"</span><span>"+hash2+"</span>";
					li_o.appendChild(p_o);
				}
				{
					var p2_o = document.createElement("p");
					p2_o.className = "downLink";
					p2_o.innerHTML = '<a href="#" data-src="main" data-act="item_down"><em>다운로드</em><em>닫기</em><span class="down">'
								+ '<svg xmlns="http://www.w3.org/2000/svg" width="9" height="7" viewBox="0 0 9 7"><path id="triangle" data-name="triangle" d="M3.659,1.308a1,1,0,0,1,1.682,0L8.01,5.459A1,1,0,0,1,7.168,7H1.832A1,1,0,0,1,.99,5.459Z"/></svg>'
								+'</span></a>';
					li_o.appendChild(p2_o);
				}
			}
		}
		else {

			return null;
		}
		return div_o;
	};
	// Pro 관련 (e)

	var _createSubItems_Preparation = function(sItem, index_p) {
    	if(sItem == null ) return null;
    	var title_v = "";
    	var tag_v = "";		
		var sItem_index = sItem.rootpart_code;
    	var div_o = document.createElement("div");

    	div_o.className = "productBlock row";

		if(sItem_index > 101)
		{
			div_o.style.display = "none";
		}	

    	if($.isEmptyObject(sItem.items)) {
    		_hLog( "notFound: grade=" + (selectedInfo.gradeIndex-0+1) + ", textbookName="+ sItem.textbook_name + ", rootpartName=" + sItem.rootpart_name);
    	}

    	if(sItem.items) {
    		for(var i = 0; i < sItem.items.length; i++) {
    			var item = sItem.items[i];
    			var coreType_v = item.exPapr_CoreType;
    			var subject_v = item.subj_code;
    			var group_v = item.exPapr_group;
    			var isMathCalc = false;
    			var formatInfo = "2";
	            var li_o = document.createElement("li");
				
				if(coreType_v == "C")
				{
					if(i % 2 == 0) {	
						var parent = root.querySelector("#row_B");
						var div_o = document.createElement("div");
						title_v = "FINAL 모의고사";

						var p_o = document.createElement("p");
						p_o.className = "titleLine active";
						p_o.setAttribute("data-type", "C");
						p_o.style.fontWeight = "500";
						p_o.innerHTML = title_v;
						div_o.appendChild(p_o);

						var btn_o = document.createElement("button");
						btn_o.className = "toggle";
						btn_o.innerHTML = "접기/펼치기";						
						btn_o.setAttribute("data-src", _id);
						btn_o.setAttribute("data-act", "toggleGroup");
						p_o.appendChild(btn_o);
					}
				}
				else
				{
					if(sItem.items[0].subj_code == "KR")
					{
						if(item.TX_CODE == "M9KRCHA2006" || item.TX_CODE == "M9KRCHA3006") {
							title_v = sItem.items[i].add_title;						
							title_v = title_v.split('] ')[1];
							title_v = title_v.split(' [')[0];
						} else {
							title_v = sItem.items[i].expapr_title;
							title_v = title_v.split('] ')[1];
							title_v = title_v.split('_')[0];

							if (sItem.items[i].exPapr_CoreType == 'B' && sItem.items[i].grade == "1") {
								title_v = title_v.substr(4);
							}
						}	
					}
					else
					{
						title_v = sItem.items[i].add_title;
						title_v = title_v.split('] ')[1];
						title_v = title_v.split(' ' + sItem.items[0].Course_Name)[0];

						if(sItem.items[i].TX_CODE == "M9LSCHA0001" && sItem.items[i].add_title.includes("2025")) {
							title_v = title_v.replace("2025 ", "");
						}
					}

					if(subject_v != "EG" && subject_v != "LS" && subject_v != "ET" && subject_v != "TH")
					{
						var p_o = document.createElement("p");
						p_o.className = "listTitle";
						p_o.setAttribute("data-i", i);	
						p_o.innerHTML = title_v + '<a href="#" class="arrowToggle" data-src="main" data-act="toggleGroup" ><img src="../../img/ico_arrow_up.png" width="16.5" alt=""></a>';
						div_o.appendChild(p_o);
					}
				}

				var row_o = document.createElement("div");
    			row_o.className = "productBlock row";

				var ul_o = document.createElement("ul");
				ul_o.className = "bbsList fullTitle mB20";

				if (item.exPapr_CoreType == "C")
				{
					row_o.appendChild(ul_o);
				}
				else
				{
					div_o.appendChild(ul_o);
				}				

	            li_o.setAttribute("data-no", item.exPapr_no);				
	            li_o.setAttribute("data-siteid", item.siteid);
	            li_o.setAttribute("data-group", item.exPapr_group);
	            li_o.setAttribute("data-grade", item.grade);
	            li_o.setAttribute("data-subjcode", item.subj_code);
	            li_o.setAttribute("data-coretype", item.exPapr_CoreType);
	            li_o.setAttribute("data-tx", item.TX_CODE);
	            li_o.setAttribute("data-year", item.exPapr_testyear);
	            li_o.setAttribute("data-formats", formatInfo);
	            li_o.setAttribute("data-title", item.expapr_title);
				li_o.setAttribute("data-partnum", 1);
	            ul_o.appendChild(li_o);

	            var p_o = document.createElement("p");

				if(item.exPapr_CoreType == "A")
				{
					tag_v = "STEP1. 직전요약노트";
				}
				else if (item.exPapr_CoreType == "B")
				{					
					if(item.TX_CODE == "M9KRCHA2006" || item.TX_CODE == "M9KRCHA3006") {
						tag_v = "STEP1. 시험에 꼭 나오는 문제";
					} else {
						tag_v = "STEP2. 시험에 꼭 나오는 문제";
					}	
				}
				else if (item.exPapr_CoreType == "C")
				{
					if(item.TX_CODE == "M9KRCHA2006" || item.TX_CODE == "M9KRCHA3006") {
						tag_v = "STEP2. FINAL 모의고사";
					} else {
						tag_v = "STEP3. FINAL 모의고사";
					}
				}

				p_o.className = "tag";
				p_o.innerHTML = "<span>" + tag_v + "</span>";				

				if (item.exPapr_CoreType == "C")
				{
					if(item.subj_code == 'MT' || item.subj_code == 'SC')
					{
						if (item.expapr_title.includes("_기본"))
						{
							tag_v = "기본";
						}
						else
						{
							tag_v = "발전";
						}
					}
					else
					{
						if (item.expapr_title.includes("_1회"))
						{
							tag_v = "1회";
						}
						else
						{
							tag_v = "2회";
						}
					}

					p_o.innerHTML = p_o.innerHTML + "<span>" + tag_v + "</span>";
				}

				li_o.appendChild(p_o);

				var p_o = document.createElement("p");
				p_o.className = "title";

				if (item.exPapr_CoreType == "C")
				{
					title_v = item.expapr_title;
					title_v = title_v.split('] ')[1];
					title_v = title_v.split('[Q]')[0];
					title_v = title_v.replace(" 대비", "고사 대비");
					title_v = title_v.split(sItem.items[0].Course_Name)[0];
					title_v = title_v.replace(title_v.slice(-3), "");
					title_v = title_v + " FINAL 모의고사";

					p_o.innerHTML = "<span>" + title_v + "</span>";
				}
				else
				{
					p_o.innerHTML = "<span>" + title_v + "</span>";
				}
				
				li_o.appendChild(p_o);
				
				var p2_o = document.createElement("p");
				p2_o.className = "downLink";

				p2_o.innerHTML = '<a href="#" data-src="main" data-act="item_down"><em>다운로드</em><em>닫기</em><span class="down">'
						+ '<svg xmlns="http://www.w3.org/2000/svg" width="9" height="7" viewBox="0 0 9 7"><path id="triangle" data-name="triangle" d="M3.659,1.308a1,1,0,0,1,1.682,0L8.01,5.459A1,1,0,0,1,7.168,7H1.832A1,1,0,0,1,.99,5.459Z"/></svg>'
						+'</span></a>';
				
				li_o.appendChild(p2_o);

				if (item.exPapr_CoreType == "C")
				{
					div_o.appendChild(row_o);
				}
			}
		}
		else {

			return null;
		}
		return div_o;
	};

    // 리스트 그리기 ( 그룹 )
    var _createSubItems = function(sItem, index_p) {
    	if(sItem == null ) return null;
    	var title_v = "";
    	var tag_v = "";
    	if(index_p < 0) {
    		var title_t = sItem.rootpart_name;
    		title_v = sItem.rootpart_code + ". " + title_t;
    	}
    	else {
    		var title_t = sItem.subpart_name;
    		title_v = sItem.rootpart_code + "." + sItem.subpart_code + " " + title_t;
    	}

    	var div_o = document.createElement("div");
    	div_o.className = "productBlock row";

    	//if(index_p >= 0) {
		if(index_p >= 0 && title_t != "복합") {
    		var p_o = document.createElement("p");
    		p_o.className = "listTitle";
    		p_o.innerHTML = title_v + '<a href="#" class="arrowToggle" data-src="main" data-act="toggleGroup" ><img src="../img/ico_arrow_up.png" width="16.5" alt=""></a>';
    		div_o.appendChild(p_o);
    	}

    	var ul_o = document.createElement("ul");
    	ul_o.className = "bbsList fullTitle mB20";
    	div_o.appendChild(ul_o);

    	if($.isEmptyObject(sItem.items)) {
    		_hLog( "notFound: grade=" + (selectedInfo.gradeIndex-0+1) + ", textbookName="+ sItem.textbook_name + ", rootpartName=" + sItem.rootpart_name);
    	}


    	if(sItem.items) {
    		for(var i = 0; i < sItem.items.length; i++) {
    			var item = sItem.items[i];
				var li_o = document.createElement("li");

    			var coreType_v = item.exPapr_CoreType;
    			var subject_v = item.subj_code;
    			var group_v = item.exPapr_group;

    			var isMathCalc = false;

    			var formatInfo = "";
	            // 2:pdf, 3:scan, 4:hwp, 5:zip
	            if(item.HWP2002 != "NONE") formatInfo = "4";
	            if(item.PDF && item.PDF != "NONE") {
	            	if(formatInfo != "") formatInfo = formatInfo + ",";
	            	formatInfo = formatInfo + "2";
	            }
	            if(item.SCAN && item.SCAN != "NONE") {
	            	if(formatInfo != "") formatInfo = formatInfo + ",";
	            	formatInfo = formatInfo + "3";
	            }
	            if(item.ZIP && item.ZIP != "NONE") {
	            	if(formatInfo != "") formatInfo = formatInfo + ",";
	            	formatInfo = formatInfo + "5";
	            }

	            if(coreType_v.substring(0,1) == "B" && subject_v == "MT" && group_v == "K") {
	            	isMathCalc = true;
	            	formatInfo = "2";
	            }

	            if(item.vodProb && item.vodProb.length > 0) {
	            	if(formatInfo != null) formatInfo = formatInfo + ",";
	            	formatInfo = formatInfo + "94";

	            	var probItem = item.vodProb[0];

	            	li_o.setAttribute("data-code", probItem.Code);
	            	li_o.setAttribute("data-type", "Tweezers");
	            	li_o.setAttribute("data-revodstate", probItem.ReVodState);
	            }

	            if(item.expapr_title.indexOf("[Q]") > -1){
	            	if(formatInfo != "") formatInfo = formatInfo + ",";
	            	formatInfo = formatInfo + "97";
	            }

	            li_o.setAttribute("data-no", item.exPapr_no);
	            li_o.setAttribute("data-siteid", item.siteid);
	            li_o.setAttribute("data-group", item.exPapr_group);
	            li_o.setAttribute("data-grade", item.grade);
	            li_o.setAttribute("data-subjcode", item.subj_code);
	            li_o.setAttribute("data-coretype", item.exPapr_CoreType);
	            li_o.setAttribute("data-tx", item.TX_CODE);
	            li_o.setAttribute("data-year", item.exPapr_testyear);
	            li_o.setAttribute("data-formats", formatInfo);
	            //li_o.setAttribute("data-title", item.expapr_title);
	            if(isMathCalc) {
					li_o.setAttribute("data-title", item.add_title);
				} else {
					li_o.setAttribute("data-title", item.expapr_title);
				}
	            if(item.vodProb && item.vodProb.length>0) {
	            	li_o.setAttribute("data-code", item.vodProb[0].Code);
	            }
	            ul_o.appendChild(li_o);

	            if(true)
	            {
	            	title_v = item.expapr_title;
	            	if(isMathCalc) {
	            		//tag_v = "공통학기";
						title_v = item.add_title;
						tag_v = "계산력 연습"; //item.add_attr3;
	            	} else if(title_v.indexOf("]")) {
	            		tag_v = title_v.substring(0, title_v.indexOf("]") + 1);
	            		tag_v = tag_v.replace("[", "").replace("]", "");
	            	}

	            	var p_o = document.createElement("p");
	            	p_o.className = "tag";
	            	p_o.innerHTML = "<span>" + tag_v + "</span>";
	            	li_o.appendChild(p_o);
	            	if(false) {
	            		if(common.isPremium(item.expapr_title)) {
	            			p_o.innerHTML = p_o.innerHTML + "<span>프리미엄</span>";
	            		}
	            	}
	            }

	            if(true)
	            {
					var split_eng_title = "";
				
					if(item.grade == "1" && item.subj_code == "EG" && item.exPapr_group == "H") {
						split_eng_title = item.expapr_title.split("step")[1];
						split_eng_title = 'step' + split_eng_title;
					}

					if(split_eng_title != "") {
						title_v = split_eng_title;
					}

	            	var p_o = document.createElement("p");
	            	p_o.className = "title";
	            	p_o.innerHTML = "<span>" + title_v + "</span>";
	            	li_o.appendChild(p_o);
	            }

	            if(true && item.exPapr_no)
	            {
	            	var p_o = document.createElement("p");
	            	p_o.className = "hash";
	            	var key_v = null;
	            	key_v = _site_id + item.grade;
	            	var hash1 = "#" + _categorySub[key_v].title;
	            	var hash2 = "#" + item.subj_name;
	            	var hash3 = "#" + item.pub_name;
	            	p_o.innerHTML = "<span>"+hash1+"</span><span>"+hash2+"</span><span>" + hash3 + "</span>";
	            	li_o.appendChild(p_o);
	            }

				// if(false)
				{
					var p2_o = document.createElement("p");
					p2_o.className = "downLink";
					p2_o.innerHTML = '<a href="#" data-src="main" data-act="item_down"><em>다운로드</em><em>닫기</em><span class="down">'
								+ '<svg xmlns="http://www.w3.org/2000/svg" width="9" height="7" viewBox="0 0 9 7"><path id="triangle" data-name="triangle" d="M3.659,1.308a1,1,0,0,1,1.682,0L8.01,5.459A1,1,0,0,1,7.168,7H1.832A1,1,0,0,1,.99,5.459Z"/></svg>'
								+'</span></a>';
					li_o.appendChild(p2_o);
				}
				{
					var p_o = document.createElement("p");
					p_o.className = "listMenu";
					{
						var button_o = document.createElement("button");
						button_o.type = "button";
						button_o.setAttribute("data-src", "main");
						button_o.setAttribute("data-act", "errorPopup");
						{
							var img_o = document.createElement("img");
							img_o.src = "/img/ico_menu.png";
							img_o.setAttribute("width", "34");
							button_o.appendChild(img_o);
						}
						p_o.appendChild(button_o);
					}
					li_o.appendChild(p_o);
				}
				if (true){
					var vodConcept = item.vodConcept;
					if(vodConcept && vodConcept.length>0) {
						for(var k=0; k<vodConcept.length; k++) {
							var vodItem = util.keysToLowerCase(vodConcept[k]);
							var li_o = document.createElement("li");
							li_o.setAttribute("data-no", item.exPapr_no);
							li_o.setAttribute("data-type", "Concept");

							li_o.setAttribute("data-curr", vodItem.curri_idx);
							li_o.setAttribute("data-code", vodItem.code);
							li_o.setAttribute("data-siteid", item.siteid);
							li_o.setAttribute("data-grade", item.grade);
							li_o.setAttribute("data-subjcode", item.subj_code);
							li_o.setAttribute("data-name", vodItem.file_name);
							ul_o.appendChild(li_o);

							var p_o = document.createElement("p");
							p_o.className = "tag";
							p_o.innerHTML = "<span>" + tag_v + "</span>";
							li_o.appendChild(p_o);

							p_o = document.createElement("p");
							p_o.className = "title";
							var vCurIdx = vodItem.curri_idx;
							var vTitle_v = vCurIdx + "강. "+ vodItem.open_title;
							p_o.innerHTML = "<span>" + vTitle_v + "</span>";
							li_o.appendChild(p_o);

							var p_o = document.createElement("p");
							p_o.className = "hash";
							var key_v = null;
							key_v = _site_id + item.grade;
							var hash1 = "#" + _categorySub[key_v].title;
							var hash2 = "#" + item.subj_name;
							var hash3 = "#" + item.pub_name;
							p_o.innerHTML = "<span>"+hash1+"</span><span>"+hash2+"</span><span>" + hash3 + "</span>";
							li_o.appendChild(p_o);
							// vod play 버튼 붙이기

							p_o = document.createElement("p");
							p_o.className = "renewal-video";//리뉴얼 아이콘 class명 변경(EDUMIG-3409)
							if(vodItem.revodstate == "Y"){
								//p_o.innerHTML = "<a href='javascript:;' data-src='vod_player' data-act='video_down'>개념영상<br/>다시보기</a>";
								p_o.innerHTML = _Unit.drawVodButtonDetail("concept", "reconfirm", "개념");
							}
							else{
								//p_o.innerHTML = "<a href='javascript:;' data-src='vod_player' data-act='video_down'>개념영상<br/><span class='num'>" + util.toNumber(_downPrice["VOD"]["concept_m"]) + "</span></a>";
								p_o.innerHTML = _Unit.drawVodButtonDetail("concept", "", "개념");
							}
							li_o.appendChild(p_o);
						}
					}
				}
			}
		}
		else {

			return null;
		}
		return div_o;
	};

	// 단원문제 탭 리스트 그리기
	var _drawItem_1 = function(item, index_p) {
		var ul_o = root.querySelector("#list_A");

		var formatInfo = "";
  //       // 2:pdf, 3:scan, 4:hwp, 5:zip
  if(item.HWP2002 != "NONE") formatInfo = "4";
  if(item.PDF && item.PDF != "NONE") {
  	if(formatInfo != "") formatInfo = formatInfo + ",";
  	formatInfo = formatInfo + "2";
  }
  if(item.SCAN && item.SCAN != "NONE") {
  	if(formatInfo != "") formatInfo = formatInfo + ",";
  	formatInfo = formatInfo + "3";
  }
  if(item.ZIP && item.ZIP != "NONE") {
  	if(formatInfo != "") formatInfo = formatInfo + ",";
  	formatInfo = formatInfo + "5";
  }

  if(item.exPapr_group == "K") {
  	if(item.subj_code == "MT") {
	        	if(item.exPapr_CoreType.substring(0,1) == "B") {	// 수학 계산력 문제.
	        		formatInfo = "2";
	        	}
	        }
	    }

	    if(item.expapr_title.indexOf("[Q]") > -1){
	    	if(formatInfo != "") formatInfo = formatInfo + ",";
	    	formatInfo = formatInfo + "97";
	    }

	    var li_o = document.createElement("li");
	    li_o.setAttribute("data-no", item.exPapr_no);
	    li_o.setAttribute("data-siteid", item.siteid);
	    li_o.setAttribute("data-group", item.exPapr_group);
	    li_o.setAttribute("data-grade", item.grade);
	    li_o.setAttribute("data-subjcode", item.subj_code);
	    li_o.setAttribute("data-coretype", item.exPapr_CoreType);
	    li_o.setAttribute("data-tx", item.TX_CODE);
	    li_o.setAttribute("data-year", item.exPapr_testyear);
	    li_o.setAttribute("data-formats", formatInfo);

		if (item.exPapr_group == "K" && item.exPapr_CoreType.substring(0,1) == "P") {
			li_o.setAttribute("data-title", item.add_title);
		} else {
			li_o.setAttribute("data-title", item.expapr_title);
		}
	    ul_o.appendChild(li_o);


	    {
	    	var p_o = document.createElement("p");
	    	p_o.className = "tag";
	    	var tag_v = "공통학기";
	    	var cutCoreType = item.exPapr_CoreType.substring(0,1);
			if(cutCoreType != "B" && cutCoreType != "P" && cutCoreType != "O") { // B: 수학계산력 (수의연산, 문자와식) 등등 P: 국어작품별, O: 국어문법
				tag_v = _getTermName(item.exPapr_Term, item.exPapr_MidEnd);
			}
			p_o.innerHTML = "<span>" + tag_v + "</span>";
			li_o.appendChild(p_o);
			if(common.isPremium(item.expapr_title)) {
				p_o.innerHTML = p_o.innerHTML + "<span>프리미엄</span>";
			}

			//국어작품별 문제
			if (item.exPapr_group == "K" && item.exPapr_CoreType.substring(0,1) == "P") {
				p_o.innerHTML = "<span>" + item.add_attr1 + "</span>";
				p_o.innerHTML = p_o.innerHTML + "<span>" + item.add_attr2 + "</span>";
			}
		}
		{
			var p_o = document.createElement("p");
			p_o.className = "title";
			var title_v = item.expapr_title;
			if (item.exPapr_group == "K" && item.exPapr_CoreType.substring(0,1) == "P") {
				title_v = item.add_title;
			}
			p_o.innerHTML = "<span>" + title_v + "</span>";
			li_o.appendChild(p_o);
		}
		{
			var p_o = document.createElement("p");
			p_o.className = "hash";
			var key_v = null;
			key_v = _site_id + item.grade;

			var hash1 = "#" + _categorySub[key_v].title;
			var hash2 = "#" + item.subj_name;
			var hash3 = "";
			if(item.pub_name) hash3 = "<span>#" + item.pub_name + "</span>";

			p_o.innerHTML = "<span>"+hash1+"</span><span>"+hash2+"</span>" + hash3;
			li_o.appendChild(p_o);

		}
		{
			var p_o = document.createElement("p");
			p_o.className = "downLink";
			p_o.innerHTML = '<a href="#" data-src="main" data-act="item_down"><em>다운로드</em><em>닫기</em><span class="down">'
						+ '<svg xmlns="http://www.w3.org/2000/svg" width="9" height="7" viewBox="0 0 9 7"><path id="triangle" data-name="triangle" d="M3.659,1.308a1,1,0,0,1,1.682,0L8.01,5.459A1,1,0,0,1,7.168,7H1.832A1,1,0,0,1,.99,5.459Z"/></svg>'
						+'</span></a>';
			li_o.appendChild(p_o);
		}
		{
			var p_o = document.createElement("p");
			p_o.className = "listMenu";
			{
				var button_o = document.createElement("button");
				button_o.type = "button";
				button_o.setAttribute("data-src", "main");
				button_o.setAttribute("data-act", "errorPopup");
				{
					var img_o = document.createElement("img");
					img_o.src = "/img/ico_menu.png";
					img_o.setAttribute("width", "34");
					button_o.appendChild(img_o);
				}
				p_o.appendChild(button_o);
			}
			li_o.appendChild(p_o);
		}
	};

	var _drawItem_V = function(item, index_p) {
		var ul_o = root.querySelector("#list_A");
		var formatInfo = "2";
        var group_v = pop2TypeItems[selectedInfo.type2Index].value;
	    var li_o = document.createElement("li");
		var isRedownLastChk_v;
		var url_v = "/Member/reDown_Chk_V.asp";
		var data_v = "ExPapr_No=" + item.exPapr_no;
			data_v = data_v + "&Part_ID_Set=" + document.getElementById("part_ID").value;
			data_v = data_v + "&exam_Index=" + (index_p + 1);				

	    comm.send(url_v, data_v, "POST", function(json) 
		{
			isRedownLastChk_v = json.isRedownLastChk;

			if(isRedownLastChk_v == 0)
			{
				li_o.classList.add("downloaded");
			}
		});

		li_o.setAttribute("data-no", item.exPapr_no);
	    li_o.setAttribute("data-siteid", item.siteid);
	    li_o.setAttribute("data-group", item.exPapr_group);
	    li_o.setAttribute("data-grade", item.grade);
	    li_o.setAttribute("data-subjcode", item.subj_code);
	    li_o.setAttribute("data-coretype", item.exPapr_CoreType);
	    li_o.setAttribute("data-tx", item.TX_CODE);
	    li_o.setAttribute("data-sclid", item.scl_id);
		li_o.setAttribute("data-title", item.expapr_title);
	    li_o.setAttribute("data-formats", "2");
		li_o.setAttribute("data-exam-index", (index_p + 1));		
	    ul_o.appendChild(li_o);			 

		{
			var p_o = document.createElement("p");
			p_o.className = "title";
			var title_v = item.expapr_title + ' ' + (index_p + 1) + '회';
			p_o.innerHTML = "<span>" + title_v + "</span>";
			li_o.appendChild(p_o);
		}

	    {
	    	var p_o = document.createElement("p");
	    	p_o.className = "hash";
	    	var key_v = null;
	    	key_v = _site_id + item.grade;
	    	var hash1 = "#" + _categorySub[key_v].title;
	    	var hash2 = "#" + item.tx_name;
			p_o.innerHTML = "<span>"+hash1+"</span><span>"+hash2+"</span>";

			li_o.appendChild(p_o);
		}
		{
			var p_o = document.createElement("p");
			p_o.className = "downLink";
			p_o.innerHTML = '<a href="#" data-src="main" data-act="item_down_V"><em>다운로드</em><em>닫기</em><span class="down" id='+(index_p + 1)+'>'
						+ '<svg xmlns="http://www.w3.org/2000/svg" width="9" height="7" viewBox="0 0 9 7"><path id="triangle" data-name="triangle" d="M3.659,1.308a1,1,0,0,1,1.682,0L8.01,5.459A1,1,0,0,1,7.168,7H1.832A1,1,0,0,1,.99,5.459Z"/></svg>'
						+'</span></a>';
			li_o.appendChild(p_o);
		}
		{
			var p_o = document.createElement("p");
			p_o.className = "listMenu";
			{
				var button_o = document.createElement("button");
				button_o.type = "button";
				button_o.setAttribute("data-src", "main");
				button_o.setAttribute("data-act", "errorPopup");
				{
					var img_o = document.createElement("img");
					img_o.src = "/img/ico_menu.png";
					img_o.setAttribute("width", "34");
					button_o.appendChild(img_o);
				}
				p_o.appendChild(button_o);
			}
			li_o.appendChild(p_o);
		}
	};

	// 학교별 족보 탭 리스트 그리기
	var _drawItem_2 = function(item, index_p) {
		var ul_o = root.querySelector("#list_A");
		var formatInfo = "";

		if(item.exPapr_group == "A" && item.exPapr_CoreType == "B") {
			item.HWP2002 = "NONE";
		}

        // 2:pdf, 3:scan, 4:hwp, 5:zip
        if(item.HWP2002 != "NONE") formatInfo = "4";
        if(item.PDF && item.PDF != "NONE") {
        	if(formatInfo != "") formatInfo = formatInfo + ",";
        	formatInfo = formatInfo + "2";
        }

		// 학교별 기출유사인 경우 기존 2회차 숨기기 위해 SCAN 은 제공 안함
        //if(item.SCAN && item.SCAN != "NONE") {
		if(item.exPapr_CoreType != "B" && item.SCAN && item.SCAN != "NONE") {
        	if(formatInfo != "") formatInfo = formatInfo + ",";
        	formatInfo = formatInfo + "3";
        }
        if(item.ZIP && item.ZIP != "NONE") {
        	if(formatInfo != "") formatInfo = formatInfo + ",";
        	formatInfo = formatInfo + "5";
        }

        var group_v = pop2TypeItems[selectedInfo.type2Index].value;
        if(group_v == "V" || group_v == "W")	{	// 예상족보, AI 기출변형.
        	if(item.PDF && item.PDF != "NONE") {
        		formatInfo = "2";
        	}
        }
        else if(group_v == "I")	{	// 지역별
        	if(item.PDF && item.PDF != "NONE") {
        		formatInfo = "2";
        	}
        }

        if((group_v == "A" || group_v == "")) {
        	if(formatInfo == "3"){
	        	// 정답요청
	        	formatInfo = formatInfo + ",96";
	        }
	    }

	    if(selectedInfo.menuIndex == 2 && group_v != "V"){
	    	if(item.expapr_title.indexOf("[Q]") > -1){
	    		if(formatInfo != "") formatInfo = formatInfo + ",";
	    		formatInfo = formatInfo + "97";
	    	}
	    }

	    var li_o = document.createElement("li");
	    li_o.setAttribute("data-no", item.exPapr_no);
	    li_o.setAttribute("data-siteid", item.siteid);
	    li_o.setAttribute("data-group", item.exPapr_group);
	    li_o.setAttribute("data-grade", item.grade);
	    li_o.setAttribute("data-subjcode", item.subj_code);
	    li_o.setAttribute("data-coretype", item.exPapr_CoreType);
	    li_o.setAttribute("data-tx", item.TX_CODE);
	    li_o.setAttribute("data-year", item.exPapr_testyear);
	    li_o.setAttribute("data-sclid", item.scl_id);
		if (group_v == "I") {	// 지역별문제
		    li_o.setAttribute("data-title", item.add_title);
		} else {
		    li_o.setAttribute("data-title", item.expapr_title);
		}
	    li_o.setAttribute("data-formats", formatInfo);

		if (group_v == "A") { //학교별 기출족보
		    li_o.setAttribute("data-sclid", item.scl_id);
		    li_o.setAttribute("data-midandterm", item.exPapr_Term + item.exPapr_MidEnd);
		    li_o.setAttribute("data-txname", item.tx_name);
		    li_o.setAttribute("data-TXCODE", item.TX_CODE);
		}
	    ul_o.appendChild(li_o);

	    {
	    	var p_o = document.createElement("p");
	    	p_o.className = "tag";
			if (group_v == "I") {	// 지역별문제
				p_o.innerHTML = "<span>" + item.add_attr1 + "</span>";
				p_o.innerHTML = p_o.innerHTML + "<span>" + item.add_attr2 + "</span>";
			} else {
		    	p_o.innerHTML = "<span>" + _getTermName(item.exPapr_Term, item.exPapr_MidEnd) + "</span>";
			}
	    	li_o.appendChild(p_o);
	    	if(common.isPremium(item.expapr_title)) {
	    		p_o.innerHTML = p_o.innerHTML + "<span>프리미엄</span>";
	    	}
	    }
	    {
	    	var p_o = document.createElement("p");
	    	p_o.className = "title";
	    	var title_v = item.expapr_title;
	    	title_v = title_v.replace("[" + item.Menu_Parse + "]", item.pub_name);
			if (group_v == "I") {	// 지역별문제
				title_v = item.add_title;
			}
	    	p_o.innerHTML = "<span>" + title_v + "</span>";
	    	li_o.appendChild(p_o);
	    }
	    {
	    	var p_o = document.createElement("p");
	    	p_o.className = "hash";
	    	var key_v = null;
	    	key_v = _site_id + item.grade;
	    	var hash1 = "#" + _categorySub[key_v].title;
	    	var hash2 = "#" + item.tx_name;
			// var hash3 = "#" + item.pub_name;
			p_o.innerHTML = "<span>"+hash1+"</span><span>"+hash2+"</span>";

			li_o.appendChild(p_o);
		}
		{
			var p_o = document.createElement("p");
			p_o.className = "downLink";
			p_o.innerHTML = '<a href="#" data-src="main" data-act="item_down"><em>다운로드</em><em>닫기</em><span class="down">'
						+ '<svg xmlns="http://www.w3.org/2000/svg" width="9" height="7" viewBox="0 0 9 7"><path id="triangle" data-name="triangle" d="M3.659,1.308a1,1,0,0,1,1.682,0L8.01,5.459A1,1,0,0,1,7.168,7H1.832A1,1,0,0,1,.99,5.459Z"/></svg>'
						+'</span></a>';
			li_o.appendChild(p_o);
		}
		{
			var p_o = document.createElement("p");
			p_o.className = "listMenu";
			{
				var button_o = document.createElement("button");
				button_o.type = "button";
				button_o.setAttribute("data-src", "main");
				button_o.setAttribute("data-act", "errorPopup");
				{
					var img_o = document.createElement("img");
					img_o.src = "/img/ico_menu.png";
					img_o.setAttribute("width", "34");
					button_o.appendChild(img_o);
				}
				p_o.appendChild(button_o);
			}
			li_o.appendChild(p_o);
		}
	};

	var _draw_FreeReding = function(item, index_p) {
		var ul_o = root.querySelector("#list_A");
		var title;
		var MidEnd_Val;
		var vScl_ID = sch2Items[selectedInfo.sch2Index].Scl_ID;
		var vScl_Name = sch2Items[selectedInfo.sch2Index].Name;
		var vGrade = popGrade2Items[selectedInfo.grade2Index].value;
		var vSubjcode = popSubjectItems[selectedInfo.subject2Index].Value;
		var vYear = popYearItems[selectedInfo.year2Index].Value;;
		var vMidEnd = termItems[selectedInfo.term2Index].Value;
        var group_v = pop2TypeItems[selectedInfo.type2Index].value;
	    var li_o = document.createElement("li");

		li_o.setAttribute("data-siteid", "M");
	    li_o.setAttribute("data-Scl_ID", item.scl_id);
	    li_o.setAttribute("data-Scl_Name", escape(item.scl_name));
	    li_o.setAttribute("data-Grade", item.grade);
	    li_o.setAttribute("data-Subj_Code", item.subj_code);
	    li_o.setAttribute("data-tx", item.TX_CODE);
	    li_o.setAttribute("data-ExPapr_TestYear", item.exPapr_testyear);
	    li_o.setAttribute("data-ExPapr_MidEndTerm", item.exPapr_Term + item.exPapr_MidEnd);
		li_o.setAttribute("data-TX_Name", item.tx_name);
		li_o.setAttribute("data-sub_TX_CODE", item.TX_CODE);

	    ul_o.appendChild(li_o);

	    {
			var p_o = document.createElement("p");
			p_o.className = "title";
	    	var title_v = item.expapr_title;
	    	title_v = title_v.replace("[" + item.Menu_Parse + "]", item.pub_name);
	    	p_o.innerHTML = "<span>" + title_v + "</span>";
			li_o.appendChild(p_o);
		}
		{
			var p_o = document.createElement("p");
			p_o.className = "downLink";
			p_o.innerHTML = '<a href="#" data-src="main" data-act="viewer" class="free-chk">무료로 확인</a>';
			li_o.appendChild(p_o);
		}
	};

	// 고득점 마스터 리스트 그리기
	var _drawItem_3 = function(item_p, index_p) {

		var row_A = root.querySelector("#row_A");
		var row_C = root.querySelector("#row_C");
		var parent_o = null;
		var ul_o = null;

		var mItem = util.keysToLowerCase(item_p);

		var title_v = mItem.open_title;

		if(selectedInfo.sub3Index ==1) {
			var part_v = mItem.part;
			if(mItem.part == "최다오답") {
				part_v = "만점도전";
			}
			title_v = "Step" + mItem.step + ". " + part_v;
		}

		if(title_v == "" || title_v == null) {
			title_v = mIte.expapr_title;
		}

		if(mItem.pdf) {
	    	// 중단원이 존재하지 않는 경우
	    	// 일반 리스트 처럼 드로잉
	    	row_A = root.querySelector("#row_A");

	    	ul_o = row_A.querySelector("#list_A");

	    	_drawItem_3_0(mItem, ul_o, "A");
	    } else {
	    	// 중단원이 존재하는 경우
	    	// 그룹핑 해서 드로잉
	    	parent_o = row_C.querySelector(".productBlock");

	    	var r_o = document.createElement("div");
	    	r_o.className = "productBlock";
	    	parent_o.appendChild(r_o);

	    	var subList = mItem.sublist;
	    	if(subList == null) {
	    		subList = mItem.list;
	    	}

	    	var ul_o = null;

	    	var p_o = document.createElement("p");
	    	p_o.className = "listTitle";
	    	p_o.innerHTML = title_v + '<a href="#" data-src="main" data-act="toggleGroup" class="arrowToggle"><img src="../img/ico_arrow_up.png" width="16.5" alt=""></a>';;
	    	r_o.appendChild(p_o);

	    	if(selectedInfo.sub3Index == 1) {
	    		ul_o = document.createElement("ul");
	    		ul_o.className = "bbsList fullTitle mB20";
	    		r_o.appendChild(ul_o);
	    	}

	    	if(subList) {
	    		for(var i=0; i<subList.length; i++) {
	    			var subItem = subList[i];
	    			if(selectedInfo.sub3Index == 0) {
	    				ul_o = document.createElement("ul");
	    				ul_o.className = "bbsList fullTitle mB20";
	    				r_o.appendChild(ul_o);
	    				_drawItem_3_0(subItem, ul_o);
	    			} else {
	    				_drawItem_3_0(subItem, ul_o);
	    			}
	    		}
	    	}
	    }
	};

	// 고득점 마스터 목록 그리기
	var _drawItem_3_0 = function(item_p, ul_p){
		var sItem = item_p;
		var li_o = document.createElement("li");
		sItem = util.keysToLowerCase(sItem);

		var ul_o = null;

		ul_o = ul_p;

		// PDF 			Group/CoreType
		// 개념완성 1250	H/S
		// 본문학습 1250 	H/V
		// 기초문제 1050	C/''
		// 대표유형 1050 	H/C
		// 요점정리 1250 	H/S
		// 암기노트 1250	H/V

		var formatInfo = "";
		var vodConcept = sItem.vodconcept;

		if(sItem.hwp2002 && sItem.hwp2002 != "NONE") formatInfo = "4";
		if(sItem.pdf && sItem.pdf != "NONE") {
			if(formatInfo != "") formatInfo = formatInfo + ",";
			formatInfo = formatInfo + "2";
		}
		if(sItem.scan && sItem.scan != "NONE") {
			if(formatInfo != "") formatInfo = formatInfo + ",";
			formatInfo = formatInfo + "3";
		}
		if(sItem.zip && sItem.zip != "NONE") {
			if(formatInfo != "") formatInfo = formatInfo + ",";
			formatInfo = formatInfo + "5";
		}

		if(sItem.vod == "Y") {
			// 고득점마스터 vod 버튼
			if(formatInfo != "") formatInfo = formatInfo + ",";
			formatInfo = formatInfo + "94";
			li_o.setAttribute("data-type", "Tweezers");
			li_o.setAttribute("data-code", "");
			if(sItem.revodstate == "Y"){
				li_o.setAttribute("data-revodstate", "Y");
			}
		}
		_hLog("sItem:");_hLog(sItem);

		var part = sItem.part;
		var partnum = "";
		switch(part){
			case "요점정리" : partnum = "ico_Ct_point"; break;
			case "암기노트" : partnum = "ico_Ct_memorizing"; break;
			case "대표유형" : partnum = "ico_Ct_Representative"; break;
			case "본문학습" : partnum = "ico_Ct_text"; break;
			case "기초문제" : partnum = "ico_Ct_basic"; break;
			case "개념완성" : partnum = "ico_Ct_Concept"; break;
			case "소단원" : partnum = "ico_white"; break;
			default : partnum = "ico_Ct_basic"; break;
		}

		li_o.setAttribute("data-no", sItem.expapr_no);
		li_o.setAttribute("data-siteid", sItem.siteid);
		li_o.setAttribute("data-group", "H");
		li_o.setAttribute("data-grade", sItem.grade);
		li_o.setAttribute("data-subjcode", sItem.subj_code);
		li_o.setAttribute("data-coretype", sItem.expapr_coretype);
		li_o.setAttribute("data-tx", sItem.tx_code);
		li_o.setAttribute("data-year", sItem.expapr_testyear);
		li_o.setAttribute("data-formats", formatInfo);
		li_o.setAttribute("data-title", stitle_v);

		if(part == "대표유형"){
			li_o.setAttribute("data-name", sItem.expapr_title);
			li_o.setAttribute("data-type", "Tweezers");
			li_o.setAttribute("data-partnum", partnum);
		}

		ul_o.appendChild(li_o);

		if(sItem.expapr_no != "" ) {
			var p_o = document.createElement("p");
			p_o.className = "tag";
			var part_v = sItem.part;
			if(sItem.part=="최다오답") {
				part_v = "만점도전";
			}
			p_o.innerHTML = "<span>" + part_v + "</span>";
			li_o.appendChild(p_o);
		}
		{
			var p_o = document.createElement("p");
			p_o.className = "title";
			var stitle_v = sItem.open_title;
			if(stitle_v == "" || stitle_v == "1") {
				stitle_v = sItem.expapr_title;
			}


			p_o.innerHTML = stitle_v;
			li_o.appendChild(p_o);
		}
		if(sItem.expapr_no) {
			var p_o = document.createElement("p");
			p_o.className = "hash";

			if(sItem.grade) {
				var key_v = _site_id + sItem.grade;
				p_o.innerHTML = "<span>#"+_categorySub[key_v].title;+"</span>";
			}

			var hash2 = subject3Items[selectedInfo.subject3Index].Name;
			var hash3 = tx3Items[selectedInfo.tx3Index].Name;
			var hash4 = sItem.downcount;

			if(hash2) p_o.innerHTML += "<span>#" + hash2 +"</span>";
			if(hash3) p_o.innerHTML += "<span>#" + hash3 +"</span>";
			if(hash4) p_o.innerHTML += "<span>#다운로드 " + hash4 + "</span>";

			li_o.appendChild(p_o);
		}
		if (sItem.rank) {
			var p_o = document.createElement("p");
			p_o.className = "rank";
			p_o.innerHTML = "<span class='rank01'>"+sItem.rank+"위</span>";
			li_o.appendChild(p_o);
		}
		if (sItem.expapr_no){
			var p_o = document.createElement("p");
			p_o.className = "downLink";
			p_o.innerHTML = '<a href="#" data-src="main" data-act="item_down"><em>다운로드</em><em>닫기</em><span class="down">'
						+ '<svg xmlns="http://www.w3.org/2000/svg" width="9" height="7" viewBox="0 0 9 7"><path id="triangle" data-name="triangle" d="M3.659,1.308a1,1,0,0,1,1.682,0L8.01,5.459A1,1,0,0,1,7.168,7H1.832A1,1,0,0,1,.99,5.459Z"/></svg>'
						+'</span></a>';
			li_o.appendChild(p_o);

			var p_o = document.createElement("p");
			p_o.className = "listMenu";
			{
				var button_o = document.createElement("button");
				button_o.type = "button";
				button_o.setAttribute("data-src", "main");
				button_o.setAttribute("data-act", "errorPopup");
				{
					var img_o = document.createElement("img");
					img_o.src = "/img/ico_menu.png";
					img_o.setAttribute("width", "34");
					button_o.appendChild(img_o);
				}
				p_o.appendChild(button_o);
			}
			li_o.appendChild(p_o);
		}

		var subList = sItem.sublist;

		if(subList){
			for(var i=0; i<subList.length; i++) {
				var subItem = util.keysToLowerCase(subList[i]);

				var li_o = document.createElement("li");

				var formatInfo = "";

				if(subItem.hwp2002 && subItem.hwp2002 != "NONE") formatInfo = "4";
				if(subItem.pdf && subItem.pdf != "NONE") {
					if(formatInfo != "") formatInfo = formatInfo + ",";
					formatInfo = formatInfo + "2";
				}
				if(subItem.scan && subItem.scan != "NONE") {
					if(formatInfo != "") formatInfo = formatInfo + ",";
					formatInfo = formatInfo + "3";
				}
				if(subItem.zip && subItem.zip != "NONE") {
					if(formatInfo != "") formatInfo = formatInfo + ",";
					formatInfo = formatInfo + "5";
				}

				li_o.setAttribute("data-no", subItem.expapr_no);
				li_o.setAttribute("data-siteid", subItem.siteid);
				li_o.setAttribute("data-group", subItem.expapr_group);
				li_o.setAttribute("data-grade", subItem.grade);
				li_o.setAttribute("data-subjcode", subItem.subj_code);
				li_o.setAttribute("data-coretype", subItem.expapr_coretype);
				li_o.setAttribute("data-tx", subItem.tx_code);
				li_o.setAttribute("data-year", subItem.expapr_testyear);
				li_o.setAttribute("data-formats", formatInfo);
				li_o.setAttribute("data-title", stitle_v);


				ul_o.appendChild(li_o);

				var p_o = document.createElement("p");
				p_o.className = "tag";
				p_o.innerHTML = "<span>" + subItem.part + "</span>";
				li_o.appendChild(p_o);

				p_o = document.createElement("p");
				p_o.className = "title";
				var stitle_v = subItem.open_title;
				if(stitle_v == null) {
					stitle_v = subItem.expapr_title;
				}
				p_o.innerHTML = stitle_v;
				li_o.appendChild(p_o);

				if (subItem.rank) {
					var p_o = document.createElement("p");
					p_o.className = "rank";
					p_o.innerHTML = "<span class='rank01'>"+subItem.rank+"위</span>";
					li_o.appendChild(p_o);
				}

				var p_o = document.createElement("p");
				p_o.className = "hash";

				if(sItem.grade) {
					var key_v = _site_id + sItem.grade;
					p_o.innerHTML = "<span>#"+_categorySub[key_v].title;+"</span>";
				}

				var hash2 = subject3Items[selectedInfo.subject3Index].Name;
				var hash3 = tx3Items[selectedInfo.tx3Index].Name;
				var hash4 = sItem.downcount;

				if(hash2) p_o.innerHTML += "<span>#" + hash2 +"</span>";
				if(hash3) p_o.innerHTML += "<span>#" + hash3 +"</span>";
				if(hash4) p_o.innerHTML += "<span>#다운로드 " + hash4 + "</span>";

				li_o.appendChild(p_o);

				p_o = document.createElement("p");
				p_o.className = "downLink";
				p_o.innerHTML = '<a href="#" data-src="main" data-act="item_down"><em>다운로드</em><em>닫기</em><span class="down">'
							+ '<svg xmlns="http://www.w3.org/2000/svg" width="9" height="7" viewBox="0 0 9 7"><path id="triangle" data-name="triangle" d="M3.659,1.308a1,1,0,0,1,1.682,0L8.01,5.459A1,1,0,0,1,7.168,7H1.832A1,1,0,0,1,.99,5.459Z"/></svg>'
							+'</span></a>';
				li_o.appendChild(p_o);

				{
					var p_o = document.createElement("p");
					p_o.className = "listMenu";
					{
						var button_o = document.createElement("button");
						button_o.type = "button";
						button_o.setAttribute("data-src", "main");
						button_o.setAttribute("data-act", "errorPopup");
						{
							var img_o = document.createElement("img");
							img_o.src = "/img/ico_menu.png";
							img_o.setAttribute("width", "34");
							button_o.appendChild(img_o);
						}
						p_o.appendChild(button_o);
					}
					li_o.appendChild(p_o);
				}
			}
		}

		if(vodConcept && vodConcept.length>0) {

			for(var i=0; i<vodConcept.length; i++) {
				var vodItem = util.keysToLowerCase(vodConcept[i]);
				var li_o = document.createElement("li");
				li_o.setAttribute("data-no", sItem.expapr_no);
				li_o.setAttribute("data-type", "Concept");
				li_o.setAttribute("data-siteid", sItem.siteid);
				li_o.setAttribute("data-grade", sItem.grade);
				li_o.setAttribute("data-subjcode", sItem.subj_code);
				li_o.setAttribute("data-curr", vodItem.curri_idx);
				li_o.setAttribute("data-code", vodItem.code);
				li_o.setAttribute("data-name", vodItem.file_name);
				ul_o.appendChild(li_o);

				var p_o = document.createElement("p");
				p_o.className = "tag";
				p_o.innerHTML = "<span>" + sItem.part + "</span>";
				li_o.appendChild(p_o);

				p_o = document.createElement("p");
				p_o.className = "title";
				var vCurIdx = vodItem.curri_idx;
				var vTitle_v = vCurIdx + "강. "+ vodItem.open_title;
				p_o.innerHTML = "<span>" + vTitle_v + "</span>";
				li_o.appendChild(p_o);

				p_o = document.createElement("p");
				p_o.className = "hash";

				if(sItem.grade) {
					var key_v = _site_id + sItem.grade;
					p_o.innerHTML = "<span>#"+_categorySub[key_v].title;+"</span>";
				}

				var hash2 = subject3Items[selectedInfo.subject3Index].Name;
				var hash3 = tx3Items[selectedInfo.tx3Index].Name;

				if(hash2) p_o.innerHTML += "<span>#" + hash2 +"</span>";
				if(hash3) p_o.innerHTML += "<span>#" + hash3 +"</span>";

				li_o.appendChild(p_o);

				p_o = document.createElement("p");
				p_o.className = "video";
				if(vodItem.revodstate == "Y"){
					p_o.innerHTML = "<a href='javascript:;' data-src='vod_player' data-act='video_down'>개념영상<br/>다시보기</a>";
				}
				else{
					p_o.innerHTML = "<a href='javascript:;' data-src='vod_player' data-act='video_down'>개념영상<br/><span class='num'>" + util.toNumber(_downPrice["VOD"]["concept_m"]) + "</span></a>";
				}
				li_o.appendChild(p_o);
			}
		}
	};

	// 목록이 존재하지 않을때 그리기
	var _drawNoList = function(chk) {
		var recordCount_o = activeRow.querySelector(".bbsNumber b");
		var type2_index = pop2TypeItems[selectedInfo.type2Index || 0].Index;
		var row_A = root.querySelector("#row_A");
		var row_B = root.querySelector("#row_B");

		if(recordCount_o){
			recordCount_o.innerHTML = 0;
		} else {
			_hLog(recordCount_o);
		}

		var ul_o = root.querySelector("#list_A");
		if(ul_o){
			ul_o.innerHTML = "";
		}
		{
			// 데이터가 없는 경우 row_A, row_B타입이 바뀌지 않아서 예외 처리
			if(selectedInfo.menuIndex == 1 && (type2_index == "7" || type2_index == "2" || type2_index == "8")) {
				row_A.style.display = "";
				row_B.style.display = "none";
				activeRow = row_A;
			}

			// 우리학교, 주변학교, 교육특구, 전국학교 탭 노출 시
			if(type2_index == "7" && $(".new-tab-freereading").is(":visible")) {
				var kind_o = root.querySelector(".new-tab-freereading li.active a");
				if(kind_o) {
					kind_v = kind_o.getAttribute("data-value");
				}

				// 학교별 기출유사 안내관련창 초기화
				$("#expect_scl_name").text(sch2Items[selectedInfo.sch2Index].Name);
				$("#info_expect_"+kind_v.toLowerCase()).show();

				$(".nologin-view").show();
				textinfo_Show(kind_v);
			} else {
				//if(type2_index == "2" && (selectedInfo.si2Index == 0 || selectedInfo.gu2Index == 0 || selectedInfo.sch2Index == 0))
				if(type2_index == "2")
				{
					$("#div_Img").show();
					$("#div_V").show();
					$("#div_W").hide();
					$("#div_W_Nodata").hide();
				}
				else if(type2_index == "8")
				{
					$("#div_Img").show();
					$("#div_V").hide();

					if(chk == "W_NoData")
					{	
						$("#div_W_Nodata").show();
						$("#div_W").hide();
					}
					else
					{
						$("#div_W_Nodata").hide();
						$("#div_W").show();
					}
				}
				else if(type2_index == "0" && chk != "FreeReading")
				{					
					$("#div_Img").show();
					$("#div_FreeReading").show();
					$("#div_W").hide();
					$("#div_Img").hide();
				}
				else
				{
					var li_o = document.createElement("li");
					li_o.className = "noresult";

					if(type2_index == "2" || type2_index == "8")
					{
						li_o.innerHTML = "해당 학교의 사용 출판사는 제공되지 않습니다.";	
						$("#div_Img").hide();
					}
					else
					{
						li_o.innerHTML = "조건에 맞는 내역이 없습니다.";	
					}
					
					ul_o.appendChild(li_o);
				}
			}
		}

		if(selectedInfo.menuIndex == 4 && selectedInfo.gradeIndex == 1 && selectedInfo.subjectIndex == 2 && selectedInfo.groupIndex == 4 && (selectedInfo.txIndex == 7 || selectedInfo.txIndex == 8)) {
			alert("과목별 출제 전문가가 제작 중입니다.");
		}

		if(activeRow.id == "row_B") {
			var bl_all = activeRow.querySelectorAll(".block_list");
			$(bl_all).remove();

			var bl_o = document.createElement("div");
			bl_o.className = "block_list";
			ul_o = document.createElement("ul");
			ul_o.className = "bbsList fullTitle mB20";
			var li_o = document.createElement("li");
			li_o.className = "noresult";
			li_o.innerHTML = "조건에 맞는 내역이 없습니다.";
			ul_o.appendChild(li_o);
			bl_o.appendChild(ul_o);

			activeRow.appendChild(bl_o);

			if(selectedInfo.menuIndex == 4) {
				_initEvent();
			}
		}
	};

	// 다운로드 버튼 그리기 위한 함수
	var _checkDownloadBtn = function(formatInfo) {
		var _subj_code = "";
		var _group = "";
		var _coreType = "";
		var isShow = false;
		var isUse = false;

		if(selectedInfo.menuIndex == 0 || selectedInfo.menuIndex == 3 || selectedInfo.menuIndex == 4) {
			isUse = true;
			_subj_code = popSubjectItems[selectedInfo.subjectIndex].Value;
			_group = popGroupItems[selectedInfo.groupIndex].Value;
			_coreType = popGroupItems[selectedInfo.groupIndex].CoreType
		} else if(selectedInfo.menuIndex == 1 && pop2TypeItems[selectedInfo.type2Index].value == "H" && (pop2TypeItems[selectedInfo.type2Index].CoreType == "D" || pop2TypeItems[selectedInfo.type2Index].CoreType == "E")) {
			isUse = true;
			_subj_code = popSubjectItems[selectedInfo.subject2Index].Value;
			_group = pop2TypeItems[selectedInfo.type2Index].value;
			_coreType = pop2TypeItems[selectedInfo.type2Index].CoreType;
		}

		// 오답노트
		//if(selectedInfo.menuIndex == 0) {
		if(isUse == true) {
	   		// !서술형 문제
	   		if(_group != "M"){

	   			if(_group == "H"){

	   				if(_coreType != ""){
	   					isShow = true;
	   				}
	   			}
	   			else if(_group == "K"){
		   			// 국어
		   			if(_subj_code != "KR"){
		   				// 수학 유형별 문제
		   				if(_subj_code == "MT"){

		   					if(_coreType != "B1"){
		   						isShow = true;
		   					}
		   				}
		   				else{
		   					isShow = true;
		   				}
		   			}
		   		}
		   		else{
		   			isShow = true;
		   		}
		   	}
		   }
		   else if(selectedInfo.menuIndex == 1){
		   }

		   if(isShow == true){
		   	if(formatInfo != "") formatInfo = formatInfo + ",";
		   	formatInfo = formatInfo + "97";
		   }

		   return formatInfo
		};

	// 출판사 코드 가져오기
	var _getTXItems = function(){
		if(_Hierarchy.length == 0) {
			popTxItems = [{"Name": "공통", "Value": ""}];
			return;
		}
		var subjItems = _Hierarchy[selectedInfo.gradeIndex].Subj_Code;

		subjItems.forEach(function(item){
			if(item.Value == selectedInfo.subjectCode) {
				if(item.TX_CODE == null) {
					popTxItems = [{"Name": "공통", "Value": ""}];
				}
				else {
					popTxItems = item.TX_CODE;
				}
				return;
			}
		});
	};

	// 학교별 예상족보 년도 가져오기 위한 함수
	var _getExceptYears = function(){
		var baseYearItems = [{"Name": "전체 년도", "Value": ""}];
	    var cYear = new Date().getFullYear();
	    var dYear = cYear;// - 1;

	    for(; cYear>=dYear; cYear--){
	        var obj = {};
	        obj.Name = cYear+"년";
	        obj.Value = cYear;
	        baseYearItems.push(obj);
	    }

	    return baseYearItems;
	};

	// 토클 및 대단원 선택 시 리스트 호출
	var _drawToggleItem = function(p_parent_index, p_rootpart_code, p_etc_action) {
		// 서브 리스트가 비어 있으면 호출
		var l_div_o = $("div[class='block_list'][data-index=" + p_parent_index + "]")[0];	// parent div 확인
		var group_v = popGroupItems[selectedInfo.groupIndex].Value;
		var data_v;

		if ($(l_div_o).find("div").length == 0 || _add_diff != p_add_diff) {
			// 열림 아이콘 변경
			var p_o = $(l_div_o).find("p");
			$(p_o).addClass("active");
			$(p_o.parentNode).find(".productBlock.row").css("display", "");

			comm.toggleLoading(true);
			
			if(group_v == "C" && (p_add_diff == "0" || p_add_diff == "")) {
				// 단원별 문제(난이도 기본 셋팅_최상위 제외)
				data_v = _data_v+"&rootpart_code=" + p_rootpart_code + "&add_diff=1,2,3";
			} else {
				data_v = _data_v+"&rootpart_code=" + p_rootpart_code + "&add_diff=" + p_add_diff;
			}

			// 대메뉴(rootpart_code)에 해당되는 리스트만 호출
			comm.send(_url_v, data_v, "POST", function(json) {
				comm.toggleLoading(false);
				var l_item_p = json.list[0];

				// S : 리스트 카운트 테스트
				if (p_etc_action == "bbsNumber") {
					var bbsNumber_cnt = parseInt(activeRow.querySelector(".listTop .row .bbsNumber b").innerHTML);
					activeRow.querySelector(".listTop .row .bbsNumber b").innerHTML = util.toNumber(bbsNumber_cnt + parseInt(json.RecordCount));
				}
				// E

				// 리스트 초기화
				d_div_o = l_div_o.querySelectorAll(".productBlock.row");
				if (d_div_o.length > 0) {
					for (i = 0 ; i < d_div_o.length ;i++ ) {
						d_div_o[i].remove()
					}
				}

				// 데이터가 있으면 리스트 그린다
				if (typeof(l_item_p) != "undefined") {
					_drawItem_C_sub_v2(l_div_o, l_item_p)

				}
				_initEvent();
			});
		}
	}

	//상품구매이벤트 대상 판단
	var _getProductBuyEventTarget = function(){
		jQuery.ajax({
            type : "GET",
            dataType:'json',
            url : "/payment/Ajax/getProductBuyEventTarget.asp",
            success: function(responseJson) {
                if (responseJson.RESULT == "true") {
                    $("#productBuyEventTargetBanner").show();
                }
            }, error: function(request, exception) {
                return false;
            }
        });
	};

	// 학년설정 값 적용
	var _useGradeSetInfo = function() {
		var group_v = popGroupItems[selectedInfo.groupIndex].Value;
		var coretype_v = popGroupItems[selectedInfo.groupIndex].CoreType;
		if(coretype_v == null) {
			coretype_v = "";
		}

		if(gradeJson) {
			var subjectCode_v = selectedInfo.subjectCode;
			var subjectName_v = selectedInfo.subjectName;

			_hLog("_useGradeSetInfo group=" + group_v + ", subjectcode=" + subjectCode_v + ", name=" + subjectName_v);
			Hierarchy_Init(_site_id, group_v, "");

			if(_Hierarchy && _Hierarchy.length > 0) {
				popTxItems = _Hierarchy[selectedInfo.gradeIndex].Subj_Code[selectedInfo.subjectIndex].TX_CODE;
				if("M" + (parseInt(selectedInfo.gradeIndex) + 1) == gradeJson["grade"] ) {
					if(subjectCode_v == "KR") {
						var sTxCode = "";
						for(var i = 0; i < gradeJson["KR"].length; i++) {
							if(subjectName_v == gradeJson["KR"][i].subjName) {
								sTxCode = gradeJson["KR"][i].TX_CODE;
								break;
							}
						}
						_hLog("_useGradeSetInfo txInfo=" + sTxCode + ", items=" + JSON.stringify(popTxItems));
						if(sTxCode != "") {
							for(var i = 0; i < popTxItems.length; i++) {
								if(sTxCode == popTxItems[i].Value) {
									if(group_v == "C" || (group_v == "H" && coretype_v  == "")) {
										selectedInfo.txIndex = i;
									} else {
										selectedInfo.txIndex = i+1;
									}
									_hLog("_useGradeSetInfo selectedInfo=" + JSON.stringify(selectedInfo));
									break;
								}
							}
						}
					}
					else if(subjectCode_v == "EG") {
						var sTxCode = "";
						for(var i = 0; i < gradeJson["EG"].length; i++) {
							if(subjectName_v == gradeJson["EG"][i].subjName) {
								sTxCode = gradeJson["EG"][i].TX_CODE;
								break;
							}
						}
						if(sTxCode != "") {
							for(var i = 0; i < popTxItems.length; i++) {
								if(sTxCode == popTxItems[i].Value) {
									if(group_v == "C" || (group_v == "H" && coretype_v  == "")) {
										selectedInfo.txIndex = i;
									} else {
										selectedInfo.txIndex = i+1;
									}
									break;
								}
							}
						}
					}
				}
			}
		}
	};

	var _click = function(ee) {
		var ev = window.event || ee;
		var evo = util.findEventObject(ev);
		var act_v = evo.getAttribute("data-act");
		var popup_Chk = null;

		// 학교별 기출유사일 경우 클릭 act_v 값을 search로 치환 (ui로 인해 search_btn으로 넘어옴)
		/*
		if(act_v == "search_btn" && pop2TypeItems[selectedInfo.type2Index].Index == "7") {
			act_v = "search";
		}
		*/

		if(selectedInfo.menuIndex == 1 && parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 0)
		{
			page_Act_Chk = false;
		}
		else
		{
			if (act_v == "filter_grade" || act_v == "filter_subject" || act_v == "filter_group" || act_v == "filter2_type" || act_v == "filter2_grade" || act_v == "filter2_subject" || act_v == "filter3_grade" || act_v == "filter3_subject" || act_v == "filter_tx" || act_v == "filter_level" || act_v == "filter_chapter" || act_v == "filter_term"  || act_v == "oldData") {
				page_Act_Chk = true;
				mainCLS.init = true;
			} else {
				page_Act_Chk = false;
			}
		}		

		if(act_v == "back") {
		}
		else if (act_v == "title") {
			document.location.href = "/M/?menu=1";
		}
		else if(act_v == "filter_grade") {
			let popGradeItems_temp = popGradeItems;

			if (selectedInfo.menuIndex == 3 && param.oldData == "Y") {
				popGradeItems_temp = popGradeItems.filter((e)=> {
					return e.Value == 1
				});
			}

			common.showFlexSelect("학년", popGradeItems_temp, selectedInfo.gradeIndex, false, function(data) {
				if (selectedInfo.menuIndex == 3 && selectedInfo.gradeIndex !== data.pos) {//Ai수준별 학습 > 수학 Master에서 다른 학년으로 선택 시
//					let getGrade = (parseInt(data.pos) + 1).toString();
//					let getSubjectCode = selectedInfo.subjectCode.replace(/[0-9]/g, "");
//					location.href = '/M/exam_unit_ai.asp?grade=' + getGrade + '&subject_cd=' + getSubjectCode;					
//					return;
					selectedInfo.gradeIndex = data.pos;
					selectedInfo.subjectIndex = 2;
					selectedInfo.subjectName = "수학";
					selectedInfo.subjectCode = "MT";
				} else {
					selectedInfo.gradeIndex = data.pos;
					evo.innerHTML = data.title;
					selectedInfo.txIndex = 0;
					selectedInfo.yearIndex = 0;
					selectedInfo.termIndex = 0;
					selectedInfo.chapterIndex = 0;
					selectedInfo.levelIndex = 0;
					selectedInfo.subjectIndex = 2;
					selectedInfo.subjectName = "수학";
					selectedInfo.subjectCode = "MT";
					selectedInfo.groupIndex = 0;
					p_add_diff = "";
				}				
				
				isOldData = false;
				_setHierarchy();
				_useGradeSetInfo();
				_setSelectedValue();
			});
		}
		else if(act_v == "filter_subject") {
			common.showFlexSelect("과목", popSubjectItems, selectedInfo.subjectIndex, false, function(data) {
				if (selectedInfo.menuIndex == 3 && selectedInfo.subjectIndex !== data.pos) {//Ai수준별 학습 > 수학 Master에서 다른 과목으로 선택 시
					if (selectedInfo.groupIndex == 1 || data.pos != 2 && data.pos != 3) {
						let getGrade = (parseInt(selectedInfo.gradeIndex) + 1).toString();
						let getSubjectCode = popSubjectItems[data.pos].Value.replace(/[0-9]/g, "");
						location.href = '/M/exam_unit_ai.asp?grade=' + getGrade + '&subject_cd=' + getSubjectCode;		
						return;
					}
				}

				selectedInfo.subjectIndex = data.pos;
				selectedInfo.subjectCode = popSubjectItems[data.pos].Value;
				selectedInfo.subjectName = popSubjectItems[data.pos].Name;
				selectedInfo.txIndex = 0;
				selectedInfo.yearIndex = 0;
				selectedInfo.termIndex = 0;
				selectedInfo.chapterIndex = 0;
				selectedInfo.levelIndex = 0;
				p_add_diff = ""

				// 과목마다 대메뉴 개수가 다르다 보니 index 오류가 발생하는 경우가 있음, 그럴 경우 0으로 변경 (정효태)
				if (selectedInfo.groupIndex >= popSubjectItems[selectedInfo.subjectIndex].unitItems.length) {
					selectedInfo.groupIndex = 0;
				}
				/*
				selectedInfo.groupIndex = 1;
				if (selectedInfo.subjectCode == "HI") {
					if(selectedInfo.gradeIndex == 0) {
						selectedInfo.groupIndex = 0;
					}
				}
				*/

				isOldData = false;
				_setHierarchy();
				_useGradeSetInfo();
				_setSelectedValue();
			});
		}
		else if(act_v == "filter_group") {
			common.showFlexSelect("구분", popGroupItems, selectedInfo.groupIndex, false, function(data) {
				if (selectedInfo.menuIndex == 3 && data.pos == "0") {//Ai수준별 학습 > 수준별 Ai 학습
					let getGrade = (parseInt(selectedInfo.gradeIndex) + 1).toString();
					let getSubjectCode = selectedInfo.subjectCode;
					location.href = '/M/exam_unit_ai.asp?grade=' + getGrade + '&subject_cd=' + getSubjectCode;
					return;
				}

				if (selectedInfo.menuIndex == 3 && data.pos == "1") {
					param.oldData = "";
				}

				if(selectedInfo.menuIndex == 4 && data.pos == "3") {//실전대비 > 최상위공략
					location.href = "/M/exam_top_table.asp";
					return;
				}

				history.replaceState(null, "","/M/?menu=" + (parseInt(selectedInfo.menuIndex) + 1).toString());

				selectedInfo.groupIndex = data.pos;
				selectedInfo.yearIndex = 0;
				selectedInfo.termIndex = 0;
				var grade_v = popGradeItems[selectedInfo.gradeIndex].Value;
				var group_v = popGroupItems[selectedInfo.groupIndex].Value;
				var coreType_v = popGroupItems[selectedInfo.groupIndex].CoreType;
				var subject_v = popSubjectItems[selectedInfo.subjectIndex].Value;
				if(coreType_v == null) coreType_v = "";
				coreType_v = coreType_v.substring(0,1);

				/*
				if(group_v == "H" && selectedInfo.gradeIndex == 2 && subject_v == "LS") {
					// 3학년 개념완성 사회
					selectedInfo.txIndex = 1;
				} else {
					selectedInfo.txIndex = 0;
				}
				*/
				selectedInfo.txIndex = 0;

				_setHierarchy();
				selectedInfo.chapterIndex = 0;
				selectedInfo.chapterData = [];
				
				selectedInfo.levelIndex = 0;
				selectedInfo.levelData = [];
				p_add_diff = ""

				if(data.Value == "S" && coreType_v == "G") {
					selectedInfo.termIndex = 1;
					common.toast("영문법은 PRO이용권 / 과목별 이용권 / <br/>선생님이용권 / 포인트로 이용 가능합니다.", null);

					selectedInfo.yearIndex = 0;
				} else {
					selectedInfo.termIndex = 0;
				}

				if((data.Value == "K" && coreType_v == "C") || (data.Value == "P" && coreType_v == "E")){
					selectedInfo.termIndex = 1;
				}

				_useGradeSetInfo();
				_setSelectedValue();
			});
		}
		else if(act_v == "filter_tx") {
			var group_v = popGroupItems[selectedInfo.groupIndex].Value;
			var title_v = "교과서";
			if(group_v == "K") title_v = "상세 콘텐츠";
			common.showFlexSelect(title_v, popTxItems, selectedInfo.txIndex, false, function(data) {
				var donga_show_member_yn = $("#donga_show_member_yn").val();

				//동아출판사 검색 트래킹 코드 추가요청_EDUMIG-6272
				if ((data.Name).substr(0, 2) == "동아") {
					trkCLS.setExternalEvent("WCIGNVYX26FQ57YA72R2IFAAJ20250306", "");
				}
				
				/*if(data.Name.includes("동아") && (donga_show_member_yn != "Y" || data.Value == "MAEGCHA1006" || data.Value == "MAEGCHA1007") ) {
					$("#donga-stop-popup").show();
					return;
				} else */
				/*if(data.Name.includes("창비") && data.Value == "MAKRCHA1008") {
					$("#changbi-stop-popup").show();
					return;
				} else {*/
					selectedInfo.txIndex = data.pos;
					selectedInfo.yearIndex = 0;
					selectedInfo.termIndex = 0;
					selectedInfo.chapterIndex = 0;
					selectedInfo.levelIndex = 0;
					p_add_diff = ""
					popYearItems = [{"Name":"", "Value":""}];
					_setSelectedValue();
				//}
			});
		}
		else if(act_v == "filter_year") {
			var group_v = popGroupItems[selectedInfo.groupIndex].Value;
			var coreType_v = popGroupItems[selectedInfo.groupIndex].CoreType;
			var title_v = "년도";
			if(coreType_v == "G") {
				// popYearItems = grammerYearItems;
				title_v = "선택";
			}
			if (group_v == "T") {	// 수행평가
				title_v = "교과서";
			}
			if ((group_v == "K" && coreType_v == "C") || (group_v == "P" && coreType_v == "E1") || (group_v == "P" && coreType_v == "D1")) {	// 영문법, 구문독해, 갈래별문학
				title_v = "구분";
			}
			common.showFlexSelect(title_v, popYearItems, selectedInfo.yearIndex, false, function(data) {
				_hLog("data.pos=" + data.pos);
				var donga_show_member_yn = $("#donga_show_member_yn").val();

				//동아출판사 검색 트래킹 코드 추가요청_EDUMIG-6272
				if ((data.Name).substr(0, 2) == "동아") {
					trkCLS.setExternalEvent("WCIGNVYX26FQ57YA72R2IFAAJ20250306", "");
				}
				
				/*if(data.Name.includes("동아") && donga_show_member_yn != "Y") {
					$("#donga-stop-popup").show();
					return;
				} else */
				/*if(data.Name.includes("창비") && data.Value == "MAKRCHA1008") {
					$("#changbi-stop-popup").show();
					return;
				} else {*/
					selectedInfo.yearIndex = data.pos;
					selectedInfo.termIndex = 0;
					if(coreType_v == "G") {
						selectedInfo.termIndex = 1;
					}
					selectedInfo.chapterIndex = 0;
					selectedInfo.levelIndex = 0;
					p_add_diff = ""
					_setSelectedValue();
				//}
			});
		}
		else if(act_v == "filter_term") {
			var group_v = popGroupItems[selectedInfo.groupIndex].Value;
			var coreType_v = popGroupItems[selectedInfo.groupIndex].CoreType;
			var year_v = popYearItems[selectedInfo.yearIndex].Value;
			termItems = _term;
			var title_v = "학기";
			selectedInfo.chapterIndex = 0;

			if((group_v == "K" && coreType_v == "C") || (group_v == "P" && coreType_v.substring(0,1) == "E")) {
				// 영문법 구문독해
				title_v = "자료종류";
				popSubItems = grammerKindItems;
			} else if (group_v == "P" && coreType_v.substring(0,1) == "D") {
				title_v = "작품/작가";
			}
			// pro전용
			if((group_v == "K" && coreType_v == "C") || (group_v == "P" && coreType_v.substring(0,1) == "E") || (group_v == "P" && coreType_v.substring(0,1) == "D") ) {
				common.showFlexSelect(title_v, popSubItems, selectedInfo.termIndex, false, function(data) {
					_hLog("selected data=" + JSON.stringify(data));
					selectedInfo.termIndex = data.pos;
					selectedInfo.chapterIndex = 0;
					selectedInfo.levelIndex = 0;
					p_add_diff = ""
					if(data.pos == "0") {
						_setSelectedValue();
					} else {
						var input_o = document.querySelector("#filter_1 [name='qry']");
						var qry = input_o.value;

						if(qry && group_v == "P" && coreType_v.substring(0,1) == "D" && (year_v == "A" || year_v == "W")) {
							_setSelectedValue();
						} else {
							var txName_v = popTxItems[selectedInfo.txIndex].Name;
							if(txName_v ==  "고대" || txName_v == "고려시대" || txName_v == "삼국시대") {
								evo.innerHTML = data.Name;
								// display on/off 설정
								_displayList(data.Name);
							} else {
								_setSelectedValue();
							}
						}
					}
				});
			} else {
				// 기타 콘텐츠
				common.showFlexSelect(title_v, termItems, selectedInfo.termIndex, false, function(data) {
					selectedInfo.termIndex = data.pos;
					selectedInfo.chapterIndex = 0;
					selectedInfo.levelIndex = 0;
					p_add_diff = ""
					_setSelectedValue();
				});
			}
		}
		else if(act_v == "filter") {
			filter.showFilter(_id, "score", searchParam, function(data) {
				searchParam = data;
				_updateSeachInfo();
				Page = 1;
				_loadList();
			});
		}
		else if (act_v == "filter_chapter") {
			var group_v = popGroupItems[selectedInfo.groupIndex].Value;
			var coreType_v = popGroupItems[selectedInfo.groupIndex].CoreType;
			var title_v = "대단원";
			if (group_v == "K" && coreType_v == "B1") {
				title_v = "중단원";
			}

			if(selectedInfo.chapterData == null) selectedInfo.chapterData = [];
			common.showFlexMultiSelect(title_v, chapterItems, selectedInfo.chapterData, function(data){

				_chapterDatas = data;

				if(data.length == 1) {
					selectedInfo.chapterIndex = data[0].pos;
				}
				else {
					selectedInfo.chapterIndex = -1;	// -1이면 멀티 선택.
				}
				selectedInfo.chapterData = data;
				var arr = activeRow.querySelectorAll(".block_list");
				$(activeRow).find(".block_list").css("display", "none");
				var isAll = false;
				var chapter_v = chapterItems[0].Name;
				if(chapter_v == null) {
					chapter_v = chapterItems[0].title;
				}
				if(chapter_v.indexOf("전체") >= 0) {
					isAll = true;
				}

				var displayCnt = 0;

				var group_n = popGroupItems[selectedInfo.groupIndex].Name;
				var group_v = popGroupItems[selectedInfo.groupIndex].Value;

				if (coreType_v == null) coreType_v = "";

				var cutCoreType_v = coreType_v.substring(0,1);

				var nArr = null;

				for (var i = 0 ; i < data.length; i++) {					
					// 대단원 메뉴 선택 시 리스트 호출 (단원별 문제:C, 개념완성:H)
					if ( (group_v == "C" || group_v == "M" || ( group_v == "H" && (cutCoreType_v == "D" || cutCoreType_v == "E" || cutCoreType_v == "T"))) && typeof(data[i].parent_index) != "undefined" && typeof(data[i].rootpart_code) != "undefined" ) {
						_drawToggleItem(data[i].parent_index, data[i].rootpart_code, "bbsNumber");
					}

					var data_v = data[i].Name;
					if(data_v == null) {
						data_v = data[i].title;
					}
					if(data_v.indexOf("전체") >= 0) {
						continue;
					}
					var pos_i = data[i].pos;
					if(isAll) pos_i = pos_i - 1;
					$(arr[pos_i]).css("display", "");

					if (group_v == "B") 
					{
						$(arr[pos_i]).children('p:eq(0)').addClass('active');
						$(arr[pos_i]).children('div:eq(0)').css('display', '');
					}

					var nArr = activeRow.querySelector(".block_list[data-index='"+data[i].pos+"']");
					if(nArr){
						$(nArr).show();
					} else {
						$(arr[pos_i]).hide();
					}

					if(group_n == "영문법") {
						displayCnt = displayCnt + $(arr[pos_i]).find("li[data-code]").length;
					} else {
						//var targetLength = $(arr[pos_i]).find("li").length;
						var targetLength = $(arr[pos_i]).find("li[data-no]").length;
						if(group_v == "C" || group_v == "M" || ( group_v == "H" && (cutCoreType_v == "D" || cutCoreType_v == "E" || cutCoreType_v == "T"))) {
							//targetLength = $(nArr).find("li").length;
							targetLength = $(nArr).find("li[data-no]").length;
						}
						displayCnt += targetLength;
					}
				}

				activeRow.querySelector(".bbsNumber b").innerHTML = util.toNumber(displayCnt);

				var obj = root.querySelector("[data-act='filter_chapter']");
				if(obj) {
					var data_n = data[0].Name;
					if(data_n == null) {
						data_n = data[0].title;
					}
					if(data.length > 1) {
						if(data_n.indexOf("전체") >= 0) {
							obj.innerHTML = data_n;
						}
						else {
							obj.innerHTML = data_n + " 외 " + (data.length - 1) + "건";
						}
					}
					else {
						obj.innerHTML = data_n;
					}
				}

				if(group_v == "B" && data_n == '')
				{
					obj.innerHTML = "FINAL 모의고사";
				}
			});
		}
		
		else if (act_v == "filter_level") {
			var title_v = "난이도";

			if(selectedInfo.levelData == null) selectedInfo.levelData = [];

			common.showFlexMultiSelect(title_v, levelItems, selectedInfo.levelData, function(data){
				
				selectedInfo.levelData = data;

				var arr = activeRow.querySelectorAll(".block_list");
				$(activeRow).find(".block_list").css("display", "none");
				var isAll = false;
				var level_v = levelItems[0].Name;
				if(level_v == null) {
					level_v = levelItems[0].title;
				}
				if(level_v.indexOf("전체") >= 0) {
					isAll = true;
				}

				var displayCnt = 0;

				var group_n = popGroupItems[selectedInfo.groupIndex].Name;
				var group_v = popGroupItems[selectedInfo.groupIndex].Value;

				if(selectedInfo.levelData.length > 0){
					if (selectedInfo.levelData[0].Value == "") {
						p_add_diff = "0";
					} else {
						p_add_diff = "";
						for (var i = 0; i < selectedInfo.levelData.length ;i ++ ) {
							if (p_add_diff == "") {
								p_add_diff = selectedInfo.levelData[i].Value;
							} else {
								p_add_diff += "," + selectedInfo.levelData[i].Value;
							}
						}
					}
				} else {
					p_add_diff = "0"
				}

				var nArr = null;

				activeRow.querySelector(".bbsNumber b").innerHTML = 0;

				if (_chapterDatas.length > 0) {	// 대단원을 먼저 선택했을 시
					for (var i = 0 ; i < _chapterDatas.length ; i++) {
						// 대단원 메뉴 선택 시 리스트 호출 (단원별 문제:C, 개념완성:H)
						if ( (group_v == "C") && typeof(_chapterDatas[i].parent_index) != "undefined" && typeof(_chapterDatas[i].rootpart_code) != "undefined" ) {
							_drawToggleItem(_chapterDatas[i].parent_index, _chapterDatas[i].rootpart_code, "bbsNumber");
						}

						var data_v = _chapterDatas[i].Name;
						if(data_v == null) {
							data_v = _chapterDatas[i].title;
						}
						if(data_v.indexOf("전체") >= 0) {
							continue;
						}
						var pos_i = _chapterDatas[i].pos;
						if(isAll) pos_i = pos_i - 1;
						$(arr[pos_i]).css("display", "");

						var nArr = activeRow.querySelector(".block_list[data-index='"+_chapterDatas[i].pos+"']");
						if(nArr){
							$(nArr).show();
						} else {
							$(arr[pos_i]).hide();
						}
					}
					
					
				} 
				
				var obj = root.querySelector("[data-act='filter_level']");
				if(obj) {
					var data_n = data[0].Name;
					if(data_n == null) {
						data_n = data[0].title;
					}
					if(data.length > 1) {
						if(data_n.indexOf("전체") >= 0) {
							obj.innerHTML = data_n;
						}
						else {
							var data_n_arr
							for (var i = 0; i < data.length ;i++ ) {
								if (i == 0) {
									data_n_arr = data[i].Name
								} else {
									data_n_arr += ", " + data[i].Name
								}
							}
							obj.innerHTML = data_n_arr;
						}
					}
					else {
						obj.innerHTML = data_n;
					}
				}
				_add_diff = p_add_diff;
						
				if (_chapterDatas.length == 0) {	// 대단원 선택없이 난이도만 선택했을시
					_setSelectedValue();
				}

				


			});
		}
		else if(act_v == "search") {
			var is_validate = true;

			// 학교별 기출유사일경우만 validate 체크
			/*
			if(pop2TypeItems[selectedInfo.type2Index].Index == "7") {
				var err_msg = '* ';
				if (selectedInfo.sch2Index == 0) {
					is_validate = false;
					if(err_msg.length > 2) {
						err_msg += ', ';
					}

					err_msg += '학교';
				}

				if(selectedInfo.subject2Index == 0) {
					is_validate = false;
					if(err_msg.length > 3) {
						err_msg += ', ';
					}

					err_msg += '과목';
				}

				if(!is_validate) {
					err_msg += '을(를) 선택해주세요!';

					filter_2.querySelector("[id='err_msg']").innerText = err_msg;
					filter_2.querySelector("[id='err_msg']").style.display = "inline";
				} else {
					filter_2.querySelector("[id='err_msg']").style.display = "none";
				}
			}
			*/

			if(is_validate) {
				Page = 1;
				PageSize = 20;
				comm.toggleLoading(true);
				_loadData();
			}
		}
		else if(act_v == "item_down") {
			var em_a = evo.querySelectorAll("em");
			var span_o = evo.querySelector(".down");
			var eroot = util.findObjectByAttr(evo, "data-no", null);
			var list_o = eroot.querySelector(".detailLink");

			if(list_o) {
				if(em_a[0].style.display == "none") {
					$(span_o).removeClass("active");
					em_a[0].style.display = "";
					em_a[1].style.display = "none";
					list_o.style.display = "none";
				}
				else {
					$(span_o).addClass("active");
					em_a[0].style.display = "none";
					em_a[1].style.display = "inline";
					list_o.style.display = "block";
				}
			}
			else {
				if(em_a[0].style.display != "none") {
					var no_v = eroot.getAttribute("data-no");
					var group_v = eroot.getAttribute("data-group");
					var grade_v = eroot.getAttribute("data-grade");
					var subject_v = eroot.getAttribute("data-subjcode");
					var coretype_v = eroot.getAttribute("data-coretype");
					var year_v = eroot.getAttribute("data-year");
					var formats_v = eroot.getAttribute("data-formats");
					var title_v = eroot.getAttribute("data-title");
					var code_v = eroot.getAttribute("data-code");
					var type_v = eroot.getAttribute("data-type");
					var partnum_v = eroot.getAttribute("data-partnum");
					var name_v = eroot.getAttribute("data-name");
					var revodstate_v = eroot.getAttribute("data-revodstate");
					var sclid_v = eroot.getAttribute("data-sclid");
					var midandterm_v = eroot.getAttribute("data-midandterm");
					var midandterm_v = eroot.getAttribute("data-midandterm");
					var txname_v = eroot.getAttribute("data-txname");
					var txcode_v = eroot.getAttribute("data-txcode");

					var pItem = {};
					pItem.siteid = _site_id;
					pItem.expapr_no = no_v;
					pItem.expapr_group = group_v;
					pItem.grade = grade_v;
					pItem.subj_code = subject_v;
					pItem.coretype = coretype_v;
					pItem.year = year_v;
					pItem.formats = formats_v
					pItem.title = title_v;
					pItem.code = code_v;
					pItem.type = type_v;
					pItem.partnum = partnum_v;
					pItem.name = name_v;
					pItem.revodstate = revodstate_v;
					pItem.midandterm = midandterm_v;	// 정효태

					if (group_v == "A" && coretype_v == "B") {	// 학교별 기출유사 예외처리
						pItem.sclid = sclid_v;

						// 임시로 2021년 1학기 중간만 노출
						//if(midandterm_v == "1M" && year_v == "2021") {
						pItem.formats = pItem.formats + ",88";	//88 : 기출분석
						//}
					}

					if (group_v == "A") { //학교별 기출 족보
						pItem.sclid = sclid_v;
						pItem.midandterm = midandterm_v;
						pItem.txname = txname_v;
						pItem.txcode = txcode_v;
						pItem.EducationCheck = EducationCheck;	//가족학원 유무 추가
					}
					pItem.pObject = eroot;

					var coretypeFilter = ["S", "V", "C"]; // 개념완성

					if(coretypeFilter.indexOf(coretype_v) >= 0) {
						if(formats_v.indexOf("94") >= 0) {
							pItem.formats = "2,94";
						}
						else {
							pItem.formats = 2;
						}
					} else if (group_v == "K" && subject_v == "KR" && coretype_v.substring(0,1) == "O") {
						// 국어 문법 연습 > 문법연습(O7), 실전문제(O4)
						pItem.formats = 2;
					}
					else if(group_v == "K" && subject_v == "MT" && coretype_v == "F")
					{
						pItem.formats = 2;
					}

					_Unit.drawPriceButtons(pItem, function(data1, data2) {
						var list_o = eroot.querySelector(".detailLink");
						$(span_o).addClass("active");
						em_a[0].style.display = "none";
						em_a[1].style.display = "inline";
						list_o.style.display = "block";
						if(data2){
							baroTest.show(root, data2);
						}
					});
					sessionStorage.setItem("curScroll", window.scrollY);
				}
			}
		}
		else if(act_v == "item_down_V") {
			var eroot = util.findObjectByAttr(evo, "data-exam-index", null);
			var em_a = evo.querySelectorAll("em");
			var span_o = evo.querySelector(".down");
			var list_o = eroot.querySelector(".detailLink");

			if(list_o) {
				if(em_a[0].style.display == "none") {
					$(span_o).removeClass("active");
					em_a[0].style.display = "";
					em_a[1].style.display = "none";
					list_o.style.display = "none";
				}
				else {
					$(span_o).addClass("active");
					em_a[0].style.display = "none";
					em_a[1].style.display = "inline";
					list_o.style.display = "block";
				}
			}
			else {
				if(em_a[0].style.display != "none") {
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

					_Unit.drawPriceButtons(pItem, function(data1, data2) {
						var list_o = eroot.querySelector(".detailLink");
						
						$(span_o).addClass("active");
						em_a[0].style.display = "none";
						em_a[1].style.display = "inline";
						list_o.style.display = "block";
					});
					sessionStorage.setItem("curScroll", window.scrollY);
				}
			}
		}
		else if(act_v == "filter2_type") {
			_setPreviousCheck();
			iPhonePopChk = true;
			let before_index = 0;

			common.showFlexSelect("구분", pop2TypeItems, selectedInfo.type2Index, false, function(data) {
				Page = 1;
				selectedInfo.gradeK3Index = 1;
				before_index = selectedInfo.type2Index;

				if(data.pos == 3) {					
					selectedInfo.type2Index = data.pos;
					_fileter2_type_change();
				} else {
					selectedInfo.type2Index = before_index;
				}				

				if(data.pos == 0){
					location.href = '/M/ai_transform.asp';
				} else if(data.pos == 1){
					location.href = '/M/expected.asp';
				} else if(data.pos == 2) {
					selectedInfo.type2Index = before_index;
					if(TRK_GLB_USER_ID == "-1") {
						trkCLS.setExternalEvent("ID7P78JVPM4UCQRMX27HUOY8W20250403", "");
						location.href = $("#sign_url").val();
					} else {
						location.href = '/Freetrial/freereading.asp?type=0';
					}
				}

				document.getElementById("part_ID").value = "";
				
//				if(data.Name != "빠른족보") {
//					_fileter2_type_change();
//				}
			});
		}
		else if(act_v == "filter2_si") {
			common.showFlexSelect("시 선택", _SI_LIST, selectedInfo.si2Index, false, function(data) {
				selectedInfo.si2Index = data.pos;
				selectedInfo.gu2Index = 0;
				selectedInfo.sch2Index = 0;

				if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) != 7) {	// 기출유사는 기타 정보 초기화 안함
					if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 0) {
						selectedInfo.grade2Index = 1;
						selectedInfo.subject2Index = 3;
						selectedInfo.year2Index = 0;
						selectedInfo.term2Index = 0;
					}
				}

				document.getElementById("part_ID").value = "";
				_setSelectedValue();
			});
		}
		else if(act_v == "filter2_gu") {
			common.showFlexSelect("구 선택", gu2Items, selectedInfo.gu2Index, false, function(data) {
				selectedInfo.gu2Index = data.pos;
				selectedInfo.sch2Index = 0;		// 학교정보 초기화

				document.getElementById("part_ID").value = "";
				_setSelectedValue();
			});
		}
		else if(act_v == "filter2_sch") {
			common.showFlexSelect("학교 선택", sch2Items, selectedInfo.sch2Index, false, function(data) {
				selectedInfo.sch2Index = data.pos;

				document.getElementById("part_ID").value = "";
				_setSelectedValue();
			});
		}
		else if(act_v == "filter2_grade") {
			var gradeIdx = selectedInfo.grade2Index;

			if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 4) {
				gradeIdx = selectedInfo.gradeK3Index;
			}

			common.showFlexSelect("학년", popGrade2Items, gradeIdx, false, function(data) {
				selectedInfo.grade2Index = data.pos;
				selectedInfo.gradeK3Index = data.pos;

				if (parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 0) {
					selectedInfo.year2Index = 0;
				} else if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 7) {	// 기출분석
					if(data.pos == 1) {
						if(popYearItems[selectedInfo.year2Index].Value == "2023") {
							selectedInfo.year2Index = 1;
						} else if(popYearItems[selectedInfo.year2Index].Value == "2022") {
							selectedInfo.year2Index = 2;
						} else {
							selectedInfo.year2Index = 0;
						}
					} else {
						if(popYearItems[selectedInfo.year2Index].Value == "2025") {
							selectedInfo.year2Index = 0;
						} else if(popYearItems[selectedInfo.year2Index].Value == "2024") {
							selectedInfo.year2Index = 1;
						} else if(popYearItems[selectedInfo.year2Index].Value == "2023") {
							selectedInfo.year2Index = 2;
						} else if(popYearItems[selectedInfo.year2Index].Value == "2022") {
							selectedInfo.year2Index = 3;
						}
					}	

					selectedInfo.subject2Index = 0;
				} else {
					selectedInfo.subject2Index = 2;
					// 지역, 최빈, 최오
					//if(selectedInfo.type2Index == 3) {
					if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 3 || parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 5 || parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 6) {
						if(data.pos == 2) {
							selectedInfo.subject2Index = 0;
						} else {
							selectedInfo.subject2Index = 2;
						}
					}

					//if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 4 && selectedInfo.gradeK3Index == 0) {
					if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 4) {
						selectedInfo.subject2Index = 0;
					}

					selectedInfo.pub2Index = 0;
					selectedInfo.year2Index = 0;
					selectedInfo.term2Index = 0;
					selectedInfo.fileType2Index = 0;
				}

				isOldData = false;
				_olddata_text();

				if (parseInt(pop2TypeItems[selectedInfo.type2Index].Index) != 0) {
					_setHierarchy();
				}

				document.getElementById("part_ID").value = "";
				_setSelectedValue();
			});
		}
		else if(act_v == "filter2_subject") {
			common.showFlexSelect("과목", popSubjectItems, selectedInfo.subject2Index, false, function(data) {
				selectedInfo.subject2Index = data.pos;

				if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) != 0)
				{
					if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 4) {
						var subject_v = popSubjectItems[data.pos].Value;
						if(selectedInfo.grade2Index == 1) {
							if(subject_v == "HI") {
								selectedInfo.pub2Index = 1;
							} else {
								selectedInfo.pub2Index = 0;
							}
						} else {
							selectedInfo.pub2Index = 0;
						}
					} else {
						selectedInfo.pub2Index = 0;
					}
					if(parseInt(parseInt(pop2TypeItems[selectedInfo.type2Index].Index)) != 7)
					{
						selectedInfo.year2Index = 0;
					}

					if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 7) {	// 기출분석
						if(data.pos == 1 && popGrade2Items[selectedInfo.grade2Index].value != "MT") {
							if(popYearItems[selectedInfo.year2Index].Value == "2023") {
								selectedInfo.year2Index = 1;
							} else if(popYearItems[selectedInfo.year2Index].Value == "2022") {
								selectedInfo.year2Index = 2;
							} else {
								selectedInfo.year2Index = 0;
							}
						} else {
							if(popYearItems[selectedInfo.year2Index].Value == "2025") {
								selectedInfo.year2Index = 0;
							} else if(popYearItems[selectedInfo.year2Index].Value == "2024") {
								selectedInfo.year2Index = 1;
							} else if(popYearItems[selectedInfo.year2Index].Value == "2023") {
								selectedInfo.year2Index = 2;
							} else if(popYearItems[selectedInfo.year2Index].Value == "2022") {
								selectedInfo.year2Index = 3;
							}
						}
					}

					selectedInfo.term2Index = 0;
				}

				isOldData = false;
				_olddata_text();

				document.getElementById("part_ID").value = "";

				if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 2)
				{
					if(sch2Items[selectedInfo.sch2Index].Scl_ID == '')
					{
						_setSelectedValue();
					}
					else
					{
						var url_v = "/ZocboExam/examRange.ajax.asp";
						var data_v = "SiteID=M";
							data_v = data_v + "&Grade=" + popGrade2Items[selectedInfo.grade2Index].value;
							data_v = data_v + "&Subj_Code=" + popSubjectItems[selectedInfo.subject2Index].Value;
							data_v = data_v + "&Subj_Name=" + escape(popSubjectItems[selectedInfo.subject2Index].Name);
							data_v = data_v + "&Scl_ID=" + sch2Items[selectedInfo.sch2Index].Scl_ID;

						comm.send(url_v, data_v, "POST", function(json) 
						{
							var chk_Val = json.chk_Val;
							
							if(chk_Val == 1)
							{
								if(!confirm("최근 검색한 " + popSubjectItems[selectedInfo.subject2Index].Name + " 범위를 다시 검색하시겠습니까?"))
								{
									_setSelectedValue();
								}
								else
								{
									document.getElementById("part_ID").value = "last_Search_Y";								
									_loadData_2_V();
									_setSelectedValue();
								}
							}
							else
							{
								_setSelectedValue();
							}
						});
					}
				}
				else
				{
					_setSelectedValue();
				}
			});
		}
		else if (act_v == "filter2_pub") {
			common.showFlexSelect("교과서", pubItems, selectedInfo.pub2Index, false, function(data){
				var donga_show_member_yn = $("#donga_show_member_yn").val();
				
				//동아출판사 검색 트래킹 코드 추가요청_EDUMIG-6272
				if ((data.Name).substr(0, 2) == "동아") {
					trkCLS.setExternalEvent("WCIGNVYX26FQ57YA72R2IFAAJ20250306", "");
				}

				/*if(data.Name.includes("동아") && (donga_show_member_yn != "Y" || data.Value == "MAEGCHA1006" || data.Value == "MAEGCHA1007") ) {
					$("#donga-stop-popup").show();
					return;
				} else */
				/*if(data.Name.includes("창비") && data.Value == "MAKRCHA1008") {
					$("#changbi-stop-popup").show();
					return;
				} else {*/
					selectedInfo.pub2Index = data.pos;
					selectedInfo.year2Index = 0;
					selectedInfo.term2Index = 0;
					var obj = filter_2.querySelector("input[name='qry']");
					obj.value = "";
					_setSelectedValue();
				//}
			});
		}
		else if(act_v == "filter2_year") {
			common.showFlexSelect("년도", popYearItems, selectedInfo.year2Index, false, function(data) {
				selectedInfo.year2Index = data.pos;
				if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) != 0)
				{
					selectedInfo.term2Index = 0;
				}
				_setSelectedValue();
			});
		}
		else if(act_v == "filter2_term") {
			// 학교별 기출유사는 분기마다 학기 늘려 나가기로~			
			if(selectedInfo.menuIndex == 1 && pop2TypeItems[selectedInfo.type2Index].Index == "7") {
				termItems = [{"title": "전체 학기", "Value": ""}, {"title": "1학기 중간", "Value": "1M"}, {"title": "1학기 기말", "Value": "1E"}, {"title": "2학기 중간", "Value": "2M"}, {"title": "2학기 기말", "Value": "2E"}];
			} else {
				termItems = _term;
			}

			if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 0) {
				common.showFlexSelect("학기", _term_FreeReading, selectedInfo.term2Index, false, function(data) {
					selectedInfo.term2Index = data.pos;
					_setSelectedValue();
				});
			} else {
				//common.showFlexSelect("학기", _term, selectedInfo.term2Index, false, function(data) {
				common.showFlexSelect("학기", termItems, selectedInfo.term2Index, false, function(data) {
					selectedInfo.term2Index = data.pos;					
					_setSelectedValue();
				});
			}
		}
		else if(act_v == "filter2_fileType") {
			common.showFlexSelect("자료 종류", fileType2Items, selectedInfo.fileType2Index, false, function(data) {
				selectedInfo.fileType2Index = data.pos;
				_setSelectedValue();
			});
		}
		else if(act_v == "filter2_Chapter") 
		{			
			if(selectedInfo.si2Index != 0 && selectedInfo.gu2Index != 0 && selectedInfo.sch2Index != 0)
			{
				var SiteID = "M";
				var Grade = popGrade2Items[selectedInfo.grade2Index].value;
				var Subj_Code = popSubjectItems[selectedInfo.subject2Index].Value;
				var Subj_Name = popSubjectItems[selectedInfo.subject2Index].Name;
				var Rg_CitiesProvinces = encodeURIComponent(_SI_LIST[selectedInfo.si2Index].Name.trim());
				var Rg_District = encodeURIComponent(gu2Items[selectedInfo.gu2Index].Name.trim());
				var Scl_ID = sch2Items[selectedInfo.sch2Index].Scl_ID;
				var part_ids = document.getElementById("part_ID").value;
				var expapr_Group = "V";

				if(pop2TypeItems[selectedInfo.type2Index].Index == 8)
				{
					expapr_Group = "W";
				}

				var url = "/_api/Search.api.asp";
				var data = "cmd=EXPAPR_NO_CHK&SiteID=" + SiteID + "&Grade=" + Grade + "&Subj_Code=" + Subj_Code + "&Rg_CitiesProvinces=" + Rg_CitiesProvinces + "&Rg_District=" + Rg_District + "&Scl_ID=" + Scl_ID + "&Subj_Name=" + Subj_Name;

				comm.send(url, data, "POST", function(json) {		
					if(json.expapr_No == "undefined" || typeof json.expapr_No == "undefined")
					{
						$(".zoboInfoPop_V_NoData").show();

						if(pop2TypeItems[selectedInfo.type2Index].Index == 8)
						{
							$("#nodata_Txt").text($("#nodata_Txt").text().replace("예상족보", "AI기출변형"));
						}
						else
						{
							$("#nodata_Txt").text($("#nodata_Txt").text().replace("AI기출변형", "예상족보"));
						}
					}
					else
					{
						fn_examDownload(json.expapr_No, "2", SiteID, expapr_Group, "", Subj_Code, Grade, "");	
					}
				});
			}
			else
			{
				$(".zoboInfoPop_V_NoSelect").show();
			}
		}
		else if (act_v == "viewer") {
			var devicetype = deviceTypeChk();
			var userAgent = userAgentChk();

			if (devicetype == "ios" && userAgent == "Opera") {
				alert("Safari 또는 Chrome 브라우저를 이용해 주세요.");
				return;
			}

			var season_FreeState = $("#season_FreeState").val();

			if(season_FreeState == 'N')
			{
				alert('무료열람 기간이 종료 되었습니다.');
				return;
			}
			else
			{
				if(loginCheck == '' || loginCheck == 0)
				{
					loginPop.show(root, _rtnUrl, false);
				}
				else
				{
					var eroot = util.findObjectByAttr(evo, "data-siteid", null);
					var SiteID = eroot.getAttribute("data-siteid");
					var Scl_ID = eroot.getAttribute("data-Scl_ID");
					var Scl_Name = eroot.getAttribute("data-Scl_Name");
					var Grade = eroot.getAttribute("data-Grade");
					var Subj_Code = eroot.getAttribute("data-Subj_Code");
					var ExPapr_TestYear = eroot.getAttribute("data-ExPapr_TestYear");
					var ExPapr_MidEndTerm = eroot.getAttribute("data-ExPapr_MidEndTerm");
					var TX_Name = eroot.getAttribute("data-TX_Name");
					var sub_TX_CODE = eroot.getAttribute("data-sub_TX_CODE");

					if(!(!this.popup_Chk || this.popup_Chk.closed))
					{
						this.popup_Chk.close();
					}
					
					//this.popup_Chk = window.open('../../include/pdf_Viewer.asp?SiteID=M&Scl_ID='+Scl_ID+'&Scl_Name='+Scl_Name+'&Grade='+Grade+'&Subj_Code='+Subj_Code+'&ExPapr_TestYear='+ExPapr_TestYear+'&ExPapr_MidEndTerm='+ExPapr_MidEndTerm+'&TX_Name='+TX_Name+'&sub_TX_CODE='+sub_TX_CODE, 'viewer');
					this.popup_Chk = window.open('../../common/system/recaptcha_Chk.asp?SiteID=M&Scl_ID='+Scl_ID+'&Scl_Name='+Scl_Name+'&Grade='+Grade+'&Subj_Code='+Subj_Code+'&ExPapr_TestYear='+ExPapr_TestYear+'&ExPapr_MidEndTerm='+ExPapr_MidEndTerm+'&TX_Name='+TX_Name+'&sub_TX_CODE='+sub_TX_CODE+'&viewer=Y');
				}
			}
		}
		else if (act_v == "listFilter") {
			var viewSelect = root.querySelector(".new-tab-freereading");
			var Scl_ID = sch2Items[selectedInfo.sch2Index].Scl_ID;

			if(Scl_ID == "" || typeof Scl_ID == "undefined")
			{
				alert('학교 정보를 입력하여 Ai기출유사 자료를 확인하세요.');
				return;
			}

			var li_o = viewSelect.querySelectorAll("li");
			li_o.forEach(function(item){
				item.className = "";
			});

			evo.parentNode.className = "active";
			var kind_v = evo.getAttribute("data-value");

			_setSelectedValue();
		}
		else if (act_v == "banner_click") {
			var data_value = evo.getAttribute("data-value");
			var si = selectedInfo.si2Index;
			var gu = selectedInfo.gu2Index;
			var scl = selectedInfo.sch2Index;
			var grade = parseInt(selectedInfo.grade2Index);
			var site_gubun = "";

			if(_site_id == "M")
			{
				site_gubun = "/M/";
			}
			else
			{
				site_gubun = "/H/";
			}

			if(data_value == "exam_V") // 학교별 예상 족보
			{
				var expected_subj_Code = popSubjectItems[selectedInfo.subject2Index].Value;
				var expected_Grade = popGrade2Items[selectedInfo.grade2Index].value;
				var expected_scl_id = sch2Items[selectedInfo.sch2Index].Scl_ID;

				location.href = site_gubun + "expected.asp?Subj_Code=" + expected_subj_Code + "&Grade=" + expected_Grade + "&scl_id=" + expected_scl_id;
			}
			else if(data_value == "exam_HD") // 최다빈출
			{
				if(SiteID == "H" && grade != 0)
				{
					if(grade == 2)
					{
						grade = grade - 1;
					}

					location.href = site_gubun + "?menu=5&group=1&yusa=Y"+"&grade="+(grade+1)+"&subject=7";
				}
				else
				{
					location.href = site_gubun + "?menu=5&group=1&yusa=Y"+"&grade="+(grade+1)+"&subject=2";
				}
			}
			else if(data_value == "exam_C") // 수준별 학습
			{
				if(SiteID == "H" && grade != 0)
				{
					if(grade == 2)
					{
						grade = grade - 1;
					}

					location.href = site_gubun + "?menu=4&grade="+(grade+1)+"&subject=7";
				}
				else
				{
					location.href = site_gubun + "?menu=4&grade="+(grade+1)+"&subject=2";
				}				
			}
		}
		else if(act_v == "filter3_grade") {
			common.showFlexSelect("학년", popGradeItems, selectedInfo.grade3Index, false, function(data) {
				_hLog("selected data=" + JSON.stringify(data));
				selectedInfo.grade3Index = data.pos;
				selectedInfo.subject3Index = 2;
				selectedInfo.tx3Index = 0;
				selectedInfo.chapter3Index = 0;
				selectedInfo.sub3Index = 0;
				Page = 1;
				_setSelectedValue();
			});
		}
		else if(act_v == "filter3_subject") {
			common.showFlexSelect("과목", subject3Items, selectedInfo.subject3Index, false, function(data) {
				_hLog("selected data=" + JSON.stringify(data));
				selectedInfo.subject3Index = data.pos;
				selectedInfo.tx3Index = 0;
				selectedInfo.chapter3Index = 0;
				selectedInfo.sub3Index = 0;
				_setSelectedValue();
			});
		}
		else if(act_v == "filter3_tx") {
			common.showFlexSelect("교과서", tx3Items, selectedInfo.tx3Index, false, function(data) {
				_hLog("selected data=" + JSON.stringify(data));
				selectedInfo.tx3Index = data.pos;
				selectedInfo.chapter3Index = 0;
				selectedInfo.sub3Index = 0;
				_setSelectedValue();
			});
		}
		else if(act_v == "filter3_chapter") {
			common.showFlexSelect("대단원", chapter3Items, selectedInfo.chapter3Index, false, function(data) {
				_hLog("selected data=" + JSON.stringify(data));
				selectedInfo.chapter3Index = data.pos;
				selectedInfo.sub3Index = 0;
				_setSelectedValue();
			});
		}
		else if(act_v == "filter3_sub") {
			common.showFlexSelect("상세 콘텐츠", sub3Items, selectedInfo.sub3Index, false, function(data) {
				_hLog("selected data=" + JSON.stringify(data));

				var rootPart_ID = chapter3Items[selectedInfo.chapter3Index].Value;

				if(data.pos == 1 && (
					rootPart_ID == 1180 || rootPart_ID == 1181 || rootPart_ID == 1214 || rootPart_ID == 1215 || // 중1 국어 - 미래엔(신유식)
					rootPart_ID == 1182 || rootPart_ID == 1183 || rootPart_ID == 1216 || rootPart_ID == 1217 || // 중1 국어 - 천재(박영목)
					rootPart_ID == 1184 || rootPart_ID == 1185 || rootPart_ID == 1218 || rootPart_ID == 1219 || // 중1 국어 - 비상(김진수)
					rootPart_ID == 1186 || rootPart_ID == 1187 || rootPart_ID == 1220 || rootPart_ID == 1221 || // 중1 국어 - 천재(노미숙)
					rootPart_ID == 1080 || rootPart_ID == 1081 || rootPart_ID == 1188 || rootPart_ID == 1189 || // 중1 영어 - 동아(윤정미)
					rootPart_ID == 1083 || rootPart_ID == 1190 || rootPart_ID == 1191 || rootPart_ID == 1192 || // 중1 영어 - 동아(이병민)
					rootPart_ID == 1085 || rootPart_ID == 1086 || rootPart_ID == 1193 || rootPart_ID == 1194 || // 중1 영어 - 미래엔(최연희)
					rootPart_ID == 1088 || rootPart_ID == 1089 || rootPart_ID == 1195 || rootPart_ID == 1196 || // 중1 영어 - 천재(이재영)
					rootPart_ID == 1197 || rootPart_ID == 1198 || rootPart_ID == 1213 || // 중1 수학 - 공통
					rootPart_ID == 1203 || rootPart_ID == 1245 || rootPart_ID == 1246 || // 중1 과학 - 공통
					rootPart_ID == 1199 || rootPart_ID == 1200 || rootPart_ID == 1201 || rootPart_ID == 1210 || rootPart_ID == 1211 || rootPart_ID == 1212 || // 중1 사회 - 사회1
					rootPart_ID == 1593 || rootPart_ID == 1594 || rootPart_ID == 1595 || rootPart_ID == 1596 || rootPart_ID == 1597 || rootPart_ID == 1598 // 중2 사회 - 사회1
				))
				{
					alert('준비중입니다.');
					return false;
				}
				else
				{
					selectedInfo.sub3Index = data.pos;
					_setSelectedValue();
				}
			});
		}
		else if(act_v == "basic") {	// 고득점 마스터 기본학습.
			var li_1 = root.querySelector("[data-act='basic']");
			var li_2 = root.querySelector("[data-act='actual']");
			if($(li_1.parentNode).hasClass("active")) {
				return;
			}
			$(li_2.parentNode).removeClass("active");
			$(li_1.parentNode).addClass("active");
			_drawList(basicList);
		}
		else if(act_v == "actual") {	// 고득점 마스터 실전적용.
			var li_1 = root.querySelector("[data-act='basic']");
			var li_2 = root.querySelector("[data-act='actual']");
			if($(li_2.parentNode).hasClass("active")) {
				return;
			}
			$(li_1.parentNode).removeClass("active");
			$(li_2.parentNode).addClass("active");
			_drawList(actualList);
		}
		else if(act_v == "showBindo") {
			var obj = document.querySelector("#bindoPnl");
			if(obj) {
				obj.style.display = "";
				root.style.display = "none";
				var book = obj.querySelector("#book");
				var chapter = obj.querySelector("#chapter");
				var imageName = obj.querySelector("#imageName");
				var imageSrc = obj.querySelector("#imageSrc");

				var course_id = subject3Items[selectedInfo.subject3Index].Course_ID;
				var imgIdx = 0;

				//var imgName = chapter3Items[selectedInfo.chapter3Index].Name;
				var imgName = popSub3Items[selectedInfo.sub3Index].title;
				imageName.innerHTML = imgName;

				$(imageName).unbind();
				if(imgName == 0) {
					imageName.parentNode.style.display = "none";
				} else {
					imageName.parentNode.style.display = "";
					$(imageName).bind("click", function(){
						if(popSub3Items.length == 0) return false;


						common.showFlexSelect("선택", popSub3Items, imgIdx, false, function(data){
							var imgFileName = (data.pos-0+1) + ".jpg";
							imageName.innerHTML = data.title;
							imgIdx = data.pos;
							imageSrc.src = config.IMAGE_URL_DEF+_topic3List[data.pos].Image_Url + imgFileName;
						});
					});
				}

				var imgFileName = imgIdx-0+1 +".jpg";
				imageSrc.src = config.IMAGE_URL_DEF+_topic3List[imgIdx].Image_Url +"/"+imgFileName;

				$('meta[name=viewport]').remove();
				$('head').append( '<meta name="viewport" content="user-scalable=yes, width=device-width, initial-scale=1, maximum-scale=2, minimum-scale=1">' );

			}
		}
		else if(act_v == "bindoClose") {
			var obj = document.querySelector("#bindoPnl");
			if(obj) {
				root.style.display = "";
				obj.style.display = "none";
			}
		}
		else if(act_v == "toggleAll") {
			var p_o = evo.parentNode;
			var version_v = evo.getAttribute("data-version");

			if ($(p_o).hasClass("active")) {
				// hidden
				$(p_o).removeClass("active");
				$(p_o.parentNode).find(".productBlock.row").css("display", "none");
			} else {
				// show
				setTimeout(function() {
					const count = $(p_o).closest(".block_list").find(".productBlock.row ul li").length;

					if(count === 0) {
						alert("과목별 출제 전문가가 제작 중입니다.");
					} else {
						$(p_o).addClass("active");
						$(p_o.parentNode).find(".productBlock.row").css("display", "");
					}
				}, 300);

				if (version_v == "v2") {
					// toggle선택한 대단원 영역에 서브 리스트 추가
					_drawToggleItem(evo.getAttribute("data-parent-index"), evo.getAttribute("data-rootpart_code"), "");
				}
			}
		}
		else if(act_v == "toggleGroup") {
			var p_o = evo.parentNode;
			var parent_o = p_o.parentNode;
			var ul_o = $(parent_o).find("ul");

			if($(p_o).hasClass("active")) {
				$(p_o).removeClass("active");
				$(p_o.parentNode).find(".productBlock.row").css("display", "none");
			} else {
				$(p_o).addClass("active");
				$(p_o.parentNode).find(".productBlock.row").css("display", "");
			}

			for(var i=0; i<ul_o.length; i++) {
				var cul_o = ul_o[i];

				if(p_o.getAttribute("data-i") != "")
				{
					if(p_o.getAttribute("data-i") == null)
					{
						if(p_o.getAttribute("data-type") == "C")
						{
							if($(p_o).hasClass("active")) {
								cul_o.style.display = "";
							} else {
								cul_o.style.display = "none";
							}
						}
						else
						{
							if($(p_o).hasClass("active")) {
								cul_o.style.display = "none";
							} else {
								cul_o.style.display = "";
							}
						}
					}
					else
					{
						cul_o = ul_o[p_o.getAttribute("data-i")];

						if(p_o.getAttribute("data-type") == "C")
						{
							if($(p_o).hasClass("active")) {
								cul_o.style.display = "";
								ul_o[parseInt(p_o.getAttribute("data-i")) + 1].style.display = "";
							} 
							else {
								cul_o.style.display = "none";
								ul_o[parseInt(p_o.getAttribute("data-i")) + 1].style.display = "none";
							}
						}
						else
						{
							if($(p_o).hasClass("active")) {
								cul_o.style.display = "none";
								ul_o[parseInt(p_o.getAttribute("data-i")) + 1].style.display = "none";
							} 
							else {
								cul_o.style.display = "";
								ul_o[parseInt(p_o.getAttribute("data-i")) + 1].style.display = "";
							}
						}

						
					}
				}
				else
				{
					if($(p_o).hasClass("active")) {
						cul_o.style.display = "none";
					} else {
						cul_o.style.display = "";
					}
				}
			}
		}
		else if (act_v == "fold_top") {
			var evoId = evo.getAttribute("for");
			if(evoId == null) {
				evoId = evo.id;
			}

			var parent_o = util.findObjectByAttr(evo, "class", "row2");

			//if(selectedInfo.menuIndex == 0) {
			// 내신완성, 학교별족보 (최빈, 최오) 일 경우 사용
			if(selectedInfo.menuIndex == 0 || selectedInfo.menuIndex == 3 || selectedInfo.menuIndex == 4 || selectedInfo.menuIndex == 5 || (selectedInfo.menuIndex == 1 && pop2TypeItems[selectedInfo.type2Index].value == "H")) {
				var bl_o = parent_o.querySelectorAll(".block_list");

				if(selectedInfo.menuIndex == 5)
				{
					for(var i=0; i < (bl_o.length - 1); i++) {
						var bl = bl_o[i];

						var tl_o = bl.querySelector(".titleLine");
						if($(tl_o).hasClass("active")) {
							if(evoId == "fold2") {
								$(tl_o).removeClass("active");
							}
						} else {
							if(evoId == "fold1") {
								$(tl_o).addClass("active");
							}
						}

						var pb_o = bl.querySelectorAll(".productBlock.row");

						for(var j=0; j<pb_o.length; j++) {
							var pb = pb_o[j];

							var lt_o = pb.querySelector(".listTitle");
							var cul_o = pb.querySelector("ul");
							if(evoId == "fold1") {
								pb.style.display = "";
								$(lt_o).removeClass("active");
								cul_o.style.display = "";
							} else if (evoId == "fold2") {
								pb.style.display = "none";
							}
						}
					}
				}
				else
				{
					for(var i=0; i<bl_o.length; i++) {
						var bl = bl_o[i];

						var tl_o = bl.querySelector(".titleLine");
						if($(tl_o).hasClass("active")) {
							if(evoId == "fold2") {
								$(tl_o).removeClass("active");
							}
						} else {
							if(evoId == "fold1") {
								if (selectedInfo.menuIndex == 3 || selectedInfo.menuIndex == 4) {//중등 수준별학습, 실전대비 메뉴(대단원 클릭 후 데이터 불러오는 기능으로 인해 데이터 불러오지 않은 경우 확인하여 전체펼치기 기능 예외처리) 
									if ($(bl).find("div[class='productBlock row']").length > 0){
										$(tl_o).addClass("active");
									}
								} else {
									$(tl_o).addClass("active");
								}
							}
						}

						var pb_o = bl.querySelectorAll(".productBlock.row");

						for(var j=0; j<pb_o.length; j++) {
							var pb = pb_o[j];

							var lt_o = pb.querySelector(".listTitle");
							var cul_o = pb.querySelector("ul");
							var ul_o = cul_o.querySelector("div.detailLink ul");
							if(evoId == "fold1") {
								pb.style.display = "";
								$(lt_o).removeClass("active");
								cul_o.style.display = "";
								if (ul_o) {
									ul_o.style.display = "";
								}
							} else if (evoId == "fold2") {
								pb.style.display = "none";
							}
						}
					}
				}
			} else if(selectedInfo.menuIndex == 2) {
				var bl_o = parent_o.querySelector(".block_list");
				var tl_o = parent_o.querySelector(".titleLine");
				var pb_o = parent_o.querySelector(".productBlock.row");
				var pb_o2 = pb_o.querySelectorAll(".productBlock");

				if(selectedInfo.sub3Index == 0) {
					if(evoId == "fold3") {
						$(bl_o).addClass("acitve");
						$(tl_o).addClass("active");
						$(pb_o).slideDown(100);
						$(pb_o).show();
					} else if ( evoId == "fold4") {
						$(bl_o).removeClass("acitve");
						$(tl_o).removeClass("active");
						$(pb_o).slideUp(100);
						$(pb_o).hide();
					}

					for(var i=0; i<pb_o2.length; i++) {
						var div_o = pb_o2[i];

						var p_o = div_o.querySelector(".listTitle");
						var ul_o = div_o.querySelectorAll(".bbsList");

						if($(p_o).hasClass("active")) {
							$(p_o).removeClass("active");
						} else {
							$(p_o).addClass("active");
						}

						if(evoId == "fold3") {
							$(p_o).removeClass("active");
							$(ul_o).show();
						} else if (evoId == "fold4") {
							$(p_o).addClass("active");
							$(ul_o).hide();
						}
					}

				} else {
					if($(tl_o).css("display") != "none") {
						if(evoId == "fold3") {
							$(tl_o).addClass("active");
							$(pb_o).show();
						} else if (evoId == "fold4") {
							$(tl_o).removeClass("active");
							$(pb_o).hide();
						}
					}

					for(var i=0; i<pb_o2.length; i++) {
						var div_o = pb_o2[i];

						var p_o = div_o.querySelector(".listTitle");
						var ul_o = div_o.querySelector(".bbsList");

						if($(p_o).hasClass("active")) {
							$(p_o).removeClass("active");
						} else {
							$(p_o).addClass("active");
						}

						if(evoId == "fold3") {
							$(p_o).removeClass("active");
							ul_o.style.display = "";
						} else if (evoId == "fold4") {
							$(p_o).addClass("active");
							ul_o.style.display = "none";
						}
					}
				}
			}

			$("#"+evoId).prop("checked", true);

		}
		else if(act_v == "errorPopup"){
			common.showSelect(errorItems, 0, function(item){
				_hLog(item);
				var go = evo.parentElement.parentElement;

				var data = {};
				data["expapr_no"] = go.getAttribute("data-no");
				data["section"] = item.value;

				report_w.show(root, data);
			});
		}
		else if (act_v == "oldData") {
			if (selectedInfo.menuIndex == 3 && param.oldData == "Y") {
				location.href = '/M/exam_unit_ai.asp?grade=1&subject_cd='+selectedInfo.subjectCode;
				return false;
			}

			selectedInfo.yearIndex = 0;
			selectedInfo.year2Index = 0;

			if(isOldData) {
				evo.innerHTML = "<span class='is-bedge'>15개정</span>이전 개정자료 보기";
				isOldData = false;
				trkCLS.setExternalEvent("6R82AQ4ZRKWZO6E3GQZ28FOOR20260223", "");				
			} else {
				evo.innerHTML = "<span class='is-bedge'>22개정</span>최신 개정자료 보기";
				//selectedInfo.yearIndex = 0;
				isOldData = true;
				trkCLS.setExternalEvent("M7UEUXHTKUEU6JX7N1VA3NYDA20260223", "");
			}
			_setSelectedValue();
			//evo.style.color = "white";
		}
		else if (act_v == "banner_click") {
			var data_value = evo.getAttribute("data-value");
			switch(data_value) {
				case "expectation":		// 예상족보
					selectedInfo.type2Index = (_is_previous_chk) ? 3 : 2;
					break;
				case "frequent":		// 최빈
					selectedInfo.type2Index = (_is_previous_chk) ? 4 : 3;
					break;
			}

			_fileter2_type_change();
		}
	};

	/* 메뉴 변경 */
	var _fileter2_type_change = function() {
		$("#filter_2 > p").empty();

		$(".tabLine-round_M li").removeClass("active");
		$(".tabLine-round_M li").eq(4).addClass("active");

		if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 0) {
//			var season_FreeState = $("#season_FreeState").val();
//
//			if(season_FreeState == 'N')
//			{
//				$("body").css("height", "100%");
//				$("body").css("overflow", "hidden");
//				$("#pre_Area").show();						
//				$("#pre_Area").addClass("top");
//				//$("#exam_midend").text("");
//				$("#exam_type").text($("#exam_type").text().replace("학교별 AI기출변형은", "학교별 기출 무료 열람실은"));
//				$("#exam_type").text($("#exam_type").text().replace("직전대비는", "학교별 기출 무료 열람실은"));
//				$("#exam_date").text($("#exam_date").text().replace("4월 2일", "3월 12일"));
//			}
//			else
//			{
//				$("#pre_Area").hide();
//
//				selectedInfo.si2Index = 0;
//				selectedInfo.gu2Index = 0;
//				selectedInfo.sch2Index = 0;
//				selectedInfo.grade2Index = 0;
//				selectedInfo.subject2Index = 0;
//				selectedInfo.year2Index = 0;
//				selectedInfo.term2Index = 0;
//
//				//filter_2.querySelector("[id='err_msg']").innerText = '';
//				$("#div_Img").show();
//
//				_drawList(null);
//			}
		} 
		else {
			if(pop2TypeItems[selectedInfo.type2Index].Index == 8)
			{
				var season_State = $("#season_State").val();

				if(season_State == 'N')
				{
					$("body").css("height", "100%");
					$("body").css("overflow", "hidden");
					$("#pre_Area").show();					
					$("#pre_Area").addClass("top");
					$("#pre_Area").css("margin-top", "54px");
					//$("#exam_midend").text("2024년도 1학기 중간고사");	
					$("#exam_type").text($("#exam_type").text().replace("직전대비는", "학교별 AI기출변형은"));
					$("#exam_type").text($("#exam_type").text().replace("학교별 기출 무료 열람실은", "학교별 AI기출변형은"));
					$("#exam_date").text($("#exam_date").text().replace("3월 12일", "4월 2일"));
				}
				else
				{
//					var p_o = document.createElement("p");
//					p_o.innerHTML = "<span style='height:40px;padding-top:10px;display:inline-block;'>1학기 기말고사 AI기출변형 콘텐츠는 <span class='f_blue'>7월 21일까지</span> 다운로드 가능합니다.</span>";
//					document.getElementById("filter_2").prepend(p_o);

					$("#pre_Area").hide();
				}
			}
			else
			{
				$("#pre_Area").hide();
				$("body").css("height", "");
				$("body").css("overflow", "");
			}

			if ( mem_base_info.grade && !isNaN(mem_base_info.grade)) {
				selectedInfo.grade2Index = (parseInt(mem_base_info.grade) > 3) ? 2 : parseInt(mem_base_info.grade)- 1;
			} else {
				selectedInfo.grade2Index = 1;
			}
			selectedInfo.pub2Index = 0;

			// 학교별 기출유사 기본 과목 '전체'
			if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 7) {
				if(selectedInfo.grade2Index == 0)
				{
					selectedInfo.subject2Index = 0;
				}
				else
				{
					selectedInfo.subject2Index = 2;
				}
			} else {
				selectedInfo.subject2Index = 2;
			}

			// 지역별, 최빈, 최오 => 학년, 과목, 출판사, 년도, 학기 표시
			//if(selectedInfo.type2Index == 3) {
			if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 3 || parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 5 || parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 6) {
				if(selectedInfo.grade2Index == 2) {
					selectedInfo.subject2Index = 0;
				}
			}

			if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 4) {
//				if(selectedInfo.grade2Index == 1) {
//					selectedInfo.grade2Index = 2;
//				}
				selectedInfo.subject2Index = 0;
			}

			selectedInfo.year2Index = 0;
			selectedInfo.term2Index = 0;
			selectedInfo.fileType2Index = 0;
		}

		_setHierarchy();
		_setSelectedValue();
	}

	var textinfo_Show = function(kind_v)
	{
		var scl_name = sch2Items[selectedInfo.sch2Index].Name;

		$("#expect_scl_name").show();

		if(selectedInfo.sch2Index == 0)
		{
			$("#top_txt_area").html("학교 정보를 입력하여 개인맞춤<br>Ai기출유사 문항을 확인하세요.");
			$("#expect_scl_name").html("우리 학교 내신 대비를 위한 족보닷컴의 여러 콘텐츠들을 먼저 확인해보세요!");			
		}
		else
		{
			if(kind_v.toLowerCase() == "a")
			{
				$("#top_txt_area").html("Ai기출유사 - " + scl_name + "의 내신 경향을 심층 분석하여 유사한 문항으로 구성한 콘텐츠 입니다.");

				if(parseInt($("#ACnt").text()) == 0)
				{
					$("#expect_scl_name").html("<span style='color:#4272d2;'>" + scl_name + "</span>의 Ai기출유사 콘텐츠는 준비중입니다.<br>우리 학교 내신 대비를 위한 족보닷컴의 여러 콘텐츠들을 먼저 확인해보세요!");			
				}
				else
				{
					$("#expect_scl_name").html("우리 학교 내신 대비를 위한 족보닷컴의 여러 콘텐츠들을 먼저 확인해보세요!");			
				}
			}
			else if(kind_v.toLowerCase() == "b")
			{
				$("#top_txt_area").html("주변학교 - " + scl_name + "와 동일 출판사 교과서로 수업하는 주변 지역 학교의 Ai기출유사 콘텐츠 입니다.");				

				if(parseInt($("#BCnt").text()) == 0)
				{
					$("#expect_scl_name").html("<span style='color:#4272d2;'>" + scl_name + "</span>의 Ai기출유사 콘텐츠는 준비중입니다.<br>우리 학교 내신 대비를 위한 족보닷컴의 여러 콘텐츠들을 먼저 확인해보세요!");			
				}
				else
				{
					$("#expect_scl_name").html("우리 학교 내신 대비를 위한 족보닷컴의 여러 콘텐츠들을 먼저 확인해보세요!");			
				}
			}
			else if(kind_v.toLowerCase() == "c")
			{
				$("#top_txt_area").html("교육특구 - " + scl_name + "와 동일 출판사 교과서로 수업하는 교육특구 지역 학교의 Ai기출유사 콘텐츠 입니다.");

				if(parseInt($("#CCnt").text()) == 0)
				{
					$("#expect_scl_name").html("동일 출판사 교과서를 사용하는 교육특구의 콘텐츠는 준비중입니다.<br>우리 학교 내신 대비를 위한 족보닷컴의 여러 콘텐츠들을 먼저 확인해보세요!");			
				}
				else
				{
					$("#expect_scl_name").html("우리 학교 내신 대비를 위한 족보닷컴의 여러 콘텐츠들을 먼저 확인해보세요!");			
				}
			}
			else if(kind_v.toLowerCase() == "d")
			{
				$("#top_txt_area").html("전국학교 - " + scl_name + "와 동일 출판사 교과서로 수업하는 전국 학교의 Ai기출유사 콘텐츠 입니다.");

				if(parseInt($("#DCnt").text()) == 0)
				{
					$("#expect_scl_name").html("동일 출판사 교과서를 사용하는 전국학교의 콘텐츠는 준비중입니다.<br>우리 학교 내신 대비를 위한 족보닷컴의 여러 콘텐츠들을 먼저 확인해보세요!");			
				}
				else
				{
					$("#expect_scl_name").html("우리 학교 내신 대비를 위한 족보닷컴의 여러 콘텐츠들을 먼저 확인해보세요!");			
				}
			}
		}
		
		$("#info_expect_"+kind_v.toLowerCase()).show();
	}

	var _olddata_text = function() {
		var obj = root.querySelector("[data-act='oldData']");
		if(isOldData){
			obj.innerHTML = "<span class='is-bedge'>22개정</span>최신 개정자료 보기";
		} else {
			obj.innerHTML = "<span class='is-bedge'>15개정</span>이전 개정자료 보기";
		}
	}

	return {
		init:function() {
			_init();
		},
		getSelectedInfo:function() { return selectedInfo;}
		,
		initEvent: function(){
			_initEvent();
		},
		loadData_2_V: function()
		{
			_loadData_2_V();
		}
	};
}();

var mainCLS = {
	init : true,
	getIsAPP : function () {
        const url = new URL(location.href);
        return isValueEmpty(url.searchParams.get('isApp')) ? "" : url.searchParams.get('isApp').toUpperCase();
    },
	pageInit : function () {
		$("#fold1").prop("checked", false);
		$("#fold2").prop("checked", true);
		$(".productBlock").hide();
		$(".titleLine").removeClass('active');
	},
	setViewAppGoUI : function () {
		let isApp = this.getIsAPP();
		if (isValueEmpty(this.getIsAPP()) == false) {
			storage.setSession(storage.IS_APP, isApp);
			$("#viewAppGo").show();
			$("#oldData").hide(); //기획 요청으로 앱으로 진입시 비노출 처리
		} else {
			if (isValueEmpty(storage.getSession(storage.IS_APP)) == false) {
				$("#viewAppGo").show();
				$("#oldData").hide(); //기획 요청으로 앱으로 진입시 비노출 처리
			}
		}
	},
};