// Degrade the console obj where not present.
// ==========================================
// http://fbug.googlecode.com/svn/branches/firebug1.2/lite/firebugx.js
// Relaxed to allow for Chrome's console.

if (!window.console)
{
    var names = ["log", "debug", "info", "warn", "error", "assert", "dir",
                 "dirxml", "group", "groupEnd", "time", "timeEnd", "count", 
                 "trace", "profile", "profileEnd"];
    window.console = {};
    for (var i=0, name; name = names[i]; i++)
        window.console[name] = function() {};
}


// Make sure we have some things.
// ==============================

$.fn.serializeObject = function()
{   // http://stackoverflow.com/questions/763345/jquery-how-to-store-form-values-in-data-object
    var o = {};
    var a = this.serializeArray();
    $.each(a, function() {
        if (o[this.name] !== undefined) {
            if (!o[this.name].push) {
                o[this.name] = [o[this.name]];
            }
            o[this.name].push(this.value || '');
        } else {
            o[this.name] = this.value || '';
        }
    });
    return o;
};

if (!Array.prototype.indexOf)
{   // http://stackoverflow.com/questions/1744310/how-to-fix-array-indexof-in-javascript-for-ie-browsers
    Array.prototype.indexOf = function(obj, start)
    {
         for (var i = (start || 0), j = this.length; i < j; i++)
             if (this[i] == obj)
                return i;
         return -1;
    }
}

if (!String.prototype.replaceAll)
{
    String.prototype.replaceAll = function(p, r)
    {
        var s = this;
        while (s.indexOf(p) !== -1)
            s = s.replace(p, r);
        return s;
    }
}

if(!String.prototype.trim)
{   // http://stackoverflow.com/questions/1418050/string-strip-for-javascript
    String.prototype.trim = function() 
    {
        return String(this).replace(/^\s+|\s+$/g, '');
    };
}

if(!Array.prototype.remove)
{   //http://ejohn.org/blog/javascript-array-remove/
    Array.prototype.remove = function(from, to)
    {
        var rest = this.slice((to || from) + 1 || this.length);
        this.length = from < 0 ? this.length + from : from;
        return this.push.apply(this, rest);
    }
};


// Main namespace.
// ===============

IHAM = {};

IHAM.disabled = false;

IHAM.getScrollbarWidth = function()
{   // https://github.com/brandonaaron/jquery-getscrollbarwidth

    /*! Copyright (c) 2008 Brandon Aaron (brandon.aaron@gmail.com ||
     * http://brandonaaron.net) Dual licensed under the MIT
     * (http://www.opensource.org/licenses/mit-license.php) and GPL
     * (http://www.opensource.org/licenses/gpl-license.php) licenses.
     */

    var scrollbarWidth;
    if ( $.browser.msie ) {
        var $textarea1 = $('<textarea cols="10" rows="2"></textarea>')
                .css({ position: 'absolute', top: -1000, left: -1000 }).appendTo('body'),
            $textarea2 = $('<textarea cols="10" rows="2" style="overflow: hidden;"></textarea>')
                .css({ position: 'absolute', top: -1000, left: -1000 }).appendTo('body');
        scrollbarWidth = $textarea1.width() - $textarea2.width();
        $textarea1.add($textarea2).remove();
    } else {
        var $div = $('<div />')
            .css({ width: 100, height: 100, overflow: 'auto', position: 'absolute', top: -1000, left: -1000 })
            .prependTo('body').append('<div />').find('div')
                .css({ width: '100%', height: 200 });
        scrollbarWidth = 100 - $div.width();
        $div.parent().remove();
    }
    return scrollbarWidth;
};

