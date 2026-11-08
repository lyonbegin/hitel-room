/*
	이용약관
*/
var policyInc = function() {

	var _id = "policyInc";
	var root = null;
	var mainRoot = null;
	var scroll = null;

	var callCheck = 0;

	var _init = function() {
		param = util.queryStringToJSON(null);
		_hLog("param=" + JSON.stringify(param));
		root = document.querySelector("[data-id='" + _id + "']");

		if(root == null) {
			_hLog(_id + " root not found");
			return;
		}

		var selected = $('#oldAgreementLst option:selected').val();
		$("#oldAgreement").load(selected);
        $('#oldAgreementLst').on('change', function(){
            var selected = $('#oldAgreementLst option:selected').val();
            $('#oldAgreement').load(selected);
        });

		_initShow();
		_initEvent();
	};

	var _initShow = function() {
		$(mainRoot).css("display", "none");
		$(root).css("display", "");
		$(window.document).scrollTop(0);
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

	// 이용약관 List
	var _loadList = function() {
		var url_v = "/_api/customer.api.asp";
		var data_v = "cmd=Agreement_LIST";
		comm.send(url_v, data_v, "post", function(data) {	
			if(data.list) {
				var list_a = data.list;

				for(var i = 0; i < list_a.length; i++) {
					var item = list_a[i];
					_drawItem(item, i);
				}
			}else{
			}
		});
	};

	// 개인정보 처리방침 목륵 그리기 
	var _drawItem = function(item, pos) {
		if(item == null) return;
		var slc_o = root.querySelector("#oldAgreementLst");
		if(slc_o == null) {
			_hLog(slc_o + " not found list object");
			return;
		}

		if (item == "")					//데이터가 없을때
		{	 
			var op_o = document.createElement("option");
			op_o.value = "";
			op_o.innerHTML = "데이터가 존재하지 않습니다.";
			slc_o.appendChild(op_o);
		}else
		{
			var op_o = document.createElement("option");
			op_o.value = item.IDX;
			op_o.innerHTML = "시행기간 "+_dateFormat(item.StartDate)+" ~ "+_dateFormat(item.EndDate);
			slc_o.appendChild(op_o);

			//처음로딩시
			$(document).ready(function(){
				if (item.RowNum == 1)
				{
					var url_v = "/Inc/"+item.AgreementFileName;
					$.ajax({
						url: url_v,
						type: "post",
						data: "",
						async: false,
						dataType:"html",
						success: function(data) {
							$("#oldAgreement").html(data);
						},
						error: function(xhr){ 
							alert("에러가 발생하였습니다.");
							//error logic
						}
					});
				}
			});

			//select box 변환시
			$(slc_o).bind("change", function(ev) {
				if ($(this).val() == item.IDX)
				{					   
					var url_v = "/Inc/"+item.AgreementFileName;
					$.ajax({
						url: url_v,
						type: "post",
						data: "",
						async: false,
						dataType:"html",
						success: function(data) {
							$("#oldAgreement").html(data);
						},
						error: function(xhr){ 
							alert(xhr);
							//error logic
						}
					});
				}
				return false;
			});
		}
	};	   


	var _click = function(ee) {
		var ev = window.event || ee;
		var evo = ev.currentTarget || ev.target;
		var act_v = evo.getAttribute("data-act");
		_hLog("act=" + act_v);
		if(act_v == "closePopup") {
			$(root).css("display", "none");
			$(mainRoot).css("display", "");
			//main.initSlider();
			window.scrollTo(0, scroll);
		}
		else if(act_v == "changeTerm") {
			var terms = evo.getAttribute("data-terms");
			_hLog("terms:" + terms);
			if(terms == "oldTerms"){
				$(evo).parent().addClass("active");
				$(root).find("#oldTerms").css("display", "");
				$(root).find("[data-terms='newTerms']").parent().removeClass("active");
				$(root).find("#newTerms").css("display", "none");
			}
			else if(terms == "newTerms"){
				$(evo).parent().addClass("active")
				$(root).find("#newTerms").css("display", "");
				$(root).find("[data-terms='oldTerms']").parent().removeClass("active");
				$(root).find("#oldTerms").css("display", "none");
			}
		}
	};

	var _dateFormat = function(YYMMDD){
		var d = new Date(YYMMDD)
		var year = d.getFullYear();
		var month = d.getMonth() + 1;
		var day = d.getDate();			   

		return year+"년 "+month+"월 "+day+"일";
	}


	return {
		init:function() {
			_init();
		},

		show:function(_mainRoot, scroll_p) {
			if(_mainRoot){
				mainRoot = _mainRoot;
				scroll = scroll_p;
				_init();
			}
		}
	};
}();