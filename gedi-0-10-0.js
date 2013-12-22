(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
window["gedi"] = require("gedi");
},{"gedi":2}],2:[function(require,module,exports){
//Copyright (C) 2012 Kory Nunn

//Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

//The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

//THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

var Gel = require('gel-js'),
    HybridMap = require('hybrid-map').HybridMap,
    createPathToken = require('./pathToken'),
    Token = Gel.Token,
    paths = require('gedi-paths'),
    pathConstants = paths.constants,
    createSpec = require('spec-js');

//Create gedi
var gediConstructor = newGedi;

var exceptions = {
    invalidPath: 'Invalid path syntax'
};

var arrayProto = [];
var isBrowser = typeof Node != 'undefined';


//***********************************************
//
//      Gedi object.
//
//***********************************************

//Creates the public gedi constructor
function newGedi(model) {

    // Storage for the applications model
    model = model || {};

        // Storage for model event handles
    var internalBindings = [],

        // Storage for tracking references within the model
        modelReferences = new HybridMap(),

        // Storage for tracking the dirty state of the model
        dirtyModel = {},

        // gel instance
        gel,

        PathToken = createPathToken(get, model);

    // Add a new object who's references should be tracked.
    function addModelReference(path, object){
        if(!object || typeof object !== 'object'){
            return;
        }

        var path = paths.resolve(paths.createRoot(),path),
            objectReferences = modelReferences.get(object);

        if(!objectReferences){
            objectReferences = {};
            modelReferences.set(object, objectReferences);
        }

        if(!(path in objectReferences)){
            objectReferences[path] = null;
        }

        if(isBrowser && object instanceof Node){
            return;
        }

        for(var key in object){
            var prop = object[key];

            // Faster to check again here than to create pointless paths.
            if(prop && typeof prop === 'object' && !modelReferences.has(prop)){
                addModelReference(paths.append(path, paths.create(key)), prop);
            }
        }
    }

    function removeModelReference(path, object){
        if(!object || typeof object !== 'object'){
            return;
        }

        var path = paths.resolve(paths.createRoot(),path),
            objectReferences = modelReferences.get(object),
            refIndex;

        if(!objectReferences){
            return;
        }

        delete objectReferences[path];

        if(!Object.keys(objectReferences).length){
            modelReferences.del(object);
        }

        for(var key in object){
            var prop = object[key];

            // Faster to check again here than to create pointless paths.
            if(prop && typeof prop === 'object' && prop !== object){
                removeModelReference(paths.append(path, paths.create(key)), prop);
            }
        }
    }

    function triggerModelReferences(targetPath){
        var parentPath = paths.resolve(paths.createRoot(), targetPath, paths.create(pathConstants.upALevel)),
            parentObject = get(parentPath, model);

        if(!parentObject || typeof parentObject !== 'object'){
            return;
        }

        var objectReferences = modelReferences.get(parentObject);

        if(!objectReferences){
            return;
        }

        for(var path in objectReferences){
            if(path !== parentPath){
                trigger(path);
            }
        }
    }

    //Initialise model references
    addModelReference('[/]', model);

    //internal functions

    //***********************************************
    //
    //      IE indexOf polyfill
    //
    //***********************************************

    //IE Specific idiocy

    Array.prototype.indexOf = Array.prototype.indexOf || function (object) {
        for (var i = 0; i < this.length; i++) {
            if (this === object){
                return i;
            }
        }
    };

    // http://stackoverflow.com/questions/498970/how-do-i-trim-a-string-in-javascript
    String.prototype.trim = String.prototype.trim || function () { return this.replace(/^\s\s*/, '').replace(/\s\s*$/, ''); };

    // http://perfectionkills.com/instanceof-considered-harmful-or-how-to-write-a-robust-isarray/
    Array.isArray = Array.isArray || function (obj) {
        return Object.prototype.toString.call(obj) === '[object Array]';
    };

    //End IE land.

    //***********************************************
    //
    //      Array Fast Each
    //
    //***********************************************

    function each(object, callback) {
        var isArray = Array.isArray(object);
        for (var key in object) {
            if(isArray && isNaN(key)){
                continue;
            }
            if(callback(object[key], key, object)){
                break;
            }
        }
        return object;
    }

    //***********************************************
    //
    //      Gel integration
    //
    //***********************************************

    gel = new Gel();

    gel.tokenConverters.push(PathToken);

    gel.scope.isDirty = function(scope, args){
        var token = args.raw()[0];

        return isDirty(paths.resolve(scope.get('_gmc_'), (token instanceof PathToken) ? token.original : paths.create()));
    };

    gel.scope.getAllDirty = function (scope, args) {
        var token = args.raw()[0],
            path = paths.resolve(scope.get('_gmc_'), (token instanceof PathToken) && token.original),
            source = get(path, model),
            result,
            itemPath;

        if (source == null) {
            return null;
        }

        result = source.constructor();

        for (var key in source) {
            if (source.hasOwnProperty(key)) {
                itemPath = paths.resolve(path, paths.create(key));
                if (result instanceof Array) {
                    isDirty(itemPath) && result.push(source[key]);
                } else {
                    isDirty(itemPath) && (result[key] = source[key]);
                }
            }
        }

        return result;
    };

    //***********************************************
    //
    //      Get
    //
    //***********************************************

    var memoiseCache = {};

    // Lots of similarities between get and set, refactor later to reuse code.
    function get(path, model) {
        if (!path) {
            return model;
        }

        var memoiseObject = memoiseCache[path];
        if(memoiseObject && memoiseObject.model === model){
            return memoiseObject.value;
        }

        if(paths.isRoot(path)){
            return model;
        }

        var pathParts = paths.toParts(path),
            reference = model,
            index = 0,
            pathLength = pathParts.length;

        if(paths.isAbsolute(path)){
            index = 1;
        }

        for(; index < pathLength; index++){
            var key = pathParts[index];

            if (reference == null) {
                break;
            } else if (typeof reference[key] === "object") {
                reference = reference[key];
            } else {
                reference = reference[key];

                // If there are still keys in the path that have not been accessed,
                // return undefined.
                if(index < pathLength - 1){
                    reference = undefined;
                }
                break;
            }
        }

        memoiseCache[path] = {
            model: model,
            value: reference
        };

        return reference;
    }


    //***********************************************
    //
    //      Overwrite Model
    //
    //***********************************************

    function overwriteModel(replacement, model){
        for (var modelProp in model) {
            delete model[modelProp];
        }
        for (var replacementProp in replacement) {
            model[replacementProp] = replacement[replacementProp];
        }
    }


    //***********************************************
    //
    //      Set
    //
    //***********************************************

    function set(path, value, model) {
        // passed a null or undefined path, do nothing.
        if (!path) {
            return;
        }

        memoiseCache = {};

        // If you just pass in an object, you are overwriting the model.
        if (typeof path === "object") {
            value = path;
            path = paths.createRoot();
        }

        var pathParts = paths.toParts(path),
            index = 0,
            pathLength = pathParts.length;

        if(paths.isRoot(path)){
            overwriteModel(value, model);
            return;
        }

        if(paths.isAbsolute(path)){
            index = 1;
        }

        var reference = model;

        for(; index < pathLength; index++){
            var key = pathParts[index];

            // if we have hit a non-object property on the reference and we have more keys after this one
            // make an object (or array) here and move on.
            if ((typeof reference[key] !== "object" || reference[key] === null) && index < pathLength - 1) {
                if (!isNaN(key)) {
                    reference[key] = [];
                }
                else {
                    reference[key] = {};
                }
            }
            if (index === pathLength - 1) {
                // if we are at the end of the line, set to the model
                reference[key] = value;
            }
                //otherwise, RECURSANIZE!
            else {
                reference = reference[key];
            }
        }
    }

    //***********************************************
    //
    //      Remove
    //
    //***********************************************

    function remove(path, model) {
        var reference = model;

        memoiseCache = {};

        var pathParts = paths.toParts(path),
            index = 0,
            pathLength = pathParts.length;

        if(paths.isRoot(path)){
            overwriteModel({}, model);
            return;
        }

        if(paths.isAbsolute(path)){
            index = 1;
        }

        for(; index < pathLength; index++){
            var key = pathParts[index];
            //if we have hit a non-object and we have more keys after this one
            if (typeof reference[key] !== "object" && index < pathLength - 1) {
                break;
            }
            if (index === pathLength - 1) {
                // if we are at the end of the line, delete the last key

                if (reference instanceof Array) {
                    reference.splice(key, 1);
                } else {
                    delete reference[key];
                }
            } else {
                reference = reference[key];
            }
        }

        return reference;
    }


    //***********************************************
    //
    //      Trigger Binding
    //
    //***********************************************

    function trigger(path) {

        var reference = internalBindings,
            references = [reference],
            target = paths.resolve('[/]', path);

        function triggerListeners(reference, bubble) {
            if (reference != undefined && reference !== null) {
                for(var index = 0; index < reference.length; index++){
                    var callback = reference[index],
                        callbackBinding = callback.binding,
                        callbackBindingParts,
                        parentPath = callback.parentPath,
                        wildcardIndex = callbackBinding.indexOf(pathConstants.wildcard),
                        wildcardMatchFail;

                    if(bubble && !callback.captureBubbling){
                        continue;
                    }

                    if(wildcardIndex >= 0 && getPathsInExpression(callbackBinding)[0] === callbackBinding){

                        //fully resolve the callback path
                        callbackBindingParts = paths.toParts(paths.resolve('[/]', callback.parentPath, callbackBinding));

                        //null out the now not needed parent path
                        parentPath = null;

                        for(var i = 0; i < callbackBindingParts.length; i++) {
                            var pathPart = callbackBindingParts[i];
                            if(pathPart === pathConstants.wildcard){
                                callbackBindingParts[i] = target[i];
                            }else if (pathPart !== target[i]){
                                return wildcardMatchFail = true;
                            }
                        }

                        if(wildcardMatchFail){
                            continue;
                        }
                    }

                    callback({
                        target: target,
                        getValue: function(scope, returnAsTokens){
                            return modelGet(callbackBinding, parentPath, scope, returnAsTokens);
                        }
                    });
                }

                if (!bubble) {
                    for (var key in reference) {
                        if (reference.hasOwnProperty(key) && Array.isArray(reference[key])) {
                            triggerListeners(reference[key], bubble);
                        }
                    }
                }
            }
        }

        var index = 0;

        if(paths.isAbsolute(path)){
            index = 1;
        }

        var pathParts = paths.toParts(path);

        for(; index < pathParts.length; index++){
            var key = pathParts[index];
            if (!isNaN(key) || key in arrayProto) {
                key = "_" + key;
            }

            if (reference !== undefined && reference !== null) {
                reference = reference[key];
                references.push(reference);
            }
        }

        // Top down, less likely to cause changes this way.

        while (references.length > 1) {
            reference = references.shift();
            triggerListeners(reference, true);
        }

        triggerListeners(references.pop());
    }

    //***********************************************
    //
    //      Set Binding
    //
    //***********************************************

    function setBinding(binding, callback, parentPath) {

        var path,
            reference = internalBindings;

        callback.binding = callback.binding || binding;
        callback.parentPath = parentPath;
        if(!callback.references){
            callback.references = [];
        }

        //If the binding has opperators in it, break them apart and set them individually.
        if (!paths.create(binding)) {
            var expressionPaths = getPathsInExpression(binding),
                boundExpressions = {};

            for(var i = 0; i < expressionPaths.length; i++) {
                var path = expressionPaths[i];
                if(!boundExpressions[path]){
                    boundExpressions[path] = true;
                    setBinding(path, callback, parentPath);
                }
            }

            return;
        }

        path = binding;

        callback.references.push(path);

        // Should bubble.
        if(paths.isBubbleCapture(path)){
            callback.captureBubbling = true;
        }

        if (parentPath) {
            path = paths.resolve(paths.createRoot(), parentPath, path);
        }

        // Handle wildcards

        if(path.indexOf(pathConstants.wildcard)>=0){
            var parts = paths.toParts(path);
            path = paths.create(parts.slice(0, parts.indexOf(pathConstants.wildcard)));
        }

        if(paths.isRoot(path)){
            reference.push(callback);
            return;
        }

        var index = 0;

        if(paths.isAbsolute(path)){
            index = 1;
        }

        var pathParts = paths.toParts(path);

        for(; index < pathParts.length; index++){
            var key = pathParts[index];

            //escape properties of the array with an underscore.
            // numbers mean a binding has been set on an array index.
            // array property bindings like length can also be set, and thats why all array properties are escaped.
            if (!isNaN(key) || key in arrayProto) {
                key = "_" + key;
            }

            //if we have more keys after this one
            //make an array here and move on.
            if (typeof reference[key] !== "object" && index < pathParts.length - 1) {
                reference[key] = [];
                reference = reference[key];
            }
            else if (index === pathParts.length - 1) {
                // if we are at the end of the line, add the callback
                reference[key] = reference[key] || [];
                reference[key].push(callback);
            }
                //otherwise, RECURSANIZE! (ish...)
            else {
                reference = reference[key];
            }
        }
    }


    //***********************************************
    //
    //      Remove Binding
    //
    //***********************************************

    function removeBinding(path, callback){
        var callbacks;

        if(typeof path === 'function'){
            callback = path;
            path = null;
        }

        var parentPath = callback ? callback.parentPath : null;

        if(path == null){
            if(callback != null && callback.references){
                for(var i = 0; i < callback.references.length; i++) {
                    removeBinding(callback.references[i], callback);
                }
            }else{
                internalBindings = [];
            }
            return;
        }

        var expressionPaths = getPathsInExpression(path);
        if(expressionPaths.length > 1){
            for(var i = 0; i < expressionPaths.length; i++) {
                removeBinding(expressionPaths[i], callback);
            }
            return;
        }

        var resolvedPathParts = paths.toParts(paths.resolve(parentPath, path)),
            bindingPathParts = [];

        for(var i = 0; i < resolvedPathParts.length; i++){
            if(parseInt(resolvedPathParts[i]).toString() === resolvedPathParts[i]){
                bindingPathParts[i] = '_' + resolvedPathParts[i];
            }else{
                bindingPathParts[i] = resolvedPathParts[i];
            }
        }

        var escapedPath = paths.create(bindingPathParts);

        if(!callback){
            set(escapedPath, [], internalBindings);
        }

        callbacks = get(escapedPath, internalBindings);

        if(!callbacks){
            return;
        }

        for (var i = 0; i < callbacks.length; i++) {
            if(callbacks[i] === callback){
                callbacks.splice(i, 1);
                return;
            }
        }
    }


    //***********************************************
    //
    //      Get Paths
    //
    //***********************************************
    var memoisedExpressionPaths = {};
    function getPathsInExpression(expression) {
        var paths = [];

        if(memoisedExpressionPaths[expression]){
            return memoisedExpressionPaths[expression];
        }

        if (gel) {
            var tokens = gel.tokenise(expression);
            for(var index = 0; index < tokens.length; index++){
            var token = tokens[index];
                if(token instanceof PathToken){
                    paths.push(token.original);
                }
            }
        } else {
            return memoisedExpressionPaths[expression] = [paths.create(expression)];
        }
        return memoisedExpressionPaths[expression] = paths;
    }

    //***********************************************
    //
    //      Model Get
    //
    //***********************************************

    function modelGet(binding, parentPath, scope, returnAsTokens) {
        if(parentPath && typeof parentPath !== "string"){
            scope = parentPath;
            parentPath = paths.create();
        }

        if (binding) {
            var gelResult,
                expression = binding;

            scope = scope || {};

            scope['_gmc_'] = parentPath;

            return gel.evaluate(expression, scope, returnAsTokens);
        }

        parentPath = parentPath || paths.create();

        binding = paths.resolve(parentPath, binding);

        return get(binding, model);
    }

    //***********************************************
    //
    //      Model Set
    //
    //***********************************************

    function getSourcePathInfo(expression, parentPath, subPathOpperation){
        var scope = {
                _gmc_: parentPath
            },
            path;

        var resultToken = gel.evaluate(expression, scope, true)[0],
            sourcePathInfo = resultToken.sourcePathInfo;

        if(sourcePathInfo){
            if(sourcePathInfo.subPaths){
                each(sourcePathInfo.subPaths, function(item){
                    subPathOpperation(item);
                });
                return;
            }
            path = sourcePathInfo.path;
        }else{
            path = resultToken.path;
        }
        if(path){
            subPathOpperation(path);
        }
    }

    function DeletedItem(){}

    function modelSet(expression, value, parentPath, dirty) {
        if(typeof expression === 'object' && !paths.create(expression)){
            dirty = value;
            value = expression;
            expression = paths.createRoot();
        }else if(typeof parentPath === 'boolean'){
            dirty = parentPath;
            parentPath = undefined;
        }

        if(expression && !arguments[4]){
            getSourcePathInfo(expression, parentPath, function(subPath){
                modelSet(subPath, value, parentPath, dirty, true);
            });
            return;
        }

        parentPath = parentPath || paths.create();
        expression = paths.resolve(parentPath, expression);

        setDirtyState(expression, dirty);

        var previousValue = get(expression, model);

        set(expression, value, model);

        if(!(value instanceof DeletedItem)){
            addModelReference(expression, value);
            trigger(expression);
            triggerModelReferences(expression);
        }

        if(!(value && typeof value !== 'object') && previousValue && typeof previousValue === 'object'){
            removeModelReference(expression, previousValue);
        }
    }

    //***********************************************
    //
    //      Model Remove
    //
    //***********************************************

    function modelRemove(expression, parentPath, dirty) {
        if(parentPath instanceof Boolean){
            dirty = parentPath;
            parentPath = undefined;
        }

        if(expression && !arguments[3]){
            parentPaths = {};
            getSourcePathInfo(expression, parentPath, function(subPath){
                modelSet(subPath, new DeletedItem(), parentPath, dirty, true);
                parentPaths[paths.append(subPath, paths.create(pathConstants.upALevel))] = null;
            });

            for(var key in parentPaths){
                if(parentPaths.hasOwnProperty(key)){
                    var parentPath = paths.resolve(parentPath || paths.createRoot(), paths.create(key)),
                        parentObject = get(parentPath, model),
                        isArray = Array.isArray(parentObject);

                    if(isArray){
                        var anyRemoved;
                        for(var i = 0; i < parentObject.length; i++){
                            if(parentObject[i] instanceof DeletedItem){
                                parentObject.splice(i, 1);
                                i--;
                                anyRemoved = true;
                            }
                        }
                        if(anyRemoved){
                            trigger(paths.append(parentPath));
                        }
                    }else{
                        for(var key in parentObject){
                            if(parentObject[key] instanceof DeletedItem){
                                delete parentObject[key];
                                trigger(paths.append(parentPath, paths.create(key)));
                            }
                        }
                    }
                }
            }

            return;
        }

        parentPath = parentPath || paths.create();
        expression = paths.resolve(parentPath, expression);

        setDirtyState(expression, dirty);

        var removedItem = get(expression, model),
            parentObject = remove(expression, model);

        if(Array.isArray(parentObject)){
            //trigger one above
            trigger(paths.resolve('[/]', paths.append(expression, paths.create(pathConstants.upALevel))));
        }else{
            trigger(expression);
        }

        removeModelReference(expression, removedItem);
        triggerModelReferences(expression);
    }

    //***********************************************
    //
    //      Set Dirty State
    //
    //***********************************************

    function setDirtyState(expression, dirty, parentPath) {

        var reference = dirtyModel;

        if(expression && !arguments[3]){
            getSourcePathInfo(expression, parentPath, function(subPath){
                setDirtyState(subPath, dirty, parentPath, true);
            });
            return;
        }

        if(!paths.create(expression)){
            throw exceptions.invalidPath;
        }

        parentPath = parentPath || paths.create();


        dirty = dirty !== false;

        if(paths.isRoot(expression)){
            dirtyModel = {
                '_isDirty_': dirty
            };
            return;
        }

        var index = 0;

        if(paths.isAbsolute(expression)){
            index = 1;
        }

        var pathParts = paths.toParts(paths.resolve(parentPath, expression));

        for(; index < pathParts.length; index++){
            var key = pathParts[index];
            if ((typeof reference[key] !== "object" || reference[key] === null) && index < pathParts.length - 1) {
                reference[key] = {};
            }
            if (index === pathParts.length - 1) {
                reference[key] = {};
                reference[key]['_isDirty_'] = dirty;
            }
            else {
                reference = reference[key];
            }
        }

        if(!pathParts.length){
            dirtyModel['_isDirty_'] = dirty;
        }
    }

    //***********************************************
    //
    //      Is Dirty
    //
    //***********************************************

    function isDirty(path) {
        var reference,
            hasDirtyChildren = function (ref) {
                if (typeof ref !== 'object') {
                    return false;
                }
                if (ref['_isDirty_']) {
                    return true;
                } else {
                    for (var key in ref) {
                        if (hasDirtyChildren(ref[key])) {
                            return true;
                        }
                    }
                }
            };

        reference = get(path, dirtyModel);

        return !!hasDirtyChildren(reference);
    }

    //Public Objects ******************************************************************************


    function Gedi() {}

    Gedi.prototype = {
        paths: {
            create: paths.create,
            resolve: paths.resolve,
            isRoot: paths.isRoot,
            isAbsolute: paths.isAbsolute,
            append: paths.append,
            toParts: paths.toParts
        },

        /**
            ## .get

            model.get(expression, parentPath, scope, returnAsTokens)

            Get data from the model

                // get model.stuff
                var data = model.get('[stuff]');

            Expressions passed to get will be evaluated by gel:

                // get a list of items that have a truthy .selected property.
                var items = model.get('(filter [items] {item item.selected})');

            You can scope paths in the expression to a parent path:

                // get the last account.
                var items = model.get('(last [])', '[accounts]')'

        */
        get: modelGet,

        /**
            ## .set

            model.set(expression, value, parentPath, dirty)

            Set data into the model

                // set model.stuff to true
                model.set('[stuff]', true);

            Expressions passed to set will be evaluated by gel:

                // find all items that are not selected and set them to be selected
                model.set('(map (filter [items] {item (! item.selected)}) {item item.selected})', true);

            You can scope paths in the expression to a parent path:

                // set the last account to a different account.
                model.set('(last [])', '[accounts]', someAccount);

        */
        set: modelSet,

        /**
            ## .remove

            model.remove(expression, value, parentPath, dirty)

            If the target key is on an object, the key will be deleted.
            If the target key is an index in an array, the item will be spliced out.

            remove data from the model

                // remove model.stuff.
                model.remove('[stuff]');

            Expressions passed to remove will be evaluated by gel:

                // remove all selected items.
                model.remove('(filter [items] {item item.selected})');

            You can scope paths in the expression to a parent path:

                // remove the last account.
                model.remove('(last [])', '[accounts]');

        */
        remove: modelRemove,

        utils: {
            get:get,
            set:set
        },

        init: function (model) {
            this.set(model, false);
        },

        /**
            ## .bind

            model.bind(expression, callback, parentPath)

            bind a callback to change events on the model

        */
        bind: setBinding,

        debind: removeBinding,

        trigger: trigger,

        isDirty: isDirty,

        setDirtyState: setDirtyState,

        gel: gel, // expose gel instance for extension

        getNumberOfBindings: function(){
            function getNumCallbacks(reference){
                var length = reference.length;
                for (var key in reference) {
                    if(isNaN(key)){
                        length += getNumCallbacks(reference[key]);
                    }
                }
                return length;
            }

            return getNumCallbacks(internalBindings);
        }
    };

    return new Gedi();
}

module.exports = gediConstructor;
},{"./pathToken":12,"gedi-paths":4,"gel-js":5,"hybrid-map":8,"spec-js":11}],3:[function(require,module,exports){
module.exports = function detectPath(substring){
    if (substring.charAt(0) === '[') {
        var index = 1;

        do {
            if (
                (substring.charAt(index) === '\\' && substring.charAt(index + 1) === '\\') || // escaped escapes
                (substring.charAt(index) === '\\' && (substring.charAt(index + 1) === '[' || substring.charAt(index + 1) === ']')) //escaped braces
            ) {
                index++;
            }
            else if(substring.charAt(index) === ']'){
                return substring.slice(0, index+1);
            }
            index++;
        } while (index < substring.length);
    }
};
},{}],4:[function(require,module,exports){
var detectPath = require('./detectPath');

var pathSeparator = "/",
    upALevel = "..",
    currentKey = "#",
    rootPath = "",
    pathStart = "[",
    pathEnd = "]",
    pathWildcard = "*";

function pathToRaw(path) {
    return path && path.slice(1, -1);
}

//***********************************************
//
//      Raw To Path
//
//***********************************************

function rawToPath(rawPath) {
    return pathStart + (rawPath == null ? '' : rawPath) + pathEnd;
}

var memoisePathCache = {};
function resolvePath() {
    var memoiseKey = '';

    for(var argumentIndex = 0; argumentIndex < arguments.length; argumentIndex++){
        memoiseKey += arguments[argumentIndex];
    }

    if(memoisePathCache[memoiseKey]){
        return memoisePathCache[memoiseKey];
    }

    var absoluteParts = [],
        lastRemoved,
        pathParts,
        pathPart;

    for(var argumentIndex = 0; argumentIndex < arguments.length; argumentIndex++){
        pathParts = pathToParts(arguments[argumentIndex]);

        if(!pathParts || !pathParts.length){
            continue;
        }

        for(var pathPartIndex = 0; pathPartIndex < pathParts.length; pathPartIndex++){
            pathPart = pathParts[pathPartIndex];

            if (pathPart === currentKey) {
                // Has a last removed? Add it back on.
                if(lastRemoved != null){
                    absoluteParts.push(lastRemoved);
                    lastRemoved = null;
                }
            } else if (pathPart === rootPath) {
                // Root path? Reset parts to be absolute.
                absoluteParts = [''];

            } else if (pathPart === upALevel) {
                // Up a level? Remove the last item in absoluteParts
                lastRemoved = absoluteParts.pop();
            } else if (pathPart.slice(0,2) === upALevel) {
                var argument = pathPart.slice(2);
                //named
                while(absoluteParts.slice(-1).pop() !== argument){
                    if(absoluteParts.length === 0){
                        throw "Named path part was not found: '" + pathPart + "', in path: '" + arguments[argumentIndex] + "'.";
                    }
                    lastRemoved = absoluteParts.pop();
                }
            } else if (pathPart.slice(-2) === upALevel) {
                // deep bindings
                absoluteParts.push(pathPart.slice(0, -2));
            } else {
                // any following valid part? Add it to the absoluteParts.
                absoluteParts.push(pathPart);
            }
        }
    }

    // Convert the absoluteParts to a Path and memoise the result.
    return memoisePathCache[memoiseKey] = createPath(absoluteParts);
}

var memoisedPathTokens = {};

function createPath(path){

    if(typeof path === 'number'){
        path = path.toString();
    }

    if(path == null){
        return rawToPath();
    }

    // passed in an Expression or an 'expression formatted' Path (eg: '[bla]')
    if (typeof path === "string"){

        if(memoisedPathTokens[path]){
            return memoisedPathTokens[path];
        }

        if(path.charAt(0) === pathStart) {
            var pathString = path.toString(),
                detectedPath = detectPath(pathString);

            if (detectedPath && detectedPath.length === pathString.length) {
                return memoisedPathTokens[pathString] = detectedPath;
            } else {
                return false;
            }
        }else{
            return createPath(rawToPath(path));
        }
    }

    if(path instanceof Array) {

        var parts = [];
        for (var i = 0; i < path.length; i++) {
            var pathPart = path[i];
            if(pathPart.indexOf('\\') >= 0){
                pathPart = pathPart.replace(/([\[|\]|\\|\/])/g, '\\$1');
            }
            parts.push(pathPart);
        }
        return rawToPath(parts.join(pathSeparator));
    }
}

function createRootPath(){
    return createPath([rootPath, rootPath]);
}

function pathToParts(path){
    if(!path){
        return;
    }
    if(Array.isArray(path)){
        return path;
    }

    // if we haven't been passed a path, then turn the input into a path
    if (!isPath(path)) {
        path = createPath(path);
    }

    path = path.slice(1,-1);

    var lastPartIndex = 0,
        parts,
        nextChar,
        currentChar;

    if(path.indexOf('\\') < 0){
        if(path === ""){
            return [];
        }
        return path.split(pathSeparator);
    }

    parts = [];

    for(var i = 0; i < path.length; i++){
        currentChar = path.charAt(i);
        if(currentChar === pathSeparator){
            parts.push(path.slice(lastPartIndex,i));
            lastPartIndex = i+1;
        }else if(currentChar === '\\'){
            nextChar = path.charAt(i+1);
            if(nextChar === '\\'){
                path = path.slice(0, i) + path.slice(i + 1);
            }else if(nextChar === ']' || nextChar === '['){
                path = path.slice(0, i) + path.slice(i + 1);
            }else if(nextChar === pathSeparator){
                parts.push(path.slice(lastPartIndex), i);
            }
        }
    }
    parts.push(path.slice(lastPartIndex));

    return parts;
}

function appendPath(){
    var parts = pathToParts(arguments[0]);

    if(!parts){
        return;
    }

    for (var argumentIndex = 1; argumentIndex < arguments.length; argumentIndex++) {
        var pathParts = pathToParts(arguments[argumentIndex]);
        for (var partIndex = 0; pathParts && partIndex < pathParts.length; partIndex++) {
                parts.push(pathParts[partIndex]);
        }
    }

    return createPath(parts);
}

function isPath(path) {
    return (typeof path == 'string' || (path instanceof String)) &&
        path.charAt(0) == pathStart &&
        path.charAt(path.length - 1) == pathEnd;
}

function isPathAbsolute(path){
    return pathToParts(path)[0] === rootPath;
}

function isPathRoot(path){
    var parts = pathToParts(path);
    return (isPathAbsolute(parts) && parts[0] === parts[1]) || parts.length === 0;
}

function isbubbleCapturePath(path){
    var parts = pathToParts(path),
        lastPart = parts[parts.length-1];
    return lastPart && lastPart.slice(-2) === upALevel;
}

module.exports = {
    resolve: resolvePath,
    create: createPath,
    is: isPath,
    isAbsolute: isPathAbsolute,
    isRoot: isPathRoot,
    isBubbleCapture: isbubbleCapturePath,
    append: appendPath,
    toParts: pathToParts,
    createRoot: createRootPath,
    constants:{
        separator: pathSeparator,
        upALevel: upALevel,
        currentKey: currentKey,
        root: rootPath,
        start: pathStart,
        end: pathEnd,
        wildcard: pathWildcard
    }
};
},{"./detectPath":3}],5:[function(require,module,exports){
var Lang = require('lang-js'),
    paths = require('gedi-paths'),
    createNestingParser = Lang.createNestingParser,
    detectString = Lang.detectString,
    Token = Lang.Token,
    Scope = Lang.Scope,
    createSpec = require('spec-js');

function fastEach(items, callback) {
    for (var i = 0; i < items.length; i++) {
        if (callback(items[i], i, items)) break;
    }
    return items;
}

function quickIndexOf(array, value){
    var length = array.length
    for(var i = 0; i < length && array[i] !== value;i++) {}
    return i < length ? i : -1;
}

function stringFormat(string, values){
    return string.replace(/{(\d+)}/g, function(match, number) {
        return values[number] != null
          ? values[number]
          : ''
        ;
    });
}

function isIdentifier(substring){
    var valid = /^[$A-Z_][0-9A-Z_$]*/i,
        possibleIdentifier = substring.match(valid);

    if (possibleIdentifier && possibleIdentifier.index === 0) {
        return possibleIdentifier[0];
    }
}

function tokeniseIdentifier(substring){
    // searches for valid identifiers or operators
    //operators
    var operators = "!=<>/&|*%-^?+\\",
        index = 0;

    while (operators.indexOf(substring.charAt(index)||null) >= 0 && ++index) {}

    if (index > 0) {
        return substring.slice(0, index);
    }

    var identifier = isIdentifier(substring);

    if(identifier != null){
        return identifier;
    }
}

function createKeywordTokeniser(Constructor, keyword){
    return function(substring){
        substring = isIdentifier(substring);
        if (substring === keyword) {
            return new Constructor(substring, substring.length);
        }
    };
}

function StringToken(){}
StringToken = createSpec(StringToken, Token);
StringToken.prototype.precedence = 2;
StringToken.prototype.stringTerminal = '"';
StringToken.prototype.name = 'StringToken';
StringToken.tokenise = function (substring) {
    if (substring.charAt(0) === this.prototype.stringTerminal) {
        var index = 0,
        escapes = 0;

        while (substring.charAt(++index) !== this.prototype.stringTerminal)
        {
           if(index >= substring.length){
                   throw "Unclosed " + this.name;
           }
           if (substring.charAt(index) === '\\' && substring.charAt(index+1) === this.prototype.stringTerminal) {
                   substring = substring.slice(0, index) + substring.slice(index + 1);
                   escapes++;
           }
        }

        return new this(
            substring.slice(0, index+1),
            index + escapes + 1
        );
    }
}
StringToken.prototype.evaluate = function () {
    this.result = this.original.slice(1,-1);
}

function String2Token(){}
String2Token = createSpec(String2Token, StringToken);
String2Token.prototype.stringTerminal = "'";
String2Token.prototype.name = 'String2Token';
String2Token.tokenise = StringToken.tokenise;

function ParenthesesToken(){
}
ParenthesesToken = createSpec(ParenthesesToken, Token);
ParenthesesToken.prototype.name = 'ParenthesesToken';
ParenthesesToken.tokenise = function(substring) {
    if(substring.charAt(0) === '(' || substring.charAt(0) === ')'){
        return new ParenthesesToken(substring.charAt(0), 1);
    }
}
ParenthesesToken.prototype.parse = createNestingParser(/^\($/,/^\)$/);
ParenthesesToken.prototype.evaluate = function(scope){
    scope = new Scope(scope);

    var functionToken = this.childTokens[0];

    if(!functionToken){
        throw "Invalid function call. No function was provided to execute.";
    }

    functionToken.evaluate(scope);

    if(typeof functionToken.result !== 'function'){
        throw functionToken.original + " (" + functionToken.result + ")" + " is not a function";
    }

    this.result = scope.callWith(functionToken.result, this.childTokens.slice(1), this);
};

function NumberToken(){}
NumberToken = createSpec(NumberToken, Token);
NumberToken.prototype.name = 'NumberToken';
NumberToken.tokenise = function(substring) {
    var specials = {
        "NaN": Number.NaN,
        "-NaN": -Number.NaN,
        "Infinity": Infinity,
        "-Infinity": -Infinity
    };
    for (var key in specials) {
        if (substring.slice(0, key.length) === key) {
            return new NumberToken(key, key.length);
        }
    }

    var valids = "0123456789-.Eex",
        index = 0;

    while (valids.indexOf(substring.charAt(index)||null) >= 0 && ++index) {}

    if (index > 0) {
        var result = substring.slice(0, index);
        if(isNaN(parseFloat(result))){
            return;
        }
        return new NumberToken(result, index);
    }

    return;
};
NumberToken.prototype.evaluate = function(scope){
    this.result = parseFloat(this.original);
};

function ValueToken(value, path, key){
    this.result = value;
    this.sourcePathInfo = new SourcePathInfo();
    this.sourcePathInfo.path = path;
    this.sourcePathInfo.drillTo(key);
}
ValueToken = createSpec(ValueToken, Token);
ValueToken.prototype.name = 'ValueToken';
ValueToken.prototype.evaluate = function(){};
ValueToken.prototype.precedence = 2;

function NullToken(){}
NullToken = createSpec(NullToken, Token);
NullToken.prototype.name = 'NullToken';
NullToken.prototype.precedence = 2;
NullToken.tokenise = createKeywordTokeniser(NullToken, "null");
NullToken.prototype.evaluate = function(scope){
    this.result = null;
};

function UndefinedToken(){}
UndefinedToken = createSpec(UndefinedToken, Token);
UndefinedToken.prototype.name = 'UndefinedToken';
UndefinedToken.prototype.precedence = 2;
UndefinedToken.tokenise = createKeywordTokeniser(UndefinedToken, 'undefined');
UndefinedToken.prototype.evaluate = function(scope){
    this.result = undefined;
};

function TrueToken(){}
TrueToken = createSpec(TrueToken, Token);
TrueToken.prototype.name = 'TrueToken';
TrueToken.prototype.precedence = 2;
TrueToken.tokenise = createKeywordTokeniser(TrueToken, 'true');
TrueToken.prototype.evaluate = function(scope){
    this.result = true;
};

function FalseToken(){}
FalseToken = createSpec(FalseToken, Token);
FalseToken.prototype.name = 'FalseToken';
FalseToken.prototype.precedence = 2;
FalseToken.tokenise = createKeywordTokeniser(FalseToken, 'false');
FalseToken.prototype.evaluate = function(scope){
    this.result = false;
};

function DelimiterToken(){}
DelimiterToken = createSpec(DelimiterToken, Token);
DelimiterToken.prototype.name = 'DelimiterToken';
DelimiterToken.prototype.precedence = 2;
DelimiterToken.tokenise = function(substring) {
    var i = 0;
    while(i < substring.length && substring.charAt(i).trim() === "" || substring.charAt(i) === ',') {
        i++;
    }

    if(i){
        return new DelimiterToken(substring.slice(0, i), i);
    }
};
DelimiterToken.prototype.parse = function(tokens, position){
    tokens.splice(position, 1);
};

function IdentifierToken(){}
IdentifierToken = createSpec(IdentifierToken, Token);
IdentifierToken.prototype.name = 'IdentifierToken';
IdentifierToken.prototype.precedence = 3;
IdentifierToken.tokenise = function(substring){
    var result = tokeniseIdentifier(substring);

    if(result != null){
        return new IdentifierToken(result, result.length);
    }
};
IdentifierToken.prototype.evaluate = function(scope){
    var value = scope.get(this.original);
    if(value instanceof Token){
        this.result = value.result;
        this.sourcePathInfo = value.sourcePathInfo;
    }else{
        this.result = value;
    }
};

function PeriodToken(){}
PeriodToken = createSpec(PeriodToken, Token);
PeriodToken.prototype.name = 'PeriodToken';
PeriodToken.prototype.precedence = 1;
PeriodToken.tokenise = function(substring){
    var periodConst = ".";
    return (substring.charAt(0) === periodConst) ? new PeriodToken(periodConst, 1) : undefined;
};
PeriodToken.prototype.parse = function(tokens, position){
    this.targetToken = tokens.splice(position-1,1)[0];
    this.identifierToken = tokens.splice(position,1)[0];
};
PeriodToken.prototype.evaluate = function(scope){
    this.targetToken.evaluate(scope);
    if(
        this.targetToken.result &&
        (typeof this.targetToken.result === 'object' || typeof this.targetToken.result === 'function')
        && this.targetToken.result.hasOwnProperty(this.identifierToken.original)
    ){
        this.result = this.targetToken.result[this.identifierToken.original];
    }else{
        this.result = undefined;
    }

    var targetPath;

    if(this.targetToken.sourcePathInfo){
        targetPath = this.targetToken.sourcePathInfo.path
    }

    if(targetPath){
        this.sourcePathInfo = {
            path: paths.append(targetPath, paths.create(this.identifierToken.original))
        };
    }
};

function FunctionToken(){}
FunctionToken = createSpec(FunctionToken, Token);
FunctionToken.prototype.name = 'FunctionToken';
FunctionToken.tokenise = function convertFunctionToken(substring) {
    if(substring.charAt(0) === '{' || substring.charAt(0) === '}'){
        return new FunctionToken(substring.charAt(0), 1);
    }
};
FunctionToken.prototype.parse = createNestingParser(/^\{$/,/^\}$/);
FunctionToken.prototype.evaluate = function(scope){
    var parameterNames = this.childTokens.slice(),
        fnBody = parameterNames.pop();

    this.result = function(scope, args){
        scope = new Scope(scope);

        for(var i = 0; i < parameterNames.length; i++){
            var parameterToken = args.getRaw(i, true);
            scope.set(parameterNames[i].original, parameterToken);
        }

        fnBody.evaluate(scope);

        if(args.callee){
            args.callee.sourcePathInfo = fnBody.sourcePathInfo;
        }

        return fnBody.result;
    };
};

function SourcePathInfo(token, source, trackSubPaths){
    var innerPathInfo;

    if(trackSubPaths && source){
        this.subPaths = typeof source === 'object' && new source.constructor();
    }

    if(token){
        innerPathInfo = token.sourcePathInfo;

        if(token instanceof Token && token.path){
            originPath = token.original;
            this.original = source;
        }
    }

    this.innerPathInfo = innerPathInfo;


    this.original = innerPathInfo && innerPathInfo.original || source;
    this.path = innerPathInfo && innerPathInfo.path;
}
SourcePathInfo.prototype.setSubPath = function(to, key){
    if(!this.subPaths){
        return;
    }
    this.subPaths[to] = this.innerPathInfo && this.innerPathInfo.subPaths && this.innerPathInfo.subPaths[key] || paths.append(this.path, paths.create(key));
};
SourcePathInfo.prototype.pushSubPath = function(key){
    if(!this.subPaths){
        return;
    }
    this.setSubPath(this.subPaths.length, key);
};
SourcePathInfo.prototype.setSubPaths = function(paths){
    if(!this.subPaths){
        return;
    }
    this.subPaths = paths;
};
SourcePathInfo.prototype.drillTo = function(key){
    if(this.subPaths){
        this.path = this.subPaths[key];
    }
    if(this.path){
        this.path = paths.append(this.path, paths.create(key));
    }
};

function addFilterResult(filteredItems, item, key, sourcePathInfo, isArray){
    if(isArray){
        filteredItems.push(item);
    }else{
        filteredItems[key] = item;
    }
    sourcePathInfo.pushSubPath(key);
}

function gelFilter(scope, args) {
    var source = args.get(0),
        sourcePathInfo = new SourcePathInfo(args.getRaw(0), source, true),
        filteredItems = source && typeof source === 'object' && new source.constructor();

    var functionToCompare = args.get(1);

    if(!filteredItems){
        return undefined;
    }

    var isArray = Array.isArray(source),
        item;

    for(var key in source){
        if(isArray && isNaN(key)){
            continue;
        }
        item = source[key];
        if(typeof functionToCompare === "function"){
            if(scope.callWith(functionToCompare, [item])){
                addFilterResult(filteredItems, item, key, sourcePathInfo, isArray);
            }
        }else{
            if(item === functionToCompare){
                addFilterResult(filteredItems, item, key, sourcePathInfo, isArray);
            }
        }
    }

    args.callee.sourcePathInfo = sourcePathInfo;

    return filteredItems;
}

var tokenConverters = [
        StringToken,
        String2Token,
        ParenthesesToken,
        NumberToken,
        NullToken,
        UndefinedToken,
        TrueToken,
        FalseToken,
        DelimiterToken,
        IdentifierToken,
        PeriodToken,
        FunctionToken
    ],
    scope = {
        "toString":function(scope, args){
            return "" + args.next();
        },
        "+":function(scope, args){
            return args.next() + args.next();
        },
        "-":function(scope, args){
            return args.next() - args.next();
        },
        "/":function(scope, args){
            return args.next() / args.next();
        },
        "*":function(scope, args){
            return args.next() * args.next();
        },
        "isNaN":function(scope, args){
            return isNaN(args.get(0));
        },
        "max":function(scope, args){
            var result = args.next();
            while(args.hasNext()){
                result = Math.max(result, args.next());
            }
            return result;
        },
        "min":function(scope, args){
            var result = args.next();
            while(args.hasNext()){
                result = Math.min(result, args.next());
            }
            return result;
        },
        ">":function(scope, args){
            return args.next() > args.next();
        },
        "<":function(scope, args){
            return args.next() < args.next();
        },
        ">=":function(scope, args){
            return args.next() >= args.next();
        },
        "<=":function(scope, args){
            return args.next() <= args.next();
        },
        "?":function(scope, args){
            var result,
                resultToken;
            if(args.next()){
                result = args.get(1);
                resultToken = args.getRaw(1);
            }else{
                result = args.get(2);
                resultToken = args.getRaw(2);
            }

            args.callee.sourcePathInfo = resultToken && resultToken.sourcePathInfo;

            return result;
        },
        "!":function(scope, args){
            return !args.next();
        },
        "=":function(scope, args){
            return args.next() == args.next();
        },
        "==":function(scope, args){
            return args.next() === args.next();
        },
        "!=":function(scope, args){
            return args.next() != args.next();
        },
        "!==":function(scope, args){
            return args.next() !== args.next();
        },
        "||":function(scope, args){
            var nextArg,
                rawResult,
                argIndex = -1;

            while(args.hasNext()){
                argIndex++;
                nextArg = args.next();
                if(nextArg){
                    break;
                }
            }

            rawResult = args.getRaw(argIndex);
            args.callee.sourcePathInfo = rawResult && rawResult.sourcePathInfo;
            return nextArg;
        },
        "|":function(scope, args){
            var nextArg,
                rawResult,
                argIndex = -1;

            while(args.hasNext()){
                argIndex++;
                nextArg = args.next();
                if(nextArg === true){
                    break;
                }
            }

            rawResult = args.getRaw(argIndex);
            args.callee.sourcePathInfo = rawResult && rawResult.sourcePathInfo;
            return nextArg;
        },
        "&&":function(scope, args){
            var nextArg;
            while(args.hasNext()){
                nextArg = args.next();
                if(!nextArg){
                    break;
                }
            }
            var rawResult = args.getRaw(args.length-1);
            args.callee.sourcePathInfo = rawResult && rawResult.sourcePathInfo;
            return nextArg;
        },
        "object":function(scope, args){
            var result = {};
            while(args.hasNext()){
                result[args.next()] = args.next();
            }
            return result;
        },
        "keys":function(scope, args){
            var object = args.next();
            return typeof object === 'object' ? Object.keys(object) : undefined;
        },
        "values":function(scope, args){
            var target = args.next(),
                result = [];
            for(var key in target){
                result.push(target[key]);
            }
            return result;
        },
        "invert":function(scope, args){
            var target = args.next(),
                result = {};
            for(var key in target){
                result[target[key]] = key;
            }
            return result;
        },
        "extend":function(scope, args){
            var result = {};
            while(args.hasNext()){
                var nextObject = args.next();
                for(var key in nextObject){
                    result[key] = nextObject[key];
                }
            }
            return result;
        },
        "array":function(scope, args){
            var result = [];
            while(args.hasNext()){
                result.push(args.next());
            }
            return result;
        },
        "map":function(scope, args){
            var source = args.next(),
                sourcePathInfo = new SourcePathInfo(args.getRaw(0), source, true),
                isArray = Array.isArray(source),
                result = isArray ? [] : {},
                functionToken = args.next();

            if(isArray){
                fastEach(source, function(item, index){
                    var callee = {};
                    result[index] = scope.callWith(functionToken, [new ValueToken(item, sourcePathInfo.path, index)], callee);
                    if(callee.sourcePathInfo){
                        sourcePathInfo.subPaths[index] = callee.sourcePathInfo.path;
                    }
                });
            }else{
                for(var key in source){
                    var callee = {};
                    result[key] = scope.callWith(functionToken, [new ValueToken(source[key], sourcePathInfo.path, key)], callee);
                    if(callee.sourcePathInfo){
                        sourcePathInfo.subPaths[key] = callee.sourcePathInfo.path;
                    }
                };
            }

            args.callee.sourcePathInfo = sourcePathInfo;

            return result;
        },
        "pairs": function(scope, args){
            var target = args.next(),
                result = [];

            for(var key in target){
                if(target.hasOwnProperty(key)){
                    result.push([key, target[key]]);
                }
            }

            return result;
        },
        "flatten":function(scope, args){
            var target = args.next(),
                shallow = args.hasNext() && args.next();

            function flatten(target){
                var result = [],
                    source;

                for(var i = 0; i < target.length; i++){
                    source = target[i];

                    for(var j = 0; j < source.length; j++){
                        if(!shallow && Array.isArray(source[j])){
                            result.push(flatten(source));
                        }else{
                            result.push(target[i][j]);
                        }
                    }
                }
                return result;
            }
            return flatten(target);
        },
        "sort": function(scope, args) {
            var source = args.next(),
                sourcePathInfo = new SourcePathInfo(args.getRaw(0), source, true),
                sortFunction = args.next(),
                result,
                sourceArrayKeys,
                caller = this;

            if(!Array.isArray(source)){
                return;
            }

            // no subpaths, just do a normal sort.
            if(!sourcePathInfo.path){
                return source.slice().sort(function(value1, value2){
                    return scope.callWith(sortFunction, [value1,value2], caller);
                });
            }

            for(var i = 0; i < source.length; i++){
                sourcePathInfo.setSubPath(i, i);
            }

            result = [];
            sortedPaths = sourcePathInfo.subPaths.slice();
            sortedPaths.sort(function(path1, path2){
                var value1 = source[quickIndexOf(sourcePathInfo.subPaths, path1)],
                    value2 = source[quickIndexOf(sourcePathInfo.subPaths, path2)];

                return scope.callWith(sortFunction, [value1,value2], caller);
            });

            for(var i = 0; i < sortedPaths.length; i++) {
                result[paths.toParts(sortedPaths[i]).pop()] = source[i];
            }

            sourcePathInfo.setSubPaths(sortedPaths);

            args.callee.sourcePathInfo = sourcePathInfo;

            return result;
        },
        "filter": gelFilter,
        "findOne": function(scope, args) {
            var source = args.next(),
                functionToCompare = args.next(),
                sourcePathInfo = new SourcePathInfo(args.getRaw(0), source),
                result,
                caller = this;

            if (Array.isArray(source)) {

                fastEach(source, function(item, index){
                    if(scope.callWith(functionToCompare, [item], caller)){
                        result = item;
                        sourcePathInfo.drillTo(index);
                        args.callee.sourcePathInfo = sourcePathInfo;
                        return true;
                    }
                });
                return result;
            }
        },
        "concat":function(scope, args){
            var result = args.next(),
                argCount = 0,
                sourcePathInfo = new SourcePathInfo(),
                sourcePaths = Array.isArray(result) && [];

            var addPaths = function(){
                if(sourcePaths){
                    var argToken = args.getRaw(argCount++),
                        argSourcePathInfo = argToken && argToken.sourcePathInfo;

                    if(argSourcePathInfo){
                        if(Array.isArray(argSourcePathInfo.subPaths)){
                        sourcePaths = sourcePaths.concat(argSourcePathInfo.subPaths);
                        }else{
                            for(var i = 0; i < argToken.result.length; i++){
                                sourcePaths.push(paths.append(argSourcePathInfo.path, paths.create(i)));
                            }
                        }
                    }
                }
            }

            addPaths();

            while(args.hasNext()){
                if(result == null || !result.concat){
                    return undefined;
                }
                var next = args.next();
                Array.isArray(next) && (result = result.concat(next));
                addPaths();
            }
            sourcePathInfo.subPaths = sourcePaths;
            args.callee.sourcePathInfo = sourcePathInfo;
            return result;
        },
        "join":function(scope, args){
            args = args.all();

            return args.slice(1).join(args[0]);
        },
        "slice":function(scope, args){
            var sourceTokenIndex = 0,
                source = args.next(),
                start,
                end,
                sourcePathInfo;

            if(args.hasNext()){
                start = source;
                source = args.next();
                sourceTokenIndex++;
            }
            if(args.hasNext()){
                end = source;
                source = args.next();
                sourceTokenIndex++;
            }

            if(!source || !source.slice){
                return;
            }

            // clone source
            source = source.slice();

            sourcePathInfo = new SourcePathInfo(args.getRaw(sourceTokenIndex), source, true);

            var result = source.slice(start, end);

            sourcePathInfo.setSubPaths(sourcePathInfo.innerPathInfo && sourcePathInfo.innerPathInfo.subPaths && sourcePathInfo.innerPathInfo.subPaths.slice(start, end));

            args.callee.sourcePathInfo = sourcePathInfo;

            return result;
        },
        "split":function(scope, args){
            var target = args.next();
            return target ? target.split(args.hasNext() && args.next()) : undefined;
        },
        "last":function(scope, args){
            var source = args.next(),
                sourcePathInfo = new SourcePathInfo(args.getRaw(0), source);

            sourcePathInfo.drillTo(source.length - 1);

            args.callee.sourcePathInfo = sourcePathInfo;

            if(!Array.isArray(source)){
                return;
            }
            return source[source.length - 1];
        },
        "first":function(scope, args){
            var source = args.next(),
                sourcePathInfo = new SourcePathInfo(args.getRaw(0), source);

            sourcePathInfo.drillTo(0);

            args.callee.sourcePathInfo = sourcePathInfo;

            if(!Array.isArray(source)){
                return;
            }
            return source[0];
        },
        "length":function(scope, args){
            return args.next().length;
        },
        "getValue":function(scope, args){
            var source = args.next(),
                key = args.next(),
                sourcePathInfo = new SourcePathInfo(args.getRaw(0), source);

            sourcePathInfo.drillTo(key);

            args.callee.sourcePathInfo = sourcePathInfo;

            if(!source || typeof source !== 'object'){
                return;
            }

            return source[key];
        },
        "compare":function(scope, args){
            var args = args.all(),
                comparitor = args.pop(),
                reference = args.pop(),
                result = true,
                objectToCompare;

            while(args.length){
                objectToCompare = args.pop();
                for(var key in objectToCompare){
                    if(!scope.callWith(comparitor, [objectToCompare[key], reference[key]], this)){
                        result = false;
                    }
                }
            }

            return result;
        },
        "contains": function(scope, args){
            var args = args.all(),
                target = args.shift(),
                success = false,
                strict = false,
                arg;

            if(target == null){
                return;
            }

            if(typeof target === 'boolean'){
                strict = target;
                target = args.shift();
            }

            arg = args.pop();

            if(target == null || !target.indexOf){
                return;
            }

            if(typeof arg === "string" && !strict){
                arg = arg.toLowerCase();

                if(Array.isArray(target)){
                    fastEach(target, function(targetItem){
                        if(typeof targetItem === 'string' && targetItem.toLowerCase() === arg.toLowerCase()){
                            return success = true;
                        }
                    });
                }else{
                    if(typeof target === 'string' && target.toLowerCase().indexOf(arg)>=0){
                        return success = true;
                    }
                }
                return success;
            }else{
                return target.indexOf(arg)>=0;
            }
        },
        "charAt":function(scope, args){
            var target = args.next(),
                position;

            if(args.hasNext()){
                position = args.next();
            }

            if(typeof target !== 'string'){
                return;
            }

            return target.charAt(position);
        },
        "toLowerCase":function(scope, args){
            var target = args.next();

            if(typeof target !== 'string'){
                return undefined;
            }

            return target.toLowerCase();
        },
        "toUpperCase":function(scope, args){
            var target = args.next();

            if(typeof target !== 'string'){
                return undefined;
            }

            return target.toUpperCase();
        },
        "format": function format(scope, args) {
            var args = args.all();

            if(!args[0]){
                return;
            }

            return stringFormat(args.shift(), args);
        },
        "refine": function(scope, args){
            var args = args.all(),
                exclude = typeof args[0] === "boolean" && args.shift(),
                original = args.shift(),
                refined = {};

            for(var i = 0; i < args.length; i++){
                args[i] = args[i].toString();
            }

            for(var key in original){
                if(args.indexOf(key)>=0){
                    !exclude && (refined[key] = original[key]);
                }else if(exclude){
                    refined[key] = original[key];
                }
            }

            return refined;
        },
        "date": (function(){
            var date = function(scope, args) {
                return args.length ? new Date(args.length > 1 ? args.all() : args.next()) : new Date();
            };

            date.addDays = function(scope, args){
                var baseDate = args.next();

                return new Date(baseDate.setDate(baseDate.getDate() + args.next()));
            }

            return date;
        })(),
        "toJSON":function(scope, args){
            return JSON.stringify(args.next());
        },
        "fromJSON":function(scope, args){
            return JSON.parse(args.next());
        },
        "fold": function(scope, args){
            var args = args.all(),
                fn = args.pop(),
                seed = args.pop(),
                array = args[0],
                result = seed;

            if(args.length > 1){
                array = args;
            }

            if(!array || !array.length){
                return result;
            }

            for(var i = 0; i < array.length; i++){
                result = scope.callWith(fn, [result, array[i]], this);
            }

            return result;
        },
        "partial": function(scope, args){
            var outerArgs = args.all(),
                fn = outerArgs.shift(),
                caller = this;

            return function(scope, args){
                var innerArgs = args.all();
                return scope.callWith(fn, outerArgs.concat(innerArgs), caller);
            };
        },
        "flip": function(scope, args){
            var outerArgs = args.all().reverse(),
                fn = outerArgs.pop(),
                caller = this;

            return function(scope, args){
                return scope.callWith(fn, outerArgs, caller)
            };
        },
        "compose": function(scope, args){
            var outerArgs = args.all().reverse(),
                caller = this;

            return function(scope, args){
                var result = scope.callWith(outerArgs[0], args.all(),caller);

                for(var i = 1; i < outerArgs.length; i++){
                    result = scope.callWith(outerArgs[i], [result],caller);
                }

                return result;
            };
        },
        "apply": function(scope, args){
            var fn = args.next()
                outerArgs = args.next();

            return scope.callWith(fn, outerArgs, this);
        },
        "zip": function(scope, args){
            var allArgs = args.all(),
                result = [],
                maxLength = 0;

            for(var i = 0; i < allArgs.length; i++){
                if(!Array.isArray(allArgs[i])){
                    allArgs.splice(i,1);
                    i--;
                    continue;
                }
                maxLength = Math.max(maxLength, allArgs[i].length);
            }

            for (var itemIndex = 0; itemIndex < maxLength; itemIndex++) {
                for(var i = 0; i < allArgs.length; i++){
                    if(allArgs[i].length >= itemIndex){
                        result.push(allArgs[i][itemIndex]);
                    }
                }
            }

            return result;
        }
    };


Gel = function(){
    var gel = {},
        lang = new Lang();

    gel.lang = lang;
    gel.tokenise = function(expression){
        return gel.lang.tokenise(expression, this.tokenConverters);
    }
    gel.evaluate = function(expression, injectedScope, returnAsTokens){
        var scope = new Scope();

        scope.add(this.scope).add(injectedScope);

        return lang.evaluate(expression, scope, this.tokenConverters, returnAsTokens);
    };
    gel.tokenConverters = tokenConverters.slice();
    gel.scope = Object.create(scope);

    return gel;
};

Gel.Token = Token;
Gel.Scope = Scope;
module.exports = Gel;
},{"gedi-paths":7,"lang-js":9,"spec-js":11}],6:[function(require,module,exports){
module.exports=require(3)
},{}],7:[function(require,module,exports){
var detectPath = require('./detectPath');

var pathSeparator = "/",
    upALevel = "..",
    currentKey = "#",
    rootPath = "",
    pathStart = "[",
    pathEnd = "]",
    pathWildcard = "*";

function pathToRaw(path) {
    return path && path.slice(1, -1);
}

//***********************************************
//
//      Raw To Path
//
//***********************************************

function rawToPath(rawPath) {
    return pathStart + (rawPath == null ? '' : rawPath) + pathEnd;
}

var memoisePathCache = {};
function resolvePath() {
    var memoiseKey = '';

    for(var argumentIndex = 0; argumentIndex < arguments.length; argumentIndex++){
        memoiseKey += arguments[argumentIndex];
    }

    if(memoisePathCache[memoiseKey]){
        return memoisePathCache[memoiseKey];
    }

    var absoluteParts = [],
        lastRemoved,
        pathParts,
        pathPart;

    for(var argumentIndex = 0; argumentIndex < arguments.length; argumentIndex++){
        pathParts = pathToParts(arguments[argumentIndex]);

        if(!pathParts || !pathParts.length){
            continue;
        }

        for(var pathPartIndex = 0; pathPartIndex < pathParts.length; pathPartIndex++){
            pathPart = pathParts[pathPartIndex];

            if(pathParts.length === 0){
                // Empty path, maintain parent path.
            } else if (pathPart === currentKey) {
                // Has a last removed? Add it back on.
                if(lastRemoved != null){
                    absoluteParts.push(lastRemoved);
                    lastRemoved = null;
                }
            } else if (pathPart === rootPath) {
                // Root path? Reset parts to be absolute.
                absoluteParts = [''];

            } else if (pathPart === upALevel) {
                // Up a level? Remove the last item in absoluteParts
                lastRemoved = absoluteParts.pop();
            } else if (pathPart.slice(0,2) === upALevel) {
                var argument = pathPart.slice(2);
                //named
                while(absoluteParts.slice(-1).pop() !== argument){
                    if(absoluteParts.length === 0){
                        throw "Named path part was not found: '" + pathPart + "', in path: '" + arguments[argumentIndex] + "'.";
                    }
                    lastRemoved = absoluteParts.pop();
                }
            } else {
                // any following valid part? Add it to the absoluteParts.
                absoluteParts.push(pathPart);
            }
        }
    }

    // Convert the absoluteParts to a Path and memoise the result.
    return memoisePathCache[memoiseKey] = createPath(absoluteParts);
}

var memoisedPathTokens = {};

function createPath(path){

    if(typeof path === 'number'){
        path = path.toString();
    }

    if(path == null){
        return rawToPath();
    }

    // passed in an Expression or an 'expression formatted' Path (eg: '[bla]')
    if (typeof path === "string"){

        if(memoisedPathTokens[path]){
            return memoisedPathTokens[path];
        }

        if(path.charAt(0) === pathStart) {
            var pathString = path.toString(),
                detectedPath = detectPath(pathString);

            if (detectedPath && detectedPath.length === pathString.length) {
                return memoisedPathTokens[pathString] = detectedPath;
            } else {
                return false;
            }
        }else{
            return createPath(rawToPath(path));
        }
    }

    if(path instanceof Array) {

        var parts = [];
        for (var i = 0; i < path.length; i++) {
            var pathPart = path[i];
            if(pathPart.indexOf('\\') >= 0){
                pathPart = pathPart.replace(/([\[|\]|\\|\/])/g, '\\$1');
            }
            parts.push(pathPart);
        }
        return rawToPath(parts.join(pathSeparator));
    }
}

function createRootPath(){
    return createPath([rootPath, rootPath]);
}

function pathToParts(path){
    if(!path){
        return;
    }
    if(Array.isArray(path)){
        return path;
    }

    // if we haven't been passed a path, then turn the input into a path
    if (! isPath(path)) {
        path = createPath(path);
    }

    path = path.slice(1,-1);

    var lastPartIndex = 0,
        parts,
        nextChar,
        currentChar;

    if(path.indexOf('\\') < 0){
        if(path === ""){
            return [];
        }
        return path.split(pathSeparator);
    }

    parts = [];

    for(var i = 0; i < path.length; i++){
        currentChar = path.charAt(i);
        if(currentChar === pathSeparator){
            parts.push(path.slice(lastPartIndex,i));
            lastPartIndex = i+1;
        }else if(currentChar === '\\'){
            nextChar = path.charAt(i+1);
            if(nextChar === '\\'){
                path = path.slice(0, i) + path.slice(i + 1);
            }else if(nextChar === ']' || nextChar === '['){
                path = path.slice(0, i) + path.slice(i + 1);
            }else if(nextChar === pathSeparator){
                parts.push(path.slice(lastPartIndex), i);
            }
        }
    }
    parts.push(path.slice(lastPartIndex));

    return parts;
}

function appendPath(){
    var parts = pathToParts(arguments[0]);

    if(!parts){
        return;
    }

    for (var argumentIndex = 1; argumentIndex < arguments.length; argumentIndex++) {
        var pathParts = pathToParts(arguments[argumentIndex]);
        for (var partIndex = 0; pathParts && partIndex < pathParts.length; partIndex++) {
                parts.push(pathParts[partIndex]);
        }
    }

    return createPath(parts);
}

function isPath(path) {
    return (typeof path == 'string' || (path instanceof String)) &&
        path.charAt(0) == pathStart &&
        path.charAt(path.length - 1) == pathEnd;
}

function isPathAbsolute(path){
    return pathToParts(path)[0] === rootPath;
}

function isPathRoot(path){
    var parts = pathToParts(path);
    return (isPathAbsolute(parts) && parts[0] === parts[1]) || parts.length === 0;
}

module.exports = {
    resolve: resolvePath,
    create: createPath,
    is: isPath,
    isAbsolute: isPathAbsolute,
    isRoot: isPathRoot,
    append: appendPath,
    toParts: pathToParts,
    createRoot: createRootPath,
    constants:{
        separator: pathSeparator,
        upALevel: upALevel,
        currentKey: currentKey,
        root: rootPath,
        start: pathStart,
        end: pathEnd,
        wildcard: pathWildcard
    }
};
},{"./detectPath":6}],8:[function(require,module,exports){
/*! (C) WebReflection *//** @license Mit Style License */
// https://github.com/WebReflection/HybridMap
this.HybridMap || (this.HybridMap = function(defineProperty) {

  // the half map, half weak, fully cross platform solution

  try {
    // fix IE8 inconsistency
    if (!defineProperty({},"_",{value:1})._)
      // drop the function, is pointless
      throw (defineProperty = 0)
    ;
  } catch(o_O) {}

  var
    // quirks are ignored, Singletons are used instead
    NAN = {},
    MZERO = {},
    // native WeakMap is preferred
    noWeakMap = typeof WeakMap == typeof noWeakMap,
    // partial shim
    indexOf = [].indexOf || function indexOf(value) {
      for(var i = this.length; i-- && this[i] !== value;);
      return i;
    },
    // returns NaN or -0 as singleton
    avoidQuirks = noWeakMap && function avoidQuirks(key) {
      // optimistic with all truthy values
      return key ? key : (
        // for non NaN only
        key == key ? (
          // and 0 only
          key === 0 ? (
            // check if positive
            1/key === Infinity ? key : MZERO
          ) : key
        ) : /*BAT*/NAN/*, naNaNaNa NaNaNa naNaNaNa!*/
      );
    },
    WM = noWeakMap ?
      // partial WeakMap shim, not as weak but consistent
      function WM() {
        var
          keys = [],
          values = [],
          k, i, m, u
        ;
        return m = {
          // dat property name ...
          "delete": function del(key) {
            if (m.has(key)) {
              keys.splice(i, 1);
              values.splice(i, 1);
            }
          },
          get: function get(key) {
            return m.has(key) ? values[i] : u;
          },
          has: function has(key) {
            i = indexOf.call(keys, k = avoidQuirks(key));
            return -1 < i;
          },
          set: function set(key, value) {
            values[
              m.has(key) ? i : keys.push(k) - 1
            ] = value;
          }
        };
      } :
      WeakMap
    ,
    // partial Map shim, same as WeakMap
    M = noWeakMap ?
      WM : Map
    ,
    vDesc = defineProperty ? Object.create(null) : null,
    /**
     * HybridMap,
     *   the half map, half weak, fully cross platform solution
     * @constructor
     */
    HybridMap = defineProperty ?
      function HybridMap() {
        // this should be the constructor for all browsers
        // with the lovely exception of IE < 9
        vDesc.value = holder();
        defineProperty(this, "__map__", vDesc);
      } :
      function HybridMap() {
        // as __map__ guard and for consistency sake,
        // try to avoid enumerability
        // of the __map__ property
        // this should be IE < 9 only version
        // or really old browsers not relevant
        // for the market share
        var toString = this.toString;
        (this.toString = function () {
          return toString.call(this);
        }).__map__ = holder();
      }
    ,
    // as soon as I decide consistency ain't a problem
    // and performace is really affected I might drop this
    // internal stuff ... 'till that day ...
    getMapHolder = defineProperty ?
      function getMapHolder(self) {
        return self.__map__;
      } :
      function getMapHolder(self) {
        return self.toString.__map__;
      }
    ,
    HybridMapPrototype = HybridMap.prototype
  ;

  /**
   * drop all stored keys / empty fresh new map
   * @returns {HybridMap} the instance itself
   */
  HybridMapPrototype.clear = defineProperty ? (
      noWeakMap || !WeakMap.prototype.clear ?
        // clear needs to overwrite the __map__
        (vDesc.configurable = true) &&
        // the intermediate, current, situation
        function clear() {
          HybridMap.call(this);
          return this;
        } :
        // while theoretically should be like this
        function clear() {
          var holder = getMapHolder(this);
          holder.w.clear();
          holder.m.clear();
          return this;
        }
    ) :
    // then ... you know, IE < 9 happens
    function clear() {
      this.toString.__map__ = holder();
      return this;
    }
  ;

  /**
   * remove a key, if present, from the map
   * @param {*} key to delete
   * @returns {boolean} true if removed, false otherwise
   */
  HybridMapPrototype.del = function del(key) {
    var
      m = getMap(this, key),
      has = m.has(key)
    ;
    has && m["delete"](key);
    return has;
  };

  /**
   * get a value associated with a key
   * @param {*} key previously used to store a value
   * @returns {*} the associated value, if any, undefined otherwise
   */
  HybridMapPrototype.get = function get(key) {
    return getMap(this, key).get(key);
  };

  /**
   * check if a key has been used to store a value
   * @param {*} generic key
   * @returns {boolean} true if the key is present, false otherwise
   */
  HybridMapPrototype.has = function has(key) {
    return getMap(this, key).has(key);
  };

  /**
   * set a value associated with a key. Overwrite if already preset
   * @param {*} generic key
   * @param {*} generic value
   * @returns {*} the same value that has been set
   */
  HybridMapPrototype.set = function set(key, value) {
    getMap(this, key).set(key, value);
    return value;
  };

  // in order to retrieve the right internal map to use
  function getMap(self, key) {
    var holder = getMapHolder(self);
    // check the typeof key
    switch (typeof key) {
      // since only objects, and functions,
      // can be used with WeakMap.prototype
      case "object":
      case "function":
        if (key) return holder.w;
    }
    return holder.m;
  }
  // utility to associate empty Weak and normal Map
  function holder() {
    return {
      w: new WM,
      m: new M
    };
  }
  return HybridMap;
}(Object.defineProperty));
},{}],9:[function(require,module,exports){
var Token = require('./src/token');

function fastEach(items, callback) {
    for (var i = 0; i < items.length; i++) {
        if (callback(items[i], i, items)) break;
    }
    return items;
}

function callWith(fn, fnArguments, calledToken){
    var argIndex = 0,
        scope = this,
        args = {
            callee: calledToken,
            length: fnArguments.length,
            raw: function(evaluated){
                var rawArgs = fnArguments.slice();
                if(evaluated){
                    fastEach(rawArgs, function(arg){
                        if(arg instanceof Token){
                            arg.evaluate(scope);
                        }
                    });
                }
                return rawArgs;
            },
            getRaw: function(index, evaluated){
                var arg = fnArguments[index];

                if(evaluated){
                    if(arg instanceof Token){
                        arg.evaluate(scope);
                    }
                }
                return arg;
            },
            get: function(index){
                var arg = fnArguments[index];

                if(arg instanceof Token){
                    arg.evaluate(scope);
                    return arg.result;
                }
                return arg;
            },
            hasNext: function(){
                return argIndex < fnArguments.length;
            },
            next: function(){
                if(!this.hasNext()){
                    throw "Incorrect number of arguments";
                }
                if(fnArguments[argIndex] instanceof Token){
                    fnArguments[argIndex].evaluate(scope);
                    return fnArguments[argIndex++].result;
                }
                return fnArguments[argIndex++];
            },
            all: function(){
                var allArgs = [];
                while(this.hasNext()){
                    allArgs.push(this.next());
                }
                return allArgs;
            }
        };

    return fn(scope, args);
}

function Scope(oldScope){
    this.__scope__ = {};
    this.__outerScope__ = oldScope;
}
Scope.prototype.get = function(key){
    var scope = this;
    while(scope && !scope.__scope__.hasOwnProperty(key)){
        scope = scope.__outerScope__;
    }
    return scope && scope.__scope__[key];
};
Scope.prototype.set = function(key, value, bubble){
    if(bubble){
        var currentScope = this;
        while(currentScope && !(key in currentScope.__scope__)){
            currentScope = currentScope.__outerScope__;
        }

        if(currentScope){
            currentScope.set(key, value);
        }
    }
    this.__scope__[key] = value;
    return this;
};
Scope.prototype.add = function(obj){
    for(var key in obj){
        this.__scope__[key] = obj[key];
    }
    return this;
};
Scope.prototype.isDefined = function(key){
    if(key in this.__scope__){
        return true;
    }
    return this.__outerScope__ && this.__outerScope__.isDefined(key) || false;
};
Scope.prototype.callWith = callWith;

// Takes a start and end regex, returns an appropriate parse function
function createNestingParser(openRegex, closeRegex){
    return function(tokens, index){
        if(this.original.match(openRegex)){
            var position = index,
                opens = 1;

            while(position++, position <= tokens.length && opens){
                if(!tokens[position]){
                    throw "Invalid nesting. No closing token was found matching " + closeRegex.toString();
                }
                if(tokens[position].original.match(openRegex)){
                    opens++;
                }
                if(tokens[position].original.match(closeRegex)){
                    opens--;
                }
            }

            // remove all wrapped tokens from the token array, including nest end token.
            var childTokens = tokens.splice(index + 1, position - 1 - index);

            // Remove the nest end token.
            childTokens.pop();

            // parse them, then add them as child tokens.
            this.childTokens = parse(childTokens);

            //Remove nesting end token
        }else{
            // If a nesting end token is found during parsing,
            // there is invalid nesting,
            // because the opening token should remove its closing token.
            throw "Invalid nesting. No opening token was found matching " + openRegex.toString();
        }
    };
}

function scanForToken(tokenisers, expression){
    for (var i = 0; i < tokenisers.length; i++) {
        var token = tokenisers[i].tokenise(expression);
        if (token) {
            return token;
        }
    }
}

function sortByPrecedence(items){
    return items.slice().sort(function(a,b){
        var precedenceDifference = a.precedence - b.precedence;
        return precedenceDifference ? precedenceDifference : items.indexOf(a) - items.indexOf(b);
    });
}

function tokenise(expression, tokenConverters, memoisedTokens) {
    if(!expression){
        return [];
    }

    if(memoisedTokens && memoisedTokens[expression]){
        return memoisedTokens[expression].slice();
    }

    tokenConverters = sortByPrecedence(tokenConverters);

    var originalExpression = expression,
        tokens = [],
        totalCharsProcessed = 0,
        previousLength,
        reservedKeywordToken;

    do {
        previousLength = expression.length;

        var token;

        token = scanForToken(tokenConverters, expression);

        if(token){
            expression = expression.slice(token.length);
            totalCharsProcessed += token.length;
            tokens.push(token);
            continue;
        }

        if(expression.length === previousLength){
            throw "Unable to determine next token in expression: " + expression;
        }

    } while (expression);

    memoisedTokens && (memoisedTokens[originalExpression] = tokens.slice());

    return tokens;
}

function parse(tokens){
    var parsedTokens = 0,
        tokensByPrecedence = sortByPrecedence(tokens),
        currentToken = tokensByPrecedence[0],
        tokenNumber = 0;

    while(currentToken && currentToken.parsed == true){
        currentToken = tokensByPrecedence[tokenNumber++];
    }

    if(!currentToken){
        return tokens;
    }

    if(currentToken.parse){
        currentToken.parse(tokens, tokens.indexOf(currentToken));
    }

    // Even if the token has no parse method, it is still concidered 'parsed' at this point.
    currentToken.parsed = true;

    return parse(tokens);
}

function evaluate(tokens, scope){
    scope = scope || new Scope();
    for(var i = 0; i < tokens.length; i++){
        var token = tokens[i];
        token.evaluate(scope);
    }

    return tokens;
}

function printTopExpressions(stats){
    var allStats = [];
    for(var key in stats){
        allStats.push({
            expression: key,
            time: stats[key].time,
            calls: stats[key].calls,
            averageTime: stats[key].averageTime
        });
    }

    allStats.sort(function(stat1, stat2){
        return stat2.time - stat1.time;
    }).slice(0, 10).forEach(function(stat){
        console.log([
            "Expression: ",
            stat.expression,
            '\n',
            'Average evaluation time: ',
            stat.averageTime,
            '\n',
            'Total time: ',
            stat.time,
            '\n',
            'Call count: ',
            stat.calls
        ].join(''));
    });
}

function Lang(){
    var lang = {},
        memoisedTokens = {},
        memoisedExpressions = {};


    var stats = {};

    lang.printTopExpressions = function(){
        printTopExpressions(stats);
    }

    function addStat(stat){
        var expStats = stats[stat.expression] = stats[stat.expression] || {time:0, calls:0};

        expStats.time += stat.time;
        expStats.calls++;
        expStats.averageTime = expStats.time / expStats.calls;
    }

    lang.parse = parse;
    lang.tokenise = function(expression, tokenConverters){
        return tokenise(expression, tokenConverters, memoisedTokens);
    };
    lang.evaluate = function(expression, scope, tokenConverters, returnAsTokens){
        var langInstance = this,
            memoiseKey = expression,
            expressionTree,
            evaluatedTokens,
            lastToken;

        if(!(scope instanceof Scope)){
            var injectedScope = scope;

            scope = new Scope();

            scope.add(injectedScope);
        }

        if(Array.isArray(expression)){
            return evaluate(expression , scope).slice(-1).pop();
        }

        if(memoisedExpressions[memoiseKey]){
            expressionTree = memoisedExpressions[memoiseKey].slice();
        } else{
            expressionTree = langInstance.parse(langInstance.tokenise(expression, tokenConverters, memoisedTokens));

            memoisedExpressions[memoiseKey] = expressionTree;
        }


        var startTime = new Date();
        evaluatedTokens = evaluate(expressionTree , scope);
        addStat({
            expression: expression,
            time: new Date() - startTime
        });

        if(returnAsTokens){
            return evaluatedTokens.slice();
        }

        lastToken = evaluatedTokens.slice(-1).pop();

        return lastToken && lastToken.result;
    };

    lang.callWith = callWith;
    return lang;
};

Lang.createNestingParser = createNestingParser;
Lang.Scope = Scope;
Lang.Token = Token;

module.exports = Lang;
},{"./src/token":10}],10:[function(require,module,exports){
function Token(substring, length){
    this.original = substring;
    this.length = length;
}
Token.prototype.name = 'token';
Token.prototype.precedence = 0;
Token.prototype.valueOf = function(){
    return this.result;
}

module.exports = Token;
},{}],11:[function(require,module,exports){
Object.create = Object.create || function (o) {
    if (arguments.length > 1) {
        throw new Error('Object.create implementation only accepts the first parameter.');
    }
    function F() {}
    F.prototype = o;
    return new F();
};

function createSpec(child, parent){
    var parentPrototype;
    
    if(!parent) {
        parent = Object;
    }
    
    if(!parent.prototype) {
        parent.prototype = {};
    }
    
    parentPrototype = parent.prototype;
    
    child.prototype = Object.create(parent.prototype);
    child.prototype.__super__ = parentPrototype;
    
    // Yes, This is 'bad'. However, it runs once per Spec creation.
    var spec = new Function("child", "return function " + child.name + "(){child.prototype.__super__.constructor.apply(this, arguments);return child.apply(this, arguments);}")(child);
    
    spec.prototype = child.prototype;
    spec.prototype.constructor = child.prototype.constructor = spec;
    
    return spec;
}

module.exports = createSpec;
},{}],12:[function(require,module,exports){
var Lang = require('lang-js'),
    Token = Lang.Token,
    paths = require('gedi-paths'),
    createSpec = require('spec-js'),
    detectPath = require('gedi-paths/detectPath');

module.exports = function(get, model){

    function PathToken(){}
    PathToken = createSpec(PathToken, Token);
    PathToken.prototype.name = 'PathToken';
    PathToken.prototype.precedence = 4;
    PathToken.tokenise = function(substring){
        var path = detectPath(substring);

        if(path){
            return new PathToken(path, path.length);
        }
    };
    PathToken.prototype.evaluate = function(scope){
        this.path = this.original;
        this.result = get(paths.resolve(scope.get('_gmc_'), this.original), model);
        this.sourcePathInfo = {
            path: this.original
        };
    };

    return PathToken;
}
},{"gedi-paths":4,"gedi-paths/detectPath":3,"lang-js":9,"spec-js":11}]},{},[1])