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


// Categorys
// ====

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
    console.log(e.which);
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
IHasAMoney.feedback = function(msg)
{
    window.clearTimeout(IHasAMoney.feedbackOut);
    $('#eyes').stop(true, true).show()
    $('#feedback').stop(true, true).html(msg).show()
    IHasAMoney.feedbackOut = window.setTimeout(function()
    {
        $('#eyes').hide();
        $('#feedback').hide();
    }, 8000);
}

IHasAMoney.submitForm = function(url, data, callback)
{
    function success(data)
    {
        if (data.problem !== "")
            IHasAMoney.feedback(data.problem);
        else
            callback();
    }

    function error(xhr, foo, bar)
    {
        console.log("failed", xhr, foo, bar);
    }

    jQuery.ajax({ url: url
                , type: "POST"
                , data: data
                , dataType: "json"
                , success: success
                , error: error
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

    function callback()
    {
        window.location.href = "/";
    }
    IHasAMoney.submitForm(url, data, callback);

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


// main 
// ====

IHasAMoney.init = function()
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
};

IHasAMoney.initSamurai = function(merchant_key)
{
    $('#splash INPUT').eq(0).focus();
    Samurai.init({merchant_key: merchant_key});

    function onTransactionCreation(data) 
    {
        console.log('got something else!', data);

        // Parse the transaction response JSON and convert it to an object
        var transaction = jQuery.parseJSON(data).transaction;

        if(transaction.success) {
          // Update the page to display the results
          $('#samurai FORM').children('.results').html('<h3>Your purchase is complete!</h3><h4>'+transaction.payment_method.payment_method.first_name+' '+transaction.payment_method.payment_method.last_name+': $'+transaction.amount+' - '+transaction.description+'</h4>');
          Samurai.trigger('form', 'completed');
        } else {
          // Let the error handler scan the response object for errors,
          // then display these errors
          Samurai.PaymentErrorHandler.forForm($('form').get(0)).handleErrorsFromResponse(transaction);
        }
    }

    function onPayment(e, data)
    {
        console.log('got something!', e, data);
        jQuery.post('/create-transaction', data.payment_method, onTransactionCreation);
    }

    Samurai.on('#samurai FORM', 'payment', onPayment);
};

IHasAMoney.initAccordion = function()
{
    $('#accordion').accordion({header: 'h2', fillSpace: true});
};
