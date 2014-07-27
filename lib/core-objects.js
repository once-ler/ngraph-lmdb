// need this for old browsers. Should this be a separate module?
exports.indexOfElementInArray = function (element, array) {
    //if (array.indexOf) {
    //    return array.indexOf(element);
    //}

    var len = array.length,
        i;

    for (i = 0; i < len; i += 1) {
        //if (array[i] === element) {
        if (array[i].id === element.id) {
            return i;
        }
    }

    return -1;
}

/**
 * Internal structure to represent node;
 */
exports.Node = function(id) {
    this.id = id;
    this.labels = {};
    this.data = null;
}


/**
 * Internal structure to represent links;
 */
exports.Link = function (fromId, toId, label, data, id) {
    this.fromId = fromId;
    this.toId = toId;
    this.data = data;
    this.id = id;
    this.label = label;
}

exports.mergeOptions = function (obj1,obj2){
    var obj3 = {};
    for (var attrname in obj1) { obj3[attrname] = obj1[attrname]; }
    for (var attrname in obj2) { obj3[attrname] = obj2[attrname]; }
    return obj3;
}