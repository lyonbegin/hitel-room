// JavaScript Document

$(document).ready(function(){
    
    $('#wrapper').each(function(){
          // console.log('111')
        var fixedMenu = $('.fixedMenu').length;
        var fixedBtn = $('.fixedBtn, .fixedBtn-default').length;
        var fixedheader = $('.fixedheader').length;    
        if($(this).find('.fixedMenu').length === 1){
            $(this).addClass('fixed')
        }
        if($(this).find('.fixedBtn, .fixedBtn-default').length >= 1){
            $(this).addClass('fixed-btn')
        }
        var headMenu = $('#header').length;
        if($(this).find('#header').length == 0){
            $(this).addClass('full')
        }
        if($(this).find('.fixedheader').length == 1){
            $(this).find('#contents').css({"padding-top":"55px"})
        }
        if($(this).find('.fixedMenu.btn-add').length == 1){
            $(this).css({"padding-bottom":"90px"})
            $(this).find('.fixedBtn').css({"margin-bottom":"75px"})
            $(this).find('.fixedBtn-default').css({"margin-bottom":"75px"})
        }
        
    })
    
    init();
	
	selectDdEvent (); //나의 다운로드 내역 커서텀 셀렉트
})


function init(){
//    $('body').animate({opacity:1},400);
    $(window).bind('scroll', function() {
         if ($(window).scrollTop() > 0) {
             $('.headTop').addClass('active');
         }
         else {
             $('.headTop').removeClass('active');
         };
    });
       
    $("input").not('input[type=checkbox], input[type=radio]').each(function () {
        $(this).bind("focus", function () {
            $(".fixedMenu ul").hide();
//            $('#wrapper').removeClass('fixed')
        });
        $(this).bind("blur", function () {
            $(".fixedMenu ul").show();
//            $('#wrapper').addClass('fixed')
        });
    });

    $(window).scroll(function(){
        var scrollY = $(window).scrollTop()
        if(scrollY>100){
            $('.btnTop').fadeIn()
        } else if(scrollY<100){
            $('.btnTop').fadeOut()
        }
    })

//    var lastScrollTop = 0;
//      $(window).scroll(function(event){
//         var st = $(this).scrollTop();
//         var max = $("#wrapper").height() - $(window).height();
//
//         if (st > lastScrollTop){
//            if(max <= st){
//              $(".fixedMenu ul, .fixedMenu .fixedBtn").fadeIn('fast');
//            } else {
//              $(".fixedMenu ul, .fixedMenu .fixedBtn").fadeOut('fast');
//            }
//         } else if(st + $(window).height() - 110  == $("#wrapper").height()){
//            $(".fixedMenu ul, .fixedMenu .fixedBtn").fadeIn('fast');
//         }
////         console.log(st,max,$("#wrapper").height(),$(window).height(),st + $(window).height() - 110)
//         lastScrollTop = st;
//     });

    $('.btnTop a').click(function(){
        $('html, body').animate({scrollTop : 0},200);
        return false;
    });
    $('.btnMenu').on('click',function(){
        $('#fullMenu').addClass('active');
        return false;
    })
    
    $('#fullMenu .closeMenu button').on('click',function(){
        $('#fullMenu').removeClass('active');
        return false;
    })
//    
    $('.headTop .menu a').on('click',function(){
        $('.navArea').addClass('active');
        return false;
    })
     $('.navArea .closeMenu a').on('click',function(){
        $('.navArea').removeClass('active');
        return false;
    })
    $('.select-list li button').on('click',function(){
        $('.select-list li button').removeClass('active')
        $(this).addClass('active');
        return false;
    })
    $('.multi-select li button').on('click',function(){
        $(this).toggleClass('active');
        return false;
    })
    $('.downLink a').on('click',function(){
        $(this).find('span').toggleClass('active');
        $(this).find('em').toggle();
        $(this).parents('li').find('.detailLink').slideToggle(0)
        return false;
    })
    $('.listTitle .arrowToggle').on('click',function(){
        $(this).parent().toggleClass('active').next().slideToggle(100)
        
        return false;
    })
    $('.similarBlock .similarView a').on('click',function(){
        $(this).parent().toggleClass('active')
        $(this).parents('.similarBlock').find('.similarCon').slideToggle(100)
        return false;
    })
    $('.block_list .titleLine button').on('click',function(){
        $(this).parent().toggleClass('active')
        $(this).parents('.block_list').toggleClass('active')
        $(this).parent().next().slideToggle(100)
        $(this).prev().toggle();
        return false;
    })
    $('.paymentBlock .blockHeader .toggle').on('click',function(){
        $(this).toggleClass('active')
        $(this).parent().next().slideToggle(100)
        return false;
    })
    
    $('.arcodian label').on('click',function(){
        var indexNum = $('.arcodian label').index(this);
        if(indexNum === 0){
            $('.block_list').addClass('active')
            $('.titleLine').addClass('active')
            $('.productBlock').slideDown(100)
        } else if(indexNum === 1){
            $('.block_list').removeClass('active')
            $('.titleLine').removeClass('active')
            $('.productBlock').slideUp(100)
        }
    })
    $('.showhide-tab li a').on('click',function(){
        var indexNum = $('.showhide-tab li a').index(this);
        $('.showhide-tab li').removeClass('active');
        $('.showhide-tab li').eq(indexNum).addClass('active');
        $('.showhide-tab-con .tab-con').hide();
        $('.showhide-tab-con .tab-con').eq(indexNum).show();
        return false;
    })
    
    
    $(".check-all").on('click',function(){
        if($(this).hasClass('active')){
           $(this).removeClass('active')
            $(this).parent().next().find('button').removeClass('active')
           }else{
            $(this).addClass('active')       
               $(this).parent().next().find('button').addClass('active')
           }
        
        
        return false;
    })
    $(".rangeList li button").on('click',function(){
        $(this).parents('ul').prev().find('.check-all').removeClass('active')
        $(this).toggleClass('active')
        return false;
    })
//    $(".listFolding li > .select-btn").on('click',function(){
//        $(this).toggleClass('active')
//        $(this).next().slideToggle(200)
//        return false;
//    })
    // $('.fullBanner ul').bxSlider({
    //         minSlides:1,
    //         maxSlides:1,
    //         moveSlides:1,
    //         auto:true,
    //         slideMargin:8,
    //         autoControls:true,
    //         slideWidth:'auto',
    //         pause: 4000,
    //         adaptiveHeight:true,
    //         responsive:true,
    //         controls:false,
    //         pager:true,
    //         nextText:'',
    //         prevText:'',
    //         speed:'200',
    //         infiniteLoop:true,
    //         pagerType:'short',
    //         stopAutoOnClick: true,
    //         oneToOneTouch:false,
    //         preventDefaultSwipeY:false,
    //     });
    $('.searchTop').parent().addClass('searchBlock')
    $('.bx-controls-auto-item').on('click',function(){
        alert('정지')
    }) // 전체메뉴 스탑버튼 확인용
    $(".checkList li .check").on('click',function(){
        if($(this).parent().hasClass('disable')){
            return false;    
        }else{
            $(this).parent().toggleClass('active')
        }
        
        return false;
    })
}

//나의 다운로드 내역 커서텀 셀렉트
function selectDdEvent () {
	$(".dropdown img.flag").addClass("flagvisibility");

	$(".dropdown dt a").click(function() {
	  //$(".dropdown dd ul").toggle();
	  $(this).parent().next().children().toggle();
	});

	$(".dropdown dd ul li a").click(function() {
	  var text = $(this).html();
	  //$(".dropdown dt a span").html(text);
	 // $(this).closest('dt a span').html(text);
	    $(this).parent().parent().parent().prev('dt').children().children('span').html(text);
	  $(".dropdown dd ul").hide();
	  /* $("#result").html("Selected value is: " + getSelectedValue("sample"));*/
	});

	function getSelectedValue(id) {
	  return $("#" + id).find("dt a span.value").html();
	}

	$(document).bind('click', function(e) {
	  var $clicked = $(e.target);
	  if (!$clicked.parents().hasClass("dropdown"))
		$(".dropdown dd ul").hide();
	});

	$(".dropdown img.flag").toggleClass("flagvisibility");
};

