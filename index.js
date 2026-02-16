const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');

// --- KONFIGURACJA ---
const BOT_TOKEN = process.env.DISCORD_TOKEN; 
const MONGO_URI = process.env.MONGO_URI; 
const PROXYCHECK_API_KEY = 'e2brv7-y9y366-243469-435457';
const GUILD_ID = '1464901079593521322';
const ROLE_ID = '1473060746194845959';
const ALL_ADMINS = ['1131510639769178132', '1276586330847051780', '1210653947061080175'];

mongoose.connect(MONGO_URI).then(() => console.log("✅ Night RP Security Active"));

// --- MODELE ---
const UserIP = mongoose.model('UserIP', new mongoose.Schema({ userId: String, ip: String, fingerprint: String, country: String }));
const RequestTracker = mongoose.model('RequestTracker', new mongoose.Schema({ userId: String, status: { type: String, default: 'pending' }, reason: String }));
const AdminLog = mongoose.model('AdminLog', new mongoose.Schema({ targetId: String, messages: [{ adminId: String, messageId: String }] }));

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.DirectMessages] });
const app = express();
app.use(express.json());

// --- FRONTEND (STYLIZACJA CYBER-PREMIUM) ---
app.get('/auth', (req, res) => {
    const userId = req.query.token;
    res.send(`
        <!DOCTYPE html>
        <html lang="pl">
        <head>
            <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Night RP | Secure Terminal</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600&display=swap');
                * { box-sizing: border-box; }
                body { 
                    margin: 0; padding: 0; font-family: 'Outfit', sans-serif; 
                    background: #050508 url('https://discord.com/assets/652f404f275e28ef9a35.png') no-repeat center center fixed; 
                    background-size: cover; display: flex; justify-content: center; align-items: center; min-height: 100vh; color: white;
                }
                body::before {
                    content: ""; position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                    background: radial-gradient(circle at center, rgba(88, 101, 242, 0.1) 0%, rgba(0,0,0,0.8) 100%);
                    z-index: 0;
                }
                .card { 
                    position: relative; z-index: 1;
                    background: rgba(10, 10, 15, 0.7); backdrop-filter: blur(30px); -webkit-backdrop-filter: blur(30px);
                    border: 1px solid rgba(255,255,255,0.1); padding: 60px 40px; border-radius: 40px; 
                    text-align: center; max-width: 480px; width: 95%; 
                    box-shadow: 0 40px 100px rgba(0,0,0,0.8), inset 0 0 20px rgba(255,255,255,0.02);
                    animation: cardSlide 1s cubic-bezier(0.16, 1, 0.3, 1);
                }
                @keyframes cardSlide { from { opacity: 0; transform: translateY(40px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
                .logo-icon { font-size: 50px; margin-bottom: 20px; filter: drop-shadow(0 0 15px #5865f2); }
                h1 { 
                    font-size: 38px; margin: 0 0 15px 0; font-weight: 600; 
                    background: linear-gradient(135deg, #fff 0%, #5865f2 100%);
                    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                    letter-spacing: -1px;
                }
                p { color: rgba(255,255,255,0.6); font-size: 16px; line-height: 1.6; margin-bottom: 30px; font-weight: 300; }
                .btn { 
                    background: #5865f2; color: white; padding: 20px; border: none; border-radius: 20px; 
                    cursor: pointer; font-size: 16px; font-weight: 600; width: 100%; 
                    transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
                    text-transform: uppercase; letter-spacing: 2px;
                    box-shadow: 0 15px 30px rgba(88, 101, 242, 0.3);
                }
                .btn:hover { transform: translateY(-5px); box-shadow: 0 20px 40px rgba(88, 101, 242, 0.5); background: #6773f3; }
                .btn:active { transform: translateY(0); }
                .loader { 
                    display: none; border: 4px solid rgba(255,255,255,0.1); border-top: 4px solid #5865f2; 
                    border-radius: 50%; width: 60px; height: 60px; animation: spin 1s linear infinite; margin: 20px auto;
                }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                .footer-tag { font-size: 10px; color: rgba(255,255,255,0.2); margin-top: 40px; text-transform: uppercase; letter-spacing: 3px; }
            </style>
        </head>
        <body>
            <div class="card" id="box">
                <div class="logo-icon">🛡️</div>
                <h1>System Security</h1>
                <p>Zidentyfikuj swoje połączenie, aby uzyskać dostęp do serwera <b>Night RP</b>.</p>
                <div class="loader" id="loader"></div>
                <button class="btn" id="startBtn">Zweryfikuj tożsamość</button>
                <div class="footer-tag">Encrypted Connection</div>
            </div>

            <script>
                const userId = "${userId}";
                let interval;

                async function check() {
                    const r = await fetch('/status?userId=' + userId);
                    const s = await r.json();
                    if(s.status === 'allowed_manually' || s.status === 'success') {
                        document.getElementById('box').innerHTML = '<div class="logo-icon">✅</div><h1 style="background:linear-gradient(135deg, #4ade80 0%, #22c55e 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Zatwierdzono</h1><p>Dostęp przyznany. Wróć na Discorda, Misiu!</p>';
                        clearInterval(interval);
                    } else if(s.status === 'rejected') {
                        document.getElementById('box').innerHTML = '<div class="logo-icon">❌</div><h1 style="background:linear-gradient(135deg, #f87171 0%, #ef4444 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Odmowa</h1><p>Powód: ' + (s.reason || 'Brak danych') + '</p><button class="btn" onclick="location.reload()">Spróbuj ponownie</button>';
                        clearInterval(interval);
                    }
                }

                document.getElementById('startBtn').onclick = async () => {
                    document.getElementById('startBtn').style.display = 'none';
                    document.getElementById('loader').style.display = 'block';

                    // Pancerne FP: Ekran + Czas + Rdzenie + Język
                    const fp = btoa(screen.width+"x"+screen.height+"|"+Intl.DateTimeFormat().resolvedOptions().timeZone+"|"+(navigator.hardwareConcurrency || 4)+"|"+navigator.language);

                    const res = await fetch('/complete', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ userId, fp })
                    });
                    const d = await res.json();

                    if(d.action === 'success') {
                        document.getElementById('box').innerHTML = '<div class="logo-icon">✅</div><h1>Sukces</h1><p>Weryfikacja automatyczna pomyślna!</p>';
                    } else if(d.action === 'wait') {
                        document.getElementById('box').innerHTML = '<div class="logo-icon">⏳</div><h1>Oczekiwanie</h1><p>Admin musi zatwierdzić Twoje połączenie (VPN/KRAJ/IP). Nie zamykaj karty!</p>';
                        interval = setInterval(check, 3000);
                    } else {
                        document.getElementById('box').innerHTML = '<div class="logo-icon">⚠️</div><h1>Błąd</h1><p>'+d.msg+'</p><button class="btn" onclick="location.reload()">Odśwież</button>';
                    }
                };
            </script>
        </body>
        </html>
    `);
});

