 $(".open").pageslide({"direction":"left"});
;
		$('.copy').append("<p>" + $(window).width() + "</p>");
        $(document).on('touchstart',function(e){
         window.touch = {};
         touch.startX = e.originalEvent.touches[0].pageX;
         touch.startY = e.originalEvent.touches[0].pageY;         
        });
        $(document).on('touchend',function(e){
         //$('.copy').append("<p>" +  e.originalEvent.changedTouches[0].pageX + "</p>");
         touch.endX = e.originalEvent.changedTouches[0].pageX;
         touch.endY = e.originalEvent.changedTouches[0].pageY;
         //$('.copy').append("<p>" + (touch.endX > touch.startX) + ":" + (touch.endY - touch.startY <= 200) + "</p>");
         if(touch.endX > touch.startX && (touch.endY - touch.startY <= 200))
          $.pageslide.close();
         else if(touch.endX < touch.startX && (touch.endY - touch.startY <= 200) && (!$('#pageslide').is(":visible"))){
          $(".open").click();
         }
        });
		$(".photo-gallery a").click(function(){
			var urls = $(this).find('img').attr('src');
			$(".modal-body").html("<div> " + "<img src='"+ urls +"'>" + "</div>");
			$(".modal-title").text(urls);
			var str = $('.modal-title').text().replace('.png', '').replace('img/', '');	
			$(".modal-title").text(str);				
		});
		$(".large-video").hide(); //hides all the .large-video divs
		$("#video-1").show(); // this is the default video to show
		$( ".video-gallery .span3" ).on( "click", function(event) {
			event.preventDefault(); 
			$(".large-video").hide();
  			var video = ($( this ).attr('id')) ;
			$("#video-" + video).show();
 
		});