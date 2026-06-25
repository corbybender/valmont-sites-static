/**
* hoverIntent is similar to jQuery's built-in "hover" function except that
* instead of firing the onMouseOver event immediately, hoverIntent checks
* to see if the user's mouse has slowed down (beneath the sensitivity
* threshold) before firing the onMouseOver event.
* 
* hoverIntent r6 // 2011.02.26 // jQuery 1.5.1+
* <http://cherne.net/brian/resources/jquery.hoverIntent.html>
* 
* hoverIntent is currently available for use in all personal or commercial 
* projects under both MIT and GPL licenses. This means that you can choose 
* the license that best suits your project, and use it accordingly.
* 
* // basic usage (just like .hover) receives onMouseOver and onMouseOut functions
* $("ul li").hoverIntent( showNav , hideNav );
* 
* // advanced usage receives configuration object only
* $("ul li").hoverIntent({
*	sensitivity: 7, // number = sensitivity threshold (must be 1 or higher)
*	interval: 100,   // number = milliseconds of polling interval
*	over: showNav,  // function = onMouseOver callback (required)
*	timeout: 0,   // number = milliseconds delay before onMouseOut function call
*	out: hideNav    // function = onMouseOut callback (required)
* });
* 
* @param  f  onMouseOver function || An object with configuration options
* @param  g  onMouseOut function  || Nothing (use configuration options object)
* @author    Brian Cherne brian(at)cherne(dot)net
*/
(function($) {
	$.fn.hoverIntent = function(f,g) {
		// default configuration options
		var cfg = {
			sensitivity: 7,
			interval: 100,
			timeout: 0
		};
		// override configuration options with user supplied object
		cfg = $.extend(cfg, g ? { over: f, out: g } : f );

		// instantiate variables
		// cX, cY = current X and Y position of mouse, updated by mousemove event
		// pX, pY = previous X and Y position of mouse, set by mouseover and polling interval
		var cX, cY, pX, pY;

		// A private function for getting mouse position
		var track = function(ev) {
			cX = ev.pageX;
			cY = ev.pageY;
		};

		// A private function for comparing current and previous mouse position
		var compare = function(ev,ob) {
			ob.hoverIntent_t = clearTimeout(ob.hoverIntent_t);
			// compare mouse positions to see if they've crossed the threshold
			if ( ( Math.abs(pX-cX) + Math.abs(pY-cY) ) < cfg.sensitivity ) {
				$(ob).unbind("mousemove",track);
				// set hoverIntent state to true (so mouseOut can be called)
				ob.hoverIntent_s = 1;
				return cfg.over.apply(ob,[ev]);
			} else {
				// set previous coordinates for next time
				pX = cX; pY = cY;
				// use self-calling timeout, guarantees intervals are spaced out properly (avoids JavaScript timer bugs)
				ob.hoverIntent_t = setTimeout( function(){compare(ev, ob);} , cfg.interval );
			}
		};

		// A private function for delaying the mouseOut function
		var delay = function(ev,ob) {
			ob.hoverIntent_t = clearTimeout(ob.hoverIntent_t);
			ob.hoverIntent_s = 0;
			return cfg.out.apply(ob,[ev]);
		};

		// A private function for handling mouse 'hovering'
		var handleHover = function(e) {
			// copy objects to be passed into t (required for event object to be passed in IE)
			var ev = jQuery.extend({},e);
			var ob = this;

			// cancel hoverIntent timer if it exists
			if (ob.hoverIntent_t) { ob.hoverIntent_t = clearTimeout(ob.hoverIntent_t); }

			// if e.type == "mouseenter"
			if (e.type == "mouseenter") {
				// set "previous" X and Y position based on initial entry point
				pX = ev.pageX; pY = ev.pageY;
				// update "current" X and Y position based on mousemove
				$(ob).bind("mousemove",track);
				// start polling interval (self-calling timeout) to compare mouse coordinates over time
				if (ob.hoverIntent_s != 1) { ob.hoverIntent_t = setTimeout( function(){compare(ev,ob);} , cfg.interval );}

			// else e.type == "mouseleave"
			} else {
				// unbind expensive mousemove event
				$(ob).unbind("mousemove",track);
				// if hoverIntent state is true, then call the mouseOut function after the specified delay
				if (ob.hoverIntent_s == 1) { ob.hoverIntent_t = setTimeout( function(){delay(ev,ob);} , cfg.timeout );}
			}
		};

		// bind the function to the two event listeners
		return this.bind('mouseenter',handleHover).bind('mouseleave',handleHover);
	};
})(jQuery);

