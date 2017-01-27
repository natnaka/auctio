var mongoose = require('mongoose');

mongoose.Promise = global.Promise;

// Temporay
mongoose.connect('mongodb://localhost/try');

var fs       = require('fs');
var cat      = require('./category');

var Schema   = mongoose.Schema;

// Image section -----
var imgSizeThreshold = 400*1024;  // Max image size is 400 KBytes

function validImgSize(img) {
  return img.length < imgSizeThreshold;
}

function validContentType(t) {
  return ['jpg', 'png', 'jpeg', 'tif'].indexOf(t.toLowerCase()) >= 0;
}

var imgData = {type: Buffer, validate: [validImgSize, "Image size should not exceed 400KB"]};
var contentTypeData = {type: String, validate: [validContentType, "Support only jpg, png, and tif"]}

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
  expired_at: Date,

  // Auto-control field
  current_buyer: String,
  current_bid_price: Number,
  sold: {type: Boolean, default: false},

  // Bidding list
  bids: [BiddingSchema]
});

var OfferItem = mongoose.model('Offer_item', OfferItemSchema);

function filePathToImgObjs(files = [], callback=null) {
  var images = []

  files.forEach(function(pic) {
    var l = pic.split(".");
    images.push({
      data: fs.readFileSync(pic),
      content_type: l[l.length-1]
    });
  });

  if(callback) {
    callback(images);
  }
}

function offerItem(name, begin_price, category, expired_at, seller, options = {}, callback) {
  var brand = options.brand || undefined;
  var description = options.description || undefined;
  var pictures = options.pictures || [];

  var currency = options.currency || 'THB';  // TODO: get from some setting later
  var buy_out_price = options.buy_out_price || 0;
  var step_price = options.step_price || 1;

  var current_buyer = undefined;
  var current_bid_price = begin_price;
  var sold = false;

  // TODO: 
  var arrayOfPictures = [];
  var categoryArray   = [];
  
  cat.getCategoryPathArray(category, function(categories) {

    categoryArray = categoryArray.concat(categories);

    filePathToImgObjs(pictures, function(imgObjs) {
      
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
          callback(err, offerItem);
        }
      );
    });
  });
}

function uploadMoreImage(offerItemId, pictures = []) {
  var images = filePathToImgObjs(pictures);

  OfferItem.findOneAndUpdate(
    {_id: offerItemId}, 
    {$push: {pictures: {$each: images}}},
    function(err, offer) {
      if(err) return console.error(err);
    }
  );
}

function bidItem(offerItemId, price, buyer) {
  return new Promise(function(resolve, reject) {
    
    var bidTime = Date.now();
    
    var bid = {
      buyer: buyer,
      price: price,
      bid_at: bidTime,
    };

    // Trying buy out first
    OfferItem.findOneAndUpdate(
      {
        _id: offerItemId,
        sold: false,
        current_bid_price: {$lt: price},
        //buy_out_price: {$gt: 0},
        //buy_out_price: {$lte: price},
        buy_out_price: {$gt: 0, $lte: price},
        $or: [{expired_at: null}, {expired_at: {$gt: bidTime}}]
      },
      {
        $push: {bids: bid},
        current_buyer: buyer,
        current_bid_price: price,
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
        
        // Trying normal bidding
        OfferItem.findOneAndUpdate(
          {
            _id: offerItemId,
            sold: false,
            current_bid_price: {$lt: price},
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
      }
    );    
    
  }); // End Promise
}

module.exports = {
  offetItem: offerItem,
  uploadMoreImage: uploadMoreImage,
  bidItem: bidItem,
  
  testOffer: function() {
    var d = new Date(2017, 2, 1);
    //var d = Date.now();
    offerItem('Huawei P9', 12000,
      //'MobileDevice', 'natnaka', { pictures: ['/mnt/c/Users/natnaka/Pictures/me.jpg']},
      'MobileDevice', d, 'natnaka', {},
      function(err, data) {
        if(err) console.error(err);
        else console.log(data);
      }
    );
  },
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