IHAM.resize = function()
{   // The heads have a fixed height, the stubs a fixed width. Everything else
    // is calculated based on that.
    
    var WIN = $(window);

    var headsHeight = $('#heads').height();
    var stubsWidth = 280; // XXX make this adjustable with mouse drag

    var dataHeight = WIN.height() - headsHeight - IHAM.scrollbarWidth;
    var dataWidth = WIN.width() - stubsWidth - IHAM.scrollbarWidth; 

    $('#corner').height(headsHeight - 2) // border
                .width(stubsWidth - 3); // border
    $('#corner BUTTON').css( 'top'
                           , Math.ceil(( $('#corner').height() 
                                       - $('#corner BUTTON').outerHeight()
                                        ) / 2)
                            );

    $('#heads').width(dataWidth)
               .css({ 'left': stubsWidth
                       });
    $('#stubs').height(dataHeight)
               .width(stubsWidth)
               .css({'top': headsHeight});
    $('#data').height(dataHeight)
              .width(dataWidth)
              .css({ 'top': headsHeight
                   , 'left': stubsWidth
                    });

    // Scrolling 
    // =========

    var tableHeight = $('#data TABLE').height();
    var tableWidth = $('#data TABLE').width();

    $('#heads TH.padding B').css('width', dataWidth % 96);
    $('#heads TD.padding B').css('width', dataWidth % 96);
    $('#data TD.padding B').css('width', dataWidth % 96);

    $('#data TABLE').css('margin-bottom', dataHeight % 14);
    $('#stubs TABLE').css('margin-bottom', dataHeight % 14);

    $('#data-proxy').height(tableHeight)
                    .width(tableWidth);
    $('#scroll').add('#scrollbar-protector')
                .height(dataHeight + IHAM.scrollbarWidth)
                .width(dataWidth + IHAM.scrollbarWidth)
                .css({ 'top': headsHeight
                     , 'left': stubsWidth
                      });
};


/* Categories */
/* ========== */

IHAM.createCategory = function(e)
{
    if (IHAM.disabled) return false;
    var category = prompt("Name your category!");
    if (category !== null)
        jQuery.ajax({ type: "POST"
                    , url: "/categories/" + encodeURIComponent(category) + "/"
                    , success: function() { window.location.reload() }
                    , dataType: 'json'
                     })
};

IHAM.toggleCategoryCreator = function()
{
    if (IHAM.disabled) return false;
    $('#top .widget').toggle()
    var cur = $('#top .knob').text();
    var next = 'create a category';
    if (cur == next)
    {
        $('#top INPUT').val('').focus();
        next = 'cancel';
    }
    $('#top .knob').text(next);
};

IHAM.categoryCreatorKeyup = function(e)
{
    if (IHAM.disabled) return false;
    switch (e.which)
    {
        case 27:
            IHAM.toggleCategoryCreator();
            break;
        case 13:
            IHAM.createCategory({"target": $('#top BUTTON').get(0)});
            break;
    }
};

IHAM.scrollVertically = function(num)
{
    if (IHAM.disabled) return false;
    var container = $('#data').add('#stubs').add('#scroll');

    var cur = $('#stubs TR.focus');
    var stubs = $('#stubs TR');
    var data = $('#data TR');
    var from = stubs.index(cur);
    var to = from + num;

    if (0 <= to && to < stubs.length)
    { 
        $('.focus').removeClass('focus');
        stubs.eq(to).addClass('focus');
        data.eq(to).addClass('focus');
        var curScroll = container.scrollTop();
        var scrollTop = container.scrollTop();
        var scrollBottom = ( scrollTop
                           + container.height() 
                           - 14
                            );
        var scrollMiddle = ( scrollTop 
                           + Math.floor((scrollBottom - scrollTop) / 3)
                            );
        scrollMiddle -= scrollMiddle % 14;

        var at = to * 14;
        var to = curScroll + (num * 14);
        if (at < scrollTop) {
            container.scrollTop(to);
        } else if (at > scrollBottom) {
            container.scrollTop(to);
        } else if (at === scrollMiddle) {
            container.scrollTop(to);
        } 
    }
    IHAM.highlightColumn();
};

