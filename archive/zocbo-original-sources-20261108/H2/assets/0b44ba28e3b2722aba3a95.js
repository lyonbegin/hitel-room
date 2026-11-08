var _DeviceType = 'M';
var NowURL = (location.href).toLowerCase();
var _SiteType = (NowURL.indexOf("/teacher/") > -1) ? "T" : "";

var _downResultCode = -1;
var _downDiv = false;
var _downCnt = false;
var _downPayAuth = "";
var _site_id_ = "M";
var _reDownNo = "";
var _downType = "";
var _Exfl_Group = "";
var _autoSeq = "";
var donga_YN = "N";

var _event_freedown = "N";	// 무료다운로드 flag (2020.09.14, 정효태)

var _IsMatchSvc = "main";	// 학교 ★ 맞춤 / (2021-06-24 / 김진국)

function Login(Domain)
{
    if (typeof(Domain) == 'undefined') Domain = '';

    document.frmLoginRefer.action = Domain + "/Member/Login.asp";
    document.frmLoginRefer.submit();
} 

// 초등 파일 다운로드
function Elem_ExamDownload(ExPapr_No, Exfl_Group, SiteID, ExPapr_Group, IsAutoExamDown, Subj_Code, Grade, exPapr_Coretype) {

	document.domain = "zocbo.com";

    if (typeof (ExPapr_Group) == 'undefined') ExPapr_Group = '';
    if (typeof (IsAutoExamDown) == 'undefined') IsAutoExamDown = false;
    if (typeof (Subj_Code) == 'undefined') Subj_Code = '';
	if (typeof (Grade) == 'undefined') Grade = '';
	if (typeof (exPapr_Coretype) == 'undefined') exPapr_Coretype = '';

    var IsChk_History = true;
	var chk_result;

    _ExPapr_No = ExPapr_No;
    _Exfl_Group = Exfl_Group;
    _SiteID = SiteID;

    // 로그인 및 권한 체크
    if (!Download_Check(ExPapr_No, Exfl_Group, ExPapr_Group, Subj_Code, Grade, exPapr_Coretype)) {
        return;
    }

	if (IsChk_History) {
		// 다운로드 기록 체크
/*
결과값 : 0 다운로드 기록이 없음...
결과값 : 1 재다운로드지만 30일 기간 지남..
결과값 : 2 재다운로드지만 30일 기간 안지남..
결과값 : 3 취소

*/

		chk_result = DownloadHistory_Check(ExPapr_No, Exfl_Group, SiteID);


		switch (chk_result) {
		  case 2  : ExamDownload_Confirm(ExPapr_No, Exfl_Group, SiteID, 1);  //재 다운로드
					return;
    				break;
		  case 3  : return;
					break;
		}

	}

	ExamDownload_Confirm(ExPapr_No, Exfl_Group, SiteID, 2);   //일반 다운로드
}

// 예상족보 전용 - 선택 단원이 변경되면 무조건 차감..
function CreateExamDownload(ExPapr_No, Exfl_Group, SiteID) {

	// 로그인 및 권한 체크
    if (!Download_Check(ExPapr_No, Exfl_Group, '', '', '', '')) {
        return;
    }

	ExamDownload_Confirm(ExPapr_No, Exfl_Group, SiteID, 2);
}


// 중등, 고등 파일 다운로드
function ExamDownload(ExPapr_No, Exfl_Group, SiteID, ExPapr_Group, IsAutoExamDown, Subj_Code, Grade, exPapr_Coretype)
{
    if (typeof (ExPapr_Group) == 'undefined') ExPapr_Group = '';
    if (typeof (IsAutoExamDown) == 'undefined') IsAutoExamDown = false;
    if (typeof (Subj_Code) == 'undefined') Subj_Code = '';
	if (typeof (Grade) == 'undefined') Grade = '';
	if (typeof (exPapr_Coretype) == 'undefined') exPapr_Coretype = '';

    var IsChk_History = true;
	var chk_result;

    // 일부 학교별 예상족보는 중복다운로드 체크를 하지 않는다.
    //if (ExPapr_Group == 'V' && (Subj_Code == 'LS' || Subj_Code == 'HI' || Subj_Code == 'SC' || (SiteID == 'H' && Subj_Code == 'MT')))
	//{
    //    IsChk_History = false;
    //}

    _ExPapr_No = ExPapr_No;
    _Exfl_Group = Exfl_Group;
    _SiteID = SiteID;

	//_hLog(1, IsChk_History, ExPapr_No, Exfl_Group, SiteID);

    // 로그인 및 권한 체크
    if (!Download_Check(ExPapr_No, Exfl_Group, ExPapr_Group, Subj_Code, Grade, exPapr_Coretype)) {
        return;
    }

    // 학교별예상족보는 중등 과학,사회,역사/고등 수학,사회,국사,과학의 경우 최초 클릭시 무조건 AutoExam을 호출한다.
    // 이후 범위 선택 페이지에서 다운로드 클릭 시에는 IsAutoExamDown값을 true로 보내 Download가 이루어진다.
    if ((ExPapr_Group == 'V' || ExPapr_Group == 'W') && IsAutoExamDown == false)
	{
        ExamDownload_AutoExam(ExPapr_Group);
    }
	else
	{
		//_hLog(2, IsChk_History, ExPapr_No, Exfl_Group, SiteID);

		// 고등 > 학평변형 다운로드 안내창 구분을 위한 분기처리.
		if (SiteID == "H" && ExPapr_Group == "D" && exPapr_Coretype == "E")
		{
			if (IsChk_History) {
				// 다운로드 기록 체크
				/*
				결과값 : 0 다운로드 기록이 없음...
				결과값 : 1 재다운로드지만 30일 기간 지남..
				결과값 : 2 재다운로드지만 30일 기간 안지남..
				결과값 : 3 취소
				*/
				chk_result = DownloadHistory_Check(ExPapr_No, Exfl_Group, SiteID);

				switch (chk_result)
				{
					case 2  : TransformExamDownload_Confirm(ExPapr_No, Exfl_Group, SiteID, 1);  //재 다운로드
							return;
							break;
					case 3  : return;
							break;
				}
			}

			TransformExamDownload_Confirm(ExPapr_No, Exfl_Group, SiteID, 2);   //일반 다운로드
		}
		else
		{
			if (IsChk_History)
			{
				// 다운로드 기록 체크
				/*
				결과값 : 0 다운로드 기록이 없음...
				결과값 : 1 재다운로드지만 30일 기간 지남..
				결과값 : 2 재다운로드지만 30일 기간 안지남..
				결과값 : 3 취소
				*/
				chk_result = DownloadHistory_Check(ExPapr_No, Exfl_Group, SiteID);

				//_hLog(3, IsChk_History, ExPapr_No, Exfl_Group, SiteID, chk_result);

				switch (chk_result)
				{
					case 2  : ExamDownload_Confirm(ExPapr_No, Exfl_Group, SiteID, 1);  //재 다운로드
							return;
							break;
					case 3  : return;
							break;
				}
			}

			ExamDownload_Confirm(ExPapr_No, Exfl_Group, SiteID, 2);   //일반 다운로드
		}
    }
}

// 빠른족보 파일 다운로드
function ExamDownloadQuick(ExPapr_No, Exfl_Group, SiteID, ExPapr_Group, IsAutoExamDown, Subj_Code, Grade, exPapr_Coretype)
{
	alert('이벤트가 종료되었습니다.');
}

function TransformExamDownload(ExPapr_No, Exfl_Group, SiteID, ExPapr_Group, IsAutoExamDown, Subj_Code, Grade, exPapr_Coretype) {
    if (typeof (ExPapr_Group) == 'undefined') ExPapr_Group = '';
    if (typeof (IsAutoExamDown) == 'undefined') IsAutoExamDown = false;
    if (typeof (Subj_Code) == 'undefined') Subj_Code = '';
	if (typeof (Grade) == 'undefined') Grade = '';
	if (typeof (exPapr_Coretype) == 'undefined') exPapr_Coretype = '';

    var IsChk_History = true;
	var chk_result;
    // 일부 학교별 예상족보는 중복다운로드 체크를 하지 않는다.
    if (ExPapr_Group == 'V' && (Subj_Code == 'LS' || Subj_Code == 'HI' || Subj_Code == 'SC' || (SiteID == 'H' && Subj_Code == 'MT'))) {
        IsChk_History = false;
    }

    _ExPapr_No = ExPapr_No;
    _Exfl_Group = Exfl_Group;
    _SiteID = SiteID;

    // 로그인 및 권한 체크

    if (!Download_Check(ExPapr_No, Exfl_Group, ExPapr_Group, Subj_Code, Grade, exPapr_Coretype)) {
        return;
    }

    // 학교별예상족보는 중등 과학,사회,역사/고등 수학,사회,국사,과학의 경우 최초 클릭시 무조건 AutoExam을 호출한다.
    // 이후 범위 선택 페이지에서 다운로드 클릭 시에는 IsAutoExamDown값을 true로 보내 Download가 이루어진다.
    if (ExPapr_Group == 'V' && IsAutoExamDown == false) {
        ExamDownload_AutoExam();
    } else {

		if (IsChk_History) {
			// 다운로드 기록 체크

			/*
			결과값 : 0 다운로드 기록이 없음...
			결과값 : 1 재다운로드지만 30일 기간 지남..
			결과값 : 2 재다운로드지만 30일 기간 안지남..
			결과값 : 3 취소

			*/
			chk_result = DownloadHistory_Check(ExPapr_No, Exfl_Group, SiteID);


			switch (chk_result) {
			  case 2  : TransformExamDownload_Confirm(ExPapr_No, Exfl_Group, SiteID, 1);  //재 다운로드
						return;
						break;
			  case 3  : return;
						break;
			}

		}

		TransformExamDownload_Confirm(ExPapr_No, Exfl_Group, SiteID, 2);   //일반 다운로드

    }
}

function ExamDownload_Tweezers_Zocbo(ExPapr_No, Exfl_Group, SiteID, ExPapr_Group, IsAutoExamDown, Subj_Code, Grade, exPapr_Coretype) {
    if (typeof (ExPapr_Group) == 'undefined') ExPapr_Group = '';
    if (typeof (IsAutoExamDown) == 'undefined') IsAutoExamDown = false;
    if (typeof (Subj_Code) == 'undefined') Subj_Code = '';
	if (typeof (Grade) == 'undefined') Grade = '';
	if (typeof (exPapr_Coretype) == 'undefined') exPapr_Coretype = '';
	if (typeof (flag_Num) == 'undefined') exPapr_Coretype = 0;

    var IsChk_History = true;
	var chk_result;
    // 일부 학교별 예상족보는 중복다운로드 체크를 하지 않는다.
    if (ExPapr_Group == 'V' && (Subj_Code == 'LS' || Subj_Code == 'HI' || Subj_Code == 'SC' || (SiteID == 'H' && Subj_Code == 'MT')))
	{
        IsChk_History = false;
    }

    _ExPapr_No = ExPapr_No;
    _Exfl_Group = Exfl_Group;
    _SiteID = SiteID;

    // 로그인 및 권한 체크
    //if (!Download_Check(ExPapr_No, Exfl_Group, ExPapr_Group, Subj_Code, Grade, exPapr_Coretype)) {
	if (!Download_Check(6970681, 6, "C", "MT", "2", ""))
	{
        return;
    }

    // 학교별예상족보는 중등 과학,사회,역사/고등 수학,사회,국사,과학의 경우 최초 클릭시 무조건 AutoExam을 호출한다.
    // 이후 범위 선택 페이지에서 다운로드 클릭 시에는 IsAutoExamDown값을 true로 보내 Download가 이루어진다.
    if (ExPapr_Group == 'V' && IsAutoExamDown == false)
	{
        ExamDownload_AutoExam();
    }
	else
	{
        if (IsChk_History)
		{
            // 다운로드 기록 체크
			/*
			결과값 : 0 다운로드 기록이 없음...
			결과값 : 1 재다운로드지만 30일 기간 지남..
			결과값 : 2 재다운로드지만 30일 기간 안지남..
			결과값 : 3 취소
			*/
			chk_result = DownloadHistory_Check(ExPapr_No, Exfl_Group, SiteID);

			switch (chk_result)
			{
				case 2  : ExamDownload_Confirm_Tweezers_Zocbo(ExPapr_No, Exfl_Group, SiteID, 1);  //재 다운로드
						//ExamDownload_Confirm_Tweezers(6970681, 6, "M", 1);  //재 다운로드
						return;
						break;
				case 3  :
						return;
						break;
			}
		}
		ExamDownload_Confirm_Tweezers_Zocbo(ExPapr_No, Exfl_Group, SiteID, 2);   //일반 다운로드
		//ExamDownload_Confirm_Tweezers(6970681, 6, "M", 2);   //일반 다운로드
    }
}

function ExamDownload_Tweezers_Etoos(ExPapr_No, Exfl_Group, SiteID, ExPapr_Group, IsAutoExamDown, Subj_Code, Grade, exPapr_Coretype) {
    if (typeof (ExPapr_Group) == 'undefined') ExPapr_Group = '';
    if (typeof (IsAutoExamDown) == 'undefined') IsAutoExamDown = false;
    if (typeof (Subj_Code) == 'undefined') Subj_Code = '';
	if (typeof (Grade) == 'undefined') Grade = '';
	if (typeof (exPapr_Coretype) == 'undefined') exPapr_Coretype = '';
	if (typeof (flag_Num) == 'undefined') exPapr_Coretype = 0;

    var IsChk_History = true;
	var chk_result;
    // 일부 학교별 예상족보는 중복다운로드 체크를 하지 않는다.
    if (ExPapr_Group == 'V' && (Subj_Code == 'LS' || Subj_Code == 'HI' || Subj_Code == 'SC' || (SiteID == 'H' && Subj_Code == 'MT')))
	{
        IsChk_History = false;
    }

    _ExPapr_No = ExPapr_No;
    _Exfl_Group = Exfl_Group;
    _SiteID = SiteID;

    // 로그인 및 권한 체크
    //if (!Download_Check(ExPapr_No, Exfl_Group, ExPapr_Group, Subj_Code, Grade, exPapr_Coretype)) {
	if (!Download_Check(6970681, 7, "C", "MT", "2", ""))
	{
        return;
    }

    // 학교별예상족보는 중등 과학,사회,역사/고등 수학,사회,국사,과학의 경우 최초 클릭시 무조건 AutoExam을 호출한다.
    // 이후 범위 선택 페이지에서 다운로드 클릭 시에는 IsAutoExamDown값을 true로 보내 Download가 이루어진다.
    if (ExPapr_Group == 'V' && IsAutoExamDown == false)
	{
        ExamDownload_AutoExam();
    }
	else
	{
        if (IsChk_History)
		{
            // 다운로드 기록 체크
			/*
			결과값 : 0 다운로드 기록이 없음...
			결과값 : 1 재다운로드지만 30일 기간 지남..
			결과값 : 2 재다운로드지만 30일 기간 안지남..
			결과값 : 3 취소
			*/
			chk_result = DownloadHistory_Check(ExPapr_No, Exfl_Group, SiteID);

			switch (chk_result)
			{
				case 2  : ExamDownload_Confirm_Tweezers_Etoos(ExPapr_No, Exfl_Group, SiteID, 1);  //재 다운로드
						//ExamDownload_Confirm_Tweezers(6970681, 7, "M", 1);  //재 다운로드
						return;
						break;
				case 3  :
						return;
						break;
			}
		}
		ExamDownload_Confirm_Tweezers_Etoos(ExPapr_No, Exfl_Group, SiteID, 2);   //일반 다운로드
		//ExamDownload_Confirm_Tweezers(6970681, 7, "M", 2);   //일반 다운로드
    }
}

