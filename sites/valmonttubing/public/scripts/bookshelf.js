

    $(document).ready(bookShelfInit);

    function bookShelfInit() {
        bookHoverSlide();
    }

    function bookHoverSlide() {
        $('.book a[id^="annual-report"]').hover(function () {
            $(this).siblings(".online-report").css('bottom', '0');
            $(this).siblings(".pdf-report").css('top', '0');
        }, function () {
            $(this).siblings(".online-report").css('bottom', '-85px');
            $(this).siblings(".pdf-report").css('top', '-85px');
        });
        $('.book a.online-report').hover(function () {
            $(this).css('bottom', '0');
            $(this).siblings(".pdf-report").css('top', '0');
        }, function () {
            $(this).css('bottom', '-85px');
            $(this).siblings(".pdf-report").css('top', '-85px');
        });
        $('.book a.pdf-report').hover(function () {
            $(this).siblings(".online-report").css('bottom', '0');
            $(this).css('top', '0');
        }, function () {
            $(this).siblings(".online-report").css('bottom', '-85px');
            $(this).css('top', '-85px');
        });
    }
