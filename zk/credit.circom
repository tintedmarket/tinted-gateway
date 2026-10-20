pragma circom 2.1.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/bitify.circom";

// Anonymous inference credit: proves "I own an unspent note of value `denom` in the pool" and binds the
// spend to a fresh session key, without revealing which deposit the note came from.
//   note commitment = Poseidon(nullifierSecret, secret, denom)   (inserted into the on-chain Merkle tree at deposit)
//   nullifierHash   = Poseidon(nullifierSecret)                  (published at redeem; stops double-spends)

// out = sel ? (b, a) : (a, b), with sel constrained to a bit.
template DualMux() {
    signal input a;
    signal input b;
    signal input sel;
    signal output left;
    signal output right;
    sel * (1 - sel) === 0;
    left <== (b - a) * sel + a;
    right <== (a - b) * sel + b;
}

template MerkleRoot(levels) {
    signal input leaf;
    signal input pathElements[levels];
    signal input pathIndices[levels];
    signal output root;
    component mux[levels];
    component h[levels];
    signal cur[levels + 1];
    cur[0] <== leaf;
    for (var i = 0; i < levels; i++) {
        mux[i] = DualMux();
        mux[i].a <== cur[i];
        mux[i].b <== pathElements[i];
        mux[i].sel <== pathIndices[i];
        h[i] = Poseidon(2);
        h[i].inputs[0] <== mux[i].left;
        h[i].inputs[1] <== mux[i].right;
        cur[i + 1] <== h[i].out;
    }
    root <== cur[levels];
}

template Credit(levels) {
    // public
    signal input root;
    signal input nullifierHash;
    signal input denom;
    signal input sessionKey;   // hash of the client's fresh API-session public key
    // private
    signal input nullifierSecret;
    signal input secret;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    component commit = Poseidon(3);
    commit.inputs[0] <== nullifierSecret;
    commit.inputs[1] <== secret;
    commit.inputs[2] <== denom;

    component nh = Poseidon(1);
    nh.inputs[0] <== nullifierSecret;
    nh.out === nullifierHash;

    component tree = MerkleRoot(levels);
    tree.leaf <== commit.out;
    for (var i = 0; i < levels; i++) {
        tree.pathElements[i] <== pathElements[i];
        tree.pathIndices[i] <== pathIndices[i];
    }
    tree.root === root;

    // Bind the proof to the session key so a relayer or observer can't redirect the credit.
    signal sessionKeySq;
    sessionKeySq <== sessionKey * sessionKey;
}

component main {public [root, nullifierHash, denom, sessionKey]} = Credit(20);