// 로그인 및 권한 체크
function Download_Check(ExPapr_No, Exfl_Group, ExPapr_Group, Subj_Code, Grade, exPapr_Coretype, flag) {
    var Download_Auth = false;
	var MenuGbn = '1';
	var iframe_Status = (window.location != window.parent.location);

    jQuery.ajax({
        type: 'POST',
        url: '/Common/ExamDownload/DownloadCheck.asp',
        timeout: 30000,
        cache: false,
        async: false,
        data: { ExPapr_No: ExPapr_No, Exfl_Group: Exfl_Group, SiteType: _SiteType },
        contentType: "application/x-www-form-urlencoded; charset=UTF-8",
        error: function(e) {

            alert(e.message+"현재 접속자 수가 많아 일시적으로 서비스가 원활하지 않습니다.\n\n잠시 후에 다시 접속해 주시기 바랍니다. 이용에 불편을 드려 죄송합니다.");
        },
        success: function(data) {
            if (data == '0') {
                Download_Auth = true;
            } else {
                Download_Auth = true;
				return;
                switch (data) {
                    case "-1": // 동시 접속 체크 시 DB오류
                        alert("현재 접속자 수가 많아 일시적으로 서비스가 원활하지 않습니다.\n\n잠시 후에 다시 접속해 주시기 바랍니다. 이용에 불편을 드려 죄송합니다.");
                        break;
                    case "-2": // 일정시간 사용없음. 로그아웃
                        alert("일정시간 동안 이용되지 않아 고객님의 정보보호를 위해 로그아웃되었습니다.\n“확인”을 누르시고 다시 로그인하여 주시기 바랍니다.");
                        Logout(); return;
                        break;
                    case "-3": // 중복 로그인. 로그아웃
                        alert("사용 중인 아이디가 로그아웃 되었습니다.\n1. 일정 시간동안 사용이 없는 경우\n2. 다른 기기에서 로그인한 경우\n다른 사용자가 로그인 한 것으로 판단 되시면 비밀번호를 변경하시기 바랍니다.\n로그인 하시면 다시 사용 가능합니다.");
                        Logout(); return;
                        break;
                    case "1": // 로그인 전
						if(opener)
						{
							move_Parent();
						}
						else
						{
							if(iframe_Status == true)
							{
								layerOpen('loginpopname');
							}
							else
							{
								layerOpen('loginpopname');
							}
						}

                        break;
                    case "2": // 시험지 데이터 없음
                        alert("현재 시험지의 속성 정보가 없습니다.");
                        break;
                    case "3": // 다운로드 권한 없음
                        if (!confirm("다운로드 권한이 없으십니다.\n\n무료회원은 족보이용권을 구매해 주십시요.\n\n이용권 구매 페이지로 이동하시겠습니까?"))
                            break;

                        var SettlementPath;
                        if (_SiteType == "T") {
                            SettlementPath = '/ZocboSettlement/Default_pay2.asp'
                        } else {
                            switch (_SiteID) {
                                case 'E':
                                    if (NowURL.indexOf("ZocboExamOverall") > -1)  //초등은 이용권 구매 페이지가 총괄과 상시로 나눠져 있으므로 URL에서 폴더명을 추출해서 이동 페이지를 구분
                                    {
                                        SettlementPath = '/ZocboElem/ZocboSettlement/PayZocboExamOverall.asp';
                                    }
                                    else {
                                        SettlementPath = '/ZocboElem/ZocboSettlement/';
                                    }
                                    break;
                                case 'M': SettlementPath = '/ZocboSettlement/'; break;
                                case 'H': SettlementPath = '/ZocboSettlement/'; break;
                                default: SettlementPath = '/ZocboSettlement/'; break;
                            };
                        }
						window.location.href = SettlementPath;
                        break;
					case "4":	// 중등 포인트/이용권 있음
						if (confirm('중등 학생용 사이트에서 구매하신 상품은 \n중등 학생용 사이트에서만 사용 가능합니다.\n이동하시겠습니까?'))
						{
							location.href = locationURL('4', 'M', Grade, Subj_Code, ExPapr_Group, exPapr_Coretype);
						}
						break;
					case "5":	// 고등 포인트/이용권 있음
						if (confirm('고등 학생용 사이트에서 구매하신 상품은 \n고등 학생용 사이트에서만 사용 가능합니다.\n이동하시겠습니까?'))
						{
							location.href = locationURL('5', 'H', Grade, Subj_Code, ExPapr_Group, exPapr_Coretype);
						}
						break;
					case "6":	// 교강사-중등 포인트/이용권 있음
						if (confirm('족보 선생님 사이트에서 구매하신 상품은 \n선생님 사이트에서만 사용 가능합니다.\n이동하시겠습니까?'))
						{
							location.href = locationURL('6', 'M', Grade, Subj_Code, ExPapr_Group, exPapr_Coretype);
						}
						break;
					case "7":	// 교강사-고등 포인트/이용권 있음
						if (confirm('족보 선생님 사이트에서 구매하신 상품은 \n선생님 사이트에서만 사용 가능합니다.\n이동하시겠습니까?'))
						{
							location.href = locationURL('7', 'H', Grade, Subj_Code, ExPapr_Group, exPapr_Coretype);
						}
						break;
					default:

                }
            }
        }
    });

    return Download_Auth;
}

// <summary>파일 다운로드 권한체크시 리턴 URL 처리</summary>
// <param name="UrlType">이동 페이지 타입</param>
// <param name="SiteID">M:중등,H:고등</param>
// <param name="Grade">학년</param>
// <param name="Subj_Code">과목코드</param>
// <param name="ExPapr_Group">메뉴그룹_1</param>
// <param name="exPapr_Coretype>메뉴그룹_2</param>
function locationURL(UrlType, SiteID, Grade, Subj_Code, ExPapr_Group, exPapr_Coretype) {
	var returnURL, teacherURL;
	var menuGbn = '1';

	// 교강사 공통으로 사용되는 기본 URL (교강사는 1개의 URL에서 파라메터로 메뉴별 구분을 한다. )
	teacherURL = '/Teacher/TeacherExam/Default.asp?SiteID=' + SiteID + '&Grade=' + Grade + '&Subj_Code=' + Subj_Code + '&Group=' + ExPapr_Group + '&exPapr_Coretype=' + exPapr_Coretype;
	switch (UrlType)
	{
		// 컨텐츠 팀과 협의하여 기출, 단원별, 나머지는 해당 메인으로 이동 하는것으로 협의함! (2019-09-06 / 작업자 : 김진국)
		case '4':	// 중등 관련 페이지로 이동
			switch (ExPapr_Group)
			{
				// 학교별족보 (예상족보)
				//case 'V': returnURL = '/ZocboMid/ZocboExamSchool/default.asp?Grade=' + Grade + '&Subj_Code=' + Subj_Code; break;

				// 학교별족보 (기출족보)
				case 'A': returnURL = '/ZocboMid/ZocboExamSchool/PreviousExam.asp?Grade=' + Grade + '&Subj_Code=' + Subj_Code; break;

				// 단원별
				case 'C': returnURL = '/ZocboMid/ZocboExam/Exam_Unit.asp?Grade=' + Grade + '&Subj_Code=' + Subj_Code; break;

				// 나머지
				default: returnURL = '/ZocboMid/'; break;
			}
			break;
		case '5':	// 고등 관련 페이지로 이동
			switch (ExPapr_Group)
			{
				// 학교별족보 (예상족보)
				//case 'V': returnURL = '/ZocboHigh/ZocboExamSchool/default.asp?Grade=' + Grade + '&Subj_Code=' + Subj_Code; break;

				// 학교별족보 (기출족보)
				case 'A': returnURL = '/ZocboHigh/ZocboExamSchool/PreviousExam.asp?Grade=' + Grade + '&Subj_Code=' + Subj_Code; break;

				// 유형별분석족보 (최다빈출, 최다오답, 영어문법문제(출판사별), 수학유형별문제)
				/*case 'H':
					switch (exPapr_Coretype)
					{
						//최다빈출
						case 'D': returnURL = '/ZocboHigh/ZocboExam/Exam_Most.asp?Group=' + ExPapr_Group + '&Grade=' + Grade + '&Subj_Code=' + Subj_Code + '&exPapr_Coretype=' + exPapr_Coretype; break;

						//최다오답
						case 'E': returnURL = '/ZocboHigh/ZocboExam/Exam_MostWrong.asp?Group=' + ExPapr_Group + '&Grade=' + Grade + '&Subj_Code=' + Subj_Code + '&exPapr_Coretype=' + exPapr_Coretype; break;

						//영어문법문제(출판사별)
						case 'T': returnURL = '/ZocboHigh/ZocboExam/Exam_EngGrammar.asp?Group=' + ExPapr_Group + '&Grade=' + Grade + '&Subj_Code=' + Subj_Code + '&exPapr_Coretype=' + exPapr_Coretype; break;

						//수학 유형별 문제
						case 'C': returnURL = '/ZocboHigh/ZocboExam/Exam_MathType.asp?Group=' + ExPapr_Group + '&Grade=' + Grade + '&Subj_Code=' + Subj_Code + '&exPapr_Coretype=' + exPapr_Coretype; break;
					}
					break;
				// 유형별분석족보 (고난이도)
				case 'S': returnURL = '/ZocboHigh/ZocboExam/Exam_Hard.asp?Group=' + ExPapr_Group + '&Grade=' + Grade + '&Subj_Code=' + Subj_Code + '&exPapr_Coretype=' + exPapr_Coretype; break;

				// 유형별분속족보 (시대별 문학, 수학계산력문제, 고등영문법)
				case 'K':
					switch (exPapr_Coretype)
					{
						//시대별 문학
						case 'R5': returnURL = '/ZocboHigh/ZocboExam/Exam_Timeliterary.asp?Group=' + ExPapr_Group + '&Grade=' + Grade + '&Subj_Code=' + Subj_Code + '&exPapr_Coretype=' + exPapr_Coretype; break;

						//수학 계산력 문제
						case 'B1': returnURL = '/ZocboHigh/ZocboExam/Exam_MathCalculation.asp?Group=' + ExPapr_Group + '&Grade=' + Grade + '&Subj_Code=' + Subj_Code + '&exPapr_Coretype=' + exPapr_Coretype; break;

						//고등 영문법
						case 'C1': returnURL = '/ZocboHigh/ZocboExam/Default_EG.asp?Group=' + ExPapr_Group + '&Grade=' + Grade + '&Subj_Code=' + Subj_Code + '&exPapr_Coretype=' + exPapr_Coretype; break;
					}
					break;
				*/
				// 단원별족보
				case 'C': returnURL = '/ZocboHigh/ZocboExam/Exam_Unit.asp?Group=' + ExPapr_Group + '&Grade=' + Grade + '&Subj_Code=' + Subj_Code + '&exPapr_Coretype=' + exPapr_Coretype; break;

				// 나머지
				default: returnURL = '/ZocboHigh/'; break;
			}
			break;
		case '6':	// 교강사-중등 관련 페이지로 이동
			switch (ExPapr_Group)
			{
				case 'V': returnURL = teacherURL + '&MenuGbn=31'; break;		// 학교별 예상문제
				case 'A': returnURL = teacherURL + '&MenuGbn=31'; break;		// 학교별 기출문제
				default: returnURL = teacherURL + '&MenuGbn=1'; break;
			}
			break;
		case '7':	// 교강사-고등 관련 페이지로 이동
			switch (ExPapr_Group)
			{
				case 'V': returnURL = teacherURL + '&MenuGbn=32'; break;		// 학교별 예상문제
				case 'A': returnURL = teacherURL + '&MenuGbn=32'; break;		// 학교별 기출문제
				default: returnURL = teacherURL + '&MenuGbn=2'; break;
			}
			break;
		default:
			returnURL = '/ZocboMid/ZocboExamSchool/default.asp?Grade=' + Grade + '&Subj_Code=' + Subj_Code;
			break;
	}

	return returnURL;
}

// 다운로드 기록 체크
function DownloadHistory_Check(ExPapr_No, Exfl_Group, SiteID) {
    var ExistExamdown = false;

    jQuery.ajax({
        async: false,
        //url: "/Common/ExamDownload/DownloadHistory_Check.asp",
		url: "/Common/ExamDownload/DownloadHistory_Check_v2.asp",
        data: { SiteID: SiteID, ExPapr_No: ExPapr_No, Exfl_Group: Exfl_Group },
        success: function(data) {
            if (data == '0') ExistExamdown = true;
        }
    });

	//_hLog(SiteID, ExistExamdown);
	/*
	결과값 : 0 다운로드 기록이 없음...
	결과값 : 1 재다운로드지만 30일 기간 지남..
	결과값 : 2 재다운로드지만 30일 기간 안지남..
	결과값 : 3 취소

	*/
    if (ExistExamdown) {
		//이미 재 다운로드이지만 30일 기간 체크를 한다.
		if (ReDownExam_ck(ExPapr_No, Exfl_Group, SiteID))
		{
			//_hLog(ReDownExam_ck(ExPapr_No, Exfl_Group, SiteID));
			return 2;

			// downlown_layer()
			if (confirm("이미 다운받은 자료입니다.\n\n최초 다운로드 일 기준 30일 이내로 무료로 \n\n다운로드 하실 수 있습니다. \n\n다운로드 하시겠습니까?")) {
				return 2;
			}else{
				return 3;
			}
		}else{//30일이 지난 다운로드
			return 1;
			// if (confirm("이미 다운받은 자료입니다.\n\n30일이 지나서 재 다운로드 시 포인트 또는 건 수가 차감 됩니다.\n\n다운로드 하시겠습니까?")) {
			// 	return 1;
			// }else{
			// 	return 3;
			// }
		}

    } else {
        return 0;
    }
}

// 재 다운로드 30일 기간 체크
function ReDownExam_ck(ExPapr_No, Exfl_Group, SiteID) {
    var ExistExamdown = false;

    jQuery.ajax({
        async: false,
        //url: "/Common/ExamDownload/ReDownExam_ck.asp",
		url: "/Common/ExamDownload/ReDownExam_ck_v2.asp",
        data: { SiteID: SiteID, ExPapr_No: ExPapr_No, Exfl_Group: Exfl_Group },
        success: function(data) {
            // if (data == '0') ExistExamdown = true;
            var json = eval("(" + data + ")");
            if (json.Result == '0') {
            	_reDownNo = json.DownNo;
            	ExistExamdown = true;
            }
        }
    });

    return ExistExamdown;

}

// 파일 재다운로드 (마이페이지)
function ExamDownload_ReDown(ExPapr_No, Exfl_Group, Down_No, Auto_Down_Seq, exam_Index, similarQuestion_YN) {
	if (typeof (Auto_Down_Seq) == 'undefined') Auto_Down_Seq = '';
	if (typeof (exam_Index) == 'undefined') exam_Index = '';
	if (typeof (similarQuestion_YN) == 'undefined') similarQuestion_YN = '';	// 유사문항 생성으로 PDF 다운로드시에는 진도율 데이터 안태우려고 우선 해당 부분 처리..

	//72시간 체크
	var ExamdownYN = false;

    jQuery.ajax({
        async: false,
        //url: "/MyPage/ReDown_Check.asp",
		url: "/MyPage/ReDown_Check_v2.asp",
        data: { Down_No: Down_No, ExPapr_No: ExPapr_No, Exfl_Group: Exfl_Group },
        success: function(data) {
            if (data == '0') ExamdownYN = true;
        },
		error: function(request, status, error) {
			alert('서버 통신 오류 입니다.');
			//alert('code:' + request.status + '\n' + 'message:' + request.responseText + '\n' + 'error:' + error);
		}
    });

    if (ExamdownYN) {
        Download(ExPapr_No, Exfl_Group, 1, Down_No, Auto_Down_Seq, exam_Index, similarQuestion_YN);

    } else {
		alert("파일 다운로드 시간으로부터 72시간이 경과하여 재다운로드를 하실 수 없습니다.");
    }
}

