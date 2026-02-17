const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');

// --- CONFIGURATION ---
const BOT_TOKEN = process.env.DISCORD_TOKEN; 
const MONGO_URI = process.env.MONGO_URI; 
const PROXYCHECK_API_KEY = 'e2brv7-y9y366-243469-435457';
const ALL_ADMINS = ['1131510639769178132', '1276586330847051780', '1210653947061080175'];
const DOMAIN = process.env.DOMAIN || 'https://icarus-system.pl';
const ROLE_NAME = 'Zweryfikowany'; 

// --- DATABASE ---
mongoose.connect(MONGO_URI).then(() => console.log("✅ ICARUS: Corporate Systems Online"));

const UserIP = mongoose.model('UserIP', new mongoose.Schema({ userId: String, ip: String, fingerprint: String, country: String }));
const RequestTracker = mongoose.model('RequestTracker', new mongoose.Schema({ userId: String, status: { type: String, default: 'pending' }, reason: String }));
const AdminLog = mongoose.model('AdminLog', new mongoose.Schema({ targetId: String, messages: [{ adminId: String, messageId: String }] }));

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.DirectMessages] });
const app = express();
app.use(express.json());

// --- FRONTEND: REALISTIC CORPORATE DESIGN ---
app.get('/auth', (req, res) => {
    const userId = req.query.token;
    res.send(`
        <!DOCTYPE html>
        <html lang="pl">
        <head>
            <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Centrum Weryfikacji Icarus</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
                body { margin: 0; padding: 0; font-family: 'Inter', sans-serif; background-color: #f6f9fc; color: #1a1f36; display: flex; justify-content: center; align-items: center; height: 100vh; }
                .card { background: #ffffff; padding: 48px; width: 100%; max-width: 420px; border-radius: 16px; box-shadow: 0 15px 35px rgba(50,50,93,0.1), 0 5px 15px rgba(0,0,0,0.07); transition: all 0.3s ease; }
                .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 32px; font-weight: 600; font-size: 20px; color: #5469d4; }
                .brand-icon { width: 32px; height: 32px; background: #5469d4; border-radius: 8px; }
                h1 { font-size: 24px; font-weight: 600; margin: 0 0 12px 0; }
                p { font-size: 15px; line-height: 1.6; color: #4f566b; margin-bottom: 32px; }
                .btn { background-color: #5469d4; color: #fff; border: none; padding: 12px 24px; font-size: 16px; font-weight: 500; border-radius: 4px; width: 100%; cursor: pointer; }
                .footer-text { margin-top: 32px; font-size: 12px; color: #a3acb9; text-align: center; border-top: 1px solid #e3e8ee; padding-top: 24px; }
                .loader { display: none; width: 24px; height: 24px; border: 2px solid #e3e8ee; border-top: 2px solid #5469d4; border-radius: 50%; margin: 0 auto 20px; animation: spin 0.6s linear infinite; }
                #console { font-size: 13px; color: #697386; margin-top: 16px; text-align: center; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            </style>
        </head>
        <body>
            <div class="card" id="mainCard">
                <div class="brand"><div class="brand-icon"></div>ICARUS SOLUTIONS</div>
                <div id="contentArea">
                    <h1>Weryfikacja tożsamości</h1>
                    <p>Aby kontynuować, prosimy o przeprowadzenie standardowej autoryzacji urządzenia.</p>
                    <div class="loader" id="loader"></div>
                    <div id="status-area"><button class="btn" id="startBtn">Kontynuuj</button></div>
                    <div id="console"></div>
                </div>
                <div class="footer-text">&copy; 2026 Icarus Solutions Ltd. System Bezpieczeństwa.</div>
            </div>

            <script>
                const userId = "${userId}";
                const content = document.getElementById('contentArea');
                const btn = document.getElementById('startBtn');
                const loader = document.getElementById('loader');
                const con = document.getElementById('console');

                function showSuccess() {
                    content.innerHTML = '<div style="text-align:center;"><div style="font-size:48px; color:#24b47e; margin-bottom:24px;">✓</div><h1>Dostęp przyznany</h1><p>Twoja tożsamość została pomyślnie zweryfikowana przez system Icarus. Możesz teraz zamknąć to okno.</p></div>';
                }

                function showReject(reason) {
                    content.innerHTML = '<div style="text-align:center;"><div style="font-size:48px; color:#cd3d64; margin-bottom:24px;">✕</div><h1>Odmowa dostępu</h1><p>Twoja prośba o autoryzację została odrzucona przez administratora.</p><div style="background:#fef1f2; color:#cd3d64; padding:12px; border-radius:6px; font-size:13px; text-align:left;"><strong>Powód:</strong> ' + reason + '</div></div>';
                }

                async function checkStatus() {
                    const r = await fetch('/status?userId=' + userId);
                    const s = await r.json();
                    
                    if(s.status === 'allowed_manually' || s.status === 'success') {
                        showSuccess();
                        return true; // Stop polling
                    } else if(s.status === 'rejected') {
                        showReject(s.reason || "Brak szczegółowego uzasadnienia.");
                        return true; // Stop polling
                    }
                    return false;
                }

                btn.onclick = async () => {
                    btn.style.display = 'none'; loader.style.display = 'block';
                    con.innerText = "Przetwarzanie danych...";
                    const fp = btoa(screen.width+"x"+screen.height+"|"+Intl.DateTimeFormat().resolvedOptions().timeZone);
                    
                    const res = await fetch('/complete', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ userId, fp })
                    });
                    const d = await res.json();

                    if(d.action === 'success') {
                        showSuccess();
                    } else if(d.action === 'wait') {
                        con.innerText = "Oczekiwanie na decyzję administratora...";
                        const poll = setInterval(async () => {
                            const stop = await checkStatus();
                            if(stop) clearInterval(poll);
                        }, 3000);
                    } else {
                        con.style.color = "#cd3d64"; con.innerText = d.msg;
                        btn.style.display = 'block'; loader.style.display = 'none';
                    }
                };
            </script>
        </body>
        </html>
    `);
});

