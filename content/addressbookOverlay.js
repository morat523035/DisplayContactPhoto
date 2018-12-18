if (!contactPhoto) var contactPhoto = {};

contactPhoto.addressbook = {

  DCPDisplayHandler: function(aCard, aImg) {
    aImg.style.listStyleImage = ''; // clear the existing image

    var photoInfo = contactPhoto.photoForCard(aCard);

    photoInfo.size = contactPhoto.prefs.get('addressbook.size', 'int');
    photoInfo.photoObject = aImg;

    contactPhoto.display.logic(photoInfo);
    return true;
  },

  initCardDisplay: function() {
    var container = document.getElementById('cvbPhoto');
    container.setAttribute('context', 'DCP-Contextmenu'); // set the contextmenu

    var cvPhoto = document.getElementById('cvPhoto');
    
    // Check if the default photo uri has been stored in the preferences.
    var uri = window.getComputedStyle(cvPhoto, null).listStyleImage;
    uri = uri.replace(/.*\s?url\([\'\"]?/, '').replace(/[\'\"]?\).*/, '');
    contactPhoto.dump(uri);
    var storedUri = contactPhoto.prefs.get('defaultGenericPhotoURI', 'char');
    if (uri && uri != storedUri) {
      contactPhoto.prefs.set('defaultGenericPhotoURI', storedUri, 'char');
      contactPhoto.cache.clear();
    }

    // Display a larger photo in the address book.
    // Override unit of width (ch -> px).
    var width = contactPhoto.prefs.get('addressbook.size', 'int') + 'px';
    cvPhoto.style.maxWidth = width;
    cvPhoto.style.maxHeight = width;

    // open the edit card window when clicking on the photo
    cvPhoto.addEventListener('click', function(e) {
      if (e.button != 0) return; // do nothing if not left click
      // open the card dialog with the photo tab focused
      window.contactPhoto.editCardFocusPhotoTab = true; // tell the dialog to focus the photo tab
      goDoCommand('cmd_properties');
    }, false);
  },
}

window.addEventListener('load', contactPhoto.addressbook.initCardDisplay, false);

// override the default display handlers, can't use registerPhotoDisplayHandler()
// the add-on contains the logic deciding which photo to display
gPhotoDisplayHandlers['generic'] = contactPhoto.addressbook.DCPDisplayHandler;
gPhotoDisplayHandlers['file'] = contactPhoto.addressbook.DCPDisplayHandler;
gPhotoDisplayHandlers['web'] = contactPhoto.addressbook.DCPDisplayHandler;