function ExamDownload_AutoExam_Preparation(ExPapr_No, root, gubun, SiteID, Subj_Code, Grade, term) {
	chapterSelector.init(ExPapr_No, root, gubun, SiteID, Subj_Code, Grade, term);

    return;
}

// 학교별 예상문제 자동출제
function ExamDownload_AutoExam(ExPapr_Group) {
	if (typeof (ExPapr_Group) == 'undefined') ExPapr_Group = 'V';

	chapterSelector.init(_ExPapr_No, _IsMatchSvc, ExPapr_Group);
    return;
}

// 미리보는 xx고사
function ExamDownload_AutoExam_PreTest(Exfl_Group, SiteID, ExPapr_Group, IsAutoExamDown, Subj_Code, Grade, exPapr_Coretype, IsMatchSvc, PreTerm, id) {
	// 학교 ★ 맞춤 수정!
    chapterSelector.init(0, id, "PreTest", SiteID, Subj_Code, Grade, PreTerm);

    return;
}

// 미리보는 xx고사
function ExamDownload_AutoExam_PreTest_New(Exfl_Group, SiteID, ExPapr_Group, IsAutoExamDown, Subj_Code, Grade, exPapr_Coretype, IsMatchSvc, PreTerm, id) {
	// 학교 ★ 맞춤 수정!
	newChapterSelector_preTest.init(0, id, "PreTest", SiteID, Subj_Code, Grade, PreTerm);

    return;
}


function checkMyDownInfo(ExPapr_No, Exfl_Group ,_callback){
	_hLog("_downDiv="+_downDiv+", downType=" + _downType +", SiteID=" + _SiteID);

	var data_v = "cmd=GET_DOWNLOAD_FILE_INFO&ExPapr_No="+ExPapr_No+"&Exfl_Group="+Exfl_Group+"&downCnt="+_downCnt+"&downType="+_downDiv+"&SiteID=" + _SiteID;
    comm.send("/_api/search.api.asp", data_v, "POST", function(data){
    	if(data){
    		if(typeof(_callback) == "function") {
    			_callback(data);
    		}
    	}
    });
}

function fn_checkMyDownInfo(ExPapr_No, Exfl_Group, Grade, Subj_code, Expapr_Group, Expapr_Coretype, SiteID, _callback){
	//_hLog("_downDiv="+_downDiv+", downType=" + _downType +", SiteID=" + _SiteID);
	if (typeof (SiteID) == 'undefined') SiteID = '';
	if (typeof (_SiteID) == 'undefined') _SiteID = SiteID;

	//var data_v = "cmd=GET_DOWNLOAD_FILE_DETAIL_INFO&ExPapr_No="+ExPapr_No+"&Exfl_Group="+Exfl_Group+"&downCnt="+_downCnt+"&downType="+_downDiv+"&SiteID=" + _SiteID + "&Grade=" + Grade + "&Subj_code=" + Subj_code + "&Expapr_Group=" + Expapr_Group + "&Expapr_Coretype=" + Expapr_Coretype;
	var data_v = "cmd=GET_DOWNLOAD_FILE_DETAIL_INFO_V2&ExPapr_No="+ExPapr_No+"&Exfl_Group="+Exfl_Group+"&downCnt="+_downCnt+"&downType="+_downDiv+"&SiteID=" + _SiteID + "&Grade=" + Grade + "&Subj_code=" + Subj_code + "&Expapr_Group=" + Expapr_Group + "&Expapr_Coretype=" + Expapr_Coretype;

	if (_downPayAuth != "") {
		data_v += "&payAuth=" + _downPayAuth;
	}

    if(donga_YN != "Y") {
		comm.send("/_api/search.api.asp", data_v, "POST", function(data){
			if(data){
				/* 팝업 진입 시 유, 무료 회원 구분 트래킹 */
				let payMember_YN = data.payMember_YN;
				let params = {"param1" : payMember_YN, "expapr_group" : Expapr_Group, "expapr_coretype" : Expapr_Coretype}; // 유/무료 회원 구분 -- Y : 유료 회원 / N : 무료 회원
				trkCLS.setExternalEvent("98JXB8HYBY9NNZ6AU3L4C49NW20250409", params);
				/* 팝업 진입 시 유, 무료 회원 구분 트래킹 */

				if(typeof(_callback) == "function") {
					_callback(data);
				}
			}
		});
	}
}
function Download_Layer(ExPapr_No, Exfl_Group, Grade, Subj_Code, Expapr_Group, Expapr_Coretype, Auto_Down_Seq, exam_Index, SiteID) {
	if (typeof (Auto_Down_Seq) == 'undefined') Auto_Down_Seq = '';
	if (typeof (exam_Index) == 'undefined') exam_Index = '';	
	if (typeof (SiteID) == 'undefined') SiteID = '';

    var top = $(window).scrollTop() + $(window).height() / 5;

	downloadLayerInUserTrk();

    if(_downDiv == "P") {	// 포인트
    } else if(_downDiv == "T") {	// 기간제 이용권.
    } else if(_downDiv == "V") {	// 미리보는 중간고사 무료 다운로드 (V로 임의 선언)
		// 바로 다운처리 할지 레이어 띄울지 확인
    } else if(_downDiv == "R") {	// 재다운로드.
    	// ExamDownload_ReDown(ExPapr_No, Exfl_Group, _reDownNo);
		common.setDownPopupExpaprInfo(Expapr_Group, Expapr_Coretype, "");

		if (_event_freedown == "Y") {
			Download(ExPapr_No, Exfl_Group, 1, "", Auto_Down_Seq);
		} else if(window.location.href.toLowerCase().includes("/exam/school/")) {
			trkCLS.setExternalEvent("REHGLX4ASEFZSO171LHAWSHZU20250526", "");

			$j("#bottomSheetSecondary").addClass("is-active");
			$j("#bottomSheetSecondary .bottomSheet__backdrop").addClass("is-fadeIn");
			$j("#bottomSheetSecondary .bottomSheet__content").addClass("is-slideUp");
			$j("#bottomSheetLayerExpaprDownload").removeClass("is-active");
			$j("#bottomSheetLayerExpaprDownloadLoader").removeClass("is-active");		
			$j("#bottomSheetLayerExpaprDownloadInfo").removeClass("is-active");	
			$j("#bottomSheetLayerExpaprDownloadLoader").show();
			$j("#bottomSheetLayerExpaprDownloadInfo").hide();

			if(ExPapr_Group == "W" || ExPapr_Group == "V") {
				$j("#exam_index").text(exam_Index + "회");
			}
			
			$j("#down_layer_1").hide();
			$j("#down_layer_2").hide();

			$("#btn_Viewer").unbind();
			$("#btn_Viewer").bind("click", function() {
				if(Expapr_Group == "A") {
					school_search.school_goExpaprReView();
					$j("#bottomSheetSecondary").removeClass("is-active");
				} else {
					school_search.school_autoexam_goExpaprReView(ExPapr_No, Auto_Down_Seq, exam_Index, this);
					$j("#bottomSheetSecondary").removeClass("is-active");
				}
			});

			$("#btn_Download").unbind();
			$("#btn_Download").bind("click", function() {
				if(Expapr_Group == "A") {
					$j('.download__file.is-active').addClass('has-re');
					ui_updater.appendLocalStorageData(commonCLS.getExpaprNo(), commonCLS.EXPAPER_FILE_GROUP_CD.PDF.CD);
					download_app("DOWN", "", ExPapr_No, "2", 0, "", "");
					bottomSheetDownload(this);
				} else {
					school_search.school_autoexam_goExpaprReDownload(ExPapr_No, Auto_Down_Seq, exam_Index);
					bottomSheetDownload(this);
				}
			});
		} else {
			jQuery(".download_popup_share_show").hide();

			//[바로보기]버튼 보여지는 조건 확인 common.showViewerBtnCheck 함수
			if (common.showViewerBtnCheck("VIEWER", Exfl_Group)) {
				var dataType = {};
				var down_popup_type = "다운로드";
				var down_date = "30";//기본 재다운로드 기간
				var down_title = "일 이내 다운로드한 파일이므로<br><span class='f_blue'>별도 차감 없이 이용</span>이 가능합니다.";

				if ($(location).attr('pathname').toLowerCase().includes("/soopring/") || $(location).attr('href').toLowerCase().includes("/prego1/zocboexam/englishgrammar.asp?gubun=2") || $(location).attr('href').toLowerCase().includes("/prego1/zocboexam/englishgrammar.asp?gubun=3")) {
					down_date = "3";//수프링, 예비고1 올림포스 메뉴 재다운로드 기간 3일
				}

				down_title = down_date + down_title;//재다운로드 일자 추가한 타이틀

				if (Expapr_Group == "V" || Expapr_Group == "W" || (Expapr_Group == "B" && Auto_Down_Seq != "" && exam_Index != "")) {
					down_popup_type = "문제추출";
				}

				dataType.title = down_title;
				dataType.msg = "버튼을 클릭하시면 파일이 다운로드 됩니다.";

				common.showDownloadLayer("RE_FILE", dataType, 1, ExPapr_No, Exfl_Group, 0, down_popup_type, function() {
					Download(ExPapr_No, Exfl_Group, 1, _reDownNo, Auto_Down_Seq);
				});
			} else {
				Download(ExPapr_No, Exfl_Group, 1, _reDownNo, Auto_Down_Seq);		//이미아 추가 [2019-12-06]
			}
		}

		return;												//이미아 추가 [2019-12-06]
		// Download(ExPapr_No, Exfl_Group, "1", _reDownNo);

		//이미아 주석처리 [2019-12-06]		var IsReDown = 1;
		//이미아 주석처리 [2019-12-06]		var kst = "N";
		//이미아 주석처리 [2019-12-06]        var inputs = "<input type='hidden' name='ExPapr_No' value='" + ExPapr_No + "' /><input type='hidden' name='Exfl_Group' value='" + Exfl_Group + "' /><input type='hidden' name='DeviceType' value='" + _DeviceType + "' />"
		//이미아 주석처리 [2019-12-06]                   + "<input type='hidden' name='kst' value='" + kst + "' /><input type='hidden' name='IsReDown' value='" + IsReDown + "' /><input type='hidden' name='exDownNo' value='" + _reDownNo + "' />"
		//이미아 주석처리 [2019-12-06]                   + "<input type='hidden' name='Sitetype' value='" + _SiteType + "' />"
		//이미아 주석처리 [2019-12-06]        jQuery("<form name='frmDownload' action='/Common/ExamDownload/DownloadAct.asp' method='get'>" + inputs + "</form>").appendTo("body").submit().remove();
		//이미아 주석처리 [2019-12-06]		return;
    }

    // var msg_v = "다운로드 버튼을 선택하시면 다운로드 건수 1건 또는 잔여포인트에서 30P가 차감됩니다. Div=" + _downDiv + ", cnt=" + _downCnt;
    // var btn_v = "다운로드";
    _hLog("Downlaod_layer rt=" + _downResultCode);

	if (_downResultCode != "88" && TRK_GLB_IS_LOGIN) {
		trkCLS.setExternalEvent("REHGLX4ASEFZSO171LHAWSHZU20250526", "");
	}

	if(_downResultCode == "0") {	// 다운로드 가능할때.
		fn_checkMyDownInfo(ExPapr_No, Exfl_Group, Grade, Subj_Code, Expapr_Group, Expapr_Coretype, SiteID, function(data){
			var _ownAmount = data.strOwnAmount;
			_downType = data.strDownType;
			
			var strCouponPointName = data.strCouponPointName;
			var strCouponPointAmount = data.strCouponPointAmount;
			var strdownType = data.downType;
			var strpaySvc = isValueEmpty(data.paySvc) == false ? data.paySvc : "";

			var data = {};

			data["downDiv"] = _downDiv;
			data["strDownType"] = _downType;

			common.setDownPopupExpaprInfo(Expapr_Group, Expapr_Coretype, strpaySvc);

			if(strdownType == "A")
			{
				data["strCouponPointName"] = strCouponPointName;
				data["strCouponPointAmount"] = strCouponPointAmount;
			}

			var down_popup_type = "다운로드";

			if(Expapr_Group == "V" || Expapr_Group == "W" || (Expapr_Group == "B" && Auto_Down_Seq != "" && exam_Index != ""))
			{
				down_popup_type = "문제추출";
			}

			if(window.location.href.toLowerCase().includes("/exam/previousexam.asp")) {
				if(_downDiv == "P") {
					$("#pay_type").text("포인트");
					$("#pay_note").text(_downType);
					$("#pay_remain_txt").text("잔여 포인트");
					$("#pay_remain_cnt").text(Number(_ownAmount).toLocaleString() + "P");
					$("#pay_use_txt").text("차감 포인트");
					$("#pay_use_cnt").text(Number(_downCnt).toLocaleString() + "P");
				} else {
					$("#pay_note").text(_downType);
					$("#pay_remain_cnt").text(Number(_ownAmount).toLocaleString() + " 건");
					$("#pay_use_cnt").text(Number(_downCnt).toLocaleString() + " 건");
				}

				$("#modal1-9").addClass("is-active");

				$("#btnSelected").unbind();
				$("#btnSelected").bind("click", function() {
					Download(ExPapr_No, "2", 1, "", "", "");
					$("#modal1-9").removeClass("is-active");
				});
			} else if(window.location.href.toLowerCase().includes("/exam/school/")) {
				trkCLS.setExternalEvent("REHGLX4ASEFZSO171LHAWSHZU20250526", "");

				$j("#bottomSheetSecondary").addClass("is-active");
				$j("#bottomSheetSecondary .bottomSheet__backdrop").addClass("is-fadeIn");
				$j("#bottomSheetSecondary .bottomSheet__content").addClass("is-slideUp");
				$j("#bottomSheetLayerExpaprDownload").removeClass("is-active");
				$j("#bottomSheetLayerExpaprDownloadLoader").removeClass("is-active");		
				$j("#bottomSheetLayerExpaprDownloadInfo").removeClass("is-active");	

				if(_downDiv == "P") {
					$j("#use_type").text("포인트");
					$j("#remain_item_type").text("잔여 포인트");
					$j("#use_item_type").text("차감 포인트");
					$j(".item__text").attr("data-unit", "P");
				}

				if(Expapr_Group == "W" || Expapr_Group == "V") {
					$j("#exam_index").text(exam_Index + "회");
				}
				
				$j("#use_item_name").text(_downType);
				$j("#remain_item_cnt").text(_ownAmount.replace(/\B(?=(\d{3})+(?!\d))/g, ","));
				$j("#use_item_cnt").text(_downCnt.replace(/\B(?=(\d{3})+(?!\d))/g, ","));

				if(_downDiv == "FREE") {
					$j("#down_layer_1").hide();
					$j("#down_layer_2").hide();
				} else {
					$j("#down_layer_1").show();
					$j("#down_layer_2").show();
				}

				$("#btn_Viewer").unbind();
				$("#btn_Viewer").bind("click", function() {
					if(Expapr_Group == "A") {
						school_search.school_goExpaprView(this);
						$j("#bottomSheetSecondary").removeClass("is-active");
					} else {
						school_search.school_autoexam_goExpaprView(ExPapr_No, Auto_Down_Seq, exam_Index, this);
						$j("#bottomSheetSecondary").removeClass("is-active");
					}					
				});

				$("#btn_Download").unbind();
				$("#btn_Download").bind("click", function() {
					if(Expapr_Group == "A") {
						$j('.download__file.is-active').addClass('has-re');
						ui_updater.appendLocalStorageData(commonCLS.getExpaprNo(), commonCLS.EXPAPER_FILE_GROUP_CD.PDF.CD);
						download_app("DOWN", "", ExPapr_No, "2", 1, "", "");
						bottomSheetDownload(this);
					} else {
						school_search.school_autoexam_goExpaprDownload(ExPapr_No, Auto_Down_Seq, exam_Index);
						bottomSheetDownload(this);
					}
				});
			} else {
				common.showDownloadLayer(_downResultCode, data, _downCnt, ExPapr_No, Exfl_Group, _ownAmount, down_popup_type, function() {
					Download(ExPapr_No, Exfl_Group, 1, "", Auto_Down_Seq, exam_Index);
					var curScroll_v = sessionStorage.getItem("curScroll");
					if(curScroll_v) {
						window.scrollTo(0, curScroll_v);
						sessionStorage.removeItem("curScroll");
					}

					// 미리보는 중간(기말) 고사인 경우 특정 영역 새로고침을 위해 (정효태)
					//if(_downDiv == "V") {
					if(Expapr_Group == "K" && Expapr_Coretype == "T") {
						virtual_exams.freeCntDraw();
						virtual_exams.item_down_click();
					}
				});

				var dl_o = document.querySelector("#downloadLayer");
				var dlMsg_o = dl_o.querySelectorAll("#subMsg");
				var dlMsg_o1 = dl_o.querySelectorAll("#subMsg1");
				var dlMsg_o2 = dl_o.querySelectorAll(".subMsg2");
				var dlMsg_o3 = dl_o.querySelectorAll(".subMsg3");			

				if(strdownType == "A")
				{
					//dl_o.querySelectorAll("#typeG").show();
					$(dlMsg_o1).show();
					$(dlMsg_o2).hide();
					$(dlMsg_o3).hide();
				}

				if (Expapr_Group == "V" || Expapr_Group == "W" || (Expapr_Group == "B" && Auto_Down_Seq != "" && exam_Index != "")) {
					$(dlMsg_o1).hide();
					$(dlMsg_o2).show();
					$(dlMsg_o3).show();

					if(Expapr_Group == "B" && Auto_Down_Seq != "" && exam_Index != "")
					{
						$(dlMsg_o2).html($(dlMsg_o2).html().replace("예상족보", "FINAL모의고사"));
					}
					else if(Expapr_Group == "W" && Auto_Down_Seq != "" && exam_Index != "")
					{
						$(dlMsg_o2).html("");
						$(dlMsg_o2).html("다운로드 받은 자료는 [마이페이지 > 보관함]에서도 재다운로드 가능합니다.");
					}
				} else {
					$(dlMsg_o1).show();
					$(dlMsg_o2).hide();
					$(dlMsg_o3).hide();

					// Body 스크롤 잠금(BJP - Add)
					enableScrollLock();
				}
			}
		});
	    // common.showDownloadLayer(msg_v, btn_v, function() {
	    //     Download(ExPapr_No, Exfl_Group);
	    // });
	}
	else {
		if(_downResultCode <= 2) {
		    common.showDownloadLayer(_downResultCode, _downDiv, _downCnt, ExPapr_No, Exfl_Group, null, "로그인", function() {
		    	var root_p = $("#wrapper");
		    	loginPop.show(root_p, _rtnUrl, false);
		    });

			// Body 스크롤 잠금(BJP - Add)
			enableScrollLock();
		}
		else {
		    // common.showDownloadLayer(_downResultCode, _downDiv, _downCnt, ExPapr_No, Exfl_Group, null, "이용권 구매", function() {
		    // 	document.location.href = "/payment/";
		    // });

		    fn_checkMyDownInfo(ExPapr_No, Exfl_Group, Grade, Subj_Code, Expapr_Group, Expapr_Coretype, SiteID, function(data){
				var _ownAmount = data.strOwnAmount;
				_downType = data.strDownType;

				if((Expapr_Group == "A" && Expapr_Coretype == "A") || Expapr_Group == "I") {
					common.showDownloadLayer_FreeReading(_downResultCode, _downDiv, _downCnt, ExPapr_No, Exfl_Group, null, "학교별 기출 무료 열람실 바로가기", function() {
						document.location.href = "?menu=2&type=0";
					});
				} else {
					if(window.location.href.toLowerCase().includes("/exam/previousexam.asp")) {
						appCLS.goInOutLink({"action" : "goToBrowser", "url" : "/exam/expectedQuestionSample.asp?expapr_no=" + ExPapr_No});
//						$("#pay_type").text("다운로드 권한이 없습니다.");
//						$("#pay_note").hide();
//						$(".modal__useNumber").hide();
//						$(".modal__infoUse").hide();
//						$("#btnSelected").text("이용권 구매하기");
//						$("#modal1-9").addClass("is-active");
//
//						$(document).on("click", "#btnSelected", function() {
//							document.location.href = "/payment/";
//							$("#modal1-9").removeClass("is-active");
//						});
					} else if (window.location.href.toLowerCase().includes("/expected.asp") || window.location.href.toLowerCase().includes("/ai_transform.asp")) {
						var grade = $(".list_icon_area").attr("data-grade");
						var subj_code = $(".list_icon_area").attr("data-subjcode");
						var scl_id = $(".list_icon_area").attr("data-sclid");
						var part_id = document.getElementById("part_ID").value;
						var app_url = window.location.pathname + "?subj_code=" + subj_code + "&grade=" + grade + "&scl_id=" + scl_id + "&part_id=" + part_id;
						
						common.showDownloadLayer(_downResultCode, _downDiv, _downCnt, ExPapr_No, Exfl_Group, _downPayAuth, "이용권 구매", function() {						
							if(window.location.href.toLowerCase().includes("/expected.asp") && window.location.href.toLowerCase().includes("appyn=y")) {
								trkCLS.setExternalEvent("GJE57PF5JBYXQQ5QRP8BHQAZT20240819", "");
							} else if(window.location.href.toLowerCase().includes("/ai_transform.asp") && window.location.href.toLowerCase().includes("appyn=y")) {
								trkCLS.setExternalEvent("G3PQ5L8ARXAJ378WFTMZ2HLDA20240819", "");
							}

							document.location.href = "/payment/" + "?return_page_url=" + escape(app_url);
						});
					} else {
						if(_downResultCode.includes("YEAR_CHANGE") == false) {
							trkCLS.setExternalEvent("DKG22DRRV8BLAPK137HXNIHF720240911", ""); // 공유하기 버튼 노출되는 경우 트래킹
						}

						common.showDownloadLayer(_downResultCode, _downDiv, _downCnt, ExPapr_No, Exfl_Group, null, "이용권 구매", function() {
							document.location.href = "/payment/";
						});
					}
				}
			});
		}
	}

    // $.ajax({
    //     type: 'POST',
    //     url: "/Common/ExamDownload/Download_Layer.asp",
    //     data: { ExPapr_No: ExPapr_No, Exfl_Group: Exfl_Group },
    //     success: function(data) {
    //         $('#popup_layer').html(data).append(cover);
    //         $('#popup_layer div:eq(0)').css('top', top).css('left', '2%');
    //         wrapCover();
    //     }
    // });
}

