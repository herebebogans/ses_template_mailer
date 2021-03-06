// Generated by CoffeeScript 1.12.7
var AWS, Email, EventEmitter, Handlebars, _, async, ejs, htmlToText, isUrl, path, proxy, proxyUrl, pug, request,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

EventEmitter = require('events');

path = require('path');

AWS = require('aws-sdk');

_ = require('lodash');

Handlebars = require("handlebars");

pug = require("pug");

ejs = require("ejs");

isUrl = require('is-url');

request = require('request');

async = require('async');

htmlToText = require('html-to-text');

proxy = require('proxy-agent');

proxyUrl = process.env.HTTP_PROXY || process.env.HTTP_PROXY;


/**
Template Engine for Amazon Web Services Simple Email Service (SES).


@class Email
@constructor
@param Object data SES.sendEmail data. http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/SES.html#sendEmail-property
@param Object credentials aws credentials. http://docs.aws.amazon.com/AWSJavaScriptSDK/guide/node-configuring.html
@example
	Email = require('../lib/email')
	email = new Email({

			Destination: {
				BccAddresses: ['Jack Sprat <jack-sprat@hotmail.com>'],
				CcAddresses: ['Humpty Dumpty <humpty-dumpty@yahoo.com>'],
				ToAddresses: ['Peter Pumpkineater <peter-pumpkineater@gmail.com>']
			},
			Message: {
				Subject: {
					Data: 'Pumpkin Eater'
				},
				Body: {
						Html: {
							Data: '<div>{{peter}}, {{peter}} pumpkin eater, Had a wife but couldn't keep her; <a href="{{more}}">more</a></div>'
						},
						Text: {
							Data: '{{peter}}, {{peter}} pumpkin eater, Had a wife but couldn't keep her;'
						}
				},
				TemplateData: {name:'Peter', more: 'https://en.wikipedia.org/wiki/Peter_Peter_Pumpkin_Eater'},
				TemplateType: 'handlebars'
			},
			Source: 'admin@example.com',
			ReplyToAddresses: [ 'Nobody <no-reply@example.com>'],
			ReturnPath: 'admin@example.com'
		}, {
			accessKeyId: 'my_aws_access_key',
			secretAccessKey: 'my_aws_secret_key',
			region: 'us-west-1'
	});

	email.send(params, function(err, data) {
		if (err)
			console.log(err, err.stack); // an error occurred
		else
			console.log(data);		   // successful response
	});
 */

