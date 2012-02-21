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
};


// Tags
// ====

IHasAMoney.createTag = function(e)
{
    if (IHasAMoney.disabled) return false;
    var button = $(e.target);
    var tag = $('#top INPUT').val();
    jQuery.ajax({ type: "POST"
                , url: "/tags/" + tag + "/"
                , success: function() { window.location.reload() }
                , dataType: 'json'
                 })
};

IHasAMoney.toggleTagCreator = function()
{
    if (IHasAMoney.disabled) return false;
    $('#top .widget').toggle()
    var cur = $('#top .knob').text();
    var next = 'create a tag';
    if (cur == next)
    {
        $('#top INPUT').val('').focus();
        next = 'cancel';
    }
    $('#top .knob').text(next);
};

IHasAMoney.tagCreatorKeyup = function(e)
{
    if (IHasAMoney.disabled) return false;
    switch (e.which)
    {
        case 27:
            IHasAMoney.toggleTagCreator();
            break;
        case 13:
            IHasAMoney.createTag({"target": $('#top BUTTON').get(0)});
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

IHasAMoney.changeTag = function(inc)
{
    if (IHasAMoney.disabled) return false;
    var tid = $('TR.focus').attr('tid');
    var cols = $('TR.focus TD.amount');
    var cell = $('TR.focus TD.amount.tagged');
    var amount = cell.text();
    var from = cols.index(cell);
    var to = from + inc;
    var tag;

    if (to === -1)
        to = cols.length - 1;
    if (to === cols.length)
        to = 0;

    from = cols.eq(from);
    to = cols.eq(to);
    tag = to.attr('tag');
    if (tag == "uncategorized")
        jQuery.getJSON('/untag.json', {tid: tid});
    else
        jQuery.getJSON('/tag.json', {tid: tid, tag: tag});
    from.removeClass('tagged');
    to.html(from.html()).addClass('tagged');
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

    var entering = $('THEAD.pegged TH.amount[tag="' + tag + '"]');
    entering.html(commaize(add(entering.text(), amount)));

    var leaving = $('THEAD.pegged TH.amount.current');
    leaving.html(commaize(subtract(leaving.text(), amount)));

    IHasAMoney.highlightRowCol();
};

IHasAMoney.highlightRowCol = function()
{
    if (IHasAMoney.disabled) return false;

    var i = 0;
    var tag = $(".focus .tagged").attr('tag');

    // Change the highlighted column head.
    $('.current').removeClass('current');
    $('TH[tag="' + tag + '"]').addClass('current');
   
    // Change the column highlight. 
    $('.highlighted').removeClass('highlighted');
    i = $('TBODY TR').index($('TR.focus'));
    $('TD[tag="' + tag + '"]:lt(' + i + ')').addClass('highlighted');
   
    // Change the row highlight. 
    i = $('TBODY TR TD').index($('TD[tag="' + tag + '"]'));
    $('TR.focus TD:lt(' + i + ')').addClass('highlighted');
};

IHasAMoney.arrows = function(e)
{
    var nrows = 1, to = 1, hl = {37:-1, 39: 1};
    switch (e.which)
    {
        case 38: // k
            nrows = -1
        case 40: // j
            IHasAMoney.scrollBy(nrows);
            e.preventDefault();
            break;
        case 37: // h 
        case 39: // l
            to *= hl[e.which];
            IHasAMoney.changeTag(to);
            e.preventDefault();
            break;
    }
};

IHasAMoney.navigate = function(e)
{
    if (IHasAMoney.disabled) return false;

    e.preventDefault();

    var nrows = 1, to = 1, hl = {104:-1, 108: 1};
    switch (e.which)
    {
        case 107:   // k
            nrows = -1
        case 106:   // j
            IHasAMoney.scrollBy(nrows);
            break;
        case 104:   // h 
        case 108:   // l
            to *= hl[e.which];
            IHasAMoney.changeTag(to);
            break;
        case 63:    // ?
            IHasAMoney.openSplash();
            break;
    }
};

IHasAMoney.stopPropagation = function(e)
{
    e.stopPropagation();
};

IHasAMoney.kill = function(e, delta)
{
    // NO MOUSE FOR YOU!!!!!!!!!!!!!!!
    e.stopPropagation();
    e.preventDefault();
    return false;
};

IHasAMoney.openSplash = function()
{
    $('#splash-wrap').show();
    IHasAMoney.disabled = true;
    $('#splash INPUT').eq(0).focus();
};

IHasAMoney.closeSplash = function()
{
    $('#splash-wrap').hide();
    IHasAMoney.disabled = false;
    return false;
};

IHasAMoney.toggleForm = function()
{
    e.preventDefault();
    e.stopPropagation();
    if ($('#splash .full SPAN').text() === 'Register')
        IHasAMoney.switchToRegister();
    else
        IHasAMoney.switchToSignIn();
    return false;
};

IHasAMoney.submitForm = function(e)
{
    e.preventDefault();
    e.stopPropagation();

    var url = "";
    var data = {};
    data.email = $('INPUT[name=email]').val();
    data.password = $('INPUT[name=password]').val();

    if ($('#splash BUTTON').text() === 'Register')
    {
        console.log("registering");
        url = "/register.json";
        data['confirm'] = $('INPUT[name=confirm]').val();
    }
    else
    {
        url = "/sign-in.json";
        console.log('signing in');
    }

    function success(data)
    {
        if (data.problem !== undefined)
        {
            $('P.msg').html(data.problem);
        }
        else
        {
            window.location.href = "/";
        }
    };

    function error(xhr, foo, bar)
    {
        console.log("failed", xhr, foo, bar);
    };

    jQuery.ajax({ url: url
                , type: "POST"
                , data: data
                , dataType: "json"
                , success: success
                , error: error
                 });

    return false;
};

IHasAMoney.switchToSignIn = function()
{
    $('#splash .password').removeClass('half left');
    $('#splash .confirm').hide();
    $('#splash #other').text('Register');
    $('#splash BUTTON').text('Sign In');
    $('#splash INPUT').eq(0).focus();
};

IHasAMoney.switchToRegister = function()
{
    $('#splash .password').addClass('half left');
    $('#splash .confirm').show();
    $('#splash #other').text('Sign In');
    $('#splash BUTTON').text('Register');
    $('#splash INPUT').eq(0).focus();
};

// main 
// ====

IHasAMoney.main = function()
{
    $(window).resize(IHasAMoney.resize);
    IHasAMoney.resize();

    $(document).keypress(IHasAMoney.navigate);
    $(document).keydown(IHasAMoney.arrows);
    $(document).mousewheel(IHasAMoney.kill)

    $('INPUT').keypress(IHasAMoney.stopPropagation);
    $('INPUT').keyup(IHasAMoney.tagCreatorKeyup);

    $('TBODY TR').eq(0).addClass('focus');
    $('TBODY TR').hover(
        function () {$(this).addClass('ocus'); },
        function () {$(this).removeClass('ocus'); }
    );

    IHasAMoney.highlightRowCol();
    IHasAMoney.openSplash();
    IHasAMoney.switchToSignIn();
    $('#splash #fake').click(IHasAMoney.closeSplash);
    $('#splash FORM').submit(IHasAMoney.submitForm);
    $('#splash FORM #other').click(IHasAMoney.toggleForm);
};
