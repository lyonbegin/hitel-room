
var kakao_config = {
    "자바스크립트키" : "cfe257b483ecb570c9dc517597805732",
    "기본타이틀" : "중·고등 내신 대비, 족보닷컴이 답입니다!",
    "기본설명" : "#학교별기출문제 #AI기출변형문제\n확실한 실력 차이를 직접 경험해 보세요!",
    "기본이미지경로" : "https://d153j14wegj4v5.cloudfront.net/images/pc/common/zocbo_noticetalk1.png",
    "기본모바일경로" : "https://m.zocbo.com",
    "기본PC경로" : "https://www.zocbo.com",
	"기본하단링크버튼명" : "맟춤 학습 자료 확인하기",
};

var kakaoCLS = {
    init : function (title, description, imageUrl, mobileWebUrl, webUrl, bottomBtnTxt, templateType) {
		/*
			title = 발송 된 카카오톡 메세지 내 제목
			description = 발송 된 카카오톡 메세지 내 내용 --> 2줄까지 가능
			imageUrl = 발송 된 카카오톡 메세지 내 상단 이미지 경로
			mobileWebUrl = 발송 된 카카오톡 메세지 내 모바일 이동 URL
			webUrl = 발송 된 카카오톡 메세지 내 PC 이동 URL
			bottom = 발송 된 카카오톡 메세지 내 하단 링크 버튼명
		*/

        if (isValueEmpty(title) == true) title = kakao_config.기본타이틀;
        if (isValueEmpty(description) == true) description = kakao_config.기본설명;
        if (isValueEmpty(imageUrl) == true) imageUrl = kakao_config.기본이미지경로;
        if (isValueEmpty(mobileWebUrl) == true) mobileWebUrl = kakao_config.기본모바일경로;
        if (isValueEmpty(webUrl) == true) webUrl = kakao_config.기본PC경로;
		if (isValueEmpty(bottomBtnTxt) == true) webUrl = kakao_config.기본하단링크버튼명;		

		if(!Kakao.isInitialized()) {
			Kakao.init(kakao_config.자바스크립트키);
		}

		if(templateType == 'feed') {
			if(mobileWebUrl.toLowerCase().includes("/event/luckydraw0708/") || mobileWebUrl.toLowerCase().includes("/event/luckydraw_s25/")) {
				Kakao.Share.sendDefault({
					objectType: 'feed',
					content: {
						title: title,
						description: description,
						imageUrl: imageUrl,
						imageWidth: 400,
						imageHeight: 200,
						link: {
							mobileWebUrl: mobileWebUrl,
							webUrl: webUrl,
						},
					},
					buttons: [
						{
							title: bottomBtnTxt,
							link: {
								mobileWebUrl: mobileWebUrl,
								webUrl: webUrl,
							},
						}
					],
				});
			} else {
				Kakao.Share.sendDefault({
					objectType: 'feed',
					content: {
						title: title,
						description: description,
						imageUrl: imageUrl,
						link: {
							mobileWebUrl: mobileWebUrl,
							webUrl: webUrl,
						},
					},
					buttons: [
						{
							title: bottomBtnTxt,
							link: {
								mobileWebUrl: mobileWebUrl,
								webUrl: webUrl,
							},
						}
					],
				});
			}
		} else if(templateType == 'text') {
			Kakao.Share.sendDefault({
				objectType: 'text',
				text: title + description,
				link: {
					mobileWebUrl: mobileWebUrl,
					webUrl: webUrl,
				},
				buttons: [
					{
						title: bottomBtnTxt,
						link: {
							mobileWebUrl: mobileWebUrl,
							webUrl: webUrl,
						},
					}
				],
			});
		}
    }
};