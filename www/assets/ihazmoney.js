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

    var transactionHeight = Math.floor(WIN.height() / 2);
    transactionHeight -= (transactionHeight % 14);
    // fit for 14px-height rows
    var topHeight = WIN.height() - transactionHeight - 1;
    $('#top').height(topHeight);
    $('#transactions').height(transactionHeight);
    var margin = Math.floor(transactionHeight / 2);
    $('#transactions TABLE').css('margin-bottom', margin);
    
    var summary = $('#top TABLE');
    var half = WIN.width() / 2;
    if (summary.length > 0)
    {
        summary.css('left', half - 14 - 5 - 5 - 1)
        $('#balance').css('right', half + 14 + 5 + 5 + 1 + 5);
        $('.description').width(half);
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

IHazMoney.setTag = function()
{
    var transaction = $('#transactions .focus');
    var tid = transaction.attr('tid');

    var current = $('#top .marker.current');
    var cursor = $('#top .marker.cursor');

    var currentTag = current.parent().attr('tag');
    var cursorTag = cursor.parent().attr('tag');

    if (currentTag === cursorTag)
    {
        jQuery.getJSON('/untag.json', {tid: tid});
        $('TD.tag', transaction).removeClass('tagged');
        cursor.removeClass('current');
    }
    else
    {
        jQuery.getJSON('/tag.json', {tid: tid, tag: cursorTag});
        $('TD.tag', transaction).addClass('tagged');
        transaction.attr('tag', cursorTag);
        current.removeClass('current');
        cursor.addClass('current');
    }
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
    IHazMoney.resetTagCursor();
};

IHazMoney.resetTagCursor = function()
{
    $('#top .marker.cursor').removeClass('cursor');
    $('#top .marker').eq(0).addClass('cursor');

    var tag = $('#transactions TR.focus').attr('tag');
    $('#top .marker.current').removeClass('current');
    $('#top TR[tag="' + tag + '"] TD.marker').addClass('current');
};

IHazMoney.advanceTagCursor = function(inc)
{   // Given cursor position, drop to the base /4 and add to. If <= cur, += 4
    var rows = $('#top .marker');
    var cursor = $('#top .marker.cursor');
    var from = rows.index(cursor);
    to = from + inc;
    if (to >= rows.length)
        to = to - rows.length;
    rows.eq(from).removeClass('cursor');
    rows.eq(to).addClass('cursor');
};

IHazMoney.navigate = function(e)
{
    e.preventDefault();

    var nrows = 1, to = 1, asdf = {97:1, 115:2, 100:3, 102:4};
    if (e.shiftKey)
        nrows = $('#transactions').height() / 14;       // page at a time
    if (e.ctrlKey)
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
        case 65:  // A
        case 83:  // S 
        case 68:  // D 
        case 70:  // F 
            to = -1;
            e.which += 32; // convert to lowercase
        case 97:  // a
        case 115: // s
        case 100: // d 
        case 102: // f
            to *= asdf[e.which];
            IHazMoney.advanceTagCursor(to);
            break;
        case 32:  // <spacebar>
            if ($('#top .cursor').index() === 0)
                IHazMoney.toggleTagCreator();
            else
                IHazMoney.setTag();
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

    $(document).mousewheel(function(e, delta)
    {
        // NO MOUSE FOR YOU!!!!!!!!!!!!!!!
        e.stopPropagation();
        e.preventDefault();
        return false;
    });

    $('#top INPUT').keyup(IHazMoney.tagCreatorKeyup);
    $('#top .marker').eq(0).addClass('cursor');
    $('#transactions TR').eq(0).addClass('focus');
    var firstTag = $('#transactions .focus').attr('tag');
    $('#top TR[tag="' + firstTag + '"] TD.marker').addClass('current');
    $(document).keypress(IHazMoney.navigate);
    $('INPUT').keypress(IHazMoney.stopPropagation);
};
