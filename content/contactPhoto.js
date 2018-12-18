if (!contactPhoto) var contactPhoto = {};

contactPhoto.currentVersion = '1.3.1';
contactPhoto.debug = 0; // 0: turn off debug dump, 1: show some msg, 2: show all msg

contactPhoto.dump = function(data) {
  if (!contactPhoto.debug) return;
  var Application = Components.classes["@mozilla.org/steel/application;1"]
                      .getService(Components.interfaces.steelIApplication);
  Application.console.log(JSON.stringify(data));
}


// Namespaces used by document.createElementNS()
contactPhoto.ns = {
  XUL: 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul',
  XHTML: 'http://www.w3.org/1999/xhtml'
};

contactPhoto.genericInit = function() {
  contactPhoto.prefs.init(); // initialize preferences

  // load localized javascript variables
  contactPhoto.localizedJS = document.getElementById('DCP-LocalizedJS');

  // delay init stuff to improve startup time
  window.setTimeout(function() {
    // do some version first-time run stuff
    if (contactPhoto.prefs.get('currentVersion', 'char') != contactPhoto.currentVersion) {
      contactPhoto.prefs.set('currentVersion', contactPhoto.currentVersion, 'char');

      // remove some outdated preferences
      var prefsToRemove = ['bgColor', 'maxSize', 'photoBoxSize', 'maxSizeUnit', 'createThumbnails', 'defaultGenericIcon', 'effectCornerRadius'];
      for (var i in prefsToRemove) {
        try {
          contactPhoto.prefs.branch.clearUserPref(prefsToRemove[i]);
        }
        catch (e) {}
      }

      contactPhoto.cache.clear();


      // open support website in a new tab
      if (contactPhoto.prefs.get('openWebsiteAfterInstall', 'bool')) {
        Components.classes['@mozilla.org/appshell/window-mediator;1']
          .getService(Components.interfaces.nsIWindowMediator)
          .getMostRecentWindow("mail:3pane")
          .document.getElementById("tabmail")
          .openTab("contentTab", {contentPage: 'http://dicop.sourceforge.net/just_installed.php?version='+contactPhoto.currentVersion});
      }

      // sanitize card values
      contactPhoto.utils.sanitizeCards();
    }



    // add add-on uninstall listener to remove thumbnail directory
    Components.utils.import("resource://gre/modules/AddonManager.jsm");
    AddonManager.addAddonListener({
      onUninstalling: function(addon) {
        if (addon.id == 'contactPhoto@leven.ch') {
          contactPhoto.cache.removeCacheDirectory();
        }
      },
      onOperationCancelled: function(addon) {
        if (addon.id == 'contactPhoto@leven.ch') {
          contactPhoto.cache.checkDirectory();
        }
      }
    });

    // debug stuff
    if (contactPhoto.debug > 0) { // auto-open javascript console
      var Application = Components.classes["@mozilla.org/steel/application;1"]
                      .getService(Components.interfaces.steelIApplication);
      Application.console.open();
    }

  }, 1000);

}
window.addEventListener('load', contactPhoto.genericInit, false);

contactPhoto.prefs = {
  customHeaders: ['face'],
  preferencesLoaded: false,

  init: function() {
    if (!contactPhoto.prefs.preferencesLoaded) {
      contactPhoto.prefs.preferencesLoaded = true;
      contactPhoto.prefs.branch = Components.classes['@mozilla.org/preferences-service;1']
        .getService(Components.interfaces.nsIPrefService)
        .getBranch('extensions.contactPhoto.');
    }
  },

  get: function(prefName, type) {
    try {
      switch (type) {
        case 'bool':
          return contactPhoto.prefs.branch.getBoolPref(prefName);

        case 'int':
          return parseInt(contactPhoto.prefs.branch.getIntPref(prefName));

        case 'char':
          return contactPhoto.prefs.branch.getCharPref(prefName);

        case 'file':
          try {
            return contactPhoto.prefs.branch.getComplexValue(prefName, Components.interfaces.nsIFile);
          }
          catch(e) {
            contactPhoto.dump('failed to load file pref: ' + prefName);
          }
      }
    }
    catch (e){
      contactPhoto.dump('pref.get() failed: ' + prefName)
    }
  },

  set: function(prefName, prefValue, type) {
    switch (type) {
      case 'bool':
        contactPhoto.prefs.branch.setBoolPref(prefName, prefValue);
      break;

      case 'int':
        contactPhoto.prefs.branch.setIntPref(prefName, prefValue);
      break;

      case 'char':
        contactPhoto.prefs.branch.setCharPref(prefName, prefValue);
      break;

      case 'file':
        contactPhoto.prefs.branch.setComplexValue(prefName, Components.interfaces.nsIFile, prefValue);
      break;
    }
  },

  // delete all preferences
  deletePreferences: function() {
    contactPhoto.prefs.branch.deleteBranch('');
  },

  // checkCustomHeaders: adds custom headers to message index (currently only 'face') without removing existing headers
  checkCustomHeaders: function() {
    var headerPrefs = Components.classes['@mozilla.org/preferences-service;1']
          .getService(Components.interfaces.nsIPrefService)
    headerPrefs = headerPrefs.QueryInterface(Components.interfaces.nsIPrefBranch);
    //var customDBHeaders = headerPrefs.getCharPref('mailnews.customDBHeaders').split(' ');
    var customDBHeaders = headerPrefs.getCharPref('mailnews.headers.extraExpandedHeaders').split(' ');

    var headersToAdd = [];
    for (var i in contactPhoto.prefs.customHeaders) {
      var hdr = contactPhoto.prefs.customHeaders[i];
      var foundHeader = false;
      for (var j in customDBHeaders) {
        if (hdr == customDBHeaders[j]) {
          foundHeader = true;
          break;
        }
      }
      if (!foundHeader) {
        headersToAdd.push(hdr);
      }
    }

    var newCustumHeaders = customDBHeaders.concat(headersToAdd).join(' ');
    //headerPrefs.setCharPref('mailnews.customDBHeaders', newCustumHeaders);
    headerPrefs.setCharPref('mailnews.headers.extraExpandedHeaders', newCustumHeaders);
  }
};

contactPhoto.style = {
  addClass: function(el, cls) {
    if (!contactPhoto.style.hasClass(el, cls)) {
      el.className += " "+cls;
    }
  },

  removeClass: function(el, cls) {
    if (contactPhoto.style.hasClass(el, cls)) {
      var reg = new RegExp('(\\s|^)'+cls+'(\\s|$)');
      el.className = el.className.replace(reg, ' ');
    }
  },

  hasClass: function(el, cls) {
    return el.className.match(new RegExp('(\\s|^)'+cls+'(\\s|$)'));
  }
}

