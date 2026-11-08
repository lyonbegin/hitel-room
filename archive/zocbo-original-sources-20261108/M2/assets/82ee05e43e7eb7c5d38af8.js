var common = function(){
	var _id = "common";
	var root = null;
	var modal_id = ".modal[role='pop-info']";

	var fullMenu = null;
	var userData = null;

	var siteItems = {"E":"초등", "M":"중등", "H":"고등", "E,M":"공통", "A":"공통", "S":"수프링", "P":"예비고1"
					,"초등":"E", "중등":"M", "고등":"H", "공통":"E,M", "수프링":"S"	, "예비고1":"P"
					//,"초등":"E", "중등":"M", "고등":"H", "공통":"A", "수프링":"S"
					};
	var isFirst = true;

	var fullBannerSlider = null;
	var premid1OutPopupChk = false;
	
	//다운로드 팝업 띄울때 정보 셋팅
	var _down_expaprGroup = "";
	var _down_expaprCoreType = "";
	var _down_paysvc = "";
	

	var _init = function(isCheckLogin) {

		root = document;

		if(window.location.pathname.toLowerCase().includes("/freetrial/"))
		{
			var this_val = document.querySelector("#fixMenu04");
			$(this_val).addClass("on");
		}

		if(isFirst) {
			fullMenu = root.querySelector("#fullMenu");
			if(fullMenu) {
				$(".bx-stop").html("");

				_checkLogin(function(fg) {
					// 로그인 중이면 전체 메뉴에 정보, 알람 표시
					var user_o = fullMenu.querySelector(".user");
					var btn_o = fullMenu.querySelector(".logout");
					var li_a = fullMenu.querySelectorAll(".myMenu li");
					var alarmCount_o = fullMenu.querySelector(".num");
					var myPage_o = $("[data-id=myPage]");
					var myPgCount_o = myPage_o.find("#alarmCount");

					var user_o = fullMenu.querySelector(".user");
					var btn_o = fullMenu.querySelector(".logout");
					var li_a = fullMenu.querySelectorAll(".myMenu li");
					var alarmCount_o = fullMenu.querySelector(".num");
					var myPage_o = $("[data-id=myPage]");
					var myPgCount_o = myPage_o.find("#alarmCount");
					if(TRK_GLB_IS_LOGIN_CD) {
						user_o.innerHTML = '<a href="/MyPage/myPage.asp">' + TRK_GLB_USER_NAME + ' <i class="fas fa-chevron-right"></i></a>';
						btn_o.style.display = "";
						li_a[2].style.display = "";
						//li_a[3].style.display = "";

						var pathname = location.pathname;

						if(!pathname.includes("alarm")) {
							if(TRK_GLB_ALARM_COUNT > 0) {
								alarmCount_o.style.display = "";
								alarmCount_o.innerHTML = util.toNumber(TRK_GLB_ALARM_COUNT);
								if(myPage_o){
									myPgCount_o.show();
									myPgCount_o.html(util.limitViews(TRK_GLB_ALARM_COUNT, 99, "+"));
								}
							} else {
								alarmCount_o.style.display = "none";
							}
						}

//						if (location.pathname.toLowerCase().includes("/premid1/midschool/")) {//예비중1 이탈 팝업 체크
//							if (premid1CLS.premid1OutPopupCheck()) {
//								premid1OutPopupChk = true;
//							}
//						}
					}
					else {
						user_o.innerHTML = '<a href="javascript:;" data-src="common" data-act="login">로그인을 해주세요 <i class="fas fa-chevron-right"></i></a>';
						btn_o.style.display = "none";
						li_a[2].style.display = "";
						//li_a[3].style.display = "";
						alarmCount_o.style.display = "none";
					}
					_initEvent();
				});
			}
			isFirst = false;
		}

		_initEvent();
	};

	// 로그인 체크
	var _checkLogin = function(_callback) {
		comm.send("/_api/member.api.asp", "cmd=ISLOGIN", "post", function(json) {
			if(json) {
				if(util.isEmpty(json.user_id)) {
					userData = null;
					if(typeof(_callback) == "function") {
						_callback(false);
					}
				}
				else {
					userData = json;

					if(typeof(_callback) == "function") {
						_callback(true, json);
					}
				}
			}
		});
	};

	var _mem_Group_A_Block = function()
	{
		alert('해당 서비스는 족보닷컴 정회원만 이용 가능합니다!');
		location.href = 'https://sign.zocbo.com/account/';
	};

	// 로그아웃 체크
	var _accessCheck = function(_callback) {
		comm.send("/_api/member.api.asp", "cmd=ACCESS_CHECK_LOADING", "post", function(json) {
			if(json) {
				var result = json.result;

				if(result == "0"){
					_callback();
				}
				else if(result == "-1"){
					common.alert("알림", json.msg, null, function(){
						window.location.href = "/Default.asp";
					});
				}
				else if(result == "-2" || result == "-3"){
					common.alert("알림", json.msg, null, function(){
						window.location.href = "/member/logout.asp?RtnUrl=/";
					});
				}
			}
		});
	};

	// 어드민 유저 체크
	var _checkAdmin = function(_callback){
		comm.toggleLoading(true);
		comm.send("/_api/member.api.asp", "cmd=ISADMIN", "get", function(data) {
			var rst = false;
			if(data.result === "True") {
				rst = true;
			}

			if(typeof(_callback) == "function") {
				_callback(rst);
			}
			comm.toggleLoading(false);
		});
	}

	// 카운트 셋
	var _setCount = function(group_name, grade, subj_name, _callback){
		comm.toggleLoading(true);

		var data_v = "cmd=SET_MOBILE_COUNT&group_name="+encodeURIComponent(group_name)+"&grade="+encodeURIComponent(grade)+"&subj_name="+encodeURIComponent(subj_name);

		comm.send("/_api/member.api.asp", data_v, "get", function(data) {
			if(data) {
				//alert("TRK_CP = " + data.TRK_CP +"\n\n Logger_Idx = "+ data.Logger_Idx);
			}

			if(typeof(_callback) == "function") {
				_callback();
			}

			comm.toggleLoading(false);
		});

		let jsPayload = {
			"log_type" : "VIEW",
			//"uuid" : crypto.randomUUID(),
			"uuid" : generateRandomString(40),
			"service_type_cd" : TRK_GLB_SERVICE_TYPE_CD,
			"user_id" : TRK_GLB_USER_ID,
			"is_login_cd" : TRK_GLB_IS_LOGIN_CD,
			"toggle_group_cd" : TRK_GLB_TOGGLE_GROUP_CD,
			"expapr_no" : TRK_GLB_EXPAPR_NO,
			"product_cd" : TRK_GLB_PRODUCT_CD,
			"server_ip" : TRK_GLB_SERVER_IP,
			"ip" : TRK_GLB_USER_IP,
			"mem_group" : TRK_GLB_MEM_GROUP,
			"share_platform" : TRK_GLB_SHARE_PLATFORM,
			"share_user_id" : TRK_GLB_SHARE_USER_ID,
			"app_version" : TRK_GLB_APP_VERSION,
			"session_id" : TRK_GLB_SESSION_ID,
			"category2" : "group_name=" + group_name,
			"category3" : "grade=" + grade,
			"category4" : "subj_name=" + subj_name,
		};

		let jsSuccess = navigator.sendBeacon(trkCLS.getTrkURL, JSON.stringify(jsPayload));
		if (jsSuccess == false) {
			console.warn("sendBeacon 실패 → 로컬스토리지에 백업");
		}
	}

	var _initEvent = function() {
		var selector_str = "[data-src='" + _id + "'][data-act]";

		$(root).find(selector_str).unbind();
		$(root).find(selector_str).bind("click", function() {return false;});
		$(root).find(selector_str).bind("click", function(ev) {_click(ev);});

		$(root).find("[data-len]").unbind();
		$(root).find("[data-len]").bind("keydown", function(ee) {
			var ev = window.event || ee;
			var evo = ev.srcElement || ev.target;
			evo = util.findObjectByAttr(evo, "data-len", null);
			if(evo) {
				var max_len = evo.getAttribute("data-len");
				var info_id_v = evo.getAttribute("data-info");
				var info_o = root.querySelector("#" + info_id_v);
				var v_v = $(evo).val();
				_hLog("len=" + v_v.length + ", " + max_len + ", keycode=" + ee.keyCode);
				if(v_v.length >= max_len) {
					if(ee.keyCode >= 48) {
						return false;
					}
				}
				_hLog("info_o=" + info_o);
				if(info_o) {
					window.setTimeout(function(ev) {
						info_o.innerHTML = $(evo).val().length;
					}, 200);
				}
			}
		});
		$(root).find("[data-len]").bind("keyup", function(ee) {
			var ev = window.event || ee;
			var evo = ev.srcElement || ev.target;
			evo = util.findObjectByAttr(evo, "data-len", null);
			if(evo) {
				var max_len = evo.getAttribute("data-len");
				var info_id_v = evo.getAttribute("data-info");
				var info_o = root.querySelector("#" + info_id_v);
				var v_v = $(evo).val();
				$(evo).val(v_v.substr(0, max_len));
				if(info_o) {
					window.setTimeout(function(ev) {
						info_o.innerHTML = $(evo).val().length;
					}, 200);
				}
			}
		});
	};

	var _click = function(ee) {
		var ev = window.event || ee;
		var evo = ev.srcElement || ev.target;
		evo = util.findObjectByAttr(evo, "data-act", null);
		var act_v = evo.getAttribute("data-act");
		var IsMenu = evo.closest("#fullMenu") ? true : false;

		_hLog(_id + " act=" + act_v);

		_hLog(evo);

		var root_o = $("#wrapper")[0];
		// 뒤로가기
		if(act_v == "back") {
			if(window.location.pathname.toLowerCase() == "/mypage/mylearningtest.asp")
			{
				if(document.referrer.toLowerCase().includes("/barotest/learningtestanalysis.asp")) {
					history.go(-2);
				} else {
					history.back();
				}
			}
			// else if(window.location.pathname.toLowerCase() == "/mypage/mypage.asp")
			// {
			// 	location.replace("/");
			// }
			else if(window.location.pathname.toLowerCase() == "/mypage/myclasscoupon.asp" && commonOutPopupChk == true)
			{
				promotion_popup_view(ev, "back");
			}
			else
			{
				if (document.referrer.indexOf(location.host) !== -1) {
					history.back();
				} else {
					document.location.href = "/";
				}
			}
		}
		// 홈으로 가기
		else if(act_v == "home"){
			document.location.href = "/";
		}
		// 전체메뉴 팝업
		else if(act_v == "fullMenu" || util.isEmpty(act_v)) {
			var todayDate = new Date();

			if (premid1OutPopupChk) {//예비중1 이탈 팝업 체크
				premid1CLS.promotion_popup_view(ev, "fullMenu");
			} else if (pointExchangeOutPopupChk) {//포인트 333
				defaultCLS.promotion_popup_view(ev, "fullMenu");
			} else if (window.location.pathname.toLowerCase() == "/event/cloud_2502/" || window.location.pathname.toLowerCase() == "/event/2603_teaching/" || window.location.pathname.toLowerCase() == "/event/2604_skytab/" || window.location.pathname.toLowerCase() == "/event/2603_learning/" || window.location.pathname.toLowerCase() == "/event/exp_teaching/" || window.location.pathname.toLowerCase() == "/event/free_learning/" || window.location.pathname.toLowerCase() == "/event/free_teaching/" || window.location.pathname.toLowerCase() == "/event/ticket_close_soon_learning/" || window.location.pathname.toLowerCase() == "/event/exp_learning/" || window.location.pathname.toLowerCase() == "/event/zcoupon/") {
				promotion_popup_view(ev, "fullMenu");
			} else if (window.location.pathname.toLowerCase() == "/event/priceup2502/" || window.location.pathname.toLowerCase() == "/event/logincompleted2504/" || window.location.pathname.toLowerCase() == "/event/last_couponpack_m2509/" || window.location.pathname.toLowerCase() == "/event/free_couponpack_m2509/" || window.location.pathname.toLowerCase() == "/event/mid3_coupon_m2510/" || window.location.pathname.toLowerCase() == "/event/mid3_coupon2_2510/") {
				promotion_popup_view(ev, "fullMenu");
			} else if (window.location.pathname.toLowerCase().includes("/event/logincompleted2025b/")) {//2025년 2시즌 하이재킹
				defaultCLS.promotion_popup_view(ev, "fullMenu");
			} else if (window.location.pathname.toLowerCase().includes("/event/luckydraw0708/") && jQuery("#event_Target_YN").val() != "X" && todayDate.toLocaleDateString("en-us") < "8/1/2025") {//럭키드로우 7월 이벤트				
				promotion_popup_view(ev, "fullMenu");
			} else if ((window.location.pathname.toLowerCase().includes("/event/luckydraw_t25/") || window.location.pathname.toLowerCase().includes("/event/luckydraw_s25/")) && ((jQuery("#event_Target_YN").val() != "N" && jQuery("#event_Entry_YN").val() != "Y") || TRK_GLB_USER_ID == "-1") ) {//럭키드로우 러닝/티칭25주년 이벤트
				promotion_popup_view(ev, "fullMenu");
			} else if ((window.location.pathname.toLowerCase().includes("/event/learning25event/") || window.location.pathname.toLowerCase().includes("/event/learning25event/")) && ((jQuery("#event_Target_YN").val() != "N") || TRK_GLB_USER_ID == "-1")) {// 러닝 25주년 제휴 프로모션
				promotion_popup_view(ev, "fullMenu");
			} else if (((window.location.pathname.toLowerCase().includes("/event/2607_fcd/") || window.location.pathname.toLowerCase().includes("/event/2607_fcd2/") || window.location.pathname.toLowerCase().includes("/event/2607_fcd3/")) && TRK_GLB_USER_ID == "-1")) {
				promotion_popup_view(ev, "fullMenu");
			} else {
				$("#section").hide();
				$('#fullMenu').addClass('active');
				if(fullBannerSlider) {
					fullBannerSlider.reloadSlider();
				}
			}
		}
		// 전체메뉴 팝업 닫기
		else if (act_v == "closeMenu"){
			$("#section").show();
			$("#fullMenu").removeClass("active");
			var pathname = location.pathname;
			if(pathname == "/" || pathname == "/Default.asp") {
				main.initSlider();
			}
		}
		// 로그인 페이지 이동
		else if(act_v == "login"){
			sessionStorage.setItem("rtnUrl", _rtnUrl);
			document.location.href = "/member/login.asp";
		}
		// 로그아웃
		else if(act_v == "logout") {
			common.alert("안내", "로그아웃 하시겠습니까?", {}, function() {
				document.location.href = "/member/logout.asp";
				sessionStorage.clear();
				var gradeSet = localStorage.getItem("gradeSet");
				var gradeSet1 = localStorage.getItem("gradeSet1");
				var skey = localStorage.getItem("skey");
				localStorage.clear();
				localStorage.setItem("gradeSet", gradeSet);
				localStorage.setItem("gradeSet1", gradeSet1);
				localStorage.setItem("skey", skey);
			});
		}
		// 마이페이지 이동
		else if(act_v == "goMyPage") {
			var rtnUrl = "/MyPage/myPage.asp";
			
			if (IsMenu) {
				_accessCheck(function(){
					common.checkLogin(function(fg){
						if(fg){
							document.location.href = rtnUrl;
						} else {
							loginPop.show(root_o, rtnUrl, false);
						}
					});
				});
			} else {
				if (premid1OutPopupChk) {//예비중1 이탈 팝업 체크
					premid1CLS.promotion_popup_view(ev, "mypage");
				} else if (pointExchangeOutPopupChk) {//포인트 333
					defaultCLS.promotion_popup_view(ev, "mypage");
				} else if (window.location.pathname.toLowerCase() == "/event/cloud_2502/" || window.location.pathname.toLowerCase() == "/event/2603_teaching/" || window.location.pathname.toLowerCase() == "/event/2604_skytab/" || window.location.pathname.toLowerCase() == "/event/2603_learning/" || window.location.pathname.toLowerCase() == "/event/exp_teaching/" || window.location.pathname.toLowerCase() == "/event/free_learning/" || window.location.pathname.toLowerCase() == "/event/free_teaching/" || window.location.pathname.toLowerCase() == "/event/ticket_close_soon_learning/" || window.location.pathname.toLowerCase() == "/event/exp_learning/" || window.location.pathname.toLowerCase() == "/event/zcoupon/") {
					promotion_popup_view(ev, "mypage");
				} else if (window.location.pathname.toLowerCase() == "/event/priceup2502/" || window.location.pathname.toLowerCase() == "/event/logincompleted2504/" || window.location.pathname.toLowerCase() == "/event/last_couponpack_m2509/" || window.location.pathname.toLowerCase() == "/event/free_couponpack_m2509/"  || window.location.pathname.toLowerCase() == "/event/mid3_coupon_m2510/" || window.location.pathname.toLowerCase() == "/event/mid3_coupon2_2510/") {
					promotion_popup_view(ev, "mypage");
				} else if(window.location.pathname.toLowerCase() == "/mypage/myclasscoupon.asp" && commonOutPopupChk == true) {
					promotion_popup_view(ev, "mypage");
				} else if (window.location.pathname.toLowerCase().includes("/event/logincompleted2025b/")) {//2025년 2시즌 하이재킹
					defaultCLS.promotion_popup_view(ev, "mypage");
				} else if (window.location.pathname.toLowerCase().includes("/event/luckydraw0708/") && jQuery("#event_Target_YN").val() != "X") {//럭키드로우 7월 이벤트
					promotion_popup_view(ev, "mypage");
				} else if ((window.location.pathname.toLowerCase().includes("/event/luckydraw_t25/") || window.location.pathname.toLowerCase().includes("/event/luckydraw_s25/")) && jQuery("#event_Target_YN").val() != "N" && jQuery("#event_Entry_YN").val() != "Y") {//럭키드로우 러닝/티칭25주년 이벤트
					promotion_popup_view(ev, "mypage");
				} else if ((window.location.pathname.toLowerCase().includes("/event/learning25event/") || window.location.pathname.toLowerCase().includes("/event/learning25event/")) && ((jQuery("#event_Target_YN").val() != "N") || TRK_GLB_USER_ID == "-1")) {// 러닝 25주년 제휴 프로모션
					promotion_popup_view(ev, "mypage");
				} else {
					_accessCheck(function(){
						common.checkLogin(function(fg){
							if(fg){
								document.location.href = rtnUrl;
							} else {
								loginPop.show(root_o, rtnUrl, false);
							}
						});
					});
				}
			}
		}
		else if(act_v == "goLogin") {
			var rtnUrl = _rtnUrl;

			_accessCheck(function(){
				common.checkLogin(function(fg){
					if(fg){
						document.location.href = rtnUrl;
					} else {
						if(window.location.pathname.toLowerCase() == '/event/landing_membership/') {
							promotion_popup_view("", "login");
						} else {
							loginPop.show(root_o, rtnUrl, false);
						}
					}
				});
			});
		}
		// 이용권 내역 이동
		else if(act_v == "goMyCoupon") {
			_accessCheck(function(){
				var rtnUrl = "/MyPage/myCoupon.asp";
				common.checkLogin(function(fg){
					if(fg){
						document.location.href = rtnUrl;
					} else {
						loginPop.show(root_o, rtnUrl, false);
					}
				});
			});
		}
		// 이용권 구매 이동
		else if(act_v == "goPayment") {
			var rtnUrl = "/payment/";
			common.checkLogin(function(fg){
				if(fg){
					if (TRK_GLB_TOGGLE_GROUP_CD != "1" && (TRK_GLB_MEM_GROUP == "S" || TRK_GLB_MEM_GROUP == "P") && TRK_GLB_MEM_SITEID == "E") {//초등 학생 회원& 자녀1이 초등인 학부모 회원
						document.location.href ="/payment/default_v.asp?category=CD_000100010008";
					} else {
						document.location.href = rtnUrl;
					}
				} else {
					if(window.location.pathname.toLowerCase() == '/event/landing_membership/') {
						promotion_popup_view(rtnUrl, "payment");
					} else {
						document.location.href = rtnUrl;
					}
				}
			});
		}
		// 알림 페이지 이동
		else if(act_v == "goAlarm") {
			var rtnUrl = "/Alarm/alarm.asp";
			_accessCheck(function(){
				common.checkLogin(function(fg){
					if(fg){
						document.location.href = rtnUrl;
					} else {
						loginPop.show(root_o, rtnUrl, false);
					}
				});
			});
		}
		// 커뮤니티 성적이올랐어요 이동
		else if(act_v == "goCommunity") {
			var rtnUrl;
			var h_url_chk = "N";

			if(location.href.toLowerCase().includes("/h/") || location.href.toLowerCase().includes("/soopring/")) {
				h_url_chk = "Y";
			}

			if(h_url_chk == "Y") {
				rtnUrl = "/H/community.asp";
			} else {
				if((TRK_GLB_MEM_GROUP == "S" || TRK_GLB_MEM_GROUP == "P") && TRK_GLB_MEM_SITEID == "H" && location.href.toLowerCase().includes("/m/") == false) {
					rtnUrl = "/H/community.asp";
				} else {
					rtnUrl = "/M/community.asp";
				}
			}

			_accessCheck(function(){
				document.location.href = rtnUrl;
			});
		}
		// 준비중 alert
		else if (act_v == "prepare") {

			common.alert("알림", "준비중입니다.", null, function(){

			});
		}
		// 보관함 이동
		else if (act_v == "downloadList") {
			var rtnUrl = "/MyPage/downloadList.asp";
			_accessCheck(function(){
				common.checkLogin(function(fg){
					if(fg){
						document.location.href = rtnUrl;
					} else {
						loginPop.show(root_o, rtnUrl, false);
					}
				});
			});
		}
		else if(act_v == "previous_analysis") {
			var url_vv = "/_api/member.api.asp";
			var data_vv = "cmd=ISLOGIN";

			comm.send(url_vv, data_vv, "post", function(data) {
				if(data.mem_group == "A")
				{							
					common.mem_Group_A_Block(function(){});
				}
				else
				{
					//$("#section").hide();
					$('#block_previous_analysis').addClass('active');

					// 특정 학교, 과목 과련된 json 데이터 호출 (exam_year, term 추가) (정효태)
					//previous_analysis.init(evo.getAttribute("data-scl-id"), evo.getAttribute("data-subj-code"), evo.getAttribute("data-year"), evo.getAttribute("data-midandterm"));
					previous_analysis.init(evo.getAttribute("data-no"), evo.getAttribute("data-txcode"), evo.getAttribute("data-siteid"), evo.getAttribute("data-grade"));
				}
			});
		}
		else if (act_v == "previous_analysis_close") {
			//$("#section").show();
			$("#block_previous_analysis").removeClass("active");
		} else if (act_v == "community_banner") {
			var communityUrl = "/M/";

			if(location.href.toLowerCase().includes("/h/") || location.href.toLowerCase().includes("/soopring/") || location.href.toLowerCase().includes("/prego1/")) {
				communityUrl = "/H/";
			} else if(location.href.toLowerCase().includes("/freetrial/learningtest.asp")) {
				if($j("#filter_2 .select-btn").eq(0).text().includes("고등")) {
					communityUrl = "/H/";
				}
			}

			location.href = communityUrl + "community.asp?kind=4";
		} else if (act_v == "survey_banner") {
			if(TRK_GLB_MEM_GROUP == "S") {
				location.href = 'https://docs.google.com/forms/d/e/1FAIpQLSeU_X-ilM1CI3ewDjoxmtnO4Z164JcJqBmIONly_1DqQOAyEw/viewform?usp=sharing';
			} else if(TRK_GLB_MEM_GROUP == "P") {
				location.href = 'https://docs.google.com/forms/d/e/1FAIpQLSd6cmRIP7YmpPFQJW0qU5J7Yx7CEXkI-_24skUcvWmC1j2CRg/viewform?usp=sharing';
			}
		}
	};

	// alert 표시
	var _alert = function(title_p, msg_p, cancel_call, ok_call) {
		var obj = document.querySelector(modal_id);
		if(obj == null) {
			alert(msg_p);
			return;
		}
		var title_o = obj.querySelector("h1");
		var msg_o = obj.querySelector(".text-center");
		var f_o = obj.querySelector(".modal-footer");

		f_o.innerHTML = "";
		if(title_p) {
			title_o.style.display = "";
			title_o.innerHTML = title_p;
		}
		else {
			title_o.style.display = "none";
		}
		msg_o.innerHTML = msg_p;

		if(cancel_call) {
			var a_o = document.createElement("a");
			a_o.className = "modal-btn btn-cancel";
			a_o.innerHTML = "취소";
			f_o.appendChild(a_o);
			$(a_o).bind("click", function(ev) {
				$(obj).modal('hide');
				if(typeof(cancel_call) == "function") {
					cancel_call();
				}
				return false;
			});
		}
		if(ok_call) {
			var a_o = document.createElement("a");
			a_o.className = "modal-btn btn-confirm";
			a_o.innerHTML = "확인";
			f_o.appendChild(a_o);
			$(a_o).bind("click", function(ev) {
				$(obj).modal('hide');
				if(typeof(ok_call) == "function") {
					ok_call();
				}
				return false;
			});
		}

		$(obj).modal('show');
	};

/*
<p class="msgAlert"><span>정상적으로 등록되었습니다.</span></p>
<p class="popMsg mT15">중등 영문법은 PRO이용권 및 중등 포인트 이용권<br>보유 회원만 이용 가능합니다.</p>
*/
	var toastTmr = null;
	var toastCallback = null;
	var _toast = function(msg_p, call_p) {
		toastCallback = call_p;
		// var obj = document.querySelector(".msgAlert");
		var obj = document.querySelector(".popMsg");
		if(obj) {
			obj.parentNode.removeChild(obj);
			if(toastTmr) {
				window.clearTimeout(toastTmr);
				toastTmr = null;
			}
		}
		obj = document.createElement("p");
		// obj.className = "msgAlert";
		obj.className = "popMsg mT15";
		// obj.innerHTML = "<span>" + msg_p + "</span>";
		obj.innerHTML = msg_p;

		document.body.appendChild(obj);

		toastTmr = window.setTimeout(function() {
			// var pobj = document.querySelector(".msgAlert");
			var pobj = document.querySelector(".popMsg");
			if(pobj) {
				pobj.parentNode.removeChild(obj);
				if(toastTmr) {
					window.clearTimeout(toastTmr);
					toastTmr = null;
				}
			}
			if(typeof(toastCallback) == "function") {
				toastCallback();
				toastCallback = null;
			}
		}, 2000);

	};

	// 셀렉트박스 팝업
	var _showSelect = function(items, sIndex, _callback) {
		if(items == null) return;
		var r_o = document.querySelector("#layerSelect");
		_hLog("r_o=" + r_o);
		if(r_o) {
			{
				var btn = r_o.querySelector("#btnSelected");
				if(btn) btn.style.display = "";
			}
			{
				var h1_o = r_o.querySelector("#selectTitle");
				if(h1_o) h1_o.innerHTML = "선택";
			}
			var ul_o = r_o.querySelector(".select-list");
			ul_o.innerHTML = "";
			for(var i = 0; i < items.length; i++) {
				var item = items[i];

				var li_o = document.createElement("li");
				var btn_o = document.createElement("button");
				btn_o.type = "button";
				if( i == sIndex) {
					btn_o.className = "active";
				}
				btn_o.setAttribute("data-pos", i);
				if(item.title) {
					btn_o.innerHTML = item.title;
				}
				else {
					btn_o.innerHTML = item.Name;
				}
				li_o.appendChild(btn_o);
				ul_o.appendChild(li_o);
			}
			$(r_o).find("li").unbind();
			$(r_o).find("li").bind("click", function(ee) {
				var ev = window.event || ee;
				var evo = ev.srcElement || ev.target;
				evo = util.findObjectByAttr(evo, "data-pos", null);
				if(evo) {
					var a_o = r_o.querySelector(".active");
					if(a_o) {
						$(a_o).removeClass("active");
					}
					$(evo).addClass("active");
				}

			});
		}
		var btn = r_o.querySelector("#btnSelected");
		$(btn).unbind();
		$(btn).bind("click", function() {
			r_o.style.display = "none";
			var li_o = r_o.querySelector(".active");
			if(li_o) {
				var pos = li_o.getAttribute("data-pos");
				var item = items[pos];
				item["pos"] = pos;
				if(typeof(_callback) == "function") {
					_callback(item);
				}
			}
		});
		btn = r_o.querySelector(".layerClose");
		$(btn).unbind();
		$(btn).bind("click", function() {
			r_o.style.display = "none";
		});

		r_o.style.display = "";
	};

	// 멀티 셀렉트박스 팝업
	var _showMultiSelect = function(items, sIndex, _callback) {
		if(items == null) return;
		var r_o = document.querySelector("#layerSelect");
		_hLog("r_o=" + r_o);
		var btnAll = null;
		if(r_o) {
			{
				var btn = r_o.querySelector("#btnSelected");
				if(btn) btn.style.display = "";
			}
			{
				var h1_o = r_o.querySelector("#selectTitle");
				if(h1_o) h1_o.innerHTML = "선택";
			}
			var ul_o = r_o.querySelector(".select-list");
			ul_o.innerHTML = "";
			for(var i = 0; i < items.length; i++) {
				var item = items[i];

				var li_o = document.createElement("li");
				var btn_o = document.createElement("button");
				btn_o.type = "button";
				if(typeof(sIndex) == "number" || typeof(sIndex) == "string") {
					if( i == sIndex) {
						btn_o.className = "active";
					}
				}
				else {
					for(var k = 0; k < sIndex.length; k++) {
						var fIndex = sIndex[k].pos;
						if(fIndex == i) {
							btn_o.className = "active";
						}
					}
				}
				btn_o.setAttribute("data-pos", i);
				if(item.title) {
					btn_o.innerHTML = item.title;
				}
				else {
					btn_o.innerHTML = item.Name;
				}
				if(btn_o.innerHTML.indexOf("전체") >= 0) {
					btnAll = btn_o;
				}
				li_o.appendChild(btn_o);
				ul_o.appendChild(li_o);
			}
			$(r_o).find("li").unbind();
			$(r_o).find("li").bind("click", function(ee) {
				var ev = window.event || ee;
				var evo = ev.srcElement || ev.target;
				evo = util.findObjectByAttr(evo, "data-pos", null);
				if(evo) {
					var title_v = evo.innerText;
					var isAll = false;
					if(title_v.indexOf("전체") >= 0) {
						isAll = true;
					}
					if($(evo).hasClass("active")) {
						if(isAll) {
							$(r_o).find("li button").removeClass("active");
						}
						else {
							$(evo).removeClass("active");
							$(btnAll).removeClass("active");
						}
					}
					else {
						if(isAll) {
							$(r_o).find("li button").addClass("active");
						}
						else {
							$(evo).addClass("active");
							$(btnAll).removeClass("active");
						}
					}
				}

			});
		}
		var btn = r_o.querySelector("#btnSelected");
		$(btn).unbind();
		$(btn).bind("click", function() {
			var rtn_a = [];
			var li_a = r_o.querySelectorAll(".active");
			for(var i = 0; i < li_a.length ; i++) {
				var li_o = li_a[i];
				var pos = li_o.getAttribute("data-pos");
				items[pos]["pos"] = pos;
				rtn_a.push(items[pos]);
			}
			if(rtn_a.length <= 0) {
				alert("최소한 1개의 항목이라도 선택해 주세요.");
				// common.toast("최소한 1개의 항목이라도 선택해 주세요.", null);
				return;
			}
			r_o.style.display = "none";
			if(typeof(_callback) == "function") {
				_callback(rtn_a);
			}
		});
		btn = r_o.querySelector(".layerClose");
		$(btn).unbind();
		$(btn).bind("click", function() {
			r_o.style.display = "none";
		});

		r_o.style.display = "";
	};

	// 문구 수정 가능한 멀티 셀렉트박스 팝업
	var _showFlexMultiSelect = function(title, items, sIndex, _callback) {
		if(items == null) return;
		var r_o = document.querySelector("#layerSelect");
		_hLog("r_o=" + r_o);
		var btnAll = null;
		if(r_o) {
			{
				var btn = r_o.querySelector("#btnSelected");
				if(btn) btn.style.display = "";
			}
			{
				var h1_o = r_o.querySelector("#selectTitle");
				if(h1_o){
					if(title){
						h1_o.innerHTML = title;
					}
					else{
						h1_o.innerHTML = "선택";
					}
				}
			}
			var ul_o = r_o.querySelector(".select-list");
			ul_o.innerHTML = "";
			
			for(var i = 0; i < items.length; i++) {
				var item = items[i];

				var li_o = document.createElement("li");
				var btn_o = document.createElement("button");
				btn_o.type = "button";

				if(item.Name == '') // 직전대비 - fianl모의고사는 무조건 보여주기 위함
				{
					btn_o.style.display = "none";
					btn_o.className = "active";
				}	

				if(typeof(sIndex) == "number" || typeof(sIndex) == "string") {
					if( i == sIndex) {
						btn_o.className = "active";
					}

					if(i == (items.length-1))
					{
						btn_o.style.display = "none";
					}
				}
				else {
					for(var k = 0; k < sIndex.length; k++) {						
						var fIndex = sIndex[k].pos;
						if(fIndex == i) {
							btn_o.className = "active";
						}
					}
				}

				btn_o.setAttribute("data-pos", i);

				if(item.title) {
					btn_o.innerHTML = item.title;
				}
				else {
					btn_o.innerHTML = item.Name;
				}
				// if(btn_o.innerHTML.indexOf("전체") >= 0) {
				// 	btnAll = btn_o;
				// } 
				if(btn_o.getAttribute("data-pos") == 0) {
					btnAll = btn_o;
				}

				li_o.appendChild(btn_o);
				ul_o.appendChild(li_o);
			}
			$(r_o).find("li").unbind();
			$(r_o).find("li").bind("click", function(ee) {
				var ev = window.event || ee;
				var evo = ev.srcElement || ev.target;
				evo = util.findObjectByAttr(evo, "data-pos", null);
				if(evo) {
					var title_v = evo.innerText;
					var pos_v = evo.getAttribute("data-pos");
					var isAll = false;
					// if(title_v.indexOf("전체") >= 0) {
					// 	isAll = true;
					// }
					if(pos_v == 0) {
						isAll = true;
					}
					if($(evo).hasClass("active")) {
						if(isAll) {
							$(r_o).find("li button").removeClass("active");
						}
						else {
							$(evo).removeClass("active");
							$(btnAll).removeClass("active");
						}
					}
					else {
						if(isAll) {
							$(r_o).find("li button").addClass("active");
						}
						else {
							$(evo).addClass("active");
							$(btnAll).removeClass("active");
						}
					}
					var btn = r_o.querySelector("#btnSelected");
					var li_a = r_o.querySelectorAll(".active");
					if(li_a.length > 0){
						$(btn).removeClass("btn-gray");
						$(btn).addClass("btn-blue");
						$(btn).removeAttr("disabled", "");
					}
					else{
						$(btn).removeClass("btn-blue");
						$(btn).addClass("btn-gray");
						$(btn).attr("disabled", "");
					}
				}

			});
		}

		var btn = r_o.querySelector("#btnSelected");
		var li_a = r_o.querySelectorAll(".active");
		if(li_a.length > 0){
			$(btn).removeClass("btn-gray");
			$(btn).addClass("btn-blue");
			$(btn).removeAttr("disabled", "");
		}
		else{
			$(btn).removeClass("btn-blue");
			$(btn).addClass("btn-gray");
			$(btn).attr("disabled", "");
		}

		$(btn).unbind();
		$(btn).bind("click", function() {
			var rtn_a = [];
			var li_a = r_o.querySelectorAll(".active");
			for(var i = 0; i < li_a.length ; i++) {
				var li_o = li_a[i];
				var pos = li_o.getAttribute("data-pos");
				items[pos]["pos"] = pos;
				rtn_a.push(items[pos]);
			}
			r_o.style.display = "none";
			if(typeof(_callback) == "function") {
				_callback(rtn_a);
			}
		});
		btn = r_o.querySelector(".layerClose");
		$(btn).unbind();
		$(btn).bind("click", function() {
			r_o.style.display = "none";
		});

		r_o.style.display = "";
	};

	// 이용권 셀렉트 박스 팝업
	var _showPaySelect = function(items, sIndex, unitPrice, _callback) {
		if(items == null) return;
		_hLog("showPaySelect items=" + JSON.stringify(items));
		var r_o = document.querySelector("#layerPaySelect");
		_hLog("r_o=" + r_o);
		if(r_o) {
			{
				var btn = r_o.querySelector("#btnSelected");
				if(btn) btn.style.display = "";
			}
			{
				var h1_o = r_o.querySelector("#selectTitle");
				if(h1_o) h1_o.innerHTML = "선택";
			}
			var price_o = r_o.querySelector("#price");
			if(price_o) {
				price_o.innerHTML = util.toNumber(0);
			}

			var ul_o = r_o.querySelector(".multi-select");
			ul_o.innerHTML = "";
			for(var i = 0; i < items.length; i++) {
				var item = items[i];

				var li_o = document.createElement("li");
				var btn_o = document.createElement("button");
				btn_o.type = "button";
				if( i == sIndex) {
					btn_o.className = "active";
				}
				btn_o.setAttribute("data-pos", i);
				if(item.price) {
					btn_o.setAttribute("data-price", item.price);
				}
				else {
					btn_o.setAttribute("data-price", unitPrice);
				}
				if(item.title) {
					btn_o.innerHTML = item.title;
				}
				else {
					btn_o.innerHTML = item.Name;
				}
				li_o.appendChild(btn_o);
				ul_o.appendChild(li_o);
			}
			$(r_o).find("li").unbind();
			$(r_o).find("li").bind("click", function(ee) {
				var ev = window.event || ee;
				var evo = ev.srcElement || ev.target;
				evo = util.findObjectByAttr(evo, "data-pos", null);
				if(evo) {
					$(evo).toggleClass("active");
				}
				var li_a = r_o.querySelectorAll(".active");
				var totPrice = 0;
				for(var i = 0; i < li_a.length; i++) {
					var sPrice = li_a[i].getAttribute("data-price") - 0;
					totPrice = totPrice + sPrice;
				}
				var price_o = r_o.querySelector("#price");
				if(price_o) {
					price_o.innerHTML = util.toNumber(totPrice);
				}
				var btn = r_o.querySelector("#btnSelected");
				if(li_a.length > 0){
					$(btn).removeClass("btn-gray");
					$(btn).addClass("btn-blue");
					$(btn).removeAttr("disabled", "");
				}
				else{
					$(btn).removeClass("btn-blue");
					$(btn).addClass("btn-gray");
					$(btn).attr("disabled", "");
				}
			});
		}
		var btn = r_o.querySelector("#btnSelected");
		$(btn).removeClass("btn-blue");
		$(btn).addClass("btn-gray");
		$(btn).attr("disabled", "");
		$(btn).unbind();
		$(btn).bind("click", function() {
			r_o.style.display = "none";
			var rtn_a = [];
			var li_a = r_o.querySelectorAll(".active");
			for(var i = 0; i < li_a.length ; i++) {
				var li_o = li_a[i];
				var pos = li_o.getAttribute("data-pos");
				rtn_a.push(items[pos]);
			}
			if(typeof(_callback) == "function") {
				_callback(rtn_a);
			}
		});
		btn = r_o.querySelector(".layerClose");
		$(btn).unbind();
		$(btn).bind("click", function() {
			r_o.style.display = "none";
		});

		r_o.style.display = "";
	};

	// PRO전용 콘텐츠 선택 셀렉트박스 팝업
	var _showFlexSelectPro = function(title, items, sIndex, isShowBtn, _callback) {
		var item_Gubun = items[sIndex].Gubun;
		if(items == null) return;
		var r_o = document.querySelector("#layerSelect");
		_hLog("r_o=" + r_o);
		if(r_o) {
			if(title != null){
				var h1_o = r_o.querySelector("#selectTitle");
				h1_o.innerHTML = title;
			}
			var ul_o = r_o.querySelector(".select-list");
			ul_o.innerHTML = "";
			for(var i = 0; i < items.length; i++) {
				var item = items[i];

				var li_o = document.createElement("li");
				var btn_o = document.createElement("button");
				btn_o.type = "button";
				if( i == sIndex) {
					btn_o.className = "active";
				}
				btn_o.setAttribute("data-pos", i);
				btn_o.setAttribute("data-level", item.Level);
				btn_o.setAttribute("data-gubun", item.Gubun);
				btn_o.setAttribute("data-url", item.url);
				if (item.Level == "0") {
					btn_o.style.fontSize = "18px";
					btn_o.style.fontWeight = "700";
					btn_o.style.display = "inline-block";
					//btn_o.style.marginTop = "20px";

				}
				if(item.title) {
					btn_o.innerHTML = item.title;
				}
				else {
					btn_o.innerHTML = item.Name;
				}
				li_o.appendChild(btn_o);
				ul_o.appendChild(li_o);
			}
			$(r_o).find("li").unbind();
			$(r_o).find("li").bind("click", function(ee) {
				var ev = window.event || ee;
				var evo = ev.srcElement || ev.target;
				evo = util.findObjectByAttr(evo, "data-pos", null);
				var li_item_Gubun = evo.getAttribute("data-Gubun");
				if(evo && evo.getAttribute("data-level") == "1") {
					if (item_Gubun != li_item_Gubun) {
						location.href=evo.getAttribute("data-url")
						return;
					}
					if(isShowBtn == false){
						r_o.style.display = "none";
						var pos = evo.getAttribute("data-pos");
						var item = items[pos];
						item["pos"] = pos;
						if(typeof(_callback) == "function") {
							_callback(item);
						}
					}
					else{
						var a_o = r_o.querySelector(".active");
						if(a_o) {
							$(a_o).removeClass("active");
						}
						$(evo).addClass("active");
					}
				}
			});
		}

		var btn = r_o.querySelector("#btnSelected");
		if(isShowBtn == false){
			btn.style.display = "none";
		}
		else{
			$(btn).unbind();
			$(btn).bind("click", function() {
				r_o.style.display = "none";
				var li_o = r_o.querySelector(".active");
				if(li_o) {
					var pos = li_o.getAttribute("data-pos");
					var item = items[pos];
					item["pos"] = pos;
					if(typeof(_callback) == "function") {
						_callback(item);
					}
				}
			});
		}
		btn = r_o.querySelector(".layerClose");
		$(btn).unbind();
		$(btn).bind("click", function() {
			r_o.style.display = "none";
		});
		r_o.style.display = "";
	};

	// 문구 수정, 버튼 표시 변경 가능한 셀렉트박스 팝업
	var _showFlexSelect = function(title, items, sIndex, isShowBtn, _callback) {
		if(items == null) return;
		var r_o = document.querySelector("#layerSelect");
		_hLog("r_o=" + r_o);
		if(r_o) {
			if(title != null){
				var h1_o = r_o.querySelector("#selectTitle");
				h1_o.innerHTML = title;
			}
			var ul_o = r_o.querySelector(".select-list");
			ul_o.innerHTML = "";
			for(var i = 0; i < items.length; i++) {
				var item = items[i];

				if(item.pos == 0 && item.boardKind == 4) {
					continue;
				}

				var li_o = document.createElement("li");
				var btn_o = document.createElement("button");
				btn_o.type = "button";
				if( i == sIndex) {
					btn_o.className = "active";
				}
				btn_o.setAttribute("data-pos", i);

				if (item.gubun) { btn_o.setAttribute("data-gubun", item.gubun); }
				if (item.url) { btn_o.setAttribute("data-url", item.url); }

				if(item.title) {
					btn_o.innerHTML = item.title;
				}
				else {
					btn_o.innerHTML = item.Name;
				}
				li_o.appendChild(btn_o);
				ul_o.appendChild(li_o);
			}
			$(r_o).find("li").unbind();
			$(r_o).find("li").bind("click", function(ee) {
				var ev = window.event || ee;
				var evo = ev.srcElement || ev.target;
				evo = util.findObjectByAttr(evo, "data-pos", null);

				if(evo) {
					var pos = evo.getAttribute("data-pos");
					var gubun = evo.getAttribute("data-gubun");
					var url = evo.getAttribute("data-url");
					if (title == "구분" && (gubun)) {
						location.href = url;
						return;
					}
					if(isShowBtn == false){
						r_o.style.display = "none";
						var item = items[pos];
						item["pos"] = pos;
						if(typeof(_callback) == "function") {
							_callback(item);
						}
					}
					else{
						var a_o = r_o.querySelector(".active");
						if(a_o) {
							$(a_o).removeClass("active");
						}
						$(evo).addClass("active");
					}
				}
			});
		}

		var btn = r_o.querySelector("#btnSelected");
		if(isShowBtn == false){
			btn.style.display = "none";
		}
		else{
			$(btn).unbind();
			$(btn).bind("click", function() {
				r_o.style.display = "none";
				var li_o = r_o.querySelector(".active");
				if(li_o) {
					var pos = li_o.getAttribute("data-pos");
					var item = items[pos];
					item["pos"] = pos;
					if(typeof(_callback) == "function") {
						_callback(item);
					}
				}
			});
		}
		btn = r_o.querySelector(".layerClose");
		$(btn).unbind();
		$(btn).bind("click", function() {
			r_o.style.display = "none";
		});
		r_o.style.display = "";
	};

	var _showFilter = function(_callback) {

	};

	// 상품목록 다운로드 버튼의 메시지 목록
	var downMsg = {
		"E-1"	: {"msg":"현재 접속자 수가 많아 일시적으로 서비스가 원활하지 않습니다.", "submsg":"잠시 후에 다시 접속해 주시기 바랍니다. 이용에 불편을 드려 죄송합니다."},
		"E-2"	: {"msg":"일정시간 동안 이용되지 않아 고객님의 정보보호를 위해 로그아웃되었습니다.", "submsg":"다시 로그인하여 주시기 바랍니다."},
		"E-3"	: {"msg":"사용 중인 아이디가 로그아웃 되었습니다.", "submsg":"1. 일정 시간동안 사용이 없는 경우<br/>2. 다른 기기에서 로그인한 경우<br/>다른 사용자가 로그인 한 것으로 판단 되시면 비밀번호를 변경하시기 바랍니다.<br/>로그인 하시면 다시 사용 가능합니다."},
		//"E1"	: {"msg":"로그인이 필요합니다.", "submsg":"로그인하여 주시기 바랍니다."},
		"E1"	: {"msg":"로그인해야 서비스 이용이 가능해요.", "submsg":"로그인 후 공유하면 <em style='font-weight:700;'>다운로드 무료</em> 제공<br>받은 사람 가입시 <em style='font-weight:700;color:#4272D2;'>혜택X3배!</em>&nbsp;<span style='font-size:11px;'>*최초 1회만 제공</span>"},
		"E2"	: {"msg":"현재 시험지의 속성 정보가 없습니다.", "submsg":""},
		"VOD":{
			"T":{
				"E0"	: "동영상 보기 버튼을 선택하시면 보유 이용권에서 ###POINT###건이 차감됩니다.<br/><br/>최초 시청일 기준 30일간 무료로 다시보기가 가능합니다.",
			},
			"P":{
				"E0"	: "동영상 보기 버튼을 선택하시면 잔여 포인트에서 ###POINT###P가 차감됩니다.<br/><br/>최초 시청일 기준 30일간 무료로 다시보기가 가능합니다.",
			},
			"E-1"	: "보유하고 있는 이용권이 없습니다.<br/><br/>이용권/Z-포인트 구매 후 이용바랍니다.",
			"E"	: "동영상 시청 권한이 없습니다.<br/><br/>이용권/Z-포인트 구매 후 이용바랍니다.",
			"E"	: "수프링 다운로드 권한이 없습니다.<br/><br/>수프링 서비스는 수프링 이용권/학생 이용권(고등)<br/>포인트 보유 회원만 이용 가능합니다.<br/><br/>이용권/Z-포인트 구매 후 이용바랍니다."
		},
		"DOWN":{
			"T":{
				"E0"	: "다운로드 버튼을 선택하시면 보유 이용권에서 ###POINT###건이 차감됩니다.<br/><br/>다운로드 하신 파일은 마이페이지>보관함에서 30일간 재다운로드 가능합니다.",
			},
			"P":{
				"E0"	: "다운로드 버튼을 선택하시면 잔여 포인트에서 ###POINT###P가 차감됩니다.<br/><br/>다운로드 하신 파일은 마이페이지>보관함에서 30일간 재다운로드 가능합니다.",
			},
			"E"	: "보유하고 있는 이용권이 없습니다.<br/><br/>이용권/Z-포인트 구매 후 이용바랍니다.",
			"E"	: "동영상 시청 권한이 없습니다.<br/><br/>이용권/Z-포인트 구매 후 이용바랍니다.",
			"E"	: "수프링 다운로드 권한이 없습니다.<br/><br/>수프링 서비스는 수프링 이용권/학생 이용권(고등)<br/>포인트 보유 회원만 이용 가능합니다.<br/><br/>이용권/Z-포인트 구매 후 이용바랍니다."
		},
		"SOO":{
			"T":{
				"E0"	: "다운로드 버튼을 선택하시면 보유 이용권에서 ###POINT###건이 차감됩니다.<br/><br/>다운로드 하신 파일은 마이페이지>보관함에서 30일간 재다운로드 가능합니다.",
			},
			"P":{
				"E0"	: "다운로드 버튼을 선택하시면 잔여 포인트에서 ###POINT###P가 차감됩니다.<br/><br/>다운로드 하신 파일은 마이페이지>보관함에서 30일간 재다운로드 가능합니다.",
			},
			"E"	: "보유하고 있는 이용권이 없습니다.<br/><br/>이용권/Z-포인트 구매 후 이용바랍니다.",
			"E"	: "동영상 시청 권한이 없습니다.<br/><br/>이용권/Z-포인트 구매 후 이용바랍니다.",
			"E_SN"	: "수프링 다운로드 권한이 없습니다.<br/><br/>수프링 서비스는 수프링 이용권/학생 이용권(고등)<br/>포인트 보유 회원만 이용 가능합니다.<br/><br/>이용권/Z-포인트 구매 후 이용바랍니다."
		}
	};

	// 다운로드 팝업 레이어
	var _showDownloadLayer = function(resultCode, downType, downCount, ExPapr_No, Exfl_Group, ownAmount, button_label, _callback) {
		var r_o = document.querySelector("#downloadLayer");
		var root_o = $("#wrapper")[0];

		// ownAmount = 현재 (보유 잔여 포인트, 보유 건수)
		_hLog1(downType);

		if(button_label == "이용권 구매") {
			button_label = "이용권/Z-포인트 구매하기";
		}

		if (config.INAPP_CHECK == true && !confirm("안내드립니다.\n\n네이버앱, 다음앱, 카카오앱 등의 앱을 통한 로그인 후 다운로드 시 네이버, 다음카카오의 운영정책에 의해 간헐적으로 오류가 발생할 수 있습니다.\n\n크롬, 사파리, 삼성인터넷 등의 일반 브라우저를 통해 족보닷컴에 로그인 후 콘텐츠 다운로드는 정상적으로 이용할 수 있사오니, 가급적 일반 브라우저를 사용해 주시기 바랍니다.\n\n이에 양해 부탁드립니다.\n감사합니다.")) {
			return false;
		} else {
			if(r_o) {
				var pnlA = r_o.querySelector("#typeA");
				var pnlB = r_o.querySelector("#typeB");
				var pnlC = r_o.querySelector("#typeC");
				var pnlD = r_o.querySelector("#typeD");
				var pnlE = r_o.querySelector("#typeE");
				var pnlF = r_o.querySelector("#typeF");
				var pnlG = r_o.querySelector("#typeG");

				$(r_o).find(".msgBlock").hide();
				
				if(resultCode == "0" ) {
					var _downType = downType.downDiv;

					pnlA.style.display = "none";
					if(downCount == 0) { // for soopring
						var layerTitle_o = r_o.querySelector("#layerTitle");
						layerTitle_o.innerHTML = "이용권 차감";

						pnlB.style.display = "none";
						pnlC.style.display = "none";

						pnlF.style.display = "";
					} else if(_downType == "T"  || _downType == "V" || _downType == "PRE" || _downType == "ECP" || _downType == "FREE") {		// PRE : 예비고1 전용상품
						/*
							1. 이용권 사용한 경우 (T)
							2. 미리보는 중간고사 무료다운 경우 (V)
						*/
						var layerTitle_o = r_o.querySelector("#layerTitle");
						var _strDownType = downType.strDownType;//이용권명
						layerTitle_o.innerHTML = "이용권 차감";

						pnlC.style.display = "none";

						// Body 스크롤 잠금(BJP - Add)
						enableScrollLock();

						var lbl_o = pnlB.querySelector(".msg span");
						if(lbl_o) {
							if(downType.strDownType != "") {
							lbl_o.innerHTML = downType.strDownType;
							}
						}

						var point_o = pnlB.querySelector(".infoPoint #minus_c");		// 차감건수
						if(point_o){
							point_o.innerHTML = util.toNumber(downCount);
						}

						point_o = pnlB.querySelector(".infoPoint #have_c");
						if(point_o){
							if(ownAmount) {
								point_o.innerHTML = util.toNumber(ownAmount);
							} else {
								point_o.innerHTML = "0";
							}
						}

						point_o = pnlB.querySelector("#subMsg .f_blue");
						if(point_o) {
							point_o.innerHTML = util.toNumber(downCount);
						}
						pnlB.style.display = "";

						point_o = pnlB.querySelector("#subMsg #productPriceInfo");
						if(point_o) {		
							if($("#clickedProductPrice").length){//클릭상품가격태그 존재확인
								point_o.innerHTML = "(Z-포인트 사용 시 <span class='f_blue'>"+ util.toNumber($("#clickedProductPrice").val()) +"</span>p가 차감됩니다.)";//이용권 사용 시 해당 상품 가격 문구 추가요청(EDUMIG-3409)
							} else {
								point_o.innerHTML = "";
							}
						}
						
						if ($(location).attr('pathname').toLowerCase().includes("/prego1/") || $(location).attr('pathname').toLowerCase().includes("/premid1/")) {//예비중1, 예비고1 삭제처리 요청
							point_o = pnlB.querySelector("#subMsg");
							if(point_o) {
								point_o.style.display = "";
							}

							point_o = pnlB.querySelector("#subMsg #productPriceInfo");
							if(point_o) {
								point_o.innerHTML = "";
							}
						}

						if(_downType == "FREE") {
							$(".msg").text("무료 다운로드");
							$(".msg.f_blue").css("display", "none");
							$(".infoPoint").css("display", "none");
							$("#productPriceInfo").css("display", "none");
							$("#productPriceInfo").parent().css("display", "none");
						}
					}
					// 쿠폰 포인트 + 일반 포인트 합산
					else if(_downType == "A")
					{	
						pnlB.style.display = "none";

						var cp_point_o = pnlG.querySelector("#use_cp");
						if(cp_point_o){
							cp_point_o.innerHTML = util.toNumber(downType.strCouponPointAmount);
						}

						cp_point_o = pnlG.querySelector("#have_cp");
						if(cp_point_o){
							if(downType.strCouponPointAmount) {
								cp_point_o.innerHTML = util.toNumber(downType.strCouponPointAmount);
							} else {
								cp_point_o.innerHTML = "0";
							}
						}

						var zp_point_o = pnlG.querySelector("#use_zp");
						if(zp_point_o){
							zp_point_o.innerHTML = util.toNumber((downCount - downType.strCouponPointAmount));
						}

						zp_point_o = pnlG.querySelector("#have_zp");
						if(zp_point_o){
							if(downType.strCouponPointAmount) {
								zp_point_o.innerHTML = util.toNumber(ownAmount);
							} else {
								zp_point_o.innerHTML = "0";
							}
						}

						pnlG.querySelector("#use_allpoint").innerHTML = util.toNumber(downCount);

						if(button_label == "문제추출")
						{
							$("#redown_txt").hide();
							$("#layer_txt").show();
						}

						if(window.location.pathname.toLowerCase().includes("/soopring/"))
						{
							$("#down_date").text("3");
							$("#notice_txt").hide();
						}

						pnlG.style.display = "";
					}

					else if(_downType == "P" || _downType == "C" ) {
						// 포인트
						var layerTitle_o = r_o.querySelector("#layerTitle");
						layerTitle_o.innerHTML = "포인트 차감";

						pnlB.style.display = "none";

						// Body 스크롤 잠금(BJP - Add)
						enableScrollLock();

						var lbl_o = pnlC.querySelector(".msg span");
						if(lbl_o) {
							if(downType.strDownType != "") {
							lbl_o.innerHTML = downType.strDownType;
							}
						}

						var point_o = pnlC.querySelector(".infoPoint #minus_p");
						if(point_o){
							point_o.innerHTML = util.toNumber(downCount);
						}

						point_o = pnlC.querySelector(".infoPoint #have_p");
						if(point_o){
							if(ownAmount) {
								point_o.innerHTML = util.toNumber(ownAmount);
							} else {
								point_o.innerHTML = "0";
							}
						}

						point_o = pnlC.querySelector("#subMsg .f_blue");
						if(point_o) {
							point_o.innerHTML = util.toNumber(downCount);
						}

						pnlC.style.display = "";
					}
					else if(_downType == "VT") {	// for vod
					}
					else if(_downType == "VP") {	// for vod
					}
					else if(_downType == "VOD") {	// for vod
					}

					if($("#clickedProductPrice").length){//클릭상품가격태그 존재확인(EDUMIG-3409)
						$("#clickedProductPrice").remove();//클릭상품가격태그 태그제거
					}
				}
				else if(resultCode == "VOD") {
					var _downType = downType.payType;
					var _Vod_Type = downType.Vod_Type;

					pnlA.style.display = "none";

					if(_downType == "T") {
						// Body 스크롤 잠금(BJP - Add)
						enableScrollLock();

						// 이용권
						var layerTitle_o = r_o.querySelector("#layerTitle");
						layerTitle_o.innerHTML = "이용권 차감";

						pnlC.style.display = "none";

						var lbl_o = pnlD.querySelector(".msg span");
						if(lbl_o) {
							if(downType.strDownType != "") {
							lbl_o.innerHTML = downType.strDownType;
							}
						}

						var point_o = pnlD.querySelector(".infoPoint #minus_c");
						if(point_o){
							if(downType.Vod_DownCount){
								point_o.innerHTML = util.toNumber(downType.Vod_DownCount);
							}
						}

						point_o = pnlD.querySelector(".infoPoint #have_c");
						if(point_o){
							if(ownAmount) {
								point_o.innerHTML = util.toNumber(ownAmount);
							} else {
								point_o.innerHTML = "0";
							}
						}

						point_o = pnlD.querySelector("#subMsg .f_blue");
						if(point_o) {
							if(downType.Vod_DownCount){
								point_o.innerHTML = util.toNumber(downType.Vod_DownCount);
							}
						}

						point_o = pnlD.querySelector("#subMsg #productPriceInfo");
						if(point_o) {		
							if(downType.Vod_Point){
								point_o.innerHTML = "(Z-포인트 사용 시 <span class='f_blue'>"+ util.toNumber(downType.Vod_Point) +"</span>p가 차감됩니다.)";//이용권 사용 시 해당 상품 가격 문구 추가요청(EDUMIG-3409)
							} else {
								point_o.innerHTML = "";
							}
						}
						
						if ($(location).attr('pathname').toLowerCase().includes("/prego1/") || $(location).attr('pathname').toLowerCase().includes("/premid1/")) {//예비중1, 예비고1 삭제처리 요청
							point_o = pnlD.querySelector("#subMsg");
							if(point_o) {
								point_o.style.display = "";
							}

							point_o = pnlD.querySelector("#subMsg #productPriceInfo");
							if(point_o) {
								point_o.innerHTML = "";
							}
						}

						pnlD.style.display = "";
					}
					else if(_downType == "P" || _downType == "C") {
						// 포인트
						var layerTitle_o = r_o.querySelector("#layerTitle");
						layerTitle_o.innerHTML = "포인트 차감";

						pnlB.style.display = "none";

						// Body 스크롤 잠금(BJP - Add)
						enableScrollLock();

						var lbl_o = pnlE.querySelector(".msg span");
						if(lbl_o) {
							if(downType.strDownType != "") {
							lbl_o.innerHTML = downType.strDownType;
							}
						}

						var point_o = pnlE.querySelector(".infoPoint #minus_p");
						if(point_o){
							if(downType.Vod_DownCount){
								point_o.innerHTML = util.toNumber(downType.Vod_Point);
							}
						}

						point_o = pnlE.querySelector(".infoPoint #have_p");
						if(point_o){
							if(ownAmount) {
								point_o.innerHTML = util.toNumber(ownAmount);
							} else {
								point_o.innerHTML = "0";
							}
						}

						point_o = pnlE.querySelector("#subMsg .f_blue");
						if(downType.Vod_DownCount){
							point_o.innerHTML = util.toNumber(downType.Vod_Point);							
						}

						pnlE.style.display = "";
					}
					else if(_downType == "F"){
						var layerTitle_o = r_o.querySelector("#layerTitle");
						layerTitle_o.innerHTML = "동영상 다시보기";

						var msg_o = r_o.querySelector(".msgBlock .msg");
						var submsg_o = r_o.querySelector(".msgBlock #subMsg");
						msg_o.innerHTML = downType.title;
						submsg_o.innerHTML = downType.msg;

						

						pnlA.style.display = "";

						// Body 스크롤 잠금(BJP - Add)
						enableScrollLock();
					}
					// 쿠폰 포인트 + 일반 포인트 합산
					else if(_downType == "A")
					{
						pnlB.style.display = "none";

						var cp_point_o = pnlG.querySelector("#use_cp");
						if(cp_point_o){
							cp_point_o.innerHTML = util.toNumber(downType.strCouponPointAmount);
						}

						cp_point_o = pnlG.querySelector("#have_cp");
						if(cp_point_o){
							if(downType.strCouponPointAmount) {
								cp_point_o.innerHTML = util.toNumber(downType.strCouponPointAmount);
							} else {
								cp_point_o.innerHTML = "0";
							}
						}

						var zp_point_o = pnlG.querySelector("#use_zp");
						if(zp_point_o){
							zp_point_o.innerHTML = util.toNumber((downType.Vod_Point - downType.strCouponPointAmount));
						}

						zp_point_o = pnlG.querySelector("#have_zp");
						if(zp_point_o){
							if(downType.strCouponPointAmount) {
								zp_point_o.innerHTML = util.toNumber(downType.strOwnAmount);
							} else {
								zp_point_o.innerHTML = "0";
							}
						}

						pnlG.querySelector("#use_allpoint").innerHTML = util.toNumber(downType.Vod_Point);

						$("#content_type").text("동영상 보기");
						$("#redown_txt").text("최초 시청일 기준 30일간 무료로 다시보기가 가능합니다.");
						$("#notice_txt").hide();

						pnlG.style.display = "";
					}
					else{
						var msg_o = r_o.querySelector(".msgBlock .msg");
						var submsg_o = r_o.querySelector(".msgBlock #subMsg");
						msg_o.innerHTML = downType.title;
						submsg_o.innerHTML = downType.msg;

						pnlA.style.display = "";

						// Body 스크롤 잠금(BJP - Add)
						enableScrollLock();
					}
				}
				else if (resultCode == "SOO") {

				}
				else if (resultCode == "E_SN") {
					// 수프링 에러
					pnlB.style.display = "none";
					pnlC.style.display = "none";
					pnlA.style.display = "";

					var msg_o = r_o.querySelector(".msgBlock .msg");
					var submsg_o = r_o.querySelector(".msgBlock #subMsg");
					msg_o.innerHTML = "";
					submsg_o.innerHTML = downMsg["SOO"][resultCode];
				}
				else if (resultCode == "E_DE") {
					// 다운로드 가능
					pnlB.style.display = "none";
					pnlC.style.display = "none";
					pnlA.style.display = "";

					var msg_o = r_o.querySelector(".msgBlock .msg");
					var submsg_o = r_o.querySelector(".msgBlock #subMsg");
					msg_o.innerHTML = downType.title;
					submsg_o.innerHTML = downType.msg;
				}
				else if (resultCode == "E_HI") {
					// 다운로드 값 존재시
					pnlB.style.display = "none";
					pnlC.style.display = "none";
					pnlA.style.display = "";

					var msg_o = r_o.querySelector(".msgBlock .msg");
					var submsg_o = r_o.querySelector(".msgBlock #subMsg");
					msg_o.innerHTML = downType.title;
					submsg_o.innerHTML = downType.msg;
				}
				else if (resultCode == "RE_FILE") {// 재다운로드인 경우
					pnlB.style.display = "none";
					pnlC.style.display = "none";
					pnlA.style.display = "";

					var msg_o = r_o.querySelector(".msgBlock .msg");
					var submsg_o = r_o.querySelector(".msgBlock #subMsg");
					msg_o.innerHTML = downType.title;
					submsg_o.innerHTML = downType.msg;
				}
				else {
					pnlB.style.display = "none";
					pnlC.style.display = "none";
					pnlA.style.display = "";

					// Body 스크롤 잠금(BJP - Add)
					enableScrollLock();

					var msg_o = r_o.querySelector(".msgBlock .msg");
					var submsg_o = r_o.querySelector(".msgBlock #subMsg");
					if(resultCode <= 2) {
						//var banner_o = r_o.querySelector(".msgBlock #sub_Banner");
						if(resultCode == 1 && TRK_GLB_TOGGLE_GROUP == "T") {
							msg_o.innerHTML = "로그인이 필요합니다.";
							submsg_o.innerHTML = "로그인하여 주시기 바랍니다.";
						} else {
							msg_o.innerHTML = downMsg["E" + "" + resultCode]["msg"];
							submsg_o.innerHTML = downMsg["E" + "" + resultCode]["submsg"];
						}
						
						//banner_o.innerHTML = downMsg["E" + "" + resultCode]["banner"];
					}
					else {
						if(resultCode.includes("YEAR_CHANGE")) {
							resultCode = ownAmount;
							msg_o.innerHTML = "이용권 학년 변경이 필요합니다.";
							$("#subMsg").hide();
							$(".rnpay__cont br").remove();
							$(".download_popup_share_show > p").html("현재 보유하신 이용권은 <span>" + downType + "</span> 전용 이용권입니다.<br><span>" + downCount + "</span> 콘텐츠를 이용하시려면 <em>'이용권 학년 변경'</em>이 필요합니다.<br>이용권 학년 변경 페이지로 이동하시겠습니가?<br><br><span class='yearChange__coment-text'>※ 학년 변경은 " + resultCode + " 기간 내 1회만 가능합니다.</span>");
							$("#btn_share").text("이용권 학년 변경");
							$("#btn_share").removeClass("btn_share");
							$("#btn_share").addClass("tmp_yearchange");
						} else {
							msg_o.innerHTML = "보유하고 있는 이용권이 없습니다.";
							$("#subMsg").show();

							if ($(location).attr('pathname').toLowerCase().includes("/prego1/")) {//예비고1 문구 변경 요청
								submsg_o.innerHTML = "예비고1 맞춤 족보 콘텐츠는<br>전용 이용권으로만 이용할 수 있습니다.";
							} else {
								submsg_o.innerHTML = "이용권/Z-포인트 구매 후 이용바랍니다.";
							}
						}
					}
				}
			}

			if(button_label == "문제추출") {
				button_label = "다운로드";
			}

			var btn = $(r_o).find(".btnPopupSelected");
			
			//[바로보기]버튼 보여지는 조건 확인 common.showViewerBtnCheck 함수
			if (common.showViewerBtnCheck(resultCode, Exfl_Group)) {
				_setDownloadLayer_FooterBtn(r_o, 1);//하단 버튼 2개로 셋팅(다운로드/바로보기)
			} else {
				if(resultCode == 1) {					
					_setDownloadLayer_FooterBtn(r_o, 2);//하단 버튼 2개로 셋팅(다운로드/바로보기)
				} else {
					_setDownloadLayer_FooterBtn(r_o, 0);//하단 버튼 1개로 셋팅(기존과 동일)
				}
			}

			if($("#share_discount_coupon_YN").val() == "Y") {
				trkCLS.setExternalEvent('W5N9AKRI8SH7VCGKN44PN264J20251017', '');
			}

			if($("#share_discount_coupon_Exist_YN").val() == "Y") {
				trkCLS.setExternalEvent('MYAUV6GEJYMCH3QDDRWGR4V3L20251017', '');
			}

			$(btn).html(button_label);
			$(btn).unbind();

			//--공유하기 버튼 나오는 부분 제거 Start
			if($(".download_popup_share_show")) {
				if ($(btn).html() == "이용권 구매") {//권한이 없어서 이용권 구매페이지 이동일 경우에만 공유하기 버튼 나오기
					$(".download_popup_share_show").show();
				} else {
					//$(".download_popup_share_show").hide();
				}

				//예비중1, 예비고1, 마이페이지 다운로드 팝업
				if ($(location).attr('pathname').toLowerCase().includes("/prego1/") || $(location).attr('pathname').toLowerCase().includes("/premid1/") || $(location).attr('pathname').toLowerCase().includes("/mypage/") || isValueEmpty(downType) == true) {
					$(".download_popup_share_show").hide();
				}
			}
			//--공유하기 버튼 나오는 부분 제거 End

			var rtnUrl = window.location.pathname;

			if(window.location.search == '?menu=2')
			{
				rtnUrl = rtnUrl + window.location.search;
			}

			$(btn).bind("click", function() {
				_accessCheck(function(){
					common.checkLogin(function(fg){
						if(fg){
							r_o.style.display = "none";
							_setDownloadLayer_FooterBtn(r_o, 0);//새로고침 안하는 경우가 있기 때문에 하단 버튼 기본으로 다시 셋팅해줘야함

							if(typeof(_callback) == "function") {
								if (resultCode == "E_SN") {
									location.href = '/payment/';
								}

								_callback();
							}
						} else {
							loginPop.show(root_o, rtnUrl, false);
							trkCLS.setExternalEvent("ID7P78JVPM4UCQRMX27HUOY8W20250403", "");
							//location.href = $("#sign_url").val();
						}
					});
				});

				// Body 스크롤 잠금 해제(BJP - Add)
				disableScrollLock();
			});

			//[바로보기] 버튼 클릭 시
			btn = $(r_o).find("#btnViewer");
			$(btn).unbind();
			$(btn).on("click", function() {
				_accessCheck(function(){
					common.checkLogin(function(fg){
						if(fg){
							r_o.style.display = "none";
							
							//[바로보기]버튼 클릭 트래킹 Start
							let trackCD = "LVSZGTEUJ9GCP1QU87ELDMI6I20241007";//PDF
							let params = {"param1" : ExPapr_No, "param2" : _down_expaprGroup, "param3" : _down_expaprCoreType, "param4" : _down_paysvc};
							
							if (resultCode == "RE_FILE") {
								trackCD = "84GRAT9H4PQX8XN2HCFWK8D4O20241107";//재다운로드
								params = {"param1" : ExPapr_No, "param2" : _down_expaprGroup, "param3" : _down_expaprCoreType};
							} else if (Exfl_Group == "4") {
								trackCD = "BUJH9F5OKHCQ7SWB7BI3BPVHU20241107";//HWP
							}

							trkCLS.setExternalEvent(trackCD, params);
							//--[바로보기]버튼 클릭 트래킹 End
							
							_setDownloadLayer_FooterBtn(r_o, 0);//새로고침 안하는 경우가 있기 때문에 하단 버튼 기본으로 다시 셋팅해줘야함

							if(typeof(_callback) == "function") {
								if (resultCode == "E_SN") {
									location.href = '/payment/';
								}
								
								common.setCookie("btnViewerClick", "Y", 1);

								_callback();
							}
						} else {
							loginPop.show(root_o, rtnUrl, false);
						}
					});
				});

				// Body 스크롤 잠금 해제(BJP - Add)
				disableScrollLock();
			});

			btn = r_o.querySelector(".layerClose");
			$(btn).unbind();
			$(btn).bind("click", function() {
				r_o.style.display = "none";

				// Body 스크롤 잠금 해제(BJP - Add)
				disableScrollLock();
			});

			var btn_share = r_o.querySelector("#btn_share");
			$(btn_share).unbind();
			$(btn_share).bind("click", function() {
				if($(btn_share).text().includes("학년 변경")) {
					trkCLS.setExternalEvent("U6YMIQZDSR2V32JIFMXXSOT5K20250512", "");
					location.href = '/guide/yearchange/';
				} else {
					var zMem_Group = userData.mem_group;
					var zUser_ID = userData.enc_user_id;
					var zMem_Name = userData.user_name;
					var share_YN = $(this).attr("data-val");
					
					if(share_YN == "Y") {
						$.ajax(
						{
							url: '/Include/ajax/set_Share_i_ajax.asp',
							data: {
							},
							error: function(request, status, error) {
								alert('code:' + request.status + '\n' + 'message:' + request.responseText + '\n' + 'error:' + error);
							},
							success: function(data) {
								setNewReward_Share(zMem_Group, zUser_ID, $("#m_zocbo_url").val(), $("#zocbo_url").val(), zMem_Name);
								jQuery("#downloadLayer").hide();
								setTimeout(function(){
									//$("#div_share_Y").next().hide();
									//$("#div_share_Y").show();
									$("#alertpop").show();									
									$("#div_share_Y").show();
								}, 500);
							}
						});
					} else {
						setNewReward_Share(zMem_Group, zUser_ID, $("#m_zocbo_url").val(), $("#zocbo_url").val(), zMem_Name);
						jQuery("#downloadLayer").hide();
						/*setTimeout(function(){
							$("#alertpop").show();
							$("#div_share_N").show();
						}, 500);*/	
					}
				}
			});

			if(TRK_GLB_MEM_GROUP == "T") {
				$("#subMsg").text($("#subMsg").text().replace("/Z쿠폰", ""));
			}

			r_o.style.display = "";
		}
	};

	//다운로드 팝업 [바로보기]버튼 유무 판단하여 버튼 1개 또는 2개짜리로 셋팅
	var _setDownloadLayer_FooterBtn = function(root_obj, num) {
		var footers = $(root_obj).find(".layerFooter").children("span");

		if(num == 2) {
			footers = $(root_obj).find(".layerFooter_noLogin").children("span");
		}
		
		if (num == 0 || num == 2) {//바로보기 버튼 제외된 기본 팝업 셋팅 시 해당 데이터 전부 초기화
			_down_expaprGroup = "";
			_down_expaprCoreType = "";
			_down_paysvc = "";
		}		

		$(footers).hide();

		if(num == 2) {
			jQuery(".layerFooter").hide();
			$(footers).eq(0).show();
		} else {
			$(footers).eq(num).show();
		}
	};

	var _showDownloadLayer_FreeReading = function(resultCode, downType, downCount, ExPapr_No, Exfl_Group, ownAmount, button_label, _callback) {
		var r_o = document.querySelector("#downloadLayer2");
		var root_o = $("#wrapper")[0];

		if (config.INAPP_CHECK == true && !confirm("안내드립니다.\n\n네이버앱, 다음앱, 카카오앱 등의 앱을 통한 로그인 후 다운로드 시 네이버, 다음카카오의 운영정책에 의해 간헐적으로 오류가 발생할 수 있습니다.\n\n크롬, 사파리, 삼성인터넷 등의 일반 브라우저를 통해 족보닷컴에 로그인 후 콘텐츠 다운로드는 정상적으로 이용할 수 있사오니, 가급적 일반 브라우저를 사용해 주시기 바랍니다.\n\n이에 양해 부탁드립니다.\n감사합니다.")) {
			return false;
		} 
		else {
			if(r_o) {
				var pnlA = r_o.querySelector("#typeA");

				$(r_o).find(".msgBlock").hide();

				pnlA.style.display = "";

				var layerTitle_o = r_o.querySelector("#layerTitle");
				layerTitle_o.innerHTML = "이용 안내";

				var msg_o = r_o.querySelector(".msgBlock .msg");
				var submsg_o = r_o.querySelector(".msgBlock #subMsg");

				msg_o.innerHTML = "콘텐츠 다운로드 권한이 없습니다.";
				submsg_o.innerHTML = "학교별 기출 족보 및 지역별 문제의 서비스 종료로 인해<br/>22년 8월 11일 이후 구매한 이용권 혹은 포인트는<br/>해당 콘텐츠 다운로드를 제공하지 않습니다.<br/><br/>출제 경향 파악을 위한 우리학교 기출 자료는<br/>‘ 학교별 기출 무료 열람실 ‘에서 무료로 이용 가능합니다.";

				var btn = r_o.querySelector("#btnSelected");
				btn.innerHTML = button_label;
				$(btn).unbind();

				var rtnUrl = window.location.pathname;

				$(btn).bind("click", function() {
					_accessCheck(function(){
						common.checkLogin(function(fg){
							if(fg){
								r_o.style.display = "none";
								if(typeof(_callback) == "function") {
									_callback();
								}
							} else {
								loginPop.show(root_o, rtnUrl, false);
							}
						});
					});
				});

				btn = r_o.querySelector(".layerClose");
				$(btn).unbind();
				$(btn).bind("click", function() {
					r_o.style.display = "none";
				});

				r_o.style.display = "";
			}
		}
	};

	// 쿠폰 팝업 레이어
	var _showCouponLayer = function(msg_p, _callback1, _callback2) {
		var r_o = document.querySelector("#couponLayer");
		_hLog("r_o=" + r_o);
		if(r_o) {
			var msg_o = r_o.querySelector(".msgBlock");
			msg_o.innerHTML = msg_p;
		}
		var btn = r_o.querySelector("#btnNo");
		$(btn).unbind();
		$(btn).bind("click", function() {
			r_o.style.display = "none";
			if(typeof(_callback1) == "function") {
				_callback1();
			}
		});
		btn = r_o.querySelector("#btnYes");
		$(btn).unbind();
		$(btn).bind("click", function() {
			r_o.style.display = "none";
			if(typeof(_callback2) == "function") {
				_callback2();
			}
		});
		btn = r_o.querySelector(".layerClose");
		$(btn).unbind();
		$(btn).bind("click", function() {
			r_o.style.display = "none";
		});

		r_o.style.display = "";
	};

	// 팝업 레이어
	var _showPopupLayer = function(msg_p, btnNm_p, _callback) {
		var r_o = document.querySelector("#popupLayer");
		_hLog("r_o=" + r_o);
		if(r_o) {
			var msg_o = r_o.querySelector(".msgBlock");
			msg_o.innerHTML = msg_p;
		}

		var btn = r_o.querySelector("#btnConfirm");
		if(btnNm_p){
			btn.innerHTML = btnNm_p;
		}

		$(btn).unbind();
		$(btn).bind("click", function() {
			r_o.style.display = "none";
			if(typeof(_callback) == "function") {
				_callback();
			}
		});

		btn = r_o.querySelector(".layerClose");
		$(btn).unbind();
		$(btn).bind("click", function() {
			r_o.style.display = "none";
		});

		r_o.style.display = "";
	};

	// 페이징 그리기
	var _drawPagingInfo = function(div_o, currPage, totalCount, pageSize, listSize, _callback) {
		if(div_o == null) return null;
		div_o.innerHTML = "";

		if(totalCount <= 0) return div_o;

		var a = document.createElement("a");
		a.className = "pprev";
		a.innerHTML = '<img src="/img/btn_pageing_pprev.png" alt="">';
		a.setAttribute("data-act", "paging");
		a.setAttribute("data-page", 1);
		div_o.appendChild(a);
		$(a).bind("click", function(ev) {
			var evo = util.findEventObject(ev, null);
			var idx_v = evo.getAttribute("data-page");
			if(typeof(_callback) == "function") {
				_callback(idx_v);
			}
			return false;
		});

		var startPage = Math.floor(currPage / pageSize) * pageSize + 1;
		if(currPage % pageSize == 0) startPage = startPage - pageSize;

		var totalPage = Math.ceil(totalCount / listSize);

		if(currPage > pageSize) {
			a = document.createElement("a");
			a.className = "prev";
			a.innerHTML = '<img src="/img/btn_pageing_prev.png" alt="">';
			a.setAttribute("data-act", "paging");
			a.setAttribute("data-page", startPage - 1);
			div_o.appendChild(a);
			$(a).bind("click", function(ev) {
				var evo = util.findEventObject(ev, null);
				var idx_v = evo.getAttribute("data-page");
				if(typeof(_callback) == "function") {
					_callback(idx_v);
				}
				return false;
			});
		}
		else {
			a = document.createElement("a");
			a.className = "prev";
			a.innerHTML = '<img src="/img/btn_pageing_prev.png" alt="">';
			a.setAttribute("data-act", "paging");
			a.setAttribute("data-page", 1);
			div_o.appendChild(a);
			$(a).bind("click", function(ev) {
				var evo = util.findEventObject(ev, null);
				var idx_v = evo.getAttribute("data-page");
				if(typeof(_callback) == "function") {
					_callback(idx_v);
				}
				return false;
			});
		}

		for(var i = 0; i < pageSize; i++) {
			if(totalPage < startPage + i) {
				break;
			}
			a = document.createElement("a");
			if(currPage == startPage + i) {
				a.className = "active";
			}
			a.setAttribute("data-act", "paging");
			a.setAttribute("data-page", startPage + i);
			a.innerHTML = startPage + i;
			div_o.appendChild(a);
			$(a).bind("click", function(ev) {
				var evo = util.findEventObject(ev, null);
				var idx_v = evo.getAttribute("data-page");
				if(typeof(_callback) == "function") {
					_callback(idx_v);
				}
				return false;
			});
		}

		if(totalPage >= startPage + pageSize) {
			a = document.createElement("a");
			a.className = "next";
			a.innerHTML = '<img src="/img/btn_pageing_next.png" alt="">';
			a.setAttribute("data-act", "paging");
			a.setAttribute("data-page", startPage + pageSize);
			div_o.appendChild(a);
			$(a).bind("click", function(ev) {
				var evo = util.findEventObject(ev, null);
				var idx_v = evo.getAttribute("data-page");
				if(typeof(_callback) == "function") {
					_callback(idx_v);
				}
				return false;
			});
		}
		else {
			a = document.createElement("a");
			a.className = "next";
			a.innerHTML = '<img src="/img/btn_pageing_next.png" alt="">';
			a.setAttribute("data-act", "paging");
			a.setAttribute("data-page", totalPage);
			div_o.appendChild(a);
			$(a).bind("click", function(ev) {
				var evo = util.findEventObject(ev, null);
				var idx_v = evo.getAttribute("data-page");
				if(typeof(_callback) == "function") {
					_callback(idx_v);
				}
				return false;
			});
		}

		a = document.createElement("a");
		a.className = "nnext";
		a.innerHTML = '<img src="/img/btn_pageing_nnext.png" alt="">';
		a.setAttribute("data-act", "paging");
		a.setAttribute("data-page", totalPage);
		div_o.appendChild(a);
		$(a).bind("click", function(ev) {
			var evo = util.findEventObject(ev, null);
			var idx_v = evo.getAttribute("data-page");
			if(typeof(_callback) == "function") {
				_callback(idx_v);
			}
			return false;
		});

		return div_o;
	};

	// 키 기준으로 데이터 정렬
	var _sortDataByKey = function(Items, parentID, subID) {
		if(Items == null) return null;
		var rItems = {"list":[]};
		for(var i = 0; i < Items.length; i++) {
			var item = Items[i];
			if(item[subID] == null || item[subID] == "") {
				item["subItems"] = [];
				rItems.list.push(item);
			}
			else {
				for(var j = 0; j < rItems.list.length; j++) {
					if(rItems.list[j][parentID] == item[parentID]) {
						rItems.list[j].subItems.push(item);
						break;
					}
				}
			}
		}
		return rItems;
	};

	// 데이터 기준으로 데이터 정렬
	var _sortDataByData = function(Items, dataID) {
		if(Items == null) return null;
		var rItems = {"list":[]};
		for(var i = 0; i < Items.length; i++) {
			var item = Items[i];
			var isFind = false;
			for(var j = 0 ; j < rItems.list.length; j++) {
				if(rItems.list[j][dataID] == item[dataID]) {
					isFind = true;
					rItems.list[j].subItems.push(item);
				}
			}

			if(isFind == false) {
				item.subItems = [];
				rItems.list.push(item);
			}
		}
		return rItems;
	};

	// 개수 기준으로 데이터 정렬
	var _sortDataByCount = function(Items, dataID) {
		if(Items == null) return null;
		var rItems = {"list":[]};
		for(var i = 0; i < Items.length; i++) {
			var item = Items[i];
			var isFind = false;
			for(var j = 0 ; j < rItems.list.length; j++) {
				if(rItems.list[j][dataID] == item[dataID]) {
					isFind = true;
					rItems.list[j].subItems.push(item);
				}
			}

			if(isFind == false) {
				var co = Object.assign({}, item);
				item.subItems = [];
				item.subItems.push(co);
				rItems.list.push(item);
			}
		}
		return rItems;
	};

	// 슬라이더 객체 리로딩
	var _initSlider = function(){
		if(fullBannerSlider) {
			fullBannerSlider.reloadSlider();
		}
	};

	//다운로드 팝업 예비고1 이용권구매 버튼(트래킹포함)
	var _goPregoPaymentWithDownTracking = function () {
		trkCLS.setExternalEvent("ZTHIWWMMJDCGZMY6C8TIW6X9L20241028", "");
		setTimeout(function() {
			document.location.href = "/payment/default_v.asp?category=CD_000100010009";
		}, 500);
	};

	// 쿠키 정보 가져오기
	var _getCookie = function(cookieName) {
		var cookieNameSet = cookieName + "=";
		var oCookie = document.cookie;
		if (oCookie.length > 0) {
			var nBegin = oCookie.indexOf(cookieNameSet);
			if ( nBegin < 0 )
				return;
			nBegin += cookieNameSet.length;
			var nEnd = oCookie.indexOf(";", nBegin);
			if ( nEnd == -1)
				nEnd = oCookie.length;
			return unescape(oCookie.substring(nBegin, nEnd));
		}
	};

	// 쿠키 정보 셋팅하기
	var _setCookie = function(name, value, expiredays) {
		if (typeof(expiredays) == "undefined") {
			return;
		}

		var todayDate = new Date();
		todayDate.setDate(todayDate.getDate() + expiredays);
		document.cookie = name + "=" + escape(value) + "; path=/; expires=" + todayDate.toGMTString() + ";domain=zocbo.com";
	};

	// 바로보기 버튼 보이는 조건 함수
	var _showViewerBtnCheck = function(resultCode, exflGroup) {
		var returnValue = false;
		
		//마이페이지 제외(페이지로 예외처리)
		if ($(location).attr('pathname').toLowerCase().includes("/mypage/") == false && $(location).attr('pathname').toLowerCase().includes("/exam/previousexam.asp") == false) {
			//학생 토글인 경우(토글로 예외처리)
			if (TRK_GLB_TOGGLE_GROUP_CD == "2") {
				//파일 종류 확인
				if (exflGroup == "2" || exflGroup == "4") {
				//resultCode => 0:파일다운로드,  RE_FILE:파일 재다운로드, STORAGE:resultcode가 없는 나와야하는 경우 임의변수(다운로드 상태값으로 예외처리)
					if (resultCode == "0" || resultCode == "RE_FILE" || resultCode == "VIEWER") {
						returnValue = true;
					}
				}
			}
		}
		
		return returnValue;
	};
	
	//다운로드 시험지 group,coretype,paysvc 저장(다운로드 팝업 띄울때 사용)
	var _setDownPopupExpaprInfo = function(expaprGroup, expaprCoreType, paysvc) {
		_down_expaprGroup = isValueEmpty(expaprGroup) == false ? expaprGroup : "";
		_down_expaprCoreType = isValueEmpty(expaprCoreType) == false ? expaprCoreType : "";
		_down_paysvc = isValueEmpty(paysvc) == false ? paysvc : "";//차감 수단
	};

	return {
		init:function() { _init(); },
		initEvent : function() {
			root = document;
			_initEvent();
		},
		checkLogin:function(_call) { _checkLogin(_call); },
		mem_Group_A_Block:function() { _mem_Group_A_Block(); },
		accessCheck: function(_callback){
			_accessCheck(_callback);
		},
		resetA:function() {
			$("#fullMenu a").unbind();
			$("#fullMenu a").bind("click", function() {return true;});
		},
		isPremium:function(str) {
			if(str.indexOf("(프리미엄)") > 0) {
				return true;
			}
			return false;
		},
		getSiteItems:function() { return siteItems; },
		alert:function(title_p, msg_p, cancel_call, ok_call) { _alert(title_p, msg_p, cancel_call, ok_call); },
		toast:function(msg_p, call_p) { _toast(msg_p, call_p);},
		showSelect:function(items, sIndex, _callback) {
			_showSelect(items, sIndex, _callback);
		},
		showMultiSelect:function(items, sIndex, _callback) {
			_showMultiSelect(items, sIndex, _callback);
		},
		showFlexMultiSelect:function(title, items, sIndex, _callback){
			_showFlexMultiSelect(title, items, sIndex, _callback);
		},
		showPaySelect:function(items, sIndex, unitPrice, _callback) {
			_showPaySelect(items, sIndex, unitPrice, _callback);
		},
		showFlexSelect:function(title, items, sIndex, isShowBtn, _callback) {
			_showFlexSelect(title, items, sIndex, isShowBtn, _callback);
		},
		showFlexSelectPro:function(title, items, sIndex, isShowBtn, _callback) {
			_showFlexSelectPro(title, items, sIndex, isShowBtn, _callback);
		},
		showFilter:function(_callback) {
			_showFilter(_callback);
		},
		showDownloadLayer:function(resultCode, downType, downCount, ExPapr_No, Exfl_Group, ownAmount, button_label, _callback) {
			_showDownloadLayer(resultCode, downType, downCount, ExPapr_No, Exfl_Group, ownAmount, button_label, _callback);
		},
		showDownloadLayer_FreeReading:function(resultCode, downType, downCount, ExPapr_No, Exfl_Group, ownAmount, button_label, _callback) {
			_showDownloadLayer_FreeReading(resultCode, downType, downCount, ExPapr_No, Exfl_Group, ownAmount, button_label, _callback);
		},
		showCouponLayer:function(msg_p, _callbac1, _callback2) {
			_showCouponLayer(msg_p, _callbac1, _callback2);
		},
		showPopupLayer:function(msg_p, btnNm_p, _callback) {
			_showPopupLayer(msg_p, btnNm_p, _callback);
		},
		drawPagingInfo:function(div_o, currPage, totalCount, pageSize, listSize, _callback) {
			return _drawPagingInfo(div_o, currPage, totalCount, pageSize, listSize, _callback);
		},
		goPage:function(page) {
			if(page != "" && page != null) {
				document.location.href = page;
			}
			return false;
		},
		checkAdmin: function(_callback) {
			return _checkAdmin(_callback);
		},
		setCount: function(group_name, grade, subj_name, _callback) {
			_setCount(group_name, grade, subj_name, _callback);
		},
		sortDataByKey:function(Items, parentID, subID) {
			return _sortDataByKey(Items, parentID, subID);
		},
		sortDataByData:function(Items, dataID) {
			return _sortDataByData(Items, dataID);
		},
		sortDataByCount:function(Items, dataID) {
			return _sortDataByCount(Items, dataID);
		},
		initSlider: function(){
			_initSlider();
		},
		goPregoPaymentWithDownTracking: function(){
			_goPregoPaymentWithDownTracking();
		},
		getCookie:function(cookieName) {
			return _getCookie(cookieName);
		},
		setCookie:function(name, value, expiredays) {
			return _setCookie(name, value, expiredays);
		},
		showViewerBtnCheck:function(resultCode, exflGroup) {
			return _showViewerBtnCheck(resultCode, exflGroup);
		},
		setDownPopupExpaprInfo:function(expaprGroup, expaprCoreType, paysvc) {
			return _setDownPopupExpaprInfo(expaprGroup, expaprCoreType, paysvc);
		}
	}
}();

