define(['require', 'srv/core/Handler', 'flow', 'fs', 'path', 'srv/core/HttpError', 'json!srv/conf/mime.types.json', 'underscore'],
    function (require, Handler, flow, Fs, Path, HttpError, MimeTypes, _) {

        Fs.exists = Fs.exists || Path.exists;
        return Handler.inherit('srv.core.StaticFileHandler', {

            ctor: function() {
                this.$mimeTypes = MimeTypes || {};
                this.callBase();
            },

            defaults: {
                documentRoot: null,
                indexFile: 'index.html',
                defaultContentType: 'text/plain'
            },

            start: function (server, callback) {

                if (!this.$.documentRoot) {
                    this.$.documentRoot = this.$stage.$applicationContext.$config.documentRoot;
                }

                this.$.documentRoot = Path.resolve(this.$.documentRoot);
                this.log('Using document root: ' + this.$.documentRoot);

                callback();
            },

            handleRequest: function (context, callback) {

                var self = this;

                flow()
                    .seq("path", function () {
                        var documentRoot = self.$.documentRoot;

                        var pathName = context.request.urlInfo.pathname;

                        if (pathName === '/') {
                            pathName = self.$.indexFile;
                        }

                        var path = Path.resolve(Path.join(documentRoot, pathName));

                        if (path.indexOf(documentRoot) !== 0) {
                            throw new HttpError("Path outside document root", 403);
                        }

                        return path;
                    })
                    .seq(function (cb) {
                        Fs.exists(this.vars['path'], function (exists) {
                            if (!exists) {
                                cb(new HttpError('File does not exists.', 404));
                            }

                            cb();
                        });
                    })
                    .seq(function () {
                        var path = this.vars['path'],
                            stream = Fs.createReadStream(path),
                            extension = Path.extname(path).substring(1);

                        stream.on('end', function() {
                            context.response.end();
                        });

                        stream.on('close', function () {
                            context.response.end();
                        });

                        context.response.writeHead(200, {
                            'Content-Type': self.$mimeTypes[extension] || self.$.defaultContentType
                        });

                        stream.pipe(context.response);
                    })
                    .exec(callback);

            }
        });
    });