contactPhoto.display = {
  // logic: determines which photo is displayed according to the preferences
  // isMessagePhoto is set to false in the compose window
  logic: function(photoInfo, isMessagePhoto) {
    var cropContextmenuItem;
    if (isMessagePhoto) {
      cropContextmenuItem = document.getElementById('DCP-ContextmenuCrop');
      cropContextmenuItem.disabled = true;
    }

    if (isMessagePhoto && contactPhoto.photoBox.hasAttribute('hidden')) {
      contactPhoto.photoBox.removeAttribute('hidden');
    }

    if (photoInfo.hasPhoto && photoInfo.hasFace) {
      var prefOverrideFaces = contactPhoto.prefs.get('overrideFaces', 'bool');

      if (prefOverrideFaces) { // there is a face, but display the contact photo
        if (photoInfo.hasGenericPhoto) {
          contactPhoto.display.genericPhoto(photoInfo);
          return;
        }
        else {
          contactPhoto.display.photo(photoInfo);
          if (isMessagePhoto) cropContextmenuItem.disabled = false;
          return;
        }
      }
      else {
        contactPhoto.display.face(photoInfo);
        return;
      }
    }

    if (photoInfo.hasFace) {
      contactPhoto.display.face(photoInfo);
      return;
    }

    if (photoInfo.hasPhoto) {
      if (photoInfo.hasGenericPhoto) {
        contactPhoto.display.genericPhoto(photoInfo);
        return;
      }
      else {
        contactPhoto.display.photo(photoInfo);
        if (isMessagePhoto) cropContextmenuItem.disabled = false;
        return;
      }
    }

    if (photoInfo.hasLocalPhoto) {
      contactPhoto.display.localPhoto(photoInfo);
      return;
    }

    if (photoInfo.hasDomainWildcard) {
      contactPhoto.display.domainWildcard(photoInfo);
      return;
    }

    // if we are here, then there is no photo nor face to show

    if (!isMessagePhoto) {
      contactPhoto.display.defaultPhoto(photoInfo);
      return;
    }

    // this is only evaluated if isMessagePhoto=true
    switch (contactPhoto.prefs.get('defaultPhoto', 'char')) {
      case 'show':
        contactPhoto.display.defaultPhoto(photoInfo);
        return;
      break;

      case 'hide':
        if (isMessagePhoto)
          contactPhoto.messageDisplay.imgObj.style.display = 'none';
        return;
      break;

      default:
        if (isMessagePhoto)
          contactPhoto.photoBox.setAttribute('hidden', true);
    }

    // in case the photo is not displayed in a message header, do nothing

  },

  photo: function(photoInfo) {
    var origFile = Components.classes["@mozilla.org/file/directory_service;1"]
            .getService(Components.interfaces.nsIProperties)
            .get("ProfD", Components.interfaces.nsIFile);
    origFile.append('Photos');
    origFile.append(photoInfo.photoName);

    var srcURI = contactPhoto.utils.makeURI(origFile);
    contactPhoto.dump('disp photo ' + srcURI);
    contactPhoto.display.checkPhoto(srcURI, photoInfo);
  },

  genericPhoto: function(photoInfo) {
    if (contactPhoto.prefs.get('enableGravatar', 'bool') && photoInfo.genericPhotoURI.indexOf('gravatar') > -1) {
      contactPhoto.display.gravatar(photoInfo);
      return;
    }

    contactPhoto.dump('disp generic photo ' + photoInfo.genericPhotoURI);
    contactPhoto.display.checkPhoto(photoInfo.genericPhotoURI, photoInfo);
  },

  localPhoto: function(photoInfo) {
    contactPhoto.dump('disp loc photo ' + photoInfo.localPhotoURI);
    contactPhoto.display.checkPhoto(photoInfo.localPhotoURI, photoInfo);
  },

  domainWildcard: function(photoInfo) {
    contactPhoto.dump('disp loc * photo ' + photoInfo.domainWildcardURI);
    contactPhoto.display.checkPhoto(photoInfo.domainWildcardURI, photoInfo);
  },

  face: function(photoInfo) {
    contactPhoto.dump('disp face photo ' + photoInfo.domainWildcardURI);

    photoInfo.photoObject.style.width = '48px';
    photoInfo.photoObject.style.height = '48px';
    photoInfo.photoObject.style.listStyleImage = 'url("'+photoInfo.faceURI+'")';
    photoInfo.photoObject.style.display = 'block';
  },

  gravatar: function(photoInfo) {
    contactPhoto.dump('disp grav photo ' + photoInfo.emailAddress);

    // don't load image if the message has been marked as junk
    // copied from function SelectedMessagesAreJunk()
    var isJunk;
    try {
      var junkScore = gFolderDisplay.selectedMessage.getStringProperty("junkscore");
      isJunk = (junkScore != "") && (junkScore != "0");
    }
    catch (ex) {
      isJunk = false;
    }
    if (isJunk) return;

    // load gravatar image from gravatar server
    var hash = contactPhoto.utils.md5_hex(photoInfo.emailAddress);

    var gravatarURI = contactPhoto.prefs.get('gravatarServer', 'char')+hash+'?d='+contactPhoto.prefs.get('defaultGravatar', 'char')+'&s='+photoInfo.size;
    //var gravatarURI = 'http://www.gravatar.com/avatar/'+hash+'?d='+contactPhoto.prefs.get('defaultGravatar', 'char')+'&s='+photoInfo.size;

    contactPhoto.display.checkPhoto(gravatarURI, photoInfo, true);
  },

  defaultPhoto: function(photoInfo) {
    var defaultPhoto = contactPhoto.prefs.get('defaultGenericPhoto', 'char');

    contactPhoto.dump('disp default photo ' + defaultPhoto);
    if (contactPhoto.prefs.get('enableGravatar', 'bool') && defaultPhoto.indexOf('gravatar') > -1) {
      contactPhoto.display.gravatar(photoInfo);
      return;
    }

    contactPhoto.display.checkPhoto(defaultPhoto, photoInfo);
  },

  // checkPhoto: checks if the thumbnails exists -> starts the loader, else starts the resizer
  checkPhoto: function(srcURI, photoInfo, isGravatar) {
    var thumbnailName;

    // gravatar url contain invalid file name characters, so a separate name is generated
    if (isGravatar) {
      thumbnailName = 'gravatar-'+photoInfo.emailAddress;
    }
    else {
      thumbnailName = contactPhoto.utils.getFilename(srcURI);
    }

    var thumbnailFile = Components.classes["@mozilla.org/file/directory_service;1"]
      .getService(Components.interfaces.nsIProperties)
      .get("ProfD", Components.interfaces.nsIFile);
    thumbnailFile.append(contactPhoto.cache.directory);
    thumbnailFile.append(photoInfo.size);
    thumbnailFile.append(thumbnailName+'.png');
    contactPhoto.dump("path: " + thumbnailFile.path +", exists: "+ thumbnailFile.exists())

    if (thumbnailFile.exists()) { // if the thumbnail already exists, display it

      contactPhoto.display.photoLoader(contactPhoto.utils.makeURI(thumbnailFile), photoInfo);

      // prune photos older than a week, they will be regenerated when they are displayed the next time
      var oneWeekAgo = new Date().getTime() - 604800000; // 1000 * 3600 * 24 * 7;
      if (thumbnailFile.lastModifiedTime < oneWeekAgo) {
        try {
          thumbnailFile.remove(false);
        }
        catch (e) {}
      }

    }
    else { // generate it
      contactPhoto.resizer.queue.add(srcURI, thumbnailFile, photoInfo);

      contactPhoto.dump('generate');
      var callbackFunc = function() {
        contactPhoto.dump('queue');
        
        contactPhoto.display.photoLoader(contactPhoto.utils.makeURI(thumbnailFile), photoInfo);
      }

      contactPhoto.resizer.startProcessing(null, callbackFunc);
    }
  },

  // soft cache of Image() elements, used for drawing in canvas
  photoCache: [],

  // photoLoader: pre-loads the photo to determine the dimensions, then displays the photo
  photoLoader: function(URI, photoInfo) {
    var dummyPhoto = new Image();

    dummyPhoto.addEventListener('load', function() {
      photoInfo.photoObject.style.width = dummyPhoto.width+'px';
      photoInfo.photoObject.style.height = dummyPhoto.height+'px';

      URI = URI+'?'+Math.floor(Math.random()*1000000000); // force to load photo every time
      photoInfo.photoObject.style.listStyleImage = 'url("'+URI+'")';
      photoInfo.photoObject.style.display = 'block';

      contactPhoto.display.photoCache[photoInfo.emailAddress+'-'+photoInfo.size] = dummyPhoto;
    }, false);
    
    dummyPhoto.addEventListener('error', function() {
      contactPhoto.dump('photoLoader(): failed to load image: ' + URI);
    }, false);

    dummyPhoto.src = URI+'?'+Math.floor(Math.random()*1000000000);
  }
}