app.get('/status', async (req, res) => {
    const doc = await RequestTracker.findOne({ userId: req.query.userId });
    res.json({ status: doc ? doc.status : 'pending', reason: doc ? doc.reason : '' });
});

// --- GLOBALNE LOGI ADMINÓW ---
async function sendAdminLogs(targetId, ip, country, operator, type, isAuto = false) {
    const embed = new EmbedBuilder()
        .setTitle(isAuto ? `✅ AUTOMATYCZNA WERYFIKACJA` : `⚠️ WYMAGANA DECYZJA`)
        .setColor(isAuto ? '#43b581' : '#faa61a')
        .addFields(
            { name: '👤 Gracz', value: `<@${targetId}>`, inline: true },
            { name: '🌍 Kraj', value: country, inline: true },
            { name: '🔍 IP', value: `\`${ip}\``, inline: false },
            { name: '🏢 Operator', value: operator, inline: false },
            { name: '❓ Powód', value: type, inline: false }
        ).setTimestamp();

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

    if (msgRefs.length > 0) {
        await AdminLog.findOneAndUpdate({ targetId }, { messages: msgRefs }, { upsert: true });
    }
}

async function updateAdminLogs(targetId, adminUser, action, reason = "") {
    const logData = await AdminLog.findOne({ targetId });
    if (!logData) return;
    const color = action === 'accept' ? '#43b581' : '#f04747';
    const text = action === 'accept' ? `✅ **ZAAKCEPTOWANO** przez <@${adminUser.id}>` : `❌ **ODRZUCONO** przez <@${adminUser.id}>\n**Powód:** ${reason}`;

    for (const msgRef of logData.messages) {
        try {
            const admin = await client.users.fetch(msgRef.adminId);
            const dm = await admin.createDM();
            const message = await dm.messages.fetch(msgRef.messageId);
            const newEmbed = EmbedBuilder.from(message.embeds[0]).setColor(color).setDescription(text);
            await message.edit({ embeds: [newEmbed], components: [] });
        } catch (e) {}
    }
    await AdminLog.deleteOne({ targetId });
}