IHAM.scrollHorizontally = function(num)
{
    if (IHAM.disabled) return false;
    var container = $('#data').add('#heads').add('#scroll');

    var cur = $('#heads TH.current');
    var heads = $('#heads TH').add('#heads TD');
    var data = $('#data TH');
    var from = heads.index(cur);
    var to = from + num;

    if (0 <= to && to < heads.length)
    { 
        $('.current').removeClass('current');
        heads.eq(to).addClass('current');
        data.eq(to).addClass('current');
        var curScroll = container.scrollTop();
        var scrollLeft  = container.scrollTop();
        var scrollRight = ( scrollTop
                          + container.height() 
                          - 14
                           );
        var scrollMiddle = ( scrollTop 
                           + Math.floor((scrollBottom - scrollTop) / 3)
                            );
        scrollMiddle -= scrollMiddle % 14;

        var at = to * 14;
        var to = curScroll + (num * 14);
        if (at < scrollTop) {
            container.scrollTop(to);
        } else if (at > scrollBottom) {
            container.scrollTop(to);
        } else if (at === scrollMiddle) {
            container.scrollTop(to);
        } 
    }
    IHAM.highlightColumn();
};

IHAM.changeCategory = function(inc)
{
    if (IHAM.disabled) return false;
    var tid = $('TR.focus').attr('tid');
    var cols = $('TR.focus TD.amount');
    var cell = $('TR.focus TD.amount.categorized');
    var amount = cell.text();
    var from = cols.index(cell);
    var to = from + inc;
    var category;

    if (to === -1)
        to = cols.length - 1;
    if (to === cols.length)
        to = 0;

    from = cols.eq(from);
    to = cols.eq(to);
    category_id = to.attr('category_id');
    if (category == "uncategorized")
        jQuery.getJSON('/uncategorize.json', {tid: tid});
    else
        jQuery.getJSON('/categorize.json', { tid: tid
                                           , category_id: category_id
                                            });
    from.removeClass('categorized');
    to.html(from.html()).addClass('categorized');
    from.html('<b></b>');

    // Update summary amount.

    // Do some hackish decimal math, assuming two decimal places.
    function parseDecimal(s)
    {
        var foo = s.replace(',', '');
        var parts = foo.split('.');
        var whole = parseInt(parts[0], 10) * 100;
        var sign = whole < 0 ? -1 : 1;
        whole = Math.abs(whole);
        var part = parts[1] === undefined ? 0 : parseInt(parts[1], 10);
        var combined = whole + part;
        return (combined * sign);
    }
    function add(d1, d2)
    {
        d1 = parseDecimal(d1);
        d2 = parseDecimal(d2);
        return (d1 + d2) / 100;
    }
    function subtract(d1, d2)
    {
        d1 = parseDecimal(d1);
        d2 = parseDecimal(d2);
        return (d1 - d2) / 100;
    }
    function commaize(f)
    {   // This is a port of a Python function used server-side. Brittle! 
        if (f === 0)
            return ( "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;" + "0"
                   + "&nbsp;&nbsp;&nbsp;"
                    );
        f = f.toFixed(2);
        var sign = '';
        if (f[0] === '-')
        {
            sign = '-';
            f = f.slice(1);
        }
        var len = f.length;
        for (var i=len, j; i > 0; i--)
        {
            j = len - i;
            if (j > 3 && j % 3 === 0)
                f = f.slice(0,i) + "," + f.slice(i,f.length);
        }
        f = sign + f;
        while (f.length < 11)
            f = " " + f;
        while (f.indexOf(" ") !== -1)
            f = f.replace(" ", "&nbsp;");
        return f;
    }

    var entering = $('#heads TD.amount[category_id="' + category_id + '"] B');
    entering.html(commaize(add(entering.text(), amount)));

    var leaving = $('#heads TD.amount.current B');
    leaving.html(commaize(subtract(leaving.text(), amount)));

    IHAM.highlightColumn(category_id);
};


IHAM.highlightColumn = function(category_id)
{   // Change the highlighted column head.
    if (IHAM.disabled) return false;
    if (category_id === undefined)
        category_id = $('#data TR.focus .categorized').attr('category_id');
    $('.current').removeClass('current');
    var col = $('#heads [category_id="' + category_id + '"]');
    col.addClass('current');
    if (col.position().left + col.width() > $('#scroll').scrollLeft())
        $('#data').add('#scroll').add('#heads').scrollLeft(col.position().left);
    if (col.position().left < $('#scroll').scrollLeft())
        $('#data').add('#scroll').add('#heads').scrollLeft(col.position().left);
};


/* Navigation */
/* ========== */