// --- BACKEND LOGIC ---
async function grantAccess(userId) {
    client.guilds.cache.forEach(async (guild) => {
        try {
            const role = guild.roles.cache.find(r => r.name === ROLE_NAME);
            if (role) {
                const member = await guild.members.fetch(userId).catch(() => null);
                if (member) await member.roles.add(role);
            }
        } catch (e) {}
    });
}

async function updateAdminLogs(targetId, adminUser, action, reason = "") {
    const logData = await AdminLog.findOne({ targetId });
    if (!logData) return;
    for (const msgRef of logData.messages) {
        try {
            const admin = await client.users.fetch(msgRef.adminId);
            const message = await (await admin.createDM()).messages.fetch(msgRef.messageId);
            const status = action === 'accept' ? `✅ **Dostęp autoryzowany**` : `❌ **Dostęp zablokowany**\nPowód: ${reason}`;
            const newEmbed = EmbedBuilder.from(message.embeds[0]).setColor(action === 'accept' ? '#24b47e' : '#cd3d64').setDescription(status);
            await message.edit({ embeds: [newEmbed], components: [] });
        } catch (e) {}
    }
    await AdminLog.deleteOne({ targetId });
}

async function sendAdminLogs(targetId, ip, country, operator, type, isAuto = false) {
    const embed = new EmbedBuilder()
        .setTitle(isAuto ? `Autoryzacja automatyczna` : `Weryfikacja manualna`)
        .setColor(isAuto ? '#24b47e' : '#f5a623')
        .addFields(
            { name: 'Użytkownik', value: `<@${targetId}>`, inline: true },
            { name: 'IP/Kraj', value: `${ip} (${country})`, inline: true },
            { name: 'Powód weryfikacji', value: type, inline: false }
        );

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`accept_${targetId}`).setLabel('Autoryzuj').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`reject_${targetId}`).setLabel('Odrzuć').setStyle(ButtonStyle.Danger)
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
            const modal = new ModalBuilder().setCustomId(`mod_${targetId}`).setTitle('Powód odmowy');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('r').setLabel('Dlaczego odrzucasz?').setStyle(TextInputStyle.Paragraph).setRequired(true)));
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

app.get('/status', async (req, res) => {
    const doc = await RequestTracker.findOne({ userId: req.query.userId });
    res.json({ status: doc ? doc.status : 'pending', reason: doc ? doc.reason : '' });
});

app.post('/complete', async (req, res) => {
    const { userId, fp } = req.body;
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim();
    try {
        const { data } = await axios.get(`https://proxycheck.io/v2/${ip}?key=${PROXYCHECK_API_KEY}&vpn=3&asn=1`);
        const country = data[ip].isocode || '??';
        const operator = data[ip].asn || 'Nieznany';

        if (country !== 'PL' || data[ip].proxy === 'yes') {
            await RequestTracker.findOneAndUpdate({ userId }, { status: 'pending' }, { upsert: true });
            await sendAdminLogs(userId, ip, country, operator, data[ip].proxy === 'yes' ? "VPN/Proxy" : "Zagraniczne IP", false);
            return res.json({ action: 'wait' });
        }

        await new UserIP({ userId, ip, fingerprint: fp, country }).save();
        await grantAccess(userId);
        await sendAdminLogs(userId, ip, country, operator, "Auto-sukces", true);
        res.json({ action: 'success' });
    } catch (e) { res.json({ action: 'error', msg: 'Błąd serwera.' }); }
});

client.on('guildMemberAdd', async (member) => {
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('Weryfikacja').setURL(`${DOMAIN}/auth?token=${member.id}`).setStyle(ButtonStyle.Link));
    member.send({ content: 'Wymagana weryfikacja:', components: [row] }).catch(() => {});
});

client.login(BOT_TOKEN);
app.listen(process.env.PORT || 3000);
