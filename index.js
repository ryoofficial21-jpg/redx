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
{
    name: 'Username',
    value: `\`${tag}\``,
    inline: false
},
{
    name: 'User ID',
    value: `\`${id}\``,
    inline: false
},

                {
                    name: 'Account Created',
                    value: user?.createdAt
                        ? `<t:${Math.floor(user.createdAt.getTime() / 1000)}:F>`
                        : 'N/A',
                    inline: false
                },

    {
        name: 'Discord Member Since',
        value: user?.createdAt
            ? `<t:${Math.floor(user.createdAt.getTime() / 1000)}:D>`
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
client.on(Events.GuildMemberAdd, async (member) => {

    const user = member.user;

    const embed = new EmbedBuilder()
        .setColor(0x2ecc71)

        .setAuthor({
            name: user.username,
            iconURL: user.displayAvatarURL({
                extension: 'png',
                size: 1024
            })
        })

        .setThumbnail(
            user.displayAvatarURL({
                extension: 'png',
                size: 1024
            })
        )

        .setTitle("✅ MEMBER JOINED")

        .addFields(

            {
                name: "User Mention",
                value: `<@${user.id}>`,
                inline: false
            },

            {
                name: "Username",
                value: `\`${user.username}\``,
                inline: false
            },

            {
                name: "User ID",
                value: `\`${user.id}\``,
                inline: false
            },

            {
                name: "Account Created",
                value: `<t:${Math.floor(
                    user.createdAt.getTime() / 1000
                )}:F>`,
                inline: false
            },

            {
                name: "Discord Member Since",
                value: user.createdAt.toLocaleDateString('en-US'),
                inline: false
            },

            {
                name: "Account Type",
                value: user.bot ? "Bot" : "User",
                inline: true
            },

            {
                name: "Server Members",
                value: `${member.guild.memberCount}`,
                inline: true
            },

            {
                name: "Joined Server",
                value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                inline: false
            }
        )

        .setFooter({
            text: "Discord Log System"
        })

        .setTimestamp();

    await sendLog(member.guild, embed);

});

// MEMBER LEAVE
client.on(Events.GuildMemberRemove, async (member) => {

    const user = member.user;

    const embed = new EmbedBuilder()
        .setColor(0xe74c3c)

        .setAuthor({
            name: user.username,
            iconURL: user.displayAvatarURL({
                extension: 'png',
                size: 1024
            })
        })

        .setThumbnail(
            user.displayAvatarURL({
                extension: 'png',
                size: 1024
            })
        )

        .setTitle("❌ MEMBER LEFT")

        .addFields(


            {
    name: "Time In Server",
    value: member.joinedAt
        ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>`
        : "Unknown",
    inline: false
},

            {
                name: "User Mention",
                value: `<@${user.id}>`,
                inline: false
            },

            {
                name: "Username",
                value: `\`${user.username}\``,
                inline: false
            },

            {
                name: "User ID",
                value: `\`${user.id}\``,
                inline: false
            },

            {
                name: "Account Created",
                value: `<t:${Math.floor(
                    user.createdAt.getTime() / 1000
                )}:F>`,
                inline: false
            },

            {
                name: "Discord Member Since",
                value: user.createdAt.toLocaleDateString('en-US'),
                inline: false
            },

            {
                name: "Account Type",
                value: user.bot ? "Bot" : "User",
                inline: true
            },

            {
                name: "Server Members",
                value: `${member.guild.memberCount}`,
                inline: true
            },

            {
                name: "Roles",
                value: member.roles.cache
                    .filter(role => role.id !== member.guild.id)
                    .map(role => `<@&${role.id}>`)
                    .join(', ')
                    .slice(0, 1024) || "No Roles",
                inline: false
            },

            {
                name: "Left Server",
                value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                inline: false
            }

        )

        .setFooter({
            text: "Discord Log System"
        })

        .setTimestamp();

    await sendLog(member.guild, embed);

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
client.on(Events.ChannelDelete, async (channel) => {
    if (!channel.guild) return;

    let executor = null;

    try {
        const logs = await channel.guild.fetchAuditLogs({
            type: 12 // CHANNEL_DELETE
        });

        const entry = logs.entries.first();

        if (
            entry &&
            Date.now() - entry.createdTimestamp < 5000
        ) {
            executor = entry.executor;
        }
    } catch (err) {
        console.log("Audit Log Error:", err.message);
    }

    const embed = new EmbedBuilder()
        .setColor(0xe74c3c)

        .setAuthor({
            name: executor?.username || "Unknown User",
            iconURL: executor?.displayAvatarURL({
                extension: 'png',
                size: 1024
            })
        })

        .setThumbnail(
            executor?.displayAvatarURL({
                extension: 'png',
                size: 1024
            })
        )

        .setTitle("🗑️ CHANNEL DELETED")

        .addFields(

            {
                name: "Channel Name",
                value: `\`${channel.name}\``,
                inline: false
            },

            {
                name: "Channel ID",
                value: `\`${channel.id}\``,
                inline: false
            },

            {
                name: "Channel Type",
                value: `${channel.type}`,
                inline: false
            },

            {
                name: "Deleted By",
                value: executor
                    ? `<@${executor.id}>`
                    : "Unknown",
                inline: false
            },

            {
                name: "Username",
                value: executor
                    ? `\`${executor.username}\``
                    : "`Unknown`",
                inline: false
            },

            {
                name: "User ID",
                value: executor
                    ? `\`${executor.id}\``
                    : "`Unknown`",
                inline: false
            },

            {
                name: "Deleted At",
                value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                inline: false
            }

        )

        .setFooter({
            text: "Discord Log System"
        })

        .setTimestamp();

    await sendLog(channel.guild, embed);
});

// BAN
client.on(Events.GuildBanAdd, async (ban) => {

    const user = ban.user;
    let executor = null;

    try {
        const logs = await ban.guild.fetchAuditLogs({
            type: 22 // MEMBER_BAN_ADD
        });

        const entry = logs.entries.first();

        if (
            entry &&
            entry.target?.id === user.id &&
            Date.now() - entry.createdTimestamp < 5000
        ) {
            executor = entry.executor;
        }
    } catch (err) {
        console.log("Audit Log Error:", err.message);
    }

    const embed = new EmbedBuilder()
        .setColor('DarkRed')

        .setAuthor({
            name: user.username,
            iconURL: user.displayAvatarURL({
                extension: 'png',
                size: 1024
            })
        })

        .setThumbnail(
            user.displayAvatarURL({
                extension: 'png',
                size: 1024
            })
        )

        .setTitle('🔨 USER BANNED')

        .addFields(

            {
                name: 'User Mention',
                value: `<@${user.id}>`,
                inline: false
            },

            {
                name: 'Username',
                value: `\`${user.username}\``,
                inline: false
            },

            {
                name: 'User ID',
                value: `\`${user.id}\``,
                inline: false
            },

            {
                name: 'Account Created',
                value: `<t:${Math.floor(
                    user.createdAt.getTime() / 1000
                )}:F>`,
                inline: false
            },

            {
                name: 'Discord Member Since',
                value: user.createdAt.toLocaleDateString('en-US'),
                inline: false
            },

            {
                name: 'Account Type',
                value: user.bot ? 'Bot' : 'User',
                inline: true
            },

            {
                name: 'Banned By',
                value: executor
                    ? `<@${executor.id}>`
                    : 'Unknown',
                inline: false
            },

            {
                name: 'Moderator Username',
                value: executor
                    ? `\`${executor.username}\``
                    : '`Unknown`',
                inline: false
            },

            {
                name: 'Moderator ID',
                value: executor
                    ? `\`${executor.id}\``
                    : '`Unknown`',
                inline: false
            },

            {
                name: 'Banned At',
                value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                inline: false
            }

        )

        .setFooter({
            text: 'Discord Log System'
        })

        .setTimestamp();

    await sendLog(ban.guild, embed);

});

// UNBAN
client.on(Events.GuildBanRemove, async (ban) => {

    const user = ban.user;
    let executor = null;

    try {
        const logs = await ban.guild.fetchAuditLogs({
            type: 23 // MEMBER_BAN_REMOVE
        });

        const entry = logs.entries.first();

        if (
            entry &&
            entry.target?.id === user.id &&
            Date.now() - entry.createdTimestamp < 5000
        ) {
            executor = entry.executor;
        }
    } catch (err) {
        console.log("Audit Log Error:", err.message);
    }

    const embed = new EmbedBuilder()
        .setColor('Green')

        .setAuthor({
            name: user.username,
            iconURL: user.displayAvatarURL({
                extension: 'png',
                size: 1024
            })
        })

        .setThumbnail(
            user.displayAvatarURL({
                extension: 'png',
                size: 1024
            })
        )

        .setTitle('🔓 USER UNBANNED')

        .addFields(

            {
                name: 'User Mention',
                value: `<@${user.id}>`,
                inline: false
            },

            {
                name: 'Username',
                value: `\`${user.username}\``,
                inline: false
            },

            {
                name: 'User ID',
                value: `\`${user.id}\``,
                inline: false
            },

            {
                name: 'Account Created',
                value: `<t:${Math.floor(
                    user.createdAt.getTime() / 1000
                )}:F>`,
                inline: false
            },

            {
                name: 'Discord Member Since',
                value: user.createdAt.toLocaleDateString('en-US'),
                inline: false
            },

            {
                name: 'Account Type',
                value: user.bot ? 'Bot' : 'User',
                inline: true
            },

            {
                name: 'Unbanned By',
                value: executor
                    ? `<@${executor.id}>`
                    : 'Unknown',
                inline: false
            },

            {
                name: 'Moderator Username',
                value: executor
                    ? `\`${executor.username}\``
                    : '`Unknown`',
                inline: false
            },

            {
                name: 'Moderator ID',
                value: executor
                    ? `\`${executor.id}\``
                    : '`Unknown`',
                inline: false
            },

            {
                name: 'Unbanned At',
                value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                inline: false
            }

        )

        .setFooter({
            text: 'Discord Log System'
        })

        .setTimestamp();

    await sendLog(ban.guild, embed);

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

client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {

    // BOOST
    if (!oldMember.premiumSince && newMember.premiumSince) {
        sendLog(
            newMember.guild,
            new EmbedBuilder()
                .setColor('Fuchsia')
                .setTitle('🚀 SERVER BOOST')
                .setDescription(`${newMember.user.tag} boosted the server`)
                .setTimestamp()
        );
    }

    const addedRoles = newMember.roles.cache.filter(
        role => !oldMember.roles.cache.has(role.id)
    );

    const removedRoles = oldMember.roles.cache.filter(
        role => !newMember.roles.cache.has(role.id)
    );

    if (!addedRoles.size && !removedRoles.size) return;

    let executor = null;

    try {
        const logs = await newMember.guild.fetchAuditLogs({
            limit: 10,
            type: 25 // MEMBER_ROLE_UPDATE
        });

        const entry = logs.entries.find(entry =>
            entry.target?.id === newMember.id &&
            Date.now() - entry.createdTimestamp < 10000
        );

        if (entry) executor = entry.executor;
    } catch (err) {
        console.log("Audit Log Error:", err.message);
    }

    // ROLE ADDED
    if (addedRoles.size) {

        const embed = new EmbedBuilder()
            .setColor('Green')

            .setAuthor({
                name: newMember.user.username,
                iconURL: newMember.user.displayAvatarURL({
                    extension: 'png',
                    size: 1024
                })
            })

            .setThumbnail(
                newMember.user.displayAvatarURL({
                    extension: 'png',
                    size: 1024
                })
            )

            .setTitle('✅ ROLE ADDED')

            .addFields(

                {
                    name: 'User Mention',
                    value: `<@${newMember.id}>`,
                    inline: false
                },

                {
                    name: 'Username',
                    value: `\`${newMember.user.username}\``,
                    inline: false
                },

                {
                    name: 'User ID',
                    value: `\`${newMember.id}\``,
                    inline: false
                },

                {
                    name: 'Roles Added',
                    value: addedRoles.map(r => `<@&${r.id}>`).join(', '),
                    inline: false
                },

                {
                    name: 'Added By',
                    value: executor
                        ? `<@${executor.id}>`
                        : 'Unknown',
                    inline: false
                },

                {
                    name: 'Moderator Username',
                    value: executor
                        ? `\`${executor.username}\``
                        : '`Unknown`',
                    inline: false
                },

                {
                    name: 'Moderator ID',
                    value: executor
                        ? `\`${executor.id}\``
                        : '`Unknown`',
                    inline: false
                },

                {
                    name: 'Added At',
                    value: `<t:${Math.floor(Date.now()/1000)}:F>`,
                    inline: false
                }

            )

            .setFooter({
                text: 'Discord Log System'
            })

            .setTimestamp();

        sendLog(newMember.guild, embed);
    }

    // ROLE REMOVED
    if (removedRoles.size) {

        const embed = new EmbedBuilder()
            .setColor('Red')

            .setAuthor({
                name: newMember.user.username,
                iconURL: newMember.user.displayAvatarURL({
                    extension: 'png',
                    size: 1024
                })
            })

            .setThumbnail(
                newMember.user.displayAvatarURL({
                    extension: 'png',
                    size: 1024
                })
            )

            .setTitle('❌ ROLE REMOVED')

            .addFields(

                {
                    name: 'User Mention',
                    value: `<@${newMember.id}>`,
                    inline: false
                },

                {
                    name: 'Username',
                    value: `\`${newMember.user.username}\``,
                    inline: false
                },

                {
                    name: 'User ID',
                    value: `\`${newMember.id}\``,
                    inline: false
                },

                {
                    name: 'Roles Removed',
                    value: removedRoles.map(r => `<@&${r.id}>`).join(', '),
                    inline: false
                },

                {
                    name: 'Removed By',
                    value: executor
                        ? `<@${executor.id}>`
                        : 'Unknown',
                    inline: false
                },

                {
                    name: 'Moderator Username',
                    value: executor
                        ? `\`${executor.username}\``
                        : '`Unknown`',
                    inline: false
                },

                {
                    name: 'Moderator ID',
                    value: executor
                        ? `\`${executor.id}\``
                        : '`Unknown`',
                    inline: false
                },

                {
                    name: 'Removed At',
                    value: `<t:${Math.floor(Date.now()/1000)}:F>`,
                    inline: false
                }

            )

            .setFooter({
                text: 'Discord Log System'
            })

            .setTimestamp();

        sendLog(newMember.guild, embed);
    }
});

client.on(Events.GuildEmojiCreate, async (emoji) => {

    let executor = null;

    try {
        const logs = await emoji.guild.fetchAuditLogs({
            type: 60 // EMOJI_CREATE
        });

        const entry = logs.entries.first();

        if (
            entry &&
            Date.now() - entry.createdTimestamp < 5000
        ) {
            executor = entry.executor;
        }
    } catch (err) {
        console.log("Audit Log Error:", err.message);
    }

    const embed = new EmbedBuilder()
        .setColor('Green')

        .setAuthor({
            name: executor?.username || "Unknown User",
            iconURL: executor?.displayAvatarURL({
                extension: 'png',
                size: 1024
            })
        })

        .setThumbnail(emoji.imageURL())

        .setTitle('😀 EMOJI CREATED')

        .addFields(

            {
                name: 'Emoji',
                value: `${emoji}`,
                inline: true
            },

            {
                name: 'Emoji Name',
                value: `\`${emoji.name}\``,
                inline: true
            },

            {
                name: 'Emoji ID',
                value: `\`${emoji.id}\``,
                inline: true
            },

            {
                name: 'Created By',
                value: executor
                    ? `<@${executor.id}>`
                    : 'Unknown',
                inline: false
            },

            {
                name: 'Username',
                value: executor
                    ? `\`${executor.username}\``
                    : '`Unknown`',
                inline: false
            },

            {
                name: 'User ID',
                value: executor
                    ? `\`${executor.id}\``
                    : '`Unknown`',
                inline: false
            },

            {
                name: 'Created At',
                value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                inline: false
            }

        )

        .setFooter({
            text: 'Discord Log System'
        })

        .setTimestamp();

    await sendLog(emoji.guild, embed);

});

client.on(Events.GuildEmojiDelete, async (emoji) => {

    let executor = null;

    try {
        const logs = await emoji.guild.fetchAuditLogs({
            type: 62 // EMOJI_DELETE
        });

        const entry = logs.entries.first();

        if (
            entry &&
            Date.now() - entry.createdTimestamp < 5000
        ) {
            executor = entry.executor;
        }
    } catch (err) {
        console.log("Audit Log Error:", err.message);
    }

    const embed = new EmbedBuilder()
        .setColor('Red')

        .setAuthor({
            name: executor?.username || "Unknown User",
            iconURL: executor?.displayAvatarURL({
                extension: 'png',
                size: 1024
            })
        })

        .setTitle('🗑️ EMOJI DELETED')

        .addFields(

            {
                name: 'Emoji Name',
                value: `\`${emoji.name}\``,
                inline: true
            },

            {
                name: 'Emoji ID',
                value: `\`${emoji.id}\``,
                inline: true
            },

            {
                name: 'Deleted By',
                value: executor
                    ? `<@${executor.id}>`
                    : 'Unknown',
                inline: false
            },

            {
                name: 'Username',
                value: executor
                    ? `\`${executor.username}\``
                    : '`Unknown`',
                inline: false
            },

            {
                name: 'User ID',
                value: executor
                    ? `\`${executor.id}\``
                    : '`Unknown`',
                inline: false
            },

            {
                name: 'Deleted At',
                value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                inline: false
            }

        )

        .setFooter({
            text: 'Discord Log System'
        })

        .setTimestamp();

    await sendLog(emoji.guild, embed);

});

client.on(Events.GuildStickerCreate, async (sticker) => {

    let executor = null;

    try {
        const logs = await sticker.guild.fetchAuditLogs({
            limit: 1
        });

        const entry = logs.entries.first();

        if (
            entry &&
            Date.now() - entry.createdTimestamp < 5000
        ) {
            executor = entry.executor;
        }
    } catch (err) {
        console.log("Audit Log Error:", err.message);
    }

    const embed = new EmbedBuilder()
        .setColor('Green')

        .setAuthor({
            name: executor?.username || "Unknown User",
            iconURL: executor?.displayAvatarURL({
                extension: 'png',
                size: 1024
            })
        })

        .setThumbnail(sticker.url)

        .setTitle('🏷️ STICKER CREATED')

        .addFields(

            {
                name: 'Sticker Name',
                value: `\`${sticker.name}\``,
                inline: true
            },

            {
                name: 'Sticker ID',
                value: `\`${sticker.id}\``,
                inline: true
            },

            {
                name: 'Sticker Description',
                value: sticker.description || 'No Description',
                inline: false
            },

            {
                name: 'Created By',
                value: executor
                    ? `<@${executor.id}>`
                    : 'Unknown',
                inline: false
            },

            {
                name: 'Username',
                value: executor
                    ? `\`${executor.username}\``
                    : '`Unknown`',
                inline: false
            },

            {
                name: 'User ID',
                value: executor
                    ? `\`${executor.id}\``
                    : '`Unknown`',
                inline: false
            },

            {
                name: 'Created At',
                value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                inline: false
            }

        )

        .setFooter({
            text: 'Discord Log System'
        })

        .setTimestamp();

    await sendLog(sticker.guild, embed);

});

client.on(Events.GuildStickerDelete, async sticker => {

    let executor = null;

    try {
        const logs = await sticker.guild.fetchAuditLogs({
            limit: 1
        });

        const entry = logs.entries.find(
            e => e.target?.id === sticker.id
        );

        if (entry) executor = entry.executor;
    } catch {}

    const embed = new EmbedBuilder()
        .setColor('Red')
        .setTitle('🗑️ STICKER DELETED')
        .setThumbnail(sticker.url || null)

        .addFields(
            {
                name: 'Sticker Name',
                value: `\`${sticker.name}\``,
                inline: false
            },
            {
                name: 'Sticker ID',
                value: `\`${sticker.id}\``,
                inline: false
            },
            {
                name: 'Deleted By',
                value: executor
                    ? `<@${executor.id}>`
                    : 'Unknown',
                inline: false
            },
            {
                name: 'Username',
                value: executor
                    ? `\`${executor.username}\``
                    : 'Unknown',
                inline: false
            },
            {
                name: 'User ID',
                value: executor
                    ? `\`${executor.id}\``
                    : 'Unknown',
                inline: false
            }
        )

        .setFooter({
            text: 'Discord Log System'
        })

        .setTimestamp();

    sendLog(sticker.guild, embed);

});

client.on(Events.InviteCreate, async (invite) => {

    const creator = invite.inviter;

    const embed = new EmbedBuilder()
        .setColor(0x2ecc71)

        .setAuthor({
            name: creator?.tag || "Unknown User",
            iconURL: creator?.displayAvatarURL({
                extension: 'png',
                size: 1024
            })
        })

        // PROFILE SA KANAN TAAS
        .setThumbnail(
            creator?.displayAvatarURL({
                extension: 'png',
                size: 1024
            })
        )

        .setTitle("INVITE CREATED")

.addFields(
    {
        name: "User Mention",
        value: creator
            ? `<@${creator.id}>`
            : "Unknown",
        inline: false
    },

    {
        name: "Username",
        value: `\`${creator?.username || "Unknown"}\``,
        inline: false
    },

    {
        name: "User ID",
        value: `\`${creator?.id || "Unknown"}\``,
        inline: false
    },

    {
        name: "Account Created",
        value: creator?.createdAt
            ? `<t:${Math.floor(
                creator.createdAt.getTime() / 1000
            )}:F>`
            : "Unknown",
        inline: false
    },

    {
        name: "Discord Member Since",
        value: creator?.createdAt
            ? creator.createdAt.toLocaleDateString('en-US')
            : "Unknown",
        inline: false
    },

        )

        .setFooter({
            text: "Discord Log System"
        })

        .setTimestamp();

    await sendLog(invite.guild, embed);

});

client.on(Events.InviteDelete, async invite => {

    let executor = null;

    try {
        const logs = await invite.guild.fetchAuditLogs({
            limit: 1
        });

        const entry = logs.entries.first();

        if (entry) executor = entry.executor;
    } catch (err) {
        console.log(err);
    }

    const embed = new EmbedBuilder()
        .setColor('Red')

        .setAuthor({
            name: executor?.tag || 'Unknown User',
            iconURL: executor?.displayAvatarURL({
                extension: 'png',
                size: 1024
            })
        })

        .setThumbnail(
            executor?.displayAvatarURL({
                extension: 'png',
                size: 1024
            })
        )

        .setTitle('🗑️ INVITE DELETED')

        .addFields(

            {
                name: 'User Mention',
                value: executor
                    ? `<@${executor.id}>`
                    : 'Unknown',
                inline: true
            },

            {
                name: 'Username',
                value: executor
                    ? `\`${executor.username}\``
                    : 'Unknown',
                inline: false
            },

            {
                name: 'User ID',
                value: executor
                    ? `\`${executor.id}\``
                    : 'Unknown',
                inline: false
            },

            {
                name: 'Invite Code',
                value: `\`${invite.code}\``,
                inline: true
            },

            {
                name: 'Invite URL',
                value: `https://discord.gg/${invite.code}`,
                inline: false
            },

            {
                name: 'Channel',
                value: invite.channel
                    ? `${invite.channel}`
                    : 'Unknown',
                inline: true
            }

        )

        .setFooter({
            text: 'Discord Log System'
        })

        .setTimestamp();

    sendLog(invite.guild, embed);

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