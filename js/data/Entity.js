define(['require', 'js/core/Bindable', 'js/core/List', 'flow', 'js/data/validator/Validator', 'underscore'],
    function (require, Bindable, List, flow, Validator, _) {

        var undefined;

        var ValidationErrors = Bindable.inherit('js.data.Entity.ValidationErrors', {
            firstError: function () {
                for (var key in this.$) {
                    if (this.$.hasOwnProperty(key) && this.$[key]) {
                        return this.$[key];
                    }
                }
                return null;
            }.on('change'),
            size: function () {
                return  _.size(this.$);
            }.on('change')
        });

        var Entity = Bindable.inherit('js.data.Entity', {

            ctor: function (attributes) {
                this.$errors = new ValidationErrors();
                this.$entityInitialized = false;
                this._extendSchema();

                this.callBase(attributes);
            },

            schema: {},

            validators: [],

            idField: "id",
            createdField: false,
            updatedField: false,

            $context: null,
            $dependentObjectContext: null,

            // TODO: merge this together
            $isEntity: true,
            $isDependentObject: true,

            _extendSchema: function () {

                if (this.factory.schema) {
                    this.schema = this.factory.schema;
                    return;
                }
                var base = this.base;

                while (base.factory.classof(Entity)) {
                    var baseSchema = base.schema;
                    for (var type in baseSchema) {
                        if (baseSchema.hasOwnProperty(type) && !this.schema.hasOwnProperty(type)) {
                            this.schema[type] = baseSchema[type];
                        }
                    }
                    base = base.base;
                }

                var schemaDefaults = {
                    required: true,
                    includeInIndex: false,
                    _rewritten: true
                }, schemaObject;

                // add id schema
                if (this.idField && !this.schema.hasOwnProperty(this.idField)) {
                    this.schema[this.idField] = {
                        type: String,
                        required: false,
                        includeInIndex: true,
                        generated: true
                    };
                }

                if (this.updatedField && !this.schema.hasOwnProperty(this.updatedField)) {
                    this.schema[this.updatedField] = {
                        type: Date,
                        required: false,
                        includeInIndex: true,
                        generated: true
                    };
                }

                if (this.createdField && !this.schema.hasOwnProperty(this.createdField)) {
                    this.schema[this.createdField] = {
                        type: Date,
                        required: false,
                        includeInIndex: true,
                        generated: true
                    };
                }

                // rewrite schema
                for (var key in this.schema) {
                    if (this.schema.hasOwnProperty(key)) {
                        schemaObject = this.schema[key];
                        var isString = _.isString(schemaObject);
                        if (isString || schemaObject instanceof Array || schemaObject instanceof Function) {
                            schemaObject = {
                                type: isString ? require(schemaObject.replace(/\./g, "/")) : schemaObject
                            };
                            this.schema[key] = schemaObject;
                        }
                        _.defaults(schemaObject, schemaDefaults);
                        schemaObject._key = key;
                    }
                }
                this.factory.schema = this.schema;
            },

            /***
             * Returns the correct context for a child factory
             * @param {Function} childFactory
             * @return {js.data.DataSource.Context}
             */
            getContextForChild: function (childFactory) {

                if (this._isChildFactoryDependentObject(childFactory)) {
                    // dependent object, which should be cached in context of the current entity
                    if (!this.$dependentObjectContext) {

                        if (this.$parentEntity) {
                            // entity itself lives inside a model
                            this.$dependentObjectContext = this.$parentEntity.$dependentObjectContext;
                        } else {
                            // create a new non-cached context for dependent objects
                            this.$dependentObjectContext = this.$context.$dataSource.createContext(this);
                        }
                    }

                    return this.$dependentObjectContext;
                }


                return this.$context.$dataSource.getContextForChild(childFactory, this);
            },

            /**
             * Creates an entity in the context of the given entity
             * @param {Function} childFactory
             * @param {String|Number} [id]
             * @return {js.data.Entity}
             */
            createEntity: function (childFactory, id) {
                var context = this.getContextForChild(childFactory);

                return context.createEntity(childFactory, id);
            },

            _isChildFactoryDependentObject: function (childFactory) {
                return childFactory && childFactory.prototype.$isDependentObject;
            },

            /**
             * Parses data
             * Can be overridden to post change parsed data
             * @param data
             * @param [action]
             * @param [options]
             */
            parse: function (data, action, options) {
                for (var key in this.initSchema) {
                    if (this.initSchema.hasOwnProperty(key)) {
                        this.$$[key] = data[key];
                    }
                }
                return data;
            },

            /***
             * Composes the data based on the schema.
             * Can pe used to pre compose the data for the processor
             * @param action
             * @param options
             * @return {Object} all data that should be serialized
             */
            compose: function (action, options) {
                return _.clone(this.$);
            },

            /***
             * Clears all errors
             */
            clearErrors: function () {
                this.$errors.clear();
            },

            /***
             * Returns the errors of the entity
             * @param {String} field
             * @return {js.core.Bindable}
             */
            errors: function () {
                return this.$errors;
            }.on('isValidChanged'),

            fieldError: function (field) {
                return this.$errors.$[field];
            }.on('isValidChanged'),

            /***
             *
             * @return {Boolean} true if valid
             */
            isValid: function ($) {
                $ = $ || this.$errors.$;
                for (var key in $) {
                    if ($.hasOwnProperty(key)) {
                        if ($[key]) {
                            return false;
                        }
                    }
                }

                return true;
            }.on('isValidChanged'),

            /***
             *
             * @param {Object} [options]
             * @param {Object} [options.setErrors=true] -
             * @param {Object} [options.fields=null] - fields to validate
             *
             * @param {Function} [callback]
             */
            validate: function (options, callback) {
                if (options instanceof Function) {
                    callback = options;
                    options = {};
                }

                options = options || {};

                _.defaults(options, {
                    setErrors: true,
                    fields: null
                });

                var self = this;

                var validators = [], validator;
                for (var i = 0; i < this.validators.length; i++) {
                    validator = this.validators[i];
                    if (options.fields && options.fields.length > 0) {
                        if (options.fields.indexOf(validator.$.field) > -1) {
                            validators.push(validator);
                        }
                    } else {
                        validators.push(validator);
                    }
                }

                var validationErrors = [];

                // TODO: specify in entity and provide
                validators.unshift(new Entity.SchemaValidator());

                flow()
                    .parEach(validators, function (validator, cb) {
                        validator.validate(self, function (err, result) {
                            if (!err && result) {
                                if (result instanceof Validator.Error) {
                                    validationErrors.push(result);
                                } else if (result instanceof Array) {
                                    validationErrors = validationErrors.concat(result);
                                }
                            }
                            cb(err);
                        });
                    })
                    .exec(function (err) {
                        if (options.setErrors === true) {
                            self._setErrors(validationErrors);
                        }
                        callback && callback(err, validationErrors.length === 0 ? null : validationErrors);
                    });

            },

            // TODO: combine _setError and _setErrors
            _setError: function (field, error) {

                if (field instanceof Object) {
                    this.$errors.set(field);
                } else {
                    this.$errors.set(field, error);
                }

                this.trigger('isValidChanged');
            },

            _setErrors: function (errors) {
                this.$errors.clear();

                var error;
                try {
                    for (var i = 0; i < errors.length; i++) {
                        error = errors[i];
                        if (error.$.field && !this.$errors.$.hasOwnProperty(error.$.field)) {
                            this.$errors.set(error.$.field, error);
                        } else if (!this.$errors.$.hasOwnProperty('_base')) {
                            this.$errors.set('_base', error);
                        }
                    }
                } catch (e) {
                    this.log(e, 'warn');
                }
                this.trigger('isValidChanged');
            },

            error: function (key) {
                if (key) {
                    return this.$errors.get(key);
                }
                return null;
            },

            validateSubEntity: function (entity, callback) {
                if (entity instanceof Entity) {
                    entity.validate(null, callback);
                } else {
                    callback("parameter is not an entity");
                }
            },

            clone: function () {
                var ret = this.callBase();
                ret.$context = this.$context;
                ret.$parent = this.$parent;
                return ret;
            },
            _cloneAttribute: function (value, key) {

                // don't clone a list of model references!
                if (value instanceof List) {
                    if (this.schema.hasOwnProperty(key)) {
                        var type = this.schema[key].type;
                        if (type instanceof Array && type.length && type[0].classof && type[0].classof(Entity) && !type[0].prototype.$isEntity) {
                            var list = new List();
                            list._$source = value;
                            list.add(value.$items);
                            return list;
                        }
                    }
                } else if (value instanceof Entity && !value.$isEntity) {
                    // dont clone linked models
                    return value;
                }

                return this.callBase();
            },

            init: function (callback) {
                callback && callback();
            },

            identifier: function () {
                return this.$[this.idField];
            },

            contextModel: function () {
                return this.$context ? this.$context.$contextModel : null;
            }
        });


        Entity.SchemaValidator = Validator.inherit('js.data.validator.SchemaValidator', {
            validate: function (entity, callback) {
                var errors = [],
                    subEntities = [],
                    attributes = entity.$,
                    schema = entity.schema,
                    schemaObject,
                    value,
                    type, err;

                try {
                    for (var key in schema) {
                        if (schema.hasOwnProperty(key)) {
                            value = attributes[key];
                            schemaObject = schema[key];

                            type = schemaObject.type;

                            // TODO: add idField validator with this reg ex ^(?:[\w\-](?<!_))+$
                            if (this._isUndefined(value, schemaObject) && this._isRequired(entity, schemaObject)) {
                                errors.push(this._createError("isUndefinedError", key + " is required", key));
                            } else if (value && !this._isValidType(value, schemaObject.type)) {
                                errors.push(this._createError("wrongTypeError", key + " is from wrong type", key));
                            } else if (value instanceof Entity) {
                                subEntities.push({
                                    key: key,
                                    value: value
                                });
                            } else if (value instanceof List && value.isCollection) {
                                if (value.size() > 0 && value.at(0) instanceof Entity) {
                                    for (var i = 0; i < value.$items.length; i++) {
                                        subEntities.push({
                                            key: key,
                                            value: value.$items[i]
                                        });
                                    }
                                } else if (value.size() === 0 && !(this.runsInBrowser() && schemaObject.generated) && this._isRequired(entity, schemaObject.required) === true) {
                                    errors.push(this._createError("isEmptyError", key + " are empty", key));
                                }
                            }
                        }
                    }
                } catch (e) {
                    err = e || true;
                }

                var self = this;

                flow()
                    .seq(function () {
                        if (err) {
                            throw err;
                        }
                    })
                    .seqEach(subEntities, function (subEntity, cb) {
                        entity.validateSubEntity(subEntity.value, function (err, results) {
                            if (results) {
                                errors.push(self._createError("associationError", subEntity.key + " is not valid", subEntity.key));
                            }
                            cb(err);
                        });
                    })
                    .exec(function (err) {

                        callback(err, errors);
                    });
            },

            _isValidType: function (value, type) {

                if (type === String && !_.isString(value)) {
                    return false;
                } else if (type === Number && !_.isNumber(value)) {
                    return false;
                } else if (type === Boolean && !_.isBoolean(value)) {
                    return false;
                } else if (type === Array && !(value instanceof List || value instanceof Array)) {
                    return false;
                } else if (type === Date && !(value instanceof Date)) {
                    return false;
                } else if (type.classof && type.classof(Entity) && !(value instanceof type)) {
                    return false;
                } else if (type === Object && !_.isObject(value)) {
                    return false;
                }
                return true;
            },

            _isUndefined: function (value, schemaObject) {
                var type = schemaObject.type;
                if (type && type.isCollection) {
                    return false;
                }
                return (!(this.runsInBrowser() && schemaObject.generated)) && (value === undefined || value === null || value === "");
            },

            _isRequired: function (entity, schemaObject) {

                if (schemaObject.type && schemaObject.type.prototype && schemaObject.type.prototype.isCollection) {
                    return false;
                }

                var required = schemaObject.required;

                if (required instanceof Function) {
                    return required.call(entity);
                } else {
                    return required;
                }
            }
        });

        return Entity;

    });