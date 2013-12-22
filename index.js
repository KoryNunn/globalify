#!/usr/bin/env node
var program = require('commander'),
    globalify = require('./globalify'),
    packageJson = require('./package.json'),
    moduleName = process.argv[2],
    version = process.argv[3] || 'x.x.x',
    fs = require('fs'),
    outputFileName = moduleName + '-' + version.replace(/\./g,'-') + '.js';

program
  .version(packageJson.version)
  .option('-g, --globalVariable [globalVariable]', 'the name of the global variable to expose')
  .parse(process.argv);

globalify({
        module: moduleName,
        version: version,
        globalVariable: process.globalVariable,
        instalDirectory: packageJson.instalDirectory
    },
    function(error){
        if(error){
            console.log(error);
        }
    }
).pipe(process.stdout);