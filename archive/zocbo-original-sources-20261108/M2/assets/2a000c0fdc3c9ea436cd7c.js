/*
	오답신고/불만신고
*/
var report_w = function() {
	
	var root = null;
	var _id = "report_w";
	var param = null;
	var pRoot = null;
	var _data = null;
	
	var reportGubun = "오답신고";

	var _init = function() {
		param = util.queryStringToJSON(null);
		_hLog("param=" + JSON.stringify(param));
		root = document.querySelector("[data-id='" + _id + "']");
		_initEvent();
	};

	var _initEvent = function() {
		if(root) {
			var selector_str = "[data-src='" + _id + "'][data-act]";
			$(root).find(selector_str).unbind();
			$(root).find(selector_str).bind("click", function() {return false;});
			$(root).find(selector_str).bind("click", function(ev) {_click(ev);});

			var selector_str = "[data-src='" + _id + "_input'][data-act]";
			$(root).find(selector_str).unbind();
			$(root).find(selector_str).bind("input", function() {return false;});
			$(root).find(selector_str).bind("input", function(ev) {_input(ev);});
		}
		
		if (_data.section == "2")
		{
			reportGubun = "오답신고"
		} else if (_data.section == "3")
		{
			reportGubun = "불량신고"
		} else if (_data.section == "5")
		{
			reportGubun = "건의사항"
		}

		$("#reportGubun").text(reportGubun);
		common.resetA();
		common.init();
	};

	// 클릭이벤트
	var _click = function(ee) {
		var ev = window.event || ee;
		var evo = ev.currentTarget || ev.target;
		var act_v = evo.getAttribute("data-act");
		_hLog("act=" + act_v);
		if(act_v == "close"){
			report_w.hide();
		}
		else if(act_v == "register") {
			var content_v = root.querySelector("#reportContent").value;
			var title = root.querySelector("#reportTitle").value;
			var expapr_no = _data.expapr_no;
			var section = _data.section;
			var exdown_no = _data.exam_DownNo;

			/*if(title == ""){
				alert("제목을 입력해주세요");
				return;
			}*/
			if(content_v == ""){	   
				alert("내용을 입력해주세요");
				return;
			}
			if(expapr_no == null || expapr_no == ""){
				return;
			}
			if(section == null || section == ""){
				return;
			}

			if(typeof exdown_no == "undefined" || exdown_no == null || exdown_no == "")
			{
				exdown_no = "";
			}

			if(title == ""){
				title = reportGubun;
			}
			//alert(title);
			//return;

			content_v = content_v.replace(/\r\n/g, '<br>');
			content_v = content_v.replace(/\n/g, '<br>');
			content_v = content_v.replace(/\r/g, '<br>');

			evo.style.display = "none";		// 버튼가리기

			var url_v = "/_api/customer.api.asp";
			var data_v = "cmd=WRITE_EXAM_REPORT";
			data_v += "&exPapr_no=" + expapr_no + "&section=" + section + "&Content=" + encodeURIComponent(content_v) + "&Title="+title + "&exam_DownNo=" + exdown_no;

			comm.send(url_v, data_v, "post", function(json){
				if(json){
					if(json.ResultCount == "0"){
						common.toast("정상적으로 등록되었습니다.", function(){
							_reset();
							report_w.hide();
							evo.style.display = "";		// 버튼보이기
						});
					}
				}
			});
		}
	};

	// 키 인풋 이벤트
	var _input = function(ee) {
		var ev = window.event || ee;
		var evo = ev.currentTarget || ev.target;
		var act_v = evo.getAttribute("data-act");
		_hLog("act=" + act_v);
		if(act_v == "checkInput"){			
			//var cutStr = util.cutInputStr(evo.value, 500);
			//var bytes = util.calcByteLen(cutStr);		
			var cutStr = evo.value.substring(0, 500);
			var bytes = cutStr.length;	//길이로 변경

			//alert("cutStr = " + cutStr + ", bytes = " + bytes);

			evo.value = cutStr;
			$(root).find("#byteLen").text(bytes);
		}
	};

	// 초기화
	var _reset = function(){
		root.querySelector("#reportTitle").value = "";
		root.querySelector("#reportContent").value = "";
		_data = null;
	};

	return {
		init:function() {
			_init();
		},

		show:function(_pRoot, data) {
			common.checkLogin(function(fg, json){
				if(fg){
					zUserID = json.user_id;

					if(_pRoot){
						pRoot = _pRoot;
					}
					if(data){
						_data = data;
					}			
					_init();
					$(pRoot).hide();
					$(root).show();
				} else {
					loginPop.show(root, _rtnUrl, false);
				}
			});
		},

		hide:function() {
			_reset();
			$(root).hide();
			$(pRoot).show();
		},
	};
}();