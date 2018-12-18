cropper = {
  init: function() {
    var arg = window.arguments[0];

    cropper.state = cropper.STATE_IDLE;

    cropper.canvas = document.getElementById('DCP-CropCanvas');
    cropper.selection = document.getElementById('DCP-CropSelection');
    cropper.selectionBG = document.getElementById('DCP-CropSelectionBackground');

    var maxSize = cropper.canvas.width;

    var dummyPhoto = new Image();
    dummyPhoto.addEventListener('load', function() {
      var w = dummyPhoto.width;
      var h = dummyPhoto.height;

      cropper.originalPhotoWidth = w;
      cropper.originalPhotoHeight = h;

      //alert(w+' x '+h)
      if (w > maxSize || h > maxSize) { // do not upscale an image
        if (w > h) {
          h = Math.round(h/w*maxSize);
          w = maxSize;
        }
        else {
          w = Math.round(w/h*maxSize);
          h = maxSize;
        }
      }
      //alert(w+' x '+h)


      cropper.canvas.width = w;
      cropper.canvas.height = h;

      var ctx = cropper.canvas.getContext('2d');

      if (contactPhoto.prefs.get('drawBackgroundColor', 'bool')) {
        var rgb = contactPhoto.utils.getColor('backgroundColor');
        ctx.fillStyle = 'rgb('+rgb[0]+', '+rgb[1]+', '+rgb[2]+')';
        ctx.fillRect(0, 0, w, h);
      }

      ctx.drawImage(dummyPhoto, 0, 0, w, h);


      if (arg.width != '' && arg.height != '' && arg.left != '' && arg.top != '') {
        cropper.width = Math.round(parseInt(arg.width)*cropper.canvas.width/cropper.originalPhotoWidth);
        cropper.height = Math.round(parseInt(arg.height)*cropper.canvas.height/cropper.originalPhotoHeight);
        cropper.selLeft = Math.round(parseInt(arg.left)*cropper.canvas.width/cropper.originalPhotoWidth);
        cropper.selTop = Math.round(parseInt(arg.top)*cropper.canvas.height/cropper.originalPhotoHeight);

        cropper.positionSelection();
      }

    }, false);
    dummyPhoto.src = arg.photoURI;


    cropper.canvas.addEventListener('mousedown', cropper.selectionMouseDown, false);
    cropper.canvas.addEventListener('mouseup', cropper.selectionMouseUp, false);
    cropper.canvas.addEventListener('mousemove', cropper.selectionMouseMove, false);
    cropper.canvas.addEventListener('mouseout', cropper.selectionMouseOut, false);
  },

  startX: 0,
  startY: 0,
  width: 0,
  height: 0,
  selTop: 0,
  selLeft: 0,
  moveX: 0,
  moveY: 0,

  STATE_IDLE: 'i',
  STATE_SELECTING: 's',
  STATE_MOVING_SELECTION: 'm',
  STATE_RESIZING_SELECTION: 'r',

  selectionMouseDown: function(e) {
    if (e.button != 0) return;

    var action = cropper.getMouseAction(e.layerX, e.layerY);

    switch (action) {
      case cropper.STATE_SELECTING: // start selection
        cropper.state = action;

        cropper.width = 0;
        cropper.height = 0;
        cropper.selLeft = 0;
        cropper.selTop = 0;

        cropper.startX = e.layerX;
        cropper.startY = e.layerY;

        cropper.selection.setAttribute('hidden', true);
        cropper.selectionBG.setAttribute('hidden', true);
      break;

      case cropper.STATE_MOVING_SELECTION:
        cropper.state = action;

        cropper.moveX = e.layerX;
        cropper.moveY = e.layerY;
      break;

      case cropper.STATE_RESIZING_SELECTION:
        cropper.state = action;
        cropper.resizingSelection = true;

        cropper.moveX = e.layerX;
        cropper.moveY = e.layerY;
      break;
    }
  },

  selectionMouseUp: function(e) {
    if (e.button != 0) return;

    switch (cropper.state) {
      case cropper.STATE_SELECTING:
        cropper.state = cropper.STATE_IDLE;

        cropper.setCursor();
      break;

      case cropper.STATE_MOVING_SELECTION:
        cropper.state = cropper.STATE_IDLE;

        cropper.setCursor();
      break;

      case cropper.STATE_RESIZING_SELECTION:
        cropper.state = cropper.STATE_IDLE;
        cropper.resizingSelection = false;

        cropper.setCursor();
      break;
    }
  },

  selectionMouseMove: function(e) {
    var action = cropper.getMouseAction(e.layerX, e.layerY);

    switch (cropper.state) {
      case cropper.STATE_SELECTING:


        if (e.layerX < cropper.startX) {
          cropper.width = cropper.startX - e.layerX;
          cropper.selLeft = e.layerX;
        }
        else {
          cropper.width = e.layerX - cropper.startX;
          cropper.selLeft = cropper.startX;
        }

        if (e.layerY < cropper.startY) {
          cropper.height = cropper.startY - e.layerY;
          cropper.selTop = e.layerY;
        }
        else {
          cropper.height = e.layerY - cropper.startY;
          cropper.selTop = cropper.startY;
        }

        if (document.getElementById('DCP-SquareSelection').checked) {
          var size = Math.min(cropper.canvas.width, cropper.canvas.height, Math.max(cropper.width, cropper.height))
          cropper.height = size
          cropper.width = size;

          if ((cropper.selLeft+cropper.width) > cropper.canvas.width) cropper.selLeft = cropper.canvas.width - cropper.width;
          if ((cropper.selTop+cropper.height) > cropper.canvas.height) cropper.selTop = cropper.canvas.height - cropper.height;
        }

        cropper.positionSelection();

      break;

      case cropper.STATE_RESIZING_SELECTION:
        var dx = e.layerX - cropper.moveX;
        var dy = e.layerY - cropper.moveY;

        var square = document.getElementById('DCP-SquareSelection').checked;

        switch (cropper.resizingDirection) {
          case 'w':
            cropper.selLeft += dx;
            cropper.width -= dx;
            if (square) {
              cropper.height = cropper.width;
            }
          break;

          case 'nw':
            cropper.selLeft += dx;
            cropper.width -= dx;
            cropper.selTop += dy;
            cropper.height -= dy;
            if (square) {
              cropper.height = cropper.width;
            }
          break;

          case 'n':
            cropper.selTop += dy;
            cropper.height -= dy;
            if (square) {
              cropper.width = cropper.height;
            }
          break;

          case 'ne':
            cropper.width += dx;
            cropper.selTop += dy;
            cropper.height -= dy;
            if (square) {
              cropper.width = cropper.height;
            }
          break;

          case 'e':
            cropper.width += dx;
            if (square) {
              cropper.height = cropper.width;
            }
          break;

          case 'se':
            cropper.width += dx;
            cropper.height += dy;
            if (square) {
              cropper.height = cropper.width;
            }
          break;

          case 's':
            cropper.height += dy;
            if (square) {
              cropper.width = cropper.height;
            }
          break;

          case 'sw':
            cropper.selLeft += dx;
            cropper.width -= dx;
            cropper.height += dy;
            if (square) {
              cropper.height = cropper.width;
            }
          break;
        }

        cropper.moveX = e.layerX;
        cropper.moveY = e.layerY;

        cropper.restrictSelection();
        cropper.positionSelection();

      break;


      break;

      case cropper.STATE_MOVING_SELECTION:
        cropper.selLeft += e.layerX - cropper.moveX;
        cropper.selTop += e.layerY - cropper.moveY;

        cropper.restrictSelection();
        cropper.positionSelection();

        cropper.moveX = e.layerX;
        cropper.moveY = e.layerY;

      break;

    }



    cropper.setCursor();
  },

  selectionMouseOut: function(e) {
    cropper.state = cropper.STATE_IDLE;
    cropper.resizingSelection = false;
  },

  restrictSelection: function() {
    if (cropper.selLeft < 0) cropper.selLeft = 0;
    if (cropper.selTop < 0) cropper.selTop = 0;
    cropper.width = Math.min(cropper.width, cropper.canvas.width);
    cropper.height = Math.min(cropper.height, cropper.canvas.height);
    if ((cropper.selLeft+cropper.width) > cropper.canvas.width) cropper.selLeft = cropper.canvas.width - cropper.width;
    if ((cropper.selTop+cropper.height) > cropper.canvas.height) cropper.selTop = cropper.canvas.height - cropper.height;
  },

  removeSelection: function() {
    cropper.selection.setAttribute('hidden', true);
    cropper.selectionBG.setAttribute('hidden', true);
  },

  getMouseAction: function(x, y) {
    if (cropper.resizingSelection == true) return cropper.STATE_RESIZING_SELECTION;

    if (cropper.selection.hasAttribute('hidden')) {
      cropper.canvas.style.cursor = 'crosshair';
      return cropper.STATE_SELECTING;
    }

    var distW = x - cropper.selLeft;
    var distN = y - cropper.selTop;
    var distE = cropper.selLeft + cropper.width - x;
    var distS = cropper.selTop + cropper.height - y;

    if (x < cropper.selLeft || y < cropper.selTop || x > (cropper.selLeft+cropper.width) || y > (cropper.selTop+cropper.height)) {
      cropper.canvas.style.cursor = 'crosshair';
      return cropper.STATE_SELECTING;
    }

    // the cursor is over the selection
    selBorder = 10;

    if (distW < selBorder) {
      if (distN < selBorder) {
        cropper.resizingDirection = 'nw';
      }
      else if (distS < selBorder) {
        cropper.resizingDirection = 'sw';
      }
      else {
        cropper.resizingDirection = 'w';
      }
    }
    else if (distE < selBorder) {
      if (distN < selBorder) {
        cropper.resizingDirection = 'ne';
      }
      else if (distS < selBorder) {
        cropper.resizingDirection = 'se';
      }
      else {
        cropper.resizingDirection = 'e';
      }
    }
    else {
      if (distN < selBorder) {
        cropper.resizingDirection = 'n';
      }
      else if (distS < selBorder) {
        cropper.resizingDirection = 's';
      }
      else { // the cursor is in the middle of the selection
        cropper.canvas.style.cursor = '-moz-grab';
        return cropper.STATE_MOVING_SELECTION;
      }
    }

    if (cropper.state == cropper.STATE_IDLE) {
      cropper.canvas.style.cursor = cropper.resizingDirection+'-resize';
    }
    return cropper.STATE_RESIZING_SELECTION;
  },

  setCursor: function() {
    return;
    var cursor = 'default';

    switch (cropper.state) {
      case cropper.STATE_SELECTING:
        cursor = 'crosshair';
      break;

      case cropper.STATE_RESIZING_SELECTION:
        cursor = cropper.resizingDirection+'-resize';
      break;

      case cropper.STATE_MOVE_SELECTION:
        cursor = '-moz-grab';
      break;

      case cropper.STATE_MOVING_SELECTION:
        cursor = '-moz-grabbing';
      break;
    }

    cropper.canvas.style.cursor = cursor;
  },

  positionSelection: function() {
    if (cropper.selection.hasAttribute('hidden')) {
      cropper.selection.removeAttribute('hidden');
      cropper.selectionBG.removeAttribute('hidden');
    }

    cropper.selection.left = cropper.selLeft;
    cropper.selection.width = cropper.width;

    cropper.selection.top = cropper.selTop;
    cropper.selection.height = cropper.height;

    cropper.selectionBG.left = cropper.selection.left;
    cropper.selectionBG.width = cropper.selection.width;
    cropper.selectionBG.top = cropper.selection.top;
    cropper.selectionBG.height = cropper.selection.height;

  },

  dialogAccept: function(e) {
    returnVal = window.arguments[1];
    returnVal.cropAreaChanged = true;
    returnVal.doNotCrop = false;
    if (cropper.selection.hasAttribute('hidden')) {
      returnVal.doNotCrop = true;
    }
    else {
      returnVal.width = Math.round(cropper.width*cropper.originalPhotoWidth/cropper.canvas.width);
      returnVal.height = Math.round(cropper.height*cropper.originalPhotoHeight/cropper.canvas.height);
      returnVal.left = Math.round(cropper.selLeft*cropper.originalPhotoWidth/cropper.canvas.width);
      returnVal.top = Math.round(cropper.selTop*cropper.originalPhotoHeight/cropper.canvas.height);
    }

    return true;
  },

  dialogCancel: function(e) {
    return true;
  }

}

