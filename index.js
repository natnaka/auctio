// Nothing now, it's just a function exporting file
var mongoose = require('mongoose');

var conf = require('./config');
var cat = require('./category');
var oi = require('./offer_item');

mongoose.Promise = global.Promise;

function initialize(db_uri, db_options={}, options={}) {
  return new Promise(function(resolve, reject) {
    // For db_uri and db_options, see mongoosejs.com/docs/connection.html
    mongoose.connect(db_uri, db_options);
    var db = mongoose.connection;

    db.on('error', function() {
      reject("DB connection error");
    });

    //db.on('connected', function() {
    db.once('open', function() {
      console.log('Db is connected');
      
      // Setting up configuration
      if(Object.keys(options).length > 0) {
        conf.setConfig(options).then(function(c) {
          // Set global config
          global.auctioConfig = JSON.parse(JSON.stringify(c));
          resolve(true);
        },function(e) {
          reject(e);
        });
      } else {
        conf.loadConfig().then(function(c) {
          // Set global config
          global.auctioConfig = JSON.parse(JSON.stringify(c));
          resolve(true);
        },function(e) {
          reject(e);
        });
      }
    });
  });
}

function terminate() {
  return new Promise(function(resolve, reject) {
    mongoose.connection.close(function() {
      resolve(true);
    });
  });
}

module.exports = {
  // For initialize MongoDB and Auctio configuration
  initialize: initialize,

  // For closing connection to MongoDB
  terminate: terminate,

  // For adding new item category
  addCategory: cat.addNewCategory,

  // For removing category and its descendants
  removeCategory: cat.removeCategory,

  // For offering(sell) item
  offerItem: oi.offerItem,

  // For bidding item
  bidItem: oi.bidItem,

  // For searching item
  searchItemBasic: oi.searchItemBasic,

  // For house keeping of all sold items(without sold flag set)
  // It should be called by cron/scheduler
  houseKeeping: oi.houseKeeping
}


