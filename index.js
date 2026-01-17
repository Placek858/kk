const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');

// --- KONFIGURACJA ---
const BOT_TOKEN = process.env.DISCORD_TOKEN; 
const MONGO_URI = process.env.MONGO_URI; 
const PROXYCHECK_API_KEY = 'e2brv7-y9y366-243469-435457';
const GUILD_ID = '1456335080116191436';
const ROLE_ID = '1461789323262296084';

const MY_ID = '1131510639769178132'; 
const OTHER_ADMINS = ['1364295526736199883', '1447828677109878904']; 
const ALL_ADMINS = [MY_ID, ...OTHER_ADMINS];

mongoose.connect(MONGO_URI).then(() => console.log("✅ Połączono z MongoDB Atlas"));

// Modele danych
const UserSchema = new mongoose.Schema({ userId: String, ip: String, country: String });
const UserIP = mongoose.model('UserIP', UserSchema);

// Nowy model do śledzenia wysłanych paneli
const PanelSchema = new mongoose.Schema({
    targetId: String,
    adminMessages: [{ adminId: String, messageId: String }]
});
const PanelTracker = mongoose.model('PanelTracker', PanelSchema);

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const app = express();
app.use(express.urlencoded({ extended: true }));

// --- FUNKCJA BLOKUJĄCA PRZYCISKI U WSZYSTKICH ---
async function clearAllPanels(targetId, actionText) {
    const panel = await PanelTracker.findOne({ targetId });
    if (!panel) return;

    for (const entry of panel.adminMessages) {
        try {
            const admin = await client.users.fetch(entry.adminId);
            const message = await admin.dmChannel.messages.fetch(entry.messageId);
            // Edytujemy wiadomość usuwając przyciski i dodając info kto co zrobił
            await message.edit({ content: `**ZAKOŃCZONO:** ${actionText}`, components: [] });
        } catch (e) { /* Pomijamy błędy jeśli wiadomość usunięta */ }
    }
    await PanelTracker.deleteOne({ targetId }); // Czyścimy bazę trackerów
}

app.get('/auth', (req, res) => {
    const userId = req.query.token;
    res.send(`<html><body style="background:#2f3136;color:white;text-align:center;padding-top:100px;font-family:sans-serif;"><h2>🛡️ Weryfikacja</h2><form action="/complete" method="POST"><input type="hidden" name="userId" value="${userId}"><button type="submit" style="background:#5865f2;color:white;padding:20px 40px;border:none;border-radius:5px;cursor:pointer;font-weight:bold;">ZWERYFIKUJ</button></form></body></html>`);
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
        
        const existingEntry = await UserIP.findOne({ ip: cleanIP });
        const isVPN = result.proxy === 'yes';
        const isForeign = country !== 'PL'; 
        const isMulticount = existingEntry && existingEntry.userId !== userId;

        if (isVPN) return res.status(403).send('VPN zabroniony.');

        if (isMulticount || isForeign) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle(isMulticount ? '⚠️ ALARM: POWTARZAJĄCE SIĘ IP' : '🌍 PODEJRZANY KRAJ / VPN')
                .setDescription(`Gracz: <@${userId}>\nKraj: ${country}`)
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`allow_${userId}_${cleanIP}_${country}`).setLabel('Przepuść').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`ban_${userId}`).setLabel('Zbanuj').setStyle(ButtonStyle.Danger)
            );

            const adminMsgs = [];
            for (const id of ALL_ADMINS) {
                const admin = await client.users.fetch(id);
                const fEmbed = EmbedBuilder.from(embed);
                if (id === MY_ID) fEmbed.addFields({ name: 'IP', value: `\`${cleanIP}\`` });
                
                const msg = await admin.send({ embeds: [fEmbed], components: [row] });
                adminMsgs.push({ adminId: id, messageId: msg.id });
            }

            // Zapisujemy ID wiadomości, żeby móc je potem edytować
            await new PanelTracker({ targetId: userId, adminMessages: adminMsgs }).save();
            return res.send('<h1>Oczekiwanie na decyzję administratora...</h1>');
        }

        await new UserIP({ userId, ip: cleanIP, country }).save();
        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(userId);
        await member.roles.add(ROLE_ID);
        res.send('<h1>Weryfikacja udana!</h1>');
    } catch (e) { res.status(500).send('Błąd.'); }
});

client.on('interactionCreate', async (int) => {
    if (!int.isButton()) return;
    const [action, targetId, ip, country] = int.customId.split('_');
    const guild = await client.guilds.fetch(GUILD_ID);

    try {
        if (action === 'allow') {
            const member = await guild.members.fetch(targetId);
            await member.roles.add(ROLE_ID);
            if (ip) await new UserIP({ userId: targetId, ip, country }).save();
            await clearAllPanels(targetId, `✅ Zaakceptowano przez **${int.user.tag}**`);
        } else {
            await guild.members.ban(targetId, { reason: 'Decyzja administratora' });
            await clearAllPanels(targetId, `🚫 Zbanowano przez **${int.user.tag}**`);
        }
    } catch (e) {
        await int.reply({ content: "Nie można wykonać akcji (użytkownik wyszedł lub brak uprawnień).", ephemeral: true });
    }
});

client.login(BOT_TOKEN);
app.listen(process.env.PORT || 3000);
