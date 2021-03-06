define(
    ["js/ui/ItemsView", "js/html/HtmlElement"], function (ItemsView, HtmlElement) {
        return ItemsView.inherit({
            defaults: {
                tagName: "div",
                visibleView: null
            },
            ctor: function () {
                this.$children = [];
                this.callBase();
            },
            addChild: function (child) {
                this.callBase();
                if (child instanceof HtmlElement) {
                    this.$children.push(child);
                }
            },
            _renderChild: function (child) {
                if (this.$.visibleView == child) {
                    child.set({visible: true});
                    this.callBase();
                }
            },
            _renderVisibleView: function (child, oldView) {
                if (oldView) {
                    oldView.set({visible: false});
                }

                if (child) {
                    if (!child.isRendered()) {
                        child.set({visible: false});
                        this._renderChild(child);
                    }
                    child.set({visible: true});
                }

            },
            _renderVisibleIndex: function (index) {
                if (index > -1 && index < this.$children.length) {
                    this.set({visibleView: this.$children[index]});
                } else if (this.$.visibleView) {
                    this.$.visibleView.set({visible: false});
                }
            }

        });
    }
);