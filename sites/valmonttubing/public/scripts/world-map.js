
    $(document).ready(worldMapInit);

    function worldMapInit() {
        worldMapSetup();
    }

    function worldMapSetup() {
        $("#americas-shape").hover(function () {
            $("#americas").show();
        }, function () {
            $("#americas").hide();
        });
        $("#emea-shape").hover(function () {
            $("#emea").show();
        }, function () {
            $("#emea").hide();
        });
        $("#apac-shape").hover(function () {
            $("#apac").show();
        }, function () {
            $("#apac").hide();
        });
    }
