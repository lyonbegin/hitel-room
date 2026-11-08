/*
	고등 상품 목록
*/
var main = function() {
	var _id = "main";
	var _site_id = "H";
	var _is_previous_chk = false;
	var mem_base_info = {};
	var root = null;
	var isFirst = {"menu1":false, "menu2":false, "menu3":false, "menu4":false, "menu5":false}
	var menu_index = ["concept", "", "", "level", "real"]	// 대메뉴에 따른 서브메뉴 구성 구분
	var gradeJson = null;

	var param = null;

	var PageSize = 20;
	var Page = 1;
	var totalPage = 0;
	var totalCount = 0;
	var items = null;

	var imgBtn = null;
	var oldData_o = null;
	var isOldData = false;

	var selectedInfo = {};

	var _url_v = "";
	var _data_v = "";
	var _subject_v = "";
	var _yusa_si_name = "";		// 기출유사 랜딩 처리시 지역명에 사용할 전역변수

	//가족학원 유무 채크
	var EducationCheck = 0;
	var loginCheck = 0;

	var iPhonePopChk = true;
	var MathStepIndex = 0;

	if(location.search == "?menu=3")
	{
		var popGradeItems = [{"Name":"1학년", "Value":"1"},
		{"Name":"2학년", "Value":"2"}
		];
	}
	else
	{
		var popGradeItems = [{"Name":"1학년", "Value":"1"},
		{"Name":"2,3학년", "Value":"2"}
		];
	}

	var popGroupItems = [];
	var popYearItems = [{"Name":"", "Value":""}];
	var popSubjectItems = [];
	var popSubItems = [];
	var pop2TypeItems = [
		{"Name":"학교별 기출 무료 열람실", "value":"", "Index":"0", "menuCD":"000020000500001"},
		//{"Name":"학교별 기출유사", "value":"A", "Index":"7", "menuCD":"000020000500002"},
		//{"Name":"학교별 기출족보", "value":"A", "Index":"1"},
		{"Name":"학교별 예상족보", "value":"V", "Index":"2", "menuCD":"000020000500004"},
		//{"Name":"최다빈출 문제", "value":"H", "CoreType":"D", "Index":"5"},
        //{"Name":"최다오답 문제", "value":"H", "CoreType":"E", "Index":"6"},
		//{"Name":"지역별 문제", "value":"I", "Index":"3"},
		{"Name":"강남 3구 유형공략", "value":"K3", "Index":"4", "menuCD":"000020000500005"}
	];

	var popGrade2Items = null;
	var gu2Items = [];
	var sch2Items = [];
	var fileType2Items = [{"Name":"원본형 + 편집용", "Value":""}, {"Name":"편집용", "Value":"4"}];

	var subject3Items = [];
	var tx3Items = [];
	var chapter3Items = [];

	var levelItems = [];

	var sub3Items = [{"Name":"기본학습", "Value":"1"},
						{"Name":"실전적용", "Value":"2"}
						];

	var pubItems = [];

	// 영문법
	var grammerYearItems = [{"Name": "기초", "Value": "1"},
		{"Name": "기본", "Value": "2"},
		{"Name": "심화", "Value": "3"},
		{"Name": "완성", "Value": "4"},
	];

	// 구문독해
	var popEngParseItems = [{"Name": "기초", "Value": "6"},
		{"Name": "기본", "Value": "7"},
		{"Name": "심화", "Value": "8"}
	];

	var korCateArr = [];	// 시대별문학 카테고리
	var rootpart_codes = null;

	var grammerKindItems = [{title: "동영상", Value: ""}, {title: "다운로드", Value: ""}];

	var popSubItems = null;

	var popChapterItems = [];

	var popTxItems = null;

	var errorItems = [
		{"Name":"오답신고", "value":"2"},
		{"Name":"불량신고", "value":"3"},
		{"Name":"건의사항", "value":"5"}
	];

	var pageCnt = 0;

	var page_Act_Chk = true;	 //학년, 과목, 구분값 클릭시만 true

	var popSubjDetailItems = null;

	var activeRow = null;

	var isTimeLiterary = false;

	var _add_diff = "";
	var p_add_diff = ""
	var _chapterDatas = [];
	var term2_ServiceYN;
	var revision22_contents_yn = "N";
	var oldData_flag = false;

	var _init = function() {
		/*
			menu = {"1":"개념학습", "2": "우리학교족보", "4": "수준별학습", "5": "실전대비"}
		**/
		var this_val = document.querySelector("#fixMenu02");
			$(this_val).addClass("on");

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
			if (param.grade == 1) {//고1만 세부과목 이동 나머지는 개념완성
				if(param.subject == 1) {//영어일 경우
					if (param.group == 1) {//영문법
						location.href = "/exam/examListWeb.asp?menu_cd=000020000100002&siteid=H&subject_cd=EG";
						return;	
					} else if (param.group == 2) {//구문독해
						location.href = "/exam/examListWeb.asp?menu_cd=000020000100003&siteid=H&subject_cd=EG";
						return;	
					}
				}
				
				if(param.subject == 2) {//수학일 경우
					if (param.group == 1) {//계산력문제
						location.href = "/exam/examListWeb.asp?menu_cd=000020000100004&siteid=H&subject_cd=MT";
						return;	
					}
				}
			}
			
			//나머지 개념완성으로 리다이렉트
			location.href = "/exam/examListWeb.asp?menu_cd=000020000100001&siteid=H&subject_cd=MT";
			return;			
		}

		if(param.menu == 3)
		{
			location.href = '/Default.asp';
			return;
		}

		if(param.menu == 4 && param.oldData != "Y") {//Ai 수준별학습 리뉴얼 페이지로 이동
			if (param.group == "1") {//수학MASTER랜딩
				location.href = '/exam/examListWeb.asp?menu_cd=000020000200002&siteid=H&subject_cd=MT';				
			} else {//수준별학습
				location.href = '/exam/examListWeb.asp?menu_cd=000020000200003&siteid=H&subject_cd=MT';
			}
			return;			
		}

		if(param.menu == 5 && param.oldData == "Y") {
			isOldData = true;
		}

		if(param.menu == 5 && param.oldData != "Y") {//실전대비 > 리뉴얼 페이지로 이동
			if(param.learningtest == "Y") {
				let menucd = "0000200003";
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

				location.href = "/exam/examListWeb.asp?menu_cd=" + menucd + "&siteid=H&subject_cd=" + subject_cd + "&grade=" + param.grade;
				return;
			} else {
				location.href = "/exam/examListWeb.asp?menu_cd=000020000300001&siteid=H&subject_cd=MT";
				return;
			}
		}

		if(param.menu == 6) {//직전대비 리뉴얼 페이지로 이동
			location.href = "/exam/examListWeb.asp?menu_cd=000020000400001&siteid=H&subject_cd=MT";
			return;
		}

		//console.log("param=" + JSON.stringify(param));
		root = document.querySelector("[data-id='" + _id + "']");
		imgBtn = document.querySelector("#bindo");
		if(imgBtn) imgBtn.style.display = "none";

		commonGLB.setStorage(storage.SEARCH_MENU_CD, "");//메뉴코드 초기화

		setInitConfig(function() {
			if(selectedInfo.menuIndex == 4 && selectedInfo.groupIndex == 3) {//실전대비 > 최상위공략
				location.href = "/H/exam_top_table.asp";
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
						//if(selectedInfo.menuIndex != 1 && parseInt(pop2TypeItems[selectedInfo.type2Index].Index) != 2)
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

//			// 인피니티 스크롤 관련
//			$(window).scroll(function() {
//				var scrollHeight = $(document).height();
//				var scrollPosition = $(window).height() + $(window).scrollTop();
//				if ((scrollHeight - scrollPosition) / scrollHeight === 0) {
//					_hLog("totalPage=" + totalPage + ", curr=" + Page);
//					if(totalPage > Page) {
//						Page++;
//						_loadData();
//					}
//				} else {
//				}
//			});

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
						//{"Name":"학교별 기출유사", "value":"A", "Index":"7", "menuCD":"000020000500002"},
						{"Name":"학교별 기출변형", "value":"W", "Index":"8", "menuCD":"000020000500003"},
						{"Name":"학교별 기출족보", "value":"A", "Index":"1"},
						{"Name":"학교별 예상족보", "value":"V", "Index":"2", "menuCD":"000020000500004"},
						//{"Name":"최다빈출 문제", "value":"H", "CoreType":"D", "Index":"5"},
						//{"Name":"최다오답 문제", "value":"H", "CoreType":"E", "Index":"6"},
						//{"Name":"지역별 문제", "value":"I", "Index":"3"},		
						{"Name":"강남 3구 유형공략", "value": "K3", "Index":"4", "menuCD":"000020000500005"},
						//{"Name":"빠른족보", "value":"", "Index":"9"}
					];
				} else {
					_is_previous_chk = false;
					pop2TypeItems = [
						//{"Name":"학교별 기출 무료 열람실", "value":"", "Index":"0"},
						//{"Name":"학교별 기출유사", "value":"A", "Index":"7", "menuCD":"000020000500002"},
						{"Name":"학교별 기출변형", "value":"W", "Index":"8", "menuCD":"000020000500003"},
						{"Name":"학교별 예상족보", "value":"V", "Index":"2", "menuCD":"000020000500004"},
						//{"Name":"최다빈출 문제", "value":"H", "CoreType":"D", "Index":"5"},
						//{"Name":"최다오답 문제", "value":"H", "CoreType":"E", "Index":"6"},						
						{"Name":"학교별 기출 무료열람실<span class='mo-label grade15 mid' style='margin-left:10px;height:17px;line-height:17px;margin-top:-3px;'>무료열람</span>", "value":"", "Index":"0"},
						{"Name":"강남 3구 유형공략", "value": "K3", "Index":"4", "menuCD":"000020000500005"},
						//{"Name":"빠른족보", "value":"", "Index":"9"}
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
		//var gradeSet_v = localStorage.getItem("gradeSet1");	// 학년 설정 값
		var gradeSet_v = null;		// 기본 설정 사용 안함 (정효태, 2022.02.22)
		var data_h_v = localStorage.getItem("data_h");		// 쿠키 저장 값
		var gradeSet_o = null
		if(gradeSet_v) {
			gradeSet_o = eval("(" + gradeSet_v + ")");
			gradeJson = gradeSet_o;
		}
		if(data_h_v) {
			selectedInfo = eval("(" + data_h_v + ")");			
		}

		// 기출 노출 여부
		//var is_previous_chk = false;		
		if(param.menu == 2 || param.sms) {
			_setPreviousCheck();
		}
		// E

		// 2) 기존 로직 적용 (바깥에 있던걸 안으로 이동)		
		_hLog("gradeSet=" + JSON.stringify(gradeSet_o));
		var isParam = false;

		if(param != null && param.menu != null) {
			selectedInfo.menuIndex = param.menu - 1;

			// S : <기출, 예상> 기본 학년정보 설정
			if (selectedInfo.menuIndex == 1) {		// 학교별 족보에서만 필요
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
					// 기출유사 랜딩일 경우 셋팅정보를 따로 받아옴
				}
				else
				{
					var url_v = "/_api/member.api.asp";
					var data_v = "cmd=GET_MEMBER_INTEGRATION_BASE_INFO&flag=H";
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
									if (parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 1) {		// 기출족보 (1~3학년)										
										selectedInfo.grade2Index = (parseInt(mem_base_info.grade) > 3) ? 2 : parseInt(mem_base_info.grade)- 1;
									} else if (parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 2) {		// 예상족보 (1~2학년)										
										selectedInfo.grade2Index = (parseInt(mem_base_info.grade) > 2) ? 1 : parseInt(mem_base_info.grade)- 1;
									}
								} else {									
									selectedInfo.grade2Index = 0;
								}
							}
							else
							{
								if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 0)
								{
									selectedInfo.si2Index = 0;
								}
							}
						}
					});
				}
			}
			// E

			if (selectedInfo.menuIndex == 5) {
				if(selectedInfo.gradeIndex == 0)
				{
					if(selectedInfo.subjectIndex > 5)
					{
						selectedInfo.subjectIndex = 2;
					}
				}
				else
				{
					if(selectedInfo.subjectIndex > 4)
					{
						selectedInfo.subjectIndex = 2;
					}
				}
			}

			//수준별 AI 학습 내 이전 개정 자료 보기 시
			if (selectedInfo.menuIndex == 3 && param.oldData == "Y") {
				param.grade = 1
			}

			if((param.qry != null && param.qry != "") || (param.qryN != null && param.qryN != "")){
				// 통합검색에서 고등 페이지 진입시 값 설정
				isParam = true;
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
				}
				else if(selectedInfo.menuIndex == 2) {
					if(param.qry != null && param.qry != "") {
						var qry_o = root.querySelector("#filter_3 [name='qry']");
						if(qry_o) {
							qry_o.value = param.qry;
						}
					}
				}

			} else if(param.type != "" && param.type != null){
				if(selectedInfo.menuIndex == 1) {
					//selectedInfo.type2Index = param.type;
					selectedInfo.type2Index = (_is_previous_chk || parseInt(param.type) < 3) ? param.type : (parseInt(param.type)-1);
				}
			}


			// 족보가이드 페이지에서 진입시 값 설정 start
			if(param.grade != "" && param.grade != null) {
				if(selectedInfo.menuIndex == 0 || selectedInfo.menuIndex == 3 || selectedInfo.menuIndex == 4 || selectedInfo.menuIndex == 5) {
					selectedInfo.gradeIndex = parseInt(param.grade) -1;
				}
				// 추가작업 / 2020-11-11 / 김진국
				else if (selectedInfo.menuIndex == 1) {
					selectedInfo.grade2Index = parseInt(param.grade) -1;
				}
			}

			if(param.subject != "" && param.subject != null) {
				if(selectedInfo.menuIndex == 0 || selectedInfo.menuIndex == 3 || selectedInfo.menuIndex == 4 || selectedInfo.menuIndex == 5) {
					selectedInfo.subjectIndex = param.subject;
					if (typeof(pop2TypeItems[selectedInfo.gradeIndex]) == "undefined") { selectedInfo.gradeIndex = 0; }
					popSubjectItems = Object.values(_Unit[_site_id + (selectedInfo.gradeIndex-0+1)]);
					selectedInfo.subjectCode = popSubjectItems[selectedInfo.subjectIndex].Value;
					selectedInfo.subjectName = popSubjectItems[selectedInfo.subjectIndex].Name;
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
			// 족보가이드 페이지에서 진입시 값 설정 end

			// S : sms발송용 링크 만들기
			if (param.sms) {
				if (param.menu == 1) {		// 내신완성
					// 공통
					if (param.sms == 1 || param.sms == 2 || param.sms == 3 || param.sms == 4) {
						selectedInfo.subjectCode = "MT";
						selectedInfo.subjectName = "수학";
						selectedInfo.txIndex = 0;
						selectedInfo.yearIndex = 0;
						selectedInfo.termIndex = 0;
						selectedInfo.chapterIndex = 0;
						selectedInfo.yearIndex = 0;
						selectedInfo.termIndex = 0;

						// 기본값 1학년
						if(param.grade == "" || param.grade == null || param.grade == undefined) {
							param.grade = 1;
						}
					}

					if (param.grade == 1) {
						selectedInfo.subjectIndex = 2;		// 수학~
					} else if (param.grade == 2) {
						selectedInfo.subjectIndex = 7;		// 수학~
					}

					if (param.sms == 1) {
						selectedInfo.gradeIndex = parseInt(param.grade) -1;
						selectedInfo.groupIndex = 1;		// 1은 단원별~
						//selectedInfo.subjectIndex = 3;		// 3는 수학~
					} else if (param.sms == 2) {
						selectedInfo.gradeIndex = parseInt(param.grade) -1;
						//selectedInfo.subjectIndex = 3;		// 3는 수학~
						selectedInfo.groupIndex = 8;		// 8은 수학 교과서 변형~
					}
					/*else if (param.sms == 3) {
						selectedInfo.gradeIndex = parseInt(param.grade) -1;
						selectedInfo.groupIndex = 3;		// 3은 최다빈출~
						//selectedInfo.subjectIndex = 3;		// 3는 수학~
					} else if (param.sms == 4) {
						selectedInfo.gradeIndex = parseInt(param.grade) -1;
						selectedInfo.groupIndex = 4;		// 4는 최다오답~
						//selectedInfo.subjectIndex = 3;		// 3는 수학~
					}
					*/
				} else if (param.menu == 2) {		// 학교별족보
					selectedInfo.menuIndex = 1

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

					// 공통 설정
					{
						if ( param.grade && !isNaN(param.grade)) {
							selectedInfo.grade2Index = parseInt(param.grade) - 1;
						} else {
							selectedInfo.grade2Index = 0;
						}

						selectedInfo.pub2Index = 0;
						selectedInfo.subject2DetailIndex = 0;
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
					});
				}
			}
			// E : sms발송용 링크 만들기
			
			if(param.yusa == "Y")
			{
				if(param.grade == 2)
				{
					selectedInfo.grade2Index = 1;
				}
				else
				{
					selectedInfo.grade2Index = param.grade;
				}
			}
		}
		else {
			selectedInfo.menuIndex = 0;
		}

		// 통합검색이 아닌경우
		if(isParam == false) {
			// 학년설정값을 토대로 값 설정
			if(gradeSet_o) {				
				var grade_v = parseInt(gradeSet_o.grade.substring(1));
				if(selectedInfo.menuIndex == 0 || selectedInfo.menuIndex == 3 || selectedInfo.menuIndex == 4) {
					if(gradeSet_o.grade == "H1" || gradeSet_o.grade == "H2" || gradeSet_o.grade == "H3") {
						selectedInfo.gradeIndex = grade_v - 1;
						if(gradeSet_o.grade == "H3") {
							// 단원문제의 3학년이 2학년과 통합이 된 관계로 학년설정에서 3학년 설정시 2,3학년이 설정되도록 수정
							selectedInfo.gradeIndex = grade_v - 2;
						}
					}
					if(typeof(_cback) == "function") { _cback();}
				}
				else if(selectedInfo.menuIndex == 1) {
					if(gradeSet_o.grade == "H1" || gradeSet_o.grade == "H2" || gradeSet_o.grade == "H3") {
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
					if(gradeSet_o.grade == "H1" || gradeSet_o.grade == "H2" || gradeSet_o.grade == "H3") {
						selectedInfo.grade3Index = grade_v - 1;
						// 고득점마스터의 3학년이 2학년과 통합이 된 관계로 학년설정에서 3학년 설정시 2학년이 설정 되도록 수정
						if(gradeSet_o.grade == "H3") {
							selectedInfo.grade3Index = grade_v - 2;
						}
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
			EducationCheck = data.RESULTCODE;  // 1 : 가족학원, 0 : 일반
		});

		var url_vv = "/_api/member.api.asp";
		var data_vv = "cmd=ISLOGIN";
		comm.send(url_vv, data_vv, "post", function(data) {
			loginCheck = data.user_id;  // 1 : 가족학원, 0 : 일반
		});

		if(param.menu == 1 || param.menu == 4 || param.menu == 5 || param.menu == 6) {			
			if(param.tx_code){
				selectedInfo.txIndex = param.tx_code;
			}

			// 국어 고등 시대별 문학 기본값 설정 => 일제강점기
			//if(selectedInfo.groupIndex == 6 && selectedInfo.subjectCode == "KR") {
			//	selectedInfo.txIndex = 4;
			//}

			// 영문법 페이지 배너, url 직접 접근 시 완성 컨텐츠가 고정된 상태로 표시
			//if(selectedInfo.groupIndex == 6 && selectedInfo.subjectCode == "EG")
			//{
			//	selectedInfo.yearIndex = 3;
			//}

			// 구해줘 족보 이벤트에서 접속시 처리
			if(param.seek){
				selectedInfo.gradeIndex = param.grade - 1;
				selectedInfo.subjectCode = param.subjectCode;
				selectedInfo.subjectIndex = param.subject;
				selectedInfo.groupIndex = param.group;

				if(param.group == 1){
					if(param.grade == 1 || param.grade == 2){
						if(selectedInfo.subjectCode == "EG" && selectedInfo.subject == 5){
							selectedInfo.txIndex = param.tx_code;
						}
						else{
							selectedInfo.txIndex = param.tx_code - 1;
						}

						if(selectedInfo.txIndex < 0){
							selectedInfo.txIndex = 0;
						}
					}
					else if(param.grade == 3){
						if(param.subjectCode == "KR"){
							selectedInfo.groupIndex = 2;
							selectedInfo.txIndex = 0;
						}
						else if(param.subjectCode == "HI"){
							selectedInfo.groupIndex = 3;
							selectedInfo.txIndex = 0;
						}
						else{
							selectedInfo.groupIndex = 3;
							selectedInfo.txIndex = param.tx_code;
						}
					}
				}
				else if(param.group == 4){
					if(param.grade == 1){
						if(param.subjectCode == "KR" && param.subject == 1){
							selectedInfo.groupIndex = param.group - 1;
						}

						if(param.subjectCode == "MT" || param.subjectCode == "SC"
							|| param.subjectCode == "LS" || param.subjectCode == "HI"){
							selectedInfo.txIndex = 0;
						}
						else{
							selectedInfo.txIndex = param.tx_code;
						}
					}
					else if(param.grade == 2){
						if(param.subjectCode == "KR" && param.subject == 0){
							selectedInfo.subjectIndex = 3;
							selectedInfo.txIndex = 0;
						}
						else if(param.subjectCode == "MT"){
							selectedInfo.subjectIndex = 7;
						}
						else if(param.subjectCode == "SC"){
							selectedInfo.subjectIndex = 8;
						}
						else if(param.subjectCode == "LS"){
							selectedInfo.subjectIndex = 9;
						}
						else if(param.subjectCode == "HI"){
							selectedInfo.subjectIndex = 10;
							selectedInfo.txIndex = 0;
						}
					}
				}
				_setHierarchy();
				popTxItems = _Hierarchy[selectedInfo.gradeIndex].Subj_Code[selectedInfo.subjectIndex].TX_CODE;								
			}

			// 학년설정값 있을 경우 기본값 설정
			if( gradeJson && gradeJson.grade.indexOf("H") > -1) {
				var grade_v = selectedInfo.gradeIndex;

				if(grade_v == 0) {
					selectedInfo.subjectIndex = 3;
					selectedInfo.subjectCode = "MT";
					selectedInfo.subjectName = "수학";
					selectedInfo.groupIndex = 0;
				} else if(grade_v == 1) {
					selectedInfo.subjectIndex = 7;
					selectedInfo.subjectCode = "MT";
					selectedInfo.subjectName = "수학 영역";
					selectedInfo.groupIndex = 0;
				} else if (grade_v == 2) {
					selectedInfo.subjectIndex = 1;
					selectedInfo.subjectCode = "MT";
					selectedInfo.subjectName = "수학 영역";
					selectedInfo.groupIndex = 0;
				}

				selectedInfo.yearIndex = 0;
				selectedInfo.termIndex = 0;
				selectedInfo.txIndex = 0;
				selectedInfo.chapterIndex = 0;
				selectedInfo.chapterData = [];
				selectedInfo.levelIndex = 0;
				selectedInfo.levelData = [];
			}

			if(selectedInfo.gradeIndex == null) selectedInfo.gradeIndex = 0;
			if(selectedInfo.subjectCode == null) selectedInfo.subjectCode = "MT";
			if(selectedInfo.subjectName == null) selectedInfo.subjectName = "수학";
			if(selectedInfo.groupIndex == null) selectedInfo.groupIndex = 0;
			_setHierarchy();
			if(selectedInfo.subjectCode == "G") selectedInfo.termIndex = 1;
			if(selectedInfo.subjectIndex == null) selectedInfo.subjectIndex = 2;
			if(selectedInfo.txIndex == null) selectedInfo.txIndex = 0;
			if(selectedInfo.yearIndex == null) selectedInfo.yearIndex = 0;			
			if(selectedInfo.termIndex == null || selectedInfo.termIndex > 4) selectedInfo.termIndex = 0;
			if(selectedInfo.chapterData == null) selectedInfo.chapterData = [];
			if(selectedInfo.levelIndex == null) selectedInfo.levelIndex = 0;
			if(selectedInfo.levelData == null) selectedInfo.levelData = [];

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
		else if(param.menu == 2) {
			
			if (typeof(pop2TypeItems[selectedInfo.type2Index]) == "undefined") { selectedInfo.type2Index = 0; }
			if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 0)
			{				
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

					if(param.grade == 2){
						if(param.subjectCode == "SC"){
							selectedInfo.subject2Index = 5;
						}
						else if(param.subjectCode == "LS"){
							selectedInfo.subject2Index = 9;
						}
					}
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

				if(selectedInfo.type2Index == null) selectedInfo.type2Index = 0;
				if(selectedInfo.si2Index == null) selectedInfo.si2Index = 0;
				if(selectedInfo.gu2Index == null) selectedInfo.gu2Index = 0;
				if(selectedInfo.sch2Index == null) selectedInfo.sch2Index = 0;
				if(selectedInfo.grade2Index == null) selectedInfo.grade2Index = 0;
				if(selectedInfo.gradeK3Index == null) selectedInfo.gradeK3Index = 0;
				_setHierarchy();

				if(pop2TypeItems[selectedInfo.type2Index].Index == "4") {
					if(selectedInfo.subject2Index == null) selectedInfo.subject2Index = 0;
				} else {
					if(selectedInfo.subject2Index == null) selectedInfo.subject2Index = 2;
				}

				if(selectedInfo.subject2DetailIndex == null) selectedInfo.subject2DetailIndex = 0;
				if(selectedInfo.year2Index == null) selectedInfo.year2Index = 0;
				if(selectedInfo.term2Index == null) selectedInfo.term2Index = 0;
				if(selectedInfo.fileType2Index == null) selectedInfo.fileType2Index = 0;

				if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 1) {
					common.toast("학교를 선택해 주세요.", null);
				}
				if(selectedInfo.pub2Index == null) selectedInfo.pub2Index = 0;

				// 기출유사 랜딩 처리 고도화 (2024.07.10)
				if(param.yusatype == "Y") {										
					//param.yusatype = "";	// 최초 1회 실행 위해
					// 기본값					
					selectedInfo.subject2Index = 3;
					if(param.grade == 1) {
						selectedInfo.subject2Index = 1;
					} else if (param.grade == 3) {
						selectedInfo.grade2Index = 1;	// 고등 3학년인 경우 2,3학년으로 표시 위해
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

					if(param.year != 2023 && param.year != 2022 && param.year != 2021)
					{
						selectedInfo.year2Index = 0;
					}
					else
					{
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

					if(param.year == 2021 && (param.midend == "1M" || param.midend == "1E")) {
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
					// 1) 기본 과목
					_Hierarchy[selectedInfo.grade2Index].Subj_Code.forEach(function(d, i) {						
						if (d.Value == param.subj) {							
							selectedInfo.subject2Index = i;
						}
					});

					// 2) 상세과목
					var t_yusa_subj_detail_items = null;
					//if(selectedInfo.grade2Index == 1) {
					if(selectedInfo.grade2Index != 0) {
						/*
						if(param.subj == "KR" || param.subj == "EG") {							
							t_yusa_subj_detail_items = _Unit[_site_id + (selectedInfo.grade2Index-0+1)][param.subj+'1']["subDetail"];							
						} else if(param.subj == "MT" || param.subj == "SC" || param.subj == "LS") {							
							t_yusa_subj_detail_items = _Unit[_site_id + (selectedInfo.grade2Index-0+1)][param.subj]["subDetail"]
						}
						*/
						if(param.subj == "KR") {
							t_yusa_subj_detail_items = [{Name: '문학', Value: '문학'}, {Name: '독서', Value: '독서'}, {Name: '언어와 매체', Value: '언어와 매체'}]
						} else if (param.subj == "EG") {
							t_yusa_subj_detail_items = [{Name: '영어Ⅰ', Value: '영어Ⅰ'}, {Name: '영어Ⅱ', Value: '영어Ⅱ'}, {Name: '영어 독해와 작문', Value: '영어 독해와 작문'}]
						} else if (param.subj == "MT") {
							t_yusa_subj_detail_items = [{Name: '수학Ⅰ', Value: '수학Ⅰ'}, {Name: '수학Ⅱ', Value: '수학Ⅱ'}, {Name: '확률과 통계', Value: '확률과 통계'}, {Name: '미적분', Value: '미적분'}, {Name: '기하', Value: '기하'}]
						} else if (param.subj == "SC") {
							t_yusa_subj_detail_items = [{Name: '물리학Ⅰ', Value: '물리학Ⅰ'}, {Name: '화학Ⅰ', Value: '화학Ⅰ'}, {Name: '생명과학Ⅰ', Value: '생명과학Ⅰ'}, {Name: '지구과학Ⅰ', Value: '지구과학Ⅰ'}]
						} else if (param.subj == "LS") {
							t_yusa_subj_detail_items = [{Name: '사회문화', Value: '사회문화'}, {Name: '한국지리', Value: '한국지리'}, {Name: '생활과 윤리', Value: '생활과 윤리'}, {Name: '윤리와 사상', Value: '윤리와 사상'}, {Name: '정치와 법', Value: '정치와 법'}]
						}

						if(t_yusa_subj_detail_items != null) {
							t_yusa_subj_detail_items.forEach(function(d, i) {							
								if (d.Value == param.subj_d) {
									selectedInfo.subject2DetailIndex = i;
								}
							});
						}
					}
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
		else if(param.menu == 3) {
			document.querySelector(".txtNotice0716").style.display = "";
			_setHierarchy();
			if(selectedInfo.grade3Index == null) selectedInfo.grade3Index = 0;
			if(selectedInfo.subject3Index == null) selectedInfo.subject3Index = 2;
			if(selectedInfo.tx3Index == null) selectedInfo.tx3Index = 0;
			if(selectedInfo.chapter3Index == null) selectedInfo.chapter3Index = 0;
			if(selectedInfo.sub3Index == null) selectedInfo.sub3Index = 0;
		}
		if (param.isFirst != "Y") {
			_setSelectedValue();
		}
	};

	// 쿠키값 저장 위한 함수
	var _saveInitData = function() {
		if(selectedInfo) {
			localStorage.setItem("data_h", JSON.stringify(selectedInfo));
		}
	};

	// 데이터 그리기위한 초기화 작업
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
//			row_A.style.display = "";
//			row_B.style.display = "none";
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
			goPnl.style.display = "";
			goPnl.style.display = "none";
			pnlImg.style.display = "none";
			f_1.style.display = "none";
			f_2.style.display = "none";
			f_3.style.display = "";
			row_A.style.display = "none";
			row_B.style.display = "none";
			row_C.style.display = "";
			$("#zocboInfo").hide();
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
		//li_o = li_a[menuIndex];
		//li_o = $("#mnu_"+menuIndex);	// index 방식에서 id select 방식으로 변경
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

	// 하이라키 초기화
	var _setHierarchy = function() {		
		if (selectedInfo.menuIndex == 0 || selectedInfo.menuIndex == 3 || selectedInfo.menuIndex == 4 || selectedInfo.menuIndex == 5) {
			var group_v = "C";
			var coreType_v = "";			

			if (popGroupItems.length > 0) {
				if (typeof popGroupItems[selectedInfo.groupIndex] == "undefined") {
					selectedInfo.groupIndex = 0;
				}	

				group_v = popGroupItems[selectedInfo.groupIndex].Value;
				coreType_v = popGroupItems[selectedInfo.groupIndex].CoreType;

				var grade_v = popGradeItems[selectedInfo.gradeIndex].Value;

				if(grade_v == "2" && (group_v == "M" || (group_v == "K" || coreType_v == "B1") || (group_v == "P" || coreType_v == "B1") || (group_v == "H" && (coreType_v == "D" || coreType_v == "E" || coreType_v == "")))) {
					revision22_contents_yn = "Y";
				} else {
					revision22_contents_yn = "N";
				}

				if (isValueEmpty(popGroupItems[selectedInfo.groupIndex].menuCD) == false) {
					if (commonGLB.getMenuCD() !== popGroupItems[selectedInfo.groupIndex].menuCD) {
						commonGLB.setStorage(storage.SEARCH_MENU_CD, popGroupItems[selectedInfo.groupIndex].menuCD);//메뉴코드 셋팅
					}
				} else {
					commonGLB.setStorage(storage.SEARCH_MENU_CD, "");
				}
			}

			if (coreType_v == null) coreType_v = "";

			if(popGradeItems[selectedInfo.gradeIndex].Value == "2" && isOldData == true && revision22_contents_yn == "Y") {
				selectedInfo.subjectName = popSubjectItems[selectedInfo.subjectIndex].Name;
				Hierarchy_Init(_site_id, "OLD", "");
			} else {
				Hierarchy_Init(_site_id, group_v, coreType_v);

				// group_v, coretype_v에 해당하는 하이러키내용이 없을 경우 기본값으로 초기화
				if (_Hierarchy == undefined) {				
					Hierarchy_Init(_site_id, "C", "");
				}
			}
		} else if (selectedInfo.menuIndex == 1) {

			var group_v = "A";
			var coretype_v = "";

			switch(parseInt(parseInt(pop2TypeItems[selectedInfo.type2Index].Index))) {
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
				case 3:
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

			if(coretype_v != "A")
			{				
				if(selectedInfo.subject2Index == null) selectedInfo.subject2Index = 2;
			}

			if(selectedInfo.grade2Index == 1 && coretype_v != "E") {
				if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) != 7)
				{
					if(selectedInfo.subject2Index == null) selectedInfo.subject2Index = 0;
				}
			}

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

	// 필터 값 설정
	var _setSelectedValue = function() {
		/* 학교별 기출유사 Nodata관련 : 초기화 처리 */
		var viewSelect_o = root.querySelector(".new-tab-freereading");
		viewSelect_o.style.display = "none";
		$(".nologin-view").hide();
		$(".new-tab-title").hide();
		$(".expect_info").hide();

		comm.toggleLoading(true);
		Page = 1;
		popSubItems = _term;
		rootpart_codes = null;

		if(selectedInfo.menuIndex == 0 || selectedInfo.menuIndex == 3 || selectedInfo.menuIndex == 4 || selectedInfo.menuIndex == 5) {
			_setSelectedValueForFilter1();
			rootpart_codes = null;	// 수행평가에서 사용
		}
		else if(selectedInfo.menuIndex == 1) {
			_setSelectedValueForFilter2();
		}
		else if(selectedInfo.menuIndex == 2) {
			_setSelectedValueForFilter3();
		}
	};

	// 단원문제 필터값 설정
	var _setSelectedValueForFilter1 = function() {
		var filter_1 = root.querySelector("#filter_1");
		if(filter_1) {
			_setSelectedValueForFilter1Sub();
		}
	};

	var _setSelectedValueForFilter1Sub = function() {
		var filter_1 = root.querySelector("#filter_1");
		popGroupItems = [];
		if(filter_1) {
			$("#fold1").prop("checked", true);

			var obj = filter_1.querySelector("[data-act='filter_grade']");
			obj.innerHTML = popGradeItems[selectedInfo.gradeIndex].Name;
			
			if(oldData_flag == true) {				
				var current_subject = popSubjectItems[selectedInfo.subjectIndex].Value;
				var current_subjectName = popSubjectItems[selectedInfo.subjectIndex].Name.replace(/\s+/g, "");
				var grade_v = popGradeItems[selectedInfo.gradeIndex].Value;

				if(isOldData == true) {					
					if(current_subject == "KR") {
						if(current_subjectName == "언어와매체") {
							selectedInfo.subjectIndex = 1;
						} else {
							selectedInfo.subjectIndex = 0;
						}
					} else if(current_subject == "MT") {
						selectedInfo.subjectIndex = 2;
					} else if(current_subject == "SC") {
						selectedInfo.subjectIndex = 3;
					} else if(current_subject == "LS") {
						selectedInfo.subjectIndex = 4;
					} else if(current_subject == "HI") {
						selectedInfo.subjectIndex = 5;
					}
				} else {
					if(grade_v == "2") {
						if(current_subject == "KR") {
							selectedInfo.subjectIndex = 0;
						} else if(current_subject == "MT") {
							selectedInfo.subjectIndex = 5;
						} else if(current_subject == "SC") {
							selectedInfo.subjectIndex = 6;
						} else if(current_subject == "LS") {
							selectedInfo.subjectIndex = 7;
						} else if(current_subject == "HI") {
							selectedInfo.subjectIndex = 8;
						}
					} else {
						if(current_subject == "SC") {
							selectedInfo.subjectIndex = 3;
						}
					}
				}
			}

			if(popGradeItems[selectedInfo.gradeIndex].Value == "2" && isOldData == true && revision22_contents_yn == "Y") {
				if(selectedInfo.menuIndex == 0) {
					if(selectedInfo.groupIndex == 1) {
						popSubjectItems = Object.values(_New_Unit[_site_id + (selectedInfo.gradeIndex-0+1) + "_MATH_OLD"]);
					} else {						
						popSubjectItems = Object.values(_New_Unit[_site_id + (selectedInfo.gradeIndex-0+1) + "_CONCEPT_OLD"]);
					}
				} else if(selectedInfo.menuIndex == 3) {
					popSubjectItems = Object.values(_New_Unit[_site_id + (selectedInfo.gradeIndex-0+1) + "_PRO_MATH_OLD"]);
				} else {
					popSubjectItems = Object.values(_New_Unit[_site_id + (selectedInfo.gradeIndex-0+1) + "_OLD"]);
				}
			} else if(popGradeItems[selectedInfo.gradeIndex].Value == "1" && param.oldData == "Y" && selectedInfo.subjectIndex == "6") {
				isOldData = "Y";
				popSubjectItems = Object.values(_New_Unit[_site_id + (selectedInfo.gradeIndex-0+1) + "_EXAMUNIT_TH_OLD"]);
			} else {
				popSubjectItems = Object.values(_New_Unit[_site_id + (selectedInfo.gradeIndex-0+1) + "_" + (selectedInfo.menuIndex-0+1)]);
			}

			if (typeof(popSubjectItems[selectedInfo.subjectIndex]) == "undefined") { selectedInfo.subjectIndex = 0; }
			popGroupItems = popSubjectItems[selectedInfo.subjectIndex].unitItems;
			obj = filter_1.querySelector("[data-act='filter_subject']");
			obj.innerHTML = popSubjectItems[selectedInfo.subjectIndex].Name;

			obj = filter_1.querySelector("[data-act='filter_group']");

			if (typeof(popGroupItems[selectedInfo.groupIndex]) == "undefined") { selectedInfo.groupIndex = 0; }
			////if (popGroupItems[selectedInfo.groupIndex].gubun == "PRO") { selectedInfo.groupIndex = 0; }
			if(selectedInfo.gradeIndex == 0 && popSubjectItems[selectedInfo.subjectIndex].Name == "과학탐구실험") 
			{
				selectedInfo.groupIndex = 0;
			}
			
			if(popTxItems == null)
			{
				selectedInfo.subjectCode = popSubjectItems[selectedInfo.subjectIndex].Value;
				selectedInfo.subjectName = popSubjectItems[selectedInfo.subjectIndex].Name;
				//selectedInfo.groupIndex = 0;
				selectedInfo.txIndex = 0;
			}

			// 대메뉴값			
			if (typeof popGroupItems[selectedInfo.groupIndex] == "undefined") {
				selectedInfo.groupIndex = 0;
			}			
			obj.innerHTML = popGroupItems[selectedInfo.groupIndex].Name;

			//PV 쌓기
			if (page_Act_Chk)	//처음 페이지 로딩시, 학년, 과목, 구분값 변경시 true
			{
				common.setCount(popGroupItems[selectedInfo.groupIndex].Name, popGradeItems[selectedInfo.gradeIndex].Name, popSubjectItems[selectedInfo.subjectIndex].Name, null);
			}

			var group_v = popGroupItems[selectedInfo.groupIndex].Value;
			var coreType_v = popGroupItems[selectedInfo.groupIndex].CoreType;
			if(coreType_v == null) coreType_v = "";

			var cutCoreType_v = coreType_v.substring(0, 1);
			_setHierarchy();
			
			if (group_v != "T") {				
				_getTXItems();
			}
			
			var grade_v = popGradeItems[selectedInfo.gradeIndex].Value;
			var subject_v = popSubjectItems[selectedInfo.subjectIndex].Value;
			var subjectName_v = popSubjectItems[selectedInfo.subjectIndex].Name;

			//if(isOldData == true && group_v == 'C' && subject_v == 'MT')
			// 단원별(C), 서술형(M), 최다빈(H/D), 최다오(H/E), 고난도(S), 수학유형별(H/C)
			// alert("group_v = " + group_v + ", cutCoreType_v = " + cutCoreType_v);
			if(isOldData == true && (group_v == "C" || group_v == "M" || ( group_v == "H" && (cutCoreType_v == "D" || cutCoreType_v == "E" || cutCoreType_v == "C" || cutCoreType_v == "")) || (group_v == "S") || (group_v == "P" && cutCoreType_v == "B")))
			{
				if (grade_v == 1) {
					if(subject_v == 'MT') {
						subject_v = 'MT_O';
					} else if (subject_v == 'HI') {
						subject_v = 'HI_O';
					}
				} else if (grade_v == 2) {
					if(subject_v == 'MT') {
						subject_v = 'MT_O';
					} else if (subject_v == 'SC') {
						subject_v = 'SC_O';
					} else if (subject_v == 'LS') {
						subject_v = 'LS_O';
					} else if (subject_v == 'HI') {
						subject_v = 'HI_O';
					}

				}
			}

			if(grade_v == "1")
			{
				if(subjectName_v == "국어 문법")
				{
					subject_v = "KR1";
				}
			}

			if(grade_v == "2") {
				if(subjectName_v == "독서")
				{
					subject_v = "KR1";
				}
				else if(subjectName_v == "언어와 매체")
				{
					subject_v = "KR2";
				}
				else if(subjectName_v == "국어 문법")
				{
					subject_v = "KR3";
				}
				else if(subjectName_v == "영어Ⅱ")
				{
					subject_v = "EG1";
				}
				else if(subjectName_v == "영어 독해와 작문")
				{
					subject_v = "EG2";
				}
				else if(subjectName_v == "영어권 문화")
				{
					subject_v = "EG3";
				}
			}

			popYearItems = [{Name: "전체 년도", Value: ""}].concat(getYears(_site_id, grade_v, group_v, coreType_v, subject_v));

			if (typeof(popTxItems) != "undefined" && popTxItems != null) {
				if (popTxItems.length > 1) {
					if(group_v != "C" ) {
						if ((group_v == "H" && (cutCoreType_v == "D" || cutCoreType_v == "E" || cutCoreType_v == "T" || cutCoreType_v == "C" || cutCoreType_v == "")) || (group_v == "S") || (group_v == "M")) {							
							// 최다빈출, 최다오답, 영어 문법 문제, 수학 유형별
							// 초기값 세팅으로 인한 주석처리 / 2021-03-17 / 김진국
							/*if(subject_v == "KR" && subjectName_v == "국어" && (cutCoreType_v == "D" || cutCoreType_v == "E")) {
								popTxItems = [{Name: "전체 교과서", Value: util.arrayValueAdd(popTxItems).join("|")+"|H8KRCHA0002"}].concat(popTxItems);
							} else {
								popTxItems = [{Name: "전체 교과서", Value: util.arrayValueAdd(popTxItems).join("|")}].concat(popTxItems);
							}*/
						} else {
							// 출판사 전체를 선택하는 경우 로딩 속도 문제가 있어서 기본 출판사 정보 하나 선택 (정효태)
							//popTxItems = [{Name: "전체 교과서", Value: util.arrayValueAdd(popTxItems).join("|")}].concat(popTxItems);
							_getTXItems();
						}
					}
				}
			}

			if(group_v == "K" && cutCoreType_v == "C") {
				// 고등 영문법
				popTxItems = [{Name: "공통", Value: ""}];						
			} else if(group_v == "P" && cutCoreType_v == "A") {
				// 국어문법
				popTxItems = [{"Name": "공통", "Value": ""}];							
			} else if(group_v == "T" && cutCoreType_v == "") {
				// 수행평가 (PRO이관)							
				popTxItems = [{"Name": "탐구형 수행평가", "Value": "A", "Index":"0"},
								{"Name": "서/논술형 수행평가", "Value": "B", "Index":"1"}];
			}
	
			// 과목 그룹별 설정 start
			if(subject_v.substring(0, 2) == "KR") {
				// 국어 , 국어 문법
				if(group_v == "K") {
					// 시대별 문학
					if(cutCoreType_v == "Q") {
						// 작가별, 작품별
						popTxItems = _H_KR_SI;
						popYearItems = _H_KR_SI_KIND;
						popSubItems = [];
					}
				}
			} else if (subject_v.substring(0, 2) == "EG") {
				if(cutCoreType_v == "T") {
					// 영어 문법 문제
				} else if (cutCoreType_v == "C") {
					// 고등 영문법					
					popTxItems = _KR_EG_C1;
				}
			} else if (subject_v == "MT") {
				if (cutCoreType_v == "C") {
					// 수학 유형별
				} else if (cutCoreType_v == "B") {
					// 수학 계산력
					if(isOldData == true) {
						popTxItems = [{"Name":"수학Ⅰ", "Value":"B3", "tabIdx": 3},
							{"Name":"수학Ⅱ", "Value":"B4", "tabIdx": 4},
							{"Name":"확률과 통계", "Value":"B5", "tabIdx": 5},
							{"Name":"미적분", "Value":"B6", "tabIdx": 6},
							{"Name":"기하", "Value":"B7", "tabIdx": 7}];
					} else {
						//popTxItems = _H2_MT_O7;
						if(grade_v == 1) {
							popTxItems = _H2_MT_O7_1;
						} else{
							popTxItems = _H2_MT_O7;
						}
					}
				}
				else if (cutCoreType_v == "F") {
					// 수학 계산력
				}
			} else if (subject_v == "SC") {
			} else if (subject_v == "LS") {
			} else {
			}

			// 과목 그룹별 설정
			if (popTxItems == null) {
				popTxItems = [{"Name": "공통", "Value": ""}];
			}

			// 수학 유형별 이전개혁 그리기
			if (isOldData == true && (group_v == "C" || group_v == "M" || ( group_v == "H" && (cutCoreType_v == "D" || cutCoreType_v == "E" || cutCoreType_v == "C" || cutCoreType_v == "")) || (group_v == "S")) && subject_v == "MT_O") {
				if (grade_v == "1") {
					popTxItems = [{"Name": "공통", "Value": "H9MTCHA1001|H8MTCHA1001|H8MTCHA1002|H8MTCHA1004|H7MTEXP1005|H7MTEXP1001|H7MTEXA1004"}];
				} else if (grade_v == "2") {
					//popTxItems = [{"Name": "확률과 통계", "Value": "H7MTEXP2004"}, {"Name": "미적분Ⅰ", "Value": "H8MTCHA2005"}, {"Name": "미적분Ⅱ", "Value": "H8MTCHA2006"}, {"Name": "기하와 벡터", "Value": "H7MTCHA2004"}];
					popTxItems = [{"Name": "수학Ⅰ", "Value": "H9MTCHA2003"}, {"Name": "확률과 통계", "Value": "H9MTCHA2005"}, {"Name": "수학Ⅱ", "Value": "H9MTCHA2004"}, {"Name": "미적분", "Value": "H9MTCHA2001"}, {"Name": "기하", "Value": "H9MTCHA2002"}];
				}
			}
			
			if (group_v == "P" && cutCoreType_v == "C") {	// 수학교과서 변형
				if(grade_v == "1") {
					popYearItems = H_MT_Math_1_C;	// 년도항목에 임시 대체
				} else {
					if(isOldData == true) {
						popYearItems = H_MT_Math_2_C_OLD;	// 년도항목에 임시 대체
					} else {
						popYearItems = H_MT_Math_2_C;	// 년도항목에 임시 대체
					}
				}
			} else if (group_v == "P" && cutCoreType_v == "B") {	// 수학 단계별 학습관				
				//popYearItems = H_MT_Math[(Number(selectedInfo.txIndex) + 1)].bookinfo;
				if(grade_v == "1") {
					popTxItems = H_MT_Math_1_B;
				} else {
					if(isOldData == true) {
						popTxItems = H_MT_Math_2_B_OLD;	// 년도항목에 임시 대체	
					} else {
						popTxItems = H_MT_Math_2_B;	// 년도항목에 임시 대체	
					}
				}
			} else if (group_v == "K" && coreType_v == "C" && subject_v.substring(0, 2) == "EG") {
				popYearItems = grammerYearItems;	// 고등 영문법
			} else if (group_v == "P" && coreType_v == "E1" && subject_v.substring(0, 2) == "EG") {
				popYearItems = popEngParseItems;	// 구문독해			
			} else if (group_v == "T") {								
				//수행마스터 (출판사 정보)
				coreType_v = popTxItems[selectedInfo.txIndex].Value;
				Hierarchy_Init(_site_id, group_v, coreType_v);
				popYearItems = _Hierarchy[selectedInfo.gradeIndex].Subj_Code[selectedInfo.subjectIndex].TX_CODE;

				if (popYearItems == null) {
					popYearItems = [{"Name":"공통", "Value":""}];
				}
			}
			else if (group_v == "B" ) {
				// 직전대비
				Hierarchy_Init(_site_id, group_v, "");
				popTxItems = _Hierarchy[selectedInfo.gradeIndex].Subj_Code[selectedInfo.subjectIndex].TX_CODE;
			}
			
			// 고2,3 과학영역이 Hierarchy에 나눠져있지 않아... 따로 그려줘야한다...
			//alert("subject_v = " + subject_v + ", isOldData = " + isOldData + ", grade_v = " + grade_v);
			if (subject_v == "SC_O" && isOldData == true) {
				if (grade_v == "2") {
					//popTxItems = [{"Name": "생명과확Ⅰ", "Value": "H8SCCHA2001"}, {"Name": "지구과학Ⅰ", "Value": "H7SCCHA2003 "}, {"Name": "화학Ⅰ", "Value": "H7SCEXP2017"}, {"Name": "물리Ⅰ", "Value": "H7SCCHA2001"}];
					popTxItems = [{"Name": "물리학Ⅰ", "Value": "H9SCCHA2001"}, {"Name": "생명과학Ⅰ", "Value": "H9SCCHA2002"}, {"Name": "생명과학Ⅱ", "Value": "H9SCCHA2005"}, {"Name": "지구과학Ⅰ", "Value": "H9SCCHA2003"}, {"Name": "지구과학Ⅱ", "Value": "H9SCCHA2007"}, {"Name": "화학Ⅰ", "Value": "H9SCCHA2004"}, {"Name": "화학Ⅱ", "Value": "H9SCCHA2006"}];
				}
			}

			if (subject_v.substring(0, 2) == "EG") {
				if ((group_v == "K" && coreType_v == "C") || group_v == "P" && coreType_v == "E1") {
					// 중등 영문법
					popSubItems = grammerKindItems;					
				}				
			} else if( group_v == "P" && coreType_v == "C1" ) {
				// 수학 교과서 변형
				if(grade_v == "1") {
					popSubItems = H_MT_Math_1_C[(Number(selectedInfo.yearIndex))].bookinfo;
				} else {
					if(isOldData == true) {
						popSubItems = H_MT_Math_2_C_OLD[(Number(selectedInfo.yearIndex))].bookinfo;
					} else {
						popSubItems = H_MT_Math_2_C[(Number(selectedInfo.yearIndex))].bookinfo;
					}
				}
			} else {
				popSubItems = _term;
			}

			obj = filter_1.querySelector("[data-act='filter_tx']");
	
			/* 수학 교과서 변형 예외  */
			if (group_v == "P" && coreType_v == "C1") {
			} else {
				if (typeof popTxItems[selectedInfo.txIndex] == "undefined") {
					selectedInfo.txIndex = 0;
				}	
	
				if (popTxItems[selectedInfo.txIndex].Name) {
					obj.innerHTML = popTxItems[selectedInfo.txIndex].Name;
				} else if (popTxItems[selectedInfo.txIndex].title) {
					obj.innerHTML = popTxItems[selectedInfo.txIndex].title;
				}
			}

			//  서술형 / 최다빈출 / 최다오답 일때만
			if (group_v == "M" || ( group_v == "H" && (coreType_v == "D" || coreType_v == "E"))) {
				// 수학II만 예외적으로 년도를 바꿔달라는 요청사항이 있었음. 과목값에 2를 추가하여 호출
				if (popTxItems[selectedInfo.txIndex].Value == "H9MTCHA2004|H8MTCHA2005") {
					popYearItems = [{Name: "전체 년도", Value: ""}].concat(getYears(_site_id, grade_v, group_v, coreType_v, "MT2"));
				}
			}
			var filter1_pnl3 = filter_1.querySelector("#filter1_pnl3");
			var btn_group = filter_1.querySelector("[data-act='filter_group']");
			var btn_tx = filter_1.querySelector("[data-act='filter_tx']");

			var btn_1 = filter_1.querySelector("[data-act='filter_year']");
			var btn_2 = filter_1.querySelector("[data-act='filter_term']");
			var input_o = filter_1.querySelector("[name='qry']");

			var reset_o = filter_1.querySelector("button[type='reset']");
			reset_o.style.display = "none";

			var chapter_o = filter_1.querySelector("[data-act='filter_chapter']");
			var level_o = filter_1.querySelector("[data-act='filter_level']");
			
			var basicTxt = filter_1.querySelector("#basicTxt");
			var basicTxtVal = $("#basicTxtVal").val();

			// 검색영역 초기화
			basicTxt.style.display = "none";
			filter1_pnl3.style.display = "";
			btn_1.style.display = "";
			btn_1.style.width = "47%";
			btn_2.style.display = "";
			btn_2.style.width = "47%";
			level_o.parentNode.style.display = "none";
			$("#zocboInfo_expectedquestion").hide();

			// Group
			// H: 개념완성(과목순서별로 Subj_Code_Text값 존재 1~*), 최다빈출(E), 최다오답(D), 수학 유형별(CoreType=C), 영어 문법 문제(CoreType=T),
			// K: 수학 계산력(CoreType=B*), 고등 영문법(CoreType=C*), 시대별 문학(CoreType=Q*)
			// C: 단원별문제
			// M: 서술형문제
			// S: 고난도문제	
			if (group_v == "H") {
				// H: 개념완성(과목순서별로 Subj_Code_Text값 존재 1~*), 최다빈출(E), 최다오답(D), 수학 유형별(CoreType=C), 영어 문법 문제(CoreType=T),				
				if (cutCoreType_v == "D" || cutCoreType_v == "E") {
					// 최다빈출, 최다오답
					filter1_pnl3.style.display = "";
					if (isOldData) {
						chapter_o.parentNode.style.display = "none";
					} else {
						chapter_o.parentNode.style.display = "";
					}
					input_o.parentNode.parentNode.style.display = "";
					btn_group.style.width = "47%";
					btn_tx.style.display = "";
					btn_1.style.display = "none";
					btn_2.style.display = "none";
				} else if (cutCoreType_v == "C") {
					// 수학 유형별
					filter1_pnl3.style.display = "";
					chapter_o.parentNode.style.display = "none";
					input_o.parentNode.parentNode.style.display = "";
					btn_group.style.width = "47%";
					btn_tx.style.display = "";
				} else if (cutCoreType_v == "T") {
					// 영어 문법 문제					
					filter1_pnl3.style.display = "";
					chapter_o.parentNode.style.display = "";
					input_o.parentNode.parentNode.style.display = "";
					btn_group.style.width = "47%";
					btn_tx.style.display = "";
					btn_1.style.display = "none";
					btn_2.style.display = "none";
				} else {
					// 개념완성
					if (subjectName_v == "국어 문법" && cutCoreType_v != "Q") {
						chapter_o.parentNode.style.display = "none";
					} else {
						chapter_o.parentNode.style.display = "";
					}
					input_o.parentNode.parentNode.style.display = "none";
					input_o.value = "";
					filter1_pnl3.style.display = "none";
					btn_group.style.width = "47%";
					btn_tx.style.display = "";
				}
			} else if (group_v == "K") {
				if (subject_v == "MT") {
					if (coreType_v.substring(0,1) == "B") {
						// 수학 계산력
						input_o.parentNode.parentNode.style.display = "none";
						input_o.value = "";
						chapter_o.parentNode.style.display = "";
						filter1_pnl3.style.display = "none";
						btn_group.style.width = "47%";
						btn_tx.style.display = "";
					} else if (coreType_v.substring(0,1) == "F") {
						btn_1.style.display = "";
						btn_1.style.width = "100%";
						btn_2.style.display = "none";

						input_o.style.display = "none";
						chapter_o.parentNode.style.display = "";
					}
				} else if (subject_v.substring(0, 2) == "KR") {	
					if (coreType_v == "Q1") {
						$(btn_group).addClass("fL");
						$(btn_group).css("width", "47%");
						btn_tx.style.display = "";
						filter1_pnl3.style.display = "";
						btn_1.style.display = "";
						btn_2.style.display = "";
						btn_1.style.width = "100%";
						btn_2.style.width = "100%";
						chapter_o.parentNode.style.display = "none";
						input_o.parentNode.parentNode.style.display = "none";
						input_o.value = "";
						if (basicTxtVal == 1) { basicTxt.style.display = ""; }
					} else {
						$(btn_group).addClass("fL");
						$(btn_group).css("width", "47%");
						btn_tx.style.display = "";
						filter1_pnl3.style.display = "";
						chapter_o.parentNode.style.display = "none";
						input_o.parentNode.parentNode.style.display = "";
					}
				} else if (subject_v.substring(0, 2) == "EG") {
					if (cutCoreType_v == "C") {							
						btn_group.style.width = "100%";
						btn_tx.style.display = "none";
						btn_1.style.display = "";
						btn_2.style.display = "";
						input_o.style.display = "none";
						chapter_o.parentNode.style.display = "";
						if (basicTxtVal == 1) { basicTxt.style.display = ""; }
					} else {						
						$(btn_group).addClass("fL");
						$(btn_group).css("width", "47%");
						btn_tx.style.display = "";
						filter1_pnl3.style.display = "none";
						input_o.parentNode.parentNode.style.display = "none";
						input_o.value = "";
						chapter_o.parentNode.style.display = "";
						chapter_o.innerHTML = "전체 대단원";
					}
				} else {
				 	$(btn_group).addClass("fL");
				 	$(btn_group).css("width", "47%");
				 	btn_tx.style.display = "";
				 	chapter_o.parentNode.display = "none";
				 	input_o.parentNode.parentNode.style.display = "";
				}
			} else if (group_v == "C") {
				filter1_pnl3.style.display = "";
				input_o.parentNode.parentNode.style.display = "";
				btn_group.style.width = "47%";
				btn_tx.style.display = "";
				// 단원별 문제 > 개정 자료인경우 isOldData = false
				// 대단원 디스플레이 설정
				if (isOldData) {
					chapter_o.parentNode.style.display = "none";
				} else {
					chapter_o.parentNode.style.display = "";
				}
				// 국어 / 수학 / 영어 / 과학 / 사회 / 역사과목만 학습 단계 노출
				if (subject_v == "KR" || subject_v == "MT" || subject_v == "EG" || subject_v == "SC" || subject_v == "LS" || subject_v == "HI" || subject_v == "KR1" || subject_v == "KR2" || subject_v == "KR4"|| subject_v == "EG1" || subject_v == "EG2" || subject_v == "EG3" ) {
					level_o.parentNode.style.display = "";
					levelItems = [{Name: "전체 선택", Value: ""}];
					var popSubjectItemslevel = popSubjectItems[selectedInfo.subjectIndex].level;
					// 과학영역 II 과목 예외처리
					if (popTxItems[selectedInfo.txIndex].Name == "생명과학Ⅱ" || popTxItems[selectedInfo.txIndex].Name == "화학Ⅱ" || popTxItems[selectedInfo.txIndex].Name == "지구과학Ⅱ") {
						popSubjectItemslevel = popSubjectItems[selectedInfo.subjectIndex].level_v2;
					}						
					
					// 난이도 담기
					for(var i=0; i< popSubjectItemslevel.length; i++) {
						var mItem = popSubjectItemslevel[i];
						var obj = {};

						var rc = mItem.Value;
						var rn = mItem.Name;
						obj.Name = rn;
						obj.Value = rc;
						levelItems.push(obj);
					}
				}
				btn_1.style.display = "none";
				btn_2.style.display = "none";

				if(grade_v == "1" && subject_v == "TH" && param.oldData == "Y") {
					input_o.parentNode.parentNode.style.display = "none";
					input_o.value = "";
				}
			} else if (group_v == "M") {
				// 서술형문제
				filter1_pnl3.style.display = "";
				input_o.parentNode.parentNode.style.display = "";
				if (isOldData) {
					chapter_o.parentNode.style.display = "none";
				} else {
					chapter_o.parentNode.style.display = "";
				}
				btn_group.style.width = "47%";
				btn_tx.style.display = "";
				btn_1.style.display = "none";
				btn_2.style.display = "none";
			} else if (group_v == "S") {
				if(subject_v.substring(0, 2) == "EG" && cutCoreType_v == "G") {
					// 고등 영문법
					btn_group.style.width = "100%";
					btn_tx.style.display = "none";
					btn_1.style.display = "";
					btn_2.style.display = "";
					input_o.style.display = "none";
					chapter_o.parentNode.style.display = "";
				} else {
					// 고난도 문제
					filter1_pnl3.style.display = "";
					input_o.parentNode.parentNode.style.display = "";
					chapter_o.parentNode.style.display = "none";
				}
			} else if (group_v == "P") {
				if (coreType_v == "C1") {	// 수학 교과서 변형					
					btn_group.style.width = "100%";
					btn_tx.style.display = "none";
					chapter_o.parentNode.style.display = "";
					input_o.parentNode.parentNode.style.display = "none";
					input_o.value = "";
					if (basicTxtVal == 1) { basicTxt.style.display = ""; }
				} else if (coreType_v == "B1") {	// 수학 단계별 학습관					
					btn_group.style.width = "47%";
					btn_tx.style.display = "";
					btn_1.style.display = "none";
					btn_2.style.display = "none";
					chapter_o.parentNode.style.display = "";
					input_o.parentNode.parentNode.style.display = "none";
					input_o.value = "";
					if (basicTxtVal == 1) { basicTxt.style.display = ""; }
				} else if (coreType_v == "E1") {	// 구문독해					
					btn_group.style.width = "100%";
					btn_tx.style.display = "none";
					btn_1.style.display = "";
					btn_2.style.display = "";
					input_o.parentNode.parentNode.style.display = "none";
					input_o.value = "";
					chapter_o.parentNode.style.display = "";
					if (basicTxtVal == 1) { basicTxt.style.display = ""; }
				} else if (coreType_v == "A1") {	// 국어문법					
					btn_group.style.width = "100%";
					btn_tx.style.display = "none";
					btn_1.style.display = "none";
					btn_2.style.display = "none";
					input_o.parentNode.parentNode.style.display = "none";
					input_o.value = "";
					chapter_o.parentNode.style.display = "none";
					if (basicTxtVal == 1) { basicTxt.style.display = ""; }
				} 
			} else if (group_v == "T") {				
				if (coreType_v == "A" || coreType_v == "B") {	// 수행평가					
					btn_group.style.width = "47%";
					btn_tx.style.display = "";
					btn_tx.style.width = "47%";
					btn_1.style.display = "";
					btn_1.style.width = "100%";
					btn_2.style.display = "none";
					input_o.parentNode.parentNode.style.display = "";
					input_o.value = "";
					chapter_o.parentNode.style.display = "";
					if (basicTxtVal == 1) { basicTxt.style.display = ""; }
				}
			}
			else if (group_v == "B") {
				// 직전대비
				btn_1.style.display = "none";
				btn_2.style.display = "none";
				input_o.style.display = "none";
				input_o.parentNode.parentNode.style.display = "none";
				input_o.value = "";
				chapter_o.parentNode.style.display = "";
			}

			obj = filter_1.querySelector("[data-act='filter_year']");

			if (typeof(popYearItems[selectedInfo.yearIndex]) == "undefined") {
				selectedInfo.yearIndex = 0;
			}

			obj.innerHTML = popYearItems[selectedInfo.yearIndex].Name;

			obj = filter_1.querySelector("[data-act='filter_term']");

			if(!(group_v == "K" && subject_v == "KR" && cutCoreType_v == "Q")) { // 국어 > 시대별문학 예외처리 - 시대별문학에는 term값이 없음				
				obj.innerHTML = popSubItems[selectedInfo.termIndex].title;				
			}
	
			obj = root.querySelector("[data-act='oldData']");
			if (isOldData) {
				obj.innerHTML = "<span class='is-bedge'>22개정</span>최신 개정자료 보기";
			} else {
				if(grade_v == "2") {
					obj.innerHTML = "<span class='is-bedge'>15개정</span>고3 수업자료 보기";
				} else {
					obj.innerHTML = "<span class='is-bedge'>15개정</span>이전 개정자료 보기";
				}
			}

			if (selectedInfo.menuIndex == 3 && param.oldData == "Y") {
				obj.innerHTML = "<span class='is-bedge'>22개정</span>최신 개정자료 보기";
				$("button[data-act=filter_chapter]").hide();
				$("button[data-act=filter_level]").hide();
			}

			if (group_v == "K" && subject_v == "MT" && cutCoreType_v == "F") {
				obj.style.display = "none";
			} else {
				if(group_v == "H" && cutCoreType_v == "") {
					if(grade_v == "2" || subject_v != "EG") {
						obj.style.display = "";
					} else {
						obj.style.display = "none";
					}
				} else {
					if(grade_v == "2" || (grade_v == "1" && (subject_v.includes("SC") || subject_v.includes("TH")))) {
						obj.style.display = "";
					} else {
						obj.style.display = "none";
					}
				}
			}

			if (group_v == "K" && subject_v.substring(0, 2) == "KR" && cutCoreType_v == "Q") {
				//input_o.parentNode.parentNode.style.display = "none";
				//input_o.value = "";
				chapter_o.parentNode.display = "none";
				// 국어 > 시대별문학 - 작품별 작가별 보기
				popTxItems = _H_KR_SI;
				popYearItems = _H_KR_SI_KIND;
				
				var coreType_v = popTxItems[selectedInfo.txIndex].Value;
				var divisionType_v = popYearItems[selectedInfo.yearIndex].Value;
				var url_p = "/_api/search.api.asp";
				var data_p = "cmd=H_KR_TIME&site_id=H&ExPapr_Group=K&CoreType=" + coreType_v + "&DivisionType=" + divisionType_v;
				comm.send(url_p, data_p, "post", function(json_p) {					
					popSubItems = [].concat(json_p.list);

					// 시대별문학 카테고리
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
				});
			} else {
				if (subject_v.substring(0, 2) == "EG") {
					// 중등 영문법, 구문독해
					if( (group_v == "K" && coreType_v == "C") || (group_v == "P" && coreType_v == "E1") ) {
						popSubItems = grammerKindItems;
					}
				} else if(group_v == "P" && coreType_v == "C1") {
					if(grade_v == "1") {
						popSubItems = H_MT_Math_1_C[(Number(selectedInfo.yearIndex))].bookinfo;
					} else {
						if(isOldData == true) {
							popSubItems = H_MT_Math_2_C_OLD[(Number(selectedInfo.yearIndex))].bookinfo;
						} else {
							popSubItems = H_MT_Math_2_C[(Number(selectedInfo.yearIndex))].bookinfo;
						}
					}
				} else {
					popSubItems = _term;
				}

				obj = filter_1.querySelector("[data-act='filter_term']");
				obj.innerHTML = popSubItems[selectedInfo.termIndex].title || popSubItems[selectedInfo.termIndex].Name;
				
				//수학 교과서 변형, 수학 단계별 학습관
				if(
					(group_v == "P" && coreType_v == "C1") || 
					(group_v == "P" && coreType_v == "B1") || 
					(group_v == "P" && coreType_v == "A1")
				) {
					_loadData_pro({"group": group_v, "coretype": coreType_v});
				} else {
					_loadData();
				}
			}
		}
	};

	// 학교별족보 필터 설정
	var _setSelectedValueForFilter2 = function() {
		var filter_2 = root.querySelector("#filter_2");
		if(filter_2) {
			// 강남3구 예외처리
			if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 4) {
				popGrade2Items = k3config[_site_id];
			} else {
				popGrade2Items = _Hierarchy;
			}

			// 최빈, 최오의 경우 1학년, 2,3학년만 제공 (하이러키에 있는 마지막 3학년정보는 배열 삭제)
			if(popGrade2Items.length > 2 && pop2TypeItems[selectedInfo.type2Index].value == "H" && (pop2TypeItems[selectedInfo.type2Index].CoreType == "D" || pop2TypeItems[selectedInfo.type2Index].CoreType == "E")) {
				popGrade2Items.pop();
			}

			_setSelectedValueForFilter2Sub();
		}
	};

	// 학교별족보 필터 설정
	var _setSelectedValueForFilter2Sub = function() {
		var part_ids = document.getElementById("part_ID").value;
		var filter_2 = root.querySelector("#filter_2");
		if(filter_2) {
			var type2_v = pop2TypeItems[selectedInfo.type2Index].value;
			var type2_index = pop2TypeItems[selectedInfo.type2Index].Index;

			// 학교별 기출 무료 열람실 IPhone Popup노출
			/*
			var iPhone_UserAgent = navigator.userAgent.toLowerCase();

			if (iPhonePopChk && (iPhone_UserAgent.indexOf("iphone") > -1 || iPhone_UserAgent.indexOf("ipad") > -1 || iPhone_UserAgent.indexOf("ipod") > -1 ) && selectedInfo.type2Index == 0) {
			//if (iPhonePopChk && selectedInfo.type2Index == 0) {
				$("#iosPopup").show();
				iPhonePopChk = false;
			}
			*/

			popYearItems = [{"Name":"전체 년도","Value":""}];
			var year_s, year_t;
			var last_Year;
			var grade_Val;

			if (typeof popGrade2Items[selectedInfo.grade2Index] == "undefined") { selectedInfo.grade2Index = 0; }
			grade_Val = popGrade2Items[selectedInfo.grade2Index].Value;			

			// 강남3구 예외처리
			if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 4) {
				popSubjectItems = popGrade2Items[selectedInfo.grade2Index].subjItems;
			} else {
				popSubjectItems = popGrade2Items[selectedInfo.grade2Index].Subj_Code;
			}

			if (typeof popSubjectItems[selectedInfo.subject2Index] == "undefined") { selectedInfo.subject2Index = 0; }
			var subject_v = popSubjectItems[selectedInfo.subject2Index].Value;
			var subjectName_v = popSubjectItems[selectedInfo.subject2Index].Name;

			if(type2_index == "7") {
				popGrade2Items[1].Name = "2학년";

				if(subject_v != "MT") {
					popGrade2Items[2].Name = "";
				} else {
					popGrade2Items[2].Name = "3학년";
				}
			}

			//year_s = new Date().getFullYear() - 1;
			//year_s  = new Date().getFullYear();

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

			if(type2_v == "")
			{
				year_s = new Date().getFullYear() - 1;
				for(var i = year_s; i >= last_Year; i-- ) {
					var year_o = {};
					year_o["Name"] = i + "년 기출";
					year_o["Value"] = i;
					popYearItems.push(year_o);
				}
			}
			else if(type2_v == "A")
			{
				year_s = new Date().getFullYear() - 1;		// 기출 기본값은 당해 -1년

				if (type2_index == "7") { popYearItems = []; }

				if(popGrade2Items[selectedInfo.grade2Index].Value == "2" && subject_v != "MT") {
					year_s = "2024";
				}
				
				for(; year_s >= ((type2_index == "7") ? 2021 : 2013) ; year_s-- ) {
					var year_o = {};
					year_o["Name"] = year_s + "년 기출";
					year_o["Value"] = year_s;
					popYearItems.push(year_o);
				}
			} else if(type2_v == "H") {
				var coreType_v = pop2TypeItems[selectedInfo.type2Index].CoreType;
				if(isOldData == true)
				{
					if (grade_Val == 1) {
						if(subject_v == 'MT') {
							subject_v = 'MT_O';
						} else if (subject_v == 'HI') {
							subject_v = 'HI_O';
						}
					} else if (grade_Val == 2) {
						if(subject_v == 'MT') {
							subject_v = 'MT_O';
						} else if (subject_v == 'SC') {
							subject_v = 'SC_O';
						} else if (subject_v == 'LS') {
							subject_v = 'LS_O';
						} else if (subject_v == 'HI') {
							subject_v = 'HI_O';
						}

					}
				}

				if(grade_Val == "1")
				{
					if(subjectName_v == "국어 문법")
					{
						subject_v = "KR1";
					}
				}

				if(grade_Val == "2")
				{
					if(subjectName_v == "독서")
					{
						subject_v = "KR1";
					}
					else if(subjectName_v == "언어와 매체")
					{
						subject_v = "KR2";
					}
					else if(subjectName_v == "국어 문법")
					{
						subject_v = "KR3";
					}
					else if(subjectName_v == "영어Ⅱ")
					{
						subject_v = "EG1";
					}
					else if(subjectName_v == "영어 독해와 작문")
					{
						subject_v = "EG2";
					}
					else if(subjectName_v == "영어권 문화")
					{
						subject_v = "EG3";
					}
				}

				_subject_v = subject_v;    // 전역변수 활용

				popYearItems = [{Name: "전체 년도", Value: ""}].concat(getYears(_site_id, grade_Val, type2_v, coreType_v, subject_v));
				// 출판사 코드 (이전, 최신 리스트에 따라 출판사 노출이 달라짐)
				if (typeof(popTxItems) != "undefined" && popTxItems != null) {
					if (popTxItems.length > 1) {
						if(type2_v != "C" ) {
							if ((type2_v == "H" && (cutCoreType_v == "D" || cutCoreType_v == "E" || cutCoreType_v == "T" || cutCoreType_v == "C")) || (group_v == "S") || group_v == "M") {
								// 최다빈출, 최다오답, 영어 문법 문제, 수학 유형별
								// 초기값 세팅으로 인한 주석처리 / 2021-03-17 / 김진국
								/*if(subject_v == "KR" && subjectName_v == "국어" && (cutCoreType_v == "D" || cutCoreType_v == "E")) {
									popTxItems = [{Name: "전체 교과서", Value: util.arrayValueAdd(popTxItems).join("|")+"|H8KRCHA0002"}].concat(popTxItems);
								} else {
									popTxItems = [{Name: "전체 교과서", Value: util.arrayValueAdd(popTxItems).join("|")}].concat(popTxItems);
								}*/
							} else if(type2_v == "K" && cutCoreType_v == "C") {
								// 고등 영문법
								popTxItems = [{Name: "공통", Value: ""}];
							} else if(type2_v == "K" && cutCoreType_v == "F") {
								// 교과서 변형
								if(grade_v == "1") {
									popTxItems = H_MT_Math_1_C[(Number(selectedInfo.txIndex) + 1)].bookinfo;
								} else {
									if(isOldData == true) {
										popTxItems = H_MT_Math_2_C_OLD[(Number(selectedInfo.txIndex) + 1)].bookinfo;
									} else {
										popTxItems = H_MT_Math_2_C[(Number(selectedInfo.txIndex) + 1)].bookinfo;
									}
								}
							} else {
								// 출판사 전체를 선택하는 경우 로딩 속도 문제가 있어서 기본 출판사 정보 하나 선택 (정효태)
								//popTxItems = [{Name: "전체 교과서", Value: util.arrayValueAdd(popTxItems).join("|")}].concat(popTxItems);
								_getTXItems();
							}
						}
					}
				}
			}
			else
			{
				year_s  = new Date().getFullYear();

				for(; year_s >= 2003; year_s-- ) {
					var year_o = {};

					year_o["Name"] = year_s + "년";
					year_o["Value"] = year_s;
					popYearItems.push(year_o);
				}
			}

			var obj = filter_2.querySelector("[data-act='filter2_type']");
			obj.innerHTML = pop2TypeItems[selectedInfo.type2Index].Name;

			var fileType_o = filter_2.querySelector("[data-act='filter2_fileType']");
			var gu_o = filter_2.querySelector("[data-act='filter2_gu']");
			var sch_o = filter_2.querySelector("[data-act='filter2_sch']");
			var year_o = filter_2.querySelector("[data-act='filter2_year']");
			var pub_o = filter_2.querySelector("[data-act='filter2_pub']");
			var chapter_o = filter_2.querySelector("[data-act='filter2_Chapter']");
			var input_o = filter_2.querySelector("[name='qry']");
			var reset_o = filter_2.querySelector("button[type='reset']");
			reset_o.style.display = "none";

			var subDetail_o = filter_2.querySelector("[data-act='filter2_sub2Detail']");

			if (typeof popGrade2Items[selectedInfo.grade2Index] == "undefined") { selectedInfo.grade2Index = 0; }
//			if (typeof popGrade2Items[selectedInfo.grade2Index] == "undefined") { selectedInfo.grade2Index = 1; }
//
//			if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 7) {
//				selectedInfo.grade2Index = 0;
//			}

			if(parseInt(parseInt(pop2TypeItems[selectedInfo.type2Index].Index)) == 4) {
				popGrade2Items = k3config[_site_id];
				popSubjectItems = popGrade2Items[selectedInfo.grade2Index].subjItems;
			} else {
				popSubjectItems = popGrade2Items[selectedInfo.grade2Index].Subj_Code;
			}

			var subject_v = popSubjectItems[selectedInfo.subject2Index].Value;
			var subjectName_v = popSubjectItems[selectedInfo.subject2Index].Name;

			// 하위 과목이 있는 과목에 대해 값 설정
			popSubjDetailItems = null;


			if(parseInt(parseInt(pop2TypeItems[selectedInfo.type2Index].Index)) != 0)
			{
				if(subject_v == "KR" || subject_v == "EG") {
					popSubjDetailItems = _Unit[_site_id + (selectedInfo.grade2Index-0+1)][subject_v+1];				
					
					if(popSubjDetailItems) {
						popSubjDetailItems = popSubjDetailItems["subDetail"];
					}
				} else if(subject_v == "MT" || subject_v == "SC" || subject_v == "LS") {
					popSubjDetailItems = _Unit[_site_id + (selectedInfo.grade2Index-0+1)][subject_v]["subDetail"];
				} else {
					popSubjDetailItems = null;
				}
				/*if(subject_v == "KR" || subject_v == "EG") {
					if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 7) {
						popSubjDetailItems = _Unit[_site_id + "2"][subject_v+1];				
					} else {
						popSubjDetailItems = _Unit[_site_id + (selectedInfo.grade2Index-0+1)][subject_v+1];				
					}
					
					if(popSubjDetailItems) {
						popSubjDetailItems = popSubjDetailItems["subDetail"];
					}
				} else if(subject_v == "MT" || subject_v == "SC" || subject_v == "LS") {
					if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 7) {
						popSubjDetailItems = _Unit[_site_id + "2"][subject_v]["subDetail"];
					} else {
						popSubjDetailItems = _Unit[_site_id + (selectedInfo.grade2Index-0+1)][subject_v]["subDetail"];
					}
				} else {
					popSubjDetailItems = null;
				}*/
			}

			//if(selectedInfo.grade2Index == 2) {
				//popSubjDetailItems = null;
			//}

			/* 메뉴 위치 변경 */
			if(type2_index == "7") {	// 학교별 기출유사
				// 학교별 기출유사 1학년 이외는 임시적으로 서브 과목 수정
				if(selectedInfo.grade2Index != 0) {
					if(subject_v == "KR") {
						popSubjDetailItems = [{Name: '문학', Value: '문학'}, {Name: '독서', Value: '독서'}, {Name: '언어와 매체', Value: '언어와 매체'}]
					} else if (subject_v == "EG") {
						popSubjDetailItems = [{Name: '영어Ⅰ', Value: '영어Ⅰ'}, {Name: '영어Ⅱ', Value: '영어Ⅱ'}, {Name: '영어 독해와 작문', Value: '영어 독해와 작문'}]
					} else if (subject_v == "MT") {
						if(selectedInfo.grade2Index == 2) {
							popSubjDetailItems = [{Name: '수학Ⅰ', Value: '수학Ⅰ'}, {Name: '확률과 통계', Value: '확률과 통계'}, {Name: '미적분', Value: '미적분'}, {Name: '기하', Value: '기하'}]
						} else{
							popSubjDetailItems = [{Name: '대수', Value: '대수'}, {Name: '확률과 통계', Value: '확률과 통계'}, {Name: '기하', Value: '기하'}, {Name: '미적분I', Value: '미적분I'}, {Name: '미적분Ⅱ', Value: '미적분II'}]
						}
					} else if (subject_v == "SC") {
						popSubjDetailItems = [{Name: '물리학Ⅰ', Value: '물리학Ⅰ'}, {Name: '화학Ⅰ', Value: '화학Ⅰ'}, {Name: '생명과학Ⅰ', Value: '생명과학Ⅰ'}, {Name: '지구과학Ⅰ', Value: '지구과학Ⅰ'}]
					} else if (subject_v == "LS") {
						popSubjDetailItems = [{Name: '사회문화', Value: '사회문화'}, {Name: '한국지리', Value: '한국지리'}, {Name: '생활과 윤리', Value: '생활과 윤리'}, {Name: '윤리와 사상', Value: '윤리와 사상'}, {Name: '정치와 법', Value: '정치와 법'}]
					}
				}

				$("div#grade_area").insertAfter("div#period_area");
				$("div#subSujt_area").insertAfter("div#grade_area");
			} else {
				$("div#grade_area").insertAfter("div#subSujt_area");
				$("div#period_area").insertAfter("div#grade_area");
			}
			/* // 메뉴 위치 변경 */

			//_hLog("popSubjDetailItems=" + JSON.stringify(popSubjDetailItems));
			$("#productBuyEventTargetBanner").hide();
			if(fileType_o) {
				$("#zocboInfo_expect").hide();
				if(type2_v == "") {	// 학교별 기출 무료 열람실
					$("#zocboInfo").hide();
					$("#zocboInfo_FreeReading").show();
					$("#zocboInfo_expectedquestion").hide();
					$("#zocboInfo_V").hide();
					$("#zocboInfo_W").hide();
					$("#zocboInfo_HD").hide();
					$("#zocboInfo_HE").hide();
					$("#zocboInfo_I").hide();
					$("#zocboInfo_K3").hide();
					$("#zocboinfoBox").hide();
					$("#zocboInfo_B").hide();
					$("#div_FreeReading").show();
					$("#div_V").hide();
					fileType_o.parentNode.style.display = "none";
					chapter_o.parentNode.style.display = "none";
					sch_o.parentNode.style.display = "";
					gu_o.parentNode.style.display = "";
					year_o.parentNode.style.display = "";
					pub_o.parentNode.style.display = "none";
					input_o.parentNode.parentNode.style.display = "none";
					input_o.value = "";
					_getProductBuyEventTarget();

				}
				else if(type2_v == "A") {	// 학교별 기출 족보
					//$("#zocboInfo").show();
					$("#zocboInfo_FreeReading").hide();
					$("#zocboInfo_expectedquestion").hide();
					$("#zocboInfo_V").hide();
					$("#zocboInfo_W").hide();
					$("#zocboInfo_HD").hide();
					$("#zocboInfo_HE").hide();
					$("#zocboInfo_I").hide();
					$("#zocboInfo_K3").hide();
					$("#zocboinfoBox").hide();
					$("#zocboInfo_B").hide();

					if(type2_index == "7") {	// 학교별 기출유사
						//$("#zocboInfo_expect").show();
						$("#zocboInfo_expectedquestion").show();
						$("#zocboInfo_expect").hide();
						$("#zocboInfo").hide();
						fileType_o.parentNode.style.display = "none";		// 원본형, 편집형
						chapter_o.parentNode.style.display = "none";
						input_o.parentNode.parentNode.style.display = "none";
					} else {
						$("#zocboInfo").show();
						fileType_o.parentNode.style.display = "";		// 원본형, 편집형
						chapter_o.parentNode.style.display = "none";
						input_o.parentNode.parentNode.style.display = "";
					}

					//fileType_o.parentNode.style.display = "";
					sch_o.parentNode.style.display = "";
					gu_o.parentNode.style.display = "";
					year_o.parentNode.style.display = "";
					pub_o.parentNode.style.display = "none";
					//input_o.parentNode.parentNode.style.display = "";

					if(popSubjDetailItems != null) {
						subDetail_o.parentNode.style.display = "";
					} else{
						subDetail_o.parentNode.style.display = "none";
					}
					$("#div_Img").hide();
				}
				else if(type2_v == "V") {	// 학교별 예상 족보.
					$("#zocboInfo").hide();
					$("#zocboInfo_FreeReading").hide();
					$("#zocboInfo_expectedquestion").hide();
					$("#zocboInfo_V").show();
					$("#zocboInfo_W").hide();
					$("#zocboInfo_HD").hide();
					$("#zocboInfo_HE").hide();
					$("#zocboInfo_I").hide();
					$("#zocboInfo_K3").hide();
					$("#zocboinfoBox").hide();
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
					input_o.parentNode.parentNode.style.display = "none";
					subDetail_o.parentNode.style.display = "none";
				} else if(type2_v == "W") {	// 학교별 AI기출변형
					$("#zocboInfo").hide();
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
					input_o.parentNode.parentNode.style.display = "none";
					subDetail_o.parentNode.style.display = "none";
				} else if(type2_v == "I") {	// 지역별 문제
					$("#zocboInfo").hide();
					$("#zocboInfo_FreeReading").hide();
					$("#zocboInfo_expectedquestion").hide();
					$("#zocboInfo_V").hide();
					$("#zocboInfo_W").hide();
					$("#zocboInfo_HD").hide();
					$("#zocboInfo_HE").hide();
					$("#zocboInfo_I").show();
					$("#zocboInfo_K3").hide();
					$("#zocboinfoBox").hide();
					$("#zocboInfo_B").hide();
					fileType_o.parentNode.style.display = "none";
					chapter_o.parentNode.style.display = "none";
					sch_o.parentNode.style.display = "none";
					gu_o.parentNode.style.display = "none";
					year_o.parentNode.style.display = "";
					pub_o.parentNode.style.display = "";
					input_o.parentNode.parentNode.style.display = "";
					subDetail_o.parentNode.style.display = "none";
					$("#div_Img").hide();
				} else if(type2_v == "K3") {
					$("#zocboInfo").hide();
					$("#zocboInfo_FreeReading").hide();
					$("#zocboInfo_expectedquestion").hide();
					$("#zocboInfo_V").hide();
					$("#zocboInfo_W").hide();
					$("#zocboInfo_HD").hide();
					$("#zocboInfo_HE").hide();
					$("#zocboInfo_I").hide();
					$("#zocboInfo_K3").show();
					$("#zocboinfoBox").hide();
					$("#zocboInfo_B").hide();
					fileType_o.parentNode.style.display = "none";
					chapter_o.parentNode.style.display = "none";
					gu_o.parentNode.style.display = "none";
					sch_o.parentNode.style.display = "none";
					year_o.parentNode.style.display = "none";
					pub_o.parentNode.style.display = "";
					input_o.parentNode.parentNode.style.display = "none";
					input_o.value = "";
					subDetail_o.parentNode.style.display = "none";
					$("#div_Img").hide();
				} else if(type2_v == "H") {	// 최빈, 최오
					$("#zocboInfo").hide();
					$("#zocboInfo_FreeReading").hide();
					$("#zocboInfo_expectedquestion").hide();
					$("#zocboInfo_V").hide();
					$("#zocboInfo_W").hide();
					$("#zocboInfo_B").hide();

					//if(selectedInfo.type2Index == 3)
					if(selectedInfo.type2Index == ((_is_previous_chk) ? 4 : 3)) {
						$("#zocboInfo_HD").show();
						$("#zocboInfo_HE").hide();
					} else {
						$("#zocboInfo_HD").hide();
						$("#zocboInfo_HE").show();
					}

					$("#zocboInfo_I").hide();
					$("#zocboInfo_K3").hide();
					$("#zocboinfoBox").hide();
					fileType_o.parentNode.style.display = "none";
					chapter_o.parentNode.style.display = "none";
					sch_o.parentNode.style.display = "none";
					gu_o.parentNode.style.display = "none";
					year_o.parentNode.style.display = "";
					pub_o.parentNode.style.display = "";
					input_o.parentNode.parentNode.style.display = "";
					subDetail_o.parentNode.style.display = "none";
				}
			}

			if(type2_v == "K3") {
				// 강남3구 기출문제 값 설정
				_setSelectedValueForFilter2SubLoadK3();
			} else {
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
					// 기출유사 랜딩 시 지역정보가 이상하게 호출 되는 경우가 있어서 랜딩일 경우는 정확한 학교 지역정보가 있을때만 호출되게
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
							}
							else
							{
								// 1) 내 학교 지역 설정
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
																	
									if(param.isFirst == "Y" && 1==2) // 기출열람실에서 넘어왔을 시 최초 강제 새로고침 하기 위함... 새로고침할땐 안넘김								
									{
										location.replace("/H/?menu=2&type=0&yusatype=Y&scl="+param.scl+"&grade="+param.grade+"&year="+param.year+"&midend="+param.midend);
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

								//var gu_v = gu2Items[selectedInfo.gu2Index].Name;
								var data2_v = "cmd=GET_SCHOOL_LIST&site_id=" + _site_id + "&si=" + encodeURIComponent(si_v);
								data2_v = data2_v + "&region=" + encodeURIComponent(gu_v);

								comm.send(url2_v, data2_v, "post", function(json2) {
									sch2Items = [{"Scl_Name":"학교", "Value":"", "Scl_ID":""}].concat(json2.list);

									for(var i = 0; i < sch2Items.length; i++) {
										sch2Items[i]["Name"] = sch2Items[i].Scl_Name;
									}

									// 2) 내 학교 선택
									if (mem_base_info.init == "Y") {
										sch2Items.forEach(function(d, i) {
											if (d.Scl_ID == mem_base_info.scl_id) {
												selectedInfo.sch2Index = i;
											}
										})

										mem_base_info.init = "N";	// 최소 1회만 할당하기 위해
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

	// 학교별족보 필터 값 설정
	var _setSelectedValueForFilter2SubLoad = function() {
		var filter_2 = root.querySelector("#filter_2");

//		if(param.yusatype == "Y")
//		{
//			obj = filter_2.querySelector("[data-act='filter2_si']");
//			obj.innerHTML = _SI_LIST[selectedInfo.si2Index].Name;
//		}

		obj = filter_2.querySelector("[data-act='filter2_gu']");
		obj.innerHTML = gu2Items[selectedInfo.gu2Index].Name;
		

		var obj = filter_2.querySelector("[data-act='filter2_sch']");
		obj.innerHTML = sch2Items[selectedInfo.sch2Index].Name;


		obj = filter_2.querySelector("[data-act='filter2_grade']");
		obj.innerHTML = popGrade2Items[selectedInfo.grade2Index].Name;

		obj = filter_2.querySelector("[data-act='filter2_subject']");
		obj.innerHTML = popSubjectItems[selectedInfo.subject2Index].Name;

		//PV 쌓기
		if (page_Act_Chk)	//처음 페이지 로딩시, 학년, 과목, 구분값 변경시 true
		{
			common.setCount(pop2TypeItems[selectedInfo.type2Index].Name, popGrade2Items[selectedInfo.grade2Index].Name, popSubjectItems[selectedInfo.subject2Index].Name, null);
		}

		if(popSubjDetailItems && pop2TypeItems[selectedInfo.type2Index].Index != "2" && pop2TypeItems[selectedInfo.type2Index].Index != "8") {
			obj = filter_2.querySelector("[data-act='filter2_sub2Detail']");
			obj.innerHTML = popSubjDetailItems[selectedInfo.subject2DetailIndex].Name;
		}


		// 지역, 최빈, 최오
		if(parseInt(parseInt(pop2TypeItems[selectedInfo.type2Index].Index)) == 3 || parseInt(parseInt(pop2TypeItems[selectedInfo.type2Index].Index)) == 5 || parseInt(parseInt(pop2TypeItems[selectedInfo.type2Index].Index)) == 6) {
			var grade_v = popGrade2Items[selectedInfo.grade2Index].Value;

			pubItems = popSubjectItems[selectedInfo.subject2Index].TX_CODE;

			if(pubItems.length > 1) {
				// 최빈, 최오의 경우는 전체 교과서 없이~
				if(pop2TypeItems[selectedInfo.type2Index].value == "H" && (pop2TypeItems[selectedInfo.type2Index].CoreType == "D" || pop2TypeItems[selectedInfo.type2Index].CoreType == "E")) {
					//pubItems = pubItems;
				} else {
					pubItems = [{"Name": "전체 교과서", "Value": util.arrayValueAdd(pubItems).join("|")}].concat(pubItems);
				}
			}

			// 이전, 신규 리스트 > 과목에 따라 출판사 정보 별도로,,,
			if(isOldData == true  && _subject_v == "MT_O" && pop2TypeItems[selectedInfo.type2Index].value == "H" && (pop2TypeItems[selectedInfo.type2Index].CoreType == "D" || pop2TypeItems[selectedInfo.type2Index].CoreType == "E")) {
				//pubItems = pubItems;
				// 여기부터~~~  이전리스트에서는 출판사 정보가 다름...
				var grade_v = popGrade2Items[selectedInfo.grade2Index].Value;

				if (grade_v == "1") {
					pubItems = [{"Name": "공통", "Value": "H9MTCHA1001|H8MTCHA1001|H8MTCHA1002|H8MTCHA1004|H7MTEXP1005|H7MTEXP1001|H7MTEXA1004"}];
				} else if (grade_v == "2") {
					pubItems = [{"Name": "확률과 통계", "Value": "H7MTEXP2004"}, {"Name": "미적분Ⅰ", "Value": "H8MTCHA2005"}, {"Name": "미적분Ⅱ", "Value": "H8MTCHA2006"}, {"Name": "기하와 벡터", "Value": "H7MTCHA2004"}];
				}
			}

			if (_subject_v == "SC_O" && isOldData == true) {
				if (grade_v == "2") {
					pubItems = [{"Name": "생명과확Ⅰ", "Value": "H8SCCHA2001"}, {"Name": "지구과학Ⅰ", "Value": "H7SCCHA2003 "}, {"Name": "화학Ⅰ", "Value": "H7SCEXP2017"}, {"Name": "물리Ⅰ", "Value": "H7SCCHA2001"}];
				}
			}

			obj = filter_2.querySelector("[data-act='filter2_pub']");
			obj.innerHTML = pubItems[selectedInfo.pub2Index].Name;
		}
		if(selectedInfo.menuIndex == 1 && pop2TypeItems[selectedInfo.type2Index].Index == "7") {
			if (popYearItems[selectedInfo.year2Index].Value == "2021") {
				popSubItems = [{"title": "전체 학기", "Value": ""}, {"title": "2학기 중간", "Value": "2M"}, {"title": "2학기 기말", "Value": "2E"}]
			} else {
				popSubItems = [{"title": "전체 학기", "Value": ""}, {"title": "1학기 중간", "Value": "1M"}, {"title": "1학기 기말", "Value": "1E"}, {"title": "2학기 중간", "Value": "2M"}, {"title": "2학기 기말", "Value": "2E"}]
			}
		}

		if(pop2TypeItems[selectedInfo.type2Index].Index != "2" && pop2TypeItems[selectedInfo.type2Index].Index != "8") {
			if (typeof popYearItems[selectedInfo.year2Index] == "undefined") { selectedInfo.year2Index = 0; }
			obj = filter_2.querySelector("[data-act='filter2_year']");
			obj.innerHTML = popYearItems[selectedInfo.year2Index].Name;

			if (typeof popSubItems[selectedInfo.term2Index] == "undefined") { selectedInfo.term2Index = 0; }
			obj = filter_2.querySelector("[data-act='filter2_term']");
			obj.innerHTML = popSubItems[selectedInfo.term2Index].title;

			if (typeof fileType2Items[selectedInfo.fileType2Index] == "undefined") { selectedInfo.fileType2Index = 0; }
			obj = filter_2.querySelector("[data-act='filter2_fileType']");
			obj.innerHTML = fileType2Items[selectedInfo.fileType2Index].Name;
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

	// 학교별족보 > 강남3구 필터 설정
	var _setSelectedValueForFilter2SubLoadK3 = function(){
		var filter_2 = root.querySelector("#filter_2");

		popGrade2Items = k3config[_site_id];

		obj = filter_2.querySelector("[data-act='filter2_grade']");
		obj.innerHTML = popGrade2Items[selectedInfo.grade2Index].Name;

		popSubjectItems = popGrade2Items[selectedInfo.grade2Index]["subjItems"];

//		if(selectedInfo.subject2Index > 1) {
//			selectedInfo.subject2Index = 0;
//		}

		obj = filter_2.querySelector("[data-act='filter2_subject']");
		obj.innerHTML = popSubjectItems[selectedInfo.subject2Index].Name;

		pubItems = popSubjectItems[selectedInfo.subject2Index].pubList;
		obj = filter_2.querySelector("[data-act='filter2_pub']");
		obj.innerHTML = pubItems[selectedInfo.pub2Index].title;

		//PV 쌓기
		if (page_Act_Chk)	//처음 페이지 로딩시, 학년, 과목, 구분값 변경시 true
		{
			common.setCount(pop2TypeItems[selectedInfo.type2Index].Name, popGrade2Items[selectedInfo.grade2Index].Name, popSubjectItems[selectedInfo.subject2Index].Name, null);
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
						if(gradeJson.grade == "H1") {
							selectedInfo.grade3Index = 0;
						}
						else if(gradeJson.grade == "H2") {
							selectedInfo.grade3Index = 1;
						}
						else if(gradeJson.grade == "H3") {
							selectedInfo.grade3Index = 2;
						}
						else {
							isM = false;
						}

						if(isM) {
							var url_v = "/_api/search.api.asp";
							var data_v = "cmd=GET_GO_SUBJECT&site_id=" + _site_id + "&grade=" + popGradeItems[selectedInfo.grade3Index].Value;
							// 고득점마스터 과목 가져오기
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

								var url2_v = "/_api/search.api.asp";
								var data2_v = "cmd=GET_GO_BOOK&subject_id=" + subject3Items[selectedInfo.subject3Index].Value;
								comm.send(url2_v, data2_v, "post", function(json) {
									// 고득점마스터 교과서 가져오기
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

	// 고득점마스터 데이터 설정
	var _setSelectedValueForFilter3Sub = function() {
		var filter_3 = root.querySelector("#filter_3");
		if(filter_3) {
			var obj = filter_3.querySelector("[data-act='filter3_grade']");
			obj.innerHTML = popGradeItems[selectedInfo.grade3Index].Name;

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

				//PV 쌓기
				if (page_Act_Chk)	//처음 페이지 로딩시, 학년, 과목, 구분값 변경시 true
				{
					common.setCount("고득점마스터", popGradeItems[selectedInfo.grade3Index].Name, subject3Items[selectedInfo.subject3Index].Name, null);
				}

				var url2_v = "/_api/search.api.asp";
				var data2_v = "cmd=GET_GO_BOOK&subject_id=" + subject3Items[selectedInfo.subject3Index].Value;
				comm.send(url2_v, data2_v, "post", function(json) {
					tx3Items = json.list;
					for(var j = 0; j < tx3Items.length; j++) {
						tx3Items[j]["Name"] = tx3Items[j].TextBook;
						tx3Items[j]["Value"] = tx3Items[j].TextBook_ID;
					}
					obj = filter_3.querySelector("[data-act='filter3_tx']");
					obj.innerHTML = tx3Items[selectedInfo.tx3Index].Name;

					var url3_v = "/_api/search.api.asp";
					var data3_v = "cmd=GET_GO_CHAPTER&TextBook_ID=" + tx3Items[selectedInfo.tx3Index].Value;
					comm.send(url3_v, data3_v, "post", function(json) {
						// 고득점 마스터 대단원 가져오기
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

	/*
		PRO -> 내신완성 이전 (수학교과서 변형)
	**/
	var _loadData_pro = function(props) {
		isLoading = false;
		window.setTimeout(function(ev) { isLoading = false;}, 1000);
		_saveInitData();

		var obj = root.querySelector("[data-act='filter_chapter']");	
		obj.innerHTML = "전체 대단원";
		selectedInfo.chapterData = [];

		// 이용권 차감 팝업 메시지 관련
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

		/*
			수학교과서 변형 에 맞는 대단원 정보 조회
		**/	
		//var group_v = popGroupItems[selectedInfo.groupIndex].Value;
		//var coretype = popGroupItems[selectedInfo.groupIndex].CoreType;
		//var tx_v = popYearItems[selectedInfo.yearIndex].Value;
		var group_v = props.group || "";
		var coretype = props.coretype || "";

		var grade_v = popGradeItems[selectedInfo.gradeIndex].Value;
		var oldData_v = (isOldData ? "Y" : "N" );

		if(obj && group_v == "P" && (coretype.substring(0,1) == "B" || coretype.substring(0,1) == "C") && grade_v == "2"){
			obj.style.display = "";

			if (isOldData) {
				jQuery("#oldData > a").text("최신 개정자료 보기");
			} else {
				jQuery("#oldData > a").text("고3 수업자료 보기(15개정)");
			}					
		}
		
		if (group_v == "P" && coretype == "C1") {
			$(dlMsg_o).show();

			//수학 교과서 변형
			var pubname_v = encodeURIComponent(popSubItems[selectedInfo.txIndex].Name || "");
			var url_v = "/ZocboHigh/ZocboExam/Exam_MathTextbookChange.asp";
			var data_v = "strTabIndex=" + popYearItems[selectedInfo.yearIndex].Value;			
			data_v = data_v + "&bookname=" + pubname_v;
			data_v = data_v + "&OldData=" + oldData_v;
			data_v = data_v + "&Grade=" + grade_v;
		} else if (group_v == "P" && coretype == "B1") {
			$(dlMsg_o).show();
			//수학 단계별 학습관			
			var url_v = "/ZocboHigh/ZocboExam/Exam_MathStep.asp";
			var data_v = "strTabIndex=" + popTxItems[selectedInfo.txIndex].Value;		
			data_v = data_v + "&OldData=" + oldData_v;
			data_v = data_v + "&Grade=" + grade_v;
		} else if (group_v == "P" && coretype == "A1") {			
			item = pro_list[1].list;

			_drawList_pro(item);
			return;
		}

		comm.send(url_v, data_v, "POST", function(json) {
			comm.toggleLoading(false);

			var row_A = root.querySelector("#row_A");
			var row_B = root.querySelector("#row_B");

			row_A.style.display = "none";
			row_B.style.display = "";
			activeRow = row_B;

			mainList = json.list;
			totalCount = json.RecordCount;			
			mainList.RecordCount = json.RecordCount;

			if(mainList == "[]") {
				_drawNoList();
				return;
			}

			totalPage = 1;
			//mainList.exPaprNoList = json.exPaprNoList;
			
			popChapterItems = [{Name: "전체 대단원", Value: ""}];
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
				popChapterItems.push(obj);
			}

			var parent = root.querySelector("#row_B");
			var num_o = parent.querySelector(".bbsNumber b");

			num_o.innerHTML = util.toNumber(mainList.RecordCount);

			_drawList_pro(mainList);
		});

	}

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

		// 이용권 차감 팝업 메시지 관련
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

		obj = root.querySelectorAll("[name='qry']");
		obj.forEach(function(item){
			if(item.value){
				item.value = item.value.replaceAll('"', "");
				Page = 1;
				PageSize = 20;
			}
		});

		// 단원문제 (첫번째 탭)		
		if(selectedInfo.menuIndex == 0 || selectedInfo.menuIndex == 3 || selectedInfo.menuIndex == 4 || selectedInfo.menuIndex == 5) {
			var f_1 = root.querySelector("#filter_1");
			var site_v = _site_id;
			var grade_v = popGradeItems[selectedInfo.gradeIndex].Value;
			var group_v = popGroupItems[selectedInfo.groupIndex].Value;
			var codeType_v = popGroupItems[selectedInfo.groupIndex].CoreType;
			if(codeType_v == null) codeType_v = "";
			var subject_v = popSubjectItems[selectedInfo.subjectIndex].Value;
			var tx_v = popTxItems[selectedInfo.txIndex].Value;
			var tx_name = popTxItems[selectedInfo.txIndex].Name;
			var subjectName_v = popSubjectItems[selectedInfo.subjectIndex].Name;
			var year_v =popYearItems[selectedInfo.yearIndex].Value;
			var term_v = popSubItems[selectedInfo.termIndex].Value;

			if (group_v == "K" && subject_v == "MT" && codeType_v == "F") {
				year_v = popYearItems[selectedInfo.yearIndex].Name;
			}

			// 단원문제의 이용권 차감 팝업 메시지 설정
			$(dlMsg_o).show();
			$(dlMsg_o1).show();
			$(dlMsg_o2).hide();

			if(parseInt(popGroupItems[selectedInfo.groupIndex].Index) == 0 && group_v != "B") {
			//if(selectedInfo.groupIndex == 0) {	//  개념완성 -> 대단원 조회부터.
				// 국어 문법의 경우엔 중단원이 나뉘어져있지 않기때문에 예외 처리
				if (subjectName_v == "국어 문법") {
					mainList = [{"rootpart_code":"", "rootpart_name":"", "subList":[], "items":[]}];
					_loadData_1_1();
					$("#row_B .listTop").css("display", "none");
					return;
				} else {
					$("#row_B .listTop").css("display", "");
				}
				var url_v = "/_api/search.api.asp";
				var data_v = "cmd=GET_BOOK_FINALTITLE&site_id=" + site_v;
				data_v = data_v + "&TX_CODE=" + tx_v;
				data_v = data_v + "&Subj_Code=" + subject_v;
				data_v = data_v + "&pub_name=" + tx_name;

				if(subject_v == "HI") {
					data_v = data_v + "&course=28";
				}
				else {
					data_v = data_v + "&course=31";
				}
				comm.send(url_v, data_v, "post", function(json) {
					// 예외 사항 데이터 가공
					if (subject_v == "HI") {
						json.subList = [];
						for(var j = 0; j < json.list.length; j++) {
							json.list[j]["subList"] = [];
						}
					} else if (subject_v == "EG") {
						if (grade_v == "2") {
							json.subList = [];
							for (var j = 0; j < json.list.length; j++) {
								json.list[j]["subList"] = [];
							}
						}
					} 

					for (var i = 0; i < json.subList.length; i++) {
						var sitem = json.subList[i];
						for (var j = 0; j < json.list.length; j++) {
							var mitem = json.list[j];

							if (mitem.textbook_id == sitem.textbook_id && mitem.rootpart_code == sitem.rootpart_code) {
								if (json.list[j]["subList"] == null) json.list[j]["subList"] = [];
								json.list[j].subList.push(sitem);
								break;
							}
						}
					}

					mainList = json.list;
					$("#fold1").prop("checked", true);
					_loadData_1_1();
				});
			}
			else if(group_v == "B")
			{
				_loadData_1_1_Preparation();
			}
			else {
				_loadData_1();
			}
		}
		else if(selectedInfo.menuIndex == 1) {
			// 이용권 차감 팝업 관련 메시지 설정
			if(parseInt(parseInt(pop2TypeItems[selectedInfo.type2Index].Index)) == 2 || parseInt(parseInt(pop2TypeItems[selectedInfo.type2Index].Index)) == 8) {
				$(dlMsg_o).show();
				$(dlMsg_o1).hide();
				$(dlMsg_o2).show();
			} else {
				$(dlMsg_o).show();
				$(dlMsg_o1).show();
				$(dlMsg_o2).hide();
			}

			if(parseInt(parseInt(pop2TypeItems[selectedInfo.type2Index].Index)) == 0)
			{
				_loadData_FreeReading();
			}
			else if(parseInt(parseInt(pop2TypeItems[selectedInfo.type2Index].Index)) == 4) {
				// 학교별족보 > 강남3구 데이터 가져오기
				_loadK3Data();
			} else if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 5 || parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 6) {
				// 최빈, 최오
				_loadData_2_H();
			} 
			else if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 2 || parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 8) { // 예상족보, AI기출변형
				_loadData_2_V();
			}
			else {
				// 학교별족보 탭 데이터 가져오기
				_loadData_2();
			}

		}
		else if(selectedInfo.menuIndex == 2) {
			_loadData_3();
			$(dlMsg_o).show();
			$(dlMsg_o1).show();
			$(dlMsg_o2).hide();
		}
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
		var url_v = "/ZocboHigh/ZocboExam/Exam_Preparation.asp";

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

			popChapterItems = [{Name: "전체 대단원", Value: ""}];

			for(var i=0; i<mainList.length; i++) {
				var mItem = mainList[i];
				var obj = {};

				var rc = mItem.rootpart_code;
				var rn = mItem.rootpart_name;
				
				obj.Name = rn ;

				obj.Value = rc;
				popChapterItems.push(obj);
			}

			_hLog("popChapterItems=" + JSON.stringify(popChapterItems));

			var parent = root.querySelector("#row_B");
			var num_o = parent.querySelector(".bbsNumber b");

			num_o.innerHTML = util.toNumber(mainList.RecordCount);

			_drawList_Preparation(mainList);
		});
	};

	// 단워별 > 개념완성.
	var _loadData_1_1 = function() {
		// 파라미터 값 설정
		var f_1 = root.querySelector("#filter_1");
		var site_v = _site_id;
		var grade_v = popGradeItems[selectedInfo.gradeIndex].Value;
		var group_v = popGroupItems[selectedInfo.groupIndex].Value;
		var coreType_v = popGroupItems[selectedInfo.groupIndex].CoreType;
		var subject_v = popSubjectItems[selectedInfo.subjectIndex].Value;
		var subjectName_v = popSubjectItems[selectedInfo.subjectIndex].Name;
		var tx_v = popTxItems[selectedInfo.txIndex].Value;
		var year_v =popYearItems[selectedInfo.yearIndex].Value;
		var term_v = _term[selectedInfo.termIndex].Value;
		var pubname_v = encodeURIComponent(popTxItems[selectedInfo.txIndex].Name);
		var oldData_v = (isOldData ? "Y" : "N" );

		var oldData_o = root.querySelector("#oldData");

		if(grade_v == "2" && (subject_v == "KR" || subject_v == "MT" || subject_v == "SC" || subject_v == "LS" || subject_v == "HI")) {
			oldData_o.style.display = "";
		} else {
			oldData_o.style.display = "none";
		}

		if (coreType_v == null) coreType_v = "";

		var url_v = "/ZocboHigh/ZocboExam/Exam_ConceptCheck_test0.asp";
		var data_v = "site_id=" + site_v + "&Grade=" + grade_v;
		data_v = data_v + "&Group=" + group_v;
		data_v = data_v + "&ExPapr_CoreType=" + coreType_v;
		data_v = data_v + "&ExPapr_TestYear=" + year_v;
		data_v = data_v + "&ExPapr_MidEndTerm=" + term_v;
		data_v = data_v + "&Subj_Code=" + subject_v;
		// 12/17 20:52 개념완성으로 인해 추가
		data_v = data_v + "&pub_name=" + pubname_v;
		data_v = data_v + "&OldData=" + oldData_v;

		if (subjectName_v == "문학") {
			data_v = data_v + "&Subj_Code_Text=1";

			if(oldData_v == "Y") {
				tx_v = "H9KRCHA2004";
			}
			data_v = data_v + "&TX_CODE=" + tx_v;
		} else if (subjectName_v == "독서와 작문") {
			data_v = data_v + "&Subj_Code_Text=2";
			data_v = data_v + "&TX_CODE=" + tx_v;
		} else if (subjectName_v == "화법과 작문") {
			data_v = data_v + "&Subj_Code_Text=3";
			data_v = data_v + "&TX_CODE=" + tx_v;
		} else if (subject_v == "EG") {
			var sct = 0;
			if (grade_v== "1") {
				sct = 3;
			} else if (subjectName_v.indexOf("Ⅰ") >= 0) {
				sct = 5;
			} else if (subjectName_v.indexOf("Ⅱ")>= 0) {
				sct = 6;
			} else if (subjectName_v == "영어 독해와 작문") {
				sct = 7;
			} else if (subjectName_v == "영어권 문화") {
				sct = 8;
			}

			data_v = data_v + "&Subj_Code_Text="+sct;
			data_v = data_v + "&TX_CODE=" + tx_v;
		} else if (subjectName_v == "과학탐구실험") {
			//data_v = data_v + "&Subj_Code_Text=6";
		} else if(subjectName_v == "수학 영역") {
			data_v = data_v + "&Subj_Code_Text=8";
			data_v = data_v + "&TX_CODE=" + tx_v;
		} else if(subjectName_v == "과학 영역") {
			data_v = data_v + "&Subj_Code_Text=9";
			data_v = data_v + "&TX_CODE=" + tx_v;
		} else if(subjectName_v == "사회 영역") {
			data_v = data_v + "&Subj_Code_Text=10";
			data_v = data_v + "&TX_CODE=" + tx_v;
		} else {
			data_v = data_v + "&TX_CODE=" + tx_v;
		}

		data_v = data_v + "&Page=" + Page;

		if (subjectName_v == "국어 문법") {
			data_v = data_v + "&PageSize=" + PageSize;
		} else {
			data_v = data_v + "&PageSize=1000";
		}

		// 개념완성 데이터 가져오기
		comm.send(url_v, data_v, "POST", function(json) {
			comm.toggleLoading(false);

			var row_A = root.querySelector("#row_A");
			var row_B = root.querySelector("#row_B");

			row_A.style.display = "none";
			row_B.style.display = "";
			activeRow = row_B;

			mainList = json.list;
			totalCount = json.RecordCount;
			mainList.RecordCount = json.RecordCount;
			mainList.exPaprNoList = json.exPaprNoList;
			totalPage = 1;

			var vodLen = 0;

			popChapterItems = [{Name: "전체 대단원", Value: ""}];
			for(var i=0; i<json.list.length; i++) {
				var mItem = json.list[i];
				var obj = {};

				var rc = mItem.rootpart_code;
				var rn = mItem.rootpart_name;

				if(rn.indexOf("Special") > -1 ) {
					obj.Name = rn;
				} else {
					obj.Name = rc + ". " + rn;
				}

				obj.Value = rc;
				popChapterItems.push(obj);

				// 동영상 개수도 전체 개수에 포함되도록 함
				_getVODLength(mItem, vodLen);
			}

			var exPaprNoList = mainList.exPaprNoList;

			var lstIdx = exPaprNoList.lastIndexOf(",");

			if(exPaprNoList.substring(lstIdx, exPaprNoList.length) == ",") {
				exPaprNoList = exPaprNoList.substr(0, lstIdx);
			}

			var parent_o = root.querySelector("#row_B");
			var num_o = parent_o.querySelector(".bbsNumber b");

			num_o.innerHTML = util.toNumber(mainList.RecordCount);
			// 리스트 그리기
			_drawList(mainList);

			// 다운로드 수 그리기
			_drawDownCount(exPaprNoList);
		});
	};

	// 동영상 개수도 전체 개수에 포함되도록 함
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

	// 대단원/중단원이 있는 경우. 데이터 가공
		var _sortData = function(mList, dList) {
		for(var k = 0 ; k < dList.length ; k ++) {
			var dItem = dList[k];
			var isFind = false;
			for(var i = 0; i < mList.length; i++) {
				var mItem = mList[i];
				for(var j = 0; j < mItem.subList.length; j++) {
					var sItem = mItem.subList[j];
					var stitle_v = sItem.subpart_name;
					if(stitle_v.indexOf("(") > 0) {
						var stitle_a = stitle_v.split("(");
						var title_1 = stitle_a[0];
						var title_2 = stitle_a[1].replace(")", "");
						var title_a = title_2.split(",");

						var sStr = sItem.rootpart_code + "-" + sItem.subpart_code + "." + title_1;
						if(dItem.expapr_title.indexOf(sStr) > 0) {
							if(mList[i].subList[j]["items"] == null) mList[i].subList[j]["items"] = [];
							dItem.mark = 1;
							dList[k] = dItem;
							mList[i].subList[j]["items"].push(dItem);
							isFind = true;
						}

						if(isFind == false) {
							for(var m = 0; m < title_a.length; m++) {
								if(dItem.expapr_title.indexOf(title_a[m].trim()) > 0) {
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
						if(dItem.expapr_title.indexOf(sStr) > 0) {
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

	// 1depth로 나오도록 데이터 가공
	var _sortDatsOnlyStep1 = function (mList, dList) {
		for(var k = 0; k < dList.length; k++) {
			var dItem = dList[k];
			var isFind = false;
			for(var i = 0; i < mList.length; i++) {
				var mItem = mList[i];
				mList[i].subList = [];
				var mtitle_v = mItem.rootpart_name.replace(/ /g, "");
				var dtitle_v = dItem.expapr_title.replace(/ /g, "");

				if(mtitle_v == "") {
					isFind = true;
					dItem.mark = 1;
					dList[k] = dItem;
					mList[0]["items"].push(dItem);
					break;
				}

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

	// 단원문제탭 데이터 가져오기
	var _loadData_1 = function() {
		var f_1 = root.querySelector("#filter_1");
		var site_v = _site_id;
		var grade_v = popGradeItems[selectedInfo.gradeIndex].Value;
		var group_v = popGroupItems[selectedInfo.groupIndex].Value;
		var coreType_v = popGroupItems[selectedInfo.groupIndex].CoreType;
		if(coreType_v == null) coreType_v = "";
		var cutCoreType_v = coreType_v.substring(0, 1);
		var subject_v = popSubjectItems[selectedInfo.subjectIndex].Value;
		var subjectName_v = encodeURIComponent(popSubjectItems[selectedInfo.subjectIndex].Name);
		var tx_v = popTxItems[selectedInfo.txIndex].Value;
		var txName_v = encodeURIComponent(popTxItems[selectedInfo.txIndex].Name);
		var year_v =popYearItems[selectedInfo.yearIndex].Value;
		var term_v = popSubItems[selectedInfo.termIndex].Value;
		var keyword_v = encodeURIComponent(f_1.querySelector("[name='qry']").value);
		var oldData_v = (isOldData ? "Y" : "N" );
		var isMathCalc = false;
		let urlParams = new URLSearchParams(window.location.search);
		let oldRootPartCode = urlParams.get('rootpart_code');

		if (group_v == "K" && subject_v == "MT" && cutCoreType_v == "F") {
			//year_v = H_MT_Math[selectedInfo.txIndex].bookinfo[selectedInfo.yearIndex].textbook;
			tx_v = H_MT_Math[(Number(selectedInfo.txIndex) + 1)].Value;
			year_v = H_MT_Math[(Number(selectedInfo.txIndex) + 1)].bookinfo[selectedInfo.yearIndex].textbook;
		}

		if (selectedInfo.menuIndex == 3 && param.oldData == "Y") {
			if (tx_v == "HAMTCHA1001") {
				tx_v = "H9MTCHA1001";
			} else if (tx_v == "HASCCHA1001") {
				tx_v = "H9SCCHA1001";
			} else if (tx_v == "HALSCHA1001") {
				tx_v = "H9LSCHA1001";
			} else if (tx_v == "HALSCHA0001") {
				tx_v = "H9HICHA0001";
			}
		}

		var url_v = "/_api/search.api.asp";
		var data_v = "cmd=CSEARCH&site_id=" + _site_id+ "&TX_CODE=" + tx_v;

		// Group
		// H: 개념완성(과목순서별로 Subj_Code_Text값 존재 1~*), 최다빈출(E), 최다오답(D), 수학 유형별(CoreType=C), 영어 문법 문제(CoreType=T),
		// K: 수학 계산력(CoreType=B*), 고등 영문법(CoreType=C*), 시대별 문학(CoreType=Q*)
		// C: 단원별문제
		// M: 서술형문제
		// S: 고난도문제
		if (group_v == "H") {
			// 개념완성, 최다빈출, 최다오답, 수학유형별, 영어 문법 문제
			if (cutCoreType_v == "") {
				// 개념완성
		//	} else if (cutCoreType_v == "D") {
		//		// 최다 빈출
		//		PageSize = 20;
		//	} else if (cutCoreType_v == "E") {
		//		// 최다 오답
		//		PageSize = 20;
		//	} else if (cutCoreType_v == "C") {
		//		// 수학 유형별
		//		PageSize = 20;
		//		data_v = data_v + "&Subj_Name=" + subjectName_v;
		//	} else if (cutCoreType_v == "T") {
		//		// 영어 문법 문제
		//		PageSize = 20;
			}
		//	data_v = data_v + "&ExPapr_CoreType=" + coreType_v;
		}
		else if (group_v == "K") {			
			if (subject_v.substring(0, 2) == "EG" && cutCoreType_v == "C"){
				// 영문법
				PageSize = 1000;				
			} else {
				if (cutCoreType_v == "B") {
					// 수학 계산력
					if(isOldData == true) {
						popTxItems = [{"Name":"수학Ⅰ", "Value":"B3", "tabIdx": 3},
							{"Name":"수학Ⅱ", "Value":"B4", "tabIdx": 4},
							{"Name":"확률과 통계", "Value":"B5", "tabIdx": 5},
							{"Name":"미적분", "Value":"B6", "tabIdx": 6},
							{"Name":"기하", "Value":"B7", "tabIdx": 7}];
					} else {
						if(grade_v == 1) {
							popTxItems = _H2_MT_O7_1;
						} else{
							popTxItems = _H2_MT_O7;
						}
					}

					tx_v = popTxItems[selectedInfo.txIndex].tabIdx;
				} else if (cutCoreType_v == "C" && 1==2) {
					// 고등 영문법 (사용안함)
					url_v = "/ZocboHigh/ZocboExam/Default_EG_test0.asp";
					data_v = "ExPapr_CoreType="+tx_v;
					PageSize = 20;
				} else if (cutCoreType_v == "Q") {		// 시대별 문학 (이관)					
					/*
					if (isTimeLiterary) {
						url_v = "/ZocboHigh/ZocboExam/Exam_Timeliterary_XML.asp";
					} else {
						url_v = "/ZocboHigh/ZocboExam/Exam_Timeliterary.asp";
					}
					*/
					url_v = "/ZocboHigh/ZocboExam/Exam_Timeliterary_XML.asp";
					data_v = data_v + "&ExPapr_CoreType=" + coreType_v;
				}
			}
		}

		if (group_v == "K" && subject_v == "KR") {	// 작품별
			data_v = "site_id=" + _site_id + "&ExPapr_Group=K";
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
		} else {
			data_v = data_v + "&ExPapr_TestYear=" + year_v;
		}

		if ((group_v == "C" || group_v == "M" || ( group_v == "H" && (cutCoreType_v == "D" || cutCoreType_v == "E" || cutCoreType_v == "C" || cutCoreType_v == "T")) || (group_v == "S") || (group_v == "K" && cutCoreType_v == "F"))) {
			// 단원별 문제, 서술형, 최다빈출, 최다오답, 고난도문제, 수학유형별, 수학교과서변형
			url_v = "/ZocboHigh/ZocboExam/Exam_Unit_test.asp";
			data_v = data_v + "&ExPapr_CoreType=" + coreType_v;
			data_v = data_v + "&OldData=" + oldData_v;

			if (group_v == "H" && cutCoreType_v == "C") {
				data_v = data_v + "&Subj_Name=" + txName_v;
			}

			//PageSize = 1000;
			if(oldData_v == "Y") {
				if (oldRootPartCode != "" && oldRootPartCode != null) {
					data_v = data_v + "&rootpart_code=" + oldRootPartCode;
				}
				PageSize = 20;
			} else {
				PageSize = 1000;
			}
		}
		
		if (subject_v.substring(0, 2) == "EG" && ( (group_v == "K" && coreType_v == "C") || (group_v == "P" && coreType_v == "E1") ) ) {
			// 영어 중등 영문법
			url_v = "/ZocboHigh/ZocboExam/Exam_HighEngGrammar_test0.asp";
			data_v = "flag=" + year_v;
			PageSize = 1000;
		} else {
			data_v = data_v + "&Grade=" + grade_v;
			data_v = data_v + "&Subj_Code=" + subject_v;
			data_v = data_v + "&qry=" + keyword_v;
			data_v = data_v + "&Page=" + Page;
			data_v = data_v + "&PageSize=" + PageSize;
			data_v = data_v + "&Group=" + group_v;
			data_v = data_v + "&ExPapr_MidEndTerm=" + term_v;
		}

		if (group_v == "K" && subject_v == "MT" && cutCoreType_v == "B") {
			url_v = "/ZocboHigh/ZocboExam/Exam_MathCalculation_test0.asp";
			data_v = "Group=" + group_v + "&ExPapr_CoreType=B1" + "&tabIndex=" + tx_v;
			data_v = data_v + "&OldData=" + oldData_v;
			isMathCalc = true;
		} else if (group_v == "T") {	// 수행평가 정보			
			PageSize = 100;
			coreType_v = tx_v;
			url_v = "/H/PAmaster/down_test.asp";			
			data_v = "OldData=" + oldData_v;
			data_v = data_v + "&Subj_Name=" + subjectName_v;
			
			if(rootpart_codes && rootpart_codes.length != 0) {
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

		// 개정자료보기 버튼 display setting		
		if (group_v == "C" || group_v == "M" || ( group_v == "H" && (cutCoreType_v == "D" || cutCoreType_v == "E" || cutCoreType_v == "C" || cutCoreType_v == "T")) || (group_v == "S") || (group_v == "K" && cutCoreType_v == "F") || (group_v == "K" && cutCoreType_v == "C") || isMathCalc == true) {
			var oldData_o = root.querySelector("#oldData");
			if (subject_v == "MT") {
				if (grade_v == "1" || grade_v == "2") {
					oldData_o.style.display = "";
				} else {
					oldData_o.style.display = "none";
				}
			} else if (subject_v == "SC" || subject_v == "LS") {
				if(grade_v == "1") {
					oldData_o.style.display = "";
				} else if (grade_v == "2" && tx_v != 'H9SCCHA2005' && tx_v != 'H9SCCHA2006' && tx_v != 'H9SCCHA2007') {
					oldData_o.style.display = "";
				} else {
					oldData_o.style.display = "none";
				}
			} else if(grade_v == "1" && subject_v == "TH") {
				oldData_o.style.display = "";
			} else {
				oldData_o.style.display = "none";
			}

			if(grade_v == "2" && subject_v != "EG") {
				oldData_o.style.display = "";
			}

			if(isMathCalc == false) {
				if (isOldData) {
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
		}

		// toggle 선택 시 대단원에 해당하는 서브 리스트 호출하기 위해 호출 주소 전역변수에 저장
		_url_v = url_v;
		_data_v = data_v;	

		if(group_v == "C") {
			// 단원별 문제(난이도 기본 셋팅_최상위 제외)
			if (p_add_diff == "0" || p_add_diff == "") {
				data_v = data_v + "&add_diff=1,2,3";
			} else {
				data_v = data_v + "&add_diff=" + p_add_diff;
			}
		}	

		// 대단원에 따라 리스트를 불러오는 경우 필요한 초기값 확인
		var rootpart_code = "";
		comm.send(url_v, data_v, "POST", function(json) {
			//console.log(url_v)
			//console.log(data_v)
			//console.log(json)
			var isEGM = false;
			var isGroupK = false;

			if(group_v == "K" && cutCoreType_v != "F") {
				isGroupK = true;
			}
			
			if (subject_v.substring(0, 2) == "EG" && ( (group_v == "K" && coreType_v == "C") || (group_v == "P" && coreType_v == "E1"))) {
				// 고등영문법 판단
				isEGM = true;
			}

			// 페이지가 1일 경우
			// 대단원이 있는경우엔 인피니티 스크롤
			if (Page == 1) {
				if (isMathCalc) {
					items = json.items;
					if(typeof items == "undefined") {
						_drawNoList();
						return;
					}
					totalCount = items.length;

					popChapterItems = [{"Name" : "전체 대단원", "Value": ""}];
					for(var i=0; i<json.items.length; i++) {
						var chapterItem = json.items[i];
						var obj = {};
						obj.Name = chapterItem.sub_title;
						obj.Value = (i+1);
						popChapterItems.push(obj);
					}				
				} else if (subject_v.substring(0, 2) == "EG" && ( (group_v == "K" && coreType_v == "C") || (group_v == "P" && coreType_v == "E1") ) ) {
					items = json.list;				
					totalCount = json.list.length;
					totalPage = Math.ceil(totalCount / PageSize);					
				} else if (isEGM || isGroupK) {
					items = json.list;
					totalCount = json.RecordCount;
				} else if (group_v == "C" || group_v == "M" || ( group_v == "H" && (cutCoreType_v == "D" || cutCoreType_v == "E" || cutCoreType_v == "C" || cutCoreType_v == "T")) || (group_v == "S") || (group_v == "K" && cutCoreType_v == "F") ) {

					cateItems = json.cate;		// 카테고리 정보 별도 저장
					items = json.list;
					totalCount = json.RecordCount;

					if(isOldData){
						totalPage = Math.ceil(totalCount / PageSize);
					} else {
						totalPage = 1;
					}

					popChapterItems = [{"Name" : "전체 대단원", "Value": ""}];

					// 대단원리스트 구성
					for(var i=0; i<json.cate.length; i++) {
						var cateItem = json.cate[i];
						var obj = {};
						rootpart_code = ((!isNaN(cateItem.rootpart_term) && cateItem.rootpart_term != "") ? (parseInt(cateItem.rootpart_term) * 100) : 100) + parseInt(cateItem.rootpart_code);

						obj.Name = cateItem.rootpart_code +". " + cateItem.rootpart_name;
						obj.Value = cateItem.rootpart_id;
						// S : 대단원 선택 시 하위 리스트 불러오기 위한 필요값
						obj.parent_index = (i+1);
						obj.rootpart_code = rootpart_code;
						// E
						popChapterItems.push(obj);
					}
				} else if (group_v == "T") {
					// 수행평가
					// 그려져있던 li 태그 삭제
					var objs = row_B.querySelectorAll(".block_list");

					for(var i = 0; i < objs.length; i++) {
						var obj = objs[i];

						if(obj.parentNode) {
							obj.parentNode.removeChild(obj);
						}
					}

					items = json.list;
					totalCount = json.RecordCount;
					totalPage = Math.ceil(totalCount / PageSize);
					popChapterItems = [{"Name" : "전체 대단원", "Value": ""}];
					for(var i = 0; i < json.cate.length; i++) {
						var chapterItem = json.cate[i];
						var obj = {};
						var rc = chapterItem.rootpart_code;
						var rn = chapterItem.rootpart_name;
						var ri = chapterItem.rootpart_id;
						var rt = chapterItem.rootpart_term;

						if(rt != "") {
							obj.term = rt;
						}

						if(rn.indexOf("Special") >= 0 && rn.indexOf("Lesson") >= 0) {
						} else {
							obj.Name = rc + ". " + rn;
							obj.Value = rc;
							popChapterItems.push(obj);
						}
					}
				} else {
					items = json.Zocbo.data;
					totalCount = json.Zocbo.ResultCount;
					totalPage = json.Zocbo.PageCount;
				}

				$("#recordCount").html(util.toNumber(totalCount));
			} else {
				// 수학 계산력, 중등 영문법, 단원별 문제 그룹 별로 리스트그리는 방식이 다름
				if (isMathCalc) {
					items = json.items;

					popChapterItems = [{"Name" : "전체 대단원", "Value": ""}];
					for(var i=0; i<json.items.length; i++) {
						var chapterItem = json.items[i];
						var obj = {};
						obj.Name = chapterItem.sub_title;
						obj.Value = (i+1);
						popChapterItems.push(obj);
					}
				} else if (subject_v.substring(0, 2) == "EG" && ( (group_v == "K" && coreType_v == "C") || (group_v == "P" && coreType_v == "E1") ) ) {
					items = items.concat(json.list);
				} else if(isEGM || isGroupK) {
					items = items.concat(json.list);
				} else if (group_v == "C" || group_v == "M" || ( group_v == "H" && (cutCoreType_v == "D" || cutCoreType_v == "E" || cutCoreType_v == "C" || cutCoreType_v == "T")) || (group_v == "S") || (group_v == "K" && cutCoreType_v == "F") ) {
					items = json.list;
					totalCount = json.RecordCount;
					if(isOldData){
						totalPage = Math.ceil(totalCount / PageSize);
					} else {
						totalPage = 1;
					}
					popChapterItems = [{"Name" : "전체 대단원", "Value": ""}]
					for(var i=0; i<json.cate.length; i++) {
						var cateItem = json.cate[i];
						var obj = {};
						obj.Name = cateItem.rootpart_code + ". " + cateItem.rootpart_name;
						obj.Value = cateItem.rootpart_id;

						popChapterItems.push(obj);
					}
				} else {
					items = items.concat(json.Zocbo.data);
				}
			}

			var exPaprNoList = "";
			if (parseInt(popGroupItems[selectedInfo.groupIndex].Index) == 0) {				
				mainList = _sortData(mainList, json.Zocbo.data);
				_drawList(mainList);
			} else if (subject_v.substring(0, 2) == "EG" && ( (group_v == "K" && coreType_v == "C") || (group_v == "P" && coreType_v == "E1"))) {				
				// 중등 영문법
				row_A.style.display = "none";
				row_B.style.display = "";
				activeRow = row_B;
				
				if (group_v == "P" && coreType_v == "E1") {
					popChapterItems = [{Name: "전체 대단원", Value: ""}].concat(json.cate.slice(0, json.cate.length-1));
				} else {
					popChapterItems = [{Name: "전체 대단원", Value: ""}].concat(json.cate);
				}				
				grammerSelector.init(json.list, year_v, selectedInfo.termIndex, row_B, _site_id);

				return;
			} else if (isEGM) {
				row_A.style.display = "none";
				row_B.style.display = "";
				activeRow = row_B;

				popChapterItems = [{Name: "전체 대단원", Value: ""}];

				var displayCnt = 0;
				for(var i=0; i<json.list.length; i++) {
					var chapterItem = json.list[i];
					var obj = {};
					obj.Name = chapterItem.cate_name;
					obj.Value = chapterItem.sub_id;
					popChapterItems.push(obj);

					var item = json.list[i].items;

					displayCnt += item.length;
				}

				row_B.querySelector(".bbsNumber b").innerHTML = util.toNumber(displayCnt);
				grammerSelector.init(json.list, year_v, selectedInfo.termIndex, row_B, _site_id, json.exPaprNoList);
				return;
			} else if (isMathCalc) {
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

			} else if (group_v == "C" || group_v == "M" || ( group_v == "H" && (cutCoreType_v == "D" || cutCoreType_v == "E" || cutCoreType_v == "C" || cutCoreType_v == "T")) || (group_v == "S") || (group_v == "K" && cutCoreType_v == "F") || (group_v == "K" && cutCoreType_v == "C")) {
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

				//_drawList(items);		// 기존
				_drawList_v2(cateItems, items);		// 변형 (첫번째 대단원리스트만 기본 호출되게)
			} else if(isGroupK) {
				if(group_v == "K" && cutCoreType_v == "Q") {
					//시대별문학
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
					//items = tmpItems
	
					exPaprNoList = exNoArr.join(",");

					//_drawList(items);		// 기존					
					//_drawList_v2(cateItems, items);		// 변형 (첫번째 대단원리스트만 기본 호출되게)
					cateItems = korCateArr
					_drawList_v2(cateItems, items);		// 변형 (첫번째 대단원리스트만 기본 호출되게)					
				} else {
					_drawList(json.list);
				}				
			} else if (group_v == "T") {	// 수행평가
				_drawList_pro(items);
			} else{
				_drawList(json.Zocbo.data);
			}

			_initEvent();

			if (oldRootPartCode != "" && oldRootPartCode != null && selectedInfo.menuIndex == 3) {
				const targetButton = $(`.toggle[data-rootpart_code="${oldRootPartCode}"]`);

				if (targetButton.length > 0) {
					let parentIndex = targetButton.closest('[data-index]').data('index');
					
					_drawToggleItem({"parent_index": parentIndex,
									"rootpart_code": oldRootPartCode,
									"etc_action": "bbsNumber"
									});

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
		/*
		if (isNewLoading) {
			// 토탈 카운트만 체크하기 때문에 PageSize=1로 강제 치환 (속도 문제)
			comm.send(url_v, data_v.replace(/PageSize=([0-9]*)/, "PageSize=1") + "&flagRecord=Y", "POST", function(json) {
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

	// 학교별 족보 > 최빈, 최오 경우만 사용 (내신완성 리스트 템플릿 복붙)
	var _loadData_2_H = function() {
		var f_2 = root.querySelector("#filter_2");
		var site_v = _site_id;
		var qry_v = encodeURIComponent(f_2.querySelector("[name='qry']").value);
		var group_v = pop2TypeItems[selectedInfo.type2Index].value;
		var coreType_v = pop2TypeItems[selectedInfo.type2Index].CoreType;
		var scl_id_v = sch2Items[selectedInfo.sch2Index].Scl_ID;
		var grade_v = popGrade2Items[selectedInfo.grade2Index].Value;
		var subject_v = popSubjectItems[selectedInfo.subject2Index].Value;
		var subjectname_v = encodeURIComponent(popSubjectItems[selectedInfo.subject2Index].Name);
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

		//PageSize = 1000;
		if(oldData_v == "Y") {
			PageSize = 20;
		} else {
			PageSize = 1000;
		}

		var url_v = "/ZocboHigh/ZocboExam/Exam_Unit_test.asp";
		var data_v = "cmd=CSEARCH&site_id=" + site_v+ "&TX_CODE=" + txcode_v;

		data_v = data_v + "&ExPapr_TestYear=" + year_v;
		data_v = data_v + "&ExPapr_CoreType=" + coreType_v;
		data_v = data_v + "&OldData=" + oldData_v;
		data_v = data_v + "&Grade=" + grade_v;
		data_v = data_v + "&Subj_Code=" + subject_v;
		data_v = data_v + "&qry=" + qry_v;
		data_v = data_v + "&Page=" + Page;
		data_v = data_v + "&PageSize=" + PageSize;
		data_v = data_v + "&Group=" + group_v;
		data_v = data_v + "&ExPapr_MidEndTerm=" + term_v;

		var row_A = root.querySelector("#row_A");
		var row_B = root.querySelector("#row_B");
		var lt_o = row_B.querySelector(".listTop");

		// 개정자료보기 버튼 display setting
		var oldData_o = root.querySelector("#oldData");
		if (subject_v == "MT" || subject_v == "HI") {
			if (grade_v == "1" || grade_v == "2") {
				oldData_o.style.display = "";
			} else {
				oldData_o.style.display = "none";
			}
		} else if (subject_v == "SC" || subject_v == "LS") {
			if (grade_v == "2" && txcode_v != 'H9SCCHA2005' && txcode_v != 'H9SCCHA2006' && txcode_v != 'H9SCCHA2007') {
				oldData_o.style.display = "";
			} else {
				oldData_o.style.display = "none";
			}
		} else {
			oldData_o.style.display = "none";
		}

		if (isOldData) {
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

		// toggle 선택 시 대단원에 해당하는 서브 리스트 호출하기 위해 호출 주소 전역변수에 저장
		_url_v = url_v;
		_data_v = data_v;

		// 대단원에 따라 리스트를 불러오는 경우 필요한 초기값 확인
		var rootpart_code = "";

		comm.send(url_v, data_v, "POST", function(json) {
			var isEGM = false;
			var isGroupK = false;

			// 페이지가 1일 경우
			// 대단원이 있는경우엔 인피니티 스크롤
			if (Page == 1) {
				cateItems = json.cate;		// 카테고리 정보 별도 저장
				items = json.list;
				totalCount = json.RecordCount;

				if(isOldData){
					totalPage = Math.ceil(totalCount / PageSize);
				} else {
					totalPage = 1;
				}

				popChapterItems = [{"Name" : "전체 대단원", "Value": ""}];

				// 대단원리스트 구성
				for(var i=0; i<json.cate.length; i++) {
					var cateItem = json.cate[i];
					var obj = {};
					rootpart_code = ((!isNaN(cateItem.rootpart_term) && cateItem.rootpart_term != "") ? (parseInt(cateItem.rootpart_term) * 100) : 100) + parseInt(cateItem.rootpart_code);

					obj.Name = cateItem.rootpart_code +". " + cateItem.rootpart_name;
					obj.Value = cateItem.rootpart_id;
					// S : 대단원 선택 시 하위 리스트 불러오기 위한 필요값
					obj.parent_index = (i+1);
					obj.rootpart_code = rootpart_code;
					// E

					popChapterItems.push(obj);
				}

				$("#recordCount").html(util.toNumber(totalCount));
			} else {
				items = json.list;
				totalCount = json.RecordCount;
				if(isOldData){
					totalPage = Math.ceil(totalCount / PageSize);
				} else {
					totalPage = 1;
				}
				popChapterItems = [{"Name" : "전체 대단원", "Value": ""}]
				for(var i=0; i<json.cate.length; i++) {
					var cateItem = json.cate[i];
					var obj = {};
					obj.Name = cateItem.rootpart_code + ". " + cateItem.rootpart_name;
					obj.Value = cateItem.rootpart_id;
					popChapterItems.push(obj);
				}
			}

			var exPaprNoList = "";

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

			_drawList_v2_H(cateItems, items);		// 변형 (첫번째 대단원리스트만 기본 호출되게)
			_initEvent();

			comm.toggleLoading(false);

			if(json.Zocbo) {
				_drawDownCount(json.Zocbo.exPaprNoList);
			} else {
				_drawDownCount(exPaprNoList);
			}
		});

	}

	// 학교별 기출족보 탭 데이터 가져오기
	var _loadData_2 = function() {
		// 학교별 기출유사는 분기마다 학기 늘려 나가기로~
		/*
		if(selectedInfo.menuIndex == 1 && pop2TypeItems[selectedInfo.type2Index].Index == "7" && selectedInfo.term2Index > 1) {
			selectedInfo.term2Index = 0;
		}
		*/

		var f_2 = root.querySelector("#filter_2");
		var site_v = _site_id;
		var qry_v = encodeURIComponent(f_2.querySelector("[name='qry']").value);
		var group_v = pop2TypeItems[selectedInfo.type2Index].value;
		var scl_id_v = sch2Items[selectedInfo.sch2Index].Scl_ID;
		var grade_v = popGrade2Items[selectedInfo.grade2Index].Value;
		var subject_v = popSubjectItems[selectedInfo.subject2Index].Value;
		var subjectname_v = encodeURIComponent(popSubjectItems[selectedInfo.subject2Index].Name);
		var coursename_v = "";
		if(popSubjDetailItems) {
			coursename_v = popSubjDetailItems[selectedInfo.subject2DetailIndex].Value;
		}
		var term_v = popSubItems[selectedInfo.term2Index].Value;
		var exfl_group_v = fileType2Items[selectedInfo.fileType2Index].Value;
		var Rg_CitiesProvinces_v = encodeURIComponent(_SI_LIST[selectedInfo.si2Index].Name.trim());	// 지역
		var Rg_District_v = encodeURIComponent(gu2Items[selectedInfo.gu2Index].Name.trim());		// 구/군
		var coreType_v = "";
		var txcode_v = "";

		// 학교별족보 => 학교별 예상 족보 : V, 학교별 기출 족보: A, 지역별문제 : I
		if(group_v == "V" || group_v == "W") {
			popYearItems = _getExceptYears();
		} else if(group_v == "A") {			
			if (parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 1) {	// 기출족보
				coreType_v = "A"
			}
		} else if(group_v != "A") {
			if(grade_v == "2")
			{
				if(popSubjectItems[selectedInfo.subject2Index].Name == "독서")
				{
					subject_v = "KR1";
				}
				else if(popSubjectItems[selectedInfo.subject2Index].Name == "언어와 매체")
				{
					subject_v = "KR2";
				}
				else if(popSubjectItems[selectedInfo.subject2Index].Name == "영어Ⅱ")
				{
					subject_v = "EG1";
				}
				else if(popSubjectItems[selectedInfo.subject2Index].Name == "영어 독해와 작문")
				{
					subject_v = "EG2";
				}
			}

			popYearItems = [{Name: "전체 년도", Value: ""}].concat(getYears(_site_id, grade_v, group_v, "", subject_v));
		}

		if(group_v == "I")
		{
			if(grade_v == "2")
			{
				if(popSubjectItems[selectedInfo.subject2Index].Name == "독서")
				{
					subject_v = "KR";
				}
				else if(popSubjectItems[selectedInfo.subject2Index].Name == "언어와 매체")
				{
					subject_v = "KR";
				}
				else if(popSubjectItems[selectedInfo.subject2Index].Name == "영어Ⅱ")
				{
					subject_v = "EG";
				}
				else if(popSubjectItems[selectedInfo.subject2Index].Name == "영어 독해와 작문")
				{
					subject_v = "EG";
				}
			}
		}

		var year_v =popYearItems[selectedInfo.year2Index].Value;
		var cmd = "";

		var viewSelect_o = root.querySelector(".new-tab-freereading");

		// 지역, 최빈, 최오
		if(parseInt(parseInt(pop2TypeItems[selectedInfo.type2Index].Index)) == 3 || parseInt(parseInt(pop2TypeItems[selectedInfo.type2Index].Index)) == 5 || parseInt(parseInt(pop2TypeItems[selectedInfo.type2Index].Index)) == 6) {
			if(pubItems.length>0) {
				txcode_v = pubItems[selectedInfo.pub2Index].Value;
			}
		}


		if(subjectname_v == encodeURIComponent("전체 과목")) {
			subjectname_v = "";
		}
		else if(subjectname_v == encodeURIComponent("수학 영역")) {
			subjectname_v = "";
		}
		if(Rg_CitiesProvinces_v == encodeURIComponent("지역")) {
			Rg_CitiesProvinces_v = "";
		}
		if(Rg_District_v == encodeURIComponent("구/군")) {
			Rg_District_v = "";
		}

		var url_v = "/_api/search.api.asp";
		var data_v = "cmd=SEARCH_ZOCBO" + "&site_id=" + site_v + "&Group=" + group_v;

		//if(scl_id_v && parseInt(parseInt(pop2TypeItems[selectedInfo.type2Index].Index)) == 1) {
		//if(scl_id_v && (parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 1 || parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 7)) {
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
		// 우리학교, 동일출판사 다른학교 관련
		if(viewSelect_o.style.display == "") {
			var kind_o = root.querySelector(".new-tab-freereading li.active a");
			if(kind_o) {
				kind_v = kind_o.getAttribute("data-value");
			}
		}

		if(group_v != "I") {
			// 지역별 족보가 아니라면
			data_v = data_v + "&Rg_CitiesProvinces=" + Rg_CitiesProvinces_v;
			data_v = data_v + "&Rg_District=" + Rg_District_v;
			data_v = data_v + "&Scl_ID=" + scl_id_v;
			data_v = data_v + "&Exfl_Group=" + exfl_group_v;
		}

		if(kind_v) {
			data_v = data_v + "&Kind=" + kind_v;
		}

		data_v = data_v + "&Page="+Page+"&PageSize="+PageSize;
		data_v = data_v + "&ExPapr_CoreType=" + coreType_v + "&Grade=" + grade_v;
		data_v = data_v + "&ExPapr_TestYear=" + year_v;
		data_v = data_v + "&ExPapr_MidEndTerm=" + term_v;
		data_v = data_v + "&Subj_Code=" + subject_v;
		data_v = data_v + "&Subj_Name=" + subjectname_v;
		data_v = data_v + "&tx_code=" + txcode_v;
		data_v = data_v + "&qry=" + qry_v;

		if(popSubjDetailItems && group_v == "A") {
			// 학교별 기출족보이고 , 상세 과목이 있을경우 coursename이 들어간다.
			data_v = data_v + "&Course_Name="+encodeURIComponent(coursename_v);
		}

		// 학교별 기출유사일 경우
		if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 7) {
			data_v = data_v + "&gichul=Y";
		}

		comm.send(url_v, data_v, "POST", function(json) {
			var rItems = [];

			if(Page == 1) {

				//if(group_v == "A" && scl_id_v ) {
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
					rItems = json.Zocbo.data;
				}
			}

			var exNoList = "";
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
		var grade_v = popGrade2Items[selectedInfo.grade2Index].Value;
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
			var url_v = "/ZocboHigh/ZocboExam/Exam_AI_Transform.asp";
		}
		else
		{
			var url_v = "/ZocboHigh/ZocboExam/Exam_Default.asp";
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
		var coursename_v = "";
		if(popSubjDetailItems) {
			coursename_v = popSubjDetailItems[selectedInfo.subject2DetailIndex].Value;
		}
		var term_v = _term[selectedInfo.term2Index].Value;
		var Rg_CitiesProvinces_v = encodeURIComponent(_SI_LIST[selectedInfo.si2Index].Name.trim());	// 지역
		var Rg_District_v = encodeURIComponent(gu2Items[selectedInfo.gu2Index].Name.trim());		// 구/군
		var coreType_v = "";
		var vYear = popYearItems[selectedInfo.year2Index].Value;
		var exfl_group_v = "";

//		if (vYear == "")
//		{
//			if (grade_v == "1")
//			{
//				vYear = "2021|2020|2019|2018";
//			}
//			else if(grade_v == "2")
//			{
//				vYear = "2021|2020|2019";
//			}
//			else if(grade_v == "3")
//			{
//				vYear = "2021|2020";
//			}
//		}

		var cmd = "";
		var txcode_v = "";
		var txname_v = "";

		var viewSelect_o = root.querySelector(".new-tab-freereading");
		viewSelect_o.style.display = "none";

		var kind_v = "A";

		if(subjectname_v == encodeURIComponent("전체 과목")) {
			subjectname_v = "";
		}
		else if(subjectname_v == encodeURIComponent("수학 영역")) {
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

		var url_v = "/_api/search.api.asp";
		var data_v = "cmd=SEARCH_ZOCBO" + "&site_id=" + site_v + "&Group=" + "A";

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
		data_v = data_v + "&Subj_Name=" + subjectname_v;
		data_v = data_v + "&tx_code=" + txcode_v;
		data_v = data_v + "&Course_Name="+encodeURIComponent(coursename_v);

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
					rItems = json.Zocbo.data;
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

	// 학교별 기출족보 탭 강남3구 데이터 가져오기
	var _loadK3Data = function(){
		var f_2 = root.querySelector("#filter_2");
		var site_v = _site_id;
		var flag_v = popGrade2Items[selectedInfo.gradeK3Index].flag;
		var qry_v = encodeURIComponent(f_2.querySelector("[name='qry']").value);

		var grade_v = 1;

		var exGroup_v = "K";
		var coreType_v = "D";
		var subject_v = popSubjectItems[selectedInfo.subject2Index].Value // KR
		var txcode_v =  pubItems[selectedInfo.pub2Index].TX_CODE; // txcode

		var url_v = "/_api/search.api.asp";
		var data_v = "cmd=ZCSEARCH&site_id="+site_v+"&ExPapr_Group="+exGroup_v+"&ExPapr_CoreType="+coreType_v;

		data_v = data_v + "&flag=H" + flag_v;
		data_v = data_v + "&Grade=" + grade_v;
		data_v = data_v + "&Subj_Code="+subject_v;
		data_v = data_v + "&TX_CODE="+txcode_v;
		data_v = data_v + "&Page=" + Page + "&PageSize=" + PageSize;

		var viewSelect_o = root.querySelector(".new-tab-freereading");
		viewSelect_o.style.display = "none";

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

	// 학교별 기출족보 탭 강남3구 데이터 그리기
	var _drawK3Data = function(item_p, index_p){
		$(".tabLine-round_M li").removeClass("active");
		$(".tabLine-round_M li").eq(5).addClass("active");

		var scroll_subject = $j(".tabLine-round_M li.active").offset().left;
			
		if(scroll_subject > 300) {
			$j(".tabLine-round_M").animate({scrollLeft : scroll_subject - 200}, 0);
		}

		item = util.keysToLowerCase(item_p);
		var ul_o = root.querySelector("#list_A");
		
		item.hwp2002 = "NONE";

		var formatInfo = "";
		// 2:pdf, 3:scan, 4:hwp, 5:zip
		// formatInfo값에 따라 파일 다운 확장자 아이콘을 그려줌
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
		li_o.setAttribute("data-group", item.expapr_group);
		li_o.setAttribute("data-grade", item.grade);
		li_o.setAttribute("data-subjcode", item.subj_code);
		li_o.setAttribute("data-coretype", item.expapr_coretype);
		li_o.setAttribute("data-tx", item.tx_code);
		li_o.setAttribute("data-year", item.expapr_testyear);
		li_o.setAttribute("data-formats", formatInfo);
		//li_o.setAttribute("data-title", item.expapr_title);
		li_o.setAttribute("data-title", item.add_title);
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
			//var title_v = item.expapr_title;
			var title_v = item.add_title;
			p_o.innerHTML = "<span>"+title_v+"</span>";
			li_o.appendChild(p_o);
		}
		{
			var p_o = document.createElement("p");
			p_o.className = "hash";
			var key_v = null;
			key_v = _site_id + item.grade;

			var hash1 = "#" + _categorySub[key_v].title;
			var hash2 = "#" + item.tx_name;
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

	// 상품목록에 다운로드수 그리기 함수
	var _drawDownCount = function(exPaprNoList){
		return;		// 다운로드수 체크 X

		if(exPaprNoList.startsWith(',')) {
			exPaprNoList = exPaprNoList.substring(1, exPaprNoList.length);
		}

		var arr = exPaprNoList.split(",");

		arr = util.arrayFilter(arr);

		exPaprNoList = arr.join(",").replace(/\,$/g, "");

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
	var _loadData_3 = function() {
		var f_3 = root.querySelector("#filter_3");
		var rootPart_ID =chapter3Items[selectedInfo.chapter3Index].Value;

		var url_v = "/ZocboHigh/Tweezers/View_test.asp";
		var data_v = "cmd=GO_VIEW&rootPart_ID=" + rootPart_ID + "&site_id=" + _site_id;

		comm.send(url_v, data_v, "post", function(json) {
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

			if(selectedInfo.sub3Index == 0) {
				items = basicList;
			} else {
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
	/*
		PRO전용관 메뉴 이전 - UI 별도 사용 (수학교과서변형)
	**/
	var _drawList_pro = function(dataItems) {
		var ul_o = root.querySelector("#list_A");
		var redown_expapr_no = [];		// 재다운표시 (정효태, 2021.11.29)
		if(ul_o) {
			if(Page == 1) {
				ul_o.innerHTML = "";
			}
			if(dataItems == null || dataItems.length == 0){
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
			var subjectName_v = popSubjectItems[selectedInfo.subjectIndex].Name;
			var coreType_v = popGroupItems[selectedInfo.groupIndex].CoreType;

			var isMathCalc = false;
			var isConcept = false;		// 개념완성 여부 체크 (정효태, 2021.11.29)

			if((group_v == "P" && coreType_v.substring(0,1) == "C") || (group_v == "P" && coreType_v.substring(0,1) == "B")) {
				// 수학교과서변형 / 수학단계별학습관
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
					_drawItem_pro(item, PageSize * (Page - 1) + i);
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
			} else if(group_v == "T") {		// 수행평가
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
			} else {
				// 국어문법
				row_A.style.display = "none";
				row_B.style.display = "";
				activeRow = row_B;

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
								redown_expapr_no.push(sItem[obj_Arr[k]]);
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
	}

	// 수학교과서변형 / 수학단계별학습관
	var _drawItem_pro = function(item, index_p) {
		var parent = root.querySelector("#row_B");
		var pItem = item;
		var div_o = document.createElement("div");
		div_o.className = "block_list";
		div_o.setAttribute("data-index", index_p + 1);			// 개념완성 리스트 안보이는 부분
		parent.appendChild(div_o);
		var p_o = document.createElement("p")
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
			var sub_o = _createSubItems_pro(pItem, -1);
			if(sub_o) {
				div_o.appendChild(sub_o);
			}
		}
		else {
			for(var i = 0 ; i <pItem.subList.length; i++) {
				var sub_o = _createSubItems_pro(pItem.subList[i], i);
				if(sub_o) {
					div_o.appendChild(sub_o);
				}
			}
		}
	};

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
			var subItemKey = Object.keys(subItem);

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
				// 버튼그리기
				if (((obj_Arr[j] == "exPapr_No2" && obj_Arr[j+1] == "exPapr_No2_2") || obj_Arr[j] == "exPapr_No2_2") || ((obj_Arr[j] == "exPapr_No3" && obj_Arr[j+1] == "exPapr_No3_2") || obj_Arr[j] == "exPapr_No3_2")) {
					var eroot = li_o;

					var div2_o = document.createElement("div");
					div2_o.className = "detailLink";
					li_o.appendChild(div2_o);

					var sul_o = document.createElement("ul");
					sul_o.className = "clearfix";
					div2_o.appendChild(sul_o);

					_drawDownLoadBtn(subItem[obj_Arr[j]], eroot);
				}
			}
		}
		comm.toggleLoading(false);
	};

	// 국어문법
	var _drawDownLoadBtn = function(expapr_no, eroot) {
		var no_v = expapr_no;
		var group_v = eroot.getAttribute("data-group");
		var grade_v = eroot.getAttribute("data-grade");
		var subject_v = eroot.getAttribute("data-subjcode");
		var coretype_v = eroot.getAttribute("data-coretype");
		var year_v = eroot.getAttribute("data-year");
		var formats_v = "2"
		var title_v = eroot.getAttribute("data-title");
		var code_v = eroot.getAttribute("data-code");
		var type_v = eroot.getAttribute("data-type");
		var partnum_v = eroot.getAttribute("data-partnum");
		var name_v = eroot.getAttribute("data-name");
		var revodstate_v = eroot.getAttribute("data-revodstate");
		var root_expapr_no = eroot.getAttribute("data-rootexpaprno");

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
		pItem.pObject = eroot;
		pItem.root_expapr_no = root_expapr_no;

		_Unit.drawButton("pdf", pItem, -1, function(evo) {
            var dataItem = _Unit.getAttributeValue(evo);
            fn_examDownload(dataItem.expapr_no, dataItem.format, dataItem.siteid, dataItem.group, "", dataItem.subj_code, dataItem.grade, dataItem.coretype);
		})
	}

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

			if(group_v == "B") {
				// 직전대비
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
			} 

			if(coreType_v != "C")
			{
				// 재다운 표시
				ui_updater.setUI();
			}			

			_initEvent();
		}
	};

	var _drawList = function(dataItems) {
		var ul_o = root.querySelector("#list_A");
		var redown_expapr_no = [];		// 재다운표시 (정효태, 2021.11.29)

		if(ul_o) {
			if(Page == 1) {
				ul_o.innerHTML = "";
			}
			if(dataItems == null || dataItems.length == 0) {
				if(dataItems == null && selectedInfo.menuIndex == 1 && parseInt(parseInt(pop2TypeItems[selectedInfo.type2Index].Index)) == 0)
				{
					//activeRow.querySelector(".bbsNumber b").innerHTML = 0;
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
				// 고득점마스터
				var row_o = root.querySelector("#row_C");
				var parent_o = row_o.querySelector(".productBlock");
				parent_o.innerHTML = "";
				{
					var count_o = row_o.querySelector(".listTop .row .bbsNumber b");
					if(count_o){
						count_o.innerHTML = util.toNumber(totalCount);
					}

					var p_o = row_o.querySelector(".titleLine");
					p_o.innerHTML = chapter3Items[selectedInfo.chapter3Index].Name + '<button type="button" data-src="main" data-act="toggleAll" class="toggle">접기/펼치기</button></p>';

					$(row_o).find("#fold3").trigger("click");
				}
			}

			var row_A = root.querySelector("#row_A");
			var row_B = root.querySelector("#row_B");
			var row_C = root.querySelector("#row_C");
			if(selectedInfo.menuIndex == 0 || selectedInfo.menuIndex == 3 || selectedInfo.menuIndex == 4) {

				var group_v = popGroupItems[selectedInfo.groupIndex].Value;
		    	var subject_v = popSubjectItems[selectedInfo.subjectIndex].Value;
		    	var subjectName_v = popSubjectItems[selectedInfo.subjectIndex].Name;
		    	var coreType_v = popGroupItems[selectedInfo.groupIndex].CoreType;

		    	var isMathCalc = false;
				var isConcept = false;		// 개념완성 여부 체크 (정효태, 2021.11.29)

		    	if(group_v == "K" && subject_v == "MT" && coreType_v.substring(0,1) == "B") {
		    		isMathCalc = true;
		    	}

		    	if(parseInt(popGroupItems[selectedInfo.groupIndex].Index) == 0 || isMathCalc || ((group_v == "C" || group_v == "M" || ( group_v == "H" && (coreType_v == "D" || coreType_v == "E" || coreType_v == "C" || coreType_v == "T")) || (group_v == "S") || (group_v == "K" && coreType_v == "F") || (group_v == "K" && coreType_v == "C")) && isOldData == false)) {	//  개념완성 -> 대단원 조회부터.
				//if(selectedInfo.groupIndex == 0 || isMathCalc || ((group_v == "C" || group_v == "M" || ( group_v == "H" && (coreType_v == "D" || coreType_v == "E" || coreType_v == "C" || coreType_v == "T")) || (group_v == "S") || (group_v == "K" && coreType_v == "F")) && isOldData == false)) {	//  개념완성 -> 대단원 조회부터.
					if(subjectName_v == "국어 문법" && group_v == "H" && coreType_v == "") {
		    			// 개념완성 국어문법의 경우 대단원이 존재하지않음.

		    			row_A.style.display = "";
		    			row_B.style.display = "none";
		    			activeRow = row_A;

		    			row_A.querySelector("#recordCount").innerHTML = util.toNumber(totalCount);

		    			for(var i=0; i<dataItems.length; i++) {
		    				var item = dataItems[i];
		    				_drawItem(item, PageSize * (Page - 1) + i);
		    			}

						// 재다운 표시 (정효태, 2021.11.29)
						if (dataItems.exPaprNoList) {
							redown_expapr_no = dataItems.exPaprNoList;
						}
		    		} else {						
		    			row_B.querySelector(".bbsNumber b").innerHTML = util.toNumber(totalCount);

		    			var objs = row_B.querySelectorAll(".block_list");
		    			for(var i = 0; i < objs.length; i++) {
		    				var obj = objs[i];
		    				if(obj.parentNode) {
		    					obj.parentNode.removeChild(obj);
		    				}
		    			}

		    			for(var i = 0; i < dataItems.length; i++) {
		    				var item = dataItems[i];
		    				if(group_v == "C" || group_v == "M" || ( group_v == "H" && (coreType_v == "D" || coreType_v == "E" || coreType_v == "C" || coreType_v == "T")) || (group_v == "S") || (group_v == "K" && coreType_v == "F") || (group_v == "K" && coreType_v == "C")) {
		    					_drawItem_C(item, PageSize * (Page - 1) + i);
		    				} else {
								isConcept = true;
		    					_drawItem_0(item, PageSize * (Page - 1) + i);
		    				}
		    			}

						// 재다운 표시 (정효태, 2021.11.29)
						if (isMathCalc) {	// 수학 계산력일 경우는 리스트 양식이 다름
							for (var i=0; i<dataItems.length; i++) {
								for (var y=0 ; y<dataItems[i].items.length ; y++) {
									redown_expapr_no.push(dataItems[i].items[y].expapr_no);
								}
							}
						} else if (isConcept) {		// 개념완성일 경우 별도 체크
							for (var i=0; i<dataItems.length; i++) {
								if (typeof(dataItems[i].items) == "undefined") {
									for (var y=0 ; y<dataItems[i].subList.length ; y++) {
										for (var x=0 ; x<dataItems[i].subList[y].items.length ; x++) {
											redown_expapr_no.push(dataItems[i].subList[y].items[x].expapr_no);
										}
									}
								} else {	// 영문법인 경우만 sublist > items 아니라 바로 items 나옴.
									for (var y=0 ; y<dataItems[i].items.length ; y++) {
										redown_expapr_no.push(dataItems[i].items[y].expapr_no);
									}
								}
							}
						} else if (dataItems.exPaprNoList) {
							redown_expapr_no = dataItems.exPaprNoList;
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

			// 재다운표시 공통 적용
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

	// 카테고리 정보와 리스트 정보 분리 (정효태)
	var _drawList_v2 = function(cateItems, dataItems) {
		var ul_o = root.querySelector("#list_A");
		if (ul_o) {
			if (Page == 1) {
				ul_o.innerHTML = "";
			}
			if (dataItems == null || dataItems.length == 0) {
				_drawNoList();
				return;
			}

			sortDataItems = [];
			if (Page == 1) {
				ul_o.innerHTML = "";
			}

			if (dataItems.length <= 0) {
				return;
			}

			if (selectedInfo.menuIndex == 2 && Page == 1) {
				// 고득점마스터
				var row_o = root.querySelector("#row_C");
				var parent_o = row_o.querySelector(".productBlock");
				parent_o.innerHTML = "";
				{
					var count_o = row_o.querySelector(".listTop .row .bbsNumber b");
					if(count_o){
						count_o.innerHTML = util.toNumber(totalCount);
					}

					var p_o = row_o.querySelector(".titleLine");
					p_o.innerHTML = chapter3Items[selectedInfo.chapter3Index].Name + '<button type="button" data-src="main" data-act="toggleAll" class="toggle">접기/펼치기</button></p>';

					$(row_o).find("#fold3").trigger("click");
				}
			}

			var row_A = root.querySelector("#row_A");
			var row_B = root.querySelector("#row_B");
			var row_C = root.querySelector("#row_C");

			if (selectedInfo.menuIndex == 0 || selectedInfo.menuIndex == 3 || selectedInfo.menuIndex == 4) {
				var group_v = popGroupItems[selectedInfo.groupIndex].Value;
		    	var subject_v = popSubjectItems[selectedInfo.subjectIndex].Value;
		    	var subjectName_v = popSubjectItems[selectedInfo.subjectIndex].Name;
		    	var coreType_v = popGroupItems[selectedInfo.groupIndex].CoreType;

		    	var isMathCalc = false;

		    	if(group_v == "K" && subject_v == "MT" && coreType_v.substring(0,1) == "B") {
		    		isMathCalc = true;
		    	}	

				if(group_v == "C" && subject_v == "TH" && isOldData == "Y") {
					row_A.style.display = "none";
					row_B.style.display = "";
					activeRow = row_B;
					row_B.querySelector(".listTop").style.display = "";
					row_B.querySelector(".bbsNumber b").innerHTML = util.toNumber(totalCount);

					var objs = row_B.querySelectorAll(".block_list");
					for(var i = 0; i < objs.length; i++) {
						var obj = objs[i];
						if(obj.parentNode) {
							obj.parentNode.removeChild(obj);
						}
					}

					var item = null;
					var cateItem = null;

					for (var i = 0; i < cateItems.length; i++) {
						cateItem = cateItems[i];
						item = dataItems[i];

						//_drawItem_C_v2(cateItem, item);
						_drawItem_C_v2({"cateItem":cateItem, "dataItems" : item});
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
						//var num_o = root.querySelector("#row_B").querySelector(".bbsNumber b");
						var num_o = root.querySelector("#row_B").querySelector(".bbsNumber b");
						if (num_o) {
							if (typeof(json.RecordCount) != "undefined") {
								num_o.innerHTML = util.toNumber(json.RecordCount);
							}
						}
					});
				} else {
					if(parseInt(popGroupItems[selectedInfo.groupIndex].Index) == 0 || isMathCalc || ((group_v == "C" || group_v == "M" || ( group_v == "H" && (coreType_v == "D" || coreType_v == "E" || coreType_v == "C" || coreType_v == "T")) || (group_v == "S") || (group_v == "K" && coreType_v == "F") || (group_v == "K" && coreType_v == "C")) && isOldData == false)) {	//  개념완성 -> 대단원 조회부터.	
						row_B.querySelector(".bbsNumber b").innerHTML = util.toNumber(totalCount);

						var objs = row_B.querySelectorAll(".block_list");
						for(var i = 0; i < objs.length; i++) {
							var obj = objs[i];
							if(obj.parentNode) {
								obj.parentNode.removeChild(obj);
							}
						}

						if (group_v == "C" || group_v == "M" || ( group_v == "H" && (coreType_v == "D" || coreType_v == "E" || coreType_v == "C" || coreType_v == "T")) || (group_v == "S") || (group_v == "K" && coreType_v == "F") || (group_v == "K" && coreType_v == "C")) {
							var item = null;
							var cateItem = null;

							// 검색조건이 없을 경우 전체 대메뉴 표시 (학기검색, 키워드검색)
							// if (selectedInfo.termIndex == "0" && filter_1.querySelector("input[name='qry']").value == "") {
							// 년도는 왜 누락되었을까요..? 년도값도 추가해야될거같은데... (2023.03.06)
							if (filter_1.querySelector("input[name='qry']").value == "") {
								for (var i = 0; i < cateItems.length; i++) {
									cateItem = cateItems[i];
									item = dataItems[i];

									//_drawItem_C_v2(cateItem, item);
									_drawItem_C_v2({"cateItem":cateItem, "dataItems" : item});
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
								popChapterItems = [];
								popChapterItems = [{"Name" : "전체 대단원", "Value": ""}];

								for (var i = 0; i < dataItems.length; i++) {
									var obj = {};
									item = dataItems[i];
									cateItem = cateItems[parseInt(item.index_code) - 1];

									// 대메뉴 재 구성
									obj.Name = cateItem.rootpart_code +". " + cateItem.rootpart_name;
									obj.Value = cateItem.rootpart_id;
									obj.parent_index = (i+1);
									obj.rootpart_code = item.rootpart_code;
									popChapterItems.push(obj);

									//_drawItem_C_v2(cateItem, item);
									_drawItem_C_v2({"cateItem":cateItem, "dataItems" : item});
								}
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
				}
			}

			_initEvent();
		}
	};

	// 학교별족보(최빈, 최오)는 내신완성 리스트 템플릿 사용 (복붙)
	var _drawList_v2_H = function(cateItems, dataItems) {
		var ul_o = root.querySelector("#list_A");
		if (ul_o) {
			if (Page == 1) {
				ul_o.innerHTML = "";
			}
			if (dataItems == null || dataItems.length == 0) {
				_drawNoList();
				return;
			}
			sortDataItems = [];
			if (Page == 1) {
				ul_o.innerHTML = "";
			}

			if (dataItems.length <= 0) {
				return;
			}

			var row_A = root.querySelector("#row_A");
			var row_B = root.querySelector("#row_B");
			var row_C = root.querySelector("#row_C");

			var group_v = pop2TypeItems[selectedInfo.type2Index].value;
			var subject_v = popSubjectItems[selectedInfo.subject2Index].Value;
			var subjectName_v = encodeURIComponent(popSubjectItems[selectedInfo.subject2Index].Name);
			var coreType_v = pop2TypeItems[selectedInfo.type2Index].CoreType;

			// 학교별족보(최빈, 최오)는 내신완성 리스트 같이 사용 (내신완성 리스트 복붙)

			if(isOldData == false) {
				row_B.querySelector(".bbsNumber b").innerHTML = util.toNumber(totalCount);

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

						//_drawItem_C_v2(cateItem, item);
						_drawItem_C_v2({"cateItem":cateItem, "dataItems" : item});
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
					popChapterItems = [];
					popChapterItems = [{"Name" : "전체 대단원", "Value": ""}];

					for (var i = 0; i < dataItems.length; i++) {
						var obj = {};
						item = dataItems[i];
						cateItem = cateItems[parseInt(item.index_code) - 1];

						// 대메뉴 재 구성
						obj.Name = cateItem.rootpart_code +". " + cateItem.rootpart_name;
						obj.Value = cateItem.rootpart_id;
						obj.parent_index = (i+1);
						obj.rootpart_code = item.rootpart_code;
						popChapterItems.push(obj);

						//_drawItem_C_v2(cateItem, item);
						_drawItem_C_v2({"cateItem":cateItem, "dataItems" : item});
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

	var _drawItem = function(item, index_p) {
		if(selectedInfo.menuIndex == 0 || selectedInfo.menuIndex == 3 || selectedInfo.menuIndex == 4) {
			_drawItem_1(item, index_p);
		}
		else if(selectedInfo.menuIndex == 1) {
			if(parseInt(parseInt(pop2TypeItems[selectedInfo.type2Index].Index)) == 4) {
				_drawK3Data(item, index_p);
			}
			else if(parseInt(parseInt(pop2TypeItems[selectedInfo.type2Index].Index)) == 0)
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

	// 단원별 문제 그리기 (그룹핑)
	var _drawItem_C = function(item_p, index_p) {
    	var parent = root.querySelector("#row_B");
    	var num_o = parent.querySelector(".bbsNumber b");

    	if(num_o){
    		num_o.innerHTML = util.toNumber(totalCount);
    	}
    	$(parent).find("#fold1").trigger("click");

    	var div_o = document.createElement("div");
    	div_o.className = "block_list";
    	div_o.setAttribute("data-index", item_p.index_code);
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
			if (item.exPapr_group == "T" && (item.exPapr_CoreType == "A" || item.exPapr_CoreType == "B")) {
				// 수행마스터는 한글 제공 안함
			} else {
				if(item.HWP2002 != "NONE") formatInfo = "4";
			}    		
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

	    	_hLog("drawItemC");

	    	if(rItem.Course_Name == "국어 문법" || rItem.tx_name == "국어 문법") {
	    		formatInfo = "2";
	    	}

	    	if(item.expapr_title.indexOf("[Q]") > -1){
	    		formatInfo = _checkDownloadBtn(formatInfo);
	    	}

    		item = util.keysToLowerCase(item);

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
    		var hash2 = "#" + item.tx_name;
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
	//var _drawItem_C_sub_v2 = function(p_div_o, item_p) {
	var _drawItem_C_sub_v2 = function(props) {		
		var p_div_o = props.obj_div;
		var item_p = props.items;
		var group_v = props.group || "";
		var coretype_v = props.coretype || "";
		var toggle = props.toggle || true;
		var cateItem = "";
		var rItem = item_p.items;
		var redown_expapr_no = [];		// 정효태 (2021.11.29)

		for(var i=0; i<rItem.length; i++) {
			var item = rItem[i];
			
			// from PRO : 시대별 문학 
			if (group_v == "K" && (coretype_v.substring(0,1) == "Q" || coretype_v.substring(0,1) == "R")) {
				cateItem = item_p.cate
				if (item.expapr_title.indexOf(cateItem) < 0) {
					continue;
				}
			}

			var row_o = document.createElement("div");
			row_o.className = "productBlock row";

			var p_div_o_index = p_div_o.getAttribute("data-index")
			if (!toggle) {
				if (p_div_o_index > 1) {
					row_o.style.display = "none";
				}
			}

			var ul_o = document.createElement("ul");
			ul_o.className = "bbsList fullTitle mB20";
			row_o.appendChild(ul_o);
			

			//if((item.exPapr_group == "C") || (item.exPapr_group == "H" && item.exPapr_CoreType == "T")) {
				item.HWP2002 = "NONE";
			//}

			var formatInfo = "";
			// 2:pdf, 3:scan, 4:hwp, 5:zip
			if (item.HWP2002 != "NONE") formatInfo = "4";
			if (item.PDF && item.PDF != "NONE") {
				if (formatInfo != "") formatInfo = formatInfo + ",";
				formatInfo = formatInfo + "2";
			}

			if (item.SCAN && item.SCAN != "NONE") {
				if (formatInfo != "") formatInfo = formatInfo + ",";
				formatInfo = formatInfo + "3";
			}
			if (item.ZIP && item.ZIP != "NONE") {
				if (formatInfo != "") formatInfo = formatInfo + ",";
				formatInfo = formatInfo + "5";
			}

			if (rItem.Course_Name == "국어 문법" || rItem.tx_name == "국어 문법") {
				formatInfo = "2";
			}

			if (item.expapr_title.indexOf("[Q]") > -1) {
				formatInfo = _checkDownloadBtn(formatInfo);
			}

			item = util.keysToLowerCase(item);

			if (item.expapr_group == "K" && item.expapr_coretype.substring(0,1) == "Q") {
				//작품분석
				formatInfo = "90,2"
			} else if (item.expapr_group == "K" && item.expapr_coretype.substring(0,1) == "R") {
				//실전문제
				//formatInfo = "4,2"
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
			li_o.setAttribute("data-partnum", 1);		// (필요한지 체크 - from 시대문학)
			ul_o.appendChild(li_o);

			var p_o = document.createElement("p");
			p_o.className = "tag";

			// 교과서 변형
			if (item.subj_code == 'MT' && item.expapr_group == 'K' && item.expapr_coretype == 'F') {
				p_o.innerHTML = "<span>교과서 변형";
			} else if (item.expapr_group == "K" && item.expapr_coretype.substring(0,1) == "Q") {
				//작품분석
				p_o.innerHTML = "<span>영싱&작품분석";
			} else if (item.expapr_group == "K" && item.expapr_coretype.substring(0,1) == "R") {
				//실전문제
				p_o.innerHTML = "<span>실전문제";
			} else {
				//p_o.innerHTML = "<span>" +item.add_attr1+ "</span>"
				p_o.innerHTML = "<span>" +item.expapr_testyear+ "년 대비</span>";
				p_o.innerHTML = p_o.innerHTML + "<span>" +item.add_attr2+ "</span>"
				if (item.expapr_group == 'H' && (item.expapr_coretype == 'C' || item.expapr_coretype == 'T')) {	// 수학 유형별 문제 or 영어문법문제(출판사별)
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

			//if (common.isPremium(item.expapr_title)) {
			//	p_o.innerHTML = p_o.innerHTML + "<span>프리미엄</span>";
			//}
			li_o.appendChild(p_o);

			if (item.expapr_group == "K" && item.expapr_coretype.substring(0,1) == "R") {
				//시대별문학 실전문제
				if (item.expapr_title) {
					item.expapr_title = item.expapr_title.replace("[작품별] ", "");
					item.expapr_title = item.expapr_title.substr(0,item.expapr_title.indexOf("["));
				}
			}

			p_o = document.createElement("p");
			p_o.className = "title";
			if (group_v == "K" && (coretype_v.substring(0,1) == "Q" || coretype_v.substring(0,1) == "R")) {
				p_o.innerHTML = "<span>" + item.expapr_title + "</span>";
			} else {
				if(item.expapr_testyear == new Date().getFullYear())
				{
					item.add_title = item.add_title + "<img src='/img/ico_new.png' style='margin-left:10px;width:12px;height:12px;'>";
				}

				p_o.innerHTML = "<span>" + item.add_title + "</span>";
			}			
			li_o.appendChild(p_o);			

			var p_o = document.createElement("p");
			p_o.className = "hash";
			var key_v = null;
			key_v = _site_id + item.grade;

			var hash1 = "#" + _categorySub[key_v].title;
			var hash2 = "#" + item.tx_name;
			var hash3 = "#" + item.pub_name;

			if (item.subj_code == 'MT' && item.expapr_group == 'K' && item.expapr_coretype == 'F') {	// 교과서 변형				
				p_o.innerHTML = "<span>"+hash1+"</span><span>"+hash2+"</span>";
			} else if (item.expapr_group == 'C' && item.expapr_coretype == '') {
				if (common.isPremium(item.expapr_title)) {
					p_o.innerHTML = "<span>"+hash1+"</span><span>#프리미엄</span><span>"+hash2+"</span><span>" + hash3 + "</span>";
				}
			} else if (group_v == "K" && (coretype_v.substring(0,1) == "Q" || coretype_v.substring(0,1) == "R")) {	// 시대별 문학
				hash1 = "#전학년";
				hash2 = "#국어";
				p_o.innerHTML = "<span>"+hash1+"</span><span>"+hash2+"</span>";
			} else {
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

			if (group_v == "K" && (coretype_v.substring(0,1) == "Q" || coretype_v.substring(0,1) == "R")) {
			} else {
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

			// 재다운 표시 위한 시험지 번호 취합 (정효태, 2021.11.29)
			if (p_div_o_index <= 1 || toggle) {
				redown_expapr_no.push(item.expapr_no);
			}
		}

		// 재다운 표시 (정효태, 2021.11.29)
		if (redown_expapr_no.length > 1) {
			ui_updater.setUI();
		}
	}

	/*
		대단원 정보를 그린 후 리스트는 별도 함수로 분리. 부하 줄이기 위해 (정효태)
	*/	
	//var _drawItem_C_v2 = function(cateItem_p, item_p) {
	var _drawItem_C_v2 = function(props) {
		var cateItem_p = props.cateItem;
		var item_p = props.dataItems;
		var group_v = props.group || "";
		var coretype_v = props.coretype || "";
		
    	var parent = root.querySelector("#row_B");
    	//var num_o = parent.querySelector(".bbsNumber b");

		// 대단원에 맞는 서브 리스트를 불러오기 위해 rootpart_code 확인
		var rootpart_code = ((!isNaN(cateItem_p.rootpart_term) && cateItem_p.rootpart_term != "") ? (parseInt(cateItem_p.rootpart_term) * 100) : 100) + parseInt(cateItem_p.rootpart_code);

		/*
    	if (num_o) {
    		//num_o.innerHTML = util.toNumber(totalCount);
			num_o.innerHTML = util.toNumber(0);
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

		var div_o_index = div_o.getAttribute("data-index")
		
		p_o.className = "titleLine";	// 기본
		if (div_o_index == 1 && group_v == "K" && coretype_v == "Q1") {		// 시대별문학용 (PRO이관)
			p_o.className = "titleLine active";
		}
		

    	if (group_v == "K" && (coretype_v.substring(0,1) == "Q" || coretype_v.substring(0,1) == "R")) {
			//시대별문학
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
		btn_o.setAttribute("data-group_v", group_v);
		btn_o.setAttribute("data-coretype_v", coretype_v);

		if (group_v == "K" && (coretype_v.substring(0,1) == "Q" || coretype_v.substring(0,1) == "R")) {
			btn_o.setAttribute("data-name", cateItem_p.RESULT_TEXT);
		}
        p_o.appendChild(btn_o);

		// 대단원을 그리면서 기본 리스트정보는 추가
		if (typeof(item_p) != "undefined") {
			if(group_v != "K" || coretype_v.substring(0,1) != "Q") {
				p_o.className = "titleLine active";		// 서브 리스트 기본 노출 하는 경우는 펼침 표시
			}

			//_drawItem_C_sub_v2(div_o, item_p);			
			_drawItem_C_sub_v2({"obj_div":div_o, "items":item_p, "group": group_v, "coretype": coretype_v, "toggle": false});
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
			var season_Txt = "";

			if($("#season_Val").val() == "1M")
			{
				season_Txt = "1학기 중간고사";
			}
			else if($("#season_Val").val() == "1E")
			{
				season_Txt = "1학기 기말고사";
			}
			else if($("#season_Val").val() == "2M")
			{
				season_Txt = "2학기 중간고사";
			}
			else if($("#season_Val").val() == "2E")
			{
				season_Txt = "2학기 기말고사";
			}

			if((pItem.items[0].subj_code == 'SC' || pItem.items[0].subj_code == 'LS') && pItem.items[0].grade == '2')
			{
				for(var i = 0; i < pItem.items.length; i++)
				{
					if(pItem.items[i].exPapr_group == "B" && pItem.items[i].exPapr_Term + pItem.items[i].exPapr_MidEnd == $("#season_Val").val())
					{
						p_o.innerHTML = "<em class=\"mo-label tbl-list high\" style=\"margin-left:0px;\">" + season_Txt + "</em><br/>";
					}
				}
			}
			else
			{
				for(var i = 0; i < pItem.items.length; i++)
				{
					//if(i == 0 && pItem.items[0].exPapr_Term == "2" && pItem.items[0].exPapr_MidEnd == "E")
					if(i == 0 && pItem.items[0].exPapr_Term + pItem.items[0].exPapr_MidEnd == $("#season_Val").val())
					{
						p_o.innerHTML = "<em class=\"mo-label tbl-list high\" style=\"margin-left:0px;\">" + season_Txt + "</em><br/>";
					}
				}
			}

			p_o.innerHTML += title_v;

			div_o.appendChild(p_o);

			var btn_o = document.createElement("button");
			btn_o.className = "toggle";
			btn_o.innerHTML = "접기/펼치기";
			//btn_o.setAttribute("data-version", "v2");		// list type 확인 (기존 리스트와 구분 위해)
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

    // 개념완성 목록 그리기
	var _drawItem_0 = function(item, index_p) {
		var parent = root.querySelector("#row_B");
        var pItem = item;
        var div_o = document.createElement("div");

        div_o.className = "block_list";
		div_o.setAttribute("data-index", index_p + 1);			// 개념완성 리스트 안보이는 부분
        parent.appendChild(div_o);

        var p_o = document.createElement("p");

        p_o.className = "titleLine active";

        if(pItem.rootpart_code && pItem.rootpart_name) {
        	if(pItem.rootpart_name.indexOf("Special") > -1) {
        		p_o.innerHTML = pItem.rootpart_name;
        	} else {
        		p_o.innerHTML = pItem.rootpart_code + ". " + pItem.rootpart_name;
        	}
        } else if (pItem.sub_title) {
        	p_o.innerHTML = pItem.sub_title;
        }

		if(popTxItems[selectedInfo.txIndex].tabIdx == 2) {
			if(index_p == 0) {
				p_o.innerHTML = "1-1. 평면좌표";
			} else if(index_p == 1) {
				p_o.innerHTML = "1-2. 직선의 방정식";
			} else if(index_p == 2) {
				p_o.innerHTML = "1-3. 원의 방정식";
			} else if(index_p == 3) {
				p_o.innerHTML = "1-4. 도형의 이동";
			} else if(index_p == 4) {
				p_o.innerHTML = "2-1. 집합";
			} else if(index_p == 5) {
				p_o.innerHTML = "2-2. 명제";
			} else if(index_p == 6) {
				p_o.innerHTML = "3-1. 함수";
			} else if(index_p == 7) {
				p_o.innerHTML = "3-2. 유리함수와 무리함수";
			}
		}

        div_o.appendChild(p_o);

        var btn_o = document.createElement("button");
        btn_o.className = "toggle";
        btn_o.innerHTML = "접기/펼치기";
        btn_o.setAttribute("data-src", _id);
        btn_o.setAttribute("data-act", "toggleAll");
        p_o.appendChild(btn_o);
        if(pItem.rootpart_name == "") {
        	p_o.style.display = "none";
        }

        if(pItem.subList == null) pItem.subList = [];

        if(pItem.subList.length == 0) {
	        var sub_o = _createSubItems(pItem, -1);
	        if(sub_o) {
	            div_o.appendChild(sub_o);
        	}
        }
        else {
	        for(var i = 0 ; i < pItem.subList.length; i++) {
		        var sub_o = _createSubItems(pItem.subList[i], i);
		        if(sub_o) {
		            div_o.appendChild(sub_o);
	        	}
	        }
        }
	};

	// 수학교과서변형 / 수학단계별학습관
    var _createSubItems_pro = function(sItem, index_p) {		
    	if(sItem == null ) return null;
    	var title_v = "";
    	var tag_v = "";

		var title_t = sItem.subpart_name;
		title_v = sItem.rootpart_code + "-" + sItem.subpart_code + " " + title_t;

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
						//수학 단계별 학습관 Step2
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

	var _createSubItems_Preparation = function(sItem, index_p) {
    	if(sItem == null ) return null;
    	var title_v = "";
    	var tag_v = "";		
		var sItem_index = sItem.rootpart_code;
    	var div_o = document.createElement("div");

    	div_o.className = "productBlock row";

		if (sItem_index > 101) {
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
				var cnt = 0;

				if(coreType_v == "C")
				{
					if(i % 2 == 0) 
					{	
						var parent = root.querySelector("#row_B");
						var div_o = document.createElement("div");
						//div_o.className = "block_list";
						//div_o.style.border = "1px solid red;"
						//parent.appendChild(div_o);
						title_v = "FINAL 모의고사";

						var p_o = document.createElement("p");
						p_o.className = "titleLine active";
						p_o.setAttribute("data-type", "C");
						p_o.style.fontWeight = "500";
						//p_o.innerHTML = title_v + '<a style=\'border:1px solid red;\' href="#" class="arrowToggle" data-src="main" data-act="toggleGroup"><img src="../../img/ico_arrow_up.png" width="16.5" alt=""></a>';
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
				else if(coreType_v == "V")
				{
					if(item.subj_code == "LS")
					{
						title_v = sItem.items[i].add_title;							
						title_v = title_v.split('] ')[1];						
						title_v = title_v.split('_')[0];

						var p_o = document.createElement("p");
						p_o.className = "listTitle";
						p_o.setAttribute("data-i", i);
						p_o.innerHTML = title_v + '<a href="#" class="arrowToggle" data-src="main" data-act="toggleGroup"><img src="../../img/ico_arrow_up.png" width="16.5" alt=""></a>';
						div_o.appendChild(p_o);
					}
				}
				else
				{	
					if(item.grade == 2 && (item.subj_code == "SC" || item.subj_code == "LS"))
					{

					}
					else
					{
						if(subject_v != "EG")
						{
							if (subject_v == "KR")
							{
								title_v = sItem.items[i].expapr_title;
								title_v = title_v.split('] ')[1];
								title_v = title_v.split('_')[0];

								if (sItem.items[i].exPapr_CoreType == 'B')
								{
									title_v = title_v.substr(4);
								}
							}
							else
							{
								title_v = sItem.items[i].add_title;						
								title_v = title_v.split('] ')[1];

								if(item.grade == 2)
								{	
									title_v = title_v.split(' [')[0];
								}
								else
								{
									title_v = title_v.split(sItem.items[0].Course_Name)[0];
									title_v = title_v.split(' [')[0];
								}
							}

							if((item.grade == 1 || subject_v == "HI") && coreType_v == "B")
							{
								
							}
							else
							{
								var p_o = document.createElement("p");
								p_o.className = "listTitle";
								p_o.setAttribute("data-i", i);							
								p_o.innerHTML = title_v + '<a href="#" class="arrowToggle" data-src="main" data-act="toggleGroup" ><img src="../../img/ico_arrow_up.png" width="16.5" alt=""></a>';
								div_o.appendChild(p_o);
							}
						}
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

				if(item.exPapr_CoreType == "V")
				{
					tag_v = "STEP1. 암기노트";
				}

				if(item.exPapr_CoreType == "A")
				{
					tag_v = "STEP1. 직전요약노트";					
				}
				else if (item.exPapr_CoreType == "B")
				{
					if(item.grade == 2 && (item.subj_code == "KR" || item.subj_code == "EG" || item.subj_code == "MT"))
					{
						tag_v = "STEP1. 시험에 꼭 나오는 문제";
					}
					else
					{
						tag_v = "STEP2. 시험에 꼭 나오는 문제";
					}					
				}
				else if (item.exPapr_CoreType == "C")
				{
					if(item.grade == 2 && (item.subj_code == "KR" || item.subj_code == "EG" || item.subj_code == "MT"))
					{
						tag_v = "STEP2. FINAL 모의고사";
					}
					else
					{
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
				}
				else if(item.exPapr_CoreType == "V" && item.grade == 2 && (item.subj_code == "LS" || item.subj_code == "SC"))
				{
					title_v = sItem.items[i].add_title;
					title_v = title_v.split('] ')[1];
					
					if(item.subj_code == "LS")
					{
						title_v = title_v.split('_')[0];
					}
					else
					{
						title_v = title_v.split(sItem.items[0].Course_Name)[0];
						title_v = title_v.replace(title_v.slice(-1), "");
					}
				}
				else
				{
					if(item.grade == 2 && item.subj_code == "KR")
					{
						title_v = sItem.items[i].add_title;						
						title_v = title_v.split('] ')[1];
						title_v = title_v.split(' [')[0];
					}
					else if(item.grade == 2 && item.subj_code == "LS")
					{
						title_v = sItem.items[i].add_title;						
						title_v = title_v.split('] ')[1];
						title_v = title_v.split(' [')[0];
					}
					else if(item.grade == 2 && item.subj_code == "SC")
					{
						title_v = sItem.items[i].add_title;						
						title_v = title_v.split('] ')[1];
						title_v = title_v.split(' [')[0];
					}
					else if(item.subj_code == "EG")
					{
						title_v = sItem.items[i].add_title;						
						title_v = title_v.split('] ')[1];
						title_v = title_v.split(' [')[0];

						if(item.grade == 2)
						{	
							title_v = title_v.split(' [')[0];
						}
						else
						{
							title_v = title_v.split(sItem.items[0].Course_Name)[0];
						}
					}
				}

				p_o.innerHTML = "<span>" + title_v + "</span>";
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

	// 개념완성 목록 그리기
    var _createSubItems = function(sItem, index_p) {
        if(sItem == null) return null;

        var title_v = "";
        if(index_p < 0) {
        	title_v = sItem.rootpart_code + ". " + sItem.rootpart_name;
        }
        else {
        	title_v = sItem.rootpart_code + "." + sItem.subpart_code + " " + sItem.subpart_name;
        }

        var div_o = document.createElement("div");
        div_o.className = "productBlock row";

        if(index_p >= 0 && selectedInfo.gradeIndex != 2 && sItem.subj_code != "HI") {
			var p_o = document.createElement("p");
			p_o.className = "listTitle";
			p_o.innerHTML = title_v + '<a href="#" class="arrowToggle" data-src="main" data-act="toggleGroup" ><img src="../img/ico_arrow_up.png" width="16.5" alt=""></a>';
			div_o.appendChild(p_o);
        }

        var ul_o = document.createElement("ul");
        ul_o.className = "bbsList fullTitle mB20";
        div_o.appendChild(ul_o);

        if(sItem.items) {
	        for(var i = 0; i < sItem.items.length; i++) {
	            var item = sItem.items[i];
	            var formatInfo = "";

	            var li_o = document.createElement("li");
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
	            formatInfo = "2";

		        _hLog("drawItemSub");

	            var isMathCalc = false;
	            var nItem = util.keysToLowerCase(item);
	            if(nItem.expapr_group == "K" && nItem.subj_code == "MT" && nItem.expapr_coretype.substring(0,1) == "B") {
	            	isMathCalc = true;
	            }



	            if(nItem.vodprob && nItem.vodprob.length > 0) {
	            	if(formatInfo != null) formatInfo = formatInfo + ",";
	            	formatInfo = formatInfo + "94";

	            	var probItem = nItem.vodprob[0];

	            	li_o.setAttribute("data-code", probItem.Code);
	            	li_o.setAttribute("data-type", "Tweezers");
	            	li_o.setAttribute("data-revodstate", probItem.ReVodState);
	            }

	            if(item.expapr_title.indexOf("[Q]") > -1){
	            	formatInfo = _checkDownloadBtn(formatInfo);
	            }

				li_o.setAttribute("data-siteid", nItem.siteid);
				li_o.setAttribute("data-no", nItem.expapr_no);
				li_o.setAttribute("data-group", nItem.expapr_group);
				li_o.setAttribute("data-grade", nItem.grade);
				li_o.setAttribute("data-subjcode", nItem.subj_code);
				li_o.setAttribute("data-coretype", nItem.expapr_coretype);
				li_o.setAttribute("data-tx", nItem.tx_code);
				li_o.setAttribute("data-year", nItem.expapr_testyear);
				li_o.setAttribute("data-formats", formatInfo);
				if (isMathCalc) {
					li_o.setAttribute("data-title", nItem.add_title);
				} else {
					li_o.setAttribute("data-title", nItem.expapr_title);
				}
	            ul_o.appendChild(li_o);

			    if(true)
				{
					title_v = item.expapr_title;
					if(isMathCalc) {
						//tag_v = "공통학기";
						title_v = item.add_title;
						tag_v = "계산력 연습"; //item.add_attr3;
					}
		        	else if(title_v.indexOf("]")) {
		        		tag_v = title_v.substring(0, title_v.indexOf("]") + 1);
		        		title_v = title_v.replace(tag_v, "").trim();
		        		tag_v = tag_v.replace("[", "").replace("]", "");
		        	}

					if(nItem.expapr_coretype == "X") // 과학탐구 실험 -> 실저문제만 파일명 다시 수정
					{
		        		title_v = title_v.substring(0, title_v.indexOf("[") - 1);
					}

					var p_o = document.createElement("p");
					p_o.className = "tag";
					p_o.innerHTML = "<span>" + tag_v + "</span>";
					li_o.appendChild(p_o);
				}

				if(true)
				{
					var split_eng_title = "";
				
					if(item.grade == "1" && item.subj_code == "EG" && item.expapr_group == "H") {
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

				if(true && item.expapr_no)
				{
					var p_o = document.createElement("p");
					p_o.className = "hash";
					var key_v = null;
					key_v = _site_id + item.grade;
					var hash1 = "#" + _categorySub[key_v].title;
					var hash2 = "#" + item.tx_name;
					var hash3 = "#" + item.pub_name;
					p_o.innerHTML = "<span>"+hash1+"</span><span>"+hash2+"</span><span>" + hash3 + "</span>";
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

				var vodConcept = item.vodconcept;
				// 영상이 있는경우 개념완성 영상 그리기
				if(vodConcept && vodConcept.length>0) {

					for(var k=0; k<vodConcept.length; k++) {
						_hLog("item=");
							_hLog(item);
						var vodItem = util.keysToLowerCase(vodConcept[k]);
						var li_o = document.createElement("li");
						li_o.setAttribute("data-no", item.expapr_no);
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

						p_o = document.createElement("p");
						p_o.className = "renewal-video";//리뉴얼 아이콘 class명 변경(EDUMIG-3409)
						if(vodItem.revodstate == "Y"){
							//p_o.innerHTML = "<a href='javascript:;' data-src='vod_player' data-act='video_down'>개념영상<br/>다시보기</a>";
							p_o.innerHTML = _Unit.drawVodButtonDetail("concept", "reconfirm", "개념");

						}
						else{
							//p_o.innerHTML = "<a href='javascript:;' data-src='vod_player' data-act='video_down'>개념영상<br/><span class='num'>" + util.toNumber(_downPrice["VOD"]["concept_h"]) + "</span></a>";
							p_o.innerHTML = _Unit.drawVodButtonDetail("concept", "", "개념");
						}

						li_o.appendChild(p_o);
					}
				}
	        }
        }
        else {
        	return null;
        }
        return div_o;
    };

    // 개념완성,단원별 문제 제외 단원문제 탭 목록 그리기
	var _drawItem_1 = function(item, index_p) {
		var ul_o = root.querySelector("#list_A");
		var li_o = document.createElement("li");
        var formatInfo = "";

		item.HWP2002 = "NONE";

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


        var nItem = util.keysToLowerCase(item);

        if( nItem.expapr_group == "H" && nItem.expapr_coretype == "S" && (nItem.course_name == "국어 문법" || nItem.tx_name == "국어 문법")) {
	    	formatInfo = "2";
	    }

		var cutCoreType_v = nItem.expapr_coretype.substring(0,1);

	    if(nItem.expapr_group == "K" && nItem.expapr_coretype.substring(0,1) == "Q" && nItem.subj_code == "KR") {
	    	// 시대별 문학의 경우 formatInfo = 2;
	    	formatInfo = "2,90";
	    }

		if(nItem.expapr_group == "K" && nItem.expapr_coretype.substring(0,1) == "R" && nItem.subj_code == "KR") {
	    	// 시대별 문학>작품별;
	    	formatInfo = "2";
	    }

	    if(nItem.vodprob && nItem.vodprob.length > 0) {
	    	if(formatInfo != null) formatInfo = formatInfo + ",";
	    	formatInfo = formatInfo + "94";
			var probItem = nItem.vodprob[0];

			li_o.setAttribute("data-code", probItem.Code);
			li_o.setAttribute("data-type", "Tweezers");
		}

        _hLog("drawItem1");
        formatInfo = _checkDownloadBtn(formatInfo);
		li_o.setAttribute("data-siteid", nItem.siteid);
		li_o.setAttribute("data-no", nItem.expapr_no);
		li_o.setAttribute("data-group", nItem.expapr_group);
		li_o.setAttribute("data-grade", nItem.grade);
		li_o.setAttribute("data-subjcode", nItem.subj_code);
		li_o.setAttribute("data-coretype", nItem.expapr_coretype);
		li_o.setAttribute("data-tx", nItem.tx_code);
		li_o.setAttribute("data-year", nItem.expapr_testyear);
		li_o.setAttribute("data-formats", formatInfo);
		li_o.setAttribute("data-title", nItem.expapr_title);
        ul_o.appendChild(li_o);

		{
			var p_o = document.createElement("p");
			p_o.className = "tag";
			if(nItem.subj_code == "KR" && nItem.expapr_group == "K") {
				// 시대별 문학의 경우
				if(cutCoreType_v == "Q"){
					p_o.innerHTML = "<span>시대별문학</span>";
				} else if(cutCoreType_v == "R"){
					p_o.innerHTML = "<span>작품별</span>"
				}
			} else {
				p_o.innerHTML = "<span>" + _getTermName(item.expapr_term, item.expapr_midend) + "</span>";
			}
			if(common.isPremium(item.expapr_title)) {
				p_o.innerHTML = p_o.innerHTML + "<span>프리미엄</span>";
			}
			li_o.appendChild(p_o);
		}
		{
			var p_o = document.createElement("p");
			p_o.className = "title";
			var title_v = item.expapr_title;
			p_o.innerHTML = "<span>" + title_v + "</span>";
			li_o.appendChild(p_o);
		}
		{
			var p_o = document.createElement("p");
			p_o.className = "hash";
			var key_v = null;
			key_v = _site_id + item.grade;
			var hash1 = "#" + _categorySub[key_v].title;

			var subject_v = item.subj_name;
			if(selectedInfo.gradeIndex == 1) {
				subject_v = item.tx_name;
			}

			var hash2 = "#" + subject_v;
			var hash3 = "#" + item.pub_name;
			p_o.innerHTML = "<span>"+hash1+"</span><span>"+hash2+"</span><span>" + hash3 + "</span>";
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

	// 학교별 족보 탭 목록 그리기
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
        if(item.ZIP && item.ZIP != "NONE" ) {
        	if(formatInfo != "") formatInfo = formatInfo + ",";
        	formatInfo = formatInfo + "5";
        }

        var group_v = pop2TypeItems[selectedInfo.type2Index].value;
        if(item.exPapr_group == "V" || item.exPapr_group == "W")	{	// 예상족보.
	        if(item.PDF && item.PDF != "NONE") {
	        	formatInfo = "2";
	        }
        }

        if(item.exPapr_group == "A") {
        	if(formatInfo == "3"){
	        	// 정답요청
	        	formatInfo = formatInfo + ",96";
	        }
        }
        else if(item.exPapr_group == "C") {
        	// formatInfo = formatInfo + ",99";
        }
        else if(item.exPapr_group == "I") {
        	// 지역별 문제
        	formatInfo = "2";
        }

        if(selectedInfo.menuIndex == 1 && group_v != "V"){
        	if(item.expapr_title.indexOf("[Q]") > -1){
				if(formatInfo != "") formatInfo = formatInfo + ",";
					formatInfo = formatInfo + "97";
			}
        }

	    var nItem = util.keysToLowerCase(item);
	    var li_o = document.createElement("li");
	    // 다운로드 하기 위한 값 설정
		li_o.setAttribute("data-siteid", nItem.siteid);
		li_o.setAttribute("data-no", nItem.expapr_no);
		li_o.setAttribute("data-group", nItem.expapr_group);
		li_o.setAttribute("data-grade", nItem.grade);
		li_o.setAttribute("data-subjcode", nItem.subj_code);
		li_o.setAttribute("data-coretype", nItem.expapr_coretype);
		li_o.setAttribute("data-tx", nItem.tx_code);
		li_o.setAttribute("data-year", nItem.expapr_testyear);
		li_o.setAttribute("data-formats", formatInfo);
	    li_o.setAttribute("data-sclid", nItem.scl_id);
		if (nItem.expapr_group == "I") {
			li_o.setAttribute("data-title", nItem.add_title);
		} else {
			li_o.setAttribute("data-title", nItem.expapr_title);
		}
		if (group_v == "A") { //학교별 기출족보
		    li_o.setAttribute("data-sclid", nItem.scl_id);
		    li_o.setAttribute("data-midandterm", nItem.expapr_term + nItem.expapr_midend);
		    li_o.setAttribute("data-txname", nItem.tx_name);
		    li_o.setAttribute("data-TXCODE", nItem.tx_code);
		}
		ul_o.appendChild(li_o);

		{
			var p_o = document.createElement("p");
			p_o.className = "tag";
			if (nItem.expapr_group == "I") {
				p_o.innerHTML = "<span>" + nItem.add_attr1 + "</span>";
				p_o.innerHTML = p_o.innerHTML + "<span>" + nItem.add_attr2 + "</span>";
			} else {
				p_o.innerHTML = "<span>" + _getTermName(item.expapr_term, item.expapr_midend) + "</span>";
			}
			if(common.isPremium(item.expapr_title)) {
				p_o.innerHTML = p_o.innerHTML + "<span>프리미엄</span>";
			}
			li_o.appendChild(p_o);
		}
		{
			var p_o = document.createElement("p");
			p_o.className = "title";
			var title_v = item.expapr_title;
			if (nItem.expapr_group == "I") {
				title_v = nItem.add_title;
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
			p_o.innerHTML = "<span>" + hash1 + "</span><span>" + hash2 + "</span>";
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

		li_o.setAttribute("data-siteid", "H");
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

	// 고득점마스터 목록 그리기
	var _drawItem_3 = function(item_p, index_p) {

		var row_A = root.querySelector("#row_A");
		var row_C = root.querySelector("#row_C");
		var parent_o = null;
		var ul_o = null;

	    var mItem = util.keysToLowerCase(item_p);

	    var title_v = mItem.open_title;

	    if(selectedInfo.sub3Index ==1) {
	    	var part_v = mItem.part;
	    	if(part_v == "최다오답") {
	    		part_v = "만점도전";
	    	}
	    	title_v = "Step" + mItem.step + ". " + part_v;
	    }

	    if(title_v == "" || title_v == null) {
	    	title_v = mIte.expapr_title;
	    }

	    var popObj = {};
	    if(mItem.subj_code == "KR") {
	    	popObj["title"] = title_v.substring(title_v.lastIndexOf(".")+1, title_v.length).trim();
	    	popObj["pos"] = index_p;
	    	popSub3Items.push(popObj);
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
	    	p_o.innerHTML = title_v + '<a href="#" data-src="main" data-act="toggleGroup" class="arrowToggle"><img src="../img/ico_arrow_up.png" width="16.5" alt=""></a>';
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

	// 고득점마스터 목록 그리기
	var _drawItem_3_0 = function(item_p, ul_p){
		if(item_p == null || ul_p == null) return;

		var sItem = item_p;
		var li_o = document.createElement("li");
		sItem = util.keysToLowerCase(sItem);

		ul_o = ul_p;

		// PDF 			Group/CoreType
		// 개념완성 1250	H/S
		// 본문학습 1250 	H/V
		// 기초문제 1050	C/''
		// 대표유형 1050 	H/C
		// 요점정리 1250 	H/S
		// 암기노트 1250	H/V

		var formatInfo = "";

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

		if( selectedInfo.sub3Index == 1 && sItem.expapr_group == "H" && sItem.expapr_coretype == "F") {
			// 실전적용 Step5
			formatInfo = "2";
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

		if(sItem.expapr_no != "" && selectedInfo.sub3Index == 0) {
			var p_o = document.createElement("p");
			p_o.className = "tag";
			p_o.innerHTML = "<span>" + sItem.part + "</span>";
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
			if(sItem.subj_code != "EG" && sItem.subj_code != "KR") {
				hash3 = "기타";
			}
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



		if (sItem.expapr_no && sItem.expapr_no != null) {
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
				if(sItem.subj_code != "EG" && sItem.subj_code != "KR") {
					hash3 = "기타";
				}
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
			}
		}

		var vodConcept = sItem.vodconcept;

		// 고득점마스터 동영상 목록 그리기
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
				if(sItem.subj_code != "EG" && sItem.subj_code != "KR") {
					hash3 = "기타";
				}


				if(hash2) p_o.innerHTML += "<span>#" + hash2 +"</span>";
				if(hash3) p_o.innerHTML += "<span>#" + hash3 +"</span>";

				li_o.appendChild(p_o);

				p_o = document.createElement("p");
				p_o.className = "video";
				if(vodItem.revodstate == "Y"){
					p_o.innerHTML = "<a href='javascript:;' data-src='vod_player' data-act='video_down'>개념영상<br/>다시보기</a>";
				}
				else{
					p_o.innerHTML = "<a href='javascript:;' data-src='vod_player' data-act='video_down'>개념영상<br/><span class='num'>" + util.toNumber(_downPrice["VOD"]["concept_h"]) + "</span></a>";
				}
				li_o.appendChild(p_o);
			}
		}
	};

	// 리스트 비어있을때 목록 그리기
	var _drawNoList = function(chk) {
		comm.toggleLoading(false);

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

		if(selectedInfo.menuIndex == "1") {
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

				$("#expect_scl_name").text(sch2Items[selectedInfo.sch2Index].Name);
				$("li[id^='info_expect_']")
				$("#info_expect_"+kind_v.toLowerCase()).show();

				$(".nologin-view").show();
				textinfo_Show(kind_v);
			} else {
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
		}

		if(selectedInfo.menuIndex == 0 && selectedInfo.groupIndex == 1 && popGradeItems[selectedInfo.gradeIndex].Value == "2" && (popTxItems[selectedInfo.txIndex].Value == "B6" || popTxItems[selectedInfo.txIndex].Value == "B7")) {
			alert("과목별 출제 전문가가 제작 중입니다.");
			return;
		} else if(selectedInfo.menuIndex == 3 && popGradeItems[selectedInfo.gradeIndex].Value == "2") {
			alert("과목별 출제 전문가가 제작 중입니다.");
			return;
		}

		if(selectedInfo.menuIndex != 1) {
			if(popGradeItems[selectedInfo.gradeIndex].Value == "2" && isOldData == false && revision22_contents_yn == "Y") {
				term2_ServiceYN = _Hierarchy[selectedInfo.gradeIndex].Subj_Code[selectedInfo.subjectIndex].TX_CODE[selectedInfo.txIndex].term2_ServiceYN;

				if(term2_ServiceYN == "N") {
					alert("과목별 출제 전문가가 제작 중입니다.");
				}
			} else if(popSubjectItems[selectedInfo.subjectIndex].Value == "EG" && selectedInfo.menuIndex == "4" && selectedInfo.gradeIndex == "1" && selectedInfo.subjectIndex == "4" && selectedInfo.groupIndex == "4") {
				alert("과목별 출제 전문가가 제작 중입니다.");
			}
		}

		_initEvent();
	};

	// 오답노트 버튼 그리기 위한 함수
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
			_coreType = popGroupItems[selectedInfo.groupIndex].CoreType;
		} else if(selectedInfo.menuIndex == 1 && pop2TypeItems[selectedInfo.type2Index].value == "H" && (pop2TypeItems[selectedInfo.type2Index].CoreType == "D" || pop2TypeItems[selectedInfo.type2Index].CoreType == "E")) {
			isUse = true;
			_subj_code = popSubjectItems[selectedInfo.subject2Index].Value;
			_group = pop2TypeItems[selectedInfo.type2Index].value;
			_coreType = pop2TypeItems[selectedInfo.type2Index].CoreType;
		}

		// 오답노트
	   	//if(selectedInfo.menuIndex == 0) {
		if(isUse == true) {
	   		if(_group == "K"){
	   			// 국어
	   			if(_subj_code != "KR"){
	   				isShow = true;
	   			}
	   		}
	   		// !서술형 문제
	   		else if(_group != "M"){

   				if(_group == "H" || _group == "C"){

   					if(_coreType == "C"){
   						// !수학
   						if(_subj_code != "MT"){
   							isShow = true;
   						}
   					}
   					else if(_coreType != ""){
   						isShow = true;
   					}
   				}
   				else{
   					isShow = true;
   				}
	   		}
		}

		if(isShow == true){
			if(formatInfo != "") formatInfo = formatInfo + ",";
				formatInfo = formatInfo + "97";
		}

		return formatInfo
	};

	// 고등 시대별 문학의 선택값에 따라 디스플레이를 해주는 방식을 통신하지않고 디스플레이 설정만 바꾸는함수
	var _displayList = function(str){

		if(str == null) return;

		var list_A = activeRow.querySelector("#list_A");

		var li_A = list_A.querySelectorAll("li[data-no]");

		var recordCount = activeRow.querySelector("#recordCount");

		if(str.indexOf("전체") >= 0) {
			$(li_A).css("display", "");
			recordCount.innerHTML = li_A.length;
		} else {
			$(li_A).css("display", "none");
			var target_o = list_A.querySelectorAll("[data-title*='"+str+"']");
			$(target_o).css("display", "");
			recordCount.innerHTML = target_o.length;
		}
	};

	// 단원별 선택시 학년설절의 과목 정보 적용
	var _useGradeSetInfo = function() {
		var group_v = popGroupItems[selectedInfo.groupIndex].Value;
		var coretype_v = popGroupItems[selectedInfo.groupIndex].CoreType;
		if(coretype_v == null){
			coretype_v = "";
		}

		if(gradeJson) {			
			var subjectCode_v = selectedInfo.subjectCode;
			var subjectName_v = selectedInfo.subjectName;
			
			Hierarchy_Init(_site_id, group_v, "");
			if(_Hierarchy && _Hierarchy.length > 0 && coretype_v.substring(0,1) != "Q") {
				popTxItems = _Hierarchy[selectedInfo.gradeIndex].Subj_Code[selectedInfo.subjectIndex].TX_CODE;
				if("H" + (parseInt(selectedInfo.gradeIndex) + 1) == gradeJson["grade"] ) {
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
		var evo = util.findEventObject(ev, null);
		var act_v = evo.getAttribute("data-act");
		var popup_Chk = null;

		if(selectedInfo.menuIndex == 1 && parseInt(parseInt(pop2TypeItems[selectedInfo.type2Index].Index)) == 0)
		{
			page_Act_Chk = false;
		}
		else
		{
			if (act_v == "filter_grade" || act_v == "filter_subject" || act_v == "filter_group" || act_v == "filter2_type" || act_v == "filter2_grade" || act_v == "filter2_subject" || act_v == "filter3_grade" || act_v == "filter3_subject" || act_v == "filter_tx" || act_v == "filter_level" || act_v == "filter_chapter" || act_v == "filter_term" || act_v == "oldData") {
				page_Act_Chk = true;
				mainCLS.init = true;
			} else {
				page_Act_Chk = false;
			}
		}

		oldData_flag = false;

		_hLog(_id + " act=" + act_v);
		if(act_v == "back") {
		}
		else if (act_v == "title") {
			document.location.href = "/H/?menu=1";
		}
		else if(act_v == "filter_grade") {
			let popGradeItems_temp = popGradeItems;

			if (selectedInfo.menuIndex == 3 && param.oldData == "Y") {
				popGradeItems_temp = popGradeItems.filter((e)=> {
					return e.Value == 1
				});
			}

			common.showFlexSelect("학년", popGradeItems, selectedInfo.gradeIndex, false, function(data) {
				_hLog("selected data=" + JSON.stringify(data));

//				if (selectedInfo.menuIndex == 3 && selectedInfo.gradeIndex !== data.pos) {//Ai수준별 학습 > 수학 Master에서 다른 학년으로 선택 시
//					let getGrade = (parseInt(data.pos) + 1).toString();
//					let getSubjectCode = selectedInfo.subjectCode.replace(/[0-9]/g, "");
//					location.href = '/H/exam_unit_ai.asp?grade=' + getGrade + '&subject_cd=' + getSubjectCode;					
//					return;
//				}

				selectedInfo.gradeIndex = data.pos;
				/*
				// 초기값 세팅 주석처리 / 2024-04-23
				if(selectedInfo.gradeIndex == 2) {
					selectedInfo.groupIndex = 0;
				} else {
					selectedInfo.groupIndex = 1;
				}
				*/

				if(selectedInfo.gradeIndex == 0) {
					selectedInfo.subjectIndex = 2;
					selectedInfo.subjectCode = "MT";
					selectedInfo.subjectName = "공통수학";
				} else {
					if(selectedInfo.menuIndex == 5)
					{
						if(selectedInfo.gradeIndex == 1 && selectedInfo.subjectIndex == 5) {
							selectedInfo.subjectIndex = 2;
							selectedInfo.subjectCode = "MT";
							selectedInfo.subjectName = "수학 영역";
						} 
					}
					else
					{
						selectedInfo.subjectCode = "MT";
						selectedInfo.subjectName = "수학 영역";
						if(selectedInfo.gradeIndex == 1) {
							//selectedInfo.subjectIndex = 7;
							selectedInfo.subjectIndex = 5;
						} else {
							selectedInfo.subjectIndex = 1;
						}
					}
				}
				selectedInfo.levelIndex = 0;
				p_add_diff = ""
				selectedInfo.txIndex = 0;
				selectedInfo.yearIndex = 0;
				selectedInfo.termIndex = 0;
				evo.innerHTML = data.title;
				popYearItems = [{"Name":"", "Value":""}];
				isTimeLiterary = false;
				isOldData = false;
				_setHierarchy();
				_useGradeSetInfo();
				_setSelectedValue();
			});
		}
		else if(act_v == "filter_subject") {
			common.showFlexSelect("과목", popSubjectItems, selectedInfo.subjectIndex, false, function(data) {
				_hLog("selected data=" + JSON.stringify(data));
				if (selectedInfo.menuIndex == 3 && selectedInfo.subjectIndex !== data.pos) {//Ai수준별 학습 > 수학 Master에서 다른 과목으로 선택 시
					if (selectedInfo.groupIndex == 1 || data.Value != "MT") {
						let getGrade = popGradeItems[selectedInfo.gradeIndex].Value;
						let getSubjectCode = data.Value.replace(/[0-9]/g, "");
						location.href = '/H/exam_unit_ai.asp?grade=' + getGrade + '&subject_cd=' + getSubjectCode;		
						return;
					}
				}

				selectedInfo.subjectIndex = data.pos;
				selectedInfo.subjectCode = popSubjectItems[data.pos].Value;
				selectedInfo.subjectName = popSubjectItems[data.pos].Name;
				selectedInfo.txIndex = 0;
				selectedInfo.yearIndex = 0;
				selectedInfo.termIndex = 0;
				selectedInfo.levelIndex = 0;
				p_add_diff = ""

				// 과목마다 대메뉴 개수가 다르다 보니 index 오류가 발생하는 경우가 있음, 그럴 경우 0으로 변경 (정효태)
				if (selectedInfo.groupIndex >= popSubjectItems[selectedInfo.subjectIndex].unitItems.length) {
					selectedInfo.groupIndex = 0;
				}
				/*
				if(selectedInfo.gradeIndex == 2) {
					selectedInfo.groupIndex = 0;
				} else {
					selectedInfo.groupIndex = 1;
				}
				*/

				if(revision22_contents_yn == "Y" && isOldData == true) {
					oldData_flag = true;
				} else {
					isOldData = false;
				}

				popYearItems = [{"Name":"", "Value":""}];
				//isOldData = false;
				isTimeLiterary = false;
				_setHierarchy();
				_useGradeSetInfo();
				_setSelectedValue();
			});
		}
		else if(act_v == "filter_group") {
			common.showFlexSelect("구분", popGroupItems, selectedInfo.groupIndex, false, function(data) {
				_hLog("selected data=" + JSON.stringify(data));
				
				if (selectedInfo.menuIndex == 3 && data.pos == "0") {//Ai수준별 학습 > 수준별 Ai 학습
					let getGrade = (parseInt(selectedInfo.gradeIndex) + 1).toString();
					let getSubjectCode = selectedInfo.subjectCode.replace(/[0-9]/g, "");
					location.href = '/H/exam_unit_ai.asp?grade=' + getGrade + '&subject_cd=' + getSubjectCode;	
					return;
				}

				if (selectedInfo.menuIndex == 3 && data.pos == "1") {
					param.oldData = "";
				}

				if(selectedInfo.menuIndex == 4 && data.pos == "3") {//실전대비 > 최상위공략
					location.href = "/H/exam_top_table.asp";
					return;
				}
				
				history.replaceState(null, "","/H/?menu=" + (parseInt(selectedInfo.menuIndex) + 1).toString());

				selectedInfo.groupIndex = data.pos;
				selectedInfo.txIndex = 0;
				selectedInfo.yearIndex = 0;
				selectedInfo.termIndex = 0;
				popYearItems = [{"Name":"", "Value":""}];

				var group_v = popGroupItems[selectedInfo.groupIndex].Value;
				var coreType_v = popGroupItems[selectedInfo.groupIndex].CoreType;

				if(coreType_v == null) coreType_v = "";
				coreType_v = coreType_v.substring(0,1);

				if(data.Value == "K" && coreType_v == "C") {
					//selectedInfo.termIndex = 1;
					//common.toast("영문법은 PRO이용권 / 과목별 이용권 / <br/>선생님이용권 / 포인트로 이용 가능합니다.", null);
					if(grade_v == "1") {
						selectedInfo.yearIndex = 0;
					} else if (grade_v == "2") {
						selectedInfo.yearIndex = 1;
					} else if (grade_v == "3") {
						selectedInfo.yearIndex = 2;
					}
				} else {
					selectedInfo.termIndex = 0;
				}

				if(group_v == "K" && coreType_v == "Q" && popSubjectItems[selectedInfo.subjectIndex].Value == "KR") {
					// 시대별 문학인 경우
					selectedInfo.txIndex = 4;
				}

				if((data.Value == "K" && coreType_v == "C") || (data.Value == "P" && coreType_v == "E")){
					selectedInfo.termIndex = 1;
				}

				selectedInfo.levelIndex = 0;
				selectedInfo.levelData = [];
				p_add_diff = "";

				oldData_flag = true;
				isOldData = false;

				isTimeLiterary = false;
				_setHierarchy();
				_useGradeSetInfo();
				_setSelectedValue();
			});
		}
		else if(act_v == "filter_tx") {
			var group_v = popGroupItems[selectedInfo.groupIndex].Value;
			var subject_v = popSubjectItems[selectedInfo.subjectIndex].Value;
			var title_v = "교과서";
			if(group_v == "K") {
				title_v = "상세 콘텐츠";
			}
			else if(group_v == "H") {
				if(selectedInfo.gradeIndex == 1) {
					if(subject_v == "MT") {
						title_v = "과목";
					}
				}
			}
			else if(group_v == "K") {	// 시대별
				title_v = "구분";
			}

			isTimeLiterary = false;			
			
			common.showFlexSelect(title_v, popTxItems, selectedInfo.txIndex, false, function(data) {
				var donga_show_member_yn = $("#donga_show_member_yn").val();
				
				//동아출판사 검색 트래킹 코드 추가요청_EDUMIG-6272
				if ((data.Name).substr(0, 2) == "동아") {
					trkCLS.setExternalEvent("WCIGNVYX26FQ57YA72R2IFAAJ20250306", "");
				}

				/*if(data.Name.includes("동아") && donga_show_member_yn != "Y") {
					$("#donga-stop-popup").show();
					return;
				} else */
//				if(data.Name.includes("창비") && data.Value != "HAKRCHA1005") {
//					$("#changbi-stop-popup").show();
//					return;
//				} else {
					selectedInfo.txIndex = data.pos;
					selectedInfo.yearIndex = 0;
					selectedInfo.termIndex = 0;
					selectedInfo.levelIndex = 0;
					p_add_diff = ""
					popYearItems = [{"Name":"", "Value":""}];

					_setSelectedValue();
//				}
			});
		}
		else if(act_v == "filter_year") {
			var group_v = popGroupItems[selectedInfo.groupIndex].Value;
			var subject_v = popSubjectItems[selectedInfo.subjectIndex].Value;
			var coreType_v = popGroupItems[selectedInfo.groupIndex].CoreType;
			var title_v = "년도";
			if(group_v == "K") {	// 시대별
				title_v = "구분";
			}
			if (group_v == "T") {	// 수행평가
				title_v = "교과서";
			}
			if ((group_v == "K" && coreType_v == "C") || (group_v == "P" && coreType_v == "E1")) {	// 영문법, 구문독해
				title_v = "구분";
			}
			isTimeLiterary = false;
			common.showFlexSelect(title_v, popYearItems, selectedInfo.yearIndex, false, function(data) {
				var donga_show_member_yn = $("#donga_show_member_yn").val();

				//동아출판사 검색 트래킹 코드 추가요청_EDUMIG-6272
				if ((data.Name).substr(0, 2) == "동아") {
					trkCLS.setExternalEvent("WCIGNVYX26FQ57YA72R2IFAAJ20250306", "");
				}

				/*if(data.Name.includes("동아") && donga_show_member_yn != "Y") {
					$("#donga-stop-popup").show();
					return;
				} else */
//				if(data.Name.includes("창비") && data.Value != "HAKRCHA1005") {
//					$("#changbi-stop-popup").show();
//					return;
//				} else {
					selectedInfo.yearIndex = data.pos;
					selectedInfo.termIndex = 0;
					selectedInfo.levelIndex = 0;
					p_add_diff = ""

					// PRO전용관 이관 관련 예외처리 (이관)				
					if(group_v == "P" && coreType_v == "C1") {
						selectedInfo.txIndex = 0;
					}
					_setSelectedValue();
//				}
			});
		}
		else if(act_v == "filter_term") {
			var group_v = popGroupItems[selectedInfo.groupIndex].Value;
			var subject_v = popSubjectItems[selectedInfo.subjectIndex].Value;
			var title_v = "학기";
			var year_v = popYearItems[selectedInfo.yearIndex].Value;
			var coreType_v = popGroupItems[selectedInfo.groupIndex].CoreType;

			if(group_v == "K") {	// 시대별
				title_v = "작품/작가";
			//	isTimeLiterary = true;
			//} else {
			//	isTimeLiterary = false;
			}

			if((group_v == "K" && coreType_v == "C") || (group_v == "P" && coreType_v.substring(0,1) == "E")) {
				// 영문법 구문독해
				title_v = "자료종류";
				popSubItems = grammerKindItems;
			}

			if(coreType_v == "G") {
				title_v = "자료종류";
				popSubItems = grammerKindItems;
			} else if(group_v == "P" && coreType_v == "C1") {
				// 수학교과서 변형 출판사 정보
				title_v = "출판사";

				if(grade_v == "1") {
					popSubItems = H_MT_Math_1_C[(Number(selectedInfo.yearIndex))].bookinfo;
				} else {
					if(isOldData == true) {
						popSubItems = H_MT_Math_2_C_OLD[(Number(selectedInfo.yearIndex))].bookinfo;
					} else {
						popSubItems = H_MT_Math_2_C[(Number(selectedInfo.yearIndex))].bookinfo;
					}
				}
			}

			common.showFlexSelect(title_v, popSubItems, selectedInfo.termIndex, false, function(data) {				
				selectedInfo.termIndex = data.pos;
				selectedInfo.levelIndex = 0;
				p_add_diff = ""

				if(group_v == "P" && coreType_v == "C1") {
					selectedInfo.txIndex = data.pos;
					evo.innerHTML = data.Name;
					
					_setSelectedValue();
				} else {
					if(data.pos == "0") {
						_setSelectedValue();
					} else {
						var input_o = document.querySelector("#filter_1 [name='qry']");
						var qry = input_o.value;

						if(qry && group_v == "K" && subject_v == "KR" && (year_v == "A" || year_v == "W")) {
							_setSelectedValue();
						} else {
							var txName_v = popTxItems[selectedInfo.txIndex].Name;
							//if(txName_v ==  "고대" || txName_v == "고려시대" || txName_v == "삼국시대") {
							//	evo.innerHTML = data.Name;
								// display on/off 설정
							//	_displayList(data.Name);
							//} else {
								_setSelectedValue();
							//}
						}
					}
				}
			});
		}
		else if(act_v == "filter") {
			filter.showFilter(_id, "score", searchParam, function(data) {
				_hLog("search param=" + JSON.stringify(data));
				searchParam = data;
				_updateSeachInfo();
				Page = 1;
				_loadList();
			});
		}
		else if (act_v == "filter_chapter") {
			var group_v = popGroupItems[selectedInfo.groupIndex].Value;
			var coreType_v = popGroupItems[selectedInfo.groupIndex].CoreType;
			// 대단원 선택시 선택한 대단원에 맞는 상품목록만 디스플레이
			var title_v = "대단원";
			if (group_v == "K" && coreType_v == "B1") {
				title_v = "중단원";
			}
			if(selectedInfo.chapterData == null) selectedInfo.chapterData = [];
						
			var input_o = root.querySelector("#filter_1 [name='qry']");
			if(input_o) input_o.value = "";

			if(group_v == "K" && coreType_v == "B1" && popTxItems[selectedInfo.txIndex].tabIdx == 2) {
				popChapterItems[1].Name = "1-1. 평면좌표";
				popChapterItems[2].Name = "1-2. 직선의 방정식";
				popChapterItems[3].Name = "1-3. 원의 방정식";
				popChapterItems[4].Name = "1-4. 도형의 이동";

				popChapterItems[5].Name = "2-1. 집합";
				popChapterItems[6].Name = "2-2. 명제";

				popChapterItems[7].Name = "3-1. 함수";
				popChapterItems[8].Name = "3-2. 유리함수와 무리함수";
			}

			common.showFlexMultiSelect(title_v, popChapterItems, selectedInfo.chapterData, function(data) {
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
				var chapter_v = popChapterItems[0].Name;
				if(chapter_v == null) {
					chapter_v = popChapterItems[0].title;
				}
				if(chapter_v.indexOf("전체") >= 0) {
					isAll = true;
				}

				var displayCnt = 0;
				var group_n = popGroupItems[selectedInfo.groupIndex].Name;
				var group_v = popGroupItems[selectedInfo.groupIndex].Value;

				if (coreType_v == null) coreType_v = "";

				var cutCoreType_v = coreType_v.substring(0,1);

				for(var i = 0 ; i < data.length ; i++) {
					// 대단원 메뉴 선택 시 리스트 호출 (단원별 문제:C, 개념완성:H)
					if ( (group_v == "C" || group_v == "M" || ( group_v == "H" && (cutCoreType_v == "D" || cutCoreType_v == "E" || cutCoreType_v == "T"))) && typeof(data[i].parent_index) != "undefined" && typeof(data[i].rootpart_code) != "undefined" ) {						
						_drawToggleItem({"parent_index": data[i].parent_index,
											"rootpart_code": data[i].rootpart_code,
											"etc_action": "bbsNumber"
										});
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

					var targetLength = 0;

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

				activeRow.querySelector(".listTop .row .bbsNumber b").innerHTML = util.toNumber(displayCnt);

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
							// 넘기는 방식 수정
							_drawToggleItem({"parent_index": _chapterDatas[i].parent_index,
											"rootpart_code": _chapterDatas[i].rootpart_code,
											"etc_action": "bbsNumber"
										});
							//_drawToggleItem(_chapterDatas[i].parent_index, _chapterDatas[i].rootpart_code, "bbsNumber");
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
			Page = 1;
			PageSize = 20;
			isTimeLiterary = false;
			comm.toggleLoading(true);
			_loadData();
		}
		else if(act_v == "item_down") {
			// 다운로드 버튼 클릭시 다운로드 버튼 그리기 위함
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

					_hLog("3198 eroot =" + eroot);

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
					pItem.formats = formats_v;
					pItem.title = title_v;
					pItem.code = code_v;
					pItem.type = type_v;
					pItem.partnum = partnum_v;
					pItem.name = name_v
					pItem.revodstate = revodstate_v;
					pItem.midandterm = midandterm_v;	// 정효태

					if (group_v == "A" && coretype_v == "B") {	// 학교별 기출유사 예외처리
						pItem.sclid = sclid_v;

						// 임시로 2021년 1학기 중간만 노출
						//if(midandterm_v == "1M" && year_v == "2021") {
						pItem.formats = pItem.formats + ",88";	//88 : 기출분석
						//}
					}
					pItem.pObject = eroot;

					if(group_v == "K" && subject_v == "MT" && coretype_v == "F")
					{
						pItem.formats = 2;
					}

					if (group_v == "A") { //학교별 기출 족보
						pItem.sclid = sclid_v;
						pItem.midandterm = midandterm_v;
						pItem.txname = txname_v;
						pItem.txcode = txcode_v;
						pItem.EducationCheck = EducationCheck;	//가족학원 유무 추가
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
				selectedInfo.gradeK3Index = 0;
				before_index = selectedInfo.type2Index;
				//selectedInfo.type2Index = data.pos;
				//selectedInfo.type2Index = before_index;

				if(data.pos == 3) {					
					selectedInfo.type2Index = data.pos;
					_fileter2_type_change();
				} else {
					selectedInfo.type2Index = before_index;
				}	

				if(data.pos == 0){
					location.href = '/H/ai_transform.asp';
				} else if(data.pos == 1){
					location.href = '/H/expected.asp';
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
				_hLog("selected data=" + JSON.stringify(data));
				selectedInfo.si2Index = data.pos;		// 시정보
				selectedInfo.gu2Index = 0;		// 구(군)정보
				selectedInfo.sch2Index = 0;		// 학교

				if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) != 7) {	// 기출유사는 기타 정보 초기화 안함
					if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 0) {
						selectedInfo.subject2Index = 3;
					} else {
						selectedInfo.subject2Index = 2;
					}

					selectedInfo.grade2Index = 0;
					selectedInfo.year2Index = 0;
					selectedInfo.term2Index = 0;
					selectedInfo.fileType2Index = 0;
					selectedInfo.subject2DetailIndex = 0;
				}

				document.getElementById("part_ID").value = "";
				_setSelectedValue();
			});
		}
		else if(act_v == "filter2_gu") {
			common.showFlexSelect("구 선택", gu2Items, selectedInfo.gu2Index, false, function(data) {
				_hLog("selected data=" + JSON.stringify(data));
				selectedInfo.gu2Index = data.pos;
				selectedInfo.sch2Index = 0;		// 학교정보 초기화

				if(parseInt(parseInt(pop2TypeItems[selectedInfo.type2Index].Index)) != 0
						&& parseInt(parseInt(pop2TypeItems[selectedInfo.type2Index].Index)) != 7) {
					selectedInfo.grade2Index = 0;
					selectedInfo.subject2Index = 2;
					selectedInfo.year2Index = 0;
					selectedInfo.term2Index = 0;
					selectedInfo.fileType2Index = 0;
					selectedInfo.subject2DetailIndex = 0;
				}

				document.getElementById("part_ID").value = "";
				_setSelectedValue();
			});
		}
		else if(act_v == "filter2_sch") {
			common.showFlexSelect("학교 선택", sch2Items, selectedInfo.sch2Index, false, function(data) {
				_hLog("selected data=" + JSON.stringify(data));
				selectedInfo.sch2Index = data.pos;
				
				if(parseInt(parseInt(pop2TypeItems[selectedInfo.type2Index].Index)) != 0
						&& parseInt(parseInt(pop2TypeItems[selectedInfo.type2Index].Index)) != 7) {				
					selectedInfo.grade2Index = 0;
					selectedInfo.subject2Index = 2;
					selectedInfo.year2Index = 0;
					selectedInfo.term2Index = 0;
					selectedInfo.fileType2Index = 0;
					selectedInfo.subject2DetailIndex = 0;
				}

				document.getElementById("part_ID").value = "";
				_setSelectedValue();
			});
		}
		else if(act_v == "filter2_grade") {
			var gradeIdx = selectedInfo.grade2Index;
			if(parseInt(parseInt(pop2TypeItems[selectedInfo.type2Index].Index)) == 4) {
				gradeIdx = selectedInfo.gradeK3Index;
			}

			common.showFlexSelect("학년", popGrade2Items, gradeIdx, false, function(data) {
				_hLog("selected data=" + JSON.stringify(data));
				selectedInfo.grade2Index = data.pos;
				selectedInfo.gradeK3Index = data.pos;

				if (parseInt(parseInt(pop2TypeItems[selectedInfo.type2Index].Index)) == 0)
				{
					selectedInfo.year2Index = 0;
					//_setHierarchy();
				}
				else if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 7) {	// 기출분석
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
					_setHierarchy();
				}
				else
				{
					if(parseInt(parseInt(pop2TypeItems[selectedInfo.type2Index].Index)) != 1 && data.pos == 1) {
						selectedInfo.subject2Index = 0;
					} else {
						selectedInfo.subject2Index = 2;
					}

					if(parseInt(parseInt(pop2TypeItems[selectedInfo.type2Index].Index)) == 8)
					{
						selectedInfo.subject2Index = 0;
					}

					selectedInfo.pub2Index = 0;
					selectedInfo.year2Index = 0;
					selectedInfo.term2Index = 0;
					selectedInfo.fileType2Index = 0;
					selectedInfo.subject2DetailIndex = 0;
				}

				isOldData = false;
				_olddata_text();

				document.getElementById("part_ID").value = "";
				_setSelectedValue();
			});
		}
		else if(act_v == "filter2_subject") {
			common.showFlexSelect("과목", popSubjectItems, selectedInfo.subject2Index, false, function(data) {
				_hLog("selected data=" + JSON.stringify(data));

				selectedInfo.subject2Index = data.pos;

				if(parseInt(parseInt(pop2TypeItems[selectedInfo.type2Index].Index)) != 0)
				{
					if(parseInt(parseInt(pop2TypeItems[selectedInfo.type2Index].Index)) != 7)
					{
						selectedInfo.year2Index = 0;
					}
					selectedInfo.term2Index = 0;
					selectedInfo.fileType2Index = 0;
					selectedInfo.pub2Index = 0;
					selectedInfo.subject2DetailIndex = 0;

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
						var data_v = "SiteID=H";
							data_v = data_v + "&Grade=" + popGrade2Items[selectedInfo.grade2Index].Value;
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
		else if (act_v == "filter2_sub2Detail") {
			common.showFlexSelect("상세과목", popSubjDetailItems, selectedInfo.subject2DetailIndex, false, function(data){
				selectedInfo.subject2DetailIndex = data.pos;
				if(parseInt(parseInt(pop2TypeItems[selectedInfo.type2Index].Index)) != 7)
				{
					selectedInfo.year2Index = 0;
				}
				selectedInfo.term2Index = 0;
				selectedInfo.fileType2Index = 0;
				_setSelectedValue();
			});
		}
		else if (act_v == "filter2_pub") {
			common.showFlexSelect("교과서", pubItems, selectedInfo.pub2Index, false, function(data){
				_hLog("selected data=" + JSON.stringify(data));
				selectedInfo.pub2Index = data.pos;
				selectedInfo.year2Index = 0;
				selectedInfo.term2Index = 0;
				_setSelectedValue();
			});
		}
		else if(act_v == "filter2_year") {
			common.showFlexSelect("년도", popYearItems, selectedInfo.year2Index, false, function(data) {
				_hLog("selected data=" + JSON.stringify(data));
				selectedInfo.year2Index = data.pos;

				if(parseInt(parseInt(pop2TypeItems[selectedInfo.type2Index].Index)) != 0)
				{
					selectedInfo.term2Index = 0;
					selectedInfo.fileType2Index = 0;
				}

				_setSelectedValue();
			});
		}
		else if(act_v == "filter2_term") {
			// 학교별 기출유사는 분기마다 학기 늘려 나가기로~
			if(selectedInfo.menuIndex == 1 && pop2TypeItems[selectedInfo.type2Index].Index == "7") {
				termItems = [{"title": "전체 학기", "Value": ""}, {"title": "1학기 중간", "Value": "1M"}, {"title": "1학기 기말", "Value": "1E"}, {"title": "2학기 중간", "Value": "2M"}, {"title": "2학기 기말", "Value": "2E"}]
			} else {
				termItems = _term;
			}

			if(parseInt(parseInt(pop2TypeItems[selectedInfo.type2Index].Index)) == 0)
			{
				common.showFlexSelect("학기", _term_FreeReading, selectedInfo.term2Index, false, function(data) {
					selectedInfo.term2Index = data.pos;
					_setSelectedValue();
				});
			}
			else
			{
				//common.showFlexSelect("학기", _term, selectedInfo.term2Index, false, function(data) {
				common.showFlexSelect("학기", termItems, selectedInfo.term2Index, false, function(data) {
					_hLog("selected data=" + JSON.stringify(data));
					selectedInfo.term2Index = data.pos;
					selectedInfo.fileType2Index = 0;
					_setSelectedValue();
				});
			}
		}
		else if(act_v == "filter2_fileType") {
			common.showFlexSelect("자료 종류", fileType2Items, selectedInfo.fileType2Index, false, function(data) {
				_hLog("selected data=" + JSON.stringify(data));
				selectedInfo.fileType2Index = data.pos;
				_setSelectedValue();
			});
		}
		else if(act_v == "filter2_Chapter") 
		{			
			if(selectedInfo.si2Index != 0 && selectedInfo.gu2Index != 0 && selectedInfo.sch2Index != 0)
			{
				var SiteID = "H";
				var Grade = popGrade2Items[selectedInfo.grade2Index].Value;
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
				var data = "cmd=EXPAPR_NO_CHK&SiteID=" + SiteID + "&Grade=" + Grade + "&Subj_Code=" + Subj_Code + "&Rg_CitiesProvinces=" + Rg_CitiesProvinces + "&Rg_District=" + Rg_District + "&Scl_ID=" + Scl_ID + "&Subj_Name=" + Subj_Name + "&expapr_Group=" + expapr_Group;

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

					//this.popup_Chk = window.open('../../include/pdf_Viewer.asp?SiteID=H&Scl_ID='+Scl_ID+'&Scl_Name='+Scl_Name+'&Grade='+Grade+'&Subj_Code='+Subj_Code+'&ExPapr_TestYear='+ExPapr_TestYear+'&ExPapr_MidEndTerm='+ExPapr_MidEndTerm+'&TX_Name='+TX_Name+'&sub_TX_CODE='+sub_TX_CODE, 'viewer');
					this.popup_Chk = window.open('../../common/system/recaptcha_Chk.asp?SiteID=H&Scl_ID='+Scl_ID+'&Scl_Name='+Scl_Name+'&Grade='+Grade+'&Subj_Code='+Subj_Code+'&ExPapr_TestYear='+ExPapr_TestYear+'&ExPapr_MidEndTerm='+ExPapr_MidEndTerm+'&TX_Name='+TX_Name+'&sub_TX_CODE='+sub_TX_CODE+'&viewer=Y');
				}
			}
		}
		else if (act_v == "listFilter") {
			// 학교별 족보 > 우리학교, 동일출판사 다른학교 필터
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
				var expected_Grade = popGrade2Items[selectedInfo.grade2Index].Value;
				var expected_scl_id = sch2Items[selectedInfo.sch2Index].Scl_ID;

				if(expected_Grade == 1) {
					location.href = site_gubun + "expected.asp?Subj_Code=" + expected_subj_Code + "&Grade=" + expected_Grade + "&scl_id=" + expected_scl_id;
				} else {
					var expected_txcode = popSubjDetailItems[selectedInfo.subject2DetailIndex].TX_CODE;

					location.href = site_gubun + "expected.asp?Subj_Code=" + expected_subj_Code + "&Grade=" + expected_Grade + "&scl_id=" + expected_scl_id + "&TX_CODE=" + expected_txcode;
				}
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
				if(data.pos == 0) {
					selectedInfo.subject3Index = 2;
				} else if( data.pos == 1) {
					selectedInfo.subject3Index = 6;
				} else if( data.pos == 2) {
					selectedInfo.subject3Index = 0;
				}
				selectedInfo.tx3Index = 0;
				selectedInfo.chapter3Index = 0;
				selectedInfo.sub3Index = 0;
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
				selectedInfo.sub3Index = data.pos;
				_setSelectedValue();
			});
		}
		else if(act_v == "showBindo") {
			// 출제 빈도 디스 플레이
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

				var imgName = chapter3Items[selectedInfo.chapter3Index].Name;

				if(imgName == 0 || popSub3Items.length == 0) {
					imageName.parentNode.style.display = "none";
				} else {
					imageName.parentNode.style.display = "";
					imgName = imgName.substring(imgName.lastIndexOf(".")+1, imgName.length);
					imageName.innerHTML = imgName;
					$(imageName).unbind();
					if(course_id == "19" || course_id == "28" || course_id == "43" || course_id == "44") {
						$(imageName).bind("click", function(){
							common.showFlexSelect("선택", popSub3Items, imgIdx, false, function(data){
								var imgFileName = (data.pos-0+1) + ".jpg";
								imageName.innerHTML = data.title;
								imgIdx = data.pos;
								imageSrc.src = config.IMAGE_URL_DEF+_topic3List[data.pos].Image_Url + imgFileName;
							});
						});
						imageName.innerHTML = popSub3Items[imgIdx].title;
					}
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
			var group_v = evo.getAttribute("data-group_v") || "";
			var coretype_v = evo.getAttribute("data-coretype_v") || "";

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
					if (group_v == "K" && (coretype_v.substring(0,1) == "Q" || coretype_v.substring(0,1) == "R")) {
						_drawToggleItem({"parent_index": evo.getAttribute("data-parent-index"), 
											"rootpart_code": evo.getAttribute("data-rootpart_code"), 
											"etc_action": evo.getAttribute("data-name"),
											"group": group_v, "coretype": coretype_v
										});
					} else {
						_drawToggleItem({"parent_index": evo.getAttribute("data-parent-index"), 
											"rootpart_code": evo.getAttribute("data-rootpart_code"), 
											"etc_action": ""
										});
					}					
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

						if(selectedInfo.gradeIndex == 1)
						{
							if(p_o.getAttribute("data-type") == "C")
							{
								if($(p_o).hasClass("active")) {
									cul_o.style.display = "";
								} 
								else {
									cul_o.style.display = "none";
								}
							}
							else
							{
								if($(p_o).hasClass("active")) {
									cul_o.style.display = "none";

									if(selectedInfo.subjectCode == "LS")
									{
										ul_o[parseInt(p_o.getAttribute("data-i")) + 1].style.display = "none";
									}
								} 
								else {
									cul_o.style.display = "";
									
									if(selectedInfo.subjectCode == "LS")
									{
										ul_o[parseInt(p_o.getAttribute("data-i")) + 1].style.display = "";
									}
								}
							}							
						}
						else
						{
							if(selectedInfo.gradeIndex == 1)
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
		else if (act_v == "fold_top") {				// 여기부터~~~ (전체펼치기)
			var evoId = evo.getAttribute("for");
			if(evoId == null) {
				evoId = evo.id;
			}
			
			var parent_o = util.findObjectByAttr(evo, "class", "row2");
			
			// 내신완성, 학교별족보 (최빈, 최오) 일 경우 사용
			if((selectedInfo.menuIndex == 0 || selectedInfo.menuIndex == 3 || selectedInfo.menuIndex == 4 || selectedInfo.menuIndex == 5) || (selectedInfo.menuIndex == 1 && pop2TypeItems[selectedInfo.type2Index].value == "H")) {
				var bl_o = parent_o.querySelectorAll(".block_list");
				var toggle_attr = $(bl_o).find("button[class='toggle']")[0];
				var group_v = $(toggle_attr).data("group_v") || "";
				var coretype_v = $(toggle_attr).data("coretype_v") || "";

				if(selectedInfo.menuIndex == 5)
				{
					for(var i=0; i<(bl_o.length-1); i++) {
						var bl = bl_o[i];

						var tl_o = bl.querySelector(".titleLine");
						if($(tl_o).hasClass("active")) {
							if(evoId == "fold2") {
								$(tl_o).removeClass("active");
							}
						} else {
							if(evoId == "fold1") {
								if (group_v == "K" && coretype_v.substring(0,1) == "Q") {
									if ($(bl).find("div[class='productBlock row']").length > 0){
										$(tl_o).addClass("active");
									}
								} else {
									$(tl_o).addClass("active");
								}
								

								// S : 대단원 선택 시 리스트 노출 시키는 경우 (개념완성, 대단원) 는 펼치면서 리스트 호출
								var o_toggleItem = $(bl_o).find("button[class='toggle']")[i];

								if (group_v != "K" && coretype_v.substring(0,1) != "Q") {
									if (typeof($(o_toggleItem).data("parent-index")) != "undefined" && typeof($(o_toggleItem).data("rootpart_code")) != "undefined") {								
										_drawToggleItem({"parent_index": $(o_toggleItem).data("parent-index"),
															"rootpart_code": $(o_toggleItem).data("rootpart_code"),
															"etc_action": ""
														});
									}
								}
								// E
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
								if (group_v == "K" && coretype_v.substring(0,1) == "Q") {
									if ($(bl).find("div[class='productBlock row']").length > 0){
										$(tl_o).addClass("active");
									}
								} else {
									$(tl_o).addClass("active");
								}
								

								// S : 대단원 선택 시 리스트 노출 시키는 경우 (개념완성, 대단원) 는 펼치면서 리스트 호출
								var o_toggleItem = $(bl_o).find("button[class='toggle']")[i];

								if (group_v != "K" && coretype_v.substring(0,1) != "Q") {
									if (typeof($(o_toggleItem).data("parent-index")) != "undefined" && typeof($(o_toggleItem).data("rootpart_code")) != "undefined") {								
										_drawToggleItem({"parent_index": $(o_toggleItem).data("parent-index"),
															"rootpart_code": $(o_toggleItem).data("rootpart_code"),
															"etc_action": ""
														});
									}
								}
								// E
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
				trkCLS.setExternalEvent("6R82AQ4ZRKWZO6E3GQZ28FOOR20260223", "");
				location.href = '/H/exam_unit_ai.asp?grade=1&subject_cd='+selectedInfo.subjectCode;
				return false;
			}

			// 개정자료보기 클릭
			if(isOldData) {
				evo.innerHTML = "<span class='is-bedge'>15개정</span>이전 개정자료 보기";
				isOldData = false;
				trkCLS.setExternalEvent("6R82AQ4ZRKWZO6E3GQZ28FOOR20260223", "");
			} else {
				evo.innerHTML = "<span class='is-bedge'>22개정</span>최신 개정자료 보기";
				isOldData = true;
				trkCLS.setExternalEvent("M7UEUXHTKUEU6JX7N1VA3NYDA20260223", "");
			}

			if(selectedInfo.menuIndex == 4 && selectedInfo.groupIndex == 4 && popGradeItems[selectedInfo.gradeIndex].Value == "2" && popSubjectItems[selectedInfo.subjectIndex].Value == "MT") {
				selectedInfo.yearIndex = 0;
			}

			// 고2 이전개정 추가하면서 추가 된 부분
			popTxItems = null;
			// 고2 이전개정 추가하면서 추가 된 부분

			oldData_flag = true;

			_setSelectedValue();
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
		$(".tabLine-round_M li").removeClass("active");
		$(".tabLine-round_M li").eq(4).addClass("active");

		if(parseInt(pop2TypeItems[selectedInfo.type2Index].Index) == 0) {
			var season_FreeState = $("#season_FreeState").val();

			if(season_FreeState == 'N')
			{
				$("body").css("height", "100%");
				$("body").css("overflow", "hidden");
				$("#pre_Area").show();
				$("#pre_Area").addClass("top");
				//$("#exam_midend").text("");				
				$("#exam_type").text($("#exam_type").text().replace("학교별 AI기출변형은", "학교별 기출 무료 열람실은"));
				$("#exam_type").text($("#exam_type").text().replace("직전대비는", "학교별 기출 무료 열람실은"));
				$("#exam_date").text($("#exam_date").text().replace("4월 2일", "3월 12일"));
			}
			else
			{
				$("#pre_Area").hide();

				selectedInfo.si2Index = 0;
				selectedInfo.gu2Index = 0;
				selectedInfo.sch2Index = 0;
				selectedInfo.grade2Index = 0;
				selectedInfo.subject2Index = 0;
				selectedInfo.year2Index = 0;
				selectedInfo.term2Index = 0;

				//filter_2.querySelector("[id='err_msg']").innerText = '';
				$("#div_Img").show();

				_drawList(null);
			}
		} else {
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
				selectedInfo.subject2Index = 2;
				selectedInfo.subject2DetailIndex = 0;
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

	// TX_CODE 가져오기 위한 함수
	var _getTXItems = function() {				
		if (_Hierarchy.length == 0) {
			popTxItems = [{"Name": "공통", "Value": ""}];
			return;
		}

		var subjItems = _Hierarchy[selectedInfo.gradeIndex].Subj_Code;		
		for (var i = 0; i < subjItems.length; i++) {
			var item = subjItems[i];
			if (item.Value == selectedInfo.subjectCode && (item.Name == selectedInfo.subjectName || item.Name == selectedInfo.subjectName +" 영역" )) {
				if (item.TX_CODE == null) {
					popTxItems = [{"Name": "공통", "Value": ""}];
				} else {
					popTxItems = item.TX_CODE;
				}
				return;
			}
		}
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

	// 토클 및 대단원 선택 시 리스트 호출
	var _drawToggleItem = function(props) {
		var p_parent_index = props.parent_index;
		var p_rootpart_code = props.rootpart_code;
		var p_etc_action = props.etc_action;
		var group_v = props.group || "";
		var coretype_v = props.coretype || "";

		// 서브 리스트가 비어 있으면 호출
		var l_div_o = $("div[class='block_list'][data-index=" + p_parent_index + "]")[0];	// parent div 확인
		if ($(l_div_o).find("div").length == 0 || _add_diff != p_add_diff) {
			// 열림 아이콘 변경
			var p_o = $(l_div_o).find("p");
			$(p_o).addClass("active");
			$(p_o.parentNode).find(".productBlock.row").css("display", "");

			comm.toggleLoading(true);

			var data_v = "";

			if (group_v == "K" && coretype_v.substring(0,1) == "Q") {
				//시대별문학
				data_v = _data_v.substring(0, _data_v.indexOf("&qry"));
				//data_v = _data_v+"&qry="+encodeURIComponent(p_etc_action);
				data_v = data_v+"&qry="+encodeURIComponent(p_etc_action);
			} else if(group_v == "C" && (p_add_diff == "0" || p_add_diff == "")) {
				// 단원별 문제(난이도 기본 셋팅_최상위 제외)
				data_v = _data_v+"&rootpart_code=" + p_rootpart_code + "&add_diff=1,2,3";
			} else {
				data_v = _data_v+"&rootpart_code=" + p_rootpart_code + "&add_diff=" + p_add_diff;
			}

			// 대메뉴(rootpart_code)에 해당되는 리스트만 호출			
			comm.send(_url_v, data_v, "POST", function(json) {
				//console.log(_url_v)
				//console.log(data_v)
				//console.log(json)
				comm.toggleLoading(false);
				var l_item_p = json.list[0];

				if (group_v == "K" && coretype_v.substring(0,1) == "Q") {
					//시대별문학
					l_item_p = json.list;
					var tmpItems = [];
					tmpItems["items"] = json.list;
					tmpItems["length"] = json.list.length;
					tmpItems["cate"] = p_etc_action;
					l_item_p = tmpItems
				}

				// S : 리스트 카운트 테스트				
				if ((p_etc_action == "bbsNumber") || group_v == "K" && coretype_v.substring(0,1) == "Q") {
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
					//_drawItem_C_sub_v2(l_div_o, l_item_p)
					_drawItem_C_sub_v2({"obj_div": l_div_o, "items": l_item_p, "toggle": true});

				}
				_initEvent();
			});
		}
	}

	return {
		init:function() {
			_init();
		},
		getSelectedInfo:function() { return selectedInfo;},
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