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

const UserIP = mongoose.model('UserIP', new mongoose.Schema({ userId: String, ip: String, fingerprint: String, country: String }));
const RequestTracker = mongoose.model('RequestTracker', new mongoose.Schema({ userId: String, status: { type: String, default: 'pending' }, reason: String }));
const AdminLog = mongoose.model('AdminLog', new mongoose.Schema({ targetId: String, messages: [{ adminId: String, messageId: String }] }));

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.DirectMessages] });
const app = express();
app.use(express.json());

// --- FRONTEND (WIZUALNY MAJSTERSZTYK) ---
app.get('/auth', (req, res) => {
    const userId = req.query.token;
    res.send(`
        <!DOCTYPE html>
        <html lang="pl">
        <head>
            <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Night RP | Secure System</title>
            <script src="https://cdn.jsdelivr.net/particles.js/2.0.0/particles.min.js"></script>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Rajdhani:wght@300;500;700&display=swap');
                
                * { box-sizing: border-box; cursor: crosshair; }
                body { 
                    margin: 0; padding: 0; font-family: 'Rajdhani', sans-serif; 
                    background: #020205; overflow: hidden; height: 100vh;
                    display: flex; justify-content: center; align-items: center; color: #fff;
                }
                #particles-js { position: absolute; width: 100%; height: 100%; z-index: 1; }

                .main-frame {
                    position: relative; z-index: 10; width: 95%; max-width: 600px;
                    background: rgba(5, 5, 10, 0.8); border: 2px solid #5865f2;
                    border-radius: 20px; padding: 40px; box-shadow: 0 0 50px rgba(88, 101, 242, 0.4);
                    backdrop-filter: blur(15px); text-align: center;
                    clip-path: polygon(0 5%, 5% 0, 95% 0, 100% 5%, 100% 95%, 95% 100%, 5% 100%, 0 95%);
                }

                h1 { font-family: 'Orbitron', sans-serif; letter-spacing: 5px; color: #5865f2; text-transform: uppercase; margin-bottom: 5px; font-size: 28px; }
                .sub-header { color: #444; font-size: 12px; margin-bottom: 30px; letter-spacing: 2px; }

                /* Przyciski które nic nie robią */
                .fake-panel { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 30px; }
                .fake-btn { 
                    background: rgba(255,255,255,0.05); border: 1px solid rgba(88,101,242,0.3);
                    padding: 8px; font-size: 10px; color: #5865f2; border-radius: 5px; 
                    transition: 0.2s; text-transform: uppercase;
                }
                .fake-btn:hover { background: rgba(88,101,242,0.2); box-shadow: 0 0 10px #5865f2; }

                .action-btn {
                    background: #5865f2; border: none; padding: 20px 40px; color: #white;
                    font-family: 'Orbitron', sans-serif; font-size: 18px; border-radius: 10px;
                    width: 100%; transition: 0.3s; box-shadow: 0 0 20px rgba(88,101,242,0.6);
                }
                .action-btn:hover { letter-spacing: 3px; transform: scale(1.02); background: #4752c4; }

                #console {
                    background: rgba(0,0,0,0.5); border: 1px solid #222; height: 100px;
                    margin-top: 20px; border-radius: 10px; padding: 10px; overflow-y: hidden;
                    text-align: left; font-family: monospace; font-size: 12px; color: #43b581;
                }

                .scanner-line {
                    position: absolute; top: 0; left: 0; width: 100%; height: 2px;
                    background: #5865f2; box-shadow: 0 0 15px #5865f2;
                    animation: scan 3s infinite linear; display: none;
                }
                @keyframes scan { 0% { top: 0% } 100% { top: 100% } }
            </style>
        </head>
        <body>
            <div id="particles-js"></div>
            
            <div class="main-frame" id="box">
                <div class="scanner-line" id="scanner"></div>
                <h1>NIGHT RP SECURITY</h1>
                <div class="sub-header">SYSTEM IDENTYFIKACJI BIOMETRYCZNEJ V.4.0</div>

                <div class="fake-panel">
                    <button class="fake-btn" onclick="alert('Baza danych zsynchronizowana')">DB_SYNC</button>
                    <button class="fake-btn" onclick="alert('Protokół tunelowania aktywny')">PROXY_TNL</button>
                    <button class="fake-btn" onclick="alert('Pakiety AES-256 zabezpieczone')">ENCRYPT_V2</button>
                </div>

                <p style="color: #888;">System wykrył próbę połączenia. Wymagana autoryzacja sprzętowa.</p>

                <div id="status-area">
                    <button class="action-btn" id="startBtn">INICJUJ WERYFIKACJĘ</button>
                </div>

                <div id="console">
                    > Oczekiwanie na sygnał...<br>
                    > System gotowy do skanowania...
                </div>
            </div>

            <script>
                particlesJS('particles-js', {
                    "particles": {
                        "number": { "value": 80 },
                        "color": { "value": "#5865f2" },
                        "shape": { "type": "circle" },
                        "opacity": { "value": 0.5 },
                        "size": { "value": 3 },
                        "line_linked": { "enable": true, "distance": 150, "color": "#5865f2", "opacity": 0.4, "width": 1 },
                        "move": { "enable": true, "speed": 2 }
                    }
                });

                const userId = "${userId}";
                const con = document.getElementById('console');

                function log(text) {
                    con.innerHTML += "> " + text + "<br>";
                    con.scrollTop = con.scrollHeight;
                }

                async function check() {
                    const r = await fetch('/status?userId=' + userId);
                    const s = await r.json();
                    if(s.status === 'allowed_manually' || s.status === 'success') {
                        document.getElementById('box').innerHTML = '<h1>DOSTĘP PRZYZNANY</h1><p>Możesz wrócić na Discorda.</p>';
                    } else if(s.status === 'rejected') {
                        document.getElementById('box').innerHTML = '<h1 style="color:red">DOSTĘP ODRZUCONY</h1><p>Powód: '+s.reason+'</p>';
                    }
                }

                document.getElementById('startBtn').onclick = async () => {
                    document.getElementById('startBtn').style.display = 'none';
                    document.getElementById('scanner').style.display = 'block';
                    
                    log("Inicjowanie skanowania...");
                    setTimeout(() => log("Pobieranie odcisku urządzenia..."), 500);
                    setTimeout(() => log("Analiza geolokalizacji..."), 1200);
                    setTimeout(() => log("Sprawdzanie bazy multikont..."), 2000);

                    const fp = btoa(screen.width+"x"+screen.height+"|"+Intl.DateTimeFormat().resolvedOptions().timeZone+"|"+(navigator.hardwareConcurrency || 4));

                    setTimeout(async () => {
                        const res = await fetch('/complete', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({ userId, fp })
                        });
                        const d = await res.json();

                        if(d.action === 'success') {
                            log("AUTORYZACJA POMYŚLNA.");
                            document.getElementById('box').innerHTML = '<h1>SYSTEM ODBLOKOWANY</h1><p>Witaj na Night RP!</p>';
                        } else if(d.action === 'wait') {
                            log("WYKRYTO ANOMALIĘ. OCZEKIWANIE NA ADMINA...");
                            document.getElementById('status-area').innerHTML = '<h2 style="color: #fbbf24; animation: pulse 1s infinite;">PENDING...</h2>';
                            setInterval(check, 3000);
                        } else {
                            log("BŁĄD: " + d.msg);
                            document.getElementById('status-area').innerHTML = '<p style="color:red">'+d.msg+'</p>';
                        }
                    }, 3000);
                };
            </script>
        </body>
        </html>
    `);
});