// 빠른족보 다운로드 처리
function quickZocbo_Download(exPapr_No, exfl_Group, siteID, subj_Code, grade, terms, exam_index, redownYN, exam_firstContents_YN) {
	// 다운로드 시 태그매니저, 로거 관련 쿠키는 삭제가 안되서 요기서 삭제
	document.cookie = 'NA_SAC=; expires=Thu, 01 Jan 1970 00:00:01 GMT;path=/;';
	document.cookie = 'NA_SA=; expires=Thu, 01 Jan 1970 00:00:01 GMT;domain=.zocbo.com;path=/;';
	document.cookie = '_TRK_CQ=; expires=Thu, 01 Jan 1970 00:00:01 GMT;domain=.zocbo.com;path=/;';

	var test_year = terms.substr(0, 4);
	var test_term = terms.substr(4, 1);
	var test_midend = terms.substr(5, 1);

    // 건수 차감 & 다운로드
    jQuery.ajax({
		url: "/Common/ExamDownload/DownloadComplete_v2.asp",
        async: false,
        data: { 
			ExPapr_No : exPapr_No, 
			Exfl_Group : exfl_Group,
			quick_SiteID : siteID,
			quick_subj_Code : subj_Code,
			quick_grade : grade,
			quick_test_year : test_year,
			quick_test_term : test_term,
			quick_test_midend : test_midend,
			quick_redownYN : redownYN,
			quick_index : exam_index,
			quickzocbo_YN : "Y"
		},
        error: function() {
            alert("오류가 발생하였습니다. 잠시후 다시 시도해주세요.");
        },
        success: function(data) {
            switch (data) {				
                case '0': alert("로그인이 필요한 서비스입니다."); return; break;
                case '1': alert("시험지 속성이 없습니다."); return; break;			// 1값이 넘어오는 경우 있을 수 있을 듯 하여 일단 유지
				case '2': alert("시험지 속성이 없습니다."); return; break;			// 1 -> 2 변경
                case '3': alert("다운로드 권한이 없습니다.!!!"); return; break;		// 2 -> 3 변경
				case '4': location.reload(); return; break;
                default:
					var icon_change_val = "";

					if(subj_Code == "KR" || subj_Code == "EG") {
						icon_change_val = siteID + ","+grade + "," + subj_Code + "," + exam_index + ",0,N";
					} else {
						icon_change_val = siteID + ","+grade + "," + subj_Code + "," + exam_index + ","+exPapr_No + ",N";
					}
					
					jQuery("button[data-val='"+ icon_change_val +"']").addClass("is-redown");
					jQuery("button[data-val='"+ icon_change_val +"']").attr("data-downyn", "Y");
					jQuery("button[data-val='"+ icon_change_val +"']").attr("disabled", true);

					setTimeout(function() {
						jQuery("button[data-val='"+ icon_change_val +"']").attr("disabled", false);						
					}, 1000);

					if(terms == "20261E") {
						trkCLS.setExternalEvent("6YNU2VJE6SDI1UKFFRV6GWMBX20260611", "");
					}else if(terms == "20261M") {
						trkCLS.setExternalEvent("PDKAICURDZ7NRIRR7A5CULBN120260410", "");
					} else if(terms == "20251E") {
						trkCLS.setExternalEvent("GW2DFB5ZZ34ROLCC15LYADG6820250616", "");
					} else if(terms == "20252M") {
						trkCLS.setExternalEvent("1MV7MYZGTTY9722UYXXBNNDYV20250917", "");
					} else {
						trkCLS.setExternalEvent("1TBKYR5YTGDE5I7D9WXOJ4MN720251111", "");
					}

                    var inputs = "<input type='hidden' name='ExPapr_No' value='" + exPapr_No + "' /><input type='hidden' name='Exfl_Group' value='" + exfl_Group + "' /><input type='hidden' name='DeviceType' value='M' />"
							+ "<input type='hidden' name='quickzocboYN' value='Y' />";
						
					jQuery("<form name='frmDownload' action='/Common/ExamDownload/DownloadAct_v2.asp' method='get'>" + inputs + "</form>").appendTo("body").submit().remove();

//					if(terms == "20252E") {
//						(GetCookie("download-zb-quick") != "download-zb-quick") ? jQuery("#download-zb-quick").show() : '';
//					}

					break;
            }
        }
    });
}

// 빠른족보 다운로드 처리
function quickZocbo_app_Download(exPapr_No, exfl_Group, siteID, subj_Code, grade, terms, exam_index, redownYN, exam_firstContents_YN) {
	// 다운로드 시 태그매니저, 로거 관련 쿠키는 삭제가 안되서 요기서 삭제
	document.cookie = 'NA_SAC=; expires=Thu, 01 Jan 1970 00:00:01 GMT;path=/;';
	document.cookie = 'NA_SA=; expires=Thu, 01 Jan 1970 00:00:01 GMT;domain=.zocbo.com;path=/;';
	document.cookie = '_TRK_CQ=; expires=Thu, 01 Jan 1970 00:00:01 GMT;domain=.zocbo.com;path=/;';

	var test_year = terms.substr(0, 4);
	var test_term = terms.substr(4, 1);
	var test_midend = terms.substr(5, 1);

	var btnViewerClick = common.getCookie("btnViewerClick") ? common.getCookie("btnViewerClick") : "";
	common.setCookie("btnViewerClick", "Y", -1);

    // 건수 차감 & 다운로드
    jQuery.ajax({
		url: "/Common/ExamDownload/DownloadComplete_v2.asp",
        async: false,
        data: { 
			ExPapr_No : exPapr_No, 
			Exfl_Group : exfl_Group,
			quick_SiteID : siteID,
			quick_subj_Code : subj_Code,
			quick_grade : grade,
			quick_test_year : test_year,
			quick_test_term : test_term,
			quick_test_midend : test_midend,
			quick_redownYN : redownYN,
			quick_index : exam_index,
			quickzocbo_YN : "Y",
			quickzocbo_devicetype : "A"
		},
        error: function() {
            alert("오류가 발생하였습니다. 잠시후 다시 시도해주세요.");
        },
        success: function(data) {
            switch (data) {				
                case '0': alert("로그인이 필요한 서비스입니다."); return; break;
                case '1': alert("시험지 속성이 없습니다."); return; break;			// 1값이 넘어오는 경우 있을 수 있을 듯 하여 일단 유지
				case '2': alert("시험지 속성이 없습니다."); return; break;			// 1 -> 2 변경
                case '3': alert("다운로드 권한이 없습니다.!!!"); return; break;		// 2 -> 3 변경
				case '4': location.reload(); return; break;
                default:
					var icon_change_val = "";

					if(subj_Code == "KR" || subj_Code == "EG") {
						icon_change_val = siteID + ","+grade + "," + subj_Code + "," + exam_index + ",0,N";
					} else {
						icon_change_val = siteID + ","+grade + "," + subj_Code + "," + exam_index + ","+exPapr_No + ",N";
					}
					
					jQuery("button[data-val='"+ icon_change_val +"']").addClass("is-redown");
					jQuery("button[data-val='"+ icon_change_val +"']").attr("data-downyn", "Y");
					jQuery("button[data-val='"+ icon_change_val +"']").attr("disabled", true);

					setTimeout(function() {
						jQuery("button[data-val='"+ icon_change_val +"']").attr("disabled", false);		
						jQuery("#down_nm").text(unescape(common.getCookie("quickzocbofn")));				
					}, 1000);

					if(terms == "20261E") {
						trkCLS.setExternalEvent("6YNU2VJE6SDI1UKFFRV6GWMBX20260611", "");
					}else if(terms == "20261M") {
						trkCLS.setExternalEvent("PDKAICURDZ7NRIRR7A5CULBN120260410", "");
					} else if(terms == "20251E") {
						trkCLS.setExternalEvent("GW2DFB5ZZ34ROLCC15LYADG6820250616", "");
					} else if(terms == "20252M") {
						trkCLS.setExternalEvent("1MV7MYZGTTY9722UYXXBNNDYV20250917", "");
					} else {
						trkCLS.setExternalEvent("1TBKYR5YTGDE5I7D9WXOJ4MN720251111", "");
					}
					
                    var inputs = "<input type='hidden' name='ExPapr_No' value='" + exPapr_No + "' />"
							+ "<input type='hidden' name='Exfl_Group' value='" + exfl_Group + "' />"
							+ "<input type='hidden' name='DeviceType' value='A' />"
							+ "<input type='hidden' name='quickzocboYN' value='Y' />"
							+ "<input type='hidden' name='btnViewerClick' value='" + btnViewerClick + "' />" ;
					
					if (btnViewerClick) {
						appCLS.goInOutLink({"action" : "goToViewer", "exPaprNo" : exPapr_No.toString(), "fileType" : "QUICK_ZOCBO", "shortUrl" : "", "pk" : ""});
						bottomSheetClose(document.querySelector(".header__close"));
					} else {
						jQuery("<form name='frmDownload' action='/Common/ExamDownload/DownloadAct_v2.asp' method='get'>" + inputs + "</form>").appendTo("body").submit().remove();
					}
					break;
            }
        }
    });
}

