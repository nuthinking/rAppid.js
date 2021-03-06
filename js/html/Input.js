define(["js/html/HtmlElement", "underscore", "moment"], function (HtmlElement, _, moment) {
    var radioNameCache = {},
        undefined;

    return HtmlElement.inherit("js.html.Input", {

        $classAttributes: ['updateOnEvent', 'checked'],

        defaults: {
            /***
             * the type of the input element
             * @type String
             */
            type: 'text',

            /***
             * the checked state for radio buttons and checkboxes
             * @type Boolean
             */
            checked: false,

            /***
             * the event on which the bound value will be updated
             * @string String
             */
            updateOnEvent: 'input'
        },

        _commitChangedAttributes: function (attributes) {
            if (this.$.type === 'radio') {

                if (attributes.name) {

                    if (this.$previousAttributes.name && radioNameCache[this.$previousAttributes.name]) {
                        delete radioNameCache[this.$previousAttributes.name][this.$cid];
                    }

                    radioNameCache[attributes.name] = radioNameCache[attributes.name] || {};
                    radioNameCache[attributes.name][this.$cid] = this;
                }

            }
            this.callBase();
        },

        _renderEnabled: function (enabled) {
            if (enabled) {
                this.$el.removeAttribute("disabled");
            } else {
                this.$el.setAttribute("disabled", "disabled");
            }
        },

        _renderValue: function (value) {
            if (value === null || value === undefined) {
                value = "";
            }
            if (String(value) !== this.$el.value) {
                if (this.$.type === "date") {
                    if (value instanceof Date) {
                        value = moment(value).format("YYYY-MM-DD");
                    }
                }

                this.$el.value = value;
            }
        },

        _commitChecked: function (checked) {
            // sync shadow dom
            if (checked && this.$.type === "radio") {
                var cache = radioNameCache[this.$.name];
                for (var id in cache) {
                    if (cache.hasOwnProperty(id)) {
                        if (cache[id] !== this) {
                            cache[id].set('checked', false);
                        }
                    }
                }
            }
        },

        _renderChecked: function (checked) {

            if (checked) {
                this.$el.setAttribute("checked", "checked");
            } else {
                this.$el.removeAttribute("checked");
            }

        },

        _transformValue: function (value) {
            if (this.$.type === "number") {
                if (value === "") {
                    return null;
                }
                value = parseInt(value, 10);
                if (isNaN(value)) {
                    value = this.$.value;
                }
            } else if (this.$.type === "date") {
                try {
                    value = value !== "" ? new Date(value) : null;
                } catch (e) {
                    this.log("Invalid Date", "warn");
                    value = this.$.value;
                }
            }

            return value;
        },

        _bindDomEvents: function () {

            var self = this;
            if (_.include(["text", "password", "date", "number"], this.$.type)) {
                if (this.$.type === "date" || this.$.type === "number") {
                    this.$.updateOnEvent = "change";
                }
                // fix for IE
                if (this.$.updateOnEvent === "input" && "onpropertychange" in this.$el) {
                    this.bindDomEvent("keyup", function (e) {
                        self.set('value', self._transformValue(self.$el.value));
                    });
                } else {
                    this.bindDomEvent(this.$.updateOnEvent, function (e) {
                        self.set('value', self._transformValue(self.$el.value));
                    });
                }

            } else if (this.$.type === "checkbox" || this.$.type === "radio") {
                this.bindDomEvent('click', function (e) {
                    self.set('checked', self.$el.checked);
                });
            }

            this.callBase();
        }
    });
});