/*
	1:1 문의 등록 팝업
*/
var myInfo1to1_w = function() {

	var _id = "myInfo1to1_w";
	var parent_o = null;
	var root = null;
	var scroll_p = null;

	var _selectedCateIdx1 = 0;
	var _selectedCateIdx2 = 0;

	var _init = function(){
		root = document.querySelector("[data-id='"+_id+"']");

		if(root == null) {
			_hLog(_id + " root not found");
			return;
		}
		window.scrollTo(0,0);
		$(root).show();
		_initForm();
		_loadData();
		_initEvent();
	};

	// 유저 정보 가져오기
	// 이메일,핸드폰
	var _loadData = function(){
		comm.toggleLoading(true);
		comm.send("/_api/member.api.asp", "cmd=GET_USERINFO", "get", function (data) {
			if(data) {
				if(data.list) {
					var memInfo = data.list[0];

//					var memEmail = memInfo.mem_Email.trim();
//
//					if(memEmail && memEmail != "@") {
//						root.querySelector("#email").value = memEmail;
//					}

					var memHp1 = memInfo.Mem_HP1.trim();
					var memHp2 = memInfo.Mem_HP2.trim();
					var memHp3 = memInfo.Mem_HP3.trim();

					var memHp1_o = root.querySelector("#hp1");
					var memHp2_o = root.querySelector("#hp2");
					var memHp3_o = root.querySelector("#hp3");

//					if(memHp1) {
//						memHp1_o.value = memHp1;
//					}
//
//					if(memHp2) {
//						memHp2_o.value = memHp2;
//					}
//
//					if(memHp3) {
//						memHp3_o.value = memHp3;
//					}
				}
			}
			comm.toggleLoading(false);
		});
	};

	// 1:1 문의 카테고리 그리기
	var _drawCateItem = function(type, evo){

		if(type === null ) {
			return;
		}
		if(evo == null ) {
			_hLog(_id + " evo not found");
			return;
		}

		var items = null;
		var cateIndex = 0;

		if(type == 1) {
			items = _1to1CatItems1;
			cateIndex = _selectedCateIdx1;
		} else {
			items = _1to1CatItems2;
			cateIndex = _selectedCateIdx2;
		}
	};

	// 이벤트 초기화
	var _initEvent = function(){
		if(root) {
			var selector_str = "[data-src='" + _id + "'][data-act]";
			$(root).find(selector_str).unbind();
			$(root).find(selector_str).bind("click", function() {return false;});
			$(root).find(selector_str).bind("click", function(ev) {_click(ev);});

			var fo = root.querySelector("#sr_File1");
			$(fo).unbind();
			$(fo).bind("change", function(ev){
				var file_v = fo.value;
				var fn = root.querySelector(".fileName");
				var filename_v = file_v.substring( file_v.lastIndexOf("\\") + 1 );
				var maxSize = 30 * 1024 * 1024;

				var fileExt = filename_v.substring(filename_v.lastIndexOf(".")+1, filename_v.length).toLowerCase();

				if (filename_v != ""){
					if (fileExt != "jpeg" && fileExt != "jpg" && fileExt != "gif" && fileExt != "png" && fileExt != "pdf" && fileExt != "xls" && fileExt != "xlsx" && fileExt != "doc" && fileExt != "docx" && fileExt != "ppt" && fileExt != "pptx" && fileExt != "hwp" && fileExt != "zip" && fileExt != "bmp" && fileExt != "txt" && fileExt != "csv"){
						alert("허용된 파일 타입이 아닙니다.\n\n다음형식의 파일만 업로드가 가능합니다.\n(jpeg, jpg, gif, png, pdf, xls, xlsx, doc, docx, ppt, pptx, hwp, zip, bmp, txt, csv)");
						$("#sr_File1").val("");
						var fn = root.querySelector(".fileName");
						$(fn).find(".name").html("");
						fn.style.display = "none";
						return;
					}

					//파일 용량 채크
					var fileSize = fo.files[0].size;

					if(fileSize > maxSize){
						alert("30MB 이하의 파일만 첨부 가능합니다.");
						$("#sr_File1").val("");
						var fn = root.querySelector(".fileName");
						$(fn).find(".name").html("");
						fn.style.display = "none";
						return;
					}

					if(filename_v.length > 25) {
						filename_v = filename_v.substring(0, 25) + "...";
					}

					$(fn).find(".name").html(filename_v);
					fn.style.display = "";

				} else {
					$("#sr_File1").val("");
					var fn = root.querySelector(".fileName");
					$(fn).find(".name").html("");
					fn.style.display = "none";
				}

				//if(!util.checkUploadFileName(filename_v)) {
				//	fo.value = null;
				//	common.alert("알림", "영어 파일명만 등록 가능합니다.", null, function(){
				//		$(fn).find(".name").html("");
				//		$(fn).hide();
				//	});
				//	return;
				//}

			});
		}

		common.init();
	};

	// 등록 폼 초기화
	var _initForm = function(){
		var f = root.querySelector("#rForm");

		f.reset();

		var photoList_o = f.querySelector(".photoList");

		if(photoList_o) {
			photoList_o.style.display = "none";
		}
	};

	var _click = function(ee){
		var ev = window.event || ee;
		var evo = ev.srcElement || ev.target;
		evo = util.findEventObject(ev, null);
		var act_v = evo.getAttribute("data-act");
		_hLog("act => "+ act_v);

		var f = root.querySelector("#rForm");

		if(act_v == "submit") {
			var cate1 = root.querySelector("#cate1").value;
			var cate2 = root.querySelector("#cate2").value;

			if(cate1 == '0') {
				$("#cateMsg").show();
			} else {
				$("#cateMsg").hide();
				if(_h.form.checkValid(f)) {
					var hp1_o = root.querySelector("#hp1");
					var hp2_o = root.querySelector("#hp2");
					var hp3_o = root.querySelector("#hp3");

					var hp1_v = hp1_o.value;
					var hp2_v = hp2_o.value;
					var hp3_v = hp3_o.value;

					var hpLength = hp1_v.length + hp2_v.length + hp3_v.length;

					var p_m_o = root.querySelector("#smsMsg");
					if(hpLength < 10) {
						p_m_o.style.display = "";
						return;
					} else {
						p_m_o.style.display = "none";
					}

					var isPhone = true;

					if ( !(_h.valid.isNumber(hp1_v)) || !(_h.valid.isNumber(hp2_v)) || !(_h.valid.isNumber(hp3_v)) ) {
						isPhone = false;
					}

					if(!isPhone){
						common.alert("알림", "연락처 형식이 올바르지 않습니다.", null, function(){
						});
						return;
					}

					var zb_ContentQ_o = root.querySelector("#content");
					var zb_ContentQ_v = zb_ContentQ_o.value;

					// 엔터처리
					zb_ContentQ_v = zb_ContentQ_v.replace(/(?:\r\n|\r|\n)/g, '<br/>');

					zb_ContentQ_o.value = zb_ContentQ_v;

					var data_v = new FormData(f);

					for(var pair of data_v.entries()) {
						if(typeof(pair[1]) == "string"){
							_hLog(pair[0] + ", " + pair[1]);
							data_v.set(pair[0], escape(pair[1]));
						}
					}
					_closePopup();
					comm.toggleLoading(true);
					$.ajax({
						type: "POST",
						enctype: "multipart/form-data",
						url: "/Customer/1To1_p.asp",
						data: data_v,
						contentType: false,
						processData: false,
						cache: false,
						timeout: 600000,
						success: function (data) {
							if(data) {
								console.log("data : ", data);
								data = eval("(" + data + ")");
								if(data.result == "0") {
									alert('1:1문의 작성이 완료되었습니다. 답변이 작성되면 입력하신 연락처로 메시지를 전달 드립니다.');
									myInfo1to1.loadData("refresh");
								}
								else {
									common.alert("알림", data.msg, {}, null);
								}
							} else {

							}
							comm.toggleLoading(false);
						},
						error: function (e) {
							comm.toggleLoading(false);
							console.log("ERROR : ", e);
						}
					});
				}
			}
		} else if (act_v == "close") {
			_closePopup();
		} else if (act_v == "removeFile") {
			$("#sr_File1").val("");
			var fn = root.querySelector(".fileName");
			$(fn).find(".name").html("");
			fn.style.display = "none";
		}
	};

	// 팝업 닫힐때 실행함수
	var _closePopup = function(){
		window.scrollTo(0, scroll_p);
		$(root).hide();
		$(parent_o).show();
		var f = root.querySelector("#rForm");
		f.reset();
	};

	return {
		init : function(){
			_init();
		},

		show: function(parent, scroll){
			_init();
			parent_o = parent;
			scroll_p = scroll;

			$("#titleLenInfo").text('0');
			$("#contentLenInfo").text('0');

			var cate1 = root.querySelector("#cate1").value;

			if(cate1 != "129")
			{
				if (cate1 == "131") {
					$("#cate2").empty();
					$("#cate2").append("<option value='132'>서비스 이용 문의</option>");
					$("#cate2").append("<option value='133'>결제/구매 문의</option>");
					$("#cate2").append("<option value='134'>오류문의</option>");
					$("#cate2").append("<option value='135'>건의사항/개선요청사항</option>");
					$("#cate2").append("<option value='118'>기타</option>");
				} else if (cate1 == "138") {
					$("#cate2").empty();
					$("#cate2").append("<option value='139'>회원관련</option>");
					$("#cate2").append("<option value='140'>앱기능 오류</option>");
					$("#cate2").append("<option value='141'>오류문의</option>");
					$("#cate2").append("<option value='142'>기타</option>");
				} else {
					$("#cate2").empty();
					$("#cate2").append("<option value='119'>사이트이용</option>");
					$("#cate2").append("<option value='120'>컨텐츠</option>");
					$("#cate2").append("<option value='121'>오답/불량</option>");
					$("#cate2").append("<option value='122'>상품결제</option>");
					$("#cate2").append("<option value='123'>환불/변경</option>");
					$("#cate2").append("<option value='124'>회원관련</option>");
					$("#cate2").append("<option value='126'>기타문의</option>");
				}
			}
		}
	}
}();