if (!contactPhoto) var contactPhoto = {};
if (!contactPhoto.classes) contactPhoto.classes = {};

// canvasPerspectiveWarp warps the contents of an entire canvas (parameter sCanvas)
// using the provided vanishing points which are relative to the source canvas

// wrapping canvasPerspectiveWarp into a json object to create a 'class' inside a namespace
contactPhoto.classes.canvasPerspectiveWarp = function(sCanvas) { return {
  srcCanvas: sCanvas,
  destCanvas: null,
  interpolationMethod: 'nn', // 'nn' or 'bl' (nearest-neighbour or bilinear)
  referencePoint: 'tl',
  offset: { x: 0, y: 0 },

  // the width and height of the bounding box of the transformed canvas
  vanishingPointsBoundingBox: function(p1x, p1y, p2x, p2y) {

    var vp1 = this._makePoint(), vp2 = this._makePoint(); // coordinates of vanishing points
    vp1.x = p1x;
    vp1.y = p1y;

    vp2.x = p2x;
    vp2.y = p2y;

    // corner coordinates of source canvas
    var  pTL = this._makePoint(),  pBL = this._makePoint(),  pBR = this._makePoint(),  pTR = this._makePoint();
    // new coordinates of corners
    var _pTL = this._makePoint(), _pBL = this._makePoint(), _pBR = this._makePoint(), _pTR = this._makePoint();

    this._getTransformedCorners(vp1, vp2, pTL, pBL, pBR, pTR, _pTL, _pBL, _pBR, _pTR);

    // height/width +1 for edge antialiasing
    var p1 = {x: 0, y: 0}; // upper left corner
    var p2 = {x: 0, y: this.srcCanvas.height}; // lower left corner
    var p3 = {x: this.srcCanvas.width, y: this.srcCanvas.height}; // lower right corner
    var p4 = {x: this.srcCanvas.width, y: 0}; // upper right corner

    var q1 = {x: p1.x+_pTL.x-pTL.x, y: p1.y+_pTL.y-pTL.y}; // upper left corner
    var q2 = {x: p2.x+_pBL.x-pBL.x, y: p2.y+_pBL.y-pBL.y}; // lower left corner
    var q3 = {x: p3.x+_pBR.x-pBR.x, y: p3.y+_pBR.y-pBR.y}; // lower right corner
    var q4 = {x: p4.x+_pTR.x-pTR.x, y: p4.y+_pTR.y-pTR.y}; // upper right corner

    var min = this._makePoint(), max = this._makePoint();

    min.x = Math.min(q1.x, q2.x, q3.x, q4.x);
    min.y = Math.min(q1.y, q2.y, q3.y, q4.y);
    max.x = Math.max(q1.x, q2.x, q3.x, q4.x);
    max.y = Math.max(q1.y, q2.y, q3.y, q4.y);

    var boundingBox = {};
    boundingBox.width = Math.ceil(Math.abs(max.x - min.x));
    boundingBox.height = Math.ceil(Math.abs(max.y - min.y));

    return boundingBox;
  },

  // transform the source canvas using the reference point and vanishing points
  vanishingPoints: function(p1x, p1y, p2x, p2y) {

    var vp1 = this._makePoint(), vp2 = this._makePoint(); // coordinates of vanishing points
    vp1.x = p1x;
    vp1.y = p1y;

    vp2.x = p2x;
    vp2.y = p2y;

    // corner coordinates of source canvas
    var  pTL = this._makePoint(),  pBL = this._makePoint(),  pBR = this._makePoint(),  pTR = this._makePoint();
    // new coordinates of corners
    var _pTL = this._makePoint(), _pBL = this._makePoint(), _pBR = this._makePoint(), _pTR = this._makePoint();


    this._getTransformedCorners(vp1, vp2, pTL, pBL, pBR, pTR, _pTL, _pBL, _pBR, _pTR);

    return this._transform(_pTL.x-pTL.x, _pTL.y-pTL.y, _pBL.x-pBL.x, _pBL.y-pBL.y, _pBR.x-pBR.x, _pBR.y-pBR.y, _pTR.x-pTR.x, _pTR.y-pTR.y);
  },

  _getTransformedCorners: function(vp1, vp2, pTL, pBL, pBR, pTR, _pTL, _pBL, _pBR, _pTR) {
    // top left
    pTL.x = 0;
    pTL.y = 0;
    // bottom left
    pBL.x = 0;
    pBL.y = this.srcCanvas.height-1;
    // bottom right
    pBR.x = this.srcCanvas.width-1;
    pBR.y = this.srcCanvas.height-1;
    // top right
    pTR.x = this.srcCanvas.width-1;
    pTR.y = 0;

    // p1 and p2 are relative to the canvas coordinates system
    // make sure they are not inside the canvas
    try {
      if ((0 <= vp1.x && vp1.x <= this.srcCanvas.width) && (0 <= vp1.y && vp1.y <= this.srcCanvas.height)) throw "vp1 is within the canvas";
      if ((0 <= vp2.x && vp2.x <= this.srcCanvas.width) && (0 <= vp2.y && vp2.y <= this.srcCanvas.height)) throw "vp2 is within the canvas";
    }
    catch (e) {
      return;
    }

    // no valid reference point specified
    // choosing the most distant corner is most of the time the best choice
    if (this.referencePoint != 'tl' && this.referencePoint != 'bl' && this.referencePoint != 'tr' && this.referencePoint != 'br') {
      var dx, dy, sum, sum2, sum3, sum4;

      dx = Math.pow(vp1.x-pTL.x, 2) + Math.pow(vp2.x-pTL.x, 2);
      dy = Math.pow(vp1.y-pTL.y, 2) + Math.pow(vp2.y-pTL.y, 2);
      sum = dx+dy;
      this.referencePoint = 'tl';

      dx = Math.pow(vp1.x-pTR.x, 2) + Math.pow(vp2.x-pTR.x, 2);
      dy = Math.pow(vp1.y-pTR.y, 2) + Math.pow(vp2.y-pTR.y, 2);
      sum2 = dx+dy;
      if (sum2 > sum) {
        sum = sum2;
        this.referencePoint = 'tr';
      }

      dx = Math.pow(vp1.x-pBL.x, 2) + Math.pow(vp2.x-pBL.x, 2);
      dy = Math.pow(vp1.y-pBL.y, 2) + Math.pow(vp2.y-pBL.y, 2);
      sum3 = dx+dy;
      if (sum3 > sum) {
        sum = sum3;
        this.referencePoint = 'bl';
      }

      dx = Math.pow(vp1.x-pBR.x, 2) + Math.pow(vp2.x-pBR.x, 2);
      dy = Math.pow(vp1.y-pBR.y, 2) + Math.pow(vp2.y-pBR.y, 2);
      sum4 = dx+dy;
      if (sum4 > sum) {
        this.referencePoint = 'br';
      }
    }

    switch (this.referencePoint) {
      case 'tl':
        _pTL.x = pTL.x; // tl remains the same
        _pTL.y = pTL.y; // tl remains the same

        // _pBL: get line through pTL and VP1 and intersection with line pBL-pBR
        var m1 = (pTL.y-vp1.y)/(pTL.x-vp1.x);
        var q1 = vp1.y - m1*vp1.x;

        _pBL.x = (pBL.y-q1)/m1;
        _pBL.y = pBL.y;

        // _pTR: get line through pTL and VP2 and intersection with line pTR-pBR
        var m2 = (pTL.y-vp2.y)/(pTL.x-vp2.x);
        var q2 = vp2.y - m2*vp2.x;

        _pTR.x = pTR.x;
        _pTR.y = m2*pTR.x+q2;

        // _pBR: get the lines _pTR-VP1 and _pBL-VP2 and their intersection
        var m3 = (_pTR.y-vp1.y)/(_pTR.x-vp1.x);
        var q3 = vp1.y - m3*vp1.x;

        var m4 = (_pBL.y-vp2.y)/(_pBL.x-vp2.x);
        var q4 = vp2.y - m4*vp2.x;

        _pBR.x = (q3-q4)/(m4-m3);
        _pBR.y = (m3*q4-m4*q3)/(m3-m4);
      break;

      case 'bl':
        _pBL.x = pBL.x; // bl remains the same
        _pBL.y = pBL.y; // bl remains the same

        // _pTL: get line through pBL and VP1 and intersection with line pTL-pTR
        var m1 = (pBL.y-vp1.y)/(pBL.x-vp1.x);
        var q1 = vp1.y - m1*vp1.x;

        _pTL.x = (pTL.y-q1)/m1;
        _pTL.y = pTL.y;

        // _pBR: get line through pBL and VP2 and intersection with line pTR-pBR
        var m2 = (pBL.y-vp2.y)/(pBL.x-vp2.x);
        var q2 = vp2.y - m2*vp2.x;

        _pBR.x = pBR.x;
        _pBR.y = m2*pBR.x+q2;

        // _pTR: get the lines _pBR-VP1 and _pTL-VP2 and their intersection
        var m3 = (_pBR.y-vp1.y)/(_pBR.x-vp1.x);
        var q3 = vp1.y - m3*vp1.x;

        var m4 = (_pTL.y-vp2.y)/(_pTL.x-vp2.x);
        var q4 = vp2.y - m4*vp2.x;

        _pTR.x = (q3-q4)/(m4-m3);
        _pTR.y = (m3*q4-m4*q3)/(m3-m4);

      break;

      case 'br':
        _pBR.x = pBR.x; // br remains the same
        _pBR.y = pBR.y; // br remains the same

        // _pTR: get line through pBR and VP1 and intersection with line pTL-pTR
        var m1 = (pBR.y-vp1.y)/(pBR.x-vp1.x);
        var q1 = vp1.y - m1*vp1.x;

        _pTR.x = (pTR.y-q1)/m1;
        _pTR.y = pTR.y;

        // _pBL: get line through pBR and VP2 and intersection with line pTL-pBL
        var m2 = (pBR.y-vp2.y)/(pBR.x-vp2.x);
        var q2 = vp2.y - m2*vp2.x;

        _pBL.x = pBL.x;
        _pBL.y = m2*pBL.x+q2;

        // _pTL: get the lines _pBL-VP1 and _pTR-VP2 and their intersection
        var m3 = (_pBL.y-vp1.y)/(_pBL.x-vp1.x);
        var q3 = vp1.y - m3*vp1.x;

        var m4 = (_pTR.y-vp2.y)/(_pTR.x-vp2.x);
        var q4 = vp2.y - m4*vp2.x;

        _pTL.x = (q3-q4)/(m4-m3);
        _pTL.y = (m3*q4-m4*q3)/(m3-m4);
      break;

      case 'tr':
        _pTR.x = pTR.x; // tr remains the same
        _pTR.y = pTR.y; // tr remains the same

        // _pBR: get line through pTR and VP1 and intersection with line pBL-pBR
        var m1 = (pTR.y-vp1.y)/(pTR.x-vp1.x);
        var q1 = vp1.y - m1*vp1.x;

        _pBR.x = (pBR.y-q1)/m1;
        _pBR.y = pBR.y;

        // _pTL: get line through pTR and VP2 and intersection with line pTL-pBL
        var m2 = (pTR.y-vp2.y)/(pTR.x-vp2.x);
        var q2 = vp2.y - m2*vp2.x;

        _pTL.x = pTL.x;
        _pTL.y = m2*pTL.x+q2;

        // _pBL: get the lines _pTL-VP1 and _pBR-VP2 and their intersection
        var m3 = (_pTL.y-vp1.y)/(_pTL.x-vp1.x);
        var q3 = vp1.y - m3*vp1.x;

        var m4 = (_pBR.y-vp2.y)/(_pBR.x-vp2.x);
        var q4 = vp2.y - m4*vp2.x;

        _pBL.x = (q3-q4)/(m4-m3);
        _pBL.y = (m3*q4-m4*q3)/(m3-m4);

      break;
    } // end switch
  },

  // transform a canvas using the displacements of the corners
  _transform: function(TLdx, TLdy, BLdx, BLdy, BRdx, BRdy, TRdx, TRdy) {

    // height/width +1 for edge antialiasing
    var p1 = {x: 0, y: 0}; // upper left corner
    var p2 = {x: 0, y: this.srcCanvas.height}; // lower left corner
    var p3 = {x: this.srcCanvas.width, y: this.srcCanvas.height}; // lower right corner
    var p4 = {x: this.srcCanvas.width, y: 0}; // upper right corner


    var q1 = {x: p1.x+TLdx, y: p1.y+TLdy}; // upper left corner
    var q2 = {x: p2.x+BLdx, y: p2.y+BLdy}; // lower left corner
    var q3 = {x: p3.x+BRdx, y: p3.y+BRdy}; // lower right corner
    var q4 = {x: p4.x+TRdx, y: p4.y+TRdy}; // upper right corner


    //////////////////////////////////////////////////////////
    // get the dimensions of the transformed image
    var min = {};
    var max = {};

    min.x = Math.min(q1.x, q2.x, q3.x, q4.x);
    min.y = Math.min(q1.y, q2.y, q3.y, q4.y);
    max.x = Math.max(q1.x, q2.x, q3.x, q4.x);
    max.y = Math.max(q1.y, q2.y, q3.y, q4.y);

    this.offset.x = -Math.floor(min.x);
    this.offset.y = -Math.floor(min.y);

    var destWidth = Math.ceil(Math.abs(max.x - min.x));
    var destHeight = Math.ceil(Math.abs(max.y - min.y));

    var destArea = destWidth*destHeight;
    if (destArea > 1e5) {
      //alert('Warning: Transformation is too big: '+destWidth+'x'+destHeight+', Area: '+destArea);
      return -1;
    }
    //////////////////////////////////////////////////////////
    // calculate the perspective transformation matrix

    // the order of the points does not matter as long as it is the same in both calculateMatrix() calls
    var ps = this._adjoint33(this._calculateMatrix(p1, p2, p3, p4));
    var sq = this._calculateMatrix(q1, q2, q3, q4);

    var mTranslation = [[1, 0, this.offset.x], [0, 1, this.offset.y], [0, 0, 1]];
    this._transpose33(mTranslation);

    var mPerspective = this._matrix33();

    this._mult33(ps, sq, mPerspective);

    var fw_trafo = this._matrix33();
    this._mult33(mPerspective, mTranslation, fw_trafo);

    var bw_trafo = this._adjoint33(fw_trafo);


    //////////////////////////////////////////////////////////
    // convert the imagedata arrays of src and dest into a two-dimensional matrix

    // create two-dimensional array for storing the destination data
    var destPixelData = new Array(destWidth);
    for (var x=0; x<destWidth; x++) {
      destPixelData[x] = new Array(destHeight);
    }

    // create two-dimensional array for storing the source data
    var srcCtx = this.srcCanvas.getContext('2d');
    var srcData = srcCtx.getImageData(0, 0, this.srcCanvas.width, this.srcCanvas.height);

    var srcPixelData = new Array(srcData.width);
    for (var x=0; x<srcData.width; x++) {
      srcPixelData[x] = new Array(srcData.height);
    }

    // filling the source array
    var i = 0;
    for (var y=0; y<srcData.height; y++) {
      for (var x=0; x<srcData.width; x++) {

        srcPixelData[x][y] = {
          r: srcData.data[i++],
          g: srcData.data[i++],
          b: srcData.data[i++],
          a: srcData.data[i++]
        };
      }
    }
    // append width and height for later use
    srcPixelData[srcPixelData.length] = srcData.width;
    srcPixelData[srcPixelData.length] = srcData.height;

    this.destCanvas = document.createElementNS(contactPhoto.ns.XHTML, 'canvas');
    this.destCanvas.width = destWidth;
    this.destCanvas.height = destHeight;
    var destCtx = this.destCanvas.getContext('2d');


    destCtx.beginPath();
    destCtx.moveTo(q1.x+this.offset.x-1, q1.y+this.offset.y-1);
    destCtx.lineTo(q2.x+this.offset.x-1, q2.y+this.offset.y+1);
    destCtx.lineTo(q3.x+this.offset.x+1, q3.y+this.offset.y+1);
    destCtx.lineTo(q4.x+this.offset.x+1, q4.y+this.offset.y-1);
    destCtx.closePath();
    //destCtx.strokeStyle = 'green';
    //destCtx.stroke();

    // loop over to-be-warped image and apply the transformation
    for (var x=0; x<destWidth; x++) {
      for (var y=0; y<destHeight; y++) {
        // if dest pixel is not inside the to-be-warped area, skip the transformation and assign transparent black
        if (1) {
        //if (destCtx.isPointInPath(x, y)) {

          var srcCoord = this._applyTrafo(x, y, bw_trafo);

          if (this.interpolationMethod == 'nn') {
            destPixelData[x][y] = this._interpolateNN(srcCoord, srcPixelData)
          }
          else {
            destPixelData[x][y] = this._interpolateBL(srcCoord, srcPixelData)
          }

        }
        else {
          destPixelData[x][y] = {
            r: 0,
            g: 0,
            b: 0,
            a: 0
          };
        }
      }
    }


    var destData = destCtx.createImageData(this.destCanvas.width, this.destCanvas.height);

    // write the data back to the imagedata array
    var i = 0;
    for (var y=0; y<destHeight; y++) {
      for (var x=0; x<destWidth; x++) {

        destData.data[i++] = destPixelData[x][y].r;
        destData.data[i++] = destPixelData[x][y].g;
        destData.data[i++] = destPixelData[x][y].b;
        destData.data[i++] = destPixelData[x][y].a;
      }
    }

    destCtx.putImageData(destData, 0, 0);

    return this.destCanvas;
  },

  _interpolateNN: function(srcCoord, srcPixelData) {
    var w = srcPixelData[srcPixelData.length-2];
    var h = srcPixelData[srcPixelData.length-1];

    // set the dest pixel to transparent black if it is outside the source area
    if (srcCoord.x < 0 || srcCoord.x > w-1 || srcCoord.y < 0 || srcCoord.y > h-1) {
      return {
        r: 0,
        g: 0,
        b: 0,
        a: 0
      };
    }

    var x0 = Math.round(srcCoord.x);
    var y0 = Math.round(srcCoord.y);

    return srcPixelData[x0][y0];
  },

  _interpolateBL: function(srcCoord, srcPixelData) {
    var w = srcPixelData[srcPixelData.length-2];
    var h = srcPixelData[srcPixelData.length-1];

    var x0 = Math.floor(srcCoord.x);
    var x1 = x0+1;
    var y0 = Math.floor(srcCoord.y);
    var y1 = y0+1;

    // set the dest pixel to transparent black if it is outside the source area
    if (x0 < -1 || x1 > w || y0 < -1 || y1 > h) {
      return {
        r: 0,
        g: 0,
        b: 0,
        a: 0
      };
    }

    var f00 = (x1-srcCoord.x)*(y1-srcCoord.y);
    var f10 = (srcCoord.x-x0)*(y1-srcCoord.y);
    var f01 = (x1-srcCoord.x)*(srcCoord.y-y0);
    var f11 = (srcCoord.x-x0)*(srcCoord.y-y0);

    var alpha = [[-1, -1], [-1, -1]];

    if (x0 < 0) {
      x0 = 0;
      alpha[0][0] = 0;
      alpha[0][1] = 0;
    }

    if (y0 < 0) {
      y0 = 0;
      alpha[0][0] = 0;
      alpha[1][0] = 0;
    }

    if (x1 > w-1) {
      x1 = w-1;
      alpha[1][0] = 0;
      alpha[1][1] = 0;
    }

    if (y1 > h-1) {
      y1 = h-1;
      alpha[0][1] = 0;
      alpha[1][1] = 0;
    }

    // if alpha[x][x] has not been modified, then the pixel exists --> set alpha
    if (alpha[0][0] == -1) alpha[0][0] = srcPixelData[x0][y0].a;
    if (alpha[1][0] == -1) alpha[1][0] = srcPixelData[x1][y0].a;
    if (alpha[0][1] == -1) alpha[0][1] = srcPixelData[x0][y1].a;
    if (alpha[1][1] == -1) alpha[1][1] = srcPixelData[x1][y1].a;

    var pixel = {
      r: Math.round(srcPixelData[x0][y0].r*f00 + srcPixelData[x1][y0].r*f10 + srcPixelData[x0][y1].r*f01 + srcPixelData[x1][y1].r*f11),
      g: Math.round(srcPixelData[x0][y0].g*f00 + srcPixelData[x1][y0].g*f10 + srcPixelData[x0][y1].g*f01 + srcPixelData[x1][y1].g*f11),
      b: Math.round(srcPixelData[x0][y0].b*f00 + srcPixelData[x1][y0].b*f10 + srcPixelData[x0][y1].b*f01 + srcPixelData[x1][y1].b*f11),
      a: Math.round(alpha[0][0]*f00 + alpha[1][0]*f10 + alpha[0][1]*f01 + alpha[1][1]*f11)
    }

    if (pixel.r < 0) pixel.r = 0;
    if (pixel.g < 0) pixel.g = 0;
    if (pixel.b < 0) pixel.b = 0;
    if (pixel.a < 0) pixel.a = 0;

    if (pixel.r > 255) pixel.r = 255;
    if (pixel.g > 255) pixel.g = 255;
    if (pixel.b > 255) pixel.b = 255;
    if (pixel.a > 255) pixel.a = 255;

    return pixel;
  },

  _applyTrafo: function(x, y, trafo) {
    var w = trafo[0][2]*x + trafo[1][2]*y + trafo[2][2];
    if (w == 0) w = 1;

    return {x: (trafo[0][0]*x + trafo[1][0]*y + trafo[2][0])/w,
        y: (trafo[0][1]*x + trafo[1][1]*y + trafo[2][1])/w};
  },

  _mult33: function(m1, m2, result) {
    for (var i=0; i<3; i++) {
      for (var j=0; j<3; j++) {
        for (var k=0; k<3; k++) {
          result[i][j] += m1[i][k]*m2[k][j];
        }
      }
    }
  },

  _det22: function(m11, m12, m21, m22) {
    /*
    m11  m12
    m21  m22
    */
    return m11*m22 - m12*m21;
  },

  _transpose33: function(matrix) {
    var tmp;
    tmp = matrix[0][1];
    matrix[0][1] = matrix[1][0];
    matrix[1][0] = tmp;

    tmp = matrix[0][2];
    matrix[0][2] = matrix[2][0];
    matrix[2][0] = tmp;

    tmp = matrix[1][2];
    matrix[1][2] = matrix[2][1];
    matrix[2][1] = tmp;
  },

  _calculateMatrix: function(p0, p1, p2, p3) {
    /*
    a  d  g
    b  e  h
    c  f  i

    i = 1
    */
    var a, b, c, d, e, f, g, h;


    var sx = p0.x - p1.x + p2.x - p3.x;
    var sy = p0.y - p1.y + p2.y - p3.y;

    if (sx == 0 && sy == 0) {
      a = p1.x - p0.x;
      b = p2.x - p1.x;
      c = p0.x;
      d = p1.y - p0.y;
      e = p2.y - p1.y;
      f = p0.y;
      g = 0;
      h = 0;
    }
    else {
      var dx1 = p1.x - p2.x;
      var dx2 = p3.x - p2.x;
      var dy1 = p1.y - p2.y;
      var dy2 = p3.y - p2.y;

      var det = this._det22(dx1, dx2, dy1, dy2);

      if (det == 0) {
        return;
      }

      g = this._det22(sx, dx2, sy, dy2)/det;
      h = this._det22(dx1, sx, dy1, sy)/det;

      a = p1.x - p0.x + g*p1.x;
      b = p3.x - p0.x + h*p3.x;
      c = p0.x;
      d = p1.y - p0.y + g*p1.y;
      e = p3.y - p0.y + h*p3.y;
      f = p0.y;
    }

    var out = [[a, d, g], [b, e, h], [c, f, 1]];
    //transpose33(out)

    return out;
  },

  _matrix33: function() {
    return [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  },

  /*
  // _det33 is not used at the moment
  _det33: function(matrix) {
    var a1 = matrix[0][0]*matrix[1][1]*matrix[2][2];
    var a2 = matrix[1][0]*matrix[2][1]*matrix[0][2];
    var a3 = matrix[2][0]*matrix[0][1]*matrix[1][2];

    var s1 = matrix[0][0]*matrix[2][1]*matrix[1][2];
    var s2 = matrix[1][0]*matrix[0][1]*matrix[2][2];
    var s3 = matrix[2][0]*matrix[1][1]*matrix[0][2];

    return  a1+a2+a3-s1-s2-s3;
  },
  */

  _adjoint33: function(matrix) {
    /* using homogeneous coordinates, the adjoint can be used instead of the inverse of a matrix
    [[a, b, c], [d, e, f], [g, h, i]]
    m11 = e*i - h*f;
    m12 = c*h - b*i;
    m13 = b*f - c*e;

    m21 = f*g - d*i;
    m22 = a*i - c*g;
    m23 = c*d - a*f;

    m31 = d*h - e*g;
    m32 = b*g - a*h;
    m33 = a*e - b*d;
    */

    var m11 = matrix[1][1]*matrix[2][2] - matrix[2][1]*matrix[1][2];
    var m12 = matrix[0][2]*matrix[2][1] - matrix[0][1]*matrix[2][2];
    var m13 = matrix[0][1]*matrix[1][2] - matrix[0][2]*matrix[1][1];

    var m21 = matrix[1][2]*matrix[2][0] - matrix[1][0]*matrix[2][2];
    var m22 = matrix[0][0]*matrix[2][2] - matrix[0][2]*matrix[2][0];
    var m23 = matrix[0][2]*matrix[1][0] - matrix[0][0]*matrix[1][2];

    var m31 = matrix[1][0]*matrix[2][1] - matrix[1][1]*matrix[2][0];
    var m32 = matrix[0][1]*matrix[2][0] - matrix[0][0]*matrix[2][1];
    var m33 = matrix[0][0]*matrix[1][1] - matrix[0][1]*matrix[1][0];

    return [[m11, m12, m13], [m21, m22, m23], [m31, m32, m33]];
  },

  _makePoint: function() {
    return { x:0, y:0 };
  },

  dumpMatrix: function(trafo) {
    alert((trafo[0][0]/trafo[2][2]).toFixed(3)+'    '+(trafo[0][1]/trafo[2][2]).toFixed(3)+'    '+(trafo[0][2]/trafo[2][2]).toFixed(3)+'\n'+(trafo[1][0]/trafo[2][2])
  .toFixed(3)+'    '+(trafo[1][1]/trafo[2][2]).toFixed(3)+'    '+(trafo[1][2]/trafo[2][2]).toFixed(3)+'\n'+(trafo[2][0]/trafo[2][2]).toFixed(3)+'    '+(trafo[2][1]/trafo[2][2]).toFixed(3)+'    '+(trafo[2][2]/trafo[2][2]).toFixed(3))
  }

};}
