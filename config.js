var mongoose = require('mongoose');

mongoose.Promise = global.Promise;

var Schema = mongoose.Schema;

var ConfigSchema = new Schema({
  currency_code: {type: String, default: 'THB'},        // default currency code for bid/offer
  max_watch_list: {type: Number, default: 5},           // maximum number of item watching
  max_bid_count: {type: Number, default: 5},            // maximum number of bidding at the same time
  max_offer_count: {type: Number, default: 5},          // maximum number of offering at the same time
  default_duration: {type: Number, default: 3},         // number of days for posting offered item
  image_size: {type: Number, default: 200*1024},        // image size to be loaded
  max_image_count: {type: Number, default: 5},          // maximum number of images per item
  image_type: {type: [String], default: ['jpg', 'png']},// allowed type of image
  step_price: {type: Number, default: 1}                // step price value for bidding
});

var Config = mongoose.model('Configuration', ConfigSchema)

function createConfig(options = {}) {
  return new Promise(function(resolve, reject) {
    var c = {};
    if(options.currency_code) c.currency_code = options.currency_code;
    if(options.max_watch_list) c.max_watch_list = options.max_watch_list;
    if(options.max_bid_count) c.max_bid_count = options.max_bid_count;
    if(options.max_offer_count) c.max_offer_count = options.max_offer_count;
    if(options.default_duration) c.default_duration = options.default_duration;
    if(options.image_size) c.image_size = options.image_size;
    if(options.max_image_count) c.max_image_count = options.max_image_count;
    if(options.image_type) c.image_type = options.image_type;
    if(options.step_price) c.step_price = options.step_price;

    Config.create(c, function(err, config) {
      if(err) reject(err);
      else resolve(config);
    });
  });
}

module.exports = {
  setConfig: function(options = {}) {
    return new Promise(function(resolve, reject) {
      Config.find({}, function(err, configs) {
        if(err) return reject(err);

        if(configs.length == 1) {
          // Update existing one
          var c = configs[0];
          if(options.currentcy_code) c.currency_code == options.currency_code;
          if(options.max_watch_list) c.max_watch_list = options.max_watch_list;
          if(options.max_bid_count) c.max_bid_count = options.max_bid_count;
          if(options.max_offer_count) c.max_offer_count = options.max_offer_count;
          if(options.default_duration) c.default_duration = options.default_duration;
          if(options.image_size) c.image_size = options.image_size;
          if(options.max_image_count) c.max_image_count = options.max_image_count;
          if(options.image_type) c.image_type = options.image_type;
          if(options.step_price) c.step_price = options.step_price;

          c.save(function(err) {
            if(err) reject(err);
            else resolve(c);
          });

        } else if(configs.length > 1) {
          // There are many config docs, clear all, then create new
          Config.remove({}, function(err) {
            if(err) return reject(err);

            createConfig(options).then(
              function(c) {
                resolve(c)
              },
              function(err) {
                reject(err);
              }
            );
          });
        } else {
          // No config exists, create new one
          createConfig(options).then(
            function(c) {
              resolve(c)
            },
            function(err) {
              reject(err);
            }
          );
        }
      });
    });
  },

  loadConfig: function() {
    return new Promise(function(resolve, reject) {
      Config.find({}, function(err, configs) {
        if(err) return reject(err);
        if(configs.length > 1) return reject("Too many config count("+configs.length+"), need only one config doc");
        if(configs.length == 0) {
          // No config, create with default values
          createConfig({}).then(
            function(c) {
              resolve(c)
            },
            function(err) {
              reject(err);
            }
          );
        } else if(configs.length == 1) {
          // Find a config, using it
          resolve(configs[0]);
        }
      });
    });
  }
}
