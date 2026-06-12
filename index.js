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
        console.log('Registering slash commands...');

        await rest.put(
            Routes.applicationCommands(config.clientId),
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
                    .setColor('#5865F2')
                    .addFields(
                        { name: 'In-Game Name', value: name, inline: true },
                        { name: 'Requested Role', value: `${role}`, inline: true },
                        { name: 'Approved By (Vouch)', value: `${approvedBy}`, inline: false },
                        { name: 'Requested By', value: `${interaction.user}`, inline: false }
                    )
                    .setTimestamp();

                await interaction.reply({
                    embeds: [embed]
                });
            }
        }

    } catch (err) {
        console.error("Interaction Error:", err);
    }
});

client.login(process.env.TOKEN);