IHAM.navigate = function(e)
{
    if (IHAM.disabled) return false;

    var nrows = 1, to = 1, hl = {37: -1, 39: 1, 72:-1, 76: 1};
    //console.log(e.which);
    switch (e.which)
    {
        case 38:    // up arrow
        case 75:    // k
            nrows = -1
        case 40:    // down arrow
        case 74:    // j
            IHAM.scrollVertically(nrows);
            break;
        case 37:    // left arrow
        case 39:    // right arrow
        case 72:    // h
        case 76:    // l
            to *= hl[e.which];
            IHAM.changeCategory(to);
            break;
        case 27:    // ESC
            IHAM.openModal();
            break;
        case 78:    // n
            if (e.shiftKey)
                IHAM.createCategory();
            break;
    }
};


/* Modal Screen (Cat!) */
/* ==================== */

IHAM.openModal = function()
{
    IHAM.disabled = true;
    $('#modal INPUT').eq(0).focus();
    $('#modal-wrap').show();
    $(document).unbind('keypress');
    $(document).unbind('keydown');
    $(document).keydown(function(e) 
    { 
        if (e.which === 27)
            IHAM.closeModal();
    });
};

IHAM.closeModal = function()
{
    IHAM.disabled = false;
    $('#modal-wrap').hide();
    $(document).unbind('keypress');
    $(document).unbind('keydown');
    $(document).keydown(IHAM.navigate);
    return false;
};


/* Form Generics */
/* ============= */

IHAM.feedbackOut = null; // {clear,set}Timout handler
IHAM.showFeedback = function(msg, details)
{
    window.clearTimeout(IHAM.feedbackOut);
    $('#eyes').stop(true, true).show()
    
    msg += '<div class="details"></div>';
    $('#feedback').stop(true, true).html(msg).show();
    if (details !== undefined)
        for (var i=0; i < details.length; i++)
            $('#feedback .details').append('<p>' + details[i] + '</p>');
    
    IHAM.feedbackOut = window.setTimeout(function()
    {
        $('#eyes').hide();
        $('#feedback').hide();
    }, 15000);
}

IHAM.submitForm = function(url, data, success, error)
{
    if (success === undefined)
    {
        success = function()
        {   
            window.location.href = "/";
        }
    }

    if (error === undefined)
    {
        error = function(data)
        {
            IHAM.showFeedback(data.problem);
        };
    }
    
    function _success(data)
    {
        if (data.problem === "" || data.problem === undefined)
            success(data);
        else
            error(data);
    }

    function _error(xhr, foo, bar)
    {
        IHAM.showFeedback("So sorry!!");
        console.log("failed", xhr, foo, bar);
    }

    jQuery.ajax({ url: url
                , type: "POST"
                , data: data
                , dataType: "json"
                , success: _success
                , error: _error
                 });
}


/* Auth Form */
/* ========= */

IHAM.toggleAuthForm = function(e)
{
    e.preventDefault();
    e.stopPropagation();
    if ($('FORM#auth #other').text() === 'Register')
        IHAM.switchToRegister();
    else
        IHAM.switchToSignIn();
    return false;
};

IHAM.playWithFakeData = function()
{
    IHAM.switchToRegister();
    IHAM.closeModal();
    return false;
};

IHAM.submitAuthForm = function(e)
{
    e.preventDefault();
    e.stopPropagation();

    var url = "";
    var data = {};
    data.email = $('INPUT[name=email]').val();
    data.password = $('INPUT[name=password]').val();

    if ($('FORM#auth BUTTON').text() === 'Register')
    {
        url = "/register.json";
        data['confirm'] = $('INPUT[name=confirm]').val();
    }
    else
    {
        url = "/sign/in.json";
    }

    IHAM.submitForm(url, data);

    return false;
};

IHAM.switchToSignIn = function()
{
    $('FORM#auth .password').removeClass('half left');
    $('FORM#auth .confirm').hide();
    $('FORM#auth #other').text('Register');
    $('FORM#auth BUTTON').text('Sign In');
    $('FORM#auth INPUT').eq(0).focus();
};

