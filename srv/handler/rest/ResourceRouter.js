define(['require', 'js/core/Base', 'srv/handler/rest/Resource'], function (require, Base, Resource) {

    return Base.inherit('srv.handler.rest.ResourceRouter', {

        ctor: function(handler) {
            this.$handler = handler;
        },

        getResource: function(context) {

            var path = context.request.urlInfo.pathname,
                handlerRelativePath = this.$handler.$.path;

            if (path.indexOf(handlerRelativePath) !== 0) {
                throw new Error("Handler path '" + handlerRelativePath + "' not at start of " + path);
            }

            // remove relative handler path from path
            path = path.substring(handlerRelativePath.length);

            var pathElements = path.split('/');

            // remove first empty path
            pathElements.shift();

            var resource = this._getResourceForPath(pathElements);

            if (!(resource instanceof Resource)) {
                throw new Error("")
            }

            return resource;
        },

        /***
         *
         * @param {Array} pathElements
         * @return {srv.handler.rest.Resource}
         * @private
         */
        _getResourceForPath: function(pathElements) {
            var configuration = this.$handler.$dataSourceConfiguration,
                resource = null,
                resourceClassName;


            for (var i = 0; i < pathElements.length; i += 2) {
                var path = pathElements[i];
                configuration = configuration.getConfigurationForPath(path);

                if (!configuration) {
                    throw new Error("Configuration for '" + pathElements.slice(0, i + 1).join('/') + "' not found.");
                }

                resourceClassName = configuration.$.resourceClassName;
                if (!resourceClassName) {
                    throw new Error("No resource for '" + pathElements.join('/') + "' found")
                }

                resource = this._createResourceInstance(resourceClassName, configuration, resource);

                var id = pathElements[i+1];
                if (id) {
                    resource.$id = id;
                }

            }

            return resource;

        },


        _createResourceInstance: function(fqClassName, configuration, parentResource) {
            var applicationContext = this.$handler.$stage.$applicationContext;
            fqClassName = applicationContext.getFqClassName(null, fqClassName);

            require([fqClassName], function(resource) {
                resource = resource;
            });

            return applicationContext.createInstance(require(fqClassName), [configuration, parentResource]);
        }
    })
});