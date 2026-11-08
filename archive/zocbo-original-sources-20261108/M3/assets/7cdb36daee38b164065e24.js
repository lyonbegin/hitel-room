/*
	커뮤니티 상세 팝업 
*/
var community_r = function() {
	var _id = "community_r";
	var root = null;
	var boardKind = null;
	var categoryItems = [{"pos":0, "title":"성적이 올랐어요",		"boardKind":1, "tbl_id": "tb_ComScore"},
						 {"pos":1, "title":"이 문제 풀어주세요",		"boardKind":2, "tbl_id": "tb_Problem"},
						 {"pos":2, "title":"우리학교 시험정보",		"boardKind":3, "tbl_id": "tb_ComOurSchool"},
						 {"pos":3, "title":"SKY 멘토와 상담하세요",	"boardKind":4, "tbl_id": "SkyMentor"},
						 {"pos":4, "title":"우리는 말한다",			"boardKind":5, "tbl_id": "tb_Problem"}
 						];

	var replyItems = [];
	var loginID = null;
	var zb_No = null;

	var parent_o = null;

	var isAdmin = false;

	var _init = function() {
		root = document.querySelector("[data-id='" + _id + "']");
		$(root).show();

		if(boardKind == 5) {
			var file_o = $(".file");
			file_o.hide();
		}

		_loadReply();

		// 유저 로그인 ID 체크
		comm.send("/_api/member.api.asp", "cmd=GET_USERINFO", "get", function(userData){
			if(userData){
				if(userData.memList){
					loginID = userData.memList[0].mem_ID;
				} else {
					loginID = null;
				}
			}
		});

		// 관리자 체크
		common.checkAdmin(function(fg){
			isAdmin = fg;
		});
		
		_initEvent();
	};
	// 이벤트 초기화
	var _initEvent = function() {
		if(root) {

			$(root).find("a").bind("click", function(){ return false; });

			var selector_str = "[data-src='" + _id + "'][data-act]";
			$(root).find(selector_str).unbind();
			$(root).find(selector_str).bind("click", function() {return false;});
			$(root).find(selector_str).bind("click", function(ev) {_click(ev);});

			// 첨부 파일 변경 이벤트 
			var fo = root.querySelector("#sr_File1");
			$(fo).unbind();
			$(fo).bind("change", function(ev) {
				var file_v = fo.value;
				var filename_v = file_v.substring( file_v.lastIndexOf("\\") + 1 );
				var fn = root.querySelector(".filename");
				
				$(fn).find(".name").html(filename_v);
				fn.style.display = "";
			});

			// 댓글 창 이벤트
			$('.repBtn button').on('click',function(){
				common.checkLogin(function(fg) {
					if(fg) {
						$(".repBtn").hide();
						$(".repBtn").next().show();
						$("#comment").focus();
					}
					else {
						loginPop.show(root, _rtnUrl, false);
					}
				})
				return false;
			});

			// 댓글 창 이벤트
			$('.repForm .fileBtn .cancel').on('click',function(){
				$('.repForm').hide()
				$('.repBtn').show();
				return false;
			});
		}
		common.init();
	};

	// 댓글 가져오기
	var _loadReply = function() {

		var ul_o = root.querySelector(".repList");
		ul_o.innerHTML = "";

		var url_v = "/_api/community.api.asp";
		var data_v = "cmd=REPLYB&zb_No=" + zb_No + "&boardKind="+boardKind;
		comm.send(url_v, data_v, "post", function(repData) {
			var reqNum_o = root.querySelector(".repNum");
			reqNum_o.innerHTML = "댓글 0";
			if(repData.list) {
				replyItems = repData.list;
				reqNum_o.innerHTML = "댓글 " + util.toNumber(replyItems.length);
				for(var i = 0; i < replyItems.length; i++) {
					var replyItem = replyItems[i];
					_drawReplyItem(replyItem, i);
				}
			}else {
				replyItems = repData.list;
				var li_o = document.createElement("li");
				li_o.className = "norepple";
				li_o.innerHTML = "등록 된 댓글이 없습니다.";
				ul_o.appendChild(li_o);
				return;
			}
		});
	};

	// 댓글 창 그리기
	var _drawReplyItem = function(item, pos) {
		var ul_o = root.querySelector(".repList");
		
		if(item == null) {
			return;
		}

		_initForm();

		var memID = item.zMem_ID || item.Mem_ID;

		var isMe = (loginID == memID);

		if(!isMe && !isAdmin) {
			memID = util.mask(memID, 3, "*");
		}

		var comment = item.Comment;
		var regDate = item.RegDate;
		var file = item.Attach_File || item.zb_file;

		var li_o = document.createElement("li");
		ul_o.appendChild(li_o);

		var p_o = document.createElement("p");
		p_o.className = "repInfo";
		if(boardKind != 5) {
			p_o.innerHTML = "<b>" + memID + "</b>";
		}
		p_o.innerHTML += regDate.substr(0,10);
		li_o.appendChild(p_o);

		p_o = document.createElement("p");
		p_o.className = "text";
		p_o.innerHTML = comment;
		li_o.appendChild(p_o);

		var idx = item.idx || item.AC_Idx;
		
		// 삭제 버튼 그리기 및 이벤트 바인딩
		if(isMe || isAdmin) {
			p_o = document.createElement("p");
			p_o.className = "delect";

			var button_o = document.createElement("button");
			button_o.innerHTML = "<img src='../img/ico_delect_repple.png' width='10' alt=''>";
			$(button_o).bind("click", function(ev){
				var evo = util.findEventObject(ev, null);
				var tbl_id = "";
				categoryItems.forEach(function(data){
					if(data.boardKind == boardKind) {
						tbl_id = data.tbl_id;
						return;
					}
				});
				var data_v = new FormData();
				data_v.append("idx", idx);
				data_v.append("zb_No", zb_No);
				data_v.append("flag", 2);
				data_v.append("tbl_id", tbl_id);
				data_v.append("scl_ID", "comment");

				comm.toggleLoading(true);

				// 댓글 삭제 이벤트
				$.ajax({
					type: "POST",
					url: "/community/Comments_p.asp",
					enctype: "multipart/form-data",
					data: data_v,
					processData: false,
					contentType:false,
					cache: false,
					timeout: 600000,
					success: function(data){
						if(data.startsWith('<')) {
			        	// html tag remove
			        	var newText = data.replace(/(<([^>]+)>)/ig,"");

			        	_hLog(newText);
			        	return;
			        	} else {
				        	data = eval("(" + data + ")");
				        	if(data.result == "0") {
				        		_loadReply();
				        	}
				        	else {
				        		common.alert("알림", data.msg, {}, null);
				        	}
			        	}
			        	comm.toggleLoading(false);
			    	},
				    error: function(e){
				    	comm.toggleLoading(false);
				    	_hLog("error = " + JSON.stringify(e) );
				    }
				});
				return false;
			});
			p_o.appendChild(button_o);
			li_o.appendChild(p_o);
		}

		// 첨부 파일
		if(util.isEmpty(file) == false) {
			p_o = document.createElement("p");
			p_o.className = "mT5";
			
			var a_o = document.createElement("a");
			a_o.className = "btn_fileDown";
			a_o.innerHTML = "파일 다운로드 <img src=\"../img/ico_down.png\" width=\"10\" alt=\"\">";
			a_o.href = "/Community/Download.asp?t_File="+idx+"&gubun=Comment";
			p_o.appendChild(a_o);

			li_o.appendChild(p_o);
		}
	};

	// 폼 초기화
	var _initForm = function() {
		var f = root.querySelector("#replyForm");
		f.reset();

		var file_o = $(root).find(".file");
		if(file_o && boardKind != 5){
			file_o.show();

			var fn_o = file_o.find(".filename");
			if(fn_o) {
				fn_o.hide();
				fn_o.find(".name").html("");
			}			
		}

		var repForm = $(root).find(".repForm");
		if(repForm) {
			repForm.hide();
			$('.repBtn').show();

			var replyInfo_o = repForm.find("#replyInfo");
			replyInfo_o.html("0");
		}

		var comment_o = $(root).find("#comment");
		if(comment_o) {
			comment_o.html("");	
		}
	};

	var _click = function(ee) {
		var ev = window.event || ee;
		var evo = ev.srcElement || ev.target;
		evo = util.findEventObject(ev, null);
		var act_v = evo.getAttribute("data-act");
		_hLog("act=" + act_v);

		var f = root.querySelector("#replyForm");

		if(act_v == "replyCancel") {
             $('.repForm').hide()
             $('.repBtn').show();
		}
		// 댓글 등록
		else if(act_v == "replySubmit") {
			// 차단 아이디 체크			
			comm.send("/_api/community.api.asp", "cmd=BLOCK_ID_CHECK", "get", function(data) {
				if(data.result == "Y") {
					common.alert("알림", "회원님께서는 게시판 운영 정책을 위반하여(반복적인 게시물 작성 등) 커뮤니티 이용이 제한되었습니다. 관련 문의사항은 1:1문의를 이용해 주시기 바랍니다.", null, {});
				} else {
					if(_h.form.checkValid(f)) {
						var data_v = new FormData(f);
	
						data_v.set("tbl_id", "tb_Problem");
						data_v.set("scl_ID", "Comment");
						
						if(zb_No) {
							data_v.set("zb_No", zb_No);
						}
	
						var comment = data_v.get("comment");
	
						for (var pair of data_v.entries()) {
							if(typeof(pair[1]) == "string") {
								data_v.set(pair[0], escape(pair[1]));
							}
						}
	
						comm.toggleLoading(true);
						
						$.ajax({
							type: "POST",
							enctype: 'multipart/form-data',
							url: "/Community/Comments_p.asp",
							data: data_v,
							processData: false,
							contentType: false,
							cache: false,
							timeout: 600000,
							success: function (data) {
								
								if(data.startsWith('<')) {
									// html tag remove
									var newText = data.replace(/(<([^>]+)>)/ig,"");
	
									_hLog(newText);
									return;
								} else {
									data = eval("(" + data + ")");
									if(data.result == "0") {
										_loadReply();
										community.loadList();
									}
									else {
										common.alert("알림", data.msg, {}, null);
									}
								}
								comm.toggleLoading(false);
							},
							error: function (e) {
								comm.toggleLoading(false);
								_hLog("ERROR : " + JSON.stringify(e));
							}
						});
	
					}
				}
			});
			
			return false;
		}
		else if(act_v == "removeFile") {
			// 첨부 파일 제거
			$("#sr_File1").val("");
			var fn = root.querySelector(".filename");
			$(fn).find(".name").html("");
			fn.style.display = "none";
		} else if (act_v == "closePopup"){
			// 팝업 닫기
			$(root).hide();
			$(parent_o).show();
			community.loadList();
		}
	};

	return {
		init:function() {
			_init();
		},

		show: function(_parent_o, _boardKind, _zb_No){
			parent_o = _parent_o
			boardKind = _boardKind;
			zb_No = _zb_No;
			_init();
		}
	};
}();