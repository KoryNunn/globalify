#!/usr/bin/env node
var program = require('commander'),
    globalify = require('./globalify'),
    packageJson = require('./package.json'),
    fs = require('fs');

program
    .version(packageJson.version)
    .usage('<module> [options]')
    .arguments('<module>')
    .option('-o, --out <outputFileName>', 'the output path')
    .option('-g, --globalVariable [globalVariable]', 'the name of the global variable to expose')
    .parse(process.argv);

if (program.args.length !== 1) {
    program.help()
}

var moduleNameAndVersion = program.args[0].split('@'),
    moduleName = moduleNameAndVersion[0],
    version = moduleNameAndVersion[1] || 'x.x.x';

var outStream = fs.createWriteStream(program.out || moduleName + '.js');

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