IHAM.switchToRegister = function()
{
    $('FORM#auth .password').addClass('half left');
    $('FORM#auth .confirm').show();
    $('FORM#auth #other').text('Sign In');
    $('FORM#auth BUTTON').text('Register');
    $('FORM#auth INPUT').eq(0).focus();
};


/* Upload Form */
/* =========== */

IHAM.submitUploadForm = function(e)
{
    // TODO http://blueimp.github.com/jQuery-File-Upload/
};


/* Payment Details Form */
/* ==================== */

IHAM.submitPaymentForm = function(e)
{
    e.stopPropagation();
    e.preventDefault();

    function val(field)
    {
        return $('FORM#payment INPUT[name="' + field + '"]').val();
    };

    var data = {};          // top-level POST body

    var pmt = val('payment_method_token');
    if (pmt !== undefined)
        data.payment_method_token = pmt;

    var credit_card = {};   // holds CC info
    credit_card.first_name = val('first_name');
    credit_card.last_name = val('last_name');
    credit_card.address_1 = val('address_1');
    credit_card.address_2 = val('address_2');
    credit_card.city = val('city');
    credit_card.state = val('state');
    credit_card.zip = val('zip');
    credit_card.card_number = val('card_number');
    credit_card.cvv = val('cvv');
    
    var expiry = val('expiry').split('/');
    credit_card.expiry_month = expiry[0];
    credit_card.expiry_year = expiry[1];
    
    data.credit_card = credit_card; 
    Samurai.payment(data, IHAM.savePaymentMethod);

    return false;
};

IHAM.savePaymentMethod = function(data)
{
    // Afaict this is always present, no matter the garbage we gave to Samurai.
    var pmt = data.payment_method.payment_method_token;
    var dayOfMonth = $('#dayOfMonth').attr('dayOfMonth');
    var action = $('FORM#payment BUTTON').text();

    function detailedFeedback(data)
    {
        var details = [];
        for (var field in data.errors) 
        {
            var errors = data.errors[field];
            var nerrors = errors.length;
            for (var i=0; i < nerrors; i++)
                details.push(errors[i]);
        }

        IHAM.showFeedback(data.problem, details);
    }

    IHAM.submitForm( "/pmt/save.json"
                         , {pmt: pmt, day_of_month: dayOfMonth, action: action}
                         , undefined
                         , detailedFeedback
                          );
};

IHAM.setDayOfMonth = function(dayOfMonth)
{
    var blah = [ '' 
               , 'first', 'second', 'third', 'fourth', 'fifth'
               , 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'
               , 'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth'
               , 'sixteenth', 'seventeenth', 'eighteenth', 'ninteenth'
                , 'twentieth'
               , 'twenty-first', 'twenty-second', 'twenty-third'
                , 'twenty-fourth', 'twenty-fifth'
               , 'twenty-sixth', 'twenty-seventh', 'twenty-eighth'
                , 'twenty-ninth', 'thirtieth'
               , 'thirty-first'
                ];

    if (dayOfMonth === null || dayOfMonth === undefined)
        dayOfMonth = (new Date()).getDate();
    
    $('#dayOfMonth').attr('dayOfMonth', dayOfMonth).text(blah[dayOfMonth]);
    if (dayOfMonth > 28)
        $('#orLast').html(" (or last) ");
};

IHAM.updateScrollBars = function(e, blah, xVelocity, yVelocity)
{
    var o = $(this);
   
    
    // Convert scroll delta to pixels.
    // ===============================
    // I'm seeing a delta of 0.0125 for each click of the scroll wheel in
    // Chrome (XXX what is this value in other browsers?). The 112 and 768
    // values are based on 14px rows and 96px columns.

    var factor = 0.025; // Chrome, Safari
    var xUnit = 96 / factor;
    var yUnit = 14 / factor;

    var xPixels = (xVelocity * xUnit);
    var yPixels = (yVelocity * yUnit);


    // Make some changes.
    // ==================

    var newScrollTop = o.scrollTop() - yPixels;
    var newScrollLeft = o.scrollLeft() + xPixels;

    $('#data').scrollTop(newScrollTop);
    o.scrollLeft(newScrollLeft);

    $('#stubs').add('#scroll').scrollTop(newScrollTop);
    $('#heads').add('#scroll').scrollLeft(newScrollLeft);
};

