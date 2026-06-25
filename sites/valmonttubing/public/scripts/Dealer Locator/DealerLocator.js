$(document).ready(function () {
    hideMapAndListView();

    var bindLiEvents = function () {
        $('select').off('click');

        $('select').on('click', function (e) {
            if ($('#milesCode').find('.dropText').text() != 'Exact Match')
                e.stopPropagation();
        });
    };

    var populateStateDropdown = function (data) {
        $("#StateList").html(template.parseTemplate($("#State_template").html(), data.d));
        $(".refresh").attr('src', $('#hdnRefreshImagePath').val());

        $("#lblDealerCountInState").hide();

        $("#imgRefreshState").on('click', function () {
            var countryId = "{countryCode: '" + $('#ddlCountry').val() + "'}";

            makeServiceCall('PopulateStateDropdown', populateStateDropdown, countryId);

            $("#lblDealerCountInState").hide();
        });

        $('#ddlState').on('change', function () {
            if ($('#ddlState').val() == "") {
                $('#ddlState').val($('#hdnState').val());
                var countryId = "{countryCode: '" + $('#ddlCountry').val() + "'}";

                makeServiceCall('PopulateStateDropdown', populateStateDropdown, countryId);
                return false;
            }
            $('#hdnState').val($('#ddlState').val());

            $(this).siblings('a').find('.dropText').text($(this).find('option:selected').text());

            $('#txtCity').val("");
            $('#txtZip').val("");
            setDistanceModeToExactMatch();

            var stateId = "{countryCode: '" + $('#ddlCountry').val() + "', stateCode: '" + $('#ddlState').val() + "' }";

            makeServiceCall('GetDealerCountInState', getDealerCountInState, stateId);

            makeServiceCall('PopulateMilesDropdown', populateMilesDropdown, {});
        });

        $('#ddlState').attr('disabled', true);
        var countryVal = $('#countryCode').find('.dropText').find('#lblSelectCountry').text();

        if (data.d.length > 0) {
            $('#stateCode').removeClass('disabled');
            $('#ddlState').attr('disabled', false);
        }

        bindLiEvents();
    };

    var populateCountryDropdown = function (data) {

        $("#CountryList").html(template.parseTemplate($("#Country_template").html(), data.d));

        $(".refresh").attr('src', $('#hdnRefreshImagePath').val());

        $('#ddlState').val('0');
        $('#ddlMiles').val('0');
        $("#lblDealerCountInCountry").hide();

        var countryId = "{countryCode: 'US'}";
        makeServiceCall('PopulateStateDropdown', populateStateDropdown, countryId);

        disableControls();

        init_world_map();
        $('#spnMapListView').show();

        $("#imgRefresh").on('click', function () {
            makeServiceCall('PopulateCountryDropdown', populateCountryDropdown, {});
            ResetCountry();

            var countryId = "{countryCode: '" + $('#ddlCountry').val() + "'}";

            makeServiceCall('PopulateStateDropdown', populateStateDropdown, countryId);

            $("#lblDealerCountInCountry").hide();
            $("#lblDealerCountInState").hide();

        });

        $('#ddlCountry').on('change', function () {
            ResetCountry();

            $('#hdnCountry').val($('#ddlCountry').val());

            $(this).siblings('a').find('.dropText').text($(this).find('option:selected').text());

            var countryId = "{countryCode: '" + $('#ddlCountry').val() + "'}";

            makeServiceCall('PopulateStateDropdown', populateStateDropdown, countryId);

            $('#stateCode').removeClass('disabled');
            $('#ddlState').attr('disabled', false);

            makeServiceCall('GetDealerCountInCountry', getDealerCountInCountry, countryId);

            $('#lblCountryValidationMsg').hide();
        });

        bindLiEvents();
        $("#btnSearch").focus();
    };

    var populateMilesDropdown = function (data) {
        $("#MilesList").html(template.parseTemplate($("#Miles_template").html(), data.d));

        $('#ddlMiles').on('change', function () {
            $(this).siblings('a').find('.dropText').text($(this).find('option:selected').text());
        });
        bindLiEvents();

        setDistanceModeToExactMatch();
    };

    var getDealerCountInCountry = function (data) {
        var countryWithCount = $("#hdnCountryCount").val() + " " + data.d;

        $("#lblDealerCountInCountry").text(countryWithCount);
        $("#lblDealerCountInCountry").show();
    };

    var getDealerCountInState = function (data) {
        var stateWithCount = $("#hdnStateCount").val() + " " + data.d;
        $("#lblDealerCountInState").text(stateWithCount);
        $("#lblDealerCountInState").show();
    };

    var populateMapListData = function (data) {
        if (!data.d || data.d.Markers.length == 0) {
            $('#lblMsg').text($('#hdnDealersNotFound').val());
            $('#lblMsg').show();
            hideMapAndListView();
            return false;
        }

        $("select[name='ddlState'] option:eq(0)").attr("disabled", "disabled");

        init_map("map_canvas", data.d.Latitude, data.d.Longitude, data.d.Markers, data.d.InfoWindow, data.d.IsRegionalOffice);

        var miles = $('#ddlMiles').val();

        $("#dealerListContent").html(template.parseTemplate($("#Dealer_template").html(), data.d.Dealers));

        $(".facebook").attr('src', $('#hdnFacebookImgPath').val());
        $(".twitter").attr('src', $('#hdnTwitterImgPath').val());
        $(".star").attr('src', $('#hdnStarImgPath').val());
        $(".email").attr('src', $('#hdnEmailImgPath').val());

        setPagination();

        $('#list_view_space').show();

        $('.accordionContent .row-fluid').off('click');

        $('.accordionContent .row-fluid').on('click', function () {
            var self = this;

            if (!$(self).find('.acontent').is(':visible')) {
                $('.icon-chevron-down').removeClass('icon-chevron-down').addClass('icon-chevron-right');
                $(self).find('.icon-chevron-right').removeClass('icon-chevron-right').addClass('icon-chevron-down');
                $('.acontent').hide();
                selectMarker($(this).index());
                $(self).find('.acontent').show(100);
            } else {
                $('.acontent').hide();
                $('.icon-chevron-down').removeClass('icon-chevron-down').addClass('icon-chevron-right');
                for (var j = 1; j < gmarkers.length; j++)
                    ginfoWindw[j].close();
            }
        });

        $('.acontent').on('click', function (e) { e.stopPropagation(); });
        bindLiEvents();

        $('.email-link').on('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            if ($(this).attr('href') == '#ma') {
                connectSocial($(this).attr('href'));
                var dealerMail = $(this).data('myvalue');
                $('#userEmail').val(dealerMail);
                $('#lblSendToFriend').text($('#hdnSendMail').val());
            }
        });

        $('.social_btn a').on('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            $('.social_btn a').removeClass('active');
            $(this).addClass('active');
            $('#lblSendToFriend').text($('#hdnSendMailToFriend').val());

            if ($(this).attr('href') == '#ma') {
                connectSocial($(this).attr('href'));

                var dealerDeatails = $(this).data('myvalue');
                $('#comments').val(dealerDeatails);
            }
            else
                NewWindow($(this).attr('href'), 'template_window', '500', '400', 'yes', 'center');
        });
    };

    var sendMail = function () {
        $('#lblMailMsg').text('Mail sent successfully!');
        $("#btnClear").click();
        $('#lblMailMsg').show();
    };

    makeServiceCall('PopulateCountryDropdown', populateCountryDropdown, {});

    makeServiceCall('PopulateMilesDropdown', populateMilesDropdown, {});

    hideMessage();

    $("#btnSearch").on('click', function () {
        var countryCode;
        var state;
        var miles;
        hideMessage();

        var stateValue = $('#stateCode').find('.dropText').find('#lblState').text();
        if (stateValue != "")
            state = "0";
        else
            state = $('#ddlState').val();

        var countryVal = $('#countryCode').find('.dropText').find('#lblSelectCountry').text();
        if (countryVal != "") {
            $('#lblCountryValidationMsg').text($('#hdnCountryValidationMsg').val());
            $('#lblCountryValidationMsg').show();
            return false;
        }
        else
            countryCode = $('#ddlCountry').val();

        var city = $('#txtCity').val().toUpperCase();
        var zip = $('#txtZip').val().toUpperCase();
        var distance = $('input[name=rbDistance]:radio:checked').val();

        var miles = $('#ddlMiles').val();

        hideMapAndListView();

        var matches = city.match(/\d+/g);

        if (($('#txtCity').val() != "" && $('#txtCity').val().length < 3) || (matches != null)) {
            $('#lblCityValidationMsg').text($('#hdnCityValidationMsg').val());
            $('#lblCityValidationMsg').show();
            return false;
        }

        if ($('#txtZip').val() != "" && $('#txtZip').val().length < 5) {
            $('#lblZipValidationMsg').text("Please enter proper Zip code");
            $('#lblZipValidationMsg').show();
            return false;
        }

        var data = "{countryCode: '" + countryCode + "',state : '" + state + "',distance: '" + distance + "',city: '" + city + "',zip: '" + zip + "',miles: '" + miles + "' }";
        makeServiceCall('SearchDealers', populateMapListData, data);
    });

    $('#userEmail').keyup(function (e) { $('#lblMailMsg').hide(); });

    $('#myEmail').keyup(function (e) { $('#lblMailMsg').hide(); });

    $('#comments').keyup(function (e) { $('#lblMailMsg').hide(); });

    $("#btnSubmit").on('click', function () {
        var fromMail = $('#userEmail').val();
        var toMail = $('#myEmail').val();
        var comments = $('#comments').val();

        if (IsEmail(fromMail) == false) {
            $('#lblMailMsg').text('Invalid mail address');
            $('#lblMailMsg').show();
            return false;
        }

        if (IsEmail(toMail) == false) {
            $('#lblMailMsg').text('Invalid mail address');
            $('#lblMailMsg').show();
            return false;
        }

        if (comments == '') {
            $('#lblMailMsg').text('Please enter Comments');
            $('#lblMailMsg').show();
            return false;
        }

        var data = "{fromMail: '" + fromMail + "',toMail : '" + toMail + "',comments: '" + comments + "' }";
        makeServiceCall('SendMail', sendMail, data);
    });

    $("#btnClear").on('click', function () {
        $('#userEmail').val('');
        $('#myEmail').val('');
        $('#comments').val('');
        $('#lblMailMsg').hide();
    });

    $("#btnClose").on('click', function () { $("#btnClear").click(); });

    $('#txtCity').keydown(function (e) {
        var key = e.keyCode;
        if (!((key == 13) || (key == 9) || (key == 8) || (key == 32) || (key == 46) || (key >= 35 && key <= 40) || (key >= 65 && key <= 90)))
            e.preventDefault();
    });

    $('#txtCity').keyup(function (e) {
        if (($('#txtCity').val() != "") || ($('#txtZip').val() != "")) {
            setDistanceModeToRadialDistance();
            $('#lblCityValidationMsg').hide();
        }
        else
            setDistanceModeToExactMatch();

        enterbuttonClick(e);
    });

    $('#txtCity').blur(function (e) {
        if (($('#txtCity').val() != "") || ($('#txtZip').val() != ""))
            setDistanceModeToRadialDistance();
        else
            setDistanceModeToExactMatch();

        enterbuttonClick(e);
    });

    $('#txtZip').keyup(function (e) {
        if (($('#txtZip').val() != "") || ($('#txtCity').val() != "")) {
            setDistanceModeToRadialDistance();
            $('#lblZipValidationMsg').hide();
        }
        else
            setDistanceModeToExactMatch();

        enterbuttonClick(e);
    });

    $('input[name=rbDistance]').on('click', function () {
        var targetId = $(this).attr('id');

        if (targetId == "rbDistance_0") {
            $('#milesCode').addClass('disabled');
            $('#ddlMiles').attr('disabled', true);
            $('#milesCode').find('.dropText').text('Exact Match');
        }
        else {
            $('#milesCode').removeClass('disabled');
            $('#ddlMiles').attr('disabled', false);
            $('#milesCode').find('.dropText').text('50');
            $('#ddlMiles').val('50');
        }
    });

    $('.viewChange .btn').on('click', function () {
        var self = $(this);
        $('.viewChange .btn').removeClass('active');
        self.addClass('active');

        var targetelem = $('#map_view_space');
        $('#map_view_space').remove();

        if ($(self).attr('value') == 'm')
            $('#list_view_space').before(targetelem);
        else
            $('#list_view_space').after(targetelem);

        $("#btnSearch").click();
    });

    function setDistanceModeToExactMatch() {
        //Set Option to Exact Match Mode Option
        $('input[name=rbDistance]').removeAttr('disabled');
        $('#rbDistance_0').removeClass('disabled');
        $('#rbDistance_0').attr('checked', 'checked');
        $('input[id="rbDistance_0"]').attr('checked', 'checked');
        $('#rbDistance_0').click();

        //Disable Distance Mode Option
        $('#rbDistance_1').addClass('disabled');
        $('#milesCode').addClass('disabled');
        $('#ddlMiles').attr('disabled', 'disabled');
        $('#milesCode').find('.dropText').text('Exact Match');
        $('input[name=rbDistance]').attr('disabled', 'disabled');

        //Hide Option Buttons As User is no Longer in Control
        $('input[name=rbDistance]').parent().css("position", "absolute").css("top", "-150px");
        $('#rbDistance_0, #rbDistance_1, input[name=rbDistance], #lblExactMatch, #lblRadialDistance').css("display", "none");
    }

    function setDistanceModeToRadialDistance() {
        //Set Option to Radial Distance Mode
        $('#rbDistance_1').removeClass('disabled');
        $('input[name=rbDistance]').removeAttr('disabled');
        $('#rbDistance_1').attr('checked', 'checked');
        $('input[id="rbDistance_1"]').attr('checked', 'checked');
        $('#rbDistance_1').click();

        //Disable Exact Match Mode Option
        $('#rbDistance_0').addClass('disabled');
        $('input[name=rbDistance]').attr('disabled', 'disabled');

        //Hide Option Buttons As User is no Longer in Control
        $('input[name=rbDistance]').parent().css("position", "absolute").css("top", "-150px");
        $('#rbDistance_0, #rbDistance_1, input[name=rbDistance], #lblExactMatch, #lblRadialDistance').css("display", "none");
    }

    function disableControls() {
        $('#txtCity').attr('disabled', true);
        $('#txtZip').attr('disabled', true);
    }

    function enanbleControls() {
        $('#txtCity').removeAttr('disabled');
        $('#txtZip').removeAttr('disabled');
        return false;
    }

    $('input, textarea').placeholder();

    function enterbuttonClick(e) {
        if (e.keyCode == 13)
            $("#btnSearch").click();
    }

    function ResetCountry() {
        $('#txtCity').val("");
        $('#txtZip').val("");

        hideMapAndListView();

        setDistanceModeToExactMatch();

        enanbleControls();

        $('#lblCountryValidationMsg').hide();
        $("#lblDealerCountInState").hide();
        $('#lblMsg').hide();

        makeServiceCall('PopulateMilesDropdown', populateMilesDropdown, {});

        $('input:radio:checked').val('EM');

        if ($('#ddlCountry').val() == "") {
            $('#ddlCountry').val($('#hdnCountry').val());
            makeServiceCall('PopulateCountryDropdown', populateCountryDropdown, {});

            $("#lblDealerCountInCountry").hide();
            return false;
        }
    }

    var model = $('#myModal').detach();
    $('body').append(model);
});

