var delayIncrements = 200;
var growTime = 500;
var easingType = "easeOutCubic";

var delayTime = 0;



    $(document).ready(init);

    function init() {
        whenVisible('.barContainer', function () { $(".barContainer").children().each(moveGraphs); });

        highlightRow();

        //if ie
        ieHover();
    }

    function moveGraphs() {
        var destHeight = $(this).css("height");

        $(this).css("height", "0px");
        $(this).css("display", "block");

        $(this).delay(delayTime).animate({
            height: destHeight
        }, growTime, easingType, fadeTextIn);

        delayTime += delayIncrements;

    }

    function fadeTextIn() {
        $(this).children().fadeIn();
    }

    function ieHover() {

        if (jQuery.browser.msie) {
            $("#financial-highlights tr:not('.headingRow')").hover(
		  function () {
		      $(this).addClass("hover");
		  },
		  function () {
		      $(this).removeClass("hover");
		  }
		);
        }

    }

    function highlightRow() {
        $("#financial-highlights tr").click(function () {
            if (!$(this).hasClass("headingRow")) {
                $(this).toggleClass("highlight");
            }

        });
    }
