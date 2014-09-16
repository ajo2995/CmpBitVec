var CmpBitVec = require('../CmpBitVec')
  , should = require('should');

describe('CmpBitVec', function () {
  var v, v2, v0, v1, v01, v10, vlit1, vlit2, v0first, v1first, vlong, vscan;
  beforeEach(function(){
    v = new CmpBitVec();
    v.toString().should.equal('<empty>');

    v2 = new CmpBitVec();
    v.equals(v2).should.equal(true);

    v0 = new CmpBitVec();
    v0.appendFill0(64);
    v0.toString().should.equal('00000000 00000000 00000000 00000000 00000000 00000000 00000000 00000000');

    v1 = new CmpBitVec();
    v1.appendFill1(64);
    v1.toString().should.equal('11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111');

    v01 = new CmpBitVec();
    v01.appendFill0(32);
    v01.appendFill1(32);
    v01.toString().should.equal('00000000 00000000 00000000 00000000 11111111 11111111 11111111 11111111');

    v10 = new CmpBitVec();
    v10.appendFill1(32);
    v10.appendFill0(32);
    v10.toString().should.equal('11111111 11111111 11111111 11111111 00000000 00000000 00000000 00000000');

    vlit1 = new CmpBitVec();
    vlit1.appendFill0(16);
    vlit1.appendFill1(32);
    vlit1.appendFill0(16);
    // NB this looks counter-intuitive due to little-endian bit order
    vlit1.toString().should.equal('11111111 11111111 00000000 00000000 00000000 00000000 11111111 11111111');

    vlit2 = new CmpBitVec();
    vlit2.appendFill1(16);
    vlit2.appendFill0(32);
    vlit2.appendFill1(16);
    vlit2.toString().should.equal('00000000 00000000 11111111 11111111 11111111 11111111 00000000 00000000');

    v0first = new CmpBitVec();
    v0first.appendFill0(1);
    v0first.appendFill1(63);
    v0first.toString().should.equal('11111111 11111111 11111111 11111110 11111111 11111111 11111111 11111111');

    v1first = new CmpBitVec();
    v1first.appendFill1(1);
    v1first.appendFill0(63);
    v1first.toString().should.equal('00000000 00000000 00000000 00000001 00000000 00000000 00000000 00000000');

    vlong = new CmpBitVec();
    vlong.appendFill1(65);
    vlong.toString().should.equal('11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 xxxxxxxx xxxxxxxx xxxxxxxx xxxxxxx1');

    vscan = new CmpBitVec();
    vscan.appendFill1(64);
    vscan.appendFill0(48);
    vscan.appendFill1(32);
    vscan.begin();
  });
  describe('constructor', function () {
    it('should initialize with no args in correct state', function () {
      v.should.have.property('words').with.lengthOf(0);
      v.should.have.property('fills').with.lengthOf(0);
    });
  });

  describe('#ctz', function () {
    it('should count the correct number of trailing zero bits', function () {
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
      var twoToTheEight = Math.pow(2, 8);
      v.popcount(0).should.equal(0);
      v.popcount(-0).should.equal(0);
      v.popcount(1).should.equal(1);
      v.popcount(-1).should.equal(32);
      v.popcount(twoToTheEight).should.equal(1);
      v.popcount(twoToTheEight - 1).should.equal(8);
    });

    it('should overflow with large numbers', function () {
      var twoToTheFourtyThirdPower = Math.pow(2, 43);
      v.popcount(twoToTheFourtyThirdPower).should.equal(0);
      v.popcount(twoToTheFourtyThirdPower - 1).should.equal(32);
    });
  });

  describe('#appendFilln', function() {
    it('should fail on packed CmpBitVec', function() {
      v0.pack();
      (function() {v0.appendFill0(12);} ).should.throw('Call unpack() on a packed bit vector before attempting to modify it');
      (function() {v0.appendFill1(12);} ).should.throw('Call unpack() on a packed bit vector before attempting to modify it');
    });

    it('should allow muliple successive calls to appendFill0', function() {
      v.appendFill0(4);

      v2.appendFill0(2);
      v2.appendFill0(2);

      v.toString().should.equal('xxxxxxxx xxxxxxxx xxxxxxxx xxxx0000', 'One call to appendFill0');
      v2.toString().should.equal(v2.toString(), 'two calls to appendFill0');
    });

    it('should allow muliple successive calls to appendFill1', function() {
      v.appendFill1(4);

      v2.appendFill1(2);
      v2.appendFill1(2);

      v.toString().should.equal('xxxxxxxx xxxxxxxx xxxxxxxx xxxx1111', 'One call to appendFill1');
      v2.toString().should.equal(v2.toString(), 'two calls to appendFill1');
    });

    it('should allow muliple successive calls to appendFill0 over word boundary', function() {
      v.appendFill0(48);

      v2.appendFill0(24);
      v2.appendFill0(24);

      v.toString().should.equal('00000000 00000000 00000000 00000000 xxxxxxxx xxxxxxxx 00000000 00000000', 'One call to appendFill0');
      v2.toString().should.equal(v2.toString(), 'two calls to appendFill0');
    });

    it('should allow muliple successive calls to appendFill1 over word boundary', function() {
      v.appendFill1(48);

      v2.appendFill1(24);
      v2.appendFill1(24);

      v.toString().should.equal('11111111 11111111 11111111 11111111 xxxxxxxx xxxxxxxx 11111111 11111111', 'One call to appendFill1');
      v2.toString().should.equal(v2.toString(), 'two calls to appendFill1');
    });

    it('should allow muliple successive calls to appendFill1 with size a multiple of word length', function() {
      v.appendFill1(64);

      v2.appendFill1(32);
      v2.appendFill1(32);

      v2.activeWord.end.should.equal(v1.activeWord.end);

      v.toString().should.equal('11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111', 'One call to appendFill1');
      v2.toString().should.equal(v2.toString(), 'two calls to appendFill1');
    });

    it('should allow muliple successive calls to appendFill0 with size a multiple of word length', function() {
      v.appendFill0(64);

      v2.appendFill0(32);
      v2.appendFill0(32);

      v2.activeWord.end.should.equal(v1.activeWord.end);

      v.toString().should.equal('00000000 00000000 00000000 00000000 00000000 00000000 00000000 00000000', 'One call to appendFill0');
      v2.toString().should.equal(v2.toString(), 'two calls to appendFill0');
    });
  });

  describe('#nextWord, #prevWord, #scan', function() {
    it('should go to the next word', function() {
      vscan.activeWord.start.should.equal(0);
      vscan.nextWord();
      vscan.activeWord.start.should.equal(64);
      vscan.nextWord();
      vscan.activeWord.start.should.equal(96);
      vscan.nextWord();
    });

    it('activeWord should be sane after appendFill1', function() {
      v.appendFill1(45);
      v.appendFill1(4);
      v.appendFill1(1);
      v.appendFill1(3);
      v.appendFill1(33);

      v.activeWord.start.should.lessThan(v.activeWord.end);
    });

    it('activeWord should be sane after appendFill0', function() {
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

      v.toString().should.equal('<empty>');
    });

    it('should work for compressed words of exactly 32 bits', function() {

      v.appendFill0(32);
      v.toString().should.equal('00000000 00000000 00000000 00000000');

      v.appendFill1(32);
      v.toString().should.equal('00000000 00000000 00000000 00000000 11111111 11111111 11111111 11111111');
    });

    it('should work for longer compressed words that are multiples of 32', function() {

      v.appendFill0(96);
      v.toString().should.equal('00000000 00000000 00000000 00000000 00000000 00000000 00000000 00000000 00000000 00000000 00000000 00000000');
    });

    it('should work for longer compressed words that are not multiples of 32', function() {

      v.appendFill1(33);
      v.toString().should.equal('11111111 11111111 11111111 11111111 xxxxxxxx xxxxxxxx xxxxxxxx xxxxxxx1');
    });

    it('should work for literal words', function() {

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

      v.appendFill1(1);
      v.appendFill0(1);
      v.appendFill1(96);
      v.toString().should.equal('11111111 11111111 11111111 11111101 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 xxxxxxxx xxxxxxxx xxxxxxxx xxxxxx11');
    });

    it('should refuse to print a string of more than 256 bits', function() {

      v.appendFill1(256);
      v.toString().should.equal('11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111');
      v.appendFill0(1);
      (function() { return v.toString() }).should.throwError('Bit vector too long for string representation. (This length restriction is arbitrary.)');
    });

    it('should preserve original activeWord', function() {
      // given
      var originalActiveWordStart;
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

  describe('#equals', function() {
    it('should not flag different array vectors as equal', function() {
      var arrayOfTestVectors = [v, v2, v0, v1, v10, v01, v0first, v1first, vlit1, vlit2, vlong, vscan];

      for(var i = 0; i < arrayOfTestVectors.length; i++) {
        var a = arrayOfTestVectors[i];
        for(var j = 0; j < arrayOfTestVectors.length; j++) {
          var b = arrayOfTestVectors[j]
            , correctAnswer = i === j || (i < 2 && j < 2); // the <2 tests are because v and v2 should be equal
            a.equals(b).should.equal(correctAnswer, 'Comparing ' + i + 'th and ' + j + 'th vectors');
        }
      }
    });

    it('should work with multiple calls vs single call to Fill0 with compressed words', function() {
      v.appendFill0(64);
      v2.appendFill0(32);
      v2.appendFill0(32);

      v.equals(v2).should.equal(true);
    });

    it('should work with bit vectors assembled from literal words that were assembled using different calls to appendFill', function() {
      v.appendFill0(3);
      v.appendFill1(3);
      v.appendFill1(3);
      v.appendFill0(23);
      v.appendFill0(1);
      v.appendFill1(5);
      v.appendFill0(1);

      v2.appendFill0(3);
      v2.appendFill1(5);
      v2.appendFill1(1);
      v2.appendFill0(24); // goes over literal word boundary
      v2.appendFill1(1);
      v2.appendFill1(1);
      v2.appendFill1(1);
      v2.appendFill1(1);
      v2.appendFill1(1);
      v2.appendFill0(1);

      v.equals(v2).should.equal(true);
    });

    it('should work in this specific failure case I just identified', function() {
      v.appendFill0(64);
      v.appendFill0(3);
      v.appendFill1(3);

      v2.appendFill0(32);
      v2.appendFill0(32);
      v2.appendFill0(3);
      v2.appendFill1(3);

      v2.toString().should.equal(v.toString());
      v.equals(v2).should.equal(true);
    });

    it('should work with combination of compressed words and uncompressed words composed using different appendFill calls', function() {
      v.appendFill0(64);
      v.appendFill0(3);
      v.appendFill1(3);
      v.appendFill1(3);
      v.appendFill0(23);
      v.appendFill0(1);
      v.appendFill1(5);
      v.appendFill0(1);

      v2.appendFill0(32);
      v2.appendFill0(32);
      v2.appendFill0(3);
      v2.appendFill1(5);
      v2.appendFill1(1);
      v2.appendFill0(24); // goes over literal word boundary
      v2.appendFill1(1);
      v2.appendFill1(1);
      v2.appendFill1(1);
      v2.appendFill1(1);
      v2.appendFill1(1);
      v2.appendFill0(1);

      console.log({a:v, b:v2});

      v.equals(v2).should.equal(true);
    })
  });

  describe('#pack, #unpack, #saveToArrayBuffer, #loadFromArrayBuffer', function() {
    it('should pack and unpack a simple bit vector', function() {
      v.appendFill0(32);
      v.pack();

      v2.appendFill0(32);
      v.equals(v2).should.equal(true);
      v.packed.should.equal(true);
      (v.words instanceof Int32Array).should.equal(true);
      (v.fills instanceof Int32Array).should.equal(true);
      (v.words.buffer.should.equal(v.fills.buffer));

      v.unpack();
      v.equals(v2).should.equal(true);
      v.packed.should.equal(false);
      (v.words instanceof Int32Array).should.equal(false);
      (v.fills instanceof Int32Array).should.equal(false);
    });

    it('should pack empty bit vector', function() {
      v.pack();

      console.log({packed:v, notpacked:v2});

      v.equals(v2).should.equal(true);
    });

    it('should save and load again without changing', function() {
      v1.appendFill1(45);
      v1.appendFill0(4);
      v1.appendFill0(1000);
      v1.appendFill1(3);
      v1.appendFill1(33);

      v2.loadFromArrayBuffer(v1.saveToArrayBuffer());
      v1.equals(v2).should.equal(true);
    });
  });

  describe("logical operations", function() {
    describe('#appendWord', function() {
      it('should fail on packed CmpBitVec', function() {
        v0.pack();
        (function() {v0.appendWord(0x00000000);} ).should.throw('Call unpack() on a packed bit vector before attempting to modify it');
      });
      it('should append fill0 to vector full of fill0s', function() {
        v0.appendWord(0x00000000);
        v0.toString().should.equal('00000000 00000000 00000000 00000000 00000000 00000000 00000000 00000000 00000000 00000000 00000000 00000000');
      });
      it('should append fill1 to vector full of fill1s', function() {
        v1.appendWord(0xFFFFFFFF);
        v1.toString().should.equal('11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111');
      });
      it('should append fill0 to vector ending with a fill0', function() {
        v10.appendWord(0x00000000);
        v10.toString().should.equal('11111111 11111111 11111111 11111111 00000000 00000000 00000000 00000000 00000000 00000000 00000000 00000000');
      });
      it('should append fill1 to vector ending with a fill1', function() {
        v01.appendWord(0xFFFFFFFF);
        v01.toString().should.equal('00000000 00000000 00000000 00000000 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111');
      });
      it('should append fill0 to vector ending with a fill1', function() {
        v1.appendWord(0x00000000);
        v1.toString().should.equal('11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 00000000 00000000 00000000 00000000');
      });
      it('should append fill1 to vector ending with a fill0', function() {
        v0.appendWord(0xFFFFFFFF);
        v0.toString().should.equal('00000000 00000000 00000000 00000000 00000000 00000000 00000000 00000000 11111111 11111111 11111111 11111111');
      });
      it('should append fill0 to vector ending with a literal', function() {
        vlit2.appendWord(0x00000000);
        vlit2.toString().should.equal('00000000 00000000 11111111 11111111 11111111 11111111 00000000 00000000 00000000 00000000 00000000 00000000');
      });
      it('should append fill1 to vector ending with a literal', function() {
        vlit2.appendWord(0xFFFFFFFF);
        vlit2.toString().should.equal('00000000 00000000 11111111 11111111 11111111 11111111 00000000 00000000 11111111 11111111 11111111 11111111');
      });
      it('should append literal to vector full of zeros', function() {
        v0.appendWord(0xDEADBEEF);
        v0.toString().should.equal('00000000 00000000 00000000 00000000 00000000 00000000 00000000 00000000 11011110 10101101 10111110 11101111');
      });
      it('should append literal to vector full of 1s', function() {
        v1.appendWord(0xDEADBEEF);
        v1.toString().should.equal('11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 11011110 10101101 10111110 11101111');
      });
      it('should append literal to full vector of literals', function() {
        vlit2.appendWord(0xDEADBEEF);
        vlit2.toString().should.equal('00000000 00000000 11111111 11111111 11111111 11111111 00000000 00000000 11011110 10101101 10111110 11101111');
      });
      it('should thow an exception when adding any word to bit vector ending with a partially full vector of literals', function() {
        var expectedErrorMsg = 'Unsupported operation: Appending a word to bit vector that ends with a partially-full literal vector';
        (function() { vlong.appendWord(0xDEADBEEF); }).should.throw(expectedErrorMsg);
        (function() { vlong.appendWord(0x00000000); }).should.throw(expectedErrorMsg);
        (function() { vlong.appendWord(0x11111111); }).should.throw(expectedErrorMsg);
      });
      it('should append fill0 word to empty vector', function() {
        var empty = new CmpBitVec();
        empty.appendWord(0x00000000);
        empty.toString().should.equal('00000000 00000000 00000000 00000000');
      });
      it('should append fill1 word to empty vector', function() {
        var empty = new CmpBitVec();
        empty.appendWord(0xFFFFFFFF);
        empty.toString().should.equal('11111111 11111111 11111111 11111111');
      });
      it('should append literal word to empty vector', function() {
        var empty = new CmpBitVec();
        empty.appendWord(0xDEADBEEF);
        empty.toString().should.equal('11011110 10101101 10111110 11101111');
      });
    });
    describe('#and', function() {
      it('should not work with null arguments', function() {
        (function() { v1.and(); }).should.throw('Second bit vector for binary operation is false-y or not a CmpBitVec instance');
      });
      it('should not work with non-CmpBitVec arguments', function() {
        (function() { v1.and(new Date()); }).should.throw('Second bit vector for binary operation is false-y or not a CmpBitVec instance');
        (function() { v1.and('sausage'); }).should.throw('Second bit vector for binary operation is false-y or not a CmpBitVec instance');
        (function() { v1.and(); }).should.throw('Second bit vector for binary operation is false-y or not a CmpBitVec instance');
        (function() { v1.and(1); }).should.throw('Second bit vector for binary operation is false-y or not a CmpBitVec instance');
      });
      it('should not work with vectors of different length', function() {
        (function() { v1.and(vlong); }).should.throw('Bit vector length mismatch');
        (function() { vlong.and(v1); }).should.throw('Bit vector length mismatch');
      });
      it('should work for simple case of and with self', function() {
        v1.and(v1).toString().should.equal(v1.toString());
      });
      it('should work with a vector full of zeros', function() {
        v1.and(v0).toString().should.equal(v0.toString());
      });
      it('should work with compressed words to give a vector full of zeros', function() {
        v10.and(v01).toString().should.equal(v0.toString());
      });
      it('should work with literal words', function() {
        vlit1.and(vlit2).toString().should.equal(v0.toString());
        vlit1.and(v1).toString().should.equal(vlit1.toString());
        vlit1.and(v0).toString().should.equal(v0.toString());
      });
      it('should work with compressed words to give a vector of compressed words', function() {
        v10.and(v1).toString().should.equal(v10.toString());
        v10.and(v10).toString().should.equal(v10.toString());
        v10.and(v01).toString().should.equal(v0.toString());
      });
      it('should work with mixed literal and compressed words', function() {
        v0first.and(v1first).toString().should.equal(v0.toString());
        v0first.and(v1).toString().should.equal(v0first.toString());
      });
      it('should work with arbitrary mixtures', function() {
        vlit1.and(v1first).toString().should.equal(v0.toString());
        vlit1.and(v0first).toString().should.equal(vlit1.toString());
        vlit1.and(v10).toString().should.equal('11111111 11111111 00000000 00000000 00000000 00000000 00000000 00000000');
      });
      it('should correctly size the and-ed result of vectors ending with short literals', function() {
        v.appendFill1(2);
        v.appendFill0(2);
        v2.appendFill1(4);
        v.and(v2).size.should.equal(v.size);
        v.and(v2).toString().should.equal('xxxxxxxx xxxxxxxx xxxxxxxx xxxx0011');
      });
      it('should correctly size the and-ed result of vectors whose lengths are not multiples of 32', function() {
        v.appendFill1(68);
        v2.appendFill1(64);
        v2.appendFill1(2);
        v2.appendFill0(2);
        v.and(v2).toString().should.equal('11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 xxxxxxxx xxxxxxxx xxxxxxxx xxxx0011');
      });
    });
    describe('#or', function() {
      it('should not work with null arguments', function() {
        (function() { v1.or(); }).should.throw('Second bit vector for binary operation is false-y or not a CmpBitVec instance');
      });
      it('should not work with non-CmpBitVec arguments', function() {
        (function() { v1.or(new Date()); }).should.throw('Second bit vector for binary operation is false-y or not a CmpBitVec instance');
        (function() { v1.or('sausage'); }).should.throw('Second bit vector for binary operation is false-y or not a CmpBitVec instance');
        (function() { v1.or(); }).should.throw('Second bit vector for binary operation is false-y or not a CmpBitVec instance');
        (function() { v1.or(1); }).should.throw('Second bit vector for binary operation is false-y or not a CmpBitVec instance');
      });
      it('should not work with vectors of different length', function() {
        (function() { v1.or(vlong); }).should.throw('Bit vector length mismatch');
        (function() { vlong.or(v1); }).should.throw('Bit vector length mismatch');
      });
      it('should work for simple case of or with self', function() {
        v1.or(v1).toString().should.equal(v1.toString());
      });
      it('should work with vectors full of ones and zeros', function() {
        v1.or(v0).toString().should.equal(v1.toString());
      });
      it('should work with compressed words to give a vector full of zeros', function() {
        v10.or(v01).toString().should.equal(v1.toString());
      });
      it('should work with literal words', function() {
        vlit1.or(vlit2).toString().should.equal(v1.toString());
        vlit1.or(v1).toString().should.equal(v1.toString());
        vlit1.or(v0).toString().should.equal(vlit1.toString());
      });
      it('should work with compressed words to give a vector of compressed words', function() {
        v10.or(v1).toString().should.equal(v1.toString());
        v10.or(v10).toString().should.equal(v10.toString());
        v10.or(v01).toString().should.equal(v1.toString());
      });
      it('should work with mixed literal or compressed words', function() {
        v0first.or(v1first).toString().should.equal(v1.toString());
        v0first.or(v1).toString().should.equal(v1.toString());
      });
      it('should work with arbitrary mixtures', function() {
        vlit1.or(v1first).toString().should.equal('11111111 11111111 00000000 00000001 00000000 00000000 11111111 11111111');
        vlit1.or(v0first).toString().should.equal('11111111 11111111 11111111 11111110 11111111 11111111 11111111 11111111');
        vlit1.or(v10).toString().should.equal('11111111 11111111 11111111 11111111 00000000 00000000 11111111 11111111');
      });
      it('should correctly size the or-ed result of vectors ending with short literals', function() {
        v.appendFill0(2);
        v.appendFill1(2);
        v2.appendFill1(4);
        v.or(v2).size.should.equal(v.size);
        v.or(v2).toString().should.equal('xxxxxxxx xxxxxxxx xxxxxxxx xxxx1111');
      });
      it('should correctly size the or-ed result of vectors whose lengths are not multiples of 32', function() {
        v.appendFill1(68);
        v2.appendFill1(64);
        v2.appendFill0(2);
        v2.appendFill1(2);
        v.or(v2).toString().should.equal('11111111 11111111 11111111 11111111 11111111 11111111 11111111 11111111 xxxxxxxx xxxxxxxx xxxxxxxx xxxx1111');
      });
    })
  });
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