IHAM.scrollFromBars = function()
{
    // vertical scroll
    var curTop = $('#scroll').scrollTop();
    var maxTop = $('#scroll').height() - $('#data').height();
    var newTop = curTop - (curTop % 14);
    if (curTop > (maxTop / 2))
        newTop = curTop + (14 - (curTop % 14));
    $('#data').add('#stubs').scrollTop(newTop);

    // horizontal scroll
    var curLeft = $('#scroll').scrollLeft();
    var maxLeft = $('#scroll').width() - $('#data').width();
    var newLeft = curLeft - (curLeft % 96);
    if (curLeft > (maxLeft / 2))
        newLeft = curLeft + (96 - (curLeft % 96));
    $('#data').add('#heads').scrollLeft(newLeft);
};


// dead mouse
// ==========

IHAM.showDeadMouse = function()
{
    $('#dead-mouse').show();
};

IHAM.hideDeadMouse = function()
{
    $('#dead-mouse').hide();
};

IHAM.flashDeadMouseHandle = null;
IHAM.flashMousePosition = null;
IHAM.flashDeadMouse = function(e)
{
    // We get the mousemove event any time the mouse goes into a new element.
    // So if we scroll using the keyboard such that the mouse cursor is now
    // over a new element, we still get mousemove. To avoid flashing the dead
    // mouse in this case, we keep track of the mouse's position relative to
    // the page overall and watch whether it has in fact changed.

    if (IHAM.flashX === e.pageX && IHAM.flashY === e.pageY)
        // In the wisdom of JavaScript, [1,2] !== [1,2].
        return

    // We have a movement of the mouse relative to the viewport.
    IHAM.flashX = e.pageX;
    IHAM.flashY = e.pageY;
    IHAM.showDeadMouse();
    clearTimeout(IHAM.flashDeadMouseHandle)
    IHAM.flashDeadMouseHandle = setTimeout(IHAM.hideDeadMouse, 250);
};


// main 
// ====

IHAM.init = function(session)
{
    IHAM.scrollbarWidth = IHAM.getScrollbarWidth();
    $(window).resize(IHAM.resize);
    IHAM.resize();

    // Wire up the corner.
    $('#corner BUTTON').click(IHAM.openModal);
    $('#mask').click(IHAM.closeModal);

    // The mouse, it is dead.
    $('#mouse-killer').mousedown(IHAM.showDeadMouse)
                      .mouseup(IHAM.hideDeadMouse)
                      .mousemove(IHAM.flashDeadMouse);

    // Wire up the auth form. No-op if already signed in.
    $('#fake').click(IHAM.playWithFakeData);
    $('FORM#auth').submit(IHAM.submitAuthForm);
    $('FORM#auth #other').click(IHAM.toggleAuthForm);

    // Set initial highlight state.
    $('#stubs TR').eq(0).addClass('focus');
    $('#data TR').eq(0).addClass('focus');
    IHAM.highlightColumn();
    IHAM.setDayOfMonth(session.day_of_month_to_bill);
};

IHAM.initPayment = function(merchant_key)
{
    $('#modal INPUT').eq(0).focus();
    Samurai.init({merchant_key: merchant_key});
    $('FORM#payment').submit(IHAM.submitPaymentForm);
    $('INPUT[name=expiry]').mask('99/2099');
};

IHAM.initModalNav = function()
{
    function toggler(paneName)
    {
        return function() 
        {
            $('#pane-nav .selected').removeClass('selected');
            $('#pane-nav LI[pane=' + paneName + ']').addClass('selected');
            $('.pane').hide();
            $('.pane[pane=' + paneName + ']').show();
        };
    }

    var paneNav = $('#pane-nav');
    $('.pane').each(function(i)
    {
        var title = $('H2 SPAN', this).text();
        var paneName = $(this).attr('pane');
        paneNav.append('<li pane="' + paneName + '"><span>' + title + '</span></li>');
        $('li', paneNav).eq(i).click(toggler(paneName));
    });

    $('LI[pane]').eq(0).click();
};