// --- RESZTA KODU (BOT + LOGIKA) BEZ ZMIAN (Poprawiona dla ALL_ADMINS) ---
app.get('/status', async (req, res) => {
    const doc = await RequestTracker.findOne({ userId: req.query.userId });
    res.json({ status: doc ? doc.status : 'pending', reason: doc ? doc.reason : '' });
});

async function sendAdminLogs(targetId, ip, country, operator, type, isAuto = false) {
    const embed = new EmbedBuilder()
        .setTitle(isAuto ? `✅ AUTOMATYCZNA WERYFIKACJA` : `⚠️ DECYZJA ADMINA`)
        .setColor(isAuto ? '#43b581' : '#faa61a')
        .addFields(
            { name: '👤 Gracz', value: `<@${targetId}>`, inline: true },
            { name: '🌍 Kraj', value: country, inline: true },
            { name: '🏢 Operator', value: operator, inline: false },
            { name: '🔍 Powód', value: type }
        ).setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`accept_${targetId}`).setLabel('WPUŚĆ').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`reject_${targetId}`).setLabel('ZABLOKUJ').setStyle(ButtonStyle.Danger)
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
            const text = action === 'accept' ? `✅ Zaakceptowany przez <@${adminUser.id}>` : `❌ Odrzucony przez <@${adminUser.id}>\nPowód: ${reason}`;
            const newEmbed = EmbedBuilder.from(message.embeds[0]).setColor(action === 'accept' ? '#43b581' : '#f04747').setDescription(text);
            await message.edit({ embeds: [newEmbed], components: [] });
        } catch (e) {}
    }
    await AdminLog.deleteOne({ targetId });
}

client.on('interactionCreate', async (i) => {
    if (i.isButton()) {
        const [action, targetId] = i.customId.split('_');
        if (action === 'accept') {
            await RequestTracker.findOneAndUpdate({ userId: targetId }, { status: 'allowed_manually' });
            try {
                const guild = await client.guilds.fetch(GUILD_ID);
                const member = await guild.members.fetch(targetId);
                await member.roles.add(ROLE_ID);
                await updateAdminLogs(targetId, i.user, 'accept');
                await i.reply({ content: 'Wpuszczono.', ephemeral: true });
            } catch (e) { i.reply({ content: 'Błąd!', ephemeral: true }); }
        }
        if (action === 'reject') {
            const modal = new ModalBuilder().setCustomId(`mod_${targetId}`).setTitle('Odrzuć');
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

app.post('/complete', async (req, res) => {
    const { userId, fp } = req.body;
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim();
    try {
        const devDup = await UserIP.findOne({ fingerprint: fp, userId: { $ne: userId } });
        if (devDup) return res.json({ action: 'error', msg: 'Zabezpieczenie: Twoje urządzenie jest już zarejestrowane.' });

        const { data } = await axios.get(`https://proxycheck.io/v2/${ip}?key=${PROXYCHECK_API_KEY}&vpn=3&asn=1`);
        const country = data[ip].isocode || '??';
        const operator = data[ip].asn || 'Nieznany';
        const ipDup = await UserIP.findOne({ ip, userId: { $ne: userId } });

        if (country !== 'PL' || data[ip].proxy === 'yes' || ipDup) {
            await RequestTracker.findOneAndUpdate({ userId }, { status: 'pending' }, { upsert: true });
            await sendAdminLogs(userId, ip, country, operator, ipDup ? "To samo IP" : "VPN/KRAJ", false);
            return res.json({ action: 'wait' });
        }

        await new UserIP({ userId, ip, fingerprint: fp, country }).save();
        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(userId);
        await member.roles.add(ROLE_ID);
        await sendAdminLogs(userId, ip, country, operator, "SUKCES", true);
        res.json({ action: 'success' });
    } catch (e) { res.json({ action: 'error', msg: 'System Error.' }); }
});

client.login(BOT_TOKEN);
app.listen(process.env.PORT || 3000);
