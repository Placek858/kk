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
mongoose.connect(MONGO_URI).then(() => console.log("✅ ICARUS: System Core Online"));

const UserIP = mongoose.model('UserIP', new mongoose.Schema({ userId: String, ip: String, fingerprint: String, country: String }));
const RequestTracker = mongoose.model('RequestTracker', new mongoose.Schema({ userId: String, status: { type: String, default: 'pending' }, reason: String }));
const AdminLog = mongoose.model('AdminLog', new mongoose.Schema({ targetId: String, messages: [{ adminId: String, messageId: String }] }));

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.DirectMessages] });
const app = express();
app.use(express.json());

// --- FRONTEND: ICARUS CORPORATE DESIGN ---
app.get('/auth', (req, res) => {
    const userId = req.query.token;
    res.send(`
        <!DOCTYPE html>
        <html lang="pl">
        <head>
            <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Icarus System • Authorization</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
                body { margin: 0; padding: 0; font-family: 'Inter', sans-serif; background-color: #f6f9fc; color: #1a1f36; display: flex; justify-content: center; align-items: center; height: 100vh; }
                .card { background: #ffffff; padding: 48px; width: 100%; max-width: 420px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #e3e8ee; text-align: center; }
                .brand { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 30px; color: #5469d4; font-weight: 700; font-size: 20px; text-transform: uppercase; letter-spacing: 1px; }
                .brand-icon { width: 32px; height: 32px; background: #5469d4; border-radius: 6px; }
                h1 { font-size: 24px; color: #1a1f36; margin-bottom: 15px; font-weight: 600; }
                p { font-size: 15px; color: #4f566b; line-height: 1.6; margin-bottom: 30px; }
                .btn { background-color: #5469d4; color: #fff; border: none; padding: 14px 28px; font-size: 16px; font-weight: 500; border-radius: 4px; width: 100%; cursor: pointer; transition: background 0.2s; }
                .btn:hover { background-color: #243d8c; }
                .loader { display: none; width: 28px; height: 28px; border: 3px solid #e3e8ee; border-top: 3px solid #5469d4; border-radius: 50%; margin: 0 auto 20px; animation: spin 0.8s linear infinite; }
                #console { font-size: 14px; color: #5469d4; margin-top: 15px; font-weight: 500; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                .footer { margin-top: 40px; font-size: 12px; color: #a3acb9; border-top: 1px solid #e3e8ee; padding-top: 20px; }
            </style>
        </head>
        <body>
            <div class="card">
                <div class="brand"><div class="brand-icon"></div> ICARUS SYSTEM</div>
                <div id="content">
                    <h1>Weryfikacja tożsamości</h1>
                    <p>System Icarus wymaga autoryzacji urządzenia w celu przyznania dostępu do zasobów sieciowych.</p>
                    <div class="loader" id="loader"></div>
                    <div id="btn-container"><button class="btn" id="startBtn">KONTYNUUJ</button></div>
                    <div id="console"></div>
                </div>
                <div class="footer">&copy; 2026 Icarus Solutions Ltd. Security Division.</div>
            </div>

            <script>
                const userId = "${userId}";
                const content = document.getElementById('content');
                const btn = document.getElementById('startBtn');
                const loader = document.getElementById('loader');
                const con = document.getElementById('console');

                async function check() {
                    const r = await fetch('/status?userId=' + userId);
                    const s = await r.json();
                    if(s.status === 'allowed_manually' || s.status === 'success') {
                        content.innerHTML = '<div style="color:#24b47e; font-size:50px; margin-bottom:15px;">✓</div><h1>Autoryzacja pomyślna</h1><p>Dostęp został przyznany. Możesz powrócić do aplikacji Discord.</p>';
                        return true;
                    } else if(s.status === 'rejected') {
                        content.innerHTML = '<div style="color:#cd3d64; font-size:50px; margin-bottom:15px;">✕</div><h1>Odmowa dostępu</h1><p>Twoje zgłoszenie zostało odrzucone przez administratora.</p><div style="background:#fff1f2; border:1px solid #fecaca; padding:12px; color:#991b1b; font-size:14px; text-align:left; border-radius:4px;"><strong>Powód:</strong> ' + (s.reason || "Brak uzasadnienia") + '</div>';
                        return true;
                    }
                    return false;
                }

                btn.onclick = async () => {
                    btn.style.display = 'none'; loader.style.display = 'block';
                    con.innerText = "Przetwarzanie danych...";
                    
                    const res = await fetch('/complete', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ userId })
                    });
                    const d = await res.json();

                    if(d.action === 'success') {
                        location.reload();
                    } else {
                        con.innerText = "Oczekiwanie na decyzję administracji...";
                        const poll = setInterval(async () => {
                            if(await check()) clearInterval(poll);
                        }, 2000);
                    }
                };
            </script>
        </body>
        </html>
    `);
});

