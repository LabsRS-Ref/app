'use strict';
require("./env");
const app = require('app');
const BrowserWindow = require('browser-window');
const Tray = require('tray');
const Menu = require('menu');
const Positioner = require('electron-positioner');
const events = require('events')
const fs = require('fs')
const path = require('path');
const server = require("./appext_server/server");
const device_manager = require("./devices/manager");
const cli = require("cli_debug");

// report crashes to the Electron project
require('crash-reporter').start();

// adds debug features like hotkeys for triggering dev tools and reload
require('electron-debug')();

// prevent window being garbage collected
let mainWindow;

function onClosed() {
	// dereference the window
	// for multiple windows store them in an array
	mainWindow = null;
}

function createMainWindow() {
	const win = new BrowserWindow({
		width: 600,
		height: 400
	});

	win.loadUrl(`file://${__dirname}/index.html`);
	//win.openDevTools();
	win.on('closed', onClosed);

	return win;
}

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

app.on('activate-with-no-open-windows', () => {
	if (!mainWindow) {
		mainWindow = createMainWindow();
	}
});

app.on('ready', () => {
	mainWindow = createMainWindow();

  //menu
	var dockMenu = Menu.buildFromTemplate([
			{ label: 'devices', click: function(){
				mainWindow.focus();
				console.log('discovering...');
			}},
			{ type: 'separator' },
			{ label: 'exit', click: function(){ app.exit(); }}
	]);
	app.dock.setMenu(dockMenu);
	//tray
	var iconPath = path.join(__dirname, 'icons', 'icon.png');
	var appIcon = new Tray(iconPath);
	appIcon.setToolTip('edge filesender.');
	appIcon.setContextMenu(dockMenu);

	//move
	const positioner = new Positioner(mainWindow);
	positioner.move('topRight');

	//server
	server.serve(mainWindow.webContents);

	//devices discover
    device_manager.init(mainWindow.webContents);

    cli.debug();
});
