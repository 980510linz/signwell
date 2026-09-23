/* QRCode core derived from Kazuhiko Arase's MIT-licensed QRCode for JavaScript.
   Bundled locally for SIGN WELL Article Identity; no third-party runtime request. */
(function(g){'use strict';
const M={"QR8bitByte":function(require,module,exports){
var QRMode = require('./QRMode');

function QR8bitByte(data) {
	this.mode = QRMode.MODE_8BIT_BYTE;
	this.data = data;
}

QR8bitByte.prototype = {

	getLength : function() {
		return this.data.length;
	},
	
	write : function(buffer) {
		for (var i = 0; i < this.data.length; i++) {
			// not JIS ...
			buffer.put(this.data.charCodeAt(i), 8);
		}
	}
};

module.exports = QR8bitByte;

},
"QRBitBuffer":function(require,module,exports){
function QRBitBuffer() {
	this.buffer = [];
	this.length = 0;
}

QRBitBuffer.prototype = {

	get : function(index) {
		var bufIndex = Math.floor(index / 8);
		return ( (this.buffer[bufIndex] >>> (7 - index % 8) ) & 1) == 1;
	},
	
	put : function(num, length) {
		for (var i = 0; i < length; i++) {
			this.putBit( ( (num >>> (length - i - 1) ) & 1) == 1);
		}
	},
	
	getLengthInBits : function() {
		return this.length;
	},
	
	putBit : function(bit) {
	
		var bufIndex = Math.floor(this.length / 8);
		if (this.buffer.length <= bufIndex) {
			this.buffer.push(0);
		}
	
		if (bit) {
			this.buffer[bufIndex] |= (0x80 >>> (this.length % 8) );
		}
	
		this.length++;
	}
};

module.exports = QRBitBuffer;

},
"QRErrorCorrectLevel":function(require,module,exports){
module.exports = {
	L : 1,
	M : 0,
	Q : 3,
	H : 2
};


},
"QRMaskPattern":function(require,module,exports){
module.exports = {
	PATTERN000 : 0,
	PATTERN001 : 1,
	PATTERN010 : 2,
	PATTERN011 : 3,
	PATTERN100 : 4,
	PATTERN101 : 5,
	PATTERN110 : 6,
	PATTERN111 : 7
};

},
"QRMath":function(require,module,exports){
var QRMath = {

	glog : function(n) {
	
		if (n < 1) {
			throw new Error("glog(" + n + ")");
		}
		
		return QRMath.LOG_TABLE[n];
	},
	
	gexp : function(n) {
	
		while (n < 0) {
			n += 255;
		}
	
		while (n >= 256) {
			n -= 255;
		}
	
		return QRMath.EXP_TABLE[n];
	},
	
	EXP_TABLE : new Array(256),
	
	LOG_TABLE : new Array(256)

};
	
for (var i = 0; i < 8; i++) {
	QRMath.EXP_TABLE[i] = 1 << i;
}
for (var i = 8; i < 256; i++) {
	QRMath.EXP_TABLE[i] = QRMath.EXP_TABLE[i - 4]
		^ QRMath.EXP_TABLE[i - 5]
		^ QRMath.EXP_TABLE[i - 6]
		^ QRMath.EXP_TABLE[i - 8];
}
for (var i = 0; i < 255; i++) {
	QRMath.LOG_TABLE[QRMath.EXP_TABLE[i] ] = i;
}

module.exports = QRMath;

},
"QRMode":function(require,module,exports){
module.exports = {
    MODE_NUMBER :       1 << 0,
    MODE_ALPHA_NUM :    1 << 1,
    MODE_8BIT_BYTE :    1 << 2,
    MODE_KANJI :        1 << 3
};

},
"QRPolynomial":function(require,module,exports){
var QRMath = require('./QRMath');

function QRPolynomial(num, shift) {
	if (num.length === undefined) {
		throw new Error(num.length + "/" + shift);
	}

	var offset = 0;

	while (offset < num.length && num[offset] === 0) {
		offset++;
	}

	this.num = new Array(num.length - offset + shift);
	for (var i = 0; i < num.length - offset; i++) {
		this.num[i] = num[i + offset];
	}
}

QRPolynomial.prototype = {

	get : function(index) {
		return this.num[index];
	},
	
	getLength : function() {
		return this.num.length;
	},
	
	multiply : function(e) {
	
		var num = new Array(this.getLength() + e.getLength() - 1);
	
		for (var i = 0; i < this.getLength(); i++) {
			for (var j = 0; j < e.getLength(); j++) {
				num[i + j] ^= QRMath.gexp(QRMath.glog(this.get(i) ) + QRMath.glog(e.get(j) ) );
			}
		}
	
		return new QRPolynomial(num, 0);
	},
	
	mod : function(e) {
	
		if (this.getLength() - e.getLength() < 0) {
			return this;
		}
	
		var ratio = QRMath.glog(this.get(0) ) - QRMath.glog(e.get(0) );
	
		var num = new Array(this.getLength() );
		
		for (var i = 0; i < this.getLength(); i++) {
			num[i] = this.get(i);
		}
		
		for (var x = 0; x < e.getLength(); x++) {
			num[x] ^= QRMath.gexp(QRMath.glog(e.get(x) ) + ratio);
		}
	
		// recursive call
		return new QRPolynomial(num, 0).mod(e);
	}
};

module.exports = QRPolynomial;

},
"QRRSBlock":function(require,module,exports){
var QRErrorCorrectLevel = require('./QRErrorCorrectLevel');

function QRRSBlock(totalCount, dataCount) {
	this.totalCount = totalCount;
	this.dataCount  = dataCount;
}

QRRSBlock.RS_BLOCK_TABLE = [

	// L
	// M
	// Q
	// H

	// 1
	[1, 26, 19],
	[1, 26, 16],
	[1, 26, 13],
	[1, 26, 9],
	
	// 2
	[1, 44, 34],
	[1, 44, 28],
	[1, 44, 22],
	[1, 44, 16],

	// 3
	[1, 70, 55],
	[1, 70, 44],
	[2, 35, 17],
	[2, 35, 13],

	// 4		
	[1, 100, 80],
	[2, 50, 32],
	[2, 50, 24],
	[4, 25, 9],
	
	// 5
	[1, 134, 108],
	[2, 67, 43],
	[2, 33, 15, 2, 34, 16],
	[2, 33, 11, 2, 34, 12],
	
	// 6
	[2, 86, 68],
	[4, 43, 27],
	[4, 43, 19],
	[4, 43, 15],
	
	// 7		
	[2, 98, 78],
	[4, 49, 31],
	[2, 32, 14, 4, 33, 15],
	[4, 39, 13, 1, 40, 14],
	
	// 8
	[2, 121, 97],
	[2, 60, 38, 2, 61, 39],
	[4, 40, 18, 2, 41, 19],
	[4, 40, 14, 2, 41, 15],
	
	// 9
	[2, 146, 116],
	[3, 58, 36, 2, 59, 37],
	[4, 36, 16, 4, 37, 17],
	[4, 36, 12, 4, 37, 13],
	
	// 10		
	[2, 86, 68, 2, 87, 69],
	[4, 69, 43, 1, 70, 44],
	[6, 43, 19, 2, 44, 20],
	[6, 43, 15, 2, 44, 16],

	// 11
	[4, 101, 81],
	[1, 80, 50, 4, 81, 51],
	[4, 50, 22, 4, 51, 23],
	[3, 36, 12, 8, 37, 13],

	// 12
	[2, 116, 92, 2, 117, 93],
	[6, 58, 36, 2, 59, 37],
	[4, 46, 20, 6, 47, 21],
	[7, 42, 14, 4, 43, 15],

	// 13
	[4, 133, 107],
	[8, 59, 37, 1, 60, 38],
	[8, 44, 20, 4, 45, 21],
	[12, 33, 11, 4, 34, 12],

	// 14
	[3, 145, 115, 1, 146, 116],
	[4, 64, 40, 5, 65, 41],
	[11, 36, 16, 5, 37, 17],
	[11, 36, 12, 5, 37, 13],

	// 15
	[5, 109, 87, 1, 110, 88],
	[5, 65, 41, 5, 66, 42],
	[5, 54, 24, 7, 55, 25],
	[11, 36, 12],

	// 16
	[5, 122, 98, 1, 123, 99],
	[7, 73, 45, 3, 74, 46],
	[15, 43, 19, 2, 44, 20],
	[3, 45, 15, 13, 46, 16],

	// 17
	[1, 135, 107, 5, 136, 108],
	[10, 74, 46, 1, 75, 47],
	[1, 50, 22, 15, 51, 23],
	[2, 42, 14, 17, 43, 15],

	// 18
	[5, 150, 120, 1, 151, 121],
	[9, 69, 43, 4, 70, 44],
	[17, 50, 22, 1, 51, 23],
	[2, 42, 14, 19, 43, 15],

	// 19
	[3, 141, 113, 4, 142, 114],
	[3, 70, 44, 11, 71, 45],
	[17, 47, 21, 4, 48, 22],
	[9, 39, 13, 16, 40, 14],

	// 20
	[3, 135, 107, 5, 136, 108],
	[3, 67, 41, 13, 68, 42],
	[15, 54, 24, 5, 55, 25],
	[15, 43, 15, 10, 44, 16],

	// 21
	[4, 144, 116, 4, 145, 117],
	[17, 68, 42],
	[17, 50, 22, 6, 51, 23],
	[19, 46, 16, 6, 47, 17],

	// 22
	[2, 139, 111, 7, 140, 112],
	[17, 74, 46],
	[7, 54, 24, 16, 55, 25],
	[34, 37, 13],

	// 23
	[4, 151, 121, 5, 152, 122],
	[4, 75, 47, 14, 76, 48],
	[11, 54, 24, 14, 55, 25],
	[16, 45, 15, 14, 46, 16],

	// 24
	[6, 147, 117, 4, 148, 118],
	[6, 73, 45, 14, 74, 46],
	[11, 54, 24, 16, 55, 25],
	[30, 46, 16, 2, 47, 17],

	// 25
	[8, 132, 106, 4, 133, 107],
	[8, 75, 47, 13, 76, 48],
	[7, 54, 24, 22, 55, 25],
	[22, 45, 15, 13, 46, 16],

	// 26
	[10, 142, 114, 2, 143, 115],
	[19, 74, 46, 4, 75, 47],
	[28, 50, 22, 6, 51, 23],
	[33, 46, 16, 4, 47, 17],

	// 27
	[8, 152, 122, 4, 153, 123],
	[22, 73, 45, 3, 74, 46],
	[8, 53, 23, 26, 54, 24],
	[12, 45, 15, 28, 46, 16],

	// 28
	[3, 147, 117, 10, 148, 118],
	[3, 73, 45, 23, 74, 46],
	[4, 54, 24, 31, 55, 25],
	[11, 45, 15, 31, 46, 16],

	// 29
	[7, 146, 116, 7, 147, 117],
	[21, 73, 45, 7, 74, 46],
	[1, 53, 23, 37, 54, 24],
	[19, 45, 15, 26, 46, 16],

	// 30
	[5, 145, 115, 10, 146, 116],
	[19, 75, 47, 10, 76, 48],
	[15, 54, 24, 25, 55, 25],
	[23, 45, 15, 25, 46, 16],

	// 31
	[13, 145, 115, 3, 146, 116],
	[2, 74, 46, 29, 75, 47],
	[42, 54, 24, 1, 55, 25],
	[23, 45, 15, 28, 46, 16],

	// 32
	[17, 145, 115],
	[10, 74, 46, 23, 75, 47],
	[10, 54, 24, 35, 55, 25],
	[19, 45, 15, 35, 46, 16],

	// 33
	[17, 145, 115, 1, 146, 116],
	[14, 74, 46, 21, 75, 47],
	[29, 54, 24, 19, 55, 25],
	[11, 45, 15, 46, 46, 16],

	// 34
	[13, 145, 115, 6, 146, 116],
	[14, 74, 46, 23, 75, 47],
	[44, 54, 24, 7, 55, 25],
	[59, 46, 16, 1, 47, 17],

	// 35
	[12, 151, 121, 7, 152, 122],
	[12, 75, 47, 26, 76, 48],
	[39, 54, 24, 14, 55, 25],
	[22, 45, 15, 41, 46, 16],

	// 36
	[6, 151, 121, 14, 152, 122],
	[6, 75, 47, 34, 76, 48],
	[46, 54, 24, 10, 55, 25],
	[2, 45, 15, 64, 46, 16],

	// 37
	[17, 152, 122, 4, 153, 123],
	[29, 74, 46, 14, 75, 47],
	[49, 54, 24, 10, 55, 25],
	[24, 45, 15, 46, 46, 16],

	// 38
	[4, 152, 122, 18, 153, 123],
	[13, 74, 46, 32, 75, 47],
	[48, 54, 24, 14, 55, 25],
	[42, 45, 15, 32, 46, 16],

	// 39
	[20, 147, 117, 4, 148, 118],
	[40, 75, 47, 7, 76, 48],
	[43, 54, 24, 22, 55, 25],
	[10, 45, 15, 67, 46, 16],

	// 40
	[19, 148, 118, 6, 149, 119],
	[18, 75, 47, 31, 76, 48],
	[34, 54, 24, 34, 55, 25],
	[20, 45, 15, 61, 46, 16]
];

QRRSBlock.getRSBlocks = function(typeNumber, errorCorrectLevel) {
	
	var rsBlock = QRRSBlock.getRsBlockTable(typeNumber, errorCorrectLevel);
	
	if (rsBlock === undefined) {
		throw new Error("bad rs block @ typeNumber:" + typeNumber + "/errorCorrectLevel:" + errorCorrectLevel);
	}

	var length = rsBlock.length / 3;
	
	var list = [];
	
	for (var i = 0; i < length; i++) {

		var count = rsBlock[i * 3 + 0];
		var totalCount = rsBlock[i * 3 + 1];
		var dataCount  = rsBlock[i * 3 + 2];

		for (var j = 0; j < count; j++) {
			list.push(new QRRSBlock(totalCount, dataCount) );	
		}
	}
	
	return list;
};

QRRSBlock.getRsBlockTable = function(typeNumber, errorCorrectLevel) {

	switch(errorCorrectLevel) {
	case QRErrorCorrectLevel.L :
		return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
	case QRErrorCorrectLevel.M :
		return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
	case QRErrorCorrectLevel.Q :
		return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
	case QRErrorCorrectLevel.H :
		return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
	default :
		return undefined;
	}
};

module.exports = QRRSBlock;

},
"QRUtil":function(require,module,exports){
var QRMode = require('./QRMode');
var QRPolynomial = require('./QRPolynomial');
var QRMath = require('./QRMath');
var QRMaskPattern = require('./QRMaskPattern');

var QRUtil = {

    PATTERN_POSITION_TABLE : [
        [],
        [6, 18],
        [6, 22],
        [6, 26],
        [6, 30],
        [6, 34],
        [6, 22, 38],
        [6, 24, 42],
        [6, 26, 46],
        [6, 28, 50],
        [6, 30, 54],        
        [6, 32, 58],
        [6, 34, 62],
        [6, 26, 46, 66],
        [6, 26, 48, 70],
        [6, 26, 50, 74],
        [6, 30, 54, 78],
        [6, 30, 56, 82],
        [6, 30, 58, 86],
        [6, 34, 62, 90],
        [6, 28, 50, 72, 94],
        [6, 26, 50, 74, 98],
        [6, 30, 54, 78, 102],
        [6, 28, 54, 80, 106],
        [6, 32, 58, 84, 110],
        [6, 30, 58, 86, 114],
        [6, 34, 62, 90, 118],
        [6, 26, 50, 74, 98, 122],
        [6, 30, 54, 78, 102, 126],
        [6, 26, 52, 78, 104, 130],
        [6, 30, 56, 82, 108, 134],
        [6, 34, 60, 86, 112, 138],
        [6, 30, 58, 86, 114, 142],
        [6, 34, 62, 90, 118, 146],
        [6, 30, 54, 78, 102, 126, 150],
        [6, 24, 50, 76, 102, 128, 154],
        [6, 28, 54, 80, 106, 132, 158],
        [6, 32, 58, 84, 110, 136, 162],
        [6, 26, 54, 82, 110, 138, 166],
        [6, 30, 58, 86, 114, 142, 170]
    ],

    G15 : (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0),
    G18 : (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0),
    G15_MASK : (1 << 14) | (1 << 12) | (1 << 10)    | (1 << 4) | (1 << 1),

    getBCHTypeInfo : function(data) {
        var d = data << 10;
        while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15) >= 0) {
            d ^= (QRUtil.G15 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15) ) );    
        }
        return ( (data << 10) | d) ^ QRUtil.G15_MASK;
    },

    getBCHTypeNumber : function(data) {
        var d = data << 12;
        while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18) >= 0) {
            d ^= (QRUtil.G18 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18) ) );    
        }
        return (data << 12) | d;
    },

    getBCHDigit : function(data) {

        var digit = 0;

        while (data !== 0) {
            digit++;
            data >>>= 1;
        }

        return digit;
    },

    getPatternPosition : function(typeNumber) {
        return QRUtil.PATTERN_POSITION_TABLE[typeNumber - 1];
    },

    getMask : function(maskPattern, i, j) {
        
        switch (maskPattern) {
            
        case QRMaskPattern.PATTERN000 : return (i + j) % 2 === 0;
        case QRMaskPattern.PATTERN001 : return i % 2 === 0;
        case QRMaskPattern.PATTERN010 : return j % 3 === 0;
        case QRMaskPattern.PATTERN011 : return (i + j) % 3 === 0;
        case QRMaskPattern.PATTERN100 : return (Math.floor(i / 2) + Math.floor(j / 3) ) % 2 === 0;
        case QRMaskPattern.PATTERN101 : return (i * j) % 2 + (i * j) % 3 === 0;
        case QRMaskPattern.PATTERN110 : return ( (i * j) % 2 + (i * j) % 3) % 2 === 0;
        case QRMaskPattern.PATTERN111 : return ( (i * j) % 3 + (i + j) % 2) % 2 === 0;

        default :
            throw new Error("bad maskPattern:" + maskPattern);
        }
    },

    getErrorCorrectPolynomial : function(errorCorrectLength) {

        var a = new QRPolynomial([1], 0);

        for (var i = 0; i < errorCorrectLength; i++) {
            a = a.multiply(new QRPolynomial([1, QRMath.gexp(i)], 0) );
        }

        return a;
    },

    getLengthInBits : function(mode, type) {

        if (1 <= type && type < 10) {

            // 1 - 9

            switch(mode) {
            case QRMode.MODE_NUMBER     : return 10;
            case QRMode.MODE_ALPHA_NUM  : return 9;
            case QRMode.MODE_8BIT_BYTE  : return 8;
            case QRMode.MODE_KANJI      : return 8;
            default :
                throw new Error("mode:" + mode);
            }

        } else if (type < 27) {

            // 10 - 26

            switch(mode) {
            case QRMode.MODE_NUMBER     : return 12;
            case QRMode.MODE_ALPHA_NUM  : return 11;
            case QRMode.MODE_8BIT_BYTE  : return 16;
            case QRMode.MODE_KANJI      : return 10;
            default :
                throw new Error("mode:" + mode);
            }

        } else if (type < 41) {

            // 27 - 40

            switch(mode) {
            case QRMode.MODE_NUMBER     : return 14;
            case QRMode.MODE_ALPHA_NUM  : return 13;
            case QRMode.MODE_8BIT_BYTE  : return 16;
            case QRMode.MODE_KANJI      : return 12;
            default :
                throw new Error("mode:" + mode);
            }

        } else {
            throw new Error("type:" + type);
        }
    },

    getLostPoint : function(qrCode) {
        
        var moduleCount = qrCode.getModuleCount();
        var lostPoint = 0;
        var row = 0; 
        var col = 0;

        
        // LEVEL1
        
        for (row = 0; row < moduleCount; row++) {

            for (col = 0; col < moduleCount; col++) {

                var sameCount = 0;
                var dark = qrCode.isDark(row, col);

                for (var r = -1; r <= 1; r++) {

                    if (row + r < 0 || moduleCount <= row + r) {
                        continue;
                    }

                    for (var c = -1; c <= 1; c++) {

                        if (col + c < 0 || moduleCount <= col + c) {
                            continue;
                        }

                        if (r === 0 && c === 0) {
                            continue;
                        }

                        if (dark === qrCode.isDark(row + r, col + c) ) {
                            sameCount++;
                        }
                    }
                }

                if (sameCount > 5) {
                    lostPoint += (3 + sameCount - 5);
                }
            }
        }

        // LEVEL2

        for (row = 0; row < moduleCount - 1; row++) {
            for (col = 0; col < moduleCount - 1; col++) {
                var count = 0;
                if (qrCode.isDark(row,     col    ) ) count++;
                if (qrCode.isDark(row + 1, col    ) ) count++;
                if (qrCode.isDark(row,     col + 1) ) count++;
                if (qrCode.isDark(row + 1, col + 1) ) count++;
                if (count === 0 || count === 4) {
                    lostPoint += 3;
                }
            }
        }

        // LEVEL3

        for (row = 0; row < moduleCount; row++) {
            for (col = 0; col < moduleCount - 6; col++) {
                if (qrCode.isDark(row, col) && 
                        !qrCode.isDark(row, col + 1) && 
                         qrCode.isDark(row, col + 2) && 
                         qrCode.isDark(row, col + 3) && 
                         qrCode.isDark(row, col + 4) && 
                        !qrCode.isDark(row, col + 5) && 
                         qrCode.isDark(row, col + 6) ) {
                    lostPoint += 40;
                }
            }
        }

        for (col = 0; col < moduleCount; col++) {
            for (row = 0; row < moduleCount - 6; row++) {
                if (qrCode.isDark(row, col) &&
                        !qrCode.isDark(row + 1, col) &&
                         qrCode.isDark(row + 2, col) &&
                         qrCode.isDark(row + 3, col) &&
                         qrCode.isDark(row + 4, col) &&
                        !qrCode.isDark(row + 5, col) &&
                         qrCode.isDark(row + 6, col) ) {
                    lostPoint += 40;
                }
            }
        }

        // LEVEL4
        
        var darkCount = 0;

        for (col = 0; col < moduleCount; col++) {
            for (row = 0; row < moduleCount; row++) {
                if (qrCode.isDark(row, col) ) {
                    darkCount++;
                }
            }
        }
        
        var ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
        lostPoint += ratio * 10;

        return lostPoint;       
    }

};

