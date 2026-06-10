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

function createLogEmbed({
    title,
    user,
    action = "Unknown Action",
    details = [],
    severity = "INFO"
}) {

    const colors = {
        INFO: 0x5865F2,
        SUCCESS: 0x57F287,
        WARN: 0xFEE75C,
        ERROR: 0xED4245
    };

    const description = details
        .map(x => `**${x.name}**\n${x.value}`)
        .join("\n\n");

    return new EmbedBuilder()
        .setColor(colors[severity] || colors.INFO)
        .setTitle(title)

        .setThumbnail(
            user?.displayAvatarURL({
                dynamic: true,
                size: 1024
            }) || null
        )

        .addFields(
            {
                name: "USER INFORMATION",
                value:
`Mention
${user ? `<@${user.id}>` : "Unknown"}

Username
${user?.tag || "Unknown"}

User ID
${user?.id || "Unknown"}

Account Created
${user?.createdAt
? `<t:${Math.floor(user.createdAt.getTime()/1000)}:F>`
: "Unknown"}

Account Age
${user?.createdAt
? `${Math.floor((Date.now()-user.createdAt.getTime()) / 86400000)} days`
: "Unknown"}`
            },

            {
                name: "ACTION INFORMATION",
                value:
`Action Performed
${action}

${description}`
            }
        )

        .setFooter({
            text: "Server Audit Log System"
        })

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

    const embed = createLogEmbed({
        title: "MEMBER JOINED",
        severity: "SUCCESS",
        user: member.user,
        fields: [
            {
                name: "📅 Joined Server",
                value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                inline: false
            }
        ]
    });

    sendLog(member.guild, embed);
});