// photoForEmailAddress: get all existing photos for a given email address
contactPhoto.photoForEmailAddress = function(emailAddress) {
  emailAddress = emailAddress.toLowerCase();

  var photoInfo = contactPhoto.utils.newPhotoInfo(emailAddress);

  photoInfo.cardDetails = contactPhoto.getCard(emailAddress);

  contactPhoto.getCardPhoto(photoInfo);
  contactPhoto.getLocalPhoto(photoInfo);

  return photoInfo;
}

// photoForCard: get all existing photos for a given email address
contactPhoto.photoForCard = function(aCard) {
  var photoInfo = contactPhoto.utils.newPhotoInfo(aCard.primaryEmail);

  photoInfo.cardDetails = {
    ab: null,
    card: aCard,
  };

  contactPhoto.getCardPhoto(photoInfo);
  contactPhoto.getLocalPhoto(photoInfo);

  return photoInfo;
}


// getLocalPhotos: search the local folder for
contactPhoto.getLocalPhoto = function(photoInfo) {
  if (contactPhoto.prefs.get('enableLocalPhotos', 'bool') == false) return;

  // first collect all e-mail addresses in an array, then search the file system
  var addressList = [];

  // get the addresses from the card if the contact has one
  if (photoInfo.cardDetails.card) {
    var address = photoInfo.cardDetails.card.getProperty('PrimaryEmail', '');
    if (address != '') addressList[addressList.length] = address;

    var address = photoInfo.cardDetails.card.getProperty('SecondEmail', '');
    if (address != '') addressList[addressList.length] = address;
  }
  else if (photoInfo.emailAddress) {
    addressList[addressList.length] = photoInfo.emailAddress;
  }
  var fileTypes = contactPhoto.prefs.get('imageExtensions', 'char').split(',');
  var prefLocalPhotoDir = contactPhoto.prefs.get('photoDirectory', 'file');

  try {
    var localPhotoDir = Components.classes["@mozilla.org/file/local;1"]
              .createInstance(Components.interfaces.nsIFile);
    localPhotoDir.initWithFile(prefLocalPhotoDir); // this might throw an error

    if (!localPhotoDir.exists()) return;

    // search through all addresses in the list until a match is found
    while (addressList.length > 0) {
      var address = addressList.shift().toLowerCase(); // get and remove the first element

      // look for local photos
      for (var i in fileTypes) {
        var localPhoto = Components.classes["@mozilla.org/file/local;1"]
                  .createInstance(Components.interfaces.nsIFile);
        localPhoto.initWithFile(prefLocalPhotoDir);
        localPhoto.append(address+'.'+fileTypes[i]);

        if (localPhoto.exists()) { // there is actually a file
          photoInfo.hasLocalPhoto = true;
          photoInfo.localPhotoURI = contactPhoto.utils.makeURI(localPhoto);
          break;
        }
      }

      // look for domain wildcard photos
      if (contactPhoto.prefs.get('enableDomainWildcardPhotos', 'bool')) {
        var domain = address.substr(address.indexOf('@'));
        for (var i in fileTypes) {
          var wildcard = Components.classes["@mozilla.org/file/local;1"]
                    .createInstance(Components.interfaces.nsIFile);
          wildcard.initWithFile(prefLocalPhotoDir);
          wildcard.append(domain+'.'+fileTypes[i]);


          if (wildcard.exists()) { // there is actually a file
            photoInfo.hasDomainWildcard = true;
            photoInfo.domainWildcardURI = contactPhoto.utils.makeURI(wildcard);
            break;
          }
        }
      }

      if (photoInfo.hasLocalPhoto || photoInfo.hasDomainWildcard) break;
    }
  }
  catch (ex) {
    contactPhoto.dump('failed to load local photo, errmsg: '+ex);
  }
}

// getCardPhoto: get the photo information stored in a card
contactPhoto.getCardPhoto = function(photoInfo) {
  if (photoInfo.cardDetails && photoInfo.cardDetails.card) {

    var photoType = photoInfo.cardDetails.card.getProperty('PhotoType', '');

    if (photoType != '') {
      if (photoType == 'generic') {
        var photoURI = photoInfo.cardDetails.card.getProperty('PhotoURI', '');
        var DCPDefaultPhotoURI = contactPhoto.prefs.get('defaultGenericPhoto', 'char');

        if (photoURI != '' && photoURI != 'null' && photoURI != DCPDefaultPhotoURI) {
          photoInfo.hasGenericPhoto = true;
          photoInfo.hasPhoto = true;
          photoInfo.genericPhotoURI = photoURI;
        }

      }
      else { // there is a contact photo
        var photoName = photoInfo.cardDetails.card.getProperty('PhotoName', '');

        if (photoName != '') {
          photoInfo.hasPhoto = true;
          photoInfo.photoName = photoName;
        }
      }
    }
  }
}

// getCard: searches the first card match in all address books for a given email address
contactPhoto.getCard = function(emailAddress) {
  let abManager = Components.classes["@mozilla.org/abmanager;1"]
            .getService(Components.interfaces.nsIAbManager);
  let allAddressBooks = abManager.directories;

  var cardDetails = {};

  while (allAddressBooks.hasMoreElements()) {
    let ab = allAddressBooks.getNext().QueryInterface(Components.interfaces.nsIAbDirectory);
    if (ab.isRemote) continue; // skip ldap directories

    try {
      var card = ab.cardForEmailAddress(emailAddress).QueryInterface(Components.interfaces.nsIAbCard);
      if (card == null) continue;

      cardDetails = {
        book: ab,
        card: card
      };
      break;

    }
    catch (ex) { }
  }

  return cardDetails;
}


