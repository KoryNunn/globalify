#! /usr/bin/env node


function globalify(){
    var program = require('commander'),
        mdeps = require('module-deps'),
        path = require('path'),
        fs = require('fs'),
        childProcess = require("child_process"),
        exec = childProcess.exec,
        packageJson = require('./package.json'),
        modulesDirectory = packageJson.modulesDirectory,
        moduleName = process.argv[2];

    program
      .version(packageJson.version)
      .option('-g, --globalName [globalName]', 'the name of the global to expose')
      .parse(process.argv);

    function getDeps(moduleDirectory, moduleName){
        mdeps(path.join(moduleDirectory, moduleName)).on('data', function(){
            console.log(arguments);
        });
    }

    function instalModule(moduleName, version){

        var moduleDirectory = path.join(modulesDirectory, moduleName + '_' + version);

        if(fs.exists(moduleDirectory)){
            getDeps(moduleDirectory, moduleName);
            return;
        }

        exec('npm --prefix ' + modulesDirectory + ' install ' + moduleName + '@"' + version + '"', function(error){
            console.log(error);

            var moduleDirectory = path.join(modulesDirectory, moduleName + '_' + version);

            console.log(moduleDirectory);

            getDeps(moduleDirectory, moduleName);

        });
    }

    instalModule(moduleName, 'x.x.x');

}

globalify();