function hideMessage() {
    $('#lblMsg').text("");
    $('#lblMsg').hide();
    $('#lblCountryValidationMsg').hide();
    $('#lblCityValidationMsg').hide();
    $('#lblZipValidationMsg').hide();
}

function previous() {
    var currPage = parseInt($('#currentPage').val());
    var newPage = parseInt($('#currentPage').val()) - 1;

    if ($('.page_link[longdesc=' + newPage + ']').length) {
        var listPerPageFrom = parseInt($('#listPerPage').val());
        var listPerPageTo = listPerPageFrom - 10;
        var newList = (currPage) % 10;

        if (newList == 0) {
            $('.next_link').attr('disabled', false);

            $('#listPerPage').val(listPerPageTo);

            listPerPageFrom = (listPerPageTo + 1) - 10;

            $('#page_navigation li:lt(' + listPerPageTo + 1 + ')').show();
            $('#page_navigation li:gt(' + listPerPageTo + ')').hide();
            $('#page_navigation li:lt(' + (listPerPageFrom) + ')').hide();

            $('#page_navigation li:first').show();
            $('#page_navigation li:last').show();
        }

        $('.page_link[longdesc=' + newPage + ']').click();
    }
}

function next() {
    var newPage = parseInt($('#currentPage').val()) + 1;

    if ($('.page_link[longdesc=' + newPage + ']').length) {
        $('.previous_link').attr('disabled', false);

        var listPerPageFrom = parseInt($('#listPerPage').val());
        var listPerPageTo = listPerPageFrom + 10;
        var newList = (newPage) % 10;

        if (newList == 0) {
            $('#listPerPage').val(listPerPageTo);

            $('#page_navigation li:lt(' + (listPerPageFrom + 1) + ')').hide();
            $('#page_navigation li:gt(' + listPerPageFrom + ')').show();
            $('#page_navigation li:gt(' + listPerPageTo + ')').hide();

            $('#page_navigation li:first').show();
            $('#page_navigation li:last').show();
        }

        $('.page_link[longdesc=' + newPage + ']').click();
    }
}

