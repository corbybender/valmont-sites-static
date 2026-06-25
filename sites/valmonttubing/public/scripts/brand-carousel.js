var carouselMoving = false;

    $(document).ready(brandCarouselInit);

    function brandCarouselInit() {
        setupBrandCarousel();
    }

    function setupBrandCarousel() {
        $("#gray-arrow-right-2").click(moveRight);
        $("#gray-arrow-left-2").click(moveLeft);
    }

    function moveLeft() {

        var leftCss = $("#brand-carousel").css("left");
        var leftNum = parseInt(leftCss);

        if (leftNum < 0 && !carouselMoving) {
            carouselMoving = true;
            $("#brand-carousel").animate({ left: "+=650px" }, 300, stoppedMoving);
        }
    }

    function moveRight() {

        var leftCss = $("#brand-carousel").css("left");
        var leftNum = parseInt(leftCss);
        var numOfImages = $("#brand-carousel li").size();

        if (leftNum > ((numOfImages - 5) * -129) && !carouselMoving) {
            carouselMoving = true;
            $("#brand-carousel").animate({ left: "-=650px" }, 300, stoppedMoving);
        }
    }

    function stoppedMoving() {
        carouselMoving = false;
    }
