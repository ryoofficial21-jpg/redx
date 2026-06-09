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
// MESSAGE PARSER (INTERVIEW + RENAME)
// =====================
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    if (message.channel.id !== config.applicationChannelId) return;

    const interviewChannel = message.guild.channels.cache.get(config.interviewChannelId);
    if (!interviewChannel) return;

    // =====================
    // INTERVIEW REQUEST
    // =====================
    const nameMatch = message.content.match(/Name:\s*(.+)/i);
    const steamMatch = message.content.match(/Steam Link:\s*(.+)/i);

    if (nameMatch && steamMatch) {
        const name = nameMatch[1].trim();
        const steamLink = steamMatch[1].trim();

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

        await interviewChannel.send({ embeds: [embed], components: [row] });
        await message.delete().catch(() => {});
        return;
    }

    // =====================
    // RENAME REQUEST
    // =====================
    const oldNameMatch = message.content.match(/Old Name:\s*(.+)/i);
    const newNameMatch = message.content.match(/New Name:\s*(.+)/i);

    if (oldNameMatch && newNameMatch) {
        const oldName = oldNameMatch[1].trim();
        const newName = newNameMatch[1].trim();

        const embed = new EmbedBuilder()
            .setTitle('✏️ Rename Request')
            .setColor('#5865F2')
            .setThumbnail(message.author.displayAvatarURL({ size: 1024 }))
            .addFields(
                { name: 'Discord', value: `${message.author}`, inline: true },
                { name: 'Old Name', value: oldName, inline: true },
                { name: 'New Name', value: newName, inline: true },
                { name: '📌 Status', value: '⏳ Pending Rename', inline: false },
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
// INTERACTIONS (BUTTONS)
// =====================
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;

    // moderator check
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
    // INTERVIEW BUTTON
    // =====================
    if (type === 'interview') {
        const nameField = embed.fields?.find(f => f.name.includes('Name'));
        const steamField = embed.fields?.find(f => f.name.includes('Steam'));

        const playerName = nameField?.value || member.user.username;
        const steamLink = steamField?.value || 'N/A';

        try {
            await member.roles.remove(config.unverifiedRoleId);
            await member.roles.add(config.citizenRoleId);
            await member.setNickname(playerName);
        } catch (err) {
            console.log('Interview error:', err.message);
        }

        const updated = new EmbedBuilder()
            .setTitle('📋 Interview Request')
            .setColor('Green')
            .setThumbnail(member.user.displayAvatarURL({ size: 1024 }))
            .addFields(
                { name: 'Discord', value: `<@${userId}>`, inline: true },
                { name: 'Name', value: playerName, inline: true },
                { name: 'Steam Link', value: steamLink, inline: false },
                { name: 'Status', value: '✅ Interviewed', inline: false },
                { name: 'Interviewed By', value: `${interaction.user}`, inline: false }
            )
            .setFooter({ text: `User ID: ${userId}` })
            .setTimestamp();

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
    // RENAME BUTTON
    // =====================
    if (type === 'rename') {
        const oldField = embed.fields?.find(f => f.name.includes('Old Name'));
        const newField = embed.fields?.find(f => f.name.includes('New Name'));

        const newName = newField?.value || member.user.username;

        try {
            await member.setNickname(newName);
        } catch (err) {
            console.log('Rename error:', err.message);
        }

        const updated = new EmbedBuilder()
            .setTitle('✏️ Rename Request')
            .setColor('Green')
            .setThumbnail(member.user.displayAvatarURL({ size: 1024 }))
            .addFields(
                { name: 'Discord', value: `<@${userId}>`, inline: true },
                { name: 'Old Name', value: oldField?.value || 'N/A', inline: true },
                { name: 'New Name', value: newName, inline: true },
                { name: 'Status', value: '✅ Renamed', inline: false },
                { name: 'Handled By', value: `${interaction.user}`, inline: false }
            )
            .setFooter({ text: `User ID: ${userId}` })
            .setTimestamp();

        const disabled = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('rename_done')
                .setLabel('Rename Completed')
                .setStyle(ButtonStyle.Success)
                .setDisabled(true)
        );

        return interaction.update({ embeds: [updated], components: [disabled] });
    }
});

client.login(process.env.TOKEN);