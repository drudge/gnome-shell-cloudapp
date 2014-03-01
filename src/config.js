// vi: sts=2 sw=2 et

const IndicatorName = 'com.weborate.gnome.CloudAppUploader';

const SettingsSchema = 'org.gnome.shell.extensions.cloudapp';

const KeyEnableIndicator = 'enable-indicator';
const KeyClickAction = 'click-action'
const KeyShortcuts = [
  'shortcut-select-area',
  'shortcut-select-window',
  'shortcut-select-desktop'
];

const CloudAppEmail = 'email';
const CloudAppPassword = 'password';

const ClickActions = {
  SHOW_MENU: 0,
  SELECT_AREA: 1,
  SELECT_WINDOW: 2,
  SELECT_DESKTOP: 3
};