// 파일 다운
function Download(ExPapr_No, Exfl_Group, IsReDown, Down_No, Auto_Down_Seq, exam_Index, similarQuestion_YN) {
	// 다운로드 시 태그매니저, 로거 관련 쿠키는 삭제가 안되서 요기서 삭제
	document.cookie = 'NA_SAC=; expires=Thu, 01 Jan 1970 00:00:01 GMT;path=/;';
	document.cookie = 'NA_SA=; expires=Thu, 01 Jan 1970 00:00:01 GMT;domain=.zocbo.com;path=/;';
	document.cookie = '_TRK_CQ=; expires=Thu, 01 Jan 1970 00:00:01 GMT;domain=.zocbo.com;path=/;';
	// End
	
    if (typeof (IsReDown) == 'undefined') IsReDown = '';
	if (typeof (Auto_Down_Seq) == 'undefined') Auto_Down_Seq = '';
	if (typeof (exam_Index) == 'undefined') exam_Index = '';
	if (typeof (similarQuestion_YN) == 'undefined') similarQuestion_YN = '';	// 유사문항 생성으로 PDF 다운로드시에는 진도율 데이터 안태우려고 우선 해당 부분 처리..

    var kst = "N";
    if (document.getElementById("kst") != null) kst = document.getElementById("kst").value;
	
	if(window.location.href.toLowerCase().includes("/exam/previousexam.asp") || window.location.href.toLowerCase().includes("/exam/school/")) {//뷰어앱 내 기출열람실 다운로드
		_DeviceType = "A";//디바이스 타입 : A
	}
	
	let menuCD, subjectDetailCD;
	if (window.location.href.toLowerCase().includes("/event/") == false) {
		menuCD = commonGLB.getMenuCD();
		subjectDetailCD = commonGLB.getSubjectDetailCD();
	}
    // 건수 차감 & 다운로드
    jQuery.ajax({
        //url: "/Common/ExamDownload/DownloadComplete.asp",
		url: "/Common/ExamDownload/DownloadComplete_v2.asp",
        async: false,
        //data: { ExPapr_No: ExPapr_No, Exfl_Group: Exfl_Group, DeviceType: _DeviceType, IsReDown: IsReDown, exDownNo: Down_No, Sitetype: _SiteType, kst: kst, virtual_explain_file:((_Exfl_Group == "91") ? "Y" : "N") },
		data: { ExPapr_No: ExPapr_No, Exfl_Group: Exfl_Group, DeviceType: _DeviceType, IsReDown: IsReDown, exDownNo: Down_No, Sitetype: _SiteType, kst: kst, virtual_explain_file:((_Exfl_Group == "91") ? "Y" : "N"), evt_free: _event_freedown, Auto_Down_Seq: Auto_Down_Seq, exam_Index: exam_Index, menuCD: menuCD, subjectDetailCD: subjectDetailCD },
        dataType: "json",
        error: function(request,status,error) {
            alert("오류가 발생하였습니다. 잠시후 다시 시도해주세요.");
        },
        success: function(jsonstring) {
			var btnViewerClick = common.getCookie("btnViewerClick") ? common.getCookie("btnViewerClick") : "";
			common.setCookie("btnViewerClick", "Y", -1);

            switch (jsonstring.exn) {
                case '0': alert("로그인이 필요한 서비스입니다."); return; break;
                case '1': alert("시험지 속성이 없습니다."); return; break;
                case '2': alert("다운로드 권한이 없습니다.!!!"); return; break;
				case '3': alert("잘못된 접근입니다."); return; break;
				case '5': alert("오류가 발생했습니다. 다시 시도해주시기 바랍니다."); location.reload(); return; break;
                default:
					//User_Point_Call();
                    if (IsReDown == '') Down_No = jsonstring.exn;
                    else if (IsReDown == '1') Down_No = jsonstring.exn;

					try {
						if(Exfl_Group == '2' || Exfl_Group == '3' || Exfl_Group == '4') {
							// 직전대비 Final 모의고사는 재다운로드 관련 처리 X
							if(jsonstring.expapr_group == "B" && Auto_Down_Seq != '' && exam_Index != '')
							{								
							}
							else
							{
								// 예상족보 예외 재다운로드 버튼 표시
								if (jsonstring.expapr_group != "V" && jsonstring.expapr_group != "W" && jsonstring.expapr_group != "E") {
									ui_updater.appendLocalStorageData(ExPapr_No, Exfl_Group);
									//ui_updater.setUI();
								}

								if (jsonstring.expapr_group == "V" || jsonstring.expapr_group == "W") {
									jQuery('li[data-exam-index="' + exam_Index + '"]').addClass("downloaded");
									jQuery('a[data-exam-index="' + exam_Index + '"]').html(_Unit.drawButtonDetail("pdf", "reconfirm", "PDF"));
									jQuery('a[data-exam-index="' + exam_Index + '"]').addClass("gray");
									jQuery('button[data-exam-index="' + exam_Index + '"]').show();

									if(window.location.href.toLowerCase().includes("/expected.asp") && window.location.href.toLowerCase().includes("appyn=y")) {
										trkCLS.setExternalEvent("VPE9ZQK4FLBGUNZ9OU4MUDX1T20240819", "");
									} else if(window.location.href.toLowerCase().includes("/ai_transform.asp") && window.location.href.toLowerCase().includes("appyn=y")) {
										trkCLS.setExternalEvent("OF6DP8DOR6C2RCTACFK7HZT2720240819", "");
									}
								}

								//Ai수준별학습 대표문제 및 n회 학습 재다운로드 표기
								if (Exfl_Group == "2" && jsonstring.expapr_group == "E") {
									if (exam_Index != "") {//Ai n회일 경우 재다운로드 표기
										let itemID = "#exam_ai_" + ExPapr_No + "_" + exam_Index;
										if (jQuery(itemID).hasClass("is-disabled") == false) {
											jQuery(itemID).addClass("is-disabled");
										}	
									} else {//대표문제
										ui_updater.appendLocalStorageData(ExPapr_No, Exfl_Group);
									}
								}

								if(Exfl_Group == '2' || Exfl_Group == '4') {
									var preSrc = (jQuery('[data-bts-no="' + ExPapr_No + '"]').attr("src"));

									if(preSrc == "/Images/zocbo_rn/sub/common/ico_wa_note.gif") {
										jQuery('[data-bts-no="' + ExPapr_No + '"]').attr("src", "/Images/zocbo_rn/sub/common/ico_wa_anwer.gif");
									}
								}
							}
						}
					} catch(e) {
						// pass
					}

					if(similarQuestion_YN != "Y") {
						let cnt = jQuery("#exam_"+ExPapr_No).parents(".item__body").find("div").length;

						jQuery.ajax({
							url: "/exam/ajax/setProgressRateAjax.asp",
							async: false,
							data: {
								exam_no : ExPapr_No,
								cnt : cnt,
								part_id : storage.getLocal(storage.EXPAPR_PART_CD),
								menu_cd : storage.getLocal(storage.SEARCH_MENU_CD),
								level_cd : storage.getLocal(storage.EXPAPR_LEVEL_CD),
							},
							dataType: 'json',
							error: function() {
								//alert("오류가 발생하였습니다. 잠시후 다시 시도해주세요.");
							},
							success: function(data) {
								storage.removeLocal("CONNECT_CD");
							}
						});
					}

					// 다운로드
                    var inputs = "<input type='hidden' name='ExPapr_No' value='" + ExPapr_No + "' /><input type='hidden' name='Exfl_Group' value='" + Exfl_Group + "' /><input type='hidden' name='DeviceType' value='" + _DeviceType + "' />"
                               + "<input type='hidden' name='kst' value='" + kst + "' /><input type='hidden' name='IsReDown' value='" + IsReDown + "' /><input type='hidden' name='exDownNo' value='" + Down_No + "' />"
                               + "<input type='hidden' name='Sitetype' value='" + _SiteType + "' /><input type='hidden' name='virtual_explain_file' value='" + ((_Exfl_Group == "91") ? "Y" : "N") + "' />"
                               + "<input type='hidden' name='exdt' value='" + jsonstring.data + "' /><input type='hidden' name='Auto_Down_Seq' value='" + Auto_Down_Seq + "' />"
							   + "<input type='hidden' name='exam_Index' value='" + exam_Index + "' />"
							   + "<input type='hidden' name='menuCD' value='' />"
							   + "<input type='hidden' name='btnViewerClick' value='" + btnViewerClick + "' />" ;

					if(window.location.href.toLowerCase().includes("/exam/previousexam.asp")) {
						appCLS.goInOutLink({"action" : "goToViewer", "exPaprNo" : ExPapr_No, "fileType" : "E", "shortUrl" : "", "pk" : ""});
					} else {
						jQuery("<form name='frmDownload' action='/Common/ExamDownload/DownloadAct_v2.asp' method='get'>" + inputs + "</form>").appendTo("body").submit().remove();
					}

					// 회원정보와 다른 학년의 파일을 다운 받을 경우 팝업 show
					if(typeof(MemberInfoPopupCtrl) != "undefined") {
						MemberInfoPopupCtrl.member_info_popup_init({"type":"D", "expapr_no":"" + ExPapr_No + ""});
					}

                    break;
            }
        }
    });
}

// 파일 다운(뷰어앱 내 다운로드 실행 함수)_기존과 동일한 동작으로 앱내 불필요한 부분 제거한 함수(실행타입)
//- execType : 실행타입 -> DOWN(파일다운로드), VIEW(바로보기)
function download_app(execType, selector, ExPapr_No, Exfl_Group, IsReDown, Down_No, Auto_Down_Seq, exam_Index) {
    if (typeof (IsReDown) == 'undefined') IsReDown = '';
	if (typeof (Auto_Down_Seq) == 'undefined') Auto_Down_Seq = '';
	if (typeof (exam_Index) == 'undefined') exam_Index = '';

    var kst = "N";

    // 건수 차감 & 다운로드
    jQuery.ajax({
        url: "/Common/ExamDownload/DownloadComplete_v2.asp",
        async: false,
        data: { 
			ExPapr_No: ExPapr_No, 
			Exfl_Group: Exfl_Group, 
			DeviceType: _DeviceType, 
			IsReDown: IsReDown, 
			exDownNo: Down_No, 
			Sitetype: _SiteType, 
			kst: kst, 
			virtual_explain_file:"N", 
			evt_free: _event_freedown, 
			Auto_Down_Seq: Auto_Down_Seq,
			menuCD : commonGLB.getMenuCD(),
			subjectDetailCD : commonGLB.getSubjectDetailCD(),
			exam_Index : exam_Index
		},
        dataType: "json",
        error: function(request,status,error) {
            alert("오류가 발생하였습니다. 잠시후 다시 시도해주세요.");
        },
        success: function(jsonstring) {
            switch (jsonstring.exn) {
                case '0': alert("로그인이 필요한 서비스입니다."); return; break;
                case '1': alert("시험지 속성이 없습니다."); return; break;
                case '2': alert("다운로드 권한이 없습니다.!!!"); return; break;
				case '3': alert("잘못된 접근입니다."); return; break;
				case '5': alert("오류가 발생했습니다. 다시 시도해주시기 바랍니다."); location.reload(); return; break;
                default:
					if (IsReDown == '') Down_No = jsonstring.exn;
                    else if (IsReDown == '1') Down_No = jsonstring.exn;

					// 다운로드
                    var inputs = "<input type='hidden' name='ExPapr_No' value='" + ExPapr_No + "' /><input type='hidden' name='Exfl_Group' value='" + Exfl_Group + "' />";
					inputs = inputs + "<input type='hidden' name='DeviceType' value='" + _DeviceType + "' />";
					inputs = inputs + "<input type='hidden' name='kst' value='N' />";
                    inputs = inputs + "<input type='hidden' name='IsReDown' value='" + IsReDown + "' /><input type='hidden' name='exDownNo' value='" + Down_No + "' />";
                    inputs = inputs + "<input type='hidden' name='Sitetype' value='" + _SiteType + "' /><input type='hidden' name='virtual_explain_file' value='N' />";
                    inputs = inputs + "<input type='hidden' name='exdt' value='" + jsonstring.data + "' /><input type='hidden' name='Auto_Down_Seq' value='" + Auto_Down_Seq + "' />";
					inputs = inputs + "<input type='hidden' name='exam_Index' value='" + exam_Index + "' />";
					inputs = inputs + "<input type='hidden' name='menuCD' value='" + commonGLB.getMenuCD() + "' />";
					inputs = inputs + "<input type='hidden' name='btnViewerClick' value='' />" ;

					if(execType != "DOWN_AUTOEXAM" && execType != "VIEW_AUTOEXAM") {
						examCLS.setReDownLoadUI();//다운로드 및 바로보기 시 페이지 내 UI 업데이트
					}

					if (execType == "DOWN_AUTOEXAM" || (execType == "VIEW_AUTOEXAM" && window.location.href.toLowerCase().includes("/exam/examfinallist.asp") == false)) {
						$('[data-no="' + ExPapr_No + '"][data-exam-index="' + exam_Index + '"]').addClass("is-re");

						if(exam_Index == "1") {
							$(".is-schoolpg").hide(); // 예상족보 1회 무료 라벨 미노출 처리
						}
					} else if(window.location.href.toLowerCase().includes("/exam/school/") == true) {
						$('[data-no="' + ExPapr_No + '"][data-group=A]').addClass("is-re");
						ui_updater.appendLocalStorageData(ExPapr_No, Exfl_Group);
					}

					if (execType == "VIEW" || execType == "VIEW_AUTOEXAM") {//뷰어에서 바로 볼 때
						if (selector !== null) {
							bottomSheetClose(selector);
						}
						
						if(execType == "VIEW_AUTOEXAM") {
							appCLS.goInOutLink({"action" : "goToViewer", "exPaprNo" : ExPapr_No, "fileType" : "V", "shortUrl" : "", "pk" : Auto_Down_Seq.toString()});
						} else {
							appCLS.goInOutLink({"action" : "goToViewer", "exPaprNo" : ExPapr_No, "fileType" : "E", "shortUrl" : "", "pk" : ""});
						}
					} else {//파일 다운로드 시
						jQuery("<form name='frmDownload' action='/Common/ExamDownload/DownloadAct_v2.asp' method='get'>" + inputs + "</form>").appendTo("body").submit().remove();
					}

					jQuery.ajax({
						url: "/exam/ajax/setProgressRateAjax.asp",
						async: false,
						data: {
							exam_no : ExPapr_No,
							cnt : storage.getLocal(storage.EXPAPR_COUNT),
							part_id : storage.getLocal(storage.EXPAPR_PART_CD),
							menu_cd : storage.getLocal(storage.SEARCH_MENU_CD),
							level_cd : storage.getLocal(storage.EXPAPR_LEVEL_CD),
						},
						dataType: 'json',
						error: function() {
							//alert("오류가 발생하였습니다. 잠시후 다시 시도해주세요.");
						},
						success: function(data) {
							storage.removeLocal("CONNECT_CD");
						}
					});
					
                    break;
            }
        }
    });
}

