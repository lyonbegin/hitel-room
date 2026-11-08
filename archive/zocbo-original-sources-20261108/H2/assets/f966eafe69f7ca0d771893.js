const modal2CLS = {
	/*(가운데 정렬)레이어 팝업*/
    goLayerOpen : function(getId) {
		if (isValueEmpty(getId) == false) {
			jQuery("#" + getId).addClass('active');
		} else {
			jQuery("#examModal").addClass('active');
		}
    },
    goLayerClose : function(getId) {
		if (isValueEmpty(getId) == false) {
			jQuery("#" + getId).removeClass('active');
		} else {
			jQuery("#examModal").removeClass('active');
		}
    },
	goLayerIsOpen : function(getId) {
		jQuery("#" + getId).addClass('is-active');
    },
	goLayerIsClose : function(getId) {
		jQuery("#" + getId).removeClass('is-active');
    },
	goLayerCloseWithCookie : function(getId, date) {//레이어 팝업 닫을 때 쿠키 셋팅
		Event_setCookie(getId, getId, date);//footer.asp에 들어 있는 함수		
		modalCLS.goLayerClose(getId);
	},
	setHeader : function (html) {
        jQuery("#examModalHeader").html(html);
    },
    setBody : function (html) {
        jQuery("#examModalBody").html(html);
    },
    setFooter : function (html) {
        if (isValueEmpty(html) == false) {
            jQuery("#examModalFooter").show();
        } else {
            jQuery("#examModalFooter").hide();
        }
        jQuery("#examModalFooter").html(html);
    },

	/*(하단)레이어 팝업*/
	goBottomLayerOpen : function() {
		let trigger  = "#examBottomModal",
			target   = document.querySelector(trigger),
			backdrop = target.querySelector('.zbBottomSheet__backdrop'),
			content  = target.querySelector('.zbBottomSheet__container');

		target.classList.add('is-active');
		backdrop.classList.add('is-fadeIn');
		content.classList.add('is-slideUp');
		enableScrollLock();		
		//zbAccordion();
    },
    goBottomLayerClose : function() {
		let trigger  = "#examBottomModal",
			target   = document.querySelector(trigger),
			backdrop = target.querySelector('.zbBottomSheet__backdrop'),
			content  = target.querySelector('.zbBottomSheet__container'),
			time     = window.getComputedStyle(content).getPropertyValue('animation-duration'),
			duration = parseFloat(time) * 1000;

		backdrop.classList.replace('is-fadeIn', 'is-fadeOut');
		content.classList.replace('is-slideUp', 'is-slideDown');
		setTimeout(function() {
			backdrop.classList.remove('is-fadeOut');
			content.classList.remove('is-slideDown');
			target.classList.remove('is-active');
		}, duration);
		disableScrollLock();
    },
    setBottomHeader : function (html) {
        jQuery("#examBottomModalHeader").html(html);
    },
    setBottomBody : function (html) {
        jQuery("#examBottomModalBody").html(html);
    },
    setBottomFooter : function (html) {
        if (isValueEmpty(html) == false) {
            jQuery("#examBottomModalFooter").show();
        } else {
            jQuery("#examBottomModalFooter").hide();
        }
        jQuery("#examBottomModalFooter").html(html);
    },
};