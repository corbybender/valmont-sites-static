jQuery(document).ready(function () {

    jQuery('.rotateThis').each(function (index) {
        jQuery(this).cycle({
            fx: 'fade',
            speed: 1300,
            timeout: 3200,
            sync: false,
            pager: '#rotatorNav',
            prev: '#previousSlide',
            next: '#nextSlide',
            pagerAnchorBuilder: function (i) {
                if (index == 0)
                    // for first slideshow, return a new anchor
                    return '<a href="#">' + (i + 1) + '</a>';
                // for 2nd slideshow, select the anchor created previously
                return '#rotatorNav a:eq(' + i + ')';
            }
        });
    });

    jQuery('#rotatorNav a').text(" ");

    jQuery('#secRotator').after('<ul id="secRotatorNav">').cycle({
        fx: 'fade',
        speed: 1800,
        timeout: 2000,
        pager: '#secRotatorNav',

        // callback fn that creates a thumbnail to use as pager anchor 
        pagerAnchorBuilder: function (idx, slide) {
            return '<li><a href="#"><img src="' + jQuery(slide).find('img:first').attr('src') + '" width="50" height="50" /></a></li>';
        }
    });

    jQuery("#secRotatorNav").carouFredSel({
        auto: {
            items: 5,
            duration: 7500,
            easing: "linear",
            timeoutDuration: 0,
            pauseOnHover: "true"
        }
    });

    jQuery(".fancybox").fancybox();

    jQuery('.secRotatorSlide').find('.slideImg').each(function () {
        var fancySrc = jQuery(this)[0].src;
        var fancyExt = fancySrc.substr(fancySrc.length - 4);
        var fancySlice = fancySrc.slice(0, -4);
        var fancyFull = fancySlice += '-full' + fancyExt;
        jQuery(this).siblings('a.enlargePic').attr('href', fancyFull);
    });

    jQuery('#secNav li a').append(' <img class="moveUp3" src="http://az276019.vo.msecnd.net/valmontstaging/matcotemplateimages/rightanglequotes.png?sfvrsn=2" />');

    jQuery('.extraLinks a').append(' <img class="moveUp2" src="http://az276019.vo.msecnd.net/valmontstaging/matcotemplateimages/rightanglequotes-grey.png?sfvrsn=2" />');

    jQuery('.extraLinksScroll, .extraLinksScroll2').each(function () {
        var extraLinksHeight = jQuery(this).height();
        if (extraLinksHeight > 150) {
            jQuery(this).css({
                'height': '150px',
                'overflow-y': 'scroll',
            });
        }

    });

    jQuery('#allTeamMembers .teamMember:nth-child(3n+3)').css({
        'margin-right': '0px',
    });

    jQuery('.teamMember').each(function () {
        var nameGetter = jQuery(this).find('h3.memberName').text();
        var uniqueID = nameGetter.replace(/\s+/g, '').replace(/\./g, '');
        jQuery(this).find('a').attr('href', '#' + uniqueID);
        jQuery(this).find('.popup').attr('id', uniqueID);
    });

    jQuery('.accordion').accordion({
        heightStyle: "content",
        collapsible: true,
        active: false,
    });

    jQuery('#clientLogos:first tr').each(function () {
        jQuery(this).find('td:last').css({
            'border-right': '0',
        });
    });

    jQuery(".rotateCompleteContent ul").find("li:odd").css("background-color", "#DDDAD7");
    jQuery(".rotateCompleteContent ul").find("li:even").css("background-color", "#EAE8E6");

    jQuery('#completeRotator').cycle({
        fx: 'fade',
        cleartype: false,
        pause: true,
        speed: 1650,
        timeout: 2000,
    });

    jQuery('#goto1').click(function () {
        jQuery('#completeRotator').cycle(0);
        jQuery('#completeRotator').cycle('pause');
        jQuery('#completeRotator').delay(2000).cycle('resume');
        return false;
    });

    jQuery('#goto2').click(function () {
        jQuery('#completeRotator').cycle(1);
        jQuery('#completeRotator').cycle('pause');
        jQuery('#completeRotator').delay(2000).cycle('resume');
        return false;
    });

    jQuery('#goto3').click(function () {
        jQuery('#completeRotator').cycle(2);
        jQuery('#completeRotator').cycle('pause');
        jQuery('#completeRotator').delay(2000).cycle('resume');
        return false;
    });

    jQuery('#goto4').click(function () {
        jQuery('#completeRotator').cycle(3);
        jQuery('#completeRotator').cycle('pause');
        jQuery('#completeRotator').delay(2000).cycle('resume');
        return false;
    });

    jQuery('#goto5').click(function () {
        jQuery('#completeRotator').cycle(4);
        jQuery('#completeRotator').cycle('pause');
        jQuery('#completeRotator').delay(2000).cycle('resume');
        return false;
    });

    jQuery('#goto6').click(function () {
        jQuery('#completeRotator').cycle(5);
        jQuery('#completeRotator').cycle('pause');
        jQuery('#completeRotator').delay(2000).cycle('resume');
        return false;
    });

    jQuery('.linkBox404').first().css({
        "padding-left": "0",
    });

    jQuery('.linkBox404').last().css({
        "border": "none",
        "padding-right": "0",
    });

});