Email = (function(superClass) {
  extend(Email, superClass);

  Email.COMPLETE_EVENT = 'complete';

  Email.SEND_EVENT = 'send';

  Email.ERROR_EVENT = 'error';

  Email.TEMPLATE_LANGUGES = ["handlebars", "pug", "ejs", "underscore"];


  /**
  	SES rate limit. The amount of emails to send per second
  
  	@property rateLimit
  	@type AWS.SES
  	@default 90
   */

  Email.prototype.rateLimit = 90;


  /**
  	Set a global template for multiple recipients.
  	This should be a location of a template file or a template string.
  	Template files can have the following with extensions
  	.pug, .handlebars, .underscore, or .ejs which will determine the
  	template language used. If a string is used then Handlebars will be
  	used by default unless TemplateType is defined.
  
  	@property template
  	@type String
  	@default null
  	@example
  		'https://mybucket.s3.amazonaws.com/template.handlebars'
  		## or ##
  		'<div class="entry">
  			<h1>{{title}}</h1>
  			<div class="body">{{body}}</div>
  		</div>'
   */

  Email.prototype.template = null;


  /**
  	Object containing the data for the template.
  
  	@property templateData
  	@type Object
  	@default null
  	@example
  		{ var1: "var1 content", var2: "var2 content" }
   */

  Email.prototype.templateData = null;


  /**
  	The type of template language to use, either:
  	handlebars, pug, ejs, or underscore. "handlebars" is used by default
  	unless otherwise specified by extension used by the template name.
  
  	@property template
  	@type String
  	@default 'handlebars'
   */

  Email.prototype.templateType = null;


  /**
  	Config data for SES
  
  	@property data
  	@type Object
  	@default null
   */

  Email.prototype.data = null;

  Email.prototype._ses = null;

  function Email(data, credentials) {
    if (!_.isArray(data)) {
      data = [data];
    }
    this.data = data.map(function(item) {
      return _.defaultsDeep(item, {
        Destination: {
          BccAddresses: null,
          CcAddresses: null,
          ToAddresses: null
        },
        Message: {
          Subject: null,
          Body: {
            Html: {
              Data: null
            },
            Text: {
              Data: null
            }
          },
          TemplateData: {},
          TemplateType: 'handlebars'
        },
        Source: null,
        ReplyToAddresses: null,
        ReturnPath: null
      });
    });
    if (credentials) {
      credentials = _.defaults(credentials, {
        region: 'us-east-1'
      }, {
        httpOptions: {
          agent: proxy(proxyUrl)
        }
      });
      AWS.config.update(credentials);
    }
    this._ses = new AWS.SES();
  }


  /**
  	Send an email.
  	@method send
  	@async
  	@param {Function} callback callback function
   */

  Email.prototype.send = function(callback) {
    var cargo, err, errCache, resultCache;
    if (!this.data || !this.data.length) {
      err = new Error("data is required");
      if (_.isFunction(callback)) {
        return callback(err);
      } else {
        return this.emit(Email.ERROR_EVENT, err);
      }
    }
    if (this.data.length > 1) {
      errCache = [];
      resultCache = [];
      cargo = async.cargo((function(_this) {
        return function(tasks, done) {
          return setTimeout(function() {
            return async.each(tasks, function(item, callback) {
              return _this._dispatch(item, function(err, result) {
                if (err) {
                  errCache.push(err);
                  _this.emit(Email.ERROR_EVENT, err);
                } else {
                  resultCache.push(result);
                  _this.emit(Email.SEND_EVENT, result, item);
                }
                return callback(null, true);
              });
            }, done);
          }, 1000);
        };
      })(this), this.rateLimit);
      cargo.drain = (function(_this) {
        return function() {
          if (errCache.length) {
            err = errCache;
          }
          if (_.isFunction(callback)) {
            return callback(err, resultCache, _this.data);
          } else {
            return _this.emit(Email.COMPLETE_EVENT, err, resultCache, _this.data);
          }
        };
      })(this);
      return cargo.push(this.data);
    } else {
      return this._dispatch(this.data[0], (function(_this) {
        return function(err, result) {
          if (_.isFunction(callback)) {
            return callback(err, result, _this.data[0]);
          } else {
            if (err) {
              _this.emit(Email.ERROR_EVENT, err);
              err = [err];
            } else {
              _this.emit(Email.SEND_EVENT, result, _this.data[0]);
            }
            return _this.emit(Email.COMPLETE_EVENT, err, [result], _this.data);
          }
        };
      })(this));
    }
  };

  Email.prototype._dispatch = function(data, callback) {
    if (!data) {
      return callback(new Error("data is required"));
    }
    if (!data.Destination || !data.Destination.ToAddresses) {
      return callback(new Error("Destination is required"));
    }
    if (!data.Source) {
      return callback(new Error("Source is required"));
    }
    if (!data.Message) {
      return callback(new Error("Message is required"));
    }
    if (!data.Message.Subject || !data.Message.Subject.Data || !data.Message.Subject.Data.length) {
      return callback(new Error("Message.Subject is required"));
    }
    if (!data.Message.Body) {
      return callback(new Error("Message.Body is required"));
    }
    return this._prepTemplate(data, (function(_this) {
      return function(err, result) {
        if (err) {
          return callback(err);
        }
        if (!result) {
          callback(new Error('Unable to parse options'));
        }
        delete result.Message.TemplateType;
        delete result.Message.TemplateData;
        return _this._ses.sendEmail(result, callback);
      };
    })(this));
  };

  Email.prototype._prepTemplate = function(data, callback) {
    var templateMethod, type;
    if (this.template) {
      data.Message.Body.Html.Data = this.template;
    }
    if (this.templateData) {
      data.Message.TemplateData = this.templateData;
    }
    type = _.get(data, ['Message', 'TemplateType']) || _.get(data, ['Message', 'Body', 'Html', 'Data']);
    data.Message.TemplateType = this._getTemplateType(type);
    if (data.Message.Body.Text && data.Message.Body.Text.Data && data.Message.Body.Text.Data.length && data.Message.TemplateType === 'pug') {
      return callback(new Error('Plain text emails cannot be compiled with Pug. Set "Message.Body.Text" to "null" to allow the text email to be generated from the HTML.'));
    }
    if (data.Message.Body.Html && data.Message.Body.Html.Data && !data.Message.Body.Text || !data.Message.Body.Text.Data) {
      data.Message.Body.Text = {
        Data: data.Message.Body.Html.Data
      };
    }
    if (data.Message && data.Message.TemplateType) {
      templateMethod = this["_prep" + (data.Message.TemplateType.charAt(0).toUpperCase() + data.Message.TemplateType.slice(1)) + "Template"];
    }
    if (_.isFunction(templateMethod)) {
      return this._getTemplateString(data.Message.Body.Html.Data, data.Message.Body.Text.Data, (function(_this) {
        return function(err, result) {
          if (err) {
            return callback(err);
          }
          return async.parallel([
            function(callback) {
              if (result.html) {
                return templateMethod(result.html, data.Message.TemplateData, function(err, html) {
                  return callback(err, html);
                });
              } else {
                return callback(null, data.Message.Body.Html.Data);
              }
            }, function(callback) {
              if (result.text) {
                return templateMethod(result.text, data.Message.TemplateData, function(err, text) {
                  return callback(err, text);
                });
              } else {
                return callback(null, data.Message.Body.Text.Data);
              }
            }
          ], function(err, result) {
            data.Message.Body.Html.Data = result[0];
            data.Message.Body.Text.Data = result[1];
            if (/<[a-z][\s\S]*>/.test(data.Message.Body.Text.Data)) {
              data.Message.Body.Text.Data = htmlToText.fromString(data.Message.Body.Text.Data);
            }
            return callback(err, data);
          });
        };
      })(this));
    } else {
      return callback(new Error("Unable to define resolve template language " + data.Message.TemplateType));
    }
  };


  /**
  	Retrieves the template as a string if a url is given.
  
  	@method _getTemplateString
  	@param {Function} callback callback function
  	@async
   */

  Email.prototype._getTemplateString = function(html, text, callback) {
    if (!html || !html.length) {
      return callback(new Error("Must provide an html template"));
    }
    if (!text || !text.length) {
      return callback(new Error("Must provide an text template"));
    }
    return async.parallel([
      (function(_this) {
        return function(callback) {
          if (isUrl(html)) {
            return request(html, function(err, response, body) {
              if (!err && response.statusCode === 200) {
                return callback(null, body);
              } else {
                return callback(new Error("Unable location template at " + html));
              }
            });
          } else {
            return callback(null, html);
          }
        };
      })(this), (function(_this) {
        return function(callback) {
          if (isUrl(text)) {
            return request(text, function(err, response, body) {
              if (!err && response.statusCode === 200) {
                return callback(null, body);
              } else {
                return callback(new Error("Unable location template at " + text));
              }
            });
          } else {
            return callback(null, text);
          }
        };
      })(this)
    ], function(err, result) {
      return callback(err, {
        html: result[0],
        text: result[1]
      });
    });
  };


  /**
  	Retrieves the template language by first looking looking at the extension
  	if a template url if given, then at this.templateType and finally default
  	to 'handlebars'.
  
  	@method _getTemplateType
  	@param {String} url url of template
   */

  Email.prototype._getTemplateType = function(type) {
    var ext;
    if (isUrl(type)) {
      ext = path.extname(type).replace(".", "");
      if (ext && Email.TEMPLATE_LANGUGES.indexOf(ext) > -1) {
        return ext;
      }
    }
    if (Email.TEMPLATE_LANGUGES.indexOf(type) > -1) {
      return type;
    }
    if (this.templateType && Email.TEMPLATE_LANGUGES.indexOf(this.templateType) > -1) {
      return this.templateType;
    }
    return Email.TEMPLATE_LANGUGES[0];
  };


  /**
  	Parses an html email template.
  
  	@method _prepUnderscoreTemplate
  	@param {String} template the template file content
  	@param {Function} callback callback function
  	@async
   */

  Email.prototype._prepUnderscoreTemplate = function(template, data, callback) {
    var err, html, templ;
    try {
      templ = _.template(template);
      html = templ(data);
    } catch (error) {
      err = error;
      return callback(err);
    }
    return callback(null, html);
  };


  /**
  	Parses a pug email template.
  
  	@method _prepPugTemplate
  	@param {String} template the template file content
  	@param {Function} callback callback function
  	@async
   */

  Email.prototype._prepPugTemplate = function(template, data, callback) {
    var err, html, templ;
    try {
      templ = pug.compile(template);
      html = templ(data);
    } catch (error) {
      err = error;
      return callback(err);
    }
    return callback(null, html);
  };


  /**
  	Parses a embedded javaScript templates email template.
  
  	@method _prepEjsTemplate
  	@param {String} template the template file content
  	@param {Function} callback callback function
  	@async
   */

  Email.prototype._prepEjsTemplate = function(template, data, callback) {
    var err, html;
    try {
      html = ejs.render(template, data);
    } catch (error) {
      err = error;
      return callback(err);
    }
    return callback(null, html);
  };


  /**
  	Parses a handlebars email template.
  
  	@method _prepHandlebarsTemplate
  	@param {String} template the template file content
  	@param {Function} callback callback function
  	@async
   */

  Email.prototype._prepHandlebarsTemplate = function(template, data, callback) {
    var err, html, templ;
    try {
      templ = Handlebars.compile(template);
      html = templ(data);
    } catch (error) {
      err = error;
      return callback(err);
    }
    return callback(null, html);
  };

  return Email;

})(EventEmitter);

module.exports = Email;
