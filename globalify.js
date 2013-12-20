#! /usr/bin/env node


function globalify(){
    var program = require('commander'),
        browserify = require('browserify'),
        resumer = require('resumer'),
        path = require('path'),
        fs = require('fs'),
        npm = require("npm"),
        packageJson = require('./package.json'),
        moduleName = process.argv[2];

    program
      .version(packageJson.version)
      .option('-g, --globalName [globalName]', 'the name of the global to expose')
      .parse(process.argv);

    function globalifyModule(moduleName){
        var stream = resumer().queue('window["' + (program.globalName || moduleName) + '"] = require("' + moduleName + '");').end();

        var b = browserify([stream]);
        b.bundle().pipe(process.stdout);
    }

    function instalModule(moduleName, version){
        npm.load({ prefix: packageJson.modulesDirectory },
            function (error) {
                if(!error){
                    globalifyModule(moduleName);
                }
                npm.config.set('dir', packageJson.modulesDirectory);

                npm.commands.install([moduleName], function (error, data) {
                    if(error){
                        console.log(error);
                    }

                    globalifyModule(moduleName);
                });
                npm.on("log", function (message) {
                    console.log(message);
                });

        })
    }

    instalModule(moduleName, 'x.x.x');

}

globalify();