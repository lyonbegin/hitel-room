var player = function() {
	var _site_id = "M";
	var _id = "vod_player"
	var _downCnt = 0;
	var _evt_play = "N";	// 이벤트 시청 여부 (2020.09.15, 정효태)

	var _init = function() {

	};

	var _initEvent = function() {
		var sel = "[data-src='" + _id + "'][data-act]";

		$(sel).unbind();
		$(sel).bind("click", function(ev) {
			_click(ev);
		});
	};

	var _vodPlayer = function(expapr_no, vod_type, title, vod_idx, curri_idx, depth, file_name, code, data, mnuCode) {
		// 중등영문법
		if(vod_type == "Mid_Eng" || vod_type.toUpperCase() == "MID_ENG_PREMID1") {
			_vodPlayerEG(expapr_no, vod_type, title, vod_idx, curri_idx, depth, file_name, code, mnuCode);
		}
		// 개념영상
		else if(vod_type == "Concept" || vod_type.toUpperCase() == "CONCEPT_PREMID1") {
			_hLog1(expapr_no, vod_type, title, vod_idx, curri_idx, depth, file_name, code, data);
			_vodPlayerConcept(expapr_no, vod_type, title, vod_idx, curri_idx, depth, file_name, code, data);
		}
		else if(vod_type == "highMath" || vod_type == "PREGO1") {
			_vodPlayerConcept1(expapr_no, vod_type, title, vod_idx, curri_idx, depth, file_name, code, data);
		} else if(vod_type == "MidEng") {
			_vodPlayerEG1(expapr_no, vod_type, title, vod_idx, curri_idx, depth, file_name, code);
		}
		else {
			_vodPlayerConcept(expapr_no, vod_type, title, vod_idx, curri_idx, depth, file_name, code, data);
		}
	};

	// 동영상 권한 체크
	var _vodPlayerConcept = function(expapr_no, vod_type, title, vod_idx, curri_idx, depth, file_name, code, data_o) {
			var url_v = '/Vod/ZVodPlayPopMakeConfirm_test.asp';
			var data_v = "expapr_no=" + expapr_no;
			data_v = data_v + "&vod_type=" + vod_type;
			data_v = data_v + "&open_title=" + title;
			data_v = data_v + "&vod_idx=" + vod_idx;
			data_v = data_v + "&curri_idx=" + curri_idx;
			data_v = data_v + "&depth=" + depth;
			data_v = data_v + "&file_name=" + file_name;
			data_v = data_v + "&code=" + code;
			if(data_o){
				data_v = data_v + "&grade=" + data_o["grade"];
				data_v = data_v + "&subj_code=" + data_o["subj_code"];
				data_v = data_v + "&part=" + ((data_o["part"]!="null") ? data_o["part"] : "0");
				if(data_o["siteid"]){
					_site_id = data_o["siteid"];
				}
			}
			data_v = data_v + "&SiteID=" + _site_id;

			comm.send(url_v, data_v, "post", function(data) {
				var msg = "";
				var msg_subject = "";

				if (data.VodState != "YEAR_CHANGE") {
					trkCLS.setExternalEvent("REHGLX4ASEFZSO171LHAWSHZU20250526", "");
				}

				if(data.result == "0") {
					if (data.Subj_Code == "KR") {
						msg_subject = "(국어)"
					} else if (data.Subj_Code == "MT") {
						msg_subject = "(수학)"
					} else if (data.Subj_Code == "EG") {
						msg_subject = "(영어)"
					}

					var resultCode = "0";
					if(data.ReVodState == "Y") {
						jQuery(".download_popup_share_show").hide();
						title = "이미 시청하신 동영상 입니다."
						msg = "버튼을 클릭하시면 동영상 재생이 시작됩니다.";
					}
					else {
						jQuery(".download_popup_share_show").show();
						if(data.VodState == "N"){
							resultCode = 1
							title = "보유하고 있는 이용권이 없습니다.";
							//msg = "개념영상 및 풀이영상은 학생용 PRO 이용권, 선생님 이용권,과목별" + msg_subject + " 이용권, 포인트 이용권으로 시청 가능합니다.<br /><br />이용권 구매 후 이용바랍니다.";
							msg = "이용권/Z-포인트 구매 후 이용바랍니다.";
						} else if(data.VodState == "YEAR_CHANGE") {
							resultCode = "88";
							title = "이용권 학년 변경이 필요합니다.";
							msg = "현재 보유하신 이용권은 이전 학년 전용입니다.<br>2025년에 구매하신 학생 이용권을 이어서 사용하시려면<br>'<span style='font-weight:bold;'>이용권 학년 변경</span>'이 필요합니다.<br>이용권 학년 변경 페이지로 이동하시겠습니까?";
						} else {
							msg = "\"" + data.strDownType + "\"을 이용중이므로 동영상 시청이 가능합니다.";
						}
					}
					data.title = title;
					data.msg = msg;
					data.resultCode = resultCode;

					// 특정 이벤트등으로 인해 영상을 무료로 바로 재생 시키기 위해 분기 처리 (2020.09.15, 정효태)
					if(_evt_play == "Y") {
						// 로그 적재
						//_setEvtMediaPlayLog(data.code, function() {
						_setEvtMediaPlayLog(data.ExPapr_No, data.part, function() {
							_playerRun(data);	// 영상 재생
						})
					} else {
						if(resultCode == "0") {
							var Exfl_Group = "0";
							var ExPapr_No = "0";
							var _ownAmount = data.strOwnAmount;
							common.showDownloadLayer("VOD", data, _downCnt, ExPapr_No, Exfl_Group, _ownAmount, "동영상 보기", function() {
								_playerRun(data);
							});
						} else if(resultCode == "88") {
							common.showDownloadLayer(resultCode, data, _downCnt, "0", "0", _ownAmount, "이용권 구매", function() {
								document.location.href = "/payment/";
							});
						} else {
							common.showDownloadLayer("VOD", data, "1", expapr_no, code, "10", "이용권 구매", function() {
								document.location.href = "/payment/";
							});
						}
					}
				}
				else if (data.result == "-3") {
					data.title = "로그인이 필요합니다.";
					data.msg = "로그인하여 주시기 바랍니다.";
					common.showDownloadLayer("VOD", data, "1", expapr_no, code, "10", "회원가입", function(){
						var root_o = document.querySelector("[data-id='main']");
						loginPop.show(root_o, _rtnUrl, false);
					});
				}
				else {
					data.title = "보유하고 있는 이용권이 없습니다.";
					data.msg = "이용권/Z-포인트 구매후 이용 바랍니다.";
					common.showDownloadLayer("VOD", data, "1", expapr_no, code, "10", "이용권 구매", function() {
						document.location.href = "/payment/";
					});
				}
			});
	};

	// 동영상 권한 체크
	var _vodPlayerConcept1 = function(expapr_no, vod_type, title, vod_idx, curri_idx, depth, file_name, code, data_o) {
			var url_v = '/Vod/mZVodPlayPopMakeConfirm.asp';
			var data_v = "expapr_no=" + expapr_no;
			data_v = data_v + "&vod_type=" + vod_type;
			data_v = data_v + "&open_title=" + title;
			data_v = data_v + "&vod_idx=" + vod_idx;
			data_v = data_v + "&curri_idx=" + curri_idx;
			data_v = data_v + "&depth=" + depth;
			data_v = data_v + "&file_name=" + file_name;
			data_v = data_v + "&code=" + code;
			if(data_o){
				data_v = data_v + "&grade=" + data_o["grade"];
				data_v = data_v + "&subj_code=" + data_o["subj_code"];
				data_v = data_v + "&part=" + data_o["part"];
				if(data_o["siteid"]){
					_site_id = data_o["siteid"];
				}
			}
			data_v = data_v + "&SiteID=" + _site_id;

			//console.log("concept data_v=" + data_v);
			comm.send(url_v, data_v, "post", function(data) {
				var msg = "";
				
				trkCLS.setExternalEvent("REHGLX4ASEFZSO171LHAWSHZU20250526", "");

				if(data.result == "0") {
					var resultCode = "0";
					if(data.ReVodState == "Y") {
						jQuery(".download_popup_share_show").hide();
						title = "이미 시청하신 동영상 입니다."
						msg = "버튼을 클릭하시면 동영상 재생이 시작됩니다.";
					}
					else {
						jQuery(".download_popup_share_show").show();
						if(data.VodState == "N"){
							resultCode = 1
							title = "보유하고 있는 이용권이 없습니다.";
							msg = "예비고1 맞춤 족보 콘텐츠는<br>전용 이용권으로만 이용할 수 있습니다.";
						}
					}

					data.title = title;
					data.msg = msg;
					data.resultCode = resultCode;

					if(resultCode == "0") {
						var Exfl_Group = "0";
						var ExPapr_No = "0";
						var _ownAmount = data.strOwnAmount;
						common.showDownloadLayer("VOD", data, _downCnt, ExPapr_No, Exfl_Group, _ownAmount, "동영상 보기", function() {
							_playerRun(data);
						});
					}
					else {
						common.showDownloadLayer("VOD", data, "1", expapr_no, code, "10", "예비고1 이용권 구매하기", function() {
							common.goPregoPaymentWithDownTracking();
						});
					}
				}
				else if (data.result == "-3") {
					data.title = "로그인이 필요합니다.";
					data.msg = "로그인하여 주시기 바랍니다.";
					common.showDownloadLayer("VOD", data, "1", expapr_no, code, "10", "회원가입", function(){
						var root_o = document.querySelector("[data-id='main']");
						loginPop.show(root_o, _rtnUrl, false);
					});
				}
				else {
					data.title = "보유하고 있는 이용권이 없습니다.";
					data.msg = "예비고1 맞춤 족보 콘텐츠는<br>전용 이용권으로만 이용할 수 있습니다.";
					common.showDownloadLayer("VOD", data, "1", expapr_no, code, "10", "예비고1 이용권 구매하기", function() {
						common.goPregoPaymentWithDownTracking();
					});
				}
			});
	};

	// 중등영문법 동영상 권한 체크
	var _vodPlayerEG = function(expapr_no, vod_type, title, vod_idx, curri_idx, depth, file_name, code, mnuCode) {
			var url_v = '/Vod/VodPlayCheck.asp';
			url_v = '/Vod/Exam_EG_Confirm.asp';
			if(vod_type == "Mid_Eng" || vod_type.toUpperCase() == "MID_ENG_PREMID1") {
				url_v = '/Vod/Exam_EG_Confirm.asp';
			}
			var data_v = "expapr_no=" + expapr_no;
			data_v = data_v + "&vod_type=" + vod_type;
			data_v = data_v + "&open_title=" + encodeURIComponent(title);
			data_v = data_v + "&vod_idx=" + vod_idx;
			data_v = data_v + "&curri_idx=" + curri_idx;
			data_v = data_v + "&depth=" + depth;
			data_v = data_v + "&file_name=" + encodeURIComponent(file_name);
			data_v = data_v + "&code=" + code;
			data_v = data_v + "&mnuCode=" + mnuCode;

			comm.send(url_v, data_v, "post", function(data) {
				var _title = "";
				var msg = "";
				var msg_subject = "";

				trkCLS.setExternalEvent("REHGLX4ASEFZSO171LHAWSHZU20250526", "");

				if(data.result == "0") {
					if (data.Subj_Code == "KR") {
						msg_subject = "(국어)"
					} else if (data.Subj_Code == "MT") {
						msg_subject = "(수학)"
					} else if (data.Subj_Code == "EG") {
						msg_subject = "(영어)"
					}

					var resultCode = "0";
					if(data.ReVodState == "Y") {
						jQuery(".download_popup_share_show").hide();
						_title = "이미 시청하신 동영상 입니다."
						msg = "버튼을 클릭하시면 동영상 재생이 시작됩니다.";
					}
					else {
						if(data.VodState == "N"){
							jQuery(".download_popup_share_show").show();
							resultCode = 1
							_title = "보유하고 있는 이용권이 없습니다.";
							//msg = "개념영상 및 풀이영상은 학생용 PRO 이용권, 선생님 이용권,과목별" + msg_subject + " 이용권, 포인트 이용권으로 시청 가능합니다.<br /><br />이용권 구매 후 이용바랍니다.";
							msg = "이용권/Z-포인트 구매 후 이용바랍니다.";
						}
						else {
							msg = "\"" + data.strDownType + "\"을 이용중이므로 동영상 시청이 가능합니다.";
						}
					}
					data.title = _title;
					data.msg = msg;
					data.resultCode = resultCode;

					if(resultCode == "0") {
						var Exfl_Group = "0";
						var ExPapr_No = "0";
						var _ownAmount = data.strOwnAmount;
						common.showDownloadLayer("VOD", data, _downCnt, ExPapr_No, Exfl_Group, _ownAmount, "동영상 보기", function() {
							data.strOpenTitle = title;
							data.file_name = file_name;
							_playerRun(data);
						});
					}
					else {
						common.showDownloadLayer("VOD", data, "1", expapr_no, code, "10", "이용권 구매", function() {
							document.location.href = "/payment/";
						});
					}
				}
				else if (data.result == "-3") {
					data.title = "로그인이 필요합니다.";
					data.msg = "로그인하여 주시기 바랍니다.";
					common.showDownloadLayer("VOD", data, "1", expapr_no, code, "10", "회원가입", function(){
						var root_o = document.querySelector("[data-id='main']");
						loginPop.show(root_o, _rtnUrl, false);
					});
				}
				else {
					data.title = "보유하고 있는 이용권이 없습니다.";
					data.msg = "이용권 구매 후 이용 바랍니다.";
					common.showDownloadLayer("VOD", data, "1", expapr_no, code, "10", "이용권 구매", function() {
						document.location.href = "/payment/";
					});
				}
			});
	};

	var _vodPlayerEG1 = function(expapr_no, vod_type, title, vod_idx, curri_idx, depth, file_name, code) {
			url_v = '/Vod/mZVodPlayPopMakeConfirm.asp';
			var data_v = "expapr_no=" + expapr_no;
			data_v = data_v + "&vod_type=MidEng";
			data_v = data_v + "&open_title=" + encodeURIComponent(title);
			data_v = data_v + "&vod_idx=" + vod_idx;
			data_v = data_v + "&curri_idx=" + curri_idx;
			data_v = data_v + "&depth=" + depth;
			data_v = data_v + "&file_name=" + encodeURIComponent(file_name);
			data_v = data_v + "&code=" + code;

			comm.send(url_v, data_v, "post", function(data) {
				var _title = "";
				var msg = "";

				trkCLS.setExternalEvent("REHGLX4ASEFZSO171LHAWSHZU20250526", "");

				if(data.result == "0") {
					var resultCode = "0";
					if(data.ReVodState == "Y") {
						jQuery(".download_popup_share_show").hide();
						title = "이미 시청하신 동영상 입니다."
						msg = "버튼을 클릭하시면 동영상 재생이 시작됩니다.";
					}
					else {
						if(data.VodState == "N"){
							resultCode = 1
							title =  "보유하고 있는 이용권이 없습니다.";
							msg = "예비고1 맞춤 족보 콘텐츠는<br>전용 이용권으로만 이용할 수 있습니다.";
						}
						//else {
						//	msg = "\"" + data.strDownType + "\"을 이용중이므로 동영상 시청이 가능합니다.";
						//}
					}

					data.title = title;
					data.msg = msg;
					data.resultCode = resultCode;

					if(resultCode == "0") {
						var Exfl_Group = "0";
						var ExPapr_No = "0";
						var _ownAmount = data.strOwnAmount;
						common.showDownloadLayer("VOD", data, _downCnt, ExPapr_No, Exfl_Group, _ownAmount, "동영상 보기", function() {
							//data.strOpenTitle = title;
							//data.file_name = file_name;
							_playerRun(data);
						});
					}
					else {
						common.showDownloadLayer("VOD", data, "1", expapr_no, code, "10", "예비고1 이용권 구매하기", function() {
							common.goPregoPaymentWithDownTracking();
						});
					}
				}
				else if (data.result == "-3") {
					data.title = "로그인이 필요합니다.";
					data.msg = "로그인하여 주시기 바랍니다.";
					common.showDownloadLayer("VOD", data, "1", expapr_no, code, "10", "회원가입", function(){
						var root_o = document.querySelector("[data-id='main']");
						loginPop.show(root_o, _rtnUrl, false);
					});
				}
				else {
					data.title = "보유하고 있는 이용권이 없습니다.";
					data.msg = "예비고1 맞춤 족보 콘텐츠는<br>전용 이용권으로만 이용할 수 있습니다.";
					common.showDownloadLayer("VOD", data, "1", expapr_no, code, "10", "예비고1 이용권 구매하기", function() {
						common.goPregoPaymentWithDownTracking();
					});
				}
			});
	};

	// 동영상 차감 및 재생
	var _playerRun = function(data) {
		var url_2 = "/VOD/VodPlayComplete.asp";
		var data_2 = "ExPapr_No=" + data.ExPapr_No;
		data_2 = data_2 + "&SiteID=" + data.SiteID;
		data_2 = data_2 + "&Grade=" + data.Grade;
		data_2 = data_2 + "&CheckType=" + data.CheckType;
		data_2 = data_2 + "&Subj_Code=" + data.Subj_Code;
		data_2 = data_2 + "&Vod_Type=" + data.Vod_Type;
		data_2 = data_2 + "&Vod_Title=" + encodeURIComponent(data.file_name);
		data_2 = data_2 + "&Vod_IDX=" + data.vod_idx;
		data_2 = data_2 + "&Curri_IDX=" + data.curri_idx;
		data_2 = data_2 + "&Depth=" + data.depth;
		data_2 = data_2 + "&File_Name=" + encodeURIComponent(data.file_name);
		data_2 = data_2 + "&Code=" + data.code;
		data_2 = data_2 + "&part=" + data.part;	

		if(data.Vod_Type == "Mid_Eng" || data.Vod_Type.toUpperCase() == "MID_ENG_PREMID1") {
			url_2 = "/VOD/MidEng_VodPlayComplete.asp";
			data_2 = "ExPapr_No=" + data.ExPapr_No;
			data_2 = data_2 + "&SiteID=" + data.SiteID;
			data_2 = data_2 + "&Grade=" + data.Grade;
			data_2 = data_2 + "&CheckType=" + data.CheckType;
			data_2 = data_2 + "&Subj_Code=" + data.Subj_Code;
			data_2 = data_2 + "&Vod_Type=" + data.Vod_Type;
			data_2 = data_2 + "&Vod_Title=" + encodeURIComponent(data.file_name);
			data_2 = data_2 + "&Vod_IDX=" + data.vod_idx;
			data_2 = data_2 + "&Curri_IDX=" + data.curri_idx;
			data_2 = data_2 + "&Depth=" + data.depth;
			data_2 = data_2 + "&File_Name=" + encodeURIComponent(data.file_name);
			data_2 = data_2 + "&Code=" + data.code;
			data_2 = data_2 + "&mnuCode=" + data.mnuCode;
		} else if(data.Vod_Type == "highMath" || data.Vod_Type == "PREGO1" || data.Vod_Type == "MidEng") {
			url_2 = "/VOD/mZVodPlayComplete.asp";
			data_2 = "ExPapr_No=" + data.ExPapr_No;
			data_2 = data_2 + "&SiteID=" + data.SiteID;
			data_2 = data_2 + "&Grade=" + data.Grade;
			data_2 = data_2 + "&CheckType=" + data.CheckType;
			data_2 = data_2 + "&Subj_Code=" + data.Subj_Code;
			data_2 = data_2 + "&Vod_Type=" + data.Vod_Type;
			data_2 = data_2 + "&Vod_Title=" + encodeURIComponent(data.file_name);
			data_2 = data_2 + "&Vod_IDX=" + data.vod_idx;
			data_2 = data_2 + "&Curri_IDX=" + data.curri_idx;
			data_2 = data_2 + "&Depth=" + data.depth;
			data_2 = data_2 + "&File_Name=" + encodeURIComponent(data.file_name);
			data_2 = data_2 + "&Code=" + data.code;
			data_2 = data_2 + "&part=" + data.part;
			data_2 = data_2 + "&ReVodState=" + data.ReVodState;
		}

		data_2 = data_2 + "&evt=" + _evt_play;	// 이벤트 유무

		comm.send(url_2, data_2, "post", function(rdata) {
			if(rdata.complete == "Y") {
				var url_3 = "/VOD/player.asp";
				var data_3 = "";
				data_3 = data_3 + "siteid=" + data.SiteID;
				data_3 = data_3 + "&exPapr_No=" + data.ExPapr_No;
				data_3 = data_3 + "&open_title=" + data.strOpenTitle;
				data_3 = data_3 + "&exPapr_Term=";
				data_3 = data_3 + "&exPapr_MidEnd=";
				data_3 = data_3 + "&grade=" + data.Grade;
				data_3 = data_3 + "&vod_type=" + data.Vod_Type;
				data_3 = data_3 + "&vod_Idx=" + data.vod_idx;
				data_3 = data_3 + "&subj_code=" + data.Subj_Code;
				data_3 = data_3 + "&vod_Title=" + data.strOpenTitle;
				data_3 = data_3 + "&curri_Idx=" + data.curri_idx;
				data_3 = data_3 + "&depth=" + data.depth;
				data_3 = data_3 + "&file_name=" + data.file_name;
				data_3 = data_3 + "&code=" + data.code;
				data_3 = data_3 + "&part=" + data.part;
				data_3 = data_3 + "&evt=" + _evt_play;	// 이벤트 유무
				data_3 = data_3 + "&mnuCode=" + data.mnuCode;
				var form = document.querySelector("#p_F_O_R_M");
				if(form == null) {
					form = document.createElement('form');
					form.id = "p_F_O_R_M";
					document.body.appendChild(form);
				}
				else {
					form.innerHTML = "";
				}
				form.setAttribute('method', 'post');
				form.setAttribute('action', url_3);
				form.appendChild(_getInputObj("CheckType", data.CheckType));
				form.appendChild(_getInputObj("siteid", data.SiteID));
				form.appendChild(_getInputObj("exPapr_No", data.ExPapr_No));
				form.appendChild(_getInputObj("open_title", data.strOpenTitle));
				form.appendChild(_getInputObj("exPapr_Term", ""));
				form.appendChild(_getInputObj("exPapr_MidEnd", ""));
				form.appendChild(_getInputObj("grade", data.Grade));
				form.appendChild(_getInputObj("vod_type", data.Vod_Type));
				form.appendChild(_getInputObj("vod_Idx", data.vod_idx));
				form.appendChild(_getInputObj("subj_code", data.Subj_Code));
				form.appendChild(_getInputObj("vod_Title", data.strOpenTitle));
				form.appendChild(_getInputObj("curri_Idx", data.curri_idx));
				form.appendChild(_getInputObj("depth", data.depth));
				form.appendChild(_getInputObj("file_name", data.file_name));
				form.appendChild(_getInputObj("code", data.code));
				form.appendChild(_getInputObj("part", data.part));
				form.appendChild(_getInputObj("evt", _evt_play));	// 이벤트 유무
				form.appendChild(_getInputObj("mnuCode", data.mnuCode));	// 이벤트 유무
				form.submit();
	
				//예비고1 동영상 아이콘 변경
				if(data.Vod_Type == "highMath" || data.Vod_Type == "MidEng") {
					jQuery(".renewal-video .renewal2024-btn-download[data-code='"+data.code+"'][data-curr='"+data.curri_idx+"'][data-type='"+data.Vod_Type+"']").parents('p.renewal-video').not(".downloaded").parent("li").addClass("downloaded");
					jQuery(".renewal-video .renewal2024-btn-download[data-code='"+data.code+"'][data-curr='"+data.curri_idx+"'][data-type='"+data.Vod_Type+"']").not("span.reconfirm").find("span").eq(0).addClass("reconfirm");
					
				} else if(data.Vod_Type == "PREGO1") {
					jQuery(".prego1_down[data-code='"+data.code+"'][data-curr='"+data.curri_idx+"'][data-type='"+data.Vod_Type+"']").parents('div.detailLink').not(".downloaded").parent("li").addClass("downloaded");
					jQuery(".prego1_down[data-code='"+data.code+"'][data-curr='"+data.curri_idx+"'][data-type='"+data.Vod_Type+"']").not("span.reconfirm").find("span").eq(0).addClass("reconfirm");
				}

				return;
			}
			else {

			}
		});
	};

	// 동영상 권한체크 및 재생
	var _playerRun2 = function(vodNo) {
		var url_3 = "/VOD/player2.asp";
		var data_3 = "";
		data_3 = data_3 + "vodNo=" + vodNo;
		var form = document.querySelector("#p_F_O_R_M");
		if(form == null) {
			form = document.createElement('form');
			form.id = "p_F_O_R_M";
			document.body.appendChild(form);
		}
		else {
			form.innerHTML = "";
		}
		form.setAttribute('method', 'post');
		form.setAttribute('action', url_3);
		form.appendChild(_getInputObj("vodNo", vodNo));
		form.submit();
	};

	var _playerRunStorageBox = function(vodNo, menuCD) {
		var url_3 = "/VOD/player2.asp";
		var data_3 = "";
		data_3 = data_3 + "vodNo=" + vodNo;
		var form = document.querySelector("#p_F_O_R_M");
		if(form == null) {
			form = document.createElement('form');
			form.id = "p_F_O_R_M";
			document.body.appendChild(form);
		}
		else {
			form.innerHTML = "";
		}
		form.setAttribute('method', 'post');
		form.setAttribute('action', url_3);
		form.appendChild(_getInputObj("vodNo", vodNo));
		form.appendChild(_getInputObj("menuCD", menuCD));
		form.submit();
	};

	//var _setEvtMediaPlayLog = (media_code, _callback) => {
	var _setEvtMediaPlayLog = (expapr_no, seq, _callback) => {
		var url_v = "/_api/event.api.asp";
		//var data_v = "cmd=SET_EVENT_MEDIA_PLAY_LOG&pay=N&media_code="+media_code;
		var data_v = "cmd=SET_EVENT_MEDIA_PLAY_LOG&pay=N&expapr_no="+expapr_no+"&seq="+seq;

		comm.send(url_v, data_v, "get", (data) => {
			if(typeof(_callback) == "function") {
				_callback();
			}
		});
	}

	// input 객체 생성
	var _getInputObj = function(name_v, value_v) {
		var objs = document.createElement('input');
		objs.setAttribute('type', 'hidden');
		objs.setAttribute('name', name_v);
		objs.setAttribute('value', value_v);
		return objs;
	};

	var _click = function(ee) {
		var ev = ee || window.event;
		var evo = ev.target || ev.srcElement;
		evo = util.findEventObject(ev, null);
		var act_v = evo.getAttribute("data-act");
		_hLog(_id + " act_v = " + act_v);

		// 개념영상 버튼
		if(act_v == "video_down") {
			var eroot 		= util.findObjectByAttr(evo, "data-code", null);
			 _site_id 		= eroot.getAttribute("data-siteid");
			var idx_v 		= eroot.getAttribute("data-idx");
			var type_v 		= eroot.getAttribute("data-type");
			var title_v 	= eroot.getAttribute("data-title");
			var depth_v 	= eroot.getAttribute("data-depth");
			var curr_v 		= eroot.getAttribute("data-curr");
			var code_v 		= eroot.getAttribute("data-code");
			var name_v 		= eroot.getAttribute("data-name");
			var formats_v 	= eroot.getAttribute("data-formats");
			var no_v 		= eroot.getAttribute("data-no");
			var grade_v		= eroot.getAttribute("data-grade");
			var subjcode_v	= eroot.getAttribute("data-subjcode");
			var mnuCode		= eroot.getAttribute("data-mnuCode");
			var part_v		= curr_v;

			var data_o = {};
			data_o["grade"] = grade_v;
			data_o["subj_code"] = subjcode_v;
			data_o["part"] = part_v

			if(no_v == undefined || no_v == "undefined") no_v = "0";

			// 3 : toggle 관련 > 다운로드 발생 Data Log 적재
			var current_toggle = ($("div.header-mo-selector .header-selectd.active").attr("id").toUpperCase() == "BTN_TOGGLE_T") ? "T" : "C";
			fetch("/Include/ajax/toggle_action_log_insert_ajax.asp?log_type=3&exam_type=VOD&expapr_no="+no_v+"&current_toggle="+current_toggle);
			// End
			player.vodPlayer(no_v, type_v, title_v, idx_v, curr_v, depth_v, name_v, code_v, data_o, mnuCode);
		}
	};


	return {
		vodPlayer:function(expapr_no, vod_type, title, vod_idx, curri_idx, depth, file_name, code, data, mnuCode) {
			_vodPlayer(expapr_no, vod_type, title, vod_idx, curri_idx, depth, file_name, code, data, mnuCode);
		},
		vodPlayer_free:function(expapr_no, vod_type, title, vod_idx, curri_idx, depth, file_name, code, data) {	// 이벤트용 함수. 추가기능 있을지 몰라 함수 분기처리 (2020.09.15, 정효태)
			_evt_play = "Y";
			_vodPlayer(expapr_no, vod_type, title, vod_idx, curri_idx, depth, file_name, code, data, "");
		},
		playerRun2:function(vodNo) {
			_playerRun2(vodNo);
		},
		playerRunStorageBox:function(vodNo, menuCD) {
			_playerRunStorageBox(vodNo, menuCD);
		},
		initEvent:function() {
			_initEvent();
		}
	};
}();
