(function(ext) {
    // Cleanup function when the extension is unloaded
    ext._shutdown = function() {};

    // Status reporting code
    // Use this to report missing hardware, plugin or unsupported browser
    ext._getStatus = function() {
        return {status: 2, msg: 'Ready'};
    };

    ext.open_window = function(location, callback) {
        return window.open('http://www.google.com','subWindow','width=320,height=320');
    };

    // Block and block menu descriptions
    var descriptor = {
        blocks: [
            ['R', 'open window %s', 'open_window', 'Boston'],
        ]
    };

    // Register the extension
    ScratchExtensions.register('openWindow', descriptor, ext);
})({});