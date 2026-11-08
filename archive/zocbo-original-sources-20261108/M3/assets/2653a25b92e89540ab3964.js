var filter = function(){
	var _id = "filter";
	var root = null;
	var parent_id = null;
	var _callback = null;

	var _kind_p = null;
	var siList = null;
	var guList = null;
	var schList = null;
	var siIndex = 1;
	var guIndex = 0;
	var schIndex = 0;
	var siteID = null;

	var _init = function() {
		root = document.querySelector("[data-id='" + _id + "']");
		_initEvent();
		$(root).css("padding-top", "0px");
	};

	var _initEvent = function() {
		var selector_str = "[data-src='" + _id + "'][data-act]";
		$(root).find(selector_str).unbind();
		$(root).find(selector_str).bind("click", function() { return false;});
		$(root).find(selector_str).bind("click", function(ev) {_click(ev);});

		selector_str = "[data-src='" + _id + "Change'][data-act]";
		$(root).find(selector_str).unbind();
		$(root).find(selector_str).bind("change", function() { return false;});
		$(root).find(selector_str).bind("change", function(ev) {_change(ev);});

	};

	var _click = function(ee) {
		var ev = window.event || ee;
		var evo = ev.srcElement || ev.target;
		evo = util.findObjectByAttr(evo, "data-act", null);
		var act_v = evo.getAttribute("data-act");
		_hLog(_id + " act=" + act_v);

		var id_o = document.querySelector("[data-id='" + parent_id + "']");
		if(id_o == null) return;

		// 팝업 닫기
		if(act_v == "close") {
			id_o.style.display = "";
			root.style.display = "none";
			community.initSlider();
		}
		// 적용 버튼
		else if(act_v == "ok") {
			if(typeof(_callback) == "function" ) {
				var f = root.querySelector("#popupFilter");
				if(_kind_p == "exam"){
					var allChk_o = root.querySelector("#all-chk");
					if($(allChk_o).prop("checked") == true){
						var si_o = f.querySelector("#filter_si");
						si_o.name = "";

						var gu_o = f.querySelector("#filter_gu");
						gu_o.name = "";

						var sch_o = f.querySelector("#filter_sch");
						sch_o.name = "";

						var schName_o = f.querySelector("#filter_schName");
						schName_o.name = "";
					}
					else{
						var searchText_o = f.querySelector("[name='searchText']");
						searchText_o.name = "";
					}
				}

				var rparam = $(f).serializeArray();
				_hLog(rparam);
				_hLog("filter param=" + rparam);
				_callback(rparam);
			}
			id_o.style.display = "";
			root.style.display = "none";
		}
		else if(act_v == "allCheck"){
			var isAllCheck = $(evo).find(".check").prop("checked");
			if(isAllCheck){
				$(evo).find(".check").prop("checked", false);
				$(root).find(".checkFilter").prop("disabled", false);
			}
			else{
				$(evo).find(".check").prop("checked", true);
				$(root).find(".checkFilter").prop("disabled", true);
			}
		}
	};

	var _change = function(ee){
		var ev = window.event || ee;
		var evo = ev.srcElement || ev.target;
		evo = util.findObjectByAttr(evo, "data-act", null);
		var act_v = evo.getAttribute("data-act");
		_hLog(_id + " act=" + act_v);

		var id_o = document.querySelector("[data-id='" + parent_id + "']");
		if(id_o == null) return;

		// 도시 선택
		if(act_v == "changeSi"){
			siIndex = evo.selectedIndex + 1;
			guIndex = 0;
			schIndex = 0;
			_getGuForFilter();
		}
		// 지역 선택
		else if(act_v == "changeGu"){
			guIndex = evo.selectedIndex;
			schIndex = 0;
			_getSchForFilter();
		}
		// 학교 선택
		else if(act_v == "changeSch"){
			var sch_o = root.querySelector("#filter_sch");
			schIndex = sch_o.selectedIndex;

			var schName_o = root.querySelector("#filter_schName");
			schName_o.value = schList[schIndex].Scl_Name;
		}
	};

	/*
		data_p = {"search":""}
	*/
	// 필터 팝업
	var _showFilter = function(data_id_p, kind_p, draw_p, data_p, callback_p) {
		_kind_p = kind_p;
		_callback = callback_p;
		parent_id = data_id_p;

		var initdata = util.JsonConvert(data_p);
		var block_o = root.querySelector(".filterBlock");
		if(block_o == null) return;
		var id_o = document.querySelector("[data-id='" + data_id_p + "']");
		if(id_o == null) return;
		block_o.innerHTML = "";


		var grades = draw_p.grades;
		var units = draw_p.units;
		var schools = draw_p.schools;
		var seasons = draw_p.seasons;
		var counsels = draw_p.counsels;

		var keyword_title = "키워드 검색";
		var keyword_ph = "검색어를 입력해주세요.";
		var keyword_nm = "keyword";

		if(kind_p == "problem") {	

			keyword_nm = "searchText";
			// 이문제 풀어주세요
			// 학년 과목 키워드 
			if(!grades){
				return;
			}

			var h2_o = document.createElement("h2");
			h2_o.className = "mT30";
			h2_o.innerHTML = "학년";
			block_o.appendChild(h2_o);

			var ul_o = document.createElement("ul");
			ul_o.className = "radioTab tab-num-04 mT10";

			var li_all_o = document.createElement("li");
			{
				var input_all_o = document.createElement("input");
				input_all_o.type = "radio";
				input_all_o.className = "raio-tab";
				input_all_o.name="zb_grade";
				input_all_o.id="year-00";
				input_all_o.value="";
				input_all_o.setAttribute("checked", true);
				li_all_o.appendChild(input_all_o);

				var label_all_o = document.createElement("label");
				label_all_o.setAttribute("for", "year-00");
				label_all_o.innerHTML = "전체";
				li_all_o.appendChild(label_all_o);
			}
			ul_o.appendChild(li_all_o);
			block_o.appendChild(ul_o);

			
			for(var i=0; i<grades.length; i++) {
				var li_o = document.createElement("li");
				var count = i+1;
				// 학년 그리기 
				var input_o = document.createElement("input");
				input_o.type = "radio";
				input_o.className = "raio-tab";
				input_o.name="zb_grade";
				input_o.value= grades[i].value;
				input_o.id="year-0"+count;
				li_o.appendChild(input_o);

				var label_o = document.createElement("label");
				label_o.setAttribute("for", "year-0"+count);
				label_o.innerHTML = grades[i].title;
				li_o.appendChild(label_o);

				ul_o.appendChild(li_o);
			}
			
			block_o.appendChild(ul_o);

			if(!units) {
				return;
			}

			var h2_o = document.createElement("h2");
			h2_o.className = "mT30";
			h2_o.innerHTML = "과목";
			block_o.appendChild(h2_o);

			// 전체 국어 영어
			ul_o = document.createElement("ul");
			ul_o.className = "radioTab tab-num-03 mT10";
			li_all_o = document.createElement("li");
			{
				var input_all_o = document.createElement("input");
				input_all_o.type = "radio";
				input_all_o.className = "raio-tab";
				input_all_o.name="zb_unit";
				input_all_o.setAttribute("checked", "");
				input_all_o.id="subject-00";
				input_all_o.value = "";
				li_all_o.appendChild(input_all_o);

				var label_all_o = document.createElement("label");
				label_all_o.setAttribute("for", "subject-00");
				label_all_o.innerHTML = "전체";
				li_all_o.appendChild(label_all_o);
			}
			ul_o.appendChild(li_all_o);

			for(var i=0; i<units.length; i++) {

				if(i==2) {
					ul_o = document.createElement("ul");
					ul_o.className = "radioTab tab-num-03 mT15";
				}

				if( i== 5) {
					ul_o = document.createElement("ul");
					ul_o.className = "radioTab tab-num-03 mT15";
				}

				var li_o = document.createElement("li");
				var count = i+1;

				var input_o = document.createElement("input");
				input_o.type = "radio";
				input_o.className = "raio-tab";
				input_o.name="zb_unit";
				input_o.value= units[i].value;
				input_o.id="subject-0"+count;
				li_o.appendChild(input_o);

				var label_o = document.createElement("label");
				label_o.setAttribute("for", "subject-0"+count);
				label_o.innerHTML = units[i].title;
				li_o.appendChild(label_o);

				ul_o.appendChild(li_o);
				block_o.appendChild(ul_o);
			}
		} else if (kind_p == "exam") {
			// 우리학교 시험정보
			// 학교 학년 학기 키워드 
			// 학교 리스트 API 필요 

			// 학교 
			// 학년 
			if(draw_p.siList){
				siList = draw_p.siList;
			}
			if(draw_p.siIndex){
				siIndex = draw_p.siIndex;
			}
			if(draw_p.guIndex){
				guIndex = draw_p.guIndex;
			}
			if(draw_p.schIndex){
				schIndex = draw_p.schIndex;
			}
			if(draw_p.siteID){
				siteID = draw_p.siteID;
			}

			keyword_title = "키워드 검색";
			keyword_ph = "검색어을 입력해주세요.";
			keyword_nm = "searchText";

			{
				var p_o = document.createElement("p");
				p_o.className = "checkAll";
				p_o.setAttribute("data-src", "filter");
				p_o.setAttribute("data-act", "allCheck");
				{
					var input_o = document.createElement("input");
					input_o.type = "checkbox";
					input_o.className = "check";
					input_o.id = "all-chk";
					input_o.name = "allCheck";
					if(!initdata.zb_schoolCity || !initdata.zb_schoolDistrict || !initdata.zb_schoolCode){
						input_o.setAttribute("checked", "");	
					}
					input_o.value = ""
					p_o.appendChild(input_o);
				}
				{
					var label_o = document.createElement("label");
					label_o.setAttribute("for", "all-chk");
					label_o.innerHTML = "전체";
					p_o.appendChild(label_o);
				}
				block_o.appendChild(p_o);
			}
			{
				var h2_o = document.createElement("h2");
				h2_o.innerHTML = "학교";
				block_o.appendChild(h2_o);
			}
			{
				var div_o = document.createElement("div");
				div_o.className = "clearefix mT5";
				{
					var select_o = document.createElement("select");
					select_o.className = "select fL checkFilter";
					select_o.id = "filter_si";
					select_o.style.width = "47%";
					select_o.style.height = "48px";
					select_o.name = "zb_schoolCity";
					select_o.setAttribute("data-src", "filterChange");
					select_o.setAttribute("data-act", "changeSi");
					if(initdata.zb_schoolCity == null){
						select_o.setAttribute("disabled", true);	
					}

					for(var i = 1; i < siList.length; i++)
					{
						var option_o = document.createElement("option");
						option_o.innerHTML = siList[i].Name;
						select_o.appendChild(option_o);
					}
					if(initdata.zb_schoolCity){
						select_o.value = initdata.zb_schoolCity;
					}
					div_o.appendChild(select_o);
				}
				{
					var select_o = document.createElement("select");
					select_o.className = "select fR checkFilter";
					select_o.id = "filter_gu";
					select_o.style.width = "47%";
					select_o.style.height = "48px";
					select_o.name = "zb_schoolDistrict";
					select_o.setAttribute("data-src", "filterChange");
					select_o.setAttribute("data-act", "changeGu");
					if(initdata.zb_schoolDistrict == null){
						select_o.setAttribute("disabled", true);	
					}

					{
						var option_o = document.createElement("option");
						option_o.value = "";
						select_o.appendChild(option_o);
					}
					div_o.appendChild(select_o);
				}
				block_o.appendChild(div_o);
			}
			{
				var div_o = document.createElement("div");
				div_o.className = "mT5";
				{
					var select_o = document.createElement("select");
					select_o.className = "select checkFilter";
					select_o.id = "filter_sch";
					select_o.name = "zb_schoolCode";
					select_o.style.height = "48px";
					select_o.setAttribute("data-src", "filterChange");
					select_o.setAttribute("data-act", "changeSch");
					if(initdata.zb_schoolCode == null){
						select_o.setAttribute("disabled", true);	
					}

					{
						var option_o = document.createElement("option");
						option_o.value = "";
						select_o.appendChild(option_o);
					}
					div_o.appendChild(select_o);
				}
				{
					var input_o = document.createElement("input");
					input_o.id = "filter_schName";
					input_o.name = "schoolName";
					input_o.style.display = "none";
					div_o.appendChild(input_o);
				}
				block_o.appendChild(div_o);
			}
			{
				var h2_o = document.createElement("h2");
				h2_o.className = "mT30";
				h2_o.innerHTML = "학년";
				block_o.appendChild(h2_o);
			}
			{
				var unit_v = null;
				if(initdata.zb_unit){
					unit_v = initdata.zb_unit;
				}
				var ul_o = document.createElement("ul");
				ul_o.className = "radioTab tab-num-04 mT10";
				{
					var li_o = document.createElement("li");
					{
						var input_o = document.createElement("input");
						input_o.type = "radio";
						input_o.className = "raio-tab";
						input_o.name = "zb_unit";
						input_o.id = "year-01";
						input_o.value = "";
						if(unit_v == null || unit_v == ""){
							input_o.checked = true;
						}
						li_o.appendChild(input_o);
					}
					{
						var label_o = document.createElement("label");
						label_o.setAttribute("for", "year-01");
						label_o.innerHTML = "전체";
						li_o.appendChild(label_o);
					}
					ul_o.appendChild(li_o);
					var li_o = document.createElement("li");
					{
						var input_o = document.createElement("input");
						input_o.type = "radio";
						input_o.className = "raio-tab";
						input_o.name = "zb_unit";
						input_o.id = "year-02";
						input_o.value = "1";
						if(unit_v == "1"){
							input_o.checked = true;
						}
						li_o.appendChild(input_o);
					}
					{
						var label_o = document.createElement("label");
						label_o.setAttribute("for", "year-02");
						label_o.innerHTML = "1학년";
						li_o.appendChild(label_o);
					}
					ul_o.appendChild(li_o);
					var li_o = document.createElement("li");
					{
						var input_o = document.createElement("input");
						input_o.type = "radio";
						input_o.className = "raio-tab";
						input_o.name = "zb_unit";
						input_o.id = "year-03";
						input_o.value = "2";
						if(unit_v == "2"){
							input_o.checked = true;
						}
						li_o.appendChild(input_o);
					}
					{
						var label_o = document.createElement("label");
						label_o.setAttribute("for", "year-03");
						label_o.innerHTML = "2학년";
						li_o.appendChild(label_o);
					}
					ul_o.appendChild(li_o);
					var li_o = document.createElement("li");
					{
						var input_o = document.createElement("input");
						input_o.type = "radio";
						input_o.className = "raio-tab";
						input_o.name = "zb_unit";
						input_o.id = "year-04";
						input_o.value = "3";
						if(unit_v == "3"){
							input_o.checked = true;
						}
						li_o.appendChild(input_o);
					}
					{
						var label_o = document.createElement("label");
						label_o.setAttribute("for", "year-04");
						label_o.innerHTML = "3학년";
						li_o.appendChild(label_o);
					}
					ul_o.appendChild(li_o);
				}
				block_o.appendChild(ul_o);
			}
			{
				var h2_o = document.createElement("h2");
				h2_o.className = "mT30";
				h2_o.innerHTML = "학기";
				block_o.appendChild(h2_o);
			}
			{
				var branch_v = null;
				if(initdata.zb_branch){
					branch_v = initdata.zb_branch;
				}

				var ul_o = document.createElement("ul");
				ul_o.className = "radioTab tab-num-02 mT10";
				{
					var li_o = document.createElement("li");
					{
						var input_o = document.createElement("input");
						input_o.type = "radio";
						input_o.className = "raio-tab";
						input_o.name = "zb_branch";
						input_o.id = "season-01";
						input_o.value = "";
						if(branch_v == null || branch_v == ""){
							input_o.setAttribute("checked", "");
						}
						li_o.appendChild(input_o);
					}
					{
						var label_o = document.createElement("label");
						label_o.setAttribute("for", "season-01");
						label_o.innerHTML = "전체";
						li_o.appendChild(label_o);
					}
					ul_o.appendChild(li_o);
				}
				{
					var li_o = document.createElement("li");
					{
						var input_o = document.createElement("input");
						input_o.type = "radio";
						input_o.className = "raio-tab";
						input_o.name = "zb_branch";
						input_o.id = "season-02";
						input_o.value = "1M";
						if(branch_v == "1M"){
							input_o.setAttribute("checked", "");
						}
						li_o.appendChild(input_o);
					}
					{
						var label_o = document.createElement("label");
						label_o.setAttribute("for", "season-02");
						label_o.innerHTML = "1학기 중간";
						li_o.appendChild(label_o);
					}
					ul_o.appendChild(li_o);
				}
				block_o.appendChild(ul_o);
			}
			{
				var ul_o = document.createElement("ul");
				ul_o.className = "radioTab tab-num-02 mT15";
				{
					var li_o = document.createElement("li");
					{
						var input_o = document.createElement("input");
						input_o.type = "radio";
						input_o.className = "raio-tab";
						input_o.name = "zb_branch";
						input_o.id = "season-03";
						input_o.value = "1E";
						if(branch_v == "1E"){
							input_o.setAttribute("checked", "");
						}
						li_o.appendChild(input_o);
					}
					{
						var label_o = document.createElement("label");
						label_o.setAttribute("for", "season-03");
						label_o.innerHTML = "1학기 기말";
						li_o.appendChild(label_o);
					}
					ul_o.appendChild(li_o);
				}
				{
					var li_o = document.createElement("li");
					{
						var input_o = document.createElement("input");
						input_o.type = "radio";
						input_o.className = "raio-tab";
						input_o.name = "zb_branch";
						input_o.id = "season-04";
						input_o.value = "2M";
						if(branch_v == "2M"){
							input_o.setAttribute("checked", "");
						}
						li_o.appendChild(input_o);
					}
					{
						var label_o = document.createElement("label");
						label_o.setAttribute("for", "season-04");
						label_o.innerHTML = "2학기 중간";
						li_o.appendChild(label_o);
					}
					ul_o.appendChild(li_o);
				}
				block_o.appendChild(ul_o);
			}
			{
				var ul_o = document.createElement("ul");
				ul_o.className = "radioTab tab-num-02 tab-num-solo mT15";
				{
					var li_o = document.createElement("li");
					{
						var input_o = document.createElement("input");
						input_o.type = "radio";
						input_o.className = "raio-tab";
						input_o.name = "zb_branch";
						input_o.id = "season-05";
						input_o.value = "2E";
						if(branch_v == "2E"){
							input_o.setAttribute("checked", "");
						}
						li_o.appendChild(input_o);
					}
					{
						var label_o = document.createElement("label");
						label_o.setAttribute("for", "season-05");
						label_o.innerHTML = "2학기 기말";
						li_o.appendChild(label_o);
					}
					ul_o.appendChild(li_o);
				}
				block_o.appendChild(ul_o);
			}
		} else if (kind_p == "mento") {
			// 멘토
			// 구분 키워드
			/*
			
			2025-05-20 안씀
			
			if(!counsels) {
				return;
			}

			keyword_nm = "searchText";

			var h2_o = document.createElement("h2");
			h2_o.className = "mT30";
			h2_o.innerHTML = "구분";
			block_o.appendChild(h2_o);

			var ul_o = document.createElement("ul");
			ul_o.className = "radioTab tab-num-02 mT10";

			var li_all_o = document.createElement("li");
			{
				var input_all_o = document.createElement("input");
				input_all_o.type = "radio";
				input_all_o.className = "raio-tab";
				input_all_o.name="searchType";
				input_all_o.id="type-00";
				input_all_o.value = "";
				input_all_o.setAttribute("checked", true);
				li_all_o.appendChild(input_all_o);

				var label_all_o = document.createElement("label");
				label_all_o.setAttribute("for", "type-00");
				label_all_o.innerHTML = "전체";
				li_all_o.appendChild(label_all_o);
			}
			ul_o.appendChild(li_all_o);
			block_o.appendChild(ul_o);

			for(var i=0; i<counsels.length; i++) {
				if(i == 1) {
					ul_o = document.createElement("ul");
					ul_o.className = "radioTab tab-num-02 mT10";
				}

				if ( i == 3 ) {
					ul_o = document.createElement("ul");
					ul_o.className = "radioTab tab-num-02 tab-num-solo mT15"
				}

				var li_o = document.createElement("li");
				var count = i+1;
				// 상담 타입 그리기 
				var input_o = document.createElement("input");
				input_o.type = "radio";
				input_o.className = "raio-tab";
				input_o.name="searchType";
				input_o.value= counsels[i].value;
				input_o.id="type-0"+count;
				li_o.appendChild(input_o);

				var label_o = document.createElement("label");
				label_o.setAttribute("for", "type-0"+count);
				label_o.innerHTML = counsels[i].title;
				li_o.appendChild(label_o);

				ul_o.appendChild(li_o);
				block_o.appendChild(ul_o);
			}
			*/
		}

		{
			// 키워드 
			var h2_o = document.createElement("h2");
			h2_o.className = "mT30";
			h2_o.innerHTML = keyword_title;
			block_o.appendChild(h2_o);

			var div_o = document.createElement("div");
			div_o.className = "mT30";
			block_o.appendChild(div_o);

			var input_o = document.createElement("input");
			input_o.type = "text";
			input_o.name = keyword_nm;
			input_o.setAttribute("placeholder", keyword_ph);
			input_o.setAttribute("data-len", "10");
			input_o.setAttribute("data-info", "popSearchInfo");
			if(initdata.keyword) {
				input_o.value = initdata.keyword;
			}
			div_o.appendChild(input_o);

			var p_o = document.createElement("p");
			p_o.className = "character";
			p_o.innerHTML = "<b id=\"popSearchInfo\">0</b> / 10";

			if (kind_p == "exam") {
				h2_o.style.display = "none";
				input_o.style.display = "none";
				p_o.style.display = "none";
			}

			block_o.appendChild(p_o);
		}

		common.init();
		root.style.display = "";
		// $(block_o).modal('show');
		id_o.style.display = "none";

		root.querySelector(".fixedBtn").style.display = "";

		if(kind_p == "exam"){
			_getGuForFilter(initdata.zb_schoolDistrict, initdata.zb_schoolCode);
		}
	};

	// 지역 조회
	var _getGuForFilter = function(district, schoolCode){
		var url_v = "/_api/community.api.asp";
		var data_v = "cmd=GET_REGION_LIST&si=" + siList[siIndex].Name + "&site_id=" + siteID;
		comm.send(url_v, data_v, "post", function(json) {
			if(json){
				var guItems = json.list;

				if(guItems){
					var select_o = root.querySelector("#filter_gu");
					select_o.innerHTML = "";

					if(guItems.length == 0) {
						var option_o = document.createElement("option");
						option_o.innerHTML = "";
						select_o.appendChild(option_o);
					}
					else {
						guList = guItems;

						var index = 0;
						for(var i = 0; i < guItems.length; i++) {
							_hLog("json=" + gu + ", V=" + guItems[i].rg_District);
							var guItemName = guItems[i].rg_District.trim();
							
							if(district){
								if(district == guItemName){
									index = i;
								}
							}
							else{
								if(guIndex == i){
									index = i;
								}	
							}
							

							var option_o = document.createElement("option");
							option_o.innerHTML = guItemName;
							select_o.appendChild(option_o);
						}

						select_o.selectedIndex = index;

						_getSchForFilter(schoolCode);
					}
				}
			}
		});
	};

	// 학교 조회
	var _getSchForFilter = function(schoolCode){
		var url_v = "/_api/community.api.asp";
		var data_v = "cmd=GET_SCHOOL_LIST&site_id=" + siteID + "&si=" + siList[siIndex].Name;
		data_v = data_v + "&region=" + encodeURI(guList[guIndex].rg_District);
		comm.send(url_v, data_v, "post", function(json) {
			if(json){
				var schItems = json.list;
				if(schItems){
					schList = schItems;

					var select_o = root.querySelector("#filter_sch");
					select_o.innerHTML = "";

					if(schItems.length == 0){
						var option_o = document.createElement("option");
						option_o.innerHTML = "";
						select_o.appendChild(option_o);
					}
					else{
						var index = 0;
						var name = "";
						for(var i = 0; i < schItems.length; i++) {
							_hLog("json=" + gu + ", V=" + schItems[i].Scl_ID);
							var schItem = schItems[i];

							if(schoolCode){
								if(schoolCode == schItems[i].Scl_ID){
									index = i;
									name = schItem.Scl_Name;
								}
							}
							else{
								if(schIndex == i){
									index = i;
									name = schItem.Scl_Name;
								}
							}
							
							var option_o = document.createElement("option");
							option_o.innerHTML = schItem.Scl_Name;
							option_o.value = schItem.Scl_ID;
							select_o.appendChild(option_o);
						}

						select_o.selectedIndex = index;

						var input_o = root.querySelector("#filter_schName");
						input_o.value = name;
					}
				}
			}
		});
	};

	return {
		// init:function() { _init(); },
		showFilter:function(data_id_p, kind_p, draw_p, data_p, callback_p) {
			_init();
			_showFilter(data_id_p, kind_p, draw_p, data_p, callback_p);
			_initEvent();
		}
	}	
}();