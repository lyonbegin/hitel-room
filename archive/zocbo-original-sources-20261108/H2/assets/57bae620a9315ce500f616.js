/*
	중,고등 영문법
*/
var grammerSelector = function(){

	var _id = "grammer_select";
	var _site_id = "M";

	var Page = 1;
	var PageSize = 20;

	var root = null;

	var parentRoot = null;

	var list = null;
	var flag = null;
	var kindIndex = 0;

	var sortItems = null;

	var grammerItems = [{"flag" : "1", "Name": "기초",}, {"flag": "2", "Name": "기본"}, {"flag": "3", "Name": "심화"}, {"flag": "4", "Name": "완성"}, {"flag": "5", "Name": ""}
	, {"flag": "6", "Name": "기초"}, {"flag": "7", "Name": "기본"}, {"flag": "8", "Name": "심화"}];
	var tagItems = ["개념완성", "체크체크", "확인문제", "종합문제","개념완성", "체크체크", "확인문제", "종합문제"];
	var tagItems_v2 = ["개념완성&영상강의", "연습문제", "워크북 독해", "워크북 영작","구문활용독해"];

	var listItem_p = null;

	var exNoList = [];

	var displayCnt = 0;

	var str1 = "";
	var str2 = "";

	var gumunDokChk = false;


	var _init = function(list_p, flag_p, kind_p, parent_p, site_id_p, exPaprNoList_p) {
		list = list_p;
		flag = flag_p;
		parentRoot = parent_p;
		kindIndex = kind_p;
		_site_id = site_id_p;

		if(exPaprNoList_p != null) {
			exNoList = exPaprNoList_p;
		}

		if(_site_id == null) _site_id = "M";

		if(parentRoot == null) {
			_hLog("parent is null");
			return;
		}
		_drawInit(function(){
			if(_site_id == "M") {
				if(exNoList.length > 0 ) {
					exNoList = util.arrayFilter(exNoList);
					var exNoStr = exNoList.join(",");
					_drawDownCount(exNoStr);
				}

				var num_o = parentRoot.querySelector(".bbsNumber b");
				if(num_o){

					var displayCnt = parentRoot.querySelectorAll("li[data-code]").length;
					num_o.innerHTML = displayCnt;
				}
			} else {
				//_drawDownCount(exNoList);
				if(exNoList.length > 0 ) {
					exNoList = util.arrayFilter(exNoList);
					var exNoStr = exNoList.join(",");
					_drawDownCount(exNoStr);
				}

				var num_o = parentRoot.querySelector(".bbsNumber b");
				if(num_o){

					var displayCnt = parentRoot.querySelectorAll("li[data-code]").length;
					num_o.innerHTML = displayCnt;
				}
			}

			// 재다운 표시
			ui_updater.setUI();

			comm.toggleLoading(false);
		});
	};

	// 영문법 목록 그리기
	var _drawInit = function(_callback){

		var objs = parentRoot.querySelectorAll(".block_list");
		for(var i=0; i< objs.length; i++) {
			var obj = objs[i];
			if(obj.parentNode){
				obj.parentNode.removeChild(obj);
			}
		}

		var listLen
			listLen = 0

		if ((flag == 6 || flag == 7 || flag == 8) && kindIndex == 0) {
			//구문독해에 동영상 일때에만
			listLen = list.length - 1;
		} else {
			listLen = list.length;
		}

		for ( var i=0; i<listLen; i++) {
			var item = list[i];
			if(_site_id == "M") {
				_drawItem_M(item, PageSize * (Page-1) + i);
			} else {
				_drawItem_M(item, PageSize * (Page-1) + i);
				//_drawItem_H(item, PageSize * (Page-1) + i);
			}
		}

		main.initEvent();
		_initEvent();

		if(typeof(_callback) == "function") {
			_callback();
		}
	};

	// 중등영문법 그리기
	var _drawItem_M = function(item_p, index_p){
		var parent_o = parentRoot;

		var pItem = item_p;

		var div_o = document.createElement("div");
		div_o.className = "block_list";
		div_o.setAttribute("data-index", index_p+1);		//2020.02.21 넣어봄
		parent_o.appendChild(div_o);

		var p_o = document.createElement("p");
		var div_o_index = div_o.getAttribute("data-index")
		//p_o.className = "titleLine active";
		if (div_o_index > 1) {
			p_o.className = "titleLine";			// 리스트 기본 숨김 (정효태, 2021.11.22)
		} else {
			p_o.className = "titleLine active";		// 리스트 기본 숨김 (정효태, 2021.11.22)
		}
		p_o.innerHTML = pItem.title;
		div_o.appendChild(p_o);

		gumunDokChk = false;
		if (pItem.title == "구문활용독해") {
			gumunDokChk = true;
		}

		var btn_o = document.createElement("button");
		btn_o.className = "toggle";
		btn_o.innerHTML = "접기/펼치기";
		btn_o.setAttribute("data-src", "main");
		btn_o.setAttribute("data-act", "toggleAll");
		p_o.appendChild(btn_o);

		pdo_o = document.createElement("div");
		pdo_o.className = "productBlock row";
		if (div_o_index > 1) {
			pdo_o.style.display = "none";		// 리스트 기본 숨김 (정효태, 2021.11.22)
		}

		div_o.appendChild(pdo_o);

		p_o = document.createElement("p");
		p_o.className = "listTitle";

		if(kindIndex ==0) {
			// 동영상
			listItem_p = { "step1" : pItem.step1, "step2" : pItem.step2, "step3" : pItem.step3 };
		} else {
			// 다운로드
			listItem_p = pItem.pdfInfo;
		}

		var listItem = listItem_p["step1"];
		_createSubItem_M(pdo_o, listItem, grammerItems[flag-0-1].Name);

		var listItem1 = null;
		var listItem2 = null;

		listItem1 = listItem_p["step2"];
		listItem2 = listItem_p["step3"];

		// 연계단원 영역 생성
		_createRelatedItem_M(pdo_o, listItem1, listItem2);
	};

	// 고등영문법 그리기
	var _drawItem_H = function(item_p, index_p) {
		var parent_o = parentRoot;

		var pItem = item_p;

		var div_o = document.createElement("div");
		div_o.className = "block_list";
		div_o.setAttribute("data-index", index_p+1);		//2020.02.21 넣어봄
		parent_o.appendChild(div_o);

		var p_o = document.createElement("p");
		//p_o.className = "titleLine active";
		p_o.className = "titleLine";		// 리스트 기본 숨김 (정효태, 2021.11.22)
		p_o.innerHTML = pItem.cate_name;
		div_o.appendChild(p_o);

		var btn_o = document.createElement("button");
		btn_o.className = "toggle";
		btn_o.innerHTML = "접기/펼치기";
		btn_o.setAttribute("data-src", "main");
		btn_o.setAttribute("data-act", "toggleAll");
		p_o.appendChild(btn_o);

		pdo_o = document.createElement("div");
		pdo_o.className = "productBlock row";
		pdo_o.style.display = "none";		// 리스트 기본 숨김 (정효태, 2021.11.22)
		div_o.appendChild(pdo_o);

		p_o = document.createElement("p");
		p_o.className = "listTitle";


		_createSubItem_H(pdo_o, pItem.items);
	};

	// 연계단원 생성
	var _createRelatedItem_M = function(parent_o, item1_p, item2_p) {

		if(parent_o == null || item1_p == null || item2_p == null) {
			_hLog("parameter is null!");
			return;
		}
		if(item1_p.length > 0 || item2_p.length > 0) {
			var sb_o = document.createElement("div");
			sb_o.className = "similarBlock";

			var p_o = document.createElement("p");
			p_o.className = "similarView mT50 active";
			p_o.style = "margin-bottom: 15px;";
			p_o.innerHTML = '<a href="#" data-src="'+_id+'" data-act="similar" class="btn btn-l btn-blueLine btn-wide">연계 단원 <span class="off">닫기</span><span class="on">보기</span> <img src="../../img/ico_arrow_up_blue.png" width="12" alt=""></a>';
			sb_o.appendChild(p_o);

			var listTop_o = document.createElement("div");
			listTop_o.className = "listTop clearfix";
			listTop_o.style.display = "none";

			sb_o.appendChild(listTop_o);

			var viewSelect_o = document.createElement("ul");
			viewSelect_o.className = "viewSelect";
			listTop_o.appendChild(viewSelect_o);

			if(item1_p.length > 0 ) {

				viewSelect_o.innerHTML += '<li class="active"><a href="#" data-src="'+_id+'" data-act="viewSelect">'+item1_p[0].depth_name+'</a></li>'

				var sc_o = document.createElement("div");
				sc_o.className = "similarCon";
				str1 = item1_p[0].depth_name;
				sc_o.setAttribute("data-idx", str1);
				sc_o.style.display = "none";
				sb_o.appendChild(sc_o);
				_createSubItem_M(sc_o, item1_p,  str1);
				parent_o.appendChild(sb_o);
			}

			if(item2_p.length > 0 ){

				viewSelect_o.innerHTML += '<li><a href="#" data-src="'+_id+'" data-act="viewSelect">'+item2_p[0].depth_name+'</a></li>'

				var sc_o = document.createElement("div");
				sc_o.className = "similarCon";
				str2 = item2_p[0].depth_name;
				sc_o.setAttribute("data-idx",  str2);
				sc_o.style.display = "none";
				sb_o.appendChild(sc_o);

				_createSubItem_M(sc_o, item2_p,  str2);
				parent_o.appendChild(sb_o);
			}
		}
	};

	// 중등영문법 상세 그리기
	var _createSubItem_M = function(parent_o, listItem, tag_v) {
		if(parent_o == null) {
			_hLog("parent_o not found!");
			return;
		}

		var group_v = "";
		var coreType_v = "";

		for(var i=0; i<listItem.length; i++) {
			var dItem = listItem[i];
			if(kindIndex == 1) {
				//동영상 : 0 다운로드 : 1
				if (gumunDokChk == false || (gumunDokChk == true && i == 0)) {
					//구문독해활용만 true : 구문독해 활용에서는 하나만 그려준다.
					var p_o = document.createElement("p");
					p_o.className = "listTitle";
					if (flag == "1" || flag == "2" || flag == "3" || flag == "4") {
						group_v = "K";
						coreType_v = "C";
						p_o.innerHTML = "Step"+(i+1) + ". " + tagItems[i] + '<a href="#" data-src="'+_id+'" data-act="arrowToggle" class="arrowToggle"><img src="../../img/ico_arrow_up.png" width="16.5" alt=""></a>';
					} else {
						group_v = "P";
						if (gumunDokChk) {
							coreType_v = "E5";
							p_o.innerHTML = "Step4. 구문활용독해<a href='#' data-src='"+_id+"' data-act='arrowToggle' class='arrowToggle'><img src='../../img/ico_arrow_up.png' width='16.5' alt=''></a>";
						} else if (i == 2) {
							coreType_v = "E"+String(i+1);
							p_o.innerHTML = "Step3-1"+ ". " + tagItems_v2[i] + '<a href="#" data-src="'+_id+'" data-act="arrowToggle" class="arrowToggle"><img src="../../img/ico_arrow_up.png" width="16.5" alt=""></a>';
						} else if (i == 3) {
							coreType_v = "E"+String(i+1);
							p_o.innerHTML = "Step3-2"+ ". " + tagItems_v2[i] + '<a href="#" data-src="'+_id+'" data-act="arrowToggle" class="arrowToggle"><img src="../../img/ico_arrow_up.png" width="16.5" alt=""></a>';
						} else {
							coreType_v = "E"+String(i+1);
							p_o.innerHTML = "Step"+(i+1) + ". " + tagItems_v2[i] + '<a href="#" data-src="'+_id+'" data-act="arrowToggle" class="arrowToggle"><img src="../../img/ico_arrow_up.png" width="16.5" alt=""></a>';
						}
					}
					parent_o.appendChild(p_o);
				}
			}

			var ul_o = document.createElement("ul");
			ul_o.className = "bbsList mB20";

			var formatInfo = "2";
	        var li_o = document.createElement("li");
	        li_o.setAttribute("data-type", "Mid_Eng");
	        li_o.setAttribute("data-no", dItem.expapr_No);
	        li_o.setAttribute("data-siteid", _site_id);
	        li_o.setAttribute("data-idx", dItem.idx);
	        li_o.setAttribute("data-title", dItem.detailTitle);
	        li_o.setAttribute("data-depth", dItem.depth);
	        li_o.setAttribute("data-curr", dItem.curri_idx);
	        li_o.setAttribute("data-code", dItem.code);
			li_o.setAttribute("data-mnuCode", dItem.mnuCode);

	        li_o.setAttribute("data-name", dItem.vodName);
	        li_o.setAttribute("data-formats", formatInfo);
	        li_o.setAttribute("data-subjcode", "EG");
	        li_o.setAttribute("data-grade", 0);
	        li_o.setAttribute("data-group", group_v);
	        li_o.setAttribute("data-coretype", coreType_v);
	        ul_o.appendChild(li_o);

	        var p_o = document.createElement("p");
			p_o.className = "tag";
			if(tag_v) {
				p_o.innerHTML = "<span>" + tag_v + "</span>";
			} else {
				p_o.innerHTML = "<span>" + grammerItems[flag-1].Name + "</span>";
			}
			li_o.appendChild(p_o);

			p_o = document.createElement("p");
			p_o.className = "title";
			var title_v = dItem.detail_Title;
			if(title_v == null || title_v == "") {
				title_v = dItem.detailTitle;
			}
			p_o.innerHTML = "<span>" + title_v + "</span>";
			li_o.appendChild(p_o);

			// hash 정보 추가
			p_o = document.createElement("p");
			p_o.className = "hash";
			p_o.innerHTML = "<span>#전학년</span><span>#영어</span>";
			li_o.appendChild(p_o);

			p_o = document.createElement("p");
			if(kindIndex == 1) {
				exNoList.push(dItem.expapr_No);
				p_o.className = "downLink";
				p_o.innerHTML = "<a href='#' data-src='"+_id+"' data-act='item_down'><em>다운로드</em><em>닫기</em><span class='down'>"
							+ '<svg xmlns="http://www.w3.org/2000/svg" width="9" height="7" viewBox="0 0 9 7"><path id="triangle" data-name="triangle" d="M3.659,1.308a1,1,0,0,1,1.682,0L8.01,5.459A1,1,0,0,1,7.168,7H1.832A1,1,0,0,1,.99,5.459Z"/></svg>'
							+'</span></a>';
			} else {
				//p_o.className = "video";
				p_o.className = "renewal-video";
				if(dItem.ReVodState == "Y"){
					li_o.className = "downloaded";//영문법 동영상 리스트 제목 재다운로드 색상 추가
					if (flag == 6 || flag == 7 || flag == 8) {
						//p_o.innerHTML = "<a href='javascript:void(0);' data-src='vod_player' data-act='video_down'>개념영상<br/>다시보기</a>";
						p_o.innerHTML = _Unit.drawVodButtonDetail("concept", "reconfirm", "개념");
					} else {
						//p_o.innerHTML = "<a href='javascript:void(0);' data-src='vod_player' data-act='video_down'>강의<br/>다시보기</a>";
						p_o.innerHTML = _Unit.drawVodButtonDetail("concept", "reconfirm", "개념");
					}
				}
				else{
					if (flag == 6 || flag == 7 || flag == 8) {
						//p_o.innerHTML = "<a href='javascript:void(0);' data-src='vod_player' data-act='video_down'>개념영상<br/><span class='num'>" + util.toNumber(_downPrice["VOD"]["midEng"]) + "</span></a>";
						p_o.innerHTML = _Unit.drawVodButtonDetail("concept", "", "개념");
					} else {
						//p_o.innerHTML = "<a href='javascript:void(0);' data-src='vod_player' data-act='video_down'>강의<br/><span class='num'>" + util.toNumber(_downPrice["VOD"]["midEng"]) + "</span></a>";
						p_o.innerHTML = _Unit.drawVodButtonDetail("concept", "", "개념");
					}
				}
			}
			li_o.appendChild(p_o);

			if(dItem.detail_Title2 && dItem.expapr_No2) {
				var li_o = document.createElement("li");
				li_o.setAttribute("data-no", dItem.expapr_No2);
				li_o.setAttribute("data-title", dItem.detail_Title2);
				li_o.setAttribute("data-formats", "2");
				li_o.setAttribute("data-siteid", _site_id);
				li_o.setAttribute("data-idx", dItem.idx);
				li_o.setAttribute("data-depth", dItem.depth);
				li_o.setAttribute("data-code", dItem.code);
				li_o.setAttribute("data-subjcode", "EG");
		        li_o.setAttribute("data-grade", 0);
		        li_o.setAttribute("data-group", group_v);
				li_o.setAttribute("data-coretype", coreType_v);

				var p_o = document.createElement("p");
				p_o.className = "tag";
				if(tag_v) {
					p_o.innerHTML = "<span>" + tag_v + "</span>";
				} else {
					p_o.innerHTML = "<span>" + grammerItems[flag-1].Name + "</span>";
				}
				li_o.appendChild(p_o);

				p_o = document.createElement("p");
				p_o.className = "title";
				p_o.innerHTML = "<span>" + dItem.detail_Title2; + "</span>";
				li_o.appendChild(p_o);

				// hash 정보 추가
					//영문법에만 그리기
					p_o = document.createElement("p");
					p_o.className = "hash";
					p_o.innerHTML = "<span>#전학년</span><span>#영어</span>";
					li_o.appendChild(p_o);

				p_o = document.createElement("p");
				if(kindIndex == 1) {
					exNoList.push(dItem.expapr_No2);
					p_o.className = "downLink";
					p_o.innerHTML = "<a href='#' data-src='"+_id+"' data-act='item_down'><em>다운로드</em><em>닫기</em><span class='down'>"
								+ '<svg xmlns="http://www.w3.org/2000/svg" width="9" height="7" viewBox="0 0 9 7"><path id="triangle" data-name="triangle" d="M3.659,1.308a1,1,0,0,1,1.682,0L8.01,5.459A1,1,0,0,1,7.168,7H1.832A1,1,0,0,1,.99,5.459Z"/></svg>'
								+'</span></a>';
				}
				li_o.appendChild(p_o);
				ul_o.appendChild(li_o);
			}

			parent_o.appendChild(ul_o);
		}
	};

	// 고등영문법 상세 그리기
	var _createSubItem_H = function(parent_o, list_p) {
		if(parent_o == null) {
			_hLog("parent_o not found!");
			return;
		}
		_hLog("list_p = " + JSON.stringify(list_p));

		var ul_o = document.createElement("ul");
		ul_o.className = "bbsList mB20";

		for(var i=0; i<list_p.length; i++) {
			var item = list_p[i];
			item = util.keysToLowerCase(item);

			var formatInfo = "2";
			var li_o = document.createElement("li");
			li_o.setAttribute("data-siteid", _site_id);
			li_o.setAttribute("data-no", item.expapr_no);
			li_o.setAttribute("data-group", item.expapr_group);
			li_o.setAttribute("data-grade", item.grade);
			li_o.setAttribute("data-subjcode", item.subj_code);
			li_o.setAttribute("data-coretype", item.expapr_coretype);
			li_o.setAttribute("data-tx", item.tx_code);
			li_o.setAttribute("data-year", item.expapr_testyear);
			li_o.setAttribute("data-formats", 2);
			li_o.setAttribute("data-title", item.expapr_title);

			li_o.setAttribute("data-subjcode", "EG");
	        li_o.setAttribute("data-grade", 0);
	        li_o.setAttribute("data-group", "");
	        li_o.setAttribute("data-coretype", "");
	        ul_o.appendChild(li_o);

	        var p_o = document.createElement("p");
	        p_o.className = "tag";

	        p_o = document.createElement("p");
	        p_o.className = "title";
	        p_o.innerHTML = "<span>"+item.expapr_title+"</span>";
	        li_o.appendChild(p_o);

			p_o = document.createElement("p");
			p_o.className = "hash";
			p_o.innerHTML = "<span>#전학년</span><span>#영어</span>";
			li_o.appendChild(p_o);

	        p_o = document.createElement("p");
	        p_o.className = "downLink";
	        p_o.innerHTML = "<a href='#' data-src='"+_id+"' data-act='item_down'><em>다운로드</em><em>닫기</em><span class='down'>"
						+ '<svg xmlns="http://www.w3.org/2000/svg" width="9" height="7" viewBox="0 0 9 7"><path id="triangle" data-name="triangle" d="M3.659,1.308a1,1,0,0,1,1.682,0L8.01,5.459A1,1,0,0,1,7.168,7H1.832A1,1,0,0,1,.99,5.459Z"/></svg>'
						+ '</span></a>';

	        li_o.appendChild(p_o);
	        ul_o.appendChild(li_o);
	        parent_o.appendChild(ul_o);
		}
	};

	// 다운로드 수 그리기
	var _drawDownCount = function(exNoList){
		if(exNoList.startsWith(',')) {
			exNoList = exNoList.substring(1, exNoList.length);
		}

		var url_c = "/_api/search.api.asp";
    	var data_c = "cmd=GET_PAPER_DOWNCNT&ExPapr_No=" + exNoList;

    	comm.send(url_c, data_c, "post", function(json) {

    		if(json){
    			var list = json.list;

    			for( var i=0; i<list.length; i++) {
    				var item = list[i];

    				var hash_p = parentRoot.querySelector("[data-no='"+item.ExPapr_No+"'] .hash");

    				var count = item.downCount;
    				if(count){
    					if(count >= 10000) {
    						count = "9999+";
    					} else {
    						count = util.toNumber(count);
    					}
    				}
    			}
    		}
    	});
	};

	var _initEvent = function(){
		if(parentRoot){
			var selector_str = ("[data-src='"+_id+"'][data-act]");

			$(parentRoot).find(selector_str).unbind();
			$(parentRoot).find(selector_str).bind("click", function() {return false;});
			$(parentRoot).find(selector_str).bind("click", function(ev) {_click(ev);});

		}
		player.initEvent();
	};

	var _click = function(ee){
		var ev = ee || window.event;
		var evo = ev.target || ev.srcElement;
		evo = util.findEventObject(ev, null);

		var act_v = evo.getAttribute("data-act");

		_hLog("act_v = " + act_v);

		if(act_v == "arrowToggle") {
			// 접기/펼치기
			$(evo.parentNode).toggleClass("active");
			$(evo.parentNode).next().toggle();
		} else if (act_v == "similar") {
			// 연계단원 클릭
			var sb_o = util.findObjectByAttr(evo, "class", "similarBlock");

			var listTop_o = sb_o.querySelector(".listTop");

			$(listTop_o).toggle();

			var li_o = listTop_o.querySelectorAll(".viewSelect li");
			if(li_o){
				li_o[0].className = "active";
			}

			var sc_o = sb_o.querySelectorAll(".similarCon");

			$(sc_o).hide();

			sc_o[0].style.display = "";

			$(evo.parentNode).toggleClass("active");

			if($(evo.parentNode).hasClass("active")) {
				$(sc_o).hide();
			} else {
				$(sc_o[0]).show();
			}

		} else if (act_v == "viewSelect"){
			// 기초,기본,심화 클릭
			$(".viewSelect li").removeClass("active");
			evo.parentNode.className = "active";

			var sb_o = util.findObjectByAttr(evo, "class", "similarBlock");

			var val = evo.innerText;

			var sc_o = sb_o.querySelectorAll(".similarCon");

			$(sc_o).hide();

			sc_o.forEach(function(item){
				if(item.getAttribute("data-idx") == val) {
					item.style.display = "";
				} else {
					item.style.display = "none";
				}
			});
		}
		else if(act_v == "video_down") {
			// 비디오 시청 버튼 클릭
			var eroot 		= util.findObjectByAttr(evo, "data-code", null);
			var idx_v 		= eroot.getAttribute("data-idx");
			var type_v 		= eroot.getAttribute("data-type");
			var title_v 	= eroot.getAttribute("data-title");
			var depth_v 	= eroot.getAttribute("data-depth");
			var curr_v 		= eroot.getAttribute("data-curr");
			var code_v 		= eroot.getAttribute("data-code");
			var name_v 		= eroot.getAttribute("data-name");
			var formats_v 	= eroot.getAttribute("data-formats");
			var no_v = "";

			player.vodPlayer(no_v, type_v, title_v, idx_v, curr_v, depth_v, name_v, code_v);
		}
		else if(act_v == "item_down") {
			// 다운로드 버튼 클릭
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
					var idx_v = eroot.getAttribute("data-idx");

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
					pItem.pObject = eroot;
					pItem.grammIdx = idx_v;

					if(_site_id == "M" || _site_id == "H") {
						//pItem.price = 1350;
					}

					// 구문독해 - 구문활용독해 금액 예외처리
					if (group_v == "P" && coretype_v == "E5") {
						//pItem.price = 1500;						
					}

					_hLog("pItem=" + JSON.stringify(pItem));


					var coretypeFilter = ["S", "V", "C"];

					_Unit.drawPriceButtons(pItem, function(data) {
						var list_o = eroot.querySelector(".detailLink");
						$(span_o).addClass("active");
						em_a[0].style.display = "none";
						em_a[1].style.display = "inline";
						list_o.style.display = "block";
					});
				}
			}
		}
	}

	return {
		init: function(list_p, flag, kind_p, parent_p, site_id_p, exPaprNoList_p){
			_init(list_p, flag, kind_p, parent_p, site_id_p, exPaprNoList_p);
		},
		getList: function(){
			return list;
		}
	}
}();




