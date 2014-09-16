(function() {
    // this is a hack to force the javascript interpreter
    // to treat words as 32 bit integers
    var _magic = Int32Array(7);
    _magic[0] = 0x00000000; var x00000000 = 0;
    _magic[1] = 0xFFFFFFFF; var xFFFFFFFF = 1;
    _magic[2] = 0x80000000; var x80000000 = 2;
    _magic[3] = 0x80000001; var x80000001 = 3;
    _magic[4] = 0x7FFFFFFF; var x7FFFFFFF = 4;
    _magic[5] = 0x00000001; var x00000001 = 5;
    _magic[6] = 0x00000000; var freeSpace = 6;

    // "constants"
    var TYPE_0_FILL = 0
      , TYPE_1_FILL = 1
      , TYPE_LITERAL = 2
      , TYPE_UNDEFINED = 3;

    // constructor
    var CmpBitVec = function() {
        this.packed = false; // true if working with an arrayBuffer
        this.size   = 0;
        this.count  = 0;
        this.nwords = 0;
        this.words  = [];
        this.fills  = [];
        this.activeWord = {
            offset : 0,
            start  : 0,
            end    : 0,
            type   : TYPE_UNDEFINED // types are 0-fill, 1-fill, literal (2), 3 is undefined
        };
    };

    // check whether the ith word is a fill
    CmpBitVec.prototype.isFill = function(i) {
      if(i < 0 || i >= this.words.length) {
        throw new Error('Word out of bounds');
      }
      return (this.fills[i >>> 5] >>> (i & 31)) & 1;
    };

    CmpBitVec.prototype.wordType = function(i) {
        if (this.isFill(i)) {
            // if it's fill, all bits are set the same. So we just check the most significant bit.
            return ((this.words[i] & _magic[x80000000]) === _magic[x80000000]) ? TYPE_1_FILL : TYPE_0_FILL;
        }
        return TYPE_LITERAL;
    };

    // Set active word to the first in the CmpBitVec
    CmpBitVec.prototype.begin = function() {
        if(this.activeWord.type === TYPE_UNDEFINED) {
          return; // the CmpBitVec is empty.
        }
        this.activeWord = {
            offset : 0,
            start  : 0,
            end    : 32,
            type   : this.wordType(0)
        };
        if (this.activeWord.type !== TYPE_LITERAL) {
            this.activeWord.end = (this.words[0] << 5);
        }
    };

    // load a bitvector from an ArrayBuffer
    CmpBitVec.prototype.loadFromArrayBuffer = function(buf) {
        this.packed = true;
        var i32     = new Int32Array(buf);
        this.size   = i32[0];
        this.count  = i32[1];
        this.nwords = i32[2];
        this.words  = i32.subarray(3, this.nwords+3);
        this.fills  = i32.subarray(3+this.nwords);

        this.begin();
    };
    
    // get the ArrayBuffer
    CmpBitVec.prototype.saveToArrayBuffer = function() {
      this.pack();
      return this.words.buffer;
    };
    
    // Check if two CmpBitVecs represent the same bit vector
    // NB This implementation will return true when a packed bit vector is compared to a unpacked equivalent
    CmpBitVec.prototype.equals = function(bvec) {
      if (this.size !== bvec.size) return false;
      if (this.count !== bvec.count) return false;
      if (this.nwords !== bvec.nwords) return false;

      for (var i=0;i<this.fills.length;i++) {
        if (this.fills[i] !== bvec.fills[i]) return false;
      }
      for (var i=0;i<this.words.length;i++) {
        if (this.words[i] !== bvec.words[i]) return false;
      }
      return true;
    };

    // Move a bitvector such that all information is encoded into a single ArrayBuffer.
    CmpBitVec.prototype.pack = function() {
        if (this.packed) { return; }
        var nfills = this.fills.length; // ((this.nwords-1) >>> 5) + 1;
        var buf = ArrayBuffer(4*(3 + this.nwords + nfills));
        this.packed = true;
        var i32     = new Int32Array(buf);
        i32[0]      = this.size;
        i32[1]      = this.count;
        i32[2]      = this.nwords;
        var wordArr = i32.subarray(3, this.nwords+3);
        wordArr.set(this.words);
        this.words = wordArr;

        var fillArr = i32.subarray(3+this.nwords);
        fillArr.set(this.fills);
        this.fills = fillArr;

        this.begin();
    };
    
    // unpack a bitvector from an arrayBuffer
    CmpBitVec.prototype.unpack = function() {
        if (this.packed == false) { return; }
        this.packed = false;
        var nfills = ((this.nwords-1) >>> 5) + 1;
        var i32 = new Int32Array(this.words.buffer);
        this.size = i32[0];
        this.count = i32[1];
        this.nwords = i32[2];
        var wordArr = [];
        var fillArr = [];
        for(var i=0; i<this.nwords; i++) {
            wordArr.push(this.words[i]);
        }
        this.words = wordArr;
        for(i=0; i<nfills; i++) {
            fillArr.push(this.fills[i]);
        }
        this.fills = fillArr;
        this.begin();
    };

    CmpBitVec.prototype.ensureModifiable = function() {
      if(this.packed === true) {
        throw new Error('Call unpack() on a packed bit vector before attempting to modify it');
      }
    }

    // advance to the next active word
    CmpBitVec.prototype.nextWord = function() {
        this.activeWord.offset++;
        this.activeWord.start = this.activeWord.end;
        this.activeWord.type  = this.wordType(this.activeWord.offset);
        this.activeWord.end  += (this.activeWord.type === TYPE_LITERAL) ?
            32 : this.words[this.activeWord.offset] << 5;
    };

    // move to the previous active word
    CmpBitVec.prototype.prevWord = function() {
        this.activeWord.offset--;
        this.activeWord.end = this.activeWord.start;
        this.activeWord.type = this.wordType(this.activeWord.offset);
        this.activeWord.start -= (this.activeWord.type === TYPE_LITERAL) ?
            32 : this.words[this.activeWord.offset] << 5;
    };

    CmpBitVec.prototype.activeWordIsLast = function() {
        return this.activeWord.end >= this.size;
    };

    CmpBitVec.prototype.appendWord = function(word) {
        this.ensureModifiable();

        if(this.size % 32 !== 0) {
          throw new Error('Unsupported operation: Appending a word to bit vector that ends with a partially-full literal vector');
        }

        if (word === _magic[x00000000]) { // 0-fill
            if (this.activeWord.type === TYPE_0_FILL) { // extends previous 0-fill
                this.words[this.activeWord.offset]++;
            }
            else { // append a 0-fill
                var mod = this.nwords & 31;
                if (mod) {
                    this.fills[this.fills.length - 1] |= _magic[x00000001] << mod;
                }
                else {
                    this.fills.push(_magic[x00000001]);
                }
                this.words.push(_magic[x00000001]);
                this.nwords++;
                this.activeWord.type = TYPE_0_FILL;
            }
        }
        else if (word === _magic[xFFFFFFFF]) { // 1-fill
            if (this.activeWord.type === TYPE_1_FILL) { // extends previous 1-fill
                this.words[this.activeWord.offset]++;
            }
            else { // append a 1-fill
                var mod = this.nwords & 31;
                if (mod) {
                    this.fills[this.fills.length - 1] |= _magic[x00000001] << mod;
                }
                else {
                    this.fills.push(_magic[x00000001]);
                }
                this.words.push(_magic[x80000001]);
                this.nwords++;
                this.activeWord.type = TYPE_1_FILL;
                this.count += 32;
            }
        }
        else { // literal
            if ((this.nwords & 31) === 0) {
                this.fills.push(_magic[x00000000]);
            }
            this.words.push(word);
            this.nwords++;
            this.activeWord.type = TYPE_LITERAL;
            this.count += this.popcount(word);
        }
        this.activeWord.offset = this.nwords-1;
        this.activeWord.start  = this.size;
        this.size             += 32;
        this.activeWord.end    = this.size;
    };

    CmpBitVec.prototype.appendFill0 = function(len) {
        this.ensureModifiable();

        if (this.activeWord.type === TYPE_LITERAL) { // extend current LITERAL word
            var remainingBits = 32 - (this.size - this.activeWord.start);
            this.size += len;
            if (remainingBits >= len) return;
            len -= remainingBits;
        }
        else if (this.activeWord.type === TYPE_1_FILL) this.size += len;
        else if (this.activeWord.type === TYPE_0_FILL) {
            this.size += len;
            var nfills = len >>> 5;
            if (nfills) {
                this.words[this.nwords-1] += nfills;
                this.activeWord.end += nfills * 32;
                len &= 31;
            }
        }
        else {
          if(this.activeWord.type !== TYPE_UNDEFINED) {
            throw(new Error("activeWord type is illegal."));
          }
          if(this.words.length > 0) {
            throw(new Error("activeWord type is undefined with extant words available"));
          }
          this.size += len;
        }

        var nfills = len >>> 5;
        if (nfills) {
            var mod = this.nwords & 31;
            if (mod) this.fills[this.fills.length - 1] |= _magic[x00000001] << mod;
            else this.fills.push(_magic[x00000001]);
            this.words.push(_magic[x00000000] + nfills);
            this.nwords++;
            this.activeWord.offset = this.nwords-1;
            this.activeWord.type = TYPE_0_FILL;
            this.activeWord.start = this.activeWord.end;
            this.activeWord.end += (nfills * 32);
            len &= 31;
        }
        if (len > 0) {
            if ((this.nwords & 31) === 0) this.fills.push(_magic[x00000000]);
            this.words.push(_magic[x00000000]);
            this.nwords++;
            this.activeWord.start = this.activeWord.end;
            this.activeWord.end += 32;
            this.activeWord.type = TYPE_LITERAL;
            this.activeWord.offset = this.nwords-1;
        }
    };

    CmpBitVec.prototype.appendFill1 = function(len) {
        this.ensureModifiable();

        this.count += len;
        if (this.activeWord.type === TYPE_LITERAL) { // extend current LITERAL word
            var usedBits = this.size - this.activeWord.start;
            var remainingBits = 32 - usedBits;
            this.size += len;
            if (remainingBits) {
                if (len < remainingBits) {
                 // 2**len -1 gives len 1s. left shift usedBits to make space for existing
                 // e.g. usedBits is 10, word is 00000000 00000000 00000000 00000000
                 // which means that there are 22 unused bits and 10 bits set to 0, e.g.
                 //                              oooooooo oooooooo oooooo00 00000000
                 // so we can safely add up to 22 bits of information *to the left hand side bits*
                    this.words[this.activeWord.offset] |= ((_magic[x00000001] << len) - 1) << usedBits;
                    return;
                }
                else {
                    this.words[this.activeWord.offset] |= _magic[xFFFFFFFF] << usedBits;
                }
                len -= remainingBits;
            }
        }
        else if (this.activeWord.type === TYPE_0_FILL) {
            this.size += len;
        }
        else if (this.activeWord.type === TYPE_1_FILL) {
            this.size += len;
            var nfills = len >>> 5;
            if (nfills) {
                this.words[this.nwords-1] += nfills;
                this.activeWord.end += nfills * 32;
                len &= 31;
            }
        }
        else {
          if(this.activeWord.type !== TYPE_UNDEFINED) {
            throw(new Error("activeWord type is illegal."));
          }
          if(this.words.length > 0) {
            throw(new Error("activeWord type is undefined with extant words available"));
          }
          this.size += len;
        }

        var nfills = len >>> 5; // aka Math.floor( len / 32 )
        if (nfills) {
            var mod = this.nwords & 31;
            if (mod) this.fills[this.fills.length - 1] |= _magic[x00000001] << mod;
            else this.fills.push(_magic[x00000001]);
            this.words.push(_magic[x80000000] + nfills);
            this.activeWord.offset = this.nwords;
            this.nwords++;
            this.activeWord.type = TYPE_1_FILL;
            this.activeWord.start = this.activeWord.end;  // this.activeWord.start += nfills * 32;
            this.activeWord.end += nfills * 32;
            len &= 31;
        }
        if (len > 0) {
            // set length bits to 1 in literal word
            if ((this.nwords & 31) === 0) this.fills.push(_magic[x00000000]);
            this.words.push(_magic[xFFFFFFFF] >>> (32 - len));
            this.activeWord.offset = this.nwords;
            this.nwords++;
            this.activeWord.start = this.activeWord.end;
            this.activeWord.end += 32;
            this.activeWord.type = TYPE_LITERAL;
        }
    };

    // TODO consider moving this can-we-safely-advance-the-word logic into #nextWord
    function possiblyAdvanceToNextWords(thiz, advanceThis, that, advanceThat) {
      if((advanceThis && thiz.activeWordIsLast())
        || (advanceThat && that.activeWordIsLast())) {
        throw new Error('Attempt to advance beyond end of vector');
      }
      if(advanceThis) {
        thiz.nextWord();
      }
      if(advanceThat) {
        that.nextWord();
      }
    }

    // return the logical AND of two CmpBitVec objects
    CmpBitVec.prototype.and = function(that) {
        checkBitVectorPair(this, that);

        // special case.
        // TODO: potential for unpredictable behaviour: Usually we return a new CmpBitVec that shouldn't have side-effects when modified. Unless this.equals(that), in which case we return the same CmpBitVec
        if(this === that || this.equals(that)) return this;

        var res = new CmpBitVec()
        // use these methods to flag that nextWord should be called on this or that. We need this because nextWord
        // errors out if there is no available next word
          , advanceThis = false
          , advanceThat = false;

        this.begin();
        that.begin();

        do {
            possiblyAdvanceToNextWords(this, advanceThis, that, advanceThat);
            advanceThat = advanceThis = false;

            // advance until words overlap
            while (this.activeWord.end <= that.activeWord.start) { this.nextWord(); }
            while (that.activeWord.end <= this.activeWord.start) { that.nextWord(); }
            // compare overlapping words
            if (this.activeWord.type === TYPE_0_FILL) { // 0-fill
                res.appendFill0(this.activeWord.end - res.size);
                advanceThis = true;
            }
            else if (this.activeWord.type === TYPE_1_FILL) { // 1-fill
                if (that.activeWord.type === TYPE_0_FILL) { // 1-fill vs 0-fill
                    res.appendFill0(that.activeWord.end - res.size);
                    advanceThat = true;
                }
                else if (that.activeWord.type === TYPE_1_FILL) { // 1-fill vs 1-fill
                    if (this.activeWord.end <= that.activeWord.end) {
                        res.appendFill1(this.activeWord.end - res.size);
                        advanceThis = true;
                    }
                    else {
                        res.appendFill1(that.activeWord.end - res.size);
                        advanceThat = true;
                    }
                }
                else if (that.activeWord.type === TYPE_LITERAL) { // 1-fill vs literal
                    res.appendWord(that.words[that.activeWord.offset]);
                    advanceThat = true;
                }
            }
            else if (this.activeWord.type === TYPE_LITERAL) { // literal
                if (that.activeWord.type === TYPE_0_FILL) { // literal vs 0-fill
                    res.appendFill0(that.activeWord.end - res.size);
                    advanceThat = true;
                }
                else if (that.activeWord.type === TYPE_1_FILL) { // literal vs 1-fill
                    res.appendWord(this.words[this.activeWord.offset]);
                    advanceThis = true;
                }
                else if (that.activeWord.type === TYPE_LITERAL) { // literal vs literal
                    res.appendWord(this.words[this.activeWord.offset] & that.words[that.activeWord.offset]);
                    advanceThis = true;
                    advanceThat = true;
                }
            }
        } while(res.size < this.size);

        // truncate size of result if it's longer than the input. This happens if the last word in the and-ed vectors
        // are not full. TODO: consider if this can be moved somewhere more sensible in future, e.g. appendWord
        if(res.size > this.size) {
          res.size = this.size;
        }

        res.pack();
        return res;
    };

    CmpBitVec.prototype.or = function(that) {
        checkBitVectorPair(this, that);

        // special case.
        // TODO: potential for unpredictable behaviour: Usually we return a new CmpBitVec that shouldn't have side-effects when modified. Unless this.equals(that), in which case we return the same CmpBitVec
        if(this === that || this.equals(that)) return this;

        var res = new CmpBitVec()
        // use these methods to flag that nextWord should be called on this or that. We need this because nextWord
        // errors out if there is no available next word
          , advanceThis = false
          , advanceThat = false;
      
        this.begin();
        that.begin();
        do {
            possiblyAdvanceToNextWords(this, advanceThis, that, advanceThat);
            advanceThat = advanceThis = false;

            // advance until words overlap
            while (this.activeWord.end <= that.activeWord.start) { this.nextWord(); }
            while (that.activeWord.end <= this.activeWord.start) { that.nextWord(); }

            // compare overlapping words
            if (this.activeWord.type === TYPE_0_FILL) { // 0-fill
                if (that.activeWord.type === TYPE_0_FILL) { // 0-fill vs 0-fill
                    if (this.activeWord.end <= that.activeWord.end) {
                        res.appendFill0(this.activeWord.end - res.size);
                        advanceThis = true;
                    }
                    else {
                        res.appendFill0(that.activeWord.end - res.size);
                        advanceThat = true;
                    }
                }
                else if (that.activeWord.type === TYPE_1_FILL) { // 0-fill vs 1-fill
                    res.appendFill1(that.activeWord.end - res.size);
                    advanceThat = true;
                }
                else if (that.activeWord.type === TYPE_LITERAL)  { // 0-fill vs literal
                    res.appendWord(that.words[that.activeWord.offset]);
                    advanceThat = true;
                }
            }
            else if (this.activeWord.type === TYPE_1_FILL) { // 1-fill
                res.appendFill1(this.activeWord.end - res.size);
                advanceThis = true;
            }
            else if (this.activeWord.type === TYPE_LITERAL) { // literal
                if (that.activeWord.type === TYPE_0_FILL) { // literal vs 0-fill
                    res.appendWord(this.words[this.activeWord.offset]);
                    advanceThis = true;
                }
                else if (that.activeWord.type === TYPE_1_FILL) { // literal vs 1-fill
                    res.appendFill1(that.activeWord.end - res.size);
                    advanceThat = true;
                }
                else if (that.activeWord.type === TYPE_LITERAL) { // literal vs literal
                    res.appendWord(this.words[this.activeWord.offset] | that.words[that.activeWord.offset]);
                    advanceThis = true;
                    advanceThat = true;
                }
            }
        } while(res.size < this.size);


        // truncate size of result if it's longer than the input. This happens if the last word in the and-ed vectors
        // are not full. TODO: consider if this can be moved somewhere more sensible in future, e.g. appendWord
        if(res.size > this.size) {
            res.size = this.size;
        }

        res.pack();
        return res;
    };

    CmpBitVec.prototype.not = function() {
        this.pack();
        // make a copy of the arrayBuffer
        var resBuffer = this.words.buffer.slice(0);
        var resi32   = new Int32Array(resBuffer);
        resi32[0] = this.size;
        resi32[1] = this.size - this.count;
        resi32[2] = this.nwords;
        // flip all the bits in each word
        for(var i=0;i<this.nwords;i++) {
            if (this.isFill(i)) { //fills[i >>> 5] & i & 31) {
                // toggle MSB
                resi32[i+3]  = (this.words[i] < 0) ? this.words[i] & _magic[x7FFFFFFF] : this.words[i] | _magic[x80000000];
            }
            else {
                resi32[i+3] = ~resi32[i+3];
            }
        }
        // if the last word is a literal word
        // mask flipped bits beyond the end of the vector
        if (!this.isFill(this.nwords-1) && this.size & 31) {
            resi32[this.nwords + 2] &= _magic[xFFFFFFFF] >>> (32 - (this.size & 31));
        }
        var result = new CmpBitVec();
        result.load(resBuffer);
        return result;
    };

    CmpBitVec.prototype.scan = function(bitPos) {
        if ((this.activeWord.start <= bitPos) && (bitPos < this.activeWord.end)) return;
        while (this.activeWord.end <= bitPos) this.nextWord();
        while (this.activeWord.start > bitPos) this.prevWord();
    };

    CmpBitVec.prototype.nextSetBitInclusive = function(pos) {
        if (!pos) pos = 0;
        if (pos < 0 || pos >= this.size) return -1;
        this.scan(pos);
        if (this.activeWord.type === TYPE_LITERAL) {
            _magic[freeSpace] = this.words[this.activeWord.offset] & (_magic[xFFFFFFFF] << (pos - this.activeWord.start));

            if (_magic[freeSpace] === 0) return this.nextSetBitInclusive(this.activeWord.end);
            else return this.activeWord.start + this.ctz(_magic[freeSpace]);
        }
        else if (this.activeWord.type === TYPE_1_FILL) return pos;
        else return this.nextSetBitInclusive(this.activeWord.end);
    };

    CmpBitVec.prototype.toString = function() {
      var instance = this
        , byteStrings = []
        , originalActiveWordStartPos = this.activeWord.start;

      function appendActiveWord() { with(instance.activeWord) {
        var lengthInBytes = (end - start) / 8;
        switch(type) {
          case TYPE_0_FILL:
            pushByteRepresentations('00000000', lengthInBytes);
            break;
          case TYPE_1_FILL:
            pushByteRepresentations('11111111', lengthInBytes);
            break;
          case TYPE_LITERAL:
            pushBytesOfActiveLiteralWord();
            break;
          case TYPE_UNDEFINED:
          default:
            throw new Error("activeWord has undefined state");
        }
      }}

      function pushBytesOfActiveLiteralWord() {
        var byteString = ''
          , theWord = instance.words[instance.activeWord.offset]
          , numBytesDefined = instance.size - instance.activeWord.start
          , firstLittleEndianByteDefined = 32 - numBytesDefined;

        for (var i = 0; i < 32; i++) {
          byteString += (theWord & _magic[x80000000]) ? '1' : (i >= firstLittleEndianByteDefined ? '0' : 'x');
          if(i % 8 === 7) {
            byteStrings.push(byteString);
            byteString = '';
          }
          theWord <<= 1;
        }
      }

      function pushByteRepresentations(byteString, numBytes) {
        while(numBytes--) { byteStrings.push(byteString); }
      }

      if(this.size === 0) {
        return "<empty>";
      }

      if(this.size > 256) {
        throw new Error('Bit vector too long for string representation. (This length restriction is arbitrary.)');
      }

      this.begin();

      do {
        appendActiveWord();
      } while(instance.activeWord.end < this.size && !this.nextWord());

      this.scan(originalActiveWordStartPos);

      return byteStrings.join(' ');
    };



  // counts the number of set bits in a 32 bit word
  CmpBitVec.prototype.popcount = function popcount(v) {
    v = v - ((v >>> 1) & 0x55555555);
    v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
    return ((v + (v >>> 4) & 0xF0F0F0F) * 0x1010101) >>> 24;
  };

  // count trailing zeros in a 32 bit word
  CmpBitVec.prototype.ctz = function ctz(v) {
    var c = 32;
    v &= -v;
    if (v) c--;
    if (v & 0x0000FFFF) c -= 16;
    if (v & 0x00FF00FF) c -= 8;
    if (v & 0x0F0F0F0F) c -= 4;
    if (v & 0x33333333) c -= 2;
    if (v & 0x55555555) c -= 1;
    return c;
  };

  function checkBitVectorPair(a, b) {
    if(!a || !(a instanceof CmpBitVec)) {
      throw new Error('First bit vector for binary operation is false-y or not a CmpBitVec instance');
    }
    if(!b || !(b instanceof CmpBitVec)) {
      throw new Error('Second bit vector for binary operation is false-y or not a CmpBitVec instance');
    }
    if(a.size != b.size) {
      throw new Error('Bit vector length mismatch');
    }
  }

    module.exports = CmpBitVec;
}());