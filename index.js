const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');

const BOT_TOKEN = process.env.DISCORD_TOKEN; 
const MONGO_URI = process.env.MONGO_URI; 
const PROXYCHECK_API_KEY = 'e2brv7-y9y366-243469-435457';
const GUILD_ID = '1456335080116191436';
const ROLE_ID = '1461789323262296084';

const MY_ID = '1131510639769178132'; 
const OTHER_ADMINS = ['1364295526736199883', '1447828677109878904']; 
const ALL_ADMINS = [MY_ID, ...OTHER_ADMINS];

mongoose.connect(MONGO_URI).then(() => console.log("✅ Połączono z MongoDB"));

const UserIP = mongoose.model('UserIP', new mongoose.Schema({ userId: String, ip: String, country: String }));
const PanelTracker = mongoose.model('PanelTracker', new mongoose.Schema({ targetId: String, adminMessages: [{ adminId: String, messageId: String }] }));

// Nowy model do śledzenia statusu na stronie
const RequestTracker = mongoose.model('RequestTracker', new mongoose.Schema({ 
    userId: String, 
    status: { type: String, default: 'pending' } // pending, allowed, banned
}));

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const app = express();
app.use(express.urlencoded({ extended: true }));

async function updateLiveStatus(targetId, newStatus, actionText) {
    await RequestTracker.updateOne({ userId: targetId }, { status: newStatus });
    const panel = await PanelTracker.findOne({ targetId });
    if (!panel) return;
    for (const entry of panel.adminMessages) {
        try {
            const admin = await client.users.fetch(entry.adminId);
            const message = await admin.dmChannel.messages.fetch(entry.messageId);
            await message.edit({ content: `**ZAKOŃCZONO:** ${actionText}`, components: [] });
        } catch (e) {}
    }
    await PanelTracker.deleteOne({ targetId });
}

// STRONA WERYFIKACJI Z PODGLĄDEM NA ŻYWO
app.get('/auth', (req, res) => {
    const userId = req.query.token;
    res.send(`
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body { background:#2f3136; color:white; text-align:center; font-family:sans-serif; padding-top:100px; }
                .box { background:#36393f; display:inline-block; padding:40px; border-radius:10px; }
                button { background:#5865f2; color:white; padding:15px 30px; border:none; border-radius:5px; cursor:pointer; font-weight:bold; }
                #status { margin-top: 20px; font-style: italic; color: #b9bbbe; }
            </style>
        </head>
        <body>
            <div class="box" id="main-box">
                <h2>🛡️ Weryfikacja</h2>
                <div id="content">
                    <p>Kliknij poniżej, aby wysłać prośbę o weryfikację.</p>
                    <form id="verifyForm">
                        <input type="hidden" name="userId" value="${userId}">
                        <button type="submit">ZAKOŃCZ WERYFIKACJĘ</button>
                    </form>
                </div>
                <div id="status"></div>
            </div>

            <script>
                const form = document.getElementById('verifyForm');
                const content = document.getElementById('content');
                const statusDiv = document.getElementById('status');

                form.onsubmit = async (e) => {
                    e.preventDefault();
                    const formData = new URLSearchParams(new FormData(form));
                    content.innerHTML = "<h3>🔄 Przetwarzanie...</h3>";
                    
                    const response = await fetch('/complete', { method: 'POST', body: formData });
                    const result = await response.json();

                    if (result.action === 'wait') {
                        content.innerHTML = "<h3 style='color:#faa61a'>⏳ Oczekiwanie na admina...</h3><p>Nie zamykaj tej strony. Twój status zmieni się automatycznie.</p>";
                        checkStatus('${userId}');
                    } else if (result.action === 'success') {
                        content.innerHTML = "<h3 style='color:#43b581'>✅ Zaakceptowano!</h3><p>Możesz wrócić na Discorda.</p>";
                    } else {
                        content.innerHTML = "<h3 style='color:#f04747'>❌ Odrzucono</h3><p>" + (result.msg || "") + "</p>";
                    }
                };

                async function checkStatus(uid) {
                    const interval = setInterval(async () => {
                        const res = await fetch('/status?userId=' + uid);
                        const data = await res.json();
                        if (data.status === 'allowed') {
                            clearInterval(interval);
                            content.innerHTML = "<h3 style='color:#43b581'>✅ Zaakceptowano!</h3><p>Otrzymałeś rolę. Możesz zamknąć stronę.</p>";
                        } else if (data.status === 'banned') {
                            clearInterval(interval);
                            content.innerHTML = "<h3 style='color:#f04747'>❌ Odrzucono</h3><p>Zostałeś zablokowany na serwerze.</p>";
                        }
                    }, 3000);
                }
            </script>
        </body>
        </html>
    `);
});

// Endpoint do sprawdzania statusu przez stronę
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
            // Rejestrujemy prośbę w bazie statusów
            await RequestTracker.findOneAndUpdate({ userId }, { status: 'pending' }, { upsert: true });

            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle(isMulticount ? '⚠️ MULTIKONTO' : '🌍 ZAGRANICZNE IP')
                .setDescription(`Użytkownik: <@${userId}>\nKraj: ${country}\nIP: \`${cleanIP}\``);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`allow_${userId}_${cleanIP}_${country}`).setLabel('Przepuść').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`ban_${userId}`).setLabel('Zbanuj').setStyle(ButtonStyle.Danger)
            );

            const adminMsgs = [];
            for (const id of ALL_ADMINS) {
                const admin = await client.users.fetch(id);
                const msg = await admin.send({ embeds: [embed], components: [row] });
                adminMsgs.push({ adminId: id, messageId: msg.id });
            }
            await new PanelTracker({ targetId: userId, adminMessages: adminMsgs }).save();
            
            return res.json({ action: 'wait' });
        }

        await new UserIP({ userId, ip: cleanIP, country }).save();
        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(userId);
        await member.roles.add(ROLE_ID);
        res.json({ action: 'success' });
    } catch (e) { res.json({ action: 'error', msg: 'Błąd serwera.' }); }
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
            await updateLiveStatus(targetId, 'allowed', `✅ Zaakceptowano przez **${int.user.tag}**`);
        } else {
            await guild.members.ban(targetId, { reason: 'Odrzucono weryfikację' });
            await updateLiveStatus(targetId, 'banned', `🚫 Zbanowano przez **${int.user.tag}**`);
        }
    } catch (e) { console.log(e); }
});

client.login(BOT_TOKEN);
app.listen(process.env.PORT || 3000);
