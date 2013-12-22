## Globalify

## Wat

Globalify will install from npm then browserify a module.

## Why would anyone want this!?

For easy usage in testing sites like jsperf.com, or jsbin etc etc..

## Usage

### cmdline:

    npm -i globalify -g

    globalify gedi 0.10.0 > gedi-0.10.0.js

### API:

    var globalify = require('globalify');

    globalify({
            module: 'gedi',
            version: '0.10.0', // OPTIONAL, Will default to x.x.x
            globalVariable: 'gedi', // OPTIONAL, Will default to the module name.
            instalDirectory: 'someDir' // OPTIONAL, Will default to globalify_modules
        },
        function(error){
            // Something went a bit shit.
        }
    ).pipe(myAwesomeWriteStream);