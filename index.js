const {
    Client,
    GatewayIntentBits,
    Events,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const config = require('./config');

const client = new Client({
intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildExpressions,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildWebhooks
]

});

client.once(Events.ClientReady, () => {
    console.log(`${client.user.tag} is online!`);
});

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    if (message.channel.id !== config.applicationChannelId) return;

    const nameMatch = message.content.match(/Name:\s*(.+)/i);
    const steamMatch = message.content.match(/Steam Link:\s*(.+)/i);

    if (!nameMatch || !steamMatch) return;

    const name = nameMatch[1].trim();
    const steamLink = steamMatch[1].trim();

    const interviewChannel = message.guild.channels.cache.get(config.interviewChannelId);
    if (!interviewChannel) return;

    const embed = new EmbedBuilder()
        .setTitle('📋 Interview Request')
        .setColor('#2F3136')
        .setThumbnail(message.author.displayAvatarURL({ size: 1024 }))
        .addFields(
            { name: 'Discord', value: `${message.author}`, inline: true },
            { name: 'Name', value: name, inline: true },
            { name: 'Steam Link', value: steamLink, inline: false },
            { name: '📌 Status', value: '⏳ Pending Interview', inline: false },
            { name: 'Interviewed By', value: 'Not yet assigned', inline: false }
        )
        .setFooter({ text: `User ID: ${message.author.id}` })
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`interview_${message.author.id}`)
            .setLabel('Interview')
            .setStyle(ButtonStyle.Success)
    );

    // send embed
    await interviewChannel.send({
        embeds: [embed],
        components: [row]
    });

    // delete original message (AUTO REMOVE CHAT)
    await message.delete().catch(() => {});

    // react confirm
    await message.react('✅').catch(() => {});
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('interview_')) return;

    if (!interaction.member.roles.cache.has(config.moderatorRoleId)) {
        return interaction.reply({
            content: '❌ Moderator only.',
            ephemeral: true
        });
    }

    const targetUserId = interaction.customId.split('_')[1];

    let member;
    try {
        member = await interaction.guild.members.fetch(targetUserId);
    } catch {
        return interaction.reply({
            content: '❌ User not found.',
            ephemeral: true
        });
    }

    const oldEmbed = interaction.message.embeds?.[0];
    if (!oldEmbed) {
        return interaction.reply({
            content: '❌ Embed not found.',
            ephemeral: true
        });
    }

    // SAFE FIELD SEARCH
    const nameField = oldEmbed.fields?.find(f => f.name.includes('Name'));
    const steamField = oldEmbed.fields?.find(f => f.name.includes('Steam'));

    const playerName = nameField?.value || member.user.username;
    const steamLink = steamField?.value || 'N/A';

    try {
        await member.roles.remove(config.unverifiedRoleId);
        await member.roles.add(config.citizenRoleId);
        await member.setNickname(playerName);
    } catch (err) {
        console.log('Role/Nickname error:', err.message);
    }

    const updatedEmbed = new EmbedBuilder()
        .setTitle('📋 Interview Request')
        .setColor('Green')
        .setThumbnail(member.user.displayAvatarURL({ size: 1024 }))
        .addFields(
            { name: 'Discord', value: `<@${targetUserId}>`, inline: true },
            { name: 'Name', value: playerName, inline: true },
            { name: 'Steam Link', value: steamLink, inline: false },
            { name: 'Status', value: '✅ Interviewed', inline: false },
            { name: 'Interviewed By', value: `${interaction.user}`, inline: false }
        )
        .setFooter({ text: `User ID: ${targetUserId}` })
        .setTimestamp();

    const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('completed')
            .setLabel('Interview Complete')
            .setStyle(ButtonStyle.Success)
            .setDisabled(true)
    );

    await interaction.update({
        embeds: [updatedEmbed],
        components: [disabledRow]
    });
});

function createLogEmbed({ title, user, fields = [], extra = '', severity = 'INFO' }) {

    const tag = user?.tag || 'System';
    const id = user?.id || 'N/A';

    const colors = {
        INFO: 'Blue',
        WARN: 'Orange',
        ERROR: 'Red',
        SUCCESS: 'Green'
    };

    return new EmbedBuilder()
        .setColor(colors[severity] || 'Red')
        .setTitle(title)
        .setAuthor({
            name: tag,
            iconURL: user?.displayAvatarURL?.({ size: 64 })
        })
        .setThumbnail(user?.displayAvatarURL?.({ size: 1024 }))
        .addFields(
            { name: 'User Mention', value: user ? `<@${id}>` : 'System', inline: true },
            { name: 'Username', value: tag, inline: true },
            { name: 'User ID', value: id, inline: true },

            {
                name: 'Account Created',
                value: user?.createdAt
                    ? `<t:${Math.floor(user.createdAt.getTime() / 1000)}:F>`
                    : 'N/A',
                inline: false
            },

            {
                name: 'Account Age',
                value: user?.createdAt
                    ? `${Math.floor((Date.now() - user.createdAt.getTime()) / 86400000)} days`
                    : 'N/A',
                inline: true
            },

            {
                name: 'Account Type',
                value: user?.bot ? 'Bot' : 'User',
                inline: true
            },

            ...fields
        )
        .setFooter({ text: extra || 'Discord Log System' })
        .setTimestamp();
}


