// var Db = require('mongodb').Db,
//     MongoClient = require('mongodb').MongoClient,
//     Server = require('mongodb').Server,
//     ReplSetServers = require('mongodb').ReplSetServers,
//     ObjectID = require('mongodb').ObjectID,
//     Binary = require('mongodb').Binary,
//     GridStore = require('mongodb').GridStore,
//     Grid = require('mongodb').Grid,
//     Code = require('mongodb').Code,
//     BSON = require('mongodb').pure().BSON,
// var     assert = require('assert');
// var MongoClient = require('mongodb').MongoClient;
var CmpBitVec = require('./CmpBitVec');
var v1 = new CmpBitVec();
v1.appendFill1(100);
v1.appendFill0(100);
console.log("v1",v1);
var v2 = new CmpBitVec();
v2.appendFill0(50);
v2.appendFill1(150);
v2.appendFill0(50);
console.log("v2", v2);
var v3 = v1.or(v2);
v3.unpack();
console.log("v1.or(v2)",v3);
var v4 = new CmpBitVec();
v4.appendFill1(200);
v4.appendFill0(50);
console.log("correct or",v4);
v3 = v1.and(v2);
v3.unpack();
console.log("v1.and(v2)",v3);
var v5 = new CmpBitVec();
v5.appendFill0(50);
v5.appendFill1(50);
v5.appendFill0(150);
console.log("correct and",v5);

  // // Connect using the connection string
  // MongoClient.connect("mongodb://localhost:27017/test", {native_parser:true}, function(err, db) {
  //   assert.equal(null, err);
  // 
  //   db.collection('bvec').update({a:1}, {b:1}, {upsert:true}, function(err, result) {
  //     assert.equal(null, err);
  //     assert.equal(1, result);
  // 
  //     db.close();
  //   });
  // });