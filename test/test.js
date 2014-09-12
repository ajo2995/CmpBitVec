var CmpBitVec = require('../CmpBitVec')
  , should = require('should');

describe('CmpBitVec', function () {
  describe('constructor', function () {
    it('should initialize with no args in correct state', function () {
      var v = new CmpBitVec();
      should.exist(v);
      v.should.have.property('words').with.lengthOf(0);
      v.should.have.property('fills').with.lengthOf(0);
    });
  });

  describe('#ctz', function () {
    it('should count the correct number of trailing zero bits', function () {
      var v = new CmpBitVec();
      v.ctz(1).should.equal(0);
      v.ctz(2).should.equal(1);
      v.ctz(Math.pow(2, 7)).should.equal(7);
      v.ctz(2147482624).should.equal(10);
      v.ctz(0x80000000).should.equal(31);
      v.ctz(0x800000000).should.equal(32);
      v.ctz(0).should.equal(32);
      v.ctz(-0).should.equal(32);
      v.ctz(0x0).should.equal(32);
    });
  });

  describe('#popcount', function () {
    it('should correctly count the number of set bits', function () {
      var v = new CmpBitVec();
      var twoToTheEight = Math.pow(2, 8);
      v.popcount(0).should.equal(0);
      v.popcount(-0).should.equal(0);
      v.popcount(1).should.equal(1);
      v.popcount(-1).should.equal(32);
      v.popcount(twoToTheEight).should.equal(1);
      v.popcount(twoToTheEight - 1).should.equal(8);
    });

    it('should overflow with large numbers', function () {
      var v = new CmpBitVec();
      var twoToTheFourtyThirdPower = Math.pow(2, 43);
      v.popcount(twoToTheFourtyThirdPower).should.equal(0);
      v.popcount(twoToTheFourtyThirdPower - 1).should.equal(32);
    });
  });

  describe('#nextSetBitInclusive', function () {
    it('should work with uncompressed small bitset', function () {
      var v = new CmpBitVec();
      v.appendFill0(10);
      v.appendFill1(21);
      v.appendFill0(1);
      console.log(v);
      v.begin();
      console.log(v);

      v.nextSetBitInclusive().should.equal(10);
      v.nextSetBitInclusive(0).should.equal(10);
      v.nextSetBitInclusive(2).should.equal(10);
      v.nextSetBitInclusive(10).should.equal(10);
      v.nextSetBitInclusive(11).should.equal(11);
      v.nextSetBitInclusive(30).should.equal(30);
      v.nextSetBitInclusive(31).should.equal(-1);
      v.nextSetBitInclusive(32).should.equal(-1);
      v.nextSetBitInclusive(-1).should.equal(-1);
    });

    it('should work with compressed bitset', function () {
      var v = new CmpBitVec();
      v.appendFill0(100);
      v.appendFill1(21000);
      v.appendFill0(10);
      v.begin();

      v.nextSetBitInclusive().should.equal(100);
      v.nextSetBitInclusive(0).should.equal(100);
      v.nextSetBitInclusive(2).should.equal(100);
      v.nextSetBitInclusive(100).should.equal(100);
      v.nextSetBitInclusive(101).should.equal(101);
      v.nextSetBitInclusive(20999).should.equal(20999);
      v.nextSetBitInclusive(21000).should.equal(21000);
      v.nextSetBitInclusive(21001).should.equal(21001);
      v.nextSetBitInclusive(-1).should.equal(-1);
    });
  });

  describe('#toString', function() {
    it('should return "<empty>" for an empty bit vector', function() {
      var v = new CmpBitVec();
      v.toString().should.equal('<empty>');
    });

    it('should work for compressed words', function() {
      var v = new CmpBitVec();
      v.appendFill0(32);
      v.toString().should.equal('00000000 00000000 00000000 00000000');

      v.appendFill1(32);
      v.toString().should.equal('00000000 00000000 00000000 00000000 11111111 11111111 11111111 11111111');
    });

    it('should work for literal words', function() {
      var v = new CmpBitVec();
      v.appendFill0(3);
      v.appendFill1(4);
      v.appendFill0(1);
      v.appendFill1(3);
      v.toString().should.equal('00000000 00000000 00000111 01111000');
    });

    it('should work for combinations of compressed and literal words', function() {
      var v = new CmpBitVec();
      v.appendFill1(45);
      v.appendFill0(4);
      v.appendFill0(1);
      v.appendFill1(3);
      v.toString().should.equal('11111111 11111111 11111111 11111111 00000000 00011100 00011111 11111111');
    });

    it('should refuse to print a string of more than 128 bits', function() {
      var v = new CmpBitVec();
      v.appendFill1(128);
      v.toString().should.equal('11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111');
      v.appendFill0(1);
      v.toString().should.throwError();
    })
  })
});


/*
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
 */