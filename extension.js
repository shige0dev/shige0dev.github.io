<<<<<<< HEAD
(function(ext) {
    var win = window.open('http://www.google.com','subWindow','width=320,height=320');
    // Cleanup function when the extension is unloaded
    ext._shutdown = function() {};

    // Status reporting code
    // Use this to report missing hardware, plugin or unsupported browser
    ext._getStatus = function() {
        return {status: 2, msg: 'Ready'};
    };

    ext.open_window = function(location) {
        //var win = window.open('http://www.google.com','subWindow','width=320,height=320');
        console.log('open_window');
        return win;
    };

    ext.close_window = function(w){
        console.log('close_window');
        console.log(1000);
        window.close();
        win.innerHeight = 600;
    };

    // Block and block menu descriptions
    var descriptor = {
        blocks: [
            ['r', 'open window %s', 'open_window', 'Boston'],
            ['w', 'close window %s', 'close_window', 'window'],
            ['w', 'resize window %s', 'resize_window', 'window'],
        ]
    };

    // Register the extension
    ScratchExtensions.register('openWindow', descriptor, ext);
=======
(function(ext) {
    // Cleanup function when the extension is unloaded
    ext._shutdown = function() {};

    // Status reporting code
    // Use this to report missing hardware, plugin or unsupported browser
    ext._getStatus = function() {
        return {status: 2, msg: 'Ready'};
    };

    ext.open_window = function(location) {
        return window.open('http://www.google.com','subWindow','width=320,height=320');
    };

    ext.close_window = function(w){
        console.log(w);
        w.close();
    };

    // Block and block menu descriptions
    var descriptor = {
        blocks: [
            ['r', 'open window %s', 'open_window', 'Boston'],
            ['w', 'close window %s', 'close_window', 'window'],
        ]
    };

    // Register the extension
    ScratchExtensions.register('openWindow', descriptor, ext);
>>>>>>> 99d40ec8293c5ebde65ec37533c87315984bf561
})({});