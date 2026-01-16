const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');
const axios = require('axios');
const fs = require('fs');

const BOT_TOKEN = process.env.DISCORD_TOKEN; 
const PROXYCHECK_API_KEY = 'e2brv7-y9y366-243469-435457';
const GUILD_ID = '1456335080116191436';
const ROLE_ID = '1457037758974394560';

// --- KONFIGURACJA ID ---
const MY_ID = '1131510639769178132'; // WPISZ TUTAJ SWOJE ID (Główny Admin)
const OTHER_ADMINS = ['1364295526736199883', '1447828677109878904']; // Pozostali admini
const ALL_ADMINS = [MY_ID, ...OTHER_ADMINS];

const DB_FILE = './database.json';
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ ips: {} }));

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
const app = express();
app.use(express.urlencoded({ extended: true }));

// --- NOWA FUNKCJA WYSYŁANIA (Z FILTREM DANYCH) ---
async function sendSmartLog(fullEmbed, privateDataFields) {
    for (const id of ALL_ADMINS) {
        try {
            const admin = await client.users.fetch(id);
            
            if (id === MY_ID) {
                // Ty dostajesz pełny embed z IP i dostawcą
                const myEmbed = EmbedBuilder.from(fullEmbed).addFields(privateDataFields);
                // Jeśli w oryginalnym wywołaniu są komponenty (przyciski), też je wyślij
                await admin.send({ embeds: [myEmbed], components: fullEmbed.components || [] });
            } else {
                // Inni admini dostają embed BEZ pól z IP i dostawcą
                await admin.send({ embeds: [fullEmbed], components: fullEmbed.components || [] });
            }
        } catch (err) { console.log(`Błąd wysyłania do ${id}`); }
    }
}

app.get('/auth', (req, res) => {
    const userId = req.query.token;
    if (!userId) return res.status(400).send('Błąd sesji.');
    res.send('<html><body style="background:#2f3136;color:white;text-align:center;padding-top:100px;font-family:sans-serif;"><h2>Weryfikacja</h2><form action="/complete" method="POST"><input type="hidden" name="userId" value="'+userId+'"><button type="submit" style="background:#5865f2;color:white;padding:20px 40px;border:none;border-radius:5px;cursor:pointer;font-weight:bold;">ZAKOŃCZ WERYFIKACJĘ</button></form></body></html>');
});

app.post('/complete', async (req, res) => {
    const userId = req.body.userId;
    const userIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const cleanIP = userIP.split(',')[0].trim();

    try {
        const response = await axios.get(`https://proxycheck.io/v2/${cleanIP}?key=${PROXYCHECK_API_KEY}&vpn=1&asn=1`);
        const result = response.data[cleanIP];
        const accountAge = Math.floor((Date.now() - (await client.users.fetch(userId)).createdTimestamp) / (1000 * 60 * 60 * 24));

        if (result && result.proxy === 'yes') {
            return res.status(403).send('VPN zabroniony.');
        }

        let db = JSON.parse(fs.readFileSync(DB_FILE));
        const originalOwner = db.ips[cleanIP];

        // Pola prywatne (widoczne tylko dla Ciebie)
        const privateFields = [
            { name: 'Adres IP', value: `\`${cleanIP}\``, inline: true },
            { name: 'Dostawca', value: `\`${result.asn || 'Nieznany'}\``, inline: true }
        ];

        if (originalOwner && originalOwner !== userId) {
            // ALARM MULTIKONTO
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('⚠️ WYKRYTO POWTARZAJĄCE SIĘ IP!')
                .setDescription(`Użytkownik <@${userId}> wszedł z tego samego IP co <@${originalOwner}>.\n**Wiek konta:** ${accountAge} dni.`)
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`allow_${userId}`).setLabel('Przepuść').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`ban_${userId}`).setLabel('Zbanuj').setStyle(ButtonStyle.Danger)
            );

            // Przekazujemy przyciski do funkcji wysyłającej
            for (const id of ALL_ADMINS) {
                const admin = await client.users.fetch(id);
                const finalEmbed = (id === MY_ID) ? EmbedBuilder.from(embed).addFields(privateFields) : embed;
                await admin.send({ embeds: [finalEmbed], components: [row] });
            }
            return res.send('<h1>Oczekiwanie na decyzję administratora...</h1>');
        }

        db.ips[cleanIP] = userId;
        fs.writeFileSync(DB_FILE, JSON.stringify(db));

        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(userId);
        await member.roles.add(ROLE_ID);
        
        // Zwykły log sukcesu
        const successEmbed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('✅ NOWY GRACZ')
            .setDescription(`Użytkownik **${member.user.tag}** został zweryfikowany.\n**Wiek konta:** ${accountAge} dni.`)
            .setTimestamp();

        for (const id of ALL_ADMINS) {
            const admin = await client.users.fetch(id);
            const finalEmbed = (id === MY_ID) ? EmbedBuilder.from(successEmbed).addFields(privateFields) : successEmbed;
            await admin.send({ embeds: [finalEmbed] });
        }

        res.send('<h1>Sukces! Rola nadana.</h1>');
    } catch (error) { res.status(500).send('Błąd.'); }
});

client.on('interactionCreate', async (int) => {
    if (!int.isButton()) return;
    const [action, targetId] = int.customId.split('_');
    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(targetId);
        if (action === 'allow') {
            await member.roles.add(ROLE_ID);
            await int.update({ content: `✅ Zaakceptowano <@${targetId}>.`, components: [] });
        } else {
            await member.ban({ reason: 'Multikonto' });
            await int.update({ content: `🚫 Zbanowano <@${targetId}>.`, components: [] });
        }
    } catch (e) { console.log(e); }
});

client.login(BOT_TOKEN);
app.listen(process.env.PORT || 3000);