/*!
* Lettering.JS 0.6.1
* Copyright 2010, Dave Rupert http://daverupert.com
* Released under the WTFPL license
* http://sam.zoy.org/wtfpl/
* Thanks to Paul Irish - http://paulirish.com - for the feedback.
* Date: Mon Sep 20 17:14:00 2010 -0600
*/
(function(b){function c(g,h,d,i){var e=g.text().split(h),f="";if(e.length){b(e).each(function(j,k){f+='<span class="'+d+(j+1)+'">'+k+"</span>"+i});g.empty().append(f)}}var a={init:function(){return this.each(function(){c(b(this),"","char","")})},words:function(){return this.each(function(){c(b(this)," ","word"," ")})},lines:function(){return this.each(function(){var d="eefec303079ad17405c889e092e105b0";c(b(this).children("br").replaceWith(d).end(),d,"line","")})}};b.fn.lettering=function(d){if(d&&a[d]){return a[d].apply(this,[].slice.call(arguments,1))}else{if(d==="letters"||!d){return a.init.apply(this,[].slice.call(arguments,0))}}b.error("Method "+d+" does not exist on jQuery.lettering");return this}})(jQuery);

/**
 * jelectbox
 *
 * @param
 * @author serdar ozturk
 * @url http://kokulusilgi.com/blog/30-jelectbox
 */
(function($){
    $.fn.extend({
        
        jelectbox: function(options){
        
            //jelectbox settings 
            var defaults = {
                selectbox_id: 'myjelectbox',
				width: 'auto',
				height: 'auto',
				disabled_alert_message: ''
            };
            
            var options = $.extend(defaults, options);
            
            return this.each(function(){
                var o = options;
                var obj = $(this);
				var l_selected = '';
				
				l_selected = $('#'+o.selectbox_id+' option:selected').text();
                $('#'+o.selectbox_id).after('<div class="jelectbox_main" style="position:relative; width:'+o.width+';"><div style="float:left;"><span class="jelectbox_text">'+l_selected+'</span></div><div style="float:right;"><a></a></div><div style="clear:both;"></div><div class="jelectbox_options" style="position:absolute; display:none; width:'+o.width+'"><div class="jelectbox_ul_parent" style="height:'+o.height+'; overflow:auto; overflow-x:hidden;"><ul class="jelectbox_ul_selectbox"></ul></div> </div></div>');
 				$('#'+o.selectbox_id).css('display','none');
				
				// create option list
				$("#"+o.selectbox_id+" *").each(function (i) { 
					var current = $(this); 
					clsg = '';
					if (i % 2 == 0) {
						clsg = ' class="g"';
					}
					$('.jelectbox_ul_selectbox',obj).append('<li value="' + current.attr("value") + '" title="' + current.attr("title") + '"'+clsg+'>' + current.text() + '</li>');
				});
				
				// plus (1 left, 1 border)
				$('.jelectbox_options', obj).width($('.jelectbox_options', obj).width()+12);
				
				// open - hide option list
                $('.jelectbox_main a', obj).click(function(){
					if ($("#" + o.selectbox_id).get(0).disabled == false) {
						$('.jelectbox_options', obj).slideToggle(1);
						// fix selectbox z-index bug for ie
						$('.jelectbox_main').css('z-index', 0);
						$('.jelectbox_main', obj).css('z-index', 999);
						// up down select image
						if ($('.jelectbox_options', obj).css('height') != '1px')
						{
							$(this).removeClass('up');
						} else {
							$(this).addClass('up');
						}
					} else {
						// disable alert message
						alert(o.disabled_alert_message);
					}
                });
				
				// change selected
                $('ul.jelectbox_ul_selectbox li',obj).click(function(){
					var current_value = $(this).attr("value");
                    $('.jelectbox_text',obj).html($(this).text());
					$("#"+o.selectbox_id+" option:selected").attr("selected",false);
                    $("#"+o.selectbox_id+" option[value='" + current_value + "']").attr("selected", "selected");
                    $('.jelectbox_main a',obj).click();
					var domEl = $("#"+o.selectbox_id).get(0);
      				$(this).queue(domEl.onchange);
                });
                
            });
        }
    });
})(jQuery);


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

var contentDuration = 10000;
var slideInSpeed = 750;
var fadeOutSpeed = 750;
var timeBetweenTransitions = 250;

var timer;
var screenWidth;
var imageXCoord;
var currentCenterStage;
var totalCenterStage;
var isChanging = false;
var galleryStopped = false;



$(document).ready(centerStageInit); //original



function centerStageInit(){
	//starts with content already loaded in place
	$("#center-stage li.show").show();
	currentCenterStage = 0;
	totalCenterStage = $("#center-stage li").size();
	setupRotator();
	$("#rotator-indicators li:eq(0) a").css("height", "15px");
	timer = setTimeout("centerStageOut()", contentDuration);
}

