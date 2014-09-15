var MongoClient = require('mongodb').MongoClient
  , BSON = require('mongodb').BSONPure
  , assert = require('assert')
  , CmpBitVec = require('./CmpBitVec');

var v = new CmpBitVec();
v.appendFill0(10);
v.appendFill1(100);
v.appendFill0(10);
console.log(v.toString());
var buf = v.saveToArrayBuffer();
// console.log(buf);
var bsonbin = new BSON.Binary(new Buffer(new Uint8Array(buf)));
// console.log("bsonbin",bsonbin);

function toArrayBuffer(buffer) {
    var ab = new ArrayBuffer(buffer.length);
    var view = new Uint8Array(ab);
    for (var i = 0; i < buffer.length; ++i) {
        view[i] = buffer[i];
    }
    return ab;
}

// Connect using the connection string
MongoClient.connect("mongodb://localhost:27017/test", function(err, db) {
  assert.equal(null, err);
  db.collection('bvec', function(err,collection) {
    collection.remove(function(err, result) {
      collection.insert({'binary':bsonbin}, function(err, doc) {
        collection.findOne(function(err, document) {
          var v2 = new CmpBitVec();
          v2.loadFromArrayBuffer(toArrayBuffer(document.binary.buffer));
          console.log(v2.toString());
          collection.remove(function(err, collection) {
            db.close();
          });
        });
      });
    });
  });
});
