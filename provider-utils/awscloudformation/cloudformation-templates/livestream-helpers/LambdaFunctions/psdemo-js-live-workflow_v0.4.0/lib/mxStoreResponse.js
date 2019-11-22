/* Definitions of store response data */

/**
  * @mixin mxStoreResponse
  * @description store key value pair to responseData
  *
  */
const mxStoreResponse = Super => class extends Super {
  constructor(params) {
    super(params);
    /* responseData */
    this.$responseData = {};
  }

  get responseData() { return this.$responseData; }

  /**
    * @function storeResponseData
    *
    * @param {string} key
    * @param {string|object} value. If is object, expects the object (hash) to have the same 'key'
    *
    */
  storeResponseData(key, val) {
    if (val === undefined || val === null) {
      delete this.$responseData[key];
    } else if (typeof val !== 'object') {
      this.$responseData[key] = val;
    } else {
      this.$responseData[key] = val[key];
    }
    return this;
  }
};

module.exports.mxStoreResponse = mxStoreResponse;
