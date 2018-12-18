if (!contactPhoto) var contactPhoto = {};

contactPhoto.editCard = {
  displayGenericPhotos: function() {
    // display more generic photos. copy them from the hidden list to the #GenericPhotoList

    /** replace elements inside <vbox id="GenericPhotoContainer">:
     * <vbox id="GenericPhotoContainer">
     *  <radio id="GenericPhotoType"/>
     *  <menulist id="GenericPhotoList"/>
         * </vbox>
     *
     * -- with --
     *
     * <vbox id="GenericPhotoContainer">
     *  <hbox id="DCP-GenericPhotoHbox">
     *    <radio id="GenericPhotoType" flex="1"/>
     *    <button id="DCP-ButtonSetDefaultPhoto"/>
     *  </hbox>
     *  <menulist id="GenericPhotoList"/>
     *  <label id="DCP-LabelIsDefaultPhoto" hidden="true"/>
         * </vbox>
     */
    var hbox = document.getElementById('DCP-GenericPhotoHbox');

    var genericPhotoType = document.getElementById('GenericPhotoType');
    var genericPhotoList = document.getElementById('GenericPhotoList');

    hbox.insertBefore(genericPhotoType, hbox.firstChild);

    genericPhotoType.flex = 1;

    var menupopup = genericPhotoList.firstChild;

    // update existing entries to iconic style
    for (var i=0; i<menupopup.childNodes.length; i++) {
      menupopup.childNodes[i].className += ' menuitem-iconic';
    }

    var templateList = document.getElementById('DCP-GenericPhotoListTemplate');
    var templateMenupopup = templateList.firstChild;

    for (var i=0; i<templateMenupopup.childNodes.length; i++) {
      var clone = templateMenupopup.childNodes[i].cloneNode(true);
      menupopup.appendChild(clone);
    }

  },

  setDefaultPhoto: function() {
    // select generic radio button
    document.getElementById("PhotoType").value = 'generic';

    var genericPhotoList = document.getElementById('GenericPhotoList');
    genericPhotoList.value = contactPhoto.prefs.get('defaultGenericPhoto', 'char');
  },

  newGenericPhotoHandler: {
    onLoad: function(aCard, aDocument) {
      var genericPhotoList = document.getElementById('GenericPhotoList');

      var photoURI = aCard.getProperty('PhotoURI', '');
      genericPhotoList.value = photoURI;

      return true;
    },

    onShow: function(aCard, aDocument, aTargetID) {
      var genericPhotoList = document.getElementById('GenericPhotoList');
      
      // In case that the Mozilla default has been selected remove the src 
      // attribute to allow themes to customize the default photo.
      if (genericPhotoList.value == 'default')
        aDocument.getElementById(aTargetID).removeAttribute('src');
      else
        aDocument.getElementById(aTargetID).setAttribute('src', genericPhotoList.value);

      return true;
    },

    onSave: function(aCard, aDocument) {
      // If we had the photo saved locally, clear it.
      removePhoto(aCard.getProperty('PhotoName', ''));
      aCard.setProperty('PhotoName', '');
      aCard.setProperty('PhotoType', 'generic');

      var genericPhotoList = document.getElementById('GenericPhotoList');
      var newURI = genericPhotoList.value;
      if (genericPhotoList.value == contactPhoto.prefs.get('defaultGenericPhoto', 'char')) {
        // if the default photo has been selected, assign an empty URI to fall back to the current default URI automatically
        newURI = '';
      }
      aCard.setProperty('PhotoURI', newURI);
      
      return true;
    }
  },

  // check if gravatar is enabled, else disable menuitem and assign default URI if gravatar has been selected
  // select the correct default photo from DCP prefs
  initEditCard: function() {
    var photo = document.getElementById('photo');
    
    // Check if the default photo uri has been stored in the preferences.
    var uri = window.getComputedStyle(photo, null).listStyleImage;
    uri = uri.replace(/.*\s?url\([\'\"]?/, '').replace(/[\'\"]?\).*/, '');
    contactPhoto.dump(uri);
    var storedUri = contactPhoto.prefs.get('defaultGenericPhotoURI', 'char');
    if (uri && uri != storedUri) {
      contactPhoto.prefs.set('defaultGenericPhotoURI', storedUri, 'char');
    }
  
  
    var genericPhotoList = document.getElementById('GenericPhotoList');
    var DCPDefaultPhoto = contactPhoto.prefs.get('defaultGenericPhoto', 'char');

    // disable gravatar if it is not enabled and deselect the menuitem if necessary
    if (contactPhoto.prefs.get('enableGravatar', 'bool') == false) {
      var menuitemGravatar = document.getElementById('DCP-GenericPhotoGravatar');

      if (menuitemGravatar.selected) {
        genericPhotoList.value = DCPDefaultPhoto;
      }

      menuitemGravatar.disabled = true;
    }

    // add the default photo label to the right menuitem
    // select the default photo if necessary
    var menupopup = genericPhotoList.firstChild;
    for (var i=0; i<menupopup.childNodes.length; i++) {
      if (menupopup.childNodes[i].value == DCPDefaultPhoto) {
        menupopup.childNodes[i].label = menupopup.childNodes[i].label +' '+ document.getElementById('DCP-LabelIsDefaultPhoto').value;

        if (!genericPhotoList.value) {
          genericPhotoList.value = DCPDefaultPhoto;
        }
        break;
      }
    }

    // set editCardFocusPhotoTab = true in the opener window to automatically focus the photo tab
    if (window.opener.contactPhoto.editCardFocusPhotoTab) {
      window.opener.contactPhoto.editCardFocusPhotoTab = null; // reset the variable

      var abTabs = document.getElementById('abTabs');
      var photoTabButton = document.getElementById('photoTabButton');
      abTabs.selectedItem = photoTabButton;
    }

  },
}

RegisterLoadListener(contactPhoto.editCard.displayGenericPhotos);

registerPhotoHandler('generic', contactPhoto.editCard.newGenericPhotoHandler);

window.addEventListener('load', contactPhoto.editCard.initEditCard, false);