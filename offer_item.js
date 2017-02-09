var mongoose = require('mongoose');

mongoose.Promise = global.Promise;

// Temporary
//mongoose.connect('mongodb://localhost/try');

var fs       = require('fs');
var cat      = require('./category');

var Schema   = mongoose.Schema;

// Image section -----
//var imgSizeThreshold = 400*1024;  // Max image size is 400 KBytes

function validImgSize(img) {
  return img.length < global.auctioConfig.image_size;
}

function validContentType(t) {
  return global.auctioConfig.image_type.indexOf(t.toLowerCase()) >= 0;
}

function validExpiredAt(e) {
  var d = new Date();
  return e && e > d;
}

//var imgData = {type: Buffer, validate: [validImgSize, "Image size should not exceed "+global.auctioConfig.image_size/1024+"KBytes"]};
//var contentTypeData = {type: String, validate: [validContentType, "Support only "+global.auctioConfig.image_type]}
var imgData = {type: Buffer, validate: validImgSize};
var contentTypeData = {type: String, validate: validContentType};

var ImageSchema = new  Schema({
  data: imgData,
  content_type: contentTypeData,
});

var BiddingSchema = new Schema({
  buyer: String,          // Firstly, using name or string token represent selling user
  price: Number,
  bid_at: Date,
});

var OfferItemSchema = new Schema({
  // Product Item information
  name: String,
  brand: String,
  description: String,
  seller: String,         // Firstly, using name or string token represent selling user
  category: [String],
  pictures: [ImageSchema],
  posted_at: {type: Date, default: Date.now},

  // Sell rules
  currency: String,
  begin_price: Number,
  buy_out_price: Number,
  step_price: {type: Number, default: 1},
  //expired_at: Date,
  expired_at: {type: Date, validate: [validExpiredAt, "Value of expired_at should be specified and it must be in a future"]},

  // Auto-control field
  current_buyer: String,
  current_bid_price: Number,
  sold: {type: Boolean, default: false},

  // Bidding list
  bids: [BiddingSchema]
});

var OfferItem = mongoose.model('Offer_item', OfferItemSchema);

function filePathToImgObjs(files = []) {
  return new Promise(function(resolve, reject) {
    var images = []

    files.forEach(function(pic) {
      var l = pic.split(".");
      images.push({
        data: fs.readFileSync(pic),
        content_type: l[l.length-1]
      });
    });

    resolve(images);
  });
}

//----------------------------------------------
// For publishing offered item
//----------------------------------------------
function offerItem(name, begin_price, category, expired_at, seller, options = {}) {
  return new Promise(function(resolve, reject) {
    var brand = options.brand || undefined;
    var description = options.description || undefined;
    var pictures = options.pictures || [];

    var currency = options.currency || global.auctioConfig.currency_code;
    var buy_out_price = options.buy_out_price || 0;
    var step_price = options.step_price || global.auctioConfig.step_price;

    var current_buyer = undefined;
    var current_bid_price = begin_price;
    var sold = false;

    var arrayOfPictures = [];
    var categoryArray   = [];

    // default expiry duration
    if(!expired_at) {
      expired_at = new Date();
      expired_at.setDate(expired_at.getDate() + global.auctioConfig.default_duration);
    }

    if(buy_out_price && buy_out_price > 0) {
      if(buy_out_price < begin_price) {
        return reject("Buy out price must be greater than begin price");
      }

      var diff_price = buy_out_price - begin_price;
      if(diff_price%step_price != 0) {
        return reject("Buy out price must be aligned to step price");
      }
    }
    
    cat.getCategoryPathArray(category).then(function(categories) {

      categoryArray = categoryArray.concat(categories);

      filePathToImgObjs(pictures).then(function(imgObjs) {
        arrayOfPictures = arrayOfPictures.concat(imgObjs);

        OfferItem.create(
          {
            // General  information
            name: name,
            brand: brand,
            description: description,
            seller: seller,
            category: categoryArray,
            pictures: arrayOfPictures,

            // Selling information
            currency: currency,
            begin_price: begin_price,
            buy_out_price: buy_out_price,
            step_price: step_price,
            expired_at: expired_at,

            // Bidding information
            current_buyer: current_buyer,
            current_bid_price: current_bid_price,
            sold: false,
            bids: []
          },
          function(err, offerItem) {
            if(err) reject(err);
            else resolve(offerItem);
          }
        );
      }, function(err){
        reject(err);
      }); // then filePathToImgObjs

    }, function(error) {
      reject(error);
    }); // then getCategoryPathArray

  }); // Promise
}

//----------------------------------------------
// For uploading image to selected offered item
//----------------------------------------------
function uploadMoreImage(offerItemId, pictures = []) {
  return Promise(function(resolve, reject) {
    filePathToImgObjs(pictures).then(function(images) {
      OfferItem.findOneAndUpdate(
        {_id: offerItemId}, 
        {$push: {pictures: {$each: images}}},
        function(err, offer) {
          if(err) reject(err);
          else resolve(offer);
        }
      );
    }); // then filePathToImgObjs
  }); // Promise
}

