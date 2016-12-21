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
    program.help();
}

var moduleArgument = program.args[0];

var moduleNodes, moduleName, version;
if (moduleArgument.indexOf('@') === 0) {
    // scoped package
    moduleNodes = moduleArgument.slice(1).split('@');
    moduleName = '@' + moduleNodes[0];
}
else {
    moduleNodes = moduleArgument.split('@');
    moduleName = moduleNodes[0];
}

version = moduleNodes[1] || 'x.x.x';

var outStream = fs.createWriteStream(program.out || moduleName.replace('/', '-') + '.js');

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
