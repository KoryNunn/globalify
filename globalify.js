#! /usr/bin/env node


function globalify(){
    var program = require('commander'),
        browserify = require('browserify'),
        resumer = require('resumer'),
        path = require('path'),
        fs = require('fs'),
        childProcess = require("child_process"),
        exec = childProcess.exec;
        packageJson = require('./package.json'),
        moduleName = process.argv[2],
        version = process.argv[3] || 'x.x.x',
        outputFileName = moduleName + '-' + version.replace(/\./g,'-') + '.js';

    program
      .version(packageJson.version)
      .option('-g, --globalName [globalName]', 'the name of the global to expose')
      .parse(process.argv);

    function globalifyModule(moduleName, callback){

        var stream = resumer().queue('window["' + (program.globalName || moduleName) + '"] = require("' + moduleName + '");').end();
        var b = browserify({
            entries: [stream],
            //basedir: packageJson.modulesDirectory
        });
        b.bundle(callback).pipe(fs.createWriteStream(outputFileName));
    }

    function instalModule(moduleName, version, callback){
        exec('npm install ' + moduleName + '@"' + version + '"', function(error){
        //exec('npm --prefix ' + packageJson.modulesDirectory + ' install ' + moduleName + '@"' + version + '"', function(error){
            callback(error);
        }).stdout.pipe(process.stdout);
    }

    function globalifyCallback(error, data){
        console.log(error);
        if(!error){
            return;
        }
        instalModule(moduleName, version, function(error){
            if(error){
                console.log(error);
                return;
            }
            globalifyModule(moduleName, globalifyCallback);
        });
    }

    globalifyModule(moduleName, globalifyCallback);

}

globalify();