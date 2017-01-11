## Globalify

## Wat

Globalify will install from npm then browserify a module.

## Why would anyone want this!?

For easy usage in testing sites like jsperf.com, or jsbin etc etc..

## Usage

### cmdline:

    npm -i globalify -g

    globalify gedi -o gedi-0.10.0.js

### API:

    var globalify = require('globalify');

    globalify({
            module: 'gedi',
            version: '0.10.0', // OPTIONAL, Will default to x.x.x
            globalVariable: 'gedi' or function(moduleName, version){ ... }, // OPTIONAL, Will default to the module name camelCased.
            installDirectory: 'someDir' // OPTIONAL, Will default to globalify_modules
        },
        function(error){
            // Something went a bit shit.
        }
    ).pipe(myAwesomeWriteStream);
