var curSelectItem = 0;
var totalSelectItems;


    $(document).ready(selectRotateInit);

    function selectRotateInit() {
        setupFactRotator();
    }

    function setupFactRotator() {
        totalSelectItems = $("#select-items li").size();

        $("#select-items li").hide();
        $("#select-items li:eq(" + curSelectItem + ")").attr("id", "current-select-item").show();

        //$("#gray-arrow-left, #gray-arrow-right").fadeTo(1, .5);

        //$("#gray-arrow-left").hover(hoverOnLeft, hoverOff);
        $("#gray-arrow-left").click(clickLeft);
        //$("#gray-arrow-right").hover(hoverOnRight, hoverOff);
        $("#gray-arrow-right").click(clickRight);

        $("#select-item-container .jelectbox_ul_selectbox li").click(function () {
            $("#current-select-item").hide();
            $("#current-select-item").removeAttr("id");
            $("#select-items li[data-value=" + $(this).attr("title") + "]").attr("id", "current-select-item").show();
            curSelectItem = $(this).index();
            console.log(curSelectItem);
        });
    }

    function hoverOnLeft() {
        $("#gray-arrow-left").fadeTo(1, 1).css("cursor", "pointer");
    }

    function hoverOnRight() {
        $("#gray-arrow-right").fadeTo(1, 1).css("cursor", "pointer");
    }

    function hoverOff() {
        $("#gray-arrow-left, #gray-arrow-right").fadeTo(1, .5);
    }

    function clickLeft() {

        if (curSelectItem == 0) {
            curSelectItem = totalSelectItems;
        }

        if (curSelectItem > 0) {
            curSelectItem--;
            $("#current-select-item").hide();
            $("#current-select-item").removeAttr("id");
            $("#select-items li:eq(" + curSelectItem + ")").attr("id", "current-select-item").show();
            $(".jelectbox_text").html($(".jelectbox_ul_selectbox li[value=" + $("#select-items li:eq(" + curSelectItem + ")").attr("data-value") + "]").html());
        }
    }

    function clickRight() {

        if (curSelectItem == totalSelectItems - 1) {
            curSelectItem = -1;
        }

        if (curSelectItem < totalSelectItems - 1) {
            curSelectItem++;
            $("#current-select-item").hide();
            $("#current-select-item").removeAttr("id");
            $("#select-items li:eq(" + curSelectItem + ")").attr("id", "current-select-item").show();
            $(".jelectbox_text").html($(".jelectbox_ul_selectbox li[value=" + $("#select-items li:eq(" + curSelectItem + ")").attr("data-value") + "]").html());
        }
    }
