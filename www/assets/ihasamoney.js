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

IHasAMoney = {};

IHasAMoney.disabled = false;

IHasAMoney.wire = function(name, callback)
{
    $(IHasAMoney).bind(name, callback);
};

IHasAMoney.fire = function(name)
{
    $(IHasAMoney).trigger(name);
};

IHasAMoney.resize = function()
{
    var WIN = $(window);
    var BOD = $('BODY');
    var bod = $('#body');

    var headHeight = $('THEAD.unpegged').outerHeight();
    var transactionHeight = WIN.height() - headHeight;
    transactionHeight -= transactionHeight % 14;
    var bodyHeight = headHeight + transactionHeight;
    // fit for 14px-height rows
    $('.corner').width( $('.year').eq(0).width()
                      + $('.month').eq(0).width()
                      + $('.day').eq(0).width()
                      + $('.description').eq(0).width()
                       );

    $('THEAD.pegged').width($('THEAD.unpegged').width());
    $('THEAD.unpegged TH').each(function(i)
    {
        $('THEAD.pegged TH').eq(i).width($(this).width());
    });
    $('#body').height(bodyHeight);
    $('#accordion').height(402 - $('#acct').height());
};


/* Categories */
/* ========== */

IHasAMoney.createCategory = function(e)
{
    if (IHasAMoney.disabled) return false;
    var category = prompt("Name your category!");
    if (category !== null)
        jQuery.ajax({ type: "POST"
                    , url: "/categories/" + category + "/"
                    , success: function() { window.location.reload() }
                    , dataType: 'json'
                     })
};

