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


// =====================
// MESSAGE CREATE
// =====================
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    // ❗ ensure correct channel
    if (message.channel.id !== config.applicationChannelId) return;

    const interviewChannel = message.guild.channels.cache.get(config.interviewChannelId);
    if (!interviewChannel) return;

    const lines = message.content.split('\n').map(l => l.trim());

    // =====================
    // INTERVIEW REQUEST
    // =====================
    const nameLine = lines.find(l => l.toLowerCase().startsWith('name:'));
    const steamLine = lines.find(l => l.toLowerCase().startsWith('steam link:'));

    if (nameLine && steamLine && !lines.find(l => l.toLowerCase().startsWith('old name'))) {

        const name = nameLine.split(':')[1]?.trim();
        const steamLink = steamLine.split(':')[1]?.trim();

        const embed = new EmbedBuilder()
            .setTitle('📋 Interview Request')
            .setColor('#2F3136')
            .setThumbnail(message.author.displayAvatarURL({ size: 1024 }))
            .addFields(
                { name: 'Discord', value: `${message.author}`, inline: true },
                { name: 'Name', value: name || 'N/A', inline: true },
                { name: 'Steam Link', value: steamLink || 'N/A', inline: false },
                { name: 'Status', value: '⏳ Pending Interview', inline: false },
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

        await interviewChannel.send({ embeds: [embed], components: [row] });
        await message.delete().catch(() => {});
        return;
    }

    // =====================
    // RENAME REQUEST
    // =====================
    const oldLine = lines.find(l => l.toLowerCase().startsWith('old name:'));
    const newLine = lines.find(l => l.toLowerCase().startsWith('new name:'));

    if (oldLine && newLine) {

        const oldName = oldLine.split(':')[1]?.trim();
        const newName = newLine.split(':')[1]?.trim();

        const embed = new EmbedBuilder()
            .setTitle('✏️ Rename Request')
            .setColor('#5865F2')
            .setThumbnail(message.author.displayAvatarURL({ size: 1024 }))
            .addFields(
                { name: 'Discord', value: `${message.author}`, inline: true },
                { name: 'Old Name', value: oldName || 'N/A', inline: true },
                { name: 'New Name', value: newName || 'N/A', inline: true },
                { name: 'Status', value: '⏳ Pending Rename', inline: false },
                { name: 'Handled By', value: 'Not yet assigned', inline: false }
            )
            .setFooter({ text: `User ID: ${message.author.id}` })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`rename_${message.author.id}`)
                .setLabel('Approve Rename')
                .setStyle(ButtonStyle.Primary)
        );

        await interviewChannel.send({ embeds: [embed], components: [row] });
        await message.delete().catch(() => {});
        return;
    }
});


// =====================
// INTERACTIONS
// =====================
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;

    if (!interaction.member.roles.cache.has(config.moderatorRoleId)) {
        return interaction.reply({
            content: '❌ Moderator only.',
            ephemeral: true
        });
    }

    const [type, userId] = interaction.customId.split('_');

    let member;
    try {
        member = await interaction.guild.members.fetch(userId);
    } catch {
        return interaction.reply({ content: '❌ User not found.', ephemeral: true });
    }

    const embed = interaction.message.embeds?.[0];
    if (!embed) {
        return interaction.reply({ content: '❌ Embed not found.', ephemeral: true });
    }

    // =====================
    // INTERVIEW
    // =====================
    if (type === 'interview') {

        const nameField = embed.fields?.find(f => f.name === 'Name');
        const steamField = embed.fields?.find(f => f.name === 'Steam Link');

        const playerName = nameField?.value || member.user.username;
        const steamLink = steamField?.value || 'N/A';

        try {
            await member.roles.remove(config.unverifiedRoleId);
            await member.roles.add(config.citizenRoleId);
            await member.setNickname(playerName);
        } catch (err) {
            console.log(err.message);
        }

        const updated = EmbedBuilder.from(embed)
            .setColor('Green')
            .spliceFields(3, 2,
                { name: 'Status', value: '✅ Interviewed', inline: false },
                { name: 'Interviewed By', value: `${interaction.user}`, inline: false }
            );

        const disabled = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('done')
                .setLabel('Completed')
                .setStyle(ButtonStyle.Success)
                .setDisabled(true)
        );

        return interaction.update({ embeds: [updated], components: [disabled] });
    }

    // =====================
    // RENAME
    // =====================
    if (type === 'rename') {

        const newName = embed.fields?.find(f => f.name === 'New Name')?.value;

        try {
            await member.setNickname(newName);
        } catch (err) {
            console.log(err.message);
        }

        const updated = EmbedBuilder.from(embed)
            .setColor('Green')
            .spliceFields(3, 2,
                { name: 'Status', value: '✅ Renamed', inline: false },
                { name: 'Handled By', value: `${interaction.user}`, inline: false }
            );

        const disabled = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('rename_done')
                .setLabel('Completed')
                .setStyle(ButtonStyle.Success)
                .setDisabled(true)
        );

        return interaction.update({ embeds: [updated], components: [disabled] });
    }
});

client.login(process.env.TOKEN);