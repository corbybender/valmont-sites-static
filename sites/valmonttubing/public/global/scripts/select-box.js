/**
 * jelectbox
 *
 * @param
 * @author serdar ozturk
 * @url http://kokulusilgi.com/blog/30-jelectbox
 */
(function($){
    $.fn.extend({
        
        jelectbox: function(options){
        
            //jelectbox settings 
            var defaults = {
                selectbox_id: 'myjelectbox',
				width: 'auto',
				height: 'auto',
				disabled_alert_message: ''
            };
            
            var options = $.extend(defaults, options);
            
            return this.each(function(){
                var o = options;
                var obj = $(this);
				var l_selected = '';
				
				l_selected = $('#'+o.selectbox_id+' option:selected').text();
                $('#'+o.selectbox_id).after('<div class="jelectbox_main" style="position:relative; width:'+o.width+';"><div style="float:left;"><span class="jelectbox_text">'+l_selected+'</span></div><div style="float:right;"><a></a></div><div style="clear:both;"></div><div class="jelectbox_options" style="position:absolute; display:none; width:'+o.width+'"><div class="jelectbox_ul_parent" style="height:'+o.height+'; overflow:auto; overflow-x:hidden;"><ul class="jelectbox_ul_selectbox"></ul></div> </div></div>');
 				$('#'+o.selectbox_id).css('display','none');
				
				// create option list
				$("#"+o.selectbox_id+" *").each(function (i) { 
					var current = $(this); 
					clsg = '';
					if (i % 2 == 0) {
						clsg = ' class="g"';
					}
					$('.jelectbox_ul_selectbox',obj).append('<li value="' + current.attr("value") + '" title="' + current.attr("title") + '"'+clsg+'>' + current.text() + '</li>');
				});
				
				// plus (1 left, 1 border)
				$('.jelectbox_options', obj).width($('.jelectbox_options', obj).width()+12);
				
				// open - hide option list
                $('.jelectbox_main a', obj).click(function(){
					if ($("#" + o.selectbox_id).get(0).disabled == false) {
						$('.jelectbox_options', obj).slideToggle(1);
						// fix selectbox z-index bug for ie
						$('.jelectbox_main').css('z-index', 0);
						$('.jelectbox_main', obj).css('z-index', 999);
						// up down select image
						if ($('.jelectbox_options', obj).css('height') != '1px')
						{
							$(this).removeClass('up');
						} else {
							$(this).addClass('up');
						}
					} else {
						// disable alert message
						alert(o.disabled_alert_message);
					}
                });
				
				// change selected
                $('ul.jelectbox_ul_selectbox li',obj).click(function(){
					var current_value = $(this).attr("value");
                    $('.jelectbox_text',obj).html($(this).text());
					$("#"+o.selectbox_id+" option:selected").attr("selected",false);
                    $("#"+o.selectbox_id+" option[value='" + current_value + "']").attr("selected", "selected");
                    $('.jelectbox_main a',obj).click();
					var domEl = $("#"+o.selectbox_id).get(0);
      				$(this).queue(domEl.onchange);
                });
                
            });
        }
    });
})(jQuery);