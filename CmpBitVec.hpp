#ifndef CMPBITVEC_H
#define CMPBITVEC_H
#include <cstdio>
#include <vector>
using namespace std;
#define TYPE_0_FILL 0
#define TYPE_1_FILL 1
#define TYPE_LITERAL 2
#define TYPE_UNDEFINED 3

template <class T>
class CmpBitVec {
public:
    CmpBitVec(); // constructor
    CmpBitVec(T *buf); // reconstructor
    size_t serialize(T **buf); // serialize

    // for sequential access
    void begin();
    void end();
    void nextWord();  // advance to next word
    void prevWord();

    void appendWord(T word); // append uncompressed bits in word
    void appendBits(size_t runLength, char fillType); // append runLength 0's or 1's.

    // deprecated interface - use appendBits()
    void appendFill0(size_t runLength) { appendBits(runLength, TYPE_0_FILL); }
    void appendFill1(size_t runLength) { appendBits(runLength, TYPE_1_FILL); }

    void inflateWord(T *word, size_t wordStart); // fills a word with uncompressed bits starting at wordStart (for random access)
    void inflateNextWord(T *word, size_t wordStart); // fills a word with uncompressed bits starting at wordStart (for sequential access)

    bool nextSetBitInclusive(size_t *idx);
    
    CmpBitVec<T>* operator&(CmpBitVec<T>* rhs); // and
    CmpBitVec<T>* operator|(CmpBitVec<T>* rhs); // or
    CmpBitVec<T>* operator^(CmpBitVec<T>* rhs); // xor
    CmpBitVec<T>* operator~();                  // not


private:
    vector<T> words; // a mix of literal and fill words. MSB of fill words is the type of fill
    vector<T> fills; // uncompressed bit vector indicating which words are fills
    T count;         // the number of set bits
    T size;          // bits in the uncompressed CmpBitVec
    T nbits;         // number of bits per LITERAL word sizeof(T)*8
    T modBits;       // nbits-1
    T shiftby;       // log base 2 of nbits
    T oneFill;       // 1000...0000

    // extras to enable random access
    bool randomAccess;   // flag indicating whether we have setupRandomAccess()
    vector<T> fillStart; // start positions of fill words in uncompressed CmpBitVec
    vector<T> fillIdx;   // words[fillIdx[i]] is the ith fill word
    void setupRandomAccess();

    // used for iterating
    struct activeWord_t {
        size_t offset; // offset in words vector
        size_t start;  // uncompressed bit position at start of word
        size_t end;    // uncompressed bit position after last bit in a word
        char   type;   // TYPE_0_FILL, TYPE_1_FILL, TYPE_LITERAL, TYPE_UNDEFINED
    } activeWord;

    bool isFill(size_t wordIdx);
    char wordType(size_t wordIdx);

    // helper functions for appendBits()
    void appendFillWords(size_t n, char fillType);
    void literalToFill(char fillType);

    void seek(size_t pos); // locate the activeWord that contains pos (randomAccess)
    void scan(size_t pos); // sequential scan
};

// overloading find first set bit, count leading zeros, and popcount gcc builtin functions
int my_ffs(unsigned long long x) { return __builtin_ffsll(x); }
int my_ffs(unsigned long      x) { return __builtin_ffsl (x); }
int my_ffs(unsigned int       x) { return __builtin_ffs  (x); }
int my_ctz(unsigned long long x) { return __builtin_ctzll(x); }
int my_ctz(unsigned long      x) { return __builtin_ctzl (x); }
int my_ctz(unsigned int       x) { return __builtin_ctz  (x); }
int my_pop(unsigned long long x) { return __builtin_popcountll(x); }
int my_pop(unsigned long      x) { return __builtin_popcountl (x); }
int my_pop(unsigned           x) { return __builtin_popcount  (x); }

// constructor
template <class T>
CmpBitVec<T>::CmpBitVec() {
    nbits = sizeof(T)*8;
    modBits = nbits-1;
    oneFill = T(1) << modBits;
    shiftby = my_ctz(nbits);
    count = 0;
    size  = 0;
    activeWord.offset   = 0;
    activeWord.start = 0;
    activeWord.end   = 0;
    activeWord.type  = TYPE_UNDEFINED;
    randomAccess = false;
}

