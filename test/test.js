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

  describe('#appendFilln', function() {
    it('should allow muliple successive calls to appendFill0', function() {
      var v1 = new CmpBitVec()
        , v2 = new CmpBitVec();

      v1.appendFill0(4);

      v2.appendFill0(2);
      v2.appendFill0(2);

      v1.toString().should.equal('xxxxxxxx xxxxxxxx xxxxxxxx xxxx0000', 'One call to appendFill0');
      v2.toString().should.equal(v2.toString(), 'two calls to appendFill0');
    });

    it('should allow muliple successive calls to appendFill1', function() {
      var v1 = new CmpBitVec()
        , v2 = new CmpBitVec();

      v1.appendFill1(4);

      v2.appendFill1(2);
      v2.appendFill1(2);

      v1.toString().should.equal('xxxxxxxx xxxxxxxx xxxxxxxx xxxx1111', 'One call to appendFill1');
      v2.toString().should.equal(v2.toString(), 'two calls to appendFill1');
    });

    it('should allow muliple successive calls to appendFill0 over word boundary', function() {
      var v1 = new CmpBitVec()
        , v2 = new CmpBitVec();

      v1.appendFill0(48);

      v2.appendFill0(24);
      v2.appendFill0(24);

      v1.toString().should.equal('00000000 00000000 00000000 00000000 xxxxxxxx xxxxxxxx 00000000 00000000', 'One call to appendFill0');
      v2.toString().should.equal(v2.toString(), 'two calls to appendFill0');
    });

    it('should allow muliple successive calls to appendFill1 over word boundary', function() {
      var v1 = new CmpBitVec()
        , v2 = new CmpBitVec();

      v1.appendFill1(48);

      v2.appendFill1(24);
      v2.appendFill1(24);

      v1.toString().should.equal('11111111 11111111 11111111 11111111 xxxxxxxx xxxxxxxx 11111111 11111111', 'One call to appendFill1');
      v2.toString().should.equal(v2.toString(), 'two calls to appendFill1');
    });
  });

  describe('#nextWord, #prevWord, #scan', function() {
    var v;
    beforeEach(function() {
      v = new CmpBitVec();
      v.appendFill1(64);
      v.appendFill0(48);
      v.appendFill1(32);
      v.begin();
    });
    
    it('should go to the next word', function() {
      v.activeWord.start.should.equal(0);
      v.nextWord();
      v.activeWord.start.should.equal(64);
      v.nextWord();
      v.activeWord.start.should.equal(96);
      v.nextWord();
    });

    it('activeWord should be sane after appendFill1', function() {
      var v = new CmpBitVec()
        , originalActiveWordStart;
      v.appendFill1(45);
      v.appendFill1(4);
      v.appendFill1(1);
      v.appendFill1(3);
      v.appendFill1(33);

      v.activeWord.start.should.lessThan(v.activeWord.end);
    });

    it('activeWord should be sane after appendFill0', function() {
      var v = new CmpBitVec()
        , originalActiveWordStart;
      v.appendFill0(45);
      v.appendFill0(4);
      v.appendFill0(1);
      v.appendFill0(3);
      v.appendFill0(33);

      v.activeWord.start.should.lessThan(v.activeWord.end);
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

    it('should work for compressed words of exactly 32 bits', function() {
      var v = new CmpBitVec();
      v.appendFill0(32);
      v.toString().should.equal('00000000 00000000 00000000 00000000');

      v.appendFill1(32);
      v.toString().should.equal('00000000 00000000 00000000 00000000 11111111 11111111 11111111 11111111');
    });

    it('should work for longer compressed words that are multiples of 32', function() {
      var v = new CmpBitVec();
      v.appendFill0(96);
      v.toString().should.equal('00000000 00000000 00000000 00000000 00000000 00000000 00000000 00000000 00000000 00000000 00000000 00000000');
    });

    it('should work for longer compressed words that are not multiples of 32', function() {
      var v = new CmpBitVec();
      v.appendFill1(33);
      v.toString().should.equal('11111111 11111111 11111111 11111111 xxxxxxxx xxxxxxxx xxxxxxxx xxxxxxx1');
    });

    it('should work for literal words', function() {
      var v = new CmpBitVec();
      v.appendFill0(3);
      v.appendFill1(4);
      v.appendFill0(1);
      v.appendFill1(3);
      v.toString().should.equal('xxxxxxxx xxxxxxxx xxxxx111 01111000');
    });

    it('should work with successive calls to toString with a single word', function() {
      var v = new CmpBitVec()
        , stringRep;
      v.appendFill0(3);
      v.appendFill1(4);
      v.appendFill0(1);
      v.appendFill1(3);
      stringRep = v.toString();

      stringRep.should.equal('xxxxxxxx xxxxxxxx xxxxx111 01111000');
      v.toString().should.equal(stringRep);
    });

    it('should work for combinations of compressed and then literal words', function() {
      var v = new CmpBitVec();
      v.appendFill1(45);
      v.appendFill0(4);
      v.appendFill0(1);
      v.appendFill1(3);
      v.toString().should.equal('11111111 11111111 11111111 11111111 xxxxxxxx xxx11100 00011111 11111111');
    });

    it('should work with successive calls to toString with >1 word', function() {
      var v = new CmpBitVec()
        , stringRep;
      v.appendFill1(45);
      v.appendFill0(4);
      v.appendFill0(1);
      v.appendFill1(3);
      stringRep = v.toString();

      stringRep.should.equal('11111111 11111111 11111111 11111111 xxxxxxxx xxx11100 00011111 11111111');
      v.toString().should.equal(stringRep);
    });

    it('should work for combinations of partially-filled literal and then compressed words', function() {
      var v = new CmpBitVec();
      v.appendFill1(1);
      v.appendFill0(1);
      v.appendFill1(96);
      v.toString().should.equal('11111111 11111111 11111111 11111101 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 xxxxxxxx xxxxxxxx xxxxxxxx xxxxxx11');
    });

    it('should refuse to print a string of more than 256 bits', function() {
      var v = new CmpBitVec();
      v.appendFill1(256);
      v.toString().should.equal('11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111');
      v.appendFill0(1);
      (function() { return v.toString() }).should.throwError('Bit vector too long for string representation. (This length restriction is arbitrary.)');
    });

    it('should preserve original activeWord', function() {
      // given
      var v = new CmpBitVec()
        , originalActiveWordStart;
      v.appendFill1(45);
      v.appendFill0(4);
      v.appendFill0(1);
      v.appendFill1(3);
      v.appendFill1(33);
      v.scan(46);
      originalActiveWordStart = v.activeWord.start;

      // when
      v.toString();

      // then
      v.activeWord.start.should.equal(originalActiveWordStart);
    });
  });

  describe('#saveToArrayBuffer, #loadFromArrayBuffer', function() {
    it('should save and load again without changing', function() {
      var v1 = new CmpBitVec();
      v1.appendFill1(45);
      v1.appendFill0(4);
      v1.appendFill0(1000);
      v1.appendFill1(3);
      v1.appendFill1(33);
      var v2 = new CmpBitVec();
      v2.loadFromArrayBuffer(v1.saveToArrayBuffer());
      v1.equals(v2).should.equal(true);
    });
  });

  describe("logical operations", function() {
    var v0, v1, v01, v10, vlit1, vlit2, v0first, v1first, vlong;
    beforeEach(function(){
      v0 = new CmpBitVec();
      v0.appendFill0(64);

      v1 = new CmpBitVec();
      v1.appendFill1(64);

      v01 = new CmpBitVec();
      v01.appendFill0(32);
      v01.appendFill1(32);

      v10 = new CmpBitVec();
      v10.appendFill1(32);
      v10.appendFill0(32);

      vlit1 = new CmpBitVec();
      vlit1.appendFill0(16);
      vlit1.appendFill1(32);
      vlit1.appendFill0(16);

      vlit2 = new CmpBitVec();
      vlit2.appendFill1(16);
      vlit2.appendFill0(32);
      vlit2.appendFill1(16);

      v0first = new CmpBitVec();
      v0first.appendFill0(1);
      v0first.appendFill1(63);

      v1first = new CmpBitVec();
      v1first.appendFill1(1);
      v1first.appendFill0(63);

      vlong = new CmpBitVec();
      vlong.appendFill1(65);
    });
    describe('#and', function() {
      it('should not work with null arguments', function() {
        (function() { v1.and(); }).should.throw('Second bit vector for binary operation is false-y or not a CmpBitVec instance');
      });
      it('should not work with non-CmpBitVec arguments', function() {
        (function() { v1.and(new Date()); }).should.throw('Second bit vector for binary operation is false-y or not a CmpBitVec instance');
        (function() { v1.and('sausage'); }).should.throw('Second bit vector for binary operation is false-y or not a CmpBitVec instance');
      });
      it('should not work with vectors of different length', function() {
        (function() { v1.and(vlong); }).should.throw('Bit vector length mismatch');
        (function() { vlong.and(v1); }).should.throw('Bit vector length mismatch');
      });
      it('should work for simple case', function() {
        v1.and(v1).toString().should.equal(v1.toString());
      });

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