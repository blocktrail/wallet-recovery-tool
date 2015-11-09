'use strict';
var gui = require("nw.gui");
var blocktrail = require('blocktrail-sdk');
//debugger;


var win = gui.Window.get();
//Create our menu bar
var menubar = new gui.Menu({
    type: 'menubar'
});

var fileSubmenu = new gui.Menu();
fileSubmenu.append(new gui.MenuItem({
    label: "action 1",
    click: function() {
        alert("woaaah there!");
    }
}));
fileSubmenu.append(new gui.MenuItem({
    label: "action 2",
    click: function() {
        confirm("isn't this fun?");
    }
}));

//add the menubar to the Window
/* only for mac?
 win.menu = menubar;
 win.menu.insert(new gui.MenuItem{
 label: 'File',
 submenu: fileSubmenu
 }), 1);
 */

menubar.append(new gui.MenuItem({
    label: 'File',
    submenu: fileSubmenu
}));
menubar.append(new gui.MenuItem({
    label: 'About',
    submenu: fileSubmenu
}));
//win.menu = menubar;




//Handlers



//getting the clipboard
var clipboard = gui.Clipboard.get();
//alert(clipboard.get('text'));