// functions for disk cache managing
contactPhoto.cache = {
  directory: 'contactPhotoThumbnails',

  // clear: empties the cache
  clear: function() {
    var cacheDir = Components.classes["@mozilla.org/file/directory_service;1"]
      .getService(Components.interfaces.nsIProperties)
      .get("ProfD", Components.interfaces.nsIFile);
    cacheDir.append(contactPhoto.cache.directory);

    if (cacheDir.exists() && cacheDir.isDirectory()) {
      var subDirs = cacheDir.directoryEntries;
      while (subDirs.hasMoreElements()) {

        var dir = subDirs.getNext().QueryInterface(Components.interfaces.nsIFile);

        if (dir.exists() && dir.isDirectory()) {
          try {
            dir.remove(true); // remove the directory and all its contents
          }
          catch (e) {
            return false;
          }
        }
      }

      return true;
    }

    return false;
  },

  // createSubDirectory: creates a directory in the thumbnail directory if it does not exist
  createSubDirectory: function(name) {
    var newDir = Components.classes["@mozilla.org/file/directory_service;1"]
      .getService(Components.interfaces.nsIProperties)
      .get("ProfD", Components.interfaces.nsIFile);
    newDir.append(contactPhoto.cache.directory);
    newDir.append(name);

    if (newDir.exists() && newDir.isDirectory()) {
      return;
    }

    newDir.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0777);
  },

  // checkDirectory: checks if the cache directory exists, else creates it
  checkDirectory: function() {
    var cacheDir = Components.classes["@mozilla.org/file/directory_service;1"]
      .getService(Components.interfaces.nsIProperties)
      .get("ProfD", Components.interfaces.nsIFile);
    cacheDir.append(contactPhoto.cache.directory);

    if (!cacheDir.exists() || !cacheDir.isDirectory()) {
      cacheDir.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0777);
    }
  },

  // removeThumbnail: delete a specific thumbnail from the cache
  removeThumbnail: function(fileName) {
    subdirectories = [
      ''+contactPhoto.prefs.get('smallIconSize', 'int'),
      ''+contactPhoto.prefs.get('photoSize', 'int'),
      ''+contactPhoto.prefs.get('composePhotos.size', 'int')
    ];

    for (var i in subdirectories) {
      var removeFile = Components.classes["@mozilla.org/file/directory_service;1"]
        .getService(Components.interfaces.nsIProperties)
        .get("ProfD", Components.interfaces.nsIFile);
      removeFile.append(contactPhoto.cache.directory);
      removeFile.append(subdirectories[i]);
      removeFile.append(fileName+'.png');

      if (removeFile.exists()) {
        removeFile.remove(false);
      }
    }
  },

  // delete the entire cache directory (on add-on uninstall)
  removeCacheDirectory: function() {
    var cacheDir = Components.classes["@mozilla.org/file/directory_service;1"]
      .getService(Components.interfaces.nsIProperties)
      .get("ProfD", Components.interfaces.nsIFile);
    cacheDir.append(contactPhoto.cache.directory);

    if (cacheDir.exists()) {
      cacheDir.remove(true); // remove recursively
    }
  }
};

// functions for thumbnail managing/processing
contactPhoto.resizer = {
  currentImage: null,
  dummyImg: null,
  canvas: null,
  ctx: null,
  callbackDone: [],
  callbackProgress: [],
  resizing: false,

  // functions for managing the resizer queue
  queue: {
    buffer: [],
    maxLength: 0,

    add: function(srcImage, destImage, photoInfo) {
      contactPhoto.resizer.queue.buffer.push({
        src: srcImage, // path/URI to source
        dest: destImage, // nsIFile of destination
        size: photoInfo.size, // the maximum size of the resized image
        info: photoInfo
      });
      contactPhoto.resizer.queue.maxLength++;
    },

    getNext: function() {
      return contactPhoto.resizer.queue.buffer.shift();
    },

    length: function() {
      return contactPhoto.resizer.queue.buffer.length;
    },

    empty: function() {
      return (contactPhoto.resizer.queue.buffer.length == 0);
    }

  },

  // startProcessing: starts the image resize process
  startProcessing: function(callbackProgress, callbackDone) {

    if (typeof callbackDone == 'function') contactPhoto.resizer.callbackDone.push(callbackDone);
    if (typeof callbackProgress == 'function') contactPhoto.resizer.callbackProgress.push(callbackProgress);

    if (contactPhoto.resizer.resizing == false) {
      contactPhoto.resizer.resizing = true;
      contactPhoto.resizer.processQueue();
    }
  },

  // processQueue: gets the next entry in the queue and starts resizing
  processQueue: function() {
    if (contactPhoto.resizer.queue.empty()) { // finished processing
      contactPhoto.resizer.currentImage = null;

      if (contactPhoto.resizer.callbackDone.length > 0) {
        for (var i in contactPhoto.resizer.callbackDone) {
          contactPhoto.resizer.callbackDone[i]();
        }
      }

      contactPhoto.resizer.resizing = false;
      return;
    }

    contactPhoto.resizer.currentImage = contactPhoto.resizer.queue.getNext();

    contactPhoto.resizer.resizeStep1();
  },

  // resizeStep1: first pre-loads the image to get the dimensions
  resizeStep1: function() {
    contactPhoto.resizer.dummyImg = new Image();
    contactPhoto.resizer.dummyImg.addEventListener('load', function() {
      contactPhoto.resizer.resizeStep2();
    }, false);
    contactPhoto.resizer.dummyImg.addEventListener('error', function() {
      contactPhoto.dump('resizeStep1(): failed to load image: ' + contactPhoto.resizer.currentImage.src);
    }, false);

    contactPhoto.resizer.dummyImg.src = contactPhoto.resizer.currentImage.src;
  },

  // resizeStep2: does the actual resizing and applies the visual effects
  resizeStep2: function() {
    var preScaleFactor = 2; // the images are scaled down in two steps to enhance quality

    var w = contactPhoto.resizer.dummyImg.width;
    var h = contactPhoto.resizer.dummyImg.height;

    contactPhoto.resizer.canvas = document.createElementNS(contactPhoto.ns.XHTML, 'canvas');
    contactPhoto.resizer.ctx = contactPhoto.resizer.canvas.getContext('2d');

    var maxSize = contactPhoto.resizer.currentImage.size;
    var photoInfo = contactPhoto.resizer.currentImage.info;
    var card = (photoInfo.cardDetails && photoInfo.cardDetails.card)? photoInfo.cardDetails.card: null;

    var cropPhoto = false;
    if (photoInfo.hasPhoto && !photoInfo.hasGenericPhoto
        && !photoInfo.hasLocalPhoto && !photoInfo.hasDomainWildcard) {
      var cropPhotoName = card.getProperty('CropPhotoName', '');

      if (cropPhotoName == photoInfo.photoName) { // do not crop if the image is outdated
        cropPhoto = true;

        var cropW = card.getProperty('CropPhotoWidth', '');
        var cropH = card.getProperty('CropPhotoHeight', '');
        if (cropW != '') w = parseInt(cropW);
        if (cropH != '') h = parseInt(cropH);
      }
    }

    if (w > maxSize || h > maxSize) { // do not upscale an image
      if (w > h) {
        h = Math.round(h/w*maxSize)
        w = maxSize;
      }
      else {
        w = Math.round(w/h*maxSize)
        h = maxSize;
      }
    }

    contactPhoto.resizer.canvas.width = w;
    contactPhoto.resizer.canvas.height = h;

    // fill background
    if (contactPhoto.prefs.get('drawBackgroundColor', 'bool')) {
      var rgb = contactPhoto.utils.getColor('backgroundColor');
      contactPhoto.resizer.ctx.fillStyle = 'rgb('+rgb[0]+', '+rgb[1]+', '+rgb[2]+')';
      contactPhoto.resizer.ctx.fillRect(0, 0, w, h);
    }

    var cropped_resized = false; // is used to signal that the image has been cropped/resized
    if (cropPhoto) {
      var cropW = card.getProperty('CropPhotoWidth', '');
      var cropH = card.getProperty('CropPhotoHeight', '');
      var cropL = card.getProperty('CropPhotoLeft', '');
      var cropT = card.getProperty('CropPhotoTop', '');

      if (cropW != '' && cropH != '' && cropL != '' && cropT != '') {
        // only pre-scale if source image is big enough
        if (contactPhoto.resizer.dummyImg.width > w*preScaleFactor && contactPhoto.resizer.dummyImg.height > h*preScaleFactor) {
          var preScaleCanvas = document.createElementNS(contactPhoto.ns.XHTML, 'canvas');
          preScaleCanvas.width = Math.round(w*preScaleFactor);
          preScaleCanvas.height = Math.round(h*preScaleFactor);

          var preScaleCtx = preScaleCanvas.getContext('2d');

          preScaleCtx.drawImage(contactPhoto.resizer.dummyImg, cropL, cropT, cropW, cropH, 0, 0, preScaleCanvas.width, preScaleCanvas.height);
          contactPhoto.resizer.ctx.drawImage(preScaleCanvas, 0, 0, w, h);
        }
        else { // just draw it
          contactPhoto.resizer.ctx.drawImage(contactPhoto.resizer.dummyImg, cropL, cropT, cropW, cropH, 0, 0, w, h);
        }
        cropped_resized = true;
      }
    }

    if (!cropped_resized) {
      // only pre-scale if source image is big enough
      if (contactPhoto.resizer.dummyImg.width > w*preScaleFactor && contactPhoto.resizer.dummyImg.height > h*preScaleFactor) {
        var preScaleCanvas = document.createElementNS(contactPhoto.ns.XHTML, 'canvas');
        preScaleCanvas.width = Math.round(w*preScaleFactor);
        preScaleCanvas.height = Math.round(h*preScaleFactor);

        var preScaleCtx = preScaleCanvas.getContext('2d');

        preScaleCtx.drawImage(contactPhoto.resizer.dummyImg, 0, 0, preScaleCanvas.width, preScaleCanvas.height);
        contactPhoto.resizer.ctx.drawImage(preScaleCanvas, 0, 0, w, h);
      }
      else { // just draw it
        contactPhoto.resizer.ctx.drawImage(contactPhoto.resizer.dummyImg, 0, 0, w, h);
      }
    }

    /* IMAGE EFFECTS */

    // apply gloss effect on all images
    if (contactPhoto.prefs.get('effectGloss', 'bool')) {
      contactPhoto.imageFX.addGloss();
    }

    if (!photoInfo.noVisualEffects) {
      if (contactPhoto.prefs.get('effectRoundedCorners', 'bool')) {
        contactPhoto.imageFX.roundCorners();
      }

      if (contactPhoto.prefs.get('effectShadow', 'bool')) {
        contactPhoto.imageFX.addShadow();
      }

      if (contactPhoto.prefs.get('effectBorder', 'bool')) {
        var borderType = contactPhoto.prefs.get('effectBorderType', 'int');
        if (borderType == 1) { // thin border
          contactPhoto.imageFX.addBorder();
        }
        else if (borderType == 2) { // blurred border
          contactPhoto.imageFX.addBlurredBorder();
        } // more borders to come?
      }
    }

    // create a data url from the canvas and then create URIs of the source and targets
    var io = Components.classes["@mozilla.org/network/io-service;1"]
             .getService(Components.interfaces.nsIIOService);
    var source = io.newURI(contactPhoto.resizer.canvas.toDataURL('image/png', ''), 'UTF8', null);

    // check if the thumbnail folder exists
    contactPhoto.cache.createSubDirectory(contactPhoto.resizer.currentImage.size);

    // prepare to save the canvas data
    var persist = Components.classes["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"]
              .createInstance(Components.interfaces.nsIWebBrowserPersist);

    persist.persistFlags = Components.interfaces.nsIWebBrowserPersist.PERSIST_FLAGS_REPLACE_EXISTING_FILES;
    persist.persistFlags |= Components.interfaces.nsIWebBrowserPersist.PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION;

    persist.progressListener = {
      onStateChange: function(aWebProgress, aRequest, aFlag, aStatus) {
        if (aFlag & Components.interfaces.nsIWebProgressListener.STATE_STOP) { // if the file is safed
          if (contactPhoto.resizer.callbackProgress.length > 0) {
            var max = contactPhoto.resizer.queue.maxLength;
            var percent = new Number((max-contactPhoto.resizer.queue.length())/max).toFixed(2);

            for (var i in contactPhoto.resizer.callbackProgress) {
              contactPhoto.resizer.callbackProgress[i](percent, max);
            }
          }
          contactPhoto.resizer.processQueue();
        }
      }
    },

    // save the canvas data to the file
    persist.saveURI(source, null, null, 0, null, null, contactPhoto.resizer.currentImage.dest, null);
  }
}