// constructor - given a previously dumped CmpBitVec
template <class T>
CmpBitVec<T>::CmpBitVec(T *buf) {
    nbits = sizeof(T)*8;
    modBits = nbits-1;
    oneFill = T(1) << modBits;
    shiftby = my_ctz(nbits);
    T nwords = buf[0];
    T nfills = buf[1];
    size  = buf[2];
    count = buf[3];
    words.resize(nwords);
    memcpy(words.data(),buf+4,nwords*sizeof(T));
    if (words.size() != nwords) {
        fprintf(stderr,"words.size() != nwords %zi %zi\n",words.size(),nwords);
        exit(1);
    }
    fills.resize(nfills);
    memcpy(fills.data(),buf + 4 + nwords, nfills*sizeof(T));
    if (fills.size() != nfills) {
        fprintf(stderr,"fills.size() != nfills %zi %zi\n",fills.size(),nfills);
        exit(1);
    }

    begin();
    randomAccess = false;
}

// returns true if words[wordIdx] is a fill word
template <class T>
bool CmpBitVec<T>::isFill(size_t wordIdx) {
    if (wordIdx < 0 || wordIdx >= words.size()) {
        fprintf(stderr,"word out of bounds\n");
        exit(1);
    }
    return ((fills[wordIdx >> shiftby] >> (wordIdx & modBits)) & 1);
}

// returns the type of words[wordIdx]
template <class T>
char CmpBitVec<T>::wordType(size_t wordIdx) {
    if (isFill(wordIdx)) {
        return (words[wordIdx] >> modBits) ? TYPE_1_FILL : TYPE_0_FILL;
    }
    return TYPE_LITERAL;
}

// moves activeWord struct to beginning of the vector
template <class T>
void CmpBitVec<T>::begin() {
    activeWord.offset = 0;
    activeWord.start  = 0;
    activeWord.end    = nbits;
    activeWord.type   = wordType(0);
    if (activeWord.type != TYPE_LITERAL)
        activeWord.end = words[0] << shiftby;
}

// moves activeWord struct to the end of the vector
template <class T>
void CmpBitVec<T>::end() {
    activeWord.offset = words.size() - 1;
    activeWord.type   = wordType(activeWord.offset);
    if (activeWord.type == TYPE_LITERAL) {
        activeWord.start  = size & ~modBits;
        activeWord.end = activeWord.start + nbits;
    }
    else {
        activeWord.end = (size & ~modBits) + nbits;
        activeWord.start = activeWord.end - (words[activeWord.offset] << shiftby);
    }
}

// moves activeWord to the next word
template <class T>
void CmpBitVec<T>::nextWord() {
    activeWord.offset++;
    activeWord.start = activeWord.end;
    activeWord.type = wordType(activeWord.offset);
    if (activeWord.type != TYPE_LITERAL)
        activeWord.end = activeWord.start + (words[activeWord.offset] << shiftby);
    else
        activeWord.end = activeWord.start + nbits;
}

// moves avtiveWord to the previous word
template <class T>
void CmpBitVec<T>::prevWord() {
    if (activeWord.offset == 0) {
        activeWord.start = 0;
        activeWord.end = 0;
        activeWord.type = TYPE_UNDEFINED;
    }
    else {
        activeWord.offset--;
        activeWord.end = activeWord.start;
        activeWord.type = wordType(activeWord.offset);
        activeWord.start -= (activeWord.type == TYPE_LITERAL) ? nbits : words[activeWord.offset] << shiftby;
    }
}

// serialize the CmpBitVec and return the number of words used
template <class T>
size_t CmpBitVec<T>::serialize(T **buf) {
    size_t nwords = 4 + words.size() + fills.size();
    *buf = (T *) malloc(sizeof(T)*nwords);
    if (*buf == NULL) {
        fprintf(stderr,"failed to allocate %zi bytes\n",sizeof(T)*nwords);
        exit(4);
    }
    (*buf)[0] = (T) words.size();
    (*buf)[1] = (T) fills.size();
    (*buf)[2] = (T) size;
    (*buf)[3] = (T) count;
    memcpy(*buf + 4,                words.data(), words.size()*sizeof(T));
    memcpy(*buf + 4 + words.size(), fills.data(), fills.size()*sizeof(T));
    return nwords;
}

