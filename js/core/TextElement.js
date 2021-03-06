define(
    ["js/core/Element", "underscore"], function (Element, _) {

        return Element.inherit("js.core.TextElement", {
            defaults: {
                visible: true
            },
            _initializeDescriptors: function () {
                if (this.$descriptor) {
                    this.$.textContent = this._getTextContentFromDescriptor(this.$descriptor);
                }
            },
            render: function () {
                if (!this.$initialized) {
                    this._initialize(this.$creationPolicy);
                }

                this.$el = this.$stage.$document.createTextNode("");
                this._renderTextContent(this.$.textContent);


                return this.$el;
            },
            _renderTextContent: function (textContent) {
                if (_.isUndefined(this.$.textContent) || textContent === null) {
                    textContent = "";
                }
                this.$el.nodeValue = textContent;
                this.$el.data = textContent;
            },
            _commitChangedAttributes: function (attributes) {
                if (this.$el) {
                    if (!_.isUndefined(attributes.textContent)) {
                        this._renderTextContent(attributes.textContent);
                    }
                }
            }
        });
    }
);