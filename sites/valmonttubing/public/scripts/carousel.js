var startingImage = 0;
var goForward = true;

    $(document).ready(carouselInit);

    function carouselInit() {
        carouselSetup();
    }

    function carouselSetup() {
        var numOfImages = $("#carousel li").size();

        for (var i = 0; i < numOfImages; i++) {
            var color = $("#carousel li:eq(" + i + ")").attr("class");
            $("#rotator-indicators ul").append("<li><a class='" + color + "'></a></li>");
        }
        $("#rotator-indicators ul").css("width", numOfImages * 21);
        $("#center-stage-left").css("left", 88 - (numOfImages * 21) / 2 - 25 + "px");
        $("#center-stage-right").css("right", 88 - (numOfImages * 21) / 2 - 22 + "px");

        if (numOfImages > 0) {
            $("#rotator-indicators ul li").click(function () {
                var squareIndex = $(this).index();
                if (!$("#carousel li:eq(" + squareIndex + ")").is(":visible")) {
                    $('#carousel').cycle('pause');
                    $("#carousel li:visible").fadeTo(600, 0, function () { $(this).hide(); });
                    $("#carousel li:eq(" + squareIndex + ")").fadeTo(600, 1, function () { $(this).show(); });
                    $("#rotator-indicators ul a.show").removeClass("show");
                    $("a", this).addClass("show");
                }
            });
        }

        $('#carousel').cycle({
            fx: 'fade',
            speed: 600,
            timeout: 4000,
            after: function () {

                if (goForward) {
                    startingImage++;
                    if (startingImage > numOfImages)
                        startingImage = 1;
                } else {
                    startingImage--;
                    if (startingImage < 1)
                        startingImage = numOfImages;
                }
                $("#rotator-indicators ul a.show").removeClass("show");
                $("#rotator-indicators ul li:eq(" + (startingImage - 1) + ") a").addClass("show");
            }
        });

        $("#center-stage-right").click(function () {
            goForward = true;
            $('#carousel').cycle('next');
            $('#carousel').cycle('pause');
        });
        $("#center-stage-left").click(function () {
            goForward = false;
            $('#carousel').cycle('prev');
            $('#carousel').cycle('pause');
        });

    }