// appends a fillType fill word of n*nbits
// warning: does not modify size or count 
template <class T>
void CmpBitVec<T>::appendFillWords(size_t n, char fillType) {
    int mod = words.size() & modBits;
    if (mod)
        fills[fills.size()-1] |= (T)1 << mod;
    else
        fills.push_back((T)1);
    if (fillType == TYPE_0_FILL)
        words.push_back((T)n);
    else
        words.push_back(oneFill + n);
    if (activeWord.type != TYPE_UNDEFINED) {
        activeWord.offset++;
        activeWord.start = activeWord.end;
    }
    activeWord.end += nbits * n;
    activeWord.type = fillType;
}

// appends nbits
template <class T>
void CmpBitVec<T>::appendWord(T word) {
    if (word == (T)0) // 0-fill
        if (activeWord.type == TYPE_0_FILL) // extends previous 0-fill
            words[activeWord.offset]++;
        else // append a 0-fill
            appendFillWords(1, TYPE_0_FILL);
    else if (word == (T)~(T)0) {// 1-fill
        if (activeWord.type == TYPE_1_FILL) // extends previous 1-fill
            words[activeWord.offset]++;
        else // append a 1-fill
            appendFillWords(1, TYPE_1_FILL);
        count += nbits;
    }
    else { // literal
        if ((words.size() & modBits) == 0) // need another word in isFill
            fills.push_back((T)0);
        words.push_back(word);
        activeWord.type = TYPE_LITERAL;
        count += my_pop(word);
    }
    activeWord.offset = words.size()-1;
    activeWord.start  = size;
    size             += nbits;
    activeWord.end    = size;
}

// converts a homogenous literal to a fill word
// possibly merging with previous fill word
template <class T>
void CmpBitVec<T>::literalToFill(char fillType) {
    words.pop();
    size -= nbits;
    if (fillType == TYPE_1_FILL) count -= nbits;
    if ((words.size() & modBits) == 0) fills.pop();
    prevWord();
    appendFillWords(1,fillType);
}

// appends runLength bits of the given fillType
template <class T>
void CmpBitVec<T>::appendBits(size_t runLength, char fillType) {
    if (runLength == 0) return;
    if (fillType == TYPE_1_FILL) count += runLength;
    if (activeWord.type == TYPE_LITERAL) {
        int remainingBits = nbits - (size - activeWord.start);
        if (remainingBits) {
            if (remainingBits >= runLength) {
                if (fillType == TYPE_1_FILL) {
                    int usedBits = nbits - remainingBits;
                    words[activeWord.offset] |= (((T)1 << runLength) - 1) << usedBits;
                }
                size += runLength;
                return;
            }
            if (fillType == TYPE_1_FILL) {
                int usedBits = nbits - remainingBits;
                words[activeWord.offset] |= (T)~(T)0 << usedBits; 
            }
            if (words[activeWord.offset] == (T)0 || words[activeWord.offset] == (T)~(T)0)
                literalToFill(fillType);
            runLength -= remainingBits;
            size += remainingBits;
        }
    }
    size += runLength;
    T nfills = (T) runLength >> shiftby;
    if (nfills > 0) {
        if (activeWord.type == fillType) {
            words[activeWord.offset] += nfills;
            activeWord.end += nbits * nfills;
        }
        else
            appendFillWords(nfills, fillType);
        runLength &= modBits;
    }
    if (runLength > 0) {
        if ((words & modBits) == 0) fills.push_back((T)0);
        if (fillType == TYPE_1_FILL) words.push_back((T)~(T)0 >> (nbits - runLength));
        else words.push_back((T)0);
        activeWord.start = activeWord.end;
        activeWord.end += nbits;
        activeWord.type = TYPE_LITERAL;
        activeWord.offset = words.size()-1;
    }
}
    