// --- ADMIN INTERACTIONS ---
client.on('interactionCreate', async (i) => {
    if (i.isButton()) {
        const [action, targetId] = i.customId.split('_');
        if (action === 'accept') {
            await RequestTracker.findOneAndUpdate({ userId: targetId }, { status: 'allowed_manually' }, { upsert: true });
            await grantAccess(targetId);
            await updateAdminLogs(targetId, i.user, 'accept');
            await i.reply({ content: 'Zatwierdzono dostęp.', ephemeral: true });
        }
        if (action === 'reject') {
            const modal = new ModalBuilder().setCustomId(`mod_${targetId}`).setTitle('Odrzuć wniosek');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('r').setLabel('Uzasadnienie').setStyle(TextInputStyle.Paragraph).setRequired(true)));
            await i.showModal(modal);
        }
    }
    if (i.isModalSubmit() && i.customId.startsWith('mod_')) {
        const targetId = i.customId.split('_')[1];
        const reason = i.fields.getTextInputValue('r');
        await RequestTracker.findOneAndUpdate({ userId: targetId }, { status: 'rejected', reason }, { upsert: true });
        await updateAdminLogs(targetId, i.user, 'reject', reason);
        await i.reply({ content: 'Wniosek odrzucony.', ephemeral: true });
    }
});

// --- LOGIC FUNCTIONS ---
async function updateAdminLogs(targetId, adminUser, action, reason = "") {
    const logData = await AdminLog.findOne({ targetId });
    if (!logData) return;
    for (const msgRef of logData.messages) {
        try {
            const admin = await client.users.fetch(msgRef.adminId);
            const dm = await admin.createDM();
            const msg = await dm.messages.fetch(msgRef.messageId);
            const status = action === 'accept' ? `✅ **Dostęp przyznany przez:** <@${adminUser.id}>` : `❌ **Dostęp odrzucony przez:** <@${adminUser.id}>\n**Powód:** ${reason}`;
            const newEmbed = EmbedBuilder.from(msg.embeds[0]).setColor(action === 'accept' ? '#24b47e' : '#cd3d64').setDescription(status);
            await msg.edit({ embeds: [newEmbed], components: [] });
        } catch (e) {}
    }
    await AdminLog.deleteOne({ targetId });
}

async function grantAccess(userId) {
    client.guilds.cache.forEach(async (guild) => {
        const role = guild.roles.cache.find(r => r.name === ROLE_NAME);
        const member = await guild.members.fetch(userId).catch(() => null);
        if (role && member) await member.roles.add(role);
    });
}

async function sendAdminLogs(targetId, ip, country, operator) {
    const embed = new EmbedBuilder()
        .setTitle('Icarus System • Nowa Autoryzacja')
        .setColor('#f5a623')
        .addFields(
            { name: 'Użytkownik', value: `<@${targetId}> (\`${targetId}\`)` },
            { name: 'Lokalizacja', value: `\`${ip}\` (${country})`, inline: true },
            { name: 'Dostawca', value: `\`${operator}\``, inline: true }
        ).setFooter({ text: 'Wymagana decyzja administratora' });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`accept_${targetId}`).setLabel('Autoryzuj').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`reject_${targetId}`).setLabel('Odrzuć').setStyle(ButtonStyle.Danger)
    );

    let msgRefs = [];
    for (const admId of ALL_ADMINS) {
        try {
            const admin = await client.users.fetch(admId);
            const m = await admin.send({ embeds: [embed], components: [row] });
            msgRefs.push({ adminId: admId, messageId: m.id });
        } catch (e) {}
    }
    await AdminLog.findOneAndUpdate({ targetId }, { messages: msgRefs }, { upsert: true });
}

app.get('/status', async (req, res) => {
    const doc = await RequestTracker.findOne({ userId: req.query.userId });
    res.json({ status: doc ? doc.status : 'pending', reason: doc ? doc.reason : '' });
});

app.post('/complete', async (req, res) => {
    const { userId } = req.body;
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim();
    try {
        const { data } = await axios.get(`https://proxycheck.io/v2/${ip}?key=${PROXYCHECK_API_KEY}&vpn=3`);
        const country = data[ip].isocode || '??';
        
        await RequestTracker.findOneAndUpdate({ userId }, { status: 'pending' }, { upsert: true });
        await sendAdminLogs(userId, ip, country, data[ip].asn || "Unknown");
        res.json({ action: 'wait' });
    } catch (e) { res.status(500).send(); }
});

client.on('guildMemberAdd', async (m) => {
    const embed = new EmbedBuilder()
        .setTitle('ICARUS SYSTEM • Weryfikacja')
        .setDescription('Zostałeś skierowany do centrum autoryzacji Icarus. Kliknij poniższy przycisk, aby kontynuować proces weryfikacji urządzenia.')
        .setColor('#5469d4');
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('URUCHOM PORTAL').setURL(`${DOMAIN}/auth?token=${m.id}`).setStyle(ButtonStyle.Link));
    m.send({ embeds: [embed], components: [row] }).catch(() => {});
});

client.login(BOT_TOKEN);
app.listen(process.env.PORT || 3000);