async function sendLog(guild, embed) {
    const channel = guild.channels.cache.get(config.logChannelId)
    || await guild.channels.fetch(config.logChannelId).catch(() => null);
    if (!channel) return;

    return channel.send({ embeds: [embed] }).catch(() => {});
}

// MEMBER JOIN
client.on(Events.GuildMemberAdd, member => {
    const embed = new EmbedBuilder()
        .setColor('Green')
        .setTitle('✅ Member Joined')
        .setDescription(`${member.user} joined the server`)
        .setTimestamp();

    sendLog(member.guild, embed);
});

// MEMBER LEAVE
client.on(Events.GuildMemberRemove, member => {
    const embed = new EmbedBuilder()
        .setColor('Red')
        .setTitle('❌ Member Left')
        .setDescription(`${member.user.tag} left the server`)
        .setTimestamp();

    sendLog(member.guild, embed);
});

// MESSAGE DELETE
client.on(Events.MessageDelete, message => {
    if (!message?.guild) return;

    const userTag = message.author?.tag || "Unknown User";

    const embed = createLogEmbed({
        title: "MESSAGE DELETED",
        color: "Orange",
        user: message.author || null,
        fields: [
            { name: "📍 Channel", value: `${message.channel}`, inline: true },
            { name: "💬 Content", value: message.content || "No Content", inline: false },
        ]
    });

    sendLog(message.guild, embed);
});

// MESSAGE EDIT
client.on(Events.MessageUpdate, (oldMsg, newMsg) => {
    if (!newMsg?.guild) return;
    if (!oldMsg?.content || !newMsg?.content) return;
    if (oldMsg.content === newMsg.content) return;

    const embed = createLogEmbed({
        title: "MESSAGE EDITED",
        color: "Yellow",
        user: newMsg.author || null,
        fields: [
            { name: "📍 Channel", value: `${newMsg.channel}`, inline: true },
            { name: "⬅️ Before", value: oldMsg.content?.slice(0, 1024) || "None", inline: false },
            { name: "➡️ After", value: newMsg.content?.slice(0, 1024) || "None", inline: false }
        ]
    });

    sendLog(newMsg.guild, embed);
});

// ROLE CREATE
client.on(Events.GuildRoleCreate, role => {
    const embed = new EmbedBuilder()
        .setColor('Green')
        .setTitle('🎭 Role Created')
        .setDescription(role.name)
        .setTimestamp();

    sendLog(role.guild, embed);
});

// ROLE DELETE
client.on(Events.GuildRoleDelete, role => {
    const embed = new EmbedBuilder()
        .setColor('Red')
        .setTitle('🗑️ Role Deleted')
        .setDescription(role.name)
        .setTimestamp();

    sendLog(role.guild, embed);
});

// CHANNEL CREATE
client.on(Events.ChannelCreate, channel => {
    if (!channel.guild) return;

    const embed = new EmbedBuilder()
        .setColor('Green')
        .setTitle('📁 Channel Created')
        .setDescription(channel.name)
        .setTimestamp();

    sendLog(channel.guild, embed);

});

// CHANNEL DELETE
client.on(Events.ChannelDelete, channel => {
    if (!channel.guild) return;

    const embed = new EmbedBuilder()
        .setColor('Red')
        .setTitle('🗑️ Channel Deleted')
        .setDescription(channel.name)
        .setTimestamp();

    sendLog(channel.guild, embed);
    
});

// BAN
client.on(Events.GuildBanAdd, ban => {
    const embed = new EmbedBuilder()
        .setColor('DarkRed')
        .setTitle('🔨 User Banned')
        .setDescription(`${ban.user.tag}`)
        .setTimestamp();

    sendLog(ban.guild, embed);
});

// UNBAN
client.on(Events.GuildBanRemove, ban => {
    const embed = new EmbedBuilder()
        .setColor('Green')
        .setTitle('🔓 User Unbanned')
        .setDescription(`${ban.user.tag}`)
        .setTimestamp();

    sendLog(ban.guild, embed);
});

