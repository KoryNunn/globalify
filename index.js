#!/usr/bin/env node
var program = require('commander'),
    globalify = require('./globalify'),
    packageJson = require('./package.json'),
    moduleNameAndVersionString = process.argv[2],
    fs = require('fs');

var moduleNameAndVersion = moduleNameAndVersionString.split('@'),
    moduleName = moduleNameAndVersion[0],
    version = moduleNameAndVersion[1] || 'x.x.x';

program
  .version(packageJson.version)
  .option('-g, --globalVariable [globalVariable]', 'the name of the global variable to expose')
  .option('-o, --out [outputFileName]', 'the output path')
  .parse(process.argv);

var outStream = fs.createWriteStream(program.out);

globalify({
        module: moduleName,
        version: version,
        globalVariable: program.globalVariable,
        instalDirectory: packageJson.instalDirectory
    },
    function(error){
        if(error){
            console.log(error);
        }
    }
).pipe(outStream);