IHasAMoney.toggleCategoryCreator = function()
{
    if (IHasAMoney.disabled) return false;
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

IHasAMoney.categoryCreatorKeyup = function(e)
{
    if (IHasAMoney.disabled) return false;
    switch (e.which)
    {
        case 27:
            IHasAMoney.toggleCategoryCreator();
            break;
        case 13:
            IHasAMoney.createCategory({"target": $('#top BUTTON').get(0)});
            break;
    }
};

IHasAMoney.scrollBy = function(num)
{
    if (IHasAMoney.disabled) return false;
    var container = $('#body');

    var cur = $('TBODY TR.focus');
    var rows = $('TBODY TR');
    var from = rows.index(cur);
    var to = from + num;

    if (0 <= to && to < rows.length)
    { 
        cur.removeClass('focus');
        rows.eq(to).addClass('focus');
        var curScroll = container.scrollTop();
        var scrollTop = container.scrollTop();
        var scrollBottom = ( scrollTop
                           + container.height() 
                           - $('THEAD.unpegged').height() 
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
    IHasAMoney.highlightRowCol();
};

IHasAMoney.changeCategory = function(inc)
{
    if (IHasAMoney.disabled) return false;
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
    category = to.attr('category');
    if (category == "uncategorized")
        jQuery.getJSON('/uncategorize.json', {tid: tid});
    else
        jQuery.getJSON('/categorize.json', {tid: tid, category: category});
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
    {
        if (f === 0)
            return "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;0&nbsp;&nbsp;&nbsp;";
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
        while (f.length < 10)
            f = " " + f;
        while (f.indexOf(" ") !== -1)
            f = f.replace(" ", "&nbsp;");
        return f;
    }

    var entering = $('THEAD.pegged TH.amount[category="' + category + '"]');
    entering.html(commaize(add(entering.text(), amount)));

    var leaving = $('THEAD.pegged TH.amount.current');
    leaving.html(commaize(subtract(leaving.text(), amount)));

    IHasAMoney.highlightRowCol();
};

IHasAMoney.highlightRowCol = function()
{
    if (IHasAMoney.disabled) return false;

    var i = 0;
    var category = $(".focus .categorized").attr('category');

    // Change the highlighted column head.
    $('.current').removeClass('current');
    $('TH[category="' + category + '"]').addClass('current');
   
    // Change the column highlight. 
    $('.highlighted').removeClass('highlighted');
    i = $('TBODY TR').index($('TR.focus'));
    $('TD[category="' + category + '"]:lt(' + i + ')').addClass('highlighted');
   
    // Change the row highlight. 
    i = $('TBODY TR TD').index($('TD[category="' + category + '"]'));
    $('TR.focus TD:lt(' + i + ')').addClass('highlighted');
};


/* Navigation */
/* ========== */

IHasAMoney.kill = function(e)
{
    // NO MOUSE FOR YOU!!!!!!!!!!!!!!!
    e.stopPropagation();
    e.preventDefault();
    return false;
};

IHasAMoney.navigate = function(e)
{
    if (IHasAMoney.disabled) return false;

    var nrows = 1, to = 1, hl = {37: -1, 39: 1, 72:-1, 76: 1};
    //console.log(e.which);
    switch (e.which)
    {
        case 38:    // up arrow
        case 75:    // k
            nrows = -1
        case 40:    // down arrow
        case 74:    // j
            IHasAMoney.scrollBy(nrows);
            break;
        case 37:    // left arrow
        case 39:    // right arrow
        case 72:    // h
        case 76:    // l
            to *= hl[e.which];
            IHasAMoney.changeCategory(to);
            break;
        case 27:    // ESC
            IHasAMoney.openSplash();
            break;
        case 78:    // n
            if (e.shiftKey)
                IHasAMoney.createCategory();
            break;
    }
};


/* Splash Screen (Cat!) */
/* ==================== */

IHasAMoney.openSplash = function()
{
    IHasAMoney.disabled = true;
    $('#splash INPUT').eq(0).focus();
    $('#splash-wrap').show();
    $(document).unbind('keypress');
    $(document).unbind('keydown');
    $(document).keydown(function(e) 
    { 
        if (e.which === 27)
            IHasAMoney.closeSplash();
    });
};

IHasAMoney.closeSplash = function()
{
    IHasAMoney.disabled = false;
    $('#splash-wrap').hide();
    $(document).unbind('keypress');
    $(document).unbind('keydown');
    $(document).keydown(IHasAMoney.navigate);
    return false;
};


/* Form Generics */
/* ============= */

IHasAMoney.feedbackOut = null; // {clear,set}Timout handler
IHasAMoney.showFeedback = function(msg, details)
{
    window.clearTimeout(IHasAMoney.feedbackOut);
    $('#eyes').stop(true, true).show()
    
    msg += '<div class="details"></div>';
    $('#feedback').stop(true, true).html(msg).show();
    if (details !== undefined)
        for (var i=0; i < details.length; i++)
            $('#feedback .details').append('<p>' + details[i] + '</p>');
    
    IHasAMoney.feedbackOut = window.setTimeout(function()
    {
        $('#eyes').hide();
        $('#feedback').hide();
    }, 15000);
}

IHasAMoney.submitForm = function(url, data, success, error)
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
            IHasAMoney.showFeedback(data.problem);
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
        IHasAMoney.showFeedback("So sorry!!");
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

IHasAMoney.toggleAuthForm = function(e)
{
    e.preventDefault();
    e.stopPropagation();
    if ($('FORM#auth #other').text() === 'Register')
        IHasAMoney.switchToRegister();
    else
        IHasAMoney.switchToSignIn();
    return false;
};

IHasAMoney.playWithFakeData = function()
{
    IHasAMoney.switchToRegister();
    IHasAMoney.closeSplash();
    return false;
};

IHasAMoney.submitAuthForm = function(e)
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
        url = "/sign-in.json";
    }

    IHasAMoney.submitForm(url, data);

    return false;
};

IHasAMoney.switchToSignIn = function()
{
    $('FORM#auth .password').removeClass('half left');
    $('FORM#auth .confirm').hide();
    $('FORM#auth #other').text('Register');
    $('FORM#auth BUTTON').text('Sign In');
    $('FORM#auth INPUT').eq(0).focus();
};

IHasAMoney.switchToRegister = function()
{
    $('FORM#auth .password').addClass('half left');
    $('FORM#auth .confirm').show();
    $('FORM#auth #other').text('Sign In');
    $('FORM#auth BUTTON').text('Register');
    $('FORM#auth INPUT').eq(0).focus();
};


/* Upload Form */
/* =========== */

IHasAMoney.submitUploadForm = function(e)
{
    // TODO http://blueimp.github.com/jQuery-File-Upload/
};


/* Payment Details Form */
/* ==================== */

IHasAMoney.submitPaymentForm = function(e)
{
    e.stopPropagation();
    e.preventDefault();

    function val(field)
    {
        return $('FORM#payment INPUT[name="' + field + '"]').val();
    };

    var details = {};

    var pmt = val('payment_method_token');
    if (pmt !== undefined)
        details.payment_method_token = pmt;

    details.first_name = val('first_name');
    details.last_name = val('last_name');
    details.address_1 = val('address_1');
    details.address_2 = val('address_2');
    details.city = val('city');
    details.state = val('state');
    details.zip = val('zip');
    details.card_number = val('card_number');
    details.cvv = val('cvv');
    
    var expiry = val('expiry').split('/');
    details.expiry_month = expiry[0];
    details.expiry_year = expiry[1];

    console.log(details);
    Samurai.payment({credit_card: details}, IHasAMoney.savePaymentMethod);

    return false;
};

IHasAMoney.savePaymentMethod = function(data)
{
    // Afaict this is always present, no matter the garbage we gave to Samurai.
    var pmt = data.payment_method.payment_method_token;
    var dayOfMonth = $('#dayOfMonth').attr('dayOfMonth');

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

        IHasAMoney.showFeedback(data.problem, details);
    }
    IHasAMoney.submitForm( "/pmt/save.json"
                         , {pmt: pmt, day_of_month: dayOfMonth}
                         , undefined
                         , detailedFeedback
                          );
};

IHasAMoney.setDayOfMonth = function(dayOfMonth)
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
        $('#orLast').html(" (or last day) ");
};


// main 
// ====

IHasAMoney.init = function(session)
{
    $(window).resize(IHasAMoney.resize);
    IHasAMoney.resize();

    $(document).mousewheel(IHasAMoney.kill);

    // Wire up auth form. No-op if already signed in.
    $('#fake').click(IHasAMoney.playWithFakeData);
    $('FORM#auth').submit(IHasAMoney.submitAuthForm);
    $('FORM#auth #other').click(IHasAMoney.toggleAuthForm);

    $('TBODY TR').eq(0).addClass('focus');
    IHasAMoney.highlightRowCol();
    IHasAMoney.setDayOfMonth(session.day_of_month_to_bill);
};

IHasAMoney.initPayment = function(merchant_key)
{
    $('#splash INPUT').eq(0).focus();
    Samurai.init({merchant_key: merchant_key});
    $('FORM#payment').submit(IHasAMoney.submitPaymentForm);
};

IHasAMoney.initAccordion = function()
{
    $('#accordion').accordion({header: 'h2', fillSpace: true});
};
