const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');
const axios = require('axios');
const fs = require('fs');

// --- KONFIGURACJA ---
const BOT_TOKEN = process.env.DISCORD_TOKEN; 
const PROXYCHECK_API_KEY = 'e2brv7-y9y366-243469-435457';
const GUILD_ID = '1456335080116191436';
const ROLE_ID = '1461789323262296084';

// --- TWOJA KONFIGURACJA ID ---
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

// Funkcja usuwająca przyciski po akcji
async function disableButtons(interaction, text) {
    try {
        await interaction.update({ content: text, components: [], embeds: interaction.message.embeds });
    } catch (e) { console.log("Błąd aktualizacji przycisków."); }
}

// Komenda !baza
client.on('messageCreate', async (msg) => {
    if (msg.content === '!baza' && msg.author.id === MY_ID) {
        if (fs.existsSync(DB_FILE)) {
            await msg.author.send({ content: '📊 Aktualna baza IP:', files: [DB_FILE] });
            await msg.reply('✅ Wysłano bazę na PW.');
        }
    }
});

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
        const response = await axios.get(`https://proxycheck.io/v2/${cleanIP}?key=${PROXYCHECK_API_KEY}&vpn=3&asn=1`);
        const result = response.data[cleanIP];
        const country = result.isocode || '??';
        
        const user = await client.users.fetch(userId);
        const accountAge = Math.floor((Date.now() - user.createdTimestamp) / (1000 * 60 * 60 * 24));

        let db = JSON.parse(fs.readFileSync(DB_FILE));
        const originalOwner = db.ips[cleanIP];

        const isVPN = result.proxy === 'yes';
        const isForeign = country !== 'PL'; 
        const isMulticount = originalOwner && originalOwner !== userId;

        // Jeśli VPN wykryty przez bazę - blokuj
        if (isVPN) return res.status(403).send('VPN jest zabroniony.');

        // Jeśli multikonto LUB inny kraj (np. Turcja) - wyślij panel
        if (isMulticount || isForeign) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle(isMulticount ? '⚠️ ALARM: POWTARZAJĄCE SIĘ IP' : '🌍 PODEJRZANY KRAJ / VPN')
                .setDescription(`Gracz: <@${userId}>\n**Kraj:** ${country}\n**Wiek konta:** ${accountAge} dni.`)
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`allow_${userId}`).setLabel('Przepuść').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`ban_${userId}`).setLabel('Zbanuj').setStyle(ButtonStyle.Danger)
            );

            for (const id of ALL_ADMINS) {
                const admin = await client.users.fetch(id);
                const finalEmbed = EmbedBuilder.from(embed);
                if (id === MY_ID) {
                    finalEmbed.addFields(
                        { name: 'Adres IP', value: `\`${cleanIP}\``, inline: true },
                        { name: 'Dostawca', value: `\`${result.asn || 'Nieznany'}\``, inline: true }
                    );
                }
                await admin.send({ embeds: [finalEmbed], components: [row] });
            }
            return res.send('<h1>Weryfikacja oczekuje na sprawdzenie przez admina.</h1>');
        }

        // Sukces (Polska i nowe IP)
        db.ips[cleanIP] = userId;
        fs.writeFileSync(DB_FILE, JSON.stringify(db));
        
        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(userId);
        await member.roles.add(ROLE_ID);
        
        const myAdmin = await client.users.fetch(MY_ID);
        await myAdmin.send(`✅ **NOWY GRACZ:** **${user.tag}** (PL | \`${cleanIP}\`)`);

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
            await disableButtons(int, `✅ **ZAAKCEPTOWANO** <@${targetId}>.`);
        } else {
            await member.ban({ reason: 'Multikonto/VPN' });
            await disableButtons(int, `🚫 **ZBANOWANO** <@${targetId}>.`);
        }
    } catch (e) { console.log("Błąd."); }
});

client.login(BOT_TOKEN);
app.listen(process.env.PORT || 3000);
