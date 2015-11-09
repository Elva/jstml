#!/usr/bin/env node

/*
    jstml
    Javascript template pre-compiler with namespacing support.

    Usage:
    jstml filepath(s) namespace > output/file/path
    jstml path/to/templates/*.jstml APP.theme.whatever > theme.whatever.js

    Lasha Tavartkiladze
    2015-07-21
*/ 



//
// Node modules.
//
var node = {
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
function escapeChars(str) {
    return str.replace(escapeRegExp, replaceChar);
}
function replaceChar(match) {
    return '\\' + escapes[match];
}



//
// Compile template content to a Javascript eval string.
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
    return "var _jstml = ''; _jstml += '" + escapeChars(content)

        .replace(/<%=([^<]+)%>/g, "' + ($1) + '")
        .replace(/<%([^<]+)%>/g,  "'; $1 _jstml += '")
        //.replace(/\\'/g, '\'')    // temp fix: unescape quotes inside evaluated scripts.
        //.replace(/\n|\r|\t/g, '') // temp fix: remove newlines.

    + "'; return _jstml;";
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
    if (node.fs.statSync(filePath).isFile()) {
        var content  = node.fs.readFileSync(filePath, 'utf8');
        var fileName = node.path.basename(filePath, '.jstml');
        var funcName = camelCase(fileName);
        var prefix   = expandPrefix(namespace + '.' + funcName);
        var func     = wrapFunctionBody(funcName, compile(content));
        
        output += namespace ? prefix + func : func;
    }
});

process.stdout.write(output);