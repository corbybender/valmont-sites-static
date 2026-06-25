
    $(document).ready(businessTabsInit);

    function businessTabsInit() {
        businessTabsSetup();
    }

    function businessTabsSetup() {
        $("#business-tab-list > li").click(function () {
            var tabContentID = $(this).attr("data-content");
            $("#business-tab-list li.show").removeClass("show");
            $("#business-content-container .show").removeClass("show");
            var content = $(this).attr("data-content");
            $("#" + content).addClass("show");
            $(this).addClass("show");
        });
    }