const isValueEmpty = function (value) {

    if (value == null) {
        return true;
    }

    if (typeof value === "string") {
        return jQuery.trim(value) === "";
    }

    if (Array.isArray(value)) {
        return value.length === 0;
    }

    if (typeof value === "object") {
        return Object.keys(value).length === 0;
    }

    return false;
};

let templateReplace = function(template, params) {
    for (var i = 0; i < params.length; i++) {
        var x = new RegExp('(\\{'+i+'\\})', 'g');
        template = template.replace(x, params[i]);
    }
    return template;
}

const isNumber = function (value) {
	if (typeof value === 'number') {
		return !isNaN(value);
	}
	if (typeof value === 'string') {
		return value.trim() !== '' && !isNaN(Number(value));
	}
	return false;

}

const getNumber = function (value, initValue) {
	if (isNumber(value)) {
		return Number(value);
	}
	return initValue;
}

const getPhoneFormat = function (mem_HP) {
	var firstlength = mem_HP.length > 9 ? 3 : 2;
	return [
		mem_HP.slice(0, firstlength),
		mem_HP.slice(firstlength, mem_HP.length - 4),
		mem_HP.slice(mem_HP.length - 4),
	].join("-");
}

const formatPhoneNumber = function(value) {
    // 숫자만 추출
    value = value.replace(/[^0-9]/g, "");

    // 최대 11자리
    value = value.substring(0, 11);

    if (value.length <= 3) {
        return value;
    }

    if (value.length <= 7) {
        return value.substring(0, 3) + "-" + value.substring(3);
    }

    return value.substring(0, 3) + "-"
        + value.substring(3, 7) + "-"
        + value.substring(7);
}

