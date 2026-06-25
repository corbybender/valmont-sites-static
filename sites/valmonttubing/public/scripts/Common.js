var map;
var bounds;
var gmarkers = [];
var ginfoWindw = [];
infowindow = new google.maps.InfoWindow();

var makeServiceCall = function (url, callBack, postData) {
    $.ajax({
        type: "POST",
        url: window.location + "/" + url,
        contentType: "application/json; charset=utf-8",
        dataType: "json",
        data: postData,
        success: function (data) {
            callBack(data);
        },
        error: function (request, status, error) { alert(request.responseText); 
        }
    });
};

var addInfo = function (status, info) {
    //  var divTag = document.createElement("div");
    //  divTag.innerHTML = "<h1>" + status + "</h1>" + info;
    //  divTag.style.backgroundColor = "DEEAF6";
    //  var body = document.getElementsByTagName("body")[0];
    //  body.appendChild(divTag);
};

var template = new function () {
    this.parseTemplate = function (str, data) {
        var err = "";
        try {
            var isallow = null;
            var func;
            if (!isallow) {
                var parseObject =
                "var p=[],print=function(){p.push.apply(p,arguments);};" +
                            "with(obj){p.push('" +
                str.replace(/[\r\t\n]/g, " ")
                   .replace(/'(?=[^#]*#>)/g, "\t")
                   .split("'").join("\\'")
                   .split("\t").join("'")
                   .replace(/<#=(.+?)#>/g, "',$1,'")
                   .split("<#").join("');")
                   .split("#>").join("p.push('")
                   + "');}return p.join('');";
                func = new Function("obj", parseObject);
            }
            return func(data);
        } catch (e) { err = e.message; }
        return "< # ERROR: " + err + " # >";
    };
};
var cloneOf = (function () {
    function clone() { }
    return function (object) {
        clone.prototype = object;
        return new clone();
    };
}());

function NewWindow(mypage, myname, w, h, scroll, pos) {
    var leftPosition = 0;
    var topPosition = 0;
    if (pos == "random") {
        leftPosition = (screen.width) ? Math.floor(Math.random() * (screen.width - w)) : 100; topPosition = (screen.height) ? Math.floor(Math.random() * ((screen.height - h) - 75)) : 100;
    }
    if (pos == "center") {
        leftPosition = (screen.width) ? (screen.width - w) / 2 : 100; topPosition = (screen.height) ? (screen.height - h) / 2 : 100;
    }
    else if ((pos != "center" && pos != "random") || pos == null) {
        leftPosition = 0;
        topPosition = 20;
    }

    var settings = 'width=' + w + ',height=' + h + ',top=' + topPosition + ',left=' + leftPosition + ',scrollbars=' + scroll + ',location=no,directories=no,status=no,menubar=no,toolbar=no,resizable=no';
    var win = window.open(mypage, myname, settings);
}

function IsEmail(email) {
    var regex = /^([a-zA-Z0-9_\.\-\+])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/;
    if (!regex.test(email)) {
        return false;
    } else {
        return true;
    }
}

function connectSocial(type) {
    switch (type) {

        case '#fb':
            break;

        case '#yt':
            break;

        case '#ma':
            $('#myModal').modal('show');
            break;
    }
}

function hideMapAndListView() {
    $('#list_view_space').hide();
}

function init_world_map() {
    var options = {
        zoom: 2,
        center: new google.maps.LatLng(0,0),
        mapTypeId: window.google.maps.MapTypeId.ROADMAP
    };
    map = new window.google.maps.Map(document.getElementById("map_canvas"), options);
    
    window.google.maps.event.addListenerOnce(map, 'idle', function () {
        map = new window.google.maps.Map(document.getElementById("map_canvas"), options);
    });

}

function init_map(mapCanvasId, lat, lng, markers, information, isRegionalOffice) {

    var myLatLng = new window.google.maps.LatLng(lat, lng);
    var options = {
        zoom: 11,
        center: myLatLng,
        mapTypeId: window.google.maps.MapTypeId.ROADMAP

    };

    var mapCanvas = document.getElementById(mapCanvasId);

    map = new window.google.maps.Map(mapCanvas, options);

    if (markers && markers.length > 0) {

        if (markers && markers.length > 1) {
            bounds = new window.google.maps.LatLngBounds();
        }

        var distance = $('input[name=rbDistance]:radio:checked').val();
        
        if (typeof distance === 'undefined') {
            distance = 'Not Set';
        };
                
        for (var i = 0; i < markers.length; i++) {
           
            markers[i].Position = eval(markers[i].Position);

            var miles = $('#ddlMiles').val();

            if (distance.toUpperCase()  == "RD" && miles != "" && isRegionalOffice == false) {
                if (calculateDistance(lat, lng, markers[i].Latitude, markers[i].Longitude) < miles) {
                    SetMarker(map, markers[i], information[i], bounds, i + 1);
                }
            }
            else {
                SetMarker(map, markers[i], information[i], bounds, i + 1);
            }
        }

        localStorage.setItem('markerCollectionKey', gmarkers);
        localStorage.setItem('infoCollectionKey', ginfoWindw);

        window.google.maps.event.addListenerOnce(map, 'idle', function () {
            window.google.maps.event.trigger(map, 'resize');
            if (markers && markers.length > 1) {
                map.fitBounds(bounds);
                map.setCenter(bounds.getCenter());
            }
            else {
                map.setCenter(markers[0].Position);
                map.setZoom(map.getZoom() + 1);
            }
        });
    }
}

function SetMarker(map, marker, information, bounds, id) {

    var myMarker = new window.google.maps.Marker(marker);

    var infowindow;

    myMarker.setMap(map);

    gmarkers[id] = myMarker;

    if (bounds != undefined) {
        bounds.extend(myMarker.getPosition());
    }

    infowindow = new window.google.maps.InfoWindow(information);

    ginfoWindw[id] = infowindow;

    //open an info window when click on the marker  
    window.google.maps.event.addListener(myMarker, 'click', function () {

        for (var i = 1; i < gmarkers.length; i++) {
            var openInfoWindow = ginfoWindw[i];

            if (openInfoWindow != undefined) {
                openInfoWindow.close();
            }
        }
        //open list view item on click of google marker
        var rowIndex = this.ItemNo;
        selectMarker(rowIndex);
        
        $('.accordionContent .row-fluid').eq(rowIndex).click();
        var pageLimit = 20;
        var pageNum = 1;
      
        if (rowIndex > pageLimit) {
            var rowNumber = rowIndex;
            while ((rowNumber - pageLimit) > pageLimit) {
                rowNumber = rowNumber - pageLimit;
                pageNum += 1;
            }
            go_to_page(pageNum)
        }
        

        infowindow.close();
        infowindow.setContent(this.Html);
        infowindow.open(map, this);        
      
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
            else {
                NewWindow($(this).attr('href'), 'template_window', '500', '400', 'yes', 'center');
            }
        });
    });
}

