$(document).ready(newsInit);

function newsInit(){
	setupNews();
}

function setupNews(){
	$("#news-articles ul").addClass("hide");
	$("#news-articles ul:first").removeClass("hide");
	
	$("#news-dates li:first").addClass("at");
	
	$("#news-dates a").click(function(){
		var id = $(this).html().toLowerCase().replace(/(<([^>]+)>)/ig,"");
		$("#news-articles ul").addClass("hide");
		$("#"+id).removeClass("hide");
		
		$("#news-dates li.at").removeClass("at");
		$(this).parent().addClass("at");
	});
}