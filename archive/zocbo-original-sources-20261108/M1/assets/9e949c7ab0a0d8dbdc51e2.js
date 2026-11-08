const bottomSheetLayerCLS = {
    init : function(item) {
        jQuery("#bottomSheetLayerHeader").html("");
        jQuery("#bottomSheetLayerBody").html("");
        jQuery("#bottomSheetLayerFooter").html("");
        bottomSheetOpen(item);
    },
    setHeader : function(html) {
        jQuery("#bottomSheetLayerHeader").html(html);
    },
    setBody : function(html) {
        jQuery("#bottomSheetLayerBody").html(html);
    },
    setFooter : function(html) {
        jQuery("#bottomSheetLayerFooter").html(html);
    },
	initInViewer : function(item) {
        jQuery("#bottomSheetLayerHeaderInViewer").html("");
        jQuery("#bottomSheetLayerBodyInViewer").html("");
        jQuery("#bottomSheetLayerFooterInViewer").html("");
        bottomSheetOpen(item);
    },
    setHeaderInViewer : function(html) {
        jQuery("#bottomSheetLayerHeaderInViewer").html(html);
    },
    setBodyInViewer : function(html) {
        jQuery("#bottomSheetLayerBodyInViewer").html(html);
    },
    setFooterInViewer : function(html) {
        jQuery("#bottomSheetLayerFooterInViewer").html(html);
    },
};