var baroTest = function() {

	var root = null;
	var _id = "baroTest";
	var param = null;
	var _pRoot = null;
	var _data = null;
	var _BT_No = 0;
	var _expapr_no = 0;
	var _isState = 0;
	var _baroState = null;
	var _Expapr_FileName = null;
	var _mulSelectCnt = 0;
	var _allCnt = 0;
	var zUserID = null;
	var tabIdx = 0;
	var noteList = null;
	var examEnd = "N";
	var proceedTime = 0;
	var userSelectCnt = 0;
	var limitTime = 5999;
	var INTERVAL_ID = null;
	var Token = null;
	var Start = false;
	var imgEnd = "N";
	var posScrollTop = 0;
	var boolAnswerSaved = false;
	var time_interval;

	var _init = function() {
		param = util.queryStringToJSON(null);
		root = document.querySelector("[data-id='" + _id + "']");

		_initData();

		_BT_No = _data.BT_No;
		_expapr_no = _data.expapr_no;
		_isState = _data.isState;

		_loadData();
		common.init();
		_initEvent();
		_hLog(JSON.stringify(_data));
	};

	var _initData = function() {
		$(root).find(".exam").css("display", "");
		$(root).find(".examFail").css("display", "none");
		$(root).find(".examResult").css("display", "none");
		$(root).find(".examResult .tabLine li").removeClass("active");
		$(root).find(".examResult .tabLine li[data-idx='0']").addClass("active");

		if(_data.checkType == "LT")
		{
			root.querySelector("#learning_div").style.display = "none";
			root.querySelector("#timer").style.display = "none";
			root.querySelector(".quizAnswerList-top").style.display = "none";			
		}

		_mulSelectCnt = 0;
		_allCnt = 0;
		examEnd = "N";
		proceedTime = 0;
		userSelectCnt = 0;
		Start = false;
		tabIdx = 0;
		_Expapr_FileName = null;
		noteList = null;
		INTERVAL_ID = null;
		Token = null;
		imgEnd = "N";
	}

	// 바로테스트 권한 및 시험지 상태 체크
	var _loadData = function(flag) {
		var url_v = "/_api/search.api.asp";
		var data_v;

		if(_data.checkType == "LT")
		{			
			data_v = "cmd=CONFIRM_BAROTEST&exPapr_No=" + _expapr_no + "&SiteID=" + _data.SiteID + "&Grade=" + _data.Grade + "&Subj_Code=" + _data.Subj_Code + "&checkType=LT";
		}
		else
		{
			data_v = "cmd=CONFIRM_BAROTEST&exPapr_No=" + _expapr_no + "&SiteID=" + _data.SiteID
                    + "&Grade=" + _data.Grade + "&Subj_Code=" + _data.Subj_Code;
		}

        comm.toggleLoading(true);
        comm.send(url_v, data_v, "post", function(json){
        	_hLog(json);			
            if(json){
                var data = json;

                _isState = data.isState;
                _baroState = data.baroState;

                // 시험지 없음
				if((_isState == 0) || (_data.isState == "0" && flag != "LT")){
                	// 바로테스트 권한 있는 경우
                	if(_baroState == "Y"){
                		_createExam();
                	}
                	// 권한 없는 경우
                	else{
                		common.toast("오답노트는 자료 다운로드 후 이용 가능합니다.");
	                    comm.toggleLoading(false);
	                    baroTest.hide();
	                    return;
                	}
                }
                // 시험지가 있고 채점 안한 경우
				else if(_isState == 1){
					$(root).find(".exam").css("display", "");
					$(root).find(".examFail").css("display", "none");
					$(root).find(".examResult").css("display", "none");
					_getExam();
				}
				// 채점결과 조회
				else if(_isState == 2){
					$(root).find(".exam").css("display", "none");
					$(root).find(".examFail").css("display", "none");
					$(root).find(".examResult").css("display", "");
					_getExamResult();
				}
				else{
					comm.toggleLoading(false);
				}
            }
            else{
            	comm.toggleLoading(false);
            }
        });
	};

	var _initEvent = function() {
		if(root) {
			var selector_str = "[data-src='" + _id + "'][data-act]";
			$(root).find(selector_str).unbind();
			$(root).find(selector_str).bind("click", function() {return false;});
			$(root).find(selector_str).bind("click", function(ev) {_click(ev);});
		}
		common.resetA();
	};

	var _click = function(ee) {
		var ev = window.event || ee;
		var evo = ev.currentTarget || ev.target;
		var act_v = evo.getAttribute("data-act");
		_hLog("act=" + act_v);
		// 시험지 정답 체크
		if(act_v == "checkNum"){
			var go = evo.parentElement.parentElement;
			var answerCnt = go.getAttribute("data-answerCnt");	

			// 단일 답일 경우
			if(answerCnt == 1){
				$(evo).parent().siblings('li').find('button').removeClass('active');
				$(evo).addClass('active');			
			}
			// 다중 답일 경우
			else{
				var active_lo = go.querySelectorAll("button.active");
				if(active_lo.length >= answerCnt){
					$(evo).parent().siblings('li').find('button').removeClass('active');
				}
				$(evo).addClass('active');
			}

			// 정답 체크한 개수 계산
			var mulCnt = 0;
			var dlList = root.querySelectorAll("dl[data-qNo]");

			for(var i = 0; i < dlList.length; i++){
				var dl_o = dlList[i];
				var qNo = dl_o.getAttribute("data-qNo");
				var active_lo = dl_o.querySelectorAll("button.active[data-qNo='" + qNo + "']");

				if(_data.checkType == "LT")
				{
					if(active_lo.length > 0) {
						for(var j = 0; j < active_lo.length; j++){
							var active_o = active_lo[j];
							var qValue = active_o.getAttribute("data-qValue");

							if(j > 0)
							{
								var pre_Val = document.getElementsByName('AnswerUser')[i].value;

								if(pre_Val < qValue)
								{
									qValue = pre_Val + "," + qValue;
								}
								else
								{
									qValue = qValue + "," + pre_Val;
								}
							}

							document.getElementsByName('AnswerUser')[i].value = qValue;
						}
					}
				}

				if(active_lo.length > 0){
					mulCnt++;
				}
			}

			SaveAnswer();

			var button_o = root.querySelector("#btnSubmit");
			// 정답을 모두 체크하면 답안제출 버튼 활성화
			if(mulCnt == _mulSelectCnt){
				$(button_o).removeClass("btn-light-gray");
				$(button_o).addClass("btn-blue");
				$(button_o).prop("disabled", false);
			}
			else{
				$(button_o).removeClass("btn-blue");
				$(button_o).addClass("btn-light-gray");
				$(button_o).prop("disabled", true);
			}

			userSelectCnt = mulCnt;
		}
		else if(act_v == "changeTab"){
			$(root).find(".examResult .tabLine li").removeClass("active");
			$(evo).addClass("active");

			var idx = evo.getAttribute("data-idx");
			if(idx){
				tabIdx = parseInt(idx);
			}
			_loadExamResult();
		}
		// 답안제출
		else if(act_v == "submit") {
			if(confirm("답안을 제출한 이후에는 수정하실 수 없습니다.\n제출하시겠습니까?")) {
				_sendExam();
			}
		}
		// 닫기
		else if(act_v == "close") {
			if(_data.checkType == "LT")
			{
				clearInterval(time_interval);
			}

			if(window.location.pathname.toLowerCase() == "/mypage/mylearningtest.asp")
			{
				parent.location.reload();
			}
			else
			{
				// OMR카드 영역과 채점결과, 틀린문제 영역 같이 사용하기 때문에 구분
				if(_baroState == "Y" && _isState == "2") {
					baroTest.hide();
				} else {
					/*
					if(confirm("입력한 내용이 저장되지 않습니다.\n작성을 취소하시겠습니까?")) {
						baroTest.hide();
						//alert("작성이 취소되었습니다.");
					}
					*/
					baroTest.hide();
				}				
			}
		}
	};

	function SaveAnswer()
	{
		if(boolAnswerSaved) 
		{
			var ans = document.getElementsByName("AnswerUser");		
			var aw = [];

			for(var i=0; i<ans.length; i++) 
			{
				aw.push(ans[i].value);
			}			
			
			
			var frm = document.SavedAns;
			frm.answer.value = aw.join("|");
			frm.exPapr_no.value = _data.expapr_no;
			frm.bt_no.value = _data.BT_No;			
			//frm.submit();
			
			jQuery.ajax({
				type: 'POST',
				url: '/Barotest/BaroTest_SavedAnswer.asp', // Replace with your server endpoint
				data: jQuery(document.SavedAns).serialize(), // Serialize the form data
				success: function(response) {
					// Handle the response from the server
					//console.log('Success:', response);
				},
				error: function(error) {
					// Handle any errors
					//console.error('Error:', error);
				}
			});
		}
	}

	// 시험지 생성
	var _createExam = function() {
		var checkType = "";
		var url_v = "/_api/search.api.asp"
		var data_v;

		if(_data.checkType == "LT")
		{
			data_v = "cmd=CHECK_BAROTEST&exPapr_No=" + _expapr_no + "&SiteID=" + _data.SiteID + "&Grade=" + _data.Grade + "&Subj_Code=" + _data.Subj_Code + "&checkType=LT" + "&BT_No=" + _data.BT_No;
		}
		else
		{	
			data_v = "cmd=CHECK_BAROTEST&exPapr_No=" + _expapr_no + "&SiteID=" + _data.SiteID + "&Grade=" + _data.Grade + "&Subj_Code=" + _data.Subj_Code + "&checkType=";
		}

		comm.toggleProcessLoading(0);
		comm.send(url_v, data_v, "post", function(json){
			comm.toggleLoading(false);

			_hLog("json:" + JSON.stringify(json));

			if(json){
				_BT_No = json.BT_No;
				_isState = json.isState;
				Token = json.Token;

				Start = false;
				// 0.5초마다 pdf 생성 진행상황 표시
				INTERVAL_ID = window.setInterval(function(){
					_progress(Token, function(){
						comm.toggleProcessLoading(-1);

						if(_data.checkType == "LT")
						{
							_loadData("LT");
						}
						else
						{
							//_loadData();
							$(root).find(".exam").css("display", "");
							$(root).find(".examFail").css("display", "none");
							$(root).find(".examResult").css("display", "none");

							setTimeout(function(){
								_getExam();
							}, 1000);
						}
					});
				}, 1500);
			}
			else{
				comm.toggleProcessLoading(-1);
			}
		});
	};	

	function test_time_save()
	{
		var BT_No = _data.BT_No;

		$j.ajax(
		{
			url: '/barotest/ajax/barotest_remaintime_u_ajax.asp',
			data: 
			{
				BT_No : BT_No,
				deduction_time : 5
			},
			error: function(request, status, error)
			{
				if(request.status == "0")
				{
					alert('인터넷 연결이 끊겼습니다.\n인터넷 연결 후 다시 시도해주세요.');
				}
				else
				{
					alert('code:' + request.status + '\n' + 'message:' + request.responseText + '\n' + 'error:' + error);
				}
			},
			success: function(data)
			{
			}
		});
	}

	// 시험지 조회
	var _getExam = function() {
		var url_v = "/_api/search.api.asp"
		var data_v;

		if(_data.checkType == "LT")
		{
			data_v = "cmd=GET_BAROTEST_QUESTION&BT_No=" + _BT_No + "&checkType=LT";
		}
		else
		{
			data_v = "cmd=GET_BAROTEST_QUESTION&BT_No=" + _BT_No;
		}

		comm.send(url_v, data_v, "post", function(json){
			_hLog("json:" + JSON.stringify(json));

			if(json){
				var list = json.list;

				if(list){
					_allCnt = list.length;					

					if(_data.checkType == "LT")
					{
						if(list.length == 0 || list.length < 20)
						{
							alert('문제를 생성 중이니 잠시 후 재시도 해주시기 바랍니다.');
							location.reload();
						}
						else
						{
							limitTime = list[0].remain_time;
						}
						
						var timer_area = root.querySelector(".time-limit");
						timer_area.className += " renewal-2024";

						root.querySelector("#learning_div").style.display = "";
						root.querySelector("#learning_title").innerHTML = _data.short_Title;
						root.querySelector(".quizAnswerList-top").style.display = "";
						root.querySelector("#timer").style.display = "";

						var quizNum_o = root.querySelector(".time-limit .quizNumAll .f_black");
						quizNum_o.innerHTML = _allCnt + "개";

						var contents_o = root.querySelector("#contents");
						var answerDiv_o = null;
						var row_o = null;	

						for(var i = 0; i < list.length; i++){
							var answerInfo = list[i];
							var qNo = i + 1;

							if(qNo % 5 == 1){
								answerDiv_o = document.createElement("div");
								answerDiv_o.className = "quizAnswerList rn2024-quizAnswerList";

								row_o = document.createElement("div");
								row_o.className = "row";
							}
							{
								var dl_o = document.createElement("dl");
								dl_o.setAttribute("data-qNo", qNo);

								if(qNo % 5 == 0){
									dl_o.style.borderBottom = "1px solid #EFC0C7";
								}

								{
									var dt_o = document.createElement("dt");
									dt_o.innerHTML = answerInfo.Q_Cnt;
									dl_o.appendChild(dt_o);
								}
								{
									var dd_o = document.createElement("dd");
									{
										var answerCnt;
										var answer = answerInfo.Answer;
										if(answer != null && answer != ""){
											answerCnt = answer.split(",").length;
										}
										else{
											answerCnt = 1;
										}

										var ul_o = document.createElement("ul");
										ul_o.setAttribute("data-answerCnt", answerCnt);

										var Type_ID = answerInfo.Type_ID;
										// 주관식
										if(Type_ID == "1"){
											var li_o = document.createElement("li");
											li_o.className = "question numberNo";
											{
												var p_o = document.createElement("p");
												p_o.innerHTML = "주관식문제";
												li_o.appendChild(p_o);
											}
											ul_o.appendChild(li_o);
										}
										// 객관식
										else if(Type_ID == "2"){
											for(var j = 0; j < 5; j++){
												var li_o = document.createElement("li");
												li_o.className = "question";
												{
													var button_o = document.createElement("button");
													button_o.type = "button";
													button_o.setAttribute("data-src", "baroTest");
													button_o.setAttribute("data-act", "checkNum");
													button_o.setAttribute("data-qNo", qNo);
													button_o.setAttribute("data-qValue", j + 1);
													button_o.innerHTML = j + 1;
													li_o.appendChild(button_o);
												}
												ul_o.appendChild(li_o);
											}

											_mulSelectCnt++;
										}

										dd_o.appendChild(ul_o);
									}
									dl_o.appendChild(dd_o);
								}
								row_o.appendChild(dl_o);

								var hiddenField = document.createElement("input");		

								hiddenField.setAttribute("type", "hidden");
								hiddenField.setAttribute("name", "Answer");
								hiddenField.setAttribute("id", "Answer");
								row_o.appendChild(hiddenField);

								var hiddenField2 = document.createElement("input");		

								hiddenField2.setAttribute("type", "hidden");
								hiddenField2.setAttribute("name", "AnswerUser");
								hiddenField2.setAttribute("id", "AnswerUser");
								row_o.appendChild(hiddenField2);
							}					

							if(qNo % 5 == 0 || (i + 1) == list.length){
								answerDiv_o.appendChild(row_o);
								contents_o.appendChild(answerDiv_o);
							}
						}

						// 임시 저장 답안 체크처리. 
						SavedAnswerCheck();
					}
					else
					{
						var quizNum_o = root.querySelector(".time-limit .quizNumAll .f_black");
						quizNum_o.innerHTML = _allCnt + "개";

						var contents_o = root.querySelector("#contents");
						var answerDiv_o = null;
						var row_o = null;
						//$(contents_o).empty();		// 중복 노출 지속 발생하면 empty() 처리
						for(var i = 0; i < list.length; i++){
							var answerInfo = list[i];
							var qNo = i + 1;

							if(qNo % 5 == 1){
								answerDiv_o = document.createElement("div");
								answerDiv_o.className = "quizAnswerList";

								row_o = document.createElement("div");
								row_o.className = "row";
							}
							{
								var dl_o = document.createElement("dl");
								dl_o.setAttribute("data-qNo", qNo);
								{
									var dt_o = document.createElement("dt");
									dt_o.innerHTML = answerInfo.Q_Cnt;
									dl_o.appendChild(dt_o);
								}
								{
									var dd_o = document.createElement("dd");
									{
										var answerCnt;
										var answer = answerInfo.Answer;
										if(answer != null && answer != ""){
											answerCnt = answer.split(",").length;
										}
										else{
											answerCnt = 1;
										}

										var ul_o = document.createElement("ul");
										ul_o.setAttribute("data-answerCnt", answerCnt);

										var Type_ID = answerInfo.Type_ID;
										// 주관식
										if(Type_ID == "1"){
											var li_o = document.createElement("li");
											li_o.className = "question numberNo";
											{
												var p_o = document.createElement("p");
												p_o.innerHTML = "주관식문제";
												li_o.appendChild(p_o);
											}
											ul_o.appendChild(li_o);
										}
										// 객관식
										else if(Type_ID == "2"){
											for(var j = 0; j < 5; j++){
												var li_o = document.createElement("li");
												li_o.className = "question";
												{
													var button_o = document.createElement("button");
													button_o.type = "button";
													button_o.setAttribute("data-src", "baroTest");
													button_o.setAttribute("data-act", "checkNum");
													button_o.setAttribute("data-qNo", qNo);
													button_o.setAttribute("data-qValue", j + 1);
													button_o.innerHTML = j + 1;
													li_o.appendChild(button_o);
												}
												ul_o.appendChild(li_o);
											}

											_mulSelectCnt++;
										}

										dd_o.appendChild(ul_o);
									}
									dl_o.appendChild(dd_o);
								}
								row_o.appendChild(dl_o);
							}

							if(qNo % 5 == 0 || (i + 1) == list.length){
								answerDiv_o.appendChild(row_o);
								contents_o.appendChild(answerDiv_o);
							}
						}
					}
					
				}
			}

			// 제한시간 세팅
			_timer(limitTime, 0);

			common.init();
			_initEvent();
			comm.toggleLoading(false);
		});
	};

	// 채점결과 조회
	var _getExamResult = function() {
		var url_v = "/_api/search.api.asp";
		var data_v = "cmd=IS_BAROTEST_RESULT&ExPapr_No_Set=" + _expapr_no;
		comm.send(url_v, data_v, "post", function(json){
			if(json){
				_hLog(json);
				if(json.list){
					noteList = json.list[0];

					// 미리보기 중간(기말)고사 여부 체크해서 해당되면 별도 결과페이지로 이동
					if(noteList.BTS_FLAG.toUpperCase() == "VIRTUALEXAM") {
						var data2 = _data;	// 채점결과 넘길 데이타

						// 1) 바로테스트 영역 숨기고
						baroTest.hide();

						// 2) 채점결과 보여주고
						virtual_exams.getExamResult(data2);

						// 3) 임시변수는 초기화
						data2 = null;
					} else {
						_loadExamResult();
					}
				}
			}
			common.init();
			_initEvent();
			comm.toggleLoading(false);
		});
	};

	// 채점결과 그리기
	var _loadExamResult = function() {
		var quizBlock_o = root.querySelector(".quiz");
		quizBlock_o.innerHTML = "";

		var srcPreFix = "";
		// 채점결과
		if (tabIdx == 0) {
			srcPreFix += "/Result/JPG/";
			_drawExamResult(quizBlock_o, srcPreFix, noteList.ExamMark, noteList.EM_Page);
		}
		// 틀린문제
		else if(tabIdx == 1) {
			srcPreFix += "/WrongAnswer/JPG/";
			_drawExamResult(quizBlock_o, srcPreFix, noteList.ExamNote, noteList.EN_Page);
		}
	};

	// 이미지 url주소 생성
	var _drawExamResult = function(block, prefix, examImg, page){
		for(var i = 0; i < page; i++){
			var img_o = document.createElement("img");
            //img_o.src = config.IMAGE_URL_BAROTEST + zUserID + prefix + examImg + i + ".jpg";
            img_o.src = config.TMS_IMAGE_URL_BAROTEST + "file_path_name=FileData/ZOCBOv6/File/BaroTest/" + zUserID + prefix + "&file_name="+ examImg + i + ".jpg";
			block.appendChild(img_o);
		}
	};

	// 제한시간 처리
	var _timer = function(var_sec, sProceedTime) {
		proceedTime = sProceedTime;

		// 제한시간 종료
		if (var_sec - sProceedTime == 0)
		{
			if(_data.checkType == "LT")
			{
				root.querySelector(".quizAnswerList-top").style.display = "none";
				clearInterval(time_interval);
				alert('제한시간이 종료되었습니다.\n\n시험지를 제출합니다.');
				SaveAnswer();

				var BT_No = 0;
				var Q_Type = 1;
				var dlList = root.querySelectorAll("dl[data-qNo]");
				var form_o = document.createElement("form");
				var answerList = new Array();
				var mulCnt = 0;
				var totCnt = 0;

				for(var i = 0; i < dlList.length; i++){
					var dl_o = dlList[i];
					var qNo = dl_o.getAttribute("data-qNo");
					var active_lo = dl_o.querySelectorAll("button.active[data-qNo='" + qNo + "']");
					if(active_lo.length > 0){

						var qList = new Array();
						for(var j = 0; j < active_lo.length; j++){
							var active_o = active_lo[j];
							var qValue = active_o.getAttribute("data-qValue");
							qList.push(qValue);
						}
						answerList.push(qList.join("|"));
						mulCnt++;
					}
					else{
						answerList.push(8);
					}
					totCnt++;
				}

				{
					var input_o = document.createElement("input");
					input_o.name = "proceedTime";
					input_o.value = proceedTime;
					form_o.appendChild(input_o);
				}
				{
					var input_o = document.createElement("input");
					input_o.name = "BT_No";
					input_o.value = _BT_No;
					form_o.appendChild(input_o);
				}
				{
					var input_o = document.createElement("input");
					input_o.name = "Q_Type"
					input_o.value = 1;
					form_o.appendChild(input_o);
				}
				{
					var input_o = document.createElement("input");
					input_o.name = "ExPapr_No";
					input_o.value = _expapr_no;
					form_o.appendChild(input_o);
				}
				{
					var input_o = document.createElement("input");
					input_o.name = "timeOver";
					input_o.value = "Y";
					form_o.appendChild(input_o);
				}
				{
					var input_o = document.createElement("input");
					input_o.name = "ExamCount";
					input_o.value = _allCnt;
					form_o.appendChild(input_o);
				}
				{
					var input_o = document.createElement("input");
					input_o.name = "AnswerUser";
					input_o.value = answerList.join(",");
					form_o.appendChild(input_o);
				}
				{
					var input_o = document.createElement("input");
					input_o.name = "isFirst";
					input_o.value = "Y";
					form_o.appendChild(input_o);
				}

				examEnd = "Y";

				// 답안 저장
				comm.toggleProcessLoading(0);
				var url_v = "/_api/search.api.asp"
				var data_v = "cmd=SAVE_BAROTEST_USER&" + $(form_o).serialize();

				comm.send(url_v, data_v, "post", function(json){
					if(json) {
						if(json.ResultCount == "0"){
							$(root).find(".exam").css("display", "none");
							$(root).find(".examFail").css("display", "none");
							$(root).find(".examResult").css("display", "none");

							var url_v = "/_api/search.api.asp";
							// 채점결과 pdf 생성 요청
							var data1_v = "cmd=CREATE_BAROTEST_PDF&BT_No=" + _BT_No + "&ExPapr_No=" + _expapr_no;
							$.ajax({
								url: url_v,
								data: data1_v,
								method: "post",
								dataType: "json",
								asynchronous: false,
								complete: function(result){
									if(result.status == 200){
										Token = result.responseJSON.Token;
										Start = false;
										// 0.5초마다 pdf 생성 진행상황 표시
										INTERVAL_ID = window.setInterval(function(){
											_progress(Token, function(){
												comm.toggleProcessLoading(0);

												// 채점결과 pdf 생성 완료 후 틀린문제 pdf 생성 요청
												var data2_v = "cmd=CREATE_BAROTEST_PDF&BT_No=" + _BT_No + "&ExPapr_No=" + _expapr_no + "&isNote=1";
												
												$.ajax({
													url: url_v,
													data: data2_v,
													method: "post",
													dataType: "json",
													asynchronous: false,
													complete: function(result){
														if(result.status == 200){
															Token = result.responseJSON.Token;
															Start = false;
															// 0.5초마다 pdf 생성 진행상황 표시
															INTERVAL_ID = window.setInterval(function(){
																_progress(Token, function(){
																	comm.toggleProcessLoading(-1);

																	$(root).find(".exam").css("display", "none");
																	$(root).find(".examFail").css("display", "none");
																	$(root).find(".examResult").css("display", "none");

																	if(_data.lt_Chk_Val == "1")
																	{
																		$('[data-no="' + _expapr_no + '"]').find(".renewal2024-dwn-sbj").parents("span").addClass("nodown disabled");
																		$('[data-btno="' + _expapr_no + '"]').find(".renewal2024-dwn-sbj").parents("span").addClass("nodown disabled");
																		$('[data-btno="' + _expapr_no + '"]').find(".renewal2024-dwn-sbj").text("테스트");
																	}
																	else
																	{
																		$('[data-btno="' + _expapr_no + '"]').find(".renewal2024-dwn-sbj").parents("span").addClass("reconfirm");
																		$('[data-btno="' + _expapr_no + '"]').find(".renewal2024-dwn-sbj").text("재응시");
																	}

																	setTimeout(function(){
																		if(window.location.pathname.toLowerCase() == "/mypage/mylearningtest.asp")
																		{																			
																			parent.location.reload();
																		}

																		location.href = '/Barotest/LearningTestAnalysis.asp?BT_No=' + _data.BT_No;
																		
																		if(window.location.pathname.toLowerCase() != "/mypage/mylearningtest.asp")
																		{
																			common.init();
																			baroTest.hide();
																		}
																	}, 1000);
																});
															}, 500);
														}
														else{
															comm.toggleProcessLoading(-1);
														}
													}
												});
											});
										}, 500);
									}
									else{
										comm.toggleProcessLoading(-1);
									}
								}
							});
						}
						else{
							comm.toggleProcessLoading(-1);
						}

						$(root).find("#contents .quizAnswerList").remove();
					}
				});
			}
			else
			{
				$(root).find(".exam").css("display", "none");
				$(root).find(".examFail").css("display", "");
				$(root).find(".examResult").css("display", "none");

				var html = "<b>" + userSelectCnt + "</b>/" + _allCnt
				$(root).find("#solveNum").html(html);

				$(root).find("#contents .quizAnswerList").remove();
				return;
			}
		}

		var tmp_min = parseInt(((var_sec - sProceedTime) % 6000) / 60);		//분
		var tmp_sec = (((var_sec - sProceedTime) % 3600) % 60);				//초

		if(tmp_min.toString().length != 2)
		{
			tmp_min = '0' + tmp_min.toString();
		}

		if(tmp_sec.toString().length != 2)
		{
			tmp_sec = '0' + tmp_sec.toString();
		}

		$(root).find('#timer').text(tmp_min + ':' + tmp_sec);

		if(examEnd == "N"){
			// 1초마다 제한시간 처리
			setTimeout( function(){
						_timer( var_sec, (sProceedTime + 1))
						}, 1000); // 재귀호출
		}
		else{
			$(root).find('#endTimer').text(tmp_min + ':' + tmp_sec);
		}		
	};

	function SavedAnswerCheck()
	{
		var url_v = "/_api/search.api.asp"
		var data_v = "cmd=GET_USER_ANSWER&exPapr_No=" + _expapr_no + "&BT_No=" + _data.BT_No + "&checkType=LT";

		time_interval = setInterval(test_time_save, 5000);

		comm.send(url_v, data_v, "post", function(json){
			comm.toggleLoading(false);

			if(json)
			{
				var data = json.TUAD;
				var sac = data.split('|');	
				var dlList = root.querySelectorAll("dl[data-qNo]");

				if(sac.length > 0) {
					for(var i = 0; i < sac.length; i++){
						var dl_o = dlList[i];
						var qNo = dl_o.getAttribute("data-qNo");
						var active_lo = dl_o.querySelectorAll("button");
		
						if(sac[i] != "")
						{	
							if(sac[i].length > 2) 
							{								
								for(var j = 0; j < active_lo.length; j ++)
								{
									for(var t = 0; t < sac[i].split(",").length; t++)
									{
										if(active_lo[j].getAttribute("data-qvalue") == sac[i].split(",")[t])
										{
											active_lo[j].className = "active";
										}
									}
								}
							}
							else
							{
								for(var j = 0; j < active_lo.length; j ++)
								{
									if(active_lo[j].getAttribute("data-qvalue") == sac[i])
									{
										active_lo[j].className = "active";
									}
								}
							}
						}
					}
				}

				boolAnswerSaved = true;
			}
		});

		//common.init();
	}

	// 답안 전송
	var _sendExam = function() {
		root.querySelector(".quizAnswerList-top").style.display = "none";

		if(_data.checkType == "LT")
		{
			clearInterval(time_interval);
		}

		var BT_No = 0;
		var Q_Type = 1;

		var dlList = root.querySelectorAll("dl[data-qNo]");
		var form_o = document.createElement("form");
		var answerList = new Array();
		var mulCnt = 0;
		var totCnt = 0;
		for(var i = 0; i < dlList.length; i++){
			var dl_o = dlList[i];
			var qNo = dl_o.getAttribute("data-qNo");
			var active_lo = dl_o.querySelectorAll("button.active[data-qNo='" + qNo + "']");
			if(active_lo.length > 0){

				var qList = new Array();
				for(var j = 0; j < active_lo.length; j++){
					var active_o = active_lo[j];
					var qValue = active_o.getAttribute("data-qValue");
					qList.push(qValue);
				}
				answerList.push(qList.join("|"));
				mulCnt++;
			}
			else{
				answerList.push(9);
			}
			totCnt++;
		}

		if(_mulSelectCnt != mulCnt){
			return;
		}

		if(_allCnt != totCnt){
			return;
		}

		{
			var input_o = document.createElement("input");
			input_o.name = "proceedTime";
			input_o.value = proceedTime;
			form_o.appendChild(input_o);
		}
		{
			var input_o = document.createElement("input");
			input_o.name = "BT_No";
			input_o.value = _BT_No;
			form_o.appendChild(input_o);
		}
		{
			var input_o = document.createElement("input");
			input_o.name = "Q_Type"
			input_o.value = 1;
			form_o.appendChild(input_o);
		}
		{
			var input_o = document.createElement("input");
			input_o.name = "ExPapr_No";
			input_o.value = _expapr_no;
			form_o.appendChild(input_o);
		}
		{
			var input_o = document.createElement("input");
			input_o.name = "timeOver";
			input_o.value = "N";
			form_o.appendChild(input_o);
		}
		/*{
			var input_o = document.createElement("input");
			input_o.name = "ExPapr_No";
			input_o.value = _expapr_no;
			form_o.appendChild(input_o);
		}
		*/
		{
			var input_o = document.createElement("input");
			input_o.name = "ExamCount";
			input_o.value = _allCnt;
			form_o.appendChild(input_o);
		}
		{
			var input_o = document.createElement("input");
			input_o.name = "AnswerUser";
			input_o.value = answerList.join(",");
			form_o.appendChild(input_o);
		}
		{
			var input_o = document.createElement("input");
			input_o.name = "isFirst";
			input_o.value = "Y";
			form_o.appendChild(input_o);
		}

		/* 미리보는 중간고사 로그 적재 용 :  S */
		if(_data.BTS_FLAG.toUpperCase() == "VIRTUALEXAM") {
			{
				var input_o = document.createElement("input");
				input_o.name = "range";
				input_o.value = _data.range;
				form_o.appendChild(input_o);
			}
			{
				var input_o = document.createElement("input");
				input_o.name = "pubname";
				input_o.value = _data.pubname;
				form_o.appendChild(input_o);
			}
			{
				var input_o = document.createElement("input");
				input_o.name = "level";
				input_o.value = _data.level;
				form_o.appendChild(input_o);
			}
			{
				var input_o = document.createElement("input");
				input_o.name = "bts_flag";
				input_o.value = _data.BTS_FLAG;
				form_o.appendChild(input_o);
			}
			{
				var input_o = document.createElement("input");
				input_o.name = "subj_code";
				input_o.value = _data.Subj_Code;
				form_o.appendChild(input_o);
			}
		}
		/* 미리보는 중간고사 로그 적재 용 :  E */

		examEnd = "Y";

		// 답안 저장
		comm.toggleProcessLoading(0);
		var url_v = "/_api/search.api.asp"
		var data_v = "cmd=SAVE_BAROTEST_USER&" + $(form_o).serialize();
		comm.send(url_v, data_v, "post", function(json){
			if(json) {
				/*
					미리보는 중간(기말)고사의 경우 필요 레이어를 띄우기 위해
					json.iscoupon, json.isevent
				*/
				if(json.ResultCount == "0"){
					// 미리보기 중간(기말)고사일 경우는 상단 영역 달리 (채점/유사 문제 탭 숨김)
					if(_data.BTS_FLAG.toUpperCase() == "VIRTUALEXAM") {
						$(root).find(".exam").css("display", "");
						$(root).find(".examFail").css("display", "none");
						$(root).find(".examResult").css("display", "none");
					} else {
						$(root).find(".exam").css("display", "none");
						$(root).find(".examFail").css("display", "none");
						$(root).find(".examResult").css("display", "");
					}

					if(_data.checkType == "LT")
					{
						$(root).find(".exam").css("display", "none");
						$(root).find(".examFail").css("display", "none");
						$(root).find(".examResult").css("display", "none");
					}

 					// 채점결과 pdf 생성 요청
 					var data1_v = "cmd=CREATE_BAROTEST_PDF&BT_No=" + _BT_No + "&ExPapr_No=" + _expapr_no;
					$.ajax({
						url: url_v,
						data: data1_v,
						method: "post",
						dataType: "json",
						asynchronous: false,
						complete: function(result){
							if(result.status == 200){
								Token = result.responseJSON.Token;
								Start = false;
								// 0.5초마다 pdf 생성 진행상황 표시
								INTERVAL_ID = window.setInterval(function(){
									_progress(Token, function(){
										comm.toggleProcessLoading(0);

										// 채점결과 pdf 생성 완료 후 틀린문제 pdf 생성 요청
										var data2_v = "cmd=CREATE_BAROTEST_PDF&BT_No=" + _BT_No + "&ExPapr_No=" + _expapr_no + "&isNote=1";
										$.ajax({
											url: url_v,
											data: data2_v,
											method: "post",
											dataType: "json",
											asynchronous: false,
											complete: function(result){

												if(result.status == 200){
													Token = result.responseJSON.Token;
													Start = false;
													// 0.5초마다 pdf 생성 진행상황 표시
													INTERVAL_ID = window.setInterval(function(){
														_progress(Token, function(){
															comm.toggleProcessLoading(-1);

															// 미리보기 중간(기말)고사일 경우는 상단 영역 달리 (채점/유사 문제 탭 숨김)
															if(_data.BTS_FLAG.toUpperCase() == "VIRTUALEXAM") {
																$(root).find(".exam").css("display", "");
																$(root).find(".examFail").css("display", "none");
																$(root).find(".examResult").css("display", "none");

																// 1) 알럿 띄우고
																alert("답안이 제출되었습니다. 결과분석, 해설받기를\n확인하세요.");

																// 2) 바로테스트 영역 숨기고
																baroTest.hide();

																// 3) 이벤트 관련 레이어 보여줌
																virtual_exams.setEventLayer(json.iscoupon, json.isevent);

																// 4) 버튼 렌더링
																virtual_exams.item_down_click();
															} else {
																$(root).find(".exam").css("display", "none");
																$(root).find(".examFail").css("display", "none");
																$(root).find(".examResult").css("display", "");

																if(_data.checkType == "LT")
																{
																	$(root).find(".examResult").css("display", "none");

																	if(_data.lt_Chk_Val == "1")
																	{
																		$('[data-no="' + _expapr_no + '"]').find(".renewal2024-dwn-sbj").parents("span").addClass("nodown disabled");
																		$('[data-btno="' + _expapr_no + '"]').find(".renewal2024-dwn-sbj").parents("span").addClass("nodown disabled");
																		$('[data-btno="' + _expapr_no + '"]').find(".renewal2024-dwn-sbj").text("테스트");
																	}
																	else
																	{
																		$('[data-btno="' + _expapr_no + '"]').find(".renewal2024-dwn-sbj").parents("span").addClass("reconfirm");
																		$('[data-btno="' + _expapr_no + '"]').find(".renewal2024-dwn-sbj").text("재응시");
																	}

																	setTimeout(function(){
//																		if(window.location.pathname.toLowerCase() == "/mypage/mylearningtest.asp")
//																		{
//																			parent.location.reload();
//																		}
																		
																		//window.open('/Barotest/LearningTestAnalysis.asp?BT_No=' + _data.BT_No);	
																		location.href = '/Barotest/LearningTestAnalysis.asp?BT_No=' + _data.BT_No;
																		
																		if(window.location.pathname.toLowerCase() != "/mypage/mylearningtest.asp")
																		{
																			common.init();
																			baroTest.hide();
																		}

																		if(window.location.pathname.toLowerCase() == "/mypage/mylearningtest.asp")
																		{
																			//parent.location.reload();
																			common.init();
																			baroTest.hide();
																		}
																	}, 1000);
																}
																else
																{
																	// 2) 기존 로직은 결과 보여주고
																	_getExamResult();
																}																
															}

															// 틀린문제 pdf 생성 완료 후 생성된 pdf 조회
															//_getExamResult();
														});
													}, 500);
												}
												else{
													comm.toggleProcessLoading(-1);
												}
											}
										});
									});
								}, 500);
							}
							else{
								comm.toggleProcessLoading(-1);
							}
						}
					});
				}
				else{
					comm.toggleProcessLoading(-1);
				}
			}
			else{
				comm.toggleProcessLoading(-1);
			}
			$(root).find("#contents .quizAnswerList").remove();
		});
	};

	// 시험지 초기화
	var _reset = function(){
		_data = null;
		examEnd = "Y";
		$(root).find("#contents .quizAnswerList").remove();
		$(root).find("#contents .examResult .quizFailBlock .quiz img").remove();
	};

	// pdf 생성 진행상황 표시
	var _progress = function(Token, _function) {
		$.ajax({
			url: "/Common/System/Token_hs.asp?Token=" + Token + "&Idx=" +  Math.random(),
			method: "get",
			asynchronous: false,
			contentType: 'application/x-www-form-urlencoded',
			encoding: 'UTF-8',
			dataType: "xml",
			complete: function(Request){

				if(Request.status == 200){

					if(Request.responseXML){
						var Doc = Request.responseXML.documentElement;
						var _Percent = Doc.getElementsByTagName('Percent')[0].firstChild.nodeValue;
						var _Status = Doc.getElementsByTagName('Status')[0].firstChild.nodeValue;

						// _Status : 100 = 정상, 000 = 문제 없음
						if ( _Status != '' )
						{
							Start = true;
						}
						if (Start == true && _Percent == 100)
						{
							clearInterval(INTERVAL_ID);
							if(typeof(_function) == "function"){
								_function();
							}
						return;
						}
						// 문제를 찾기 못 한다면
						if (_Status == '000') {
							common.alert('알림','현재 시험지의 테스트에 문제가 있어 현재 처리 중 입니다.', null, {});
							clearInterval(INTERVAL_ID);
							return;
						}
						else{
							comm.toggleProcessLoading(_Percent);
						}
					}
				}
				else if(Start && Request.status == 404){
					clearInterval(INTERVAL_ID);
					if(typeof(_function) == "function"){
						_function();
					}
					return;
				}
			}
		});

	};


	return {
		init:function() {
			_init();
		},

		show:function(pRoot, data) {
			common.checkLogin(function(fg, json){
				if(fg){
					posScrollTop = $(document).scrollTop();

					window.scrollTo(0, 0);

					$("#btnSubmit").removeClass("btn-blue");
					$("#btnSubmit").addClass("btn-light-gray");
					$("#btnSubmit").prop("disabled", true);
					$(".quizNumAll > .f_black").text("");

					if(data.checkType == "LT")
					{
						$(".fixedheader .row .popupTitle").addClass("omr-test-title");
						$(".fixedheader .row .popupTitle").text("성적 진단평가");
					}

					zUserID = json.user_id;

					if(pRoot){
						_pRoot = pRoot;
					}
					if(data){
						_data = data;
					}
					_init();
					$(pRoot).hide();
					$(root).show();
				} else {
					loginPop.show(pRoot, _rtnUrl, false);
				}
			});

		},

		hide:function() {
			_reset();
			$(root).hide();
			$(_pRoot).show();
			$(document).scrollTop(posScrollTop);
		},
	};
}();