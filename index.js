const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');

// --- KONFIGURACJA ---
const BOT_TOKEN = process.env.DISCORD_TOKEN; 
const MONGO_URI = process.env.MONGO_URI; 
const PROXYCHECK_API_KEY = 'e2brv7-y9y366-243469-435457';
const GUILD_ID = '1464901079593521322';
const ROLE_ID = '1473060746194845959';
const MY_ID = '1131510639769178132'; 
const ALL_ADMINS = [MY_ID, '1276586330847051780', '1210653947061080175'];

mongoose.connect(MONGO_URI).then(() => console.log("✅ Baza danych aktywna"));

const UserIP = mongoose.model('UserIP', new mongoose.Schema({ userId: String, ip: String, fingerprint: String, country: String, operator: String }));
const RequestTracker = mongoose.model('RequestTracker', new mongoose.Schema({ userId: String, status: { type: String, default: 'pending' } }));

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.DirectMessages] });
const app = express();
app.use(express.json());

// --- FUNKCJA WYSYŁANIA LOGÓW ---
async function sendAdminLogs(targetId, ip, country, operator, type, adminTag = null) {
    const myLog = new EmbedBuilder()
        .setColor(type.includes('RĘCZNA') ? '#43b581' : '#5865f2')
        .setTitle(`📢 LOG WERYFIKACJI: ${type}`)
        .addFields(
            { name: '👤 Użytkownik', value: `<@${targetId}>`, inline: true },
            { name: '🌍 Kraj', value: country, inline: true },
            { name: '🏢 ISP', value: `\`${operator}\``, inline: true },
            { name: '🔍 IP', value: `\`${ip}\``, inline: false }
        )
        .setTimestamp();

    const adminLog = new EmbedBuilder()
        .setColor(type.includes('RĘCZNA') ? '#43b581' : '#5865f2')
        .setTitle(`📢 LOG WERYFIKACJI: ${type}`)
        .addFields(
            { name: '👤 Użytkownik', value: `<@${targetId}>`, inline: true },
            { name: '🌍 Kraj', value: country, inline: true },
            { name: '🏢 ISP', value: `\`UKRYTE\``, inline: true }
        )
        .setFooter({ text: 'Pełne dane dostępne tylko dla Głównego Admina' })
        .setTimestamp();

    for (const id of ALL_ADMINS) {
        try {
            const admin = await client.users.fetch(id);
            await admin.send({ embeds: [(id === MY_ID) ? myLog : adminLog] });
        } catch (e) { console.log(`Nie udało się wysłać loga do ${id}`); }
    }
}

// --- LOGIKA WERYFIKACJI ---
app.post('/complete', async (req, res) => {
    const { userId, fp } = req.body;
    const cleanIP = (req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim();

    try {
        const response = await axios.get(`https://proxycheck.io/v2/${cleanIP}?key=${PROXYCHECK_API_KEY}&vpn=3&asn=1`);
        const result = response.data[cleanIP];
        const country = result.isocode || '??';
        const operator = result.asn || 'Nieznany';

        // Fingerprint Check
        const duplicateFP = await UserIP.findOne({ fingerprint: fp, userId: { $ne: userId } });
        if (duplicateFP) return res.json({ action: 'error', msg: 'Zabezpieczenie: To urządzenie jest już powiązane z innym kontem.' });

        // Podejrzane IP (Kraj lub inne konto na tym IP)
        const existingIP = await UserIP.findOne({ ip: cleanIP });
        if (country !== 'PL' || (existingIP && existingIP.userId !== userId)) {
            await RequestTracker.findOneAndUpdate({ userId }, { status: 'pending' }, { upsert: true });
            // Powiadomienie adminów o potrzebie akceptacji
            await sendAdminLogs(userId, cleanIP, country, operator, "WYMAGA AKCEPTACJI ⚠️");
            return res.json({ action: 'wait' });
        }

        // Automatyczny sukces
        await new UserIP({ userId, ip: cleanIP, fingerprint: fp, country, operator }).save();
        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(userId);
        await member.roles.add(ROLE_ID);
        
        await sendAdminLogs(userId, cleanIP, country, operator, "AUTOMATYCZNA ✅");
        res.json({ action: 'success' });

    } catch (e) { res.json({ action: 'error', msg: 'Błąd połączenia z API.' }); }
});

app.get('/auth', (req, res) => {
    // Tutaj wklej ten ładny kod HTML z Glassmorphismem, który Ci dałem wcześniej
});

client.login(BOT_TOKEN);
app.listen(process.env.PORT || 3000);
