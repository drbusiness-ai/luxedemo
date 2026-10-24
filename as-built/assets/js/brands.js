/* =========================================================
   AS BUILT · brand configs. Designed and built by MAFSAN.
   One object per client. To make a new client version: copy the "luxe-haven" block, give it a new key,
   change the values, then open the site with ?client=<key>  (e.g. /?client=luxe-haven).
   Set MF_DEFAULT_CLIENT to make a client the default for a whole deploy.
   "mafsan" is the neutral showcase and must match the text written in the HTML pages.
   ========================================================= */
window.MF_DEFAULT_CLIENT = 'mafsan';

window.MF_BRANDS = {
  /* neutral showcase: the text the HTML is written with */
  mafsan: {
    name: 'MAFSAN Realty',               // full legal / trading name
    short: 'MAFSAN',                     // used in sentences ("MAFSAN's assistant")
    suffix: 'Realty',                    // small line under the logo
    wordmark: ['MAFSAN'],                // 3D intro + footer wordmark; two items stack on phones
    phone: '+971 4 000 0000',            // as displayed
    phoneRaw: '97140000000',             // digits only, used for tel: and WhatsApp
    email: 'hello@yourbrand.ae',
    site: 'yourbrand.ae',
    instagram: 'https://www.instagram.com/',
    youtube: 'https://www.youtube.com/',
    unit: 'Office 603',                  // the lit window in the 3D scene
    unitNo: '603',
    tower: 'One by Omniyat',             // the 3D scene models this tower; change the words only
    mapsQuery: 'One%20by%20Omniyat%2C%20Business%20Bay%2C%20Dubai',
    receptionPhoto: 'assets/img/omniyat-street-duo.webp',
    receptionCaption: 'Business Bay · street level'
  },

  /* example client variant */
  'luxe-haven': {
    name: 'Luxe Haven Realty',
    short: 'Luxe Haven',
    suffix: 'Realty',
    wordmark: ['LUXE', 'HAVEN'],
    phone: '+971 56 576 6004',
    phoneRaw: '971565766004',
    email: 'info@luxehavenrealty.ae',
    site: 'luxehavenrealty.ae',
    instagram: 'https://www.instagram.com/luxehavenrealtyae',
    youtube: 'https://www.youtube.com/@LuxeHavenRealty_ae',
    unit: 'Office 603',
    unitNo: '603',
    tower: 'One by Omniyat',
    mapsQuery: 'One%20by%20Omniyat%2C%20Business%20Bay%2C%20Dubai',
    receptionPhoto: 'assets/img/office-reception-duo.webp',
    receptionCaption: 'Reception · Office 603'
  },

  /* Wolves International · pitch preview (2026-10-24). Only details published on wolvesint.ae are used;
     phone stays a placeholder because the live site shows sample numbers (+971 4 234 5678 / 050 123 4567). */
  wolves: {
    name: 'Wolves International Real Estate',
    short: 'Wolves International',
    suffix: 'Real Estate',
    wordmark: ['WOLVES', 'INTERNATIONAL'],
    phone: '+971 4 000 0000',            // PLACEHOLDER: replace with the brokerage's real line
    phoneRaw: '97140000000',             // PLACEHOLDER
    email: 'info@wolvesint.ae',          // from wolvesint.ae/contact
    site: 'wolvesint.ae',
    instagram: 'https://www.instagram.com/wolvesint.ae',
    unit: 'Level 20',                    // 20th floor, Al Moosa Tower 1 (wolvesint.ae/contact)
    unitNo: '20',
    tower: 'Al Moosa Tower 1',           // 3D scene still models One by Omniyat; words only
    mapsQuery: 'Al%20Moosa%20Tower%201%2C%20Sheikh%20Zayed%20Road%2C%20Dubai',
    receptionPhoto: '',                  // no office photos yet: the reception figure is hidden
    receptionCaption: ''
  }
};