module.exports = QRUtil;

},
"index":function(require,module,exports){
//---------------------------------------------------------------------
// QRCode for JavaScript
//
// Copyright (c) 2009 Kazuhiko Arase
//
// URL: http://www.d-project.com/
//
// Licensed under the MIT license:
//   http://www.opensource.org/licenses/mit-license.php
//
// The word "QR Code" is registered trademark of 
// DENSO WAVE INCORPORATED
//   http://www.denso-wave.com/qrcode/faqpatent-e.html
//
//---------------------------------------------------------------------
// Modified to work in node for this project (and some refactoring)
//---------------------------------------------------------------------

var QR8bitByte = require('./QR8bitByte');
var QRUtil = require('./QRUtil');
var QRPolynomial = require('./QRPolynomial');
var QRRSBlock = require('./QRRSBlock');
var QRBitBuffer = require('./QRBitBuffer');

function QRCode(typeNumber, errorCorrectLevel) {
	this.typeNumber = typeNumber;
	this.errorCorrectLevel = errorCorrectLevel;
	this.modules = null;
	this.moduleCount = 0;
	this.dataCache = null;
	this.dataList = [];
}

QRCode.prototype = {
	
	addData : function(data) {
		var newData = new QR8bitByte(data);
		this.dataList.push(newData);
		this.dataCache = null;
	},
	
	isDark : function(row, col) {
		if (row < 0 || this.moduleCount <= row || col < 0 || this.moduleCount <= col) {
			throw new Error(row + "," + col);
		}
		return this.modules[row][col];
	},

	getModuleCount : function() {
		return this.moduleCount;
	},
	
	make : function() {
		// Calculate automatically typeNumber if provided is < 1
		if (this.typeNumber < 1 ){
			var typeNumber = 1;
			for (typeNumber = 1; typeNumber < 40; typeNumber++) {
				var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, this.errorCorrectLevel);

				var buffer = new QRBitBuffer();
				var totalDataCount = 0;
				for (var i = 0; i < rsBlocks.length; i++) {
					totalDataCount += rsBlocks[i].dataCount;
				}

				for (var x = 0; x < this.dataList.length; x++) {
					var data = this.dataList[x];
					buffer.put(data.mode, 4);
					buffer.put(data.getLength(), QRUtil.getLengthInBits(data.mode, typeNumber) );
					data.write(buffer);
				}
				if (buffer.getLengthInBits() <= totalDataCount * 8)
					break;
			}
			this.typeNumber = typeNumber;
		}
		this.makeImpl(false, this.getBestMaskPattern() );
	},
	
	makeImpl : function(test, maskPattern) {
		
		this.moduleCount = this.typeNumber * 4 + 17;
		this.modules = new Array(this.moduleCount);
		
		for (var row = 0; row < this.moduleCount; row++) {
			
			this.modules[row] = new Array(this.moduleCount);
			
			for (var col = 0; col < this.moduleCount; col++) {
				this.modules[row][col] = null;//(col + row) % 3;
			}
		}
	
		this.setupPositionProbePattern(0, 0);
		this.setupPositionProbePattern(this.moduleCount - 7, 0);
		this.setupPositionProbePattern(0, this.moduleCount - 7);
		this.setupPositionAdjustPattern();
		this.setupTimingPattern();
		this.setupTypeInfo(test, maskPattern);
		
		if (this.typeNumber >= 7) {
			this.setupTypeNumber(test);
		}
	
		if (this.dataCache === null) {
			this.dataCache = QRCode.createData(this.typeNumber, this.errorCorrectLevel, this.dataList);
		}
	
		this.mapData(this.dataCache, maskPattern);
	},

	setupPositionProbePattern : function(row, col)  {
		
		for (var r = -1; r <= 7; r++) {
			
			if (row + r <= -1 || this.moduleCount <= row + r) continue;
			
			for (var c = -1; c <= 7; c++) {
				
				if (col + c <= -1 || this.moduleCount <= col + c) continue;
				
				if ( (0 <= r && r <= 6 && (c === 0 || c === 6) ) || 
                     (0 <= c && c <= 6 && (r === 0 || r === 6) ) || 
                     (2 <= r && r <= 4 && 2 <= c && c <= 4) ) {
					this.modules[row + r][col + c] = true;
				} else {
					this.modules[row + r][col + c] = false;
				}
			}		
		}		
	},
	
	getBestMaskPattern : function() {
	
		var minLostPoint = 0;
		var pattern = 0;
	
		for (var i = 0; i < 8; i++) {
			
			this.makeImpl(true, i);
	
			var lostPoint = QRUtil.getLostPoint(this);
	
			if (i === 0 || minLostPoint >  lostPoint) {
				minLostPoint = lostPoint;
				pattern = i;
			}
		}
	
		return pattern;
	},
	
	createMovieClip : function(target_mc, instance_name, depth) {
	
		var qr_mc = target_mc.createEmptyMovieClip(instance_name, depth);
		var cs = 1;
	
		this.make();

		for (var row = 0; row < this.modules.length; row++) {
			
			var y = row * cs;
			
			for (var col = 0; col < this.modules[row].length; col++) {
	
				var x = col * cs;
				var dark = this.modules[row][col];
			
				if (dark) {
					qr_mc.beginFill(0, 100);
					qr_mc.moveTo(x, y);
					qr_mc.lineTo(x + cs, y);
					qr_mc.lineTo(x + cs, y + cs);
					qr_mc.lineTo(x, y + cs);
					qr_mc.endFill();
				}
			}
		}
		
		return qr_mc;
	},

	setupTimingPattern : function() {
		
		for (var r = 8; r < this.moduleCount - 8; r++) {
			if (this.modules[r][6] !== null) {
				continue;
			}
			this.modules[r][6] = (r % 2 === 0);
		}
	
		for (var c = 8; c < this.moduleCount - 8; c++) {
			if (this.modules[6][c] !== null) {
				continue;
			}
			this.modules[6][c] = (c % 2 === 0);
		}
	},
	
	setupPositionAdjustPattern : function() {
	
		var pos = QRUtil.getPatternPosition(this.typeNumber);
		
		for (var i = 0; i < pos.length; i++) {
		
			for (var j = 0; j < pos.length; j++) {
			
				var row = pos[i];
				var col = pos[j];
				
				if (this.modules[row][col] !== null) {
					continue;
				}
				
				for (var r = -2; r <= 2; r++) {
				
					for (var c = -2; c <= 2; c++) {
					
						if (Math.abs(r) === 2 || 
                            Math.abs(c) === 2 ||
                            (r === 0 && c === 0) ) {
							this.modules[row + r][col + c] = true;
						} else {
							this.modules[row + r][col + c] = false;
						}
					}
				}
			}
		}
	},
	
	setupTypeNumber : function(test) {
	
		var bits = QRUtil.getBCHTypeNumber(this.typeNumber);
        var mod;
	
		for (var i = 0; i < 18; i++) {
			mod = (!test && ( (bits >> i) & 1) === 1);
			this.modules[Math.floor(i / 3)][i % 3 + this.moduleCount - 8 - 3] = mod;
		}
	
		for (var x = 0; x < 18; x++) {
			mod = (!test && ( (bits >> x) & 1) === 1);
			this.modules[x % 3 + this.moduleCount - 8 - 3][Math.floor(x / 3)] = mod;
		}
	},
	
	setupTypeInfo : function(test, maskPattern) {
	
		var data = (this.errorCorrectLevel << 3) | maskPattern;
		var bits = QRUtil.getBCHTypeInfo(data);
        var mod;
	
		// vertical		
		for (var v = 0; v < 15; v++) {
	
			mod = (!test && ( (bits >> v) & 1) === 1);
	
			if (v < 6) {
				this.modules[v][8] = mod;
			} else if (v < 8) {
				this.modules[v + 1][8] = mod;
			} else {
				this.modules[this.moduleCount - 15 + v][8] = mod;
			}
		}
	
		// horizontal
		for (var h = 0; h < 15; h++) {
	
			mod = (!test && ( (bits >> h) & 1) === 1);
			
			if (h < 8) {
				this.modules[8][this.moduleCount - h - 1] = mod;
			} else if (h < 9) {
				this.modules[8][15 - h - 1 + 1] = mod;
			} else {
				this.modules[8][15 - h - 1] = mod;
			}
		}
	
		// fixed module
		this.modules[this.moduleCount - 8][8] = (!test);
	
	},
	
	mapData : function(data, maskPattern) {
		
		var inc = -1;
		var row = this.moduleCount - 1;
		var bitIndex = 7;
		var byteIndex = 0;
		
		for (var col = this.moduleCount - 1; col > 0; col -= 2) {
	
			if (col === 6) col--;
	
			while (true) {
	
				for (var c = 0; c < 2; c++) {
					
					if (this.modules[row][col - c] === null) {
						
						var dark = false;
	
						if (byteIndex < data.length) {
							dark = ( ( (data[byteIndex] >>> bitIndex) & 1) === 1);
						}
	
						var mask = QRUtil.getMask(maskPattern, row, col - c);
	
						if (mask) {
							dark = !dark;
						}
						
						this.modules[row][col - c] = dark;
						bitIndex--;
	
						if (bitIndex === -1) {
							byteIndex++;
							bitIndex = 7;
						}
					}
				}
								
				row += inc;
	
				if (row < 0 || this.moduleCount <= row) {
					row -= inc;
					inc = -inc;
					break;
				}
			}
		}
		
	}

};

