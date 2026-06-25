


$(document).ready(productFinderInit);

function productFinderInit(){
	$("#product-finder a").click(function(){
	
		var menu = $(this).attr("data-menu");
		var parent = $(this).parent().parent().parent().attr("id");
		
		if(parent == "product-finder-column-1"){
			$("#product-finder-column-1 a").removeClass("selected");
			$(this).addClass("selected");
			
			$("#product-finder-column-2 ul").removeClass("show");
			$("#"+menu).addClass("show");
			
			$("#product-finder-column-2 a").removeClass("selected");
			$("#product-finder-column-3 ul").removeClass("show");
		}else if(parent == "product-finder-column-2"){
			$("#product-finder-column-2 a").removeClass("selected");
			$(this).addClass("selected");
			
			$("#product-finder-column-3 ul").removeClass("show");
			$("#"+menu).addClass("show");
			
			var tag = $(this).attr("data-tag");
			
			$("#product-finder-column-3 li").removeClass("show");
			$("#product-finder-column-3 li").each(function(){
				if($("a", this).hasClass(tag))
					$(this).addClass("show");
			});
			
		}

	});
	$("#search-type li:first a").trigger("click");
}

