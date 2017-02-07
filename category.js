var mongoose = require('mongoose');

// Temporary
//mongoose.connect('mongodb://localhost/try');

var CategorySchema = new mongoose.Schema({
  name: String,
  //parentName: String,
  description: String,
  parents: [String],
  children: [String],
})

var Category = mongoose.model('Category', CategorySchema);

module.exports = {
  addNewCategory: function(name, options = {}) {
    return new Promise(function(resolve, reject) {
      //var parentName = options.parentName !== undefined ? options.parentName : undefined;
      //var desc = options.parentName !== undefined ? options.parentName : undefined;
      var parentName = options.parentName || null;
      var desc = options.description || null;

      // Validate name
      if(typeof(name) == "string")  {
        name = name.trim();
        if(name.length == 0) {
          reject("Name cannot be blank");
          return;
        }

      } else {
        reject("Name argument must be string");
        return;
      }

      Category.find({name: name}, function(err, data) {
        if(err) {
          return reject(err);
        }
        if(data && data.length > 0) {
          reject("Found category name '"+ name + "' entry, Skip adding category");
          return;
        }

        // Validate parent name string
        if(typeof(parentName) == "string")  {
          parentName = parentName.trim();
          if(parentName.length == 0) parentName = null;
        } else {
          parentName = null;
        }
        // Validate description string
        if(typeof(desc) == "string")  {
          desc = desc.trim();
          if(desc.length == 0) desc = null;
        } else {
          desc = null;
        }

        //console.log('name ' + name);
        //console.log('parentName ' + parentName);
        //console.log('description ' + desc);

        if(parentName)  { // If parent name exists
          Category.findOneAndUpdate(
            {name: parentName},
            {$push: {children: name}},
            function(err, category) {
              if(err) return reject(err);

              if(category) {
                Category.create(
                  {
                    name: name,
                    //parentName: parentName,
                    parents: category.parents.concat([parentName]),
                    description: desc,
                    children: []
                  },
                  function(err, data) {
                    if(err) reject(err);
                    else resolve(data);
                  }
                );
              } else {
                reject("Cannot find parent, skip adding");
              }
            }
          );
        } else {          // If no parent name
          Category.create(
            {
              name: name,
              //parentName: parentName,
              parents: [],
              description: desc,
              children: []
            },
            function(err, data) {
              if(err) reject(err);
              else resolve(data);
            }
          );
        }
      });
    }); // Promise
  }, // End addNewCategory

  removeCategory: function(name) {
    return new Promise(function(resolve, reject) {
      Category.find({name: name}, function(err, data) {
        if(err) return reject(err);
        if(data.length <= 0) {
          return resolve(true);
        }

        var parents = data[0].parents;
        var parentName = null;
        if(parents.length > 0) {
          var last    = -1;
          last = parents.length - 1;
          parentName = parents[last];
        }

        if(parentName) {
          Category.update({name: parentName},
                          {$pull: {children: name}},
                          function(err, category) {
            if(err) return reject(err);
          });
        }

        Category.remove({name: name}, function(err) {
          if(err) return reject(err);

          Category.remove({parents: name}, function(err) {
            if(err) reject(err);
            else resolve(true);
          });
        });
      });
    }); // Promise
  }, // End removeCategory
  
  getCategoryPathArray: function(name) {
    return new Promise(function(resolve, reject) {
      Category.find({name: name}, function(err, categories) {
        if(err) {
          //console.error(err);
          reject(err);
          return;
        }
        if(categories.length <= 0) return;
        var l =[];
        l = l.concat(categories[0].parents);
        l.push(categories[0].name);
        resolve(l);
      });
    }); // Promise
  } // End getCategoryPathArray
}
