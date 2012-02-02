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

    var transactionHeight = Math.floor(WIN.height() / 2); // Why 2?
    transactionHeight -= (transactionHeight % 14); // fit for 14px-height rows
    var topHeight = WIN.height() - transactionHeight - 1;
    $('#top').height(topHeight);
    $('#transactions').height(transactionHeight);
    $('#transactions TABLE').css('margin-bottom', transactionHeight - 14);
    
    var summary = $('#top TABLE');
    if (summary.length > 0)
    {
        summary.css('left', $('.description').offset().left - 14);
        var balanceRight = WIN.width() - $('#transactions .tag').offset().left + 5;
        $('#balance').css('right', balanceRight);
    }
};


// Tags
// ====

IHazMoney.renderTags = function(tags)
{
    $('#tags').empty();
    for (var i=0, tag; tag = tags[i]; i++)
    {
        $('#tags').append('<tr><td>'+tag+'</td></tr>');
    }
};

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

IHazMoney.toggleTag = function(e)
{
    var cell = $(e.target);
    var tag = cell.attr('tag');
    var tid = $(cell).parent().attr('tid');
    var tagged = cell.hasClass('tagged');
    cell.toggleClass('tagged');
    if (tagged)
        jQuery.getJSON('/untag.json', {tid: tid, tag: tag});
    else 
        jQuery.getJSON('/tag.json', {tid: tid, tag: tag});
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

IHazMoney.tagIn = function()
{
    var tag = $(this).attr('tag');
    $('TR[tag="' + tag + '"]').addClass('hover');
};

IHazMoney.tagOut = function()
{
    var tag = $(this).attr('tag');
    $('TR[tag="' + tag + '"]').removeClass('hover');
};

IHazMoney.rowIn = function()
{
    $(this).addClass('focus');
};

IHazMoney.rowOut = function()
{
    $(this).removeClass('focus');
};

IHazMoney.scrollBy = function(num)
{
    var $t = $('#transactions');
    var newTop = $t.scrollTop() + (num * 14);
    var max = $('#transactions TABLE').height() - 14;
    if (Math.abs(num) > 1)
    {
        if (newTop < 0)
            newTop = 0;
        if (newTop > max)
            newTop = max;
    }
    if (newTop >= 0 && newTop <= max)
    {
        $t.scrollTop(newTop);
        $('#transactions TR.focus').removeClass('focus');
        $('#transactions TR').eq(newTop / 14).addClass('focus');
    }
};

IHazMoney.navigate = function(e)
{
    var nrows = 1;
    if (e.ctrlKey)
        nrows = $('#transactions').height() / 14; // page at a time
    if (e.shiftKey)
        nrows = $('#transactions TABLE').height() / 14; // jump top/bottom
    switch (e.which)
    {
        case 10:  // <ctrl>-j
        case 74:  // J
        case 106: // j
            IHazMoney.scrollBy(nrows);
            break;
        case 11:  // <ctrl>-k
        case 75:  // K
        case 107: // k
            IHazMoney.scrollBy(-nrows);
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

    $('#transactions').mousewheel(function(e, delta)
    {
        e.stopPropagation();
        e.preventDefault();

        /*
        var shift = delta * 14;
        if (Math.abs(shift) < 14)
            shift = (shift < 0) ? -14 : 14;
        else
            shift = Math.round(delta) * 14
        
        var transactions = $('#transactions');
        transactions.scrollTop(transactions.scrollTop() - shift);
        */

        return false;
    });

    $('TD.tag').click(IHazMoney.toggleTag);
    $('BUTTON').click(IHazMoney.createTag);
    $('#top .knob').click(IHazMoney.toggleTagCreator);
    $('#top INPUT').keyup(IHazMoney.tagCreatorKeyup);
    //$('.tag').hover(IHazMoney.tagIn, IHazMoney.tagOut);
    //$('#transactions TR').hover(IHazMoney.rowIn, IHazMoney.rowOut);
    $('#transactions TR').eq(0).addClass('focus');
    $(document).keypress(IHazMoney.navigate);
    $('INPUT').keypress(IHazMoney.stopPropagation);
};
