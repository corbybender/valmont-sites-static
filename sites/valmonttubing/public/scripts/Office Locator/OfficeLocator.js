$(document).ready(function () {
    hideMapAndListView();

    var bindLiEvents = function () {
        $('select').off('click');
        $('select').on('click', function (e) { e.stopPropagation(); });
    };

    var populateRegionDropdown = function (data) {
        $("#RegionList").html(template.parseTemplate($("#Region_template").html(), data.d));

        var regionCode;
        $('#divbuttons').hide();

        init_world_map();
        $('#spnMapListView').show();

        $('#ddlRegion').on('change', function () {
            if ($('#ddlRegion').val() == "") {
                $('#ddlRegion').val($('#hdnRegion').val());
                makeServiceCall('PopulateRegionDropdown', populateRegionDropdown, {});
                hideMapAndListView();
                return false;
            }
            $('#hdnRegion').val($('#ddlRegion').val());

            $(this).siblings('a').find('.dropText').text($(this).find('option:selected').text());

            var regionVal = $('#regionCode').find('.dropText').find('#lblRegion').text();

            if (regionVal != "") {
                $('#lblMsg').text("Please select the Region");
                return false;
            }
            else {
                regionCode = $('#ddlRegion').val();
                $('#divbuttons').show();
                showMapListView();
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

        bindLiEvents();

        $("select[name='ddlRegion'] option:eq(0)").attr("disabled", "disabled");
    };

    var populateMapListData = function (data) {
        $("select[name='ddlRegion'] option:eq(0)").attr("disabled", "disabled");

        if (!data.d || data.d.Markers.length == 0) {
            $('#lblMsg').text($('#hdnDealersNotFound').val());
            hideMapAndListView();
            return false;
        }

        init_map("map_canvas", data.d.Latitude, data.d.Longitude, data.d.Markers, data.d.InfoWindow, data.d.IsRegionalOffice);

        $("#dealerListContent").html(template.parseTemplate($("#Dealer_template").html(), data.d.Dealers));

        $(".facebook").attr('src', $('#hdnFacebookImgPath').val());
        $(".twitter").attr('src', $('#hdnTwitterImgPath').val());
        $(".star").attr('src', $('#hdnStarImgPath').val());
        $(".email").attr('src', $('#hdnEmailImgPath').val());

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
                for (var i = 1; i < gmarkers.length; i++)
                    ginfoWindw[i].close();
            }
        });

        $('.acontent').on('click', function (e) { e.stopPropagation(); });

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

        bindLiEvents();

    };

    var sendMail = function () {
        $('#lblMailMsg').text('Mail sent successfully!');
        $("#btnClear").click();
        $('#lblMailMsg').show();
    };

    makeServiceCall('PopulateRegionDropdown', populateRegionDropdown, {});

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

    $('#userEmail').keyup(function (e) { $('#lblMailMsg').hide(); });

    $('#myEmail').keyup(function (e) { $('#lblMailMsg').hide(); });

    $('#comments').keyup(function (e) { $('#lblMailMsg').hide(); });

    $("#btnClear").on('click', function () {
        $('#userEmail').val('');
        $('#myEmail').val('');
        $('#comments').val('');
        $('#lblMailMsg').hide();
    });

    $("#btnClose").on('click', function () { $("#btnClear").click(); });

    function showMapListView() {
        var regionCode = $('#ddlRegion').val();

        if (regionCode == undefined) regionCode = "1";

        ClearMarkers();
        hideMapAndListView();

        var data = "{region: '" + regionCode + "' }";

        makeServiceCall('SearchDealers', populateMapListData, data);
    }

    $('input, textarea').placeholder();

    var model = $('#myModal').detach();
    $('body').append(model);
});