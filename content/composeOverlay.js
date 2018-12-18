if (!contactPhoto) var contactPhoto = {};

contactPhoto.compose = {
  photoStack: {
    padding: 2
  },

  stackDrawNumber: 0,
  widget: null,
  widgetParent: null,
  photoStackInitDone: false,
  prefBranch: null,


  /**
   * Wrap TB core functions to catch DOM mutation events
   */
  function_wrappers: {},

  wrap_functions: function() {
    // awDeleteRow(rowToDelete)
    // deletes a row of the addressing widget
    contactPhoto.compose.function_wrappers.awDeleteRow_old = window.awDeleteRow;
    window.awDeleteRow = function () {
      var res = contactPhoto.compose.function_wrappers.awDeleteRow_old.apply(this, arguments);

      //contactPhoto.compose.displayStackView();

      return res;
    };

    // awSetInputAndPopupValue(inputElem, inputValue, popupElem, popupValue, rowNumber)
    // sets the value of the textbox and popup
    contactPhoto.compose.function_wrappers.awSetInputAndPopupValue_old = window.awSetInputAndPopupValue;
    window.awSetInputAndPopupValue = function() {
      var textbox = arguments[0];

      if (!textbox.DCPInitDone) {
        contactPhoto.compose.initTextbox(textbox);
      }

      var res = contactPhoto.compose.function_wrappers.awSetInputAndPopupValue_old.apply(this, arguments);

      textbox.previousValue = textbox.currentValue;
      textbox.currentValue = textbox.value;

      contactPhoto.compose.checkAllTextboxes();

      return res;
    };

    // _awSetInputAndPopup(inputValue, popupValue, parentNode, templateNode)
    // inserts a new row
    contactPhoto.compose.function_wrappers._awSetInputAndPopup_old = window._awSetInputAndPopup;
    window._awSetInputAndPopup = function() {
      var res = contactPhoto.compose.function_wrappers._awSetInputAndPopup_old.apply(this, arguments);

      var newTextbox = awGetInputElement(top.MAX_RECIPIENTS);
      if (!newTextbox.DCPInitDone) {
        contactPhoto.compose.initTextbox(newTextbox);
      }

      return res;
    };

    // awAppendNewRow(setFocus)
    // inserts a new row
    contactPhoto.compose.function_wrappers.awAppendNewRow_old = window.awAppendNewRow;
    window.awAppendNewRow  = function() {
      var res = contactPhoto.compose.function_wrappers.awAppendNewRow_old.apply(this, arguments);

      var newTextbox = awGetInputElement(top.MAX_RECIPIENTS);
      if (!newTextbox.DCPInitDone) {
        contactPhoto.compose.initTextbox(newTextbox);
      }

      return res;
    };
  },


  /**
   * Listen to preference changes and update photo stack accordingly
   */
  observe: function(subject, topic, data) {
    if (topic != "nsPref:changed") {
      return;
    }

    switch (data) {
      case 'type': // Photo stack type changed (3d/grid)
        contactPhoto.compose.displayStackView();
        break;

      case 'position': // Position changed (left/right)
        var hbox = document.getElementById('DCP-AddressingContainer');
        var canvasBox = document.getElementById('DCP-PhotoStackContainer');
        var splitter = document.getElementById('DCP-VerticalSizer');
        var widget = document.getElementById('addressingWidget');

        if (contactPhoto.prefs.get('composePhotos.position', 'char') == 'left') {
          hbox.insertBefore(canvasBox, widget);
          hbox.insertBefore(splitter, widget);
          splitter.setAttribute('collapse', 'before');
        }
        else {
          hbox.appendChild(splitter);
          hbox.appendChild(canvasBox);
          splitter.setAttribute('collapse', 'after');
        }
        break;

      case 'display':
        var canvasBox = document.getElementById('DCP-PhotoStackContainer');
        var splitter = document.getElementById('DCP-VerticalSizer');

        if (contactPhoto.prefs.get('composePhotos.display', 'bool')) {
          canvasBox.collapsed = false;
          splitter.collapsed = false;
          canvasBox.width = contactPhoto.prefs.get('composePhotos.width', 'int');
          contactPhoto.compose.displayStackView();
        }
        else {
          canvasBox.collapsed = true;
          splitter.collapsed = true;
        }
        break;
    }
  },


  initPhotoStack: function() {
    if (contactPhoto.compose.photoStackInitDone) return;
    contactPhoto.compose.photoStackInitDone = true;

    var widget = document.getElementById('addressingWidget');
    contactPhoto.compose.widget = widget; /* addressingWidget is a <listbox> */

    // init the template textbox
    contactPhoto.compose.initTemplateTextbox(awGetInputElement(1));


    /** replace <addressingWidget/> with
     *
     * <hbox id='DCP-AddressingContainer'>
     *   <box id="DCP-PhotoStackContainer'>
     *     <canvas id='DCP-PhotoStack'/>
     *   </box>
     *   <splitter id="DCP-VerticalSizer"/>
     *   <addressingWidget/>
     * </hbox>
     */

    var addrBox = widget.parentNode;

    var hbox = document.createElementNS(contactPhoto.ns.XUL, 'hbox');
    hbox.flex = '1';
    hbox.id = 'DCP-AddressingContainer';
    addrBox.replaceChild(hbox, widget);

    // create a box around the canvas to center the canvas
    var box = document.createElementNS(contactPhoto.ns.XUL, 'box');
    box.align = 'center';
    box.id = 'DCP-PhotoStackContainer';
    box.style.overflow = 'hidden';
    box.collapsed = (contactPhoto.prefs.get('composePhotos.display', 'bool') == false);
    box.setAttribute('context', 'DCP-Contextmenu'); // attach contextmenu


    var canvasSize = contactPhoto.prefs.get('composePhotos.width', 'int');
    var canvas = document.createElementNS(contactPhoto.ns.XHTML, 'canvas');
    canvas.id = 'DCP-PhotoStack';
    canvas.width = canvasSize;
    canvas.height = 1; // Later adjusted by displayStackView()


    var splitter = document.createElementNS(contactPhoto.ns.XUL, 'splitter');
    splitter.id = 'DCP-VerticalSizer';

    splitter.addEventListener('command', function() {
      // Save new position of splitter
      if (box.collapsed) {
        contactPhoto.prefs.set('composePhotos.display', false, 'bool');
        splitter.collapsed = true;
      }
      else {
        contactPhoto.prefs.set('composePhotos.width', box.width, 'int');
        contactPhoto.prefs.set('composePhotos.display', true, 'bool');
        contactPhoto.compose.displayStackView();
      }
    }, false);

    box.appendChild(canvas);

    if (contactPhoto.prefs.get('composePhotos.position', 'char') == 'left') {
      hbox.appendChild(box);
      hbox.appendChild(splitter);
      hbox.appendChild(widget);
      splitter.setAttribute('collapse', 'before');
    }
    else {
      hbox.appendChild(widget);
      hbox.appendChild(splitter);
      hbox.appendChild(box);
      splitter.setAttribute('collapse', 'after');
    }

    contactPhoto.compose.widgetParent = hbox;

    // draw the empty canvas
    window.setTimeout(contactPhoto.compose.displayStackView, 20);
  },


  setupEventListeners: function() {
    // change stack height after the size addressing widget has been changed
    document.getElementById('compose-toolbar-sizer').addEventListener('mouseup', contactPhoto.compose.displayStackView, false);

    var composeWindow = document.getElementById("msgcomposeWindow");
    composeWindow.addEventListener('compose-window-close', contactPhoto.compose.listenerComposeWindowClosed, false);

    // Listen to pref changes (var preBranch has to be non local, otherwise it gets garbage collected)
    contactPhoto.compose.prefBranch = Components.classes["@mozilla.org/preferences-service;1"]
          .getService(Components.interfaces.nsIPrefService)
          .getBranch("extensions.contactPhoto.composePhotos.")
          .QueryInterface(Components.interfaces.nsIPrefBranch);
    contactPhoto.compose.prefBranch.addObserver("", this, false);



    // Add an address book listener so the photo can be updated.
    Components.classes["@mozilla.org/abmanager;1"]
      .getService(Components.interfaces.nsIAbManager)
      .addAddressBookListener(contactPhoto.compose.addressBookListener,
        Components.interfaces.nsIAbListener.all);

  },


  listenerComposeWindowClosed: function() {
    contactPhoto.dump('WINDOW CLOSED')

    // clear the stack area
    var stackCanvas = document.getElementById('DCP-PhotoStack');
    stackCanvas.width = stackCanvas.width;


    // remove cached images
    contactPhoto.compose.removeCachedImages();

    // reset images in addressingWidget
    var widget = document.getElementById('addressingWidget');
    var boxes = widget.getElementsByTagName('textbox');

    for (var i=0; i<boxes.length; i++) {
      boxes[i].value = '';
      boxes[i].currnetValue = '';
      boxes[i].previousValue = '';
      var icon = boxes[i].previousSibling.firstChild;
      if (icon.tagName == 'image') {
        contactPhoto.compose.resetPhoto(icon);
      }
    }
  },

  removeCachedImages: function() {
    var hbox = document.getElementById('DCP-AddressingContainer');
    var imageNodes = [];
    for (var i in hbox.childNodes) {
      if (hbox.childNodes[i].tagName && hbox.childNodes[i].tagName.toLowerCase() == 'image') {
        imageNodes.push(hbox.childNodes[i]);
      }
    }
    for (i in imageNodes) {
      hbox.removeChild(imageNodes[i]);
    }
  },

  resetPhoto: function(imgObj) {
    imgObj.style.width = '16px';
    imgObj.style.height = '16px';
    imgObj.style.listStyleImage = contactPhoto.compose.defaultIconURI;
  },

  defaultIconURI: 'url("chrome://messenger/skin/addressbook/icons/abcard.png")',
  textboxCounter: 0, // counter for continuous identification of textboxes



  // iterate through all textboxes in the addressingwidget.
  // check whether the contents have changed and load the photo.
  checkAllTextboxes: function() {
    const Cc = Components.classes;
    const Ci = Components.interfaces;

    var forceRedraw = false; // force redraw of stack
    var photoChanged = false; // true whenever a photo will be changed

    var currentDrawNumber = contactPhoto.compose.stackDrawNumber;

    var bxs = contactPhoto.compose.widgetParent.getElementsByTagName('textbox');

    for (var i=0; i<bxs.length; i++) {

      var setDefaultIcon = true;
      // Each textbox is assigned the following properties:
      // .currentValue
      // .previousValue
      // .email
      // .imgLoaded
      // .timeoutOccurred
      // .hasCard

      var curBoxValue = bxs[i].currentValue;

      var icon = bxs[i].previousSibling.firstChild;
      var editLink = bxs[i].nextSibling;

      // only parse data if it has changed and there is an @-sign
      if (curBoxValue != bxs[i].previousValue) {

        if (curBoxValue.indexOf('@') > -1) {
          bxs[i].previousValue = curBoxValue;

          // extract e-mail address
          var hdrAddresses = {};
          var msgHeaderParser = Cc["@mozilla.org/messenger/headerparser;1"]
                                  .getService(Ci.nsIMsgHeaderParser);
          var numAddresses = msgHeaderParser.parseHeadersWithArray(curBoxValue, hdrAddresses, {}, {});
          var emailAddress = hdrAddresses.value[0];

          // one address found and it has been changed --> update icon and photo stack
          if (numAddresses == 1 && bxs[i].email != emailAddress) {
            setDefaultIcon = false;
            photoChanged = true;
            bxs[i].email = emailAddress.toLowerCase();
            bxs[i].imgLoaded = false;
            let _ii_ = i; // used in event-listener-closures

            var photoInfo = contactPhoto.photoForEmailAddress(emailAddress);

            // Show the edit contact link if a card has been found.
            bxs[i].hasCard = (photoInfo.cardDetails && photoInfo.cardDetails.card);

            var photoInfoStack = {};
            for (var x in photoInfo) { // copy the photoInfo object
              photoInfoStack[x] = photoInfo[x];
            }

            photoInfo.size = contactPhoto.prefs.get('smallIconSize', 'int');
            photoInfo.noVisualEffects = true;
            photoInfo.photoObject = icon;
            contactPhoto.display.logic(photoInfo, false);

            if (contactPhoto.prefs.get('composePhotos.display', 'bool')) {
              photoInfoStack.size = contactPhoto.prefs.get('composePhotos.size', 'int');

              photoInfoStack.photoObject = document.createElementNS(contactPhoto.ns.XUL, 'image');
              photoInfoStack.photoObject.setAttribute('collapsed', 'true'); // don't show the image in the ui
              photoInfoStack.photoObject.style.display = 'block';
              document.getElementById('addressingWidget').parentNode.appendChild(photoInfoStack.photoObject);

              bxs[_ii_].imgObject = photoInfoStack.photoObject;

              photoInfoStack.photoObject.addEventListener('load', function() {
                bxs[_ii_].imgLoaded = true;

                // clear abort timeout
                window.clearTimeout(bxs[_ii_].loadTimeout);
                bxs[_ii_].timeoutOccurred = false;

                // cancel if stack has already been redrawn in the meantime
                if (currentDrawNumber != contactPhoto.compose.stackDrawNumber) {
                  return;
                }

                if (contactPhoto.compose.checkAllImagesLoaded()) {
                  contactPhoto.compose.displayStackView();
                }
              }, false);

              // add a timeout in case a photo can't be loaded (error-event does not work)
              bxs[_ii_].loadTimeout = window.setTimeout(function() {
                bxs[_ii_].timeoutOccurred = true;

                // trigger image check again, as this might be the last image
                if (contactPhoto.compose.checkAllImagesLoaded()) {
                  contactPhoto.compose.displayStackView();
                }
              }, 3000); // wait 3 sec for gravatar image to load

              contactPhoto.display.logic(photoInfoStack, false);
            }

          }
        }
        else { // no mail address found, don't display a photo in the stack
          bxs[i].email = '';
          bxs[i].imgLoaded = false;
          bxs[i].hasCard = false;
        }
      }
      else { // value of this textbox did not change
        setDefaultIcon = false;
      }

      // Show the edit link only if there is a card to modify.
      editLink.hidden = !bxs[i].hasCard;

      if (setDefaultIcon) {
        bxs[i].email = '';
        bxs[i].imgLoaded = false;
        contactPhoto.compose.resetPhoto(icon);
        forceRedraw = true
      }

    }

    if (forceRedraw && !photoChanged) {
      contactPhoto.dump("Forced redraw");
      contactPhoto.compose.displayStackView(); // redraw the photo stack
    }
  },

  checkAllImagesLoaded: function() {
    var boxes = contactPhoto.compose.widgetParent.getElementsByTagName('textbox');
    for (var id=0; id<boxes.length; id++) {
      // skip not valid email addresses
      if (boxes[id].email == '') {
        continue;
      }
      // skip not loaded images (they may trigger a redraw whenever they are loaded)
      if (boxes[id].timeoutOccurred == true) {
        continue;
      }

      // exit if the current image is not yet loaded
      if (boxes[id].imgLoaded == false) return false;
    }
    // all images have been checked and no error has been found -> OK
    return true;
  },


  // this function is called if DCPInitDone has not been set on a textbox
  // it sets custom properties and attaches several event listeners
  initTextbox: function(textbox) {
    textbox.DCPInitDone = true;

    contactPhoto.compose.resetPhoto(textbox.previousSibling.firstChild);

    var boxID = 'box'+(contactPhoto.compose.textboxCounter++);
    textbox.setAttribute('DCP-TextboxID', boxID);

    textbox.currentValue = '';
    textbox.previousValue = '';
    textbox.email = '';
    textbox.imgObject = null;
    textbox.imgLoaded = false;
    textbox.timeoutOccurred = false;
    textbox.hasCard = false;

    // Hide the edit link which might be visible on the template row.
    textbox.nextSibling.hidden = true;

    // listen for user-based changes which fire after the textbox loses focus
    textbox.addEventListener('change', function(e) {
      textbox.previousValue = textbox.currentValue;
      textbox.currentValue = e.target.value;

      contactPhoto.compose.checkAllTextboxes();
    }, false);

    // listen for input changes, but only do something when the box is cleared (for performance reasons)
    textbox.addEventListener('input', function(e) {
      if (textbox.value != '') return;

      textbox.previousValue = textbox.currentValue;
      textbox.currentValue = e.target.value;

      contactPhoto.compose.checkAllTextboxes();
    }, false);

    // catch the case when the user drops something into the textbox
    // this case is not handled by the addressing widget
    textbox.addEventListener('drop', function(e) {
      window.setTimeout(function() {
        textbox.previousValue = textbox.currentValue;
        textbox.currentValue = textbox.value;

        contactPhoto.compose.checkAllTextboxes();
      }, 20);
    }, false);

    /*
    // add a 'change' event to the ontextentered attribute (textentered event is not fired)
    var eventCode = 'e = document.createEvent("UIEvents");';
    eventCode = eventCode + 'e.initUIEvent("change", true, true, window, 1);';
    eventCode = eventCode + 'this.dispatchEvent(e);';
    textbox.setAttribute('ontextentered', textbox.getAttribute('ontextentered')+';'+eventCode);
    */
  },

  /**
   * Modify the template listitem which is copied to insert more listitems.
   */
  initTemplateTextbox: function(textbox) {
    contactPhoto.dump('INIT TEMPLATE textbox')

    // Create a box to center the icon inside.
    var newBox = document.createElementNS(contactPhoto.ns.XUL, 'box');
    newBox.setAttribute('align', 'center');
    newBox.setAttribute('pack', 'center');
    var boxSize = contactPhoto.prefs.get('smallIconSize', 'int');
    newBox.setAttribute('width', boxSize);
    newBox.setAttribute('height', boxSize);
    newBox.style.height = boxSize+'px';
    newBox.style.width = boxSize+'px';
    // Use the onclick attribute to enable easy cloning of the node.
    newBox.setAttribute('onclick', 'contactPhoto.compose.widgetEditContactHandler(this)');

    var newImage = document.createElementNS(contactPhoto.ns.XUL, 'image');
    newImage.style.listStyleImage = contactPhoto.compose.defaultIconURI;
    newBox.appendChild(newImage);

    textbox.parentNode.insertBefore(newBox, textbox);

    var label = document.createElementNS(contactPhoto.ns.XUL, 'label');
    label.setAttribute('class', 'text-link');
    label.setAttribute('value', contactPhoto.localizedJS.getString('editContactLabel'));
    label.setAttribute('hidden', 'true');
    label.setAttribute('onclick', 'contactPhoto.compose.widgetEditContactHandler(this)');
    textbox.parentNode.insertBefore(label, textbox.nextSibling);
  },

  displayStackView: function() {
    // Adjust width and height of photo stack
    var stackCanvas = document.getElementById('DCP-PhotoStack');
    var boxWidth = document.getElementById('DCP-PhotoStackContainer').boxObject.width;
    var listboxHeight = document.getElementById('addressingWidget').boxObject.height;
    stackCanvas.width = boxWidth;
    stackCanvas.height = listboxHeight;

    // Render canvas
    var type = contactPhoto.prefs.get('composePhotos.type', 'char');
    switch(type) {
      case 'grid':
        contactPhoto.compose.displayGridView();
        break;
      case '3d':
      default:
        contactPhoto.compose.display3DStackView();
        break;
    }
  },

  display3DStackView: function() {
    contactPhoto.dump("DRAW STACK")

    var currentDrawNumber = ++contactPhoto.compose.stackDrawNumber;

    var bxs = contactPhoto.compose.widgetParent.getElementsByTagName('textbox');


    var maxAddresses = 10; // max displayed addresses
    var addresses = [];

    // check if an image has been assigned and reverse the order
    var boxes = contactPhoto.compose.widgetParent.getElementsByTagName('textbox');

    for (var id=0; id<boxes.length; id++) {
      if (typeof boxes[id].email == 'undefined') continue;

      if (boxes[id].email == '') {
        continue;
      }
      if (boxes[id].imgObject == null) {
        continue;
      }
      if (boxes[id].imgLoaded == false) {
        continue;
      }

      addresses.unshift(boxes[id].email);

      if (addresses.length >= maxAddresses) break;
    }


    var stackCanvas = document.getElementById('DCP-PhotoStack');
    stackCanvas.width = stackCanvas.width; // clear the canvas

    // exit if there is nothing to draw
    if (addresses.length == 0) {
      contactPhoto.compose.displayEmptyCanvas();
      return;
    }

    var stackCtx = stackCanvas.getContext('2d');

    var size = contactPhoto.prefs.get('composePhotos.size', 'int'); // max size of the foremost image
    var sizeDistance = 0.6; // percentage of the size of the rearmost image compared to the foremost

    var ratio = stackCanvas.width/stackCanvas.height;
    var vanPt1 = { // vanishing point on the bottom side
      x: .95 * stackCanvas.width,
      y: 20 * stackCanvas.height
    }
    var vanPt2 = { // vanishing point on the right side, adjust by the size-ratio to achieve better perspective
      x: 3 * stackCanvas.width / Math.min(1, ratio),
      y: .05 * stackCanvas.height * Math.min(1, ratio)
    }

    /**
    * estimate dimensions of a transformed image at bottom right side (foremost image)
    * determine vanishing points using an untransformed image then calculate the bounding box
    **/

    var vp1 = { // vanishing point on the bottom side
      x: vanPt1.x - (stackCanvas.width - size),//- contactPhoto.compose.photoStack.padding),
      y: vanPt1.y - (stackCanvas.height - size)//- contactPhoto.compose.photoStack.padding)
    }
    var vp2 = { // vanishing point on the right side
      x: vanPt2.x - (stackCanvas.width - size),//- contactPhoto.compose.photoStack.padding),
      y: vanPt2.y - (stackCanvas.height- size)//- contactPhoto.compose.photoStack.padding)
    }
    var dummyCanvas = document.createElementNS(contactPhoto.ns.XHTML, 'canvas');
    dummyCanvas.width = size;
    dummyCanvas.height = size;
    var perspectiveWarp = new contactPhoto.classes.canvasPerspectiveWarp(dummyCanvas);
    perspectiveWarp.interpolationMethod = 'bl'; // bilinear
    perspectiveWarp.referencePoint = 'bl'; // bottom left
    var boundingBox = perspectiveWarp.vanishingPointsBoundingBox(vp1.x, vp1.y, vp2.x, vp2.y);

    // draw photos along a linear slope from x0/y0 to x1/y1
    var x0 = contactPhoto.compose.photoStack.padding;
    var y0 = size*sizeDistance + contactPhoto.compose.photoStack.padding;
    //var x1 = stackCanvas.width - contactPhoto.display.photoCache[addresses[addresses.length-1]+'-'+size].width - contactPhoto.compose.photoStack.padding; // width of foremost image
    var x1 = stackCanvas.width - (boundingBox.width) - contactPhoto.compose.photoStack.padding;
    var y1 = stackCanvas.height - (boundingBox.height-size) - contactPhoto.compose.photoStack.padding;


    var untransformedCanvas = document.createElementNS(contactPhoto.ns.XHTML, 'canvas');
    untransformedCanvas.width = stackCanvas.width;
    untransformedCanvas.height = stackCanvas.height;
    var untransformedCtx = untransformedCanvas.getContext('2d');

    /**
    * for each image, a percentage is calculated where to draw it along the slope.
    * two approaches are used u and v, they are linearly mixed depending on the count
    * of images; at addr.len>=m, only v is used.
    * strategy for calculating u and v:
    *  img    %u    %v
    *  1    .33    0
    *  2    .37    1
    *
    *  1    .2    0
    *  2    .4    .33
    *  3    .6    .67
    *  4    .8    1
    *
    * a maximum of maxAddresses are displayed (already filtered above)
    * u / v is used for positioning, while u2 / v2 is used for scaling the images
    **/
    var m = 6;
    var k = Math.min(addresses.length-1, m);
    var div = k/m;

    for (var i=0; i<addresses.length; i++) {
      // exit if there is a more recent call to displayStackView()
      if (currentDrawNumber != contactPhoto.compose.stackDrawNumber) { return; }


      var w = contactPhoto.display.photoCache[addresses[i]+'-'+size].width;
      var h = contactPhoto.display.photoCache[addresses[i]+'-'+size].height;

      var dx, dy, dw, dh

      // if there is only one image, position it in full size in the center
      if (addresses.length == 1) {
        dw = w;
        dh = h;

        dx = ((stackCanvas.width-w)*.5 - contactPhoto.compose.photoStack.padding);
        dy = ((stackCanvas.height-h)*.5 - contactPhoto.compose.photoStack.padding);
      }
      else {

        /* ellipse stack
        var a = stackCanvas.width - size; // x halbachse
        var b = stackCanvas.height - size*sizeDistance; // y halbachse
        var oX = -0;
        var oY = stackCanvas.height;

        var dx = oX + a * Math.cos((1-t) * (2*Math.PI/4)) -dw
        var dy = oY + b * -Math.sin((1-t) * (2*Math.PI/4)) -dh
        */

        var n = (addresses.length == 1)? 1: addresses.length-1; // make sure n is never equal to zero (division by n), addr.len==0 handled earlier

        var u = (i+1)/(addresses.length+1);
        var u2 = (i+1)/(addresses.length);

        var v = i/n;
        var v2 = v;

        var t = (1-div)*u + (div)*v; // linearly mix the two functions
        var t2 = (1-div)*u2 + (div)*v2;

        var dw = w*(sizeDistance + t2*(1-sizeDistance));
        var dh = h*(sizeDistance + t2*(1-sizeDistance));

        var dx = x0 + t*(x1-x0);
        var dy = y0 + t*(y1-y0) - dh;
      }


      /* create a slight horizontal alpha gradient to let the photo behind shine through */
      var tmpCanvas = document.createElementNS(contactPhoto.ns.XHTML, 'canvas');
      tmpCanvas.width = dw;
      tmpCanvas.height = dh;
      var tmpCtx = tmpCanvas.getContext('2d');
      tmpCtx.drawImage(contactPhoto.display.photoCache[addresses[i]+'-'+size], 0, 0, dw, dh);
      tmpCtx.globalCompositeOperation = 'destination-out';

      var gradient = tmpCtx.createLinearGradient(0, 0, dw, 0);
      gradient.addColorStop(0, "rgba(255, 255, 255, 0.2)");
      gradient.addColorStop(0.5, "rgba(255, 255, 255, 0)");
      tmpCtx.fillStyle = gradient;
      tmpCtx.rect(0, 0, dw, dh);
      tmpCtx.fill();


      // vanishing points are relative to top left of image -> adjust by position of image
      var vp1 = { // vanishing point on the bottom side
        x: vanPt1.x - dx,
        y: vanPt1.y - dy
      }
      var vp2 = { // vanishing point on the right side
        x: vanPt2.x - dx,
        y: vanPt2.y - dy
      }

      if (currentDrawNumber != contactPhoto.compose.stackDrawNumber) { return; }
      var perspectiveWarp = new contactPhoto.classes.canvasPerspectiveWarp(tmpCanvas);
      perspectiveWarp.interpolationMethod = 'bl'; // bilinear
      perspectiveWarp.referencePoint = 'bl'; // bottom left
      var transformation = perspectiveWarp.vanishingPoints(vp1.x, vp1.y, vp2.x, vp2.y);

      if (currentDrawNumber != contactPhoto.compose.stackDrawNumber) { return; }

      stackCtx.drawImage(transformation, dx, dy);
      //stackCtx.drawImage(tmpCanvas, dx, dy);

    } // end addresses loop

    contactPhoto.dump('  ... finished');
  },


  displayGridView: function() {
    contactPhoto.dump("DRAW STACK ")

    var currentDrawNumber = ++contactPhoto.compose.stackDrawNumber;
    var addresses = [];

    // check if an image has been assigned and reverse the order
    var boxes = contactPhoto.compose.widgetParent.getElementsByTagName('textbox');

    for (var id=0; id<boxes.length; id++) {

      if (boxes[id].email == '') {
        continue;
      }
      if (boxes[id].imgObject == null) {
        continue;
      }
      if (boxes[id].imgLoaded == false) {
        continue;
      }

      addresses.push(boxes[id].email);
    }

    var stackCanvas = document.getElementById('DCP-PhotoStack');
    stackCanvas.width = stackCanvas.width; // clear the canvas

    var stackCtx = stackCanvas.getContext('2d');
    var size = contactPhoto.prefs.get('composePhotos.size', 'int');

    var factor = (1.0*stackCanvas.height)/stackCanvas.width;
    var cols = 1;
    var rows = Math.max(1, Math.floor(cols*factor));
    while(cols*rows < addresses.length) {
      cols++;
      rows = Math.max(1, Math.floor(cols*factor));
    }

    var imageSize = Math.min(Math.floor(stackCanvas.width / cols), Math.floor(stackCanvas.height / rows));
    imageSize = Math.min(imageSize, size); // avoid enlarging of images (blurry)

    // exit if there is nothing to draw
    if (addresses.length == 0) {
      contactPhoto.compose.displayEmptyCanvas();
      return;
    }

    if (addresses.length == 1) {
      // if there is only one image, position it in full size in the center
      var w = contactPhoto.display.photoCache[addresses[0]+'-'+size].width;
      var h = contactPhoto.display.photoCache[addresses[0]+'-'+size].height;

      var dx = ((stackCanvas.width-w)*.5 - contactPhoto.compose.photoStack.padding);
      var dy = ((stackCanvas.height-h)*.5 - contactPhoto.compose.photoStack.padding);

      // exit if there is a more recent call to displayStackView()
      if (currentDrawNumber != contactPhoto.compose.stackDrawNumber) { return; }

      stackCtx.drawImage(contactPhoto.display.photoCache[addresses[0]+'-'+size], dx, dy, imageSize, imageSize);
    }
    else {
      for (var i=0; i<addresses.length; i++) {

        var row = Math.floor(i / cols);
        var col = i % cols;

        var dx = (col*imageSize);
        var dy = (row*imageSize);

        // exit if there is a more recent call to displayStackView()
        if (currentDrawNumber != contactPhoto.compose.stackDrawNumber) { return; }

        stackCtx.drawImage(contactPhoto.display.photoCache[addresses[i]+'-'+size], dx, dy, imageSize, imageSize);
      } // end addresses loop
    }

    contactPhoto.dump('  ... finished');
  },


  displayEmptyCanvas: function() {
    var stackCanvas = document.getElementById('DCP-PhotoStack');
    var stackCtx = stackCanvas.getContext('2d');

    var imageSize = Math.min(stackCanvas.height, stackCanvas.width);
    var empty = new Image(imageSize, imageSize);
    empty.addEventListener('load', function() {
      stackCtx.globalAlpha = .15;
      stackCtx.drawImage(empty, (stackCanvas.width-imageSize)/2, (stackCanvas.height-imageSize)/2, imageSize, imageSize);
      stackCtx.globalAlpha = 1;
    }, false);
    empty.src = 'chrome://contactPhoto/skin/empty.png';
  },

  addressBookListener: {
    onItemAdded: function(aParentDir, aItem) {
      contactPhoto.dump('ablistener item added')
      contactPhoto.compose.forceCompleteImageReload();
    },

    onItemRemoved: function(aParentDir, aItem) {
      contactPhoto.dump('ablistener item removed')
      contactPhoto.compose.forceCompleteImageReload();
    },

    onItemPropertyChanged: function(aItem, aProperty, aOldValue, aNewValue) {
      contactPhoto.dump('ablistener item changed')
      contactPhoto.compose.forceCompleteImageReload();
    }
  },

  forceCompleteImageReload: function() {
    // reset internal values so that a reload is triggered
    var bxs = contactPhoto.compose.widgetParent.getElementsByTagName('textbox');
    for (var i=0; i<bxs.length; i++) {
      bxs[i].previousValue = '';
      bxs[i].email = '';
    }

    contactPhoto.compose.removeCachedImages();
    contactPhoto.compose.checkAllTextboxes();
  },

  /**
   * Fetch the card of a recipient and open the edit dialog.
   */
  widgetEditContactHandler: function(element) {
    var textbox = element.parentNode.getElementsByTagName('textbox')[0];
    var address = textbox.email;
    var cardDetails = contactPhoto.getCard(address);

    if (cardDetails && cardDetails.card) {
      window.openDialog("chrome://messenger/content/addressbook/abEditCardDialog.xul",
                      "",
                      "chrome,modal,resizable=no,centerscreen",
                      {abURI:cardDetails.book.URI, card:cardDetails.card});

      // Update the textbox value because the contact data has potentially changed.
      // Check if the address has been altered.
      if (address != cardDetails.card.primaryEmail
        && address != cardDetails.card.secondEmail) {
        address = cardDetails.card.primaryEmail;
      }
      if (cardDetails.card.displayName) {
        textbox.value = cardDetails.card.displayName + " <" + address + ">";
      }
      else {
        textbox.value = address;
      }
      textbox.previousValue = textbox.currentValue;
      textbox.currentValue = textbox.value;
      // The updated data is handled by the address book listener.
    }
  }
}

window.addEventListener('load', function() {
  // no possiblity to delay - setup of photostack has to be done before the addresses are filled in
  contactPhoto.compose.wrap_functions();
  contactPhoto.compose.initPhotoStack();
  contactPhoto.compose.setupEventListeners();
} , false);
