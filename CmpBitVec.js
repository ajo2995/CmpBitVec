(function() {
var _magic = Int32Array(7);
_magic[0] = 0x00000000;
_magic[1] = 0xFFFFFFFF;
_magic[2] = 0x80000000;
_magic[3] = 0x80000001;
_magic[4] = 0x7FFFFFFF;
_magic[5] = 0x00000001;
_magic[6] = 0x00000000; // free space

var x00000000 = 0;
var xFFFFFFFF = 1;
var x80000000 = 2;
var x80000001 = 3;
var x7FFFFFFF = 4;
var x00000001 = 5;
var freeSpace = 6;

function popcount(v) {
    v = v - ((v >>> 1) & 0x55555555);
    v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
    return ((v + (v >>> 4) & 0xF0F0F0F) * 0x1010101) >>> 24;
}

function ctz(v) {
    var c = 32;
    v &= -v;
    if (v) c--;
    if (v & 0x0000FFFF) c -= 16;
    if (v & 0x00FF00FF) c -= 8;
    if (v & 0x0F0F0F0F) c -= 4;
    if (v & 0x33333333) c -= 2;
    if (v & 0x55555555) c -= 1;
    return c;
}

var CmpBitVec = function() {
    this.packed = false;
    this.size   = 0;
    this.count  = 0;
    this.nwords = 0;
    this.words  = [];
    this.fills  = [];
    this.activeWord = {
        offset : 0,
        start  : 0,
        end    : 32,
        type   : 2
    };
}

CmpBitVec.prototype.isFill = function(i) {
    return this.fills[i >>> 5] & i & 31;
};

CmpBitVec.prototype.wordType = function(i) {
    if (this.isFill) {
        return (this.words[i] < 0) ? 1 : 0;
    }
    return 2;
};

CmpBitVec.prototype.begin = function() {
    this.activeWord = {
        offset : 0,
        start  : 0,
        end    : 32,
        type   : this.wordType(0)
    };
    if (this.activeWord.type !== 2) {
        this.activeWord.end = (this.words[0] << 5);
    }
};

// load a bitvector from an ArrayBuffer
CmpBitVec.prototype.load = function(buf) {
    this.packed = true;
    this.buffer = buf; // not sure if I need this (scope?)
    this.i32    = new Int32Array(buf);
    this.size   = i32[0];
    this.count  = i32[1];
    this.nwords = i32[2];
    this.words  = i32.subarray(3, this.nwords+2);
    this.fills  = i32.subarray(3+this.nwords);

    this.begin();
};

// copy a bitvector into an ArrayBuffer
CmpBitVec.prototype.pack = function() {
    if (this.packed) { return; }
    var nfills = ((this.nwords-1) >>> 5) + 1;
    var buf = ArrayBuffer(4*(3 + this.nwords + nfills));
    this.packed = true;
    this.buffer = buf;
    var i32    = new Int32Array(buf);
    i32[0]      = this.size;
    i32[1]      = this.count;
    i32[2]      = this.nwords;
    var words   = i32.subarray(3, this.nwords+2);
    var fills   = i32.subarray(3+this.nwords);
    this.i32 = i32;
    for(var i=0; i<this.nwords; i++) {
        words[i] = this.words[i];
    }
    this.words = words;
    for(i=0; i<nfills; i++) {
        fills[i] = this.fills[i];
    }
    this.fills = fills;

    this.begin();
};

// advance to the next active word
CmpBitVec.prototype.nextWord = function() {
    this.activeWord.offset++;
    this.activeWord.start = this.activeWord.end;
    this.activeWord.type  = this.wordType(this.activeWord.offset);
    this.activeWord.end  += (this.activeWord.type === 2) ?
        32 : this.words[this.activeWord.offset] << 5;
};

// move to the previous active word
CmpBitVec.prototype.prevWord = function() {
    this.activeWord.offset--;
    this.activeWord.end = this.activeWord.start;
    this.activeWord.type = this.wordType(this.activeWord.offset);
    this.activeWord.start -= (this.activeWord.type === 2) ?
        32 : this.words[this.activeWord.offset] << 5;
};

CmpBitVec.prototype.appendWord = function(word) {
    if (word === _magic[x00000000]) { // 0-fill
        if (this.activeWord.type === 0) { // extends previous 0-fill
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
            this.activeWord.type = 0;
        }
    }
    else if (word === _magic[xFFFFFFFF]) { // 1-fill
        if (this.activeWord.type === 1) { // extends previous 1-fill
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
            this.activeWord.type = 1;
            this.count += 32;
        }
    }
    else { // literal
        if (this.nwords & 31 === 0) {
            this.fills.push(_magic[x00000000]);
        }
        this.words.push(word);
        this.nwords++;
        this.activeWord.type = 2;
        this.count += popcount(word);
    }
    this.activeWord.offset = this.nwords-1;
    this.activeWord.start  = this.size;
    this.size             += 32;
    this.activeWord.end    = size;
};

CmpBitVec.prototype.appendFill0 = function(len) {
    if (this.activeWord.type === 2) { // extend current LITERAL word
        var remainingBits = 32 - (this.size - this.activeWord.start);
        this.size += len;
        if (remainingBits >= len) return;
        len -= remainingBits;
        if (len) this.activeWord.start += 31;
    }
    else if (this.activeWord.type === 1) this.size += len;
    else if (this.activeWord.type === 0) {
        this.size += len;
        var nfills = len >>> 5;
        if (nfills) {
            this.words[this.nwords-1] += nfills;
            len &= 31;
        }
    }
    else this.size += len;

    var nfills = len >>> 5;
    if (nfills) {
        var mod = this.nwords & 31;
        if (mod) this.fills[this.fills.length - 1] |= _magic[x00000001] << mod;
        else this.fills.push(_magic[x00000001]);
        this.words.push(_magic[x00000000] + nfills);
        this.nwords++;
        this.activeWord.offset = this.nwords-1;
        this.activeWord.type = 0;
        this.activeWord.start += (nfills << 5);
        len &= 31;
    }
    if (len > 0) {
        if (this.nwords & 31 === 0) this.fills.push(_magic[x00000000]);
        this.words.push(_magic[x00000000]);
        this.nwords++;
        this.activeWord.type = 2;
        this.activeWord.offset = this.nwords-1;
    }
};

CmpBitVec.prototype.appendFill1 = function(len) {
    this.count += len;
    if (this.activeWord.type === 2) { // extend current LITERAL word
        var usedBits = this.size - this.activeWord.start;
        var remainingBits = 32 - usedBits;
        this.size += len;
        if (remainingBits) {
            if (len < remainingBits) {
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
    else if (this.activeWord.type === 0) {
        this.size += len;
    }
    else if (this.activeWord.type === 1) {
        this.size += len;
        var nfills = len >>> 5;
        if (nfills) {
            this.words[this.nwords-1] += nfills;
            len &= 31;
        }
    }
    else this.size += len;

    var nfills = len >>> 5;
    if (nfills) {
        var mod = this.nwords & 31;
        if (mod) this.fills[this.fills.length - 1] |= _magic[x00000001] << mod;
        else this.fills.push(_magic[x00000001]);
        this.words.push(_magic[x80000000] + nfills);
        this.activeWord.offset = this.nwords;
        this.nwords++;
        this.activeWord.type = 1;
        this.activeWord.start += nfills << 5;
        len &= 31;
    }
    if (len > 0) {
        // set length bits to 1 in literal word
        if (this.nwords & 31 === 0) this.fills.push(_magic[x00000000]);
        this.words.push(_magic[xFFFFFFFF] >>> 32 - len);
        this.activeWord.offset = this.nwords;
        this.nwords++;
        this.activeWord.type = 2;
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
        if (this.activeWord.type === 0) { // 0-fill
            res.appendFill0(this.activeWord.end - res.size);
            this.nextWord();
        }
        else if (this.activeWord.type === 1) { // 1-fill
            if (that.activeWord.type === 0) { // 1-fill vs 0-fill            
                res.appendFill0(that.activeWord.end - res.size);
                that.nextWord();
            }
            else if (that.activeWord.type === 1) { // 1-fill vs 1-fill
                if (this.activeWord.end <= that.activeWord.end) {
                    res.appendFill1(this.activeWord.end - res.size);
                    this.nextWord();
                }
                else {
                    res.appendFill1(that.activeWord.end - res.size);
                    that.nextWord();
                }
            }
            else if (that.activeWord.type === 2) { // 1-fill vs literal
                res.appendWord(that.words[that.activeWord.offset]);
                that.nextWord();
            }
        }
        else if (this.activeWord.type === 2) { // literal
            if (that.activeWord.type === 0) { // literal vs 0-fill
                res.appendFill0(that.activeWord.end - res.size);
                that.nextWord();
            }
            else if (that.activeWord.type === 1) { // literal vs 1-fill
                res.appendWord(this.words[this.activeWord.offset]);
                this.nextWord();
            }
            else if (that.activeWord.type === 2) { // literal vs literal
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
        if (this.activeWord.type === 0) { // 0-fill
            if (that.activeWord.type === 0) { // 0-fill vs 0-fill
                if (this.activeWord.end <= that.activeWord.end) {
                    res.appendFill0(this.activeWord.end - res.size);
                    this.nextWord();
                }
                else {
                    res.appendFill0(that.activeWord.end - res.size);
                    that.nextWord();
                }
            }
            else if (that.activeWord.type === 1) { // 0-fill vs 1-fill
                res.appendFill1(that.activeWord.end - res.size);
                that.nextWord();
            }
            else if (that.activeWord.type === 2)  { // 0-fill vs literal
                res.appendWord(that.words[that.activeWord.offset]);
                that.nextWord();
            }
        }
        else if (this.activeWord.type === 1) { // 1-fill
            res.appendWord(this.words[this.activeWord.offset]);
            this.nextWord();
        }
        else if (this.activeWord.type === 2) { // literal
            if (that.activeWord.type === 0) { // literal vs 0-fill
                res.appendWord(this.words[this.activeWord.offset]);
                this.nextWord();
            }
            else if (that.activeWord.type === 1) { // literal vs 1-fill
                res.appendFill1(that.activeWord.end - res.size);
                that.nextWord();
            }
            else if (that.activeWord.type === 2) { // literal vs literal
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
    var resBuffer = this.buffer.slice(0);
    var resi32   = new Int32Array(resBuffer);
    resi32[0] = this.size;
    resi32[1] = this.size - this.count;
    resi32[2] = this.nwords;
    // flip all the bits in each word
    for(var i=0;i<this.nwords;i++) {
        if (this.fills[i >>> 5] & i & 31) {
            // toggle MSB
            resi32[i+3]  = (this.words[i] < 0) ? this.words[i] & _magic[x7FFFFFFF] : this.words[i] | _magic[x80000000];
        }
        else {
            resi32[i+3] = ~resi32[i+3];
        }
    }
    var result = new CmpBitVec();
    result.load(resBuffer);
    return result;
};

CmpBitVec.prototype.scan = function(wordStart) {
    if ((this.activeWord.start <= wordStart) && (wordStart < this.activeWord.end)) return;
    while (this.activeWord.end <= wordStart) this.nextWord();
    while (this.activeWord.start > wordStart) this.prevWord();
}

CmpBitVec.prototype.nextSetBit = function(pos) {
    if (pos > this.size) return -1;
    this.scan(pos);
    if (this.activeWord.type === 2) {
        _magic[freeSpace] = this.words[this.activeWord.offset] & (_magic[xFFFFFFFF] << (pos - this.activeWord.start));

        if (_magic[freeSpace] === 0) return this.nextSetBit(this.activeWord.end);
        else return this.activeWord.start + ctz(_magic[freeSpace]);
    }
    else if (this.activeWord.type === 1) return pos;
    else return this.nextsetBit(this.activeWord.end);
};

module.exports = CmpBitVec;
}())