//----------------------------------------------
// For bidding selected item
//----------------------------------------------
function bidItem(offerItemId, price, buyer) {
  return new Promise(function(resolve, reject) {
    
    var bidTime = new Date();
    
    var bid = {
      buyer: buyer,
      price: price,
      bid_at: bidTime,
    };

    OfferItem.findOne({_id: offerItemId}, function(err, item) {
      if(err) return reject(err);

      if(item.sold) {
        return reject("This item has been sold");
      }

      if(item.current_buyer && item.buy_out_price > 0 && item.current_bid_price >= item.buy_out_price && item.sold == false) {
        item.sold = true;
        item.save(function(err) {
          if(err) return reject(err);
          return reject("This item has been sold");
        });
        return;
      }

      if(item.buy_out_price > 0 && price >= item.buy_out_price) {
        // Trying buy out first
        OfferItem.findOneAndUpdate(
          {
            _id: offerItemId,
            sold: false,
            current_bid_price: {$lte: price},
            buy_out_price: {$gt: 0, $lte: price},
            $or: [{expired_at: null}, {expired_at: {$gt: bidTime}}]
          },
          {
            $push: {bids: bid},
            current_buyer: buyer,
            current_bid_price: item.buy_out_price,  // buy with buy_out_price, no matter what bid price
            sold: true,
          },
          function(err, offerItem) {
            if(err) {
              reject(err);
              return;
            }
            if (offerItem) {
              resolve(offerItem._id);
              return;
            }
            reject("Cannot buy out current item("+item.name+")");
          }
        );    
      } else {
        if(price > 0) {//price = item.current_bid_price + item.step_price;
          // Buyer defined price
          var diff_price = price - item.begin_price;
          
          if(diff_price > 0 && diff_price%item.step_price != 0) {
            reject("Price("+price+") was not aligned to step price value("+item.step_price+")");
            return;
          }

          OfferItem.findOneAndUpdate(
            {
              _id: offerItemId,
              sold: false,
              current_bid_price: {$lt: price},
              $or: [{buy_out_price: 0}, {current_bid_price: {$lt: item.buy_out_price}}],
              $or: [{expired_at: null}, {expired_at: {$gt: bidTime}}]
            },
            {
              $push: {bids: bid},
              current_buyer: buyer,
              current_bid_price: price,
              sold: false,
            },         
            function(err, oi) {
               if(err) reject(err);
               else {
                if(oi) resolve(oi._id);
                else reject("Cannot bid for this item")
               }
            }
          );
        } else if(price == 0){
          // Let's Auctio up price one step
          OfferItem.findOneAndUpdate(
            {
              _id: offerItemId,
              sold: false,
              //current_bid_price: {$lt: price},
              $or: [{buy_out_price: 0}, {current_bid_price: {$lt: item.buy_out_price}}],
              $or: [{expired_at: null}, {expired_at: {$gt: bidTime}}]
            },
            {
              $push: {bids: bid},
              current_buyer: buyer,
              //current_bid_price: price,
              $inc: {current_bid_price: item.step_price},
              sold: false,
            },         
            function(err, oi) {
               if(err) reject(err);
               else {
                if(oi) resolve(oi._id);
                else reject("Cannot bid for this item")
               }
            }
          );
        } else {
          reject("Invalid price");
        }
      } // check if price >= item.buy_out_price
    }); // End findOne
  }); // End Promise
}

