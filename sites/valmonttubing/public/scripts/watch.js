var startingImage = 0;

    $(document).ready(function () {
        $('.dhtml').show();

        $('.flyout-container').hide();
        $('.flyout>.copy').toggle(
		function () {
		    $(this).parent()
				.addClass('flyout-open');
		    //.mouseleave(function(){
		    //	$(this)
		    //		.delay(3000)
		    //		.queue(function(){
		    //			$('>.copy',this).click();
		    //			$(this).dequeue();
		    //		});
		    //})
		    //.mouseenter(function(){
		    //	$(this).clearQueue();
		    //});
		    $('.flyout-container', $(this).parent()).slideDown('normal');
		},
		function () {
		    $(this).parent()
				.removeClass('flyout-open');
		    //.unbind('mouseleave')
		    //.unbind('mouseenter')
		    //.clearQueue();
		    $('.flyout-container', $(this).parent()).slideUp('normal');
		}
	);
        $('.flyout .flyout-close').click(function () {
            $('>.copy', $(this).parents('.flyout')).click();
            return false;
        });

        $("#contact").click(showContact);
        $("#contactFlyout").click(showContact);

        rotatorSetup();

        openBios();

    });

    function openBios() {
        var bioOpen = false;
        $("#engineered-excerpt a").click(function () {
            $("#engineered-excerpt-copy").slideToggle(500);
            if (bioOpen) {
                $("#open-close").css("background-position", "left");
                bioOpen = false;
            } else {
                $("#open-close").css("background-position", "right");
                bioOpen = true;
            }
        });
    }

    function rotatorSetup() {
        var numOfImages = $("#image-rotator li").size();
        for (var i = 1; i <= numOfImages; i++) {
            $("#square-indicator").append("<li></li>");
        }

        if (numOfImages > 0) {
            $("#square-indicator li").click(function () {
                var squareIndex = $(this).index();
                if (!$("#image-rotator li:eq(" + squareIndex + ")").is(":visible")) {
                    $('#image-rotator').cycle('stop');
                    $("#image-rotator li:visible").fadeTo(600, 0, function () { $(this).hide(); });
                    $("#image-rotator li:eq(" + squareIndex + ")").fadeTo(600, 1, function () { $(this).show(); });
                    $("#square-indicator .at").removeClass("at");
                    $(this).addClass("at");
                }
            });
        }

        $('#image-rotator').cycle({
            fx: 'fade',
            speed: 1000,
            timeout: 5000,
            after: function () {
                $("#square-indicator .at").removeClass("at");
                $("#square-indicator li:eq(" + startingImage + ")").addClass("at");
                startingImage++;
                if (startingImage > numOfImages - 1)
                    startingImage = 0;
            }
        });
    }

    function whenVisible(element, callback) {
        element = $(element);

        if (element.length == 0 || checkIfVisible()) return;

        var parent;
        if (element.is(':hidden')) {
            parent = element.parents(':hidden:last');
            parent.watch("display,visibility", checkIfVisible);
        }

        $(window).resize(checkIfVisible);
        $(window).scroll(checkIfVisible);

        function checkIfVisible() {
            if (isVisible(element) == false) return false;

            if (parent != null) parent.unwatch("display,visibility");
            $(window).unbind('resize', checkIfVisible);
            $(window).unbind('scroll', checkIfVisible);

            callback();
            return true;
        }
    }

    function isVisible(element) {
        element = $(element);

        if (element.is(':hidden')) return false;

        var windowHeight = $(window).height();
        var scrollTop = $(document).scrollTop();
        var scrollBottom = windowHeight + scrollTop;

        var offset = element.offset().top;
        var height = element.height();

        if (offset > scrollTop && offset + height / 2 < scrollBottom) return true;
        return false;
    }

    function showContact() {
        if ($("#contactFlyout").css("display") == "none")
            $("#contactFlyout").slideDown("fast");
        else
            $("#contactFlyout").slideUp("fast");
    }
