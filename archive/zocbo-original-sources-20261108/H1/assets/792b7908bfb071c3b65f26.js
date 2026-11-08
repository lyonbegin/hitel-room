/*
	멘토 소개 팝업
*/
var mentoPop = function() {
	var _id = "mentoPop";
	var root = null;
	var _pos = null;
	var _parentID = null;

	var _init = function() {

		root = document.querySelector("[data-id="+_id+"]");

		if(root == null) {
			_hLog(_id + "root not found");
			return;
		}

		$(root).show();
		$(root).css("padding-top", "0px");

		_drawData();
		_initEvent();
	};

	// 멘토 정보 그리기
	var _drawData = function(){
		var item = _mentoList[_pos];

		var mento_p_o = root.querySelector(".mento");

		mento_p_o.innerHTML = "<dt><span><img src='"+item.img+"' alt=''</span></dt>";
		mento_p_o.innerHTML += "<dd><b>"+item.university+"</b> 멘토 " + item.name +"</dd>";

		var awardsList_o = root.querySelector("#awardList");
		awardsList_o.innerHTML = "";
		$("#awardList").hide();

		if (item.awards.length > 0) {
			$("#awardList").show();
			awardsList_o.innerHTML = "<dt>수상내역</dt>";

			var awards = item.awards;
			// 수상 내역
			for(var i=0; i<awards.length; i++) {
				var dd_o = document.createElement("dd");
				dd_o.innerHTML = awards[i];
				awardsList_o.appendChild(dd_o);
			}
		}

		var socialList_o = root.querySelector("#socialList");
		socialList_o.innerHTML = "";
		$("#socialList").hide();

		if (item.social.length > 0) {
			$("#socialList").show();

			socialList_o.innerHTML = "<dt>봉사 동아리/사회 활동</dt>";

			var social = item.social;
			// 활동 내역
			for(var i=0; i<social.length; i++) {
				var dd_o = document.createElement("dd");
				dd_o.innerHTML = social[i];
				socialList_o.appendChild(dd_o);
			}
		}
	};

	// 이벤트 초기화
	var _initEvent = function() {
		if(root) {
			var selector_str = "[data-src='" + _id + "'][data-act]";
			$(root).find(selector_str).unbind();
			$(root).find(selector_str).bind("click", function() {return false;});
			$(root).find(selector_str).bind("click", function(ev) {_click(ev);});
		}

		common.init();
	};


	var _click = function(ee) {
		var ev = window.event || ee;
		var evo = ev.srcElement || ev.target;
		evo = util.findEventObject(ev, null);
		var act_v = evo.getAttribute("data-act");

		_hLog("act = " +act_v);
		if(act_v == "closePopup") {
			$(root).hide();
			$("[data-id="+_parentID+"]").show();
		}
	};

	return {
		init:function() {
			_init();
		},

		show: function(parent_id, pos){
			_parentID = parent_id;
			_pos = pos;
			_init();
		}
	};
}();

