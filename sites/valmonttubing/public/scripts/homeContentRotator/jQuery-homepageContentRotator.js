/* ============================
   contentRotator
   
   Desc:    jQuery script
   Author:  Roko C. Buljan, roko.cb[at]gmail.com
   Company: I R i D i A N G R O U P
   Web:     whately.com 
   Date:    01/16/2013
   ============================ */

(function ( $ ) {	/* REMAP $ TO JQUERY   */
$(function() {		/* DOM READY SHORTHAND */

	/*// MIAN SETUP /////////////////*/
	var fade  = 650,
		pause = 3500,
		C     = 0;		// "start from" Counter (zero based)
	/*///////////////////////////////*/

	var $tabs			= $('.contentRotator-tab'),
		$mainImage		= $('#contentRotator-mainImage'),
		$title			= $('#contentRotator-descriptionTitle'),
		$descriptions	= $('#contentRotator-descriptions'),
		$desc			= $('.contentRotator-description'),
		$nav			= $('#contentRotator-navButtons'),
		N				= $desc.length,
		intv;
				
	/* MAKE ENTIRE TAB CLICKABLE (follow inner A href URL ) */
	
	$tabs.click(function(){
		var goTo = $(this).find('a').attr('href');
		window.location = goTo;
	});
		
		
	/* GENERATE NAV BUTTONS */
	
	for(i=0; i<N; i++) {
		$nav.append('<div class="contentRotator-navBtn"/>');
	}
	$nav.prepend('<div id="contentRotator-prev"/>').append('<div id="contentRotator-next"/>');
		
		
	/* GRAB CONTENT FROM HIDDEN DESCRIPTIONS FIELDS */
	
	$desc.each(function(){
		$(this).find('img').appendTo( $mainImage );	// GRAB DESCRIPTION IMAGE
		$(this).find(':header').appendTo( $title );	// GRAB TITLE
		$(this).appendTo( $descriptions ).show();		// FINALLY CLONE TO descriptions main element
	});
	
	
	/* ASSIGN VARS TO REPLACED ELEMENTS */
	var $_mainImages   = $mainImage.find('img'),
		$_Titles       = $title.find(':header'),
		$_nav_btns     = $('.contentRotator-navBtn'),
		$_Descriptions = $descriptions.find('div');
	
	/* FIRST presentation on DOM ready */
	$_mainImages.hide().eq(C).show();
	$_Titles.hide().eq(C).show();
	$_Descriptions.hide().eq(C).show();
	$_nav_btns.eq(C).addClass('jQ_active');
	$tabs.eq(C).addClass('jQ_active');
	
	/* ANIMATIONS */
	
	function runAnimations(){	
		/* FADE */		
		  $_mainImages.eq(C).stop(1).fadeTo(fade,1).siblings().stop(1).fadeTo(fade,0);
		      $_Titles.eq(C).stop(1).fadeTo(fade,1).siblings().stop(1).fadeTo(fade,0);
		$_Descriptions.eq(C).stop(1).fadeTo(fade,1).siblings().stop(1).fadeTo(fade,0);			
		/* BUTTONS / TABS - ACTIVE STATES */		
		     $tabs.removeClass('jQ_active').eq(C).addClass('jQ_active');
		$_nav_btns.removeClass('jQ_active').eq(C).addClass('jQ_active');
	}
	
	/* AUTO-ANIMATE */
	function autoAnimate(){
		intv = setInterval(function(){
			$('#contentRotator-next').click();
		}, pause);
	}
	autoAnimate();
	
	/* PAUSE AUTO ANIMATE */
	$('#contentRotator').on('mouseenter mouseleave', function( e ){
		var mEnt = e.type=='mouseenter' ? clearInterval(intv) : autoAnimate() ;
	});
	
	/* CLICK  PREV-NEXT */
	$('#contentRotator-navButtons').on('click', '#contentRotator-prev, #contentRotator-next', function(){
		var myID = this.id=='contentRotator-next' ? C++ : C--;
		C = C<0 ? N-1 : C%N ;
		runAnimations();
	});
	
	/* CLICK  NAVIGATION BUTTONS */
	$_nav_btns.click(function(){
		C = $(this).index() -1;
		runAnimations();
	});
	
	/* TABS HOVER */
	var hoverIntent;
	$tabs.on('mouseenter',function(){
		var ind = $(this).index();
		clearTimeout(hoverIntent);
		hoverIntent = setTimeout(function(){
			C = ind;
			runAnimations();
		},90);
	}).on('mouseleave',function(){
		$tabs.removeClass('jQ_active');
		clearTimeout(hoverIntent);
	});


});
})( jQuery ); 