function ClearMarkers() {
    if (gmarkers.length > 0) {
        for (var i = 1; i < gmarkers.length; i++) {
            gmarkers[i].setMap(null);
        }
        localStorage.removeItem('markerCollectionKey');
        localStorage.removeItem('infoCollectionKey');

        gmarkers = new Array();
        ginfoWindw = new Array();

        bounds = new window.google.maps.LatLngBounds();
    }
}

function calculateDistance(latOrigin, lngOrigin, latDestination, lngDestination) {
    try {

        var latLngOrigin = new window.google.maps.LatLng(latOrigin, lngOrigin);
        var latLngDestination = new window.google.maps.LatLng(latDestination, lngDestination);
        var distance = window.google.maps.geometry.spherical.computeDistanceBetween(latLngOrigin, latLngDestination);
        return distance * 0.000621371192;

    }
    catch (error) {
        alert(error);
    }
    return 0;
}

function selectMarker(id) {
   
    for (var i = 1; i < gmarkers.length; i++) {
        var openMarker = gmarkers[i];

        if (openMarker != undefined) {
            openMarker.setIcon($('#hdnMapPinImgPath').val());
        }

        var openInfoWindow = ginfoWindw[i];

        if (openInfoWindow != undefined) {
            openInfoWindow.close();
        }
    }

    map.setZoom(7);
    map.panTo(gmarkers[id].position);

    id = parseInt(id);
    gmarkers[id].setIcon($('#hdnSelectedPinImgPath').val());
    
}

