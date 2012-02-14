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

IHazMoney = {};

IHazMoney.wire = function(name, callback)
{
    $(IHazMoney).bind(name, callback);
};

IHazMoney.fire = function(name)
{
    $(IHazMoney).trigger(name);
};

IHazMoney.resize = function()
{
    var WIN = $(window);
    var BOD = $('BODY');
    var bod = $('#body');

    var transactionHeight = WIN.height() - 24 - (WIN.height() % 14) ;
    // fit for 14px-height rows
    var topHeight = WIN.height() - transactionHeight - 1;
    $('#top').height(topHeight);
    $('.corner').width( $('.year').eq(0).width()
                      + $('.month').width()
                      + $('.day').width()
                      + $('.description').width()
                       );
    $('THEAD.pegged').width($('THEAD.unpegged').width());
    $('THEAD.unpegged TH').each(function(i)
    {
        $('THEAD.pegged TH').eq(i).width($(this).width());
    });
    $('TBODY').height(transactionHeight);
};


// Tags
// ====

IHazMoney.createTag = function(e)
{
    var button = $(e.target);
    var tag = $('#top INPUT').val();
    jQuery.ajax({ type: "POST"
                , url: "/tags/" + tag + "/"
                , success: function() { window.location.reload() }
                , dataType: 'json'
                 })
};

IHazMoney.toggleTag = function()
{
    IHazMoney.updateAlso();
};

IHazMoney.toggleTagCreator = function()
{
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

IHazMoney.tagCreatorKeyup = function(e)
{
    switch (e.which)
    {
        case 27:
            IHazMoney.toggleTagCreator();
            break;
        case 13:
            IHazMoney.createTag({"target": $('#top BUTTON').get(0)});
            break;
    }
};

IHazMoney.scrollBy = function(num)
{
    var container = $('BODY');
    var newTop = container.scrollTop() + (num * 14);
    var max = $('TBODY').height() - 14;
    if (Math.abs(num) > 1)
    {
        if (newTop < 0)
            newTop = 0;
        if (newTop > max)
            newTop = max;
    }
    if (newTop >= 0 && newTop <= max)
    {
        container.scrollTop(newTop);
        $('TBODY TR.focus').removeClass('focus');
        $('TBODY TR').eq(newTop / 14).addClass('focus');
    }
};

IHazMoney.changeTag = function(inc)
{
    var tid = $('TR.focus').attr('tid');
    var cols = $('TR.focus TD.amount');
    var from = cols.index($('TR.focus TD.amount.tagged'));
    var to = from + inc;
    var tag;

    console.log(from, to);

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
    from.empty();
};

IHazMoney.jumpNextUntagged = function()
{
    var from = $('#transactions .focus');
    console.log('tbd ...');
}

IHazMoney.jumpPreviousUntagged = function()
{
    console.log('tbd ...');
}

IHazMoney.arrows = function(e)
{
    var nrows = 1, to = 1, hl = {37:-1, 39: 1};
    console.log(e.which);
    switch (e.which)
    {
        case 38: // k
            nrows = -1
        case 40: // j
            IHazMoney.scrollBy(nrows);
            e.preventDefault();
            break;
        case 37: // h 
        case 39: // l
            to *= hl[e.which];
            IHazMoney.changeTag(to);
            e.preventDefault();
            break;
    }
};

IHazMoney.navigate = function(e)
{
    e.preventDefault();

    var nrows = 1, to = 1, hl = {104:-1, 108: 1};
    if (e.shiftKey)
        nrows = $('#transactions').height() / 14;       // page at a time
    if (e.ctrlKey)
        nrows = $('#transactions TABLE').height() / 14; // jump top/bottom
    console.log(e.which);
    switch (e.which)
    {
        case 107: // k
            nrows = -1
        case 106: // j
            IHazMoney.scrollBy(nrows);
            break;
        case 104: // h 
        case 108: // l
            to *= hl[e.which];
            IHazMoney.changeTag(to);
            break;
        case 110: // n
            IHazMoney.jumpNextUntagged();
            break;
        case 112: // p
            IHazMoney.jumpPreviousUntagged();
            break;
    }
};

IHazMoney.stopPropagation = function(e)
{
    e.stopPropagation();
};

// main 
// ====

IHazMoney.main = function()
{
    $(window).resize(IHazMoney.resize);
    IHazMoney.resize();

    $(document).keypress(IHazMoney.navigate);
    $(document).keydown(IHazMoney.arrows);
    $('INPUT').keypress(IHazMoney.stopPropagation);
    $('INPUT').keyup(IHazMoney.tagCreatorKeyup);

    $('TBODY TR').eq(0).addClass('focus');
    $('TBODY TR').hover(
        function () {$(this).addClass('ocus'); },
        function () {$(this).removeClass('ocus'); }
    );

    /*
    jQuery.mousemove(function(e) {
        // http://stackoverflow.com/questions/1133807/
        window.mouseXPos = e.pageX;
        window.mouseYPos = e.pageY;
    });
    */
};
