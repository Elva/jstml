#!/usr/bin/env node

/*
    jstml
    Javascript template pre-compiler with namespacing support.

    Usage:
    jstml filepath(s) namespace > output/file/path
    jstml path/to/templates/*.jstml APP.theme.whatever > theme.whatever.js

    Lasha Tavartkiladze
    2015-12-22
*/ 



var lib = {
    path: require('path'),
    fs:   require('fs')
};



//
// Escape quotes and slashs.
//
var escapeRegExp = /\\|'|\r|\n|\u2028|\u2029/g;
var escapes = {
    "'": "'",
    '\\': '\\',
    '\r': 'r',
    '\n': 'n',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
};

function escapeChar(str) {
    return str.replace(escapeRegExp, replaceChar);
}

function replaceChar(match) {
    return '\\' + escapes[match];
}



// Template settings.
var templateSettings = {
    interpolate: /<%=([\s\S]+?)%>/g,
    evaluate:    /<%([\s\S]+?)%>/g
};

// Combine delimiters into one regular expression via alternation.
var matcher = RegExp([
    templateSettings.interpolate.source,
    templateSettings.evaluate.source
].join('|') + '|$', 'g');



//
// Compile template content to a Javascript eval string, escaping string literals appropriately.
// Based on underscore.js templating.
//
//    compile('<ul>
//        <% [1, 2, 3, 4, 5].forEach(function (num) { %>
//            <li><%=num%></li>
//        <% }); %>
//    </ul>');
//
// Will return string like this:
//
//    "var _jstml = ''; _jstml += '<ul>';  
//        [1, 2, 3, 4, 5].forEach(function (num) {
//            _jstml += '<li>' + (num) + '</li>';  
//        });
//    _jstml += '</ul>'; return _jstml";
//
function compile(content) {
    var index = 0;
    var source = "__jstml += '";

    content.replace(matcher, function (match, interpolate, evaluate, offset) {
        source += content.slice(index, offset).replace(escapeRegExp, escapeChar);
        index = offset + match.length;

        if (interpolate) {
            source += "'+\n( (__t = (" + interpolate + ")) == null ? '' : __t ) +\n'";
        } else if (evaluate) {
            source += "';\n" + evaluate + "\n__jstml += '";
        }
    });

    source += "';\n";
    source = "var __t, __jstml = '';\n" + source + 'return __jstml;\n';

    return source;
}



//
// Crate a function definition string.
//
function wrapFunctionBody(name, body) {
    return 'function ' + name + ' (data) {\n' + body  + '\n};\n';
}



//
// expandPrefix('APP.theme.whatever')
//
// Returns:
//
// 'APP.theme = APP.theme = {};
//  APP.theme.whatever = '
//
function expandPrefix(prefix) {
    var parts = prefix.split('.');
    var p = '';
    var str = '';

    parts.forEach(function (part, i) {
        if (i == 0) {
            p += part + '.';
        } else if (i < parts.length - 1) {
            p += part;
            str += p + ' = ' + p + ' || {}; \n';
            p += '.';
        }
        else {
            str += p + part + ' = ';
        }
    });

    return str;
}



//
// Convert dashed-string to camelCased one.
//
function camelCase(str) { 
    return str.toLowerCase().replace(/-(.)/g, function (match, charAfterDash) {
        return charAfterDash.toUpperCase();
    });
}



//
// CLI
//
var argv = process.argv.slice(2);
var namespace = argv.pop();
var output = '';

argv.forEach(function (filePath) {
    if (lib.fs.statSync(filePath).isFile()) {
        var content  = lib.fs.readFileSync(filePath, 'utf8');
        var fileName = lib.path.basename(filePath, '.jstml');
        var funcName = camelCase(fileName);
        var prefix   = expandPrefix(namespace + '.' + funcName);
        var func     = wrapFunctionBody(funcName, compile(content));
        
        output += namespace ? prefix + func : func;
    }
});

process.stdout.write(output);