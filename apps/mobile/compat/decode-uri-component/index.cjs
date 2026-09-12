// query-string 7 expects a callable CommonJS export. The upstream security fix
// (0.5.0) is ESM-only. Keep the caller's API using the patched implementation;
// Node >=22.22 and Metro both support this bridge. No decoder is copied/forked.
module.exports = require('safe-decode-uri-component').default;
