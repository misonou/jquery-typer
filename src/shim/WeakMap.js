this.WeakMap = window.WeakMap || (function () {
    var num = 0;
    function WeakMap() {
        this.key = '__WeakMap' + (++num);
    }
    WeakMap.prototype = {
        get: function (key) {
            return key && key[this.key];
        },
        set: function (key, value) {
            key[this.key] = value;
        },
        has: function (key) {
            return key && this.key in key;
        },
        delete: function (key) {
            delete key[this.key];
        }
    };
    return WeakMap;
}());
