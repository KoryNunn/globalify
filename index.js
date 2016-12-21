#!/usr/bin/env node
var program = require('commander'),
    globalify = require('./globalify'),
    packageJson = require('./package.json'),
    fs = require('fs'),
    matchModuleInfo = /^(?:(.+)@|$)(.+$)/;

program
    .version(packageJson.version)
    .usage('<module> [options]')
    .arguments('<module>')
    .option('-o, --out <outputFileName>', 'the output path')
    .option('-g, --globalVariable [globalVariable]', 'the name of the global variable to expose')
    .parse(process.argv);

if (program.args.length !== 1) {
    program.help();
}

var moduleArgument = program.args[0],
    moduleInfoMatch = moduleArgument.match(matchModuleInfo);

if(!moduleInfoMatch){
    throw new Error('invalid moduleName');
}

var moduleName = moduleInfoMatch[1],
    version = moduleInfoMatch[2] || 'x.x.x';

var outStream = fs.createWriteStream(program.out || moduleName.replace(/\//g, '-') + '.js');

globalify({
        module: moduleName,
        version: version,
        globalVariable: program.globalVariable,
        installDirectory: packageJson.installDirectory
    },
    function(error){
        if(error){
            console.log(error);
        }
    }
).pipe(outStream);
