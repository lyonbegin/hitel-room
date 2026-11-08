var chapterSelector = function() {
    var _id = "goods_select";
    var root = null;
    var parentRoot = null;
    var paprNo = null;
    var exPaprInfo = null;
    var chapterItems = null;
    var sortItems = null;
    var saveData = null;
    var curScrollY = null;
    var INTERVAL_ID = null;
    var Token = null;
    var START = false;
    var loadingCnt = 0;
	var autoSeq = "";
    var _pRootID = "";
	var _pGubun = "";
	var _pSiteID = "";
	var _pSiteID_K = "";
	var _pmSubj_Code = "";
	var _pSubj_Code = "";
	var _pSubj_Code_K = "";
	var _pGrade = "";
	var _pPreTerm = "";
	var _preTest_Expapr_Group = "X";
	var _preTest_Expapr_CoreType = "X";
	var _pub_Name = "";
	var _tX_Code = "";
	var loadingCheck = false;	
    
    var _init = function(paprNo_p, pRootID, pGubun, pSiteID, pSubj_Code, pGrade, pPreTerm) {
        _hLog("chapterSelector init");
		_pRootID = pRootID;
		_pGubun = pGubun;
		_pSiteID = pSiteID;
		_pmSubj_Code = pSubj_Code;

		$("#fold5").prop("checked", true);
		$("#fold6").prop("checked", false);

		if (pSubj_Code) {
			_pSubj_Code = pSubj_Code.replace('1', '').replace('2', '');
		}

		_pGrade = pGrade;
		_pPreTerm = pPreTerm;
        paprNo = paprNo_p;		

		if (_pSiteID == "M") {
			_pSiteID_K = "중";
		} else {
			_pSiteID_K = "고";
		}		

		if (_pSubj_Code == "KR") {
			if (_pSiteID == "H" && _pGrade == 2) {
				_pSubj_Code_K = "문학"
				if (_pmSubj_Code == "KR1") {
					_pSubj_Code_K = "언어와 매체"
				} else if (_pmSubj_Code == "KR2") {
					_pSubj_Code_K = "독서"
				}
			} else {				
				_pSubj_Code_K = "국어"
			}
		} else if (_pSubj_Code == "EG") {
			if (_pSiteID == "H" && _pGrade == 2) {
				//_pSubj_Code_K = "영어Ⅱ"	
				_pSubj_Code_K = "영어Ⅰ"			
			} else {
				_pSubj_Code_K = "영어"
			}
		} else if (_pSubj_Code == "MT") {
			if (_pSiteID == "H" && _pGrade == 2) {
				_pSubj_Code_K = "수학영역"
			} else {
				_pSubj_Code_K = "수학"
			}
		} else if (_pSubj_Code == "SC") {
			if (_pSiteID == "H" && _pGrade == 1) {
				_pSubj_Code_K = "통합과학"
			} else if (_pSiteID == "H" && _pGrade == 2) {
				_pSubj_Code_K = "과학영역"
			} else {
				_pSubj_Code_K = "과학"
			}
		} else if (_pSubj_Code == "LS") {
			if (_pSiteID == "H" && _pGrade == 1) {
				_pSubj_Code_K = "통합사회"
			} else if (_pSiteID == "H" && _pGrade == 2) {
				_pSubj_Code_K = "사회영역"
			} else if(_pmSubj_Code == "LS1" || (_pSiteID == "M" && _pGrade == 1)) {
				_pSubj_Code_K = "사회①"
			} else {
				_pSubj_Code_K = "사회②"
			}
		} else if (_pSubj_Code == "HI") {
			if (_pSiteID == "H" && _pGrade == 1) {
				_pSubj_Code_K = "한국사"			
			} else if(_pmSubj_Code == "HI1" || (_pSiteID == "M" && _pGrade == 1)) {
				_pSubj_Code_K = "역사①"
			} else {
				_pSubj_Code_K = "역사②"
			}
		}
        root = document.querySelector("#" + _id);		

		// 통합검색 예외처리
		if (document.querySelector("[data-id='search']")) { pRootID = 'search' }

		if(_pGubun == "preparation")
		{
			$(".rangeList .active").removeClass("active");
			_calcSelectItem();
		}

        parentRoot = document.querySelector("[data-id='" + pRootID + "']");
		_initEvent();

        if(root == null) return;
        if(parentRoot == null) return;

		curScrollY = $(document).scrollTop();
        _show();

		if(_pGubun == "preparation")
		{
			$("#"+_id).find(".accountMsg").text("범위를 설정하시면 FINAL모의고사 문제가 추출됩니다.");
			$("#"+_id).find("#txt_Preparation").css("display", "");			
		}

		if (_pGubun == "PreTest") {
			$("#"+_id).find(".popupTitle").text('');

			if (_pPreTerm.substring(_pPreTerm.length - 1, _pPreTerm.length) == "M") {			
				$("#"+_id).find(".accountMsg").text('미리보는 중간고사 기출 예상 시험지 다운로드');
			} else {
				$("#"+_id).find(".accountMsg").text('미리보는 기말고사 다운로드');
				
			}
			$("#"+_id).find(".listTop").css("display","none");

			Hierarchy_Init(pSiteID, _preTest_Expapr_Group, _preTest_Expapr_CoreType)

			if (!loadingCheck) {
				var parentdiv_o = root.querySelector("#contents > .row");
				var p_o = document.createElement("p");
				p_o.innerHTML = "<span id='prePopSubtitle' style='font-size:20px; font-weight:700;'>"+_pSiteID_K+_pGrade+" - "+_pSubj_Code_K+"</span>"
				parentdiv_o.appendChild(p_o);
				var p_o = document.createElement("p");
				p_o.innerHTML = "<sapn id='pretestPopcontent1' style='display:block; margin:10px 0 5px 0; line-height:18px;'>선택한 단원에서 추출한 문제로 구성된 하나의 시험지 파일 형태로 제공됩니다(30문항 내외)</span>"
				parentdiv_o.appendChild(p_o);
				var p_o = document.createElement("p");
				p_o.innerHTML = "<span id='pretestPopcontent2' style='display:block; margin-botoom:10px'>동일 단원 재추출 시 중복 문항이 제공될 수 있습니다.</span>"
				parentdiv_o.appendChild(p_o);
				var p_o = document.createElement("p");
				p_o.innerHTML = "<span id='pretestPopcontent3' style='display:block; margin-botoom:10px; color:red;'>한 번에 많은 단원을 선택하여 추출할 경우 일부 단원의 문항이 제외될 수 있습니다.</span>"
				parentdiv_o.appendChild(p_o);
				loadingCheck = true;
			} else {
				$("#prePopSubtitle").html(_pSiteID_K+_pGrade+" - "+_pSubj_Code_K);
				$("#pretestPopcontent1").css("display", "");
				$("#pretestPopcontent2").css("display", "");
				$("#pretestPopcontent3").css("display", "");
			}

            var objs = root.querySelectorAll(".rangeList .active");
            var btn_o = root.querySelector("[data-act='completeSelect']");
			if(btn_o) {
                btn_o.className = "btn btn-l btn-light-gray btn-square";
				btn_o.innerText = "출제하기";
				$("#preSelectBack").css("display", "");
            } else {
                btn_o.className = "btn btn-l btn-full btn-light-gray btn-square";
				btn_o.innerText = "선택완료";
            }
			_getSaveDataPre(function() {
				_loadData();
			});
		} else {
			window.scrollTo(0,0);

			_getSaveData(function() {
				_loadData();
			});
		}
    };

    var _initEvent = function() {
        var selector_str = "[data-src='" + _id + "'][data-act]";

        $(root).find(selector_str).unbind();
        $(root).find(selector_str).bind("click", function(ev) {
            _click(ev);
        });
    };

    var _show = function() {
        root.style.display = "";
        parentRoot.style.display = "none";
		if (_pGubun == "PreTest") {
			window.scrollTo(0, 0);
		} else {
			curScrollY = sessionStorage.getItem("curScroll");
		}
    };

    var _hide = function() {
        parentRoot.style.display = "";
        root.style.display = "none";
        if(curScrollY) {
			window.scrollTo(0, curScrollY);
			sessionStorage.removeItem("curScroll");
        }
    };

    // 미리보는 xx고사
    var _getSaveDataPre = function(_callback){
		var index = _pGrade == '' ? 0 : _pGrade - 1;
		var Subj_Code = _pmSubj_Code;
		
		for (var i = 0; i < _Hierarchy[index].Subj_Code.length; i++) {
			if (_Hierarchy[index].Subj_Code[i].Value == Subj_Code) {
				if (_Hierarchy[index].Subj_Code[i].TX_CODE.length > 1) {					
					var parent = root.querySelector("#contents");
					var objs = parent.querySelectorAll(".productBlock_downRange");
					var objs1 = parent.querySelectorAll(".block_list");

					for(var z = 0; z < objs1.length; z++) {
						var obj = objs1[z];
						if(obj.parentNode) {
							obj.parentNode.removeChild(obj);
						}
					}

					for(var y = 0; y < objs.length; y++) {
						var obj = objs[y];
						if(obj.parentNode) {
							obj.parentNode.removeChild(obj);
						}
					}

					for (var j = 0; j < _Hierarchy[index].Subj_Code[i].TX_CODE.length; j++ ) {
						var div_o = document.createElement("div");
						div_o.className = "block_list";
						div_o.setAttribute("data-src", _id);
						div_o.setAttribute("data-act", "preTest");
						div_o.setAttribute("TX_CODE", _Hierarchy[index].Subj_Code[i].TX_CODE[j].Value);
						div_o.setAttribute("Pub_Name", _Hierarchy[index].Subj_Code[i].TX_CODE[j].Name);
						parent.appendChild(div_o);
						var p_o = document.createElement("p");
						p_o.className = "titleLine active";
						p_o.innerHTML = _Hierarchy[index].Subj_Code[i].TX_CODE[j].Name;
						div_o.appendChild(p_o);
						
						var selected = ""
					}

					$("#preSelectBack").addClass("btn-light-gray");
					$("#preSelectBack").removeClass("btn-blue");
				} else {
					$("#pretestPopcontent1").css("display", "none");
					$("#pretestPopcontent2").css("display", "none");
					$("#pretestPopcontent3").css("display", "none");
					_pub_Name = "";
					_tX_Code = "";
					if(typeof(_callback) == "function"){ 
						_callback();
					}					
				}

				_initEvent();				
			}
		}
    }

    // 예상족보 범위 조회
    var _getSaveData = function(_callback){
        var url_v = "/_api/search.api.asp";
		var search_Part_ID_Set = document.getElementById("part_ID").value;
		var data_v = "cmd=CHECK_MY_DOWNLOAD&ExPapr_No=" + paprNo + "&Part_ID_Set=" + search_Part_ID_Set;

		if (_pRootID == "matchSvc_main") { 	// 학교 ★ 맞춤 수정!
			data_v = data_v + "&IsMatchSvc=Y"
		}

        comm.toggleLoading(true);
        comm.send(url_v, data_v, "post", function(json){
            comm.toggleLoading(false);
            if(json){
				saveData = json.result;
                
                if(typeof(_callback) == "function"){ 
                    _callback();
                }
            }
        });
    }

    // 예상족보 목록 조회
    var _loadData = function() {
        var url_v = "/_api/search.api.asp";
        var data_v = "cmd=GET_PAPER_INFO&ExPapr_No=" + paprNo;

		if (_pGubun == "PreTest") {
			data_v = "cmd=GET_PAPER_INFO_PRETEST&ExPapr_Group=" + _preTest_Expapr_Group;
			data_v = data_v + "&ExPapr_CoreType=" + _preTest_Expapr_CoreType;
			data_v = data_v + "&SiteID=" + _pSiteID;
			data_v = data_v + "&Grade=" + _pGrade;
			data_v = data_v + "&Subj_Code=" + _pmSubj_Code;
			data_v = data_v + "&Pub_Name=" + _pub_Name;
			data_v = data_v + "&TX_Code=" + _tX_Code;
			data_v = data_v + "&PreTerm=" + _pPreTerm;
		}

        comm.toggleLoading(true);
        comm.send(url_v, data_v, "post", function(json) {
            comm.toggleLoading(false);
			if (_pGubun == "PreTest") {
				exPaprInfo = null
			} else {
	            exPaprInfo = json.list[0];
			}
			
			//if(exPaprInfo.ExPapr_Group == "W")
			if(_pGubun == "W")
			{
				$("#"+_id).find(".accountMsg").text("범위를 설정하시면 AI기출변형 문제가 추출됩니다.");

				var btn_o = root.querySelector("[data-act='completeSelect']");
				btn_o.className = "btn btn-l btn-full btn-light-gray btn-square";
				btn_o.innerHTML = "선택완료";
			}
			else if(_pGubun == "V")
			{
				$("#"+_id).find(".accountMsg").text("범위를 설정하시면 예상족보 문제가 추출됩니다.");
			}
			else if(_pGubun == "preparation")
			{
				$("#"+_id).find(".accountMsg").text("범위를 설정하시면 FINAL모의고사 문제가 추출됩니다.");
				$("#"+_id).find("#txt_Preparation").css("display", "");			
			}
			else
			{
				if (_pPreTerm.substring(_pPreTerm.length - 1, _pPreTerm.length) == "M") {
					$("#"+_id).find(".accountMsg").text("범위를 설정하시면 미리보는 중간고사 문제가 추출됩니다.");
				} else {
					$("#"+_id).find(".accountMsg").text("범위를 설정하시면 미리보는 기말고사 문제가 추출됩니다.");
				}
			}

            chapterItems = json.chapterList;
            _sortChapter();
            _drawItems();
            _initEvent();
        });
    };

    // 챕터 구별
    var _sortChapter = function() {
        sortItems = [];
        for(var i = 0; i < chapterItems.length; i++) {
            var item = chapterItems[i];
            var pID = item.ParentNode;
            var listTop_o = root.querySelector(".listTop .row");
            var productBlock_o = root.querySelector(".productBlock_downRange");

            if(pID == "0") {
                item.subItems = [];
                sortItems.push(item);
                listTop_o.style.display = "none";
            }
            else {
                $(productBlock_o).remove();
                listTop_o.style.display = "";
                for(var j = 0; j < sortItems.length; j++) {					
                    var pItem = sortItems[j];
					
                    if(pItem.Part_ID == pID) {
                        sortItems[j].subItems.push(item);
                        break;
                    }
                }
            }
        }
    };

    // 목록 그리기
    var _drawItems = function() {
        var parent = root.querySelector("#contents");
        var objs = parent.querySelectorAll(".productBlock_downRange");
        var objs1 = parent.querySelectorAll(".block_list");

        for(var i = 0; i < objs1.length; i++) {
            var obj = objs1[i];
            if(obj.parentNode) {
                obj.parentNode.removeChild(obj);
            }
        }

        for(var i = 0; i < objs.length; i++) {
            var obj = objs[i];
            if(obj.parentNode) {
                obj.parentNode.removeChild(obj);
            }
        }
        
        var ul_o = null;

        for(var i = 0; i < sortItems.length; i++) {
            var pItem = sortItems[i];

            if(pItem.subItems.length == 0) {
                if(i==0) {
                     var productBlock_o = document.createElement("div");
                     productBlock_o.className = "productBlock_downRange";
                     parent.appendChild(productBlock_o);

                     var row_o = document.createElement("div");
                     row_o.className = "row";
                     productBlock_o.appendChild(row_o);

                     var p_o = document.createElement("p");
                     p_o.className = "selectAll text-right mT15";
                     var button_o = document.createElement("button");
                     button_o.type = "button";
                     button_o.className = "check-all";
                     button_o.setAttribute("data-src", _id);
                     button_o.setAttribute("data-act", "selectAll");					 
                     button_o.innerHTML = "전체선택";
                     p_o.appendChild(button_o);
                     row_o.appendChild(p_o);

                     ul_o = document.createElement("ul");
                     ul_o.className = "rangeList";

                     row_o.appendChild(ul_o);
                 }

                var li_o = document.createElement("li");
                var button_o = document.createElement("button");

                button_o.type = "button";
                button_o.setAttribute("data-src", _id);

				if (_pGubun == "PreTest") 
				{
					if(_pmSubj_Code == "EG")
					{
						button_o.setAttribute("data-no", pItem.Part_ID);
					}
				}
				else
				{
					if (exPaprInfo.Subj_Code == "EG")
					{
						button_o.setAttribute("data-no", pItem.Part_ID);
					}
				}

                button_o.setAttribute("data-act", "item");                
                button_o.innerHTML = "<span class='num'>"+pItem.Code+". </span>"+pItem.Node;
                li_o.appendChild(button_o);
                ul_o.appendChild(li_o);
            } 
			else {
                var div_o = document.createElement("div");
                div_o.className = "block_list";
                parent.appendChild(div_o);
                var p_o = document.createElement("p");
                p_o.className = "titleLine active";
                p_o.innerHTML = pItem.Code + ". " + pItem.Node;
                div_o.appendChild(p_o);

                var span_o = document.createElement("span");
                span_o.className = "num";
                span_o.innerHTML = "0 개";
                p_o.appendChild(span_o);

                var btn_o = document.createElement("button");
                btn_o.className = "toggle";
                btn_o.innerHTML = "접기/펼치기";
                btn_o.setAttribute("data-src", _id);
                btn_o.setAttribute("data-act", "toggle");
				btn_o.setAttribute("data-no", pItem.Part_ID);

                p_o.appendChild(btn_o);

                var sub_o = _createSubItems(pItem.subItems, pItem);    
                if(sub_o) {
                    div_o.appendChild(sub_o);
                }
            }
        }

        if(saveData != "" && saveData != null) {
            _hLog("saveData=>"+saveData);
            var str = saveData.split(",");
			
            for(var i=0; i<str.length; i++) {
                var data_no = str[i];
                var li_o = root.querySelector("[data-no='"+data_no+"']");
				var btn_o = "";

				if(str.length > 1)
				{
					btn_o = root.querySelector("[data-no='"+data_no+"']").innerText;
				}

                if(li_o){
                    li_o.className = "active";

					if(btn_o == '접기/펼치기')
					{
						root.querySelector("[data-no='"+data_no+"']").className = "toggle";
					}
                }
            }

            var objs = root.querySelectorAll(".rangeList .active");
            var btn_o = root.querySelector("[data-act='completeSelect']");
            if(btn_o) {
                if(objs.length > 0) {
					if (_pGubun == "PreTest") {
						btn_o.className = "btn btn-l btn-blue btn-square";
					} else {
						btn_o.className = "btn btn-l btn-full btn-blue btn-square";
					}
                    btn_o.innerHTML = objs.length + "개 선택완료";
                    selectedCount = objs.length;
                }
                else {
					if (_pGubun == "PreTest") {
						btn_o.className = "btn btn-l btn-light-gray btn-square";
					} else {
						btn_o.className = "btn btn-l btn-full btn-light-gray btn-square";
					}
                    btn_o.innerHTML = "선택완료";
                }
            }
        }
    };

    // 세부 목록 그리기
    var _createSubItems = function(sItems, pItems) {
        if(sItems == null) return null;
        if(sItems.length == 0) return null;

        var div_o = document.createElement("div");
        div_o.className = "productBlock_downRange";

        var row_o = document.createElement("div");
        row_o.className = "row";
        div_o.appendChild(row_o);

        var p_o = document.createElement("p");
        p_o.className = "selectAll text-right mT15";
        row_o.appendChild(p_o);

        var btn_o = document.createElement("button");
        btn_o.type = "button";
        btn_o.className = "check-all";
        btn_o.innerHTML = '전체선택';
        btn_o.setAttribute("data-src", _id);
        btn_o.setAttribute("data-act", "selectAll");
		btn_o.setAttribute("data-no", pItems.Part_ID);
        p_o.appendChild(btn_o);

        var ul_o = document.createElement("ul");

        ul_o.className = "rangeList";
        row_o.appendChild(ul_o);

        for(var i = 0; i < sItems.length; i++) {
            var item = sItems[i];
            var li_o = document.createElement("li");
            ul_o.appendChild(li_o);

            var btn_o = document.createElement("button");
            btn_o.type = "button";
            btn_o.setAttribute("data-src", _id);
            btn_o.setAttribute("data-act", "item");
            btn_o.setAttribute("data-no", item.Part_ID);
            li_o.appendChild(btn_o);

            var span_o = document.createElement("span");
            span_o.className = "num";
            span_o.innerHTML = item.Code;
            btn_o.appendChild(span_o);
            btn_o.innerHTML = btn_o.innerHTML + item.Node;
        }

        return div_o;
    };

    // 선택한 아이템 개수 계산
    var _calcSelectItem = function() {
        var selectedCount = 0;
        var cobjs = root.querySelectorAll(".titleLine");

		for(var i = 0; i < cobjs.length; i++) {
			var cobj = cobjs[i];
			var sobjs = cobj.parentNode.querySelectorAll(".rangeList .active");
			var num_o = cobj.querySelector(".num");
			num_o.innerHTML = sobjs.length + "개";
		}
        
		var objs = root.querySelectorAll(".rangeList .active");
		var btn_o = root.querySelector("[data-act='completeSelect']");

		if(btn_o) {
			if(objs.length > 0) {
				if (_pGubun == "PreTest") {
					btn_o.className = "btn btn-l btn-blue btn-square";
				} else {
					btn_o.className = "btn btn-l btn-full btn-blue btn-square";
				}
				btn_o.innerHTML = objs.length + "개 선택완료";
				selectedCount = objs.length;
			}
			else {
				if (_pGubun == "PreTest") {
					btn_o.className = "btn btn-l btn-light-gray btn-square";
				} else {
					btn_o.className = "btn btn-l btn-full btn-light-gray btn-square";
				}
				btn_o.innerHTML = "선택완료";
			}
		}
        return selectedCount;
    };

    var _click = function(ee) {
        var ev = window.event || ee;
        var evo = util.findEventObject(ev, null);
        var act_v = evo.getAttribute("data-act");
        _hLog1(_id + " act=" + act_v);

        // 이전버튼
        if(act_v == "preSelectBack") {
			_init(0, _pRootID, _pGubun, _pSiteID, _pmSubj_Code, _pGrade, _pPreTerm)
        }

        // 출판사 선택
        if(act_v == "preTest") {
			$("#pretestPopcontent1").css("display", "none");
			$("#pretestPopcontent2").css("display", "none");
			$("#pretestPopcontent3").css("display", "none");
			_tX_Code = evo.getAttribute("TX_Code");
			_pub_Name = evo.getAttribute("Pub_Name");
			$("#preSelectBack").removeClass("btn-light-gray");
			$("#preSelectBack").addClass("btn-blue");
			_loadData();
        }

        // 팝업 닫기
        if(act_v == "close") {
            _hide();
        }
        // 전체 펼치기
        else if(act_v == "expandAll") {

			// (QA) 전체접기 전체 펼치기 시 active 클래스 핸들링
			$(root).find(".titleLine").addClass("active");

			var str = ".titleLine .num";
            $(root).find(str).css("display", "none");

            str = ".block_list .productBlock_downRange";
            $(root).find(str).css("display", "");
            var checked = evo.getAttribute("checked")
            if(checked) return;
            _hLog("all expand");

			_calcSelectItem();
        }
        // 전체 접기
        else if(act_v == "collapseAll") {

			// (QA) 전체접기 전체 펼치기 시 active 클래스 핸들링
			$(root).find(".titleLine").removeClass("active");

            var str = ".titleLine .num";
            $(root).find(str).css("display", "inline");

            var checked = evo.getAttribute("checked")
            str = ".block_list .productBlock_downRange";
            $(root).find(str).css("display", "none");
            if(checked) return;

			_calcSelectItem();
        }
        // 접기/펼치기
        else if(act_v == "toggle") {
            var p_o = evo.parentNode;
			$(evo.parentNode).next().toggle();

            if($(evo.parentNode).hasClass("active")) { // 펼쳐져 있는 경우.
				$(evo.parentNode).removeClass("active");
                $(evo.parentNode).find(".num").css("display", "inline");
                $(p_o.parentNode).find(".productBlock").css("display", "none");
            }
            else {
                $(evo.parentNode).addClass("active");
                $(evo.parentNode).find(".num").css("display", "inline");
                $(p_o.parentNode).find(".productBlock").css("display", "none");
            }

			_calcSelectItem();
        }
        // 전체 선택
        else if(act_v == "selectAll") {
            var row_o = evo.parentNode.parentNode;
            if($(evo).hasClass("active")) {
                $(evo).removeClass("active");
                $(row_o).find(".rangeList button").removeClass("active");
            }
            else {
                $(evo).addClass("active");
                $(row_o).find(".rangeList button").addClass("active");
            }
            _calcSelectItem();
        }
        // 한개 선택
        else if(act_v == "item") {
            if($(evo).hasClass("active")) {
                $(evo).removeClass("active");
            }
            else {
                $(evo).addClass("active");
            }
            _calcSelectItem();
        }
        // 선택완료 버튼
        else if(act_v == "completeSelect") {
            var cnt_i = _calcSelectItem();

			if(cnt_i > 0) {
				var objs = root.querySelectorAll(".rangeList .active");
				var part_ids = "";

				for(var i = 0; i < objs.length; i++) 
				{
					var item = objs[i];
					var data_no = item.getAttribute("data-no");
					var r_data_no = "";

					if (_pGubun == "PreTest") 
					{
						if (_pmSubj_Code == "EG")
						{
							if(i > 0)
							{
								part_ids = part_ids + ",";
							}

							part_ids = part_ids + data_no;
						}
						else
						{
							r_data_no = item.parentNode.parentNode.parentNode.querySelectorAll(".check-all")[0].dataset.no;		

							if(i == 0)
							{
								part_ids = r_data_no + ",";
							}

							if(i > 0)
							{
								part_ids = part_ids + ",";

								if(r_data_no != "" && part_ids.includes(r_data_no) == false)
								{
									part_ids = part_ids + r_data_no + ",";
								}
							}

							part_ids = part_ids + data_no;
						}
					}
					else
					{
						if (exPaprInfo.Subj_Code == "EG")
						{
							if(i > 0)
							{
								part_ids = part_ids + ",";
							}

							part_ids = part_ids + data_no;
						}
						else
						{
							r_data_no = item.parentNode.parentNode.parentNode.querySelectorAll(".check-all")[0].dataset.no;		

							if(i == 0)
							{
								part_ids = r_data_no + ",";
							}

							if(i > 0)
							{
								part_ids = part_ids + ",";

								if(r_data_no != "" && part_ids.includes(r_data_no) == false)
								{
									part_ids = part_ids + r_data_no + ",";
								}
							}

							part_ids = part_ids + data_no;
						}
					}					
				}

				if (part_ids.substr(part_ids.length - 1) == ",")
				{
					part_ids = part_ids.slice(0, -1);
				}

				// 시험지 생성 요청
				if (_pGubun == "PreTest") {
					var url_v = "/ZocboExam/AutoExamPre_p.asp";
					var data_v = "ExPapr_No=" + paprNo + "&Part_ID_Set=" + part_ids + "&reSubj_Code=" + _pSubj_Code + "&mSubj_Code=" + _pmSubj_Code + "&SiteID=" + _pSiteID + "&Grade=" + _pGrade + "&Pub_Name=" + _pub_Name + "&PreTerm=" + _pPreTerm;
					comm.toggleProcessLoading(0);
					comm.send(url_v, data_v, "post", function(data) {
						if(data){
							if(data.Result == 0){
								Token = data.File;
								autoSeq = data.Auto_Seq;
								INTERVAL_ID = window.setInterval(function(){
									loadingCnt++;
									_progress(Token, function(){
										comm.toggleProcessLoading(-1);
										//Download_Layer(exPaprInfo.ExPapr_No, exPaprInfo.Exfl_Group, exPaprInfo.Grade, exPaprInfo.Subj_Code, exPaprInfo.ExPapr_Group, exPaprInfo.ExPapr_CoreType, autoSeq);
										evo.innerHTML = "선택완료";
										evo.className = "btn btn-l btn-full btn-light-gray btn-square";
										/*
										'//. 코드 규칙. EX) H1KR01Q
										'//. 1번째 자리 문자	: SiteID
										'//. 2번째 자리 문자	: 회차
										'//. 3,4번째 자리 문자	: Subj_Code
										'//. 5,6번째 자리 문자	: FILENUMBER
										'//. 7번째 자리 문자	: 문제파일|정답파일 구분
										*/
										
										if (_pPreTerm == "20232E" || _pPreTerm == "20241M" || _pPreTerm == "20241E") {
											(GetCookie("download-rnpay") != "download-rnpay") ? $("#download-rnpay").show() : '';
										}

										var pre_siteid;

										if(_pSiteID == "H")
										{
											pre_siteid = "고등";
											$("#pre_a_link").prop("href", "/payment/default_v.asp?category=CD_000100010002");
										}
										else
										{
											pre_siteid = "중등";
										}

										$j("#pre_down_grade").text(pre_siteid + " " + _pGrade + "학년 이용권으로");

										window.location.href = "/common/examdownload/SampleDownloadS3.asp?strGubun=pretest&idx="+_pSiteID+_pGrade+_pSubj_Code+"01Q&PreTerm="+_pPreTerm+"&PubName="+_pub_Name+"&Part_ID_Set=" + part_ids + "&mSubj_Code=" + _pmSubj_Code;
										_hide();
									});
								}, 500);
							}
							else{
								comm.toggleProcessLoading(-1);
							}
						}
						else{
							comm.toggleProcessLoading(-1);
						}
					});
				} 
				else if(_pGubun == "preparation")
				{
					var search_Part_ID_Set = $(part_ids).serializeArray();
					document.getElementById("part_ID").value = part_ids;

					ExamDownload_AutoExam_V2(0, paprNo, _pSubj_Code, _pSiteID, _pGrade, document.getElementById("part_ID").value, "1", "0", "B");

					document.getElementById("part_ID").value = "";
					//_hide();
				}
				else 
				{
					var search_Part_ID_Set = $(part_ids).serializeArray();
						
					document.getElementById("part_ID").value = part_ids;
	
					if(_pRootID == "expected") {
						expected.loadData_2_V();
					}
					else if(_pRootID == "ai_transform") {
						ai_transform.loadData_2_V();
					}
					else {
						main.loadData_2_V();
					}
					
					_hide();
				}
			}
        }
    };

    // pdf 생성 진행상황 표시
    var _progress = function(Token, _function) {
        $.ajax({
            url: "/Common/System/Token_hs.asp?Token=" + Token + "&Idx=" +  Math.random(),
            method: "get",
            asynchronous: false,
            contentType: 'application/x-www-form-urlencoded',
            encoding: 'UTF-8',
            dataType: "xml",
            complete: function(Request){

                if(Request.status == 200){

                    if(Request.responseXML){
                        var Doc = Request.responseXML.documentElement;
                        var _Percent = Doc.getElementsByTagName('Percent')[0].firstChild.nodeValue;
                        var _Status = Doc.getElementsByTagName('Status')[0].firstChild.nodeValue;

                        // _Status : 100 = 정상, 000 = 문제 없음
                        if ( _Status != '' ) 
                        {
                            Start = true;
                        }
						if (Start == true && _Percent == 100)
						{
							clearInterval(INTERVAL_ID);
							if(typeof(_function) == "function"){
								_function();
							}
							return;
						}

                        // 문제를 찾기 못 한다면
                        if (_Status == '000') {
                            common.alert('알림','해당 범위의 문제가 조회가 되질 않습니다.', null, {});
                            clearInterval(INTERVAL_ID);
                            return;
                        }
                        else{
                            comm.toggleProcessLoading(_Percent);
                        }
                    }
                }
                else if(Start && Request.status == 404){
                    clearInterval(INTERVAL_ID);
                    if(typeof(_function) == "function"){
                        _function();
                    }
                    return;
                }
            }
        });
    };

    return {
        init:function(paprNo_p, pRootID, pGubun, pSiteID, pSubj_Code, pGrade, pPreTerm) {
            _init(paprNo_p, pRootID, pGubun, pSiteID, pSubj_Code, pGrade, pPreTerm);
        }
    }
}();