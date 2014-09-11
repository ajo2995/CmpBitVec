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
            end    : 32,
            type   : TYPE_UNDEFINED // types are 0-fill, 1-fill, literal (2), 3 is undefined
        };
    }

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
    CmpBitVec.prototype.load = function(buf) {
        this.packed = true;
        var i32     = new Int32Array(buf);
        this.size   = i32[0];
        this.count  = i32[1];
        this.nwords = i32[2];
        this.words  = i32.subarray(3, this.nwords+3);
        this.fills  = i32.subarray(3+this.nwords);

        this.begin();
    };

    // copy a bitvector into an ArrayBuffer
    CmpBitVec.prototype.pack = function() {
        if (this.packed) { return; }
        var nfills = ((this.nwords-1) >>> 5) + 1;
        var buf = ArrayBuffer(4*(3 + this.nwords + nfills));
        this.packed = true;
        var i32     = new Int32Array(buf);
        i32[0]      = this.size;
        i32[1]      = this.count;
        i32[2]      = this.nwords;
        var wordArr = i32.subarray(3, this.nwords+3);
        var fillArr = i32.subarray(3+this.nwords);
        for(var i=0; i<this.nwords; i++) {
            wordArr[i] = this.words[i];
        }
        this.words = wordArr;
        for(i=0; i<nfills; i++) {
            fillArr[i] = this.fills[i];
        }
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

    CmpBitVec.prototype.appendWord = function(word) {
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
                this.words[activeWord.offset]++;
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
            if (this.nwords & 31 === 0) {
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
        this.activeWord.end    = size;
    };

    CmpBitVec.prototype.appendFill0 = function(len) {
        if (this.activeWord.type === TYPE_LITERAL) { // extend current LITERAL word
            var remainingBits = 32 - (this.size - this.activeWord.start);
            this.size += len;
            if (remainingBits >= len) return;
            len -= remainingBits;
            if (len) this.activeWord.start += 32;
        }
        else if (this.activeWord.type === TYPE_1_FILL) this.size += len;
        else if (this.activeWord.type === TYPE_0_FILL) {
            this.size += len;
            var nfills = len >>> 5;
            if (nfills) {
                this.words[this.nwords-1] += nfills;
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
            this.activeWord.start += (nfills << 5);
            len &= 31;
        }
        if (len > 0) {
            if ((this.nwords & 31) === 0) this.fills.push(_magic[x00000000]);
            this.words.push(_magic[x00000000]);
            this.nwords++;
            this.activeWord.type = TYPE_LITERAL;
            this.activeWord.offset = this.nwords-1;
        }
    };

    CmpBitVec.prototype.appendFill1 = function(len) {
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
            if (len) this.activeWord.start += 32;
        }
        else if (this.activeWord.type === TYPE_0_FILL) {
            this.size += len;
        }
        else if (this.activeWord.type === TYPE_1_FILL) {
            this.size += len;
            var nfills = len >>> 5;
            if (nfills) {
                this.words[this.nwords-1] += nfills;
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
            this.words.push(_magic[x80000000] + nfills);
            this.activeWord.offset = this.nwords;
            this.nwords++;
            this.activeWord.type = TYPE_1_FILL;
            this.activeWord.start += nfills << 5;
            len &= 31;
        }
        if (len > 0) {
            // set length bits to 1 in literal word
            if ((this.nwords & 31) === 0) this.fills.push(_magic[x00000000]);
            this.words.push(_magic[xFFFFFFFF] >>> (32 - len));
            this.activeWord.offset = this.nwords;
            this.nwords++;
            this.activeWord.type = TYPE_LITERAL;
        }
    };

    // return the logical AND of two CmpBitVec objects
    CmpBitVec.prototype.and = function(that) {
        var res = new CmpBitVec();
        this.begin();
        that.begin();
        while (this.activeWord.offset < this.nwords && that.activeWord.offset < that.nwords) {
            // advance until words overlap
            while (this.activeWord.end <= that.activeWord.start) { this.nextWord(); }
            while (that.activeWord.end <= this.activeWord.start) { that.nextWord(); }
            // compare overlapping words
            if (this.activeWord.type === TYPE_0_FILL) { // 0-fill
                res.appendFill0(this.activeWord.end - res.size);
                this.nextWord();
            }
            else if (this.activeWord.type === TYPE_1_FILL) { // 1-fill
                if (that.activeWord.type === TYPE_0_FILL) { // 1-fill vs 0-fill
                    res.appendFill0(that.activeWord.end - res.size);
                    that.nextWord();
                }
                else if (that.activeWord.type === TYPE_1_FILL) { // 1-fill vs 1-fill
                    if (this.activeWord.end <= that.activeWord.end) {
                        res.appendFill1(this.activeWord.end - res.size);
                        this.nextWord();
                    }
                    else {
                        res.appendFill1(that.activeWord.end - res.size);
                        that.nextWord();
                    }
                }
                else if (that.activeWord.type === TYPE_LITERAL) { // 1-fill vs literal
                    res.appendWord(that.words[that.activeWord.offset]);
                    that.nextWord();
                }
            }
            else if (this.activeWord.type === TYPE_LITERAL) { // literal
                if (that.activeWord.type === TYPE_0_FILL) { // literal vs 0-fill
                    res.appendFill0(that.activeWord.end - res.size);
                    that.nextWord();
                }
                else if (that.activeWord.type === TYPE_1_FILL) { // literal vs 1-fill
                    res.appendWord(this.words[this.activeWord.offset]);
                    this.nextWord();
                }
                else if (that.activeWord.type === TYPE_LITERAL) { // literal vs literal
                    res.appendWord(this.words[this.activeWord.offset] & that.words[that.activeWord.offset]);
                    this.nextWord();
                    that.nextWord();
                }
            }
        }
        res.pack();
        return res;
    };

    CmpBitVec.prototype.or = function(that) {
        var res = new CmpBitVec();
        this.begin();
        that.begin();
        while (this.activeWord.offset < this.nwords && that.activeWord.offset < that.nwords) {
            // advance until words overlap
            while (this.activeWord.end <= that.activeWord.start) { this.nextWord(); }
            while (that.activeWord.end <= this.activeWord.start) { that.nextWord(); }
            // compare overlapping words
            if (this.activeWord.type === TYPE_0_FILL) { // 0-fill
                if (that.activeWord.type === TYPE_0_FILL) { // 0-fill vs 0-fill
                    if (this.activeWord.end <= that.activeWord.end) {
                        res.appendFill0(this.activeWord.end - res.size);
                        this.nextWord();
                    }
                    else {
                        res.appendFill0(that.activeWord.end - res.size);
                        that.nextWord();
                    }
                }
                else if (that.activeWord.type === TYPE_1_FILL) { // 0-fill vs 1-fill
                    res.appendFill1(that.activeWord.end - res.size);
                    that.nextWord();
                }
                else if (that.activeWord.type === TYPE_LITERAL)  { // 0-fill vs literal
                    res.appendWord(that.words[that.activeWord.offset]);
                    that.nextWord();
                }
            }
            else if (this.activeWord.type === TYPE_1_FILL) { // 1-fill
                res.appendWord(this.words[this.activeWord.offset]);
                this.nextWord();
            }
            else if (this.activeWord.type === TYPE_LITERAL) { // literal
                if (that.activeWord.type === TYPE_0_FILL) { // literal vs 0-fill
                    res.appendWord(this.words[this.activeWord.offset]);
                    this.nextWord();
                }
                else if (that.activeWord.type === TYPE_1_FILL) { // literal vs 1-fill
                    res.appendFill1(that.activeWord.end - res.size);
                    that.nextWord();
                }
                else if (that.activeWord.type === TYPE_LITERAL) { // literal vs literal
                    res.appendWord(this.words[this.activeWord.offset] | that.words[that.activeWord.offset]);
                    this.nextWord();
                    that.nextWord();
                }
            }
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

    CmpBitVec.prototype.scan = function(wordStart) {
        if ((this.activeWord.start <= wordStart) && (wordStart < this.activeWord.end)) return;
        while (this.activeWord.end <= wordStart) this.nextWord();
        while (this.activeWord.start > wordStart) this.prevWord();
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
        , stringRepresentation = '';

      function stringRepOfActiveLiteralWord() {
        var wordString = ''
          , theWord = instance.words[instance.activeWord.offset];

        for (var i = 0; i < 32; i++) {
          wordString += (theWord & _magic[x80000000]) ? '1' : '0';
          if(i % 8 === 7) wordString += ' ';
          theWord <<= 1;
        }

        return wordString;
      }

      function appendActiveWord() {
        switch(instance.activeWord.type) {
          case TYPE_0_FILL:
            stringRepresentation += '00000000 00000000 00000000 00000000 ';
            break;
          case TYPE_1_FILL:
            stringRepresentation += '11111111 11111111 11111111 11111111 ';
            break;
          case TYPE_LITERAL:
            stringRepresentation += stringRepOfActiveLiteralWord();
            break;
          case TYPE_UNDEFINED:
          default:
            throw new Error("activeWord has undefined state");
        }
      }

      this.begin();

      while(true) {
        appendActiveWord();
        if(instance.activeWord.end >= this.size) {
          break;
        }
        else {
          this.nextWord();
        }
      }

      return stringRepresentation.substring(0, stringRepresentation.length - 1);
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


    module.exports = CmpBitVec;
}());