// 보유 포인트 재설정 (포인트 관련 실시간 차감을 위해 사용하는 함수이나 지금 우선 빼놓은 상황 - DB에 영향을 너무 줘서)
function User_Point_Call() {
	jQuery.ajax({
		url: '/Include/User_Point_Call.asp',
		dataType: 'json',
		async: false,
		error: function(request, status, error){
			alert('서버통신 오류입니다.');
		},
		success: function(data){
			jQuery('#Gnb_ZP_Point_E').text('초등 ' + data.ZP_Point_E + ' P');
			jQuery('#Gnb_ZP_Point_M').text('중등 ' + data.ZP_Point_M + ' P');
			jQuery('#Gnb_ZP_Point_H').text('고등 ' + data.ZP_Point_H + ' P');
		}
	});
}

// 파일 다운
function Download_VOD_Zocbo(ExPapr_No, Exfl_Group, IsReDown, Down_No) {
    if (typeof (IsReDown) == 'undefined') IsReDown = '';
    if (typeof (Down_No) == 'undefined') Down_No = '';

    var kst = "N";
    if (document.getElementById("kst") != null) kst = document.getElementById("kst").value;

	VodPopup('6970681', '(1) 동물들은 모두가 서정시인', '대표유형', '1');

//    // 건수 차감 & 다운로드
//    jQuery.ajax({
//        url: "/Common/ExamDownload/DownloadComplete.asp",
//        async: false,
//        data: { ExPapr_No: ExPapr_No, Exfl_Group: Exfl_Group, DeviceType: _DeviceType, IsReDown: IsReDown, exDownNo: Down_No, Sitetype: _SiteType, kst: kst },
////        error: function() {
////            alert("오류가 발생하였습니다. 잠시후 다시 시도해주세요.");
////        },
//		error: function(request, status, error)
//		{
//			alert('code:' + request.status + '\n' + 'message:' + request.responseText + '\n' + 'error:' + error);
//		},
//        success: function(data) {
//            switch (data) {
//                case '0': alert("로그인이 필요한 서비스입니다."); return; break;
//                case '1': alert("시험지 속성이 없습니다."); return; break;
//                case '2': alert("다운로드 권한이 없습니다."); return; break;
//                default:
//                    if (IsReDown == '') Down_No = data;
//                    // 다운로드
//                    var inputs = "<input type='hidden' name='ExPapr_No' value='" + ExPapr_No + "' /><input type='hidden' name='Exfl_Group' value='" + Exfl_Group + "' /><input type='hidden' name='DeviceType' value='" + _DeviceType + "' />"
//                               + "<input type='hidden' name='kst' value='" + kst + "' /><input type='hidden' name='IsReDown' value='" + IsReDown + "' /><input type='hidden' name='exDownNo' value='" + Down_No + "' />"
//                               + "<input type='hidden' name='Sitetype' value='" + _SiteType + "' />"
//                    jQuery("<form name='frmDownload' action='/Common/ExamDownload/DownloadAct.asp' method='get'>" + inputs + "</form>").appendTo("body").submit().remove();
//                    break;
//            }
//        }
//    });
}

// 파일 다운
function Download_VOD_Etoos(ExPapr_No, Exfl_Group, IsReDown, Down_No) {
    if (typeof (IsReDown) == 'undefined') IsReDown = '';
    if (typeof (Down_No) == 'undefined') Down_No = '';

    var kst = "N";
    if (document.getElementById("kst") != null) kst = document.getElementById("kst").value;

	VodPopup_Etoos('6970681', '(1) 동물들은 모두가 서정시인', '대표유형', '1');
}

// 우리반쿠폰 발급 권한이 있는 경우 랜딩 처리 (대충 25.06.01 되면 삭제 해주세요~~)
function getMyClassCouponCheck() {
	jQuery.ajax({
		type : "GET",
		dataType:'json',
		url : "/mypage/ajax/getMyClassCouponAuthAjax.asp",
		data: {},
		success: function(responseJson) {
			if (responseJson.response_code == "200") {					
				alert("선생님을 위한 우리반 쿠폰(족보닷컴 다운로드 쿠폰) 지급완료!\n지금 쿠폰을 확인하세요.");
				location.href = "/MyPage/MyClassCoupon.asp";
			}				
		},error: function(request, exception) {
		}
	});
}

// 다운로드 안내 레이어
function ExamDownload_Confirm(ExPapr_No, Exfl_Group, SiteID, flag, Grade, Subj_Code, Expapr_Group, Expapr_Coretype) {
	//getMyClassCouponCheck();

	Download_Layer(ExPapr_No, Exfl_Group, Grade, Subj_Code, Expapr_Group, Expapr_Coretype);
	return;

	/* 아래는 실행 안됨 */
    var _url = "/Common/ExamDownload/DownloadConfirm.asp?ExPapr_No=" + ExPapr_No + "&Exfl_Group=" + Exfl_Group + "&flag=" + flag + "&SiteID=" + SiteID + "&downType=" + _downDiv + "&downCnt=" + _downCnt;

    if (jQuery(window).height() != jQuery(window.parent).height()) {
        // 중고등 메인 및 상세보기 추천컨텐츠는 iframe으로 되어있다.
        var _parent = jQuery(window.parent);
        var iHeight = ((_parent.height() - 470) / 2);
        var iWidth = ((_parent.width() - 450) / 2);
        var maskHeight = jQuery(window.parent.document).height();
        var maskWidth = _parent.width();

        jQuery("#levelTest", parent.document).css({ top: iHeight, left: iWidth }).show();
		if(!_downDiv){
	        jQuery("#gameplayer", parent.document).append("<iframe src=" + _url + " frameBorder='0' scrolling='no' width='450' height='480'>");
		} else {
			jQuery("#gameplayer", parent.document).append("<iframe src=" + _url + " frameBorder='0' scrolling='no' width='450' height='530'>");
		}
        jQuery('#mask', parent.document).css({ 'width': maskWidth, 'height': maskHeight }).fadeTo("slow", 0.2);

    } else {
        var iHeight = ((jQuery(window).height() - 470) / 2);
        var iWidth = ((jQuery(window).width() - 450) / 2);
        var maskHeight = jQuery(document).height();
        var maskWidth = jQuery(window).width();

        jQuery("#levelTest").css({ top: iHeight, left: iWidth }).show();
		if(!_downDiv){
	        jQuery("#gameplayer").append("<iframe src=" + _url + " frameBorder='0' scrolling='no' width='450' height='480'>");
		} else {
			jQuery("#gameplayer").append("<iframe src=" + _url + " frameBorder='0' scrolling='no' width='450' height='530'>");
		}
        jQuery('#mask').css({ 'width': maskWidth, 'height': maskHeight }).fadeTo("slow", 0.2);
    }
}

function TransformExamDownload_Confirm(ExPapr_No, Exfl_Group, SiteID, flag) {
	Download_Layer(ExPapr_No, Exfl_Group);
	return;

    var _url = "/Common/ExamDownload/TransformDownloadConfirm.asp?ExPapr_No=" + ExPapr_No + "&Exfl_Group=" + Exfl_Group + "&flag=" + flag + "&SiteID=" + SiteID;

    if (jQuery(window).height() != jQuery(window.parent).height()) {
        // 중고등 메인 및 상세보기 추천컨텐츠는 iframe으로 되어있다.
        var _parent = jQuery(window.parent);
        var iHeight = ((_parent.height() - 470) / 2);
        var iWidth = ((_parent.width() - 450) / 2);
        var maskHeight = jQuery(window.parent.document).height();
        var maskWidth = _parent.width();

        jQuery("#levelTest", parent.document).css({ top: iHeight, left: iWidth }).show();
        jQuery("#gameplayer", parent.document).append("<iframe src=" + _url + " frameBorder='0' scrolling='no' width='450' height='480'>");
        jQuery('#mask', parent.document).css({ 'width': maskWidth, 'height': maskHeight }).fadeTo("slow", 0.2);

    } else {
        var iHeight = ((jQuery(window).height() - 470) / 2);
        var iWidth = ((jQuery(window).width() - 450) / 2);
        var maskHeight = jQuery(document).height();
        var maskWidth = jQuery(window).width();

        jQuery("#levelTest").css({ top: iHeight, left: iWidth }).show();
        jQuery("#gameplayer").append("<iframe src=" + _url + " frameBorder='0' scrolling='no' width='450' height='480'>");
        jQuery('#mask').css({ 'width': maskWidth, 'height': maskHeight }).fadeTo("slow", 0.2);
    }
}

function ExamDownload_Confirm_Tweezers_Zocbo(ExPapr_No, Exfl_Group, SiteID, flag)
{
    var _url = "/Common/ExamDownload/DownloadConfirm_Tweezers.asp?ExPapr_No=" + ExPapr_No + "&Exfl_Group=" + Exfl_Group + "&flag=" + flag + "&SiteID=" + SiteID;

    if (jQuery(window).height() != jQuery(window.parent).height())
	{
        // 중고등 메인 및 상세보기 추천컨텐츠는 iframe으로 되어있다.
        var _parent = jQuery(window.parent);
        var iHeight = ((_parent.height() - 470) / 2);
        var iWidth = ((_parent.width() - 450) / 2);
        var maskHeight = jQuery(window.parent.document).height();
        var maskWidth = _parent.width();

        jQuery("#levelTest", parent.document).css({ top: iHeight, left: iWidth }).show();
        jQuery("#gameplayer", parent.document).append("<iframe src=" + _url + " frameBorder='0' scrolling='no' width='450' height='480'>");
        jQuery('#mask', parent.document).css({ 'width': maskWidth, 'height': maskHeight }).fadeTo("slow", 0.2);
    }
	else
	{
        var iHeight = ((jQuery(window).height() - 470) / 2);
        var iWidth = ((jQuery(window).width() - 450) / 2);
        var maskHeight = jQuery(document).height();
        var maskWidth = jQuery(window).width();

        jQuery("#levelTest").css({ top: iHeight, left: iWidth }).show();
        jQuery("#gameplayer").append("<iframe src=" + _url + " frameBorder='0' scrolling='no' width='450' height='480'>");
        jQuery('#mask').css({ 'width': maskWidth, 'height': maskHeight }).fadeTo("slow", 0.2);
    }
}

function ExamDownload_Confirm_Tweezers_Etoos(ExPapr_No, Exfl_Group, SiteID, flag)
{
    var _url = "/Common/ExamDownload/DownloadConfirm_Tweezers_Etoos.asp?ExPapr_No=" + ExPapr_No + "&Exfl_Group=" + Exfl_Group + "&flag=" + flag + "&SiteID=" + SiteID;

    if (jQuery(window).height() != jQuery(window.parent).height())
	{
        // 중고등 메인 및 상세보기 추천컨텐츠는 iframe으로 되어있다.
        var _parent = jQuery(window.parent);
        var iHeight = ((_parent.height() - 470) / 2);
        var iWidth = ((_parent.width() - 450) / 2);
        var maskHeight = jQuery(window.parent.document).height();
        var maskWidth = _parent.width();

        jQuery("#levelTest", parent.document).css({ top: iHeight, left: iWidth }).show();
        jQuery("#gameplayer", parent.document).append("<iframe src=" + _url + " frameBorder='0' scrolling='no' width='450' height='480'>");
        jQuery('#mask', parent.document).css({ 'width': maskWidth, 'height': maskHeight }).fadeTo("slow", 0.2);
    }
	else
	{
        var iHeight = ((jQuery(window).height() - 470) / 2);
        var iWidth = ((jQuery(window).width() - 450) / 2);
        var maskHeight = jQuery(document).height();
        var maskWidth = jQuery(window).width();

        jQuery("#levelTest").css({ top: iHeight, left: iWidth }).show();
        jQuery("#gameplayer").append("<iframe src=" + _url + " frameBorder='0' scrolling='no' width='450' height='480'>");
        jQuery('#mask').css({ 'width': maskWidth, 'height': maskHeight }).fadeTo("slow", 0.2);
    }
}

function fnCheck(value, ExPapr_No, Exfl_Group) {
    jQuery('#fadeB, a.close').remove();
    jQuery('#gameplayer').empty();
    jQuery('#mask, .window').hide();
    if (value == 1) {
        Download(ExPapr_No, Exfl_Group);
    }
}

function fnCheck_VOD_Zocbo(value, ExPapr_No, Exfl_Group) {
    jQuery('#fadeB, a.close').remove();
    jQuery('#gameplayer').empty();
    jQuery('#mask, .window').hide();
    if (value == 1) {
        Download_VOD_Zocbo(ExPapr_No, Exfl_Group);
    }
}

function fnCheck_VOD_Etoos(value, ExPapr_No, Exfl_Group) {
    jQuery('#fadeB, a.close').remove();
    jQuery('#gameplayer').empty();
    jQuery('#mask, .window').hide();
    if (value == 1) {
        Download_VOD_Etoos(ExPapr_No, Exfl_Group);
    }
}

function RefnCheck(value, ExPapr_No, Exfl_Group, Re_DownNo) {
    jQuery('#fadeB, a.close').remove();
    jQuery('#gameplayer').empty();
    jQuery('#mask, .window').hide();
    if (value == 1) {
        ExamDownload_ReDown(ExPapr_No, Exfl_Group, Re_DownNo);
    }
}


// 빠른족보 파일 다운로드
function ExamDownloadQuick_20191E(ExPapr_No, Exfl_Group, SiteID, ExPapr_Group, IsAutoExamDown, Subj_Code, Grade, exPapr_Coretype)
{
	alert('이벤트가 종료되었습니다.');
}

