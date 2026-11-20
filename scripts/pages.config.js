// 'scheduled': use the sale window in variants.config.js at request time on Pages.
// 'index' or 'blackfriday': pin the homepage to that static version (rollback).
// Placeholder or invalid schedules fail the build before replacing dist/.
module.exports = { home: 'scheduled', scheduledPage: 'blackfriday' };
