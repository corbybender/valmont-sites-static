
var hovering = false;
var hoverTimer;





$(document).ready(globalInit);

function globalInit(){
	showJavascriptClass();
	preloadImages();
	globalKerning();
	setupTabs();
	skinSelectDropdowns();
	setupDropdowns();
	setupAccordion();
	browserCompatability();
}

function showJavascriptClass(){
	$(".javascript-show").show();
}

function preloadImages(){
    if (document.images){
      preload_image = new Image(20,11); 
      preload_image.src="/global/images/backgrounds/dropdown-left.gif";
      preload_image = new Image(125,82); 
      preload_image.src="/images/backgrounds/book-hover.gif"; 
      preload_image = new Image(341,71); 
      preload_image.src="/images/backgrounds/business-tab-hover.gif"; 
    }
}

function globalKerning(){
	$("#main-nav a, #footer-tabs a").lettering();
}

function setupTabs(){
	$(".tabset > li a").click(function(){
		var tabID = $(this).parent().parent().attr("id");
		var tabContentID = $(this).parent().parent().attr("data-content");
		$("#"+tabID+" a.show").removeClass("show");
		$("#"+tabContentID+" > div.show").removeClass("show");
		var content = $(this).attr("data-content");
		$("#"+content).addClass("show");
		$(this).addClass("show");
	});
}

function skinSelectDropdowns(){
	$('#main-content').jelectbox({
		selectbox_id:'select-item-input', 
		width:'341px'
	});
	$('#google-translate').jelectbox({
		selectbox_id:'goog-te-combo', 
		width:'162px'
	});
}

function setupDropdownSize(){
	$("#dropdowns li.dropdown").width($("nav#main-nav").width()-16);
}

function setupDropdowns(){
	$("#main-nav a").hover(function(){
		
		$("#dropdowns .secondary-nav-hover").removeClass("secondary-nav-hover");
		$("#dropdowns .dropdowns-right .show").removeClass("show");
	
		var index = $(this).attr("data-dropdown");
		if(!hovering)
			$("#"+index).delay(150).fadeIn(100);
		else
			$("#"+index).show().fadeIn(1);
		hovering = true;
		clearTimeout(hoverTimer);
		
		var firstSecondarNav = $("#"+index+" .secondary-nav li:first a");
		var firstSecondaryMenu = firstSecondarNav.attr("data-right-side");
		if(firstSecondaryMenu != undefined){
			firstSecondarNav.addClass("secondary-nav-hover");
			$("#"+firstSecondaryMenu).addClass("show");
		}
	}, function(){
		var index = $(this).attr("data-dropdown");
		$("#"+index).stop(true, true, true).hide();
		hoverTimer = setTimeout(setNotHovering, 300);
	});
	$("#dropdowns li.dropdown").hover(function(){
		$(this).show().fadeIn(1);
		var index = $(this).attr("id");
		$("#main-nav a[data-dropdown='"+index+"']").addClass("hover");
		hovering = true;
		clearTimeout(hoverTimer);
	}, function(){
		$(this).hide();
		var index = $(this).attr("id");
		$("#main-nav a[data-dropdown='"+index+"']").removeClass("hover");
		hoverTimer = setTimeout(setNotHovering, 300);
	});
	
	$("#dropdowns .dropdowns-left a").hover(function(){
		$("#dropdowns .secondary-nav-hover").removeClass("secondary-nav-hover");
		$("#dropdowns .dropdowns-right .show").removeClass("show");
		$(this).addClass("secondary-nav-hover");
		var menu = $(this).attr("data-right-side");
		$("#"+menu).addClass("show");
	}, function(){
	});
	
	
	$("#main-nav a").focusin(function(){
		
		$("#dropdowns .secondary-nav-hover").removeClass("secondary-nav-hover");
		$("#dropdowns .dropdowns-right .show").removeClass("show");
	
		var index = $(this).attr("data-dropdown");
		if(!hovering)
			$("#"+index).delay(150).fadeIn(100);
		else
			$("#"+index).show().fadeIn(1);
		hovering = true;
		clearTimeout(hoverTimer);
		
		var firstSecondarNav = $("#"+index+" .secondary-nav li:first a");
		var firstSecondaryMenu = firstSecondarNav.attr("data-right-side");
		if(firstSecondaryMenu != undefined){
			firstSecondarNav.addClass("secondary-nav-hover");
			$("#"+firstSecondaryMenu).addClass("show");
		}
	});
	
	$("#main-nav a").focusout(function(){
		var index = $(this).attr("data-dropdown");
		$("#"+index).stop(true, true, true).hide();
		hoverTimer = setTimeout(setNotHovering, 300);
	});
	
	$("#dropdowns .secondary-nav a").focusin(function(){
	
		$("#dropdowns .secondary-nav-hover").removeClass("secondary-nav-hover");
		$("#dropdowns .dropdowns-right .show").removeClass("show");
		
		$(this).parent().parent().parent().parent().show().fadeIn(1);
		
		var firstSecondarNav = $(this);
		var firstSecondaryMenu = firstSecondarNav.attr("data-right-side");
		if(firstSecondaryMenu != undefined){
			firstSecondarNav.addClass("secondary-nav-hover");
			$("#"+firstSecondaryMenu).addClass("show");
		}
	});
	
	$("#dropdowns .secondary-nav a").focusout(function(){
		$(this).parent().parent().parent().parent().hide();
	});
	
	$("#dropdowns .tertiary a").focusin(function(){
		
		$(this).parent().parent().parent().parent().parent().show().fadeIn(1);
		
	});
	
	$("#dropdowns .tertiary a").focusout(function(){
		$(this).parent().parent().parent().parent().parent().hide();
	});
	
	
}

function setNotHovering(){
	hovering = false;
}

function setupAccordion() {
    $(".accordion").accordion({
        "collapsible": true,
        "active": false,
        "autoHeight": false
    });
}

function browserCompatability(){
	if($.browser.msie){
		if($.browser.version < 9){
			$("#social-media-links li, .fade, #accordion h3").hover(function(){
				$(this).fadeTo(1, .6);
			}, function(){
				$(this).fadeTo(1, 1);
			});
			$("#financial-tabs li:last a, #officers-tabs li:last a").css("border", "none");
			$("#region-countries-lists ul:first").css("padding", "0 80px 0 0");
			$("#region-countries-lists ul:last").css({"padding" : "0 0 0 10px", "border" : "none"});
			$(".horizontal-list li:last-child").css("border", "none");
			$("#footer-tabs li:last").css("background", "none");
			$("#dropdowns .full-dropdown .secondary-nav:last").css({"border":"none", "width": "234px"});
		}
	}
}

