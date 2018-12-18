function initPreferences() {
  updateColorPicker('backgroundColorPicker', 'backgroundColorPreview');
  updateColorPicker('borderColorPicker', 'borderColorPreview');

  // display path of photo directory
  // automatic setting and getting of this pref does not work...
  var dirTextbox = document.getElementById('enableLocalPhotosTextbox');
  var directory = contactPhoto.prefs.get('photoDirectory', 'file');
  if (directory && directory.path) {
    dirTextbox.value = directory.path;
  }

  enableLocalOptions();
  enableFacesOptions();
  enableBorderTypes();
  enableBackgroundColor();
  enableComposePhotos();

  populateDefaultGenericPhotoList();
  enableGravatar();
}
window.addEventListener('load', initPreferences, false); // display the color

function updateColorPicker(pickerID, textboxID) {
  var textbox = document.getElementById(textboxID);
  var picker = document.getElementById(pickerID);

  // sanitize hex color
  var re = new RegExp(/^#[0-9a-f]*$/i);
  var hexCode = textbox.value;
  if (hexCode.substr(0, 1) != '#') hexCode = '#'+hexCode;
  while (!re.test(hexCode)) {
    hexCode = hexCode.substr(0, hexCode.length-1);
  }
  textbox.value = hexCode;

  if (hexCode.length == 7) {
    picker.color = hexCode;
  }
  else {
    //picker.color = 'transparent';
  }
}

function updateColorInput(pickerID, prefName) {
  var picker = document.getElementById(pickerID);

  contactPhoto.prefs.set(prefName, picker.color, 'char');
}

function setColor(pickerID, prefName, color) {
  var picker = document.getElementById(pickerID);
  picker.color = color;
  updateColorInput(pickerID, prefName);
}

function enableFacesOptions() {
  if (document.getElementById('enableFacesCheckbox').checked) {
    document.getElementById('enableFacesRadiogroup').disabled = false;
  }
  else {
    document.getElementById('enableFacesRadiogroup').disabled = true;
  }
}

function enableLocalOptions() {
  if (document.getElementById('enableLocalPhotosCheckbox').checked) {
    document.getElementById('enableLocalPhotosButton').disabled = false;
    document.getElementById('enableLocalPhotosTextbox').disabled = false;
    document.getElementById('checkboxEnableWildcards').disabled = false;
  }
  else {
    document.getElementById('enableLocalPhotosButton').disabled = true;
    document.getElementById('enableLocalPhotosTextbox').disabled = true;
    document.getElementById('checkboxEnableWildcards').disabled = true;
  }
  enableOpenLocalFolder();
}

function enableOpenLocalFolder() {
  if (document.getElementById('enableLocalPhotosTextbox').value == '') {
    document.getElementById('openLocalFolderButton').disabled = true;
  }
  else {
    document.getElementById('openLocalFolderButton').disabled = false;
  }
}

function enableBorderTypes() {
  if (document.getElementById('enableBorderCheckbox').checked) {
    document.getElementById('borderTypes').disabled = false;
    document.getElementById('borderColorPreview').disabled = false;
    document.getElementById('borderColorPicker').disabled = false;
    document.getElementById('colorDefaultBlack').disabled = false;
    document.getElementById('colorDefaultWhite').disabled = false;
  }
  else {
    document.getElementById('borderTypes').disabled = true;
    document.getElementById('borderColorPreview').disabled = true;
    document.getElementById('borderColorPicker').disabled = true;
    document.getElementById('colorDefaultBlack').disabled = true;
    document.getElementById('colorDefaultWhite').disabled = true;
  }
}

function enableBackgroundColor() {
  if (document.getElementById('enableBackgroundColorCheckbox').checked) {
    document.getElementById('backgroundColorPicker').disabled = false;
    document.getElementById('backgroundColorPreview').disabled = false;
  }
  else {
    document.getElementById('backgroundColorPicker').disabled = true;
    document.getElementById('backgroundColorPreview').disabled = true;
  }
}

function enableGlossOptions() {
  if (document.getElementById('checkboxEnableGloss').checked) {
    document.getElementById('effectGlossTypes').disabled = false;
  }
  else {
    document.getElementById('effectGlossTypes').disabled = true;
  }
}

function enableComposePhotos() {
  if (document.getElementById('enableComposeWindowPhotos').checked) {
    document.getElementById('composePhotoPosition').disabled = false;
    document.getElementById('listComposeWindowStyle').disabled = false;
  }
  else {
    document.getElementById('composePhotoPosition').disabled = true;
    document.getElementById('listComposeWindowStyle').disabled = true;
  }
}

function selectPhotoDirectory() {
  var dirTextbox = document.getElementById('enableLocalPhotosTextbox');

  const nsIFilePicker = Components.interfaces.nsIFilePicker;

  var title = contactPhoto.localizedJS.getString('selectDirectory');
  var picker = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
  picker.init(window, title, nsIFilePicker.modeGetFolder);

  try {
    var initDir = Components.classes["@mozilla.org/file/local;1"]
            .createInstance(Components.interfaces.nsIFile);
    initDir.initWithPath(dirTextbox.value);
    picker.displayDirectory = initDir;
  }
  catch (ex) { }

  picker.open(function (rv) {
    if (rv == nsIFilePicker.returnOK) {
      var directory = picker.file;
      dirTextbox.value = directory.path;

      // automatic setting and getting of this pref does not work...
      contactPhoto.prefs.set('photoDirectory', directory, 'file');
    }
  });

  enableOpenLocalFolder();
}

function openPhotoDirectory() {
  var dirTextbox = document.getElementById('enableLocalPhotosTextbox');

  try {
    var localDir = Components.classes["@mozilla.org/file/local;1"].getService(Components.interfaces.nsIFile);
    localDir.initWithPath(dirTextbox.value);
    localDir.launch();
  }
  catch (ex) {
    contactPhoto.utils.customAlert(contactPhoto.localizedJS.getString('directoryOpenError'));
  }
}

function clearCache() {
  // this code needs to be reworked
  if (contactPhoto.cache.clear()) {
    contactPhoto.utils.customAlert(contactPhoto.localizedJS.getString('cacheCleared'));
  }
  else {
    contactPhoto.utils.customAlert(contactPhoto.localizedJS.getString('cacheClearedError'));
  }
}

function populateDefaultGenericPhotoList() {
  var genericPhotoList = document.getElementById('listDefaultPhoto');

  var menupopup = genericPhotoList.firstChild;

  // copy all entries from the template list into the real list
  var templateList = document.getElementById('DCP-GenericPhotoListTemplate');
  var templateMenupopup = templateList.firstChild;

  for (var i=0; i<templateMenupopup.childNodes.length; i++) {
    var clone = templateMenupopup.childNodes[i].cloneNode(true);
    menupopup.appendChild(clone);
  }

  // update the list
  document.getElementById('extensions.contactPhoto.defaultGenericPhoto').updateElements();
}

function enableGravatar() {
  var menuitemGravatar = document.getElementById('DCP-GenericPhotoGravatar');

  if (document.getElementById('checkboxEnableGravatar').checked) {
    menuitemGravatar.disabled = false;
    document.getElementById('defaultGravatar').disabled = false;

  }
  else {
    // if gravatar is the current default photo when it gets disabled, change the default photo
    if (menuitemGravatar.selected) {
      var menuitemDCP = document.getElementById('DCP-GenericPhotoDCP');
      contactPhoto.prefs.set('defaultGenericPhoto', menuitemDCP.value, 'char');
      document.getElementById('extensions.contactPhoto.defaultGenericPhoto').updateElements();
    }

    menuitemGravatar.disabled = true;
    document.getElementById('defaultGravatar').disabled = true;
  }
}

function loadWebsite(e) {
  if (e.button == 0) {
    openURL(e.target.value);
  }
}

// openURL: copied from thunderbird
function openURL(aURL) {
    var ios = Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService);
    var uri = ios.newURI(aURL, null, null);
    var protocolSvc = Components.classes['@mozilla.org/uriloader/external-protocol-service;1'].getService(Components.interfaces.nsIExternalProtocolService);
    if (!protocolSvc.isExposedProtocol(uri.scheme)) {
        protocolSvc.loadURI(uri);
    }
    else {
        var loadgroup = Components.classes['@mozilla.org/network/load-group;1'].createInstance(Components.interfaces.nsILoadGroup);
        var appstartup = Components.classes['@mozilla.org/toolkit/app-startup;1'].getService(Components.interfaces.nsIAppStartup);
        var loadListener = {onStartRequest: function ll_start(aRequest, aContext) {appstartup.enterLastWindowClosingSurvivalArea();}, onStopRequest: function ll_stop(aRequest, aContext, aStatusCode) {appstartup.exitLastWindowClosingSurvivalArea();}, QueryInterface: function ll_QI(iid) {if (iid.equals(Components.interfaces.nsISupports) || iid.equals(Components.interfaces.nsIRequestObserver) || iid.equals(Components.interfaces.nsISupportsWeakReference)) {return this;}throw Components.results.NS_ERROR_NO_INTERFACE;}};
        loadgroup.groupObserver = loadListener;
        var uriListener = {onStartURIOpen: function (uri) {return false;}, doContent: function (ctype, preferred, request, handler) {return false;}, isPreferred: function (ctype, desired) {return false;}, canHandleContent: function (ctype, preferred, desired) {return false;}, loadCookie: null, parentContentListener: null, getInterface: function (iid) {if (iid.equals(Components.interfaces.nsIURIContentListener)) {return this;}if (iid.equals(Components.interfaces.nsILoadGroup)) {return loadgroup;}throw Components.results.NS_ERROR_NO_INTERFACE;}};
        var channel = ios.newChannelFromURI(uri);
        var uriLoader = Components.classes['@mozilla.org/uriloader;1'].getService(Components.interfaces.nsIURILoader);
        uriLoader.openURI(channel, true, uriListener);
    }
}
