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
const ALL_ADMINS = [MY_ID, '1364295526736199883', '1447828677109878904'];

mongoose.connect(MONGO_URI).then(() => console.log("✅ Połączono z MongoDB Atlas"));

const UserIP = mongoose.model('UserIP', new mongoose.Schema({ userId: String, ip: String, country: String }));
const PanelTracker = mongoose.model('PanelTracker', new mongoose.Schema({ targetId: String, adminMessages: [{ adminId: String, messageId: String }] }));
const RequestTracker = mongoose.model('RequestTracker', new mongoose.Schema({ userId: String, status: { type: String, default: 'pending' } }));

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const app = express();
app.use(express.urlencoded({ extended: true }));

// --- FUNKCJA WYSYŁAJĄCA LOGI NA PV DO ADMINÓW ---
async function sendAdminLogs(targetId, ip, country, type, adminTag = null) {
    const guild = await client.guilds.fetch(GUILD_ID);
    
    // Embed dla Ciebie (Z IP)
    const myLog = new EmbedBuilder()
        .setColor(type.includes('RĘCZNA') ? '#43b581' : '#5865f2')
        .setTitle(`📢 LOG WERYFIKACJI: ${type}`)
        .setDescription(`**Użytkownik:** <@${targetId}>\n**Kraj:** ${country}\n**IP:** \`${ip}\`${adminTag ? `\n**Admin:** ${adminTag}` : ''}`)
        .setTimestamp();

    // Embed dla Adminów (BEZ IP)
    const adminLog = new EmbedBuilder()
        .setColor(type.includes('RĘCZNA') ? '#43b581' : '#5865f2')
        .setTitle(`📢 LOG WERYFIKACJI: ${type}`)
        .setDescription(`**Użytkownik:** <@${targetId}>\n**Kraj:** ${country}\n**IP:** \`UKRYTE\`${adminTag ? `\n**Admin:** ${adminTag}` : ''}`)
        .setTimestamp();

    for (const id of ALL_ADMINS) {
        try {
            const admin = await client.users.fetch(id);
            const embedToSend = (id === MY_ID) ? myLog : adminLog;
            await admin.send({ embeds: [embedToSend] });
        } catch (e) { console.log(`Nie można wysłać loga do admina ${id}`); }
    }
}

// --- AKTUALIZACJA STATUSU ---
async function updateLiveStatus(targetId, newStatus, actionText) {
    await RequestTracker.findOneAndUpdate({ userId: targetId }, { status: newStatus }, { upsert: true });
    const panel = await PanelTracker.findOne({ targetId });
    if (!panel) return;

    for (const entry of panel.adminMessages) {
        try {
            const admin = await client.users.fetch(entry.adminId);
            const message = await admin.dmChannel.messages.fetch(entry.messageId);
            await message.edit({ content: `**ZAKOŃCZONO:** ${actionText}`, components: [] });
        } catch (e) { console.log("Błąd edycji panelu."); }
    }
    await PanelTracker.deleteOne({ targetId });
}

// --- STRONA WWW ---
app.get('/auth', (req, res) => {
    const userId = req.query.token;
    res.send(`
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Weryfikacja Konta</title>
            <style>
                :root { --discord-blurple: #5865f2; --success: #43b581; --warning: #faa61a; --danger: #f04747; }
                body { margin: 0; padding: 0; font-family: 'Segoe UI', sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: linear-gradient(-45deg, #0f0c29, #302b63, #24243e, #1a1a2e); background-size: 400% 400%; animation: gradientBG 12s ease infinite; }
                @keyframes gradientBG { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
                .box { background: rgba(44, 47, 51, 0.7); backdrop-filter: blur(12px); padding: 60px 40px; border-radius: 24px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); max-width: 420px; width: 85%; text-align: center; border: 1px solid rgba(255,255,255,0.1); }
                h2 { margin: 0; font-size: 32px; color: white; }
                p { color: #dcddde; margin-bottom: 35px; }
                button { background: var(--discord-blurple); color: white; padding: 18px 0; border: none; border-radius: 12px; cursor: pointer; font-weight: 800; width: 100%; transition: 0.3s; }
                button:hover { background: #4752c4; transform: translateY(-3px); }
                .spinner { width: 50px; height: 50px; border: 5px solid rgba(255,255,255,0.1); border-top: 5px solid white; border-radius: 50%; animation: spin 1s linear infinite; margin: 20px auto; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            </style>
        </head>
        <body>
            <div class="box">
                <div id="content">
                    <h2 style="font-size: 60px;">🛡️</h2>
                    <h2>WERYFIKACJA</h2>
                    <p>Potwierdź swoją tożsamość, aby odblokować dostęp.</p>
                    <button id="vBtn">ROZPOCZNIJ</button>
                </div>
            </div>
            <script>
                document.getElementById('vBtn').onclick = async () => {
                    document.getElementById('content').innerHTML = '<div class="spinner"></div><h3 style="color:white">ANALIZA...</h3>';
                    const r = await fetch('/complete', { method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: 'userId=${userId}' });
                    const d = await r.json();
                    if (d.action === 'wait') {
                        document.getElementById('content').innerHTML = '<h3>⏳ RĘCZNA KONTROLA</h3><p style="color:white">Twoje połączenie wymaga akceptacji admina. Nie zamykaj tej karty.</p>';
                        startPolling('${userId}');
                    } else if (d.action === 'success') {
                        document.getElementById('content').innerHTML = '<h2 style="color:#43b581">✅ SUKCES!</h2><p style="color:white">Możesz wrócić na Discorda.</p>';
                    } else {
                        document.getElementById('content').innerHTML = '<h2 style="color:#f04747">❌ BŁĄD</h2><p style="color:white">' + d.msg + '</p>';
                    }
                };
                function startPolling(uid) {
                    setInterval(async () => {
                        const r = await fetch('/status?userId=' + uid);
                        const s = await r.json();
                        if (s.status === 'allowed') location.reload();
                    }, 3000);
                }
            </script>
        </body>
        </html>
    `);
});

