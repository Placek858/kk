const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');

// --- KONFIGURACJA ---
const BOT_TOKEN = process.env.DISCORD_TOKEN; 
const MONGO_URI = process.env.MONGO_URI; 
const PROXYCHECK_API_KEY = 'e2brv7-y9y366-243469-435457';
const ALL_ADMINS = ['1131510639769178132', '1276586330847051780', '1210653947061080175'];
const DOMAIN = process.env.DOMAIN || 'https://icarus-system.pl';
const ROLE_NAME = 'Zweryfikowany'; // Bot nada tę rolę na każdym serwerze

mongoose.connect(MONGO_URI).then(() => console.log("✅ ICARUS: System Core Online"));

// --- MODELE BAZY DANYCH ---
const UserIP = mongoose.model('UserIP', new mongoose.Schema({ userId: String, ip: String, fingerprint: String, country: String }));
const RequestTracker = mongoose.model('RequestTracker', new mongoose.Schema({ userId: String, status: { type: String, default: 'pending' }, reason: String }));
const AdminLog = mongoose.model('AdminLog', new mongoose.Schema({ targetId: String, messages: [{ adminId: String, messageId: String }] }));

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.DirectMessages] });
const app = express();
app.use(express.json());

// --- FRONTEND (Minimal Professional) ---
app.get('/auth', (req, res) => {
    const userId = req.query.token;
    res.send(`
        <!DOCTYPE html>
        <html lang="pl">
        <head>
            <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>ICARUS | Autoryzacja</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&display=swap');
                body { margin: 0; padding: 0; font-family: 'Inter', sans-serif; background: #0a0a0a; color: #ffffff; display: flex; justify-content: center; align-items: center; height: 100vh; }
                .container { width: 100%; max-width: 400px; padding: 40px; background: #111111; border: 1px solid #222; border-radius: 12px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.4); }
                .logo { font-weight: 600; letter-spacing: -1px; font-size: 24px; margin-bottom: 8px; color: #fff; }
                .status-tag { display: inline-block; padding: 4px 12px; background: rgba(88, 101, 242, 0.1); color: #5865f2; font-size: 11px; font-weight: 600; border-radius: 20px; margin-bottom: 24px; text-transform: uppercase; letter-spacing: 1px; }
                .description { color: #888; font-size: 14px; line-height: 1.6; margin-bottom: 32px; }
                .btn { background: #ffffff; color: #000000; border: none; padding: 14px 28px; font-weight: 600; font-size: 15px; border-radius: 8px; width: 100%; cursor: pointer; transition: all 0.2s ease; }
                .btn:hover { background: #e0e0e0; transform: translateY(-1px); }
                .loader { display: none; width: 24px; height: 24px; border: 2px solid #333; border-top: 2px solid #fff; border-radius: 50%; margin: 0 auto 20px; animation: spin 0.8s linear infinite; }
                #console { color: #555; font-size: 12px; margin-top: 20px; min-height: 14px; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="logo">ICARUS</div>
                <div class="status-tag">Security Node</div>
                <p class="description">W celu zapewnienia bezpieczeństwa, wymagana jest krótka autoryzacja Twojego profilu Discord.</p>
                <div class="loader" id="loader"></div>
                <div id="status-area"><button class="btn" id="startBtn">Zweryfikuj profil</button></div>
                <div id="console"></div>
            </div>
            <script>
                const userId = "${userId}";
                const btn = document.getElementById('startBtn');
                const loader = document.getElementById('loader');
                const con = document.getElementById('console');

                async function check() {
                    const r = await fetch('/status?userId=' + userId);
                    const s = await r.json();
                    if(s.status === 'allowed_manually' || s.status === 'success') location.reload();
                }

                btn.onclick = async () => {
                    btn.style.display = 'none';
                    loader.style.display = 'block';
                    con.innerText = "Analizowanie połączenia...";
                    const fp = btoa(screen.width+"x"+screen.height);
                    const res = await fetch('/complete', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ userId, fp })
                    });
                    const d = await res.json();
                    if(d.action === 'success') {
                        document.querySelector('.container').innerHTML = '<div style="font-size:40px; margin-bottom:15px;">✅</div><h2>Zweryfikowano</h2><p style="color:#888">Dostęp został przyznany.</p>';
                    } else if(d.action === 'wait') {
                        con.innerText = "Wymagana akceptacja administratora.";
                        setInterval(check, 3000);
                    } else {
                        con.style.color = "#ff4444";
                        con.innerText = "Błąd: " + d.msg;
                        btn.style.display = 'block'; loader.style.display = 'none';
                    }
                };
            </script>
        </body>
        </html>
    `);
});

// --- LOGIKA NADAWANIA ROLI (MULTI-SERVER) ---
async function grantAccess(userId) {
    client.guilds.cache.forEach(async (guild) => {
        try {
            const role = guild.roles.cache.find(r => r.name === ROLE_NAME);
            if (role) {
                const member = await guild.members.fetch(userId).catch(() => null);
                if (member) await member.roles.add(role);
            }
        } catch (e) { console.log(`Błąd nadawania roli na ${guild.name}`); }
    });
}

// --- POWITANIE ---
client.on('guildMemberAdd', async (member) => {
    try {
        const embed = new EmbedBuilder()
            .setTitle('ICARUS SYSTEM | Weryfikacja')
            .setDescription(`Witaj <@${member.id}>. Przejdź autoryzację, aby uzyskać dostęp.`)
            .setColor('#ffffff');
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('ZWERYFIKUJ PROFIL').setURL(`${DOMAIN}/auth?token=${member.id}`).setStyle(ButtonStyle.Link)
        );
        await member.send({ embeds: [embed], components: [row] });
    } catch (e) { console.log("DM zablokowane."); }
});