function go_to_page(pageNum) {
    $('.previous_link').attr('disabled', false);
    $('.next_link').attr('disabled', false);

    //get the number of items shown per page
    var showPerPage = parseInt($('#showPerPage').val());

    //get the element number where to start the slice from
    var startFrom = (pageNum * showPerPage) + 1;

    //get the element number where to end the slice
    var endOn = startFrom + showPerPage;

    //hide all children elements of content div, get specific items and show them
    $('#dealerListContent').children().css('display', 'none').slice(startFrom, endOn).css('display', 'block');
    $('#dealerListContent').children().eq(0).css('display', 'block');

    /*get the page link that has longdesc attribute of the current page and add active_page class to it
    and remove that class from previously active page link*/
    $('#page_navigation .active').removeClass('active');
    $('.page_link[longdesc=' + pageNum + ']').parent().addClass('active');

    //update the current page input field
    $('#currentPage').val(pageNum);

    var prevPage = parseInt($('#currentPage').val()) - 1;

    if (!$('.page_link[longdesc=' + prevPage + ']').length) {
        $('.previous_link').attr('disabled', true);
        $('.previous_link').hide();
    }
    else
        $('.previous_link').show();

    var nextPage = parseInt($('#currentPage').val()) + 1;

    if (!$('.page_link[longdesc=' + nextPage + ']').length) {
        $('.next_link').attr('disabled', true);
        $('.next_link').hide();
    }
    else
        $('.next_link').show();
}