function centerStageIn(){
	//aninimates everything into place
	$("#center-stage li.show h1").animate({left:0}, slideInSpeed, "easeInOutQuad");
	var imageCounter = 0;
	$("#center-stage li.show img").each(function(){
		$(this).delay(timeBetweenTransitions*imageCounter+timeBetweenTransitions).animate({right:imageXCoord[imageCounter]}, slideInSpeed, "easeInOutQuad");
		imageCounter++;
	});
	$("#center-stage li.show .center-stage-border").delay(timeBetweenTransitions*(imageCounter+1)+timeBetweenTransitions).animate({top:135}, slideInSpeed, "easeInOutQuad");
	$("#center-stage li.show p").delay(timeBetweenTransitions*(imageCounter+1)+timeBetweenTransitions).fadeIn(slideInSpeed/2, function(){isChanging = false;});
	$("#center-stage li.show h2").delay(timeBetweenTransitions * (imageCounter + 1) + timeBetweenTransitions).fadeIn(slideInSpeed / 2, function () { isChanging = false; });
	//starts timer for fading out content
	if(!galleryStopped)
		timer = setTimeout("centerStageOut()", contentDuration);
}

function centerStageOut(){
	//fades out content and calls the reset when it finishes
	isChanging = true;
	if($.browser.msie){
		$("#center-stage li.show h1").fadeOut(fadeOutSpeed, resetCenterStage);
		$("#center-stage li.show img").fadeOut(fadeOutSpeed);
		$("#center-stage li.show p").fadeOut(fadeOutSpeed);
		$("#center-stage li.show h2").fadeOut(fadeOutSpeed);
		$("#center-stage li.show .center-stage-border").fadeOut(fadeOutSpeed);
	}else{
		$("#center-stage li.show").fadeOut(fadeOutSpeed, resetCenterStage);
	}
	$("#rotator-indicators li:eq("+currentCenterStage+") a").animate({height:0}, 500, "easeInOutQuad");
}

function resetCenterStage(){
	$("#center-stage li.show").hide();

	//check to see if it is the last carousel image then return to beginning
	if(currentCenterStage < totalCenterStage-1){
		$("#center-stage li.show").removeClass("show");
		currentCenterStage++;
		$("#center-stage li:eq("+currentCenterStage+")").addClass("show");
	}else{
		$("#center-stage li.show").removeClass("show");
		$("#center-stage li:first").addClass("show");
		currentCenterStage = 0;
	}
	
	//next rotator indicator slides in
	$("#rotator-indicators li:eq("+currentCenterStage+") a").delay(250).animate({height:15}, 500, "easeInOutQuad");
	
	findScreenWidth();
	var edgeDistance = (screenWidth-904)/2*-1-550;
	//find each image coordinate to know where to tween to
	imageXCoord = new Array();
	$("#center-stage li.show img").each(function(){
		imageXCoord.push($(this).css("right"));
	});
	//moves everything off screen and fades accordingly
	$("#center-stage li.show h1").css("left", edgeDistance+"px").fadeIn(1);
	$("#center-stage li.show img").css("right", edgeDistance+"px").fadeIn(1);
	$("#center-stage li.show .center-stage-border").css("top", "365px").fadeIn(1);
	$("#center-stage li.show").fadeIn(1);
	$("#center-stage li.show p").fadeOut(0);
	$("#center-stage li.show h2").fadeOut(0);
	
	//starts the transition over after the reset
	centerStageIn();
}

function setupRotator(){
	for(var i=0; i<totalCenterStage; i++){
		var color = $("#center-stage li:eq("+i+")").attr("class");
		$("#rotator-indicators ul").append("<li><a class='"+color+"'></a></li>");
		$("#center-stage-left").css("left", 128-(totalCenterStage*21)/2-25+"px");
		$("#center-stage-right").css("right", 128-(totalCenterStage*21)/2-22+"px");
	}
	$("#rotator-indicators ul").css("width", totalCenterStage*21);
	
	$("#rotator-indicators li").hover(function(){
		$(this).fadeTo(1, .6);
	}, function(){
		$(this).fadeTo(1, 1);
	});
	
	//event handler for clicking on indicators - turns off gallery and moves to new slide (only if not already moving)
	$("#rotator-indicators li").click(function(){
		if(!isChanging){
			//fades out the current gallery to switch to the chosen item
			centerStageOut();
			
			//stops gallery
			clearTimeout(timer);
			
			//finds out which square was clicked
			var index = $(this).index();
			currentCenterStage = index-1;
			
			galleryStopped = true;
		}
	});
	$("#center-stage-left").click(function(){
		if(!isChanging){
			//fades out the current gallery to switch to the chosen item
			centerStageOut();
			
			//stops gallery
			clearTimeout(timer);
			
			//finds out which item is previous
			if(currentCenterStage == 0)
				currentCenterStage = totalCenterStage-2;
			else
				currentCenterStage=currentCenterStage-2;

			galleryStopped = true;
		}
	});
	$("#center-stage-right").click(function(){
		if(!isChanging){
			//fades out the current gallery to switch to the chosen item
			centerStageOut();
			
			//stops gallery
			clearTimeout(timer);
			
			//finds out which item is previous
			if(currentCenterStage == totalCenterStage)
				currentCenterStage = -1;
			
			galleryStopped = true;
		}
	});
}

function findScreenWidth(){
	screenWidth = $(window).width();
}
