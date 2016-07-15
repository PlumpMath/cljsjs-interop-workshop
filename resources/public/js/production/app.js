if(typeof Math.imul == "undefined" || (Math.imul(0xffffffff,5) == 0)) {
    Math.imul = function (a, b) {
        var ah  = (a >>> 16) & 0xffff;
        var al = a & 0xffff;
        var bh  = (b >>> 16) & 0xffff;
        var bl = b & 0xffff;
        // the shift by 0 fixes the sign on the high part
        // the final |0 converts the unsigned value into a signed value
        return ((al * bl) + (((ah * bl + al * bh) << 16) >>> 0)|0);
    }
}

//  Chance.js 1.0.3
//  http://chancejs.com
//  (c) 2013 Victor Quinn
//  Chance may be freely distributed or modified under the MIT license.

(function () {

    // Constants
    var MAX_INT = 9007199254740992;
    var MIN_INT = -MAX_INT;
    var NUMBERS = '0123456789';
    var CHARS_LOWER = 'abcdefghijklmnopqrstuvwxyz';
    var CHARS_UPPER = CHARS_LOWER.toUpperCase();
    var HEX_POOL  = NUMBERS + "abcdef";

    // Cached array helpers
    var slice = Array.prototype.slice;

    // Constructor
    function Chance (seed) {
        if (!(this instanceof Chance)) {
            return seed == null ? new Chance() : new Chance(seed);
        }

        // if user has provided a function, use that as the generator
        if (typeof seed === 'function') {
            this.random = seed;
            return this;
        }

        if (arguments.length) {
            // set a starting value of zero so we can add to it
            this.seed = 0;
        }

        // otherwise, leave this.seed blank so that MT will receive a blank

        for (var i = 0; i < arguments.length; i++) {
            var seedling = 0;
            if (Object.prototype.toString.call(arguments[i]) === '[object String]') {
                for (var j = 0; j < arguments[i].length; j++) {
                    // create a numeric hash for each argument, add to seedling
                    var hash = 0;
                    for (var k = 0; k < arguments[i].length; k++) {
                        hash = arguments[i].charCodeAt(k) + (hash << 6) + (hash << 16) - hash;
                    }
                    seedling += hash;
                }
            } else {
                seedling = arguments[i];
            }
            this.seed += (arguments.length - i) * seedling;
        }

        // If no generator function was provided, use our MT
        this.mt = this.mersenne_twister(this.seed);
        this.bimd5 = this.blueimp_md5();
        this.random = function () {
            return this.mt.random(this.seed);
        };

        return this;
    }

    Chance.prototype.VERSION = "1.0.3";

    // Random helper functions
    function initOptions(options, defaults) {
        options || (options = {});

        if (defaults) {
            for (var i in defaults) {
                if (typeof options[i] === 'undefined') {
                    options[i] = defaults[i];
                }
            }
        }

        return options;
    }

    function testRange(test, errorMessage) {
        if (test) {
            throw new RangeError(errorMessage);
        }
    }

    /**
     * Encode the input string with Base64.
     */
    var base64 = function() {
        throw new Error('No Base64 encoder available.');
    };

    // Select proper Base64 encoder.
    (function determineBase64Encoder() {
        if (typeof btoa === 'function') {
            base64 = btoa;
        } else if (typeof Buffer === 'function') {
            base64 = function(input) {
                return new Buffer(input).toString('base64');
            };
        }
    })();

    // -- Basics --

    /**
     *  Return a random bool, either true or false
     *
     *  @param {Object} [options={ likelihood: 50 }] alter the likelihood of
     *    receiving a true or false value back.
     *  @throws {RangeError} if the likelihood is out of bounds
     *  @returns {Bool} either true or false
     */
    Chance.prototype.bool = function (options) {
        // likelihood of success (true)
        options = initOptions(options, {likelihood : 50});

        // Note, we could get some minor perf optimizations by checking range
        // prior to initializing defaults, but that makes code a bit messier
        // and the check more complicated as we have to check existence of
        // the object then existence of the key before checking constraints.
        // Since the options initialization should be minor computationally,
        // decision made for code cleanliness intentionally. This is mentioned
        // here as it's the first occurrence, will not be mentioned again.
        testRange(
            options.likelihood < 0 || options.likelihood > 100,
            "Chance: Likelihood accepts values from 0 to 100."
        );

        return this.random() * 100 < options.likelihood;
    };

    /**
     *  Return a random character.
     *
     *  @param {Object} [options={}] can specify a character pool, only alpha,
     *    only symbols, and casing (lower or upper)
     *  @returns {String} a single random character
     *  @throws {RangeError} Can only specify alpha or symbols, not both
     */
    Chance.prototype.character = function (options) {
        options = initOptions(options);
        testRange(
            options.alpha && options.symbols,
            "Chance: Cannot specify both alpha and symbols."
        );

        var symbols = "!@#$%^&*()[]",
            letters, pool;

        if (options.casing === 'lower') {
            letters = CHARS_LOWER;
        } else if (options.casing === 'upper') {
            letters = CHARS_UPPER;
        } else {
            letters = CHARS_LOWER + CHARS_UPPER;
        }

        if (options.pool) {
            pool = options.pool;
        } else if (options.alpha) {
            pool = letters;
        } else if (options.symbols) {
            pool = symbols;
        } else {
            pool = letters + NUMBERS + symbols;
        }

        return pool.charAt(this.natural({max: (pool.length - 1)}));
    };

    // Note, wanted to use "float" or "double" but those are both JS reserved words.

    // Note, fixed means N OR LESS digits after the decimal. This because
    // It could be 14.9000 but in JavaScript, when this is cast as a number,
    // the trailing zeroes are dropped. Left to the consumer if trailing zeroes are
    // needed
    /**
     *  Return a random floating point number
     *
     *  @param {Object} [options={}] can specify a fixed precision, min, max
     *  @returns {Number} a single floating point number
     *  @throws {RangeError} Can only specify fixed or precision, not both. Also
     *    min cannot be greater than max
     */
    Chance.prototype.floating = function (options) {
        options = initOptions(options, {fixed : 4});
        testRange(
            options.fixed && options.precision,
            "Chance: Cannot specify both fixed and precision."
        );

        var num;
        var fixed = Math.pow(10, options.fixed);

        var max = MAX_INT / fixed;
        var min = -max;

        testRange(
            options.min && options.fixed && options.min < min,
            "Chance: Min specified is out of range with fixed. Min should be, at least, " + min
        );
        testRange(
            options.max && options.fixed && options.max > max,
            "Chance: Max specified is out of range with fixed. Max should be, at most, " + max
        );

        options = initOptions(options, { min : min, max : max });

        // Todo - Make this work!
        // options.precision = (typeof options.precision !== "undefined") ? options.precision : false;

        num = this.integer({min: options.min * fixed, max: options.max * fixed});
        var num_fixed = (num / fixed).toFixed(options.fixed);

        return parseFloat(num_fixed);
    };

    /**
     *  Return a random integer
     *
     *  NOTE the max and min are INCLUDED in the range. So:
     *  chance.integer({min: 1, max: 3});
     *  would return either 1, 2, or 3.
     *
     *  @param {Object} [options={}] can specify a min and/or max
     *  @returns {Number} a single random integer number
     *  @throws {RangeError} min cannot be greater than max
     */
    Chance.prototype.integer = function (options) {
        // 9007199254740992 (2^53) is the max integer number in JavaScript
        // See: http://vq.io/132sa2j
        options = initOptions(options, {min: MIN_INT, max: MAX_INT});
        testRange(options.min > options.max, "Chance: Min cannot be greater than Max.");

        return Math.floor(this.random() * (options.max - options.min + 1) + options.min);
    };

    /**
     *  Return a random natural
     *
     *  NOTE the max and min are INCLUDED in the range. So:
     *  chance.natural({min: 1, max: 3});
     *  would return either 1, 2, or 3.
     *
     *  @param {Object} [options={}] can specify a min and/or max
     *  @returns {Number} a single random integer number
     *  @throws {RangeError} min cannot be greater than max
     */
    Chance.prototype.natural = function (options) {
        options = initOptions(options, {min: 0, max: MAX_INT});
        testRange(options.min < 0, "Chance: Min cannot be less than zero.");
        return this.integer(options);
    };

    /**
     *  Return a random string
     *
     *  @param {Object} [options={}] can specify a length
     *  @returns {String} a string of random length
     *  @throws {RangeError} length cannot be less than zero
     */
    Chance.prototype.string = function (options) {
        options = initOptions(options, { length: this.natural({min: 5, max: 20}) });
        testRange(options.length < 0, "Chance: Length cannot be less than zero.");
        var length = options.length,
            text = this.n(this.character, length, options);

        return text.join("");
    };

    // -- End Basics --

    // -- Helpers --

    Chance.prototype.capitalize = function (word) {
        return word.charAt(0).toUpperCase() + word.substr(1);
    };

    Chance.prototype.mixin = function (obj) {
        for (var func_name in obj) {
            Chance.prototype[func_name] = obj[func_name];
        }
        return this;
    };

    /**
     *  Given a function that generates something random and a number of items to generate,
     *    return an array of items where none repeat.
     *
     *  @param {Function} fn the function that generates something random
     *  @param {Number} num number of terms to generate
     *  @param {Object} options any options to pass on to the generator function
     *  @returns {Array} an array of length `num` with every item generated by `fn` and unique
     *
     *  There can be more parameters after these. All additional parameters are provided to the given function
     */
    Chance.prototype.unique = function(fn, num, options) {
        testRange(
            typeof fn !== "function",
            "Chance: The first argument must be a function."
        );

        var comparator = function(arr, val) { return arr.indexOf(val) !== -1; };

        if (options) {
            comparator = options.comparator || comparator;
        }

        var arr = [], count = 0, result, MAX_DUPLICATES = num * 50, params = slice.call(arguments, 2);

        while (arr.length < num) {
            var clonedParams = JSON.parse(JSON.stringify(params));
            result = fn.apply(this, clonedParams);
            if (!comparator(arr, result)) {
                arr.push(result);
                // reset count when unique found
                count = 0;
            }

            if (++count > MAX_DUPLICATES) {
                throw new RangeError("Chance: num is likely too large for sample set");
            }
        }
        return arr;
    };

    /**
     *  Gives an array of n random terms
     *
     *  @param {Function} fn the function that generates something random
     *  @param {Number} n number of terms to generate
     *  @returns {Array} an array of length `n` with items generated by `fn`
     *
     *  There can be more parameters after these. All additional parameters are provided to the given function
     */
    Chance.prototype.n = function(fn, n) {
        testRange(
            typeof fn !== "function",
            "Chance: The first argument must be a function."
        );

        if (typeof n === 'undefined') {
            n = 1;
        }
        var i = n, arr = [], params = slice.call(arguments, 2);

        // Providing a negative count should result in a noop.
        i = Math.max( 0, i );

        for (null; i--; null) {
            arr.push(fn.apply(this, params));
        }

        return arr;
    };

    // H/T to SO for this one: http://vq.io/OtUrZ5
    Chance.prototype.pad = function (number, width, pad) {
        // Default pad to 0 if none provided
        pad = pad || '0';
        // Convert number to a string
        number = number + '';
        return number.length >= width ? number : new Array(width - number.length + 1).join(pad) + number;
    };

    // DEPRECATED on 2015-10-01
    Chance.prototype.pick = function (arr, count) {
        if (arr.length === 0) {
            throw new RangeError("Chance: Cannot pick() from an empty array");
        }
        if (!count || count === 1) {
            return arr[this.natural({max: arr.length - 1})];
        } else {
            return this.shuffle(arr).slice(0, count);
        }
    };

    // Given an array, returns a single random element
    Chance.prototype.pickone = function (arr) {
        if (arr.length === 0) {
          throw new RangeError("Chance: Cannot pickone() from an empty array");
        }
        return arr[this.natural({max: arr.length - 1})];
    };

    // Given an array, returns a random set with 'count' elements
    Chance.prototype.pickset = function (arr, count) {
        if (count === 0) {
            return [];
        }
        if (arr.length === 0) {
            throw new RangeError("Chance: Cannot pickset() from an empty array");
        }
        if (count < 0) {
            throw new RangeError("Chance: count must be positive number");
        }
        if (!count || count === 1) {
            return [ this.pickone(arr) ];
        } else {
            return this.shuffle(arr).slice(0, count);
        }
    };

    Chance.prototype.shuffle = function (arr) {
        var old_array = arr.slice(0),
            new_array = [],
            j = 0,
            length = Number(old_array.length);

        for (var i = 0; i < length; i++) {
            // Pick a random index from the array
            j = this.natural({max: old_array.length - 1});
            // Add it to the new array
            new_array[i] = old_array[j];
            // Remove that element from the original array
            old_array.splice(j, 1);
        }

        return new_array;
    };

    // Returns a single item from an array with relative weighting of odds
    Chance.prototype.weighted = function (arr, weights, trim) {
        if (arr.length !== weights.length) {
            throw new RangeError("Chance: length of array and weights must match");
        }

        // scan weights array and sum valid entries
        var sum = 0;
        var val;
        for (var weightIndex = 0; weightIndex < weights.length; ++weightIndex) {
            val = weights[weightIndex];
            if (val > 0) {
                sum += val;
            }
        }

        if (sum === 0) {
            throw new RangeError("Chance: no valid entries in array weights");
        }

        // select a value within range
        var selected = this.random() * sum;

        // find array entry corresponding to selected value
        var total = 0;
        var lastGoodIdx = -1;
        var chosenIdx;
        for (weightIndex = 0; weightIndex < weights.length; ++weightIndex) {
            val = weights[weightIndex];
            total += val;
            if (val > 0) {
                if (selected <= total) {
                    chosenIdx = weightIndex;
                    break;
                }
                lastGoodIdx = weightIndex;
            }

            // handle any possible rounding error comparison to ensure something is picked
            if (weightIndex === (weights.length - 1)) {
                chosenIdx = lastGoodIdx;
            }
        }

        var chosen = arr[chosenIdx];
        trim = (typeof trim === 'undefined') ? false : trim;
        if (trim) {
            arr.splice(chosenIdx, 1);
            weights.splice(chosenIdx, 1);
        }

        return chosen;
    };

    // -- End Helpers --

    // -- Text --

    Chance.prototype.paragraph = function (options) {
        options = initOptions(options);

        var sentences = options.sentences || this.natural({min: 3, max: 7}),
            sentence_array = this.n(this.sentence, sentences);

        return sentence_array.join(' ');
    };

    // Could get smarter about this than generating random words and
    // chaining them together. Such as: http://vq.io/1a5ceOh
    Chance.prototype.sentence = function (options) {
        options = initOptions(options);

        var words = options.words || this.natural({min: 12, max: 18}),
            punctuation = options.punctuation,
            text, word_array = this.n(this.word, words);

        text = word_array.join(' ');
        
        // Capitalize first letter of sentence
        text = this.capitalize(text);
        
        // Make sure punctuation has a usable value
        if (punctuation !== false && !/^[\.\?;!:]$/.test(punctuation)) {
            punctuation = '.';
        }
        
        // Add punctuation mark
        if (punctuation) {
            text += punctuation;
        }

        return text;
    };

    Chance.prototype.syllable = function (options) {
        options = initOptions(options);

        var length = options.length || this.natural({min: 2, max: 3}),
            consonants = 'bcdfghjklmnprstvwz', // consonants except hard to speak ones
            vowels = 'aeiou', // vowels
            all = consonants + vowels, // all
            text = '',
            chr;

        // I'm sure there's a more elegant way to do this, but this works
        // decently well.
        for (var i = 0; i < length; i++) {
            if (i === 0) {
                // First character can be anything
                chr = this.character({pool: all});
            } else if (consonants.indexOf(chr) === -1) {
                // Last character was a vowel, now we want a consonant
                chr = this.character({pool: consonants});
            } else {
                // Last character was a consonant, now we want a vowel
                chr = this.character({pool: vowels});
            }

            text += chr;
        }

        if (options.capitalize) {
            text = this.capitalize(text);
        }

        return text;
    };

    Chance.prototype.word = function (options) {
        options = initOptions(options);

        testRange(
            options.syllables && options.length,
            "Chance: Cannot specify both syllables AND length."
        );

        var syllables = options.syllables || this.natural({min: 1, max: 3}),
            text = '';

        if (options.length) {
            // Either bound word by length
            do {
                text += this.syllable();
            } while (text.length < options.length);
            text = text.substring(0, options.length);
        } else {
            // Or by number of syllables
            for (var i = 0; i < syllables; i++) {
                text += this.syllable();
            }
        }

        if (options.capitalize) {
            text = this.capitalize(text);
        }

        return text;
    };

    // -- End Text --

    // -- Person --

    Chance.prototype.age = function (options) {
        options = initOptions(options);
        var ageRange;

        switch (options.type) {
            case 'child':
                ageRange = {min: 1, max: 12};
                break;
            case 'teen':
                ageRange = {min: 13, max: 19};
                break;
            case 'adult':
                ageRange = {min: 18, max: 65};
                break;
            case 'senior':
                ageRange = {min: 65, max: 100};
                break;
            case 'all':
                ageRange = {min: 1, max: 100};
                break;
            default:
                ageRange = {min: 18, max: 65};
                break;
        }

        return this.natural(ageRange);
    };

    Chance.prototype.birthday = function (options) {
        options = initOptions(options, {
            year: (new Date().getFullYear() - this.age(options))
        });

        return this.date(options);
    };

    // CPF; ID to identify taxpayers in Brazil
    Chance.prototype.cpf = function () {
        var n = this.n(this.natural, 9, { max: 9 });
        var d1 = n[8]*2+n[7]*3+n[6]*4+n[5]*5+n[4]*6+n[3]*7+n[2]*8+n[1]*9+n[0]*10;
        d1 = 11 - (d1 % 11);
        if (d1>=10) {
            d1 = 0;
        }
        var d2 = d1*2+n[8]*3+n[7]*4+n[6]*5+n[5]*6+n[4]*7+n[3]*8+n[2]*9+n[1]*10+n[0]*11;
        d2 = 11 - (d2 % 11);
        if (d2>=10) {
            d2 = 0;
        }
        return ''+n[0]+n[1]+n[2]+'.'+n[3]+n[4]+n[5]+'.'+n[6]+n[7]+n[8]+'-'+d1+d2;
    };

    // CNPJ: ID to identify companies in Brazil
    Chance.prototype.cnpj = function () {
        var n = this.n(this.natural, 12, { max: 12 });
        var d1 = n[11]*2+n[10]*3+n[9]*4+n[8]*5+n[7]*6+n[6]*7+n[5]*8+n[4]*9+n[3]*2+n[2]*3+n[1]*4+n[0]*5;
        d1 = 11 - (d1 % 11);
        if (d1<2) {
            d1 = 0;
        }
        var d2 = d1*2+n[11]*3+n[10]*4+n[9]*5+n[8]*6+n[7]*7+n[6]*8+n[5]*9+n[4]*2+n[3]*3+n[2]*4+n[1]*5+n[0]*6;
        d2 = 11 - (d2 % 11);
        if (d2<2) {
            d2 = 0;
        }
        return ''+n[0]+n[1]+'.'+n[2]+n[3]+n[4]+'.'+n[5]+n[6]+n[7]+'/'+n[8]+n[9]+n[10]+n[11]+'-'+d1+d2;
    };

    Chance.prototype.first = function (options) {
        options = initOptions(options, {gender: this.gender(), nationality: 'en'});
        return this.pick(this.get("firstNames")[options.gender.toLowerCase()][options.nationality.toLowerCase()]);
    };

    Chance.prototype.gender = function () {
        return this.pick(['Male', 'Female']);
    };

    Chance.prototype.last = function (options) {
        options = initOptions(options, {nationality: 'en'});
        return this.pick(this.get("lastNames")[options.nationality.toLowerCase()]);
    };
    
    Chance.prototype.israelId=function(){
        var x=this.string({pool: '0123456789',length:8});
        var y=0;
        for (var i=0;i<x.length;i++){
            var thisDigit=  x[i] *  (i/2===parseInt(i/2) ? 1 : 2);
            thisDigit=this.pad(thisDigit,2).toString();
            thisDigit=parseInt(thisDigit[0]) + parseInt(thisDigit[1]);
            y=y+thisDigit;
        }
        x=x+(10-parseInt(y.toString().slice(-1))).toString().slice(-1);
        return x;
    };

    Chance.prototype.mrz = function (options) {
        var checkDigit = function (input) {
            var alpha = "<ABCDEFGHIJKLMNOPQRSTUVWXYXZ".split(''),
                multipliers = [ 7, 3, 1 ],
                runningTotal = 0;

            if (typeof input !== 'string') {
                input = input.toString();
            }

            input.split('').forEach(function(character, idx) {
                var pos = alpha.indexOf(character);

                if(pos !== -1) {
                    character = pos === 0 ? 0 : pos + 9;
                } else {
                    character = parseInt(character, 10);
                }
                character *= multipliers[idx % multipliers.length];
                runningTotal += character;
            });
            return runningTotal % 10;
        };
        var generate = function (opts) {
            var pad = function (length) {
                return new Array(length + 1).join('<');
            };
            var number = [ 'P<',
                           opts.issuer,
                           opts.last.toUpperCase(),
                           '<<',
                           opts.first.toUpperCase(),
                           pad(39 - (opts.last.length + opts.first.length + 2)),
                           opts.passportNumber,
                           checkDigit(opts.passportNumber),
                           opts.nationality,
                           opts.dob,
                           checkDigit(opts.dob),
                           opts.gender,
                           opts.expiry,
                           checkDigit(opts.expiry),
                           pad(14),
                           checkDigit(pad(14)) ].join('');

            return number +
                (checkDigit(number.substr(44, 10) +
                            number.substr(57, 7) +
                            number.substr(65, 7)));
        };

        var that = this;

        options = initOptions(options, {
            first: this.first(),
            last: this.last(),
            passportNumber: this.integer({min: 100000000, max: 999999999}),
            dob: (function () {
                var date = that.birthday({type: 'adult'});
                return [date.getFullYear().toString().substr(2),
                        that.pad(date.getMonth() + 1, 2),
                        that.pad(date.getDate(), 2)].join('');
            }()),
            expiry: (function () {
                var date = new Date();
                return [(date.getFullYear() + 5).toString().substr(2),
                        that.pad(date.getMonth() + 1, 2),
                        that.pad(date.getDate(), 2)].join('');
            }()),
            gender: this.gender() === 'Female' ? 'F': 'M',
            issuer: 'GBR',
            nationality: 'GBR'
        });
        return generate (options);
    };

    Chance.prototype.name = function (options) {
        options = initOptions(options);

        var first = this.first(options),
            last = this.last(options),
            name;

        if (options.middle) {
            name = first + ' ' + this.first(options) + ' ' + last;
        } else if (options.middle_initial) {
            name = first + ' ' + this.character({alpha: true, casing: 'upper'}) + '. ' + last;
        } else {
            name = first + ' ' + last;
        }

        if (options.prefix) {
            name = this.prefix(options) + ' ' + name;
        }

        if (options.suffix) {
            name = name + ' ' + this.suffix(options);
        }

        return name;
    };

    // Return the list of available name prefixes based on supplied gender.
    // @todo introduce internationalization
    Chance.prototype.name_prefixes = function (gender) {
        gender = gender || "all";
        gender = gender.toLowerCase();

        var prefixes = [
            { name: 'Doctor', abbreviation: 'Dr.' }
        ];

        if (gender === "male" || gender === "all") {
            prefixes.push({ name: 'Mister', abbreviation: 'Mr.' });
        }

        if (gender === "female" || gender === "all") {
            prefixes.push({ name: 'Miss', abbreviation: 'Miss' });
            prefixes.push({ name: 'Misses', abbreviation: 'Mrs.' });
        }

        return prefixes;
    };

    // Alias for name_prefix
    Chance.prototype.prefix = function (options) {
        return this.name_prefix(options);
    };

    Chance.prototype.name_prefix = function (options) {
        options = initOptions(options, { gender: "all" });
        return options.full ?
            this.pick(this.name_prefixes(options.gender)).name :
            this.pick(this.name_prefixes(options.gender)).abbreviation;
    };

    Chance.prototype.ssn = function (options) {
        options = initOptions(options, {ssnFour: false, dashes: true});
        var ssn_pool = "1234567890",
            ssn,
            dash = options.dashes ? '-' : '';

        if(!options.ssnFour) {
            ssn = this.string({pool: ssn_pool, length: 3}) + dash +
            this.string({pool: ssn_pool, length: 2}) + dash +
            this.string({pool: ssn_pool, length: 4});
        } else {
            ssn = this.string({pool: ssn_pool, length: 4});
        }
        return ssn;
    };

    // Return the list of available name suffixes
    // @todo introduce internationalization
    Chance.prototype.name_suffixes = function () {
        var suffixes = [
            { name: 'Doctor of Osteopathic Medicine', abbreviation: 'D.O.' },
            { name: 'Doctor of Philosophy', abbreviation: 'Ph.D.' },
            { name: 'Esquire', abbreviation: 'Esq.' },
            { name: 'Junior', abbreviation: 'Jr.' },
            { name: 'Juris Doctor', abbreviation: 'J.D.' },
            { name: 'Master of Arts', abbreviation: 'M.A.' },
            { name: 'Master of Business Administration', abbreviation: 'M.B.A.' },
            { name: 'Master of Science', abbreviation: 'M.S.' },
            { name: 'Medical Doctor', abbreviation: 'M.D.' },
            { name: 'Senior', abbreviation: 'Sr.' },
            { name: 'The Third', abbreviation: 'III' },
            { name: 'The Fourth', abbreviation: 'IV' },
            { name: 'Bachelor of Engineering', abbreviation: 'B.E' },
            { name: 'Bachelor of Technology', abbreviation: 'B.TECH' }
        ];
        return suffixes;
    };

    // Alias for name_suffix
    Chance.prototype.suffix = function (options) {
        return this.name_suffix(options);
    };

    Chance.prototype.name_suffix = function (options) {
        options = initOptions(options);
        return options.full ?
            this.pick(this.name_suffixes()).name :
            this.pick(this.name_suffixes()).abbreviation;
    };

    Chance.prototype.nationalities = function () {
        return this.get("nationalities");
    };

    // Generate random nationality based on json list
    Chance.prototype.nationality = function () {
        var nationality = this.pick(this.nationalities());
        return nationality.name;
    };

    // -- End Person --

    // -- Mobile --
    // Android GCM Registration ID
    Chance.prototype.android_id = function () {
        return "APA91" + this.string({ pool: "0123456789abcefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_", length: 178 });
    };

    // Apple Push Token
    Chance.prototype.apple_token = function () {
        return this.string({ pool: "abcdef1234567890", length: 64 });
    };

    // Windows Phone 8 ANID2
    Chance.prototype.wp8_anid2 = function () {
        return base64( this.hash( { length : 32 } ) );
    };

    // Windows Phone 7 ANID
    Chance.prototype.wp7_anid = function () {
        return 'A=' + this.guid().replace(/-/g, '').toUpperCase() + '&E=' + this.hash({ length:3 }) + '&W=' + this.integer({ min:0, max:9 });
    };

    // BlackBerry Device PIN
    Chance.prototype.bb_pin = function () {
        return this.hash({ length: 8 });
    };

    // -- End Mobile --

    // -- Web --
    Chance.prototype.avatar = function (options) {
        var url = null;
        var URL_BASE = '//www.gravatar.com/avatar/';
        var PROTOCOLS = {
            http: 'http',
            https: 'https'
        };
        var FILE_TYPES = {
            bmp: 'bmp',
            gif: 'gif',
            jpg: 'jpg',
            png: 'png'
        };
        var FALLBACKS = {
            '404': '404', // Return 404 if not found
            mm: 'mm', // Mystery man
            identicon: 'identicon', // Geometric pattern based on hash
            monsterid: 'monsterid', // A generated monster icon
            wavatar: 'wavatar', // A generated face
            retro: 'retro', // 8-bit icon
            blank: 'blank' // A transparent png
        };
        var RATINGS = {
            g: 'g',
            pg: 'pg',
            r: 'r',
            x: 'x'
        };
        var opts = {
            protocol: null,
            email: null,
            fileExtension: null,
            size: null,
            fallback: null,
            rating: null
        };

        if (!options) {
            // Set to a random email
            opts.email = this.email();
            options = {};
        }
        else if (typeof options === 'string') {
            opts.email = options;
            options = {};
        }
        else if (typeof options !== 'object') {
            return null;
        }
        else if (options.constructor === 'Array') {
            return null;
        }

        opts = initOptions(options, opts);

        if (!opts.email) {
            // Set to a random email
            opts.email = this.email();
        }

        // Safe checking for params
        opts.protocol = PROTOCOLS[opts.protocol] ? opts.protocol + ':' : '';
        opts.size = parseInt(opts.size, 0) ? opts.size : '';
        opts.rating = RATINGS[opts.rating] ? opts.rating : '';
        opts.fallback = FALLBACKS[opts.fallback] ? opts.fallback : '';
        opts.fileExtension = FILE_TYPES[opts.fileExtension] ? opts.fileExtension : '';

        url =
            opts.protocol +
            URL_BASE +
            this.bimd5.md5(opts.email) +
            (opts.fileExtension ? '.' + opts.fileExtension : '') +
            (opts.size || opts.rating || opts.fallback ? '?' : '') +
            (opts.size ? '&s=' + opts.size.toString() : '') +
            (opts.rating ? '&r=' + opts.rating : '') +
            (opts.fallback ? '&d=' + opts.fallback : '')
            ;

        return url;
    };

    /**
     * #Description:
     * ===============================================
     * Generate random color value base on color type:
     * -> hex
     * -> rgb
     * -> rgba
     * -> 0x
     * -> named color
     *
     * #Examples: 
     * ===============================================
     * * Geerate random hex color
     * chance.color() => '#79c157' / 'rgb(110,52,164)' / '0x67ae0b' / '#e2e2e2' / '#29CFA7'
     * 
     * * Generate Hex based color value
     * chance.color({format: 'hex'})    => '#d67118'
     *
     * * Generate simple rgb value
     * chance.color({format: 'rgb'})    => 'rgb(110,52,164)'
     *
     * * Generate Ox based color value
     * chance.color({format: '0x'})     => '0x67ae0b' 
     *
     * * Generate graiscale based value
     * chance.color({grayscale: true})  => '#e2e2e2'
     *
     * * Return valide color name
     * chance.color({format: 'name'})   => 'red'
     * 
     * * Make color uppercase
     * chance.color({casing: 'upper'})  => '#29CFA7'
     *
     * @param  [object] options
     * @return [string] color value
     */
    Chance.prototype.color = function (options) {

        function gray(value, delimiter) {
            return [value, value, value].join(delimiter || '');
        }

        function rgb(hasAlpha) {

            var rgbValue    = (hasAlpha)    ? 'rgba' : 'rgb'; 
            var alphaChanal = (hasAlpha)    ? (',' + this.floating({min:0, max:1})) : "";
            var colorValue  = (isGrayscale) ? (gray(this.natural({max: 255}), ',')) : (this.natural({max: 255}) + ',' + this.natural({max: 255}) + ',' + this.natural({max: 255}));

            return rgbValue + '(' + colorValue + alphaChanal + ')';
        }

        function hex(start, end, withHash) {

            var simbol = (withHash) ? "#" : "";
            var expression  = (isGrayscale ? gray(this.hash({length: start})) : this.hash({length: end})); 
            return simbol + expression;
        }

        options = initOptions(options, {
            format: this.pick(['hex', 'shorthex', 'rgb', 'rgba', '0x', 'name']),
            grayscale: false,
            casing: 'lower'
        });

        var isGrayscale = options.grayscale;
        var colorValue;

        if (options.format === 'hex') {
            colorValue =  hex.call(this, 2, 6, true);
        }
        else if (options.format === 'shorthex') {
            colorValue = hex.call(this, 1, 3, true);
        } 
        else if (options.format === 'rgb') {
            colorValue = rgb.call(this, false);
        } 
        else if (options.format === 'rgba') {
            colorValue = rgb.call(this, true);
        } 
        else if (options.format === '0x') {
            colorValue = '0x' + hex.call(this, 2, 6);
        } 
        else if(options.format === 'name') {
            return this.pick(this.get("colorNames"));
        }
        else {
            throw new RangeError('Invalid format provided. Please provide one of "hex", "shorthex", "rgb", "rgba", "0x" or "name".');
        }

        if (options.casing === 'upper' ) {
            colorValue = colorValue.toUpperCase();
        }

        return colorValue;
    };

    Chance.prototype.domain = function (options) {
        options = initOptions(options);
        return this.word() + '.' + (options.tld || this.tld());
    };

    Chance.prototype.email = function (options) {
        options = initOptions(options);
        return this.word({length: options.length}) + '@' + (options.domain || this.domain());
    };

    Chance.prototype.fbid = function () {
        return parseInt('10000' + this.natural({max: 100000000000}), 10);
    };

    Chance.prototype.google_analytics = function () {
        var account = this.pad(this.natural({max: 999999}), 6);
        var property = this.pad(this.natural({max: 99}), 2);

        return 'UA-' + account + '-' + property;
    };

    Chance.prototype.hashtag = function () {
        return '#' + this.word();
    };

    Chance.prototype.ip = function () {
        // Todo: This could return some reserved IPs. See http://vq.io/137dgYy
        // this should probably be updated to account for that rare as it may be
        return this.natural({min: 1, max: 254}) + '.' +
               this.natural({max: 255}) + '.' +
               this.natural({max: 255}) + '.' +
               this.natural({min: 1, max: 254});
    };

    Chance.prototype.ipv6 = function () {
        var ip_addr = this.n(this.hash, 8, {length: 4});

        return ip_addr.join(":");
    };

    Chance.prototype.klout = function () {
        return this.natural({min: 1, max: 99});
    };

    Chance.prototype.semver = function (options) {
        options = initOptions(options, { include_prerelease: true });

        var range = this.pickone(["^", "~", "<", ">", "<=", ">=", "="]);
        if (options.range) {
            range = options.range;
        }

        var prerelease = "";
        if (options.include_prerelease) {
            prerelease = this.weighted(["", "-dev", "-beta", "-alpha"], [50, 10, 5, 1]);
        }
        return range + this.rpg('3d10').join('.') + prerelease;
    };

    Chance.prototype.tlds = function () {
        return ['com', 'org', 'edu', 'gov', 'co.uk', 'net', 'io', 'ac', 'ad', 'ae', 'af', 'ag', 'ai', 'al', 'am', 'an', 'ao', 'aq', 'ar', 'as', 'at', 'au', 'aw', 'ax', 'az', 'ba', 'bb', 'bd', 'be', 'bf', 'bg', 'bh', 'bi', 'bj', 'bm', 'bn', 'bo', 'bq', 'br', 'bs', 'bt', 'bv', 'bw', 'by', 'bz', 'ca', 'cc', 'cd', 'cf', 'cg', 'ch', 'ci', 'ck', 'cl', 'cm', 'cn', 'co', 'cr', 'cu', 'cv', 'cw', 'cx', 'cy', 'cz', 'de', 'dj', 'dk', 'dm', 'do', 'dz', 'ec', 'ee', 'eg', 'eh', 'er', 'es', 'et', 'eu', 'fi', 'fj', 'fk', 'fm', 'fo', 'fr', 'ga', 'gb', 'gd', 'ge', 'gf', 'gg', 'gh', 'gi', 'gl', 'gm', 'gn', 'gp', 'gq', 'gr', 'gs', 'gt', 'gu', 'gw', 'gy', 'hk', 'hm', 'hn', 'hr', 'ht', 'hu', 'id', 'ie', 'il', 'im', 'in', 'io', 'iq', 'ir', 'is', 'it', 'je', 'jm', 'jo', 'jp', 'ke', 'kg', 'kh', 'ki', 'km', 'kn', 'kp', 'kr', 'kw', 'ky', 'kz', 'la', 'lb', 'lc', 'li', 'lk', 'lr', 'ls', 'lt', 'lu', 'lv', 'ly', 'ma', 'mc', 'md', 'me', 'mg', 'mh', 'mk', 'ml', 'mm', 'mn', 'mo', 'mp', 'mq', 'mr', 'ms', 'mt', 'mu', 'mv', 'mw', 'mx', 'my', 'mz', 'na', 'nc', 'ne', 'nf', 'ng', 'ni', 'nl', 'no', 'np', 'nr', 'nu', 'nz', 'om', 'pa', 'pe', 'pf', 'pg', 'ph', 'pk', 'pl', 'pm', 'pn', 'pr', 'ps', 'pt', 'pw', 'py', 'qa', 're', 'ro', 'rs', 'ru', 'rw', 'sa', 'sb', 'sc', 'sd', 'se', 'sg', 'sh', 'si', 'sj', 'sk', 'sl', 'sm', 'sn', 'so', 'sr', 'ss', 'st', 'su', 'sv', 'sx', 'sy', 'sz', 'tc', 'td', 'tf', 'tg', 'th', 'tj', 'tk', 'tl', 'tm', 'tn', 'to', 'tp', 'tr', 'tt', 'tv', 'tw', 'tz', 'ua', 'ug', 'uk', 'us', 'uy', 'uz', 'va', 'vc', 've', 'vg', 'vi', 'vn', 'vu', 'wf', 'ws', 'ye', 'yt', 'za', 'zm', 'zw'];
    };

    Chance.prototype.tld = function () {
        return this.pick(this.tlds());
    };

    Chance.prototype.twitter = function () {
        return '@' + this.word();
    };

    Chance.prototype.url = function (options) {
        options = initOptions(options, { protocol: "http", domain: this.domain(options), domain_prefix: "", path: this.word(), extensions: []});

        var extension = options.extensions.length > 0 ? "." + this.pick(options.extensions) : "";
        var domain = options.domain_prefix ? options.domain_prefix + "." + options.domain : options.domain;

        return options.protocol + "://" + domain + "/" + options.path + extension;
    };

    // -- End Web --

    // -- Location --

    Chance.prototype.address = function (options) {
        options = initOptions(options);
        return this.natural({min: 5, max: 2000}) + ' ' + this.street(options);
    };

    Chance.prototype.altitude = function (options) {
        options = initOptions(options, {fixed: 5, min: 0, max: 8848});
        return this.floating({
            min: options.min,
            max: options.max,
            fixed: options.fixed
        });
    };

    Chance.prototype.areacode = function (options) {
        options = initOptions(options, {parens : true});
        // Don't want area codes to start with 1, or have a 9 as the second digit
        var areacode = this.natural({min: 2, max: 9}).toString() +
                this.natural({min: 0, max: 8}).toString() +
                this.natural({min: 0, max: 9}).toString();

        return options.parens ? '(' + areacode + ')' : areacode;
    };

    Chance.prototype.city = function () {
        return this.capitalize(this.word({syllables: 3}));
    };

    Chance.prototype.coordinates = function (options) {
        return this.latitude(options) + ', ' + this.longitude(options);
    };

    Chance.prototype.countries = function () {
        return this.get("countries");
    };

    Chance.prototype.country = function (options) {
        options = initOptions(options);
        var country = this.pick(this.countries());
        return options.full ? country.name : country.abbreviation;
    };

    Chance.prototype.depth = function (options) {
        options = initOptions(options, {fixed: 5, min: -10994, max: 0});
        return this.floating({
            min: options.min,
            max: options.max,
            fixed: options.fixed
        });
    };

    Chance.prototype.geohash = function (options) {
        options = initOptions(options, { length: 7 });
        return this.string({ length: options.length, pool: '0123456789bcdefghjkmnpqrstuvwxyz' });
    };

    Chance.prototype.geojson = function (options) {
        return this.latitude(options) + ', ' + this.longitude(options) + ', ' + this.altitude(options);
    };

    Chance.prototype.latitude = function (options) {
        options = initOptions(options, {fixed: 5, min: -90, max: 90});
        return this.floating({min: options.min, max: options.max, fixed: options.fixed});
    };

    Chance.prototype.longitude = function (options) {
        options = initOptions(options, {fixed: 5, min: -180, max: 180});
        return this.floating({min: options.min, max: options.max, fixed: options.fixed});
    };

    Chance.prototype.phone = function (options) {
        var self = this,
            numPick,
            ukNum = function (parts) {
                var section = [];
                //fills the section part of the phone number with random numbers.
                parts.sections.forEach(function(n) {
                    section.push(self.string({ pool: '0123456789', length: n}));
                });
                return parts.area + section.join(' ');
            };
        options = initOptions(options, {
            formatted: true,
            country: 'us',
            mobile: false
        });
        if (!options.formatted) {
            options.parens = false;
        }
        var phone;
        switch (options.country) {
            case 'fr':
                if (!options.mobile) {
                    numPick = this.pick([
                        // Valid zone and département codes.
                        '01' + this.pick(['30', '34', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48', '49', '53', '55', '56', '58', '60', '64', '69', '70', '72', '73', '74', '75', '76', '77', '78', '79', '80', '81', '82', '83']) + self.string({ pool: '0123456789', length: 6}),
                        '02' + this.pick(['14', '18', '22', '23', '28', '29', '30', '31', '32', '33', '34', '35', '36', '37', '38', '40', '41', '43', '44', '45', '46', '47', '48', '49', '50', '51', '52', '53', '54', '56', '57', '61', '62', '69', '72', '76', '77', '78', '85', '90', '96', '97', '98', '99']) + self.string({ pool: '0123456789', length: 6}),
                        '03' + this.pick(['10', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '39', '44', '45', '51', '52', '54', '55', '57', '58', '59', '60', '61', '62', '63', '64', '65', '66', '67', '68', '69', '70', '71', '72', '73', '80', '81', '82', '83', '84', '85', '86', '87', '88', '89', '90']) + self.string({ pool: '0123456789', length: 6}),
                        '04' + this.pick(['11', '13', '15', '20', '22', '26', '27', '30', '32', '34', '37', '42', '43', '44', '50', '56', '57', '63', '66', '67', '68', '69', '70', '71', '72', '73', '74', '75', '76', '77', '78', '79', '80', '81', '82', '83', '84', '85', '86', '88', '89', '90', '91', '92', '93', '94', '95', '97', '98']) + self.string({ pool: '0123456789', length: 6}),
                        '05' + this.pick(['08', '16', '17', '19', '24', '31', '32', '33', '34', '35', '40', '45', '46', '47', '49', '53', '55', '56', '57', '58', '59', '61', '62', '63', '64', '65', '67', '79', '81', '82', '86', '87', '90', '94']) + self.string({ pool: '0123456789', length: 6}),
                        '09' + self.string({ pool: '0123456789', length: 8}),
                    ]);
                    phone = options.formatted ? numPick.match(/../g).join(' ') : numPick;
                } else {
                    numPick = this.pick(['06', '07']) + self.string({ pool: '0123456789', length: 8});
                    phone = options.formatted ? numPick.match(/../g).join(' ') : numPick;
                }
                break;
            case 'uk':
                if (!options.mobile) {
                    numPick = this.pick([
                        //valid area codes of major cities/counties followed by random numbers in required format.
                        { area: '01' + this.character({ pool: '234569' }) + '1 ', sections: [3,4] },
                        { area: '020 ' + this.character({ pool: '378' }), sections: [3,4] },
                        { area: '023 ' + this.character({ pool: '89' }), sections: [3,4] },
                        { area: '024 7', sections: [3,4] },
                        { area: '028 ' + this.pick(['25','28','37','71','82','90','92','95']), sections: [2,4] },
                        { area: '012' + this.pick(['04','08','54','76','97','98']) + ' ', sections: [5] },
                        { area: '013' + this.pick(['63','64','84','86']) + ' ', sections: [5] },
                        { area: '014' + this.pick(['04','20','60','61','80','88']) + ' ', sections: [5] },
                        { area: '015' + this.pick(['24','27','62','66']) + ' ', sections: [5] },
                        { area: '016' + this.pick(['06','29','35','47','59','95']) + ' ', sections: [5] },
                        { area: '017' + this.pick(['26','44','50','68']) + ' ', sections: [5] },
                        { area: '018' + this.pick(['27','37','84','97']) + ' ', sections: [5] },
                        { area: '019' + this.pick(['00','05','35','46','49','63','95']) + ' ', sections: [5] }
                    ]);
                    phone = options.formatted ? ukNum(numPick) : ukNum(numPick).replace(' ', '', 'g');
                } else {
                    numPick = this.pick([
                        { area: '07' + this.pick(['4','5','7','8','9']), sections: [2,6] },
                        { area: '07624 ', sections: [6] }
                    ]);
                    phone = options.formatted ? ukNum(numPick) : ukNum(numPick).replace(' ', '');
                }
                break;
            case 'us':
                var areacode = this.areacode(options).toString();
                var exchange = this.natural({ min: 2, max: 9 }).toString() +
                    this.natural({ min: 0, max: 9 }).toString() +
                    this.natural({ min: 0, max: 9 }).toString();
                var subscriber = this.natural({ min: 1000, max: 9999 }).toString(); // this could be random [0-9]{4}
                phone = options.formatted ? areacode + ' ' + exchange + '-' + subscriber : areacode + exchange + subscriber;
        }
        return phone;
    };

    Chance.prototype.postal = function () {
        // Postal District
        var pd = this.character({pool: "XVTSRPNKLMHJGECBA"});
        // Forward Sortation Area (FSA)
        var fsa = pd + this.natural({max: 9}) + this.character({alpha: true, casing: "upper"});
        // Local Delivery Unut (LDU)
        var ldu = this.natural({max: 9}) + this.character({alpha: true, casing: "upper"}) + this.natural({max: 9});

        return fsa + " " + ldu;
    };

    Chance.prototype.provinces = function (options) {
        options = initOptions(options, { country: 'ca' });
        return this.get("provinces")[options.country.toLowerCase()];
    };

    Chance.prototype.province = function (options) {
        return (options && options.full) ?
            this.pick(this.provinces(options)).name :
            this.pick(this.provinces(options)).abbreviation;
    };

    Chance.prototype.state = function (options) {
        return (options && options.full) ?
            this.pick(this.states(options)).name :
            this.pick(this.states(options)).abbreviation;
    };

    Chance.prototype.states = function (options) {
        options = initOptions(options, { country: 'us', us_states_and_dc: true } );

        var states;

        switch (options.country.toLowerCase()) {
            case 'us':
                var us_states_and_dc = this.get("us_states_and_dc"),
                    territories = this.get("territories"),
                    armed_forces = this.get("armed_forces");

                states = [];

                if (options.us_states_and_dc) {
                    states = states.concat(us_states_and_dc);
                }
                if (options.territories) {
                    states = states.concat(territories);
                }
                if (options.armed_forces) {
                    states = states.concat(armed_forces);
                }
                break;
            case 'it':
                states = this.get("country_regions")[options.country.toLowerCase()];
        }

        return states;
    };

    Chance.prototype.street = function (options) {
        options = initOptions(options, { country: 'us', syllables: 2 });
        var     street;

        switch (options.country.toLowerCase()) {
            case 'us':
                street = this.word({ syllables: options.syllables });
                street = this.capitalize(street);
                street += ' ';
                street += options.short_suffix ?
                    this.street_suffix(options).abbreviation :
                    this.street_suffix(options).name;
                break;
            case 'it':
                street = this.word({ syllables: options.syllables });
                street = this.capitalize(street);
                street = (options.short_suffix ?
                    this.street_suffix(options).abbreviation :
                    this.street_suffix(options).name) + " " + street;
                break;
        }
        return street;
    };

    Chance.prototype.street_suffix = function (options) {
        options = initOptions(options, { country: 'us' });
        return this.pick(this.street_suffixes(options));
    };

    Chance.prototype.street_suffixes = function (options) {
        options = initOptions(options, { country: 'us' });
        // These are the most common suffixes.
        return this.get("street_suffixes")[options.country.toLowerCase()];
    };

    // Note: only returning US zip codes, internationalization will be a whole
    // other beast to tackle at some point.
    Chance.prototype.zip = function (options) {
        var zip = this.n(this.natural, 5, {max: 9});

        if (options && options.plusfour === true) {
            zip.push('-');
            zip = zip.concat(this.n(this.natural, 4, {max: 9}));
        }

        return zip.join("");
    };

    // -- End Location --

    // -- Time

    Chance.prototype.ampm = function () {
        return this.bool() ? 'am' : 'pm';
    };

    Chance.prototype.date = function (options) {
        var date_string, date;

        // If interval is specified we ignore preset
        if(options && (options.min || options.max)) {
            options = initOptions(options, {
                american: true,
                string: false
            });
            var min = typeof options.min !== "undefined" ? options.min.getTime() : 1;
            // 100,000,000 days measured relative to midnight at the beginning of 01 January, 1970 UTC. http://es5.github.io/#x15.9.1.1
            var max = typeof options.max !== "undefined" ? options.max.getTime() : 8640000000000000;

            date = new Date(this.natural({min: min, max: max}));
        } else {
            var m = this.month({raw: true});
            var daysInMonth = m.days;

            if(options && options.month) {
                // Mod 12 to allow months outside range of 0-11 (not encouraged, but also not prevented).
                daysInMonth = this.get('months')[((options.month % 12) + 12) % 12].days;
            }

            options = initOptions(options, {
                year: parseInt(this.year(), 10),
                // Necessary to subtract 1 because Date() 0-indexes month but not day or year
                // for some reason.
                month: m.numeric - 1,
                day: this.natural({min: 1, max: daysInMonth}),
                hour: this.hour(),
                minute: this.minute(),
                second: this.second(),
                millisecond: this.millisecond(),
                american: true,
                string: false
            });

            date = new Date(options.year, options.month, options.day, options.hour, options.minute, options.second, options.millisecond);
        }

        if (options.american) {
            // Adding 1 to the month is necessary because Date() 0-indexes
            // months but not day for some odd reason.
            date_string = (date.getMonth() + 1) + '/' + date.getDate() + '/' + date.getFullYear();
        } else {
            date_string = date.getDate() + '/' + (date.getMonth() + 1) + '/' + date.getFullYear();
        }

        return options.string ? date_string : date;
    };

    Chance.prototype.hammertime = function (options) {
        return this.date(options).getTime();
    };

    Chance.prototype.hour = function (options) {
        options = initOptions(options, {
            min: options && options.twentyfour ? 0 : 1,
            max: options && options.twentyfour ? 23 : 12
        });

        testRange(options.min < 0, "Chance: Min cannot be less than 0.");
        testRange(options.twentyfour && options.max > 23, "Chance: Max cannot be greater than 23 for twentyfour option.");
        testRange(!options.twentyfour && options.max > 12, "Chance: Max cannot be greater than 12.");
        testRange(options.min > options.max, "Chance: Min cannot be greater than Max.");

        return this.natural({min: options.min, max: options.max});
    };

    Chance.prototype.millisecond = function () {
        return this.natural({max: 999});
    };

    Chance.prototype.minute = Chance.prototype.second = function (options) {
        options = initOptions(options, {min: 0, max: 59});

        testRange(options.min < 0, "Chance: Min cannot be less than 0.");
        testRange(options.max > 59, "Chance: Max cannot be greater than 59.");
        testRange(options.min > options.max, "Chance: Min cannot be greater than Max.");

        return this.natural({min: options.min, max: options.max});
    };

    Chance.prototype.month = function (options) {
        options = initOptions(options, {min: 1, max: 12});

        testRange(options.min < 1, "Chance: Min cannot be less than 1.");
        testRange(options.max > 12, "Chance: Max cannot be greater than 12.");
        testRange(options.min > options.max, "Chance: Min cannot be greater than Max.");

        var month = this.pick(this.months().slice(options.min - 1, options.max));
        return options.raw ? month : month.name;
    };

    Chance.prototype.months = function () {
        return this.get("months");
    };

    Chance.prototype.second = function () {
        return this.natural({max: 59});
    };

    Chance.prototype.timestamp = function () {
        return this.natural({min: 1, max: parseInt(new Date().getTime() / 1000, 10)});
    };

    Chance.prototype.weekday = function (options) {
        options = initOptions(options, {weekday_only: false});
        var weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
        if (!options.weekday_only) {
            weekdays.push("Saturday");
            weekdays.push("Sunday");
        }
        return this.pickone(weekdays);
    };

    Chance.prototype.year = function (options) {
        // Default to current year as min if none specified
        options = initOptions(options, {min: new Date().getFullYear()});

        // Default to one century after current year as max if none specified
        options.max = (typeof options.max !== "undefined") ? options.max : options.min + 100;

        return this.natural(options).toString();
    };

    // -- End Time

    // -- Finance --

    Chance.prototype.cc = function (options) {
        options = initOptions(options);

        var type, number, to_generate;

        type = (options.type) ?
                    this.cc_type({ name: options.type, raw: true }) :
                    this.cc_type({ raw: true });

        number = type.prefix.split("");
        to_generate = type.length - type.prefix.length - 1;

        // Generates n - 1 digits
        number = number.concat(this.n(this.integer, to_generate, {min: 0, max: 9}));

        // Generates the last digit according to Luhn algorithm
        number.push(this.luhn_calculate(number.join("")));

        return number.join("");
    };

    Chance.prototype.cc_types = function () {
        // http://en.wikipedia.org/wiki/Bank_card_number#Issuer_identification_number_.28IIN.29
        return this.get("cc_types");
    };

    Chance.prototype.cc_type = function (options) {
        options = initOptions(options);
        var types = this.cc_types(),
            type = null;

        if (options.name) {
            for (var i = 0; i < types.length; i++) {
                // Accept either name or short_name to specify card type
                if (types[i].name === options.name || types[i].short_name === options.name) {
                    type = types[i];
                    break;
                }
            }
            if (type === null) {
                throw new RangeError("Credit card type '" + options.name + "'' is not supported");
            }
        } else {
            type = this.pick(types);
        }

        return options.raw ? type : type.name;
    };

    //return all world currency by ISO 4217
    Chance.prototype.currency_types = function () {
        return this.get("currency_types");
    };

    //return random world currency by ISO 4217
    Chance.prototype.currency = function () {
        return this.pick(this.currency_types());
    };

    //Return random correct currency exchange pair (e.g. EUR/USD) or array of currency code
    Chance.prototype.currency_pair = function (returnAsString) {
        var currencies = this.unique(this.currency, 2, {
            comparator: function(arr, val) {

                return arr.reduce(function(acc, item) {
                    // If a match has been found, short circuit check and just return
                    return acc || (item.code === val.code);
                }, false);
            }
        });

        if (returnAsString) {
            return currencies[0].code + '/' + currencies[1].code;
        } else {
            return currencies;
        }
    };

    Chance.prototype.dollar = function (options) {
        // By default, a somewhat more sane max for dollar than all available numbers
        options = initOptions(options, {max : 10000, min : 0});

        var dollar = this.floating({min: options.min, max: options.max, fixed: 2}).toString(),
            cents = dollar.split('.')[1];

        if (cents === undefined) {
            dollar += '.00';
        } else if (cents.length < 2) {
            dollar = dollar + '0';
        }

        if (dollar < 0) {
            return '-$' + dollar.replace('-', '');
        } else {
            return '$' + dollar;
        }
    };

    Chance.prototype.euro = function (options) {
        return Number(this.dollar(options).replace("$", "")).toLocaleString() + "€";
    };

    Chance.prototype.exp = function (options) {
        options = initOptions(options);
        var exp = {};

        exp.year = this.exp_year();

        // If the year is this year, need to ensure month is greater than the
        // current month or this expiration will not be valid
        if (exp.year === (new Date().getFullYear()).toString()) {
            exp.month = this.exp_month({future: true});
        } else {
            exp.month = this.exp_month();
        }

        return options.raw ? exp : exp.month + '/' + exp.year;
    };

    Chance.prototype.exp_month = function (options) {
        options = initOptions(options);
        var month, month_int,
            // Date object months are 0 indexed
            curMonth = new Date().getMonth() + 1;

        if (options.future && (curMonth !== 12)) {
            do {
                month = this.month({raw: true}).numeric;
                month_int = parseInt(month, 10);
            } while (month_int <= curMonth);
        } else {
            month = this.month({raw: true}).numeric;
        }

        return month;
    };

    Chance.prototype.exp_year = function () {
        var curMonth = new Date().getMonth() + 1,
            curYear = new Date().getFullYear();

        return this.year({min: ((curMonth === 12) ? (curYear + 1) : curYear), max: (curYear + 10)});
    };

    Chance.prototype.vat = function (options) {
        options = initOptions(options, { country: 'it' });
        switch (options.country.toLowerCase()) {
            case 'it':
                return this.it_vat();
        }
    };

    // -- End Finance

    // -- Regional

    Chance.prototype.it_vat = function () {
        var it_vat = this.natural({min: 1, max: 1800000});

        it_vat = this.pad(it_vat, 7) + this.pad(this.pick(this.provinces({ country: 'it' })).code, 3);
        return it_vat + this.luhn_calculate(it_vat);
    };

    /*
     * this generator is written following the official algorithm
     * all data can be passed explicitely or randomized by calling chance.cf() without options
     * the code does not check that the input data is valid (it goes beyond the scope of the generator)
     *
     * @param  [Object] options = { first: first name,
     *                              last: last name,
     *                              gender: female|male,
                                    birthday: JavaScript date object,
                                    city: string(4), 1 letter + 3 numbers
                                   }
     * @return [string] codice fiscale
     *
    */
    Chance.prototype.cf = function (options) {
        options = options || {};
        var gender = !!options.gender ? options.gender : this.gender(),
            first = !!options.first ? options.first : this.first( { gender: gender, nationality: 'it'} ),
            last = !!options.last ? options.last : this.last( { nationality: 'it'} ),
            birthday = !!options.birthday ? options.birthday : this.birthday(),
            city = !!options.city ? options.city : this.pickone(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'L', 'M', 'Z']) + this.pad(this.natural({max:999}), 3),
            cf = [],
            name_generator = function(name, isLast) {
                var temp,
                    return_value = [];

                if (name.length < 3) {
                    return_value = name.split("").concat("XXX".split("")).splice(0,3);
                }
                else {
                    temp = name.toUpperCase().split('').map(function(c){
                        return ("BCDFGHJKLMNPRSTVWZ".indexOf(c) !== -1) ? c : undefined;
                    }).join('');
                    if (temp.length > 3) {
                        if (isLast) {
                            temp = temp.substr(0,3);
                        } else {                        
                            temp = temp[0] + temp.substr(2,2);
                        }
                    }
                    if (temp.length < 3) {
                        return_value = temp;
                        temp = name.toUpperCase().split('').map(function(c){
                            return ("AEIOU".indexOf(c) !== -1) ? c : undefined;
                        }).join('').substr(0, 3 - return_value.length);
                    }
                    return_value = return_value + temp;
                }

                return return_value;
            },
            date_generator = function(birthday, gender, that) {
                var lettermonths = ['A', 'B', 'C', 'D', 'E', 'H', 'L', 'M', 'P', 'R', 'S', 'T'];

                return  birthday.getFullYear().toString().substr(2) + 
                        lettermonths[birthday.getMonth()] +
                        that.pad(birthday.getDate() + ((gender.toLowerCase() === "female") ? 40 : 0), 2);
            },
            checkdigit_generator = function(cf) {
                var range1 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ",
                    range2 = "ABCDEFGHIJABCDEFGHIJKLMNOPQRSTUVWXYZ",
                    evens  = "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
                    odds   = "BAKPLCQDREVOSFTGUHMINJWZYX",
                    digit  = 0;


                for(var i = 0; i < 15; i++) {
                    if (i % 2 !== 0) {
                        digit += evens.indexOf(range2[range1.indexOf(cf[i])]);
                    }
                    else {
                        digit +=  odds.indexOf(range2[range1.indexOf(cf[i])]);
                    }
                }
                return evens[digit % 26];
            };

        cf = cf.concat(name_generator(last, true), name_generator(first), date_generator(birthday, gender, this), city.toUpperCase().split("")).join("");
        cf += checkdigit_generator(cf.toUpperCase(), this);

        return cf.toUpperCase();
    };

    Chance.prototype.pl_pesel = function () {
        var number = this.natural({min: 1, max: 9999999999});
        var arr = this.pad(number, 10).split('');
        for (var i = 0; i < arr.length; i++) {
            arr[i] = parseInt(arr[i]);
        }

        var controlNumber = (1 * arr[0] + 3 * arr[1] + 7 * arr[2] + 9 * arr[3] + 1 * arr[4] + 3 * arr[5] + 7 * arr[6] + 9 * arr[7] + 1 * arr[8] + 3 * arr[9]) % 10;
        if(controlNumber !== 0) {
            controlNumber = 10 - controlNumber;
        }

        return arr.join('') + controlNumber;
    };

    Chance.prototype.pl_nip = function () {
        var number = this.natural({min: 1, max: 999999999});
        var arr = this.pad(number, 9).split('');
        for (var i = 0; i < arr.length; i++) {
            arr[i] = parseInt(arr[i]);
        }

        var controlNumber = (6 * arr[0] + 5 * arr[1] + 7 * arr[2] + 2 * arr[3] + 3 * arr[4] + 4 * arr[5] + 5 * arr[6] + 6 * arr[7] + 7 * arr[8]) % 11;
        if(controlNumber === 10) {
            return this.pl_nip();
        }

        return arr.join('') + controlNumber;
    };

    Chance.prototype.pl_regon = function () {
        var number = this.natural({min: 1, max: 99999999});
        var arr = this.pad(number, 8).split('');
        for (var i = 0; i < arr.length; i++) {
            arr[i] = parseInt(arr[i]);
        }

        var controlNumber = (8 * arr[0] + 9 * arr[1] + 2 * arr[2] + 3 * arr[3] + 4 * arr[4] + 5 * arr[5] + 6 * arr[6] + 7 * arr[7]) % 11;
        if(controlNumber === 10) {
            controlNumber = 0;
        }

        return arr.join('') + controlNumber;
    };

    // -- End Regional

    // -- Miscellaneous --

    // Dice - For all the board game geeks out there, myself included ;)
    function diceFn (range) {
        return function () {
            return this.natural(range);
        };
    }
    Chance.prototype.d4 = diceFn({min: 1, max: 4});
    Chance.prototype.d6 = diceFn({min: 1, max: 6});
    Chance.prototype.d8 = diceFn({min: 1, max: 8});
    Chance.prototype.d10 = diceFn({min: 1, max: 10});
    Chance.prototype.d12 = diceFn({min: 1, max: 12});
    Chance.prototype.d20 = diceFn({min: 1, max: 20});
    Chance.prototype.d30 = diceFn({min: 1, max: 30});
    Chance.prototype.d100 = diceFn({min: 1, max: 100});

    Chance.prototype.rpg = function (thrown, options) {
        options = initOptions(options);
        if (!thrown) {
            throw new RangeError("A type of die roll must be included");
        } else {
            var bits = thrown.toLowerCase().split("d"),
                rolls = [];

            if (bits.length !== 2 || !parseInt(bits[0], 10) || !parseInt(bits[1], 10)) {
                throw new Error("Invalid format provided. Please provide #d# where the first # is the number of dice to roll, the second # is the max of each die");
            }
            for (var i = bits[0]; i > 0; i--) {
                rolls[i - 1] = this.natural({min: 1, max: bits[1]});
            }
            return (typeof options.sum !== 'undefined' && options.sum) ? rolls.reduce(function (p, c) { return p + c; }) : rolls;
        }
    };

    // Guid
    Chance.prototype.guid = function (options) {
        options = initOptions(options, { version: 5 });

        var guid_pool = "abcdef1234567890",
            variant_pool = "ab89",
            guid = this.string({ pool: guid_pool, length: 8 }) + '-' +
                   this.string({ pool: guid_pool, length: 4 }) + '-' +
                   // The Version
                   options.version +
                   this.string({ pool: guid_pool, length: 3 }) + '-' +
                   // The Variant
                   this.string({ pool: variant_pool, length: 1 }) +
                   this.string({ pool: guid_pool, length: 3 }) + '-' +
                   this.string({ pool: guid_pool, length: 12 });
        return guid;
    };

    // Hash
    Chance.prototype.hash = function (options) {
        options = initOptions(options, {length : 40, casing: 'lower'});
        var pool = options.casing === 'upper' ? HEX_POOL.toUpperCase() : HEX_POOL;
        return this.string({pool: pool, length: options.length});
    };

    Chance.prototype.luhn_check = function (num) {
        var str = num.toString();
        var checkDigit = +str.substring(str.length - 1);
        return checkDigit === this.luhn_calculate(+str.substring(0, str.length - 1));
    };

    Chance.prototype.luhn_calculate = function (num) {
        var digits = num.toString().split("").reverse();
        var sum = 0;
        var digit;

        for (var i = 0, l = digits.length; l > i; ++i) {
            digit = +digits[i];
            if (i % 2 === 0) {
                digit *= 2;
                if (digit > 9) {
                    digit -= 9;
                }
            }
            sum += digit;
        }
        return (sum * 9) % 10;
    };

    // MD5 Hash
    Chance.prototype.md5 = function(options) {
        var opts = { str: '', key: null, raw: false };

        if (!options) {
            opts.str = this.string();
            options = {};
        }
        else if (typeof options === 'string') {
            opts.str = options;
            options = {};
        }
        else if (typeof options !== 'object') {
            return null;
        }
        else if(options.constructor === 'Array') {
            return null;
        }

        opts = initOptions(options, opts);

        if(!opts.str){
            throw new Error('A parameter is required to return an md5 hash.');
        }

        return this.bimd5.md5(opts.str, opts.key, opts.raw);
    };

    /**
     * #Description:
     * =====================================================
     * Generate random file name with extention
     *
     * The argument provide extention type 
     * -> raster 
     * -> vector
     * -> 3d
     * -> document
     *
     * If noting is provided the function return random file name with random 
     * extention type of any kind
     *
     * The user can validate the file name length range 
     * If noting provided the generated file name is radom
     *
     * #Extention Pool :
     * * Currently the supported extentions are 
     *  -> some of the most popular raster image extentions
     *  -> some of the most popular vector image extentions
     *  -> some of the most popular 3d image extentions
     *  -> some of the most popular document extentions
     * 
     * #Examples :
     * =====================================================
     *
     * Return random file name with random extention. The file extention
     * is provided by a predifined collection of extentions. More abouth the extention
     * pool can be fond in #Extention Pool section
     * 
     * chance.file()                        
     * => dsfsdhjf.xml
     *
     * In order to generate a file name with sspecific length, specify the 
     * length property and integer value. The extention is going to be random
     *  
     * chance.file({length : 10})           
     * => asrtineqos.pdf
     *
     * In order to geerate file with extention form some of the predifined groups
     * of the extention pool just specify the extenton pool category in fileType property
     *  
     * chance.file({fileType : 'raster'})   
     * => dshgssds.psd
     *
     * You can provide specific extention for your files
     * chance.file({extention : 'html'})    
     * => djfsd.html
     *
     * Or you could pass custom collection of extentons bt array or by object
     * chance.file({extentions : [...]})    
     * => dhgsdsd.psd
     *  
     * chance.file({extentions : { key : [...], key : [...]}})
     * => djsfksdjsd.xml
     * 
     * @param  [collection] options 
     * @return [string]
     * 
     */
    Chance.prototype.file = function(options) {
        
        var fileOptions = options || {};
        var poolCollectionKey = "fileExtension";
        var typeRange   = Object.keys(this.get("fileExtension"));//['raster', 'vector', '3d', 'document'];
        var fileName;
        var fileExtention;

        // Generate random file name 
        fileName = this.word({length : fileOptions.length});

        // Generate file by specific extention provided by the user
        if(fileOptions.extention) {

            fileExtention = fileOptions.extention;
            return (fileName + '.' + fileExtention);
        }

        // Generate file by specific axtention collection
        if(fileOptions.extentions) {

            if(Array.isArray(fileOptions.extentions)) {

                fileExtention = this.pickone(fileOptions.extentions);
                return (fileName + '.' + fileExtention);
            }
            else if(fileOptions.extentions.constructor === Object) {
                
                var extentionObjectCollection = fileOptions.extentions;
                var keys = Object.keys(extentionObjectCollection);

                fileExtention = this.pickone(extentionObjectCollection[this.pickone(keys)]);
                return (fileName + '.' + fileExtention);
            }

            throw new Error("Expect collection of type Array or Object to be passed as an argument ");
        } 

        // Generate file extention based on specific file type
        if(fileOptions.fileType) {

            var fileType = fileOptions.fileType;
            if(typeRange.indexOf(fileType) !== -1) {

                fileExtention = this.pickone(this.get(poolCollectionKey)[fileType]);
                return (fileName + '.' + fileExtention);
            }

            throw new Error("Expect file type value to be 'raster', 'vector', '3d' or 'document' ");
        }

        // Generate random file name if no extenton options are passed
        fileExtention = this.pickone(this.get(poolCollectionKey)[this.pickone(typeRange)]);
        return (fileName + '.' + fileExtention);
    };     

    var data = {

        firstNames: {
            "male": {
                "en": ["James", "John", "Robert", "Michael", "William", "David", "Richard", "Joseph", "Charles", "Thomas", "Christopher", "Daniel", "Matthew", "George", "Donald", "Anthony", "Paul", "Mark", "Edward", "Steven", "Kenneth", "Andrew", "Brian", "Joshua", "Kevin", "Ronald", "Timothy", "Jason", "Jeffrey", "Frank", "Gary", "Ryan", "Nicholas", "Eric", "Stephen", "Jacob", "Larry", "Jonathan", "Scott", "Raymond", "Justin", "Brandon", "Gregory", "Samuel", "Benjamin", "Patrick", "Jack", "Henry", "Walter", "Dennis", "Jerry", "Alexander", "Peter", "Tyler", "Douglas", "Harold", "Aaron", "Jose", "Adam", "Arthur", "Zachary", "Carl", "Nathan", "Albert", "Kyle", "Lawrence", "Joe", "Willie", "Gerald", "Roger", "Keith", "Jeremy", "Terry", "Harry", "Ralph", "Sean", "Jesse", "Roy", "Louis", "Billy", "Austin", "Bruce", "Eugene", "Christian", "Bryan", "Wayne", "Russell", "Howard", "Fred", "Ethan", "Jordan", "Philip", "Alan", "Juan", "Randy", "Vincent", "Bobby", "Dylan", "Johnny", "Phillip", "Victor", "Clarence", "Ernest", "Martin", "Craig", "Stanley", "Shawn", "Travis", "Bradley", "Leonard", "Earl", "Gabriel", "Jimmy", "Francis", "Todd", "Noah", "Danny", "Dale", "Cody", "Carlos", "Allen", "Frederick", "Logan", "Curtis", "Alex", "Joel", "Luis", "Norman", "Marvin", "Glenn", "Tony", "Nathaniel", "Rodney", "Melvin", "Alfred", "Steve", "Cameron", "Chad", "Edwin", "Caleb", "Evan", "Antonio", "Lee", "Herbert", "Jeffery", "Isaac", "Derek", "Ricky", "Marcus", "Theodore", "Elijah", "Luke", "Jesus", "Eddie", "Troy", "Mike", "Dustin", "Ray", "Adrian", "Bernard", "Leroy", "Angel", "Randall", "Wesley", "Ian", "Jared", "Mason", "Hunter", "Calvin", "Oscar", "Clifford", "Jay", "Shane", "Ronnie", "Barry", "Lucas", "Corey", "Manuel", "Leo", "Tommy", "Warren", "Jackson", "Isaiah", "Connor", "Don", "Dean", "Jon", "Julian", "Miguel", "Bill", "Lloyd", "Charlie", "Mitchell", "Leon", "Jerome", "Darrell", "Jeremiah", "Alvin", "Brett", "Seth", "Floyd", "Jim", "Blake", "Micheal", "Gordon", "Trevor", "Lewis", "Erik", "Edgar", "Vernon", "Devin", "Gavin", "Jayden", "Chris", "Clyde", "Tom", "Derrick", "Mario", "Brent", "Marc", "Herman", "Chase", "Dominic", "Ricardo", "Franklin", "Maurice", "Max", "Aiden", "Owen", "Lester", "Gilbert", "Elmer", "Gene", "Francisco", "Glen", "Cory", "Garrett", "Clayton", "Sam", "Jorge", "Chester", "Alejandro", "Jeff", "Harvey", "Milton", "Cole", "Ivan", "Andre", "Duane", "Landon"],
                // Data taken from http://www.dati.gov.it/dataset/comune-di-firenze_0163
                "it": ["Adolfo", "Alberto", "Aldo", "Alessandro", "Alessio", "Alfredo", "Alvaro", "Andrea", "Angelo", "Angiolo", "Antonino", "Antonio", "Attilio", "Benito", "Bernardo", "Bruno", "Carlo", "Cesare", "Christian", "Claudio", "Corrado", "Cosimo", "Cristian", "Cristiano", "Daniele", "Dario", "David", "Davide", "Diego", "Dino", "Domenico", "Duccio", "Edoardo", "Elia", "Elio", "Emanuele", "Emiliano", "Emilio", "Enrico", "Enzo", "Ettore", "Fabio", "Fabrizio", "Federico", "Ferdinando", "Fernando", "Filippo", "Francesco", "Franco", "Gabriele", "Giacomo", "Giampaolo", "Giampiero", "Giancarlo", "Gianfranco", "Gianluca", "Gianmarco", "Gianni", "Gino", "Giorgio", "Giovanni", "Giuliano", "Giulio", "Giuseppe", "Graziano", "Gregorio", "Guido", "Iacopo", "Jacopo", "Lapo", "Leonardo", "Lorenzo", "Luca", "Luciano", "Luigi", "Manuel", "Marcello", "Marco", "Marino", "Mario", "Massimiliano", "Massimo", "Matteo", "Mattia", "Maurizio", "Mauro", "Michele", "Mirko", "Mohamed", "Nello", "Neri", "Niccolò", "Nicola", "Osvaldo", "Otello", "Paolo", "Pier Luigi", "Piero", "Pietro", "Raffaele", "Remo", "Renato", "Renzo", "Riccardo", "Roberto", "Rolando", "Romano", "Salvatore", "Samuele", "Sandro", "Sergio", "Silvano", "Simone", "Stefano", "Thomas", "Tommaso", "Ubaldo", "Ugo", "Umberto", "Valerio", "Valter", "Vasco", "Vincenzo", "Vittorio"]
            },
            "female": {
                "en": ["Mary", "Emma", "Elizabeth", "Minnie", "Margaret", "Ida", "Alice", "Bertha", "Sarah", "Annie", "Clara", "Ella", "Florence", "Cora", "Martha", "Laura", "Nellie", "Grace", "Carrie", "Maude", "Mabel", "Bessie", "Jennie", "Gertrude", "Julia", "Hattie", "Edith", "Mattie", "Rose", "Catherine", "Lillian", "Ada", "Lillie", "Helen", "Jessie", "Louise", "Ethel", "Lula", "Myrtle", "Eva", "Frances", "Lena", "Lucy", "Edna", "Maggie", "Pearl", "Daisy", "Fannie", "Josephine", "Dora", "Rosa", "Katherine", "Agnes", "Marie", "Nora", "May", "Mamie", "Blanche", "Stella", "Ellen", "Nancy", "Effie", "Sallie", "Nettie", "Della", "Lizzie", "Flora", "Susie", "Maud", "Mae", "Etta", "Harriet", "Sadie", "Caroline", "Katie", "Lydia", "Elsie", "Kate", "Susan", "Mollie", "Alma", "Addie", "Georgia", "Eliza", "Lulu", "Nannie", "Lottie", "Amanda", "Belle", "Charlotte", "Rebecca", "Ruth", "Viola", "Olive", "Amelia", "Hannah", "Jane", "Virginia", "Emily", "Matilda", "Irene", "Kathryn", "Esther", "Willie", "Henrietta", "Ollie", "Amy", "Rachel", "Sara", "Estella", "Theresa", "Augusta", "Ora", "Pauline", "Josie", "Lola", "Sophia", "Leona", "Anne", "Mildred", "Ann", "Beulah", "Callie", "Lou", "Delia", "Eleanor", "Barbara", "Iva", "Louisa", "Maria", "Mayme", "Evelyn", "Estelle", "Nina", "Betty", "Marion", "Bettie", "Dorothy", "Luella", "Inez", "Lela", "Rosie", "Allie", "Millie", "Janie", "Cornelia", "Victoria", "Ruby", "Winifred", "Alta", "Celia", "Christine", "Beatrice", "Birdie", "Harriett", "Mable", "Myra", "Sophie", "Tillie", "Isabel", "Sylvia", "Carolyn", "Isabelle", "Leila", "Sally", "Ina", "Essie", "Bertie", "Nell", "Alberta", "Katharine", "Lora", "Rena", "Mina", "Rhoda", "Mathilda", "Abbie", "Eula", "Dollie", "Hettie", "Eunice", "Fanny", "Ola", "Lenora", "Adelaide", "Christina", "Lelia", "Nelle", "Sue", "Johanna", "Lilly", "Lucinda", "Minerva", "Lettie", "Roxie", "Cynthia", "Helena", "Hilda", "Hulda", "Bernice", "Genevieve", "Jean", "Cordelia", "Marian", "Francis", "Jeanette", "Adeline", "Gussie", "Leah", "Lois", "Lura", "Mittie", "Hallie", "Isabella", "Olga", "Phoebe", "Teresa", "Hester", "Lida", "Lina", "Winnie", "Claudia", "Marguerite", "Vera", "Cecelia", "Bess", "Emilie", "John", "Rosetta", "Verna", "Myrtie", "Cecilia", "Elva", "Olivia", "Ophelia", "Georgie", "Elnora", "Violet", "Adele", "Lily", "Linnie", "Loretta", "Madge", "Polly", "Virgie", "Eugenia", "Lucile", "Lucille", "Mabelle", "Rosalie"],
                // Data taken from http://www.dati.gov.it/dataset/comune-di-firenze_0162
                "it": ["Ada", "Adriana", "Alessandra", "Alessia", "Alice", "Angela", "Anna", "Anna Maria", "Annalisa", "Annita", "Annunziata", "Antonella", "Arianna", "Asia", "Assunta", "Aurora", "Barbara", "Beatrice", "Benedetta", "Bianca", "Bruna", "Camilla", "Carla", "Carlotta", "Carmela", "Carolina", "Caterina", "Catia", "Cecilia", "Chiara", "Cinzia", "Clara", "Claudia", "Costanza", "Cristina", "Daniela", "Debora", "Diletta", "Dina", "Donatella", "Elena", "Eleonora", "Elisa", "Elisabetta", "Emanuela", "Emma", "Eva", "Federica", "Fernanda", "Fiorella", "Fiorenza", "Flora", "Franca", "Francesca", "Gabriella", "Gaia", "Gemma", "Giada", "Gianna", "Gina", "Ginevra", "Giorgia", "Giovanna", "Giulia", "Giuliana", "Giuseppa", "Giuseppina", "Grazia", "Graziella", "Greta", "Ida", "Ilaria", "Ines", "Iolanda", "Irene", "Irma", "Isabella", "Jessica", "Laura", "Leda", "Letizia", "Licia", "Lidia", "Liliana", "Lina", "Linda", "Lisa", "Livia", "Loretta", "Luana", "Lucia", "Luciana", "Lucrezia", "Luisa", "Manuela", "Mara", "Marcella", "Margherita", "Maria", "Maria Cristina", "Maria Grazia", "Maria Luisa", "Maria Pia", "Maria Teresa", "Marina", "Marisa", "Marta", "Martina", "Marzia", "Matilde", "Melissa", "Michela", "Milena", "Mirella", "Monica", "Natalina", "Nella", "Nicoletta", "Noemi", "Olga", "Paola", "Patrizia", "Piera", "Pierina", "Raffaella", "Rebecca", "Renata", "Rina", "Rita", "Roberta", "Rosa", "Rosanna", "Rossana", "Rossella", "Sabrina", "Sandra", "Sara", "Serena", "Silvana", "Silvia", "Simona", "Simonetta", "Sofia", "Sonia", "Stefania", "Susanna", "Teresa", "Tina", "Tiziana", "Tosca", "Valentina", "Valeria", "Vanda", "Vanessa", "Vanna", "Vera", "Veronica", "Vilma", "Viola", "Virginia", "Vittoria"]
            }
        },

        lastNames: {
            "en": ['Smith', 'Johnson', 'Williams', 'Jones', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Thompson', 'Garcia', 'Martinez', 'Robinson', 'Clark', 'Rodriguez', 'Lewis', 'Lee', 'Walker', 'Hall', 'Allen', 'Young', 'Hernandez', 'King', 'Wright', 'Lopez', 'Hill', 'Scott', 'Green', 'Adams', 'Baker', 'Gonzalez', 'Nelson', 'Carter', 'Mitchell', 'Perez', 'Roberts', 'Turner', 'Phillips', 'Campbell', 'Parker', 'Evans', 'Edwards', 'Collins', 'Stewart', 'Sanchez', 'Morris', 'Rogers', 'Reed', 'Cook', 'Morgan', 'Bell', 'Murphy', 'Bailey', 'Rivera', 'Cooper', 'Richardson', 'Cox', 'Howard', 'Ward', 'Torres', 'Peterson', 'Gray', 'Ramirez', 'James', 'Watson', 'Brooks', 'Kelly', 'Sanders', 'Price', 'Bennett', 'Wood', 'Barnes', 'Ross', 'Henderson', 'Coleman', 'Jenkins', 'Perry', 'Powell', 'Long', 'Patterson', 'Hughes', 'Flores', 'Washington', 'Butler', 'Simmons', 'Foster', 'Gonzales', 'Bryant', 'Alexander', 'Russell', 'Griffin', 'Diaz', 'Hayes', 'Myers', 'Ford', 'Hamilton', 'Graham', 'Sullivan', 'Wallace', 'Woods', 'Cole', 'West', 'Jordan', 'Owens', 'Reynolds', 'Fisher', 'Ellis', 'Harrison', 'Gibson', 'McDonald', 'Cruz', 'Marshall', 'Ortiz', 'Gomez', 'Murray', 'Freeman', 'Wells', 'Webb', 'Simpson', 'Stevens', 'Tucker', 'Porter', 'Hunter', 'Hicks', 'Crawford', 'Henry', 'Boyd', 'Mason', 'Morales', 'Kennedy', 'Warren', 'Dixon', 'Ramos', 'Reyes', 'Burns', 'Gordon', 'Shaw', 'Holmes', 'Rice', 'Robertson', 'Hunt', 'Black', 'Daniels', 'Palmer', 'Mills', 'Nichols', 'Grant', 'Knight', 'Ferguson', 'Rose', 'Stone', 'Hawkins', 'Dunn', 'Perkins', 'Hudson', 'Spencer', 'Gardner', 'Stephens', 'Payne', 'Pierce', 'Berry', 'Matthews', 'Arnold', 'Wagner', 'Willis', 'Ray', 'Watkins', 'Olson', 'Carroll', 'Duncan', 'Snyder', 'Hart', 'Cunningham', 'Bradley', 'Lane', 'Andrews', 'Ruiz', 'Harper', 'Fox', 'Riley', 'Armstrong', 'Carpenter', 'Weaver', 'Greene', 'Lawrence', 'Elliott', 'Chavez', 'Sims', 'Austin', 'Peters', 'Kelley', 'Franklin', 'Lawson', 'Fields', 'Gutierrez', 'Ryan', 'Schmidt', 'Carr', 'Vasquez', 'Castillo', 'Wheeler', 'Chapman', 'Oliver', 'Montgomery', 'Richards', 'Williamson', 'Johnston', 'Banks', 'Meyer', 'Bishop', 'McCoy', 'Howell', 'Alvarez', 'Morrison', 'Hansen', 'Fernandez', 'Garza', 'Harvey', 'Little', 'Burton', 'Stanley', 'Nguyen', 'George', 'Jacobs', 'Reid', 'Kim', 'Fuller', 'Lynch', 'Dean', 'Gilbert', 'Garrett', 'Romero', 'Welch', 'Larson', 'Frazier', 'Burke', 'Hanson', 'Day', 'Mendoza', 'Moreno', 'Bowman', 'Medina', 'Fowler', 'Brewer', 'Hoffman', 'Carlson', 'Silva', 'Pearson', 'Holland', 'Douglas', 'Fleming', 'Jensen', 'Vargas', 'Byrd', 'Davidson', 'Hopkins', 'May', 'Terry', 'Herrera', 'Wade', 'Soto', 'Walters', 'Curtis', 'Neal', 'Caldwell', 'Lowe', 'Jennings', 'Barnett', 'Graves', 'Jimenez', 'Horton', 'Shelton', 'Barrett', 'Obrien', 'Castro', 'Sutton', 'Gregory', 'McKinney', 'Lucas', 'Miles', 'Craig', 'Rodriquez', 'Chambers', 'Holt', 'Lambert', 'Fletcher', 'Watts', 'Bates', 'Hale', 'Rhodes', 'Pena', 'Beck', 'Newman', 'Haynes', 'McDaniel', 'Mendez', 'Bush', 'Vaughn', 'Parks', 'Dawson', 'Santiago', 'Norris', 'Hardy', 'Love', 'Steele', 'Curry', 'Powers', 'Schultz', 'Barker', 'Guzman', 'Page', 'Munoz', 'Ball', 'Keller', 'Chandler', 'Weber', 'Leonard', 'Walsh', 'Lyons', 'Ramsey', 'Wolfe', 'Schneider', 'Mullins', 'Benson', 'Sharp', 'Bowen', 'Daniel', 'Barber', 'Cummings', 'Hines', 'Baldwin', 'Griffith', 'Valdez', 'Hubbard', 'Salazar', 'Reeves', 'Warner', 'Stevenson', 'Burgess', 'Santos', 'Tate', 'Cross', 'Garner', 'Mann', 'Mack', 'Moss', 'Thornton', 'Dennis', 'McGee', 'Farmer', 'Delgado', 'Aguilar', 'Vega', 'Glover', 'Manning', 'Cohen', 'Harmon', 'Rodgers', 'Robbins', 'Newton', 'Todd', 'Blair', 'Higgins', 'Ingram', 'Reese', 'Cannon', 'Strickland', 'Townsend', 'Potter', 'Goodwin', 'Walton', 'Rowe', 'Hampton', 'Ortega', 'Patton', 'Swanson', 'Joseph', 'Francis', 'Goodman', 'Maldonado', 'Yates', 'Becker', 'Erickson', 'Hodges', 'Rios', 'Conner', 'Adkins', 'Webster', 'Norman', 'Malone', 'Hammond', 'Flowers', 'Cobb', 'Moody', 'Quinn', 'Blake', 'Maxwell', 'Pope', 'Floyd', 'Osborne', 'Paul', 'McCarthy', 'Guerrero', 'Lindsey', 'Estrada', 'Sandoval', 'Gibbs', 'Tyler', 'Gross', 'Fitzgerald', 'Stokes', 'Doyle', 'Sherman', 'Saunders', 'Wise', 'Colon', 'Gill', 'Alvarado', 'Greer', 'Padilla', 'Simon', 'Waters', 'Nunez', 'Ballard', 'Schwartz', 'McBride', 'Houston', 'Christensen', 'Klein', 'Pratt', 'Briggs', 'Parsons', 'McLaughlin', 'Zimmerman', 'French', 'Buchanan', 'Moran', 'Copeland', 'Roy', 'Pittman', 'Brady', 'McCormick', 'Holloway', 'Brock', 'Poole', 'Frank', 'Logan', 'Owen', 'Bass', 'Marsh', 'Drake', 'Wong', 'Jefferson', 'Park', 'Morton', 'Abbott', 'Sparks', 'Patrick', 'Norton', 'Huff', 'Clayton', 'Massey', 'Lloyd', 'Figueroa', 'Carson', 'Bowers', 'Roberson', 'Barton', 'Tran', 'Lamb', 'Harrington', 'Casey', 'Boone', 'Cortez', 'Clarke', 'Mathis', 'Singleton', 'Wilkins', 'Cain', 'Bryan', 'Underwood', 'Hogan', 'McKenzie', 'Collier', 'Luna', 'Phelps', 'McGuire', 'Allison', 'Bridges', 'Wilkerson', 'Nash', 'Summers', 'Atkins'],
                // Data taken from http://www.dati.gov.it/dataset/comune-di-firenze_0164 (first 1000)
            "it": ["Acciai", "Aglietti", "Agostini", "Agresti", "Ahmed", "Aiazzi", "Albanese", "Alberti", "Alessi", "Alfani", "Alinari", "Alterini", "Amato", "Ammannati", "Ancillotti", "Andrei", "Andreini", "Andreoni", "Angeli", "Anichini", "Antonelli", "Antonini", "Arena", "Ariani", "Arnetoli", "Arrighi", "Baccani", "Baccetti", "Bacci", "Bacherini", "Badii", "Baggiani", "Baglioni", "Bagni", "Bagnoli", "Baldassini", "Baldi", "Baldini", "Ballerini", "Balli", "Ballini", "Balloni", "Bambi", "Banchi", "Bandinelli", "Bandini", "Bani", "Barbetti", "Barbieri", "Barchielli", "Bardazzi", "Bardelli", "Bardi", "Barducci", "Bargellini", "Bargiacchi", "Barni", "Baroncelli", "Baroncini", "Barone", "Baroni", "Baronti", "Bartalesi", "Bartoletti", "Bartoli", "Bartolini", "Bartoloni", "Bartolozzi", "Basagni", "Basile", "Bassi", "Batacchi", "Battaglia", "Battaglini", "Bausi", "Becagli", "Becattini", "Becchi", "Becucci", "Bellandi", "Bellesi", "Belli", "Bellini", "Bellucci", "Bencini", "Benedetti", "Benelli", "Beni", "Benini", "Bensi", "Benucci", "Benvenuti", "Berlincioni", "Bernacchioni", "Bernardi", "Bernardini", "Berni", "Bernini", "Bertelli", "Berti", "Bertini", "Bessi", "Betti", "Bettini", "Biagi", "Biagini", "Biagioni", "Biagiotti", "Biancalani", "Bianchi", "Bianchini", "Bianco", "Biffoli", "Bigazzi", "Bigi", "Biliotti", "Billi", "Binazzi", "Bindi", "Bini", "Biondi", "Bizzarri", "Bocci", "Bogani", "Bolognesi", "Bonaiuti", "Bonanni", "Bonciani", "Boncinelli", "Bondi", "Bonechi", "Bongini", "Boni", "Bonini", "Borchi", "Boretti", "Borghi", "Borghini", "Borgioli", "Borri", "Borselli", "Boschi", "Bottai", "Bracci", "Braccini", "Brandi", "Braschi", "Bravi", "Brazzini", "Breschi", "Brilli", "Brizzi", "Brogelli", "Brogi", "Brogioni", "Brunelli", "Brunetti", "Bruni", "Bruno", "Brunori", "Bruschi", "Bucci", "Bucciarelli", "Buccioni", "Bucelli", "Bulli", "Burberi", "Burchi", "Burgassi", "Burroni", "Bussotti", "Buti", "Caciolli", "Caiani", "Calabrese", "Calamai", "Calamandrei", "Caldini", "Calo'", "Calonaci", "Calosi", "Calvelli", "Cambi", "Camiciottoli", "Cammelli", "Cammilli", "Campolmi", "Cantini", "Capanni", "Capecchi", "Caponi", "Cappelletti", "Cappelli", "Cappellini", "Cappugi", "Capretti", "Caputo", "Carbone", "Carboni", "Cardini", "Carlesi", "Carletti", "Carli", "Caroti", "Carotti", "Carrai", "Carraresi", "Carta", "Caruso", "Casalini", "Casati", "Caselli", "Casini", "Castagnoli", "Castellani", "Castelli", "Castellucci", "Catalano", "Catarzi", "Catelani", "Cavaciocchi", "Cavallaro", "Cavallini", "Cavicchi", "Cavini", "Ceccarelli", "Ceccatelli", "Ceccherelli", "Ceccherini", "Cecchi", "Cecchini", "Cecconi", "Cei", "Cellai", "Celli", "Cellini", "Cencetti", "Ceni", "Cenni", "Cerbai", "Cesari", "Ceseri", "Checcacci", "Checchi", "Checcucci", "Cheli", "Chellini", "Chen", "Cheng", "Cherici", "Cherubini", "Chiaramonti", "Chiarantini", "Chiarelli", "Chiari", "Chiarini", "Chiarugi", "Chiavacci", "Chiesi", "Chimenti", "Chini", "Chirici", "Chiti", "Ciabatti", "Ciampi", "Cianchi", "Cianfanelli", "Cianferoni", "Ciani", "Ciapetti", "Ciappi", "Ciardi", "Ciatti", "Cicali", "Ciccone", "Cinelli", "Cini", "Ciobanu", "Ciolli", "Cioni", "Cipriani", "Cirillo", "Cirri", "Ciucchi", "Ciuffi", "Ciulli", "Ciullini", "Clemente", "Cocchi", "Cognome", "Coli", "Collini", "Colombo", "Colzi", "Comparini", "Conforti", "Consigli", "Conte", "Conti", "Contini", "Coppini", "Coppola", "Corsi", "Corsini", "Corti", "Cortini", "Cosi", "Costa", "Costantini", "Costantino", "Cozzi", "Cresci", "Crescioli", "Cresti", "Crini", "Curradi", "D'Agostino", "D'Alessandro", "D'Amico", "D'Angelo", "Daddi", "Dainelli", "Dallai", "Danti", "Davitti", "De Angelis", "De Luca", "De Marco", "De Rosa", "De Santis", "De Simone", "De Vita", "Degl'Innocenti", "Degli Innocenti", "Dei", "Del Lungo", "Del Re", "Di Marco", "Di Stefano", "Dini", "Diop", "Dobre", "Dolfi", "Donati", "Dondoli", "Dong", "Donnini", "Ducci", "Dumitru", "Ermini", "Esposito", "Evangelisti", "Fabbri", "Fabbrini", "Fabbrizzi", "Fabbroni", "Fabbrucci", "Fabiani", "Facchini", "Faggi", "Fagioli", "Failli", "Faini", "Falciani", "Falcini", "Falcone", "Fallani", "Falorni", "Falsini", "Falugiani", "Fancelli", "Fanelli", "Fanetti", "Fanfani", "Fani", "Fantappie'", "Fantechi", "Fanti", "Fantini", "Fantoni", "Farina", "Fattori", "Favilli", "Fedi", "Fei", "Ferrante", "Ferrara", "Ferrari", "Ferraro", "Ferretti", "Ferri", "Ferrini", "Ferroni", "Fiaschi", "Fibbi", "Fiesoli", "Filippi", "Filippini", "Fini", "Fioravanti", "Fiore", "Fiorentini", "Fiorini", "Fissi", "Focardi", "Foggi", "Fontana", "Fontanelli", "Fontani", "Forconi", "Formigli", "Forte", "Forti", "Fortini", "Fossati", "Fossi", "Francalanci", "Franceschi", "Franceschini", "Franchi", "Franchini", "Franci", "Francini", "Francioni", "Franco", "Frassineti", "Frati", "Fratini", "Frilli", "Frizzi", "Frosali", "Frosini", "Frullini", "Fusco", "Fusi", "Gabbrielli", "Gabellini", "Gagliardi", "Galanti", "Galardi", "Galeotti", "Galletti", "Galli", "Gallo", "Gallori", "Gambacciani", "Gargani", "Garofalo", "Garuglieri", "Gashi", "Gasperini", "Gatti", "Gelli", "Gensini", "Gentile", "Gentili", "Geri", "Gerini", "Gheri", "Ghini", "Giachetti", "Giachi", "Giacomelli", "Gianassi", "Giani", "Giannelli", "Giannetti", "Gianni", "Giannini", "Giannoni", "Giannotti", "Giannozzi", "Gigli", "Giordano", "Giorgetti", "Giorgi", "Giovacchini", "Giovannelli", "Giovannetti", "Giovannini", "Giovannoni", "Giuliani", "Giunti", "Giuntini", "Giusti", "Gonnelli", "Goretti", "Gori", "Gradi", "Gramigni", "Grassi", "Grasso", "Graziani", "Grazzini", "Greco", "Grifoni", "Grillo", "Grimaldi", "Grossi", "Gualtieri", "Guarducci", "Guarino", "Guarnieri", "Guasti", "Guerra", "Guerri", "Guerrini", "Guidi", "Guidotti", "He", "Hoxha", "Hu", "Huang", "Iandelli", "Ignesti", "Innocenti", "Jin", "La Rosa", "Lai", "Landi", "Landini", "Lanini", "Lapi", "Lapini", "Lari", "Lascialfari", "Lastrucci", "Latini", "Lazzeri", "Lazzerini", "Lelli", "Lenzi", "Leonardi", "Leoncini", "Leone", "Leoni", "Lepri", "Li", "Liao", "Lin", "Linari", "Lippi", "Lisi", "Livi", "Lombardi", "Lombardini", "Lombardo", "Longo", "Lopez", "Lorenzi", "Lorenzini", "Lorini", "Lotti", "Lu", "Lucchesi", "Lucherini", "Lunghi", "Lupi", "Madiai", "Maestrini", "Maffei", "Maggi", "Maggini", "Magherini", "Magini", "Magnani", "Magnelli", "Magni", "Magnolfi", "Magrini", "Malavolti", "Malevolti", "Manca", "Mancini", "Manetti", "Manfredi", "Mangani", "Mannelli", "Manni", "Mannini", "Mannucci", "Manuelli", "Manzini", "Marcelli", "Marchese", "Marchetti", "Marchi", "Marchiani", "Marchionni", "Marconi", "Marcucci", "Margheri", "Mari", "Mariani", "Marilli", "Marinai", "Marinari", "Marinelli", "Marini", "Marino", "Mariotti", "Marsili", "Martelli", "Martinelli", "Martini", "Martino", "Marzi", "Masi", "Masini", "Masoni", "Massai", "Materassi", "Mattei", "Matteini", "Matteucci", "Matteuzzi", "Mattioli", "Mattolini", "Matucci", "Mauro", "Mazzanti", "Mazzei", "Mazzetti", "Mazzi", "Mazzini", "Mazzocchi", "Mazzoli", "Mazzoni", "Mazzuoli", "Meacci", "Mecocci", "Meini", "Melani", "Mele", "Meli", "Mengoni", "Menichetti", "Meoni", "Merlini", "Messeri", "Messina", "Meucci", "Miccinesi", "Miceli", "Micheli", "Michelini", "Michelozzi", "Migliori", "Migliorini", "Milani", "Miniati", "Misuri", "Monaco", "Montagnani", "Montagni", "Montanari", "Montelatici", "Monti", "Montigiani", "Montini", "Morandi", "Morandini", "Morelli", "Moretti", "Morganti", "Mori", "Morini", "Moroni", "Morozzi", "Mugnai", "Mugnaini", "Mustafa", "Naldi", "Naldini", "Nannelli", "Nanni", "Nannini", "Nannucci", "Nardi", "Nardini", "Nardoni", "Natali", "Ndiaye", "Nencetti", "Nencini", "Nencioni", "Neri", "Nesi", "Nesti", "Niccolai", "Niccoli", "Niccolini", "Nigi", "Nistri", "Nocentini", "Noferini", "Novelli", "Nucci", "Nuti", "Nutini", "Oliva", "Olivieri", "Olmi", "Orlandi", "Orlandini", "Orlando", "Orsini", "Ortolani", "Ottanelli", "Pacciani", "Pace", "Paci", "Pacini", "Pagani", "Pagano", "Paggetti", "Pagliai", "Pagni", "Pagnini", "Paladini", "Palagi", "Palchetti", "Palloni", "Palmieri", "Palumbo", "Pampaloni", "Pancani", "Pandolfi", "Pandolfini", "Panerai", "Panichi", "Paoletti", "Paoli", "Paolini", "Papi", "Papini", "Papucci", "Parenti", "Parigi", "Parisi", "Parri", "Parrini", "Pasquini", "Passeri", "Pecchioli", "Pecorini", "Pellegrini", "Pepi", "Perini", "Perrone", "Peruzzi", "Pesci", "Pestelli", "Petri", "Petrini", "Petrucci", "Pettini", "Pezzati", "Pezzatini", "Piani", "Piazza", "Piazzesi", "Piazzini", "Piccardi", "Picchi", "Piccini", "Piccioli", "Pieraccini", "Pieraccioni", "Pieralli", "Pierattini", "Pieri", "Pierini", "Pieroni", "Pietrini", "Pini", "Pinna", "Pinto", "Pinzani", "Pinzauti", "Piras", "Pisani", "Pistolesi", "Poggesi", "Poggi", "Poggiali", "Poggiolini", "Poli", "Pollastri", "Porciani", "Pozzi", "Pratellesi", "Pratesi", "Prosperi", "Pruneti", "Pucci", "Puccini", "Puccioni", "Pugi", "Pugliese", "Puliti", "Querci", "Quercioli", "Raddi", "Radu", "Raffaelli", "Ragazzini", "Ranfagni", "Ranieri", "Rastrelli", "Raugei", "Raveggi", "Renai", "Renzi", "Rettori", "Ricci", "Ricciardi", "Ridi", "Ridolfi", "Rigacci", "Righi", "Righini", "Rinaldi", "Risaliti", "Ristori", "Rizzo", "Rocchi", "Rocchini", "Rogai", "Romagnoli", "Romanelli", "Romani", "Romano", "Romei", "Romeo", "Romiti", "Romoli", "Romolini", "Rontini", "Rosati", "Roselli", "Rosi", "Rossetti", "Rossi", "Rossini", "Rovai", "Ruggeri", "Ruggiero", "Russo", "Sabatini", "Saccardi", "Sacchetti", "Sacchi", "Sacco", "Salerno", "Salimbeni", "Salucci", "Salvadori", "Salvestrini", "Salvi", "Salvini", "Sanesi", "Sani", "Sanna", "Santi", "Santini", "Santoni", "Santoro", "Santucci", "Sardi", "Sarri", "Sarti", "Sassi", "Sbolci", "Scali", "Scarpelli", "Scarselli", "Scopetani", "Secci", "Selvi", "Senatori", "Senesi", "Serafini", "Sereni", "Serra", "Sestini", "Sguanci", "Sieni", "Signorini", "Silvestri", "Simoncini", "Simonetti", "Simoni", "Singh", "Sodi", "Soldi", "Somigli", "Sorbi", "Sorelli", "Sorrentino", "Sottili", "Spina", "Spinelli", "Staccioli", "Staderini", "Stefanelli", "Stefani", "Stefanini", "Stella", "Susini", "Tacchi", "Tacconi", "Taddei", "Tagliaferri", "Tamburini", "Tanganelli", "Tani", "Tanini", "Tapinassi", "Tarchi", "Tarchiani", "Targioni", "Tassi", "Tassini", "Tempesti", "Terzani", "Tesi", "Testa", "Testi", "Tilli", "Tinti", "Tirinnanzi", "Toccafondi", "Tofanari", "Tofani", "Tognaccini", "Tonelli", "Tonini", "Torelli", "Torrini", "Tosi", "Toti", "Tozzi", "Trambusti", "Trapani", "Tucci", "Turchi", "Ugolini", "Ulivi", "Valente", "Valenti", "Valentini", "Vangelisti", "Vanni", "Vannini", "Vannoni", "Vannozzi", "Vannucchi", "Vannucci", "Ventura", "Venturi", "Venturini", "Vestri", "Vettori", "Vichi", "Viciani", "Vieri", "Vigiani", "Vignoli", "Vignolini", "Vignozzi", "Villani", "Vinci", "Visani", "Vitale", "Vitali", "Viti", "Viviani", "Vivoli", "Volpe", "Volpi", "Wang", "Wu", "Xu", "Yang", "Ye", "Zagli", "Zani", "Zanieri", "Zanobini", "Zecchi", "Zetti", "Zhang", "Zheng", "Zhou", "Zhu", "Zingoni", "Zini", "Zoppi"]
        },

        // Data taken from https://github.com/umpirsky/country-list/blob/master/country/cldr/en_US/country.json
        countries: [{"name":"Afghanistan","abbreviation":"AF"},{"name":"Albania","abbreviation":"AL"},{"name":"Algeria","abbreviation":"DZ"},{"name":"American Samoa","abbreviation":"AS"},{"name":"Andorra","abbreviation":"AD"},{"name":"Angola","abbreviation":"AO"},{"name":"Anguilla","abbreviation":"AI"},{"name":"Antarctica","abbreviation":"AQ"},{"name":"Antigua and Barbuda","abbreviation":"AG"},{"name":"Argentina","abbreviation":"AR"},{"name":"Armenia","abbreviation":"AM"},{"name":"Aruba","abbreviation":"AW"},{"name":"Australia","abbreviation":"AU"},{"name":"Austria","abbreviation":"AT"},{"name":"Azerbaijan","abbreviation":"AZ"},{"name":"Bahamas","abbreviation":"BS"},{"name":"Bahrain","abbreviation":"BH"},{"name":"Bangladesh","abbreviation":"BD"},{"name":"Barbados","abbreviation":"BB"},{"name":"Belarus","abbreviation":"BY"},{"name":"Belgium","abbreviation":"BE"},{"name":"Belize","abbreviation":"BZ"},{"name":"Benin","abbreviation":"BJ"},{"name":"Bermuda","abbreviation":"BM"},{"name":"Bhutan","abbreviation":"BT"},{"name":"Bolivia","abbreviation":"BO"},{"name":"Bosnia and Herzegovina","abbreviation":"BA"},{"name":"Botswana","abbreviation":"BW"},{"name":"Bouvet Island","abbreviation":"BV"},{"name":"Brazil","abbreviation":"BR"},{"name":"British Antarctic Territory","abbreviation":"BQ"},{"name":"British Indian Ocean Territory","abbreviation":"IO"},{"name":"British Virgin Islands","abbreviation":"VG"},{"name":"Brunei","abbreviation":"BN"},{"name":"Bulgaria","abbreviation":"BG"},{"name":"Burkina Faso","abbreviation":"BF"},{"name":"Burundi","abbreviation":"BI"},{"name":"Cambodia","abbreviation":"KH"},{"name":"Cameroon","abbreviation":"CM"},{"name":"Canada","abbreviation":"CA"},{"name":"Canton and Enderbury Islands","abbreviation":"CT"},{"name":"Cape Verde","abbreviation":"CV"},{"name":"Cayman Islands","abbreviation":"KY"},{"name":"Central African Republic","abbreviation":"CF"},{"name":"Chad","abbreviation":"TD"},{"name":"Chile","abbreviation":"CL"},{"name":"China","abbreviation":"CN"},{"name":"Christmas Island","abbreviation":"CX"},{"name":"Cocos [Keeling] Islands","abbreviation":"CC"},{"name":"Colombia","abbreviation":"CO"},{"name":"Comoros","abbreviation":"KM"},{"name":"Congo - Brazzaville","abbreviation":"CG"},{"name":"Congo - Kinshasa","abbreviation":"CD"},{"name":"Cook Islands","abbreviation":"CK"},{"name":"Costa Rica","abbreviation":"CR"},{"name":"Croatia","abbreviation":"HR"},{"name":"Cuba","abbreviation":"CU"},{"name":"Cyprus","abbreviation":"CY"},{"name":"Czech Republic","abbreviation":"CZ"},{"name":"Côte d’Ivoire","abbreviation":"CI"},{"name":"Denmark","abbreviation":"DK"},{"name":"Djibouti","abbreviation":"DJ"},{"name":"Dominica","abbreviation":"DM"},{"name":"Dominican Republic","abbreviation":"DO"},{"name":"Dronning Maud Land","abbreviation":"NQ"},{"name":"East Germany","abbreviation":"DD"},{"name":"Ecuador","abbreviation":"EC"},{"name":"Egypt","abbreviation":"EG"},{"name":"El Salvador","abbreviation":"SV"},{"name":"Equatorial Guinea","abbreviation":"GQ"},{"name":"Eritrea","abbreviation":"ER"},{"name":"Estonia","abbreviation":"EE"},{"name":"Ethiopia","abbreviation":"ET"},{"name":"Falkland Islands","abbreviation":"FK"},{"name":"Faroe Islands","abbreviation":"FO"},{"name":"Fiji","abbreviation":"FJ"},{"name":"Finland","abbreviation":"FI"},{"name":"France","abbreviation":"FR"},{"name":"French Guiana","abbreviation":"GF"},{"name":"French Polynesia","abbreviation":"PF"},{"name":"French Southern Territories","abbreviation":"TF"},{"name":"French Southern and Antarctic Territories","abbreviation":"FQ"},{"name":"Gabon","abbreviation":"GA"},{"name":"Gambia","abbreviation":"GM"},{"name":"Georgia","abbreviation":"GE"},{"name":"Germany","abbreviation":"DE"},{"name":"Ghana","abbreviation":"GH"},{"name":"Gibraltar","abbreviation":"GI"},{"name":"Greece","abbreviation":"GR"},{"name":"Greenland","abbreviation":"GL"},{"name":"Grenada","abbreviation":"GD"},{"name":"Guadeloupe","abbreviation":"GP"},{"name":"Guam","abbreviation":"GU"},{"name":"Guatemala","abbreviation":"GT"},{"name":"Guernsey","abbreviation":"GG"},{"name":"Guinea","abbreviation":"GN"},{"name":"Guinea-Bissau","abbreviation":"GW"},{"name":"Guyana","abbreviation":"GY"},{"name":"Haiti","abbreviation":"HT"},{"name":"Heard Island and McDonald Islands","abbreviation":"HM"},{"name":"Honduras","abbreviation":"HN"},{"name":"Hong Kong SAR China","abbreviation":"HK"},{"name":"Hungary","abbreviation":"HU"},{"name":"Iceland","abbreviation":"IS"},{"name":"India","abbreviation":"IN"},{"name":"Indonesia","abbreviation":"ID"},{"name":"Iran","abbreviation":"IR"},{"name":"Iraq","abbreviation":"IQ"},{"name":"Ireland","abbreviation":"IE"},{"name":"Isle of Man","abbreviation":"IM"},{"name":"Israel","abbreviation":"IL"},{"name":"Italy","abbreviation":"IT"},{"name":"Jamaica","abbreviation":"JM"},{"name":"Japan","abbreviation":"JP"},{"name":"Jersey","abbreviation":"JE"},{"name":"Johnston Island","abbreviation":"JT"},{"name":"Jordan","abbreviation":"JO"},{"name":"Kazakhstan","abbreviation":"KZ"},{"name":"Kenya","abbreviation":"KE"},{"name":"Kiribati","abbreviation":"KI"},{"name":"Kuwait","abbreviation":"KW"},{"name":"Kyrgyzstan","abbreviation":"KG"},{"name":"Laos","abbreviation":"LA"},{"name":"Latvia","abbreviation":"LV"},{"name":"Lebanon","abbreviation":"LB"},{"name":"Lesotho","abbreviation":"LS"},{"name":"Liberia","abbreviation":"LR"},{"name":"Libya","abbreviation":"LY"},{"name":"Liechtenstein","abbreviation":"LI"},{"name":"Lithuania","abbreviation":"LT"},{"name":"Luxembourg","abbreviation":"LU"},{"name":"Macau SAR China","abbreviation":"MO"},{"name":"Macedonia","abbreviation":"MK"},{"name":"Madagascar","abbreviation":"MG"},{"name":"Malawi","abbreviation":"MW"},{"name":"Malaysia","abbreviation":"MY"},{"name":"Maldives","abbreviation":"MV"},{"name":"Mali","abbreviation":"ML"},{"name":"Malta","abbreviation":"MT"},{"name":"Marshall Islands","abbreviation":"MH"},{"name":"Martinique","abbreviation":"MQ"},{"name":"Mauritania","abbreviation":"MR"},{"name":"Mauritius","abbreviation":"MU"},{"name":"Mayotte","abbreviation":"YT"},{"name":"Metropolitan France","abbreviation":"FX"},{"name":"Mexico","abbreviation":"MX"},{"name":"Micronesia","abbreviation":"FM"},{"name":"Midway Islands","abbreviation":"MI"},{"name":"Moldova","abbreviation":"MD"},{"name":"Monaco","abbreviation":"MC"},{"name":"Mongolia","abbreviation":"MN"},{"name":"Montenegro","abbreviation":"ME"},{"name":"Montserrat","abbreviation":"MS"},{"name":"Morocco","abbreviation":"MA"},{"name":"Mozambique","abbreviation":"MZ"},{"name":"Myanmar [Burma]","abbreviation":"MM"},{"name":"Namibia","abbreviation":"NA"},{"name":"Nauru","abbreviation":"NR"},{"name":"Nepal","abbreviation":"NP"},{"name":"Netherlands","abbreviation":"NL"},{"name":"Netherlands Antilles","abbreviation":"AN"},{"name":"Neutral Zone","abbreviation":"NT"},{"name":"New Caledonia","abbreviation":"NC"},{"name":"New Zealand","abbreviation":"NZ"},{"name":"Nicaragua","abbreviation":"NI"},{"name":"Niger","abbreviation":"NE"},{"name":"Nigeria","abbreviation":"NG"},{"name":"Niue","abbreviation":"NU"},{"name":"Norfolk Island","abbreviation":"NF"},{"name":"North Korea","abbreviation":"KP"},{"name":"North Vietnam","abbreviation":"VD"},{"name":"Northern Mariana Islands","abbreviation":"MP"},{"name":"Norway","abbreviation":"NO"},{"name":"Oman","abbreviation":"OM"},{"name":"Pacific Islands Trust Territory","abbreviation":"PC"},{"name":"Pakistan","abbreviation":"PK"},{"name":"Palau","abbreviation":"PW"},{"name":"Palestinian Territories","abbreviation":"PS"},{"name":"Panama","abbreviation":"PA"},{"name":"Panama Canal Zone","abbreviation":"PZ"},{"name":"Papua New Guinea","abbreviation":"PG"},{"name":"Paraguay","abbreviation":"PY"},{"name":"People's Democratic Republic of Yemen","abbreviation":"YD"},{"name":"Peru","abbreviation":"PE"},{"name":"Philippines","abbreviation":"PH"},{"name":"Pitcairn Islands","abbreviation":"PN"},{"name":"Poland","abbreviation":"PL"},{"name":"Portugal","abbreviation":"PT"},{"name":"Puerto Rico","abbreviation":"PR"},{"name":"Qatar","abbreviation":"QA"},{"name":"Romania","abbreviation":"RO"},{"name":"Russia","abbreviation":"RU"},{"name":"Rwanda","abbreviation":"RW"},{"name":"Réunion","abbreviation":"RE"},{"name":"Saint Barthélemy","abbreviation":"BL"},{"name":"Saint Helena","abbreviation":"SH"},{"name":"Saint Kitts and Nevis","abbreviation":"KN"},{"name":"Saint Lucia","abbreviation":"LC"},{"name":"Saint Martin","abbreviation":"MF"},{"name":"Saint Pierre and Miquelon","abbreviation":"PM"},{"name":"Saint Vincent and the Grenadines","abbreviation":"VC"},{"name":"Samoa","abbreviation":"WS"},{"name":"San Marino","abbreviation":"SM"},{"name":"Saudi Arabia","abbreviation":"SA"},{"name":"Senegal","abbreviation":"SN"},{"name":"Serbia","abbreviation":"RS"},{"name":"Serbia and Montenegro","abbreviation":"CS"},{"name":"Seychelles","abbreviation":"SC"},{"name":"Sierra Leone","abbreviation":"SL"},{"name":"Singapore","abbreviation":"SG"},{"name":"Slovakia","abbreviation":"SK"},{"name":"Slovenia","abbreviation":"SI"},{"name":"Solomon Islands","abbreviation":"SB"},{"name":"Somalia","abbreviation":"SO"},{"name":"South Africa","abbreviation":"ZA"},{"name":"South Georgia and the South Sandwich Islands","abbreviation":"GS"},{"name":"South Korea","abbreviation":"KR"},{"name":"Spain","abbreviation":"ES"},{"name":"Sri Lanka","abbreviation":"LK"},{"name":"Sudan","abbreviation":"SD"},{"name":"Suriname","abbreviation":"SR"},{"name":"Svalbard and Jan Mayen","abbreviation":"SJ"},{"name":"Swaziland","abbreviation":"SZ"},{"name":"Sweden","abbreviation":"SE"},{"name":"Switzerland","abbreviation":"CH"},{"name":"Syria","abbreviation":"SY"},{"name":"São Tomé and Príncipe","abbreviation":"ST"},{"name":"Taiwan","abbreviation":"TW"},{"name":"Tajikistan","abbreviation":"TJ"},{"name":"Tanzania","abbreviation":"TZ"},{"name":"Thailand","abbreviation":"TH"},{"name":"Timor-Leste","abbreviation":"TL"},{"name":"Togo","abbreviation":"TG"},{"name":"Tokelau","abbreviation":"TK"},{"name":"Tonga","abbreviation":"TO"},{"name":"Trinidad and Tobago","abbreviation":"TT"},{"name":"Tunisia","abbreviation":"TN"},{"name":"Turkey","abbreviation":"TR"},{"name":"Turkmenistan","abbreviation":"TM"},{"name":"Turks and Caicos Islands","abbreviation":"TC"},{"name":"Tuvalu","abbreviation":"TV"},{"name":"U.S. Minor Outlying Islands","abbreviation":"UM"},{"name":"U.S. Miscellaneous Pacific Islands","abbreviation":"PU"},{"name":"U.S. Virgin Islands","abbreviation":"VI"},{"name":"Uganda","abbreviation":"UG"},{"name":"Ukraine","abbreviation":"UA"},{"name":"Union of Soviet Socialist Republics","abbreviation":"SU"},{"name":"United Arab Emirates","abbreviation":"AE"},{"name":"United Kingdom","abbreviation":"GB"},{"name":"United States","abbreviation":"US"},{"name":"Unknown or Invalid Region","abbreviation":"ZZ"},{"name":"Uruguay","abbreviation":"UY"},{"name":"Uzbekistan","abbreviation":"UZ"},{"name":"Vanuatu","abbreviation":"VU"},{"name":"Vatican City","abbreviation":"VA"},{"name":"Venezuela","abbreviation":"VE"},{"name":"Vietnam","abbreviation":"VN"},{"name":"Wake Island","abbreviation":"WK"},{"name":"Wallis and Futuna","abbreviation":"WF"},{"name":"Western Sahara","abbreviation":"EH"},{"name":"Yemen","abbreviation":"YE"},{"name":"Zambia","abbreviation":"ZM"},{"name":"Zimbabwe","abbreviation":"ZW"},{"name":"Åland Islands","abbreviation":"AX"}],

        provinces: {
            "ca": [
                {name: 'Alberta', abbreviation: 'AB'},
                {name: 'British Columbia', abbreviation: 'BC'},
                {name: 'Manitoba', abbreviation: 'MB'},
                {name: 'New Brunswick', abbreviation: 'NB'},
                {name: 'Newfoundland and Labrador', abbreviation: 'NL'},
                {name: 'Nova Scotia', abbreviation: 'NS'},
                {name: 'Ontario', abbreviation: 'ON'},
                {name: 'Prince Edward Island', abbreviation: 'PE'},
                {name: 'Quebec', abbreviation: 'QC'},
                {name: 'Saskatchewan', abbreviation: 'SK'},

                // The case could be made that the following are not actually provinces
                // since they are technically considered "territories" however they all
                // look the same on an envelope!
                {name: 'Northwest Territories', abbreviation: 'NT'},
                {name: 'Nunavut', abbreviation: 'NU'},
                {name: 'Yukon', abbreviation: 'YT'}
            ],
            "it": [
                { name: "Agrigento", abbreviation: "AG", code: 84 },
                { name: "Alessandria", abbreviation: "AL", code: 6 },
                { name: "Ancona", abbreviation: "AN", code: 42 },
                { name: "Aosta", abbreviation: "AO", code: 7 },
                { name: "L'Aquila", abbreviation: "AQ", code: 66 },
                { name: "Arezzo", abbreviation: "AR", code: 51 },
                { name: "Ascoli-Piceno", abbreviation: "AP", code: 44 },
                { name: "Asti", abbreviation: "AT", code: 5 },
                { name: "Avellino", abbreviation: "AV", code: 64 },
                { name: "Bari", abbreviation: "BA", code: 72 },
                { name: "Barletta-Andria-Trani", abbreviation: "BT", code: 72 },
                { name: "Belluno", abbreviation: "BL", code: 25 },
                { name: "Benevento", abbreviation: "BN", code: 62 },
                { name: "Bergamo", abbreviation: "BG", code: 16 },
                { name: "Biella", abbreviation: "BI", code: 96 },
                { name: "Bologna", abbreviation: "BO", code: 37 },
                { name: "Bolzano", abbreviation: "BZ", code: 21 },
                { name: "Brescia", abbreviation: "BS", code: 17 },
                { name: "Brindisi", abbreviation: "BR", code: 74 },
                { name: "Cagliari", abbreviation: "CA", code: 92 },
                { name: "Caltanissetta", abbreviation: "CL", code: 85 },
                { name: "Campobasso", abbreviation: "CB", code: 70 },
                { name: "Carbonia Iglesias", abbreviation: "CI", code: 70 },
                { name: "Caserta", abbreviation: "CE", code: 61 },
                { name: "Catania", abbreviation: "CT", code: 87 },
                { name: "Catanzaro", abbreviation: "CZ", code: 79 },
                { name: "Chieti", abbreviation: "CH", code: 69 },
                { name: "Como", abbreviation: "CO", code: 13 },
                { name: "Cosenza", abbreviation: "CS", code: 78 },
                { name: "Cremona", abbreviation: "CR", code: 19 },
                { name: "Crotone", abbreviation: "KR", code: 101 },
                { name: "Cuneo", abbreviation: "CN", code: 4 },
                { name: "Enna", abbreviation: "EN", code: 86 },
                { name: "Fermo", abbreviation: "FM", code: 86 },
                { name: "Ferrara", abbreviation: "FE", code: 38 },
                { name: "Firenze", abbreviation: "FI", code: 48 },
                { name: "Foggia", abbreviation: "FG", code: 71 },
                { name: "Forli-Cesena", abbreviation: "FC", code: 71 },
                { name: "Frosinone", abbreviation: "FR", code: 60 },
                { name: "Genova", abbreviation: "GE", code: 10 },
                { name: "Gorizia", abbreviation: "GO", code: 31 },
                { name: "Grosseto", abbreviation: "GR", code: 53 },
                { name: "Imperia", abbreviation: "IM", code: 8 },
                { name: "Isernia", abbreviation: "IS", code: 94 },
                { name: "La-Spezia", abbreviation: "SP", code: 66 },
                { name: "Latina", abbreviation: "LT", code: 59 },
                { name: "Lecce", abbreviation: "LE", code: 75 },
                { name: "Lecco", abbreviation: "LC", code: 97 },
                { name: "Livorno", abbreviation: "LI", code: 49 },
                { name: "Lodi", abbreviation: "LO", code: 98 },
                { name: "Lucca", abbreviation: "LU", code: 46 },
                { name: "Macerata", abbreviation: "MC", code: 43 },
                { name: "Mantova", abbreviation: "MN", code: 20 },
                { name: "Massa-Carrara", abbreviation: "MS", code: 45 },
                { name: "Matera", abbreviation: "MT", code: 77 },
                { name: "Medio Campidano", abbreviation: "VS", code: 77 },
                { name: "Messina", abbreviation: "ME", code: 83 },
                { name: "Milano", abbreviation: "MI", code: 15 },
                { name: "Modena", abbreviation: "MO", code: 36 },
                { name: "Monza-Brianza", abbreviation: "MB", code: 36 },
                { name: "Napoli", abbreviation: "NA", code: 63 },
                { name: "Novara", abbreviation: "NO", code: 3 },
                { name: "Nuoro", abbreviation: "NU", code: 91 },
                { name: "Ogliastra", abbreviation: "OG", code: 91 },
                { name: "Olbia Tempio", abbreviation: "OT", code: 91 },
                { name: "Oristano", abbreviation: "OR", code: 95 },
                { name: "Padova", abbreviation: "PD", code: 28 },
                { name: "Palermo", abbreviation: "PA", code: 82 },
                { name: "Parma", abbreviation: "PR", code: 34 },
                { name: "Pavia", abbreviation: "PV", code: 18 },
                { name: "Perugia", abbreviation: "PG", code: 54 },
                { name: "Pesaro-Urbino", abbreviation: "PU", code: 41 },
                { name: "Pescara", abbreviation: "PE", code: 68 },
                { name: "Piacenza", abbreviation: "PC", code: 33 },
                { name: "Pisa", abbreviation: "PI", code: 50 },
                { name: "Pistoia", abbreviation: "PT", code: 47 },
                { name: "Pordenone", abbreviation: "PN", code: 93 },
                { name: "Potenza", abbreviation: "PZ", code: 76 },
                { name: "Prato", abbreviation: "PO", code: 100 },
                { name: "Ragusa", abbreviation: "RG", code: 88 },
                { name: "Ravenna", abbreviation: "RA", code: 39 },
                { name: "Reggio-Calabria", abbreviation: "RC", code: 35 },
                { name: "Reggio-Emilia", abbreviation: "RE", code: 35 },
                { name: "Rieti", abbreviation: "RI", code: 57 },
                { name: "Rimini", abbreviation: "RN", code: 99 },
                { name: "Roma", abbreviation: "Roma", code: 58 },
                { name: "Rovigo", abbreviation: "RO", code: 29 },
                { name: "Salerno", abbreviation: "SA", code: 65 },
                { name: "Sassari", abbreviation: "SS", code: 90 },
                { name: "Savona", abbreviation: "SV", code: 9 },
                { name: "Siena", abbreviation: "SI", code: 52 },
                { name: "Siracusa", abbreviation: "SR", code: 89 },
                { name: "Sondrio", abbreviation: "SO", code: 14 },
                { name: "Taranto", abbreviation: "TA", code: 73 },
                { name: "Teramo", abbreviation: "TE", code: 67 },
                { name: "Terni", abbreviation: "TR", code: 55 },
                { name: "Torino", abbreviation: "TO", code: 1 },
                { name: "Trapani", abbreviation: "TP", code: 81 },
                { name: "Trento", abbreviation: "TN", code: 22 },
                { name: "Treviso", abbreviation: "TV", code: 26 },
                { name: "Trieste", abbreviation: "TS", code: 32 },
                { name: "Udine", abbreviation: "UD", code: 30 },
                { name: "Varese", abbreviation: "VA", code: 12 },
                { name: "Venezia", abbreviation: "VE", code: 27 },
                { name: "Verbania", abbreviation: "VB", code: 27 },
                { name: "Vercelli", abbreviation: "VC", code: 2 },
                { name: "Verona", abbreviation: "VR", code: 23 },
                { name: "Vibo-Valentia", abbreviation: "VV", code: 102 },
                { name: "Vicenza", abbreviation: "VI", code: 24 },
                { name: "Viterbo", abbreviation: "VT", code: 56 }   
            ]
        },

            // from: https://github.com/samsargent/Useful-Autocomplete-Data/blob/master/data/nationalities.json
        nationalities: [
           {name: 'Afghan'},
           {name: 'Albanian'},
           {name: 'Algerian'},
           {name: 'American'},
           {name: 'Andorran'},
           {name: 'Angolan'},
           {name: 'Antiguans'},
           {name: 'Argentinean'},
           {name: 'Armenian'},
           {name: 'Australian'},
           {name: 'Austrian'},
           {name: 'Azerbaijani'},
           {name: 'Bahami'},
           {name: 'Bahraini'},
           {name: 'Bangladeshi'},
           {name: 'Barbadian'},
           {name: 'Barbudans'},
           {name: 'Batswana'},
           {name: 'Belarusian'},
           {name: 'Belgian'},
           {name: 'Belizean'},
           {name: 'Beninese'},
           {name: 'Bhutanese'},
           {name: 'Bolivian'},
           {name: 'Bosnian'},
           {name: 'Brazilian'},
           {name: 'British'},
           {name: 'Bruneian'},
           {name: 'Bulgarian'},
           {name: 'Burkinabe'},
           {name: 'Burmese'},
           {name: 'Burundian'},
           {name: 'Cambodian'},
           {name: 'Cameroonian'},
           {name: 'Canadian'},
           {name: 'Cape Verdean'},
           {name: 'Central African'},
           {name: 'Chadian'},
           {name: 'Chilean'},
           {name: 'Chinese'},
           {name: 'Colombian'},
           {name: 'Comoran'},
           {name: 'Congolese'},
           {name: 'Costa Rican'},
           {name: 'Croatian'},
           {name: 'Cuban'},
           {name: 'Cypriot'},
           {name: 'Czech'},
           {name: 'Danish'},
           {name: 'Djibouti'},
           {name: 'Dominican'},
           {name: 'Dutch'},
           {name: 'East Timorese'},
           {name: 'Ecuadorean'},
           {name: 'Egyptian'},
           {name: 'Emirian'},
           {name: 'Equatorial Guinean'},
           {name: 'Eritrean'},
           {name: 'Estonian'},
           {name: 'Ethiopian'},
           {name: 'Fijian'},
           {name: 'Filipino'},
           {name: 'Finnish'},
           {name: 'French'},
           {name: 'Gabonese'},
           {name: 'Gambian'},
           {name: 'Georgian'},
           {name: 'German'},
           {name: 'Ghanaian'},
           {name: 'Greek'},
           {name: 'Grenadian'},
           {name: 'Guatemalan'},
           {name: 'Guinea-Bissauan'},
           {name: 'Guinean'},
           {name: 'Guyanese'},
           {name: 'Haitian'},
           {name: 'Herzegovinian'},
           {name: 'Honduran'},
           {name: 'Hungarian'},
           {name: 'I-Kiribati'},
           {name: 'Icelander'},
           {name: 'Indian'},
           {name: 'Indonesian'},
           {name: 'Iranian'},
           {name: 'Iraqi'},
           {name: 'Irish'},
           {name: 'Israeli'},
           {name: 'Italian'},
           {name: 'Ivorian'},
           {name: 'Jamaican'},
           {name: 'Japanese'},
           {name: 'Jordanian'},
           {name: 'Kazakhstani'},
           {name: 'Kenyan'},
           {name: 'Kittian and Nevisian'},
           {name: 'Kuwaiti'},
           {name: 'Kyrgyz'},
           {name: 'Laotian'},
           {name: 'Latvian'},
           {name: 'Lebanese'},
           {name: 'Liberian'},
           {name: 'Libyan'},
           {name: 'Liechtensteiner'},
           {name: 'Lithuanian'},
           {name: 'Luxembourger'},
           {name: 'Macedonian'},
           {name: 'Malagasy'},
           {name: 'Malawian'},
           {name: 'Malaysian'},
           {name: 'Maldivan'},
           {name: 'Malian'},
           {name: 'Maltese'},
           {name: 'Marshallese'},
           {name: 'Mauritanian'},
           {name: 'Mauritian'},
           {name: 'Mexican'},
           {name: 'Micronesian'},
           {name: 'Moldovan'},
           {name: 'Monacan'},
           {name: 'Mongolian'},
           {name: 'Moroccan'},
           {name: 'Mosotho'},
           {name: 'Motswana'},
           {name: 'Mozambican'},
           {name: 'Namibian'},
           {name: 'Nauruan'},
           {name: 'Nepalese'},
           {name: 'New Zealander'},
           {name: 'Nicaraguan'},
           {name: 'Nigerian'},
           {name: 'Nigerien'},
           {name: 'North Korean'},
           {name: 'Northern Irish'},
           {name: 'Norwegian'},
           {name: 'Omani'},
           {name: 'Pakistani'},
           {name: 'Palauan'},
           {name: 'Panamanian'},
           {name: 'Papua New Guinean'},
           {name: 'Paraguayan'},
           {name: 'Peruvian'},
           {name: 'Polish'},
           {name: 'Portuguese'},
           {name: 'Qatari'},
           {name: 'Romani'},          
           {name: 'Russian'},
           {name: 'Rwandan'},
           {name: 'Saint Lucian'},
           {name: 'Salvadoran'},
           {name: 'Samoan'},
           {name: 'San Marinese'},
           {name: 'Sao Tomean'},
           {name: 'Saudi'},
           {name: 'Scottish'},
           {name: 'Senegalese'},
           {name: 'Serbian'},
           {name: 'Seychellois'},
           {name: 'Sierra Leonean'},
           {name: 'Singaporean'},
           {name: 'Slovakian'},
           {name: 'Slovenian'},
           {name: 'Solomon Islander'},
           {name: 'Somali'},
           {name: 'South African'},
           {name: 'South Korean'},
           {name: 'Spanish'},
           {name: 'Sri Lankan'},
           {name: 'Sudanese'},
           {name: 'Surinamer'},
           {name: 'Swazi'},
           {name: 'Swedish'},
           {name: 'Swiss'},
           {name: 'Syrian'},
           {name: 'Taiwanese'},
           {name: 'Tajik'},
           {name: 'Tanzanian'},
           {name: 'Thai'},
           {name: 'Togolese'},
           {name: 'Tongan'},
           {name: 'Trinidadian or Tobagonian'},
           {name: 'Tunisian'},
           {name: 'Turkish'},
           {name: 'Tuvaluan'},
           {name: 'Ugandan'},
           {name: 'Ukrainian'},
           {name: 'Uruguaya'},
           {name: 'Uzbekistani'},
           {name: 'Venezuela'},
           {name: 'Vietnamese'},
           {name: 'Wels'},
           {name: 'Yemenit'},
           {name: 'Zambia'},
           {name: 'Zimbabwe'},
        ],

        us_states_and_dc: [
            {name: 'Alabama', abbreviation: 'AL'},
            {name: 'Alaska', abbreviation: 'AK'},
            {name: 'Arizona', abbreviation: 'AZ'},
            {name: 'Arkansas', abbreviation: 'AR'},
            {name: 'California', abbreviation: 'CA'},
            {name: 'Colorado', abbreviation: 'CO'},
            {name: 'Connecticut', abbreviation: 'CT'},
            {name: 'Delaware', abbreviation: 'DE'},
            {name: 'District of Columbia', abbreviation: 'DC'},
            {name: 'Florida', abbreviation: 'FL'},
            {name: 'Georgia', abbreviation: 'GA'},
            {name: 'Hawaii', abbreviation: 'HI'},
            {name: 'Idaho', abbreviation: 'ID'},
            {name: 'Illinois', abbreviation: 'IL'},
            {name: 'Indiana', abbreviation: 'IN'},
            {name: 'Iowa', abbreviation: 'IA'},
            {name: 'Kansas', abbreviation: 'KS'},
            {name: 'Kentucky', abbreviation: 'KY'},
            {name: 'Louisiana', abbreviation: 'LA'},
            {name: 'Maine', abbreviation: 'ME'},
            {name: 'Maryland', abbreviation: 'MD'},
            {name: 'Massachusetts', abbreviation: 'MA'},
            {name: 'Michigan', abbreviation: 'MI'},
            {name: 'Minnesota', abbreviation: 'MN'},
            {name: 'Mississippi', abbreviation: 'MS'},
            {name: 'Missouri', abbreviation: 'MO'},
            {name: 'Montana', abbreviation: 'MT'},
            {name: 'Nebraska', abbreviation: 'NE'},
            {name: 'Nevada', abbreviation: 'NV'},
            {name: 'New Hampshire', abbreviation: 'NH'},
            {name: 'New Jersey', abbreviation: 'NJ'},
            {name: 'New Mexico', abbreviation: 'NM'},
            {name: 'New York', abbreviation: 'NY'},
            {name: 'North Carolina', abbreviation: 'NC'},
            {name: 'North Dakota', abbreviation: 'ND'},
            {name: 'Ohio', abbreviation: 'OH'},
            {name: 'Oklahoma', abbreviation: 'OK'},
            {name: 'Oregon', abbreviation: 'OR'},
            {name: 'Pennsylvania', abbreviation: 'PA'},
            {name: 'Rhode Island', abbreviation: 'RI'},
            {name: 'South Carolina', abbreviation: 'SC'},
            {name: 'South Dakota', abbreviation: 'SD'},
            {name: 'Tennessee', abbreviation: 'TN'},
            {name: 'Texas', abbreviation: 'TX'},
            {name: 'Utah', abbreviation: 'UT'},
            {name: 'Vermont', abbreviation: 'VT'},
            {name: 'Virginia', abbreviation: 'VA'},
            {name: 'Washington', abbreviation: 'WA'},
            {name: 'West Virginia', abbreviation: 'WV'},
            {name: 'Wisconsin', abbreviation: 'WI'},
            {name: 'Wyoming', abbreviation: 'WY'}
        ],

        territories: [
            {name: 'American Samoa', abbreviation: 'AS'},
            {name: 'Federated States of Micronesia', abbreviation: 'FM'},
            {name: 'Guam', abbreviation: 'GU'},
            {name: 'Marshall Islands', abbreviation: 'MH'},
            {name: 'Northern Mariana Islands', abbreviation: 'MP'},
            {name: 'Puerto Rico', abbreviation: 'PR'},
            {name: 'Virgin Islands, U.S.', abbreviation: 'VI'}
        ],

        armed_forces: [
            {name: 'Armed Forces Europe', abbreviation: 'AE'},
            {name: 'Armed Forces Pacific', abbreviation: 'AP'},
            {name: 'Armed Forces the Americas', abbreviation: 'AA'}
        ],

        country_regions: {
            it: [
                { name: "Valle d'Aosta", abbreviation: "VDA" },
                { name: "Piemonte", abbreviation: "PIE" },
                { name: "Lombardia", abbreviation: "LOM" },
                { name: "Veneto", abbreviation: "VEN" },
                { name: "Trentino Alto Adige", abbreviation: "TAA" },
                { name: "Friuli Venezia Giulia", abbreviation: "FVG" },
                { name: "Liguria", abbreviation: "LIG" },
                { name: "Emilia Romagna", abbreviation: "EMR" },
                { name: "Toscana", abbreviation: "TOS" },
                { name: "Umbria", abbreviation: "UMB" },
                { name: "Marche", abbreviation: "MAR" },
                { name: "Abruzzo", abbreviation: "ABR" },
                { name: "Lazio", abbreviation: "LAZ" },
                { name: "Campania", abbreviation: "CAM" },
                { name: "Puglia", abbreviation: "PUG" },
                { name: "Basilicata", abbreviation: "BAS" },
                { name: "Molise", abbreviation: "MOL" },
                { name: "Calabria", abbreviation: "CAL" },
                { name: "Sicilia", abbreviation: "SIC" },
                { name: "Sardegna", abbreviation: "SAR" }
            ]
        },

        street_suffixes: {
            'us': [
                {name: 'Avenue', abbreviation: 'Ave'},
                {name: 'Boulevard', abbreviation: 'Blvd'},
                {name: 'Center', abbreviation: 'Ctr'},
                {name: 'Circle', abbreviation: 'Cir'},
                {name: 'Court', abbreviation: 'Ct'},
                {name: 'Drive', abbreviation: 'Dr'},
                {name: 'Extension', abbreviation: 'Ext'},
                {name: 'Glen', abbreviation: 'Gln'},
                {name: 'Grove', abbreviation: 'Grv'},
                {name: 'Heights', abbreviation: 'Hts'},
                {name: 'Highway', abbreviation: 'Hwy'},
                {name: 'Junction', abbreviation: 'Jct'},
                {name: 'Key', abbreviation: 'Key'},
                {name: 'Lane', abbreviation: 'Ln'},
                {name: 'Loop', abbreviation: 'Loop'},
                {name: 'Manor', abbreviation: 'Mnr'},
                {name: 'Mill', abbreviation: 'Mill'},
                {name: 'Park', abbreviation: 'Park'},
                {name: 'Parkway', abbreviation: 'Pkwy'},
                {name: 'Pass', abbreviation: 'Pass'},
                {name: 'Path', abbreviation: 'Path'},
                {name: 'Pike', abbreviation: 'Pike'},
                {name: 'Place', abbreviation: 'Pl'},
                {name: 'Plaza', abbreviation: 'Plz'},
                {name: 'Point', abbreviation: 'Pt'},
                {name: 'Ridge', abbreviation: 'Rdg'},
                {name: 'River', abbreviation: 'Riv'},
                {name: 'Road', abbreviation: 'Rd'},
                {name: 'Square', abbreviation: 'Sq'},
                {name: 'Street', abbreviation: 'St'},
                {name: 'Terrace', abbreviation: 'Ter'},
                {name: 'Trail', abbreviation: 'Trl'},
                {name: 'Turnpike', abbreviation: 'Tpke'},
                {name: 'View', abbreviation: 'Vw'},
                {name: 'Way', abbreviation: 'Way'}
            ],
            'it': [
                { name: 'Accesso', abbreviation: 'Acc.' },
                { name: 'Alzaia', abbreviation: 'Alz.' },
                { name: 'Arco', abbreviation: 'Arco' },
                { name: 'Archivolto', abbreviation: 'Acv.' },
                { name: 'Arena', abbreviation: 'Arena' },
                { name: 'Argine', abbreviation: 'Argine' },
                { name: 'Bacino', abbreviation: 'Bacino' },
                { name: 'Banchi', abbreviation: 'Banchi' },
                { name: 'Banchina', abbreviation: 'Ban.' },
                { name: 'Bastioni', abbreviation: 'Bas.' },
                { name: 'Belvedere', abbreviation: 'Belv.' },
                { name: 'Borgata', abbreviation: 'B.ta' },
                { name: 'Borgo', abbreviation: 'B.go' },
                { name: 'Calata', abbreviation: 'Cal.' },
                { name: 'Calle', abbreviation: 'Calle' },
                { name: 'Campiello', abbreviation: 'Cam.' },
                { name: 'Campo', abbreviation: 'Cam.' },
                { name: 'Canale', abbreviation: 'Can.' },
                { name: 'Carraia', abbreviation: 'Carr.' },
                { name: 'Cascina', abbreviation: 'Cascina' },
                { name: 'Case sparse', abbreviation: 'c.s.' },
                { name: 'Cavalcavia', abbreviation: 'Cv.' },
                { name: 'Circonvallazione', abbreviation: 'Cv.' },
                { name: 'Complanare', abbreviation: 'C.re' },
                { name: 'Contrada', abbreviation: 'C.da' },
                { name: 'Corso', abbreviation: 'C.so' },
                { name: 'Corte', abbreviation: 'C.te' },
                { name: 'Cortile', abbreviation: 'C.le' },
                { name: 'Diramazione', abbreviation: 'Dir.' },
                { name: 'Fondaco', abbreviation: 'F.co' },
                { name: 'Fondamenta', abbreviation: 'F.ta' },
                { name: 'Fondo', abbreviation: 'F.do' },
                { name: 'Frazione', abbreviation: 'Fr.' },
                { name: 'Isola', abbreviation: 'Is.' },
                { name: 'Largo', abbreviation: 'L.go' },
                { name: 'Litoranea', abbreviation: 'Lit.' },
                { name: 'Lungolago', abbreviation: 'L.go lago' },
                { name: 'Lungo Po', abbreviation: 'l.go Po' },
                { name: 'Molo', abbreviation: 'Molo' },
                { name: 'Mura', abbreviation: 'Mura' },
                { name: 'Passaggio privato', abbreviation: 'pass. priv.' },
                { name: 'Passeggiata', abbreviation: 'Pass.' },
                { name: 'Piazza', abbreviation: 'P.zza' },
                { name: 'Piazzale', abbreviation: 'P.le' },
                { name: 'Ponte', abbreviation: 'P.te' },
                { name: 'Portico', abbreviation: 'P.co' },
                { name: 'Rampa', abbreviation: 'Rampa' },
                { name: 'Regione', abbreviation: 'Reg.' },
                { name: 'Rione', abbreviation: 'R.ne' },
                { name: 'Rio', abbreviation: 'Rio' },
                { name: 'Ripa', abbreviation: 'Ripa' },
                { name: 'Riva', abbreviation: 'Riva' },
                { name: 'Rondò', abbreviation: 'Rondò' },
                { name: 'Rotonda', abbreviation: 'Rot.' },
                { name: 'Sagrato', abbreviation: 'Sagr.' },
                { name: 'Salita', abbreviation: 'Sal.' },
                { name: 'Scalinata', abbreviation: 'Scal.' },
                { name: 'Scalone', abbreviation: 'Scal.' },
                { name: 'Slargo', abbreviation: 'Sl.' },
                { name: 'Sottoportico', abbreviation: 'Sott.' },
                { name: 'Strada', abbreviation: 'Str.' },
                { name: 'Stradale', abbreviation: 'Str.le' },
                { name: 'Strettoia', abbreviation: 'Strett.' },
                { name: 'Traversa', abbreviation: 'Trav.' },
                { name: 'Via', abbreviation: 'V.' },
                { name: 'Viale', abbreviation: 'V.le' },
                { name: 'Vicinale', abbreviation: 'Vic.le' },
                { name: 'Vicolo', abbreviation: 'Vic.' }
            ]
        },

        months: [
            {name: 'January', short_name: 'Jan', numeric: '01', days: 31},
            // Not messing with leap years...
            {name: 'February', short_name: 'Feb', numeric: '02', days: 28},
            {name: 'March', short_name: 'Mar', numeric: '03', days: 31},
            {name: 'April', short_name: 'Apr', numeric: '04', days: 30},
            {name: 'May', short_name: 'May', numeric: '05', days: 31},
            {name: 'June', short_name: 'Jun', numeric: '06', days: 30},
            {name: 'July', short_name: 'Jul', numeric: '07', days: 31},
            {name: 'August', short_name: 'Aug', numeric: '08', days: 31},
            {name: 'September', short_name: 'Sep', numeric: '09', days: 30},
            {name: 'October', short_name: 'Oct', numeric: '10', days: 31},
            {name: 'November', short_name: 'Nov', numeric: '11', days: 30},
            {name: 'December', short_name: 'Dec', numeric: '12', days: 31}
        ],

        // http://en.wikipedia.org/wiki/Bank_card_number#Issuer_identification_number_.28IIN.29
        cc_types: [
            {name: "American Express", short_name: 'amex', prefix: '34', length: 15},
            {name: "Bankcard", short_name: 'bankcard', prefix: '5610', length: 16},
            {name: "China UnionPay", short_name: 'chinaunion', prefix: '62', length: 16},
            {name: "Diners Club Carte Blanche", short_name: 'dccarte', prefix: '300', length: 14},
            {name: "Diners Club enRoute", short_name: 'dcenroute', prefix: '2014', length: 15},
            {name: "Diners Club International", short_name: 'dcintl', prefix: '36', length: 14},
            {name: "Diners Club United States & Canada", short_name: 'dcusc', prefix: '54', length: 16},
            {name: "Discover Card", short_name: 'discover', prefix: '6011', length: 16},
            {name: "InstaPayment", short_name: 'instapay', prefix: '637', length: 16},
            {name: "JCB", short_name: 'jcb', prefix: '3528', length: 16},
            {name: "Laser", short_name: 'laser', prefix: '6304', length: 16},
            {name: "Maestro", short_name: 'maestro', prefix: '5018', length: 16},
            {name: "Mastercard", short_name: 'mc', prefix: '51', length: 16},
            {name: "Solo", short_name: 'solo', prefix: '6334', length: 16},
            {name: "Switch", short_name: 'switch', prefix: '4903', length: 16},
            {name: "Visa", short_name: 'visa', prefix: '4', length: 16},
            {name: "Visa Electron", short_name: 'electron', prefix: '4026', length: 16}
        ],

        //return all world currency by ISO 4217
        currency_types: [
            {'code' : 'AED', 'name' : 'United Arab Emirates Dirham'},
            {'code' : 'AFN', 'name' : 'Afghanistan Afghani'},
            {'code' : 'ALL', 'name' : 'Albania Lek'},
            {'code' : 'AMD', 'name' : 'Armenia Dram'},
            {'code' : 'ANG', 'name' : 'Netherlands Antilles Guilder'},
            {'code' : 'AOA', 'name' : 'Angola Kwanza'},
            {'code' : 'ARS', 'name' : 'Argentina Peso'},
            {'code' : 'AUD', 'name' : 'Australia Dollar'},
            {'code' : 'AWG', 'name' : 'Aruba Guilder'},
            {'code' : 'AZN', 'name' : 'Azerbaijan New Manat'},
            {'code' : 'BAM', 'name' : 'Bosnia and Herzegovina Convertible Marka'},
            {'code' : 'BBD', 'name' : 'Barbados Dollar'},
            {'code' : 'BDT', 'name' : 'Bangladesh Taka'},
            {'code' : 'BGN', 'name' : 'Bulgaria Lev'},
            {'code' : 'BHD', 'name' : 'Bahrain Dinar'},
            {'code' : 'BIF', 'name' : 'Burundi Franc'},
            {'code' : 'BMD', 'name' : 'Bermuda Dollar'},
            {'code' : 'BND', 'name' : 'Brunei Darussalam Dollar'},
            {'code' : 'BOB', 'name' : 'Bolivia Boliviano'},
            {'code' : 'BRL', 'name' : 'Brazil Real'},
            {'code' : 'BSD', 'name' : 'Bahamas Dollar'},
            {'code' : 'BTN', 'name' : 'Bhutan Ngultrum'},
            {'code' : 'BWP', 'name' : 'Botswana Pula'},
            {'code' : 'BYR', 'name' : 'Belarus Ruble'},
            {'code' : 'BZD', 'name' : 'Belize Dollar'},
            {'code' : 'CAD', 'name' : 'Canada Dollar'},
            {'code' : 'CDF', 'name' : 'Congo/Kinshasa Franc'},
            {'code' : 'CHF', 'name' : 'Switzerland Franc'},
            {'code' : 'CLP', 'name' : 'Chile Peso'},
            {'code' : 'CNY', 'name' : 'China Yuan Renminbi'},
            {'code' : 'COP', 'name' : 'Colombia Peso'},
            {'code' : 'CRC', 'name' : 'Costa Rica Colon'},
            {'code' : 'CUC', 'name' : 'Cuba Convertible Peso'},
            {'code' : 'CUP', 'name' : 'Cuba Peso'},
            {'code' : 'CVE', 'name' : 'Cape Verde Escudo'},
            {'code' : 'CZK', 'name' : 'Czech Republic Koruna'},
            {'code' : 'DJF', 'name' : 'Djibouti Franc'},
            {'code' : 'DKK', 'name' : 'Denmark Krone'},
            {'code' : 'DOP', 'name' : 'Dominican Republic Peso'},
            {'code' : 'DZD', 'name' : 'Algeria Dinar'},
            {'code' : 'EGP', 'name' : 'Egypt Pound'},
            {'code' : 'ERN', 'name' : 'Eritrea Nakfa'},
            {'code' : 'ETB', 'name' : 'Ethiopia Birr'},
            {'code' : 'EUR', 'name' : 'Euro Member Countries'},
            {'code' : 'FJD', 'name' : 'Fiji Dollar'},
            {'code' : 'FKP', 'name' : 'Falkland Islands (Malvinas) Pound'},
            {'code' : 'GBP', 'name' : 'United Kingdom Pound'},
            {'code' : 'GEL', 'name' : 'Georgia Lari'},
            {'code' : 'GGP', 'name' : 'Guernsey Pound'},
            {'code' : 'GHS', 'name' : 'Ghana Cedi'},
            {'code' : 'GIP', 'name' : 'Gibraltar Pound'},
            {'code' : 'GMD', 'name' : 'Gambia Dalasi'},
            {'code' : 'GNF', 'name' : 'Guinea Franc'},
            {'code' : 'GTQ', 'name' : 'Guatemala Quetzal'},
            {'code' : 'GYD', 'name' : 'Guyana Dollar'},
            {'code' : 'HKD', 'name' : 'Hong Kong Dollar'},
            {'code' : 'HNL', 'name' : 'Honduras Lempira'},
            {'code' : 'HRK', 'name' : 'Croatia Kuna'},
            {'code' : 'HTG', 'name' : 'Haiti Gourde'},
            {'code' : 'HUF', 'name' : 'Hungary Forint'},
            {'code' : 'IDR', 'name' : 'Indonesia Rupiah'},
            {'code' : 'ILS', 'name' : 'Israel Shekel'},
            {'code' : 'IMP', 'name' : 'Isle of Man Pound'},
            {'code' : 'INR', 'name' : 'India Rupee'},
            {'code' : 'IQD', 'name' : 'Iraq Dinar'},
            {'code' : 'IRR', 'name' : 'Iran Rial'},
            {'code' : 'ISK', 'name' : 'Iceland Krona'},
            {'code' : 'JEP', 'name' : 'Jersey Pound'},
            {'code' : 'JMD', 'name' : 'Jamaica Dollar'},
            {'code' : 'JOD', 'name' : 'Jordan Dinar'},
            {'code' : 'JPY', 'name' : 'Japan Yen'},
            {'code' : 'KES', 'name' : 'Kenya Shilling'},
            {'code' : 'KGS', 'name' : 'Kyrgyzstan Som'},
            {'code' : 'KHR', 'name' : 'Cambodia Riel'},
            {'code' : 'KMF', 'name' : 'Comoros Franc'},
            {'code' : 'KPW', 'name' : 'Korea (North) Won'},
            {'code' : 'KRW', 'name' : 'Korea (South) Won'},
            {'code' : 'KWD', 'name' : 'Kuwait Dinar'},
            {'code' : 'KYD', 'name' : 'Cayman Islands Dollar'},
            {'code' : 'KZT', 'name' : 'Kazakhstan Tenge'},
            {'code' : 'LAK', 'name' : 'Laos Kip'},
            {'code' : 'LBP', 'name' : 'Lebanon Pound'},
            {'code' : 'LKR', 'name' : 'Sri Lanka Rupee'},
            {'code' : 'LRD', 'name' : 'Liberia Dollar'},
            {'code' : 'LSL', 'name' : 'Lesotho Loti'},
            {'code' : 'LTL', 'name' : 'Lithuania Litas'},
            {'code' : 'LYD', 'name' : 'Libya Dinar'},
            {'code' : 'MAD', 'name' : 'Morocco Dirham'},
            {'code' : 'MDL', 'name' : 'Moldova Leu'},
            {'code' : 'MGA', 'name' : 'Madagascar Ariary'},
            {'code' : 'MKD', 'name' : 'Macedonia Denar'},
            {'code' : 'MMK', 'name' : 'Myanmar (Burma) Kyat'},
            {'code' : 'MNT', 'name' : 'Mongolia Tughrik'},
            {'code' : 'MOP', 'name' : 'Macau Pataca'},
            {'code' : 'MRO', 'name' : 'Mauritania Ouguiya'},
            {'code' : 'MUR', 'name' : 'Mauritius Rupee'},
            {'code' : 'MVR', 'name' : 'Maldives (Maldive Islands) Rufiyaa'},
            {'code' : 'MWK', 'name' : 'Malawi Kwacha'},
            {'code' : 'MXN', 'name' : 'Mexico Peso'},
            {'code' : 'MYR', 'name' : 'Malaysia Ringgit'},
            {'code' : 'MZN', 'name' : 'Mozambique Metical'},
            {'code' : 'NAD', 'name' : 'Namibia Dollar'},
            {'code' : 'NGN', 'name' : 'Nigeria Naira'},
            {'code' : 'NIO', 'name' : 'Nicaragua Cordoba'},
            {'code' : 'NOK', 'name' : 'Norway Krone'},
            {'code' : 'NPR', 'name' : 'Nepal Rupee'},
            {'code' : 'NZD', 'name' : 'New Zealand Dollar'},
            {'code' : 'OMR', 'name' : 'Oman Rial'},
            {'code' : 'PAB', 'name' : 'Panama Balboa'},
            {'code' : 'PEN', 'name' : 'Peru Nuevo Sol'},
            {'code' : 'PGK', 'name' : 'Papua New Guinea Kina'},
            {'code' : 'PHP', 'name' : 'Philippines Peso'},
            {'code' : 'PKR', 'name' : 'Pakistan Rupee'},
            {'code' : 'PLN', 'name' : 'Poland Zloty'},
            {'code' : 'PYG', 'name' : 'Paraguay Guarani'},
            {'code' : 'QAR', 'name' : 'Qatar Riyal'},
            {'code' : 'RON', 'name' : 'Romania New Leu'},
            {'code' : 'RSD', 'name' : 'Serbia Dinar'},
            {'code' : 'RUB', 'name' : 'Russia Ruble'},
            {'code' : 'RWF', 'name' : 'Rwanda Franc'},
            {'code' : 'SAR', 'name' : 'Saudi Arabia Riyal'},
            {'code' : 'SBD', 'name' : 'Solomon Islands Dollar'},
            {'code' : 'SCR', 'name' : 'Seychelles Rupee'},
            {'code' : 'SDG', 'name' : 'Sudan Pound'},
            {'code' : 'SEK', 'name' : 'Sweden Krona'},
            {'code' : 'SGD', 'name' : 'Singapore Dollar'},
            {'code' : 'SHP', 'name' : 'Saint Helena Pound'},
            {'code' : 'SLL', 'name' : 'Sierra Leone Leone'},
            {'code' : 'SOS', 'name' : 'Somalia Shilling'},
            {'code' : 'SPL', 'name' : 'Seborga Luigino'},
            {'code' : 'SRD', 'name' : 'Suriname Dollar'},
            {'code' : 'STD', 'name' : 'São Tomé and Príncipe Dobra'},
            {'code' : 'SVC', 'name' : 'El Salvador Colon'},
            {'code' : 'SYP', 'name' : 'Syria Pound'},
            {'code' : 'SZL', 'name' : 'Swaziland Lilangeni'},
            {'code' : 'THB', 'name' : 'Thailand Baht'},
            {'code' : 'TJS', 'name' : 'Tajikistan Somoni'},
            {'code' : 'TMT', 'name' : 'Turkmenistan Manat'},
            {'code' : 'TND', 'name' : 'Tunisia Dinar'},
            {'code' : 'TOP', 'name' : 'Tonga Pa\'anga'},
            {'code' : 'TRY', 'name' : 'Turkey Lira'},
            {'code' : 'TTD', 'name' : 'Trinidad and Tobago Dollar'},
            {'code' : 'TVD', 'name' : 'Tuvalu Dollar'},
            {'code' : 'TWD', 'name' : 'Taiwan New Dollar'},
            {'code' : 'TZS', 'name' : 'Tanzania Shilling'},
            {'code' : 'UAH', 'name' : 'Ukraine Hryvnia'},
            {'code' : 'UGX', 'name' : 'Uganda Shilling'},
            {'code' : 'USD', 'name' : 'United States Dollar'},
            {'code' : 'UYU', 'name' : 'Uruguay Peso'},
            {'code' : 'UZS', 'name' : 'Uzbekistan Som'},
            {'code' : 'VEF', 'name' : 'Venezuela Bolivar'},
            {'code' : 'VND', 'name' : 'Viet Nam Dong'},
            {'code' : 'VUV', 'name' : 'Vanuatu Vatu'},
            {'code' : 'WST', 'name' : 'Samoa Tala'},
            {'code' : 'XAF', 'name' : 'Communauté Financière Africaine (BEAC) CFA Franc BEAC'},
            {'code' : 'XCD', 'name' : 'East Caribbean Dollar'},
            {'code' : 'XDR', 'name' : 'International Monetary Fund (IMF) Special Drawing Rights'},
            {'code' : 'XOF', 'name' : 'Communauté Financière Africaine (BCEAO) Franc'},
            {'code' : 'XPF', 'name' : 'Comptoirs Français du Pacifique (CFP) Franc'},
            {'code' : 'YER', 'name' : 'Yemen Rial'},
            {'code' : 'ZAR', 'name' : 'South Africa Rand'},
            {'code' : 'ZMW', 'name' : 'Zambia Kwacha'},
            {'code' : 'ZWD', 'name' : 'Zimbabwe Dollar'}
        ],
        
        // return the names of all valide colors
        colorNames : [  "AliceBlue", "Black", "Navy", "DarkBlue", "MediumBlue", "Blue", "DarkGreen", "Green", "Teal", "DarkCyan", "DeepSkyBlue", "DarkTurquoise", "MediumSpringGreen", "Lime", "SpringGreen",
            "Aqua", "Cyan", "MidnightBlue", "DodgerBlue", "LightSeaGreen", "ForestGreen", "SeaGreen", "DarkSlateGray", "LimeGreen", "MediumSeaGreen", "Turquoise", "RoyalBlue", "SteelBlue", "DarkSlateBlue", "MediumTurquoise",
            "Indigo", "DarkOliveGreen", "CadetBlue", "CornflowerBlue", "RebeccaPurple", "MediumAquaMarine", "DimGray", "SlateBlue", "OliveDrab", "SlateGray", "LightSlateGray", "MediumSlateBlue", "LawnGreen", "Chartreuse",
            "Aquamarine", "Maroon", "Purple", "Olive", "Gray", "SkyBlue", "LightSkyBlue", "BlueViolet", "DarkRed", "DarkMagenta", "SaddleBrown", "Ivory", "White",
            "DarkSeaGreen", "LightGreen", "MediumPurple", "DarkViolet", "PaleGreen", "DarkOrchid", "YellowGreen", "Sienna", "Brown", "DarkGray", "LightBlue", "GreenYellow", "PaleTurquoise", "LightSteelBlue", "PowderBlue",
            "FireBrick", "DarkGoldenRod", "MediumOrchid", "RosyBrown", "DarkKhaki", "Silver", "MediumVioletRed", "IndianRed", "Peru", "Chocolate", "Tan", "LightGray", "Thistle", "Orchid", "GoldenRod", "PaleVioletRed",
            "Crimson", "Gainsboro", "Plum", "BurlyWood", "LightCyan", "Lavender", "DarkSalmon", "Violet", "PaleGoldenRod", "LightCoral", "Khaki", "AliceBlue", "HoneyDew", "Azure", "SandyBrown", "Wheat", "Beige", "WhiteSmoke",
            "MintCream", "GhostWhite", "Salmon", "AntiqueWhite", "Linen", "LightGoldenRodYellow", "OldLace", "Red", "Fuchsia", "Magenta", "DeepPink", "OrangeRed", "Tomato", "HotPink", "Coral", "DarkOrange", "LightSalmon", "Orange",
            "LightPink", "Pink", "Gold", "PeachPuff", "NavajoWhite", "Moccasin", "Bisque", "MistyRose", "BlanchedAlmond", "PapayaWhip", "LavenderBlush", "SeaShell", "Cornsilk", "LemonChiffon", "FloralWhite", "Snow", "Yellow", "LightYellow"
        ],        

        fileExtension : {
            "raster"    : ["bmp", "gif", "gpl", "ico", "jpeg", "psd", "png", "psp", "raw", "tiff"],
            "vector"    : ["3dv", "amf", "awg", "ai", "cgm", "cdr", "cmx", "dxf", "e2d", "egt", "eps", "fs", "odg", "svg", "xar"],
            "3d"        : ["3dmf", "3dm", "3mf", "3ds", "an8", "aoi", "blend", "cal3d", "cob", "ctm", "iob", "jas", "max", "mb", "mdx", "obj", "x", "x3d"],
            "document"  : ["doc", "docx", "dot", "html", "xml", "odt", "odm", "ott", "csv", "rtf", "tex", "xhtml", "xps"]
        }
    };

    var o_hasOwnProperty = Object.prototype.hasOwnProperty;
    var o_keys = (Object.keys || function(obj) {
      var result = [];
      for (var key in obj) {
        if (o_hasOwnProperty.call(obj, key)) {
          result.push(key);
        }
      }

      return result;
    });

    function _copyObject(source, target) {
      var keys = o_keys(source);
      var key;

      for (var i = 0, l = keys.length; i < l; i++) {
        key = keys[i];
        target[key] = source[key] || target[key];
      }
    }

    function _copyArray(source, target) {
      for (var i = 0, l = source.length; i < l; i++) {
        target[i] = source[i];
      }
    }

    function copyObject(source, _target) {
        var isArray = Array.isArray(source);
        var target = _target || (isArray ? new Array(source.length) : {});

        if (isArray) {
          _copyArray(source, target);
        } else {
          _copyObject(source, target);
        }

        return target;
    }

    /** Get the data based on key**/
    Chance.prototype.get = function (name) {
        return copyObject(data[name]);
    };

    // Mac Address
    Chance.prototype.mac_address = function(options){
        // typically mac addresses are separated by ":"
        // however they can also be separated by "-"
        // the network variant uses a dot every fourth byte

        options = initOptions(options);
        if(!options.separator) {
            options.separator =  options.networkVersion ? "." : ":";
        }

        var mac_pool="ABCDEF1234567890",
            mac = "";
        if(!options.networkVersion) {
            mac = this.n(this.string, 6, { pool: mac_pool, length:2 }).join(options.separator);
        } else {
            mac = this.n(this.string, 3, { pool: mac_pool, length:4 }).join(options.separator);
        }

        return mac;
    };

    Chance.prototype.normal = function (options) {
        options = initOptions(options, {mean : 0, dev : 1, pool : []});

        testRange(
            options.pool.constructor !== Array,
            "Chance: The pool option must be a valid array."
        );

        // If a pool has been passed, then we are returning an item from that pool,
        // using the normal distribution settings that were passed in
        if (options.pool.length > 0) {
            return this.normal_pool(options);
        }

        // The Marsaglia Polar method
        var s, u, v, norm,
            mean = options.mean,
            dev = options.dev;

        do {
            // U and V are from the uniform distribution on (-1, 1)
            u = this.random() * 2 - 1;
            v = this.random() * 2 - 1;

            s = u * u + v * v;
        } while (s >= 1);

        // Compute the standard normal variate
        norm = u * Math.sqrt(-2 * Math.log(s) / s);

        // Shape and scale
        return dev * norm + mean;
    };

    Chance.prototype.normal_pool = function(options) {
        var performanceCounter = 0;
        do {
            var idx = Math.round(this.normal({ mean: options.mean, dev: options.dev }));
            if (idx < options.pool.length && idx >= 0) {
                return options.pool[idx];
            } else {
                performanceCounter++;
            }
        } while(performanceCounter < 100);

        throw new RangeError("Chance: Your pool is too small for the given mean and standard deviation. Please adjust.");
    };

    Chance.prototype.radio = function (options) {
        // Initial Letter (Typically Designated by Side of Mississippi River)
        options = initOptions(options, {side : "?"});
        var fl = "";
        switch (options.side.toLowerCase()) {
        case "east":
        case "e":
            fl = "W";
            break;
        case "west":
        case "w":
            fl = "K";
            break;
        default:
            fl = this.character({pool: "KW"});
            break;
        }

        return fl + this.character({alpha: true, casing: "upper"}) +
                this.character({alpha: true, casing: "upper"}) +
                this.character({alpha: true, casing: "upper"});
    };

    // Set the data as key and data or the data map
    Chance.prototype.set = function (name, values) {
        if (typeof name === "string") {
            data[name] = values;
        } else {
            data = copyObject(name, data);
        }
    };

    Chance.prototype.tv = function (options) {
        return this.radio(options);
    };

    // ID number for Brazil companies
    Chance.prototype.cnpj = function () {
        var n = this.n(this.natural, 8, { max: 9 });
        var d1 = 2+n[7]*6+n[6]*7+n[5]*8+n[4]*9+n[3]*2+n[2]*3+n[1]*4+n[0]*5;
        d1 = 11 - (d1 % 11);
        if (d1>=10){
            d1 = 0;
        }
        var d2 = d1*2+3+n[7]*7+n[6]*8+n[5]*9+n[4]*2+n[3]*3+n[2]*4+n[1]*5+n[0]*6;
        d2 = 11 - (d2 % 11);
        if (d2>=10){
            d2 = 0;
        }
        return ''+n[0]+n[1]+'.'+n[2]+n[3]+n[4]+'.'+n[5]+n[6]+n[7]+'/0001-'+d1+d2;
    };

    // -- End Miscellaneous --

    Chance.prototype.mersenne_twister = function (seed) {
        return new MersenneTwister(seed);
    };

    Chance.prototype.blueimp_md5 = function () {
        return new BlueImpMD5();
    };

    // Mersenne Twister from https://gist.github.com/banksean/300494
    var MersenneTwister = function (seed) {
        if (seed === undefined) {
            // kept random number same size as time used previously to ensure no unexpected results downstream
            seed = Math.floor(Math.random()*Math.pow(10,13));
        }
        /* Period parameters */
        this.N = 624;
        this.M = 397;
        this.MATRIX_A = 0x9908b0df;   /* constant vector a */
        this.UPPER_MASK = 0x80000000; /* most significant w-r bits */
        this.LOWER_MASK = 0x7fffffff; /* least significant r bits */

        this.mt = new Array(this.N); /* the array for the state vector */
        this.mti = this.N + 1; /* mti==N + 1 means mt[N] is not initialized */

        this.init_genrand(seed);
    };

    /* initializes mt[N] with a seed */
    MersenneTwister.prototype.init_genrand = function (s) {
        this.mt[0] = s >>> 0;
        for (this.mti = 1; this.mti < this.N; this.mti++) {
            s = this.mt[this.mti - 1] ^ (this.mt[this.mti - 1] >>> 30);
            this.mt[this.mti] = (((((s & 0xffff0000) >>> 16) * 1812433253) << 16) + (s & 0x0000ffff) * 1812433253) + this.mti;
            /* See Knuth TAOCP Vol2. 3rd Ed. P.106 for multiplier. */
            /* In the previous versions, MSBs of the seed affect   */
            /* only MSBs of the array mt[].                        */
            /* 2002/01/09 modified by Makoto Matsumoto             */
            this.mt[this.mti] >>>= 0;
            /* for >32 bit machines */
        }
    };

    /* initialize by an array with array-length */
    /* init_key is the array for initializing keys */
    /* key_length is its length */
    /* slight change for C++, 2004/2/26 */
    MersenneTwister.prototype.init_by_array = function (init_key, key_length) {
        var i = 1, j = 0, k, s;
        this.init_genrand(19650218);
        k = (this.N > key_length ? this.N : key_length);
        for (; k; k--) {
            s = this.mt[i - 1] ^ (this.mt[i - 1] >>> 30);
            this.mt[i] = (this.mt[i] ^ (((((s & 0xffff0000) >>> 16) * 1664525) << 16) + ((s & 0x0000ffff) * 1664525))) + init_key[j] + j; /* non linear */
            this.mt[i] >>>= 0; /* for WORDSIZE > 32 machines */
            i++;
            j++;
            if (i >= this.N) { this.mt[0] = this.mt[this.N - 1]; i = 1; }
            if (j >= key_length) { j = 0; }
        }
        for (k = this.N - 1; k; k--) {
            s = this.mt[i - 1] ^ (this.mt[i - 1] >>> 30);
            this.mt[i] = (this.mt[i] ^ (((((s & 0xffff0000) >>> 16) * 1566083941) << 16) + (s & 0x0000ffff) * 1566083941)) - i; /* non linear */
            this.mt[i] >>>= 0; /* for WORDSIZE > 32 machines */
            i++;
            if (i >= this.N) { this.mt[0] = this.mt[this.N - 1]; i = 1; }
        }

        this.mt[0] = 0x80000000; /* MSB is 1; assuring non-zero initial array */
    };

    /* generates a random number on [0,0xffffffff]-interval */
    MersenneTwister.prototype.genrand_int32 = function () {
        var y;
        var mag01 = new Array(0x0, this.MATRIX_A);
        /* mag01[x] = x * MATRIX_A  for x=0,1 */

        if (this.mti >= this.N) { /* generate N words at one time */
            var kk;

            if (this.mti === this.N + 1) {   /* if init_genrand() has not been called, */
                this.init_genrand(5489); /* a default initial seed is used */
            }
            for (kk = 0; kk < this.N - this.M; kk++) {
                y = (this.mt[kk]&this.UPPER_MASK)|(this.mt[kk + 1]&this.LOWER_MASK);
                this.mt[kk] = this.mt[kk + this.M] ^ (y >>> 1) ^ mag01[y & 0x1];
            }
            for (;kk < this.N - 1; kk++) {
                y = (this.mt[kk]&this.UPPER_MASK)|(this.mt[kk + 1]&this.LOWER_MASK);
                this.mt[kk] = this.mt[kk + (this.M - this.N)] ^ (y >>> 1) ^ mag01[y & 0x1];
            }
            y = (this.mt[this.N - 1]&this.UPPER_MASK)|(this.mt[0]&this.LOWER_MASK);
            this.mt[this.N - 1] = this.mt[this.M - 1] ^ (y >>> 1) ^ mag01[y & 0x1];

            this.mti = 0;
        }

        y = this.mt[this.mti++];

        /* Tempering */
        y ^= (y >>> 11);
        y ^= (y << 7) & 0x9d2c5680;
        y ^= (y << 15) & 0xefc60000;
        y ^= (y >>> 18);

        return y >>> 0;
    };

    /* generates a random number on [0,0x7fffffff]-interval */
    MersenneTwister.prototype.genrand_int31 = function () {
        return (this.genrand_int32() >>> 1);
    };

    /* generates a random number on [0,1]-real-interval */
    MersenneTwister.prototype.genrand_real1 = function () {
        return this.genrand_int32() * (1.0 / 4294967295.0);
        /* divided by 2^32-1 */
    };

    /* generates a random number on [0,1)-real-interval */
    MersenneTwister.prototype.random = function () {
        return this.genrand_int32() * (1.0 / 4294967296.0);
        /* divided by 2^32 */
    };

    /* generates a random number on (0,1)-real-interval */
    MersenneTwister.prototype.genrand_real3 = function () {
        return (this.genrand_int32() + 0.5) * (1.0 / 4294967296.0);
        /* divided by 2^32 */
    };

    /* generates a random number on [0,1) with 53-bit resolution*/
    MersenneTwister.prototype.genrand_res53 = function () {
        var a = this.genrand_int32()>>>5, b = this.genrand_int32()>>>6;
        return (a * 67108864.0 + b) * (1.0 / 9007199254740992.0);
    };

    // BlueImp MD5 hashing algorithm from https://github.com/blueimp/JavaScript-MD5
    var BlueImpMD5 = function () {};

    BlueImpMD5.prototype.VERSION = '1.0.1';

    /*
    * Add integers, wrapping at 2^32. This uses 16-bit operations internally
    * to work around bugs in some JS interpreters.
    */
    BlueImpMD5.prototype.safe_add = function safe_add(x, y) {
        var lsw = (x & 0xFFFF) + (y & 0xFFFF),
            msw = (x >> 16) + (y >> 16) + (lsw >> 16);
        return (msw << 16) | (lsw & 0xFFFF);
    };

    /*
    * Bitwise rotate a 32-bit number to the left.
    */
    BlueImpMD5.prototype.bit_roll = function (num, cnt) {
        return (num << cnt) | (num >>> (32 - cnt));
    };

    /*
    * These functions implement the five basic operations the algorithm uses.
    */
    BlueImpMD5.prototype.md5_cmn = function (q, a, b, x, s, t) {
        return this.safe_add(this.bit_roll(this.safe_add(this.safe_add(a, q), this.safe_add(x, t)), s), b);
    };
    BlueImpMD5.prototype.md5_ff = function (a, b, c, d, x, s, t) {
        return this.md5_cmn((b & c) | ((~b) & d), a, b, x, s, t);
    };
    BlueImpMD5.prototype.md5_gg = function (a, b, c, d, x, s, t) {
        return this.md5_cmn((b & d) | (c & (~d)), a, b, x, s, t);
    };
    BlueImpMD5.prototype.md5_hh = function (a, b, c, d, x, s, t) {
        return this.md5_cmn(b ^ c ^ d, a, b, x, s, t);
    };
    BlueImpMD5.prototype.md5_ii = function (a, b, c, d, x, s, t) {
        return this.md5_cmn(c ^ (b | (~d)), a, b, x, s, t);
    };

    /*
    * Calculate the MD5 of an array of little-endian words, and a bit length.
    */
    BlueImpMD5.prototype.binl_md5 = function (x, len) {
        /* append padding */
        x[len >> 5] |= 0x80 << (len % 32);
        x[(((len + 64) >>> 9) << 4) + 14] = len;

        var i, olda, oldb, oldc, oldd,
            a =  1732584193,
            b = -271733879,
            c = -1732584194,
            d =  271733878;

        for (i = 0; i < x.length; i += 16) {
            olda = a;
            oldb = b;
            oldc = c;
            oldd = d;

            a = this.md5_ff(a, b, c, d, x[i],       7, -680876936);
            d = this.md5_ff(d, a, b, c, x[i +  1], 12, -389564586);
            c = this.md5_ff(c, d, a, b, x[i +  2], 17,  606105819);
            b = this.md5_ff(b, c, d, a, x[i +  3], 22, -1044525330);
            a = this.md5_ff(a, b, c, d, x[i +  4],  7, -176418897);
            d = this.md5_ff(d, a, b, c, x[i +  5], 12,  1200080426);
            c = this.md5_ff(c, d, a, b, x[i +  6], 17, -1473231341);
            b = this.md5_ff(b, c, d, a, x[i +  7], 22, -45705983);
            a = this.md5_ff(a, b, c, d, x[i +  8],  7,  1770035416);
            d = this.md5_ff(d, a, b, c, x[i +  9], 12, -1958414417);
            c = this.md5_ff(c, d, a, b, x[i + 10], 17, -42063);
            b = this.md5_ff(b, c, d, a, x[i + 11], 22, -1990404162);
            a = this.md5_ff(a, b, c, d, x[i + 12],  7,  1804603682);
            d = this.md5_ff(d, a, b, c, x[i + 13], 12, -40341101);
            c = this.md5_ff(c, d, a, b, x[i + 14], 17, -1502002290);
            b = this.md5_ff(b, c, d, a, x[i + 15], 22,  1236535329);

            a = this.md5_gg(a, b, c, d, x[i +  1],  5, -165796510);
            d = this.md5_gg(d, a, b, c, x[i +  6],  9, -1069501632);
            c = this.md5_gg(c, d, a, b, x[i + 11], 14,  643717713);
            b = this.md5_gg(b, c, d, a, x[i],      20, -373897302);
            a = this.md5_gg(a, b, c, d, x[i +  5],  5, -701558691);
            d = this.md5_gg(d, a, b, c, x[i + 10],  9,  38016083);
            c = this.md5_gg(c, d, a, b, x[i + 15], 14, -660478335);
            b = this.md5_gg(b, c, d, a, x[i +  4], 20, -405537848);
            a = this.md5_gg(a, b, c, d, x[i +  9],  5,  568446438);
            d = this.md5_gg(d, a, b, c, x[i + 14],  9, -1019803690);
            c = this.md5_gg(c, d, a, b, x[i +  3], 14, -187363961);
            b = this.md5_gg(b, c, d, a, x[i +  8], 20,  1163531501);
            a = this.md5_gg(a, b, c, d, x[i + 13],  5, -1444681467);
            d = this.md5_gg(d, a, b, c, x[i +  2],  9, -51403784);
            c = this.md5_gg(c, d, a, b, x[i +  7], 14,  1735328473);
            b = this.md5_gg(b, c, d, a, x[i + 12], 20, -1926607734);

            a = this.md5_hh(a, b, c, d, x[i +  5],  4, -378558);
            d = this.md5_hh(d, a, b, c, x[i +  8], 11, -2022574463);
            c = this.md5_hh(c, d, a, b, x[i + 11], 16,  1839030562);
            b = this.md5_hh(b, c, d, a, x[i + 14], 23, -35309556);
            a = this.md5_hh(a, b, c, d, x[i +  1],  4, -1530992060);
            d = this.md5_hh(d, a, b, c, x[i +  4], 11,  1272893353);
            c = this.md5_hh(c, d, a, b, x[i +  7], 16, -155497632);
            b = this.md5_hh(b, c, d, a, x[i + 10], 23, -1094730640);
            a = this.md5_hh(a, b, c, d, x[i + 13],  4,  681279174);
            d = this.md5_hh(d, a, b, c, x[i],      11, -358537222);
            c = this.md5_hh(c, d, a, b, x[i +  3], 16, -722521979);
            b = this.md5_hh(b, c, d, a, x[i +  6], 23,  76029189);
            a = this.md5_hh(a, b, c, d, x[i +  9],  4, -640364487);
            d = this.md5_hh(d, a, b, c, x[i + 12], 11, -421815835);
            c = this.md5_hh(c, d, a, b, x[i + 15], 16,  530742520);
            b = this.md5_hh(b, c, d, a, x[i +  2], 23, -995338651);

            a = this.md5_ii(a, b, c, d, x[i],       6, -198630844);
            d = this.md5_ii(d, a, b, c, x[i +  7], 10,  1126891415);
            c = this.md5_ii(c, d, a, b, x[i + 14], 15, -1416354905);
            b = this.md5_ii(b, c, d, a, x[i +  5], 21, -57434055);
            a = this.md5_ii(a, b, c, d, x[i + 12],  6,  1700485571);
            d = this.md5_ii(d, a, b, c, x[i +  3], 10, -1894986606);
            c = this.md5_ii(c, d, a, b, x[i + 10], 15, -1051523);
            b = this.md5_ii(b, c, d, a, x[i +  1], 21, -2054922799);
            a = this.md5_ii(a, b, c, d, x[i +  8],  6,  1873313359);
            d = this.md5_ii(d, a, b, c, x[i + 15], 10, -30611744);
            c = this.md5_ii(c, d, a, b, x[i +  6], 15, -1560198380);
            b = this.md5_ii(b, c, d, a, x[i + 13], 21,  1309151649);
            a = this.md5_ii(a, b, c, d, x[i +  4],  6, -145523070);
            d = this.md5_ii(d, a, b, c, x[i + 11], 10, -1120210379);
            c = this.md5_ii(c, d, a, b, x[i +  2], 15,  718787259);
            b = this.md5_ii(b, c, d, a, x[i +  9], 21, -343485551);

            a = this.safe_add(a, olda);
            b = this.safe_add(b, oldb);
            c = this.safe_add(c, oldc);
            d = this.safe_add(d, oldd);
        }
        return [a, b, c, d];
    };

    /*
    * Convert an array of little-endian words to a string
    */
    BlueImpMD5.prototype.binl2rstr = function (input) {
        var i,
            output = '';
        for (i = 0; i < input.length * 32; i += 8) {
            output += String.fromCharCode((input[i >> 5] >>> (i % 32)) & 0xFF);
        }
        return output;
    };

    /*
    * Convert a raw string to an array of little-endian words
    * Characters >255 have their high-byte silently ignored.
    */
    BlueImpMD5.prototype.rstr2binl = function (input) {
        var i,
            output = [];
        output[(input.length >> 2) - 1] = undefined;
        for (i = 0; i < output.length; i += 1) {
            output[i] = 0;
        }
        for (i = 0; i < input.length * 8; i += 8) {
            output[i >> 5] |= (input.charCodeAt(i / 8) & 0xFF) << (i % 32);
        }
        return output;
    };

    /*
    * Calculate the MD5 of a raw string
    */
    BlueImpMD5.prototype.rstr_md5 = function (s) {
        return this.binl2rstr(this.binl_md5(this.rstr2binl(s), s.length * 8));
    };

    /*
    * Calculate the HMAC-MD5, of a key and some data (raw strings)
    */
    BlueImpMD5.prototype.rstr_hmac_md5 = function (key, data) {
        var i,
            bkey = this.rstr2binl(key),
            ipad = [],
            opad = [],
            hash;
        ipad[15] = opad[15] = undefined;
        if (bkey.length > 16) {
            bkey = this.binl_md5(bkey, key.length * 8);
        }
        for (i = 0; i < 16; i += 1) {
            ipad[i] = bkey[i] ^ 0x36363636;
            opad[i] = bkey[i] ^ 0x5C5C5C5C;
        }
        hash = this.binl_md5(ipad.concat(this.rstr2binl(data)), 512 + data.length * 8);
        return this.binl2rstr(this.binl_md5(opad.concat(hash), 512 + 128));
    };

    /*
    * Convert a raw string to a hex string
    */
    BlueImpMD5.prototype.rstr2hex = function (input) {
        var hex_tab = '0123456789abcdef',
            output = '',
            x,
            i;
        for (i = 0; i < input.length; i += 1) {
            x = input.charCodeAt(i);
            output += hex_tab.charAt((x >>> 4) & 0x0F) +
                hex_tab.charAt(x & 0x0F);
        }
        return output;
    };

    /*
    * Encode a string as utf-8
    */
    BlueImpMD5.prototype.str2rstr_utf8 = function (input) {
        return unescape(encodeURIComponent(input));
    };

    /*
    * Take string arguments and return either raw or hex encoded strings
    */
    BlueImpMD5.prototype.raw_md5 = function (s) {
        return this.rstr_md5(this.str2rstr_utf8(s));
    };
    BlueImpMD5.prototype.hex_md5 = function (s) {
        return this.rstr2hex(this.raw_md5(s));
    };
    BlueImpMD5.prototype.raw_hmac_md5 = function (k, d) {
        return this.rstr_hmac_md5(this.str2rstr_utf8(k), this.str2rstr_utf8(d));
    };
    BlueImpMD5.prototype.hex_hmac_md5 = function (k, d) {
        return this.rstr2hex(this.raw_hmac_md5(k, d));
    };

    BlueImpMD5.prototype.md5 = function (string, key, raw) {
        if (!key) {
            if (!raw) {
                return this.hex_md5(string);
            }

            return this.raw_md5(string);
        }

        if (!raw) {
            return this.hex_hmac_md5(key, string);
        }

        return this.raw_hmac_md5(key, string);
    };

    // CommonJS module
    if (typeof exports !== 'undefined') {
        if (typeof module !== 'undefined' && module.exports) {
            exports = module.exports = Chance;
        }
        exports.Chance = Chance;
    }

    // Register as an anonymous AMD module
    if (typeof define === 'function' && define.amd) {
        define([], function () {
            return Chance;
        });
    }

    // if there is a importsScrips object define chance for worker
    if (typeof importScripts !== 'undefined') {
        chance = new Chance();
    }

    // If there is a window object, that at least has a document property,
    // instantiate and define chance on the window
    if (typeof window === "object" && typeof window.document === "object") {
        window.Chance = Chance;
        window.chance = new Chance();
    }
})();

;(function(){
var f;
function r(b){var a=typeof b;if("object"==a)if(b){if(b instanceof Array)return"array";if(b instanceof Object)return a;var c=Object.prototype.toString.call(b);if("[object Window]"==c)return"object";if("[object Array]"==c||"number"==typeof b.length&&"undefined"!=typeof b.splice&&"undefined"!=typeof b.propertyIsEnumerable&&!b.propertyIsEnumerable("splice"))return"array";if("[object Function]"==c||"undefined"!=typeof b.call&&"undefined"!=typeof b.propertyIsEnumerable&&!b.propertyIsEnumerable("call"))return"function"}else return"null";else if("function"==
a&&"undefined"==typeof b.call)return"object";return a}var aa="closure_uid_"+(1E9*Math.random()>>>0),ba=0;function ca(b,a){for(var c in b)a.call(void 0,b[c],c,b)};function da(b,a){null!=b&&this.append.apply(this,arguments)}f=da.prototype;f.Ia="";f.set=function(b){this.Ia=""+b};f.append=function(b,a,c){this.Ia+=b;if(null!=a)for(var d=1;d<arguments.length;d++)this.Ia+=arguments[d];return this};f.clear=function(){this.Ia=""};f.toString=function(){return this.Ia};var ga;if("undefined"===typeof ia)var ia=function(){throw Error("No *print-fn* fn set for evaluation environment");};if("undefined"===typeof ja)var ja=function(){throw Error("No *print-err-fn* fn set for evaluation environment");};var ka=!0,ma=null;if("undefined"===typeof na)var na=null;function pa(){return new ra(null,5,[sa,!0,ta,!0,va,!1,wa,!1,ya,null],null)}function x(b){return null!=b&&!1!==b}function za(b){return b instanceof Array}function y(b,a){return b[r(null==a?null:a)]?!0:b._?!0:!1}
function z(b,a){var c=null==a?null:a.constructor,c=x(x(c)?c.ob:c)?c.$a:r(a);return Error(["No protocol method ",b," defined for type ",c,": ",a].join(""))}function Aa(b){var a=b.$a;return x(a)?a:""+B(b)}var Ba="undefined"!==typeof Symbol&&"function"===r(Symbol)?Symbol.iterator:"@@iterator";function Ca(b){for(var a=b.length,c=Array(a),d=0;;)if(d<a)c[d]=b[d],d+=1;else break;return c}
function Da(b){for(var a=[],c=arguments.length,d=0;;)if(d<c)a.push(arguments[d]),d+=1;else break;switch(a.length){case 1:return Fa(arguments[0]);case 2:return Fa(arguments[1]);default:throw Error([B("Invalid arity: "),B(a.length)].join(""));}}function Ga(b){return Fa(b)}function Fa(b){function a(a,b){a.push(b);return a}var c=[];return Ha?Ha(a,c,b):Ia.call(null,a,c,b)}function Ja(){}
var Ka=function Ka(a){if(null!=a&&null!=a.W)return a.W(a);var c=Ka[r(null==a?null:a)];if(null!=c)return c.b?c.b(a):c.call(null,a);c=Ka._;if(null!=c)return c.b?c.b(a):c.call(null,a);throw z("ICounted.-count",a);};function Ma(){}var Na=function Na(a,c){if(null!=a&&null!=a.N)return a.N(a,c);var d=Na[r(null==a?null:a)];if(null!=d)return d.a?d.a(a,c):d.call(null,a,c);d=Na._;if(null!=d)return d.a?d.a(a,c):d.call(null,a,c);throw z("ICollection.-conj",a);};function Oa(){}
var D=function D(a){for(var c=[],d=arguments.length,e=0;;)if(e<d)c.push(arguments[e]),e+=1;else break;switch(c.length){case 2:return D.a(arguments[0],arguments[1]);case 3:return D.g(arguments[0],arguments[1],arguments[2]);default:throw Error([B("Invalid arity: "),B(c.length)].join(""));}};
D.a=function(b,a){if(null!=b&&null!=b.L)return b.L(b,a);var c=D[r(null==b?null:b)];if(null!=c)return c.a?c.a(b,a):c.call(null,b,a);c=D._;if(null!=c)return c.a?c.a(b,a):c.call(null,b,a);throw z("IIndexed.-nth",b);};D.g=function(b,a,c){if(null!=b&&null!=b.ea)return b.ea(b,a,c);var d=D[r(null==b?null:b)];if(null!=d)return d.g?d.g(b,a,c):d.call(null,b,a,c);d=D._;if(null!=d)return d.g?d.g(b,a,c):d.call(null,b,a,c);throw z("IIndexed.-nth",b);};D.M=3;
var E=function E(a){if(null!=a&&null!=a.U)return a.U(a);var c=E[r(null==a?null:a)];if(null!=c)return c.b?c.b(a):c.call(null,a);c=E._;if(null!=c)return c.b?c.b(a):c.call(null,a);throw z("ISeq.-first",a);},F=function F(a){if(null!=a&&null!=a.aa)return a.aa(a);var c=F[r(null==a?null:a)];if(null!=c)return c.b?c.b(a):c.call(null,a);c=F._;if(null!=c)return c.b?c.b(a):c.call(null,a);throw z("ISeq.-rest",a);};function Pa(){}function Qa(){}
var Ra=function Ra(a){for(var c=[],d=arguments.length,e=0;;)if(e<d)c.push(arguments[e]),e+=1;else break;switch(c.length){case 2:return Ra.a(arguments[0],arguments[1]);case 3:return Ra.g(arguments[0],arguments[1],arguments[2]);default:throw Error([B("Invalid arity: "),B(c.length)].join(""));}};
Ra.a=function(b,a){if(null!=b&&null!=b.O)return b.O(b,a);var c=Ra[r(null==b?null:b)];if(null!=c)return c.a?c.a(b,a):c.call(null,b,a);c=Ra._;if(null!=c)return c.a?c.a(b,a):c.call(null,b,a);throw z("ILookup.-lookup",b);};Ra.g=function(b,a,c){if(null!=b&&null!=b.D)return b.D(b,a,c);var d=Ra[r(null==b?null:b)];if(null!=d)return d.g?d.g(b,a,c):d.call(null,b,a,c);d=Ra._;if(null!=d)return d.g?d.g(b,a,c):d.call(null,b,a,c);throw z("ILookup.-lookup",b);};Ra.M=3;
var Ta=function Ta(a,c,d){if(null!=a&&null!=a.Pa)return a.Pa(a,c,d);var e=Ta[r(null==a?null:a)];if(null!=e)return e.g?e.g(a,c,d):e.call(null,a,c,d);e=Ta._;if(null!=e)return e.g?e.g(a,c,d):e.call(null,a,c,d);throw z("IAssociative.-assoc",a);};function Ua(){}function Va(){}
var Wa=function Wa(a){if(null!=a&&null!=a.gb)return a.gb();var c=Wa[r(null==a?null:a)];if(null!=c)return c.b?c.b(a):c.call(null,a);c=Wa._;if(null!=c)return c.b?c.b(a):c.call(null,a);throw z("IMapEntry.-key",a);},Xa=function Xa(a){if(null!=a&&null!=a.hb)return a.hb();var c=Xa[r(null==a?null:a)];if(null!=c)return c.b?c.b(a):c.call(null,a);c=Xa._;if(null!=c)return c.b?c.b(a):c.call(null,a);throw z("IMapEntry.-val",a);};function Ya(){}
var Za=function Za(a,c,d){if(null!=a&&null!=a.ib)return a.ib(a,c,d);var e=Za[r(null==a?null:a)];if(null!=e)return e.g?e.g(a,c,d):e.call(null,a,c,d);e=Za._;if(null!=e)return e.g?e.g(a,c,d):e.call(null,a,c,d);throw z("IVector.-assoc-n",a);};function $a(){}
var ab=function ab(a){if(null!=a&&null!=a.F)return a.F(a);var c=ab[r(null==a?null:a)];if(null!=c)return c.b?c.b(a):c.call(null,a);c=ab._;if(null!=c)return c.b?c.b(a):c.call(null,a);throw z("IMeta.-meta",a);},bb=function bb(a,c){if(null!=a&&null!=a.I)return a.I(a,c);var d=bb[r(null==a?null:a)];if(null!=d)return d.a?d.a(a,c):d.call(null,a,c);d=bb._;if(null!=d)return d.a?d.a(a,c):d.call(null,a,c);throw z("IWithMeta.-with-meta",a);};function eb(){}
var fb=function fb(a){for(var c=[],d=arguments.length,e=0;;)if(e<d)c.push(arguments[e]),e+=1;else break;switch(c.length){case 2:return fb.a(arguments[0],arguments[1]);case 3:return fb.g(arguments[0],arguments[1],arguments[2]);default:throw Error([B("Invalid arity: "),B(c.length)].join(""));}};
fb.a=function(b,a){if(null!=b&&null!=b.S)return b.S(b,a);var c=fb[r(null==b?null:b)];if(null!=c)return c.a?c.a(b,a):c.call(null,b,a);c=fb._;if(null!=c)return c.a?c.a(b,a):c.call(null,b,a);throw z("IReduce.-reduce",b);};fb.g=function(b,a,c){if(null!=b&&null!=b.T)return b.T(b,a,c);var d=fb[r(null==b?null:b)];if(null!=d)return d.g?d.g(b,a,c):d.call(null,b,a,c);d=fb._;if(null!=d)return d.g?d.g(b,a,c):d.call(null,b,a,c);throw z("IReduce.-reduce",b);};fb.M=3;
var gb=function gb(a,c){if(null!=a&&null!=a.o)return a.o(a,c);var d=gb[r(null==a?null:a)];if(null!=d)return d.a?d.a(a,c):d.call(null,a,c);d=gb._;if(null!=d)return d.a?d.a(a,c):d.call(null,a,c);throw z("IEquiv.-equiv",a);},hb=function hb(a){if(null!=a&&null!=a.C)return a.C(a);var c=hb[r(null==a?null:a)];if(null!=c)return c.b?c.b(a):c.call(null,a);c=hb._;if(null!=c)return c.b?c.b(a):c.call(null,a);throw z("IHash.-hash",a);};function ib(){}
var jb=function jb(a){if(null!=a&&null!=a.P)return a.P(a);var c=jb[r(null==a?null:a)];if(null!=c)return c.b?c.b(a):c.call(null,a);c=jb._;if(null!=c)return c.b?c.b(a):c.call(null,a);throw z("ISeqable.-seq",a);};function kb(){}function lb(){}
var G=function G(a,c){if(null!=a&&null!=a.nb)return a.nb(0,c);var d=G[r(null==a?null:a)];if(null!=d)return d.a?d.a(a,c):d.call(null,a,c);d=G._;if(null!=d)return d.a?d.a(a,c):d.call(null,a,c);throw z("IWriter.-write",a);},mb=function mb(a){if(null!=a&&null!=a.Va)return a.Va(a);var c=mb[r(null==a?null:a)];if(null!=c)return c.b?c.b(a):c.call(null,a);c=mb._;if(null!=c)return c.b?c.b(a):c.call(null,a);throw z("IEditableCollection.-as-transient",a);},nb=function nb(a,c){if(null!=a&&null!=a.Ya)return a.Ya(a,
c);var d=nb[r(null==a?null:a)];if(null!=d)return d.a?d.a(a,c):d.call(null,a,c);d=nb._;if(null!=d)return d.a?d.a(a,c):d.call(null,a,c);throw z("ITransientCollection.-conj!",a);},ob=function ob(a){if(null!=a&&null!=a.Za)return a.Za(a);var c=ob[r(null==a?null:a)];if(null!=c)return c.b?c.b(a):c.call(null,a);c=ob._;if(null!=c)return c.b?c.b(a):c.call(null,a);throw z("ITransientCollection.-persistent!",a);},qb=function qb(a,c,d){if(null!=a&&null!=a.Ra)return a.Ra(a,c,d);var e=qb[r(null==a?null:a)];if(null!=
e)return e.g?e.g(a,c,d):e.call(null,a,c,d);e=qb._;if(null!=e)return e.g?e.g(a,c,d):e.call(null,a,c,d);throw z("ITransientAssociative.-assoc!",a);},rb=function rb(a,c,d){if(null!=a&&null!=a.mb)return a.mb(0,c,d);var e=rb[r(null==a?null:a)];if(null!=e)return e.g?e.g(a,c,d):e.call(null,a,c,d);e=rb._;if(null!=e)return e.g?e.g(a,c,d):e.call(null,a,c,d);throw z("ITransientVector.-assoc-n!",a);},sb=function sb(a){if(null!=a&&null!=a.kb)return a.kb();var c=sb[r(null==a?null:a)];if(null!=c)return c.b?c.b(a):
c.call(null,a);c=sb._;if(null!=c)return c.b?c.b(a):c.call(null,a);throw z("IChunk.-drop-first",a);},tb=function tb(a){if(null!=a&&null!=a.eb)return a.eb(a);var c=tb[r(null==a?null:a)];if(null!=c)return c.b?c.b(a):c.call(null,a);c=tb._;if(null!=c)return c.b?c.b(a):c.call(null,a);throw z("IChunkedSeq.-chunked-first",a);},ub=function ub(a){if(null!=a&&null!=a.fb)return a.fb(a);var c=ub[r(null==a?null:a)];if(null!=c)return c.b?c.b(a):c.call(null,a);c=ub._;if(null!=c)return c.b?c.b(a):c.call(null,a);throw z("IChunkedSeq.-chunked-rest",
a);},vb=function vb(a){if(null!=a&&null!=a.cb)return a.cb(a);var c=vb[r(null==a?null:a)];if(null!=c)return c.b?c.b(a):c.call(null,a);c=vb._;if(null!=c)return c.b?c.b(a):c.call(null,a);throw z("IChunkedNext.-chunked-next",a);},wb=function wb(a){if(null!=a&&null!=a.Da)return a.Da(a);var c=wb[r(null==a?null:a)];if(null!=c)return c.b?c.b(a):c.call(null,a);c=wb._;if(null!=c)return c.b?c.b(a):c.call(null,a);throw z("IIterable.-iterator",a);};function xb(b){this.Fb=b;this.i=1073741824;this.v=0}
xb.prototype.nb=function(b,a){return this.Fb.append(a)};function yb(b){var a=new da;b.H(null,new xb(a),pa());return""+B(a)}var zb="undefined"!==typeof Math.imul&&0!==Math.imul(4294967295,5)?function(b,a){return Math.imul(b,a)}:function(b,a){var c=b&65535,d=a&65535;return c*d+((b>>>16&65535)*d+c*(a>>>16&65535)<<16>>>0)|0};function Ab(b){b=zb(b|0,-862048943);return zb(b<<15|b>>>-15,461845907)}function Cb(b,a){var c=(b|0)^(a|0);return zb(c<<13|c>>>-13,5)+-430675100|0}
function Db(b,a){var c=(b|0)^a,c=zb(c^c>>>16,-2048144789),c=zb(c^c>>>13,-1028477387);return c^c>>>16}function Eb(b){var a;a:{a=1;for(var c=0;;)if(a<b.length){var d=a+2,c=Cb(c,Ab(b.charCodeAt(a-1)|b.charCodeAt(a)<<16));a=d}else{a=c;break a}}a=1===(b.length&1)?a^Ab(b.charCodeAt(b.length-1)):a;return Db(a,zb(2,b.length))}var Fb={},Gb=0;
function Hb(b){255<Gb&&(Fb={},Gb=0);var a=Fb[b];if("number"!==typeof a){a:if(null!=b)if(a=b.length,0<a)for(var c=0,d=0;;)if(c<a)var e=c+1,d=zb(31,d)+b.charCodeAt(c),c=e;else{a=d;break a}else a=0;else a=0;Fb[b]=a;Gb+=1}return b=a}
function Ib(b){if(null!=b&&(b.i&4194304||b.Jb))return b.C(null);if("number"===typeof b){if(x(isFinite(b)))return Math.floor(b)%2147483647;switch(b){case Infinity:return 2146435072;case -Infinity:return-1048576;default:return 2146959360}}else return!0===b?b=1:!1===b?b=0:"string"===typeof b?(b=Hb(b),0!==b&&(b=Ab(b),b=Cb(0,b),b=Db(b,4))):b=b instanceof Date?b.valueOf():null==b?0:hb(b),b}function Jb(b,a){return b^a+2654435769+(b<<6)+(b>>2)}
function Kb(b,a,c,d,e){this.Ua=b;this.name=a;this.Ha=c;this.Ma=d;this.da=e;this.i=2154168321;this.v=4096}f=Kb.prototype;f.toString=function(){return this.Ha};f.equiv=function(b){return this.o(null,b)};f.o=function(b,a){return a instanceof Kb?this.Ha===a.Ha:!1};
f.call=function(){function b(a,b,c){return H.g?H.g(b,this,c):H.call(null,b,this,c)}function a(a,b){return H.a?H.a(b,this):H.call(null,b,this)}var c=null,c=function(c,e,g){switch(arguments.length){case 2:return a.call(this,0,e);case 3:return b.call(this,0,e,g)}throw Error("Invalid arity: "+arguments.length);};c.a=a;c.g=b;return c}();f.apply=function(b,a){return this.call.apply(this,[this].concat(Ca(a)))};f.b=function(b){return H.a?H.a(b,this):H.call(null,b,this)};
f.a=function(b,a){return H.g?H.g(b,this,a):H.call(null,b,this,a)};f.F=function(){return this.da};f.I=function(b,a){return new Kb(this.Ua,this.name,this.Ha,this.Ma,a)};f.C=function(){var b=this.Ma;return null!=b?b:this.Ma=b=Jb(Eb(this.name),Hb(this.Ua))};f.H=function(b,a){return G(a,this.Ha)};
function J(b){if(null==b)return null;if(null!=b&&(b.i&8388608||b.Ab))return b.P(null);if(za(b)||"string"===typeof b)return 0===b.length?null:new K(b,0,null);if(y(ib,b))return jb(b);throw Error([B(b),B(" is not ISeqable")].join(""));}function L(b){if(null==b)return null;if(null!=b&&(b.i&64||b.Qa))return b.U(null);b=J(b);return null==b?null:E(b)}function Lb(b){return null!=b?null!=b&&(b.i&64||b.Qa)?b.aa(null):(b=J(b))?F(b):Mb:Mb}
function M(b){return null==b?null:null!=b&&(b.i&128||b.Xa)?b.Y(null):J(Lb(b))}var N=function N(a){for(var c=[],d=arguments.length,e=0;;)if(e<d)c.push(arguments[e]),e+=1;else break;switch(c.length){case 1:return N.b(arguments[0]);case 2:return N.a(arguments[0],arguments[1]);default:return N.A(arguments[0],arguments[1],new K(c.slice(2),0,null))}};N.b=function(){return!0};N.a=function(b,a){return null==b?null==a:b===a||gb(b,a)};
N.A=function(b,a,c){for(;;)if(N.a(b,a))if(M(c))b=a,a=L(c),c=M(c);else return N.a(a,L(c));else return!1};N.J=function(b){var a=L(b),c=M(b);b=L(c);c=M(c);return N.A(a,b,c)};N.M=2;function Nb(b){this.u=b}Nb.prototype.next=function(){if(null!=this.u){var b=L(this.u);this.u=M(this.u);return{value:b,done:!1}}return{value:null,done:!0}};function O(b){return new Nb(J(b))}function Ob(b,a){var c=Ab(b),c=Cb(0,c);return Db(c,a)}
function Pb(b){var a=0,c=1;for(b=J(b);;)if(null!=b)a+=1,c=zb(31,c)+Ib(L(b))|0,b=M(b);else return Ob(c,a)}var Qb=Ob(1,0);function Rb(b){var a=0,c=0;for(b=J(b);;)if(null!=b)a+=1,c=c+Ib(L(b))|0,b=M(b);else return Ob(c,a)}var Sb=Ob(0,0);Ja["null"]=!0;Ka["null"]=function(){return 0};Date.prototype.o=function(b,a){return a instanceof Date&&this.valueOf()===a.valueOf()};gb.number=function(b,a){return b===a};$a["function"]=!0;ab["function"]=function(){return null};hb._=function(b){return b[aa]||(b[aa]=++ba)};
function Tb(b,a){var c=Ka(b);if(0===c)return a.B?a.B():a.call(null);for(var d=D.a(b,0),e=1;;)if(e<c)var g=D.a(b,e),d=a.a?a.a(d,g):a.call(null,d,g),e=e+1;else return d}function Ub(b,a,c){var d=Ka(b),e=c;for(c=0;;)if(c<d){var g=D.a(b,c),e=a.a?a.a(e,g):a.call(null,e,g);c+=1}else return e}function Vb(b,a){var c=b.length;if(0===b.length)return a.B?a.B():a.call(null);for(var d=b[0],e=1;;)if(e<c)var g=b[e],d=a.a?a.a(d,g):a.call(null,d,g),e=e+1;else return d}
function Wb(b,a,c){var d=b.length,e=c;for(c=0;;)if(c<d){var g=b[c],e=a.a?a.a(e,g):a.call(null,e,g);c+=1}else return e}function Xb(b,a,c,d){for(var e=b.length;;)if(d<e){var g=b[d];c=a.a?a.a(c,g):a.call(null,c,g);d+=1}else return c}function Zb(b){return null!=b?b.i&2||b.qb?!0:b.i?!1:y(Ja,b):y(Ja,b)}function $b(b){return null!=b?b.i&16||b.lb?!0:b.i?!1:y(Oa,b):y(Oa,b)}
function Q(b,a,c){var d=R.b?R.b(b):R.call(null,b);if(c>=d)return-1;!(0<c)&&0>c&&(c+=d,c=0>c?0:c);for(;;)if(c<d){if(N.a(ac?ac(b,c):bc.call(null,b,c),a))return c;c+=1}else return-1}function S(b,a,c){var d=R.b?R.b(b):R.call(null,b);if(0===d)return-1;0<c?(--d,c=d<c?d:c):c=0>c?d+c:c;for(;;)if(0<=c){if(N.a(ac?ac(b,c):bc.call(null,b,c),a))return c;--c}else return-1}function cc(b,a){this.c=b;this.j=a}cc.prototype.fa=function(){return this.j<this.c.length};
cc.prototype.next=function(){var b=this.c[this.j];this.j+=1;return b};function K(b,a,c){this.c=b;this.j=a;this.l=c;this.i=166592766;this.v=8192}f=K.prototype;f.toString=function(){return yb(this)};f.equiv=function(b){return this.o(null,b)};f.indexOf=function(){var b=null,b=function(a,b){switch(arguments.length){case 1:return Q(this,a,0);case 2:return Q(this,a,b)}throw Error("Invalid arity: "+arguments.length);};b.b=function(a){return Q(this,a,0)};b.a=function(a,b){return Q(this,a,b)};return b}();
f.lastIndexOf=function(){function b(a){return S(this,a,R.b?R.b(this):R.call(null,this))}var a=null,a=function(a,d){switch(arguments.length){case 1:return b.call(this,a);case 2:return S(this,a,d)}throw Error("Invalid arity: "+arguments.length);};a.b=b;a.a=function(a,b){return S(this,a,b)};return a}();f.L=function(b,a){var c=a+this.j;return c<this.c.length?this.c[c]:null};f.ea=function(b,a,c){b=a+this.j;return b<this.c.length?this.c[b]:c};f.Da=function(){return new cc(this.c,this.j)};f.F=function(){return this.l};
f.Y=function(){return this.j+1<this.c.length?new K(this.c,this.j+1,null):null};f.W=function(){var b=this.c.length-this.j;return 0>b?0:b};f.C=function(){return Pb(this)};f.o=function(b,a){return dc.a?dc.a(this,a):dc.call(null,this,a)};f.S=function(b,a){return Xb(this.c,a,this.c[this.j],this.j+1)};f.T=function(b,a,c){return Xb(this.c,a,c,this.j)};f.U=function(){return this.c[this.j]};f.aa=function(){return this.j+1<this.c.length?new K(this.c,this.j+1,null):Mb};
f.P=function(){return this.j<this.c.length?this:null};f.I=function(b,a){return new K(this.c,this.j,a)};f.N=function(b,a){return T.a?T.a(a,this):T.call(null,a,this)};K.prototype[Ba]=function(){return O(this)};function ec(b,a){return a<b.length?new K(b,a,null):null}
function fc(b){for(var a=[],c=arguments.length,d=0;;)if(d<c)a.push(arguments[d]),d+=1;else break;switch(a.length){case 1:return ec(arguments[0],0);case 2:return ec(arguments[0],arguments[1]);default:throw Error([B("Invalid arity: "),B(a.length)].join(""));}}gb._=function(b,a){return b===a};
var gc=function gc(a){for(var c=[],d=arguments.length,e=0;;)if(e<d)c.push(arguments[e]),e+=1;else break;switch(c.length){case 0:return gc.B();case 1:return gc.b(arguments[0]);case 2:return gc.a(arguments[0],arguments[1]);default:return gc.A(arguments[0],arguments[1],new K(c.slice(2),0,null))}};gc.B=function(){return hc};gc.b=function(b){return b};gc.a=function(b,a){return null!=b?Na(b,a):Na(Mb,a)};gc.A=function(b,a,c){for(;;)if(x(c))b=gc.a(b,a),a=L(c),c=M(c);else return gc.a(b,a)};
gc.J=function(b){var a=L(b),c=M(b);b=L(c);c=M(c);return gc.A(a,b,c)};gc.M=2;function R(b){if(null!=b)if(null!=b&&(b.i&2||b.qb))b=b.W(null);else if(za(b))b=b.length;else if("string"===typeof b)b=b.length;else if(null!=b&&(b.i&8388608||b.Ab))a:{b=J(b);for(var a=0;;){if(Zb(b)){b=a+Ka(b);break a}b=M(b);a+=1}}else b=Ka(b);else b=0;return b}function ic(b,a,c){for(;;){if(null==b)return c;if(0===a)return J(b)?L(b):c;if($b(b))return D.g(b,a,c);if(J(b))b=M(b),--a;else return c}}
function bc(b){for(var a=[],c=arguments.length,d=0;;)if(d<c)a.push(arguments[d]),d+=1;else break;switch(a.length){case 2:return ac(arguments[0],arguments[1]);case 3:return jc(arguments[0],arguments[1],arguments[2]);default:throw Error([B("Invalid arity: "),B(a.length)].join(""));}}
function ac(b,a){if("number"!==typeof a)throw Error("index argument to nth must be a number");if(null==b)return b;if(null!=b&&(b.i&16||b.lb))return b.L(null,a);if(za(b))return a<b.length?b[a]:null;if("string"===typeof b)return a<b.length?b.charAt(a):null;if(null!=b&&(b.i&64||b.Qa)){var c;a:{c=b;for(var d=a;;){if(null==c)throw Error("Index out of bounds");if(0===d){if(J(c)){c=L(c);break a}throw Error("Index out of bounds");}if($b(c)){c=D.a(c,d);break a}if(J(c))c=M(c),--d;else throw Error("Index out of bounds");
}}return c}if(y(Oa,b))return D.a(b,a);throw Error([B("nth not supported on this type "),B(Aa(null==b?null:b.constructor))].join(""));}
function jc(b,a,c){if("number"!==typeof a)throw Error("index argument to nth must be a number.");if(null==b)return c;if(null!=b&&(b.i&16||b.lb))return b.ea(null,a,c);if(za(b))return a<b.length?b[a]:c;if("string"===typeof b)return a<b.length?b.charAt(a):c;if(null!=b&&(b.i&64||b.Qa))return ic(b,a,c);if(y(Oa,b))return D.a(b,a);throw Error([B("nth not supported on this type "),B(Aa(null==b?null:b.constructor))].join(""));}
var H=function H(a){for(var c=[],d=arguments.length,e=0;;)if(e<d)c.push(arguments[e]),e+=1;else break;switch(c.length){case 2:return H.a(arguments[0],arguments[1]);case 3:return H.g(arguments[0],arguments[1],arguments[2]);default:throw Error([B("Invalid arity: "),B(c.length)].join(""));}};H.a=function(b,a){return null==b?null:null!=b&&(b.i&256||b.ub)?b.O(null,a):za(b)?a<b.length?b[a|0]:null:"string"===typeof b?a<b.length?b[a|0]:null:y(Qa,b)?Ra.a(b,a):null};
H.g=function(b,a,c){return null!=b?null!=b&&(b.i&256||b.ub)?b.D(null,a,c):za(b)?a<b.length?b[a]:c:"string"===typeof b?a<b.length?b[a]:c:y(Qa,b)?Ra.g(b,a,c):c:c};H.M=3;var kc=function kc(a){for(var c=[],d=arguments.length,e=0;;)if(e<d)c.push(arguments[e]),e+=1;else break;switch(c.length){case 3:return kc.g(arguments[0],arguments[1],arguments[2]);default:return kc.A(arguments[0],arguments[1],arguments[2],new K(c.slice(3),0,null))}};
kc.g=function(b,a,c){if(null!=b)b=Ta(b,a,c);else a:{b=[a];c=[c];a=b.length;var d=0,e;for(e=mb(lc);;)if(d<a){var g=d+1;e=e.Ra(null,b[d],c[d]);d=g}else{b=ob(e);break a}}return b};kc.A=function(b,a,c,d){for(;;)if(b=kc.g(b,a,c),x(d))a=L(d),c=L(M(d)),d=M(M(d));else return b};kc.J=function(b){var a=L(b),c=M(b);b=L(c);var d=M(c),c=L(d),d=M(d);return kc.A(a,b,c,d)};kc.M=3;function mc(b,a){this.f=b;this.l=a;this.i=393217;this.v=0}f=mc.prototype;f.F=function(){return this.l};
f.I=function(b,a){return new mc(this.f,a)};
f.call=function(){function b(a,b,c,d,e,g,h,k,l,m,n,p,q,t,u,v,A,C,w,I,P,fa){a=this;return nc.Wa?nc.Wa(a.f,b,c,d,e,g,h,k,l,m,n,p,q,t,u,v,A,C,w,I,P,fa):nc.call(null,a.f,b,c,d,e,g,h,k,l,m,n,p,q,t,u,v,A,C,w,I,P,fa)}function a(a,b,c,d,e,g,h,k,l,m,n,p,q,t,u,v,A,C,w,I,P){a=this;return a.f.xa?a.f.xa(b,c,d,e,g,h,k,l,m,n,p,q,t,u,v,A,C,w,I,P):a.f.call(null,b,c,d,e,g,h,k,l,m,n,p,q,t,u,v,A,C,w,I,P)}function c(a,b,c,d,e,g,h,k,l,m,n,p,q,t,u,v,A,C,w,I){a=this;return a.f.wa?a.f.wa(b,c,d,e,g,h,k,l,m,n,p,q,t,u,v,A,C,
w,I):a.f.call(null,b,c,d,e,g,h,k,l,m,n,p,q,t,u,v,A,C,w,I)}function d(a,b,c,d,e,g,h,k,l,m,n,p,q,t,u,v,A,C,w){a=this;return a.f.va?a.f.va(b,c,d,e,g,h,k,l,m,n,p,q,t,u,v,A,C,w):a.f.call(null,b,c,d,e,g,h,k,l,m,n,p,q,t,u,v,A,C,w)}function e(a,b,c,d,e,g,h,k,l,m,n,p,q,t,u,v,A,C){a=this;return a.f.ua?a.f.ua(b,c,d,e,g,h,k,l,m,n,p,q,t,u,v,A,C):a.f.call(null,b,c,d,e,g,h,k,l,m,n,p,q,t,u,v,A,C)}function g(a,b,c,d,e,g,h,k,l,m,n,p,q,t,u,v,A){a=this;return a.f.ta?a.f.ta(b,c,d,e,g,h,k,l,m,n,p,q,t,u,v,A):a.f.call(null,
b,c,d,e,g,h,k,l,m,n,p,q,t,u,v,A)}function h(a,b,c,d,e,g,h,k,l,m,n,p,q,t,u,v){a=this;return a.f.sa?a.f.sa(b,c,d,e,g,h,k,l,m,n,p,q,t,u,v):a.f.call(null,b,c,d,e,g,h,k,l,m,n,p,q,t,u,v)}function k(a,b,c,d,e,g,h,k,l,m,n,p,q,t,u){a=this;return a.f.ra?a.f.ra(b,c,d,e,g,h,k,l,m,n,p,q,t,u):a.f.call(null,b,c,d,e,g,h,k,l,m,n,p,q,t,u)}function l(a,b,c,d,e,g,h,k,l,m,n,p,q,t){a=this;return a.f.qa?a.f.qa(b,c,d,e,g,h,k,l,m,n,p,q,t):a.f.call(null,b,c,d,e,g,h,k,l,m,n,p,q,t)}function m(a,b,c,d,e,g,h,k,l,m,n,p,q){a=this;
return a.f.pa?a.f.pa(b,c,d,e,g,h,k,l,m,n,p,q):a.f.call(null,b,c,d,e,g,h,k,l,m,n,p,q)}function n(a,b,c,d,e,g,h,k,l,m,n,p){a=this;return a.f.oa?a.f.oa(b,c,d,e,g,h,k,l,m,n,p):a.f.call(null,b,c,d,e,g,h,k,l,m,n,p)}function p(a,b,c,d,e,g,h,k,l,m,n){a=this;return a.f.na?a.f.na(b,c,d,e,g,h,k,l,m,n):a.f.call(null,b,c,d,e,g,h,k,l,m,n)}function q(a,b,c,d,e,g,h,k,l,m){a=this;return a.f.Ba?a.f.Ba(b,c,d,e,g,h,k,l,m):a.f.call(null,b,c,d,e,g,h,k,l,m)}function t(a,b,c,d,e,g,h,k,l){a=this;return a.f.Aa?a.f.Aa(b,c,
d,e,g,h,k,l):a.f.call(null,b,c,d,e,g,h,k,l)}function u(a,b,c,d,e,g,h,k){a=this;return a.f.za?a.f.za(b,c,d,e,g,h,k):a.f.call(null,b,c,d,e,g,h,k)}function v(a,b,c,d,e,g,h){a=this;return a.f.ya?a.f.ya(b,c,d,e,g,h):a.f.call(null,b,c,d,e,g,h)}function A(a,b,c,d,e,g){a=this;return a.f.X?a.f.X(b,c,d,e,g):a.f.call(null,b,c,d,e,g)}function C(a,b,c,d,e){a=this;return a.f.$?a.f.$(b,c,d,e):a.f.call(null,b,c,d,e)}function I(a,b,c,d){a=this;return a.f.g?a.f.g(b,c,d):a.f.call(null,b,c,d)}function P(a,b,c){a=this;
return a.f.a?a.f.a(b,c):a.f.call(null,b,c)}function fa(a,b){a=this;return a.f.b?a.f.b(b):a.f.call(null,b)}function db(a){a=this;return a.f.B?a.f.B():a.f.call(null)}var w=null,w=function(w,W,Y,Z,ea,ha,la,oa,qa,ua,xa,Ea,La,Sa,cb,pb,Bb,Yb,vc,Vc,Ud,Ae){switch(arguments.length){case 1:return db.call(this,w);case 2:return fa.call(this,w,W);case 3:return P.call(this,w,W,Y);case 4:return I.call(this,w,W,Y,Z);case 5:return C.call(this,w,W,Y,Z,ea);case 6:return A.call(this,w,W,Y,Z,ea,ha);case 7:return v.call(this,
w,W,Y,Z,ea,ha,la);case 8:return u.call(this,w,W,Y,Z,ea,ha,la,oa);case 9:return t.call(this,w,W,Y,Z,ea,ha,la,oa,qa);case 10:return q.call(this,w,W,Y,Z,ea,ha,la,oa,qa,ua);case 11:return p.call(this,w,W,Y,Z,ea,ha,la,oa,qa,ua,xa);case 12:return n.call(this,w,W,Y,Z,ea,ha,la,oa,qa,ua,xa,Ea);case 13:return m.call(this,w,W,Y,Z,ea,ha,la,oa,qa,ua,xa,Ea,La);case 14:return l.call(this,w,W,Y,Z,ea,ha,la,oa,qa,ua,xa,Ea,La,Sa);case 15:return k.call(this,w,W,Y,Z,ea,ha,la,oa,qa,ua,xa,Ea,La,Sa,cb);case 16:return h.call(this,
w,W,Y,Z,ea,ha,la,oa,qa,ua,xa,Ea,La,Sa,cb,pb);case 17:return g.call(this,w,W,Y,Z,ea,ha,la,oa,qa,ua,xa,Ea,La,Sa,cb,pb,Bb);case 18:return e.call(this,w,W,Y,Z,ea,ha,la,oa,qa,ua,xa,Ea,La,Sa,cb,pb,Bb,Yb);case 19:return d.call(this,w,W,Y,Z,ea,ha,la,oa,qa,ua,xa,Ea,La,Sa,cb,pb,Bb,Yb,vc);case 20:return c.call(this,w,W,Y,Z,ea,ha,la,oa,qa,ua,xa,Ea,La,Sa,cb,pb,Bb,Yb,vc,Vc);case 21:return a.call(this,w,W,Y,Z,ea,ha,la,oa,qa,ua,xa,Ea,La,Sa,cb,pb,Bb,Yb,vc,Vc,Ud);case 22:return b.call(this,w,W,Y,Z,ea,ha,la,oa,qa,ua,
xa,Ea,La,Sa,cb,pb,Bb,Yb,vc,Vc,Ud,Ae)}throw Error("Invalid arity: "+arguments.length);};w.b=db;w.a=fa;w.g=P;w.$=I;w.X=C;w.ya=A;w.za=v;w.Aa=u;w.Ba=t;w.na=q;w.oa=p;w.pa=n;w.qa=m;w.ra=l;w.sa=k;w.ta=h;w.ua=g;w.va=e;w.wa=d;w.xa=c;w.tb=a;w.Wa=b;return w}();f.apply=function(b,a){return this.call.apply(this,[this].concat(Ca(a)))};f.B=function(){return this.f.B?this.f.B():this.f.call(null)};f.b=function(b){return this.f.b?this.f.b(b):this.f.call(null,b)};
f.a=function(b,a){return this.f.a?this.f.a(b,a):this.f.call(null,b,a)};f.g=function(b,a,c){return this.f.g?this.f.g(b,a,c):this.f.call(null,b,a,c)};f.$=function(b,a,c,d){return this.f.$?this.f.$(b,a,c,d):this.f.call(null,b,a,c,d)};f.X=function(b,a,c,d,e){return this.f.X?this.f.X(b,a,c,d,e):this.f.call(null,b,a,c,d,e)};f.ya=function(b,a,c,d,e,g){return this.f.ya?this.f.ya(b,a,c,d,e,g):this.f.call(null,b,a,c,d,e,g)};
f.za=function(b,a,c,d,e,g,h){return this.f.za?this.f.za(b,a,c,d,e,g,h):this.f.call(null,b,a,c,d,e,g,h)};f.Aa=function(b,a,c,d,e,g,h,k){return this.f.Aa?this.f.Aa(b,a,c,d,e,g,h,k):this.f.call(null,b,a,c,d,e,g,h,k)};f.Ba=function(b,a,c,d,e,g,h,k,l){return this.f.Ba?this.f.Ba(b,a,c,d,e,g,h,k,l):this.f.call(null,b,a,c,d,e,g,h,k,l)};f.na=function(b,a,c,d,e,g,h,k,l,m){return this.f.na?this.f.na(b,a,c,d,e,g,h,k,l,m):this.f.call(null,b,a,c,d,e,g,h,k,l,m)};
f.oa=function(b,a,c,d,e,g,h,k,l,m,n){return this.f.oa?this.f.oa(b,a,c,d,e,g,h,k,l,m,n):this.f.call(null,b,a,c,d,e,g,h,k,l,m,n)};f.pa=function(b,a,c,d,e,g,h,k,l,m,n,p){return this.f.pa?this.f.pa(b,a,c,d,e,g,h,k,l,m,n,p):this.f.call(null,b,a,c,d,e,g,h,k,l,m,n,p)};f.qa=function(b,a,c,d,e,g,h,k,l,m,n,p,q){return this.f.qa?this.f.qa(b,a,c,d,e,g,h,k,l,m,n,p,q):this.f.call(null,b,a,c,d,e,g,h,k,l,m,n,p,q)};
f.ra=function(b,a,c,d,e,g,h,k,l,m,n,p,q,t){return this.f.ra?this.f.ra(b,a,c,d,e,g,h,k,l,m,n,p,q,t):this.f.call(null,b,a,c,d,e,g,h,k,l,m,n,p,q,t)};f.sa=function(b,a,c,d,e,g,h,k,l,m,n,p,q,t,u){return this.f.sa?this.f.sa(b,a,c,d,e,g,h,k,l,m,n,p,q,t,u):this.f.call(null,b,a,c,d,e,g,h,k,l,m,n,p,q,t,u)};f.ta=function(b,a,c,d,e,g,h,k,l,m,n,p,q,t,u,v){return this.f.ta?this.f.ta(b,a,c,d,e,g,h,k,l,m,n,p,q,t,u,v):this.f.call(null,b,a,c,d,e,g,h,k,l,m,n,p,q,t,u,v)};
f.ua=function(b,a,c,d,e,g,h,k,l,m,n,p,q,t,u,v,A){return this.f.ua?this.f.ua(b,a,c,d,e,g,h,k,l,m,n,p,q,t,u,v,A):this.f.call(null,b,a,c,d,e,g,h,k,l,m,n,p,q,t,u,v,A)};f.va=function(b,a,c,d,e,g,h,k,l,m,n,p,q,t,u,v,A,C){return this.f.va?this.f.va(b,a,c,d,e,g,h,k,l,m,n,p,q,t,u,v,A,C):this.f.call(null,b,a,c,d,e,g,h,k,l,m,n,p,q,t,u,v,A,C)};
f.wa=function(b,a,c,d,e,g,h,k,l,m,n,p,q,t,u,v,A,C,I){return this.f.wa?this.f.wa(b,a,c,d,e,g,h,k,l,m,n,p,q,t,u,v,A,C,I):this.f.call(null,b,a,c,d,e,g,h,k,l,m,n,p,q,t,u,v,A,C,I)};f.xa=function(b,a,c,d,e,g,h,k,l,m,n,p,q,t,u,v,A,C,I,P){return this.f.xa?this.f.xa(b,a,c,d,e,g,h,k,l,m,n,p,q,t,u,v,A,C,I,P):this.f.call(null,b,a,c,d,e,g,h,k,l,m,n,p,q,t,u,v,A,C,I,P)};
f.tb=function(b,a,c,d,e,g,h,k,l,m,n,p,q,t,u,v,A,C,I,P,fa){return nc.Wa?nc.Wa(this.f,b,a,c,d,e,g,h,k,l,m,n,p,q,t,u,v,A,C,I,P,fa):nc.call(null,this.f,b,a,c,d,e,g,h,k,l,m,n,p,q,t,u,v,A,C,I,P,fa)};function oc(b,a){return"function"==r(b)?new mc(b,a):null==b?null:bb(b,a)}function pc(b){var a=null!=b;return(a?null!=b?b.i&131072||b.xb||(b.i?0:y($a,b)):y($a,b):a)?ab(b):null}function qc(b){return null!=b?b.i&16777216||b.Lb?!0:b.i?!1:y(kb,b):y(kb,b)}
function rc(b){return null==b?!1:null!=b?b.i&1024||b.vb?!0:b.i?!1:y(Ua,b):y(Ua,b)}function sc(b){return null!=b?b.i&16384||b.Mb?!0:b.i?!1:y(Ya,b):y(Ya,b)}function tc(b){return null!=b?b.v&512||b.Gb?!0:!1:!1}function uc(b){var a=[];ca(b,function(a,b){return function(a,c){return b.push(c)}}(b,a));return a}function wc(b,a,c,d,e){for(;0!==e;)c[d]=b[a],d+=1,--e,a+=1}var xc={};function yc(b){return null==b?!1:!1===b?!1:!0}
function zc(b,a){var c=J(a);if(c){var d=L(c),c=M(c);return Ha?Ha(b,d,c):Ia.call(null,b,d,c)}return b.B?b.B():b.call(null)}function Ac(b,a,c){for(c=J(c);;)if(c){var d=L(c);a=b.a?b.a(a,d):b.call(null,a,d);c=M(c)}else return a}
function Ia(b){for(var a=[],c=arguments.length,d=0;;)if(d<c)a.push(arguments[d]),d+=1;else break;switch(a.length){case 2:return a=arguments[0],c=arguments[1],null!=c&&(c.i&524288||c.zb)?c.S(null,a):za(c)?Vb(c,a):"string"===typeof c?Vb(c,a):y(eb,c)?fb.a(c,a):zc(a,c);case 3:return Ha(arguments[0],arguments[1],arguments[2]);default:throw Error([B("Invalid arity: "),B(a.length)].join(""));}}
function Ha(b,a,c){return null!=c&&(c.i&524288||c.zb)?c.T(null,b,a):za(c)?Wb(c,b,a):"string"===typeof c?Wb(c,b,a):y(eb,c)?fb.g(c,b,a):Ac(b,a,c)}function Bc(b){return b}function Cc(b){b=(b-b%2)/2;return 0<=b?Math.floor(b):Math.ceil(b)}function Dc(b){b-=b>>1&1431655765;b=(b&858993459)+(b>>2&858993459);return 16843009*(b+(b>>4)&252645135)>>24}
var B=function B(a){for(var c=[],d=arguments.length,e=0;;)if(e<d)c.push(arguments[e]),e+=1;else break;switch(c.length){case 0:return B.B();case 1:return B.b(arguments[0]);default:return B.A(arguments[0],new K(c.slice(1),0,null))}};B.B=function(){return""};B.b=function(b){return null==b?"":""+b};B.A=function(b,a){for(var c=new da(""+B(b)),d=a;;)if(x(d))c=c.append(""+B(L(d))),d=M(d);else return c.toString()};B.J=function(b){var a=L(b);b=M(b);return B.A(a,b)};B.M=1;
function dc(b,a){var c;if(qc(a))if(Zb(b)&&Zb(a)&&R(b)!==R(a))c=!1;else a:{c=J(b);for(var d=J(a);;){if(null==c){c=null==d;break a}if(null!=d&&N.a(L(c),L(d)))c=M(c),d=M(d);else{c=!1;break a}}}else c=null;return yc(c)}function Ec(b,a,c,d,e){this.l=b;this.first=a;this.Ca=c;this.count=d;this.m=e;this.i=65937646;this.v=8192}f=Ec.prototype;f.toString=function(){return yb(this)};f.equiv=function(b){return this.o(null,b)};
f.indexOf=function(){var b=null,b=function(a,b){switch(arguments.length){case 1:return Q(this,a,0);case 2:return Q(this,a,b)}throw Error("Invalid arity: "+arguments.length);};b.b=function(a){return Q(this,a,0)};b.a=function(a,b){return Q(this,a,b)};return b}();
f.lastIndexOf=function(){function b(a){return S(this,a,this.count)}var a=null,a=function(a,d){switch(arguments.length){case 1:return b.call(this,a);case 2:return S(this,a,d)}throw Error("Invalid arity: "+arguments.length);};a.b=b;a.a=function(a,b){return S(this,a,b)};return a}();f.F=function(){return this.l};f.Y=function(){return 1===this.count?null:this.Ca};f.W=function(){return this.count};f.C=function(){var b=this.m;return null!=b?b:this.m=b=Pb(this)};f.o=function(b,a){return dc(this,a)};
f.S=function(b,a){return zc(a,this)};f.T=function(b,a,c){return Ac(a,c,this)};f.U=function(){return this.first};f.aa=function(){return 1===this.count?Mb:this.Ca};f.P=function(){return this};f.I=function(b,a){return new Ec(a,this.first,this.Ca,this.count,this.m)};f.N=function(b,a){return new Ec(this.l,a,this,this.count+1,null)};Ec.prototype[Ba]=function(){return O(this)};function Fc(b){this.l=b;this.i=65937614;this.v=8192}f=Fc.prototype;f.toString=function(){return yb(this)};
f.equiv=function(b){return this.o(null,b)};f.indexOf=function(){var b=null,b=function(a,b){switch(arguments.length){case 1:return Q(this,a,0);case 2:return Q(this,a,b)}throw Error("Invalid arity: "+arguments.length);};b.b=function(a){return Q(this,a,0)};b.a=function(a,b){return Q(this,a,b)};return b}();
f.lastIndexOf=function(){function b(a){return S(this,a,R(this))}var a=null,a=function(a,d){switch(arguments.length){case 1:return b.call(this,a);case 2:return S(this,a,d)}throw Error("Invalid arity: "+arguments.length);};a.b=b;a.a=function(a,b){return S(this,a,b)};return a}();f.F=function(){return this.l};f.Y=function(){return null};f.W=function(){return 0};f.C=function(){return Qb};f.o=function(b,a){return(null!=a?a.i&33554432||a.Kb||(a.i?0:y(lb,a)):y(lb,a))||qc(a)?null==J(a):!1};
f.S=function(b,a){return zc(a,this)};f.T=function(b,a,c){return Ac(a,c,this)};f.U=function(){return null};f.aa=function(){return Mb};f.P=function(){return null};f.I=function(b,a){return new Fc(a)};f.N=function(b,a){return new Ec(this.l,a,null,1,null)};var Mb=new Fc(null);Fc.prototype[Ba]=function(){return O(this)};
function Gc(b){for(var a=[],c=arguments.length,d=0;;)if(d<c)a.push(arguments[d]),d+=1;else break;a:{c=0<a.length?new K(a.slice(0),0,null):null;if(c instanceof K&&0===c.j)a=c.c;else b:for(a=[];;)if(null!=c)a.push(c.U(null)),c=c.Y(null);else break b;for(var c=a.length,e=Mb;;)if(0<c)d=c-1,e=e.N(null,a[c-1]),c=d;else break a}return e}function Hc(b,a,c,d){this.l=b;this.first=a;this.Ca=c;this.m=d;this.i=65929452;this.v=8192}f=Hc.prototype;f.toString=function(){return yb(this)};
f.equiv=function(b){return this.o(null,b)};f.indexOf=function(){var b=null,b=function(a,b){switch(arguments.length){case 1:return Q(this,a,0);case 2:return Q(this,a,b)}throw Error("Invalid arity: "+arguments.length);};b.b=function(a){return Q(this,a,0)};b.a=function(a,b){return Q(this,a,b)};return b}();
f.lastIndexOf=function(){function b(a){return S(this,a,R(this))}var a=null,a=function(a,d){switch(arguments.length){case 1:return b.call(this,a);case 2:return S(this,a,d)}throw Error("Invalid arity: "+arguments.length);};a.b=b;a.a=function(a,b){return S(this,a,b)};return a}();f.F=function(){return this.l};f.Y=function(){return null==this.Ca?null:J(this.Ca)};f.C=function(){var b=this.m;return null!=b?b:this.m=b=Pb(this)};f.o=function(b,a){return dc(this,a)};f.S=function(b,a){return zc(a,this)};
f.T=function(b,a,c){return Ac(a,c,this)};f.U=function(){return this.first};f.aa=function(){return null==this.Ca?Mb:this.Ca};f.P=function(){return this};f.I=function(b,a){return new Hc(a,this.first,this.Ca,this.m)};f.N=function(b,a){return new Hc(null,a,this,null)};Hc.prototype[Ba]=function(){return O(this)};function T(b,a){var c=null==a;return(c?c:null!=a&&(a.i&64||a.Qa))?new Hc(null,b,a,null):new Hc(null,b,J(a),null)}
function U(b,a,c,d){this.Ua=b;this.name=a;this.Fa=c;this.Ma=d;this.i=2153775105;this.v=4096}f=U.prototype;f.toString=function(){return[B(":"),B(this.Fa)].join("")};f.equiv=function(b){return this.o(null,b)};f.o=function(b,a){return a instanceof U?this.Fa===a.Fa:!1};
f.call=function(){var b=null,b=function(a,b,d){switch(arguments.length){case 2:return H.a(b,this);case 3:return H.g(b,this,d)}throw Error("Invalid arity: "+arguments.length);};b.a=function(a,b){return H.a(b,this)};b.g=function(a,b,d){return H.g(b,this,d)};return b}();f.apply=function(b,a){return this.call.apply(this,[this].concat(Ca(a)))};f.b=function(b){return H.a(b,this)};f.a=function(b,a){return H.g(b,this,a)};
f.C=function(){var b=this.Ma;return null!=b?b:this.Ma=b=Jb(Eb(this.name),Hb(this.Ua))+2654435769|0};f.H=function(b,a){return G(a,[B(":"),B(this.Fa)].join(""))};var Ic=function Ic(a){for(var c=[],d=arguments.length,e=0;;)if(e<d)c.push(arguments[e]),e+=1;else break;switch(c.length){case 1:return Ic.b(arguments[0]);case 2:return Ic.a(arguments[0],arguments[1]);default:throw Error([B("Invalid arity: "),B(c.length)].join(""));}};
Ic.b=function(b){if(b instanceof U)return b;if(b instanceof Kb){var a;if(null!=b&&(b.v&4096||b.yb))a=b.Ua;else throw Error([B("Doesn't support namespace: "),B(b)].join(""));return new U(a,Jc.b?Jc.b(b):Jc.call(null,b),b.Ha,null)}return"string"===typeof b?(a=b.split("/"),2===a.length?new U(a[0],a[1],b,null):new U(null,a[0],b,null)):null};Ic.a=function(b,a){return new U(b,a,[B(x(b)?[B(b),B("/")].join(""):null),B(a)].join(""),null)};Ic.M=2;
function Kc(b,a,c,d){this.l=b;this.Oa=a;this.u=c;this.m=d;this.i=32374988;this.v=1}f=Kc.prototype;f.toString=function(){return yb(this)};f.equiv=function(b){return this.o(null,b)};function Lc(b){null!=b.Oa&&(b.u=b.Oa.B?b.Oa.B():b.Oa.call(null),b.Oa=null);return b.u}
f.indexOf=function(){var b=null,b=function(a,b){switch(arguments.length){case 1:return Q(this,a,0);case 2:return Q(this,a,b)}throw Error("Invalid arity: "+arguments.length);};b.b=function(a){return Q(this,a,0)};b.a=function(a,b){return Q(this,a,b)};return b}();
f.lastIndexOf=function(){function b(a){return S(this,a,R(this))}var a=null,a=function(a,d){switch(arguments.length){case 1:return b.call(this,a);case 2:return S(this,a,d)}throw Error("Invalid arity: "+arguments.length);};a.b=b;a.a=function(a,b){return S(this,a,b)};return a}();f.F=function(){return this.l};f.Y=function(){jb(this);return null==this.u?null:M(this.u)};f.C=function(){var b=this.m;return null!=b?b:this.m=b=Pb(this)};f.o=function(b,a){return dc(this,a)};f.S=function(b,a){return zc(a,this)};
f.T=function(b,a,c){return Ac(a,c,this)};f.U=function(){jb(this);return null==this.u?null:L(this.u)};f.aa=function(){jb(this);return null!=this.u?Lb(this.u):Mb};f.P=function(){Lc(this);if(null==this.u)return null;for(var b=this.u;;)if(b instanceof Kc)b=Lc(b);else return this.u=b,J(this.u)};f.I=function(b,a){return new Kc(a,this.Oa,this.u,this.m)};f.N=function(b,a){return T(a,this)};Kc.prototype[Ba]=function(){return O(this)};function Mc(b,a){this.bb=b;this.end=a;this.i=2;this.v=0}
Mc.prototype.add=function(b){this.bb[this.end]=b;return this.end+=1};Mc.prototype.ma=function(){var b=new Nc(this.bb,0,this.end);this.bb=null;return b};Mc.prototype.W=function(){return this.end};function Nc(b,a,c){this.c=b;this.K=a;this.end=c;this.i=524306;this.v=0}f=Nc.prototype;f.W=function(){return this.end-this.K};f.L=function(b,a){return this.c[this.K+a]};f.ea=function(b,a,c){return 0<=a&&a<this.end-this.K?this.c[this.K+a]:c};
f.kb=function(){if(this.K===this.end)throw Error("-drop-first of empty chunk");return new Nc(this.c,this.K+1,this.end)};f.S=function(b,a){return Xb(this.c,a,this.c[this.K],this.K+1)};f.T=function(b,a,c){return Xb(this.c,a,c,this.K)};function Oc(b,a,c,d){this.ma=b;this.ja=a;this.l=c;this.m=d;this.i=31850732;this.v=1536}f=Oc.prototype;f.toString=function(){return yb(this)};f.equiv=function(b){return this.o(null,b)};
f.indexOf=function(){var b=null,b=function(a,b){switch(arguments.length){case 1:return Q(this,a,0);case 2:return Q(this,a,b)}throw Error("Invalid arity: "+arguments.length);};b.b=function(a){return Q(this,a,0)};b.a=function(a,b){return Q(this,a,b)};return b}();
f.lastIndexOf=function(){function b(a){return S(this,a,R(this))}var a=null,a=function(a,d){switch(arguments.length){case 1:return b.call(this,a);case 2:return S(this,a,d)}throw Error("Invalid arity: "+arguments.length);};a.b=b;a.a=function(a,b){return S(this,a,b)};return a}();f.F=function(){return this.l};f.Y=function(){if(1<Ka(this.ma))return new Oc(sb(this.ma),this.ja,this.l,null);var b=jb(this.ja);return null==b?null:b};f.C=function(){var b=this.m;return null!=b?b:this.m=b=Pb(this)};
f.o=function(b,a){return dc(this,a)};f.U=function(){return D.a(this.ma,0)};f.aa=function(){return 1<Ka(this.ma)?new Oc(sb(this.ma),this.ja,this.l,null):null==this.ja?Mb:this.ja};f.P=function(){return this};f.eb=function(){return this.ma};f.fb=function(){return null==this.ja?Mb:this.ja};f.I=function(b,a){return new Oc(this.ma,this.ja,a,this.m)};f.N=function(b,a){return T(a,this)};f.cb=function(){return null==this.ja?null:this.ja};Oc.prototype[Ba]=function(){return O(this)};
function Pc(b,a){return 0===Ka(b)?a:new Oc(b,a,null,null)}function Qc(b,a){b.add(a)}function Rc(b){for(var a=[];;)if(J(b))a.push(L(b)),b=M(b);else return a}function Sc(b,a){if(Zb(b))return R(b);for(var c=b,d=a,e=0;;)if(0<d&&J(c))c=M(c),--d,e+=1;else return e}var Tc=function Tc(a){return null==a?null:null==M(a)?J(L(a)):T(L(a),Tc(M(a)))};
function Uc(b,a,c){var d=J(c);if(0===a)return b.B?b.B():b.call(null);c=E(d);var e=F(d);if(1===a)return b.b?b.b(c):b.b?b.b(c):b.call(null,c);var d=E(e),g=F(e);if(2===a)return b.a?b.a(c,d):b.a?b.a(c,d):b.call(null,c,d);var e=E(g),h=F(g);if(3===a)return b.g?b.g(c,d,e):b.g?b.g(c,d,e):b.call(null,c,d,e);var g=E(h),k=F(h);if(4===a)return b.$?b.$(c,d,e,g):b.$?b.$(c,d,e,g):b.call(null,c,d,e,g);var h=E(k),l=F(k);if(5===a)return b.X?b.X(c,d,e,g,h):b.X?b.X(c,d,e,g,h):b.call(null,c,d,e,g,h);var k=E(l),m=F(l);
if(6===a)return b.ya?b.ya(c,d,e,g,h,k):b.ya?b.ya(c,d,e,g,h,k):b.call(null,c,d,e,g,h,k);var l=E(m),n=F(m);if(7===a)return b.za?b.za(c,d,e,g,h,k,l):b.za?b.za(c,d,e,g,h,k,l):b.call(null,c,d,e,g,h,k,l);var m=E(n),p=F(n);if(8===a)return b.Aa?b.Aa(c,d,e,g,h,k,l,m):b.Aa?b.Aa(c,d,e,g,h,k,l,m):b.call(null,c,d,e,g,h,k,l,m);var n=E(p),q=F(p);if(9===a)return b.Ba?b.Ba(c,d,e,g,h,k,l,m,n):b.Ba?b.Ba(c,d,e,g,h,k,l,m,n):b.call(null,c,d,e,g,h,k,l,m,n);var p=E(q),t=F(q);if(10===a)return b.na?b.na(c,d,e,g,h,k,l,m,n,
p):b.na?b.na(c,d,e,g,h,k,l,m,n,p):b.call(null,c,d,e,g,h,k,l,m,n,p);var q=E(t),u=F(t);if(11===a)return b.oa?b.oa(c,d,e,g,h,k,l,m,n,p,q):b.oa?b.oa(c,d,e,g,h,k,l,m,n,p,q):b.call(null,c,d,e,g,h,k,l,m,n,p,q);var t=E(u),v=F(u);if(12===a)return b.pa?b.pa(c,d,e,g,h,k,l,m,n,p,q,t):b.pa?b.pa(c,d,e,g,h,k,l,m,n,p,q,t):b.call(null,c,d,e,g,h,k,l,m,n,p,q,t);var u=E(v),A=F(v);if(13===a)return b.qa?b.qa(c,d,e,g,h,k,l,m,n,p,q,t,u):b.qa?b.qa(c,d,e,g,h,k,l,m,n,p,q,t,u):b.call(null,c,d,e,g,h,k,l,m,n,p,q,t,u);var v=E(A),
C=F(A);if(14===a)return b.ra?b.ra(c,d,e,g,h,k,l,m,n,p,q,t,u,v):b.ra?b.ra(c,d,e,g,h,k,l,m,n,p,q,t,u,v):b.call(null,c,d,e,g,h,k,l,m,n,p,q,t,u,v);var A=E(C),I=F(C);if(15===a)return b.sa?b.sa(c,d,e,g,h,k,l,m,n,p,q,t,u,v,A):b.sa?b.sa(c,d,e,g,h,k,l,m,n,p,q,t,u,v,A):b.call(null,c,d,e,g,h,k,l,m,n,p,q,t,u,v,A);var C=E(I),P=F(I);if(16===a)return b.ta?b.ta(c,d,e,g,h,k,l,m,n,p,q,t,u,v,A,C):b.ta?b.ta(c,d,e,g,h,k,l,m,n,p,q,t,u,v,A,C):b.call(null,c,d,e,g,h,k,l,m,n,p,q,t,u,v,A,C);var I=E(P),fa=F(P);if(17===a)return b.ua?
b.ua(c,d,e,g,h,k,l,m,n,p,q,t,u,v,A,C,I):b.ua?b.ua(c,d,e,g,h,k,l,m,n,p,q,t,u,v,A,C,I):b.call(null,c,d,e,g,h,k,l,m,n,p,q,t,u,v,A,C,I);var P=E(fa),db=F(fa);if(18===a)return b.va?b.va(c,d,e,g,h,k,l,m,n,p,q,t,u,v,A,C,I,P):b.va?b.va(c,d,e,g,h,k,l,m,n,p,q,t,u,v,A,C,I,P):b.call(null,c,d,e,g,h,k,l,m,n,p,q,t,u,v,A,C,I,P);fa=E(db);db=F(db);if(19===a)return b.wa?b.wa(c,d,e,g,h,k,l,m,n,p,q,t,u,v,A,C,I,P,fa):b.wa?b.wa(c,d,e,g,h,k,l,m,n,p,q,t,u,v,A,C,I,P,fa):b.call(null,c,d,e,g,h,k,l,m,n,p,q,t,u,v,A,C,I,P,fa);var w=
E(db);F(db);if(20===a)return b.xa?b.xa(c,d,e,g,h,k,l,m,n,p,q,t,u,v,A,C,I,P,fa,w):b.xa?b.xa(c,d,e,g,h,k,l,m,n,p,q,t,u,v,A,C,I,P,fa,w):b.call(null,c,d,e,g,h,k,l,m,n,p,q,t,u,v,A,C,I,P,fa,w);throw Error("Only up to 20 arguments supported on functions");}
function nc(b){for(var a=[],c=arguments.length,d=0;;)if(d<c)a.push(arguments[d]),d+=1;else break;switch(a.length){case 2:return Wc(arguments[0],arguments[1]);case 3:return Xc(arguments[0],arguments[1],arguments[2]);case 4:c=arguments[0];a=T(arguments[1],T(arguments[2],arguments[3]));d=c.M;if(c.J)var e=Sc(a,d+1),c=e<=d?Uc(c,e,a):c.J(a);else c=c.apply(c,Rc(a));return c;case 5:return c=arguments[0],a=T(arguments[1],T(arguments[2],T(arguments[3],arguments[4]))),d=c.M,c.J?(e=Sc(a,d+1),c=e<=d?Uc(c,e,a):
c.J(a)):c=c.apply(c,Rc(a)),c;default:return c=arguments[0],a=T(arguments[1],T(arguments[2],T(arguments[3],T(arguments[4],Tc(new K(a.slice(5),0,null)))))),d=c.M,c.J?(e=Sc(a,d+1),c=e<=d?Uc(c,e,a):c.J(a)):c=c.apply(c,Rc(a)),c}}function Wc(b,a){var c=b.M;if(b.J){var d=Sc(a,c+1);return d<=c?Uc(b,d,a):b.J(a)}return b.apply(b,Rc(a))}function Xc(b,a,c){a=T(a,c);c=b.M;if(b.J){var d=Sc(a,c+1);return d<=c?Uc(b,d,a):b.J(a)}return b.apply(b,Rc(a))}
var Yc=function Yc(){"undefined"===typeof ga&&(ga=function(a,c){this.Eb=a;this.Db=c;this.i=393216;this.v=0},ga.prototype.I=function(a,c){return new ga(this.Eb,c)},ga.prototype.F=function(){return this.Db},ga.prototype.fa=function(){return!1},ga.prototype.next=function(){return Error("No such element")},ga.prototype.remove=function(){return Error("Unsupported operation")},ga.Nb=function(){return new Zc(null,2,5,$c,[oc(ad,new ra(null,1,[bd,Gc(cd,Gc(hc))],null)),dd],null)},ga.ob=!0,ga.$a="cljs.core/t_cljs$core23983",
ga.Bb=function(a){return G(a,"cljs.core/t_cljs$core23983")});return new ga(Yc,ed)};function fd(b,a){for(;;){if(null==J(a))return!0;var c;c=L(a);c=b.b?b.b(c):b.call(null,c);if(x(c)){c=b;var d=M(a);b=c;a=d}else return!1}}function gd(b,a){this.state=b;this.l=a;this.v=16386;this.i=6455296}gd.prototype.equiv=function(b){return this.o(null,b)};gd.prototype.o=function(b,a){return this===a};gd.prototype.F=function(){return this.l};gd.prototype.C=function(){return this[aa]||(this[aa]=++ba)};
function hd(b){for(var a=[],c=arguments.length,d=0;;)if(d<c)a.push(arguments[d]),d+=1;else break;switch(a.length){case 1:return id(arguments[0]);default:return c=arguments[0],a=new K(a.slice(1),0,null),a=null!=a&&(a.i&64||a.Qa)?Wc(jd,a):a,d=H.a(a,va),H.a(a,kd),new gd(c,d)}}function id(b){return new gd(b,null)}
var V=function V(a){for(var c=[],d=arguments.length,e=0;;)if(e<d)c.push(arguments[e]),e+=1;else break;switch(c.length){case 1:return V.b(arguments[0]);case 2:return V.a(arguments[0],arguments[1]);case 3:return V.g(arguments[0],arguments[1],arguments[2]);case 4:return V.$(arguments[0],arguments[1],arguments[2],arguments[3]);default:return V.A(arguments[0],arguments[1],arguments[2],arguments[3],new K(c.slice(4),0,null))}};
V.b=function(b){return function(a){return function(){function c(c,d){var e=b.b?b.b(d):b.call(null,d);return a.a?a.a(c,e):a.call(null,c,e)}function d(b){return a.b?a.b(b):a.call(null,b)}function e(){return a.B?a.B():a.call(null)}var g=null,h=function(){function c(a,b,e){var g=null;if(2<arguments.length){for(var g=0,h=Array(arguments.length-2);g<h.length;)h[g]=arguments[g+2],++g;g=new K(h,0)}return d.call(this,a,b,g)}function d(c,e,g){e=Xc(b,e,g);return a.a?a.a(c,e):a.call(null,c,e)}c.M=2;c.J=function(a){var b=
L(a);a=M(a);var c=L(a);a=Lb(a);return d(b,c,a)};c.A=d;return c}(),g=function(a,b,g){switch(arguments.length){case 0:return e.call(this);case 1:return d.call(this,a);case 2:return c.call(this,a,b);default:var n=null;if(2<arguments.length){for(var n=0,p=Array(arguments.length-2);n<p.length;)p[n]=arguments[n+2],++n;n=new K(p,0)}return h.A(a,b,n)}throw Error("Invalid arity: "+arguments.length);};g.M=2;g.J=h.J;g.B=e;g.b=d;g.a=c;g.A=h.A;return g}()}};
V.a=function(b,a){return new Kc(null,function(){var c=J(a);if(c){if(tc(c)){for(var d=tb(c),e=R(d),g=new Mc(Array(e),0),h=0;;)if(h<e)Qc(g,function(){var a=D.a(d,h);return b.b?b.b(a):b.call(null,a)}()),h+=1;else break;return Pc(g.ma(),V.a(b,ub(c)))}return T(function(){var a=L(c);return b.b?b.b(a):b.call(null,a)}(),V.a(b,Lb(c)))}return null},null,null)};
V.g=function(b,a,c){return new Kc(null,function(){var d=J(a),e=J(c);if(d&&e){var g=T,h;h=L(d);var k=L(e);h=b.a?b.a(h,k):b.call(null,h,k);d=g(h,V.g(b,Lb(d),Lb(e)))}else d=null;return d},null,null)};V.$=function(b,a,c,d){return new Kc(null,function(){var e=J(a),g=J(c),h=J(d);if(e&&g&&h){var k=T,l;l=L(e);var m=L(g),n=L(h);l=b.g?b.g(l,m,n):b.call(null,l,m,n);e=k(l,V.$(b,Lb(e),Lb(g),Lb(h)))}else e=null;return e},null,null)};
V.A=function(b,a,c,d,e){var g=function k(a){return new Kc(null,function(){var b=V.a(J,a);return fd(Bc,b)?T(V.a(L,b),k(V.a(Lb,b))):null},null,null)};return V.a(function(){return function(a){return Wc(b,a)}}(g),g(gc.A(e,d,fc([c,a],0))))};V.J=function(b){var a=L(b),c=M(b);b=L(c);var d=M(c),c=L(d),e=M(d),d=L(e),e=M(e);return V.A(a,b,c,d,e)};V.M=4;function ld(b,a){this.w=b;this.c=a}
function md(b){return new ld(b,[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null])}function nd(b){b=b.h;return 32>b?0:b-1>>>5<<5}function od(b,a,c){for(;;){if(0===a)return c;var d=md(b);d.c[0]=c;c=d;a-=5}}var pd=function pd(a,c,d,e){var g=new ld(d.w,Ca(d.c)),h=a.h-1>>>c&31;5===c?g.c[h]=e:(d=d.c[h],a=null!=d?pd(a,c-5,d,e):od(null,c-5,e),g.c[h]=a);return g};
function qd(b,a){throw Error([B("No item "),B(b),B(" in vector of length "),B(a)].join(""));}function rd(b,a){if(a>=nd(b))return b.V;for(var c=b.root,d=b.shift;;)if(0<d)var e=d-5,c=c.c[a>>>d&31],d=e;else return c.c}function sd(b,a){return 0<=a&&a<b.h?rd(b,a):qd(a,b.h)}var td=function td(a,c,d,e,g){var h=new ld(d.w,Ca(d.c));if(0===c)h.c[e&31]=g;else{var k=e>>>c&31;a=td(a,c-5,d.c[k],e,g);h.c[k]=a}return h};function ud(b,a,c,d,e,g){this.j=b;this.ab=a;this.c=c;this.ka=d;this.start=e;this.end=g}
ud.prototype.fa=function(){return this.j<this.end};ud.prototype.next=function(){32===this.j-this.ab&&(this.c=rd(this.ka,this.j),this.ab+=32);var b=this.c[this.j&31];this.j+=1;return b};function Zc(b,a,c,d,e,g){this.l=b;this.h=a;this.shift=c;this.root=d;this.V=e;this.m=g;this.i=167668511;this.v=8196}f=Zc.prototype;f.toString=function(){return yb(this)};f.equiv=function(b){return this.o(null,b)};
f.indexOf=function(){var b=null,b=function(a,b){switch(arguments.length){case 1:return Q(this,a,0);case 2:return Q(this,a,b)}throw Error("Invalid arity: "+arguments.length);};b.b=function(a){return Q(this,a,0)};b.a=function(a,b){return Q(this,a,b)};return b}();
f.lastIndexOf=function(){function b(a){return S(this,a,R(this))}var a=null,a=function(a,d){switch(arguments.length){case 1:return b.call(this,a);case 2:return S(this,a,d)}throw Error("Invalid arity: "+arguments.length);};a.b=b;a.a=function(a,b){return S(this,a,b)};return a}();f.O=function(b,a){return Ra.g(this,a,null)};f.D=function(b,a,c){return"number"===typeof a?D.g(this,a,c):c};f.L=function(b,a){return sd(this,a)[a&31]};f.ea=function(b,a,c){return 0<=a&&a<this.h?rd(this,a)[a&31]:c};
f.ib=function(b,a,c){if(0<=a&&a<this.h)return nd(this)<=a?(b=Ca(this.V),b[a&31]=c,new Zc(this.l,this.h,this.shift,this.root,b,null)):new Zc(this.l,this.h,this.shift,td(this,this.shift,this.root,a,c),this.V,null);if(a===this.h)return Na(this,c);throw Error([B("Index "),B(a),B(" out of bounds  [0,"),B(this.h),B("]")].join(""));};f.Da=function(){var b=this.h;return new ud(0,0,0<R(this)?rd(this,0):null,this,0,b)};f.F=function(){return this.l};f.W=function(){return this.h};
f.gb=function(){return D.a(this,0)};f.hb=function(){return D.a(this,1)};f.C=function(){var b=this.m;return null!=b?b:this.m=b=Pb(this)};f.o=function(b,a){if(a instanceof Zc)if(this.h===R(a))for(var c=wb(this),d=wb(a);;)if(x(c.fa())){var e=c.next(),g=d.next();if(!N.a(e,g))return!1}else return!0;else return!1;else return dc(this,a)};f.Va=function(){return new vd(this.h,this.shift,wd.b?wd.b(this.root):wd.call(null,this.root),xd.b?xd.b(this.V):xd.call(null,this.V))};f.S=function(b,a){return Tb(this,a)};
f.T=function(b,a,c){b=0;for(var d=c;;)if(b<this.h){var e=rd(this,b);c=e.length;a:for(var g=0;;)if(g<c)var h=e[g],d=a.a?a.a(d,h):a.call(null,d,h),g=g+1;else{e=d;break a}b+=c;d=e}else return d};f.Pa=function(b,a,c){if("number"===typeof a)return Za(this,a,c);throw Error("Vector's key for assoc must be a number.");};
f.P=function(){if(0===this.h)return null;if(32>=this.h)return new K(this.V,0,null);var b;a:{b=this.root;for(var a=this.shift;;)if(0<a)a-=5,b=b.c[0];else{b=b.c;break a}}return yd?yd(this,b,0,0):zd.call(null,this,b,0,0)};f.I=function(b,a){return new Zc(a,this.h,this.shift,this.root,this.V,this.m)};
f.N=function(b,a){if(32>this.h-nd(this)){for(var c=this.V.length,d=Array(c+1),e=0;;)if(e<c)d[e]=this.V[e],e+=1;else break;d[c]=a;return new Zc(this.l,this.h+1,this.shift,this.root,d,null)}c=(d=this.h>>>5>1<<this.shift)?this.shift+5:this.shift;d?(d=md(null),d.c[0]=this.root,e=od(null,this.shift,new ld(null,this.V)),d.c[1]=e):d=pd(this,this.shift,this.root,new ld(null,this.V));return new Zc(this.l,this.h+1,c,d,[a],null)};
f.call=function(){var b=null,b=function(a,b,d){switch(arguments.length){case 2:return this.L(null,b);case 3:return this.ea(null,b,d)}throw Error("Invalid arity: "+arguments.length);};b.a=function(a,b){return this.L(null,b)};b.g=function(a,b,d){return this.ea(null,b,d)};return b}();f.apply=function(b,a){return this.call.apply(this,[this].concat(Ca(a)))};f.b=function(b){return this.L(null,b)};f.a=function(b,a){return this.ea(null,b,a)};
var $c=new ld(null,[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]),hc=new Zc(null,0,5,$c,[],Qb);Zc.prototype[Ba]=function(){return O(this)};function Ad(b,a,c,d,e,g){this.ca=b;this.node=a;this.j=c;this.K=d;this.l=e;this.m=g;this.i=32375020;this.v=1536}f=Ad.prototype;f.toString=function(){return yb(this)};f.equiv=function(b){return this.o(null,b)};
f.indexOf=function(){var b=null,b=function(a,b){switch(arguments.length){case 1:return Q(this,a,0);case 2:return Q(this,a,b)}throw Error("Invalid arity: "+arguments.length);};b.b=function(a){return Q(this,a,0)};b.a=function(a,b){return Q(this,a,b)};return b}();
f.lastIndexOf=function(){function b(a){return S(this,a,R(this))}var a=null,a=function(a,d){switch(arguments.length){case 1:return b.call(this,a);case 2:return S(this,a,d)}throw Error("Invalid arity: "+arguments.length);};a.b=b;a.a=function(a,b){return S(this,a,b)};return a}();f.F=function(){return this.l};f.Y=function(){if(this.K+1<this.node.length){var b;b=this.ca;var a=this.node,c=this.j,d=this.K+1;b=yd?yd(b,a,c,d):zd.call(null,b,a,c,d);return null==b?null:b}return vb(this)};
f.C=function(){var b=this.m;return null!=b?b:this.m=b=Pb(this)};f.o=function(b,a){return dc(this,a)};f.S=function(b,a){var c;c=this.ca;var d=this.j+this.K,e=R(this.ca);c=Bd?Bd(c,d,e):Cd.call(null,c,d,e);return Tb(c,a)};f.T=function(b,a,c){b=this.ca;var d=this.j+this.K,e=R(this.ca);b=Bd?Bd(b,d,e):Cd.call(null,b,d,e);return Ub(b,a,c)};f.U=function(){return this.node[this.K]};
f.aa=function(){if(this.K+1<this.node.length){var b;b=this.ca;var a=this.node,c=this.j,d=this.K+1;b=yd?yd(b,a,c,d):zd.call(null,b,a,c,d);return null==b?Mb:b}return ub(this)};f.P=function(){return this};f.eb=function(){var b=this.node;return new Nc(b,this.K,b.length)};f.fb=function(){var b=this.j+this.node.length;if(b<Ka(this.ca)){var a=this.ca,c=rd(this.ca,b);return yd?yd(a,c,b,0):zd.call(null,a,c,b,0)}return Mb};
f.I=function(b,a){return Dd?Dd(this.ca,this.node,this.j,this.K,a):zd.call(null,this.ca,this.node,this.j,this.K,a)};f.N=function(b,a){return T(a,this)};f.cb=function(){var b=this.j+this.node.length;if(b<Ka(this.ca)){var a=this.ca,c=rd(this.ca,b);return yd?yd(a,c,b,0):zd.call(null,a,c,b,0)}return null};Ad.prototype[Ba]=function(){return O(this)};
function zd(b){for(var a=[],c=arguments.length,d=0;;)if(d<c)a.push(arguments[d]),d+=1;else break;switch(a.length){case 3:return a=arguments[0],c=arguments[1],d=arguments[2],new Ad(a,sd(a,c),c,d,null,null);case 4:return yd(arguments[0],arguments[1],arguments[2],arguments[3]);case 5:return Dd(arguments[0],arguments[1],arguments[2],arguments[3],arguments[4]);default:throw Error([B("Invalid arity: "),B(a.length)].join(""));}}function yd(b,a,c,d){return new Ad(b,a,c,d,null,null)}
function Dd(b,a,c,d,e){return new Ad(b,a,c,d,e,null)}function Ed(b,a,c,d,e){this.l=b;this.ka=a;this.start=c;this.end=d;this.m=e;this.i=167666463;this.v=8192}f=Ed.prototype;f.toString=function(){return yb(this)};f.equiv=function(b){return this.o(null,b)};
f.indexOf=function(){var b=null,b=function(a,b){switch(arguments.length){case 1:return Q(this,a,0);case 2:return Q(this,a,b)}throw Error("Invalid arity: "+arguments.length);};b.b=function(a){return Q(this,a,0)};b.a=function(a,b){return Q(this,a,b)};return b}();
f.lastIndexOf=function(){function b(a){return S(this,a,R(this))}var a=null,a=function(a,d){switch(arguments.length){case 1:return b.call(this,a);case 2:return S(this,a,d)}throw Error("Invalid arity: "+arguments.length);};a.b=b;a.a=function(a,b){return S(this,a,b)};return a}();f.O=function(b,a){return Ra.g(this,a,null)};f.D=function(b,a,c){return"number"===typeof a?D.g(this,a,c):c};f.L=function(b,a){return 0>a||this.end<=this.start+a?qd(a,this.end-this.start):D.a(this.ka,this.start+a)};
f.ea=function(b,a,c){return 0>a||this.end<=this.start+a?c:D.g(this.ka,this.start+a,c)};f.ib=function(b,a,c){var d=this.start+a;b=this.l;c=kc.g(this.ka,d,c);a=this.start;var e=this.end,d=d+1,d=e>d?e:d;return Fd.X?Fd.X(b,c,a,d,null):Fd.call(null,b,c,a,d,null)};f.F=function(){return this.l};f.W=function(){return this.end-this.start};f.C=function(){var b=this.m;return null!=b?b:this.m=b=Pb(this)};f.o=function(b,a){return dc(this,a)};f.S=function(b,a){return Tb(this,a)};
f.T=function(b,a,c){return Ub(this,a,c)};f.Pa=function(b,a,c){if("number"===typeof a)return Za(this,a,c);throw Error("Subvec's key for assoc must be a number.");};f.P=function(){var b=this;return function(a){return function d(e){return e===b.end?null:T(D.a(b.ka,e),new Kc(null,function(){return function(){return d(e+1)}}(a),null,null))}}(this)(b.start)};f.I=function(b,a){return Fd.X?Fd.X(a,this.ka,this.start,this.end,this.m):Fd.call(null,a,this.ka,this.start,this.end,this.m)};
f.N=function(b,a){var c=this.l,d=Za(this.ka,this.end,a),e=this.start,g=this.end+1;return Fd.X?Fd.X(c,d,e,g,null):Fd.call(null,c,d,e,g,null)};f.call=function(){var b=null,b=function(a,b,d){switch(arguments.length){case 2:return this.L(null,b);case 3:return this.ea(null,b,d)}throw Error("Invalid arity: "+arguments.length);};b.a=function(a,b){return this.L(null,b)};b.g=function(a,b,d){return this.ea(null,b,d)};return b}();f.apply=function(b,a){return this.call.apply(this,[this].concat(Ca(a)))};
f.b=function(b){return this.L(null,b)};f.a=function(b,a){return this.ea(null,b,a)};Ed.prototype[Ba]=function(){return O(this)};function Fd(b,a,c,d,e){for(;;)if(a instanceof Ed)c=a.start+c,d=a.start+d,a=a.ka;else{var g=R(a);if(0>c||0>d||c>g||d>g)throw Error("Index out of bounds");return new Ed(b,a,c,d,e)}}
function Cd(b){for(var a=[],c=arguments.length,d=0;;)if(d<c)a.push(arguments[d]),d+=1;else break;switch(a.length){case 2:return a=arguments[0],Bd(a,arguments[1],R(a));case 3:return Bd(arguments[0],arguments[1],arguments[2]);default:throw Error([B("Invalid arity: "),B(a.length)].join(""));}}function Bd(b,a,c){return Fd(null,b,a,c,null)}function Gd(b,a){return b===a.w?a:new ld(b,Ca(a.c))}function wd(b){return new ld({},Ca(b.c))}
function xd(b){var a=[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null];wc(b,0,a,0,b.length);return a}var Hd=function Hd(a,c,d,e){d=Gd(a.root.w,d);var g=a.h-1>>>c&31;if(5===c)a=e;else{var h=d.c[g];a=null!=h?Hd(a,c-5,h,e):od(a.root.w,c-5,e)}d.c[g]=a;return d};function vd(b,a,c,d){this.h=b;this.shift=a;this.root=c;this.V=d;this.v=88;this.i=275}f=vd.prototype;
f.Ya=function(b,a){if(this.root.w){if(32>this.h-nd(this))this.V[this.h&31]=a;else{var c=new ld(this.root.w,this.V),d=[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null];d[0]=a;this.V=d;if(this.h>>>5>1<<this.shift){var d=[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],e=this.shift+
5;d[0]=this.root;d[1]=od(this.root.w,this.shift,c);this.root=new ld(this.root.w,d);this.shift=e}else this.root=Hd(this,this.shift,this.root,c)}this.h+=1;return this}throw Error("conj! after persistent!");};f.Za=function(){if(this.root.w){this.root.w=null;var b=this.h-nd(this),a=Array(b);wc(this.V,0,a,0,b);return new Zc(null,this.h,this.shift,this.root,a,null)}throw Error("persistent! called twice");};
f.Ra=function(b,a,c){if("number"===typeof a)return rb(this,a,c);throw Error("TransientVector's key for assoc! must be a number.");};
f.mb=function(b,a,c){var d=this;if(d.root.w){if(0<=a&&a<d.h)return nd(this)<=a?d.V[a&31]=c:(b=function(){return function g(b,k){var l=Gd(d.root.w,k);if(0===b)l.c[a&31]=c;else{var m=a>>>b&31,n=g(b-5,l.c[m]);l.c[m]=n}return l}}(this).call(null,d.shift,d.root),d.root=b),this;if(a===d.h)return nb(this,c);throw Error([B("Index "),B(a),B(" out of bounds for TransientVector of length"),B(d.h)].join(""));}throw Error("assoc! after persistent!");};
f.W=function(){if(this.root.w)return this.h;throw Error("count after persistent!");};f.L=function(b,a){if(this.root.w)return sd(this,a)[a&31];throw Error("nth after persistent!");};f.ea=function(b,a,c){return 0<=a&&a<this.h?D.a(this,a):c};f.O=function(b,a){return Ra.g(this,a,null)};f.D=function(b,a,c){return"number"===typeof a?D.g(this,a,c):c};
f.call=function(){var b=null,b=function(a,b,d){switch(arguments.length){case 2:return this.O(null,b);case 3:return this.D(null,b,d)}throw Error("Invalid arity: "+arguments.length);};b.a=function(a,b){return this.O(null,b)};b.g=function(a,b,d){return this.D(null,b,d)};return b}();f.apply=function(b,a){return this.call.apply(this,[this].concat(Ca(a)))};f.b=function(b){return this.O(null,b)};f.a=function(b,a){return this.D(null,b,a)};function Id(){this.i=2097152;this.v=0}
Id.prototype.equiv=function(b){return this.o(null,b)};Id.prototype.o=function(){return!1};var Jd=new Id;function Kd(b,a){return yc(rc(a)?R(b)===R(a)?fd(Bc,V.a(function(b){return N.a(H.g(a,L(b),Jd),L(M(b)))},b)):null:null)}function Ld(b){this.u=b}Ld.prototype.next=function(){if(null!=this.u){var b=L(this.u),a=jc(b,0,null),b=jc(b,1,null);this.u=M(this.u);return{value:[a,b],done:!1}}return{value:null,done:!0}};
function Md(b,a){var c;if(a instanceof U)a:{c=b.length;for(var d=a.Fa,e=0;;){if(c<=e){c=-1;break a}if(b[e]instanceof U&&d===b[e].Fa){c=e;break a}e+=2}}else if("string"==typeof a||"number"===typeof a)a:for(c=b.length,d=0;;){if(c<=d){c=-1;break a}if(a===b[d]){c=d;break a}d+=2}else if(a instanceof Kb)a:for(c=b.length,d=a.Ha,e=0;;){if(c<=e){c=-1;break a}if(b[e]instanceof Kb&&d===b[e].Ha){c=e;break a}e+=2}else if(null==a)a:for(c=b.length,d=0;;){if(c<=d){c=-1;break a}if(null==b[d]){c=d;break a}d+=2}else a:for(c=
b.length,d=0;;){if(c<=d){c=-1;break a}if(N.a(a,b[d])){c=d;break a}d+=2}return c}function Nd(b,a,c){this.c=b;this.j=a;this.da=c;this.i=32374990;this.v=0}f=Nd.prototype;f.toString=function(){return yb(this)};f.equiv=function(b){return this.o(null,b)};f.indexOf=function(){var b=null,b=function(a,b){switch(arguments.length){case 1:return Q(this,a,0);case 2:return Q(this,a,b)}throw Error("Invalid arity: "+arguments.length);};b.b=function(a){return Q(this,a,0)};b.a=function(a,b){return Q(this,a,b)};return b}();
f.lastIndexOf=function(){function b(a){return S(this,a,R(this))}var a=null,a=function(a,d){switch(arguments.length){case 1:return b.call(this,a);case 2:return S(this,a,d)}throw Error("Invalid arity: "+arguments.length);};a.b=b;a.a=function(a,b){return S(this,a,b)};return a}();f.F=function(){return this.da};f.Y=function(){return this.j<this.c.length-2?new Nd(this.c,this.j+2,this.da):null};f.W=function(){return(this.c.length-this.j)/2};f.C=function(){return Pb(this)};
f.o=function(b,a){return dc(this,a)};f.S=function(b,a){return zc(a,this)};f.T=function(b,a,c){return Ac(a,c,this)};f.U=function(){return new Zc(null,2,5,$c,[this.c[this.j],this.c[this.j+1]],null)};f.aa=function(){return this.j<this.c.length-2?new Nd(this.c,this.j+2,this.da):Mb};f.P=function(){return this};f.I=function(b,a){return new Nd(this.c,this.j,a)};f.N=function(b,a){return T(a,this)};Nd.prototype[Ba]=function(){return O(this)};function Od(b,a,c){this.c=b;this.j=a;this.h=c}
Od.prototype.fa=function(){return this.j<this.h};Od.prototype.next=function(){var b=new Zc(null,2,5,$c,[this.c[this.j],this.c[this.j+1]],null);this.j+=2;return b};function ra(b,a,c,d){this.l=b;this.h=a;this.c=c;this.m=d;this.i=16647951;this.v=8196}f=ra.prototype;f.toString=function(){return yb(this)};f.equiv=function(b){return this.o(null,b)};f.keys=function(){return O(Pd.b?Pd.b(this):Pd.call(null,this))};f.entries=function(){return new Ld(J(J(this)))};
f.values=function(){return O(Qd.b?Qd.b(this):Qd.call(null,this))};f.has=function(b){return H.g(this,b,xc)===xc?!1:!0};f.get=function(b,a){return this.D(null,b,a)};f.forEach=function(b){for(var a=J(this),c=null,d=0,e=0;;)if(e<d){var g=c.L(null,e),h=jc(g,0,null),g=jc(g,1,null);b.a?b.a(g,h):b.call(null,g,h);e+=1}else if(a=J(a))tc(a)?(c=tb(a),a=ub(a),h=c,d=R(c),c=h):(c=L(a),h=jc(c,0,null),g=jc(c,1,null),b.a?b.a(g,h):b.call(null,g,h),a=M(a),c=null,d=0),e=0;else return null};
f.O=function(b,a){return Ra.g(this,a,null)};f.D=function(b,a,c){b=Md(this.c,a);return-1===b?c:this.c[b+1]};f.Da=function(){return new Od(this.c,0,2*this.h)};f.F=function(){return this.l};f.W=function(){return this.h};f.C=function(){var b=this.m;return null!=b?b:this.m=b=Rb(this)};
f.o=function(b,a){if(null!=a&&(a.i&1024||a.vb)){var c=this.c.length;if(this.h===a.W(null))for(var d=0;;)if(d<c){var e=a.D(null,this.c[d],xc);if(e!==xc)if(N.a(this.c[d+1],e))d+=2;else return!1;else return!1}else return!0;else return!1}else return Kd(this,a)};f.Va=function(){return new Rd({},this.c.length,Ca(this.c))};f.S=function(b,a){return zc(a,this)};f.T=function(b,a,c){return Ac(a,c,this)};
f.Pa=function(b,a,c){b=Md(this.c,a);if(-1===b){if(this.h<Sd){b=this.c;for(var d=b.length,e=Array(d+2),g=0;;)if(g<d)e[g]=b[g],g+=1;else break;e[d]=a;e[d+1]=c;return new ra(this.l,this.h+1,e,null)}b=lc;b=null!=b?null!=b&&(b.v&4||b.Ib)?oc(ob(Ha(nb,mb(b),this)),pc(b)):Ha(Na,b,this):Ha(gc,Mb,this);return bb(Ta(b,a,c),this.l)}if(c===this.c[b+1])return this;a=Ca(this.c);a[b+1]=c;return new ra(this.l,this.h,a,null)};f.P=function(){var b=this.c;return 0<=b.length-2?new Nd(b,0,null):null};
f.I=function(b,a){return new ra(a,this.h,this.c,this.m)};f.N=function(b,a){if(sc(a))return Ta(this,D.a(a,0),D.a(a,1));for(var c=this,d=J(a);;){if(null==d)return c;var e=L(d);if(sc(e))c=Ta(c,D.a(e,0),D.a(e,1)),d=M(d);else throw Error("conj on a map takes map entries or seqables of map entries");}};
f.call=function(){var b=null,b=function(a,b,d){switch(arguments.length){case 2:return this.O(null,b);case 3:return this.D(null,b,d)}throw Error("Invalid arity: "+arguments.length);};b.a=function(a,b){return this.O(null,b)};b.g=function(a,b,d){return this.D(null,b,d)};return b}();f.apply=function(b,a){return this.call.apply(this,[this].concat(Ca(a)))};f.b=function(b){return this.O(null,b)};f.a=function(b,a){return this.D(null,b,a)};var ed=new ra(null,0,[],Sb),Sd=8;ra.prototype[Ba]=function(){return O(this)};
function Rd(b,a,c){this.Na=b;this.La=a;this.c=c;this.i=258;this.v=56}f=Rd.prototype;f.W=function(){if(x(this.Na))return Cc(this.La);throw Error("count after persistent!");};f.O=function(b,a){return Ra.g(this,a,null)};f.D=function(b,a,c){if(x(this.Na))return b=Md(this.c,a),-1===b?c:this.c[b+1];throw Error("lookup after persistent!");};
f.Ya=function(b,a){if(x(this.Na)){if(null!=a?a.i&2048||a.wb||(a.i?0:y(Va,a)):y(Va,a))return qb(this,Td.b?Td.b(a):Td.call(null,a),Vd.b?Vd.b(a):Vd.call(null,a));for(var c=J(a),d=this;;){var e=L(c);if(x(e))c=M(c),d=qb(d,Td.b?Td.b(e):Td.call(null,e),Vd.b?Vd.b(e):Vd.call(null,e));else return d}}else throw Error("conj! after persistent!");};f.Za=function(){if(x(this.Na))return this.Na=!1,new ra(null,Cc(this.La),this.c,null);throw Error("persistent! called twice");};
f.Ra=function(b,a,c){if(x(this.Na)){b=Md(this.c,a);if(-1===b){if(this.La+2<=2*Sd)return this.La+=2,this.c.push(a),this.c.push(c),this;b=Wd.a?Wd.a(this.La,this.c):Wd.call(null,this.La,this.c);return qb(b,a,c)}c!==this.c[b+1]&&(this.c[b+1]=c);return this}throw Error("assoc! after persistent!");};function Wd(b,a){for(var c=mb(lc),d=0;;)if(d<b)c=qb(c,a[d],a[d+1]),d+=2;else return c}function Xd(){this.la=!1}
function Yd(b,a){return b===a?!0:b===a||b instanceof U&&a instanceof U&&b.Fa===a.Fa?!0:N.a(b,a)}function Zd(b,a,c){b=Ca(b);b[a]=c;return b}function $d(b,a,c,d){b=b.Ja(a);b.c[c]=d;return b}function ae(b,a,c,d){this.c=b;this.j=a;this.Ta=c;this.ia=d}ae.prototype.advance=function(){for(var b=this.c.length;;)if(this.j<b){var a=this.c[this.j],c=this.c[this.j+1];null!=a?a=this.Ta=new Zc(null,2,5,$c,[a,c],null):null!=c?(a=wb(c),a=a.fa()?this.ia=a:!1):a=!1;this.j+=2;if(a)return!0}else return!1};
ae.prototype.fa=function(){var b=null!=this.Ta;return b?b:(b=null!=this.ia)?b:this.advance()};ae.prototype.next=function(){if(null!=this.Ta){var b=this.Ta;this.Ta=null;return b}if(null!=this.ia)return b=this.ia.next(),this.ia.fa()||(this.ia=null),b;if(this.advance())return this.next();throw Error("No such element");};ae.prototype.remove=function(){return Error("Unsupported operation")};function be(b,a,c){this.w=b;this.G=a;this.c=c}f=be.prototype;
f.Ja=function(b){if(b===this.w)return this;var a=Dc(this.G),c=Array(0>a?4:2*(a+1));wc(this.c,0,c,0,2*a);return new be(b,this.G,c)};f.Sa=function(){return ce?ce(this.c):de.call(null,this.c)};f.Ka=function(b,a,c,d){var e=1<<(a>>>b&31);if(0===(this.G&e))return d;var g=Dc(this.G&e-1),e=this.c[2*g],g=this.c[2*g+1];return null==e?g.Ka(b+5,a,c,d):Yd(c,e)?g:d};
f.ha=function(b,a,c,d,e,g){var h=1<<(c>>>a&31),k=Dc(this.G&h-1);if(0===(this.G&h)){var l=Dc(this.G);if(2*l<this.c.length){b=this.Ja(b);a=b.c;g.la=!0;a:for(c=2*(l-k),g=2*k+(c-1),l=2*(k+1)+(c-1);;){if(0===c)break a;a[l]=a[g];--l;--c;--g}a[2*k]=d;a[2*k+1]=e;b.G|=h;return b}if(16<=l){k=[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null];k[c>>>a&31]=ee.ha(b,a+5,c,d,e,g);for(e=d=0;;)if(32>d)0!==
(this.G>>>d&1)&&(k[d]=null!=this.c[e]?ee.ha(b,a+5,Ib(this.c[e]),this.c[e],this.c[e+1],g):this.c[e+1],e+=2),d+=1;else break;return new fe(b,l+1,k)}a=Array(2*(l+4));wc(this.c,0,a,0,2*k);a[2*k]=d;a[2*k+1]=e;wc(this.c,2*k,a,2*(k+1),2*(l-k));g.la=!0;b=this.Ja(b);b.c=a;b.G|=h;return b}l=this.c[2*k];h=this.c[2*k+1];if(null==l)return l=h.ha(b,a+5,c,d,e,g),l===h?this:$d(this,b,2*k+1,l);if(Yd(d,l))return e===h?this:$d(this,b,2*k+1,e);g.la=!0;g=a+5;d=ge?ge(b,g,l,h,c,d,e):he.call(null,b,g,l,h,c,d,e);e=2*k;k=
2*k+1;b=this.Ja(b);b.c[e]=null;b.c[k]=d;return b};
f.ga=function(b,a,c,d,e){var g=1<<(a>>>b&31),h=Dc(this.G&g-1);if(0===(this.G&g)){var k=Dc(this.G);if(16<=k){h=[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null];h[a>>>b&31]=ee.ga(b+5,a,c,d,e);for(d=c=0;;)if(32>c)0!==(this.G>>>c&1)&&(h[c]=null!=this.c[d]?ee.ga(b+5,Ib(this.c[d]),this.c[d],this.c[d+1],e):this.c[d+1],d+=2),c+=1;else break;return new fe(null,k+1,h)}b=Array(2*(k+1));wc(this.c,
0,b,0,2*h);b[2*h]=c;b[2*h+1]=d;wc(this.c,2*h,b,2*(h+1),2*(k-h));e.la=!0;return new be(null,this.G|g,b)}var l=this.c[2*h],g=this.c[2*h+1];if(null==l)return k=g.ga(b+5,a,c,d,e),k===g?this:new be(null,this.G,Zd(this.c,2*h+1,k));if(Yd(c,l))return d===g?this:new be(null,this.G,Zd(this.c,2*h+1,d));e.la=!0;e=this.G;k=this.c;b+=5;b=ie?ie(b,l,g,a,c,d):he.call(null,b,l,g,a,c,d);c=2*h;h=2*h+1;d=Ca(k);d[c]=null;d[h]=b;return new be(null,e,d)};f.Da=function(){return new ae(this.c,0,null,null)};
var ee=new be(null,0,[]);function je(b,a,c){this.c=b;this.j=a;this.ia=c}je.prototype.fa=function(){for(var b=this.c.length;;){if(null!=this.ia&&this.ia.fa())return!0;if(this.j<b){var a=this.c[this.j];this.j+=1;null!=a&&(this.ia=wb(a))}else return!1}};je.prototype.next=function(){if(this.fa())return this.ia.next();throw Error("No such element");};je.prototype.remove=function(){return Error("Unsupported operation")};function fe(b,a,c){this.w=b;this.h=a;this.c=c}f=fe.prototype;
f.Ja=function(b){return b===this.w?this:new fe(b,this.h,Ca(this.c))};f.Sa=function(){return ke?ke(this.c):le.call(null,this.c)};f.Ka=function(b,a,c,d){var e=this.c[a>>>b&31];return null!=e?e.Ka(b+5,a,c,d):d};f.ha=function(b,a,c,d,e,g){var h=c>>>a&31,k=this.c[h];if(null==k)return b=$d(this,b,h,ee.ha(b,a+5,c,d,e,g)),b.h+=1,b;a=k.ha(b,a+5,c,d,e,g);return a===k?this:$d(this,b,h,a)};
f.ga=function(b,a,c,d,e){var g=a>>>b&31,h=this.c[g];if(null==h)return new fe(null,this.h+1,Zd(this.c,g,ee.ga(b+5,a,c,d,e)));b=h.ga(b+5,a,c,d,e);return b===h?this:new fe(null,this.h,Zd(this.c,g,b))};f.Da=function(){return new je(this.c,0,null)};function me(b,a,c){a*=2;for(var d=0;;)if(d<a){if(Yd(c,b[d]))return d;d+=2}else return-1}function ne(b,a,c,d){this.w=b;this.Ea=a;this.h=c;this.c=d}f=ne.prototype;
f.Ja=function(b){if(b===this.w)return this;var a=Array(2*(this.h+1));wc(this.c,0,a,0,2*this.h);return new ne(b,this.Ea,this.h,a)};f.Sa=function(){return ce?ce(this.c):de.call(null,this.c)};f.Ka=function(b,a,c,d){b=me(this.c,this.h,c);return 0>b?d:Yd(c,this.c[b])?this.c[b+1]:d};
f.ha=function(b,a,c,d,e,g){if(c===this.Ea){a=me(this.c,this.h,d);if(-1===a){if(this.c.length>2*this.h)return a=2*this.h,c=2*this.h+1,b=this.Ja(b),b.c[a]=d,b.c[c]=e,g.la=!0,b.h+=1,b;c=this.c.length;a=Array(c+2);wc(this.c,0,a,0,c);a[c]=d;a[c+1]=e;g.la=!0;d=this.h+1;b===this.w?(this.c=a,this.h=d,b=this):b=new ne(this.w,this.Ea,d,a);return b}return this.c[a+1]===e?this:$d(this,b,a+1,e)}return(new be(b,1<<(this.Ea>>>a&31),[null,this,null,null])).ha(b,a,c,d,e,g)};
f.ga=function(b,a,c,d,e){return a===this.Ea?(b=me(this.c,this.h,c),-1===b?(b=2*this.h,a=Array(b+2),wc(this.c,0,a,0,b),a[b]=c,a[b+1]=d,e.la=!0,new ne(null,this.Ea,this.h+1,a)):N.a(this.c[b],d)?this:new ne(null,this.Ea,this.h,Zd(this.c,b+1,d))):(new be(null,1<<(this.Ea>>>b&31),[null,this])).ga(b,a,c,d,e)};f.Da=function(){return new ae(this.c,0,null,null)};
function he(b){for(var a=[],c=arguments.length,d=0;;)if(d<c)a.push(arguments[d]),d+=1;else break;switch(a.length){case 6:return ie(arguments[0],arguments[1],arguments[2],arguments[3],arguments[4],arguments[5]);case 7:return ge(arguments[0],arguments[1],arguments[2],arguments[3],arguments[4],arguments[5],arguments[6]);default:throw Error([B("Invalid arity: "),B(a.length)].join(""));}}
function ie(b,a,c,d,e,g){var h=Ib(a);if(h===d)return new ne(null,h,2,[a,c,e,g]);var k=new Xd;return ee.ga(b,h,a,c,k).ga(b,d,e,g,k)}function ge(b,a,c,d,e,g,h){var k=Ib(c);if(k===e)return new ne(null,k,2,[c,d,g,h]);var l=new Xd;return ee.ha(b,a,k,c,d,l).ha(b,a,e,g,h,l)}function oe(b,a,c,d,e){this.l=b;this.Ga=a;this.j=c;this.u=d;this.m=e;this.i=32374860;this.v=0}f=oe.prototype;f.toString=function(){return yb(this)};f.equiv=function(b){return this.o(null,b)};
f.indexOf=function(){var b=null,b=function(a,b){switch(arguments.length){case 1:return Q(this,a,0);case 2:return Q(this,a,b)}throw Error("Invalid arity: "+arguments.length);};b.b=function(a){return Q(this,a,0)};b.a=function(a,b){return Q(this,a,b)};return b}();
f.lastIndexOf=function(){function b(a){return S(this,a,R(this))}var a=null,a=function(a,d){switch(arguments.length){case 1:return b.call(this,a);case 2:return S(this,a,d)}throw Error("Invalid arity: "+arguments.length);};a.b=b;a.a=function(a,b){return S(this,a,b)};return a}();f.F=function(){return this.l};f.C=function(){var b=this.m;return null!=b?b:this.m=b=Pb(this)};f.o=function(b,a){return dc(this,a)};f.S=function(b,a){return zc(a,this)};f.T=function(b,a,c){return Ac(a,c,this)};
f.U=function(){return null==this.u?new Zc(null,2,5,$c,[this.Ga[this.j],this.Ga[this.j+1]],null):L(this.u)};f.aa=function(){if(null==this.u){var b=this.Ga,a=this.j+2;return pe?pe(b,a,null):de.call(null,b,a,null)}var b=this.Ga,a=this.j,c=M(this.u);return pe?pe(b,a,c):de.call(null,b,a,c)};f.P=function(){return this};f.I=function(b,a){return new oe(a,this.Ga,this.j,this.u,this.m)};f.N=function(b,a){return T(a,this)};oe.prototype[Ba]=function(){return O(this)};
function de(b){for(var a=[],c=arguments.length,d=0;;)if(d<c)a.push(arguments[d]),d+=1;else break;switch(a.length){case 1:return ce(arguments[0]);case 3:return pe(arguments[0],arguments[1],arguments[2]);default:throw Error([B("Invalid arity: "),B(a.length)].join(""));}}function ce(b){return pe(b,0,null)}
function pe(b,a,c){if(null==c)for(c=b.length;;)if(a<c){if(null!=b[a])return new oe(null,b,a,null,null);var d=b[a+1];if(x(d)&&(d=d.Sa(),x(d)))return new oe(null,b,a+2,d,null);a+=2}else return null;else return new oe(null,b,a,c,null)}function qe(b,a,c,d,e){this.l=b;this.Ga=a;this.j=c;this.u=d;this.m=e;this.i=32374860;this.v=0}f=qe.prototype;f.toString=function(){return yb(this)};f.equiv=function(b){return this.o(null,b)};
f.indexOf=function(){var b=null,b=function(a,b){switch(arguments.length){case 1:return Q(this,a,0);case 2:return Q(this,a,b)}throw Error("Invalid arity: "+arguments.length);};b.b=function(a){return Q(this,a,0)};b.a=function(a,b){return Q(this,a,b)};return b}();
f.lastIndexOf=function(){function b(a){return S(this,a,R(this))}var a=null,a=function(a,d){switch(arguments.length){case 1:return b.call(this,a);case 2:return S(this,a,d)}throw Error("Invalid arity: "+arguments.length);};a.b=b;a.a=function(a,b){return S(this,a,b)};return a}();f.F=function(){return this.l};f.C=function(){var b=this.m;return null!=b?b:this.m=b=Pb(this)};f.o=function(b,a){return dc(this,a)};f.S=function(b,a){return zc(a,this)};f.T=function(b,a,c){return Ac(a,c,this)};f.U=function(){return L(this.u)};
f.aa=function(){var b=this.Ga,a=this.j,c=M(this.u);return re?re(null,b,a,c):le.call(null,null,b,a,c)};f.P=function(){return this};f.I=function(b,a){return new qe(a,this.Ga,this.j,this.u,this.m)};f.N=function(b,a){return T(a,this)};qe.prototype[Ba]=function(){return O(this)};
function le(b){for(var a=[],c=arguments.length,d=0;;)if(d<c)a.push(arguments[d]),d+=1;else break;switch(a.length){case 1:return ke(arguments[0]);case 4:return re(arguments[0],arguments[1],arguments[2],arguments[3]);default:throw Error([B("Invalid arity: "),B(a.length)].join(""));}}function ke(b){return re(null,b,0,null)}function re(b,a,c,d){if(null==d)for(d=a.length;;)if(c<d){var e=a[c];if(x(e)&&(e=e.Sa(),x(e)))return new qe(b,a,c+1,e,null);c+=1}else return null;else return new qe(b,a,c,d,null)}
function se(b,a,c){this.Z=b;this.pb=a;this.jb=c}se.prototype.fa=function(){return this.jb&&this.pb.fa()};se.prototype.next=function(){if(this.jb)return this.pb.next();this.jb=!0;return this.Z};se.prototype.remove=function(){return Error("Unsupported operation")};function te(b,a,c,d,e,g){this.l=b;this.h=a;this.root=c;this.ba=d;this.Z=e;this.m=g;this.i=16123663;this.v=8196}f=te.prototype;f.toString=function(){return yb(this)};f.equiv=function(b){return this.o(null,b)};
f.keys=function(){return O(Pd.b?Pd.b(this):Pd.call(null,this))};f.entries=function(){return new Ld(J(J(this)))};f.values=function(){return O(Qd.b?Qd.b(this):Qd.call(null,this))};f.has=function(b){return H.g(this,b,xc)===xc?!1:!0};f.get=function(b,a){return this.D(null,b,a)};
f.forEach=function(b){for(var a=J(this),c=null,d=0,e=0;;)if(e<d){var g=c.L(null,e),h=jc(g,0,null),g=jc(g,1,null);b.a?b.a(g,h):b.call(null,g,h);e+=1}else if(a=J(a))tc(a)?(c=tb(a),a=ub(a),h=c,d=R(c),c=h):(c=L(a),h=jc(c,0,null),g=jc(c,1,null),b.a?b.a(g,h):b.call(null,g,h),a=M(a),c=null,d=0),e=0;else return null};f.O=function(b,a){return Ra.g(this,a,null)};f.D=function(b,a,c){return null==a?this.ba?this.Z:c:null==this.root?c:this.root.Ka(0,Ib(a),a,c)};
f.Da=function(){var b=this.root?wb(this.root):Yc;return this.ba?new se(this.Z,b,!1):b};f.F=function(){return this.l};f.W=function(){return this.h};f.C=function(){var b=this.m;return null!=b?b:this.m=b=Rb(this)};f.o=function(b,a){return Kd(this,a)};f.Va=function(){return new ue({},this.root,this.h,this.ba,this.Z)};
f.Pa=function(b,a,c){if(null==a)return this.ba&&c===this.Z?this:new te(this.l,this.ba?this.h:this.h+1,this.root,!0,c,null);b=new Xd;a=(null==this.root?ee:this.root).ga(0,Ib(a),a,c,b);return a===this.root?this:new te(this.l,b.la?this.h+1:this.h,a,this.ba,this.Z,null)};f.P=function(){if(0<this.h){var b=null!=this.root?this.root.Sa():null;return this.ba?T(new Zc(null,2,5,$c,[null,this.Z],null),b):b}return null};f.I=function(b,a){return new te(a,this.h,this.root,this.ba,this.Z,this.m)};
f.N=function(b,a){if(sc(a))return Ta(this,D.a(a,0),D.a(a,1));for(var c=this,d=J(a);;){if(null==d)return c;var e=L(d);if(sc(e))c=Ta(c,D.a(e,0),D.a(e,1)),d=M(d);else throw Error("conj on a map takes map entries or seqables of map entries");}};
f.call=function(){var b=null,b=function(a,b,d){switch(arguments.length){case 2:return this.O(null,b);case 3:return this.D(null,b,d)}throw Error("Invalid arity: "+arguments.length);};b.a=function(a,b){return this.O(null,b)};b.g=function(a,b,d){return this.D(null,b,d)};return b}();f.apply=function(b,a){return this.call.apply(this,[this].concat(Ca(a)))};f.b=function(b){return this.O(null,b)};f.a=function(b,a){return this.D(null,b,a)};var lc=new te(null,0,null,!1,null,Sb);te.prototype[Ba]=function(){return O(this)};
function ue(b,a,c,d,e){this.w=b;this.root=a;this.count=c;this.ba=d;this.Z=e;this.i=258;this.v=56}function ve(b,a,c){if(b.w){if(null==a)b.Z!==c&&(b.Z=c),b.ba||(b.count+=1,b.ba=!0);else{var d=new Xd;a=(null==b.root?ee:b.root).ha(b.w,0,Ib(a),a,c,d);a!==b.root&&(b.root=a);d.la&&(b.count+=1)}return b}throw Error("assoc! after persistent!");}f=ue.prototype;f.W=function(){if(this.w)return this.count;throw Error("count after persistent!");};
f.O=function(b,a){return null==a?this.ba?this.Z:null:null==this.root?null:this.root.Ka(0,Ib(a),a)};f.D=function(b,a,c){return null==a?this.ba?this.Z:c:null==this.root?c:this.root.Ka(0,Ib(a),a,c)};
f.Ya=function(b,a){var c;a:if(this.w)if(null!=a?a.i&2048||a.wb||(a.i?0:y(Va,a)):y(Va,a))c=ve(this,Td.b?Td.b(a):Td.call(null,a),Vd.b?Vd.b(a):Vd.call(null,a));else{c=J(a);for(var d=this;;){var e=L(c);if(x(e))c=M(c),d=ve(d,Td.b?Td.b(e):Td.call(null,e),Vd.b?Vd.b(e):Vd.call(null,e));else{c=d;break a}}}else throw Error("conj! after persistent");return c};f.Za=function(){var b;if(this.w)this.w=null,b=new te(null,this.count,this.root,this.ba,this.Z,null);else throw Error("persistent! called twice");return b};
f.Ra=function(b,a,c){return ve(this,a,c)};var jd=function jd(a){for(var c=[],d=arguments.length,e=0;;)if(e<d)c.push(arguments[e]),e+=1;else break;return jd.A(0<c.length?new K(c.slice(0),0,null):null)};jd.A=function(b){for(var a=J(b),c=mb(lc);;)if(a){b=M(M(a));var d=L(a),a=L(M(a)),c=qb(c,d,a),a=b}else return ob(c)};jd.M=0;jd.J=function(b){return jd.A(J(b))};function we(b,a){this.s=b;this.da=a;this.i=32374988;this.v=0}f=we.prototype;f.toString=function(){return yb(this)};
f.equiv=function(b){return this.o(null,b)};f.indexOf=function(){var b=null,b=function(a,b){switch(arguments.length){case 1:return Q(this,a,0);case 2:return Q(this,a,b)}throw Error("Invalid arity: "+arguments.length);};b.b=function(a){return Q(this,a,0)};b.a=function(a,b){return Q(this,a,b)};return b}();
f.lastIndexOf=function(){function b(a){return S(this,a,R(this))}var a=null,a=function(a,d){switch(arguments.length){case 1:return b.call(this,a);case 2:return S(this,a,d)}throw Error("Invalid arity: "+arguments.length);};a.b=b;a.a=function(a,b){return S(this,a,b)};return a}();f.F=function(){return this.da};f.Y=function(){var b=(null!=this.s?this.s.i&128||this.s.Xa||(this.s.i?0:y(Pa,this.s)):y(Pa,this.s))?this.s.Y(null):M(this.s);return null==b?null:new we(b,this.da)};f.C=function(){return Pb(this)};
f.o=function(b,a){return dc(this,a)};f.S=function(b,a){return zc(a,this)};f.T=function(b,a,c){return Ac(a,c,this)};f.U=function(){return this.s.U(null).gb()};f.aa=function(){var b=(null!=this.s?this.s.i&128||this.s.Xa||(this.s.i?0:y(Pa,this.s)):y(Pa,this.s))?this.s.Y(null):M(this.s);return null!=b?new we(b,this.da):Mb};f.P=function(){return this};f.I=function(b,a){return new we(this.s,a)};f.N=function(b,a){return T(a,this)};we.prototype[Ba]=function(){return O(this)};
function Pd(b){return(b=J(b))?new we(b,null):null}function Td(b){return Wa(b)}function xe(b,a){this.s=b;this.da=a;this.i=32374988;this.v=0}f=xe.prototype;f.toString=function(){return yb(this)};f.equiv=function(b){return this.o(null,b)};f.indexOf=function(){var b=null,b=function(a,b){switch(arguments.length){case 1:return Q(this,a,0);case 2:return Q(this,a,b)}throw Error("Invalid arity: "+arguments.length);};b.b=function(a){return Q(this,a,0)};b.a=function(a,b){return Q(this,a,b)};return b}();
f.lastIndexOf=function(){function b(a){return S(this,a,R(this))}var a=null,a=function(a,d){switch(arguments.length){case 1:return b.call(this,a);case 2:return S(this,a,d)}throw Error("Invalid arity: "+arguments.length);};a.b=b;a.a=function(a,b){return S(this,a,b)};return a}();f.F=function(){return this.da};f.Y=function(){var b=(null!=this.s?this.s.i&128||this.s.Xa||(this.s.i?0:y(Pa,this.s)):y(Pa,this.s))?this.s.Y(null):M(this.s);return null==b?null:new xe(b,this.da)};f.C=function(){return Pb(this)};
f.o=function(b,a){return dc(this,a)};f.S=function(b,a){return zc(a,this)};f.T=function(b,a,c){return Ac(a,c,this)};f.U=function(){return this.s.U(null).hb()};f.aa=function(){var b=(null!=this.s?this.s.i&128||this.s.Xa||(this.s.i?0:y(Pa,this.s)):y(Pa,this.s))?this.s.Y(null):M(this.s);return null!=b?new xe(b,this.da):Mb};f.P=function(){return this};f.I=function(b,a){return new xe(this.s,a)};f.N=function(b,a){return T(a,this)};xe.prototype[Ba]=function(){return O(this)};
function Qd(b){return(b=J(b))?new xe(b,null):null}function Vd(b){return Xa(b)}function Jc(b){if(null!=b&&(b.v&4096||b.yb))return b.name;if("string"===typeof b)return b;throw Error([B("Doesn't support name: "),B(b)].join(""));}
function ye(b,a,c,d,e,g,h){var k=ma;ma=null==ma?null:ma-1;try{if(null!=ma&&0>ma)return G(b,"#");G(b,c);if(0===ya.b(g))J(h)&&G(b,function(){var a=ze.b(g);return x(a)?a:"..."}());else{if(J(h)){var l=L(h);a.g?a.g(l,b,g):a.call(null,l,b,g)}for(var m=M(h),n=ya.b(g)-1;;)if(!m||null!=n&&0===n){J(m)&&0===n&&(G(b,d),G(b,function(){var a=ze.b(g);return x(a)?a:"..."}()));break}else{G(b,d);var p=L(m);c=b;h=g;a.g?a.g(p,c,h):a.call(null,p,c,h);var q=M(m);c=n-1;m=q;n=c}}return G(b,e)}finally{ma=k}}
function Be(b,a){for(var c=J(a),d=null,e=0,g=0;;)if(g<e){var h=d.L(null,g);G(b,h);g+=1}else if(c=J(c))d=c,tc(d)?(c=tb(d),e=ub(d),d=c,h=R(c),c=e,e=h):(h=L(d),G(b,h),c=M(d),d=null,e=0),g=0;else return null}var Ce={'"':'\\"',"\\":"\\\\","\b":"\\b","\f":"\\f","\n":"\\n","\r":"\\r","\t":"\\t"};function De(b){return[B('"'),B(b.replace(RegExp('[\\\\"\b\f\n\r\t]',"g"),function(a){return Ce[a]})),B('"')].join("")}
function Ee(b,a){var c=yc(H.a(b,va));return c?(c=null!=a?a.i&131072||a.xb?!0:!1:!1)?null!=pc(a):c:c}
function Fe(b,a,c){if(null==b)return G(a,"nil");if(Ee(c,b)){G(a,"^");var d=pc(b);X.g?X.g(d,a,c):X.call(null,d,a,c);G(a," ")}if(b.ob)return b.Bb(a);if(null!=b&&(b.i&2147483648||b.R))return b.H(null,a,c);if(!0===b||!1===b||"number"===typeof b)return G(a,""+B(b));if(null!=b&&b.constructor===Object)return G(a,"#js "),d=V.a(function(a){return new Zc(null,2,5,$c,[Ic.b(a),b[a]],null)},uc(b)),Ge.$?Ge.$(d,X,a,c):Ge.call(null,d,X,a,c);if(za(b))return ye(a,X,"#js ["," ","]",c,b);if("string"==typeof b)return x(ta.b(c))?
G(a,De(b)):G(a,b);if("function"==r(b)){var e=b.name;c=x(function(){var a=null==e;return a?a:/^[\s\xa0]*$/.test(e)}())?"Function":e;return Be(a,fc(["#object[",c,' "',""+B(b),'"]'],0))}if(b instanceof Date)return c=function(a,b){for(var c=""+B(a);;)if(R(c)<b)c=[B("0"),B(c)].join("");else return c},Be(a,fc(['#inst "',""+B(b.getUTCFullYear()),"-",c(b.getUTCMonth()+1,2),"-",c(b.getUTCDate(),2),"T",c(b.getUTCHours(),2),":",c(b.getUTCMinutes(),2),":",c(b.getUTCSeconds(),2),".",c(b.getUTCMilliseconds(),3),
"-",'00:00"'],0));if(b instanceof RegExp)return Be(a,fc(['#"',b.source,'"'],0));if(x(b.constructor.$a))return Be(a,fc(["#object[",b.constructor.$a.replace(RegExp("/","g"),"."),"]"],0));e=b.constructor.name;c=x(function(){var a=null==e;return a?a:/^[\s\xa0]*$/.test(e)}())?"Object":e;return Be(a,fc(["#object[",c," ",""+B(b),"]"],0))}function X(b,a,c){var d=He.b(c);return x(d)?(c=kc.g(c,Ie,Fe),d.g?d.g(b,a,c):d.call(null,b,a,c)):Fe(b,a,c)}
function Je(b,a){var c;(c=null==b)||(c=J(b),c=null==c?!0:!1===c?!0:!1);if(c)c="";else{c=B;var d=new da;a:{var e=new xb(d);X(L(b),e,a);for(var g=J(M(b)),h=null,k=0,l=0;;)if(l<k){var m=h.L(null,l);G(e," ");X(m,e,a);l+=1}else if(g=J(g))h=g,tc(h)?(g=tb(h),k=ub(h),h=g,m=R(g),g=k,k=m):(m=L(h),G(e," "),X(m,e,a),g=M(h),h=null,k=0),l=0;else break a}c=""+c(d)}return c}
function Ge(b,a,c,d){return ye(c,function(b,c,d){var k=Wa(b);a.g?a.g(k,c,d):a.call(null,k,c,d);G(c," ");b=Xa(b);return a.g?a.g(b,c,d):a.call(null,b,c,d)},"{",", ","}",d,J(b))}K.prototype.R=!0;K.prototype.H=function(b,a,c){return ye(a,X,"("," ",")",c,this)};Kc.prototype.R=!0;Kc.prototype.H=function(b,a,c){return ye(a,X,"("," ",")",c,this)};oe.prototype.R=!0;oe.prototype.H=function(b,a,c){return ye(a,X,"("," ",")",c,this)};Nd.prototype.R=!0;
Nd.prototype.H=function(b,a,c){return ye(a,X,"("," ",")",c,this)};Ad.prototype.R=!0;Ad.prototype.H=function(b,a,c){return ye(a,X,"("," ",")",c,this)};Hc.prototype.R=!0;Hc.prototype.H=function(b,a,c){return ye(a,X,"("," ",")",c,this)};te.prototype.R=!0;te.prototype.H=function(b,a,c){return Ge(this,X,a,c)};qe.prototype.R=!0;qe.prototype.H=function(b,a,c){return ye(a,X,"("," ",")",c,this)};Ed.prototype.R=!0;Ed.prototype.H=function(b,a,c){return ye(a,X,"["," ","]",c,this)};Oc.prototype.R=!0;
Oc.prototype.H=function(b,a,c){return ye(a,X,"("," ",")",c,this)};gd.prototype.R=!0;gd.prototype.H=function(b,a,c){G(a,"#object [cljs.core.Atom ");X(new ra(null,1,[Ke,this.state],null),a,c);return G(a,"]")};xe.prototype.R=!0;xe.prototype.H=function(b,a,c){return ye(a,X,"("," ",")",c,this)};Zc.prototype.R=!0;Zc.prototype.H=function(b,a,c){return ye(a,X,"["," ","]",c,this)};Fc.prototype.R=!0;Fc.prototype.H=function(b,a){return G(a,"()")};ra.prototype.R=!0;
ra.prototype.H=function(b,a,c){return Ge(this,X,a,c)};we.prototype.R=!0;we.prototype.H=function(b,a,c){return ye(a,X,"("," ",")",c,this)};Ec.prototype.R=!0;Ec.prototype.H=function(b,a,c){return ye(a,X,"("," ",")",c,this)};function Le(){}var Me=function Me(a){if(null!=a&&null!=a.sb)return a.sb(a);var c=Me[r(null==a?null:a)];if(null!=c)return c.b?c.b(a):c.call(null,a);c=Me._;if(null!=c)return c.b?c.b(a):c.call(null,a);throw z("IEncodeJS.-clj-\x3ejs",a);};
function Ne(b){return(null!=b?b.rb||(b.Cb?0:y(Le,b)):y(Le,b))?Me(b):"string"===typeof b||"number"===typeof b||b instanceof U||b instanceof Kb?Oe.b?Oe.b(b):Oe.call(null,b):Je(fc([b],0),pa())}
var Oe=function Oe(a){if(null==a)return null;if(null!=a?a.rb||(a.Cb?0:y(Le,a)):y(Le,a))return Me(a);if(a instanceof U)return Jc(a);if(a instanceof Kb)return""+B(a);if(rc(a)){var c={};a=J(a);for(var d=null,e=0,g=0;;)if(g<e){var h=d.L(null,g),k=jc(h,0,null),h=jc(h,1,null);c[Ne(k)]=Oe(h);g+=1}else if(a=J(a))tc(a)?(e=tb(a),a=ub(a),d=e,e=R(e)):(e=L(a),d=jc(e,0,null),e=jc(e,1,null),c[Ne(d)]=Oe(e),a=M(a),d=null,e=0),g=0;else break;return c}if(null==a?0:null!=a?a.i&8||a.Hb||(a.i?0:y(Ma,a)):y(Ma,a)){c=[];
a=J(V.a(Oe,a));d=null;for(g=e=0;;)if(g<e)k=d.L(null,g),c.push(k),g+=1;else if(a=J(a))d=a,tc(d)?(a=tb(d),g=ub(d),d=a,e=R(a),a=g):(a=L(d),c.push(a),a=M(d),d=null,e=0),g=0;else break;return c}return a};var Pe=new U(null,"casing","casing",-610148831),Qe=new U(null,"pool","pool",-1814211613),va=new U(null,"meta","meta",1499536964),wa=new U(null,"dup","dup",556298533),kd=new U(null,"validator","validator",-1966190681),Re=new U(null,"likelihood","likelihood",-181348245),Ke=new U(null,"val","val",128701612),Ie=new U(null,"fallback-impl","fallback-impl",-1501286995),sa=new U(null,"flush-on-newline","flush-on-newline",-151457939),ta=new U(null,"readably","readably",1129599760),dd=new Kb(null,"meta23984",
"meta23984",-297181424,null),ze=new U(null,"more-marker","more-marker",-14717935),ya=new U(null,"print-length","print-length",1931866356),Se=new U(null,"alpha","alpha",-1574982441),cd=new Kb(null,"quote","quote",1377916282,null),bd=new U(null,"arglists","arglists",1661989754),ad=new Kb(null,"nil-iter","nil-iter",1101030523,null),He=new U(null,"alt-impl","alt-impl",670969595),Te=new U(null,"symbols","symbols",1211743),Ue=new U(null,"text","text",-1790561697);var ka=!1,ia=function(){function b(b){var d=null;if(0<arguments.length){for(var d=0,e=Array(arguments.length-0);d<e.length;)e[d]=arguments[d+0],++d;d=new K(e,0)}return a.call(this,d)}function a(a){return console.log.apply(console,Ga?Fa(a):Da.call(null,a))}b.M=0;b.J=function(b){b=J(b);return a(b)};b.A=a;return b}(),ja=function(){function b(b){var d=null;if(0<arguments.length){for(var d=0,e=Array(arguments.length-0);d<e.length;)e[d]=arguments[d+0],++d;d=new K(e,0)}return a.call(this,d)}function a(a){return console.error.apply(console,
Ga?Fa(a):Da.call(null,a))}b.M=0;b.J=function(b){b=J(b);return a(b)};b.A=a;return b}(),Ve=chance.bool();console.log(Ve);var We=chance.bool(Oe(new ra(null,1,[Re,30],null)));console.log(We);var Xe=chance.character();console.log(Xe);var Ye=chance.character(Oe(new ra(null,1,[Qe,"abcdef"],null)));console.log(Ye);var Ze=chance.character(Oe(new ra(null,1,[Se,!0],null)));console.log(Ze);var $e=chance.character(Oe(new ra(null,1,[Pe,"lower"],null)));console.log($e);
var af=chance.character(Oe(new ra(null,1,[Te,!0],null)));console.log(af);var bf=chance.random();console.log(bf);var cf=chance.floating();console.log(cf);var df=chance.name();console.log(df);var ef=chance.sentence();console.log(ef);var ff=chance.word();console.log(ff);var gf=chance.age();console.log(gf);var hf=chance.birthday();console.log(hf);var jf=chance.android_id();console.log(jf);var kf=chance.apple_token();console.log(kf);var lf=chance.bb_pin();console.log(lf);var mf=chance.country();console.log(mf);
var nf=chance.phone();console.log(nf);var of=chance.date();console.log(of);var pf=chance.month();console.log(pf);var qf=chance.cc();console.log(qf);var rf=chance.euro();console.log(rf);var sf=chance.cc_type();console.log(sf);var tf=fc(["This text is printed from src/cljsjs-interop-workshop/core.cljs. Go ahead and edit it and see reloading in action."],0),uf=kc.g(pa(),ta,!1),vf=Je(tf,uf);ia.b?ia.b(vf):ia.call(null,vf);if(x(ka)){var wf=pa();ia.b?ia.b("\n"):ia.call(null,"\n");H.a(wf,sa)}
if("undefined"===typeof xf){var xf,yf=new ra(null,1,[Ue,"Hello world!"],null);xf=id?id(yf):hd.call(null,yf)};
})();
