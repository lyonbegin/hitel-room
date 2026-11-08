const modalCLS = {
    popupOpen : function(title) {
        this.setBodyByTitle(title);
        $("#commonModelFooter").html($("#hidden-modal-popup-footer-btn-close-template").html());
        $("#commonModel").addClass('is-active');
    },
    setBody : function(body) {
        $("#commonModelBody").html(body);
    },
    setBodyByTitle : function(title) {
        let bodyHtml = "";
        if (isValueEmpty(title) == false) {
            bodyHtml = templateReplace($("#hidden-modal-popup-body-title-template").html(), [title]);
        }
        bodyHtml += $("#hidden-modal-popup-body-content-template").html();
        $("#commonModelBody").html(bodyHtml);
    },
    setBodyContent : function(content) {
        $("#commonModelContent").html(content);
    },
    setFooter : function(footer) {
        $("#commonModelFooter").html(footer);
    },
};