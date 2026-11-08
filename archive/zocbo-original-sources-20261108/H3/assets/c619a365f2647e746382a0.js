/*
	커뮤니티 글쓰기 팝업
*/
var community_w = function() {
	var _id = "community_w";
	var root = null;
	var parent_o = null;
	var param = null;
	var existNode_o = null;

 	var si_selectedIndex = 0;
 	var region_selectedIndex = 0;
 	var sch_selectedIndex = 0;

 	var regionList = null;
 	var schList = null;

	var districtItems = null;
	var _boardKind = null;
	var zb_No = null;

	var si = null;
	var region = null;
	var school = null;

	var siteId = "M";

	var selectMonth = 1;
	var lastDay = null;

	var currentYear = null;
	var currentMonth = 1;

	var isEdit = false;

	var scroll = null;

	var grade = null;
	var subjectItems = null;
	var txItems = null;
	var isChanged = false;
	var isChangedLength = 0;

	var examyn = "Y"; // 우리학교 시험정보 시행여부 기본 Y (시행)

	var _init = function() {
		window.scrollTo(0,0);

		siteId = location.pathname.substr(1,1);


		var query = location.search;
		query = query.substring(1, query.length);
		param = util.queryStringToJSON(query);

		_hLog("param=" + JSON.stringify(param));

		if(param.boardKind) {
			_boardKind = param.boardKind;
		}
		root = document.querySelector("[data-id='"+_id+"']");

		if(root == null) {
			_hLog(_id + " root not found");
		}

		$(root).show();

		_initForm();
		_drawYear();

		if(_boardKind == "3"){
			_drawInitSchArea();
			_getSubjectItems();
		}

		_setGrade();
		_loadData();
		_initEvent();

		if(param.zb_No) {
			// 수정
			zb_No = param.zb_No;
			_loadEditData();
			isEdit = true;
		}
	};

	// 과목 및 출판사 가져오기
	var _getSubjectItems = function(){
		Hierarchy_Init(siteId, "C", "");

		grade = $("input[name='zb_Grade']:checked").val();

		if(grade == null) {
			grade = 1;
		}

		var gradeIndex = grade-1;

		subjectItems = _Hierarchy[gradeIndex].Subj_Code;

		_createSubjectArea();
	};

	// 과목 영역 그리기
	var _createSubjectArea = function(){

		var row_o = root.querySelector(".test-range .row");
		var addBtn_o = row_o.querySelector("p");

		for(var i=0; i<5; i++) {

			var subjectItem = subjectItems[i];

			var div_o = document.createElement("div");
			div_o.className = "blockWhite";

			div_o.innerHTML = "<h3>과목</h3>";

			var p_o = document.createElement("p");
			p_o.className = "subject";
			p_o.innerHTML = subjectItem.Name;
			p_o.setAttribute("data-target", "exam_subject");
			div_o.appendChild(p_o);

			div_o.innerHTML += "<h3 class='mT25'>출판사</h3>";

			var div_o2 = document.createElement("div");
			div_o2.className = "clearfix mT5";

			_setTx(i, div_o2);

			div_o2.innerHTML += "<p data-form='exam_txcode"+i+"' class='formMsg fL' style='display:none;'>교과서는 필수입니다.</p>";
			div_o.appendChild(div_o2);

			div_o.innerHTML += "<h3 class='mT30'>단원별 시험범위</h3>";
			div_o2 = document.createElement("div");
			div_o2.className = "mT10";
			div_o2.innerHTML = "<input data-target='exam_unit' name='exam_unit"+i+"' type='text' placeholder='단원명 입력' data-info='chapterLen"+i+"' data-len='30'>";
			div_o.appendChild(div_o2);

			div_o2 = document.createElement("div");
			div_o2.className = "clearfix";
			div_o2.innerHTML = "<p data-form='exam_unit"+i+"' class='formMsg fL' style='display:none;'>단원명은 필수입니다.</p>";
			div_o2.innerHTML += "<p class='character fR'><b id='chapterLen"+i+"'>0</b> / 30</p>";
			div_o.appendChild(div_o2);


			div_o.innerHTML += "<h3 class='mT30'>페이지 시험범위</h3>";
			div_o2 = document.createElement("div");
			div_o2.className = "mT10 pageRange clearfix";

			var div_o3 = document.createElement("div");
			div_o3.className = "range";
			div_o3.innerHTML = "<input data-target='exam_page_start' name='exam_page_start"+i+"' type='text' placeholder='' value=''><span>P</span>";
			div_o2.appendChild(div_o3);

			div_o2.innerHTML += "<em>~</em>";

			var div_o3 = document.createElement("div");
			div_o3.className = "range";
			div_o3.innerHTML = "<input data-target='exam_page_end' name='exam_page_end"+i+"' type='text' placeholder='' value=''><span>P</span>";
			div_o2.appendChild(div_o3);

			div_o.appendChild(div_o2);

			div_o.innerHTML += "<p data-form='exam_page_start"+i+"' class='formMsg fL' style='display:none;'>시험범위는 필수입니다.</p>";
			div_o.innerHTML += "<p data-form='exam_page_end"+i+"' class='formMsg fL' style='display:none;'>시험범위는 필수입니다.</p>";
			row_o.insertBefore(div_o, addBtn_o);
		};
	};

	// 교과서 설정
	var _setTx = function(subjectIndex, parent_o){
		txItems = subjectItems[subjectIndex].TX_CODE;

		parent_o.innerHTML = "";

		var select_o = document.createElement("select");
		select_o.name = "exam_txcode"+subjectIndex;
		select_o.setAttribute("data-target", "exam_txcode");
		select_o.className = "select fL";
		select_o.style.height = "48px;";
		select_o.innerHTML = "<option value=''>교과서</option>";
		parent_o.appendChild(select_o);

		for(var i=0; i<txItems.length; i++) {
			var txItem = txItems[i];

			var option_o = document.createElement("option");
			option_o.value = txItem.Name;
			option_o.innerHTML = txItem.Name;

			select_o.appendChild(option_o);
		}
	};

	// 중등과 고등의 경우 학년이 다르므로 학년을 설정해줌
	var _setGrade = function(){

		var grade_all_o = root.querySelectorAll("[name='zb_Grade']");

		for(var i=0; i<grade_all_o.length; i++){

			var grade_o = grade_all_o[i];

			var targetSite = grade_o.getAttribute("data-site");

			if(targetSite == siteId || targetSite == "ALL") {
				grade_o.parentNode.style.display = "";
			} else {
				grade_o.parentNode.style.display = "none";
				grade_o.parentNode.removeChild(grade_o);
			}
		}
	};

	// 수정 시 등록된 데이타 가져오기
	var _loadEditData = function(){
		comm.toggleLoading(true);
		var data_v = "cmd=VIEWB&site_id="+siteId+"&boardKind="+_boardKind+"&zb_No="+zb_No;
		comm.send("/_api/community.api.asp", data_v, "get", function(data){
			if(data) {
				data.list[0].arrExamInfo = data.arrExamInfo;
				_setEditData(data.list[0]);
				comm.toggleLoading(false);
			}
		});
	};

	// 수정 시 등록된 데이타 세팅
	var _setEditData = function(item){
		if(_boardKind == 1) {
			_setScoreData(item);
		} else if (_boardKind == 3) {
			_setExamData(item);
		} else if (_boardKind == 4) {
			_setCounselData(item);
		}
	};

	// 수정 시 등록된 데이타 세팅
	var _setScoreData = function(item){
		var title = item.zb_Title;
		if(title){
			var titleLen = title.length;
			var title_o = root.querySelector("#zb_Title");
			title_o.value = title;
			var titleLen_o = root.querySelector("#cmTitleLen");
			titleLen_o.innerHTML = titleLen;
		}

		var photo = item.zb_Photo;
		if(photo){
			var fileName1_o = root.querySelector(".fileName1");
			fileName1_o.style.display = "";

			var name_o = fileName1_o.querySelector("li a");
			name_o.innerHTML = photo;
		}

		var contents = item.zb_Contents;
		if(contents) {
			var contents_o = root.querySelector("#contentText");
			contents_o.innerHTML = contents;
			var contentsLen = contents.length;
			var contentsLen_o = root.querySelector("#cmContentLen");
			contentsLen_o.innerHTML = contentsLen;
		}

		var file = item.zb_File;

		var originFile_o = $(root).find(".originFile");
		var originName_o = $(root).find(".photoList.originFile").find("a");

		if(file){

			var fileName = file.substr(file.lastIndexOf("/")+1, file.length);

			originFile_o.show();
			originName_o.html(fileName);

		} else {
			originFile_o.hide();
			originName_o.html("");
		}
	};

	// 수정 시 등록된 데이타 세팅
	var _setExamData = function(item){

		isChanged = true;

		si = item.zb_SchoolCity;

		_drawInitSchArea(item.zb_SchoolDistrict, function(){

			si = item.zb_SchoolCity;
			region = item.zb_SchoolDistrict;
			school = item.zb_SchoolCode;

			var city_s_o = root.querySelector("#rg_city");
			var city_o = $(city_s_o).find("[value='"+si.trim()+"']");
			city_o.prop("selected", true);

			var region_s_o = root.querySelector("#rg_dist");
			var region_o = $(region_s_o).find("[value='"+region.trim()+"']");
			region_o.prop("selected", true);

			var school_s_o = root.querySelector("#rg_school");
			var school_o = $(school_s_o).find("[value='"+school+"']");
			school_o.prop("selected", true);
		});

		var unit = item.zb_Unit;
		var unit_o = root.querySelector("[name='zb_Grade'][value='"+unit+"']");
		$(unit_o).prop("checked", true);

		var branch = item.zb_Branch;
		var branch_o = root.querySelector("[name='zb_Branch'][value='"+branch+"']");
		$(branch_o).prop("checked", true);

		var examYear = item.zb_Exam_Year;
		var examYear_s_o = root.querySelector("[name='zb_Exam_Year']");
		var examYear_o = $(examYear_s_o).find("[value='"+examYear+"']");
		examYear_o.prop("selected", true);

		var examSM = item.zb_Exam_S_M;
		currentMonth = examSM;
		var examSM_s_o = root.querySelector("[name='zb_Exam_S_M']");
		var examSM_o = $(examSM_s_o).find("[value='"+examSM+"']");
		examSM_o.prop("selected", true);

		var day_o = root.querySelector("#zb_Exam_S_D");
		_drawDay(day_o);
		var examSD = item.zb_Exam_S_D;
		var examSD_s_o = root.querySelector("[name='zb_Exam_S_D']");
		var examSD_o = $(examSD_s_o).find("[value='"+examSD+"']");
		examSD_o.prop("selected", true);

		var examEM = item.zb_Exam_E_M;
		currentMonth = examEM;
		var examEM_s_o = root.querySelector("[name='zb_Exam_E_M']");
		var examEM_o = $(examEM_s_o).find("[value='"+examEM+"']");
		examEM_o.prop("selected", true);

		day_o = root.querySelector("#zb_Exam_E_D");
		_drawDay(day_o);
		var examED = item.zb_Exam_E_D;
		var examED_s_o = root.querySelector("[name='zb_Exam_E_D']");
		var examED_o = $(examED_s_o).find("[value='"+examED+"']");
		examED_o.prop("selected", true);

		var zb_Kor = item.zb_Kor;
		if(zb_Kor) {
			var kor_o = root.querySelector("[name='zb_Kor']");
			$(kor_o).val(zb_Kor);

			var korLenInfo = root.querySelector("#korLenInfo");
			korLenInfo.innerHTML = zb_Kor.length;
		}

		var zb_Eng = item.zb_Eng;
		if(zb_Eng) {
			var eng_o = root.querySelector("[name='zb_Eng']");
			$(eng_o).val(zb_Eng);
			var engLenInfo = root.querySelector("#engLenInfo");
			engLenInfo.innerHTML = zb_Eng.length;
		}


		var zb_Mat = item.zb_Mat;

		if(zb_Mat) {
			var mat_o = root.querySelector("[name='zb_Mat']");
			$(mat_o).val(zb_Mat);

			var matLenInfo = root.querySelector("#matLenInfo");
			matLenInfo.innerHTML = zb_Mat.length;
		}

		var zb_Soc = item.zb_Soc;
		if(zb_Soc) {
			var soc_o = root.querySelector("[name='zb_Soc']");
			$(soc_o).val(zb_Soc);

			var socLenInfo = root.querySelector("#socLenInfo");
			socLenInfo.innerHTML = zb_Soc.length;
		}

		var zb_Sic = item.zb_Sic;
		if(zb_Sic) {
			var sic_o = root.querySelector("[name='zb_Sic']");
			$(sic_o).val(zb_Sic);

			var sicLenInfo = root.querySelector("#sicLenInfo");
			sicLenInfo.innerHTML = zb_Sic.length;
		}

		var etcItem = item.zb_Etc1_Item;
		var etcValue = item.zb_Etc1_Value;

		if(etcItem && etcValue) {
			_createEtcSubject();

			var etcItem_o = root.querySelector("[name='zb_Etc1_Item']");
			etcItem_o.value = etcItem;

			var etcValue_o = root.querySelector("[name='zb_Etc1_Value']");
			etcValue_o.value = etcValue;

			var itemLen_o = root.querySelector("#zb_ItemInfo1");
			var valueLen_o = root.querySelector("#zb_ValueInfo1");

			itemLen_o.innerHTML = etcItem.length;
			valueLen_o.innerHTML = etcValue.length;
		}

		etcItem = item.zb_Etc2_Item;
		etcValue = item.zb_Etc2_Value;

		if(etcItem && etcValue) {
			_createEtcSubject();

			var etcItem_o = root.querySelector("[name='zb_Etc2_Item']");
			etcItem_o.value = etcItem;

			var etcValue_o = root.querySelector("[name='zb_Etc2_Value']");
			etcValue_o.value = etcValue;

			var itemLen_o = root.querySelector("#zb_ItemInfo2");
			var valueLen_o = root.querySelector("#zb_ValueInfo2");

			itemLen_o.innerHTML = etcItem.length;
			valueLen_o.innerHTML = etcValue.length;
		}

		etcItem = item.zb_Etc3_Item;
		etcValue3 = item.zb_Etc3_Value;

		if(etcItem && etcValue) {
			_createEtcSubject();

			var etcItem_o = root.querySelector("[name='zb_Etc3_Item']");
			etcItem_o.value = etcItem;

			var etcValue_o = root.querySelector("[name='zb_Etc3_Value']");
			etcValue_o.value = etcValue;

			var itemLen_o = root.querySelector("#zb_ItemInfo3");
			var valueLen_o = root.querySelector("#zb_ValueInfo3");

			itemLen_o.innerHTML = etcItem.length;
			valueLen_o.innerHTML = etcValue.length;
		}

		var at_o = root.querySelectorAll(".addTestRange");

		if(at_o.length >= 3) {
			var btn_o = root.querySelector("a[data-act='addSubject']");
			btn_o.className += " disabled";
		}

		var contents = item.zb_Contents;
		var contents_o = root.querySelector("#contentText");
		contents_o.innerHTML = contents;

		var contentLen_o = $(root).find("#cmContentLen");
		contentLen_o.html(contents.length);

		var file = item.zb_File;

		var originFile_o = $(root).find(".originFile");
		var originName_o = $(root).find(".photoList.originFile").find("a");

		if(file) {
			var fileName = file.substr(file.lastIndexOf("/")+1, file.length);

			originFile_o.show();
			originName_o.html(fileName);

		} else {
			originFile_o.hide();
			originName_o.html("");
		}

		currentMonth = 1;

		if(item.arrExamInfo){

			var arrExamInfo = item.arrExamInfo;

			var objs = root.querySelectorAll(".test-range .blockWhite");

			for(var i=0; i<arrExamInfo.length; i++) {
				var chkMatch = "N";
				var aItem = arrExamInfo[i];
				if(objs && objs.length >0) {
					for(var j=0; j<objs.length; j++){
						var subject_o = objs[j].querySelector("[data-target='exam_subject']");
						if(aItem.subject == subject_o.innerText) {
							var txcode_o = objs[j].querySelector("[data-target='exam_txcode']");
							var unit_o = objs[j].querySelector("[data-target='exam_unit']");
							var pageStart_o = objs[j].querySelector("[data-target='exam_page_start']");
							var pageEnd_o = objs[j].querySelector("[data-target='exam_page_end']");

							var pages = aItem.examPage.split("~");

							var txOptions_o = txcode_o.querySelectorAll("option");
							for(var k=0; k<txOptions_o.length; k++) {
								var txOption_o = txOptions_o[k];

								if(aItem.tx_name == txOption_o.value) {
									txcode_o.selectedIndex = k;
								}
							}

							unit_o.value = aItem.chapter;
							var unit_info_v = unit_o.getAttribute("data-info");

							var unit_info_o = objs[j].querySelector("#"+unit_info_v);
							if(unit_info_o){
								unit_info_o.innerHTML = aItem.chapter.length;
							}

							pageStart_o.value = pages[0].substring(0, pages[0].indexOf("P"));
							pageEnd_o.value = pages[1].substring(0, pages[1].indexOf("P"));
							chkMatch = "Y";
						}
					}
				}

				if(chkMatch == "N") {
					_createEtcSubject();
					objs = root.querySelectorAll(".test-range .blockWhite.mT20");
					if(objs.length >= 4) {
						var obj = root.querySelector("a[data-act='addSubject']");
						obj.className += " disabled";
						return;
					} else if(objs && objs.length > 0 ) {
						for(var j=0; j<objs.length; j++){
							var obj = objs[j];

							var subject_all = obj.querySelectorAll("[data-target='exam_subject'] option");

							subject_all.forEach(function(item, index){
								if(item.value == aItem.subject) {
									item.parentNode.selectedIndex = index;

									var index_v = item.getAttribute("data-index");

									var txcode_o = obj.querySelector("[data-target='exam_txcode']");
									txItems = subjectItems[index_v].TX_CODE;

									txcode_o.innerHTML = "<option value=''>교과서</option>";
									txItems.forEach(function(item_t, index_t){
										var option_o = document.createElement("option");
										option_o.value = item_t.Name;
										option_o.innerHTML = item_t.Name;
										txcode_o.appendChild(option_o);
									});

									txcode_o.selectedIndex = index;

									var unit_o = obj.querySelector("[data-target='exam_unit']");
									unit_o.value = aItem.chapter;

									var unit_info_v = unit_o.getAttribute("data-info");

									var unit_info_o = objs[j].querySelector("#"+unit_info_v);
									if(unit_info_o){
										unit_info_o.innerHTML = aItem.chapter.length;
									}

									var pages = aItem.examPage.split("~");

									var pageStart_o = obj.querySelector("[data-target='exam_page_start']");
									pageStart_o.value = pages[0].substring(0, pages[0].indexOf("P"));


									var pageEnd_o = obj.querySelector("[data-target='exam_page_end']");
									pageEnd_o.value = pages[1].substring(0, pages[1].indexOf("P"));
								}
							});
						}
					}
				}
			}
			_initEvent();
		}
	};

	// 수정 시 등록된 데이타 세팅
	var _setCounselData = function(item){
		var secretYN = item.SecretYN;
		var secretYN_o = $(root).find("[name='SecretYN'][value='"+secretYN+"']");

		// SKY 멘토 현재 비공개인 경우만 노출 처리
		if(_boardKind == 4) {
			// 공개/비공개 는 기본 숨김 처리. 다만 과거 공개 했던 경우에 한해 노출 처리		
			if(secretYN == "Y") {						
				$(".mentor").show();
				$(".mentor").eq(0).css("display", "none");				
			}
		}

		if(secretYN_o){
			secretYN_o.attr("checked", true);
		}		

		var ABType = item.AB_Type;
		var ABType_o = $(root).find("[name='AB_Type'][value='"+ABType+"']");
		if(ABType_o) {
			ABType_o.attr("checked", true);
		}

		var title = item.Title;
		var title_o = $(root).find("#zb_Title");
		var titleLen = title.length;
		var titleLen_o = $(root).find("#cmTitleLen");
		if(title_o){
			title_o.val(title);
			titleLen_o.html(titleLen);
		} else {
			titleLen_o.html("0");
			title_o.val("");
		}

		var content = item.Contents;
		var content_o = $(root).find("#contentText");
		content_o.html(content);

		var contentLen_o = $(root).find("#cmContentLen");
		contentLen_o.html(content.length);

		var file = item.Attach_File;

		var originFile_o = $(root).find(".originFile");
		var originName_o = $(root).find(".photoList.originFile").find("a");

		if(file){

			var fileName = file.substr(file.lastIndexOf("/")+1, file.length);

			originFile_o.show();
			originName_o.html(fileName);

		} else {
			originFile_o.hide();
			originName_o.html("");
		}

		root.querySelector("#sr_File1").value = "";
	};

	// 학교 영역 그리기
	var _drawInitSchArea = function(region_s, _callback){

		var select_o = root.querySelector("#rg_city");
		for(var i=1; i<_SI_LIST.length; i++) {
			var item = _SI_LIST[i];
			_drawSelectList(select_o, item);
		}

		if(!region_s){
			si = select_o.value;
		}


		var url_v = "/_api/community.api.asp";
		var data_v = "cmd=GET_REGION_LIST&si="+si;
		comm.send(url_v, data_v, "get", function(rData){
			var rList = rData.list;
			var rd_o = root.querySelector("#rg_dist");
			var region_v = rList[0].rg_District.trim();
			rd_o.innerHTML = "";
			for(var i=0; i<rList.length; i++) {
				var rItem = rList[i];
				_drawSelectList(rd_o, rItem);
			}

			if(region_s) {
				region_v = region_s;
			}

			data_v = "cmd=GET_SCHOOL_LIST&si="+si+"&region="+region_v+"&site_id="+siteId;

			comm.send(url_v, data_v, "get", function(sData){
				var sList = sData.list;
				var rs_o = root.querySelector("#rg_school");

				rs_o.innerHTML = "";
				for(var i=0; i<sList.length; i++) {
					var sItem = sList[i];
					_drawSelectList(rs_o, sItem);
				}

				if(_callback) {
					if(typeof(_callback) == "function"){
						_callback();
					}
					return;
				}
			});
		});
	};

	// 일 그리기
	var _drawDay = function(day_o){
		if(!currentYear) {
			currentYear = new Date().getFullYear();
		}

		if(!currentMonth) {
			currentMonth = 1;
		}

		var lastDay = (new Date(currentYear, currentMonth, 0)).getDate();
		day_o.innerHTML = "<option value=''>일 선택</option>";

		for(var i=0; i<lastDay; i++) {
			var option_o = document.createElement("option");
			option_o.innerHTML = (i+1)+"일";
			option_o.value = (i+1);
			day_o.appendChild(option_o);
		}
	};

	// 년도 그리기
	var _drawYear = function(){
		if(!currentYear) {
			currentYear = new Date().getFullYear();
		}

		var year_o = root.querySelector("#zb_Exam_Year");
		year_o.innerHTML = "<option value=''>년도 선택</option>";

		for(var i=0; i<5; i++) {
			var year = currentYear - i;
			var option_o = document.createElement("option");
			option_o.value = year;
			option_o.innerHTML = year + "년";
			year_o.appendChild(option_o);
		}
	};

	// 이벤트 초기화
	var _initEvent = function() {
		if(root) {

			var selector_str = "[data-src='" + _id + "'][data-act]";

			$(root).find(selector_str).unbind();
			$(root).find(selector_str).bind("click", function() {return false;});
			$(root).find(selector_str).bind("click", function(ev) {_click(ev);});

			$(root).find(selector_str).bind("change", function() { return false;});
			$(root).find(selector_str).bind("change", function(ev) { _change(ev);});

			selector_str = "[data-src='" + _id + "_change'][data-act]";

			$(root).find(selector_str).bind("change", function() { return false;});
			$(root).find(selector_str).bind("change", function(ev) { _change(ev);});

			// 파일 변경 이벤트
			var fo = root.querySelector("#sr_File1");
			$(fo).unbind();
			$(fo).bind("change", function(ev) {
				var file_v = fo.value;
				var addFile_o = $(root).find(".addFile");
				var fn = addFile_o.find("a");
				if (_checkFile(fo, file_v, fn)) {
					var filename_v = file_v.substring( file_v.lastIndexOf("\\") + 1 );
					fn.html(filename_v);
					fn.show();
					addFile_o.show();
				} else {
					addFile_o.hide();
				}
			});

			var cmContentLen_o = $(root).find("#cmContentLen");
			var content_o = root.querySelector("#contentText");
			var maxLength = content_o.getAttribute("data-len");

			// 글자수 체크
			$(root).find("[data-divLen]").unbind();
			$(root).find("[data-divLen]").bind("keydown", function(ee) {
				var ev = window.event || ee;
				var evo = ev.srcElement || ev.target;
				evo = util.findObjectByAttr(evo, "data-divLen", null);
				if(evo) {
					var max_len = evo.getAttribute("data-divLen");
					var info_id_v = evo.getAttribute("data-info");
					var info_o = root.querySelector("#" + info_id_v);
					var v_v = $(evo).text();
					_hLog("len=" + v_v.length + ", " + max_len + ", keycode=" + ee.keyCode);
					if(v_v.length >= max_len) {
						if(ee.keyCode >= 48) {
							return false;
						}
					}
					_hLog("info_o=" + info_o);
					if(info_o) {
						window.setTimeout(function(ev) {
							info_o.innerHTML = $(evo).text().length;
						}, 200);
					}
				}
			});

			// 글자수 체크
			$(root).find("[data-divLen]").bind("keyup", function(ee) {
				var ev = window.event || ee;
				var evo = ev.srcElement || ev.target;
				evo = util.findObjectByAttr(evo, "data-divLen", null);
				if(evo) {
					var max_len = evo.getAttribute("data-divLen");
					var info_id_v = evo.getAttribute("data-info");
					var info_o = root.querySelector("#" + info_id_v);
					var v_v = $(evo).text();
					if(v_v.length > max_len){
						$(evo).text(v_v.substr(0, max_len));
					}
					if(info_o) {
						window.setTimeout(function(ev) {
							info_o.innerHTML = $(evo).text().length;
						}, 200);
					}
				}
			});

			common.init();

			selector_str = "[name='zb_Grade']";
			$(root).find(selector_str).bind("change", function(ev){
				var evo = ev.target;
				var d_value = evo.getAttribute("data-value");
				if(_boardKind == 3) {
					var row_o = root.querySelector(".test-range .row");
					row_o.innerHTML = "<h2>시험범위</h2><p class='mT15' style='margin-bottom: 20px;'><a href='#' class='btn btn-l btn-full btn-blueLine btn-square' data-src='community_w' data-act='addSubject'>과목추가</a></p>";
					_getSubjectItems();
					_initEvent();
				}
			});

			selector_str = "[data-target='exam_subject']";
			$(root).find(selector_str).bind("change", function(ev){
				var evo = ev.target;
				var parent_o = util.findObjectByAttr(evo, "class", "blockWhite");
				if(parent_o){
					var input_o = $(parent_o).find("input");
					var select_o = $(parent_o).find("select");
					if(evo.value != "") {
						for(var i=0; i<select_o.length; i++){
							select_o[i].setAttribute("data-req", true);
						}
						isChanged = true;
						isChangedLength++;
						var objs_o = root.querySelectorAll(".blockWhite.mT20");

						for(var j=0; j<objs_o.length; j++) {
							var obj_o = objs_o[j];
							var selects_o = obj_o.querySelectorAll("select[data-target='exam_subject']:not([name^="+evo.name+"])");

							selects_o.forEach(function(item, index){
								if(item.value == evo.value) {
									common.alert("알림", "동일한 교과목은 선택하실수 없습니다.", null, function(){
										evo.selectedIndex = 0;
									});
								}
							});
						}
					} else {
						isChangedLength--;
						for(var i=0; i<select_o.length; i++){
							select_o[i].removeAttribute("data-req");
						}
						if(isChangedLength == 0) {
							isChanged = false;
						}
					}

					for(var i=0; i<input_o.length; i++){
						if(evo.value != "") {
							input_o[i].setAttribute("data-req", true);
							isChanged = true;
							isChangedLength++;
							subjectItems.forEach(function(item, index){
								if(item.Name == evo.value) {
									txItems = item.TX_CODE;
									var txcode_o = parent_o.querySelector("[data-target='exam_txcode']");
									txcode_o.innerHTML = "<option value=''>교과서</option>";
									for(var j=0; j<txItems.length; j++) {
										var option_o = document.createElement("option");
										option_o.value = txItems[j].Name;
										option_o.innerHTML = txItems[j].Name;
										option_o.setAttribute("data-index", index+j);
										txcode_o.appendChild(option_o);
									}
									return;
								}
							});
						} else {
							isChangedLength--;
							input_o[i].removeAttribute("data-req");
							if(isChangedLength == 0) {
								isChanged = false;
							}
						}
					}
				}
			});

			selector_str = "[data-target]";
			$(root).find(selector_str).bind("change", function(ev){
				var evo = ev.target;
				var parent_o = util.findObjectByAttr(evo, "class", "blockWhite");
				if(parent_o){
					var input_o = $(parent_o).find("input");
					var select_o = $(parent_o).find("select");

					for(var i=0; i<input_o.length; i++) {
						if(evo.value != "") {
							input_o[i].setAttribute("data-req", true);
							isChangedLength++;
							isChanged = true;
						} else {
							isChangedLength--;
							input_o[i].removeAttribute("data-req");
							if(isChangedLength == 0) {
								isChanged = false;
							}
						}
					}

					for(var i=0; i<select_o.length; i++) {
						if(evo.value != "") {
							select_o[i].setAttribute("data-req", true);
							isChangedLength++;
							isChanged = true;
						} else {
							isChangedLength--;
							select_o[i].removeAttribute("data-req");
							if(isChangedLength == 0) {
								isChanged = false;
							}
						}
					}
				}
			});

			selector_str = "[data-target='exam_page_start'], [data-target='exam_page_end']";
			$(root).find(selector_str).bind("input", function(ev){
				var evo = ev.target;

				if(!_h.valid.isNumber(evo.value)) {
					if(evo.value.length > 0) {
						evo.value = evo.value.substring(0, evo.value.length-1);
					} else {
						evo.value = "";
					}
				}
			});
		}
	};

	// 등록 파일 체크
	var _checkFile = function(fo_o, file_v, fn_o){

		var fileName = file_v.substring(file_v.lastIndexOf("\\")+1);

		var fileExt = fileName.substring(fileName.lastIndexOf(".")+1, fileName.length).toUpperCase();

		var allowFileExt = [];

		switch(_boardKind) {
			case 1:
				allowFileExt.push("HWP", "PDF", "JPG", "JPEG", "GIF", "PNG");
				break;
			case 2:
				allowFileExt.push("HWP", "PDF", "JPG", "JPEG");
				break;
			case 3:
				allowFileExt.push("HWP", "DOC", "DOCX", "JPG", "JPEG", "GIF", "PNG");
				break;
			case 4:
				allowFileExt.push("HWP", "DOC", "DOCX", "JPG", "JPEG", "GIF", "PNG", "PDF", "ZIP");
				break;
			default:
				allowFileExt.push("HWP", "DOC", "JPG", "GIF", "PNG");
		}

		var isAllowFile = allowFileExt.includes(fileExt);

		if(!isAllowFile) {
			fo_o.value = null;
			common.alert("알림", allowFileExt.join(", ") + " 형식만 등록가능합니다.", null, function(){
				$(fn_o).find(".name").html("");
			});
			return false;
		}

		return true;
	};

	// 카테고리별 글쓰기 화면 설정
	var _loadData = function() {

		var filterBlock_o = root.querySelector(".filterBlock.row");

		var contentImg_o = $(".contentImg");
		var mT35_o = $(".test-range .mT35");

		var title_o = $(".title");
		if(title_o){
			title_o.css("display", "");
		}
		
		var mentor_o = $(".mentor");
		if(mentor_o){
			mentor_o.css("display", "none");
		}
		
		var imgFile_o = $(".imageFile");
		if(imgFile_o){
			if (_boardKind == "1") {
				imgFile_o.css("display", "none");
				contentImg_o.css("display", "none");
				mT35_o.css("display", "none");
			} else {
				imgFile_o.css("display", "");
				contentImg_o.css("display", "");
				mT35_o.css("display", "");
			}
		}

		if(imgFile_o){
			if (_boardKind == "1") {
				imgFile_o.css("display", "none");
				contentImg_o.css("display", "none");
			} else {
				imgFile_o.css("display", "");
				contentImg_o.css("display", "");
			}
		}

		var file_o = $(".attachFile");
		if(file_o){
			file_o.css("display", "");
		}

		var bottomCon_o = $(".bottomCon");
		if(bottomCon_o){
			bottomCon_o.css("display", "");
		}

		var school_o = root.querySelector(".school");
		if(school_o){
			school_o.style.display = "none";
		}

		var grade_o = root.querySelector(".grade");
		if(grade_o){
			grade_o.style.display = "none";
		}

		var season_o = root.querySelector(".season");
		if(season_o){
			season_o.style.display = "none";
		}

		var examyn_o = root.querySelector(".examyn");
		if(examyn_o){
			examyn_o.style.display = "none";
		}

		var dateRange_o = root.querySelector(".dateRange");
		if(dateRange_o) {
			dateRange_o.style.display = "none";
		}

		var testRange_o = root.querySelector(".test-range");
		if(testRange_o){
			testRange_o.style.display = "none";
		}

		var checkFull_o = root.querySelector(".checkFull");
		if(checkFull_o){
			checkFull_o.style.display = "none";
		}

		var unit_o = root.querySelector(".unit");
		if(unit_o){
			unit_o.style.display = "none";
		}

		var space_o = root.querySelector(".space");
		if(space_o){
			space_o.style.display = "none";
		}

		// 알려드립니다 초기화
		var score_d_o = $(root).find("dd.score_d");
		if(score_d_o){
			score_d_o.css("display", "none");
		}

		var problem_d_o = $(root).find("dd.problem_d");
		if(problem_d_o){
			problem_d_o.css("display", "none");
		}

		var exam_d_o = $(root).find("dd.exam_d");
		if(exam_d_o){
			exam_d_o.css("display", "none");
		}

		var mentor_d_o = $(root).find("dd.mento_d");
		if(mentor_d_o){
			mentor_d_o.css("display", "none");
		}

		var title_o = root.querySelector(".title");
		if(title_o){
			title_o.style.display = "none";
		}

		var contentImg_o = root.querySelector(".contentImg");

		var conWrite_o = root.querySelector(".testConWrite > .row");

		var imageIn_o = root.querySelector(".photoAdd.file");

		_hLog(_boardKind);

		if (_boardKind == 1 ) {
			// 성적이 올랐어요
			if(checkFull_o){
				checkFull_o.style.display = "";
			}

			if(score_d_o){
				score_d_o.css("display", "");
			}

			if(title_o){
				title_o.style.display = "";
			}

 			conWrite_o.insertBefore(title_o, contentImg_o);

		} else if (_boardKind == 2) {
			// 이문제 풀어주세요
			filterBlock_o.appendChild(grade_o);
			filterBlock_o.appendChild(unit_o);


			if(title_o){
				title_o.style.display = "none";
			}

			if(grade_o){
				grade_o.style.display = "";
			}

			if(unit_o){
				unit_o.style.display = "";
			}

			if(problem_d_o){
				problem_d_o.css("display", "");
			}

			if(imageIn_o) {
				imageIn_o.remove();
			}

			if(contentImg_o){
				contentImg_o.style.display = "none";
			}

			if(imgFile_o){
				imgFile_o.css("display", "none");
			}

			if(file_o) {
				file_o.css("display", "");
			}

		}
		else if(_boardKind == 3) {
			// 우리학교 시험 정보
			if(school_o){
				school_o.style.display = "";
			}

			if(grade_o){
				grade_o.style = "";
			}

			if(season_o){
				season_o.style = "";
			}

			if(examyn_o){
				examyn_o.style = "";
			}

			if(dateRange_o){
				dateRange_o.style.display = "";
			}

			if(testRange_o){
				testRange_o.style = "";
			}

			if(space_o){
				space_o.style.display = "none";
			}

			if(title_o){
				title_o.style.display = "none";
			}

			if(exam_d_o){
				exam_d_o.eq(1).css("display", "");
			}

			filterBlock_o.appendChild(school_o);
			filterBlock_o.appendChild(grade_o);
			filterBlock_o.appendChild(season_o);
			filterBlock_o.appendChild(examyn_o);
			filterBlock_o.appendChild(dateRange_o);

			var testContWrite_o = root.querySelector(".testConWrite");
			$(testRange_o).insertBefore(testContWrite_o);

			if(imageIn_o) {
				imageIn_o.remove();
			}

			if(contentImg_o){
				contentImg_o.style.display = "none";
			}

			if(imgFile_o){
				imgFile_o.css("display", "none");
			}

		}
		else if(_boardKind == 4) {			
			/*
			// 등록 시 숨김 처리
			if(mentor_o) {
				mentor_o.eq(0).css("display", "");
			}
			*/		
			
			mentor_d_o.css("display", "");

			filterBlock_o.appendChild(mentor_o[0]);
			// filterBlock_o.appendChild(mentor_o[1]);

			if(title_o){
				title_o.style.display = "";
			}

			conWrite_o.insertBefore(title_o, contentImg_o);
		}

		else if(_boardKind == 5) {
			// 우리는 말한다
			if(filterBlock_o) {
				filterBlock_o.remove();
			}

			if(space_o) {
				space_o.remove();
			}

			if(title_o){
				title_o.remove();
			}

			if(contentImg_o){
				contentImg_o.remove();
			}

			if(imgFile_o){
				imgFile_o.remove();
			}

			if(file_o) {
				file_o.remove();
			}
			if(bottomCon_o) {
				bottomCon_o.remove();
			}

			if(imageIn_o) {
				imageIn_o.remove();
			}

			conWrite_o.parentNode.style.paddingTop = "0px";
		}
	};

	// 글쓰기 폼 초기화
	var _initForm = function(item) {
		var f = root.querySelector("#wForm");
		if(item) {
			f.zb_No.value = item.zb_No;
		}
		else {
			f.reset();
			f.querySelector(".photoList.fileName1").style.display = "none";
			f.querySelector(".photoList.addFile").style.display = "none";
			f.querySelector("#contentText").innerHTML = "";

			var num_form = $(f).find(".character").find("b");

			if(num_form){
				num_form.html(0);
			}

			var msg_form = $(f).find(".formMsg");
			if(msg_form){
				msg_form.hide();
			}
		}

		if(_boardKind == 3) {
			var row_o = root.querySelector(".test-range .row");
			row_o.innerHTML = "<h2>시험범위</h2><p class='mT15'><a href='#' class='btn btn-l btn-full btn-blueLine btn-square' data-src='community_w' data-act='addSubject'>과목추가</a></p>";
		}
	};

	// 학교 셀렉트박스 그리기
	var _drawSelectList = function(select_o, item){
		var option_o = document.createElement("option");
		if(item.Name) {
			option_o.innerHTML = item.Name;
			option_o.value = item.Name;
		} else if (item.rg_District){
			region = item.rg_District.trim();
			option_o.innerHTML = region;
			option_o.value = region;
		} else if (item.Scl_Name) {
			option_o.innerHTML = item.Scl_Name;
			option_o.value = item.Scl_ID;
		}

		select_o.appendChild(option_o);
	};

	// 기타 과목 그리기
	var _createEtcSubject_old = function(){

		var at_o = root.querySelectorAll(".addTestRange");

		var len = at_o.length;
		var count = len+1;

		var div_o = document.createElement("div");
		div_o.className = "addTestRange";

		var row_o = document.createElement("div");
		row_o.className = "row";

		var p_o = document.createElement("p");
		var input_o = document.createElement("input");
		input_o.placeholder = "과목명을 입력해주세요";
		input_o.type = "text";
		input_o.name = "zb_Etc"+count+"_Item";
		input_o.setAttribute("data-len", "10");
		input_o.setAttribute("data-info", "zb_ItemInfo"+count);
		p_o.appendChild(input_o);
		row_o.appendChild(p_o);

		p_o = document.createElement("p");
		p_o.className = "character";
		var b_o = document.createElement("b");
		b_o.id = "zb_ItemInfo"+count;
		b_o.innerHTML = 0;
		p_o.appendChild(b_o);
		p_o.innerHTML += " / 10";
		row_o.appendChild(p_o);

		p_o = document.createElement("p");
		var input_o = document.createElement("input");
		input_o.placeholder = "시험범위를 입력해주세요";
		input_o.type = "text";
		input_o.name = "zb_Etc"+count+"_Value";
		input_o.setAttribute("data-len", "30");
		input_o.setAttribute("data-info", "zb_ValueInfo"+count);
		p_o.appendChild(input_o);
		row_o.appendChild(p_o);

		p_o = document.createElement("p");
		p_o.className = "character";
		var b_o = document.createElement("b");
		b_o.id = "zb_ValueInfo"+count;
		b_o.innerHTML = 0;
		p_o.appendChild(b_o);
		p_o.innerHTML += " / 30";
		row_o.appendChild(p_o);

		p_o = document.createElement("p");
		p_o.className = "del";

		var b_o = document.createElement("button");
		b_o.type = "button";
		b_o.innerHTML = "<img src='../img/ico_delect_repple.png' width='11' alt=''>";
		$(b_o).unbind();
		$(b_o).bind("click", function() {return false;});
		$(b_o).bind("click", function(ev){
			var parent_o = b_o.parentNode.parentNode;
			parent_o.remove();
			var as_o = root.querySelector("[data-act=addSubject]");
			as_o.className = as_o.className.replace(" disabled" , "");
		});
		p_o.appendChild(b_o);

		div_o.appendChild(row_o);
		div_o.appendChild(p_o);
		var form_o = root.querySelector("#wForm");
		var space_o = form_o.querySelector(".space");

		form_o.insertBefore(div_o, space_o);

		return at_o;

	};

	// 개정 후 추가 과목 그리기
	var _createEtcSubject = function(){
		var row_o = root.querySelector(".test-range .row");

		var bwLen = row_o.querySelectorAll(".blockWhite").length;

		var remainSubject = subjectItems.slice();

		remainSubject.splice(0, 5);

		var index = bwLen+1;

		var blockWhite_o = document.createElement("div");
		blockWhite_o.className = "blockWhite mT20";
		blockWhite_o.style = "margin-bottom: 30px";

		var btn_o = document.createElement("button");
		btn_o.setAttribute("data-src", _id);
		btn_o.setAttribute("data-act", "closeSubject");
		btn_o.innerHTML = "<img src='/img/ico_close.png' width='11' alt=''>";

		var p_o = document.createElement("p");
		p_o.className = "closeSubject";
		p_o.appendChild(btn_o);
		blockWhite_o.appendChild(p_o);

		blockWhite_o.innerHTML += "</h3>과목</h3>";

		var div_o2 = document.createElement("div");
		div_o2.className = "clearfix mT5";
		var select_o = document.createElement("select");
		select_o.name = "exam_subject"+index;
		select_o.id = "exam_subject";
		select_o.className = "select";
		select_o.style.height = "48px";
		select_o.innerHTML = "<option value=''>과목</option>"
		select_o.setAttribute("data-src", _id);
		select_o.setAttribute("data-act", "subjectChange");
		select_o.setAttribute("data-target", "exam_subject");
		for(var i=0; i<remainSubject.length; i++) {
			var subject = remainSubject[i];
			var option_o = document.createElement("option");
			option_o.value = subject.Name;
			option_o.innerHTML = subject.Name;
			option_o.setAttribute("data-index", bwLen+i);
			select_o.appendChild(option_o);
		}
		div_o2.appendChild(select_o);
		div_o2.innerHTML += "<p data-form='exam_subject"+index+"' class='formMsg fL' style='display:none;'>과목은 필수입니다.</p>";
		blockWhite_o.appendChild(div_o2);

		blockWhite_o.innerHTML += "<h3 class='mT25'>출판사</h3>";
		div_o2 = document.createElement("div");
		div_o2.className = "clearfix mT5";
		var select_o = document.createElement("select");
		select_o.name = "exam_txcode"+index;
		select_o.id = "exam_txcode";
		select_o.className = "select";
		select_o.style.height = "48px";
		select_o.innerHTML = "<option value= ''>교과서</option>";
		select_o.setAttribute("data-target", "exam_txcode");
		div_o2.appendChild(select_o);
		div_o2.innerHTML += "<p data-form='exam_txcode"+index+"' class='formMsg fL' style='display:none;'>교과서는 필수입니다.</p>"
		blockWhite_o.appendChild(div_o2);

		blockWhite_o.innerHTML += "<h3 class='mT30'>단원별 시험범위</h3>";
		div_o2 = document.createElement("div");
		div_o2.className = "mT10";
		div_o2.innerHTML = "<input data-target='exam_unit' name='exam_unit"+index+"' type='text' placeholder='단원명 입력' data-info='chapterLen"+index+"' data-len='30'>";
		blockWhite_o.appendChild(div_o2);

		div_o2 = document.createElement("div");
		div_o2.className = "clearfix";
		div_o2.innerHTML += '<p data-form="exam_unit'+index+'" class="formMsg fL" style="display:none;">단원명은 필수입니다.</p>';
		div_o2.innerHTML += '<p class="character fR"><b id="chapterLen'+index+'">0</b> / 30</p>';
		blockWhite_o.appendChild(div_o2);

		blockWhite_o.innerHTML += "<h3 class='mT30'>페이지 시험범위</h3>";
		div_o2 = document.createElement("div");
		div_o2.className = "mT10 pageRange clearfix";

		var div_o3 = document.createElement("div");
		div_o3.className = "range";
		div_o3.innerHTML = "<input data-target='exam_page_start' name='exam_page_start"+index+"' type='text' placeholder='' value=''><span>P</span>";
		div_o2.appendChild(div_o3);

		div_o2.innerHTML += "<em>~</em>";

		var div_o3 = document.createElement("div");
		div_o3.className = "range";
		div_o3.innerHTML = "<input data-target='exam_page_end' name='exam_page_end"+index+"' type='text' placeholder='' value=''><span>P</span>";
		div_o2.appendChild(div_o3);

		blockWhite_o.appendChild(div_o2);
		blockWhite_o.innerHTML += '<p data-form="exam_page_start'+index+'" class="formMsg fL" style="display:none;">시험범위는 필수입니다.</p>';
		blockWhite_o.innerHTML += '<p data-form="exam_page_end'+index+'" class="formMsg fL" style="display:none;">시험범위는 필수입니다.</p>';
		row_o.appendChild(blockWhite_o);

	};

	// 팝업 닫힐때 실행함수
	var _closePopup = function(moveTop){
		$(root).hide();
		$(parent_o).show();

		var parent_id = parent_o.getAttribute("data-id");

		if(parent_id == "main") {
			main.loadMento();
			main.initSlider();
			var fixedMenu_o = document.querySelector(".fixedMenu");
			if(fixedMenu_o) {
				fixedMenu_o.style.display = "";
			}
		} else if(parent_id == "community") {
			community.loadList();
			community.initSlider();
		}

		_initForm();

		if(moveTop){
			window.scrollTo(0, 0);
		} else {
			window.scrollTo(0, scroll);
		}
	};

	var _click = function(ee) {
		var ev = window.event || ee;
		var evo = ev.srcElement || ev.target;
		evo = util.findEventObject(ev, null);
		var act_v = evo.getAttribute("data-act");

		_hLog("act = " +act_v);

		var f = root.querySelector("#wForm");

		var url_v = "/_api/community.api.asp";

		if(act_v == "back") {
			history.back();
		}
		// 글쓰기
		else if(act_v == "submit") {
			if(_boardKind == "4") {
				trkCLS.setExternalEvent("SQBWZXAPR8GOD641Y12O2YEM220241203", "");
			}

			// 수정 체크
			if(isEdit) {
				f.querySelector("[name=flag]").value = 1;
			}

			if(_boardKind == 3) {
				$.ajax({
					url: '/Community/ajax/getComOurSchool_WriteCnt_Ajax.asp',
					data: {
					},
					error: function(request, status, error) {
						alert('code:' + request.status + '\n' + 'message:' + request.responseText + '\n' + 'error:' + error);
					},
					success: function(data) {
						if(data > 4) {
							alert("하루 5번까지 등록 가능합니다.");
							location.reload();
							return;
						}
					}
				});

				//return;

				// 시험 시행여부는...
				examyn = $("input:radio[name=zb_examyn]:checked").val();
				if(examyn == "Y") {

					// 시험 시작일 체크
					var isSelected1 = true;
					var testStartDate_o = root.querySelector("[name=testStartDate]");
					var selects_o = testStartDate_o.querySelectorAll("select");
					selects_o.forEach(function(item){
						if(!item.value) {
							isSelected1 = false;
							return;
						}
					});

					var testStartDate_m = root.querySelector("[data-form=testStartDate]");
					if(!isSelected1) {
						testStartDate_m.style.display = "";
						return;
					} else {
						testStartDate_m.style.display = "none";
					}

					// 시험 종료일 체크
					var isSelected2 = true;
					var testEndDate_o = root.querySelector("[name=testEndDate]");
					var selects_o2 = testEndDate_o.querySelectorAll("select");
					selects_o2.forEach(function(item){
						if(!item.value) {
							isSelected2 = false;
							return;
						}
					});
					var testEndDate_m = root.querySelector("[data-form=testEndDate]");
					if(!isSelected2) {
						testEndDate_m.style.display = "";
						return;
					} else {
						testEndDate_m.style.display = "none";
					}

					if(isChanged == false) {
						common.alert("알림","최소 한과목 이상의<br/>시험범위는 입력해 주세요.", null, function(){
						});
						return;
					}

				}
			}

			if(_boardKind == "4" && $j("#zb_Title").val() == "") {
				common.alert("알림", "제목을 입력해주세요.", null, function(){});				
				return;
			} else {
				if(_h.form.checkValid(f)) {	
					var data_v = "";
					var cmd = "WRITEB";
					var encType = "multipart/form-data";
					var contentType = false;
					var processData = true;
					var url_v = "/Community/write_b.asp";

					var content_o = $("#contentText");
					var maxLength = parseInt(content_o.attr("data-len"));
					var contentLen_o = $(root).find("#cmContentLen");
					var contentLen = parseInt(contentLen_o.text());
					var contentMsg_o = $(root).find("[data-form='Content']");

					//우리학교 시험정보에 시행, 미시행 구분 추가에 따라 내용 입력 체크 분기 처리 .
					if((_boardKind == 3 && examyn == "Y") || (_boardKind != 3 && _boardKind != 4)) {
						if (contentLen == 0) {
							contentMsg_o.show();
							return;
						} else {
							contentMsg_o.hide();
						}
					}

					if(content_o.text().replace(/\&nbsp;/g,"").trim().length < 1) {
						common.alert("알림", "내용을 입력해주세요.", null, function(){});
						$("#contentText").text("");
						return;
					}

					if(contentLen >= maxLength) {
						common.alert("알림", "내용은 " + maxLength +"자를 초과할 수 없습니다.", null, function(){});
						return;
					}

					if(_boardKind == 1) {
						var cb_o = root.querySelector("#all-chk");
						if(!($(cb_o).is(":checked"))) {
							common.alert("알림", "홍보 활용에 동의해주세요.", null, function(){
							});
							return;
						}
					}

					// 우리는 말한다만 url이 다름
					if(_boardKind == 5) {
						contentType = "application/x-www-form-urlencoded; charset=UTF-8;";
						encType = null;
						data_v = $(f).serialize()+"&cmd=WRITEC&site_id=M5&mode=C13&boardKind=5";
						url_v = "/_api/community.api.asp";
						data_v += "&Content=" + escape(content_o.html());
					} else {
						processData = false;

						data_v = new FormData(f);
						data_v.append("boardKind", _boardKind);
						data_v.append("cmd", cmd);

						if(_boardKind == 2) {
							//siteId = siteId + 3; 
							// 이 문제 풀어 주세요
							if (siteId == "M") {
								siteId = "M1";
							} else {
								siteId = "H3";
							}						
						} else if(_boardKind == 5) {
							siteId = "M5";
						} else if (_boardKind == 3) {
							var zb_Unit = f.querySelector("[name='zb_Grade']:checked").value;
							data_v.delete("zb_Grade");
							data_v.append("zb_Unit", zb_Unit);


							var objs = f.querySelectorAll(".test-range .blockWhite");

							if(objs && objs.length > 0){

								var subject_v = new Array();
								var txcode_v = new Array();
								var unit_v = new Array();
								var pageStart_v = new Array();
								var pageEnd_v = new Array();

								for(var i=0; i<objs.length; i++) {
									var obj = objs[i];

									var objs_o = obj.querySelectorAll("[data-target]");

									for(var j=0; j<objs_o.length; j++) {
										var obj_o = objs_o[j];
										var target_v = obj_o.getAttribute("data-target");
										var val_v = obj_o.value;

										if(target_v == "exam_subject") {
											var nodeName = obj_o.nodeName;
											if(nodeName == "SELECT") {
												val_v = obj_o.value;
											} else if (nodeName == "P") {
												val_v = obj_o.innerText;
											}
											subject_v.push(val_v);
										} else if (target_v == "exam_txcode") {
											txcode_v.push(val_v);
										} else if (target_v == "exam_unit"){
											//unit_v.push(val_v);
											unit_v.push(val_v.replace(/\,/g, "#_#"));
										} else if (target_v == "exam_page_start") {
											pageStart_v.push(val_v);
										} else if (target_v == "exam_page_end") {
											pageEnd_v.push(val_v);
										}
									}
								}
							}
							subject_v = subject_v.join(",");
							txcode_v = txcode_v.join(",");
							unit_v = unit_v.join(",");
							pageStart_v = pageStart_v.join(",");
							pageEnd_v = pageEnd_v.join(",");

							data_v.set("exam_subject", subject_v);
							data_v.set("exam_txcode", txcode_v);
							data_v.set("exam_unit", unit_v);
							data_v.set("exam_page_start", pageStart_v);
							data_v.set("exam_page_end", pageEnd_v);
						}

						data_v.append("site_id", siteId);

						if(isEdit) {
							data_v.append("zb_No", param.zb_No);
						}

						data_v.append("Content", escape(content_o.html()) );

						for (var pair of data_v.entries()) {
							if(typeof(pair[1]) == "string"){
								data_v.set(pair[0], escape(pair[1]));
							}
						}
					}

					// 등록버튼을 계속 누르면 ajax콜이 계속 날아가유..
					$(".btn_confirm").hide();

					comm.toggleLoading(true);
					$.ajax({
						type: "POST",
						enctype: encType,
						url: url_v,
						data: data_v,
						contentType: contentType,
						processData: processData,
						cache: false,
						timeout: 600000,
						success: function (data) {
							if(data) {
								data = eval("(" + data + ")");

								if(data.result == "0") {

									if(isEdit) {
										data.msg = "수정되었습니다.";
									}

									common.toast(data.msg, function(){
										if(isEdit) {
											sessionStorage.removeItem("communityList")
											document.location.href ="/"+siteId+"/community.asp?&kind="+_boardKind;
										} else {
											_closePopup(true);
											$(".btn_confirm").show();
										}
									});
								}
								else {
									common.toast("알림", data.msg, {}, null);
								}
							} else {

							}
							comm.toggleLoading(false);
						},
						error: function (e) {
							$(".btn_confirm").show();
							comm.toggleLoading(false);
							_hLog("ERROR : ", e);
						}
					});
				}
			}
			return false;
		}
		else if(act_v == "removeFile") {
			// 본문 이미지 첨부 파일 삭제
			var file_o = root.querySelector("#sr_File1");
			file_o.value = "";

			var fa_o = $(root).find(".addFile");
			fa_o.hide();

			var fn_o = $(fa_o).find("a");
			fn_o.html("");
			fn_o.hide();
		}
		else if( act_v == "addSubject") {
			// 과목 추가 버튼 클릭
			_createEtcSubject();

			var at_o = root.querySelectorAll(".blockWhite.mT20");

			if(at_o){
				var len = at_o.length;
				if(len == 4 ) {
					evo.className += " disabled";
					return;
				}
			}

			_initEvent();
		}
		else if (act_v == "popClose") {
			if(_boardKind == "4") {
				trkCLS.setExternalEvent("2OIXNVFCTP5X1613PMRIVWBC120241203", "");
			}

			// 팝업 닫기
			_closePopup(false);
		}
		else if (act_v == "rg_city") {
			// 시 선택
			if(si_selectedIndex) {
				evo.selectedIndex = si_selectedIndex;
			}

		}
		else if (act_v == "rg_dist") {
			// 지역 선택
			common.showSelect(regionList, region_selectedIndex, function(data){
				region = data.Name;
				region_selectedIndex = data.pos;
				evo.querySelector("option").innerHTML = data.Name;

				data_v = "cmd=GET_SCHOOL_LIST&si="+si+"&region="+region+"&site_id="+siteId;

				comm.send(url_v, data_v, "get", function(schData){
					var list = schData.list;
					if(list) {
						schList = new Array();
						for(var i=0; i<list.length; i++) {
							var obj = {};
							obj.Name = list[i].Scl_Name;
							obj.pos = i;
							obj.sclId = list[i].Scl_ID;
							schList.push(obj);
						}
						$("#rg_school").find("option").html(list[0].Scl_Name.trim());
						$("#rg_school").find("option").val(list[0].Scl_ID);
					}
				});
			});
		}
		else if (act_v == "rg_school") {
			// 학교 선택
			common.showSelect(schList, sch_selectedIndex, function(data){
				var option_o = evo.querySelector("option");
				option_o.value = data.sclId;
				school = data.Name;
				sch_selectedIndex = data.pos;
				evo.querySelector("option").innerHTML = data.Name;
			});
		}
		else if(act_v == "deleteFile"){
			// 첨부 파일 삭제
			var po = evo.parentElement;
			var name_o = po.querySelector(".name");
			name_o.innerHTML = "";

			var go = po.parentElement;
			go.style.display = "none";

			var target = evo.getAttribute("data-target");
			var input_o = root.querySelector("." + target);
			input_o.value = "";
		}
		else if(act_v == "closeSubject") {
			// 과목추가 영역 삭제
			var parent_o = util.findObjectByAttr(evo, "class", "blockWhite");

			if(parent_o) {
				$(parent_o).remove();
			}
		}
	};

	var _change = function(ee){
		var ev = window.event || ee;
		var evo = ev.srcElement || ev.target;
		evo = util.findEventObject(ev, null);
		var act_v = evo.getAttribute("data-act");
		_hLog("act = " +act_v);

		if(act_v == "year_s") {
			// 년도 변경
			var value = evo.value;
			if(value){
				currentYear = evo.value;
			}
		} else if(act_v == "month_s") {
			// 월 변경
			var value = evo.value;
			if(value){
				currentMonth = evo.value;
			}
			var day_o = root.querySelector("#zb_Exam_S_D");
			_drawDay(day_o);
		} else if (act_v == "month_e") {
			// 일 변경
			var value = evo.value;
			if(value){
				currentMonth = evo.value;
			}
			var day_o = root.querySelector("#zb_Exam_E_D");
			_drawDay(day_o);
		} else if (act_v == "rg_city") {
			// 시 변경
			si_selectedIndex = evo.selectedIndex;

			si = evo.value;

			var data_v = "cmd=GET_REGION_LIST&si="+si;
			comm.send("/_api/community.api.asp", data_v, "get", function(rData){
				var rList = rData.list;
				var rd_o = root.querySelector("#rg_dist");
				var region_v = rList[0].rg_District.trim();
				rd_o.innerHTML = "";
				for(var i=0; i<rList.length; i++) {
					var rItem = rList[i];
					_drawSelectList(rd_o, rItem);
				}
				data_v = "cmd=GET_SCHOOL_LIST&si="+si+"&region="+region_v+"&site_id="+siteId;

				comm.send("/_api/community.api.asp", data_v, "get", function(sData){
					var rs_o = root.querySelector("#rg_school");
					if(sData.retCode || sData.list.length == 0) {
						rs_o.innerHTML = "<option value=''>학교선택</option>";
					} else {
						var sList = sData.list;
						rs_o.innerHTML = "";
						for(var i=0; i<sList.length; i++) {
							var sItem = sList[i];
							_drawSelectList(rs_o, sItem);
						}
					}

				});
			});
		} else if (act_v == "rg_dist") {
			// 지역 변경
			var region_v = evo.value;
			data_v = "cmd=GET_SCHOOL_LIST&si="+si+"&region="+region_v+"&site_id="+siteId;

			comm.send("/_api/community.api.asp", data_v, "get", function(sData){
				var rs_o = root.querySelector("#rg_school");
				if(sData.retCode || sData.list.length == 0) {
					rs_o.innerHTML = "<option value=''>학교선택</option>";
				} else {
					var sList = sData.list;
					rs_o.innerHTML = "";
					for(var i=0; i<sList.length; i++) {
						var sItem = sList[i];
						_drawSelectList(rs_o, sItem);
					}
				}
			});
		}
		else if(act_v == "selectFile"){
			// 본문 이미지 첨부
			var target = evo.getAttribute("data-target");
			var file_v = evo.value;
			var fileName_o = root.querySelector("." + target);
			if(_checkFile(evo, file_v, fileName_o)){
				var filename_v = file_v.substring( file_v.lastIndexOf("\\") + 1 );
				$(fileName_o).find(".name").html(filename_v);
				fileName_o.style.display = "";
			}
		}
		else if(act_v == "subjectChange") {
			// 과목 변경
			var parent_o = util.findObjectByAttr(evo, "class", "blockWhite");

			var txCode_o = parent_o.querySelector("[data-target='exam_txcode']");
			txCode_o.innerHTML = "<option value=''>교과서</option>";

			var option_o = $(evo).find("option:selected");
			var option_v = option_o.val();

			if(option_o && option_v){
				var index_v = option_o.attr("data-index");

				txItems = subjectItems[index_v].TX_CODE;

				for(var i=0; i<txItems.length; i++) {
					var txOption_o = document.createElement("option");
					txOption_o.value = txItems[i].Name;
					txOption_o.innerHTML = txItems[i].Name;
					txCode_o.appendChild(txOption_o);
				}
			}
		}
	}

	return {
		init:function() {
			_init();
		},

		show: function(boardKind, _parent_o, scroll_p){
			_boardKind = boardKind;
			parent_o = _parent_o;
			scroll = scroll_p;
			_init();
		}
	};
}();