// --- INTERAKCJE ---
client.on('interactionCreate', async (interaction) => {
    if (interaction.isButton()) {
        const [action, targetId] = interaction.customId.split('_');
        if (action === 'accept') {
            await RequestTracker.findOneAndUpdate({ userId: targetId }, { status: 'allowed_manually' });
            try {
                const guild = await client.guilds.fetch(GUILD_ID);
                const member = await guild.members.fetch(targetId);
                await member.roles.add(ROLE_ID);
                await updateAdminLogs(targetId, interaction.user, 'accept');
                await interaction.reply({ content: 'Zaakceptowano!', ephemeral: true });
            } catch (e) { await interaction.reply({ content: 'Błąd!', ephemeral: true }); }
        }
        if (action === 'reject') {
            const modal = new ModalBuilder().setCustomId(`modal_reject_${targetId}`).setTitle('Odrzuć gracza');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reason').setLabel('Powód').setStyle(TextInputStyle.Paragraph).setRequired(true)));
            await interaction.showModal(modal);
        }
    }
    if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_reject_')) {
        const targetId = interaction.customId.split('_')[2];
        const reason = interaction.fields.getTextInputValue('reason');
        await RequestTracker.findOneAndUpdate({ userId: targetId }, { status: 'rejected', reason });
        await updateAdminLogs(targetId, interaction.user, 'reject', reason);
        await interaction.reply({ content: 'Odrzucono!', ephemeral: true });
    }
});

// --- LOGIKA COMPLETE ---
app.post('/complete', async (req, res) => {
    const { userId, fp } = req.body;
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim();
    try {
        const devDup = await UserIP.findOne({ fingerprint: fp, userId: { $ne: userId } });
        if (devDup) return res.json({ action: 'error', msg: 'To urządzenie jest już przypisane do innego konta.' });

        const { data } = await axios.get(`https://proxycheck.io/v2/${ip}?key=${PROXYCHECK_API_KEY}&vpn=3&asn=1`);
        const country = data[ip].isocode || '??';
        const isVPN = data[ip].proxy === 'yes';
        const operator = data[ip].asn || 'Nieznany';
        const ipDup = await UserIP.findOne({ ip, userId: { $ne: userId } });

        if (country !== 'PL' || isVPN || ipDup) {
            let reason = isVPN ? "Proxy/VPN" : (ipDup ? "To samo IP" : "Kraj: " + country);
            await RequestTracker.findOneAndUpdate({ userId }, { status: 'pending' }, { upsert: true });
            await sendAdminLogs(userId, ip, country, operator, reason, false);
            return res.json({ action: 'wait' });
        }

        await new UserIP({ userId, ip, fingerprint: fp, country }).save();
        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(userId);
        await member.roles.add(ROLE_ID);
        await sendAdminLogs(userId, ip, country, operator, "Weryfikacja Automatyczna", true);
        res.json({ action: 'success' });
    } catch (e) { res.json({ action: 'error', msg: 'Błąd serwera.' }); }
});

client.login(BOT_TOKEN);
app.listen(process.env.PORT || 3000);