QRCode.PAD0 = 0xEC;
QRCode.PAD1 = 0x11;

QRCode.createData = function(typeNumber, errorCorrectLevel, dataList) {
	
	var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectLevel);
	
	var buffer = new QRBitBuffer();
	
	for (var i = 0; i < dataList.length; i++) {
		var data = dataList[i];
		buffer.put(data.mode, 4);
		buffer.put(data.getLength(), QRUtil.getLengthInBits(data.mode, typeNumber) );
		data.write(buffer);
	}

	// calc num max data.
	var totalDataCount = 0;
	for (var x = 0; x < rsBlocks.length; x++) {
		totalDataCount += rsBlocks[x].dataCount;
	}

	if (buffer.getLengthInBits() > totalDataCount * 8) {
		throw new Error("code length overflow. (" + 
            buffer.getLengthInBits() + 
            ">" +  
            totalDataCount * 8 + 
            ")");
	}

	// end code
	if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
		buffer.put(0, 4);
	}

	// padding
	while (buffer.getLengthInBits() % 8 !== 0) {
		buffer.putBit(false);
	}

	// padding
	while (true) {
		
		if (buffer.getLengthInBits() >= totalDataCount * 8) {
			break;
		}
		buffer.put(QRCode.PAD0, 8);
		
		if (buffer.getLengthInBits() >= totalDataCount * 8) {
			break;
		}
		buffer.put(QRCode.PAD1, 8);
	}

	return QRCode.createBytes(buffer, rsBlocks);
};

