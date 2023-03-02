/**
 * A collection of functions to save json in various formats
 */

const fs = require('fs');

/**
 * Save an object (or list of objects) to a json file 
 */
function saveToJson(obj, filename) {
    fs.writeFileSync(filename, JSON.stringify(obj));
};

module.exports = saveToJson;