//$(document).ready(function () {
    jQuery(document).ready(function ($) {

	$('#detailSlideshow').after('<ul id="detailNav">').cycle({ 
    	fx:     'fade', 
    	speed:  1000, 
    	timeout: 0, 
    	pager:  '#detailNav', 
     
    	// callback fn that creates a thumbnail to use as pager anchor 
    	pagerAnchorBuilder: function(idx, slide) { 
        	return '<li><a href="#"><img src="' + slide.src + '" width="42" height="42" /></a></li>'; 
    	} 
	});
	
	$('#details').insertBefore($('#detailNav'));
	
	$('#thumbnailTitle').insertBefore($('#detailNav'));
	
	$( "#detailAccordion" ).accordion({
		collapsible: true,
		heightStyle: 'content',
		active: false,
	});

    $( "#detailAccordion2" ).accordion({
		collapsible: true,
		heightStyle: 'content',
		active: false,
	});


	
	$('.applicationGallery').after('<ul id="appGalleryNav">').cycle({ 
    	fx:     'fade', 
    	speed:  1000, 
    	timeout: 0, 
    	pager:  '#appGalleryNav', 
     
    	// callback fn that creates a thumbnail to use as pager anchor 
    	pagerAnchorBuilder: function(idx, slide) { 
        	return '<li><a href="#"><img src="' + jQuery(slide).find('img').attr('src') + '" width="42" height="42" /></a></li>'; 
    	} 
	});
	
	$( ".appGalleryAccordion1" ).accordion({
		collapsible: true,
		heightStyle: 'content',
		active: false,
	});
	
	$( ".appGalleryAccordion2" ).accordion({
		collapsible: true,
		heightStyle: 'content',
		active: false,
	});
	
	$('.sortBy > li:last-child').css('border-bottom','none');

    $( ".contactAccordions" ).accordion({
		collapsible: true,
		heightStyle: 'content',
		active: false,
	});

    
	
	$(".fancybox").fancybox();

   


});