function setPagination() {
    var showPerPage = 20;
    var numberOfItems = $('#dealerListContent').children().size();
    var numberOfPages = Math.ceil((numberOfItems - 1) / showPerPage);

    $('#currentPage').val(0);
    $('#listPerPage').val(10);
    $('#showPerPage').val(showPerPage);

    var navigationHtml = '<div class="pagination"><ul> <li><a id="prevLink" class="previous_link" href="javascript:previous();">Prev</a></li>';
    var currentLink = 0;
    while (numberOfPages > currentLink) {
        navigationHtml += '<li><a class="page_link" onclick="go_to_page(' + currentLink + ')" href="javascript:go_to_page(' + currentLink + ')" longdesc="' + currentLink + '">' + (currentLink + 1) + '</a></li>';
        currentLink++;
    }
    navigationHtml += '<li><a class="next_link" href="javascript:next();">Next</a></li></ul></div>';

    $('#page_navigation').html(navigationHtml);

    $('.previous_link').attr('disabled', true);
    $('.previous_link').hide();

    if ((numberOfItems - 1) <= showPerPage) {
        $('.next_link').attr('disabled', true);
        $('#page_navigation').hide();
    }
    else
        $('#page_navigation').show();

    //add active_page class to the first page link
    var pageNum = parseInt($('#currentPage').val());
    $('.page_link[longdesc=' + pageNum + ']').parent().addClass('active');

    $('#page_navigation li:gt(10)').hide();
    $('#page_navigation li:last').show();

    //hide all the elements inside content div
    $('#dealerListContent').children().css('display', 'none');

    //and show the first n (showPerPage) elements
    $('#dealerListContent').children().slice(0, 21).css('display', 'block');
}