// 빠른족보 파일 다운로드 체크
function fn_QuickZocbo_Download_Check(exPapr_No, exfl_Group, siteID, subj_Code, grade, exam_index, terms, redownYN, exam_firstContents_YN) {
	if (typeof (terms) == 'undefined') terms = '';

	if (terms != '') {
		if(redownYN == "Y" || exam_firstContents_YN == "Y") {
			if(window.location.href.toLowerCase().includes("/app/event/quickzocbo")) {
				if (!fn_downCheck("14436687", "2") && exam_index != "1") { // 빠른 족보 임의 시험지 번호 강제 세팅해서 권한만 체크
					if(terms == "20261E") {
						quickzocboCLS_1E.openTermOver(exam_index);
					} else if(terms == "20261M") {
						quickzocboCLS.openTermOver(exam_index);
					} else if(terms == "20252M") {
						quickzocboCLS_2M.openTermOver(exam_index);
					} else if(terms == "20252E") {
						quickzocboCLS_2E.openTermOver(exam_index);
					}
				} else {
					let btn = document.createElement("button");
					$(btn).attr("type", "button");
					$(btn).attr("data-url", "#bottomSheetLayerExpaprDownload");
					$j("#bottomSheetLayerExpaprDownload").removeClass("is-active");
					$j("#bottomSheetLayerExpaprDownloadLoader").removeClass("is-active");		
					$j("#bottomSheetLayerExpaprDownloadInfo").removeClass("is-active");	
					$j("#bottomSheetLayerExpaprDownloadLoader").show();
					$j("#bottomSheetLayerExpaprDownloadInfo").hide();
			
					quickZocbo_app_Download(exPapr_No, exfl_Group, siteID, subj_Code, grade, terms, exam_index, redownYN, exam_firstContents_YN);
			
					bottomSheetDownload(btn);
				}
			} else {
				if (!fn_downCheck("14436687", "2") && exam_index != "1") { // 빠른 족보 임의 시험지 번호 강제 세팅해서 권한만 체크
					$j("#voucher_index").text(exam_index);
					$j("#voucher").addClass("active");
					return;	
				} else {
					quickZocbo_Download(exPapr_No, exfl_Group, siteID, subj_Code, grade, terms, exam_index, redownYN, exam_firstContents_YN);
				}
			}
		} else {
			var isChk_History = false;

			// if (!Download_Check(exPapr_No, exfl_Group)) { // 로그인 및 권한 체크
			if (!fn_downCheck(exPapr_No, exfl_Group)) { // 로그인 및 권한 체크
				if(window.location.href.toLowerCase().includes("/app/event/quickzocbo")) {
					if(terms == "20261M") {
						quickzocboCLS.openTermOver(exam_index);
					} else if(terms == "20251E") {
						quickzocboCLS_1E.openTermOver(exam_index);
					} else if(terms == "20252M") {
						quickzocboCLS_2M.openTermOver(exam_index);
					} else {
						quickzocboCLS_2E.openTermOver(exam_index);
					}
				} else {
					$j("#voucher_index").text(exam_index);
					$j("#voucher").addClass("active");
				}
				return;			
			} else {
				if(window.location.href.toLowerCase().includes("/app/event/quickzocbo")) {
					let btn = document.createElement("button");
					$(btn).attr("type", "button");
					$(btn).attr("data-url", "#bottomSheetLayerExpaprDownload");
					$j("#bottomSheetLayerExpaprDownload").removeClass("is-active");
					$j("#bottomSheetLayerExpaprDownloadLoader").removeClass("is-active");		
					$j("#bottomSheetLayerExpaprDownloadInfo").removeClass("is-active");	
					$j("#bottomSheetLayerExpaprDownloadLoader").show();
					$j("#bottomSheetLayerExpaprDownloadInfo").hide();
			
					quickZocbo_app_Download(exPapr_No, exfl_Group, siteID, subj_Code, grade, terms, exam_index, redownYN, exam_firstContents_YN);
			
					bottomSheetDownload(btn);
				} else {
					quickZocbo_Download(exPapr_No, exfl_Group, siteID, subj_Code, grade, terms, exam_index, redownYN, exam_firstContents_YN);
				}
			}
		}
	} else {
		alert('이벤트가 종료되었습니다.');
	}
}

// 빠른족보 파일 다운로드(구)
function fn_examDownloadQuickCommon(exPapr_No, exfl_Group, siteID, exPapr_Group, isAutoExamDown, subj_Code, grade, exPapr_Coretype, terms)
{
    _site_id_ = siteID;
	if (typeof (terms) == 'undefined') terms = '';
	if (terms == '20212M')
	{
		if (typeof (exPapr_Group) == 'undefined') exPapr_Group = '';
		if (typeof (isAutoExamDown) == 'undefined') isAutoExamDown = false;
		if (typeof (subj_Code) == 'undefined') subj_Code = '';
		if (typeof (grade) == 'undefined') grade = '';
		if (typeof (exPapr_Coretype) == 'undefined') exPapr_Coretype = '';

		var isChk_History = false;

		_ExPapr_No  = exPapr_No;
		_Exfl_Group = exfl_Group;
		_SiteID     = siteID;

		if (!Download_Check(exPapr_No, exfl_Group))										// 로그인 및 권한 체크
		{
			return;
		}

		if (exPapr_Group == 'V' && isAutoExamDown == false)
		{
			Download_AutoExam(exPapr_No);
		} else {
			if (isChk_History) {
				if (!DownloadHistory_Check(exPapr_No, exfl_Group, siteID))				// 다운로드 기록 체크
				{
					return;
				}
			}

			Download(exPapr_No, exfl_Group);											// 다운로드 안내 레이어
		}
	}
	else
	{
		alert('이벤트가 종료되었습니다.');
	}
}


// 로그인 및 권한 체크
function fn_downCheck(ExPapr_No, Exfl_Group, ExPapr_Group, Subj_Code, Grade, exPapr_Coretype, flag, exam_Index) {
	var Download_Auth = false;
	var returnArray = false;
	var MenuGbn = '1';
	var iframe_Status = (window.location != window.parent.location);
	var isIgnoreRedown = false;
	var payMember_YN = "";
	if (typeof (exam_Index) == 'undefined') exam_Index = '';

	//if(ExPapr_Group == "V") {
	if(ExPapr_Group == "V" || ExPapr_Group == "W") {
		isIgnoreRedown = true;
	}

	jQuery.ajax({
		type: 'POST',
		//url: '/Common/ExamDownload/DownloadCheck_new.asp',
		url: '/Common/ExamDownload/DownloadCheck_new_v2.asp',
		timeout: 30000,
		cache: false,
		async: false,
		data: { ExPapr_No: ExPapr_No, Exfl_Group: Exfl_Group, SiteType: _SiteType, IsIgnoreRedown: isIgnoreRedown, exam_Index: exam_Index},
		contentType: "application/x-www-form-urlencoded; charset=UTF-8",
		error: function(e) {
			_downResultCode = -1;
			_downDiv = 0;
			_downCnt = 0;
			_downPayAuth = "";
			Download_Auth = false;
			return;
			alert(e.message+"현재 접속자 수가 많아 일시적으로 서비스가 원활하지 않습니다.\n\n잠시 후에 다시 접속해 주시기 바랍니다. 이용에 불편을 드려 죄송합니다.");
		},
		success: function(data) {
			returnArray = data.split(',');
			_downResultCode = returnArray[0];
			_downDiv = returnArray[1];
			_downCnt = returnArray[2];

			if (returnArray.length > 3) {
				_downPayAuth = returnArray[3];
			} else {
				_downPayAuth = "";
			}

			if(returnArray[0] == '10') {
				Download_Auth = false;
				alert('현재 제공되지 않는 출판사입니다.');
				location.reload();
				donga_YN = "Y";
			}

			if (returnArray[0] == '0') {
				Download_Auth = true;
			} else {
				Download_Auth = false;
				if(window.location.href.toLowerCase().includes("/exam/school/")) {
					if(_downResultCode.includes("YEAR_CHANGE")) {
						$j("#orgItemName").text(_downDiv);
						$j("#nextItemName").text(_downCnt);
						$j("#settingDate").text(_downPayAuth);
						$j("#bottomSheetYearChange").addClass("is-active");
						$j("#bottomSheetYearChange .bottomSheet__backdrop").addClass("is-fadeIn");
						$j("#bottomSheetYearChange .bottomSheet__content").addClass("is-slideUp");
					} else {
						$j("#bottomSheetPrimary").addClass("is-active");
						$j("#bottomSheetPrimary .bottomSheet__backdrop").addClass("is-fadeIn");
						$j("#bottomSheetPrimary .bottomSheet__content").addClass("is-slideUp");
					}
				} else {
					return;
					switch (returnArray[0]) {
						case "-1": // 동시 접속 체크 시 DB오류
							alert("현재 접속자 수가 많아 일시적으로 서비스가 원활하지 않습니다.\n\n잠시 후에 다시 접속해 주시기 바랍니다. 이용에 불편을 드려 죄송합니다.");
							break;
						case "-2": // 일정시간 사용없음. 로그아웃
							alert("일정시간 동안 이용되지 않아 고객님의 정보보호를 위해 로그아웃되었습니다.\n“확인”을 누르시고 다시 로그인하여 주시기 바랍니다.");
							Logout();
							return;
							break;
						case "-3": // 중복 로그인. 로그아웃
							alert("사용 중인 아이디가 로그아웃 되었습니다.\n1. 일정 시간동안 사용이 없는 경우\n2. 다른 기기에서 로그인한 경우\n다른 사용자가 로그인 한 것으로 판단 되시면 비밀번호를 변경하시기 바랍니다.\n로그인 하시면 다시 사용 가능합니다.");
							Logout(); return;
							break;
						case "1": // 로그인 전
							if(opener) {
								move_Parent();
							} else {
								if(iframe_Status == true) {
									layerOpen('loginpopname');
								} else {
									layerOpen('loginpopname');
								}
							}
							break;
						case "2": // 시험지 데이터 없음
							alert("현재 시험지의 속성 정보가 없습니다.");
							break;
						case "3": // 다운로드 권한 없음						
							if (!confirm("다운로드 권한이 없으십니다.\n\n무료회원은 족보이용권을 구매해 주십시요.\n\n이용권 구매 페이지로 이동하시겠습니까?"))
								break;

							var SettlementPath;
							if (_SiteType == "T") {
								SettlementPath = '/ZocboSettlement/Default_pay2.asp'
							} else {
								switch (_SiteID) {
									case 'E':
										if (NowURL.indexOf("ZocboExamOverall") > -1) { //초등은 이용권 구매 페이지가 총괄과 상시로 나눠져 있으므로 URL에서 폴더명을 추출해서 이동 페이지를 구분
											SettlementPath = '/ZocboElem/ZocboSettlement/PayZocboExamOverall.asp';
										} else {
											SettlementPath = '/ZocboElem/ZocboSettlement/';
										}
										break;
									case 'M': SettlementPath = '/ZocboSettlement/'; break;
									case 'H': SettlementPath = '/ZocboSettlement/'; break;
									default: SettlementPath = '/ZocboSettlement/'; break;
								};
							}
							window.location.href = SettlementPath;
							break;
						case "4":	// 중등 포인트/이용권 있음
							if (confirm('중등 학생용 사이트에서 구매하신 상품은 \n중등 학생용 사이트에서만 사용 가능합니다.\n이동하시겠습니까?')) {
								location.href = locationURL('4', 'M', Grade, Subj_Code, ExPapr_Group, exPapr_Coretype);
							}
							break;
						case "5":	// 고등 포인트/이용권 있음
							if (confirm('고등 학생용 사이트에서 구매하신 상품은 \n고등 학생용 사이트에서만 사용 가능합니다.\n이동하시겠습니까?')) {
								location.href = locationURL('5', 'H', Grade, Subj_Code, ExPapr_Group, exPapr_Coretype);
							}
							break;
						case "6":	// 교강사-중등 포인트/이용권 있음
							if (confirm('족보 선생님 사이트에서 구매하신 상품은 \n선생님 사이트에서만 사용 가능합니다.\n이동하시겠습니까?')) {
								location.href = locationURL('6', 'M', Grade, Subj_Code, ExPapr_Group, exPapr_Coretype);
							}
							break;
						case "7":	// 교강사-고등 포인트/이용권 있음
							if (confirm('족보 선생님 사이트에서 구매하신 상품은 \n선생님 사이트에서만 사용 가능합니다.\n이동하시겠습니까?')) {
								location.href = locationURL('7', 'H', Grade, Subj_Code, ExPapr_Group, exPapr_Coretype);
							}
							break;
						default:
					}
				}
			}
		}
	});

	return Download_Auth;
}


/*
	이벤트등으로 인해 유료다운로드를 무료로받게 처리 (2020.09.14, 정효태)
	다만, 다운로그는 별도 테이블에 저장. 재다운로드 방지
*/
function fn_event_free_examDownload(ExPapr_No, Exfl_Group, SiteID, ExPapr_Group, IsAutoExamDown, Subj_Code, Grade, exPapr_Coretype) {
	_event_freedown = "Y";
	fn_examDownload(ExPapr_No, Exfl_Group, SiteID, ExPapr_Group, IsAutoExamDown, Subj_Code, Grade, exPapr_Coretype);
}

function fn_event_pay_examDownload(ExPapr_No, Exfl_Group, SiteID, ExPapr_Group, IsAutoExamDown, Subj_Code, Grade, exPapr_Coretype) {
	_event_freedown = "N";
	fn_examDownload(ExPapr_No, Exfl_Group, SiteID, ExPapr_Group, IsAutoExamDown, Subj_Code, Grade, exPapr_Coretype);
}

function ExamDownload_AutoExam_V2(zUser_ID, ExPapr_No, Subj_Code, SiteID, Grade, part_ID_Set, exam_Index, Down_Chk, ExPapr_Group) {
	if (typeof (ExPapr_Group) == 'undefined') ExPapr_Group = 'V';

	if(Down_Chk == "0")
	{
		var url_v = "/ZocboExam/AutoExam_Layer.asp";
		var data_v = "ExPapr_No=" + ExPapr_No + "&Part_ID_Set=" + part_ID_Set + "&reSubj_Code=" + Subj_Code + "&exam_Index=" + exam_Index + "&ExPapr_Group=" + ExPapr_Group;
		var Token = null;
		var autoSeq = "";										
		var loadingCnt = 0;

		comm.toggleProcessLoading(0);
		comm.send(url_v, data_v, "post", function(data) {
			if(data){
				if(data.isRedownLastChk == '0')
				{
					//ExamDownload_ReDown(ExPapr_No, '2', data.exDown_No, data.Auto_Seq);
					comm.toggleProcessLoading(-1);
					
					//[바로보기]버튼 보여지는 조건 확인 common.showViewerBtnCheck 함수
					if (common.showViewerBtnCheck("VIEWER", "2")) {
						var dataType = {};
						var down_popup_type = "다운로드";
						var down_date = "30";//기본 재다운로드 기간
						var down_title = "일 이내 다운로드한 파일이므로<br><span class='f_blue'>별도 차감 없이 이용</span>이 가능합니다.";

						down_title = down_date + down_title;//재다운로드 일자 추가한 타이틀

						dataType.title = down_title;
						dataType.msg = "버튼을 클릭하시면 파일이 다운로드 됩니다.";
						
						common.setDownPopupExpaprInfo(ExPapr_Group, data.exPapr_Coretype, "");

						common.showDownloadLayer("RE_FILE", dataType, 1, ExPapr_No, "2", 0, down_popup_type, function() {
							ExamDownload_ReDown(ExPapr_No, '2', data.exDown_No, data.Auto_Seq);
						});
					} else {
						ExamDownload_ReDown(ExPapr_No, '2', data.exDown_No, data.Auto_Seq);
					}
				}
				else
				{
					if(data.Result == 0){	
						Token = data.File;
						autoSeq = data.Auto_Seq;
						INTERVAL_ID = window.setInterval(function(){
							loadingCnt++;
							_progress(Token, function(){
								comm.toggleProcessLoading(-1);

								if(ExPapr_Group == "V")
								{
									document.querySelector("[data-id=expected]").style.display = "";
								}
								else if(ExPapr_Group == "W")
								{
									document.querySelector("[data-id=ai_transform]").style.display = "";
								}
								else
								{
									document.querySelector("[data-id=main]").style.display = "";
								}
								
								document.querySelector("#goods_select").style.display = "none";
								Download_Layer(ExPapr_No, '2', Grade, Subj_Code, ExPapr_Group, data.exPapr_Coretype, autoSeq, exam_Index, SiteID);															
							});
						}, 500);
					}
					else{
						comm.toggleProcessLoading(-1);
					}
				}
				
			}
			else{
				comm.toggleProcessLoading(-1);
			}
		});
	}
	else
	{
		if (!fn_downCheck(ExPapr_No, "2", ExPapr_Group, Subj_Code, Grade, "", "", exam_Index)) {
			Download_Layer(ExPapr_No, "2", Grade, Subj_Code, ExPapr_Group, "");
			return;
		}
		else
		{
			var url_v = "/ZocboExam/AutoExam_Layer.asp";
			var data_v = "ExPapr_No=" + ExPapr_No + "&Part_ID_Set=" + part_ID_Set + "&reSubj_Code=" + Subj_Code + "&exam_Index=" + exam_Index + "&ExPapr_Group=" + ExPapr_Group;
			var Token = null;
			var autoSeq = "";										
			var loadingCnt = 0;

			comm.toggleProcessLoading(0);
			comm.send(url_v, data_v, "post", function(data) {
				if(data){
					if(data.Result == '99') {
						alert('선택 범위를 다시 확인해 주시기 바랍니다.');
						location.reload();
					} else {
						if(data.isRedownLastChk == '0')
						{
							//ExamDownload_ReDown(ExPapr_No, '2', data.exDown_No, data.Auto_Seq);
							comm.toggleProcessLoading(-1);

							//[바로보기]버튼 보여지는 조건 확인 common.showViewerBtnCheck 함수
							if (common.showViewerBtnCheck("VIEWER", "2")) {
								var dataType = {};
								var down_popup_type = "다운로드";
								var down_date = "30";//기본 재다운로드 기간
								var down_title = "일 이내 다운로드한 파일이므로<br><span class='f_blue'>별도 차감 없이 이용</span>이 가능합니다.";

								down_title = down_date + down_title;//재다운로드 일자 추가한 타이틀

								dataType.title = down_title;
								dataType.msg = "버튼을 클릭하시면 파일이 다운로드 됩니다.";
								
								common.setDownPopupExpaprInfo(ExPapr_Group, data.exPapr_Coretype, "");

								common.showDownloadLayer("RE_FILE", dataType, 1, ExPapr_No, "2", 0, down_popup_type, function() {
									ExamDownload_ReDown(ExPapr_No, '2', data.exDown_No, data.Auto_Seq);
								});
							} else {
								ExamDownload_ReDown(ExPapr_No, '2', data.exDown_No, data.Auto_Seq);
							}
						}
						else
						{
							if(data.Result == 0){
								Token = data.File;
								autoSeq = data.Auto_Seq;
								INTERVAL_ID = window.setInterval(function(){
									loadingCnt++;
									_progress(Token, function(){									
										comm.toggleProcessLoading(-1);
										Download_Layer(ExPapr_No, '2', Grade, Subj_Code, ExPapr_Group, data.exPapr_Coretype, autoSeq, exam_Index);															
									});
								}, 500);
							}
							else{
								comm.toggleProcessLoading(-1);
							}
						}
					}
				}
				else{
					comm.toggleProcessLoading(-1);
				}
			});
		}
	}
	
}

