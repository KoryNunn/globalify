var browserify = require('browserify'),
    fs = require('fs'),
    npm = require('npm'),
    resumer = require('resumer'),
    path = require('path'),
    stream = require('stream'),
    defaults = {
        installDirectory: './globalify_modules',
        version: 'x.x.x'
    },
    rootPath = __dirname;

console.log(rootPath);

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
            basedir: path.resolve(rootPath, settings.installDirectory)
        });

        bundleStream = b.bundle(callback).pipe(outputStream);
    }

    function npmInstall(module, version, callback){
        var nameAndVersion = module + (version ? '@"' + version + '"' : '');
        npm.commands.install([nameAndVersion], function (error, data) {
            callback(error);
        });
    }

    function installModule(moduleName, version, callback){
        var installDirectory = path.resolve(rootPath, settings.installDirectory),
            packagePath = path.join(installDirectory, 'package.json');

        if(!fs.existsSync(installDirectory)){
            fs.mkdirSync(installDirectory);
        }

        if(!fs.existsSync(packagePath)){
            fs.writeFileSync(packagePath, JSON.stringify({
                name:'globalify-modules'
            }));
        }

        npm.load({
                prefix: installDirectory
            },
            function(error) {
                if(!version || version === 'x.x.x'){
                    npmInstall(moduleName, null, callback);
                }else{
                    npmInstall(moduleName, version, callback);
                }
            }
        );
    }

    installModule(moduleName, version, function(error){
        if(error){
            callback(error);
            return;
        }
        globalifyModule(moduleName, callback);
    });

    return outputStream;
}