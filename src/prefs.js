// vi: sts=2 sw=2 et
//
// accelerator setting based on
// https://github.com/ambrice/spatialnavigation-tastycactus.com/blob/master/prefs.js

const Lang = imports.lang;
const Signals = imports.signals;

const Gtk = imports.gi.Gtk;
// const Gio = imports.gi.Gio;
const Gio = imports.gi.Gio;
const Soup = imports.gi.Soup;

const GObject = imports.gi.GObject;

const Gettext = imports.gettext.domain('gnome-shell-extensions');
const _ = Gettext.gettext;

const Local = imports.misc.extensionUtils.getCurrentExtension();
const Config = Local.imports.config;
const Convenience = Local.imports.convenience;



let _settings;
let _httpSession = new Soup.SessionAsync();

const buildHbox = function () {
  return new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    margin_top: 5,
    expand: false
  });
}

const CloudAppUploaderSettingsWidget = new GObject.Class({
  Name: 'CloudAppUploaderSettingsWidget',
  GTypeName: 'CloudAppUploaderSettingsWidget',
  Extends: Gtk.Box,

  _init: function (params) {
    this.parent(params);
    this._initLayout();
  },

  _initLayout: function () {
    this._notebook = new Gtk.Notebook();

    let label;

    this._prefsCredentials = this._makePrefsCredentials();
    label = new Gtk.Label({label: _("Credentials")});
    this._notebook.append_page(this._prefsCredentials, label);
    
    this._prefsIndicator = this._makePrefsIndicator();
    label = new Gtk.Label({label: _("Indicator")});
    this._notebook.append_page(this._prefsIndicator, label);

    this._prefsKeybindings = this._makePrefsKeybindings();
    label = new Gtk.Label({label: _("Keybindings")});
    this._notebook.append_page(this._prefsKeybindings, label);

    this.add(this._notebook);
  },

  _makePrefsCredentials: function () {
    // let prefs = new Gtk.Grid({margin: 8});

    let prefs = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      margin: 20,
      margin_top: 10,
      expand: false
    });

    let hbox;


    /* Show indicator [on|off] */

    hbox = buildHbox();

    const labelEmail = new Gtk.Label({
      label: _('CloudApp Email       '),
      xalign: 0,
      expand: true
    });

    const entryEmail = new Gtk.Entry({
      xalign: 0,
      expand: true
    });
    
    entryEmail.connect('notify::text', function (text) {
      _settings.set_string(Config.CloudAppEmail, text);
    }.bind(this));
    
    entryEmail.text = _settings.get_string(
        Config.CloudAppEmail
    );

    hbox.add(labelEmail);
    hbox.add(entryEmail);

    prefs.add(hbox, {fill: false});
    
    hbox = buildHbox();
        
    const labelPassword = new Gtk.Label({
      label: _('CloudApp Password'),
      xalign: 0,
      expand: true
    });

    const entryPassword = new Gtk.Entry({
      xalign: 0,
      expand: true
    });
    

    entryPassword.connect('notify::text', function (text) {
      _settings.set_string(Config.CloudAppPassword, text);
    }.bind(this));
    
    entryPassword.visibility = false;
    entryPassword.text = _settings.get_string(
        Config.CloudAppPassword
    );

    hbox.add(labelPassword);
    hbox.add(entryPassword);

    prefs.add(hbox, {fill: false});
    
    
    hbox = buildHbox();
        
    const labelAccountType = new Gtk.Label({
      label: _('Account Type'),
      xalign: 0,
      expand: true
    });

    const entryAccountType = new Gtk.Label({
      label: '-',
      xalign: 0,
      expand: true
    });
    
    hbox.add(labelAccountType);
    hbox.add(entryAccountType);

    prefs.add(hbox, {fill: false});
    
    hbox = buildHbox();
    
    const blankLabel = new Gtk.Label({
      label: _(''),
      xalign: 0,
      expand: true
    });
    
    hbox.add(blankLabel);
    
    const loginButton = new Gtk.Button({ label: 'Log in' });
    
    loginButton.connect('clicked', Lang.bind(this, function () {
      this._requestAccountDetails(Lang.bind(this, function(err, details) {
        if (err) {
          blankLabel.label = err.message;
          return; 
        } else {
         blankLabel.label = '';
        }
        
        if (details && details.email) {
          _settings.set_string(Config.CloudAppEmail, entryEmail.text);      
          _settings.set_string(Config.CloudAppPassword, entryPassword.text);
          entryAccountType.label = details.subscribed ? 'Pro' : 'Free';
          loginButton.hide();
          signOutButton.show();
        }
      }));
    }));
    
    hbox.add(loginButton);
        
    const signOutButton = new Gtk.Button({ label: 'Sign out' });
    signOutButton.connect('clicked', function () {
      _settings.set_string(Config.CloudAppEmail, "");      
      _settings.set_string(Config.CloudAppPassword, "");
      entryEmail.text = '';
      entryPassword.text = '';
      loginButton.show();
      signOutButton.hide();
    }.bind(this));
    
    hbox.add(signOutButton);
    signOutButton.hide();
    
    prefs.add(hbox, {full: false});
    
    if (entryEmail.text == ''|| entryPassword.text == '') {
      loginButton.show();
      signOutButton.hide();
    } else {
      loginButton.hide();
      signOutButton.show();
    }

    let _signalAuthenticate = _httpSession.connect(
      "authenticate",
      Lang.bind(this, function (session, message, auth, retrying, user_data) {
        log("authenticate");
        auth.authenticate(entryEmail.text, entryPassword.text);
    }));
    
    loginButton.clicked();

    return prefs;
  },
  
   _requestAccountDetails: function(callback) {
     let request = Soup.Message.new('GET', "http://my.cl.ly/account");
      request.request_headers.append("Accept", "application/json");
     let json = null;
     let err = null;
     
     _httpSession.queue_message(request,
        Lang.bind(this, function (session, {status_code, response_body}) {
          if (status_code == 200) {
            try {
                json = JSON.parse(response_body.data);
            } catch (e) {
              err = e;
            }
          } else {
            log('getJSON error status code: ' + status_code);
            log('getJSON error response: ' + response_body.data);

            let errorMessage;

            try {
              errorMessage = JSON.parse(response_body.data).data.error;
            } catch (e) {
              log("failed to parse error message " + e);
              errorMessage = response_body.data
            }

            this.emit(
              'error',
              "HTTP " + status_code + " - " + errorMessage
            );
            
            err = e;
          }
          
          callback(err, json);
      }));
  },
  
  _makePrefsIndicator: function () {
    // let prefs = new Gtk.Grid({margin: 8});

    let prefs = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      margin: 20,
      margin_top: 10,
      expand: false
    });

    let hbox;


    /* Show indicator [on|off] */

    hbox = buildHbox();

    const labelShowIndicator = new Gtk.Label({
      label: _('Show indicator'),
      xalign: 0,
      expand: true
    });

    const switchShowIndicator = new Gtk.Switch();

    switchShowIndicator.connect('notify::active', function (button) {
      _settings.set_boolean(Config.KeyEnableIndicator, button.active);
    }.bind(this));

    switchShowIndicator.active = _settings.get_boolean(
        Config.KeyEnableIndicator
    );

    hbox.add(labelShowIndicator);
    hbox.add(switchShowIndicator);

    prefs.add(hbox, {fill: false});


    /* Default click action [dropdown] */

    hbox = buildHbox();

    const labelDefaultClickAction = new Gtk.Label({
      label: _('Default click action'),
      xalign: 0,
      expand: true
    });

    const clickActionOptions = [
      [_("Select Area")     , Config.ClickActions.SELECT_AREA],
      [_("Select Window")   , Config.ClickActions.SELECT_WINDOW],
      [_("Select Desktop")  , Config.ClickActions.SELECT_DESKTOP],
      [_("Show Menu")       , Config.ClickActions.SHOW_MENU]
    ];

    const currentClickAction = _settings.get_enum(Config.KeyClickAction);

    const comboBoxDefaultClickAction = this._getComboBox(
      clickActionOptions, GObject.TYPE_INT, currentClickAction,
      function (value) _settings.set_enum(Config.KeyClickAction, value)
    );

    hbox.add(labelDefaultClickAction);
    hbox.add(comboBoxDefaultClickAction);

    prefs.add(hbox, {fill: false});

    return prefs;
  },

  _makePrefsKeybindings: function () {
    let model = new Gtk.ListStore();

    model.set_column_types([
        GObject.TYPE_STRING,
        GObject.TYPE_STRING,
        GObject.TYPE_INT,
        GObject.TYPE_INT
    ]);

    let bindings = [
      ["shortcut-select-area", "Select area"],
      ["shortcut-select-window", "Select window"],
      ["shortcut-select-desktop", "Select whole desktop"]
    ];

    for each (let [name, description] in bindings) {
      log("binding: " + name + " description: " + description);
      let binding = _settings.get_strv(name)[0];

      let key, mods;

      if (binding) {
        [key, mods] = Gtk.accelerator_parse(binding);
      } else {
        [key, mods] = [0, 0];
      }

      let row = model.append();

      model.set(row, [0, 1, 2, 3], [name, description, mods, key]);
    }

    let treeview = new Gtk.TreeView({
        'expand': true,
        'model': model
    });

    let cellrend = new Gtk.CellRendererText();
    let col = new Gtk.TreeViewColumn({
      'title': 'Keyboard Shortcut',
       'expand': true
    });

    col.pack_start(cellrend, true);
    col.add_attribute(cellrend, 'text', 1);
    treeview.append_column(col);

    cellrend = new Gtk.CellRendererAccel({
      'editable': true,
      'accel-mode': Gtk.CellRendererAccelMode.GTK
    });

    cellrend.connect('accel-edited', function(rend, iter, key, mods) {
      let value = Gtk.accelerator_name(key, mods);
      let [succ, iterator] = model.get_iter_from_string(iter);

      if (!succ) {
        throw new Error("Error updating keybinding");
      }

      let name = model.get_value(iterator, 0);

      model.set(iterator, [2, 3], [mods, key]);
      _settings.set_strv(name, [value]);
    });

    cellrend.connect('accel-cleared', function(rend, iter, key, mods) {
      let [succ, iterator] = model.get_iter_from_string(iter);

      if (!succ) {
        throw new Error("Error clearing keybinding");
      }

      let name = model.get_value(iterator, 0);

      model.set(iterator, [2, 3], [0, 0]);
      _settings.set_strv(name, []);
    });

    col = new Gtk.TreeViewColumn({'title': 'Modify', min_width: 200});

    col.pack_end(cellrend, false);
    col.add_attribute(cellrend, 'accel-mods', 2);
    col.add_attribute(cellrend, 'accel-key', 3);
    treeview.append_column(col);

    return treeview;
  },

  _getComboBox: function (options, valueType, defaultValue, callback) {
    let model = new Gtk.ListStore();

    let Columns = { LABEL: 0, VALUE: 1 };

    model.set_column_types([GObject.TYPE_STRING, valueType]);

    let comboBox = new Gtk.ComboBox({model: model});
    let renderer = new Gtk.CellRendererText();

    comboBox.pack_start(renderer, true);
    comboBox.add_attribute(renderer, 'text', 0);

    for each (let [label, value] in options) {
      let iter;

      model.set(
          iter = model.append(),
          [Columns.LABEL, Columns.VALUE],
          [label, value]
      );

      if (value === defaultValue) {
          comboBox.set_active_iter(iter);
      }
    }

    comboBox.connect('changed', function (entry) {
      let [success, iter] = comboBox.get_active_iter();

      if (!success) {
          return;
      }

      let value = model.get_value(iter, Columns.VALUE);

      callback(value);
    });

    return comboBox;
  }
});

function init() {
  _settings = Convenience.getSettings();
}

function buildPrefsWidget() {
  let widget = new CloudAppUploaderSettingsWidget();
  widget.show_all();

  return widget;
}
