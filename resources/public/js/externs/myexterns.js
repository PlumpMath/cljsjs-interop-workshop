/*var chance = {
  "bool" : function() {},
  "character" : function() {},
  "random" : function() {}
} */

// ----------------------------
// another way to write externs

var chance = {};

chance.bool = function() {};
chance.character = function() {};
chance.floating = function() {};
chance.integer = function() {};
chance.natural = function() {};
chance.string = function() {};

// Text
chance.paragraph = function() {};
chance.sentence = function() {};
chance.word = function() {};

// Person
chance.age = function() {};
chance.birthday = function() {};
chance.cf = function() {}; //Generate a random Italian social security number (Codice Fiscale).
chance.cpf = function() {}; // Generate a  random Brazilian tax id.

chance.first = function() {}; // generate a random first name.
chance.last = function() {}; // generate a random last name.
chance.name = function() {}; // generate a random name.
chance.gender = function() {};


// Mobile
chance.android_id = function() {}; // Return a random GCM registration ID.
chance.apple_token = function() {}; // Return a random Apple Push Token
chance.bb_pin = function() {}; // Return a random BlackBerry Device PIN

// Web
chance.avatar = function() {};
chance.color = function() {};
chance.domain = function() {};
chance.email = function() {};
chance.ip = function() {};
chance.ipv6 = function() {};
chance.tld = function() {}; // return a random tld(Top Level Domain) from the given set
chance.url = function() {}; // return a random url

// Location
chance.address = function() {};
chance.areacode = function() {};
chance.city = function() {};
chance.coordinates = function() {};
chance.country = function() {};
chance.phone = function() {};
chance.postal = function() {};
chance.state = function() {};
chance.street = function() {};
chance.zip = function() {};

// Time
chance.ampm = function() {};
chance.date = function() {};
chance.hour = function() {};
chance.month = function() {};
chance.year = function() {};

// Finance
chance.cc = function() {};
chance.cc_type = function() {};
chance.currency = function() {};
chance.dollar = function() {};
chance.euro = function() {};

// Helpers
chance.capitalize = function() {};
chance.pick = function() {};
chance.shuffle = function() {};


//
chance.random = function() {};
