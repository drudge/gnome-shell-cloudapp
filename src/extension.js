// vi: sts=2 sw=2 et
//
// props to
// https://github.com/rjanja/desktop-capture
// https://github.com/DASPRiD/gnome-shell-extension-area-screenshot

const Lang = imports.lang;
const Signals = imports.signals;
const Mainloop = imports.mainloop;

const Gio = imports.gi.Gio;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;

const Util = imports.misc.util;

const Main = imports.ui.main;

const Gettext = imports.gettext.domain('gnome-shell-extensions');
const _ = Gettext.gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Local = ExtensionUtils.getCurrentExtension();

const Config = Local.imports.config;
const Uploader = Local.imports.uploader;
const Indicator = Local.imports.indicator;
const Selection = Local.imports.selection;
const Notifications = Local.imports.notifications;
const Convenience = Local.imports.convenience;

const Extension = new Lang.Class({
  Name: "CloudAppUploader",

  _init: function () {
    this.settings = Convenience.getSettings();

    this._notificationService = new Notifications.NotificationService();

    this._signalSettings = [];

    this._signalSettings.push(this.settings.connect(
        'changed::' + Config.KeyEnableIndicator,
        this._updateIndicator.bind(this)
    ));

    this._updateIndicator();

    this._setKeybindings();
  },

  _setKeybindings: function () {
    for each (let shortcut in Config.KeyShortcuts) {
      Main.wm.addKeybinding(
          shortcut,
          this.settings,
          Meta.KeyBindingFlags.NONE,
          Shell.KeyBindingMode.NORMAL,
          this.onAction.bind(this, shortcut.replace('shortcut-', ''))
      );
    }
  },

  _unsetKeybindings: function () {
    for each (let shortcut in Config.KeyShortcuts) {
      Main.wm.removeKeybinding(shortcut);
    }
  },

  _createIndicator: function () {
    if (!this._indicator) {
      this._indicator = new Indicator.Indicator(this);
      Main.panel.addToStatusArea(Config.IndicatorName, this._indicator);
    }
  },

  _destroyIndicator: function () {
    if (this._indicator) {
      this._indicator.destroy();
      this._indicator = null;
    }
  },

  _updateIndicator: function () {
    if (this.settings.get_boolean(Config.KeyEnableIndicator)) {
      this._createIndicator();
    } else {
      this._destroyIndicator();
    }
  },

  _startSelection: function (selection) {
    if (this._selection) {
      // prevent reentry
      return;
    };

    this._selection = selection;

    if (this._indicator) {
      this._indicator.startSelection();
    }

    this._selection.connect("screenshot", function (selection, fileName) {
      this._uploadScreenshot(fileName, /* deleteAfterUpload */ true);
    }.bind(this));

    this._selection.connect("error", function (selection, message) {
      var n = _extension._notificationService.make();
      this._notificationService.setError(n, message)
    }.bind(this));

    this._selection.connect("stop", function () {
      this._selection = null;

      if (this._indicator) {
        this._indicator.stopSelection();
      }
    }.bind(this));
  },

  _selectArea: function () {
    this._startSelection(new Selection.SelectionArea());
  },

  _selectWindow: function() {
    this._startSelection(new Selection.SelectionWindow());
  },

  _selectDesktop: function () {
    this._startSelection(new Selection.SelectionDesktop());
  },
  
  _openMyCloudApp: function() {
    Util.spawn(['x-www-browser', 'http://my.cl.ly']);
  },
  
  _showSettings: function () {
    let _appSys = Shell.AppSystem.get_default();
    let _gsmApp = _appSys.lookup_app('gnome-system-monitor.desktop');
    let _gsmPrefs = _appSys.lookup_app('gnome-shell-extension-prefs.desktop');
    let item;

    if (_gsmPrefs.get_state() == _gsmPrefs.SHELL_APP_STATE_RUNNING){
        _gsmPrefs.activate();
    } else {
        _gsmPrefs.launch(global.display.get_current_time_roundtrip(),
                         [Local.metadata.uuid], -1, null);
    }
  },

  _uploadScreenshot: function (fileName, deleteAfterUpload) {
    let email = this.settings.get_string(Config.CloudAppEmail);
    let password = this.settings.get_string(Config.CloudAppPassword);
    let notification = this._notificationService.make();
        
    if (!email || !password) {
      this._notificationService.setError(notification, 'No credentials specified');
      return;
    }
    
    let uploader = new Uploader.CloudAppUploader(email, password);

    let cleanup = function () {
      if (deleteAfterUpload) {
        Gio.File.new_for_path(fileName).delete(/* cancellable */ null);
      }
      uploader.disconnectAll();
    };

    uploader.connect('progress',
        function (obj, bytes, total) {
          this._notificationService.setProgress(notification, bytes, total);
        }.bind(this)
    );

    uploader.connect('done',
        function (obj, data) {
          this._notificationService.setFinished(notification, data.url);
          cleanup();
        }.bind(this)
    );

    uploader.connect('error',
        function (obj, error) {
          this._notificationService.setError(notification, error);
          cleanup();
        }.bind(this)
    );
    uploader.upload(fileName);
  },


  onAction: function (action) {
    let dispatch = {
      'select-area': this._selectArea.bind(this),
      'select-window': this._selectWindow.bind(this),
      'select-desktop': this._selectDesktop.bind(this),
      'show-settings': this._showSettings.bind(this),
      'show-my-cloudapp': this._openMyCloudApp.bind(this)
    };

    let f = dispatch[action] || function () {
      throw new Error('unknown action: ' + action);
    };

    try {
      f();
    } catch (ex) {
      let notification = this._notificationService.make();
      this._notificationService.setError(notification, ex.toString());
    }
  },

  destroy: function () {
    this._destroyIndicator();
    this._unsetKeybindings();

    this._signalSettings.forEach(function (signal) {
      this.settings.disconnect(signal);
    }.bind(this));

    this.disconnectAll();
  }
});

Signals.addSignalMethods(Extension.prototype);



let _extension;

function init() {
  let theme = imports.gi.Gtk.IconTheme.get_default();
  theme.append_search_path(Local.path + '/icons');
}

function enable() {
  _extension = new Extension();
}

function disable() {
  _extension.destroy();
  _extension = null;
}