QRCode.createBytes = function(buffer, rsBlocks) {

	var offset = 0;
	
	var maxDcCount = 0;
	var maxEcCount = 0;
	
	var dcdata = new Array(rsBlocks.length);
	var ecdata = new Array(rsBlocks.length);
	
	for (var r = 0; r < rsBlocks.length; r++) {

		var dcCount = rsBlocks[r].dataCount;
		var ecCount = rsBlocks[r].totalCount - dcCount;

		maxDcCount = Math.max(maxDcCount, dcCount);
		maxEcCount = Math.max(maxEcCount, ecCount);
		
		dcdata[r] = new Array(dcCount);
		
		for (var i = 0; i < dcdata[r].length; i++) {
			dcdata[r][i] = 0xff & buffer.buffer[i + offset];
		}
		offset += dcCount;
		
		var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
		var rawPoly = new QRPolynomial(dcdata[r], rsPoly.getLength() - 1);

		var modPoly = rawPoly.mod(rsPoly);
		ecdata[r] = new Array(rsPoly.getLength() - 1);
		for (var x = 0; x < ecdata[r].length; x++) {
            var modIndex = x + modPoly.getLength() - ecdata[r].length;
			ecdata[r][x] = (modIndex >= 0)? modPoly.get(modIndex) : 0;
		}

	}
	
	var totalCodeCount = 0;
	for (var y = 0; y < rsBlocks.length; y++) {
		totalCodeCount += rsBlocks[y].totalCount;
	}

	var data = new Array(totalCodeCount);
	var index = 0;

	for (var z = 0; z < maxDcCount; z++) {
		for (var s = 0; s < rsBlocks.length; s++) {
			if (z < dcdata[s].length) {
				data[index++] = dcdata[s][z];
			}
		}
	}

	for (var xx = 0; xx < maxEcCount; xx++) {
		for (var t = 0; t < rsBlocks.length; t++) {
			if (xx < ecdata[t].length) {
				data[index++] = ecdata[t][xx];
			}
		}
	}

	return data;

};