// MEMBER LEAVE
client.on(Events.GuildMemberRemove, member => {

    const embed = createLogEmbed({
        title: "MEMBER LEFT",
        severity: "ERROR",
        user: member.user,
        fields: [
            {
                name: "📅 Left Server",
                value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                inline: false
            }
        ]
    });

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
client.on(Events.GuildRoleCreate, async role => {

    let executor = null;

    try {
        const logs = await role.guild.fetchAuditLogs({ type: 30 });
        executor = logs.entries.first()?.executor;
    } catch {}

    const embed = createLogEmbed({
        title: "ROLE CREATED",
        severity: "SUCCESS",
        user: executor,
        fields: [
            { name: "🎭 Role Name", value: role.name, inline: true },
            { name: "🆔 Role ID", value: role.id, inline: true },
            { name: "👤 Created By", value: executor ? `<@${executor.id}>` : "Unknown", inline: false }
        ]
    });

    sendLog(role.guild, embed);
});

// ROLE DELETE
client.on(Events.GuildRoleDelete, async role => {

    let executor = null;

    try {
        const logs = await role.guild.fetchAuditLogs({ type: 32 });
        executor = logs.entries.first()?.executor;
    } catch {}

    const embed = createLogEmbed({
        title: "ROLE DELETED",
        severity: "ERROR",
        user: executor,
        fields: [
            { name: "🎭 Role Name", value: role.name, inline: true },
            { name: "🆔 Role ID", value: role.id, inline: true },
            { name: "👤 Deleted By", value: executor ? `<@${executor.id}>` : "Unknown", inline: false }
        ]
    });

    sendLog(role.guild, embed);
});

// CHANNEL CREATE
client.on(Events.ChannelCreate, async channel => {
    if (!channel.guild) return;

    let executor = null;

    try {
        const logs = await channel.guild.fetchAuditLogs({
            type: 10 // CHANNEL_CREATE
        });

        const entry = logs.entries.first();
        if (entry) executor = entry.executor;
    } catch (err) {
        console.log("Audit log fetch error:", err.message);
    }

    const embed = createLogEmbed({
        title: "CHANNEL CREATED",
        severity: "SUCCESS",
        user: executor || null,
        fields: [
            { name: "Channel Name", value: channel.name, inline: true },
            { name: "Channel ID", value: channel.id, inline: true },
            { name: "Channel Type", value: String(channel.type), inline: true },
            { name: "Created By", value: executor ? `<@${executor.id}>` : "Unknown", inline: false }
        ]
    });

    sendLog(channel.guild, embed);
});

// CHANNEL DELETE
client.on(Events.ChannelDelete, async channel => {

    let executor = null;

    try {
        const logs = await channel.guild.fetchAuditLogs({ type: 12 });
        executor = logs.entries.first()?.executor;
    } catch {}

    const embed = createLogEmbed({
        title: "CHANNEL DELETED",
        severity: "ERROR",
        user: executor,
        fields: [
            { name: "📁 Channel", value: channel.name, inline: true },
            { name: "🆔 Channel ID", value: channel.id, inline: true },
            { name: "👤 Deleted By", value: executor ? `<@${executor.id}>` : "Unknown", inline: false }
        ]
    });

    sendLog(channel.guild, embed);
});

// BAN
client.on(Events.GuildBanAdd, async ban => {

    const embed = createLogEmbed({
        title: "USER BANNED",
        severity: "ERROR",
        user: ban.user,
        fields: [
            { name: "🔨 Action", value: "Banned", inline: true }
        ]
    });

    sendLog(ban.guild, embed);
});

// UNBAN
client.on(Events.GuildBanRemove, async ban => {

    const embed = createLogEmbed({
        title: "USER UNBANNED",
        severity: "SUCCESS",
        user: ban.user,
        fields: [
            { name: "🔓 Action", value: "Unbanned", inline: true }
        ]
    });

    sendLog(ban.guild, embed);
});

// VOICE LOGS
client.on(Events.VoiceStateUpdate, (oldState, newState) => {

    const member = newState.member || oldState.member;
    if (!member) return;

    const user = member.user;

    // JOIN
    if (!oldState.channel && newState.channel) {
        const embed = createLogEmbed({
            title: "VOICE JOIN",
            severity: "INFO",
            user: user,
            fields: [
                { name: "User", value: `<@${user.id}>`, inline: true },
                { name: "Channel", value: `${newState.channel.name}`, inline: true },
                { name: "Channel ID", value: newState.channel.id, inline: true }
            ]
        });

        return sendLog(newState.guild, embed);
    }

    // LEAVE
    if (oldState.channel && !newState.channel) {
        const embed = createLogEmbed({
            title: "VOICE LEAVE",
            severity: "WARN",
            user: user,
            fields: [
                { name: "User", value: `<@${user.id}>`, inline: true },
                { name: "Channel", value: `${oldState.channel.name}`, inline: true },
                { name: "Channel ID", value: oldState.channel.id, inline: true }
            ]
        });

        return sendLog(newState.guild, embed);
    }

    // MOVE
    if (
        oldState.channel &&
        newState.channel &&
        oldState.channel.id !== newState.channel.id
    ) {
        const embed = createLogEmbed({
            title: "VOICE MOVE",
            severity: "INFO",
            user: user,
            fields: [
                { name: "User", value: `<@${user.id}>`, inline: true },
                { name: "From", value: oldState.channel.name, inline: true },
                { name: "To", value: newState.channel.name, inline: true }
            ]
        });

        return sendLog(newState.guild, embed);
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

client.on(Events.GuildEmojiCreate, async emoji => {

    const embed = createLogEmbed({
        title: "EMOJI CREATED",
        severity: "SUCCESS",
        user: null,
        fields: [
            { name: "😀 Emoji", value: emoji.name, inline: true },
            { name: "🆔 Emoji ID", value: emoji.id, inline: true }
        ]
    });

    sendLog(emoji.guild, embed);
});

client.on(Events.GuildEmojiDelete, async emoji => {

    const embed = createLogEmbed({
        title: "EMOJI DELETED",
        severity: "ERROR",
        user: null,
        fields: [
            { name: "😀 Emoji", value: emoji.name, inline: true },
            { name: "🆔 Emoji ID", value: emoji.id, inline: true }
        ]
    });

    sendLog(emoji.guild, embed);
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

    const embed = createLogEmbed({
        title: "INVITE CREATED",
        severity: "SUCCESS",
        user: invite.inviter,
        action: "Created an invite link",
        details: [
            {
                name: "Invite Code",
                value: invite.code
            },
            {
                name: "Channel",
                value: `${invite.channel}`
            },
            {
                name: "Expires",
                value: invite.expiresAt
                    ? `<t:${Math.floor(invite.expiresAt.getTime()/1000)}:F>`
                    : "Never"
            },
            {
                name: "Max Uses",
                value: invite.maxUses || "Unlimited"
            }
        ]
    });

    sendLog(invite.guild, embed);
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

    const embed = createLogEmbed({
        title: "THREAD CREATED",
        severity: "SUCCESS",
        user: null,
        fields: [
            { name: "🧵 Thread", value: thread.name, inline: true },
            { name: "🆔 Thread ID", value: thread.id, inline: true }
        ]
    });

    sendLog(thread.guild, embed);
});

client.on(Events.ThreadDelete, thread => {

    const embed = createLogEmbed({
        title: "THREAD DELETED",
        severity: "ERROR",
        user: null,
        fields: [
            { name: "🧵 Thread", value: thread.name, inline: true },
            { name: "🆔 Thread ID", value: thread.id, inline: true }
        ]
    });

    sendLog(thread.guild, embed);
});

client.login(process.env.TOKEN);