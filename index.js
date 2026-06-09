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
        GatewayIntentBits.GuildMembers
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

    const interviewChannel = message.guild.channels.cache.get(
        config.interviewChannelId
    );

    if (!interviewChannel) return;

    const embed = new EmbedBuilder()
        .setTitle('📋 Interview Request')
        .setColor('#2F3136')
        .addFields(
            {
                name: '👤 Discord',
                value: `${message.author}`,
                inline: true
            },
            {
                name: '📝 Name',
                value: name,
                inline: true
            },
            {
                name: '🔗 Steam Link',
                value: steamLink,
                inline: false
            },
            {
                name: '📌 Status',
                value: '⏳ Pending Interview',
                inline: false
            },
            {
                name: '🎤 Interviewed By',
                value: 'Not yet assigned',
                inline: false
            }
        )
        .setFooter({
            text: `User ID: ${message.author.id}`
        })
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`interview_${message.author.id}`)
            .setLabel('Interview')
            .setStyle(ButtonStyle.Success)
    );

    await interviewChannel.send({
        embeds: [embed],
        components: [row]
    });

    await message.react('✅');
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

    const embed = interaction.message.embeds[0];

    const nameField = embed.fields.find(
        field => field.name.includes('Name')
    );

    const playerName = nameField?.value || member.user.username;

    try {
        await member.roles.remove(config.unverifiedRoleId);
    } catch {}

    try {
        await member.roles.add(config.citizenRoleId);
    } catch {}

    try {
        await member.setNickname(playerName);
    } catch {}

    const updatedEmbed = new EmbedBuilder()
        .setTitle('📋 Interview Request')
        .setColor('Green')
        .addFields(
            {
                name: '👤 Discord',
                value: `<@${targetUserId}>`,
                inline: true
            },
            {
                name: '📝 Name',
                value: playerName,
                inline: true
            },
            {
                name: '🔗 Steam Link',
                value: embed.fields[2].value,
                inline: false
            },
            {
                name: '📌 Status',
                value: '✅ Interviewed',
                inline: false
            },
            {
                name: '🎤 Interviewed By',
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

    await interaction.update({
        embeds: [updatedEmbed],
        components: [disabledRow]
    });
});

client.login(process.env.TOKEN);