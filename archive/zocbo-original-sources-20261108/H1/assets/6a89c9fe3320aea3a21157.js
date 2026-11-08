var skytabCLS = {
    insertCoupon : function (){
        _rtnUrl = isValueEmpty(_rtnUrl) == false ? _rtnUrl : "/";
        if (TRK_GLB_IS_LOGIN == false) {
            loginPop.show("", _rtnUrl, true);
            return false;
        }

        if (TRK_GLB_MEM_GROUP == "A") {
            alert('해당 서비스는 족보닷컴 정회원만 이용 가능합니다!');
            return false;
        }

        jQuery.ajax({
            type : "GET",
            dataType:'json',
            url : "/skytab/ajax/insertCouponAjax.asp",
            success: function(responseJson) {
                if (responseJson.RESULT == "false") {
                    switch (Number(responseJson.RESULT_CODE)) {
                        case SKYTAB_RESULT_CODE.미로그인:
                            loginPop.show("", _rtnUrl, true);
                            break;
                        case SKYTAB_RESULT_CODE.유효기간남은쿠폰있음:
                        case SKYTAB_RESULT_CODE.유효기간남은무료이용권있음:
                            alert("이미 발급된 무료체험 이용권이 있습니다.\n 확인 클릭 시 마이페이지로 이동합니다.");
                            location.href = "/MyPage/myItem_Skytab.asp?type=F";
                            break;
                        case SKYTAB_RESULT_CODE.쿠폰지급내역있음:
                        case SKYTAB_RESULT_CODE.무료이용권내역있음:
                            alert("체험수업을 진행한 이력이 있습니다.\n 확인 클릭 시 스카이탭 상담채널로 연결됩니다.");
                            window.open('https://42y0w.channel.io/support-bots/92763');
                            break;
                        default:
                            alert("발급과장에서 오류가 발생하였습니다. 다시 시도해주세요.");
                            location.reload();
                            break;
                    }
                } else {
                    alert("스카이탭 무료 체험 이용권이 지급되었습니다.\n 확인 클릭시 무료이용권 등록 페이지로 이동합니다.");
                    location.href = "/MyPage/myItem_Skytab.asp?type=F";
                }
            } ,error: function(request, exception) {
                console.log("exception");
                return false;
            }
        });
    }
};

SKYTAB_RESULT_CODE = {
    "미로그인" : -1,
    "유효기간남은쿠폰있음" : -2,
    "유효기간남은무료이용권있음" : -3,
    "쿠폰지급내역있음" : -4,
    "무료이용권내역있음" : -5,
    "쿠폰등록실패" : -6,
    "알림톡오류" : -7,
}