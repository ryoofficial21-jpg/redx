module.exports = {
  token: process.env.TOKEN,
  clientId: '1392827175815614504',

  /* =========================================================
     ROLES (PERMISSIONS)
  ========================================================= */

  roles: {
    // WHITELIST APPROVAL ONLY
    headAdmin: '1513868351989088276',

    // ROLE / UNROLE APPROVAL ONLY
    admin: '1513868351989088276',

    // INTERVIEW MODERATOR
    moderator: '1513868317092216983',
  },

  /* =========================================================
     REQUEST SETTINGS
  ========================================================= */

  requests: {
    // INTERVIEW CHANNEL
    interviewChannelId: '1513868095263871026',

    // ROLE REQUESTS
    roleRequestAdminRoleId: '1513868351989088276',

    // UNROLE REQUESTS
    unroleRequestChannelId: '1513868066490941440',
  },

  /* =========================================================
     VISUALS
  ========================================================= */

  images: {
    thumbnail:
      'https://media.discordapp.net/attachments/1508176750947991673/1508177857254265014/matrixroll.gif?ex=6a2906d5&is=6a27b555&hm=2ffb390145e97dc7098ad07393fb274c9056df4ca5eabf8bfca215106cafcc4a&=',
  },

  /* =========================================================
     SERVER ROLES
  ========================================================= */

  serverRoles: {
    citizen: '1513868598463172668',
    unverified: '1513868625533210655',
  }
};