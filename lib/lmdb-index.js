
// Source: https://github.com/Venemo/node-lmdb/blob/master/example-advanced1-indexing.js
// Author: @venemo
// Indexing engine example
// ----------
//
// The purpose of this example is to show how to implement an indexing engine using node-lmdb.
// It's not intended to be feature-full, just enough to give you an idea how to use the LMDB API.
//
// Limitations of this indexing engine:
// * Doesn't support fields or advanced querying
// * Tokenization is very simple, no stemming or stop words
// * No phrase search, can only search for single words
//
// But hey, it's only ~100 LOC, so we're still cool :)

var lmdb = require('node-lmdb');

// Indexing engine (implemented with the module pattern)
module.exports = function() {
    var env, dbi;

    // initializer function, call this before using the index
    var init = function(_env, _dbi) {

        env = _env;
        dbi = _dbi;

        /*
        lmdb = require('./build/Release/node-lmdb');
        env = new lmdb.Env();
        env.open({
            path: "./testdata",
            maxDbs: 10
        });

        dbi = env.openDbi({
           name: "example-advanced-indexing",
           create: true,
           dupSort: true
        });
        */
    };

    // destroy function, call this when you no longer need the index
    var destroy = function() {
        dbi.close();
        env.close();
    };

    // simple tokenizer
    var tokenize = function(document) {
        var tokens = [];
        for (var i in document) {
            if (document.hasOwnProperty(i) && typeof(document[i]) === "string") {
                var stripped = document[i].replace(/[\.!,?\[\]\\]/g, " ");
                var splitted = stripped.split(" ");

                for (var j = splitted.length; j--; ) {
                    if (splitted[j] !== '' && tokens.indexOf(splitted[j]) === -1) {
                        //Add attribute key to the index
                        tokens.push(i+':'+splitted[j].toLowerCase());
                    }
                }
            }
        }
        return tokens;
    };

    // adds a document to the index
    var addDocument = function(document) {
        if (typeof(document.id) !== "string") {
            throw new Error("document must have an id property");
        }
        //ngraph tweak: object data in data attribute
        var tokens = tokenize(document.data);
        var txn = env.beginTxn();

        for (var i = tokens.length; i--; ) {
            //console.log(tokens[i], document.id);
            txn.putString(dbi, tokens[i], document.id);
        }

        txn.commit();
    };

    var removeDocument = function(document) {
        if (typeof(document.id) !== "string") {
            throw new Error("document must have an id property");
        }
        var tokens = tokenize(document.data);
        var txn = env.beginTxn();

        for (var i = tokens.length; i--; ) {
            txn.del(dbi, tokens[i], document.id);
        }

        txn.commit();
    }

    // adds multiple documents to the index
    var addDocuments = function(array) {
        if (!(array instanceof Array)) {
            throw new Error("This function expects an array.");
        }

        for (var i = array.length; i--; ) {
            addDocument(array[i]);
        }
    };

    // performs a search in the index for the given word
    var searchForDocuments = function(str) {
        str = str.toLowerCase();
        var txn = env.beginTxn({ readOnly: true });
        var cursor = new lmdb.Cursor(txn, dbi);
        var results = [];

        // Go the the first occourence of `str` and iterate from there
        for (var found = cursor.goToRange(str); found; found = cursor.goToNext()) {
            // Stop the loop if the current key is no longer what we're looking for
            if (found !== str)
                break;

            // Get current data item and push it to results
            cursor.getCurrentString(function(key, data) {
                results.push(data);
            });
        }

        cursor.close();
        txn.abort();
        console.log(str, results);
        return results;
    };

    // The object we return here is the public API of the indexing engine
    //return Object.freeze({
    return {
        init: init,
        destroy: destroy,
        addDocument: addDocument,
        addDocuments: addDocuments,
        searchForDocuments: searchForDocuments
    };
};

