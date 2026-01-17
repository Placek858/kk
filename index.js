const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');
const axios = require('axios');
const fs = require('fs');

// --- KONFIGURACJA ---
const BOT_TOKEN = process.env.DISCORD_TOKEN; 
const PROXYCHECK_API_KEY = 'e2brv7-y9y366-243469-435457';
const GUILD_ID = '1456335080116191436';
const ROLE_ID = '1461789323262296084';

const MY_ID = '1131510639769178132'; 
const OTHER_ADMINS = ['1364295526736199883', '1447828677109878904']; 
const ALL_ADMINS = [MY_ID, ...OTHER_ADMINS];

const DB_FILE = './database.json';
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ ips: {} }));

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent
    ] 
});

const app = express();
app.use(express.urlencoded({ extended: true }));

// Funkcja usuwająca przyciski po kliknięciu
async function disableButtons(interaction, text) {
    try {
        await interaction.update({ content: text, components: [], embeds: interaction.message.embeds });
    } catch (e) { console.log("Błąd aktualizacji przycisków."); }
}

// Komenda !baza dla Ciebie
client.on('messageCreate', async (msg) => {
    if (msg.content === '!baza' && msg.author.id === MY_ID) {
        if (fs.existsSync(DB_FILE)) {
            await msg.author.send({ content: '📊 Baza IP:', files: [DB_FILE] });
            await msg.reply('✅ Wysłano bazę na PW.');
        }
    }
});

app.get('/auth', (req, res) => {
    const userId = req.query.token;
    if (!userId) return res.status(400).send('Błąd.');
    res.send(`<html><body style="background:#2f3136;color:white;text-align:center;padding-top:100px;font-family:sans-serif;"><h2>🛡️ Weryfikacja</h2><form action="/complete" method="POST"><input type="hidden" name="userId" value="${userId}"><button type="submit" style="background:#5865f2;color:white;padding:20px 40px;border:none;border-radius:5px;cursor:pointer;font-size:18px;font-weight:bold;">ZAKOŃCZ WERYFIKACJĘ</button></form></body></html>`);
});

app.post('/complete', async (req, res) => {
    const userId = req.body.userId;
    const userIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const cleanIP = userIP.split(',')[0].trim();

    try {
        // Wzmocnione zapytanie do ProxyCheck (dodane vpn=3 dla głębszego skanowania)
        const response = await axios.get(`https://proxycheck.io/v2/${cleanIP}?key=${PROXYCHECK_API_KEY}&vpn=3&asn=1`);
        const result = response.data[cleanIP];
        const user = await client.users.fetch(userId);
        const accountAge = Math.floor((Date.now() - user.createdTimestamp) / (1000 * 60 * 60 * 24));

        // Blokada VPN
        if (result && result.proxy === 'yes') {
            for (const id of ALL_ADMINS) {
                const admin = await client.users.fetch(id);
                await admin.send(`🚫 **BLOKADA VPN:** <@${userId}> próbował wejść z IP: \`${cleanIP}\` (Dostawca: ${result.asn})`);
            }
            return res.status(403).send('VPN jest zabroniony. Wyłącz go i spróbuj ponownie.');
        }

        let db = JSON.parse(fs.readFileSync(DB_FILE));
        const originalOwner = db.ips[cleanIP];
        const isMulticount = originalOwner && originalOwner !== userId;

        const embed = new EmbedBuilder()
            .setColor(isMulticount ? '#ff0000' : '#00ff00')
            .setTitle(isMulticount ? '⚠️ ALARM: POWTARZAJĄCE SIĘ IP' : '✅ NOWA WERYFIKACJA')
            .setDescription(`Gracz: <@${userId}>\n**Wiek konta:** ${accountAge} dni.`)
            .setTimestamp();

        const row = isMulticount ? new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`allow_${userId}`).setLabel('Przepuść').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`ban_${userId}`).setLabel('Zbanuj').setStyle(ButtonStyle.Danger)
        ) : null;

        for (const id of ALL_ADMINS) {
            const admin = await client.users.fetch(id);
            const finalEmbed = EmbedBuilder.from(embed);
            // Tylko Ty widzisz IP i ISP
            if (id === MY_ID) {
                finalEmbed.addFields(
                    { name: 'Adres IP', value: `\`${cleanIP}\``, inline: true },
                    { name: 'Dostawca', value: `\`${result.asn || 'Nieznany'}\``, inline: true }
                );
            }
            await admin.send({ embeds: [finalEmbed], components: row ? [row] : [] });
        }

        if (isMulticount) return res.send('<h1>Oczekiwanie na decyzję administratora...</h1>');

        db.ips[cleanIP] = userId;
        fs.writeFileSync(DB_FILE, JSON.stringify(db));
        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(userId);
        await member.roles.add(ROLE_ID);
        res.send('<h1>Sukces! Rola nadana.</h1>');

    } catch (error) { res.status(500).send('Błąd.'); }
});

client.on('interactionCreate', async (int) => {
    if (!int.isButton()) return;
    const [action, targetId] = int.customId.split('_');
    const guild = await client.guilds.fetch(GUILD_ID);
    try {
        const member = await guild.members.fetch(targetId);
        if (action === 'allow') {
            await member.roles.add(ROLE_ID);
            await disableButtons(int, `✅ **ZAAKCEPTOWANO** przez ${int.user.tag}.`);
        } else {
            await member.ban({ reason: 'Multikonto' });
            await disableButtons(int, `🚫 **ZBANOWANO** przez ${int.user.tag}.`);
        }
    } catch (e) { console.log("Błąd akcji."); }
});

client.login(BOT_TOKEN);
app.listen(process.env.PORT || 3000);
