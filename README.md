# Auctio
Auction module written in node.js with Mongodb(mongoose)

# Prerequisite
  - npm:       https://www.npmjs.com/
  - node.js:   https://nodejs.org/en/download/
  - MongoDB:   https://docs.mongodb.com/manual/installation/
  - mongoose:  npm install mongoose

# Basic Example
  i. Including Auctio
```javascript
    var auctio = require('/path-to-auctio/index');
```
  i. Initialize Auctio
```javascript
    auctio.initialize('mongodb://host-information/<db name>').then(init_succes_callback, init_failed_callback);
```
  i. How to add category
```javascript
    // Category hierarchy help us to search item by category name
    // Add xxx at top root level
    auctio.addCategory("xxx");

    // Add aaa under xxx
    auctio.addCategory("aaa", {parentName: "xxx"});

    // Add bbb under aaa
    auctio.addCategory("bbb", {parentName: "aaa"});

    // Add yyy under xxx
    auctio.addCategory("yyy", {parentName: "xxx"});

    // Add zzz under yyy
    auctio.addCategory("zzz", {parentName: "yyy"});
```

  i. How to remove category (and its children)
```javascript
    // Remove aaa and its child, bbb
    auctio.removeCategory("aaa");
```

  i. How to offer(sell) item
```javascript
    var expired_at = new Date();
    expired_at.setDate(expired_at.getDate() + 7); // Expired at next 7 days
    auctio.offerItem('Item Name', 2000, 'zzz', expired_at, "seller's username/token", {buy_out_price: 10000, step_price: 100, brand: 'brand name'})
          .then(offer_success_callback, offer_failed_callback);
```
  i. How to bid(buy) item
```javascript
    auctio.bidItem(ObjectId("..."), 4000, "buyer's username/token")
          .then(bid_success_callback, bid_failed_callback);
```

  i. How to call house-keeping for finishing sold item (already expired with bidding, buy-out with stepped bidding)
```javascript
    // This function should be cron/scheduler task
    // It set sold flag for some situations of offered item that has been sold
    //  - expired with bidding
    //  - Bidding price reach buy-out price with auto step price bidding
    // You can pass datetime argument or let the function picking default current datetime
    var keeping_datetime = new Date;
    auctio.houseKeeping(keeping_datetime).then(success_keeping_callback, failed_keeping_callback);
```

  i. How to query items
```javascript
    // Searching all item under xxx category
    auctio.searchItemBasic({category: "xxx"});

    // Searching all sold item under zzz category
    auctio.searchItemBasic({sold: true, category: "xxx"});

    // Searching for item with starting price between 1000 and 5000
    auctio.searchItemBasic({begin_range: [1000, 5000]});

    // Searching for item without buy out price
    auctio.searchItemBasic({buy_out: false});

    // For more searching criteria, please see reference below
```

  i. Terminate Auctio
```javascript
    terminate_success_callback = function(result) {
      // Do somethings
    }

    terminate_failed_callback = function(error) {
      // Do somethings
    }

    auctio.terminate().then(terminate_succes_callback, terminate_failed_callback);
```

# References
  * ## initialize
    - ### Argument
        - #### db_uri:
            URI string for connecting to MongoDB (e.g., mongodb://localhost/db_name) (see [Mongoose Connection](http://mongoosejs.com/docs/connections.html))
        - #### db_options:
            Options hash for MongoDB connection parameter (see [Mongoose Connection](http://mongoosejs.com/docs/connections.html))
        - #### options:
            Options hash for Auctio configuration
            - __currency_code__:
                Currencty code (Currently unused), default 'THB'
            - __max_watch_list__:
                Maximum number of item watch list (Currently unused), default 5
            - __max_bid_count__:
                Maximum number of concurrent bidding per user (Currently unused), default 5
            - __max_offer_count__:
                Maximum number of concurrent offering per user (Currently unused), default 5
            - __default_duration__:
                Default expired duration for offered item, default 3 days
            - __image_size__:
                Maximum allowed image size, default 200KBytes
            - __max_image_coount__:
                Maximum number of images per item, default 5
            - __image_type__:
                Allowed image types, default jpg and png
            - __step_price__:
                Default stepping price when bidding with auto step price, default 1
    - ### Return Value
        - #### On success:
          Return Promise with resolved value = true
        - #### On failure:
          Return Promise with rejected reason string/error

  * ## terminate
    - ### Return Value
        Return Promise with resolved value = true

  * ### addCategory
    - ### Argument
        - #### name:
            Category name string
        - #### options:
            - __parentName__:
                Name of parent category
            - __description__:
                Description message
    - ### Return Value
        - #### On success:
          Return Promise with resolved value = created category object
        - #### On failure:
          Return Promise with rejected reason string/error

  * ### removeCategory
    - ### Argument
        - #### name:
            Category name to be removed
    - ### Return Value
        - #### On success:
          Return Promise with resolved value = true
        - #### On failure:
          Return Promise with rejected reason string/error

  * ### offerItem
    - ### Argument
        - #### name:
            String name of item to be offered
        - #### begin_price:
            Starting price for offered item
        - #### category:
            Category name of an item
        - #### expired_at:
            Datetime when offered item will be expired
        - #### seller:
            String name/token of user who offer an item
        - #### options:
            - __brand__:
                Item brand name
            - __description__:
                Item description
            - __pictures__:
                Array of picture file paths to be uploaded
            - __currency__:
                Currency code for current item price
            - __buy_out_price__:
                Offered price for instantly buy out
            - __step_price__:
                Stepping price for auto price bidding
    - ### Return Value
        - #### On success:
          Return Promise with resolved value = offered item object
        - #### On failure:
          Return Promise with rejected reason string/error

  * ### bidItem
    - ### Argument
        - #### offerItemId:
            An ObjectId of offered item
        - #### price:
            Amount of price for bidding, 0 for auto pricing
        - #### buyer:
            String name/token of user who bid an item
    - ### Return Value
        - #### On success:
          Return Promise with resolved value = offered item ObjectId
        - #### On failure:
          Return Promise with rejected reason string/error

  * ### searchItemBasic
    - ### Argument
        - #### options:
            - __limit__:
                Limited number of item from searching
            - __offset__:
                Starting offset of searching results
            - __id__:
                Searching by specify ObjectId
            - __category__:
                Searching by specify category
            - __name__:
                Searching by specify item name
            - __brand__:
                Searching by specify item brand name
            - __seller__:
                Searching by specify item seller
            - __bid_range__:
                Searching by specify range of current bid price [min, max], both are inclusive, 0 mean open ended
            - __begin_range__:
                Searching by specify range of starting offered price [min, max], both are inclusive, 0 mean open ended
            - __buy_out_range__:
                Searching by specify range of buy out price [min, max], both are inclusive, 0 mean open ended
            - __buy_out__:
                Flag to tell whether including item with buy out price or not, if specify __buy_out_range__, this flag is aut set
            - __sold__:
                Flag to tell whether including sold item or not
            -__omits__:
                Array of omitted field names
            -__sort__:
                Hash of sorted fields (e.g., {buy_out_price: -1, name: 1} mean sorted by buy_out_price descending and by name ascending)
    - ### Return Value
        - #### On success:
          Return Promise with resolved value = array of items
        - #### On failure:
          Return Promise with rejected reason string/error

# Contact
    If you have any suggestions, please email to me (natnaka@gmail.com)
