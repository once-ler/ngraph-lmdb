//lmdb defaults
  var lmdbConfig = {

    appendOnly: false,

    env: {
        path: process.cwd() + "/mydata",
        mapSize: 8*1024*1024*1024, // maximum database size
        maxDbs: 10,
        noMetaSync: true,
        noSync: true
    },

    vertexDb: {
        name: "test:vertices",
        create: true // will create if database did not exist
    },

    edgeDb: {
        name: "test:edges",
        create: true
    },

    multiEdgesDb: {
        name: "test:multi-edges",
        create: true
    },

    bothEdgeDb: {
        name: "test:both-edges",
        create: true,
        dupSort: true
    },

    inEdgeDb: {
        name: "test:in-edges",
        create: true,
        dupSort: true
    },

    outEdgeDb: {
        name: "test:out-edges",
        create: true,
        dupSort: true
    },

    statsDb: {
        name: "test:stats",
        create: true
    }

  }

  module.exports = lmdbConfig;