// commom_popup.asp 에서 공통으로 사용

/* 회원정보 수정 관련 함수 */
var MemberInfoPopupCtrl = function() {
    var g_arr_siteid = "";
    var g_arr_grade = "";
    var g_arr_scl_id = "";
    var g_arr_school_nm = "";
    var g_arr_ms_no = "";
	var g_mem_group = "";
    
    var _validator_message = {
		school_name : "학교를 선택해 주세요.",
		deny_school_name : "학교명을 정확히 입력해주세요.",
        grade : "학년을 선택해 주세요.",
        t_region : "지역을 선택해 주세요.",
        t_jobs : "직종을 선택해 주세요.",
        t_course : "과목을 선택해 주세요.",        
        input : "입력이 잘못 되었습니다.",
        close_msg : "정보를 변경하지 않으시겠습니까?",
        p_close_msg : "자녀정보를 변경하지 않으시겠습니까?"
	};

    var _denySchoolItems = "|초|초등|초등학|초등학교|중|중등|중학|중학교|고|고등|고등학|고등학교|";

    var g_teacherAreaItems = [
		{"Name":"지역", "Value":""},
		{"Name":"강원", "Value":"248"},
		{"Name":"경기", "Value":"249"},
		{"Name":"경남", "Value":"250"},
		{"Name":"경북", "Value":"251"},
		{"Name":"광주", "Value":"252"},
		{"Name":"대구", "Value":"253"},
		{"Name":"대전", "Value":"254"},
		{"Name":"부산", "Value":"255"},
		{"Name":"서울", "Value":"256"},
		{"Name":"세종", "Value":"265"},
		{"Name":"울산", "Value":"257"},
		{"Name":"인천", "Value":"258"},
		{"Name":"전남", "Value":"259"},
		{"Name":"전북", "Value":"260"},
		{"Name":"제주", "Value":"261"},
		{"Name":"충남", "Value":"262"},
		{"Name":"충북", "Value":"269"},
		{"Name":"기타", "Value":"264"}
	];

	var g_teacherKindItems = [
		{"Name":"직종", "Value":""},
		{"Name":"학교선생님", "Value":"학교선생님"},
		{"Name":"입시/보습학원", "Value":"입시/보습학원"},
		{"Name":"단과학원", "Value":"단과학원"},
		{"Name":"외국어/어학원", "Value":"외국어/어학원"},
		{"Name":"공부방", "Value":"공부방"},
		{"Name":"교습소", "Value":"교습소"},
		{"Name":"개인과외", "Value":"개인과외"}
	];

	var g_teacherSubjectItems = [
		{"Name":"과목", "Value":""},
		{"Name":"전과목", "Value":"AL"},
		{"Name":"국어", "Value":"KR"},
		{"Name":"영어", "Value":"EG"},
		{"Name":"수학", "Value":"MT"},
		{"Name":"과학", "Value":"SC"},
		{"Name":"사회/역사", "Value":"HI"},
		{"Name":"기타", "Value":"ET"}
	];

	/* parameter 체크 */
	var _isUndefined = function(obj) {
		return typeof(obj) != "undefined" ? true : false;
	}

    /* 이벤트 설정 */
    var _member_info_popup_event_init = function() {        
        // 학부모 > 자녀 선택
        $(".chldTablist > li").off().on("click", function(e) {
			var idx = $(this).index();
            
            l_param = {"siteid":"" + g_arr_siteid[idx] + "", "ms_no":"" + g_arr_ms_no[idx] + "", "scl_id":"" + g_arr_scl_id[idx] + "", "school_nm":"" + g_arr_school_nm[idx] + "", "grade":"" + g_arr_grade[idx].toString() + ""}

            $(this).parent().find("li").removeClass("on").parent().find("li").eq(idx).addClass("on");
            _set_school_info(l_param);
		});

        // 교강사 > 지역 선택
        $(".cls_region > li > button").off().on("click", function(e) {
            $(".cls_region > li > button").removeClass("on").parent().find(this).addClass("on");            
		});

        // 교강사 > 직종 선택
        $(".cls_jobs > li > button").off().on("click", function(e) {
            $(".cls_jobs > li > button").removeClass("on").parent().find(this).addClass("on");            
		});

        // 교강사 > 과목 선택
        $(".cls_course > li > button").off().on("click", function(e) {
            $(".cls_course > li > button").removeClass("on").parent().find(this).addClass("on");            
		});

        // 학생회원팝업닫기
        $(".closepop, .pop7btn").off().on("click", function(e) {
            e.preventDefault();            
        
            if(confirm( (g_mem_group == "P") ? _validator_message.p_close_msg : _validator_message.close_msg  )) {                
                $('.memberPopC, .mbpdim').hide();

                _set_pop_close_log( $(this).data("day") );
            }
        });

        // 7일간 닫기
        $("#chkBot").off().on("click", function(e) {            
            _layer_pop_close("SP");
            _set_pop_close_log( $(this).data("day") );
        });

        // 학교검색팝업열기
        $(".sbsch > a").off().on("click", function(e) {            
            _school_search();
        });

        // 학교검색팝업닫기
        $(".icoPopClose").off().on("click", function(e) {
            $('.schPopComdim').hide();
        });

        // 학년 및 교강사 정보 저장
        $(".mem_chg_layer_save_btn").off().on("click", function(e) {
            if (_validation( $(this).data("group")) ) {
                _member_info_save( $(this).data("group") );
            }            
        });        
    }

    /* validation check */
    var _validation = function(mem_group) {
        if (mem_group == "T") {
            if ( $(".cls_region > li > button.on").length == 0 ) {
                alert( _validator_message.t_region );
            } else if ( $(".cls_jobs > li > button.on").length == 0 ) {
                alert( _validator_message.t_jobs );
            } else if ( $(".cls_course > li > button.on").length == 0 ) {
                alert( _validator_message.t_course );
            } else {
                return true;
            }            
        } else {
            if ( $("#mem_chg_layer_school_nm").data("scl_id") == 0 ) {
                alert( _validator_message.school_name );
            } else if ( $("input[name='chkGrade']:checked").length == 0 ) {
                alert( _validator_message.grade );
            } else {
                return true;
            }
        }

        return false;
    }

    /* 창 닫기 로그 적재 */
    var _set_pop_close_log = function(day) {        
        try {
            var url_v = "/_api/common.api.asp";            

            var data_v = "cmd=MEMBER_CHANGE_POPUP_CLOSE_LOG&add_day="+day;
                        
            $.ajax({
                 url:url_v
                ,type:"post"
                ,data:data_v
                ,contentType: "application/x-www-form-urlencoded; charset=eur-kr"
                ,dataType:"json"					
                ,success:function(data) {                    
                }
                ,error: function(xhr,status, error) {                    
                }
            });
        } catch(e) {
            //alert( e.name + " : " + e.message );
        }
    }
    
    /* 회원정보 저장 */
    var _member_info_save = function(mem_group) {
        var l_param = "";
        var ms_no = "";        
        var scl_id = "";
        var grade = 0;
        var t_region = "";
        var t_jobs = "";
        var t_course = "";

        if (mem_group == "T") {
            // 교강사 저장
            t_region = $(".cls_region > li > button").filter(".on").data("region");
            t_jobs = $(".cls_jobs > li > button").filter(".on").data("jobs");
            t_jobs = encodeURI(encodeURIComponent(t_jobs));
            t_course = $(".cls_course > li > button").filter(".on").data("course");

        } else {
            // 학생, 학부모 저장            
            scl_id = $("#mem_chg_layer_school_nm").data("scl_id");
            ms_no = $("#mem_chg_layer_school_nm").data("ms_no");
            grade = $("input[name='chkGrade']:checked").val();
        }

        l_param = {"mem_group":"" + mem_group + "", "ms_no":"" + ms_no + "", "scl_id":"" + scl_id + "", "grade":"" + grade + "", "t_region":"" + t_region + "", "t_jobs":"" + t_jobs + "", "t_course":"" + t_course + ""}
        
        try {            
            var url_v = "/_api/common.api.asp";
            var data_v = "cmd=MEMBER_CHANGE_SAVE&param="+JSON.stringify(l_param);

            $.ajax({
                 url:url_v
                ,type:"post"
                ,data:data_v
                ,contentType: "application/x-www-form-urlencoded; charset=eur-kr"
                ,dataType:"json"                
                ,success:function(data) {
                    // 레이어창 닫고
                    _layer_pop_close(mem_group);                    
                }
                ,error: function(xhr,status, error) {                    
                }
            });
        } catch(e) {            
        }
    }

    /* 회원정보 팝업 레이어 창 hide */
    var _layer_pop_close = function(mem_group) {
        $('.mbpdim').hide();
        $("#mem_chg_layer_group_" + (mem_group == "T" ? "t" : "sp")).hide();
    }

    /* 회원정보 변경 팝업 관련 (팝업대상 확인) */
	var _member_info_popup_init = function(param) {        		
        var result = "";
        var l_type = _isUndefined(param.type) ? param.type : "";
        var l_expapr_no = _isUndefined(param.expapr_no) ? param.expapr_no : "";

        //$(".bottomdayArea").hide();
		if (l_type == "D") {
			$(".pop7btn").show();		// 파일 다운로드 시에만 노출
		} else {
            $(".pop7btn").hide();
		}

		// 단일 파일만 체크
		if (l_expapr_no.indexOf(",") == -1) {
			try {
				var url_v = "/_api/common.api.asp";
				var data_v = "cmd=MEMBER_CHANGE_POPUP_TARGET_CHK&type="+l_type+"&expapr_no="+l_expapr_no;

				$.ajax({
					 url:url_v
					,type:"post"
					,data:data_v
					,contentType: "application/x-www-form-urlencoded; charset=eur-kr"
					,dataType:"json"					
					,success:function(data) {
						result = data.result;

						if (result == "1") {
							_get_popup_member_info(param);
						}
					}
					,error: function(xhr,status, error) {             
					}
				});
			} catch(e) {				
			}
		}
    }

    /* 팝업 띄우기전 회원정보 확인 */
	var _get_popup_member_info = function(param) {
        try {            
            var i=0;
            var l_param="";
            var arr_siteid = new Array();
            var arr_grade = new Array();
            var arr_scl_id = new Array();
            var arr_school_nm = new Array();
            var arr_ms_no = new Array();
            var mem_group = "";
            var t_jobs = "";
            var t_course = "";
            var t_region = "";
            var url_v = "/_api/common.api.asp";
            var data_v = "cmd=POPUP_MEMBER_INFO";

            $.ajax({
                 url:url_v
                ,type:"post"
                ,data:data_v
                ,contentType: "application/x-www-form-urlencoded; charset=eur-kr"
                ,dataType:"json"
                ,success:function(data) {                    
                    if (data.result == "1") {                        
                        mem_group = data.list[0].mem_group;

                        if (mem_group == "T") {                            
                            t_jobs = data.list[0].mem_jobs;
                            t_course = data.list[0].mem_t_course;
                            t_region = data.list[0].mem_region;                            
                            l_param = {"type":"" + param.type + "", "name":"" + data.name + "", "mem_group":"" + mem_group + "", "jobs":"" + t_jobs + "", "course":"" + t_course + "", "region":"" + t_region + ""}
                        } else {
                            for (i = 0 ; i < data.list.length ; i++) {                                
                                arr_siteid.push(data.list[i].siteid);
                                arr_grade.push(data.list[i].grade);
                                arr_scl_id.push(data.list[i].scl_id);
                                arr_school_nm.push(data.list[i].scl_name);
                                arr_ms_no.push(data.list[i].ms_no);
                            }                            
                            
                            l_param = {"type":"" + param.type + "", "name":"" + data.name + "", "mem_group":"" + mem_group + "", "siteid":arr_siteid, "grade":arr_grade, "scl_id":arr_scl_id, "school_nm":arr_school_nm, "ms_no":arr_ms_no}
                        }
                        
                        _member_info_popup_show(l_param);
                    } else {                        
                    }
                }
                ,error: function(xhr,status, error) {                    
                }
            });
        } catch(e) {            
        }		
	}

    /* 회원정보 변경 Layer Show */
    var _member_info_popup_show = function(param) {
        var l_type = "";            // M:메인접속시, D:다운할때
        var l_mem_group = "";        
        var l_siteid = "";
        var l_grade = "";
        var l_scl_id = "";
        var l_school_nm = "";
        var l_ms_no = "";
        var l_jobs = "";
        var l_course = "";
        var l_region = "";
        var l_param = "";

        l_type = param.type;
        l_mem_group = param.mem_group;
		g_mem_group = l_mem_group;

        $("#mem_chg_layer_bg").show();
        $(".tdcoration").text(param.name + (l_mem_group == "T" ? " 선생님!" : " 회원님!") );
        $(".mem_chg_layer_save_btn").data("group", l_mem_group);
        
        if (l_mem_group == "T") {       // 교강사용
            l_jobs = param.jobs;
            l_course = param.course;
            l_region = param.region;

			trkCLS.setExternalEvent("3XNDIDLTOVZMLCLDTTZ8ITV7O20250402", "");
            
            $("#mem_chg_layer_group_t").show();
            _set_teacher_info(param);
        } else {    // 학생, 학부모용
            // 자녀 탭 선택 위해 global 저장
            g_arr_siteid = param.siteid;
            g_arr_grade = param.grade;
            g_arr_scl_id = param.scl_id;
            g_arr_school_nm = param.school_nm;
            g_arr_ms_no = param.ms_no

            // 기본 학년 선택
            l_siteid = g_arr_siteid[0];
            l_grade = g_arr_grade[0];
            l_scl_id = g_arr_scl_id[0];
            l_school_nm = g_arr_school_nm[0];
            l_ms_no = g_arr_ms_no[0];

			if(l_mem_group == "P") {
				trkCLS.setExternalEvent("3GEAVDSFMR1ZJRTGP9LOA7H7O20250402", "");
			} else {
				trkCLS.setExternalEvent("9Y49VWYCQ1Y3YXMQKLVCDEFKH20250402", "");
			}
            
            $("#mem_chg_layer_group_sp").show();

            // 학생/학부모 타이틀 구분
            $("#mem_chg_layer_title_" + (l_type == "D" ? "down_" : "") + l_mem_group.toLowerCase()).show();

			if(l_type == "D") {
				window.scrollTo(0, 0);
			}

            // 학생 및 자녀수에 따른 탭 유무            
            if (g_arr_siteid.length > 1) {
                $("#mem_chg_layer_child_" + g_arr_siteid.length.toString()).show();
            }
            
            // 학교명, 학년 선택
            l_param = {"siteid":"" + l_siteid + "", "ms_no":"" + l_ms_no + "", "scl_id":"" + l_scl_id + "", "school_nm":"" + l_school_nm + "", "grade":"" + l_grade.toString() + ""}
            _set_school_info(l_param);
        }
    }

    /* 학생, 학부모 자녀 > 학교명, 학년 선택 */
    var _set_school_info = function(param) {
        // 기본 학교, 학년 선택
        $("#mem_chg_layer_school_nm").data("scl_id", param.scl_id).data("ms_no", param.ms_no).text(param.school_nm);

        // 초, 중, 고 학년 영역 표시
        $(".cls_grade_area").hide();
        $(".mem_chg_layer_" + param.siteid.toLowerCase()).show();        
        $("#chkGrade" + param.siteid + param.grade).prop("checked", true);
    }

    /* 선생님 > 지역, 직종, 과목 선택 */
    var _set_teacher_info = function(param) {
        $(".cls_region > li > button").removeClass("on").parent().find("button[data-region='"+param.region+"']").addClass("on");
        $(".cls_jobs > li > button").removeClass("on").parent().find("button[data-jobs='"+param.jobs+"']").addClass("on");
        $(".cls_course > li > button").removeClass("on").parent().find("button[data-course='"+param.course+"']").addClass("on");
    }

    /* 학교검색창 */
    var _school_search = function() {
        // 검색 창 띄우고
        $('.schPopComdim').show();
        
        // 기본 초기화
        $("#keyword_school").val("");
		$("#area_school_list").hide();
    }

    /* 학교정보 검색 */    
	var _data_search = function() {
		var school_name = $.trim($("#keyword_school").val());
		
		if(school_name == "") {
			alert(_validator_message.school_name);
		} else if( _denySchoolItems.indexOf("|"+school_name+"|") != -1 || school_name.length == 1 ) {
			alert(_validator_message.deny_school_name);		
		} else {
			try {
				var url_v = "/_api/common.api.asp";
				var data_v = "cmd=SCHOOL_SEARCH&keyword="+encodeURI(encodeURIComponent(school_name));
		
				$.ajax({
					 url:url_v
					,type:"post"
					,data:data_v
					,contentType: "application/x-www-form-urlencoded; charset=eur-kr"
					,dataType:"json"					
					,success:function(data) {						
						_make_school_list(data);                        
					}
					,error: function(xhr,status, error){
						alert(_validator_message.input);
					}
				});
			} catch(e) {
				//alert( e.name + " : " + e.message );
			}
		}
	}

    /* 학교 리스트 */
	var _make_school_list = function(data) {
		var school_cnt = "(" + data.list.length +"건)"
		var htmlStr = "";
		var idx = 1;

		if (data.list.length == 0) {
			$("#area_school_list").hide();
			$("#area_school_nosch").show();
			$("#keyword_school").focus();
		} else {
			$("#list_school").html("");

			$(data.list).each(function() {				
				htmlStr = "<li>";
				htmlStr += "	<div class='schtableWrap'>";
				htmlStr += "		<div class='leftArea'>";
				htmlStr += "			<p class='txtTopA'>";				
                htmlStr += "				<a href='javascript:MemberInfoPopupCtrl.set_school({scl_id:\""+this.scl_id+"\",scl_name:\""+this.scl_name+"\",siteid:\""+this.siteid+"\"});'>" + this.scl_name + "</a>";
				htmlStr += "			</p>";
				htmlStr += "			<p class='txtbotA'>";				
                htmlStr += "				<a href='javascript:MemberInfoPopupCtrl.set_school({scl_id:\""+this.scl_id+"\",scl_name:\""+this.scl_name+"\",siteid:\""+this.siteid+"\"});'>" + this.scl_addr + "</a>";
				htmlStr += "			</p>";
				htmlStr += "		</div>";
				htmlStr += "	</div>";
				htmlStr += "</li>";
				
				$("#list_school").append(htmlStr);
			});
			
			$("#school_cnt").html(school_cnt);
			$("#area_school_list").show();
			$("#area_school_nosch").hide();
		}
	}

    /* enter 처리 */
	var _set_addr_info_enter = function() {
		var evt_code = (window.netscape) ? ev.which : event.keyCode;
		if (evt_code == 13) {
			event.keyCode = 0;

			_data_search();
			event.preventDefault();		// 요거 추가
		}
	}

    /* 학교 선택 */
	var _set_school = function(param) {        
        // 초, 중, 고 학년 영역 표시		
		$(".cls_grade_area input:radio[name='chkGrade']").prop("checked", false);
        $(".cls_grade_area").hide();
        $(".mem_chg_layer_" + param.siteid.toLowerCase()).show();
        
        // 학교명 표시
        $("#mem_chg_layer_school_nm").data("scl_id", param.scl_id).text(param.scl_name);
        $('.schPopComdim').hide();
	}    

	return {
		member_info_popup_init:function(param) {            
            _member_info_popup_event_init();
			_member_info_popup_init(param);
		},
		data_search:function() {
			_data_search();
		},
		set_addr_info_enter:function() {
			_set_addr_info_enter();
		},
		set_school:function(param) {
			_set_school(param);
		}
	};
}();