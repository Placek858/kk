const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');
const axios = require('axios');
const fs = require('fs');

const BOT_TOKEN = process.env.DISCORD_TOKEN; 
const PROXYCHECK_API_KEY = 'e2brv7-y9y366-243469-435457';
const GUILD_ID = '1456335080116191436';
const ROLE_ID = '1461789323262296084';
const ADMIN_IDS = ['1364295526736199883', '1447828677109878904', '1131510639769178132'];

const DB_FILE = './database.json';
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ ips: {} }));

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
const app = express();
app.use(express.urlencoded({ extended: true }));

async function sendToAdmins(content) {
    for (const id of ADMIN_IDS) {
        try {
            const admin = await client.users.fetch(id);
            await admin.send(content);
        } catch (err) { console.log("Błąd wysyłania do admina."); }
    }
}

// NAPRAWIONA ŚCIEŻKA /auth
app.get('/auth', (req, res) => {
    const userId = req.query.token;
    if (!userId) return res.status(400).send('Brak tokenu użytkownika.');
    
    res.send(`
        <html>
        <head><meta charset="utf-8"></head>
        <body style="background:#2f3136;color:white;text-align:center;padding-top:100px;font-family:sans-serif;">
            <div style="background:#36393f;display:inline-block;padding:50px;border-radius:10px;">
                <h2>🛡️ Weryfikacja Anty-Bot</h2>
                <p>Kliknij przycisk, aby potwierdzić, że nie jesteś robotem i nie używasz multikonta.</p>
                <form action="/complete" method="POST">
                    <input type="hidden" name="userId" value="${userId}">
                    <button type="submit" style="background:#5865f2;color:white;padding:20px 40px;border:none;border-radius:5px;cursor:pointer;font-size:18px;font-weight:bold;">ZWERYFIKUJ MNIE</button>
                </form>
            </div>
        </body>
        </html>
    `);
});

app.post('/complete', async (req, res) => {
    const userId = req.body.userId;
    const userIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const cleanIP = userIP.split(',')[0].trim();

    try {
        const response = await axios.get(`https://proxycheck.io/v2/${cleanIP}?key=${PROXYCHECK_API_KEY}&vpn=1&asn=1`);
        const result = response.data[cleanIP];

        if (result && result.proxy === 'yes') {
            await sendToAdmins(`❌ **ZABLOKOWANO VPN:** <@${userId}> próbował wejść przez proxy/VPN (${cleanIP}).`);
            return res.status(403).send('Używanie VPN jest zabronione.');
        }

        let db = JSON.parse(fs.readFileSync(DB_FILE));
        const originalOwner = db.ips[cleanIP];

        // PANEL DECYZYJNY DLA ADMINA (Zawsze wysyła log z IP)
        const embed = new EmbedBuilder()
            .setTimestamp()
            .setFooter({ text: 'System detekcji IP' });

        if (originalOwner && originalOwner !== userId) {
            embed.setColor('#ff0000')
                 .setTitle('⚠️ WYKRYTO POWTARZAJĄCE SIĘ IP!')
                 .setDescription(`Użytkownik <@${userId}> ma to samo IP co <@${originalOwner}>!`)
                 .addFields(
                    { name: 'Adres IP', value: `\`${cleanIP}\``, inline: true },
                    { name: 'Dostawca', value: `\`${result.asn || 'Nieznany'}\``, inline: true }
                 );

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`allow_${userId}`).setLabel('Przepuść mimo to').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`ban_${userId}`).setLabel('Zablokuj multikonto').setStyle(ButtonStyle.Danger)
            );

            await sendToAdmins({ embeds: [embed], components: [row] });
            return res.send('<h1>Wykryto powiązanie IP. Czekaj na zatwierdzenie przez admina...</h1>');
        }

        // Jeśli IP jest nowe:
        db.ips[cleanIP] = userId;
        fs.writeFileSync(DB_FILE, JSON.stringify(db));

        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(userId);
        await member.roles.add(ROLE_ID);
        
        embed.setColor('#00ff00')
             .setTitle('✅ NOWA WERYFIKACJA')
             .setDescription(`Użytkownik **${member.user.tag}** pomyślnie dołączył.`)
             .addFields(
                { name: 'Adres IP', value: `\`${cleanIP}\``, inline: true },
                { name: 'Dostawca', value: `\`${result.asn || 'Nieznany'}\``, inline: true }
             );

        await sendToAdmins({ embeds: [embed] });
        res.send('<h1>Weryfikacja udana! Rola została nadana.</h1>');

    } catch (error) { res.status(500).send('Błąd serwera.'); }
});

client.on('interactionCreate', async (int) => {
    if (!int.isButton()) return;
    const [action, targetId] = int.customId.split('_');
    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(targetId);
        if (action === 'allow') {
            await member.roles.add(ROLE_ID);
            await int.update({ content: `✅ **Zaakceptowano** <@${targetId}> przez ${int.user.tag}`, components: [], embeds: int.message.embeds });
        } else {
            await member.ban({ reason: 'Multikonto / Decyzja admina' });
            await int.update({ content: `🚫 **Zbanowano** <@${targetId}> przez ${int.user.tag}`, components: [], embeds: int.message.embeds });
        }
    } catch (e) { await int.reply({ content: 'Błąd: Użytkownik mógł wyjść z serwera.', ephemeral: true }); }
});

client.login(BOT_TOKEN);
app.listen(process.env.PORT || 3000);