module.exports = QRCode;

}},C={};
function req(id){id=String(id||'').replace(/^\.\//,'');if(C[id])return C[id].exports;if(!M[id])throw new Error('QR module not found: '+id);const m={exports:{}};C[id]=m;M[id](req,m,m.exports);return m.exports;}
g.SignWellQRCore=Object.freeze({QRCode:req('index'),QRErrorCorrectLevel:req('QRErrorCorrectLevel')});
})(window);
/* SIGN WELL Article Identity System · Presentation Layer · v24.8.0 */
(function(g){'use strict';
const DOC=document;
const SITE=(()=>{const reservation=g.SIGNWELL_DOMAIN_RESERVATION||{};if(reservation.customDomainEnabled===true&&reservation.currentPublicBase){try{return new URL(reservation.currentPublicBase,location.href).href}catch(_){}}const scripts=Array.from(DOC.scripts||[]),self=DOC.currentScript||scripts.find(x=>/article-identity-v24\.8\.0\.js/i.test(String(x.src||'')));if(self?.src){try{return new URL('../../',self.src).href}catch(_){}}try{return new URL(String(reservation.currentPublicBase||'https://980510linz.github.io/signwell.com/')).href}catch(_){return 'https://980510linz.github.io/signwell.com/'}})();
const articlePublicUrl=(slug='')=>{const u=new URL('index.html',SITE);u.searchParams.set('article',String(slug||''));return u.href};
const tracePublicUrl=(id='')=>new URL('trace/'+encodeURIComponent(String(id||''))+'/',SITE).href;
const E=(s='')=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const X=(s='')=>E(s).replace(/`/g,'&#096;');
const LABELS=Object.freeze({CURRENT:'CURRENT',UPDATED:'UPDATED','NEEDS REVIEW':'NEEDS REVIEW',OUTDATED:'OUTDATED',DEPRECATED:'DEPRECATED',AI_GENERATED:'AI GENERATED',AI_ASSISTED:'AI ASSISTED',HUMAN_REVIEWED:'HUMAN REVIEWED',PHYSICIAN_REVIEWED:'PHYSICIAN REVIEWED',LEGACY_UNVERIFIED:'LEGACY · REVIEW UNVERIFIED'});
const DATE=(v)=>{if(!v)return'—';try{return new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v))}catch(_){return String(v).slice(0,10)||'—'}};
const traceUrl=(x)=>tracePublicUrl(String(x?.article_id||x?.articleId||''));
const articleId=(a)=>String(a?.article_id||a?.articleId||a?.identity?.article_id||'').trim();
const hasIdentity=(a)=>/^SW-A-\d{4}-\d{6}$/.test(articleId(a));
const getIdentity=(a)=>{const i=a?.identity&&typeof a.identity==='object'?a.identity:{};return {...i,article_id:String(i.article_id||a?.article_id||a?.articleId||''),current_version:String(i.current_version||a?.current_version||a?.articleVersion||''),revision_seq:Number(i.revision_seq||a?.revision_seq||0),article_status:String(i.article_status||a?.article_status||a?.articleStatus||''),review_status:Array.isArray(i.review_status)?i.review_status:(Array.isArray(a?.review_status)?a.review_status:(Array.isArray(a?.reviewStatus)?a.reviewStatus:[])),content_hash:String(i.content_hash||a?.content_hash||a?.contentHash||''),trace_url:String(i.trace_url||a?.trace_url||a?.traceUrl||''),article_url:String(i.article_url||''),title:String(i.title||a?.title||''),author:i.author||{name:String(a?.publisherName||a?.authorName||a?.author||'SIGN WELL 編輯部')},published_at:String(i.published_at||a?.publishedAt||''),updated_at:String(i.updated_at||a?.updatedAt||''),last_verified_at:String(i.last_verified_at||a?.last_verified_at||''),external_references:Number(i.external_references ?? ((a?.references||[]).length||0)),internal_references:Number(i.internal_references||0),referenced_by:Number(i.referenced_by||0),citations:Array.isArray(i.citations)?i.citations:[],referenced_by_items:Array.isArray(i.referenced_by_items)?i.referenced_by_items:[],version_history:Array.isArray(i.version_history)?i.version_history:[]};};
function backendBase(){const n=g.SIGNWELL_NEWSLETTER||{},a=g.SIGNWELL_ANALYTICS||{};return String(n.endpoint||a.endpoint||'').replace(/\/+$/,'')}
function gas(action,payload={},timeoutMs=18000){return new Promise((resolve,reject)=>{const endpoint=backendBase();if(!/^https:\/\//i.test(endpoint))return reject(new Error('BACKEND_DISABLED'));const requestId='swid_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2),iframe=DOC.createElement('iframe'),form=DOC.createElement('form'),frameName='swidframe_'+requestId;iframe.name=frameName;iframe.hidden=true;iframe.tabIndex=-1;iframe.setAttribute('aria-hidden','true');form.method='POST';form.action=endpoint;form.target=frameName;form.hidden=true;const add=(n,v)=>{const x=DOC.createElement('input');x.type='hidden';x.name=n;x.value=String(v??'');form.appendChild(x)};add('transport','iframe');add('requestId',requestId);add('returnOrigin',location.origin);add('action',action);add('payload',JSON.stringify(payload||{}));let timer;const cleanup=()=>{clearTimeout(timer);removeEventListener('message',onMessage);form.remove();setTimeout(()=>iframe.remove(),30)};const onMessage=e=>{const d=e.data;if(!d||d.source!=='SIGNWELL_GAS'||d.requestId!==requestId)return;cleanup();d.ok?resolve(d.data||{}):reject(new Error(d.error||'TRACE_UNAVAILABLE'))};addEventListener('message',onMessage);timer=setTimeout(()=>{cleanup();reject(new Error('TRACE_TIMEOUT'))},timeoutMs);DOC.body.append(iframe,form);form.submit()})}
async function fetchTrace(id){if(!/^SW-A-\d{4}-\d{6}$/.test(String(id||'')))throw new Error('INVALID_ARTICLE_ID');return gas('article.trace',{articleId:id},18000)}
function stable(v){if(v===null||v===undefined)return v;if(Array.isArray(v))return v.map(stable);if(typeof v==='object'){const o={};Object.keys(v).sort().forEach(k=>o[k]=stable(v[k]));return o}if(typeof v==='string'){try{return v.normalize('NFC')}catch(_){return v}}return v}
function canonicalText(html=''){let s=String(html||'');s=s.replace(/<!--[\s\S]*?-->/g,' ').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/\s(?:class|style|id|loading|decoding|fetchpriority|data-[\w:-]+|aria-[\w:-]+)=(?:"[^"]*"|'[^']*')/gi,'').replace(/>\s+</g,'><').replace(/\s+/g,' ').trim();try{s=s.normalize('NFC')}catch(_){}return s}
function refCanonical(r={}){return{type:String(r.type||''),title:String(r.title||''),url:String(r.url||''),pmid:String(r.pmid||''),doi:String(r.doi||''),agency:String(r.agency||''),outlet:String(r.outlet||r.publisher||''),publishedAt:String(r.publishedAt||r.pubdate||'')}}
function internalCandidates(a={}){const raw=[];(Array.isArray(a.internalReferences)?a.internalReferences:[]).forEach(x=>raw.push(x));(Array.isArray(a.internal_references)?a.internal_references:[]).forEach(x=>raw.push(x));return raw.map(x=>typeof x==='string'?{articleId:x}:x).filter(Boolean)}
function canonicalSnapshot(a={}){const authorId=String(a.publisherId||a.authorId||''),authorName=String(a.publisherName||a.authorName||a.author||'SIGN WELL 編輯部');return stable({schema:'sw-content-v1',title:String(a.title||'').trim(),subtitle:String(a.subtitle||a.excerpt||'').trim(),body:canonicalText(a.content||''),references:(Array.isArray(a.references)?a.references:[]).map(refCanonical),internalReferences:internalCandidates(a).map(x=>({articleId:String(x.articleId||x.article_id||x.target_id||''),targetVersion:String(x.targetVersion||x.target_version||''),context:String(x.context||x.citation_context||''),primaryEvidenceIds:Array.isArray(x.primaryEvidenceIds)?x.primaryEvidenceIds.map(String).slice(0,12):[]})),evidenceCards:(Array.isArray(a.evidenceCards)?a.evidenceCards:[]).map(c=>({claim:String(c&&c.claim||''),level:String(c&&c.level||c&&c.evidenceLevel||''),source:String(c&&c.source||''),boundary:String(c&&c.boundary||'')})),verdict:a.signWellVerdict||null,author:{id:authorId,name:authorName}})}
async function localHash(a){if(!g.crypto?.subtle)return'';const raw=new TextEncoder().encode(JSON.stringify(canonicalSnapshot(a))),buf=await crypto.subtle.digest('SHA-256',raw);return'sha256:'+Array.from(new Uint8Array(buf),b=>b.toString(16).padStart(2,'0')).join('')}
function qrMatrix(text){const core=g.SignWellQRCore;if(!core?.QRCode)return null;const qr=new core.QRCode(-1,core.QRErrorCorrectLevel.M);qr.addData(String(text||''));qr.make();return qr.modules}
function qrSvg(text,size=176,pad=4){const m=qrMatrix(text);if(!m)return`<div class="sw-id-qr-fallback">${E(text)}</div>`;const n=m.length,total=n+pad*2,cell=size/total;let path='';for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(m[y][x])path+=`M${((x+pad)*cell).toFixed(3)} ${((y+pad)*cell).toFixed(3)}h${cell.toFixed(3)}v${cell.toFixed(3)}h-${cell.toFixed(3)}z`;return`<svg class="sw-id-qr-svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Trace URL QR Code"><rect width="${size}" height="${size}" rx="18" fill="#f7f3e8"/><path d="${path}" fill="#182e2a"/></svg>`}
function qrDrawCanvas(ctx,text,x,y,size){const m=qrMatrix(text);if(!m)return false;const pad=4,n=m.length,total=n+pad*2,c=size/total;ctx.fillStyle='#f7f3e8';ctx.fillRect(x,y,size,size);ctx.fillStyle='#182e2a';for(let r=0;r<n;r++)for(let col=0;col<n;col++)if(m[r][col])ctx.fillRect(x+(col+pad)*c,y+(r+pad)*c,Math.ceil(c+.2),Math.ceil(c+.2));return true}
function reviewChips(i){const arr=Array.isArray(i.review_status)?i.review_status:[];return arr.map(s=>`<span class="sw-id-chip sw-id-review">${E(LABELS[s]||s)}</span>`).join('')||'<span class="sw-id-chip">REVIEW NOT ATTESTED</span>'}
function statusChip(i){const s=String(i.article_status||'NEEDS REVIEW');return`<span class="sw-id-chip sw-id-status" data-status="${E(s)}">${E(LABELS[s]||s)}</span>`}
function compactHash(h){const s=String(h||'').replace(/^sha256:/,'');return s?s.slice(0,8)+'…':'—'}
function cardHTML(identity,article={}){const i={...getIdentity(article),...identity};return`<div class="sw-id-scene" data-sw-id-tier="pro"><div class="sw-id-tilt"><div class="sw-id-card" role="group" aria-label="SIGN WELL 文章身分證"><section class="sw-id-face sw-id-front" aria-hidden="false"><div class="sw-id-glass"></div><div class="sw-id-depth sw-id-brand"><b>SIGN WELL</b><span>ARTICLE IDENTITY</span></div><div class="sw-id-depth sw-id-title">${E(i.title||article.title||'未命名文章')}</div><div class="sw-id-depth sw-id-number">${E(i.article_id)}</div><div class="sw-id-depth sw-id-grid"><span>Author<b>${E(i.author?.name||'SIGN WELL 編輯部')}</b></span><span>Published<b>${E(DATE(i.published_at))}</b></span><span>Updated<b>${E(DATE(i.updated_at))}</b></span><span>Version<b>${E(i.current_version||'—')}</b></span></div><div class="sw-id-depth sw-id-chips">${statusChip(i)}${reviewChips(i)}</div><div class="sw-id-depth sw-id-foot">TRACEABLE MEDICAL CONTENT</div><div class="sw-id-specular" aria-hidden="true"></div><div class="sw-id-rim" aria-hidden="true"></div></section><section class="sw-id-face sw-id-back" aria-hidden="true"><div class="sw-id-glass"></div><div class="sw-id-back-seal" aria-hidden="true"><span>SW</span><b>SIGN WELL</b></div><div class="sw-id-depth sw-id-back-head"><b>TRACE &amp; PROVENANCE</b><span>${E(i.article_id)}</span></div><div class="sw-id-depth sw-id-prov"><span>External sources<b>${Number(i.external_references||0)}</b></span><span>Internal sources<b>${Number(i.internal_references||0)}</b></span><span>Referenced by<b>${Number(i.referenced_by||0)}</b></span><span>Latest version<b>${E(i.current_version||'—')}</b></span><span>Last validation<b>${E(DATE(i.last_verified_at))}</b></span><span>SHA-256<b>${E(compactHash(i.content_hash))}</b></span></div><div class="sw-id-depth sw-id-qr">${qrSvg(traceUrl(i),142,4)}</div><div class="sw-id-specular" aria-hidden="true"></div><div class="sw-id-rim" aria-hidden="true"></div></section></div></div></div>`}
function tier(){const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches,bodyLite=DOC.body?.classList.contains('lite')||DOC.body?.classList.contains('perf-lite'),cores=Number(navigator.hardwareConcurrency||4),mem=Number(navigator.deviceMemory||4),fine=matchMedia('(hover:hover) and (pointer:fine)').matches;if(reduced||bodyLite||cores<=4||mem<4)return'lite';if(fine&&cores>=8&&mem>=8)return'ultra';return'pro'}
function bindTilt(root){const scene=root.querySelector('.sw-id-scene'),tiltEl=root.querySelector('.sw-id-tilt'),card=root.querySelector('.sw-id-card');if(!scene||!tiltEl||!card)return;const mode=tier();scene.dataset.swIdTier=mode;if(mode==='lite'||matchMedia('(prefers-reduced-motion:reduce)').matches)return;let tx=0,ty=0,x=0,y=0,vx=0,vy=0,raf=0;const response=n=>.7*Math.sin(n*Math.PI/2)+.3*n*n*n;const frame=()=>{vx=(vx+(tx-x)*.13)*.78;vy=(vy+(ty-y)*.13)*.78;x+=vx;y+=vy;tiltEl.style.transform=`rotateX(${x.toFixed(3)}deg) rotateY(${y.toFixed(3)}deg) scale3d(1.006,1.006,1.006)`;if(Math.abs(tx-x)+Math.abs(ty-y)+Math.abs(vx)+Math.abs(vy)>.01)raf=requestAnimationFrame(frame);else raf=0};const move=e=>{const r=scene.getBoundingClientRect(),nx=Math.max(-1,Math.min(1,((e.clientX-r.left)/r.width-.5)*2)),ny=Math.max(-1,Math.min(1,((e.clientY-r.top)/r.height-.5)*2));tx=response(-ny)*3.5;ty=response(nx)*4;scene.style.setProperty('--sw-id-light-x',((nx+1)*50).toFixed(1)+'%');scene.style.setProperty('--sw-id-light-y',((ny+1)*50).toFixed(1)+'%');scene.style.setProperty('--sw-id-light-a',String(.13+Math.min(.08,Math.abs(vx+vy)*.02)));if(!raf)raf=requestAnimationFrame(frame)};const leave=()=>{tx=ty=0;scene.style.setProperty('--sw-id-light-x','50%');scene.style.setProperty('--sw-id-light-y','18%');if(!raf)raf=requestAnimationFrame(frame)};scene.addEventListener('pointermove',move,{passive:true});scene.addEventListener('pointerleave',leave,{passive:true});}
function setFlip(root,back){const card=root.querySelector('.sw-id-card');if(!card)return;card.classList.toggle('is-back',!!back);root.querySelector('.sw-id-front')?.setAttribute('aria-hidden',back?'true':'false');root.querySelector('.sw-id-back')?.setAttribute('aria-hidden',back?'false':'true');root.querySelector('[data-sw-id-flip]')?.setAttribute('aria-pressed',back?'true':'false');}
async function copyText(v){try{await navigator.clipboard.writeText(String(v));return true}catch(_){const t=DOC.createElement('textarea');t.value=String(v);t.style.position='fixed';t.style.opacity='0';DOC.body.appendChild(t);t.select();let ok=false;try{ok=DOC.execCommand('copy')}catch(_){ }t.remove();return ok}}
function filename(i){return`SIGN-WELL-${String(i.article_id||'article').replace(/[^A-Za-z0-9-]/g,'-')}-v${String(i.current_version||'1.0').replace(/[^0-9.]/g,'')}.png`}
function wrapLines(ctx,text,maxWidth,maxLines=3){const chars=Array.from(String(text||'')),lines=[];let line='';for(const ch of chars){const test=line+ch;if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=ch;if(lines.length>=maxLines-1)break}else line=test}if(line&&lines.length<maxLines)lines.push(line);if(chars.join('').length>lines.join('').length)lines[lines.length-1]=lines[lines.length-1].replace(/[，。；、\s]+$/,'')+'…';return lines}
async function shareCardBlob(identity,article={}){const i={...getIdentity(article),...identity},c=DOC.createElement('canvas');c.width=1200;c.height=630;const ctx=c.getContext('2d');ctx.fillStyle='#f5f0e5';ctx.fillRect(0,0,1200,630);const grd=ctx.createLinearGradient(0,0,1200,630);grd.addColorStop(0,'rgba(62,86,76,.11)');grd.addColorStop(.55,'rgba(105,126,150,.07)');grd.addColorStop(1,'rgba(160,126,91,.08)');ctx.fillStyle=grd;ctx.fillRect(0,0,1200,630);ctx.strokeStyle='rgba(32,52,48,.13)';ctx.lineWidth=2;ctx.strokeRect(34,34,1132,562);ctx.fillStyle='#1d312d';ctx.font='700 26px -apple-system,BlinkMacSystemFont,"PingFang TC",sans-serif';ctx.fillText('SIGN WELL',76,91);ctx.font='600 16px -apple-system,BlinkMacSystemFont,"PingFang TC",sans-serif';ctx.fillStyle='#667b73';ctx.fillText('ARTICLE IDENTITY',76,120);ctx.font='700 48px Georgia,"Noto Serif TC",serif';ctx.fillStyle='#1b2927';const lines=wrapLines(ctx,i.title||article.title||'',700,3);lines.forEach((l,idx)=>ctx.fillText(l,76,202+idx*62));ctx.font='700 26px ui-monospace,SFMono-Regular,Menlo,monospace';ctx.fillStyle='#314f49';ctx.fillText(i.article_id||'',76,410);ctx.font='600 18px -apple-system,BlinkMacSystemFont,"PingFang TC",sans-serif';ctx.fillStyle='#586d66';ctx.fillText(`Version ${i.current_version||'—'} · ${LABELS[i.article_status]||i.article_status||'—'}`,76,449);ctx.font='600 16px -apple-system,BlinkMacSystemFont,"PingFang TC",sans-serif';ctx.fillText((i.review_status||[]).map(x=>LABELS[x]||x).join(' · ')||'REVIEW NOT ATTESTED',76,480);ctx.font='600 14px ui-monospace,SFMono-Regular,Menlo,monospace';ctx.fillStyle='#7d766b';ctx.fillText(traceUrl(i),76,543);qrDrawCanvas(ctx,traceUrl(i),918,160,190);ctx.font='600 13px -apple-system,BlinkMacSystemFont,"PingFang TC",sans-serif';ctx.fillStyle='#5f746d';ctx.fillText('TRACEABLE MEDICAL CONTENT',918,380);return new Promise(resolve=>c.toBlob(resolve,'image/png',.94))}
async function downloadShareCard(i,a){const blob=await shareCardBlob(i,a);if(!blob)throw new Error('IMAGE_GENERATION_FAILED');const u=URL.createObjectURL(blob),link=DOC.createElement('a');link.href=u;link.download=filename(i);DOC.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(u),800)}
async function systemShare(i,a){const url=traceUrl(i),blob=await shareCardBlob(i,a);try{if(blob&&typeof File!=='undefined'){const file=new File([blob],filename(i),{type:'image/png'});if(navigator.canShare?.({files:[file]})&&navigator.share)return await navigator.share({title:a?.title||i.title||'SIGN WELL',text:`${a?.title||i.title||'SIGN WELL'}\n${i.article_id||''}`,url,files:[file]})}if(navigator.share)return await navigator.share({title:a?.title||i.title||'SIGN WELL',text:`${a?.title||i.title||'SIGN WELL'}\n${i.article_id||''}`,url});await copyText(url)}catch(e){if(e?.name!=='AbortError')await copyText(url);else throw e}}
function staticShareSvg(identity,article={}){const i={...getIdentity(article),...identity},url=traceUrl(i),m=qrMatrix(url),pad=4,qx=925,qy=160,qs=188;let qr='';if(m){const n=m.length,total=n+pad*2,c=qs/total;for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(m[y][x])qr+=`<rect x="${(qx+(x+pad)*c).toFixed(2)}" y="${(qy+(y+pad)*c).toFixed(2)}" width="${(c+.15).toFixed(2)}" height="${(c+.15).toFixed(2)}"/>`}const title=E(i.title||article.title||'未命名文章'),short=title.length>42?title.slice(0,41)+'…':title,review=E((i.review_status||[]).map(x=>LABELS[x]||x).join(' · ')||'REVIEW NOT ATTESTED');return`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f8f4e9"/><stop offset=".55" stop-color="#eef2ec"/><stop offset="1" stop-color="#e8edf2"/></linearGradient></defs><rect width="1200" height="630" fill="url(#g)"/><rect x="34" y="34" width="1132" height="562" rx="30" fill="none" stroke="#263f39" stroke-opacity=".16" stroke-width="2"/><text x="76" y="92" font-family="Arial,sans-serif" font-weight="700" font-size="26" fill="#1d312d">SIGN WELL</text><text x="76" y="120" font-family="Arial,sans-serif" font-weight="600" font-size="16" letter-spacing="3" fill="#667b73">ARTICLE IDENTITY</text><text x="76" y="228" font-family="Georgia,'Noto Serif TC',serif" font-weight="700" font-size="46" fill="#1b2927">${short}</text><text x="76" y="410" font-family="Menlo,monospace" font-weight="700" font-size="26" fill="#314f49">${E(i.article_id)}</text><text x="76" y="450" font-family="Arial,sans-serif" font-weight="600" font-size="18" fill="#586d66">Version ${E(i.current_version||'—')} · ${E(LABELS[i.article_status]||i.article_status||'—')}</text><text x="76" y="482" font-family="Arial,sans-serif" font-weight="600" font-size="16" fill="#586d66">${review}</text><text x="76" y="543" font-family="Menlo,monospace" font-size="14" fill="#7d766b">${E(url)}</text><rect x="${qx}" y="${qy}" width="${qs}" height="${qs}" rx="18" fill="#f7f3e8"/> <g fill="#182e2a">${qr}</g><text x="925" y="385" font-family="Arial,sans-serif" font-weight="600" font-size="13" letter-spacing="1" fill="#5f746d">TRACEABLE MEDICAL CONTENT</text></svg>`}
function chipHTML(a){if(!hasIdentity(a))return'';const i=getIdentity(a);return`<button type="button" class="sw-id-inline-chip" data-sw-id-open aria-label="開啟文章身分證 ${E(i.article_id)}"><span>文章身分證</span><b>${E(i.article_id)}</b></button>`}
function focusable(root){return[...root.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(x=>!x.disabled&&!x.hidden)}
async function open(article,opts={}){if(!hasIdentity(article))return false;DOC.querySelector('.sw-id-overlay')?.remove();let snap=getIdentity(article),live=null,liveError=null;try{live=await fetchTrace(snap.article_id)}catch(e){liveError=e}const identity=live||snap,articleUrlNow=articlePublicUrl(String(article.slug||identity.slug||'')),traceNow=traceUrl(identity),overlay=DOC.createElement('div');overlay.className='sw-id-overlay';overlay.innerHTML=`<div class="sw-id-modal" role="dialog" aria-modal="true" aria-labelledby="swIdDialogTitle"><div class="sw-id-modal-head"><div><span>ARTICLE IDENTITY</span><h2 id="swIdDialogTitle">文章身分證</h2></div><button type="button" class="sw-id-iconbtn" data-sw-id-close aria-label="關閉">×</button></div><div class="sw-id-verify" data-state="${live?'live':'snapshot'}"><b>${live?'已連線正式溯源紀錄':'顯示最後發布快照'}</b><span>${live?'正在核對目前公開內容的 fingerprint…':'即時驗證暫時無法連線；不把快照標示為即時驗證。'}</span></div>${cardHTML(identity,article)}<div class="sw-id-toolbar"><button type="button" data-sw-id-flip aria-pressed="false">翻到背面</button><a href="${E(articleUrlNow)}">查看全文</a><a href="${E(traceNow)}#references">查看引用</a><a href="${E(traceNow)}#versions">查看版本紀錄</a></div><div class="sw-id-actions"><button type="button" data-act="article">複製文章網址</button><button type="button" data-act="trace">複製 Trace URL</button><button type="button" data-act="qr">QR Code</button><button type="button" data-act="system">系統分享</button><button type="button" data-act="download">下載分享卡</button><button type="button" data-act="id">複製 Article ID</button></div></div>`;DOC.body.appendChild(overlay);const modal=overlay.querySelector('.sw-id-modal'),previous=DOC.activeElement;bindTilt(overlay);let back=false;overlay.querySelector('[data-sw-id-flip]').onclick=()=>{back=!back;setFlip(overlay,back);overlay.querySelector('[data-sw-id-flip]').textContent=back?'翻到正面':'翻到背面'};const close=()=>{removeEventListener('keydown',key);overlay.remove();previous?.focus?.()};overlay.querySelector('[data-sw-id-close]').onclick=close;overlay.addEventListener('pointerdown',e=>{if(e.target===overlay)close()});const articleUrl=articleUrlNow;overlay.querySelector('[data-act="article"]').onclick=async()=>{await copyText(articleUrl);notify('文章網址已複製')};overlay.querySelector('[data-act="trace"]').onclick=async()=>{await copyText(traceUrl(identity));notify('Trace URL 已複製')};overlay.querySelector('[data-act="id"]').onclick=async()=>{await copyText(identity.article_id);notify('Article ID 已複製')};overlay.querySelector('[data-act="qr"]').onclick=()=>{back=true;setFlip(overlay,true);overlay.querySelector('[data-sw-id-flip]').textContent='翻到正面';notify('QR Code 已顯示在卡片背面')};overlay.querySelector('[data-act="download"]').onclick=async()=>{await downloadShareCard(identity,article);notify('分享卡已產生')};overlay.querySelector('[data-act="system"]').onclick=()=>systemShare(identity,article).catch(()=>{});const key=e=>{if(e.key==='Escape'){close()}if(e.key==='Tab'){const f=focusable(modal);if(!f.length)return;const first=f[0],last=f[f.length-1];if(e.shiftKey&&DOC.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&DOC.activeElement===last){e.preventDefault();first.focus()}}};addEventListener('keydown',key);overlay.querySelector('[data-sw-id-close]').focus();if(live){try{const h=await localHash(article),box=overlay.querySelector('.sw-id-verify');if(h&&h===live.content_hash){box.dataset.state='verified';box.innerHTML='<b>目前公開內容與正式版本一致</b><span>SHA-256 fingerprint 已由瀏覽器重新計算並與 Backend canonical record 相符。</span>'}else if(h){box.dataset.state='mismatch';box.innerHTML='<b>目前內容與正式 fingerprint 不一致</b><span>請以文章溯源紀錄為準；此頁可能尚未更新完成。</span>'}}catch(_){}}return true}
function notify(msg){if(typeof g.showToast==='function')g.showToast(msg);else{let n=DOC.querySelector('.sw-id-toast');if(!n){n=DOC.createElement('div');n.className='sw-id-toast';DOC.body.appendChild(n)}n.textContent=msg;n.classList.add('show');setTimeout(()=>n.classList.remove('show'),1800)}}
function bindArticle(article,{shareButton,identityButton}={}){if(!hasIdentity(article))return false;const openFn=()=>open(article);(identityButton||DOC.querySelector('[data-sw-id-open]'))?.addEventListener('click',openFn);if(shareButton){shareButton.onclick=e=>{e.preventDefault();open(article,{share:true})}}return true}
function traceCitationItem(c){const type=String(c.target_type||'OTHER'),target=String(c.target_id||''),label=String(c.citation_context||target||type),tv=String(c.target_version||'');let href='',internal=false;if(type==='INTERNAL_ARTICLE'&&/^SW-A-/.test(target)){href=tracePublicUrl(target);internal=true}else if(/^https?:\/\//i.test(target))href=target;else if(type==='PAPER'&&/^\d{6,9}$/.test(target))href='https://pubmed.ncbi.nlm.nih.gov/'+target+'/';const currentV=String(c.target_current_version||''),stale=type==='INTERNAL_ARTICLE'&&c.target_is_current_version===false;const meta=[target&&target!==label?target:'',tv?'target v'+tv:'',stale&&currentV?'目前最新 v'+currentV:'',stale?'目標文章已有更新版本':''].filter(Boolean).join(' · ');return`<li><div><span class="sw-trace-type">${E(type)}</span><b>${E(label)}</b>${meta?`<small>${E(meta)}</small>`:''}</div>${href?`<a href="${E(href)}" ${internal?'':'target="_blank" rel="noopener noreferrer"'}>開啟來源</a>`:''}</li>`}
async function fetchPublicArticleByTrace(i){if(!i?.slug)return null;try{const r=await fetch(SITE+'articles/'+encodeURIComponent(i.slug)+'.json?trace='+Date.now(),{cache:'no-store'});return r.ok?await r.json():null}catch(_){return null}}
async function mountTracePage(snapshot){const host=DOC.querySelector('[data-sw-trace-root]');if(!host)return;let live=null;try{live=await fetchTrace(snapshot?.article_id)}catch(_){}const i=live||snapshot||{},isLive=!!live;host.innerHTML=`<section class="sw-trace-hero"><div><span>SIGN WELL · TRACE &amp; PROVENANCE</span><h1>文章溯源紀錄</h1><p>${E(i.title||'')}</p></div><a href="${E(String(i.article_status)==='DEPRECATED'?SITE:articlePublicUrl(i.slug||''))}">${String(i.article_status)==='DEPRECATED'?'返回 SIGN WELL':'查看全文'}</a></section><section class="sw-trace-status" data-state="${isLive?'live':'snapshot'}"><b>${isLive?'已讀取 Backend canonical record':'顯示最後正式發布快照'}</b><span>${isLive?'正在核對公開 article fingerprint。':'即時驗證暫時無法連線，因此不宣稱目前內容已即時驗證。'}</span></section><section class="sw-trace-summary"><div><span>Article ID</span><b>${E(i.article_id||'—')}</b></div><div><span>Version</span><b>${E(i.current_version||'—')}</b></div><div><span>Status</span><b>${E(LABELS[i.article_status]||i.article_status||'—')}</b></div><div><span>Author</span><b>${E(i.author?.name||'SIGN WELL 編輯部')}</b></div><div><span>Published</span><b>${E(DATE(i.published_at))}</b></div><div><span>Updated</span><b>${E(DATE(i.updated_at))}</b></div><div><span>Last validation</span><b>${E(DATE(i.last_verified_at))}</b></div><div><span>Review</span><b>${E((i.review_status||[]).map(x=>LABELS[x]||x).join(' · ')||'—')}</b></div></section><section class="sw-trace-hash"><div><span>Content fingerprint · SHA-256</span><code>${E(i.content_hash||'—')}</code><small>${E(i.hash_schema||'sw-content-v1')}</small></div><div class="sw-trace-qr">${qrSvg(traceUrl(i),176,4)}</div></section><section class="sw-trace-section" id="references"><header><span>REFERENCES</span><h2>引用來源</h2></header><div class="sw-trace-counts"><span>External <b>${Number(i.external_references||0)}</b></span><span>Internal <b>${Number(i.internal_references||0)}</b></span><span>Referenced by <b>${Number(i.referenced_by||0)}</b></span></div><ul class="sw-trace-list">${(i.citations||[]).map(traceCitationItem).join('')||'<li><div><b>此版本沒有結構化引用紀錄。</b></div></li>'}</ul></section><section class="sw-trace-section" id="internal-references"><header><span>INTERNAL REFERENCES</span><h2>本文引用的 SIGN WELL 文章</h2></header><ul class="sw-trace-list">${(i.citations||[]).filter(c=>String(c.target_type||'')==='INTERNAL_ARTICLE').map(traceCitationItem).join('')||'<li><div><b>此版本沒有站內文章引用。</b></div></li>'}</ul></section><section class="sw-trace-section" id="referenced-by"><header><span>REFERENCED BY</span><h2>引用本文的文章</h2></header><ul class="sw-trace-list">${(i.referenced_by_items||[]).map(x=>`<li><div><span class="sw-trace-type">INTERNAL ARTICLE</span><b>${E(x.title||x.article_id)}</b><small>${E(x.article_id)} · v${E(x.version||'')}</small></div><a href="${tracePublicUrl(x.article_id)}">查看溯源</a></li>`).join('')||'<li><div><b>目前沒有其他 SIGN WELL 文章引用本文。</b></div></li>'}</ul></section><section class="sw-trace-section" id="versions"><header><span>VERSION HISTORY</span><h2>版本紀錄</h2></header><ol class="sw-trace-versions">${(i.version_history||[]).slice().reverse().map(v=>`<li><b>v${E(v.version)}</b><span>Revision ${Number(v.revision_seq||0)} · ${E(v.change_class||'')}</span><time>${E(DATE(v.created_at))}</time><code>${E(compactHash(v.content_hash))}</code></li>`).join('')||'<li><b>v'+E(i.current_version||'—')+'</b></li>'}</ol></section>`;if(isLive){const status=host.querySelector('.sw-trace-status');try{const article=await fetchPublicArticleByTrace(i),hash=article?await localHash(article):'';if(hash&&hash===i.content_hash){status.dataset.state='verified';status.innerHTML='<b>目前公開文章與正式版本一致</b><span>瀏覽器重新計算 SHA-256 後，與 Backend canonical fingerprint 相符。</span>'}else if(hash){status.dataset.state='mismatch';status.innerHTML='<b>公開內容與正式版本不一致</b><span>可能正在更新；請以此溯源紀錄的正式版本資訊為準。</span>'}}catch(_){}}}
async function hydrateStaticArticle(article){if(article?.content)return article;const slug=String(article?.slug||'').trim();if(!slug)return article;try{const r=await fetch(SITE+'articles/'+encodeURIComponent(slug)+'.json?identity='+Date.now(),{cache:'no-store'});if(r.ok)return {...article,...await r.json()}}catch(_){}return article}
function mountStaticArticle(article){if(!hasIdentity(article))return false;const btn=DOC.getElementById('identityArticle'),share=DOC.getElementById('shareArticle');const launch=async(opts={})=>open(await hydrateStaticArticle(article),opts);if(btn)btn.onclick=()=>launch();if(share)share.onclick=e=>{e.preventDefault();launch({share:true})};return true}
const api=Object.freeze({hasIdentity,getIdentity,chipHTML,open,bindArticle,mountStaticArticle,mountTracePage,fetchTrace,localHash,qrSvg,makeStaticShareSvg:staticShareSvg,downloadShareCard,systemShare,traceUrl,articlePublicUrl,cardHTML});
g.SignWellArticleIdentity=api;
})(window);
