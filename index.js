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

// Połączenie z bazą danych
mongoose.connect(MONGO_URI).then(() => console.log("✅ Baza danych aktywna"));

const UserIP = mongoose.model('UserIP', new mongoose.Schema({ userId: String, ip: String, fingerprint: String, country: String, operator: String }));
const RequestTracker = mongoose.model('RequestTracker', new mongoose.Schema({ userId: String, status: { type: String, default: 'pending' } }));

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.DirectMessages] });
const app = express();
app.use(express.json());

// --- STRONA GŁÓWNA (Naprawia Cannot GET /) ---
app.get('/', (req, res) => {
    res.send('<body style="background:#0d0d12;color:white;display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;margin:0;"><div><h1 style="text-align:center;">🛡️ Night RP Security</h1><p style="color:#8e8e9e;">System operacyjny i aktywny.</p></div></body>');
});

// --- STRONA WERYFIKACJI ---
app.get('/auth', (req, res) => {
    const userId = req.query.token;
    res.send(`
        <!DOCTYPE html>
        <html lang="pl">
        <head>
            <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Night RP | Security</title>
            <style>
                body { margin: 0; padding: 0; font-family: sans-serif; background: #0d0d12 url('https://i.imgur.com/G3P2Q8f.png') no-repeat center center fixed; background-size: cover; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                .card { background: rgba(15, 15, 26, 0.85); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.1); padding: 50px; border-radius: 30px; text-align: center; max-width: 400px; width: 90%; box-shadow: 0 25px 50px rgba(0,0,0,0.5); color: white; }
                .btn { background: #5865f2; color: white; padding: 16px; border: none; border-radius: 14px; cursor: pointer; font-size: 16px; font-weight: bold; width: 100%; transition: 0.3s; margin-top: 20px; }
                .btn:hover { background: #4752c4; transform: translateY(-2px); }
                .spinner { width: 40px; height: 40px; border: 4px solid rgba(255,255,255,0.1); border-top: 4px solid #5865f2; border-radius: 50%; animation: spin 1s linear infinite; margin: 20px auto; display: none; }
                @keyframes spin { to { transform: rotate(360deg); } }
            </style>
        </head>
        <body>
            <div class="card" id="box">
                <h1>🛡️ Weryfikacja</h1>
                <p style="color:#b9bbbe;">System Night RP sprawdza Twoje połączenie.</p>
                <div class="spinner" id="loader"></div>
                <button class="btn" id="startBtn">AUTORYZUJ DOSTĘP</button>
            </div>
            <script>
                document.getElementById('startBtn').onclick = async () => {
                    const btn = document.getElementById('startBtn');
                    const loader = document.getElementById('loader');
                    btn.style.display = 'none'; loader.style.display = 'block';

                    const r = await fetch('/complete', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ userId: '${userId}', fp: btoa(navigator.userAgent) })
                    });
                    const d = await r.json();

                    if(d.action === 'success') {
                        document.getElementById('box').innerHTML = '<h1 style="color:#43b581;">✅ Sukces</h1><p>Możesz wrócić na Discorda.</p>';
                    } else if(d.action === 'wait') {
                        document.getElementById('box').innerHTML = '<h1 style="color:#faa61a;">⏳ Oczekiwanie</h1><p>Twoje IP wymaga akceptacji Admina. Czekaj na tej stronie...</p>';
                        setInterval(async () => {
                            const res = await fetch('/status?userId=${userId}');
                            const s = await res.json();
                            if(s.status === 'allowed') location.reload();
                        }, 4000);
                    } else {
                        document.getElementById('box').innerHTML = '<h1 style="color:#f04747;">❌ Błąd</h1><p>' + d.msg + '</p><button class="btn" onclick="location.reload()">SPRÓBUJ PONOWNIE</button>';
                    }
                };
            </script>
        </body>
        </html>
    `);
});

