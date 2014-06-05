CmpBitVec
=========

CmpBitVec - compressed bit vector

This is a variation of FastBit's word aligned hybrid compressed bitvector
The words are 32 bit integers, some are literal words (with a mix of 0's and 1's)
others are fill words representing a run of 0's or 1's that is a multiple of 32
The fill words are marked in a separate bitvector.
A 1-fill word's MSB is 1 and the remaining bits hold the length of the run.
Since it is a multiple of 32, the length (in bits) is word << 5
Also, checking the MSB of a signed int is like asking if word < 0

The fills bitvector is always uncompressed; the ith bit corresponds to the ith word.