contactPhoto.imageFX = {
  addGloss: function() {
    contactPhoto.resizer.ctx.save();

    var gradPos = contactPhoto.prefs.get('effectGlossGradientPosition', 'int')/100;

    var w = contactPhoto.resizer.canvas.width;
    var h = contactPhoto.resizer.canvas.height;

    // slightly darken the lower part of the image
    var dark = contactPhoto.resizer.ctx.createLinearGradient(0, 0, 0, h);
    dark.addColorStop(Math.max(0, gradPos-.1), 'rgba(0,0,0,0)');
    dark.addColorStop(1, 'rgba(0,0,0,0.07)');
    contactPhoto.resizer.ctx.fillStyle = dark;
    contactPhoto.resizer.ctx.fillRect(0, 0, w, h);

    switch (contactPhoto.prefs.get('effectGlossType', 'int')) {
      case 0:  // gradient curved down
        contactPhoto.resizer.ctx.beginPath();
        contactPhoto.resizer.ctx.moveTo(0, 0);
        contactPhoto.resizer.ctx.lineTo(0, h*gradPos);
        contactPhoto.resizer.ctx.bezierCurveTo(w*.2, h*Math.min(1, gradPos+.1), w*.8, h*Math.min(1, gradPos+.1), w, h*gradPos)
        contactPhoto.resizer.ctx.lineTo(w, 0);
        contactPhoto.resizer.ctx.closePath();

        var grad = contactPhoto.resizer.ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, 'rgba(255,255,255,0.5)');
        grad.addColorStop(gradPos+.1, 'rgba(255,255,255,0.1)');
        grad.addColorStop(gradPos+.1, 'rgba(255,255,255,0)');
        contactPhoto.resizer.ctx.fillStyle = grad;
        contactPhoto.resizer.ctx.fill();
      break;

      case 1:  // gradient curved up
        contactPhoto.resizer.ctx.beginPath();
        contactPhoto.resizer.ctx.moveTo(0, 0);
        contactPhoto.resizer.ctx.lineTo(0, h*Math.min(1, gradPos+.1));
        contactPhoto.resizer.ctx.bezierCurveTo(w*.2, h*gradPos, w*.8, h*gradPos, w, h*Math.min(1, gradPos+.1))
        contactPhoto.resizer.ctx.lineTo(w, 0);
        contactPhoto.resizer.ctx.closePath();

        var grad = contactPhoto.resizer.ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, 'rgba(255,255,255,0.5)');
        grad.addColorStop(Math.min(1, gradPos+.1), 'rgba(255,255,255,0.1)');
        grad.addColorStop(Math.min(1, gradPos+.1), 'rgba(255,255,255,0)');
        contactPhoto.resizer.ctx.fillStyle = grad;
        contactPhoto.resizer.ctx.fill();
      break;

      case 2: // horizontal gradient
        var grad = contactPhoto.resizer.ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, 'rgba(255,255,255,0.5)');
        grad.addColorStop(Math.min(1, gradPos+.1), 'rgba(255,255,255,0.1)');
        grad.addColorStop(Math.min(1, gradPos+.1), 'rgba(255,255,255,0)');
        contactPhoto.resizer.ctx.fillStyle = grad;
        contactPhoto.resizer.ctx.fillRect(0, 0, w, h);
      break;

      case 3: // curved corner gradient
        contactPhoto.resizer.ctx.beginPath();
        contactPhoto.resizer.ctx.moveTo(0, 0);
        contactPhoto.resizer.ctx.lineTo(w, 0);
        contactPhoto.resizer.ctx.lineTo(w, h*.1);
        contactPhoto.resizer.ctx.quadraticCurveTo(w*.33, h*.20, 0, h*.4);
        contactPhoto.resizer.ctx.closePath();

        var grad = contactPhoto.resizer.ctx.createLinearGradient(0, 0, w, h*.4);
        grad.addColorStop(0, 'rgba(255,255,255,0.4)');
        grad.addColorStop(1, 'rgba(255,255,255,0.0)');
        contactPhoto.resizer.ctx.fillStyle = grad;
        contactPhoto.resizer.ctx.fill();
      break;

      case 4: // right edge
        contactPhoto.resizer.ctx.beginPath();
        contactPhoto.resizer.ctx.moveTo(w, 0);
        contactPhoto.resizer.ctx.lineTo(w, h);
        contactPhoto.resizer.ctx.quadraticCurveTo(.8*w, .4*h, .85*w, 0);
        contactPhoto.resizer.ctx.closePath();

        var grad = contactPhoto.resizer.ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, 'rgba(255,255,255,0.6)');
        grad.addColorStop(1, 'rgba(255,255,255,0.0)');
        contactPhoto.resizer.ctx.fillStyle = grad;
        contactPhoto.resizer.ctx.fill();
      break;

      case 5: // upper half
        contactPhoto.resizer.ctx.beginPath();
        contactPhoto.resizer.ctx.moveTo(0, 0);
        contactPhoto.resizer.ctx.lineTo(0, gradPos*h);
        contactPhoto.resizer.ctx.quadraticCurveTo(w, gradPos*.9*h, w, .05*h);
        contactPhoto.resizer.ctx.lineTo(w, 0);
        contactPhoto.resizer.ctx.closePath();

        var grad = contactPhoto.resizer.ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, 'rgba(255,255,255,0.05)');
        grad.addColorStop(1, 'rgba(255,255,255,0.6)');
        contactPhoto.resizer.ctx.fillStyle = grad;
        contactPhoto.resizer.ctx.fill();
      break;

      case 6: // diagonal
        var x0 = .1*w;
        var y0 = 0;
        var x1 = w;
        var y1 = .9*h;

        var m1 = (y1-y0)/(x1-x0);
        var q1 = y0 - m1*x0;

        var m2 = -1/m1;
        var q2 = -m2*w;

        var x3 = (q2-q1)/(m1-m2);
        var y3 = m1*x3 + q1;

        contactPhoto.resizer.ctx.beginPath();
        contactPhoto.resizer.ctx.moveTo(0, 0);
        contactPhoto.resizer.ctx.lineTo(x0, y0);
        contactPhoto.resizer.ctx.lineTo(x1, y1);
        contactPhoto.resizer.ctx.lineTo(w, h);
        contactPhoto.resizer.ctx.lineTo(w, 0);
        contactPhoto.resizer.ctx.closePath();

        var grad = contactPhoto.resizer.ctx.createLinearGradient(x3, y3, w, 0);
        grad.addColorStop(0, 'rgba(255,255,255,0.25)');
        grad.addColorStop(.7, 'rgba(255,255,255,0.05)');
        contactPhoto.resizer.ctx.fillStyle = grad;
        contactPhoto.resizer.ctx.fill();
      break;
    }

    contactPhoto.resizer.ctx.restore();
  },

  addShadow: function() {
    contactPhoto.resizer.ctx.save();
    var canvas = contactPhoto.resizer.canvas;
    var shadowBlur = contactPhoto.prefs.get('effectShadowBlur', 'int');
    var shadowOffset = contactPhoto.prefs.get('effectShadowOffset', 'int');

    contactPhoto.resizer.canvas = document.createElementNS(contactPhoto.ns.XHTML, 'canvas');
    contactPhoto.resizer.ctx = contactPhoto.resizer.canvas.getContext('2d');

    contactPhoto.resizer.canvas.width = canvas.width;
    contactPhoto.resizer.canvas.height = canvas.height;

    contactPhoto.resizer.ctx.shadowOffsetX = shadowOffset;
    contactPhoto.resizer.ctx.shadowOffsetY = shadowOffset;
    contactPhoto.resizer.ctx.shadowBlur = shadowBlur;
    contactPhoto.resizer.ctx.shadowColor = 'rgba(0, 0, 0, .6)';
    contactPhoto.resizer.ctx.drawImage(canvas, (shadowBlur-shadowOffset), (shadowBlur-shadowOffset), canvas.width-(2*shadowBlur), canvas.height-(2*shadowBlur));

    /*
    contactPhoto.resizer.ctx.shadowOffsetX = 0;
    contactPhoto.resizer.ctx.shadowOffsetY = 0;
    contactPhoto.resizer.ctx.shadowBlur = 0;
    */
    contactPhoto.resizer.ctx.restore();
  },

  roundCorners: function() {
    contactPhoto.resizer.ctx.save();
    var w = contactPhoto.resizer.canvas.width;
    var h = contactPhoto.resizer.canvas.height;

    var cornerRadius = Math.round(Math.min(w, h)/4);

    var oldGlobalCompositeOperation = contactPhoto.resizer.ctx.globalCompositeOperation;
    contactPhoto.resizer.ctx.globalCompositeOperation = 'destination-in';

    contactPhoto.resizer.ctx.beginPath();
    contactPhoto.resizer.ctx.moveTo(0, cornerRadius);
    contactPhoto.resizer.ctx.quadraticCurveTo(0, 0, cornerRadius, 0);
    contactPhoto.resizer.ctx.lineTo(w-cornerRadius, 0);
    contactPhoto.resizer.ctx.quadraticCurveTo(w, 0, w, cornerRadius);
    contactPhoto.resizer.ctx.lineTo(w, h-cornerRadius);
    contactPhoto.resizer.ctx.quadraticCurveTo(w, h, w-cornerRadius, h);
    contactPhoto.resizer.ctx.lineTo(cornerRadius, h);
    contactPhoto.resizer.ctx.quadraticCurveTo(0, h, 0, h-cornerRadius);
    contactPhoto.resizer.ctx.closePath();
    contactPhoto.resizer.ctx.fill();

    contactPhoto.resizer.ctx.globalCompositeOperation = oldGlobalCompositeOperation;

    contactPhoto.resizer.ctx.restore();
  },

  addBorder: function() {
    contactPhoto.resizer.ctx.save();

    var w = contactPhoto.resizer.canvas.width;
    var h = contactPhoto.resizer.canvas.height;

    var offsetTL = 0; // top left offset
    var offsetBR = 0; // bottom right offset
    var shadowOffset = contactPhoto.prefs.get('effectShadowOffset', 'int');
    var shadowBlur = contactPhoto.prefs.get('effectShadowBlur', 'int');
    if (contactPhoto.prefs.get('effectShadow', 'bool')) {
      offsetTL = shadowBlur-shadowOffset;
      offsetBR = 2*shadowBlur - offsetTL;
    }

    var borderColor = contactPhoto.utils.getColor('effectBorderColor');
    contactPhoto.resizer.ctx.strokeStyle = 'rgba('+borderColor[0]+', '+borderColor[1]+', '+borderColor[2]+', 1)';
    contactPhoto.resizer.ctx.lineWidth = 1;

    if (contactPhoto.prefs.get('effectRoundedCorners', 'bool')) {
      var cornerRadius = Math.round(Math.min(w, h)/4); // radius is 2px shorter to account for clipping edge
      if (contactPhoto.prefs.get('effectShadow', 'bool')) {
        cornerRadius = Math.round(cornerRadius * (h-2*shadowBlur)/h); // image is smaller when shadow is enabled
      }

      contactPhoto.resizer.ctx.beginPath();
      contactPhoto.resizer.ctx.moveTo(offsetTL+.5, offsetTL+cornerRadius+.5);
      contactPhoto.resizer.ctx.quadraticCurveTo(offsetTL+.5, offsetTL+.5, offsetTL+cornerRadius+.5, offsetTL+.5);
      contactPhoto.resizer.ctx.lineTo(w-offsetBR-cornerRadius-.5, offsetTL+.5);
      contactPhoto.resizer.ctx.quadraticCurveTo(w-offsetBR-.5, offsetTL+.5, w-offsetBR-.5, offsetTL+cornerRadius+.5);
      contactPhoto.resizer.ctx.lineTo(w-offsetBR-.5, h-offsetBR-cornerRadius-.5);
      contactPhoto.resizer.ctx.quadraticCurveTo(w-offsetBR-.5, h-offsetBR-.5, w-offsetBR-cornerRadius-.5, h-offsetBR-.5);
      contactPhoto.resizer.ctx.lineTo(offsetTL+cornerRadius+.5, h-offsetBR-.5);
      contactPhoto.resizer.ctx.quadraticCurveTo(offsetTL+.5, h-offsetBR-.5, offsetTL+.5, h-offsetBR-cornerRadius-.5);
      contactPhoto.resizer.ctx.closePath();
      contactPhoto.resizer.ctx.stroke();

      /*
      contactPhoto.resizer.ctx.beginPath();
      contactPhoto.resizer.ctx.moveTo(offsetTL+.5, offsetTL+.5+cornerRadius);
      contactPhoto.resizer.ctx.quadraticCurveTo(offsetTL+.5, offsetTL+.5, offsetTL+.5+cornerRadius, offsetTL+.5);
      contactPhoto.resizer.ctx.lineTo(w-offsetBR-.5-cornerRadius, offsetTL+.5);
      contactPhoto.resizer.ctx.quadraticCurveTo(w-offsetBR-.5, offsetTL+.5, w-offsetBR-.5, offsetTL+.5+cornerRadius);
      contactPhoto.resizer.ctx.lineTo(w-offsetBR-.5, h-offsetBR-.5-cornerRadius);
      contactPhoto.resizer.ctx.quadraticCurveTo(w-offsetBR-.5, h-offsetBR-.5, w-offsetBR-.5-cornerRadius, h-offsetBR-.5);
      contactPhoto.resizer.ctx.lineTo(offsetTL+.5+cornerRadius, h-offsetBR-.5);
      contactPhoto.resizer.ctx.quadraticCurveTo(offsetTL+.5, h-offsetBR-.5, offsetTL+.5, h-offsetBR-.5-cornerRadius);
      contactPhoto.resizer.ctx.closePath();
      contactPhoto.resizer.ctx.stroke();
      */
    }
    else {
      contactPhoto.resizer.ctx.strokeRect(offsetTL+.5, offsetTL+.5, w-offsetTL-offsetBR-1, h-offsetTL-offsetBR-1);
    }

    contactPhoto.resizer.ctx.restore();
  },

  addBlurredBorder: function() {
    contactPhoto.resizer.ctx.save();

    var blurWidth = contactPhoto.prefs.get('effectBlurWidth', 'int');
    var borderColor = contactPhoto.utils.getColor('effectBorderColor');

    var w = contactPhoto.resizer.canvas.width;
    var h = contactPhoto.resizer.canvas.height;

    var imgData = contactPhoto.resizer.ctx.getImageData(0, 0, w, h);

    var convolutionMatrix = contactPhoto.imageFX._getGaussMatrix(7, 1.5);
    var gaussSize = Math.floor(convolutionMatrix.length/2);

    var blurArea = [
      {x0: 0,       y0: 0,         x1: w,      y1: blurWidth}, // top strip
      {x0: 0,       y0: blurWidth,     x1: blurWidth,   y1: h-blurWidth}, // left strip
      {x0: w-blurWidth,  y0: blurWidth,     x1: w,      y1: h-blurWidth}, // right strip
      {x0: 0,       y0: h-blurWidth,   x1: w,       y1: h}, // bottom strip
    ];

    for (var z=0; z<blurArea.length; z++) {

      var imgBlur = contactPhoto.resizer.ctx.getImageData(
              blurArea[z].x0,
              blurArea[z].y0,
              blurArea[z].x1-blurArea[z].x0,
              blurArea[z].y1-blurArea[z].y0);

      for (var x=blurArea[z].x0; x<blurArea[z].x1; x++) {
        for (var y=blurArea[z].y0; y<blurArea[z].y1; y++) {

          var r = 0;
          var g = 0;
          var b = 0;
          var a = 0;

          // todo: use separable convolution for better performance
          for (var i=-gaussSize; i<=gaussSize; i++) {
            for (var j=-gaussSize; j<=gaussSize; j++) {
              var blurX = x+i;
              if (blurX < 0) blurX = 0;
              else if (blurX >= imgData.width) blurX = imgData.width-1;

              var blurY = y+j;
              if (blurY < 0) blurY = 0;
              else if (blurY >= imgData.height) blurY = imgData.height-1;

              r += contactPhoto.imageFX._getPixelData(blurX, blurY, 'r', imgData)*convolutionMatrix[i+gaussSize][j+gaussSize];
              g += contactPhoto.imageFX._getPixelData(blurX, blurY, 'g', imgData)*convolutionMatrix[i+gaussSize][j+gaussSize];
              b += contactPhoto.imageFX._getPixelData(blurX, blurY, 'b', imgData)*convolutionMatrix[i+gaussSize][j+gaussSize];
              a += contactPhoto.imageFX._getPixelData(blurX, blurY, 'a', imgData)*convolutionMatrix[i+gaussSize][j+gaussSize];
            }
          }

          r = Math.round(r);
          g = Math.round(g);
          b = Math.round(b);
          a = Math.round(a);

          contactPhoto.imageFX._setPixelData(r, x-blurArea[z].x0, y-blurArea[z].y0, 'r', imgBlur);
          contactPhoto.imageFX._setPixelData(g, x-blurArea[z].x0, y-blurArea[z].y0, 'g', imgBlur);
          contactPhoto.imageFX._setPixelData(b, x-blurArea[z].x0, y-blurArea[z].y0, 'b', imgBlur);
          contactPhoto.imageFX._setPixelData(a, x-blurArea[z].x0, y-blurArea[z].y0, 'a', imgBlur);
        }
      }


      contactPhoto.resizer.ctx.putImageData(imgBlur, blurArea[z].x0, blurArea[z].y0);
      contactPhoto.resizer.ctx.fillStyle = 'rgba('+borderColor[0]+', '+borderColor[1]+', '+borderColor[2]+', 0.3)';
      contactPhoto.resizer.ctx.fillRect(
              blurArea[z].x0,
              blurArea[z].y0,
              blurArea[z].x1-blurArea[z].x0,
              blurArea[z].y1-blurArea[z].y0);

    }

    contactPhoto.resizer.ctx.strokeStyle = 'rgba('+borderColor[0]+', '+borderColor[1]+', '+borderColor[2]+', .5)';
    contactPhoto.resizer.ctx.strokeRect(blurWidth-.5, blurWidth-.5, w-2*blurWidth+1, h-2*blurWidth+1);
    contactPhoto.resizer.ctx.strokeRect(.5, .5, w-1, h-1);

    contactPhoto.resizer.ctx.restore();
  },

  // _getGaussMatrix: calculates a two-dimensional gauss matrix
  _getGaussMatrix: function(size, sigma) {
    var matrix = [];
    var sum = 0;
    var halfsize = Math.floor(size/2);
    for (var i=-halfsize; i<=halfsize; i++) {
      var row = [];
      for (var j=-halfsize; j<=halfsize; j++) {

        var coeff = 1/(2*Math.PI*sigma*sigma) * Math.pow(Math.E, -.5*(i*i+j*j)/(sigma*sigma));
        sum += coeff;

        row.push(coeff);
      }
      matrix.push(row);
    }

    // normalize the matrix
    for (var i=0; i<size; i++) {
      for (var j=0; j<size; j++) {
        matrix[i][j] = (matrix[i][j]/sum);
      }
    }

    return matrix;
  },

  _getPixelData: function(x, y, color, imageData) {
    var offset;
    switch (color) {
      case 'r': offset = 0; break;
      case 'g': offset = 1; break;
      case 'b': offset = 2; break;
      case 'a': offset = 3; break;
    }

    return imageData.data[(y*imageData.width*4 + x*4) + offset];
  },

  _setPixelData: function(data, x, y, color, imageData) {
    var offset;
    switch (color) {
      case 'r': offset = 0; break;
      case 'g': offset = 1; break;
      case 'b': offset = 2; break;
      case 'a': offset = 3; break;
    }

    imageData.data[(y*imageData.width*4 + x*4) + offset] = data;
  }

}

