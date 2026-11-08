var comm = {
	loading:false,		// ajax 통신 요청중이면 true.
	_fn:null,			//
	timeout:60,			// timeout 시간 설정

	init:function() {

	},

	// Http의 헤더 정보를 가져온다? 그런데 헤더를 변수로 받음.
	parseHeader:function(header, key){
	   var arr = header.split('\n');
	   var pair = {};
	   var retVal = "";
	   for(var i = 0; i < arr.length - 1; i++){
			 pair = arr[i].split(':');
			 if(pair.length != 2){
				continue;
			 }
			 if(pair[0] == key) {
				return pair[1].substring(0, pair[1].length-1);
			 }
			 switch(pair[0]){

				 case "cookie" :
						retVal = pair[1].substring(0, pair[1].length-1);
						break;

				 default:
						break;
			 }
			 if (retVal!="") return retVal;
	   }
	   return retVal;
	},

	// ajax 통신
	send:function(url, data, method, callback) {
		if(comm.loading) {	// 현재 ajax 처리중이면 대기했다가 다시 처리되게 처리.
			window.setTimeout(function() {
				comm.send(url, data, method, callback);
			}, 100);
			return;
		}

		comm._fn = callback;

		// Header 정보 추가시 작성할 것.
		var header = {};

		comm.loading = true;
		// comm.toggleLoading(true);
		var jqxhr = $.ajax({
			url : url,
			type:method,
			timeout:1000 * comm.timeout,		// 타임아웃 시간 설정
			contentType: 'application/x-www-form-urlencoded; charset=UTF-8',
			//async : false,		// 비동기에서 동기로 변경 (아이폰에서 미리보는 중간고사 파일 다운로드 후 버튼 렌더링이 정상적으로 동작 안함. 2020.06.23, 정효태)
			data : data,
			headers: header,
			complete:function(rdata) {
				// comm.toggleLoading(false);
				if(rdata.readyState == 4 && rdata.status == "200") {
					var json = "";
					try {
						json = eval("(" + rdata.responseText + ")");
					} catch (e) {
						var rst = {"errMsg":"통신상에 에러가 발생하였습니다", "retCode":"991"};
						comm.resp(rst);
					}
					comm.resp(json);
				}
				else {
					var rst = {"errMsg":"통신상에 에러가 발생하였습니다", "retCode":"997"};
					comm.resp(rst);
				}

				if ($(".list-loader").hasClass("is-active")) {
					$(".list-loader").removeClass("is-active");
				}
			},
			error:function(er) {
				// comm.toggleLoading(false);
				if(er.status != "406" && er.status != "200") {	// 기타 에러에 대한 처리
					var rst = {"errMsg":"통신상에 에러가 발생하였습니다", "retCode":"997"};
					comm.resp(rst);
				}

				if ($(".list-loader").hasClass("is-active")) {
					$(".list-loader").removeClass("is-active");
				}
			}
		});
	},

	// 로딩 이미지 표시(true:표시 카운트 증가, false:표시 카운트 감소)
	loadingCount:0,
	loadingTmr:null,
	toggleLoading:function(fg) {
		// _hLog("comm.loadingCount=" + comm.loadingCount);
		var loading_o = document.querySelector("#loading1");
		if(loading_o) {
			if(fg) {
				comm.loadingCount++;
				if(comm.loadingCount == 1) {
					loading_o.style.display = "";
					comm.loadingTmr = window.setTimeout(function() {
						if(comm.loadingTmr) {
							window.clearTimeout(comm.loadingTmr);
							comm.loadingTmr = null;
						}
						comm.toggleLoading(false);
					}, 1000 * 30);
				}
			}
			else {
				comm.loadingCount--;
				if(comm.loadingCount <= 0) {
					if(comm.loadingTmr) {
						window.clearTimeout(comm.loadingTmr);
						comm.loadingTmr = null;
					}
					loading_o.style.display = "none";
					comm.loadingCount = 0;
				}
			}
		}
	},

	// 로딩 진행률 이미지 표시(0 ~ 100 이면 표시, 그 외는 미표시)
	toggleProcessLoading:function(percentNum) {
		var loading_o = document.querySelector("#loading2");
		if(loading_o){
			var c100_o = loading_o.querySelector(".c100");
			if(c100_o){
				var percent_o = c100_o.querySelector(".percent");
				if(percentNum == null){
					percentNum = 0;
				}
				if(-1 < percentNum && percentNum < 101){
					$(c100_o).removeClass();
					$(c100_o).addClass("c100 pos-fixed p" + percentNum);
					percent_o.innerHTML = percentNum + "%";
					loading_o.style.display = "";
				}
				else{
					loading_o.style.display = "none";
				}
			}
		}
	},

	resp:function(json) {
		comm.loading = false;

		if(typeof(json) != "object") return;	// json 데이타 체크
		if(typeof(comm._fn) == "function") comm._fn(json);
		else {
			_hLog("Callback is not function!");
		}
	},
};


comm.init();
