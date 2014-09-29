(function() {

  var globals = this.window;
  if(!globals) {
    globals = {
      btoa : require('btoa'),
      atob : require('atob')
    }
  };

  // this is a hack to force the javascript interpreter
  // to treat words as 32 bit integers
  var _magic = Int32Array(7);
  _magic[0] = 0x00000000; var x00000000 = _magic[0];
  _magic[1] = 0xFFFFFFFF; var xFFFFFFFF = _magic[1];
  _magic[2] = 0x80000000; var x80000000 = _magic[2];
  _magic[3] = 0x80000001; var x80000001 = _magic[3];
  _magic[4] = 0x7FFFFFFF; var x7FFFFFFF = _magic[4];
  _magic[5] = 0x00000001; var x00000001 = _magic[5];
  _magic[6] = 0x00000000; var freeSpace = _magic[6];

  // "constants"
  var TYPE_0_FILL = 0
    , TYPE_1_FILL = 1
    , TYPE_LITERAL = 2
    , TYPE_UNDEFINED = 3
    , WORD_BITS = 32;

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
      // return ((this.words[i] & x80000000) === x80000000) ? TYPE_1_FILL : TYPE_0_FILL;
      return (this.words[i] >>> 31) ? TYPE_1_FILL : TYPE_0_FILL;
    }
    return TYPE_LITERAL;
  };

  // Set active word to the first in the CmpBitVec
  CmpBitVec.prototype.begin = function() {
    if(this.size === 0) {
      return; // the CmpBitVec is empty.
    }
    this.activeWord = {
      offset : 0,
      start  : 0,
      end    : WORD_BITS,
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
    var nfills  = i32[1];
    this.count  = i32[2];
    this.nwords = i32[3];
    this.words  = i32.subarray(4, this.nwords+4);
    this.fills  = i32.subarray(4+this.nwords);

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
    if (this === bvec) return true;
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
    var buf = ArrayBuffer(4*(4 + this.nwords + nfills));
    this.packed = true;
    var i32     = new Int32Array(buf);
    i32[0]      = this.size;
    i32[1]      = nfills;
    i32[2]      = this.count;
    i32[3]      = this.nwords;
    var wordArr = i32.subarray(4, this.nwords+4);
    wordArr.set(this.words);
    this.words = wordArr;

    var fillArr = i32.subarray(4+this.nwords);
    fillArr.set(this.fills);
    this.fills = fillArr;

    this.begin();
  };
    
  // unpack a bitvector from an arrayBuffer
  CmpBitVec.prototype.unpack = function() {
    if (this.packed == false) { return; }
    this.packed = false;
    var i32 = new Int32Array(this.words.buffer);
    this.size = i32[0];
    var nfills = i32[1];
    this.count = i32[2];
    this.nwords = i32[3];
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
      WORD_BITS : this.words[this.activeWord.offset] << 5;
  };

  // move to the previous active word
  CmpBitVec.prototype.prevWord = function() {
    if (this.activeWord.offset === 0) {
      this.activeWord = {
        offset : 0,
        start  : 0,
        end    : 0,
        type   : TYPE_UNDEFINED
      }
    }
    else {
      this.activeWord.offset--;
      this.activeWord.end = this.activeWord.start;
      this.activeWord.type = this.wordType(this.activeWord.offset);
      this.activeWord.start -= (this.activeWord.type === TYPE_LITERAL) ?
        WORD_BITS : this.words[this.activeWord.offset] << 5;
    }
  };
  
  // this.activeWord is a literal that is all 0's or 1's
  // it could be preceeded by a fill word of the same type
  // so pop it off and appendFillWords(fillType,1);
  // if there is ever a need for a generic pop() function
  // it could be used here
  CmpBitVec.prototype.LiteralToFill = function(fillType) {
    this.nwords--;
    this.size -= WORD_BITS;
    if (fillType === TYPE_1_FILL) {
      this.count -= WORD_BITS;
    }
    if ((this.nwords & 31) === 0) {
      this.fills.pop();
    }
    this.words.pop();
    this.prevWord();
    this.appendFillWords(fillType,1);
  }

  CmpBitVec.prototype.activeWordIsLast = function() {
    return this.activeWord.end >= this.size;
  };

  // a little odd that .size and .count don't get updated here
  // this should be a private function to avoid confusion
  CmpBitVec.prototype.appendFillWords = function(type, nwords) {
    // extend fills bitvector
    var mod = this.nwords & 31;
    if (mod) {
      this.fills[this.fills.length - 1] |= x00000001 << mod;
    }
    else {
      this.fills.push(x00000001);
    }
    // extend words array
    if (type === TYPE_0_FILL) {
      this.words.push(x00000000 + nwords);
    }
    else {
      this.words.push(x80000000 + nwords);
      // this.count += WORD_BITS*nwords;
    }
    this.nwords++;
    if (this.activeWord.type != TYPE_UNDEFINED) {
      this.activeWord.offset++;
      this.activeWord.start = this.activeWord.end;
    }
    this.activeWord.end += WORD_BITS * nwords;
    this.activeWord.type = type;
  }

  CmpBitVec.prototype.appendWord = function(word) {
    this.ensureModifiable();

    if(this.size % WORD_BITS !== 0) {
      throw new Error('Unsupported operation: Appending a word to bit vector that ends with a partially-full literal vector');
    }

    if (word === x00000000) { // literal word is all 0's
      if (this.activeWord.type === TYPE_0_FILL) { // extends previous 0-fill
        this.words[this.activeWord.offset]++;
      }
      else { // append a 0-fill
        this.appendFillWords(TYPE_0_FILL, 1);
      }
    }
    else if (word === xFFFFFFFF) { // literal word is all 1's
      if (this.activeWord.type === TYPE_1_FILL) { // extends previous 1-fill
        this.words[this.activeWord.offset]++;
      }
      else { // append a 1-fill
        this.appendFillWords(TYPE_1_FILL, 1);
      }
      this.count += WORD_BITS;
    }
    else { // non-trivial literal
      if ((this.nwords & 31) === 0) {
        this.fills.push(x00000000);
      }
      this.words.push(word);
      this.nwords++;
      this.activeWord.type = TYPE_LITERAL;
      this.count += this.popcount(word);
    }
    this.activeWord.offset = this.nwords-1;
    this.activeWord.start  = this.size;
    this.size             += WORD_BITS;
    this.activeWord.end    = this.size;
  };

  // consolidate the appendFill logic into one function instead of 2
  // appends runLength bits of fillType = (0,1)
  CmpBitVec.prototype.appendBits = function(runLength, fillType) {
    this.ensureModifiable();

    if (fillType === TYPE_1_FILL) this.count += runLength;

    // activeWord is an unfinished literal word with some available bits
    if (this.activeWord.type === TYPE_LITERAL) {
      var remainingBits = WORD_BITS - (this.size - this.activeWord.start);
      if (remainingBits) {
        if (remainingBits >= runLength)  {
          if (fillType === TYPE_1_FILL) {
            // set the next runLength bits in the word
            var usedBits = WORD_BITS - remainingBits;
            // 2**runLength -1 gives runLength 1s. left shift usedBits to make space for existing
            // e.g. usedBits is 10, word is 00000000 00000000 00000000 00000000
            // which means that there are 22 unused bits and 10 bits set to 0, e.g.
            //                              oooooooo oooooooo oooooo00 00000000
            // so we can safely add up to 22 bits of information *to the left hand side bits*
            this.words[this.activeWord.offset] |= ((x00000001 << runLength) - 1) << usedBits;
          }
          // this literal word is still unfinished, so go away
          this.size += runLength;
          return;
        }
        if (fillType === TYPE_1_FILL) {
          var usedBits = WORD_BITS - remainingBits;
          this.words[this.activeWord.offset] |= xFFFFFFFF << usedBits;
        }
        // this literal word is now finished, but it could be a run of WORD_BITS 0's or 1's
        var word = this.words[this.activeWord.offset];
        if (word === x00000000) {
          this.LiteralToFill(TYPE_0_FILL);
        }
        else if (word === xFFFFFFFF) {
          this.LiteralToFill(TYPE_1_FILL);
        }
        runLength -= remainingBits;
        this.size += remainingBits;
      }
    }
    this.size += runLength;
    var nfills = runLength >> 5;

    if (nfills) {
      if (this.activeWord.type === fillType) {
        this.words[this.activeWord.offset]+=nfills;
        this.activeWord.end += WORD_BITS * nfills;
      }
      else {
        this.appendFillWords(fillType,nfills);
      }
      runLength &= 31;
    }
    if (runLength > 0) {
      if ((this.nwords & 31) === 0) this.fills.push(x00000000);
      if (fillType === TYPE_1_FILL) {
        this.words.push(xFFFFFFFF >>> (WORD_BITS - runLength));
      }
      else {
        this.words.push(x00000000);
      }
      this.nwords++;
      this.activeWord.start = this.activeWord.end;
      this.activeWord.end += WORD_BITS;
      this.activeWord.type = TYPE_LITERAL;
      this.activeWord.offset = this.nwords-1;
    }
  }

  CmpBitVec.prototype.appendFill0 = function(len) {
    this.appendBits(len,0);
  }
  CmpBitVec.prototype.appendFill1 = function(len) {
    this.appendBits(len,1);
  }
  
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
        if(this.equals(that)) return this;

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

        // res.pack();
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

        // res.pack();
        return res;
    };

    CmpBitVec.prototype.xor = function(that) {
        checkBitVectorPair(this, that);

        // special case.
        // TODO: potential for unpredictable behaviour: Usually we return a new CmpBitVec that shouldn't have side-effects when modified. Unless this.equals(that), in which case we return an all 0 CmpBitVec
        if(this === that || this.equals(that)) {
          var zeros = new CmpBitVec();
          zeros.appendFill0(this.size);
          return zeros;
        }

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
            if (that.activeWord.type === TYPE_0_FILL) { // 0 xor 0 = 0
              if (this.activeWord.end <= that.activeWord.end) {
                res.appendFill0(this.activeWord.end - res.size);
                advanceThis = true;
              }
              else {
                res.appendFill0(that.activeWord.end - res.size);
                advanceThat = true;
              }
            }
            else if (that.activeWord.type === TYPE_1_FILL) { // 0 xor 1 = 1
              if (this.activeWord.end <= that.activeWord.end) {
                res.appendFill1(this.activeWord.end - res.size);
                advanceThis = true;
              }
              else {
                res.appendFill1(that.activeWord.end - res.size);
                advanceThat = true;
              }
            }
            else if (that.activeWord.type === TYPE_LITERAL) { // 0 xor 010101 = 010101
              res.appendWord(that.words[that.activeWord.offset]);
              advanceThat = true;
            }
          }
          else if (this.activeWord.type === TYPE_1_FILL) {
            if (that.activeWord.type === TYPE_0_FILL) { // 1 xor 0 = 1
              if (this.activeWord.end <= that.activeWord.end) {
                res.appendFill1(this.activeWord.end - res.size);
                advanceThis = true;
              }
              else {
                res.appendFill1(that.activeWord.end - res.size);
                advanceThat = true;
              }
            }
            else if (that.activeWord.type === TYPE_1_FILL) { // 1 xor 1 = 0
              if (this.activeWord.end <= that.activeWord.end) {
                res.appendFill0(this.activeWord.end - res.size);
                advanceThis = true;
              }
              else {
                res.appendFill0(that.activeWord.end - res.size);
                advanceThat = true;
              }
            }
            else if (that.activeWord.type === TYPE_LITERAL) { // 1111111 xor 010101 = 101010
              res.appendWord(~that.words[that.activeWord.offset]);
              advanceThat = true;
            }
          }
          else if (this.activeWord.type === TYPE_LITERAL) {
            advanceThis = true;
            if (that.activeWord.type === TYPE_0_FILL) { // 010101 xor 000000 = 010101
              res.appendWord(this.words[this.activeWord.offset]);
            }
            else if (that.activeWord.type === TYPE_1_FILL) { // 010101 xor 111111 = 101010
              res.appendWord(~this.words[this.activeWord.offset]);
            }
            else if (that.activeWord.type === TYPE_LITERAL) {
              res.appendWord(this.words[this.activeWord.offset] ^ that.words[that.activeWord.offset]);
              advanceThat = true;
            }
          }
        } while(res.size < this.size);

        // truncate size of result if it's longer than the input. This happens if the last word in the xor-ed vectors
        // are not full. TODO: consider if this can be moved somewhere more sensible in future, e.g. appendWord
        if(res.size > this.size) {
          res.size = this.size;
        }

        // res.pack();
        return res;
    };

    CmpBitVec.prototype.not = function() {
        this.pack();
        // make a copy of the arrayBuffer
        var resBuffer = this.words.buffer.slice(0);
        var resi32  = new Int32Array(resBuffer);
        resi32[0] = this.size;
        resi32[1] = this.fills.length;
        resi32[2] = this.size - this.count;
        resi32[3] = this.nwords;
        // flip all the bits in each word
        for(var i=0;i<this.nwords;i++) {
          var j = i+4;
          var wt = this.wordType(i);
          if (wt === TYPE_0_FILL) resi32[j] = this.words[i] | x80000000;
          else if (wt === TYPE_1_FILL) resi32[j] = this.words[i] & x7FFFFFFF;
          else if (wt === TYPE_LITERAL) resi32[j] = ~this.words[i];
        }
        // if the last word is a literal word and does not fill the last word
        // mask flipped bits beyond the end of the vector
        if ((this.size & 31) && this.wordType(this.nwords-1) === TYPE_LITERAL) {
            resi32[this.nwords + 3] &= (xFFFFFFFF >>> (WORD_BITS - (this.size & 31)));
        }
        var result = new CmpBitVec();
        result.loadFromArrayBuffer(resBuffer);
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
            freeSpace = this.words[this.activeWord.offset] & (xFFFFFFFF << (pos - this.activeWord.start));

            if (freeSpace === 0) return this.nextSetBitInclusive(this.activeWord.end);
            else return this.activeWord.start + this.ctz(freeSpace);
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
            byteStrings.push('<empty>');
            break;
          default:
            throw new Error("activeWord has undefined state");
        }
      }}

      function pushBytesOfActiveLiteralWord() {
        var byteString = ''
          , theWord = instance.words[instance.activeWord.offset]
          , numBytesDefined = instance.size - instance.activeWord.start
          , firstLittleEndianByteDefined = WORD_BITS - numBytesDefined;

        for (var i = 0; i < WORD_BITS; i++) {
          byteString += (theWord & x80000000) ? '1' : (i >= firstLittleEndianByteDefined ? '0' : 'x');
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
    var c = WORD_BITS;
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

  // https://stackoverflow.com/questions/9267899/arraybuffer-to-base64-encoded-string
  CmpBitVec.bufferToBase64 = function(buffer) {
    var binary = '';
    var bytes = new Uint8Array( buffer );
    var len = bytes.byteLength;
    for (var i = 0; i < len; i++) {
      binary += String.fromCharCode( bytes[ i ] )
    }
    return globals.btoa( binary );
  };

  // http://stackoverflow.com/questions/21797299/convert-base64-string-to-arraybuffer
  CmpBitVec.base64ToBuffer = function(base64) {
    var binary_string =  globals.atob(base64);
    var len = binary_string.length;
    var bytes = new Uint8Array( len );
    for (var i = 0; i < len; i++)        {
      var ascii = binary_string.charCodeAt(i);
      bytes[i] = ascii;
    }
    return bytes.buffer;
  };

    module.exports = CmpBitVec;
}());