// sequential scan to locate the word that contains pos
template <class T>
void CmpBitVec<T>::scan(size_t pos) {
    if ((activeWord.start <= pos) && (pos < activeWord.end)) return; // already here
    while (activeWord.end <= pos) nextWord();
    while (activeWord.start > pos) prevWord();
}

// populate the fillStart and fillIdx vectors
// to support binary search O(lg(fills.size()))
template <class T>
void CmpBitVec<T>::setupRandomAccess() {
    // first populate fillIdx
    // fprintf(stderr,"setupRandomAccess()\n");
    T idx=0;
    
    for(typename vector<T>::iterator it = fills.begin(); it < fills.end(); it++) {
        T bits = *it;
        while (bits) {
            fillIdx.push_back(idx + my_ffs(bits) - 1);
            bits &= bits-1;
        }
        idx += nbits;
    }
    // poplulate fillStart
    T startPos=0;
    idx=0;
    for(typename vector<T>::iterator it = fillIdx.begin(); it < fillIdx.end(); it++) {
        startPos += (*it - idx) * nbits;
        fillStart.push_back(startPos);
        startPos += words[*it] << shiftby;
        idx = *it + 1;
    }
    randomAccess = true;
}

// locate the word that contains pos with binary search
template <class T>
void CmpBitVec<T>::seek(size_t pos) {
    if ((activeWord.start <= pos) && (pos < activeWord.end)) return; // already here

    if (!randomAccess) setupRandomAccess();

    activeWord.offset=0;
    activeWord.start=0;
    if(fillStart.size() > 0) {
        typename vector<T>::iterator ub = upper_bound(fillStart.begin(),fillStart.end(),pos);
        // ub points to first fill word that starts after pos or fillStarts.end() if none
        if (ub != fillStart.begin()) { // there are fill words starting <= pos
            ub--;
            // is pos in the previous fill?
            activeWord.offset = fillIdx[ub - fillStart.begin()];
            activeWord.end = *ub + (words[activeWord.offset] << shiftby);
            if (pos < activeWord.end) {// found it!
                activeWord.start = *ub;
                if (words[activeWord.offset] >> (nbits-1))
                    activeWord.type = TYPE_1_FILL;
                else
                    activeWord.type = TYPE_0_FILL;
                return;
            }
            // pos is in the subsequent literal word(s)
            activeWord.start = activeWord.end;
            activeWord.offset++;
        }
    }
    size_t offset = (pos - activeWord.start) >> shiftby;
    activeWord.offset += offset;
    activeWord.start += nbits*offset;
    activeWord.end = activeWord.start + nbits;
    activeWord.type = TYPE_LITERAL;
}

// fills a word shaped uncompressed CmpBitVec starting at wordStart
template <class T>
void CmpBitVec<T>::inflateWord(T *word, size_t wordStart) {
    if (words.size() < nbits) 
        scan(wordStart);
    else
        seek(wordStart);
    if (activeWord.type == TYPE_LITERAL)
        *word = words[activeWord.offset];
    else if (activeWord.type == TYPE_1_FILL)
        *word = (T)~(T)0;
    else
        *word = (T)0;
}

// fills a word of bits starting at wordStart
template <class T>
void CmpBitVec<T>::inflateNextWord(T *word, size_t wordStart) {
    scan(wordStart);
    if (activeWord.type == TYPE_LITERAL)
        *word = words[activeWord.offset];
    else if (activeWord.type == TYPE_1_FILL)
        *word = (T)~(T)0;
    else
        *word = (T)0;
}

// replaces idx with the position of the next set bit (returns false if none)
template <class T>
bool CmpBitVec<T>::nextSetBitInclusive(size_t *idx) {
    if (*idx >= size) return false;
    scan(*idx);
    if (activeWord.type == TYPE_LITERAL) {
        T word = words[activeWord.offset] & ((T)~(T)0 << (*idx - activeWord.start));
        if (word == 0) {
            *idx = activeWord.end;
            return nextSetBitInclusive(idx);
        }
        else {
            *idx = activeWord.start + my_ctz(word);
            return true;
        }
    }
    else if (activeWord.type == TYPE_1_FILL) return true;
    else {
        *idx = activeWord.end;
        return nextSetBitInclusive(idx);
    }
    return true;
}