// --- OBSŁUGA PRZYCISKÓW ADMINA ---
client.on('interactionCreate', async (i) => {
    if (i.isButton()) {
        const [action, targetId] = i.customId.split('_');
        if (action === 'accept') {
            await RequestTracker.findOneAndUpdate({ userId: targetId }, { status: 'allowed_manually' });
            await grantAccess(targetId);
            await updateAdminLogs(targetId, i.user, 'accept');
            await i.reply({ content: 'Zaakceptowano.', ephemeral: true });
        }
        if (action === 'reject') {
            const modal = new ModalBuilder().setCustomId(`mod_${targetId}`).setTitle('Odrzucenie');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('r').setLabel('Powód').setStyle(TextInputStyle.Paragraph).setRequired(true)));
            await i.showModal(modal);
        }
    }
    if (i.isModalSubmit() && i.customId.startsWith('mod_')) {
        const targetId = i.customId.split('_')[1];
        const reason = i.fields.getTextInputValue('r');
        await RequestTracker.findOneAndUpdate({ userId: targetId }, { status: 'rejected', reason });
        await updateAdminLogs(targetId, i.user, 'reject', reason);
        await i.reply({ content: 'Odrzucono.', ephemeral: true });
    }
});

// --- POWIADOMIENIA ADMINÓW ---
async function sendAdminLogs(targetId, ip, country, operator, type, isAuto = false) {
    const embed = new EmbedBuilder()
        .setTitle(isAuto ? `✅ AUTO-PASS` : `⚠️ MANUAL REVIEW`)
        .setColor(isAuto ? '#ffffff' : '#ffaa00')
        .addFields({ name: '👤 Użytkownik', value: `<@${targetId}>`, inline: true }, { name: '🌍 Kraj', value: country, inline: true }, { name: '🔍 Powód', value: type, inline: false });
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`accept_${targetId}`).setLabel('AKCEPTUJ').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`reject_${targetId}`).setLabel('ODRZUĆ').setStyle(ButtonStyle.Danger)
    );
    let msgRefs = [];
    for (const admId of ALL_ADMINS) {
        try {
            const admin = await client.users.fetch(admId);
            const m = await admin.send({ embeds: [embed], components: isAuto ? [] : [row] });
            if (!isAuto) msgRefs.push({ adminId: admId, messageId: m.id });
        } catch (e) {}
    }
    if (msgRefs.length > 0) await AdminLog.findOneAndUpdate({ targetId }, { messages: msgRefs }, { upsert: true });
}

async function updateAdminLogs(targetId, adminUser, action, reason = "") {
    const logData = await AdminLog.findOne({ targetId });
    if (!logData) return;
    for (const msgRef of logData.messages) {
        try {
            const admin = await client.users.fetch(msgRef.adminId);
            const dm = await admin.createDM();
            const message = await dm.messages.fetch(msgRef.messageId);
            const status = action === 'accept' ? `✅ ZATWIERDZIŁ: <@${adminUser.id}>` : `❌ ODRZUCIŁ: <@${adminUser.id}>\nPowód: ${reason}`;
            const newEmbed = EmbedBuilder.from(message.embeds[0]).setColor(action === 'accept' ? '#43b581' : '#f04747').setDescription(status);
            await message.edit({ embeds: [newEmbed], components: [] });
        } catch (e) {}
    }
    await AdminLog.deleteOne({ targetId });
}

// --- SERWER API ---
app.get('/status', async (req, res) => {
    const doc = await RequestTracker.findOne({ userId: req.query.userId });
    res.json({ status: doc ? doc.status : 'pending', reason: doc ? doc.reason : '' });
});

app.post('/complete', async (req, res) => {
    const { userId, fp } = req.body;
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim();
    try {
        const devDup = await UserIP.findOne({ fingerprint: fp, userId: { $ne: userId } });
        if (devDup) return res.json({ action: 'error', msg: 'Urządzenie powiązane z innym kontem.' });

        const { data } = await axios.get(`https://proxycheck.io/v2/${ip}?key=${PROXYCHECK_API_KEY}&vpn=3&asn=1`);
        const country = data[ip].isocode || '??';
        const operator = data[ip].asn || 'Nieznany';
        const ipDup = await UserIP.findOne({ ip, userId: { $ne: userId } });

        if (country !== 'PL' || data[ip].proxy === 'yes' || ipDup) {
            await RequestTracker.findOneAndUpdate({ userId }, { status: 'pending' }, { upsert: true });
            await sendAdminLogs(userId, ip, country, operator, ipDup ? "Conflict: Same IP" : "VPN/Region Alert", false);
            return res.json({ action: 'wait' });
        }

        await new UserIP({ userId, ip, fingerprint: fp, country }).save();
        await grantAccess(userId);
        await sendAdminLogs(userId, ip, country, operator, "AUTO-PASS", true);
        res.json({ action: 'success' });
    } catch (e) { res.json({ action: 'error', msg: 'Błąd systemu.' }); }
});

client.once('ready', () => console.log(`🤖 ICARUS Ready | ${client.user.tag}`));
client.login(BOT_TOKEN);
app.listen(process.env.PORT || 3000);
