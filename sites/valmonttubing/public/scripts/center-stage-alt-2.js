var contentDuration = 10000;
var slideInSpeed = 750;
var fadeOutSpeed = 750;
var timeBetweenTransitions = 100;

var headerX;
var timer;
var screenWidth;
var imageXCoord;
var currentCenterStage;
var totalCenterStage;
var isChanging = false;
var galleryStopped = false;

$(document).ready(centerStageInit);

function centerStageInit(){
	//starts with content already loaded in place
	$("#center-stage li.show").show();
	currentCenterStage = 0;
	totalCenterStage = $("#center-stage li").size();
	headerX = parseInt($("#center-stage li.show h1").css("right"));
	setupRotator();
	$("#rotator-indicators li:eq(0) a").css("height", "13px");
	timer = setTimeout("centerStageOut()", contentDuration);
}

function centerStageIn(){
	//aninimates everything into place
	$("#center-stage li.show h1").animate({right:headerX}, slideInSpeed, "easeInOutQuad");
	var imageCounter = 0;
	$("#center-stage li.show img").each(function(){
		$(this).delay(timeBetweenTransitions*imageCounter+timeBetweenTransitions).animate({left:imageXCoord[imageCounter]}, slideInSpeed, "easeInOutQuad");
		imageCounter++;
	});
	$("#center-stage li.show p").delay(timeBetweenTransitions*(imageCounter+1)+timeBetweenTransitions).fadeIn(slideInSpeed/2, function(){isChanging = false;});
	
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
	$("#rotator-indicators li:eq("+currentCenterStage+") a").delay(250).animate({height:13}, 500, "easeInOutQuad");
	
	findScreenWidth();
	var edgeDistance = (screenWidth-904)/2*-1-550;
	//find each image coordinate to know where to tween to
	imageXCoord = new Array();
	$("#center-stage li.show img").each(function(){
		imageXCoord.push($(this).css("left"));
	});
	//moves everything off screen and fades accordingly
	$("#center-stage li.show h1").css("right", edgeDistance+"px").fadeIn(1);
	$("#center-stage li.show img").css("left", edgeDistance+"px").fadeIn(1);
	$("#center-stage li.show").fadeIn(1);
	$("#center-stage li.show p").fadeOut(0);
	
	//starts the transition over after the reset
	centerStageIn();
}

function setupRotator(){
	for(var i=0; i<totalCenterStage; i++){
		var color = $("#center-stage li:eq("+i+")").attr("class");
		$("#rotator-indicators ul").append("<li><a class='"+color+"'></a></li>");
		$("#center-stage-left").css("left", (totalCenterStage*21)-879+"px");
	}
	$("#rotator-indicators ul, #rotator-indicators").css("width", totalCenterStage*21);
	
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