// logical AND
template <class T>
CmpBitVec<T>* CmpBitVec<T>::operator&(CmpBitVec<T>* that) {
    if (size != that->size) {
        fprintf(stderr,"bit vector length mismatch\n");
        exit(1);
    }

    CmpBitVec<T> *res = new CmpBitVec<T>();
    bool advanceThis = false;
    bool advanceThat = false;

    begin();
    that->begin();
    
    do {
        if (advanceThis) nextWord();
        if (advanceThat) that->nextWord();
        advanceThis = advanceThat = false;

        while (activeWord.end <= that->activeWord.start) nextWord();
        while (that->activeWord.end <= activeWord.start) that->nextWord();

        if (activeWord.type == TYPE_0_FILL) {
            res->appendBits(activeWord.end - res->size, TYPE_0_FILL);
            advanceThis = true;
        }
        else if (activeWord.type == TYPE_1_FILL) {
            if (that->activeWord.type == TYPE_0_FILL) {
                res->appendBits(that->activeWord.end - res->size, TYPE_0_FILL);
                advanceThat = true;
            }
            else if (that->activeWord.type == TYPE_1_FILL) {
                if (activeWord.end <= that->activeWord.end) {
                    res->appendBits(activeWord.end - res->size, TYPE_1_FILL);
                    advanceThis = true;
                }
                else {
                    res->appendBits(that->activeWord.end - res->size, TYPE_1_FILL);
                    advanceThat = true;
                }
            }
            else {
                res->appendWord(that->words[that->activeWord.offset]);
                advanceThat = true;
            }
        }
        else {
            if (that->activeWord.type == TYPE_0_FILL) {
                res->appendBits(that->activeWord.end - res->size, TYPE_0_FILL);
                advanceThat = true;
            }
            else if (that->activeWord.type == TYPE_1_FILL) {
                res->appendWord(words[activeWord.offset]);
                advanceThis = true;
            }
            else {
                res->appendWord(words[activeWord.offset] & that->words[that->activeWord.offset]);
                advanceThis = true;
                advanceThat = true;
            }
        }
    } while (res->size < size);
    
    if (res->size > size)
        res->size = size;

    return res;
}

// logical OR
template <class T>
CmpBitVec<T>* CmpBitVec<T>::operator|(CmpBitVec<T>* that) {
    if (size != that->size) {
        fprintf(stderr,"bit vector length mismatch\n");
        exit(1);
    }

    CmpBitVec<T> *res = new CmpBitVec<T>();
    bool advanceThis = false;
    bool advanceThat = false;

    begin();
    that->begin();
    
    do {
        if (advanceThis) nextWord();
        if (advanceThat) that->nextWord();
        advanceThis = advanceThat = false;

        while (activeWord.end <= that->activeWord.start) nextWord();
        while (that->activeWord.end <= activeWord.start) that->nextWord();

        if (activeWord.type == TYPE_0_FILL) {
            if (that->activeWord.type == TYPE_0_FILL) {
                if (activeWord.end <= that->activeWord.end) {
                    res->appendBits(activeWord.end - res->size, TYPE_0_FILL);
                    advanceThis = true;
                }
                else {
                    res->appendBits(that->activeWord.end - res->size, TYPE_0_FILL);
                    advanceThat = true;
                }
            }
            else if (that->activeWord.type == TYPE_1_FILL) {
                res->appendBits(that->activeWord.end - res->size, TYPE_1_FILL);
                advanceThat = true;
            }
            else {
                res->appendWord(that->words[that->activeWord.offset]);
                advanceThat = true;
            }
            
        }
        else if (activeWord.type == TYPE_1_FILL) {
            res->appendBits(activeWord.end - res->size, TYPE_1_FILL);
            advanceThis = true;
        }
        else {
            advanceThis = true;
            if (that->activeWord.type == TYPE_0_FILL)
                res->appendWord(words[activeWord.offset]);
            else if (that->activeWord.type == TYPE_1_FILL)
                res->appendBits(that->activeWord.end - res->size, TYPE_1_FILL);
            else {
                res->appendWord(words[activeWord.offset] | that->words[that->activeWord.offset]);
                advanceThat = true;
            }
        }
    } while (res->size < size);
    
    if (res->size > size)
        res->size = size;

    return res;
}

