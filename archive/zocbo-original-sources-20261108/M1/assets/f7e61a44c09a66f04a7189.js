/*
	사업제휴 / 광고문의
*/
var biz = function() {
	var _id = "biz";
	var viewMode = null;
	var root = null;
	var parent_o = null;
	var scroll_p = null;

	var _init = function() {
		root = document.querySelector("[data-id='" + _id + "']");
		viewMode = "phone";
		$(root).show();
		window.scrollTo (0,0);
		_initEvent();
	};

	var _initEvent = function() {
		if(root) {
			$(root).find(".headTop a").bind("click", function() {return false;});
			$(root).find(".accountMenu a").bind("click", function() {return false;});

			var selector_str = "[data-src='" + _id + "'][data-act]";
			$(root).find(selector_str).unbind();
			$(root).find(selector_str).bind("click", function(ev) { return false;});
			$(root).find(selector_str).bind("click", function(ev) {_click(ev);});

			var fo = root.querySelector("#Cooper_File");
			$(fo).unbind();
			$(fo).bind("change", function(ev){
				var file_v = fo.value;
				var fn = root.querySelector(".fileName");

				var filename_v = file_v.substring( file_v.lastIndexOf("\\") + 1 );

				if(!util.checkUploadFileName(filename_v)) {
					fo.value = null;
					common.alert("알림", "영어 파일명만 등록 가능합니다.", null, function(){
						$(fn).find(".name").html("");
						$(fn).hide();
					});
					return;
				}

				//$(fn).find(".name").html(filename_v);
				//fn.style.display = "";
				
				$("#bizFileName").find(".name").html(filename_v);
				$("#bizFileName").css("display", "");
			});
		}
		common.resetA();
		common.init();
	};

	var _click = function(ee) {
		var ev = window.event || ee;
		var evo = ev.srcElement || ev.target;
		var act_v = evo.getAttribute("data-act");
		if(act_v == null) {
			act_v = evo.parentNode.getAttribute("data-act");
		}
		_hLog("act=" + act_v);
		if(act_v == "submit") {
			var f = root.querySelector("#form1");			

			if(_h.form.checkValid(f)) {

				var email_o = root.querySelector("[name='email']");
				var email = email_o.value;
				if(!_h.valid.isEmail(email)){
					common.alert("알림", "이메일 형식이 올바르지 않습니다.", null, function(){});
					return;
				}

				var hp1_o = root.querySelector("[name='Mem_Hp1']");
				var hp2_o = root.querySelector("[name='Mem_Hp2']");
				var hp3_o = root.querySelector("[name='Mem_Hp3']");

				var hp1 = hp1_o.value;
				var hp2 = hp2_o.value;
				var hp3 = hp3_o.value;

				var hpLength = hp1.length + hp2.length + hp3.length;

				var isPhone = true;

				if(!(_h.valid.isNumber(hp1)) || !(_h.valid.isNumber(hp2)) || !(_h.valid.isNumber(hp3)) ) {
					isPhone = false;
				} else if (hpLength < 11) {
					isPhone = false;
				}

				if(!isPhone) {
					common.alert("알림", "연락처 형식이 올바르지 않습니다.", null, function(){});
					return;
				}

				if($("#user-privacy").is(":checked") == false) {
					$("#privacy_chk").addClass("is-active");
					return;
				} else {
					$("#privacy_chk").removeClass("is-active");
				}

				var formData = new FormData(f);

				$.ajax({
			        type: "POST",
			        enctype: 'multipart/form-data',
			        url: "./biz_p.asp",
			        data: formData,
			        processData: false,
			        contentType: false,
			        cache: false,
			        timeout: 600000,
			        success: function (data) {
						if(data == "10") {
							common.toast("허용된 첨부파일 확장자가 아닙니다.", null);
						} else {
			        		common.toast("정상적으로 등록되었습니다.", function(){
			        			_closePopup();
			        		});
						}
			        },
			        error: function (e) {
			            _hLog("ERROR : ", e);
			        }
			    });
			}
			return false;
		}
		else if (act_v == "removeFile") {
			$("#Cooper_File").val("");
			var fn = root.querySelector(".fileName");
			//$(fn).find(".name").html("");
			//fn.style.display = "none";
			
			$("#bizFileName").find(".name").html("");
			$("#bizFileName").css("display", "none");
		} else if (act_v == "closePopup") {
			_closePopup();
		}
	};

	var _closePopup = function(){
		//window.scrollTo(0, scroll_p);
		//$(root).hide();
		//$(parent_o).show();
		window.location.href = "/";
	};

	return {
		init:function() {
			_init();
		},

		show: function(parent_id, scroll){
			parent_o = parent_id;
			scroll_p = scroll;
			_init();
		}
	};
}();

