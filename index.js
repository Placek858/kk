const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const axios = require('axios');

const BOT_TOKEN = process.env.DISCORD_TOKEN;
const PROXYCHECK_API_KEY = 'e2brv7-y9y366-243469-435457';
const GUILD_ID = '1456335080116191436';
const ROLE_ID = '1461789323262296084';

// --- WPISZ TUTAJ ID ADMINISTRATORÓW ---
const ADMIN_IDS = ['1364295526736199883', '1447828677109878904', '1131510639769178132']; 

const app = express();
const PORT = process.env.PORT || 3000;

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] 
});

app.use(express.urlencoded({ extended: true }));

// Funkcja do wysyłania logów do adminów
async function sendLogToAdmins(message) {
    for (const id of ADMIN_IDS) {
        try {
            const admin = await client.users.fetch(id);
            await admin.send(`🔔 **LOG WERYFIKACJI:** ${message}`);
        } catch (err) {
            console.log(`Nie udało się wysłać loga do ${id}`);
        }
    }
}

app.get('/auth', async (req, res) => {
    const userId = req.query.token;
    if (!userId) return res.status(400).send('Błąd: Brak tokenu.');

    // Log: Rozpoczęcie weryfikacji
    await sendLogToAdmins(`Użytkownik o ID: \`${userId}\` wszedł na stronę weryfikacji.`);

    res.send(`
        <html>
            <body style="background-color: #2f3136; color: white; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;">
                <div style="background-color: #36393f; padding: 40px; border-radius: 8px; text-align: center;">
                    <h2>Weryfikacja Konta</h2>
                    <form action="/complete" method="POST">
                        <input type="hidden" name="userId" value="${userId}">
                        <button type="submit" style="background-color: #5865f2; color: white; border: none; padding: 14px 20px; border-radius: 4px; cursor: pointer; font-weight: bold;">Zakończ weryfikację</button>
                    </form>
                </div>
            </body>
        </html>
    `);
});

app.post('/complete', async (req, res) => {
    const userId = req.body.userId;
    const userIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const cleanIP = userIP.split(',')[0].trim();

    try {
        const response = await axios.get(`https://proxycheck.io/v2/${cleanIP}?key=${PROXYCHECK_API_KEY}&vpn=1`);
        const result = response.data[cleanIP];

        if (result && result.proxy === 'yes') {
            await sendLogToAdmins(`❌ Użytkownik <@${userId}> został odrzucony (Wykryto VPN: ${cleanIP}).`);
            return res.status(403).send('Błąd: Wyłącz VPN.');
        }

        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(userId);

        await member.roles.add(ROLE_ID);
        
        // Log: Zakończenie sukcesem
        await sendLogToAdmins(`✅ Użytkownik **${member.user.tag}** (\`${userId}\`) pomyślnie przeszedł weryfikację.`);
        
        res.send('<h1>Sukces! Rola nadana.</h1>');
    } catch (error) {
        res.status(500).send('Błąd serwera.');
    }
});

client.login(BOT_TOKEN);
app.listen(PORT, () => console.log(`System logów aktywny na porcie ${PORT}`));
