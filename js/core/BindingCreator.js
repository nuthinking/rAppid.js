define(['js/core/EventDispatcher', 'js/lib/parser', 'js/core/Binding', 'underscore'], function (EventDispatcher, Parser, Binding, _) {

    function findTransformFunction(path, scope) {
        var pathElement = path[0];
        if (pathElement.type == Binding.TYPE_FNC) {
            scope = scope.getScopeForFncName(pathElement.name);
        } else {
            scope = scope.getScopeForKey(pathElement.name);
        }

        var nScope = scope;
        while (nScope && path.length > 0) {
            pathElement = path.shift();
            if (pathElement.type == Binding.TYPE_FNC) {
                return nScope[pathElement.name];
            } else if (pathElement.type == Binding.TYPE_VAR) {
                nScope = nScope.get(pathElement.name);
            }
        }

        return false;
    }

    var bindingCache = {},
        idCounter = 0;

    function pathToString(path) {
        if (path instanceof Array) {
            var el = [];
            for (var i = 0; i < path.length; i++) {
                if (path[i].type === Binding.TYPE_VAR) {
                    el.push(path[i].name);
                } else if (path[i].type === Binding.TYPE_FNC) {
                    el.push(path[i].name + "(" + (idCounter++) + ")");
                }
            }

            return el.join(".");
        } else {
            return path;
        }
    }


    return EventDispatcher.inherit('js.core.BindingCreator', {

        /***
         *
         * @param bindingDef
         * @param targetScope
         * @param {String|Function} attrKey key where to bind, or callback function
         * @param context
         * @return {*}
         */
        create: function (bindingDef, targetScope, attrKey, context) {

            var path = bindingDef.path;
            var pathElement = path[0];

            var scope;
            var searchScope = targetScope;
            if (pathElement.type != Binding.TYPE_FNC && attrKey == pathElement.name) {
                searchScope = searchScope.$parentScope;
            }

            if (pathElement.type == Binding.TYPE_FNC) {
                scope = searchScope.getScopeForFncName(pathElement.name);
            } else {
                scope = searchScope.getScopeForKey(pathElement.name);
            }

            if (scope) {
                if (bindingDef.type !== "static") {
                    var cb;
                    if (_.isFunction(attrKey)) {
                        cb = attrKey;
                    }

                    var twoWay = (bindingDef.type == Binding.TYPE_TWOWAY),
                        cacheId,
                        cacheBinding = !cb && !twoWay && context && context.length === 1 && (context[0] instanceof Object);

                    if (cacheBinding) {
                        cacheId = pathToString(bindingDef.path) + "_" + scope.$cid;
                        if (bindingCache[cacheId]) {
                            bindingCache[cacheId].addTarget(targetScope, attrKey);
                            return bindingCache[cacheId];
                        }
                    }


                    var options = {
                        scope: scope,
                        path: path,
                        parent: bindingDef.parent,
                        target: targetScope,
                        twoWay: twoWay,
                        context: context,
                        bindingCreator: this
                    };

                    if (twoWay) {
                        if (bindingDef.transform) {
                            var transformFnc = findTransformFunction(bindingDef.transform, searchScope);
                            if (transformFnc) {
                                options.transform = transformFnc;
                            }
                        }

                        if (bindingDef.transformBack) {
                            var transformBackFnc = findTransformFunction(bindingDef.transformBack, searchScope);
                            if (transformBackFnc) {
                                options.transformBack = transformBackFnc;
                            }
                        }
                    }

                    if (cb) {
                        options.callback = cb;
                    } else {
                        options.targetKey = attrKey;
                    }

                    var binding = new Binding(options);
                    if (cacheBinding) {
                        binding.bind('destroy', function () {
                            delete bindingCache[cacheId];
                        });
                        bindingCache[cacheId] = binding;
                    }

                    return binding;

                } else {
                    var par;

                    function resolvePath(scope, path) {
                        resolveParameter(path);
                        return scope.get(path);
                    }

                    function resolveParameter(path) {
                        var pathElement,
                            first,
                            scope;
                        for (var i = 0; i < path.length; i++) {
                            pathElement = path[i];
                            if (_.isObject(pathElement)) {
                                if (pathElement.type === "fnc") {
                                    for (var j = 0; j < pathElement.parameter.length; j++) {
                                        par = pathElement.parameter[j];
                                        // if it's a path
                                        if (_.isArray(par)) {
                                            first = par[0];
                                            // TODO: check targetscope first
                                            if (first.type === "var") {
                                                scope = searchScope.getScopeForKey(first.name);
                                            } else if (first.type === "fnc") {
                                                scope = searchScope.getScopeForKey(first.name);
                                            }
                                            if (scope) {
                                                pathElement.parameter[j] = resolvePath(scope, par);
                                            }

                                        }
                                    }
                                }
                            }
                        }
                    }

                    resolveParameter(bindingDef.path);

                    return scope.get(bindingDef.path);
                }
            } else {
                throw new Error("Couldn't find scope for " + pathElement.name);
            }

        },

        /***
         *
         * @param text
         * @param scope
         * @param attrKey
         * @param [bindingDefinitions]
         * @return {*}
         */
        evaluate: function (text, scope, attrKey, bindingDefinitions) {
            if (!_.isString(text)) {
                return text;
            }

            bindingDefinitions = bindingDefinitions || this.parse(text);

            var binding,
                bindings = [];

            for (var i = 0; i < bindingDefinitions.length; i++) {
                var bindingDef = bindingDefinitions[i];
                if (bindingDef.length) {
                    bindingDefinitions[i] = bindingDef;
                } else {
                    try {
                        binding = this.create(bindingDef, scope, attrKey, bindingDefinitions);
                    } catch (e) {
                        throw new Error("Create binding for '" + text + "'. " + e.message);
                    }

                    if (binding instanceof Binding) {
                        bindings.push(binding);
                        scope.$bindings[attrKey] = scope.$bindings[attrKey] || [];
                        scope.$bindings[attrKey].push(binding);
                    }
                    bindingDefinitions[i] = binding;
                }

            }

            if (bindings.length > 0) {
                return bindings[0].getContextValue();
            } else if (bindingDefinitions.length > 0) {
                if (bindingDefinitions.length === 1) {
                    return bindingDefinitions[0];
                }
                return Binding.contextToString(bindingDefinitions);
            } else {
                return text;
            }

        },

        parse: function (text) {
            if (_.isString(text)) {
                return Parser.parse(text, "text");
            }
        },

        parsePath: function (text) {
            return Parser.parse(text, "path");
        },
        containsBindingDefinition: function (bindingDefinitions) {

            if (bindingDefinitions) {
                for (var i = 0; i < bindingDefinitions.length; i++) {
                    if (bindingDefinitions[i] instanceof Object) {
                        return true;
                    }
                }
            }

            return false;
        }
    });

});