// --- API ---
app.get('/status', async (req, res) => {
    const track = await RequestTracker.findOne({ userId: req.query.userId });
    res.set('Access-Control-Allow-Origin', '*');
    res.json({ status: track ? track.status : 'pending' });
});

app.post('/complete', async (req, res) => {
    const userId = req.body.userId;
    const userIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const cleanIP = userIP.split(',')[0].trim();

    try {
        const response = await axios.get(`https://proxycheck.io/v2/${cleanIP}?key=${PROXYCHECK_API_KEY}&vpn=3&asn=1`);
        const result = response.data[cleanIP];
        const country = result.isocode || '??';
        
        const existingEntry = await UserIP.findOne({ ip: cleanIP });
        const isVPN = result.proxy === 'yes';
        const isForeign = country !== 'PL'; 
        const isMulticount = existingEntry && existingEntry.userId !== userId;

        if (isVPN) return res.json({ action: 'error', msg: 'Używanie VPN jest zabronione.' });

        if (isMulticount || isForeign) {
            await RequestTracker.findOneAndUpdate({ userId }, { status: 'pending' }, { upsert: true });
            
            // Embed dla Ciebie (Z IP)
            const myEmbed = new EmbedBuilder().setColor('#ffaa00').setTitle('⚠️ PODEJRZANE IP (TY)').setDescription(`Użytkownik: <@${userId}>\nKraj: ${country}\nIP: \`${cleanIP}\`\nPowód: ${isForeign ? 'Zagranica' : 'Multikonto'}`);
            // Embed dla Adminów (BEZ IP)
            const adminEmbed = new EmbedBuilder().setColor('#ffaa00').setTitle('⚠️ PODEJRZANE IP').setDescription(`Użytkownik: <@${userId}>\nKraj: ${country}\nIP: \`UKRYTE\`\nPowód: ${isForeign ? 'Zagranica' : 'Multikonto'}`);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`allow_${userId}_${cleanIP}_${country}`).setLabel('Przepuść').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`ban_${userId}`).setLabel('Zablokuj').setStyle(ButtonStyle.Danger)
            );

            const adminMsgs = [];
            for (const id of ALL_ADMINS) {
                try {
                    const admin = await client.users.fetch(id);
                    const msg = await admin.send({ embeds: [(id === MY_ID) ? myEmbed : adminEmbed], components: [row] });
                    adminMsgs.push({ adminId: id, messageId: msg.id });
                } catch(err) {}
            }
            await new PanelTracker({ targetId: userId, adminMessages: adminMsgs }).save();
            return res.json({ action: 'wait' });
        }

        // --- AUTOMATYCZNY SUKCES ---
        await new UserIP({ userId, ip: cleanIP, country }).save();
        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(userId);
        await member.roles.add(ROLE_ID);
        
        // Logi na PV dla Ciebie i Adminów (z rozróżnieniem IP)
        await sendAdminLogs(userId, cleanIP, country, "AUTOMATYCZNA");

        res.json({ action: 'success' });
    } catch (e) { res.json({ action: 'error', msg: 'Błąd połączenia.' }); }
});

client.on('interactionCreate', async (int) => {
    if (!int.isButton()) return;
    const [action, targetId, ip, country] = int.customId.split('_');
    const guild = await client.guilds.fetch(GUILD_ID);

    try {
        if (action === 'allow') {
            const member = await guild.members.fetch(targetId);
            await member.roles.add(ROLE_ID);
            if (ip) await UserIP.findOneAndUpdate({ userId: targetId }, { ip, country }, { upsert: true });
            await updateLiveStatus(targetId, 'allowed', `✅ Zaakceptowano przez ${int.user.tag}`);
            
            // Logi na PV dla Ciebie i Adminów po ręcznej akceptacji
            await sendAdminLogs(targetId, ip, country, "RĘCZNA AKCEPTACJA", int.user.tag);

            // Embed powitalny dla użytkownika
            const welcome = new EmbedBuilder()
                .setColor('#43b581')
                .setTitle('✅ Zostałeś zweryfikowany!')
                .setDescription(`Witaj na **${guild.name}**! Uzyskałeś pełny dostęp do serwera.`)
                .setTimestamp();
            try { await member.send({ embeds: [welcome] }); } catch(e) {}

            await int.reply({ content: `Użytkownik wpuszczony.`, ephemeral: true });
        } else {
            await guild.members.ban(targetId, { reason: 'Odrzucono weryfikację' });
            await updateLiveStatus(targetId, 'banned', `🚫 Zbanowano przez ${int.user.tag}`);
            await int.reply({ content: `Użytkownik zbanowany.`, ephemeral: true });
        }
    } catch (e) { console.log("Błąd przycisku."); }
});

client.on('ready', () => { console.log(`🤖 Bot online: ${client.user.tag}`); });
client.login(BOT_TOKEN);
app.listen(process.env.PORT || 3000);
