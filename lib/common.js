var assert = require('assert');

// Zero-Pad a small number (like #seconds, #minutes, day-of-month, etc)
// to 2 digits.
function zp2(n)
{
  if (n >= 10)
    return n;
  return "0" + n;
}

exports.dateToHourstamp = function(date)
{
  assert(date instanceof Date);
  return [
    date.getUTCFullYear(),
    zp2(date.getUTCMonth() + 1),
    zp2(date.getUTCDate()),
    '-',
    zp2(date.getUTCHours())
  ].join('');
};

exports.dateToHourDate = function(date)
{
  assert(date instanceof Date);
  return new Date(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDay(),
    date.getUTCHours()
  );
};