contactPhoto.utils = {
  // getFilename: extracts the file name from a path
  getFilename: function(path) {
    return path.substring(path.lastIndexOf('/')+1);
  },

  // makeURI: returns uri of a nsIFile
  makeURI: function(file) {
    return Components.classes["@mozilla.org/network/io-service;1"]
      .getService(Components.interfaces.nsIIOService)
      .newFileURI(file).spec;
  },

  // getColor: loads a hex color from the preferences and converts it to an int array
  getColor: function(colorPref) {
    var color = contactPhoto.prefs.get(colorPref, 'char');
    var rgb = [255, 255, 255]; // defaults to white
    var re = new RegExp(/^#[0-9a-f]{6}$/i);
    if (re.test(color)) {
      rgb[0] = parseInt(color.substr(1, 2), 16);
      rgb[1] = parseInt(color.substr(3, 2), 16);
      rgb[2] = parseInt(color.substr(5, 2), 16);
    }
    return rgb;
  },

  // isSentMessage: determines if the message is inside the outbox, the sent or the drafts folder
  isSentMessage: function() {
    if (contactPhoto.prefs.get('specialFoldersUseToHeaders', 'bool')) {
      const folderFlags = Components.interfaces.nsMsgFolderFlags;
      var currentFolder = gMessageDisplay.displayedMessage.folder;
      while (currentFolder) {
        /*
        if (contactPhoto.prefs.get('folderDebug', 'bool')) {
          var msg = 'Folder name: '+currentFolder.prettiestName;
          msg += '\n------------------------------';
          msg += '\nFlag Outbox: '+(currentFolder.flags & folderFlags.Queue);
          msg += '\nFlag Drafts: '+(currentFolder.flags & folderFlags.Drafts);
          msg += '\nFlag Sent: '+(currentFolder.flags & folderFlags.SentMail);
          contactPhoto.dump(msg);
        }
        */
        if (currentFolder.flags & (folderFlags.SentMail | folderFlags.Queue | folderFlags.Drafts)) 
          return true;

        currentFolder = currentFolder.parent;
      }
    }
    return false;
  },

  // customAlert: displays a nicer alert window than window.alert()
  customAlert: function(text) {
    var alertTitle = contactPhoto.localizedJS.getString('addonName');
    var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                .getService(Components.interfaces.nsIPromptService);

    prompts.alert(null, alertTitle, text);
  },

  // sanitizeCards: sanitize photo information introduced by bug 702137
  // replace 'null' string with an empty string ''
  sanitizeCards: function() {
    let abManager = Components.classes["@mozilla.org/abmanager;1"]
                              .getService(Components.interfaces.nsIAbManager);

    let allAddressBooks = abManager.directories;

    while (allAddressBooks.hasMoreElements()) {
      let addressBook = allAddressBooks.getNext()
                .QueryInterface(Components.interfaces.nsIAbDirectory);
      if (addressBook instanceof Components.interfaces.nsIAbDirectory && !addressBook.isRemote) {
        let childCards = addressBook.childCards;
        while (childCards.hasMoreElements()) {
          var aCard = childCards.getNext();

          if (aCard instanceof Components.interfaces.nsIAbCard) {
            var modified = false;

            var checkPhotoName = aCard.getProperty('PhotoName', '');
            if (checkPhotoName == 'null' || checkPhotoName == null) {
              modified = true;
              aCard.setProperty('PhotoName', '');
            }

            var checkPhotoURI = aCard.getProperty('PhotoURI', '');
            if (checkPhotoURI == 'null' || checkPhotoURI == null) {
              modified = true;
              aCard.setProperty('PhotoURI', '');
            }

            if (modified) {
              addressBook.modifyCard(aCard);
            }
          }
        }
      }
    }
  },

  preferencesWindow: null,
  openPreferencesWindow: function() {
    if (contactPhoto.utils.preferencesWindow == null || contactPhoto.utils.preferencesWindow.closed) {
      //contactPhoto.utils.preferencesWindow = window.openDialog('chrome://contactPhoto/content/prefs.xul', 'contactPhotoPrefs', 'chrome,titlebar,toolbar,centerscreen,modal');
      contactPhoto.utils.preferencesWindow = window.openDialog('chrome://contactPhoto/content/prefs.xul', 'contactPhotoPrefs', 'resizable=yes,centerscreen');
    }
    else {
      contactPhoto.utils.preferencesWindow.focus();
    }
  },

  // trim: trim a string
  trim: function(str) {
    str.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
  },

  // newPhotoInfo:
  newPhotoInfo: function(address) {
    return {
      emailAddress: address,
      size: 60,
      photoObject: null, // dom object of the photo
      noVisualEffects: false, // used for thumbnails in the compose window
      cardDetails: null,
      hasPhoto: false, // there is a photo in the address book
      photoName: null,
      hasGenericPhoto: false,
      genericPhotoURI: null,
      hasFace: false,
      faceURI: null,
      hasLocalPhoto: false,
      localPhotoURI: null,
      hasDomainWildcard: false,
      domainWildcardURI: null
    }
  },

  // md5_hex: calculate the md5 checksum of a string
  md5_hex: function(str) {
    var converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
          .createInstance(Components.interfaces.nsIScriptableUnicodeConverter);

    // we use UTF-8 here, you can choose other encodings.
    converter.charset = 'UTF-8';

    // data is an array of bytes
    var data = converter.convertToByteArray(str, {});
    var cryptohash = Components.classes["@mozilla.org/security/hash;1"]
              .createInstance(Components.interfaces.nsICryptoHash);
    cryptohash.init(cryptohash.MD5);

    cryptohash.update(data, data.length);

    // pass false here to get binary data back
    var hash = cryptohash.finish(false);

    // return the two-digit hexadecimal code for a byte
    function toHexString(charCode) {
      return ("0" + charCode.toString(16)).slice(-2);
    }

    // convert the binary hash data to a hex string.
    return Array.from(hash, function (c) { return toHexString(c.charCodeAt(0)); }).join("");
  },

  // mydump: a debug function to quickly inspect objects
  mydump: function(what, useAlert) {
    if (typeof what == 'undefined') {
      alert('undefined');
      return;
    }

    var a = '';
    var i = 0;
    var j = 0;
    for (var x in what) {
      i++;

      a = a+x+'  --  '+what[x]+'\n\n';

      if (i == 5) {
        if (useAlert)
          alert(a);
        else
          contactPhoto.dump(a)
        a = '';
        i = 0;
        j++;
      }
    }

    if (j == 0) {
      if (useAlert)
        alert(a);
      else
        contactPhoto.dump(a)
    }
  }

};