// --- STATUS DLA STRONY ---
app.get('/status', async (req, res) => {
    const doc = await RequestTracker.findOne({ userId: req.query.userId });
    res.json({ status: doc ? doc.status : 'pending' });
});

// --- FUNKCJA WYSYŁANIA LOGÓW Z PRZYCISKAMI ---
async function sendAdminLogs(targetId, ip, country, operator, type) {
    const embed = new EmbedBuilder()
        .setColor(type.includes('⚠️') ? '#faa61a' : '#43b581')
        .setTitle(`📢 LOG WERYFIKACJI: ${type}`)
        .addFields(
            { name: '👤 Użytkownik', value: `<@${targetId}>`, inline: true },
            { name: '🌍 Kraj', value: country, inline: true },
            { name: '🏢 Operator', value: `\`${operator}\``, inline: true },
            { name: '🔍 IP', value: `\`${ip}\``, inline: false }
        ).setTimestamp();

    const components = [];
    if (type.includes('⚠️')) {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`accept_${targetId}`).setLabel('AKCEPTUJ ✅').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`reject_${targetId}`).setLabel('ODRZUĆ ❌').setStyle(ButtonStyle.Danger)
        );
        components.push(row);
    }

    for (const id of ALL_ADMINS) {
        try {
            const admin = await client.users.fetch(id);
            await admin.send({ embeds: [embed], components: components });
        } catch (e) {}
    }
}

// --- OBSŁUGA PRZYCISKÓW AKCEPTACJI ---
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    const [action, targetId] = interaction.customId.split('_');

    if (action === 'accept') {
        await RequestTracker.findOneAndUpdate({ userId: targetId }, { status: 'allowed' });
        try {
            const guild = await client.guilds.fetch(GUILD_ID);
            const member = await guild.members.fetch(targetId);
            await member.roles.add(ROLE_ID);
            await interaction.reply({ content: `✅ Zaakceptowano <@${targetId}>. Rola nadana!`, ephemeral: true });
        } catch (e) {
            await interaction.reply({ content: `❌ Błąd nadawania roli. Sprawdź uprawnienia bota.`, ephemeral: true });
        }
    }
    if (action === 'reject') {
        await RequestTracker.deleteOne({ userId: targetId });
        await interaction.reply({ content: `❌ Odrzucono prośbę użytkownika <@${targetId}>.`, ephemeral: true });
    }
});

// --- LOGIKA WERYFIKACJI ---
app.post('/complete', async (req, res) => {
    const { userId, fp } = req.body;
    const cleanIP = (req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim();

    try {
        const response = await axios.get(`https://proxycheck.io/v2/${cleanIP}?key=${PROXYCHECK_API_KEY}&vpn=3&asn=1`);
        const result = response.data[cleanIP];
        const country = result.isocode || '??';
        const operator = result.asn || 'Nieznany';

        const duplicateFP = await UserIP.findOne({ fingerprint: fp, userId: { $ne: userId } });
        if (duplicateFP) return res.json({ action: 'error', msg: 'Wykryto zmianę konta na tym samym urządzeniu.' });

        const existingIP = await UserIP.findOne({ ip: cleanIP });
        if (country !== 'PL' || (existingIP && existingIP.userId !== userId)) {
            await RequestTracker.findOneAndUpdate({ userId }, { status: 'pending' }, { upsert: true });
            await sendAdminLogs(userId, cleanIP, country, operator, "WYMAGA AKCEPTACJI ⚠️");
            return res.json({ action: 'wait' });
        }

        await new UserIP({ userId, ip: cleanIP, fingerprint: fp, country, operator }).save();
        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(userId);
        await member.roles.add(ROLE_ID);
        
        await sendAdminLogs(userId, cleanIP, country, operator, "AUTOMATYCZNA ✅");
        res.json({ action: 'success' });
    } catch (e) { res.json({ action: 'error', msg: 'Błąd systemu.' }); }
});

client.login(BOT_TOKEN);
app.listen(process.env.PORT || 3000, () => console.log("🚀 Serwer działa!"));
