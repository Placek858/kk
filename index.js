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

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ] 
});

const app = express();
app.use(express.urlencoded({ extended: true }));

// --- FUNKCJA WYSYŁAJĄCA LOGI NA PV ---
async function sendAdminLogs(targetId, ip, country, type, adminTag = null) {
    const myLog = new EmbedBuilder()
        .setColor(type.includes('RĘCZNA') ? '#43b581' : '#5865f2')
        .setTitle(`📢 LOG WERYFIKACJI: ${type}`)
        .setDescription(`**Użytkownik:** <@${targetId}>\n**Kraj:** ${country}\n**IP:** \`${ip}\`${adminTag ? `\n**Admin:** ${adminTag}` : ''}`)
        .setTimestamp();

    const adminLog = new EmbedBuilder()
        .setColor(type.includes('RĘCZNA') ? '#43b581' : '#5865f2')
        .setTitle(`📢 LOG WERYFIKACJI: ${type}`)
        .setDescription(`**Użytkownik:** <@${targetId}>\n**Kraj:** ${country}\n**IP:** \`UKRYTE\`${adminTag ? `\n**Admin:** ${adminTag}` : ''}`)
        .setTimestamp();

    for (const id of ALL_ADMINS) {
        try {
            const admin = await client.users.fetch(id);
            await admin.send({ embeds: [(id === MY_ID) ? myLog : adminLog] });
        } catch (e) { console.log(`Błąd wysyłania loga do ${id}`); }
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
            const msg = await admin.dmChannel.messages.fetch(entry.messageId);
            await msg.edit({ content: `**ZAKOŃCZONO:** ${actionText}`, components: [] });
        } catch (e) {}
    }
    await PanelTracker.deleteOne({ targetId });
}

// --- STRONA WWW ---
app.get('/auth', (req, res) => {
    const userId = req.query.token;
    res.send(`
        <html>
        <head>
            <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Weryfikacja</title>
            <style>
                body { margin: 0; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #1a1a2e; color: white; text-align: center; }
                .box { background: #2c2f33; padding: 40px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); max-width: 400px; }
                button { background: #5865f2; color: white; padding: 15px 30px; border: none; border-radius: 10px; cursor: pointer; font-weight: bold; width: 100%; }
                .spinner { width: 40px; height: 40px; border: 4px solid rgba(255,255,255,0.1); border-top: 4px solid white; border-radius: 50%; animation: spin 1s linear infinite; margin: 20px auto; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            </style>
        </head>
        <body>
            <div class="box" id="content">
                <h1>🛡️</h1><h2>Weryfikacja Konta</h2>
                <p>Kliknij przycisk, aby potwierdzić tożsamość.</p>
                <button id="vBtn">ZWERYFIKUJ</button>
            </div>
            <script>
                document.getElementById('vBtn').onclick = async () => {
                    document.getElementById('content').innerHTML = '<div class="spinner"></div><h3>Analiza...</h3>';
                    const r = await fetch('/complete', { method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: 'userId=${userId}' });
                    const d = await r.json();
                    if (d.action === 'wait') {
                        document.getElementById('content').innerHTML = '<h3>⏳ Oczekiwanie</h3><p>Admin musi Cię zaakceptować. Nie zamykaj karty.</p>';
                        setInterval(async () => {
                            const rs = await fetch('/status?userId=${userId}');
                            const s = await rs.json();
                            if (s.status === 'allowed') location.reload();
                        }, 3000);
                    } else if (d.action === 'success') {
                        document.getElementById('content').innerHTML = '<h2 style="color:#43b581">✅ Sukces!</h2><p>Rola została nadana.</p>';
                    } else {
                        document.getElementById('content').innerHTML = '<h2 style="color:#f04747">❌ Błąd</h2><p>' + d.msg + '</p>';
                    }
                };
            </script>
        </body>
        </html>
    `);
});

app.get('/status', async (req, res) => {
    const track = await RequestTracker.findOne({ userId: req.query.userId });
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

        if (isVPN) return res.json({ action: 'error', msg: 'VPN jest zabroniony.' });

        if (isMulticount || isForeign) {
            await RequestTracker.findOneAndUpdate({ userId }, { status: 'pending' }, { upsert: true });
            const myEmbed = new EmbedBuilder().setColor('#ffaa00').setTitle('⚠️ PODEJRZANE IP (TY)').setDescription(`Użytkownik: <@${userId}>\nKraj: ${country}\nIP: \`${cleanIP}\`\nPowód: ${isForeign ? 'Zagranica' : 'Multikonto'}`);
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

        await new UserIP({ userId, ip: cleanIP, country }).save();
        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(userId);
        await member.roles.add(ROLE_ID);
        await sendAdminLogs(userId, cleanIP, country, "AUTOMATYCZNA");
        res.json({ action: 'success' });
    } catch (e) { res.json({ action: 'error', msg: 'Błąd systemu.' }); }
});

// --- OBSŁUGA DISCORD ---
client.on('messageCreate', async (msg) => {
    if (msg.content === '!setup' && ALL_ADMINS.includes(msg.author.id)) {
        const embed = new EmbedBuilder()
            .setColor('#5865f2')
            .setTitle('🛡️ WERYFIKACJA UŻYTKOWNIKÓW')
            .setDescription('Kliknij przycisk poniżej, aby rozpocząć proces weryfikacji i uzyskać dostęp do serwera.')
            .setFooter({ text: 'System bezpieczeństwa Night RP' });
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('start_v').setLabel('ZWERYFIKUJ MNIE').setStyle(ButtonStyle.Primary)
        );
        await msg.channel.send({ embeds: [embed], components: [row] });
        await msg.delete();
    }
});

client.on('interactionCreate', async (int) => {
    if (!int.isButton()) return;

    if (int.customId === 'start_v') {
        const link = `https://kk-7stm.onrender.com/auth?token=${int.user.id}`;
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('OTWÓRZ STRONĘ').setURL(link).setStyle(ButtonStyle.Link));
        return int.reply({ content: 'Kliknij przycisk poniżej, aby dokończyć weryfikację:', components: [row], ephemeral: true });
    }

    const [action, targetId, ip, country] = int.customId.split('_');
    const guild = await client.guilds.fetch(GUILD_ID);

    try {
        if (action === 'allow') {
            const member = await guild.members.fetch(targetId);
            await member.roles.add(ROLE_ID);
            if (ip) await UserIP.findOneAndUpdate({ userId: targetId }, { ip, country }, { upsert: true });
            await updateLiveStatus(targetId, 'allowed', `✅ Zaakceptowano przez ${int.user.tag}`);
            await sendAdminLogs(targetId, ip, country, "RĘCZNA AKCEPTACJA", int.user.tag);
            try { await member.send({ content: `✅ Zostałeś zweryfikowany na **${guild.name}**!` }); } catch(e) {}
            await int.reply({ content: `Zaakceptowano.`, ephemeral: true });
        } else if (action === 'ban') {
            await guild.members.ban(targetId, { reason: 'Odrzucona weryfikacja' });
            await updateLiveStatus(targetId, 'banned', `🚫 Zbanowano przez ${int.user.tag}`);
            await int.reply({ content: `Zbanowano.`, ephemeral: true });
        }
    } catch (e) { console.log("Błąd przycisku."); }
});

client.on('ready', () => { console.log(`🤖 Bot online: ${client.user.tag}`); });
client.login(BOT_TOKEN);
app.listen(process.env.PORT || 3000);
