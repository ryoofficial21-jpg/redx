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

    try {

        // =========================
        // BUTTON HANDLER
        // =========================
        if (interaction.isButton()) {

                // =====================
    // ROLE REQUEST APPROVE
    // =====================
    if (interaction.customId.startsWith('approve_')) {

        const parts = interaction.customId.split('_');

        const requesterId = parts[1];
        const approverId = parts[2];
        const roleId = parts[3];

        if (interaction.user.id !== approverId) {
            return interaction.reply({
                content: '❌ You are not the assigned voucher.',
                ephemeral: true
            });
        }

        const member = await interaction.guild.members.fetch(requesterId);

        await member.roles.add(roleId);

        const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
            .setColor('Green');

        const disabledRow = new ActionRowBuilder().addComponents(
            ButtonBuilder.from(interaction.message.components[0].components[0]).setDisabled(true),
            ButtonBuilder.from(interaction.message.components[0].components[1]).setDisabled(true)
        );

        return interaction.update({
            embeds: [updatedEmbed],
            components: [disabledRow]
        });
    }

    // =====================
    // ROLE REQUEST DECLINE
    // =====================
    if (interaction.customId.startsWith('decline_')) {

        const approverId = interaction.customId.split('_')[2];

        if (interaction.user.id !== approverId) {
            return interaction.reply({
                content: '❌ You are not the assigned voucher.',
                ephemeral: true
            });
        }

        const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
            .setColor('Red');

        const disabledRow = new ActionRowBuilder().addComponents(
            ButtonBuilder.from(interaction.message.components[0].components[0]).setDisabled(true),
            ButtonBuilder.from(interaction.message.components[0].components[1]).setDisabled(true)
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
                console.error("Fetch Member Error:", err);
                return;
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
    .setThumbnail('https://i.imgur.com/yourlogo.png') // logo sa kanan taas
    .addFields(
        { name: 'Requester', value: `${interaction.user}`, inline: true },
        { name: 'In Game Name', value: name, inline: true },
        { name: 'Requested Role', value: `${role}`, inline: true },
        { name: 'Approved By', value: `${approvedBy}`, inline: false },
        { name: 'Status', value: 'Waiting for Approved By', inline: false }
    )
    .setFooter({
        text: `Request ID: ${interaction.id}`
    })
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