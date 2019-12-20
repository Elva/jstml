#!/usr/bin/env node

/*
    jstml
    Javascript template pre-compiler with namespacing support.

    Usage:
    jstml --dir=src/templates > templates.js
    jstml --dir=src/templates --namespace=MyApp.templates > templates.js

    Lasha Tavartkiladze
    2016-02-19
*/ 



var lib = {
    path: require('path'),
    fs:   require('fs')
};



var escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '`': '&#x60;'
};
var escapeRegExp = /\\|'|\r|\n|\u2028|\u2029/g;
var escapes = {
    "'": "'",
    '\\': '\\',
    '\r': 'r',
    '\n': 'n',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
};

function createEscaper(map) {
    function escaper(match) {
        return map[match];
    }

    var source = '(?:' + Object.keys(map).join('|') + ')';
    var testRegexp = RegExp(source);
    var replaceRegexp = RegExp(source, 'g');

    return function(string) {
        string = string == null ? '' : '' + string;
        return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
    };
}

function escapeChar(str) {
    return str.replace(escapeRegExp, replaceChar);
}

function replaceChar(match) {
    return '\\' + escapes[match];
}



// Template settings.
var templateSettings = {
    interpolate: /<%=([\s\S]+?)%>/g,
    evaluate:    /<%([\s\S]+?)%>/g,
    escape:      /<%-([\s\S]+?)%>/g
};

// Combine delimiters into one regular expression via alternation.
var matcher = RegExp([
    templateSettings.interpolate.source,
    templateSettings.evaluate.source,
    templateSettings.escape.source
].join('|') + '|$', 'g');


var escapeHTML = createEscaper(createEscaper);

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

    content.replace(matcher, function (match, interpolate, evaluate, escape, offset) {
        source += content.slice(index, offset).replace(escapeRegExp, escapeChar);
        index = offset + match.length;

        if (escape) {
            source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
        } else if (interpolate) {
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
// expandNamespace('APP.theme.render')
//
// Returns:
//
// 'APP.theme = APP.theme = {};
//  APP.theme.render = '
//
function expandNamespace(namespace) {
    var parts = namespace.split('.');
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
// Convert dashed string to camelCased one.
//
function camelCase(str) { 
    return str.toLowerCase().replace(/-(.)/g, function (match, charAfterDash) {
        return charAfterDash.toUpperCase();
    });
}



//
// Parse command line arguments.
// --yes=no => { yes: "no" }
//
function parseArgs(args) {
    var parsedArgs = {};
    var dashesRe = /^--/;

    args.forEach(function (arg) {
        var parts = arg.split('=');
        if (parts.length === 2 && dashesRe.test(parts[0])) {
            parsedArgs[parts[0].replace(dashesRe, '')] = parts[1];
        }
    });

    return parsedArgs;
}



//
// Walk inside a directory hierarcy recursively 
// and return an array of all file paths found.
//
function getAllFilePathsSync(dirPath) {
    var files = [];

    lib.fs.readdirSync(dirPath).forEach(function (filename) {
        var path = lib.path.join(dirPath, filename);
        var stat = lib.fs.statSync(path);

        if (stat && stat.isDirectory()) {
            files = files.concat(getAllFilePathsSync(path));
        } else if (stat.isFile()) {
            files.push(path);
        }
    });

    return files;
}



//
// CLI
//
var argv = parseArgs(process.argv.slice(2));
var isNewFormat = !!argv.newformat || false;
var dirPath = argv.dir || '.';
var namespace = argv.namespace || 'APP.TEMPLATE';
var extension = argv.extension || '.jstml';
var outputDir = argv.outdir || './build';
var files = getAllFilePathsSync(dirPath);
var output = '';
var lessCSSOutput = '';

files.forEach(function (filePath) {
    if (filePath.indexOf(extension) !== -1) {
        var folderNames = filePath.replace(dirPath, '').split('/').filter(function (name) {
            return name && name.indexOf(extension) === -1;
        }).map(camelCase).join('.');
        var content  = lib.fs.readFileSync(filePath, 'utf8');
        var fileName = lib.path.basename(filePath, '.jstml');
        var funcName = camelCase(fileName);
        var fullName = folderNames ? [folderNames, funcName].join('.') : funcName;
        var className   = 'c-' + fullName.replace(/\./g, '-');
        var prefix      = expandNamespace([namespace, fullName].join('.'));
        var func;

        if (isNewFormat) {
            let tpl = content.match(/<template>(.*)<\/template>/si);
            let js  = content.match(/<script>(.*)<\/script>/si);
            let css = content.match(/<style>(.*)<\/style>/si);

            tpl = tpl ? `<div class="${className}">${tpl[1]}</div>` : '';
            js  = js ? js[1] : '';
            css = css ? css[1] : '';

            output += `${prefix}(function () {
                'use strict';

                ${js}
            })() || {};\n${prefix.replace(/ = $/, '')}.tpl = function (data) { 
                ${compile(tpl)} 
            };\n`;

            lessCSSOutput += `.${className} { ${css} }\n`;
        } else {
            func = wrapFunctionBody(funcName, compile(content));
            output += prefix + func;
        }
    }
});

if (isNewFormat) {
    if (!lib.fs.existsSync(outputDir)){
        lib.fs.mkdirSync(outputDir);
    }
    lib.fs.writeFileSync(outputDir + '/components.js', output);
    lib.fs.writeFileSync(outputDir + '/components.less', lessCSSOutput);
} else {
    process.stdout.write(output);
}