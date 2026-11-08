/*
	비밀번호 확인 팝업
*/
var checkPwdPop = function(){

	var _id = "checkPwdPop";
	var _parentId = null;
	var root = null;

	var _init = function(){

		root = document.querySelector("[data-id='"+_id+"']");
		if(root == null) {
			_hLog("root " + _id + "not found");
			return;
		}
		if(_parentId == null) return;

		root.style.paddingTop = "0px";
		root.style.display = "";
		_initEvent();
	};

	// 이벤트 초기화
	var _initEvent = function(){
		if(root) {
			var selector_str = "[data-src='" + _id + "'][data-act]";
			$(root).find(selector_str).unbind();
			$(root).find(selector_str).bind("click", function() {return false;});
			$(root).find(selector_str).bind("click", function(ev) {_click(ev);});
		}
	};

	var _click = function(ee){

		var ev = window.event || ee;
		var evo = ev.srcElement || ev.target;
		evo = util.findEventObject(ee, null);
		var act_v = evo.getAttribute("data-act");
		_hLog("act_v = " +act_v);
		var parent_o = document.querySelector("[data-id='"+_parentId+"']");

		if (act_v == "close") {
			// 팝업 창 닫기 
			root.style.display = "none";
			parent_o.style.display = "";
		} else if (act_v == "submit") {

			var pw = root.querySelector("#pwd").value;

			var data_v = "cmd=CHECK_PASSWORD&pw="+pw;
			
			// 비밀번호 체크 
			comm.toggleLoading(true);
			comm.send("/_api/member.api.asp", data_v, "get", function(data){
				if(data){
					if(data.result == 0) {
						document.location.href = "/MyPage/myInfoEdit.asp";
					} else {
						common.alert("알림", data.msg, null, function(){
						});
					}
				}
				comm.toggleLoading(false);
			});
		}
	}


	return {
		init : function(){
			_init();
		},
		show: function(data_p){
			_parentId = data_p;
			_init();
		}
	}
}();