const roundDown = function (value, digits) {
    let multiplier = Math.pow(10, digits);

    if (digits >= 0) {
        return value >= 0
            ? Math.floor(value * multiplier) / multiplier
            : Math.ceil(value * multiplier) / multiplier;
    }

    multiplier = Math.pow(10, -digits);

    return value >= 0
        ? Math.floor(value / multiplier) * multiplier
        : Math.ceil(value / multiplier) * multiplier;
}

let addComma = function(value) {
    if (isValueEmpty(value) == false) return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

let isArrayEmpty = function(arr) {
	if (Array.isArray(arr) && arr.length === 0) {
		return true;
	} else {
		return false;
	}
}

let isArrayInValue = function(arr, value) {
	if (Array.isArray(arr)) {
		return arr.includes(value);
	} else {	
		return false;
	}
}

let generateRandomString = function(num) {
    const characters ='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz123456789';
    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < num; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  }

var deviceTypeChk = function() {
	var userAgent = navigator.userAgent.toLowerCase();
	var result = '';
	if (userAgent.search('android') > -1 || (/linux/i.test(userAgent) && navigator.maxTouchPoints == 5)) {
		result = "aos"
	} else if ((/iphone|ipad|ipod/i.test(userAgent)) || (/mac/i.test(userAgent) && navigator.maxTouchPoints == 5)) {
		result = "ios"
	} else {
		result = "etc"
	}
    return result;
  }

var userAgentChk = function() {
	var userAgent = navigator.userAgent.toLowerCase();
	var mobileBrowser = "";
	if (userAgent.indexOf("edg") !== -1) {
		// Microsoft Edge 브라우저를 사용 중입니다.
		mobileBrowser = "Edge";
	} else if (userAgent.indexOf("firefox") !== -1 || userAgent.indexOf("fxios") !== -1) {
		// Firefox 브라우저를 사용 중입니다.
		mobileBrowser = "Firefox";
	} else if (userAgent.indexOf("opera") !== -1 || userAgent.indexOf("opr") !== -1 || userAgent.indexOf("opt") !== -1) {
		// Opera 브라우저
		mobileBrowser = "Opera";
	} else if (userAgent.indexOf("chrome") !== -1 || userAgent.indexOf("crios") !== -1) {
		// Chrome 브라우저를 사용 중입니다.
		mobileBrowser = "Chrome";
	} else if (userAgent.indexOf("safari") !== -1) {
		// Safari 브라우저를 사용 중입니다.
		mobileBrowser = "Safari";
	} else {
		mobileBrowser = "Etc";
	}
    return mobileBrowser;
}


var jsonKeyUpperCase = function(object) {
	if (Array.isArray(object)) { // 리스트<맵> 형식으로 넘어오는 경우 처리
		object.forEach((item, index) =>{
			object[index] = Object.fromEntries(Object.entries(item).map(([key, value]) => [key.toUpperCase(), value]));
		});
		return object;
	} else { // 맵 형식으로 넘어오는 경우 처리
		return Object.fromEntries(Object.entries(object).map(([key, value]) => [key.toUpperCase(), value]));
	}
}

// json -> querystring 변환
function json_to_querystring(jsonData) {
	return Object.keys(jsonData).map(key => key + '=' + encodeURIComponent(jsonData[key])).join('&');
}
// End : json -> querystring 변환

// 이벤트 Banner Click Log (커스터마이징)
function custom_BannerAction_Log(jsonData) {
	jsonData["device_type"] = "MO";	
	var queryString = json_to_querystring(jsonData);	

	/* 특정 이벤트에 해당되는 조건으로 분기 처리 */
	if(jsonData.gubun == "EUDMIG_3020") {
		fetch("/Include/custom_bannerAction_Log_i.asp?"+queryString);
		
		if (jsonData.url != "") {
			if(jsonData.target == "blank") {
				window.open(jsonData.url);
			} else {
				location.href = jsonData.url;
			}
		}
	}
}
// END

function setNewReward_Share(zMem_Group, User_ID, m_host, pc_host, zMem_Name) {
	var kakao_title;
	var kakao_description;
	var m_url;
	var www_url;
	var bottomBtnTxt;
	var kakao_image = "";
	var share_Group = "C";

	if(TRK_GLB_MEM_GROUP == "T") {
		kakao_title = "[선생님 이번 수업은 편하게 준비해요.]\n\n";
		kakao_description = zMem_Name + " 선생님의 강력 추천!\n매번 수업 자료 만드느라 고생 많으시죠?\n단 2분이면 문제지 제작 완료!\n족보 클라우드에서 효율적인 수업 준비를 해보세요!";
		bottomBtnTxt = "편하게 자료 만들기";
		share_Group = "T";
	} else {
		kakao_title = "[내신 대비 꿀자료 공유]\n\n";
		kakao_description = "너 이번 시험 어떻게 공부하고 있어?\n내가 족보닷컴에서 우리 학교 맞춤 자료 찾아봤는데, 이거 진짜 너한테 꼭 필요할거 같아서 공유해.\n지금 바로 확인해 보고 시험에 꼭 활용해 봐!";
		bottomBtnTxt = "추천 꿀자료 확인하기";
	}

	m_url = m_host + "/event/landing_membership/?share_platform=kakao&share_user_id=" + User_ID + "&share_group=" + share_Group;
	www_url = m_url;

	kakaoCLS.init(kakao_title, kakao_description, kakao_image, m_url, www_url, bottomBtnTxt, 'text');
}

//무료체험 구매 유도 팝업 배너 클릭 로그 적재(클릭 페이지 함께 누적)
function freetrialBannerLogInsert(event_cd, banner_action_cd, target, url) {
	/*
		event_cd => 각 기획서 배너 별 구분 값 => Admin 코드관리 페이지에서 관리
		banner_action_cd => 각 클릭 링크별 구분 값 => Admin 코드관리 페이지에서 관리
		target => target = 새창 / 그외 = 기존창 이동
		url => 이동 페이지 경로
	*/
	jQuery.ajax(
	{
		url: '/Include/ajax/freetrialBannerLogInsertAjax.asp',
		data: 
		{
			event_cd: event_cd,
			banner_action_cd : banner_action_cd
		},
		dataType: 'json',
		async: true,
		error: function(request, status, error)
		{
			alert('code:' + request.status + '\n' + 'message:' + request.responseText + '\n' + 'error:' + error);
		},
		success: function(data)
		{
			if (url != "") {
				if(target == "blank")
				{
					window.open(url);
				}
				else
				{
					location.href = url;
				}
			}
		}
	});
}

// 스크롤 잠금(BJP - Add)
const enableScrollLock = () => {
	const { body } = document;
	if (!body.getAttribute('scrollY')) {
		const pageY = window.pageYOffset;

		body.setAttribute('scrollY', pageY.toString());

		body.style.overflow = 'hidden';
		body.style.position = 'fixed';
		body.style.left = '0px';
		body.style.right = '0px';
		body.style.bottom = '0px';
		body.style.top = `-${pageY}px`;
	}
};

// 스크롤 잠금 해제(BJP - Add)
const disableScrollLock = () => {
	const { body } = document;
	if (body.getAttribute('scrollY')) {
		body.style.removeProperty('overflow');
		body.style.removeProperty('position');
		body.style.removeProperty('top');
		body.style.removeProperty('left');
		body.style.removeProperty('right');
		body.style.removeProperty('bottom');

		window.scrollTo(0, Number(body.getAttribute('scrollY')));

		body.removeAttribute('scrollY');
	}
};
let pointExchangeOutPopupChk = false;
let commonOutPopupChk = false;

const commonGLB = {
	init : function () {
		if (TRK_GLB_REVIEW_EXCEPT) {
            jQuery(".REVIEW_EXCEPT").hide();
        }
	},
	APP_CONTENT_LIST_ICON : "HAMBUERGER",
	setStorage : function (key, value) {
        if (isValueEmpty(value) == false) { 
            storage.setLocal(key, value);
        } else {
            storage.removeLocal(key);
        }
    },
    getStorage : function (key) {
        let value = isValueEmpty(storage.getLocal(key)) ? "" : storage.getLocal(key);
        if (jQuery.isNumeric(value)) {
            value = value;
        }
        return isValueEmpty(storage.getLocal(key)) ? "" : storage.getLocal(key);
    },
	getMenuCD : function () {
        //return isValueEmpty(storage.getLocal(storage.SEARCH_MENU_CD)) ? "" : storage.getLocal(storage.SEARCH_MENU_CD);
		return isValueEmpty(storage.getLocal(storage.SEARCH_MENU_CD)) ? appCLS.getMenuCD() : storage.getLocal(storage.SEARCH_MENU_CD);
    },
	getSubMenuCD : function () {
        return isValueEmpty(storage.getLocal(storage.SEARCH_SUB_MENU_CD)) ? "" : storage.getLocal(storage.SEARCH_SUB_MENU_CD);
    },
    getSiteID : function () {
        //return isValueEmpty(storage.getLocal(storage.SEARCH_SITEID)) ? "" : storage.getLocal(storage.SEARCH_SITEID);
		return isValueEmpty(storage.getLocal(storage.SEARCH_SITEID)) ? appCLS.getSiteID() : storage.getLocal(storage.SEARCH_SITEID);
    },
    getGrade : function () {
        return isValueEmpty(storage.getLocal(storage.SEARCH_GRADE)) ? "" : Number(storage.getLocal(storage.SEARCH_GRADE));
    },
    getSubjectCD : function () {
        return isValueEmpty(storage.getLocal(storage.SEARCH_SUBJECT_CD)) ? "" : storage.getLocal(storage.SEARCH_SUBJECT_CD);
    },
    getSubjectDetailCD : function () {
        return isValueEmpty(storage.getLocal(storage.SEARCH_SUBJECT_DETAIL_CD)) ? "" : storage.getLocal(storage.SEARCH_SUBJECT_DETAIL_CD);
    },
    getTxCD : function () {
        return isValueEmpty(storage.getLocal(storage.SEARCH_TX_CD)) ? "" : storage.getLocal(storage.SEARCH_TX_CD);
    },
	getLevelCD : function () {
        return isValueEmpty(storage.getLocal(storage.SEARCH_LEVEL_CD)) ? "" : storage.getLocal(storage.SEARCH_LEVEL_CD);
    },
	getYearCD : function () {
        return isValueEmpty(storage.getLocal(storage.SEARCH_YEAR_CD)) ? "" : storage.getLocal(storage.SEARCH_YEAR_CD);
    },
	getSclID : function () {
        return isValueEmpty(storage.getLocal(storage.SEARCH_SCL_ID)) ? "" : storage.getLocal(storage.SEARCH_SCL_ID);
    },
    getRootPartCD : function () {
        return isValueEmpty(storage.getLocal(storage.SEARCH_ROOTPART_CD)) ? "" : storage.getLocal(storage.SEARCH_ROOTPART_CD);
    },
	getWork : function () {
        return isValueEmpty(storage.getLocal(storage.SELECTED_WORK)) ? storage.SEARCH_WORK_TITLE : storage.getLocal(storage.SELECTED_WORK);
    },
	getWorkTitle : function () {
        return isValueEmpty(storage.getLocal(storage.SEARCH_WORK_TITLE)) ? "" : storage.getLocal(storage.SEARCH_WORK_TITLE);
    },
	getWorkAuthor : function () {
        return isValueEmpty(storage.getLocal(storage.SEARCH_WORK_AUTHOR)) ? "" : storage.getLocal(storage.SEARCH_WORK_AUTHOR);
    },
    getKeyword : function () {
        return isValueEmpty(storage.getLocal(storage.SEARCH_KEYWORD)) ? "" : storage.getLocal(storage.SEARCH_KEYWORD);
    },
    getSearchExpaprGroupCD : function () {
        return isValueEmpty(storage.getLocal(storage.SEARCH_EXPAPR_GROUP_CD)) ? "" : storage.getLocal(storage.SEARCH_EXPAPR_GROUP_CD);
    },
    getSearchExpaprCoreTypeCD : function () {
        return isValueEmpty(storage.getLocal(storage.SEARCH_EXPAPR_CORETYPE_CD)) ? "" : storage.getLocal(storage.SEARCH_EXPAPR_CORETYPE_CD);
    },
    getReturnPageURL : function () {
        return isValueEmpty(storage.getLocal(storage.RETURN_PAGE_URL)) ? "" : storage.getLocal(storage.RETURN_PAGE_URL);
    },
	getSearchTextBookCD : function () {
        return isValueEmpty(storage.getLocal(storage.SEARCH_TEXT_BOOK_CD)) ? "" : storage.getLocal(storage.SEARCH_TEXT_BOOK_CD);
    },
	getSearchTextBookNM : function () {
        return isValueEmpty(storage.getLocal(storage.SEARCH_TEXT_BOOK_NM)) ? "" : storage.getLocal(storage.SEARCH_TEXT_BOOK_NM);
    },
	getSearchVodType : function () {
        return isValueEmpty(storage.getLocal(storage.SEARCH_VOD_TYPE)) ? "" : storage.getLocal(storage.SEARCH_VOD_TYPE);
    },
	getSearchStepCD : function () {
        return isValueEmpty(storage.getLocal(storage.SEARCH_STEP_CD)) ? "" : storage.getLocal(storage.SEARCH_STEP_CD);
    },
	getSelectedStorageType : function () {
        return isValueEmpty(storage.getLocal(storage.SELECTED_STORAGE_TYPE)) ? "" : storage.getLocal(storage.SELECTED_STORAGE_TYPE);
    },
	getContentListMoveWithinPage : function () {
        return isValueEmpty(storage.getLocal(storage.CONTENT_LIST_MOVE_WITHIN_PAGE)) ? "" : storage.getLocal(storage.CONTENT_LIST_MOVE_WITHIN_PAGE);
    },
	getIsTransferChapter : function () {
        return isValueEmpty(storage.getLocal(storage.IS_TRANSFER_CHAPTER)) ? "" : storage.getLocal(storage.IS_TRANSFER_CHAPTER);
    },
	PRODUCT_ERROR_CONFIG : {
        "미로그인" : {CODE : -1, MESSAGE:""},
        "준회원" : {CODE : -2, MESSAGE:"회원님은 현재 준회원이시며, 족보닷컴 이용권 구매는 정회원에 한해 가능합니다.<br><br>족보닷컴 PC버전을 통해 정회원으로 전환 후 이용바랍니다."},
        "필수값누락" : {CODE : -3, MESSAGE:"필수 입력값이 누락되었습니다. 입력 후 다시 시도해주세요."},
        "기타" : {CODE : -4, MESSAGE:"예기치않는 오류가 발생하였습니다. 새로고침 이후에 재시도 부탁드립니다."},
    },
	SERVICE_TYPE_CD : {
		"PC_WEB" : 1,
		"모바일_WEB" : 2,
		"APP" : 3,
		"APP_웹뷰" : 4,
	},
	PROMOTION_GRADE : {
		"중1"  : "M1",
		"중2"  : "M2",
		"중3"  : "M3",
		"고1"  : "H1",
		"고2"  : "H2",
		"고3"  : "H3",
	},
	PROMOTION_TARGET : {
		"미적용대상" : -1,
        "러닝_예비고1" : 6,
        "러닝_무료" : 7,
        "러닝_만료" : 8,
        "러닝_예비중1" : 11,
        "러닝_전유료" : 12,
		"러닝_가입7일" : 13,
        "러닝_Z쿠폰_기구매자" : 15,
        "티칭_무료" : 9,
		"티칭_만료" : 10,
        "티칭_전유료" : 14,
		"티칭_가입7일" : 16,
        "티칭_공유하기" : 2000,

		"러닝_신규_사립_중" : 22000,
		"러닝_초기무료_사립_중" : 23000,
		"러닝_중기무료_사립_중" : 24000,
		"러닝_장기무료_사립_중" : 25000,
		"러닝_저가전유료_사립_중" : 26000,
		"러닝_고가전유료이탈_사립_중" : 27000,
		"러닝_고가전유료정상_사립_중" : 28000,
		"러닝_만료예정_사립_중" : 29000,
		"러닝_초장기무료_사립_중" : 42000,

		"러닝_신규_사립_고" : 22001,
		"러닝_초기무료_사립_고" : 23001,
		"러닝_중기무료_사립_고" : 24001,
		"러닝_장기무료_사립_고" : 25001,
		"러닝_저가전유료_사립_고" : 26001,
		"러닝_고가전유료이탈_사립_고" : 27001,
		"러닝_고가전유료정상_사립_고" : 28001,
		"러닝_만료예정_사립_고" : 29001,
		"러닝_초장기무료_사립_고" : 42001,

		"러닝_엠베스트" : 21,
		"러닝_신규" : 22,
		"러닝_중2" : 43,
		"러닝_고2" : 44,
		"러닝_초기무료" : 23,
		"러닝_중기무료" : 24,
		"러닝_장기무료" : 25,
		"러닝_초장기무료" : 42,
		"러닝_저가전유료" : 26,
		"러닝_고가전유료이탈" : 27,
		"러닝_고가전유료정상" : 28,
		"러닝_만료예정" : 29,
		"러닝_이용권보유" : 30,
		"러닝_디폴트" : 31,
		"러닝_스카이탭" : 45,

		"러닝_신규_AB" : 220,
		"러닝_중2_AB" : 430,
		"러닝_고2_AB" : 440,
		"러닝_초기무료_AB" : 230,
		"러닝_중기무료_AB" : 240,
		"러닝_장기무료_AB" : 250,
		"러닝_초장기무료_AB" : 420,
		"러닝_저가전유료_AB" : 260,
		"러닝_고가전유료이탈_AB" : 270,
		"러닝_고가전유료정상_AB" : 280,
		"러닝_만료예정_AB" : 290,
		

		"티칭_신규" : 32,
		"티칭_초기무료" : 33,
		"티칭_중기무료" : 34,
		"티칭_장기무료" : 35,
		"티칭_저가전유료" : 36,
		"티칭_고가전유료이탈" : 37,
		"티칭_전과목" : 47,
		
		"티칭_신규_AB" : 320,
		"티칭_초기무료_AB" : 330,
		"티칭_중기무료_AB" : 340,
		"티칭_장기무료_AB" : 350,
		"티칭_저가전유료_AB" : 360,
		"티칭_고가전유료이탈_AB" : 370,
		"티칭_고가전유료정상_AB" : 380,
		"티칭_만료예정_AB" : 390,

		"티칭_고가전유료정상" : 38,
		"티칭_만료예정" : 39,
		"티칭_이용권보유" : 40,
		"티칭_디폴트" : 41,

    },
	SITE_ID : {
		"중학생" : 'M',
		"고등학생" : "H",
	},
	MEM_GROUP : {
		"학생" : "S",
		"학부모" : "P",
		"선생님" : "T",
		"준회원" : "A",
	},
	DOMAIN_CD : {
		"WWW" : 1,
		"CLOUD" : 2,
	},
	IS_TABLET_CD : {
		"미사용" : 0,
		"사용" : 1,
	},
	IN_APP_URL : [
		{
			TITLE : "최다오답공략",
			M_URL : "/exam/examlist.asp",
		}
	],
	MAPPING_URL : [
		{
			NAME : "서술형공략_중등",
			M_URL : "/m/?menu=5&group=0",
			WWW_URL : "/zocbomid/zocboexam/exam_descriptive.asp",
			USE_CD : 1,
		},
		{
			NAME : "서술형공략_고등",
			M_URL : "/h/?menu=5&group=0",
			WWW_URL : "/zocbohigh/zocboexam/exam_descriptive.asp",
			USE_CD : 1,
		},
		{
			NAME : "단계별학습_중등/수준별학습",
			M_URL : "/m/?menu=4",
			WWW_URL : "/zocbomid/zocboexam/exam_unit.asp",
			USE_CD : 1,
		},
		{
			NAME : "단계별학습_고등/수준별학습",
			M_URL : "/h/?menu=4",
			WWW_URL : "/zocbohigh/zocboexam/exam_unit.asp",
			USE_CD : 1,
		},
		{
			NAME : "최다오답공략_중등",
			M_URL : "/exam/examlist.asp?siteid=m",
			WWW_URL : "/exam/examlist.asp",
			USE_CD : 1,
		},
		{
			NAME : "최다오답공략_고등",
			M_URL : "/exam/examlist.asp?siteid=h",
			WWW_URL : "/zocbohigh/zocboexam/exam_mostwrong.asp",
			USE_CD : 1,
		},
		{
			NAME : "최다빈출공략_중등",
			M_URL : "/m/?menu=5&group=1",
			WWW_URL : "/zocbomid/zocboexam/exam_most.asp",
			USE_CD : 1,
		},
		{
			NAME : "최다빈출공략_고등",
			M_URL : "/h/?menu=5&group=1",
			WWW_URL : "/zocbohigh/zocboexam/exam_most.asp",
			USE_CD : 1,
		},
		{
			NAME : "강남3구빈출유형_중등",
			M_URL : "/m/?menu=2&type=4",
			WWW_URL : "/guide/k3/default.asp",
			USE_CD : 1,
		},
		{
			NAME : "강남3구빈출유형_고등",
			M_URL : "/h/?menu=2&type=4",
			WWW_URL : "/guide/k3/default.asp",
			USE_CD : 1,
		},
		{
			NAME : "개념학습_중등",
			M_URL : "/m/?menu=1",
			WWW_URL : "/zocbomid/zocboexam/exam_conceptcheck.asp",
			USE_CD : 1,
		},
		{
			NAME : "개념학습_고등",
			M_URL : "/h/?menu=1",
			WWW_URL : "/zocbohigh/zocboexam/exam_conceptcheck.asp",
			USE_CD : 1,
		},
		{
			NAME : "실전대비_중등",
			M_URL : "/m/?menu=5",
			WWW_URL : "/zocbomid/zocboexam/exam_most.asp",
			USE_CD : 1,
		},
		{
			NAME : "실전대비_고등",
			M_URL : "/h/?menu=5",
			WWW_URL : "/zocbohigh/zocboexam/exam_most.asp",
			USE_CD : 1,
		},
		{
			NAME : "직전대비_중등",
			M_URL : "/m/?menu=6",
			WWW_URL : "/zocbomid/zocboexam/preparation.asp",
			USE_CD : 1,
		},
		{
			NAME : "직전대비_고등",
			M_URL : "/h/?menu=6",
			WWW_URL : "/zocbohigh/zocboexam/preparation.asp",
			USE_CD : 1,
		},
		{
			NAME : "성적진단평가_중등",
			M_URL : "/freetrial/learningtest.asp?type=0",
			WWW_URL : "/freetrial/learningtest_mid.asp",
			USE_CD : 1,
		},
		{
			NAME : "성적진단평가_고등",
			M_URL : "/freetrial/learningtest.asp?type=1",
			WWW_URL : "/freetrial/learningtest_high.asp",
			USE_CD : 1,
		},
		{
			NAME : "수학마스터_중등",
			M_URL : "/m/?menu=4&group=master",
			WWW_URL : "/zocbomid/pro/mathstep.asp?Subj_Code=MT&Grade=2",
			USE_CD : 1,
		},
		{
			NAME : "수학마스터_고등",			
			M_URL : "/h/?menu=4&group=master",
			WWW_URL : "/zocbohigh/pro/mathstep.asp?Subj_Code=MT&Grade=2",
			USE_CD : 1,
		},
		{
			NAME : "영문법_중등",
			M_URL : "/m/?menu=1&group=enggrammar",
			WWW_URL : "/zocbomid/pro/enggrammar.asp?Subj_Code=EG&Grade=2",
			USE_CD : 1,
		},
		{
			NAME : "영문법_고등",			
			M_URL : "/h/?menu=1&group=enggrammar",
			WWW_URL : "/ZocboHigh/pro/enggrammar.asp?Subj_Code=EG&Grade=1",
			USE_CD : 1,
		},
		{
			NAME : "수준별Ai학습_중등",
			M_URL : "/m/exam_unit_ai.asp",
			WWW_URL : "/ZocboMid/ZocboExam/Exam_Unit_ai.asp",
			USE_CD : 1,
		},
		{
			NAME : "수준별Ai학습_고등",
			M_URL : "/h/exam_unit_ai.asp",
			WWW_URL : "/ZocboHigh/ZocboExam/Exam_Unit_ai.asp",
			USE_CD : 1,
		},
	],
	removeParamAndUpdateURL(paramToRemove) {
		const url = new URL(window.location.href);
		url.searchParams.delete(paramToRemove);
		window.history.replaceState({}, '', url);
	},
	getSplitValue : function (str, index) {
		const parts = str.split('|');
		return parts[index] !== undefined ? parts[index] : '';
	},
	getIsInAppURL : function(url) {
		let isInAppURL = false;
		let inAppURL = this.IN_APP_URL.filter((val) => { return val.M_URL == url; });
		if (inAppURL.length > 0) {
			isInAppURL = true;
		}
		return isInAppURL;
	},
	getInAppURLTitle : function(url) {
		let title = "";
		let inAppURL = this.IN_APP_URL.filter((val) => { return val.M_URL == url; });
		if (inAppURL.length > 0) {
			title = inAppURL[0].TITLE;
		}
		return title;
	},
	getMappingURL : function(url) {
		let mappingURL = this.MAPPING_URL.filter((val) => { 
			return val.M_URL == url && val.USE_CD == 1 ; 
		});
		if (mappingURL.length > 0) {
			url = mappingURL[0].WWW_URL;
		}
		return url;
	},
	setCookie(name, value, expiredays) {
		if (typeof(expiredays) == "undefined") {
			return;
		}
		let todayDate = new Date();
		todayDate.setDate(todayDate.getDate() + expiredays);
		document.cookie = name + "=" + escape(value) + "; path=/; expires=" + todayDate.toGMTString() + ";domain=zocbo.com";
	},
	getCookie(CookieName) {
		let CookieNameSet = CookieName + "=";
		let oCookie = document.cookie;
		if (oCookie.length > 0) {
			var nBegin = oCookie.indexOf(CookieNameSet);

			if ( nBegin < 0 ) {
				return;
			}

			nBegin += CookieNameSet.length;
			let nEnd = oCookie.indexOf(";", nBegin);

			if ( nEnd == -1) {
				nEnd = oCookie.length;
			}
			return unescape(oCookie.substring(nBegin, nEnd));
		}
	},
	getDomain : function(domainCD) {
		let domain = "";
		switch (domainCD) {
			case this.DOMAIN_CD.WWW:
				domain = "https://" + TRK_GLB_WWW_SITE_HOST;
				break;
			case this.DOMAIN_CD.CLOUD:
				domain = "https://" +  TRK_GLB_CLOUD_SITE_HOST;
				break;
		}
		return domain;
	},
	isTablet: function() {
        const userAgent = navigator.userAgent.toLowerCase();
        const width = screen.width;		// 화면 사이즈 구분으로 보안
        const height = screen.height;
        const isTabletUserAgent =
            userAgent.includes('ipad') ||
            (userAgent.includes('android') && !userAgent.includes('mobile')) ||
            ['tablet', 'kindle', 'silk', 'playbook', 'nexus 7'].some(keyword => userAgent.includes(keyword));
        const isTabletSize = (width >= 600 && width <= 1280);
        const isTouchDevice = navigator.maxTouchPoints > 1 && window.matchMedia("(pointer: coarse)").matches;
        return isTabletUserAgent || (isTabletSize && isTouchDevice);	  
    },
	setTimeStamp : function(zb_date) {
        let now = new Date();
        let diffMs = (now - new Date(zb_date)) / 1000;
        let secondes = Math.floor(diffMs);
        let minutes = Math.floor(secondes / 60);
        let hours = Math.floor(minutes / 60);
        let day = Math.floor(hours / 24);
        let weeks = Math.floor(day / 7);

		if (secondes < 0) return "0초 전";
        if (secondes < 60) return secondes+"초 전";
        if (minutes < 60) return minutes+"분 전";
        if (hours > 0 && hours < 24) return hours+"시간 전";
        if (day < 7) return day+"일 전";
        if (weeks > 1 && weeks < 6) return weeks+"주 전";

        return zb_date.substr(0,10);
    },
	sendImageFile : function(path, name, type) {
		if (!$.isArray(name)) {
			name = JSON.parse(name);
		}

		if (type == "profile") {
			mypageCLS.saveProfileImage(2, path, name[0]);
		} else if (type == "OneToOne") {
			my1to1CLS.setImage(path, name[0]);
		} else if (type == "hit_p" || type == "zocbo_p") {
			hitRatioRnCLS.setImage(type, path, name[0]);
		} else {
			communityCLS.setImage(type, path, name);
		}
	},
	setCommonAppContentListHeader : function (menuNm) {
		let showHamburger = true;
		let showBack = false;

		if (commonGLB.getContentListMoveWithinPage() == "Y") {
			showHamburger = false;
			showBack = true;
			commonGLB.APP_CONTENT_LIST_ICON = appCLS.HEADER_ICONS.백키;
		} 

		if (appCLS.getIsRecoomendedVersion(appCLS.getHeaderRecoomendedVersion())) { // 신규
			if (window.location.pathname.toLowerCase().indexOf("/exam/school/previousExam.asp") > -1) {
				if (TRK_GLB_REVIEW_EXCEPT) {
					appCLS.newHeaderInfo(menuNm, showBack, true, Array("HOME"), showHamburger);
				} else {
					appCLS.newHeaderInfo(menuNm, showBack, true, Array("HOME", "GOPAY"), showHamburger);
				}
			} else {
				if (TRK_GLB_REVIEW_EXCEPT) {
					appCLS.newHeaderInfo(menuNm, showBack, false, Array("HOME"), showHamburger);
				} else {
					appCLS.newHeaderInfo(menuNm, showBack, false, Array("HOME", "GOPAY"), showHamburger);
				}
			}
			
		} else {
			if (appCLS.getIsRecoomendedVersion(appCLS.getVodRecoomendedVersion())) {
				appCLS.headerInfo(menuNm, true, true, Array("HOME", "GOPAY"));
			} else {
				appCLS.headerInfo(menuNm, true, true, Array("HOME"));
			}
		}
		storage.removeLocal(storage.CONTENT_LIST_MOVE_WITHIN_PAGE);
	},
	pressedButton : function (button) {
		var todayDate = new Date();

		if ($(".bottomSheet").hasClass("is-active")) {
			bottomSheetClose(document.querySelector(".header__close"));
			return false;
		}

		if (window.location.pathname.toLowerCase().indexOf("/community/") > -1) {
			communityCLS.setCommunityTrack(button, {});
		}

		switch (button) {
			case appCLS.HEADER_ICONS.작성: 
			case appCLS.HEADER_ICONS.더보기:
			case appCLS.HEADER_ICONS.공유:
				if (["/app/inquiry/list.asp", "/app/inquiry/faq.asp"].some(keyword => window.location.pathname.toLowerCase().includes(keyword)) && button == "PENCIL") {
					if (TRK_GLB_IS_LOGIN) {
						my1to1CLS.goWrite();
					} else {
						my1to1CLS.showLoginPop();
					}
				} else if (window.location.pathname.toLowerCase() == "/app/event/hitratiorn/detail.asp") {
					hitRatioRnCLS.showMoreButton();
				} else {
					communityFilterCLS.setBottomSheetCommunity(button);
				}
				break;
			case appCLS.HEADER_ICONS.백키:
				if (window.location.pathname.toLowerCase().indexOf("/community/") > -1) {
					if (window.location.pathname.toLowerCase() == "/community/view.asp") {
						communityViewCLS.back();
					} else {
						communityWriteCLS.cancelWrite();
					}				
				} else if (["/app/landing/2610_s_rep.asp", "/app/landing/2610_t_rep.asp","/app/landing/2603_teaching.asp","/app/landing/2026_teaching_sub.asp","/app/landing/2026_teaching_mt.asp","/app/landing/2604_m2_learning.asp", "/app/landing/2604_h2_learning.asp", "/app/landing/2604_skytab.asp", "/app/landing/2603_learning.asp", "/app/landing/2601_learning.asp", "/app/landing/2601_teaching.asp", "/app/landing/priceup2502.asp", "/app/landing/cloud_priceup2502.asp", "/app/landing/logincompleted2504.asp", "/app/landing/point_exchange.asp", "/app/landing/point_exchange2.asp", "/app/landing/logincompleted2025b_s.asp", "/app/landing/logincompleted2025b_t.asp", "/app/landing/last_couponpack_a2509.asp", "/app/landing/free_couponpack_a2509.asp", "/app/landing/mid3_coupon_a2510.asp" , "/app/event/zcoupon/default.asp" , "/app/landing/exp_learning.asp"  , "/app/landing/exp_teaching.asp"  , "/app/landing/free_learning.asp"  , "/app/landing/free_teaching.asp", "/app/landing/ticket_close_soon_learning.asp", "/app/landing/mid3_coupon2_2510.asp", "/app/landing/2607_fcd.asp", "/app/landing/2607_fcd2.asp", "/app/landing/2607_fcd3.asp", "/app/landing/2607_prego1.asp", "/app/landing/2608_t_dft.asp", "/app/landing/2608_t_cls.asp", "/app/landing/2608_t_math.asp"].some(keyword => window.location.pathname.toLowerCase().includes(keyword))) {		// 로그인 랜딩
					landingCLS.backOpenLayer(window.location.pathname.toLowerCase());
				} else if (["/app/landing/2610_s_dft.asp", "/app/landing/2606_learning_m3.asp", "/app/landing/2606_learning_m1.asp", "/app/landing/2606_learning_h3.asp", "/app/landing/2606_learning_h1.asp", "/app/landing/2026_s_m1.asp", "/app/landing/2026_s_m2.asp", "/app/landing/2026_s_h1.asp", "/app/landing/2026_s_h2.asp", "/app/landing/2608_s_dft.asp"].some(keyword => window.location.pathname.toLowerCase().includes(keyword))) {		// 로그인 랜딩
					landingCLS.backOpenLayer(window.location.pathname.toLowerCase());
				} else if (window.location.pathname.toLowerCase() == "/app/mypage.asp") {
					appCLS.goToHome();
				} else if (window.location.pathname.toLowerCase() == "/exam/include/school/school_region_filter.asp" || window.location.pathname.toLowerCase() == "/exam/school/detail_previousexam.asp") {
					var param = window.location.search;
					location.href = '/exam/school/previousExam.asp' + param;
				} else if (window.location.pathname.toLowerCase().includes("/app/event/luckydraw/") && (TRK_GLB_USER_ID == "-1" || $("#luckydraw_event_Target_YN").val() == "Y")) {
					landingCLS.backOpenLayer(window.location.pathname.toLowerCase());
				} else if (window.location.pathname.toLowerCase() == "/app/inquiry/write.asp") {
					my1to1CLS.cancelWrite();
				} else if (window.location.pathname.toLowerCase().includes("/app/event/luckydraw0708/") && (TRK_GLB_USER_ID == "-1" || $("#luckydraw_event_Target_YN").val() != "X") && todayDate.toLocaleDateString("en-us") < "8/1/2025") {
					landingCLS.backOpenLayer(window.location.pathname.toLowerCase());
				} else if (window.location.pathname.toLowerCase().includes("/app/event/luckydraw_s25/") && (TRK_GLB_USER_ID == "-1" || (jQuery("#event_Target_YN").val() != "N" && jQuery("#event_Entry_YN").val() != "Y")) && todayDate.toLocaleDateString("en-us") < "11/24/2025") {
					landingCLS.backOpenLayer(window.location.pathname.toLowerCase());
				} else if (window.location.pathname.toLowerCase().includes("/app/event/learning25event/") && (TRK_GLB_USER_ID == "-1" || jQuery("#event_Target_YN").val() != "N" )) {
					landingCLS.backOpenLayer(window.location.pathname.toLowerCase());
				} else if (window.location.pathname.toLowerCase().includes("/app/ad/")) {
					// 광고 게이트 페이지에서는 뒤로가기 동작을 막기위해서 이벤트 할당 X
				} else if (["/app/event/pretest/pre-test2026b.asp","/app/event/preachievementtest/preachievementtest2606.asp"].some(keyword => window.location.pathname.toLowerCase().includes(keyword))) {		// 로그인 랜딩
					if (TRK_GLB_PROMOTION_TARGET_CD > 0) {
						switch (Number(TRK_GLB_PROMOTION_TARGET_CD)) {
							case commonGLB.PROMOTION_TARGET.러닝_신규_사립_중:
							case commonGLB.PROMOTION_TARGET.러닝_초기무료_사립_중:
							case commonGLB.PROMOTION_TARGET.러닝_중기무료_사립_중:
							case commonGLB.PROMOTION_TARGET.러닝_장기무료_사립_중:
							case commonGLB.PROMOTION_TARGET.러닝_저가전유료_사립_중:
							case commonGLB.PROMOTION_TARGET.러닝_고가전유료이탈_사립_중:
							case commonGLB.PROMOTION_TARGET.러닝_고가전유료정상_사립_중:
							case commonGLB.PROMOTION_TARGET.러닝_만료예정_사립_중:
							case commonGLB.PROMOTION_TARGET.러닝_초장기무료_사립_중:
							case commonGLB.PROMOTION_TARGET.러닝_신규_사립_고:
							case commonGLB.PROMOTION_TARGET.러닝_초기무료_사립_고:
							case commonGLB.PROMOTION_TARGET.러닝_중기무료_사립_고:
							case commonGLB.PROMOTION_TARGET.러닝_장기무료_사립_고:
							case commonGLB.PROMOTION_TARGET.러닝_저가전유료_사립_고:
							case commonGLB.PROMOTION_TARGET.러닝_고가전유료이탈_사립_고:
							case commonGLB.PROMOTION_TARGET.러닝_고가전유료정상_사립_고:
							case commonGLB.PROMOTION_TARGET.러닝_만료예정_사립_고:
							case commonGLB.PROMOTION_TARGET.러닝_초장기무료_사립_고:
								hijackingCLS.getPopupView();
								break;
							default:
								appCLS.webviewClose();
								break;
						}
					} else {
						appCLS.webviewClose();
					}
				} else if (window.location.pathname.toLowerCase().includes("/app/segment")) {
					segmentCLS.backOpenLayer();
				} else if (window.location.pathname.toLowerCase().includes("/app/event/hitratiorn")) {
					hitRatioRnCLS.back();
				} else {
					appCLS.webviewClose();
				}
				break;
			case appCLS.HEADER_ICONS.등록:
				communityWriteCLS.writeContent();
				break;
			case appCLS.HEADER_ICONS.검색: 
				appCLS.goWebViewLink('Z톡','/community/search.asp');
				break;
			case appCLS.HEADER_ICONS.결제: 
				 trkCLS.setExternalEvent("MVMAATDN4WGX7RDTTMMCWHNFD20250613", "");

				appCLS.goToBrowser('/payment/');
				break;
		}
	},
	checkMember : function (){
        let btn = document.createElement("button");
        $(btn).attr("type", "button");
        $(btn).attr("data-url", "#bottomSheetLayer");
        $(btn).attr("class","footer__primary");
        $(btn).attr("onclick","commonGLB.changeMemberInfo(this);");
        $(btn).text("확인");

        modalCLS.popupOpen();
        modalCLS.setBodyContent("해당 서비스는 족보닷컴 정회원만 이용 가능합니다!");
        modalCLS.setFooter(btn);
		return false;
	},
    changeMemberInfo : function (item) {
		appCLS.goWebViewLink('회원가입', TRK_SIGN_SITE_HOST+'/account/default.asp')
        modalClose(item);
    },
	reload : function () {
		if (window.location.pathname.toLowerCase().indexOf("/community/") > -1) {  //커뮤니티
			communityCLS.reload();
		} else if (window.location.pathname.toLowerCase().indexOf("/app/inquiry/") > -1) { //1대1문의
			my1to1CLS.reload();
		} else {
			location.reload();
		}
	},
	getIsForceLogout : function () {//앱 강제종료 처리 여부
        const url = new URL(location.href);
        return isValueEmpty(url.searchParams.get('forceLogout')) ? "N" : url.searchParams.get('forceLogout').toUpperCase();
    },
	isKaKaoInApp : function () {
		return /KAKAOTALK/i.test(navigator.userAgent);
	},
	showLoading : function () {
		$(".list-loader").addClass("is-active");
    },
    hideLoading : function () {
		$(".list-loader").removeClass("is-active");
    },
	setNoTodayShowPopupForID : function(id) {
        commonGLB.setCookie(id, id, 1);
    },
	setUploadStatus : function (jsonString) {

		jsonString = JSON.parse(jsonString.replace('"{', '{').replace('}"', '}').replace("'{", '{').replace("}'", '}').replace(/\n/g, '\\n').replace(/\r/g, '\\r'));
		// THUMBNAIL_READY : 영상 썸네일 생성 완료
		// COMPRESS_START : 영상 압축 시작
		// COMPRESS_PROGRESS : 영상 압축 진행률 전달
		// COMPRESS_COMPLETE : 영상 압축 완료
		// UPLOAD_START : 서버 업로드 시작
		// UPLOAD_PROGRESS : 업로드 진행률 전달
		// UPLOAD_COMPLETE : 업로드 완료
		// ERROR : 압축 또는 업로드 중 오류 발생
		// CANCELLED : 사용자 취소 또는 작업 취소 완료

		communityCLS.setVideoUploadProc(jsonString);
	},
	setLastPage : function(num, event_cd, trkCD) {
		jQuery.ajax({
            type : "POST",
            dataType:'json',
            url: '/app/ajax/setLastPageAjax.asp',	
            data: {
                last_page_gb : num,
				EVENT_CD : event_cd,
				deviceType : isValueEmpty(TRK_GLB_APP_VERSION) ? "M" : "A"
            },
            success: function(responseJson) {
            } ,error: function(request, exception) {
                return false;
            }
        });
		
		if (isValueEmpty(appCLS.getOS())) {
			if (isValueEmpty(trkCD) == false) {
				trkCLS.setExternalEvent(trkCD, "");
			}		
			
			location.href = "/payment/";
		}
	},
	goPaymentTrk : function (trkCD, url) {
		trkCLS.setExternalEvent(trkCD, null);
		appCLS.goToBrowser(url);
	}
};

// NAS -> S3 이미지 경로 치환
function replaceNasPathWithS3(originPath) {	
	let convertPath = originPath;

	convertPath = convertPath.replace("www.zocbo.com/File", "simgs.zocbo.com/file");
	convertPath = convertPath.replace("m.zocbo.com/File", "simgs.zocbo.com/file");
	convertPath = convertPath.replace("sign.zocbo.com/File", "simgs.zocbo.com/file");
	convertPath = convertPath.replace("admin.zocbo.com/File", "simgs.zocbo.com/file");
	convertPath = convertPath.replace("mgmt.zocbo.com/File", "simgs.zocbo.com/file");

	return convertPath;
}