// logical XOR
template <class T>
CmpBitVec<T>* CmpBitVec<T>::operator^(CmpBitVec<T>* that) {
    if (size != that->size) {
        fprintf(stderr,"bit vector length mismatch\n");
        exit(1);
    }

    CmpBitVec<T> *res = new CmpBitVec<T>();
    bool advanceThis = false;
    bool advanceThat = false;

    begin();
    that->begin();
    
    do {
        if (advanceThis) nextWord();
        if (advanceThat) that->nextWord();
        advanceThis = advanceThat = false;

        while (activeWord.end <= that->activeWord.start) nextWord();
        while (that->activeWord.end <= activeWord.start) that->nextWord();

        if (activeWord.type == TYPE_0_FILL) {
            if (that->activeWord.type == TYPE_0_FILL) {
                if (activeWord.end <= that->activeWord.end) {
                    res->appendBits(activeWord.end - res->size, TYPE_0_FILL);
                    advanceThis = true;
                }
                else {
                    res->appendBits(that->activeWord.end - res->size, TYPE_0_FILL);
                    advanceThat = true;
                }
            }
            else if (that->activeWord.type == TYPE_1_FILL) {
                if (activeWord.end <= that->activeWord.end) {
                    res->appendBits(activeWord.end - res->size, TYPE_1_FILL);
                    advanceThis = true;
                }
                else {
                    res->appendBits(that->activeWord.end - res->size, TYPE_1_FILL);
                    advanceThat = true;
                }
            }
            else {
                res->appendWord(that->words[that->activeWord.offset]);
                advanceThat = true;
            }
        }
        else if (activeWord.type == TYPE_1_FILL) {
            if (that->activeWord.type == TYPE_0_FILL) {
                if (activeWord.end <= that->activeWord.end) {
                    res->appendBits(activeWord.end - res->size, TYPE_1_FILL);
                    advanceThis = true;
                }
                else {
                    res->appendBits(that->activeWord.end - res->size, TYPE_1_FILL);
                    advanceThat = true;
                }
            }
            else if (that->activeWord.type == TYPE_1_FILL) {
                if (activeWord.end <= that->activeWord.end) {
                    res->appendBits(activeWord.end - res->size, TYPE_0_FILL);
                    advanceThis = true;
                }
                else {
                    res->appendBits(that->activeWord.end - res->size, TYPE_0_FILL);
                    advanceThat = true;
                }
            }
            else {
                res->appendWord(~that->words[that->activeWord.offset]);
                advanceThat = true;
            }
        }
        else {
            advanceThis = true;
            if (that->activeWord.type == TYPE_0_FILL)
                res->appendWord(words[activeWord.offset]);
            else if (that->activeWord.type == TYPE_1_FILL)
                res->appendWord(~words[activeWord.offset]);
            else {
                res->appendWord(words[activeWord.offset] ^ that->words[that->activeWord.offset]);
                advanceThat = true;
            }
        }
    } while (res->size < size);
    
    if (res->size > size)
        res->size = size;

    return res;
}

// logical NOT
template <class T>
CmpBitVec<T>* CmpBitVec<T>::operator~() {
    CmpBitVec<T> *res = new CmpBitVec<T>();
    res->size = size;
    res->count = size - count;
    res->words = words;
    res->fills = fills;
    for (size_t w = 0; w < words.size(); w++) {
        char t = wordType(w);
        if (t == TYPE_0_FILL)
            res->words[w] = words[w] | oneFill;
        else if (t == TYPE_1_FILL)
            res->words[w] = words[w] & ~oneFill;
        else
            res->words[w] = ~words[w];
    }
}

#endif