// 중등, 고등 파일 다운로드
function fn_examDownload(ExPapr_No, Exfl_Group, SiteID, ExPapr_Group, IsAutoExamDown, Subj_Code, Grade, exPapr_Coretype, IsMatchSvc) {
    _site_id_ = SiteID;
	if (typeof (ExPapr_Group) == 'undefined') ExPapr_Group = '';
	if (typeof (IsAutoExamDown) == 'undefined') IsAutoExamDown = false;
	if (typeof (Subj_Code) == 'undefined') Subj_Code = '';
	if (typeof (Grade) == 'undefined') Grade = '';
	if (typeof (exPapr_Coretype) == 'undefined') exPapr_Coretype = '';
	if (typeof (IsMatchSvc) == 'undefined') IsMatchSvc = 'main';

	var blnChk_History = true;
	var chk_result;

	_ExPapr_No = ExPapr_No;
	_Exfl_Group = Exfl_Group;		// Exfl_Group = 91인 경우 전역변수는 유지하고 Exfl_Group는 2로 변경. 미리보는 중간(기말)고사 해설집 다운로드 구분값
	_SiteID = SiteID;

	_IsMatchSvc = IsMatchSvc;  // 학교★맞춤 : MatchSvc, 기존 : ''

	/*
		1. 미리보는 중간(기말)고사인 경우 재다운로드 로직을 태우면서 구분값 91을 유지하여 마지막 파일 다운로드 시 예외처리 경로 변경 (2020.06.18, 정효태)
		2. Download() 에서 본래값인 91로 비교
	*/
	if(Exfl_Group == "91") {
		Exfl_Group = "2";
	}	

	// 권한 체크
	/*
		true : 다운 가능, 이외는 상황에 맞는 flag값
	*/
	if(_event_freedown == "Y") {		// 이벤트 무료 다운로드 (2020.09.14, 정효태)
		_downResultCode = "0";
		_downDiv = "R";
		_downCnt = "0";
		div_term = _downDiv;
		div_cnt = _downCnt;
	} else {
		if (!fn_downCheck(ExPapr_No, Exfl_Group, ExPapr_Group, Subj_Code, Grade, exPapr_Coretype) && ExPapr_Group != "V" && ExPapr_Group != "W") {
			// fn_checkMyDownInfo(ExPapr_No, Exfl_Group, Grade, Subj_code, Expapr_Group, Expapr_Coretype, _callback){
			if(window.location.href.toLowerCase().includes("/exam/school/") == true) {
				return;
			} else {
				Download_Layer(ExPapr_No, Exfl_Group, Grade, Subj_Code, ExPapr_Group, exPapr_Coretype);
				return;
			}
		} else {
			div_term = _downDiv;
			div_cnt = _downCnt;
		}
	}

	// 학교별 예상족보는 중등 과학,사회,역사/고등 수학,사회,국사,과학의 경우 최초 클릭시 무조건 AutoExam을 호출한다.
	if ((ExPapr_Group == 'V' || ExPapr_Group == 'W') && IsAutoExamDown == false) {
		ExamDownload_AutoExam(ExPapr_Group);
	} 
	else if (ExPapr_Group == "B" && exPapr_Coretype == "C")
	{
		ExamDownload_AutoExam_Preparation(ExPapr_No, "main", "preparation", SiteID, Subj_Code, Grade, "");
	}
	else {
		// 학평변형 다운로드 안내창 구분을 위한 분기
		if (SiteID == "H" && ExPapr_Group == "D" && exPapr_Coretype == "E") {
			if (blnChk_History) {
				chk_result = DownloadHistory_Check(ExPapr_No, Exfl_Group, SiteID);

				switch (chk_result) {
					case 2  : TransformExamDownload_Confirm(ExPapr_No, Exfl_Group, SiteID, 1);
							return;
							break;
					case 3  : return;
							break;
				}
			}

			TransformExamDownload_Confirm(ExPapr_No, Exfl_Group, SiteID, 2);
		} else {
			if (blnChk_History) {
				//_hLog(blnChk_History);
				chk_result = DownloadHistory_Check(ExPapr_No, Exfl_Group, SiteID);

				// (ExPapr_No, Exfl_Group, SiteID, flag, Grade, Subj_Code, Expapr_Group, Expapr_Coretype) {
				switch (chk_result) {
					case 2  : ExamDownload_Confirm(ExPapr_No, Exfl_Group, SiteID, 1, Grade, Subj_Code, ExPapr_Group, exPapr_Coretype);  //재 다운로드
							return;
							break;
					case 3  : return;
							break;
				}
			}
			
			ExamDownload_Confirm(ExPapr_No, Exfl_Group, SiteID, 2, Grade, Subj_Code, ExPapr_Group, exPapr_Coretype);
		}
	}
}

//. 맞춤 예상족보 전용 [챕터 선택을 건너뛰어야 하기때문에 별도로 생성..]
function fn_examDownload_match_autoexam(ExPapr_No, part, subj, SiteID, grade) {
    _site_id_ = SiteID;
	_ExPapr_No = ExPapr_No;
	_Exfl_Group = '2';
	_SiteID = SiteID;

	// 권한 체크
	if (fn_downCheck(ExPapr_No, '2', 'V', subj, grade, '')) {
		// 시험지 생성 요청
		var url_v = "/ZocboExam/AutoExam_p.asp";
		var data_v = "ExPapr_No=" + ExPapr_No + "&Part_ID_Set=" + part + "&reSubj_Code=" + subj;
		comm.toggleProcessLoading(0);
		comm.send(url_v, data_v, "post", function(data) {
			if(data){
				if(data.Result == 0){
					Token = data.File;
					INTERVAL_ID = window.setInterval(function(){
						//loadingCnt++; // 이거 어디서 씀니까?
						TokenProgress(Token, function(){
							comm.toggleProcessLoading(-1);
							if(fn_downCheck(ExPapr_No, '2', 'V', subj, grade, '')) {
								Download_Layer(ExPapr_No, '2', grade, subj, 'V', '');
								var dl_o = document.querySelector("#downloadLayer");
								var dlMsg_o = dl_o.querySelectorAll("#subMsg");
								var dlMsg_o1 = dl_o.querySelectorAll("#subMsg1");
								var dlMsg_o2 = dl_o.querySelectorAll(".subMsg2");
								$(dlMsg_o).show();
								$(dlMsg_o1).hide();
								$(dlMsg_o2).show();
							}
						});
					}, 500);
				}
				else{
					comm.toggleProcessLoading(-1);
				}
			}
			else{
				comm.toggleProcessLoading(-1);
			}
		});
	}
	else {
		Download_Layer(ExPapr_No, '2', grade, subj, 'V', '');
		return;
	}
}

// pdf 생성 진행상황 표시 (chapterSelector.js 에 _progress 함수와 동일 복붙)
function TokenProgress(Token, _function) {
	$.ajax({
		url: "/Common/System/Token_hs.asp?Token=" + Token + "&Idx=" +  Math.random(),
		method: "get",
		asynchronous: false,
		contentType: 'application/x-www-form-urlencoded',
		encoding: 'UTF-8',
		dataType: "xml",
		complete: function(Request){

			if(Request.status == 200) {
				if(Request.responseXML) {
					var Doc = Request.responseXML.documentElement;
					var _Percent = Doc.getElementsByTagName('Percent')[0].firstChild.nodeValue;
					var _Status = Doc.getElementsByTagName('Status')[0].firstChild.nodeValue;

					// _Status : 100 = 정상, 000 = 문제 없음
					if ( _Status != '' )
					{
						Start = true;
					}

					if (Start == true && _Percent == 100) {
						clearInterval(INTERVAL_ID);
						if(typeof(_function) == "function"){
							_function();
						}
						return;
					}

					// 문제를 찾기 못 한다면
					if (_Status == '000') {
						common.alert('알림','해당 범위의 문제가 조회가 되질 않습니다.', null, {});
						clearInterval(INTERVAL_ID);
						return;
					}
					else{
						comm.toggleProcessLoading(_Percent);
					}

					// switch (_Status)
					// {
					//     case "100" :
					//         Status.innerHTML = "해당 학교의 시험 경향에 맞는 문제를입력하신 범위에<br />맞게 추출 중입니다.";
					//         break;
					//     case "200" :
					//         Status_Title.innerHTML ="문제 정렬 중";
					//         Status.innerHTML = "추출한 문제를 단원 순서에 맞게 정렬하고 있습니다.";
					//         break;
					//     case "300" :
					//         Status_Title.innerHTML ="문제 변환 중";
					//         Status.innerHTML = "문제와 정답 및 해설을 PDF로 변환하여 저장하고 있습니다.<br />변환이 완료되면 파일을 즉시 다운 받으실 수 있습니다. ";
					//         break;
					//     case "400" :
					//         Status.innerHTML = "시험지 다운로드를 준비중입니다.";
					//         break;
					//     case "000" :
					//         Status.innerHTML = "해당 범위의 문제가 조회가 되질 않습니다.";
					//         clearInterval(INTERVAL_ID);
					//         break;
					// }
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


/******* newfrom
jQuery(function() {
    if (jQuery(window).height() == jQuery(window.parent).height()) {
        var htm = "<link rel=\"stylesheet\" type=\"text/css\" href=\"/Common/Css/PopUpLayer.css\" />"
        + "<script type=\"text/javascript\" src=\"/Common/js/PopUpLayer.js\"></script>"
        + "<div id=\"mask\"></div>"
        + "<div id=\"levelTest\" class=\"modalwindow game\" style=\"display:none\">"
        + "    <div id=\"gameplayer\"></div>"
        + "</div>"
        jQuery('body').append(htm);
    }
});
***/


function downloadLayerInUserTrk () {
	jQuery.ajax({
		type : "GET",
		dataType:'json',
		url : "/_api/event.api.asp?cmd=DOWNLOAD_LAYER_IN_USER_TRK",
		success: function(responseJson) {
			if (responseJson.result == true) {
				trkCLS.setExternalEvent(responseJson.SHARE_EVENT_ACTION_CD, "");
			}
		},error: function(request, exception) {
			return false;
		}
	});
}

//뷰어앱 내 다운로드/바로보기 버튼 액션 함수
/*
	- actType : 액션타입 -> NOAUTH(권한없음), DOWN(다운로드가능), REDOWN(재다운로드)
	- execType : 실행타입 -> DOWN(파일다운로드), VIEW(바로보기)
	- ExPapr_No : 시험지번호
	- Exfl_Group : 파일유형 -> 2(PDF), 4(HWP)
	- SiteID : E, M, H
	- link : 앱에서 브라우저 연결 링크 -> appCLS.goInOutLink({"action" : "goToBrowser", "url" : link}); 에서 이용
	- selector : 팝업에서 호출시 해당 팝업 선택자 넘겨줄때 사용
*/
function appDownloadAction(actType, execType, ExPapr_No, Exfl_Group, SiteID, link, selector) {
	if (typeof (selector) == 'undefined') selector = null;
	
	ExPapr_No = ExPapr_No.toString();//app에서 변수 받을 때 String타입으로 변환이 필요해서 추가

	_DeviceType = "A"; //디바이스 타입 A(App)
	_ExPapr_No = ExPapr_No;
	_Exfl_Group = Exfl_Group;		// Exfl_Group = 91인 경우 전역변수는 유지하고 Exfl_Group는 2로 변경. 미리보는 중간(기말)고사 해설집 다운로드 구분값
	_SiteID = SiteID;

	if (actType == "NOAUTH") {//다운로드 권한 없을 경우
		appCLS.goInOutLink({"action" : "goToBrowser", "url" : link});
	} else if (actType == "REDOWN") {//재다운로드인 경우
		download_app(execType, selector, ExPapr_No, Exfl_Group, 0, "", "");
	} else {//다운로드 권한 있을 경우 actType : DOWN
		download_app(execType, selector, ExPapr_No, Exfl_Group, 1, "", "");
	}
}

function appDownloadAction_autoexam(actType, execType, ExPapr_No, Exfl_Group, SiteID, link, selector, Auto_Down_Seq, exam_Index) {
	if (typeof (selector) == 'undefined') selector = null;
	
	ExPapr_No = ExPapr_No.toString();//app에서 변수 받을 때 String타입으로 변환이 필요해서 추가

	_DeviceType = "A"; //디바이스 타입 A(App)
	_ExPapr_No = ExPapr_No;
	_Exfl_Group = Exfl_Group;		// Exfl_Group = 91인 경우 전역변수는 유지하고 Exfl_Group는 2로 변경. 미리보는 중간(기말)고사 해설집 다운로드 구분값
	_SiteID = SiteID;

	if (actType == "NOAUTH") {//다운로드 권한 없을 경우
		appCLS.goInOutLink({"action" : "goToBrowser", "url" : link});
	} else if (actType == "REDOWN_AUTOEXAM") {
		download_app(execType, selector, ExPapr_No, Exfl_Group, 0, "", Auto_Down_Seq, exam_Index);
	} else if (actType == "DOWN_AUTOEXAM") {
		download_app(execType, selector, ExPapr_No, Exfl_Group, 1, "", Auto_Down_Seq, exam_Index);
	} 
}