const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');
const axios = require('axios');
const fs = require('fs');

const BOT_TOKEN = process.env.DISCORD_TOKEN; 
const PROXYCHECK_API_KEY = 'e2brv7-y9y366-243469-435457';
const GUILD_ID = '1456335080116191436';
const ROLE_ID = '1457037758974394560';

// --- KONFIGURACJA ID ---
const MY_ID = '1131510639769178132'; // Ty (Główny Admin)
const OTHER_ADMINS = ['1364295526736199883', '1447828677109878904']; // Pozostali
const ALL_ADMINS = [MY_ID, ...OTHER_ADMINS];

const DB_FILE = './database.json';
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ ips: {} }));

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
const app = express();
app.use(express.urlencoded({ extended: true }));

// Pomocnicza funkcja do czyszczenia przycisków po akcji
async function disableButtons(interaction, text) {
    try {
        await interaction.update({ content: text, components: [], embeds: interaction.message.embeds });
    } catch (e) { console.log("Nie udało się zaktualizować przycisków."); }
}

app.get('/auth', (req, res) => {
    const userId = req.query.token;
    if (!userId) return res.status(400).send('Błąd sesji.');
    res.send('<html><body style="background:#2f3136;color:white;text-align:center;padding-top:100px;font-family:sans-serif;"><h2>🛡️ Weryfikacja</h2><form action="/complete" method="POST"><input type="hidden" name="userId" value="'+userId+'"><button type="submit" style="background:#5865f2;color:white;padding:20px 40px;border:none;border-radius:5px;cursor:pointer;font-weight:bold;">ZAKOŃCZ WERYFIKACJĘ</button></form></body></html>');
});

app.post('/complete', async (req, res) => {
    const userId = req.body.userId;
    const userIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const cleanIP = userIP.split(',')[0].trim();

    try {
        const user = await client.users.fetch(userId);
        const response = await axios.get(`https://proxycheck.io/v2/${cleanIP}?key=${PROXYCHECK_API_KEY}&vpn=1&asn=1`);
        const result = response.data[cleanIP];
        const accountAge = Math.floor((Date.now() - user.createdTimestamp) / (1000 * 60 * 60 * 24));

        if (result && result.proxy === 'yes') return res.status(403).send('VPN zabroniony.');

        let db = JSON.parse(fs.readFileSync(DB_FILE));
        const originalOwner = db.ips[cleanIP];

        // Definicja pól z IP (Tylko dla Ciebie)
        const ipFields = [
            { name: 'Adres IP', value: `\`${cleanIP}\``, inline: true },
            { name: 'Dostawca', value: `\`${result.asn || 'Nieznany'}\``, inline: true }
        ];

        const isMulticount = originalOwner && originalOwner !== userId;
        const embed = new EmbedBuilder()
            .setTimestamp()
            .setColor(isMulticount ? '#ff0000' : '#00ff00')
            .setTitle(isMulticount ? '⚠️ WYKRYTO POWTARZAJĄCE SIĘ IP!' : '✅ NOWY GRACZ')
            .setDescription(`Użytkownik: <@${userId}>\n**Wiek konta:** ${accountAge} dni.${isMulticount ? `\nTo samo IP co: <@${originalOwner}>` : ''}`);

        const row = isMulticount ? new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`allow_${userId}`).setLabel('Przepuść').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`ban_${userId}`).setLabel('Zbanuj').setStyle(ButtonStyle.Danger)
        ) : null;

        // WYSYŁANIE DO ADMINÓW
        for (const id of ALL_ADMINS) {
            try {
                const admin = await client.users.fetch(id);
                // Klonujemy embed, żeby nie psuć oryginału
                const finalEmbed = EmbedBuilder.from(embed);
                
                // TYLKO TY dostajesz pola IP
                if (id === MY_ID) {
                    finalEmbed.addFields(ipFields);
                }

                await admin.send({ 
                    embeds: [finalEmbed], 
                    components: row ? [row] : [] 
                });
            } catch (err) { console.log(err); }
        }

        if (isMulticount) {
            return res.send('<h1>Oczekiwanie na decyzję administratora...</h1>');
        }

        // Jeśli nie multikonto - nadaj rolę
        db.ips[cleanIP] = userId;
        fs.writeFileSync(DB_FILE, JSON.stringify(db));
        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(userId);
        await member.roles.add(ROLE_ID);
        res.send('<h1>Sukces! Rola nadana.</h1>');

    } catch (error) { res.status(500).send('Błąd serwera.'); }
});

// OBSŁUGA PRZYCISKÓW
client.on('interactionCreate', async (int) => {
    if (!int.isButton()) return;
    const [action, targetId] = int.customId.split('_');
    const guild = await client.guilds.fetch(GUILD_ID);

    try {
        const member = await guild.members.fetch(targetId);
        if (action === 'allow') {
            await member.roles.add(ROLE_ID);
            await disableButtons(int, `✅ **ZAAKCEPTOWANO** przez ${int.user.tag}. Gracz <@${targetId}> otrzymał rolę.`);
        } else {
            await member.ban({ reason: 'Multikonto - decyzja admina' });
            await disableButtons(int, `🚫 **ZBANOWANO** przez ${int.user.tag}. Gracz <@${targetId}> został usunięty.`);
        }
    } catch (e) { 
        await int.reply({ content: "Błąd: Użytkownik mógł już opuścić serwer.", ephemeral: true });
    }
});

client.login(BOT_TOKEN);
app.listen(process.env.PORT || 3000);
