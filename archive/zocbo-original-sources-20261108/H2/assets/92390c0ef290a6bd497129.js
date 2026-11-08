var previous_analysis = function() {
	var g_subj_code = "";
	var g_site_id = "";
	var g_course_name = "";
	var g_obj_json = "";
	var g_chart_type = "";
	var g_arr_exception_subj_code = ['MT', 'SC', 'LS'];

	//var g_convert_data = new Array();
	//var g_convert_bar_data = new Array();
	var g_convert_data = null;
	var g_convert_bar_data = null;

	// table title
	var _table_title_data = {
		"single":{
			"MT":{
					"B":{"title1":"중단원","title2":"소단원","qcnt":"문항수","publish":"출처"},
					"C":{"no":"문제번호","type":"문제유형","text1":"소단원","text2":"유형","level":"난이도","publish":"출처"},
					"D":{"no":"문제번호","type":"문제유형","text1":"소단원","text2":"유형","level":"난이도","publish":"출처"
				}
			},
			"SC":{
					"B":{"title1":"중단원","title2":"소단원","qcnt":"문항수","publish":"출처"},
					"C":{"no":"문제번호","type":"문제유형","text1":"소단원","text2":"유형","level":"난이도","publish":"출처"},
					"D":{"no":"문제번호","type":"문제유형","text1":"소단원","text2":"유형","level":"난이도","publish":"출처"}
				},
			"KR":{
					"B":{"title1":"대단원","title2":"중단원","qcnt":"문항수","publish":"출처"},
					"C":{"no":"문제번호","type":"문제유형","text1":"중단원","text2":"유형","level":"난이도","publish":"출처"},
					"D":{"no":"문제번호","type":"문제유형","text1":"중단원","text2":"유형","level":"난이도","publish":"출처"}
			},
			"EG":{
				"B":{"title1":"대단원","title2":"중단원","qcnt":"문항수","publish":"출처"},
				"C":{"no":"문제번호","type":"문제유형","text1":"대단원","text2":"유형","level":"난이도","publish":"출처"},
				"D":{"no":"문제번호","type":"문제유형","text1":"대단원","text2":"유형","level":"난이도","publish":"출처"}
			},
			"LS":{
				"B":{"title1":"1대단원","title2":"중단원","qcnt":"문항수","publish":"출처"},
				"C":{"no":"문제번호","type":"문제유형","text1":"중단원","text2":"유형","level":"난이도","publish":"출처"},
				"D":{"no":"문제번호","type":"문제유형","text1":"중단원","text2":"유형","level":"난이도","publish":"출처"}
			},
			"HI":{
				"B":{"title1":"대단원","title2":"중단원","qcnt":"문항수","publish":"출처"},
				"C":{"no":"문제번호","type":"문제유형","text1":"중단원","text2":"유형","level":"난이도","publish":"출처"},
				"D":{"no":"문제번호","type":"문제유형","text1":"중단원","text2":"유형","level":"난이도","publish":"출처"}
			}
		},
		"multi":{
			"KR":{
				"B":{"title1":"구분","title2":"중단원/부교재","qcnt":"문항수","publish":"출처"},
				"C":{"no":"문제번호","type":"문제유형","text1":"중단원/출처","text2":"유형/작품","level":"난이도","publish":"구분",},
				"D":{"no":"문제번호","type":"문제유형","text1":"중단원/출처","text2":"유형","level":"난이도","publish":"구분",}
			},
			"EG":{
				"B":{"title1":"구분","title2":"대단원/부교재","qcnt":"문항수","publish":"출처"},
				"C":{"no":"문제번호","type":"문제유형","text1":"대단원/출처","text2":"유형/문제번호","level":"난이도","publish":"구분"},
				"D":{"no":"문제번호","type":"문제유형","text1":"대단원/출처","text2":"유형","level":"난이도","publish":"구분"}
			},
			"LS":{
				"B":{"title1":"구분","title2":"중단원/부교재","qcnt":"문항수","publish":"출처"},
				"C":{"no":"문제번호","type":"문제유형","text1":"중단원/출처","text2":"유형/문제번호","level":"난이도","publish":"구분",},
				"D":{"no":"문제번호","type":"문제유형","text1":"중단원/출처","text2":"유형","level":"난이도","publish":"구분",}
			},
			"HI":{
				"B":{"title1":"구분","title2":"중단원/부교재","qcnt":"문항수","publish":"출처"},
				"C":{"no":"문제번호","type":"문제유형","text1":"중단원/출처","text2":"유형/문제번호","level":"난이도","publish":"구분",},
				"D":{"no":"문제번호","type":"문제유형","text1":"중단원/출처","text2":"유형","level":"난이도","publish":"구분",}
			},
			"SC":{
				"B":{"title1":"구분","title2":"중단원/부교재","qcnt":"문항수","publish":"출처"},
				"C":{"no":"문제번호","type":"문제유형","text1":"중단원/출처","text2":"유형/문제번호","level":"난이도","publish":"구분",},
				"D":{"no":"문제번호","type":"문제유형","text1":"중단원/출처","text2":"유형","level":"난이도","publish":"구분",}
			},
			"MT":{
				"B":{"title1":"구분","title2":"중단원/부교재","qcnt":"문항수","publish":"출처"},
				"C":{"no":"문제번호","type":"문제유형","text1":"중단원/출처","text2":"유형/문제번호","level":"난이도","publish":"구분",},
				"D":{"no":"문제번호","type":"문제유형","text1":"중단원/출처","text2":"유형","level":"난이도","publish":"구분",}
			}
		}
	}

	// parameter 체크
	var _isUndefined = function(obj) {
		return typeof(obj) != "undefined" ? true : false;
	}

	// byte 계산하여 글 줄임 처리 (A영역 사용)
	var _get_ellipsis = function(str, max) {
		var byte = 0;
		var result = "";
		for (var i=0; i<str.length; ++i) {
			(str.charCodeAt(i) > 127) ? byte += 2 : byte++ ;
			if (byte <= max) {
				result += str[i];
			}
		}

		return result + ((byte > max) ? "..." : "");
	}

	// rowspan 처리
	var make_rowspan = function(name) {
		$("."+name).each(function() {
			var rows = $("."+name+":contains('" + $(this).text() + "')");
			if (rows.length > 1) {
				rows.eq(0).attr("rowspan", rows.length);
				rows.not(":eq(0)").remove();
			}
		});
	}

    //var _init = function(scl_id, subj_code, exam_year, term) {
	var _init = function(expapr_no, tx_code, siteid, grade) {
		// 초기화
		g_convert_data = new Array();
		g_convert_bar_data = new Array();

		$(".d_header").hide();

		// B chart 높이 고정
		$("#b1_chart").css("height", "320px");
		$("#b2_chart").css("height", "400px");

		/*
        $.getScript("/js/previous/" + scl_id.toString() + "_" + exam_year.toString() + "_" + term.toString() + ".js", function (data, textStatus, jqxhr ) {
            if(jqxhr.status == 200) {
				g_subj_code = subj_code;
                g_obj_json = eval(subj_code.toLowerCase()+"_data");
                _start();
            }
        });
		*/
		/* 2) 기출분석 팝업 API 호출 */
		var api_data = {
			"cmd": "GICHUL_POPUP",
			"expapr_no": expapr_no,
			"tx_code": tx_code
		};

		var api_url = "/_api/common.api.asp?";
		api_url += Object.keys(api_data)
					.map(k => encodeURIComponent(k) + '=' + encodeURIComponent(api_data[k]))
					.join('&');

		//console.log(api_url);
		fetch(api_url)
		.then((res) => res.arrayBuffer())
		.then((data) => {
				//{"header":"대송중학교","period":"2022년 1학기 기말고사 국사","subj_code":"HI","chart_type":"single","chart_data":[{"name":"교과서","data":[]}],"list_data":[]}
				var decoder = new TextDecoder("utf-8");
				var data = decoder.decode(data);
				obj_json = JSON.parse(data);

				if(obj_json.result == "-99") {
					common.alert("알림", "로그인이 필요한 서비스 입니다.", null, function() { $("#block_previous_analysis").removeClass("active"); });
				} else if(obj_json.result == "error") {
					common.alert("알림", "API 호출이 잘못되었습니다.", null, function() { $("#block_previous_analysis").removeClass("active"); });
				} else {
					//if(obj_json.data[0].list_data.length > 0) {
					if(obj_json.result == "Y") {
						//g_obj_json = obj_json.data[0];
						g_obj_json = obj_json;
						g_subj_code = g_obj_json.subj_code;
						g_site_id = g_obj_json.site_id;
						g_course_name = g_obj_json.course_name;

						// siteid, grade, cities, district 변수 추가
						g_obj_json.grade = grade;
						g_obj_json.cities = obj_json.cities;
						g_obj_json.district = obj_json.district;
						g_obj_json.subj_name = obj_json.subj_name;

						$("#block_previous_analysis").show();
						_start();
						//_draw_template();
					} else {
						//common.alert("알림", "아직 서비스가 지원되지 않습니다.", null, function() { $("#block_previous_analysis").removeClass("active"); });
						common.alert("알림", "해당 학교는 기출분석을 제공하지 않습니다.", null, function() { $("#block_previous_analysis").removeClass("active"); });
					}
				}
			}
		)
		.catch((error) => {
				//console.log("error : ", error);
				common.alert("알림", "API 호출이 잘못되었습니다.", null, function() { $("#block_previous_analysis").removeClass("active"); });
			}
		)
    }

	// pick summary
	var _g_pick_data = {
		"M": {
			"KR":[
				{"pick": "<span>[단원별]</span> 콘텐츠로 각 단원의 중요한 유형을 모두 마스터하여 놓치는 문항 없이 시험 대비!"},
				{"pick": "<span>[고난도]</span> 해당 단원의 변별력 높은 문제를 학습하여 고득점 도전!"}
			],
			"EG":[
				{"pick": "<span>[단원별]</span> 콘텐츠로 시험범위에서 출제될 수 있는 최대한 다양한 유형의 문제들을 접해보는 것이 중요"},
				{"pick": "<span>[문법족보]</span> 시험범위 내에서 출제될 수 있는 빈출 어법들을 최대한 많이 학습하는 것이 중요!"}
			],
			"MT":[
				{"pick": "<span>[PRO]</span><span>[교과서 변형(기본)]</span> 문제로 교과서 수준의 문항을 꼼꼼히 학습하기!"},
				{"pick": "<span>[고난도]</span> 문제로 난이도 높은 복합 유형에 대해 완벽 대비!"}
			],
			"SC":[
				{"pick": "<span>[최다오답]</span> 문제로 틀리기 쉬운 문제 유형에 대비하며 고득점 공략!!"},
				{"pick": "<span>[기출유사]</span> 콘텐츠로 유사유형 학습 및 난이도별 취약 유형  완벽 대비!"}
			],
			"LS":[
				{"pick": "<span>[단원별 기본]</span> 콘텐츠로 시험범위에서 출제될 수 있는 최대한 다양한 유형의 문제들을 접해보는 것이 중요!"},
				{"pick": "<span>[최다오답]</span> 문제로 틀리기 쉬운 문제 유형에 대비하며 고득점 공략!!"}
			],
			"HI":[
				{"pick": "<span>[단원별 기본]</span> 콘텐츠로 시험범위에서 출제될 수 있는 최대한 다양한 유형의 문제들을 접해보는 것이 중요!"},
				{"pick": "<span>[최다오답]</span> 문제로 틀리기 쉬운 문제 유형에 대비하며 고득점 공략!!"}
			]
		},
		"H": {
			"KR": {
				"국어":[
					{"pick": "<span>[단원별]</span> 콘텐츠로 각 단원의 중요한 유형을 모두 마스터하여 놓치는 문항 없이 시험 대비!"},
					{"pick": "<span>[고난도]</span> 해당 단원의 변별력 높은 문제를 학습하여 고득점 도전!  "}
				],
				"문학":[
					{"pick": "<span>[PRO]</span><span>[시대별 문학]</span> 으로 작품의 배경이 되는 시대와 문학사를 참고하여 깊이 있게 작품을 이해할 것!"},
					{"pick": "<span>[수프링]</span><span>[학력평가 변형문제]</span> 콘텐츠로 모의고사의 다양한 변형문제를 접해보고 이해도를 높이자!"}
				],
				"언어와매체":[
					{"pick": "<span>[단원별]</span> 콘텐츠로 다양한 난이도와 문제로 기본 실력을 다지기!"},
					{"pick": "<span>[수프링]</span><span>[학력평가 변형문제]</span> 콘텐츠로 모의고사의 다양한 변형문제를 접해보고 이해도를 높이자!"}
				],
				"독서":[
					{"pick": "<span>[단원별]</span> 콘텐츠로 각 단원의 중요한 유형을 모두 마스터하여 놓치는 문항 없이 시험 대비!"},
					{"pick": "<span>[수프링]</span><span>[학력평가 변형문제]</span> 콘텐츠로 모의고사의 다양한 변형문제를 접해보고 이해도를 높이자!"}
				]
			},
			"EG":[
				{"pick": "<span>[최다빈출]</span> 콘텐츠로 자주 출제되는 유형을 확실히 파악하기!"},
				{"pick": "<span>[수프링]</span><span>[학력평가 변형문제]</span> 콘텐츠로 모의고사 지문의 다양한 변형문제를 접해보고 이해도를 높이자!"}
			],
			"MT":[
				{"pick": "<span>[단원별]</span> 콘텐츠로 각 단원의 중요한 유형을 모두 마스터하여 놓치는 문항 없이 시험 대비!"},
				{"pick": "<span>[고난도]</span> 문제로 난이도 높은 복합 유형에 대해 완벽 대비!!"}
			],
			"SC":[
				{"pick": "<span>[단원별 심화]</span> 문제로 자료 분석 및 응용 문제를 철저히 대비!"},
				{"pick": "<span>[기출유사]</span> 콘텐츠로 유사유형 학습 및 난이도별 취약 유형  완벽 대비!"}
			],
			"LS":[
				{"pick": "<span>[단원별 기본]</span> 문제로 다양한 응용 문제를 풀어보며 개념 문제 정확히 학습!"},
				{"pick": "<span>[최다오답]</span> 문제로 틀리기 쉬운 문제 유형에 대비하며 고득점 공략!!"}
			]
		}
	}

	var _start = function() {
		g_chart_type = g_obj_json.chart_type;       // single, multi

		_header_title_check();

		_pick_draw();
		_amChart_draw();
        _question_weight_draw();
        _list_type1_draw();

		//_list_type2_draw_check();
        //_summary_draw_check("summary_1", g_obj_json.summary_1);		// 족보Pick
        //_summary_draw_check("summary_2", g_obj_json.summary_2);
    }

	var _header_title_check = function() {
		header = g_obj_json.header;
		header = header + ((g_obj_json.cities != "" && g_obj_json.district != "") ? "(" + g_obj_json.cities + " " + g_obj_json.district + ")" : "");
		header = header + ((g_obj_json.subj_name != "") ? "<br/>" + g_obj_json.subj_name + " 종합분석" : "");
    	period = g_obj_json.period;

		$("#header_period").empty().html(period.substring(0, 12));
		$("#header_grade").empty().html( ((g_site_id == "M") ? "중" : "고") + g_obj_json.grade );
		$("#header_title").empty().html(header);

		// 단일 DB용
		if(_isUndefined(g_obj_json.chart_data)) {
			g_obj_json.chart_data.forEach(function(item, index) {
				main_item = item.name;

				// convert for horizon bar
				var tmp_bar_data = new Object();
				var tmp_total = 0;
				var l_index = index;		// 서브 카테고리에서 사용할 메인 index 값 (영어파트의 경우 예외처리가 필요하여)

				// horizon xy chart group 사용
				tmp_bar_data.label = main_item;
				//tmp_bar_data.start = item.data[0].name;
				//tmp_bar_data.end = item.data[item.data.length-1].name;
				tmp_bar_data.start = (g_subj_code == "EG") ? item.data[0].name + '_(' + l_index + ')' : item.data[0].name;
				tmp_bar_data.end = (g_subj_code == "EG") ? item.data[item.data.length-1].name + '_(' + l_index + ')' : item.data[item.data.length-1].name;

				// eg전용 pie 겸용
				item.data.forEach(function(item, index) {
					tmp_total += (_isUndefined(item.total) ? parseInt(item.total) : 0);
				});
				tmp_bar_data.sub_category = main_item;
				//tmp_bar_data.cnt = tmp_total;
				tmp_bar_data.total = tmp_total;
				g_convert_bar_data.push(tmp_bar_data);
				// E : eg전용 pie 겸용

				// convert for chart
				item.data.forEach(function(item, s_index) {
					var tmp_data = new Object();
					var m_cnt = 0;
					var s_cnt = 0;
					var d_cnt = 0;

					tmp_data.main_category = main_item;
					//tmp_data.sub_category = item.name;
					tmp_data.sub_category = (g_subj_code == "EG") ? item.name + '_(' + l_index + ')' : item.name;

					if(_isUndefined(item.chart_group_name)) {
						tmp_data.group_category = item.chart_group_name;
					}

					if(_isUndefined(item.from)) {
						tmp_data.from = item.from;
					}

					//tmp_data.cnt = item.q_cnt;
					m_cnt = _isUndefined(item.m_cnt) ? parseInt(item.m_cnt) : 0;
					s_cnt = _isUndefined(item.s_cnt) ? parseInt(item.s_cnt) : 0;
					d_cnt = _isUndefined(item.d_cnt) ? parseInt(item.d_cnt) : 0;

					//tmp_data.total = m_cnt + s_cnt + d_cnt;
					tmp_data.total = m_cnt + s_cnt + d_cnt;
					tmp_data.m_cnt = m_cnt;
					tmp_data.s_cnt = s_cnt;
					tmp_data.d_cnt = d_cnt;

					tmp_data.level_1 = item.level.level_1;
					tmp_data.level_2 = item.level.level_2;
					tmp_data.level_3 = item.level.level_3;
					tmp_data.level_4 = item.level.level_4;
					tmp_data.level_5 = item.level.level_5;

					// 리스트에 생성된 객체 삽입
					g_convert_data.push(tmp_data);
				});
			})

			// array reverse 처리 (그래프 데이터 저장 시 순차적으로 들어가기 때문에 아래부터 표시가됨. 그래서 역순)
			g_convert_data = g_convert_data.reverse();
			g_convert_bar_data = g_convert_bar_data.reverse();

			if(typeof(_cback) == "function") { _cback();}
		}
	}

	// amChart draw
	var _amChart_draw = function() {
		am4core.options.commercialLicense = true;
		am4core.ready(function() {
			am4core.useTheme(am4themes_animated);
			// 1) Pie Chart
			{
				if (g_chart_type == "single") {
					var pie_Chart = am4core.create("b1_chart", am4charts.PieChart);
					pie_Chart.padding(5, 0, 5, 0);
					pie_Chart.radius = am4core.percent(98);
					//pie_Chart.data = convert_data;
					pie_Chart.data = (g_subj_code == "EG") ? g_convert_bar_data : g_convert_data;
					pie_Chart.innerRadius = am4core.percent(20);

					var pieSeries = pie_Chart.series.push(new am4charts.PieSeries());
					pieSeries.dataFields.value = "total";
					pieSeries.dataFields.category = "sub_category";
					pieSeries.labels.template.disabled = false;
					pieSeries.ticks.template.disabled = true;
					pieSeries.alignLabels = false;
					pieSeries.labels.template.text = "{category} \n{value.percent.formatNumber('#.0')}%";
					pieSeries.labels.template.radius = am4core.percent(-75);
					pieSeries.labels.template.fill = am4core.color("white");
					pieSeries.labels.template.relativeRotation = 90;
					pieSeries.labels.template.fontSize = 11;
					pieSeries.labels.template.textAlign = "middle";
					pieSeries.slices.template.tooltipText = "{category} : {value.percent.formatNumber('#.0')}%";
					pieSeries.labels.template.maxWidth = 115;
					pieSeries.labels.template.wrap = false;
					pieSeries.labels.template.truncate = true;		// 줄임
					//pieSeries.labels.template.tooltipText = "{categoryY}: [bold]{valueX}[/]";		// 오버시 툴팁 내용
				}
			}
			// E : Pie Chart

			/* 2) donut Chart */
			{
				// Create the chart
				if (g_chart_type == "multi") {
					var donut_Chart = am4core.create("b1_chart", am4plugins_sunburst.Sunburst);
					donut_Chart.padding(5, 5, 5, 5);
					donut_Chart.radius = am4core.percent(98);
					donut_Chart.innerRadius = am4core.percent(10);
					//donut_Chart.legend = new am4charts.Legend();

					// Make colors more distinctive
					donut_Chart.colors.step = 2;

					// Add multi-level data
					donut_Chart.data = g_obj_json.chart_data;

					// Define data fields
					//donut_Chart.dataFields.value = "value";
					donut_Chart.dataFields.value = "total";
					donut_Chart.dataFields.name = "name";
					donut_Chart.dataFields.children = "data";

					// Configure levels
					var level0 = donut_Chart.seriesTemplates.create("0");
					level0.labels.template.fontSize = 11;
					level0.labels.template.text = "{name}\n{value.percent.formatNumber('#.0')}%";
					level0.labels.template.textAlign = "middle";
					level0.labels.template.maxWidth = 60;
					level0.labels.template.wrap = false;
					level0.labels.template.truncate = true;		// 줄임

					var level1 = donut_Chart.seriesTemplates.create("1");
					level1.labels.template.fontSize = 9;
					level1.slices.template.fillOpacity = 0.75;
					level1.labels.template.text = "{name}\n{value.percent.formatNumber('#.0')}%";
					level1.labels.template.maxWidth = 60;
					level1.labels.template.wrap = false;
					level1.labels.template.truncate = true;		// 줄임
				}
			}
			/* //Pie Chart */

			/* 3) Bar Chart */
			{
				var bar_chart = am4core.create("a_chart", am4charts.XYChart);
				bar_chart.data = g_convert_data;

				// 원본 데이터 수정 없이 임시로 데이터값 수정 할 경우 사용

				/*
				bar_chart.events.on("beforedatavalidated", function() {
					for(var i = 0; i < bar_chart.data.length; i++) {
						//bar_chart.data[i].sub_category += " (" + i + ")";
						//bar_chart.data[i].sub_category = am4core.utils.truncateWithEllipsis(bar_chart.data[i].sub_category, 15, "...");
					}
				});
				*/


				bar_chart.cursor = new am4charts.XYCursor();
				bar_chart.cursor.behavior = "none";
				//bar_chart.height=am4core.Percent(50);

				// 1) Y축 표시
				// 최대 길이 체크
				var _max_length = 0;
				g_convert_data.forEach(function(item, index) {
					if (item.sub_category.length >= _max_length) {
						_max_length = item.sub_category.length;
					}
				});

				var yAxis = bar_chart.yAxes.push(new am4charts.CategoryAxis());
				yAxis.dataFields.category = "sub_category";
				yAxis.renderer.paddingTop = "0";	// Y축 넓이
				//yAxis.renderer.width = "180";	// Y축 넓이
				yAxis.renderer.width = ((g_chart_type=="single") ? 180 : ((_max_length<=12) ? 120 : 155));	// Y축 넓이
				yAxis.tooltip.disabled = false;
				//yAxis.renderer.labels.template.maxWidth = 125;
				//yAxis.renderer.labels.template.ellipsis = am4core.utils.truncateWithEllipsis(text, 15, "...");
				//yAxis.renderer.labels.template.ellipsis = ".....";
				//yAxis.renderer.labels.template.wrap = false;
				//yAxis.renderer.labels.template.truncate = true;		// 줄임

				//yAxis.title.text = "세로";
				yAxis.renderer.grid.template.location = 0;
				yAxis.renderer.labels.template.fontSize = 10;
				yAxis.renderer.minGridDistance = 10;

				// 2) X축 표시 (존재하는 값들만 표시)
				var m_cnt_chk = 0;
				var d_cnt_chk = 0;
				var s_cnt_chk = 0;
				g_convert_data.forEach(function(item, index) {
					m_cnt_chk += (_isUndefined(item.m_cnt) ? parseInt(item.m_cnt) : 0);
					d_cnt_chk += (_isUndefined(item.d_cnt) ? parseInt(item.d_cnt) : 0);
					s_cnt_chk += (_isUndefined(item.s_cnt) ? parseInt(item.s_cnt) : 0);
				});

				var xAxis = bar_chart.xAxes.push(new am4charts.ValueAxis());

				// 2-1) sub1 차트
				if (m_cnt_chk > 0) {
					var series = bar_chart.series.push(new am4charts.ColumnSeries());
					series.dataFields.valueX = "m_cnt";		// 값
					series.dataFields.categoryY = "sub_category";	// 기준
					//series.columns.template.tooltipText = "{categoryY}: [bold]{valueX}[/]";		// 오버시 툴팁 내용
					series.columns.template.strokeWidth = 0;
					series.name = "객관식";
					//series.tooltip.disabled = false;

					series.columns.template.adapter.add("tooltipText", function(tooltipText, target) {
						// return target.dataItem.categories.categoryY.replace(/_\(.*/, "")+": [bold]{valueX}[/]";
						return series.name +": [bold]{valueX}[/]";
					})
				}

				// 2-2) sub1 차트
				if (s_cnt_chk > 0) {
					var series1 = bar_chart.series.push(new am4charts.ColumnSeries());
					series1.dataFields.valueX = "s_cnt";		// 값
					series1.dataFields.categoryY = "sub_category";		// 기준
					//series1.columns.template.tooltipText = "{categoryY}: [bold]{valueX}[/]";		// 오버시 툴팁 내용
					series1.columns.template.strokeWidth = 0;
					series1.name = "주관식";

					series1.columns.template.adapter.add("tooltipText", function(tooltipText, target) {
						// return target.dataItem.categories.categoryY.replace(/_\(.*/, "")+": [bold]{valueX}[/]";
						return series1.name +": [bold]{valueX}[/]";
					})
				}

				// 2-2) sub1 차트
				if (d_cnt_chk > 0) {
					var series2 = bar_chart.series.push(new am4charts.ColumnSeries());
					series2.dataFields.valueX = "d_cnt";		// 값
					series2.dataFields.categoryY = "sub_category";		// 기준
					//series2.columns.template.tooltipText = "{categoryY}: [bold]{valueX}[/]";		// 오버시 툴팁 내용
					series2.columns.template.strokeWidth = 0;
					series2.name = "서술형";

					series2.columns.template.adapter.add("tooltipText", function(tooltipText, target) {
						// return target.dataItem.categories.categoryY.replace(/_\(.*/, "") + ": [bold]{valueX}[/]";
						return series2.name +": [bold]{valueX}[/]";
					})
				}

				// Set cell size in pixels
				var cellSize = 45;
				bar_chart.events.on("datavalidated", function(ev) {
					// Get objects of interest
					var chart = ev.target;
					var categoryAxis = chart.yAxes.getIndex(0);

					// Calculate how we need to adjust chart height
					var adjustHeight = chart.data.length * cellSize - categoryAxis.pixelHeight;

					// get current chart height
					var targetHeight = chart.pixelHeight + adjustHeight;

					// Set it on chart's container
					chart.svgContainer.htmlElement.style.height = targetHeight + "px";
				});


				// 3) Y축 대메뉴
				function addRange(txt_label, start, end, color) {
					var range = yAxis.axisRanges.create();
					//range.title.text = "세로";
					//range.label.paddingLeft = 150;
					range.category = start;
					range.endCategory = end;
					range.label.text = txt_label;
					range.label.disabled = false;
					range.label.fill = color;
					range.label.location = 0;
					// 라벨 위치
					range.label.dx = -10;
					//range.label.dy = 12;
					range.label.verticalCenter = "top";

					range.label.fontWeight = "bold";
					range.label.fontSize = 10;
					//range.label.horizontalCenter = "left"
					range.label.align = "left"
					range.label.inside = false;
					//range.label.maxWidth = 90;
					range.label.maxWidth = 94;
					range.label.wrap = true;
					range.label.truncate = false;

					// 로테이션 옵션
					/*
					range.label.rotation = 90;
					range.label.adapter.add("horizontalCenter", function() {
						return "top";
					});
					*/
					range.grid.stroke = am4core.color("#396478");
					range.grid.strokeOpacity = 1;
					range.grid.disabled = false;

					range.tick.length = "180";
					range.tick.disabled = false;
					range.tick.strokeOpacity = 0.6;
					range.tick.stroke = am4core.color("#396478");
					range.tick.location = 0;
					range.locations.category = 1;
				}

				g_convert_bar_data.forEach(function(item, index) {
					addRange(item.label, item.start, item.end, bar_chart.colors.getIndex(index));

					// last tick
					if (index == (g_convert_bar_data.length-1)) {
						var range = yAxis.axisRanges.create();
						range.category = g_convert_bar_data[0].end;
						range.label.text = "";      // 타이틀 덮어씌움 방지
						range.grid.stroke = am4core.color("#396478");
						range.grid.strokeOpacity = 1;
						range.grid.disabled = false;
						range.tick.length = "180";
						range.tick.disabled = false;
						range.tick.strokeOpacity = 0.6;
						range.tick.stroke = am4core.color("#396478");
						range.tick.location = 0;
						range.locations.category = 0;
					}
					// E : last tick
				});

				// label 출력값 길이 조절 (truncate 처리)
				yAxis.renderer.labels.template.adapter.add("textOutput", function(text, type) {
					if(_isUndefined(text)) {
						text = text.replace(/_\(.*/, "");
						text = _get_ellipsis(text, ((g_chart_type=="single") ? 18 : 20));
						//text = am4core.utils.truncateWithEllipsis(text, 10, "...")      // 12 -> ... 3자리 빼서 "9자리 + ..."
						return text;
					}
				});

				yAxis.adapter.add("tooltipText", function(tooltipText, target) {
					return yAxis.tooltipDataItem.dataContext.sub_category.replace(/_\(.*/, "");
				})

				// 4) legend 정의
				bar_chart.legend = new am4charts.Legend();
				bar_chart.legend.useDefaultMarker = true;
				//bar_chart.legend.position = "right";
				bar_chart.legend.fontSize = "11";
				//bar_chart.legend.width = "100";
				var marker = bar_chart.legend.markers.template.children.getIndex(0);
				marker.cornerRadius(12, 12, 12, 12);
				marker.strokeWidth = 2;
				marker.strokeOpacity = 1;
				marker.stroke = am4core.color("#ccc");
			}
			/* E : Bar Chart */

			/* 4) XY Chart */
			{
				var xy_chart = am4core.create("b2_chart", am4charts.XYChart);
				xy_chart.paddingBottom = 50;
				xy_chart.cursor = new am4charts.XYCursor();
				xy_chart.cursor.behavior = "none";
				xy_chart.fontSize = 11;

				// X축
				var categoryAxis = xy_chart.xAxes.push(new am4charts.CategoryAxis());
				categoryAxis.dataFields.category = "category";
				categoryAxis.renderer.minGridDistance = 0;
				categoryAxis.renderer.grid.template.location = 0;
				categoryAxis.dataItems.template.text = "{realName}";

				//categoryAxis.renderer.labels.template.maxWidth = 100; // 6개 이상
				/*
				var tmp_maxwidth = 0;
				if (convert_data.length <= 6) {
					tmp_maxwidth = 140;
				} else if (convert_data.length > 6 && convert_data.length <= 10) {
					tmp_maxwidth = 110;
				} else if (convert_data.length > 10) {
					tmp_maxwidth = 80;
				}
				*/
				categoryAxis.events.on("sizechanged", function(ev) {
					var axis = ev.target;
					var cellWidth = axis.pixelWidth / (axis.endIndex - axis.startIndex);
					//axis.renderer.labels.template.maxWidth = cellWidth;
					axis.renderer.labels.template.maxWidth = cellWidth+15;
				});


				//categoryAxis.renderer.labels.template.maxWidth = tmp_maxwidth
				categoryAxis.renderer.labels.template.truncate = true;		// 줄임

				categoryAxis.fontSize = 10;
				//categoryAxis.tooltip.disabled = true;
				categoryAxis.tooltip.disabled = false;

				// label 출력값 변조
				categoryAxis.renderer.labels.template.adapter.add("textOutput", function(text) {
					//return text.replace(/ \(.*/, "");
					if(_isUndefined(text)) {
						return text.replace(/_\(.*/, "");   // _(n) 공백 치환
					}
				});

				categoryAxis.adapter.add("tooltipText", function(tooltipText, target) {
					//return categoryAxis.tooltipDataItem.dataContext.realName;	// 하단 텍스트
					return categoryAxis.tooltipDataItem.dataContext.realName.replace(/_\(.*/, "");	// 하단 텍스트
				})

				// Y축
				var valueAxis = xy_chart.yAxes.push(new am4charts.ValueAxis());
				valueAxis.tooltip.disabled = false;
				valueAxis.calculateTotals = true;
				valueAxis.min = 0;
				valueAxis.strictMinMax = true;
				//valueAxis.max = 100;

				// 그룹간 구분선
				var rangeTemplate = categoryAxis.axisRanges.template;
				rangeTemplate.tick.disabled = false;
				rangeTemplate.tick.location = 0;
				rangeTemplate.tick.strokeOpacity = 0.6;
				rangeTemplate.tick.length = 60;
				rangeTemplate.grid.strokeOpacity = 0.5;
				rangeTemplate.label.tooltip = new am4core.Tooltip();
				rangeTemplate.label.tooltip.dy = -10;
				rangeTemplate.label.cloneTooltip = false;

				// DATA
				var chartData = [];

				// 그룹위한 데이터 가공
				for(var providerName in g_obj_json.chart_data) {
					var providerData = g_obj_json.chart_data[providerName];

					// add data of one provider to temp array
					var tempArray = [];

					// add items
					providerData.data.forEach(function(item, index) {
						tempArray.push({ category: providerData.name + "_" + item.name,
											realName: item.name,
											value1: item.level.level_1,
											value2: item.level.level_2,
											value3: item.level.level_3,
											value4: item.level.level_4,
											value5: item.level.level_5,
											provider: providerData.name})
					});

					// push to the final data
					am4core.array.each(tempArray, function(item) {
						chartData.push(item);
					})

					// X Line Group (그룹 타이틀)
					var range = categoryAxis.axisRanges.create();
					range.category = tempArray[0].category;
					range.endCategory = tempArray[tempArray.length - 1].category;
					range.label.text = tempArray[0].provider;
					//range.labels.template.maxWidth = 130;
					//range.labels.template.truncate = true

					range.label.dy = 35;
					range.label.truncate = true;
					range.label.fontSize = "13";
					range.label.fontWeight = "bold";
					range.label.tooltipText = tempArray[0].provider;

					range.label.adapter.add("maxWidth", function(maxWidth, target) {
						var range = target.dataItem;
						var startPosition = categoryAxis.categoryToPosition(range.category, 0);
						var endPosition = categoryAxis.categoryToPosition(range.endCategory, 1);
						var startX = categoryAxis.positionToCoordinate(startPosition);
						var endX = categoryAxis.positionToCoordinate(endPosition);
						return endX - startX;
					})
				}

				xy_chart.data = chartData;

				// single column series for all data
				function addXY_column(name, value) {
					var columnSeries = xy_chart.series.push(new am4charts.ColumnSeries());
					columnSeries.columns.template.width = am4core.percent(80);
					columnSeries.name = name;
					//columnSeries.tooltipText = "{provider}: {realName}, {valueY}";
					columnSeries.tooltipText = "{name} : {valueY}";
					columnSeries.tooltipText.fontSize = 9;
					columnSeries.dataFields.categoryX = "category";
					columnSeries.dataFields.valueY = value;
					columnSeries.stacked = true;
				}

				var level1_cnt_chk = 0;
				var level2_cnt_chk = 0;
				var level3_cnt_chk = 0;
				var level4_cnt_chk = 0;
				var level5_cnt_chk = 0;

				chartData.forEach(function(item, index) {
					level1_cnt_chk += (_isUndefined(item.value1) ? parseInt(item.value1) : 0);
					level2_cnt_chk += (_isUndefined(item.value2) ? parseInt(item.value2) : 0);
					level3_cnt_chk += (_isUndefined(item.value3) ? parseInt(item.value3) : 0);
					level4_cnt_chk += (_isUndefined(item.value4) ? parseInt(item.value4) : 0);
					level5_cnt_chk += (_isUndefined(item.value5) ? parseInt(item.value5) : 0);
				});

				if (level1_cnt_chk > 0) {
					addXY_column("하", "value1");
				}
				if (level2_cnt_chk > 0) {
					addXY_column("중", "value2");
				}
				if (level3_cnt_chk > 0) {
					addXY_column("중상", "value3");
				}
				if (level4_cnt_chk > 0) {
					addXY_column("상", "value4");
				}
				if (level5_cnt_chk > 0) {
					addXY_column("특", "value5");
				}

				// Add legend
				/*
				xy_chart.legend = new am4charts.Legend();
				xy_chart.legend.useDefaultMarker = true;
				//xy_chart.legend.position = "right";
				//xy_chart.legend.width = am4core.percent(14);
				xy_chart.legend.fontSize = 9;
				xy_chart.legend.itemContainers.template.clickable = false;
				xy_chart.legend.reverseOrder = true;
				var marker = xy_chart.legend.markers.template.children.getIndex(0);
				marker.cornerRadius(12, 12, 12, 12);
				marker.strokeWidth = 2;
				marker.strokeOpacity = 1;
				marker.stroke = am4core.color("#ccc");
				*/

				// last tick
				var range = categoryAxis.axisRanges.create();
				range.category = xy_chart.data[xy_chart.data.length - 1].category;
				range.label.disabled = true;
				range.tick.location = 1;
				range.grid.location = 1;
			}
			/* //XY Chart */
		});
	}

	// 단원별 출제 비중 리스트
	var _question_weight_draw = function() {
		var convert_org_data = g_convert_data.slice();    // 깊은 복사
		var header, body;

		$("#questions_weight").empty();
		convert_org_data.reverse().forEach(function(item, index) {
			if(index == 0) {
				var obj_title = eval("_table_title_data." + g_chart_type + "." + g_subj_code);
				header = '<colgroup>';
				header = header + '<col width="' + ((item.main_category.length >= 7) ? "100px" : "60px") + '">';
				header = header + '<col width="">';

				if(_isUndefined(item.from) && g_arr_exception_subj_code.indexOf(g_subj_code) < 0 && (g_subj_code != 'HI' || g_site_id != "H")) {
					header = header + '<col width="80px">';
				}
				header = header + '<col width="60px">';
				header = header + '</colgroup>';
				header = header + '<thead>';
				header = header + '<tr>';
				header = header + '<th>' + obj_title.B.title1 + '</th>';
				header = header + '<th>' + obj_title.B.title2 + '</th>';
				if(_isUndefined(item.from) && g_arr_exception_subj_code.indexOf(g_subj_code) < 0 && (g_subj_code != 'HI' || g_site_id != "H")) {
					header = header + '<th>' + obj_title.B.publish + '</th>';
				}
				header = header + '<th class="last">' + obj_title.B.qcnt + '</th>';
				header = header + '</tr>';
				header = header + '</thead>';
				header = header + '<tbody></tbody>';

				$("#questions_weight").append(header);
			}

			body = '<tr>';
			//body = body + '<th class="weight_first">'+item.main_category+'</th>';
			body = body + '<th class="weight_first">'+item.main_category+'&nbsp;</th>';
			body = body + '<td class="td-left">'+item.sub_category.replace(/_\(.*/, "")+'</td>';

			if(_isUndefined(item.from) && g_arr_exception_subj_code.indexOf(g_subj_code) < 0 && (g_subj_code != 'HI' || g_site_id != "H")) {
				body = body + '<th class="weight_second">'+((item.from != "") ? item.from : "-")+'</th>';		// 공백 예외 처리
			}

			body = body + '<td class="last">'+item.total+'</td>';
			body = body + '</tr>';

			$("#questions_weight tbody").append(body);
		});

		// rowspan 처리
		//make_rowspan("weight_first");
		//make_rowspan("weight_second");
		setTimeout(function() {
			make_rowspan("weight_first");
			make_rowspan("weight_second");
		}, 700);
	}

	// list1 draw
	var _list_type1_draw = function() {
		var header, body;

		$("#detail_analysis").empty();
		//g_obj_json.list_data_1.forEach(function(item, index) {
		g_obj_json.list_data.forEach(function(item, index) {
			if(index == 0) {
				var obj_title = eval("_table_title_data." + g_chart_type + "." + g_subj_code);

				header = '<thead>';
				header = header + '<tr>';
				header = header + '<th width=60>' + obj_title.C.no + '</th>';
				header = header + '<th width=100>' + obj_title.C.type + '</th>';

				if(_isUndefined(item.publish) && g_arr_exception_subj_code.indexOf(g_subj_code) < 0 && (g_subj_code != 'HI' || g_site_id != "H")) {
					header = header + '<th>' + obj_title.C.publish + '</th>';
				}

				header = header + '<th>' + obj_title.C.text1 + '</th>';
				header = header + '<th>' + obj_title.C.text2 + '</th>';
				header = header + '<th class="last">' + obj_title.C.level + '</th>';
				header = header + '</tr>';
				header = header + '</thead>';
				header = header + '<tbody></tbody>';

				$("#detail_analysis").append(header);
			}

			body = '<tr>';
			body = body + '<td>'+item.no+'</td>';
			body = body + '<td>'+item.type+'</td>';

			if(_isUndefined(item.publish) && g_arr_exception_subj_code.indexOf(g_subj_code) < 0 && (g_subj_code != 'HI' || g_site_id != "H")) {
				body = body + '<td>'+item.publish+'</td>';
			}

			body = body + '<td>'+item.text1+'</td>';
			body = body + '<td>'+item.text2+'</td>';
			body = body + '<td class="last">'+item.level+'</td>';
			body = body + '</tr>';

			$("#detail_analysis tbody").append(body);
		});
	}

	// list2 draw
	var _list_type2_draw_check = function() {
		var list_type2_inner = new Array();
		var list_type2_outer = new Array();

		// 노출 선택 영역 초기화
		$("#total_analysis_outer").empty().hide();

		g_obj_json.list_data_2.forEach(function(item, index) {
			if(_isUndefined(item.scope) && item.scope.toUpperCase() == "OUTER") {
				list_type2_outer.push(item);
			} else {
				list_type2_inner.push(item);
			}
		});

		_list_type2_draw("total_analysis_inner", list_type2_inner);

		// 교과서외 있는 경우 별도 표시
		if(list_type2_outer.length > 0) {
			$(".d_header").show();
			//$("#total_analysis_outer").show();
			_list_type2_draw("total_analysis_outer", list_type2_outer);
		}
	}

	var _list_type2_draw = function(id, data) {
		var header, body;

		$("#"+id).empty().show();
		data.forEach(function(item, index) {
			if(index == 0) {
				var obj_title = eval("_table_title_data." + g_chart_type + "." + g_subj_code);

				header = '<thead>';
				header = header + '<tr>';
				header = header + '<th>' + obj_title.D.no + '</th>';
				header = header + '<th>' + obj_title.D.type + '</th>';
				header = header + '<th>' + obj_title.D.text1 + '</th>';
				header = header + '<th>' + obj_title.D.text2 + '</th>';
				header = header + '<th class="last">' + obj_title.D.level + '</th>';
				header = header + '</tr>';
				header = header + '</thead>';
				header = header + '<tbody></tbody>';

				$("#"+id).append(header);
			}

			body = '<tr>';
			body = body + '<th>'+item.no+'</th>';
			body = body + '<td>'+item.type+'</td>';
			body = body + '<td>'+item.text1+'</td>';
			body = body + '<td>'+item.text2.replace(/\//gi, "<br/>")+'</td>';
			body = body + '<td class="last">'+item.level+'</td>';
			body = body + '</tr>';

			$("#"+id+" tbody").append(body);
		});
	}

	var _pick_draw = function() {
		$("#summary_pick").html("");
		if(g_site_id == "H" && g_subj_code == "KR") {
			var pick_obj = eval("_g_pick_data."+g_site_id+"."+g_subj_code+"."+g_course_name);
		} else {
			var pick_obj = eval("_g_pick_data."+g_site_id+"."+g_subj_code);
		}

		if(_isUndefined(pick_obj)) {
			pick_obj.forEach(function(item, index) {
				content = '<li class="zocbopick">';
				//content = content + '<div class="zocbopick-label">족보 Pick</div><div>'+item.pick.replace(/<span>/gi, '<span class="color-3997A8">')+'</div>';
				if(index == 0) {
					content = content + '<div class="zocbopick-label">족보 Pick</div>';
				}
				content = content + '<div>'+item.pick.replace(/<span>/gi, '<span class="color-3997A8">')+'</div>';
				content = content + '</li>';

				$("#summary_pick").append(content);
				//jQuery("#pxsec4").show();
			});
		} else {
			jQuery("#pxsec4").hide();
		}
	}

	var _summary_draw_check = function(id, obj) {
		var content;

		$("#"+id).empty();
		obj.list.forEach(function(item, index) {
			content = '<li>'+item.item+'</li>';
			$("#"+id).append(content);
		});

		if(_isUndefined(obj.pick)) {
			content = '<li class="zocbopick">';
			content = content + '<div class="zocbopick-label">족보 Pick</div><div>'+obj.pick.replace(/<span>/gi, '<span class="color-3997A8">')+'</div>';
			content = content + '</li>';

			$("#"+id).append(content);
		}
	}

	return {
		/*
		init: function(scl_id, subj_code, exam_year, term) {
			_init(scl_id, subj_code, exam_year, term);
		}
		*/
		init: function(expapr_no, tx_code, siteid, grade) {
			$("#block_previous_analysis").hide();
			_init(expapr_no, tx_code, siteid, grade);
		}
	}
}();