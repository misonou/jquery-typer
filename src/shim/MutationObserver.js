this.MutationObserver = window.MutationObserver || (function () {
    function MutationObserver(handler) {
        this.records = [];
        this.handler = handler;
    }
    MutationObserver.prototype = {
        observe: function (element, init) {
            var self = this;
            $(element).on('DOMNodeInserted DOMNodeRemoved DOMAttrModified', function (e) {
                var type = e.type.charAt(7);
                var record = {};
                record.addedNodes = [];
                record.removedNodes = [];
                if (type === 'M') {
                    if (!init.attributes) {
                        return;
                    }
                    record.target = e.target;
                    record.attributeName = e.originalEvent.attrName;
                } else {
                    if (!init.childList) {
                        return;
                    }
                    record.target = e.target.parentNode;
                    record[type === 'I' ? 'addedNodes' : 'removedNodes'][0] = e.target;
                }
                if (init.subtree || record.target === element) {
                    self.records[self.records.length] = record;
                    clearTimeout(self.timeout);
                    self.timeout = setTimeout(function () {
                        self.handler(self.takeRecords());
                    });
                }
            });
        },
        takeRecords: function () {
            return this.records.splice(0);
        }
    };
    return MutationObserver;
}());