// VOICE LOGS
client.on(Events.VoiceStateUpdate, (oldState, newState) => {

    if (!oldState.channel && newState.channel) {
        const embed = new EmbedBuilder()
            .setColor('Green')
            .setTitle('🎤 Voice Join')
            .setDescription(`${newState.member.user.tag} joined ${newState.channel}`)
            .setTimestamp();

        sendLog(newState.guild, embed);
    }

    if (oldState.channel && !newState.channel) {
        const embed = new EmbedBuilder()
            .setColor('Red')
            .setTitle('🎤 Voice Leave')
            .setDescription(`${newState.member.user.tag} left ${oldState.channel}`)
            .setTimestamp();

        sendLog(newState.guild, embed);
    }

    if (
        oldState.channel &&
        newState.channel &&
        oldState.channel.id !== newState.channel.id
    ) {
        const embed = new EmbedBuilder()
            .setColor('Blue')
            .setTitle('🔄 Voice Move')
            .setDescription(
                `${newState.member.user.tag}\n${oldState.channel} ➜ ${newState.channel}`
            )
            .setTimestamp();

        sendLog(newState.guild, embed);
    }
});

client.on(Events.GuildMemberUpdate, (oldMember, newMember) => {

    // BOOST
    if (!oldMember.premiumSince && newMember.premiumSince) {
        sendLog(newMember.guild,
            new EmbedBuilder()
                .setColor('Fuchsia')
                .setTitle('🚀 Server Boost')
                .setDescription(`${newMember.user.tag} boosted the server`)
        );
    }

    // ROLE CHANGES
    const added = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
    const removed = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));

    if (added.size) {
        sendLog(newMember.guild,
            createLogEmbed({
                title: "ROLE ADDED",
                color: "Green",
                user: newMember.user,
                fields: [
                    { name: "➕ Roles", value: added.map(r => r.name).join(", "), inline: false }
                ]
            })
        );
    }

    if (removed.size) {
        sendLog(newMember.guild,
            createLogEmbed({
                title: "ROLE REMOVED",
                color: "Red",
                user: newMember.user,
                fields: [
                    { name: "➖ Roles", value: removed.map(r => r.name).join(", "), inline: false }
                ]
            })
        );
    }
});

client.on(Events.GuildEmojiCreate, emoji => {
    sendLog(
        emoji.guild,
        new EmbedBuilder()
            .setColor('Green')
            .setTitle('😀 Emoji Created')
            .setDescription(`${emoji.name}`)
    );
});

client.on(Events.GuildEmojiDelete, emoji => {
    sendLog(
        emoji.guild,
        new EmbedBuilder()
            .setColor('Red')
            .setTitle('🗑️ Emoji Deleted')
            .setDescription(`${emoji.name}`)
    );
});

client.on(Events.GuildStickerCreate, sticker => {
    sendLog(
        sticker.guild,
        new EmbedBuilder()
            .setColor('Green')
            .setTitle('🏷️ Sticker Created')
            .setDescription(sticker.name)
    );
});

client.on(Events.GuildStickerDelete, sticker => {
    sendLog(
        sticker.guild,
        new EmbedBuilder()
            .setColor('Red')
            .setTitle('🗑️ Sticker Deleted')
            .setDescription(sticker.name)
    );
});

client.on(Events.InviteCreate, invite => {

    sendLog(
        invite.guild,
        new EmbedBuilder()
            .setColor('Green')
            .setTitle('🔗 Invite Created')
            .setDescription(invite.code)
    );
});

client.on(Events.InviteDelete, invite => {

    sendLog(
        invite.guild,
        new EmbedBuilder()
            .setColor('Red')
            .setTitle('🗑️ Invite Deleted')
            .setDescription(invite.code)
    );
});

client.on(Events.WebhooksUpdate, async channel => {

    sendLog(
        channel.guild,
        new EmbedBuilder()
            .setColor('Blue')
            .setTitle('🪝 Webhook Updated')
            .setDescription(`${channel}`)
    );
});

client.on(Events.ThreadCreate, thread => {
    if (!thread.guild) return;

    sendLog(thread.guild,
        new EmbedBuilder()
            .setColor('Green')
            .setTitle('🧵 Thread Created')
            .setDescription(thread.name || 'Unknown thread')
            .setTimestamp()
    );
});

client.on(Events.ThreadDelete, thread => {

    sendLog(
        thread.guild,
        new EmbedBuilder()
            .setColor('Red')
            .setTitle('🗑️ Thread Deleted')
            .setDescription(thread.name)
    );
});

client.login(process.env.TOKEN);