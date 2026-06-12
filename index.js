const {
    Client,
    GatewayIntentBits,
    Events,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');

const config = require('./config');

const { SlashCommandBuilder } = require('discord.js');

const commands = [
    new SlashCommandBuilder()
        .setName('grole')
        .setDescription('Create role request')
        .addStringOption(option =>
            option.setName('ingame_name')
                .setDescription('Your in-game name')
                .setRequired(true)
        )
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('Select the role to request')
                .setRequired(true)
        )
        .addUserOption(option =>
            option.setName('approved_by')
                .setDescription('User who will vouch/approve')
                .setRequired(true)
        )
].map(cmd => cmd.toJSON());

const { REST, Routes } = require('discord.js');

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('Cleaning old commands...');

        // REMOVE GLOBAL COMMANDS (para walang duplicate)
        await rest.put(
            Routes.applicationCommands(config.clientId),
            { body: [] }
        );

        console.log('Registering guild commands...');

        await rest.put(
            Routes.applicationGuildCommands(config.clientId, config.guildId),
            { body: commands }
        );

        console.log('Slash commands registered!');
    } catch (error) {
        console.error(error);
    }
})();


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


if (interaction.isModalSubmit()) {

    if (interaction.customId.startsWith('rolemodal_')) {

        const parts = interaction.customId.split('_');

        const requesterId = parts[1];
        const roleId = parts[2];
        const messageId = parts[3];

        const acronym =
            interaction.fields.getTextInputValue('acronym');

        const member =
            await interaction.guild.members.fetch(requesterId);

        await member.roles.add(roleId);

        try {
            await member.setNickname(
                `${acronym} | ${member.displayName}`
            );
        } catch (err) {
            console.log(err);
        }

        const msg =
            await interaction.channel.messages.fetch(messageId);

        const updatedEmbed = new EmbedBuilder(
            msg.embeds[0].data
        ).setColor('Green');

        const statusIndex =
            updatedEmbed.data.fields.findIndex(
                f => f.name === 'Status'
            );

        if (statusIndex !== -1) {
            updatedEmbed.spliceFields(
                statusIndex,
                1,
                {
                    name: 'Status',
value:
`✅ Admin Approved
Approved with acronym: **${acronym}**
Approved Admin By: <@${adminId}>`,
                    inline: false
                }
            );
        }

        const disabledRow =
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('approved')
                    .setLabel('Approved')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(true)
            );

        await msg.edit({
            embeds: [updatedEmbed],
            components: [disabledRow]
        });

        return interaction.reply({
            content:
                `✅ Approved with acronym: **${acronym}**`,
            ephemeral: true
        });
    }

    return;
}

    try {

        // =========================
        // BUTTON HANDLER
        // =========================
        if (interaction.isButton()) {
if (interaction.customId.startsWith('finalapprove_')) {

    if (!interaction.member.roles.cache.has(config.adminRoleId)) {
        return interaction.reply({
            content: '❌ Admin only.',
            ephemeral: true
        });
    }

    const parts = interaction.customId.split('_');

    const requesterId = parts[1];
    const roleId = parts[2];

    const modal = new ModalBuilder()
    .setCustomId(
    `rolemodal_${requesterId}_${roleId}_${interaction.message.id}_${interaction.user.id}`
)
        .setTitle('Enter Role Acronym');

    const acronymInput = new TextInputBuilder()
        .setCustomId('acronym')
        .setLabel('Role Acronym (e.g. GLPD, SSS, EMS)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(20);

    const row = new ActionRowBuilder().addComponents(acronymInput);

    modal.addComponents(row);

    return interaction.showModal(modal);
}

                // =====================
    // ROLE REQUEST APPROVE
    // =====================
    if (interaction.customId.startsWith('approve_')) {

        const parts = interaction.customId.split('_');

        const requesterId = parts[1];
        const approverId = parts[2];
        const roleId = parts[3];
        const adminId = parts[4];

        if (interaction.user.id !== approverId) {
            return interaction.reply({
                content: '❌ You are not the assigned voucher.',
                ephemeral: true
            });
        }

        const member = await interaction.guild.members.fetch(requesterId);     


        const adminRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
        .setCustomId(`finalapprove_${requesterId}_${roleId}`)
        .setLabel('Final Approve')
        .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
        .setCustomId(`finaldecline_${requesterId}`)
        .setLabel('Final Decline')
        .setStyle(ButtonStyle.Danger)
);

const updatedEmbed = new EmbedBuilder(interaction.message.embeds[0].data)
    .setColor('Yellow')
    .spliceFields(4, 1, {
        name: 'Status',
        value: '⏳ Waiting for Admin Approval',
        inline: false
    });

        const disabledRow = new ActionRowBuilder().addComponents(
            ButtonBuilder.from(interaction.message.components[0].components[0]).setDisabled(true),
            ButtonBuilder.from(interaction.message.components[0].components[1]).setDisabled(true)
        );

return interaction.update({
    embeds: [updatedEmbed],
    components: [adminRow]
});
}
    // =====================
    // ROLE REQUEST DECLINE
    // =====================
if (interaction.customId.startsWith('finaldecline_')) {

    if (!interaction.member.roles.cache.has(config.adminRoleId)) {
        return interaction.reply({
            content: '❌ Admin only.',
            ephemeral: true
        });
    }

    const updatedEmbed = new EmbedBuilder(interaction.message.embeds[0].data)
        .setColor('Red');

    const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('declined')
            .setLabel('Declined')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(true)
    );

    return interaction.update({
        embeds: [updatedEmbed],
        components: [disabledRow]
    });
}

        // =====================
    // INTERVIEW BUTTON
    // =====================
            if (!interaction.customId.startsWith('interview_')) return;

            await interaction.deferUpdate();

            if (!interaction.member.roles.cache.has(config.moderatorRoleId)) {
                return;
            }

            const targetUserId = interaction.customId.split('_')[1];

let member;

try {
    member = await interaction.guild.members.fetch(targetUserId);
} catch (err) {
    console.error(err);
    return interaction.reply({
        content: '❌ User not found.',
        ephemeral: true
    });
}

            const oldEmbed = interaction.message.embeds[0];
            if (!oldEmbed) return;

            const nameField = oldEmbed.fields.find(
                f => f.name.toLowerCase().includes('name')
            );

            const steamField = oldEmbed.fields.find(
                f => f.name.toLowerCase().includes('steam')
            );

            const playerName = nameField?.value || member.user.username;
            const steamLink = steamField?.value || 'N/A';

            try {
                if (config.unverifiedRoleId) {
                    await member.roles.remove(config.unverifiedRoleId);
                }

                if (config.citizenRoleId) {
                    await member.roles.add(config.citizenRoleId);
                }

                await member.setNickname(playerName).catch(() => {});
            } catch (err) {
                console.error("Role/Nickname Error:", err);
            }

            const updatedEmbed = new EmbedBuilder()
                .setTitle('📋 Interview Request')
                .setColor('Green')
                .setThumbnail(member.user.displayAvatarURL({ size: 1024 }))
                .addFields(
                    {
                        name: 'Discord',
                        value: `<@${targetUserId}>`,
                        inline: true
                    },
                    {
                        name: 'Name',
                        value: playerName,
                        inline: true
                    },
                    {
                        name: 'Steam Link',
                        value: steamLink,
                        inline: false
                    },
                    {
                        name: 'Status',
                        value: '✅ Interviewed',
                        inline: false
                    },
                    {
                        name: 'Interviewed By',
                        value: `${interaction.user}`,
                        inline: false
                    }
                )
                .setFooter({
                    text: `User ID: ${targetUserId}`
                })
                .setTimestamp();

            const disabledRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('completed')
                    .setLabel('Interview Complete')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(true)
            );

            await interaction.message.edit({
                embeds: [updatedEmbed],
                components: [disabledRow]
            });
        }

        // =========================
        // SLASH COMMAND HANDLER
        // =========================
        if (interaction.isChatInputCommand()) {

            if (interaction.commandName === 'grole') {

                const name = interaction.options.getString('ingame_name');
                const role = interaction.options.getRole('role');
                const approvedBy = interaction.options.getUser('approved_by');

const embed = new EmbedBuilder()
    .setTitle('Role Request')
    .setColor('#2F3136')
    .setThumbnail('https://media.discordapp.net/attachments/1513509486462242926/1513861665421262888/content.png?ex=6a2c90cb&is=6a2b3f4b&hm=b9e443eeb703a4bb3ed35944dbdbb487b6c709eafa97da69da3e23b0e80e8746&=&format=webp&quality=lossless&width=968&height=968')
    .addFields(
        {
            name: 'Requester',
            value: `${interaction.user}`,
            inline: true
        },
        {
            name: 'In Game Name',
            value: name,
            inline: true
        },
        {
            name: 'Requested Role',
            value: `${role}`,
            inline: true
        },
        {
            name: 'Approved By',
            value: `${approvedBy}`,
            inline: false
        },
        {
            name: 'Status',
            value: 'Waiting for Approved By',
            inline: false
        }
    )
    .setTimestamp();

const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
        .setCustomId(`approve_${interaction.user.id}_${approvedBy.id}_${role.id}`)
        .setLabel('Approve')
        .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
        .setCustomId(`decline_${interaction.user.id}_${approvedBy.id}`)
        .setLabel('Decline')
        .setStyle(ButtonStyle.Danger)
);

await interaction.reply({
    embeds: [embed],
    components: [row]
});

            }
        }

    } catch (err) {
        console.error("Interaction Error:", err);
    }
});

client.login(process.env.TOKEN);