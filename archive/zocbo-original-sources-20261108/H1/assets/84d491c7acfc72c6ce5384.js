$(document).ready(function(){
	//맴버타입 토글 이벤트
//	$(".selcet-toggle").click(function (){
//		$(".header-member-type-box").toggle();
//	});

	//맴버타입 토글 이벤트
	$(".header-selectd").click(function (){
		$(".header-select-list").toggle();
	});

	//var cookie_toggle_val = "<%=toggle_Group%>";
	var cookie_toggle_val = "C"
	if ($("div.header-mo-selector .header-selectd.active").attr("id")){
		cookie_toggle_val = ($("div.header-mo-selector .header-selectd.active").attr("id").toUpperCase() == "BTN_TOGGLE_T") ? "T" : "C";
	}
	var toggle_Group_Val;

	// 학생 선생 선택 버튼
	$('.header-select-list a').on('click', function(e){
		var btn_Group_Val = "";		
		var btn_Group_txt = "";

		if(e.target.id == "btn_toggle_T")
		{
			btn_Group_Val = "T";
			btn_Group_txt = "선생님";
		}
		else
		{
			btn_Group_Val = "C";
			btn_Group_txt = "학생";
		}

		if(cookie_toggle_val != btn_Group_Val)
		{
			toggle_Group_Val = btn_Group_Val;
			// 1 : 토글 Data Log 적재
			fetch("/Include/ajax/toggle_action_log_insert_ajax.asp?log_type=1&current_page="+window.location.pathname+"&from_toggle="+cookie_toggle_val+"&to_toggle="+btn_Group_Val);							
			// End

			//if(confirm(btn_Group_txt + " 회원 전용 페이지로 이동됩니다.\n계속 진행하시겠습니까?"))
			//{
				$.ajax(
				{
					url: '/Include/ajax/toggleGroup_update_ajax.asp',
					data: 
					{
						set_toggle_Group : toggle_Group_Val
					},
					error: function(request, status, error)
					{
						alert('code:' + request.status + '\n' + 'message:' + request.responseText + '\n' + 'error:' + error);
					},
					success: function(data)
					{
						location.replace("/");
					}
				});
			//}
		}
	});
})