//----------------------------------------------
// For searching item in offer_items collection
//----------------------------------------------
function searchItemBasic(options = {}) {
  return new Promise(function(resolve, reject) {
    var limit = options.limit || 20;   // limit number
    var offset = options.offset || 0; // skip count

    var id = options.id; // search by _id
    var category = options.category; // search from category
    var name = options.name; // search from name
    var brand = options.brand; // search from brand
    var seller = options.seller; // search from seller
    var bid_range = options.bid_range; // [min, max], range of current bid price
    var begin_range = options.begin_range; // [min, max], range of current bid price
    var buy_out_range = options.buy_out_range;
    var buy_out = options.buy_out;
    var sold = options.sold;

    var sort = options.sort;
    var omits = options.omits || [];

    var criterias = {};
    var fields    = {};
    var controls  = {};

    // Building criterias -----
    if(id) criterias._id = id;
    if(category) criterias.category = category;
    if(name) criterias.name = name;
    if(brand) criterias.brand = brand;
    if(seller) criterias.seller = seller;

    // For current_bid_price
    if(bid_range) {
      if(bid_range[1] > 0 && bid_range[0] > bid_range[1]) {
        return reject("Invalid bid price range min("+bid_range[0]+") and max("+bid_range[1]+")");
      }

      if(bid_range[0] > 0 || bid_range[1] > 0) {
        criterias.current_bid_price = {};
        if(bid_range[0] > 0) {
          criterias.current_bid_price.$gte = bid_range[0];
        }
        if(bid_range[1] > 0) {
          criterias.current_bid_price.$lte = bid_range[1];
        }
      }
    }

    // For begin_price
    if(begin_range) {
      if(begin_range[1] > 0 && begin_range[0] > begin_range[1]) {
        return reject("Invalid begin price range min("+begin_range[0]+") and max("+begin_range[1]+")");
      }

      if(begin_range[0] > 0 || begin_range[1] > 0) {
        criterias.begin_price = {};
        if(begin_range[0] > 0) {
          criterias.begin_price.$gte = begin_range[0];
        }
        if(begin_range[1] > 0) {
          criterias.begin_price.$lte = begin_range[1];
        }
      }
    }

    // For buy_out_price override buy_out flag
    if(buy_out_range) {
      if(buy_out_range[1] > 0 && buy_out_range[0] > buy_out_range[1]) {
        return reject("Invalid buy out price range min("+buy_out_range[0]+") and max("+buy_out_range[1]+")");
      }

      if(buy_out_range[0] > 0 || buy_out_range[1] > 0) {
        buy_out = true;
        criterias.buy_out_price = {};
        if(buy_out_range[0] > 0) {
          criterias.buy_out_price.$gte = buy_out_range[0];
        }
        if(buy_out_range[1] > 0) {
          criterias.buy_out_price.$lte = buy_out_range[1];
        }
      }
    }

    if(buy_out == true) {
      // Only buy out items
      if(!criterias.buy_out_price) {
        criterias.buy_out_price = {$gt: 0}
      }
    } else if(buy_out == false) {
      // Item without buy out
      criterias.buy_out_price = null;
    }

    if(sold != undefined) {
      if(sold == true) {
        criterias.sold = true;
      } else {
        criterias.sold = false;
      }
    }

    // Building field displays
    omits.forEach(function(f) {
      fields[f] = 0;
    });

    // Building controls -----
    if(limit) {
      controls.limit = limit;
    }
    if(offset && offset > 0) {
      controls.skip = offset;
    }
    if(sort) {
      controls.sort = sort;
    }

    //console.log(criterias);
    //console.log(controls);
    
    OfferItem.find(criterias, fields, controls, function(err, offer_items) {
      if(err) return reject(err);
      resolve(offer_items);
    });
  });
}

//----------------------------------------------
// For set flag sold = true when item was sold
//  - item has expired with bidding.
//  - item has been bidded with step price and
//    the price is a final price.
// This function should be called by cron/scheduler
//----------------------------------------------
function houseKeeping(datetime = new Date()) {
  return new Promise(function(resolve, reject) {
    // Process all items that expired with bidding
    OfferItem.update({
      sold: false,                  // Not set sold flag yet
      expired_at: {$lte: datetime}, // Already expired
      current_buyer: {$ne: null},   // There is bidder
    }, {
      $set: {sold: true}            // Set sold flag = true
    }, function(err, items) {
      if(err) return reject(err);

      // Process all items that bid price reach buy out price
      OfferItem.where({sold: false})
               .$where("this.current_bid_price >= this.buy_out_price")
               .update({$set: {sold: true}})
               .exec(function(error, result) {
        if(error) return reject(error);
        resolve(true);
      });
    });
  });
}

module.exports = {
  OfferItem: OfferItem,   // Collection
  offerItem: offerItem,
  uploadMoreImage: uploadMoreImage,
  bidItem: bidItem,
  searchItemBasic: searchItemBasic,
  houseKeeping: houseKeeping,
  
  // Test
  testOffer: function() {
    //var d = new Date(2017, 2, 1);
    var d = new Date();
    d.setDate(d.getDate() + 3); // Assume expired in 3 days
    offerItem('Huawei P9', 12000,
      //'MobileDevice', 'natnaka', { pictures: ['/mnt/c/Users/natnaka/Pictures/me.jpg']},
      'MobileDevice', d, 'natnaka',
      {
        buy_out_price: 20000
      }
    ).then(function(offer) {
      console.log(offer);
    }, function(err) {
      console.error(err);
    });
  },

  // Test
  testBid: function(price, buyer) {
    var item_id = null;
    console.log(price);
    console.log(buyer);
    OfferItem.find({seller: 'natnaka'}).then(function(offeritems) {
      console.log(offeritems);
      
      item_id = offeritems[0]._id;
      
      console.log(item_id);
      
      bidItem(item_id, price, buyer).then(function(result) {
        console.log("Result ok " + result);
      }, function(err) {
        console.log(err);
      });
    },function(error) {
      console.log(error);
    });
  }
}
