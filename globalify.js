var browserify = require('browserify'),
    fs = require('fs'),
    resumer = require('resumer'),
    path = require('path'),
    childProcess = require("child_process"),
    exec = childProcess.exec,
    stream = require('stream'),
    defaults = {
        installDirectory: './globalify_modules',
        version: 'x.x.x'
    };

module.exports = function globalify(settings, callback){

    settings = settings || {};

    for(var key in defaults){
        settings[key] = settings[key] || defaults[key];
    }

    var moduleName = settings.module,
        version = settings.version,
        outputFileName = moduleName + '-' + version.replace(/\./g,'-') + '.js',
        outputStream = stream.PassThrough(),
        bundleStream;

    function globalifyModule(moduleName, callback){

        var stream = resumer().queue('window["' + (settings.globalVariable || moduleName) + '"] = require("' + moduleName + '");').end();
        var b = browserify({
            entries: [stream],
            basedir: path.resolve(process.cwd(), settings.installDirectory)
        });

        bundleStream = b.bundle(function(error){
            callback(error);
        });
    }

    function installModule(moduleName, version, callback){
        var installDirectory = path.resolve(process.cwd(), settings.installDirectory),
            packagePath = path.join(installDirectory, 'package.json');

        try {
            if(!fs.lstatSync(installDirectory).isDirectory()){
                fs.mkdirSync(installDirectory);
            }
        } catch (e) {
            // ...
        }

        if(!fs.existsSync(packagePath)){
            fs.writeFileSync(packagePath, JSON.stringify({
                name:'globalify-modules'
            }));
        };

        exec('npm install ' + moduleName + '@"' + version + '"',
        {
            cwd: installDirectory
        },
        function(error){
            callback(error);
        }).stdout.pipe(process.stdout);
    }

    function globalifyCallback(error){
        if(error){
            console.log(error);
            installModule(moduleName, version, function(error){
                if(error){
                    console.log(error);
                    return;
                }
                globalifyModule(moduleName, globalifyCallback);
            });
            return;
        }

        bundleStream.pipe(outputStream);
    }

    globalifyModule(moduleName, globalifyCallback);

    return outputStream;
}