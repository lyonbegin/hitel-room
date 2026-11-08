/*
	로그인 팝업
*/
var loginPop = function() {
	var _id = "loginPop";
	var root = null;
	var param = null;
	var parent_o = null;
	var p_rtnURL = null;
	var accessLogin = false;

	var _init = function() {
		root = document.querySelector("[data-id='" + _id + "']");
		root.style.display = "";
		root.style.padding = "0px";

		param = util.queryStringToJSON(null);
		_hLog("param=" + JSON.stringify(param));
		_initEvent();

		if(parent_o){
			$(parent_o).hide();
		}
	};

	var _initEvent = function() {
		if(root) {
			var selector_str = "[data-src='" + _id + "'][data-act]";
			$(root).find(selector_str).unbind();
			$(root).find(selector_str).bind("click", function() {return false;});
			$(root).find(selector_str).bind("click", function(ev) {_click(ev);});
		}
	};

	var _click = function(ee) {
		var ev = window.event || ee;
		var evo = ev.srcElement || ev.target;
		evo = util.findEventObject(ev, null);
		var act_v = evo.getAttribute("data-act");
		_hLog(_id + " act=" + act_v);
		if(act_v == "close") {
			root.style.display = "none";
			// 로그인이 되어있어야 하는 화면일 경우 팝업의 닫기 버튼 클릭시 메인페이지로 이동
			// 그렇지 않은 경우 팝업만 닫기
			if(accessLogin) {
				document.location.href = "/Default.asp";
			} else if (parent_o && !accessLogin){
				$(parent_o).show();
				$(root).find(".formMsg").hide();

			} else if (parent_o == null) {
				document.location.href = "/Default.asp";
			}

			var pathname = location.pathname;

			if(pathname == "/" || pathname == "/Default.asp") {
				main.initSlider();
			}

			common.initSlider();
		}
		else if(act_v == "findID") {
			document.location = "/member/find_id.asp";
		}
		else if(act_v == "findPW") {
			document.location = "/member/find_pw.asp";
		}
		else if(act_v == "join") {
			//document.location = config.WWW_ETOOS_URL + "/member/join_01_new.asp?returnurl=" + config.SSL_ZOCBO_URL;
			//document.location = config.SIGN_ZOCBO_URL;
			var join_return_url = $("#loginPopJionSignURL").val()
			document.location = join_return_url;
		}
		else if(act_v == "login") {
			_TRK_PI = "LIF";
			var f = root.querySelector("#form1");
			if(_h.form.checkValid(f)) {
				// 동시 접속 체크
				var url_v = "/_api/member.api.asp";
				var data_v = {};
				data_v["cmd"] = "ACCESS_CHECK";
				data_v["mem_ID"] = f.mem_ID.value;
				comm.send(url_v, data_v, "post", function(data) {
					// data.result = "1";
					if(data.msg) {
						if(data.result == "1") {
							// 연결을 끊고 접속.
							common.alert("알림", data.msg, {}, function(){
								_loginProc();
							});
						}
						else {
							common.alert("알림", data.msg, null, {});
						}
					}
					else {
						_loginProc();
					}
					sessionStorage.setItem("loginID", f.mem_ID.value);
				});

			}
		}
	};

	var _loginProc = function() {
		var pathname = $(location).attr('pathname');
		var search   = $(location).attr('search');

		var sbm_id  = $('#mem_ID').val();
		if(sbm_id == null) {
			sbm_id = $("input[name='mem_ID']").val();
		}
		var sbm_pw  = $('#mem_PWD').val();
		if(sbm_pw == null) {
			sbm_pw = $("input[name='mem_PWD']").val();
		}

		//var sbm_url = config.ETS_ZB_URL + "/member/Login_Check.asp";
		var sbm_url = config.SSL_ZOCBO_URL + "/member/Login_Check.asp";

		$('#pwd').val(sbm_pw);
		$('#returnurl').val(sbm_url);

		var mUrl_v = "/member/Interchange/Login.Check.asp";
		var data_v = {};
		data_v["mem_id"] = sbm_id;
		data_v["pwd"] = sbm_pw;
		data_v["returnUrl"] = sbm_url;

		comm.send(mUrl_v, data_v, "post", function(data) {
			// 본사 PM 알럿
			if (data.err_cd == "999") {
				r_url_v = "";
				window.location.href = "http://notice.eduzone.co.kr/";
				return;
			} else {
				err_cd = data.err_cd;
				if (data.err_cd < 0) {
					common.alert(null, data.err_msg, null, {});

					if(data.err_cd == -2) {
						document.location.href = config.WWW_ETOOS_URL + "member/member_confirm_pwd.asp?loginID=" + sbm_id;
					} else {
						common.alert("알림", data.err_msg, null, function(){

						});
					}
					return false;
				} else if (data.err_cd == 0) {
					// 통합 사이드 로그인 처리단
					//var r_url_v = config.ETS_ZB_URL + "/member/Login_Check.asp?RtnUrl=" + encodeURIComponent(encodeURIComponent(p_rtnURL));
					if (p_rtnURL != undefined && p_rtnURL != "") {
						var r_url_v = config.SSL_ZOCBO_URL + "/member/Login_Check.asp?RtnUrl=" + encodeURIComponent(encodeURIComponent(p_rtnURL));
					} else {
						var r_url_v = config.SSL_ZOCBO_URL + "/member/Login_Check.asp?RtnUrl=";
					}
					//var r_url_v = config.SSL_ZOCBO_URL + "/member/Login_Check.asp?RtnUrl=" + encodeURIComponent(encodeURIComponent(p_rtnURL));
					$("#form1 #returnurl").val(r_url_v);
					$('#form1').attr('action', config.WWW_ETOOS_URL + '/member/login_sql.asp').attr('encoding', 'application/x-www-form-urlencoded');
					$('#form1').submit();
					return;
				} else if (data.err_cd > 0) {
					// 족보닷컴 사이드 로그인 처리단
					$("#form1 #RtnUrl").val(p_rtnURL);
					$('#form1').attr('action', '/member/Login_Check.asp').attr('encoding', 'application/x-www-form-urlencoded');
					$('#form1').submit();
					return;
				}
			}
		});

	};


	return {
		show:function(parent_p, rtnURL_p, accessLogin_p) {
			sessionStorage.setItem("rtnUrl", rtnURL_p);
			//location.href = '/member/login.asp';

			var RtnUrl = rtnURL_p;
			var form = document.createElement("form");
			var hiddenField = document.createElement("input");	

			form.setAttribute("charset", "UTF-8");
			form.setAttribute("method", "Post");
			form.setAttribute("action", "/Member/login.asp");		

			hiddenField.setAttribute("type", "hidden");
			hiddenField.setAttribute("name", "RtnUrl");
			hiddenField.setAttribute("value", RtnUrl);

			form.appendChild(hiddenField);
			document.body.append(form);
			form.submit();

//			parent_o = parent_p;
//			p_rtnURL = rtnURL_p;
//			if(accessLogin_p){
//				accessLogin = accessLogin_p;
//			} else {
//				accessLogin = false;
//			}
//			_init();
		},
		init:function() {
			_init();
		}
	};
}();

